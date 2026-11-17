import { z } from 'zod';
import { User, ROLES } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import {
  parse,
  email,
  nonEmptyString,
  objectId,
  paginationSchema,
} from '../utils/validation.js';

const baseUser = {
  name: nonEmptyString(80),
  email,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  jobTitle: z.string().trim().max(80).optional().or(z.literal('')),
  role: z.enum(ROLES),
  guestProfile: objectId.optional().nullable(),
};

const createSchema = z.object({
  ...baseUser,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const updateSchema = z.object({
  ...baseUser,
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
}).partial();

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const { q, role, roles, active } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }
  if (role && ROLES.includes(role)) filter.role = role;
  if (roles) {
    const requested = String(roles)
      .split(',')
      .map((value) => value.trim())
      .filter((value) => ROLES.includes(value));
    if (requested.length) filter.role = requested.length === 1 ? requested[0] : { $in: requested };
  }
  if (active === 'true' || active === 'false') filter.isActive = active === 'true';

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('guestProfile', 'firstName lastName email vip')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate(
    'guestProfile',
    'firstName lastName email phone vip'
  );
  if (!user) throw new ApiError(404, 'User not found.');
  res.json({ user });
});

export const createUser = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);

  if (data.role === 'admin' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only an administrator can create administrator accounts.');
  }
  if (data.role === 'guest') {
    if (!data.guestProfile) throw new ApiError(422, 'Link a guest profile for guest accounts.');
    const guest = await Guest.findById(data.guestProfile);
    if (!guest) throw new ApiError(404, 'Guest profile not found.');
  } else {
    data.guestProfile = undefined;
  }

  const user = await User.create(data);
  res.status(201).json({ user: user.toSafeJSON() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const data = parse(updateSchema, req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  if (user.role === 'admin' && data.role && data.role !== 'admin' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only an administrator can change administrator roles.');
  }
  if (data.role === 'admin' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only an administrator can grant administrator access.');
  }

  if (String(user._id) === String(req.user._id)) {
    if (data.isActive === false) throw new ApiError(400, 'You cannot deactivate your own account.');
    if (data.role && data.role !== user.role) {
      throw new ApiError(400, 'You cannot change your own role.');
    }
  }

  const losingAdmin =
    user.role === 'admin' &&
    user.isActive &&
    (data.role && data.role !== 'admin' ? true : data.isActive === false);
  if (losingAdmin) {
    const admins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
    if (admins === 0) throw new ApiError(400, 'At least one active administrator is required.');
  }

  if (data.role === 'guest' && data.guestProfile) {
    const guest = await Guest.findById(data.guestProfile);
    if (!guest) throw new ApiError(404, 'Guest profile not found.');
  }
  if (data.role && data.role !== 'guest') data.guestProfile = undefined;

  Object.assign(user, data);
  await user.save();
  res.json({ user: user.toSafeJSON() });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  if (user.role === 'admin' && user.isActive) {
    const admins = await User.countDocuments({
      role: 'admin',
      isActive: true,
      _id: { $ne: user._id },
    });
    if (admins === 0) throw new ApiError(400, 'At least one active administrator is required.');
  }

  user.isActive = false;
  await user.save({ validateBeforeSave: false });
  res.json({ message: `${user.name} has been deactivated.`, user: user.toSafeJSON() });
});
