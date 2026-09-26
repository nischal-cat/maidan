import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ToastProvider } from '../ui/toast';
import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  sidebarLinks: { to: string; label: string; icon?: ReactNode }[];
}

export default function DashboardLayout({ children, sidebarLinks }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <ToastProvider>
      <div className="flex min-h-[calc(100vh-72px)] bg-background">
      <aside className="hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Signed in as</p>
          <p className="mt-1 truncate font-bold text-card-foreground">{user?.name}</p>
        </div>
        <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 p-3">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={location.pathname === link.to ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                location.pathname === link.to
                  ? 'bg-primary/10 font-bold text-primary'
                  : 'font-semibold text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      </div>
    </ToastProvider>
  );
}
