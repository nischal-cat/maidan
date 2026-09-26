import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI, groundsAPI } from '../services/api';
import { useToast } from '../components/ui/toast';
import type { Slot } from '../types';

export function useOwnerSlots(groundId: string, date: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['owner-slots', groundId, date];

  const slotsQuery = useQuery<Slot[]>({
    queryKey,
    queryFn: async () => {
      const res = await groundsAPI.getSlots(groundId, date);
      return res.data;
    },
    enabled: !!groundId,
  });

  const rollback = (ctx: { prev: Slot[] | undefined } | undefined) => {
    if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
  };

  const applyOptimistic = async (updater: (s: Slot[]) => Slot[]) => {
    await queryClient.cancelQueries({ queryKey });
    const prev = queryClient.getQueryData<Slot[]>(queryKey);
    queryClient.setQueryData<Slot[]>(queryKey, (old) => (old ? updater(old) : old));
    return { prev };
  };

  const toggle = useMutation({
    mutationFn: (slot: Slot) => {
      const nextStatus = slot.status === 'available' ? 'maintenance' : 'available';
      return adminAPI.updateSlots(groundId, date, [{ startTime: slot.startTime, status: nextStatus }]);
    },
    onMutate: async (slot) =>
      applyOptimistic((s) =>
        s.map((x) => (x.id === slot.id ? { ...x, status: x.status === 'available' ? 'maintenance' : 'available' } : x))
      ),
    onError: (_e, _v, ctx) => {
      rollback(ctx);
      toast({ variant: 'error', title: 'Slot update failed', description: 'Could not change that time slot.' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const closeRemaining = useMutation({
    mutationFn: () =>
      adminAPI.updateSlots(
        groundId,
        date,
        (slotsQuery.data ?? [])
          .filter((s) => s.status === 'available')
          .map((s) => ({ startTime: s.startTime, status: 'maintenance' }))
      ),
    onMutate: () => applyOptimistic((s) => s.map((x) => (x.status === 'available' ? { ...x, status: 'maintenance' } : x))),
    onError: (_e, _v, ctx) => {
      rollback(ctx);
      toast({ variant: 'error', title: 'Could not close slots', description: 'Please try again.' });
    },
    onSuccess: () => toast({ title: 'Remaining slots closed' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const makeAllAvailable = useMutation({
    mutationFn: () =>
      adminAPI.updateSlots(
        groundId,
        date,
        (slotsQuery.data ?? [])
          .filter((s) => s.status === 'maintenance')
          .map((s) => ({ startTime: s.startTime, status: 'available' }))
      ),
    onMutate: () => applyOptimistic((s) => s.map((x) => (x.status === 'maintenance' ? { ...x, status: 'available' } : x))),
    onError: (_e, _v, ctx) => {
      rollback(ctx);
      toast({ variant: 'error', title: 'Could not open slots', description: 'Please try again.' });
    },
    onSuccess: () => toast({ title: 'Slots are now available' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const generate = useMutation({
    mutationFn: (days: number) => adminAPI.generateSlots(groundId, { startDate: date, days }),
    onError: () => toast({ variant: 'error', title: 'Could not generate slots', description: 'Please try again.' }),
    onSuccess: (res, days) => {
      toast({ title: 'Slots generated', description: `+${res.data.generated} new slots over ${days} days.` });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    slots: slotsQuery.data ?? [],
    isLoading: slotsQuery.isLoading,
    isError: slotsQuery.isError,
    refetch: slotsQuery.refetch,
    toggle,
    closeRemaining,
    makeAllAvailable,
    generate,
  };
}