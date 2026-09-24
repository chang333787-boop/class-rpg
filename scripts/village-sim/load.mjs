// 마을 한 판을 node 에 통째로 싣는다 — village/index.html 은 한 줄도 안 고친다(엔진 제안서 ①).
// three 는 진짜(계산만) · 렌더러와 DOM 은 무엇을 불러도 빈 값을 돌려주는 가짜 · Math.random 은 시드.
// 네트워크 0: fetch 는 늘 거절 · sync.js 는 싣지 않는다(module 만) · sid 는 늘 guest.
// 한 프로세스에 한 판만 — 모듈 상태가 전역이라 두 판을 한 프로세스에 싣지 않는다(run.mjs 가 판마다 새 프로세스를 띄운다).
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';

function mulberry32(seed) { let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* [MAC-SIMRAND] 난수 두 줄기 — 판정(simRand · window.__SIM_RAND)은 seed 로, 그림·모형·three uuid(Math.random)는 lookSeed(없으면 seed)로.
   그림이 Math.random 을 몇 번 더 먹어도 판정 값이 안 움직인다(--lookseed 로 그림 줄기만 흔들어 확인). 옛 index.html(simRand 없음)은 Math.random 하나만 쓰니 예전과 같은 값. */
function seedRandom(seed, lookSeed) {
  Math.random = mulberry32(lookSeed != null ? lookSeed : seed);
  globalThis.__SIM_RAND = mulberry32(((seed >>> 0) ^ 0x5EED5EED) >>> 0);
}

/* 아무 것이나 되는 가짜: 속성을 읽으면 또 가짜, 부르면 또 가짜, 숫자로 쓰면 0 */
const STORE = new WeakMap();
const bag = t => { let s = STORE.get(t); if (!s) STORE.set(t, s = {}); return s; };
function any() {
  const f = function () {};
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;                   // await 가짜 → 멈추지 않게
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      const s = bag(t); if (!(k in s)) s[k] = any(); return s[k];
    },
    set(t, k, v) { bag(t)[k] = v; return true; },
    apply() { return any(); }, construct() { return any(); }, has() { return true; },
  });
}

function fakeGlobals({ saveText, hash, query, root }) {
  const g = globalThis, def = (k, v) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
  const ls = new Map(); if (saveText != null) ls.set('rpg.village.guest', saveText);
  /* 판(?stage=id)은 저장 칸이 따로다(`rpg.village.guest.<id>` · index.html stageKeyPart) — 그래서 --save 와 --stage 를 함께 주면
     저장본이 기본 칸에만 들어가 판이 **빈 땅으로** 열렸다. 판 칸에도 같은 저장본을 넣는다(흐름이 켜진 판에서 시험 판을 재려면 이게 있어야 한다). */
  { const st = /(?:^|&)stage=([^&]*)/.exec(query || ''); const id = st ? decodeURIComponent(st[1]).replace(/[^a-z0-9\-]/g, '').slice(0, 40) : '';
    if (saveText != null && id) ls.set('rpg.village.guest.' + id, saveText); }
  def('localStorage', { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k), key: i => [...ls.keys()][i] ?? null, clear: () => ls.clear(), get length() { return ls.size; } });
  def('sessionStorage', g.localStorage);
  def('location', new URL('http://sim.local/village/index.html?sid=guest&dev=1' + (query ? '&' + query : '') + '#' + (hash || '')));
  def('navigator', { userAgent: 'village-sim', maxTouchPoints: 0, language: 'ko', onLine: false });
  def('document', any()); def('window', g); def('self', g);
  // 네트워크를 쓰려 한 주소 — 쓰려 해도 늘 거절한다. 마을 자기 파일(모델 glb 등 같은 출처)은 __simLocal, 그 밖은 __simNet 에 센다
  g.__simNet = 0; g.__simLocal = [];
  // 단 하나 예외: 판 파일(village/stages/ 밑)은 디스크에서 읽어 준다 — 브라우저의 ?stage= 와 같은 길로 판을 얹게(읽기만)
  def('fetch', async (u) => { const url = new URL(String(u && u.url || u), g.location.href);
    if (url.origin === g.location.origin && url.pathname.startsWith('/village/stages/') && !url.pathname.includes('..')) {
      const f = path.join(root, decodeURIComponent(url.pathname)); g.__simStage = (g.__simStage || []).concat(url.pathname);
      if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => null, text: async () => '' };
      const t = fs.readFileSync(f, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t };
    }
    if (url.origin === g.location.origin) g.__simLocal.push(url.pathname); else g.__simNet++; throw new Error('village-sim: 네트워크 없음'); });
  def('XMLHttpRequest', function () { g.__simNet++; throw new Error('village-sim: 네트워크 없음'); });
  def('WebSocket', function () { g.__simNet++; throw new Error('village-sim: 네트워크 없음'); });
  def('addEventListener', () => {}); def('removeEventListener', () => {}); def('dispatchEvent', () => true);
  def('requestAnimationFrame', () => 0); def('cancelAnimationFrame', () => {});
  def('setTimeout', () => 0); def('setInterval', () => 0); def('clearTimeout', () => {}); def('clearInterval', () => {});
  def('innerWidth', 1280); def('innerHeight', 800); def('devicePixelRatio', 1);
  def('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  def('Image', function () { return any(); }); def('HTMLCanvasElement', function () {});
  def('WebGL2RenderingContext', function () {}); def('WebGLRenderingContext', function () {});
  def('__FakeRenderer', function () { return any(); });
  return ls;
}

/* opts: { root, html, saveText, seed, lookSeed, hash, query, quiet } → 마을의 window(시험 훅 __*) */
export async function loadVillage(opts) {
  const root = opts.root, html = fs.readFileSync(opts.html ? path.resolve(root, opts.html) : path.join(root, 'village/index.html'), 'utf8');   // opts.html: 다른 index.html(전/후 비교용 · vendor·stages 는 root 것)
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('module 스크립트를 못 찾음');
  const three = pathToFileURL(path.join(root, 'village/vendor/three.module.js')).href;
  const IMP = "import * as THREE from 'three';";
  if (!m[1].includes(IMP)) throw new Error('three import 줄이 바뀜: ' + IMP);
  const src = m[1].replace(IMP, "import * as THREE0 from '" + three + "'; const THREE = Object.assign({}, THREE0, { WebGLRenderer: globalThis.__FakeRenderer });");
  seedRandom(opts.seed || 1, opts.lookSeed);
  const ls = fakeGlobals({ ...opts, root });
  // 떼어 낸 module 은 village/ 안에 뜬다 — 임시 폴더에 뜨면 './sim/*.js' 같은 상대 경로가 깨진다(ERR_MODULE_NOT_FOUND · 엔진 ④ 걸음 0)
  const file = path.join(root, 'village', '_simrun-' + process.pid + '-' + Date.now() + '.mjs');
  fs.writeFileSync(file, src);
  const log = console.log, warn = console.warn;
  if (opts.quiet !== false) { console.log = () => {}; console.warn = () => {}; }
  /* [MAC-SIMCLOCK] 벽시계를 멈춘다 — 싣는 순간부터 이 프로세스가 끝날 때까지 performance.now · Date.now 는 한 값(시뮬 동안 진짜 시간은 흐르지 않는다).
     시뮬은 같은 시드면 같은 값이어야 하는데, 벽시계가 판정에 두 군데서 스몄다(09-24 보스 · 판 열둘을 한꺼번에 돌리면 farm+mid36 3값 · 다시 돌리면 0):
     ① module 끝의 첫 loop() — lastT(싣는 중간에 잰 시각)부터 흐른 진짜 시간만큼(최대 250ms × 배속) 시뮬 틱을 미리 돌렸다. 싣기가 100ms 를 넘으면
        (부하 · 다른 검사와 겹침) 1~2틱 앞서 시작 — 재현: 그 자리만 벽시계를 늦추면 150ms → 1틱 · 500ms → 2틱 · farm+mid36 틱 450 찡그린집 5 → 7.
     ② 땅 고르기(F22 plotTick) — 인구 10명마다 새 땅을 '진짜 30초' 안 고르면 저절로 연다. 판 하나가 30초를 넘기면(부하) 열려 pop88 이틀째 인구 94 → 92.
     index.html 은 그대로 — 브라우저에선 맞는 동작이다(아이의 30초). 멈춘 시계 = 한가한 기기에서 판 하나가 몇 초에 끝나던 지금까지의 값.
     틱 시간 재기는 진짜 시계로 따로(__tickBench 결과의 틱평균ms · 묶음마다) — 모듈 안의 틱 ms 는 멈춘 시계라 0 이다. */
  const realNow = performance.now, frozen = realNow.call(performance), frozenDate = Date.now();
  Object.defineProperty(performance, 'now', { value: () => frozen, configurable: true, writable: true }); Date.now = () => frozenDate;
  globalThis.__simRealNow = () => realNow.call(performance);
  try { await import(pathToFileURL(file).href); }
  catch (e) {   // 줄 번호를 index.html 기준으로(module 은 258줄 무렵에서 시작)
    const at = (e.stack || '').match(/\.mjs:(\d+):(\d+)/); const base = html.slice(0, m.index).split('\n').length;
    throw new Error('LOAD ERR ' + e.message + (at ? ' · index.html ' + (+at[1] + base - 1) + '줄 무렵' : ''));
  } finally { console.log = log; console.warn = warn; fs.rmSync(file, { force: true }); }
  if (typeof globalThis.__tickBench !== 'function') throw new Error('시험 훅 __tickBench 가 없음');
  { const tb0 = globalThis.__tickBench; globalThis.__tickBench = n => { const t0 = realNow.call(performance), r = tb0(n);   // [MAC-SIMCLOCK] 틱 시간은 진짜 시계로(묶음 평균)
      return { ...r, 틱평균ms: +((realNow.call(performance) - t0) / (n || 100)).toFixed(3) }; }; }
  return { w: globalThis, ls };
}
