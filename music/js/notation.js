// 오선 악보(SVG) — 높은음자리표 · 박자표 · 음표(온·2분·4분·8분·16분 + 점) · 쉼표 · 붙임줄 · 이음줄(빔) · 덧줄
//  + 계이름(무지개 색) · 노랫말 · 화음 이름. 높은음자리표·쉼표 글리프는 Noto Music(필요한 글자만 받는다 — index.html)
//  [MUSIC-HARM-1] 아이가 쌓은 화음이 있으면 줄마다 오선 두 개(위 = 가락 · 아래 = 화음, 같은 때 음은 한 기둥에 쌓음)
import { svg } from './util.js';
import { pc, solfege, colorOf, barSteps, fitChords, chordName, SCALES, chordByName } from './theory.js';

const LG = 10;                                   // 오선 줄 사이(px)
const DIAT = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 6];   // 반음 번호 → 음이름 자리(C=0 … B=6) · 10 = 시♭ → 시 자리에 ♭(계이름 '시♭'과 같게) [MUSIC-TSONG-1]
const SHARP = new Set([1, 3, 6, 8]), FLAT = new Set([10]);
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

//  [MUSIC-SCORE-1] 쉼표 나누기(여러 줄 악보) — 박 사이에서 시작하면 먼저 그 박 끝까지(짧은 쉼표부터) · 박 위에서는 박 단위
//   (4/4 · 12/8 의 2분 쉼표 · 점2분 쉼표는 1 · 3 박에서만) — 쉼표가 박을 가로지르지 않게. 가락 악보(renderStaff)는 예전 그대로 splitValue
export function splitRest(x, len, sub, bs) {
  const out = [], vals = VALUES[sub] || VALUES[2], beats = bs / sub;
  const pick = v => { const e = vals.find(q => q[0] === v); return e ? { v, base: e[1], dots: e[2] } : null; };
  while (len > 0) {
    const inBeat = x % sub;
    let v;
    if (inBeat) {
      const toBeat = Math.min(sub - inBeat, len);
      v = sub === 3 ? 1 : [4, 2, 1].find(q => q <= toBeat && inBeat % q === 0) || 1;
    } else if (len >= bs && x % bs === 0 && pick(bs)) v = bs;
    else if (beats === 4 && x % (2 * sub) === 0 && len >= 2 * sub) v = 2 * sub;
    else v = Math.min(sub, len);
    let r = pick(v);
    if (!r) { v = 1; r = pick(1) || { v: 1, base: sub === 4 ? 's' : 'e', dots: 0 }; }
    out.push({ x, ...r });
    x += v; len -= v;
  }
  return out;
}

// 소리 사건(겹치지 않는 줄) → 마디별 조각. ev = [{ s, d, ps:[음…], i, w }] · restFn = 쉼표 나누기(안 주면 예전 splitValue)
export function layoutVoice(song, events, restFn = splitValue) {
  const bs = barSteps(song), bars = [];
  const evs = [...events].sort((a, z) => a.s - z.s);
  for (let b = 0; b < song.bars; b++) {
    const a = b * bs, z = a + bs, items = [];
    let cur = a;
    for (const n of evs.filter(n => n.s < z && n.s + n.d > a)) {
      const s0 = Math.max(n.s, a, cur), s1 = Math.min(n.s + n.d, z);
      if (s1 <= s0) continue;
      if (s0 > cur) for (const r of restFn(cur - a, s0 - cur, song.sub, bs)) items.push({ rest: true, ...r });
      const parts = splitValue(s0 - a, s1 - s0, song.sub, bs);
      parts.forEach((r, k) => items.push({ ...r, ps: n.ps, i: n.i, w: n.w, first: s0 === n.s && k === 0, tieNext: k < parts.length - 1 || s1 < n.s + n.d, ...(n.hs ? { hs: n.hs } : {}), ...(n.ex ? { ex: n.ex } : {}), ...(n.lab != null ? { lab: n.lab } : {}) }));
      cur = s1;
    }
    if (cur < z) for (const r of restFn(cur - a, z - cur, song.sub, bs)) items.push({ rest: true, ...r });
    bars.push(items);
  }
  return bars;
}
const melodyEvents = song => song.notes.map((n, i) => ({ s: n.s, d: n.d, ps: [n.p], i, w: n.w }));
function harmEvents(song) {
  const by = new Map();
  for (const n of song.harm || []) { if (!by.has(n.s)) by.set(n.s, { s: n.s, d: n.d, ps: [], i: 'h' + n.s }); const e = by.get(n.s); e.ps.push(n.p); e.d = Math.min(e.d, n.d); }
  return [...by.values()].map(e => ({ ...e, ps: e.ps.sort((a, z) => a - z) }));
}
export const layoutPieces = song => layoutVoice(song, melodyEvents(song));   // 예전 이름(가락만)

export function renderStaff(song, o = {}) {
  const W = o.width || 900;
  const perLine = o.barsPerLine || (W >= 860 ? 4 : W >= 520 ? 2 : 1);
  const hasH = o.harmony !== false && (song.harm || []).length > 0;
  const lineH = hasH ? 252 : 150, clefW = 44, tsW = 26;
  const mel = layoutVoice(song, melodyEvents(song)), har = hasH ? layoutVoice(song, harmEvents(song)) : null;
  const bs = barSteps(song);
  const lines = Math.ceil(song.bars / perLine);
  const H = lines * lineH + 10;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'staff' });
  const noteEls = new Map();
  const addEl = (i, el) => { if (!noteEls.has(i)) noteEls.set(i, []); noteEls.get(i).push(el); };
  const chords = o.chords !== false && SCALES[song.scale]?.family !== 'korean' ? fitChords(song, song.chords) : null;
  const ties = [], carryM = new Map(), carryH = new Map();   // 마디를 넘는 붙임줄 — 그림마다 새로

  const staffLines = (top, label) => {
    for (let k = 0; k < 5; k++) root.append(svg('line', { x1: 2, x2: W - 4, y1: top + k * LG, y2: top + k * LG, class: 'st-line' }));
    root.append(svg('text', { x: 4, y: top + 33, class: 'st-clef' }, '\u{1D11E}'));
    if (label) root.append(svg('text', { x: 6, y: top - 22, class: 'st-voice' }, label));
  };
  const timeSig = top => {
    root.append(svg('text', { x: clefW + 10, y: top + 18, class: 'st-ts', 'text-anchor': 'middle' }, String(song.beats * (song.sub === 3 ? 3 : 1))));
    root.append(svg('text', { x: clefW + 10, y: top + 38, class: 'st-ts', 'text-anchor': 'middle' }, song.sub === 3 ? '8' : '4'));
  };

  for (let L = 0; L < lines; L++) {
    const y0 = L * lineH + 8, topM = y0 + 44, topH = topM + 40 + 82;
    const left = clefW + (L === 0 ? tsW : 0);
    const barW = (W - left - 6) / perLine;
    staffLines(topM, hasH && L === 0 ? '가락' : '');
    if (hasH) staffLines(topH, L === 0 ? '화음' : '');
    if (L === 0) { timeSig(topM); if (hasH) timeSig(topH); }
    for (let j = 0; j < perLine; j++) {
      const b = L * perLine + j;
      if (b >= song.bars) break;
      const bx = left + j * barW, stepW = (barW - 18) / bs;
      const last = b === song.bars - 1;
      for (const top of hasH ? [topM, topH] : [topM]) {
        root.append(svg('line', { x1: bx + barW, x2: bx + barW, y1: top, y2: top + 4 * LG, class: last ? 'st-bar end' : 'st-bar' }));
        if (last) root.append(svg('line', { x1: bx + barW - 5, x2: bx + barW - 5, y1: top, y2: top + 4 * LG, class: 'st-bar' }));
      }
      if (chords && !song.prog) root.append(svg('text', { x: bx + 8, y: y0 + 14, class: 'st-chord' }, chordName(chords[b], song.key || 0)));
      if (song.prog) for (let k = 0; k < song.beats; k++) {               // 진행이 적힌 곡 — 화음이 바뀌는 박마다
        const at = b * song.beats + k, every = song.progEvery || 1;
        const nm = song.prog[Math.floor(at / every) % song.prog.length], pv = at ? song.prog[Math.floor((at - 1) / every) % song.prog.length] : null;
        if (nm !== '-' && chordByName(nm) && (nm !== pv || k === 0)) root.append(svg('text', { x: bx + 8 + k * song.sub * stepW, y: y0 + 14, class: 'st-chord' }, nm));
      }
      if (o.barNumbers !== false && j === 0) root.append(svg('text', { x: bx + 2, y: topM - 8, class: 'st-num' }, String(b + 1)));
      const X = it => bx + 12 + it.x * stepW + 6;
      drawBar(root, mel[b], topM, X, { song, words: true, addEl, ties, o, carry: carryM });
      if (hasH) drawBar(root, har[b], topH, X, { song, words: false, addEl, ties, o, carry: carryH });
    }
  }
  // 붙임줄 — 다음 조각(같은 음)까지 둥근 선
  for (const t of ties) {
    const nx = t.next && t.next();
    if (!nx) continue;
    for (const hd of t.heads) {
      const m = nx.heads.find(z => z.p === hd.p);
      if (!m || Math.abs(m.cy - hd.cy) > 1 || m.cx <= hd.cx) continue;
      const yy = hd.cy + (t.up ? 8 : -8), dir = t.up ? 1 : -1;
      root.append(svg('path', { d: `M${hd.cx + 4} ${yy} Q ${(hd.cx + m.cx) / 2} ${yy + 7 * dir} ${m.cx - 4} ${yy}`, class: 'st-tie' }));
    }
  }
  return { el: root, noteEls };
}

// 한 오선 · 한 마디 그리기(가락 또는 화음). 같은 때 음(ps)은 한 기둥에 쌓는다
//  [MUSIC-SCORE-1] 고를 것(안 주면 예전 그대로): posOf 음 → 자리(낮은음자리표 · 북 자리) · stem 기둥 방향 고정('up'|'down') · acc 올림표 그리기 · unison 같은 자리 음 옆으로 ·
//   restDy 쉼표 위아래 · hideRests 쉼표 안 그림 · solY 계이름 높이 · words 'lab' = 계이름 대신 it.lab(칸에 적힌 글)
function drawBar(root, items, top, X, { song, words, addEl, ties, o, carry, posOf = staffPos, stem, acc = true, unison = false, restDy = 0, hideRests = false, solY = 34, labFs = 0 }) {
  const bottom = top + 4 * LG, yOf = pos => bottom - pos * (LG / 2);
  // 이음줄 묶음: 같은 박 안의 8분·16분(쉼표 없이 이어진 것)
  const groups = []; let g = null;
  for (const it of items) {
    const beam = !it.rest && (it.base === 'e' || it.base === 's');
    const beatIdx = Math.floor(it.x / song.sub);
    if (beam && g && g.beat === beatIdx) g.items.push(it);
    else if (beam) { g = { beat: beatIdx, items: [it] }; groups.push(g); }
    else g = null;
  }
  const beamed = new Set(groups.filter(q => q.items.length > 1).flatMap(q => q.items));
  const avgPos = it => it.ps.reduce((s, p) => s + posOf(p), 0) / it.ps.length;
  for (const q of groups) q.up = stem ? stem === 'up' : q.items.reduce((s, it) => s + avgPos(it), 0) / q.items.length < 4;
  const drawn = [];
  for (const it of items) {
    const cx = X(it);
    if (it.rest) { if (!hideRests) drawRest(root, it, cx, top, restDy); continue; }
    const poss = it.ps.map(posOf), lo = Math.min(...poss), hi = Math.max(...poss);
    const grp = groups.find(q => q.items.includes(it));
    const up = stem ? stem === 'up' : grp && beamed.has(it) ? grp.up : avgPos(it) < 4;
    const el = svg('g', { class: 'st-note', 'data-i': it.i });
    for (let lp = -2; lp >= lo; lp -= 2) el.append(svg('line', { x1: cx - 9, x2: cx + 9, y1: yOf(lp), y2: yOf(lp), class: 'st-ledger' }));
    for (let lp = 10; lp <= hi; lp += 2) el.append(svg('line', { x1: cx - 9, x2: cx + 9, y1: yOf(lp), y2: yOf(lp), class: 'st-ledger' }));
    const hollow = it.base === 'h' || it.base === 'w';
    const heads = [];
    it.ps.forEach((p, k) => {
      const pos = poss[k], cy = yOf(pos);
      const second = k > 0 && (pos - poss[k - 1] === 1 || (unison && pos === poss[k - 1])) && !(heads[k - 1] && heads[k - 1].shift);   // 2도로 붙은 음은 옆으로 비킴(북 = 같은 자리도)
      const hx = cx + (second ? (up ? 11.5 : -11.5) : 0);
      if (acc && SHARP.has(pc(p))) el.append(svg('text', { x: cx - 16 - (it.ps.length > 1 ? 4 * k : 0), y: cy + 5, class: 'st-acc' }, '♯'));
      else if (acc && FLAT.has(pc(p))) el.append(svg('text', { x: cx - 15 - (it.ps.length > 1 ? 4 * k : 0), y: cy + 4, class: 'st-acc' }, '♭'));
      const kind = it.hs && it.hs[k];
      if (kind) drawHead(el, kind, hx, cy, hollow);   // [MUSIC-SCORE-1] 북 머리(× · 열린 × · 세모)
      else el.append(svg('ellipse', { cx: hx, cy, rx: 6.3, ry: 4.6, transform: `rotate(-20 ${hx} ${cy})`, class: hollow ? 'st-head hollow' : 'st-head' }));
      if (it.dots) el.append(svg('circle', { cx: cx + 10.5 + (second && up ? 11.5 : 0), cy: pos % 2 === 0 ? cy - 4 : cy, r: 1.9, class: 'st-dot' }));
      heads.push({ p, cx: hx, cy, shift: second });
    });
    if (it.base !== 'w') {
      const sx = up ? cx + 5.8 : cx - 5.8, sy1 = up ? yOf(lo) - 1 : yOf(hi) + 1;
      let sy2 = up ? yOf(hi) - 34 : yOf(lo) + 34;
      if (grp && beamed.has(it)) sy2 = up ? Math.min(...grp.items.map(q => yOf(Math.max(...q.ps.map(posOf))))) - 32 : Math.max(...grp.items.map(q => yOf(Math.min(...q.ps.map(posOf))))) + 32;
      el.append(svg('line', { x1: sx, x2: sx, y1: sy1, y2: sy2, class: 'st-stem' }));
      it._stem = { x: sx, y: sy2, up };
      if (!beamed.has(it) && (it.base === 'e' || it.base === 's')) {
        for (let f = 0; f < (it.base === 's' ? 2 : 1); f++) {
          const fy = sy2 + (up ? f * 7 : -f * 7), dir = up ? 1 : -1;
          el.append(svg('path', { d: `M${sx} ${fy} c 0 ${6 * dir} 9 ${9 * dir} 8 ${19 * dir} c -1 ${-6 * dir} -4 ${-9 * dir} -8 ${-11 * dir}z`, class: 'st-flag' }));
        }
      }
    }
    if (words === 'lab' && it.first && it.lab) el.append(svg('text', { x: cx, y: bottom + solY, 'text-anchor': 'middle', class: 'st-sol', fill: colorOf(it.ps[it.ps.length - 1]), ...(labFs ? { style: `font-size:${labFs}px` } : {}) }, it.lab));   // [MUSIC-SCORE-1] 칸에 적힌 글 그대로
    else if (words && it.first && o.solfege !== false) {
      const p = it.ps[0], nm = solfege(p, { short: true });
      el.append(svg('text', { x: cx, y: bottom + solY, 'text-anchor': 'middle', class: 'st-sol', fill: colorOf(p) }, nm));
      if (p >= 72) el.append(svg('circle', { cx, cy: bottom + solY - 16, r: 2, fill: colorOf(p) }));
      if (p < 60) el.append(svg('circle', { cx, cy: bottom + solY + 6, r: 2, fill: colorOf(p) }));
    }
    if (words && it.first && it.w && o.lyrics !== false) el.append(svg('text', { x: cx, y: bottom + solY + 22, 'text-anchor': 'middle', class: 'st-lyric' }, it.w));
    if (it.first && it.ex) drawArt(el, it, { cx, up, yOf, lo, hi });   // [MUSIC-SCORE-1] 세게(>) · 짧게(·) · 굴리기(///) · 열린 칙(o)
    root.append(el);
    addEl(it.i, el);
    const rec = { heads, up, it };
    drawn.push(rec);
    if (it.tieNext) ties.push({ heads, up, next: () => rec.nextRec });
  }
  // 붙임줄의 다음 조각 = 같은 음 사건의 다음 조각(마디를 넘으면 다음 마디 그리기에서 이어 붙임)
  for (let k = 0; k < drawn.length - 1; k++) if (drawn[k].it.tieNext) drawn[k].nextRec = drawn[k + 1];
  for (let k = 0; k < drawn.length - 1; k++) if (drawn[k].it.first && drawn[k].it.ex && drawn[k].it.ex.gliss) drawGliss(root, drawn[k], drawn[k + 1]);   // [MUSIC-SCORE-1] 하프 글리산도
  if (drawn.length) {
    const first = drawn[0], prev = carry.get(first.it.i);
    if (prev && prev !== first) { prev.nextRec = first; carry.delete(first.it.i); }
    const lastRec = drawn[drawn.length - 1];
    if (lastRec.it.tieNext) carry.set(lastRec.it.i, lastRec);
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

function drawRest(root, it, cx, top, dy = 0) {
  const mid = top + 2 * LG + dy;
  if (it.base === 'w') root.append(svg('rect', { x: cx - 6, y: top + LG + dy, width: 12, height: 5, class: 'st-rest' }));
  else if (it.base === 'h') root.append(svg('rect', { x: cx - 6, y: mid - 5, width: 12, height: 5, class: 'st-rest' }));
  else root.append(svg('text', { x: cx, y: mid + 8, 'text-anchor': 'middle', class: 'st-rglyph' }, { q: '\u{1D13D}', e: '\u{1D13E}', s: '\u{1D13F}' }[it.base]));
  if (it.dots) root.append(svg('circle', { cx: cx + 9, cy: mid - 4, r: 1.8, class: 'st-dot' }));
}

// ════ [MUSIC-SCORE-1] 악보로 자동 변환 — 여러 줄 악보(오케스트라 총보 · 비트 악보 · 작곡 '악보 같이 보기') ════
//  모양(score.js 가 만듦): { beats, sub, bars, ts:[위, 아래], staves:[{ id, name, sub?, clef 'treble'|'bass'|'perc'|'perc1', oct(+1 = 8 · +2 = 15 높게 소리남 · -1 낮게),
//    fam?, brace?, words?(true 계이름 · 'lab' 칸 글), voices:[{ stem?, restDy?, events:[{ s, d, ps, hs?, ex?, lab?, i }] }] }],
//    chords:[{ s, name, ko? }], marks:[{ bar, text, color? }], repeat:{ from, to }?, tempo:{ bpm, dotted }?, fermata:{ s }? }
//  · 가락 악보(renderStaff)와 같은 붓(drawBar)으로 그린다 — 음표 길이 · 붙임줄 · 이음줄 · 덧줄 · 쉼표가 같은 규칙
//  · 낮은음자리표 = 높은음자리표 자리 + 12(아래 첫 줄 = 솔2) · 북 오선은 자리 그대로(음 높이 대신 칸 번호) · 한 줄 오선 = 가운데 줄만
export const clefPos = (p, clef = 'treble') => staffPos(p) + (clef === 'bass' ? 12 : 0);
export const ledgerCount = pos => (pos <= -2 ? Math.floor(-pos / 2) : pos >= 10 ? Math.floor((pos - 8) / 2) : 0);   // 음 하나의 덧줄 수
const NAMEW = 96, CLEFW = 40, TSW = 26;
const isPerc = clef => clef === 'perc' || clef === 'perc1';
const posFn = st => (isPerc(st.clef) ? p => p : st.clef === 'bass' ? p => staffPos(p) + 12 : staffPos);

//  북 머리 — × · 열린 ×(위 o 는 drawArt) · 세모(트라이앵글) · 보통(타원)
function drawHead(el, kind, cx, cy, hollow) {
  if (kind === 'x' || kind === 'xo') {
    el.append(svg('path', { d: `M${cx - 4.6} ${cy - 4.6}L${cx + 4.6} ${cy + 4.6}M${cx - 4.6} ${cy + 4.6}L${cx + 4.6} ${cy - 4.6}`, class: 'st-xhead' }));
    if (hollow) el.append(svg('circle', { cx, cy, r: 6.6, class: 'st-xring' }));
  } else if (kind === 'tri') el.append(svg('path', { d: `M${cx} ${cy - 5.4}L${cx + 5.6} ${cy + 4.2}L${cx - 5.6} ${cy + 4.2}Z`, class: 'st-trihead' }));
  else el.append(svg('ellipse', { cx, cy, rx: 6.3, ry: 4.6, transform: `rotate(-20 ${cx} ${cy})`, class: hollow ? 'st-head hollow' : 'st-head' }));
}
//  붙임표 — 굴리기(기둥에 빗금 셋) · 열린 칙(o) · 세게(>) · 짧게(점). 기둥 쪽 바깥에 차례로 쌓는다
function drawArt(el, it, { cx, up, yOf, lo, hi }) {
  const ex = it.ex, st = it._stem, dir = up ? -1 : 1;
  let tip = st ? st.y : up ? yOf(hi) - 6 : yOf(lo) + 6;
  if (ex.roll) {
    const sx = st ? st.x : cx, mid = st ? (yOf(up ? lo : hi) + st.y) / 2 + (up ? -2 : 2) : yOf(hi) - 18;
    for (let k = -1; k <= 1; k++) el.append(svg('line', { x1: sx - 5, x2: sx + 5, y1: mid + k * 5.5 + 2.6, y2: mid + k * 5.5 - 2.6, class: 'st-trem' }));
    if (!st) tip = Math.min(tip, yOf(hi) - 30);
  }
  let y = tip + dir * 9;
  if (ex.open) { el.append(svg('circle', { cx, cy: y, r: 3.2, class: 'st-open' })); y += dir * 9; }
  if (ex.accent) el.append(svg('path', { d: `M${cx - 5.5} ${y - 3.3}L${cx + 5.5} ${y}L${cx - 5.5} ${y + 3.3}`, class: 'st-accent' }));
  if (ex.stacc) el.append(svg('circle', { cx, cy: up ? yOf(lo) + 9 : yOf(hi) - 9, r: 2, class: 'st-dot' }));
}
function drawGliss(root, a, b) {
  const p = a.heads[0], q = b.heads[0];
  if (!p || !q || q.cx <= p.cx + 14) return;
  root.append(svg('line', { x1: p.cx + 8, y1: p.cy, x2: q.cx - 8, y2: q.cy, class: 'st-gliss' }));
  root.append(svg('text', { x: (p.cx + q.cx) / 2, y: (p.cy + q.cy) / 2 - 6, 'text-anchor': 'middle', class: 'st-small' }, 'gliss.'));
}
function drawTies(root, ties) {
  for (const t of ties) {
    const nx = t.next && t.next();
    if (!nx) continue;
    for (const hd of t.heads) {
      const m = nx.heads.find(z => z.p === hd.p);
      if (!m || Math.abs(m.cy - hd.cy) > 1 || m.cx <= hd.cx) continue;
      const yy = hd.cy + (t.up ? 8 : -8), dir = t.up ? 1 : -1;
      root.append(svg('path', { d: `M${hd.cx + 4} ${yy} Q ${(hd.cx + m.cx) / 2} ${yy + 7 * dir} ${m.cx - 4} ${yy}`, class: 'st-tie' }));
    }
  }
}
//  오선 하나가 위아래로 얼마나 차지하나(오선 맨 윗줄 = 0 · 맨 아랫줄 = 40) — 덧줄 · 기둥 · 붙임표 · 계이름까지
function extentOf(st, items, minA = 14, minB = 12, pad = 4) {
  const P = posFn(st), yOf = pos => 40 - pos * 5;
  let top = 0, bot = 40;
  for (const [it, stem] of items) {
    if (it.rest) { top = Math.min(top, 8 + (it.dy || 0)); bot = Math.max(bot, 32 + (it.dy || 0)); continue; }
    const ps = it.ps.map(P), lo = Math.min(...ps), hi = Math.max(...ps), avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    const up = stem ? stem === 'up' : avg < 4, ex = it.ex || {};
    const art = (ex.accent ? 10 : 0) + (ex.open ? 10 : 0) + (ex.roll && it.base === 'w' ? 30 : 0);
    if (up) { top = Math.min(top, yOf(hi) - (it.base === 'w' ? 8 : 37) - art); bot = Math.max(bot, yOf(lo) + 7 + (ex.stacc ? 10 : 0)); }
    else { bot = Math.max(bot, yOf(lo) + (it.base === 'w' ? 8 : 37) + art); top = Math.min(top, yOf(hi) - 7 - (ex.stacc ? 10 : 0)); }
  }
  if (st.words) bot = Math.max(bot, 40 + (st.solY || 30) + 4);
  if (st.oct > 0) top = Math.min(top, st.clef === 'bass' ? -14 : -22);            // 음자리표 위 작은 8 · 15
  if (st.oct < 0) bot = Math.max(bot, st.clef === 'bass' ? 40 : 58);
  return { above: Math.max(minA, -top + pad), below: Math.max(minB, bot - 40 + pad) };
}
//  한 마디가 쉼뿐이면 '온마디 쉼'(가운데 온쉼표 하나)
const barRest = (items, bs) => (items.length && items.every(it => it.rest) ? [{ rest: true, base: 'w', dots: 0, x: (bs - 1) / 2 }] : items);

export function renderScore(score, o = {}) {
  const A = o.align || null;
  let W = o.width || 900;
  const bs = score.beats * score.sub, bars = Math.max(1, score.bars);
  const song = { beats: score.beats, sub: score.sub, bars, notes: [] };
  const staves = score.staves.filter(Boolean);
  const named = !A && o.names !== false && staves.some(s => s.name);
  const narrow = !A && W < 600, NW = narrow ? 66 : NAMEW;                // 좁은 화면 = 이름 칸을 좁게(글자도 작게 — css .staff.narrow)
  const clefX = A ? 2 : (named ? NW : 4);
  const left0 = A ? A.left : clefX + CLEFW;
  //  칸마다(음성마다) 마디별 조각 — 두째 음성은 음이 없는 마디를 비운다(쉼표 숨김)
  //  계이름 줄 높이 — 오선 아래로 내려간 음(덧줄)보다 아래에(오선마다 한 번 · 맞춤 모드는 음 범위로)
  const solYs = staves.map((st, k) => {
    if (!st.words) return 0;
    const P = posFn(st);
    let lo = Infinity;
    if (A && o.ranges && o.ranges[k]) lo = P(o.ranges[k][0]);
    else for (const v of st.voices) for (const e of v.events || []) for (const p of e.ps) lo = Math.min(lo, P(p));
    return Math.max(st.solY || 30, Number.isFinite(lo) ? -lo * 5 + 19 : 0);
  });
  const lay = staves.map(st => st.voices.map((v, k) => {
    const bars2 = layoutVoice(song, v.events || [], splitRest);
    return bars2.map(items => (items.some(it => !it.rest) ? items : k > 0 ? [] : barRest(items, bs)));
  }));
  //  위아래 자리(맞춤 모드 = 음 범위로 고정 · 음을 놓아도 높이가 안 바뀜)
  const ext = staves.map((st, k) => {
    const st2 = st.words ? { ...st, solY: solYs[k] } : st;
    if (A && o.ranges && o.ranges[k]) { const [lo, hi] = o.ranges[k], its = []; for (let p = lo; p <= hi; p++) its.push([{ ps: [p], base: 'q' }, null]); return extentOf(st2, its, 8, 6, 1); }
    const its = []; st.voices.forEach((v, j) => lay[k][j].forEach(b => b.forEach(it => its.push([{ ...it, dy: v.restDy || 0 }, v.stem]))));
    return extentOf(st2, its);
  });
  const chordStaff = Math.min(staves.length - 1, Math.max(0, score.chordStaff || 0));
  const hasChords = (score.chords || []).length > 0, hasKo = hasChords && score.chords.some(c => c.ko);
  //  한 줄(시스템)에 마디 몇 — 가장 빽빽한 칸이 읽히게
  let perLine = A ? bars : o.barsPerLine;
  const minStep = o.minStep || (score.sub === 4 ? 16 : score.sub === 3 ? 17 : 20);
  if (!perLine) perLine = Math.max(1, Math.min(o.maxPerLine || 4, Math.floor((W - left0 - TSW - 8) / (bs * minStep + 26))));
  perLine = Math.min(perLine, bars);
  if (!A) W = Math.max(W, left0 + TSW + 8 + perLine * (bs * minStep + 26));   // 좁은 화면 — 음표가 겹칠 만큼 좁으면 악보를 넓히고 옆으로 밀어 본다
  const lines = Math.ceil(bars / perLine);
  const rep = score.repeat || null;
  //  세로 자리 — 표시(글자 · 빠르기) 줄 · 화음 줄 · 오선마다(위 여백 · 오선 · 아래 여백)
  const marksAt = L => (score.marks || []).some(m => Math.floor(m.bar / perLine) === L) || (L === 0 && !!score.tempo);
  const chordH = hasChords ? (hasKo ? 30 : A ? 14 : 18) : 0;
  const sysH = L => (marksAt(L) ? 20 : 0) + chordH + ext.reduce((a, e) => a + e.above + 40 + e.below, 0) + (staves.length - 1) * (A ? 2 : 8) + (A ? 2 : 10);
  const tops = []; let H = A ? 1 : 6;
  for (let L = 0; L < lines; L++) { tops.push(H); H += sysH(L) + (A ? 0 : 12); }
  const totalW = A ? A.left + bars * bs * A.stepW + 2 : W;
  const root = svg('svg', { viewBox: `0 0 ${totalW} ${H}`, width: totalW, height: H, class: 'staff score' + (narrow ? ' narrow' : '') + (o.cls ? ' ' + o.cls : '') });
  const noteEls = new Map(), xs = new Map();
  const addEl = (i, el) => { if (!noteEls.has(i)) noteEls.set(i, []); noteEls.get(i).push(el); };
  const ties = [], carries = staves.map(st => st.voices.map(() => new Map()));

  for (let L = 0; L < lines; L++) {
    const b0 = L * perLine, b1 = Math.min(bars, b0 + perLine);
    let y = tops[L];
    const marksY = marksAt(L) ? (y += 20) - 6 : null;
    const chordY = hasChords ? (y += chordH) - (hasKo ? 15 : A ? 2 : 4) : null;
    const staffTop = staves.map((st, k) => { y += ext[k].above; const t = y; y += 40 + ext[k].below + (A ? 2 : 8); return t; });
    const left = A ? A.left : left0 + (L === 0 ? TSW : 0);
    let barW = A ? bs * A.stepW : (W - left - 8) / perLine;
    if (!A) barW = Math.min(barW, bs * 44 + 30);
    const endX = left + (b1 - b0) * barW;
    const padOf = b => (rep && b === rep.from && !A ? 12 : 0);
    const X = (b, x) => (A ? A.left + (b * bs + x) * A.stepW + A.stepW / 2 : left + (b - b0) * barW + 12 + padOf(b) + x * ((barW - 18 - padOf(b)) / bs) + 6);
    for (let b = b0; b < b1; b++) xs.set(b, { x0: A ? A.left + b * bs * A.stepW : left + (b - b0) * barW, w: barW, X: x => X(b, x) });
    //  오선 · 음자리표 · 박자표 · 이름
    staves.forEach((st, k) => {
      const top = staffTop[k];
      const lineXs = [A ? 0 : clefX, endX];
      if (st.clef === 'perc1') root.append(svg('line', { x1: lineXs[0], x2: lineXs[1], y1: top + 20, y2: top + 20, class: 'st-line' }));
      else for (let j = 0; j < 5; j++) root.append(svg('line', { x1: lineXs[0], x2: lineXs[1], y1: top + j * LG, y2: top + j * LG, class: 'st-line' }));
      drawClef(root, st, clefX + 2, top);
      if (L === 0) {
        const tx = A ? A.left - 11 : left0 + TSW / 2 - 2;
        root.append(svg('text', { x: tx, y: top + 18, class: 'st-ts', 'text-anchor': 'middle' }, String(score.ts[0])));
        root.append(svg('text', { x: tx, y: top + 38, class: 'st-ts', 'text-anchor': 'middle' }, String(score.ts[1])));
      }
      if (named && st.name) {
        //  작은 이름 줄 — ' · ' 마디로 9글자쯤에서 접는다(이름 칸 너비)
        const subs = []; for (const t of String(st.sub || '').split(' · ').filter(Boolean)) { const l = subs[subs.length - 1]; if (l && (l + ' · ' + t).length <= (narrow ? 6 : 9)) subs[subs.length - 1] = l + ' · ' + t; else subs.push(t); }
        root.append(svg('text', { x: 6, y: top + (subs.length ? 16 : 24), class: 'st-name' }, st.name));
        subs.slice(0, 3).forEach((t, j) => root.append(svg('text', { x: 6, y: top + 29 + j * 11, class: 'st-name sub' }, t)));
      }
    });
    //  가족 묶음(왼쪽 색 막대) · 하프 묶음 · 시스템 앞 세로줄
    if (named) {
      for (let k = 0; k < staves.length;) {
        const f = staves[k].fam; let j = k;
        while (j + 1 < staves.length && staves[j + 1].fam === f) j++;
        if (f) root.append(svg('rect', { x: NW - 9, y: staffTop[k] - 2, width: 4, height: staffTop[j] + 44 - staffTop[k], rx: 2, class: 'st-fam f-' + f }));
        k = j + 1;
      }
      staves.forEach((st, k) => { if (st.brace === 'start' && staves[k + 1]) root.append(svg('path', { d: `M${clefX - 1} ${staffTop[k]} q -7 0 -7 8 V ${(staffTop[k] + staffTop[k + 1] + 40) / 2 - 6} q 0 6 -5 6 q 5 0 5 6 V ${staffTop[k + 1] + 32} q 0 8 7 8`, class: 'st-brace' })); });
    }
    if (staves.length > 1) root.append(svg('line', { x1: A ? 0.6 : clefX, x2: A ? 0.6 : clefX, y1: staffTop[0], y2: staffTop[staves.length - 1] + (staves[staves.length - 1].clef === 'perc1' ? 28 : 40), class: 'st-bar' }));
    //  마디선 · 도돌이표 · 마디 번호
    for (let b = b0; b < b1; b++) {
      const bx = xs.get(b).x0, ex = bx + barW, lastBar = b === bars - 1;
      staves.forEach((st, k) => {
        const top = staffTop[k], y1 = st.clef === 'perc1' ? top + 12 : top, y2 = st.clef === 'perc1' ? top + 28 : top + 40;
        const repEnd = rep && b === rep.to, repStart = rep && b === rep.from && !A;
        if (repEnd || lastBar) {
          root.append(svg('line', { x1: ex - 6, x2: ex - 6, y1, y2, class: 'st-bar' }));
          root.append(svg('line', { x1: ex - 1.5, x2: ex - 1.5, y1, y2, class: 'st-bar end' }));
          if (repEnd) for (const dy of [15, 25]) root.append(svg('circle', { cx: ex - 12, cy: top + dy, r: 2.3, class: 'st-dot st-rdot' }));
        } else root.append(svg('line', { x1: ex, x2: ex, y1, y2, class: 'st-bar' }));
        if (repStart) {
          const sx = bx + 2;
          root.append(svg('line', { x1: sx + 1.5, x2: sx + 1.5, y1, y2, class: 'st-bar end' }));
          root.append(svg('line', { x1: sx + 6, x2: sx + 6, y1, y2, class: 'st-bar' }));
          for (const dy of [15, 25]) root.append(svg('circle', { cx: sx + 12, cy: top + dy, r: 2.3, class: 'st-dot st-rdot' }));
        }
      });
      if (o.barNumbers !== false && (A || b === b0)) root.append(svg('text', { x: bx + (A ? 3 : 2), y: staffTop[0] - ext[0].above + (A ? 9 : 10), class: 'st-num' }, String(b + 1)));
    }
    //  빠르기 · 표시(패턴 글자 · rit.) · 화음 이름
    if (L === 0 && score.tempo) root.append(svg('text', { x: A ? 4 : clefX + 2, y: marksY, class: 'st-tempo' }, `${score.tempo.dotted ? '♩. ' : '♩ '}= ${score.tempo.bpm}`));
    for (const m of score.marks || []) {
      if (m.bar < b0 || m.bar >= b1) continue;
      const mx = xs.get(m.bar).x0 + 4 + (L === 0 && m.bar === b0 && score.tempo ? (A ? 0 : 0) : 0);
      if (m.box) {
        const g = svg('g', { class: 'st-mark box' });
        g.append(svg('rect', { x: mx, y: marksY - 13, width: 18, height: 17, rx: 4, fill: m.color || '#2a1c10' }));
        g.append(svg('text', { x: mx + 9, y: marksY, 'text-anchor': 'middle', class: 'st-markt' }, m.text));
        root.append(g);
      } else root.append(svg('text', { x: mx + (m.dx || 0), y: marksY, class: 'st-mark' + (m.cls ? ' ' + m.cls : '') }, m.text));
    }
    if (hasChords) {
      const cs = score.chords.filter(c => Math.floor(c.s / bs) >= b0 && Math.floor(c.s / bs) < b1);
      cs.forEach((c, j) => {
        const b = Math.floor(c.s / bs), x = X(b, c.s - b * bs) - 9, nx = cs[j + 1] ? X(Math.floor(cs[j + 1].s / bs), cs[j + 1].s - Math.floor(cs[j + 1].s / bs) * bs) - 9 : endX;
        root.append(svg('text', { x, y: chordY, class: 'st-chord' }, c.name));
        if (c.ko && nx - x >= c.ko.length * 9.5 + 4) root.append(svg('text', { x, y: chordY + 13, class: 'st-chordko' }, c.ko));
      });
    }
    //  음표 — 칸마다 · 음성마다 · 마디마다(가락 악보와 같은 붓)
    staves.forEach((st, k) => {
      const P = posFn(st), top = staffTop[k], sg = svg('g', { class: 'st-staff', 'data-staff': st.id || String(k) });
      root.append(sg);
      st.voices.forEach((v, j) => {
        for (let b = b0; b < b1; b++) {
          const items = lay[k][j][b];
          if (!items || !items.length) continue;
          const sw = A ? A.stepW : (barW - 18 - padOf(b)) / bs, labFs = sw < 19 ? 10.5 : sw < 25 ? 11.5 : 0;   // 칸이 좁으면 칸 글자를 작게(옆 글자와 안 겹치게)
          drawBar(sg, items, top, it => X(b, it.x), { song, words: st.words ? st.words : false, addEl, ties, o: { solfege: true, lyrics: false }, carry: carries[k][j], labFs,
            posOf: P, stem: v.stem, acc: !isPerc(st.clef), unison: isPerc(st.clef), restDy: v.restDy || 0, solY: solYs[k] || 30 });
        }
      });
    });
    //  늘임표(곡 끝 '점점 느리게' — 마지막 화음을 길게)
    if (score.fermata) {
      const b = Math.min(bars - 1, Math.floor(score.fermata.s / bs));
      if (b >= b0 && b < b1) {
        const fx = X(b, score.fermata.s - b * bs), fy = staffTop[0] - ext[0].above + 12;
        root.append(svg('path', { d: `M${fx - 9} ${fy + 2} a 9 8 0 0 1 18 0`, class: 'st-fermata' }));
        root.append(svg('circle', { cx: fx, cy: fy - 1, r: 1.9, class: 'st-dot' }));
      }
    }
  }
  drawTies(root, ties);
  return { el: root, noteEls, height: H, width: totalW, perLine, xs };
}
//  음자리표 — 높은음(𝄞) · 낮은음(𝄢) · 북(두 막대) · 작은 8 / 15(옥타브 높게 · 낮게 소리남)
function drawClef(root, st, x, top) {
  if (isPerc(st.clef)) {
    const y = st.clef === 'perc1' ? top + 12 : top + 10, hgt = st.clef === 'perc1' ? 16 : 20;
    root.append(svg('rect', { x: x + 9, y, width: 4, height: hgt, class: 'st-pclef' }));
    root.append(svg('rect', { x: x + 17, y, width: 4, height: hgt, class: 'st-pclef' }));
    return;
  }
  if (st.clef === 'bass') root.append(svg('text', { x, y: top + 30, class: 'st-clef bass' }, '\u{1D122}'));
  else root.append(svg('text', { x, y: top + 33, class: 'st-clef' }, '\u{1D11E}'));
  if (st.oct) {
    const t = String(Math.abs(st.oct) === 2 ? 15 : 8), above = st.oct > 0;
    root.append(svg('text', { x: x + (st.clef === 'bass' ? 10 : 15), y: above ? top - (st.clef === 'bass' ? 5 : 13) : top + (st.clef === 'bass' ? 36 : 56), 'text-anchor': 'middle', class: 'st-oct' }, t));
  }
}
//  안내용 작은 오선 — 칸판 줄 하나가 악보 어디에 적히나(북 자리 · 머리 · 기둥 방향 / 음자리표만)
export function legendStaff({ pos = null, head = 'n', stem = 'up', clef = null, oct = 0, w = 54 } = {}) {
  const top = clef ? 18 : 30, H = clef ? 70 : 86, root = svg('svg', { viewBox: `0 0 ${w} ${H}`, width: w, height: H, class: 'staff mini' });
  for (let j = 0; j < 5; j++) root.append(svg('line', { x1: 2, x2: w - 2, y1: top + j * LG, y2: top + j * LG, class: 'st-line' }));
  if (clef) { drawClef(root, { clef, oct }, 4, top); return root; }
  const cx = w / 2 + 2, yOf = p => top + 40 - p * 5, cy = yOf(pos);
  const el = svg('g', { class: 'st-note' });
  for (let lp = 10; lp <= pos; lp += 2) el.append(svg('line', { x1: cx - 9, x2: cx + 9, y1: yOf(lp), y2: yOf(lp), class: 'st-ledger' }));
  drawHead(el, head, cx, cy, false);
  const sx = stem === 'up' ? cx + 5.8 : cx - 5.8;
  el.append(svg('line', { x1: sx, x2: sx, y1: cy, y2: stem === 'up' ? cy - 17 : cy + 17, class: 'st-stem' }));
  if (head === 'xo') el.append(svg('circle', { cx, cy: cy - 22, r: 3, class: 'st-open' }));
  root.append(el);
  return root;
}
