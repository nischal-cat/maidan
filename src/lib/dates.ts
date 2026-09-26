import { format } from 'date-fns';
import type { Booking } from '../types';

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return format(value, 'yyyy-MM-dd');
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${toKey(dateKey)}T12:00:00`);
}

export function formatWeekdayShort(dateKey: string): string {
  return format(dateFromKey(dateKey), 'EEE');
}

export function formatMonthDay(dateKey: string): string {
  return format(dateFromKey(dateKey), 'MMM d');
}

export function formatFullDate(dateKey: string): string {
  return format(dateFromKey(dateKey), 'EEE, MMM d, yyyy');
}

export function formatTime12(time: string): string {
  return format(new Date(`2000-01-01T${time}`), 'h:mm a');
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime12(start)}–${formatTime12(end)}`;
}

export function hourOf(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

export function isTonight(time: string): boolean {
  return hourOf(time) >= 17;
}

export function addDaysKey(dateKey: string, days: number): string {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

// -------------------------------------------------------------------------
// Owner payment semantics (from the booking DTO the API actually returns).
// The schema has no counter-collection timestamp, so "amount paid" is the
// amount currently RECORDED as paid against bookings scheduled for a day —
// not payments actually occurring that day.
// -------------------------------------------------------------------------

export function recordedPaidAmount(b: Booking): number {
  if (b.status === 'cancelled' || b.status === 'late_cancelled') return 0;
  if (b.source === 'walk_in') return b.paymentStatus === 'paid' ? b.totalPrice : 0;
  if (b.paymentMethod === 'cash' || b.paymentMethod === 'counter') return b.paymentStatus === 'paid' ? b.totalPrice : 0;
  if (b.batchGroupId) return b.paymentStatus === 'paid' ? b.totalPrice : 0;
  return b.depositPaid && !b.depositRefunded ? (b.depositAmount ?? 0) : 0;
}

export function outstandingAtVenue(b: Booking): number {
  if (b.status === 'cancelled' || b.status === 'late_cancelled') return 0;
  if (b.source === 'walk_in') return b.paymentStatus === 'paid' ? 0 : b.totalPrice;
  if (b.paymentMethod === 'cash' || b.paymentMethod === 'counter') return b.paymentStatus === 'paid' ? 0 : b.totalPrice;
  if (b.batchGroupId) return b.paymentStatus === 'paid' ? 0 : b.totalPrice;
  return Math.max(0, b.totalPrice - (b.depositPaid && !b.depositRefunded ? (b.depositAmount ?? 0) : 0));
}

export function formatNPR(amount: number): string {
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

// -------------------------------------------------------------------------
// Display labels
// -------------------------------------------------------------------------

export function bookingStatusLabel(status: Booking['status']): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Payment pending';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'late_cancelled':
      return 'Late cancelled';
  }
}

export function paymentStatusLabel(status?: Booking['paymentStatus']): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'refunded':
      return 'Refunded';
    case 'partial_refund':
      return 'Partially refunded';
    case 'unpaid':
    default:
      return 'Unpaid';
  }
}

export function isBookingConfirmed(b: Booking): boolean {
  return b.status === 'confirmed' || b.status === 'completed';
}

// -------------------------------------------------------------------------
// Countdown maths
//
// Postgres TIME columns arrive as 'HH:MM:SS', so every parser here slices to
// 'HH:MM' first. Slicing also means these helpers accept both 'HH:MM' and
// 'HH:MM:SS' without caring which one a caller had.
// -------------------------------------------------------------------------

/** Kick-off as a local Date. `dateKey` is 'yyyy-MM-dd', `time` is 'HH:MM[:SS]'. */
export function kickoffAt(dateKey: string, time: string): Date {
  return new Date(`${toKey(dateKey)}T${String(time).slice(0, 5)}`);
}

/** How long a slot runs, in whole hours. Falls back to 1h for overnight spans. */
export function durationHours(startTime: string, endTime: string): number {
  const toMinutes = (t: string) => {
    const [h, m] = String(t).slice(0, 5).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const minutes = toMinutes(endTime) - toMinutes(startTime);
  return minutes > 0 ? Math.round((minutes / 60) * 10) / 10 : 1;
}

export type CountdownPhase = 'upcoming' | 'soon' | 'live' | 'ended';

export interface Countdown {
  phase: CountdownPhase;
  days: number;
  hours: number;
  minutes: number;
  /** Headline, e.g. 'in 3h 20m' or 'Playing now'. */
  label: string;
  /** Supporting detail, always the formatted time range. */
  sublabel: string;
}

/**
 * How far away a slot is, split out from the component so the thresholds and
 * wording can be reasoned about (and unit-tested) with no React involved.
 *
 * `now` is injectable for the same reason.
 */
export function describeCountdown(
  dateKey: string,
  startTime: string,
  endTime: string,
  now: Date = new Date()
): Countdown {
  const start = kickoffAt(dateKey, startTime);
  const end = kickoffAt(dateKey, endTime);
  const msToStart = start.getTime() - now.getTime();
  const msToEnd = end.getTime() - now.getTime();

  if (msToEnd <= 0) {
    return { phase: 'ended', days: 0, hours: 0, minutes: 0, label: 'Finished', sublabel: formatTimeRange(startTime, endTime) };
  }

  if (msToStart <= 0) {
    const leftMinutes = Math.max(1, Math.round(msToEnd / 60000));
    return {
      phase: 'live',
      days: 0,
      hours: 0,
      minutes: leftMinutes,
      label: 'Playing now',
      sublabel: `${leftMinutes} min left · ${formatTimeRange(startTime, endTime)}`,
    };
  }

  const totalMinutes = Math.floor(msToStart / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const label = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    phase: totalMinutes <= 120 ? 'soon' : 'upcoming',
    days,
    hours,
    minutes,
    label: `in ${label}`,
    sublabel: formatTimeRange(startTime, endTime),
  };
}
