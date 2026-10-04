// 색 점 세기 — 그림의 한 곳에서 낱 점을 색 이름(빨강 · 주황 · 노랑 · 초록 · 파랑 · 보라 · 하양)으로 나눠 센다(DOM 없음) · 아래 edgeWidth = 경계 재기
//  회색 · 아주 어두운 점은 '흐린 점'으로 따로. 갈래 기준은 HLS 색상각(사람이 부르는 색 이름에 가깝게 나눈 것)
export const COLOR_NAMES = [['red', '빨강', '#d8312b'], ['orange', '주황', '#f08a24'], ['yellow', '노랑', '#f4d23c'], ['green', '초록', '#3fa34d'], ['blue', '파랑', '#2f6fd0'], ['purple', '보라', '#8e4fb8'], ['white', '하양', '#f4f1ea']];
export const PRESENT = 3;   // 이만큼(%) 넘게 있으면 '있는 색'

function hls(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, l, 0];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, l, s];
}
export function colorOf(r, g, b) {
  const [h, l, s] = hls(r, g, b);
  if (l > 0.86 || (l > 0.8 && s < 0.5)) return 'white';   // 아주 밝으면 살짝 물든 점도 하양(HLS 채도는 흰빛 근처에서 부풀어 오른다)
  if (s < 0.15 || l < 0.1) return 'gray';
  return h < 15 || h >= 340 ? 'red' : h < 42 ? 'orange' : h < 70 ? 'yellow' : h < 165 ? 'green' : h < 255 ? 'blue' : 'purple';
}
// 낱 점들 → { blue: 42.6, white: 11.6, … gray: … } (%)
export function colorShare(pixels) {
  const n = pixels.length || 1, cnt = {};
  for (const [r, g, b] of pixels) { const k = colorOf(r, g, b); cnt[k] = (cnt[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, Math.round(1000 * v / n) / 10]));
}
// 아이가 고른 색과 잰 색 견주기
export function judgeColors(picks, share) {
  const present = COLOR_NAMES.map(c => c[0]).filter(k => (share[k] || 0) >= PRESENT);
  const hit = picks.filter(k => present.includes(k)), extra = picks.filter(k => !present.includes(k)), missed = present.filter(k => !picks.includes(k));
  return { present, hit, extra, missed, ok: hit.length >= 2 };
}

// 경계 재기 — 줄을 따라 잰 밝기(L*)에서 '밝기가 바뀌는 길이'(그림 점). 3칸 이동 평균 → 처음 · 끝 12% 평균을 양쪽 평지로 →
//  평지 사이 바뀜의 10% 지점에서 90% 지점까지 거리. 짧으면 또렷한 경계(마른 종이) · 길면 부드러운 경계(번지기). DOM 없음
export function edgeWidth(vals, step) {
  const n = vals.length, q = vals.map((_, i) => (vals[Math.max(0, i - 1)] + vals[i] + vals[Math.min(n - 1, i + 1)]) / 3);
  const k = Math.max(2, Math.floor(n * 0.12)), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const p0 = avg(q.slice(0, k)), p1 = avg(q.slice(n - k));
  if (Math.abs(p1 - p0) < 1e-6) return { w: 0, from: p0, to: p1 };
  const v = q.map(x => (x - p0) / (p1 - p0)), i10 = v.findIndex(x => x >= 0.1);
  const i90 = i10 < 0 ? -1 : v.findIndex((x, i) => i >= i10 && x >= 0.9);
  return { w: i10 < 0 || i90 < 0 ? 0 : (i90 - i10) * step, from: p0, to: p1 };
}
