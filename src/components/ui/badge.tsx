import { cn } from '../../lib/utils';

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'absolute bottom-3 left-3 rounded-full bg-surface-strong/90 px-3 py-1.5 text-xs font-bold text-surface-strong-foreground',
        className
      )}
    >
      {children}
    </span>
  );
}
