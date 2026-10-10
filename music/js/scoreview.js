// 악보로 자동 변환 — 화면 조각 [MUSIC-SCORE-1]
//  ① 작곡 '🎼 악보 같이 보기' 띠: 칸 바로 아래 오선(칸과 같은 가로 자리 · 같이 밀림) — 음을 놓고 · 지우고 · 늘이면 바로 바뀌고, ▶ 이면 울리는 음이 빛난다
//  ② 작곡 '악보 보기' 창의 '가락 악보 | 오케스트라 총보' 두 칸(오케스트라가 켜졌을 때)
//  ③ 비트 '🎼 악보' 창: 북 · 가락 · 베이스 오선 + 화음 이름 + 칸판 줄 ↔ 악보 안내 · 인쇄 · ▶ 들으며 보기(울리는 칸이 빛남)
//  모양은 score.js(node 시험) · 그리기는 notation.js renderScore. ?debug=1 이면 window.__score(읽기만 · 시험용)
import { h, modal, toast, svg } from './util.js';
import { renderScore, legendStaff } from './notation.js';
import { melodyScore, orchScore, beatScore, beatLegend, CHORD_LETTER } from './score.js';
import { PRESETS } from './orchestra.js';
import * as C from './beatcore.js';

const DEBUG = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search);
const dbg = (k, v) => { if (DEBUG) { window.__score = window.__score || {}; window.__score[k] = v; } };

// ── ① 작곡 띠 ──
export function scoreStrip() {
  const el = h('div', { class: 'c-strip', 'aria-label': '악보 같이 보기' });
  let res = null, key = '', spans = [], now = new Set(), ph = null, geom = null, hgt = 0, renders = 0;
  //  g = { left 이름 칸 너비, stepW 한 칸 너비, rows [가장 낮은 음, 가장 높은 음] } — 칸판과 같은 가로 자리 · 음 범위로 높이를 정해 음을 놓아도 높이가 그대로
  function render(song, g) {
    const k = JSON.stringify([song.notes.map(n => [n.s, n.d, n.p]), song.harm, song.chords, song.bars, song.beats, song.sub, song.scale, song.key, song.acc, song.orch, song.prog, song.progEvery, song.inst, g]);   // 노랫말 글자는 띠에 안 나옴
    if (k === key && res) return hgt;
    key = k; geom = g; renders++;
    const sc = melodyScore(song);
    res = renderScore(sc, { align: { left: g.left, stepW: g.stepW }, ranges: sc.staves.map(() => g.rows), cls: 'strip' });
    ph = svg('line', { x1: 0, x2: 0, y1: 2, y2: res.height - 2, class: 'st-ph', display: 'none' });
    res.el.append(ph);
    spans = sc.staves.flatMap(st => st.voices.flatMap(v => v.events.map(e => ({ s: e.s, d: e.d, i: e.i }))));
    now = new Set();
    el.replaceChildren(res.el);
    hgt = res.height;
    dbg('strip', () => ({ renders, height: hgt, heads: el.querySelectorAll('.st-head').length, notes: el.querySelectorAll('.st-note').length, now: [...now] }));
    return hgt;
  }
  //  ▶ 따라가기 — step = 지금 칸(소수) · null = 끔
  function highlight(step) {
    if (!res) return;
    const want = new Set();
    if (step != null && step >= 0) for (const sp of spans) if (step >= sp.s && step < sp.s + sp.d) want.add(sp.i);
    for (const i of now) if (!want.has(i)) for (const n of res.noteEls.get(i) || []) n.classList.remove('now');
    for (const i of want) if (!now.has(i)) for (const n of res.noteEls.get(i) || []) n.classList.add('now');
    now = want;
    if (ph) {
      if (step == null || step < 0) ph.setAttribute('display', 'none');
      else { const x = geom.left + step * geom.stepW; ph.setAttribute('x1', x); ph.setAttribute('x2', x); ph.removeAttribute('display'); }
    }
  }
  return { el, render, highlight, height: () => hgt };
}

// ── ② 작곡 '악보 보기' — 가락 악보 | 오케스트라 총보 ──
export function orchNote(sc) {
  const P = PRESETS[sc.preset] || {};
  return h('div', { class: 'scv-note' },
    h('p', {}, h('b', {}, `${P.emoji || '🎻'} ${P.name || '오케스트라'} 총보`), ' — 위에서부터 반짝이 · 목관 · 금관 · 타악기 · 하프 · 가락 · 현악기 화음 · 낮은 현(켜진 칸만). 왼쪽 색 막대 = 악기 가족.'),
    h('p', { class: 'muted' }, '실제로 나는 소리 높이로 적었어요(조옮김 없음). 음자리표 위 작은 8 · 15 = 한 · 두 옥타브 높게, 아래 8 = 한 옥타브 낮게 소리 나요. ',
      '하프는 뜯은 소리가 저절로 울려요(l.v.). 타악기 한 줄: 줄 아래 ● 큰북 · 줄 위 ● 작은북 · × 심벌즈 · △ 트라이앵글 · 빗금 셋 = 굴리기.',
      sc.marks && sc.marks.length ? ' rit. = 점점 느리게 · 마지막 음 위 반달(늘임표) = 길게 늘여요.' : ''));
}
export function scoreTabs(song, melEl, width, melNote) {
  const box = h('div', { class: 'staff-wrap' }, melEl), note = h('div', {}, melNote);
  let cur = melEl, orchEl = null, orchN = null;
  const btns = [['mel', '가락 악보'], ['orch', '🎻 오케스트라 총보']].map(([k, t]) => h('button', { class: k === 'mel' ? 'on' : '', role: 'tab', 'data-tab': k, onclick: () => pick(k) }, t));
  function pick(k) {
    btns.forEach(b => { b.classList.toggle('on', b.dataset.tab === k); b.setAttribute('aria-selected', String(b.dataset.tab === k)); });
    if (k === 'orch' && !orchEl) { const sc = orchScore(song); orchEl = renderScore(sc, { width }).el; orchN = orchNote(sc); dbg('orch', sc); }
    cur = k === 'orch' ? orchEl : melEl;
    box.replaceChildren(cur); note.replaceChildren(k === 'orch' ? orchN : melNote);
    box.scrollTop = 0;
  }
  return { body: h('div', { class: 'scv-tabbox' }, h('div', { class: 'seg scv-tabs', role: 'tablist' }, ...btns), box, note), current: () => cur, pick };
}

// ── 인쇄 — 새 창에 악보(+ 안내) ──
export function printScore(nodes, title) {
  const w = window.open('', '_blank');
  if (!w) { toast('새 창이 막혀 있어요'); return; }
  const css = (document.querySelector('link[href*="music.css"]') || {}).href || new URL('css/music.css', location.href).href;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${String(title || '악보').replace(/</g, '')}</title><link rel="stylesheet" href="${css}"><link href="https://fonts.googleapis.com/css2?family=Noto+Music&display=block" rel="stylesheet"><style>body{background:#fff;color:#000;overflow:auto;padding:24px}h1{font:900 22px 'Noto Sans KR',sans-serif;margin-bottom:12px}.scv-legend{color:#222}.scv-legend .muted{color:#555}</style><h1></h1>`);
  w.document.querySelector('h1').textContent = title || '악보';
  for (const n of [].concat(nodes).filter(Boolean)) w.document.body.append(w.document.importNode(n, true));
  setTimeout(() => w.print(), 600);
}

// ── ③ 비트 악보 창 ──
const POS_TXT = { 1: '아래 첫째 칸', 3: '아래 둘째 칸', 5: '셋째 칸', 8: '맨 윗줄', 9: '오선 바로 위', 10: '오선 위 덧줄' };
const HEAD_TXT = { n: '● 머리', x: '× 머리', xo: '× 위에 o', tri: '△ 머리' };
const GRID_TXT = { 16: '한 칸 = 16분음표 · 네 칸 = 한 박(4분음표) · 4/4 박자', 8: '한 칸 = 8분음표 · 두 칸 = 한 박(4분음표) · 4/4 박자', 32: '두 마디 · 한 칸 = 16분음표 · 네 칸 = 한 박 · 4/4 박자',
  12: '한 칸 = 8분음표 · 세 칸 = 한 박(점4분음표) · 12/8 박자', 9: '한 칸 = 8분음표 · 세 칸 = 한 박(점4분음표) · 9/8 박자' };
function legendEls(b, sc, colors) {
  const L = beatLegend(b), out = [];
  const item = (pic, dot, name, txt) => h('div', { class: 'scv-li' }, pic, h('div', { class: 'scv-lt' }, h('b', {}, dot ? h('i', { class: 'scv-dot', style: { background: dot } }) : null, name), h('span', {}, txt)));
  for (const d of L.drums) out.push(item(legendStaff({ pos: d.pos, head: d.head, stem: d.feet ? 'down' : 'up' }), colors[d.row], d.name, `${POS_TXT[d.pos] || ''} · ${HEAD_TXT[d.head]} · 기둥 ${d.feet ? '아래(발)' : '위(손)'} · ${d.n}번`));
  const mel = sc.staves.find(s => s.id === 'mel'), bass = sc.staves.find(s => s.id === 'bass');
  if (mel) out.push(item(legendStaff({ clef: 'treble', oct: mel.oct }), colors.mel, '가락', `높은음자리표 오선 · 음 아래 글자 = 칸에 적힌 이름${mel.oct ? ` · 작은 ${mel.oct === 2 ? 15 : 8} = ${mel.oct === 2 ? '두' : '한'} 옥타브 높게 소리 나요` : ''}`));
  if (bass) out.push(item(legendStaff({ clef: 'bass', oct: bass.oct }), colors.bass, '베이스', `낮은음자리표 오선(아래 첫 줄 = 솔)${bass.oct ? ' · 작은 8 = 한 옥타브 높게 소리 나요' : ''}`));
  const tips = [];
  if (L.chords.length) tips.push(h('p', {}, h('i', { class: 'scv-dot', style: { background: colors.chord } }), h('b', {}, '화음 '), L.chords.map(k => `${CHORD_LETTER[k]} = ${C.CHORDS[k].full}`).join(' · '), ' — 오선 위 빨간 글자'));
  if (L.strong) tips.push(h('p', {}, h('b', {}, '> '), '= 세게(칸을 두 번 눌러 진하게 한 칸)'));
  tips.push(h('p', {}, h('b', {}, '칸 ↔ 음표 '), GRID_TXT[b.grid] || ''));
  tips.push(h('p', { class: 'muted' }, sc.song ? '이어 붙인 순서대로 — 마디 위 네모 글자 = 패턴' : '‖: :‖ 도돌이표 = 이 마디를 되풀이해요', ' · 쉼표 = 아무것도 안 치는 칸 · 붙임줄 = 박을 넘어 이어지는 음'));
  if (L.fill) tips.push(h('p', { class: 'muted' }, '4번째 반복마다 끝 박을 통 · 짝으로 굴려요(필인 — 악보에는 기본 패턴만 적었어요)'));
  return [h('h4', {}, '칸판 줄 ↔ 악보'), h('div', { class: 'scv-items' }, ...out), h('div', { class: 'scv-tips' }, ...tips)];
}
export function openBeatScore({ getBeat, title = '', who = '', colors = {}, patColors, play, stop, playing, onclose } = {}) {
  //  ▶ 들으며 보기 · 인쇄 = 악보 바로 위(1366×610 에서 악보 + 안내가 창보다 길어 아래 단추를 누르면 악보가 밀려 올라감)
  const info = h('p', {}), playB = h('button', { class: 'btn small primary scv-play', onclick: () => toggle() }, '▶ 들으며 보기');
  const printB = h('button', { class: 'btn small scv-print', onclick: () => printScore([res.el, legend], `${title || '내 비트'} — 악보${who ? ' · ' + who : ''}`) }, '인쇄');
  const head = h('div', { class: 'scv-head' }, info, h('span', { class: 'sp' }), play ? playB : null, printB), wrap = h('div', { class: 'staff-wrap scv-wrap' }), legend = h('div', { class: 'scv-legend' });
  let key = '', res = null, sc = null, timer = 0, startedHere = false, lit = new Set(), byStep = null, draws = 0, closed = false, shownPlaying = false;
  const width = () => Math.max(320, Math.min(1040, innerWidth - 96));
  function draw() {
    const b = getBeat();
    const k = JSON.stringify([C.packBeat(b).pats, b.arr, b.mode, b.cur, b.grid, b.kit, b.lead, b.bpm, b.swing, b.fill, width()]);
    if (k === key) return false;
    key = k; draws++;
    sc = beatScore(b, { patColors });
    res = renderScore(sc, { width: width() });
    wrap.replaceChildren(res.el);
    lit = new Set(); byStep = null;
    info.replaceChildren(h('b', {}, sc.song ? `이어 붙인 순서대로 ${sc.order.map(i => C.LETTERS[i]).join(' ')}` : `패턴 ${C.LETTERS[b.cur]} 되풀이`),
      ` · ${C.GRIDS[b.grid] ? C.GRIDS[b.grid].name : ''} · 빠르기 ${b.bpm}${!sc.song && b.arr.length ? " · 순서 전체는 '이어 붙인 순서대로'를 고르고 열어요" : ''}`);
    legend.replaceChildren(...legendEls(b, sc, colors));
    dbg('beat', () => ({ draws, score: sc, heads: {
      drums: wrap.querySelectorAll('[data-staff="drums"] .st-head, [data-staff="drums"] .st-xhead').length, mel: wrap.querySelectorAll('[data-staff="mel"] .st-head').length,
      bass: wrap.querySelectorAll('[data-staff="bass"] .st-head').length } }));
    return true;
  }
  draw();
  const body = h('div', { class: 'scv-beat' }, head, wrap, legend);
  const close = modal(`🎼 ${title || '내 비트'} — 악보`, body, [{ label: '닫기', primary: true }],
    { wide: true, onclose: () => { closed = true; clearTimeout(timer); if (startedHere && playing && playing()) stop && stop(); onclose && onclose(); } });
  const label = () => { playB.textContent = playing && playing() ? '■ 멈추기' : '▶ 들으며 보기'; };
  function toggle() {
    if (!play) return;
    if (playing && playing()) { stop(); startedHere = false; } else { startedHere = true; play(); }
    setTimeout(label, 60);
  }
  label();
  //  울리는 칸 빛내기 — e = 박자기 칸 사건(pat · step · pos · song) · null = 끔
  function step(e) {
    if (closed || !res) return;
    if (!byStep) {
      byStep = new Map();
      const add = (s, i) => { if (!byStep.has(s)) byStep.set(s, []); byStep.get(s).push(i); };
      for (const st of sc.staves) for (const v of st.voices) for (const ev of v.events) {
        if (st.id === 'drums') add(ev.s, ev.i); else for (let s = ev.s; s < ev.s + ev.d; s++) add(s, ev.i);
      }
    }
    const b = getBeat(), len = C.lenOf(C.gridOf(b.grid));
    let at = -1;
    if (e) { if (sc.song && e.song) at = e.pos * len + e.step; else if (!sc.song && e.pat === sc.order[0]) at = e.step; }
    const want = new Set(at >= 0 ? byStep.get(at) || [] : []);
    for (const i of lit) if (!want.has(i)) for (const n of res.noteEls.get(i) || []) n.classList.remove('now');
    for (const i of want) if (!lit.has(i)) for (const n of res.noteEls.get(i) || []) n.classList.add('now');
    lit = want;
    if (!e || !shownPlaying) { shownPlaying = !!e; label(); }
  }
  return { update() { clearTimeout(timer); timer = setTimeout(() => { if (!closed && body.isConnected) draw(); }, 120); }, step, close, redraw: draw, open: () => !closed && body.isConnected };
}
