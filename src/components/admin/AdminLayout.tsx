import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, MoreHorizontal, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV, isAdminSectionActive, type AdminNavLink } from '../../constants';
import { ToastProvider } from '../ui/toast';
import { BrandLockup } from '../ui/brand';
import NotificationBell from '../ui/notification-bell';
import Modal from '../organisms/Modal';
import { cn } from '../../lib/utils';

function NavItem({ link }: { link: AdminNavLink }) {
  const location = useLocation();
  const active = isAdminSectionActive(location.pathname, link.to);
  return (
    <Link
      to={link.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary/10 font-bold text-primary'
          : 'font-semibold text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {link.icon}
      {link.label}
    </Link>
  );
}

function SidebarNav() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const perms = user?.permissions ?? [];

  const sections = ADMIN_NAV.map((section) => ({
    ...section,
    links: section.links.filter((link) => {
      if (link.adminOnly) return isAdmin;
      if (!link.perm) return true;
      return isAdmin || perms.includes(link.perm);
    }),
  })).filter((section) => section.links.length > 0);

  return (
    <nav aria-label="Admin navigation" className="flex-1 space-y-5 overflow-y-auto p-3">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">{section.title}</p>
          <div className="space-y-1">
            {section.links.map((link) => (
              <NavItem key={link.to} link={link} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function MobileTab({ to, label, icon, onOpen }: { to?: string; label: string; icon: React.ReactNode; onOpen?: () => void }) {
  const location = useLocation();
  const active = to ? isAdminSectionActive(location.pathname, to) : false;

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
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const perms = user?.permissions ?? [];

  const allowed = (link: AdminNavLink) => {
    if (link.adminOnly) return isAdmin;
    if (!link.perm) return true;
    return isAdmin || perms.includes(link.perm);
  };

  const allLinks = ADMIN_NAV.flatMap((section) => section.links).filter(allowed);
  const primaryOrder = ['/admin', '/admin/bookings', '/admin/sellers'];
  const primary = primaryOrder.map((to) => allLinks.find((l) => l.to === to)).filter((l): l is AdminNavLink => Boolean(l));
  const moreLinks = allLinks.filter((l) => !primaryOrder.includes(l.to));
  const canBook = isAdmin || perms.includes('bookings');
  const mid = Math.ceil(primary.length / 2);
  const before = primary.slice(0, mid);
  const after = primary.slice(mid);

  const MoreLink = ({ link }: { link: AdminNavLink }) => (
    <button
      type="button"
      onClick={() => {
        setMoreOpen(false);
        navigate(link.to);
      }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {link.icon}
      {link.label}
    </button>
  );

  return (
    <>
      <nav
        aria-label="Admin quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3 px-3 py-1.5">
          {before.map((link) => (
            <MobileTab key={link.to} to={link.to} label={link.to === '/admin' ? 'Home' : link.label} icon={link.icon} />
          ))}
          {canBook && (
            <Link
              to="/admin/bookings/new"
              aria-label="New walk-in booking"
              className="mx-1 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-6 w-6" aria-hidden />
            </Link>
          )}
          {after.map((link) => (
            <MobileTab key={link.to} to={link.to} label={link.to === '/admin' ? 'Home' : link.label} icon={link.icon} />
          ))}
          {moreLinks.length > 0 && <MobileTab label="More" icon={<MoreHorizontal className="h-5 w-5" aria-hidden />} onOpen={() => setMoreOpen(true)} />}
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          {moreLinks.map((link) => (
            <MoreLink key={link.to} link={link} />
          ))}
        </div>
      </Modal>
    </>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
          <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-5">
            <span className="flex items-center gap-2.5">
              <BrandLockup />
              <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-extrabold uppercase text-primary">
                {user?.role === 'subadmin' ? 'Staff' : 'Admin'}
              </span>
            </span>
            <NotificationBell />
          </div>
          <div className="border-b border-border px-5 py-4">
            <p className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Signed in as</p>
            <p className="mt-1 truncate font-bold text-card-foreground">{user?.name}</p>
          </div>
          <SidebarNav />
          <div className="space-y-1 border-t border-border p-3">
            {user?.role === 'admin' || (user?.permissions ?? []).includes('bookings') ? (
              <Link
                to="/admin/bookings/new"
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" aria-hidden /> New Booking
              </Link>
            ) : null}
            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-5 w-5" aria-hidden /> View site
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
            <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-extrabold uppercase text-primary">
              {user?.role === 'subadmin' ? 'Staff' : 'Admin'}
            </span>
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

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 pb-32 sm:px-6 lg:ml-64 lg:px-8 lg:pb-16 lg:pt-8">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </ToastProvider>
  );
}