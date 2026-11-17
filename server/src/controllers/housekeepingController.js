import { z } from 'zod';
import { HousekeepingTask } from '../models/HousekeepingTask.js';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, objectId, paginationSchema } from '../utils/validation.js';
import { notify } from '../services/notificationService.js';

const createSchema = z.object({
  room: objectId,
  type: z.enum(['cleaning', 'deep_clean', 'turndown', 'inspection', 'linen_change']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignedTo: objectId.optional().nullable(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  scheduledFor: z.string().optional().nullable(),
});

const updateSchema = z
  .object({
    type: z.enum(['cleaning', 'deep_clean', 'turndown', 'inspection', 'linen_change']),
    priority: z.enum(['low', 'medium', 'high']),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    assignedTo: objectId.nullable(),
    notes: z.string().trim().max(500),
    scheduledFor: z.string().nullable(),
  })
  .partial();

export const listTasks = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = {};
  if (req.query.status) {
    const statuses = String(req.query.status).split(',');
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (req.query.assignedTo === 'me') filter.assignedTo = req.user._id;
  else if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.room) filter.room = req.query.room;
  if (req.query.date) {
    const day = new Date(req.query.date);
    const start = new Date(day.setHours(0, 0, 0, 0));
    const end = new Date(new Date(start).setHours(23, 59, 59, 999));
    filter.scheduledFor = { $gte: start, $lte: end };
  }

  const [tasks, total, summary] = await Promise.all([
    HousekeepingTask.find(filter)
      .populate({
        path: 'room',
        select: 'number floor status type',
        populate: { path: 'type', select: 'name' },
      })
      .populate('assignedTo', 'name')
      .sort({ priority: -1, scheduledFor: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    HousekeepingTask.countDocuments(filter),
    HousekeepingTask.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = summary.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  res.json({
    tasks,
    counts: {
      pending: counts.pending || 0,
      in_progress: counts.in_progress || 0,
      completed: counts.completed || 0,
      cancelled: counts.cancelled || 0,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const createTask = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);
  const room = await Room.findById(data.room);
  if (!room) throw new ApiError(404, 'Room not found.');

  if (data.assignedTo) {
    const staff = await User.findOne({ _id: data.assignedTo, role: { $in: ['housekeeping', 'manager', 'admin'] } });
    if (!staff) throw new ApiError(404, 'Housekeeping staff member not found.');
  }

  const task = await HousekeepingTask.create({
    ...data,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : new Date(),
    createdBy: req.user._id,
  });

  await notify({
    title: 'Housekeeping task created',
    message: `${data.type || 'cleaning'} for room ${room.number}.`,
    type: 'housekeeping',
    audience: ['housekeeping', 'manager', 'admin'],
    link: '/housekeeping',
    createdBy: req.user._id,
  });

  await task.populate([
    { path: 'room', select: 'number floor status' },
    { path: 'assignedTo', select: 'name' },
  ]);
  res.status(201).json({ task });
});

export const updateTask = asyncHandler(async (req, res) => {
  const data = parse(updateSchema, req.body);
  const task = await HousekeepingTask.findById(req.params.id).populate('room');
  if (!task) throw new ApiError(404, 'Task not found.');

  if (data.assignedTo) {
    const staff = await User.findById(data.assignedTo);
    if (!staff) throw new ApiError(404, 'Staff member not found.');
  }

  Object.assign(task, data);
  if (data.scheduledFor) task.scheduledFor = new Date(data.scheduledFor);

  if (data.status === 'in_progress' && task.room) {
    task.room.status = 'cleaning';
    await task.room.save();
  }

  if (data.status === 'completed') {
    task.completedAt = new Date();
    const stillOpen = await HousekeepingTask.countDocuments({
      room: task.room._id,
      status: { $in: ['pending', 'in_progress'] },
      _id: { $ne: task._id },
    });
    const maintenanceOpen = await MaintenanceRequest.countDocuments({
      room: task.room._id,
      status: { $in: ['open', 'in_progress'] },
    });
    if (stillOpen === 0) {
      task.room.status = maintenanceOpen > 0 ? 'maintenance' : 'available';
      await task.room.save();
    }
  }

  await task.save();
  await task.populate('assignedTo', 'name');
  res.json({ task });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await HousekeepingTask.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found.');
  if (task.status === 'completed') {
    throw new ApiError(409, 'Completed tasks are kept for the housekeeping log.');
  }
  await task.deleteOne();
  res.json({ message: 'Task removed.' });
});
