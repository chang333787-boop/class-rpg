// 선생님 탐정 기록 — 아이 × 그림 표(해결 별 · 헛짚음) + 질문 사다리(아이마다 질문 갈래) + 그림마다 생각 · 느낌 셈 · 질문판(이름과 함께 · 내리기)
//  관리자 비밀번호로 연다(물감 연구소 · 무늬 공방과 같은 방식). 쓰는 것 = 질문 내리기 하나뿐.
import { h, toast, modal } from './util.js';
import { CASES, FEELS, BECAUSE } from './cases.js';
import { kindOf, questionText, LEVELS } from './ask.js';

const FEEL_WORD = Object.fromEntries(FEELS), BEC_WORD = Object.fromEntries(BECAUSE);

async function gate(ctx) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem('art.teacher') === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem('art.teacher', '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}
const count = (obj, key) => { const cnt = {}; for (const v of Object.values(obj || {})) for (const k of String((v || {})[key] || '').split(',').filter(Boolean)) cnt[k] = (cnt[k] || 0) + 1; return Object.entries(cnt).sort((a, z) => z[1] - a[1]); };

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('명화 탐정 · 탐정 기록', { back: '#/' }), h('div', { class: 'view' }, box));
  const { progress, stats, names, think, feel, ask, like } = await ctx.store.all();
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
  box.replaceChildren(...[
    h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `아이 ${kids.length}명 · 칸: ★ = 해결(별 수) · 숫자 = 아직 해결 못 한 그림의 헛짚음 · 오른쪽 = 질문 사다리(보이는 것 → 까닭 · 마음 → 상상 → 화가에게).`),
    kids.length ? h('div', { class: 'tscroll' }, h('table', { class: 'tmap' },
      h('thead', {}, h('tr', {}, h('th', {}, '이름'), ...CASES.map(c => h('th', { title: `${c.artist} 「${c.title}」` }, c.title.split(' ')[0])), ...[1, 2, 3, 4].map(l => h('th', { class: 'u' }, LEVELS[l])))),
      h('tbody', {}, ...kids.map(k => h('tr', {}, h('td', { class: 'nm' }, nm(k)), ...CASES.map(c => cell(k, c)), ...[1, 2, 3, 4].map(l => h('td', { class: 'lvc' }, String(((ladder[k] || {})[l]) || 0)))))))) : h('div', { class: 'empty' }, '아직 아무도 사건을 풀지 않았어요.'),
    h('p', { class: 'muted small', style: { margin: '8px 2px 12px' } }, '질문 사다리가 ‘보이는 것’에만 몰린 아이에게는 “왜 그랬을까?” “화가는 왜 이렇게 그렸을까?”를 같이 만들어 보세요. 질문 문장은 아이가 고른 낱말로 만들어져 글 입력이 없어요.'),
    h('h3', {}, '그림마다'),
    ...CASES.map(casePanel),
  ].filter(Boolean));
  return { unmount() {} };
}
