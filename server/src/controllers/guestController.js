import { z } from 'zod';
import { Guest } from '../models/Guest.js';
import { Booking } from '../models/Booking.js';
import { Feedback } from '../models/Feedback.js';
import { Invoice } from '../models/Invoice.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, email, nonEmptyString, paginationSchema } from '../utils/validation.js';

const addressSchema = z
  .object({
    street: z.string().trim().max(120).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(80).optional(),
  })
  .optional();

const guestFields = {
  firstName: nonEmptyString(60),
  lastName: nonEmptyString(60),
  email: email.optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  nationality: z.string().trim().max(60).optional(),
  idType: z.enum(['passport', 'national_id', 'drivers_license', 'other']).optional(),
  idNumber: z.string().trim().max(50).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().nullable(),
  address: addressSchema,
  preferences: z.array(z.string().trim().max(60)).max(20).optional(),
  notes: z.string().max(2000).optional(),
  vip: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
};

const createSchema = z.object(guestFields);
const updateSchema = z.object(guestFields).partial();

export const listGuests = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const { q, vip } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }
  if (vip === 'true') filter.vip = true;

  const [guests, total] = await Promise.all([
    Guest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: true }),
    Guest.countDocuments(filter),
  ]);

  const stats = await Booking.aggregate([
    { $match: { guest: { $in: guests.map((g) => g._id) }, status: 'checked_out' } },
    {
      $group: {
        _id: '$guest',
        stays: { $sum: 1 },
        lastStay: { $max: '$checkOut' },
        lifetimeValue: { $sum: '$totalAmount' },
      },
    },
  ]);
  const statsMap = new Map(stats.map((s) => [String(s._id), s]));

  res.json({
    guests: guests.map((guest) => ({
      ...guest,
      fullName: `${guest.firstName} ${guest.lastName}`,
      stats: statsMap.get(String(guest._id)) || { stays: 0, lastStay: null, lifetimeValue: 0 },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found.');

  const [bookings, feedback, invoices] = await Promise.all([
    Booking.find({ guest: guest._id })
      .populate('room', 'number floor type')
      .sort({ checkIn: -1 })
      .limit(20)
      .lean(),
    Feedback.find({ guest: guest._id }).sort({ createdAt: -1 }).limit(10).lean(),
    Invoice.find({ guest: guest._id }).sort({ issuedAt: -1 }).limit(10).lean(),
  ]);

  res.json({
    guest: { ...guest.toObject({ virtuals: true }), fullName: guest.fullName },
    bookings,
    feedback,
    invoices,
  });
});

export const createGuest = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);
  if (data.email) {
    const existing = await Guest.findOne({ email: data.email });
    if (existing) throw new ApiError(409, 'A guest with this email already exists.');
  }
  const guest = await Guest.create({ ...data, createdBy: req.user._id });
  res.status(201).json({ guest });
});

export const updateGuest = asyncHandler(async (req, res) => {
  const data = parse(updateSchema, req.body);
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found.');

  if (data.email && data.email !== guest.email) {
    const existing = await Guest.findOne({ email: data.email, _id: { $ne: guest._id } });
    if (existing) throw new ApiError(409, 'A guest with this email already exists.');
  }

  Object.assign(guest, data);
  await guest.save();
  res.json({ guest });
});

export const deleteGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found.');

  const activeBookings = await Booking.countDocuments({
    guest: guest._id,
    status: { $in: ['pending', 'confirmed', 'checked_in'] },
  });
  if (activeBookings > 0) {
    throw new ApiError(409, 'This guest has active reservations and cannot be deleted.');
  }

  const totalBookings = await Booking.countDocuments({ guest: guest._id });
  if (totalBookings > 0) {
    throw new ApiError(
      409,
      'This guest has booking history. Keep the profile to preserve reporting; deactivate the linked user instead.'
    );
  }

  await User.updateMany({ guestProfile: guest._id }, { $unset: { guestProfile: 1 } });
  await guest.deleteOne();
  res.json({ message: 'Guest deleted.' });
});
