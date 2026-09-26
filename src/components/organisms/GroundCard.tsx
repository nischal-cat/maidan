import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Star } from 'lucide-react';
import { groundsAPI } from '../../services/api';
import type { Ground } from '../../types';
import { firstGroundImage } from '../../lib/uploads';

interface GroundCardProps {
  ground: Ground;
  compact?: boolean;
}

interface TodaySlot {
  time: string;
  rawTime: string;
  available: boolean;
}

export default function GroundCard({ ground, compact = false }: GroundCardProps) {
  const navigate = useNavigate();
  const [todaySlots, setTodaySlots] = useState<TodaySlot[]>([]);
  const coverImage = firstGroundImage(ground);

  const { data: slotsData } = useQuery({
    queryKey: ['ground-slots-preview', ground.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await groundsAPI.getSlots(ground.id, today);
      return res.data;
    },
    enabled: !compact,
  });

  useEffect(() => {
    if (slotsData && !compact) {
      const eveningSlots = slotsData
        .filter((s: { startTime: string }) => {
          const hour = parseInt(s.startTime.split(':')[0]);
          return hour >= 17 && hour <= 20;
        })
        .map((s: { startTime: string; status: string }) => ({
          time: formatTime(s.startTime),
          rawTime: s.startTime.slice(0, 5),
          available: s.status === 'available',
        }));
      setTodaySlots(eveningSlots.slice(0, 4));
    }
  }, [slotsData, compact]);

  const formatTime = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  if (compact) {
    return (
      <Link
        to={`/grounds/${ground.id}`}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent"
      >
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {coverImage ? (
            <img src={coverImage} alt={ground.name} className="h-full w-full object-cover" />
          ) : (
            <svg className="h-7 w-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-extrabold text-card-foreground group-hover:text-primary">{ground.name}</h4>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{ground.address}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-extrabold text-primary">Rs {ground.basePrice}</span>
            <span className="text-xs font-medium text-muted-foreground">/hr</span>
            {ground.rating && (
              <span className="flex items-center gap-0.5 text-xs">
                <Star className="h-3 w-3 fill-highlight text-highlight" aria-hidden />
                <span className="font-bold text-foreground">{ground.rating}</span>
              </span>
            )}
          </div>
        </div>
        <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform duration-300 hover:-translate-y-1">
      <div className="relative h-48 overflow-hidden bg-muted">
        {coverImage ? (
          <img src={coverImage} alt={`${ground.name} futsal court`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-strong text-surface-strong-foreground">
            <svg className="h-20 w-20 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
        )}
        {ground.rating != null && ground.rating > 0 ? (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-highlight text-highlight" aria-hidden />
            <span className="text-xs font-bold text-foreground">{ground.rating}</span>
          </div>
        ) : (
          <div className="absolute left-3 top-3 rounded-full bg-highlight px-2.5 py-1 text-xs font-extrabold text-highlight-foreground">
            New
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-card-foreground group-hover:text-primary">{ground.name}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <p className="truncate text-sm text-muted-foreground">{ground.address}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-extrabold text-primary">Rs {ground.basePrice}</div>
            <div className="text-xs font-medium text-muted-foreground"> / hr</div>
          </div>
        </div>

        {todaySlots.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2.5 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">
              Evening Slots
            </div>
            <div className="flex gap-2">
              {todaySlots.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => navigate(`/grounds/${ground.id}?date=${new Date().toISOString().split('T')[0]}&time=${slot.rawTime}`)}
                  className={`flex flex-1 flex-col items-center rounded-xl border px-2 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    slot.available
                      ? 'border-primary/30 bg-primary/10 text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground'
                      : 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60'
                  }`}
                >
                  <span className="text-xs font-extrabold">{slot.time}</span>
                  <span className={`mt-0.5 text-[10px] font-semibold ${slot.available ? '' : 'text-muted-foreground'}`}>
                    {slot.available ? 'Open' : 'Booked'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Link
          to={`/grounds/${ground.id}`}
          className="mt-4 block w-full rounded-full border border-border bg-card py-2.5 text-center text-sm font-bold text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View All Slots
        </Link>
      </div>
    </article>
  );
}
