// [PATTERN-6] 도장 공방 — 내 도장을 칸에 색칠하고(4×4 · 5×5 · 6×6), 규칙 칸의 움직임을 정해 나만의 무늬를 만든다 → 우리 반 무늬 전시에 건다
//  도장이 어떤 움직임에 그대로인지(대칭)를 바로 알려 준다 — '좌우가 똑같으면 오른쪽으로 뒤집어도 그대로'를 그리면서 깨닫게.
//  글은 받지 않는다(제목 없음 · 이름은 RPG 이름) — 학급 전시에 낯선 글이 오르지 않게.
import { h, toast } from './util.js';
import { PALETTE, symOf, SYM_SAY, isBlank, WALL } from './tiles.js';
import { drawGrid } from './draw.js';
import { makeBuilder } from './builder.js';
import { MAX_WORKS } from './store.js';
import { HOST } from './play.js';

const COLORS = ['1', '2', '3', '4', '5', '6', '7', '9', '8'];   // 빨강 주황 노랑 초록 파랑 보라 고동 황토 흰색 (+ 지우개 '0')
const blankOf = n => Array.from({ length: n }, () => '0'.repeat(n));
const UNITS = [[1, 1, '한 칸'], [2, 1, '가로 두 칸'], [1, 2, '세로 두 칸'], [2, 2, '네 칸(2×2)']];

export function mountMake(root, ctx) {
  let n = 5, grid = blankOf(n), color = '1', painting = false, alive = true, saving = false;
  const cv = h('canvas', { class: 'paint' }), g = cv.getContext('2d');
  let side = 300;
  function drawEditor() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    cv.width = Math.round(side * dpr); cv.height = Math.round(side * dpr); cv.style.width = cv.style.height = side + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0); drawGrid(g, grid, 0, 0, side, { lines: true });
    g.strokeStyle = 'rgba(120,90,50,.45)'; g.lineWidth = 2; g.strokeRect(1, 1, side - 2, side - 2);
  }
  const symEl = h('p', { class: 'sym' });
  function showSym() {
    if (isBlank(grid)) { symEl.textContent = '칸을 눌러 색칠해요 — 눌러서 끌면 여러 칸을 한 번에 칠해요.'; return; }
    const s = symOf(grid);
    symEl.textContent = s.length ? `이 도장은 ${s.map(m => SYM_SAY[m]).join(' · ')} — 그 움직임으로는 모양이 안 바뀌어요.` : '이 도장은 어느 쪽으로 움직여도 다 달라 보여요 — 무늬 규칙이 잘 보여요.';
  }
  //  색칠 — 눌러서 끌면 지나간 칸을 모두 · 같은 색 칸을 처음 누르면 지우기로(한 번에 하나만 바뀌게)
  let mode = null;
  function cellAt(e) { const r = cv.getBoundingClientRect(), c = side / n; const x = Math.floor((e.clientX - r.left) / c), y = Math.floor((e.clientY - r.top) / c); return x >= 0 && y >= 0 && x < n && y < n ? [x, y] : null; }
  function paintAt(e) {
    const at = cellAt(e); if (!at) return;
    const [x, y] = at, row = grid[y].split('');
    if (mode == null) mode = row[x] === color ? '0' : color;
    if (row[x] === mode) return;
    row[x] = mode; grid = grid.map((r, i) => (i === y ? row.join('') : r));
    drawEditor(); showSym(); b.setGrid(grid);
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); painting = true; mode = null; try { cv.setPointerCapture(e.pointerId); } catch {} paintAt(e); });
  cv.addEventListener('pointermove', e => { if (painting) paintAt(e); });
  const stop = () => { painting = false; mode = null; };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);

  const sw = h('div', { class: 'swatches' }, ...COLORS.map(c => h('button', { class: 'sw' + (c === color ? ' on' : ''), title: '색', 'data-c': c, style: { background: PALETTE[c] }, onclick: () => pickColor(c) })),
    h('button', { class: 'sw eraser' + (color === '0' ? ' on' : ''), title: '지우개', 'data-c': '0', onclick: () => pickColor('0') }, '지우개'));
  function pickColor(c) { color = c; sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x.dataset.c === c)); }
  const sizes = h('div', { class: 'seg' }, ...[4, 5, 6].map(k => h('button', { class: 'btn small' + (k === n ? ' on' : ''), 'data-n': k, onclick: () => resize(k) }, `${k}×${k}`)),
    h('button', { class: 'btn small', onclick: () => { grid = blankOf(n); drawEditor(); showSym(); b.setGrid(grid); } }, '모두 지우기'));
  function resize(k) {
    if (k === n) return;
    grid = Array.from({ length: k }, (_, y) => Array.from({ length: k }, (_, x) => (grid[y] && grid[y][x]) || '0').join(''));   // 겹치는 칸은 남긴다
    n = k; sizes.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', +x.dataset.n === k));
    drawEditor(); showSym(); b.setGrid(grid);
  }

  // 규칙 칸 — 처음엔 가로 두 칸 [그대로, 오른쪽으로 뒤집기](마주 보는 무늬)
  const b = makeBuilder({ grid, uw: 2, uh: 1, cols: WALL.cols, rows: WALL.rows, cur: [['id', 'fh']], cellPx: 58 }, {});
  let uw = 2, uh = 1;
  const unitSeg = h('div', { class: 'seg' }, ...UNITS.map(([w, hh, t]) => h('button', { class: 'btn small' + (w === uw && hh === uh ? ' on' : ''), 'data-u': w + 'x' + hh, onclick: () => { uw = w; uh = hh; b.setUnit(w, hh); unitSeg.querySelectorAll('[data-u]').forEach(x => x.classList.toggle('on', x.dataset.u === w + 'x' + hh)); } }, t)));
  const saveBtn = h('button', { class: 'btn primary', onclick: () => save() }, '💾 저장하고 우리 반 전시에 걸기');
  const msg = h('div', { class: 'msg' });
  async function save() {
    if (saving) return;
    if (isBlank(grid)) { msg.textContent = '도장을 먼저 그려요 — 왼쪽 칸을 눌러 색칠해요.'; msg.className = 'msg bad'; return; }
    if (!b.filled()) { msg.textContent = '규칙 칸의 움직임을 모두 정해요(? 칸).'; msg.className = 'msg bad'; return; }
    saving = true;
    try {
      const mine = await Promise.race([ctx.store.myWorks(), new Promise(r => setTimeout(() => r(null), 4000))]);
      if (mine && Object.keys(mine).length >= MAX_WORKS) { msg.textContent = `무늬는 ${MAX_WORKS}개까지 걸 수 있어요 — 전시에서 내 무늬 하나를 내리고 저장해요.`; msg.className = 'msg bad'; return; }
      await ctx.store.saveWork({ g: grid, u: b.unit() });
      toast('우리 반 무늬 전시에 걸었어요!');
      ctx.go('#/gallery');
    } catch (e) { console.warn(e); msg.textContent = '저장하지 못했어요 — 인터넷을 확인하고 다시 눌러 봐요.'; msg.className = 'msg bad'; }
    finally { saving = false; }
  }

  root.replaceChildren(
    ctx.topBar('6장 · 도장 공방', { back: '#/', right: [h('button', { class: 'btn small', onclick: () => ctx.go('#/gallery') }, '🖼 우리 반 무늬 전시')] }),
    h('div', { class: 'pz' },
      h('section', { class: 'q' },
        h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, '나의 도장'), h('p', {}, '칸을 눌러 도장을 그려요. 한쪽으로 기운 도장일수록 뒤집기 · 돌리기가 잘 보여요.'))),
        h('div', { class: 'q-body make-l' }, h('div', { class: 'paint-wrap' }, cv), sw, sizes, symEl)),
      h('section', { class: 'a' },
        h('div', { class: 'a-body' },
          h('p', { class: 'a-q' }, '규칙 칸을 정해요 — 크기를 고르고, 칸마다 움직임을'),
          unitSeg, h('div', { class: 'unit-row' }, b.unitEl, b.picker),
          h('p', { class: 'cap' }, '내 무늬 — 규칙 칸(점선)을 밀어서 채운 것'), b.prevBox),
        h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), saveBtn))));
  const fit = () => { if (!alive) return; const box = cv.parentElement; side = Math.max(180, Math.min(320, Math.floor(Math.min(box.clientWidth, box.clientHeight)))); drawEditor(); b.renderWalls(); };
  const ro = new ResizeObserver(fit); ro.observe(cv.parentElement);
  b.render(); showSym(); requestAnimationFrame(fit);
  return { unmount() { alive = false; ro.disconnect(); } };
}
