import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groundsAPI } from '../services/api';
import GroundCard from '../components/organisms/GroundCard';
import FilterBar from '../components/organisms/FilterBar';
import { Spinner } from '../components/ui/spinner';
import type { GroundFilters } from '../components/organisms/FilterBar';

export default function GroundsListingPage() {
  const [filters, setFilters] = useState<GroundFilters>({ city: '', date: '', search: '', sportType: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['grounds', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.city) params.city = filters.city;
      if (filters.date) params.date = filters.date;
      if (filters.search) params.search = filters.search;
      if (filters.sportType) params.sportType = filters.sportType;
      const res = await groundsAPI.getAll(params);
      return res.data;
    },
    enabled: true,
  });

  const grounds = data?.grounds || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase text-primary">Near you now</p>
        <h1 className="mt-2 text-3xl font-extrabold text-foreground">Find a futsal ground</h1>
        <p className="mt-1 text-muted-foreground">
          {grounds.length} ground{grounds.length !== 1 ? 's' : ''} available
        </p>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="mt-6">
        {isLoading ? (
          <div className="py-16"><Spinner size="lg" /></div>
        ) : grounds.length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted py-16 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg font-extrabold text-foreground">No grounds found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {grounds.map((ground) => (
              <GroundCard key={ground.id} ground={ground} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
