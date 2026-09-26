import { cn } from '../../lib/utils';

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground',
        className
      )}
    >
      {children}
    </span>
  );
}
