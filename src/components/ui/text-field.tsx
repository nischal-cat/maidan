import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function TextField({ label, error, className, id, ...props }: TextFieldProps) {
  const inputId = React.useId();
  const resolvedId = id ?? inputId;
  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label htmlFor={resolvedId} className="text-[10px] font-extrabold uppercase text-muted-foreground">
          {label}
        </label>
      )}
      <input
        id={resolvedId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}