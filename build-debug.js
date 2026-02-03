#!/usr/bin/env node

console.log('🔍 ============ BUILD DEBUG ============');
console.log('🔍 Checking environment variables...');
console.log('');

const firebaseVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID'
];

firebaseVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

console.log('');
console.log('🔍 All environment variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('VITE_'))
  .forEach(key => {
    console.log(`  ${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
  });

console.log('');
console.log('🔍 ====================================');
console.log('');
