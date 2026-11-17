import mongoose from 'mongoose';

const guestSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    nationality: { type: String, trim: true, default: 'United States' },
    idType: {
      type: String,
      enum: ['passport', 'national_id', 'drivers_license', 'other'],
      default: 'passport',
    },
    idNumber: { type: String, trim: true },
    dateOfBirth: Date,
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    preferences: [{ type: String, trim: true }],
    notes: { type: String, maxlength: 2000 },
    vip: { type: Boolean, default: false },
    marketingConsent: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

guestSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

guestSchema.index({ firstName: 'text', lastName: 'text', email: 'text', phone: 'text' });

export const Guest = mongoose.model('Guest', guestSchema);
