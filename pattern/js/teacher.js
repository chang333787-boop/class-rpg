// 선생님 헷갈림 지도 — 아이 × 판 표(푼 판은 별, 못 푼 판은 답한 수) + 아이마다 헷갈림 셈(좌우·위아래 · 돌리는 방향 · 각도 · 뒤집기·돌리기 …)
//  관리자 비밀번호로 연다(기초 코딩 · 음악실과 같은 방식). 쓰는 것 = 우리 반 무늬 전시에서 내리기 하나뿐.
import { h, toast, modal } from './util.js';
import { teacherGate } from '../../common/teacher-gate.js';
import { PUZ, CHAPTERS } from './stages.js';
import { MISTAKES, validWork, wallpaper, WALL } from './tiles.js';
import { wallCanvas } from './draw.js';
//  [UX-TRIM-G4] 성취기준 · 교과 근거 — 아이 첫 화면 바닥글에서 선생님 화면으로 옮겼다(아이 화면엔 쉬운 말 한 줄)
const STD = '4학년 수학 ‘평면도형의 이동’ [4수03-04] 밀기 · 뒤집기 · 돌리기 · [4수03-12] 모양을 만들거나 채우기 + 미술 [4미02-03] 조형 요소 · [4미02-05] 다른 교과와 관련지어 표현. 돌리고 뒤집기처럼 겹친 움직임은 다루지 않아요(교육과정 적용 시 고려 사항).';

const MK = Object.keys(MISTAKES);

// 선생님 화면 문 — 손님 · 이 창에서 통과('pattern.teacher') · 아니면 관리자 비밀번호(하위 앱 공통 common/teacher-gate.js) [SUBAPP-COMMON-1]
function gate(ctx) { return teacherGate(ctx, 'pattern.teacher'); }

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('무늬 공방 · 헷갈림 지도', { back: '#/' }), h('div', { class: 'view' }, h('p', { class: 'muted small std', style: { margin: '12px 18px 0' } }, STD), box));
  const { progress, stats, names, works = {} } = await ctx.store.all();
  const kids = [...new Set([...Object.keys(progress), ...Object.keys(stats)])].filter(k => k !== 'teacher')
    .sort((a, z) => String(names[a] || a).localeCompare(String(names[z] || z), 'ko'));
  //  [PATTERN-6] 우리 반 무늬 전시 — 선생님이 내릴 수 있다(글은 없지만 칸 그림이라도 수업에 맞지 않으면)
  const gallerySec = () => {
    const list = [];
    for (const [sid, ws] of Object.entries(works)) for (const [id, w] of Object.entries(ws || {})) if (validWork(w)) list.push({ sid, id, w });
    list.sort((a, z) => (z.w.t || 0) - (a.w.t || 0));
    return h('div', { class: 'tgal' }, h('h3', {}, `우리 반 무늬 전시 ${list.length}`),
      list.length ? h('div', { class: 'wgrid' }, ...list.map(x => h('div', { class: 'wcard' }, h('div', { class: 'wthumb' }, wallCanvas(wallpaper(x.w.g, x.w.u, WALL.cols, WALL.rows), 22)),
        h('div', { class: 'wmeta' }, h('b', {}, names[x.sid] || x.sid)),
        h('button', { class: 'btn small', onclick: async () => { if (!confirm('이 무늬를 전시에서 내릴까요?')) return; try { await ctx.store.deleteWork(x.sid, x.id); toast('내렸어요'); } catch (e) { console.warn(e); } mountTeacher(root, ctx); } }, '내리기'))))
        : h('p', { class: 'muted' }, '아직 건 무늬가 없어요.'));
  };
  if (!kids.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 풀지 않았어요.'), gallerySec()); return { unmount() {} }; }
  const st = (k, p) => ((stats[k] || {})[p.id]) || {}, pg = (k, p) => (progress[k] || {})[p.id];
  const mkOf = k => { const o = {}; PUZ.forEach(p => MK.forEach(m => { o[m] = (o[m] || 0) + (st(k, p)[m] || 0); })); return o; };
  const topMk = o => Object.entries(o).filter(([, n]) => n).sort((a, z) => z[1] - a[1]);
  // 반 전체 헷갈림
  const all = {}; kids.forEach(k => Object.entries(mkOf(k)).forEach(([m, n]) => { all[m] = (all[m] || 0) + n; }));
  const cls = topMk(all).slice(0, 4);
  const cell = (k, p) => {
    const r = pg(k, p), t = st(k, p);
    return h('td', { class: 'c ' + (r ? 'ok' : t.tries ? 'try' : 'none'), title: `${names[k] || k} · ${p.id} ${p.title}`, onclick: () => detail(k, p) }, r ? '★'.repeat(r.st) : t.tries ? String(t.tries) : '·');
  };
  function detail(k, p) {
    const t = st(k, p), r = pg(k, p);
    modal(`${names[k] || k} · ${p.id} ${p.title}`, h('div', {},
      h('p', {}, r ? `풀었어요 · ${'★'.repeat(r.st)} · 틀린 답 ${r.n}번` : `아직 못 풀었어요 · 답한 수 ${t.tries || 0}`),
      h('p', { class: 'muted' }, MK.filter(m => t[m]).map(m => `${MISTAKES[m]} ${t[m]}`).join(' · ') || '헷갈림 기록 없음')));
  }
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 푼 판(별 수) · 숫자 = 아직 못 푼 판에 답한 수. 오른쪽 끝 = 그 아이가 가장 많이 헷갈린 것.`),
    cls.length ? h('div', { class: 'hard' }, h('b', {}, '우리 반이 많이 헷갈린 것'), ...cls.map(([m, n]) => h('span', {}, `${MISTAKES[m]} ${n}번`))) : null,
    h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {},
        h('tr', {}, h('th', { rowspan: 2 }, '이름'), ...CHAPTERS.filter(c => c.open && !c.free).map(c => h('th', { colspan: PUZ.filter(p => p.ch === c.id).length, class: 'u' }, `${c.id}장 ${c.title}`)), h('th', { rowspan: 2 }, '많이 헷갈린 것')),
        h('tr', {}, ...PUZ.map(p => h('th', { title: p.title }, p.id)))),
      h('tbody', {}, ...kids.map(k => { const top = topMk(mkOf(k))[0]; return h('tr', {}, h('td', { class: 'nm' }, names[k] || k), ...PUZ.map(p => cell(k, p)), h('td', { class: 'mk' }, top ? `${MISTAKES[top[0]]} ${top[1]}` : '—')); })))),
    gallerySec(),
  ].filter(Boolean));
  return { unmount() {} };
}
