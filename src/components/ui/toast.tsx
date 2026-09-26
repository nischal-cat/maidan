/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

let nextToastId = 1;
const TOAST_DURATION_MS = 4000;
const TOAST_LIMIT = 3;

const variantMeta: Record<ToastVariant, { ring: string; icon: ReactNode }> = {
  success: {
    ring: 'text-primary',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />,
  },
  error: {
    ring: 'text-destructive',
    icon: <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />,
  },
  info: {
    ring: 'text-muted-foreground',
    icon: <Info className="h-5 w-5 shrink-0" aria-hidden />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(({ title, description, variant = 'success' }) => {
    const id = nextToastId++;
    setToasts((prev) => {
      const next = [...prev, { id, title, description, variant }];
      return next.length > TOAST_LIMIT ? next.slice(next.length - TOAST_LIMIT) : next;
    });
    window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-5"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className="animate-toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <span className={cn('mt-0.5', variantMeta[t.variant].ring)}>{variantMeta[t.variant].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-card-foreground">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}