import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Check, MapPin, TicketCheck, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { StatusPill } from '../ui/status-pill';
import { bookingsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const todayStr = () => new Date().toISOString().split('T')[0];

export function NextMatchBand() {
  const { user } = useAuth();
  const [inviteCopied, setInviteCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', 'next-match'],
    queryFn: async () => {
      const res = await bookingsAPI.getMyBookings({ status: 'confirmed', limit: 50 });
      return res.data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Guests get the clean default homepage — no booking band.
  if (!user) return null;

  const today = todayStr();
  const upcoming = (data?.bookings ?? [])
    .filter((b) => b.date >= today)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0];

  const daysUntil = upcoming ? differenceInCalendarDays(parseISO(upcoming.date), new Date()) : null;

  const handleInvite = async () => {
    if (!upcoming) return;
    const message = `Join my futsal game at ${upcoming.groundName}, ${upcoming.date} ${upcoming.startTime?.slice(0, 5)}. Book yours on Maidan.`;
    try {
      await navigator.clipboard.writeText(message);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <section
      id="bookings"
      aria-labelledby="bookings-title"
      className="scroll-mt-20 bg-surface-strong py-14 text-surface-strong-foreground md:py-20"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Your next match</p>
          <h2 id="bookings-title" className="mt-2 text-3xl font-extrabold md:text-5xl">
            {upcoming ? 'Game day is locked in.' : 'Nothing locked in yet.'}
          </h2>
          <p className="mt-4 max-w-md leading-relaxed opacity-65">
            {upcoming
              ? 'Everything you need, from booking reference to directions, is ready in one place.'
              : 'Your next match shows up here the moment you book a court.'}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-surface-strong-foreground/15 bg-surface-strong-foreground/5 p-5 md:p-7" aria-hidden>
            <div className="h-16 animate-pulse rounded-xl bg-surface-strong-foreground/10" />
            <div className="mt-6 h-11 w-40 animate-pulse rounded-full bg-surface-strong-foreground/10" />
          </div>
        ) : upcoming ? (
          <div className="rounded-2xl border border-surface-strong-foreground/15 bg-surface-strong-foreground/5 p-5 md:p-7">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary text-primary-foreground">
                <TicketCheck className="h-7 w-7" aria-hidden />
              </div>
              <div className="min-w-0">
                <StatusPill>{upcoming.status}</StatusPill>
                <h3 className="mt-1 truncate text-lg font-extrabold">{upcoming.groundName}</h3>
                <p className="truncate text-sm opacity-70">
                  {formatDay(upcoming.date)} · {upcoming.startTime?.slice(0, 5)}–{upcoming.endTime?.slice(0, 5)}
                  {upcoming.bookingRef && ` · ${upcoming.bookingRef}`}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold">{countdownLabel(daysUntil)}</p>
                <p className="text-xs opacity-60">{captionLabel(daysUntil)}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${upcoming.groundName}, Nepal`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="h-4 w-4" />
                  Directions
                </a>
              </Button>
              <Button
                variant="ghost"
                onClick={handleInvite}
                className="border border-surface-strong-foreground/25 bg-transparent text-surface-strong-foreground hover:bg-surface-strong-foreground/10 hover:text-surface-strong-foreground"
              >
                {inviteCopied ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {inviteCopied ? 'Invite copied' : 'Invite players'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-surface-strong-foreground/15 bg-surface-strong-foreground/5 p-5 md:p-7">
            <p className="text-sm opacity-70">Courts near you are updating live for tonight.</p>
            <Button variant="secondary" asChild className="mt-4">
              <a href="#courts">Find a court</a>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function formatDay(date: string) {
  try {
    return parseISO(date).toLocaleDateString(undefined, { weekday: 'long' });
  } catch {
    return date;
  }
}

function countdownLabel(days: number | null) {
  if (days == null) return '--';
  if (days < 1) return 'Now';
  return String(days).padStart(2, '0');
}

function captionLabel(days: number | null) {
  if (days == null || days < 1) return 'to kick-off';
  return days === 1 ? 'day' : 'days';
}
