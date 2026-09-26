const KHALTI_API_BASE = process.env.KHALTI_API_BASE || 'https://dev.khalti.com/api/v2';
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;

/**
 * Initiate a Khalti payment.
 * Returns { payment_url, pidx } for redirecting the user.
 */
async function initiatePayment({ bookingId, amountNpr, customerInfo }) {
  const amountPaisa = Math.round(Number(amountNpr) * 100);
  const purchaseOrderId = `MAIDAN-${bookingId}-${Date.now()}`;

  const response = await fetch(`${KHALTI_API_BASE}/epayment/initiate/`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      return_url: `${process.env.APP_BASE_URL}/api/payments/khalti/return`,
      website_url: process.env.APP_BASE_URL,
      amount: amountPaisa,
      purchase_order_id: purchaseOrderId,
      purchase_order_name: `Maidan booking ${bookingId}`,
      customer_info: {
        name: customerInfo.name || 'Customer',
        email: customerInfo.email || '',
        phone: customerInfo.phone || '',
      },
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.pidx || !result.payment_url) {
    console.error('Khalti initiation failed:', result);
    throw new Error(`Khalti initiation failed: ${JSON.stringify(result)}`);
  }

  return {
    redirectUrl: result.payment_url,
    pidx: result.pidx,
    providerOrderId: purchaseOrderId,
  };
}

/**
 * Look up a Khalti payment status by pidx.
 * Returns the full lookup result including status.
 */
async function lookupPayment(pidx) {
  const response = await fetch(`${KHALTI_API_BASE}/epayment/lookup/`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pidx }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('Khalti lookup failed:', result);
    throw new Error(`Khalti lookup failed: ${JSON.stringify(result)}`);
  }

  return result;
}

/**
 * Normalize Khalti lookup result to a standard status.
 * Only "Completed" is treated as success.
 */
function normalizeStatus(khaltiStatus) {
  switch (khaltiStatus) {
    case 'Completed': return 'success';
    case 'Pending': return 'pending';
    case 'Refunded':
    case 'Expired':
    case 'User canceled':
    case 'Canceled': return 'failed';
    default: return 'pending';
  }
}

module.exports = {
  initiatePayment,
  lookupPayment,
  normalizeStatus,
};
