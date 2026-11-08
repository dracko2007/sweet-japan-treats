import { describe, expect, it } from 'vitest';
import { trackingCarrierOption, trackingUrlFor } from './trackingUrl';

describe('rastreio a partir da transportadora do pedido', () => {
  it.each(['ems', 'eraito', 'kozutsumi-air', 'yuubin'])('%s é Japan Post e ganha link', (id) => {
    expect(trackingCarrierOption(id)).toBe('Japan Post');
    expect(trackingUrlFor(id, 'EE123456789JP')).toContain('trackings.post.japanpost.jp');
  });

  it('Yamato e Sagawa pelo código do checkout', () => {
    expect(trackingUrlFor('yamato', '1234')).toContain('kuronekoyamato');
    expect(trackingUrlFor('sagawa', '1234')).toContain('sagawa-exp');
  });

  it('nomes escolhidos no modal continuam funcionando', () => {
    expect(trackingUrlFor('Japan Post', 'RR1JP')).toContain('japanpost');
    expect(trackingUrlFor('Correios', 'AA1BR')).toContain('linketrack');
    expect(trackingUrlFor('Fukutsu', '9')).toContain('fukutsu');
  });

  it('transportadora desconhecida fica sem link, e o código vai codificado', () => {
    expect(trackingUrlFor('outra', '1')).toBe('');
    expect(trackingUrlFor('ems', 'A B&C')).toContain('reqCodeNo1=A%20B%26C');
  });
});
