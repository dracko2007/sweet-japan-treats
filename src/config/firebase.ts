// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCKf6fYQQRk9VUPTZNcZ8gVEEn5sAdwr0g",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localstorage-98492.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "localstorage-98492",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "localstorage-98492.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1087648598267",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1087648598267:web:fbfbc19ad31aa05839885e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BH2VFVJC2J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };
