import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Clock3, LocateFixed, MapPin, Search, ShieldCheck, Star, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { groundsAPI } from '../../services/api';
import { useLocationCity } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { ASSETS } from '../../lib/assets';
import { useCities } from '../../hooks/useCities';

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const isoForOffset = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const DATE_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    iso: isoForOffset(i),
    label:
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  };
});

const TIME_OPTIONS = [
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

function SelectField({
  label,
  value,
  onChange,
  options,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-bold text-foreground outline-none [&>option]:bg-card"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof MapPin;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-surface-strong/70 px-3.5 py-2 text-xs font-bold text-surface-strong-foreground backdrop-blur transition-colors hover:bg-surface-strong/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
      {label}
    </button>
  );
}

export function Hero() {
  const { city, setCity, detectLocation } = useLocationCity();
  const { cityNames } = useCities();
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name.split(' ')[0];

  const [date, setDate] = useState(DATE_OPTIONS[0].iso);
  const [time, setTime] = useState('19:00');

  const { data: availableToday, isLoading: countLoading } = useQuery({
    queryKey: ['available-today', city],
    queryFn: async () => {
      const res = await groundsAPI.getAvailableToday(city || undefined);
      return res.data;
    },
    staleTime: 30_000,
  });

  const count = Array.isArray(availableToday) ? availableToday.length : 0;
  const pillLabel = countLoading
    ? 'Courts available tonight'
    : `${count} court${count === 1 ? '' : 's'} available tonight`;

  const search = () => {
    const params = new URLSearchParams({ date, time, city });
    navigate(`/grounds?${params.toString()}`);
  };

  const actions: { icon: typeof MapPin; label: string; onClick: () => void }[] = [
    {
      icon: LocateFixed,
      label: 'Near Me',
      onClick: async () => {
        await detectLocation();
        navigate('/grounds');
      },
    },
    { icon: Zap, label: 'Available Now', onClick: () => navigate('/grounds?availability=now') },
    {
      icon: Clock3,
      label: 'Tonight',
      onClick: () => navigate(`/grounds?date=${isoForOffset(0)}&timeFrom=17&timeTo=23`),
    },
    { icon: Banknote, label: 'Under Rs 1,000', onClick: () => navigate('/grounds?maxPrice=1000') },
  ];

  return (
    <section className="relative isolate flex min-h-[520px] items-center overflow-hidden bg-surface-strong text-surface-strong-foreground md:min-h-[620px]">
      <img
        src={ASSETS.hero}
        alt="Players enjoying a game on a modern indoor futsal court"
        width={1600}
        height={1000}
        fetchPriority="high"
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(90deg, var(--surface-strong) 0%, color-mix(in oklab, var(--surface-strong) 74%, transparent) 48%, transparent 100%)',
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-24">
        <div className="max-w-3xl">
          {user ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-surface-strong/70 px-3 py-1.5 text-xs font-bold uppercase text-primary backdrop-blur">
              <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
              {timeOfDayGreeting()}, {firstName}
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-surface-strong/70 px-3 py-1.5 text-xs font-bold uppercase text-primary backdrop-blur">
              <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
              {pillLabel}
            </p>
          )}

          <h1 className="mt-6 max-w-[34rem] text-5xl font-extrabold leading-[1.04] md:text-7xl">
            Find your court. Play tonight.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 opacity-75 md:text-lg">
            Discover trusted futsal courts, see live slots, and lock in your pitch in under a minute.
          </p>

          <div className="mt-8 rounded-2xl bg-background p-2 text-card-foreground shadow-card">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
              <div className="col-span-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 sm:col-span-1">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <label htmlFor="hero-city" className="sr-only">City</label>
                <select
                  id="hero-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-bold text-foreground outline-none [&>option]:bg-card"
                >
                  {cityNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <SelectField id="hero-date" label="Date" value={date} onChange={setDate} options={DATE_OPTIONS.map((d) => ({ value: d.iso, label: d.label }))} />
              <SelectField id="hero-time" label="Time" value={time} onChange={setTime} options={TIME_OPTIONS} />
              <Button onClick={search} className="col-span-2 sm:col-span-1">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {actions.map((a) => (
              <QuickAction key={a.label} icon={a.icon} label={a.label} onClick={a.onClick} />
            ))}
          </div>

          <ul className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold opacity-75">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure payment
            </li>
            <li className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 fill-highlight text-highlight" />
              Instant confirmation
            </li>
            <li className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-highlight text-highlight" />
              4.9 player rating
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}