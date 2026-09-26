/* eslint-disable react-refresh/only-export-components */
import { CalendarDays, Users } from 'lucide-react';
import { Card } from '../ui/card';
import { StatusBadge } from '../ui/status-badge';
import { cn } from '../../lib/utils';
import { formatNPR, formatTimeRange, formatWeekdayShort, formatMonthDay } from '../../lib/dates';
import type { Booking } from '../../types';

export function bookingStatusVariant(status: Booking['status']): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'completed':
      return 'info';
    case 'pending':
      return 'warning';
    case 'late_cancelled':
      return 'error';
    case 'cancelled':
      return 'default';
  }
}

export function OwnerBookingCard({ booking, onClick }: { booking: Booking; onClick?: () => void }) {
  const name = booking.customerName ?? booking.userName ?? booking.userPhone ?? 'Guest';
  const Root = onClick ? 'button' : 'div';

  return (
    <Card padding={false}>
      <Root
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-4 p-4 text-left',
          onClick && 'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <CalendarDays className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
              {formatWeekdayShort(booking.date)}
            </span>
            <StatusBadge variant={bookingStatusVariant(booking.status)}>
              {booking.requiresApproval && booking.status === 'pending' ? 'Needs approval' : booking.status === 'pending' ? 'Unpaid hold' : booking.status}
            </StatusBadge>
          </div>
          <p className="mt-0.5 truncate text-sm font-extrabold text-card-foreground">{name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
            <span className="truncate">{booking.groundName}</span>
            <span aria-hidden>·</span>
            <span>{formatMonthDay(booking.date)}</span>
            <span aria-hidden>·</span>
            <span>{formatTimeRange(booking.startTime, booking.endTime)}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-extrabold text-card-foreground">{formatNPR(booking.totalPrice)}</span>
          {(booking.numberOfPlayers ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <Users className="h-3 w-3" aria-hidden />
              {booking.numberOfPlayers}
            </span>
          )}
        </div>
      </Root>
    </Card>
  );
}