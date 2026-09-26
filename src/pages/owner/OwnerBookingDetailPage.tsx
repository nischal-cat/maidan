import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CheckCircle2, Phone, RotateCcw, XCircle } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useOwnerBookingActions } from '../../hooks/useOwnerBookings';
import { usePageTitle } from '../../hooks/usePageTitle';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { ErrorState } from '../../components/owner/OwnerEmptyState';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { bookingStatusVariant } from '../../components/owner/OwnerBookingCard';
import {
  formatNPR,
  formatFullDate,
  formatTimeRange,
  recordedPaidAmount,
  outstandingAtVenue,
  formatTime12,
} from '../../lib/dates';
import type { Booking } from '../../types';

export default function OwnerBookingDetailPage() {
  usePageTitle('Booking · Owner · Maidan');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const actions = useOwnerBookingActions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-booking', id],
    queryFn: async () => {
      const res = await adminAPI.getBooking(id!);
      return res.data.booking;
    },
    enabled: !!id,
  });

  if (isLoading || !data)
    return (
      <div className="space-y-4">
        <OwnerSkeleton variant="detail" />
      </div>
    );
  if (isError) return <ErrorState onRetry={refetch} message="Could not load this booking." />;

  const b: Booking = data;
  const paid = recordedPaidAmount(b);
  const due = outstandingAtVenue(b);
  const canCollect = b.status === 'confirmed' && due > 0 && b.paymentStatus !== 'paid';
  const isApproval = b.requiresApproval && b.status === 'pending';
  const canCancel = (b.status === 'confirmed' || b.status === 'pending') && !b.isLateCancellation && !isApproval;
  const canRefund = !!b.depositPaid && !b.depositRefunded && b.status !== 'cancelled' && b.status !== 'late_cancelled';
  const customer = b.customerName ?? b.userName ?? 'Guest';
  const customerPhone = b.customerPhone ?? b.userPhone ?? b.groundContact;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate('/owner/bookings')}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> My bookings
      </button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{b.bookingRef ?? b.id.slice(0, 8)}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{b.groundName}</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {formatFullDate(b.date)} · {formatTimeRange(b.startTime, b.endTime)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={isApproval ? 'warning' : bookingStatusVariant(b.status)}>
            {isApproval ? 'Pending approval' : b.status}
          </StatusBadge>
          <StatusBadge variant={b.paymentStatus === 'paid' ? 'success' : b.paymentStatus === 'refunded' ? 'default' : 'warning'}>
            {b.paymentStatus ?? 'unpaid'}
          </StatusBadge>
        </div>
      </header>

      <section aria-label="Payment summary">
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Booking value</span>
            <span className="text-xl font-extrabold text-foreground">{formatNPR(b.totalPrice)}</span>
            <span className="text-xs font-semibold text-muted-foreground">
              {b.numberOfPlayers ?? 1} player{(b.numberOfPlayers ?? 1) > 1 ? 's' : ''}
              {b.source === 'walk_in' ? ' · walk-in' : ' · online'}
            </span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Amount paid</span>
            <span className="text-xl font-extrabold text-foreground">{formatNPR(paid)}</span>
            <span className="text-xs font-semibold text-muted-foreground">
              {b.paymentMethod ? `via ${b.paymentMethod}` : 'no payment recorded'}
            </span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Balance due at venue</span>
            <span className="text-xl font-extrabold text-highlight-foreground">{formatNPR(due)}</span>
            <span className="text-xs font-semibold text-muted-foreground">Collect this from the customer</span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Payment method</span>
            <span className="text-xl font-extrabold capitalize text-foreground">{b.paymentMethod ?? 'Not set'}</span>
            <span className="text-xs font-semibold text-muted-foreground">
              {b.batchGroupId ? 'Batch deposit' : b.source === 'walk_in' ? 'Recorded at counter' : 'Per-booking deposit'}
            </span>
          </Card>
        </div>
        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-muted-foreground">
          Online deposits are marked paid automatically by the payment gateway. Payments received at the venue are
          recorded by you; Maidan keeps the deposit for gateway orders until the booking is completed.
        </p>
      </section>

      {b.specialRequests && (
        <Card className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Special requests</span>
          <p className="text-sm font-semibold text-card-foreground">{b.specialRequests}</p>
        </Card>
      )}

      <section aria-label="Customer">
        <Card className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <span className="text-lg font-extrabold">{(customer[0] ?? '?').toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-card-foreground">{customer}</p>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden /> {customerPhone}
              </a>
            )}
          </div>
        </Card>
      </section>

      {isApproval && (
        <section aria-label="Approval actions" className="flex flex-col gap-3 border-t border-border pt-4">
          <h2 className="text-base font-extrabold text-foreground">Pay-at-counter request</h2>
          <p className="text-sm font-semibold leading-relaxed text-muted-foreground">
            This customer wants to pay at the counter. Approving holds the reserved slot and confirms their booking;
            rejecting releases the slot and notifies them in-app.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={actions.approveBooking.isPending} onClick={() => actions.approveBooking.mutate(b)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve &amp; confirm
            </Button>
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" aria-hidden /> Reject request
            </Button>
          </div>
        </section>
      )}

      {(canCancel || canRefund) && (
        <section aria-label="Booking actions" className="flex flex-col gap-3 border-t border-border pt-4">
          <h2 className="text-base font-extrabold text-foreground">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {canCollect && (
              <Button variant="primary" loading={actions.markPaid.isPending} onClick={() => actions.markPaid.mutate(b)}>
                <Banknote className="h-4 w-4" aria-hidden /> Mark paid · {formatNPR(due)} at counter
              </Button>
            )}
            {canRefund && (
              <Button variant="secondary" onClick={() => setRefundOpen(true)}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Record deposit refund
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" aria-hidden /> Cancel booking
              </Button>
            )}
          </div>
        </section>
      )}

      {b.isLateCancellation && b.lateCancellationFee != null && b.lateCancellationFee > 0 && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">
          Cancelled late — the {formatNPR(b.lateCancellationFee)} fee is retained by Maidan.
        </p>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={isApproval ? 'Reject this request?' : 'Cancel booking?'}
        description={
          isApproval
            ? 'The reserved slot becomes available again and the player is notified in-app that their pay-at-counter request was rejected.'
            : 'The booked slot becomes available again. Free cancellations are allowed up to 24 hours before start time; after that a 40% fee applies to online bookings.'
        }
        confirmLabel={isApproval ? 'Reject booking' : 'Cancel booking'}
        variant="destructive"
        loading={actions.cancelBooking.isPending}
        onConfirm={() => actions.cancelBooking.mutate({ id: b.id, reason })}
        onCancel={() => setCancelOpen(false)}
      >
        <div className="flex flex-col gap-2">
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isApproval ? "Reject reason shown to the player" : "e.g. customer didn't show"}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={refundOpen}
        title="Record deposit refund"
        description={`Rs ${(b.depositAmount ?? 0).toLocaleString('en-IN')} was paid as an online deposit. Refunds are processed outside Maidan (eSewa / Khalti / bank transfer); recording it here just updates your records.`}
        confirmLabel="I refunded externally"
        variant="primary"
        loading={actions.refund.isPending}
        onConfirm={() => actions.refund.mutate(b)}
        onCancel={() => setRefundOpen(false)}
      />

      <p className="text-center text-[10px] font-semibold text-muted-foreground">
        Created {formatTime12(b.createdAt ? b.createdAt.slice(11, 16) : '')} {b.createdAt?.slice(0, 10)}
      </p>
    </div>
  );
}