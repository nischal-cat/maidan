import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, Clock, Plus, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useOwnerToday } from '../../hooks/useOwnerToday';
import { todayKey } from '../../lib/dates';
import { OwnerMetricCard } from '../../components/owner/OwnerMetricCard';
import { OwnerTodaySchedule } from '../../components/owner/OwnerTodaySchedule';
import { OwnerBookingCard } from '../../components/owner/OwnerBookingCard';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { OwnerEmptyState } from '../../components/owner/OwnerEmptyState';
import { ErrorState } from '../../components/owner/OwnerEmptyState';
import { formatTime12, formatNPR, formatMonthDay, formatWeekdayShort } from '../../lib/dates';

export default function OwnerDashboardPage() {
  usePageTitle('Dashboard · Owner · Maidan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const date = todayKey();
  const dash = useOwnerToday(date);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (dash.isLoading) {
    return (
      <div className="space-y-6">
        <OwnerSkeleton variant="metrics" />
        <OwnerSkeleton variant="list" />
      </div>
    );
  }

  if (dash.isError) {
    return <ErrorState onRetry={dash.refetchSlots} message="Could not load today's overview." />;
  }

  const next = dash.nextBooking;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
            {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/owner/bookings/new')}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden /> New Booking
        </button>
      </header>

      <section aria-label="Today's summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OwnerMetricCard label="Today's bookings" value={String(dash.todayCount)} hint="Scheduled for today" tone="primary" />
        <OwnerMetricCard
          label="Paid for today's bookings"
          value={formatNPR(dash.paidToday)}
          hint="Deposits & counter payments on record"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
        <OwnerMetricCard
          label="Due at venue (est.)"
          value={formatNPR(dash.dueToday)}
          hint="Remaining balance you may collect"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
        <OwnerMetricCard
          label="Available today / tonight"
          value={`${dash.availableToday} / ${dash.availableTonight}`}
          hint="Open slots you still have"
          icon={<Clock className="h-4 w-4" aria-hidden />}
        />
      </section>

      <p className="text-[11px] font-semibold leading-relaxed text-muted-foreground">
        Amounts shown for today are based on bookings on record. Online deposits are automatically marked paid by the
        payment gateway; balances collected at the venue are marked paid by you.
      </p>

      {next && (
        <section aria-label="Next booking">
          <button
            type="button"
            onClick={() => navigate(`/owner/bookings/${next.id}`)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl bg-surface-strong p-5 text-left text-surface-strong-foreground shadow-card transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Next booking</p>
              <p className="mt-1 text-base font-extrabold">{next.groundName}</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {formatWeekdayShort(next.date)}, {formatMonthDay(next.date)} · {formatTime12(next.startTime)}–
                {formatTime12(next.endTime)} · {next.customerName ?? next.userName ?? 'Guest'}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          </button>
        </section>
      )}

      <section aria-label="Today's schedule">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-foreground">Today's schedule</h2>
        </div>
        <OwnerTodaySchedule
          date={date}
          bookings={dash.schedule}
          onNavigateBookings={() => navigate('/owner/bookings')}
          onOpenBooking={(b) => navigate(`/owner/bookings/${b.id}`)}
        />
      </section>

      <section aria-label="Today's bookings with balance due">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-foreground">Collect at venue</h2>
        </div>
        {dash.unpaidToday.length === 0 ? (
          <OwnerEmptyState
            title="Nothing to collect"
            description="Confirmed bookings with a balance due will show here."
          />
        ) : (
          <div className="space-y-2">
            {dash.unpaidToday.map((b) => (
              <OwnerBookingCard key={b.id} booking={b} onClick={() => navigate(`/owner/bookings/${b.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}