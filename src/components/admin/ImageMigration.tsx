import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, CloudUpload, AlertTriangle, RefreshCw, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/context/ProductsContext';
import { productService } from '@/services/productService';
import { storageService } from '@/services/storageService';
import { Product } from '@/types';

const CONCURRENCY = 3;

// Pixel 1x1 WebP mínimo para teste de upload
const TEST_PIXEL = 'data:image/webp;base64,UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JZACdAEO/gHOAAD++P/////8AAA=';

async function testStorageAccess(): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = await storageService.uploadImage('__test__', TEST_PIXEL, 'ping');
    if (url) {
      // Remove o arquivo de teste
      try { const { ref, deleteObject } = await import('firebase/storage'); const { storage } = await import('@/config/firebase'); if (storage) await deleteObject(ref(storage, 'products/__test__/ping.webp')); } catch {}
    }
    return { ok: true };
  } catch (e: any) {
    const msg = e?.code === 'storage/unauthorized'
      ? 'Permissão negada — atualize as regras do Firebase Storage para permitir escrita de admins autenticados.'
      : e?.code === 'storage/object-not-found' ? 'ok' // deletado antes do check — tudo bem
      : (e?.message || String(e));
    return { ok: e?.code === 'storage/object-not-found', error: msg };
  }
}

// Converte data URL para blob sem re-encodar (mais rápido)
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/webp';
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Só redimensiona se for URL externa (CORS permitting). Data URLs vão direto.
function resizeExternalUrl(url: string, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(''), 15000); // timeout 15s
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
    img.src = url;
  });
}

// Gera thumbnail 300px a partir de data URL
function makeThumb(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 300;
      let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
      else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const webp = canvas.toDataURL('image/webp', 0.60);
      resolve(webp.startsWith('data:image/webp') ? webp : '');
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

function needsMigration(p: Product): boolean {
  const isBase64 = (s?: string) => typeof s === 'string' && s.startsWith('data:');
  return isBase64(p.image) || isBase64(p.thumbnail) || (p.gallery?.some(isBase64) ?? false);
}

// Processa 1 produto: faz upload de todas as imagens base64 → Storage
async function migrateProduct(p: Product): Promise<Product> {
  const uploadDataUrl = async (dataUrl: string, slot: string): Promise<string> => {
    if (!dataUrl) return '';
    if (storageService.isStorageUrl(dataUrl)) return dataUrl;

    // URL externa — tenta baixar via canvas (pode falhar por CORS)
    if (storageService.isExternalUrl(dataUrl)) {
      const downloaded = await resizeExternalUrl(dataUrl, 800, 0.72);
      if (!downloaded) return dataUrl; // CORS bloqueou, mantém URL original
      return storageService.uploadImage(p.id, downloaded, slot);
    }

    // Base64 → upload direto (sem re-encodar, muito mais rápido)
    return storageService.uploadImage(p.id, dataUrl, slot);
  };

  const rawGallery = (p.gallery && p.gallery.length > 0) ? p.gallery : [p.image].filter(Boolean);

  // Faz upload de todas as fotos da galeria em paralelo
  const galleryUrls = await Promise.all(
    rawGallery.map((img, i) => uploadDataUrl(img, i === 0 ? 'cover' : `gallery_${i}`))
  );
  const coverUrl = galleryUrls[0] || p.image;

  // Thumbnail: gera a partir da capa base64 se ainda for base64
  let thumbUrl = p.thumbnail || '';
  const coverRaw = rawGallery[0] || '';
  if (storageService.isDataUrl(coverRaw) && (!thumbUrl || storageService.isDataUrl(thumbUrl))) {
    const thumbData = await makeThumb(coverRaw);
    if (thumbData) thumbUrl = await storageService.uploadImage(p.id, thumbData, 'thumb');
  }

  return {
    ...p,
    image: coverUrl,
    thumbnail: thumbUrl || undefined,
    gallery: galleryUrls.filter(Boolean),
  };
}

// Executa lista com concorrência limitada
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

interface MigrationState {
  status: 'idle' | 'running' | 'done' | 'error';
  total: number;
  done: number;
  errors: string[];
}

const ImageMigration: React.FC = () => {
  const { products, refresh } = useProducts();
  const [state, setState] = useState<MigrationState>({ status: 'idle', total: 0, done: 0, errors: [] });
  const [storageTest, setStorageTest] = useState<{ checked: boolean; ok: boolean; error?: string }>({ checked: false, ok: false });

  // Testa acesso ao Storage ao montar o componente
  useEffect(() => {
    testStorageAccess().then((result) => {
      setStorageTest({ checked: true, ...result });
    });
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
          Move imagens em base64 para o Firebase Storage (CDN Google).
          Processa <strong>{CONCURRENCY} produtos em paralelo</strong> para maior velocidade.
        </p>
      </div>

      {/* Contadores */}
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

      {/* Progresso */}
      {state.status === 'running' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{CONCURRENCY} em paralelo</span>
            <span className="font-medium">{state.done}/{state.total} ({pct}%)</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          {state.errors.length > 0 && (
            <p className="text-xs text-orange-600">{state.errors.length} erro(s) até agora — continuando...</p>
          )}
        </div>
      )}

      {/* Resultado */}
      {state.status === 'done' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="font-semibold text-green-700 dark:text-green-400">Migração concluída!</div>
            <div className="text-sm text-green-600/80">{state.total} produto(s) processados. Imagens agora no CDN Google.</div>
          </div>
        </div>
      )}

      {state.status === 'error' && state.errors.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-red-700">
            <AlertTriangle className="w-4 h-4" /> {state.errors.length} erro(s)
          </div>
          <ul className="text-xs text-red-600 space-y-1 list-disc pl-5 max-h-32 overflow-y-auto">
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

      {/* Lista resumida */}
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
            {toMigrate.length > 50 && (
              <div className="px-4 py-2 text-xs text-muted-foreground">+ {toMigrate.length - 50} mais...</div>
            )}
          </div>
        </div>
      )}

      {/* Diagnóstico do Storage */}
      {storageTest.checked && !storageTest.ok && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 space-y-3">
          <div className="flex items-start gap-2 font-semibold text-red-700 dark:text-red-400">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            Firebase Storage bloqueado
          </div>
          <p className="text-sm text-red-600">{storageTest.error}</p>
          <div className="text-xs text-red-500 space-y-1 bg-red-100 dark:bg-red-900/30 rounded-lg p-3 font-mono">
            <p className="font-sans font-semibold text-red-700 mb-2">Para corrigir — Firebase Console → Storage → Rules:</p>
            <p>{'rules_version = \'2\';'}</p>
            <p>{'service firebase.storage {'}</p>
            <p>{'  match /b/{bucket}/o {'}</p>
            <p>{'    match /products/{allPaths=**} {'}</p>
            <p>{'      allow read: if true;'}</p>
            <p>{'      allow write: if request.auth != null;'}</p>
            <p>{'    }'}</p>
            <p>{'  }'}</p>
            <p>{'}'}</p>
          </div>
        </div>
      )}
      {storageTest.checked && storageTest.ok && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" /> Firebase Storage acessível — pode migrar.
        </div>
      )}
      {!storageTest.checked && (
        <div className="text-sm text-muted-foreground animate-pulse">Verificando acesso ao Firebase Storage...</div>
      )}

      <div className="flex gap-3">
        {!allMigrated && state.status !== 'running' && storageTest.ok && (
          <Button onClick={runMigration} className="gap-2">
            <CloudUpload className="w-4 h-4" />
            {state.status === 'error' ? 'Tentar erros novamente' : `Migrar ${toMigrate.length} produto(s)`}
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
