import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
const cfg = { apiKey:"AIzaSyCKf6f9QqRk9VUPTzNr28gVEEn5sAdwr0g", authDomain:"localstorage-98492.firebaseapp.com", projectId:"localstorage-98492", storageBucket:"localstorage-98492.firebasestorage.app", messagingSenderId:"1087648598267", appId:"1:1087648598267:web:fbfbc19ad31aa05839885e" };
const db=getFirestore(initializeApp(cfg)); const auth=getAuth();
const cred = await signInWithEmailAndPassword(auth,'dracko2007@gmail.com','admin123');
const meuUid = cred.user.uid;
try { await addDoc(collection(db,'eventos'),{ usuarioId: meuUid, tipo:'viu_produto', produtoId:'biore-uv', categoria:'cosmeticos', criadoEm: serverTimestamp() }); console.log('TESTE1 Criar com MEU uid: PERMITIDO (correto)'); }
catch(e){ console.log('TESTE1 Criar com MEU uid: bloqueado', e.code); }
try { await addDoc(collection(db,'eventos'),{ usuarioId:'uid-falso-123', tipo:'viu_produto', produtoId:'x', categoria:'doces', criadoEm: serverTimestamp() }); console.log('TESTE2 Criar com uid FALSO: PERMITIDO (FALHA!)'); }
catch(e){ console.log('TESTE2 Criar com uid FALSO: BLOQUEADO (correto) -', e.code); }
process.exit(0);
