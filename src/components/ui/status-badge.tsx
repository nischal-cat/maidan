import * as React from 'react';
import { cn } from '../../lib/utils';

const statusStyles = {
  success: 'bg-primary/15 text-primary',
  warning: 'bg-highlight/30 text-highlight-foreground',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-secondary text-secondary-foreground',
  default: 'bg-muted text-muted-foreground',
} as const;

export type StatusBadgeVariant = keyof typeof statusStyles;

export function StatusBadge({
  variant = 'default',
  className,
  children,
}: {
  variant?: StatusBadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', statusStyles[variant], className)}
    >
      {children}
    </span>
  );
}