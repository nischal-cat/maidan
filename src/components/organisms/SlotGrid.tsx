import type { Slot } from '../../types';
import SlotButton from '../molecules/SlotButton';

interface SlotGridProps {
  slots: Slot[];
  onToggleSlot: (slot: Slot) => void;
  selectedSlotIds: string[];
  maxSelectable?: number;
  date?: string;
}

function timeOfDay(time: string): string {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 20) return 'Evening';
  return 'Night';
}

const GROUP_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

function isPast(date: string | undefined, startTime: string): boolean {
  if (!date) return false;
  const start = new Date(`${date}T${startTime}`);
  return !Number.isNaN(start.getTime()) && start.getTime() < Date.now();
}

export default function SlotGrid({ slots, onToggleSlot, selectedSlotIds = [], maxSelectable = 6, date }: SlotGridProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted py-12 text-center text-muted-foreground">
        <p>No slots available for this date.</p>
      </div>
    );
  }

  const selectedCount = selectedSlotIds.length;
  const atCapacity = selectedCount >= maxSelectable;
  const groups = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const key = timeOfDay(slot.startTime);
    (acc[key] ??= []).push(slot);
    return acc;
  }, {});

  const isSelected = (slotId: string) => selectedSlotIds.includes(slotId);

  return (
    <div className="space-y-7">
      {GROUP_ORDER.map((group) => {
        const groupSlots = groups[group];
        if (!groupSlots) return null;
        return (
          <section key={group} aria-label={`${group} slots`}>
            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">
              {group}
              <span className="h-px flex-1 bg-border" />
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {groupSlots.map((slot) => (
                <SlotButton
                  key={slot.id}
                  id={`slot-${slot.id}`}
                  startTime={slot.startTime}
                  endTime={slot.endTime}
                  status={slot.status}
                  price={slot.price}
                  selected={isSelected(slot.id)}
                  past={slot.status === 'available' && isPast(date, slot.startTime)}
                  onClick={() => {
                    if (isSelected(slot.id) || !atCapacity) onToggleSlot(slot);
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}
      {atCapacity && (
        <p className="text-xs font-semibold text-muted-foreground">
          Maximum {maxSelectable} slots per booking selected. Deselect one to pick another.
        </p>
      )}
    </div>
  );
}