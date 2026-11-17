import mongoose from 'mongoose';

const serviceMenuItemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    label: { type: String, required: true },
    price: { type: Number, default: 0, min: 0 },
    description: { type: String },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    hotelName: { type: String, default: 'LuxuryStay Hospitality' },
    tagline: {
      type: String,
      default:
        'Thoughtful hospitality, considered spaces and a warm welcome from the moment you arrive.',
    },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    currency: { type: String, default: 'USD' },
    taxRate: { type: Number, default: 0, min: 0, max: 50 },
    checkInTime: { type: String, default: '15:00' },
    checkOutTime: { type: String, default: '11:00' },
    policies: {
      cancellation: { type: String, default: '' },
      children: { type: String, default: '' },
      pets: { type: String, default: '' },
      smoking: { type: String, default: '' },
    },
    serviceMenu: {
      type: [serviceMenuItemSchema],
      default: [],
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Setting = mongoose.model('Setting', settingSchema);
