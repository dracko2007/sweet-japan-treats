import { Prefecture } from '@/types';

// Zones based on distance from Mie Prefecture
// Zone 1: Same region (Mie)
// Zone 2: Nearby regions
// Zone 3: Further regions
// Zone 4: Distant regions (Hokkaido, Okinawa)

export const prefectures: Prefecture[] = [
  // Chubu Region (Zone 1-2)
  { name: 'Mie', nameJa: '三重県', zone: 1 },
  { name: 'Aichi', nameJa: '愛知県', zone: 1 },
  { name: 'Gifu', nameJa: '岐阜県', zone: 1 },
  { name: 'Shizuoka', nameJa: '静岡県', zone: 2 },
  { name: 'Nagano', nameJa: '長野県', zone: 2 },
  { name: 'Niigata', nameJa: '新潟県', zone: 2 },
  { name: 'Toyama', nameJa: '富山県', zone: 2 },
  { name: 'Ishikawa', nameJa: '石川県', zone: 2 },
  { name: 'Fukui', nameJa: '福井県', zone: 2 },
  { name: 'Yamanashi', nameJa: '山梨県', zone: 2 },
  
  // Kansai Region (Zone 1-2)
  { name: 'Osaka', nameJa: '大阪府', zone: 1 },
  { name: 'Kyoto', nameJa: '京都府', zone: 1 },
  { name: 'Hyogo', nameJa: '兵庫県', zone: 1 },
  { name: 'Nara', nameJa: '奈良県', zone: 1 },
  { name: 'Shiga', nameJa: '滋賀県', zone: 1 },
  { name: 'Wakayama', nameJa: '和歌山県', zone: 2 },
  
  // Kanto Region (Zone 2-3)
  { name: 'Tokyo', nameJa: '東京都', zone: 2 },
  { name: 'Kanagawa', nameJa: '神奈川県', zone: 2 },
  { name: 'Saitama', nameJa: '埼玉県', zone: 2 },
  { name: 'Chiba', nameJa: '千葉県', zone: 2 },
  { name: 'Ibaraki', nameJa: '茨城県', zone: 2 },
  { name: 'Tochigi', nameJa: '栃木県', zone: 2 },
  { name: 'Gunma', nameJa: '群馬県', zone: 2 },
  
  // Chugoku Region (Zone 2)
  { name: 'Okayama', nameJa: '岡山県', zone: 2 },
  { name: 'Hiroshima', nameJa: '広島県', zone: 2 },
  { name: 'Yamaguchi', nameJa: '山口県', zone: 2 },
  { name: 'Tottori', nameJa: '鳥取県', zone: 2 },
  { name: 'Shimane', nameJa: '島根県', zone: 2 },
  
  // Shikoku Region (Zone 2)
  { name: 'Tokushima', nameJa: '徳島県', zone: 2 },
  { name: 'Kagawa', nameJa: '香川県', zone: 2 },
  { name: 'Ehime', nameJa: '愛媛県', zone: 2 },
  { name: 'Kochi', nameJa: '高知県', zone: 2 },
  
  // Kyushu Region (Zone 3)
  { name: 'Fukuoka', nameJa: '福岡県', zone: 3 },
  { name: 'Saga', nameJa: '佐賀県', zone: 3 },
  { name: 'Nagasaki', nameJa: '長崎県', zone: 3 },
  { name: 'Kumamoto', nameJa: '熊本県', zone: 3 },
  { name: 'Oita', nameJa: '大分県', zone: 3 },
  { name: 'Miyazaki', nameJa: '宮崎県', zone: 3 },
  { name: 'Kagoshima', nameJa: '鹿児島県', zone: 3 },
  
  // Tohoku Region (Zone 3)
  { name: 'Miyagi', nameJa: '宮城県', zone: 3 },
  { name: 'Fukushima', nameJa: '福島県', zone: 3 },
  { name: 'Yamagata', nameJa: '山形県', zone: 3 },
  { name: 'Iwate', nameJa: '岩手県', zone: 3 },
  { name: 'Akita', nameJa: '秋田県', zone: 3 },
  { name: 'Aomori', nameJa: '青森県', zone: 3 },
  
  // Distant (Zone 4)
  { name: 'Hokkaido', nameJa: '北海道', zone: 4 },
  { name: 'Okinawa', nameJa: '沖縄県', zone: 4 },
];

// Shipping rates by carrier, box size, and zone (in yen)
// CORRECTED: 1 large pot = 2 small pots in space
// Box 60cm: fits 2 large pots (or 4 small pots)
// Box 80cm: fits 3 large pots (or 6 small pots)
// Box 100cm: fits 6 large pots (or 12 small pots)

export const shippingRates = {
  yuubin: {
    '60': { 1: 870, 2: 970, 3: 1100, 4: 1350 },
    '80': { 1: 1100, 2: 1200, 3: 1400, 4: 1700 },
    '100': { 1: 1300, 2: 1450, 3: 1650, 4: 2000 }
  },
  yamato: {
    '60': { 1: 930, 2: 1040, 3: 1150, 4: 1480 },
    '80': { 1: 1150, 2: 1260, 3: 1370, 4: 1810 },
    '100': { 1: 1380, 2: 1520, 3: 1720, 4: 2180 }
  },
  sagawa: {
    '60': { 1: 880, 2: 990, 3: 1100, 4: 1430 },
    '80': { 1: 1100, 2: 1210, 3: 1430, 4: 1760 },
    '100': { 1: 1320, 2: 1470, 3: 1680, 4: 2100 }
  }
};

export type CarrierName = keyof typeof shippingRates;
export type BoxSize = '60' | '80' | '100';

export const carrierInfo = {
  yuubin: { 
    name: 'Japan Post (ゆうパック)', 
    logo: '📮',
    website: 'https://www.post.japanpost.jp/service/you_pack/',
    deliveryTimes: ['9:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  },
  yamato: { 
    name: 'Yamato (クロネコ)', 
    logo: '🐱',
    website: 'https://www.kuronekoyamato.co.jp/ytc/customer/send/',
    deliveryTimes: ['Antes das 12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  },
  sagawa: { 
    name: 'Sagawa (佐川急便)', 
    logo: '📦',
    website: 'https://www.sagawa-exp.co.jp/service/timetable/',
    deliveryTimes: ['Manhã (9:00-12:00)', 'Tarde (12:00-18:00)', 'Noite (18:00-21:00)']
  }
};
