// O feed declarava `brand: Japan Express` nos 296 produtos. Estão errados: são
// Kewpie, Bioré, Glico. O Google reprova por marca incorreta, deixa de casar a
// busca por marca no Shopping, e o nome ainda colide com as transportadoras
// homônimas ("Japan Express" de logística e de frete de automóveis).
//
// A marca sai do nome do produto, por lista ordenada — a primeira que casar
// vence. Os casos abaixo são os que quebram uma implementação ingênua, todos
// tirados do catálogo real.
import { describe, expect, it } from 'vitest';

import { GOOGLE_CATEGORY, detectBrand } from '../feed.js';

describe('detectBrand', () => {
  it('usa o fabricante, nunca a loja, quando a marca está no nome', () => {
    expect(detectBrand('Kewpie Mayonnaise 700g')).toBe('Kewpie');
    expect(detectBrand('Bioré UV Aqua Rich Watery Essence')).toBe('Bioré');
    expect(detectBrand('SKIN1004 Madagascar Centella Ampoule')).toBe('SKIN1004');
  });

  it('resolve a marca mesmo quando ela não abre o nome', () => {
    // O nome começa com o tipo do produto, em português.
    expect(detectBrand('Sabonete Corporal 8x4 MEN Foot + Body')).toBe('8x4');
    expect(detectBrand('Furikake Marumiya Noritama')).toBe('Marumiya');
    expect(detectBrand('Chá de Cevada Japonês (Mugicha) Ito En – 54 Sachês')).toBe('Ito En');
    expect(detectBrand('Kit Ululis Pinkme (Shampoo + Tratamento)')).toBe('Ululis');
  });

  it('prefere a entrada mais específica quando duas casam', () => {
    // 'ReFa Honey Queen' casa com /honey/ — ReFa precisa vencer.
    expect(detectBrand('ReFa Honey Queen SHAMPOO & TREATMENT')).toBe('ReFa');
    expect(detectBrand('Reva Honey Queen Shampoo/ReFa HONEY QUEEN')).toBe('ReFa');
    // 'Shiseido Senka' e 'Specialty SENKA' são a mesma marca.
    expect(detectBrand('Specialty SENKA Perfect Whip White Clay')).toBe('Senka');
    expect(detectBrand('Shiseido Senka')).toBe('Senka');
  });

  it('não casa sigla curta dentro de outra palavra', () => {
    // O caso que motivou os \b: 'Deoxyribose' contém 'oxy'.
    expect(detectBrand('Medicube Deoxyribose Scalp Serum')).toBe('Medicube');
    expect(detectBrand('OXY Clear Wash – Sabonete Facial')).toBe('OXY');
  });

  it('agrupa submarcas sob o fabricante', () => {
    // Pocky, Pretz e Caplico são todas Ezaki Glico.
    expect(detectBrand('Pocky Chocolate Original 10 unidade')).toBe('Glico');
    expect(detectBrand('Glico Pretz Salada – Palitos Crocantes')).toBe('Glico');
    expect(detectBrand('Caplico Giant Morango 10 unidade')).toBe('Glico');
    // Hatomugi, com ou sem o nome da linha, é Naturie.
    expect(detectBrand('Hatomugi Body Milk 400ml')).toBe('Naturie');
    expect(detectBrand('Naturie Hatomugi Skin Conditioner')).toBe('Naturie');
  });

  it('assina com a loja quando o produto não tem marca', () => {
    // Genérico de verdade — inventar marca aqui é o erro que estamos corrigindo.
    expect(detectBrand('Escova Massageadora para Cães e Gatos')).toBe('Japan Express Store');
    expect(detectBrand('')).toBe('Japan Express Store');
    expect(detectBrand(undefined)).toBe('Japan Express Store');
  });
});

describe('GOOGLE_CATEGORY', () => {
  it('manda alimento para Alimentos, não para Doces e chocolates', () => {
    // 4748 (Doces e chocolates) seria falso para 31 dos 72 itens de `doces` —
    // a categoria da loja mistura curry, maionese, ramen e chá.
    expect(GOOGLE_CATEGORY.doces).toBe(422);
    expect(GOOGLE_CATEGORY.cosmeticos).toBe(469);
    expect(GOOGLE_CATEGORY.pet).toBe(2);
  });
});
