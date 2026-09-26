import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsAPI } from '../services/api';
import { USER_SIDEBAR_LINKS } from '../constants';
import BookingCard from '../components/molecules/BookingCard';
import DashboardLayout from '../components/templates/DashboardLayout';
import CancelBookingDialog from '../components/booking/CancelBookingDialog';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import type { Booking } from '../types';
import { FREE_CANCELLATION_HOURS, DEPOSIT_RATE } from '../types';

type FilterTab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const PAGE_SIZE = 10;

export default function BookingHistoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['my-bookings', activeTab, page, search],
    queryFn: async () => {
      const params: Record<string, string> = { limit: String(PAGE_SIZE), page: String(page) };
      if (activeTab !== 'all') params.status = activeTab;
      if (search) params.search = search;
      const res = await bookingsAPI.getMyBookings(params);
      return res.data;
    },
  });

  const bookings: Booking[] = data?.bookings || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleCancelRequest = (id: string) => {
    const booking = bookings.find((b) => b.id === id);
    if (booking) setCancelModalBooking(booking);
  };

  // Changing a filter or the search term invalidates the current page number.
  const applyFilter = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Upcoming' },
    { key: 'completed', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <DashboardLayout sidebarLinks={USER_SIDEBAR_LINKS}>
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-foreground">My Bookings</h1>

        {cancelMessage && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm font-semibold text-primary">
            <span>{cancelMessage}</span>
            <button type="button" onClick={() => setCancelMessage('')} aria-label="Dismiss" className="font-extrabold hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">×</button>
          </div>
        )}

        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
          <span className="font-extrabold">Cancellation policy:</span> free up to {FREE_CANCELLATION_HOURS} hours before the slot.
          Single-slot bookings: the {DEPOSIT_RATE * 100}% online deposit is the late-cancellation fee.
          Multi-slot bookings: a flat {DEPOSIT_RATE * 100}% of the total is kept late; the rest is refunded by the venue.
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-2 overflow-x-auto border-b border-border" role="tablist" aria-label="Booking status">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                onClick={() => applyFilter(tab.key)}
                aria-selected={activeTab === tab.key}
                className={`-mb-px min-h-11 shrink-0 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTab === tab.key
                    ? 'border-b-2 border-primary text-primary'
                    : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={applySearch} className="flex gap-2 sm:w-80" role="search">
            <label htmlFor="booking-search" className="sr-only">
              Search bookings by ground, city, or reference
            </label>
            <input
              id="booking-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ground, city or reference…"
              className="min-h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" variant="primary" size="sm" className="min-h-11 px-4">
              Search
            </Button>
            {search && (
              <Button type="button" variant="ghost" size="sm" className="min-h-11 px-3" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </form>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <div className={`space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            {bookings.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted py-12 text-center text-muted-foreground">
                <p>{search ? `No bookings match “${search}”.` : 'No bookings found.'}</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onCancel={handleCancelRequest} />
              ))
            )}
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Bookings pagination" className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">
              Page {page} of {totalPages} &middot; {total} booking{total === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </nav>
        )}

        <CancelBookingDialog
          booking={cancelModalBooking}
          onClose={() => setCancelModalBooking(null)}
          onCancelled={(message) => {
            setCancelMessage(message);
            // A cancellation can empty the last page; step back rather than
            // showing an empty list.
            if (bookings.length === 1 && page > 1) setPage((p) => p - 1);
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
