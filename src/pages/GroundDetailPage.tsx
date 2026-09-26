import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Navigation, Phone, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { groundsAPI } from '../services/api';
import SlotGrid from '../components/organisms/SlotGrid';
import { RatingWidget } from '../components/ground/RatingWidget';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { cn } from '../lib/utils';
import { encodeReturnTo, buildBatchBookingReturnTo } from '../lib/returnTo';
import type { Slot, Ground } from '../types';
import { addRecentGround } from '../lib/recent';
import { resolveUploadUrl } from '../lib/uploads';

const PENDING_BOOKING_KEY = 'maidan_pending_booking';
const DRAFT_TTL_MS = 15 * 60 * 1000;

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const mapQuery = (ground: Ground) =>
  ground.latitude != null && ground.longitude != null
    ? `${ground.latitude},${ground.longitude}`
    : `${ground.address}, ${ground.city}`;

const embedUrl = (ground: Ground) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(ground))}&z=16&output=embed`;

const directionsUrl = (ground: Ground) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(ground))}`;

const mapsUrl = (ground: Ground) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(ground))}`;

const DATE_STRIP = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    iso: localIso(d),
    label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
  };
});

export default function GroundDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const autoSelectTime = searchParams.get('time');

  const [selectedPhoto, setSelectedPhoto] = useState(0);

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_BOOKING_KEY);
    if (!pending) return;
    try {
      const data = JSON.parse(pending);
      localStorage.removeItem(PENDING_BOOKING_KEY);
      const stale = data.ts == null || Date.now() - data.ts > DRAFT_TTL_MS;
      if (!stale && data.groundId === id && Array.isArray(data.slotIds) && data.slotIds.length > 0) {
        navigate(`/grounds/${id}/book?date=${data.date}&slots=${data.slotIds.join(',')}`);
      }
    } catch {
      // ignore malformed draft
    }
  }, [user, id, navigate]);

  const { data: groundData } = useQuery({
    queryKey: ['ground', id],
    queryFn: async () => {
      const res = await groundsAPI.getById(id!);
      return res.data;
    },
  });

  const { data: apiSlots, isLoading } = useQuery({
    queryKey: ['slots', id, selectedDate],
    queryFn: async () => {
      const res = await groundsAPI.getSlots(id!, selectedDate);
      return res.data;
    },
  });

  const ground: Ground | undefined = groundData;
  const slots: Slot[] = useMemo(() => apiSlots || [], [apiSlots]);

  useEffect(() => {
    if (ground) {
      addRecentGround({
        id: ground.id,
        name: ground.name,
        city: ground.city,
        address: ground.address,
        basePrice: ground.basePrice,
        rating: ground.rating ?? null,
        imageUrl: ground.imageUrl ?? null,
        gallery: ground.gallery ?? null,
      });
    }
  }, [ground]);

  // Auto-select slot from URL time param (e.g., from homepage slot click)
  useEffect(() => {
    if (autoSelectTime && slots.length > 0 && selectedSlots.length === 0) {
      const match = slots.find(
        (s) => s.startTime.startsWith(autoSelectTime) && s.status === 'available'
      );
      if (match) {
        setSelectedSlots([match]);
        setTimeout(() => {
          const el = document.getElementById(`slot-${match.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [autoSelectTime, slots, selectedSlots.length]);

  const toggleSlot = (slot: Slot) => {
    setSelectedSlots((prev) =>
      prev.some((s) => s.id === slot.id)
        ? prev.filter((s) => s.id !== slot.id)
        : prev.length >= 6
          ? prev
          : [...prev, slot]
    );
  };

  const handleContinue = () => {
    if (selectedSlots.length === 0) return;
    const slotIds = selectedSlots.map((s) => s.id);
    const returnTo = buildBatchBookingReturnTo(id!, selectedDate, slotIds);

    if (!user) {
      localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({
        groundId: id,
        groundName: ground?.name,
        date: selectedDate,
        slotIds,
        totalPrice: selectedSlots.reduce((sum, s) => sum + Number(s.price), 0),
        ts: Date.now(),
      }));
      navigate(`/login?returnTo=${encodeReturnTo(returnTo)}`);
      return;
    }

    navigate(returnTo);
  };

  const totalPrice = selectedSlots.reduce((sum, s) => sum + Number(s.price), 0);
  const minDate = format(new Date(), 'yyyy-MM-dd');
  const maxDate = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to grounds
      </button>

      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="font-semibold transition-colors hover:text-primary">Home</Link>
        <span>/</span>
        <Link to="/grounds" className="font-semibold transition-colors hover:text-primary">Grounds</Link>
        <span>/</span>
        <span className="font-bold text-foreground">{ground?.name || 'Loading...'}</span>
      </nav>

      {ground && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {/* Photo gallery */}
          {(() => {
            const photos = [...new Set([ground.imageUrl, ...(ground.gallery ?? [])].filter(Boolean) as string[])]
              .map((u) => resolveUploadUrl(u))
              .filter((u): u is string => u !== null);
            return (
              <div>
                <div className="relative aspect-[16/9] w-full bg-surface-strong">
                  {photos.length > 0 ? (
                    <img
                      src={photos[selectedPhoto] ?? photos[0]}
                      alt={`${ground.name} photo ${selectedPhoto + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-surface-strong-foreground opacity-40">
                      <svg className="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                    </div>
                  )}
                  {ground.rating != null && ground.rating > 0 ? (
                    <span className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-sm font-bold text-foreground backdrop-blur">
                      <svg className="h-4 w-4 fill-highlight text-highlight" viewBox="0 0 20 20" aria-hidden>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {ground.rating}
                    </span>
                  ) : (
                    <span className="absolute left-4 top-4 rounded-full bg-highlight px-3 py-1.5 text-sm font-extrabold text-highlight-foreground backdrop-blur">
                      New
                    </span>
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-3">
                    {photos.map((photo, i) => (
                      <button
                        key={`${photo}-${i}`}
                        type="button"
                        onClick={() => setSelectedPhoto(i)}
                        aria-label={`Show photo ${i + 1}`}
                        className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          i === selectedPhoto ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="p-6">
              <h1 className="text-3xl font-extrabold text-card-foreground">{ground.name}</h1>
              <p className="mt-1 text-muted-foreground">{ground.address}, {ground.city}</p>
              <p className="mt-2 text-muted-foreground">{ground.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-extrabold text-primary">Rs {ground.basePrice}/hr</span>
                {ground.peakPrice && <span className="text-sm font-semibold text-highlight-foreground">Peak: Rs {ground.peakPrice}/hr</span>}
                {ground.rating && (
                  <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                    <svg className="h-4 w-4 fill-highlight text-highlight" viewBox="0 0 20 20" aria-hidden>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {ground.rating}
                    <span className="font-semibold text-muted-foreground">
                      ({ground.ratingCount ?? 0})
                    </span>
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{ground.contact}</span>
                <a href={`tel:${ground.contact}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary hover:bg-primary/20">
                  <Phone className="h-3.5 w-3.5" />
                  Call now
                </a>
              </div>
          </div>
        </div>
      )}

      {ground && <RatingWidget groundId={ground.id} />}

      {ground && (ground.address || (ground.latitude != null && ground.longitude != null)) && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Location &amp; directions</h2>
                  <p className="mt-1 font-bold text-card-foreground">{ground.address}, {ground.city}</p>
                </div>
              </div>
              <a
                href={directionsUrl(ground)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Get directions
              </a>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <iframe
                title={`Map for ${ground.name}`}
                src={embedUrl(ground)}
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <a
              href={mapsUrl(ground)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-bold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Select date</h2>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Pick a date">
          {DATE_STRIP.map((day) => (
            <button
              key={day.iso}
              type="button"
              onClick={() => { setSelectedDate(day.iso); setSelectedSlots([]); }}
              aria-pressed={selectedDate === day.iso}
              className={cn(
                'flex min-w-[76px] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selectedDate === day.iso
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/40'
              )}
            >
              <span className={cn('text-[10px] font-extrabold uppercase', selectedDate === day.iso ? 'text-primary' : 'text-muted-foreground')}>
                {day.label}
              </span>
              <span className={cn('mt-0.5 text-lg font-extrabold leading-none', selectedDate === day.iso ? 'text-primary' : 'text-foreground')}>
                {day.day}
              </span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{day.month}</span>
            </button>
          ))}
        </div>
        <input
          id="detail-date"
          type="date"
          value={selectedDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlots([]); }}
          className="mt-3 min-h-11 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-primary/30 bg-primary/10" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-border bg-muted" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-destructive/20 bg-destructive/10" />
          <span>Closed</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Pick 1 slot, or up to 6 slots for one online payment</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <SlotGrid
          slots={slots}
          selectedSlotIds={selectedSlots.map((s) => s.id)}
          onToggleSlot={toggleSlot}
          maxSelectable={6}
          date={selectedDate}
        />
      )}

      {selectedSlots.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-border bg-card/95 p-4 shadow-card backdrop-blur">
            <div className="text-sm">
              <p className="font-extrabold text-card-foreground">
                {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} selected
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {selectedDate} &middot; Rs {totalPrice.toLocaleString()}
              </p>
            </div>
            <Button variant="primary" className="shrink-0" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}