import { describe, expect, it } from 'vitest';
import { assignSkus, findDuplicateSkus, generateUniqueSku } from './sku';

describe('generateUniqueSku', () => {
  it('continua depois do maior número, sem reaproveitar buracos', () => {
    // 0002 era de um produto apagado: o número não volta a ser usado
    expect(generateUniqueSku('cosmeticos', [{ category: 'cosmeticos', sku: 'JE-COS-0001' }, { category: 'cosmeticos', sku: 'JE-COS-0003' }])).toBe('JE-COS-0004');
  });

  it('conta SKU de produto que mudou de categoria', () => {
    // caso real: KitKat em "doces" com JE-COS-0066
    expect(generateUniqueSku('cosmeticos', [{ category: 'doces', sku: 'JE-COS-0066' }])).toBe('JE-COS-0067');
  });

  it('começa em 0001 e separa os prefixos', () => {
    expect(generateUniqueSku('doces', [{ category: 'cosmeticos', sku: 'JE-COS-0010' }])).toBe('JE-DOC-0001');
  });
});

describe('assignSkus', () => {
  it('só preenche quem não tem SKU, depois do maior número de cada prefixo', () => {
    const result = assignSkus([
      { id: 'b', category: 'cosmeticos' },
      { id: 'a', category: 'cosmeticos' },
      { id: 'c', category: 'cosmeticos', sku: 'JE-COS-0005' },
      { id: 'd', category: 'doces', sku: 'JE-COS-0009' },
      { id: 'e', category: 'doces' },
    ]);
    expect(result).toEqual({ a: 'JE-COS-0010', b: 'JE-COS-0011', e: 'JE-DOC-0001' });
  });
});

describe('findDuplicateSkus', () => {
  it('lista os SKUs repetidos', () => {
    expect(findDuplicateSkus([
      { id: 'x', sku: 'JE-COS-0091' },
      { id: 'y', sku: 'JE-COS-0091' },
      { id: 'z', sku: 'JE-COS-0092' },
      { id: 'w' },
    ])).toEqual({ 'JE-COS-0091': ['x', 'y'] });
  });
});
