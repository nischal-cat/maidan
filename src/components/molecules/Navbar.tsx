import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, LocateFixed, MapPin, Menu, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocationCity } from '../../context/LocationContext';
import { useCities } from '../../hooks/useCities';
import { Button } from '../ui/button';
import { BrandLockup } from '../ui/brand';
import NotificationBell from '../ui/notification-bell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { city, setCity, detecting, detectLocation } = useLocationCity();
  const { cityNames } = useCities();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isBackoffice = user && (user.role === 'owner' || user.role === 'admin' || user.role === 'subadmin');
  const base = user ? (user.role === 'admin' || user.role === 'subadmin' ? '/admin' : '/owner') : '/';
  const isAdminRole = user?.role === 'admin' || user?.role === 'subadmin';
  const perms = user?.permissions ?? [];
  const can = (perm: string): boolean => user?.role === 'admin' || perms.includes(perm);

  const desktopAdminLinks = [
    { to: `${base}`, label: 'Dashboard' },
    ...(isAdminRole
      ? [
          { to: `${base}/grounds`, label: 'Grounds', perm: 'grounds' },
          { to: `${base}/slots`, label: 'Slots', perm: 'slots' },
          { to: `${base}/bookings`, label: 'Bookings', perm: 'bookings' },
          { to: `${base}/reports`, label: 'Reports', perm: 'reports' },
          ...(user?.role === 'admin' ? [{ to: `${base}/cities`, label: 'Cities' }] : []),
        ].filter((l) => !l.perm || can(l.perm))
      : [
          { to: `${base}/grounds`, label: 'My Grounds' },
          { to: `${base}/slots`, label: 'Slots' },
          { to: `${base}/bookings`, label: 'Bookings' },
          { to: `${base}/reports`, label: 'Earnings' },
          { to: `${base}/kyc`, label: 'Verification' },
        ]),
  ];

  const mobileAdminLinks = isAdminRole
    ? [
        { to: `${base}`, label: 'Dashboard' },
        { to: `${base}/grounds`, label: 'Manage Grounds', perm: 'grounds' },
        { to: `${base}/slots`, label: 'Slots & Pricing', perm: 'slots' },
        { to: `${base}/bookings`, label: 'All Bookings', perm: 'bookings' },
        { to: `${base}/reports`, label: 'Reports', perm: 'reports' },
        { to: `${base}/sellers`, label: 'Seller KYC', perm: 'sellers' },
        { to: `${base}/users`, label: 'Users', perm: 'users' },
        ...(user?.role === 'admin' ? [{ to: `${base}/cities`, label: 'Cities' }] : []),
      ].filter((l) => !l.perm || can(l.perm))
    : [
        { to: `${base}`, label: 'Dashboard' },
        { to: `${base}/grounds`, label: 'My Grounds' },
        { to: `${base}/slots`, label: 'Slots & Pricing' },
        { to: `${base}/bookings`, label: 'My Bookings' },
        { to: `${base}/reports`, label: 'Earnings & Report' },
        { to: `${base}/kyc`, label: 'Verification' },
      ];

  const isActive = (to: string) => routeLocation.pathname === to;

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-18">
          <Link to={isBackoffice ? base : '/'} className="flex items-center gap-2.5 text-foreground" aria-label="Maidan home">
            <BrandLockup />
            {isBackoffice && (
              <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-extrabold uppercase text-primary">
                {user?.role === 'subadmin' ? 'Staff' : isAdminRole ? 'Admin' : 'Owner'}
              </span>
            )}
          </Link>

          {/* Location selector - desktop */}
          {!isBackoffice && (
            <div className="relative hidden md:flex lg:ml-10">
              <button
                onClick={() => setLocationOpen(!locationOpen)}
                aria-expanded={locationOpen}
                aria-haspopup="true"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <MapPin className="h-4 w-4 text-primary" aria-hidden />
                <span>{city}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${locationOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {locationOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLocationOpen(false)} aria-hidden />
                  <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-border bg-card py-1.5 shadow-card">
                    <button
                      onClick={async () => {
                        const ok = await detectLocation();
                        if (ok) setLocationOpen(false);
                      }}
                      disabled={detecting}
                      className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-left text-sm font-bold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45"
                    >
                      <LocateFixed className={`h-4 w-4 ${detecting ? 'animate-pulse' : ''}`} aria-hidden />
                      {detecting ? 'Detecting…' : 'Detect my location'}
                    </button>
                    <div className="mx-2 my-1 border-t border-border" />
                    {cityNames.map((cityOpt) => (
                      <button
                        key={cityOpt}
                        onClick={() => { setCity(cityOpt); setLocationOpen(false); }}
                        className={`w-full rounded-xl px-4 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          city === cityOpt
                            ? 'bg-accent font-bold text-primary'
                            : 'font-semibold text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {cityOpt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Desktop nav links */}
          <div className="hidden items-center gap-7 md:flex">
            {isBackoffice ? (
              <>
                {desktopAdminLinks.map((link) => (                  <Link
                    key={link.to}
                    to={link.to}
                    className={
                      isActive(link.to)
                        ? 'text-sm font-bold text-foreground'
                        : 'text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </>
            ) : user ? (
              <>
                {[
                  { to: '/grounds', label: 'Find courts' },
                  { to: '/bookings', label: 'My bookings' },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={
                      isActive(link.to)
                        ? 'text-sm font-bold text-foreground'
                        : 'text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </>
            ) : (
              <>
                {[
                  { to: '/grounds', label: 'Find Grounds' },
                  { to: '/#how-it-works', label: 'How It Works' },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={
                      isActive(link.to)
                        ? 'text-sm font-bold text-foreground'
                        : 'text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* Desktop auth */}
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <div className="relative flex items-center gap-1">
                <NotificationBell />
                <button
                  onClick={() => setAvatarOpen(!avatarOpen)}
                  aria-expanded={avatarOpen}
                  aria-haspopup="menu"
                  className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
                {avatarOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAvatarOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-border bg-card py-1.5 shadow-card" role="menu">
                      <div className="border-b border-border px-4 py-2">
                        <p className="truncate text-sm font-extrabold text-card-foreground">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Link
                        to="/dashboard"
                        onClick={() => setAvatarOpen(false)}
                        className="mt-1 block rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/bookings"
                        onClick={() => setAvatarOpen(false)}
                        className="block rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        My bookings
                      </Link>
                      <div className="mx-2 my-1 border-t border-border" />
                      <button
                        onClick={handleLogout}
                        className="block w-full rounded-xl px-4 py-2 text-left text-sm font-bold text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <Link to="/register">Sign Up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="grid h-11 w-11 place-items-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border py-3 md:hidden">
            {!isBackoffice && (
              <div className="px-3 py-2">
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Location</div>
                <div className="flex flex-wrap gap-2">
                  {cityNames.map((cityOpt) => (
                    <button
                      key={cityOpt}
                      onClick={() => { setCity(cityOpt); }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        city === cityOpt
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cityOpt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isBackoffice ? (
              <>
                {mobileAdminLinks.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive(link.to) ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                    {link.label}
                  </Link>
                ))}
              </>
            ) : user ? (
              <>
                <Link to="/grounds" onClick={() => setMobileOpen(false)} className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive('/grounds') ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>Find courts</Link>
                <Link to="/bookings" onClick={() => setMobileOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">My bookings</Link>
              </>
            ) : (
              <>
                <Link to="/grounds" onClick={() => setMobileOpen(false)} className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive('/grounds') ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>Find Grounds</Link>
                <Link to="/#how-it-works" onClick={() => setMobileOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">How It Works</Link>
              </>
            )}
            <div className="mt-2 border-t border-border px-3 pt-3">
              {user ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground">
                      <Bell className="h-4 w-4" aria-hidden />
                      Notifications
                    </span>
                    <NotificationBell />
                  </div>
                  <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-destructive transition-colors hover:bg-destructive/10">
                    <UserRound className="h-4 w-4" aria-hidden />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="w-full">Login</Link>
                  </Button>
                  <Button asChild variant="primary" size="sm" className="flex-1">
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="w-full">Sign Up</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
