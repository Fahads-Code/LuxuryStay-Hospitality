import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  Users,
  Pencil,
  DoorOpen,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  currency,
  formatDate,
  roomStatusTone,
  statusLabel,
} from '../lib/format.js';
import { roomImage } from '../lib/images.js';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  Spinner,
  Textarea,
} from '../components/ui.jsx';

const STATUS_FILTERS = [
  { key: 'all', label: 'All rooms' },
  { key: 'available', label: 'Available' },
  { key: 'occupied', label: 'Occupied' },
  { key: 'dirty', label: 'Dirty' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'maintenance', label: 'Maintenance' },
];

const emptyRoom = {
  number: '',
  floor: 1,
  type: '',
  rate: '',
  view: '',
  housekeepingNote: '',
};

const RoomFormModal = ({ open, onClose, room, roomTypes, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(emptyRoom);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (room) {
      setForm({
        number: room.number || '',
        floor: room.floor || 1,
        type: room.type?._id || room.type || '',
        rate: room.rate ?? '',
        view: room.view || '',
        housekeepingNote: room.housekeepingNote || '',
      });
    } else {
      setForm({ ...emptyRoom, type: roomTypes[0]?._id || '' });
    }
  }, [open, room, roomTypes]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        number: form.number.trim(),
        floor: Number(form.floor),
        type: form.type,
        view: form.view,
        housekeepingNote: form.housekeepingNote,
      };
      if (form.rate !== '') payload.rate = Number(form.rate);
      if (room) {
        await api.patch(`/rooms/${room._id}`, payload);
        toast.success(`Room ${payload.number} updated.`);
      } else {
        await api.post('/rooms', payload);
        toast.success(`Room ${payload.number} added.`);
      }
      onSaved();
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
      title={room ? `Edit room ${room.number}` : 'Add a new room'}
      subtitle="Keep inventory accurate so availability stays reliable."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{room ? 'Save changes' : 'Add room'}</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <Field label="Room number" required>
            <Input
              value={form.number}
              onChange={(event) => setForm({ ...form, number: event.target.value })}
              placeholder="e.g. 210"
              required
            />
          </Field>
          <Field label="Floor" required>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.floor}
              onChange={(event) => setForm({ ...form, floor: event.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="Room type" required>
          <Select
            value={form.type}
            onChange={(event) => {
              const type = roomTypes.find((item) => item._id === event.target.value);
              setForm({
                ...form,
                type: event.target.value,
                rate: type && !room ? type.baseRate : form.rate,
              });
            }}
            required
          >
            <option value="">Select a type</option>
            {roomTypes.map((type) => (
              <option key={type._id} value={type._id}>
                {type.name} — {currency(type.baseRate)}/night
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-row">
          <Field label="Nightly rate (USD)" hint="Leave blank to use the type's base rate.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={(event) => setForm({ ...form, rate: event.target.value })}
              placeholder="220"
            />
          </Field>
          <Field label="View">
            <Input
              value={form.view}
              onChange={(event) => setForm({ ...form, view: event.target.value })}
              placeholder="Ocean view"
            />
          </Field>
        </div>
        <Field label="Housekeeping note">
          <Textarea
            rows={2}
            value={form.housekeepingNote}
            onChange={(event) => setForm({ ...form, housekeepingNote: event.target.value })}
            placeholder="Anything the team should know about this room."
          />
        </Field>
      </form>
    </Modal>
  );
};

const RoomDetail = ({ roomId, onClose, onChanged }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (!roomId) return;
    if (!quiet) setLoading(true);
    try {
      const { data } = await api.get(`/rooms/${roomId}`);
      setDetail(data);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useLiveRefresh(load, { enabled: Boolean(roomId) });

  const changeStatus = async (status) => {
    setUpdating(true);
    try {
      await api.patch(`/rooms/${roomId}/status`, { status });
      toast.success(`Room ${detail.room.number} marked ${statusLabel(status).toLowerCase()}.`);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const room = detail?.room;

  return (
    <Drawer
      open={Boolean(roomId)}
      onClose={onClose}
      title={room ? `Room ${room.number || '—'}` : 'Room details'}
      subtitle={
        room
          ? `${room.type?.name || 'Unassigned type'} · Floor ${Number.isFinite(Number(room.floor)) ? room.floor : '—'} · ${room.view || '—'}`
          : ''
      }
      width="lg"
      footer={
        room && (
          <div className="drawer-actions">
            <span className="drawer-foot-note">Status changes update housekeeping automatically.</span>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )
      }
    >
      {loading || !room ? (
        <Spinner />
      ) : (
        <div className="room-detail">
          <div
            className={`room-detail-hero status-${room.status}`}
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(12,23,22,.94), rgba(24,42,40,.82)), url('${roomImage(room.type?.name || 'Standard King')}')`,
            }}
          >
            <div>
              <p className="eyebrow">Nightly rate</p>
              <strong className="room-detail-rate">{currency(Number(room.rate) || Number(room.type?.baseRate) || 0)}</strong>
              <span>excluding {room.type?.name || 'room'} inclusions</span>
            </div>
            <Badge tone={roomStatusTone[room.status] || 'neutral'}>{statusLabel(room.status)}</Badge>
          </div>

          <div className="room-detail-specs">
            <span><Users size={15} /> {room.type?.capacity ? `Up to ${room.type.capacity} guests` : 'Capacity not set'}</span>
            <span><BedDouble size={15} /> {room.type?.beds || '—'}</span>
            <span><DoorOpen size={15} /> Floor {Number.isFinite(Number(room.floor)) ? room.floor : '—'}</span>
          </div>

          <div className="room-detail-section">
            <h3>Update status</h3>
            <div className="status-actions">
              {['available', 'dirty', 'cleaning', 'maintenance'].map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`status-action ${room.status === status ? 'active' : ''}`}
                  onClick={() => changeStatus(status)}
                  disabled={updating || room.status === status}
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>
            <p className="field-hint">
              {room.status === 'occupied'
                ? 'This room is occupied. Complete check-out before changing its status.'
                : 'Marking a room dirty or cleaning creates a housekeeping task automatically.'}
            </p>
          </div>

          {room.housekeepingNote && (
            <div className="note-panel">
              <Sparkles size={16} />
              <p>{room.housekeepingNote}</p>
            </div>
          )}

          {room.currentBooking && (
            <div className="room-guest-panel">
              <Avatar name={`${room.currentBooking.guest?.firstName} ${room.currentBooking.guest?.lastName}`} />
              <div>
                <span>Currently in house</span>
                <strong>
                  {room.currentBooking.guest?.firstName} {room.currentBooking.guest?.lastName}
                </strong>
                <em>
                  {formatDate(room.currentBooking.checkIn)} – {formatDate(room.currentBooking.checkOut)}
                </em>
              </div>
              <Badge status="checked_in" />
            </div>
          )}

          <div className="room-detail-section">
            <div className="section-mini-head">
              <h3>Recent stays</h3>
              <History size={15} />
            </div>
            {detail.bookings?.length ? (
              <div className="mini-timeline">
                {detail.bookings.slice(0, 5).map((booking) => (
                  <div key={booking._id} className="mini-timeline-row">
                    <span>{formatDate(booking.checkIn)}</span>
                    <strong>
                      {booking.guest?.firstName} {booking.guest?.lastName}
                    </strong>
                    <Badge status={booking.status} tone="auto" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">No stay history for this room yet.</p>
            )}
          </div>

          <div className="room-detail-columns">
            <div>
              <h3>Housekeeping</h3>
              {detail.tasks?.length ? (
                detail.tasks.slice(0, 3).map((task) => (
                  <div key={task._id} className="simple-line">
                    <span>{statusLabel(task.type)}</span>
                    <Badge status={task.status} tone="auto" />
                  </div>
                ))
              ) : (
                <p className="muted small">No recent tasks.</p>
              )}
            </div>
            <div>
              <h3>Maintenance</h3>
              {detail.maintenance?.length ? (
                detail.maintenance.slice(0, 3).map((request) => (
                  <div key={request._id} className="simple-line">
                    <span className="truncate">{request.issue}</span>
                    <Badge status={request.status} tone="auto" />
                  </div>
                ))
              ) : (
                <p className="muted small">No maintenance history.</p>
              )}
            </div>
          </div>

          {['admin', 'manager'].includes(user.role) && (
            <div className="note-panel subtle">
              <Wrench size={16} />
              <p>Room edits, rates and inventory are managed from the room card menu.</p>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

const RoomsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [floor, setFloor] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [roomsRes, typesRes] = await Promise.all([
        api.get('/rooms'),
        api.get('/room-types'),
      ]);
      setRooms(roomsRes.data.rooms);
      setRoomTypes(typesRes.data.roomTypes);
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

  const counts = useMemo(() => {
    const result = { all: rooms.length };
    for (const room of rooms) result[room.status] = (result[room.status] || 0) + 1;
    return result;
  }, [rooms]);

  const floors = useMemo(() => [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b), [rooms]);

  const filtered = useMemo(
    () =>
      rooms.filter((room) => {
        if (status !== 'all' && room.status !== status) return false;
        if (typeFilter && (room.type?._id || room.type) !== typeFilter) return false;
        if (floor && String(room.floor) !== floor) return false;
        if (query) {
          const needle = query.toLowerCase();
          const haystack = `${room.number} ${room.type?.name || ''} ${room.currentBooking?.guest?.firstName || ''} ${room.currentBooking?.guest?.lastName || ''}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      }),
    [rooms, status, typeFilter, floor, query]
  );

  const canManage = ['admin', 'manager'].includes(user.role);

  const quickStatus = async (room, nextStatus) => {
    try {
      await api.patch(`/rooms/${room._id}/status`, { status: nextStatus });
      toast.success(`Room ${room.number} marked ${statusLabel(nextStatus).toLowerCase()}.`);
      load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Housekeeping panel · Inventory & readiness"
        title="Rooms"
        subtitle="A live view of every room, from ready-to-sell to in need of care."
        actions={
          canManage && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} icon={Plus}>
              Add room
            </Button>
          )
        }
      />

      <div className="room-toolbar">
        <div className="status-chips">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`status-chip ${status === filter.key ? 'active' : ''}`}
              onClick={() => setStatus(filter.key)}
            >
              {filter.label}
              <span>{counts[filter.key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="room-toolbar-filters">
          <SearchInput value={query} onChange={setQuery} placeholder="Search room or guest…" />
          <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by room type">
            <option value="">All types</option>
            {roomTypes.map((type) => (
              <option key={type._id} value={type._id}>{type.name}</option>
            ))}
          </Select>
          <Select value={floor} onChange={(event) => setFloor(event.target.value)} aria-label="Filter by floor">
            <option value="">All floors</option>
            {floors.map((item) => (
              <option key={item} value={item}>Floor {item}</option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={BedDouble}
            title="No rooms match these filters"
            message="Try a different status, floor or search term."
            action={<Button variant="outline" onClick={() => { setStatus('all'); setTypeFilter(''); setFloor(''); setQuery(''); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <div className="room-grid">
          {filtered.map((room) => {
            const typeName = room.type?.name || 'Unassigned type';
            const floorLabel = Number.isFinite(Number(room.floor)) ? room.floor : '—';
            const capacity = room.type?.capacity;
            const view = room.view || '—';
            const rate = Number(room.rate) || Number(room.type?.baseRate) || 0;
            const guestName = [room.currentBooking?.guest?.firstName, room.currentBooking?.guest?.lastName]
              .filter(Boolean)
              .join(' ');

            return (
              <article
                key={room._id}
                className={`room-card room-${roomStatusTone[room.status] || 'neutral'} status-${room.status}`}
                onClick={() => setSelectedId(room._id)}
              >
                <div
                  className="room-card-media"
                  style={{ backgroundImage: `url('${roomImage(typeName)}')` }}
                  aria-hidden="true"
                >
                  <span className="room-card-media-type">{typeName}</span>
                </div>
                <div className="room-card-top">
                  <div>
                    <span className="room-floor">Floor {floorLabel}</span>
                    <h3 className="room-number">{room.number || '—'}</h3>
                  </div>
                  <Badge tone={roomStatusTone[room.status] || 'neutral'}>{statusLabel(room.status)}</Badge>
                </div>
                <p className="room-type">{typeName}</p>
                <div className="room-card-info">
                  <span><Users size={14} /> {capacity ? `${capacity} guests` : 'Capacity not set'}</span>
                  <span>{view}</span>
                </div>
                {room.currentBooking ? (
                  <div className="room-card-guest">
                    <Avatar name={guestName || 'Guest'} size="xs" />
                    <span>{guestName || 'In-house guest'}</span>
                    <em>until {formatDate(room.currentBooking.checkOut, { year: undefined })}</em>
                  </div>
                ) : (
                  <div className="room-card-guest empty">
                    <span>{room.status === 'available' ? 'Ready for the next arrival' : 'No guest in house'}</span>
                  </div>
                )}
                <div className="room-card-flags">
                  {room.openTasks > 0 && (
                    <span className="flag flag-task"><Sparkles size={13} /> {room.openTasks} task{room.openTasks > 1 ? 's' : ''}</span>
                  )}
                  {room.openMaintenance > 0 && (
                    <span className="flag flag-maint"><Wrench size={13} /> {room.openMaintenance} issue{room.openMaintenance > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="room-card-foot" onClick={(event) => event.stopPropagation()}>
                  <span className="room-rate">{currency(rate)}<em>/night</em></span>
                  <div className="room-card-actions">
                    {room.status === 'dirty' && (
                      <Button size="xs" variant="outline" onClick={() => quickStatus(room, 'cleaning')}>Start clean</Button>
                    )}
                    {room.status === 'cleaning' && (
                      <Button size="xs" variant="sage" onClick={() => quickStatus(room, 'available')}>Mark ready</Button>
                    )}
                    {canManage ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => { setEditing(room); setFormOpen(true); }}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Button size="xs" variant="ghost" onClick={() => setSelectedId(room._id)}>Details</Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <RoomDetail
        roomId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => load({ quiet: true })}
      />

      {canManage && (
        <RoomFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          room={editing}
          roomTypes={roomTypes}
          onSaved={() => load({ quiet: true })}
        />
      )}
    </div>
  );
};

export default RoomsPage;
