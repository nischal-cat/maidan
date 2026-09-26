import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Clock } from 'lucide-react';
import { groundsAPI } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import { OwnerSkeleton } from '../../components/owner/OwnerSkeleton';
import { OwnerMetricCard } from '../../components/owner/OwnerMetricCard';
import { ErrorState } from '../../components/owner/OwnerEmptyState';
import GroundEditor from '../../components/owner/GroundEditor';
import { formatNPR, formatTimeRange } from '../../lib/dates';

export default function OwnerGroundDetailPage() {
  usePageTitle('Ground · Owner · Maidan');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: ground, isLoading, isError, refetch } = useQuery({
    queryKey: ['ground', id],
    queryFn: async () => {
      const res = await groundsAPI.getById(id!);
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading || !ground) return <OwnerSkeleton variant="detail" />;
  if (isError) return <ErrorState onRetry={refetch} message="Could not load this ground." />;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/owner/grounds')}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> My grounds
      </button>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{ground.name}</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {ground.city} · {ground.contact || 'No contact added'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/owner/slots?ground=${ground.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary-foreground hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Clock className="h-4 w-4" aria-hidden /> Slots
          </Link>
          <Link
            to={`/owner/bookings?ground=${ground.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClipboardList className="h-4 w-4" aria-hidden /> Bookings
          </Link>
        </div>
      </header>

      <section aria-label="Ground summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OwnerMetricCard label="Base price" value={formatNPR(ground.basePrice)} hint="Per hour" />
        <OwnerMetricCard label="Peak price" value={ground.peakPrice ? formatNPR(ground.peakPrice) : '1.3× base'} hint="Peak hours 5pm–8pm" />
        <OwnerMetricCard label="Hours" value={formatTimeRange(ground.operatingHoursStart, ground.operatingHoursEnd)} hint="Operating hours" />
        <OwnerMetricCard
          label="Status"
          value={ground.isActive === false ? 'Hidden' : 'Active'}
          hint={ground.isActive === false ? 'Not shown to players' : 'Visible & bookable'}
          tone={ground.isActive === false ? 'neutral' : 'primary'}
        />
      </section>

      <section aria-label="Ground details">
        <h2 className="mb-3 text-base font-extrabold text-foreground">Edit ground</h2>
        <GroundEditor initial={ground} submitLabel="Save changes" onSaved={() => navigate('/owner/grounds')} onDeleted={() => navigate('/owner/grounds')} />
      </section>
    </div>
  );
}