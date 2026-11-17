import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) token = header.slice(7);

  if (!token) throw new ApiError(401, 'Please sign in to continue.');

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError(401, 'This account no longer exists.');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');

  req.user = user;
  next();
});

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Please sign in to continue.'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };

export const STAFF_ROLES = ['admin', 'manager', 'receptionist', 'housekeeping'];
