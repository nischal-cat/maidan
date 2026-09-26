import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { PasswordField } from '../components/ui/password-field';
import { encodeReturnTo } from '../lib/returnTo';
import GoogleButton from '../components/ui/google-button';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    clearError();
    try {
      await registerUser(data);
      navigate(returnTo ? decodeURIComponent(returnTo) : '/dashboard', { replace: true });
    } catch {
      // error handled by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-foreground">Create account</h1>
          <p className="mt-2 text-muted-foreground">Join Maidan to start booking</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {returnTo && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">
              Create an account to complete your booking.
            </div>
          )}

          <GoogleButton returnTo={returnTo ?? undefined} />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Google sign-in creates a player account. Ground owners can apply separately.
          </p>

          <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or sign up with email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              label="Full Name"
              placeholder="Ramesh Thapa"
              error={errors.name?.message}
              {...register('name')}
            />
            <TextField
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Phone Number"
              type="tel"
              placeholder="+977-9800000000"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <PasswordField
              label="Password"
              placeholder="At least 6 characters"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordField
              label="Confirm Password"
              placeholder="Repeat your password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to={returnTo ? `/login?returnTo=${encodeReturnTo(returnTo)}` : '/login'} className="font-bold text-primary hover:underline">Sign in</Link>
        </p>

        <p className="mt-3 text-center text-sm text-muted-foreground">
          Want to list your ground?{' '}
          <Link
            to={returnTo ? `/register/seller?returnTo=${encodeReturnTo(returnTo)}` : '/register/seller'}
            className="inline-flex items-center gap-1 font-bold text-highlight hover:underline"
          >
            <Store className="h-4 w-4" aria-hidden />
            Become a Ground Owner
          </Link>
        </p>
      </div>
    </div>
  );
}