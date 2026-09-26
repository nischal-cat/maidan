import { Link } from 'react-router-dom';
import { Banknote, MapPin } from 'lucide-react';
import type { Booking } from '../../types';
import { Card } from '../ui/card';
import { StatusBadge } from '../ui/status-badge';
import { Button } from '../ui/button';
import { bookingStatusVariant, paymentStatusVariant } from '../../constants/status';
import { useBookingPayment } from '../../hooks/useBookingPayment';
import BookingCountdown from '../booking/BookingCountdown';
import AddToCalendarButton from '../booking/AddToCalendarButton';
import { formatFullDate, formatMonthDay, formatNPR, formatTimeRange } from '../../lib/dates';

interface BookingCardProps {
  booking: Booking;
  onCancel?: (id: string) => void;
  showActions?: boolean;
}

export default function BookingCard({ booking, onCancel, showActions = true }: BookingCardProps) {
  const { payNow, paying } = useBookingPayment();

  const isPending = booking.status === 'pending';
  const isUnpaid = booking.paymentStatus === 'unpaid' || booking.paymentStatus === 'pending';
  const needsApproval = isPending && !!booking.requiresApproval;
  const isFinished = booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'late_cancelled';
  const hasLocation = !!(booking.groundAddress || booking.groundCity);

  return (
    <Card className={isPending ? 'border-primary/40' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {/* Whole header links through; the action buttons below stop propagation
              by living outside this anchor. */}
          <h3 className="font-extrabold text-card-foreground">
            <Link
              to={`/bookings/${booking.id}`}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:text-primary hover:underline"
            >
              {booking.groundName}
            </Link>
          </h3>
          <p className="text-sm font-semibold text-muted-foreground">
            <span className="sm:hidden">{formatMonthDay(booking.date)}</span>
            <span className="hidden sm:inline">{formatFullDate(booking.date)}</span>
            <span className="mx-1.5" aria-hidden>
              &middot;
            </span>
            {formatTimeRange(booking.startTime, booking.endTime)}
          </p>
          {hasLocation && (
            <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {booking.groundAddress || booking.groundCity}
                {booking.groundAddress && booking.groundCity ? `, ${booking.groundCity}` : ''}
              </span>
            </p>
          )}
          {booking.bookingRef && (
            <p className="font-mono text-xs text-muted-foreground">{booking.bookingRef}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge variant={needsApproval ? 'warning' : bookingStatusVariant[booking.status] || 'default'}>
            {needsApproval
              ? 'Pending approval'
              : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </StatusBadge>
          {booking.batchGroupId && booking.paymentStatus === 'paid' && (
            <StatusBadge variant="success">Paid online (multi-slot)</StatusBadge>
          )}
          {!booking.batchGroupId && booking.depositPaid && booking.status === 'confirmed' && (
            <StatusBadge variant="warning">Deposit paid &middot; Balance at venue</StatusBadge>
          )}
          {booking.paymentStatus && booking.paymentStatus !== 'unpaid' && !booking.batchGroupId && !booking.depositPaid && (
            <StatusBadge variant={paymentStatusVariant[booking.paymentStatus] || 'default'}>
              {booking.paymentStatus === 'paid' ? 'Paid' :
               booking.paymentStatus === 'pending' ? 'Payment Pending' :
               booking.paymentStatus === 'refunded' ? 'Refunded' :
               booking.paymentStatus === 'partial_refund' ? 'Partial Refund' :
               booking.paymentStatus}
            </StatusBadge>
          )}
          {booking.paymentMethod === 'counter' && booking.status === 'confirmed' && (
            <StatusBadge variant="warning">Pay at counter</StatusBadge>
          )}
        </div>
      </div>

      <BookingCountdown
        date={booking.date}
        startTime={booking.startTime}
        endTime={booking.endTime}
        hideWhenEnded={isFinished}
        className="mt-3"
      />

      {!booking.batchGroupId && booking.depositPaid && booking.status === 'confirmed' && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <p className="font-bold text-primary">Deposit paid online</p>
            <p className="font-extrabold text-primary">{formatNPR(booking.depositAmount ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-muted p-2.5">
            <p className="font-bold text-muted-foreground">Balance at venue</p>
            <p className="font-extrabold text-card-foreground">
              {formatNPR(booking.balanceAmount ?? Math.max(0, booking.totalPrice - (booking.depositAmount ?? 0)))}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold text-primary">{formatNPR(booking.totalPrice)}</span>
          {booking.groundContact && (
            <a
              href={`tel:${booking.groundContact}`}
              className="rounded text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Call ground
            </a>
          )}
        </div>
        {showActions && (
          <div className="flex flex-wrap items-center gap-2">
            {!isFinished && <AddToCalendarButton booking={booking} />}
            {isPending && isUnpaid && !needsApproval && (
              <Button variant="primary" size="sm" onClick={() => payNow(booking.id)} loading={paying}>
                <Banknote className="h-4 w-4" aria-hidden />
                {paying ? 'Paying…' : 'Pay Now'}
              </Button>
            )}
            {(booking.status === 'confirmed' || isPending) && !needsApproval && onCancel && (
              <Button variant="destructive" size="sm" onClick={() => onCancel(booking.id)}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {needsApproval && booking.paymentDeadline ? (
        <p className="mt-3 rounded-xl bg-highlight/20 p-3 text-xs font-semibold text-highlight-foreground">
          Waiting for the owner to confirm your pay-at-counter request. This reservation expires at{' '}
          {new Date(booking.paymentDeadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} if not approved.
        </p>
      ) : isPending && booking.paymentDeadline ? (
        <p className="mt-3 rounded-xl bg-highlight/20 p-3 text-xs font-semibold text-highlight-foreground">
          Complete payment by {new Date(booking.paymentDeadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
          or the slot will be released.
        </p>
      ) : null}
    </Card>
  );
}
