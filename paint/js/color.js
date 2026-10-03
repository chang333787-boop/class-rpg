// 물감 섞기 — 빨강 · 노랑 · 파랑(RYB 큐브 — Gosset & Chen 2004 '물감처럼 섞이는 색': 파랑 + 노랑 = 초록) + 흰색(밝게) · 검정(어둡게). DOM 없음.
//  [PAINT-1] 아이 물감 상자 · 미술 수업과 같은 빨노파. (빛의 섞기 RGB 를 그대로 쓰면 파랑 + 노랑이 회색이 된다 — 물감과 다르다)
//  색 견주기 = CIE Lab 거리(ΔE) — 사람 눈에 가까운 셈. 가까움 % · 별 · '무엇이 다른가(밝기 · 색깔 · 선명함)'를 같은 셈으로.

// RYB 큐브 여덟 모서리(빨 · 노 · 파 0~1) → 화면 색(RGB 0~1)
//  뼈대 = Gosset & Chen(2004). 모서리 색만 화면 형광색(#ff0000 · #ffff00)에서 학교 물감 쪽으로 낮췄다(사람이 본 물감 색 · 섞는 규칙은 그대로)
const CUBE = {
  '000': [1, 1, 1], '100': [0.894, 0.161, 0.149], '010': [0.996, 0.851, 0.141], '001': [0.122, 0.353, 0.702],
  '110': [0.98, 0.5, 0.1], '101': [0.47, 0.13, 0.5], '011': [0.1, 0.6, 0.25], '111': [0.2, 0.094, 0],
};
const lerp = (a, b, t) => a + (b - a) * t;
export function rybToRgb(r, y, b) {
  const c = k => CUBE[k];
  return [0, 1, 2].map(i => {
    const x00 = lerp(c('000')[i], c('100')[i], r), x10 = lerp(c('010')[i], c('110')[i], r);
    const x01 = lerp(c('001')[i], c('101')[i], r), x11 = lerp(c('011')[i], c('111')[i], r);
    return lerp(lerp(x00, x10, y), lerp(x01, x11, y), b);
  });
}

export const TUBES = [{ k: 'R', name: '빨강' }, { k: 'Y', name: '노랑' }, { k: 'B', name: '파랑' }, { k: 'W', name: '흰색' }, { k: 'K', name: '검정' }];
export const TUBE_NAME = Object.fromEntries(TUBES.map(t => [t.k, t.name]));
export const MAX_DROPS = 9;          // 물감 하나에 아홉 방울까지
const K_POWER = 2;                    // 검정은 힘이 세다 — 한 방울이 다른 물감 두 방울만큼 어둡게

// 방울 수 { R, Y, B, W, K } → 화면 색 [r, g, b](0~1) · 빈 팔레트면 null
//  색 물감끼리는 비율로(가장 많은 것을 1로) RYB 큐브 · 그다음 흰색 · 검정을 무게대로 섞는다
export function mix(d) {
  const R = d.R || 0, Y = d.Y || 0, B = d.B || 0, W = d.W || 0, K = (d.K || 0) * K_POWER, ch = R + Y + B;
  if (!ch && !W && !K) return null;
  const m = Math.max(R, Y, B) || 1, base = ch ? rybToRgb(R / m, Y / m, B / m) : [1, 1, 1];
  const T = ch + W + K, tc = ch / T, tw = W / T;
  return base.map(v => Math.max(0, Math.min(1, v * tc + tw)));   // 검정 몫은 0(어둠)
}
export const hex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

// sRGB → Lab(D65)
function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
export function lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
//  가까움 % — ΔE 10(통과) = 80% · 멀리 있어도 0%로 뚝 떨어지지 않게(빨강에서 분홍으로 가는 아이도 '가는 중'이 보이게)
export const closeness = d => Math.max(0, Math.min(100, Math.round(100 * Math.exp(-d / 44.81))));
export const PASS_DE = 10;            // 이만큼 가까우면 '거의 같아요'(가까움 80% 이상)
export const starsOf = d => (d <= 3 ? 3 : d <= 6 ? 2 : d <= PASS_DE ? 1 : 0);

// 무엇이 다른가 — 색의 세 가지(밝기 · 색깔 · 선명함) 가운데 가장 많이 다른 것 하나를 아이 말로
//  밝기 = L · 선명함 = 채도(C) · 색깔 = 색상각(h) 차이를 '같은 크기'로 맞춰 견준다. 무엇을 넣을지는 judge.js nextStep 이 따로(그 판에 있는 물감만)
export function diffOf(mine, target) {
  const p = lab(mine), q = lab(target);
  const C = l => Math.hypot(l[1], l[2]), H = l => (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360;
  const dL = q[0] - p[0], dC = C(q) - C(p);
  let dh = H(q) - H(p); if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const hueW = Math.min(C(p), C(q)) < 8 ? 0 : Math.abs(dh) * Math.min(C(p), C(q)) / 40;   // 둘 중 하나가 거의 회색이면 색깔은 못 견준다
  const parts = [['light', Math.abs(dL)], ['chroma', Math.abs(dC) * 0.8], ['hue', hueW]].sort((a, z) => z[1] - a[1]);
  const [kind] = parts[0];
  if (kind === 'light') return { kind, say: dL > 0 ? '목표가 더 밝아요' : '목표가 더 어두워요' };
  //  흐려진 쪽이 '흰빛'이면(파스텔) 탁하다고 하지 않는다 — 분홍은 빨강보다 '밝고 연한' 색
  if (kind === 'chroma' && dC < 0 && dL > 8) return { kind: 'light', say: '목표가 더 밝고 연해요' };
  if (kind === 'chroma' && dC < 0 && dL < -8) return { kind, say: '목표가 더 어둡고 탁해요' };
  if (kind === 'chroma') return { kind, say: dC > 0 ? '목표가 더 선명해요' : '목표가 더 탁해요' };
  return { kind, say: `색깔이 달라요 — 목표는 더 ${HUE_WORD(H(q))} 쪽이에요` };
}
const HUE_WORD = h => (h < 40 || h >= 345 ? '붉은' : h < 75 ? '주황빛' : h < 110 ? '노란' : h < 165 ? '초록빛' : h < 295 ? '푸른' : '보랏빛');
// 색상환 열두 칸(RYB) — 마주 보는 칸이 보색(빨강 ↔ 초록 · 노랑 ↔ 보라 · 파랑 ↔ 주황)
export const WHEEL = [
  ['빨강', { R: 1 }], ['다홍', { R: 2, Y: 1 }], ['주황', { R: 1, Y: 1 }], ['귤색', { R: 1, Y: 2 }], ['노랑', { Y: 1 }], ['연두', { Y: 2, B: 1 }],
  ['초록', { Y: 1, B: 1 }], ['청록', { Y: 1, B: 2 }], ['파랑', { B: 1 }], ['남보라', { R: 1, B: 2 }], ['보라', { R: 1, B: 1 }], ['자주', { R: 2, B: 1 }],
];
export const complementOf = i => (i + 6) % 12;

// 통 색 = 그 물감 한 가지만 짠 색(통과 팔레트가 같은 색으로 보이게 · 검정은 화면에서 아주 짙은 밤색)
for (const t of TUBES) t.css = t.k === 'K' ? '#211c19' : hex(mix({ [t.k]: 1 }));

export const KEYS = ['R', 'Y', 'B', 'W', 'K'];
export const dropsOf = d => KEYS.reduce((a, k) => a + (d[k] || 0), 0);
// '빨강 2 · 노랑 1'
export const recipeText = d => KEYS.filter(k => d[k]).map(k => `${TUBE_NAME[k]} ${d[k]}`).join(' · ');
export const hexToRgb = s => [1, 3, 5].map(i => parseInt(String(s).slice(i, i + 2), 16) / 255);

// 색의 세 가지(아이 말) — 밝기 L · 선명함 C · 색깔 h(색 바퀴 열두 칸 가운데 가장 가까운 칸)
const LCH = rgb => { const l = lab(rgb); return { L: l[0], C: Math.hypot(l[1], l[2]), h: (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360 }; };
export const lchOf = LCH;
const WHEEL_H = () => WHEEL.map(([, d]) => LCH(mix(d)).h);
let _wh = null;
export function nearestWheel(rgb) {
  _wh = _wh || WHEEL_H();
  const h = LCH(rgb).h; let best = 0, bd = 999;
  _wh.forEach((x, i) => { let d = Math.abs(x - h); d = Math.min(d, 360 - d); if (d < bd) { bd = d; best = i; } });
  return best;
}
// 따뜻한 · 차가운 · 그 사이(중성) · 회색빛 — 교과서 갈래(빨강 · 주황 · 노랑 쪽 = 따뜻 · 청록 · 파랑 · 남보라 = 차가움 · 연두 · 초록 · 보라 · 자주 = 중성)
export const WARMTH = { 0: 'warm', 1: 'warm', 2: 'warm', 3: 'warm', 4: 'warm', 5: 'mid', 6: 'mid', 7: 'cool', 8: 'cool', 9: 'cool', 10: 'mid', 11: 'mid' };
export function readColor(rgb) {
  const { L, C } = LCH(rgb), gray = C < 8;
  const i = gray ? -1 : nearestWheel(rgb);
  //  흐린 색은 '연한 파랑' · '주황빛 회색'처럼(바퀴 이름 그대로면 바위가 '귤색'이 된다)
  //  어두운 색은 원래 덜 선명하다 — 흐림 기준을 낮춘다 · 밝고 붉은 흐린 색 = 분홍
  const dull = C < (L < 40 ? 12 : 20), pink = L >= 72 && C < 45 && [0, 1, 11].includes(i), brown = L < 45 && [1, 2, 3].includes(i);
  const name = gray ? (L > 88 ? '흰빛' : L < 18 ? '검정빛' : '회색빛') : pink ? '분홍' : brown ? '갈색' : !dull ? WHEEL[i][0] : L >= 72 ? '연한 ' + WHEEL[i][0] : HUE_WORD(LCH(rgb).h) + ' 회색';
  return {
    name, wheel: i,
    light: L >= 72 ? '밝은' : L <= 38 ? '어두운' : '중간 밝기',
    vivid: gray ? '' : C >= 55 ? '선명한' : L >= 72 ? '연한' : C >= 25 ? '조금 탁한' : '탁한',   // 밝고 흐린 색은 '탁한'보다 '연한'(파스텔)
    warm: gray ? 'none' : WARMTH[i], L, C,
  };
}
