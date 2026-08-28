/**
 * Aritmética pura da reserva de estoque comum: holds vigentes, vencidos,
 * exclusão da própria reserva, substituição por retentativa.
 *
 * `prazoReserva`/`PRAZO_RESERVA_*` são as mesmas de `promo-reserve.js`
 * (reexportadas daqui) — já cobertas em `promo-reserve.test.js`, não
 * repetidas aqui.
 *
 * Não testa a fiação (integração com orders.js e fulfillment.js) — isso fica
 * em `orders.stock-reserve.test.js`.
 */
import { describe, it, expect } from 'vitest';
import {
  quantidadeReservadaEstoque,
  comReservaEstoque,
  semReservaEstoque,
} from './stock-reserve.js';

const HORA = 60 * 60 * 1000;
const AGORA = 1000000;

function estado(holds = []) {
  return { holds };
}

function hold(orderId, quantity, expiresAt) {
  return { orderId, quantity, expiresAt };
}

describe('quantidadeReservadaEstoque', () => {
  it('soma só os holds vigentes', () => {
    const e = estado([
      hold('A', 2, AGORA + HORA),
      hold('B', 3, AGORA + HORA),
      hold('C', 5, AGORA - 1), // vencido
    ]);
    expect(quantidadeReservadaEstoque(e, 'nenhum-deles', AGORA)).toBe(5);
  });

  it('exclui a própria reserva do pedido', () => {
    const e = estado([hold('A', 2, AGORA + HORA), hold('B', 3, AGORA + HORA)]);
    expect(quantidadeReservadaEstoque(e, 'A', AGORA)).toBe(3);
  });

  it('devolve 0 sem estado', () => {
    expect(quantidadeReservadaEstoque(null, 'A', AGORA)).toBe(0);
    expect(quantidadeReservadaEstoque(undefined, 'A', AGORA)).toBe(0);
  });

  it('ignora hold com quantity <= 0', () => {
    const e = estado([hold('A', 0, AGORA + HORA), hold('B', -1, AGORA + HORA)]);
    expect(quantidadeReservadaEstoque(e, 'nenhum', AGORA)).toBe(0);
  });
});

describe('comReservaEstoque', () => {
  it('adiciona a reserva do pedido preservando as vigentes de outros', () => {
    const e = estado([hold('A', 1, AGORA + HORA)]);
    const novo = comReservaEstoque(e, { orderId: 'B', quantity: 2, paymentMethod: 'pix' }, AGORA);
    expect(novo.holds).toHaveLength(2);
    expect(novo.holds.find((h) => h.orderId === 'B')).toMatchObject({ quantity: 2 });
  });

  it('poda holds vencidos ao gravar', () => {
    const e = estado([hold('A', 1, AGORA - 1)]);
    const novo = comReservaEstoque(e, { orderId: 'B', quantity: 1, paymentMethod: 'pix' }, AGORA);
    expect(novo.holds).toHaveLength(1);
    expect(novo.holds[0].orderId).toBe('B');
  });

  it('retentativa do mesmo pedido substitui a reserva anterior, não soma', () => {
    const e = estado([hold('A', 1, AGORA + HORA)]);
    const novo = comReservaEstoque(e, { orderId: 'A', quantity: 5, paymentMethod: 'pix' }, AGORA);
    expect(novo.holds).toHaveLength(1);
    expect(novo.holds[0]).toMatchObject({ orderId: 'A', quantity: 5 });
  });

  it('quantity 0 remove a reserva do pedido sem adicionar nova', () => {
    const e = estado([hold('A', 1, AGORA + HORA)]);
    const novo = comReservaEstoque(e, { orderId: 'A', quantity: 0, paymentMethod: 'pix' }, AGORA);
    expect(novo.holds).toHaveLength(0);
  });

  it('prazo do cartão é mais curto que o de métodos manuais', () => {
    const cartao = comReservaEstoque(estado(), { orderId: 'A', quantity: 1, paymentMethod: 'card' }, AGORA);
    const pix = comReservaEstoque(estado(), { orderId: 'B', quantity: 1, paymentMethod: 'pix' }, AGORA);
    expect(cartao.holds[0].expiresAt).toBeLessThan(pix.holds[0].expiresAt);
  });
});

describe('semReservaEstoque', () => {
  it('remove só a reserva do pedido informado', () => {
    const e = estado([hold('A', 1, AGORA + HORA), hold('B', 2, AGORA + HORA)]);
    const novo = semReservaEstoque(e, 'A', AGORA);
    expect(novo.holds).toHaveLength(1);
    expect(novo.holds[0].orderId).toBe('B');
  });

  it('não falha quando o pedido não tinha reserva', () => {
    const e = estado([hold('B', 2, AGORA + HORA)]);
    const novo = semReservaEstoque(e, 'A', AGORA);
    expect(novo.holds).toHaveLength(1);
  });

  it('funciona com estado vazio/nulo', () => {
    expect(semReservaEstoque(null, 'A', AGORA).holds).toEqual([]);
    expect(semReservaEstoque(estado(), 'A', AGORA).holds).toEqual([]);
  });
});
