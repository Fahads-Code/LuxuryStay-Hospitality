import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['booking', 'checkin', 'checkout', 'housekeeping', 'maintenance', 'billing', 'feedback', 'system'],
      default: 'system',
    },
    link: { type: String, trim: true },
    audience: [{ type: String, enum: ['admin', 'manager', 'receptionist', 'housekeeping', 'guest'] }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
