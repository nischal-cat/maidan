import { useState } from 'react';
import { paymentsAPI } from '../services/api';
import { useToast } from '../components/ui/toast';

/**
 * Start a gateway payment and hand the browser off to the provider.
 *
 * The two Nepali gateways differ in shape: Khalti returns a redirect URL,
 * eSewa returns a form URL plus signed fields that have to be POSTed. Both
 * end with the user leaving the app, so the only thing this hook can report
 * back is a failure to *start* the payment.
 *
 * Lifted out of BookingCard so the list card and the booking detail page share
 * one implementation instead of two copies drifting apart.
 */
export function useBookingPayment() {
  const [paying, setPaying] = useState(false);
  const { toast } = useToast();

  /**
   * @param bookingId  the booking to pay
   * @param gateway    defaults to eSewa, which is what the app has always used
   * @returns true when the redirect was launched, false when it never started
   */
  const payNow = async (bookingId: string, gateway: 'esewa' | 'khalti' = 'esewa'): Promise<boolean> => {
    setPaying(true);
    try {
      const res = await paymentsAPI.initiate({ bookingId, gateway });
      const { redirectUrl, formUrl, formFields } = res.data;

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return true;
      }

      if (formUrl && formFields) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = formUrl;
        Object.entries(formFields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return true;
      }

      setPaying(false);
      toast({
        variant: 'error',
        title: 'Payment could not start',
        description: 'The gateway did not return a payment link. Please try again.',
      });
      return false;
    } catch {
      setPaying(false);
      toast({ variant: 'error', title: 'Could not start payment', description: 'Please try again.' });
      return false;
    }
  };

  return { payNow, paying };
}
