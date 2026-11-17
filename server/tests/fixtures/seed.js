import { User } from '../../src/models/User.js';
import { Guest } from '../../src/models/Guest.js';
import { RoomType } from '../../src/models/RoomType.js';
import { Room } from '../../src/models/Room.js';
import { Booking } from '../../src/models/Booking.js';
import { Invoice } from '../../src/models/Invoice.js';
import { ServiceRequest } from '../../src/models/ServiceRequest.js';
import { HousekeepingTask } from '../../src/models/HousekeepingTask.js';
import { MaintenanceRequest } from '../../src/models/MaintenanceRequest.js';
import { Feedback } from '../../src/models/Feedback.js';
import { Notification } from '../../src/models/Notification.js';
import { Setting } from '../../src/models/Setting.js';
import { addDays, addMonths, startOfDay } from '../../src/utils/dates.js';
import { roomPlan, roomTypeSeed } from '../../src/data/roomInventory.js';

const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rand = seededRandom(20261029);
const pick = (list) => list[Math.floor(rand() * list.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (probability) => rand() < probability;
const round = (value) => Math.round(value * 100) / 100;

const guestSeed = [
  { firstName: 'Eleanor', lastName: 'Bennett', email: 'guest@luxurystay.com', phone: '+1 415 555 0117', nationality: 'United Kingdom', vip: true, preferences: ['High floor', 'Feather-free pillows', 'Sparkling water'], idType: 'passport', idNumber: 'GB-448210', address: { street: '18 Primrose Hill', city: 'London', state: '', postalCode: 'NW1 8XL', country: 'United Kingdom' } },
  { firstName: 'Marcus', lastName: 'Reed', email: 'marcus.reed@example.com', phone: '+1 212 555 0198', nationality: 'United States', preferences: ['Late check-out', 'Daily newspaper'], vip: true },
  { firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@example.com', phone: '+91 22 5550 1876', nationality: 'India', preferences: ['Vegetarian dining', 'Extra towels'] },
  { firstName: 'Julien', lastName: 'Laurent', email: 'julien.laurent@example.com', phone: '+33 1 5555 0142', nationality: 'France', preferences: ['Espresso pods', 'Quiet room'] },
  { firstName: 'Aiko', lastName: 'Tanaka', email: 'aiko.tanaka@example.com', phone: '+81 3 5555 0164', nationality: 'Japan', preferences: ['Green tea', 'Firm mattress'] },
  { firstName: 'Carlos', lastName: 'Mendes', email: 'carlos.mendes@example.com', phone: '+351 21 555 0155', nationality: 'Portugal', preferences: ['Ocean view', 'Late dinner'] },
  { firstName: 'Hannah', lastName: 'Fischer', email: 'hannah.fischer@example.com', phone: '+49 30 5555 0177', nationality: 'Germany', preferences: ['Hypoallergenic bedding'] },
  { firstName: 'Omar', lastName: 'Haddad', email: 'omar.haddad@example.com', phone: '+971 4 555 0138', nationality: 'United Arab Emirates', vip: true, preferences: ['Prayer mat', 'Fruit platter'] },
  { firstName: 'Grace', lastName: 'Kim', email: 'grace.kim@example.com', phone: '+82 2 555 0191', nationality: 'South Korea', preferences: ['High floor', 'Yoga mat'] },
  { firstName: 'Thomas', lastName: 'Wright', email: 'thomas.wright@example.com', phone: '+44 20 5555 0126', nationality: 'United Kingdom', preferences: ['Classic room', 'Afternoon tea'] },
  { firstName: 'Isabella', lastName: 'Rossi', email: 'isabella.rossi@example.com', phone: '+39 06 5555 0189', nationality: 'Italy', vip: true, preferences: ['Champagne on arrival', 'Butler service', 'Spa booking'] },
  { firstName: 'David', lastName: 'Osei', email: 'david.osei@example.com', phone: '+233 30 555 0144', nationality: 'Ghana', preferences: ['Airport transfer', 'Early breakfast'] },
  { firstName: 'Mei', lastName: 'Lin', email: 'mei.lin@example.com', phone: '+86 21 5555 0132', nationality: 'China', preferences: ['Tea service', 'Non-smoking'] },
  { firstName: 'Noah', lastName: 'Williams', email: 'noah.williams@example.com', phone: '+61 2 5555 0170', nationality: 'Australia', preferences: ['Surfboard storage'] },
  { firstName: 'Fatima', lastName: 'Al-Sayed', email: 'fatima.alsayed@example.com', phone: '+20 2 5555 0183', nationality: 'Egypt', preferences: ['High floor', 'Extra hangers'] },
  { firstName: 'Lucas', lastName: 'Moreau', email: 'lucas.moreau@example.com', phone: '+33 4 5555 0119', nationality: 'France', preferences: ['Family activities', 'Crib'] },
  { firstName: 'Emma', lastName: 'Johansson', email: 'emma.johansson@example.com', phone: '+46 8 555 0166', nationality: 'Sweden', preferences: ['Sauna access', 'Oat milk'] },
  { firstName: 'Ravi', lastName: 'Patel', email: 'ravi.patel@example.com', phone: '+91 79 5550 0128', nationality: 'India', preferences: ['Jain breakfast', 'Quiet floor'] },
  { firstName: 'Sofia', lastName: 'Petrova', email: 'sofia.petrova@example.com', phone: '+7 495 555 0150', nationality: 'Bulgaria', preferences: ['Late check-out'] },
  { firstName: 'Daniel', lastName: 'Kim', email: 'daniel.kim@example.com', phone: '+1 310 555 0174', nationality: 'United States', preferences: ['Gym access', 'Protein breakfast'] },
];

const feedbackComments = [
  'An exceptional stay from start to finish. The team remembered our names and every small detail.',
  'Beautiful room, impeccable housekeeping and the most comfortable bed I have slept in for years.',
  'The ocean view at sunrise was worth the trip alone. Breakfast was superb.',
  'Warm, thoughtful service. The front desk handled our last-minute changes with real grace.',
  'A lovely escape. The spa treatment was a highlight and the turndown service a nice touch.',
  'Stylish, calm and incredibly well located. We will absolutely return.',
  'The suite was spacious and quiet. A little slow at check-in, but the team recovered beautifully.',
  'Dinner on the terrace was magical. Service throughout was attentive without being intrusive.',
  'Excellent family facilities and genuinely kind staff. The children did not want to leave.',
  'A polished city hotel with a real sense of place. The concierge recommendations were perfect.',
];

const serviceTypes = [
  { type: 'room_service', label: 'In-room dining', price: 45 },
  { type: 'laundry', label: 'Laundry & pressing', price: 25 },
  { type: 'wake_up_call', label: 'Wake-up call', price: 0 },
  { type: 'transportation', label: 'Airport transfer', price: 75 },
  { type: 'spa', label: 'Spa treatment', price: 120 },
  { type: 'luggage', label: 'Luggage assistance', price: 0 },
  { type: 'extra_bed', label: 'Extra bed', price: 35 },
];

const clearAll = async () => {
  await Promise.all([
    User.deleteMany({}),
    Guest.deleteMany({}),
    RoomType.deleteMany({}),
    Room.deleteMany({}),
    Booking.deleteMany({}),
    Invoice.deleteMany({}),
    ServiceRequest.deleteMany({}),
    HousekeepingTask.deleteMany({}),
    MaintenanceRequest.deleteMany({}),
    Feedback.deleteMany({}),
    Notification.deleteMany({}),
    Setting.deleteMany({}),
  ]);
};

export const seedDatabase = async ({ silent = false } = {}) => {
  await clearAll();

  const settings = await Setting.create({ key: 'global' });

  const typeDocs = {};
  for (const type of roomTypeSeed) {
    typeDocs[type.name] = await RoomType.create(type);
  }

  const rooms = {};
  for (const plan of roomPlan) {
    const type = typeDocs[plan.type];
    rooms[plan.number] = await Room.create({
      number: plan.number,
      floor: plan.floor,
      type: type._id,
      rate: type.baseRate,
      view: plan.view,
      status: 'available',
    });
  }

  const admin = await User.create({
    name: 'Amara Okafor',
    email: 'admin@luxurystay.com',
    password: 'Admin@123',
    role: 'admin',
    phone: '+1 415 555 0100',
    jobTitle: 'General Manager',
  });
  const manager = await User.create({
    name: 'Daniel Whitmore',
    email: 'manager@luxurystay.com',
    password: 'Manager@123',
    role: 'manager',
    phone: '+1 415 555 0101',
    jobTitle: 'Director of Operations',
  });
  const receptionist = await User.create({
    name: 'Sofia Ramirez',
    email: 'reception@luxurystay.com',
    password: 'Reception@123',
    role: 'receptionist',
    phone: '+1 415 555 0102',
    jobTitle: 'Front Desk Supervisor',
  });
  const receptionist2 = await User.create({
    name: 'James Chen',
    email: 'james@luxurystay.com',
    password: 'Reception@123',
    role: 'receptionist',
    phone: '+1 415 555 0103',
    jobTitle: 'Guest Relations',
  });
  const housekeeper = await User.create({
    name: 'Maria Santos',
    email: 'housekeeping@luxurystay.com',
    password: 'Housekeeping@123',
    role: 'housekeeping',
    phone: '+1 415 555 0104',
    jobTitle: 'Housekeeping Supervisor',
  });
  const housekeeper2 = await User.create({
    name: "Liam O'Connor",
    email: 'liam@luxurystay.com',
    password: 'Housekeeping@123',
    role: 'housekeeping',
    phone: '+1 415 555 0105',
    jobTitle: 'Housekeeping Attendant',
  });

  const guests = [];
  for (const data of guestSeed) {
    guests.push(await Guest.create({ ...data, marketingConsent: chance(0.6) }));
  }
  const eleanor = guests[0];
  const guestUser = await User.create({
    name: 'Eleanor Bennett',
    email: 'guest@luxurystay.com',
    password: 'Guest@123',
    role: 'guest',
    phone: eleanor.phone,
    guestProfile: eleanor._id,
  });

  const today = startOfDay(new Date());
  const schedule = new Map();
  const isFree = (roomId, from, to) => {
    const slots = schedule.get(String(roomId)) || [];
    return slots.every((slot) => to <= slot.from || from >= slot.to);
  };
  const reserve = (roomId, from, to) => {
    const key = String(roomId);
    if (!schedule.has(key)) schedule.set(key, []);
    schedule.get(key).push({ from: startOfDay(from), to: startOfDay(to) });
  };

  let bookingCounter = 1001;
  let invoiceCounter = 5001;

  const createStay = async ({
    room,
    guest,
    checkIn,
    checkOut,
    status = 'confirmed',
    source = 'staff',
    adults = 1,
    children = 0,
    createdBy = receptionist,
    specialRequests = '',
    force = false,
  }) => {
    if (!force && !isFree(room._id, checkIn, checkOut)) return null;
    const booking = await Booking.create({
      reference: `LUX-${bookingCounter++}`,
      guest: guest._id,
      room: room._id,
      roomType: room.type,
      checkIn,
      checkOut,
      adults,
      children,
      status,
      source,
      specialRequests,
      ratePerNight: room.rate,
      nights: 1,
      roomTotal: room.rate,
      taxRate: settings.taxRate,
      taxAmount: 0,
      totalAmount: room.rate,
      createdBy: createdBy._id,
      actualCheckIn: ['checked_in', 'checked_out'].includes(status)
        ? new Date(new Date(checkIn).setHours(15, 10, 0, 0))
        : undefined,
      actualCheckOut:
        status === 'checked_out'
          ? new Date(new Date(checkOut).setHours(10, 45, 0, 0))
          : undefined,
    });
    reserve(room._id, checkIn, checkOut);
    return booking;
  };

  const createFolio = async ({
    booking,
    guest,
    paidPart = 1,
    service = null,
    issuedAt = new Date(),
    method = 'credit_card',
  }) => {
    const lineItems = [
      {
        description: `Accommodation — ${booking.nights} night${booking.nights > 1 ? 's' : ''}`,
        category: 'room',
        quantity: booking.nights,
        unitPrice: booking.ratePerNight,
      },
    ];
    if (service) {
      lineItems.push({
        description: service.label,
        category: 'service',
        quantity: 1,
        unitPrice: service.price,
      });
    }
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = round(subtotal * (settings.taxRate / 100));
    const total = round(subtotal + taxAmount);
    const amountPaid =
      paidPart >= 1 ? total : paidPart > 0 ? round(total * paidPart) : 0;

    const invoice = await Invoice.create({
      number: `INV-${invoiceCounter++}`,
      booking: booking._id,
      guest: guest._id,
      lineItems,
      subtotal,
      taxRate: settings.taxRate,
      taxAmount,
      total,
      amountPaid,
      paymentMethod: method,
      issuedAt,
      dueAt: issuedAt,
      paidAt: amountPaid >= total ? addDays(issuedAt, randInt(0, 1)) : undefined,
      issuedBy: receptionist._id,
      notes: `Folio for reservation ${booking.reference}`,
    });
    booking.invoice = invoice._id;
    if (booking.status === 'checked_out') await booking.save();
    return invoice;
  };

  // A past stay for the demo guest, left without feedback so the guest portal can submit it.
  const eleanorPast = await createStay({
    room: rooms['005'],
    guest: eleanor,
    checkIn: addDays(today, -12),
    checkOut: addDays(today, -9),
    status: 'checked_out',
    source: 'online',
    adults: 2,
    specialRequests: 'Celebrating an anniversary. High floor preferred.',
  });
  const eleanorInvoice = await createFolio({
    booking: eleanorPast,
    guest: eleanor,
    paidPart: 0,
    service: { label: 'Spa treatment — 60 minutes', price: 120 },
    issuedAt: addDays(today, -9),
    method: 'online',
  });

  // Current in-house guests
  const currentStays = [
    { room: '011', guest: guests[1], checkIn: -2, checkOut: 2, adults: 1, source: 'corporate' },
    { room: '021', guest: eleanor, checkIn: -2, checkOut: 3, adults: 2, source: 'online', requests: 'Quiet room away from the elevator. Sparkling water in the minibar.' },
    { room: '031', guest: guests[2], checkIn: -1, checkOut: 3, adults: 2, children: 2, source: 'online', requests: 'One crib and a high chair for breakfast.' },
    { room: '004', guest: guests[7], checkIn: -3, checkOut: 1, adults: 1, source: 'phone' },
    { room: '041', guest: guests[10], checkIn: -4, checkOut: 2, adults: 2, source: 'corporate', requests: 'Champagne and seasonal fruit on arrival. Spa booking for two.' },
    { room: '018', guest: guests[8], checkIn: -1, checkOut: 2, adults: 1, source: 'online' },
  ];
  const inHouse = [];
  for (const stay of currentStays) {
    const booking = await createStay({
      room: rooms[stay.room],
      guest: stay.guest,
      checkIn: addDays(today, stay.checkIn),
      checkOut: addDays(today, stay.checkOut),
      status: 'checked_in',
      source: stay.source,
      adults: stay.adults || 1,
      children: stay.children || 0,
      specialRequests: stay.requests || '',
    });
    if (booking) inHouse.push(booking);
  }

  // Departures due today
  const departures = [];
  for (const stay of [
    { room: '002', guest: guests[17], from: -3, adults: 1 },
    { room: '022', guest: guests[4], from: -2, adults: 2 },
  ]) {
    const booking = await createStay({
      room: rooms[stay.room],
      guest: stay.guest,
      checkIn: addDays(today, stay.from),
      checkOut: today,
      status: 'checked_in',
      source: 'staff',
      adults: stay.adults,
    });
    if (booking) departures.push(booking);
  }

  // Arrivals due today
  const arrivals = [];
  for (const stay of [
    { room: '005', guest: guests[11], adults: 1, nights: 3, source: 'online' },
    { room: '013', guest: guests[12], adults: 2, nights: 2, source: 'online' },
    { room: '032', guest: guests[15], adults: 2, children: 1, nights: 4, source: 'phone' },
  ]) {
    const booking = await createStay({
      room: rooms[stay.room],
      guest: stay.guest,
      checkIn: today,
      checkOut: addDays(today, stay.nights),
      status: 'confirmed',
      source: stay.source,
      adults: stay.adults,
      children: stay.children || 0,
    });
    if (booking) arrivals.push(booking);
  }

  // Upcoming reservations
  const upcomingSpecs = [
    { room: '006', guest: guests[13], from: 2, nights: 3, source: 'online' },
    { room: '014', guest: guests[5], from: 3, nights: 3, source: 'phone' },
    { room: '023', guest: guests[9], from: 5, nights: 2, source: 'corporate' },
    { room: '033', guest: guests[16], from: 8, nights: 3, source: 'online', children: 2 },
    { room: '007', guest: guests[18], from: 10, nights: 2, source: 'online' },
    { room: '015', guest: guests[14], from: 4, nights: 5, source: 'staff' },
    { room: '024', guest: guests[3], from: 6, nights: 2, source: 'online', status: 'pending' },
    { room: '042', guest: guests[6], from: 12, nights: 2, source: 'online' },
  ];
  for (const spec of upcomingSpecs) {
    if (!rooms[spec.room]) continue;
    await createStay({
      room: rooms[spec.room],
      guest: spec.guest,
      checkIn: addDays(today, spec.from),
      checkOut: addDays(today, spec.from + spec.nights),
      status: spec.status || 'confirmed',
      source: spec.source,
      adults: 2,
      children: spec.children || 0,
      specialRequests: chance(0.4) ? 'High floor if available. Thank you.' : '',
    });
  }

  // Historical stays used for reporting and invoices
  const checkedOut = [];
  for (const room of Object.values(rooms)) {
    let checkout = addDays(today, -randInt(2, 4));
    for (let index = 0; index < 5; index += 1) {
      const nights = randInt(1, 4);
      const checkIn = addDays(checkout, -nights);
      if (checkIn < addDays(today, -88)) break;
      if (isFree(room._id, checkIn, checkout)) {
        const cancelled = chance(0.04);
        const noShow = !cancelled && chance(0.03);
        const guest = pick(guests);
        const booking = await createStay({
          room,
          guest,
          checkIn,
          checkOut: checkout,
          status: cancelled ? 'cancelled' : noShow ? 'no_show' : 'checked_out',
          source: pick(['online', 'online', 'phone', 'walk_in', 'staff', 'corporate']),
          adults: randInt(1, 2),
          children: chance(0.2) ? randInt(1, 2) : 0,
          specialRequests: chance(0.2) ? pick(['Late arrival', 'Extra pillows', 'Quiet floor', 'Early breakfast']) : '',
        });
        if (booking?.status === 'checked_out') checkedOut.push({ booking, guest });
      }
      checkout = addDays(checkIn, -randInt(2, 7));
    }
  }

  const paidInvoices = [];
  for (const { booking, guest } of checkedOut) {
    const paidPart = chance(0.76) ? 1 : chance(0.45) ? 0.4 : 0;
    const service = chance(0.35) ? pick(serviceTypes.filter((item) => item.price > 0)) : null;
    const invoice = await createFolio({
      booking,
      guest,
      paidPart,
      service,
      issuedAt: addDays(booking.checkOut, 0),
      method: pick(['credit_card', 'credit_card', 'credit_card', 'debit_card', 'cash', 'bank_transfer']),
    });
    if (invoice.status === 'paid') paidInvoices.push(invoice);
  }

  // Older history so the six-month revenue chart has depth
  const legacyBookings = [];
  for (const room of Object.values(rooms)) {
    for (const monthsAgo of [3, 4, 5]) {
      const anchor = addMonths(today, -monthsAgo);
      anchor.setDate(randInt(3, 18));
      const checkIn = startOfDay(anchor);
      const checkOut = addDays(checkIn, randInt(2, 4));
      if (!isFree(room._id, checkIn, checkOut)) continue;
      const guest = pick(guests);
      const booking = await createStay({
        room,
        guest,
        checkIn,
        checkOut,
        status: 'checked_out',
        source: pick(['online', 'phone', 'corporate', 'staff']),
        adults: randInt(1, 2),
      });
      if (booking) legacyBookings.push({ booking, guest });
    }
  }

  for (const { booking, guest } of legacyBookings) {
    const invoice = await createFolio({
      booking,
      guest,
      paidPart: chance(0.85) ? 1 : 0.35,
      service: chance(0.4) ? pick(serviceTypes.filter((item) => item.price > 0)) : null,
      issuedAt: addDays(booking.checkOut, 0),
      method: pick(['credit_card', 'debit_card', 'bank_transfer']),
    });
    if (invoice.status === 'paid') paidInvoices.push(invoice);
  }

  if (paidInvoices.length) {
    const todayInvoice = paidInvoices[paidInvoices.length - 1];
    todayInvoice.paidAt = new Date();
    await todayInvoice.save();
  }

  // Feedback for a portion of completed stays
  for (const { booking, guest } of checkedOut) {
    if (!chance(0.34)) continue;
    if (String(booking._id) === String(eleanorPast._id)) continue;
    const overall = chance(0.72) ? randInt(4, 5) : randInt(3, 4);
    await Feedback.create({
      guest: guest._id,
      booking: booking._id,
      ratings: {
        overall,
        cleanliness: Math.min(5, overall + (chance(0.3) ? 1 : 0)),
        service: Math.min(5, overall + (chance(0.25) ? 1 : 0)),
        comfort: Math.min(5, overall + (chance(0.2) ? 1 : 0)),
        value: Math.max(1, overall - (chance(0.3) ? 1 : 0)),
      },
      title: pick([
        'A memorable anniversary',
        'Beautifully considered stay',
        'Exceptional service',
        'The perfect city escape',
        'A lovely weekend',
        'Warm hospitality',
      ]),
      comments: pick(feedbackComments),
      isPublished: overall >= 4,
      response:
        overall >= 4 && chance(0.5)
          ? {
              text: 'Thank you for taking the time to share this. It was a pleasure hosting you, and we look forward to welcoming you back.',
              by: manager._id,
              at: addDays(booking.checkOut, randInt(1, 4)),
            }
          : undefined,
    });
  }

  // Service requests for in-house and departing guests
  const serviceStatuses = ['pending', 'in_progress', 'completed'];
  for (const booking of [...inHouse, ...departures]) {
    const count = randInt(1, 3);
    for (let index = 0; index < count; index += 1) {
      const menu = pick(serviceTypes);
      const status =
        booking.status === 'checked_in' && chance(0.45)
          ? pick(serviceStatuses)
          : pick(['completed', 'completed', 'pending']);
      await ServiceRequest.create({
        booking: booking._id,
        guest: booking.guest,
        room: booking.room,
        type: menu.type,
        description: menu.label,
        quantity: 1,
        amount: menu.price,
        status,
        scheduledFor: addDays(new Date(), randInt(0, 2)),
        assignedTo: chance(0.5) ? housekeeper._id : undefined,
        completedAt: status === 'completed' ? addDays(new Date(), -randInt(0, 2)) : undefined,
        createdBy: receptionist._id,
      });
    }
  }

  // Housekeeping queue
  const cleaningPlan = [
    { room: '002', type: 'cleaning', priority: 'high', status: 'pending', assignee: housekeeper, notes: 'Same-day departure clean. New guest due tomorrow.' },
    { room: '022', type: 'deep_clean', priority: 'high', status: 'pending', assignee: housekeeper2, notes: 'Departure clean with carpet refresh.' },
    { room: '016', type: 'cleaning', priority: 'medium', status: 'pending', assignee: housekeeper2, notes: 'Guest departed early. Full linen change requested.' },
    { room: '017', type: 'inspection', priority: 'low', status: 'in_progress', assignee: housekeeper, notes: 'Routine quality inspection.' },
    { room: '008', type: 'linen_change', priority: 'medium', status: 'completed', assignee: housekeeper2, notes: 'Linen refreshed after maintenance access.', completed: true },
    { room: '034', type: 'cleaning', priority: 'low', status: 'completed', assignee: housekeeper, notes: 'Turned down and restocked.', completed: true },
  ];
  for (const plan of cleaningPlan) {
    if (!rooms[plan.room]) continue;
    await HousekeepingTask.create({
      room: rooms[plan.room]._id,
      type: plan.type,
      priority: plan.priority,
      status: plan.status,
      assignedTo: plan.assignee._id,
      notes: plan.notes,
      scheduledFor: addDays(today, plan.status === 'completed' ? -1 : 0),
      completedAt: plan.completed ? addDays(today, -1) : undefined,
      createdBy: receptionist._id,
    });
  }

  // Maintenance requests
  await MaintenanceRequest.create({
    room: rooms['003']._id,
    issue: 'Bathroom faucet is leaking and the water pressure has dropped.',
    category: 'plumbing',
    priority: 'urgent',
    status: 'open',
    reportedByType: 'staff',
    reportedByName: 'Sofia Ramirez',
    reportedBy: receptionist._id,
    assignedTo: housekeeper2._id,
  });
  await MaintenanceRequest.create({
    room: rooms['008']._id,
    issue: 'Air-conditioning is making a rattling noise at high fan speed.',
    category: 'hvac',
    priority: 'high',
    status: 'in_progress',
    reportedByType: 'guest',
    reportedByName: 'Julien Laurent',
    reportedBy: receptionist2._id,
    assignedTo: housekeeper2._id,
  });
  await MaintenanceRequest.create({
    room: rooms['024']._id,
    issue: 'Balcony door latch replaced and tested.',
    category: 'furniture',
    priority: 'medium',
    status: 'resolved',
    reportedByType: 'staff',
    reportedByName: 'James Chen',
    reportedBy: receptionist2._id,
    assignedTo: housekeeper._id,
    resolutionNotes: 'Latch replaced by engineering. Door closes and locks correctly.',
    resolvedAt: addDays(today, -3),
  });

  // Set final room statuses
  await Room.updateMany({}, { status: 'available' });
  for (const booking of inHouse) {
    await Room.findByIdAndUpdate(booking.room, { status: 'occupied' });
  }
  for (const booking of departures) {
    await Room.findByIdAndUpdate(booking.room, { status: 'dirty' });
  }
  await Room.findByIdAndUpdate(rooms['016']._id, { status: 'dirty' });
  await Room.findByIdAndUpdate(rooms['017']._id, { status: 'cleaning' });
  await Room.findByIdAndUpdate(rooms['003']._id, { status: 'maintenance' });
  await Room.findByIdAndUpdate(rooms['008']._id, { status: 'maintenance' });

  // Notifications for the staff dashboard
  await Notification.create([
    {
      title: 'Online reservation request',
      message: 'Mei Lin requested the Deluxe Ocean View for 2 nights. Awaiting confirmation.',
      type: 'booking',
      audience: ['receptionist', 'manager', 'admin'],
      link: '/bookings',
      createdBy: receptionist._id,
    },
    {
      title: 'Urgent maintenance — Room 103',
      message: 'Leaking bathroom faucet reported. Room is out of service.',
      type: 'maintenance',
      audience: ['manager', 'admin', 'receptionist', 'housekeeping'],
      link: '/maintenance',
      createdBy: receptionist._id,
    },
    {
      title: 'VIP arrival today',
      message: 'Isabella Rossi is in the Presidential Suite. Champagne and spa booking confirmed.',
      type: 'checkin',
      audience: ['receptionist', 'manager', 'admin'],
      link: '/bookings',
      createdBy: manager._id,
    },
    {
      title: 'Room 302 departed',
      message: 'Departure clean required before the next arrival.',
      type: 'housekeeping',
      audience: ['housekeeping', 'receptionist'],
      link: '/housekeeping',
      createdBy: receptionist._id,
    },
    {
      title: 'Invoice outstanding',
      message: `Folio ${eleanorInvoice.number} remains unpaid after the guest's stay.`,
      type: 'billing',
      audience: ['receptionist', 'manager'],
      link: `/billing/${eleanorInvoice._id}`,
      createdBy: manager._id,
    },
  ]);

  // Touch logins so the team list feels alive
  await User.updateMany({ role: { $ne: 'guest' } }, { lastLogin: addDays(new Date(), -1) });
  await User.findByIdAndUpdate(admin._id, { lastLogin: new Date() });

  if (!silent) {
    const counts = await Promise.all([
      Guest.countDocuments(),
      Room.countDocuments(),
      Booking.countDocuments(),
      Invoice.countDocuments(),
      Feedback.countDocuments(),
    ]);
    console.log('');
    console.log('  Seed complete');
    console.log(`  ${counts[0]} guests · ${counts[1]} rooms · ${counts[2]} reservations · ${counts[3]} invoices · ${counts[4]} feedback entries`);
    console.log('');
    console.log('  Demo accounts');
    console.log('  ─────────────────────────────────────────────');
    console.log('  Administrator   admin@luxurystay.com      / Admin@123');
    console.log('  Manager         manager@luxurystay.com    / Manager@123');
    console.log('  Receptionist    reception@luxurystay.com  / Reception@123');
    console.log('  Housekeeping    housekeeping@luxurystay.com / Housekeeping@123');
    console.log('  Guest           guest@luxurystay.com      / Guest@123');
    console.log('');
  }

  return {
    users: { admin: admin.email, manager: manager.email, receptionist: receptionist.email, housekeeper: housekeeper.email, guest: guestUser.email },
    counts: { guests: guests.length, rooms: Object.keys(rooms).length },
  };
};

export const seedIfEmpty = async () => {
  const existing = await User.estimatedDocumentCount();
  if (existing > 0) return false;
  console.log('[seed] Empty database detected — creating demo data...');
  await seedDatabase();
  return true;
};
