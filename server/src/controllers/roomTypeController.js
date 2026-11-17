import { z } from 'zod';
import { RoomType } from '../models/RoomType.js';
import { Room } from '../models/Room.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, nonEmptyString } from '../utils/validation.js';

const typeSchema = z.object({
  name: nonEmptyString(60),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  baseRate: z.coerce.number().min(0),
  capacity: z.coerce.number().int().min(1).max(12),
  beds: z.string().trim().max(60).optional(),
  sizeSqm: z.coerce.number().min(0).optional(),
  amenities: z.array(z.string().trim().max(60)).max(30).optional(),
  accent: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
});

export const listRoomTypes = asyncHandler(async (req, res) => {
  const types = await RoomType.find({ isActive: true }).sort({ baseRate: 1 }).lean();
  const counts = await Room.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$type', rooms: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.rooms]));

  res.json({
    roomTypes: types.map((type) => ({
      ...type,
      roomCount: countMap.get(String(type._id)) || 0,
    })),
  });
});

export const listAllRoomTypes = asyncHandler(async (req, res) => {
  const types = await RoomType.find().sort({ baseRate: 1 }).lean();
  res.json({ roomTypes: types });
});

export const createRoomType = asyncHandler(async (req, res) => {
  const data = parse(typeSchema, req.body);
  const exists = await RoomType.findOne({ name: data.name });
  if (exists) throw new ApiError(409, 'A room type with that name already exists.');
  const roomType = await RoomType.create(data);
  res.status(201).json({ roomType });
});

export const updateRoomType = asyncHandler(async (req, res) => {
  const data = parse(typeSchema.partial(), req.body);
  const roomType = await RoomType.findById(req.params.id);
  if (!roomType) throw new ApiError(404, 'Room type not found.');

  if (data.name && data.name !== roomType.name) {
    const exists = await RoomType.findOne({ name: data.name, _id: { $ne: roomType._id } });
    if (exists) throw new ApiError(409, 'A room type with that name already exists.');
  }
  Object.assign(roomType, data);
  await roomType.save();
  res.json({ roomType });
});

export const deleteRoomType = asyncHandler(async (req, res) => {
  const roomType = await RoomType.findById(req.params.id);
  if (!roomType) throw new ApiError(404, 'Room type not found.');

  const rooms = await Room.countDocuments({ type: roomType._id, isActive: true });
  if (rooms > 0) {
    throw new ApiError(409, 'Reassign or deactivate rooms of this type before deleting it.');
  }
  await roomType.deleteOne();
  res.json({ message: 'Room type deleted.' });
});
