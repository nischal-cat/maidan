const crypto = require('crypto');

const ESEWA_FORM_URL = process.env.ESEWA_FORM_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_STATUS_URL = process.env.ESEWA_STATUS_URL || 'https://rc.esewa.com.np/api/epay/transaction/status/';
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY;

/**
 * Generate HMAC-SHA256 Base64 signature for eSewa.
 * Message format: total_amount=X,transaction_uuid=Y,product_code=Z
 */
function hmacBase64(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}

/**
 * Build the eSewa form fields for redirect.
 * Returns an object with all form fields the frontend should POST.
 */
function buildFormFields({ bookingId, amountNpr }) {
  const safeBookingId = String(bookingId).replace(/[^A-Za-z0-9-]/g, '');
  const transactionUuid = `MAIDAN-${safeBookingId}-${Date.now()}`;
  const totalAmount = Number(amountNpr).toFixed(2);
  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';

  const message = [
    `total_amount=${totalAmount}`,
    `transaction_uuid=${transactionUuid}`,
    `product_code=${ESEWA_PRODUCT_CODE}`,
  ].join(',');

  const signature = hmacBase64(message, ESEWA_SECRET_KEY);

  return {
    formUrl: ESEWA_FORM_URL,
    fields: {
      amount: totalAmount,
      tax_amount: '0',
      total_amount: totalAmount,
      transaction_uuid: transactionUuid,
      product_code: ESEWA_PRODUCT_CODE,
      product_service_charge: '0',
      product_delivery_charge: '0',
      signed_field_names: signedFieldNames,
      signature,
      success_url: `${baseUrl}/api/payments/esewa/success`,
      failure_url: `${baseUrl}/api/payments/esewa/failure`,
    },
    transactionUuid,
  };
}

/**
 * Verify the Base64-decoded callback response from eSewa.
 * Returns { verified, data, reason }.
 */
function verifyCallback(encodedResponse) {
  try {
    const decoded = JSON.parse(Buffer.from(encodedResponse, 'base64').toString('utf-8'));

    // Recreate the HMAC message from the returned signed_field_names
    const signedFields = decoded.signed_field_names.split(',');
    const messageParts = signedFields.map((field) => `${field}=${decoded[field]}`);
    const expectedSignature = hmacBase64(messageParts.join(','), ESEWA_SECRET_KEY);

    if (expectedSignature !== decoded.signature) {
      return { verified: false, data: decoded, reason: 'Signature mismatch' };
    }

    return { verified: true, data: decoded, reason: null };
  } catch (error) {
    return { verified: false, data: null, reason: `Decode error: ${error.message}` };
  }
}

/**
 * Check transaction status with eSewa (for ambiguous/callback-missed cases).
 */
async function checkStatus({ transactionUuid, totalAmount }) {
  const url = `${ESEWA_STATUS_URL}?product_code=${ESEWA_PRODUCT_CODE}&total_amount=${totalAmount}&transaction_uuid=${transactionUuid}`;

  const response = await fetch(url);
  const result = await response.json();

  return result;
}

/**
 * Normalize eSewa status to standard status.
 */
function normalizeStatus(esewaStatus) {
  switch (esewaStatus) {
    case 'COMPLETE': return 'success';
    case 'PENDING': return 'pending';
    case 'FULL_REFUND':
    case 'PARTIAL_REFUND':
    case 'AMBIGUOUS':
    case 'NOT_FOUND':
    case 'CANCELED': return 'failed';
    default: return 'pending';
  }
}

module.exports = {
  buildFormFields,
  verifyCallback,
  checkStatus,
  normalizeStatus,
  ESEWA_FORM_URL,
  ESEWA_PRODUCT_CODE,
};
