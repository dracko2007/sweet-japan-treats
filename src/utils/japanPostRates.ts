export type JapanPostZone = 3 | 5;
export type KozutsumiType = 'air' | 'sal';

// e-Raito (国際eパケットライト) ≤2kg — rates in ¥ per 100g bracket
// Zone 3 = Europe, Zone 5 = Brazil/South America
const E_LIGHT: Record<JapanPostZone, number[]> = {
  3: [880,1060,1240,1420,1600,1780,1960,2140,2320,2500,2680,2860,3040,3220,3400,3580,3760,3940,4120,4300],
  5: [920,1180,1440,1700,1960,2220,2480,2740,3000,3260,3520,3780,4040,4300,4560,4820,5080,5340,5600,5860],
};

// EMS (Express Mail Service) — rates in ¥ per 500g bracket (index 0 = ≤500g, index 59 = ≤30000g)
// Zone 3 = Europe, Zone 5 = Brazil/South America (Japan Post official rates 2024)
const EMS: Record<JapanPostZone, number[]> = {
  5: [
    3100,4700,5500,6300,7000,7800,8500,9300,10000,10800,
    11500,12200,12950,13700,14400,15100,15800,16500,17250,18000,
    18690,19380,20070,20760,21450,22140,22830,23520,24210,24900,
    25590,26280,26970,27660,28350,29040,29730,30420,31110,31800,
    32490,33180,33870,34560,35250,35940,36630,37320,38010,38700,
    39390,40080,40770,41460,42150,42840,43530,44220,44910,45600,
  ],
  3: [
    2700,4000,4700,5300,6000,6600,7300,7900,8600,9200,
    9850,10500,11150,11800,12400,13000,13650,14300,14950,15600,
    16230,16860,17490,18120,18750,19380,20010,20640,21270,21900,
    22530,23160,23790,24420,25050,25680,26310,26940,27570,28200,
    28830,29460,30090,30720,31350,31980,32610,33240,33870,34500,
    35130,35760,36390,37020,37650,38280,38910,39540,40170,40800,
  ],
};

// Kozutsumi (国際小包) 1–30kg — rates in ¥ per 1kg bracket
const KOZUTSUMI: Record<JapanPostZone, Record<KozutsumiType, number[]>> = {
  5: {
    air: [4550,7250,9950,12650,15350,18050,20750,23450,26150,28850,30650,32450,34250,36050,37850,39650,41450,43250,45050,46850,48650,50450,52250,54050,55850,57650,59450,61250,63050,64850],
    sal: [2700,3400,4100,4800,5500,6200,6900,7600,8300,9000,9600,10200,10800,11400,12000,12600,13200,13800,14400,15000,15600,16200,16800,17400,18000,18600,19200,19800,20400,21000],
  },
  3: {
    air: [3850,6000,8150,10300,12450,14600,16750,18900,21050,23200,24800,26400,28000,29600,31200,32800,34400,36000,37600,39200,40800,42400,44000,45600,47200,48800,50400,52000,53600,55200],
    sal: [2500,3100,3700,4300,4900,5500,6100,6700,7300,7900,8300,8700,9100,9500,9900,10300,10700,11100,11500,11900,12300,12700,13100,13500,13900,14300,14700,15100,15500,15900],
  },
};

export const MAX_WEIGHT_G = 30000; // 30kg — Japan Post hard limit
export const MAX_DIM_SUM_CM = 150; // 1500mm = 150cm — Japan Post hard limit (H+W+D)

/** Rate in ¥ for e-Raito (≤2000g). Returns null if out of range. */
export const getELightRate = (weightG: number, zone: JapanPostZone): number | null => {
  if (weightG <= 0 || weightG > 2000) return null;
  const idx = Math.ceil(weightG / 100) - 1;
  return E_LIGHT[zone][idx] ?? null;
};

/** Rate in ¥ for EMS (up to 30kg). Returns null if out of range. */
export const getEmsRate = (weightG: number, zone: JapanPostZone): number | null => {
  if (weightG <= 0 || weightG > MAX_WEIGHT_G) return null;
  const idx = Math.ceil(weightG / 500) - 1;
  return EMS[zone][Math.min(idx, 59)] ?? null;
};

/** Rate in ¥ for Kozutsumi Air or SAL (1–30kg). Returns null if out of range. */
export const getKozutsumiRate = (weightG: number, zone: JapanPostZone, type: KozutsumiType): number | null => {
  if (weightG <= 0 || weightG > MAX_WEIGHT_G) return null;
  const idx = Math.ceil(weightG / 1000) - 1;
  return KOZUTSUMI[zone][type][idx] ?? null;
};
