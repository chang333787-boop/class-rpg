// 마을 화면 회귀 검사 — 판 아홉 × 고정 카메라 몇 장을 찍어 **기준 사진과 픽셀 차이**를 낸다 (보스 09-24 · [MAC-LOOKSHOTS]).
// flipY(#922) 처럼 규칙·기준 ① 은 그대로인데 **그림만 조용히 틀어지는** 부류를 PR 마다 잡는 장치다. 결과는 차이 % 와 '차이 난 칸' 표만 낸다.
//
// 브라우저는 이 스크립트가 띄운 **전용 headless 크로미움 하나**(ms-playwright 의 chrome-headless-shell · CDP 직결 — playwright 패키지 없이).
// GPU 는 metal(`--use-angle=metal --use-gl=angle` · 이 맥 M5 · swiftshader·--disable-gpu 금지 — 보스 09-24). 렌더러 문자열을 기준과 함께 적고, 다르면 견주지 않는다.
// 정적 서버도 스스로 띄운다(127.0.0.1). sid 는 늘 guest · **바깥 주소는 전부 막는다**(Fetch — 운영 DB·구글 포함) · 창 0 · 한 번에 한 판 · 끝나면 브라우저·서버를 닫는다.
//
// 같은 코드면 같은 사진이 나오게(결정성):
//   · Math.random(그림) · window.__SIM_RAND(판정 · #926) 를 시드로 고정(--lookseed)
//   · 가짜 시계 — performance.now 와 requestAnimationFrame 을 이 스크립트가 한 장씩(1/60초) 돌린다. 실제로 몇 초가 걸리든 그림은 같은 순간이다.
//   · 그래픽 단계 고정(__gfxMode — 기본 'fixed' = 아이가 처음 보는 단계 · 'high' = 그림자) · 시뮬 멈춤(__setSpeed(0)) · 시각 고정(__setHour)
//   · UI 는 숨긴다 — 3D(#cv)와 미니맵(#mini)만 찍는다(--ui 면 UI 도).
//
//   node scripts/village-look/shots.mjs --update                   # 지금 작업 트리로 기준 사진을 새로 찍는다(tmp/village-look/기준)
//   node scripts/village-look/shots.mjs                            # 지금 작업 트리를 찍어 기준과 견준다(차이 > --max % 이면 끝값 1)
//   node scripts/village-look/shots.mjs --vs-ref origin/main       # 기준을 그 ref 에서 바로 찍어 견준다(저장된 기준은 안 건드린다)
//   node scripts/village-look/shots.mjs --update --ref origin/main # 기준을 그 ref 로 찍어 둔다
//   node scripts/village-look/shots.mjs --boards sea,mountain+village/stages/boards/mid36.json --shots default,whole
//   그 밖: --hour 10 · --gfx fixed|high · --lookseed 1 · --frames 60 · --max 0(%) · --tol 2(채널 차) · --ui · --json <파일> · --dir tmp/village-look · --keep
import { spawn, spawnSync } from 'node:child_process'; import crypto from 'node:crypto'; import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), flag = k => args.includes('--' + k), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
const MID = 'village/stages/boards/mid36.json';
const BOARDS = opt('boards', `기본+village/stages/boards/pop88.json,town3,farm+${MID},city+${MID},sea,mountain,origin,proto-flow,proto-vote`).split(',').map(s => s.trim()).filter(Boolean);
const SHOTS = opt('shots', 'default,near,whole').split(',').map(s => s.trim()).filter(Boolean);
const DIR = path.resolve(ROOT, opt('dir', 'tmp/village-look')), BASEDIR = path.join(DIR, '기준'), NOWDIR = path.join(DIR, '지금'), DIFFDIR = path.join(DIR, '차이');
const HOUR = +opt('hour', '10'), GFX = opt('gfx', 'fixed'), LOOKSEED = (+opt('lookseed', '1') >>> 0) || 1, FRAMES = Math.max(2, +opt('frames', '60') | 0);
const MAX = +opt('max', '0'), TOL = +opt('tol', '2'), JSON_OUT = opt('json', null), UI = flag('ui'), UPDATE = flag('update'), REF = opt('ref', null), VSREF = opt('vs-ref', null);
const VIEW = { w: 1366, h: 610 };
const bad = SHOTS.filter(s => !['default', 'near', 'whole'].includes(s)); if (bad.length) { console.error('모르는 장면: ' + bad.join(' ') + ' (default · near · whole)'); process.exit(2); }
if (UPDATE && VSREF) { console.error('--update 와 --vs-ref 는 같이 쓰지 않는다(--vs-ref 는 저장된 기준을 안 건드린다)'); process.exit(2); }
if (REF && !UPDATE) { console.error('--ref 는 --update 와 함께(기준을 그 ref 로 찍는다) — 바로 견주려면 --vs-ref'); process.exit(2); }
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');
if (!fs.existsSync(CHROME)) { console.error('헤드리스 크로미움이 없다: ' + CHROME + ' — CHROME=<경로> 로 알려 주거나 npx playwright install chromium-headless-shell'); process.exit(2); }
const GL = opt('gl', process.platform === 'darwin' ? 'metal' : 'default'), GLARGS = GL === 'metal' ? ['--use-angle=metal', '--use-gl=angle'] : GL === 'default' ? [] : null;
if (!GLARGS) { console.error('--gl 은 metal · default 만 — swiftshader 는 쓰지 않는다(보스 09-24 GPU 규칙)'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const boardName = spec => { const [name, save] = spec.split('+'); return name + (save ? '+' + path.basename(save, '.json') : ''); };
const fname = (spec, shot) => (boardName(spec) + '__' + shot + '.png').replace(/[\\/:*?"<>|]/g, '_');

/* ── 그 ref 의 village/ 를 임시 폴더로 풀어 서버 뿌리로 쓴다(기준을 main 에서 찍을 때 — 판 파일·저장본·그림도 그 ref 것) ── */
const temps = [];
function refRoot(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-look-ref-')), tar = path.join(dir, 'v.tar'); temps.push(dir);
  const a = spawnSync('git', ['archive', '--format=tar', '-o', tar, ref, 'village'], { cwd: ROOT, encoding: 'utf8' });
  if (a.status !== 0) throw new Error('git archive ' + ref + ' 실패: ' + (a.stderr || '').trim());
  const x = spawnSync('tar', ['-xf', tar, '-C', dir], { encoding: 'utf8' }); if (x.status !== 0) throw new Error('tar 실패: ' + (x.stderr || '').trim());
  fs.rmSync(tar, { force: true }); return dir;
}

/* ── 정적 서버(뿌리를 바꿔 끼운다 — --vs-ref 는 ref 한 번 · 작업 트리 한 번) ── */
let SERVE = ROOT;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((q, s) => {
  if (q.method !== 'GET' && q.method !== 'HEAD') { s.writeHead(405); return s.end(); }
  let u; try { u = decodeURIComponent(q.url.split('?')[0]); } catch { s.writeHead(400); return s.end(); }
  const f = path.join(SERVE, u); if (!f.startsWith(SERVE + path.sep)) { s.writeHead(403); return s.end(); }
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

/* ── 페이지에 먼저 심는 것: 시드 고정 난수 두 줄기 + 가짜 시계(이 스크립트가 한 장씩 돌린다) ── */
const INIT = `(() => {
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

/* ── CDP ── */
const port = 9700 + (process.pid % 250), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'village-look-')); temps.push(prof);
const ch = spawn(CHROME, ['--remote-debugging-port=' + port, '--user-data-dir=' + prof, `--window-size=${VIEW.w},${VIEW.h}`, ...GLARGS, '--no-first-run', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0, blocked = 0, lastNet = 0; const inflight = new Set(), wait = new Map(), pageErr = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, m => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (src, ms = 60000) => { const r = await send('Runtime.evaluate', { expression: '(async () => {' + src + '})()', awaitPromise: true, returnByValue: true, timeout: ms });
  if (r.exceptionDetails) throw new Error(((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '평가 오류').split('\n')[0]); return r.result ? r.result.value : null; };
const nav = async url => { await send('Page.navigate', { url }); for (let k = 0; k < 150; k++) { await sleep(100); try { if (await evaluate('return document.readyState') === 'complete') return; } catch {} } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evaluate('return !!(' + cond + ')')) return; } catch {} await sleep(150); } throw new Error(what + ' — ' + ms / 1000 + '초 안에 안 됨'); };
const netIdle = async (ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (!inflight.size && Date.now() - lastNet > 400) return true; await sleep(100); } return false; };
const pump = n => evaluate(`return window.__shots.step(${n | 0}, 1000 / 60)`);
const HIDE = 'body * { visibility: hidden !important; } #cv, #mini { visibility: visible !important; }';

/* 한 판 — 판 밖 페이지에서 저장 키를 넣고(마을 페이지는 닫힐 때 제 판을 다시 적는다) 연 뒤, 멈추고 고정해서 장면마다 찍는다.
   onShot(spec, shot, file) 은 **그 장면의 카메라가 살아 있을 때** 부른다(견주기의 '칸' 짚기가 그 카메라를 쓴다). */
async function shootBoard(spec, outDir, onShot) {
  const [name, save] = spec.split('+'), stage = name === '기본' ? '' : name, key = 'rpg.village.guest' + (stage ? '.' + stage : '');
  await nav(BASE + '/village/stages/rules.json');
  await evaluate('localStorage.clear(); sessionStorage.clear(); return 1');
  if (save) await evaluate(`const r = await fetch(${JSON.stringify('/' + save)}); if (!r.ok) throw new Error('저장본 ' + r.status); localStorage.setItem(${JSON.stringify(key)}, await r.text()); return 1`);
  pageErr.length = 0;
  await nav(BASE + '/village/index.html?' + (stage ? 'stage=' + encodeURIComponent(stage) + '&' : '') + 'sid=guest');
  await until(`typeof window.__setSpeed === 'function' && typeof window.__view === 'function' && typeof window.__gfxMode === 'function' && window.__shots`, 30000, boardName(spec) + ' 불러오기');
  await pump(1); await until('window.__LOADMS != null', 5000, boardName(spec) + ' 첫 프레임');
  if (!UI) await evaluate(`const s = document.createElement('style'); s.id = '__shotsHide'; s.textContent = ${JSON.stringify(HIDE)}; document.head.appendChild(s); return 1`);
  /* 안내·판 카드·제목 카드는 늦게 뜰 수 있다 — 실제 시간 1.5초 조용할 때까지 닫는다(프레임은 안 돌린다: 가짜 시계가 늘 같은 자리에 있게) */
  await evaluate(`const sl = ms => new Promise(r => setTimeout(r, ms)); let quiet = 0;
    for (let k = 0; k < 60 && quiet < 6; k++) { const bs = [...document.querySelectorAll('button')].filter(b => ['시작', '건너뛰기', '닫기'].includes(b.textContent.trim()) && b.offsetParent);
      bs.forEach(b => b.click()); const g = document.getElementById('guide'); quiet = bs.length || (g && g.className.includes('show')) ? 0 : quiet + 1; await sl(250); } return 1`);
  await evaluate(`window.__gfxMode(${JSON.stringify(GFX)}); window.__setSpeed(0); window.__setHour(${HOUR}); return 1`);
  await pump(FRAMES); await netIdle(); await pump(FRAMES);                                     // 모형·그림이 다 오고 색이 선 뒤
  const meta = await evaluate('const c = document.getElementById("cv"), g = c && (c.getContext("webgl2") || c.getContext("webgl")), e = g && g.getExtension("WEBGL_debug_renderer_info"); return { gl: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, sim: window.__sim() }');
  const out = [];
  for (const shot of SHOTS) {
    if (shot === 'near') await evaluate('const v = window.__view(); window.__view(v.zoomMul * 1.8); return 1');
    else if (shot === 'whole') await evaluate('document.getElementById("fitBtn").onclick(); return 1');
    await evaluate('window.__setSpeed(0); return 1');                                             // 카드가 닫히며 멈춤을 풀었을 수 있다
    await pump(FRAMES); await netIdle(3000); await pump(2);
    await evaluate('await window.__shots.real(); return 1');                                    // 가짜 프레임이 실제 화면에 붙게(진짜 프레임 둘)
    const png = Buffer.from((await send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
    const file = path.join(outDir, fname(spec, shot)); fs.writeFileSync(file, png);
    const rec = { shot, file, sha: crypto.createHash('sha1').update(png).digest('hex').slice(0, 12) };
    if (onShot) rec.견줌 = await onShot(spec, shot, file);
    out.push(rec);
  }
  const errs = await evaluate('return window.__shots.errs.slice(0, 3)');
  return { 판: boardName(spec), spec, 렌더러: meta.gl, 시뮬: meta.sim, 장면: out, 오류: pageErr.length + errs.length, 오류예: [...pageErr.slice(0, 2), ...errs.slice(0, 2)] };
}

/* 두 장 견주기 — 이 브라우저 안에서(PNG 풀기 · 칸 짚기 · 차이 그림). 칸은 지금 페이지의 카메라(= 방금 찍은 장면)에서 __screenCell 로 짚는다(3칸마다 한 점 · ×9) */
async function compare(fileA, fileB, diffFile) {
  const a = fs.readFileSync(fileA).toString('base64'), b = fs.readFileSync(fileB).toString('base64');
  const r = await evaluate(`const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }; };
    const A = await load(${JSON.stringify(a)}), B = await load(${JSON.stringify(b)});
    if (A.w !== B.w || A.h !== B.h) return { 크기다름: [A.w, A.h, B.w, B.h] };
    const W = A.w, H = A.h, T = ${TOL}, dc = document.createElement('canvas'); dc.width = W; dc.height = H; const dg = dc.getContext('2d'), out = dg.createImageData(W, H), o = out.data;
    const mapOK = typeof window.__screenCell === 'function', cells = new Map(); let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, outside = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4;
      const d = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
      if (d > T) { n++; o[i] = 235; o[i + 1] = 40; o[i + 2] = 60; o[i + 3] = 255; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        if (mapOK && x % 3 === 0 && y % 3 === 0) { const c = window.__screenCell(x, y); if (!c) outside++; else { const k = c[0] + ',' + c[1]; cells.set(k, (cells.get(k) || 0) + 1); } } }
      else { const gr = (B.d[i] * .3 + B.d[i + 1] * .59 + B.d[i + 2] * .11) * .45 + 120; o[i] = o[i + 1] = o[i + 2] = gr; o[i + 3] = 255; } }
    if (n) dg.putImageData(out, 0, 0);
    const top = [...cells.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6).map(([k, v]) => { const [x, y] = k.split(',').map(Number);
      const t = window.__terrain ? window.__terrain(x, y) : null, s = window.__stream ? window.__stream(x, y) : null;
      return { 칸: [x, y], 점: v * 9, 바닥: t && t.켜짐 ? t.바닥 : null, 물건: s && s.칸 ? s.칸.종류 : null }; });
    return { 차이점: n, 전체: W * H, 네모: n ? [x0, y0, x1, y1] : null, 칸: top, 칸수: cells.size, 판밖점: outside * 9, 칸짚음: mapOK, 그림: n ? dc.toDataURL('image/png').split(',')[1] : null };`, 120000);
  if (r.그림) fs.writeFileSync(diffFile, Buffer.from(r.그림, 'base64')); delete r.그림; if (r.차이점) r.차이그림 = diffFile; return r;
}

/* ── 돌리기 ── */
let renderer = null;
async function runAll(rootDir, outDir, label, onShot) {
  SERVE = rootDir; fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const b of BOARDS) { process.stderr.write(`  [${label}] ${boardName(b)} … `); const t0 = Date.now();
    try { const r = await shootBoard(b, outDir, onShot); rows.push(r); renderer = renderer || r.렌더러; process.stderr.write(((Date.now() - t0) / 1000).toFixed(1) + '초' + (r.오류 ? ' · 페이지 오류 ' + r.오류 : '') + '\n'); }
    catch (e) { rows.push({ 판: boardName(b), spec: b, 실패: String(e.message || e).slice(0, 200), 장면: [] }); process.stderr.write('실패 — ' + String(e.message || e).slice(0, 120) + '\n'); } }
  return rows;
}
const pct = (n, all) => all ? Math.round(n / all * 1e6) / 1e4 : 0;   // 소수 넷째 자리 %
let code = 0, report = null;
try {
  let list; for (let k = 0; k < 60; k++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
  if (!list) throw new Error('크로미움에 못 붙음');
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
    if (m.method === 'Fetch.requestPaused') { const u = m.params.request.url;                  /* 바깥 주소는 전부 막는다 — 이 서버와 data:/blob: 만 */
      if (u.startsWith(BASE + '/') || u.startsWith('data:') || u.startsWith('blob:')) send('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {});
      else { blocked++; send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {}); } }
    else if (m.method === 'Network.requestWillBeSent') { inflight.add(m.params.requestId); lastNet = Date.now(); }
    else if (m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') { inflight.delete(m.params.requestId); lastNet = Date.now(); }
    else if (m.method === 'Runtime.exceptionThrown') pageErr.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0].slice(0, 160)); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: VIEW.w, height: VIEW.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });

  const head = git('rev-parse', '--short', 'HEAD'), dirty = !!git('status', '--porcelain', '--', 'village'), nowLabel = '작업 트리 ' + head + (dirty ? ' + 고친 것' : '');
  const cond = { 판: BOARDS, 장면: SHOTS, 시각: HOUR, 그래픽: GFX, lookseed: LOOKSEED, 프레임: FRAMES, 화면: VIEW, UI };
  if (UPDATE) {
    const rows = await runAll(REF ? refRoot(REF) : ROOT, BASEDIR, '기준');
    const label = REF ? 'ref ' + REF + ' (' + git('rev-parse', '--short', REF) + ')' : nowLabel;
    fs.writeFileSync(path.join(BASEDIR, 'meta.json'), JSON.stringify({ 찍은때: new Date().toISOString(), 코드: label, 렌더러: renderer, 조건: cond, 판: rows.map(r => ({ 판: r.판, 실패: r.실패 || null, 오류: r.오류 || 0, 장면: r.장면.map(s => [s.shot, s.sha]) })) }, null, 1));
    const badRows = rows.filter(r => r.실패 || r.오류);
    console.log(`기준 사진 ${rows.reduce((a, r) => a + r.장면.length, 0)}장 — ${path.relative(ROOT, BASEDIR)} · ${label} · 렌더러 ${renderer} · 바깥 주소 막음 ${blocked}`);
    badRows.forEach(r => console.log(`  ⚠ ${r.판}: ${r.실패 || '페이지 오류 ' + r.오류 + ' — ' + (r.오류예 || []).join(' / ')}`));
    code = badRows.length ? 1 : 0; report = { 기준: label, 렌더러: renderer, 판: rows };
  } else {
    let baseDir = BASEDIR, baseLabel, baseGL;
    if (VSREF) { const dir = path.join(DIR, 'ref'); await runAll(refRoot(VSREF), dir, VSREF); baseDir = dir; baseLabel = VSREF + ' (' + git('rev-parse', '--short', VSREF) + ') · 방금 찍음'; baseGL = renderer; }
    else { const mf = path.join(BASEDIR, 'meta.json'); if (!fs.existsSync(mf)) { console.error('기준 사진이 없다 — 먼저 --update (또는 --update --ref origin/main) · 아니면 --vs-ref origin/main'); throw Object.assign(new Error('기준 없음'), { quiet: true }); }
      const m = JSON.parse(fs.readFileSync(mf, 'utf8')); baseLabel = m.코드 + ' · ' + String(m.찍은때).slice(0, 16).replace('T', ' '); baseGL = m.렌더러;
      const c0 = JSON.stringify({ ...m.조건, 판: undefined, 장면: undefined }), c1 = JSON.stringify({ ...cond, 판: undefined, 장면: undefined });
      if (c0 !== c1) console.error('⚠ 기준과 찍는 조건이 다르다 — 기준 ' + c0 + ' · 지금 ' + c1); }
    fs.rmSync(DIFFDIR, { recursive: true, force: true }); fs.mkdirSync(DIFFDIR, { recursive: true });
    const onShot = async (spec, shot, file) => { const bf = path.join(baseDir, fname(spec, shot)); if (!fs.existsSync(bf)) return { 기준없음: true };
      return compare(bf, file, path.join(DIFFDIR, fname(spec, shot))); };
    const rows = await runAll(ROOT, NOWDIR, '지금', onShot);
    if (baseGL && renderer && baseGL !== renderer) { console.error(`그리는 방식이 기준과 다르다 — 기준 ${baseGL} · 지금 ${renderer}. 같은 방식끼리만 견준다(기준을 다시 찍을 것).`); code = 2; }
    /* 표 */
    const L = [`화면 회귀 — 판 ${BOARDS.length} × 장면 ${SHOTS.length} · 기준 ${baseLabel} · 지금 ${nowLabel} · 렌더러 ${renderer} · ${HOUR}시 · 그래픽 ${GFX} · lookseed ${LOOKSEED} · ${VIEW.w}×${VIEW.h}${UI ? ' · UI 포함' : ' · UI 숨김(3D·미니맵)'} · 허용 ${MAX}% (한 점 = 채널 차 > ${TOL}) · 바깥 주소 막음 ${blocked}`, '',
      '| 판 | 장면 | 차이 % | 차이 점 | 차이 네모(화면) | 가장 많이 다른 칸 |', '|---|---|---|---|---|---|'];
    let over = 0, missing = 0;
    for (const r of rows) {
      if (r.실패) { L.push(`| ${r.판} | — | 실패 | — | — | ${r.실패} |`); over++; continue; }
      for (const s of r.장면) { const c = s.견줌 || {};
        if (c.기준없음) { L.push(`| ${r.판} | ${s.shot} | 기준 없음 | — | — | --update 로 찍을 것 |`); missing++; continue; }
        if (c.크기다름) { L.push(`| ${r.판} | ${s.shot} | 크기 다름 | — | — | ${c.크기다름.join('×')} |`); over++; continue; }
        const p = pct(c.차이점, c.전체); if (p > MAX) over++;
        const cells = !c.차이점 ? '—' : !c.칸짚음 ? '(칸 짚기 훅 없음)' : (c.칸.map(k => `(${k.칸.join(',')})${k.바닥 ? ' ' + k.바닥 : ''}${k.물건 ? '·' + k.물건 : ''} ${k.점}`).join(' · ') + (c.판밖점 ? ` · 판 밖 ${c.판밖점}` : '') + (c.칸수 > c.칸.length ? ` (칸 ${c.칸수}곳)` : ''));
        L.push(`| ${r.판} | ${s.shot} | ${p > MAX ? '**' + p + '**' : p} | ${c.차이점} | ${c.네모 ? c.네모.join(',') : '—'} | ${cells} |`); }
      if (r.오류) L.push(`|  | ⚠ 페이지 오류 ${r.오류} | | | | ${(r.오류예 || []).join(' / ')} |`);
    }
    const nDiff = rows.reduce((a, r) => a + r.장면.filter(s => s.견줌 && s.견줌.차이점).length, 0);
    L.push('', `판정: ${over ? 'FAIL — 허용을 넘은 장면 ' + over : missing ? 'REVIEW — 기준 없는 장면 ' + missing : 'PASS — 모든 장면이 기준과 ' + (MAX ? MAX + '% 안' : '같음')}` + (nDiff ? ` · 차이 그림 ${nDiff}장: ${path.relative(ROOT, DIFFDIR)}/` : ''));
    console.log(L.join('\n'));
    if (!code) code = over ? 1 : 0; report = { 기준: baseLabel, 지금: nowLabel, 렌더러: renderer, 판: rows };
  }
} catch (e) { if (!e.quiet) console.error('멈춤: ' + (e.message || e)); code = 2; }
finally { try { ws && ws.close(); } catch {} ch.kill('SIGKILL'); server.close(); await sleep(400); if (!flag('keep')) for (const d of temps) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} } }
if (JSON_OUT && report) fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify(report, null, 1));
process.exit(code);
