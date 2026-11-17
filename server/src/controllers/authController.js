import { z } from 'zod';
import { User, ROLES } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, email, nonEmptyString } from '../utils/validation.js';
import { signToken } from '../middleware/auth.js';
import { notify } from '../services/notificationService.js';

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const login = asyncHandler(async (req, res) => {
  const { email: loginEmail, password } = parse(loginSchema, req.body);

  const user = await User.findOne({ email: loginEmail }).select('+password');
  if (!user) throw new ApiError(401, 'Incorrect email or password.');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');

  const matches = await user.comparePassword(password);
  if (!matches) throw new ApiError(401, 'Incorrect email or password.');

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  await notify({
    title: 'Staff sign-in',
    message: `${user.name} signed in.`,
    type: 'system',
    audience: ['admin'],
    createdBy: user._id,
  });

  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate(
    'guestProfile',
    'firstName lastName email phone preferences vip address'
  );
  res.json({ user: user.toSafeJSON(), guestProfile: user.guestProfile || null });
});

export const logout = asyncHandler(async (req, res) => {
  res.json({ message: 'Signed out successfully.' });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Use at least one letter')
    .regex(/\d/, 'Use at least one number'),
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = parse(passwordSchema, req.body);
  const user = await User.findById(req.user._id).select('+password');
  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw new ApiError(400, 'Your current password is incorrect.');
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated.' });
});

const registerGuestSchema = z.object({
  name: nonEmptyString(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().trim().max(30).optional(),
});

/**
 * Self-service guest registration. Links to an existing guest profile with the
 * same email when one exists, otherwise creates a minimal profile.
 */
export const registerGuest = asyncHandler(async (req, res) => {
  const data = parse(registerGuestSchema, req.body);
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  let guest = await Guest.findOne({ email: data.email });
  if (!guest) {
    const [firstName, ...rest] = data.name.trim().split(/\s+/);
    guest = await Guest.create({
      firstName,
      lastName: rest.join(' ') || 'Guest',
      email: data.email,
      phone: data.phone,
    });
  }

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    role: 'guest',
    guestProfile: guest._id,
  });

  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});

export const roles = asyncHandler(async (req, res) => {
  res.json({ roles: ROLES });
});
