import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { roleHome } from '../constants';
import { safeReturnTo } from '../lib/returnTo';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import OtpVerification from '../components/organisms/OtpVerification';

function Divider() {
  return (
    <div className="flex items-center gap-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function CompleteSignupPage() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [attachError, setAttachError] = useState('');
  const [waitingOtp, setWaitingOtp] = useState(false);

  const returnTo = safeReturnTo((location.state as { returnTo?: string } | null)?.returnTo ?? undefined);
  const target = returnTo !== '/' ? returnTo : roleHome(user?.role);

  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.phone) {
    return <Navigate to={target} replace />;
  }

  const handleAttachPhone = async () => {
    setAttachError('');
    try {
      await authAPI.addPhone(phone);
      setWaitingOtp(true);
    } catch (err: any) {
      setAttachError(err.response?.data?.message || 'Failed to send verification code.');
    }
  };

  const handlePhoneVerified = async () => {
    await refreshUser();
    navigate(target, { replace: true });
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-foreground">One more step</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a phone number to verify your account so you can start booking.
            </p>
          </div>

          {waitingOtp ? (
            <OtpVerification
              phone={phone}
              onSuccess={handlePhoneVerified}
              onCancel={() => setWaitingOtp(false)}
            />
          ) : (
            <div className="space-y-4">
              {attachError && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{attachError}</p>
              )}
              <TextField
                label="Phone Number"
                type="tel"
                placeholder="+977-9800000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button type="button" className="w-full" onClick={handleAttachPhone}>
                Send Verification Code
              </Button>
              <Divider />
              <Link to={target} className="block text-center text-sm font-semibold text-muted-foreground hover:text-primary">
                Skip for now
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}