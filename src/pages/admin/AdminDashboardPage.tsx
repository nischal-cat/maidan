import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CalendarPlus, CalendarClock, Plus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/status-badge';
import { Spinner } from '../../components/ui/spinner';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const perms = user?.permissions ?? [];
  const canBookings = isAdmin || perms.includes('bookings');
  const canSellers = isAdmin || perms.includes('sellers');
  const canSlots = isAdmin || perms.includes('slots');
  const canGrounds = isAdmin || perms.includes('grounds');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await adminAPI.getDashboard()).data,
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-recent-bookings'],
    enabled: canBookings,
    queryFn: async () => (await adminAPI.getAllBookings({ limit: 25 })).data,
  });

  const { data: pendingSellers, isLoading: sellersLoading } = useQuery({
    queryKey: ['admin-pending-sellers'],
    enabled: canSellers,
    queryFn: async () => (await adminAPI.getSellers({ status: 'pending', limit: 5 })).data,
  });

  const firstName = user?.name?.split(' ')[0] || '';
  const recent = bookingsData?.bookings ?? [];
  const unpaidSample = recent.filter((b) => b.paymentStatus === 'unpaid').slice(0, 3);
  const hasAttention = (canSellers && (pendingSellers?.total ?? 0) > 0) || (canBookings && unpaidSample.length > 0);

  return (
          <div className="space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Overview</p>
          <h1 className="mt-1 text-2xl font-extrabold text-foreground">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>

        {statsLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-primary">
                  <CalendarPlus className="h-6 w-6 text-primary" aria-hidden />
                  {stats?.totalBookingsToday ?? 0}
                </div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">Bookings today</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-primary">
                  <CalendarClock className="h-6 w-6 text-primary" aria-hidden />
                  {stats?.upcomingBookings ?? 0}
                </div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">Upcoming bookings</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-foreground">Rs {(stats?.revenueToday ?? 0).toLocaleString()}</div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">Booking value today</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-foreground">{stats?.totalGrounds ?? 0}</div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">Active grounds</div>
              </div>
            </Card>
          </div>
        )}

        {(canBookings || canGrounds || canSlots) && (
          <div className="flex flex-wrap gap-3">
            {canBookings && (
              <Button asChild variant="primary" size="sm">
                <Link to="/admin/bookings/new">New Booking</Link>
              </Button>
            )}
            {canGrounds && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/grounds">Manage Grounds</Link>
              </Button>
            )}
            {canSlots && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/slots">Manage Slots</Link>
              </Button>
            )}
          </div>
        )}

        {hasAttention && (
          <section aria-label="Needs attention">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-highlight-foreground" aria-hidden />
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Needs attention</h2>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {canSellers && (pendingSellers?.total ?? 0) > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-highlight/60 bg-highlight/15 p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-highlight-foreground" aria-hidden />
                    <div>
                      <p className="text-sm font-extrabold text-highlight-foreground">
                        {pendingSellers?.total} seller application{pendingSellers?.total === 1 ? '' : 's'} pending review
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Verify the registration document to let them list grounds.
                      </p>
                    </div>
                  </div>
                  <Link to="/admin/sellers" className="shrink-0 text-sm font-bold text-primary underline underline-offset-2">
                    Review
                  </Link>
                </div>
              )}

              {canBookings && unpaidSample.length > 0 && (
                <div className="rounded-xl border border-highlight/60 bg-highlight/15 p-4">
                  <p className="text-sm font-extrabold text-highlight-foreground">Latest unpaid bookings</p>
                  <ul className="mt-2 space-y-2">
                    {unpaidSample.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-bold text-card-foreground">
                          {b.userName || b.customerName || 'Guest'}
                        </span>
                        <span className="truncate text-muted-foreground">{b.groundName}</span>
                        <span className="shrink-0 font-bold text-primary">Rs {b.totalPrice}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                    Sample of the most recent bookings. A full count of unpaid orders is not available.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {canSellers && (pendingSellers?.total ?? 0) > 0 && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-card-foreground">Pending seller applications</h2>
              <Link to="/admin/sellers" className="text-sm font-bold text-primary underline underline-offset-2">View all</Link>
            </div>
            {sellersLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {(pendingSellers?.sellers ?? []).map((s) => (
                    <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-card-foreground">{s.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.businessName}</p>
                        </div>
                        <Link to={`/admin/sellers/${s.id}`} className="shrink-0 text-sm font-bold text-primary underline underline-offset-2">Review</Link>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.phone} &middot; {s.email}</p>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Seller</th>
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Business</th>
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Contact</th>
                      <th className="px-2 py-3 text-right text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingSellers?.sellers ?? []).map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                        <td className="px-2 py-3 font-bold text-card-foreground">{s.name}</td>
                        <td className="px-2 py-3 text-muted-foreground">{s.businessName}</td>
                        <td className="px-2 py-3 text-muted-foreground">
                          <span className="mr-3">{s.phone}</span>
                          <span className="hidden md:inline">{s.email}</span>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Link to={`/admin/sellers/${s.id}`} className="text-sm font-bold text-primary underline underline-offset-2">Review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </Card>
        )}

        {canBookings && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-card-foreground">Recent bookings</h2>
              <Link to="/admin/bookings" className="text-sm font-bold text-primary underline underline-offset-2">View all</Link>
            </div>
            {bookingsLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {recent.slice(0, 8).map((b) => (
                    <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-bold text-card-foreground">{b.userName || b.customerName || 'Guest'}</p>
                        <StatusBadge variant={b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'error' : 'info'}>
                          {b.status}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{b.groundName}</p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{b.date} &middot; {b.startTime?.slice(0, 5)}</span>
                        <span className="font-bold text-primary">Rs {b.totalPrice}</span>
                      </div>
                    </div>
                  ))}
                  {recent.length === 0 && (
                    <div className="py-4 text-center text-muted-foreground">No bookings yet.</div>
                  )}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Player</th>
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Ground</th>
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Time</th>
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Amount</th>
                      <th className="px-2 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 8).map((b) => (
                      <tr key={b.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                        <td className="px-2 py-3 font-bold text-card-foreground">{b.userName || b.customerName || 'Guest'}</td>
                        <td className="px-2 py-3 text-muted-foreground">{b.groundName}</td>
                        <td className="px-2 py-3 text-muted-foreground">{b.date} &middot; {b.startTime?.slice(0, 5)}</td>
                        <td className="px-2 py-3 font-bold text-primary">Rs {b.totalPrice}</td>
                        <td className="px-2 py-3">
                          <StatusBadge variant={b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'error' : 'info'}>
                            {b.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  {recent.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">No bookings yet.</div>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        {!canBookings && !canSellers && (
          <Card>
            <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Plus className="h-4 w-4" aria-hidden />
              Your staff account doesn't grant dashboard permissions yet. Ask an admin to add sellers or bookings access.
            </p>
          </Card>
        )}
      </div>
  );
}