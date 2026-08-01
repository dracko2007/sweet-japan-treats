// Pontos de fidelidade — a MESMA conta na tela do checkout e no servidor.
//
// Mora em `shared/` pelo mesmo motivo que `pricing.js`: `src` não pode importar
// de `api/_lib`, e `src/services/pointsService.ts` puxa o Firebase, então o
// servidor também não pode importar de lá. Sem um lugar comum, viram duas
// cópias — e foi exatamente o que aconteceu: a tela prometia 100 pontos e o
// servidor creditava 85 quando havia cupom e pagamento em PIX.

/** 1 ponto a cada ¥100 gastos em produto. */
export const POINTS_PER_100_YEN = 1;

/** Um ponto vale ¥1 de desconto no resgate. */
export const YEN_PER_POINT = 1;

export function pointsForSpendYen(yen) {
  return Math.max(0, Math.floor((Number(yen) || 0) / 100) * POINTS_PER_100_YEN);
}

/**
 * Níveis de pontos — quanto mais o cliente compra, mais ponto cada ¥100 rende.
 *
 * Patamares como DADO, não como cadeia de `if`: o dono muda faixa e
 * multiplicador com frequência, e mexer numa lista é mais seguro do que mexer
 * em ramificação. Ordem CRESCENTE — a tela desenha os três em sequência e o
 * cálculo do próximo nível depende disso.
 *
 * O `id` é a chave de tradução e do troféu na tela; o nome em si não mora aqui
 * porque `shared/` é usado pelo servidor, que não tem idioma.
 *
 * O gasto que conta é só mercadoria — taxa do personal shopper e frete ficam
 * de fora, pela mesma razão que não geram ponto: são serviço, não compra.
 */
export const TIERS = [
  { id: 'bronze', minSpendYen: 0, multiplier: 1 },
  { id: 'prata', minSpendYen: 50000, multiplier: 2 },
  { id: 'ouro', minSpendYen: 100000, multiplier: 3 },
];

/** Janela do gasto: o mês atual mais os 2 anteriores. */
export const SPEND_WINDOW_MONTHS = 3;

/** Nível atingido por um gasto acumulado na janela (o mais alto alcançado). */
export function currentTier(spendYen) {
  const gasto = Math.max(0, Number(spendYen) || 0);
  let atingido = TIERS[0];
  for (const tier of TIERS) {
    if (gasto >= tier.minSpendYen) atingido = tier;
  }
  return atingido;
}

/** Multiplicador de pontos para um gasto acumulado na janela: 1, 2 ou 3. */
export function pointsMultiplierForSpend(spendYen) {
  return currentTier(spendYen).multiplier;
}

/**
 * Onde o cliente está e quanto falta para subir — o que a tela do perfil
 * mostra. Mora aqui junto dos patamares: quem mudar a faixa muda a barra de
 * progresso no mesmo lugar, sem uma segunda conta para desencontrar.
 *
 * No topo devolve `next: null` e `percent: 100` — não existe "faltando" para
 * quem já está no nível máximo.
 */
export function tierProgress(spendYen) {
  const gasto = Math.max(0, Number(spendYen) || 0);
  const tier = currentTier(gasto);
  const next = TIERS.find((candidato) => candidato.minSpendYen > gasto) ?? null;
  if (!next) return { spendYen: gasto, tier, next: null, remainingYen: 0, percent: 100 };
  const faixa = next.minSpendYen - tier.minSpendYen;
  return {
    spendYen: gasto,
    tier,
    next,
    remainingYen: next.minSpendYen - gasto,
    // Teto de 99 enquanto falta subir: com arredondamento, ¥49.999 daria 100% e
    // a barra apareceria cheia ainda em bronze. Barra cheia = nível alcançado.
    percent: Math.max(0, Math.min(99, Math.floor(((gasto - tier.minSpendYen) / faixa) * 100))),
  };
}

/**
 * Início da janela de gasto: primeiro instante do mês de 2 meses atrás.
 *
 * A janela é por MÊS-CALENDÁRIO, não 90 dias corridos — é o que a loja
 * prometeu: quem compra ¥100.000 em janeiro mantém o x3 em janeiro, fevereiro
 * e março, e em abril a janela (fevereiro a abril) já não enxerga aquela
 * compra. Com 90 dias corridos a data da compra dentro do mês mudaria o
 * resultado, e ninguém consegue explicar isso ao cliente.
 *
 * Usa UTC para evitar desvios de timezone em filtros de servidor.
 */
export function spendWindowStart(now = new Date()) {
  const referencia = now instanceof Date ? now : new Date(now);
  const year = referencia.getUTCFullYear();
  const month = referencia.getUTCMonth(); // 0-11
  const windowMonth = month - (SPEND_WINDOW_MONTHS - 1);
  return new Date(Date.UTC(year, windowMonth, 1, 0, 0, 0, 0));
}

/**
 * Pontos do pedido.
 *
 * Conta sobre o valor CHEIO dos produtos: cupom e desconto de pagamento não
 * cortam ponto. Quem compra ¥10.000 ganha 100 pontos, tenha usado cupom ou não
 * — é o que a tela sempre prometeu, e é a promessa que a loja escolheu manter.
 *
 * O que sai da base é só o que foi pago COM pontos. Sem isso o resgate se
 * pagaria sozinho: ¥1.000 em pontos viraria ¥1.000 de compra que devolve mais
 * 10 pontos, indefinidamente.
 *
 * Frete e taxa do personal shopper nunca entraram — pontos são sobre mercadoria.
 *
 * O multiplicador vem do nível do cliente (`pointsMultiplierForSpend`) e
 * multiplica o PONTO, não a base em ienes: "2 pontos por ¥100" é o que foi
 * prometido. Multiplicar a base mudaria o arredondamento — ¥150 renderia 3
 * pontos em vez de 2. Default 1 mantém idêntica toda chamada de 2 argumentos.
 */
export function earnedPointsForOrder(productSubtotalYen, pointsDiscountYen = 0, multiplier = 1) {
  const bruto = Math.max(0, Number(productSubtotalYen) || 0);
  const pago = Math.max(0, Number(pointsDiscountYen) || 0);
  const fator = Math.max(1, Math.floor(Number(multiplier) || 1));
  return pointsForSpendYen(Math.max(0, bruto - pago)) * fator;
}
