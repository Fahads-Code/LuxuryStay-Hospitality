import { z } from 'zod';
import { Setting } from '../models/Setting.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, email } from '../utils/validation.js';
import { getSettings } from '../services/settingsService.js';

const settingsSchema = z
  .object({
    hotelName: z.string().trim().min(2).max(100),
    tagline: z.string().trim().max(200),
    email,
    phone: z.string().trim().max(30),
    website: z.string().trim().max(100),
    address: z.object({
      street: z.string().trim().max(120).optional(),
      city: z.string().trim().max(80).optional(),
      state: z.string().trim().max(80).optional(),
      postalCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(80).optional(),
    }),
    currency: z.string().trim().min(3).max(3),
    taxRate: z.coerce.number().min(0).max(50),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    policies: z.object({
      cancellation: z.string().trim().max(1000).optional(),
      children: z.string().trim().max(500).optional(),
      pets: z.string().trim().max(500).optional(),
      smoking: z.string().trim().max(500).optional(),
    }),
    serviceMenu: z
      .array(
        z.object({
          type: z.string().trim().min(2).max(40),
          label: z.string().trim().min(2).max(60),
          price: z.coerce.number().min(0),
          description: z.string().trim().max(200).optional(),
        })
      )
      .max(30),
  })
  .partial();

export const getSettingsHandler = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const data = parse(settingsSchema, req.body);
  const settings = await getSettings();
  Object.assign(settings, data);
  if (data.address) {
    settings.address = {
      ...(settings.address.toObject?.() ?? settings.address),
      ...data.address,
    };
  }
  if (data.policies) {
    settings.policies = {
      ...(settings.policies.toObject?.() ?? settings.policies),
      ...data.policies,
    };
  }
  settings.updatedBy = req.user._id;
  await settings.save();
  res.json({ settings });
});
