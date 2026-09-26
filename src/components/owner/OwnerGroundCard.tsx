import { Clock, MapPin, Phone, ArrowRight } from 'lucide-react';
import { Card } from '../ui/card';
import { formatTimeRange, formatNPR } from '../../lib/dates';
import { firstGroundImage } from '../../lib/uploads';
import type { Ground } from '../../types';

export function OwnerGroundCard({ ground, onOpen }: { ground: Ground; onOpen?: () => void }) {
  const Root = onOpen ? 'button' : 'div';
  const coverImage = firstGroundImage(ground);

  return (
    <Card padding={false} className="overflow-hidden">
      <Root
        onClick={onOpen}
        className={cnRoot(Boolean(onOpen))}
      >
        <div className="relative h-40 bg-secondary">
          {coverImage ? (
            <img src={coverImage} alt={ground.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-secondary-foreground/60 text-sm font-bold">
              No photo yet
            </div>
          )}
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface-strong/80 px-2.5 py-1 text-xs font-bold text-surface-strong-foreground backdrop-blur">
            {ground.isActive === false ? 'Inactive' : 'Active'}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-card-foreground">{ground.name}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{ground.city || 'Kathmandu'}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-extrabold text-card-foreground">{formatNPR(ground.basePrice)}<span className="text-xs font-semibold text-muted-foreground">/hr</span></p>
              <p className="flex items-center justify-end gap-1 text-[10px] font-semibold text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden />
                {formatTimeRange(ground.operatingHoursStart, ground.operatingHoursEnd)}
              </p>
            </div>
          </div>
          {ground.contact && (
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {ground.contact}
            </p>
          )}
          {ground.description && <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{ground.description}</p>}
          {onOpen && (
            <span className="flex items-center gap-1 text-xs font-bold text-primary">
              Manage this ground <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </div>
      </Root>
    </Card>
  );
}

function cnRoot(interactive?: boolean): string {
  return interactive
    ? 'flex w-full flex-col text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : 'flex w-full flex-col';
}