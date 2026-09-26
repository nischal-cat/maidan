const { describe, before, after, beforeEach, afterEach, it } = require('node:test');
const assert = require('node:assert');
const firebaseAdmin = require('../services/firebaseAdmin');
const accountResolver = require('../services/accountResolver');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'firebase-http-test-secret';

const app = require('../server');

const saved = {
  firebaseUnavailable: firebaseAdmin.firebaseUnavailable,
  verifyGoogleIdToken: firebaseAdmin.verifyGoogleIdToken,
  resolveGoogleAccount: accountResolver.resolveGoogleAccount,
};

function setFirebaseEnv(on) {
  if (on) {
    process.env.FIREBASE_PROJECT_ID = 'maidan-test';
    process.env.FIREBASE_SERVICE_ACCOUNT_B64 = 'dGVzdA=='; // unused, verify is stubbed
  } else {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  }
}

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  setFirebaseEnv(true);
});

afterEach(() => {
  firebaseAdmin.firebaseUnavailable = saved.firebaseUnavailable;
  firebaseAdmin.verifyGoogleIdToken = saved.verifyGoogleIdToken;
  accountResolver.resolveGoogleAccount = saved.resolveGoogleAccount;
});

const googleUser = {
  id: 'user-1',
  name: 'New User',
  email: 'new@example.com',
  phone: null,
  role: 'player',
  is_phone_verified: false,
  kyc_status: 'none',
  kyc_note: null,
  kyc_document_url: null,
  permissions: [],
};

describe('POST /api/auth/firebase/google', () => {
  it('returns 503 when Firebase is not configured', async () => {
    firebaseAdmin.firebaseUnavailable = () => true;
    const res = await fetch(`${base}/api/auth/firebase/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'anything' }),
    });
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.match(body.message, /set up/i);
  });

  it('rejects a missing idToken', async () => {
    const res = await fetch(`${base}/api/auth/firebase/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });

  it('returns a session for a freshly created account', async () => {
    firebaseAdmin.firebaseUnavailable = () => false;
    firebaseAdmin.verifyGoogleIdToken = async () => ({
      sub: 'google-sub-1',
      email: 'new@example.com',
      email_verified: true,
      name: 'New User',
      picture: null,
    });
    accountResolver.resolveGoogleAccount = async () => ({ user: googleUser, status: 'created' });

    const res = await fetch(`${base}/api/auth/firebase/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake-id-token' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.strictEqual(body.user.id, 'user-1');
    assert.strictEqual(body.user.role, 'player');
  });

  it('rejects a token from a non-Google provider', async () => {
    firebaseAdmin.firebaseUnavailable = () => false;
    firebaseAdmin.verifyGoogleIdToken = async () => {
      throw new firebaseAdmin.InvalidProviderError('Sign-in provider "password" is not supported. Use Google sign-in.');
    };

    const res = await fetch(`${base}/api/auth/firebase/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'password-token' }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /not supported/i);
  });

  it('returns 401 when token verification fails', async () => {
    firebaseAdmin.firebaseUnavailable = () => false;
    firebaseAdmin.verifyGoogleIdToken = async () => {
      throw new Error('invalid token');
    };

    const res = await fetch(`${base}/api/auth/firebase/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'garbage' }),
    });
    assert.strictEqual(res.status, 401);
  });
});

describe('POST /api/auth/me/phone', () => {
  it('requires authentication', async () => {
    const res = await fetch(`${base}/api/auth/me/phone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '9800000000' }),
    });
    assert.strictEqual(res.status, 401);
  });
});