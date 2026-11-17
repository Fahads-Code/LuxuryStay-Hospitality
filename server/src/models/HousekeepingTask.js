import mongoose from 'mongoose';

const housekeepingTaskSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    type: {
      type: String,
      enum: ['cleaning', 'deep_clean', 'turndown', 'inspection', 'linen_change'],
      default: 'cleaning',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, maxlength: 500 },
    scheduledFor: { type: Date, default: Date.now, index: true },
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const HousekeepingTask = mongoose.model('HousekeepingTask', housekeepingTaskSchema);
