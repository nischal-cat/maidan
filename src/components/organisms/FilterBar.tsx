import { Search } from 'lucide-react';
import { SPORTS } from '../../constants';
import { useCities } from '../../hooks/useCities';

export interface GroundFilters {
  city: string;
  date: string;
  search: string;
  sportType: string;
}

interface FilterBarProps {
  filters: GroundFilters;
  onChange: (filters: GroundFilters) => void;
}

const sportOptions = ['All Sports', ...SPORTS];

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const { cityNames } = useCities();
  const cityOptions = ['All Cities', ...cityNames];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-card sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="text"
          placeholder="Search grounds..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="min-h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.city}
          onChange={(e) => onChange({ ...filters, city: e.target.value })}
          className="min-h-12 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {cityOptions.map((city) => (
            <option key={city} value={city === 'All Cities' ? '' : city}>{city}</option>
          ))}
        </select>
        <select
          value={filters.sportType}
          onChange={(e) => onChange({ ...filters, sportType: e.target.value })}
          className="min-h-12 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground capitalize focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {sportOptions.map((sport) => (
            <option key={sport} value={sport === 'All Sports' ? '' : sport}>{sport === 'All Sports' ? sport : sport.charAt(0).toUpperCase() + sport.slice(1)}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value })}
          className="min-h-12 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
    </div>
  );
}
