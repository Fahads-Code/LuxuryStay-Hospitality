import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BedDouble,
  CalendarPlus,
  Users,
  Wallet,
  Star,
  ArrowUpRight,
  DoorOpen,
  Sparkles,
  Wrench,
  ClipboardCheck,
  ArrowRight,
  ConciergeBell,
  TrendingUp,
  CircleCheck,
  Clock3,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  bookingStatusTone,
  currency,
  formatDate,
  roleLabel,
  roomStatusTone,
  statusLabel,
} from '../lib/format.js';
import {
  Avatar,
  Badge,
  Card,
  CardHead,
  EmptyState,
  PageHeader,
  PageLoader,
  Rating,
  StatCard,
} from '../components/ui.jsx';

const chartColors = {
  gold: '#c9a45c',
  ink: '#20302d',
  sage: '#7d9988',
  terracotta: '#c07a54',
  blue: '#6c8fa8',
  sand: '#e4d6b8',
};

const tooltipStyle = {
  background: '#fffdf9',
  border: '1px solid #e6dfd2',
  borderRadius: 12,
  boxShadow: '0 16px 40px rgba(20,32,31,.12)',
  fontSize: 12,
  color: '#1b2523',
  padding: '8px 12px',
};

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const DashboardPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [desk, setDesk] = useState({ rooms: [], tasks: [], maintenance: [] });

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      if (user.role === 'housekeeping') {
        const [roomsRes, tasksRes, maintRes] = await Promise.all([
          api.get('/rooms'),
          api.get('/housekeeping?assignedTo=me&limit=50'),
          api.get('/maintenance?status=open&limit=20'),
        ]);
        setDesk({
          rooms: roomsRes.data.rooms,
          tasks: tasksRes.data.tasks,
          maintenance: maintRes.data.requests,
        });
      } else {
        const { data: overview } = await api.get('/reports/overview?days=14');
        setData(overview);
      }
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  useLiveRefresh(load);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (loading) return <PageLoader />;

  if (user.role === 'housekeeping') {
    const dirty = desk.rooms.filter((room) => room.status === 'dirty').length;
    const cleaning = desk.rooms.filter((room) => room.status === 'cleaning').length;
    const available = desk.rooms.filter((room) => room.status === 'available').length;
    const pendingTasks = desk.tasks.filter((task) => task.status !== 'completed');

    const floorMap = new Map();
    for (const room of desk.rooms) {
      const key = Number.isFinite(Number(room.floor)) ? Number(room.floor) : 0;
      if (!floorMap.has(key)) {
        floorMap.set(key, {
          floor: key,
          total: 0,
          available: 0,
          occupied: 0,
          dirty: 0,
          cleaning: 0,
          maintenance: 0,
          out_of_order: 0,
        });
      }
      const row = floorMap.get(key);
      row.total += 1;
      if (row[room.status] !== undefined) row[room.status] += 1;
    }
    const floors = [...floorMap.values()].sort((a, b) => a.floor - b.floor);

    const attentionOrder = { dirty: 0, cleaning: 1, maintenance: 2, out_of_order: 3 };
    const attentionRooms = desk.rooms
      .filter((room) => attentionOrder[room.status] !== undefined)
      .sort(
        (a, b) =>
          attentionOrder[a.status] - attentionOrder[b.status] ||
          Number(a.floor) - Number(b.floor) ||
          String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true })
      );

    return (
      <div className="page">
        <PageHeader
          eyebrow={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
          title={`${greeting}, ${user.name.split(' ')[0]}.`}
          subtitle="Your rooms and tasks for today, all in one calm view."
          actions={
            <Link to="/app/housekeeping" className="btn btn-primary">
              <Sparkles size={16} /> Open housekeeping board
            </Link>
          }
        />

        <div className="stats-grid">
          <StatCard label="Rooms to clean" value={dirty} hint="Awaiting attention" icon={Sparkles} tone="terracotta" />
          <StatCard label="My open tasks" value={pendingTasks.length} hint="Assigned to you" icon={ClipboardCheck} tone="gold" />
          <StatCard label="Rooms in progress" value={cleaning} hint="Being serviced now" icon={Clock3} />
          <StatCard label="Rooms ready" value={available} hint="Available tonight" icon={CircleCheck} tone="sage" />
        </div>

        <div className="dash-main">
          <div className="dash-col-main">
            <Card>
              <CardHead
                title="Floor readiness"
                subtitle="A floor-by-floor plan for the team — open the room board for the full grid"
                action={
                  <Link to="/app/rooms" className="text-link">
                    Room board <ArrowRight size={14} />
                  </Link>
                }
              />
              {floors.length === 0 ? (
                <EmptyState
                  icon={BedDouble}
                  title="No rooms to show"
                  message="Add rooms to the inventory to see floor readiness here."
                />
              ) : (
                <div className="floor-list">
                  {floors.map((floor) => {
                    const ready = floor.available;
                    return (
                      <div key={floor.floor} className="floor-row">
                        <span className="floor-label">
                          <strong>Floor {floor.floor || '—'}</strong>
                          <em>{floor.total} room{floor.total === 1 ? '' : 's'}</em>
                        </span>
                        <span className="floor-bar" aria-hidden="true">
                          {['available', 'occupied', 'dirty', 'cleaning', 'maintenance', 'out_of_order'].map(
                            (status) =>
                              floor[status] > 0 && (
                                <span
                                  key={status}
                                  className={`floor-seg seg-${status}`}
                                  style={{ width: `${(floor[status] / floor.total) * 100}%` }}
                                />
                              )
                          )}
                        </span>
                        <span className="floor-counts">
                          {floor.dirty > 0 && (
                            <span className="floor-count">
                              <i className="legend-dot legend-terracotta" /> {floor.dirty} dirty
                            </span>
                          )}
                          {floor.cleaning > 0 && (
                            <span className="floor-count">
                              <i className="legend-dot legend-blue" /> {floor.cleaning} cleaning
                            </span>
                          )}
                          {floor.maintenance + floor.out_of_order > 0 && (
                            <span className="floor-count">
                              <i className="legend-dot legend-amber" /> {floor.maintenance + floor.out_of_order} repair
                            </span>
                          )}
                          <span className="floor-count floor-count-ready">
                            <i className="legend-dot legend-sage" /> {ready} ready
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {attentionRooms.length > 0 && (
                <div className="floor-attention">
                  <span className="floor-attention-label">Needs attention</span>
                  {attentionRooms.slice(0, 10).map((room) => (
                    <Link
                      key={room._id}
                      to="/app/rooms"
                      className="floor-room-chip"
                      title={`Room ${room.number || '—'} · ${statusLabel(room.status)}`}
                    >
                      <i className={`legend-dot legend-${roomStatusTone[room.status]}`} />
                      {room.number || '—'}
                    </Link>
                  ))}
                  {attentionRooms.length > 10 && (
                    <span className="floor-more">+{attentionRooms.length - 10} more</span>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHead
                title="My tasks"
                subtitle={`${pendingTasks.length} open assignment${pendingTasks.length === 1 ? '' : 's'}`}
                action={
                  <Link to="/app/housekeeping" className="text-link">
                    Board <ArrowRight size={14} />
                  </Link>
                }
              />
              {pendingTasks.length === 0 ? (
                <EmptyState
                  icon={CircleCheck}
                  title="All caught up"
                  message="No tasks are assigned to you right now."
                />
              ) : (
                <div className="mini-task-list">
                  {pendingTasks.slice(0, 6).map((task) => (
                    <Link key={task._id} to="/app/housekeeping" className="mini-task">
                      <span className={`mini-task-room priority-${task.priority}`}>{task.room?.number}</span>
                      <span className="mini-task-copy">
                        <strong>{statusLabel(task.type)}</strong>
                        <em>
                          {task.room?.floor}F · {task.notes || 'Housekeeping service'}
                        </em>
                      </span>
                      <Badge tone={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'amber' : 'neutral'}>
                        {statusLabel(task.priority)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="dash-col-side">
            <Card>
              <CardHead title="Open maintenance" subtitle="Reported across the property" />
              {desk.maintenance.length === 0 ? (
                <EmptyState icon={Wrench} title="No open issues" message="Everything is in working order." />
              ) : (
                <div className="mini-task-list">
                  {desk.maintenance.slice(0, 5).map((request) => (
                    <Link key={request._id} to="/app/maintenance" className="mini-task">
                      <span className={`mini-task-room priority-${request.priority}`}>
                        {request.room?.number}
                      </span>
                      <span className="mini-task-copy">
                        <strong>{request.issue}</strong>
                        <em>{request.category}</em>
                      </span>
                      <Badge tone={request.priority === 'urgent' ? 'red' : request.priority === 'high' ? 'terracotta' : 'neutral'}>
                        {statusLabel(request.priority)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card className="quick-card">
              <CardHead title="Quick links" subtitle="Tools for your shift" />
              <div className="quick-actions">
                <Link to="/app/rooms" className="quick-action">
                  <BedDouble size={18} /><span>Rooms</span><ArrowUpRight size={14} />
                </Link>
                <Link to="/app/services" className="quick-action">
                  <ConciergeBell size={18} /><span>Guest services</span><ArrowUpRight size={14} />
                </Link>
                <Link to="/app/maintenance" className="quick-action">
                  <Wrench size={18} /><span>Maintenance</span><ArrowUpRight size={14} />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <PageHeader title={`${greeting}, ${user.name.split(' ')[0]}.`} subtitle="We could not load the dashboard." />
      </div>
    );
  }

  const kpis = data.kpis;
  const roomPie = Object.entries(data.roomStatus)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({ name: statusLabel(status), value, status }));
  const statusTotal = roomPie.reduce((sum, item) => sum + item.value, 0);
  const trend = data.occupancyTrend.map((day) => ({ ...day, label: dayLabel(day.date) }));
  const revenue = data.revenueTrend.map((month) => ({ ...month, label: month.label.split(' ')[0] }));
  const forecast = data.forecast.map((day) => ({
    ...day,
    short: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
  }));

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting}, ${user.name.split(' ')[0]}.`}
        subtitle={`Here is how ${roleLabel(user.role).toLowerCase() === 'administrator' ? 'the hotel' : 'your property'} is moving today.`}
        actions={
          <>
            {['admin', 'manager', 'receptionist'].includes(user.role) && (
              <Link to="/app/bookings?new=1" className="btn btn-outline">
                <CalendarPlus size={16} /> New reservation
              </Link>
            )}
            <Link to="/app/front-desk" className="btn btn-primary">
              <DoorOpen size={16} /> Front desk
            </Link>
          </>
        }
      />

      <div className="stats-grid">
        <StatCard
          label="Occupancy today"
          value={`${kpis.occupancyRate}%`}
          hint={`${kpis.occupiedRooms} of ${kpis.totalRooms} rooms in house`}
          icon={BedDouble}
          tone="ink"
          trend={{ label: `${kpis.averageOccupancy}% avg`, positive: true }}
        />
        <StatCard
          label="Revenue this month"
          value={currency(kpis.revenueMonth)}
          hint={`${currency(kpis.revenueToday)} collected today`}
          icon={Wallet}
          tone="gold"
          trend={{ label: `${currency(kpis.adr)} ADR`, positive: true }}
        />
        <StatCard
          label="Arrivals today"
          value={kpis.arrivalsToday}
          hint={`${kpis.departuresToday} departures expected`}
          icon={Users}
          tone="sage"
        />
        <StatCard
          label="Guest satisfaction"
          value={Number(kpis.guestSatisfaction || 0).toFixed(1)}
          hint={`${kpis.totalFeedback} guest reviews`}
          icon={Star}
          tone="terracotta"
          trend={{ label: 'out of 5', positive: true }}
        />
      </div>

      <div className="dash-main">
        <div className="dash-col-main">
          <Card>
            <CardHead
              title="Occupancy rhythm"
              subtitle="Occupied rooms as a share of inventory, last 14 days"
              action={<span className="card-chip">{kpis.averageOccupancy}% average</span>}
            />
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.gold} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartColors.gold} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="#e8e1d5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8b928c' }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: '#8b928c' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [`${value}%`, name === 'rate' ? 'Occupancy' : name]}
                    labelStyle={{ color: '#7c847e', marginBottom: 2 }}
                  />
                  <Area type="monotone" dataKey="rate" stroke={chartColors.gold} strokeWidth={2} fill="url(#occFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="dash-split">
            <Card>
              <CardHead
                title="Arrivals today"
                subtitle="Guests due to check in"
                action={
                  <Link to="/app/front-desk" className="text-link">
                    Desk <ArrowRight size={14} />
                  </Link>
                }
              />
              {data.arrivals.length === 0 ? (
                <EmptyState icon={DoorOpen} title="No arrivals today" message="A quieter day at the front desk." />
              ) : (
                <div className="guest-list">
                  {data.arrivals.slice(0, 5).map((booking) => (
                    <Link key={booking._id} to={`/app/bookings/${booking._id}`} className="guest-row">
                      <Avatar name={`${booking.guest?.firstName} ${booking.guest?.lastName}`} size="sm" />
                      <div className="guest-row-copy">
                        <strong>
                          {booking.guest?.firstName} {booking.guest?.lastName}
                          {booking.guest?.vip && <span className="vip-dot" title="VIP">VIP</span>}
                        </strong>
                        <span>
                          Room {booking.room?.number} · {booking.nights} nights
                        </span>
                      </div>
                      <Badge status={booking.status} tone="auto" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHead
                title="Departures today"
                subtitle="Stays ending this morning"
              />
              {data.departures.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="No departures" message="No check-outs are due today." />
              ) : (
                <div className="guest-list">
                  {data.departures.slice(0, 5).map((booking) => (
                    <Link key={booking._id} to={`/app/bookings/${booking._id}`} className="guest-row">
                      <Avatar name={`${booking.guest?.firstName} ${booking.guest?.lastName}`} size="sm" />
                      <div className="guest-row-copy">
                        <strong>
                          {booking.guest?.firstName} {booking.guest?.lastName}
                        </strong>
                        <span>Room {booking.room?.number} · folio to settle</span>
                      </div>
                      <Badge status="checked_in" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <CardHead
              title="Revenue by month"
              subtitle="Collected folios, last six months"
              action={<span className="card-chip">{currency(kpis.outstandingBalance)} outstanding</span>}
            />
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={revenue} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="2 6" stroke="#e8e1d5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8b928c' }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#8b928c' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [currency(value), 'Revenue']}
                    labelStyle={{ color: '#7c847e', marginBottom: 2 }}
                  />
                  <Bar dataKey="revenue" fill={chartColors.ink} radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="dash-col-side">
          <Card>
            <CardHead
              title="Room status"
              subtitle={`${statusTotal} rooms in inventory`}
              action={
                ['admin', 'manager'].includes(user.role) ? (
                  <Link to="/app/rooms" className="text-link">
                    View <ArrowRight size={14} />
                  </Link>
                ) : null
              }
            />
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie
                    data={roomPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {roomPie.map((entry) => (
                      <Cell key={entry.status} fill={chartColors[roomStatusTone[entry.status]] || chartColors.sand} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} rooms`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{kpis.availableRooms}</strong>
                <span>ready</span>
              </div>
            </div>
            <div className="donut-legend">
              {roomPie.map((entry) => (
                <span key={entry.status}>
                  <i className={`legend-dot legend-${roomStatusTone[entry.status]}`} />
                  {entry.name}
                  <b>{entry.value}</b>
                </span>
              ))}
            </div>
          </Card>

          <Card className="forecast-card">
            <CardHead
              title="Next 7 nights"
              subtitle="Projected occupancy"
              action={['admin', 'manager'].includes(user.role) ? (
                <Link to="/app/reports" className="text-link">
                  Report <ArrowRight size={14} />
                </Link>
              ) : null}
            />
            <div className="forecast-list">
              {forecast.map((day) => (
                <div key={day.date} className="forecast-row">
                  <span className="forecast-day">{day.short}</span>
                  <span className="forecast-bar">
                    <i style={{ width: `${Math.min(100, day.forecastRate)}%` }} />
                  </span>
                  <span className="forecast-value">{day.forecastRate}%</span>
                </div>
              ))}
            </div>
            <div className="forecast-foot">
              <TrendingUp size={15} />
              <span>
                {currency(kpis.revenue30Days)} collected in the last 30 days
              </span>
            </div>
          </Card>

          <Card>
            <CardHead title="At a glance" subtitle="Operational pulse" />
            <div className="pulse-list">
              <div>
                <span className="pulse-icon sage"><BedDouble size={16} /></span>
                <span>In-house guests</span>
                <strong>{kpis.inHouseGuests}</strong>
              </div>
              <div>
                <span className="pulse-icon gold"><Sparkles size={16} /></span>
                <span>Pending housekeeping</span>
                <strong>{kpis.pendingHousekeeping}</strong>
              </div>
              <div>
                <span className="pulse-icon terracotta"><Wrench size={16} /></span>
                <span>Open maintenance</span>
                <strong>{kpis.openMaintenance}</strong>
              </div>
              <div>
                <span className="pulse-icon blue"><Users size={16} /></span>
                <span>Bookings this month</span>
                <strong>{kpis.bookingsThisMonth}</strong>
              </div>
            </div>
            <Link to="/app/bookings?new=1" className="quick-new">
              <CalendarPlus size={16} /> Create a reservation
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
