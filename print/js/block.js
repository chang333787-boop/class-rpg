// 판 — N×N 칸(0 = 남은 면 · 1 = 파낸 곳). 모양 만들기 · 뒤집기 · 넓히기/좁히기 · 파기. DOM 없음(시험 = scripts/unit/print/stages.test.mjs)
//  볼록판화: 남은 면(0)에만 롤러 잉크가 묻고, 파낸 곳(1)은 종이색으로 남는다. 종이에는 좌우가 바뀌어 찍힌다(mirror).
export const N = 96;
export const blank = () => new Uint8Array(N * N);
export const clone = m => new Uint8Array(m);
export const count = m => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };
export const mirror = m => { const o = blank(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o[y * N + x] = m[y * N + (N - 1 - x)]; return o; };
export const flipV = m => { const o = blank(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o[y * N + x] = m[(N - 1 - y) * N + x]; return o; };
export const invert = m => m.map(v => 1 - v);
export const and = (a, b) => a.map((v, i) => v & b[i]);
export const or = (a, b) => a.map((v, i) => v | b[i]);
export const minus = (a, b) => a.map((v, i) => v & (1 - b[i]));

// 모양 — 칸 가운데(x+0.5, y+0.5)가 안에 들면 1. 모양 함수는 칸 좌표(0~N)
export function shape(fn) { const m = blank(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fn(x + 0.5, y + 0.5)) m[y * N + x] = 1; return m; }
export const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
export const ellipse = (cx, cy, rx, ry, rot = 0) => (x, y) => { const c = Math.cos(-rot), s = Math.sin(-rot), dx = x - cx, dy = y - cy, u = dx * c - dy * s, v = dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; };
export const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
export function polygon(pts) {
  return (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
}
export const star = (cx, cy, R, r, n = 5, rot = -Math.PI / 2) => polygon(Array.from({ length: n * 2 }, (_, i) => { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }));
// 물결 띠 — 가운데 높이 y0 · 진폭 amp · 굵기 w 인 사인 띠
export const wave = (y0, amp, len, w, ph = 0) => (x, y) => Math.abs(y - (y0 + amp * Math.sin(x / len * Math.PI * 2 + ph))) <= w / 2;
export const any = (...fs) => (x, y) => fs.some(f => f(x, y));
export const not = f => (x, y) => !f(x, y);
export const both = (a, b) => (x, y) => a(x, y) && b(x, y);

// 넓히기(원 모양 r칸) · 좁히기 · 테두리 띠(바깥 r · 안 r)
export function dilate(m, r) {
  const o = blank(), R = Math.ceil(r), off = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r) off.push([dx, dy]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!m[y * N + x]) continue;
    for (const [dx, dy] of off) { const X = x + dx, Y = y + dy; if (X >= 0 && X < N && Y >= 0 && Y < N) o[Y * N + X] = 1; }
  }
  return o;
}
export const erode = (m, r) => invert(dilate(invert(m), r));
export const band = (m, r) => minus(dilate(m, r), erode(m, r));

// 파기 — 칸 좌표 (cx, cy) 둘레 반지름 r 안을 파낸다. 새로 판 칸 수를 돌려준다
export function carve(m, cx, cy, r) {
  let n = 0;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(N - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(N - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * N + x;
    if (!m[i] && (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) { m[i] = 1; n++; }
  }
  return n;
}
// 두 점 사이를 촘촘히 파기(끌기)
export function carveLine(m, a, b, r) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(d / Math.max(0.5, r * 0.5)));
  let n = 0;
  for (let k = 1; k <= steps; k++) { const t = k / steps; n += carve(m, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r); }
  return n;
}
// 두 판이 얼마나 닮았나(겹침 ÷ 합침) — 판 고르기 그림 시험
export function iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += a[k] & b[k]; u += a[k] | b[k]; } return u ? i / u : 1; }
