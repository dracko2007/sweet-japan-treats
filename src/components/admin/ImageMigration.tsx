import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, CloudUpload, AlertTriangle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/context/ProductsContext';
import { productService } from '@/services/productService';
import { storageService } from '@/services/storageService';
import { Product } from '@/types';

// Redimensiona qualquer imagem (data URL ou URL) para WebP via canvas
function resizeToDataUrl(src: string, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const webp = canvas.toDataURL('image/webp', quality);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function needsMigration(p: Product): boolean {
  const isBase64 = (s?: string) => typeof s === 'string' && s.startsWith('data:');
  if (isBase64(p.image) || isBase64(p.thumbnail)) return true;
  if (p.gallery?.some(isBase64)) return true;
  return false;
}

interface MigrationState {
  status: 'idle' | 'running' | 'done' | 'error';
  total: number;
  done: number;
  currentName: string;
  errors: string[];
}

const ImageMigration: React.FC = () => {
  const { products, refresh } = useProducts();
  const [state, setState] = useState<MigrationState>({
    status: 'idle', total: 0, done: 0, currentName: '', errors: [],
  });

  const toMigrate = products.filter(needsMigration);

  const migrateProduct = async (p: Product): Promise<Product> => {
    const toStorage = async (imgStr: string, slot: string): Promise<string> => {
      if (!imgStr) return '';
      if (storageService.isStorageUrl(imgStr)) return imgStr;
      let dataUrl = imgStr;
      if (storageService.isExternalUrl(imgStr)) {
        dataUrl = await resizeToDataUrl(imgStr, 800, 0.72);
      }
      return storageService.uploadImage(p.id, dataUrl, slot);
    };

    const rawGallery = p.gallery && p.gallery.length > 0 ? p.gallery : [p.image].filter(Boolean);
    const rawCover = rawGallery[0] || '';

    const coverUrl = await toStorage(rawCover, 'cover');

    // Gera thumbnail se não existe ou se é base64
    let thumbUrl = p.thumbnail || '';
    const needThumb = !thumbUrl || storageService.isDataUrl(thumbUrl);
    if (needThumb && rawCover) {
      const thumbData = await resizeToDataUrl(
        storageService.isDataUrl(rawCover) ? rawCover : coverUrl,
        300,
        0.60
      );
      thumbUrl = await storageService.uploadImage(p.id, thumbData, 'thumb');
    }

    const galleryUrls = await Promise.all(
      rawGallery.map((img, i) => i === 0 ? Promise.resolve(coverUrl) : toStorage(img, `gallery_${i}`))
    );

    return {
      ...p,
      image: coverUrl || p.image,
      thumbnail: thumbUrl || undefined,
      gallery: galleryUrls.filter(Boolean),
    };
  };

  const runMigration = useCallback(async () => {
    if (toMigrate.length === 0) return;
    setState({ status: 'running', total: toMigrate.length, done: 0, currentName: '', errors: [] });
    const errors: string[] = [];

    for (let i = 0; i < toMigrate.length; i++) {
      const p = toMigrate[i];
      setState((s) => ({ ...s, done: i, currentName: p.name }));
      try {
        const migrated = await migrateProduct(p);
        await productService.save(migrated);
      } catch (e: any) {
        errors.push(`${p.name}: ${e?.message || 'erro desconhecido'}`);
      }
    }

    await refresh();
    setState((s) => ({
      ...s,
      status: errors.length > 0 ? 'error' : 'done',
      done: toMigrate.length,
      currentName: '',
      errors,
    }));
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
          Move imagens em base64 (salvas no Firestore) para o Firebase Storage (CDN Google).
          Reduz o tempo de carregamento dos produtos de segundos para milissegundos.
        </p>
      </div>

      {/* Status geral */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-xl border border-border p-4">
          <div className="text-2xl font-bold text-foreground">{products.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total de produtos</div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-4">
          <div className="text-2xl font-bold text-orange-600">{toMigrate.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Precisam migrar</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4">
          <div className="text-2xl font-bold text-green-600">{products.length - toMigrate.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Já no Storage</div>
        </div>
      </div>

      {/* Progresso */}
      {state.status === 'running' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Processando: <span className="font-medium text-foreground">{state.currentName}</span></span>
            <span>{state.done}/{state.total} ({pct}%)</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Resultado */}
      {state.status === 'done' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="font-semibold text-green-700 dark:text-green-400">Migração concluída!</div>
            <div className="text-sm text-green-600/80">{state.total} produto(s) migrados para o Firebase Storage.</div>
          </div>
        </div>
      )}

      {state.status === 'error' && state.errors.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" /> {state.errors.length} erro(s)
          </div>
          <ul className="text-sm text-red-600 space-y-1 list-disc pl-5">
            {state.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Lista de produtos pendentes */}
      {toMigrate.length > 0 && state.status === 'idle' && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Produtos com imagens em base64 ({toMigrate.length})
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {toMigrate.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                {p.image && (p.thumbnail || p.image) ? (
                  <img
                    src={p.thumbnail || p.image}
                    alt={p.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(p.gallery?.length || 1)} foto(s) · {p.category}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 shrink-0">
                  base64
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allMigrated && state.status !== 'running' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="font-semibold text-green-700 dark:text-green-400">Tudo migrado!</div>
            <div className="text-sm text-green-600/80">Todas as imagens estão no Firebase Storage (CDN Google).</div>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        {!allMigrated && state.status !== 'running' && (
          <Button onClick={runMigration} className="gap-2">
            <CloudUpload className="w-4 h-4" />
            {state.status === 'error' ? 'Tentar novamente' : `Migrar ${toMigrate.length} produto(s)`}
          </Button>
        )}
        <Button variant="outline" onClick={() => refresh()} className="gap-2" disabled={state.status === 'running'}>
          <RefreshCw className="w-4 h-4" />
          Recarregar lista
        </Button>
      </div>
    </div>
  );
};

export default ImageMigration;
