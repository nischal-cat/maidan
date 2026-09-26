import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../services/api';
import { PERMISSION_LABELS } from '../../constants';
import { Card } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { PasswordField } from '../../components/ui/password-field';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import Modal from '../../components/organisms/Modal';

interface StaffRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  createdAt: string;
}

const ALL_PERMS = ['grounds', 'slots', 'bookings', 'reports', 'sellers', 'users'];

export default function AdminStaffPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StaffRecord | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const res = await adminAPI.listStaff();
      return res.data;
    },
  });

  const staff = (data?.staff || []) as StaffRecord[];

  const clearErrors = () => setCreateError(null);

  const togglePerm = async (member: StaffRecord, perm: string) => {
    setBusyId(member.id);
    clearErrors();
    try {
      const next = member.permissions.includes(perm)
        ? member.permissions.filter((p) => p !== perm)
        : [...member.permissions, perm];
      await adminAPI.updateStaff(member.id, { permissions: next });
      refetch();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to update permissions.');
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) return;
    setResetLoading(true);
    clearErrors();
    try {
      await adminAPI.updateStaff(resetTarget.id, { password: newPassword });
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const removeStaff = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    clearErrors();
    try {
      await adminAPI.deleteStaff(removeTarget.id);
      setRemoveTarget(null);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to remove sub-admin.');
    } finally {
      setRemoveLoading(false);
    }
  };

  const createStaff = async () => {
    setCreateError(null);
    setCreateLoading(true);
    try {
      await adminAPI.createStaff({ ...createForm, permissions: createPerms });
      setShowCreate(false);
      setCreateForm({ name: '', email: '', phone: '', password: '' });
      setCreatePerms([]);
      refetch();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create sub-admin.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">People</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Staff &amp; access</h1>
          <p className="mt-1 text-muted-foreground">
            Create sub-admin accounts and control which sections each member can access.
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); clearErrors(); }}>
          {showCreate ? 'Cancel' : 'Add Sub-admin'}
        </Button>
      </div>

      {createError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{createError}</div>
      )}

      {showCreate && (
        <Card>
          <h2 className="mb-4 text-lg font-extrabold text-card-foreground">New sub-admin account</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Ramesh Gurung" />
            <TextField label="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="staff@maidan.com.np" />
            <TextField label="Phone (optional)" type="tel" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="98XXXXXXXX" />
            <PasswordField label="Temporary password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Min 6 characters" />
          </div>
          <div className="mt-4">
            <div className="mb-2 text-[10px] font-extrabold uppercase text-muted-foreground">Permissions</div>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMS.map((perm) => {
                const active = createPerms.includes(perm);
                return (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => setCreatePerms(active ? createPerms.filter((p) => p !== perm) : [...createPerms, perm])}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    {PERMISSION_LABELS[perm]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Leave empty to create an account with no access. Staff can only interact with sections they are granted.
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); clearErrors(); }}>Cancel</Button>
            <Button size="sm" loading={createLoading} onClick={createStaff}>Create sub-admin</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="border-b border-border px-4 py-4">
          <h2 className="text-lg font-extrabold text-card-foreground">Sub-admin accounts ({staff.length})</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : staff.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No sub-admin accounts yet. Create one to delegate access.</div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {staff.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="font-bold text-card-foreground">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  <div className="text-xs text-muted-foreground">Joined {new Date(m.createdAt).toLocaleDateString()}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ALL_PERMS.map((perm) => {
                      const active = m.permissions.includes(perm);
                      return (
                        <button
                          key={perm}
                          onClick={() => togglePerm(m, perm)}
                          disabled={busyId === m.id}
                          title={`${active ? 'Revoke' : 'Grant'} ${PERMISSION_LABELS[perm]}`}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                        >
                          {PERMISSION_LABELS[perm]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setResetTarget(m)} disabled={busyId === m.id}>Reset password</Button>
                    <Button variant="destructive" size="sm" onClick={() => setRemoveTarget(m)} disabled={busyId === m.id}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Permissions</th>
                  <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-card-foreground">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                      <div className="text-xs text-muted-foreground">Joined {new Date(m.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_PERMS.map((perm) => {
                          const active = m.permissions.includes(perm);
                          return (
                            <button
                              key={perm}
                              onClick={() => togglePerm(m, perm)}
                              disabled={busyId === m.id}
                              title={`${active ? 'Revoke' : 'Grant'} ${PERMISSION_LABELS[perm]}`}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                            >
                              {PERMISSION_LABELS[perm]}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setResetTarget(m)} disabled={busyId === m.id}>Reset password</Button>
                        <Button variant="destructive" size="sm" onClick={() => setRemoveTarget(m)} disabled={busyId === m.id}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <Modal
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setNewPassword(''); }}
        title="Reset password"
      >
        {resetTarget && (
          <div className="space-y-4">
            <p className="text-sm font-medium leading-relaxed text-muted-foreground">
              Set a new password for <span className="font-bold text-foreground">{resetTarget.email}</span>. The member will need to use this password on their next sign-in.
            </p>
            <PasswordField label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" autoFocus />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:flex-1" onClick={() => { setResetTarget(null); setNewPassword(''); }} disabled={resetLoading}>Cancel</Button>
              <Button className="sm:flex-1" loading={resetLoading} onClick={resetPassword} disabled={newPassword.length < 6}>Save new password</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove sub-admin"
        description={removeTarget ? `Remove ${removeTarget.email}? This cannot be undone.` : undefined}
        confirmLabel="Remove account"
        variant="destructive"
        loading={removeLoading}
        onConfirm={removeStaff}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}