import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import { useToast } from '../components/ui/toast';
import type { Booking } from '../types';

export interface OwnerBookingQuery {
  status?: string;
  requiresApproval?: boolean;
  date?: string;
  groundId?: string;
  page?: number;
  limit?: number;
}

const bookingQueryKey = (f: OwnerBookingQuery): (string | number)[] => [
  'owner-bookings',
  f.status ?? 'all',
  f.requiresApproval === undefined ? 'any' : f.requiresApproval ? 'needs-approval' : 'no-approval',
  f.date ?? 'any',
  f.groundId ?? 'any',
  f.page ?? 1,
];

export function useOwnerBookings(filters: OwnerBookingQuery) {
  return useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: bookingQueryKey(filters),
    queryFn: async () => {
      const params: Record<string, string> = {
        limit: String(filters.limit ?? 30),
        page: String(filters.page ?? 1),
      };
      if (filters.status) params.status = filters.status;
      if (filters.requiresApproval !== undefined) params.requiresApproval = String(filters.requiresApproval);
      if (filters.date) params.date = filters.date;
      if (filters.groundId) params.groundId = filters.groundId;
      const res = await adminAPI.getAllBookings(params);
      return res.data;
    },
  });
}

function withBookings(
  old: { bookings: Booking[]; total: number } | undefined,
  update: (b: Booking) => Booking
): { bookings: Booking[]; total: number } {
  if (!old) return { bookings: [], total: 0 };
  return { ...old, bookings: old.bookings.map((b) => update(b)) };
}

export function useOwnerBookingActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['owner-approvals-count'] });
  };

  const markPaid = useMutation({
    mutationFn: (b: Booking) => adminAPI.markPaid(b.id),
    onMutate: async (b) => {
      await queryClient.cancelQueries({ queryKey: ['owner-bookings'] });
      const prev = queryClient.getQueriesData({ queryKey: ['owner-bookings'] });
      queryClient.setQueriesData<{ bookings: Booking[]; total: number }>(
        { queryKey: ['owner-bookings'] },
        (old) =>
          withBookings(old, (x) =>
            x.id === b.id ? { ...x, paymentStatus: 'paid' as const, paymentMethod: x.paymentMethod ?? 'counter' } : x
          )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast({ variant: 'error', title: 'Could not mark as paid', description: 'Please try again.' });
    },
    onSuccess: () => toast({ title: 'Marked as paid at the counter' }),
    onSettled: refreshList,
  });

  const approveBooking = useMutation({
    mutationFn: (b: Booking) => adminAPI.approveBooking(b.id),
    onMutate: async (b) => {
      await queryClient.cancelQueries({ queryKey: ['owner-bookings'] });
      const prev = queryClient.getQueriesData({ queryKey: ['owner-bookings'] });
      queryClient.setQueriesData<{ bookings: Booking[]; total: number }>(
        { queryKey: ['owner-bookings'] },
        (old) =>
          withBookings(old, (x) =>
            x.id === b.id ? { ...x, status: 'confirmed' as const, requiresApproval: false } : x
          )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast({ variant: 'error', title: 'Could not approve booking', description: 'Please try again.' });
    },
    onSuccess: (res) => toast({ title: 'Booking approved', description: res.data.message }),
    onSettled: refreshList,
  });

  const cancelBooking = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminAPI.cancelBooking(id, reason),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['owner-bookings'] });
      const prev = queryClient.getQueriesData({ queryKey: ['owner-bookings'] });
      queryClient.setQueriesData<{ bookings: Booking[]; total: number }>(
        { queryKey: ['owner-bookings'] },
        (old) => withBookings(old, (x) => (x.id === id ? { ...x, status: 'cancelled' as const } : x))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast({ variant: 'error', title: 'Could not cancel booking', description: 'Please try again.' });
    },
    onSuccess: (res) => toast({ title: 'Booking cancelled', description: res.data.message }),
    onSettled: refreshList,
  });

  const refund = useMutation({
    mutationFn: (b: Booking) => adminAPI.refundDeposit(b.id),
    onMutate: async (b) => {
      await queryClient.cancelQueries({ queryKey: ['owner-bookings'] });
      const prev = queryClient.getQueriesData({ queryKey: ['owner-bookings'] });
      queryClient.setQueriesData<{ bookings: Booking[]; total: number }>(
        { queryKey: ['owner-bookings'] },
        (old) => withBookings(old, (x) => (x.id === b.id ? { ...x, depositRefunded: true, paymentStatus: 'refunded' as const } : x))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast({ variant: 'error', title: 'Could not record refund', description: 'Please try again.' });
    },
    onSuccess: (res) =>
      toast({
        title: 'Refund recorded',
        description: `Rs ${res.data.refundAmount.toLocaleString('en-IN')} — refunded externally by you.`,
      }),
    onSettled: refreshList,
  });

  return { markPaid, approveBooking, cancelBooking, refund, refreshList };
}