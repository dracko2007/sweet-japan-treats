// Atualização do app (PWA) no estilo loja de apps: a versão nova é baixada em
// segundo plano e aplicada no próximo toque que troca de página.
//
// Por que não recarregar na hora: no PWA do iPhone, um reload fora de um toque
// do usuário é o gatilho do bug do WebKit que deixa a tela em branco. Trocando
// de página o cliente acabou de tocar num link, e a recarga entra nesse gesto.

let pronta = false;
const ouvintes = new Set<() => void>();

/** O service worker novo assumiu: há versão nova esperando para entrar. */
export function marcarAtualizacaoPronta(): void {
  pronta = true;
  ouvintes.forEach((avisar) => avisar());
}

/** Para a tela mostrar o aviso "nova versão" assim que ela chega. */
export function aoFicarPronta(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => { ouvintes.delete(avisar); };
}

export function atualizacaoPronta(): boolean {
  return pronta;
}

// Telas com formulário ou pagamento em andamento: recarregar ali faria o
// cliente perder o que digitou. A atualização espera a próxima troca de página.
const TELAS_PROTEGIDAS = ['/checkout', '/order-review', '/order-confirmation', '/login', '/cadastro'];

const protegida = (path: string): boolean => TELAS_PROTEGIDAS.some((p) => path === p || path.startsWith(`${p}/`));

/** Pode aplicar a versão nova ao ir de `de` para `para`? */
export function podeAplicarAoNavegar(de: string, para: string): boolean {
  if (de === para) return false;
  return !protegida(de) && !protegida(para);
}
