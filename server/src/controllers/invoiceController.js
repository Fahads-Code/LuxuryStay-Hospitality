import { z } from 'zod';
import { Invoice } from '../models/Invoice.js';
import { Booking } from '../models/Booking.js';
import { Guest } from '../models/Guest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/ApiError.js';
import { parse, objectId, paginationSchema } from '../utils/validation.js';
import { buildInvoiceForBooking, getInvoiceOrThrow } from '../services/invoiceService.js';
import { notify } from '../services/notificationService.js';

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  category: z
    .enum(['room', 'service', 'minibar', 'restaurant', 'laundry', 'other'])
    .optional(),
});

const createSchema = z.object({
  bookingId: objectId,
  discount: z.coerce.number().min(0).optional(),
  extraItems: z.array(lineItemSchema).max(20).optional(),
});

const addItemsSchema = z.object({
  items: z.array(lineItemSchema).min(1).max(20),
});

const paySchema = z.object({
  amount: z.coerce.number().positive(),
  method: z
    .enum(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'online', 'other'])
    .optional(),
});

export const listInvoices = asyncHandler(async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const { q, status, from, to } = req.query;
  const filter = {};

  if (status) {
    const statuses = String(status)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses.length === 1) filter.status = statuses[0];
    else if (statuses.length > 1) filter.status = { $in: statuses };
  }
  if (from || to) {
    filter.issuedAt = {};
    if (from) filter.issuedAt.$gte = new Date(from);
    if (to) filter.issuedAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  if (q) {
    const guests = await Guest.find({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    }).select('_id');
    filter.$or = [
      { number: { $regex: q, $options: 'i' } },
      { guest: { $in: guests.map((g) => g._id) } },
    ];
  }

  const [invoices, total, summary] = await Promise.all([
    Invoice.find(filter)
      .populate('guest', 'firstName lastName email vip')
      .populate({
        path: 'booking',
        select: 'reference checkIn checkOut room status',
        populate: { path: 'room', select: 'number' },
      })
      .sort({ issuedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: { status: { $ne: 'void' } } },
      {
        $group: {
          _id: null,
          billed: { $sum: '$total' },
          collected: { $sum: '$amountPaid' },
          outstanding: { $sum: { $subtract: ['$total', '$amountPaid'] } },
        },
      },
    ]),
  ]);

  res.json({
    invoices,
    summary: summary[0] || { billed: 0, collected: 0, outstanding: 0 },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await getInvoiceOrThrow(req.params.id);
  res.json({ invoice });
});

export const createInvoice = asyncHandler(async (req, res) => {
  const data = parse(createSchema, req.body);
  const booking = await Booking.findById(data.bookingId)
    .populate('room', 'number floor')
    .populate('guest', 'firstName lastName email')
    .populate('invoice');

  if (!booking) throw new ApiError(404, 'Reservation not found.');
  if (booking.invoice) {
    const existing = await getInvoiceOrThrow(booking.invoice._id || booking.invoice);
    return res.status(200).json({ invoice: existing });
  }

  const invoice = await buildInvoiceForBooking(booking, {
    user: req.user,
    discount: data.discount || 0,
    extraItems: data.extraItems || [],
  });

  res.status(201).json({ invoice: await getInvoiceOrThrow(invoice._id) });
});

export const addInvoiceItems = asyncHandler(async (req, res) => {
  const { items } = parse(addItemsSchema, req.body);
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  if (['paid', 'void'].includes(invoice.status)) {
    throw new ApiError(409, 'Items cannot be added to a paid or voided invoice.');
  }

  invoice.lineItems.push(...items);
  await invoice.save();

  const populated = await getInvoiceOrThrow(invoice._id);
  res.json({ invoice: populated });
});

export const payInvoice = asyncHandler(async (req, res) => {
  const { amount, method } = parse(paySchema, req.body);
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  if (invoice.status === 'void') throw new ApiError(409, 'This invoice has been voided.');
  if (invoice.status === 'paid') throw new ApiError(409, 'This invoice is already paid.');

  const balance = Math.round((invoice.total - invoice.amountPaid) * 100) / 100;
  if (amount > balance + 0.001) {
    throw new ApiError(422, `Payment exceeds the outstanding balance of ${balance.toFixed(2)}.`);
  }

  invoice.amountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100;
  if (method) invoice.paymentMethod = method;
  if (invoice.amountPaid >= invoice.total) invoice.paidAt = new Date();
  await invoice.save();

  if (invoice.status === 'paid') {
    await notify({
      title: 'Invoice paid',
      message: `${invoice.number} was settled (${invoice.paymentMethod.replaceAll('_', ' ')}).`,
      type: 'billing',
      audience: ['admin', 'manager', 'receptionist'],
      link: `/billing/${invoice._id}`,
      createdBy: req.user._id,
    });
  }

  const populated = await getInvoiceOrThrow(invoice._id);
  res.json({ invoice: populated });
});

export const voidInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  if (invoice.status === 'void') throw new ApiError(409, 'Invoice is already void.');
  if (invoice.amountPaid > 0) {
    throw new ApiError(409, 'Refund payments before voiding this invoice.');
  }
  invoice.status = 'void';
  invoice.notes = `${invoice.notes || ''}\nVoided by ${req.user.name}`.trim();
  await invoice.save();
  res.json({ invoice: await getInvoiceOrThrow(invoice._id) });
});
