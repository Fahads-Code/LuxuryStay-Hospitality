import { z } from 'zod';
import { ApiError } from './ApiError.js';

/**
 * Parses data with a zod schema and turns validation failures into HTTP 422s.
 */
export const parse = (schema, data, message = 'Validation failed') => {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fieldErrors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
  throw new ApiError(422, message, fieldErrors);
};

export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const dateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

export const nonEmptyString = (max = 500) => z.string().trim().min(1).max(max);

export const email = z.string().trim().toLowerCase().email('Enter a valid email address');

export const phone = z
  .string()
  .trim()
  .min(6, 'Phone number is too short')
  .max(30, 'Phone number is too long');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
