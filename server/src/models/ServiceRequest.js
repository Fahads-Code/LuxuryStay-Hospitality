import mongoose from 'mongoose';

export const SERVICE_TYPES = [
  'room_service',
  'laundry',
  'wake_up_call',
  'transportation',
  'spa',
  'luggage',
  'extra_bed',
  'other',
];

const serviceRequestSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    type: { type: String, enum: SERVICE_TYPES, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    quantity: { type: Number, default: 1, min: 1 },
    amount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    scheduledFor: Date,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    chargeToRoom: { type: Boolean, default: true },
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
