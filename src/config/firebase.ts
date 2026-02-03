// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseDisabled = import.meta.env.VITE_DISABLE_FIREBASE === 'true';
const allowLocalOnly = import.meta.env.VITE_ALLOW_LOCAL_ONLY === 'true';

const firebaseEnvConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const firebaseFallbackConfig = {
  apiKey: "AIzaSyCKf6fYQQRk9VUPTZNcZ8gVEEn5sAdwr0g",
  authDomain: "localstorage-98492.firebaseapp.com",
  projectId: "localstorage-98492",
  storageBucket: "localstorage-98492.appspot.com",
  messagingSenderId: "1087648598267",
  appId: "1:1087648598267:web:fbfbc19ad31aa05839885e",
  measurementId: "G-BH2VFVJC2J"
};

const missingEnvKeys = Object.entries(firebaseEnvConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const firebaseConfig = missingEnvKeys.length === 0 ? firebaseEnvConfig : firebaseFallbackConfig;

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const firebaseConfigReady = !firebaseDisabled && missingKeys.length === 0;
const firebaseConfigSource = missingEnvKeys.length === 0 ? 'env' : 'fallback';

if (!firebaseConfigReady) {
  console.error(`❌ Firebase config missing: ${missingKeys.join(', ')}. Configure VITE_FIREBASE_* env vars.`);
}

// Initialize Firebase (only if config is ready)
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (firebaseConfigReady) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
  }
}

export { app, auth, db, firebaseConfig, firebaseConfigReady, firebaseDisabled, allowLocalOnly, firebaseConfigSource };
