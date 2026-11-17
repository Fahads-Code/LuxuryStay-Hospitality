import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
    category: {
      type: String,
      enum: ['room', 'service', 'minibar', 'restaurant', 'laundry', 'other'],
      default: 'other',
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'void'],
      default: 'unpaid',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'online', 'other'],
      default: 'credit_card',
    },
    notes: { type: String, maxlength: 1000 },
    issuedAt: { type: Date, default: Date.now },
    dueAt: Date,
    paidAt: Date,
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.pre('validate', function calculateInvoice() {
  let subtotal = 0;
  for (const item of this.lineItems || []) {
    item.amount = Math.round((item.quantity || 0) * (item.unitPrice || 0) * 100) / 100;
    subtotal += item.amount;
  }
  this.subtotal = Math.round(subtotal * 100) / 100;
  const taxable = Math.max(0, this.subtotal - (this.discount || 0));
  this.taxAmount = Math.round(taxable * ((this.taxRate || 0) / 100) * 100) / 100;
  this.total = Math.round((taxable + this.taxAmount) * 100) / 100;
  if (this.status !== 'void') {
    if (this.amountPaid >= this.total && this.total > 0) this.status = 'paid';
    else if (this.amountPaid > 0) this.status = 'partial';
    else this.status = 'unpaid';
  }
});

invoiceSchema.virtual('balance').get(function balance() {
  return Math.max(0, Math.round((this.total - this.amountPaid) * 100) / 100);
});

invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
