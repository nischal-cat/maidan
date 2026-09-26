// Phase 0 security hardening — route-level integration tests.
//
// These spin up the real Express routers (adminRoutes, bookingRoutes,
// slotRoutes) with a stubbed pg pool, so every middleware + controller guard
// is exercised end-to-end without a live database.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase0-test-secret';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const { pool } = require('../db');

const state = {
  user: null,
  booking: null,
  ground: null,
  hasBookings: false,
  sellers: [],
  sellerById: null,
  usersList: [],
  bookingCancelled: false,
  groundsDeleted: 0,
};

function resetState() {
  Object.assign(state, {
    user: null,
    booking: null,
    ground: null,
    hasBookings: false,
    sellers: [],
    sellerById: null,
    usersList: [],
    bookingCancelled: false,
    groundsDeleted: 0,
  });
}

function mkUser(over) {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 'user@example.com',
    phone: '9800000000',
    role: 'player',
    is_phone_verified: true,
    kyc_status: 'none',
    permissions: [],
    ...over,
  };
}

const ownerA = () => mkUser({ id: 'ownerA', role: 'owner', kyc_status: 'approved' });
const adminUser = () => mkUser({ id: 'admin1', role: 'admin' });

function sellerRow(id) {
  return {
    id,
    name: 'Seller ' + id,
    email: 'seller@example.com',
    phone: '9800000001',
    business_name: 'Seller Grounds',
    kyc_status: 'pending',
    kyc_document_url: null,
    kyc_note: null,
    kyc_reviewed_at: null,
    created_at: new Date().toISOString(),
    business_type: ['futsal'],
    business_city: 'Kathmandu',
    business_address: 'Main Road',
    business_contact: '9800000001',
    registration_number: 'REG-1',
    business_description: 'A test ground',
    ground_count: 2,
  };
}

function queryStub(sql, _params = []) {
  const s = String(sql).replace(/\s+/g, ' ').trim();
  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s)) return { rows: [] };
  if (s.includes('information_schema.columns')) return { rows: [{ ok: true }] };
  if (/^SELECT id, name, email, phone, role, is_phone_verified, kyc_status, permissions FROM users WHERE id = \$1$/.test(s)) {
    return { rows: state.user ? [state.user] : [] };
  }
  if (/SELECT b\.\*, g\.name as ground_name, g\.owner_id FROM bookings/.test(s)) {
    return { rows: state.booking ? [state.booking] : [] };
  }
  if (/UPDATE slots SET status = 'available', held_by_user_id = NULL/.test(s)) return { rows: [] };
  if (/UPDATE bookings SET status = 'cancelled'/.test(s)) {
    state.bookingCancelled = true;
    return { rows: [] };
  }
  if (/^SELECT id, owner_id FROM grounds WHERE id = \$1$/.test(s)) {
    return { rows: state.ground ? [state.ground] : [] };
  }
  if (/SELECT 1 FROM bookings WHERE ground_id = \$1 LIMIT 1/.test(s)) {
    return { rows: state.hasBookings ? [{}] : [] };
  }
  if (/DELETE FROM grounds WHERE id = \$1/.test(s)) {
    state.groundsDeleted += 1;
    return { rows: [] };
  }
  if (/SELECT COUNT\(\*\) FROM users u/.test(s)) return { rows: [{ count: String(state.sellers.length) }] };
  if (/SELECT u\.id, u\.name/.test(s) && /AND u\.id = \$1/.test(s)) {
    return { rows: state.sellerById ? [state.sellerById] : [] };
  }
  if (/SELECT u\.id, u\.name/.test(s)) return { rows: state.sellers };
  if (/SELECT COUNT\(\*\) FROM users WHERE/.test(s)) return { rows: [{ count: String(state.usersList.length) }] };
  if (/SELECT id, name, email, phone, role, is_phone_verified, kyc_status, business_name, permissions, created_at FROM users WHERE 1=1/.test(s)) {
    return { rows: state.usersList };
  }
  if (/SELECT id, base_price, peak_price, operating_start, operating_end FROM grounds WHERE id = \$1/.test(s)) {
    return { rows: [{ id: 'g1', base_price: '1000', peak_price: '1300', operating_start: '06:00', operating_end: '07:00' }] };
  }
  if (/INSERT INTO slots/.test(s)) return { rowCount: 1, rows: [] };
  if (/^SELECT owner_id FROM grounds WHERE id = \$1$/.test(s)) {
    return { rows: [{ owner_id: 'ownerA' }] };
  }
  throw new Error('Unhandled query in test stub: ' + s);
}

// Replace the singleton pool methods; the controllers share this instance.
pool.connect = async () => ({
  query: queryStub,
  release: () => {},
});
pool.query = async (sql, params) => queryStub(sql, params);

const app = express();
app.use(express.json());
app.use('/api/admin', require('../routes/adminRoutes'));
app.use('/api/bookings', require('../routes/bookingRoutes'));
app.use('/api/grounds', require('../routes/slotRoutes'));

let server;
let base = '';

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
});

function tokenFor(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
}

async function api(method, path, body) {
  const headers = {
    authorization: `Bearer ${tokenFor(state.user.id)}`,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, body: json };
}

describe('Phase 0 security hardening', () => {
  beforeEach(resetState);

  describe('seller/KYC administration is admin/subadmin only', () => {
    it('blocks ground owners from sellers, KYC review, and users', async () => {
      state.user = ownerA();
      state.booking = { id: 'b1', status: 'confirmed', slot_id: 'sl1', owner_id: 'ownerB', ground_name: 'Other Ground' };

      assert.strictEqual((await api('GET', '/api/admin/sellers')).status, 403);
      assert.strictEqual((await api('GET', '/api/admin/sellers/s-1')).status, 403);
      const kycReview = await api('PATCH', '/api/admin/sellers/s-1/kyc', { status: 'approved' });
      assert.strictEqual(kycReview.status, 403);
      assert.strictEqual((await api('GET', '/api/admin/users')).status, 403);
    });

    it('lets admins list sellers and fetch a single seller', async () => {
      state.user = adminUser();
      state.sellers = [sellerRow('s-1')];
      state.sellerById = sellerRow('s-2');

      const list = await api('GET', '/api/admin/sellers');
      assert.strictEqual(list.status, 200);
      assert.strictEqual(list.body.sellers[0].id, 's-1');
      assert.strictEqual(list.body.total, 1);

      const one = await api('GET', '/api/admin/sellers/s-2');
      assert.strictEqual(one.status, 200);
      assert.strictEqual(one.body.seller.id, 's-2');

      state.sellerById = null;
      assert.strictEqual((await api('GET', '/api/admin/sellers/missing')).status, 404);
    });

    it('gates subadmins on the sellers permission', async () => {
      state.user = mkUser({ id: 'staff1', role: 'subadmin', permissions: [] });
      assert.strictEqual((await api('GET', '/api/admin/sellers')).status, 403);

      state.user = mkUser({ id: 'staff1', role: 'subadmin', permissions: ['sellers'] });
      state.sellers = [sellerRow('s-1')];
      assert.strictEqual((await api('GET', '/api/admin/sellers')).status, 200);
    });

    it('lets admins list users and owners never reach the user directory', async () => {
      state.user = adminUser();
      state.usersList = [mkUser({ id: 'player1', role: 'player' })];
      const list = await api('GET', '/api/admin/users');
      assert.strictEqual(list.status, 200);
      assert.strictEqual(list.body.users[0].id, 'player1');

      state.user = ownerA();
      assert.strictEqual((await api('GET', '/api/admin/users')).status, 403);
    });
  });

  describe('admin booking cancellation is tenant-isolated', () => {
    it('blocks an owner cancelling a booking on another owners ground (both routes)', async () => {
      state.user = ownerA();
      state.booking = { id: 'b1', status: 'confirmed', slot_id: 'sl1', owner_id: 'ownerB', ground_name: 'Other Ground' };

      assert.strictEqual((await api('PATCH', '/api/admin/bookings/b1/cancel', {})).status, 403);
      assert.strictEqual((await api('PATCH', '/api/bookings/b1/admin-cancel', {})).status, 403);
      assert.strictEqual(state.bookingCancelled, false);
    });

    it('allows an owner to cancel a booking on their own ground', async () => {
      state.user = ownerA();
      state.booking = { id: 'b1', status: 'confirmed', slot_id: 'sl1', owner_id: 'ownerA', ground_name: 'My Ground' };

      const res = await api('PATCH', '/api/admin/bookings/b1/cancel', { reason: 'test' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(state.bookingCancelled, true);
    });

    it('allows admins to cancel any booking', async () => {
      state.user = adminUser();
      state.booking = { id: 'b1', status: 'confirmed', slot_id: 'sl1', owner_id: 'ownerB', ground_name: 'Other Ground' };

      assert.strictEqual((await api('PATCH', '/api/admin/bookings/b1/cancel', {})).status, 200);
    });
  });

  describe('KYC gate on admin ground mutations and slot generation', () => {
    it('blocks a pending owner from creating/updating/deleting grounds and generating slots', async () => {
      state.user = mkUser({ id: 'ownerA', role: 'owner', kyc_status: 'pending' });
      state.ground = { id: 'g1', owner_id: 'ownerA' };

      const create = await api('POST', '/api/admin/grounds', {});
      assert.strictEqual(create.status, 403);
      assert.match(create.body.message || '', /under review/i);

      assert.strictEqual((await api('PUT', '/api/admin/grounds/g1', {})).status, 403);
      assert.strictEqual((await api('DELETE', '/api/admin/grounds/g1')).status, 403);
      assert.strictEqual((await api('POST', '/api/admin/grounds/g1/slots/generate', { days: 7 })).status, 403);
      assert.strictEqual((await api('PUT', '/api/grounds/g1/slots', { date: '2026-09-22', slots: [] })).status, 403);
    });

    it('lets an approved owner pass the KYC gate on ground and slot routes', async () => {
      state.user = ownerA();
      state.ground = { id: 'g1', owner_id: 'ownerA' };

      // Approved owner gets past the KYC middleware to validation (400), not 403.
      assert.strictEqual((await api('POST', '/api/admin/grounds', {})).status, 400);
      // Slot generation runs to completion for an approved owner.
      const gen = await api('POST', '/api/admin/grounds/g1/slots/generate', { days: 7 });
      assert.strictEqual(gen.status, 200);
    });
  });

  describe('ground deletion preserves booking history', () => {
    it('returns 409 instead of deleting a ground that has bookings', async () => {
      state.user = ownerA();
      state.ground = { id: 'g1', owner_id: 'ownerA' };
      state.hasBookings = true;

      const res = await api('DELETE', '/api/admin/grounds/g1');
      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /booking history/);
      assert.strictEqual(state.groundsDeleted, 0);
    });

    it('deletes a ground that has no bookings', async () => {
      state.user = ownerA();
      state.ground = { id: 'g1', owner_id: 'ownerA' };

      const res = await api('DELETE', '/api/admin/grounds/g1');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(state.groundsDeleted, 1);
    });

    it('blocks an owner from deleting another owners ground', async () => {
      state.user = ownerA();
      state.ground = { id: 'g1', owner_id: 'ownerB' };

      assert.strictEqual((await api('DELETE', '/api/admin/grounds/g1')).status, 403);
    });
  });

  describe('bulk slot updates never touch booked or held slots', () => {
    it('scopes every bulk UPDATE to non-booked, non-held slots without clearing hold data', async () => {
      const slotController = require('../controllers/slotController');
      const updates = [];
      pool.connect = async () => ({
        query: async (sql, params) => {
          const s = String(sql).replace(/\s+/g, ' ').trim();
          if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s)) return { rows: [] };
          if (/^SELECT owner_id FROM grounds WHERE id = \$1$/.test(s)) return { rows: [{ owner_id: 'ownerA' }] };
          if (/UPDATE slots SET status/.test(s)) {
            updates.push({ sql: s, params });
            return { rows: [] };
          }
          throw new Error('Unhandled query in updateSlots test stub: ' + s);
        },
        release: () => {},
      });

      const req = {
        params: { groundId: 'g1' },
        body: {
          date: '2026-09-22',
          slots: [
            { startTime: '10:00', status: 'maintenance' },
            { startTime: '11:00', status: 'available' },
            { startTime: '12:00', status: 'held' },
          ],
        },
        user: { id: 'ownerA', role: 'owner' },
      };
      const res = mockRes();
      await slotController.updateSlots(req, res);

      assert.strictEqual(res.statusCode, 200);
      // One UPDATE for the slot to close, one for the slot to reopen.
      // The held slot must not produce any UPDATE at all.
      assert.strictEqual(updates.length, 2);
      for (const { sql, params } of updates) {
        assert.match(sql, /status NOT IN \('booked', 'held'\)/);
        assert.doesNotMatch(sql, /held_by_user_id|hold_expires_at/);
        assert.deepStrictEqual(params.slice(0, 2), ['g1', '2026-09-22']);
        assert.match(String(params[2]), /^\d{2}:\d{2}$/);
      }
    });
  });
});

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    if (res.statusCode === null) res.statusCode = 200;
    res.body = body;
    return res;
  };
  return res;
}