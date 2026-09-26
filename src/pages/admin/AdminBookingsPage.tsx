import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import Modal from '../../components/organisms/Modal';
import { bookingStatusVariant } from '../../constants/status';

type FilterStatus = 'all' | 'confirmed' | 'completed' | 'cancelled';

interface AdminBooking {
  id: string;
  userName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  userPhone?: string | null;
  groundContact?: string | null;
  source?: 'online' | 'walk_in';
  groundName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'late_cancelled';
  paymentStatus?: string;
  paymentMethod?: string;
  bookingRef?: string;
  depositAmount?: number;
  depositPaid?: boolean;
  depositRefunded?: boolean;
  batchGroupId?: string;
  isLateCancellation?: boolean;
}

export default function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<AdminBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [payTarget, setPayTarget] = useState<AdminBooking | null>(null);
  const [payError, setPayError] = useState('');
  const [refundTarget, setRefundTarget] = useState<AdminBooking | null>(null);
  const [refundError, setRefundError] = useState('');
  const perPage = 25;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-bookings', statusFilter, dateFilter, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: String(perPage), page };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      if (search.trim()) params.search = search.trim();
      const res = await adminAPI.getAllBookings(params);
      return res.data;
    },
  });

  const bookings: AdminBooking[] = data?.bookings || [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / perPage));
  const pageRevenue = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const changeFilter = (next: () => void) => {
    setPage(1);
    next();
  };

  const handleAdminCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      await adminAPI.cancelBooking(cancelTarget.id, cancelReason);
      refetch();
      setCancelTarget(null);
      setCancelReason('');
      setCancelError('');
    } catch (err: any) {
      setCancelError(err.response?.data?.message || 'Failed to cancel booking.');
    }
  };

  const handleMarkPaid = async () => {
    if (!payTarget) return;
    try {
      await adminAPI.markPaid(payTarget.id);
      refetch();
      setPayTarget(null);
    } catch (err: any) {
      setPayError(err.response?.data?.message || 'Failed to mark booking as paid.');
    }
  };

  const refundOf = (b: AdminBooking): number =>
    b.batchGroupId
      ? (b.isLateCancellation ? b.totalPrice - Math.round(b.totalPrice * 0.4) : b.totalPrice)
      : (b.depositAmount ?? 0);

  const handleRefund = async () => {
    if (!refundTarget) return;
    try {
      await adminAPI.refundDeposit(refundTarget.id);
      refetch();
      setRefundTarget(null);
    } catch (err: any) {
      setRefundError(err.response?.data?.message || 'Failed to record refund.');
    }
  };

  return (
          <div className="space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Bookings</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">All bookings</h1>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => changeFilter(() => setSearch(e.target.value))}
              placeholder="Search booking no, player or ground..."
              aria-label="Search bookings"
              className="min-h-12 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['all', 'confirmed', 'completed', 'cancelled'] as FilterStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeFilter(() => setStatusFilter(s))}
                  aria-current={statusFilter === s ? 'true' : undefined}
                  className={`min-h-9 rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <input type="date" value={dateFilter} onChange={(e) => changeFilter(() => setDateFilter(e.target.value))} aria-label="Filter by date" className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto" />
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground">Booking value &middot; rows shown on this page</span>
            <span className="text-2xl font-extrabold text-primary">Rs {pageRevenue.toLocaleString()}</span>
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card padding={false}>
            <div className="space-y-3 p-4 md:hidden">
              {bookings.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-mono text-xs font-semibold text-card-foreground">{b.bookingRef}</span>
                      <span className="flex flex-wrap items-center gap-1">
                        {b.source === 'walk_in' && <StatusBadge variant="warning">Walk-in</StatusBadge>}
                        {b.batchGroupId && b.paymentStatus === 'paid' && <StatusBadge variant="success">Paid online (multi)</StatusBadge>}
                        {!b.batchGroupId && b.depositPaid && b.status === 'confirmed' && <StatusBadge variant="warning">Deposit · balance due</StatusBadge>}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge variant={bookingStatusVariant[b.status] || 'default'}>{b.status}</StatusBadge>
                      {b.paymentStatus && (
                        <StatusBadge variant={b.paymentStatus === 'paid' ? 'success' : 'warning'}>
                          {b.paymentStatus === 'paid' ? 'Paid' :
                           b.paymentMethod === 'counter' ? 'Pay at counter' :
                           b.paymentStatus === 'unpaid' ? 'Unpaid' : b.paymentStatus}
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-0.5 text-sm">
                    <p className="truncate font-bold text-card-foreground">{b.userName || b.customerName || 'Guest'}</p>
                    <p className="truncate text-muted-foreground">{b.groundName}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {b.date} &middot; {b.startTime?.slice(0, 5)}-{b.endTime?.slice(0, 5)}
                      {!b.userName && b.customerPhone ? ` · ${b.customerPhone}` : ''}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-lg font-extrabold text-primary">Rs {b.totalPrice}</span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/admin/bookings/${b.id}`}>View</Link>
                      </Button>
                      {b.status === 'confirmed' && b.paymentStatus !== 'paid' && (
                        <Button variant="secondary" size="sm" onClick={() => { setPayError(''); setPayTarget(b); }}>
                          Mark Paid
                        </Button>
                      )}
                      {(b.batchGroupId || (b.depositAmount ?? 0) > 0) && b.status === 'cancelled' && !b.depositRefunded && (
                        <Button variant="secondary" size="sm" onClick={() => { setRefundError(''); setRefundTarget(b); }}>
                          Record Refund
                        </Button>
                      )}
                      {b.status === 'confirmed' && (
                        <Button variant="destructive" size="sm" onClick={() => { setCancelError(''); setCancelTarget(b); }}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Ref</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Player</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Ground</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Time</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-card-foreground">{b.bookingRef}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-card-foreground">{b.userName || b.customerName || 'Guest'}</span>
                          {b.source === 'walk_in' && (
                            <StatusBadge variant="warning">Walk-in</StatusBadge>
                          )}
                        </div>
                        {!b.userName && b.customerPhone && (
                          <div className="text-xs text-muted-foreground">{b.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.groundName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.startTime?.slice(0, 5)}-{b.endTime?.slice(0, 5)}</td>
                      <td className="px-4 py-3 font-bold text-primary">Rs {b.totalPrice}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge variant={bookingStatusVariant[b.status] || 'default'}>{b.status}</StatusBadge>
                          {b.batchGroupId && b.paymentStatus === 'paid' && (
                            <StatusBadge variant="success">Paid online (multi)</StatusBadge>
                          )}
                          {!b.batchGroupId && b.depositPaid && b.status === 'confirmed' && (
                            <StatusBadge variant="warning">Deposit · balance due</StatusBadge>
                          )}
                          {b.paymentStatus && (
                            <StatusBadge variant={b.paymentStatus === 'paid' ? 'success' : 'warning'}>
                              {b.paymentStatus === 'paid' ? 'Paid' :
                               b.paymentMethod === 'counter' ? 'Pay at counter' :
                               b.paymentStatus === 'unpaid' ? 'Unpaid' : b.paymentStatus}
                            </StatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/admin/bookings/${b.id}`}>View</Link>
                          </Button>
                          {b.userPhone && (
                            <a href={`tel:${b.userPhone}`} className="text-xs font-bold text-primary hover:underline">Call player</a>
                          )}
                          {b.groundContact && (
                            <a href={`tel:${b.groundContact}`} className="text-xs font-bold text-primary hover:underline">Call ground</a>
                          )}
                          {b.status === 'confirmed' && b.paymentStatus !== 'paid' && (
                            <Button variant="secondary" size="sm" onClick={() => { setPayError(''); setPayTarget(b); }}>
                              Mark Paid
                            </Button>
                          )}
                          {(b.batchGroupId || (b.depositAmount ?? 0) > 0) && b.status === 'cancelled' && !b.depositRefunded && (
                            <Button variant="secondary" size="sm" onClick={() => { setRefundError(''); setRefundTarget(b); }}>
                              Record Refund
                            </Button>
                          )}
                          {b.status === 'confirmed' && (
                            <Button variant="destructive" size="sm" onClick={() => { setCancelError(''); setCancelTarget(b); }}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bookings.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">No bookings match the filters.</div>
            )}
            {(data?.total ?? 0) > perPage && (
              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <span className="text-sm font-semibold text-muted-foreground">
                  Page {page} of {totalPages} &middot; {data?.total ?? 0} bookings
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <Modal
          open={!!cancelTarget}
          onClose={() => { setCancelTarget(null); setCancelReason(''); setCancelError(''); }}
          title="Cancel Booking (Admin Override)"
        >
          {cancelTarget && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl bg-muted p-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ref</span>
                  <span className="font-mono text-sm font-bold text-card-foreground">{cancelTarget.bookingRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player</span>
                  <span className="font-bold text-card-foreground">{cancelTarget.userName || cancelTarget.customerName || 'Guest'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ground</span>
                  <span className="font-bold text-card-foreground">{cancelTarget.groundName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date/Time</span>
                  <span className="font-bold text-card-foreground">{cancelTarget.date} {cancelTarget.startTime?.slice(0, 5)}-{cancelTarget.endTime?.slice(0, 5)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="cancel-reason" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Reason for cancellation (required)</label>
                <select
                  id="cancel-reason"
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
                <Button variant="ghost" className="flex-1" onClick={() => { setCancelTarget(null); setCancelReason(''); setCancelError(''); }}>
                  Keep Booking
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleAdminCancel} disabled={!cancelReason.trim()}>
                  Cancel Booking
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <ConfirmDialog
          open={!!payTarget}
          title="Mark booking as paid?"
          description={payTarget ? `Mark booking ${payTarget.bookingRef} as paid at the counter?` : undefined}
          confirmLabel="Mark as paid"
          onConfirm={handleMarkPaid}
          onCancel={() => setPayTarget(null)}
        >
          {payError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{payError}</div>
          )}
        </ConfirmDialog>

        <ConfirmDialog
          open={!!refundTarget}
          title="Record refund"
          description={refundTarget
            ? `Record a refund of Rs ${refundOf(refundTarget).toLocaleString()} for booking ${refundTarget.bookingRef}? Complete the gateway refund first - this only records it in the app.`
            : undefined}
          confirmLabel="Record refund"
          onConfirm={handleRefund}
          onCancel={() => setRefundTarget(null)}
        >
          {refundError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{refundError}</div>
          )}
        </ConfirmDialog>
      </div>
  );
}
