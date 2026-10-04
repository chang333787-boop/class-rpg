// 조형 요소 돋보기 — 그림을 긴 변 480점으로 줄여 칸(긴 변 24칸)으로 나누고, 칸마다 잰다. DOM 없음(시험 = scripts/unit/art/cases.test.mjs)
//  선: 방향 · 뚜렷함(구조 텐서 — 밝기가 바뀌는 방향의 직각이 선 방향) · 곡선(이웃 칸끼리 선 방향이 조금씩 바뀌는가)
//  색: 따뜻함 · 차가움 · 선명함(CIELAB 색상각 · 채도) · 밝기(L*) · 질감: 거칠기(밝기의 잔떨림) · 양감: 명암이 차츰 바뀌는가(평면 맞춤 r² · 날카로운 경계는 빼고)
//  [4미02-03] 해설 원문 "조형 요소에는 선, 형과 형태, 색, 질감, 양감 등이 있다." — 형(모양)은 무늬 공방 · 데생 기초가 맡고 여기서는 재지 않는다.
export const LONG = 480, GRID = 24, INSET = 0.025;

// 카드 열둘 — 갈래(fam) 넷 · feel = '흔히 이런 느낌을 준다고 해요'(교과서 선 · 색의 느낌 활동)
export const FAMS = [['line', '선'], ['color', '색'], ['light', '명암 · 양감'], ['tex', '질감']];
export const ELEMENTS = [
  { k: 'horiz', fam: 'line', name: '가로선', icon: '─', desc: '옆으로 누운 선이에요. 수평선 · 바닥 · 먼 땅에 많아요.', feel: ['calm', 'wide'] },
  { k: 'vert', fam: 'line', name: '세로선', icon: '│', desc: '위아래로 선 선이에요. 나무 · 기둥 · 서 있는 것에 많아요.', feel: ['tall', 'hard'] },
  { k: 'diag', fam: 'line', name: '사선', icon: '╱', desc: '비스듬히 기운 선이에요. 움직이거나 기울어지는 것에 많아요.', feel: ['move', 'tense'] },
  { k: 'curve', fam: 'line', name: '곡선', icon: '∿', desc: '방향이 조금씩 바뀌며 휘는 선이에요. 물결 · 둥근 몸 · 구름에 많아요.', feel: ['soft', 'move'] },
  { k: 'warm', fam: 'color', name: '따뜻한 색', icon: '🔥', desc: '빨강 · 주황 · 노랑 쪽 색이에요. 해 · 불 · 흙의 색이에요.', feel: ['warm', 'bright'] },
  { k: 'cool', fam: 'color', name: '차가운 색', icon: '💧', desc: '청록 · 파랑 쪽 색이에요. 물 · 하늘 · 그늘의 색이에요.', feel: ['cold', 'calm'] },
  { k: 'vivid', fam: 'color', name: '선명한 색', icon: '🌈', desc: '흐리지 않고 또렷한 색이에요. 회색이 적게 섞였어요.', feel: ['bright', 'move'] },
  { k: 'bright', fam: 'light', name: '밝은 곳', icon: '☀', desc: '그림에서 가장 환한 곳이에요. 빛을 받거나 종이를 남긴 곳이에요.', feel: ['light', 'bright'] },
  { k: 'dark', fam: 'light', name: '어두운 곳', icon: '●', desc: '그림에서 가장 어두운 곳이에요. 그늘 · 밤 · 진한 먹이에요.', feel: ['heavy', 'tense'] },
  { k: 'shade', fam: 'light', name: '양감(도톰한 명암)', icon: '◐', desc: '밝음에서 어둠으로 차츰 바뀌어 둥글고 도톰해 보이는 곳이에요.', feel: ['soft', 'heavy'] },
  { k: 'rough', fam: 'tex', name: '거친 질감', icon: '▒', desc: '자잘한 붓 자국 · 점 · 털처럼 까슬까슬해 보이는 곳이에요.', feel: ['hard', 'move'] },
  { k: 'smooth', fam: 'tex', name: '매끄러운 질감', icon: '▭', desc: '자국 없이 고르게 칠해져 매끈해 보이는 곳이에요.', feel: ['calm', 'soft'] },
];
export const elementOf = k => ELEMENTS.find(e => e.k === k);
export const EFEELS = [['calm', '차분한'], ['wide', '넓은'], ['tall', '높고 곧은'], ['hard', '단단한'], ['move', '움직이는'], ['tense', '긴장되는'], ['soft', '부드러운'], ['warm', '따뜻한'], ['cold', '차가운'], ['bright', '밝은'], ['light', '가벼운'], ['heavy', '무거운']];

// ── 잴 때 쓰는 셈 ──
const LIN = new Float32Array(256).map((_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
const fLab = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
function pct(arr, q) { const a = Float32Array.from(arr).sort(); return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))] : 0; }

// rgba(Uint8ClampedArray · 줄인 그림) → 칸마다 잰 값. 가장자리 INSET 은 빼고(액자 · 스캔 테두리) 잰다
export function measure(rgba, W, H) {
  const x0 = Math.round(W * INSET), y0 = Math.round(H * INSET), w = W - 2 * x0, h = H - 2 * y0, n = w * h;
  const L = new Float32Array(n), C = new Float32Array(n), warm = new Float32Array(n), cool = new Float32Array(n), viv = new Float32Array(n), mr = new Float32Array(n), mg = new Float32Array(n), mb = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = ((y + y0) * W + x + x0) * 4, r = LIN[rgba[o]], g = LIN[rgba[o + 1]], b = LIN[rgba[o + 2]], i = y * w + x;
    const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const fx = fLab(X), fy = fLab(Y), fz = fLab(Z), l = 116 * fy - 16, A = 500 * (fx - fy), B = 200 * (fy - fz), c = Math.hypot(A, B), hue = (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
    L[i] = l; C[i] = c; mr[i] = rgba[o]; mg[i] = rgba[o + 1]; mb[i] = rgba[o + 2];
    //  빨강 ~ 노랑 · 청록 ~ 파랑 — 채도가 낮은 누런 옛 종이(C 20 안팎) · 잿빛은 '따뜻한 · 차가운 색'으로 안 친다
    warm[i] = (hue >= 330 || hue < 105) && l < 90 ? Math.max(0, Math.min(1, (c - 16) / 24)) : 0;
    cool[i] = hue >= 180 && hue < 300 ? Math.max(0, Math.min(1, (c - 6) / 20)) : 0;
    viv[i] = Math.max(0, Math.min(1, (c - 36) / 18));   // 선명함 — 채도가 높은 점만(누런 비단 · 갈색 잉크 C 20~35 는 아님)
  }
  //  흐림(σ 1) → 소벨 기울기(밝기가 바뀌는 방향) · 거칠기 = 밝기와 3×3 평균의 차이
  const K = [0.054, 0.244, 0.403, 0.244, 0.054], T = new Float32Array(n), S = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * L[y * w + Math.min(w - 1, Math.max(0, x + k))]; T[y * w + x] = s; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * T[Math.min(h - 1, Math.max(0, y + k)) * w + x]; S[y * w + x] = s; }
  const at = (a, x, y) => a[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const GX = new Float32Array(n), GY = new Float32Array(n), RO = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    GX[i] = (at(S, x + 1, y - 1) + 2 * at(S, x + 1, y) + at(S, x + 1, y + 1) - at(S, x - 1, y - 1) - 2 * at(S, x - 1, y) - at(S, x - 1, y + 1)) / 8;
    GY[i] = (at(S, x - 1, y + 1) + 2 * at(S, x, y + 1) + at(S, x + 1, y + 1) - at(S, x - 1, y - 1) - 2 * at(S, x, y - 1) - at(S, x + 1, y - 1)) / 8;
    let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m += at(L, x + dx, y + dy);
    RO[i] = Math.abs(L[i] - m / 9);
  }
  //  칸 — 긴 변 GRID 칸 · 칸마다 합(평면 맞춤 · 큰 칸 묶음에 쓰려고 합으로 둔다)
  const cs = Math.max(w, h) / GRID, nx = Math.max(1, Math.round(w / cs)), ny = Math.max(1, Math.round(h / cs));
  const xb = Array.from({ length: nx + 1 }, (_, i) => Math.round(i * w / nx)), yb = Array.from({ length: ny + 1 }, (_, j) => Math.round(j * h / ny));
  const cells = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = { i, j, n: 0, sL: 0, sL2: 0, sx: 0, sy: 0, sx2: 0, sy2: 0, sxL: 0, syL: 0, warm: 0, cool: 0, viv: 0, C: 0, rough: 0, jxx: 0, jyy: 0, jxy: 0, sharp: 0, r: 0, g: 0, b: 0, Ls: [] };
    for (let y = yb[j]; y < yb[j + 1]; y++) for (let x = xb[i]; x < xb[i + 1]; x++) {
      const k = y * w + x, l = L[k], gx = GX[k], gy = GY[k];
      c.n++; c.sL += l; c.sL2 += l * l; c.sx += x; c.sy += y; c.sx2 += x * x; c.sy2 += y * y; c.sxL += x * l; c.syL += y * l;
      c.warm += warm[k]; c.cool += cool[k]; c.viv += viv[k]; c.C += C[k]; c.rough += RO[k]; c.jxx += gx * gx; c.jyy += gy * gy; c.jxy += gx * gy;
      if (gx * gx + gy * gy > 36) c.sharp++;   // 한 점에 밝기 6 넘게 바뀜 = 날카로운 경계
      c.r += mr[k]; c.g += mg[k]; c.b += mb[k]; c.Ls.push(l);
    }
    const N = c.n || 1, jxx = c.jxx / N, jyy = c.jyy / N, jxy = c.jxy / N, tr = jxx + jyy;
    c.L = c.sL / N; c.warmM = c.warm / N; c.coolM = c.cool / N; c.vivM = c.viv / N; c.CM = c.C / N; c.roughM = c.rough / N; c.E = tr;
    c.coh = tr > 1e-6 ? Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / tr : 0;
    c.ang = ((0.5 * Math.atan2(2 * jxy, jxx - jyy) * 180 / Math.PI) + 90 + 180) % 180;   // 선 방향(0 = 가로 · 90 = 세로)
    c.range = pct(c.Ls, 0.9) - pct(c.Ls, 0.1); delete c.Ls;
    c.rgb = [c.r / N, c.g / N, c.b / N].map(Math.round);
    cells.push(c);
  }
  //  그림 안에서 견주기(그림마다 다른 밝기 · 붓 자국 세기)
  const Es = cells.map(c => c.E), Ls = cells.map(c => c.L), Rs = cells.map(c => c.roughM);
  const stats = { E95: pct(Es, 0.95) || 1, L25: pct(Ls, 0.25), L75: pct(Ls, 0.75), R25: pct(Rs, 0.25), R75: pct(Rs, 0.75) };
  const F = { W, H, x0, y0, w, h, nx, ny, xb, yb, cells, stats };
  for (const c of cells) c.en = Math.min(1, Math.sqrt(c.E / stats.E95));
  for (const c of cells) { c.curve = curveOf(F, c); c.shade = shadeOf(F, c); }
  for (const c of cells) c.labels = labelsOf(F, c);
  return F;
}
const cellAt = (F, i, j) => (i >= 0 && j >= 0 && i < F.nx && j < F.ny ? F.cells[j * F.nx + i] : null);
//  곡선 — 선을 따라 앞 칸 · 뒤 칸으로 가며 선 방향이 같은 쪽으로 조금씩(8~55°) 돌아가는가.
//   곧은 선 = 돌지 않음 · 모서리 = 한쪽만 확 꺾임 · 자잘한 결 = 뚜렷하지 않음 → 셋 다 곡선이 아니다
const turn = (a, b) => { let d = a - b; while (d > 90) d -= 180; while (d <= -90) d += 180; return d; };
const lineCell = q => q && q.en >= 0.3 && q.coh >= 0.4;
function curveOf(F, c) {
  if (!lineCell(c)) return 0;
  const r = c.ang * Math.PI / 180, dx = Math.round(Math.cos(r)), dy = Math.round(Math.sin(r));
  const A = cellAt(F, c.i + dx, c.j + dy), B = cellAt(F, c.i - dx, c.j - dy);
  if (!lineCell(A) || !lineCell(B)) return 0;
  const t1 = turn(A.ang, c.ang), t2 = turn(c.ang, B.ang);
  if (Math.sign(t1) !== Math.sign(t2) || !t1) return 0;
  const m = Math.min(Math.abs(t1), Math.abs(t2)), M = Math.max(Math.abs(t1), Math.abs(t2));
  if (M > 55) return 0;
  return Math.max(0, Math.min(1, (m - 5) / 10)) * Math.min(1, (c.coh + A.coh + B.coh) / 3 / 0.55);
}
//  양감 — 오른쪽 · 아래 이웃까지 2×2 칸을 한 평면으로 맞춰 r²(명암이 한쪽으로 차츰) · 밝기 퍼짐 · 날카로운 경계가 적어야
function shadeOf(F, c) {
  const qs = [c, cellAt(F, c.i + 1, c.j), cellAt(F, c.i, c.j + 1), cellAt(F, c.i + 1, c.j + 1)].filter(Boolean);
  let n = 0, sL = 0, sL2 = 0, sx = 0, sy = 0, sx2 = 0, sy2 = 0, sxL = 0, syL = 0, sharp = 0;
  for (const q of qs) { n += q.n; sL += q.sL; sL2 += q.sL2; sx += q.sx; sy += q.sy; sx2 += q.sx2; sy2 += q.sy2; sxL += q.sxL; syL += q.syL; sharp += q.sharp; }
  if (n < 16) return 0;
  const mL = sL / n, mx = sx / n, my = sy / n, vx = sx2 / n - mx * mx, vy = sy2 / n - my * my, cxL = sxL / n - mx * mL, cyL = syL / n - my * mL, vL = sL2 / n - mL * mL;
  if (vL < 1 || vx < 1 || vy < 1) return 0;
  const r2 = Math.min(1, (cxL * cxL / vx + cyL * cyL / vy) / vL), sd = Math.sqrt(vL), sf = sharp / n;
  return Math.max(0, Math.min(1, (r2 - 0.45) / 0.35)) * Math.max(0, Math.min(1, (sd - 3) / 5)) * Math.max(0, Math.min(1, 1 - (sf - 0.03) / 0.1));
}
//  칸의 이름표 — { k: 세기 0~1 } 가운데 0.5 넘는 것(그림 안 견줌 + 정한 문턱)
export function labelsOf(F, c) {
  const s = {}, S = F.stats, line = c.en >= 0.35 && c.coh >= 0.45 ? Math.min(1, (c.en - 0.2) / 0.5) * Math.min(1, (c.coh - 0.3) / 0.4) : 0;
  const a = c.ang, dH = Math.min(a, 180 - a), dV = Math.abs(a - 90), dD = Math.min(Math.abs(a - 45), Math.abs(a - 135));
  if (line) { s.horiz = line * Math.max(0, 1 - Math.max(0, dH - 12) / 10); s.vert = line * Math.max(0, 1 - Math.max(0, dV - 12) / 10); s.diag = line * Math.max(0, 1 - Math.max(0, dD - 15) / 10); }
  s.curve = c.curve;
  s.warm = Math.max(0, Math.min(1, (c.warmM - 0.2) / 0.3)); s.cool = Math.max(0, Math.min(1, (c.coolM - 0.2) / 0.3)); s.vivid = Math.max(0, Math.min(1, (c.vivM - 0.15) / 0.35));
  s.bright = c.L >= 70 && c.L >= S.L75 ? Math.min(1, (c.L - 62) / 16) : 0;
  s.dark = c.L <= 38 && c.L <= S.L25 ? Math.min(1, (46 - c.L) / 16) : 0;
  s.shade = c.shade;
  s.rough = c.roughM >= Math.max(1.6, S.R75) ? Math.min(1, (c.roughM - 1.0) / 2.0) : 0;
  s.smooth = c.roughM <= Math.min(1.0, S.R25) && c.en < 0.3 ? Math.min(1, (1.4 - c.roughM) / 0.8) : 0;
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v >= 0.5).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}
// 짚은 자리(그림 %) → 칸
const slot = (bounds, v) => { let i = 0; while (i < bounds.length - 2 && v >= bounds[i + 1]) i++; return i; };
export function cellAtPct(F, xp, yp) { return cellAt(F, slot(F.xb, xp / 100 * F.W - F.x0), slot(F.yb, yp / 100 * F.H - F.y0)); }
// 칸 → 그림 % 네모
export function cellRect(F, c) { return [(c.i === 0 ? 0 : F.xb[c.i] + F.x0) / F.W * 100, (c.j === 0 ? 0 : F.yb[c.j] + F.y0) / F.H * 100, (F.xb[c.i + 1] + F.x0) / F.W * 100, (F.yb[c.j + 1] + F.y0) / F.H * 100].map(v => Math.round(v * 10) / 10); }
// 찾기 — 짚은 칸과 바로 둘레(한 칸) 가운데 찾는 요소가 가장 센 칸
export function findAt(F, xp, yp, want) {
  const c0 = cellAtPct(F, xp, yp); let best = null;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const q = cellAt(F, c0.i + di, c0.j + dj); if (!q || !q.labels[want]) continue;
    const s = q.labels[want] - (di || dj ? 0.15 : 0); if (!best || s > best.s) best = { c: q, s };
  }
  return { ok: !!best, cell: best ? best.c : c0, tapped: c0 };
}
// 그 요소가 있는 칸 수 · 가장 센 칸들(힌트)
export const countOf = (F, k) => F.cells.filter(c => c.labels[k]).length;
//  힌트 — 세기 + 둘레 칸에도 같은 요소가 있을수록(한 칸짜리보다 무리 진 곳이 눈에 잘 띈다)
const crowd = (F, c, k) => { let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = (di || dj) && cellAt(F, c.i + di, c.j + dj); if (q && q.labels[k]) n++; } return n; };
export const bestOf = (F, k, n = 3) => F.cells.filter(c => c.labels[k]).map(c => [c, c.labels[k] + 0.12 * crowd(F, c, k)]).sort((a, z) => z[1] - a[1]).slice(0, n).map(x => x[0]);
// 짚은 칸의 이름표 · 가장 센 것부터
export const topLabels = (c, n = 4) => Object.entries(c.labels).sort((a, z) => z[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));
