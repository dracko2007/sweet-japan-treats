// Anteriormente usava Cloudinary. Migrado para Firebase Storage para evitar
// limite de banda do plano gratuito do Cloudinary. A interface permanece igual
// para que ProductManager.tsx não precise ser alterado.
import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    if (!storage) throw new Error('Firebase Storage indisponível.');

    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${folder}/${filename}`;

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: blob.type });
    return getDownloadURL(storageRef);
  },
};
