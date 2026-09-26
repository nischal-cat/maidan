const { describe, beforeEach, afterEach, it } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../db');
const accountResolver = require('../services/accountResolver');

const originalConnect = pool.connect;
const originalQuery = pool.query;

function makeFakeDb({ linkedRows = [], byEmailRow = null, insertUserRow = null }) {
  const queries = [];
  const query = async (sql) => {
    queries.push(sql);
    const trimmed = sql.trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(trimmed)) return { rows: [] };
    if (trimmed.startsWith('INSERT INTO users')) return { rows: insertUserRow ? [insertUserRow] : [] };
    if (trimmed.startsWith('INSERT INTO auth_identities')) return { rows: [{ id: 'identity-1' }] };
    if (trimmed.startsWith('SELECT') && trimmed.includes('FROM auth_identities i')) {
      return { rows: linkedRows };
    }
    if (trimmed.startsWith('SELECT') && trimmed.includes('FROM users')) {
      return { rows: byEmailRow ? [byEmailRow] : [] };
    }
    if (trimmed.startsWith('UPDATE users')) return { rows: [] };
    throw new Error(`Unhandled SQL in fake db: ${trimmed.slice(0, 100)}`);
  };
  return {
    connect: async () => ({ query, release: () => {} }),
    query,
    queries,
  };
}

function setDb(fake) {
  pool.connect = fake.connect;
  pool.query = fake.query;
}

const profile = {
  sub: 'google-sub-1',
  email: 'NewUser@Example.com',
  email_verified: true,
  name: 'New User',
  picture: 'https://cdn.example.com/pic.png',
};

const playerUser = {
  id: 'user-1',
  name: 'New User',
  email: 'newuser@example.com',
  phone: null,
  role: 'player',
  is_phone_verified: false,
  kyc_status: 'none',
  kyc_note: null,
  kyc_document_url: null,
  permissions: [],
};

beforeEach(() => {
  setDb(makeFakeDb({}));
});

afterEach(() => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
});

describe('resolveGoogleAccount', () => {
  it('creates a new user when nothing matches', async () => {
    const fake = makeFakeDb({ insertUserRow: playerUser });
    setDb(fake);
    const result = await accountResolver.resolveGoogleAccount(profile);
    assert.strictEqual(result.status, 'created');
    assert.strictEqual(result.user.id, 'user-1');
  });

  it('returns logged_in when (provider, sub) is already linked', async () => {
    const fake = makeFakeDb({ linkedRows: [{ ...playerUser, is_phone_verified: true }] });
    setDb(fake);
    const result = await accountResolver.resolveGoogleAccount(profile);
    assert.strictEqual(result.status, 'logged_in');
    assert.strictEqual(result.user.id, 'user-1');
  });

  it('qualifies join columns to avoid ambiguity with auth_identities', async () => {
    const fake = makeFakeDb({ linkedRows: [{ ...playerUser, is_phone_verified: true }] });
    setDb(fake);
    await accountResolver.resolveGoogleAccount(profile);
    const joinSql = fake.queries.find((q) => q.includes('FROM auth_identities i'));
    assert.ok(joinSql, 'join query was issued');
    assert.match(joinSql, /u\.name/);
    assert.match(joinSql, /u\.email/);
    assert.match(joinSql, /u\.phone/);
    assert.match(joinSql, /u\.permissions/);
    assert.doesNotMatch(joinSql, /SELECT u\.id, name/);
  });

  it('links a verified email to an account without a password', async () => {
    const fake = makeFakeDb({
      byEmailRow: { ...playerUser, id: 'user-5', password_hash: null },
    });
    setDb(fake);
    const result = await accountResolver.resolveGoogleAccount(profile);
    assert.strictEqual(result.status, 'linked');
    assert.strictEqual(result.user.id, 'user-5');
  });

  it('auto-links a verified email to a password-protected account', async () => {
    const fake = makeFakeDb({
      byEmailRow: { ...playerUser, id: 'user-9', password_hash: 'hash' },
    });
    setDb(fake);
    const result = await accountResolver.resolveGoogleAccount(profile);
    assert.strictEqual(result.status, 'linked');
    assert.strictEqual(result.user.id, 'user-9');
    const sql = fake.queries.join('\n');
    assert.match(sql, /INSERT INTO auth_identities/);
    assert.match(sql, /UPDATE users/);
  });

  it('throws when the Google email is not verified', async () => {
    await assert.rejects(
      () => accountResolver.resolveGoogleAccount({ ...profile, email_verified: false }),
      accountResolver.UnverifiedEmailError
    );
  });

  it('throws when the profile has no subject', async () => {
    await assert.rejects(
      () => accountResolver.resolveGoogleAccount({ email: 'x@example.com', email_verified: true }),
      /missing a subject/i
    );
  });
});