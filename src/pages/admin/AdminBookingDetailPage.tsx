import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import Modal from '../../components/organisms/Modal';

function durationHours(start: string, end: string): number {
  const s = start.split(':').map(Number);
  const e = end.split(':').map(Number);
  const mins = (e[0] * 60 + e[1]) - (s[0] * 60 + s[1]);
  return mins / 60;
}

function formatNPR(n: number | undefined): string {
  return (n ?? 0).toLocaleString();
}

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-booking', id],
    queryFn: async () => (await adminAPI.getBooking(id!)).data.booking,
    enabled: !!id,
  });

  const handleAdminCancel = async () => {
    if (!data || !cancelReason.trim()) return;
    try {
      await adminAPI.cancelBooking(data.id, cancelReason);
      setCancelOpen(false);
      setCancelReason('');
      setCancelError('');
      refetch();
    } catch (err: any) {
      setCancelError(err.response?.data?.message || 'Failed to cancel booking.');
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-bold text-card-foreground">Booking not found.</p>
        <Link to="/admin/bookings" className="mt-2 inline-block text-sm font-bold text-primary underline underline-offset-2">Back to bookings</Link>
      </div>
    );
  }

  const b = data;
  const playerName = b.userName || b.customerName;
  const playerPhone = b.userPhone || b.customerPhone;

  return (
          <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-primary">Bookings</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-foreground">
              {b.bookingRef}
              <StatusBadge variant={b.status === 'confirmed' ? 'success' : b.status === 'cancelled' || b.status === 'late_cancelled' ? 'error' : 'info'}>
                {b.status}
              </StatusBadge>
            </h1>
          </div>
          <Link to="/admin/bookings" className="flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-2">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All bookings
          </Link>
        </div>

        {b.status === 'confirmed' && b.paymentStatus !== 'paid' && (
          <div className="rounded-xl border border-highlight/60 bg-highlight/15 p-3 text-sm font-semibold text-highlight-foreground">
            This booking is not marked as paid yet. Confirm payment in the person's app or record it at the counter from the bookings list.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Booking details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Ground</dt>
                <dd className="text-right font-bold text-card-foreground">
                  <span className="block">{b.groundName}</span>
                  {b.groundOwner?.name && (
                    <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                      Owner: {b.groundOwner.name}{b.groundOwner.business ? ` (${b.groundOwner.business})` : ''}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Source</dt>
                <dd className="font-bold text-card-foreground">
                  {b.source === 'walk_in' ? 'Walk-in booking' : 'Online booking'}
                  {b.source === 'walk_in' && b.customerName && ` (${b.customerName})`}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Date</dt>
                <dd className="font-bold text-card-foreground">{b.date}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Time</dt>
                <dd className="font-bold text-card-foreground">
                  {b.startTime?.slice(0, 5)} - {b.endTime?.slice(0, 5)} ({durationHours(b.startTime, b.endTime)} hrs)
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Players</dt>
                <dd className="font-bold text-card-foreground">{b.numberOfPlayers ?? 1}</dd>
              </div>
              {b.specialRequests && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Special requests</dt>
                  <dd className="text-right font-semibold text-card-foreground">{b.specialRequests}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Placed at</dt>
                <dd className="font-bold text-card-foreground">{new Date(b.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Player</h2>
            {playerName ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Name</dt>
                  <dd className="font-bold text-card-foreground">{playerName}</dd>
                </div>
                {b.userEmail && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Email</dt>
                    <dd className="min-w-0 truncate font-semibold text-card-foreground">{b.userEmail}</dd>
                  </div>
                )}
                {playerPhone && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Phone</dt>
                    <dd className="font-semibold text-card-foreground">
                      <a href={`tel:${playerPhone}`} className="flex items-center justify-end gap-1.5 text-primary underline underline-offset-2">
                        <Phone className="h-3.5 w-3.5" aria-hidden /> {playerPhone}
                      </a>
                    </dd>
                  </div>
                )}
                {!playerName && b.customerPhone && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Walk-in contact</dt>
                    <dd className="font-semibold text-card-foreground">{b.customerPhone}</dd>
                  </div>
                )}
                {b.groundContact && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Ground contact</dt>
                    <dd className="font-semibold text-card-foreground">
                      <a href={`tel:${b.groundContact}`} className="flex items-center justify-end gap-1.5 text-primary underline underline-offset-2">
                        <Phone className="h-3.5 w-3.5" aria-hidden /> {b.groundContact}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Phone className="h-4 w-4" aria-hidden /> No account on file{b.customerName ? ` (${b.customerName})` : ''}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Ground owner</h2>
            {b.groundOwner?.name ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Name</dt>
                  <dd className="font-bold text-card-foreground">{b.groundOwner.name}</dd>
                </div>
                {b.groundOwner.business && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Business</dt>
                    <dd className="text-right font-semibold text-card-foreground">{b.groundOwner.business}</dd>
                  </div>
                )}
                {b.groundOwner.phone && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Phone</dt>
                    <dd className="font-semibold text-card-foreground">
                      <a href={`tel:${b.groundOwner.phone}`} className="flex items-center justify-end gap-1.5 text-primary underline underline-offset-2">
                        <Phone className="h-3.5 w-3.5" aria-hidden /> {b.groundOwner.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {b.groundOwner.email && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Email</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-card-foreground">{b.groundOwner.email}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">No owner on file for this ground.</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Payment</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Booking value</dt>
                <dd className="font-extrabold text-primary">Rs {b.totalPrice.toLocaleString()}</dd>
              </div>
              {(b.depositAmount ?? 0) > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Online deposit</dt>
                  <dd className="font-bold text-card-foreground">Rs {formatNPR(b.depositAmount)}</dd>
                </div>
              )}
              {b.depositPaid && b.status === 'confirmed' && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Balance due</dt>
                  <dd className="font-bold text-card-foreground">Rs {formatNPR(Math.max(0, b.totalPrice - (b.depositAmount ?? 0)))}</dd>
                </div>
              )}
              {b.depositRefunded && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Deposit refund</dt>
                  <dd className="font-bold text-card-foreground">Rs {formatNPR(b.depositAmount)} (recorded)</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Payment method</dt>
                <dd className="font-bold text-card-foreground">
                  {b.paymentMethod === 'counter' ? 'Pay at counter' : b.paymentMethod === 'gpay' ? 'GPay' : b.paymentMethod || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Payment status</dt>
                <dd>
                  <StatusBadge variant={b.paymentStatus === 'paid' ? 'success' : 'warning'}>
                    {b.paymentStatus === 'paid' ? 'Paid' : b.paymentStatus === 'unpaid' ? 'Unpaid' : b.paymentStatus || '—'}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Status &amp; cancellation</h2>
            {b.batchGroupId && (
              <p className="mb-3 text-sm font-semibold text-muted-foreground">
                Part of a multi-slot booking (batch {b.batchGroupId}).
              </p>
            )}
            {b.status === 'cancelled' || b.status === 'late_cancelled' ? (
              <div className="space-y-3 text-sm">
                {b.cancelledAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Cancelled at</dt>
                    <dd className="font-bold text-card-foreground">{new Date(b.cancelledAt).toLocaleString()}</dd>
                  </div>
                )}
                {b.isLateCancellation && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Late cancellation fee</dt>
                    <dd className="font-bold text-card-foreground">Rs {(b.lateCancellationFee ?? 0).toLocaleString()}</dd>
                  </div>
                )}
                {b.cancellationReason && (
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Cancellation reason</p>
                    <p className="mt-1 font-semibold text-card-foreground">{b.cancellationReason}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">
                  Booking is {b.status}. You can cancel it with a note that is saved and shown to the player.
                </p>
                <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>Cancel Booking</Button>
              </div>
            )}
          </Card>
        </div>

        <Modal open={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReason(''); setCancelError(''); }} title="Cancel Booking (Admin Override)">
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl bg-muted p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booking ref</span>
                <span className="font-mono text-sm font-bold text-card-foreground">{b.bookingRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Player</span>
                <span className="font-bold text-card-foreground">{playerName || 'Guest'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date/Time</span>
                <span className="font-bold text-card-foreground">{b.date} {b.startTime?.slice(0, 5)}-{b.endTime?.slice(0, 5)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="cancel-reason-detail" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Reason for cancellation (required)</label>
              <select
                id="cancel-reason-detail"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a reason...</option>
                <option value="Suspected fake booking">Suspected fake booking</option>
                <option value="Abuse of system">Abuse of system</option>
                <option value="Maintenance required">Maintenance required</option>
                <option value="Double booking conflict">Double booking conflict</option>
                <option value="Other">Other</option>
              </select>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Additional details (optional)..."
                rows={2}
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="rounded-xl border border-highlight/60 bg-highlight/15 p-3 text-sm font-semibold text-highlight-foreground">
              This reason is saved on the booking and shown to the player. There is no separate email or SMS notification.
            </div>

            {cancelError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{cancelError}</div>
            )}

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => { setCancelOpen(false); setCancelReason(''); setCancelError(''); }}>Keep Booking</Button>
              <Button variant="destructive" className="flex-1" onClick={handleAdminCancel} disabled={!cancelReason.trim()}>Cancel Booking</Button>
            </div>
          </div>
        </Modal>
      </div>
  );
}