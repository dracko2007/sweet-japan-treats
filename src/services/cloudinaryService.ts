// Tenta Cloudinary primeiro. Se falhar por limite de banda/quota (4xx),
// faz fallback para Firebase Storage. Se AMBOS falharem, salva a imagem
// comprimida em base64 (último recurso) para o produto nunca deixar de salvar.
import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CLOUD_NAME = 'dw4j4tpub';
const UPLOAD_PRESET = 'japanexpress';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const UPLOAD_URL_VIDEO = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

async function uploadToFirebase(blob: Blob, folder: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage indisponível.');
  const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  return getDownloadURL(storageRef);
}

async function uploadVideoToFirebase(blob: Blob, folder: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage indisponível.');
  const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('quicktime') ? 'mov' : 'mp4';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  return getDownloadURL(storageRef);
}

// Último recurso: comprime a imagem para um data URL pequeno guardado no Firestore.
function compressToDataUrl(dataUrl: string, maxPx = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ─── Entrega ───────────────────────────────────────────────────────────────
// Perfil único de entrega para toda imagem do site. Medido no acervo atual
// (master 573x600, 7.3KB) em 2026-07-25:
//   f_auto      → AVIF/WebP conforme o browser, melhor que WebP fixo.
//   q_auto:best → topo da escala perceptual: 6626B contra 6426B do `q_auto`
//                 (+3%). `q_100` custaria 22236B (+246%) sem recuperar detalhe
//                 que a master não tem — re-encodar um master lossy em q100 só
//                 preserva o artefato com mais bits.
//   c_limit     → NUNCA faz upscale. Sem isso, `w_1200` sobre a master de 573px
//                 devolve 74018B de borrão interpolado (1200x1257).
const DELIVERY = 'f_auto,q_auto:best,c_limit';

/**
 * Reescreve qualquer URL Cloudinary para o perfil de entrega de alta qualidade.
 * Aceita URLs legadas (`/upload/f_webp,q_auto/v123/…`) e limpas (`/upload/v123/…`).
 * `width` é um teto, nunca um alvo. URLs não-Cloudinary voltam intactas.
 */
export function cdnImage(url?: string, width?: number): string {
  if (!url || !url.includes('res.cloudinary.com')) return url ?? '';
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const tail = url.slice(at + marker.length);
  // O asset começa no segmento de versão; o que vier antes é transformação
  // antiga e é descartado. Sem versão, a cauda inteira já é o asset.
  const asset = tail.match(/^(?:.+?\/)?(v\d+\/.*)$/)?.[1] ?? tail;

  return `${url.slice(0, at + marker.length)}${DELIVERY}${width ? `,w_${width}` : ''}/${asset}`;
}

/**
 * Aponta para a master intocada, sem nenhuma transformação de entrega.
 * Use sempre que for RE-ENVIAR uma imagem: baixar a versão entregue e subir de
 * volta cria perda de geração acumulada a cada migração.
 */
export function cdnOriginal(url?: string): string {
  if (!url || !url.includes('res.cloudinary.com')) return url ?? '';
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const tail = url.slice(at + marker.length);
  const asset = tail.match(/^(?:.+?\/)?(v\d+\/.*)$/)?.[1] ?? tail;
  return `${url.slice(0, at + marker.length)}${asset}`;
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
    let blob: Blob | null = null;
    try {
      const res = await fetch(dataUrl);
      blob = await res.blob();
    } catch { /* segue para o fallback base64 */ }

    // 1) Tenta Cloudinary
    if (blob) {
      try {
        const form = new FormData();
        form.append('file', blob);
        form.append('upload_preset', UPLOAD_PRESET);
        form.append('folder', folder);
        const response = await fetch(UPLOAD_URL, { method: 'POST', body: form });
        if (response.ok) {
          const data = await response.json();
          // Guarda a master limpa. A qualidade de entrega é decidida por
          // `cdnImage` no momento do render, não congelada na URL.
          return data.secure_url as string;
        }
        const err = await response.json().catch(() => ({}));
        console.warn(`Cloudinary indisponível (${response.status}): ${err?.error?.message}. Tentando Firebase Storage.`);
      } catch (e) {
        console.warn('Cloudinary offline, tentando Firebase Storage:', e);
      }

      // 2) Fallback: Firebase Storage
      try {
        return await uploadToFirebase(blob, folder);
      } catch (e) {
        console.warn('Firebase Storage falhou, salvando imagem comprimida no Firestore:', e);
      }
    }

    // 3) Último recurso: imagem comprimida em base64 (sem rede — sempre funciona)
    return compressToDataUrl(dataUrl, 900, 0.82);
  },

  async uploadVideoFile(file: File, folder: string): Promise<string> {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', folder);
      const response = await fetch(UPLOAD_URL_VIDEO, { method: 'POST', body: form });
      if (response.ok) {
        const data = await response.json();
        return data.secure_url as string;
      }
      const err = await response.json().catch(() => ({}));
      console.warn(`Cloudinary vídeo indisponível (${response.status}): ${err?.error?.message}. Tentando Firebase Storage.`);
    } catch (e) {
      console.warn('Cloudinary vídeo offline, tentando Firebase Storage:', e);
    }

    // Fallback: Firebase Storage (sem último recurso base64 — vídeo é grande demais para o Firestore)
    return uploadVideoToFirebase(file, folder);
  },
};
