// 선생님 탐정 기록 — 아이 × 그림 표(해결 별 · 헛짚음) + 질문 사다리(아이마다 질문 갈래) + 그림마다 생각 · 느낌 셈 · 질문판(이름과 함께 · 내리기)
//  + 조형 요소 찾기(아이 × 카드 · 찾다가 다른 요소를 짚은 헷갈림 · 요소마다 고른 느낌)
//  관리자 비밀번호로 연다(물감 연구소 · 무늬 공방과 같은 방식). 쓰는 것 = 질문 내리기 하나뿐.
import { h, toast, modal } from './util.js';
import { teacherGate } from '../../common/teacher-gate.js';
import { CASES, FEELS, BECAUSE } from './cases.js';
import { kindOf, questionText, LEVELS } from './ask.js';
import { ELEMENTS, EFEELS, elementOf } from './elements.js';
//  [UX-TRIM-G4] 성취기준 · 교과 근거 — 아이 첫 화면 바닥글에서 선생님 화면으로 옮겼다(아이 화면엔 쉬운 말 한 줄)
const STD = '3~4학년 미술 감상 [4미03-01] 미술 작품을 자세히 보고 작품과 미술가에 관해 질문할 수 있다 · [4미03-02] 미술 작품의 특징과 작품에 관한 자신의 느낌과 생각을 설명할 수 있다 · 조형 요소 찾기 = [4미02-03] 조형 요소(선 · 형과 형태 · 색 · 질감 · 양감)의 특징 탐색.';

const FEEL_WORD = Object.fromEntries(FEELS), BEC_WORD = Object.fromEntries(BECAUSE);

// 선생님 화면 문 — 손님 · 이 창에서 통과('art.teacher') · 아니면 관리자 비밀번호(하위 앱 공통 common/teacher-gate.js) [SUBAPP-COMMON-1]
function gate(ctx) { return teacherGate(ctx, 'art.teacher'); }
const count = (obj, key) => { const cnt = {}; for (const v of Object.values(obj || {})) for (const k of String((v || {})[key] || '').split(',').filter(Boolean)) cnt[k] = (cnt[k] || 0) + 1; return Object.entries(cnt).sort((a, z) => z[1] - a[1]); };

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('명화 탐정 · 탐정 기록', { back: '#/' }), h('div', { class: 'view' }, h('p', { class: 'muted small std', style: { margin: '12px 18px 0' } }, STD), box));
  const { progress, stats, names: names0, think, feel, ask, like } = await ctx.store.all();
  let EL = { elem: {}, estats: {}, efeel: {}, names: {} };
  try { EL = await ctx.store.elemAll(); } catch (e) { console.warn(e); }
  const names = { ...EL.names, ...names0 };
  const kids = [...new Set([...Object.keys(progress), ...Object.keys(stats), ...Object.values(ask).flatMap(a => Object.values(a || {}).map(q => q.s))])].filter(k => k && k !== 'teacher')
    .sort((a, z) => String(names[a] || a).localeCompare(String(names[z] || z), 'ko'));
  const nm = k => names[k] || k;
  // 질문 사다리 — 아이마다 갈래별 질문 수
  const ladder = {};
  for (const c of CASES) for (const q of Object.values(ask[c.id] || {})) { const kd = kindOf(q.k); if (!kd) continue; const l = ladder[q.s] = ladder[q.s] || { 1: 0, 2: 0, 3: 0, 4: 0 }; l[kd.level]++; }
  const cell = (k, c) => {
    const p = (progress[k] || {})[c.id], s = (stats[k] || {})[c.id] || {};
    return h('td', { class: 'c ' + (p ? 'ok' : s.tries ? 'try' : 'none'), title: `${nm(k)} · ${c.title}${s.miss ? ` · 헛짚음 ${s.miss}` : ''}${s.hint ? ` · 힌트 ${s.hint}` : ''}` }, p ? '★'.repeat(p.st) : s.tries ? `${s.miss || 0}` : '·');
  };
  const casePanel = c => {
    const qs = Object.entries(ask[c.id] || {}).map(([id, q]) => ({ id, ...q, likes: Object.keys((like[c.id] || {})[id] || {}).length })).filter(q => kindOf(q.k) && c.parts[q.p]).sort((a, z) => z.likes - a.likes || a.t - z.t);
    const t = c.think, thinkWord = k => (t.mode === 'evidence' || t.mode === 'gray' || t.mode === 'mirror') ? ((t.opts[+k] || {}).t || t.opts[+k] || k)
      : t.mode === 'order' ? String(k).split(',').map(i => (t.spots[+i] || [])[0] || '?').join(' → ')   // 아이가 짚은 진한 차례
      : t.mode === 'how' ? (k === 'right' ? '붓 자국을 첫눈에 알아봄' : '한 번 더 보고 알아봄')
      : t.mode === 'edge' ? `${['ㄱ', 'ㄴ'][+k] || ''} ${(t.edges[+k] || {}).n || k} 쪽이 부드럽다고 예상` : k;
    return h('details', { class: 'tcase' }, h('summary', {}, h('b', {}, `${c.title}`), h('span', { class: 'muted small' }, ` ${c.artist} · 질문 ${qs.length}`)),
      h('div', { class: 'tcols' },
        h('div', {}, h('b', {}, '생각 — ' + t.q), h('ul', {}, ...count(think[c.id], 'o').map(([k, n]) => h('li', {}, `${thinkWord(k)} — ${n}명`)))),
        h('div', {}, h('b', {}, '느낌'), h('ul', {}, ...count(feel[c.id], 'f').slice(0, 6).map(([k, n]) => h('li', {}, `${FEEL_WORD[k] || k} ${n}`))),
          h('b', {}, '까닭'), h('ul', {}, ...count(feel[c.id], 'b').map(([k, n]) => h('li', {}, `${BEC_WORD[k] || k} ${n}`))))),
      h('b', {}, '질문판'),
      qs.length ? h('ol', { class: 'tqs' }, ...qs.map(q => h('li', {}, h('span', { class: 'lv' }, LEVELS[kindOf(q.k).level]), ` ${questionText(c, q.k, q.p)} `, h('span', { class: 'muted small' }, `— ${nm(q.s)} · ♥ ${q.likes}`),
        h('button', { class: 'btn small', onclick: async () => { if (!confirm('이 질문을 질문판에서 내릴까요?')) return; try { await ctx.store.removeAsk(c.id, q.id); toast('내렸어요'); } catch (e) { console.warn(e); } mountTeacher(root, ctx); } }, '내리기'))))
        : h('p', { class: 'muted small' }, '아직 질문이 없어요.'));
  };
  //  조형 요소 찾기 — 칸: ★ = 카드 모음(별) · n/3 = 찾은 그림 수 · 헷갈림 = 그 요소를 찾다가 짚은 곳에 있던 다른 요소
  function elemSection() {
    const ekids = [...new Set([...Object.keys(EL.elem), ...Object.keys(EL.estats)])].filter(k => k && k !== 'teacher').sort((a, z) => String(nm(a)).localeCompare(String(nm(z)), 'ko'));
    if (!ekids.length) return h('div', { class: 'tfeel' }, h('h3', {}, '조형 요소 찾기'), h('p', { class: 'muted small' }, '아직 아무도 조형 요소를 찾지 않았어요.'));
    const ecell = (k, e) => { const p = (EL.elem[k] || {})[e.k], t = (EL.estats[k] || {})[e.k] || {}, n = p ? String(p.f || '').split('|').filter(Boolean).length : 0;
      return h('td', { class: 'c ' + (p && p.st ? 'ok' : n || t.tries ? 'try' : 'none'), title: `${nm(k)} · ${e.name} · 헛짚음 ${p ? p.n || 0 : 0} · 힌트 ${p ? p.h || 0 : 0}` }, p && p.st ? '★'.repeat(p.st) : n ? `${n}/3` : t.tries ? '·' : ''); };
    const conf = []; for (const [k, per] of Object.entries(EL.estats)) for (const [e, t] of Object.entries(per || {})) for (const [x, v] of Object.entries(t || {})) if (x.startsWith('x_') && elementOf(x.slice(2))) conf.push([e, x.slice(2), v]);
    const confTop = Object.entries(conf.reduce((a, [e, x, v]) => { const key = e + '>' + x; a[key] = (a[key] || 0) + v; return a; }, {})).sort((a, z) => z[1] - a[1]).slice(0, 6);
    const FW = Object.fromEntries(EFEELS);
    return h('div', { class: 'tfeel' }, h('h3', {}, '조형 요소 찾기'),
      h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
        h('thead', {}, h('tr', {}, h('th', {}, '이름'), ...ELEMENTS.map(e => h('th', { title: e.desc }, e.name)))),
        h('tbody', {}, ...ekids.map(k => h('tr', {}, h('td', { class: 'nm' }, nm(k)), ...ELEMENTS.map(e => ecell(k, e))))))),
      confTop.length ? h('div', { class: 'hard' }, h('b', {}, '많이 헷갈린 것'), ...confTop.map(([key, v]) => { const [e, x] = key.split('>'); return h('span', {}, `${elementOf(e).name}을(를) 찾다 ${elementOf(x).name} ${v}번`); })) : null,
      h('div', { class: 'tcols' }, ...ELEMENTS.filter(e => Object.keys(EL.efeel[e.k] || {}).length).map(e => h('div', {}, h('b', {}, `${e.name}의 느낌`), h('ul', {}, ...count(EL.efeel[e.k], 'f').slice(0, 4).map(([f, n]) => h('li', {}, `${FW[f] || f} ${n}`)))))),
      h('p', { class: 'muted small' }, '헷갈림은 돋보기가 짚은 곳에서 잰 요소예요(예: 가로선을 찾다 사선 = 기운 선을 짚음). 돋보기는 그림을 작게 줄여 칸마다 재므로, 아주 가는 선이나 작은 점은 못 잴 수 있어요.'));
  }
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 해결(별 수) · 숫자 = 아직 해결 못 한 그림의 헛짚음 · 오른쪽 = 질문 사다리(보이는 것 → 까닭 · 마음 → 상상 → 화가에게).`),
    kids.length ? h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {}, h('tr', {}, h('th', {}, '이름'), ...CASES.map(c => h('th', { title: `${c.artist} 「${c.title}」` }, c.title.split(' ')[0])), ...[1, 2, 3, 4].map(l => h('th', { class: 'u' }, LEVELS[l])))),
      h('tbody', {}, ...kids.map(k => h('tr', {}, h('td', { class: 'nm' }, nm(k)), ...CASES.map(c => cell(k, c)), ...[1, 2, 3, 4].map(l => h('td', { class: 'lvc' }, String(((ladder[k] || {})[l]) || 0)))))))) : h('div', { class: 'empty' }, '아직 아무도 사건을 풀지 않았어요.'),
    h('p', { class: 'muted small', style: { margin: '8px 2px 12px' } }, '질문 사다리가 ‘보이는 것’에만 몰린 아이에게는 “왜 그랬을까?” “화가는 왜 이렇게 그렸을까?”를 같이 만들어 보세요. 질문 문장은 아이가 고른 낱말로 만들어져 글 입력이 없어요.'),
    elemSection(),
    h('h3', {}, '그림마다'),
    ...CASES.map(casePanel),
  ].filter(Boolean));
  return { unmount() {} };
}
