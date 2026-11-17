import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  CalendarPlus,
  CheckCircle2,
  ConciergeBell,
  DoorOpen,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  bookingStatusTone,
  currency,
  formatDate,
  formatTime,
  statusLabel,
  todayISO,
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
  PageHeader,
  PageLoader,
  SearchInput,
  StatCard,
  Tabs,
} from '../components/ui.jsx';
import BookingFormModal from '../components/BookingFormModal.jsx';

const isToday = (value) => value && new Date(value).toISOString().slice(0, 10) === todayISO();

const FrontDeskPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [stays, setStays] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('arrivals');
  const [query, setQuery] = useState('');
  const [newBooking, setNewBooking] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [todayRes, pendingRes] = await Promise.all([
        api.get('/bookings', { params: { today: 'true', limit: 200 } }),
        api.get('/bookings', { params: { status: 'pending', limit: 50 } }),
      ]);
      setStays(todayRes.data.bookings);
      setPending(pendingRes.data.bookings);
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

  const groups = useMemo(() => {
    const arrivals = stays.filter(
      (booking) => ['pending', 'confirmed'].includes(booking.status) && isToday(booking.checkIn)
    );
    const departures = stays.filter(
      (booking) => booking.status === 'checked_in' && isToday(booking.checkOut)
    );
    const inHouse = stays.filter((booking) => booking.status === 'checked_in');
    const tomorrow = stays.filter(
      (booking) => ['pending', 'confirmed'].includes(booking.status) && !isToday(booking.checkIn)
    );
    return { arrivals, departures, inHouse, tomorrow };
  }, [stays]);

  const visible = useMemo(() => {
    const list = groups[tab] || [];
    if (!query) return list;
    const needle = query.toLowerCase();
    return list.filter((booking) =>
      [
        booking.reference,
        booking.guest?.firstName,
        booking.guest?.lastName,
        booking.room?.number,
        booking.guest?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [groups, tab, query]);

  const runAction = async (booking, action) => {
    setBusy(booking._id);
    try {
      if (action === 'check-in') {
        await api.post(`/bookings/${booking._id}/check-in`);
        toast.success(`${booking.guest?.firstName} is checked in to room ${booking.room?.number}.`);
        await load({ quiet: true });
      } else if (action === 'confirm') {
        await api.post(`/bookings/${booking._id}/confirm`);
        toast.success(`Reservation ${booking.reference} confirmed.`);
        await load({ quiet: true });
      } else if (action === 'check-out') {
        const { data } = await api.post(`/bookings/${booking._id}/check-out`);
        toast.success(`Checked out. Folio ${data.invoice.number} is ready.`);
        setCheckoutTarget(null);
        await load({ quiet: true });
        navigate(`/app/billing/${data.invoice._id}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const tabs = [
    { key: 'arrivals', label: 'Arrivals', count: groups.arrivals.length },
    { key: 'departures', label: 'Departures', count: groups.departures.length },
    { key: 'inHouse', label: 'In house', count: groups.inHouse.length },
    { key: 'tomorrow', label: 'Upcoming', count: groups.tomorrow.length },
  ];

  const emptyCopy = {
    arrivals: ['No arrivals on the books', 'A quiet morning at the desk — enjoy it.'],
    departures: ['No departures today', 'Every in-house guest is staying a little longer.'],
    inHouse: ['No guests in house', 'The property is ready for its next arrival.'],
    tomorrow: ['No upcoming stays today', 'Future reservations will appear here.'],
  }[tab];

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Front desk · ${formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title="Today at the desk"
        subtitle="Arrivals, departures and every detail in between — handled with grace."
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} onClick={() => load()} loading={loading}>
              Refresh
            </Button>
            <Button icon={CalendarPlus} onClick={() => setNewBooking(true)}>
              New reservation
            </Button>
          </>
        }
      />

      <div className="stats-grid">
        <StatCard
          label="Arrivals expected"
          value={groups.arrivals.length}
          hint="Due to check in today"
          icon={DoorOpen}
          tone="gold"
        />
        <StatCard
          label="Departures due"
          value={groups.departures.length}
          hint="Folios to settle"
          icon={LogOut}
          tone="terracotta"
        />
        <StatCard
          label="Guests in house"
          value={groups.inHouse.length}
          hint="Currently staying"
          icon={Users}
          tone="sage"
        />
        <StatCard
          label="Awaiting confirmation"
          value={pending.length}
          hint="Online & phone requests"
          icon={ConciergeBell}
          tone="blue"
        />
      </div>

      <div className="desk-layout">
        <Card className="desk-main">
          <CardHead
            title="Guest movements"
            subtitle="Check guests in, settle departures and keep the day moving."
            action={<SearchInput value={query} onChange={setQuery} placeholder="Find a guest…" />}
          />

          <Tabs items={tabs} value={tab} onChange={setTab} className="desk-tabs" />

          {loading ? (
            <PageLoader />
          ) : visible.length === 0 ? (
            <EmptyState icon={BedDouble} title={emptyCopy[0]} message={emptyCopy[1]} />
          ) : (
            <div className="desk-list">
              {visible.map((booking) => {
                const guestName = `${booking.guest?.firstName || ''} ${booking.guest?.lastName || ''}`.trim();
                const busyHere = busy === booking._id;
                const canCheckIn =
                  ['pending', 'confirmed'].includes(booking.status) &&
                  new Date(booking.checkIn).toISOString().slice(0, 10) <= todayISO();
                return (
                  <article key={booking._id} className="desk-row">
                    <Link to={`/app/bookings/${booking._id}`} className="desk-guest">
                      <Avatar name={guestName} />
                      <div>
                        <strong>
                          {guestName}
                          {booking.guest?.vip && <span className="vip-dot">VIP</span>}
                        </strong>
                        <span>
                          {booking.reference} · {booking.guest?.email || 'No email on file'}
                        </span>
                      </div>
                    </Link>

                    <div className="desk-room">
                      <span className="desk-room-number">{booking.room?.number || '—'}</span>
                      <em>{booking.room?.type?.name || 'Unassigned'}</em>
                    </div>

                    <div className="desk-dates">
                      <span>
                        {formatDate(booking.checkIn, { year: undefined })} →{' '}
                        {formatDate(booking.checkOut, { year: undefined })}
                      </span>
                      <em>
                        {booking.nights} night{booking.nights > 1 ? 's' : ''} · {currency(booking.totalAmount)}
                      </em>
                    </div>

                    <div className="desk-status">
                      <Badge status={booking.status} tone={bookingStatusTone[booking.status] || 'auto'} />
                    </div>

                    <div className="desk-actions">
                      {booking.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAction(booking, 'confirm')}
                          loading={busyHere}
                        >
                          Confirm
                        </Button>
                      )}
                      {canCheckIn && (
                        <Button
                          size="sm"
                          icon={KeyRound}
                          onClick={() => runAction(booking, 'check-in')}
                          loading={busyHere}
                        >
                          Check in
                        </Button>
                      )}
                      {booking.status === 'checked_in' && isToday(booking.checkOut) && (
                        <Button
                          size="sm"
                          variant="terracotta"
                          icon={LogOut}
                          onClick={() => setCheckoutTarget(booking)}
                          loading={busyHere}
                        >
                          Check out
                        </Button>
                      )}
                      <Link to={`/app/bookings/${booking._id}`} className="icon-btn" title="Open reservation">
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>

        <aside className="desk-side">
          <Card>
            <CardHead
              title="Pending requests"
              subtitle="Confirm these stays to secure the room"
              action={<Badge tone="amber">{pending.length} open</Badge>}
            />
            {pending.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All confirmed"
                message="No reservations are waiting on the desk."
              />
            ) : (
              <div className="mini-task-list">
                {pending.slice(0, 7).map((booking) => (
                  <div key={booking._id} className="mini-task">
                    <span className="mini-task-room">{booking.room?.number}</span>
                    <span className="mini-task-copy">
                      <Link to={`/app/bookings/${booking._id}`}>
                        {booking.guest?.firstName} {booking.guest?.lastName}
                      </Link>
                      <em>
                        {formatDate(booking.checkIn, { year: undefined })} · {booking.source?.replaceAll('_', ' ')}
                      </em>
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => runAction(booking, 'confirm')}
                      loading={busy === booking._id}
                    >
                      Confirm
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="desk-shift-card">
            <CardHead title="Shift notes" subtitle="Small things that make a stay" />
            <div className="shift-notes">
              <p>
                <Search size={15} />{' '}
                {pending.length
                  ? `${pending.length} reservation request${pending.length === 1 ? '' : 's'} awaiting confirmation.`
                  : 'No reservation requests are waiting for confirmation.'}
              </p>
              <p>
                <BedDouble size={15} /> {groups.arrivals.length} arrival
                {groups.arrivals.length === 1 ? '' : 's'} and {groups.departures.length} departure
                {groups.departures.length === 1 ? '' : 's'} on today's board.
              </p>
              <p>
                <ConciergeBell size={15} /> {groups.inHouse.length} guest
                {groups.inHouse.length === 1 ? '' : 's'} currently in house.
              </p>
            </div>
            {['admin', 'manager'].includes(user.role) ? (
              <Link to="/app/services" className="text-link">
                Guest services board <ArrowRight size={14} />
              </Link>
            ) : (
              <Link to="/app/bookings" className="text-link">
                Reservations board <ArrowRight size={14} />
              </Link>
            )}
          </Card>

          <Card>
            <CardHead title="Operating hours" subtitle="Today" action={<Badge tone="sage">Open</Badge>} />
            <div className="simple-lines">
              <div className="simple-line">
                <span>Front desk</span>
                <strong>24 hours</strong>
              </div>
              <div className="simple-line">
                <span>Check-in from</span>
                <strong>{formatTime('15:00')}</strong>
              </div>
              <div className="simple-line">
                <span>Check-out by</span>
                <strong>{formatTime('11:00')}</strong>
              </div>
              <div className="simple-line">
                <span>Concierge</span>
                <strong>07:00 – 23:00</strong>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <BookingFormModal
        open={newBooking}
        onClose={() => setNewBooking(false)}
        onCreated={() => load({ quiet: true })}
      />

      <ConfirmDialog
        open={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        onConfirm={() => runAction(checkoutTarget, 'check-out')}
        title={`Check out room ${checkoutTarget?.room?.number || ''}?`}
        message={`This will close the folio for ${checkoutTarget?.guest?.firstName || 'the guest'}, mark the room dirty and create a departure clean task.`}
        confirmLabel="Check out & build folio"
        tone="primary"
        loading={busy === checkoutTarget?._id}
      />
    </div>
  );
};

export default FrontDeskPage;
