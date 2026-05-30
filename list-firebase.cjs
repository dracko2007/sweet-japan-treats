const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const bucketName = 'localstorage-98492.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: bucketName
});

(async () => {
  try {
    const bucket = admin.storage().bucket();
    console.log('Bucket:', bucket.name);
    const [files] = await bucket.getFiles();
    console.log('Total de arquivos no bucket:', files.length);
    console.log('');
    // Agrupa por pasta
    const folders = {};
    for (const f of files) {
      const parts = f.name.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(raiz)';
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(parts[parts.length - 1]);
    }
    for (const [folder, names] of Object.entries(folders)) {
      console.log(`PASTA: ${folder}/  (${names.length} arquivos)`);
      names.slice(0, 8).forEach(n => console.log('   - ' + n));
      if (names.length > 8) console.log('   ... +' + (names.length - 8) + ' mais');
      console.log('');
    }
  } catch (e) {
    console.error('ERRO:', e.message);
  }
})();
