import rateLimit from 'express-rate-limit';

const standardOptions = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again shortly.' },
};

export const authLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  limit: 30,
});

export const publicWriteLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  limit: 30,
});

export const apiLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 600,
});
