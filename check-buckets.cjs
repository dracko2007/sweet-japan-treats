const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const candidates = [
  'localstorage-98492.firebasestorage.app',
  'localstorage-98492.appspot.com',
  'localstorage-98492',
];

(async () => {
  for (const name of candidates) {
    try {
      const bucket = admin.storage().bucket(name);
      const [exists] = await bucket.exists();
      console.log(`${name}: exists=${exists}`);
      if (exists) {
        const [files] = await bucket.getFiles({ maxResults: 20 });
        console.log(`   -> ${files.length} arquivos (amostra):`);
        files.forEach(f => console.log('      - ' + f.name));
      }
    } catch (e) {
      console.log(`${name}: ERRO ${e.message}`);
    }
  }
})();
