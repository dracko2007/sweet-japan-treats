// Firebase Configuration and Initialization
// Google OAuth: OAuth Client ID configured in Google Cloud Console with Vercel URIs
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCKf6f9QqRk9VUPTzNr28gVEEn5sAdwr0g",
  authDomain: "localstorage-98492.firebaseapp.com",
  projectId: "localstorage-98492",
  storageBucket: "localstorage-98492.firebasestorage.app",
  messagingSenderId: "1087648598267",
  appId: "1:1087648598267:web:fbfbc19ad31aa05839885e",
  measurementId: "G-BH2VFVJC2J"
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
  // `persistentLocalCache` guarda o catálogo em IndexedDB. O cache em
  // localStorage do productService nunca chegava a ser escrito: o catálogo
  // passa de 7 MB e o limite do localStorage é ~5 MB. Ou seja, TODA visita
  // relia os ~265 documentos do Firestore do zero — no WebKit, os segundos de
  // tela vazia. Com IndexedDB não há esse teto: a partir da segunda visita o
  // catálogo vem do disco na hora e a rede só traz o que mudou.
  //
  // A persistência é tentada em separado: em aba privada do iOS o IndexedDB é
  // bloqueado, e sem este fallback a exceção cairia no `catch` de baixo,
  // deixaria `db = null` e derrubaria a loja inteira. Perder o cache é aceitável;
  // perder o Firestore não é.
  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
  storage = getStorage(app);
  if (import.meta.env.DEV) console.log('✅ Firebase initialized with project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

export { app, auth, db, storage, firebaseConfig, firebaseConfigReady, firebaseDisabled, allowLocalOnly, firebaseConfigSource };
