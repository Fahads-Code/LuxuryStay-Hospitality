export const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const endOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const addMonths = (value, months) => {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
};

export const daysBetween = (from, to) => {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b - a) / 86_400_000);
};

/** Nights between two dates, minimum 1. */
export const nightsBetween = (checkIn, checkOut) =>
  Math.max(1, daysBetween(checkIn, checkOut));

export const eachDay = (from, to) => {
  const days = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor < end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
};

export const monthKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (value) => {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const isoDay = (value) => new Date(value).toISOString().slice(0, 10);

export const isValidDate = (value) => !Number.isNaN(new Date(value).getTime());
