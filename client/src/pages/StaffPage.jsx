import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  SearchX,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  UserRoundX,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useLiveRefresh } from '../lib/live.js';
import { formatDateTime, roleLabel } from '../lib/format.js';
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

const ROLE_TONE = {
  admin: 'ink',
  manager: 'gold',
  receptionist: 'blue',
  housekeeping: 'sage',
  guest: 'plum',
};

const ROLE_TABS = [
  { key: '', label: 'Everyone' },
  { key: 'admin', label: 'Admins' },
  { key: 'manager', label: 'Managers' },
  { key: 'receptionist', label: 'Front office' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'guest', label: 'Guest accounts' },
];

const blank = {
  name: '',
  email: '',
  password: '',
  role: 'receptionist',
  phone: '',
  jobTitle: '',
  isActive: true,
  guestProfile: '',
};

const StaffFormModal = ({ open, onClose, member, guests, actor, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (member) {
      setForm({
        name: member.name || '',
        email: member.email || '',
        password: '',
        role: member.role || 'receptionist',
        phone: member.phone || '',
        jobTitle: member.jobTitle || '',
        isActive: member.isActive !== false,
        guestProfile: member.guestProfile?._id || member.guestProfile || '',
      });
    } else {
      setForm(blank);
    }
  }, [open, member]);

  const roleOptions = useMemo(() => {
    const roles = ['manager', 'receptionist', 'housekeeping', 'guest'];
    if (actor?.role === 'admin' || member?.role === 'admin') roles.unshift('admin');
    return roles;
  }, [actor?.role, member?.role]);

  const chooseRole = (role) => {
    setForm((current) => ({
      ...current,
      role,
      guestProfile: role === 'guest' ? current.guestProfile : '',
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!member && form.password.length < 8) {
      toast.error('Set a password of at least 8 characters for the new account.');
      return;
    }
    if (form.password && form.password.length < 8) {
      toast.error('Passwords must be at least 8 characters.');
      return;
    }
    if (form.role === 'guest' && !form.guestProfile) {
      toast.error('Link a guest profile for guest accounts.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        phone: form.phone.trim(),
        jobTitle: form.jobTitle.trim(),
        ...(form.password ? { password: form.password } : {}),
        ...(form.role === 'guest' ? { guestProfile: form.guestProfile } : {}),
      };
      if (member) payload.isActive = form.isActive;

      const { data } = member
        ? await api.patch(`/users/${member._id || member.id}`, payload)
        : await api.post('/users', payload);
      toast.success(member ? `${data.user?.name || form.name} updated.` : `${form.name} can now sign in.`);
      onSaved?.(data.user);
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
      title={member ? `Edit ${member.name}` : 'Add a team member'}
      subtitle="Control who can access the property and what they can do."
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
            />
          </Field>
          <Field label="Email address" required>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
              autoComplete="email"
            />
          </Field>
        </div>

        <div className="form-row">
          <Field label="Role" required>
            <Select value={form.role} onChange={(event) => chooseRole(event.target.value)} required>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Job title">
            <Input
              value={form.jobTitle}
              onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
              placeholder="Front office supervisor"
            />
          </Field>
        </div>

        {form.role === 'guest' && (
          <Field
            label="Linked guest profile"
            required
            hint="Guest accounts can only see the stays and folios belonging to this profile."
          >
            <Select
              value={form.guestProfile}
              onChange={(event) => setForm({ ...form, guestProfile: event.target.value })}
              required
            >
              <option value="">Select a guest profile</option>
              {guests.map((guest) => (
                <option key={guest._id} value={guest._id}>
                  {guest.firstName} {guest.lastName}{guest.email ? ` · ${guest.email}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="form-row">
          <Field label="Phone number">
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              autoComplete="tel"
            />
          </Field>
          <Field
            label={member ? 'Reset password' : 'Temporary password'}
            required={!member}
            hint={member ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}
          >
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!member}
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {member && (
          <div className="form-row toggles-row">
            <Toggle
              checked={form.isActive}
              onChange={(value) => setForm({ ...form, isActive: value })}
              label="Account active"
            />
          </div>
        )}

        <div className="inline-note">
          <ShieldCheck size={15} />
          <span>
            {form.role === 'admin'
              ? 'Administrators have full access, including team, settings and billing controls.'
              : form.role === 'manager'
                ? 'Managers can oversee operations, reports and the team, but only admins change settings.'
                : form.role === 'guest'
                  ? 'Guest accounts are limited to the My stay portal for their linked profile.'
                  : 'Staff accounts can access the operational areas assigned to their role.'}
          </span>
        </div>
      </form>
    </Modal>
  );
};

const StaffPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], pagination: null });
  const [allUsers, setAllUsers] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [savingAction, setSavingAction] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [usersRes, allRes] = await Promise.all([
        api.get('/users', {
          params: {
            page,
            limit: 20,
            ...(query ? { q: query } : {}),
            ...(role ? { role } : {}),
            ...(active ? { active } : {}),
          },
        }),
        api.get('/users', { params: { limit: 200 } }),
      ]);
      setData(usersRes.data);
      setAllUsers(allRes.data.users);
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role, active]);

  useLiveRefresh(load);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    api
      .get('/guests', { params: { limit: 200 } })
      .then(({ data: response }) => setGuests(response.guests || []))
      .catch(() => setGuests([]));
  }, []);

  const counts = useMemo(() => {
    const result = { total: allUsers.length, active: 0, admins: 0, managers: 0, guests: 0, inactive: 0 };
    for (const person of allUsers) {
      if (person.isActive) result.active += 1;
      else result.inactive += 1;
      if (person.role === 'admin') result.admins += 1;
      if (person.role === 'manager') result.managers += 1;
      if (person.role === 'guest') result.guests += 1;
    }
    return result;
  }, [allUsers]);

  const filtersActive = Boolean(query || role || active);

  const clearFilters = () => {
    setQuery('');
    setRole('');
    setActive('');
    setPage(1);
  };

  const changeActive = async () => {
    if (!actionTarget) return;
    const target = actionTarget;
    setSavingAction(true);
    try {
      if (target.isActive) {
        await api.delete(`/users/${target._id || target.id}`);
        toast.success(`${target.name} has been deactivated.`);
      } else {
        await api.patch(`/users/${target._id || target.id}`, { isActive: true });
        toast.success(`${target.name} can sign in again.`);
      }
      setActionTarget(null);
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingAction(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Team & access"
        title="Team & access"
        subtitle="The people behind the experience — and the access each of them holds."
        actions={<Button icon={UserPlus} onClick={openNew}>Add team member</Button>}
      />

      <div className="stats-grid">
        <StatCard label="Team accounts" value={counts.total} hint="Staff and guest portal logins" icon={UsersRound} tone="ink" />
        <StatCard label="Active today" value={counts.active} hint={`${counts.inactive} deactivated`} icon={UserRoundCheck} tone="sage" />
        <StatCard label="Administrators" value={counts.admins} hint={`${counts.managers} manager${counts.managers === 1 ? '' : 's'}`} icon={ShieldCheck} tone="gold" />
        <StatCard label="Guest accounts" value={counts.guests} hint="Linked to a guest profile" icon={KeyRound} tone="terracotta" />
      </div>

      <Card>
        <CardHead
          title="Directory"
          subtitle="Create accounts, reset passwords and deactivate access when someone leaves."
          action={
            <div className="table-tools">
              <SearchInput value={query} onChange={setQuery} placeholder="Name or email…" />
              <Select
                value={active}
                onChange={(event) => { setActive(event.target.value); setPage(1); }}
                aria-label="Filter by account status"
              >
                <option value="">All accounts</option>
                <option value="true">Active only</option>
                <option value="false">Deactivated</option>
              </Select>
            </div>
          }
        />

        <Tabs items={ROLE_TABS} value={role} onChange={(value) => { setRole(value); setPage(1); }} />

        <div className="filter-bar">
          {filtersActive ? (
            <Button variant="ghost" size="sm" icon={SearchX} onClick={clearFilters}>Clear filters</Button>
          ) : (
            <span className="muted small">Only administrators can grant administrator access or change hotel settings.</span>
          )}
          <span className="filter-count">
            {data.pagination?.total ?? 0} account{data.pagination?.total === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : data.users.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No accounts match"
            message="Try a different role, status or search term."
            action={filtersActive && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table staff-table">
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Guest profile</th>
                  <th>Last sign-in</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((member) => {
                  const id = member._id || member.id;
                  const isSelf = String(id) === String(user?._id || user?.id);
                  const linked = member.guestProfile;
                  const linkedName = linked
                    ? `${linked.firstName || ''} ${linked.lastName || ''}`.trim()
                    : '';
                  return (
                    <tr key={id}>
                      <td>
                        <div className="table-person">
                          <Avatar name={member.name} size="xs" tone={member.role === 'admin' ? 'gold' : 'default'} />
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
                        <Badge tone={ROLE_TONE[member.role] || 'neutral'} dot={false}>
                          {roleLabel(member.role)}
                        </Badge>
                      </td>
                      <td>
                        <span>{member.email}</span>
                        <span className="table-sub">{member.phone || 'No phone'}</span>
                      </td>
                      <td>
                        {linkedName ? (
                          <span>{linkedName}{linked.vip ? ' · VIP' : ''}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{member.lastLogin ? formatDateTime(member.lastLogin) : 'Never'}</td>
                      <td>
                        <Badge tone={member.isActive ? 'sage' : 'neutral'}>{member.isActive ? 'Active' : 'Deactivated'}</Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button size="xs" variant="outline" onClick={() => { setEditing(member); setFormOpen(true); }}>
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            icon={member.isActive ? UserRoundX : UserRoundCheck}
                            onClick={() => setActionTarget(member)}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot deactivate your own account.' : undefined}
                          >
                            {member.isActive ? 'Deactivate' : 'Reactivate'}
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
        guests={guests}
        actor={user}
        onSaved={() => {
          load({ quiet: true });
          if (editing?.role === 'guest') {
            api
              .get('/guests', { params: { limit: 200 } })
              .then(({ data: response }) => setGuests(response.guests || []))
              .catch(() => {});
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(actionTarget)}
        onClose={() => setActionTarget(null)}
        onConfirm={changeActive}
        title={
          actionTarget
            ? `${actionTarget.isActive ? 'Deactivate' : 'Reactivate'} ${actionTarget.name}?`
            : ''
        }
        message={
          actionTarget?.isActive
            ? 'The account will be signed out immediately and will no longer be able to access the property. Historical records are kept.'
            : 'The account will regain access with its existing role and password.'
        }
        confirmLabel={actionTarget?.isActive ? 'Deactivate account' : 'Reactivate account'}
        tone={actionTarget?.isActive ? 'danger' : 'primary'}
        loading={savingAction}
      />
    </div>
  );
};

export default StaffPage;
