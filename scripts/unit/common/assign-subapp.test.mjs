// 하위 앱 과제 계약 시험 [ASSIGN-SUBAPP-1] — common/assign.js(reportAssign · loadAssign · watchMine · onClassPause) + AssignCore.appPatch
//  node scripts/unit/common/assign-subapp.test.mjs   (DOM 없음 · 네트워크 없음 · 가짜 firebase · 가짜 창)
import { assignFromUrl, loadAssign, watchMine, reportAssign, onClassPause, AC } from '../../../common/assign.js';

const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb} · 실제 ${sa}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
globalThis.location = { origin: 'https://funclassrpg.kr', search: '' };

//  가짜 RTDB — 경로 트리 · once · on · update(다중 경로) · 쓴 경로 기록
function fakeDb(tree = {}, { slow = 0 } = {}) {
  const writes = [], listeners = [];
  const seg = p => String(p).split('/').filter(Boolean);
  const get = p => { let c = tree; for (const k of seg(p)) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : c; };
  const set = (p, v) => { const ks = seg(p); let c = tree; for (let i = 0; i < ks.length - 1; i++) { c[ks[i]] = c[ks[i]] && typeof c[ks[i]] === 'object' ? c[ks[i]] : {}; c = c[ks[i]]; } if (v == null) delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = v; };
  const ref = p => ({
    once: async () => { if (slow) await sleep(slow); return { val: () => JSON.parse(JSON.stringify(get(p))) }; },
    on: (ev, cb) => { listeners.push({ p, cb }); setTimeout(() => cb({ val: () => get(p) }), 5); return cb; },
    off: () => {},
    update: async (up) => { for (const k of Object.keys(up)) { writes.push(p + '/' + k); set(p + '/' + k, up[k]); } for (const l of listeners) l.cb({ val: () => get(l.p) }); },
  });
  return { ref, writes, tree };
}
const DEF = { id: 'aCode1', kind: 'coding', title: '반복하기', content: { coding: { stages: ['2-3', '2-4'] } }, roster: { s1: '하늘' }, createdAt: 1 };
//  가짜 창 — postMessage 로 부모에게 · addEventListener('message')
function fakeWin() {
  const ls = [];
  const w = { addEventListener: (t, f) => { if (t === 'message') ls.push(f); }, removeEventListener: (t, f) => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); }, fire: (data, origin = 'https://funclassrpg.kr', source) => ls.forEach(f => f({ data, origin, source })) };
  w.parent = w;
  return w;
}

await test('assignFromUrl — ?assign · ?sid · ?live · 손님(sid 없음) · 이상한 과제 id 는 null', () => {
  eq(assignFromUrl({ search: '?sid=s1&n=%ED%95%98&assign=aCode1&live=1' }), { aid: 'aCode1', sid: 's1', live: true });
  ok(assignFromUrl({ search: '?assign=aCode1' }) === null, '손님');
  ok(assignFromUrl({ search: '?sid=s1&assign=a%27%3E' }) === null, '이상한 id');
  ok(assignFromUrl({ search: '' }) === null, '과제 없음');
});
await test('loadAssign — 열린 것 → 닫힌 것(closed 표시) → 없으면 null · 늦으면 null(4초 대신 시험은 50ms)', async () => {
  const db = fakeDb({ classRPG_assign: { open: { aCode1: DEF }, archive: { aOld: { ...DEF, id: 'aOld' } } } });
  ok((await loadAssign(db.ref ? db : null, 'aCode1')).n === 2, '열린 것');
  ok((await loadAssign(db, 'aOld')).closed === true, '닫힌 것');
  ok(await loadAssign(db, 'aNone') === null, '없음');
  const slow = fakeDb({ classRPG_assign: { open: { aCode1: DEF } } }, { slow: 300 });
  ok(await loadAssign(slow, 'aCode1', 50) === null, '늦음');
});
await test('watchMine — 내 칸 경로만 듣고 첫 값이 온 뒤에 부른다', async () => {
  const db = fakeDb({ classRPG_assign: { results: { aCode1: { s1: { app: { score: 1 } }, s2: { app: { score: 9 } } } } } });
  const got = []; watchMine(db, 'aCode1', 's1', v => got.push(v));
  ok(got.length === 0, '첫 값 전에 부름'); await sleep(20);
  eq(got[0], { app: { score: 1 } });
});
await test('reportAssign(RPG 안) — 부모에게 넘기고 답(ack)을 기다린다 · 직접 쓰기 0', async () => {
  const db = fakeDb({ classRPG_assign: { open: { aCode1: DEF } } });
  const win = fakeWin(), sent = [];
  const parent = { postMessage: (m, origin) => { sent.push({ m, origin }); setTimeout(() => win.fire({ type: 'rpg:assign-ack', id: m.id, ok: true }), 5); } };
  const r = await reportAssign(db, 'aCode1', 's1', { attempt: true, detail: { '2-3': { rank: 3, st: 3 } } }, { win, parent });
  ok(r === true && sent.length === 1 && sent[0].origin === 'https://funclassrpg.kr', '보냄 ' + JSON.stringify(sent));
  eq(sent[0].m.type, 'rpg:assign-report'); eq(sent[0].m.aid, 'aCode1');
  ok(db.writes.length === 0, '직접 씀');
});
await test('reportAssign — 부모가 \'안 됨\'이면 직접 쓰지 않음 · 2초(시험 30ms) 안에 답이 없으면 직접(내 칸 아래만)', async () => {
  const db = fakeDb({ classRPG_assign: { open: { aCode1: DEF } } });
  const win = fakeWin();
  const no = { postMessage: (m) => setTimeout(() => win.fire({ type: 'rpg:assign-ack', id: m.id, ok: false }), 5) };
  ok(await reportAssign(db, 'aCode1', 's1', { attempt: true }, { win, parent: no }) === false && db.writes.length === 0, '안 됨');
  const silent = { postMessage: () => {} };
  ok(await reportAssign(db, 'aCode1', 's1', { attempt: true, score: 1, total: 2 }, { win, parent: silent, ackMs: 30 }) === true, '직접');
  ok(db.writes.length >= 3 && db.writes.every(w => w.startsWith('classRPG_assign/results/aCode1/s1/')), '쓴 곳 ' + db.writes.join(', '));
});
await test('reportAssign — 다른 origin 의 답(ack)은 무시', async () => {
  const db = fakeDb({ classRPG_assign: { open: { aCode1: DEF } } });
  const win = fakeWin();
  const evil = { postMessage: (m) => setTimeout(() => win.fire({ type: 'rpg:assign-ack', id: m.id, ok: true }, 'https://evil.example'), 5) };
  const r = await reportAssign(db, 'aCode1', 's1', { attempt: true }, { win, parent: evil, ackMs: 40 });
  ok(r === true && db.writes.length > 0, '가짜 답을 믿음(직접 쓰기로 가야 함)');
});
await test('reportAssign(RPG 밖) — 닫힌 과제 · 대상 아님이면 안 씀', async () => {
  const db = fakeDb({ classRPG_assign: { archive: { aCode1: DEF } } });
  ok(await reportAssign(db, 'aCode1', 's1', { attempt: true }, { parent: null }) === false && db.writes.length === 0, '닫힌 과제');
  const db2 = fakeDb({ classRPG_assign: { open: { aCode1: { ...DEF, targets: ['s2'] } } } });
  ok(await reportAssign(db2, 'aCode1', 's1', { attempt: true }, { parent: null }) === false, '대상 아님');
});
await test('onClassPause — 같은 origin 의 부모 신호만', () => {
  const win = fakeWin(), got = [];
  const off = onClassPause(on => got.push(on), win);
  win.fire({ type: 'rpg:classlive', on: true }, 'https://funclassrpg.kr', win);
  win.fire({ type: 'rpg:classlive', on: false }, 'https://evil.example', win);
  win.fire({ type: 'rpg:classlive', on: false }, 'https://funclassrpg.kr', {});
  off(); win.fire({ type: 'rpg:classlive', on: false }, 'https://funclassrpg.kr', win);
  eq(got, [true]);
});
await test('appPatch — 퀴즈는 null · 점수는 늘 때만 · 판 기록은 rank 가 클 때만 · 열쇠 · 크기 검사 · startedAt/doneAt 한 번', () => {
  const def = AC.normDef(DEF, 'aCode1');
  ok(AC.appPatch(AC.normDef({ id: 'q1', kind: 'quiz', content: { quiz: { items: [{ id: 'p', type: 'number', q: 'x', a: '1' }] } } }, 'q1'), 's1', null, { attempt: true }) === null, '퀴즈');
  const cell = { startedAt: 5, app: { score: 1, total: 2, detail: { '2-3': { rank: 3 } } } };
  const p = AC.appPatch(def, 's1', cell, { attempt: true, score: 1, total: 2, done: true, detail: { '2-3': { rank: 2 }, '2-4': { rank: 1 }, 'bad key': { rank: 9 }, big: { rank: 9, x: 'x'.repeat(2000) } } }, { TS: 'T', INC: n => 'inc' + n });
  eq(Object.keys(p).sort(), ['results/aCode1/s1/app/attempts', 'results/aCode1/s1/app/detail/2-4', 'results/aCode1/s1/doneAt']);
  ok(p['results/aCode1/s1/app/attempts'] === 'inc1', 'increment');
  const q = AC.appPatch(def, 's1', cell, { score: 2, start: true }, { TS: 'T' });
  eq(q, { 'results/aCode1/s1/app/score': 2 });
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`하위 앱 과제 계약 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
