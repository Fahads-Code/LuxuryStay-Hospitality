import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FilePlus2,
  FilterX,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  currency,
  formatDate,
  statusLabel,
} from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  Spinner,
  StatCard,
  Tabs,
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

const STATUS_TABS = [
  { key: '', label: 'All folios' },
  { key: 'unpaid,partial', label: 'Outstanding' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'partial', label: 'Part paid' },
  { key: 'paid', label: 'Paid' },
  { key: 'void', label: 'Void' },
];

const CreateFolioModal = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected('');
    api
      .get('/bookings', { params: { status: 'checked_in,checked_out', limit: 100 } })
      .then(({ data }) => setBookings(data.bookings))
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!selected) {
      toast.error('Choose a reservation to bill.');
      return;
    }
    const booking = bookings.find((item) => item._id === selected);
    const existingId = booking?.invoice?._id || booking?.invoice;
    if (existingId) {
      onClose();
      navigate(`/app/billing/${existingId}`);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/invoices', { bookingId: selected });
      toast.success(`Folio ${data.invoice.number} is ready.`);
      onCreated?.(data.invoice);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const selectedBooking = bookings.find((item) => item._id === selected);
  const selectedHasFolio = Boolean(selectedBooking?.invoice);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create or open a folio"
      subtitle="Build a folio from a stay, or open the existing folio if one is already created."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={FilePlus2} disabled={!selected}>
            {selectedHasFolio ? 'Open folio' : 'Create folio'}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner label="Loading stays…" />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No stays to bill"
          message="Check a guest in or out first, then create or open the folio here."
        />
      ) : (
        <div className="folio-picker">
          <p className="muted small">
            Select an in-house or departed stay. Stays with an existing folio can be opened directly.
          </p>
          {bookings.map((booking) => {
            const guestName = `${booking.guest?.firstName || ''} ${booking.guest?.lastName || ''}`.trim();
            const hasFolio = Boolean(booking.invoice);
            return (
              <button
                key={booking._id}
                type="button"
                className={`folio-pick ${selected === booking._id ? 'selected' : ''}`}
                onClick={() => setSelected(booking._id)}
              >
                <Avatar name={guestName} size="xs" />
                <span>
                  <strong>{guestName || 'Guest'}</strong>
                  <em>
                    {booking.reference} · Room {booking.room?.number || '—'} ·{' '}
                    {formatDate(booking.checkIn, { year: undefined })}–{formatDate(booking.checkOut, { year: undefined })}
                  </em>
                </span>
                <span className="folio-pick-meta">
                  <Badge status={booking.status} tone="auto" />
                  {hasFolio && <em className="muted small">Folio exists · click to open</em>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

const QuickPaymentModal = ({ open, invoice, onClose, onSaved }) => {
  const toast = useToast();
  const balance = Math.max(0, (invoice?.total || 0) - (invoice?.amountPaid || 0));
  const [form, setForm] = useState({ amount: balance, method: 'credit_card' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    const due = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));
    setForm({ amount: due, method: invoice.paymentMethod || 'credit_card' });
  }, [open, invoice]);

  const submit = async (event) => {
    event.preventDefault();
    if (!invoice) return;
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

  const guestName = `${invoice?.guest?.firstName || ''} ${invoice?.guest?.lastName || ''}`.trim() || 'Guest';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      subtitle={invoice ? `${invoice.number} · ${guestName} · Balance ${currency(balance)}` : ''}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Banknote} disabled={!invoice || balance <= 0}>
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
            max={balance || undefined}
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            required
          />
        </Field>
        <Field label="Payment method">
          <Select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
};

const BillingPage = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState(params.get('status') || 'unpaid,partial');
  const [query, setQuery] = useState(params.get('q') || '');
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ invoices: [], summary: null, pagination: null });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const { data: response } = await api.get('/invoices', {
        params: {
          page,
          limit: 20,
          ...(status ? { status } : {}),
          ...(query ? { q: query } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      });
      setData(response);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, from, to]);

  useLiveRefresh(load);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (query) next.set('q', query);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query, from, to]);

  const summary = data.summary || { billed: 0, collected: 0, outstanding: 0 };
  const filtersActive = Boolean(status || query || from || to);

  const stats = useMemo(
    () => [
      { label: 'Total billed', value: currency(summary.billed), hint: 'All live folios', icon: ReceiptText, tone: 'ink' },
      { label: 'Collected', value: currency(summary.collected), hint: 'Payments received', icon: Wallet, tone: 'sage' },
      { label: 'Outstanding', value: currency(summary.outstanding), hint: 'Awaiting settlement', icon: CircleDollarSign, tone: 'terracotta' },
      { label: 'Folios in view', value: data.pagination?.total ?? '—', hint: filtersActive ? 'With current filters' : 'All time', icon: Banknote, tone: 'gold' },
    ],
    [summary, data.pagination, filtersActive]
  );

  const closeCreate = () => {
    setCreateOpen(false);
    if (params.get('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  };

  const clearFilters = () => {
    setStatus('');
    setQuery('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const outstandingOnPage = useMemo(
    () =>
      data.invoices.filter((invoice) => {
        const balance = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));
        return balance > 0 && !['paid', 'void'].includes(invoice.status);
      }).length,
    [data.invoices]
  );

  const statusLabelTab = STATUS_TABS.find((tab) => tab.key === status)?.label || 'All folios';

  return (
    <div className="page billing-page">
      <section className="billing-hero">
        <div className="billing-hero-main">
          <p className="eyebrow">Reception · Billing desk</p>
          <h1>Settle folios with confidence</h1>
          <p>
            Review outstanding balances, record payments, and open folios quickly from one workspace.
          </p>
          <div className="billing-hero-actions">
            <Button icon={FilePlus2} variant="gold" onClick={() => setCreateOpen(true)}>Create / open folio</Button>
            <Button variant="outline" onClick={() => { setStatus('unpaid,partial'); setPage(1); }}>
              Show outstanding
            </Button>
          </div>
        </div>
        <div className="billing-hero-metrics">
          <div className="billing-metric">
            <span>Outstanding</span>
            <strong>{currency(summary.outstanding)}</strong>
            <em>Needs settlement</em>
          </div>
          <div className="billing-metric">
            <span>Collected</span>
            <strong>{currency(summary.collected)}</strong>
            <em>Payments received</em>
          </div>
          <div className="billing-metric">
            <span>Total billed</span>
            <strong>{currency(summary.billed)}</strong>
            <em>Live folios</em>
          </div>
        </div>
      </section>

      <div className="billing-workspace">
        <aside className="billing-sidebar">
          <Card className="billing-focus-card">
            <CardHead title="Settlement focus" subtitle="Reception quick view" />
            <div className="billing-focus-list">
              <button type="button" className={`billing-focus-item ${status === 'unpaid,partial' ? 'active' : ''}`} onClick={() => { setStatus('unpaid,partial'); setPage(1); }}>
                <span><CircleDollarSign size={16} /> Outstanding folios</span>
                <strong>{currency(summary.outstanding)}</strong>
              </button>
              <button type="button" className={`billing-focus-item ${status === 'unpaid' ? 'active' : ''}`} onClick={() => { setStatus('unpaid'); setPage(1); }}>
                <span><ReceiptText size={16} /> Unpaid</span>
                <strong>View</strong>
              </button>
              <button type="button" className={`billing-focus-item ${status === 'partial' ? 'active' : ''}`} onClick={() => { setStatus('partial'); setPage(1); }}>
                <span><Wallet size={16} /> Part paid</span>
                <strong>View</strong>
              </button>
              <button type="button" className={`billing-focus-item ${status === 'paid' ? 'active' : ''}`} onClick={() => { setStatus('paid'); setPage(1); }}>
                <span><Banknote size={16} /> Settled</span>
                <strong>View</strong>
              </button>
            </div>
          </Card>

          <Card className="billing-note-card">
            <CardHead title="Desk tips" subtitle="For faster checkout" />
            <ul className="billing-tips">
              <li>Use <strong>Outstanding</strong> to see who still needs to pay.</li>
              <li>Click <strong>Pay</strong> on a row to record payment without leaving the list.</li>
              <li>Use <strong>Create / open folio</strong> for checked-in or checked-out stays.</li>
            </ul>
          </Card>
        </aside>

        <section className="billing-main">
          <Card className="billing-ledger-card">
            <div className="billing-ledger-head">
              <div>
                <p className="eyebrow">Folio ledger · {statusLabelTab}</p>
                <h2>Billing queue</h2>
                <p className="muted">
                  {outstandingOnPage > 0
                    ? `${outstandingOnPage} folio${outstandingOnPage === 1 ? '' : 's'} on this page need settlement.`
                    : 'Search, filter and settle folios quickly.'}
                </p>
              </div>
              <div className="billing-ledger-tools">
                <SearchInput value={query} onChange={setQuery} placeholder="Search folio, guest, room, email…" />
              </div>
            </div>

            <Tabs
              items={STATUS_TABS}
              value={status}
              onChange={(value) => { setStatus(value); setPage(1); }}
            />

            <div className="filter-bar billing-filter-bar">
              <label className="filter-field">
                <span>Issued from</span>
                <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
              </label>
              <label className="filter-field">
                <span>Issued to</span>
                <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
              </label>
              {filtersActive && (
                <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Clear filters</Button>
              )}
              <span className="filter-count">
                {data.pagination?.total ?? 0} folio{data.pagination?.total === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <PageLoader />
            ) : data.invoices.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No folios match"
                message="Try a different status, date range or search term."
                action={filtersActive ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : <Button variant="outline" onClick={() => { setStatus(''); setPage(1); }}>View all folios</Button>}
              />
            ) : (
              <div className="table-wrap billing-table-wrap">
                <table className="data-table invoices-table billing-ledger-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Guest</th>
                      <th>Reservation</th>
                      <th>Issued</th>
                      <th className="align-right">Total</th>
                      <th className="align-right">Paid</th>
                      <th className="align-right">Balance</th>
                      <th>Status</th>
                      <th className="align-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((invoice) => {
                      const guestName = `${invoice.guest?.firstName || ''} ${invoice.guest?.lastName || ''}`.trim() || 'Guest';
                      const balance = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));
                      const canPay = balance > 0 && !['paid', 'void'].includes(invoice.status);
                      return (
                        <tr key={invoice._id} className={canPay ? 'row-attention' : ''}>
                          <td>
                            <Link to={`/app/billing/${invoice._id}`} className="mono-link">
                              {invoice.number}
                            </Link>
                          </td>
                          <td>
                            <div className="table-person">
                              <Avatar name={guestName} size="xs" />
                              <div>
                                <strong>
                                  {guestName}
                                  {invoice.guest?.vip && <span className="vip-dot">VIP</span>}
                                </strong>
                                <span>{invoice.guest?.email || '—'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {invoice.booking ? (
                              <Link to={`/app/bookings/${invoice.booking._id}`} className="table-link">
                                {invoice.booking.reference}
                              </Link>
                            ) : '—'}
                            <span className="table-sub">
                              {invoice.booking?.room?.number ? `Room ${invoice.booking.room.number}` : 'No room'}
                              {invoice.booking?.status ? ` · ${statusLabel(invoice.booking.status)}` : ''}
                            </span>
                          </td>
                          <td>{formatDate(invoice.issuedAt)}</td>
                          <td className="align-right">{currency(invoice.total)}</td>
                          <td className="align-right">{currency(invoice.amountPaid)}</td>
                          <td className="align-right">
                            <strong className={balance > 0 ? 'text-terracotta' : 'text-sage'}>{currency(balance)}</strong>
                          </td>
                          <td>
                            <Badge tone={INVOICE_TONE[invoice.status] || 'neutral'}>{statusLabel(invoice.status)}</Badge>
                          </td>
                          <td className="align-right">
                            <div className="table-actions">
                              {canPay && (
                                <Button size="xs" variant="primary" icon={CreditCard} onClick={() => setPaymentInvoice(invoice)}>
                                  Pay
                                </Button>
                              )}
                              <Link to={`/app/billing/${invoice._id}`} className="icon-btn" aria-label="Open folio" title="Open folio">
                                <ArrowRight size={16} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {data.pagination && data.pagination.pages > 1 && (
              <div className="pagination">
                <span>
                  Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} total
                </span>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={data.pagination.page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.pagination.page >= data.pagination.pages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>

      <CreateFolioModal
        open={createOpen}
        onClose={closeCreate}
        onCreated={(invoice) => { window.location.assign(`/app/billing/${invoice._id}`); }}
      />

      <QuickPaymentModal
        open={Boolean(paymentInvoice)}
        invoice={paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        onSaved={() => load({ quiet: true })}
      />
    </div>
  );
};

export default BillingPage;
