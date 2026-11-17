import mongoose from 'mongoose';

const maintenanceRequestSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    issue: { type: String, required: true, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'network', 'other'],
      default: 'other',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'cancelled'],
      default: 'open',
      index: true,
    },
    reportedByType: {
      type: String,
      enum: ['staff', 'guest'],
      default: 'staff',
    },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedByName: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: { type: String, maxlength: 1000 },
    resolvedAt: Date,
  },
  { timestamps: true }
);

export const MaintenanceRequest = mongoose.model(
  'MaintenanceRequest',
  maintenanceRequestSchema
);
