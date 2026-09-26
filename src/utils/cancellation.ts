import { FREE_CANCELLATION_HOURS, DEPOSIT_RATE } from '../types';
import type { Booking } from '../types';

// Postgres TIME columns arrive as 'HH:MM:SS'. Appending ':00' to that produces
// 'HH:MM:SS:00', which Date cannot parse — the resulting NaN made
// canCancelFreely() always report false, so every cancellation was quoted as a
// late one. Normalise to 'HH:MM' before building the Date.
function slotStart(slotDate: string, slotTime: string): Date {
  return new Date(`${slotDate.slice(0, 10)}T${String(slotTime).slice(0, 5)}`);
}

export function canCancelFreely(slotDate: string, slotTime: string): boolean {
  const slotDateTime = slotStart(slotDate, slotTime);
  const now = new Date();
  if (Number.isNaN(slotDateTime.getTime())) return false;
  const hoursUntil = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntil >= FREE_CANCELLATION_HOURS;
}

// Late-cancellation fee:
//  - single slot: the 40% deposit already paid is the fee.
//  - multi-slot batch: a flat 40% of the total is the fee.
export function getCancellationFee(params: {
  slotDate: string;
  slotTime: string;
  totalPrice: number;
  depositAmount?: number;
  isBatch?: boolean;
}): number {
  const { slotDate, slotTime, totalPrice, depositAmount = 0, isBatch = false } = params;
  if (canCancelFreely(slotDate, slotTime)) return 0;
  if (isBatch) return Math.round(totalPrice * DEPOSIT_RATE);
  return depositAmount > 0 ? depositAmount : Math.round(totalPrice * DEPOSIT_RATE);
}

export function describeBookingPayment(booking: Booking): string {
  if (booking.batchGroupId) return 'Paid online in one combined payment';
  if (booking.depositPaid) return `Deposit paid (Rs ${booking.depositAmount ?? 0}) · Balance Rs ${booking.balanceAmount ?? 0} at venue`;
  if (booking.paymentStatus === 'paid') return 'Paid online';
  return booking.paymentStatus ?? 'unpaid';
}

export function getHoursUntilSlot(slotDate: string, slotTime: string): number {
  const slotDateTime = slotStart(slotDate, slotTime);
  const now = new Date();
  if (Number.isNaN(slotDateTime.getTime())) return Number.POSITIVE_INFINITY;
  return (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
}