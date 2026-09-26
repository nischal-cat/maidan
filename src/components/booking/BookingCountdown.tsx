import { useEffect, useState } from 'react';
import { describeCountdown, type CountdownPhase } from '../../lib/dates';

interface BookingCountdownProps {
  date: string;
  startTime: string;
  endTime: string;
  className?: string;
  /** Hide entirely once the slot is over (the list card does this). */
  hideWhenEnded?: boolean;
}

const TONE: Record<CountdownPhase, string> = {
  live: 'bg-primary text-primary-foreground',
  soon: 'bg-highlight/20 text-highlight-foreground',
  upcoming: 'bg-primary/10 text-primary',
  ended: 'bg-muted text-muted-foreground',
};

/**
 * Live "time until kick-off" chip. Ticks every 30s — granular enough for a
 * countdown that reads in minutes without waking the phone constantly.
 * The maths lives in lib/dates (describeCountdown).
 */
export default function BookingCountdown({
  date,
  startTime,
  endTime,
  className,
  hideWhenEnded = false,
}: BookingCountdownProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const countdown = describeCountdown(date, startTime, endTime, now);

  if (hideWhenEnded && countdown.phase === 'ended') return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${TONE[countdown.phase]} ${className ?? ''}`}
    >
      {countdown.label}
      <span className="font-semibold opacity-80">· {countdown.sublabel}</span>
    </span>
  );
}
