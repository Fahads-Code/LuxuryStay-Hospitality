import mongoose from 'mongoose';

const roomTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 1000 },
    baseRate: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1, max: 12 },
    beds: { type: String, trim: true, default: '1 King' },
    sizeSqm: { type: Number, min: 0 },
    amenities: [{ type: String, trim: true }],
    accent: { type: String, default: 'gold' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RoomType = mongoose.model('RoomType', roomTypeSchema);
