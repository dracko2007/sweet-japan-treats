// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseDisabled = import.meta.env.VITE_DISABLE_FIREBASE === 'true';
const allowLocalOnly = import.meta.env.VITE_ALLOW_LOCAL_ONLY === 'true';

// Firebase Configuration - Using direct config (Vercel env vars not being injected properly)
const firebaseConfig = {
  apiKey: "AIzaSyCKf6fYQQRk9VUPTZNcZ8gVEEn5sAdwr0g",
  authDomain: "localstorage-98492.firebaseapp.com",
  projectId: "localstorage-98492",
  storageBucket: "localstorage-98492.appspot.com",
  messagingSenderId: "1087648598267",
  appId: "1:1087648598267:web:fbfbc19ad31aa05839885e",
  measurementId: "G-BH2VFVJC2J"
};

const firebaseConfigReady = true;
const firebaseConfigSource = 'direct-config';
const firebaseDisabled = false;
const allowLocalOnly = false;

// Initialize Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log('✅ Firebase initialized successfully with project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

export { app, auth, db, firebaseConfig, firebaseConfigReady, firebaseDisabled, allowLocalOnly, firebaseConfigSource };
