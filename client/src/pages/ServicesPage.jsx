import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ConciergeBell,
  FilterX,
  Play,
  Plus,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  currency,
  formatDate,
  formatDateTime,
  statusLabel,
} from '../lib/format.js';
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
  StatCard,
  Tabs,
  Textarea,
} from '../components/ui.jsx';

const STATUS_TONE = {
  pending: 'amber',
  in_progress: 'blue',
  completed: 'sage',
  cancelled: 'red',
};

const FALLBACK_TYPES = [
  { type: 'room_service', label: 'In-room dining', price: 45 },
  { type: 'laundry', label: 'Laundry & pressing', price: 25 },
  { type: 'wake_up_call', label: 'Wake-up call', price: 0 },
  { type: 'transportation', label: 'Airport transfer', price: 75 },
  { type: 'spa', label: 'Spa treatment', price: 120 },
  { type: 'luggage', label: 'Luggage assistance', price: 0 },
  { type: 'extra_bed', label: 'Extra bed', price: 35 },
  { type: 'other', label: 'Other service', price: 0 },
];

const ServiceFormModal = ({ open, onClose, bookings, menu, staff, settings, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    booking: '',
    type: 'room_service',
    description: '',
    quantity: 1,
    amount: '',
    scheduledFor: '',
    assignedTo: '',
  });
  const [saving, setSaving] = useState(false);

  const menuItem = menu.find((item) => item.type === form.type);

  useEffect(() => {
    if (!open) return;
    const first = menu[0] || FALLBACK_TYPES[0];
    setForm({
      booking: bookings[0]?._id || '',
      type: first.type,
      description: first.label,
      quantity: 1,
      amount: first.price ?? 0,
      scheduledFor: '',
      assignedTo: '',
    });
  }, [open, bookings, menu]);

  const chooseType = (type) => {
    const item = menu.find((entry) => entry.type === type);
    setForm((current) => ({
      ...current,
      type,
      description: item?.label || current.description,
      amount: item?.price ?? current.amount,
    }));
  };

  const total = (Number(form.amount) || 0) * (Number(form.quantity) || 1);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/services', {
        booking: form.booking,
        type: form.type,
        description: form.description,
        quantity: Number(form.quantity) || 1,
        amount: form.amount === '' ? undefined : Number(form.amount),
        scheduledFor: form.scheduledFor || undefined,
        assignedTo: form.assignedTo || undefined,
      });
      toast.success('Guest service requested.');
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
      subtitle="Post the request to an in-house stay and coordinate delivery."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={ConciergeBell} disabled={!form.booking}>
            Add request
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="In-house stay" required>
          <Select
            value={form.booking}
            onChange={(event) => setForm({ ...form, booking: event.target.value })}
            required
          >
            <option value="">Select a stay</option>
            {bookings.map((booking) => (
              <option key={booking._id} value={booking._id}>
                {booking.guest?.firstName} {booking.guest?.lastName} · Room {booking.room?.number} · {booking.reference}
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-row">
          <Field label="Service" required>
            <Select value={form.type} onChange={(event) => chooseType(event.target.value)} required>
              {menu.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label} — {currency(item.price, settings?.currency)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assign to">
            <Select value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person._id || person.id} value={person._id || person.id}>{person.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Guest preferences, delivery details or timing notes."
          />
        </Field>
        <div className="form-row three">
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
          <Field label="Price per unit">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </Field>
          <Field label="Scheduled for">
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
            {menuItem?.description || 'Service will be posted to the guest folio.'} Total:{' '}
            <strong>{currency(total, settings?.currency)}</strong>
          </span>
        </div>
      </form>
    </Modal>
  );
};

const ServicesPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const PAGE_SIZE = 12;

  const canCreate = ['admin', 'manager', 'receptionist'].includes(user.role);
  const canViewStay = ['admin', 'manager', 'receptionist'].includes(user.role);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      // Housekeeping works from the service queue and never needs the guest
      // directory, which is limited to front-office roles.
      const calls = [
        api.get('/services', { params: { limit: 200 } }),
        api.get('/settings'),
      ];
      if (canCreate) {
        calls.push(api.get('/bookings', { params: { status: 'checked_in', limit: 100 } }));
      }
      if (['admin', 'manager'].includes(user.role)) {
        calls.push(api.get('/users', { params: { limit: 200 } }));
      }
      const [servicesRes, settingsRes, bookingsRes, usersRes] = await Promise.all(calls);
      setServices(servicesRes.data.services);
      setSettings(settingsRes.data.settings);
      setBookings(bookingsRes?.data?.bookings || []);
      setStaff(
        usersRes?.data?.users?.filter((person) => person.role !== 'guest') || [user]
      );
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

  const menu = settings?.serviceMenu?.length ? settings.serviceMenu : FALLBACK_TYPES;

  const counts = useMemo(() => {
    const result = { all: services.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const service of services) result[service.status] += 1;
    return result;
  }, [services]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return services.filter((service) => {
      if (status !== 'all' && service.status !== status) return false;
      if (type && service.type !== type) return false;
      if (needle) {
        const haystack = `${service.guest?.firstName || ''} ${service.guest?.lastName || ''} ${service.room?.number || ''} ${service.booking?.reference || ''} ${service.description || ''} ${service.type || ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [services, status, type, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [status, type, query]);

  const update = async (service, next) => {
    setBusy(service._id + next);
    try {
      await api.patch(`/services/${service._id}`, { status: next });
      toast.success(
        next === 'completed' ? 'Service marked complete.' : `Service moved to ${statusLabel(next).toLowerCase()}.`
      );
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const stats = [
    { label: 'Open requests', value: counts.pending + counts.in_progress, hint: 'Pending and in progress', icon: BellRing, tone: 'gold' },
    { label: 'Pending', value: counts.pending, hint: 'Awaiting a team member', icon: Clock3, tone: 'terracotta' },
    { label: 'In progress', value: counts.in_progress, hint: 'Being delivered now', icon: ConciergeBell, tone: 'blue' },
    { label: 'Completed', value: counts.completed, hint: 'Delivered to guests', icon: CheckCircle2, tone: 'sage' },
  ];

  const clearFilters = () => {
    setStatus('all');
    setType('');
    setQuery('');
  };

  const filtersActive = status !== 'all' || type || query;
  const typeOptions = useMemo(() => {
    const map = new Map(menu.map((item) => [item.type, item.label]));
    for (const service of services) {
      if (service.type && !map.has(service.type)) map.set(service.type, statusLabel(service.type));
    }
    return Array.from(map.entries());
  }, [menu, services]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Housekeeping panel · Concierge & guest requests"
        title="Guest services"
        subtitle="Every request, thoughtfully tracked from first ask to final delivery."
        actions={
          canCreate && (
            <Button icon={Plus} onClick={() => setFormOpen(true)} disabled={!bookings.length}>
              Add service
            </Button>
          )
        }
      />

      <div className="stats-grid">
        {stats.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <Card>
        <CardHead
          title="Service requests"
          subtitle="Charges are posted to the guest folio automatically."
          action={<SearchInput value={query} onChange={setQuery} placeholder="Guest, room or reference…" />}
        />

        <Tabs
          items={[
            { key: 'all', label: 'All requests', count: counts.all },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'in_progress', label: 'In progress', count: counts.in_progress },
            { key: 'completed', label: 'Completed', count: counts.completed },
          ]}
          value={status}
          onChange={setStatus}
        />

        <div className="filter-bar">
          <label className="filter-field">
            <span>Service type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Clear filters</Button>
          )}
          <span className="filter-count">
            {filtered.length} request{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ConciergeBell}
            title={filtersActive ? 'No requests match' : 'No guest requests yet'}
            message={
              filtersActive
                ? 'Try a different status, service type or search term.'
                : 'Requests from the guest portal and front desk will appear here for the team to deliver.'
            }
            action={filtersActive && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table services-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Request</th>
                    <th>Room / stay</th>
                    <th>Scheduled</th>
                    <th className="align-right">Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((service) => {
                    const guestName = `${service.guest?.firstName || ''} ${service.guest?.lastName || ''}`.trim() || 'Guest';
                    return (
                      <tr key={service._id}>
                        <td>
                          <div className="table-person">
                            <Avatar name={guestName} size="xs" tone={service.guest?.vip ? 'gold' : 'default'} />
                            <div>
                              <strong>
                                {guestName}
                                {service.guest?.vip && <span className="vip-dot">VIP</span>}
                              </strong>
                              <span>{service.assignedTo?.name ? `Assigned to ${service.assignedTo.name}` : 'Unassigned'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{service.description || statusLabel(service.type)}</strong>
                          <span className="table-sub">{statusLabel(service.type)} · Qty {service.quantity}</span>
                        </td>
                        <td>
                          {service.booking ? (
                            canViewStay ? (
                              <Link to={`/app/bookings/${service.booking._id}`} className="table-link">
                                {service.booking.reference}
                              </Link>
                            ) : (
                              <span className="table-link">{service.booking.reference}</span>
                            )
                          ) : '—'}
                          <span className="table-sub">
                            {service.room?.number ? `Room ${service.room.number}` : 'No room'}
                            {service.booking?.checkIn ? ` · ${formatDate(service.booking.checkIn, { year: undefined })}` : ''}
                          </span>
                        </td>
                        <td>
                          {service.scheduledFor ? formatDateTime(service.scheduledFor) : 'As soon as possible'}
                        </td>
                        <td className="align-right"><strong>{currency(service.amount, settings?.currency)}</strong></td>
                        <td>
                          <Badge tone={STATUS_TONE[service.status] || 'neutral'}>{statusLabel(service.status)}</Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            {service.status === 'pending' && (
                              <Button
                                size="xs"
                                variant="outline"
                                icon={Play}
                                loading={busy === service._id + 'in_progress'}
                                onClick={() => update(service, 'in_progress')}
                              >
                                Start
                              </Button>
                            )}
                            {['pending', 'in_progress'].includes(service.status) && (
                              <Button
                                size="xs"
                                variant="sage"
                                icon={CheckCircle2}
                                loading={busy === service._id + 'completed'}
                                onClick={() => update(service, 'completed')}
                              >
                                Complete
                              </Button>
                            )}
                            {['pending', 'in_progress'].includes(service.status) && (
                              <Button
                                size="xs"
                                variant="ghost"
                                icon={XCircle}
                                onClick={() => update(service, 'cancelled')}
                              >
                                Cancel
                              </Button>
                            )}
                            {['completed', 'cancelled'].includes(service.status) && (
                              <span className="muted small">Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination">
                <span>
                  Page {page} of {pages} · {filtered.length} requests
                </span>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((value) => Math.min(pages, value + 1))}
                  >
                    Next <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {canCreate && (
        <ServiceFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          bookings={bookings}
          menu={menu}
          staff={staff.length ? staff : [user]}
          settings={settings}
          onSaved={() => load({ quiet: true })}
        />
      )}
    </div>
  );
};

export default ServicesPage;
