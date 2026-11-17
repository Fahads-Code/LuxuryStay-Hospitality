import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'manager', 'receptionist', 'housekeeping', 'guest'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'receptionist', index: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    guestProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    jobTitle: this.jobTitle,
    isActive: this.isActive,
    guestProfile: this.guestProfile,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
