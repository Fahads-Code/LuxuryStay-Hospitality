import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  FilterX,
  LogOut,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  bookingStatusTone,
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
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from '../components/ui.jsx';
import BookingFormModal from '../components/BookingFormModal.jsx';

const STATUS_TABS = [
  { key: '', label: 'All reservations' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'In house' },
  { key: 'checked_out', label: 'Departed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const SOURCE_LABELS = {
  online: 'Online',
  walk_in: 'Walk-in',
  phone: 'Phone',
  staff: 'Front desk',
  corporate: 'Corporate',
};

const BookingsPage = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState(params.get('status') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ bookings: [], pagination: null });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newBooking, setNewBooking] = useState(params.get('new') === '1');

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [bookingsRes, overviewRes] = await Promise.all([
        api.get('/bookings', {
          params: {
            page,
            limit: 20,
            ...(status ? { status } : {}),
            ...(query ? { q: query } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        }),
        api.get('/reports/overview?days=7'),
      ]);
      setData(bookingsRes.data);
      setOverview(overviewRes.data);
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

  const closeNew = () => {
    setNewBooking(false);
    if (params.get('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  };

  const pagination = data.pagination;
  const filtersActive = Boolean(status || query || from || to);

  const kpis = overview?.kpis;
  const statCards = useMemo(
    () => [
      {
        label: 'Arrivals today',
        value: kpis?.arrivalsToday ?? '—',
        hint: 'Guests due to check in',
        icon: DoorOpen,
        tone: 'gold',
      },
      {
        label: 'Departures today',
        value: kpis?.departuresToday ?? '—',
        hint: 'Folios to settle',
        icon: LogOut,
        tone: 'terracotta',
      },
      {
        label: 'In-house guests',
        value: kpis?.inHouseGuests ?? '—',
        hint: 'Currently staying',
        icon: Users,
        tone: 'sage',
      },
      {
        label: 'Matching reservations',
        value: pagination?.total ?? '—',
        hint: filtersActive ? 'With current filters' : 'All time',
        icon: CalendarDays,
        tone: 'ink',
      },
    ],
    [kpis, pagination, filtersActive]
  );

  const clearFilters = () => {
    setStatus('');
    setQuery('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reservations"
        title="The reservation book"
        subtitle="Every stay in one considered view — from first enquiry to final folio."
        actions={
          <Button icon={CalendarPlus} onClick={() => setNewBooking(true)}>
            New reservation
          </Button>
        }
      />

      <div className="stats-grid">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <Card>
        <CardHead
          title="Reservations"
          subtitle="Search, filter and open any stay to manage it."
          action={
            <div className="table-tools">
              <SearchInput value={query} onChange={setQuery} placeholder="Reference, guest or email…" />
            </div>
          }
        />

        <Tabs
          items={STATUS_TABS}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />

        <div className="filter-bar">
          <label className="filter-field">
            <span>Arriving from</span>
            <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </label>
          <label className="filter-field">
            <span>Departing by</span>
            <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </label>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <span className="filter-count">
            {pagination?.total ?? 0} reservation{pagination?.total === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : data.bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No reservations match"
            message="Try a different status, date range or search term."
            action={
              filtersActive && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table bookings-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Stay</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th className="align-right">Total</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => {
                  const guestName = `${booking.guest?.firstName || ''} ${booking.guest?.lastName || ''}`.trim();
                  return (
                    <tr key={booking._id}>
                      <td>
                        <Link to={`/app/bookings/${booking._id}`} className="mono-link">
                          {booking.reference}
                        </Link>
                      </td>
                      <td>
                        <div className="table-person">
                          <Avatar name={guestName} size="xs" />
                          <div>
                            <strong>
                              {guestName}
                              {booking.guest?.vip && <span className="vip-dot">VIP</span>}
                            </strong>
                            <span>{booking.guest?.email || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="table-room">{booking.room?.number || '—'}</span>
                        <span className="table-sub">{booking.room?.type?.name}</span>
                      </td>
                      <td>
                        <span>
                          {formatDate(booking.checkIn, { year: undefined })} →{' '}
                          {formatDate(booking.checkOut, { year: undefined })}
                        </span>
                        <span className="table-sub">
                          {booking.nights} night{booking.nights > 1 ? 's' : ''} · {booking.adults + booking.children} guest
                          {booking.adults + booking.children > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>{SOURCE_LABELS[booking.source] || statusLabel(booking.source)}</td>
                      <td>
                        <Badge
                          status={booking.status}
                          tone={bookingStatusTone[booking.status] || 'auto'}
                        />
                      </td>
                      <td className="align-right">
                        <strong>{currency(booking.totalAmount)}</strong>
                      </td>
                      <td className="align-right">
                        <Link to={`/app/bookings/${booking._id}`} className="icon-btn" aria-label="Open reservation">
                          <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="pagination">
            <span>
              Page {pagination.page} of {pagination.pages} · {pagination.total} total
            </span>
            <div>
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <BookingFormModal
        open={newBooking}
        onClose={closeNew}
        onCreated={() => {
          setPage(1);
          load({ quiet: true });
        }}
      />
    </div>
  );
};

export default BookingsPage;
