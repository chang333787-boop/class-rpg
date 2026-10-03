// 그리기 — 도장(칸 그림) · 무늬 판. 움직이는 모습은 CSS 3D(뒤집기 = 종이를 뒤집듯 · 돌리기 = 빙그르)로 — 결과가 정확히 그 움직임의 그림이다.
import { PALETTE, MOTIFS, MOVE_KEYS, apply, canon } from './tiles.js';

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// 세모 도장은 칸 계단 대신 진짜 세모로 — 칸 그림(채점용)과 같은 모양 · 같은 대칭(왼쪽 위 → 오른쪽 아래 대각선으로 나눔)
const VEC = {
  half: (g, s) => { g.fillStyle = PALETTE[1]; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s); g.lineTo(s, s); g.closePath(); g.fill(); },
  tri: (g, s) => {
    g.fillStyle = PALETTE[5]; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s); g.lineTo(s, s); g.closePath(); g.fill();
    g.fillStyle = PALETTE[2]; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, 0); g.lineTo(s, s); g.closePath(); g.fill();
  },
};
const VEC_OF = new Map();   // 칸 그림 → [세모 그리기, 움직임] — 움직인 칸 그림도 같은 움직임으로 그린다
for (const k of Object.keys(VEC)) for (const m of MOVE_KEYS) { const key = apply(MOTIFS[k].g, m).join('|'); if (!VEC_OF.has(key)) VEC_OF.set(key, [VEC[k], m]); }
function withMove(g, m, x, y, s, fn) {
  g.save(); g.translate(x + s / 2, y + s / 2);
  const c = canon(m);
  if (c === 'fh') g.scale(-1, 1); else if (c === 'fv') g.scale(1, -1); else if (c === 'r90') g.rotate(Math.PI / 2); else if (c === 'r180') g.rotate(Math.PI); else if (c === 'r270') g.rotate(-Math.PI / 2);
  g.translate(-s / 2, -s / 2); fn(g, s); g.restore();
}

// 칸 그림 하나 — 종이 바탕 · 옅은 칸 줄 · 색칸은 살짝 둥글게(solid = 무늬 판: 칸을 꽉 채워 이음매 없이)
export function drawGrid(g, grid, x, y, size, { paper = '#f7f1e3', lines = true, solid = false } = {}) {
  const n = grid.length, c = size / n;
  g.fillStyle = paper; g.fillRect(x, y, size, size);
  const v = VEC_OF.get(grid.join('|'));
  if (v) { withMove(g, v[1], x, y, size, v[0]); return; }
  if (lines) {
    g.strokeStyle = 'rgba(120,90,50,.13)'; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < n; i++) { g.moveTo(x + i * c, y); g.lineTo(x + i * c, y + size); g.moveTo(x, y + i * c); g.lineTo(x + size, y + i * c); }
    g.stroke();
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const col = PALETTE[grid[j][i]]; if (!col) continue;
    g.fillStyle = col;
    if (solid) { g.fillRect(x + i * c - .25, y + j * c - .25, c + .5, c + .5); continue; }
    rr(g, x + i * c + c * .05, y + j * c + c * .05, c * .9, c * .9, c * .16); g.fill();
    if (col === '#ffffff') { g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.stroke(); }
  }
}
function hiCanvas(w, h) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1), cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [cv, g];
}
export function tileCanvas(grid, px, opts) { const [cv, g] = hiCanvas(px, px); drawGrid(g, grid, 0, 0, px, opts); cv.className = 'tile'; return cv; }

// 무늬 판 — tiles[y][x] = 칸 그림 · 칸 px · 칸 사이 gap · unit = 첫 규칙 칸 테두리(가로, 세로 칸 수)
export function wallCanvas(tiles, px, { gap = 1, unit = null } = {}) {
  const rows = tiles.length, cols = tiles[0].length, W = cols * px + (cols + 1) * gap, H = rows * px + (rows + 1) * gap;
  const [cv, g] = hiCanvas(W, H);
  g.fillStyle = '#3a2e22'; g.fillRect(0, 0, W, H);
  tiles.forEach((row, y) => row.forEach((t, x) => drawGrid(g, t, gap + x * (px + gap), gap + y * (px + gap), px, { lines: false, solid: true })));
  if (unit) { g.strokeStyle = '#ffc766'; g.lineWidth = 3; g.setLineDash([7, 5]); g.strokeRect(gap / 2 + 1, gap / 2 + 1, unit[0] * (px + gap) - 2, unit[1] * (px + gap) - 2); g.setLineDash([]); }
  cv.className = 'wall';
  return cv;
}
// 판에 들어가는 칸 크기 — 넓이 · 높이 안에서 가장 크게(최소 18px)
export const fitPx = (cols, rows, W, H, gap = 2) => Math.max(18, Math.floor(Math.min((W - (cols + 1) * gap) / cols, (H - (rows + 1) * gap) / rows)));

// 움직임을 눈으로 — 도장 요소가 그 움직임을 해 보인다(끝나면 그 모습으로 멈춤). 그대로(밀기) = 옆으로 밀었다 돌아옴
//  다른 이름(왼쪽으로 뒤집기 · 시계 방향 270°)은 가는 길이 달라 보여도 같은 모습에 멈춘다 — '설명은 달라도 결과가 같다'를 눈으로
export const CSS_MOVE = { id: 'translateX(26px)', fh: 'rotateY(180deg)', fv: 'rotateX(180deg)', r90: 'rotate(90deg)', r180: 'rotate(180deg)', r270: 'rotate(-90deg)',
  fhL: 'rotateY(-180deg)', fvU: 'rotateX(-180deg)', cw270: 'rotate(270deg)', ccw270: 'rotate(-270deg)', cw360: 'rotate(360deg)', ccw180: 'rotate(-180deg)' };
export function moveEl(el, m, ms = 850) {
  return new Promise(res => {
    const d = m === 'id' ? ms * .45 : ms;
    el.style.transition = `transform ${d}ms cubic-bezier(.45,.05,.2,1)`;
    el.style.transform = CSS_MOVE[m] || '';
    setTimeout(() => { if (m === 'id') { el.style.transform = ''; setTimeout(res, d + 40); } else res(); }, d + 40);
  });
}
export function resetEl(el) { el.style.transition = 'none'; el.style.transform = ''; void el.offsetWidth; el.style.transition = ''; }
