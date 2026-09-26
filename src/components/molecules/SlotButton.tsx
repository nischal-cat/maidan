interface SlotButtonProps {
  id?: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'held' | 'booked' | 'maintenance' | 'blocked';
  price: number;
  selected?: boolean;
  allowToggle?: boolean;
  past?: boolean;
  onClick?: () => void;
}

const statusStyles: Record<Exclude<SlotButtonProps['status'], 'available'>, string> = {
  held: 'border-border bg-muted text-muted-foreground cursor-not-allowed',
  booked: 'border-border bg-muted text-muted-foreground cursor-not-allowed',
  maintenance: 'border-destructive/20 bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive hover:text-destructive-foreground',
  blocked: 'border-border bg-muted text-muted-foreground cursor-not-allowed',
};

const availableStyle =
  'border-primary/30 bg-primary/10 text-primary cursor-pointer hover:bg-primary hover:text-primary-foreground';

const selectedStyle = 'border-primary bg-primary text-primary-foreground';

const statusLabel: Record<SlotButtonProps['status'], string> = {
  available: 'price',
  held: 'Held',
  booked: 'Booked',
  maintenance: 'Unavailable',
  blocked: 'Unavailable',
};

export default function SlotButton({
  id,
  startTime,
  endTime,
  status,
  price,
  selected = false,
  allowToggle = false,
  past = false,
  onClick,
}: SlotButtonProps) {
  const interactive = !past && (status === 'available' || (allowToggle && status === 'maintenance'));
  const disabled = !interactive;

  const buttonStyle = past
    ? 'border-border bg-muted text-muted-foreground cursor-not-allowed'
    : selected && status === 'available'
      ? selectedStyle
      : status === 'available'
        ? availableStyle
        : statusStyles[status];

  const label = past ? 'Past' : statusLabel[status] === 'price' ? `Rs ${price.toLocaleString()}` : statusLabel[status];

  return (
    <button
      id={id}
      disabled={disabled}
      aria-pressed={selected && !past ? true : undefined}
      onClick={interactive ? onClick : undefined}
      className={`rounded-xl border p-3 text-center text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${buttonStyle}`}
    >
      <div>{startTime} - {endTime}</div>
      <div className="mt-1 text-xs font-semibold">
        {label}
      </div>
    </button>
  );
}