// 그리기 — 길 찾기 판 · 붓 판(canvas 2D). 상태는 world.js, 움직이는 중간 모습(view)은 play.js 가 준다.
import { HEROES } from './world.js';

const IMG = {};
export function img(path) {
  if (!IMG[path]) { const i = new Image(); i.src = '../assets/' + path; IMG[path] = i; }
  return IMG[path];
}
export const heroImg = hero => img('monsters/' + HEROES[hero].img + '.png');
const ready = i => i && i.complete && i.naturalWidth;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// 칸 판의 자리 — 판이 화면에 꽉 차게(칸 최대 76px)
export function mazeLayout(world, W, H) {
  const { w, h } = world.map, C = Math.max(16, Math.min(76, Math.floor(Math.min((W - 20) / w, (H - 20) / h))));
  return { C, ox: Math.round((W - C * w) / 2), oy: Math.round((H - C * h) / 2) };
}

// view = { x, y, dir(4분의 1 바퀴 단위 · 소수 가능), hop 0~1, bump {dx,dy,p} , sparkle {x,y,p} }
export function drawMaze(g, W, H, world, view) {
  const { C, ox, oy } = mazeLayout(world, W, H), m = world.map, st = world.st;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#183021'; g.fillRect(0, 0, W, H);
  const visited = new Set(st.trail.map(([x, y]) => x + ',' + y));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.grid[y][x] || ' ', px = ox + x * C, py = oy + y * C, shade = (x * 7 + y * 13) % 3;
    g.fillStyle = ['#2f6b3a', '#2c6537', '#33723f'][shade]; g.fillRect(px, py, C, C);
    if (c === '#') {   // 나무
      g.fillStyle = '#1d4a28'; g.beginPath(); g.arc(px + C / 2, py + C * .55, C * .36, 0, 7); g.fill();
      g.fillStyle = '#2b6b3a'; g.beginPath(); g.arc(px + C * .44, py + C * .46, C * .24, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(px + C * .38, py + C * .38, C * .1, 0, 7); g.fill();
    } else if (c === '~') {   // 웅덩이
      g.fillStyle = '#3f86c2'; g.beginPath(); g.ellipse(px + C / 2, py + C / 2, C * .42, C * .32, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(1, C * .04);
      g.beginPath(); g.ellipse(px + C * .45, py + C * .45, C * .18, C * .08, 0, 0, Math.PI); g.stroke();
    } else if ('.SGa'.includes(c)) {   // 길
      g.fillStyle = '#c9ab6d'; rr(g, px + 1, py + 1, C - 2, C - 2, C * .18); g.fill();
      g.fillStyle = '#dcc28a'; rr(g, px + C * .1, py + C * .1, C * .8, C * .8, C * .14); g.fill();
      if (visited.has(x + ',' + y) && c !== 'G') { g.fillStyle = 'rgba(120,80,30,.25)'; g.beginPath(); g.arc(px + C / 2, py + C / 2, C * .07, 0, 7); g.fill(); }
      if (c === 'S') { g.strokeStyle = 'rgba(120,80,30,.45)'; g.lineWidth = Math.max(1.5, C * .05); g.beginPath(); g.arc(px + C / 2, py + C / 2, C * .3, 0, 7); g.stroke(); }
      if (c === 'a' && st.acorns.has(x + ',' + y)) {   // 도토리(아직 안 주운 것만)
        const ax = px + C / 2, ay = py + C * .56;
        g.fillStyle = '#9a5f2a'; g.beginPath(); g.ellipse(ax, ay, C * .16, C * .2, 0, 0, 7); g.fill();
        g.fillStyle = '#5c3a17'; g.beginPath(); g.ellipse(ax, ay - C * .14, C * .19, C * .1, 0, 0, 7); g.fill();
        g.fillRect(ax - 1, ay - C * .3, 2, C * .08);
      }
      if (c === 'G') { const hi = img('deco/yard_house.svg'); if (ready(hi)) g.drawImage(hi, px - C * .05, py - C * .12, C * 1.1, C * 1.1); else { g.fillStyle = '#e5484d'; g.fillRect(px + C * .2, py + C * .2, C * .6, C * .6); } }
    }
  }
  // 몬스터
  const hero = HEROES[world.def.hero], hx = ox + (view.x + .5) * C, hy = oy + (view.y + .5) * C - Math.sin(Math.PI * (view.hop || 0)) * C * .7;
  let bx = 0, by = 0;
  if (view.bump) { const k = Math.sin(Math.PI * view.bump.p) * C * .3; bx = view.bump.dx * k; by = view.bump.dy * k; }
  if (view.sparkle) {
    const p = view.sparkle.p; g.globalAlpha = 1 - p; g.fillStyle = '#ffd866'; g.font = `900 ${Math.round(C * .34)}px "Noto Sans KR",sans-serif`; g.textAlign = 'center';
    g.fillText('+1 🌰', hx, hy - C * (.55 + p * .4)); g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(hx + bx, oy + (view.y + .5) * C + C * .3, C * .28, C * .09, 0, 0, 7); g.fill();
  const hi = heroImg(world.def.hero), s = C * .88;
  if (ready(hi)) g.drawImage(hi, hx - s / 2 + bx, hy - s / 2 + by - C * .04, s, s);
  else { g.fillStyle = '#f2a93b'; g.beginPath(); g.arc(hx + bx, hy + by, C * .3, 0, 7); g.fill(); }
  if (hero.mode === 'rel') {   // 바라보는 쪽 화살표 — '왼쪽 · 오른쪽 돌기'는 이 화살표 기준
    const a = (view.dir || 0) * Math.PI / 2, r = C * .5, ax = hx + bx + Math.sin(a) * r, ay = oy + (view.y + .5) * C + by - Math.cos(a) * r;
    g.save(); g.translate(ax, ay); g.rotate(a);
    g.fillStyle = '#ffc766'; g.strokeStyle = '#3a2a10'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -C * .16); g.lineTo(C * .14, C * .06); g.lineTo(-C * .14, C * .06); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

// 붓 판 — 400×400 을 화면에 맞춰. target = 안내선(점선) · view = { x, y, h, partial:{x1,y1,x2,y2,c,p}, hideLast }
export function penLayout(W, H) { const side = Math.max(120, Math.min(W, H) - 16); return { side, k: side / 400, ox: Math.round((W - side) / 2), oy: Math.round((H - side) / 2) }; }
export function drawPen(g, W, H, world, target, view) {
  const { side, k, ox, oy } = penLayout(W, H), st = world.st;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#16120e'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f7f1e3'; rr(g, ox, oy, side, side, 14); g.fill();
  g.fillStyle = '#e0d3b4';
  for (let x = 20; x < 400; x += 20) for (let y = 20; y < 400; y += 20) g.fillRect(ox + x * k - 1, oy + y * k - 1, 2, 2);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.setLineDash([8 * k + 2, 7 * k + 2]); g.strokeStyle = '#a8977d'; g.lineWidth = Math.max(2, 3 * k);
  for (const s of target) { g.beginPath(); g.moveTo(ox + s.x1 * k, oy + s.y1 * k); g.lineTo(ox + s.x2 * k, oy + s.y2 * k); g.stroke(); }
  g.setLineDash([]);
  const segs = view.hideLast ? st.segs.slice(0, -1) : st.segs;
  g.lineWidth = Math.max(3, 5 * k);
  for (const s of segs) { g.strokeStyle = s.c; g.beginPath(); g.moveTo(ox + s.x1 * k, oy + s.y1 * k); g.lineTo(ox + s.x2 * k, oy + s.y2 * k); g.stroke(); }
  if (view.partial) { const p = view.partial; g.strokeStyle = p.c; g.beginPath(); g.moveTo(ox + p.x1 * k, oy + p.y1 * k); g.lineTo(ox + (p.x1 + (p.x2 - p.x1) * p.p) * k, oy + (p.y1 + (p.y2 - p.y1) * p.p) * k); g.stroke(); }
  // 참새 + 바라보는 쪽
  const px = ox + view.x * k, py = oy + view.y * k, a = (view.h || 0) * Math.PI / 180, sz = Math.max(30, 46 * k);
  g.save(); g.translate(px, py); g.rotate(a);
  g.fillStyle = '#ffc766'; g.strokeStyle = '#3a2a10'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -sz * .62); g.lineTo(sz * .16, -sz * .38); g.lineTo(-sz * .16, -sz * .38); g.closePath(); g.fill(); g.stroke();
  g.restore();
  const hi = heroImg('sparrow');
  if (ready(hi)) g.drawImage(hi, px - sz / 2, py - sz / 2, sz, sz);
  g.fillStyle = st.down ? (view.partial ? view.partial.c : st.color) : 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill();
}
