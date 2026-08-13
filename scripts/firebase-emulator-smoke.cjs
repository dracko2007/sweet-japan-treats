const required = {
  firestore: process.env.FIRESTORE_EMULATOR_HOST,
  storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
};
for (const [name, host] of Object.entries(required)) {
  if (!host) throw new Error(`${name} emulator host is missing`);
  console.log(`${name}: ${host}`);
}
console.log('Firebase emulators online');
