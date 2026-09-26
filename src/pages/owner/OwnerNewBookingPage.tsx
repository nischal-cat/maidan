import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { groundsAPI, bookingsAPI, adminAPI } from '../../services/api';
import { useOwnerGrounds } from '../../hooks/useOwnerGrounds';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { StatusBadge } from '../../components/ui/status-badge';
import { OwnerEmptyState } from '../../components/owner/OwnerEmptyState';
import { useToast } from '../../components/ui/toast';
import { useOwnerBookingActions } from '../../hooks/useOwnerBookings';
import SlotButton from '../../components/molecules/SlotButton';
import { formatNPR } from '../../lib/dates';
import type { Slot, Booking } from '../../types';

type PaymentChoice = 'unpaid' | 'cash';

export default function OwnerNewBookingPage() {
  usePageTitle('New Booking · Owner · Maidan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const actions = useOwnerBookingActions();
  const ownerId = user?.role === 'owner' ? user.id : undefined;

  const { data: grounds } = useOwnerGrounds(ownerId);
  const [groundId, setGroundId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [players, setPlayers] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('unpaid');
  const [error, setError] = useState('');
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!groundId && grounds && grounds.length > 0) setGroundId(grounds[0].id);
  }, [grounds, groundId]);

  const { data: slots, isLoading: slotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: ['walkin-slots', groundId, date],
    queryFn: async () => {
      if (!groundId) return [];
      const res = await groundsAPI.getSlots(groundId, date);
      return res.data;
    },
    enabled: !!groundId,
  });

  const generateMutation = useMutation({
    mutationFn: () => adminAPI.generateSlots(groundId, { startDate: date, days: 7 }),
    onError: () => setError('Failed to generate slots.'),
    onSuccess: (res) => {
      setError('');
      toast({ title: 'Slots generated', description: `+${res.data.generated} new slots.` });
      refetchSlots();
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof bookingsAPI.createWalkIn>[0]) => bookingsAPI.createWalkIn(payload),
    onSuccess: (res) => {
      setCreatedBooking(res.data.booking);
      setError('');
      actions.refreshList();
      toast({ title: 'Booking confirmed' });
    },
    onError: (err: unknown) => {
      const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
      if (res?.status === 409) {
        setError('That slot was just booked by someone else. Choose another available time.');
        setSelectedSlot(null);
        refetchSlots();
        toast({ variant: 'error', title: 'Slot taken', description: 'Choose another available time.' });
      } else {
        setError(res?.data?.message || 'Failed to create booking.');
      }
    },
  });

  const availableCount = (slots ?? []).filter((s) => s.status === 'available').length;

  const handleChangeGround = (id: string) => {
    setGroundId(id);
    setSelectedSlot(null);
  };

  const handleChangeDate = (d: string) => {
    setDate(d);
    setSelectedSlot(null);
  };

  const handleSubmit = () => {
    setError('');
    if (!selectedSlot) return setError('Please select a time slot.');
    if (customerName.trim().length < 2) return setError('Please enter the customer name.');
    if (!/^\+?\d{10,15}$/.test(customerPhone.trim()))
      return setError('Please enter a valid phone number (10-15 digits).');

    createMutation.mutate({
      slotId: selectedSlot.id,
      numberOfPlayers: players ? parseInt(players) : undefined,
      specialRequests: notes || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod: paymentChoice,
    });
  };

  const resetForm = () => {
    setCreatedBooking(null);
    setSelectedSlot(null);
    setCustomerName('');
    setCustomerPhone('');
    setPlayers('');
    setNotes('');
    setPaymentChoice('unpaid');
    setError('');
    refetchSlots();
  };

  if (createdBooking) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="py-4 text-center">
          <div className="animate-success mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-cta">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Booking confirmed</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">The slot has been reserved for your customer.</p>
        </div>

        <Card className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Booking ref</span>
            <span className="font-mono text-sm font-bold text-card-foreground">{createdBooking.bookingRef}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Customer</span>
            <span className="text-sm font-bold text-card-foreground">
              {createdBooking.customerName} ({createdBooking.customerPhone})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Ground</span>
            <span className="text-sm font-bold text-card-foreground">{createdBooking.groundName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Date &amp; time</span>
            <span className="text-sm font-bold text-card-foreground">
              {createdBooking.date}, {createdBooking.startTime?.slice(0, 5)}-{createdBooking.endTime?.slice(0, 5)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Amount</span>
            <span className="text-sm font-extrabold text-primary">{formatNPR(createdBooking.totalPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Payment</span>
            <StatusBadge variant={createdBooking.paymentStatus === 'paid' ? 'success' : 'warning'}>
              {createdBooking.paymentStatus === 'paid' ? 'Paid (Cash)' : 'Pay at venue'}
            </StatusBadge>
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button variant="outline" className="sm:flex-1" onClick={resetForm}>
            Create another
          </Button>
          <Button className="sm:flex-1" onClick={() => navigate(`/owner/bookings/${createdBooking.id}`)}>
            View booking
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">New booking</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Book a slot for a customer who called or walked in. The booking is confirmed immediately.
        </p>
      </header>

      <Card className="space-y-4">
        <h2 className="text-sm font-extrabold text-card-foreground">1. Ground &amp; date</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="owner-new-ground" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Ground</label>
            <select
              id="owner-new-ground"
              value={groundId}
              onChange={(e) => handleChangeGround(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {grounds?.length === 0 && <option value="">No grounds yet</option>}
              {grounds?.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="owner-new-date" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Date</label>
            <input
              id="owner-new-date"
              type="date"
              value={date}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => handleChangeDate(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-card-foreground">2. Time slot</h2>
          {!slotsLoading && slots && (
            <span className="text-xs font-bold text-muted-foreground">{availableCount} available</span>
          )}
        </div>
        {slotsLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-border/60" />
            ))}
          </div>
        ) : !slots || slots.length === 0 ? (
          <OwnerEmptyState
            title="No slots for this date"
            description="Generate slots for the next week to open times on this ground."
            action={
              <Button size="sm" loading={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
                Generate slots
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {slots.map((slot) => (
              <SlotButton
                key={slot.id}
                startTime={slot.startTime.slice(0, 5)}
                endTime={slot.endTime.slice(0, 5)}
                status={slot.status}
                price={slot.price}
                selected={selectedSlot?.id === slot.id}
                onClick={() => setSelectedSlot(slot)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-extrabold text-card-foreground">3. Customer details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Customer name *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Ram Bahadur"
          />
          <TextField
            label="Phone number *"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="e.g. 98XXXXXXXX"
            inputMode="tel"
          />
          <TextField
            label="Number of players"
            type="number"
            min={1}
            max={50}
            value={players}
            onChange={(e) => setPlayers(e.target.value)}
            placeholder="e.g. 10"
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special requests…"
          />
        </div>

        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Payment</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { value: 'unpaid', title: 'Pay at venue', desc: 'Confirmed now, collect cash when they arrive' },
                { value: 'cash', title: 'Cash received now', desc: 'Mark booking as paid immediately' },
              ] as { value: PaymentChoice; title: string; desc: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentChoice(opt.value)}
                aria-pressed={paymentChoice === opt.value}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  paymentChoice === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <p className="text-sm font-bold text-card-foreground">{opt.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full sm:w-auto"
        loading={createMutation.isPending}
        disabled={!selectedSlot || !customerName.trim() || !customerPhone.trim()}
        onClick={handleSubmit}
      >
        {createMutation.isPending ? 'Confirming…' : 'Confirm booking'}
      </Button>
    </div>
  );
}