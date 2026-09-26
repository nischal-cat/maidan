import { CalendarDays } from 'lucide-react';
import { Button } from '../ui/button';
import { formatFullDate, formatTimeRange } from '../../lib/dates';
import { downloadBookingIcs } from '../../lib/ics';
import type { Booking } from '../../types';

interface AddToCalendarButtonProps {
  booking: Booking;
  className?: string;
  variant?: 'primary' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
}

/**
 * "Add to calendar" for a booking. The .ics is built in the browser (see
 * lib/ics), so there is no server round-trip and nothing to store.
 */
export default function AddToCalendarButton({
  booking,
  className,
  variant = 'outline',
  size = 'sm',
}: AddToCalendarButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => downloadBookingIcs(booking)}
      title={`Add ${formatFullDate(booking.date)} ${formatTimeRange(booking.startTime, booking.endTime)} to your calendar`}
    >
      <CalendarDays className="h-4 w-4" aria-hidden /> Add to calendar
    </Button>
  );
}
