const { pool } = require('../db');

class UnverifiedEmailError extends Error {}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const USER_SELECT = `
  id, name, email, phone, role, is_phone_verified, kyc_status, kyc_note,
  kyc_document_url, permissions
`;

const USER_SELECT_QUALIFIED = `
  u.id, u.name, u.email, u.phone, u.role, u.is_phone_verified, u.kyc_status,
  u.kyc_note, u.kyc_document_url, u.permissions
`;

const LOGIN_SELECT = `
  id, name, email, phone, password_hash, role, is_phone_verified, permissions
`;

async function queryLinked(client, sub) {
  const result = await client.query(
    `SELECT ${USER_SELECT_QUALIFIED}
     FROM auth_identities i
     JOIN users u ON u.id = i.user_id
     WHERE i.provider = 'google' AND i.provider_sub = $1`,
    [sub]
  );
  return result.rows[0] || null;
}

async function queryByEmail(client, email, select = LOGIN_SELECT) {
  const result = await client.query(
    `SELECT ${select} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
}

async function insertGoogleIdentity(client, { userId, sub, email, name, picture }) {
  const result = await client.query(
    `INSERT INTO auth_identities (user_id, provider, provider_sub, provider_email, email_verified, name, picture_url)
     VALUES ($1, 'google', $2, $3, TRUE, $4, $5)
     ON CONFLICT (provider, provider_sub) DO NOTHING
     RETURNING id`,
    [userId, sub, email, name || null, picture || null]
  );
  return result.rows[0] || null;
}

async function markEmailVerified(client, userId, { picture } = {}) {
  await client.query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, NOW()),
         avatar_url = COALESCE(avatar_url, $2)
     WHERE id = $1`,
    [userId, picture || null]
  );
}

async function createGoogleUser(client, profile, email) {
  const result = await client.query(
    `INSERT INTO users (name, email, role, is_phone_verified, email_verified_at, avatar_url)
     VALUES ($1, $2, 'player', FALSE, NOW(), $3)
     RETURNING ${USER_SELECT}`,
    [profile.name || email.split('@')[0], email, profile.picture || null]
  );
  const user = result.rows[0];
  await insertGoogleIdentity(client, {
    userId: user.id,
    sub: profile.sub,
    email,
    name: profile.name,
    picture: profile.picture,
  });
  return user;
}

// Login resolution for Google-verified accounts. The identity provider has
// already confirmed the email, so matching by verified email is safe and no
// password proof is required: existing local accounts are linked automatically.
async function resolveGoogleAccount(profile) {
  if (!profile || typeof profile.sub !== 'string' || profile.sub.length === 0) {
    throw new Error('Google profile is missing a subject.');
  }
  const email = normalizeEmail(profile.email);
  if (!email || profile.email_verified !== true) {
    throw new UnverifiedEmailError('Google account email is not verified.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const linked = await queryLinked(client, profile.sub);
    if (linked) {
      await client.query('COMMIT');
      return { user: linked, status: 'logged_in' };
    }

    let existing = await queryByEmail(client, email);
    if (!existing) {
      try {
        const user = await createGoogleUser(client, profile, email);
        await client.query('COMMIT');
        return { user, status: 'created' };
      } catch (error) {
        if (error.code !== '23505') throw error;
        existing = await queryByEmail(client, email);
        if (!existing) throw error;
      }
    }

    await insertGoogleIdentity(client, {
      userId: existing.id,
      sub: profile.sub,
      email,
      name: profile.name,
      picture: profile.picture,
    });
    await markEmailVerified(client, existing.id, { picture: profile.picture });

    const user = await queryByEmail(client, email, USER_SELECT);
    if (!user) throw new Error('Linked account could not be loaded after linking.');
    await client.query('COMMIT');
    return { user, status: 'linked' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT ${LOGIN_SELECT} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
}

module.exports = {
  UnverifiedEmailError,
  resolveGoogleAccount,
  findUserByEmail,
  insertGoogleIdentity,
  markEmailVerified,
  queryByEmail,
  queryLinked,
};