// 오선 악보(SVG) — 높은음자리표 · 박자표 · 음표(온·2분·4분·8분·16분 + 점) · 쉼표 · 붙임줄 · 이음줄(빔) · 덧줄
//  + 계이름(무지개 색) · 노랫말 · 화음 이름. 높은음자리표·쉼표 글리프는 Noto Music(필요한 글자만 받는다 — index.html)
import { svg } from './util.js';
import { pc, solfege, colorOf, barSteps, fitChords, chordName, SCALES } from './theory.js';

const LG = 10;                                   // 오선 줄 사이(px)
const DIAT = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];   // 반음 번호 → 음이름 자리(C=0 … B=6)
const SHARP = new Set([1, 3, 6, 8, 10]);
export const staffPos = p => (Math.floor(p / 12) - 5) * 7 + DIAT[pc(p)] - 2;   // 아래 첫 줄(미4) = 0, 한 칸 위 = +1

// 칸 수 → [칸, 모양, 점] (w 온 · h 2분 · q 4분 · e 8분 · s 16분)
const VALUES = {
  2: [[8, 'w', 0], [6, 'h', 1], [4, 'h', 0], [3, 'q', 1], [2, 'q', 0], [1, 'e', 0]],
  3: [[12, 'w', 1], [6, 'h', 1], [4, 'h', 0], [3, 'q', 1], [2, 'q', 0], [1, 'e', 0]],
  4: [[16, 'w', 0], [12, 'h', 1], [8, 'h', 0], [6, 'q', 1], [4, 'q', 0], [3, 'e', 1], [2, 'e', 0], [1, 's', 0]],
};
// 한 마디 안의 [x, x+len) 을 읽기 쉬운 음표들로 쪼갠다 — 박 위에서 시작하면 마디 안 아무 길이나,
//  박 사이(엇박)에서 시작하면 한 박 안쪽 길이만(넘치면 붙임줄)
export function splitValue(x, len, sub, bs) {
  const out = [], vals = VALUES[sub] || VALUES[2];
  while (len > 0) {
    const onBeat = x % sub === 0;
    const toBeat = sub - (x % sub);
    let pick = null;
    for (const [v, base, dots] of vals) {
      if (v > len || x + v > bs) continue;
      if (!onBeat && v > Math.max(toBeat, sub === 2 ? 2 : toBeat)) continue;
      if (onBeat && sub === 3 && (v === 4 || v === 2) && len >= 3) continue;       // 겹박자는 점음표를 먼저
      pick = { v, base, dots }; break;
    }
    if (!pick) pick = { v: 1, base: sub === 4 ? 's' : 'e', dots: 0 };
    out.push({ x, ...pick });
    x += pick.v; len -= pick.v;
  }
  return out;
}

// 곡 → 악보 조각들(마디별). 쉼표 포함. 음 조각에는 note 번호와 '이어짐(tie)' 표시
export function layoutPieces(song) {
  const bs = barSteps(song), bars = [];
  const notes = song.notes.map((n, i) => ({ ...n, i })).sort((a, z) => a.s - z.s);
  for (let b = 0; b < song.bars; b++) {
    const a = b * bs, z = a + bs, items = [];
    let cur = a;
    const inBar = notes.filter(n => n.s < z && n.s + n.d > a);
    for (const n of inBar) {
      const s0 = Math.max(n.s, a), s1 = Math.min(n.s + n.d, z);
      if (s0 > cur) for (const r of splitValue(cur - a, s0 - cur, song.sub, bs)) items.push({ rest: true, ...r });
      const parts = splitValue(s0 - a, s1 - s0, song.sub, bs);
      parts.forEach((r, k) => items.push({ ...r, p: n.p, i: n.i, w: n.w, first: s0 === n.s && k === 0, tieNext: k < parts.length - 1 || s1 < n.s + n.d }));
      cur = s1;
    }
    if (cur < z) for (const r of splitValue(cur - a, z - cur, song.sub, bs)) items.push({ rest: true, ...r });
    bars.push(items);
  }
  return bars;
}

export function renderStaff(song, o = {}) {
  const W = o.width || 900;
  const perLine = o.barsPerLine || (W >= 860 ? 4 : W >= 520 ? 2 : 1);
  const lineH = 150, clefW = 44, tsW = 26;
  const bars = layoutPieces(song), bs = barSteps(song);
  const lines = Math.ceil(song.bars / perLine);
  const H = lines * lineH + 10;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'staff' });
  const noteEls = new Map();
  const addEl = (i, el) => { if (!noteEls.has(i)) noteEls.set(i, []); noteEls.get(i).push(el); };
  const chords = o.chords !== false && SCALES[song.scale]?.family !== 'korean' ? fitChords(song, song.chords) : null;
  const ties = [];

  for (let L = 0; L < lines; L++) {
    const y0 = L * lineH + 8, top = y0 + 44, bottom = top + 4 * LG;
    const yOf = pos => bottom - pos * (LG / 2);
    const left = clefW + (L === 0 ? tsW : 0);
    const barW = (W - left - 6) / perLine;
    for (let k = 0; k < 5; k++) root.append(svg('line', { x1: 2, x2: W - 4, y1: top + k * LG, y2: top + k * LG, class: 'st-line' }));
    root.append(svg('text', { x: 4, y: top + 33, class: 'st-clef' }, '\u{1D11E}'));
    if (L === 0) {
      root.append(svg('text', { x: clefW + 10, y: top + 18, class: 'st-ts', 'text-anchor': 'middle' }, String(song.beats * (song.sub === 3 ? 3 : 1))));
      root.append(svg('text', { x: clefW + 10, y: top + 38, class: 'st-ts', 'text-anchor': 'middle' }, song.sub === 3 ? '8' : '4'));
    }
    for (let j = 0; j < perLine; j++) {
      const b = L * perLine + j;
      if (b >= song.bars) break;
      const bx = left + j * barW, stepW = (barW - 18) / bs;
      const last = b === song.bars - 1;
      root.append(svg('line', { x1: bx + barW, x2: bx + barW, y1: top, y2: bottom, class: last ? 'st-bar end' : 'st-bar' }));
      if (last) root.append(svg('line', { x1: bx + barW - 5, x2: bx + barW - 5, y1: top, y2: bottom, class: 'st-bar' }));
      if (chords) root.append(svg('text', { x: bx + 8, y: y0 + 14, class: 'st-chord' }, chordName(chords[b], song.key || 0)));
      if (o.barNumbers !== false && j === 0) root.append(svg('text', { x: bx + 2, y: top - 8, class: 'st-num' }, String(b + 1)));
      const items = bars[b];
      const X = it => bx + 12 + it.x * stepW + 6;
      // 이음줄 묶음: 같은 박 안의 8분·16분 음표(쉼표 없이 이어진 것)
      const groups = [];
      let g = null;
      for (const it of items) {
        const beam = !it.rest && (it.base === 'e' || it.base === 's');
        const beatIdx = Math.floor(it.x / song.sub);
        if (beam && g && g.beat === beatIdx) g.items.push(it);
        else if (beam) { g = { beat: beatIdx, items: [it] }; groups.push(g); }
        else g = null;
      }
      const beamed = new Set(groups.filter(q => q.items.length > 1).flatMap(q => q.items));
      for (const q of groups) q.up = q.items.reduce((s, it) => s + staffPos(it.p), 0) / q.items.length < 4;

      for (const it of items) {
        const cx = X(it);
        if (it.rest) { drawRest(root, it, cx, top); continue; }
        const pos = staffPos(it.p), cy = yOf(pos);
        const grp = groups.find(q => q.items.includes(it));
        const up = grp && beamed.has(it) ? grp.up : pos < 4;
        const el = svg('g', { class: 'st-note', 'data-i': it.i });
        for (let lp = -2; lp >= pos; lp -= 2) el.append(svg('line', { x1: cx - 9, x2: cx + 9, y1: yOf(lp), y2: yOf(lp), class: 'st-ledger' }));
        for (let lp = 10; lp <= pos; lp += 2) el.append(svg('line', { x1: cx - 9, x2: cx + 9, y1: yOf(lp), y2: yOf(lp), class: 'st-ledger' }));
        if (SHARP.has(pc(it.p))) el.append(svg('text', { x: cx - 16, y: cy + 5, class: 'st-acc' }, '♯'));
        const hollow = it.base === 'h' || it.base === 'w';
        el.append(svg('ellipse', { cx, cy, rx: 6.3, ry: 4.6, transform: `rotate(-20 ${cx} ${cy})`, class: hollow ? 'st-head hollow' : 'st-head' }));
        if (it.dots) el.append(svg('circle', { cx: cx + 10.5, cy: pos % 2 === 0 ? cy - 4 : cy, r: 1.9, class: 'st-dot' }));
        if (it.base !== 'w') {
          const sx = up ? cx + 5.8 : cx - 5.8, sy1 = up ? cy - 1 : cy + 1;
          let sy2 = up ? cy - 34 : cy + 34;
          if (grp && beamed.has(it)) sy2 = up ? Math.min(...grp.items.map(q => yOf(staffPos(q.p)))) - 32 : Math.max(...grp.items.map(q => yOf(staffPos(q.p)))) + 32;
          el.append(svg('line', { x1: sx, x2: sx, y1: sy1, y2: sy2, class: 'st-stem' }));
          it._stem = { x: sx, y: sy2, up };
          if (!beamed.has(it) && (it.base === 'e' || it.base === 's')) {
            for (let f = 0; f < (it.base === 's' ? 2 : 1); f++) {
              const fy = sy2 + (up ? f * 7 : -f * 7), dir = up ? 1 : -1;
              el.append(svg('path', { d: `M${sx} ${fy} c 0 ${6 * dir} 9 ${9 * dir} 8 ${19 * dir} c -1 ${-6 * dir} -4 ${-9 * dir} -8 ${-11 * dir}z`, class: 'st-flag' }));
            }
          }
        }
        if (it.first && o.solfege !== false) {
          const nm = solfege(it.p, { short: true }), hi = it.p >= 72, lo = it.p < 60;
          el.append(svg('text', { x: cx, y: bottom + 34, 'text-anchor': 'middle', class: 'st-sol', fill: colorOf(it.p) }, nm));
          if (hi) el.append(svg('circle', { cx, cy: bottom + 18, r: 2, fill: colorOf(it.p) }));
          if (lo) el.append(svg('circle', { cx, cy: bottom + 40, r: 2, fill: colorOf(it.p) }));
        }
        if (it.first && it.w && o.lyrics !== false) el.append(svg('text', { x: cx, y: bottom + 56, 'text-anchor': 'middle', class: 'st-lyric' }, it.w));
        root.append(el);
        addEl(it.i, el);
        if (it.tieNext) ties.push({ from: it, cx, cy, up });
      }
      // 이음줄(빔)
      for (const q of groups) {
        if (q.items.length < 2) continue;
        const a = q.items[0]._stem, z = q.items[q.items.length - 1]._stem, dir = q.up ? 1 : -1;
        root.append(svg('line', { x1: a.x, x2: z.x, y1: a.y, y2: z.y, class: 'st-beam' }));
        q.items.forEach((it, k) => {                       // 16분음표 둘째 줄
          if (it.base !== 's') return;
          const nx = q.items[k + 1], px = q.items[k - 1];
          const y = it._stem.y + 6 * dir;
          if (nx && nx.base === 's') root.append(svg('line', { x1: it._stem.x, x2: nx._stem.x, y1: y, y2: y, class: 'st-beam' }));
          else if (!px || px.base !== 's') root.append(svg('line', { x1: it._stem.x, x2: it._stem.x + (nx ? 8 : -8), y1: y, y2: y, class: 'st-beam' }));
        });
      }
    }
  }
  // 붙임줄 — 다음 조각(같은 음)까지 둥근 선
  const heads = [...root.querySelectorAll('.st-note')];
  for (const t of ties) {
    const nextEl = heads.find(el => +el.dataset.i === t.from.i && el.querySelector('ellipse') && +el.querySelector('ellipse').getAttribute('cx') > t.cx + 1);
    if (!nextEl) continue;
    const e2 = nextEl.querySelector('ellipse'), x2 = +e2.getAttribute('cx'), y2 = +e2.getAttribute('cy');
    if (Math.abs(y2 - t.cy) > 1) continue;                  // 줄이 바뀐 붙임줄은 생략(드묾)
    const yy = t.cy + (t.up ? 8 : -8), dir = t.up ? 1 : -1;
    root.append(svg('path', { d: `M${t.cx + 4} ${yy} Q ${(t.cx + x2) / 2} ${yy + 7 * dir} ${x2 - 4} ${yy}`, class: 'st-tie' }));
  }
  return { el: root, noteEls };
}

function drawRest(root, it, cx, top) {
  const mid = top + 2 * LG;
  if (it.base === 'w') root.append(svg('rect', { x: cx - 6, y: top + LG, width: 12, height: 5, class: 'st-rest' }));
  else if (it.base === 'h') root.append(svg('rect', { x: cx - 6, y: mid - 5, width: 12, height: 5, class: 'st-rest' }));
  else root.append(svg('text', { x: cx, y: mid + 8, 'text-anchor': 'middle', class: 'st-rglyph' }, { q: '\u{1D13D}', e: '\u{1D13E}', s: '\u{1D13F}' }[it.base]));
  if (it.dots) root.append(svg('circle', { cx: cx + 9, cy: mid - 4, r: 1.8, class: 'st-dot' }));
}
