// 헤드리스 크롬 + CDP 도우미 [GATE-1] — 넣기 전 확인 장치(gate.mjs)가 쓴다. 바깥 패키지 없음(node 22+ 의 WebSocket · fetch).
//  · 크롬은 늘 헤드리스(chrome-headless-shell) — 창을 띄우지 않는다. 그림은 GPU(맥 = ANGLE Metal · CPU 로 그리면 발열 — 09-24).
//  · 운영 주소는 크롬 안에서 두 겹으로 막는다: --host-resolver-rules(이름 풀기 실패) · Network.setBlockedURLs(요청 막음).
//    가짜 RTDB 서버의 shim 이 세 번째 겹(운영 RTDB 주소 → 가짜 서버). 막힌 시도도 gate.mjs 가 FAIL 로 센다.
//  · 디버깅 포트가 '내가 띄운 크롬'인지 확인한다(SystemInfo.getProcessInfo 의 browser pid = 내가 띄운 pid).
//    다른 세션의 크롬이 같은 포트를 잡고 있으면 그 크롬을 시험하게 된다 — 옛 확인 장치가 그렇게 엉뚱한 앱을 봤다.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
//  운영 Firebase 주소(+ 다른 운영 앱 주소: 영어앱 등 *.firebaseapp.com · *.web.app) — 요청 하나라도 나가려 하면 FAIL
export const PROD_RE = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|\.firebaseapp\.com|\.web\.app(?=[/:?#]|$)/i;
export const BLOCK_URLS = ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*',
  '*identitytoolkit.googleapis.com*', '*securetoken.googleapis.com*', '*.firebaseapp.com*', '*.web.app/*'];
const HOST_RULES = ['*.firebaseio.com', '*.firebasedatabase.app', 'firestore.googleapis.com', 'firebasestorage.googleapis.com',
  'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', '*.firebaseapp.com', '*.web.app'].map(h => `MAP ${h} ~NOTFOUND`).join(', ');

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

//  바깥 라이브러리 · 글꼴(CDN) 저장해 두기 — 브라우저 문맥마다 Blockly(약 1MB) · 글꼴을 새로 받느라 학습 앱 창이 10초 넘게
//   'loading' 에 머물렀다. 처음 한 번 받아 디스크에 두고, 다음부터는 Fetch.fulfillRequest 로 바로 준다(주소에 판 번호가 박힌 것들).
//   저장소 밖(~/Library/Caches/class-rpg-gate/cdn) · GATE_CACHE=<폴더> 로 바꿈 · --no-cdn-cache 로 끔(그때는 진짜 CDN).
//   운영 Firebase 주소는 여기 오지 않는다(PROD 는 크롬에서 막힘 — 이 목록은 SDK 파일 · Blockly · 글꼴 같은 정적 파일 호스트뿐).
export const CDN_HOSTS = ['www.gstatic.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'unpkg.com'];
export const CDN_PATTERNS = CDN_HOSTS.map(h => ({ urlPattern: `https://${h}/*`, requestStage: 'Request' }));
export class CdnCache {
  constructor(dir) { this.dir = dir; this.mem = new Map(); this.flight = new Map(); this.stat = { hit: 0, miss: 0, fail: 0 }; try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {} }
  file(url) { return path.join(this.dir, crypto.createHash('sha1').update(url).digest('hex')); }
  load(url) {
    if (this.mem.has(url)) return this.mem.get(url);
    try {
      const f = this.file(url);
      const meta = JSON.parse(fs.readFileSync(f + '.json', 'utf8'));
      const rec = { status: meta.status, headers: meta.headers, body: fs.readFileSync(f + '.bin') };
      this.mem.set(url, rec);
      return rec;
    } catch (e) { return null; }
  }
  //  없으면 node 로 받아(크롬이 보낸 User-Agent 그대로 — 구글 글꼴 CSS 는 UA 따라 다름) 저장. 받는 중이면 그것을 기다린다
  async get(url, reqHeaders = {}) {
    const have = this.load(url);
    if (have) { this.stat.hit++; return have; }
    if (this.flight.has(url)) return this.flight.get(url);
    const job = (async () => {
      const h = {};
      for (const [k, v] of Object.entries(reqHeaders)) if (/^(user-agent|accept|accept-language|origin|referer)$/i.test(k)) h[k] = v;
      const r = await fetch(url, { headers: h, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      const body = Buffer.from(await r.arrayBuffer());
      const headers = [...r.headers].filter(([k]) => !/^(content-encoding|content-length|transfer-encoding|connection|keep-alive|set-cookie|alt-svc|report-to|nel)$/i.test(k)).map(([name, value]) => ({ name, value }));
      const rec = { status: r.status, headers, body };
      if (r.status === 200) {
        try { const f = this.file(url); fs.writeFileSync(f + '.bin', body); fs.writeFileSync(f + '.json', JSON.stringify({ url, status: r.status, headers, at: new Date().toISOString() })); } catch (e) {}
        this.mem.set(url, rec);
      }
      this.stat.miss++;
      return rec;
    })();
    this.flight.set(url, job);
    try { return await job; } catch (e) { this.stat.fail++; throw e; } finally { this.flight.delete(url); }
  }
}

//  크롬을 띄우고 CDP 에 붙는다. onEvent(sessionId|null, method, params) 로 모든 이벤트를 넘긴다.
export async function openBrowser({ chrome = DEFAULT_CHROME, port, onEvent, gpu = true }) {
  if (!fs.existsSync(chrome)) throw new Error(`헤드리스 크롬이 없어요: ${chrome} (CHROME=<경로> 로 바꿀 수 있음)`);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-chrome-'));
  const gpuArgs = !gpu ? ['--disable-gpu'] : process.platform === 'darwin' ? ['--use-angle=metal', '--use-gl=angle'] : [];
  const proc = spawn(chrome, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${prof}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-extensions', '--disable-sync',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required', `--host-resolver-rules=${HOST_RULES}`, ...gpuArgs, 'about:blank'], { stdio: 'ignore' });
  let dead = false;
  proc.on('exit', () => { dead = true; });
  const kill = () => { try { proc.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} };

  let ver = null;
  for (let i = 0; i < 100 && !dead; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch (e) {}
    await sleep(100);
  }
  if (!ver) { kill(); throw new Error(`크롬 디버깅 포트 ${port} 에 붙지 못했어요${dead ? '(크롬이 바로 꺼짐)' : ''}`); }

  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP 연결 실패')); });
  let seq = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch (er) { return; }
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id); clearTimeout(p.t);
      if (m.error) p.rej(new Error(`${p.method}: ${m.error.message || JSON.stringify(m.error)}`)); else p.res(m.result || {});
      return;
    }
    if (m.method) { try { onEvent(m.sessionId || null, m.method, m.params || {}); } catch (er) { console.log('[GATE-1] 이벤트 처리 오류', er && er.stack); } }
  };
  ws.onclose = () => { for (const p of pend.values()) { clearTimeout(p.t); p.rej(new Error('CDP 연결이 끊김')); } pend.clear(); };
  //  모든 CDP 호출에 시간 제한 — 페이지가 멈춰도(무한 루프 등) 확인 장치가 같이 멈추지 않게
  const send = (method, params = {}, sessionId, ms = 15000) => new Promise((res, rej) => {
    if (ws.readyState !== 1) { rej(new Error('CDP 연결이 닫힘')); return; }
    const id = ++seq;
    const t = setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error(`${method}: ${ms}ms 안에 답이 없음`)); } }, ms);
    pend.set(id, { res, rej, t, method });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  //  이 포트의 크롬 = 내가 띄운 크롬?
  let pidOk = null;
  try {
    const info = await send('SystemInfo.getProcessInfo');
    const b = (info.processInfo || []).find(p => p.type === 'browser');
    pidOk = !!b && b.id === proc.pid;
  } catch (e) { pidOk = null; }
  if (pidOk === false) { try { ws.close(); } catch (e) {} kill(); throw new Error(`디버깅 포트 ${port} 의 크롬이 내가 띄운 것이 아니에요(다른 세션의 크롬?) — DP 를 바꿔 주세요`); }

  return {
    send, proc, version: ver.Browser, pidChecked: pidOk === true,
    close: async () => { try { await send('Browser.close', {}, undefined, 3000); } catch (e) {} try { ws.close(); } catch (e) {} kill(); },
  };
}

//  탭 하나(브라우저 문맥 따로 = 저장소 · 쿠키 따로). 이벤트는 gate.mjs 가 sessionId 로 이 탭에 묶는다.
export class Page {
  constructor(b, name) { this.b = b; this.name = name; this.action = '시작'; this.sessionId = null; this.targetId = null; this.ctx = null; }
  send(method, params, ms) { return this.b.send(method, params, this.sessionId, ms); }
  //  ① 새 문맥 + 빈 탭 + 붙기(세션 id 를 먼저 돌려줘 gate.mjs 가 이벤트를 이 탭에 묶은 뒤 ② setup)
  async attach() {
    const { browserContextId } = await this.b.send('Target.createBrowserContext', {});
    this.ctx = browserContextId;
    const { targetId } = await this.b.send('Target.createTarget', { url: 'about:blank', browserContextId });
    this.targetId = targetId;
    const { sessionId } = await this.b.send('Target.attachToTarget', { targetId, flatten: true });
    this.sessionId = sessionId;
    return sessionId;
  }
  async setup({ width = 1366, height = 610, mobile = false, scale = 1, touch = false, init = '', cdn = false } = {}) {
    await Promise.all([this.send('Runtime.enable'), this.send('Page.enable'), this.send('Network.enable'), this.send('Log.enable')]);
    await this.send('Network.setBlockedURLs', { urls: BLOCK_URLS });
    if (cdn) await this.send('Fetch.enable', { patterns: CDN_PATTERNS });   // CDN 파일은 gate.mjs 가 CdnCache 로 준다(Fetch.requestPaused)
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
    if (touch) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });   // 여러 탭을 함께 돌려도 '포커스 있음'으로
    //  다른 출처 iframe · 워커도 붙여 예외를 받는다(같은 출처 iframe 은 이 세션으로 그대로 들어온다)
    await this.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    if (init) await this.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  }
  //  식 하나를 페이지에서 — 값(JSON)으로 돌려준다. 확인 장치 쪽 식의 오류는 앱 예외로 세지 않는다(evaluate 결과로만 옴).
  async ev(expr, ms = 10000) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }, ms);
    if (r.exceptionDetails) throw new Error('evaluate: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || '').split('\n')[0]);
    return r.result ? r.result.value : undefined;
  }
  async evSafe(expr, ms) { try { return await this.ev(expr, ms); } catch (e) { return undefined; } }
  async until(expr, ms = 10000, every = 120) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await this.evSafe(expr, Math.max(1000, ms)) === true) return true;
      await sleep(every);
    }
    return false;
  }
  async goto(url, ms = 20000) {
    const r = await this.send('Page.navigate', { url }, ms);
    if (r.errorText) throw new Error(`불러오기 실패 ${r.errorText} — ${url}`);
    return this.until(`document.readyState === 'complete' && location.href !== 'about:blank'`, ms);
  }
  //  진짜 마우스 누르기(움직임 → 누름 → 뗌)
  async click(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }
  async key(key = 'Escape') {
    const code = { Escape: 27, Enter: 13 }[key] || 0;
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
  }
  async close() {
    try { await this.b.send('Target.closeTarget', { targetId: this.targetId }, undefined, 5000); } catch (e) {}
    try { if (this.ctx) await this.b.send('Target.disposeBrowserContext', { browserContextId: this.ctx }, undefined, 5000); } catch (e) {}
  }
}
