const { pool } = require('../db');
const { generateToken } = require('../utils/generateToken');
const { serializeAuthUser } = require('./authController');
const firebaseAdmin = require('../services/firebaseAdmin');
const accountResolver = require('../services/accountResolver');

// One-time codes are not sent by SMS yet, so while developing locally they are
// written to the server console instead. The check fails closed: unless NODE_ENV
// is exactly "development", no code is ever printed. That keeps codes out of the
// logs in production and in any deploy that forgets to set NODE_ENV.
const logOtpToConsole = process.env.NODE_ENV === 'development';

// Exchange a Firebase ID token (issued by the Firebase client SDK after Google
// sign-in) for a Maidan session. The token is verified against the Firebase
// project, then resolved to a local user row.
exports.googleSignIn = async (req, res) => {
  if (firebaseAdmin.firebaseUnavailable()) {
    return res.status(503).json({ message: 'Google sign-in is being set up. Please try again shortly.' });
  }

  const { idToken } = req.body;
  try {
    const profile = await firebaseAdmin.verifyGoogleIdToken(idToken);
    const { user } = await accountResolver.resolveGoogleAccount(profile);
    const token = generateToken(user);
    res.json({
      message: 'Login successful!',
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    if (error instanceof firebaseAdmin.InvalidProviderError) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Firebase sign-in error:', error);
    res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
};

exports.addPhone = async (req, res) => {
  const { phone } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0 && existing.rows[0].id !== req.user.id) {
      return res.status(409).json({ message: 'This phone number is already registered to another account.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET phone = $1, verification_code = $2, verification_code_expires = $3 WHERE id = $4',
      [phone, otp, otpExpiry, req.user.id]
    );

    if (logOtpToConsole) console.log(`OTP for ${phone}: ${otp}`);

    res.json({ message: 'OTP sent. Verify it to link your phone number.' });
  } catch (error) {
    console.error('Add phone error:', error);
    res.status(500).json({ message: 'Failed to attach phone number. Please try again.' });
  }
};