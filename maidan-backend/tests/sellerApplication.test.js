const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sellerApplySchema, registerSchema } = require('../middleware/validation');

describe('sellerApplySchema', () => {
  const player = {
    name: 'Ramesh Thapa',
    email: 'ramesh@example.com',
    phone: '9800000000',
    password: 'secret123',
  };

  it('accepts a plain player registration (no owner required)', () => {
    const result = sellerApplySchema.safeParse({ ...player, role: 'player' });
    assert.ok(result.success, JSON.stringify(result.error?.errors));
    assert.strictEqual(result.data.role, 'player');
  });

  it('accepts a full seller application', () => {
    const owner = {
      ...player,
      role: 'owner',
      businessName: 'Himalayan Futsal',
      businessType: ['Futsal', 'Cricket'],
      businessCity: 'Kathmandu',
      businessAddress: 'Baneshwor, Kathmandu',
      businessContact: '9800000001',
      registrationNumber: 'PAN-123456',
      businessDescription: 'Two futsal courts.',
    };
    const result = sellerApplySchema.safeParse(owner);
    assert.ok(result.success, JSON.stringify(result.error?.errors));
    assert.deepStrictEqual(result.data.businessType, ['Futsal', 'Cricket']);
  });

  it('rejects an owner application missing seller fields', () => {
    const result = sellerApplySchema.safeParse({ ...player, role: 'owner' });
    assert.ok(!result.success, 'should fail validation');
    const messages = result.error.errors.map((e) => e.message);
    assert.ok(messages.includes('Business name is required for sellers'));
    assert.ok(messages.includes('Select at least one business type'));
    assert.ok(messages.includes('Business city is required'));
    assert.ok(messages.includes('Business address is required'));
    assert.ok(messages.includes('Business contact phone is required'));
  });

  it('rejects an owner application with an empty businessType array', () => {
    const owner = {
      ...player,
      role: 'owner',
      businessName: 'Himalayan Futsal',
      businessType: [],
      businessCity: 'Kathmandu',
      businessAddress: 'Baneshwor',
      businessContact: '9800000001',
    };
    const result = sellerApplySchema.safeParse(owner);
    assert.ok(!result.success);
    assert.ok(result.error.errors.some((e) => e.message === 'Select at least one business type'));
  });

  it('stays compatible with registerSchema for players', () => {
    const val = registerSchema.safeParse(player);
    assert.ok(val.success);
  });
});