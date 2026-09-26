import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { PasswordField } from '../components/ui/password-field';

const identifierSchema = z
  .object({
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: 'Enter your registered email or phone number',
  })
  .refine((data) => !data.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), {
    message: 'Enter a valid email address',
    path: ['email'],
  });

const resetSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

type IdentifierForm = z.infer<typeof identifierSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'reset'>('phone');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<{ name?: string; maskedContact?: string } | null>(null);
  // "Must differ from current password" is only knowable on the server, so it
  // is surfaced on the field rather than the generic error banner.
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const phoneForm = useForm<IdentifierForm>({ resolver: zodResolver(identifierSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSendOtp = async (data: IdentifierForm) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authAPI.forgotPassword({
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
      });
      // The backend resolves the account and hands back the phone the OTP was
      // sent to; the reset step is always keyed on that phone.
      if (!res.data.phone) {
        setNotice(res.data.message);
        return;
      }
      setPhone(res.data.phone);
      setAccount({ name: res.data.name, maskedContact: res.data.maskedContact });
      setNotice(res.data.message);
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const onReset = async (data: ResetForm) => {
    setLoading(true);
    setError(null);
    setPasswordError(null);
    setNotice(null);
    try {
      const res = await authAPI.resetPassword({ phone, code: data.code, newPassword: data.newPassword });
      setNotice(res.data.message);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to reset password.';
      if (/different from your current password/i.test(message)) setPasswordError(message);
      else setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-foreground">Reset your password</h1>
          <p className="mt-2 text-muted-foreground">
            {step === 'phone'
              ? 'Enter your registered email or phone. We will send a 6-digit code to the phone on file.'
              : `Enter the code sent to +${phone}`}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {notice && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">{notice}</div>
          )}

          {step === 'phone' ? (
            <form onSubmit={phoneForm.handleSubmit(onSendOtp)} className="space-y-4">
              {account && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-bold text-foreground">Resetting password for {account.name}</p>
                  {account.maskedContact && <p className="text-muted-foreground">{account.maskedContact}</p>}
                </div>
              )}
              <TextField
                label="Registered email"
                type="email"
                placeholder="you@example.com"
                error={phoneForm.formState.errors.email?.message}
                {...phoneForm.register('email')}
              />
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-bold uppercase text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <TextField
                label="Registered phone number"
                type="tel"
                placeholder="98XXXXXXXX"
                error={phoneForm.formState.errors.phone?.message}
                {...phoneForm.register('phone')}
              />
              {phoneForm.formState.errors.root?.message && (
                <p className="text-sm font-semibold text-destructive">{phoneForm.formState.errors.root.message}</p>
              )}
              <Button type="submit" loading={loading} className="w-full">Send reset code</Button>
            </form>
          ) : (
            <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
              <TextField
                label="Verification code"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                error={resetForm.formState.errors.code?.message}
                {...resetForm.register('code')}
              />
              <PasswordField
                label="New password"
                placeholder="At least 6 characters"
                error={
                  resetForm.formState.errors.newPassword?.message ??
                  (passwordError || undefined)
                }
                {...resetForm.register('newPassword')}
              />
              <p className="-mt-2 text-xs text-muted-foreground">
                Must be different from your current password.
              </p>
              <Button type="submit" loading={loading} className="w-full">Reset password</Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered your password?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}