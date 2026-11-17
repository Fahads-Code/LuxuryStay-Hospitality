import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from './ui.jsx';

const blank = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  nationality: 'United States',
  idType: 'passport',
  idNumber: '',
  preferences: '',
  notes: '',
  vip: false,
  marketingConsent: false,
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

const GuestFormModal = ({ open, onClose, guest, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (guest) {
      setForm({
        firstName: guest.firstName || '',
        lastName: guest.lastName || '',
        email: guest.email || '',
        phone: guest.phone || '',
        nationality: guest.nationality || '',
        idType: guest.idType || 'passport',
        idNumber: guest.idNumber || '',
        preferences: (guest.preferences || []).join(', '),
        notes: guest.notes || '',
        vip: Boolean(guest.vip),
        marketingConsent: Boolean(guest.marketingConsent),
        street: guest.address?.street || '',
        city: guest.address?.city || '',
        state: guest.address?.state || '',
        postalCode: guest.address?.postalCode || '',
        country: guest.address?.country || '',
      });
    } else {
      setForm(blank);
    }
  }, [open, guest]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || '',
        nationality: form.nationality,
        idType: form.idType,
        idNumber: form.idNumber,
        vip: form.vip,
        marketingConsent: form.marketingConsent,
        notes: form.notes,
        preferences: form.preferences
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
        },
      };
      const { data } = guest
        ? await api.patch(`/guests/${guest._id}`, payload)
        : await api.post('/guests', payload);
      toast.success(guest ? 'Guest profile updated.' : 'Guest profile created.');
      onSaved?.(data.guest);
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
      title={guest ? `Edit ${guest.firstName} ${guest.lastName}` : 'New guest profile'}
      subtitle="Capture the details that make a stay feel personal."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={UserPlus}>
            {guest ? 'Save profile' : 'Create guest'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <Field label="First name" required>
            <Input
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              required
              autoComplete="given-name"
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              required
              autoComplete="family-name"
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Email address">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
            />
          </Field>
          <Field label="Phone number">
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              autoComplete="tel"
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Nationality">
            <Input
              value={form.nationality}
              onChange={(event) => setForm({ ...form, nationality: event.target.value })}
            />
          </Field>
          <Field label="Identification">
            <div className="form-inline">
              <Select
                value={form.idType}
                onChange={(event) => setForm({ ...form, idType: event.target.value })}
              >
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="drivers_license">Driver's licence</option>
                <option value="other">Other</option>
              </Select>
              <Input
                value={form.idNumber}
                onChange={(event) => setForm({ ...form, idNumber: event.target.value })}
                placeholder="Document number"
              />
            </div>
          </Field>
        </div>
        <Field label="Preferences" hint="Separate with commas — e.g. high floor, feather-free pillows.">
          <Input
            value={form.preferences}
            onChange={(event) => setForm({ ...form, preferences: event.target.value })}
            placeholder="High floor, sparkling water"
          />
        </Field>
        <div className="form-row">
          <Field label="City">
            <Input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="Country">
            <Input
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
              autoComplete="country-name"
            />
          </Field>
        </div>
        <Field label="Internal notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Anything the team should remember."
          />
        </Field>
        <div className="form-row toggles-row">
          <Toggle
            checked={form.vip}
            onChange={(value) => setForm({ ...form, vip: value })}
            label="VIP guest"
          />
          <Toggle
            checked={form.marketingConsent}
            onChange={(value) => setForm({ ...form, marketingConsent: value })}
            label="Marketing consent"
          />
        </div>
      </form>
    </Modal>
  );
};

export default GuestFormModal;
