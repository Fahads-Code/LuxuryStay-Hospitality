import { z } from 'zod';
import { Feedback } from '../models/Feedback.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, paginationSchema } from '../utils/validation.js';

const responseSchema = z.object({
  text: z.string().trim().min(2).max(1000),
});

export const listFeedback = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = {};
  if (req.query.rating) filter['ratings.overall'] = Number(req.query.rating);
  if (req.query.published === 'true') filter.isPublished = true;
  if (req.query.published === 'false') filter.isPublished = false;

  const [feedback, total, summary] = await Promise.all([
    Feedback.find(filter)
      .populate('guest', 'firstName lastName email vip')
      .populate('booking', 'reference checkIn checkOut room')
      .populate('response.by', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Feedback.countDocuments(filter),
    Feedback.aggregate([
      {
        $group: {
          _id: null,
          overall: { $avg: '$ratings.overall' },
          cleanliness: { $avg: '$ratings.cleanliness' },
          service: { $avg: '$ratings.service' },
          comfort: { $avg: '$ratings.comfort' },
          value: { $avg: '$ratings.value' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const stats = summary[0] || {
    overall: 0,
    cleanliness: 0,
    service: 0,
    comfort: 0,
    value: 0,
    count: 0,
  };
  res.json({
    feedback,
    summary: {
      ...stats,
      overall: Math.round((stats.overall || 0) * 10) / 10,
      cleanliness: Math.round((stats.cleanliness || 0) * 10) / 10,
      service: Math.round((stats.service || 0) * 10) / 10,
      comfort: Math.round((stats.comfort || 0) * 10) / 10,
      value: Math.round((stats.value || 0) * 10) / 10,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const respondToFeedback = asyncHandler(async (req, res) => {
  const { text } = parse(responseSchema, req.body);
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) throw new ApiError(404, 'Feedback not found.');

  feedback.response = { text, by: req.user._id, at: new Date() };
  await feedback.save();
  await feedback.populate([
    { path: 'guest', select: 'firstName lastName' },
    { path: 'response.by', select: 'name' },
  ]);
  res.json({ feedback });
});

export const publishFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) throw new ApiError(404, 'Feedback not found.');
  feedback.isPublished = req.body?.isPublished ?? !feedback.isPublished;
  await feedback.save();
  res.json({ feedback });
});
