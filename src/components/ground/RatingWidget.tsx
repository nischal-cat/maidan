import { useState } from 'react';
import { Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groundsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

function StarRow({
  value,
  onSelect,
  interactive = false,
}: {
  value: number;
  onSelect?: (n: number) => void;
  interactive?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role={interactive ? 'radiogroup' : undefined} aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onSelect?.(n)}
          aria-label={interactive ? `Rate ${n} out of 5` : undefined}
          aria-checked={interactive ? n === value : undefined}
          role={interactive ? 'radio' : undefined}
          className={cn(
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            interactive && 'cursor-pointer transition-transform hover:scale-110'
          )}
        >
          <Star
            className={cn(
              'h-7 w-7 transition-colors',
              n <= value ? 'fill-highlight text-highlight' : 'text-border'
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

export function RatingWidget({ groundId }: { groundId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hover, setHover] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['ground-rating', groundId],
    queryFn: async () => {
      const res = await groundsAPI.getRatingInfo(groundId);
      return res.data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const rate = useMutation({
    mutationFn: async (rating: number) => {
      const res = await groundsAPI.rateGround(groundId, rating);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ground-rating', groundId] });
      queryClient.invalidateQueries({ queryKey: ['ground', groundId] });
    },
  });

  const picked = hover > 0 ? hover : (data?.myRating ?? 0);

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary">
          {isLoading ? '–' : (data?.average ?? 0).toFixed(1)}
        </div>
        <div>
          <h2 className="font-extrabold text-card-foreground">Player rating</h2>
          {!user ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Sign in to rate this court after booking.</p>
          ) : isLoading ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data?.count ?? 0} rating{data?.count === 1 ? '' : 's'}
              {data?.canRate
                ? data?.myRating
                  ? ' · tap a star to update yours'
                  : ' · played here before? rate it'
                : ' · rate once your booking is complete'}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div onMouseLeave={() => setHover(0)}>
          <StarRow
            value={picked}
            interactive={!!user && !!data?.canRate && !rate.isPending}
            onSelect={(n) => {
              setHover(0);
              rate.mutate(n);
            }}
          />
        </div>
        {rate.isPending && <p className="text-xs font-semibold text-muted-foreground">Saving…</p>}
        {rate.isError && (
          <p className="text-xs font-semibold text-destructive">
            {'Could not save your rating. Please try again.'}
          </p>
        )}
        {rate.isSuccess && (
          <p className="text-xs font-semibold text-primary">Thanks for rating!</p>
        )}
      </div>
    </div>
  );
}