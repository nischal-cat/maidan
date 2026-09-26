import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { clearPendingDraft, getPendingDraft, type PendingDraft, type RecentGround } from '../../lib/recent';
import { firstGroundImage } from '../../lib/uploads';

export function RecentlyViewed({ items }: { items: RecentGround[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <h2 id="recent-title" className="text-xs font-extrabold uppercase text-muted-foreground">
        Pick up where you left off
      </h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {items.map((g) => {
          const img = firstGroundImage(g);
          return (
            <Link
              key={g.id}
              to={`/grounds/${g.id}`}
              className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform hover:-translate-y-0.5"
            >
              <div className="h-24 bg-muted">
                {img ? (
                  <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-surface-strong text-surface-strong-foreground opacity-40">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-extrabold text-card-foreground group-hover:text-primary">{g.name}</p>
                {g.basePrice != null && (
                  <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Rs {g.basePrice.toLocaleString()} / hr</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function ResumeDraftBanner() {
  const [draft] = useState<PendingDraft | null>(() => getPendingDraft());
  const [dismissed, setDismissed] = useState(false);

  if (!draft?.groundId || dismissed) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-primary">
            Unfinished booking{draft.groundName ? ` at ${draft.groundName}` : ''}
          </p>
          <p className="truncate text-xs font-semibold text-primary/80">
            Your slot is still waiting — pick up where you left off.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" asChild>
            <Link to={`/grounds/${draft.groundId}`}>Resume booking</Link>
          </Button>
          <Button
            variant="icon"
            size="icon"
            aria-label="Dismiss unfinished booking"
            onClick={() => {
              clearPendingDraft();
              setDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
