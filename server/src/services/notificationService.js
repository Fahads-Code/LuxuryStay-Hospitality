import { Notification } from '../models/Notification.js';

const STAFF_AUDIENCE = ['admin', 'manager', 'receptionist'];

/**
 * Staff screens live under "/app", so normalise stored links to match the
 * client routes. Guest-only links (public pages) are left untouched.
 */
const resolveLink = (link = '', audience = STAFF_AUDIENCE) => {
  const value = String(link || '').trim();
  if (!value || /^https?:\/\//i.test(value)) return value;
  const guestOnly =
    Array.isArray(audience) &&
    audience.length > 0 &&
    audience.every((role) => role === 'guest');
  if (guestOnly) return value;
  if (value === '/app' || value.startsWith('/app/')) return value;
  return `/app${value.startsWith('/') ? value : `/${value}`}`;
};

/**
 * Creates an in-app notification. Never throws into the request path.
 */
export const notify = async ({
  title,
  message = '',
  type = 'system',
  audience = STAFF_AUDIENCE,
  link = '',
  createdBy,
}) => {
  try {
    await Notification.create({
      title,
      message,
      type,
      audience,
      link: resolveLink(link, audience),
      createdBy,
    });
  } catch (error) {
    console.error('[notification]', error.message);
  }
};

export const notifyGuest = async (options) =>
  notify({ ...options, audience: ['guest'] });
