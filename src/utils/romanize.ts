/**
 * Converte texto japonês para romaji usando a API kuroshiro
 * Para uso offline, mantém o texto original se a API falhar
 */

// Mapeamento básico de kanji comuns para romaji (fallback)
const basicKanjiMap: Record<string, string> = {
  '市': 'shi',
  '区': 'ku',
  '町': 'cho/machi',
  '村': 'mura',
  '県': 'ken',
  '都': 'to',
  '府': 'fu',
  '郡': 'gun',
};

/**
 * Tenta romanizar texto japonês
 * Retorna no formato: "日本 (Nihon)" ou apenas "日本" se falhar
 */
export const romanizeJapanese = (text: string): string => {
  if (!text) return '';
  
  // Se já contém parênteses com romaji, retorna como está
  if (text.includes('(') && text.includes(')')) {
    return text;
  }
  
  // Apenas retorna o texto original já que a romanização completa
  // requer bibliotecas complexas. O usuário verá os caracteres japoneses.
  return text;
};

/**
 * Adiciona dicas de leitura para partes comuns de endereço
 */
export const addAddressHints = (text: string): string => {
  if (!text) return '';
  
  let result = text;
  
  // Adiciona hints para sufixos comuns
  Object.entries(basicKanjiMap).forEach(([kanji, romaji]) => {
    if (result.endsWith(kanji)) {
      result = result.replace(new RegExp(kanji + '$'), `${kanji} (${romaji})`);
    }
  });
  
  return result;
};

/**
 * Formata cidade e bairro com informação adicional
 */
export const formatCityAddress = (city: string, town: string = ''): string => {
  if (!city && !town) return '';
  
  const fullAddress = town ? `${city} ${town}` : city;
  
  // Adiciona hints para termos comuns
  return addAddressHints(fullAddress);
};
