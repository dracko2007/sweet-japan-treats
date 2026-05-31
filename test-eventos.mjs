import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
const cfg = { apiKey:"AIzaSyCKf6f9QqRk9VUPTzNr28gVEEn5sAdwr0g", authDomain:"localstorage-98492.firebaseapp.com", projectId:"localstorage-98492", storageBucket:"localstorage-98492.firebasestorage.app", messagingSenderId:"1087648598267", appId:"1:1087648598267:web:fbfbc19ad31aa05839885e" };
const app=initializeApp(cfg); const db=getFirestore(app); const auth=getAuth(app);
(async()=>{
  const cred = await signInWithEmailAndPassword(auth,'dracko2007@gmail.com','admin123');
  const meuUid = cred.user.uid;
  // 1) Criar evento com MEU uid -> deve PASSAR
  try { await addDoc(collection(db,'eventos'),{ usuarioId: meuUid, tipo:'viu_produto', produtoId:'biore-uv', categoria:'cosmeticos', criadoEm: serverTimestamp() }); console.log('1) Criar com MEU uid: PERMITIDO ✅ (correto)'); }
  catch(e){ console.log('1) Criar com MEU uid: bloqueado ❌', e.code); }
  // 2) Criar evento com uid FALSO (de outra pessoa) -> deve FALHAR
  try { await addDoc(collection(db,'eventos'),{ usuarioId:'uid-de-outra-pessoa-123', tipo:'viu_produto', produtoId:'x', categoria:'doces', criadoEm: serverTimestamp() }); console.log('2) Criar com uid FALSO: PERMITIDO ❌ (FALHA DE SEGURANÇA)'); }
  catch(e){ console.log('2) Criar com uid FALSO: BLOQUEADO ✅ (correto)', e.code); }
  process.exit(0);
})().catch(e=>{console.log('ERRO',e.code||e.message);process.exit(1);});
