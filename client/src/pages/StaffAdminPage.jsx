import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ConciergeBell,
  Copy,
  KeyRound,
  RefreshCw,
  SearchX,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { formatDate, formatDateTime, roleLabel } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  StatCard,
  Tabs,
  Toggle,
} from '../components/ui.jsx';

const MANAGED_ROLES = ['receptionist', 'housekeeping'];
const ROLE_FILTER = MANAGED_ROLES.join(',');

const ROLE_META = {
  receptionist: {
    icon: ConciergeBell,
    title: 'Front office',
    label: 'Receptionist',
    hint: 'Bookings, check-in/out, guests and billing.',
    defaultTitle: 'Front office executive',
    tone: 'blue',
  },
  housekeeping: {
    icon: Sparkles,
    title: 'Housekeeping',
    label: 'Housekeeping',
    hint: 'Room readiness, cleaning tasks and maintenance.',
    defaultTitle: 'Housekeeping attendant',
    tone: 'sage',
  },
};

const TABS = [
  { key: '', label: 'All staff' },
  { key: 'receptionist', label: 'Front office' },
  { key: 'housekeeping', label: 'Housekeeping' },
];

const blankForm = (role = 'receptionist') => ({
  name: '',
  email: '',
  phone: '',
  jobTitle: ROLE_META[role]?.defaultTitle || '',
  role,
  password: '',
  isActive: true,
});

const makePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
};

const StaffFormModal = ({ open, onClose, member, defaultRole, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(() => blankForm(defaultRole));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowPassword(false);
    if (member) {
      setForm({
        name: member.name || '',
        email: member.email || '',
        phone: member.phone || '',
        jobTitle: member.jobTitle || '',
        role: MANAGED_ROLES.includes(member.role) ? member.role : 'receptionist',
        password: '',
        isActive: member.isActive !== false,
      });
    } else {
      setForm(blankForm(defaultRole || 'receptionist'));
    }
  }, [open, member, defaultRole]);

  const changeRole = (role) => {
    setForm((current) => ({
      ...current,
      role,
      jobTitle:
        !current.jobTitle || Object.values(ROLE_META).some((meta) => meta.defaultTitle === current.jobTitle)
          ? ROLE_META[role]?.defaultTitle || ''
          : current.jobTitle,
    }));
  };

  const generatePassword = () => {
    setForm((current) => ({ ...current, password: makePassword() }));
    setShowPassword(true);
  };

  const copyPassword = async () => {
    if (!form.password) return;
    try {
      await navigator.clipboard.writeText(form.password);
      toast.success('Password copied to clipboard.');
    } catch {
      toast.error('Could not copy automatically — select the password manually.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!MANAGED_ROLES.includes(form.role)) {
      toast.error('Choose a front office or housekeeping role.');
      return;
    }
    if (!member && form.password.length < 8) {
      toast.error('Set a password of at least 8 characters.');
      return;
    }
    if (form.password && form.password.length < 8) {
      toast.error('Passwords must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        jobTitle: form.jobTitle.trim(),
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      };
      if (member) payload.isActive = form.isActive;

      const { data } = member
        ? await api.patch(`/users/${member._id || member.id}`, payload)
        : await api.post('/users', payload);

      toast.success(
        member ? `${data.user?.name || form.name} updated.` : `${form.name} can now sign in.`
      );
      onSaved?.(data.user);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const meta = ROLE_META[form.role] || ROLE_META.receptionist;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? `Edit ${member.name}` : `Add ${meta.label.toLowerCase()}`}
      subtitle={
        member
          ? 'Update contact details, role or account access.'
          : 'Create a login and share the credentials with your new team member.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} icon={member ? BadgeCheck : UserPlus}>
            {member ? 'Save changes' : 'Create account'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-row">
          <Field label="Full name" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              autoComplete="name"
              placeholder="e.g. Ayesha Khan"
            />
          </Field>
          <Field label="Email address" required>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
              autoComplete="email"
              placeholder="name@hotel.com"
            />
          </Field>
        </div>

        <div className="form-row">
          <Field label="Department role" required>
            <Select value={form.role} onChange={(event) => changeRole(event.target.value)} required>
              {MANAGED_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_META[role].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Job title">
            <Input
              value={form.jobTitle}
              onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
              placeholder={meta.defaultTitle}
            />
          </Field>
        </div>

        <Field label="Phone number">
          <Input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            autoComplete="tel"
            placeholder="+1 555 0100"
          />
        </Field>

        <Field
          label={member ? 'Reset password' : 'Temporary password'}
          required={!member}
          hint={member ? 'Leave blank to keep the current password.' : 'At least 8 characters. Generate a strong one below.'}
        >
          <div className="password-tools">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!member}
              minLength={8}
              autoComplete="new-password"
              placeholder={member ? 'Unchanged' : 'Enter or generate a password'}
            />
            <div className="password-actions">
              <Button size="xs" variant="outline" icon={RefreshCw} onClick={generatePassword}>
                Generate
              </Button>
              <Button
                size="xs"
                variant="ghost"
                icon={Copy}
                onClick={copyPassword}
                disabled={!form.password}
              >
                Copy
              </Button>
              <button
                type="button"
                className="link-btn"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </Field>

        {member && (
          <Toggle
            checked={form.isActive}
            onChange={(value) => setForm({ ...form, isActive: value })}
            label="Account active — this person can sign in"
          />
        )}

        <div className="inline-note">
          <ShieldCheck size={15} />
          <span>{meta.hint} Passwords are stored as secure hashes; account removal never deletes historical records.</span>
        </div>
      </form>
    </Modal>
  );
};

const StaffAdminPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], pagination: null });
  const [summary, setSummary] = useState({ receptionist: 0, housekeeping: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [defaultRole, setDefaultRole] = useState('receptionist');
  const [editing, setEditing] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const roleFilter = tab || ROLE_FILTER;
      const [directory, allStaff] = await Promise.all([
        api.get('/users', {
          params: {
            page,
            limit: 12,
            roles: roleFilter,
            ...(debouncedQuery ? { q: debouncedQuery } : {}),
            ...(status ? { active: status } : {}),
          },
        }),
        api.get('/users', { params: { roles: ROLE_FILTER, limit: 1000 } }),
      ]);

      setData(directory.data);
      const people = allStaff.data.users || [];
      setSummary({
        receptionist: people.filter((person) => person.role === 'receptionist').length,
        housekeeping: people.filter((person) => person.role === 'housekeeping').length,
        active: people.filter((person) => person.isActive).length,
        inactive: people.filter((person) => !person.isActive).length,
      });
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab, status, debouncedQuery]);

  useLiveRefresh(load);

  const filtersActive = Boolean(query || tab || status);
  const clearFilters = () => {
    setQuery('');
    setTab('');
    setStatus('');
    setPage(1);
  };

  const openNew = (role = 'receptionist') => {
    setEditing(null);
    setDefaultRole(role);
    setFormOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setDefaultRole(member.role);
    setFormOpen(true);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setSavingAction(true);
    try {
      if (target.isActive) {
        await api.delete(`/users/${target._id || target.id}`);
        toast.success(`${target.name} removed from the active team.`);
      } else {
        await api.patch(`/users/${target._id || target.id}`, { isActive: true });
        toast.success(`${target.name} restored to the team.`);
      }
      setRemoveTarget(null);
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingAction(false);
    }
  };

  const tabCounts = useMemo(
    () => ({
      '': summary.receptionist + summary.housekeeping,
      receptionist: summary.receptionist,
      housekeeping: summary.housekeeping,
    }),
    [summary]
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Administration"
        title="Staff administration"
        subtitle="Build and manage the front office and housekeeping teams — add a person in seconds, remove access just as fast."
        actions={<Button icon={UserPlus} onClick={() => openNew()}>Add staff member</Button>}
      />

      <div className="stats-grid">
        <StatCard
          label="Front office"
          value={summary.receptionist}
          hint="Receptionist accounts"
          icon={ConciergeBell}
          tone="blue"
        />
        <StatCard
          label="Housekeeping"
          value={summary.housekeeping}
          hint="Housekeeping accounts"
          icon={Sparkles}
          tone="sage"
        />
        <StatCard
          label="Active team"
          value={summary.active}
          hint="Can sign in right now"
          icon={UserRoundCheck}
          tone="ink"
        />
        <StatCard
          label="Removed access"
          value={summary.inactive}
          hint="Deactivated, records kept"
          icon={UserRoundX}
          tone="terracotta"
        />
      </div>

      <div className="quick-add-grid">
        {MANAGED_ROLES.map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <button type="button" key={role} className={`quick-add-tile quick-add-${meta.tone}`} onClick={() => openNew(role)}>
              <span className="quick-add-icon"><Icon size={22} strokeWidth={1.7} /></span>
              <span className="quick-add-copy">
                <strong>Add {meta.label.toLowerCase()}</strong>
                <span>{meta.hint}</span>
              </span>
              <span className="quick-add-cta"><UserPlus size={16} /> Add</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHead
          title="Staff directory"
          subtitle="Edit details, reset passwords, or remove and restore access when someone joins or leaves."
          action={
            <div className="table-tools">
              <SearchInput value={query} onChange={setQuery} placeholder="Name or email…" />
              <Select
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); }}
                aria-label="Filter by account status"
              >
                <option value="">All statuses</option>
                <option value="true">Active only</option>
                <option value="false">Removed</option>
              </Select>
            </div>
          }
        />

        <Tabs
          items={TABS.map((item) => ({ ...item, count: tabCounts[item.key] }))}
          value={tab}
          onChange={(value) => { setTab(value); setPage(1); }}
        />

        <div className="filter-bar">
          {filtersActive ? (
            <Button variant="ghost" size="sm" icon={SearchX} onClick={clearFilters}>Clear filters</Button>
          ) : (
            <span className="muted small">Only administrators and managers can manage staff accounts.</span>
          )}
          <span className="filter-count">
            {data.pagination?.total ?? 0} account{data.pagination?.total === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : data.users.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No staff found"
            message={filtersActive ? 'Try a different search, role or status.' : 'Add your first team member using the quick-add buttons above.'}
            action={
              filtersActive ? (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              ) : (
                <Button icon={UserPlus} onClick={() => openNew()}>Add staff member</Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table staff-table staff-admin-table">
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Department</th>
                  <th>Contact</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((member) => {
                  const id = member._id || member.id;
                  const isSelf = String(id) === String(user?._id || user?.id);
                  const meta = ROLE_META[member.role] || ROLE_META.receptionist;
                  return (
                    <tr key={id} className={member.isActive ? '' : 'row-muted'}>
                      <td>
                        <div className="table-person">
                          <Avatar name={member.name} size="xs" tone={meta.tone === 'sage' ? 'default' : 'gold'} />
                          <div>
                            <strong>
                              {member.name}
                              {isSelf && <span className="self-tag">You</span>}
                            </strong>
                            <span>{member.jobTitle || roleLabel(member.role)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={meta.tone} dot={false}>
                          {meta.label}
                        </Badge>
                      </td>
                      <td>
                        <span>{member.email}</span>
                        <span className="table-sub">{member.phone || 'No phone'}</span>
                      </td>
                      <td>{formatDate(member.createdAt)}</td>
                      <td>{member.lastLogin ? formatDateTime(member.lastLogin) : 'Never'}</td>
                      <td>
                        <Badge tone={member.isActive ? 'sage' : 'neutral'}>
                          {member.isActive ? 'Active' : 'Removed'}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button size="xs" variant="outline" onClick={() => openEdit(member)}>
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            icon={member.isActive ? Trash2 : UserRoundCheck}
                            onClick={() => setRemoveTarget(member)}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot remove your own account.' : undefined}
                          >
                            {member.isActive ? 'Remove' : 'Restore'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.pagination && data.pagination.pages > 1 && (
          <div className="pagination">
            <span>
              Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} accounts
            </span>
            <div>
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={data.pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page >= data.pagination.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        member={editing}
        defaultRole={defaultRole}
        onSaved={() => load({ quiet: true })}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title={
          removeTarget
            ? `${removeTarget.isActive ? 'Remove' : 'Restore'} ${removeTarget.name}?`
            : ''
        }
        message={
          removeTarget?.isActive
            ? 'Their login is deactivated immediately and they can no longer access the property. Past bookings, tasks and records stay intact.'
            : 'Their login will be restored with the same role. Set a new password from the Edit button if needed.'
        }
        confirmLabel={removeTarget?.isActive ? 'Remove from team' : 'Restore access'}
        tone={removeTarget?.isActive ? 'danger' : 'primary'}
        loading={savingAction}
      />
    </div>
  );
};

export default StaffAdminPage;
