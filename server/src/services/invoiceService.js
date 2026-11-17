import { Invoice } from '../models/Invoice.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { generateInvoiceNumber } from './bookingService.js';
import { getSettings } from './settingsService.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Builds (or returns) the folio for a booking, including room and posted services.
 */
export const buildInvoiceForBooking = async (booking, { user, discount = 0, extraItems = [] } = {}) => {
  if (booking.invoice) {
    const existing = await Invoice.findById(booking.invoice._id || booking.invoice);
    if (existing) return existing;
  }

  const settings = await getSettings();
  const ratePerNight = booking.ratePerNight;
  const lineItems = [
    {
      description: `Room ${booking.room?.number || ''} — ${booking.nights} night${
        booking.nights > 1 ? 's' : ''
      } @ ${ratePerNight.toFixed(2)}`,
      category: 'room',
      quantity: booking.nights,
      unitPrice: ratePerNight,
    },
  ];

  const services = await ServiceRequest.find({
    booking: booking._id,
    status: { $in: ['completed', 'in_progress', 'pending'] },
    amount: { $gt: 0 },
  }).lean();

  for (const service of services) {
    lineItems.push({
      description: service.description || service.type.replaceAll('_', ' '),
      category: 'service',
      quantity: service.quantity || 1,
      unitPrice: service.amount / (service.quantity || 1),
    });
  }

  for (const item of extraItems) {
    lineItems.push({ ...item, category: item.category || 'other' });
  }

  const invoice = await Invoice.create({
    number: generateInvoiceNumber(),
    booking: booking._id,
    guest: booking.guest,
    lineItems,
    discount,
    taxRate: settings.taxRate,
    issuedBy: user?._id,
    dueAt: new Date(),
    notes: `Folio for reservation ${booking.reference}`,
  });

  booking.invoice = invoice._id;
  await booking.save();
  return invoice;
};

export const getInvoiceOrThrow = async (id) => {
  const invoice = await Invoice.findById(id)
    .populate('guest', 'firstName lastName email phone vip')
    .populate({
      path: 'booking',
      select: 'reference checkIn checkOut nights room source status',
      populate: { path: 'room', select: 'number floor type' },
    });
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  return invoice;
};
