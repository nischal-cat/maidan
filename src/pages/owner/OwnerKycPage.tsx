import { useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/status-badge';
import { resolveUploadUrl } from '../../lib/uploads';
import { kycStatusVariant } from '../../constants/status';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function OwnerKycPage() {
  usePageTitle('Verification · Owner · Maidan');
  const { user, refreshUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);

  const status = user?.kycStatus ?? 'none';
  const documentUrl = user?.kycDocumentUrl ?? null;

  const statusText: Record<string, string> = {
    none: "You haven't submitted a verification document yet.",
    pending: 'Your documents are under review. You can list grounds once an admin approves them.',
    declined: 'Your verification was declined. Update your document and resubmit to reapply.',
    approved: 'You are verified and can list grounds.',
  };

  const pickFile = (f: File | undefined | null) => {
    setDone(false);
    setClientError('');
    if (!f) return setFile(null);
    if (!ALLOWED_TYPES.includes(f.type)) return setClientError('Only PDF, JPG, PNG or WEBP documents are allowed.');
    if (f.size > MAX_FILE_SIZE) return setClientError('Document must be 5 MB or smaller.');
    setFile(f);
  };

  const handleSubmit = async () => {
    setClientError('');
    if (!file) return setClientError('Please choose a document to upload.');
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('document', file);
      await authAPI.submitKyc(body);
      await refreshUser();
      setDone(true);
      setFile(null);
    } catch (err: any) {
      setClientError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Seller verification</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Submit your business document to unlock listing grounds.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          Refresh status
        </Button>
      </header>

      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge variant={kycStatusVariant[status] || 'default'}>{status}</StatusBadge>
            <p className="text-sm font-semibold text-card-foreground">{statusText[status]}</p>
          </div>
          {status === 'declined' && user?.kycNote && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              Reason: {user.kycNote}
            </p>
          )}
          {documentUrl && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Submitted document:
              <a
                href={resolveUploadUrl(documentUrl) || ''}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent"
              >
                View doc
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-extrabold text-card-foreground">
          {status === 'approved' ? 'Update verification documents' : 'Submit verification documents'}
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="kyc-doc" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">
              Business registration document
            </label>
            {file && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <span className="truncate text-sm font-bold text-card-foreground">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove selected document"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => document.getElementById('kyc-doc')?.click()}
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
              <span className="text-sm font-bold text-card-foreground">{file ? 'Change document' : 'Choose a document'}</span>
              <span className="text-xs font-semibold text-muted-foreground">PDF, JPG, PNG or WEBP · up to 5 MB</span>
            </button>
            <input
              id="kyc-doc"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Need help? Contact <span className="font-bold text-foreground">maidan@maidan.com.np</span>.
          </p>
          {clientError && <p className="text-sm font-semibold text-destructive">{clientError}</p>}
          {done && <p className="text-sm font-bold text-primary">Submitted! An admin will review your documents shortly.</p>}
          <div className="flex justify-end gap-3">
            <Button onClick={handleSubmit} disabled={submitting || !file}>
              {submitting ? 'Uploading…' : 'Submit for review'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}