import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FilterX,
  MessageSquareQuote,
  Send,
  Star,
  ThumbsUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { formatDate, formatDateTime, statusLabel } from '../lib/format.js';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  PageLoader,
  Rating,
  Select,
  StatCard,
  Tabs,
  Textarea,
} from '../components/ui.jsx';

const PUBLISHED_TABS = [
  { key: 'all', label: 'All feedback' },
  { key: 'true', label: 'Published' },
  { key: 'false', label: 'Not published' },
];

const ResponseModal = ({ open, onClose, entry, onSaved }) => {
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(entry?.response?.text || '');
  }, [open, entry]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/feedback/${entry._id}/respond`, { text: text.trim() });
      toast.success(entry?.response?.text ? 'Response updated.' : 'Response published to the guest record.');
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
      title={entry?.response?.text ? 'Edit response' : 'Respond to feedback'}
      subtitle="A thoughtful reply becomes part of the guest's stay record."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={Send} disabled={text.trim().length < 2}>
            Save response
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        {entry && (
          <div className="feedback-quote">
            <Rating value={entry.ratings?.overall} />
            <strong>{entry.title || 'Guest feedback'}</strong>
            <p>{entry.comments || 'No written comment.'}</p>
            <span className="feedback-quote-meta">{entry.guest?.firstName} {entry.guest?.lastName} · {formatDate(entry.createdAt)}</span>
          </div>
        )}
        <Field label="Your response" required>
          <Textarea
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Thank the guest, acknowledge their experience and share what happens next."
            minLength={2}
            required
          />
        </Field>
      </form>
    </Modal>
  );
};

const FeedbackInboxPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [feedback, setFeedback] = useState([]);
  const [summary, setSummary] = useState(null);
  const [snapshot, setSnapshot] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState('all');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [responseOpen, setResponseOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const canModerate = ['admin', 'manager'].includes(user.role);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [feedbackRes, snapshotRes] = await Promise.all([
        api.get('/feedback', {
          params: {
            page,
            limit: 10,
            ...(published !== 'all' ? { published } : {}),
            ...(rating ? { rating } : {}),
          },
        }),
        api.get('/feedback', { params: { limit: 200 } }),
      ]);
      setFeedback(feedbackRes.data.feedback);
      setSummary(feedbackRes.data.summary);
      setPagination(feedbackRes.data.pagination);
      setSnapshot(snapshotRes.data.feedback);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, published, rating]);

  useLiveRefresh(load);

  const snapshotStats = useMemo(() => {
    const total = snapshot.length;
    const responded = snapshot.filter((entry) => entry.response?.text).length;
    const publishedCount = snapshot.filter((entry) => entry.isPublished).length;
    const fiveStar = snapshot.filter((entry) => entry.ratings?.overall === 5).length;
    return {
      total,
      responded,
      publishedCount,
      fiveStar,
      responseRate: total ? Math.round((responded / total) * 100) : 0,
    };
  }, [snapshot]);

  const togglePublish = async (entry) => {
    setBusy(entry._id);
    try {
      await api.patch(`/feedback/${entry._id}/publish`, { isPublished: !entry.isPublished });
      toast.success(entry.isPublished ? 'Feedback hidden from the public site.' : 'Feedback published to the public site.');
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const clearFilters = () => {
    setPublished('all');
    setRating('');
    setPage(1);
  };

  const filtersActive = published !== 'all' || rating;

  const stats = [
    { label: 'Overall rating', value: Number(summary?.overall || 0).toFixed(1), hint: `${summary?.count || 0} guest reviews`, icon: Star, tone: 'gold' },
    { label: 'Response rate', value: `${snapshotStats.responseRate}%`, hint: `${snapshotStats.responded} of ${snapshotStats.total} answered`, icon: ThumbsUp, tone: 'sage' },
    { label: 'Five-star reviews', value: snapshotStats.fiveStar, hint: 'Delighted guests', icon: MessageSquareQuote, tone: 'ink' },
    { label: 'Published', value: snapshotStats.publishedCount, hint: 'Visible on the public site', icon: Eye, tone: 'blue' },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Guest voice"
        title="Guest feedback"
        subtitle="Listen closely, respond thoughtfully and share the best of what guests say."
        actions={<Badge tone="gold" dot={false}>{summary?.count || 0} reviews</Badge>}
      />

      <div className="stats-grid">
        {stats.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <Card>
        <CardHead
          title="Feedback inbox"
          subtitle="Every rating and comment, with the team's reply."
        />

        <Tabs
          items={PUBLISHED_TABS.map((tab) => ({
            ...tab,
            count:
              tab.key === 'all'
                ? snapshotStats.total
                : tab.key === 'true'
                  ? snapshotStats.publishedCount
                  : snapshotStats.total - snapshotStats.publishedCount,
          }))}
          value={published}
          onChange={(value) => { setPublished(value); setPage(1); }}
        />

        <div className="filter-bar">
          <label className="filter-field">
            <span>Rating</span>
            <select value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }}>
              <option value="">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Clear filters</Button>
          )}
          <span className="filter-count">
            {pagination?.total ?? 0} review{pagination?.total === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : feedback.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={filtersActive ? 'No reviews match' : 'No feedback yet'}
            message={
              filtersActive
                ? 'Try a different rating or publication filter.'
                : 'Guests can share feedback after check-out from the guest portal or public site.'
            }
            action={filtersActive && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="feedback-list">
            {feedback.map((entry) => {
              const guestName = `${entry.guest?.firstName || ''} ${entry.guest?.lastName || ''}`.trim() || 'Guest';
              return (
                <article key={entry._id} className="feedback-card">
                  <div className="feedback-card-head">
                    <div className="feedback-card-person">
                      <Avatar name={guestName} size="md" tone={entry.guest?.vip ? 'gold' : 'default'} />
                      <div className="feedback-card-person-copy">
                        <strong>
                          {guestName}
                          {entry.guest?.vip && <span className="vip-dot">VIP</span>}
                        </strong>
                        <span>{entry.guest?.email || 'Guest review'}</span>
                        <div className="feedback-card-meta">
                          <Rating value={entry.ratings?.overall} showValue />
                          <span>{formatDateTime(entry.createdAt)}</span>
                          {entry.booking && (
                            <Link to={`/app/bookings/${entry.booking._id}`} className="table-link">
                              {entry.booking.reference}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="feedback-card-badges">
                      <Badge tone={entry.isPublished ? 'sage' : 'neutral'}>
                        {entry.isPublished ? 'Published' : 'Not published'}
                      </Badge>
                      {entry.response?.text && <Badge tone="blue" dot={false}>Responded</Badge>}
                    </div>
                  </div>

                  <div className="feedback-card-body">
                    {entry.title && <h3>{entry.title}</h3>}
                    <p>{entry.comments || 'The guest left a rating without a written comment.'}</p>
                    <div className="rating-pills">
                      {Object.entries(entry.ratings || {})
                        .filter(([key]) => key !== 'overall')
                        .map(([key, value]) => (
                          <span key={key}>
                            {statusLabel(key)} <strong>{value}/5</strong>
                          </span>
                        ))}
                    </div>
                  </div>

                  {entry.response?.text && (
                    <div className="feedback-response">
                      <MessageSquareQuote size={16} />
                      <div>
                        <strong>
                          Response{entry.response.by?.name ? ` · ${entry.response.by.name}` : ''}
                        </strong>
                        <p>{entry.response.text}</p>
                        {entry.response.at && <span>{formatDate(entry.response.at)}</span>}
                      </div>
                    </div>
                  )}

                  {canModerate && (
                    <div className="feedback-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Send}
                        onClick={() => { setSelected(entry); setResponseOpen(true); }}
                      >
                        {entry.response?.text ? 'Edit response' : 'Respond'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={entry.isPublished ? EyeOff : Eye}
                        loading={busy === entry._id}
                        onClick={() => togglePublish(entry)}
                      >
                        {entry.isPublished ? 'Unpublish' : 'Publish'}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="pagination">
            <span>
              Page {pagination.page} of {pagination.pages} · {pagination.total} reviews
            </span>
            <div>
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ResponseModal
        open={responseOpen}
        onClose={() => setResponseOpen(false)}
        entry={selected}
        onSaved={() => load({ quiet: true })}
      />
    </div>
  );
};

export default FeedbackInboxPage;
