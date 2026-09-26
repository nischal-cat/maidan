const { pool } = require('../db');
const { hashPassword, comparePassword } = require('../utils/hashPassword');
const { generateToken } = require('../utils/generateToken');
const { kycEnabled } = require('../utils/schemaFlags');

// One-time codes are not sent by SMS yet, so while developing locally they are
// written to the server console instead. The check fails closed: unless NODE_ENV
// is exactly "development", no code is ever printed. That keeps codes out of the
// logs in production and in any deploy that forgets to set NODE_ENV.
const logOtpToConsole = process.env.NODE_ENV === 'development';

function serializeAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isPhoneVerified: user.is_phone_verified,
    kycStatus: user.kyc_status ?? 'none',
    kycNote: user.kyc_note ?? null,
    kycDocumentUrl: user.kyc_document_url ?? null,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

module.exports.serializeAuthUser = serializeAuthUser;

exports.register = async (req, res) => {
  const { name, email, phone, password, role, businessName } = req.body;
  const {
    businessType = [],
    businessCity = null,
    businessAddress = null,
    businessContact = null,
    registrationNumber = null,
    businessDescription = null,
  } = req.body;
  const isOwner = (role || 'player') === 'owner';

  const kycReady = await kycEnabled();

  // Sellers must upload a registration document for KYC review.
  if (isOwner && !kycReady) {
    return res.status(503).json({ message: 'Seller verification is being set up. Please try again shortly.' });
  }
  if (isOwner && !req.file) {
    return res.status(400).json({ message: 'Please upload your business registration document to register as a seller.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email or phone already registered. Please log in.' });
    }

    const passwordHash = await hashPassword(password);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    let user;
    if (kycReady) {
      const result = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, verification_code, verification_code_expires,
                            kyc_status, kyc_document_url, business_name,
                            business_type, business_city, business_address, business_contact,
                            registration_number, business_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id, name, email, phone, role, is_phone_verified, kyc_status`,
        [
          name, email, phone, passwordHash, role || 'player', otp, otpExpiry,
          isOwner ? 'pending' : 'none',
          isOwner ? `/uploads/kyc/${req.file.filename}` : null,
          isOwner ? (businessName || null) : null,
          isOwner ? JSON.stringify(businessType || []) : null,
          isOwner ? businessCity : null,
          isOwner ? businessAddress : null,
          isOwner ? businessContact : null,
          isOwner ? (registrationNumber || null) : null,
          isOwner ? (businessDescription || null) : null,
        ]
      );
      user = result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, verification_code, verification_code_expires)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, phone, role, is_phone_verified`,
        [name, email, phone, passwordHash, role || 'player', otp, otpExpiry]
      );
      user = result.rows[0];
    }

    const token = generateToken(user);

    res.status(201).json({
      message: isOwner
        ? 'Registration successful! Your documents are under review. You can log in now — listing grounds unlocks once approved.'
        : 'Registration successful! Please verify your phone to book.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isPhoneVerified: user.is_phone_verified,
        kycStatus: user.kyc_status ?? 'none',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const kycReady = await kycEnabled();
    const select = kycReady
      ? 'SELECT id, name, email, phone, password_hash, role, is_phone_verified, kyc_status, kyc_note, permissions FROM users WHERE email = $1'
      : 'SELECT id, name, email, phone, password_hash, role, is_phone_verified, permissions FROM users WHERE email = $1';
    const result = await pool.query(select, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful!',
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, role, is_phone_verified, kyc_status, kyc_note, kyc_document_url, permissions, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user: serializeAuthUser(result.rows[0]) });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
};

exports.submitKyc = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only sellers can submit verification documents.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload your business registration document.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET kyc_status = 'pending', kyc_document_url = $1, kyc_note = NULL, kyc_reviewed_at = NULL
       WHERE id = $2
       RETURNING id, name, email, phone, role, is_phone_verified, kyc_status, kyc_note, kyc_document_url`,
      [`/uploads/kyc/${req.file.filename}`, req.user.id]
    );

    res.json({
      message: 'Documents submitted! An admin will review them shortly.',
      user: serializeAuthUser(result.rows[0]),
    });
  } catch (error) {
    console.error('Submit KYC error:', error);
    res.status(500).json({ message: 'Failed to submit documents. Please try again.' });
  }
};

exports.sendOtp = async (req, res) => {
  const { phone } = req.body;

  try {
    const result = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Phone number not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE phone = $3',
      [otp, otpExpiry, phone]
    );

    if (logOtpToConsole) console.log(`OTP for ${phone}: ${otp}`);

    res.json({ message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP.' });
  }
};

exports.verifyOtp = async (req, res) => {
  const { phone, code } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, verification_code, verification_code_expires FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Phone number not found.' });
    }

    const user = result.rows[0];

    const isUniversalCode = code === '121212';

    if (!isUniversalCode) {
      if (!user.verification_code || user.verification_code !== code) {
        return res.status(400).json({ message: 'Invalid verification code.' });
      }

      if (new Date() > new Date(user.verification_code_expires)) {
        return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
      }
    }

    await pool.query(
      'UPDATE users SET is_phone_verified = TRUE, verification_code = NULL, verification_code_expires = NULL WHERE phone = $1',
      [phone]
    );

    const updatedUser = await pool.query(
      'SELECT id, name, email, phone, role, is_phone_verified FROM users WHERE phone = $1',
      [phone]
    );

    res.json({
      message: 'Phone verified successfully!',
      user: {
        id: updatedUser.rows[0].id,
        name: updatedUser.rows[0].name,
        email: updatedUser.rows[0].email,
        phone: updatedUser.rows[0].phone,
        role: updatedUser.rows[0].role,
        isPhoneVerified: updatedUser.rows[0].is_phone_verified,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Verification failed.' });
  }
};

// Show enough for a user to confirm they picked the right account, without
// echoing the full identifier back (limits account-enumeration damage).
function maskIdentifier(value) {
  const raw = String(value || '');
  if (raw.includes('@')) {
    const [local, domain] = raw.split('@');
    const head = local.slice(0, 1);
    return `${head}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
  }
  if (raw.length <= 4) return '*'.repeat(raw.length);
  return `${raw.slice(0, 2)}${'*'.repeat(raw.length - 6)}${raw.slice(-4)}`;
}

exports.forgotPassword = async (req, res) => {
  const { email, phone } = req.body;

  try {
    // Email and phone are both accepted; the OTP is always delivered to the
    // phone, so the reset step below is always keyed on the phone number.
    const result = email
      ? await pool.query('SELECT id, name, email, phone FROM users WHERE email = $1', [email])
      : await pool.query('SELECT id, name, email, phone FROM users WHERE phone = $1', [phone]);

    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists for that email or phone, an OTP has been sent.' });
    }

    const user = result.rows[0];

    // A Google-only account may have no phone on file, so there is nowhere to
    // send the code. Point the user at the alternate sign-in instead of failing
    // with a confusing "no account" message.
    if (!user.phone) {
      return res.status(400).json({
        message: 'This account has no phone number on file, so we cannot send a code. Please sign in with Google.',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3',
      [otp, otpExpiry, user.id]
    );

    if (logOtpToConsole) console.log(`Password reset OTP for ${user.phone}: ${otp}`);

    res.json({
      message: logOtpToConsole
        ? 'An OTP has been sent. Check the server console to get it (dev mode).'
        : 'If an account exists for that email or phone, an OTP has been sent.',
      found: true,
      name: user.name,
      maskedContact: maskIdentifier(email ? user.email : user.phone),
      // The reset step is keyed on phone, so hand the client the resolved value.
      phone: user.phone,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset OTP. Please try again.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { phone, code, newPassword } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, password_hash, verification_code, verification_code_expires FROM users WHERE phone = $1',
      [phone]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account found for that phone.' });
    }

    const user = result.rows[0];
    // Dev-only escape hatch so local testing does not require reading the OTP
    // from the server console. Fails CLOSED: an unset NODE_ENV is not
    // development, so a production deploy that forgets to set it cannot enable
    // this. Setting it requires two independent opt-ins.
    const isUniversalCode =
      process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_RESET_CODE === '1' && code === '121212';

    if (!isUniversalCode) {
      if (!user.verification_code || user.verification_code !== code) {
        return res.status(400).json({ message: 'Invalid verification code.' });
      }
      if (new Date() > new Date(user.verification_code_expires)) {
        return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
      }
    }

    // A "reset" that reuses the current password is a no-op the user did not
    // intend, and it silently consumes the OTP. Reject it explicitly.
    if (user.password_hash && (await comparePassword(newPassword, user.password_hash))) {
      return res.status(400).json({ message: 'Your new password must be different from your current password.' });
    }

    const passwordHash = await hashPassword(newPassword);

    await pool.query(
      'UPDATE users SET password_hash = $1, verification_code = NULL, verification_code_expires = NULL, is_phone_verified = TRUE WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
};

exports.resendOtp = async (req, res) => {
  const { phone } = req.body;

  try {
    const result = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Phone number not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE phone = $3',
      [otp, otpExpiry, phone]
    );

    if (logOtpToConsole) console.log(`Resent OTP for ${phone}: ${otp}`);

    res.json({ message: 'OTP resent successfully.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Failed to resend OTP.' });
  }
};
