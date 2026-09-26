const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const { register, login, sendOtp, verifyOtp, resendOtp, submitKyc, me, forgotPassword, resetPassword } = require('../controllers/authController');
const firebaseAuth = require('../controllers/firebaseAuthController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, sellerApplySchema, loginSchema, forgotSchema, resetPasswordSchema, firebaseGoogleSchema, addPhoneSchema } = require('../middleware/validation');

// KYC document upload (sellers). Non-multipart requests (players) pass through untouched.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'kyc');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const kycUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PDF, JPG, PNG or WEBP documents are allowed.'), ok);
  },
});

router.post('/register', kycUpload.single('document'), validate(sellerApplySchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/verify-phone', sendOtp);
router.post('/verify-phone/confirm', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/kyc', authenticate, requireRole('owner'), kycUpload.single('document'), submitKyc);
router.get('/me', authenticate, me);
router.post('/forgot-password', validate(forgotSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

router.post('/firebase/google', validate(firebaseGoogleSchema), firebaseAuth.googleSignIn);
router.post('/me/phone', authenticate, validate(addPhoneSchema), firebaseAuth.addPhone);

module.exports = router;
