import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { groundsAPI, bookingsAPI, adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { roleBase } from '../../constants';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { StatusBadge } from '../../components/ui/status-badge';
import { Spinner } from '../../components/ui/spinner';
import SlotButton from '../../components/molecules/SlotButton';
import type { Slot, Booking } from '../../types';

type PaymentChoice = 'unpaid' | 'cash';

export default function NewWalkInBookingPage() {
  const { user } = useAuth();
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

  const isAdmin = user?.role === 'admin' || user?.role === 'subadmin';

  const { data: groundsData } = useQuery({
    queryKey: ['walkin-grounds', user?.role === 'owner' ? user.id : 'all'],
    queryFn: async () => {
      const res = await groundsAPI.getAll({ limit: 50, ownerId: user?.role === 'owner' ? user.id : undefined });
      return res.data;
    },
  });

  // Owners book only their own grounds; admins can book any ground
  const grounds = (groundsData?.grounds || []).filter(
    (g) => isAdmin || g.ownerId === user?.id
  );

  useEffect(() => {
    if (grounds.length > 0 && !groundId) {
      setGroundId(grounds[0].id);
    }
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

  useEffect(() => {
    setSelectedSlot(null);
  }, [groundId, date]);

  const generateMutation = useMutation({
    mutationFn: () => adminAPI.generateSlots(groundId, { startDate: date, days: 7 }),
    onSuccess: () => refetchSlots(),
    onError: () => setError('Failed to generate slots.'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof bookingsAPI.createWalkIn>[0]) =>
      bookingsAPI.createWalkIn(payload),
    onSuccess: (res) => {
      setCreatedBooking(res.data.booking);
      setError('');
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create booking.';
      setError(message);
    },
  });

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
            <p className="mt-1 text-muted-foreground">The field has been reserved for your customer.</p>
          </div>

          <Card className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booking ref</span>
              <span className="font-mono font-bold text-card-foreground">{createdBooking.bookingRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-bold text-card-foreground">
                {createdBooking.customerName} ({createdBooking.customerPhone})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ground</span>
              <span className="font-bold text-card-foreground">{createdBooking.groundName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date &amp; time</span>
              <span className="font-bold text-card-foreground">
                {createdBooking.date}, {createdBooking.startTime?.slice(0, 5)}-{createdBooking.endTime?.slice(0, 5)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-extrabold text-primary">Rs {createdBooking.totalPrice}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment</span>
              <StatusBadge variant={createdBooking.paymentStatus === 'paid' ? 'success' : 'warning'}>
                {createdBooking.paymentStatus === 'paid' ? 'Paid (Cash)' : 'Pay at venue'}
              </StatusBadge>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={resetForm}>
              New Booking
            </Button>
            <Button asChild variant="primary" className="flex-1">
              <Link to={`${roleBase(user?.role)}/bookings`} className="w-full">View All Bookings</Link>
            </Button>
          </div>
</div>
  );
}

  return (
<div className="space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Walk-in</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">New booking</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book a field on behalf of a customer who called or walked in.
          </p>
        </div>

        <Card className="space-y-4">
          <h2 className="font-extrabold text-card-foreground">1. Select field &amp; date</h2>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="walkin-ground" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Field</label>
              <select
                id="walkin-ground"
                value={groundId}
                onChange={(e) => setGroundId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {grounds.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="walkin-date" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Date</label>
              <input
                id="walkin-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-extrabold text-card-foreground">2. Select time slot</h2>
          {slotsLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !slots || slots.length === 0 ? (
            <div className="rounded-xl bg-muted py-8 text-center text-muted-foreground">
              <p className="mb-3">No slots found for this date.</p>
              <Button variant="primary" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? 'Generating...' : 'Generate Slots'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {slots.map((slot) => (
                <SlotButton
                  key={slot.id}
                  startTime={slot.startTime}
                  endTime={slot.endTime}
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
          <h2 className="font-extrabold text-card-foreground">3. Customer details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Customer Name *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ram Bahadur"
            />
            <TextField
              label="Phone Number *"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 98XXXXXXXX"
              inputMode="tel"
            />
            <TextField
              label="Number of Players"
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
              placeholder="Special requests..."
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Payment</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                { value: 'unpaid', title: 'Pay at venue', desc: 'Mark as confirmed, collect cash when they arrive' },
                { value: 'cash', title: 'Cash received now', desc: 'Mark booking as paid immediately' },
              ] as { value: PaymentChoice; title: string; desc: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentChoice(opt.value)}
                  aria-pressed={paymentChoice === opt.value}
                  className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    paymentChoice === opt.value
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="text-sm font-bold text-card-foreground">{opt.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !selectedSlot || !customerName.trim() || !customerPhone.trim()}
          >
            {createMutation.isPending ? 'Confirming...' : 'Confirm Booking'}
          </Button>
        </div>
</div>
      );
    }
