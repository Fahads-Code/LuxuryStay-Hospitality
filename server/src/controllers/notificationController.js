import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/ApiError.js';

const isMarkedBy = (list, userId) => list?.some((id) => String(id) === String(userId)) || false;

export const listNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter = { audience: req.user.role };
  if (req.query.unread === 'true') filter.readBy = { $ne: req.user._id };

  const [notifications, unread, unseen] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ audience: req.user.role, readBy: { $ne: req.user._id } }),
    Notification.countDocuments({ audience: req.user.role, seenBy: { $ne: req.user._id } }),
  ]);

  res.json({
    notifications: notifications.map((item) => ({
      ...item,
      isRead: isMarkedBy(item.readBy, req.user._id),
      isSeen: isMarkedBy(item.seenBy, req.user._id),
    })),
    unread,
    unseen,
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { readBy: req.user._id, seenBy: req.user._id } },
    { new: true }
  );
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found.' });
  }
  res.json({ notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { audience: req.user.role },
    { $addToSet: { readBy: req.user._id, seenBy: req.user._id } }
  );
  res.json({ message: 'All notifications marked as read.' });
});

/**
 * Marks the bell as viewed without clearing the per-item read dots.
 * The badge count (unseen) resets; each item keeps its unread state.
 */
export const markNotificationsSeen = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { audience: req.user.role },
    { $addToSet: { seenBy: req.user._id } }
  );
  res.json({ message: 'Notifications marked as seen.' });
});
