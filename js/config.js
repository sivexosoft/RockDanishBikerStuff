import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { createClient } from '@supabase/supabase-js';

// Read public client credentials from environment variables (Vercel / Vite .env)
// Never store private keys, service-role keys, or passwords in frontend code.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('YOUR_')
);

let firebaseApp = null;
let firebaseAuth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { firebaseApp, firebaseAuth, googleProvider };

// Supabase PostgreSQL + Supabase Storage Configuration
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseAnonKey.includes('YOUR_')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        if (!firebaseAuth || !firebaseAuth.currentUser) return null;
        try {
          return await firebaseAuth.currentUser.getIdToken();
        } catch {
          return null;
        }
      },
    })
  : null;
