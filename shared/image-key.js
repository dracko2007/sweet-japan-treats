// Chave curta e estável de uma foto de produto, a partir do endereço dela.
// Usa só o servidor e o caminho do arquivo (o token `?alt=media&token=…` pode mudar).
// Compartilhado entre o site (src/utils/localImage.ts) e scripts/sync-local-catalog.mjs:
// os dois PRECISAM chegar na mesma chave, senão a cópia local não é encontrada.
export function imageKey(url) {
  let text;
  try {
    const { hostname, pathname } = new URL(url);
    text = hostname + decodeURIComponent(pathname);
  } catch {
    return '';
  }
  // cyrb53: hash de 53 bits, síncrono (o site precisa disso durante o render).
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
