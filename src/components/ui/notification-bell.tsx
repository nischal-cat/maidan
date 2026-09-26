import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, useUnreadCount } from '../../hooks/useNotifications';
import { Spinner } from '../ui/spinner';
import { cn } from '../../lib/utils';
import type { NotificationType } from '../../types';

/** Per-type icon + accent, so the bell is scannable without reading every row. */
const TYPE_META: Record<NotificationType, { icon: typeof Bell; ring: string }> = {
  booking_held: { icon: Clock, ring: 'text-highlight-foreground bg-highlight/20' },
  booking_confirmed: { icon: CalendarDays, ring: 'text-primary bg-primary/15' },
  booking_cancelled: { icon: XCircle, ring: 'text-destructive bg-destructive/10' },
  booking_request: { icon: BellRing, ring: 'text-highlight-foreground bg-highlight/20' },
  approval_approved: { icon: CheckCheck, ring: 'text-primary bg-primary/15' },
  approval_rejected: { icon: XCircle, ring: 'text-destructive bg-destructive/10' },
  payment_paid: { icon: CircleDollarSign, ring: 'text-primary bg-primary/15' },
  payment_failed: { icon: XCircle, ring: 'text-destructive bg-destructive/10' },
  payment_recorded: { icon: CircleDollarSign, ring: 'text-primary bg-primary/15' },
  refund_recorded: { icon: CircleDollarSign, ring: 'text-primary bg-primary/15' },
  reminder: { icon: Clock, ring: 'text-highlight-foreground bg-highlight/20' },
  kyc_status: { icon: ShieldCheck, ring: 'text-primary bg-primary/15' },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface NotificationBellProps {
  /** Rendered inside a header that already has a dark/brand surface? */
  tone?: 'default' | 'onDark';
  className?: string;
}

/**
 * Notification bell for every signed-in role. Mounted once per shell (public
 * Navbar, OwnerLayout, AdminLayout) and self-gating on auth, so a guest never
 * triggers a request.
 */
export default function NotificationBell({ tone = 'default', className }: NotificationBellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const enabled = !!user;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data: unreadCount = 0 } = useUnreadCount(enabled);
  const { list, markRead, markAllRead, dismiss } = useNotifications(enabled);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!enabled) return null;

  const notifications = list.data?.notifications ?? [];
  const onDark = tone === 'onDark';

  const openItem = (id: string, link?: string | null) => {
    if (!list.data?.notifications.find((n) => n.id === id)?.isRead) markRead.mutate(id);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'relative grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          onDark
            ? 'text-surface-strong-foreground/80 hover:bg-surface-strong-foreground/10 hover:text-surface-strong-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 text-primary" aria-hidden />
        ) : (
          <Bell className="h-5 w-5" aria-hidden />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-extrabold leading-[18px] text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-full z-50 mt-2 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-extrabold text-card-foreground">
                Notifications
                {unreadCount > 0 && <span className="ml-1.5 text-primary">({unreadCount})</span>}
              </p>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-primary transition-colors hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {list.isLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : list.isError ? (
                <p className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
                  Could not load notifications.
                </p>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden />
                  <p className="mt-3 text-sm font-bold text-card-foreground">Nothing yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Booking updates and reminders will show up here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => {
                    const meta = TYPE_META[n.type] ?? { icon: Bell, ring: 'text-muted-foreground bg-muted' };
                    const Icon = meta.icon;
                    return (
                      <li key={n.id} className={cn('group relative', !n.isRead && 'bg-primary/[0.04]')}>
                        <button
                          type="button"
                          onClick={() => openItem(n.id, n.link)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', meta.ring)}>
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span
                                className={cn(
                                  'flex-1 text-sm leading-snug',
                                  n.isRead ? 'font-semibold text-foreground' : 'font-extrabold text-card-foreground'
                                )}
                              >
                                {n.title}
                              </span>
                              {!n.isRead && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                              )}
                            </span>
                            {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
                            <span className="mt-1 block text-[11px] font-semibold text-muted-foreground/80">
                              {relativeTime(n.createdAt)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss.mutate(n.id)}
                          aria-label={`Dismiss: ${n.title}`}
                          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                        >
                          <XCircle className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
