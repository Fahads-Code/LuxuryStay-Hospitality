import { z } from 'zod';
import { RoomType } from '../models/RoomType.js';
import { Room } from '../models/Room.js';
import { Guest } from '../models/Guest.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Feedback } from '../models/Feedback.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, email } from '../utils/validation.js';
import { isoDay, startOfDay } from '../utils/dates.js';
import {
  findAvailableRooms,
  calculateBookingCharges,
  generateReference,
} from '../services/bookingService.js';
import { getSettings } from '../services/settingsService.js';
import { notify } from '../services/notificationService.js';

export const getPublicInfo = asyncHandler(async (req, res) => {
  const [settings, roomTypes, bookableTypeIds, testimonials, roomCount] = await Promise.all([
    getSettings(),
    RoomType.find({ isActive: true }).sort({ baseRate: 1 }).lean(),
    // A room type with no active rooms cannot be reserved. Exposing it on the
    // public site sends guests to a booking page where the type never shows up.
    Room.distinct('type', { isActive: true, status: { $nin: ['maintenance', 'out_of_order'] } }),
    Feedback.find({ isPublished: true })
      .populate('guest', 'firstName lastName')
      .populate({ path: 'booking', select: 'room', populate: { path: 'room', select: 'type', populate: { path: 'type', select: 'name' } } })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Room.countDocuments({ isActive: true }),
  ]);

  res.json({
    hotel: {
      name: settings.hotelName,
      tagline: settings.tagline,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      address: settings.address,
      checkInTime: settings.checkInTime,
      checkOutTime: settings.checkOutTime,
      currency: settings.currency,
      policies: settings.policies,
    },
    roomTypes: roomTypes
      .filter((type) => bookableTypeIds.some((id) => String(id) === String(type._id)))
      .map((type) => ({
        id: type._id,
        name: (type.name || '').trim(),
        description: type.description || '',
        baseRate: type.baseRate ?? 0,
        capacity: type.capacity ?? 0,
        beds: type.beds || '',
        sizeSqm: type.sizeSqm ?? null,
        amenities: Array.isArray(type.amenities) ? type.amenities.filter(Boolean) : [],
      }))
      .filter((type) => type.name),
    roomCount,
    testimonials: testimonials.map((item) => ({
      id: item._id,
      name: item.guest
        ? `${item.guest.firstName} ${item.guest.lastName?.charAt(0) || ''}.`
        : 'A recent guest',
      rating: item.ratings.overall,
      title: item.title,
      comments: item.comments,
      roomType: item.booking?.room?.type?.name,
      date: item.createdAt,
    })),
  });
});

export const searchAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, guests = 1 } = req.query;
  if (!checkIn || !checkOut) throw new ApiError(400, 'Choose arrival and departure dates.');
  const from = new Date(checkIn);
  const to = new Date(checkOut);
  if (startOfDay(to) <= startOfDay(from)) {
    throw new ApiError(422, 'Check-out must be after check-in.');
  }
  if (startOfDay(from) < startOfDay(new Date())) {
    throw new ApiError(422, 'Arrival cannot be in the past.');
  }

  const [rooms, types, settings] = await Promise.all([
    findAvailableRooms({ checkIn: from, checkOut: to, guests: Number(guests) || 1 }),
    RoomType.find({ isActive: true }).sort({ baseRate: 1 }).lean(),
    getSettings(),
  ]);

  const grouped = new Map();
  for (const room of rooms) {
    const key = String(room.type?._id || room.type);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(room);
  }

  res.json({
    checkIn: isoDay(from),
    checkOut: isoDay(to),
    nights: Math.max(1, Math.round((startOfDay(to) - startOfDay(from)) / 86400000)),
    guests: Number(guests) || 1,
    taxRate: settings.taxRate,
    roomTypes: types
      .map((type) => {
        const available = grouped.get(String(type._id)) || [];
        return {
          id: type._id,
          name: type.name,
          description: type.description,
          baseRate: type.baseRate,
          fromRate: available.length ? Math.min(...available.map((room) => room.rate)) : type.baseRate,
          capacity: type.capacity,
          beds: type.beds,
          sizeSqm: type.sizeSqm,
          amenities: type.amenities,
          availableCount: available.length,
          available: available.length > 0,
        };
      })
      .filter((type) => type.available),
  });
});

const publicBookingSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  phone: z.string().trim().min(6).max(30),
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.coerce.number().int().min(1).max(12).default(2),
  children: z.coerce.number().int().min(0).max(8).default(0),
  roomTypeId: z.string().min(1),
  specialRequests: z.string().trim().max(1000).optional().or(z.literal('')),
  marketingConsent: z.boolean().optional(),
  requestId: z.string().trim().min(8).max(80).optional(),
});

const publicBookingReply = (booking, { email, firstName, lastName, roomTypeName, currency }) => ({
  reference: booking.reference,
  status: booking.status,
  firstName: firstName || '',
  lastName: lastName || '',
  guestName: [firstName, lastName].filter(Boolean).join(' ').trim(),
  checkIn: isoDay(booking.checkIn),
  checkOut: isoDay(booking.checkOut),
  nights: booking.nights,
  roomType: roomTypeName,
  totalAmount: booking.totalAmount,
  currency,
  email,
});

/**
 * A guest may retry a submission if the network or API restart interrupted the
 * first attempt. Looking the request up by its idempotency key keeps that
 * retry from creating a second reservation.
 */
const findBookingForRequest = async (requestId) => {
  const booking = await Booking.findOne({ requestId })
    .populate('guest', 'email firstName lastName')
    .populate('roomType', 'name');
  if (!booking) return null;
  const settings = await getSettings();
  return publicBookingReply(booking, {
    email: booking.guest?.email,
    firstName: booking.guest?.firstName,
    lastName: booking.guest?.lastName,
    roomTypeName: booking.roomType?.name || 'Room',
    currency: settings.currency,
  });
};

export const createPublicBooking = asyncHandler(async (req, res) => {
  const data = parse(publicBookingSchema, req.body);
  const from = new Date(data.checkIn);
  const to = new Date(data.checkOut);
  if (startOfDay(to) <= startOfDay(from)) {
    throw new ApiError(422, 'Check-out must be after check-in.');
  }
  if (startOfDay(from) < startOfDay(new Date())) {
    throw new ApiError(422, 'Arrival cannot be in the past.');
  }

  // Safe retry: if this request already produced a booking, return it instead
  // of reserving a second room (covers double clicks and interrupted retries).
  if (data.requestId) {
    const existing = await findBookingForRequest(data.requestId);
    if (existing) {
      return res.status(200).json({
        message: 'Your reservation request has been received. Our team will confirm it shortly.',
        booking: existing,
      });
    }
  }

  const type = await RoomType.findById(data.roomTypeId);
  if (!type || !type.isActive) throw new ApiError(404, 'Room type not found.');
  if (data.adults + data.children > type.capacity) {
    throw new ApiError(422, `The ${type.name} accommodates up to ${type.capacity} guests.`);
  }

  const available = await findAvailableRooms({
    checkIn: from,
    checkOut: to,
    roomTypeId: type._id,
    guests: data.adults + data.children,
  });
  if (available.length === 0) {
    throw new ApiError(409, 'No rooms of this type are available for those dates.');
  }

  const room = available[0];
  const settings = await getSettings();
  const charges = calculateBookingCharges({
    ratePerNight: room.rate,
    checkIn: from,
    checkOut: to,
    taxRate: settings.taxRate,
  });

  // A signed-in guest books under the profile linked to their account so the
  // reservation appears in their portal. Staff bookings keep the existing
  // behaviour of matching (or creating) a guest profile by email.
  let guest = null;
  if (req.user?.role === 'guest') {
    if ((data.email || '').toLowerCase() !== (req.user.email || '').toLowerCase()) {
      throw new ApiError(403, 'Please book with the email address on your account.');
    }
    if (req.user.guestProfile) {
      guest = await Guest.findById(req.user.guestProfile);
    }
    if (!guest) {
      guest = await Guest.findOneAndUpdate(
        { email: req.user.email },
        {
          $setOnInsert: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: req.user.email,
            phone: data.phone,
            marketingConsent: data.marketingConsent || false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await User.updateOne({ _id: req.user._id }, { guestProfile: guest._id });
    }
  }

  if (!guest) {
    guest = await Guest.findOneAndUpdate(
      { email: data.email },
      {
        $setOnInsert: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          marketingConsent: data.marketingConsent || false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  let reference = generateReference();
  while (await Booking.exists({ reference })) reference = generateReference();

  let booking;
  try {
    booking = await Booking.create({
      reference,
      guest: guest._id,
      room: room._id,
      roomType: type._id,
      checkIn: from,
      checkOut: to,
      adults: data.adults,
      children: data.children,
      status: 'pending',
      source: 'online',
      specialRequests: data.specialRequests,
      requestId: data.requestId,
      ratePerNight: room.rate,
      nights: charges.nights,
      roomTotal: charges.roomTotal,
      taxRate: settings.taxRate,
      taxAmount: charges.taxAmount,
      totalAmount: charges.totalAmount,
    });
  } catch (error) {
    // Two retries can race on the requestId unique index; the winner's booking
    // is the reservation we should return to the guest.
    if (error?.code === 11000 && data.requestId) {
      const existing = await findBookingForRequest(data.requestId);
      if (existing) {
        return res.status(200).json({
          message: 'Your reservation request has been received. Our team will confirm it shortly.',
          booking: existing,
        });
      }
    }
    throw error;
  }

  await notify({
    title: 'Online reservation request',
    message: `${guest.firstName} ${guest.lastName} requested the ${type.name} from ${isoDay(from)} to ${isoDay(to)}. Reference ${reference}.`,
    type: 'booking',
    audience: ['receptionist', 'manager', 'admin'],
    link: `/bookings/${booking._id}`,
  });

  res.status(201).json({
    message: 'Your reservation request has been received. Our team will confirm it shortly.',
    booking: publicBookingReply(booking, {
      email: guest.email,
      firstName: guest.firstName,
      lastName: guest.lastName,
      roomTypeName: type.name,
      currency: settings.currency,
    }),
  });
});

const publicFeedbackSchema = z.object({
  reference: z.string().trim().min(3).max(20),
  email,
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

export const createPublicFeedback = asyncHandler(async (req, res) => {
  const data = parse(publicFeedbackSchema, req.body);
  const booking = await Booking.findOne({ reference: data.reference.toUpperCase() }).populate(
    'guest',
    'firstName lastName email'
  );
  if (!booking || !booking.guest) throw new ApiError(404, 'Reservation not found.');
  if ((booking.guest.email || '').toLowerCase() !== data.email) {
    throw new ApiError(403, 'The email does not match this reservation.');
  }
  if (booking.status !== 'checked_out') {
    throw new ApiError(409, 'Feedback can only be submitted after check-out.');
  }
  const existing = await Feedback.findOne({ booking: booking._id });
  if (existing) throw new ApiError(409, 'Feedback has already been submitted for this stay.');

  const feedback = await Feedback.create({
    guest: booking.guest._id,
    booking: booking._id,
    ratings: data.ratings,
    title: data.title,
    comments: data.comments,
    isPublished: data.ratings.overall >= 4,
  });

  await notify({
    title: 'New guest feedback',
    message: `${booking.guest.firstName} rated their stay ${data.ratings.overall}/5.`,
    type: 'feedback',
    audience: ['manager', 'admin'],
    link: '/feedback',
  });

  res.status(201).json({ message: 'Thank you for sharing your experience.', feedback });
});
