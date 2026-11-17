import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ConciergeBell,
  CreditCard,
  DoorOpen,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Sparkles,
  UserRound,
  Users,
  XCircle,
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
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
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
  Spinner,
  Textarea,
} from '../components/ui.jsx';

const SOURCE_LABELS = {
  online: 'Online',
  walk_in: 'Walk-in',
  phone: 'Phone',
  staff: 'Front desk',
  corporate: 'Corporate',
};

const SERVICE_STATUS_TONE = {
  pending: 'amber',
  in_progress: 'blue',
  completed: 'sage',
  cancelled: 'red',
};

const AddServiceModal = ({ open, onClose, booking, menu, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({ type: '', description: '', quantity: 1, amount: '', scheduledFor: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = menu[0];
    setForm({
      type: first?.type || 'room_service',
      description: first?.label || '',
      quantity: 1,
      amount: first?.price ?? 0,
      scheduledFor: '',
    });
  }, [open, menu]);

  const chooseType = (type) => {
    const item = menu.find((entry) => entry.type === type);
    setForm((current) => ({
      ...current,
      type,
      description: item?.label || current.description,
      amount: item?.price ?? current.amount,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/services', {
        booking: booking._id,
        type: form.type,
        description: form.description,
        quantity: Number(form.quantity) || 1,
        amount: form.amount === '' ? undefined : Number(form.amount),
        scheduledFor: form.scheduledFor || undefined,
      });
      toast.success('Service request added to the stay.');
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
      title="Add a guest service"
      subtitle="Post a charge to the stay and coordinate delivery with the team."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={ConciergeBell}>Add service</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Service" required>
          <Select value={form.type} onChange={(event) => chooseType(event.target.value)} required>
            {menu.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label} — {currency(item.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="What has the guest asked for?"
          />
        </Field>
        <div className="form-row">
          <Field label="Quantity" required>
            <Input
              type="number"
              min="1"
              max="20"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              required
            />
          </Field>
          <Field label="Price per unit (USD)" hint="Leave as shown to use the menu price.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Scheduled for" hint="Optional — for wake-up calls, transfers or spa bookings.">
          <Input
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
};

const ModifyStayModal = ({ open, onClose, booking, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    source: 'staff',
    specialRequests: '',
    ratePerNight: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;
    setForm({
      checkIn: new Date(booking.checkIn).toISOString().slice(0, 10),
      checkOut: new Date(booking.checkOut).toISOString().slice(0, 10),
      adults: booking.adults || 1,
      children: booking.children || 0,
      source: booking.source || 'staff',
      specialRequests: booking.specialRequests || '',
      ratePerNight: booking.ratePerNight ?? '',
    });
  }, [open, booking]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/bookings/${booking._id}`, {
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        source: form.source,
        specialRequests: form.specialRequests,
        ratePerNight: Number(form.ratePerNight),
      });
      toast.success('Reservation updated.');
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
      title={`Modify ${booking?.reference || 'reservation'}`}
      subtitle="Availability is checked again before the changes are saved."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save changes</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <Field label="Arrival" required>
            <Input
              type="date"
              value={form.checkIn}
              onChange={(event) => setForm({ ...form, checkIn: event.target.value })}
              required
            />
          </Field>
          <Field label="Departure" required>
            <Input
              type="date"
              value={form.checkOut}
              min={form.checkIn}
              onChange={(event) => setForm({ ...form, checkOut: event.target.value })}
              required
            />
          </Field>
        </div>
        <div className="form-row three">
          <Field label="Adults">
            <Input
              type="number"
              min="1"
              max="12"
              value={form.adults}
              onChange={(event) => setForm({ ...form, adults: event.target.value })}
            />
          </Field>
          <Field label="Children">
            <Input
              type="number"
              min="0"
              max="12"
              value={form.children}
              onChange={(event) => setForm({ ...form, children: event.target.value })}
            />
          </Field>
          <Field label="Source">
            <Select
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            >
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Nightly rate (USD)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.ratePerNight}
            onChange={(event) => setForm({ ...form, ratePerNight: event.target.value })}
            required
          />
        </Field>
        <Field label="Special requests">
          <Textarea
            rows={3}
            value={form.specialRequests}
            onChange={(event) => setForm({ ...form, specialRequests: event.target.value })}
            placeholder="Preferences and arrival notes."
          />
        </Field>
      </form>
    </Modal>
  );
};

const BookingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [serviceOpen, setServiceOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [bookingRes, settingsRes] = await Promise.all([
        api.get(`/bookings/${id}`),
        api.get('/settings'),
      ]);
      setData(bookingRes.data);
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

  const booking = data?.booking;
  const services = data?.services || [];
  const menu = settings?.serviceMenu || [];

  const serviceTotal = useMemo(
    () => services.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [services]
  );

  const runAction = async (action, payload) => {
    setBusy(action);
    try {
      if (action === 'check-out') {
        const { data: result } = await api.post(`/bookings/${booking._id}/check-out`, payload);
        toast.success(`Checked out. Folio ${result.invoice.number} is ready.`);
        setConfirmAction(null);
        navigate(`/app/billing/${result.invoice._id}`);
        return;
      }
      const { data: result } = await api.post(`/bookings/${booking._id}/${action}`, payload);
      toast.success(
        action === 'check-in'
          ? `${booking.guest?.firstName} is checked in.`
          : `Reservation ${result.booking?.reference || booking.reference} updated.`
      );
      setConfirmAction(null);
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const createFolio = async () => {
    setBusy('folio');
    try {
      const { data: result } = await api.post('/invoices', { bookingId: booking._id });
      toast.success(`Folio ${result.invoice.number} is ready.`);
      navigate(`/app/billing/${result.invoice._id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  if (loading) return <PageLoader />;

  if (!booking) {
    return (
      <div className="page">
        <PageHeader eyebrow="Reservations" title="Reservation not found" subtitle="This reservation may have been removed." />
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="We could not find that reservation"
            message="Return to the reservation book to find the stay you need."
            action={<Link to="/app/bookings" className="btn btn-primary">Back to reservations</Link>}
          />
        </Card>
      </div>
    );
  }

  const guestName = `${booking.guest?.firstName || ''} ${booking.guest?.lastName || ''}`.trim() || 'Guest';
  const canModify = !['checked_out', 'cancelled', 'no_show'].includes(booking.status);
  const canCheckIn = ['pending', 'confirmed'].includes(booking.status);
  const canCheckOut = booking.status === 'checked_in';
  const canNoShow =
    booking.status === 'confirmed' && new Date(booking.checkIn) < new Date(`${todayISO()}T00:00:00`);

  return (
    <div className="page detail-page">
      <div className="detail-topbar">
        <Link to="/app/bookings" className="back-link">
          <ArrowLeft size={15} /> All reservations
        </Link>
        <div className="detail-topbar-actions">
          {booking.invoice ? (
            <Link to={`/app/billing/${booking.invoice._id || booking.invoice}`} className="btn btn-outline btn-sm">
              <ReceiptText size={15} /> Open folio
            </Link>
          ) : (
            <Button variant="outline" size="sm" icon={ReceiptText} onClick={createFolio} loading={busy === 'folio'}>
              Create folio
            </Button>
          )}
          {canModify && (
            <Button variant="outline" size="sm" icon={Pencil} onClick={() => setModifyOpen(true)}>
              Modify stay
            </Button>
          )}
        </div>
      </div>

      <PageHeader
        eyebrow={`Reservation ${booking.reference}`}
        title={guestName}
        subtitle={`${formatDateLong(booking.checkIn)} – ${formatDateLong(booking.checkOut)} · Room ${booking.room?.number || '—'}`}
        actions={
          <Badge status={booking.status} tone={bookingStatusTone[booking.status] || 'auto'} />
        }
      />

      <div className="detail-grid">
        <div className="detail-main">
          <Card className="guest-hero-card">
            <div className="guest-hero">
              <Avatar name={guestName} size="lg" tone={booking.guest?.vip ? 'gold' : 'default'} />
              <div className="guest-hero-copy">
                <h2>
                  {guestName}
                  {booking.guest?.vip && <span className="vip-dot">VIP</span>}
                </h2>
                <p>
                  {booking.guest?.nationality ? `${booking.guest.nationality} · ` : ''}
                  {booking.guest?.preferences?.slice(0, 3).join(', ') || 'No preferences recorded'}
                </p>
                <div className="guest-hero-contact">
                  <span><Mail size={14} /> {booking.guest?.email || 'No email'}</span>
                  <span><Phone size={14} /> {booking.guest?.phone || 'No phone'}</span>
                </div>
              </div>
              <Link
                to={`/app/guests?guest=${booking.guest?._id}`}
                className="text-link guest-hero-link"
              >
                <UserRound size={14} /> Guest profile <ArrowRight size={14} />
              </Link>
            </div>

            <div className="guest-hero-divider" />

            <div className="stay-facts">
              <div className="stay-fact">
                <span className="stay-fact-icon"><CalendarClock size={16} /></span>
                <span className="stay-fact-label">Arrival</span>
                <strong>{formatDate(booking.checkIn, { weekday: 'short' })}</strong>
                <em>{formatTime(settings?.checkInTime || '15:00')} check-in</em>
              </div>
              <div className="stay-fact">
                <span className="stay-fact-icon"><CalendarClock size={16} /></span>
                <span className="stay-fact-label">Departure</span>
                <strong>{formatDate(booking.checkOut, { weekday: 'short' })}</strong>
                <em>{formatTime(settings?.checkOutTime || '11:00')} check-out</em>
              </div>
              <div className="stay-fact">
                <span className="stay-fact-icon"><BedDouble size={16} /></span>
                <span className="stay-fact-label">Stay</span>
                <strong>{booking.nights} night{booking.nights > 1 ? 's' : ''}</strong>
                <em>{booking.adults} adult{booking.adults > 1 ? 's' : ''}{booking.children ? ` · ${booking.children} children` : ''}</em>
              </div>
              <div className="stay-fact">
                <span className="stay-fact-icon"><Users size={16} /></span>
                <span className="stay-fact-label">Source</span>
                <strong>{SOURCE_LABELS[booking.source] || statusLabel(booking.source)}</strong>
                <em>Booked {formatDate(booking.createdAt)}</em>
              </div>
            </div>

            {(booking.actualCheckIn || booking.actualCheckOut || booking.specialRequests) && (
              <div className="booking-notes">
                {booking.actualCheckIn && (
                  <p><CheckCircle2 size={15} /> Checked in {formatDateTime(booking.actualCheckIn)}</p>
                )}
                {booking.actualCheckOut && (
                  <p><DoorOpen size={15} /> Checked out {formatDateTime(booking.actualCheckOut)}</p>
                )}
                {booking.specialRequests && (
                  <p><ClipboardList size={15} /> {booking.specialRequests}</p>
                )}
                {booking.cancellationReason && (
                  <p><XCircle size={15} /> {booking.cancellationReason}</p>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHead
              title="Charges"
              subtitle="Room and tax for this reservation"
              action={
                booking.invoice ? (
                  <Link to={`/app/billing/${booking.invoice._id || booking.invoice}`} className="text-link">
                    Folio <ArrowRight size={14} />
                  </Link>
                ) : null
              }
            />
            <div className="charge-lines">
              <div className="charge-line">
                <span>Room {booking.room?.number} · {currency(booking.ratePerNight, settings?.currency)} × {booking.nights} nights</span>
                <strong>{currency(booking.roomTotal, settings?.currency)}</strong>
              </div>
              <div className="charge-line">
                <span>Tax ({booking.taxRate}%)</span>
                <strong>{currency(booking.taxAmount, settings?.currency)}</strong>
              </div>
              {serviceTotal > 0 && (
                <div className="charge-line muted">
                  <span>Guest services posted separately ({services.length})</span>
                  <strong>{currency(serviceTotal, settings?.currency)}</strong>
                </div>
              )}
              <div className="charge-line total">
                <span>Reservation total</span>
                <strong>{currency(booking.totalAmount, settings?.currency)}</strong>
              </div>
            </div>
            {booking.invoice && (
              <div className="inline-note">
                <ReceiptText size={15} />
                <span>
                  Folio {booking.invoice.number} · {statusLabel(booking.invoice.status)} ·{' '}
                  {currency(booking.invoice.amountPaid, settings?.currency)} paid of{' '}
                  {currency(booking.invoice.total, settings?.currency)}
                </span>
              </div>
            )}
          </Card>

          <Card>
            <CardHead
              title="Guest services"
              subtitle={services.length ? `${services.length} request${services.length > 1 ? 's' : ''} on this stay` : 'No requests yet'}
              action={
                <Button size="sm" variant="outline" icon={Plus} onClick={() => setServiceOpen(true)}>
                  Add service
                </Button>
              }
            />
            {services.length === 0 ? (
              <EmptyState
                icon={ConciergeBell}
                title="Nothing requested yet"
                message="Add dining, spa, transport or laundry requests to the stay."
              />
            ) : (
              <div className="service-list">
                {services.map((service) => (
                  <div key={service._id} className="service-row">
                    <span className="service-icon"><Sparkles size={16} /></span>
                    <div className="service-copy">
                      <strong>{service.description || statusLabel(service.type)}</strong>
                      <span>
                        {service.quantity} × {currency(service.amount / (service.quantity || 1), settings?.currency)}
                        {service.scheduledFor ? ` · ${formatDateTime(service.scheduledFor)}` : ''}
                      </span>
                    </div>
                    <Badge tone={SERVICE_STATUS_TONE[service.status]}>{statusLabel(service.status)}</Badge>
                    <strong className="service-amount">{currency(service.amount, settings?.currency)}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="detail-side">
          <Card>
            <CardHead title="Room" subtitle={booking.room?.type?.name || 'Assigned room'} />
            {['admin', 'manager', 'housekeeping'].includes(user.role) ? (
              <Link to="/app/rooms" className="detail-room-card">
                <span className="detail-room-number">{booking.room?.number || '—'}</span>
                <span className="detail-room-meta">
                  <strong>{booking.room?.type?.name || 'Room type'}</strong>
                  <em>Floor {booking.room?.floor} · {booking.room?.view || 'View'}</em>
                  <em>{currency(booking.room?.type?.baseRate ?? booking.ratePerNight, settings?.currency)} / night</em>
                </span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <div className="detail-room-card">
                <span className="detail-room-number">{booking.room?.number || '—'}</span>
                <span className="detail-room-meta">
                  <strong>{booking.room?.type?.name || 'Room type'}</strong>
                  <em>Floor {booking.room?.floor} · {booking.room?.view || 'View'}</em>
                  <em>{currency(booking.room?.type?.baseRate ?? booking.ratePerNight, settings?.currency)} / night</em>
                </span>
              </div>
            )}
            {booking.room?.type?.amenities?.length > 0 && (
              <div className="amenity-chips">
                {booking.room.type.amenities.slice(0, 5).map((amenity) => (
                  <span key={amenity}>{amenity}</span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Reservation actions" subtitle="Move the stay through its journey" />
            <div className="action-stack">
              {booking.status === 'pending' && (
                <Button icon={CheckCircle2} onClick={() => runAction('confirm')} loading={busy === 'confirm'}>
                  Confirm reservation
                </Button>
              )}
              {canCheckIn && (
                <Button icon={KeyRound} onClick={() => runAction('check-in')} loading={busy === 'check-in'}>
                  Check guest in
                </Button>
              )}
              {canCheckOut && (
                <Button
                  variant="terracotta"
                  icon={LogOut}
                  onClick={() => setConfirmAction('check-out')}
                >
                  Check out & build folio
                </Button>
              )}
              {canModify && (
                <Button variant="outline" icon={Pencil} onClick={() => setModifyOpen(true)}>
                  Modify dates or guests
                </Button>
              )}
              {['pending', 'confirmed'].includes(booking.status) && (
                <Button variant="ghost" icon={XCircle} onClick={() => setConfirmAction('cancel')}>
                  Cancel reservation
                </Button>
              )}
              {canNoShow && (
                <Button variant="ghost" icon={XCircle} onClick={() => setConfirmAction('no-show')}>
                  Mark as no-show
                </Button>
              )}
              {!canModify && (
                <p className="action-note">
                  This reservation is closed and kept for the record. Charges and folio remain available.
                </p>
              )}
            </div>
          </Card>

          <Card className="compact-card">
            <CardHead title="Guest contact" />
            <div className="simple-lines">
              <div className="simple-line">
                <span><Mail size={14} /> Email</span>
                <strong className="truncate">{booking.guest?.email || '—'}</strong>
              </div>
              <div className="simple-line">
                <span><Phone size={14} /> Phone</span>
                <strong>{booking.guest?.phone || '—'}</strong>
              </div>
              <div className="simple-line">
                <span><UserRound size={14} /> Guests</span>
                <strong>{booking.adults + booking.children}</strong>
              </div>
              <div className="simple-line">
                <span><CreditCard size={14} /> Total</span>
                <strong>{currency(booking.totalAmount, settings?.currency)}</strong>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <AddServiceModal
        open={serviceOpen}
        onClose={() => setServiceOpen(false)}
        booking={booking}
        menu={menu}
        onSaved={() => load({ quiet: true })}
      />

      <ModifyStayModal
        open={modifyOpen}
        onClose={() => setModifyOpen(false)}
        booking={booking}
        onSaved={() => load({ quiet: true })}
      />

      <ConfirmDialog
        open={confirmAction === 'check-out'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runAction('check-out')}
        title={`Check out ${guestName}?`}
        message={`The room will be marked dirty, a departure clean will be created and folio ${booking.reference} will be billed for the stay and posted services.`}
        confirmLabel="Check out & build folio"
        tone="primary"
        loading={busy === 'check-out'}
      />

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runAction('cancel', { reason: 'Cancelled by front desk' })}
        title="Cancel this reservation?"
        message="The room will be released and the reservation kept in the record as cancelled."
        confirmLabel="Cancel reservation"
        loading={busy === 'cancel'}
      />

      <ConfirmDialog
        open={confirmAction === 'no-show'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runAction('no-show')}
        title="Mark as no-show?"
        message="Use this only after the arrival date has passed and the guest has not arrived."
        confirmLabel="Mark no-show"
        loading={busy === 'no-show'}
      />

      {busy === 'folio' && <Spinner label="Creating folio…" />}
    </div>
  );
};

export default BookingDetailPage;
