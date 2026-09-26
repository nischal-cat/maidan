import { useMemo } from 'react';
import { OwnerSlotToggle } from './OwnerSlotToggle';
import { hourOf } from '../../lib/dates';
import type { Slot } from '../../types';

type Session = 'Morning' | 'Afternoon' | 'Evening';

const sessionOf = (slot: Slot): Session => {
  const h = hourOf(slot.startTime);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
};

const SESSIONS: Session[] = ['Morning', 'Afternoon', 'Evening'];

export function OwnerSlotGrid({
  slots,
  onToggle,
  pendingSlotId,
}: {
  slots: Slot[];
  onToggle?: (slot: Slot) => void;
  pendingSlotId?: string | null;
}) {
  const grouped = useMemo(() => {
    const map: Record<Session, Slot[]> = { Morning: [], Afternoon: [], Evening: [] };
    slots.forEach((s) => map[sessionOf(s)].push(s));
    return map;
  }, [slots]);

  return (
    <div className="space-y-6">
      {SESSIONS.map((session) => {
        const items = grouped[session];
        if (items.length === 0) return null;
        return (
          <section key={session}>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              {session}
              <span className="text-muted-foreground/40">·</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">{items.length}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((slot) => (
                <OwnerSlotToggle key={slot.id} slot={slot} onToggle={onToggle} isPending={pendingSlotId === slot.id} />
              ))}
            </div>
          </section>
        );
      })}
      {slots.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">No slots.</p>}
    </div>
  );
}