import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  UsersRound,
  BedDouble,
  Sparkles,
  Wrench,
  BellRing,
  ReceiptText,
  ChartNoAxesCombined,
  MessageSquareQuote,
  UserCog,
  ShieldCheck,
  Settings2,
  ConciergeBell,
  Menu,
  X,
  LogOut,
  KeyRound,
  ChevronDown,
  Home,
  CheckCheck,
  Circle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh, useLiveStatus, liveStatusCopy } from '../lib/live.js';
import { hotelDisplayName } from '../lib/brand.js';
import BrandMark from './BrandMark.jsx';
import { formatDate, roleLabel } from '../lib/format.js';
import { Avatar, Badge, Button, Field, Input, Modal } from './ui.jsx';

const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'receptionist', 'housekeeping'], end: true },
    ],
  },
  {
    label: 'Reception desk',
    items: [
      { to: '/app/front-desk', label: 'Front desk', icon: ConciergeBell, roles: ['admin', 'manager', 'receptionist'] },
      { to: '/app/bookings', label: 'Reservations', icon: CalendarDays, roles: ['admin', 'manager', 'receptionist'] },
      { to: '/app/guests', label: 'Guests', icon: UsersRound, roles: ['admin', 'manager', 'receptionist'] },
      { to: '/app/billing', label: 'Billing', icon: ReceiptText, roles: ['admin', 'manager', 'receptionist'] },
    ],
  },
  {
    label: 'Housekeeping panel',
    items: [
      { to: '/app/housekeeping', label: 'Housekeeping', icon: Sparkles, roles: ['admin', 'manager', 'housekeeping'] },
      { to: '/app/rooms', label: 'Rooms & readiness', icon: BedDouble, roles: ['admin', 'manager', 'housekeeping'] },
      { to: '/app/maintenance', label: 'Maintenance', icon: Wrench, roles: ['admin', 'manager', 'housekeeping'] },
      { to: '/app/services', label: 'Guest services', icon: BellRing, roles: ['admin', 'manager', 'housekeeping'] },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/app/reports', label: 'Reports & analytics', icon: ChartNoAxesCombined, roles: ['admin', 'manager'] },
      { to: '/app/feedback', label: 'Guest feedback', icon: MessageSquareQuote, roles: ['admin', 'manager', 'receptionist'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/app/staff-admin', label: 'Staff admin', icon: ShieldCheck, roles: ['admin', 'manager'] },
      { to: '/app/staff', label: 'Team & access', icon: UserCog, roles: ['admin', 'manager'] },
      { to: '/app/settings', label: 'Hotel settings', icon: Settings2, roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'My account',
    items: [
      { to: '/app/my-stay', label: 'My stay', icon: Home, roles: ['guest'] },
      { to: '/app/book', label: 'Reserve a stay', icon: CalendarDays, roles: ['guest'] },
    ],
  },
];

const titleFor = (pathname) => {
  if (pathname === '/app') return 'Dashboard';
  if (pathname.startsWith('/app/bookings/')) return 'Reservation';
  if (pathname.startsWith('/app/billing/')) return 'Invoice';
  if (pathname.startsWith('/app/rooms')) return 'Rooms & readiness';
  if (pathname.startsWith('/app/bookings')) return 'Reservations';
  if (pathname.startsWith('/app/front-desk')) return 'Front desk';
  if (pathname.startsWith('/app/guests')) return 'Guests';
  if (pathname.startsWith('/app/billing')) return 'Billing';
  if (pathname.startsWith('/app/housekeeping')) return 'Housekeeping';
  if (pathname.startsWith('/app/maintenance')) return 'Maintenance';
  if (pathname.startsWith('/app/services')) return 'Guest services';
  if (pathname.startsWith('/app/reports')) return 'Reports & analytics';
  if (pathname.startsWith('/app/feedback')) return 'Guest feedback';
  if (pathname.startsWith('/app/staff-admin')) return 'Staff admin';
  if (pathname.startsWith('/app/staff')) return 'Team & access';
  if (pathname.startsWith('/app/settings')) return 'Hotel settings';
  if (pathname.startsWith('/app/book')) return 'Reserve a stay';
  if (pathname.startsWith('/app/my-stay')) return 'My stay';
  return 'Hotel';
};

// Notifications store app paths like "/billing/:id", but staff screens live
// under "/app". Resolve the link so a click opens the matching screen.
const notificationTarget = (link) => {
  const value = String(link || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value === '/app' || value.startsWith('/app/')) return value;
  return `/app${value.startsWith('/') ? value : `/${value}`}`;
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [unseen, setUnseen] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get('/notifications?limit=12');
      setNotifications(data.notifications);
      setUnread(data.unread);
      setUnseen(data.unseen ?? data.unread);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLiveRefresh(load, { intervalMs: 30000 });

  useEffect(() => {
    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openPanel = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setUnseen(0);
    setLoading(true);
    try {
      // Opening the bell clears only the badge count. Each notification's
      // unread dot stays until that item is opened.
      await api.patch('/notifications/seen-all');
      await load();
      setUnseen(0);
    } catch {
      await load();
    } finally {
      setLoading(false);
    }
  };

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnread(0);
      setUnseen(0);
    } catch {
      /* silent */
    }
  };

  const handleItem = async (item) => {
    if (!item.isRead) {
      try {
        await api.patch(`/notifications/${item._id}/read`);
        setNotifications((items) =>
          items.map((entry) => (entry._id === item._id ? { ...entry, isRead: true } : entry))
        );
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        /* silent */
      }
    }
    setOpen(false);
    const target = notificationTarget(item.link);
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      window.location.assign(target);
      return;
    }
    navigate(target);
  };

  return (
    <div className="notif" ref={ref}>
      <button type="button" className="icon-btn topbar-icon" onClick={openPanel} aria-label="Notifications">
        <BellRing size={19} />
        {unseen > 0 && <span className="notif-dot">{unseen > 9 ? '9+' : unseen}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <div>
              <h3>Notifications</h3>
              <p>{unread ? `${unread} unread update${unread > 1 ? 's' : ''}` : 'You are all caught up'}</p>
            </div>
            <button type="button" className="link-btn" onClick={markAll}>
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>
          <div className="notif-list">
            {loading && <div className="notif-empty">Loading…</div>}
            {!loading && notifications.length === 0 && (
              <div className="notif-empty">No notifications yet.</div>
            )}
            {notifications.map((item) => (
              <button
                type="button"
                key={item._id}
                className={`notif-item ${item.isRead ? 'read' : ''}`}
                onClick={() => handleItem(item)}
              >
                <span className={`notif-indicator ${item.isRead ? '' : 'unread'}`}>
                  <Circle size={8} fill="currentColor" />
                </span>
                <span className="notif-copy">
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <em>{formatDate(item.createdAt, { year: undefined })}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LiveBadge = () => {
  const status = useLiveStatus();
  const label = liveStatusCopy[status] || 'Live';

  return (
    <span
      className={`live-badge live-${status}`}
      title={
        status === 'live'
          ? 'Connected — data refreshes automatically'
          : 'Data still refreshes periodically and when you return to this tab'
      }
    >
      <span className="live-dot" aria-hidden="true" />
      {label}
    </span>
  );
};

const ChangePasswordModal = ({ open, onClose }) => {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Your password has been updated.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
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
      title="Change password"
      subtitle="Use at least 8 characters with one letter and one number."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Update password
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Current password" required>
          <Input
            type="password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            required
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" required>
          <Input
            type="password"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" required>
          <Input
            type="password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
            required
            autoComplete="new-password"
          />
        </Field>
      </form>
    </Modal>
  );
};

const Layout = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [hotel, setHotel] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .get('/public/info')
      .then(({ data }) => {
        if (active) setHotel(data.hotel);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const hotelName = hotelDisplayName(hotel);
  const hotelCity = hotel?.address?.city;

  const sections = useMemo(
    () =>
      NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(user?.role)),
      })).filter((section) => section.items.length),
    [user?.role]
  );

  useEffect(() => {
    setMobileOpen(false);
    setUserMenu(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) setUserMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <Link to="/app" className="brand-link">
            <BrandMark />
            <span className="brand-text">
              <strong>{hotelName}</strong>
              <em>{hotelCity || 'Hotels & Residences'}</em>
            </span>
          </Link>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.label} className="nav-section">
              <p className="nav-label">{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} strokeWidth={1.7} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-note">
            <span className="sidebar-note-mark">✦</span>
            <p>
              <strong>Every detail, considered.</strong>
              Keep the guest journey seamless across every department.
            </p>
          </div>
          <div className="sidebar-user">
            <Avatar name={user?.name} size="sm" tone="gold" />
            <div className="sidebar-user-copy">
              <strong>{user?.name}</strong>
              <span>{roleLabel(user?.role)}</span>
            </div>
            <button type="button" className="icon-btn icon-btn-light" onClick={handleLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-btn mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="topbar-title">
              <span className="topbar-eyebrow">
                {hotelName}
                {hotelCity ? ` · ${hotelCity}` : ''}
              </span>
              <strong>{titleFor(location.pathname)}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <LiveBadge />
            <span className="topbar-date">{formatDate(new Date(), { weekday: 'short' })}</span>
            <NotificationBell />
            <div className="user-menu" ref={userRef}>
              <button type="button" className="user-trigger" onClick={() => setUserMenu((value) => !value)}>
                <Avatar name={user?.name} size="sm" />
                <span className="user-trigger-copy">
                  <strong>{user?.name?.split(' ')[0]}</strong>
                  <em>{roleLabel(user?.role)}</em>
                </span>
                <ChevronDown size={14} />
              </button>
              {userMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown-head">
                    <Avatar name={user?.name} size="md" />
                    <div>
                      <strong>{user?.name}</strong>
                      <span>{user?.email}</span>
                      <Badge tone="gold" dot={false}>
                        {roleLabel(user?.role)}
                      </Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setPasswordOpen(true);
                      setUserMenu(false);
                    }}
                  >
                    <KeyRound size={16} /> Change password
                  </button>
                  <button type="button" className="dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
};

export default Layout;
