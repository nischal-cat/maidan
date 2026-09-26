const DEPOSIT_RATE = 0.4;

// Single-slot customer bookings collect DEPOSIT_RATE online;
// the balance (total - deposit) is due at the venue.
function computeDeposit(price) {
  const total = Number(price);
  const deposit = Math.round(total * DEPOSIT_RATE);
  const balance = Math.round(Math.max(0, total - deposit) * 100) / 100;
  return { deposit, balance };
}

// Cancellation policy:
//  - On time (>= 24h before start): free. Online money is refunded in full.
//  - Late (< 24h):
//      * single slot: the 40% deposit is the fee (no separate payment).
//      * multi-slot batch: a flat 40% of the total is the fee;
//        the remaining 60% is refunded.
function computeCancellationFee({ totalPrice, depositAmount, isBatch, isLate }) {
  const total = Number(totalPrice);
  const deposit = parseFloat(depositAmount) || 0;
  let fee = 0;
  let refundAmount = 0;

  if (isLate) {
    fee = isBatch
      ? Math.round(total * DEPOSIT_RATE)
      : deposit > 0 ? deposit : Math.round(total * DEPOSIT_RATE);
  } else {
    refundAmount = isBatch ? total : deposit;
  }

  return { fee, refundAmount };
}

module.exports = { DEPOSIT_RATE, computeDeposit, computeCancellationFee };