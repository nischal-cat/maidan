import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Spinner } from '../../components/ui/spinner';
import { roleVariant } from '../../constants/status';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'player' | 'owner' | 'admin' | 'subadmin';
  isPhoneVerified: boolean;
  createdAt: string;
}

type RoleFilter = 'all' | 'player' | 'owner' | 'admin' | 'subadmin';

export default function AdminUsersPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter, search],
    queryFn: async () => {
      const params: NonNullable<Parameters<typeof adminAPI.getAllUsers>[0]> = { limit: 50 };
      if (roleFilter !== 'all') params.role = roleFilter;
      if (search) params.search = search;
      const res = await adminAPI.getAllUsers(params);
      return res.data;
    },
  });

  const users = (data?.users || []) as UserRecord[];
  const playerCount = users.filter((u) => u.role === 'player').length;
  const ownerCount = users.filter((u) => u.role === 'owner').length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase text-primary">People</p>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">Users directory</h1>
        <p className="mt-1 text-muted-foreground">
          View all registered users. Role and permission changes are managed in Staff & access.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(['all', 'player', 'owner', 'admin', 'subadmin'] as RoleFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              aria-current={roleFilter === r ? 'true' : undefined}
              className={`min-h-9 rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${roleFilter === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
          className="min-h-12 max-w-xs flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <Card padding={false}>
          <div className="space-y-3 p-4 md:hidden">
            {users.map((u) => (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-card-foreground">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge variant={roleVariant[u.role]}>{u.role}</StatusBadge>
                    {u.isPhoneVerified ? (
                      <span className="text-xs font-bold text-primary">Verified</span>
                    ) : (
                      <span className="rounded-full bg-highlight/25 px-2 py-1 text-xs font-bold text-highlight-foreground">Pending</span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{u.phone}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Phone</th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Phone Verified</th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3 font-bold text-card-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone}</td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={roleVariant[u.role]}>{u.role}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {u.isPhoneVerified ? (
                        <span className="text-xs font-bold text-primary">Verified</span>
                      ) : (
                        <span className="text-xs font-bold text-highlight-foreground bg-highlight/25 rounded-full px-2 py-1">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">No users match the filters.</div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-primary">{playerCount}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">Players on this page</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-primary">{ownerCount}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">Owners on this page</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-foreground">{data?.total ?? users.length}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">Total users found</div>
          </div>
        </Card>
      </div>
    </div>
  );
}