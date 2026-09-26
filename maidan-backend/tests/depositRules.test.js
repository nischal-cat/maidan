const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeDeposit, computeCancellationFee } = require('../services/depositRules');
const { batchBookingSchema } = require('../middleware/validation');

test('computeDeposit: 40% deposit, balance is the remainder', () => {
  assert.deepEqual(computeDeposit('1000'), { deposit: 400, balance: 600 });
  assert.deepEqual(computeDeposit('250'), { deposit: 100, balance: 150 });
  assert.deepEqual(computeDeposit('1500'), { deposit: 600, balance: 900 });
});

test('computeDeposit: rounds deposit to the nearest rupee', () => {
  assert.deepEqual(computeDeposit('333.33'), { deposit: 133, balance: 200.33 });
  assert.deepEqual(computeDeposit('0'), { deposit: 0, balance: 0 });
});

test('single-slot on-time cancellation: no fee, deposit refunded', () => {
  const r = computeCancellationFee({ totalPrice: 1000, depositAmount: 400, isBatch: false, isLate: false });
  assert.equal(r.fee, 0);
  assert.equal(r.refundAmount, 400);
});

test('single-slot late cancellation: the deposit IS the fee, nothing refunded', () => {
  const r = computeCancellationFee({ totalPrice: 1000, depositAmount: 400, isBatch: false, isLate: true });
  assert.equal(r.fee, 400);
  assert.equal(r.refundAmount, 0);
});

test('multi-slot on-time cancellation: no fee, full payment refunded', () => {
  const r = computeCancellationFee({ totalPrice: 2400, depositAmount: 0, isBatch: true, isLate: false });
  assert.equal(r.fee, 0);
  assert.equal(r.refundAmount, 2400);
});

test('multi-slot late cancellation: flat 40% fee, 60% refunded', () => {
  const r = computeCancellationFee({ totalPrice: 2400, depositAmount: 0, isBatch: true, isLate: true });
  assert.equal(r.fee, 960);
  assert.equal(r.refundAmount, 0);
});

test('single-slot legacy booking with no deposit still gets a 40% late fee', () => {
  const r = computeCancellationFee({ totalPrice: 1000, depositAmount: 0, isBatch: false, isLate: true });
  assert.equal(r.fee, 400);
});

test('batchBookingSchema: accepts 2 to 6 slot ids', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  const result = batchBookingSchema.safeParse({
    slotIds: [uuid, '22222222-2222-4222-8222-222222222222'],
    playersCount: 8,
  });
  assert.equal(result.success, true);
});

test('batchBookingSchema: rejects a single slot (must be multi-slot)', () => {
  const result = batchBookingSchema.safeParse({
    slotIds: ['11111111-1111-4111-8111-111111111111'],
  });
  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error.errors), /at least 2/);
});

test('batchBookingSchema: rejects more than 6 slots', () => {
  const slotIds = Array.from(
    { length: 7 },
    (_, i) => `11111111-1111-4111-8111-1111111111${String(i).padStart(2, '0')}`
  );
  const result = batchBookingSchema.safeParse({ slotIds });
  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error.errors), /Maximum 6 slots/);
});

test('batchBookingSchema: rejects a malformed slot id', () => {
  const result = batchBookingSchema.safeParse({
    slotIds: ['not-a-uuid', '11111111-1111-4111-8111-111111111111'],
  });
  assert.equal(result.success, false);
});