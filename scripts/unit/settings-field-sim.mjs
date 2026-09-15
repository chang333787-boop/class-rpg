#!/usr/bin/env node
// 우리반 성장 RPG — 아침 자동등록이 교사 설정을 되돌리는지 (DAILY-DATE-FIELD-1)
//
//  학생 기기 enterGame → DB.ensureDailyQuests() 가 autoDailyLastDate 를 적는 순간,
//  교사가 설정(보스 켜기)을 저장하면 서버에 무엇이 남는지 본다. 학생 호출 시각을 교사 저장 ±1초로 흔든다.
//  가짜 RTDB 는 GOLD-LOSS-SIM-1(gold-sync-sim.mjs) 와 같은 것. 운영·네트워크 없음.
//
//  사용: node scripts/unit/settings-field-sim.mjs [--expect-fixed]
//        SIM_ROOT=<다른 체크아웃> node …   (수정 전 코드로 같은 시험)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SIM_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
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
async function boot(world, clock, name, opt) { const c = world.makeClient(name, opt); const p = c.DB.init(); await clock.run(clock.now); await p; await clock.run(clock.now); c.DB.onDataChange(() => {}); return c; }
let bad = 0, runs = 0;
for (const gap of [-1000, -300, -150, -50, 0, 50, 150, 300, 1000]) {
  const clock = makeClock();
  const world = makeWorld({ seedData: { students: {}, settings: { className: '시험', bossActive: false, autoDailyQuests: [{ name: '독서' }], autoDailyLastDate: '2026-09-14' }, questLogs: {}, boardQuests: [] }, clock });
  const tea = await boot(world, clock, '교사', { up: 40, down: 40 });
  const stu = await boot(world, clock, '학생', { up: 200, down: 200 });
  clock.at(1000, () => tea.DB.saveSettings({ ...tea.DB.getSettings(), bossActive: true }));
  clock.at(1000 + gap, () => stu.DB.ensureDailyQuests());
  await clock.run();
  const s = world.server.tree.classRPG_v3.settings; runs++;
  const bq = (world.server.tree.classRPG_v3.boardQuests || []).filter(q => q && q.active !== false).length;
  const ok = s.bossActive === true && bq === 1;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '🔴'} 학생 ${gap >= 0 ? '+' : ''}${gap}ms: 교사가 켠 보스=${s.bossActive} · 오늘 자동퀘 ${bq}개 · lastDate=${s.autoDailyLastDate}`);
}
console.log(`\n교사 설정 되돌림 ${bad}/${runs}`);
if (process.argv.includes('--expect-fixed')) { console.log(bad ? '최종 결과: ❌ FAIL' : '최종 결과: ✅ PASS'); process.exitCode = bad ? 1 : 0; }
else console.log(bad ? '최종 결과: 🔴 REPRO' : '최종 결과: ✅ 0');
