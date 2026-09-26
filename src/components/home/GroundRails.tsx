import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import type { AxiosResponse } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { groundsAPI, bookingsAPI } from '../../services/api';
import type { Ground } from '../../types';
import { useLocationCity, haversineKm } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { firstGroundImage } from '../../lib/uploads';

const rs = (n: number) => n.toLocaleString();

function isBookingInPast(booking: { date: string; startTime?: string }) {
  const start = new Date(`${booking.date}T${(booking.startTime ?? '00:00').slice(0, 5)}`);
  return !Number.isNaN(start.getTime()) && start.getTime() < Date.now();
}

// Nearby grounds float to the front (GPS coords when available), then the
// player's own city, then newest — a "cinema rails" feel for the homepage.
function rankGrounds(
  grounds: Ground[],
  coords: { lat: number; lng: number } | null,
  city: string,
  limit = 12
): (Ground & { distanceKm: number | null })[] {
  return grounds
    .map((g) => ({
      ...g,
      distanceKm:
        coords && g.latitude != null && g.longitude != null
          ? haversineKm(coords.lat, coords.lng, g.latitude, g.longitude)
          : null,
    }))
    .sort((a, b) => {
      const d1 = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const d2 = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (d1 !== d2) return d1 - d2;
      if (a.city !== b.city && a.city === city) return -1;
      if (a.city !== b.city && b.city === city) return 1;
      return 0;
    })
    .slice(0, limit);
}

function RailCard({ ground, distanceKm }: { ground: Ground; distanceKm: number | null }) {
  const img = firstGroundImage(ground);
  const rated = ground.rating != null && ground.rating > 0;
  return (
    <Link
      to={`/grounds/${ground.id}`}
      className="group w-60 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform duration-300 hover:-translate-y-1 focus-within:-translate-y-1"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={ground.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-strong text-surface-strong-foreground opacity-40">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-extrabold uppercase text-foreground backdrop-blur">
          {ground.city}
        </span>
        {rated && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold text-foreground backdrop-blur">
            <Star className="h-3 w-3 fill-highlight text-highlight" aria-hidden />
            {ground.rating}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="truncate text-sm font-extrabold text-card-foreground transition-colors group-hover:text-primary">
          {ground.name}
        </h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {ground.sportType ? ground.sportType.charAt(0).toUpperCase() + ground.sportType.slice(1) : 'Futsal'}
          {distanceKm != null ? ` · ${distanceKm.toFixed(1)} km` : ''}
          {ground.ratingCount != null && ground.ratingCount > 0 ? ` · ${ground.ratingCount} rating${ground.ratingCount === 1 ? '' : 's'}` : ''}
        </p>
        <p className="mt-2 text-sm font-extrabold text-card-foreground">
          Rs {rs(ground.basePrice)}
          <span className="text-xs font-medium text-muted-foreground"> / hr</span>
        </p>
      </div>
    </Link>
  );
}

function RailSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-60 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-[16/10] animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroundRail({
  id,
  title,
  subtitle,
  grounds,
  loading = false,
}: {
  id: string;
  title: string;
  subtitle?: string;
  grounds: (Ground & { distanceKm: number | null })[];
  loading?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id={id} className="text-2xl font-extrabold text-foreground md:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {grounds.length > 0 && (
            <Link
              to="/grounds"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="mt-5"><RailSkeleton /></div>
        ) : grounds.length === 0 ? null : (
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
            {grounds.map((g) => (
              <RailCard key={g.id} ground={g} distanceKm={g.distanceKm} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function RecentlyAddedRail() {
  const { city, coords } = useLocationCity();
  const { data, isLoading } = useQuery({
    queryKey: ['grounds', 'rail', 'recent', city],
    queryFn: async () => {
      const res = await groundsAPI.getAll({ limit: 50 });
      return res.data.grounds;
    },
    staleTime: 60_000,
  });

  const list = rankGrounds(data ?? [], coords, city, 12);

  return (
    <GroundRail
      id="rail-recent"
      title="Recently added"
      grounds={list}
      loading={isLoading}
    />
  );
}

export function SuggestedRail() {
  const { city, coords } = useLocationCity();
  const { data, isLoading } = useQuery({
    queryKey: ['grounds', 'rail', 'suggested', city],
    queryFn: async () => {
      const res = await groundsAPI.getAll({ limit: 50, sort: 'rating' });
      return res.data.grounds;
    },
    staleTime: 60_000,
  });

  const list = rankGrounds(data ?? [], coords, city, 12);

  return (
    <GroundRail
      id="rail-suggested"
      title="Suggested for you"
      subtitle="Top-rated courts loved by players"
      grounds={list}
      loading={isLoading}
    />
  );
}

export function PlayedRecentlyRail() {
  const { user } = useAuth();
  const { coords } = useLocationCity();

  const { data: bookings } = useQuery({
    queryKey: ['my-bookings', 'played-rail'],
    queryFn: async () => {
      const res = await bookingsAPI.getMyBookings({ limit: 50 });
      return res.data.bookings;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const ids = Array.from(
    new Set(
      (bookings ?? [])
        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
        .filter((b) => isBookingInPast(b))
        .map((b) => b.groundId)
    )
  ).slice(0, 6);

  const { data: playedGrounds, isLoading } = useQuery({
    queryKey: ['grounds', 'rail', 'played', ids.join(',')],
    queryFn: async () => {
      const settled = await Promise.allSettled(ids.map((id) => groundsAPI.getById(id)));
      return settled
        .filter((r): r is PromiseFulfilledResult<AxiosResponse<Ground>> => r.status === 'fulfilled')
        .map((r) => r.value.data);
    },
    enabled: !!user && ids.length > 0,
    staleTime: 60_000,
  });

  const list = rankGrounds(playedGrounds ?? [], coords, '', 6);

  return (
    <GroundRail
      id="rail-played"
      title="Played recently"
      subtitle="Courts you've locked in before"
      grounds={list}
      loading={isLoading && ids.length > 0}
    />
  );
}