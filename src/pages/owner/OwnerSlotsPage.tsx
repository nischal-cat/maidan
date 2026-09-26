import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lock, LockOpen, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOwnerGrounds } from '../../hooks/useOwnerGrounds';
import { useOwnerSlots } from '../../hooks/useOwnerSlots';
import { usePageTitle } from '../../hooks/usePageTitle';
import { OwnerSlotGrid } from '../../components/owner/OwnerSlotGrid';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ErrorState } from '../../components/owner/OwnerEmptyState';
import { formatWeekdayShort, formatMonthDay, todayKey, addDaysKey } from '../../lib/dates';
import type { Slot } from '../../types';

export default function OwnerSlotsPage() {
  usePageTitle('Slots & Pricing · Owner · Maidan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ownerId = user?.role === 'owner' ? user.id : undefined;

  const { data: grounds, isLoading: groundsLoading } = useOwnerGrounds(ownerId);
  const requestedGround = params.get('ground');
  const ground = grounds?.find((g) => g.id === requestedGround) ?? grounds?.[0];
  const groundId = ground?.id ?? '';
  const date = params.get('date') || todayKey();

  const { slots, isLoading, isError, refetch, toggle, closeRemaining, makeAllAvailable, generate } = useOwnerSlots(groundId, date);

  const [confirmAction, setConfirmAction] = useState<'close' | 'open' | null>(null);
  const [daysMenu, setDaysMenu] = useState(false);

  const available = slots.filter((s) => s.status === 'available');
  const closed = slots.filter((s) => s.status === 'maintenance');

  const sessionDates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDaysKey(todayKey(), i - 2)),
    []
  );

  const changeDate = (dateKey: string) => {
    setParams({ ...Object.fromEntries(params), ground: groundId, date: dateKey }, { replace: true });
  };

  if (groundsLoading) return <OwnerSkeleton variant="grid" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Slots & pricing</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">Tap a slot to open or close it for the selected date.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:flex-1">
          <label htmlFor="slot-ground" className="text-[10px] font-extrabold uppercase text-muted-foreground">Ground</label>
          <select
            id="slot-ground"
            value={groundId}
            onChange={(e) => {
              setParams({ ground: e.target.value, date }, { replace: true });
            }}
            className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            {grounds?.length === 0 && <option value="">No grounds yet</option>}
            {grounds?.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => changeDate(addDaysKey(date, -1))}
            aria-label="Previous day"
            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <input
            type="date"
            value={date}
            min={todayKey()}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
            aria-label="Slot date"
            className="min-h-10 w-36 bg-transparent px-2 text-center text-sm font-bold text-card-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => changeDate(addDaysKey(date, 1))}
            aria-label="Next day"
            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sessionDates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => changeDate(d)}
            aria-pressed={date === d}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              date === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:opacity-85'
            }`}
          >
            {d === todayKey() ? 'Today' : `${formatWeekdayShort(d)} ${formatMonthDay(d)}`}
          </button>
        ))}
      </div>

      {!ground && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm font-semibold text-muted-foreground">
          No grounds yet.{' '}
          <button type="button" onClick={() => navigate('/owner/grounds/new')} className="font-bold text-primary hover:underline">
            Add your first ground
          </button>{' '}
          to manage slots.
        </div>
      )}

      {ground && isError && <ErrorState onRetry={refetch} message="Could not load slots." />}

      {ground && isLoading && <OwnerSkeleton variant="grid" />}

      {ground && !isLoading && !isError && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {formatWeekdayShort(date)}, {formatMonthDay(date)} · {available.length} available · {closed.length} closed
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {closed.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('open')}
                  disabled={makeAllAvailable.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LockOpen className="h-3.5 w-3.5" aria-hidden /> Make all available
                </button>
              )}
              {available.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('close')}
                  disabled={closeRemaining.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden /> Close remaining slots
                </button>
              )}
            </div>
          </div>

          <OwnerSlotGrid
            slots={slots}
            onToggle={(slot: Slot) => toggle.mutate(slot)}
            pendingSlotId={toggle.isPending ? toggle.variables?.id ?? null : null}
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setDaysMenu(!daysMenu)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Generate slots…
            </button>
            {daysMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setDaysMenu(false)} aria-hidden />
                <div className="absolute left-0 top-full z-40 mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-card">
                  <p className="px-3 py-1 text-[10px] font-extrabold uppercase text-muted-foreground">Generate for</p>
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        setDaysMenu(false);
                        generate.mutate(days);
                      }}
                      className="flex items-center justify-between gap-6 rounded-xl px-3 py-2 text-sm font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {days} days {days === 7 && <span className="text-xs font-semibold text-muted-foreground">from today</span>}
                    </button>
                  ))}
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold text-muted-foreground">Existing slots are never duplicated.</p>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmAction === 'close' || confirmAction === 'open'}
        title={confirmAction === 'close' ? 'Close remaining slots?' : 'Make all slots available?'}
        description={
          confirmAction === 'close'
            ? `${available.length} open slot${available.length === 1 ? '' : 's'} will be closed for this date. Booked or held slots are not affected.`
            : `${closed.length} closed slot${closed.length === 1 ? '' : 's'} will be reopened and become bookable for this date.`
        }
        confirmLabel={confirmAction === 'close' ? 'Close remaining' : 'Make all available'}
        variant="destructive"
        loading={closeRemaining.isPending || makeAllAvailable.isPending}
        onConfirm={() => {
          if (confirmAction === 'close') closeRemaining.mutate();
          else makeAllAvailable.mutate();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      {!groundsLoading && grounds?.length === 0 && !ground && (
        <button
          type="button"
          onClick={() => navigate('/owner/grounds/new')}
          className="mx-auto block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Add your first ground
        </button>
      )}
    </div>
  );
}