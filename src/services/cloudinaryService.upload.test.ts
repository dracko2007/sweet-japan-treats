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

/** Encena a leitura do data URL e a resposta do POST ao Cloudinary. */
function encenar(respostaCloudinary: Partial<Response> | Error): void {
  vi.stubGlobal('fetch', vi.fn(async (alvo: unknown) => {
    if (typeof alvo === 'string' && alvo.startsWith('data:')) {
      return { blob: async () => new Blob(['x'], { type: 'image/png' }) } as unknown as Response;
    }
    if (respostaCloudinary instanceof Error) throw respostaCloudinary;
    return respostaCloudinary as Response;
  }));
}

describe('cloudinaryService.uploadDataUrl', () => {
  beforeEach(() => {
    storageMocks.uploadBytes.mockReset();
    storageMocks.getDownloadURL.mockReset();
  });

  it('devolve a URL do Cloudinary quando o envio funciona', async () => {
    encenar({ ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/x/a.jpg' }) } as Partial<Response>);

    const url = await cloudinaryService.uploadDataUrl(IMAGEM, 'japanexpress/products/p1');

    expect(url).toBe('https://res.cloudinary.com/x/a.jpg');
  });

  it('cai para o Firebase Storage quando o Cloudinary recusa', async () => {
    encenar({ ok: false, status: 420, json: async () => ({ error: { message: 'quota' } }) } as Partial<Response>);
    storageMocks.uploadBytes.mockResolvedValue({});
    storageMocks.getDownloadURL.mockResolvedValue('https://firebasestorage.app/b.png');

    const url = await cloudinaryService.uploadDataUrl(IMAGEM, 'japanexpress/products/p1');

    expect(url).toBe('https://firebasestorage.app/b.png');
  });

  it('LANÇA quando os dois falham — nunca devolve base64', async () => {
    encenar({ ok: false, status: 420, json: async () => ({ error: { message: 'quota' } }) } as Partial<Response>);
    storageMocks.uploadBytes.mockRejectedValue(new Error('storage indisponível'));

    // Encena o retorno de verdade: se algum dia voltar a resolver, `devolvido`
    // guarda o valor e o teste falha — inclusive (sobretudo) se for um `data:`.
    let devolvido: string | null = null;
    let mensagem = '';
    try {
      devolvido = await cloudinaryService.uploadDataUrl(IMAGEM, 'japanexpress/products/p1');
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    }

    expect(devolvido).toBeNull();
    expect(mensagem).toMatch(/Não foi possível enviar a imagem/);
  });

  it('explica os dois motivos na mensagem, para o admin saber o que houve', async () => {
    encenar({ ok: false, status: 420, json: async () => ({ error: { message: 'limite mensal' } }) } as Partial<Response>);
    storageMocks.uploadBytes.mockRejectedValue(new Error('sem permissão'));

    await expect(cloudinaryService.uploadDataUrl(IMAGEM, 'p')).rejects.toThrow(/limite mensal.*sem permissão/s);
  });
});
