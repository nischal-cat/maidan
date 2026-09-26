import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { paymentsAPI } from '../services/api';
import { Spinner } from '../components/ui/spinner';
import { Button } from '../components/ui/button';

type PaymentStatus = 'loading' | 'success' | 'failed' | 'pending' | 'error';

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const errorParam = searchParams.get('error');
  const [status, setStatus] = useState<PaymentStatus>('loading');

  const { data } = useQuery({
    queryKey: ['paymentStatus', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const res = await paymentsAPI.getStatus(bookingId);
      return res.data;
    },
    enabled: !!bookingId && status === 'loading',
    refetchInterval: (query) => {
      if (query.state.data?.payment?.status === 'pending') return 2000;
      return false;
    },
    retry: 3,
  });

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      return;
    }
    if (data?.payment) {
      if (data.payment.status === 'paid' || data.payment.bookingStatus === 'confirmed') {
        setStatus('success');
      } else if (data.payment.status === 'failed') {
        setStatus('failed');
      } else {
        setStatus('pending');
      }
    }
  }, [data, errorParam]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <Spinner size="lg" />
          <p className="text-muted-foreground">Verifying your payment...</p>
          <p className="text-sm text-muted-foreground">This may take a few seconds. Please don't close this page.</p>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-highlight/25">
            <svg className="h-8 w-8 text-highlight-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-foreground">Payment pending</h2>
          <p className="text-muted-foreground">Your payment is still being processed. We'll confirm your booking shortly.</p>
          {bookingId && (
            <Button asChild variant="secondary" className="w-full">
              <Link to="/bookings">View My Bookings</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'success') {
    const payment = data?.payment;
    const isBatch = !!payment?.batchGroupId;
    const isDeposit = !!payment?.bookingDepositPaid;
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="animate-success mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-cta">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-foreground">Payment successful</h2>
          <p className="text-muted-foreground">
            {isBatch
              ? 'Your multi-slot booking is confirmed and paid online in full.'
              : isDeposit
                ? `Deposit received — your booking is confirmed. Pay the remaining balance of Rs ${payment.bookingTotalPrice != null ? Math.max(0, payment.bookingTotalPrice - (payment.bookingDepositAmount ?? 0)) : 0} at the venue.`
                : 'Your booking has been confirmed.'}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="primary" className="flex-1">
              <Link to="/bookings" className="w-full">View Bookings</Link>
            </Button>
            <Button asChild variant="secondary" className="flex-1">
              <Link to="/grounds" className="w-full">Book More</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // failed or error
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/10">
          <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-foreground">Payment failed</h2>
        <p className="text-muted-foreground">
          {errorParam === 'verification_failed'
            ? 'We could not verify your payment. Please try again.'
            : 'Your payment was not completed. The slot has been released.'}
        </p>
        <div className="flex gap-3">
          <Button asChild variant="primary" className="flex-1">
            <Link to="/grounds" className="w-full">Try Again</Link>
          </Button>
          <Button asChild variant="secondary" className="flex-1">
            <Link to="/bookings" className="w-full">View Bookings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
