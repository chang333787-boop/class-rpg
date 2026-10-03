// 선생님 막힘 지도 — 아이 × 판 표: 푼 판은 별, 못 푼 판은 실행 횟수(5번 넘게 못 풀면 '막힘') · 판마다 많이 한 실수
//  칸을 누르면 그 아이의 마지막 코드(글 코드)와 실수 셈. 관리자 비밀번호로 연다(음악실 · 생각판과 같은 방식). 쓰는 것 0.
import { h, toast, modal } from './util.js';
import { STAGES, UNITS } from './stages.js';
import { defineAll, pythonOf } from './blocks.js';

const WHY = ['wall', 'water', 'edge', 'tree', 'land', 'noacorn', 'short', 'acorns', 'loop', 'draw', 'empty'];
const WHY_KO = { wall: '나무에 부딪힘', water: '웅덩이', edge: '길 밖', tree: '나무 뛰기', land: '내릴 곳 없음', noacorn: '빈손 줍기', short: '덜 감', acorns: '도토리 덜 주움', loop: '끝없는 반복', draw: '그림 다름', empty: '빈 코드' };

async function gate(ctx) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem('coding.teacher') === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem('coding.teacher', '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('기초 코딩 · 막힘 지도', { back: '#/' }), h('div', { class: 'view' }, box));
  const { progress, stats, names } = await ctx.store.all();
  const kids = [...new Set([...Object.keys(progress), ...Object.keys(stats)])].filter(k => k !== 'teacher')
    .sort((a, z) => String(names[a] || a).localeCompare(String(names[z] || z), 'ko'));
  if (!kids.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 풀지 않았어요.')); return { unmount() {} }; }
  const st = (k, s) => ((stats[k] || {})[s.id]) || {}, pg = (k, s) => (progress[k] || {})[s.id];
  const stuck = (k, s) => !pg(k, s) && (st(k, s).tries || 0) >= 5;
  // 판마다 — 푼 아이 · 막힌 아이 · 가장 많은 실수
  const per = STAGES.map(s => {
    const solved = kids.filter(k => pg(k, s)).length, stuckN = kids.filter(k => stuck(k, s)).length;
    const why = {}; kids.forEach(k => WHY.forEach(w => { why[w] = (why[w] || 0) + (st(k, s)[w] || 0); }));
    const top = Object.entries(why).sort((a, z) => z[1] - a[1])[0];
    return { s, solved, stuckN, top: top && top[1] ? top[0] : null };
  });
  const hard = per.filter(p => p.stuckN).sort((a, z) => z.stuckN - a.stuckN).slice(0, 3);
  const cell = (k, s) => {
    const p = pg(k, s), t = st(k, s);
    const cls = p ? 'ok s' + p.st : stuck(k, s) ? 'stuck' : t.tries ? 'try' : 'none';
    return h('td', { class: 'c ' + cls, title: `${names[k] || k} · ${s.id} ${s.title}`, onclick: () => detail(k, s) }, p ? '★'.repeat(p.st) : t.tries ? String(t.tries) : '·');
  };
  async function detail(k, s) {
    const t = st(k, s), p = pg(k, s);
    let code = '';
    try { const j = await ctx.store.codeOf(k, s.id); if (j && globalThis.Blockly) { defineAll(); const ws = new globalThis.Blockly.Workspace(); globalThis.Blockly.serialization.workspaces.load(JSON.parse(j), ws); code = pythonOf(ws); ws.dispose(); } } catch (e) { console.warn(e); }
    modal(`${names[k] || k} · ${s.id} ${s.title}`, h('div', {},
      h('p', {}, p ? `풀었어요 · ${'★'.repeat(p.st)} · 블록 ${p.n}개(가장 짧은 답 ${s.best}개)` : `아직 못 풀었어요 · 실행 ${t.tries || 0}번`),
      h('p', { class: 'muted' }, WHY.filter(w => t[w]).map(w => `${WHY_KO[w]} ${t[w]}`).join(' · ') || '실수 기록 없음'),
      h('pre', { class: 'py' }, code || '(저장된 코드 없음)')), [{ label: '닫기', primary: true }], { wide: true });
  }
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 푼 판(별 수) · 숫자 = 아직 못 푼 판의 실행 횟수 · 빨강 = 5번 넘게 해도 못 푼 판(막힘). 칸을 누르면 그 아이의 마지막 코드.`),
    hard.length ? h('div', { class: 'hard' }, h('b', {}, '많이 막힌 판'), ...hard.map(p => h('span', {}, `${p.s.id} ${p.s.title} — ${p.stuckN}명${p.top ? ' · 많은 실수: ' + WHY_KO[p.top] : ''}`))) : null,
    h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {},
        h('tr', {}, h('th', { rowspan: 2 }, '이름'), ...UNITS.filter(u => u.open).map(u => h('th', { colspan: STAGES.filter(s => s.unit === u.id).length, class: 'u' }, `${u.id}단원 ${u.title}`)), h('th', { rowspan: 2 }, '푼 판')),
        h('tr', {}, ...STAGES.map(s => h('th', { class: 'sid', title: s.title }, s.id)))),
      h('tbody', {}, ...kids.map(k => h('tr', {}, h('td', { class: 'nm' }, names[k] || k), ...STAGES.map(s => cell(k, s)), h('td', { class: 'sum' }, String(STAGES.filter(s => pg(k, s)).length))))),
      h('tfoot', {}, h('tr', {}, h('td', { class: 'nm' }, '푼 아이'), ...per.map(p => h('td', { class: 'c foot' + (p.stuckN ? ' warn' : ''), title: p.top ? '많은 실수: ' + WHY_KO[p.top] : '' }, String(p.solved))), h('td', {}, ''))))),
  ].filter(Boolean));
  return { unmount() {} };
}
