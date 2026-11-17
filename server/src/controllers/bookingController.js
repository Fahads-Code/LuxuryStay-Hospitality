import { z } from 'zod';
import { Booking, BOOKING_STATUSES, BLOCKING_BOOKING_STATUSES } from '../models/Booking.js';
import { Guest } from '../models/Guest.js';
import { Room } from '../models/Room.js';
import { HousekeepingTask } from '../models/HousekeepingTask.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import {
  parse,
  objectId,
  paginationSchema,
} from '../utils/validation.js';
import { startOfDay, endOfDay, isoDay } from '../utils/dates.js';
import {
  assertRoomAvailable,
  calculateBookingCharges,
  generateReference,
  findAvailableRooms,
} from '../services/bookingService.js';
import { getSettings } from '../services/settingsService.js';
import { buildInvoiceForBooking } from '../services/invoiceService.js';
import { notify } from '../services/notificationService.js';

const POPULATE = [
  {
    path: 'guest',
    select: 'firstName lastName email phone nationality vip preferences',
  },
  {
    path: 'room',
    select: 'number floor view status type',
    populate: { path: 'type', select: 'name baseRate capacity amenities' },
  },
  { path: 'roomType', select: 'name baseRate' },
  { path: 'invoice', select: 'number total status amountPaid' },
];

const createSchema = z.object({
  guest: objectId,
  room: objectId,
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.coerce.number().int().min(1).max(12).default(1),
  children: z.coerce.number().int().min(0).max(12).default(0),
  source: z.enum(['online', 'walk_in', 'phone', 'staff', 'corporate']).optional(),
  status: z.enum(['pending', 'confirmed']).optional(),
  specialRequests: z.string().trim().max(1000).optional().or(z.literal('')),
  ratePerNight: z.coerce.number().min(0).optional(),
});

const updateSchema = z
  .object({
    guest: objectId,
    room: objectId,
    checkIn: z.string(),
    checkOut: z.string(),
    adults: z.coerce.number().int().min(1).max(12),
    children: z.coerce.number().int().min(0).max(12),
    source: z.enum(['online', 'walk_in', 'phone', 'staff', 'corporate']),
    status: z.enum(['pending', 'confirmed']),
    specialRequests: z.string().trim().max(1000),
    ratePerNight: z.coerce.number().min(0),
  })
  .partial();

const buildReference = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateReference();
    const exists = await Booking.exists({ reference });
    if (!exists) return reference;
  }
  return generateReference('STAY');
};

const validateStayDates = (checkIn, checkOut, { allowPast = false } = {}) => {
  const from = new Date(checkIn);
  const to = new Date(checkOut);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(422, 'Enter valid check-in and check-out dates.');
  }
  if (startOfDay(to) <= startOfDay(from)) {
    throw new ApiError(422, 'Check-out must be after check-in.');
  }
  if (!allowPast && startOfDay(from) < startOfDay(new Date())) {
    throw new ApiError(422, 'Check-in date cannot be in the past.');
  }
  return { from, to };
};

export const listBookings = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const { q, status, source, from, to, room, guest, today } = req.query;
  const filter = {};

  if (status) {
    const statuses = String(status).split(',').filter((s) => BOOKING_STATUSES.includes(s));
    if (statuses.length) filter.status = { $in: statuses };
  }
  if (source) filter.source = source;
  if (room) filter.room = room;
  if (guest) filter.guest = guest;
  if (from) filter.checkOut = { ...(filter.checkOut || {}), $gte: startOfDay(from) };
  if (to) filter.checkIn = { ...(filter.checkIn || {}), $lte: endOfDay(to) };
  if (today === 'true') {
    filter.checkIn = { $lte: endOfDay() };
    filter.checkOut = { $gt: startOfDay() };
    filter.status = { $in: ['checked_in', 'confirmed', 'pending'] };
  }

  if (q) {
    const guests = await Guest.find({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    }).select('_id');
    filter.$or = [
      { reference: { $regex: q, $options: 'i' } },
      { guest: { $in: guests.map((g) => g._id) } },
    ];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate(POPULATE)
      .sort({ checkIn: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  res.json({
    bookings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate(POPULATE);
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  const services = await ServiceRequest.find({ booking: booking._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ booking, services });
});

export const checkAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomType, guests = 1 } = req.query;
  if (!checkIn || !checkOut) throw new ApiError(400, 'Provide check-in and check-out dates.');
  const { from, to } = validateStayDates(checkIn, checkOut);

  const rooms = await findAvailableRooms({
    checkIn: from,
    checkOut: to,
    roomTypeId: roomType || undefined,
    guests: Number(guests) || 1,
  });

  res.json({
    checkIn: isoDay(from),
    checkOut: isoDay(to),
    availableRooms: rooms,
    count: rooms.length,
  });
});

export const getCalendar = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : startOfDay(new Date());
  const to = req.query.to ? new Date(req.query.to) : new Date(startOfDay(from).getTime() + 14 * 86400000);
  if (to <= from) throw new ApiError(400, 'Invalid calendar range.');

  const bookings = await Booking.find({
    status: { $in: BLOCKING_BOOKING_STATUSES },
    checkIn: { $lt: endOfDay(to) },
    checkOut: { $gt: startOfDay(from) },
  })
    .populate('guest', 'firstName lastName')
    .populate('room', 'number')
    .select('reference checkIn checkOut status guest room source')
    .sort({ checkIn: 1 })
    .lean();

  res.json({ from: isoDay(from), to: isoDay(to), bookings });
});

export const createBooking = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);
  const { from, to } = validateStayDates(data.checkIn, data.checkOut);

  const [guest, room, settings] = await Promise.all([
    Guest.findById(data.guest),
    Room.findById(data.room).populate('type'),
    getSettings(),
  ]);
  if (!guest) throw new ApiError(404, 'Guest not found.');
  if (!room || !room.isActive) throw new ApiError(404, 'Room not found.');
  if (room.type && data.adults + data.children > room.type.capacity) {
    throw new ApiError(
      422,
      `This room type allows a maximum of ${room.type.capacity} guests.`
    );
  }

  await assertRoomAvailable({ roomId: room._id, checkIn: from, checkOut: to });

  const ratePerNight = data.ratePerNight ?? room.rate;
  const charges = calculateBookingCharges({
    ratePerNight,
    checkIn: from,
    checkOut: to,
    taxRate: settings.taxRate,
  });

  const booking = await Booking.create({
    reference: await buildReference(),
    guest: guest._id,
    room: room._id,
    roomType: room.type?._id,
    checkIn: from,
    checkOut: to,
    adults: data.adults,
    children: data.children,
    status: data.status === 'pending' ? 'pending' : 'confirmed',
    source: data.source || 'staff',
    specialRequests: data.specialRequests,
    ratePerNight,
    nights: charges.nights,
    roomTotal: charges.roomTotal,
    taxRate: settings.taxRate,
    taxAmount: charges.taxAmount,
    totalAmount: charges.totalAmount,
    createdBy: req.user._id,
  });

  await notify({
    title: 'New reservation',
    message: `${guest.fullName} — Room ${room.number}, ${isoDay(from)} to ${isoDay(to)}.`,
    type: 'booking',
    link: `/bookings/${booking._id}`,
    createdBy: req.user._id,
  });

  await booking.populate(POPULATE);
  res.status(201).json({ booking });
});

export const updateBooking = asyncHandler(async (req, res) => {
  const data = parse(updateSchema, req.body);
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Reservation not found.');

  const lockedStatuses = ['checked_out', 'cancelled', 'no_show'];
  if (lockedStatuses.includes(booking.status) && Object.keys(data).some((key) => key !== 'specialRequests')) {
    throw new ApiError(409, 'This reservation can no longer be modified.');
  }

  const checkIn = data.checkIn ?? booking.checkIn;
  const checkOut = data.checkOut ?? booking.checkOut;
  const { from, to } = validateStayDates(checkIn, checkOut, {
    allowPast: booking.status === 'checked_in',
  });

  const roomChanged = data.room && String(data.room) !== String(booking.room);
  const datesChanged =
    startOfDay(from).getTime() !== startOfDay(booking.checkIn).getTime() ||
    startOfDay(to).getTime() !== startOfDay(booking.checkOut).getTime();

  if (roomChanged || datesChanged) {
    await assertRoomAvailable({
      roomId: data.room || booking.room,
      checkIn: from,
      checkOut: to,
      excludeBookingId: booking._id,
    });
  }

  let room = null;
  if (roomChanged) {
    room = await Room.findById(data.room).populate('type');
    if (!room || !room.isActive) throw new ApiError(404, 'Room not found.');
  } else if (datesChanged) {
    room = await Room.findById(booking.room).populate('type');
  }

  const adults = data.adults ?? booking.adults;
  const children = data.children ?? booking.children;
  if (room?.type && adults + children > room.type.capacity) {
    throw new ApiError(422, `This room type allows a maximum of ${room.type.capacity} guests.`);
  }

  if (booking.status === 'checked_in' && roomChanged) {
    const previousRoom = await Room.findById(booking.room);
    if (previousRoom) {
      previousRoom.status = 'dirty';
      await previousRoom.save();
      await HousekeepingTask.create({
        room: previousRoom._id,
        type: 'cleaning',
        priority: 'high',
        notes: `Room move — guest transferred to room ${room.number}.`,
        createdBy: req.user._id,
      });
    }
    room.status = 'occupied';
    await room.save();
    await notify({
      title: 'Room move',
      message: `${booking.reference} moved to room ${room.number}.`,
      type: 'checkin',
      link: `/bookings/${booking._id}`,
      createdBy: req.user._id,
    });
  }

  Object.assign(booking, data);
  booking.checkIn = from;
  booking.checkOut = to;
  if (room) {
    booking.room = room._id;
    booking.roomType = room.type?._id;
    if (roomChanged) booking.ratePerNight = room.rate;
  }
  if (data.ratePerNight != null) booking.ratePerNight = data.ratePerNight;

  await booking.save();
  await booking.populate(POPULATE);
  res.json({ booking });
});

export const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (booking.status !== 'pending') {
    throw new ApiError(409, 'Only pending reservations can be confirmed.');
  }
  booking.status = 'confirmed';
  await booking.save();

  await notify({
    title: 'Reservation confirmed',
    message: `${booking.reference} is now confirmed.`,
    type: 'booking',
    link: `/bookings/${booking._id}`,
    createdBy: req.user._id,
  });

  await booking.populate(POPULATE);
  res.json({ booking });
});

export const checkInBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('guest', 'firstName lastName');
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new ApiError(409, 'Only pending or confirmed reservations can be checked in.');
  }
  if (startOfDay(booking.checkIn) > endOfDay()) {
    throw new ApiError(409, `This guest is not due until ${isoDay(booking.checkIn)}.`);
  }

  const room = await Room.findById(booking.room);
  if (!room) throw new ApiError(404, 'Assigned room not found.');

  const otherStay = await Booking.findOne({
    room: room._id,
    status: 'checked_in',
    _id: { $ne: booking._id },
  });
  if (otherStay) throw new ApiError(409, 'Room is currently occupied by another guest.');

  if (['maintenance', 'out_of_order'].includes(room.status)) {
    throw new ApiError(409, 'Room is out of service. Assign a different room before check-in.');
  }
  if (['dirty', 'cleaning'].includes(room.status)) {
    throw new ApiError(409, 'Room is not ready. Complete housekeeping before check-in.');
  }

  booking.status = 'checked_in';
  booking.actualCheckIn = new Date();
  await booking.save();

  room.status = 'occupied';
  await room.save();

  await notify({
    title: 'Guest checked in',
    message: `${booking.guest?.firstName || 'Guest'} checked in to room ${room.number}.`,
    type: 'checkin',
    link: `/bookings/${booking._id}`,
    createdBy: req.user._id,
  });

  await booking.populate(POPULATE);
  res.json({ booking });
});

export const checkOutBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('room', 'number floor')
    .populate('guest', 'firstName lastName')
    .populate('invoice');
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (booking.status !== 'checked_in') {
    throw new ApiError(409, 'Only in-house guests can be checked out.');
  }

  const discount = Number(req.body?.discount || 0);
  if (discount < 0) throw new ApiError(422, 'Discount cannot be negative.');

  const invoice = await buildInvoiceForBooking(booking, { user: req.user, discount });

  booking.status = 'checked_out';
  booking.actualCheckOut = new Date();
  await booking.save();

  const room = await Room.findById(booking.room._id);
  if (room) {
    room.status = 'dirty';
    await room.save();
    await HousekeepingTask.create({
      room: room._id,
      type: 'cleaning',
      priority: 'high',
      notes: `Departure clean after reservation ${booking.reference}.`,
      createdBy: req.user._id,
    });
  }

  await notify({
    title: 'Guest checked out',
    message: `${booking.guest?.firstName || 'Guest'} checked out of room ${room?.number || ''}. Folio ${invoice.number} is ready.`,
    type: 'checkout',
    link: `/billing/${invoice._id}`,
    createdBy: req.user._id,
  });

  await booking.populate(POPULATE);
  res.json({ booking, invoice });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new ApiError(409, 'This reservation cannot be cancelled at its current stage.');
  }

  booking.status = 'cancelled';
  booking.cancellationReason = req.body?.reason || 'Cancelled by staff';
  await booking.save();

  await notify({
    title: 'Reservation cancelled',
    message: `${booking.reference} has been cancelled.`,
    type: 'booking',
    link: `/bookings/${booking._id}`,
    createdBy: req.user._id,
  });

  await booking.populate(POPULATE);
  res.json({ booking });
});

export const markNoShow = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (booking.status !== 'confirmed') {
    throw new ApiError(409, 'Only confirmed reservations can be marked as no-show.');
  }
  if (startOfDay(booking.checkIn) >= startOfDay()) {
    throw new ApiError(409, 'A no-show can only be recorded after the arrival date.');
  }
  booking.status = 'no_show';
  await booking.save();
  await booking.populate(POPULATE);
  res.json({ booking });
});
