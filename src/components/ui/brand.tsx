import { cn } from '../../lib/utils';

export function BrandLockup({ className, hideText }: { className?: string; hideText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img
        src="/maidanlogo.jpg"
        alt="Maidan"
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
      />
      {!hideText && <span className="text-xl font-extrabold tracking-normal">maidan</span>}
    </span>
  );
}
