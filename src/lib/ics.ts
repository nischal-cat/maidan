import type { Booking } from '../types';
import { formatNPR, formatTimeRange } from './dates';

/**
 * RFC 5545 (iCalendar) generation, built by hand in the browser.
 *
 * The app has no server-side calendar integration, so "Add to calendar" is a
 * client-side .ics download that works offline and needs no round trip.
 */

const CRLF = '\r\n';

/** Escape a value for an iCalendar TEXT property (RFC 5545 §3.3.11). */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold a content line to the 75-octet limit RFC 5545 §3.1 recommends. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join(CRLF);
}

/**
 * Local wall-clock time with a fixed UTC offset, e.g. '20260926T180000+0545'.
 *
 * Nepal has no DST, so a literal +05:45 is correct year-round and saves
 * shipping a whole VTIMEZONE block in every file.
 */
const NEPAL_UTC_OFFSET = '+0545';

function icsLocal(dateKey: string, time: string): string {
  const date = dateKey.slice(0, 10).replace(/-/g, '');
  const timePart = String(time).slice(0, 5).replace(':', '') + '00';
  return `${date}T${timePart}${NEPAL_UTC_OFFSET}`;
}

/** UTC DATE-TIME for DTSTAMP: '20260926T120000Z'. */
function icsUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/**
 * Build the VEVENT body for one booking.
 *
 * Exported separately from the button so the output can be asserted against in
 * a test without a DOM. UID is derived from the booking id, so re-importing an
 * updated file updates the existing event rather than duplicating it.
 */
export function buildBookingIcs(booking: Booking): string {
  const location = [booking.groundAddress, booking.groundCity].filter(Boolean).join(', ');
  const players = booking.numberOfPlayers ?? 1;

  const description = [
    `Booking ${booking.bookingRef ?? ''}`.trim(),
    `${players} player${players > 1 ? 's' : ''}`,
    `Total ${formatNPR(booking.totalPrice)}`,
    booking.groundContact ? `Venue contact ${booking.groundContact}` : '',
    'Booked on Maidan',
  ]
    .filter(Boolean)
    .join('\n');

  const isCancelled = booking.status === 'cancelled' || booking.status === 'late_cancelled';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maidan//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@maidan`,
    `DTSTAMP:${icsUtcStamp(new Date(booking.createdAt).getTime() ? new Date(booking.createdAt) : new Date())}`,
    `DTSTART:${icsLocal(booking.date, booking.startTime)}`,
    `DTEND:${icsLocal(booking.date, booking.endTime)}`,
    `SUMMARY:${escapeIcs(`${booking.groundName} — ${formatTimeRange(booking.startTime, booking.endTime)}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    `STATUS:${isCancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`Your match at ${booking.groundName} starts in 2 hours`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Trigger a client-side download of the .ics blob. */
export function downloadBookingIcs(booking: Booking): void {
  const blob = new Blob([buildBookingIcs(booking)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `maidan-${booking.bookingRef || booking.id}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
