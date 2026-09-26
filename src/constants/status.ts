export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

export const bookingStatusVariant: Record<string, StatusVariant> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'info',
  cancelled: 'error',
  late_cancelled: 'error',
};

export const kycStatusVariant: Record<string, StatusVariant> = {
  approved: 'success',
  pending: 'warning',
  declined: 'error',
  none: 'default',
};

export const roleVariant: Record<string, StatusVariant> = {
  player: 'success',
  owner: 'info',
  admin: 'error',
  subadmin: 'info',
};

export const paymentStatusVariant: Record<string, StatusVariant> = {
  unpaid: 'default',
  pending: 'warning',
  paid: 'success',
  refunded: 'info',
  partial_refund: 'warning',
};