import { z } from 'zod';
import { Guest } from '../models/Guest.js';
import { Booking } from '../models/Booking.js';
import { Invoice } from '../models/Invoice.js';
import { ServiceRequest, SERVICE_TYPES } from '../models/ServiceRequest.js';
import { Feedback } from '../models/Feedback.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, objectId, email } from '../utils/validation.js';
import { startOfDay, endOfDay } from '../utils/dates.js';
import { getSettings } from '../services/settingsService.js';
import { notify } from '../services/notificationService.js';

const loadGuest = async (req) => {
  const guest = await Guest.findById(req.user.guestProfile);
  if (!guest) throw new ApiError(404, 'No guest profile is linked to this account.');
  return guest;
};

const bookingPopulate = [
  {
    path: 'room',
    select: 'number floor view type',
    populate: { path: 'type', select: 'name capacity amenities' },
  },
  { path: 'invoice', select: 'number total status amountPaid' },
];

export const getMyProfile = asyncHandler(async (req, res) => {
  const guest = await loadGuest(req);
  res.json({
    profile: {
      ...guest.toObject({ virtuals: true }),
      fullName: guest.fullName,
      email: guest.email || req.user.email,
    },
  });
});

const profileSchema = z
  .object({
    phone: z.string().trim().max(30),
    preferences: z.array(z.string().trim().max(60)).max(20),
    address: z.object({
      street: z.string().trim().max(120).optional(),
      city: z.string().trim().max(80).optional(),
      state: z.string().trim().max(80).optional(),
      postalCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(80).optional(),
    }),
    marketingConsent: z.boolean(),
    nationality: z.string().trim().max(60),
  })
  .partial();

export const updateMyProfile = asyncHandler(async (req, res) => {
  const data = parse(profileSchema, req.body);
  const guest = await loadGuest(req);
  if (data.address) guest.address = { ...guest.address, ...data.address };
  delete data.address;
  Object.assign(guest, data);
  await guest.save();
  res.json({ profile: { ...guest.toObject({ virtuals: true }), fullName: guest.fullName } });
});

export const getMyBookings = asyncHandler(async (req, res) => {
  const guest = await loadGuest(req);
  const bookings = await Booking.find({ guest: guest._id })
    .populate(bookingPopulate)
    .sort({ checkIn: -1 });
  res.json({ bookings });
});

export const getMyStay = asyncHandler(async (req, res) => {
  const guest = await loadGuest(req);
  const now = new Date();
  const [current, upcoming, services, invoices, feedback, settings] = await Promise.all([
    Booking.findOne({
      guest: guest._id,
      status: 'checked_in',
      checkIn: { $lte: endOfDay(now) },
      checkOut: { $gt: startOfDay(now) },
    })
      .populate(bookingPopulate)
      .lean(),
    Booking.findOne({
      guest: guest._id,
      status: { $in: ['confirmed', 'pending'] },
      checkIn: { $gte: startOfDay(now) },
    })
      .populate(bookingPopulate)
      .sort({ checkIn: 1 })
      .lean(),
    ServiceRequest.find({ guest: guest._id })
      .populate('room', 'number')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Invoice.find({ guest: guest._id, status: { $ne: 'void' } })
      .sort({ issuedAt: -1 })
      .limit(10)
      .lean(),
    Feedback.find({ guest: guest._id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
  ]);

  res.json({
    currentBooking: current,
    upcomingBooking: current ? null : upcoming,
    services,
    invoices,
    feedback,
    serviceMenu: settings.serviceMenu,
    hotel: {
      name: settings.hotelName,
      checkInTime: settings.checkInTime,
      checkOutTime: settings.checkOutTime,
      phone: settings.phone,
      email: settings.email,
      currency: settings.currency,
    },
  });
});

const serviceSchema = z.object({
  bookingId: objectId.optional(),
  type: z.enum(SERVICE_TYPES),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  scheduledFor: z.string().optional().nullable(),
});

export const requestService = asyncHandler(async (req, res) => {
  const data = parse(serviceSchema, req.body);
  const guest = await loadGuest(req);

  let booking = null;
  if (data.bookingId) {
    booking = await Booking.findOne({ _id: data.bookingId, guest: guest._id });
  } else {
    booking = await Booking.findOne({
      guest: guest._id,
      status: 'checked_in',
    }).sort({ checkIn: -1 });
  }
  if (!booking) {
    throw new ApiError(409, 'A service can only be requested during an active stay.');
  }
  if (data.type === 'wake_up_call' && !data.scheduledFor) {
    throw new ApiError(422, 'Choose a time for your wake-up call.');
  }

  const settings = await getSettings();
  const menuItem = settings.serviceMenu.find((item) => item.type === data.type);

  const service = await ServiceRequest.create({
    booking: booking._id,
    guest: guest._id,
    room: booking.room,
    type: data.type,
    description: data.description || menuItem?.label || '',
    quantity: data.quantity,
    amount: (menuItem?.price || 0) * data.quantity,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
    createdBy: req.user._id,
  });

  await notify({
    title: 'Guest service request',
    message: `${guest.fullName} requested ${menuItem?.label || data.type.replaceAll('_', ' ')} for room service.`,
    type: 'housekeeping',
    audience: ['housekeeping', 'manager', 'admin'],
    link: '/services',
    createdBy: req.user._id,
  });

  res.status(201).json({ service });
});

const feedbackSchema = z.object({
  bookingId: objectId,
  ratings: z.object({
    overall: z.coerce.number().int().min(1).max(5),
    cleanliness: z.coerce.number().int().min(1).max(5).optional(),
    service: z.coerce.number().int().min(1).max(5).optional(),
    comfort: z.coerce.number().int().min(1).max(5).optional(),
    value: z.coerce.number().int().min(1).max(5).optional(),
  }),
  title: z.string().trim().max(120).optional(),
  comments: z.string().trim().max(2000).optional(),
});

export const submitMyFeedback = asyncHandler(async (req, res) => {
  const data = parse(feedbackSchema, req.body);
  const guest = await loadGuest(req);

  const booking = await Booking.findOne({ _id: data.bookingId, guest: guest._id });
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (booking.status !== 'checked_out') {
    throw new ApiError(409, 'Feedback can be shared after check-out.');
  }
  const existing = await Feedback.findOne({ booking: booking._id });
  if (existing) throw new ApiError(409, 'Feedback has already been submitted for this stay.');

  const feedback = await Feedback.create({
    guest: guest._id,
    booking: booking._id,
    ratings: data.ratings,
    title: data.title,
    comments: data.comments,
    isPublished: data.ratings.overall >= 4,
  });

  await notify({
    title: 'New guest feedback',
    message: `${guest.fullName} rated their stay ${data.ratings.overall}/5.`,
    type: 'feedback',
    audience: ['manager', 'admin'],
    link: '/feedback',
    createdBy: req.user._id,
  });

  res.status(201).json({ feedback });
});

export const getMyInvoices = asyncHandler(async (req, res) => {
  const guest = await loadGuest(req);
  const invoices = await Invoice.find({ guest: guest._id, status: { $ne: 'void' } })
    .sort({ issuedAt: -1 })
    .lean({ virtuals: true });
  res.json({ invoices });
});

const paySchema = z.object({
  amount: z.coerce.number().positive().optional(),
});

export const payMyInvoice = asyncHandler(async (req, res) => {
  const data = parse(paySchema, req.body);
  const guest = await loadGuest(req);
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    guest: guest._id,
  });
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  if (['paid', 'void'].includes(invoice.status)) {
    throw new ApiError(409, 'This invoice cannot be paid.');
  }

  const balance = Math.round((invoice.total - invoice.amountPaid) * 100) / 100;
  const amount = data.amount || balance;
  if (amount > balance + 0.001) {
    throw new ApiError(422, 'Payment exceeds the outstanding balance.');
  }

  invoice.amountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100;
  invoice.paymentMethod = 'online';
  if (invoice.amountPaid >= invoice.total) invoice.paidAt = new Date();
  await invoice.save();

  await notify({
    title: 'Guest settled a folio online',
    message: `${guest.fullName} paid ${amount.toFixed(2)} on invoice ${invoice.number}.`,
    type: 'billing',
    audience: ['receptionist', 'manager', 'admin'],
    link: `/billing/${invoice._id}`,
    createdBy: req.user._id,
  });

  res.json({ invoice });
});

const maintenanceSchema = z.object({
  bookingId: objectId.optional(),
  issue: z.string().trim().min(3).max(1000),
  category: z
    .enum(['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'network', 'other'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const reportMyMaintenance = asyncHandler(async (req, res) => {
  const data = parse(maintenanceSchema, req.body);
  const guest = await loadGuest(req);

  let booking = null;
  if (data.bookingId) {
    booking = await Booking.findOne({ _id: data.bookingId, guest: guest._id });
  } else {
    booking = await Booking.findOne({ guest: guest._id, status: 'checked_in' });
  }
  if (!booking) throw new ApiError(409, 'Maintenance can only be reported during an active stay.');

  const request = await MaintenanceRequest.create({
    room: booking.room,
    issue: data.issue,
    category: data.category || 'other',
    priority: data.priority || 'medium',
    reportedByType: 'guest',
    reportedByName: guest.fullName,
    reportedBy: req.user._id,
  });

  await notify({
    title: 'Guest maintenance report',
    message: `${guest.fullName}: ${data.issue}`,
    type: 'maintenance',
    audience: ['housekeeping', 'manager', 'admin'],
    link: '/maintenance',
    createdBy: req.user._id,
  });

  res.status(201).json({ request });
});

export const cancelMyBooking = asyncHandler(async (req, res) => {
  const guest = await loadGuest(req);
  const booking = await Booking.findOne({ _id: req.params.id, guest: guest._id });
  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new ApiError(409, 'This reservation can no longer be cancelled online.');
  }
  if (startOfDay(booking.checkIn) <= startOfDay(new Date())) {
    throw new ApiError(409, 'Please contact the front desk to cancel on the arrival day.');
  }
  booking.status = 'cancelled';
  booking.cancellationReason = 'Cancelled by guest online';
  await booking.save();

  await notify({
    title: 'Guest cancelled a reservation',
    message: `${guest.fullName} cancelled ${booking.reference}.`,
    type: 'booking',
    audience: ['receptionist', 'manager', 'admin'],
    link: `/bookings/${booking._id}`,
    createdBy: req.user._id,
  });

  res.json({ booking });
});
