#!/usr/bin/env node
// 우리반 성장 RPG — 골드 유실 재현 하네스 (GOLD-LOSS-SIM-1)
//
//  무엇: 실제 gamedata.js 의 DB 객체를 기기마다 하나씩(vm) 띄우고, 가짜 Realtime Database 서버로 잇는다.
//        학생 화면·교사 화면이 동시에 저장할 때 **서버의 학생 totalGold 가 실제로 준 골드보다 적어지는지** 센다.
//        운영 Firebase·네트워크·브라우저 없음. 가상 시계라 매번 같은 결과(시드 고정).
//
//  가짜 서버가 흉내 내는 RTDB SDK 성질(결과를 좌우하는 것만):
//   · 쓰기는 그 기기에서 **바로** 반영되고 value 이벤트가 바로 뜬다(낙관적 로컬 반영).
//   · 서버 반영·다른 기기 전달은 지연(up/down ms) 뒤. 서버에서 온 값 위에 **아직 확인 안 된 내 쓰기를 겹쳐** 보여 준다.
//     → 그래서 "내 옛 에코가 늦게 와서 내 새 값을 되돌리는" 일은 SDK에서는 없다(시나리오 C로 확인).
//   · ServerValue.increment 는 서버에서 더한다(goldDaily).
//
//  재는 것: 기대 totalGold(처음 값 + 모든 지급) − 서버 최종 totalGold = 유실.
//           goldDaily 합과 비교해 "로그는 남았는데 학생 값은 빠진" 운영 증상과 같은 모양인지도 본다.
//
//  사용: node scripts/unit/gold-sync-sim.mjs            (시나리오 M1·A~E + 무작위 200판 + 교사 승인 반영 R1·R2)
//        node scripts/unit/gold-sync-sim.mjs --expect-fixed   (수정 뒤: 유실이 하나라도 있거나 교사 승인 반영이 2초를 넘으면 exit 1)
//  기본 모드는 재현용이라 유실이 나와도 exit 0, 대신 요약에 REPRO 로 적는다.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMEDATA = fs.readFileSync(path.join(ROOT, 'gamedata.js'), 'utf8');
const ADMIN = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const EXPECT_FIXED = process.argv.includes('--expect-fixed');
// 실험 스위치: 학생 화면이 logGold 를 saveStudent **뒤에** 부르면(순서만 바꾸면) 무엇이 남는지 본다. 앱 코드는 안 바꾼다.
const LOG_AFTER_SAVE = process.argv.includes('--log-after-save');

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const seg = (p) => String(p || '').split('/').filter(Boolean);
function getAt(tree, p) { let c = tree; for (const k of seg(p)) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : c; }
function setAt(tree, p, val) {
  const ks = seg(p); if (!ks.length) return clone(val);
  const root = tree && typeof tree === 'object' ? tree : {};
  let c = root;
  for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; }
  if (val === null || val === undefined) delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = clone(val);
  return root;
}

// ── 가상 시계 ──────────────────────────────────────────────
function makeClock() {
  let now = 0, seq = 0; const q = [];
  return {
    get now() { return now; },
    at(t, fn) { q.push({ t, s: seq++, fn }); },
    after(ms, fn) { this.at(now + Math.max(0, ms), fn); },
    // 브라우저처럼 매 작업 뒤 마이크로태스크(then/finally)를 비운다.
    //  이걸 안 하면 saveStudent 의 .finally → setTimeout(_saving=false) 가 영영 안 걸려 가짜 유실이 난다(1차판에서 겪음).
    async run(until = Infinity) {
      const drain = () => new Promise((r) => setImmediate(r));
      await drain();
      while (q.length) {
        q.sort((a, b) => a.t - b.t || a.s - b.s);
        if (q[0].t > until) break;
        const e = q.shift(); now = e.t; e.fn();
        await drain();
      }
    },
  };
}

// ── 가짜 RTDB 서버 + 기기 ─────────────────────────────────
function makeWorld({ seedData, clock }) {
  const server = { tree: { classRPG_v3: clone(seedData) } };
  const clients = [];
  let wid = 0;

  function makeClient(name, { up = 60, down = 60 } = {}) {
    const c = { name, up, down, serverView: clone(server.tree), pending: [], listeners: [], deliverAt: 0 };
    const INC = '__inc__';
    const applyOp = (tree, op) => {
      if (op.kind === 'set') return setAt(tree, op.path, op.value);
      let t = tree;
      for (const k of Object.keys(op.value)) {
        const v = op.value[k];
        const full = op.path + '/' + k;
        if (v && typeof v === 'object' && INC in v) t = setAt(t, full, (Number(getAt(t, full)) || 0) + v[INC]);
        else t = setAt(t, full, v);
      }
      return t;
    };
    c.localView = () => { let t = clone(c.serverView); for (const op of c.pending) t = applyOp(t, op); return t; };
    const fire = () => { const v = c.localView(); for (const l of c.listeners) l.cb(snap(getAt(v, l.path))); };
    const snap = (v) => { const val = clone(v); return { val: () => val, exists: () => val != null }; };

    const write = (kind, p, value) => new Promise((resolve) => {
      const op = { id: ++wid, kind, path: p, value: clone(value) };
      c.pending.push(op);
      fire();                                   // 낙관적 로컬 반영 — 바로 이벤트
      clock.after(c.up, () => {                 // 서버 도착
        server.tree = applyOp(server.tree, op);
        const state = clone(server.tree);
        for (const other of clients) {
          // 기기마다 도착 순서 보장(FIFO)
          const t = Math.max(clock.now + other.down, other.deliverAt);
          other.deliverAt = t;
          clock.at(t, () => {
            other.serverView = clone(state);
            if (other === c) { other.pending = other.pending.filter(x => x.id !== op.id); resolve(); }
            other._fire();
          });
        }
      });
    });
    c._fire = fire;

    const ref = (p) => {
      p = seg(p).join('/');
      return {
        child: (k) => ref(p + '/' + k),
        once: async () => snap(getAt(c.localView(), p)),
        on: (ev, cb) => { c.listeners.push({ path: p, cb }); clock.after(0, () => cb(snap(getAt(c.localView(), p)))); return cb; },
        off: () => {},
        set: (v) => write('set', p, v),
        update: (o) => write('update', p, o),
        remove: () => write('set', p, null),
        transaction: (fn) => { const out = fn(clone(getAt(c.localView(), p))); return out === undefined ? Promise.resolve() : write('set', p, out); },
      };
    };
    const database = () => ({ ref });
    database.ServerValue = { increment: (n) => ({ [INC]: n }) };
    const firebase = { apps: [], initializeApp() { this.apps.push({}); }, database };

    const sb = {
      console: { log() {}, warn() {}, error() {} }, firebase, window: {},
      setTimeout: (fn, ms) => clock.after(ms || 0, fn), clearTimeout() {},
      document: { getElementById: () => null, querySelectorAll: () => [] },
      localStorage: { getItem: () => null, setItem() {} }, alert() {},
      Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(Date.UTC(2026, 8, 15, 1, 0, 0) + clock.now); } static now() { return Date.UTC(2026, 8, 15, 1, 0, 0) + clock.now; } },
    };
    sb.globalThis = sb; sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(GAMEDATA + '\n;globalThis.__DB = DB; globalThis.__Utils = Utils;', sb);
    c.sb = sb; c.DB = sb.__DB;
    clients.push(c);
    return c;
  }
  return { server, clients, makeClient };
}

// ── 화면 흉내: student.js / admin.js 의 실제 코드 경로 ─────────
async function bootStudent(world, clock, sid, opt) {
  const c = world.makeClient('학생:' + sid, opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  // student.js window.onload 의 onDataChange — CUR 갱신 부분만 그대로
  c.CUR = JSON.parse(JSON.stringify(c.DB.getStudent(sid)));          // doLogin: CUR = 깊은 복사
  c.DB.onDataChange(() => { const fresh = c.DB.getStudent(c.CUR.id); if (fresh) c.CUR = fresh; });
  c.earn = (gold, source = 'battle') => {                             // 전투 승리(student.js 2939~2947)와 같은 순서
    c.CUR.gold += gold;
    c.CUR.totalGold = (c.CUR.totalGold || 0) + gold;
    if (LOG_AFTER_SAVE) { c.DB.saveStudent(c.CUR); c.DB.logGold(c.CUR.id, source, gold); }
    else { c.DB.logGold(c.CUR.id, source, gold); c.DB.saveStudent(c.CUR); }   // 지금 student.js 순서(2951·3670·4102·4121·11408)
    world.granted += gold;
  };
  return c;
}
function sliceFn(src, name) {
  const m = new RegExp(`^function ${name}\\s*\\(`, 'm').exec(src);
  if (!m) throw new Error('admin.js 함수 없음: ' + name);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) return src.slice(m.index, i + 1); }
  throw new Error('중괄호: ' + name);
}
async function bootTeacher(world, clock, opt) {
  const c = world.makeClient('교사', opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  c.DB.onDataChange(() => {});
  // admin.js 의 approveReward / approveSingle 을 그대로 잘라 넣는다(화면 함수는 빈 스텁)
  vm.runInContext(`var notify=function(){}, renderAll=function(){};\n${sliceFn(ADMIN, 'approveReward')}\n${sliceFn(ADMIN, 'approveSingle')}\n${sliceFn(ADMIN, 'approveAll')}\n` +
    'globalThis.__approveSingle = approveSingle; globalThis.__approveAll = approveAll;', c.sb);
  c.approveSingle = (sid, rid) => c.sb.__approveSingle(sid, rid);
  c.approveAll = () => c.sb.__approveAll();
  c.saveSettingsTouch = () => c.DB.saveSettings({ ...(c.DB.getSettings() || {}), touchedAt: clock.now });
  return c;
}

function seed({ students = 3, pendingGold = 0 } = {}) {
  const list = {};
  for (let i = 1; i <= students; i++) {
    const id = 's17736210607' + String(60 + i);
    list[id] = { id, name: '학생' + i, pw: 'x', level: 5, exp: 500, gold: 1000, totalGold: 1000,
      pendingRewards: pendingGold ? [{ id: 'rw_' + i, label: '퀘스트', type: 'quest', boardQuestType: 'special', gold: pendingGold, exp: 10 }] : [] };
  }
  return { students: list, settings: { className: '시험' }, questLogs: {}, boardQuests: [] };
}
const sidOf = (i) => 's17736210607' + String(60 + i);

function tally(world, sid, startTotal) {
  const s = getAt(world.server.tree, 'classRPG_v3/students/' + sid) || {};
  const daily = getAt(world.server.tree, 'classRPG_v3/goldDaily') || {};
  let logged = 0;
  for (const k of Object.keys(daily)) if (daily[k].s === sid) for (const src of ['farm', 'battle', 'infinite', 'quest', 'study', 'artwork', 'english']) logged += daily[k][src] || 0;
  return { total: s.totalGold, expected: startTotal + (world.grantedBy[sid] || 0), logged, pending: (s.pendingRewards || []).length };
}

// ── 시나리오 ──────────────────────────────────────────────
const results = [];
async function scenario(name, desc, body) {
  const clock = makeClock();
  const world = makeWorld({ seedData: body.seed, clock });
  world.granted = 0; world.grantedBy = {};
  const out = await body.run({ world, clock });
  await clock.run();
  const t = tally(world, out.sid, out.startTotal ?? 1000);
  const lost = t.expected - t.total;
  results.push({ name, desc, lost, ...t, note: out.note ? out.note(t) : '' });
}
const grant = (world, sid, g) => { world.grantedBy[sid] = (world.grantedBy[sid] || 0) + g; };

await scenario('M1', '학생 혼자, 한가할 때 전투 승리 1번(10G) — 동시 저장 전혀 없음', {
  seed: seed(),
  async run({ world, clock }) {
    const sid = sidOf(1);
    const stu = await bootStudent(world, clock, sid, { up: 50, down: 50 });
    clock.at(5000, () => { stu.earn(10); grant(world, sid, 10); });
    return { sid, note: () => 'logGold 의 로컬 이벤트가 동기로 떠서 CUR 이 저장 전에 옛 캐시로 바뀌는지' };
  },
});

await scenario('A', '학생이 전투로 계속 저장하는 중에 교사가 보상 승인(50G)', {
  seed: seed({ pendingGold: 50 }),
  async run({ world, clock }) {
    const sid = sidOf(1);
    const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
    const tea = await bootTeacher(world, clock, { up: 30, down: 30 });
    const earnAt = (t, g) => clock.at(t, () => { stu.earn(g); grant(world, sid, g); });
    for (let t = 1000; t <= 4000; t += 300) earnAt(t, 7);                 // 무한배틀·전투 — 0.3초마다 저장
    clock.at(2000, () => { tea.approveSingle(sid, 'rw_1'); grant(world, sid, 50); });
    return { sid, note: (x) => `남은 승인 대기 ${x.pending}건(0이어야 함)` };
  },
});

await scenario('B', '교사가 [전체 승인] 누르는 사이 학생이 전투 승리(30G), 교사가 곧이어 같은 학생 한 건 더 승인', {
  seed: (() => { const d = seed({ students: 7, pendingGold: 20 }); d.students[sidOf(1)].pendingRewards.push({ id: 'rw_1b', label: '추가', type: 'quest', boardQuestType: 'special', gold: 40, exp: 0 }); return d; })(),
  async run({ world, clock }) {
    const sid = sidOf(1);
    const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
    const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
    // 교사가 다른 학생들 먼저 전체 승인(학생1 것은 남겨 두려고 학생1 대기 1건만 비움)
    const s1 = tea.DB.getStudent(sid); const keep = s1.pendingRewards; s1.pendingRewards = [];
    clock.at(1000, () => { tea.approveAll(); tea.DB.getStudent(sid).pendingRewards = keep; });
    clock.at(1100, () => { stu.earn(30); grant(world, sid, 30); });
    clock.at(1400, () => { tea.approveSingle(sid, 'rw_1b'); grant(world, sid, 40); });
    return { sid };
  },
});

await scenario('C', '느린 크롬북(왕복 1.2초) 혼자 연속 저장 — "내 옛 에코가 늦게 와 되돌림" 가설', {
  seed: seed(),
  async run({ world, clock }) {
    const sid = sidOf(1);
    const stu = await bootStudent(world, clock, sid, { up: 600, down: 600 });
    for (let t = 1000; t <= 6000; t += 700) clock.at(t, () => { stu.earn(11); grant(world, sid, 11); });
    return { sid };
  },
});

await scenario('D', '같은 학생이 두 기기(두 탭)에서 번갈아 획득', {
  seed: seed(),
  async run({ world, clock }) {
    const sid = sidOf(1);
    const a = await bootStudent(world, clock, sid, { up: 70, down: 70 });
    const b = await bootStudent(world, clock, sid, { up: 90, down: 90 });
    for (let t = 1000; t <= 5000; t += 400) clock.at(t, () => { a.earn(5); grant(world, sid, 5); });
    for (let t = 1150; t <= 5000; t += 550) clock.at(t, () => { b.earn(9); grant(world, sid, 9); });
    return { sid };
  },
});

await scenario('E', '대조군: 동시 저장 없음(학생 1분에 한 번, 교사는 한참 뒤 승인)', {
  seed: seed({ pendingGold: 50 }),
  async run({ world, clock }) {
    const sid = sidOf(1);
    const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
    const tea = await bootTeacher(world, clock, { up: 30, down: 30 });
    clock.at(1000, () => { stu.earn(7); grant(world, sid, 7); });
    clock.at(8000, () => { tea.approveSingle(sid, 'rw_1'); grant(world, sid, 50); });
    clock.at(20000, () => { stu.earn(7); grant(world, sid, 7); });
    return { sid };
  },
});

// ── 무작위 200판 ─────────────────────────────────────────
function rng(seedN) { let x = seedN >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
let fuzzRuns = 0, fuzzLossRuns = 0, fuzzLost = 0;
for (let r = 1; r <= 200; r++) {
  const rand = rng(r * 7919);
  const clock = makeClock();
  const world = makeWorld({ seedData: seed({ students: 2, pendingGold: 0 }), clock });
  world.grantedBy = {}; world.granted = 0;
  const sid = sidOf(1);
  const lat = () => 20 + Math.floor(rand() * 400);
  const stu = await bootStudent(world, clock, sid, { up: lat(), down: lat() });
  const tea = await bootTeacher(world, clock, { up: lat(), down: lat() });
  for (let k = 0; k < 25; k++) {
    const t = 1000 + Math.floor(rand() * 15000);
    const kind = rand();
    if (kind < 0.6) clock.at(t, () => { const g = 1 + Math.floor(rand() * 20); stu.earn(g); grant(world, sid, g); });
    else if (kind < 0.8) clock.at(t, () => {                         // 교사: 학생이 신청한 보상 승인
      const s = tea.DB.getStudent(sid); const id = 'fz' + k;
      s.pendingRewards = [...(s.pendingRewards || []), { id, label: 'f', type: 'quest', boardQuestType: 'special', gold: 10, exp: 0 }];
      tea.approveSingle(sid, id); grant(world, sid, 10);
    });
    else clock.at(t, () => tea.saveSettingsTouch());                  // 교사가 다른 걸 저장(설정 등)
  }
  await clock.run();
  const t = tally(world, sid, 1000);
  fuzzRuns++; if (t.expected !== t.total) { fuzzLossRuns++; fuzzLost += t.expected - t.total; }
}

// ── 교사 승인이 학생 화면(CUR)에 몇 ms 뒤 보이는가 (REFLECT-2S) ──────────
//  보스 설계 메모의 합격 조건: "교사 승인이 학생 화면에 2초 안에 반영". 유실과 따로, **보이기까지 걸린 시간**을 잰다.
//  학생 CUR.totalGold 에서 학생 자신이 번 몫을 뺀 값이 처음 +50 에 닿은 시각 − 승인 시각.
//  _saving 창 동안 원격 변경을 버리는 코드면 학생이 계속 저장하는 동안 영영(또는 한참) 안 보인다.
const REFLECT_LIMIT_MS = 2000;
const reflects = [];
async function reflectCase(name, desc, { studentEvery = 0 }) {
  const clock = makeClock();
  const world = makeWorld({ seedData: seed({ pendingGold: 50 }), clock });
  world.grantedBy = {}; world.granted = 0;
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  let own = 0;
  if (studentEvery) for (let t = 1000; t <= 12000; t += studentEvery) clock.at(t, () => { stu.earn(3); own += 3; });
  const APPROVE_AT = 3000;
  clock.at(APPROVE_AT, () => tea.approveSingle(sid, 'rw_1'));
  let seenAt = null;
  for (let t = APPROVE_AT; t <= APPROVE_AT + 10000; t += 50) {
    clock.at(t, () => { if (seenAt === null && (stu.CUR.totalGold || 0) - own >= 1050) seenAt = clock.now; });
  }
  await clock.run();
  const ms = seenAt === null ? null : seenAt - APPROVE_AT;
  reflects.push({ name, desc, ms, ok: ms !== null && ms <= REFLECT_LIMIT_MS });
}
await reflectCase('R1', '학생 한가 — 교사 승인 50G', { studentEvery: 0 });
await reflectCase('R2', '학생이 0.4초마다 저장(무한배틀·연속 수확) 중 교사 승인 50G', { studentEvery: 400 });

// ── 보고 ────────────────────────────────────────────────
let anyLoss = false;
console.log(`교사 승인 → 학생 화면 반영 (기준 ${REFLECT_LIMIT_MS}ms 이내):`);
for (const r of reflects) console.log(`${r.ok ? '✅' : '🔴'} ${r.name} | ${r.ms === null ? '10초 안에 안 보임' : r.ms + 'ms'} | ${r.desc}`);
const reflectFail = reflects.some(r => !r.ok);
console.log(`모드: logGold ${LOG_AFTER_SAVE ? 'saveStudent 뒤(실험)' : 'saveStudent 앞(지금 코드)'}`);
console.log('시나리오 | 유실G | 기대 totalGold | 서버 totalGold | goldDaily 로그 | 설명');
for (const x of results) {
  if (x.lost !== 0) anyLoss = true;
  console.log(`${x.lost > 0 ? '🔴' : x.lost < 0 ? '🟠' : '✅'} ${x.name} | ${x.lost} | ${x.expected} | ${x.total} | ${x.logged} | ${x.desc}${x.note ? ' · ' + x.note : ''}`);
}
console.log(`무작위 ${fuzzRuns}판(학생 1 + 교사 1, 지연 20~420ms, 25동작): 유실 난 판 ${fuzzLossRuns} · 유실 합 ${fuzzLost}G`);
if (fuzzLossRuns) anyLoss = true;
if (EXPECT_FIXED) {
  const bad = anyLoss || reflectFail;
  console.log(bad ? `\n최종 결과: ❌ FAIL (${[anyLoss && '유실 재현', reflectFail && '교사 승인 반영 2초 초과'].filter(Boolean).join(' · ')})` : '\n최종 결과: ✅ PASS (유실 0 · 반영 2초 이내)');
  process.exit(bad ? 1 : 0);
} else {
  console.log(anyLoss ? '\n최종 결과: 🔴 REPRO (지금 코드에서 유실 재현 — 수정 PR 뒤 --expect-fixed 로 0 확인)' : '\n최종 결과: ✅ 유실 0');
}
