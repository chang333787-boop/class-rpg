// 선생님 헷갈림 지도 — 아이 × 판 표(푼 판은 별 · 붓 놀이는 ✓, 못 푼 판은 답한 수) + 아이마다 무엇이 달랐는지(너무 진함 · 너무 옅음 …) + 아이가 이은 먹색 꼬리
//  관리자 비밀번호로 연다(물감 연구소 · 무늬 공방과 같은 방식). 쓰는 것 없음(읽기만).
import { h, toast, modal } from './util.js';
import { ST, CHAPTERS } from './stages.js';

export const MISTAKES = { dark: '너무 진함(물 모자람)', pale: '너무 옅음(먹 모자람)', amount: '양 · 비율', pick: '섞기 예상', order: '차례(농담 · 획순)', paper: '먹 없이 물만', reverse: '획 방향', off: '밑그림 밖', weak: '획이 덜 곧고 고름' };
const MK = Object.keys(MISTAKES);
const SCORED = ST.filter(s => s.kind !== 'brush');

async function gate(ctx) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem('ink.teacher') === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem('ink.teacher', '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('먹 연구소 · 헷갈림 지도', { back: '#/' }), h('div', { class: 'view' }, box));
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
    const sw = r && typeof r.c === 'string' ? h('span', { class: 'tsw', style: { background: r.c } }) : null;
    return h('td', { class: 'c ' + (r ? 'ok' : t.tries ? 'try' : 'none'), title: `${names[k] || k} · ${s.id} ${s.title}`, onclick: () => detail(k, s) },
      r ? (s.kind === 'brush' ? '✓' : '★'.repeat(r.st)) : t.tries ? String(t.tries) : '·', sw);
  };
  function detail(k, s) {
    const t = st(k, s), r = pg(k, s);
    const made = r && r.c ? (Array.isArray(r.c) ? r.c : [r.c]) : [];
    modal(`${names[k] || k} · ${s.id} ${s.title}`, h('div', {},
      h('p', {}, r ? (s.kind === 'brush' ? '해 봤어요' : `풀었어요 · ${'★'.repeat(r.st)} · 틀린 답 ${r.n}번`) : `아직 못 풀었어요 · 답한 수 ${t.tries || 0}`),
      made.length ? h('div', { class: 'tmade' }, h('span', { class: 'muted small' }, '만든 먹색'), ...made.map(c => h('span', { class: 'tsw big', style: { background: c } }))) : null,
      h('p', { class: 'muted' }, MK.filter(m => t[m]).map(m => `${MISTAKES[m]} ${t[m]}`).join(' · ') || '헷갈림 기록 없음')));
  }
  //  아이들이 이은 먹색 꼬리(1-5) — 한 줄씩 나란히: 칸 사이가 고른 아이 · 한쪽이 몰린 아이가 한눈에
  const tails = kids.map(k => [k, (progress[k] || {})['1-5']]).filter(([, r]) => r && Array.isArray(r.c));
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 푼 판(별 수 · 옆 동그라미 = 아이가 만든 먹색) · ✓ = 붓 놀이를 해 봄 · 숫자 = 아직 못 푼 판에 답한 수. 오른쪽 끝 = 그 아이가 가장 많이 헷갈린 것.`),
    cls.length ? h('div', { class: 'hard' }, h('b', {}, '우리 반이 많이 헷갈린 것'), ...cls.map(([m, n]) => h('span', {}, `${MISTAKES[m]} ${n}번`))) : null,
    h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {},
        h('tr', {}, h('th', { rowspan: 2 }, '이름'), ...CHAPTERS.filter(c => ST.some(s => s.ch === c.id)).map(c => h('th', { colspan: ST.filter(s => s.ch === c.id).length, class: 'u' }, `${c.id}장 ${c.title}`)), h('th', { rowspan: 2 }, '많이 헷갈린 것')),
        h('tr', {}, ...ST.map(s => h('th', { title: s.title }, s.id)))),
      h('tbody', {}, ...kids.map(k => { const top = topMk(mkOf(k))[0]; return h('tr', {}, h('td', { class: 'nm' }, names[k] || k), ...ST.map(s => cell(k, s)), h('td', { class: 'mk' }, top ? `${MISTAKES[top[0]]} ${top[1]}` : '—')); })))),
    h('p', { class: 'muted small', style: { margin: '8px 2px 0' } }, '너무 진함 = 물이 모자람 · 너무 옅음 = 먹이 모자람 · 양 · 비율 = 먹색은 맞는데 방울 수가 모자람 · 차례 = 농담 꼬리에서 앞 칸보다 옅게 못 칠함 · 판본체 쓰기에서 획순이 다름 · 획 방향 = 가로를 오른쪽에서, 세로를 아래에서 그음 · 밑그림 밖 = 본보기 밖에 그은 획. 숫자는 그 판에서 답을 냈다가(다 써 봤다가) 안 맞은 횟수예요.'),
    tails.length ? h('div', { class: 'tfeel' }, h('h3', {}, '우리 반 먹색 꼬리(1-5)'),
      h('div', { class: 'tails' }, ...tails.map(([k, r]) => h('div', { class: 'tail' }, h('span', { class: 'nm' }, names[k] || k), h('span', { class: 'tail-c' }, ...r.c.map(c => h('i', { style: { background: c } }))), h('span', { class: 'muted small' }, '★'.repeat(r.st))))),
      h('p', { class: 'muted small' }, '칸 사이 밝기 차이가 고를수록 별이 많아요. 한쪽 끝에 비슷한 칸이 몰린 아이는 ‘물을 조금씩 더하기’를 진짜 먹으로 한 번 더 해 보면 좋아요.')) : null,
  ].filter(Boolean));
  return { unmount() {} };
}
