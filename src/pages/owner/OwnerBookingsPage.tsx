import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import { useOwnerBookings } from '../../hooks/useOwnerBookings';
import { useOwnerGrounds } from '../../hooks/useOwnerGrounds';
import { useOwnerBookingActions } from '../../hooks/useOwnerBookings';
import { usePageTitle } from '../../hooks/usePageTitle';
import { OwnerBookingCard } from '../../components/owner/OwnerBookingCard';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { OwnerEmptyState } from '../../components/owner/OwnerEmptyState';
import { ErrorState } from '../../components/owner/OwnerEmptyState';
import { StatusBadge } from '../../components/ui/status-badge';
import { cn } from '../../lib/utils';
import { formatTimeRange, formatMonthDay, formatWeekdayShort, formatNPR, outstandingAtVenue } from '../../lib/dates';
import type { Booking } from '../../types';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'approval', label: 'Approvals' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

export default function OwnerBookingsPage() {
  usePageTitle('My Bookings · Owner · Maidan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [shownPages, setShownPages] = useState(1);
  const ownerId = user?.role === 'owner' ? user.id : undefined;

  const activeTab = (params.get('status') ?? 'all') as (typeof TABS)[number]['key'];
  const groundFilter = params.get('ground') ?? '';
  const dateFilter = params.get('date') ?? '';
  const filterKey = `${activeTab}|${groundFilter}|${dateFilter}`;

const { data: grounds } = useOwnerGrounds(ownerId);
  const query = useOwnerBookings({
    status: activeTab === 'all' ? undefined : activeTab === 'approval' ? 'pending' : activeTab,
    requiresApproval: activeTab === 'approval' ? true : undefined,
    groundId: groundFilter || undefined,
    date: dateFilter || undefined,
    page: shownPages,
    limit: 30,
  });
  const actions = useOwnerBookingActions();

  const { data: approvalCount } = useQuery({
    queryKey: ['owner-approvals-count'],
    queryFn: async () => {
      const res = await adminAPI.getAllBookings({ status: 'pending', requiresApproval: true, limit: 1 });
      return res.data.total;
    },
    staleTime: 30_000,
  });

  const [seenByFilter, setSeenByFilter] = useState<Record<string, Booking[]>>({});
  useEffect(() => {
    if (!query.data) return;
    setSeenByFilter((prev) => {
      const base = prev[filterKey] ?? [];
      const byId = new Map(base.map((b) => [b.id, b]));
      query.data?.bookings.forEach((b) => byId.set(b.id, b));
      return { ...prev, [filterKey]: Array.from(byId.values()) };
    });
  }, [query.data, filterKey]);

  const displayed = seenByFilter[filterKey] ?? [];
  const total = query.data?.total ?? 0;

  const collectable = (b: Booking) => b.status === 'confirmed' && outstandingAtVenue(b) > 0;

  if (query.isInitialLoading) return <OwnerSkeleton variant="list" />;
  if (query.isError) return <ErrorState onRetry={query.refetch} message="Could not load bookings." />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">My bookings</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{total} booking{total === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/owner/bookings/new')}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden /> New Booking
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              if (t.key === 'all') next.delete('status');
              else next.set('status', t.key);
              setParams(next, { replace: true });
              setShownPages(1);
            }}
            aria-pressed={activeTab === t.key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:opacity-85'
            )}
          >
            {t.label}
            {t.key === 'approval' && (approvalCount ?? 0) > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none',
                  activeTab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/15 text-primary'
                )}
              >
                {approvalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="booking-ground" className="text-[10px] font-extrabold uppercase text-muted-foreground">Ground</label>
          <select
            id="booking-ground"
            value={groundFilter}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('ground', e.target.value);
              else next.delete('ground');
              setParams(next, { replace: true });
              setShownPages(1);
            }}
            className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All grounds</option>
            {grounds?.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="booking-date" className="text-[10px] font-extrabold uppercase text-muted-foreground">Date</label>
          <input
            id="booking-date"
            type="date"
            value={dateFilter}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('date', e.target.value);
              else next.delete('date');
              setParams(next, { replace: true });
              setShownPages(1);
            }}
            className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {displayed.length === 0 ? (
        <OwnerEmptyState
          title="No bookings found"
          description={activeTab === 'all' ? 'When players book your grounds, they will appear here.' : 'No bookings match this filter yet.'}
        />
      ) : (
        <>
          <div className="space-y-2 lg:hidden">
            {displayed.map((b) => (
              <OwnerBookingCard key={b.id} booking={b} onClick={() => navigate(`/owner/bookings/${b.id}`)} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['Ref', 'Customer', 'Ground', 'Date & time', 'Status', 'Payment', 'Amount', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((b) => (
                    <tr key={b.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3 font-bold text-primary">{b.bookingRef ?? b.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-bold text-card-foreground">{b.customerName ?? b.userName ?? 'Guest'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.groundName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatWeekdayShort(b.date)}, {formatMonthDay(b.date)} · {formatTimeRange(b.startTime, b.endTime)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={b.status === 'cancelled' ? 'error' : b.status === 'pending' ? 'warning' : b.status === 'completed' ? 'info' : 'success'}>
                          {b.requiresApproval && b.status === 'pending' ? 'Pending approval' : b.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={b.paymentStatus === 'paid' ? 'success' : b.paymentStatus === 'refunded' || b.paymentStatus === 'partial_refund' ? 'default' : 'warning'}>
                          {b.paymentStatus ?? 'unpaid'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 font-bold text-card-foreground">{formatNPR(b.totalPrice)}</td>
                      <td className="px-4 py-3 text-right">
                        {b.requiresApproval && b.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => actions.approveBooking.mutate(b)}
                              disabled={actions.approveBooking.isPending}
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => actions.cancelBooking.mutate({ id: b.id, reason: 'Rejected by ground owner' })}
                              disabled={actions.cancelBooking.isPending}
                              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Reject
                            </button>
                          </div>
                        ) : collectable(b) ? (
                          <button
                            type="button"
                            onClick={() => actions.markPaid.mutate(b)}
                            disabled={actions.markPaid.isPending}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Record payment collected at the venue"
                          >
                            <Banknote className="h-3.5 w-3.5" aria-hidden /> Collect {formatNPR(outstandingAtVenue(b))}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/owner/bookings/${b.id}`)}
                            className="rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {displayed.length < total && (
            <button
              type="button"
              onClick={() => setShownPages((p) => p + 1)}
              className="mx-auto block rounded-full border border-border px-5 py-2.5 text-sm font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}