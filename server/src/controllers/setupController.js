import { z } from 'zod';
import { User } from '../models/User.js';
import { Setting } from '../models/Setting.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse, email, nonEmptyString } from '../utils/validation.js';
import { signToken } from '../middleware/auth.js';

/**
 * First-run setup. Until the first administrator account exists, the public
 * setup endpoints are available so the hotel owner can create their own login.
 * Once a user exists, both endpoints are locked.
 */

export const getSetupStatus = asyncHandler(async (req, res) => {
  const userCount = await User.estimatedDocumentCount();
  res.json({ needsSetup: userCount === 0 });
});

const setupSchema = z.object({
  hotelName: z.string().trim().min(2, 'Hotel name must be at least 2 characters').max(100),
  name: nonEmptyString(80),
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Use at least one letter')
    .regex(/\d/, 'Use at least one number'),
});

export const createInitialAdmin = asyncHandler(async (req, res) => {
  if ((await User.estimatedDocumentCount()) > 0) {
    throw new ApiError(403, 'Setup has already been completed. Please sign in instead.');
  }

  const data = parse(setupSchema, req.body);

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    role: 'admin',
    jobTitle: 'Owner / Administrator',
  });

  await Setting.findOneAndUpdate(
    { key: 'global' },
    { $set: { hotelName: data.hotelName } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});
