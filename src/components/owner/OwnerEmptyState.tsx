import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function OwnerEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center',
        className
      )}
    >
      {icon && <div className="mb-1 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-extrabold text-card-foreground">{title}</h3>
      {description && <p className="max-w-sm text-xs font-medium text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-10 text-center">
      <p className="text-sm font-bold text-destructive">{message ?? 'Something went wrong loading this page.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full bg-destructive px-5 py-2.5 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}