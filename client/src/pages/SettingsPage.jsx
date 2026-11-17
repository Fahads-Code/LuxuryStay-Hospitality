import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock3,
  Globe2,
  Landmark,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  ScrollText,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { currency } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  Badge,
  Button,
  Card,
  CardHead,
  Field,
  Input,
  PageHeader,
  PageLoader,
  Select,
  Tabs,
  Textarea,
} from '../components/ui.jsx';

const SERVICE_TYPES = [
  { type: 'room_service', label: 'In-room dining' },
  { type: 'laundry', label: 'Laundry & pressing' },
  { type: 'wake_up_call', label: 'Wake-up call' },
  { type: 'transportation', label: 'Airport transfer' },
  { type: 'spa', label: 'Spa treatment' },
  { type: 'luggage', label: 'Luggage assistance' },
  { type: 'extra_bed', label: 'Extra bed' },
  { type: 'other', label: 'Other service' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'AED'];

const TABS = [
  { key: 'property', label: 'Property' },
  { key: 'operations', label: 'Operations' },
  { key: 'policies', label: 'Policies' },
  { key: 'services', label: 'Service menu' },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const SettingsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('property');

  const canEdit = user?.role === 'admin';

  const load = async ({ quiet = false } = {}) => {
    // Never overwrite a draft while someone is editing the settings.
    const hasUnsavedEdits =
      settings && draft && JSON.stringify(settings) !== JSON.stringify(draft);
    if (quiet && hasUnsavedEdits) return;

    if (!quiet) setLoading(true);
    try {
      const { data } = await api.get('/settings');
      setSettings(data.settings);
      setDraft(clone(data.settings));
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLiveRefresh(load);

  const dirty = useMemo(
    () => Boolean(settings && draft && JSON.stringify(settings) !== JSON.stringify(draft)),
    [settings, draft]
  );

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateAddress = (patch) =>
    setDraft((current) => ({ ...current, address: { ...current.address, ...patch } }));
  const updatePolicy = (patch) =>
    setDraft((current) => ({ ...current, policies: { ...current.policies, ...patch } }));

  const updateMenuItem = (index, patch) =>
    setDraft((current) => ({
      ...current,
      serviceMenu: current.serviceMenu.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));

  const addMenuItem = () =>
    setDraft((current) => ({
      ...current,
      serviceMenu: [
        ...current.serviceMenu,
        { type: 'other', label: 'New service', price: 0, description: '' },
      ],
    }));

  const removeMenuItem = (index) =>
    setDraft((current) => ({
      ...current,
      serviceMenu: current.serviceMenu.filter((_, itemIndex) => itemIndex !== index),
    }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/settings', {
        hotelName: draft.hotelName,
        tagline: draft.tagline,
        email: draft.email,
        phone: draft.phone,
        website: draft.website,
        address: draft.address,
        currency: draft.currency,
        taxRate: Number(draft.taxRate),
        checkInTime: draft.checkInTime,
        checkOutTime: draft.checkOutTime,
        policies: draft.policies,
        serviceMenu: draft.serviceMenu.map((item) => ({
          type: item.type,
          label: item.label,
          price: Number(item.price) || 0,
          description: item.description || '',
        })),
      });
      setSettings(data.settings);
      setDraft(clone(data.settings));
      toast.success('Hotel settings saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!settings || !draft) {
    return (
      <div className="page">
        <PageHeader eyebrow="Administration" title="Hotel settings" subtitle="The details that shape every guest stay." />
        <Card>
          <div className="empty">
            <h3>Settings are unavailable</h3>
            <p>Refresh the page or contact an administrator if this continues.</p>
          </div>
        </Card>
      </div>
    );
  }

  const addressLine = [
    draft.address?.street,
    draft.address?.city,
    draft.address?.state,
    draft.address?.postalCode,
    draft.address?.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="Administration"
        title="Hotel settings"
        subtitle="Property details, operating rhythms, policies and the guest service menu."
        actions={
          canEdit ? (
            <>
              {dirty && (
                <Button
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => setDraft(clone(settings))}
                  disabled={saving}
                >
                  Discard
                </Button>
              )}
              <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </>
          ) : (
            <Badge tone="gold" dot={false}>Read-only · admin access required</Badge>
          )
        }
      />

      <div className="settings-hero">
        <div className="settings-hero-mark">
          <Landmark size={30} strokeWidth={1.4} />
        </div>
        <div className="settings-hero-copy">
          <p className="eyebrow">Property profile</p>
          <h2>{draft.hotelName}</h2>
          <p>{draft.tagline}</p>
          <div className="settings-hero-meta">
            <span><MapPin size={14} /> {addressLine || 'Address not set'}</span>
            <span><Globe2 size={14} /> {draft.website || 'Website not set'}</span>
            <span><Clock3 size={14} /> Check-in {draft.checkInTime} · Check-out {draft.checkOutTime}</span>
          </div>
        </div>
        <div className="settings-hero-side">
          <span className="settings-chip">
            <strong>{draft.currency}</strong>
            <em>Currency</em>
          </span>
          <span className="settings-chip">
            <strong>{draft.taxRate}%</strong>
            <em>Tax rate</em>
          </span>
        </div>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'property' && (
        <div className="settings-grid">
          <Card>
            <CardHead
              title="Identity"
              subtitle="How the property introduces itself to guests and staff."
              action={<Building2 size={18} className="muted" />}
            />
            <div className="form-grid">
              <Field label="Hotel name" required>
                <Input
                  value={draft.hotelName}
                  onChange={(event) => update({ hotelName: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Tagline">
                <Input
                  value={draft.tagline}
                  onChange={(event) => update({ tagline: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
              <div className="form-row">
                <Field label="Email address" required>
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(event) => update({ email: event.target.value })}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Phone number" required>
                  <Input
                    value={draft.phone}
                    onChange={(event) => update({ phone: event.target.value })}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
              <Field label="Website">
                <Input
                  value={draft.website}
                  onChange={(event) => update({ website: event.target.value })}
                  placeholder="www.yourhotel.com"
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Address"
              subtitle="Used on folios, confirmations and the public site."
              action={<MapPin size={18} className="muted" />}
            />
            <div className="form-grid">
              <Field label="Street">
                <Input
                  value={draft.address?.street || ''}
                  onChange={(event) => updateAddress({ street: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
              <div className="form-row three">
                <Field label="City">
                  <Input
                    value={draft.address?.city || ''}
                    onChange={(event) => updateAddress({ city: event.target.value })}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="State / region">
                  <Input
                    value={draft.address?.state || ''}
                    onChange={(event) => updateAddress({ state: event.target.value })}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Postal code">
                  <Input
                    value={draft.address?.postalCode || ''}
                    onChange={(event) => updateAddress({ postalCode: event.target.value })}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
              <Field label="Country">
                <Input
                  value={draft.address?.country || ''}
                  onChange={(event) => updateAddress({ country: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
            </div>
            <div className="inline-note">
              <MapPin size={15} />
              <span>{addressLine || 'Add an address so guests always know where to find you.'}</span>
            </div>
          </Card>
        </div>
      )}

      {tab === 'operations' && (
        <div className="settings-grid">
          <Card>
            <CardHead
              title="Stay rhythm"
              subtitle="The times guests plan their journeys around."
              action={<Clock3 size={18} className="muted" />}
            />
            <div className="form-row">
              <Field label="Check-in time" required hint="Use a 24-hour HH:MM format.">
                <Input
                  type="time"
                  value={draft.checkInTime}
                  onChange={(event) => update({ checkInTime: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Check-out time" required hint="Use a 24-hour HH:MM format.">
                <Input
                  type="time"
                  value={draft.checkOutTime}
                  onChange={(event) => update({ checkOutTime: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
            </div>
            <div className="settings-note-grid">
              <div>
                <Check size={15} />
                <span>Arrival windows appear on reservation and portal pages.</span>
              </div>
              <div>
                <Check size={15} />
                <span>Housekeeping schedules use the departure time as a guide.</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Billing basics"
              subtitle="Applies to new folios and reservation quotes."
              action={<UtensilsCrossed size={18} className="muted" />}
            />
            <div className="form-row">
              <Field label="Currency" required>
                <Select
                  value={draft.currency}
                  onChange={(event) => update({ currency: event.target.value })}
                  disabled={!canEdit}
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tax rate (%)" required hint="Between 0 and 50 percent.">
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.01"
                  value={draft.taxRate}
                  onChange={(event) => update({ taxRate: event.target.value })}
                  disabled={!canEdit}
                />
              </Field>
            </div>
            <div className="inline-note">
              <Sparkles size={15} />
              <span>
                A {currency(100, draft.currency, 2)} room charge would total{' '}
                <strong>{currency(100 + (Number(draft.taxRate) || 0), draft.currency, 2)}</strong> after tax.
              </span>
            </div>
          </Card>
        </div>
      )}

      {tab === 'policies' && (
        <Card>
          <CardHead
            title="Guest policies"
            subtitle="Shared on the public site, confirmations and the guest portal."
            action={<ScrollText size={18} className="muted" />}
          />
          <div className="form-grid policy-grid">
            <Field label="Cancellation policy">
              <Textarea
                rows={3}
                value={draft.policies?.cancellation || ''}
                onChange={(event) => updatePolicy({ cancellation: event.target.value })}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Children">
              <Textarea
                rows={2}
                value={draft.policies?.children || ''}
                onChange={(event) => updatePolicy({ children: event.target.value })}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Pets">
              <Textarea
                rows={2}
                value={draft.policies?.pets || ''}
                onChange={(event) => updatePolicy({ pets: event.target.value })}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Smoking">
              <Textarea
                rows={2}
                value={draft.policies?.smoking || ''}
                onChange={(event) => updatePolicy({ smoking: event.target.value })}
                disabled={!canEdit}
              />
            </Field>
          </div>
        </Card>
      )}

      {tab === 'services' && (
        <Card>
          <CardHead
            title="Guest service menu"
            subtitle="Prices are used when the team or a guest requests a service."
            action={
              canEdit && (
                <Button size="sm" variant="outline" icon={Plus} onClick={addMenuItem}>
                  Add service
                </Button>
              )
            }
          />
          <div className="service-menu-editor">
            {draft.serviceMenu?.length ? (
              draft.serviceMenu.map((item, index) => (
                <div key={`${item.type}-${index}`} className="service-menu-row">
                  <div className="service-menu-main">
                    <Field label="Service type">
                      <Select
                        value={item.type}
                        onChange={(event) => {
                          const preset = SERVICE_TYPES.find((entry) => entry.type === event.target.value);
                          updateMenuItem(index, {
                            type: event.target.value,
                            label: preset?.label || item.label,
                          });
                        }}
                        disabled={!canEdit}
                      >
                        {SERVICE_TYPES.map((entry) => (
                          <option key={entry.type} value={entry.type}>{entry.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Menu label">
                      <Input
                        value={item.label}
                        onChange={(event) => updateMenuItem(index, { label: event.target.value })}
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label={`Price (${draft.currency})`}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(event) => updateMenuItem(index, { price: event.target.value })}
                        disabled={!canEdit}
                      />
                    </Field>
                  </div>
                  <Field label="Description">
                    <Input
                      value={item.description || ''}
                      onChange={(event) => updateMenuItem(index, { description: event.target.value })}
                      placeholder="What the guest receives"
                      disabled={!canEdit}
                    />
                  </Field>
                  {canEdit && (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => removeMenuItem(index)}
                      className="service-menu-remove"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="empty">
                <h3>No services configured</h3>
                <p>Add a service so the team can post guest requests and charges.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {!canEdit && (
        <div className="inline-note">
          <Landmark size={15} />
          <span>
            Settings are shared across the property. Ask an administrator to make changes.
          </span>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
