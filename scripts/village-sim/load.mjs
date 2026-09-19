// 마을 한 판을 node 에 통째로 싣는다 — village/index.html 은 한 줄도 안 고친다(엔진 제안서 ①).
// three 는 진짜(계산만) · 렌더러와 DOM 은 무엇을 불러도 빈 값을 돌려주는 가짜 · Math.random 은 시드.
// 네트워크 0: fetch 는 늘 거절 · sync.js 는 싣지 않는다(module 만) · sid 는 늘 guest.
// 한 프로세스에 한 판만 — 모듈 상태가 전역이라 두 판을 한 프로세스에 싣지 않는다(run.mjs 가 판마다 새 프로세스를 띄운다).
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';

function seedRandom(seed) {   // mulberry32
  let a = (seed >>> 0) || 1;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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

/* opts: { root, html, saveText, seed, hash, query, quiet } → 마을의 window(시험 훅 __*) */
export async function loadVillage(opts) {
  const root = opts.root, html = fs.readFileSync(opts.html ? path.resolve(root, opts.html) : path.join(root, 'village/index.html'), 'utf8');   // opts.html: 다른 index.html(전/후 비교용 · vendor·stages 는 root 것)
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('module 스크립트를 못 찾음');
  const three = pathToFileURL(path.join(root, 'village/vendor/three.module.js')).href;
  const IMP = "import * as THREE from 'three';";
  if (!m[1].includes(IMP)) throw new Error('three import 줄이 바뀜: ' + IMP);
  const src = m[1].replace(IMP, "import * as THREE0 from '" + three + "'; const THREE = Object.assign({}, THREE0, { WebGLRenderer: globalThis.__FakeRenderer });");
  seedRandom(opts.seed || 1);
  const ls = fakeGlobals({ ...opts, root });
  const file = path.join(os.tmpdir(), 'village-sim-' + process.pid + '-' + Date.now() + '.mjs');
  fs.writeFileSync(file, src);
  const log = console.log, warn = console.warn;
  if (opts.quiet !== false) { console.log = () => {}; console.warn = () => {}; }
  try { await import(pathToFileURL(file).href); }
  catch (e) {   // 줄 번호를 index.html 기준으로(module 은 258줄 무렵에서 시작)
    const at = (e.stack || '').match(/\.mjs:(\d+):(\d+)/); const base = html.slice(0, m.index).split('\n').length;
    throw new Error('LOAD ERR ' + e.message + (at ? ' · index.html ' + (+at[1] + base - 1) + '줄 무렵' : ''));
  } finally { console.log = log; console.warn = warn; fs.rmSync(file, { force: true }); }
  if (typeof globalThis.__tickBench !== 'function') throw new Error('시험 훅 __tickBench 가 없음');
  return { w: globalThis, ls };
}
