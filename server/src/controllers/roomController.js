import { z } from 'zod';
import { Room, ROOM_STATUSES } from '../models/Room.js';
import { RoomType } from '../models/RoomType.js';
import { Booking } from '../models/Booking.js';
import { HousekeepingTask } from '../models/HousekeepingTask.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, nonEmptyString, objectId } from '../utils/validation.js';
import { startOfDay, endOfDay } from '../utils/dates.js';
import { notify } from '../services/notificationService.js';

const roomSchema = z.object({
  number: nonEmptyString(10),
  floor: z.coerce.number().int().min(0).max(100),
  type: objectId,
  rate: z.coerce.number().min(0).optional(),
  view: z.string().trim().max(60).optional(),
  status: z.enum(ROOM_STATUSES).optional(),
  housekeepingNote: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const listRooms = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    const statuses = String(req.query.status).split(',').filter((s) => ROOM_STATUSES.includes(s));
    if (statuses.length) filter.status = { $in: statuses };
  }
  if (req.query.floor) filter.floor = Number(req.query.floor);
  if (req.query.type) filter.type = req.query.type;
  if (req.query.q) filter.number = { $regex: req.query.q, $options: 'i' };
  if (req.query.includeInactive !== 'true') filter.isActive = true;

  // Only the fields the room grid and detail drawer actually use. Shipping the
  // full type document (description, amenities, etc.) for every one of the
  // property's rooms makes the initial list noticeably heavier than it needs to be.
  const rooms = await Room.find(filter)
    .select('number floor type rate view status housekeepingNote isActive')
    .populate('type', 'name baseRate capacity beds')
    .lean();
  // Numeric ordering keeps 1001–1010 after 901–910 on the tenth floor.
  rooms.sort(
    (a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true })
  );

  const now = new Date();
  const [activeBookings, maintenance, tasks] = await Promise.all([
    Booking.find({
      status: 'checked_in',
      checkIn: { $lte: endOfDay(now) },
      checkOut: { $gt: startOfDay(now) },
    })
      .populate('guest', 'firstName lastName vip')
      .lean(),
    MaintenanceRequest.aggregate([
      { $match: { status: { $in: ['open', 'in_progress'] } } },
      { $group: { _id: '$room', count: { $sum: 1 } } },
    ]),
    HousekeepingTask.aggregate([
      { $match: { status: { $in: ['pending', 'in_progress'] } } },
      { $group: { _id: '$room', count: { $sum: 1 } } },
    ]),
  ]);

  const bookingMap = new Map(activeBookings.map((b) => [String(b.room), b]));
  const maintenanceMap = new Map(maintenance.map((m) => [String(m._id), m.count]));
  const taskMap = new Map(tasks.map((t) => [String(t._id), t.count]));

  res.json({
    rooms: rooms.map((room) => ({
      ...room,
      currentBooking: bookingMap.get(String(room._id)) || null,
      openMaintenance: maintenanceMap.get(String(room._id)) || 0,
      openTasks: taskMap.get(String(room._id)) || 0,
    })),
  });
});

export const getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id).populate('type');
  if (!room) throw new ApiError(404, 'Room not found.');

  const [bookings, tasks, maintenance] = await Promise.all([
    Booking.find({ room: room._id })
      .populate('guest', 'firstName lastName email vip')
      .sort({ checkIn: -1 })
      .limit(12)
      .lean(),
    HousekeepingTask.find({ room: room._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('assignedTo', 'name')
      .lean(),
    MaintenanceRequest.find({ room: room._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('assignedTo', 'name')
      .lean(),
  ]);

  res.json({ room, bookings, tasks, maintenance });
});

export const createRoom = asyncHandler(async (req, res) => {
  const data = parse(roomSchema, req.body);
  const type = await RoomType.findById(data.type);
  if (!type) throw new ApiError(404, 'Room type not found.');
  if (data.rate == null) data.rate = type.baseRate;

  const exists = await Room.findOne({ number: data.number });
  if (exists) throw new ApiError(409, 'A room with that number already exists.');

  const room = await Room.create(data);
  await room.populate('type');
  res.status(201).json({ room });
});

export const updateRoom = asyncHandler(async (req, res) => {
  const data = parse(roomSchema.partial(), req.body);
  const room = await Room.findById(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found.');

  if (data.number && data.number !== room.number) {
    const exists = await Room.findOne({ number: data.number, _id: { $ne: room._id } });
    if (exists) throw new ApiError(409, 'A room with that number already exists.');
  }
  if (data.type && String(data.type) !== String(room.type)) {
    const type = await RoomType.findById(data.type);
    if (!type) throw new ApiError(404, 'Room type not found.');
    if (data.rate == null) data.rate = type.baseRate;
  }

  Object.assign(room, data);
  await room.save();
  await room.populate('type');
  res.json({ room });
});

const statusSchema = z.object({
  status: z.enum(ROOM_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const updateRoomStatus = asyncHandler(async (req, res) => {
  const { status, note } = parse(statusSchema, req.body);
  const room = await Room.findById(req.params.id).populate('type');
  if (!room) throw new ApiError(404, 'Room not found.');

  const activeBooking = await Booking.findOne({
    room: room._id,
    status: 'checked_in',
    checkIn: { $lte: endOfDay() },
    checkOut: { $gt: startOfDay() },
  });
  if (activeBooking && ['available', 'dirty', 'cleaning', 'maintenance'].includes(status)) {
    throw new ApiError(
      409,
      'This room has an in-house guest. Complete check-out before changing its status.'
    );
  }

  const previous = room.status;
  room.status = status;
  if (note !== undefined) room.housekeepingNote = note;
  await room.save();

  if (['dirty', 'cleaning'].includes(status)) {
    const existing = await HousekeepingTask.findOne({
      room: room._id,
      status: { $in: ['pending', 'in_progress'] },
    });
    if (!existing) {
      await HousekeepingTask.create({
        room: room._id,
        type: 'cleaning',
        priority: 'medium',
        notes: note || `Room marked ${status} by ${req.user.name}`,
        createdBy: req.user._id,
      });
    }
    await notify({
      title: `Room ${room.number} needs attention`,
      message: `Status changed from ${previous} to ${status}.`,
      type: 'housekeeping',
      audience: ['housekeeping', 'manager', 'admin'],
      link: '/housekeeping',
      createdBy: req.user._id,
    });
  }

  if (status === 'available') {
    await HousekeepingTask.updateMany(
      { room: room._id, status: { $in: ['pending', 'in_progress'] } },
      { status: 'completed', completedAt: new Date() }
    );
  }

  res.json({ room });
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found.');

  const active = await Booking.countDocuments({
    room: room._id,
    status: { $in: ['pending', 'confirmed', 'checked_in'] },
  });
  if (active > 0) throw new ApiError(409, 'This room has active reservations.');
  if (room.status === 'occupied') throw new ApiError(409, 'An occupied room cannot be removed.');

  const history = await Booking.countDocuments({ room: room._id });
  if (history > 0) {
    room.isActive = false;
    room.status = 'out_of_order';
    await room.save();
    return res.json({ message: 'Room has history and was archived instead of deleted.', room });
  }
  await room.deleteOne();
  res.json({ message: 'Room deleted.' });
});
