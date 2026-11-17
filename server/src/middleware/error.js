import { ApiError } from '../utils/ApiError.js';
import { env, isProduction } from '../config/env.js';

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err.name === 'ZodError') {
    statusCode = 422;
    message = 'Validation failed';
    details = err.issues?.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    message = `A record with that ${field} already exists.`;
  } else if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    message,
    ...(details ? { details } : {}),
    ...(!isProduction && statusCode >= 500 ? { stack: err.stack } : {}),
  });
};

export const notFoundHandler = notFound;

/** Wrap async route handlers (Express 5 handles this, kept for clarity). */
export const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export { env };
