import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../constants';
import { encodeReturnTo } from '../lib/returnTo';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { PasswordField } from '../components/ui/password-field';
import GoogleButton from '../components/ui/google-button';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    clearError();
    try {
      const loggedInUser = await login(data.email, data.password);
      navigate(returnTo ? decodeURIComponent(returnTo) : roleHome(loggedInUser.role), { replace: true });
    } catch {
      // error is handled by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-foreground">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {returnTo && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">
              Log in to complete your booking.
            </div>
          )}

          <GoogleButton returnTo={returnTo ?? undefined} />

          <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or continue with email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <PasswordField
              label="Password"
              placeholder="Enter your password"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 accent-primary" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Forgot password?</Link>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Login
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to={returnTo ? `/register?returnTo=${encodeReturnTo(returnTo)}` : '/register'} className="font-bold text-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
