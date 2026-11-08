// ゆうパック (Yu-Pack) — tabela oficial de 基本運賃 saindo de 広島.
// Fonte: https://www.post.japanpost.jp/service/domestic/charge/list/yu-pack/34.html
// Conferida em 2026-11-08. Valores com imposto, sem desconto de 持込.
//
// Mora em `shared/` para o site e o servidor cobrarem o mesmo número.

const REGION_RATES = {
  hiroshima: { 60: 840, 80: 1150 },
  oeste: { 60: 970, 80: 1320 },       // Chugoku, Shikoku, Kinki (Kansai), Kyushu
  hokurikuTokai: { 60: 1090, 80: 1440 },
  kantoShinetsu: { 60: 1270, 80: 1580 },
  tohoku: { 60: 1550, 80: 1880 },
  hokkaido: { 60: 1910, 80: 2240 },
  okinawa: { 60: 1470, 80: 1860 },
};

const REGION_BY_PREFECTURE = {
  Hiroshima: 'hiroshima',
  ...Object.fromEntries([
    'Okayama', 'Yamaguchi', 'Tottori', 'Shimane',
    'Ehime', 'Kagawa', 'Tokushima', 'Kochi',
    'Hyogo', 'Osaka', 'Kyoto', 'Nara', 'Shiga', 'Wakayama',
    'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima',
  ].map((name) => [name, 'oeste'])),
  ...Object.fromEntries(['Toyama', 'Ishikawa', 'Fukui', 'Aichi', 'Gifu', 'Shizuoka', 'Mie'].map((name) => [name, 'hokurikuTokai'])),
  ...Object.fromEntries([
    'Tokyo', 'Kanagawa', 'Saitama', 'Chiba', 'Ibaraki', 'Tochigi', 'Gunma', 'Yamanashi', 'Nagano', 'Niigata',
  ].map((name) => [name, 'kantoShinetsu'])),
  ...Object.fromEntries(['Miyagi', 'Fukushima', 'Yamagata', 'Iwate', 'Akita', 'Aomori'].map((name) => [name, 'tohoku'])),
  Hokkaido: 'hokkaido',
  Okinawa: 'okinawa',
};

/** Preço em ¥ de uma caixa Yu-Pack (60 ou 80) de Hiroshima até a província. null se desconhecida. */
export function yupackRateYen(prefecture, size) {
  const region = REGION_BY_PREFECTURE[prefecture];
  if (!region) return null;
  return REGION_RATES[region][Number(size) === 80 ? 80 : 60];
}

export const YUPACK_PREFECTURES = Object.keys(REGION_BY_PREFECTURE);
