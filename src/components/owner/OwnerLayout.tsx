import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Clock,
  LogOut,
  MapPin,
  MoreHorizontal,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ToastProvider } from '../ui/toast';
import { BrandLockup } from '../ui/brand';
import NotificationBell from '../ui/notification-bell';
import Modal from '../organisms/Modal';
import { OWNER_NAV, isOwnerSectionActive } from '../../constants';
import { cn } from '../../lib/utils';

function NavItem({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = isOwnerSectionActive(location.pathname, to);
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary/10 font-bold text-primary' : 'font-semibold text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {label}
    </Link>
  );
}

function MobileTab({ to, label, icon, onOpen }: { to?: string; label: string; icon: React.ReactNode; onOpen?: () => void }) {
  const location = useLocation();
  const active = to ? isOwnerSectionActive(location.pathname, to) : false;

  if (to) {
    return (
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      {label}
    </button>
  );
}

function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const MoreLink = ({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => {
        setMoreOpen(false);
        navigate(to);
      }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <nav
        aria-label="Owner quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid w-full max-w-md grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-1 px-3 py-1.5">
          <MobileTab to="/owner" label="Home" icon={<HomeIcon />} />
          <MobileTab to="/owner/bookings" label="Bookings" icon={<CalendarDays className="h-5 w-5" aria-hidden />} />
          <Link
            to="/owner/bookings/new"
            aria-label="New booking"
            className="mx-1 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-6 w-6" aria-hidden />
          </Link>
          <MobileTab to="/owner/slots" label="Slots" icon={<Clock className="h-5 w-5" aria-hidden />} />
          <MobileTab label="More" icon={<MoreHorizontal className="h-5 w-5" aria-hidden />} onOpen={() => setMoreOpen(true)} />
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          <MoreLink to="/owner/grounds" label="My Grounds" icon={<MapPin className="h-4.5 w-4.5" aria-hidden />} />
          <MoreLink to="/owner/bookings" label="All Bookings" icon={<CalendarDays className="h-4.5 w-4.5" aria-hidden />} />
          <MoreLink to="/owner/reports" label="Reports" icon={<BarChart3 className="h-4.5 w-4.5" aria-hidden />} />
          <MoreLink to="/owner/kyc" label="Verification" icon={<ShieldAlert className="h-4.5 w-4.5" aria-hidden />} />
        </div>
      </Modal>
    </>
  );
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function OwnerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const kycStatus = user?.role === 'owner' ? user.kycStatus : undefined;
  const needsAttention = kycStatus !== undefined && kycStatus !== 'approved';

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
          <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-5">
            <span className="flex items-center gap-2.5">
              <BrandLockup />
              <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-extrabold uppercase text-primary">Owner</span>
            </span>
            <NotificationBell />
          </div>
          <nav aria-label="Owner navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
            <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Overview</p>
            {OWNER_NAV.primary.map((l) => (
              <NavItem key={l.to} to={l.to} label={l.label} />
            ))}
            <div className="mx-4 my-3 border-t border-border" />
            <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Business</p>
            {OWNER_NAV.business.map((l) => (
              <NavItem key={l.to} to={l.to} label={l.label} />
            ))}
          </nav>
          <div className="space-y-1 border-t border-border p-3">
            <Link
              to="/owner/bookings/new"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" aria-hidden /> New Booking
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-5 w-5" aria-hidden /> Logout
            </button>
          </div>
        </aside>

        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <span className="flex items-center gap-2.5">
            <BrandLockup />
            <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-extrabold uppercase text-primary">Owner</span>
          </span>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="max-w-28 truncate text-sm font-bold text-card-foreground">{user?.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden />
            </button>
          </div>
        </header>

        {needsAttention && (
          <div className="px-4 pt-3 lg:ml-64 lg:px-8 lg:pt-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-highlight/60 bg-highlight/15 px-4 py-3">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 shrink-0 text-highlight-foreground" aria-hidden />
                <p className="text-xs font-bold text-highlight-foreground">
                  {kycStatus === 'pending'
                    ? 'Your business verification is under review. Manage your existing grounds while you wait.'
                    : kycStatus === 'declined'
                      ? 'Your business verification was not approved. Please resubmit to keep selling.'
                      : 'Complete your business verification.'}
                </p>
              </div>
              <Link
                to="/owner/kyc"
                className="shrink-0 text-xs font-bold text-highlight-foreground underline underline-offset-2"
              >
                Review
              </Link>
            </div>
          </div>
        )}

        <main className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-32 sm:px-6 lg:ml-64 lg:px-8 lg:pb-16 lg:pt-8">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </ToastProvider>
  );
}

export default OwnerLayout;