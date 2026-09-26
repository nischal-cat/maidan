import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Store, ShieldCheck } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCities } from '../hooks/useCities';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { PasswordField } from '../components/ui/password-field';
import { encodeReturnTo } from '../lib/returnTo';

const SPORT_TYPES = ['Futsal', 'Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Swimming'];

const sellerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  businessName: z.string().min(2, 'Business name is required'),
  businessCity: z.string().min(2, 'Business city is required'),
  businessAddress: z.string().min(5, 'Business address must be at least 5 characters'),
  businessContact: z.string().min(10, 'Business contact must be at least 10 digits').max(15),
  registrationNumber: z.string().optional(),
  businessDescription: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SellerForm = z.infer<typeof sellerSchema>;

export default function SellerApplyPage() {
  const { clearError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [loading, setLoading] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [document, setDocument] = useState<File | null>(null);
  const [clientError, setClientError] = useState('');
  const [serverError, setServerError] = useState('');
  const { cityNames } = useCities();

  const { register, handleSubmit, formState: { errors } } = useForm<SellerForm>({
    resolver: zodResolver(sellerSchema),
  });

  const toggleType = (sport: string) =>
    setSelectedTypes((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));

  const canSubmit = useMemo(
    () => selectedTypes.length > 0 && !!document,
    [selectedTypes, document]
  );

  const onSubmit = async (data: SellerForm) => {
    setClientError('');
    setServerError('');
    if (selectedTypes.length === 0) return setClientError('Select at least one business type.');
    if (!document) return setClientError('Please upload your business registration document.');

    setLoading(true);
    clearError();
    try {
      const payload = new FormData();
      payload.append('name', data.name);
      payload.append('email', data.email);
      payload.append('phone', data.phone);
      payload.append('password', data.password);
      payload.append('role', 'owner');
      payload.append('businessName', data.businessName.trim());
      payload.append('businessType', JSON.stringify(selectedTypes));
      payload.append('businessCity', data.businessCity.trim());
      payload.append('businessAddress', data.businessAddress.trim());
      payload.append('businessContact', data.businessContact.trim());
      if (data.registrationNumber?.trim()) payload.append('registrationNumber', data.registrationNumber.trim());
      if (data.businessDescription?.trim()) payload.append('businessDescription', data.businessDescription.trim());
      payload.append('document', document as File);

      await authAPI.register(payload);
      navigate('/owner', { replace: true });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-2xl bg-highlight/15 p-3">
            <Store className="h-6 w-6 text-highlight" aria-hidden />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">Become a Ground Owner</h1>
          <p className="mt-2 text-muted-foreground">
            Tell us about your business. We review your application before you can list grounds.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-highlight/40 bg-highlight/10 p-3 text-sm text-highlight-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-highlight" aria-hidden />
            <p>
              Your account stays locked until an admin approves your application. You will not be able to manage
              grounds or slots in the meantime.
            </p>
          </div>

          {serverError && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Your Full Name"
                placeholder="Ramesh Thapa"
                error={errors.name?.message}
                {...register('name')}
              />
              <TextField
                label="Your Phone"
                type="tel"
                placeholder="+977-9800000000"
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>
            <TextField
              label="Email"
              type="email"
              placeholder="business@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="my-2 h-px bg-border" />
            <p className="text-sm font-extrabold text-foreground">Business details</p>

            <TextField
              label="Business Name"
              placeholder="e.g. Himalayan Futsal Pvt. Ltd."
              error={errors.businessName?.message}
              {...register('businessName')}
            />

            <div>
              <span className="block text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">
                Business Type <span className="text-destructive">*</span>
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPORT_TYPES.map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleType(sport)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      selectedTypes.includes(sport)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-card-foreground hover:border-primary/40'
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="seller-city" className="block text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">
                  Business City <span className="text-destructive">*</span>
                </label>
                <select
                  id="seller-city"
                  defaultValue=""
                  className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                  aria-invalid={!!errors.businessCity?.message}
                  {...register('businessCity')}
                >
                  <option value="" disabled>Select your city</option>
                  {cityNames.map((cityName) => (
                    <option key={cityName} value={cityName}>{cityName}</option>
                  ))}
                </select>
                {errors.businessCity?.message && (
                  <p className="mt-1 text-sm text-destructive">{errors.businessCity.message}</p>
                )}
              </div>
              <TextField
                label="Business Contact Phone"
                type="tel"
                placeholder="+977-98xxxxxxxx"
                error={errors.businessContact?.message}
                {...register('businessContact')}
              />
            </div>
            <TextField
              label="Business Address"
              placeholder="Ward, street, landmark"
              error={errors.businessAddress?.message}
              {...register('businessAddress')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Registration / PAN / VAT (optional)"
                placeholder="e.g. 123456789"
                error={errors.registrationNumber?.message}
                {...register('registrationNumber')}
              />
              <TextField
                label="Business Description (optional)"
                placeholder="Short note about your grounds"
                error={errors.businessDescription?.message}
                {...register('businessDescription')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">
                Registration document (PDF, JPG or PNG, max 5 MB)
              </span>
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-background px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <Upload className="h-4 w-4" aria-hidden />
                {document ? document.name : 'Choose file'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {clientError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                {clientError}
              </p>
            )}

            <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full">
              Request Account
            </Button>
            {!canSubmit && !loading && (
              <p className="text-center text-xs text-muted-foreground">
                Select a business type and upload your document to submit.
              </p>
            )}
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Just here to book?{' '}
          <Link to={returnTo ? `/register?returnTo=${encodeReturnTo(returnTo)}` : '/register'} className="font-bold text-primary hover:underline">
            Create a player account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Already applied?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">Sign in to check status</Link>
        </p>
      </div>
    </div>
  );
}

export { SPORT_TYPES };