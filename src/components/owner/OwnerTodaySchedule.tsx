import { ChevronRight } from 'lucide-react';
import { OwnerBookingCard } from './OwnerBookingCard';
import { OwnerEmptyState } from './OwnerEmptyState';
import { formatFullDate, formatTime12 } from '../../lib/dates';
import type { Booking } from '../../types';

const TIME_MARKS = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

export function OwnerTodaySchedule({
  date,
  bookings,
  onNavigateBookings,
  onOpenBooking,
}: {
  date: string;
  bookings: Booking[];
  onNavigateBookings?: () => void;
  onOpenBooking?: (b: Booking) => void;
}) {
  if (bookings.length === 0) {
    return (
      <OwnerEmptyState
        icon={<span className="text-2xl">📋</span>}
        title="No bookings today"
        description="Bookings scheduled for this date will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">
        <ol className="relative ml-3 border-l-2 border-border">
          {TIME_MARKS.map((mark, i) => {
            const near = bookings.filter((b) => b.startTime.slice(0, 2) === mark.slice(0, 2));
            const nextMark = TIME_MARKS[i + 1];
            const between = nextMark
              ? bookings.filter((b) => b.startTime > mark && b.startTime < nextMark)
              : bookings.filter((b) => b.startTime > mark);
            return (
              <li key={mark} className="relative pb-6 pl-6 last:pb-0">
                <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" aria-hidden />
                <time className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  {formatTime12(mark)}
                </time>
                {[...near, ...between].length > 0 && (
                  <div className="mt-2 space-y-2">
                    {[...near, ...between]
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((b) => (
                        <div key={b.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-card-foreground">{b.groundName}</span>
                            <span className="text-xs font-semibold text-muted-foreground">
                              {formatTime12(b.startTime)}–{formatTime12(b.endTime)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {b.customerName ?? b.userName ?? 'Guest'} · {b.numberOfPlayers ?? 1} players
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-2 lg:hidden">
        {bookings.map((b) => (
          <OwnerBookingCard key={b.id} booking={b} onClick={onOpenBooking ? () => onOpenBooking(b) : undefined} />
        ))}
      </div>

      <p className="text-center text-xs font-semibold text-muted-foreground">
        {formatFullDate(date)} · {bookings.length} booking{bookings.length === 1 ? '' : 's'}
      </p>
      {onNavigateBookings && (
        <button
          type="button"
          onClick={onNavigateBookings}
          className="mx-auto flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          See all bookings <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}