import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import api from '../lib/api.js';
import { hotelDisplayName } from '../lib/brand.js';
import { homeForRole, useAuth } from '../context/AuthContext.jsx';
import BrandMark from './BrandMark.jsx';

const ACCOUNT_LABEL = {
  guest: 'My stay',
  receptionist: 'Reception panel',
  housekeeping: 'Housekeeping panel',
  admin: 'Dashboard',
  manager: 'Dashboard',
};

const PublicNav = ({ solid = false, hotel: hotelProp }) => {
  const [open, setOpen] = useState(false);
  const [hotel, setHotel] = useState(hotelProp || null);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (hotelProp) {
      setHotel(hotelProp);
      return;
    }
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
  }, [hotelProp]);

  const name = hotelDisplayName(hotel);
  const isGuest = user?.role === 'guest';
  const accountTo = user ? homeForRole(user.role) : '/login';
  const accountLabel = user ? ACCOUNT_LABEL[user.role] || 'Dashboard' : 'Login';
  const reserveTo = isGuest ? '/app/book' : '/book';
  const reserveLabel = isGuest ? 'Reserve another stay' : 'Reserve';

  return (
    <header className={`site-nav ${solid ? 'site-nav-solid' : ''}`}>
      <Link to="/" className="site-brand">
        <BrandMark className="site-brand-mark" />
        <span className="site-brand-text">
          <strong>{name}</strong>
          <em>{hotel?.address?.city || 'Hotels & Residences'}</em>
        </span>
      </Link>

      <nav className={`site-links ${open ? 'open' : ''}`}>
        <Link to="/#rooms">Rooms & suites</Link>
        <Link to="/#experience">The experience</Link>
        <Link to="/#facilities">Amenities</Link>
        <Link to="/#reviews">Guest stories</Link>
        <Link to="/feedback">Share feedback</Link>
        <div className="site-links-mobile-actions">
          <Link to={accountTo} className="btn btn-outline btn-md">
            {accountLabel}
          </Link>
          <Link to={reserveTo} className="btn btn-gold btn-md">
            {isGuest ? 'Reserve another stay' : 'Reserve a stay'}
          </Link>
        </div>
      </nav>

      <div className="site-nav-actions">
        <Link to={accountTo} className="site-signin">
          {accountLabel}
        </Link>
        <Link to={reserveTo} className="btn btn-gold btn-sm">
          {reserveLabel}
        </Link>
        <button
          type="button"
          className="site-menu-btn"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
};

export default PublicNav;
