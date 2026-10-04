// 먹 + 물 → 농담(진하기). DOM 없음 · 시험 = scripts/unit/ink/stages.test.mjs
//  물리: 비어-람베르트 법칙 — 빛이 먹 알갱이 층을 지나며 줄어든다. 농도 c = 먹 ÷ (먹 + 물), 광학 밀도 D = DMAX × c,
//        종이에서 돌아오는 빛 = 한지 빛 × 10^(−D). 먹 1 : 물 1 → 1 : 3 → 1 : 7 처럼 먹물을 반씩 묽게 하면 D 가 반씩 준다
//        (눈 밝기 L* 로는 진한 쪽 한 단계가 크고 옅은 쪽이 작다 — 7.5 → 34 → 58 → 73).
export const PAPER = [0.937, 0.910, 0.847];   // 한지(살짝 누런 흰빛 · L* 약 92)
const TINT = [1.0, 1.0, 0.94];                 // 먹의 결 — 파랑을 아주 조금 덜 먹는다(진한 먹이 살짝 푸르스름한 검정 · 옅으면 한지 빛을 따라 따뜻한 회색)
export const DMAX = 2.0;                       // 먹만 칠했을 때의 밀도(진한 먹 · L* 약 7)
export const MAX_DROPS = 9;

const lin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const enc = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const PL = PAPER.map(lin);
// 먹 · 물 방울 → 화면 색 [r,g,b](0~1) · 물만이면 종이 · 둘 다 없으면 null
export function inkRgb(ink, water) {
  ink = ink || 0; water = water || 0;
  if (!ink && !water) return null;
  const c = ink / (ink + water), D = DMAX * c;
  return PL.map((p, i) => Math.max(0, Math.min(1, enc(p * Math.pow(10, -D * TINT[i])))));
}
export const hex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
export function lstar(rgb) {
  const Y = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
}
export const lightOf = (ink, water) => { const c = inkRgb(ink, water); return c ? lstar(c) : null; };

// 먹색 다섯 — 물을 두 배씩(교과서 '먹색 만들기' · '농담 꼬리 잇기')
export const TONES = [
  { k: 't1', name: '진한 먹', ink: 1, water: 0 },
  { k: 't2', name: '조금 진한 먹', ink: 1, water: 1 },
  { k: 't3', name: '중간 먹', ink: 1, water: 3 },
  { k: 't4', name: '옅은 먹', ink: 1, water: 7 },
  { k: 'paper', name: '종이(먹 없음)', ink: 0, water: 1 },
];
// 밝기 차이 → 가까움 % (밝기만 견주는 셈 · ΔL* 6 = 통과 = 80%)
export const PASS_DL = 6;
export const closeness = d => Math.max(0, Math.min(100, Math.round(100 * Math.exp(-d / 26.9))));
export const starsOf = d => (d <= 2 ? 3 : d <= 4 ? 2 : d <= PASS_DL ? 1 : 0);
