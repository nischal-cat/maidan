import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '../services/api';
import type { AppNotification } from '../types';

export const NOTIFICATIONS_KEY = 'notifications';
export const UNREAD_COUNT_KEY = 'notifications-unread-count';

// The bell is the only always-mounted consumer of notifications, so a modest
// poll keeps the badge fresh without needing websockets. 60s is frequent enough
// for a booking flow and cheap (one indexed COUNT).
const POLL_INTERVAL_MS = 60_000;
const PAGE_SIZE = 15;

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: [UNREAD_COUNT_KEY],
    queryFn: async () => (await notificationsAPI.getUnreadCount()).data.count,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 30_000,
  });
}

export function useNotifications(enabled: boolean) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: [NOTIFICATIONS_KEY],
    queryFn: async () => (await notificationsAPI.list({ limit: PAGE_SIZE })).data,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Keep the badge in step with the list after any read/dismiss mutation so the
  // two can never disagree.
  const syncBadge = () => {
    queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsAPI.markRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: [NOTIFICATIONS_KEY] });
      const previous = queryClient.getQueryData<{ notifications: AppNotification[]; unreadCount: number }>([NOTIFICATIONS_KEY]);

      queryClient.setQueryData<{ notifications: AppNotification[]; unreadCount: number }>(
        [NOTIFICATIONS_KEY],
        (old) =>
          old
            ? {
                ...old,
                notifications: old.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
                unreadCount: Math.max(0, old.unreadCount - (old.notifications.find((n) => n.id === id)?.isRead ? 0 : 1)),
              }
            : old
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData([NOTIFICATIONS_KEY], context.previous);
    },
    onSettled: () => {
      syncBadge();
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSettled: () => {
      syncBadge();
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => notificationsAPI.dismiss(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: [NOTIFICATIONS_KEY] });
      const previous = queryClient.getQueryData<{ notifications: AppNotification[]; unreadCount: number }>([NOTIFICATIONS_KEY]);
      const removed = previous?.notifications.find((n) => n.id === id);

      queryClient.setQueryData<{ notifications: AppNotification[]; unreadCount: number }>(
        [NOTIFICATIONS_KEY],
        (old) =>
          old
            ? {
                ...old,
                notifications: old.notifications.filter((n) => n.id !== id),
                unreadCount: Math.max(0, old.unreadCount - (removed && !removed.isRead ? 1 : 0)),
              }
            : old
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData([NOTIFICATIONS_KEY], context.previous);
    },
    onSettled: () => {
      syncBadge();
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });

  return { list, markRead, markAllRead, dismiss };
}
