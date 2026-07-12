// Isenção da Taxa de Personal Shopper concedida pela oferta de saída (exit-intent).
// Regra (ponto 2 do checkout): "finalize agora e não pague a taxa".
//
// Persistência intencional em sessionStorage + TTL curto:
//  - sessionStorage some ao fechar a aba  → se o cliente sair e voltar OUTRA HORA,
//    a taxa volta a ser cobrada.
//  - TTL de 60min cobre o caso de deixar a aba aberta e voltar muito depois.
// Só vira desconto real se o pedido for finalizado dentro dessa janela.
const KEY = 'ps_fee_waiver_until';
const TTL_MINUTES = 60;

// Evento disparado quando a isenção muda, para páginas já montadas (ex.: /checkout)
// reagirem sem precisar remontar.
export const PS_FEE_WAIVER_EVENT = 'psfee-waiver-changed';
const emitChange = (): void => {
  try { window.dispatchEvent(new Event(PS_FEE_WAIVER_EVENT)); } catch { /* SSR/no window */ }
};

export const psFeeWaiver = {
  /** Concede a isenção (chamado quando o cliente aceita a oferta no popup). */
  grant(): void {
    try {
      sessionStorage.setItem(KEY, String(Date.now() + TTL_MINUTES * 60_000));
      emitChange();
    } catch {
      /* storage indisponível — sem isenção, cobra a taxa normalmente */
    }
  },

  /** Isenção válida agora? Expira sozinha e limpa a chave vencida. */
  isActive(): boolean {
    try {
      const until = Number(sessionStorage.getItem(KEY) || 0);
      if (!until) return false;
      if (Date.now() > until) {
        sessionStorage.removeItem(KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /** Consome/limpa a isenção (ex.: após o pedido ser finalizado). */
  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
      emitChange();
    } catch {
      /* noop */
    }
  },
};
