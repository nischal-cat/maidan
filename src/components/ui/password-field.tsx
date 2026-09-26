import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function PasswordField({ label, error, className, id, ...props }: PasswordFieldProps) {
  const inputId = React.useId();
  const resolvedId = id ?? inputId;
  const [show, setShow] = React.useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label htmlFor={resolvedId} className="text-[10px] font-extrabold uppercase text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={resolvedId}
          type={show ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            error && 'border-destructive',
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}