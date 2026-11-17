import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquareQuote } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import api, { errorMessage } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Field, Input, RatingInput, Textarea } from '../components/ui.jsx';

const FeedbackPage = () => {
  const toast = useToast();
  const [form, setForm] = useState({
    reference: '',
    email: '',
    title: '',
    comments: '',
    overall: 5,
    cleanliness: 5,
    service: 5,
    comfort: 5,
    value: 5,
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post('/public/feedback', {
        reference: form.reference.trim().toUpperCase(),
        email: form.email.trim(),
        ratings: {
          overall: Number(form.overall),
          cleanliness: Number(form.cleanliness),
          service: Number(form.service),
          comfort: Number(form.comfort),
          value: Number(form.value),
        },
        title: form.title || undefined,
        comments: form.comments || undefined,
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="site public-page">
      <PublicNav solid />
      <main className="feedback-public">
        {done ? (
          <div className="confirmation-card">
            <span className="confirmation-icon">
              <CheckCircle2 size={34} />
            </span>
            <p className="eyebrow">With our thanks</p>
            <h1>Your story means the world.</h1>
            <p className="confirmation-lede">
              Thank you for taking a moment to share your experience. Our team reads every note,
              and your words help us make the next stay even better.
            </p>
            <div className="confirmation-actions">
              <Link to="/" className="btn btn-outline">
                <ArrowLeft size={16} /> Back to the hotel
              </Link>
              <Link to="/book" className="btn btn-primary">
                Plan another stay
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="feedback-public-intro">
              <p className="eyebrow">After your stay</p>
              <h1>Tell us how it felt.</h1>
              <p>
                Use the reservation reference from your confirmation email. Your feedback is shared
                privately with our leadership team.
              </p>
              <span className="feedback-intro-icon">
                <MessageSquareQuote size={22} />
              </span>
            </section>

            <form className="feedback-public-form" onSubmit={submit}>
              <div className="form-row">
                <Field label="Reservation reference" required hint="Example: LUX-1042">
                  <Input
                    value={form.reference}
                    onChange={(event) => setForm({ ...form, reference: event.target.value })}
                    placeholder="LUX-1234"
                    required
                  />
                </Field>
                <Field label="Email used for the booking" required>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="you@example.com"
                    required
                  />
                </Field>
              </div>

              <RatingInput
                label="Overall experience"
                value={form.overall}
                onChange={(value) => setForm({ ...form, overall: value })}
              />

              <div className="feedback-subratings">
                {[
                  ['cleanliness', 'Cleanliness'],
                  ['service', 'Service'],
                  ['comfort', 'Comfort'],
                  ['value', 'Value'],
                ].map(([key, label]) => (
                  <RatingInput
                    key={key}
                    label={label}
                    value={form[key]}
                    onChange={(value) => setForm({ ...form, [key]: value })}
                  />
                ))}
              </div>

              <Field label="A title for your review">
                <Input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="A lovely escape"
                />
              </Field>
              <Field label="Your comments">
                <Textarea
                  rows={5}
                  value={form.comments}
                  onChange={(event) => setForm({ ...form, comments: event.target.value })}
                  placeholder="What stood out? What could we do better?"
                />
              </Field>

              <Button type="submit" size="lg" loading={loading}>
                Share my feedback
              </Button>
            </form>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
};

export default FeedbackPage;
