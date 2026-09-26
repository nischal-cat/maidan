const { describe, it } = require('node:test');
const assert = require('node:assert');
const { requireApprovedSeller } = require('../middleware/auth');

function runMiddleware(req) {
  const res = { statusCode: null, body: null };
  const resMock = {
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(body) {
      res.body = body;
      return this;
    },
  };
  let nextCalled = false;
  requireApprovedSeller(req, resMock, () => {
    nextCalled = true;
  });
  return { statusCode: res.statusCode, body: res.body, nextCalled };
}

describe('requireApprovedSeller', () => {
  it('lets an approved owner through', () => {
    const out = runMiddleware({ user: { role: 'owner', kyc_status: 'approved' } });
    assert.strictEqual(out.nextCalled, true);
    assert.strictEqual(out.statusCode, null);
  });

  it('blocks a pending owner', () => {
    const out = runMiddleware({ user: { role: 'owner', kyc_status: 'pending' } });
    assert.strictEqual(out.nextCalled, false);
    assert.strictEqual(out.statusCode, 403);
    assert.match(out.body.message, /under review/i);
  });

  it('blocks a declined owner', () => {
    const out = runMiddleware({ user: { role: 'owner', kyc_status: 'declined' } });
    assert.strictEqual(out.nextCalled, false);
    assert.strictEqual(out.statusCode, 403);
  });

  it('does not gate admins or subadmins', () => {
    for (const role of ['admin', 'subadmin']) {
      const out = runMiddleware({ user: { role, kyc_status: 'none' } });
      assert.strictEqual(out.nextCalled, true, `${role} should pass`);
    }
  });
});