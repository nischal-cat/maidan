import { useQueries, useQuery } from '@tanstack/react-query';
import { adminAPI, groundsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useOwnerGrounds } from './useOwnerGrounds';
import { recordedPaidAmount, outstandingAtVenue, hourOf, isTonight } from '../lib/dates';
import type { Booking, Slot } from '../types';

export function useOwnerToday(date: string) {
  const { user } = useAuth();
  const ownerId = user?.role === 'owner' ? user.id : undefined;
  const groundsQuery = useOwnerGrounds(ownerId);
  const grounds = groundsQuery.data ?? [];

  const todayQuery = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ['owner-bookings', date, 'any'],
    queryFn: async () => {
      const res = await adminAPI.getAllBookings({ date, limit: 100 });
      return res.data;
    },
  });

  const upcomingQuery = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ['owner-bookings-upcoming'],
    queryFn: async () => {
      const res = await adminAPI.getAllBookings({ status: 'confirmed', limit: 100 });
      return res.data;
    },
    staleTime: 30_000,
  });

  const slotsQueries = useQueries({
    queries: grounds.map((g) => ({
      queryKey: ['owner-slots', g.id, date],
      queryFn: async () => {
        const res = await groundsAPI.getSlots(g.id, date);
        return res.data as Slot[];
      },
    })),
  });

  const todayBookings: Booking[] = todayQuery.data?.bookings ?? [];
  const schedule = todayBookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'late_cancelled')
    .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));

  const paidToday = schedule.reduce((sum, b) => sum + recordedPaidAmount(b), 0);
  const dueToday = schedule.reduce((sum, b) => sum + outstandingAtVenue(b), 0);
  const unpaidToday = schedule.filter((b) => b.status === 'confirmed' && outstandingAtVenue(b) > 0);

  const available = slotsQueries.flatMap((q) => q.data ?? []).filter((s) => s.status === 'available');
  const availableToday = available.length;
  const availableTonight = available.filter((s) => isTonight(s.startTime)).length;

  const nowHour = new Date().getHours();
  const nextBooking =
    (upcomingQuery.data?.bookings ?? [])
      .filter((b) => b.date > date || (b.date === date && hourOf(b.startTime) >= nowHour))
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))[0] ??
    null;

  return {
    grounds,
    schedule,
    todayCount: schedule.length,
    paidToday,
    dueToday,
    unpaidToday,
    availableToday,
    availableTonight,
    nextBooking,
    isLoading: groundsQuery.isLoading || todayQuery.isLoading || slotsQueries.some((q) => q.isLoading),
    isError: todayQuery.isError || groundsQuery.isError || slotsQueries.some((q) => q.isError),
    refetchSlots: async () => {
      await Promise.all(slotsQueries.map((q) => q.refetch()));
    },
  };
}