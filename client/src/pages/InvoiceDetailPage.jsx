import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  BedDouble,
  CalendarDays,
  CreditCard,
  Mail,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  UserRound,
  XCircle,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  currency,
  formatDate,
  formatDateTime,
  statusLabel,
} from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Select,
} from '../components/ui.jsx';

const INVOICE_TONE = {
  unpaid: 'amber',
  partial: 'blue',
  paid: 'sage',
  void: 'red',
};

const PAYMENT_METHODS = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'online', label: 'Online payment' },
  { value: 'other', label: 'Other' },
];

const CATEGORIES = [
  { value: 'service', label: 'Guest service' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'room', label: 'Room charge' },
  { value: 'other', label: 'Other' },
];

const AddItemModal = ({ open, onClose, invoice, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    description: '',
    quantity: 1,
    unitPrice: '',
    category: 'service',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ description: '', quantity: 1, unitPrice: '', category: 'service' });
  }, [open]);

  const amount = (Number(form.quantity) || 0) * (Number(form.unitPrice) || 0);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/invoices/${invoice._id}/items`, {
        items: [
          {
            description: form.description.trim(),
            quantity: Number(form.quantity) || 1,
            unitPrice: Number(form.unitPrice) || 0,
            category: form.category,
          },
        ],
      });
      toast.success('Charge posted to the folio.');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post a charge"
      subtitle="Add an incidental or service charge to this folio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Plus}>Post charge</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Description" required>
          <Input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="e.g. Minibar — sparkling water"
            required
          />
        </Field>
        <div className="form-row">
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" required>
            <Input
              type="number"
              min="1"
              max="99"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              required
            />
          </Field>
          <Field label="Unit price" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.unitPrice}
              onChange={(event) => setForm({ ...form, unitPrice: event.target.value })}
              required
            />
          </Field>
        </div>
        <div className="inline-note">
          <ReceiptText size={15} />
          <span>Charge amount: <strong>{currency(amount)}</strong></span>
        </div>
      </form>
    </Modal>
  );
};

const PaymentModal = ({ open, onClose, invoice, onSaved }) => {
  const toast = useToast();
  const balance = Math.max(0, (invoice?.total || 0) - (invoice?.amountPaid || 0));
  const [form, setForm] = useState({ amount: balance, method: 'credit_card' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setForm({ amount: balance, method: invoice.paymentMethod || 'credit_card' });
  }, [open, invoice, balance]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/invoices/${invoice._id}/pay`, {
        amount: Number(form.amount),
        method: form.method,
      });
      toast.success('Payment recorded.');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      subtitle={`Outstanding balance: ${currency(balance)}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Banknote} disabled={!balance}>
            Record payment
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Amount" required>
          <Input
            type="number"
            min="0.01"
            max={balance}
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            required
          />
        </Field>
        <Field label="Payment method">
          <Select
            value={form.method}
            onChange={(event) => setForm({ ...form, method: event.target.value })}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
};

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemOpen, setItemOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [invoiceRes, settingsRes] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get('/settings'),
      ]);
      setData(invoiceRes.data.invoice);
      setSettings(settingsRes.data.settings);
    } catch (error) {
      if (!quiet) {
        toast.error(errorMessage(error));
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useLiveRefresh(load);

  const invoice = data;
  const currencyCode = settings?.currency;

  const totals = useMemo(() => {
    if (!invoice) return { balance: 0, amountPaid: 0 };
    const balance = Math.max(
      0,
      invoice.balance ?? (invoice.total || 0) - (invoice.amountPaid || 0)
    );
    return { balance, amountPaid: invoice.amountPaid || 0 };
  }, [invoice]);

  const voidInvoice = async () => {
    setVoiding(true);
    try {
      await api.post(`/invoices/${invoice._id}/void`);
      toast.success('Folio voided.');
      setVoidOpen(false);
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!invoice) {
    return (
      <div className="page">
        <PageHeader eyebrow="Billing & folios" title="Folio not found" subtitle="This invoice may have been removed." />
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="We could not find that folio"
            message="Return to billing to find the invoice you need."
            action={<Link to="/app/billing" className="btn btn-primary">Back to billing</Link>}
          />
        </Card>
      </div>
    );
  }

  const guest = invoice.guest;
  const guestName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || 'Guest';
  const booking = invoice.booking;
  const canEdit = !['paid', 'void'].includes(invoice.status);
  const canVoid = invoice.status !== 'void' && totals.amountPaid === 0;

  return (
    <div className="page detail-page invoice-page">
      <div className="detail-topbar no-print">
        <Link to="/app/billing" className="back-link">
          <ArrowLeft size={15} /> All folios
        </Link>
        <div className="detail-topbar-actions">
          <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>
            Print folio
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" icon={Plus} onClick={() => setItemOpen(true)}>
                Post charge
              </Button>
              <Button size="sm" icon={Banknote} onClick={() => setPaymentOpen(true)}>
                Record payment
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="invoice-document">
        <PageHeader
          eyebrow={`Folio ${invoice.number}`}
          title={guestName}
          subtitle={`Issued ${formatDate(invoice.issuedAt)}${booking?.reference ? ` · Reservation ${booking.reference}` : ''}`}
          actions={<Badge tone={INVOICE_TONE[invoice.status] || 'neutral'}>{statusLabel(invoice.status)}</Badge>}
        />

        <div className="detail-grid">
          <div className="detail-main">
            <Card>
              <CardHead
                title="Charges"
                subtitle={`${invoice.lineItems?.length || 0} line item${invoice.lineItems?.length === 1 ? '' : 's'} on this folio`}
              />
              {invoice.lineItems?.length ? (
                <div className="table-wrap">
                  <table className="data-table invoice-items">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th className="align-right">Qty</th>
                        <th className="align-right">Unit</th>
                        <th className="align-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item) => (
                        <tr key={item._id || `${item.description}-${item.amount}`}>
                          <td><strong>{item.description}</strong></td>
                          <td><span className="invoice-item-category">{statusLabel(item.category)}</span></td>
                          <td className="align-right">{item.quantity}</td>
                          <td className="align-right">{currency(item.unitPrice, currencyCode, 2)}</td>
                          <td className="align-right"><strong>{currency(item.amount, currencyCode, 2)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={ReceiptText} title="No charges posted" message="Post a charge to begin this folio." />
              )}

              <div className="invoice-totals">
                <span className="invoice-totals-label">Folio summary</span>
                <div className="charge-line">
                  <span>Subtotal</span>
                  <strong>{currency(invoice.subtotal, currencyCode, 2)}</strong>
                </div>
                {invoice.discount > 0 && (
                  <div className="charge-line">
                    <span>Discount</span>
                    <strong>− {currency(invoice.discount, currencyCode, 2)}</strong>
                  </div>
                )}
                <div className="charge-line">
                  <span>Tax ({invoice.taxRate}%)</span>
                  <strong>{currency(invoice.taxAmount, currencyCode, 2)}</strong>
                </div>
                <div className="charge-line total">
                  <span>Total</span>
                  <strong>{currency(invoice.total, currencyCode, 2)}</strong>
                </div>
                <div className="charge-line">
                  <span>Paid to date</span>
                  <strong className="text-sage">{currency(totals.amountPaid, currencyCode, 2)}</strong>
                </div>
                <div className="charge-line balance">
                  <span>Balance due</span>
                  <strong>{currency(totals.balance, currencyCode, 2)}</strong>
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="Settlement" subtitle="Payment details and folio notes" />
              <div className="simple-lines">
                <div className="simple-line">
                  <span><CreditCard size={14} /> Payment method</span>
                  <strong>{statusLabel(invoice.paymentMethod)}</strong>
                </div>
                <div className="simple-line">
                  <span><CalendarDays size={14} /> Issued</span>
                  <strong>{formatDateTime(invoice.issuedAt)}</strong>
                </div>
                <div className="simple-line">
                  <span><Banknote size={14} /> Paid at</span>
                  <strong>{invoice.paidAt ? formatDateTime(invoice.paidAt) : 'Not settled'}</strong>
                </div>
                <div className="simple-line">
                  <span><ReceiptText size={14} /> Status</span>
                  <strong>{statusLabel(invoice.status)}</strong>
                </div>
              </div>
              {invoice.notes && (
                <div className="note-panel subtle">
                  <ReceiptText size={16} />
                  <p>{invoice.notes}</p>
                </div>
              )}
            </Card>
          </div>

          <aside className="detail-side">
            <Card className="invoice-balance-card">
              <span className="eyebrow">Amount due</span>
              <strong className="invoice-balance">{currency(totals.balance, currencyCode, 2)}</strong>
              <Badge tone={INVOICE_TONE[invoice.status] || 'neutral'}>{statusLabel(invoice.status)}</Badge>
              <div className="invoice-balance-meta">
                <span>{currency(totals.amountPaid, currencyCode, 2)} paid</span>
                <span>of {currency(invoice.total, currencyCode, 2)}</span>
              </div>
              {canEdit && (
                <div className="action-stack invoice-actions">
                  <Button icon={Banknote} onClick={() => setPaymentOpen(true)}>Record payment</Button>
                  <Button variant="outline" icon={Plus} onClick={() => setItemOpen(true)}>Post a charge</Button>
                  <Button variant="ghost" icon={XCircle} onClick={() => setVoidOpen(true)} disabled={!canVoid}>
                    Void folio
                  </Button>
                  {!canVoid && (
                    <p className="action-note">Folios with payments cannot be voided. Refund the payment first.</p>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHead
                title="Reservation"
                subtitle={booking?.reference || 'Not linked to a stay'}
                action={
                  booking ? (
                    <Link to={`/app/bookings/${booking._id}`} className="text-link">Open</Link>
                  ) : null
                }
              />
              {booking ? (
                <div className="simple-lines">
                  <div className="simple-line">
                    <span><BedDouble size={14} /> Room</span>
                    <strong>{booking.room?.number ? `Room ${booking.room.number}` : '—'}</strong>
                  </div>
                  <div className="simple-line">
                    <span><CalendarDays size={14} /> Arrival</span>
                    <strong>{formatDate(booking.checkIn)}</strong>
                  </div>
                  <div className="simple-line">
                    <span><CalendarDays size={14} /> Departure</span>
                    <strong>{formatDate(booking.checkOut)}</strong>
                  </div>
                  <div className="simple-line">
                    <span>Nights</span>
                    <strong>{booking.nights}</strong>
                  </div>
                </div>
              ) : (
                <p className="muted small">This folio was created without a reservation.</p>
              )}
            </Card>

            <Card>
              <CardHead
                title="Guest"
                action={<Link to={`/app/guests?guest=${guest?._id}`} className="text-link">Profile</Link>}
              />
              <div className="invoice-guest">
                <Avatar name={guestName} size="md" tone={guest?.vip ? 'gold' : 'default'} />
                <div>
                  <strong>
                    {guestName}
                    {guest?.vip && <span className="vip-dot">VIP</span>}
                  </strong>
                  <span><Mail size={13} /> {guest?.email || 'No email'}</span>
                  <span><Phone size={13} /> {guest?.phone || 'No phone'}</span>
                </div>
              </div>
            </Card>

            <Card className="compact-card no-print">
              <CardHead title="Need to adjust the folio?" />
              <p className="muted small">
                Post incidental charges before settlement. Payments are applied immediately and
                update the folio balance.
              </p>
              <div className="simple-line">
                <span><UserRound size={14} /> Billed to</span>
                <strong className="truncate">{guestName}</strong>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <AddItemModal
        open={itemOpen}
        onClose={() => setItemOpen(false)}
        invoice={invoice}
        onSaved={() => load({ quiet: true })}
      />

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        invoice={invoice}
        onSaved={() => load({ quiet: true })}
      />

      <ConfirmDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={voidInvoice}
        title={`Void folio ${invoice.number}?`}
        message="The folio will be kept for the record but excluded from revenue reporting. This cannot be undone."
        confirmLabel="Void folio"
        loading={voiding}
      />
    </div>
  );
};

export default InvoiceDetailPage;
