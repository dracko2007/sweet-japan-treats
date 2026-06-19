const CLOUD_NAME = 'dw4j4tpub';
const UPLOAD_PRESET = 'japanexpress';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export const cloudinaryService = {
  isCloudinaryUrl: (s: string) =>
    typeof s === 'string' && s.includes('res.cloudinary.com'),

  isDataUrl: (s: string) =>
    typeof s === 'string' && s.startsWith('data:'),

  isExternalUrl: (s: string) =>
    typeof s === 'string' && s.startsWith('http') && !s.includes('res.cloudinary.com'),

  needsMigration: (s?: string) =>
    typeof s === 'string' && s.startsWith('data:'),

  async uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const form = new FormData();
    form.append('file', blob);
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', folder);

    const response = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Cloudinary error ${response.status}`);
    }
    const data = await response.json();
    // Força entrega em WebP com qualidade auto via transformation URL
    return data.secure_url.replace('/upload/', '/upload/f_webp,q_auto/');
  },
};
