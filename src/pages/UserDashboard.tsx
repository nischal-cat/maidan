import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI } from '../services/api';
import { USER_SIDEBAR_LINKS } from '../constants';
import DashboardLayout from '../components/templates/DashboardLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import Modal from '../components/organisms/Modal';
import OtpVerification from '../components/organisms/OtpVerification';

export default function UserDashboard() {
  const { user } = useAuth();
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['user-dashboard-stats'],
    queryFn: async () => {
      const [activeRes, allRes] = await Promise.all([
        bookingsAPI.getActiveCount(),
        bookingsAPI.getMyBookings({ limit: 100 }),
      ]);
      const bookings = allRes.data.bookings || [];
      return {
        upcoming: activeRes.data.count,
        total: allRes.data.total,
        completed: bookings.filter((b) => b.status === 'completed').length,
        recent: bookings.slice(0, 5),
      };
    },
  });

  return (
    <DashboardLayout sidebarLinks={USER_SIDEBAR_LINKS}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">Hello, {user?.name}</h1>
          <p className="text-muted-foreground">Welcome back to Maidan</p>
        </div>

        {/* Phone Verification Banner */}
        {user?.phone && !user.isPhoneVerified && (
          <div className="flex flex-col gap-3 rounded-2xl border border-highlight/60 bg-highlight/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 shrink-0 text-highlight-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-highlight-foreground">Phone not verified</p>
                <p className="text-xs text-highlight-foreground/80">Verify your phone number to enable booking.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPhoneVerifyOpen(true)}>
              Verify Now
            </Button>
          </div>
        )}

        <Link to="/grounds" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Card className="border-0 bg-surface-strong text-surface-strong-foreground shadow-card transition-transform duration-300 hover:-translate-y-0.5">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-strong-foreground/10">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-extrabold">Find a ground</h3>
                <p className="text-sm opacity-70">Search available futsal courts near you</p>
              </div>
            </div>
          </Card>
        </Link>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <div className="text-center">
              {statsLoading ? (
                <div className="flex justify-center py-2"><Spinner /></div>
              ) : (
                <>
                  <div className="text-3xl font-extrabold text-primary">{statsData?.upcoming ?? 0}</div>
                  <div className="mt-1 text-sm font-semibold text-muted-foreground">Upcoming Bookings</div>
                </>
              )}
            </div>
          </Card>
          <Card>
            <div className="text-center">
              {statsLoading ? (
                <div className="flex justify-center py-2"><Spinner /></div>
              ) : (
                <>
                  <div className="text-3xl font-extrabold text-primary">{statsData?.total ?? 0}</div>
                  <div className="mt-1 text-sm font-semibold text-muted-foreground">Total Bookings</div>
                </>
              )}
            </div>
          </Card>
          <Card>
            <div className="text-center">
              {statsLoading ? (
                <div className="flex justify-center py-2"><Spinner /></div>
              ) : (
                <>
                  <div className="text-3xl font-extrabold text-foreground">{statsData?.completed ?? 0}</div>
                  <div className="mt-1 text-sm font-semibold text-muted-foreground">Completed</div>
                </>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="mb-4 text-lg font-extrabold text-card-foreground">Recent activity</h2>
          {statsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : statsData?.recent && statsData.recent.length > 0 ? (
            <div className="space-y-2">
              {statsData.recent.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                  <div>
                    <p className="text-sm font-bold text-card-foreground">{b.groundName}</p>
                    <p className="text-xs text-muted-foreground">{b.date} {b.startTime?.slice(0, 5)}-{b.endTime?.slice(0, 5)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    b.status === 'confirmed' ? 'bg-primary/15 text-primary' :
                    b.status === 'completed' ? 'bg-secondary text-secondary-foreground' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p className="font-bold text-foreground">No upcoming games.</p>
              <p className="mt-1 text-sm">Your next booking will appear here.</p>
              <Link to="/grounds" className="mt-3 inline-block">
                <Button variant="primary" size="sm">Find a Ground</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Phone Verification Modal */}
      <Modal open={phoneVerifyOpen} onClose={() => setPhoneVerifyOpen(false)} title="Verify Phone Number">
        {user?.phone && (
          <OtpVerification
            phone={user.phone}
            onSuccess={() => setPhoneVerifyOpen(false)}
            onCancel={() => setPhoneVerifyOpen(false)}
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
