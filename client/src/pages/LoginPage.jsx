import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth, homeForRole } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import BrandMark from '../components/BrandMark.jsx';
import { siteImages } from '../lib/images.js';
import { Button, Field, Input } from '../components/ui.jsx';

const LoginPage = () => {
  const { user, login, register, completeSetup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [hotelName, setHotelName] = useState('LuxuryStay Hospitality');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    hotelName: 'LuxuryStay Hospitality',
  });

  // Restore the page the visitor originally wanted after sign-in/sign-up.
  // Workspace deep links (/app/...) and the public reservation page (/book?...)
  // reached via "Check availability" both keep their query strings (dates,
  // guests, room type) so the booking flow continues exactly where it stopped.
  const afterAuthPath = (role) => {
    const from = location.state?.from;
    const safe = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//');
    if (!safe) return homeForRole(role);
    if (from.startsWith('/app')) return from;
    if (from === '/book' || from.startsWith('/book?')) return from;
    return homeForRole(role);
  };

  useEffect(() => {
    if (user) navigate(afterAuthPath(user.role), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/setup/status').catch(() => ({ data: { needsSetup: false } })),
      api.get('/public/info').catch(() => ({ data: null })),
    ]).then(([status, info]) => {
      if (!active) return;
      if (status.data?.needsSetup) {
        setMode('setup');
        setNeedsSetup(true);
      }
      const name = info.data?.hotel?.name;
      if (name) {
        setHotelName(name);
        setForm((current) => ({ ...current, hotelName: name }));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === 'setup') {
        const created = await completeSetup({
          hotelName: form.hotelName.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        toast.success(`Welcome, ${created.name.split(' ')[0]}. Your hotel is ready.`);
        navigate(homeForRole(created.role), { replace: true });
      } else if (mode === 'login') {
        const signedIn = await login(form.email.trim(), form.password);
        toast.success(`Welcome back, ${signedIn.name.split(' ')[0]}.`);
        navigate(afterAuthPath(signedIn.role), { replace: true });
      } else {
        const created = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
        });
        toast.success('Your guest account is ready.');
        navigate(afterAuthPath(created.role), { replace: true });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to continue. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const heading =
    mode === 'setup'
      ? {
          eyebrow: 'First-time setup',
          title: 'Create the administrator account',
          copy: 'Enter your hotel name and create the owner login. You can add staff, rooms and rates after signing in.',
        }
      : mode === 'login'
        ? {
            eyebrow: 'Welcome back',
            title: `Sign in to ${hotelName}`,
            copy: 'Your property, guests and team — beautifully in sync.',
          }
        : {
            eyebrow: 'Join us',
            title: 'Create a guest account',
            copy: 'Manage your stays, request services and share feedback in one place.',
          };

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <div
          className="auth-visual-bg"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(12,23,22,.25) 0%, rgba(12,23,22,.7) 100%), url('${siteImages.login}')`,
          }}
        />
        <Link to="/" className="auth-brand">
          <BrandMark className="site-brand-mark" />
          <span>
            <strong>{hotelName}</strong>
            <em>Hotels &amp; Residences</em>
          </span>
        </Link>
        <div className="auth-quote">
          <span className="quote-mark">“</span>
          <blockquote>The details are not the details. They make the design.</blockquote>
          <p>Charles Eames</p>
        </div>
        <div className="auth-visual-foot">
          <span><ShieldCheck size={15} /> Secure, role-based access</span>
          <span><Sparkles size={15} /> One system, every department</span>
        </div>
      </aside>

      <main className="auth-main">
        <Link to="/" className="auth-back">
          <ArrowLeft size={15} /> Back to the hotel
        </Link>

        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">{heading.eyebrow}</p>
            <h1>{heading.title}</h1>
            <p>{heading.copy}</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'setup' && (
              <>
                <Field
                  label="Hotel name"
                  required
                  hint="This appears across the app and the public website."
                >
                  <Input
                    value={form.hotelName}
                    onChange={(event) => setForm({ ...form, hotelName: event.target.value })}
                    placeholder="LuxuryStay Hospitality"
                    required
                    autoFocus
                    autoComplete="organization"
                  />
                </Field>
                <Field label="Your full name" required>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Owner or administrator name"
                    required
                    autoComplete="name"
                  />
                </Field>
              </>
            )}

            {mode === 'register' && (
              <div className="form-row">
                <Field label="Full name" required>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Your full name"
                    required
                    autoComplete="name"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+1 555 000 0000"
                    autoComplete="tel"
                  />
                </Field>
              </div>
            )}

            <Field label="Email address" required>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </Field>

            <Field
              label="Password"
              required
              hint={
                mode === 'login'
                  ? undefined
                  : 'At least 8 characters, including a letter and a number.'
              }
            >
              <span className="password-wrap">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={mode === 'login' ? undefined : 8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </Field>

            <Button type="submit" size="lg" loading={loading} className="auth-submit">
              {mode === 'setup'
                ? 'Create administrator account'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}{' '}
              <ArrowRight size={16} />
            </Button>
          </form>

          {mode === 'setup' && (
            <p className="auth-setup-note">
              <Building2 size={15} /> This screen appears only until the first administrator account
              is created.
            </p>
          )}

          <p className="auth-switch">
            {needsSetup ? (
              <>
                Already completed setup?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setNeedsSetup(false);
                    setMode('login');
                  }}
                >
                  Sign in
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                New to {hotelName}?{' '}
                <button type="button" className="link-btn" onClick={() => setMode('register')}>
                  Create a guest account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="link-btn" onClick={() => setMode('login')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="auth-legal">
          Protected by role-based access control. By continuing you agree to our privacy policy.
        </p>
      </main>
    </div>
  );
};

export default LoginPage;
