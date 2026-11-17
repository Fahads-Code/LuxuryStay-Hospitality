import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FilterX,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  UserRound,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { formatDateTime, statusLabel } from '../lib/format.js';
import {
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
  Select,
  StatCard,
  Tabs,
  Textarea,
} from '../components/ui.jsx';

const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'network', label: 'Network' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_TONE = {
  open: 'amber',
  in_progress: 'blue',
  resolved: 'sage',
  cancelled: 'neutral',
};

const PRIORITY_TONE = {
  low: 'neutral',
  medium: 'amber',
  high: 'terracotta',
  urgent: 'red',
};

const TABS = [
  { key: 'all', label: 'All requests' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'cancelled', label: 'Cancelled' },
];

const MaintenanceFormModal = ({ open, onClose, request, rooms, staff, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    room: '',
    issue: '',
    category: 'other',
    priority: 'medium',
    status: 'open',
    assignedTo: '',
    resolutionNotes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (request) {
      setForm({
        room: request.room?._id || request.room || '',
        issue: request.issue || '',
        category: request.category || 'other',
        priority: request.priority || 'medium',
        status: request.status || 'open',
        assignedTo: request.assignedTo?._id || request.assignedTo || '',
        resolutionNotes: request.resolutionNotes || '',
      });
    } else {
      setForm({
        room: rooms[0]?._id || '',
        issue: '',
        category: 'other',
        priority: 'medium',
        status: 'open',
        assignedTo: '',
        resolutionNotes: '',
      });
    }
  }, [open, request, rooms]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (request) {
        await api.patch(`/maintenance/${request._id}`, {
          status: form.status,
          priority: form.priority,
          assignedTo: form.assignedTo || null,
          resolutionNotes: form.resolutionNotes,
        });
        toast.success(
          form.status === 'resolved' ? 'Issue marked resolved.' : 'Maintenance request updated.'
        );
      } else {
        await api.post('/maintenance', {
          room: form.room,
          issue: form.issue.trim(),
          category: form.category,
          priority: form.priority,
          assignedTo: form.assignedTo || undefined,
        });
        toast.success('Maintenance request reported.');
      }
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
      title={request ? `Update · Room ${request.room?.number || ''}` : 'Report a maintenance issue'}
      subtitle={
        request
          ? 'Track progress and record how the issue was resolved.'
          : 'Give the engineering team a clear brief so the room can return to service.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Wrench}>
            {request ? 'Save update' : 'Report issue'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        {!request ? (
          <>
            <Field label="Room" required>
              <Select
                value={form.room}
                onChange={(event) => setForm({ ...form, room: event.target.value })}
                required
              >
                <option value="">Select a room</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.number} · Floor {room.floor} · {statusLabel(room.status)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="What is the issue?" required>
              <Textarea
                rows={3}
                value={form.issue}
                onChange={(event) => setForm({ ...form, issue: event.target.value })}
                placeholder="Describe the fault, where it is and any access notes."
                required
                minLength={3}
              />
            </Field>
          </>
        ) : (
          <div className="inline-note">
            <Wrench size={15} />
            <span>{request.issue}</span>
          </div>
        )}

        <div className="form-row three">
          <Field label="Category">
            <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} disabled={Boolean(request)}>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>{priority.label}</option>
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

        {request && (
          <>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
            <Field label="Resolution notes" hint="Record parts replaced, checks completed or follow-up needed.">
              <Textarea
                rows={3}
                value={form.resolutionNotes}
                onChange={(event) => setForm({ ...form, resolutionNotes: event.target.value })}
                placeholder="What was done to resolve the issue?"
              />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
};

const MaintenancePage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [openByPriority, setOpenByPriority] = useState({ urgent: 0, high: 0, medium: 0, low: 0 });
  const [pagination, setPagination] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [busy, setBusy] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const requestsToMake = [
        api.get('/maintenance', {
          params: {
            limit: 100,
            ...(status !== 'all' ? { status } : {}),
            ...(priority ? { priority } : {}),
            ...(roomFilter ? { room: roomFilter } : {}),
          },
        }),
        api.get('/rooms'),
      ];
      if (['admin', 'manager'].includes(user.role)) {
        requestsToMake.push(api.get('/users', { params: { limit: 200 } }));
      }
      const [requestRes, roomsRes, usersRes] = await Promise.all(requestsToMake);
      setRequests(requestRes.data.requests);
      setOpenByPriority(requestRes.data.openByPriority);
      setPagination(requestRes.data.pagination);
      setRooms(roomsRes.data.rooms);
      setStaff(usersRes?.data?.users?.filter((person) => person.role !== 'guest') || [user]);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, roomFilter]);

  useLiveRefresh(load);

  const openTotal = useMemo(
    () => Object.values(openByPriority).reduce((sum, value) => sum + value, 0),
    [openByPriority]
  );

  const stats = [
    { label: 'Urgent issues', value: openByPriority.urgent, hint: 'Needing immediate attention', icon: AlertTriangle, tone: 'terracotta' },
    { label: 'High priority', value: openByPriority.high, hint: 'Open or in progress', icon: Wrench, tone: 'gold' },
    { label: 'Open requests', value: openTotal, hint: 'Across all priorities', icon: RotateCcw, tone: 'blue' },
    { label: 'Requests in view', value: pagination?.total ?? requests.length, hint: status === 'all' ? 'All maintenance records' : `Status: ${statusLabel(status)}`, icon: CheckCircle2, tone: 'sage' },
  ];

  const update = async (request, payload) => {
    setBusy(request._id + (payload.status || ''));
    try {
      await api.patch(`/maintenance/${request._id}`, payload);
      toast.success(payload.status === 'resolved' ? 'Issue resolved.' : 'Maintenance request updated.');
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const clearFilters = () => {
    setStatus('all');
    setPriority('');
    setRoomFilter('');
  };

  const filtersActive = status !== 'all' || priority || roomFilter;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Housekeeping panel · Engineering & upkeep"
        title="Maintenance"
        subtitle="Report, prioritise and resolve every issue before it reaches a guest."
        actions={
          <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>
            Report issue
          </Button>
        }
      />

      <div className="stats-grid">
        {stats.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <Card>
        <CardHead
          title="Maintenance register"
          subtitle="Every request, from first report to final sign-off."
        />

        <Tabs items={TABS} value={status} onChange={setStatus} />

        <div className="filter-bar">
          <label className="filter-field">
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">All priorities</option>
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Room</span>
            <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option value="">All rooms</option>
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>Room {room.number}</option>
              ))}
            </select>
          </label>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Clear filters</Button>
          )}
          <span className="filter-count">
            {requests.length} request{requests.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={filtersActive ? 'No requests match' : 'Everything is in working order'}
            message={filtersActive ? 'Try a different status, priority or room.' : 'Reported issues will appear here with their full history.'}
            action={filtersActive && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="task-list maintenance-list">
            {requests.map((request) => (
              <article key={request._id} className={`task-row task-${request.status}`}>
                <span className={`task-room priority-${request.priority}`}>{request.room?.number || '—'}</span>
                <div className="task-copy">
                  <div className="task-title">
                    <strong>{request.issue}</strong>
                    <Badge tone={STATUS_TONE[request.status] || 'neutral'}>{statusLabel(request.status)}</Badge>
                    <Badge tone={PRIORITY_TONE[request.priority] || 'neutral'} dot={false}>
                      {statusLabel(request.priority)}
                    </Badge>
                  </div>
                  <div className="task-meta">
                    <span>Floor {request.room?.floor ?? '—'}</span>
                    <span>{statusLabel(request.category)}</span>
                    <span><UserRound size={13} /> {request.assignedTo?.name || 'Unassigned'}</span>
                    <span>Reported by {request.reportedByName || 'staff'}</span>
                    <span>{formatDateTime(request.createdAt)}</span>
                  </div>
                  {request.resolutionNotes && (
                    <p className="task-note"><CheckCircle2 size={13} /> {request.resolutionNotes}</p>
                  )}
                  {request.reportedByType === 'guest' && (
                    <p className="task-note"><AlertTriangle size={13} /> Reported by a guest in house</p>
                  )}
                </div>
                <div className="task-actions">
                  {request.status === 'open' && (
                    <Button
                      size="xs"
                      variant="outline"
                      icon={Play}
                      loading={busy === request._id + 'in_progress'}
                      onClick={() => update(request, { status: 'in_progress' })}
                    >
                      Start
                    </Button>
                  )}
                  {['open', 'in_progress'].includes(request.status) && (
                    <Button
                      size="xs"
                      variant="sage"
                      icon={CheckCircle2}
                      onClick={() => { setEditing(request); setFormOpen(true); }}
                    >
                      Resolve
                    </Button>
                  )}
                  {request.status === 'resolved' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={RotateCcw}
                      onClick={() => update(request, { status: 'open' })}
                    >
                      Reopen
                    </Button>
                  )}
                  {request.status !== 'resolved' && request.status !== 'cancelled' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={XCircle}
                      onClick={() => update(request, { status: 'cancelled' })}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={Pencil}
                    onClick={() => { setEditing(request); setFormOpen(true); }}
                  >
                    Update
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <MaintenanceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        request={editing}
        rooms={rooms}
        staff={staff.length ? staff : [user]}
        onSaved={() => load({ quiet: true })}
      />
    </div>
  );
};

export default MaintenancePage;
