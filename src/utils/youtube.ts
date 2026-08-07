// Extração de ID e embed de link do YouTube — usado no vlog (admin e página
// pública) e agora também no vídeo de review de produto (upload de arquivo OU
// link colado). Cada lugar tinha sua própria cópia deste mesmo regex; a partir
// de um 4º consumidor (o link colado na avaliação) virou cópia demais — um
// lugar só garante que os quatro aceitam exatamente os mesmos formatos de link.

/** Extrai o ID de 11 caracteres de um link do YouTube (watch/embed/shorts/youtu.be); aceita também o próprio ID solto. */
export function getYouTubeId(url: string): string {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return '';
}

/** URL embutível (iframe) a partir de um link do YouTube; `null` se o link não for reconhecido. */
export function getYouTubeEmbed(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
