import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Search } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import Modal from '../../components/organisms/Modal';
import { kycStatusVariant } from '../../constants/status';
import { resolveUploadUrl } from '../../lib/uploads';

type StatusFilter = 'all' | 'pending' | 'approved' | 'declined';

interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string | null;
  businessType: string[];
  businessCity: string | null;
  businessAddress: string | null;
  businessContact: string | null;
  registrationNumber: string | null;
  businessDescription: string | null;
  kycStatus: 'none' | 'pending' | 'approved' | 'declined';
  kycDocumentUrl: string | null;
  kycNote: string | null;
  createdAt: string;
  groundCount: number;
}

export default function AdminSellersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [declineTarget, setDeclineTarget] = useState<Seller | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  const perPage = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', statusFilter, search, page],
    queryFn: async () => {
      const params: { status?: string; search?: string; page?: number; limit?: number } = { page, limit: perPage };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await adminAPI.getSellers(params);
      return res.data;
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / perPage));

  const changeFilter = (next: () => void) => {
    setPage(1);
    next();
  };

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'approved' | 'declined'; note?: string }) =>
      adminAPI.reviewKyc(id, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
      setDeclineTarget(null);
      setDeclineNote('');
    },
  });

  const sellers: Seller[] = data?.sellers || [];

  return (
          <div className="space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Verification</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Seller KYC</h1>
          <p className="mt-1 text-muted-foreground">
            Review registration documents before sellers can list grounds.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {(['pending', 'all', 'approved', 'declined'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => changeFilter(() => setStatusFilter(s))}
                aria-current={statusFilter === s ? 'true' : undefined}
                className={`min-h-9 rounded-full px-3 text-xs font-bold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => changeFilter(() => setSearch(e.target.value))}
              placeholder="Search seller or business..."
              aria-label="Search sellers"
              className="min-h-12 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card padding={false}>
            <div className="space-y-3 p-4 md:hidden">
              {sellers.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-card-foreground">{s.businessName || s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.name}</p>
                    </div>
                    <StatusBadge variant={kycStatusVariant[s.kycStatus] || 'default'}>{s.kycStatus}</StatusBadge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.businessType?.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{t}</span>
                    ))}
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <p className="truncate">{s.email}</p>
                    <p>{s.phone}</p>
                    {s.businessCity && <p>City: {s.businessCity}</p>}
                    {s.registrationNumber && <p>Reg: {s.registrationNumber}</p>}
                    {s.businessContact && <p>Business: {s.businessContact}</p>}
                  </div>
                  {s.kycNote && <p className="mt-2 text-xs italic text-destructive">Note: {s.kycNote}</p>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-extrabold text-primary">{s.groundCount} ground{s.groundCount === 1 ? '' : 's'}</span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/admin/sellers/${s.id}`}>Details</Link>
                      </Button>
                      {s.kycStatus !== 'approved' && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: s.id, status: 'approved' })}
                        >
                          Approve
                        </Button>
                      )}
                      {s.kycStatus !== 'declined' && (
                        <Button variant="destructive" size="sm" onClick={() => setDeclineTarget(s)}>
                          Decline
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Seller</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Contact</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Grounds</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Document</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-card-foreground">{s.businessName || s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {s.businessType?.map((t) => (
                            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{t}</span>
                          ))}
                        </div>
                        {s.businessCity && <p className="mt-1 text-xs text-muted-foreground">City: {s.businessCity}</p>}
                        {s.registrationNumber && <p className="text-xs text-muted-foreground">Reg: {s.registrationNumber}</p>}
                        {s.businessAddress && <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">Address: {s.businessAddress}</p>}
                        {s.kycNote && <p className="mt-1 text-xs italic text-destructive">Note: {s.kycNote}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <p>{s.email}</p>
                        <p className="text-xs">{s.phone}</p>
                        {s.businessContact && <p className="text-xs">Business: {s.businessContact}</p>}
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">{s.groundCount}</td>
                      <td className="px-4 py-3">
                        {s.kycDocumentUrl ? (
                          <a
                            href={resolveUploadUrl(s.kycDocumentUrl) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                          >
                            View doc
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not uploaded</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={kycStatusVariant[s.kycStatus] || 'default'}>{s.kycStatus}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="mr-2">
                          <Link to={`/admin/sellers/${s.id}`}>Details</Link>
                        </Button>
                        {s.kycStatus !== 'approved' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="mr-2"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: s.id, status: 'approved' })}
                          >
                            Approve
                          </Button>
                        )}
                        {s.kycStatus !== 'declined' && (
                          <Button variant="destructive" size="sm" onClick={() => setDeclineTarget(s)}>
                            Decline
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sellers.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">No sellers match this filter.</div>
            )}
            {(data?.total ?? 0) > perPage && (
              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <span className="text-sm font-semibold text-muted-foreground">
                  Page {page} of {totalPages} &middot; {data?.total ?? 0} sellers
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <Modal open={!!declineTarget} onClose={() => { setDeclineTarget(null); setDeclineNote(''); }} title="Decline seller verification">
          {declineTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Declining blocks <span className="font-bold text-card-foreground">{declineTarget.businessName || declineTarget.name}</span> from
                listing grounds until re-approved.
              </p>
              <textarea
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                placeholder="Reason shown to the seller (optional)..."
                rows={3}
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => { setDeclineTarget(null); setDeclineNote(''); }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: declineTarget.id, status: 'declined', note: declineNote.trim() || undefined })}
                >
                  Decline seller
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
  );
}
