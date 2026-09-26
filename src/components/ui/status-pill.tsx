import { cn } from '../../lib/utils';

export function StatusPill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-primary/15 px-2 py-1 text-[10px] font-extrabold uppercase text-primary',
        className
      )}
    >
      {children}
    </span>
  );
}
