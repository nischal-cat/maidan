import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { groundsAPI, adminAPI } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import SlotButton from '../../components/molecules/SlotButton';
import type { Slot } from '../../types';

export default function ManageSlotsPage() {
  const [selectedGround, setSelectedGround] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generateDays, setGenerateDays] = useState(7);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [bulkAction, setBulkAction] = useState<'open' | 'close' | null>(null);

  const { data: groundsData } = useQuery({
    queryKey: ['grounds-list', 'all'],
    queryFn: async () => {
      const res = await groundsAPI.getAll({ limit: 50 });
      return res.data;
    },
  });

  const grounds = useMemo(() => groundsData?.grounds || [], [groundsData]);

  useEffect(() => {
    if (grounds.length > 0 && !selectedGround) {
      setSelectedGround(grounds[0].id);
    }
  }, [grounds, selectedGround]);

  const { data: slots, isLoading, refetch } = useQuery({
    queryKey: ['admin-slots', selectedGround, selectedDate],
    queryFn: async () => {
      if (!selectedGround) return [];
      const res = await groundsAPI.getSlots(selectedGround, selectedDate);
      return res.data;
    },
    enabled: !!selectedGround,
  });

  const clearMessages = () => {
    setActionError('');
    setActionSuccess('');
  };

  const generateSlots = async () => {
    clearMessages();
    try {
      const res = await adminAPI.generateSlots(selectedGround, {
        startDate: selectedDate,
        days: generateDays,
      });
      setActionSuccess(res.data.message);
      refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to generate slots.');
    }
  };

  const handleToggleSlot = async (slot: Slot) => {
    if (slot.status === 'booked' || slot.status === 'held') return;
    clearMessages();
    const newStatus = slot.status === 'available' ? 'maintenance' : 'available';
    try {
      await adminAPI.updateSlots(selectedGround, selectedDate, [
        { startTime: slot.startTime, status: newStatus },
      ]);
      refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to update slot.');
    }
  };

  const runBulkAction = async () => {
    if (!bulkAction || !slots || !selectedGround) return;
    clearMessages();
    const updates = slots
      .filter((s) => s.status !== 'booked' && s.status !== 'held')
      .map((s) => ({ startTime: s.startTime, status: bulkAction === 'open' ? 'available' : 'maintenance' }));
    try {
      await adminAPI.updateSlots(selectedGround, selectedDate, updates);
      setBulkAction(null);
      if (updates.length === 0) {
        setActionSuccess('No available slots to change on this date.');
      }
      refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to update slots.');
    }
  };

  return (
          <div className="space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Availability</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Manage slots</h1>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-col gap-2">
            <label htmlFor="slot-ground" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Select ground</label>
            <select id="slot-ground" value={selectedGround} onChange={(e) => setSelectedGround(e.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {grounds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="slot-date" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Date</label>
            <input id="slot-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => { clearMessages(); setBulkAction('open'); }}>Open All</Button>
            <Button variant="destructive" size="sm" onClick={() => { clearMessages(); setBulkAction('close'); }}>Close All</Button>
          </div>

          <div className="flex items-end gap-2 border-border pl-0 sm:ml-3 sm:border-l sm:pl-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="generate-days" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Generate slots for</label>
              <select
                id="generate-days"
                value={generateDays}
                onChange={(e) => setGenerateDays(parseInt(e.target.value))}
                className="min-h-9 rounded-xl border border-input bg-background px-2 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => generateSlots()}
              disabled={!selectedGround}
            >
              Generate Slots
            </Button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{actionError}</div>
        )}
        {actionSuccess && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">{actionSuccess}</div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><div className="h-4 w-4 rounded border border-primary/30 bg-primary/10" /><span>Available</span></div>
          <div className="flex items-center gap-2"><div className="h-4 w-4 rounded border border-border bg-muted" /><span>Booked</span></div>
          <div className="flex items-center gap-2"><div className="h-4 w-4 rounded border border-destructive/20 bg-destructive/10" /><span>Maintenance</span></div>
          <div className="flex items-center gap-2"><div className="h-4 w-4 rounded border border-highlight/60 bg-highlight/25" /><span>Held</span></div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (slots || []).length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted py-12 text-center text-muted-foreground">
            <p className="mb-3">No slots found for this date.</p>
            <Button variant="primary" size="sm" onClick={() => generateSlots()}>Generate Slots for This Date Range</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {(slots || []).map((slot) => (
              <SlotButton
                key={slot.id}
                startTime={slot.startTime}
                endTime={slot.endTime}
                status={slot.status}
                price={slot.price}
                allowToggle
                onClick={() => handleToggleSlot(slot)}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          open={!!bulkAction}
          title={bulkAction === 'open' ? 'Open available slots?' : 'Close available slots?'}
          description={bulkAction === 'open'
            ? 'Reopen closed slots for this date. Booked slots and slots on hold are left unchanged.'
            : 'Close available slots for this date. Booked slots and slots on hold are left unchanged.'}
          confirmLabel={bulkAction === 'open' ? 'Open slots' : 'Close slots'}
          onConfirm={runBulkAction}
          onCancel={() => setBulkAction(null)}
        />
      </div>
  );
}
