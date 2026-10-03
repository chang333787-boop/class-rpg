// 선생님 헷갈림 지도 — 아이 × 판 표(푼 판은 별, 못 푼 판은 답한 수) + 아이마다 무엇이 달랐는지(밝기 · 선명함 · 색깔 …) + 느낌의 색 모자이크(이름과 함께)
//  관리자 비밀번호로 연다(무늬 공방 · 기초 코딩과 같은 방식). 쓰는 것 없음(읽기만).
import { h, toast, modal } from './util.js';
import { ST, CHAPTERS } from './stages.js';
import { mosaicEl } from './feel.js';

export const MISTAKES = { light: '밝기가 다름', chroma: '선명함이 다름', hue: '색깔이 다름', amount: '양 · 비율', pick: '섞기 예상', wheel: '보색 자리', contrast: '보색 대비', sort: '따뜻함 · 차가움', order: '진하기 차례' };
const MK = Object.keys(MISTAKES);
const SCORED = ST.filter(s => s.kind !== 'feel'), FEEL = ST.filter(s => s.kind === 'feel');

async function gate(ctx) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem('paint.teacher') === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem('paint.teacher', '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('물감 연구소 · 헷갈림 지도', { back: '#/' }), h('div', { class: 'view' }, box));
  const { progress, stats, names, feel = {} } = await ctx.store.all();
  const kids = [...new Set([...Object.keys(progress), ...Object.keys(stats)])].filter(k => k !== 'teacher')
    .sort((a, z) => String(names[a] || a).localeCompare(String(names[z] || z), 'ko'));
  const feelSec = () => h('div', { class: 'tfeel' }, h('h3', {}, '느낌의 색 — 우리 반 모자이크'),
    ...FEEL.map(s => h('div', { class: 'tfeel-one' }, h('b', {}, `${s.id} ${s.title}`), mosaicEl(feel[s.id] || {}, names, { showNames: true }))),
    h('p', { class: 'muted small' }, '정답이 없는 판이에요. 같은 장면을 왜 다른 색으로 느꼈는지 — 고른 까닭 칩(밝아서 · 따뜻해서 …)으로 이야기 나누기 좋아요.'));
  if (!kids.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 풀지 않았어요.'), feelSec()); return { unmount() {} }; }
  const st = (k, s) => ((stats[k] || {})[s.id]) || {}, pg = (k, s) => (progress[k] || {})[s.id];
  const mkOf = k => { const o = {}; SCORED.forEach(s => MK.forEach(m => { o[m] = (o[m] || 0) + (st(k, s)[m] || 0); })); return o; };
  const topMk = o => Object.entries(o).filter(([, n]) => n).sort((a, z) => z[1] - a[1]);
  const all = {}; kids.forEach(k => Object.entries(mkOf(k)).forEach(([m, n]) => { all[m] = (all[m] || 0) + n; }));
  const cls = topMk(all).slice(0, 4);
  const cell = (k, s) => {
    const r = pg(k, s), t = st(k, s);
    const sw = r && typeof r.c === 'string' ? h('span', { class: 'tsw', style: { background: r.c } }) : null;
    return h('td', { class: 'c ' + (r ? 'ok' : t.tries ? 'try' : 'none'), title: `${names[k] || k} · ${s.id} ${s.title}`, onclick: () => detail(k, s) },
      r ? (s.kind === 'feel' ? '✓' : '★'.repeat(r.st)) : t.tries ? String(t.tries) : '·', sw);
  };
  function detail(k, s) {
    const t = st(k, s), r = pg(k, s);
    const made = r && r.c ? (Array.isArray(r.c) ? r.c : [r.c]) : [];
    modal(`${names[k] || k} · ${s.id} ${s.title}`, h('div', {},
      h('p', {}, r ? (s.kind === 'feel' ? '붙였어요' : `풀었어요 · ${'★'.repeat(r.st)} · 틀린 답 ${r.n}번`) : `아직 못 풀었어요 · 답한 수 ${t.tries || 0}`),
      made.length ? h('div', { class: 'tmade' }, h('span', { class: 'muted small' }, '만든 색'), ...made.map(c => h('span', { class: 'tsw big', style: { background: c } }))) : null,
      h('p', { class: 'muted' }, MK.filter(m => t[m]).map(m => `${MISTAKES[m]} ${t[m]}`).join(' · ') || '헷갈림 기록 없음')));
  }
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 푼 판(별 수 · 옆 동그라미 = 아이가 만든 색) · 숫자 = 아직 못 푼 판에 답한 수 · ✓ = 느낌의 색을 붙임. 오른쪽 끝 = 그 아이가 가장 많이 헷갈린 것.`),
    cls.length ? h('div', { class: 'hard' }, h('b', {}, '우리 반이 많이 헷갈린 것'), ...cls.map(([m, n]) => h('span', {}, `${MISTAKES[m]} ${n}번`))) : null,
    h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {},
        h('tr', {}, h('th', { rowspan: 2 }, '이름'), ...CHAPTERS.map(c => h('th', { colspan: ST.filter(s => s.ch === c.id).length, class: 'u' }, `${c.id}장 ${c.title}`)), h('th', { rowspan: 2 }, '많이 헷갈린 것')),
        h('tr', {}, ...ST.map(s => h('th', { title: s.title }, s.id)))),
      h('tbody', {}, ...kids.map(k => { const top = topMk(mkOf(k))[0]; return h('tr', {}, h('td', { class: 'nm' }, names[k] || k), ...ST.map(s => cell(k, s)), h('td', { class: 'mk' }, top ? `${MISTAKES[top[0]]} ${top[1]}` : '—')); })))),
    h('p', { class: 'muted small', style: { margin: '8px 2px 0' } }, '밝기가 다름 = 흰색 · 검정 양 · 선명함이 다름 = 섞은 가짓수(보색 · 흰색 · 검정) · 색깔이 다름 = 두 색의 비율. 숫자는 그 판에서 ‘이 색으로 할래요’를 눌렀다가 안 맞은 횟수예요.'),
    feelSec(),
  ].filter(Boolean));
  return { unmount() {} };
}
