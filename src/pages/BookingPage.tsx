import { useState, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { groundsAPI, bookingsAPI, paymentsAPI, authAPI } from '../services/api';
import SlotGrid from '../components/organisms/SlotGrid';
import OtpVerification from '../components/organisms/OtpVerification';
import CaptchaWidget from '../components/organisms/CaptchaWidget';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { TextField } from '../components/ui/text-field';
import type { Slot, Ground } from '../types';

export default function BookingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dateParam = searchParams.get('date') || '';
  const slotsParam = searchParams.get('slots') || '';

  const selectedDate = dateParam || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [slotIds, setSlotIds] = useState<string[]>(() => slotsParam.split(',').filter(Boolean));
  const [numPlayers, setNumPlayers] = useState('');
  const [requests, setRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'counter'>('online');
  const [counterApproval, setCounterApproval] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConflict, setIsConflict] = useState(false);

  const [phoneGateOpen, setPhoneGateOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [waitingOtp, setWaitingOtp] = useState(false);
  const [attachError, setAttachError] = useState('');

  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [pendingBatchGroupId, setPendingBatchGroupId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paySummary, setPaySummary] = useState<{ amount: number; label: string; depositOnly: boolean } | null>(null);

  const { data: groundData } = useQuery({
    queryKey: ['ground', id],
    queryFn: async () => {
      const res = await groundsAPI.getById(id!);
      return res.data;
    },
  });

  const { data: apiSlots, isLoading, refetch: refetchSlots } = useQuery({
    queryKey: ['slots', id, selectedDate],
    queryFn: async () => {
      const res = await groundsAPI.getSlots(id!, selectedDate);
      return res.data;
    },
  });

  const ground: Ground | undefined = groundData;
  const slots: Slot[] = useMemo(() => apiSlots || [], [apiSlots]);

  const selectedSlots = useMemo(
    () => slots.filter((s) => slotIds.includes(s.id) && (s.status === 'available' || s.status === 'held')),
    [slots, slotIds]
  );
  const selectedSlotIds = selectedSlots.map((s) => s.id);
  const isMulti = selectedSlots.length > 1;
  const totalPrice = selectedSlots.reduce((sum, s) => sum + Number(s.price), 0);

  const needsPhoneGate = !user || !user.phone || !user.isPhoneVerified;

  const createBooking = useMutation({
    mutationFn: async () => {
      if (isMulti) {
        const res = await bookingsAPI.createBatch({
          slotIds: selectedSlotIds,
          numberOfPlayers: numPlayers ? parseInt(numPlayers) : undefined,
          specialRequests: requests || undefined,
        });
        return { batch: res.data, single: null as never };
      }
      const res = await bookingsAPI.create({
        slotId: selectedSlotIds[0],
        numberOfPlayers: numPlayers ? parseInt(numPlayers) : undefined,
        specialRequests: requests || undefined,
        paymentMethod,
      });
      return { batch: null, single: res.data };
    },
    onSuccess: (result) => {
      setIsConflict(false);
      setCaptchaVerified(false);
      setAgreedToTerms(false);

      queryClient.invalidateQueries({ queryKey: ['slots', id, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['ground-slots-preview'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });

      if (result.single && result.single.requiresApproval) {
        setCounterApproval(true);
        setPaymentModalOpen(false);
        return;
      }

      if (result.batch) {
        setPendingBatchGroupId(result.batch.batchGroupId);
        setPaySummary({
          amount: result.batch.totalPrice,
          label: `${selectedSlots.length} slots · one combined payment`,
          depositOnly: false,
        });
      } else if (result.single && result.single.paymentRequired) {
        const b = result.single.booking;
        setPendingBookingId(b.id);
        setPaySummary({
          amount: b.depositAmount ?? Math.round(b.totalPrice * 0.4),
          label: b.depositOnly
            ? `Deposit (40%) · balance of Rs ${b.balanceAmount ?? 0} at venue`
            : 'Full payment online',
          depositOnly: !!b.depositOnly,
        });
      }
      setPaymentModalOpen(true);
    },
    onError: (err: any) => {
      const status = err.response?.status;
      if (status === 409) {
        setIsConflict(true);
        setErrorMessage(
          'A slot you picked was just taken by someone else. Your selection has been updated \u2014 review the times below and try again.'
        );
        refetchSlots().then(({ data }) => {
          if (data) {
            const available = new Set(data.filter((s) => s.status === 'available').map((s) => s.id));
            setSlotIds(slotIds.filter((id) => available.has(id)));
          }
        });
        return;
      }
      setErrorMessage(err.response?.data?.message || 'Booking failed. Please try again.');
    },
  });

  const handleContinueToPay = () => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(`/grounds/${id}/book${window.location.search}`)}`);
      return;
    }
    if (needsPhoneGate) {
      setPhoneGateOpen(true);
      return;
    }
    createBooking.mutate();
  };

  const handleAttachPhone = async () => {
    setAttachError('');
    try {
      await authAPI.addPhone(phoneInput);
      setWaitingOtp(true);
    } catch (err: any) {
      setAttachError(err.response?.data?.message || 'Failed to send verification code.');
    }
  };

  const handlePhoneVerified = async () => {
    await refreshUser();
    setPhoneGateOpen(false);
    setWaitingOtp(false);
    createBooking.mutate();
  };

  const handlePay = async (gateway: 'esewa' | 'khalti') => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const payload = pendingBatchGroupId
        ? { batchGroupId: pendingBatchGroupId, gateway }
        : { bookingId: pendingBookingId!, gateway };
      const res = await paymentsAPI.initiate(payload);

      if (gateway === 'khalti' && res.data.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else if (gateway === 'esewa' && res.data.formUrl && res.data.formFields) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.data.formUrl;
        Object.entries(res.data.formFields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      }
    } catch (err: any) {
      setPaymentLoading(false);
      setPaymentError(err.response?.data?.message || 'Failed to start payment. Please try again.');
    }
  };

  const canConfirm = captchaVerified && agreedToTerms;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (counterApproval) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-9 w-9 text-primary" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-foreground sm:text-3xl">
          Booking request sent!
        </h1>
        <p className="mt-3 text-muted-foreground">
          The ground owner has been asked to confirm your pay-at-counter booking.
          Your slot is reserved while you wait. You'll see its status under{' '}
          <span className="font-bold text-foreground">My Bookings</span>.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary">
            <Link to="/bookings">View my bookings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (selectedSlots.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-foreground">No slots selected</h1>
        <p className="mt-2 text-muted-foreground">
          Go back and pick at least one available slot to continue.
        </p>
        <Button asChild variant="primary" className="mt-6">
          <Link to={`/grounds/${id}`}>Choose slots</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">Book {ground?.name}</h1>
      <p className="mt-1 text-muted-foreground">{selectedDate}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Your slots</h2>
            <SlotGrid slots={slots} selectedSlotIds={selectedSlotIds} onToggleSlot={() => {}} date={selectedDate} />
            <p className="mt-3 text-xs text-muted-foreground">
              Booking {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} on {selectedDate}.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="num-players" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Number of players (optional)</label>
            <input
              id="num-players"
              type="number"
              min="1"
              max="20"
              value={numPlayers}
              onChange={(e) => setNumPlayers(e.target.value)}
              placeholder="e.g. 8"
              className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="special-requests" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Special requests (optional)</label>
            <textarea
              id="special-requests"
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="Any special requirements..."
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <CaptchaWidget onVerify={setCaptchaVerified} />

          <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-primary"
            />
            <span>
              I agree to the booking terms. Cancellation is free up to 24 hours before the slot.
              {isMulti
                ? ' For multi-slot bookings, all slots are paid online in one payment; a late cancellation keeps 40% of the total.'
                : paymentMethod === 'counter'
                  ? ' Pay-at-counter bookings are confirmed by the owner; your slot stays reserved while waiting for approval.'
                  : ' For a single slot, 40% is paid online as a deposit and it becomes the fee for late cancellation; the balance is paid at the venue.'}
            </span>
          </label>

          {errorMessage && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {errorMessage}
              {isConflict && (
                <Link
                  to={`/grounds/${id}`}
                  className="mt-2 inline-block text-destructive underline underline-offset-2 hover:text-destructive/80"
                >
                  Choose different slots
                </Link>
              )}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 h-fit space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-lg font-extrabold text-card-foreground">Booking Summary</h2>
          <div className="space-y-2 rounded-xl bg-muted p-4 text-sm">
            {selectedSlots.map((slot) => (
              <div key={slot.id} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{slot.startTime} - {slot.endTime}</span>
                <span className="font-bold text-card-foreground">Rs {slot.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Total{isMulti || paymentMethod === 'counter' ? '' : ' · paid online'}</span>
              <span className="font-extrabold text-primary">Rs {totalPrice.toLocaleString()}</span>
            </div>
          </div>

          {!isMulti && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    aria-pressed={paymentMethod === 'online'}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                      paymentMethod === 'online'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    Pay online
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('counter')}
                    aria-pressed={paymentMethod === 'counter'}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                      paymentMethod === 'counter'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    Pay at counter
                  </button>
                </div>
              </div>

              {paymentMethod === 'online' ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  Pay a <span className="font-bold text-primary">40% deposit (Rs {Math.round(totalPrice * 0.4).toLocaleString()})</span> now to
                  confirm. The remaining <span className="font-bold text-foreground">Rs {Math.max(0, totalPrice - Math.round(totalPrice * 0.4)).toLocaleString()}</span> is
                  paid at the venue. A late cancellation keeps the deposit as the fee.
                </div>
              ) : (
                <div className="rounded-xl border border-highlight/40 bg-highlight/10 p-3 text-xs leading-relaxed text-muted-foreground">
                  Pay <span className="font-bold text-highlight-foreground">Rs {totalPrice.toLocaleString()}</span> at the venue counter. The
                  ground owner confirms your booking — your slot stays reserved while you wait for approval.
                </div>
              )}
            </>
          )}

          <Button
            variant="primary"
            className="w-full"
            onClick={handleContinueToPay}
            disabled={!canConfirm}
          >
            {createBooking.isPending
              ? 'Booking...'
              : paymentMethod === 'counter'
                ? 'Confirm · Pay at Counter'
                : `Continue to Payment · Rs ${totalPrice.toLocaleString()}`}
          </Button>
          {!canConfirm && (
            <p className="text-center text-xs text-muted-foreground">Complete the CAPTCHA and agree to terms to continue</p>
          )}
        </aside>
      </div>

      {phoneGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-foreground">Verify your phone</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Phone verification is required to book. {user?.phone ? 'Enter the code sent to your phone.' : 'Add a phone number to continue.'}
              </p>
            </div>

            {waitingOtp || (user?.isPhoneVerified ? null : user?.phone) ? (
              <div className="mt-5">
                <OtpVerification
                  phone={waitingOtp ? phoneInput : (user?.phone ?? phoneInput)}
                  onSuccess={handlePhoneVerified}
                  onCancel={() => { setPhoneGateOpen(false); setWaitingOtp(false); }}
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {attachError && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{attachError}</p>
                )}
                <TextField
                  label="Phone Number"
                  type="tel"
                  placeholder="+977-9800000000"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <Button type="button" className="w-full" onClick={handleAttachPhone}>
                  Send Verification Code
                </Button>
                <button
                  type="button"
                  onClick={() => setPhoneGateOpen(false)}
                  className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="rounded-xl border border-highlight/60 bg-highlight/15 p-3 text-sm font-semibold text-highlight-foreground">
              <p className="font-extrabold">Slot{pendingBatchGroupId ? 's' : ''} held for 10 minutes</p>
              <p className="mt-1">Complete the payment now or the slot{pendingBatchGroupId ? 's' : ''} will be released.</p>
            </div>

            {paySummary && (
              <div className="space-y-2 rounded-xl bg-muted p-4 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Amount to pay online</p>
                <p className="text-2xl font-extrabold text-primary">Rs {paySummary.amount.toLocaleString()}</p>
                <p className="text-xs font-semibold text-muted-foreground">{paySummary.label}</p>
              </div>
            )}

            {paymentError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                {paymentError}
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={() => handlePay('esewa')}
              disabled={paymentLoading}
            >
              {paymentLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Redirecting to eSewa...</span> : 'Pay with eSewa'}
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handlePay('khalti')}
              disabled={paymentLoading}
            >
              Pay with Khalti
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setPaymentModalOpen(false);
                setPendingBookingId(null);
                setPendingBatchGroupId(null);
              }}
              disabled={paymentLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}