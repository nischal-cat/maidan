import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';
import GroundEditor from '../../components/owner/GroundEditor';

export default function OwnerNewGroundPage() {
  usePageTitle('Add Ground · Owner · Maidan');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/owner/grounds')}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> My grounds
      </button>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Add ground</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Slots are generated automatically from your operating hours after you save.
        </p>
      </header>

      <GroundEditor submitLabel="Create ground" onSaved={() => navigate('/owner/grounds')} />
    </div>
  );
}