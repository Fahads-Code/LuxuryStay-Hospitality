import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import api from '../lib/api.js';
import { hotelDisplayName } from '../lib/brand.js';
import BrandMark from './BrandMark.jsx';

const PublicFooter = ({ hotel: hotelProp }) => {
  const [hotel, setHotel] = useState(hotelProp || null);

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
  const address = hotel?.address || {};
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <BrandMark className="site-brand-mark" />
          <div>
            <strong>{name}</strong>
            <em>{cityLine || 'Hotels & Residences'}</em>
          </div>
          <p>
            {hotel?.tagline ||
              'Thoughtful hospitality, from the first welcome to the last goodbye.'}
          </p>
        </div>

        <div className="footer-col">
          <h4>Explore</h4>
          <Link to="/#rooms">Rooms & suites</Link>
          <Link to="/#experience">The experience</Link>
          <Link to="/#facilities">Amenities &amp; services</Link>
          <Link to="/#reviews">Guest stories</Link>
          <Link to="/feedback">Share your feedback</Link>
        </div>

        <div className="footer-col">
          <h4>Visit</h4>
          {(address.street || cityLine) && (
            <p>
              <MapPin size={14} />
              {address.street}
              {address.street && cityLine && <br />}
              {cityLine && <span className="footer-indent">{cityLine}</span>}
            </p>
          )}
          {hotel?.phone && (
            <p>
              <Phone size={14} /> {hotel.phone}
            </p>
          )}
          {hotel?.email && (
            <p>
              <Mail size={14} /> {hotel.email}
            </p>
          )}
          {!address.street && !cityLine && !hotel?.phone && !hotel?.email && (
            <p className="footer-small">Contact details will appear here.</p>
          )}
        </div>

        <div className="footer-col">
          <h4>Good to know</h4>
          <p>Check-in from {hotel?.checkInTime || '15:00'}</p>
          <p>Check-out by {hotel?.checkOutTime || '11:00'}</p>
          <Link to="/login">Staff & guest portal</Link>
          {hotel?.website && <p className="footer-small">{hotel.website}</p>}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
        <span>Privacy · Accessibility · Terms</span>
      </div>
    </footer>
  );
};

export default PublicFooter;
