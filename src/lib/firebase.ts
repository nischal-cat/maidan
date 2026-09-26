import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
const MESSAGING_SENDER_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
const APP_ID = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
const MEASUREMENT_ID = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined;

function hasConfig(): boolean {
  return Boolean(API_KEY && AUTH_DOMAIN && PROJECT_ID);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!hasConfig()) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN and VITE_FIREBASE_PROJECT_ID.');
  }
  if (!auth) {
    app = app ?? initializeApp({
      apiKey: API_KEY,
      authDomain: AUTH_DOMAIN,
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
      messagingSenderId: MESSAGING_SENDER_ID,
      appId: APP_ID,
      measurementId: MEASUREMENT_ID,
    });
    auth = getAuth(app);
  }
  return auth;
}

export function firebaseConfigured(): boolean {
  return hasConfig();
}

export async function signInWithGoogle(): Promise<string> {
  const authInstance = getFirebaseAuth();
  const credential = await signInWithPopup(authInstance, new GoogleAuthProvider());
  return credential.user.getIdToken();
}

export async function signOutOfFirebase(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}