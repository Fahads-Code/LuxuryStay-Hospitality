import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  Mail,
  MapPin,
  MessageSquareQuote,
  Pencil,
  Phone,
  ReceiptText,
  Star,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  bookingStatusTone,
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
  Drawer,
  EmptyState,
  PageHeader,
  PageLoader,
  Rating,
  SearchInput,
  Spinner,
  StatCard,
  Tabs,
  Toggle,
} from '../components/ui.jsx';
import GuestFormModal from '../components/GuestFormModal.jsx';

const GuestDetail = ({ guestId, refreshKey, onClose, onEdit, onChanged }) => {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (!guestId) return;
    if (!quiet) setLoading(true);
    try {
      const { data: response } = await api.get(`/guests/${guestId}`);
      setData(response);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (guestId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId, refreshKey]);

  useLiveRefresh(load, { enabled: Boolean(guestId) });

  const guest = data?.guest;

  const remove = async () => {
    setRemoving(true);
    try {
      await api.delete(`/guests/${guestId}`);
      toast.success('Guest profile deleted.');
      setRemoveOpen(false);
      onChanged?.();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Drawer
        open={Boolean(guestId)}
        onClose={onClose}
        title={guest?.fullName || 'Guest profile'}
        subtitle={guest ? `${guest.nationality || 'Guest'}${guest.vip ? ' · VIP' : ''}` : ''}
        width="lg"
        footer={
          guest && (
            <div className="drawer-actions">
              <Button variant="ghost" icon={Trash2} onClick={() => setRemoveOpen(true)}>
                Delete
              </Button>
              <span className="drawer-foot-note">Profiles with stay history are kept for reporting.</span>
              <Button icon={Pencil} onClick={() => onEdit(guest)}>Edit profile</Button>
            </div>
          )
        }
      >
        {loading || !guest ? (
          <Spinner />
        ) : (
          <div className="guest-detail">
            <div className="guest-detail-head">
              <Avatar name={guest.fullName} size="lg" tone={guest.vip ? 'gold' : 'default'} />
              <div>
                <h3>
                  {guest.fullName}
                  {guest.vip && <span className="vip-dot">VIP</span>}
                </h3>
                <p>{guest.email || 'No email on file'}</p>
                <div className="guest-detail-chips">
                  <span><Phone size={13} /> {guest.phone || 'No phone'}</span>
                  {guest.nationality && <span><MapPin size={13} /> {guest.nationality}</span>}
                  <span><CalendarDays size={13} /> Joined {formatDate(guest.createdAt)}</span>
                </div>
              </div>
            </div>

            {guest.preferences?.length > 0 && (
              <div className="preference-panel">
                <span className="eyebrow">Preferences</span>
                <div className="amenity-chips">
                  {guest.preferences.map((preference) => (
                    <span key={preference}>{preference}</span>
                  ))}
                </div>
              </div>
            )}

            {guest.notes && (
              <div className="note-panel">
                <Star size={16} />
                <p>{guest.notes}</p>
              </div>
            )}

            {guest.address && Object.values(guest.address).some(Boolean) && (
              <div className="guest-detail-section">
                <h4>Address</h4>
                <p className="muted">
                  {[guest.address.street, guest.address.city, guest.address.state, guest.address.postalCode, guest.address.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}

            <div className="guest-detail-section">
              <div className="section-mini-head">
                <h4>Stay history</h4>
                <span className="muted small">{data.bookings?.length || 0} reservations</span>
              </div>
              {data.bookings?.length ? (
                <div className="mini-timeline">
                  {data.bookings.map((booking) => (
                    <Link
                      key={booking._id}
                      to={`/app/bookings/${booking._id}`}
                      className="mini-timeline-row"
                    >
                      <span>{formatDate(booking.checkIn, { year: undefined })}</span>
                      <strong>
                        Room {booking.room?.number || '—'} · {booking.nights} night{booking.nights > 1 ? 's' : ''}
                      </strong>
                      <Badge status={booking.status} tone={bookingStatusTone[booking.status] || 'auto'} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted small">No stays recorded yet.</p>
              )}
            </div>

            <div className="guest-detail-section">
              <div className="section-mini-head">
                <h4>Invoices</h4>
                <ReceiptText size={15} />
              </div>
              {data.invoices?.length ? (
                <div className="mini-timeline">
                  {data.invoices.map((invoice) => (
                    <Link key={invoice._id} to={`/app/billing/${invoice._id}`} className="mini-timeline-row">
                      <span>{formatDate(invoice.issuedAt)}</span>
                      <strong>{invoice.number}</strong>
                      <span className="mini-timeline-amount">{currency(invoice.total)}</span>
                      <Badge status={invoice.status} tone="auto" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted small">No folios yet.</p>
              )}
            </div>

            <div className="guest-detail-section">
              <div className="section-mini-head">
                <h4>Feedback</h4>
                <MessageSquareQuote size={15} />
              </div>
              {data.feedback?.length ? (
                <div className="guest-feedback-list">
                  {data.feedback.map((entry) => (
                    <div key={entry._id} className="guest-feedback">
                      <div>
                        <Rating value={entry.ratings.overall} />
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                      {entry.title && <strong>{entry.title}</strong>}
                      {entry.comments && <p>{entry.comments}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">No feedback shared yet.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={remove}
        title={`Delete ${guest?.fullName || 'guest'}?`}
        message="Guests with reservations or folios cannot be deleted — their history is needed for reporting. This cannot be undone."
        confirmLabel="Delete profile"
        loading={removing}
      />
    </>
  );
};

const GuestsPage = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(params.get('q') || '');
  const [vipOnly, setVipOnly] = useState(params.get('vip') === 'true');
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ guests: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(params.get('guest') || null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const { data: response } = await api.get('/guests', {
        params: {
          page,
          limit: 20,
          ...(query ? { q: query } : {}),
          ...(vipOnly ? { vip: 'true' } : {}),
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
  }, [page, vipOnly]);

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
    if (query) next.set('q', query);
    if (vipOnly) next.set('vip', 'true');
    if (selectedId) next.set('guest', selectedId);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, vipOnly, selectedId]);

  const guests = useMemo(() => {
    if (tab === 'returning') return data.guests.filter((guest) => guest.stats?.stays > 0);
    if (tab === 'new') return data.guests.filter((guest) => !guest.stats?.stays);
    return data.guests;
  }, [data.guests, tab]);

  const vipCount = data.guests.filter((guest) => guest.vip).length;
  const returning = data.guests.filter((guest) => guest.stats?.stays > 0).length;
  const lifetime = data.guests.reduce((sum, guest) => sum + (guest.stats?.lifetimeValue || 0), 0);

  const closeDetail = () => {
    setSelectedId(null);
    const next = new URLSearchParams(params);
    next.delete('guest');
    setParams(next, { replace: true });
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Guest relationships"
        title="Guests"
        subtitle="Every profile, preference and past stay — remembered with care."
        actions={<Button icon={UserPlus} onClick={openNew}>New guest</Button>}
      />

      <div className="stats-grid">
        <StatCard
          label="Guests on file"
          value={data.pagination?.total ?? '—'}
          hint={query || vipOnly ? 'Matching current filters' : 'Across the property'}
          icon={UsersRound}
          tone="ink"
        />
        <StatCard
          label="VIP profiles"
          value={vipCount}
          hint="On this page"
          icon={Crown}
          tone="gold"
        />
        <StatCard
          label="Returning guests"
          value={returning}
          hint="With at least one completed stay"
          icon={CalendarDays}
          tone="sage"
        />
        <StatCard
          label="Lifetime value"
          value={currency(lifetime)}
          hint="Completed stays on this page"
          icon={ReceiptText}
          tone="terracotta"
        />
      </div>

      <Card>
        <CardHead
          title="Guest directory"
          subtitle="Open a profile to see preferences, folios and feedback."
          action={
            <div className="table-tools">
              <SearchInput value={query} onChange={setQuery} placeholder="Name, email or phone…" />
              <Toggle checked={vipOnly} onChange={(value) => { setVipOnly(value); setPage(1); }} label="VIP only" />
            </div>
          }
        />

        <Tabs
          items={[
            { key: 'all', label: 'All guests' },
            { key: 'returning', label: 'Returning' },
            { key: 'new', label: 'New' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {loading ? (
          <PageLoader />
        ) : guests.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={query || vipOnly ? 'No guests match' : 'No guest profiles yet'}
            message={
              query || vipOnly
                ? 'Try a different search term or clear the VIP filter.'
                : 'Create a profile when a guest first makes a reservation.'
            }
            action={
              query || vipOnly ? (
                <Button variant="outline" onClick={() => { setQuery(''); setVipOnly(false); }}>Clear filters</Button>
              ) : (
                <Button onClick={openNew} icon={UserPlus}>Create the first profile</Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table guests-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Contact</th>
                  <th>Nationality</th>
                  <th>Stays</th>
                  <th>Last stay</th>
                  <th className="align-right">Lifetime value</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest._id} className="clickable-row" onClick={() => setSelectedId(guest._id)}>
                    <td>
                      <div className="table-person">
                        <Avatar name={guest.fullName} size="xs" tone={guest.vip ? 'gold' : 'default'} />
                        <div>
                          <strong>
                            {guest.fullName}
                            {guest.vip && <span className="vip-dot">VIP</span>}
                          </strong>
                          <span>{guest.preferences?.slice(0, 2).join(', ') || 'No preferences'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span>{guest.email || '—'}</span>
                      <span className="table-sub">{guest.phone || 'No phone'}</span>
                    </td>
                    <td>{guest.nationality || '—'}</td>
                    <td>{guest.stats?.stays || 0}</td>
                    <td>{guest.stats?.lastStay ? formatDate(guest.stats.lastStay) : '—'}</td>
                    <td className="align-right">
                      <strong>{currency(guest.stats?.lifetimeValue || 0)}</strong>
                    </td>
                    <td className="align-right">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Open guest profile"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(guest._id);
                        }}
                      >
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.pagination && data.pagination.pages > 1 && (
          <div className="pagination">
            <span>
              Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} guests
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

      <GuestDetail
        guestId={selectedId}
        refreshKey={detailVersion}
        onClose={closeDetail}
        onEdit={(guest) => { setEditing(guest); setFormOpen(true); }}
        onChanged={() => load({ quiet: true })}
      />

      <GuestFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        guest={editing}
        onSaved={() => {
          load({ quiet: true });
          if (selectedId) setDetailVersion((value) => value + 1);
        }}
      />
    </div>
  );
};

export default GuestsPage;
