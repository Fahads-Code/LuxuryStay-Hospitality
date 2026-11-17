import mongoose from 'mongoose';
import { nightsBetween } from '../utils/dates.js';

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
];

export const BLOCKING_BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in'];

const bookingSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true, trim: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    adults: { type: Number, default: 1, min: 1, max: 12 },
    children: { type: Number, default: 0, min: 0, max: 12 },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'confirmed',
      index: true,
    },
    source: {
      type: String,
      enum: ['online', 'walk_in', 'phone', 'staff', 'corporate'],
      default: 'staff',
    },
    ratePerNight: { type: Number, required: true, min: 0 },
    nights: { type: Number, required: true, min: 1 },
    roomTotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    specialRequests: { type: String, maxlength: 1000 },
    requestId: { type: String, trim: true, maxlength: 80, unique: true, sparse: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actualCheckIn: Date,
    actualCheckOut: Date,
    cancellationReason: { type: String, maxlength: 500 },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function calculateTotals() {
  if (this.checkIn && this.checkOut) {
    this.nights = nightsBetween(this.checkIn, this.checkOut);
    if (this.ratePerNight != null) {
      this.roomTotal = Math.round(this.ratePerNight * this.nights * 100) / 100;
      this.taxAmount =
        Math.round(this.roomTotal * ((this.taxRate || 0) / 100) * 100) / 100;
      this.totalAmount = Math.round((this.roomTotal + this.taxAmount) * 100) / 100;
    }
  }
});

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
