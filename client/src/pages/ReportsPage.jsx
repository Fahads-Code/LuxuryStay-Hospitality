import { useEffect, useMemo, useState } from 'react';
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
import {
  BedDouble,
  CalendarRange,
  CircleDollarSign,
  Download,
  Percent,
  Printer,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import {
  compactCurrency,
  currency,
  downloadBlob,
  formatDate,
  roomStatusTone,
  statusLabel,
  titleCase,
} from '../lib/format.js';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  PageHeader,
  PageLoader,
  Rating,
  Select,
  StatCard,
} from '../components/ui.jsx';

const chartColors = {
  gold: '#c9a45c',
  ink: '#20302d',
  sage: '#7d9988',
  terracotta: '#c07a54',
  blue: '#6c8fa8',
  sand: '#e4d6b8',
  plum: '#8a7184',
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

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const EXPORTS = [
  { type: 'bookings', label: 'Reservations' },
  { type: 'invoices', label: 'Invoices' },
  { type: 'guests', label: 'Guests' },
];

const ReportsPage = () => {
  const toast = useToast();
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [guestAnalytics, setGuestAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [overviewRes, guestsRes] = await Promise.all([
        api.get('/reports/overview', { params: { days: Number(days) } }),
        api.get('/reports/guests'),
      ]);
      setData(overviewRes.data);
      setGuestAnalytics(guestsRes.data);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useLiveRefresh(load);

  const occupancy = useMemo(
    () =>
      (data?.occupancyTrend || []).map((day) => ({
        ...day,
        label: dayLabel(day.date),
      })),
    [data]
  );

  const revenue = useMemo(
    () =>
      (data?.revenueTrend || []).map((month) => ({
        ...month,
        short: month.label.split(' ')[0],
      })),
    [data]
  );

  const sources = useMemo(
    () =>
      (data?.bookingSources || []).map((source) => ({
        ...source,
        label: titleCase(source.source),
      })),
    [data]
  );

  const roomPie = useMemo(
    () =>
      Object.entries(data?.roomStatus || {})
        .filter(([, value]) => value > 0)
        .map(([status, value]) => ({ name: statusLabel(status), value, status })),
    [data]
  );

  const forecast = useMemo(
    () =>
      (data?.forecast || []).map((day) => ({
        ...day,
        short: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      })),
    [data]
  );

  const exportReport = async (type) => {
    setExporting(type);
    try {
      const response = await api.get('/reports/export', {
        params: { type },
        responseType: 'blob',
      });
      downloadBlob(response.data, `${type}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${titleCase(type)} export downloaded.`);
    } catch (error) {
      toast.error('The export could not be prepared. Please try again.');
    } finally {
      setExporting('');
    }
  };

  if (loading) return <PageLoader />;

  if (!data) {
    return (
      <div className="page">
        <PageHeader eyebrow="Insights" title="Reports & analytics" subtitle="The numbers behind the guest experience." />
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Analytics are unavailable"
            message="The reporting service could not be reached. Try refreshing the page."
          />
        </Card>
      </div>
    );
  }

  const kpis = data.kpis;
  const feedback = data.feedback || {};
  const maxRevenue = Math.max(1, ...revenue.map((month) => month.revenue));
  const ratedCategories = [
    { label: 'Cleanliness', value: feedback.cleanliness },
    { label: 'Service', value: feedback.service },
    { label: 'Comfort', value: feedback.comfort },
    { label: 'Value', value: feedback.value },
  ];

  return (
    <div className="page reports-page">
      <PageHeader
        eyebrow="Insights & performance"
        title="Reports & analytics"
        subtitle="Occupancy, revenue and guest sentiment — the full picture of the property."
        actions={
          <>
            <label className="compact-select">
              <CalendarRange size={15} />
              <Select value={days} onChange={(event) => setDays(event.target.value)} aria-label="Reporting period">
                {RANGES.map((range) => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </Select>
            </label>
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <div className="stats-grid">
        <StatCard
          label="Occupancy today"
          value={`${kpis.occupancyRate}%`}
          hint={`${kpis.occupiedRooms} of ${kpis.totalRooms} rooms occupied`}
          icon={BedDouble}
          tone="ink"
          trend={{ label: `${kpis.averageOccupancy}% avg`, positive: true }}
        />
        <StatCard
          label="Revenue · 30 days"
          value={currency(kpis.revenue30Days)}
          hint={`${currency(kpis.revenueMonth)} this month`}
          icon={Wallet}
          tone="gold"
          trend={{ label: `${currency(kpis.adr)} ADR`, positive: true }}
        />
        <StatCard
          label="Outstanding balance"
          value={currency(kpis.outstandingBalance)}
          hint={`${kpis.openInvoices} folios to settle`}
          icon={CircleDollarSign}
          tone="terracotta"
        />
        <StatCard
          label="Guest satisfaction"
          value={Number(kpis.guestSatisfaction || 0).toFixed(1)}
          hint={`${kpis.totalFeedback} reviews · out of 5`}
          icon={Star}
          tone="sage"
          trend={{ label: `${feedback.count || 0} responses`, positive: true }}
        />
      </div>

      <div className="report-grid">
        <Card className="report-wide">
          <CardHead
            title="Occupancy"
            subtitle={`Share of rooms sold over the last ${days} days`}
            action={<span className="card-chip">{kpis.averageOccupancy}% average</span>}
          />
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={occupancy} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.gold} stopOpacity={0.38} />
                    <stop offset="100%" stopColor={chartColors.gold} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke="#e8e1d5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#8b928c' }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.ceil(occupancy.length / 8) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8b928c' }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [`${value}%`, name === 'rate' ? 'Occupancy' : name]}
                  labelStyle={{ color: '#7c847e', marginBottom: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke={chartColors.gold}
                  strokeWidth={2}
                  fill="url(#reportOcc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Room status"
            subtitle={`${kpis.totalRooms} rooms in inventory`}
            action={<Badge tone="sage" dot={false}>{kpis.availableRooms} ready</Badge>}
          />
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={roomPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={82}
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
              <strong>{kpis.occupancyRate}%</strong>
              <span>occupied</span>
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

        <Card className="report-wide">
          <CardHead
            title="Revenue by month"
            subtitle="Collected folios across the last six months"
            action={<span className="card-chip">{currency(kpis.revenueMonth)} this month</span>}
          />
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenue} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="2 6" stroke="#e8e1d5" vertical={false} />
                <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#8b928c' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8b928c' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [currency(value), 'Revenue']}
                  labelStyle={{ color: '#7c847e', marginBottom: 2 }}
                />
                <Bar dataKey="revenue" fill={chartColors.ink} radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead title="Booking sources" subtitle="Where stays originate" />
          {sources.length === 0 ? (
            <EmptyState icon={Users} title="No source data" message="Bookings will populate this breakdown." />
          ) : (
            <div className="source-list">
              {sources.map((source, index) => (
                <div key={source.source} className="source-row">
                  <span className="source-name">{source.label}</span>
                  <span className="source-bar">
                    <i
                      style={{
                        width: `${Math.max(6, (source.count / Math.max(...sources.map((item) => item.count))) * 100)}%`,
                        background: [chartColors.gold, chartColors.sage, chartColors.blue, chartColors.terracotta, chartColors.ink][index % 5],
                      }}
                    />
                  </span>
                  <span className="source-count">{source.count}</span>
                  <span className="source-revenue">{compactCurrency(source.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="report-wide">
          <CardHead
            title="Room type performance"
            subtitle="Revenue and room nights over the last 90 days"
          />
          {data.roomTypePerformance?.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room type</th>
                    <th className="align-right">Bookings</th>
                    <th className="align-right">Room nights</th>
                    <th className="align-right">Revenue</th>
                    <th>Share of revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roomTypePerformance.map((row) => (
                    <tr key={row.roomType}>
                      <td><strong>{row.roomType}</strong></td>
                      <td className="align-right">{row.bookings}</td>
                      <td className="align-right">{row.nights}</td>
                      <td className="align-right"><strong>{currency(row.revenue)}</strong></td>
                      <td>
                        <span className="table-progress">
                          <i style={{ width: `${Math.max(3, (row.revenue / maxRevenue) * 100)}%` }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={BedDouble} title="No room performance yet" message="Completed stays will populate this table." />
          )}
        </Card>

        <Card>
          <CardHead title="Forecast · next 7 nights" subtitle="Projected occupancy and revenue" />
          <div className="forecast-list">
            {forecast.map((day) => (
              <div key={day.date} className="forecast-row">
                <span className="forecast-day">{day.short}</span>
                <span className="forecast-bar">
                  <i style={{ width: `${Math.min(100, day.forecastRate)}%` }} />
                </span>
                <span className="forecast-value">{day.forecastRate}%</span>
                <span className="forecast-revenue">{compactCurrency(day.expectedRevenue)}</span>
              </div>
            ))}
          </div>
          <div className="forecast-foot">
            <TrendingUp size={15} />
            <span>{currency(kpis.adr)} average daily rate across recent stays</span>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Guest sentiment"
            subtitle={`${feedback.count || 0} reviews · ${Number(feedback.overall || 0).toFixed(1)} overall`}
            action={<Rating value={feedback.overall || 0} showValue />}
          />
          <div className="rating-breakdown">
            {ratedCategories.map((category) => (
              <div key={category.label}>
                <span>{category.label}</span>
                <span className="rating-bar">
                  <i style={{ width: `${((category.value || 0) / 5) * 100}%` }} />
                </span>
                <strong>{Number(category.value || 0).toFixed(1)}</strong>
              </div>
            ))}
          </div>
          {data.recentFeedback?.length ? (
            <div className="recent-feedback">
              {data.recentFeedback.slice(0, 2).map((entry) => (
                <div key={entry._id}>
                  <Rating value={entry.ratings?.overall} size={13} />
                  <p>{entry.comments || entry.title}</p>
                  <span>{entry.guest?.firstName} {entry.guest?.lastName} · {formatDate(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No guest comments recorded yet.</p>
          )}
        </Card>

        <Card>
          <CardHead
            title="Top guests"
            subtitle="Highest lifetime spend from completed stays"
            action={
              <span className="card-chip">
                <Users size={13} /> {guestAnalytics?.totalGuests || 0} profiles
              </span>
            }
          />
          {guestAnalytics?.topGuests?.length ? (
            <div className="guest-list">
              {guestAnalytics.topGuests.map((guest) => (
                <div key={guest.name} className="guest-row">
                  <Avatar name={guest.name} size="sm" tone={guest.vip ? 'gold' : 'default'} />
                  <div className="guest-row-copy">
                    <strong>
                      {guest.name}
                      {guest.vip && <span className="vip-dot">VIP</span>}
                    </strong>
                    <span>{guest.stays} completed stay{guest.stays === 1 ? '' : 's'}</span>
                  </div>
                  <strong className="guest-row-value">{currency(guest.spend)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No guest history" message="Completed stays will surface your top guests." />
          )}
          {guestAnalytics && (
            <div className="simple-lines compact-lines">
              <div className="simple-line">
                <span><Percent size={14} /> VIP guests</span>
                <strong>{guestAnalytics.vipGuests}</strong>
              </div>
              <div className="simple-line">
                <span><Users size={14} /> New this month</span>
                <strong>{guestAnalytics.newThisMonth}</strong>
              </div>
            </div>
          )}
        </Card>

        <Card className="report-wide export-card">
          <CardHead
            title="Download reports"
            subtitle="Export a CSV snapshot for finance, operations or ownership."
          />
          <div className="export-actions">
            {EXPORTS.map((item) => (
              <Button
                key={item.type}
                variant="outline"
                icon={Download}
                loading={exporting === item.type}
                onClick={() => exportReport(item.type)}
              >
                {item.label} CSV
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
