#!/usr/bin/env node
// 우리반 성장 RPG — 친해지기 쓰기 ↔ 교사 통째 저장 겹침 재현 (DECO-LIFE-SYNC-1)
//
//  무엇: docs/deco_guests_design.md §6-1 의 약속을 숫자로 본다.
//        학생 기기가 동물을 쓰다듬어 하트를 쓰는 동안 교사 기기가 보상을 승인(학생 문서 통째 set)하면
//        ① 교사가 준 골드가 사라지는가(골드 유실 M2 와 같은 길) ② 하트는 어떻게 되나.
//        '잎만 update'(지금 코드)와 '통째 저장'(버린 설계 — 대조군)을 같은 씨앗으로 나란히 돌린다.
//  틀: scripts/unit/gold-sync-sim.mjs 의 가짜 RTDB 서버 · 가상 시계를 그대로 옮겨 왔다(그 파일은 불러 쓸 수 없는 구조).
//      실제 gamedata.js DB · admin.js approveSingle · student.js _life* 함수를 잘라 넣는다. 운영 Firebase·네트워크 없음.
//  사용: node scripts/unit/deco-life-sync-sim.mjs   (잎 쓰기에서 골드 유실이 하나라도 나면 exit 1)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMEDATA = fs.readFileSync(path.join(ROOT, 'gamedata.js'), 'utf8');
const ADMIN = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const STUDENT = fs.readFileSync(path.join(ROOT, 'student.js'), 'utf8');

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
function sliceFn(src, name) {
  const m = new RegExp(`^function ${name}\\s*\\(`, 'm').exec(src);
  if (!m) throw new Error('함수 없음: ' + name);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) return src.slice(m.index, i + 1); }
  throw new Error('중괄호: ' + name);
}
function sliceConst(src, name) {
  const m = new RegExp(`^(?:const|let|var) ${name}\\s*=[^\\n]*\\n`, 'm').exec(src);
  if (!m) throw new Error('상수 없음: ' + name);
  return m[0];
}

// ── 가상 시계(gold-sync-sim 과 같음) ─────────────────────────
function makeClock() {
  let now = 0, seq = 0; const q = [];
  return {
    get now() { return now; },
    at(t, fn) { q.push({ t, s: seq++, fn }); },
    after(ms, fn) { this.at(now + Math.max(0, ms), fn); },
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

// ── 가짜 RTDB 서버 + 기기(gold-sync-sim 과 같음: 낙관적 로컬 반영 · 지연 · 서버 더하기) ──
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
        const v = op.value[k], full = op.path + '/' + k;
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
      fire();
      clock.after(c.up, () => {
        server.tree = applyOp(server.tree, op);
        const state = clone(server.tree);
        for (const other of clients) {
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
    vm.runInContext(GAMEDATA + '\n;globalThis.__DB = DB;', sb);
    c.sb = sb; c.DB = sb.__DB;
    clients.push(c);
    return c;
  }
  return { server, clients, makeClient };
}

// ── 화면 흉내 ────────────────────────────────────────────
const LIFE_FNS = ['_decoSpaceOf', '_lifeDay', '_lifeObj', '_lifeGet', '_lifeOk', '_lifeHearts', '_lifeStage', '_lifeNo', '_lifeFriendAt', '_lifeApply', '_lifeSend', '_lifeWrite', '_lifePet'];
const DAY0 = 20700;
const T = (day) => day * 86400000 - 9 * 3600000 + 3600000;   // 그날 한국 새벽 1시
async function bootKid(world, clock, sid, opt, mode) {
  const c = world.makeClient('학생:' + sid, opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  c.CUR = JSON.parse(JSON.stringify(c.DB.getStudent(sid)));                 // doLogin: 깊은 복사
  c.DB.onDataChange(() => { const fresh = c.DB.getStudent(c.CUR.id); if (fresh) c.CUR = fresh; });   // student.js onload 와 같음
  vm.runInContext('let DECO_SPACE = 1; let _lifeWrites = 0;\n' + sliceConst(STUDENT, 'LIFE_STAGE_AT') + LIFE_FNS.map(n => sliceFn(STUDENT, n)).join('\n')
    + (mode === 'whole' ? '\n_lifeSend = function (student, out) { if (!out) return false; DB.saveStudent(student); return true; };   // 대조군: 통째 저장' : '')
    + '\nglobalThis.__pet = (student, p, now) => _lifePet(student, p, now);', c.sb);
  c.hist = [];
  c.pet = (day) => {
    const p = (c.CUR.houseDecorations || [])[0];
    const r = c.sb.__pet(c.CUR, p, T(day));
    const f = r && c.CUR.decoLife && c.CUR.decoLife.a && c.CUR.decoLife.a[r.u];
    if (f) c.hist.push(f.h + '@' + f.d);
    return r;
  };
  return c;
}
async function bootTeacher(world, clock, opt) {
  const c = world.makeClient('교사', opt);
  const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now);
  c.DB.onDataChange(() => {});
  vm.runInContext(`var notify=function(){}, renderAll=function(){};\n${sliceFn(ADMIN, 'approveReward')}\n${sliceFn(ADMIN, 'approveSingle')}\n` +
    'globalThis.__approveSingle = approveSingle;', c.sb);
  c.approve = (sid, id, gold) => {
    const s = c.DB.getStudent(sid);
    s.pendingRewards = [...(s.pendingRewards || []), { id, label: 'f', type: 'quest', boardQuestType: 'special', gold, exp: 0 }];
    c.sb.__approveSingle(sid, id);
  };
  return c;
}
const SID = 's1773621060761';
function seed() {
  return { students: { [SID]: { id: SID, name: '학생1', pw: 'x', level: 5, exp: 500, gold: 1000, totalGold: 1000, pendingRewards: [],
    houseDecorations: [{ id: 'd_y53', area: 'yard', row: 5, col: 9 }] } }, settings: { className: '시험' }, questLogs: {}, boardQuests: [] };
}
function rng(seedN) { let x = seedN >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

//  한 판: 학생이 12일에 걸쳐 하루 한 번 쓰다듬고(하트 +1 × 12), 교사가 10번 승인(10G × 10) — 시각 · 지연은 씨앗으로
//   span = 사건이 흩어지는 시간(ms). 압축판(15초)은 겹침을 일부러 많이 만든다 · 실제 간격판(12분)은 수업 중에 가깝다.
async function run(seedN, mode, span) {
  const rand = rng(seedN * 7919), clock = makeClock(), world = makeWorld({ seedData: seed(), clock });
  const lat = () => 20 + Math.floor(rand() * 400);
  const kid = await bootKid(world, clock, SID, { up: lat(), down: lat() }, mode);
  const tea = await bootTeacher(world, clock, { up: lat(), down: lat() });
  const pets = [], approvals = [];
  for (let k = 0; k < 12; k++) pets.push(1000 + Math.floor(rand() * span));
  for (let k = 0; k < 10; k++) approvals.push(1000 + Math.floor(rand() * span));
  pets.sort((a, b) => a - b).forEach((t, k) => clock.at(t, () => kid.pet(DAY0 + k)));
  approvals.forEach((t, k) => clock.at(t, () => tea.approve(SID, 'rw' + k, 10)));
  await clock.run();
  const s = getAt(world.server.tree, 'classRPG_v3/students/' + SID) || {};
  const f = s.decoLife && s.decoLife.a && Object.values(s.decoLife.a)[0];
  return { goldLost: 1000 + 100 - (s.totalGold || 0), heartsLost: 12 - (f ? f.h : 0) };
}

const N = 200, sum = {};
for (const [tag, span] of [['압축판(15초)', 15000], ['실제 간격판(12분)', 12 * 60000]]) {
  for (const mode of ['leaf', 'whole']) {
    const o = sum[tag + mode] = { tag, mode, lossRuns: 0, lost: 0, heartRuns: 0, heartsLost: 0 };
    for (let r = 1; r <= N; r++) {
      const x = await run(r, mode, span);
      if (x.goldLost) { o.lossRuns++; o.lost += x.goldLost; }
      if (x.heartsLost) { o.heartRuns++; o.heartsLost += x.heartsLost; }
    }
  }
}
console.log(`무작위 ${N}판씩(학생 쓰다듬기 12일 + 교사 승인 10G × 10, 지연 20~420ms)`);
let bad = false;
for (const o of Object.values(sum)) {
  const leaf = o.mode === 'leaf';
  if (leaf && o.lossRuns) bad = true;
  console.log(`${leaf ? (o.lossRuns ? '🔴' : '✅') : 'ℹ️'} ${o.tag} · ${leaf ? '잎 쓰기(지금 코드)' : '통째 저장(대조군)'} : 골드 유실 판 ${o.lossRuns} · 유실 합 ${o.lost}G · 하트 되돌림 판 ${o.heartRuns} · 잃은 하트 합 ${o.heartsLost}/${N * 12}`);
}
console.log('  (하트 되돌림 = 교사 기기의 통째 저장(#288)이 학생 문서를 옛 사본으로 덮는 것 — 장식 놓기 등 학생 문서의 다른 칸도 같은 길에 있다)');
console.log(bad ? '\n최종 결과: ❌ FAIL — 잎 쓰기에서 골드 유실' : '\n최종 결과: ✅ 0');
process.exit(bad ? 1 : 0);
