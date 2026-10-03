// 규칙 칸 짜기 — 규칙 칸(가로 uw × 세로 uh)마다 움직임을 고르면, 규칙 칸을 밀어서 판을 채운다(실시간).
//  target(목표 무늬 칸 그림들)이 있으면 그림이 같아질 때 onSolved — 4장 무늬 만들기 · 6장 친구 무늬 규칙 맞히기
//  target 이 없으면 자유 짓기 — 6장 도장 공방(도장이 바뀌면 setGrid · 규칙 칸 크기가 바뀌면 setUnit)
import { h } from './util.js';
import { MOVES, MOVE_KEYS, apply, mistakeOf, answersFor, sameWall } from './tiles.js';
import { tileCanvas, wallCanvas, fitPx } from './draw.js';

const blank = n => Array.from({ length: n }, () => '0'.repeat(n));
const mvBtn = (m, onclick, extra = '') => h('button', { class: 'mvbtn' + extra, 'data-m': m, onclick }, h('span', { class: 'ic' }, MOVES[m].icon), h('span', {}, MOVES[m].short));

export function makeBuilder(o, hooks = {}) {
  let { grid, uw, uh, cols, rows } = o;
  const target = o.target || null;
  let cur = o.cur ? o.cur.map(r => r.slice()) : Array.from({ length: uh }, () => Array(uw).fill(''));
  let sel = [0, 0], changes = 0, solved = false;
  const unitEl = h('div', { class: 'unit' }), picker = h('div', { class: 'moves small' });
  const prevBox = h('div', { class: 'wallbox small' }), tBox = target ? h('div', { class: 'wallbox' }) : null;
  const tileAt = (x, y) => { const m = cur[y % uh][x % uw]; return m ? apply(grid, m) : blank(grid.length); };
  const mine = () => Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => tileAt(x, y)));
  const ansAt = (x, y) => (target ? answersFor(grid, target[y][x]) : MOVE_KEYS);   // 규칙 칸 (x, y) = 목표의 같은 자리 칸
  function renderUnit() {
    unitEl.style.gridTemplateColumns = `repeat(${uw}, auto)`;
    unitEl.replaceChildren(...cur.flatMap((row, y) => row.map((m, x) => h('button', { class: 'ucell' + (sel[0] === x && sel[1] === y ? ' sel' : ''), 'data-xy': x + ',' + y, onclick: () => { sel = [x, y]; renderUnit(); renderPicker(); } },
      tileCanvas(m ? apply(grid, m) : blank(grid.length), o.cellPx || 70), h('span', {}, m ? MOVES[m].short : '?')))));
  }
  function renderPicker() { picker.replaceChildren(...MOVE_KEYS.map(m => mvBtn(m, () => setMove(m), cur[sel[1]][sel[0]] === m ? ' on' : ''))); }
  function renderWalls() {
    if (tBox) tBox.replaceChildren(wallCanvas(target, fitPx(cols, rows, tBox.clientWidth || 560, tBox.clientHeight || 360)));
    prevBox.replaceChildren(wallCanvas(mine(), fitPx(cols, rows, prevBox.clientWidth || 300, prevBox.clientHeight || 150), { unit: [uw, uh] }));
  }
  const renderAll = () => { renderUnit(); renderPicker(); renderWalls(); };
  function setMove(m) {
    if (solved) return;
    const [x, y] = sel; if (cur[y][x] === m) return;
    cur[y][x] = m; changes++;
    const mk = target ? mistakeOf(m, ansAt(x, y)) : null; if (mk && hooks.onWrong) hooks.onWrong(mk);
    const all = cur.every(r => r.every(Boolean));
    if (!all) { const nx = cur.flat().findIndex(v => !v); if (nx >= 0) sel = [nx % uw, Math.floor(nx / uw)]; }
    renderAll();
    hooks.onChange && hooks.onChange(cur);
    if (!target) return;
    if (all && sameWall(mine(), target)) { solved = true; hooks.onSolved && hooks.onSolved({ changes, cells: uw * uh }); }
    else if (all) hooks.onMismatch && hooks.onMismatch();
  }
  return {
    unitEl, picker, prevBox, tBox, render: renderAll, renderWalls, mine,
    unit: () => cur.map(r => r.slice()), filled: () => cur.every(r => r.every(Boolean)),
    setGrid(g) { grid = g; renderAll(); },
    setUnit(nw, nh) {   // 크기를 바꿔도 겹치는 칸의 움직임은 남긴다
      cur = Array.from({ length: nh }, (_, y) => Array.from({ length: nw }, (_, x) => (cur[y] && cur[y][x]) || ''));
      uw = nw; uh = nh; sel = [0, 0]; renderAll();
    },
  };
}
