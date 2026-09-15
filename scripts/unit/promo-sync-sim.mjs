#!/usr/bin/env node
// 우리반 성장 RPG — 승급 신청 동시 저장 하네스 (PROMO-PER-ID-1)
//
//  무엇: 실제 gamedata.js(DB) · student.js requestPromotion · admin.js approvePromotion 을 기기마다 vm 으로 띄우고
//        가짜 Realtime Database 로 잇는다(가짜 서버는 GOLD-LOSS-SIM-1 gold-sync-sim.mjs 와 같은 것).
//        학생 여럿이 거의 동시에 신청하거나, 교사 승인 순간 다른 학생이 신청할 때
//        ① 신청이 사라지는지 ② 승인한 신청이 되살아나 보상이 두 번 가는지 ③ 옛 배열(숫자 키) 판에서 승인이 목록을 비우는지 센다.
//        운영 Firebase·네트워크·브라우저 없음. 가상 시계·시드 고정.
//
//  사용: node scripts/unit/promo-sync-sim.mjs                 (재현용: 문제가 나와도 exit 0, 요약에 REPRO)
//        node scripts/unit/promo-sync-sim.mjs --expect-fixed  (하나라도 나오면 exit 1)
//        PROMO_SIM_ROOT=<다른 체크아웃> node …               (수정 전 코드로 같은 시험)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.PROMO_SIM_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMEDATA = fs.readFileSync(path.join(ROOT, 'gamedata.js'), 'utf8');
const ADMIN = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const EXPECT_FIXED = process.argv.includes('--expect-fixed');

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
const STUDENT = fs.readFileSync(path.join(ROOT, 'student.js'), 'utf8');
function sliceFn(src, name) {
  const m = new RegExp('^function ' + name + '[ \\t]*[(]', 'm').exec(src);
  if (!m) throw new Error('함수 없음: ' + name);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) return src.slice(m.index, i + 1); }
  throw new Error('중괄호: ' + name);
}
const sidOf = (i) => 's17736210607' + String(60 + i);

// ── 화면 흉내 ────────────────────────────────────────────
async function bootStu(world, clock, sid, opt) {
  const c = world.makeClient('학생:' + sid, opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  c.CUR = JSON.parse(JSON.stringify(c.DB.getStudent(sid)));
  c.DB.onDataChange(() => { const f = c.DB.getStudent(c.CUR.id); if (f) c.CUR = f; });
  vm.runInContext('var CUR=null, toast=function(){}, renderPromoModal=function(){}, renderMain=function(){}, renderMobile=function(){}, renderHUD=function(){};\n'
    + sliceFn(STUDENT, 'requestPromotion') + '\nglobalThis.__req = function(cur){ CUR = cur; requestPromotion(); };', c.sb);
  c.request = () => c.sb.__req(c.CUR);
  return c;
}
async function bootTea(world, clock, opt) {
  const c = world.makeClient('교사', opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  c.DB.onDataChange(() => {});
  vm.runInContext('var notify=function(){}, renderAll=function(){};\n' + sliceFn(ADMIN, 'approvePromotion') + '\nglobalThis.__ap = approvePromotion;', c.sb);
  // 교사가 목록에 보이는 신청을 차례로 누른다
  c.approveVisible = () => { const ids = c.DB.getPromotionRequests().filter(Boolean).map(r => r.id); ids.forEach(id => c.sb.__ap(id)); return ids.length; };
  return c;
}
function seedP(n, extra = {}) {
  const list = {};
  for (let i = 1; i <= n; i++) { const id = sidOf(i); list[id] = { id, name: '학생' + i, pw: 'x', level: 5, exp: 500, gold: 1000, totalGold: 1000, pendingRewards: [] }; }
  if (extra.__promoted) { list[sidOf(1)].promotedLevels = [5]; delete extra.__promoted; }
  return { students: list, settings: { className: '시험' }, questLogs: {}, boardQuests: [], ...extra };
}
// 신청한 학생은 결국 딱 한 번(+100G) 승인되고, 목록은 비어야 한다
function measure(world, n, requested) {
  const root = world.server.tree.classRPG_v3;
  const reqs = root.promotionRequests == null ? [] : Object.values(root.promotionRequests).filter(Boolean);
  const logs = Object.values(root.questLogs || {}).filter(l => l && l.type === 'promotion');
  let extraGold = 0, lost = 0, overwritten = 0;
  for (let i = 1; i <= n; i++) {
    const g = (root.students[sidOf(i)].gold || 0) - 1000;
    if (!requested.has(sidOf(i))) { if (g > 0) extraGold += g; continue; }   // 받을 게 없는 학생이 받으면 중복
    const approvals = logs.filter(l => l.studentId === sidOf(i)).length;
    if (g > 100 || approvals > 1) extraGold += Math.max(g - 100, (approvals - 1) * 100);
    if (g < 100 && !reqs.some(r => r.studentId === sidOf(i))) {
      // 승인 기록이 있는데 골드가 없으면: 신청은 멀쩡했고 학생 기기의 옛 CUR 통째 저장이 승인을 덮은 것
      //   → 골드 유실 갈래(GOLD-LOSS-SIM-1 M2) 몫. 이 하네스의 실패로 세지 않고 따로 보여 준다.
      if (approvals) overwritten++; else lost++;
    }
  }
  return { left: reqs.length, extraGold, lost, overwritten };
}
const rows = [];
async function scen(name, desc, n, fn, seedExtra) {
  const clock = makeClock(); const world = makeWorld({ seedData: seedP(n, seedExtra), clock });
  const requested = new Set();
  await fn({ world, clock, requested });
  await clock.run();
  rows.push({ name, desc, ...measure(world, n, requested) });
}

await scen('P1', '두 학생이 40ms 차이로 신청 → 교사가 3초 뒤·7초 뒤 보이는 것 승인', 2, async ({ world, clock, requested }) => {
  const a = await bootStu(world, clock, sidOf(1), { up: 80, down: 80 });
  const b = await bootStu(world, clock, sidOf(2), { up: 80, down: 80 });
  const t = await bootTea(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => { a.request(); requested.add(sidOf(1)); });
  clock.at(1040, () => { b.request(); requested.add(sidOf(2)); });
  clock.at(4000, () => t.approveVisible());
  clock.at(8000, () => t.approveVisible());
});
await scen('P2', '교사가 학생1 승인하는 순간 느린 학생2가 신청 → 뒤에 목록 다시 승인', 2, async ({ world, clock, requested }) => {
  const a = await bootStu(world, clock, sidOf(1), { up: 80, down: 80 });
  const b = await bootStu(world, clock, sidOf(2), { up: 250, down: 250 });
  const t = await bootTea(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => { a.request(); requested.add(sidOf(1)); });
  clock.at(4000, () => t.approveVisible());
  clock.at(4020, () => { b.request(); requested.add(sidOf(2)); });
  // 교실에선 누군가 늘 저장한다 — 교사 기기가 _saving 창에 버린 스냅샷을 다음 저장이 다시 보내 준다
  clock.at(6000, () => a.DB.saveStudent(a.DB.getStudent(sidOf(1))));
  clock.at(8000, () => t.approveVisible());
  clock.at(12000, () => t.approveVisible());
});
await scen('P3', '옛 백업·옛 판이 남긴 숫자 키 신청 2건 → 교사 승인 → 목록이 비고 보상은 한 번씩', 2, async ({ world, clock, requested }) => {
  requested.add(sidOf(1)); requested.add(sidOf(2));
  const t = await bootTea(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => t.approveVisible());
  clock.at(5000, () => t.approveVisible());
  clock.at(9000, () => t.approveVisible());
}, { promotionRequests: {
  0: { id: 'id_legacy_1', studentId: sidOf(1), studentName: '학생1', level: 5, date: '2026-09-15' },
  1: { id: 'id_legacy_2', studentId: sidOf(2), studentName: '학생2', level: 5, date: '2026-09-15' },
} });
await scen('P4', '이미 Lv.5 승급한 학생의 Lv.5 신청이 남아 있음(되살아난 신청) → 교사 승인 → 보상 없이 목록만 비움', 1, async ({ world, clock }) => {
  const t = await bootTea(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => t.approveVisible());
}, { promotionRequests: { id_again_1: { id: 'id_again_1', studentId: sidOf(1), studentName: '학생1', level: 5, date: '2026-09-15' } },
     __promoted: true });
await scen('P0', '대조군: 학생 둘이 5초 간격, 교사도 한참 뒤', 2, async ({ world, clock, requested }) => {
  const a = await bootStu(world, clock, sidOf(1), { up: 80, down: 80 });
  const b = await bootStu(world, clock, sidOf(2), { up: 80, down: 80 });
  const t = await bootTea(world, clock, { up: 40, down: 40 });
  clock.at(1000, () => { a.request(); requested.add(sidOf(1)); });
  clock.at(6000, () => { b.request(); requested.add(sidOf(2)); });
  clock.at(12000, () => t.approveVisible());
});

// ── 무작위 200판: 학생 6명이 6초 안에 몰려 신청(최악 조건), 교사는 그 사이·뒤에 승인 ──
function rng(seedN) { let x = seedN >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
const fz = { runs: 0, lostRuns: 0, extraRuns: 0, leftRuns: 0, overRuns: 0 };
for (let r = 1; r <= 200; r++) {
  const rand = rng(r * 104729); const n = 6;
  const clock = makeClock(); const world = makeWorld({ seedData: seedP(n), clock });
  const requested = new Set(); const lat = () => 20 + Math.floor(rand() * 400);
  const stus = []; for (let i = 1; i <= n; i++) stus.push(await bootStu(world, clock, sidOf(i), { up: lat(), down: lat() }));
  const t = await bootTea(world, clock, { up: lat(), down: lat() });
  stus.forEach((s, i) => clock.at(1000 + Math.floor(rand() * 6000), () => { s.request(); requested.add(sidOf(i + 1)); }));
  for (let k = 0; k < 4; k++) clock.at(1500 + Math.floor(rand() * 6000), () => t.approveVisible());
  for (let k = 0; k < 3; k++) clock.at(9000 + k * 3000, () => { stus[0].DB.saveStudent(stus[0].DB.getStudent(sidOf(1))); });
  for (let k = 0; k < 3; k++) clock.at(10000 + k * 3000, () => t.approveVisible());
  await clock.run();
  const m = measure(world, n, requested);
  fz.runs++; if (m.lost) fz.lostRuns++; if (m.extraGold) fz.extraRuns++; if (m.left) fz.leftRuns++; if (m.overwritten) fz.overRuns++;
}

// ── 보고 ────────────────────────────────────────────────
let bad = false;
console.log('판 | 끝에 남은 신청 | 사라진 신청 | 중복 보상G | 설명');
for (const x of rows) {
  const b = x.lost || x.extraGold || x.left; if (b) bad = true;
  console.log(`${b ? '🔴' : '✅'} ${x.name} | ${x.left} | ${x.lost} | ${x.extraGold} | ${x.desc}`);
}
console.log(`무작위 ${fz.runs}판(학생 6 + 교사 1, 지연 20~420ms): 신청 사라진 판 ${fz.lostRuns} · 중복 보상 판 ${fz.extraRuns} · 끝에 신청 남은 판 ${fz.leftRuns}`);
console.log(`  (참고) 승인 기록은 있는데 학생 기기 저장이 승인을 덮은 판 ${fz.overRuns} — 골드 유실 갈래, 실패로 안 셈`);
if (fz.lostRuns || fz.extraRuns || fz.leftRuns) bad = true;
if (EXPECT_FIXED) {
  console.log(bad ? '\n최종 결과: ❌ FAIL' : '\n최종 결과: ✅ PASS (사라짐·중복·붙박이 0)');
  process.exitCode = bad ? 1 : 0;
} else {
  console.log(bad ? '\n최종 결과: 🔴 REPRO' : '\n최종 결과: ✅ 0');
}
