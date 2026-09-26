import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card } from '../../components/ui/card';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { OwnerEmptyState, ErrorState } from '../../components/owner/OwnerEmptyState';
import { todayKey, addDaysKey } from '../../lib/dates';
import { CHART_PRIMARY, CHART_BORDER, CHART_CARD, CHART_MUTED } from '../../constants/charts';

const RANGES = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom dates' },
] as const;

export default function OwnerReportsPage() {
  usePageTitle('Earnings & Report · Owner · Maidan');
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('7');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const startDate = useMemo(() => {
    if (range === 'custom') return customStart || undefined;
    return addDaysKey(todayKey(), range === '7' ? -6 : -29);
  }, [range, customStart]);

  const endDate = useMemo(() => {
    if (range === 'custom') return customEnd || undefined;
    return todayKey();
  }, [range, customEnd]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-reports', startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await adminAPI.getReports(params);
      return res.data;
    },
  });

  if (isLoading) return <OwnerSkeleton variant="list" />;
  if (isError) return <ErrorState onRetry={refetch} message="Could not load reports." />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Earnings &amp; report</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Booking value of confirmed, completed and late-cancelled bookings — not cash collected.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              range === r.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:opacity-85'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="owner-report-start" className="text-[10px] font-extrabold uppercase text-muted-foreground">Start date</label>
            <input
              id="owner-report-start"
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="owner-report-end" className="text-[10px] font-extrabold uppercase text-muted-foreground">End date</label>
            <input
              id="owner-report-end"
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-center justify-center gap-1 p-8 text-center">
          <span className="text-3xl font-extrabold text-primary">Rs {(data?.totalRevenue ?? 0).toLocaleString('en-IN')}</span>
          <span className="text-sm font-semibold text-muted-foreground">Total booking value</span>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1 p-8 text-center">
          <span className="text-3xl font-extrabold text-foreground">{data?.totalBookings ?? 0}</span>
          <span className="text-sm font-semibold text-muted-foreground">Bookings in period</span>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-extrabold text-card-foreground">Booking value per day</h2>
        {data?.bookingsPerDay && data.bookingsPerDay.length > 0 ? (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.bookingsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_BORDER} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: CHART_MUTED }} stroke={CHART_BORDER} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART_MUTED }} stroke={CHART_BORDER} />
                <Tooltip
                  cursor={{ fill: 'color-mix(in oklab, var(--accent) 60%, transparent)' }}
                  contentStyle={{ background: CHART_CARD, border: `1px solid ${CHART_BORDER}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 12 }}
                />
                <Bar dataKey="count" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <OwnerEmptyState title="No data in this period" description="Bookings within the date range will appear here." />
        )}
      </Card>

      <p className="rounded-xl bg-secondary px-4 py-3 text-xs font-semibold text-secondary-foreground">
        Booking value is the total price of confirmed, completed and late-cancelled bookings. Late-cancelled fees, deposits
        and payments collected at the venue are different figures — this report does not show cash collected or payouts.
      </p>
    </div>
  );
}