import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    ratings: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      service: { type: Number, min: 1, max: 5 },
      comfort: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
    },
    title: { type: String, trim: true, maxlength: 120 },
    comments: { type: String, trim: true, maxlength: 2000 },
    response: {
      text: { type: String, trim: true, maxlength: 1000 },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model('Feedback', feedbackSchema);
