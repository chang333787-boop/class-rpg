// 선생님 헷갈림 지도 — 아이 × 판 표(푼 판은 별, 못 푼 판은 답한 수) + 아이마다 헷갈림 셈(좌우·위아래 · 돌리는 방향 · 각도 · 뒤집기·돌리기 …)
//  관리자 비밀번호로 연다(기초 코딩 · 음악실과 같은 방식). 쓰는 것 0.
import { h, toast, modal } from './util.js';
import { PUZ, CHAPTERS } from './stages.js';
import { MISTAKES } from './tiles.js';

const MK = Object.keys(MISTAKES);

async function gate(ctx) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem('pattern.teacher') === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem('pattern.teacher', '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('무늬 공방 · 헷갈림 지도', { back: '#/' }), h('div', { class: 'view' }, box));
  const { progress, stats, names } = await ctx.store.all();
  const kids = [...new Set([...Object.keys(progress), ...Object.keys(stats)])].filter(k => k !== 'teacher')
    .sort((a, z) => String(names[a] || a).localeCompare(String(names[z] || z), 'ko'));
  if (!kids.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 풀지 않았어요.')); return { unmount() {} }; }
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
        h('tr', {}, h('th', { rowspan: 2 }, '이름'), ...CHAPTERS.filter(c => c.open).map(c => h('th', { colspan: PUZ.filter(p => p.ch === c.id).length, class: 'u' }, `${c.id}장 ${c.title}`)), h('th', { rowspan: 2 }, '많이 헷갈린 것')),
        h('tr', {}, ...PUZ.map(p => h('th', { title: p.title }, p.id)))),
      h('tbody', {}, ...kids.map(k => { const top = topMk(mkOf(k))[0]; return h('tr', {}, h('td', { class: 'nm' }, names[k] || k), ...PUZ.map(p => cell(k, p)), h('td', { class: 'mk' }, top ? `${MISTAKES[top[0]]} ${top[1]}` : '—')); })))),
  ].filter(Boolean));
  return { unmount() {} };
}
