// Firebase Configuration and Initialization
// Google OAuth: OAuth Client ID configured in Google Cloud Console with Vercel URIs
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { deleteLegacyFirestoreData } from '@/utils/localData';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCKf6f9QqRk9VUPTzNr28gVEEn5sAdwr0g",
  authDomain: "localstorage-98492.firebaseapp.com",
  projectId: "localstorage-98492",
  storageBucket: "localstorage-98492.firebasestorage.app",
  messagingSenderId: "1087648598267",
  appId: "1:1087648598267:web:fbfbc19ad31aa05839885e",
  measurementId: "G-F7VQTG41VF"
};

const firebaseConfigReady = true;
const firebaseConfigSource = 'direct-config';
const firebaseDisabled = import.meta.env.VITE_DISABLE_FIREBASE === 'true';
const allowLocalOnly = import.meta.env.VITE_ALLOW_LOCAL_ONLY === 'true';

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // `initializeFirestore` em vez de `getFirestore` por causa do iPhone.
  //
  // O transporte padrão do Firestore é o WebChannel (streaming). No WebKit ele
  // trava com frequência, e o SDK só cai para long-polling depois de estourar
  // um timeout — são os segundos de tela vazia que aparecem só no iOS, enquanto
  // Android e desktop carregam na hora.
  //
  // `experimentalAutoDetectLongPolling` faz o SDK sondar e escolher o
  // transporte que funciona logo na primeira conexão. É auto-detecção, não
  // `experimentalForceLongPolling`: onde o streaming funciona (Chrome, Android)
  // nada muda, então não se paga o preço do long-polling à toa.
  //
  // Cache só em memória (padrão do SDK), de propósito. A persistência em
  // IndexedDB guardava no disco os documentos de usuário e pedidos — e eles
  // ficavam lá depois do logout. O catálogo, que era o motivo dela, já tem
  // cache próprio com sincronização por delta (`jp_catalog`, ver catalogCache).
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  // Apaga o banco da persistência antiga, ainda com dados de quem usou a loja
  // antes desta versão.
  void deleteLegacyFirestoreData(firebaseConfig.projectId);
  storage = getStorage(app);
  if (import.meta.env.DEV) console.log('✅ Firebase initialized with project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

export { app, auth, db, storage, firebaseConfig, firebaseConfigReady, firebaseDisabled, allowLocalOnly, firebaseConfigSource };
