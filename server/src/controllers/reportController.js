import { Booking, BLOCKING_BOOKING_STATUSES } from '../models/Booking.js';
import { Room } from '../models/Room.js';
import { Invoice } from '../models/Invoice.js';
import { Guest } from '../models/Guest.js';
import { Feedback } from '../models/Feedback.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { HousekeepingTask } from '../models/HousekeepingTask.js';
import { RoomType } from '../models/RoomType.js';
import { asyncHandler } from '../utils/ApiError.js';
import {
  addDays,
  addMonths,
  eachDay,
  endOfDay,
  isoDay,
  monthKey,
  monthLabel,
  startOfDay,
} from '../utils/dates.js';

const OCCUPYING_STATUSES = ['confirmed', 'checked_in', 'checked_out'];

const getRoomCount = () => Room.countDocuments({ isActive: true });

const bookingsInRange = (from, to) =>
  Booking.find({
    status: { $in: OCCUPYING_STATUSES },
    checkIn: { $lt: endOfDay(to) },
    checkOut: { $gt: startOfDay(from) },
  })
    .select('room checkIn checkOut totalAmount roomTotal nights status')
    .lean();

export const occupancySeries = async ({ from, to }) => {
  const [rooms, bookings] = await Promise.all([
    getRoomCount(),
    bookingsInRange(from, to),
  ]);
  const days = eachDay(from, addDays(to, 1)).map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const occupied = new Set();
    for (const booking of bookings) {
      if (new Date(booking.checkIn) < dayEnd && new Date(booking.checkOut) > dayStart) {
        occupied.add(String(booking.room));
      }
    }
    return {
      date: isoDay(day),
      occupied: occupied.size,
      rooms,
      rate: rooms ? Math.round((occupied.size / rooms) * 1000) / 10 : 0,
    };
  });
  return { days, rooms, bookings };
};

const revenueByMonth = async (months = 6) => {
  const start = startOfDay(addMonths(startOfDay(new Date()), -(months - 1)));
  start.setDate(1);
  const rows = await Invoice.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
        revenue: { $sum: '$amountPaid' },
        invoices: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const map = new Map(rows.map((row) => [row._id, row]));
  return Array.from({ length: months }, (_, index) => {
    const date = addMonths(start, index);
    const key = monthKey(date);
    const row = map.get(key);
    return {
      month: key,
      label: monthLabel(date),
      revenue: Math.round((row?.revenue || 0) * 100) / 100,
      invoices: row?.invoices || 0,
    };
  });
};

const bookingSourceBreakdown = async (days = 90) => {
  const rows = await Booking.aggregate([
    {
      $match: {
        checkIn: { $gte: addDays(startOfDay(new Date()), -days) },
        status: { $nin: ['cancelled'] },
      },
    },
    { $group: { _id: '$source', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({
    source: row._id,
    count: row.count,
    revenue: Math.round(row.revenue * 100) / 100,
  }));
};

const roomTypePerformance = async (days = 90) => {
  const rows = await Booking.aggregate([
    {
      $match: {
        checkIn: { $gte: addDays(startOfDay(new Date()), -days) },
        status: { $nin: ['cancelled', 'no_show'] },
      },
    },
    {
      $group: {
        _id: '$roomType',
        bookings: { $sum: 1 },
        nights: { $sum: '$nights' },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
  const types = await RoomType.find().select('name baseRate').lean();
  const typeMap = new Map(types.map((type) => [String(type._id), type]));
  return rows.map((row) => ({
    roomType: typeMap.get(String(row._id))?.name || 'Unassigned',
    bookings: row.bookings,
    nights: row.nights,
    revenue: Math.round(row.revenue * 100) / 100,
  }));
};

const feedbackSummary = async () => {
  const rows = await Feedback.aggregate([
    {
      $group: {
        _id: null,
        overall: { $avg: '$ratings.overall' },
        cleanliness: { $avg: '$ratings.cleanliness' },
        service: { $avg: '$ratings.service' },
        comfort: { $avg: '$ratings.comfort' },
        value: { $avg: '$ratings.value' },
        count: { $sum: 1 },
      },
    },
  ]);
  const stats = rows[0] || {
    overall: 0,
    cleanliness: 0,
    service: 0,
    comfort: 0,
    value: 0,
    count: 0,
  };
  const round = (value) => Math.round((value || 0) * 10) / 10;
  return {
    overall: round(stats.overall),
    cleanliness: round(stats.cleanliness),
    service: round(stats.service),
    comfort: round(stats.comfort),
    value: round(stats.value),
    count: stats.count,
  };
};

const forecastDays = async (days = 7) => {
  const today = startOfDay(new Date());
  const historyStart = addDays(today, -56);
  const history = await occupancySeries({ from: historyStart, to: addDays(today, -1) });
  const weekdayHistory = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const day of history.days) {
    const weekday = new Date(day.date).getDay();
    weekdayHistory[weekday].total += day.rate;
    weekdayHistory[weekday].count += 1;
  }
  const historicalRate = (date) => {
    const item = weekdayHistory[new Date(date).getDay()];
    return item.count ? item.total / item.count : 0;
  };

  const future = await occupancySeries({ from: today, to: addDays(today, days - 1) });
  const adrRow = await Booking.aggregate([
    {
      $match: {
        status: { $in: ['checked_in', 'checked_out'] },
        checkIn: { $gte: addDays(today, -90) },
      },
    },
    { $group: { _id: null, avgRate: { $avg: '$ratePerNight' } } },
  ]);
  const adr = Math.round((adrRow[0]?.avgRate || 0) * 100) / 100;

  return future.days.map((day) => {
    const expected = Math.max(day.rate, historicalRate(day.date));
    const predictedRooms = Math.round((expected / 100) * day.rooms);
    return {
      date: day.date,
      label: new Date(day.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      bookedRooms: day.occupied,
      bookedRate: day.rate,
      forecastRate: Math.round(expected * 10) / 10,
      expectedRevenue: Math.round(predictedRooms * adr * 100) / 100,
    };
  });
};

export const getOverview = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
  const today = startOfDay(new Date());
  const monthStart = startOfDay(new Date());
  monthStart.setDate(1);

  const [
    rooms,
    occupiedToday,
    inHouse,
    arrivals,
    departures,
    roomsByStatus,
    monthInvoices,
    todayInvoices,
    outstandingRow,
    bookingsThisMonth,
    openMaintenance,
    pendingTasks,
    feedback,
    trend,
    revenue,
    sources,
    performance,
    forecast,
    upcoming,
    recentFeedback,
  ] = await Promise.all([
    getRoomCount(),
    Booking.countDocuments({
      status: 'checked_in',
      checkIn: { $lte: endOfDay(today) },
      checkOut: { $gt: today },
    }),
    Booking.countDocuments({ status: 'checked_in' }),
    Booking.find({
      status: { $in: ['confirmed', 'pending'] },
      checkIn: { $gte: today, $lte: endOfDay(today) },
    })
      .populate('guest', 'firstName lastName vip')
      .populate('room', 'number')
      .sort({ checkIn: 1 })
      .limit(8)
      .lean(),
    Booking.find({
      status: 'checked_in',
      checkOut: { $gte: today, $lte: endOfDay(today) },
    })
      .populate('guest', 'firstName lastName vip')
      .populate('room', 'number')
      .limit(8)
      .lean(),
    Room.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: monthStart } } },
      { $group: { _id: null, revenue: { $sum: '$amountPaid' }, invoices: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: today } } },
      { $group: { _id: null, revenue: { $sum: '$amountPaid' }, invoices: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: ['unpaid', 'partial'] } } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: { $subtract: ['$total', '$amountPaid'] } },
          invoices: { $sum: 1 },
        },
      },
    ]),
    Booking.countDocuments({
      checkIn: { $gte: monthStart },
      status: { $nin: ['cancelled'] },
    }),
    MaintenanceRequest.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    HousekeepingTask.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
    feedbackSummary(),
    occupancySeries({ from: addDays(today, -(days - 1)), to: today }),
    revenueByMonth(6),
    bookingSourceBreakdown(),
    roomTypePerformance(),
    forecastDays(7),
    Booking.find({ checkIn: { $gte: today }, status: { $in: ['confirmed', 'pending'] } })
      .populate('guest', 'firstName lastName vip')
      .populate('room', 'number')
      .sort({ checkIn: 1 })
      .limit(6)
      .lean(),
    Feedback.find().populate('guest', 'firstName lastName').sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const statusMap = roomsByStatus.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});
  const periodRevenue = await Invoice.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: addDays(today, -29) } } },
    { $group: { _id: null, total: { $sum: '$amountPaid' } } },
  ]);
  const periodRoomNights = trend.bookings
    .filter((booking) => ['checked_in', 'checked_out'].includes(booking.status))
    .reduce((sum, booking) => sum + (booking.nights || 0), 0);
  const periodRoomRevenue = trend.bookings
    .filter((booking) => ['checked_in', 'checked_out'].includes(booking.status))
    .reduce((sum, booking) => sum + (booking.roomTotal || 0), 0);
  const avgOccupancy = trend.days.length
    ? Math.round((trend.days.reduce((sum, day) => sum + day.rate, 0) / trend.days.length) * 10) / 10
    : 0;

  res.json({
    generatedAt: new Date(),
    kpis: {
      occupancyRate: rooms ? Math.round((occupiedToday / rooms) * 1000) / 10 : 0,
      averageOccupancy: avgOccupancy,
      totalRooms: rooms,
      occupiedRooms: occupiedToday,
      inHouseGuests: inHouse,
      availableRooms: statusMap.available || 0,
      dirtyRooms: statusMap.dirty || 0,
      maintenanceRooms: (statusMap.maintenance || 0) + (statusMap.out_of_order || 0),
      arrivalsToday: arrivals.length,
      departuresToday: departures.length,
      revenueToday: Math.round((todayInvoices[0]?.revenue || 0) * 100) / 100,
      revenueMonth: Math.round((monthInvoices[0]?.revenue || 0) * 100) / 100,
      revenue30Days: Math.round((periodRevenue[0]?.total || 0) * 100) / 100,
      outstandingBalance: Math.round((outstandingRow[0]?.outstanding || 0) * 100) / 100,
      openInvoices: outstandingRow[0]?.invoices || 0,
      bookingsThisMonth,
      adr: periodRoomNights ? Math.round((periodRoomRevenue / periodRoomNights) * 100) / 100 : 0,
      openMaintenance,
      pendingHousekeeping: pendingTasks,
      guestSatisfaction: feedback.overall,
      totalFeedback: feedback.count,
    },
    roomStatus: {
      available: statusMap.available || 0,
      occupied: statusMap.occupied || 0,
      dirty: statusMap.dirty || 0,
      cleaning: statusMap.cleaning || 0,
      maintenance: statusMap.maintenance || 0,
      out_of_order: statusMap.out_of_order || 0,
    },
    arrivals,
    departures,
    occupancyTrend: trend.days,
    revenueTrend: revenue,
    bookingSources: sources,
    roomTypePerformance: performance,
    feedback,
    forecast,
    upcomingArrivals: upcoming,
    recentFeedback,
  });
});

export const getOccupancy = asyncHandler(async (req, res) => {
  const days = Math.min(120, Math.max(7, Number(req.query.days) || 30));
  const today = startOfDay(new Date());
  const series = await occupancySeries({ from: addDays(today, -(days - 1)), to: today });
  const average = series.days.length
    ? Math.round(
        (series.days.reduce((sum, day) => sum + day.rate, 0) / series.days.length) * 10
      ) / 10
    : 0;
  res.json({ ...series, average });
});

export const getRevenue = asyncHandler(async (req, res) => {
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
  const monthly = await revenueByMonth(months);
  const total = monthly.reduce((sum, row) => sum + row.revenue, 0);
  res.json({
    monthly,
    total: Math.round(total * 100) / 100,
    average: Math.round((total / monthly.length) * 100) / 100,
  });
});

export const getForecast = asyncHandler(async (req, res) => {
  const days = Math.min(30, Math.max(3, Number(req.query.days) || 7));
  res.json({ forecast: await forecastDays(days) });
});

const csvEscape = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const exportReport = asyncHandler(async (req, res) => {
  const type = req.query.type || 'bookings';
  let filename = 'bookings.csv';
  let rows = [];

  if (type === 'invoices') {
    filename = 'invoices.csv';
    const invoices = await Invoice.find()
      .populate('guest', 'firstName lastName email')
      .populate('booking', 'reference')
      .sort({ issuedAt: -1 })
      .lean();
    rows = invoices.map((invoice) => ({
      Invoice: invoice.number,
      Reservation: invoice.booking?.reference || '',
      Guest: `${invoice.guest?.firstName || ''} ${invoice.guest?.lastName || ''}`.trim(),
      Email: invoice.guest?.email || '',
      Issued: invoice.issuedAt ? isoDay(invoice.issuedAt) : '',
      Subtotal: invoice.subtotal,
      Tax: invoice.taxAmount,
      Discount: invoice.discount,
      Total: invoice.total,
      Paid: invoice.amountPaid,
      Status: invoice.status,
      Method: invoice.paymentMethod,
    }));
  } else if (type === 'guests') {
    filename = 'guests.csv';
    const guests = await Guest.find().sort({ createdAt: -1 }).lean();
    rows = guests.map((guest) => ({
      Name: `${guest.firstName} ${guest.lastName}`,
      Email: guest.email || '',
      Phone: guest.phone || '',
      Nationality: guest.nationality || '',
      VIP: guest.vip ? 'Yes' : 'No',
      Preferences: (guest.preferences || []).join('; '),
      Joined: isoDay(guest.createdAt),
    }));
  } else {
    const bookings = await Booking.find()
      .populate('guest', 'firstName lastName email')
      .populate('room', 'number')
      .sort({ checkIn: -1 })
      .lean();
    rows = bookings.map((booking) => ({
      Reference: booking.reference,
      Guest: `${booking.guest?.firstName || ''} ${booking.guest?.lastName || ''}`.trim(),
      Email: booking.guest?.email || '',
      Room: booking.room?.number || '',
      CheckIn: isoDay(booking.checkIn),
      CheckOut: isoDay(booking.checkOut),
      Nights: booking.nights,
      Guests: booking.adults + booking.children,
      Status: booking.status,
      Source: booking.source,
      Total: booking.totalAmount,
      Created: isoDay(booking.createdAt),
    }));
  }

  const headers = Object.keys(rows[0] || {});
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

export const getGuestAnalytics = asyncHandler(async (req, res) => {
  const [totalGuests, vipGuests, newThisMonth, topGuests] = await Promise.all([
    Guest.countDocuments(),
    Guest.countDocuments({ vip: true }),
    Guest.countDocuments({ createdAt: { $gte: startOfDay(addDays(new Date(), -30)) } }),
    Booking.aggregate([
      { $match: { status: 'checked_out' } },
      { $group: { _id: '$guest', stays: { $sum: 1 }, spend: { $sum: '$totalAmount' } } },
      { $sort: { spend: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'guests',
          localField: '_id',
          foreignField: '_id',
          as: 'guest',
        },
      },
      { $unwind: '$guest' },
      {
        $project: {
          _id: 0,
          name: { $concat: ['$guest.firstName', ' ', '$guest.lastName'] },
          stays: 1,
          spend: 1,
          vip: '$guest.vip',
        },
      },
    ]),
  ]);
  res.json({ totalGuests, vipGuests, newThisMonth, topGuests });
});
