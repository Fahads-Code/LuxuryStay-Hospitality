import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Car,
  Check,
  ChevronDown,
  Clock,
  ConciergeBell,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UtensilsCrossed,
  Waves,
  Wifi,
} from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import api from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { addDaysISO, currency, formatDate, todayISO } from '../lib/format.js';
import { roomImages, siteImages } from '../lib/images.js';

const FALLBACK_HOTEL_NAME = 'LuxuryStay Hospitality';

const experience = [
  {
    title: 'An easy arrival',
    copy: 'A warm welcome, a cool drink and someone who already knows your name. The details begin before you reach your room.',
    image: siteImages.service,
    icon: ConciergeBell,
  },
  {
    title: 'Slow mornings',
    copy: 'Breakfast at the hour that suits you, a quiet table by the window and coffee worth lingering over.',
    image: siteImages.dining,
    icon: UtensilsCrossed,
  },
  {
    title: 'Time to unwind',
    copy: 'Spa rituals, a sunlit pool and unhurried afternoons shaped entirely around the way you want to feel.',
    image: siteImages.spa,
    icon: Sparkles,
  },
];

const facilities = [
  {
    title: '24/7 concierge',
    copy: 'Tickets, tables, transfers and the small requests that make a stay effortless — at any hour.',
    icon: ConciergeBell,
  },
  {
    title: 'In-house dining',
    copy: 'Seasonal plates and a considered wine list, served in the dining room or privately in your suite.',
    icon: UtensilsCrossed,
  },
  {
    title: 'Spa & wellness',
    copy: 'A calm floor dedicated to recovery: signature treatments, steam and quiet treatment rooms.',
    icon: Sparkles,
  },
  {
    title: 'Pool & terrace',
    copy: 'A sun-warmed pool and shaded terrace for long lunches and slower afternoons.',
    icon: Waves,
  },
  {
    title: 'Airport transfers',
    copy: 'Private pick-ups arranged ahead of time, so the journey feels like part of the stay.',
    icon: Car,
  },
  {
    title: 'High-speed Wi-Fi',
    copy: 'Fast, reliable connectivity throughout the hotel — in every room and every shared space.',
    icon: Wifi,
  },
];

const promises = [
  'Best rate when you book direct',
  'Thoughtful service, from arrival to farewell',
  'Rooms prepared to a five-star standard',
  'A team on hand around the clock',
];

const useScrollReveal = (dependency) => {
  useEffect(() => {
    let frame = 0;

    const reveal = () => {
      frame = 0;
      const nodes = document.querySelectorAll('.reveal:not(.is-visible)');
      nodes.forEach((node) => {
        // Reveal anything that has reached (or already passed) the viewport.
        // Checking the top edge keeps elements visible even after a fast jump
        // to an anchor further down the page.
        if (node.getBoundingClientRect().top < window.innerHeight - 40) {
          node.classList.add('is-visible');
        }
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(reveal);
    };

    reveal();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [dependency]);
};

const CountUp = ({ value, decimals = 0, suffix = '' }) => {
  const nodeRef = useRef(null);
  const startedRef = useRef(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = nodeRef.current;
    const target = Number(value) || 0;
    if (!node) return undefined;

    if (startedRef.current) {
      setDisplay(target);
      return undefined;
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      startedRef.current = true;
      setDisplay(target);
      return undefined;
    }

    let frame = 0;
    const duration = 1500;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    const start = performance.now();

    if (typeof IntersectionObserver === 'undefined') {
      startedRef.current = true;
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startedRef.current = true;
          frame = requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={nodeRef}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [booking, setBooking] = useState({
    checkIn: addDaysISO(todayISO(), 1),
    checkOut: addDaysISO(todayISO(), 4),
    guests: '2',
  });

  const load = async () => {
    try {
      const { data: response } = await api.get('/public/info');
      setData(response);
    } catch {
      /* the landing page keeps its fallback content */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLiveRefresh(load, { intervalMs: 60000 });

  useScrollReveal(data);

  const search = (event) => {
    event.preventDefault();
    const params = new URLSearchParams(booking);
    navigate(`/book?${params.toString()}`);
  };

  const hotel = data?.hotel;
  const hotelName = hotel?.name?.trim() || FALLBACK_HOTEL_NAME;
  const city = hotel?.address?.city;
  const roomCount = data?.roomCount ?? 100;
  const roomTypeCount = data?.roomTypes?.length || 5;
  const roomTypes = data?.roomTypes || [];

  const ratings = (data?.testimonials || [])
    .map((item) => Number(item.rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const averageRating = ratings.length
    ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
    : null;

  const marquee = [
    `${roomCount} rooms & suites`,
    `${roomTypeCount} signature room types`,
    '24/7 concierge',
    'Best rate, direct',
    'In-house dining & bar',
    'Complimentary Wi-Fi',
  ];

  return (
    <div className="site">
      <PublicNav hotel={hotel} />

      <section className="hero hero-landing">
        <div
          className="hero-bg"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(11,22,21,.82) 0%, rgba(11,22,21,.4) 52%, rgba(11,22,21,.18) 100%), url('${siteImages.hero}')`,
          }}
        />
        <span className="hero-glow hero-glow-a" aria-hidden="true" />
        <span className="hero-glow hero-glow-b" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow hero-anim" style={{ '--d': '0.05s' }}>
              <span /> {city ? `${hotelName} · ${city}` : hotelName}
            </p>
            <h1 className="hero-title">
              <span className="hero-line hero-anim" style={{ '--d': '0.14s' }}>
                An address for
              </span>
              <span className="hero-line hero-anim" style={{ '--d': '0.24s' }}>
                the <em>extraordinary.</em>
              </span>
            </h1>
            <p className="hero-lede hero-anim" style={{ '--d': '0.34s' }}>
              {hotel?.tagline ||
                'Thoughtful hospitality, considered spaces and a warm welcome from the moment you arrive.'}
            </p>
            <div className="hero-actions hero-anim" style={{ '--d': '0.42s' }}>
              <Link to="/book" className="btn btn-gold btn-lg">
                Reserve your stay <ArrowRight size={17} />
              </Link>
              <a href="#experience" className="btn btn-glass btn-lg">
                Explore the hotel
              </a>
            </div>
            <div className="hero-trust hero-anim" style={{ '--d': '0.5s' }}>
              {hotel?.phone && (
                <span>
                  <Phone size={13} /> {hotel.phone}
                </span>
              )}
              <span>
                <Clock size={13} /> Check-in from {hotel?.checkInTime || '15:00'}
              </span>
              <span>
                <ShieldCheck size={13} /> Best rate guaranteed
              </span>
            </div>
          </div>

          <form
            className="booking-widget hero-anim"
            style={{ '--d': '0.5s' }}
            onSubmit={search}
          >
            <div className="booking-widget-head">
              <span className="booking-widget-title">Plan your stay</span>
              <span className="booking-widget-note">Best rate, direct</span>
            </div>
            <div className="booking-widget-grid">
              <label>
                <span>Arrival</span>
                <input
                  type="date"
                  value={booking.checkIn}
                  min={todayISO()}
                  onChange={(event) => {
                    const checkIn = event.target.value;
                    const checkOut =
                      booking.checkOut <= checkIn ? addDaysISO(checkIn, 2) : booking.checkOut;
                    setBooking({ ...booking, checkIn, checkOut });
                  }}
                />
              </label>
              <label>
                <span>Departure</span>
                <input
                  type="date"
                  value={booking.checkOut}
                  min={addDaysISO(booking.checkIn, 1)}
                  onChange={(event) => setBooking({ ...booking, checkOut: event.target.value })}
                />
              </label>
              <label>
                <span>Guests</span>
                <select
                  value={booking.guests}
                  onChange={(event) => setBooking({ ...booking, guests: event.target.value })}
                >
                  {[1, 2, 3, 4].map((count) => (
                    <option key={count} value={count}>
                      {count} guest{count > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="booking-widget-submit">
                Check availability <ArrowRight size={16} />
              </button>
            </div>
            <p className="booking-widget-foot">
              No payment required today — every request is confirmed personally.
            </p>
          </form>
        </div>

        <a href="#rooms" className="hero-scroll" aria-label="Scroll to rooms">
          <span>Scroll to explore</span>
          <ChevronDown size={16} />
        </a>
      </section>

      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee-track">
          {[0, 1].map((group) => (
            <div className="landing-marquee-group" key={group}>
              {marquee.map((item, index) => (
                <span key={`${group}-${item}-${index}`}>
                  {item}
                  <Star size={10} fill="currentColor" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="landing-intro">
        <div className="landing-intro-media reveal">
          <div className="landing-intro-frame">
            <img
              src={siteImages.login}
              alt={`Inside ${hotelName}`}
              loading="lazy"
            />
          </div>
          <div className="landing-intro-badge">
            <strong>{roomCount}</strong>
            <span>rooms &amp; suites</span>
          </div>
        </div>

        <div className="landing-intro-copy reveal" style={{ '--d': '0.12s' }}>
          <p className="eyebrow">Welcome to {hotelName}</p>
          <h2>
            Arrive as a guest. <em>Leave as a regular.</em>
          </h2>
          <p>
            {hotel?.tagline ? `${hotel.tagline} ` : ''}
            Every stay is shaped by the small things: a room that feels considered, a team that
            remembers how you take your coffee, and the freedom to do absolutely nothing at all.
          </p>

          <ul className="landing-checks">
            {promises.map((promise) => (
              <li key={promise}>
                <Check size={13} strokeWidth={2.6} /> {promise}
              </li>
            ))}
          </ul>

          <div className="landing-stats">
            <div>
              <strong>
                <CountUp value={roomCount} />
              </strong>
              <span>Rooms</span>
            </div>
            <div>
              <strong>
                <CountUp value={roomTypeCount} />
              </strong>
              <span>Room types</span>
            </div>
            <div>
              {averageRating ? (
                <strong>
                  <CountUp value={averageRating} decimals={1} />
                  <em>/5</em>
                </strong>
              ) : (
                <strong>24/7</strong>
              )}
              <span>{averageRating ? 'Guest rating' : 'Concierge'}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="rooms" className="section rooms-section">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">Stay with us</p>
            <h2>Rooms &amp; suites</h2>
          </div>
          <div className="landing-section-aside">
            <p className="section-note">
              Each room is a study in calm: natural textures, generous light and views that ask you
              to linger.
            </p>
            <Link to="/book" className="landing-link">
              See live availability <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {!data && (
          <div className="public-room-grid">
            {[1, 2, 3].map((item) => (
              <div key={item} className="public-room-card skeleton-card reveal" />
            ))}
          </div>
        )}

        <div className="public-room-grid">
          {roomTypes.map((room, index) => {
            const name = room.name || 'Room';
            const description = room.description || 'Details for this room will be available soon.';
            const amenities = Array.isArray(room.amenities) ? room.amenities.filter(Boolean) : [];
            const capacity = room.capacity
              ? `${room.capacity} guest${room.capacity > 1 ? 's' : ''}`
              : 'Guests —';
            const beds = room.beds || 'Bedding details coming soon';
            const size = room.sizeSqm ? `${room.sizeSqm} m²` : null;
            const rate = Number(room.baseRate) || 0;

            return (
              <article
                key={room.id || name}
                className="public-room-card reveal"
                style={{ '--d': `${index * 0.03}s` }}
              >
                <div className="public-room-image room-media">
                  <div
                    className="room-media-inner"
                    style={{ backgroundImage: `url('${roomImages[name] || roomImages['Standard King']}')` }}
                  />
                  <span className="room-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="room-price-tag">
                    {rate > 0 ? (
                      <>
                        {currency(rate, hotel?.currency)} <em>/ night</em>
                      </>
                    ) : (
                      <em>Rate on request</em>
                    )}
                  </span>
                </div>
                <div className="public-room-body">
                  <div className="public-room-top">
                    <h3>{name}</h3>
                    {size ? <span>{size}</span> : <span>—</span>}
                  </div>
                  <p>{description}</p>
                  <div className="public-room-amenities">
                    {amenities.length ? (
                      amenities.slice(0, 4).map((amenity) => <span key={amenity}>{amenity}</span>)
                    ) : (
                      <span>Details coming soon</span>
                    )}
                  </div>
                  <div className="public-room-foot">
                    <span>
                      {capacity} · {beds}
                    </span>
                    <Link
                      to={`/book?roomType=${room.id}&checkIn=${addDaysISO(todayISO(), 1)}&checkOut=${addDaysISO(todayISO(), 3)}&guests=2`}
                      className="text-link"
                    >
                      Reserve <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {data && roomTypes.length === 0 && (
          <p className="section-note">Room details will be published here soon.</p>
        )}
      </section>

      <section id="experience" className="section experience-section">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">The experience</p>
            <h2>Days shaped around you</h2>
          </div>
          <p className="section-note">
            Every part of the stay is considered, from the first welcome to the last morning.
          </p>
        </div>
        <div className="experience-grid">
          {experience.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="experience-card reveal"
                style={{ '--d': `${index * 0.1}s` }}
              >
                <div
                  className="experience-image"
                  style={{ backgroundImage: `url('${item.image}')` }}
                />
                <div className="experience-body">
                  <span className="experience-step">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="experience-icon">
                    <Icon size={19} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="facilities" className="landing-facilities">
        <div className="landing-facilities-inner">
          <div className="section-head reveal">
            <div>
              <p className="eyebrow">At your service</p>
              <h2>Everything within reach</h2>
            </div>
            <p className="section-note">
              The essentials, quietly taken care of — so the only thing on your mind is the stay
              itself.
            </p>
          </div>

          <div className="facility-grid">
            {facilities.map((facility, index) => {
              const Icon = facility.icon;
              return (
                <article
                  key={facility.title}
                  className="facility-card reveal"
                  style={{ '--d': `${index * 0.06}s` }}
                >
                  <span className="facility-icon">
                    <Icon size={19} />
                  </span>
                  <h3>{facility.title}</h3>
                  <p>{facility.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="reviews" className="section reviews-section">
        <div className="reviews-head reveal">
          <p className="eyebrow">Guest stories</p>
          <h2>
            Kind words, <em>kept close.</em>
          </h2>
          {averageRating && (
            <span className="reviews-summary">
              <Star size={13} fill="currentColor" />
              {averageRating.toFixed(1)} out of 5 · from recent guests
            </span>
          )}
        </div>
        {data?.testimonials?.length > 0 ? (
          <div className="testimonial-grid">
            {data.testimonials.map((item, index) => (
              <article
                key={item.id}
                className="testimonial-card reveal"
                style={{ '--d': `${index * 0.07}s` }}
              >
                <div className="testimonial-stars">
                  {Array.from({ length: 5 }, (_, starIndex) => (
                    <Star
                      key={starIndex}
                      size={14}
                      fill={starIndex < item.rating ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                {item.title && <h3>{item.title}</h3>}
                <p>“{item.comments}”</p>
                <footer>
                  <span>{item.name}</span>
                  <em>
                    {item.roomType ? `${item.roomType} · ` : ''}
                    {formatDate(item.date, { month: 'long', year: 'numeric' })}
                  </em>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <p className="section-note">No guest stories have been published yet.</p>
        )}
      </section>

      <section className="cta-band reveal">
        <div className="cta-band-inner">
          <div>
            <p className="eyebrow light">Your stay begins here</p>
            <h2>Make room for the remarkable.</h2>
            <p>Reserve directly for our best available rate and a warm welcome on arrival.</p>
          </div>
          <div className="cta-band-actions">
            <Link to="/book" className="btn btn-gold btn-lg">
              Check availability <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-glass btn-lg">
              Guest portal
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter hotel={hotel} />
    </div>
  );
};

export default LandingPage;
