import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import {
  X,
  Search,
  Star,
  Loader2,
  Inbox,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import {
  bookingStatusTone,
  initials,
  roomStatusTone,
  statusLabel,
} from '../lib/format.js';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  as: Component = 'button',
  loading = false,
  icon: Icon,
  ...props
}) => (
  <Component
    type={Component === 'button' ? type : undefined}
    className={`btn btn-${variant} btn-${size} ${className}`.trim()}
    disabled={Component === 'button' ? props.disabled || loading : undefined}
    {...props}
  >
    {loading ? <Loader2 size={16} className="spin" /> : Icon ? <Icon size={16} /> : null}
    {children}
  </Component>
);

const tones = {
  sage: 'badge-sage',
  ink: 'badge-ink',
  terracotta: 'badge-terracotta',
  blue: 'badge-blue',
  amber: 'badge-amber',
  red: 'badge-red',
  neutral: 'badge-neutral',
  gold: 'badge-gold',
  plum: 'badge-plum',
};

export const Badge = ({ children, tone = 'neutral', status, dot = true, className = '' }) => {
  const resolvedTone =
    tone === 'auto'
      ? roomStatusTone[status] || bookingStatusTone[status] || 'neutral'
      : tone;
  return (
    <span className={`badge ${tones[resolvedTone] || tones.neutral} ${className}`.trim()}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children ?? statusLabel(status)}
    </span>
  );
};

export const Avatar = ({ name, size = 'md', className = '', tone = 'default' }) => (
  <span className={`avatar avatar-${size} avatar-${tone} ${className}`.trim()} aria-hidden="true">
    {initials(name)}
  </span>
);

export const Card = ({ children, className = '', ...props }) => (
  <section className={`card ${className}`.trim()} {...props}>
    {children}
  </section>
);

export const CardHead = ({ title, subtitle, action, className = '' }) => (
  <header className={`card-head ${className}`.trim()}>
    <div>
      <h2 className="card-title">{title}</h2>
      {subtitle && <p className="card-sub">{subtitle}</p>}
    </div>
    {action && <div className="card-action">{action}</div>}
  </header>
);

export const PageHeader = ({ eyebrow, title, subtitle, actions }) => (
  <div className="page-head">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const StatCard = ({ label, value, hint, icon: Icon, tone = 'default', trend }) => (
  <article className={`stat-card stat-${tone}`}>
    <div className="stat-top">
      <span className="stat-label">{label}</span>
      {Icon && (
        <span className="stat-icon">
          <Icon size={18} strokeWidth={1.7} />
        </span>
      )}
    </div>
    <p className="stat-value">{value}</p>
    <div className="stat-bottom">
      {trend && <span className={`stat-trend ${trend.positive ? 'up' : 'down'}`}>{trend.label}</span>}
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  </article>
);

export const EmptyState = ({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) => (
  <div className="empty">
    <span className="empty-icon">
      <Icon size={26} strokeWidth={1.5} />
    </span>
    <h3>{title}</h3>
    {message && <p>{message}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);

export const Spinner = ({ label = 'Loading…', className = '' }) => (
  <div className={`spinner-wrap ${className}`.trim()}>
    <Loader2 size={24} className="spin" />
    <span>{label}</span>
  </div>
);

export const PageLoader = () => (
  <div className="page-loader">
    <span className="page-loader-mark">LS</span>
    <Loader2 size={20} className="spin" />
  </div>
);

export const Field = ({ label, error, hint, required, children, className = '' }) => (
  <label className={`field ${className}`.trim()}>
    {label && (
      <span className="field-label">
        {label}
        {required && <span className="required">*</span>}
      </span>
    )}
    {children}
    {error && <span className="field-error">{error}</span>}
    {hint && !error && <span className="field-hint">{hint}</span>}
  </label>
);

export const Input = ({ className = '', ...props }) => (
  <input className={`input ${className}`.trim()} {...props} />
);

export const Select = ({ className = '', children, ...props }) => (
  <span className={`select-wrap ${className}`.trim()}>
    <select className="select" {...props}>
      {children}
    </select>
    <ChevronDown size={15} className="select-chevron" aria-hidden="true" />
  </span>
);

export const Textarea = ({ className = '', rows = 3, ...props }) => (
  <textarea className={`textarea ${className}`.trim()} rows={rows} {...props} />
);

export const SearchInput = ({ value, onChange, placeholder = 'Search…', className = '' }) => (
  <span className={`searchbox ${className}`.trim()}>
    <Search size={16} className="searchbox-icon" />
    <input
      className="searchbox-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  </span>
);

export const Tabs = ({ items, value, onChange, className = '' }) => (
  <div className={`tabs ${className}`.trim()} role="tablist">
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        role="tab"
        aria-selected={value === item.key}
        className={`tab ${value === item.key ? 'active' : ''}`}
        onClick={() => onChange(item.key)}
      >
        {item.label}
        {item.count != null && <span className="tab-count">{item.count}</span>}
      </button>
    ))}
  </div>
);

export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className = '',
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`modal modal-${size} ${className}`.trim()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
};

export const Drawer = ({ open, onClose, title, subtitle, children, footer, width = 'md' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <aside className={`drawer drawer-${width}`} role="dialog" aria-modal="true">
        <header className="drawer-head">
          <div>
            <h2 className="drawer-title">{title}</h2>
            {subtitle && <p className="drawer-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
};

export const Toggle = ({ checked, onChange, label, disabled = false }) => (
  <label className={`toggle ${disabled ? 'toggle-disabled' : ''}`.trim()}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
    />
    <span className="toggle-track" aria-hidden="true">
      <span className="toggle-thumb" />
    </span>
    {label && <span className="toggle-label">{label}</span>}
  </label>
);

export const Rating = ({ value = 0, max = 5, size = 15, showValue = false }) => (
  <span className="rating" aria-label={`${value} out of ${max}`}>
    {Array.from({ length: max }, (_, index) => (
      <Star
        key={index}
        size={size}
        className={index < Math.round(value) ? 'star filled' : 'star'}
        strokeWidth={1.5}
      />
    ))}
    {showValue && <span className="rating-value">{Number(value).toFixed(1)}</span>}
  </span>
);

export const RatingInput = ({ value, onChange, label }) => (
  <div className="rating-input">
    {label && <span className="field-label">{label}</span>}
    <div className="rating-input-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`rating-star ${star <= value ? 'active' : ''}`}
          onClick={() => onChange(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Star size={24} className="star" fill={star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
      <span className="rating-input-value">{value || 0}/5</span>
    </div>
  </div>
);

export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading }) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="confirm-body">
      <span className={`confirm-icon confirm-${tone}`}>
        <AlertTriangle size={22} />
      </span>
      <p>{message}</p>
    </div>
  </Modal>
);
