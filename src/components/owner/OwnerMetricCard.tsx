import type { ReactNode } from 'react';
import { Card } from '../ui/card';

export function OwnerMetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'primary' | 'warning' | 'neutral';
}) {
  const valueClass =
    tone === 'primary' ? 'text-primary' : tone === 'warning' ? 'text-highlight-foreground' : 'text-foreground';
  const iconWrap =
    tone === 'primary'
      ? 'bg-primary/15 text-primary'
      : tone === 'warning'
        ? 'bg-highlight/30 text-highlight-foreground'
        : 'bg-secondary text-secondary-foreground';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">{label}</span>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-full ${iconWrap}`}>{icon}</span>}
      </div>
      <div className={valueClass}>
        <span className="text-2xl font-extrabold leading-none tracking-tight">{value}</span>
      </div>
      {hint && <p className="text-xs font-semibold text-muted-foreground">{hint}</p>}
    </Card>
  );
}