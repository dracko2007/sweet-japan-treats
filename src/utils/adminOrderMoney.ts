/**
 * Dinheiro do pedido no painel admin.
 *
 * O painel escrevia "R$" fixo em todo valor, então um pedido em ienes aparecia
 * como "R$ 5930.00". E os ienes só saíam se existisse `grandTotalYen`, campo de
 * pedidos antigos: os atuais gravam `totalYen`, `netProductsYen`,
 * `shippingCostYen` e `psFeeYen`, e por isso o admin não mostrava quanto o
 * pedido valia em ienes — que é a conta que a loja faz para saber o quanto foi
 * gasto e o que sobrou.
 */

const SYMBOL: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€', JPY: '¥' };

export interface OrderMoneyFields {
  currency?: string;
  totalYen?: number;
  grandTotalYen?: number;
  netProductsYen?: number;
  shippingCostYen?: number;
  psFeeYen?: number;
}

/** Valor na moeda do pedido: ienes sem casas decimais, as demais com duas. */
export function fmtOrderMoney(value: number | undefined | null, currency?: string): string {
  const code = String(currency || 'BRL').toUpperCase();
  const amount = Number(value) || 0;
  if (code === 'JPY') return `¥ ${Math.round(amount).toLocaleString('pt-BR')}`;
  return `${SYMBOL[code] ?? code} ${amount.toFixed(2)}`;
}

export function yen(value: number): string {
  return `¥ ${Math.round(value).toLocaleString('pt-BR')}`;
}

/** Total em ienes do pedido (campo atual, ou o antigo). 0 quando o pedido não guardou. */
export function orderTotalYen(order: OrderMoneyFields): number {
  return Number(order.totalYen ?? order.grandTotalYen) || 0;
}

export interface YenLine { label: string; value: number; bold?: boolean }

/**
 * Linhas "em ienes" do pedido, só as que existem: produtos, frete, taxa PS e total.
 * Pedido em ienes não precisa delas (o valor principal já está em ienes) e devolve [].
 */
export function orderYenLines(order: OrderMoneyFields): YenLine[] {
  if (String(order.currency || '').toUpperCase() === 'JPY') return [];
  const total = orderTotalYen(order);
  if (!(total > 0)) return [];
  const lines: YenLine[] = [];
  if (Number(order.netProductsYen) > 0) lines.push({ label: 'Produtos', value: Number(order.netProductsYen) });
  if (Number(order.shippingCostYen) > 0) lines.push({ label: 'Frete', value: Number(order.shippingCostYen) });
  if (Number(order.psFeeYen) > 0) lines.push({ label: 'Taxa PS', value: Number(order.psFeeYen) });
  lines.push({ label: 'Total em ienes', value: total, bold: true });
  return lines;
}
