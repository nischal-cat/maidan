import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import Modal from '../../components/organisms/Modal';
import { kycStatusVariant } from '../../constants/status';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

export default function AdminSellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineNote, setDeclineNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-seller', id],
    queryFn: async () => (await adminAPI.getSeller(id!)).data.seller,
    enabled: !!id,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ status, note }: { status: 'approved' | 'declined' | 'pending'; note?: string }) =>
      adminAPI.reviewKyc(id!, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seller', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
      setDeclineOpen(false);
      setDeclineNote('');
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-bold text-card-foreground">Seller not found.</p>
        <Link to="/admin/sellers" className="mt-2 inline-block text-sm font-bold text-primary underline underline-offset-2">Back to sellers</Link>
      </div>
    );
  }

  const s = data;

  return (
          <div className="space-y-6">
        <div>
          <Link to="/admin/sellers" className="flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-2">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All sellers
          </Link>
          <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-extrabold text-foreground">
            {s.businessName || s.name}
            <StatusBadge variant={kycStatusVariant[s.kycStatus] || 'default'}>{s.kycStatus}</StatusBadge>
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Seller KYC review</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Business</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Business name</dt>
                <dd className="font-bold text-card-foreground">{s.businessName || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Business types</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {s.businessType?.length ? (
                    s.businessType.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{t}</span>
                    ))
                  ) : (
                    <span className="font-semibold text-card-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">City</dt>
                <dd className="font-bold text-card-foreground">{s.businessCity || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Address</dt>
                <dd className="text-right font-semibold text-card-foreground">{s.businessAddress || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Registration no.</dt>
                <dd className="font-mono text-xs font-bold text-card-foreground">{s.registrationNumber || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Business contact</dt>
                <dd className="font-bold text-card-foreground">{s.businessContact || '—'}</dd>
              </div>
              {s.businessDescription && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Description</dt>
                  <dd className="text-right font-semibold text-card-foreground">{s.businessDescription}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Listed grounds</dt>
                <dd className="font-bold text-card-foreground">{s.groundCount}</dd>
              </div>
            </dl>
          </Card>

          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Contact</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Name</dt>
                  <dd className="font-bold text-card-foreground">{s.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Email</dt>
                  <dd className="truncate font-semibold text-card-foreground">{s.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Phone</dt>
                  <dd className="font-semibold text-card-foreground">{s.phone}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Joined</dt>
                  <dd className="font-bold text-card-foreground">{new Date(s.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Registration document</h2>
              {s.kycDocumentUrl ? (
                <a
                  href={`${API_ROOT}${s.kycDocumentUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  View document
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">No document uploaded.</p>
              )}
              {s.kycNote && (
                <p className="mt-3 rounded-xl bg-muted p-3 text-sm font-semibold text-card-foreground">
                  Previous admin note: {s.kycNote}
                </p>
              )}
            </Card>
          </div>
        </div>

        <Card>
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Decision</h2>
          <div className="flex flex-wrap items-center gap-3">
            {s.kycStatus !== 'approved' && (
              <Button
                variant="primary"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ status: 'approved' })}
              >
                {reviewMutation.isPending ? 'Saving...' : 'Approve seller'}
              </Button>
            )}
            {s.kycStatus !== 'declined' && (
              <Button variant="destructive" disabled={reviewMutation.isPending} onClick={() => setDeclineOpen(true)}>
                Decline
              </Button>
            )}
            {s.kycStatus !== 'pending' && (
              <Button
                variant="outline"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ status: 'pending' })}
              >
                Move back to pending
              </Button>
            )}
            {!s.kycDocumentUrl && (
              <span className="text-sm font-semibold text-muted-foreground">
                No document to review — verify contact details before approving.
              </span>
            )}
          </div>
        </Card>

        <Modal open={declineOpen} onClose={() => { setDeclineOpen(false); setDeclineNote(''); }} title="Decline seller verification">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Declining blocks <span className="font-bold text-card-foreground">{s.businessName || s.name}</span> from listing
              grounds until re-approved.
            </p>
            <textarea
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              placeholder="Reason shown to the seller (optional)..."
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => { setDeclineOpen(false); setDeclineNote(''); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ status: 'declined', note: declineNote.trim() || undefined })}
              >
                Decline seller
              </Button>
            </div>
          </div>
        </Modal>
      </div>
  );
}