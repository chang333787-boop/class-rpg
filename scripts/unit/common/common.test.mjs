// 하위 앱 공통 뼈대(common/) 시험 [SUBAPP-COMMON-1] — util · rpg-firebase · teacher-gate · roster · subapp.css 가 앱들과 제대로 이어졌나
//  node scripts/unit/common/common.test.mjs   (DOM 없음 · 네트워크 없음 · 가짜 firebase)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as U from '../../../common/util.js';
import { RPG_FIREBASE, rpgDb, adminPwOK } from '../../../common/rpg-firebase.js';
import { teacherGate } from '../../../common/teacher-gate.js';
import { ROSTER_PATH, rosterOf, loadRoster, rosterFor, rosterNames, rosterRows } from '../../../common/roster.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const SHIM_APPS = ['art', 'coding', 'ink', 'paint', 'pattern', 'print'];          // js/util.js = 공통 그대로
const GATE_APPS = [...SHIM_APPS, 'music'];                                          // teacher.js 가 공통 문을 씀
const FB_APPS = [...GATE_APPS, 'thinkboard'];                                       // 학급 RPG Firebase 를 씀
const CSS_APPS = SHIM_APPS;                                                         // common/subapp.css 를 먼저 부름
const CORE = ['uid', 'keyOf', 'clamp', 'h', 'toast', 'modal', 'lsGet', 'lsSet'];

// ── util ──
await test('공통 util 이 내보내는 것 = 여덟 가지', () => { ok(JSON.stringify(Object.keys(U).sort()) === JSON.stringify([...CORE].sort()), Object.keys(U).join(',')); });
await test('keyOf · clamp · uid', () => {
  ok(U.keyOf('a.b#c$d/e[f]g') === 'a_b_c_d_e_f_g', 'keyOf 금지 글자');
  ok(U.keyOf('') === '_' && U.keyOf(null) === '_', 'keyOf 빈 값');
  ok(U.keyOf('x'.repeat(60)).length === 40, 'keyOf 40자');
  ok(U.clamp(5, 0, 3) === 3 && U.clamp(-1, 0, 3) === 0 && U.clamp(2, 0, 3) === 2, 'clamp');
  ok(/^s[0-9a-z]{6,}$/.test(U.uid('s')), 'uid 꼴');
});
await test('lsGet · lsSet — localStorage 가 없어도 기본값', () => { ok(U.lsGet('없음', 7) === 7, 'lsGet 기본값'); U.lsSet('x', 1); });
for (const a of SHIM_APPS) {
  await test(`${a}/js/util.js = 공통을 그대로(같은 함수)`, async () => {
    const m = await import(`../../../${a}/js/util.js`);
    ok(JSON.stringify(Object.keys(m).sort()) === JSON.stringify([...CORE].sort()), Object.keys(m).join(','));
    for (const k of CORE) ok(m[k] === U[k], k + ' 가 다른 함수');
  });
}
await test('music/js/util.js = 공통 + 음악실 것(esc · svg · 준비 셈)', async () => {
  const m = await import('../../../music/js/util.js');
  for (const k of CORE) ok(m[k] === U[k], k + ' 가 다른 함수');
  for (const k of ['esc', 'svg', 'READY_SEC', 'readyCount']) ok(k in m, k + ' 없음');
  ok(m.esc('<a href="x">\'&') === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;', 'esc');
});
await test('생각판 util 은 따로(모양이 다름 — keyOf 규칙 · modal)', async () => {
  const m = await import('../../../thinkboard/js/util.js');
  ok(m.keyOf !== U.keyOf && m.keyOf('a b') === 'a b' && U.keyOf('a b') === 'a_b', '생각판 keyOf 가 공통과 같아짐');
});

// ── rpg-firebase ──
const fakeFb = (pw) => { const reads = []; const db = { ref: p => ({ once: async () => { reads.push(p); return { val: () => (p === 'classRPG_adminPw' ? pw : null) }; } }) };
  return { apps: [], inits: [], initializeApp(c) { this.inits.push(c); this.apps.push({}); }, database: () => db, reads, db }; };
await test('rpgDb — 처음 한 번만 학급 RPG 설정으로 앱을 만든다', () => {
  const fb = fakeFb(); const d1 = rpgDb(fb), d2 = rpgDb(fb);
  ok(fb.inits.length === 1 && fb.inits[0] === RPG_FIREBASE, '초기화 횟수 ' + fb.inits.length);
  ok(d1 === fb.db && d2 === fb.db, '데이터베이스');
  ok(RPG_FIREBASE.projectId === 'class-rpg-6f409' && /asia-southeast1\.firebasedatabase\.app$/.test(RPG_FIREBASE.databaseURL), '설정 값');
});
await test('rpgDb — 이미 앱이 있으면 그대로(두 번 만들지 않음)', () => { const fb = fakeFb(); fb.apps.push({}); rpgDb(fb); ok(fb.inits.length === 0, '또 만듦'); });
await test('gamedata.js FIREBASE_CONFIG 와 같은 값', () => {
  const g = read('gamedata.js'); for (const [k, v] of Object.entries(RPG_FIREBASE)) ok(g.includes(`${k}: "${v}"`) || g.includes(`${k}: '${v}'`), k + ' 다름');
});
await test('adminPwOK — 관리자 비밀번호만 읽고 글자로 견준다', async () => {
  const fb = fakeFb(1234);
  ok(await adminPwOK(fb.db, '1234') === true, '숫자 비번 = 글 비번');
  ok(await adminPwOK(fb.db, '123') === false, '틀린 비번');
  ok(await adminPwOK(fakeFb(null).db, 'null') === false, '비번이 없으면 늘 아님');
  ok(fb.reads.every(p => p === 'classRPG_adminPw'), '다른 곳 읽음: ' + fb.reads.join(','));
});
// 앱 저장소가 공통으로 이어졌나 — 같은 설정으로 한 번 만들고 · 선생님 비번은 관리자 비밀번호로
const fakeFb2 = (pw) => { const reads = []; const ref = p => ({ once: async () => { reads.push(p); return { val: () => (p === 'classRPG_adminPw' ? pw : null) }; }, child: c => ref(p + '/' + c), on() {}, off() {} });
  const fb = { apps: [], inits: [], reads, initializeApp(c) { this.inits.push(c); this.apps.push({}); }, database: Object.assign(() => ({ ref }), { ServerValue: { increment: n => ({ inc: n }) } }) }; return fb; };
for (const a of GATE_APPS) {
  await test(`${a}/js/store.js — 학급 RPG 설정으로 앱 만들기 · teacherOK = 관리자 비밀번호`, async () => {
    const { createStore } = await import(`../../../${a}/js/store.js`);
    const fb = fakeFb2('7777'), st = createStore({ sid: 's_1', name: '시험', fb });
    ok(st.online === true && fb.inits.length === 1 && fb.inits[0] === RPG_FIREBASE, '초기화');
    ok(await st.teacherOK('7777') === true && await st.teacherOK('1') === false, 'teacherOK');
    ok(fb.reads.every(p => p === 'classRPG_adminPw'), '다른 곳 읽음: ' + fb.reads.join(','));
    const guest = createStore({ fb });
    ok(guest.me.guest === true && await guest.teacherOK('아무거나') === true && fb.inits.length === 1, '손님 저장소');
  });
}
await test('thinkboard/js/store-rtdb.js — 학급 RPG 설정으로 앱 만들기', async () => {
  const { createRtdbStore } = await import('../../../thinkboard/js/store-rtdb.js');
  const fb = fakeFb2('1'); const st = createRtdbStore(fb); createRtdbStore(fb);
  ok(st.kind === 'rtdb' && fb.inits.length === 1 && fb.inits[0] === RPG_FIREBASE, '초기화');
});
for (const a of FB_APPS) {
  await test(`${a} — Firebase 설정 · 앱 만들기는 공통에서만`, () => {
    const files = fs.readdirSync(path.join(ROOT, a, 'js')).map(f => `${a}/js/${f}`);
    for (const f of files) { const s = read(f); ok(!/initializeApp|apiKey|classRPG_adminPw'\)\.once/.test(s), f + ' 에 설정 · 초기화 · 비번 읽기가 남음'); }
  });
}

// ── teacher-gate ──
{
  const ss = new Map(); let asked = 0, answer = null; const toasts = [];
  globalThis.sessionStorage = { getItem: k => ss.has(k) ? ss.get(k) : null, setItem: (k, v) => ss.set(k, String(v)) };
  globalThis.prompt = () => { asked++; return answer; };
  globalThis.document = { createElement: () => ({ classList: { add() {} }, remove() {}, append() {}, setAttribute() {}, addEventListener() {}, style: {} }), body: { append: el => toasts.push(el) } };
  const ctx = (guest, okPw) => ({ store: { me: { guest }, teacherOK: async pw => pw === okPw } });
  await test('문: 손님이면 묻지 않고 연다', async () => { asked = 0; ok(await teacherGate(ctx(true), 'x.teacher') === true && asked === 0, '물음'); });
  await test('문: 이 창에서 통과했으면(앱마다 키) 묻지 않는다', async () => { asked = 0; ss.set('ink.teacher', '1'); ok(await teacherGate(ctx(false), 'ink.teacher') === true && asked === 0, '물음'); ok(asked === 0, ''); });
  await test('문: 다른 앱 키는 통과 아님 · 비워 두면 닫힘', async () => { asked = 0; answer = null; ok(await teacherGate(ctx(false), 'art.teacher') === false && asked === 1, '열림'); });
  await test('문: 맞는 비번 → 열고 이 창에 표시', async () => { answer = 'pw'; ok(await teacherGate(ctx(false, 'pw'), 'paint.teacher') === true && ss.get('paint.teacher') === '1', '표시 없음'); });
  await test('문: 틀린 비번 → 닫고 알림 한 번', async () => { answer = 'no'; const n = toasts.length; ok(await teacherGate(ctx(false, 'pw'), 'print.teacher') === false && !ss.has('print.teacher') && toasts.length === n + 1, '알림'); });
  delete globalThis.document; delete globalThis.prompt; delete globalThis.sessionStorage;
}
for (const a of GATE_APPS) {
  await test(`${a}/js/teacher.js — 공통 문 · 키 '${a}.teacher' 그대로`, () => {
    const s = read(`${a}/js/teacher.js`);
    ok(s.includes(`teacherGate(ctx, '${a}.teacher')`), '키 다름');
    ok(!/prompt\(|sessionStorage/.test(s), '옛 문이 남음');
  });
}

// ── roster — 반 명단(선생님 화면) [APP-ROSTER-1] ──
const ROSTER_APPS = GATE_APPS;                                                      // 선생님 화면이 반 명단을 씀(생각판은 따로 · 수채화는 안 씀)
const STUDENTS = {   // 옛 숫자 키(낡은 본)가 먼저 · id 키(지금 본)가 뒤 — 운영 DB 꼴 [DUP-STUDENT-1]
  0: { id: 's2', name: '옛바다', pw: '0000', gold: 1 },
  s1: { id: 's1', name: '하늘', pw: '1111', gold: 50, inventory: [1, 2] },
  s2: { id: 's2', name: '바다', pw: '2222' },
  s3: { id: 's3', name: '', pw: '3' },            // 이름 없는 껍데기
  s4: { id: 's4', name: '숨김', hidden: true },
  s5: { name: '아이디없음' },
  'id_7.x': { id: 'id_7.x', name: '가람' },        // 키에 못 쓰는 글자 → 앱 저장 키(keyOf)와 같게
  s9: null,
};
const fakeRosterDb = (val, mode = 'ok') => { const reads = []; return { reads, ref: p => ({ once: () => { reads.push(p);
  if (mode === 'fail') return Promise.reject(new Error('permission_denied'));
  if (mode === 'hang') return new Promise(() => {});
  return Promise.resolve({ val: () => val }); } }) }; };
const quiet = async fn => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
await test('rosterOf — id · 이름만 · 두 벌은 id 키 본 · 껍데기 · 숨김 · 아이디 없음 빼기', () => {
  const r = rosterOf(STUDENTS);
  ok(JSON.stringify(r) === JSON.stringify([{ sid: 's2', name: '바다' }, { sid: 's1', name: '하늘' }, { sid: 'id_7_x', name: '가람' }]), JSON.stringify(r));
  ok(r.every(x => JSON.stringify(Object.keys(x)) === '["sid","name"]'), '다른 칸이 남음');
  ok(!/0000|1111|2222|pw|gold|inventory/.test(JSON.stringify(r)), '비밀번호 · 다른 칸이 새어 나감');
});
await test('rosterOf — 배열 · 빈 값 · 글자도 견딤', () => {
  ok(JSON.stringify(rosterOf([null, { id: 's1', name: '하늘' }])) === '[{"sid":"s1","name":"하늘"}]', '배열');
  ok(rosterOf(null).length === 0 && rosterOf(undefined).length === 0 && rosterOf('x').length === 0 && rosterOf(7).length === 0, '빈 값');
});
await test('loadRoster — classRPG_v3/students 한 번만 읽고 id · 이름만', async () => {
  const db = fakeRosterDb(STUDENTS), r = await loadRoster(db);
  ok(ROSTER_PATH === 'classRPG_v3/students' && db.reads.length === 1 && db.reads[0] === ROSTER_PATH, '읽은 곳: ' + db.reads.join(','));
  ok(r.length === 3 && r[1].sid === 's1' && r[1].name === '하늘' && !('pw' in r[1]), JSON.stringify(r));
});
await test('loadRoster — 못 읽으면(규칙 · 끊김) 빈 목록', async () => { ok((await quiet(() => loadRoster(fakeRosterDb(null, 'fail')))).length === 0, '실패인데 명단'); });
await test('loadRoster — 늦으면(ms) 빈 목록 · 선생님 화면이 멈추지 않음', async () => {
  const t0 = Date.now(), r = await loadRoster(fakeRosterDb(STUDENTS, 'hang'), { ms: 40 });
  ok(r.length === 0 && Date.now() - t0 < 1000, '기다림 ' + (Date.now() - t0) + 'ms');
});
await test('loadRoster — 학생이 없거나 db 가 없으면 빈 목록', async () => {
  ok((await loadRoster(fakeRosterDb(null))).length === 0, '학생 없음');
  ok((await loadRoster(null)).length === 0 && (await loadRoster({})).length === 0, 'db 없음');
});
await test('rosterFor — 손님 · 오프라인은 읽지 않음 · 온라인 저장소는 store.db 로', async () => {
  const db = fakeRosterDb(STUDENTS);
  ok((await rosterFor({ me: { guest: true }, online: false, db })).length === 0 && db.reads.length === 0, '손님인데 읽음');
  ok((await rosterFor({ me: { guest: false }, online: false, db })).length === 0 && db.reads.length === 0, '오프라인인데 읽음');
  ok((await rosterFor({ me: { guest: false }, online: true })).length === 0, 'db 없는 저장소');
  ok((await rosterFor(null)).length === 0, '저장소 없음');
  ok((await rosterFor({ me: { guest: false }, online: true, db })).length === 3 && db.reads.length === 1, '온라인인데 안 읽음');
});
await test('rosterRows — 기록 있는 아이 차례 그대로 · 명단에만 있는 아이는 뒤에 이름 차례 · teacher 빼기', () => {
  const roster = [{ sid: 's3', name: '하나' }, { sid: 's1', name: '다솜' }, { sid: 's2', name: '가람' }, { sid: 'teacher', name: '선생님' }];
  const { rows, idle } = rosterRows(['s9', 's1'], roster);
  ok(JSON.stringify(rows) === '["s9","s1","s2","s3"]', rows.join(','));
  ok(idle.size === 2 && idle.has('s2') && idle.has('s3') && !idle.has('s1') && !idle.has('s9'), [...idle].join(','));
  const none = rosterRows(['s1', 's2'], []);
  ok(JSON.stringify(none.rows) === '["s1","s2"]' && none.idle.size === 0, '명단 없으면 지금 그대로');
});
await test('rosterNames — 명단 이름이 앱 이름표 위에 · 원본은 그대로', () => {
  const names = { s1: '옛이름', s8: '명단밖' }, r = rosterNames(names, [{ sid: 's1', name: '새이름' }, { sid: 's2', name: '바다' }]);
  ok(r.s1 === '새이름' && r.s2 === '바다' && r.s8 === '명단밖', JSON.stringify(r));
  ok(names.s1 === '옛이름' && !('s2' in names), '원본이 바뀜');
  ok(JSON.stringify(rosterNames(undefined, [])) === '{}', '빈 이름표');
});
for (const a of ROSTER_APPS) {
  await test(`${a} — 저장소가 db 를 내보내고(손님은 없음) 선생님 화면이 반 명단으로 줄을 만든다`, async () => {
    const { createStore } = await import(`../../../${a}/js/store.js`);
    const st = createStore({ sid: 's_1', name: '시험', fb: fakeFb2('1') }), guest = createStore({ fb: fakeFb2('1') });
    ok(st.db && typeof st.db.ref === 'function', '온라인 저장소에 db 없음');
    ok(!guest.db && (await rosterFor(guest)).length === 0, '손님 저장소가 명단을 읽음');
    const t = read(`${a}/js/teacher.js`);
    ok(t.includes("from '../../common/roster.js'") && t.includes('rosterFor(ctx.store)') && /rosterRows\(/.test(t), '반 명단을 안 씀');
    ok(!/classRPG_v3/.test(t), 'teacher.js 가 명단 경로를 직접 읽음(공통으로)');
  });
}
await test('회색 줄 꼴 — subapp.css 에 .tmap tr.idle · td.idle-msg', () => {
  const c = read('common/subapp.css'); ok(c.includes('.tmap tr.idle .nm{') && c.includes('.tmap td.idle-msg{'), '꼴 없음');
});

// ── index.html · css ──
const importMap = h => JSON.parse(h.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
await test('공통 파일 ?v= — 부르는 index.html 모두 같은 값', () => {
  const seen = {};
  for (const a of FB_APPS) for (const [k, v] of Object.entries(importMap(read(`${a}/index.html`)))) if (k.startsWith('../common/')) (seen[k] = seen[k] || new Set()).add(v);
  for (const a of CSS_APPS) { const m = read(`${a}/index.html`).match(/href="(\.\.\/common\/subapp\.css[^"]*)"/); ok(m, a + ' 에 subapp.css 없음'); (seen.css = seen.css || new Set()).add(m[1]); }
  for (const [k, s] of Object.entries(seen)) ok(s.size === 1, `${k} 값이 여럿: ${[...s].join(' · ')}`);
  //  기본 다섯(util · rpg-firebase · teacher-gate · roster · subapp.css) + 과제를 받는 앱만 부르는 과제 계약 둘(assign · assign-core) [ASSIGN-MUSIC-1 · APP-ROSTER-1]
  const base = ['../common/util.js', '../common/rpg-firebase.js', '../common/teacher-gate.js', '../common/roster.js', 'css'];
  ok(base.every(k => seen[k]) && Object.keys(seen).every(k => base.includes(k) || /^\.\.\/common\/assign(-core)?\.js$/.test(k)), '공통 파일 ' + Object.keys(seen).join(','));
});
await test('subapp.css 는 앱 css 보다 먼저(같은 특이도 규칙의 차례 = 원래 줄 차례)', () => {
  for (const a of CSS_APPS) { const h = read(`${a}/index.html`), i = h.indexOf('../common/subapp.css'), j = h.search(/href="css\/[a-z]+\.css/); ok(i > 0 && j > i, a + ' 차례'); }
});
await test('subapp.css 줄이 앱 css 에 다시 생기지 않음(두 벌 막기)', () => {
  const rules = read('common/subapp.css').split('\n').filter(l => /\{.*\}/.test(l));
  ok(rules.length >= 30, '공통 규칙 수 ' + rules.length);
  for (const a of CSS_APPS) {   // 음악실 · 생각판은 바탕(:root · body)이 달라 공통 css 를 안 쓴다 — 같은 줄이 있어도 그대로 둔다
    const dir = path.join(ROOT, a, 'css');
    for (const f of fs.readdirSync(dir)) { const lines = new Set(fs.readFileSync(path.join(dir, f), 'utf8').split('\n')); const dup = rules.filter(r => lines.has(r)); ok(!dup.length, `${a}/css/${f} 에 공통 줄 ${dup.length}: ${dup[0]}`); }
  }
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`하위 앱 공통 뼈대 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
