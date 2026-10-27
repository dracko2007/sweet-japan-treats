// ---------- Rede de segurança anti-alucinação numérica ----------
// O prompt instrui a IA a nunca escrever preço/frete/desconto inventado, mas
// prompt não é garantia — LLM é probabilístico. Esta é a última linha de
// defesa: qualquer valor monetário na resposta que não apareça literalmente
// no conteúdo injetado (catálogo real, resultados das ferramentas, dados
// admin) é tratado como possível alucinação e a resposta é descartada.
const MONEY_TOKEN = /(R\$|¥|€|US\$|\$)\s?[\d][\d.,]*/g;

/** Valor como aparece no texto, sem espaços e sem a pontuação da frase
 *  ("R$ 189." → "R$189"; "¥2.400," → "¥2.400"). Sem isso, toda resposta
 *  certa com valor no fim da frase ou antes de vírgula era descartada. */
function moneyKey(token) {
  return token.replace(/\s+/g, '').replace(/[.,]+$/, '');
}

export function ungroundedMoney(aiText, groundingText) {
  const found = String(aiText || '').match(MONEY_TOKEN);
  if (!found) return [];
  const normalizedGrounding = String(groundingText || '').replace(/\s+/g, '');
  return found.filter((token) => !normalizedGrounding.includes(moneyKey(token)));
}

export function containsUngroundedMoney(aiText, groundingText) {
  return ungroundedMoney(aiText, groundingText).length > 0;
}
