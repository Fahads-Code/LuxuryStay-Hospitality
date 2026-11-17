import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ConciergeBell,
  CreditCard,
  KeyRound,
  Mail,
  MapPin,
  MessageSquareQuote,
  Phone,
  Plus,
  ReceiptText,
  Sparkles,
  Star,
  UserRound,
  Wrench,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  bookingStatusTone,
  currency,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatTime,
  statusLabel,
  todayISO,
} from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
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
  Rating,
  RatingInput,
  Select,
  Spinner,
  Textarea,
  Toggle,
} from '../components/ui.jsx';

const SERVICE_STATUS_TONE = {
  pending: 'amber',
  in_progress: 'blue',
  completed: 'sage',
  cancelled: 'red',
};

const INVOICE_TONE = {
  unpaid: 'amber',
  partial: 'blue',
  paid: 'sage',
  void: 'red',
};

const MAINTENANCE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'Heating & cooling' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'network', label: 'Wi-Fi & network' },
  { value: 'other', label: 'Something else' },
];

const ServiceModal = ({ open, onClose, menu, currencyCode, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    type: menu[0]?.type || 'room_service',
    description: menu[0]?.label || '',
    quantity: 1,
    scheduledFor: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = menu[0];
    setForm({
      type: first?.type || 'room_service',
      description: first?.label || '',
      quantity: 1,
      scheduledFor: '',
    });
  }, [open, menu]);

  const selected = menu.find((item) => item.type === form.type);
  const total = (selected?.price || 0) * (Number(form.quantity) || 1);

  const chooseType = (type) => {
    const item = menu.find((entry) => entry.type === type);
    setForm((current) => ({
      ...current,
      type,
      description: item?.label || current.description,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (form.type === 'wake_up_call' && !form.scheduledFor) {
      toast.error('Choose a time for your wake-up call.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/portal/services', {
        type: form.type,
        description: form.description,
        quantity: Number(form.quantity) || 1,
        scheduledFor: form.scheduledFor || undefined,
      });
      toast.success('Your request has been sent to the team.');
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
      title="Request a service"
      subtitle="The concierge team will take care of the rest."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={ConciergeBell}>Send request</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Service" required>
          <Select value={form.type} onChange={(event) => chooseType(event.target.value)} required>
            {menu.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}{item.price ? ` — ${currency(item.price, currencyCode)}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" hint={selected?.description || 'Anything the team should know?'}>
          <Textarea
            rows={2}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Preferred time, delivery details or special requests."
          />
        </Field>
        <div className="form-row">
          <Field label="Quantity">
            <Input
              type="number"
              min="1"
              max="10"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            />
          </Field>
          <Field label="When" hint="Optional, except for wake-up calls.">
            <Input
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
            />
          </Field>
        </div>
        <div className="inline-note">
          <Sparkles size={15} />
          <span>
            This will be added to your folio at <strong>{currency(total, currencyCode)}</strong>. The
            team will confirm delivery.
          </span>
        </div>
      </form>
    </Modal>
  );
};

const MaintenanceModal = ({ open, onClose, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({ issue: '', category: 'other', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ issue: '', category: 'other', priority: 'medium' });
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/portal/maintenance', form);
      toast.success('Maintenance has been notified. Thank you for telling us.');
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
      title="Report a maintenance issue"
      subtitle="Our team will attend as soon as possible."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Wrench}>Report issue</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="What is the issue?" required>
          <Textarea
            rows={3}
            value={form.issue}
            onChange={(event) => setForm({ ...form, issue: event.target.value })}
            placeholder="e.g. The air conditioning is not cooling."
            required
            minLength={3}
          />
        </Field>
        <div className="form-row">
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {MAINTENANCE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            >
              <option value="low">Low — when convenient</option>
              <option value="medium">Medium — today</option>
              <option value="high">High — as soon as possible</option>
              <option value="urgent">Urgent — safety concern</option>
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
};

const PaymentModal = ({ invoice, currencyCode, onClose, onPaid }) => {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const balance = invoice ? Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0)) : 0;

  useEffect(() => {
    if (invoice) setAmount(balance ? balance.toFixed(2) : '');
  }, [invoice, balance]);

  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error('Enter an amount to pay.');
      return;
    }
    if (value > balance + 0.001) {
      toast.error('The payment cannot exceed the outstanding balance.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/portal/invoices/${invoice._id}/pay`, { amount: value });
      toast.success('Payment received. Thank you.');
      onPaid?.();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      title={`Settle folio ${invoice?.number || ''}`}
      subtitle="Secure payment will be recorded against your stay."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={CreditCard}>Pay now</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="payment-summary">
          <div>
            <span>Outstanding balance</span>
            <strong>{currency(balance, currencyCode, 2)}</strong>
          </div>
          <p className="muted small">
            You can pay part of the balance now and settle the rest later.
          </p>
        </div>
        <Field label="Amount to pay" required>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            max={balance}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>
        {invoice?.lineItems?.length ? (
          <div className="simple-lines compact-lines">
            {invoice.lineItems.slice(0, 4).map((item) => (
              <div className="simple-line" key={item._id || item.description}>
                <span>{item.description}</span>
                <strong>{currency(item.amount, currencyCode, 2)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};

const FeedbackModal = ({ open, onClose, bookings, existingFeedback, onSaved }) => {
  const toast = useToast();
  const available = bookings.filter(
    (booking) => booking.status === 'checked_out' && !existingFeedback.has(String(booking._id))
  );
  const [bookingId, setBookingId] = useState('');
  const [ratings, setRatings] = useState({
    overall: 5,
    cleanliness: 5,
    service: 5,
    comfort: 5,
    value: 5,
  });
  const [form, setForm] = useState({ title: '', comments: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBookingId(available[0]?._id || '');
    setRatings({ overall: 5, cleanliness: 5, service: 5, comfort: 5, value: 5 });
    setForm({ title: '', comments: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!bookingId) {
      toast.error('Choose the stay you would like to review.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/portal/feedback', {
        bookingId,
        ratings,
        title: form.title,
        comments: form.comments,
      });
      toast.success('Thank you for sharing your experience.');
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
      title="Share your experience"
      subtitle="Your words help us make every stay more thoughtful."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Star} disabled={!available.length}>
            Submit feedback
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No stays awaiting feedback"
          message="You can review a stay once you have checked out."
        />
      ) : (
        <form className="form-grid" onSubmit={submit}>
          <Field label="Which stay?" required>
            <Select value={bookingId} onChange={(event) => setBookingId(event.target.value)} required>
              {available.map((booking) => (
                <option key={booking._id} value={booking._id}>
                  {booking.room?.number ? `Room ${booking.room.number} · ` : ''}
                  {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                </option>
              ))}
            </Select>
          </Field>
          <RatingInput
            label="Overall experience"
            value={ratings.overall}
            onChange={(value) => setRatings({ ...ratings, overall: value })}
          />
          <div className="form-row">
            <Field label="Cleanliness">
              <Select
                value={ratings.cleanliness}
                onChange={(event) => setRatings({ ...ratings, cleanliness: Number(event.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} / 5</option>
                ))}
              </Select>
            </Field>
            <Field label="Service">
              <Select
                value={ratings.service}
                onChange={(event) => setRatings({ ...ratings, service: Number(event.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} / 5</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Comfort">
              <Select
                value={ratings.comfort}
                onChange={(event) => setRatings({ ...ratings, comfort: Number(event.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} / 5</option>
                ))}
              </Select>
            </Field>
            <Field label="Value">
              <Select
                value={ratings.value}
                onChange={(event) => setRatings({ ...ratings, value: Number(event.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} / 5</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Headline">
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="A perfect escape"
              maxLength={120}
            />
          </Field>
          <Field label="Your comments">
            <Textarea
              rows={4}
              value={form.comments}
              onChange={(event) => setForm({ ...form, comments: event.target.value })}
              placeholder="What made your stay memorable?"
              maxLength={2000}
            />
          </Field>
        </form>
      )}
    </Modal>
  );
};

const ProfileModal = ({ open, onClose, profile, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    phone: '',
    nationality: '',
    preferences: '',
    marketingConsent: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setForm({
      phone: profile.phone || '',
      nationality: profile.nationality || '',
      preferences: (profile.preferences || []).join(', '),
      marketingConsent: Boolean(profile.marketingConsent),
    });
  }, [open, profile]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch('/portal/profile', {
        phone: form.phone,
        nationality: form.nationality,
        preferences: form.preferences
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        marketingConsent: form.marketingConsent,
      });
      toast.success('Your details have been updated.');
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
      title="Your details"
      subtitle="Keep your preferences current so we can look after you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save details</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <Field label="Phone number">
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              autoComplete="tel"
            />
          </Field>
          <Field label="Nationality">
            <Input
              value={form.nationality}
              onChange={(event) => setForm({ ...form, nationality: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Preferences" hint="Separate with commas — e.g. high floor, sparkling water.">
          <Input
            value={form.preferences}
            onChange={(event) => setForm({ ...form, preferences: event.target.value })}
          />
        </Field>
        <div className="toggles-row">
          <Toggle
            checked={form.marketingConsent}
            onChange={(value) => setForm({ ...form, marketingConsent: value })}
            label="Send me news and seasonal offers"
          />
        </div>
      </form>
    </Modal>
  );
};

const MyStayPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [stayRes, bookingsRes, profileRes] = await Promise.all([
        api.get('/portal/stay'),
        api.get('/portal/bookings'),
        api.get('/portal/profile'),
      ]);
      setData(stayRes.data);
      setBookings(bookingsRes.data.bookings || []);
      setProfile(profileRes.data.profile);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLiveRefresh(load);

  const currencyCode = data?.hotel?.currency || 'USD';
  const currentBooking = data?.currentBooking;
  const upcomingBooking = data?.upcomingBooking;
  const activeBooking = currentBooking || upcomingBooking;
  const menu = data?.serviceMenu || [];
  const invoices = data?.invoices || [];
  const services = data?.services || [];
  const feedback = data?.feedback || [];

  const feedbackBookingIds = useMemo(
    () => new Set(feedback.map((entry) => String(entry.booking?._id || entry.booking))),
    [feedback]
  );

  const eligibleFeedback = useMemo(
    () => bookings.filter((booking) => booking.status === 'checked_out' && !feedbackBookingIds.has(String(booking._id))),
    [bookings, feedbackBookingIds]
  );

  const openBalance = invoices.reduce(
    (sum, invoice) => sum + Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0)),
    0
  );

  const guestName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : user?.name || 'Guest';

  const canCancel = (booking) =>
    booking &&
    ['pending', 'confirmed'].includes(booking.status) &&
    new Date(booking.checkIn).toISOString().slice(0, 10) > todayISO();

  const cancelStay = async () => {
    if (!cancelBooking) return;
    setCancelling(true);
    try {
      await api.post(`/portal/bookings/${cancelBooking._id}/cancel`);
      toast.success('Your reservation has been cancelled.');
      setCancelBooking(null);
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!data) {
    return (
      <div className="page">
        <PageHeader eyebrow="Guest portal" title="My stay" subtitle="Your home away from home." />
        <Card>
          <EmptyState
            icon={KeyRound}
            title="We could not load your stay"
            message="Please refresh the page or contact the front desk for assistance."
            action={<Button onClick={() => load()}>Try again</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="page portal-page">
      <PageHeader
        eyebrow="Guest portal"
        title={`Welcome, ${guestName.split(' ')[0] || 'guest'}`}
        subtitle="Your stay, services and folios — all in one place."
        actions={
          <>
            <Button variant="outline" icon={UserRound} onClick={() => setProfileOpen(true)}>
              My details
            </Button>
            {eligibleFeedback.length > 0 && (
              <Button icon={Star} onClick={() => setFeedbackOpen(true)}>Review a stay</Button>
            )}
          </>
        }
      />

      <div className="portal-hero">
        <div className="portal-hero-copy">
          <p className="eyebrow">{data.hotel?.name || 'LuxuryStay Hospitality'}</p>
          {currentBooking ? (
            <>
              <h2>You are checked in</h2>
              <p>
                Room {currentBooking.room?.number || '—'} · {currentBooking.room?.type?.name || 'Your suite'} ·{' '}
                {currentBooking.nights} night{currentBooking.nights === 1 ? '' : 's'}
              </p>
              <div className="portal-hero-dates">
                <span><CalendarClock size={15} /> Arrival {formatDateLong(currentBooking.checkIn)}</span>
                <span><CalendarDays size={15} /> Departure {formatDateLong(currentBooking.checkOut)}</span>
              </div>
            </>
          ) : upcomingBooking ? (
            <>
              <h2>Your next stay awaits</h2>
              <p>
                {formatDateLong(upcomingBooking.checkIn)} – {formatDateLong(upcomingBooking.checkOut)} · Room{' '}
                {upcomingBooking.room?.number || '—'}
              </p>
              <div className="portal-hero-dates">
                <span><BedDouble size={15} /> {upcomingBooking.room?.type?.name || 'Room'} · {upcomingBooking.nights} nights</span>
                <span><KeyRound size={15} /> Check-in from {formatTime(data.hotel?.checkInTime || '15:00')}</span>
              </div>
            </>
          ) : (
            <>
              <h2>A quiet escape is waiting</h2>
              <p>There is no active stay on this account. Reserve your next visit with our team.</p>
              <div className="portal-hero-dates">
                <span><Phone size={15} /> {data.hotel?.phone || 'Call the front desk'}</span>
                <span><Mail size={15} /> {data.hotel?.email || 'Reservations'}</span>
              </div>
            </>
          )}
        </div>
        <div className="portal-hero-card">
          {activeBooking ? (
            <>
              <div className="portal-room-mark">
                <span>Room</span>
                <strong>{activeBooking.room?.number || '—'}</strong>
              </div>
              <Badge status={activeBooking.status} tone={bookingStatusTone[activeBooking.status] || 'auto'} />
              <p>{activeBooking.reference}</p>
              <div className="portal-room-facts">
                <span>Floor {activeBooking.room?.floor ?? '—'}</span>
                <span>{activeBooking.room?.view || 'City view'}</span>
                <span>{activeBooking.room?.type?.capacity || 2} guests</span>
              </div>
            </>
          ) : (
            <div className="portal-room-mark">
              <span>Your</span>
              <strong>Stay</strong>
            </div>
          )}
        </div>
      </div>

      {currentBooking ? (
        <div className="portal-actions">
          <button type="button" className="portal-action" onClick={() => setServiceOpen(true)}>
            <span><ConciergeBell size={20} /></span>
            <strong>Request a service</strong>
            <em>Dining, spa, laundry and more</em>
          </button>
          <button type="button" className="portal-action" onClick={() => setMaintenanceOpen(true)}>
            <span><Wrench size={20} /></span>
            <strong>Report an issue</strong>
            <em>Let us put things right</em>
          </button>
          <button type="button" className="portal-action" onClick={() => setProfileOpen(true)}>
            <span><UserRound size={20} /></span>
            <strong>Update preferences</strong>
            <em>Help us look after you</em>
          </button>
          <a className="portal-action" href={`tel:${data.hotel?.phone || ''}`}>
            <span><Phone size={20} /></span>
            <strong>Call the front desk</strong>
            <em>{data.hotel?.phone || 'Available day and night'}</em>
          </a>
        </div>
      ) : eligibleFeedback.length > 0 ? (
        <div className="portal-actions">
          <button type="button" className="portal-action" onClick={() => setFeedbackOpen(true)}>
            <span><Star size={20} /></span>
            <strong>Review your last stay</strong>
            <em>Your feedback shapes our service</em>
          </button>
          <button type="button" className="portal-action" onClick={() => setProfileOpen(true)}>
            <span><UserRound size={20} /></span>
            <strong>Update preferences</strong>
            <em>Help us look after you</em>
          </button>
          <Link to="/app/book" className="portal-action">
            <span><CalendarDays size={20} /></span>
            <strong>Plan another visit</strong>
            <em>Check availability and book</em>
          </Link>
          <a className="portal-action" href={`mailto:${data.hotel?.email || ''}`}>
            <span><Mail size={20} /></span>
            <strong>Email the team</strong>
            <em>{data.hotel?.email || 'We are here to help'}</em>
          </a>
        </div>
      ) : (
        <div className="portal-actions">
          <Link to="/app/book" className="portal-action">
            <span><CalendarDays size={20} /></span>
            <strong>Plan another visit</strong>
            <em>Check availability and book</em>
          </Link>
          <button type="button" className="portal-action" onClick={() => setProfileOpen(true)}>
            <span><UserRound size={20} /></span>
            <strong>Update preferences</strong>
            <em>Help us look after you</em>
          </button>
          <a className="portal-action" href={`mailto:${data.hotel?.email || ''}`}>
            <span><Mail size={20} /></span>
            <strong>Email the team</strong>
            <em>{data.hotel?.email || 'We are here to help'}</em>
          </a>
          <a className="portal-action" href={`tel:${data.hotel?.phone || ''}`}>
            <span><Phone size={20} /></span>
            <strong>Call us</strong>
            <em>{data.hotel?.phone || 'Front desk'}</em>
          </a>
        </div>
      )}

      <div className="portal-grid">
        <div className="portal-col">
          <Card className="portal-card-reservations">
            <CardHead
              title="Reservations"
              subtitle="Upcoming and past stays"
              action={<Badge tone="neutral" dot={false}>{bookings.length} total</Badge>}
            />
            {bookings.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No stays on record"
                message="When you book with us, your reservation will appear here."
                action={<Link to="/app/book" className="btn btn-primary">Find a room</Link>}
              />
            ) : (
              <div className="portal-booking-list">
                {bookings.slice(0, 6).map((booking) => (
                  <div key={booking._id} className="portal-booking">
                    <div className="portal-booking-when">
                      <strong>{formatDate(booking.checkIn, { month: 'short' })}</strong>
                      <span>{formatDate(booking.checkIn, { day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="portal-booking-copy">
                      <strong>
                        Room {booking.room?.number || '—'} · {booking.room?.type?.name || 'Stay'}
                      </strong>
                      <span>
                        {booking.nights} night{booking.nights === 1 ? '' : 's'} until{' '}
                        {formatDate(booking.checkOut)} · {booking.reference}
                      </span>
                    </div>
                    <Badge status={booking.status} tone={bookingStatusTone[booking.status] || 'auto'} />
                    {canCancel(booking) && (
                      <Button size="xs" variant="ghost" onClick={() => setCancelBooking(booking)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {upcomingBooking && canCancel(upcomingBooking) && (
              <div className="inline-note">
                <Clock3 size={15} />
                <span>
                  Need to change plans? You can cancel online up to the arrival day, or call us and we
                  will help.
                </span>
              </div>
            )}
          </Card>

          <Card className="portal-card-services">
            <CardHead
              title="Service requests"
              subtitle={services.length ? `${services.length} request${services.length === 1 ? '' : 's'}` : 'Nothing requested yet'}
              action={
                currentBooking && (
                  <Button size="sm" variant="outline" icon={Plus} onClick={() => setServiceOpen(true)}>
                    New request
                  </Button>
                )
              }
            />
            {services.length === 0 ? (
              <EmptyState
                icon={ConciergeBell}
                title="At your service"
                message={
                  currentBooking
                    ? 'Request dining, laundry, a spa treatment or a wake-up call.'
                    : 'Services can be requested during your stay.'
                }
                action={currentBooking && <Button onClick={() => setServiceOpen(true)}>Request a service</Button>}
              />
            ) : (
              <div className="service-list">
                {services.slice(0, 8).map((service) => (
                  <div key={service._id} className="service-row">
                    <span className="service-icon"><Sparkles size={16} /></span>
                    <div className="service-copy">
                      <strong>{service.description || statusLabel(service.type)}</strong>
                      <span>
                        {service.quantity} × ·{' '}
                        {service.scheduledFor ? formatDateTime(service.scheduledFor) : formatDate(service.createdAt)}
                      </span>
                    </div>
                    <Badge tone={SERVICE_STATUS_TONE[service.status] || 'neutral'}>
                      {statusLabel(service.status)}
                    </Badge>
                    <strong className="service-amount">{currency(service.amount, currencyCode, 2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="portal-col">
          <Card className="portal-card-folio">
            <CardHead
              title="Your folio"
              subtitle={openBalance > 0 ? `${currency(openBalance, currencyCode, 2)} outstanding` : 'All settled'}
              action={<ReceiptText size={18} className="muted" />}
            />
            {invoices.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No folios yet"
                message="Charges for your stay will appear here as they are posted."
              />
            ) : (
              <div className="portal-invoice-list">
                {invoices.slice(0, 5).map((invoice) => {
                  const balance = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));
                  return (
                    <div key={invoice._id} className="portal-invoice">
                      <div>
                        <strong>{invoice.number}</strong>
                        <span>{formatDate(invoice.issuedAt)} · {statusLabel(invoice.status)}</span>
                      </div>
                      <div className="portal-invoice-total">
                        <strong>{currency(invoice.total, currencyCode, 2)}</strong>
                        {balance > 0 && <span>{currency(balance, currencyCode, 2)} due</span>}
                      </div>
                      <Badge tone={INVOICE_TONE[invoice.status] || 'neutral'}>{statusLabel(invoice.status)}</Badge>
                      {balance > 0 && invoice.status !== 'void' && (
                        <Button size="xs" variant="sage" icon={CreditCard} onClick={() => setPayInvoice(invoice)}>
                          Pay
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {openBalance > 0 && (
              <div className="portal-total">
                <span>Outstanding balance</span>
                <strong>{currency(openBalance, currencyCode, 2)}</strong>
              </div>
            )}
          </Card>

          <Card className="portal-card-feedback">
            <CardHead
              title="Your feedback"
              subtitle={feedback.length ? 'Thank you for sharing your experience' : 'We would love to hear from you'}
              action={
                eligibleFeedback.length > 0 && (
                  <Button size="sm" variant="outline" icon={Star} onClick={() => setFeedbackOpen(true)}>
                    Review a stay
                  </Button>
                )
              }
            />
            {feedback.length === 0 ? (
              <EmptyState
                icon={MessageSquareQuote}
                title="No feedback shared yet"
                message={
                  eligibleFeedback.length > 0
                    ? 'Tell us about your recent stay — every detail helps.'
                    : 'After check-out you can share a review here.'
                }
                action={
                  eligibleFeedback.length > 0 && (
                    <Button onClick={() => setFeedbackOpen(true)}>Share feedback</Button>
                  )
                }
              />
            ) : (
              <div className="portal-feedback-list">
                {feedback.slice(0, 4).map((entry) => (
                  <div key={entry._id} className="portal-feedback">
                    <div className="portal-feedback-head">
                      <Rating value={entry.ratings?.overall} />
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                    {entry.title && <strong>{entry.title}</strong>}
                    {entry.comments && <p>{entry.comments}</p>}
                    {entry.response?.text && (
                      <div className="portal-response">
                        <span>Response from the team</span>
                        <p>{entry.response.text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="portal-profile-card">
            <CardHead
              title="Your profile"
              subtitle="The details we keep on file"
              action={<Avatar name={guestName} size="sm" tone={profile?.vip ? 'gold' : 'default'} />}
            />
            <div className="simple-lines">
              <div className="simple-line">
                <span><Mail size={14} /> Email</span>
                <strong className="truncate">{profile?.email || user?.email || '—'}</strong>
              </div>
              <div className="simple-line">
                <span><Phone size={14} /> Phone</span>
                <strong>{profile?.phone || 'Not provided'}</strong>
              </div>
              <div className="simple-line">
                <span><MapPin size={14} /> Nationality</span>
                <strong>{profile?.nationality || '—'}</strong>
              </div>
              <div className="simple-line">
                <span><CheckCircle2 size={14} /> Guest since</span>
                <strong>{formatDate(profile?.createdAt)}</strong>
              </div>
            </div>
            {profile?.preferences?.length > 0 && (
              <div className="amenity-chips">
                {profile.preferences.map((preference) => (
                  <span key={preference}>{preference}</span>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>Edit details</Button>
          </Card>
        </div>
      </div>

      {serviceOpen && (
        <ServiceModal
          open={serviceOpen}
          onClose={() => setServiceOpen(false)}
          menu={menu}
          currencyCode={currencyCode}
          onSaved={() => load({ quiet: true })}
        />
      )}

      <MaintenanceModal
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        onSaved={() => load({ quiet: true })}
      />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        bookings={bookings}
        existingFeedback={feedbackBookingIds}
        onSaved={() => load({ quiet: true })}
      />

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        onSaved={() => load({ quiet: true })}
      />

      <PaymentModal
        invoice={payInvoice}
        currencyCode={currencyCode}
        onClose={() => setPayInvoice(null)}
        onPaid={() => load({ quiet: true })}
      />

      <ConfirmDialog
        open={Boolean(cancelBooking)}
        onClose={() => setCancelBooking(null)}
        onConfirm={cancelStay}
        title="Cancel this reservation?"
        message={
          cancelBooking
            ? `Reservation ${cancelBooking.reference} for ${formatDate(cancelBooking.checkIn)} will be cancelled. Cancellation terms may apply.`
            : ''
        }
        confirmLabel="Cancel reservation"
        loading={cancelling}
      />

      {cancelling && <Spinner label="Cancelling your reservation…" />}
    </div>
  );
};

export default MyStayPage;
