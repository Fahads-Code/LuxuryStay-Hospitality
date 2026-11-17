import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Users,
  Waves,
} from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  addDaysISO,
  currency,
  formatDate,
  todayISO,
} from '../lib/format.js';
import { roomImages, fallbackRoomImage } from '../lib/images.js';
import { Button, Field, Input, Select, Spinner, Textarea } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const BookPage = ({ embedded = false }) => {
  const [params] = useSearchParams();
  const toast = useToast();
  const { user, guestProfile } = useAuth();
  const resultsRef = useRef(null);
  const [search, setSearch] = useState({
    checkIn: params.get('checkIn') || addDaysISO(todayISO(), 1),
    checkOut: params.get('checkOut') || addDaysISO(todayISO(), 3),
    guests: params.get('guests') || '2',
  });
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    children: 0,
    specialRequests: '',
    marketingConsent: false,
  });

  const nights = useMemo(
    () => Math.max(1, Math.round((new Date(search.checkOut) - new Date(search.checkIn)) / 86400000)),
    [search.checkIn, search.checkOut]
  );

  const fetchAvailability = async ({ quiet = false } = {}) => {
    if (new Date(search.checkOut) <= new Date(search.checkIn)) return;
    if (!quiet) {
      setLoading(true);
      setSelected(null);
    }
    try {
      const { data } = await api.get('/public/availability', {
        params: {
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          guests: search.guests,
        },
      });
      setAvailability(data);
      if (!quiet) {
        const preferred = params.get('roomType');
        const match = data.roomTypes?.find((type) => String(type.id) === preferred);
        if (match) setSelected(match);
      }
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const searchRooms = async (event) => {
    event?.preventDefault();
    if (new Date(search.checkOut) <= new Date(search.checkIn)) {
      toast.error('Departure must be after arrival.');
      return;
    }
    await fetchAvailability();
  };

  useEffect(() => {
    api.get('/public/info').then(({ data }) => setHotel(data.hotel)).catch(() => {});
    searchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sign-in is now required before booking, so start from the guest's account
  // details and only ask for the trip-specific information.
  useEffect(() => {
    if (!user) return;
    const [firstName, ...rest] = (user.name || '').trim().split(/\s+/);
    setForm((current) => ({
      ...current,
      firstName: current.firstName || guestProfile?.firstName || firstName || '',
      lastName: current.lastName || guestProfile?.lastName || rest.join(' ') || '',
      email: current.email || user.email || '',
      phone: current.phone || guestProfile?.phone || user.phone || '',
    }));
  }, [user, guestProfile]);

  useLiveRefresh(fetchAvailability, {
    enabled: Boolean(availability) && !confirmation,
    intervalMs: 30000,
  });

  const selectedTotal = selected
    ? selected.fromRate * nights * (1 + (availability?.taxRate || 0) / 100)
    : 0;
  const roomSubtotal = selected ? selected.fromRate * nights : 0;
  const taxes = selectedTotal - roomSubtotal;

  const requestIdRef = useRef(null);

  const ensureRequestId = () => {
    if (!requestIdRef.current) {
      requestIdRef.current =
        globalThis.crypto?.randomUUID?.() ||
        `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return requestIdRef.current;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) {
      toast.error('Choose a room to continue.');
      return;
    }
    setSubmitting(true);
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: Number(search.guests),
      children: Number(form.children) || 0,
      roomTypeId: selected.id,
      specialRequests: form.specialRequests,
      marketingConsent: form.marketingConsent,
      requestId: ensureRequestId(),
    };

    try {
      let lastError = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const { data } = await api.post('/public/bookings', payload);
          requestIdRef.current = null;
          setConfirmation(data.booking);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } catch (error) {
          lastError = error;
          const status = error?.response?.status;
          const retryable = !error?.response || status >= 500;
          if (!retryable) {
            // Validation / availability errors were decided by the API — a new
            // attempt should start with a fresh idempotency key.
            requestIdRef.current = null;
            break;
          }
          // A restart or network blip: wait briefly and retry the same request.
          // The request id makes this safe even if the first call did create
          // the reservation.
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          }
        }
      }
      toast.error(
        lastError?.response
          ? errorMessage(lastError)
          : 'We could not reach the reservations service. Please try again in a moment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Signed-in guests always book inside their own portal, never on the public
  // standalone booking page. Keep their search (dates, room type) intact.
  if (!embedded && user?.role === 'guest') {
    const query = params.toString();
    return <Navigate to={`/app/book${query ? `?${query}` : ''}`} replace />;
  }

  if (confirmation) {
    const guestName =
      [confirmation.firstName, confirmation.lastName].filter(Boolean).join(' ').trim() ||
      confirmation.guestName ||
      [form.firstName, form.lastName].filter(Boolean).join(' ').trim() ||
      confirmation.email?.split('@')[0];

    const confirmationContent = (
      <main className="confirmation-wrap">
        <div className="confirmation-card">
          <span className="confirmation-icon">
            <CheckCircle2 size={34} />
          </span>
          <p className="eyebrow">Reservation requested</p>
          <h1>Thank you, {guestName}.</h1>
          <p className="confirmation-lede">
            Your request is with our reservations team. We will confirm by email shortly — no
            payment has been taken.
          </p>
          <div className="confirmation-ref">
            <span>Your reference</span>
            <strong>{confirmation.reference}</strong>
          </div>
          <div className="confirmation-grid">
            <div>
              <span>Arrival</span>
              <strong>{formatDate(confirmation.checkIn)}</strong>
              <em>from {hotel?.checkInTime || '15:00'}</em>
            </div>
            <div>
              <span>Departure</span>
              <strong>{formatDate(confirmation.checkOut)}</strong>
              <em>by {hotel?.checkOutTime || '11:00'}</em>
            </div>
            <div>
              <span>Room</span>
              <strong>{confirmation.roomType}</strong>
              <em>
                {confirmation.nights} night{confirmation.nights > 1 ? 's' : ''}
              </em>
            </div>
            <div>
              <span>Estimated total</span>
              <strong>{currency(confirmation.totalAmount, confirmation.currency)}</strong>
              <em>incl. taxes & fees</em>
            </div>
          </div>
          <p className="confirmation-note">
            A confirmation will be sent to <strong>{confirmation.email}</strong>. This
            reservation is linked to your account, so you can follow it from the portal.
          </p>
          <div className="confirmation-actions">
            {embedded ? (
              <Link to="/app/my-stay" className="btn btn-primary">
                View my stay <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/" className="btn btn-outline">
                  <ChevronLeft size={16} /> Back to the hotel
                </Link>
                {user?.role === 'guest' ? (
                  <Link to="/app/my-stay" className="btn btn-primary">
                    View my stay <ArrowRight size={16} />
                  </Link>
                ) : (
                  <Link to="/app/bookings" className="btn btn-primary">
                    Go to bookings <ArrowRight size={16} />
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    );

    if (embedded) {
      return <div className="page portal-book-page">{confirmationContent}</div>;
    }

    return (
      <div className="site public-page">
        <PublicNav solid />
        {confirmationContent}
        <PublicFooter hotel={hotel} />
      </div>
    );
  }

  const bookingContent = (
    <>
      <header className="booking-page-head">
        <p className="eyebrow">{embedded ? 'Guest portal' : 'Reserve directly'}</p>
        <h1>{embedded ? 'Reserve another stay' : 'Your stay, beautifully arranged.'}</h1>
        <p>
          {embedded
            ? 'Choose your dates and room below — your details are already on file.'
            : 'Choose your dates and let us take care of the rest. Best available rate, always.'}
        </p>
      </header>

      <form className="public-search-bar" onSubmit={searchRooms}>
        <label>
          <span>Arrival</span>
          <input
            type="date"
            value={search.checkIn}
            min={todayISO()}
            onChange={(event) => {
              const checkIn = event.target.value;
              setSearch({
                ...search,
                checkIn,
                checkOut:
                  search.checkOut <= checkIn ? addDaysISO(checkIn, 2) : search.checkOut,
              });
            }}
          />
        </label>
        <label>
          <span>Departure</span>
          <input
            type="date"
            value={search.checkOut}
            min={addDaysISO(search.checkIn, 1)}
            onChange={(event) => setSearch({ ...search, checkOut: event.target.value })}
          />
        </label>
        <label>
          <span>Guests</span>
          <select
            value={search.guests}
            onChange={(event) => setSearch({ ...search, guests: event.target.value })}
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count} guest{count > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="gold" size="lg" loading={loading}>
          Update search
        </Button>
      </form>

      <div className="booking-layout" ref={resultsRef}>
        <div className="booking-results">
          <div className="results-head">
            <div>
              <p className="eyebrow">Available for your dates</p>
              <h2>
                {formatDate(search.checkIn)} – {formatDate(search.checkOut)}
              </h2>
            </div>
            <span className="results-count">
              {availability?.roomTypes?.length || 0} room type
              {availability?.roomTypes?.length === 1 ? '' : 's'} · {nights} night
              {nights > 1 ? 's' : ''}
            </span>
          </div>

          {loading && <Spinner label="Finding the perfect room…" />}

          {!loading && availability?.roomTypes?.length === 0 && (
            <div className="public-empty">
              <CalendarDays size={26} />
              <h3>No rooms for these dates</h3>
              <p>Try shifting your dates by a night or two — or call our reservations team.</p>
            </div>
          )}

          {!loading &&
            availability?.roomTypes?.map((room) => (
              <article
                key={room.id}
                className={`booking-room ${selected?.id === room.id ? 'selected' : ''}`}
              >
                <div
                  className="booking-room-image"
                  style={{ backgroundImage: `url('${roomImages[room.name] || fallbackRoomImage}')` }}
                >
                  {room.availableCount <= 2 && (
                    <span className="room-scarcity">Only {room.availableCount} left</span>
                  )}
                </div>
                <div className="booking-room-body">
                  <div className="booking-room-head">
                    <div>
                      <h3>{room.name}</h3>
                      <p>{room.description}</p>
                    </div>
                    <div className="booking-room-price">
                      <strong>{currency(room.fromRate, hotel?.currency)}</strong>
                      <span>per night</span>
                    </div>
                  </div>
                  <div className="booking-room-specs">
                    <span><Users size={14} /> Up to {room.capacity} guests</span>
                    <span><BedDouble size={14} /> {room.beds}</span>
                    <span><Waves size={14} /> {room.sizeSqm} m²</span>
                  </div>
                  <div className="booking-room-amenities">
                    {room.amenities?.slice(0, 5).map((amenity) => (
                      <span key={amenity}>{amenity}</span>
                    ))}
                  </div>
                  <div className="booking-room-foot">
                    <span className="booking-room-total">
                      {currency(room.fromRate * nights, hotel?.currency)}{' '}
                      <em>for {nights} night{nights > 1 ? 's' : ''}, before tax</em>
                    </span>
                    <Button
                      variant={selected?.id === room.id ? 'primary' : 'outline'}
                      onClick={() => {
                        setSelected(room);
                        document.getElementById('guest-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {selected?.id === room.id ? 'Selected' : 'Select room'}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
        </div>

        <aside className="booking-side">
          <form className="booking-form" id="guest-details" onSubmit={submit}>
            <div className="booking-form-head">
              <p className="eyebrow">Your reservation</p>
              <h2>{selected ? selected.name : 'Choose a room'}</h2>
              <p>
                {selected
                  ? `${formatDate(search.checkIn)} – ${formatDate(search.checkOut)} · ${nights} night${nights > 1 ? 's' : ''}`
                  : 'Select a room to see your total and complete your details.'}
              </p>
            </div>

            {selected && (
              <div className="booking-summary">
                <div>
                  <span>{currency(selected.fromRate, hotel?.currency)} × {nights} nights</span>
                  <strong>{currency(roomSubtotal, hotel?.currency)}</strong>
                </div>
                <div>
                  <span>Taxes & fees ({availability?.taxRate || 0}%)</span>
                  <strong>{currency(taxes, hotel?.currency)}</strong>
                </div>
                <div className="booking-summary-total">
                  <span>Estimated total</span>
                  <strong>{currency(selectedTotal, hotel?.currency)}</strong>
                </div>
              </div>
            )}

            <div className="form-row">
              <Field label="First name" required>
                <Input
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  required
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name" required>
                <Input
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  required
                  autoComplete="family-name"
                />
              </Field>
            </div>
            <Field
              label="Email address"
              required
              hint={
                user?.role === 'guest'
                  ? 'Bookings are linked to your account email so they appear in your portal.'
                  : undefined
              }
            >
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                autoComplete="email"
                readOnly={user?.role === 'guest'}
              />
            </Field>
            <Field label="Phone number" required>
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                required
                autoComplete="tel"
              />
            </Field>
            <Field label="Children">
              <Select
                value={form.children}
                onChange={(event) => setForm({ ...form, children: event.target.value })}
              >
                {[0, 1, 2, 3].map((count) => (
                  <option key={count} value={count}>
                    {count === 0 ? 'No children' : `${count} child${count > 1 ? 'ren' : ''}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Special requests" hint="We will do our best to accommodate.">
              <Textarea
                rows={3}
                value={form.specialRequests}
                onChange={(event) => setForm({ ...form, specialRequests: event.target.value })}
                placeholder="High floor, allergies, a special occasion…"
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })}
              />
              <span>Send me occasional offers and hotel news.</span>
            </label>

            <Button type="submit" size="lg" variant="primary" loading={submitting} disabled={!selected}>
              Request reservation <ArrowRight size={16} />
            </Button>
            <p className="booking-form-legal">
              No payment is required now. Our team will confirm availability and email you
              within a few hours.
            </p>
          </form>
        </aside>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="page portal-book-page">
        <main className="booking-page">{bookingContent}</main>
      </div>
    );
  }

  return (
    <div className="site public-page">
      <PublicNav solid />
      <main className="booking-page">{bookingContent}</main>
      <PublicFooter hotel={hotel} />
    </div>
  );
};

export default BookPage;
