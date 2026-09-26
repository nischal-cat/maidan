import { useEffect, useState } from 'react';
import Modal from '../organisms/Modal';
import { Button } from '../ui/button';
import { bookingsAPI } from '../../services/api';
import { DEPOSIT_RATE, FREE_CANCELLATION_HOURS, type Booking } from '../../types';
import { canCancelFreely, getCancellationFee } from '../../utils/cancellation';
import { formatFullDate, formatNPR, formatTimeRange } from '../../lib/dates';

interface CancelBookingDialogProps {
  booking: Booking | null;
  onClose: () => void;
  /** Called with the server's message once the cancellation succeeds. */
  onCancelled?: (message: string) => void;
}

/**
 * Cancellation confirmation with the fee worked out up front.
 *
 * The fee is derived client-side from the same rules the server applies
 * (FREE_CANCELLATION_HOURS, DEPOSIT_RATE) purely so the player sees the number
 * before committing. The server recomputes it and its message wins.
 *
 * Extracted from BookingHistoryPage so the detail page can reuse it.
 */
export default function CancelBookingDialog({ booking, onClose, onCancelled }: CancelBookingDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever a different booking is opened.
  useEffect(() => {
    setError(null);
    setSubmitting(false);
  }, [booking?.id]);

  if (!booking) return null;

  const isFree = canCancelFreely(booking.date, booking.startTime);
  const isBatch = !!booking.batchGroupId;
  const lateFee = getCancellationFee({
    slotDate: booking.date,
    slotTime: booking.startTime,
    totalPrice: booking.totalPrice,
    depositAmount: booking.depositAmount,
    isBatch,
  });

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await bookingsAPI.cancel(booking.id);
      onCancelled?.(res.data.message);
      onClose();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not cancel this booking. Please try again.'
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!booking} onClose={onClose} title="Cancel Booking">
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl bg-muted p-4">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Ground</span>
            <span className="text-right font-bold text-card-foreground">{booking.groundName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Date</span>
            <span className="text-right font-bold text-card-foreground">{formatFullDate(booking.date)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Time</span>
            <span className="text-right font-bold text-card-foreground">
              {formatTimeRange(booking.startTime, booking.endTime)}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-2">
            <span className="text-muted-foreground">Booking value</span>
            <span className="text-right font-bold text-card-foreground">{formatNPR(booking.totalPrice)}</span>
          </div>
        </div>

        {isFree ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">
            This cancellation is free — you are cancelling more than {FREE_CANCELLATION_HOURS} hours in advance.
            {booking.batchGroupId
              ? ` Your online payment of ${formatNPR(booking.totalPrice)} will be refunded by the venue.`
              : booking.depositAmount
                ? ` Your online deposit of ${formatNPR(booking.depositAmount)} will be refunded by the venue.`
                : ''}
          </div>
        ) : (
          <div className="rounded-xl border border-highlight/60 bg-highlight/15 p-3 text-sm font-semibold text-highlight-foreground">
            <span className="font-extrabold">Late cancellation:</span> you are cancelling less than{' '}
            {FREE_CANCELLATION_HOURS} hours before the slot.
            {isBatch ? (
              <>
                {' '}A fee of {formatNPR(lateFee)} ({DEPOSIT_RATE * 100}% of {formatNPR(booking.totalPrice)}) is kept; the
                remaining {formatNPR(Math.max(0, booking.totalPrice - lateFee))} will be refunded by the venue.
              </>
            ) : (
              <> Your online deposit of {formatNPR(lateFee)} ({DEPOSIT_RATE * 100}%) is the fee.</>
            )}
          </div>
        )}

        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={submitting}>
            Keep Booking
          </Button>
          <Button variant="destructive" className="flex-1" onClick={confirm} loading={submitting}>
            {submitting ? 'Cancelling…' : isFree ? 'Cancel Free' : `Cancel (${formatNPR(lateFee)} fee)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
