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
//  사용: node scripts/unit/gold-sync-sim.mjs            (시나리오 M1·A~E + 무작위 200판 + 교사 승인 반영 R1·R2
//                                                          + [SYNC-MERGE-2] 상세 창 F1·F2 · 키오스크 K1·K2 · 학생 보상 신청 P1)
//        node scripts/unit/gold-sync-sim.mjs --expect-fixed   (수정 뒤: 유실·중복 지급·보상 사라짐이 하나라도 있거나 교사 승인 반영이 2초를 넘으면 exit 1)
//        GOLD_SIM_ROOT=<다른 체크아웃> node …               (수정 전 코드로 같은 시험 — 전/후 비교)
//  기본 모드는 재현용이라 유실이 나와도 exit 0, 대신 요약에 REPRO 로 적는다.
//  가짜 서버의 transaction 은 실제 SDK 처럼 **서버에 닿을 때 서버의 그때 값으로 다시 계산**한다([SYNC-MERGE-2] — 전에는
//   보낸 기기의 화면 값으로 계산해 그냥 set 했다. 여러 기기가 같은 목록을 고치는 시나리오에서 SDK 와 달랐다).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readGamedataSources } from './gamedata-sources.mjs';
import { readAdminSources } from './admin-sources.mjs';

const ROOT = process.env.GOLD_SIM_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMEDATA = readGamedataSources(ROOT);   // [GAMEDATA-SPLIT-1] gamedata.js + gamedata/*.js(html 순서) — 나누기 전 체크아웃이면 gamedata.js 하나
const ADMIN = readAdminSources(ROOT);   // [ADMIN-SPLIT-1] admin.js + admin/*.js(admin.html 순서)
const KIOSK = fs.readFileSync(path.join(ROOT, 'kiosk.js'), 'utf8');
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
      if (op.kind === 'tx') {                    // 로컬 겹쳐 보이기: 보낼 때 이 기기 값으로 한 번 낸 결과(op.localOut) 그대로
        //  SDK 는 보낸 transaction 을 답이 올 때까지 다시 부르지 않고 처음 낸 값을 그 자리에 겹쳐 보여 준다(서버에선 도착할 때 서버 값으로 다시 계산 — write 안).
        //  전에는 화면 값을 셀 때마다 일감을 다시 불러 일감이 불린 횟수가 부풀었다(APPROVE-ATOMIC-1 의 ATOMIC_RUNS 가 이 횟수를 센다).
        return op.localOut === undefined ? tree : setAt(tree, op.path, op.localOut);
      }
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

    //  [TX-RETRY-1] 일부러 넣는 실패(c.inject = [{ match(kind, path), how }] · 한 번씩 쓰임):
    //   'deny'               서버가 거부(권한) — 안 들어가고 PERMISSION_DENIED
    //   'disconnect-applied' transaction 을 보낸 뒤 끊김 · 서버엔 들어갔는데 답을 못 받음 → SDK 는 'disconnect' 로 끝냄(다시 안 보냄)
    //   'disconnect-lost'    transaction 을 보낸 뒤 끊김 · 서버에 안 들어감 → 'disconnect'
    //   'maxretry'           SDK 가 25번 다시 해도 서버 값이 계속 바뀌어 못 맞춤 → 안 들어가고 'maxretry'
    //   (보통 쓰기 set·update 는 SDK 가 다시 이어질 때 다시 보내므로 끊김을 넣지 않는다 — 결과는 한 번 들어간 것과 같다)
    const write = (kind, p, value) => new Promise((resolve, reject) => {
      const op = kind === 'tx' ? { id: ++wid, kind, path: p, fn: value } : { id: ++wid, kind, path: p, value: clone(value) };
      // SDK: transaction 은 먼저 이 기기의 지금 값으로 돌려 보고 undefined 면 서버에 안 보내고 바로 그만(committed false)
      if (kind === 'tx') {
        op.localOut = value(clone(getAt(c.localView(), p)));
        if (op.localOut === undefined) { resolve({ committed: false, snapshot: snap(getAt(c.localView(), p)) }); return; }
      }
      const inj = (c.inject || []).find(j => !j.used && j.match(kind, p));
      if (inj) inj.used = true;
      const how = inj ? inj.how : null;
      c.pending.push(op);
      fire();                                   // 낙관적 로컬 반영 — 바로 이벤트
      clock.after(c.up, () => {                 // 서버 도착
        let committed = true;
        if (!how || how === 'disconnect-applied') {
          if (op.kind === 'tx') {                // 서버의 그때 값으로 다시 계산 · undefined 면 안 바꾸고 committed false(SDK 와 같음)
            const out = op.fn(clone(getAt(server.tree, op.path)));
            if (out === undefined) committed = false; else server.tree = setAt(server.tree, op.path, out);
          } else server.tree = applyOp(server.tree, op);
        }
        const err = how === 'deny' ? new Error('PERMISSION_DENIED(sim)') : how ? new Error(how.startsWith('disconnect') ? 'disconnect' : how) : null;
        const state = clone(server.tree);
        for (const other of clients) {
          // 기기마다 도착 순서 보장(FIFO)
          const t = Math.max(clock.now + other.down, other.deliverAt);
          other.deliverAt = t;
          clock.at(t, () => {
            other.serverView = clone(state);
            if (other === c) {
              other.pending = other.pending.filter(x => x.id !== op.id);
              if (err) reject(err);
              else resolve(op.kind === 'tx' ? { committed, snapshot: snap(getAt(state, op.path)) } : undefined);
            }
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
        transaction: (fn) => write('tx', p, fn),   // 서버에 닿을 때 서버 값으로 다시 계산 = SDK 의 경합 재시도와 같은 결과
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
// [APPROVE-AWAIT-1] admin.js 의 한 줄 상수(const 이름 = ...;)를 잘라 온다
function sliceConst(src, name) {
  const m = new RegExp(`^const ${name}\\s*=.*;\\s*$`, 'm').exec(src);
  if (!m) throw new Error('admin.js 상수 없음: ' + name);
  return m[0];
}
async function bootTeacher(world, clock, opt) {
  const c = world.makeClient('교사', opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  c.DB.onDataChange(() => {});
  // admin.js 의 approveReward / approveSingle 을 그대로 잘라 넣는다(화면 함수는 빈 스텁)
  //   [APPROVE-AWAIT-1] 승인 함수가 쓰는 저장 약속 받기(saveStudentAwait·afterSaves)와 [전체 승인] 제외 목록도 함께
  //   [SYNC-MERGE-2] 학생 상세 창 저장(saveStudentDetail)·[💰 골드 지급](quickGiveGold)도 실제 admin.js 그대로
  vm.runInContext(`var notify=function(m){ (globalThis.__notes = globalThis.__notes || []).push(String(m)); }, renderAll=function(){}, closeModal=function(){}, confirm=function(){ return true; }, prompt=function(){ return globalThis.__promptAns; };\n${sliceConst(ADMIN, 'APPROVE_ALL_SKIP_TYPES')}\n${sliceFn(ADMIN, 'saveStudentAwait')}\n${/^function approveAndSave\s*\(/m.test(ADMIN) ? sliceFn(ADMIN, 'approveAndSave') : ''}\n${sliceFn(ADMIN, 'afterSaves')}\n${sliceFn(ADMIN, 'approveReward')}\n${sliceFn(ADMIN, 'approveSingle')}\n${sliceFn(ADMIN, 'approveAll')}\n${sliceFn(ADMIN, 'saveStudentDetail')}\n${sliceFn(ADMIN, 'quickGiveGold')}\n` +
    'globalThis.__approveSingle = approveSingle; globalThis.__approveAll = approveAll; globalThis.__saveDetail = saveStudentDetail; globalThis.__give = quickGiveGold;', c.sb);
  c.approveSingle = (sid, rid) => c.sb.__approveSingle(sid, rid);
  c.approveAll = () => c.sb.__approveAll();
  c.notes = () => c.sb.__notes || [];
  c.giveGold = (sid, amt) => { c.sb.__promptAns = String(amt); c.sb.__give(sid); };   // 관리 화면 [💰 골드 지급](학생 기록 쓰기 한 번)
  c.saveSettingsTouch = () => c.DB.saveSettings({ ...(c.DB.getSettings() || {}), touchedAt: clock.now });
  // [SYNC-MERGE-2] 학생 상세 창 — openStudentDetail 이 칸을 채우는 것처럼 '연 때 값'을 value·defaultValue 에 담고,
  //   저장 때 admin.js 의 실제 saveStudentDetail 을 부른다(칸 → document.getElementById).
  c.form = null;
  c.sb.document = { getElementById: (id) => (c.form && c.form[id]) || null, querySelectorAll: () => [] };
  c.openDetail = (sid) => {
    const s = c.DB.getStudent(sid), mk = (v) => ({ value: String(v), defaultValue: String(v) });
    c.form = { 'det-name': mk(s.name), 'det-job': mk(s.job || ''), 'det-pw': mk(s.pw || '1234'), 'det-lv': mk(s.level),
      'det-gold': mk(s.gold), 'det-exp': mk(s.exp), 'det-books': mk(s.bookCount || 0),
      'det-title': { value: s.title || '', selectedIndex: 0, options: [{ defaultSelected: true }] } };
    for (const [k, v] of Object.entries(s.stats || {})) c.form['det-stat-' + k] = mk(v);
  };
  c.saveDetail = (sid, edits) => { for (const [k, v] of Object.entries(edits || {})) c.form[k].value = String(v); c.sb.__saveDetail(sid); };
  return c;
}
// [SYNC-MERGE-2] 키오스크 — kiosk.js 의 실제 requestQuest·cancelQuest 를 잘라 넣고, 자체 root 구독(DB.init 안 씀)도 kiosk.js 그대로 흉내
async function bootKiosk(world, clock, opt) {
  const c = world.makeClient('키오스크', opt);
  vm.runInContext('var DB_DATA=null, DB_RAW=null, fbRef=null, showToast=function(m){ (globalThis.__toasts = globalThis.__toasts || []).push(String(m)); }, renderTable=function(){};\n'
    + ['cloneDataForKiosk', 'normalizeData', 'getStudentStorageKey', 'requestQuest', 'cancelQuest'].map(n => sliceFn(KIOSK, n)).join('\n')
    + '\nfbRef = firebase.database().ref("classRPG_v3");'
    + '\nfbRef.on("value", function (snap) { var raw = snap.val(); DB_RAW = cloneDataForKiosk(raw); DB_DATA = normalizeData(cloneDataForKiosk(raw)); });'
    + '\nglobalThis.__req = function (sid, qid) { requestQuest(sid, qid, null); }; globalThis.__cancel = function (sid, qid) { cancelQuest(sid, qid); };', c.sb);
  await clock.run(clock.now);
  c.request = (sid, qid) => c.sb.__req(sid, qid);
  c.cancel = (sid, qid) => c.sb.__cancel(sid, qid);
  c.toasts = () => c.sb.__toasts || [];
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

// ── [SYNC-MERGE-2] 보상 신청·상세 창 시나리오 ────────────────────
//  잰다: 서버 학생 gold 가 기대와 같은가(+ 유실 · − 중복 지급) · 끝에 남은 pendingRewards id 가 기대와 같은가(사라짐·되살아남).
//  기대값은 '모든 일이 차례로 일어났을 때'의 값이다. 수정 전 코드로 돌리려면 GOLD_SIM_ROOT=<옛 체크아웃>.
const extras = [];
async function extraCase(name, desc, seedData, body) {
  const clock = makeClock();
  const world = makeWorld({ seedData, clock });
  world.granted = 0; world.grantedBy = {};
  const out = await body({ world, clock });
  await clock.run();
  const s = getAt(world.server.tree, 'classRPG_v3/students/' + out.sid) || {};
  const ids = (s.pendingRewards == null ? [] : Object.values(s.pendingRewards)).filter(Boolean).map(r => r.id).sort();
  const want = (out.pending || []).slice().sort();
  const goldDiff = out.gold - (s.gold || 0);   // + 유실 · − 중복 지급
  const checkErr = out.check ? out.check(s, getAt(world.server.tree, 'classRPG_v3') || {}) : '';
  const pendingBad = JSON.stringify(ids) !== JSON.stringify(want) || !!checkErr;
  extras.push({ name, desc, goldDiff, pendingBad, ids, want, gold: s.gold, expectGold: out.gold, total: s.totalGold, expectTotal: out.total, checkErr });
}
const seedK = (extra) => {
  const d = seed({ pendingGold: 50 });
  d.boardQuests = [{ id: 'bq_k', name: '청소', type: 'special', exp: 10, gold: 20, active: true }];
  Object.assign(d.students[sidOf(1)], extra || {});
  return d;
};

await extraCase('F1', '교사가 학생 상세 창을 연 뒤 학생이 30G 벌고, 교사는 직업 칸만 고쳐 저장', seed(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => tea.openDetail(sid));
  for (const t of [1500, 2000, 2500]) clock.at(t, () => stu.earn(10));
  clock.at(4000, () => tea.saveDetail(sid, { 'det-job': '요리사' }));
  return { sid, gold: 1030, total: 1030, pending: [] };
});
await extraCase('F2', '상세 창을 연 뒤 학생이 30G 벌고, 교사가 골드 칸을 1000→1500(+500)으로 고쳐 저장', seed(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => tea.openDetail(sid));
  for (const t of [1500, 2000, 2500]) clock.at(t, () => stu.earn(10));
  clock.at(4000, () => tea.saveDetail(sid, { 'det-gold': 1500 }));
  return { sid, gold: 1530, total: 1530, pending: [] };
});
await extraCase('K1', '교사가 보상(50G) 승인한 직후, 아직 그걸 모르는 느린 키오스크가 퀘스트 신청 → 나중에 교사가 보이는 것 전체 승인', seedK(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  const kio = await bootKiosk(world, clock, { up: 300, down: 300 });
  clock.at(1000, () => tea.approveSingle(sid, 'rw_1'));
  clock.at(1050, () => kio.request(sid, 'bq_k'));
  clock.at(6000, () => tea.approveAll());
  return { sid, gold: 1000 + 50 + 20, pending: [] };   // 승인한 보상이 되살아나 또 승인되면 −50(중복)
});
await extraCase('K2', '학생 기기가 작품 보상을 신청(addPendingReward)한 순간, 느린 키오스크도 퀘스트 신청 → 둘 다 남아야', seedK({ pendingRewards: [] }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
  const kio = await bootKiosk(world, clock, { up: 300, down: 300 });
  clock.at(1000, () => stu.DB.addPendingReward(stu.CUR, { id: 'art_1', type: 'artwork', label: '작품', exp: 30, gold: 20 }));
  clock.at(1010, () => kio.request(sid, 'bq_k'));
  return { sid, gold: 1000, pending: ['art_1', 'KIOSK'] };
});
await extraCase('K3', '키오스크가 신청한 뒤 취소하는 사이 교사가 다른 보상(50G) 승인', seedK(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  const kio = await bootKiosk(world, clock, { up: 300, down: 300 });
  clock.at(1000, () => kio.request(sid, 'bq_k'));
  clock.at(3000, () => tea.approveSingle(sid, 'rw_1'));
  clock.at(3050, () => kio.cancel(sid, 'bq_k'));
  clock.at(8000, () => tea.approveAll());
  return { sid, gold: 1050, pending: [] };   // 취소가 승인한 보상을 되살리면 −50
});
await extraCase('P1', '교사가 보상(50G) 승인한 직후, 아직 모르는 학생 기기가 작품 보상 신청 → 나중에 교사가 남은 보상 전체 승인 + 작품은 하나씩 승인', seed({ pendingGold: 50 }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 200, down: 200 });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => tea.approveSingle(sid, 'rw_1'));
  clock.at(1010, () => stu.DB.addPendingReward(stu.CUR, { id: 'art_1', type: 'artwork', label: '작품', exp: 30, gold: 20 }));
  clock.at(6000, () => tea.approveAll());                  // 승인한 rw_1 이 되살아났으면 여기서 또 지급(−50)
  clock.at(9000, () => tea.approveSingle(sid, 'art_1'));   // #1160 APPROVE-ALL-ASK-1: 작품은 [전체 승인]에서 빠지고 하나씩
  return { sid, gold: 1000 + 50 + 20, pending: [] };
});
//  M3·M4: 로그인 때 깊은 복사한 CUR(출신 모름)에 꾸미기 묶음 저장(0.4초)이 걸린 채 남의 변경이 온다 → 스냅샷 콜백 첫머리
//   decoFlush('스냅샷') 이 그 CUR 을 저장(student.js onDataChange 순서). 이번 판 전 기준으로 재야 남의 변경을 안 되돌린다.
async function bootDecoKid(world, clock, sid, opt) {
  const stu = world.makeClient('학생:' + sid, opt);
  const p = stu.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  stu.CUR = JSON.parse(JSON.stringify(stu.DB.getStudent(sid)));             // doLogin: 깊은 복사(출신 모름)
  stu.decoPending = false;
  stu.DB.onDataChange(() => {                                                // decoFlush('스냅샷') → CUR = fresh
    if (stu.decoPending) { stu.decoPending = false; stu.DB.saveStudent(stu.CUR); }
    const f = stu.DB.getStudent(stu.CUR.id); if (f) stu.CUR = f;
  });
  stu.paint = () => { stu.CUR.yardFloor = { '2_3': 'dirt' }; stu.decoPending = true; };            // _paintFloor → decoDirty
  stu.timer = () => { if (stu.decoPending) { stu.decoPending = false; stu.DB.saveStudent(stu.CUR); } };   // 0.4초 타이머
  return stu;
}
const painted = (s) => ((s.yardFloor || {})['2_3'] === 'dirt' ? '' : '칠한 칸이 서버에 없음');
await extraCase('M3', '꾸미기 묶음 저장 대기 중(로그인 때 깊은 복사한 CUR) 교사가 [골드 지급] 50G — 스냅샷 콜백 첫머리 decoFlush 가 그 CUR 저장', seed(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootDecoKid(world, clock, sid, { up: 80, down: 80 });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => stu.paint());
  clock.at(1050, () => tea.giveGold(sid, 50));
  clock.at(1400, () => stu.timer());
  return { sid, gold: 1050, total: 1050, pending: [], check: painted };
});
await extraCase('M4', '같은 상황에서 교사가 보상 승인(50G) — 승인 쓰기(로그·활동 기록·학생 기록)가 차례로 도착', seed({ pendingGold: 50 }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootDecoKid(world, clock, sid, { up: 80, down: 80 });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => stu.paint());
  clock.at(1050, () => tea.approveSingle(sid, 'rw_1'));
  clock.at(1400, () => stu.timer());
  return { sid, gold: 1050, total: 1050, pending: [], check: painted };
});
//  L1: #1161 승인 레벨업 축하 — student.js onDataChange 는 prevLv = CUR.level 을 읽고 CUR = fresh 로 바꾼 뒤 견준다.
//   학생이 꾸미기 묶음 저장을 걸어 둔 채(decoFlush 가 옛 CUR 을 저장) 교사가 레벨이 오르는 보상을 승인 → 학생 화면이 '오름'을 한 번 봐야 하고,
//   칠한 칸·골드·EXP 는 다 남아야 한다.
await extraCase('L1', '꾸미기 저장 대기 중 교사가 레벨이 오르는 보상(EXP 300·50G) 승인 → 학생 콜백이 레벨 오름을 본다(#1161) · 칠한 칸도 남음', (() => {
  const d = seed(); d.students[sidOf(1)].pendingRewards = [{ id: 'rw_lv', label: '큰 보상', type: 'quest', boardQuestType: 'special', gold: 50, exp: 300 }];
  d.students[sidOf(1)].exp = 0; d.students[sidOf(1)].level = 1; return d;
})(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = world.makeClient('학생:' + sid, { up: 80, down: 80 });
  const p = stu.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  stu.CUR = JSON.parse(JSON.stringify(stu.DB.getStudent(sid)));
  stu.DB.saveStudent(stu.CUR);                                            // 로그인 뒤 한 번 저장 → CUR 이 캐시 객체가 된다(밀림 경로를 탄다)
  let decoPending = false, ups = 0;
  stu.DB.onDataChange(() => {                                             // student.js onDataChange 순서 그대로
    if (decoPending) { decoPending = false; stu.DB.saveStudent(stu.CUR); }
    const prevLv = stu.CUR.level || 1;
    const f = stu.DB.getStudent(stu.CUR.id); if (f) stu.CUR = f;
    if ((stu.CUR.level || 1) > prevLv) ups++;
  });
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => { stu.CUR.yardFloor = { '4_4': 'grass' }; decoPending = true; });
  clock.at(1050, () => tea.approveSingle(sid, 'rw_lv'));
  clock.at(1400, () => { if (decoPending) { decoPending = false; stu.DB.saveStudent(stu.CUR); } });
  return { sid, gold: 1050, total: 1050, pending: [],
    check: (s) => [ups !== 1 && `레벨 오름을 ${ups}번 봄(1번이어야)`, (s.yardFloor || {})['4_4'] !== 'grass' && '칠한 칸이 서버에 없음', s.exp !== 300 && `EXP ${s.exp}(300 이어야)`].filter(Boolean).join(' · ') };
});
//  ── [TX-RETRY-1] · [APPROVE-ATOMIC-1] 끊김·거부·두 기기 (PR #1162 검토 #1·#2·D2) ─────────
//   SDK 9.23 은 보낸 transaction 이 답을 받기 전에 연결이 끊기면 'disconnect' 로 끝내고 다시 안 보낸다(보통 쓰기는 다시 보냄).
const isTx = (k) => k === 'tx';
const noteHas = (c, re) => c.notes().some(m => re.test(m));
for (const [name, how, desc] of [
  ['X1', 'disconnect-applied', '교사 승인 쓰기를 보낸 뒤 연결 끊김 — 서버엔 들어갔는데 답을 못 받음'],
  ['X2', 'disconnect-lost', '교사 승인 쓰기를 보낸 뒤 연결 끊김 — 서버에 안 들어감'],
  ['X6', 'maxretry', '교사 승인 transaction 이 25번 다 낡음(학생이 아주 잦게 저장) → 예전 방식(바뀐 칸 + 보상 transaction)으로'],
]) {
  await extraCase(name, desc + ' → 50G 한 번 · 보상 빠짐 · "승인 완료"', seed({ pendingGold: 50 }), async ({ world, clock }) => {
    const sid = sidOf(1);
    const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
    tea.inject = [{ match: isTx, how }];
    clock.at(1000, () => tea.approveSingle(sid, 'rw_1'));
    return { sid, gold: 1050, total: 1050, pending: [],
      check: () => [!noteHas(tea, /승인 완료/) && `교사 알림 ${JSON.stringify(tea.notes())}`].filter(Boolean).join(' · ') };
  });
}
for (const [name, how, desc] of [
  ['X3', 'disconnect-applied', '키오스크 퀘스트 신청을 보낸 뒤 끊김 — 서버엔 들어감'],
  ['X4', 'disconnect-lost', '키오스크 퀘스트 신청을 보낸 뒤 끊김 — 서버에 안 들어감'],
]) {
  await extraCase(name, desc + ' → 신청 하나 · "신청했어요"(실패 토스트 없음)', seedK(), async ({ world, clock }) => {
    const sid = sidOf(1);
    const kio = await bootKiosk(world, clock, { up: 120, down: 120 });
    kio.inject = [{ match: isTx, how }];
    clock.at(1000, () => kio.request(sid, 'bq_k'));
    return { sid, gold: 1000, pending: ['rw_1', 'KIOSK'],
      check: () => [!kio.toasts().some(m => /신청했어요/.test(m)) && '성공 토스트 없음', kio.toasts().some(m => /못했어요/.test(m)) && '실패 토스트(다시 누르면 신청 둘)'].filter(Boolean).join(' · ') };
  });
}
await extraCase('X5', '학생 기기 작품 신청(addPendingReward)을 보낸 뒤 끊김 — 서버에 안 들어감 → 신청 하나', seed(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 80, down: 80 });
  stu.inject = [{ match: isTx, how: 'disconnect-lost' }];
  clock.at(1000, () => stu.DB.addPendingReward(stu.CUR, { id: 'art_1', type: 'artwork', label: '작품', exp: 30, gold: 20 }));
  return { sid, gold: 1000, pending: ['art_1'] };
});
await extraCase('D2', '교사 두 기기(관리 탭 둘)가 같은 보상(50G)을 0.03초 차이로 승인 → 한 번만 · 늦은 쪽은 "이미 처리"', seed({ pendingGold: 50 }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const t1 = await bootTeacher(world, clock, { up: 40, down: 40 });
  const t2 = await bootTeacher(world, clock, { up: 60, down: 60 });
  clock.at(1000, () => t1.approveSingle(sid, 'rw_1'));
  clock.at(1030, () => t2.approveSingle(sid, 'rw_1'));
  return { sid, gold: 1050, total: 1050, pending: [],
    check: () => [!noteHas(t2, /이미 다른 곳에서 처리/) && `늦은 교사 알림 ${JSON.stringify(t2.notes())}`].filter(Boolean).join(' · ') };
});
await extraCase('F3', '교사 승인 쓰기가 서버에서 거부(권한) → 아무것도 안 바뀜(골드 그대로 · 보상 남음) · "실패" 알림', seed({ pendingGold: 50 }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  tea.inject = [{ match: (k, p) => /students\/s\d+(\/pendingRewards)?$/.test(p) && k !== 'set' || (k === 'set' && /students\/s\d+$/.test(p)), how: 'deny' }];
  clock.at(1000, () => tea.approveSingle(sid, 'rw_1'));
  return { sid, gold: 1000, total: 1000, pending: ['rw_1'],
    check: () => [!noteHas(tea, /실패/) && `교사 알림 ${JSON.stringify(tea.notes())}`].filter(Boolean).join(' · ') };
});
//  ── [APPROVE-AFTER-1] 보상마다 한 쓰기 · 기록은 저장이 된 뒤에만 (PR #1162 2차 검토 Y2·Y3·Y4·Y6·Y8·Y9) ─────────
const logsOf = (root, sid) => Object.values(root.questLogs || {}).filter(q => q && q.studentId === sid).map(q => q.boardQuestId || q.name).sort();
const artsOf = (root, sid) => Object.values(root.artworks || {}).filter(a => a && a.studentId === sid).length;
const gdOf = (root, sid) => Object.values(root.goldDaily || {}).filter(v => v && v.s === sid)
  .reduce((a, v) => a + Object.entries(v).filter(([k]) => k !== 's' && k !== 'd').reduce((x, [, n]) => x + (+n || 0), 0), 0);
const seedAB = () => { const d = seed(); const sid = sidOf(1);
  d.boardQuests = [{ id: 'bq_a', name: '청소', type: 'daily', exp: 10, gold: 20, active: true }, { id: 'bq_b', name: '책정리', type: 'daily', exp: 10, gold: 30, active: true }];
  d.students[sid].pendingRewards = [
    { id: 'pr_a', boardQuestId: 'bq_a', boardQuestType: 'daily', label: '청소', type: 'quest', exp: 10, gold: 20, date: '2026-09-15' },
    { id: 'pr_b', boardQuestId: 'bq_b', boardQuestType: 'daily', label: '책정리', type: 'quest', exp: 10, gold: 30, date: '2026-09-15' }];
  return d; };
const seedArt = () => { const d = seed(); d.students[sidOf(1)].pendingRewards = [{ id: 'art_1', type: 'artwork', label: '그림', artTitle: '그림', artUrl: 'u', gold: 20, exp: 30 }]; return d; };
await extraCase('Y8', '키오스크에서 아이가 청소 신청을 취소하는 순간 교사가 [전체 승인] → 3초 뒤 다시 [전체 승인] → 책정리 30G 는 들어가고 청소 기록은 없음', seedAB(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const kio = await bootKiosk(world, clock, { up: 30, down: 30 });
  const tea = await bootTeacher(world, clock, { up: 60, down: 60 });
  clock.at(1000, () => kio.cancel(sid, 'bq_a'));
  clock.at(1010, () => tea.approveAll());
  clock.at(3000, () => tea.approveAll());
  return { sid, gold: 1030, total: 1030, pending: [],
    check: (s, root) => [JSON.stringify(logsOf(root, sid)) !== '["bq_b"]' && `퀘스트 기록 ${JSON.stringify(logsOf(root, sid))}(책정리 하나여야)`, gdOf(root, sid) !== 30 && `goldDaily ${gdOf(root, sid)}(30 이어야)`].filter(Boolean).join(' · ') };
});
await extraCase('Y9', '교사 두 기기: 하나가 청소 승인 ↔ 다른 하나가 같은 순간 [전체 승인] → 다시 [전체 승인] → 20+30 한 번씩', seedAB(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const t1 = await bootTeacher(world, clock, { up: 40, down: 40 });
  const t2 = await bootTeacher(world, clock, { up: 60, down: 60 });
  clock.at(1000, () => t1.approveSingle(sid, 'pr_a'));
  clock.at(1010, () => t2.approveAll());
  clock.at(3000, () => t2.approveAll());
  return { sid, gold: 1050, total: 1050, pending: [],
    check: (s, root) => [JSON.stringify(logsOf(root, sid)) !== '["bq_a","bq_b"]' && `퀘스트 기록 ${JSON.stringify(logsOf(root, sid))}`, gdOf(root, sid) !== 50 && `goldDaily ${gdOf(root, sid)}(50 이어야)`].filter(Boolean).join(' · ') };
});
await extraCase('Y2', '교사 두 기기가 같은 작품 보상(20G)을 0.03초 차 승인 → 골드·작품 전시·기록·goldDaily 모두 한 번', seedArt(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const t1 = await bootTeacher(world, clock, { up: 40, down: 40 });
  const t2 = await bootTeacher(world, clock, { up: 60, down: 60 });
  clock.at(1000, () => t1.approveSingle(sid, 'art_1'));
  clock.at(1030, () => t2.approveSingle(sid, 'art_1'));
  return { sid, gold: 1020, total: 1020, pending: [],
    check: (s, root) => [artsOf(root, sid) !== 1 && `작품 ${artsOf(root, sid)}`, logsOf(root, sid).length !== 1 && `기록 ${logsOf(root, sid).length}`, gdOf(root, sid) !== 20 && `goldDaily ${gdOf(root, sid)}`].filter(Boolean).join(' · ') };
});
await extraCase('Y3', '학생이 작품 신청을 취소하는 순간 교사가 승인 → 골드 0 · 작품 전시 0 · 기록 0', seedArt(), async ({ world, clock }) => {
  const sid = sidOf(1);
  const stu = await bootStudent(world, clock, sid, { up: 30, down: 30 });
  const tea = await bootTeacher(world, clock, { up: 60, down: 60 });
  clock.at(1000, () => { stu.CUR.pendingRewards = (stu.CUR.pendingRewards || []).filter(r => r.id !== 'art_1'); stu.DB.saveStudent(stu.CUR); });
  clock.at(1010, () => tea.approveSingle(sid, 'art_1'));
  return { sid, gold: 1000, total: 1000, pending: [],
    check: (s, root) => [artsOf(root, sid) && `작품 ${artsOf(root, sid)}`, logsOf(root, sid).length && `기록 ${logsOf(root, sid).length}`, gdOf(root, sid) && `goldDaily ${gdOf(root, sid)}`, !noteHas(tea, /이미 다른 곳에서 처리/) && `교사 알림 ${JSON.stringify(tea.notes())}`].filter(Boolean).join(' · ') };
});
await extraCase('Y4', '느린 교사 기기 승인이 폴백(maxretry) ↔ 빠른 교사 기기가 같은 보상 승인 → 폴백도 "보상이 있을 때만" → 한 번', seed({ pendingGold: 50 }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const t1 = await bootTeacher(world, clock, { up: 40, down: 40 });
  const t2 = await bootTeacher(world, clock, { up: 200, down: 200 });
  t2.inject = [{ match: (k, p) => k === 'tx' && /students\/s\d+$/.test(p), how: 'maxretry' }];
  clock.at(1000, () => t2.approveSingle(sid, 'rw_1'));
  clock.at(1010, () => t1.approveSingle(sid, 'rw_1'));
  return { sid, gold: 1050, total: 1050, pending: [], check: (s, root) => [gdOf(root, sid) !== 50 && `goldDaily ${gdOf(root, sid)}`].filter(Boolean).join(' · ') };
});
await extraCase('Y6', '승인 끊김(서버엔 들어감) → 다시 → "set" 으로 또 다시 → 보상 없음 → 끊김을 기억해 "승인 완료"', seed({ pendingGold: 50 }), async ({ world, clock }) => {
  const sid = sidOf(1);
  const tea = await bootTeacher(world, clock, { up: 40, down: 40 });
  tea.inject = [{ match: (k, p) => k === 'tx' && /students\/s\d+$/.test(p), how: 'disconnect-applied' }, { match: (k, p) => k === 'tx' && /students\/s\d+$/.test(p), how: 'set' }];
  clock.at(1000, () => tea.approveSingle(sid, 'rw_1'));
  return { sid, gold: 1050, total: 1050, pending: [],
    check: (s, root) => [!noteHas(tea, /승인 완료/) && `교사 알림 ${JSON.stringify(tea.notes())}`, logsOf(root, sid).length !== 1 && `기록 ${logsOf(root, sid).length}`].filter(Boolean).join(' · ') };
});
// K2 의 키오스크 신청 id 는 시각으로 만들어지므로(pr_<시각>_<학생>) 실제 id 로 바꿔 끼운다
for (const x of extras) if (x.want.includes('KIOSK')) {
  const k = x.ids.find(id => /^pr_/.test(id));
  x.want = x.want.map(id => (id === 'KIOSK' ? (k || 'pr_(키오스크 신청 없음)') : id)).sort();
  x.pendingBad = JSON.stringify(x.ids) !== JSON.stringify(x.want) || !!x.checkErr;
}

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
console.log('\n[SYNC-MERGE-2] 보상 신청·상세 창 | 골드 차이G(+유실 · −중복) | 기대 gold | 서버 gold | 남은 보상(기대) | 설명');
let extraBad = false;
for (const x of extras) {
  const bad = x.goldDiff !== 0 || x.pendingBad || (x.expectTotal !== undefined && x.total !== x.expectTotal);
  if (bad) extraBad = true;
  console.log(`${bad ? '🔴' : '✅'} ${x.name} | ${x.goldDiff} | ${x.expectGold} | ${x.gold} | [${x.ids.join(',')}]${x.pendingBad ? ` (기대 [${x.want.join(',')}])` : ''}${x.expectTotal !== undefined ? ` · totalGold ${x.total}(기대 ${x.expectTotal})` : ''}${x.checkErr ? ` · ${x.checkErr}` : ''} | ${x.desc}`);
}
if (EXPECT_FIXED) {
  const bad = anyLoss || reflectFail || extraBad;
  console.log(bad ? `\n최종 결과: ❌ FAIL (${[anyLoss && '유실 재현', reflectFail && '교사 승인 반영 2초 초과', extraBad && '보상 신청·상세 창 어긋남'].filter(Boolean).join(' · ')})` : '\n최종 결과: ✅ PASS (유실 0 · 반영 2초 이내 · 보상 신청·상세 창 0)');
  process.exit(bad ? 1 : 0);
} else {
  console.log(anyLoss || extraBad ? '\n최종 결과: 🔴 REPRO (지금 코드에서 유실 재현 — 수정 PR 뒤 --expect-fixed 로 0 확인)' : '\n최종 결과: ✅ 유실 0');
}
