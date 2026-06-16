import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, CloudUpload, AlertTriangle, RefreshCw, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/context/ProductsContext';
import { productService } from '@/services/productService';
import { storageService } from '@/services/storageService';
import { storage } from '@/config/firebase';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { Product } from '@/types';

const CONCURRENCY = 5;

const TEST_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function compressToWebp(src: string, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(''), 20000);
    img.onload = () => {
      clearTimeout(timer);
      let { width, height } = img;
      if (width > height && width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
      else if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const webp = canvas.toDataURL('image/webp', quality);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { clearTimeout(timer); resolve(''); };
    img.src = src;
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

// Timeout wrapper para qualquer Promise
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

async function testStorageAccess(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!storage) return { ok: false, error: 'Firebase Storage não inicializado.' };
    await ensureAdminAuth();
    const blob = await fetch(TEST_PIXEL).then((r) => r.blob());
    const fileRef = ref(storage, 'products/__test__/ping.png');
    // Timeout de 10s — se travar, avisa em vez de ficar preso
    const result = await withTimeout(
      uploadBytes(fileRef, blob).then(() => ({ ok: true as const })),
      10000,
      { ok: false as const, timedOut: true }
    );
    if ('timedOut' in result && result.timedOut) {
      return { ok: false, error: 'Timeout ao conectar ao Firebase Storage (>10s). Verifique sua conexão ou as regras do Storage.' };
    }
    try { await deleteObject(fileRef); } catch {}
    return { ok: true };
  } catch (e: any) {
    const code = e?.code || '';
    const msg = code === 'storage/unauthorized'
      ? 'Permissão negada — atualize as regras do Firebase Storage (veja abaixo).'
      : code === 'storage/unknown'
      ? 'Erro desconhecido do Storage. Verifique as regras e tente novamente.'
      : (e?.message || String(e));
    return { ok: false, error: msg };
  }
}

function needsMigration(p: Product): boolean {
  const isBase64 = (s?: string) => typeof s === 'string' && s.startsWith('data:');
  return isBase64(p.image) || isBase64(p.thumbnail) || (p.gallery?.some(isBase64) ?? false);
}

async function uploadCompressed(productId: string, imgStr: string, slot: string): Promise<string> {
  if (!imgStr) return '';
  if (storageService.isStorageUrl(imgStr)) return imgStr;
  if (!storage) throw new Error('Storage não inicializado');

  const compressed = await compressToWebp(imgStr, 800, 0.72);
  if (!compressed) return imgStr; // CORS/timeout — mantém original

  await ensureAdminAuth();
  const blob = await dataUrlToBlob(compressed);
  const ts = Date.now().toString(36);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileRef = ref(storage, `products/${productId}/${slot}_${ts}.${ext}`);
  const snap = await uploadBytes(fileRef, blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000,immutable' });
  return getDownloadURL(snap.ref);
}

async function migrateProduct(p: Product): Promise<Product> {
  const rawGallery = (p.gallery && p.gallery.length > 0) ? p.gallery : [p.image].filter(Boolean);

  const galleryUrls = await Promise.all(
    rawGallery.map((img, i) => uploadCompressed(p.id, img, i === 0 ? 'cover' : `gallery_${i}`))
  );
  const coverUrl = galleryUrls[0] || p.image;

  let thumbUrl = p.thumbnail || '';
  if (!thumbUrl || storageService.isDataUrl(thumbUrl)) {
    const coverRaw = rawGallery[0] || '';
    const thumbCompressed = await compressToWebp(coverRaw || coverUrl, 300, 0.60);
    if (thumbCompressed && storage) {
      await ensureAdminAuth();
      const blob = await dataUrlToBlob(thumbCompressed);
      const ts = Date.now().toString(36);
      const fileRef = ref(storage, `products/${p.id}/thumb_${ts}.webp`);
      const snap = await uploadBytes(fileRef, blob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' });
      thumbUrl = await getDownloadURL(snap.ref);
    }
  }

  return { ...p, image: coverUrl, thumbnail: thumbUrl || undefined, gallery: galleryUrls.filter(Boolean) };
}

async function runWithConcurrency<T>(
  items: T[], concurrency: number, fn: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0;
  const worker = async () => { while (idx < items.length) { const i = idx++; await fn(items[i]); } };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

interface MigState { status: 'idle' | 'running' | 'done' | 'error'; total: number; done: number; errors: string[]; }

const ImageMigration: React.FC = () => {
  const { products, refresh } = useProducts();
  const [state, setState] = useState<MigState>({ status: 'idle', total: 0, done: 0, errors: [] });
  const [storageTest, setStorageTest] = useState<{ checked: boolean; ok: boolean; error?: string }>({ checked: false, ok: false });

  useEffect(() => {
    testStorageAccess().then((r) => setStorageTest({ checked: true, ...r }));
  }, []);

  const toMigrate = products.filter(needsMigration);

  const runMigration = useCallback(async () => {
    if (toMigrate.length === 0) return;
    const errors: string[] = [];
    setState({ status: 'running', total: toMigrate.length, done: 0, errors: [] });

    await runWithConcurrency(toMigrate, CONCURRENCY, async (p) => {
      try {
        const migrated = await migrateProduct(p);
        await productService.save(migrated);
      } catch (e: any) {
        errors.push(`${p.name}: ${e?.message || 'erro'}`);
      }
      setState((s) => ({ ...s, done: s.done + 1, errors: [...errors] }));
    });

    await refresh();
    setState((s) => ({ ...s, status: errors.length > 0 ? 'error' : 'done', errors }));
  }, [toMigrate, refresh]);

  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  const allMigrated = toMigrate.length === 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CloudUpload className="w-5 h-5 text-primary" />
          Migração de Imagens → Firebase Storage
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Comprime imagens (5MB → ~150KB WebP) e envia ao CDN Google. {CONCURRENCY} produtos em paralelo.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-xl border border-border p-4">
          <div className="text-2xl font-bold">{products.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total de produtos</div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4">
          <div className="text-2xl font-bold text-orange-600">{toMigrate.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Precisam migrar</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 p-4">
          <div className="text-2xl font-bold text-green-600">{products.length - toMigrate.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Já no Storage</div>
        </div>
      </div>

      {state.status === 'running' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{CONCURRENCY} em paralelo · comprimindo + enviando</span>
            <span className="font-medium">{state.done}/{state.total} ({pct}%)</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {state.errors.length > 0 && <p className="text-xs text-orange-600">{state.errors.length} erro(s) — continuando...</p>}
        </div>
      )}

      {state.status === 'done' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="font-semibold text-green-700 dark:text-green-400">Migração concluída!</div>
            <div className="text-sm text-green-600/80">{state.total} produto(s) agora no CDN Google.</div>
          </div>
        </div>
      )}

      {state.status === 'error' && state.errors.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-red-700"><AlertTriangle className="w-4 h-4" /> {state.errors.length} erro(s)</div>
          <ul className="text-xs text-red-600 list-disc pl-5 max-h-32 overflow-y-auto space-y-1">
            {state.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {allMigrated && state.status !== 'running' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="font-semibold text-green-700 dark:text-green-400">Tudo migrado!</div>
            <div className="text-sm text-green-600/80">Todas as imagens estão no Firebase Storage (CDN Google).</div>
          </div>
        </div>
      )}

      {toMigrate.length > 0 && state.status === 'idle' && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {toMigrate.length} produto(s) com imagens base64
          </div>
          <div className="divide-y divide-border max-h-52 overflow-y-auto">
            {toMigrate.slice(0, 50).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                {(p.thumbnail || p.image) ? (
                  <img src={p.thumbnail || p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">base64</span>
              </div>
            ))}
            {toMigrate.length > 50 && <div className="px-4 py-2 text-xs text-muted-foreground">+ {toMigrate.length - 50} mais...</div>}
          </div>
        </div>
      )}

      {/* Diagnóstico Storage */}
      {storageTest.checked && !storageTest.ok && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 space-y-3">
          <div className="flex items-start gap-2 font-semibold text-red-700"><ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" /> Firebase Storage bloqueado</div>
          <p className="text-sm text-red-600">{storageTest.error}</p>
          <div className="text-xs text-red-500 space-y-0.5 bg-red-100 dark:bg-red-900/30 rounded-lg p-3 font-mono">
            <p className="font-sans font-semibold text-red-700 mb-2">Firebase Console → Storage → Rules:</p>
            <p>{"rules_version = '2';"}</p>
            <p>{"service firebase.storage {"}</p>
            <p>{"  match /b/{bucket}/o {"}</p>
            <p>{"    match /products/{allPaths=**} {"}</p>
            <p>{"      allow read: if true;"}</p>
            <p>{"      allow write: if request.auth != null;"}</p>
            <p>{"    }"}</p>
            <p>{"  }"}</p>
            <p>{"}"}</p>
          </div>
        </div>
      )}
      {storageTest.checked && storageTest.ok && state.status === 'idle' && !allMigrated && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" /> Storage acessível.
        </div>
      )}
      {!storageTest.checked && <div className="text-sm text-muted-foreground animate-pulse">Verificando acesso ao Storage...</div>}

      <div className="flex gap-3">
        {!allMigrated && state.status !== 'running' && storageTest.ok && (
          <Button onClick={runMigration} className="gap-2">
            <CloudUpload className="w-4 h-4" />
            {state.status === 'error' ? `Tentar novamente (${toMigrate.length})` : `Migrar ${toMigrate.length} produto(s)`}
          </Button>
        )}
        <Button variant="outline" onClick={refresh} className="gap-2" disabled={state.status === 'running'}>
          <RefreshCw className="w-4 h-4" />
          Recarregar lista
        </Button>
      </div>
    </div>
  );
};

export default ImageMigration;
