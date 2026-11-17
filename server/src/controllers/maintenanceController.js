import { z } from 'zod';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { Room } from '../models/Room.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, objectId, paginationSchema } from '../utils/validation.js';
import { notify } from '../services/notificationService.js';

const createSchema = z.object({
  room: objectId,
  issue: z.string().trim().min(3).max(1000),
  category: z
    .enum(['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'network', 'other'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  reportedByType: z.enum(['staff', 'guest']).optional(),
  reportedByName: z.string().trim().max(80).optional(),
  assignedTo: objectId.optional().nullable(),
});

const updateSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved', 'cancelled']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    assignedTo: objectId.nullable(),
    resolutionNotes: z.string().trim().max(1000),
  })
  .partial();

export const listMaintenance = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.room) filter.room = req.query.room;

  const [requests, total, summary] = await Promise.all([
    MaintenanceRequest.find(filter)
      .populate('room', 'number floor status')
      .populate('assignedTo', 'name')
      .populate('reportedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MaintenanceRequest.countDocuments(filter),
    MaintenanceRequest.aggregate([
      { $match: { status: { $in: ['open', 'in_progress'] } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = summary.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  res.json({
    requests,
    openByPriority: {
      urgent: counts.urgent || 0,
      high: counts.high || 0,
      medium: counts.medium || 0,
      low: counts.low || 0,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const createMaintenance = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);
  const room = await Room.findById(data.room);
  if (!room) throw new ApiError(404, 'Room not found.');

  if (data.assignedTo) {
    const staff = await User.findById(data.assignedTo);
    if (!staff) throw new ApiError(404, 'Assigned staff member not found.');
  }

  const request = await MaintenanceRequest.create({
    ...data,
    priority: data.priority || 'medium',
    reportedBy: req.user._id,
    reportedByName: data.reportedByName || req.user.name,
    reportedByType: data.reportedByType || 'staff',
  });

  const activeBooking = await Booking.findOne({
    room: room._id,
    status: 'checked_in',
  });
  if (!activeBooking && ['available', 'dirty', 'cleaning'].includes(room.status)) {
    room.status = 'maintenance';
    await room.save();
  }

  await notify({
    title: `${data.priority === 'urgent' ? 'Urgent ' : ''}Maintenance reported`,
    message: `Room ${room.number}: ${data.issue}`,
    type: 'maintenance',
    audience: ['housekeeping', 'manager', 'admin'],
    link: '/maintenance',
    createdBy: req.user._id,
  });

  await request.populate('room', 'number floor status');
  res.status(201).json({ request });
});

export const updateMaintenance = asyncHandler(async (req, res) => {
  const data = parse(updateSchema, req.body);
  const request = await MaintenanceRequest.findById(req.params.id).populate('room');
  if (!request) throw new ApiError(404, 'Maintenance request not found.');

  if (data.assignedTo) {
    const staff = await User.findById(data.assignedTo);
    if (!staff) throw new ApiError(404, 'Assigned staff member not found.');
  }

  Object.assign(request, data);
  if (data.status === 'resolved') request.resolvedAt = new Date();
  if (data.status && data.status !== 'resolved') request.resolvedAt = undefined;
  await request.save();

  if (data.status && request.room) {
    if (['open', 'in_progress'].includes(data.status)) {
      if (request.room.status !== 'occupied') {
        request.room.status = 'maintenance';
        await request.room.save();
      }
    } else {
      const otherOpen = await MaintenanceRequest.countDocuments({
        room: request.room._id,
        status: { $in: ['open', 'in_progress'] },
        _id: { $ne: request._id },
      });
      const occupied = await Booking.findOne({
        room: request.room._id,
        status: 'checked_in',
      });
      if (otherOpen === 0) {
        request.room.status = occupied ? 'occupied' : 'available';
        await request.room.save();
      }
    }
  }

  if (data.status === 'resolved') {
    await notify({
      title: 'Maintenance resolved',
      message: `Room ${request.room?.number || ''}: ${request.issue}`,
      type: 'maintenance',
      audience: ['housekeeping', 'manager', 'admin'],
      link: '/maintenance',
      createdBy: req.user._id,
    });
  }

  await request.populate('assignedTo', 'name');
  res.json({ request });
});
