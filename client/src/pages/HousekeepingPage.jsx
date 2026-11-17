import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilterX,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  formatDateTime,
  statusLabel,
  todayISO,
} from '../lib/format.js';
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
  StatCard,
  Tabs,
  Textarea,
  Toggle,
} from '../components/ui.jsx';

const TASK_TYPES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'deep_clean', label: 'Deep clean' },
  { value: 'turndown', label: 'Turndown' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'linen_change', label: 'Linen change' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STATUS_TONE = {
  pending: 'amber',
  in_progress: 'blue',
  completed: 'sage',
  cancelled: 'red',
};

const PRIORITY_TONE = {
  low: 'neutral',
  medium: 'amber',
  high: 'red',
};

const TABS = [
  { key: 'all', label: 'All tasks' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const TaskFormModal = ({ open, onClose, task, rooms, staff, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    room: '',
    type: 'cleaning',
    priority: 'medium',
    status: 'pending',
    assignedTo: '',
    scheduledFor: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        room: task.room?._id || task.room || '',
        type: task.type || 'cleaning',
        priority: task.priority || 'medium',
        status: task.status || 'pending',
        assignedTo: task.assignedTo?._id || task.assignedTo || '',
        scheduledFor: toLocalInput(task.scheduledFor),
        notes: task.notes || '',
      });
    } else {
      setForm({
        room: rooms[0]?._id || '',
        type: 'cleaning',
        priority: 'medium',
        status: 'pending',
        assignedTo: '',
        scheduledFor: `${todayISO()}T09:00`,
        notes: '',
      });
    }
  }, [open, task, rooms]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        priority: form.priority,
        assignedTo: form.assignedTo || null,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
        notes: form.notes,
      };
      if (task) {
        await api.patch(`/housekeeping/${task._id}`, { ...payload, status: form.status });
        toast.success('Housekeeping task updated.');
      } else {
        await api.post('/housekeeping', { ...payload, room: form.room });
        toast.success('Housekeeping task created.');
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
      title={task ? `Edit task · Room ${task.room?.number || ''}` : 'New housekeeping task'}
      subtitle="Keep the room ready for the next guest with a clear brief."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Sparkles}>
            {task ? 'Save task' : 'Create task'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <Field label="Room" required>
            <Select
              value={form.room}
              onChange={(event) => setForm({ ...form, room: event.target.value })}
              disabled={Boolean(task)}
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
          <Field label="Task type" required>
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {TASK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-row three">
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
          <Field label="Scheduled for">
            <Input
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
            />
          </Field>
        </div>
        {task && (
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        )}
        <Field label="Notes">
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Linen changes, turndown requests or anything the attendant should know."
          />
        </Field>
      </form>
    </Modal>
  );
};

const HousekeepingPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, completed: 0, cancelled: 0 });
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [myTasks, setMyTasks] = useState(user.role === 'housekeeping');
  const [roomFilter, setRoomFilter] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const canManage = ['admin', 'manager'].includes(user.role);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const requests = [
        api.get('/housekeeping', {
          params: {
            limit: 100,
            ...(status !== 'all' ? { status } : {}),
            ...(myTasks ? { assignedTo: 'me' } : {}),
            ...(roomFilter ? { room: roomFilter } : {}),
            ...(date ? { date } : {}),
          },
        }),
        api.get('/rooms'),
      ];

      if (['admin', 'manager'].includes(user.role)) {
        requests.push(api.get('/users', { params: { limit: 200 } }));
      }

      const [tasksRes, roomsRes, usersRes] = await Promise.all(requests);
      setTasks(tasksRes.data.tasks);
      setCounts(tasksRes.data.counts);
      setRooms(roomsRes.data.rooms);
      const team = usersRes?.data?.users || [user];
      setStaff(team.filter((person) => ['housekeeping', 'manager', 'admin'].includes(person.role)));
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, myTasks, roomFilter, date]);

  useLiveRefresh(load);

  const stats = useMemo(
    () => [
      { label: 'Pending', value: counts.pending, hint: 'Awaiting assignment or start', icon: ClipboardCheck, tone: 'gold' },
      { label: 'In progress', value: counts.in_progress, hint: 'Rooms being serviced', icon: Clock3, tone: 'blue' },
      { label: 'Completed', value: counts.completed, hint: 'Recorded in the log', icon: CheckCircle2, tone: 'sage' },
      { label: 'My open tasks', value: tasks.filter((task) => (task.assignedTo?._id || task.assignedTo) === (user.id || user._id) && task.status !== 'completed').length, hint: myTasks ? 'Your assignments' : 'On this view', icon: UserRound, tone: 'terracotta' },
    ],
    [counts, tasks, myTasks, user]
  );

  const changeStatus = async (task, next) => {
    setBusy(task._id + next);
    try {
      await api.patch(`/housekeeping/${task._id}`, { status: next });
      toast.success(
        next === 'completed'
          ? `Room ${task.room?.number || ''} marked ready.`
          : `Task moved to ${statusLabel(next).toLowerCase()}.`
      );
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await api.delete(`/housekeeping/${removeTarget._id}`);
      toast.success('Task removed.');
      setRemoveTarget(null);
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(false);
    }
  };

  const clearFilters = () => {
    setStatus('all');
    setMyTasks(false);
    setRoomFilter('');
    setDate('');
  };

  const filtersActive = status !== 'all' || myTasks || roomFilter || date;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Housekeeping panel · Room readiness"
        title="Housekeeping"
        subtitle="A calm, clear board for every clean, turndown and inspection."
        actions={
          <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>
            New task
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
          title="Task board"
          subtitle="Move tasks through the day and keep room status in sync."
          action={
            <div className="table-tools">
              <Toggle checked={myTasks} onChange={setMyTasks} label="My tasks" />
              <Button variant="outline" size="sm" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add
              </Button>
            </div>
          }
        />

        <Tabs items={TABS} value={status} onChange={setStatus} />

        <div className="filter-bar">
          <label className="filter-field">
            <span>Room</span>
            <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option value="">All rooms</option>
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>Room {room.number}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Scheduled date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Clear filters</Button>
          )}
          <span className="filter-count">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={filtersActive ? 'No tasks match' : 'The board is clear'}
            message={filtersActive ? 'Try another status, room or date.' : 'New tasks appear here as stays depart and rooms need attention.'}
            action={filtersActive && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="task-list">
            {tasks.map((task) => {
              const assignedName = task.assignedTo?.name;
              const done = task.status === 'completed';
              const cancelled = task.status === 'cancelled';
              return (
                <article key={task._id} className={`task-row task-${task.status}`}>
                  <span className={`task-room priority-${task.priority}`}>{task.room?.number || '—'}</span>
                  <div className="task-copy">
                    <div className="task-title">
                      <strong>{statusLabel(task.type)}</strong>
                      <Badge tone={STATUS_TONE[task.status] || 'neutral'}>{statusLabel(task.status)}</Badge>
                      <Badge tone={PRIORITY_TONE[task.priority] || 'neutral'} dot={false}>
                        {statusLabel(task.priority)} priority
                      </Badge>
                    </div>
                    <div className="task-meta">
                      <span>Floor {task.room?.floor ?? '—'}</span>
                      <span><CalendarClock size={13} /> {formatDateTime(task.scheduledFor)}</span>
                      <span><UserRound size={13} /> {assignedName || 'Unassigned'}</span>
                    </div>
                    {task.notes && <p className="task-note">{task.notes}</p>}
                  </div>
                  <div className="task-actions">
                    {task.status === 'pending' && (
                      <Button size="xs" variant="outline" icon={Play} loading={busy === task._id + 'in_progress'} onClick={() => changeStatus(task, 'in_progress')}>
                        Start
                      </Button>
                    )}
                    {['pending', 'in_progress'].includes(task.status) && (
                      <Button size="xs" variant="sage" icon={CheckCircle2} loading={busy === task._id + 'completed'} onClick={() => changeStatus(task, 'completed')}>
                        Complete
                      </Button>
                    )}
                    {!done && !cancelled && (
                      <Button size="xs" variant="ghost" icon={XCircle} onClick={() => changeStatus(task, 'cancelled')}>
                        Cancel
                      </Button>
                    )}
                    {!done && !cancelled && (
                      <Button size="xs" variant="ghost" icon={Pencil} onClick={() => { setEditing(task); setFormOpen(true); }}>
                        Edit
                      </Button>
                    )}
                    {canManage && !done && (
                      <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoveTarget(task)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        task={editing}
        rooms={rooms}
        staff={staff.length ? staff : [user]}
        onSaved={() => load({ quiet: true })}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        title="Remove this task?"
        message="Only incomplete tasks can be removed. Completed work stays in the housekeeping log."
        confirmLabel="Remove task"
        loading={removing}
      />
    </div>
  );
};

export default HousekeepingPage;
