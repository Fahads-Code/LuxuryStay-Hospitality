import { z } from 'zod';
import { ServiceRequest, SERVICE_TYPES } from '../models/ServiceRequest.js';
import { Booking } from '../models/Booking.js';
import { Guest } from '../models/Guest.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, objectId, paginationSchema } from '../utils/validation.js';
import { getSettings } from '../services/settingsService.js';
import { notify } from '../services/notificationService.js';

const createSchema = z.object({
  booking: objectId.optional(),
  guest: objectId.optional(),
  room: objectId.optional(),
  type: z.enum(SERVICE_TYPES),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  amount: z.coerce.number().min(0).optional(),
  scheduledFor: z.string().optional().nullable(),
  chargeToRoom: z.boolean().optional(),
  assignedTo: objectId.optional().nullable(),
});

const updateSchema = z
  .object({
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    assignedTo: objectId.nullable(),
    amount: z.coerce.number().min(0),
    description: z.string().trim().max(500),
    scheduledFor: z.string().nullable(),
  })
  .partial();

export const listServices = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.booking) filter.booking = req.query.booking;

  const [services, total] = await Promise.all([
    ServiceRequest.find(filter)
      .populate('guest', 'firstName lastName vip')
      .populate('room', 'number floor')
      .populate('booking', 'reference checkIn checkOut status')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ServiceRequest.countDocuments(filter),
  ]);

  res.json({ services, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const createService = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);
  let guestId = data.guest;
  let roomId = data.room;

  if (data.booking) {
    const booking = await Booking.findById(data.booking);
    if (!booking) throw new ApiError(404, 'Reservation not found.');
    guestId = booking.guest;
    roomId = booking.room;
  }
  if (!guestId) throw new ApiError(422, 'Select a booking or guest for this service request.');
  const guest = await Guest.findById(guestId);
  if (!guest) throw new ApiError(404, 'Guest not found.');

  let amount = data.amount;
  if (amount == null) {
    const settings = await getSettings();
    const menuItem = settings.serviceMenu.find((item) => item.type === data.type);
    amount = menuItem?.price || 0;
  }

  if (data.assignedTo) {
    const staff = await User.findById(data.assignedTo);
    if (!staff) throw new ApiError(404, 'Assigned staff member not found.');
  }

  const service = await ServiceRequest.create({
    booking: data.booking,
    guest: guestId,
    room: roomId,
    type: data.type,
    description: data.description || '',
    quantity: data.quantity,
    amount: amount * data.quantity,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
    chargeToRoom: data.chargeToRoom ?? true,
    assignedTo: data.assignedTo || undefined,
    createdBy: req.user._id,
  });

  await notify({
    title: 'New guest service request',
    message: `${guest.fullName} requested ${data.type.replaceAll('_', ' ')}${roomId ? ' — room service coordination needed.' : '.'}`,
    type: 'housekeeping',
    audience: ['housekeeping', 'manager', 'admin'],
    link: '/services',
    createdBy: req.user._id,
  });

  await service.populate([
    { path: 'guest', select: 'firstName lastName vip' },
    { path: 'room', select: 'number' },
    { path: 'booking', select: 'reference' },
  ]);
  res.status(201).json({ service });
});

export const updateService = asyncHandler(async (req, res) => {
  const data = parse(updateSchema, req.body);
  const service = await ServiceRequest.findById(req.params.id).populate(
    'guest',
    'firstName lastName'
  );
  if (!service) throw new ApiError(404, 'Service request not found.');

  if (data.assignedTo) {
    const staff = await User.findById(data.assignedTo);
    if (!staff) throw new ApiError(404, 'Assigned staff member not found.');
  }

  Object.assign(service, data);
  if (data.scheduledFor) service.scheduledFor = new Date(data.scheduledFor);
  if (data.status === 'completed' && !service.completedAt) service.completedAt = new Date();
  if (data.status && data.status !== 'completed') service.completedAt = undefined;
  await service.save();

  if (data.status === 'completed') {
    await notify({
      title: 'Service completed',
      message: `${service.type.replaceAll('_', ' ')} for ${service.guest?.fullName || 'guest'} is complete.`,
      type: 'housekeeping',
      audience: ['housekeeping', 'manager', 'admin'],
      link: '/services',
      createdBy: req.user._id,
    });
  }

  res.json({ service });
});
