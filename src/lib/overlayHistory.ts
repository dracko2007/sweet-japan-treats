// Telas cheias (ex.: foto ampliada) que usam o "voltar" do celular para fechar.
// Enquanto uma está aberta, ou logo depois de fechar, o voltar é dela: o popup
// de saída (ExitIntentPopup) não deve tratar esse voltar como "cliente saindo".

let abertos = 0;
let fechadoEm = 0;
const FOLGA_MS = 400;

export const overlayHistory = {
  open(): void {
    abertos += 1;
  },
  close(): void {
    abertos = Math.max(0, abertos - 1);
    fechadoEm = Date.now();
  },
  /** true quando o popstate atual pertence a uma tela cheia. */
  owns(): boolean {
    return abertos > 0 || Date.now() - fechadoEm < FOLGA_MS;
  },
};
