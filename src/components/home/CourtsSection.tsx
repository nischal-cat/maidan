import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { ArrowRight, Check, Clock3, Heart, Map as MapIcon, Star, LayoutGrid } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Chip } from '../ui/chip';
import { groundsAPI } from '../../services/api';
import type { Ground, Slot } from '../../types';
import { useLocationCity, haversineKm, CITY_COORDS } from '../../context/LocationContext';
import { useCities } from '../../hooks/useCities';
import { firstGroundImage } from '../../lib/uploads';
import { cn } from '../../lib/utils';

export interface Venue {
  id: string;
  name: string;
  area?: string;
  distanceKm?: number | null;
  rating?: number | null;
  reviews?: number | null;
  price: number | null;
  nextSlot?: string | null;
  tags: string[];
  image?: string | null;
}

const rs = (n: number) => n.toLocaleString();

const todayStr = () => new Date().toISOString().split('T')[0];

function formatHour(time: string) {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/** First available slot today at/after the current hour, else first available. */
function pickNextSlot(slots: { startTime: string; status: string }[] | undefined): string | null {
  if (!Array.isArray(slots)) return null;
  const available = slots.filter((s) => s.status === 'available');
  if (available.length === 0) return null;
  const nowHour = new Date().getHours();
  const upcoming = available.find((s) => parseInt(s.startTime.split(':')[0], 10) >= nowHour);
  return formatHour((upcoming ?? available[0]).startTime);
}

const BUCKETS = [
  { value: 'ALL', label: 'All hours' },
  { value: '17-18', label: '5–6' },
  { value: '18-19', label: '6–7' },
  { value: '19-20', label: '7–8' },
  { value: '20-21', label: '8–9' },
  { value: '21-22', label: '9+' },
];

type BucketValue = (typeof BUCKETS)[number]['value'];

function inBucket(
  slots: { startTime: string; status: string }[] | undefined,
  range: [number, number] | null
): boolean {
  if (!range || !Array.isArray(slots)) return true;
  return slots.some((s) => {
    const hour = parseInt(s.startTime.split(':')[0], 10);
    return hour >= range[0] && hour < range[1] && s.status === 'available';
  });
}

function groundToVenue(ground: Ground, nextSlot: string | null, distanceKm: number | null): Venue {
  const sport = ground.sportType;
  return {
    id: ground.id,
    name: ground.name,
    area: ground.city,
    distanceKm,
    rating: ground.rating ?? null,
    price: ground.basePrice ?? null,
    nextSlot,
    tags: sport ? [sport.charAt(0).toUpperCase() + sport.slice(1)] : ['Futsal'],
    image: firstGroundImage(ground),
  };
}

export function VenueCard({ venue, onBook }: { venue: Venue; onBook: (id: string) => void }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform duration-300 hover:-translate-y-1 focus-within:-translate-y-1">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Link to={`/grounds/${venue.id}`} aria-label={`View ${venue.name} details`} className="absolute inset-0 z-10">
          {venue.image ? (
            <img
              src={venue.image}
              alt={`${venue.name} futsal court`}
              width={1200}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-surface-strong text-surface-strong-foreground">
              <svg className="h-16 w-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </span>
          )}
        </Link>
        <Button
          variant="icon"
          size="icon"
          aria-label={`Save ${venue.name}`}
          className="absolute right-3 top-3 z-20 border-transparent bg-background/90 hover:bg-background"
        >
          <Heart className="h-4 w-4" />
        </Button>
        {venue.rating != null && venue.rating > 0 ? (
          <Badge className="z-20">{venue.nextSlot ? 'Available today' : 'Live availability'}</Badge>
        ) : (
          <Badge className="z-20 bg-highlight text-highlight-foreground">New</Badge>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold">
              <Link to={`/grounds/${venue.id}`} className="transition-colors hover:text-primary">
                {venue.name}
              </Link>
            </h3>
            {(venue.area || venue.distanceKm != null) && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {venue.area}
                {venue.distanceKm != null && ` · ${venue.distanceKm.toFixed(1)} km`}
              </p>
            )}
          </div>
          {venue.rating != null && venue.rating > 0 && (
            <p className="flex items-center gap-1 whitespace-nowrap">
              <Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden />
              <span className="text-sm font-bold">{venue.rating}</span>
              {venue.reviews != null && (
                <span className="text-sm font-normal text-muted-foreground">({venue.reviews})</span>
              )}
            </p>
          )}
        </div>

        {venue.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {venue.tags.map((tag) => (
              <li key={tag}>
                <Chip>{tag}</Chip>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
          <p>
            <span className="block text-[10px] font-extrabold uppercase text-muted-foreground">From</span>
            {venue.price != null ? (
              <>
                <span className="text-lg font-extrabold">Rs {rs(venue.price)}</span>
                <span className="text-xs font-medium text-muted-foreground"> / hr</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">Price on request</span>
            )}
          </p>
          <Button onClick={() => onBook(venue.id)}>
            {venue.nextSlot ? `Book ${venue.nextSlot}` : 'View slots'}
          </Button>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-hidden>
      <div className="aspect-[16/10] animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

function pricePinIcon(price: number | null) {
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div class="rounded-full border border-primary/60 bg-background px-2.5 py-1 text-xs font-extrabold text-primary shadow-md">${price != null ? `Rs ${rs(price)}` : 'View'}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function VenueMap({
  grounds,
}: {
  grounds: (Ground & { distanceKm: number | null })[];
}) {
  const { coords, city } = useLocationCity();
  const { coordsMap } = useCities();
  const center = coords
    ? [coords.lat, coords.lng]
    : [coordsMap[city]?.lat ?? CITY_COORDS[city]?.lat ?? 27.7172, coordsMap[city]?.lng ?? CITY_COORDS[city]?.lng ?? 85.324];

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-card">
      <MapContainer
        center={center as [number, number]}
        zoom={12}
        scrollWheelZoom={false}
        className="h-[420px] w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {grounds.map((ground) =>
          ground.latitude != null && ground.longitude != null ? (
            <Marker
              key={ground.id}
              position={[ground.latitude, ground.longitude]}
              icon={pricePinIcon(ground.basePrice ?? null)}
            >
              <Popup>
                <div className="min-w-[170px] space-y-1">
                  <Link to={`/grounds/${ground.id}`} className="block text-sm font-extrabold hover:text-primary">
                    {ground.name}
                  </Link>
                  {ground.basePrice != null && (
                    <p className="text-xs font-bold">From Rs {rs(ground.basePrice)} / hr</p>
                  )}
                  <Link to={`/grounds/${ground.id}`} className="inline-block text-xs font-bold text-primary">
                    View slots →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}

type TonightCell =
  | { state: 'available'; slotId: string }
  | { state: 'taken' }
  | { state: 'none' };

function cellForRange(slots: Slot[] | undefined, range: [number, number]): TonightCell {
  if (!Array.isArray(slots)) return { state: 'none' };
  const hourSlots = slots.filter((s) => {
    const hour = parseInt(s.startTime.split(':')[0], 10);
    return hour >= range[0] && hour < range[1];
  });
  if (hourSlots.length === 0) return { state: 'none' };
  const available = hourSlots.find((s) => s.status === 'available');
  if (available) return { state: 'available', slotId: available.id };
  return { state: 'taken' };
}

function TonightGrid({
  rows,
  highlightBucket,
  onCheckout,
  loading,
}: {
  rows: { ground: Ground; distanceKm: number | null; slots: Slot[] | undefined }[];
  highlightBucket: BucketValue;
  onCheckout: (groundId: string, slotId: string) => void;
  loading: boolean;
}) {
  const columns = BUCKETS.filter((b) => b.value !== 'ALL');

  return (
    <div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground backdrop-blur">
                  Ground
                </th>
                {columns.map((c) => (
                  <th
                    key={c.value}
                    className={cn(
                      'px-2 py-3 text-center text-[10px] font-extrabold uppercase tracking-normal transition-colors',
                      highlightBucket === c.value ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {highlightBucket === c.value ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5">{c.label}</span>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const img = firstGroundImage(row.ground);
                return (
                  <tr key={row.ground.id} className="border-b border-border last:border-0">
                    <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left">
                      <Link to={`/grounds/${row.ground.id}`} className="group flex min-w-0 items-center gap-2.5">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
                        )}
                        <span className="min-w-0">
                          <span className="block max-w-[11rem] truncate font-extrabold text-card-foreground transition-colors group-hover:text-primary">
                            {row.ground.name}
                          </span>
                          <span className="block text-[10px] font-semibold text-muted-foreground">
                            Rs {rs(row.ground.basePrice)}/hr
                            {row.distanceKm != null ? ` · ${row.distanceKm.toFixed(1)} km` : ''}
                          </span>
                        </span>
                      </Link>
                    </th>
                    {columns.map((c) => {
                      const range = c.value.split('-').map(Number) as [number, number];
                      const cell = cellForRange(row.slots, range);
                      if (cell.state === 'available') {
                        return (
                          <td key={c.value} className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => onCheckout(row.ground.id, cell.slotId)}
                              className="inline-flex min-w-14 items-center justify-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-2 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              Book
                            </button>
                          </td>
                        );
                      }
                      if (cell.state === 'taken') {
                        return (
                          <td key={c.value} className="px-2 py-3 text-center">
                            <span
                              title="Slot already booked"
                              className="inline-block h-8 w-full rounded-xl bg-muted pt-1.5 text-[10px] font-bold uppercase text-muted-foreground/70"
                            >
                              Taken
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={c.value} className="px-2 py-3 text-center">
                          <span className="inline-block h-8 w-full rounded-xl border border-dashed border-border pt-1.5 text-[10px] font-bold uppercase text-muted-foreground/50">
                            —
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-muted-foreground">
        {loading
          ? 'Loading tonight’s live availability…'
          : 'Tap a “Book” cell to reserve that slot instantly.'}
      </p>
    </div>
  );
}

export function CourtsSection({ onBook }: { onBook: (id: string) => void }) {
  const { city, coords } = useLocationCity();
  const navigate = useNavigate();
  const [bucket, setBucket] = useState<BucketValue>('ALL');
  const [view, setView] = useState<'list' | 'tonight' | 'map'>('list');

  const groundsQuery = useQuery({
    queryKey: ['grounds', 'home', city],
    queryFn: async () => {
      const res = await groundsAPI.getAll(city ? { city } : {});
      return res.data;
    },
    staleTime: 30_000,
  });

  const grounds = (groundsQuery.data?.grounds ?? []).slice(0, 6);

  // Per-ground tonight preview; keyed on bucket so a bucket change re-checks live availability.
  const slotQueries = useQueries({
    queries: grounds.map((g) => ({
      queryKey: ['slots-preview', g.id, bucket],
      queryFn: async () => {
        const res = await groundsAPI.getSlots(g.id, todayStr());
        return res.data as Slot[];
      },
      staleTime: 60_000,
    })),
  });

  const sortedByDistance = coords != null;
  const cards = grounds
    .map((ground, i) => ({
      ground,
      nextSlot: pickNextSlot(slotQueries[i]?.data),
      distanceKm:
        coords && ground.latitude != null && ground.longitude != null
          ? haversineKm(coords.lat, coords.lng, ground.latitude, ground.longitude)
          : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));

  const range = bucket === 'ALL' ? null : (bucket.split('-').map(Number) as [number, number]);
  const filtered = cards.filter((_, i) => inBucket(slotQueries[i]?.data, range));

  const mapMarkers = filtered.map(({ ground, distanceKm }) => ({ ...ground, distanceKm }));

  const nightRows = cards.map(({ ground, distanceKm }, i) => ({
    ground,
    distanceKm,
    slots: slotQueries[i]?.data as Slot[] | undefined,
  }));

  const handleCheckout = (groundId: string, slotId: string) => {
    navigate(`/grounds/${groundId}/book?date=${todayStr()}&slots=${slotId}`);
  };

  return (
    <section id="courts" aria-labelledby="courts-title" className="scroll-mt-20 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_auto] lg:items-baseline">
          <div>
            <p className="text-xs font-extrabold uppercase text-primary">Near you now</p>
            <h2 id="courts-title" className="mt-2 text-3xl font-extrabold md:text-4xl">
              Play tonight.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Top-rated courts with verified live availability{' '}
              {sortedByDistance ? 'near you' : city ? `in ${city}` : ''}.
            </p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/grounds">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Play tonight by hour">
            <span className="mr-1 text-[10px] font-extrabold uppercase text-muted-foreground">Play tonight</span>
            {BUCKETS.map((b) => (
              <button
                key={b.value}
                onClick={() => setBucket(b.value)}
                aria-pressed={bucket === b.value}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  bucket === b.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1" role="group" aria-label="View">
            <button
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                view === 'list' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              List
            </button>
            <button
              onClick={() => setView('tonight')}
              aria-pressed={view === 'tonight'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                view === 'tonight' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              Tonight
            </button>
            <button
              onClick={() => setView('map')}
              aria-pressed={view === 'map'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                view === 'map' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden />
              Map
            </button>
          </div>
        </div>

        {view === 'map' ? (
          <VenueMap grounds={mapMarkers} />
        ) : groundsQuery.isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : groundsQuery.isError ? (
          <div className="mt-8 rounded-2xl border border-border bg-muted py-12 text-center">
            <p className="font-bold text-foreground">Couldn't load courts right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => groundsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : view === 'tonight' ? (
          <TonightGrid
            rows={nightRows}
            highlightBucket={bucket}
            onCheckout={handleCheckout}
            loading={slotQueries.some((q) => q.isLoading)}
          />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ ground, nextSlot, distanceKm }) => (
              <VenueCard
                key={ground.id}
                venue={groundToVenue(ground, nextSlot, distanceKm)}
                onBook={onBook}
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Button variant="link" asChild>
            <Link to="/grounds">
              View all courts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}