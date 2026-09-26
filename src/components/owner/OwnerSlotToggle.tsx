import { Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatNPR, formatTime12 } from '../../lib/dates';
import type { Slot } from '../../types';

export function OwnerSlotToggle({
  slot,
  onToggle,
  isPending,
}: {
  slot: Slot;
  onToggle?: (slot: Slot) => void;
  isPending?: boolean;
}) {
  const interactive = onToggle && (slot.status === 'available' || slot.status === 'maintenance');
  const Root = interactive ? 'button' : 'div';

  const classes =
    slot.status === 'available'
      ? 'border-primary/40 bg-secondary text-secondary-foreground hover:bg-secondary-foreground hover:text-secondary'
      : slot.status === 'maintenance'
        ? 'border-dashed border-border bg-muted/60 text-muted-foreground'
        : slot.status === 'booked'
          ? 'border-border bg-surface-strong text-surface-strong-foreground opacity-80'
          : 'border-border bg-border/40 text-muted-foreground opacity-60';

  return (
    <Root
      type={interactive ? 'button' : undefined}
      disabled={!interactive}
      aria-disabled={!interactive}
      aria-pressed={interactive ? slot.status === 'maintenance' : undefined}
      aria-label={`${formatTime12(slot.startTime)} slot on ${slot.date} — ${slot.status}`}
      onClick={interactive ? () => onToggle(slot) : undefined}
      className={cn(
        'flex min-h-16 flex-col items-start justify-between gap-1 rounded-2xl border p-3 text-left transition-colors duration-150',
        classes,
        interactive && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isPending && 'cursor-wait opacity-60'
      )}
    >
      <span className="text-sm font-extrabold">{formatTime12(slot.startTime)}</span>
      <span className="text-[11px] font-bold opacity-80">
        {slot.status === 'maintenance' ? (
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-3 w-3" aria-hidden /> Closed
          </span>
        ) : slot.status === 'booked' ? (
          'Booked'
        ) : slot.status === 'held' ? (
          'Held'
        ) : slot.status === 'blocked' ? (
          'Blocked'
        ) : (
          formatNPR(slot.price)
        )}
      </span>
    </Root>
  );
}