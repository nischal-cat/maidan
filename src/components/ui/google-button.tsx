import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleHome } from '../../constants';
import { safeReturnTo } from '../../lib/returnTo';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface GoogleButtonProps {
  returnTo?: string;
  className?: string;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.86 11.86 0 000 12c0 1.94.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export default function GoogleButton({ returnTo, className }: GoogleButtonProps) {
  const { googleSignIn, clearError } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const handleClick = async () => {
    if (starting) return;
    setStarting(true);
    clearError();
    try {
      const user = await googleSignIn();
      const target = safeReturnTo(returnTo ?? undefined) ?? roleHome(user.role);
      if (user.phone) {
        navigate(target, { replace: true });
      } else {
        navigate('/auth/complete', { replace: true, state: { returnTo: target } });
      }
    } catch {
      // error is surfaced by the auth context banner
    } finally {
      setStarting(false);
    }
  };

  return (
    <Button type="button" variant="secondary" className={cn('w-full', className)} onClick={handleClick} loading={starting}>
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}