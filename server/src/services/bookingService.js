import mongoose from 'mongoose';
import { Booking, BLOCKING_BOOKING_STATUSES } from '../models/Booking.js';
import { Room } from '../models/Room.js';
import { RoomType } from '../models/RoomType.js';
import { ApiError } from '../utils/ApiError.js';
import { startOfDay, endOfDay, nightsBetween } from '../utils/dates.js';

export const generateReference = (prefix = 'LUX') => {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${prefix}-${stamp}${random}`;
};

export const generateInvoiceNumber = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${stamp}-${random}`;
};

/**
 * Finds rooms that have no blocking reservations in the requested window.
 */
export const findAvailableRooms = async ({
  checkIn,
  checkOut,
  roomTypeId,
  guests = 1,
  excludeBookingId,
} = {}) => {
  const from = startOfDay(checkIn);
  const to = endOfDay(checkOut);
  if (to <= from) throw new ApiError(400, 'Check-out must be after check-in.');

  const roomQuery = { isActive: true, status: { $nin: ['maintenance', 'out_of_order'] } };
  if (roomTypeId) roomQuery.type = roomTypeId;

  const rooms = await Room.find(roomQuery).populate('type').sort({ number: 1 }).lean();

  const clashes = await Booking.find({
    status: { $in: BLOCKING_BOOKING_STATUSES },
    checkIn: { $lt: to },
    checkOut: { $gt: from },
    ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
  })
    .select('room')
    .lean();

  const blocked = new Set(clashes.map((item) => String(item.room)));

  return rooms.filter((room) => {
    if (blocked.has(String(room._id))) return false;
    if (guests && room.type?.capacity < guests) return false;
    return true;
  });
};

export const assertRoomAvailable = async ({
  roomId,
  checkIn,
  checkOut,
  excludeBookingId,
}) => {
  const clash = await Booking.findOne({
    room: roomId,
    status: { $in: BLOCKING_BOOKING_STATUSES },
    checkIn: { $lt: endOfDay(checkOut) },
    checkOut: { $gt: startOfDay(checkIn) },
    ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
  }).lean();
  if (clash) {
    throw new ApiError(409, `Room is already reserved for these dates (${clash.reference}).`);
  }
};

export const calculateBookingCharges = ({ ratePerNight, checkIn, checkOut, taxRate = 0 }) => {
  const nights = nightsBetween(checkIn, checkOut);
  const roomTotal = Math.round(ratePerNight * nights * 100) / 100;
  const taxAmount = Math.round(roomTotal * (taxRate / 100) * 100) / 100;
  return {
    nights,
    roomTotal,
    taxAmount,
    totalAmount: Math.round((roomTotal + taxAmount) * 100) / 100,
  };
};

export const resolveRoomRate = async (room, roomTypeId) => {
  if (room?.rate) return room.rate;
  const typeId = roomTypeId || room?.type;
  const type = await RoomType.findById(typeId).lean();
  if (!type) throw new ApiError(404, 'Room type not found.');
  return type.baseRate;
};

export const isRoomTypeId = (value) =>
  typeof value === 'string' && mongoose.isValidObjectId(value);
