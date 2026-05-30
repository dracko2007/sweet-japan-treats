const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  try {
    const collections = await db.listCollections();
    console.log('Coleções no Firestore:', collections.map(c => c.id).join(', ') || '(nenhuma)');
    console.log('');
    for (const col of collections) {
      const snap = await col.limit(3).get();
      console.log(`=== ${col.id} (${snap.size} docs amostra) ===`);
      snap.forEach(doc => {
        const data = doc.data();
        const keys = Object.keys(data);
        // procura campos de imagem
        const imgKeys = keys.filter(k => /image|img|foto|photo|gallery|url|picture/i.test(k));
        console.log(`  doc ${doc.id}: campos=[${keys.join(', ')}]`);
        imgKeys.forEach(k => {
          const v = data[k];
          console.log(`     ${k} = ${JSON.stringify(v).slice(0, 200)}`);
        });
      });
      console.log('');
    }
  } catch (e) {
    console.error('ERRO:', e.message);
  }
})();
