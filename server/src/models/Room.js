import mongoose from 'mongoose';

export const ROOM_STATUSES = [
  'available',
  'occupied',
  'dirty',
  'cleaning',
  'maintenance',
  'out_of_order',
];

const roomSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true, maxlength: 10 },
    floor: { type: Number, required: true, min: 0, max: 100 },
    type: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    rate: { type: Number, required: true, min: 0 },
    view: { type: String, trim: true, default: 'City view' },
    status: { type: String, enum: ROOM_STATUSES, default: 'available', index: true },
    housekeepingNote: { type: String, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ floor: 1, number: 1 });

export const Room = mongoose.model('Room', roomSchema);
