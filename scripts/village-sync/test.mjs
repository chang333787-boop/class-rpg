// sync.js 시험 — 메모리 가짜 RTDB · 가상 시계 · 44차 저장본 모양 · 네트워크 0
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { makeClock, makeRTDB, makeStorage } from './fake-rtdb.mjs';
const require = createRequire(import.meta.url);
const VS = require(process.env.SYNC || '../../village/sync.js');

const SID = 's1774671589091';
const ROOT = '/classRPG_villages/' + SID;
const KEY = 'rpg.village.' + SID;
const results = [];
async function test(name, fn) { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); } }

/* 44차 serialize() 와 같은 평평한 v2 */
const V2 = (plotStr, extra = {}) => Object.assign({ v: 2, w: 256, h: 256, palette: ['house', 'road'], plotStr, clock: { t: 100, speed: 1 }, houses: {}, unlocked: [], goals: [], festSeen: false, dream: '', plots: ['4_4'], plotsEarned: 0, signs: {}, hist: [] }, extra);
const S = (c, n = 40) => c.repeat(n);
function world() { const clock = makeClock(); return { clock, rtdb: makeRTDB(clock) }; }
function device(w, { storage, sid = SID, askAnswer = false } = {}) {
  storage = storage || makeStorage();
  const notices = []; let asked = 0;
  const sync = VS.create({ sid, storage, fetch: w.rtdb.fetch, now: () => w.clock.t, setTimeout: w.clock.setTimeout, clearTimeout: w.clock.clearTimeout,
    watch: w.rtdb.watch, ask: async () => { asked++; return askAnswer; }, notice: t => notices.push(t) });
  return { sync, storage, notices, get asked() { return asked; }, save: obj => storage.setItem(KEY, JSON.stringify(obj)), local: () => JSON.parse(storage.getItem(KEY) || 'null') };
}
// from = 로그 순번(가상 시계는 boot 동안 멈춰 있어 시각으로 자르면 boot 의 PATCH 까지 센다)
const rootPatches = (w, from = 0) => w.rtdb.log.slice(from).filter(l => l.method === 'PATCH' && l.path === ROOT && !l.keepalive);
function seedRemote(w, plots, { dev = 'd-other', savedAt, palette = ['house', 'road'], houses } = {}) {
  w.rtdb.set(ROOT, { meta: { v: 2, w: 256, h: 256, palette, savedAt: savedAt ?? w.clock.t, dev, plotsOpen: ['4_4'], houses: houses || {} }, plots });
}
const book = d => JSON.parse(d.storage.getItem(KEY + '.sync') || 'null');

/* ───────── 결정표 ───────── */
await test('표1 로컬 없음 · 원격 없음 → 새 판 · 마을이 저장하면 2초 뒤 올라감', async () => {
  const w = world(); const d = device(w);
  assert.equal((await d.sync.boot()).act, 'new'); d.sync.attach();
  assert.equal(rootPatches(w).length, 0);
  d.save(V2({ '4_4': S('A') })); await w.clock.advance(3500);
  assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), S('A'));
});
await test('표2 로컬 없음 · 원격 있음 → 원격을 마을 저장본 자리에 써 줌(44차 모양)', async () => {
  const w = world(); seedRemote(w, { '4_4': S('R') });
  const d = device(w); assert.equal((await d.sync.boot()).act, 'remote');
  const l = d.local(); assert.equal(l.v, 2); assert.equal(l.plotStr['4_4'], S('R')); assert.deepEqual(l.plots, ['4_4']);
  assert.equal(rootPatches(w).length, 0);
});
await test('표3 로컬 있음(장부 없음) · 원격 없음 → 통째로 올림', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': S('L'), '4_5': S('M') }));
  assert.equal((await d.sync.boot()).act, 'uploadAll');
  assert.equal(w.rtdb.get(ROOT + '/plots/4_5'), S('M')); assert.equal(typeof w.rtdb.get(ROOT + '/meta/savedAt'), 'number');
  assert.deepEqual(Object.values(w.rtdb.get(ROOT + '/meta/plotsOpen')), ['4_4']);   // 직접 조회는 저장된 모양(객체) 그대로
});
await test('표4 로컬 = 마지막으로 올린 것 · 원격 있음 → 원격', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': S('L') }));
  await d.sync.boot(); d.sync.close();
  seedRemote(w, { '4_4': S('R') }, { savedAt: w.clock.t + 10 });
  const d2 = device(w, { storage: d.storage }); assert.equal((await d2.sync.boot()).act, 'remote');
  assert.equal(d2.local().plotStr['4_4'], S('R'));
});
await test('표5 로컬 바뀜 · 원격 없음 → 올림', async () => {
  const w = world(); const st = makeStorage(); st.setItem(KEY + '.sync', JSON.stringify({ h: { '4_4': 'x:1' }, m: 'y', baseAt: 5 }));
  const d = device(w, { storage: st }); d.save(V2({ '4_4': S('L') }));
  assert.equal((await d.sync.boot()).act, 'uploadAll'); assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), S('L'));
});
await test('표6 로컬 바뀜 · 원격 savedAt ≤ baseAt → 바뀐 구역만 먼저 올림', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': S('L'), '4_5': S('K') })); await d.sync.boot(); d.sync.close();
  d.save(V2({ '4_4': S('N'), '4_5': S('K') }));
  const d2 = device(w, { storage: d.storage }); const from = w.rtdb.log.length;
  assert.equal((await d2.sync.boot()).act, 'pushDirty');
  const p = rootPatches(w, from).pop().body; assert.ok('plots/4_4' in p && !('plots/4_5' in p), '바뀐 구역만');
  assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), S('N'));
});
await test('표7 로컬 바뀜 · 원격이 더 새것(다른 기기) → 원격 + 로컬 원문 사본 + 알림 · 원격 안 덮음', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': S('L') })); await d.sync.boot(); d.sync.close();
  d.save(V2({ '4_4': S('N') }));
  seedRemote(w, { '4_4': S('R') }, { savedAt: w.clock.t + 5000 });
  const d2 = device(w, { storage: d.storage }); assert.equal((await d2.sync.boot()).act, 'remoteBackup');
  assert.equal(d2.local().plotStr['4_4'], S('R'));
  assert.equal(JSON.parse(JSON.parse(d.storage.getItem(KEY + '.sync-backup')).raw).plotStr['4_4'], S('N'));
  assert.equal(d2.notices.length, 1); assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), S('R'));
});
await test('보강1 동기화 전부터 있던 로컬(장부 없음) · 원격 있음 → 사본 + 알림', async () => {
  const w = world(); seedRemote(w, { '4_4': S('R') });
  const d = device(w); d.save(V2({ '4_4': S('L') }));
  assert.equal((await d.sync.boot()).act, 'remoteBackup'); assert.ok(d.storage.getItem(KEY + '.sync-backup'));
});
await test('보강2 원격 마지막 쓰기가 이 기기(keepalive 도착) → 로컬 믿음 · 알림 없음', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': S('L') })); await d.sync.boot();
  await w.clock.advance(5000);   // keepalive 의 savedAt 이 baseAt 보다 뒤가 되게 — 안 그러면 '≤ baseAt' 규칙으로 통과해 버린다
  d.save(V2({ '4_4': S('N') })); d.sync.onPageHide(); await w.clock.settle(); d.sync.close();
  assert.ok(w.rtdb.get(ROOT + '/meta/savedAt') > book(d).baseAt, '시험 조건: 원격이 더 새것이어야 함');
  const d2 = device(w, { storage: d.storage }); assert.equal((await d2.sync.boot()).act, 'pushDirty'); assert.equal(d2.notices.length, 0);
});
await test('V1a v1 저장본 · 원격 있음 → 원격 + v1 원문 사본(말없이 버리지 않음)', async () => {
  const w = world(); seedRemote(w, { '4_4': S('R') });
  const d = device(w); d.storage.setItem(KEY, JSON.stringify({ v: 1, w: 256, h: 256, items: [{ id: 'road', x: 1, y: 1, rot: 0 }] }));
  assert.equal((await d.sync.boot()).act, 'remoteBackup');
  assert.equal(JSON.parse(JSON.parse(d.storage.getItem(KEY + '.sync-backup')).raw).v, 1);
});
await test('V1b v1 저장본 · 원격 없음 → 열 때는 안 올림 · 마을이 v2 로 바꿔 쓰면 그때 올림', async () => {
  const w = world(); const d = device(w); d.storage.setItem(KEY, JSON.stringify({ v: 1, w: 256, h: 256, items: [{ id: 'road', x: 1, y: 1, rot: 0 }] }));
  assert.equal((await d.sync.boot()).act, 'new'); d.sync.attach(); assert.equal(rootPatches(w).length, 0);
  d.save(V2({ '0_0': 'AE' }, { palette: ['road'] })); await w.clock.advance(3500);
  assert.equal(w.rtdb.get(ROOT + '/plots/0_0'), 'AE');
});

/* ───────── 44차 대조에서 나온 것 ───────── */
await test('P1 팔레트가 밀려 손대지 않은 구역 문자열도 바뀜 → 그 구역까지 palette 와 한 번에 올림', async () => {
  const w = world(); const d = device(w);
  d.save(V2({ '4_4': S('AE'), '5_4': 'AE' }, { palette: ['road'] })); await d.sync.boot(); d.sync.attach();
  const from = w.rtdb.log.length;
  d.save(V2({ '4_4': S('AF'), '5_4': 'AFAA' }, { palette: ['bush', 'road'] }));
  await w.clock.advance(3500);
  const p = rootPatches(w, from); assert.equal(p.length, 1);
  assert.ok('plots/4_4' in p[0].body && 'plots/5_4' in p[0].body, '손대지 않은 4_4 도 같이');
  assert.deepEqual(p[0].body.meta.palette, ['bush', 'road']);
  assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), S('AF'));
});
await test('P2 keepalive 는 전부 아니면 안 보냄(palette 가 바뀐 채 일부만 가면 손상)', async () => {
  const w = world(); const d = device(w);
  const big = {}; for (let i = 0; i < 40; i++) big[(i % 8) + '_' + ((i / 8) | 0)] = S('AE', 1280);
  d.save(V2(big, { palette: ['road'] })); await d.sync.boot();
  const big2 = {}; for (const k in big) big2[k] = S('AF', 1280);
  d.save(V2(big2, { palette: ['bush', 'road'] }));
  assert.equal(d.sync.onPageHide(), 'too-big'); assert.equal(w.rtdb.log.filter(l => l.keepalive && l.path === ROOT).length, 0);   // 데이터 경로만(닫힐 때 session 비우기는 따로 나감)
});
await test('P3 houses 숫자 키 → 원격은 c 키 · 촘촘해서 배열로 돌아와도 되살림 · 마을 모양은 숫자 키', async () => {
  const w = world(); const d = device(w);
  d.save(V2({ '4_4': 'AE' }, { houses: { 0: [1, 1, -1], 1: [2, 2, -1], 2: [1, 3, -1] } })); await d.sync.boot(); d.sync.close();
  assert.deepEqual(Object.keys(w.rtdb.get(ROOT + '/meta/houses')).sort(), ['c0', 'c1', 'c2']);
  seedRemote(w, { '4_4': 'AE' }, { savedAt: w.clock.t + 10, houses: { 0: [1, 1, -1], 1: [2, 2, -1] } });
  const d2 = device(w, { storage: makeStorage() }); await d2.sync.boot();
  assert.deepEqual(d2.local().houses, { 0: [1, 1, -1], 1: [2, 2, -1] });
});
await test('P4 빈 배열(unlocked·goals)은 원격에서 사라져도 마을 모양에서는 [] 로', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': 'AE' })); await d.sync.boot(); d.sync.close();
  assert.equal(w.rtdb.get(ROOT + '/meta/unlocked'), null);
  const d2 = device(w, { storage: makeStorage() }); await d2.sync.boot();
  const l = d2.local(); assert.deepEqual(l.unlocked, []); assert.deepEqual(l.goals, []); assert.deepEqual(l.hist, []);
});

/* ───────── session ───────── */
await test('S1 A 주인 · B 가 30초 뒤 → 묻고 · [구경만] → B 는 쓰지 않음', async () => {
  const w = world(); const A = device(w); A.save(V2({ '4_4': 'AE' })); await A.sync.boot(); A.sync.attach();
  await w.clock.advance(30000);
  const B = device(w, { askAnswer: false }); const r = await B.sync.boot(); B.sync.attach();
  assert.equal(B.asked, 1); assert.equal(r.mode, 'view');
  const n = rootPatches(w).length; B.save(V2({ '4_4': 'AF' })); await w.clock.advance(12000);
  assert.equal(rootPatches(w).length, n);
});
await test('S2 B [여기서 계속] → A 즉시 구경 · A 이후 저장은 안 나감 · A 장부는 그대로', async () => {
  const w = world(); const A = device(w); A.save(V2({ '4_4': 'AE' })); await A.sync.boot(); A.sync.attach();
  await w.clock.advance(20000);
  const B = device(w, { askAnswer: true }); assert.equal((await B.sync.boot()).mode, 'owner'); await w.clock.settle();
  assert.equal(A.sync.state.owner, false); assert.equal(A.notices.length, 1);
  const bookA = JSON.stringify(book(A));
  A.save(V2({ '4_4': 'AE', '4_6': 'AF' })); await w.clock.advance(15000);
  assert.equal(w.rtdb.get(ROOT + '/plots/4_6'), null); assert.equal(JSON.stringify(book(A)), bookA);
  assert.equal(w.rtdb.get(ROOT + '/session/dev'), B.sync.state.dev);
});
await test('S3 A 사라지고 90초 넘음 → B 는 묻지 않음', async () => {
  const w = world(); const A = device(w); await A.sync.boot(); A.sync.close(); await w.clock.advance(91000);
  const B = device(w); assert.equal((await B.sync.boot()).mode, 'owner'); assert.equal(B.asked, 0);
});
await test('S4 동시에 빈 session → 하나만(412)', async () => {
  const w = world(); const A = device(w), B = device(w);
  const r = await Promise.all([A.sync._claim(false), B.sync._claim(false)]); assert.deepEqual(r.sort(), ['ask', 'owner']);
});
await test('S5 심장박동은 at 만 · 주인 잃으면 멈춤', async () => {
  const w = world(); const A = device(w); await A.sync.boot(); await w.clock.advance(61000);
  const beats = w.rtdb.log.filter(l => l.method === 'PATCH' && l.path === ROOT + '/session');
  assert.ok(beats.length >= 1 && beats.every(l => Object.keys(l.body).join() === 'at'));
  const B = device(w, { askAnswer: true }); await B.sync.boot(); await w.clock.settle();
  const n = w.rtdb.log.filter(l => l.path === ROOT + '/session' && l.method === 'PATCH').length;
  await w.clock.advance(1000); assert.equal(w.rtdb.log.filter(l => l.path === ROOT + '/session' && l.method === 'PATCH').length, n);
});
await test('S6 session 지워지면 주인은 조용히 다시', async () => {
  const w = world(); const A = device(w); await A.sync.boot();
  w.rtdb.set(ROOT + '/session', null); await w.clock.settle(); await w.clock.settle();
  assert.equal(w.rtdb.get(ROOT + '/session/dev'), A.sync.state.dev);
});

await test('S7 닫힐 때 session 을 비움 → 곧바로 다른 기기에서 열어도 묻지 않음', async () => {
  const w = world(); const A = device(w); A.save(V2({ '4_4': 'AE' })); await A.sync.boot(); A.sync.attach();
  A.sync.onPageHide(); await w.clock.settle(); A.sync.close();
  assert.equal(w.rtdb.get(ROOT + '/session/at'), 0); assert.equal(w.rtdb.get(ROOT + '/session/dev'), A.sync.state.dev);
  const B = device(w); const r = await B.sync.boot();
  assert.equal(B.asked, 0); assert.equal(r.mode, 'owner');
});
await test('S8 주인을 잃은 기기가 닫혀도 새 주인 session 은 그대로', async () => {
  const w = world(); const A = device(w); await A.sync.boot(); A.sync.attach();
  await w.clock.advance(10000);
  const B = device(w, { askAnswer: true }); await B.sync.boot(); await w.clock.settle();
  const atB = w.rtdb.get(ROOT + '/session/at');
  assert.equal(A.sync.onPageHide(), 'skip'); await w.clock.settle();
  assert.equal(w.rtdb.get(ROOT + '/session/dev'), B.sync.state.dev); assert.equal(w.rtdb.get(ROOT + '/session/at'), atB);
});

/* ───────── 묶어 보내기 ───────── */
await test('B1 마을이 0.3초 간격으로 3번 저장 → 조용해진 뒤 PATCH 1번', async () => {
  const w = world(); const d = device(w); d.save(V2({})); await d.sync.boot(); d.sync.attach(); const from = w.rtdb.log.length;
  d.save(V2({ '4_4': 'AE' })); await w.clock.advance(300); d.save(V2({ '4_4': 'AE', '4_5': 'AE' })); await w.clock.advance(300); d.save(V2({ '4_4': 'AE', '4_5': 'AE', '5_5': 'AE' }));
  await w.clock.advance(4000);
  const p = rootPatches(w, from); assert.equal(p.length, 1);
  assert.deepEqual(Object.keys(p[0].body).filter(k => k.startsWith('plots/')).sort(), ['plots/4_4', 'plots/4_5', 'plots/5_5']);
});
await test('B2 12초 동안 0.5초마다 저장 → 10초에 한 번 + 끝나고 한 번 = 2번', async () => {
  const w = world(); const d = device(w); d.save(V2({})); await d.sync.boot(); d.sync.attach(); const from = w.rtdb.log.length;
  for (let i = 0; i < 24; i++) { d.save(V2({ '4_4': S('A', 2 + i) })); await w.clock.advance(500); }
  await w.clock.advance(4000);
  const p = rootPatches(w, from); assert.equal(p.length, 2, 'PATCH ' + p.length);
  assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), S('A', 25));
});
await test('B3 PATCH 실패 → 장부 안 바뀜 · 다음 차례에 다시 → 성공', async () => {
  const w = world(); const d = device(w); d.save(V2({})); await d.sync.boot(); d.sync.attach();
  w.rtdb.failPatches(1); d.save(V2({ '4_4': 'AE' }));
  await w.clock.advance(3100); assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), null);
  await w.clock.advance(3000); assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), 'AE');
});
await test('B4 구역을 다 치움(마을 저장본에서 키가 빠짐) → 원격에서도 지움', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': 'AE', '4_5': 'AE' })); await d.sync.boot(); d.sync.attach();
  d.save(V2({ '4_5': 'AE' })); await w.clock.advance(3500);
  assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), null); assert.equal(w.rtdb.get(ROOT + '/plots/4_5'), 'AE');
});
await test('B5 meta 만 바뀜(꿈나무) → plots 키 없이 meta 만', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': 'AE' })); await d.sync.boot(); d.sync.attach(); const from = w.rtdb.log.length;
  d.save(V2({ '4_4': 'AE' }, { dream: '꿈' })); await w.clock.advance(3500);
  const p = rootPatches(w, from); assert.equal(p.length, 1); assert.deepEqual(Object.keys(p[0].body), ['meta']);
  assert.equal(w.rtdb.get(ROOT + '/meta/dream'), '꿈');
});
await test('B6 내용이 같으면 올리지 않음(저장본 글자만 다름)', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': 'AE', '4_5': 'AF' })); await d.sync.boot(); d.sync.attach(); const from = w.rtdb.log.length;
  d.save(V2({ '4_5': 'AF', '4_4': 'AE' })); await w.clock.advance(12000);   // 글자는 다르고(키 순서) 내용은 같음
  assert.equal(rootPatches(w, from).length, 0);
});
await test('B7 guest → 네트워크 0번', async () => {
  const w = world(); const d = device(w, { sid: 'guest' });
  await d.sync.boot(); d.sync.attach(); d.storage.setItem('rpg.village.guest', JSON.stringify(V2({ '4_4': 'AE' }))); await w.clock.advance(20000); d.sync.onPageHide();
  assert.equal(w.rtdb.log.length, 0);
});
await test('B8 keepalive 가 떨어져도 다음 열기에 올림', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': 'AE' })); await d.sync.boot();
  d.save(V2({ '4_4': 'AF' })); w.rtdb.dropKeepalive(true); assert.equal(d.sync.onPageHide(), 'sent'); d.sync.close();
  await w.clock.advance(100000);
  const d2 = device(w, { storage: d.storage }); assert.equal((await d2.sync.boot()).act, 'pushDirty');
  assert.equal(w.rtdb.get(ROOT + '/plots/4_4'), 'AF');
});

await test('B9 마을 이름(meta.name) — 12자까지 올리고 다른 기기가 받음 · 없으면 키 없음', async () => {
  const w = world(); const d = device(w); d.save(V2({ '4_4': 'AE' })); await d.sync.boot(); d.sync.attach();
  assert.equal(w.rtdb.get(ROOT + '/meta/name'), null);                      // 이름 없음 → 키 없음
  d.save(V2({ '4_4': 'AE' }, { name: '  우리 반 꿈나무 마을이에요  ' })); await w.clock.advance(3500);
  assert.equal(w.rtdb.get(ROOT + '/meta/name'), '우리 반 꿈나무 마을이');      // 앞뒤 공백 빼고 12자
  d.sync.onPageHide(); d.sync.close(); await w.clock.advance(100000);
  const d2 = device(w); await d2.sync.boot();                               // 다른 기기(빈 저장소)
  assert.equal(d2.local().name, '우리 반 꿈나무 마을이');
});

const pass = results.filter(r => r[0] === 'PASS').length, fail = results.length - pass;
for (const r of results) console.log((r[0] === 'PASS' ? '✅' : '❌') + ' ' + r[1] + (r[2] ? '  ← ' + r[2] : ''));
console.log(`\n요약: PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
