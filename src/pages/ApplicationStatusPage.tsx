import { Link } from 'react-router-dom';
import { Clock3, XCircle, Store, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';

export default function ApplicationStatusPage() {
  const { user, logout } = useAuth();
  const status = user?.kycStatus ?? 'none';

  const title =
    status === 'declined'
      ? 'Application Declined'
      : status === 'pending'
        ? 'Application Under Review'
        : 'Become a Ground Owner';

  const message =
    status === 'declined'
      ? 'Your seller application was not approved. You can review the reason and re-apply with a corrected document.'
      : status === 'pending'
        ? 'We are reviewing your business details and documents. Your account is locked for selling until an admin approves it.'
        : 'You have not submitted a seller application yet. Submit one to start listing grounds.';

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <div
            className={`mx-auto mb-4 inline-flex items-center justify-center rounded-2xl p-4 ${
              status === 'declined' ? 'bg-destructive/10' : status === 'pending' ? 'bg-amber-500/10' : 'bg-highlight/15'
            }`}
          >
            {status === 'declined' ? (
              <XCircle className="h-8 w-8 text-destructive" aria-hidden />
            ) : status === 'pending' ? (
              <Clock3 className="h-8 w-8 text-amber-500" aria-hidden />
            ) : (
              <Store className="h-8 w-8 text-highlight" aria-hidden />
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>

          {status === 'declined' && user?.kycNote && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-left text-sm text-destructive">
              <span className="font-bold">Admin note:</span> {user.kycNote}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {status === 'none' && (
              <Link to="/register/seller">
                <Button className="w-full">Submit Application</Button>
              </Link>
            )}
            {(status === 'pending' || status === 'declined') && (
              <Link to="/owner/kyc">
                <Button className="w-full" variant="outline">
                  <FileText className="mr-2 h-4 w-4" aria-hidden />
                  {status === 'declined' ? 'Re-submit Documents' : 'View Application Details'}
                </Button>
              </Link>
            )}
            <Button variant="ghost" onClick={() => logout()} className="w-full">
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Sign Out
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Questions? Contact <span className="font-bold text-foreground">hello@maidan.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}