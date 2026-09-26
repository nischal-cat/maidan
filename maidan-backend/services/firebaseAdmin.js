const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

class FirebaseNotConfiguredError extends Error {}
class InvalidProviderError extends Error {}

const GOOGLE_PROVIDER = 'google.com';
const ALLOWED_SIGN_IN_PROVIDERS = new Set([GOOGLE_PROVIDER]);

let app = null;
let initError = null;

function firebaseUnavailable() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    if (!initError) {
      initError = new FirebaseNotConfiguredError(
        'Firebase Authentication is not configured. Set FIREBASE_PROJECT_ID.'
      );
    }
    return true;
  }
  ensureApp();
  return false;
}

// ID token verification only needs the public project ID. A service account is
// optional and only required if the backend later needs privileged auth
// operations (creating users, resetting passwords, etc.).
function loadCredentialOptions() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    return {
      credential: admin.credential.cert(
        JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'))
      ),
    };
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return { credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT) };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { credential: admin.credential.applicationDefault() };
  }
  return {};
}

function ensureApp() {
  if (app) return;
  if (initError) throw initError;
  try {
    app = admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      ...loadCredentialOptions(),
    });
  } catch (error) {
    initError = error;
    throw error;
  }
  return app;
}

async function verifyGoogleIdToken(idToken) {
  ensureApp();
  const decoded = await getAuth(app).verifyIdToken(idToken);

  const provider = decoded.firebase?.sign_in_provider;
  if (!ALLOWED_SIGN_IN_PROVIDERS.has(provider)) {
    throw new InvalidProviderError(`Sign-in provider "${provider || 'unknown'}" is not supported. Use Google sign-in.`);
  }

  const googleSubjects = decoded.firebase?.identities?.[GOOGLE_PROVIDER];
  const subject =
    (Array.isArray(googleSubjects) && googleSubjects.length ? googleSubjects[0] : null) || decoded.uid || decoded.sub;

  if (typeof subject !== 'string' || subject.length === 0) {
    throw new InvalidProviderError('Google identity is missing a subject.');
  }
  if (decoded.email_verified !== true || typeof decoded.email !== 'string' || decoded.email.length === 0) {
    throw new InvalidProviderError('Google account email is not verified.');
  }

  return {
    sub: subject,
    email: decoded.email,
    email_verified: true,
    name: decoded.name || null,
    picture: decoded.picture || null,
  };
}

module.exports = {
  FirebaseNotConfiguredError,
  InvalidProviderError,
  firebaseUnavailable,
  verifyGoogleIdToken,
};