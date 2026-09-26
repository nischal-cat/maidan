import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  MapPin,
  Phone,
  Users,
  XCircle,
} from 'lucide-react';
import { bookingsAPI } from '../services/api';
import { USER_SIDEBAR_LINKS } from '../constants';
import { useBookingPayment } from '../hooks/useBookingPayment';
import { usePageTitle } from '../hooks/usePageTitle';
import DashboardLayout from '../components/templates/DashboardLayout';
import { Card } from '../components/ui/card';
import { StatusBadge } from '../components/ui/status-badge';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import BookingMap from '../components/booking/BookingMap';
import BookingCountdown from '../components/booking/BookingCountdown';
import AddToCalendarButton from '../components/booking/AddToCalendarButton';
import CancelBookingDialog from '../components/booking/CancelBookingDialog';
import {
  durationHours,
  formatFullDate,
  formatNPR,
  formatTimeRange,
  outstandingAtVenue,
  paymentStatusLabel,
  recordedPaidAmount,
} from '../lib/dates';
import { bookingStatusVariant, paymentStatusVariant } from '../constants/status';
import type { Booking } from '../types';

const GATEWAY_LABEL: Record<string, string> = {
  esewa: 'eSewa',
  khalti: 'Khalti',
  cash: 'Cash at venue',
  counter: 'Paid at counter',
  online: 'Online',
};

export default function PlayerBookingDetailPage() {
  usePageTitle('Booking · Maidan');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { payNow, paying } = useBookingPayment();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-booking', id],
    queryFn: async () => (await bookingsAPI.getById(id!)).data,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <DashboardLayout sidebarLinks={USER_SIDEBAR_LINKS}>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !data) {
    return (
      <DashboardLayout sidebarLinks={USER_SIDEBAR_LINKS}>
        <div className="mx-auto max-w-md space-y-4 py-16 text-center">
          <h1 className="text-xl font-extrabold text-foreground">Booking not found</h1>
          <p className="text-sm text-muted-foreground">
            This booking does not exist, or it belongs to another account.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/bookings')}>
              Back to my bookings
            </Button>
            <Button variant="primary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const b: Booking = data.booking;
  const payments = data.payments ?? [];
  const paid = recordedPaidAmount(b);
  const due = outstandingAtVenue(b);
  const cancelled = b.status === 'cancelled' || b.status === 'late_cancelled';
  const isPending = b.status === 'pending';
  const needsApproval = isPending && !!b.requiresApproval;
  const isUnpaid = b.paymentStatus === 'unpaid' || b.paymentStatus === 'pending';
  const canPay = isPending && isUnpaid && !needsApproval;
  const canCancel = (b.status === 'confirmed' || isPending) && !cancelled;
  const venuePhone = b.groundContact;

  return (
    <DashboardLayout sidebarLinks={USER_SIDEBAR_LINKS}>
      <div className="mx-auto max-w-3xl space-y-5">
        <button
          type="button"
          onClick={() => navigate('/bookings')}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> My bookings
        </button>

        {notice && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm font-semibold text-primary"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              className="font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ---------------------------------------------------------------- */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{b.bookingRef ?? b.id.slice(0, 8)}</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{b.groundName}</h1>
              {(b.groundCity || b.groundSportType) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-semibold capitalize text-muted-foreground">
                  {b.groundCity && <span>{b.groundCity}</span>}
                  {b.groundCity && b.groundSportType && <span aria-hidden>·</span>}
                  {b.groundSportType && <span>{b.groundSportType}</span>}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={needsApproval ? 'warning' : bookingStatusVariant[b.status] || 'default'}>
                {needsApproval ? 'Pending approval' : b.status.replace('_', ' ')}
              </StatusBadge>
              <StatusBadge variant={paymentStatusVariant[b.paymentStatus ?? 'unpaid']}>
                {paymentStatusLabel(b.paymentStatus)}
              </StatusBadge>
            </div>
          </div>

          {!cancelled && (
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
              <BookingCountdown date={b.date} startTime={b.startTime} endTime={b.endTime} />
              <p className="mt-2 text-sm font-bold text-foreground">
                {formatFullDate(b.date)} · {formatTimeRange(b.startTime, b.endTime)}
              </p>
            </div>
          )}

          {needsApproval && b.paymentDeadline && (
            <p className="rounded-xl bg-highlight/20 p-3 text-xs font-semibold text-highlight-foreground">
              Waiting for the ground owner to confirm your pay-at-counter request. This reservation expires at{' '}
              {new Date(b.paymentDeadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} if not approved.
            </p>
          )}
          {isPending && !needsApproval && b.paymentDeadline && (
            <p className="rounded-xl bg-highlight/20 p-3 text-xs font-semibold text-highlight-foreground">
              Complete payment by{' '}
              {new Date(b.paymentDeadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} or the slot will
              be released.
            </p>
          )}
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* When                                                              */}
        {/* ---------------------------------------------------------------- */}
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden /> When
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Date</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-card-foreground">{formatFullDate(b.date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Time</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-card-foreground">
                {formatTimeRange(b.startTime, b.endTime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Duration</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-card-foreground">
                {durationHours(b.startTime, b.endTime)} {durationHours(b.startTime, b.endTime) === 1 ? 'hour' : 'hours'}
              </dd>
            </div>
            {b.operatingStart && b.operatingEnd && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> Venue opening hours
                </dt>
                <dd className="mt-0.5 text-sm font-extrabold text-card-foreground">
                  {formatTimeRange(b.operatingStart, b.operatingEnd)}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Where                                                             */}
        {/* ---------------------------------------------------------------- */}
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden /> Where
          </h2>
          <p className="text-base font-extrabold text-card-foreground">{b.groundName}</p>
          <BookingMap
            latitude={b.groundLatitude}
            longitude={b.groundLongitude}
            address={b.groundAddress}
            city={b.groundCity}
            label={b.groundName}
          />
          {venuePhone && (
            <Button asChild variant="secondary" size="sm" className="mt-2">
              <a href={`tel:${venuePhone}`}>
                <Phone className="h-4 w-4" aria-hidden /> Call the venue ({venuePhone})
              </a>
            </Button>
          )}
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Who + notes                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden /> Who
          </h2>
          <p className="text-sm font-semibold text-card-foreground">
            {(b.numberOfPlayers ?? 1) === 1 ? '1 player' : `${b.numberOfPlayers} players`}
            {b.source === 'walk_in' && ' · booked at the counter'}
          </p>
          {b.specialRequests && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Special requests</p>
              <p className="mt-0.5 text-sm font-semibold text-card-foreground">{b.specialRequests}</p>
            </div>
          )}
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Money                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Payment summary" className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            <CircleDollarSign className="h-4 w-4" aria-hidden /> Payment
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Booking value</span>
              <span className="text-xl font-extrabold text-foreground">{formatNPR(b.totalPrice)}</span>
              <span className="text-xs font-semibold text-muted-foreground">
                {b.batchGroupId ? 'multi-slot booking' : 'single slot'}
              </span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Paid so far</span>
              <span className="text-xl font-extrabold text-foreground">{formatNPR(paid)}</span>
              <span className="text-xs font-semibold text-muted-foreground">
                {b.paymentMethod ? GATEWAY_LABEL[b.paymentMethod] ?? b.paymentMethod : 'no payment recorded'}
              </span>
            </Card>
            {!cancelled && (
              <Card className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Due at venue</span>
                <span
                  className={`text-xl font-extrabold ${due > 0 ? 'text-highlight-foreground' : 'text-primary'}`}
                >
                  {formatNPR(due)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {due > 0 ? 'Pay this when you arrive' : 'Nothing more to pay'}
                </span>
              </Card>
            )}
            <Card className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Status</span>
              <span className="text-xl font-extrabold capitalize text-foreground">
                {paymentStatusLabel(b.paymentStatus)}
              </span>
              <span className="text-xs font-semibold capitalize text-muted-foreground">
                {b.paymentStatus === 'paid' ? 'settled' : b.paymentStatus === 'refunded' ? 'returned to you' : 'in progress'}
              </span>
            </Card>
          </div>

          {b.depositRefunded && (
            <p className="rounded-xl bg-primary/10 p-3 text-xs font-semibold text-primary">
              Your online payment for this booking was refunded.
            </p>
          )}
          {b.isLateCancellation && !!b.lateCancellationFee && (
            <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              Cancelled late — {formatNPR(b.lateCancellationFee)} was retained as the cancellation fee.
            </p>
          )}
          {b.cancellationReason && (
            <p className="rounded-xl bg-muted p-3 text-xs font-semibold text-muted-foreground">
              Reason: {b.cancellationReason}
            </p>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Payment attempts                                                  */}
        {/* ---------------------------------------------------------------- */}
        {payments.length > 0 && (
          <Card className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <Banknote className="h-4 w-4" aria-hidden /> Payment attempts
            </h2>
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-card-foreground">
                      {GATEWAY_LABEL[p.gateway] ?? p.gateway} · {formatNPR(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString([], {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {p.failureReason && (
                      <p className="text-xs font-semibold text-destructive">{p.failureReason}</p>
                    )}
                  </div>
                  <StatusBadge variant={paymentStatusVariant[p.status ?? 'unpaid']}>
                    {p.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Actions                                                           */}
        {/* ---------------------------------------------------------------- */}
        {(canPay || canCancel || (!cancelled && b.status !== 'completed')) && (
          <section aria-label="Booking actions" className="flex flex-wrap gap-2 border-t border-border pt-4">
            {canPay && (
              <Button variant="primary" loading={paying} onClick={() => payNow(b.id)}>
                <Banknote className="h-4 w-4" aria-hidden /> {paying ? 'Redirecting…' : 'Pay deposit now'}
              </Button>
            )}
            {!cancelled && b.status !== 'completed' && (
              <AddToCalendarButton booking={b} variant="outline" />
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" aria-hidden /> Cancel booking
              </Button>
            )}
            {b.status === 'completed' && (
              <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Played and completed
              </p>
            )}
          </section>
        )}

        <p className="text-center text-[11px] font-semibold text-muted-foreground">
          Booked on {new Date(b.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>

        <CancelBookingDialog
          booking={cancelOpen ? b : null}
          onClose={() => setCancelOpen(false)}
          onCancelled={(message) => {
            setNotice(message);
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-booking', id] });
            queryClient.invalidateQueries({ queryKey: ['user-dashboard-stats'] });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
