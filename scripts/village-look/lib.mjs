// 마을 헤드리스 크롬 틀 — village-look(shots.mjs)과 화면 시험 틀(village-d/dcheck.mjs)이 함께 쓴다 [PA-00 · 틀 한 벌].
//
//   · 크롬: ms-playwright 의 chrome-headless-shell 하나를 이 틀이 띄운다(CDP 직결 — playwright 패키지 없이) · 창 0 · 끝나면 닫는다.
//   · 정적 서버: 127.0.0.1 · 뿌리를 바꿔 끼울 수 있다(village-look --vs-ref 는 ref 한 번 · 작업 트리 한 번).
//   · 바깥 주소: 이 서버와 data:/blob: 말고는 **전부 막는다**(Fetch — 운영 DB·구글 포함) · 막은 채 **시도를 적는다**(몇 번 · 어디로).
//   · 결정성: 그림 난수(Math.random)·판정 난수(window.__SIM_RAND)를 시드로 고정 · 가짜 시계(performance.now · requestAnimationFrame 을 한 장씩).
//     ⚠ 가짜 시계는 rAF · performance.now 만 멈춘다 — setTimeout · setInterval · Date.now 는 진짜 시간이다(시작 카드 600ms · 토스트 2.1초 …).
//
// 쓰는 쪽은 serve() → initScript() → openChrome() 차례로 부르고, 끝에 close() 둘.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 크롬 경로 — CHROME= 가 먼저 */
export function findChrome() {
  return process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');
}

/* 그리는 방식 — 맥은 metal(swiftshader·--disable-gpu 금지 — 보스 09-24). 모르는 값이면 null */
export function glArgs(gl) { return gl === 'metal' ? ['--use-angle=metal', '--use-gl=angle'] : gl === 'default' ? [] : null; }

/* ── 정적 서버(뿌리를 바꿔 끼운다) ── */
export const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };
export async function serve(root) {
  let SERVE = root;
  const server = http.createServer((q, s) => {
    if (q.method !== 'GET' && q.method !== 'HEAD') { s.writeHead(405); return s.end(); }
    let u; try { u = decodeURIComponent(q.url.split('?')[0]); } catch { s.writeHead(400); return s.end(); }
    const f = path.join(SERVE, u); if (!f.startsWith(SERVE + path.sep)) { s.writeHead(403); return s.end(); }
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(d); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: 'http://127.0.0.1:' + server.address().port, setRoot: dir => { SERVE = dir; }, root: () => SERVE, close: () => server.close() };
}

/* ── 페이지에 먼저 심는 것: 시드 고정 난수 두 줄기 + 가짜 시계(쓰는 쪽이 __shots.step 으로 한 장씩 돌린다) ── */
export function initScript({ lookseed = 1 } = {}) {
  const LOOKSEED = (lookseed >>> 0) || 1;
  return `(() => {
  const mb = s => { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  Math.random = mb(${LOOKSEED}); window.__SIM_RAND = mb(${(LOOKSEED ^ 0x5EED5EED) >>> 0});
  const q = new Map(), nativeRAF = window.requestAnimationFrame.bind(window); let id = 0, vt = 1000;
  window.requestAnimationFrame = cb => { const i = ++id; q.set(i, cb); return i; };
  window.cancelAnimationFrame = i => { q.delete(i); };
  Object.defineProperty(performance, 'now', { value: () => vt, configurable: true, writable: true });
  window.__shots = { errs: [],
    step(n, dt) { for (let k = 0; k < n; k++) { vt += dt; const cbs = [...q.values()]; q.clear(); for (const cb of cbs) { try { cb(vt); } catch (e) { this.errs.push(String((e && e.message) || e).slice(0, 160)); } } } return vt; },
    real: () => new Promise(r => nativeRAF(() => nativeRAF(r))) };
})();`;
}

/* ── 크롬 하나(CDP) ──
   chrome · view{w,h} · gl(크롬 인자 배열) · init(페이지에 먼저 심을 글) · allow(url → 통과?) · tmpPrefix(프로필 폴더 머리) · keep(프로필을 지우지 않음).
   돌려주는 것: send · evaluate · nav · until · netIdle · pump · st(blocked · inflight · lastNet · pageErr) · close */
export async function openChrome({ chrome, view = { w: 1366, h: 610 }, gl = [], init, allow, tmpPrefix = 'village-look-', keep = false }) {
  const port = 9700 + (process.pid % 250), prof = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix));
  const ch = spawn(chrome, ['--remote-debugging-port=' + port, '--user-data-dir=' + prof, `--window-size=${view.w},${view.h}`, ...gl, '--no-first-run', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
  let ws, id = 0; const wait = new Map(), st = { blocked: 0, inflight: new Set(), lastNet: 0, pageErr: [] };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, m => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (src, ms = 60000) => { const r = await send('Runtime.evaluate', { expression: '(async () => {' + src + '})()', awaitPromise: true, returnByValue: true, timeout: ms });
    if (r.exceptionDetails) throw new Error(((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '평가 오류').split('\n')[0]); return r.result ? r.result.value : null; };
  const nav = async url => { await send('Page.navigate', { url }); for (let k = 0; k < 150; k++) { await sleep(100); try { if (await evaluate('return document.readyState') === 'complete') return; } catch {} } };
  const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evaluate('return !!(' + cond + ')')) return; } catch {} await sleep(150); } throw new Error(what + ' — ' + ms / 1000 + '초 안에 안 됨'); };
  const netIdle = async (ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (!st.inflight.size && Date.now() - st.lastNet > 400) return true; await sleep(100); } return false; };
  const pump = n => evaluate(`return window.__shots.step(${n | 0}, 1000 / 60)`);
  const close = async () => { try { ws && ws.close(); } catch {} ch.kill('SIGKILL'); await sleep(400); if (!keep) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} } };
  try {
    let list; for (let k = 0; k < 60; k++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
    if (!list) throw new Error('크로미움에 못 붙음');
    ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data);
      if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
      if (m.method === 'Fetch.requestPaused') { const u = m.params.request.url;                  /* 바깥 주소는 전부 막는다 — allow 가 참인 것(이 서버 · data:/blob:)만 */
        if (allow(u)) send('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {});
        else { st.blocked++; send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {}); } }
      else if (m.method === 'Network.requestWillBeSent') { st.inflight.add(m.params.requestId); st.lastNet = Date.now(); }
      else if (m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') { st.inflight.delete(m.params.requestId); st.lastNet = Date.now(); }
      else if (m.method === 'Runtime.exceptionThrown') st.pageErr.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0].slice(0, 160)); });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: view.w, height: view.h, deviceScaleFactor: 1, mobile: false });
    if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  } catch (e) { await close(); throw e; }
  return { send, evaluate, nav, until, netIdle, pump, st, close };
}
