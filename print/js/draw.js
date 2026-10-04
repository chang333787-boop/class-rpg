// 판 · 종이 그리기 — 칸 판(block.js)을 나무판(파낸 곳은 낮고 어둡게 · 빛은 왼쪽 위에서)과 찍힌 종이(좌우가 바뀌고 · 잉크 결 · 종이 결)로.
//  칸 사이는 부드럽게(겹선형 보간 + 흐림 3칸) · 크기마다 나무 · 종이 결을 한 번만 만들어 둔다
import { N, mirror as mirrorM, flipV, invert } from './block.js';

const seeded = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// 칸 값(0~1) → 3×3 흐림 → 겹선형으로 읽기
function soft(mask) { const o = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && X < N && Y >= 0 && Y < N) { s += mask[Y * N + X]; k++; } } o[y * N + x] = s / k; } return o; }
function bil(a, u, v) {
  u = Math.max(0, Math.min(N - 1.001, u)); v = Math.max(0, Math.min(N - 1.001, v));
  const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, i = y * N + x;
  return (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + N] * (1 - fx) + a[i + N + 1] * fx) * fy;
}
// 값 소음(두 겹) — 나무 결 · 잉크 결 · 종이 결에 쓰는 0~1
const noiseCache = new Map();
function noise(S, seed, cell) {
  const key = `${S}|${seed}|${cell}`; if (noiseCache.has(key)) return noiseCache.get(key);
  const r = seeded(seed), G = Math.ceil(S / cell) + 2, g = new Float32Array(G * G).map(() => r()), o = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / cell, v = y / cell, X = Math.floor(u), Y = Math.floor(v), fx = smooth(0, 1, u - X), fy = smooth(0, 1, v - Y), i = Y * G + X; o[y * S + x] = (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + G] * (1 - fx) + g[i + G + 1] * fx) * fy; }
  noiseCache.set(key, o); return o;
}
// 나무판 결(가로로 흐르는 나뭇결 · 옹이 없이 잔잔하게)
const woodCache = new Map();
function wood(S) {
  if (woodCache.has(S)) return woodCache.get(S);
  const n1 = noise(S, 7, S / 3), n2 = noise(S, 11, 3), o = new Float32Array(S * S * 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, grain = 0.5 + 0.5 * Math.sin((y / S * 34 + n1[i] * 9) * Math.PI), f = 0.9 + 0.07 * grain + 0.06 * (n2[i] - 0.5);
    o[i * 3] = 214 * f; o[i * 3 + 1] = 176 * f; o[i * 3 + 2] = 128 * f;
  }
  woodCache.set(S, o); return o;
}
// 종이(살짝 누런 판화지 · 섬유 결)
const paperCache = new Map();
function paper(S) {
  if (paperCache.has(S)) return paperCache.get(S);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), r = seeded(5);
  g.fillStyle = '#f4efe3'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < S * S / 700; i++) { const x = r() * S, y = r() * S, a = r() * 6.28, l = 5 + r() * 18; g.strokeStyle = r() < 0.55 ? 'rgba(255,255,255,.5)' : 'rgba(120,95,60,.08)'; g.lineWidth = 0.5 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const d = g.getImageData(0, 0, S, S).data;
  paperCache.set(S, d); return d;
}
function fitCanvas(cv, S) { const dpr = 1; if (cv.width !== S * dpr) { cv.width = cv.height = S * dpr; } cv.style.width = cv.style.height = S + 'px'; return cv.getContext('2d'); }

// 판 그리기 — ink(칸마다 0~1 · 없으면 안 바른 판) · guides(연한 밑그림 칸 판 목록)
export function drawBlock(cv, mask, { size = 400, ink = null, inkColor = '#1d1c21', guides = [] } = {}) {
  const S = size, g = fitCanvas(cv, S), img = g.createImageData(S, S), d = img.data, W = wood(S), n3 = noise(S, 19, 2);
  const a = soft(mask), k = N / S, ic = hexRgb(inkColor), gl = guides.map(m => soft(m)), inkS = ink;
  for (let py = 0; py < S; py++) {
    const v = (py + 0.5) * k - 0.5;
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) * k - 0.5, i = py * S + px;
      const h = 1 - smooth(0.32, 0.68, bil(a, u, v));
      const lit = (1 - smooth(0.32, 0.68, bil(a, u + 0.7, v + 0.7))) - (1 - smooth(0.32, 0.68, bil(a, u - 0.7, v - 0.7)));
      const floor = 0.56 + 0.1 * (n3[i] - 0.5), f = (floor + (1 - floor) * h) * (1 + 0.42 * lit);
      let r = W[i * 3] * f, gg = W[i * 3 + 1] * f, b = W[i * 3 + 2] * f;
      for (const G of gl) { const e = bil(G, u, v), t = smooth(0.15, 0.5, e) * (1 - smooth(0.5, 0.85, e)) * 0.55; r += (90 - r) * t; gg += (84 - gg) * t; b += (80 - b) * t; }
      if (inkS) {
        const ia = h * Math.min(1, bil(inkS, u, v)) * 0.94;
        if (ia > 0) { const sh = 0.9 + 0.35 * Math.max(0, lit) + 0.12 * (n3[i] - 0.5); r += (ic[0] * sh - r) * ia; gg += (ic[1] * sh - gg) * ia; b += (ic[2] * sh - b) * ia; }
      }
      d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// 찍힌 종이 — 판을 엎어 찍었으니 좌우가 바뀐다(mirror). ink · rub = 칸마다 0~1(없으면 고르게 다 묻음)
//  variant(예상 판 보기용): 'mirror'(바른 찍힘) · 'same'(뒤집지 않음) · 'flip'(위아래) · 'invert'(색 반전)
export function drawPrint(cv, mask, { size = 400, inkColor = '#1d1c21', ink = null, rub = null, variant = 'mirror', ghost = false } = {}) {
  const S = size, g = fitCanvas(cv, S), P = paper(S), img = g.createImageData(S, S), d = img.data;
  let m = variant === 'same' ? mask : variant === 'flip' ? flipV(mask) : variant === 'invert' ? invert(mask) : mirrorM(mask);
  const mir = variant === 'mirror' || variant === 'invert' && false;
  const a = soft(m), k = N / S, ic = hexRgb(inkColor), n1 = noise(S, 23, 3), n2 = noise(S, 29, 1.4);
  const mirIdx = (u, v, arr) => bil(arr, variant === 'mirror' ? N - 1 - u : u, v);
  for (let py = 0; py < S; py++) {
    const v = (py + 0.5) * k - 0.5;
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) * k - 0.5, i = py * S + px;
      let al = 1 - smooth(0.36, 0.64, bil(a, u, v));
      if (ink) al *= Math.min(1, mirIdx(u, v, ink) / 0.6);
      if (rub) al *= Math.min(1, mirIdx(u, v, rub) / 0.6);
      if (al > 0) { al *= 0.86 + 0.3 * (n1[i] - 0.5); if (n2[i] < 0.06) al *= 0.4; al = Math.max(0, Math.min(1, al)); if (ghost) al *= 0.28; }
      const pr = P[i * 4], pg = P[i * 4 + 1], pb = P[i * 4 + 2];
      d[i * 4] = pr + (pr * ic[0] / 255 - pr) * al; d[i * 4 + 1] = pg + (pg * ic[1] / 255 - pg) * al; d[i * 4 + 2] = pb + (pb * ic[2] / 255 - pb) * al; d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  void mir;
}

// 글자 판(볼록 글자 — 글자만 남기고 둘레를 팜) · variant 'same'(바른 글자) · 'mirror'(거울 글씨) · 'flip'(위아래)
export function textBlock(text, variant = 'same') {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(N * 0.74)}px "Noto Sans KR", sans-serif`;
  g.fillText(text, N / 2, N / 2 + N * 0.04);
  const px = g.getImageData(0, 0, N, N).data, glyph = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) glyph[i] = px[i * 4 + 3] > 127 ? 1 : 0;
  const blk = invert(glyph);   // 글자 = 남은 면 · 둘레 = 파낸 곳
  return variant === 'mirror' ? mirrorM(blk) : variant === 'flip' ? flipV(blk) : blk;
}
