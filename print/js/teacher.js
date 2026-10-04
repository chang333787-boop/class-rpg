// 선생님 헷갈림 지도 — 아이 × 판 표(푼 판은 별 · 자유 판화는 ✓, 못 푼 판은 답한 수) + 아이마다 무엇이 달랐는지(거울 실수 · 넘쳐 팜 …)
//  관리자 비밀번호로 연다(먹 연구소 · 물감 연구소와 같은 방식). 쓰는 것 없음(읽기만).
import { h, modal } from './util.js';
import { teacherGate } from '../../common/teacher-gate.js';
import { ST, CHAPTERS } from './stages.js';
//  [UX-TRIM-G4] 성취기준 · 교과 근거 — 아이 첫 화면 바닥글에서 선생님 화면으로 옮겼다(아이 화면엔 쉬운 말 한 줄)
const STD = '3~4학년 미술 [4미02-02] 표현 재료와 용구(판 · 칼 · 롤러 · 바렌)의 특성 · 사용 방법 · [4미02-03] 조형 요소(형 · 선) 탐색. 미술 교과서 8종이 4학년에 판화를 다뤄요.';

export const MISTAKES = { pick: '찍힘 예상', choose: '판 고르기', mirror: '거울 실수(반대로 팜)', over: '넘쳐 팜', less: '덜 팜', ink: '잉크 덜 바름', rub: '덜 문지름' };
const MK = Object.keys(MISTAKES);
const SCORED = ST.filter(s => s.kind !== 'free');

// 선생님 화면 문 — 손님 · 이 창에서 통과('print.teacher') · 아니면 관리자 비밀번호(하위 앱 공통 common/teacher-gate.js) [SUBAPP-COMMON-1]
function gate(ctx) { return teacherGate(ctx, 'print.teacher'); }

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('판화 놀이 · 헷갈림 지도', { back: '#/' }), h('div', { class: 'view' }, h('p', { class: 'muted small std', style: { margin: '12px 18px 0' } }, STD), box));
  const { progress, stats, names } = await ctx.store.all();
  const kids = [...new Set([...Object.keys(progress), ...Object.keys(stats)])].filter(k => k !== 'teacher')
    .sort((a, z) => String(names[a] || a).localeCompare(String(names[z] || z), 'ko'));
  if (!kids.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 풀지 않았어요.')); return { unmount() {} }; }
  const st = (k, s) => ((stats[k] || {})[s.id]) || {}, pg = (k, s) => (progress[k] || {})[s.id];
  const mkOf = k => { const o = {}; SCORED.forEach(s => MK.forEach(m => { o[m] = (o[m] || 0) + (st(k, s)[m] || 0); })); return o; };
  const topMk = o => Object.entries(o).filter(([, n]) => n).sort((a, z) => z[1] - a[1]);
  const all = {}; kids.forEach(k => Object.entries(mkOf(k)).forEach(([m, n]) => { all[m] = (all[m] || 0) + n; }));
  const cls = topMk(all).slice(0, 4);
  const cell = (k, s) => {
    const r = pg(k, s), t = st(k, s);
    const sw = null;
    return h('td', { class: 'c ' + (r ? 'ok' : t.tries ? 'try' : 'none'), title: `${names[k] || k} · ${s.id} ${s.title}`, onclick: () => detail(k, s) },
      r ? (s.kind === 'free' ? '✓' : '★'.repeat(r.st)) : t.tries ? String(t.tries) : '·', sw);
  };
  function detail(k, s) {
    const t = st(k, s), r = pg(k, s);
    modal(`${names[k] || k} · ${s.id} ${s.title}`, h('div', {},
      h('p', {}, r ? (s.kind === 'free' ? '찍어 봤어요' : `풀었어요 · ${'★'.repeat(r.st)} · 틀린 답 ${r.n}번`) : `아직 못 풀었어요 · 답한 수 ${t.tries || 0}`),
      h('p', { class: 'muted' }, MK.filter(m => t[m]).map(m => `${MISTAKES[m]} ${t[m]}`).join(' · ') || '헷갈림 기록 없음')));
  }
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 푼 판(별 수) · ✓ = 나만의 판화를 찍어 봄 · 숫자 = 아직 못 푼 판에 답한 수. 오른쪽 끝 = 그 아이가 가장 많이 헷갈린 것.`),
    cls.length ? h('div', { class: 'hard' }, h('b', {}, '우리 반이 많이 헷갈린 것'), ...cls.map(([m, n]) => h('span', {}, `${MISTAKES[m]} ${n}번`))) : null,
    h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {},
        h('tr', {}, h('th', { rowspan: 2 }, '이름'), ...CHAPTERS.filter(c => ST.some(s => s.ch === c.id)).map(c => h('th', { colspan: ST.filter(s => s.ch === c.id).length, class: 'u' }, `${c.id}장 ${c.title}`)), h('th', { rowspan: 2 }, '많이 헷갈린 것')),
        h('tr', {}, ...ST.map(s => h('th', { title: s.title }, s.id)))),
      h('tbody', {}, ...kids.map(k => { const top = topMk(mkOf(k))[0]; return h('tr', {}, h('td', { class: 'nm' }, names[k] || k), ...ST.map(s => cell(k, s)), h('td', { class: 'mk' }, top ? `${MISTAKES[top[0]]} ${top[1]}` : '—')); })))),
    h('p', { class: 'muted small', style: { margin: '8px 2px 0' } }, '거울 실수 = 종이에 찍힐 방향과 같은 쪽으로 새김(판에서는 반대로 새겨야 함) · 넘쳐 팜 = 남겨야 검게 찍힐 곳까지 팜 · 덜 팜 = 하얗게 비울 곳을 덜 팜 · 잉크 · 문지르기 = 3-1 찍기에서 덜 해서 하얗게 빔. 숫자는 그 판에서 답을 냈다가 안 맞은 횟수예요.'),
  ].filter(Boolean));
  return { unmount() {} };
}
