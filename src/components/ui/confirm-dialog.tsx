import type { ReactNode } from 'react';
import Modal from '../organisms/Modal';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} title={title}>
      <div className="space-y-5">
        {description && <div className="text-sm font-medium leading-relaxed text-muted-foreground">{description}</div>}
        {children}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="sm:flex-1" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            className="sm:flex-1"
            loading={loading}
            onClick={onConfirm}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}