// 조형 요소 찾기 — 카드 열둘(선 · 색 · 명암 · 양감 · 질감) · 카드마다 그림 세 점에서 그 요소를 찾아 짚는다.
//  짚으면 돋보기가 그 자리를 잰다(elements.js — 그림을 긴 변 480점으로 줄여 칸마다): 찾는 요소가 그 칸(이나 바로 둘레 칸)에 있으면 찾음.
//  틀려도 그 자리에 무엇이 있는지 재어 보여 준다(선 방향 · 밝기 · 따뜻함 · 차가움 · 선명함 · 거칠기 · 명암 변화).
//  [UX-TRIM-G4] 아이 화면엔 숫자(° · %) 대신 쉬운 말('거의 수평인 선 — 아주 뚜렷해요' · 막대 옆 '조금 · 꽤 · 아주').
//  셋 다 찾으면 '그 요소가 주는 느낌'을 고르고 우리 반 셈을 본다 — [4미02-03] 조형 요소의 특징 탐색 · 주제 표현에 알맞게 활용.
import { h } from './util.js';
import { makeViewer } from './viewer.js';
import { caseById } from './cases.js';
import { ELEMENTS, FAMS, EFEELS, elementOf, measure, findAt, bestOf, countOf, topLabels, cellRect, LONG, lineOf, dirZone, lineSeen, whyNot } from './elements.js';
import { HOST, starsOf } from './play.js';

// 카드마다 그림 세 점(쉬운 것부터) — 그 요소가 뚜렷한 그림만 골랐다(명화 탐정 그림 스물여섯 가운데 · 재어서 고름)
export const MISSIONS = {
  horiz: ['sloop_nassau', 'impression', 'blue_boat'], vert: ['turf', 'bedroom', 'alligators'], diag: ['praying_hands', 'inwang', 'great_wave'], curve: ['great_wave', 'rhinoceros', 'mudong'],
  warm: ['bedroom', 'childrens_games', 'grande_jatte'], cool: ['great_wave', 'blue_boat', 'sloop_nassau'], vivid: ['bedroom', 'grande_jatte', 'chochungdo'],
  bright: ['alligators', 'sloop_nassau', 'blue_rigi'], dark: ['aman_jean', 'hunters_snow', 'inwang'], shade: ['aman_jean', 'hare', 'blue_rigi'],
  rough: ['hare', 'alligators', 'rhinoceros'], smooth: ['blue_rigi', 'hare', 'impression'],
};
const FEEL_WORD = Object.fromEntries(EFEELS);
//  조사 — 괄호 앞 낱말의 받침으로(‘양감(도톰한 명암)’ → 양감 → 을)
const jo = (w, a, b) => { const base = String(w).replace(/\([^)]*\)$/, ''), c = base.charCodeAt(base.length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b); };
const pct = v => Math.round(Math.max(0, Math.min(1, v)) * 100);
const parseF = f => String(f || '').split('|').filter(Boolean).map(s => { const [c, x, y] = s.split(':'); return { c, x: +x, y: +y }; });
const fStr = list => list.map(o => `${o.c}:${o.x}:${o.y}`).join('|');
//  [UX-TRIM-G4] 잰 값 → 쉬운 말(셈은 그대로 · 보여 주는 말만)
//  [UX-TRIM-G4b] 말 구간을 판정(elements.js labelsOf)의 문턱에서 그대로 가져온다 — '이 선은 사선이에요 — 사선을 찾아요' 같은 모순이 없게.
//   선 방향 = dirZone(가로 ≤17° · 사선 25~65° · 세로 ≥73° · 그 사이는 어느 카드도 아님) · 뚜렷함 = lineOf(이름표 문턱 0.5)
//   '조금' 끝 = 0.32 — 선명한 색 문턱(0.325)보다 아래라, 찾은 칸은 늘 '꽤 · 아주'
const DIRW = { horiz: ['가로선', '조금 기운 가로선'], vert: ['세로선', '조금 기운 세로선'], diag: ['사선', '조금 치우친 사선'] };
export const lineWord = ang => { const z = dirZone(ang); return z.k ? DIRW[z.k][z.full ? 0 : 1] : z.near === 'horiz' ? '가로선과 사선 사이로 기운 선' : '세로선과 사선 사이로 기운 선'; };
const clearOf = c => { const v = lineOf(c); return v >= 0.85 ? '아주 뚜렷해요' : v >= 0.5 ? '뚜렷해요' : '흐릿해요'; };
const amt = v => (v < 0.1 ? '거의 없어요' : v < 0.32 ? '조금' : v < 0.65 ? '꽤' : '아주');
const lightWord = L => (L >= 80 ? '아주 밝아요' : L >= 60 ? '밝은 편이에요' : L >= 40 ? '중간 밝기예요' : L >= 20 ? '어두운 편이에요' : '아주 어두워요');
const much = (v, what) => `${what} ${v < 0.1 ? '거의 없어요' : v < 0.32 ? '조금 있어요' : v < 0.65 ? '꽤 많아요' : '아주 많아요'}`;
//  돋보기 '선' 줄
export const lensLine = c => (lineSeen(c) ? `${lineWord(c.ang)} — ${clearOf(c)}` : '뚜렷한 선 없음');
//  찾았을 때 — 돋보기가 잰 증거 한 줄(+ 그곳에 함께 있는 다른 요소)
export function proofText(k, cell) {
  const E = elementOf(k), r4 = cell.roughM / 4;
  const ev = { horiz: '선이 ' + clearOf(cell), vert: '선이 ' + clearOf(cell), diag: '선이 ' + clearOf(cell), curve: '선 방향이 조금씩 바뀌어요', warm: much(cell.warmM, '따뜻한 색이'), cool: much(cell.coolM, '차가운 색이'),
    vivid: much(cell.vivM, '또렷한 색이'), bright: lightWord(cell.L), dark: lightWord(cell.L), shade: `밝음에서 어둠으로 ${cell.shade >= 0.8 ? '아주 ' : ''}부드럽게 바뀌어요`,
    rough: much(r4, '자잘한 자국이'), smooth: r4 < 0.1 ? '자국이 거의 없고 고르게 칠했어요' : '자국이 적고 고른 편이에요' }[k];
  const more = topLabels(cell, 3).filter(x => x.k !== k).map(x => elementOf(x.k).name);
  return `돋보기로 재어 보니 ${jo(E.name, '이에요', '예요')} — ${ev}.${more.length ? ` 이곳에는 ${more.join(' · ')}도 있어요.` : ''}`;
}
//  틀렸을 때 — 무엇이 달랐는지(잰 값 · 판정과 같은 까닭으로 — whyNot)
export function whyText(F, k, cell) {
  const E = elementOf(k), labs = topLabels(cell, 3).map(x => elementOf(x.k).name), here = labs.length ? `여기는 ${labs.join(' · ')}` : '여기는 뚜렷한 요소가 없는 곳';
  const w = whyNot(F, cell, k) || 'abs', r4 = cell.roughM / 4, z = dirZone(cell.ang);
  const SEEK = { horiz: '판판하게 누운 선을 찾아요', vert: '곧게 선 선을 찾아요', diag: '비스듬히 기운 선을 찾아요' };
  const TILT = { horiz: '더 판판하게 누운 가로선을 찾아요', vert: '더 곧게 선 세로선을 찾아요', diag: '더 비스듬한 사선을 찾아요' };
  const lineTip = () => (w === 'noline' ? '선이 뚜렷한 곳에서 찾아요'
    : w === 'weak' ? `선이 흐릿해요 — 더 뚜렷한 ${jo(E.name, '을', '를')} 찾아요`
    : w === 'tilt' ? `이 선은 ${lineWord(cell.ang)}이에요 — ${TILT[k]}`
    : `이 선은 ${lineWord(cell.ang)}이에요 — ${!z.k && (z.near === k || k === 'diag') ? '더 ' : { horiz: '옆으로 ', vert: '위아래로 ', diag: '' }[k]}${SEEK[k]}`);
  const tip = {
    horiz: lineTip, vert: lineTip, diag: lineTip,
    curve: () => (lineSeen(cell) ? '방향이 조금씩 바뀌며 휘는 선을 찾아요(곧은 선이나 확 꺾인 모서리는 아니에요)' : '선이 뚜렷한 곳에서 찾아요'),
    warm: () => `${much(cell.warmM, '따뜻한 색이')} — 빨강 · 주황 · 노랑이 더 짙은 곳을 찾아요`, cool: () => `${much(cell.coolM, '차가운 색이')} — 청록 · 파랑이 더 짙은 곳을 찾아요`,
    vivid: () => `${much(cell.vivM, '또렷한 색이')} — 회색이 덜 섞인 또렷한 색을 찾아요`,
    bright: () => `${lightWord(cell.L)} — ${w === 'rel' ? '이 그림에는 더 환한 곳이 많아요. 그곳을 찾아요' : '더 환한 곳을 찾아요'}`,
    dark: () => `${lightWord(cell.L)} — ${w === 'rel' ? '이 그림에는 더 어두운 곳이 많아요. 그곳을 찾아요' : '더 어두운 곳을 찾아요'}`,
    shade: () => '밝음에서 어둠으로 차츰 바뀌는 둥근 곳을 찾아요(날카로운 경계는 아니에요)',
    rough: () => `${much(r4, '자잘한 자국이')} — ${w === 'rel' ? '이 그림에는 자국이 더 많은 곳이 있어요. 그곳을 찾아요' : '자국이 더 많은 곳을 찾아요'}`,
    smooth: () => (w === 'edge' ? '밝기가 확 바뀌는 경계가 있어요 — 고르게 칠한 곳을 찾아요'
      : w === 'rel' ? '자국이 적은 편이에요 — 이 그림에는 더 매끈한 곳이 있어요. 그곳을 찾아요'
      : `${much(r4, '자잘한 자국이')} — 자국 없이 고른 곳을 찾아요`),
  }[k]();
  return `${here}${labs.length ? jo(labs[labs.length - 1], '이에요', '예요').slice(labs[labs.length - 1].length) : '이에요'}. ${tip}`;
}

// ── 첫 화면 — 갈래마다 카드 ──
export async function mountHuntHome(root, ctx) {
  let prog = {};
  try { prog = await Promise.race([ctx.store.elemProgress(), new Promise(r => setTimeout(() => r({}), 4000))]); } catch (e) { console.warn(e); }
  const done = ELEMENTS.filter(e => (prog[e.k] || {}).st).length;
  const card = e => {
    const p = prog[e.k] || {}, n = parseF(p.f).length;
    return h('button', { class: 'ecard' + (p.st ? ' done' : ''), 'data-e': e.k, onclick: () => ctx.go('#/e/' + e.k) },
      h('span', { class: 'e-icon' }, e.icon), h('b', {}, e.name), h('span', { class: 'e-desc' }, e.desc),
      h('span', { class: 'e-dots' }, ...MISSIONS[e.k].map((_, i) => h('i', { class: i < n ? 'on' : '' }))),
      h('span', { class: 'stars' }, p.st ? '★'.repeat(p.st) + '☆'.repeat(3 - p.st) : n ? `${n} / 3` : '🔍 찾기'));
  };
  root.replaceChildren(
    ctx.topBar('조형 요소 찾기', { back: '#/' }),
    h('div', { class: 'view' }, h('div', { class: 'home hunt-home' },
      h('div', { class: 'intro' }, h('img', { class: 'host', src: HOST, alt: '' }),
        h('div', { class: 'intro-t' }, h('h2', {}, '그림 속 선 · 색 · 명암 · 질감 찾기'),
          h('p', {}, '카드를 고르고, 그림에서 그 요소를 찾아 짚어요. 짚으면 돋보기가 그 자리를 재어 알려 줘요 — 선이 어느 쪽으로 기울었는지, 얼마나 밝은지, 따뜻한 색인지. 카드마다 그림 세 점에서 찾으면 모여요.')),
        h('div', { class: 'mine' }, h('b', {}, `${done} / ${ELEMENTS.length}`), h('span', {}, '모은 카드'))),
      ...FAMS.map(([fk, fn]) => h('div', { class: 'ccard' }, h('div', { class: 'c-head' }, h('b', {}, fn)),
        h('div', { class: 'egrid' }, ...ELEMENTS.filter(e => e.fam === fk).map(card)))),
      h('p', { class: 'muted small foot' }, '그림을 이루는 것에는 선 · 모양 · 색 · 질감 · 양감이 있어요. 모양은 무늬 공방 · 데생 기초에서 다뤄요. 돋보기는 그림을 작게 줄여 재기 때문에 아주 작은 것은 못 잴 수 있어요.'))));   // [UX-TRIM-G4] 성취기준 번호는 선생님 화면(#/t)
  return { unmount() {} };
}

// ── 카드 하나 — 그림 세 점에서 찾기 → 느낌 ──
export async function mountHunt(root, ctx, k) {
  const E = elementOf(k), list = MISSIONS[k].map(caseById), me = ctx.store.me.sid;
  let prog = {};
  try { prog = (await Promise.race([ctx.store.elemProgress(), new Promise(r => setTimeout(() => r({}), 4000))]))[k] || {}; } catch (e) { console.warn(e); }
  let found = parseF(prog.f).slice(0, 3), miss = 0, hints = 0, missSince = 0, alive = true, idx = Math.min(found.length, 2), F = null, viewer = null, tapCell = null, hintCell = null, feelDone = false, board = null;
  const fPick = new Set();
  const msg = h('div', { class: 'msg' }), say = (t, c = '') => { msg.textContent = t; msg.className = 'msg ' + c; };
  const cv = h('section', { class: 'cv' }), body = h('div', { class: 'cp-body' }), footNext = h('span', { class: 'foot-next' });
  const hintBtn = h('button', { class: 'btn small hint', 'data-act': 'hint', onclick: () => showHint() }, '💡 힌트'); hintBtn.style.display = 'none';
  root.replaceChildren(ctx.topBar(`${E.icon} ${E.name} 찾기`, { back: '#/e' }),
    h('div', { class: 'case' }, cv, h('section', { class: 'cp' }, body, h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), hintBtn, footNext))));
  const allFound = () => found.length >= list.length;

  async function openPainting(i) {
    idx = i; F = null; tapCell = null; hintCell = null; missSince = 0; hintBtn.style.display = 'none';
    if (viewer) viewer.destroy();
    const c = list[i];
    viewer = makeViewer({ src: `img/${c.img}.webp`, w: c.w, h: c.h, alt: `${c.artist} 「${c.title}」`, onTap: t => onTap(t) });
    cv.replaceChildren(viewer.el);
    render(); say('돋보기를 준비하는 중…');
    try { const px = await viewer.small(LONG); if (!alive) return; F = measure(px.data, px.w, px.h); } catch (e) { console.warn(e); say('그림을 재지 못했어요 — 다시 열어 봐요', 'bad'); return; }
    paint(); render();
    say(found[i] ? '여기서는 벌써 찾았어요. 그림을 짚어 다른 곳도 재어 봐요.' : `「${c.title}」에서 ${jo(E.name, '을', '를')} 찾아 짚어요.`);
  }
  function paint() {
    if (!viewer) return;
    const marks = [], c = list[idx], f = found[idx];
    if (f) marks.push({ r: [f.x - 3, f.y - 3, f.x + 3, f.y + 3], kind: 'found', label: '✓ ' + E.name });
    if (tapCell && F) marks.push({ r: cellRect(F, tapCell), kind: 'region' });
    if (hintCell && F && !f) { const r = cellRect(F, hintCell), cx = (r[0] + r[2]) / 2 + 2, cy = (r[1] + r[3]) / 2 - 1.5, rx = 9, ry = rx * c.w / c.h; marks.push({ r: [cx - rx, cy - ry, cx + rx, cy + ry], kind: 'hint' }); }
    viewer.setMarks(marks);
  }
  // 돋보기 — 칸 하나에서 잰 것
  function lens(cell, ok) {
    const labs = topLabels(cell, 4), line = lineSeen(cell), a = Math.round(cell.ang), NS = 'http://www.w3.org/2000/svg';
    const arrow = document.createElementNS(NS, 'svg'); arrow.setAttribute('viewBox', '-12 -12 24 24'); arrow.setAttribute('class', 'l-arrow');
    const r = a * Math.PI / 180; arrow.innerHTML = line ? `<line x1="${-9 * Math.cos(r)}" y1="${-9 * Math.sin(r)}" x2="${9 * Math.cos(r)}" y2="${9 * Math.sin(r)}"/>` : '<circle r="3"/>';
    const bar = (name, v, cls = '') => h('div', { class: 'l-row' }, h('span', {}, name), h('span', { class: 'l-bar ' + cls }, h('i', { style: { width: pct(v) + '%' } })), h('b', {}, v < 0.1 ? '없음' : amt(v)));
    return h('div', { class: 'lens' + (ok ? ' ok' : '') },
      h('div', { class: 'l-head' }, h('b', {}, '🔍 돋보기'), h('span', { class: 'l-chips' }, ...(labs.length ? labs.map(x => h('span', { class: 'l-chip' + (x.k === k ? ' on' : '') }, elementOf(x.k).name)) : [h('span', { class: 'muted small' }, '뚜렷한 요소가 없는 곳')]))),
      h('div', { class: 'l-row' }, h('span', {}, '선'), arrow, h('b', { class: 'l-line' }, lensLine(cell))),
      h('div', { class: 'l-row' }, h('span', {}, '색'), h('i', { class: 'l-sw', style: { background: `rgb(${cell.rgb.join(',')})` } }), h('b', {}, lightWord(cell.L))),
      bar('따뜻함', cell.warmM, 'warm'), bar('차가움', cell.coolM, 'cool'), bar('선명함', cell.vivM, 'vivid'),
      bar('거칠기', cell.roughM / 4, 'rough'), bar('명암 변화', cell.shade, 'shade'));
  }
  //  [UX-TRIM-G4b] 찾았을 때 · 틀렸을 때 말은 위(모듈)에서 — 시험(cases.test.mjs)이 판정과 견준다
  const proof = cell => proofText(k, cell), why = cell => whyText(F, k, cell);
  async function onTap({ x, y }) {
    if (!F) { say('돋보기를 준비하는 중이에요 — 잠깐만요.'); return; }
    const r = findAt(F, x, y, k);
    tapCell = r.cell;
    if (allFound() || found[idx]) { viewer.ripple(x, y, r.ok ? 'good' : ''); paint(); render(r.cell, r.ok); say(r.ok ? `여기도 ${jo(E.name, '이', '가')} 있어요 — ${proof(r.cell)}` : why(r.cell)); return; }
    if (r.ok) {
      const rc = cellRect(F, r.cell), spot = { c: list[idx].id, x: Math.round((rc[0] + rc[2]) / 2 * 10) / 10, y: Math.round((rc[1] + rc[3]) / 2 * 10) / 10 };
      found[idx] = spot; missSince = 0; hintCell = null; hintBtn.style.display = 'none';
      viewer.ripple(x, y, 'good'); ctx.store.elemTap(k, 'ok').catch(e => console.warn(e));
      const st = allFound() ? starsOf(miss, hints) : 0;
      try { await ctx.store.elemSave(k, { f: fStr(found), n: miss, h: hints, ...(st ? { st: Math.max(st, prog.st || 0) } : prog.st ? { st: prog.st } : {}) }); } catch (e) { console.warn(e); }
      if (!alive) return;
      paint(); render(r.cell, true);
      say(allFound() ? `찾았어요! 세 그림에서 모두 ${jo(E.name, '을', '를')} 찾았어요 — 이제 느낌을 골라요.` : `찾았어요! ${proof(r.cell)}`, 'good');
      return;
    }
    miss++; missSince++;
    const other = topLabels(r.cell, 1)[0];
    viewer.ripple(x, y, 'bad'); ctx.store.elemTap(k, other ? 'x_' + other.k : 'miss').catch(e => console.warn(e));
    if (missSince >= 2) hintBtn.style.display = '';
    paint(); render(r.cell, false); say(why(r.cell), 'bad');
  }
  function showHint() {
    if (!F) return;
    const b = bestOf(F, k, 1)[0]; if (!b) return;
    hintCell = b; hints++; missSince = 0; hintBtn.style.display = 'none'; ctx.store.elemTap(k, 'hint').catch(e => console.warn(e));
    const r = cellRect(F, b); viewer.zoomTo([r[0] - 10, r[1] - 10, r[2] + 10, r[3] + 10], 2.2); paint();
    say(`💡 점선 동그라미 둘레에 ${jo(E.name, '이', '가')} 있어요.`);
  }
  function render(cell = null, ok = false) {
    const c = list[idx];
    const parts = [
      h('div', { class: 'e-card-head' }, h('span', { class: 'e-icon big' }, E.icon), h('div', {}, h('b', {}, E.name), h('p', { class: 'small' }, E.desc))),
      h('div', { class: 'e-missions' }, ...list.map((m, i) => h('button', { class: 'e-mis' + (i === idx ? ' on' : '') + (found[i] ? ' done' : ''), 'data-m': i, disabled: i > found.length && !found[i], onclick: () => openPainting(i) },
        h('span', { class: 'thumb' }, h('img', { src: `img/thumb/${m.img}.webp`, alt: '' })), h('span', { class: 'small' }, found[i] ? '✓ ' + m.title : m.title)))),
      found[idx] ? null : h('p', { class: 'q' }, `「${c.title}」에서 ${jo(E.name, '을', '를')} 찾아 짚어요.`),
      cell ? lens(cell, ok) : h('p', { class: 'lead' }, '그림을 짚으면 돋보기가 그 자리를 재어 보여 줘요. ＋ · 휠 · 두 손가락으로 크게 볼 수 있어요.'),
    ];
    if (allFound()) parts.push(feelPart());
    body.replaceChildren(...parts.filter(Boolean));
    const nextI = list.findIndex((_, i) => !found[i]);
    footNext.replaceChildren(...(found[idx] && nextI >= 0 ? [h('button', { class: 'btn primary', 'data-act': 'next', onclick: () => openPainting(nextI) }, '다음 그림 →')]
      : allFound() && feelDone ? [h('button', { class: 'btn primary', 'data-act': 'home', onclick: () => ctx.go('#/e') }, '다른 카드 →')] : []));
  }
  //  느낌 — 둘까지 · 우리 반 셈 · 흔히 그렇다고 하는 느낌
  function feelPart() {
    const tally = {}; for (const v of Object.values((board || {}).feel || {})) for (const f of String((v || {}).f || '').split(',').filter(Boolean)) tally[f] = (tally[f] || 0) + 1;
    const mine = (((board || {}).feel || {})[me] || {}).f || '';
    const list2 = Object.entries(tally).sort((a, z) => z[1] - a[1]), max = Math.max(1, ...list2.map(x => x[1]));
    return h('div', { class: 'e-feel' },
      h('p', { class: 'q' }, `${jo(E.name, '은', '는')} 어떤 느낌을 줄까요? (둘까지)`),
      h('div', { class: 'chips' }, ...EFEELS.map(([fk, fn]) => h('button', { class: 'wchip' + (fPick.has(fk) ? ' on' : ''), 'data-f': fk, onclick: () => { if (fPick.has(fk)) fPick.delete(fk); else if (fPick.size < 2) fPick.add(fk); render(tapCell, false); } }, fn))),
      h('div', { class: 'go-row' }, h('span', { class: 'sp' }), h('button', { class: 'btn primary', 'data-act': 'feel', disabled: !fPick.size, onclick: async () => {
        try { await ctx.store.elemFeel(k, [...fPick].join(',')); board = await ctx.store.elemBoard(k); } catch (e) { console.warn(e); say('저장하지 못했어요 — 인터넷을 확인하고 다시 눌러요', 'bad'); return; }
        if (!alive) return;
        feelDone = true; say(`카드를 모았어요! ${E.icon} ${E.name}`, 'good'); render(tapCell, false);
      } }, mine ? '느낌 다시 붙이기' : '느낌 붙이기')),
      feelDone || mine ? h('div', { class: 'tally' }, h('b', {}, '우리 반이 고른 느낌'),
        list2.length ? h('div', { class: 'bars' }, ...list2.slice(0, 6).map(([fk, n]) => h('div', { class: 'bar' + (mine.split(',').includes(fk) ? ' me' : '') }, h('span', { class: 'bl' }, FEEL_WORD[fk] || fk), h('span', { class: 'bb' }, h('i', { style: { width: 100 * n / max + '%' } })), h('b', {}, n + '명')))) : null,
        h('p', { class: 'small' }, `${jo(E.name, '은', '는')} 흔히 ${E.feel.map(f => FEEL_WORD[f]).join(' · ')} 느낌을 준다고 해요. 그림을 그릴 때 이 느낌이 필요하면 ${jo(E.name, '을', '를')} 써 봐요.`),
        ctx.store.me.guest ? h('p', { class: 'muted small' }, '학급 RPG에서 열면 우리 반 친구들의 느낌도 함께 보여요.') : null) : null);
  }

  try { board = await ctx.store.elemBoard(k); feelDone = !!((board.feel || {})[me]); } catch (e) { console.warn(e); }
  if (!alive) return { unmount() {} };
  await openPainting(allFound() ? 0 : found.length);
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__hunt = { k, list: list.map(c => c.id), F: () => F, idx: () => idx, found: () => found.slice(), state: () => ({ miss, hints, feelDone, msg: msg.textContent }), best: n => (F ? bestOf(F, k, n).map(c => cellRect(F, c)) : []), count: () => (F ? countOf(F, k) : -1) };
  return { unmount() { alive = false; if (viewer) viewer.destroy(); } };
}
