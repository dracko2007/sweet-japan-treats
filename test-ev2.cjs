const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const fs = require('fs');
const cfg = { apiKey:"AIzaSyCKf6f9QqRk9VUPTzNr28gVEEn5sAdwr0g", authDomain:"localstorage-98492.firebaseapp.com", projectId:"localstorage-98492", storageBucket:"localstorage-98492.firebasestorage.app", messagingSenderId:"1087648598267", appId:"1:1087648598267:web:fbfbc19ad31aa05839885e" };
const app=initializeApp(cfg); const db=getFirestore(app); const auth=getAuth(app);
const out=[];
(async()=>{
  const cred = await signInWithEmailAndPassword(auth,'dracko2007@gmail.com','admin123');
  const meuUid = cred.user.uid;
  try { await addDoc(collection(db,'eventos'),{ usuarioId: meuUid, tipo:'viu_produto', produtoId:'biore-uv', categoria:'cosmeticos', criadoEm: serverTimestamp() }); out.push('TESTE1 (criar com MEU uid): PERMITIDO -> correto'); }
  catch(e){ out.push('TESTE1 (criar com MEU uid): bloqueado '+e.code); }
  try { await addDoc(collection(db,'eventos'),{ usuarioId:'uid-falso-123', tipo:'viu_produto', produtoId:'x', categoria:'doces', criadoEm: serverTimestamp() }); out.push('TESTE2 (criar com uid FALSO): PERMITIDO -> FALHA DE SEGURANCA'); }
  catch(e){ out.push('TESTE2 (criar com uid FALSO): BLOQUEADO '+e.code+' -> correto'); }
  fs.writeFileSync('ev-result.txt', out.join('\n'));
  process.exit(0);
})().catch(e=>{ fs.writeFileSync('ev-result.txt','ERRO: '+(e.code||e.message)); process.exit(0); });
