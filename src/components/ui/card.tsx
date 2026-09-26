import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ className, children, padding = true, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-card shadow-card', padding && 'p-4 sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}