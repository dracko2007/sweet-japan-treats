/**
 * Converte texto japonês para romaji usando a API kuroshiro
 * Para uso offline, mantém o texto original se a API falhar
 */

import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

let kuroshiroInstance: Kuroshiro | null = null;
let kuroshiroInitialized = false;

// Inicializa o Kuroshiro uma vez
async function initKuroshiro() {
  if (kuroshiroInitialized) return kuroshiroInstance;
  
  try {
    const kuroshiro = new Kuroshiro();
    await kuroshiro.init(new KuromojiAnalyzer());
    kuroshiroInstance = kuroshiro;
    kuroshiroInitialized = true;
    console.log('✅ Kuroshiro initialized');
    return kuroshiro;
  } catch (error) {
    console.warn('⚠️ Failed to initialize Kuroshiro:', error);
    kuroshiroInitialized = true; // Mark as initialized to avoid retrying
    return null;
  }
}

// Inicializa automaticamente quando o módulo é importado
initKuroshiro();

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
export const romanizeJapanese = async (text: string): Promise<string> => {
  if (!text) return '';
  
  // Se já contém parênteses com romaji, retorna como está
  if (text.includes('(') && text.includes(')')) {
    return text;
  }
  
  try {
    const kuroshiro = await initKuroshiro();
    if (!kuroshiro) {
      return text; // Fallback to original text
    }
    
    // Converte para romaji com capitalize
    const romaji = await kuroshiro.convert(text, {
      to: 'romaji',
      mode: 'spaced',
      romajiSystem: 'hepburn'
    });
    
    // Capitaliza primeira letra de cada palavra
    const capitalizedRomaji = romaji
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return `${text} (${capitalizedRomaji})`;
  } catch (error) {
    console.warn('Failed to romanize:', text, error);
    return text; // Fallback to original text
  }
};

/**
 * Adiciona dicas de leitura para partes comuns de endereço
 * Agora usa romanização automática para qualquer texto
 */
export const addAddressHints = async (text: string): Promise<string> => {
  if (!text) return '';
  
  try {
    // Tenta romanização automática completa primeiro
    return await romanizeJapanese(text);
  } catch (error) {
    console.warn('Fallback to manual mapping for:', text);
    // Se falhar, usa mapeamento manual
    return addAddressHintsSync(text);
  }
};

/**
 * Versão síncrona com mapeamento manual (fallback)
 */
export const addAddressHintsSync = (text: string): string => {
  if (!text) return '';
  
  // Common city/area name mappings
  const nameMap: { [key: string]: string } = {
    // Cities
    '伊賀市': 'Iga-shi',
    '名古屋市': 'Nagoya-shi',
    '大阪市': 'Osaka-shi',
    '東京都': 'Tokyo-to',
    '京都市': 'Kyoto-shi',
    '神戸市': 'Kobe-shi',
    '横浜市': 'Yokohama-shi',
    '札幌市': 'Sapporo-shi',
    '福岡市': 'Fukuoka-shi',
    '仙台市': 'Sendai-shi',
    // Common districts/neighborhoods
    '桐ケ丘': 'Kirigaoka',
    '桐ヶ丘': 'Kirigaoka',
    '千代田区': 'Chiyoda-ku',
    '中央区': 'Chuo-ku',
    '港区': 'Minato-ku',
    '新宿区': 'Shinjuku-ku',
    '渋谷区': 'Shibuya-ku',
    // Generic suffixes
    '市': 'shi',
    '区': 'ku',
    '町': 'cho',
    '村': 'mura',
    '郡': 'gun',
  };

  let result = text;async (city: string, town: string = ''): Promise<string> => {
  if (!city && !town) return '';
  
  const fullAddress = town ? `${city} ${town}` : city;
  
  // Adiciona hints para termos comuns
  return awaitresult.includes(japanese) && !result.includes(`(${romaji})`)) {
      result = result.replace(japanese, `${japanese} (${romaji})`);
    }
  }

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
