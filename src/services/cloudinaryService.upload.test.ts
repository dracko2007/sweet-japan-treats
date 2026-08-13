// Em 26/07/2026, 88 produtos haviam acumulado 20,4 MB de imagens em base64
// dentro dos próprios documentos do Firestore — 98% do catálogo. A origem era
// um terceiro nível de fallback que, quando Cloudinary e Firebase Storage
// falhavam, gravava a imagem embutida "para o produto nunca deixar de salvar".
// A degradação era silenciosa, então ninguém viu o catálogo crescer até a loja
// cair por estouro de cota.
//
// Este teste existe para que esse fallback não volte.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({ uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));

vi.mock('@/config/firebase', () => ({ storage: {} }));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ kind: 'ref' })),
  uploadBytes: storageMocks.uploadBytes,
  getDownloadURL: storageMocks.getDownloadURL,
}));

import { cloudinaryService } from '@/services/cloudinaryService';

const IMAGEM = 'data:image/png;base64,iVBORw0KGgo=';

function encenarFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (alvo: unknown) => {
    if (typeof alvo === 'string' && alvo.startsWith('data:')) throw new TypeError('Load failed');
    return { blob: async () => new Blob(['xyz'], { type: 'image/jpeg' }) } as unknown as Response;
  }));
}

describe('cloudinaryService.uploadDataUrl', () => {
  beforeEach(() => {
    storageMocks.uploadBytes.mockReset();
    storageMocks.getDownloadURL.mockReset();
    encenarFetch();
  });

  it('envia imagens exclusivamente para Firebase Storage', async () => {
    storageMocks.uploadBytes.mockResolvedValue({});
    storageMocks.getDownloadURL.mockResolvedValue('https://firebasestorage.app/b.png');
    const url = await cloudinaryService.uploadDataUrl(IMAGEM, 'japanexpress/products/p1');
    expect(url).toBe('https://firebasestorage.app/b.png');
    expect(storageMocks.uploadBytes).toHaveBeenCalledTimes(1);
  });

  it('lança quando Firebase Storage falha e nunca devolve base64 ou Cloudinary', async () => {
    storageMocks.uploadBytes.mockRejectedValue(new Error('storage indisponível'));
    await expect(cloudinaryService.uploadDataUrl(IMAGEM, 'japanexpress/products/p1'))
      .rejects.toThrow(/Não foi possível enviar a imagem/);
  });
});

describe('leitura da imagem sem fetch', () => {
  const PIXEL_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('envia a imagem mesmo com o fetch de data URL falhando como no Safari', async () => {
    storageMocks.uploadBytes.mockResolvedValue({});
    storageMocks.getDownloadURL.mockResolvedValue('https://firebasestorage.app/a.jpg');
    const url = await cloudinaryService.uploadDataUrl(`data:image/png;base64,${PIXEL_PNG}`, 'p');
    expect(url).toBe('https://firebasestorage.app/a.jpg');
  });

  it('não tenta upload Cloudinary e preserva o mime dos bytes', async () => {
    storageMocks.uploadBytes.mockResolvedValue({});
    storageMocks.getDownloadURL.mockResolvedValue('https://firebasestorage.app/a.jpg');
    await cloudinaryService.uploadDataUrl(`data:image/png;base64,${PIXEL_PNG}`, 'p');
    expect(storageMocks.uploadBytes.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
  });

  it('continua lendo URL http pela rede antes de enviar ao Firebase', async () => {
    storageMocks.uploadBytes.mockResolvedValue({});
    storageMocks.getDownloadURL.mockResolvedValue('https://firebasestorage.app/b.jpg');
    await expect(cloudinaryService.uploadDataUrl('https://exemplo.com/foto.jpg', 'p'))
      .resolves.toBe('https://firebasestorage.app/b.jpg');
  });

  it('acusa canvas vazio em vez de enviar 0 byte', async () => {
    await expect(cloudinaryService.uploadDataUrl('data:,', 'p'))
      .rejects.toThrow(/não conseguiu exportar a imagem/);
  });
});
