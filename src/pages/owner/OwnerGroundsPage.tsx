import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOwnerGrounds } from '../../hooks/useOwnerGrounds';
import { usePageTitle } from '../../hooks/usePageTitle';
import { OwnerGroundCard } from '../../components/owner/OwnerGroundCard';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { OwnerEmptyState, ErrorState } from '../../components/owner/OwnerEmptyState';

export default function OwnerGroundsPage() {
  usePageTitle('My Grounds · Owner · Maidan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const ownerId = user?.role === 'owner' ? user.id : undefined;
  const { data, isLoading, isError, refetch } = useOwnerGrounds(ownerId);
  const grounds = data ?? [];

  if (isLoading) return <OwnerSkeleton variant="cards" />;
  if (isError) return <ErrorState onRetry={refetch} message="Could not load your grounds." />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">My grounds</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {grounds.length} ground{grounds.length === 1 ? '' : 's'} selling on Maidan
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/owner/grounds/new')}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add Ground
        </button>
      </header>

      {grounds.length === 0 ? (
        <OwnerEmptyState
          title="No grounds yet"
          description="Add your ground to start accepting bookings."
          action={
            <button
              type="button"
              onClick={() => navigate('/owner/grounds/new')}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Add your first ground
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grounds.map((g) => (
            <OwnerGroundCard key={g.id} ground={g} onOpen={() => navigate(`/owner/grounds/${g.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}