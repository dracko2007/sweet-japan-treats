// Tenta Cloudinary primeiro. Se falhar por limite de banda/quota (4xx),
// faz fallback automático para Firebase Storage.
import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CLOUD_NAME = 'dw4j4tpub';
const UPLOAD_PRESET = 'japanexpress';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

async function uploadToFirebase(blob: Blob, folder: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage indisponível.');
  const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  return getDownloadURL(storageRef);
}

export const cloudinaryService = {
  isCloudinaryUrl: (s: string) =>
    typeof s === 'string' && s.includes('res.cloudinary.com'),

  isFirebaseUrl: (s: string) =>
    typeof s === 'string' && s.includes('firebasestorage.app'),

  isDataUrl: (s: string) =>
    typeof s === 'string' && s.startsWith('data:'),

  isExternalUrl: (s: string) =>
    typeof s === 'string' &&
    s.startsWith('http') &&
    !s.includes('res.cloudinary.com') &&
    !s.includes('firebasestorage.app'),

  needsMigration: (s?: string) =>
    typeof s === 'string' && s.startsWith('data:'),

  async uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // Tenta Cloudinary
    try {
      const form = new FormData();
      form.append('file', blob);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', folder);

      const response = await fetch(UPLOAD_URL, { method: 'POST', body: form });

      if (response.ok) {
        const data = await response.json();
        return data.secure_url.replace('/upload/', '/upload/f_webp,q_auto/');
      }

      // 429 = quota/bandwidth, 401/403 = conta bloqueada → fallback
      const err = await response.json().catch(() => ({}));
      console.warn(`Cloudinary indisponível (${response.status}): ${err?.error?.message}. Usando Firebase Storage.`);
    } catch (e) {
      console.warn('Cloudinary offline, usando Firebase Storage:', e);
    }

    // Fallback: Firebase Storage
    return uploadToFirebase(blob, folder);
  },
};
