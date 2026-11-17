export const currency = (value, code = 'USD', maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code || 'USD',
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(Number(value) || 0);

export const compactCurrency = (value, code = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code || 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);

export const formatDate = (value, options = {}) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
};

export const formatDateLong = (value) =>
  formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatTime = (value) => {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    return new Date(2020, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const todayISO = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

export const addDaysISO = (iso, days) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000));
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'LS';

export const titleCase = (value = '') =>
  String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const statusLabel = (status) => {
  const labels = {
    checked_in: 'In house',
    checked_out: 'Checked out',
    no_show: 'No show',
    out_of_order: 'Out of order',
    in_progress: 'In progress',
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    available: 'Available',
    occupied: 'Occupied',
    dirty: 'Dirty',
    cleaning: 'Cleaning',
    maintenance: 'Maintenance',
    unpaid: 'Unpaid',
    partial: 'Part paid',
    paid: 'Paid',
    void: 'Void',
    open: 'Open',
    resolved: 'Resolved',
  };
  return labels[status] || titleCase(status);
};

export const roleLabel = (role) => {
  const labels = {
    admin: 'Administrator',
    manager: 'Manager',
    receptionist: 'Receptionist',
    housekeeping: 'Housekeeping',
    guest: 'Guest',
  };
  return labels[role] || titleCase(role);
};

export const roomStatusTone = {
  available: 'sage',
  occupied: 'ink',
  dirty: 'terracotta',
  cleaning: 'blue',
  maintenance: 'amber',
  out_of_order: 'red',
};

export const bookingStatusTone = {
  pending: 'amber',
  confirmed: 'blue',
  checked_in: 'sage',
  checked_out: 'neutral',
  cancelled: 'red',
  no_show: 'terracotta',
};

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
