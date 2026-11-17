import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

/*
 * Integration tests for the LuxuryStay REST API.
 *
 * A throwaway in-memory MongoDB instance is used so the suite never touches a
 * developer's local database. The fixture data from `seedDatabase` gives every
 * test a realistic starting point. Fixtures live in `tests/fixtures` and are
 * never loaded by the running application.
 */

let app;
let connectDB;
let disconnectDB;
let seedDatabase;

const tokens = {};
const ids = {};

const pad = (value) => String(value).padStart(2, '0');

/** ISO timestamp `days` from now at a friendly hour, in local time. */
const at = (days, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

const signIn = async (email, password) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login failed for ${email}: ${res.text}`);
  assert.ok(res.body.token);
  return res.body;
};

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.USE_MEMORY_DB = 'true';
  process.env.JWT_SECRET = 'luxurystay-test-secret';
  // Point at an unused port so connectDB falls through to the in-memory server
  // instead of connecting to (and later clearing) a real local database.
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/luxurystay-test';

  ({ connectDB, disconnectDB } = await import('../src/config/db.js'));
  ({ seedDatabase } = await import('./fixtures/seed.js'));
  const { createApp } = await import('../src/app.js');

  await connectDB();
  await seedDatabase({ silent: true });
  app = createApp();

  const [admin, manager, reception, housekeeping, guest] = await Promise.all([
    signIn('admin@luxurystay.com', 'Admin@123'),
    signIn('manager@luxurystay.com', 'Manager@123'),
    signIn('reception@luxurystay.com', 'Reception@123'),
    signIn('housekeeping@luxurystay.com', 'Housekeeping@123'),
    signIn('guest@luxurystay.com', 'Guest@123'),
  ]);

  tokens.admin = admin.token;
  tokens.manager = manager.token;
  tokens.receptionist = reception.token;
  tokens.housekeeping = housekeeping.token;
  tokens.guest = guest.token;

  for (const user of [admin, manager, reception, housekeeping, guest]) {
    assert.equal(user.user.password, undefined, 'password must never be returned');
  }
});

after(async () => {
  await disconnectDB();
});

describe('health and public site', () => {
  test('health endpoint reports a live database', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database.readyState, 1);
  });

  test('public hotel information exposes rooms and testimonials', async () => {
    const res = await request(app).get('/api/public/info');
    assert.equal(res.status, 200);
    assert.ok(res.body.hotel.name);
    assert.ok(res.body.roomTypes.length >= 3);
    assert.ok(res.body.roomCount >= 20);
    assert.ok(Array.isArray(res.body.testimonials));
  });

  test('public availability search returns bookable room types', async () => {
    const res = await request(app)
      .get('/api/public/availability')
      .query({ checkIn: at(40), checkOut: at(43), guests: 2 });

    assert.equal(res.status, 200);
    assert.equal(res.body.nights, 3);
    assert.ok(res.body.roomTypes.length >= 1);
    const type = res.body.roomTypes[0];
    assert.ok(type.availableCount > 0);
    ids.publicRoomType = type.id;
  });

  test('public availability rejects a reversed date range', async () => {
    const res = await request(app)
      .get('/api/public/availability')
      .query({ checkIn: at(45), checkOut: at(44) });

    assert.equal(res.status, 422);
    assert.match(res.body.message, /after check-in/i);
  });

  test('booking a room requires a signed-in guest', async () => {
    assert.ok(ids.publicRoomType, 'availability must run first');

    const res = await request(app).post('/api/public/bookings').send({
      firstName: 'Test',
      lastName: 'Traveller',
      email: 'test.traveller@example.com',
      phone: '+1 415 555 0999',
      checkIn: at(40),
      checkOut: at(43),
      adults: 2,
      children: 0,
      roomTypeId: ids.publicRoomType,
    });

    assert.equal(res.status, 401);
  });

  test('a signed-in guest can submit a reservation request', async () => {
    assert.ok(ids.publicRoomType, 'availability must run first');

    const registered = await request(app).post('/api/auth/register').send({
      name: 'Test Traveller',
      email: 'test.traveller@example.com',
      password: 'Traveller@123',
      phone: '+1 415 555 0999',
    });
    assert.equal(registered.status, 201, registered.text);
    ids.publicGuestToken = registered.body.token;

    const res = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${ids.publicGuestToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Traveller',
        email: 'test.traveller@example.com',
        phone: '+1 415 555 0999',
        checkIn: at(40),
        checkOut: at(43),
        adults: 2,
        children: 0,
        roomTypeId: ids.publicRoomType,
        specialRequests: 'Quiet room please.',
      });

    assert.equal(res.status, 201, res.text);
    assert.match(res.body.booking.reference, /^LUX-/);
    assert.equal(res.body.booking.status, 'pending');
    assert.equal(res.body.booking.firstName, 'Test');
    assert.equal(res.body.booking.lastName, 'Traveller');
    assert.equal(res.body.booking.guestName, 'Test Traveller');
    assert.equal(res.body.booking.nights, 3);
    assert.ok(res.body.booking.totalAmount > 0);
    ids.publicBookingReference = res.body.booking.reference;
  });

  test('the new reservation appears in the guest portal', async () => {
    const res = await request(app)
      .get('/api/portal/bookings')
      .set('Authorization', `Bearer ${ids.publicGuestToken}`);

    assert.equal(res.status, 200, res.text);
    assert.ok(
      res.body.bookings.some((booking) => booking.reference === ids.publicBookingReference),
      'the online booking must be linked to the signed-in guest'
    );
  });

  test('a guest cannot book under a different email address', async () => {
    const res = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${ids.publicGuestToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Traveller',
        email: 'someone.else@example.com',
        phone: '+1 415 555 0999',
        checkIn: at(45),
        checkOut: at(47),
        adults: 2,
        children: 0,
        roomTypeId: ids.publicRoomType,
      });

    assert.equal(res.status, 403);
  });

  test('public feedback requires a valid reservation', async () => {
    const res = await request(app).post('/api/public/feedback').send({
      reference: 'LUX-NOPE',
      email: 'nobody@example.com',
      ratings: { overall: 5 },
    });

    assert.equal(res.status, 404);
  });
});

describe('authentication and authorization', () => {
  test('every demo role receives a token with the right role', async () => {
    const expected = {
      admin: 'admin@luxurystay.com',
      manager: 'manager@luxurystay.com',
      receptionist: 'reception@luxurystay.com',
      housekeeping: 'housekeeping@luxurystay.com',
      guest: 'guest@luxurystay.com',
    };

    for (const [role, email] of Object.entries(expected)) {
      const me = await request(app).get('/api/auth/me').set(auth(role));
      assert.equal(me.status, 200, role);
      assert.equal(me.body.user.email, email);
      assert.equal(me.body.user.role, role);
    }
  });

  test('invalid credentials are rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@luxurystay.com', password: 'wrong-password' });

    assert.equal(res.status, 401);
    assert.match(res.body.message, /incorrect/i);
  });

  test('protected routes require a bearer token', async () => {
    const res = await request(app).get('/api/bookings');
    assert.equal(res.status, 401);
  });

  test('role permissions are enforced', async () => {
    const guest = await request(app).get('/api/bookings').set(auth('guest'));
    assert.equal(guest.status, 403);

    const housekeeperCreatingRoom = await request(app)
      .post('/api/rooms')
      .set(auth('housekeeping'))
      .send({ number: '909', floor: 9, type: ids.roomType });

    assert.equal(housekeeperCreatingRoom.status, 403);
  });

  test('unknown API routes return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.match(res.body.message, /route not found/i);
  });
});

describe('rooms', () => {
  test('staff can list rooms with type details', async () => {
    const res = await request(app).get('/api/rooms').set(auth('receptionist'));
    assert.equal(res.status, 200);
    assert.ok(res.body.rooms.length >= 20);

    const room = res.body.rooms[0];
    assert.ok(room.number);
    assert.ok(room.type?.name);
    ids.roomType = room.type._id;
  });

  test('admin can create, update and remove a room', async () => {
    const number = `T${String(Date.now()).slice(-4)}`;

    const created = await request(app)
      .post('/api/rooms')
      .set(auth('admin'))
      .send({ number, floor: 9, type: ids.roomType, view: 'Test view' });

    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.room.number, number);
    ids.tempRoom = created.body.room._id;

    const duplicate = await request(app)
      .post('/api/rooms')
      .set(auth('admin'))
      .send({ number, floor: 9, type: ids.roomType });
    assert.equal(duplicate.status, 409);

    const updated = await request(app)
      .patch(`/api/rooms/${ids.tempRoom}`)
      .set(auth('manager'))
      .send({ view: 'Courtyard view', rate: 199 });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.room.view, 'Courtyard view');
    assert.equal(updated.body.room.rate, 199);

    const status = await request(app)
      .patch(`/api/rooms/${ids.tempRoom}/status`)
      .set(auth('receptionist'))
      .send({ status: 'cleaning', note: 'Deep clean requested' });

    assert.equal(status.status, 200);
    assert.equal(status.body.room.status, 'cleaning');

    const removed = await request(app)
      .delete(`/api/rooms/${ids.tempRoom}`)
      .set(auth('admin'));
    assert.equal(removed.status, 200);
  });

  test('staff cannot free a room that has an in-house guest', async () => {
    const rooms = await request(app).get('/api/rooms').set(auth('receptionist'));
    const occupied = rooms.body.rooms.find((room) => room.status === 'occupied');
    assert.ok(occupied, 'seed data should include an occupied room');

    const res = await request(app)
      .patch(`/api/rooms/${occupied._id}/status`)
      .set(auth('receptionist'))
      .send({ status: 'available' });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /in-house guest/i);
  });
});

describe('guests', () => {
  test('reception can register a new guest profile', async () => {
    const res = await request(app)
      .post('/api/guests')
      .set(auth('receptionist'))
      .send({
        firstName: 'Nadia',
        lastName: 'Hassan',
        email: `nadia.${Date.now()}@example.com`,
        phone: '+1 415 555 0777',
        nationality: 'Canada',
        preferences: ['High floor'],
        vip: true,
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.guest.fullName, 'Nadia Hassan');
    assert.equal(res.body.guest.vip, true);
    ids.testGuest = res.body.guest._id;
  });

  test('guest records can be read and updated', async () => {
    const read = await request(app)
      .get(`/api/guests/${ids.testGuest}`)
      .set(auth('receptionist'));
    assert.equal(read.status, 200);
    assert.equal(read.body.guest.firstName, 'Nadia');

    const updated = await request(app)
      .patch(`/api/guests/${ids.testGuest}`)
      .set(auth('receptionist'))
      .send({ notes: 'Prefers a quiet room.', preferences: ['High floor', 'Late check-out'] });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.guest.notes, 'Prefers a quiet room.');
    assert.deepEqual(updated.body.guest.preferences, ['High floor', 'Late check-out']);
  });

  test('housekeeping cannot read the guest directory', async () => {
    const res = await request(app).get('/api/guests').set(auth('housekeeping'));
    assert.equal(res.status, 403);
  });
});

describe('reservation lifecycle', () => {
  test('front desk can create a reservation for an available room', async () => {
    const availability = await request(app)
      .get('/api/bookings/availability')
      .set(auth('receptionist'))
      .query({ checkIn: at(0, 14), checkOut: at(2, 11), guests: 1 });

    assert.equal(availability.status, 200, availability.text);
    const room = availability.body.availableRooms.find(
      (item) => item.status === 'available' && !item.openTasks
    );
    assert.ok(room, 'expected at least one clean, available room');

    ids.bookingRoom = room._id;

    const created = await request(app)
      .post('/api/bookings')
      .set(auth('receptionist'))
      .send({
        guest: ids.testGuest,
        room: room._id,
        checkIn: at(0, 14),
        checkOut: at(2, 11),
        adults: 1,
        source: 'staff',
        specialRequests: 'Test reservation.',
      });

    assert.equal(created.status, 201, created.text);
    assert.match(created.body.booking.reference, /^LUX-/);
    assert.equal(created.body.booking.status, 'confirmed');
    assert.equal(created.body.booking.nights, 2);
    ids.booking = created.body.booking._id;
  });

  test('double-booking the same room and dates is rejected', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(auth('receptionist'))
      .send({
        guest: ids.testGuest,
        room: ids.bookingRoom,
        checkIn: at(0, 14),
        checkOut: at(2, 11),
      });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already reserved/i);
  });

  test('guest can be checked in and the room becomes occupied', async () => {
    const res = await request(app)
      .post(`/api/bookings/${ids.booking}/check-in`)
      .set(auth('receptionist'))
      .send({});

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.booking.status, 'checked_in');
    assert.ok(res.body.booking.actualCheckIn);

    const rooms = await request(app).get('/api/rooms').set(auth('receptionist'));
    const room = rooms.body.rooms.find((item) => item._id === ids.bookingRoom);
    assert.equal(room.status, 'occupied');
  });

  test('check-out produces a folio and queues a departure clean', async () => {
    const res = await request(app)
      .post(`/api/bookings/${ids.booking}/check-out`)
      .set(auth('receptionist'))
      .send({});

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.booking.status, 'checked_out');
    assert.ok(res.body.invoice);
    assert.equal(res.body.invoice.status, 'unpaid');
    assert.ok(res.body.invoice.total > 0);
    ids.invoice = res.body.invoice._id;

    const tasks = await request(app)
      .get('/api/housekeeping')
      .set(auth('receptionist'))
      .query({ room: ids.bookingRoom });

    assert.equal(tasks.status, 200);
    const departure = tasks.body.tasks.find(
      (task) => task.notes?.includes(res.body.booking.reference) || task.status === 'pending'
    );
    assert.ok(departure, 'a departure clean should be created');
    ids.departureTask = departure._id;
  });

  test('checked-out reservations are locked against edits', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${ids.booking}`)
      .set(auth('manager'))
      .send({ adults: 2 });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /no longer be modified/i);
  });
});

describe('billing', () => {
  test('extra charges can be posted to an open folio', async () => {
    const res = await request(app)
      .post(`/api/invoices/${ids.invoice}/items`)
      .set(auth('receptionist'))
      .send({
        items: [
          { description: 'Minibar', category: 'minibar', quantity: 2, unitPrice: 12.5 },
        ],
      });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.invoice.lineItems.length, 2);
    assert.equal(res.body.invoice.lineItems[1].description, 'Minibar');
    assert.ok(res.body.invoice.total > 0);
  });

  test('partial and full payments update the invoice status', async () => {
    const partial = await request(app)
      .post(`/api/invoices/${ids.invoice}/pay`)
      .set(auth('receptionist'))
      .send({ amount: 10, method: 'cash' });

    assert.equal(partial.status, 200, partial.text);
    assert.equal(partial.body.invoice.status, 'partial');
    assert.equal(partial.body.invoice.amountPaid, 10);

    const balance = Math.round((partial.body.invoice.total - partial.body.invoice.amountPaid) * 100) / 100;
    const settled = await request(app)
      .post(`/api/invoices/${ids.invoice}/pay`)
      .set(auth('manager'))
      .send({ amount: balance, method: 'credit_card' });

    assert.equal(settled.status, 200, settled.text);
    assert.equal(settled.body.invoice.status, 'paid');
    assert.equal(settled.body.invoice.balance, 0);
    assert.ok(settled.body.invoice.paidAt);
  });

  test('overpaying an invoice is rejected', async () => {
    const res = await request(app)
      .post(`/api/invoices/${ids.invoice}/pay`)
      .set(auth('receptionist'))
      .send({ amount: 5 });

    assert.equal(res.status, 409);
  });

  test('invoice list includes summary totals', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set(auth('manager'))
      .query({ status: 'paid' });

    assert.equal(res.status, 200);
    assert.ok(res.body.invoices.length >= 1);
    assert.ok(res.body.summary.billed > 0);
    assert.ok(res.body.summary.collected > 0);
  });

  test('voiding a paid invoice is refused, while an unpaid one can be voided', async () => {
    const paid = await request(app)
      .post(`/api/invoices/${ids.invoice}/void`)
      .set(auth('manager'));
    assert.equal(paid.status, 409);

    const invoices = await request(app)
      .get('/api/invoices')
      .set(auth('manager'))
      .query({ status: 'unpaid' });

    const target = invoices.body.invoices.find(
      (invoice) =>
        invoice.amountPaid === 0 &&
        invoice.guest?.email !== 'guest@luxurystay.com'
    );
    assert.ok(target, 'seed data should include an unpaid invoice');

    const voided = await request(app)
      .post(`/api/invoices/${target._id}/void`)
      .set(auth('manager'));
    assert.equal(voided.status, 200);
    assert.equal(voided.body.invoice.status, 'void');
  });
});

describe('housekeeping and maintenance', () => {
  test('housekeeping queue exposes status counts', async () => {
    const res = await request(app).get('/api/housekeeping').set(auth('housekeeping'));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.tasks));
    assert.ok(res.body.counts.pending >= 1);
  });

  test('a task can be created, started and completed', async () => {
    const rooms = await request(app).get('/api/rooms').set(auth('housekeeping'));
    const room = rooms.body.rooms.find(
      (item) => item.status === 'available' && item.openTasks === 0
    );
    assert.ok(room);

    const created = await request(app)
      .post('/api/housekeeping')
      .set(auth('housekeeping'))
      .send({ room: room._id, type: 'inspection', priority: 'low', notes: 'API test task' });

    assert.equal(created.status, 201, created.text);
    ids.housekeepingTask = created.body.task._id;
    ids.housekeepingRoom = room._id;

    const started = await request(app)
      .patch(`/api/housekeeping/${ids.housekeepingTask}`)
      .set(auth('housekeeping'))
      .send({ status: 'in_progress' });
    assert.equal(started.status, 200);
    assert.equal(started.body.task.status, 'in_progress');

    const completed = await request(app)
      .patch(`/api/housekeeping/${ids.housekeepingTask}`)
      .set(auth('housekeeping'))
      .send({ status: 'completed' });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.task.status, 'completed');
    assert.ok(completed.body.task.completedAt);
  });

  test('a completed task is kept for the log', async () => {
    const res = await request(app)
      .delete(`/api/housekeeping/${ids.housekeepingTask}`)
      .set(auth('manager'));
    assert.equal(res.status, 409);
  });

  test('maintenance requests can be reported and resolved', async () => {
    const created = await request(app)
      .post('/api/maintenance')
      .set(auth('receptionist'))
      .send({
        room: ids.housekeepingRoom,
        issue: 'The desk lamp flickers intermittently.',
        category: 'electrical',
        priority: 'medium',
      });

    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.request.status, 'open');
    ids.maintenance = created.body.request._id;

    const resolved = await request(app)
      .patch(`/api/maintenance/${ids.maintenance}`)
      .set(auth('housekeeping'))
      .send({ status: 'resolved', resolutionNotes: 'Bulb replaced and tested.' });

    assert.equal(resolved.status, 200, resolved.text);
    assert.equal(resolved.body.request.status, 'resolved');
    assert.ok(resolved.body.request.resolvedAt);
  });

  test('maintenance list groups open work by priority', async () => {
    const res = await request(app)
      .get('/api/maintenance')
      .set(auth('housekeeping'))
      .query({ status: 'open' });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.requests));
    assert.equal(typeof res.body.openByPriority.urgent, 'number');
  });
});

describe('reports and settings', () => {
  test('overview reporting is available to front-of-house roles', async () => {
    const res = await request(app)
      .get('/api/reports/overview')
      .set(auth('receptionist'))
      .query({ days: 14 });

    assert.equal(res.status, 200);
    assert.ok(res.body.kpis.totalRooms > 0);
    assert.ok(Array.isArray(res.body.occupancyTrend));
  });

  test('deep reporting is restricted to managers and admins', async () => {
    const denied = await request(app)
      .get('/api/reports/revenue')
      .set(auth('receptionist'));
    assert.equal(denied.status, 403);

    const allowed = await request(app)
      .get('/api/reports/revenue')
      .set(auth('manager'));
    assert.equal(allowed.status, 200);
  });

  test('settings can be read by staff and changed only by admins', async () => {
    const read = await request(app).get('/api/settings').set(auth('housekeeping'));
    assert.equal(read.status, 200);
    assert.ok(read.body.settings.hotelName);
    assert.ok(Array.isArray(read.body.settings.serviceMenu));

    const denied = await request(app)
      .patch('/api/settings')
      .set(auth('manager'))
      .send({ tagline: 'Not allowed' });
    assert.equal(denied.status, 403);

    const updated = await request(app)
      .patch('/api/settings')
      .set(auth('admin'))
      .send({ tagline: 'Testing the LuxuryStay experience' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.settings.tagline, 'Testing the LuxuryStay experience');

    await request(app)
      .patch('/api/settings')
      .set(auth('admin'))
      .send({ tagline: read.body.settings.tagline });
  });
});

describe('guest portal', () => {
  test('guest sees their stay, bookings and folios', async () => {
    const stay = await request(app).get('/api/portal/stay').set(auth('guest'));
    assert.equal(stay.status, 200, stay.text);
    assert.ok(stay.body.currentBooking, 'demo guest should be in-house');
    assert.ok(Array.isArray(stay.body.serviceMenu));

    const bookings = await request(app).get('/api/portal/bookings').set(auth('guest'));
    assert.equal(bookings.status, 200);
    assert.ok(bookings.body.bookings.length >= 2);

    const invoices = await request(app).get('/api/portal/invoices').set(auth('guest'));
    assert.equal(invoices.status, 200);
    assert.ok(invoices.body.invoices.length >= 1);

    ids.guestFeedbackCandidates = bookings.body.bookings
      .filter((booking) => booking.status === 'checked_out')
      .map((booking) => booking._id);
    ids.guestFeedbackGiven = new Set(
      stay.body.feedback.map((item) => String(item.booking))
    );
  });

  test('guest can update their own profile', async () => {
    const res = await request(app)
      .patch('/api/portal/profile')
      .set(auth('guest'))
      .send({ preferences: ['High floor', 'Feather-free pillows', 'Sparkling water'] });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile.preferences.includes('High floor'));
  });

  test('guest can request services during an active stay', async () => {
    const res = await request(app)
      .post('/api/portal/services')
      .set(auth('guest'))
      .send({ type: 'room_service', quantity: 1, description: 'Club sandwich' });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.service.status, 'pending');
    assert.ok(res.body.service.amount >= 0);
  });

  test('guest can report a maintenance issue', async () => {
    const res = await request(app)
      .post('/api/portal/maintenance')
      .set(auth('guest'))
      .send({ issue: 'The shower drains slowly.', category: 'plumbing', priority: 'medium' });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.request.reportedByType, 'guest');
  });

  test('guest can leave one review per completed stay', async () => {
    const booking = ids.guestFeedbackCandidates.find(
      (id) => !ids.guestFeedbackGiven.has(String(id))
    );
    assert.ok(booking, 'demo guest should have an unreviewed completed stay');

    const created = await request(app)
      .post('/api/portal/feedback')
      .set(auth('guest'))
      .send({
        bookingId: booking,
        ratings: { overall: 5, cleanliness: 5, service: 5, comfort: 5, value: 5 },
        title: 'Wonderful from start to finish',
        comments: 'The team made our anniversary truly special.',
      });

    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.feedback.ratings.overall, 5);

    const duplicate = await request(app)
      .post('/api/portal/feedback')
      .set(auth('guest'))
      .send({ bookingId: booking, ratings: { overall: 4 } });
    assert.equal(duplicate.status, 409);
  });

  test('guest can settle an open folio online', async () => {
    const invoices = await request(app).get('/api/portal/invoices').set(auth('guest'));
    const open = invoices.body.invoices.find(
      (invoice) => ['unpaid', 'partial'].includes(invoice.status)
    );
    assert.ok(open, 'demo guest should have an open folio');

    const res = await request(app)
      .post(`/api/portal/invoices/${open._id}/pay`)
      .set(auth('guest'))
      .send({});

    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.invoice.status, 'paid');
    assert.equal(res.body.invoice.paymentMethod, 'online');
  });

  test('staff accounts cannot use guest portal endpoints', async () => {
    const res = await request(app).get('/api/portal/stay').set(auth('receptionist'));
    assert.equal(res.status, 403);
  });
});

describe('team and feedback views', () => {
  test('admins can list the team without password hashes', async () => {
    const res = await request(app).get('/api/users').set(auth('admin'));
    assert.equal(res.status, 200);
    assert.ok(res.body.users.length >= 5);
    assert.ok(res.body.users.every((user) => user.password === undefined));
  });

  test('managers can read the feedback inbox', async () => {
    const res = await request(app)
      .get('/api/feedback')
      .set(auth('manager'))
      .query({ limit: 5 });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.feedback));
  });

  test('notifications are scoped to the signed-in role', async () => {
    const admin = await request(app).get('/api/notifications').set(auth('admin'));
    assert.equal(admin.status, 200);
    assert.ok(admin.body.notifications.length >= 1);

    const guest = await request(app).get('/api/notifications').set(auth('guest'));
    assert.ok([200, 403].includes(guest.status));
  });

  test('opening the bell clears the badge but keeps per-item unread dots', async () => {
    const before = await request(app).get('/api/notifications').set(auth('receptionist'));
    assert.equal(before.status, 200);
    assert.ok(before.body.unseen >= 1);

    const seen = await request(app)
      .patch('/api/notifications/seen-all')
      .set(auth('receptionist'));
    assert.equal(seen.status, 200);

    const after = await request(app).get('/api/notifications').set(auth('receptionist'));
    assert.equal(after.body.unseen, 0);
    assert.ok(after.body.unread >= 1);
    assert.ok(after.body.notifications.some((item) => item.isRead === false));
  });
});
