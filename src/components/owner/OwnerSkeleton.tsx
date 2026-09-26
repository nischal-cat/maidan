import { cn } from '../../lib/utils';

const block = 'animate-pulse rounded-2xl bg-border/60';

export function OwnerSkeleton({ variant }: { variant: 'metrics' | 'cards' | 'list' | 'grid' | 'detail' }) {
  if (variant === 'metrics') {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(block, 'p-5')}>
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="mt-3 h-7 w-2/3 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn(block, 'overflow-hidden')}>
            <div className="h-40 rounded-none bg-white/40" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className={cn(block, 'h-16')} />
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-4">
        <div className={cn(block, 'h-56')} />
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(block, 'h-20')} />
          <div className={cn(block, 'h-20')} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn(block, 'flex items-center gap-4 p-4')}>
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}