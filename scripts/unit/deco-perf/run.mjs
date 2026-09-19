#!/usr/bin/env node
// 마당 꾸미기 성능 재기(DECO-PERF-METER-1) — 모든 PR 이 같은 잣대로 전/후를 적게.
//  실제 student.html 을 놀이판(없는 프로젝트 + goOffline · 운영 통신 0)으로 띄우고, 헤드리스 크롬을 CDP 로 몬다.
//  크롬북 가정: 1366×610 · CPU 감속(기본 4배 — `Emulation.setCPUThrottlingRate`).
//  재는 것: ①로그인 화면이 뜰 때까지 ②홈이 뜰 때까지 ③꾸미기 열어 첫 그림까지 · 그동안 요청 수·바이트
//           ④장식 200개 + 바닥 절반 칠한 마당에서 끌기·핀치 한 프레임(그리기 함수 동기 비용, 중앙값)
//           ⑤학생 문서 크기(장식 0/100/300개) ⑥자체 JS·CSS 바이트 ⑦꾸미기 20번 열고 닫은 뒤 동물 타이머·층 수
//  사용: node scripts/unit/deco-perf/run.mjs [--cpu 4] [--runs 3] [--json]
//        전/후 비교: REPO=<다른 판을 푼 폴더> node scripts/unit/deco-perf/run.mjs   (ABAB 로 번갈아 두 번씩 돌릴 것 — 기기 상태에 흔들린다)
//  의존성 0(노드 22+ 내장 WebSocket·fetch). 브라우저: BROWSER 환경변수 > 맥 크롬 > 윈도 엣지.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || path.resolve(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const CPU = Number(opt('--cpu', 4)), RUNS = Number(opt('--runs', 3)), AS_JSON = argv.includes('--json');
const BROWSER = process.env.BROWSER || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
if (!fs.existsSync(BROWSER)) { console.log(`요약: SKIP · 브라우저 없음(${BROWSER})`); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const r1 = x => x == null ? null : Math.round(x * 10) / 10;

//  페이지가 뜨기 전에 심는 시계 — 로그인 화면(로딩 막이 걷힘)·홈(메뉴가 그려짐) 시각을 적는다
const CLOCK = `(() => { const P = window.__perf = {}; const t = setInterval(() => {
  const ld = document.getElementById('loading-screen');
  if (P.login === undefined && ld && ld.style.display === 'none') P.login = performance.now();
  if (P.home === undefined && typeof CUR !== 'undefined' && CUR && document.querySelector('[onclick*="openHouseTab"]')) { P.home = performance.now(); clearInterval(t); }
}, 8); })();`;

async function once(playPort) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'deco_perf_'));
  const dbg = await freePort();
  const chrome = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--window-size=1366,610', 'about:blank'], { stdio: 'ignore' });
  try {
    let targets; for (let i = 0; i < 60; i++) { await sleep(150); try { targets = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json(); if (targets.length) break; } catch (e) {} }
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const net0 = { n: 0, bytes: 0, urls: [] };
    ws.addEventListener('message', m => { const d = JSON.parse(m.data);
      if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
      if (d.method === 'Network.requestWillBeSent') { net0.n++; net0.urls.push(d.params.request.url); }
      if (d.method === 'Network.loadingFinished') net0.bytes += d.params.encodedDataLength || 0; });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 610, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    await send('Page.navigate', { url: `http://127.0.0.1:${playPort}/student.html` });
    for (let i = 0; i < 400; i++) { await sleep(100); if (await ev(`!!(window.__perf && __perf.home)`)) break; }
    const out = {};
    const P = JSON.parse(await ev(`JSON.stringify(__perf)`));
    out['로그인화면_ms'] = r1(P.login); out['홈_ms'] = r1(P.home);
    out['홈까지_요청수'] = net0.n; out['홈까지_KB'] = Math.round(net0.bytes / 1024);
    await sleep(1200);
    //  ③ 꾸미기 열어 첫 그림까지(판 한가운데 픽셀이 칠해질 때) + 그동안 요청 수·바이트
    const n1 = net0.n, b1 = net0.bytes;
    out['꾸미기_첫그림_ms'] = r1(await ev(`(async () => { const t0 = performance.now(); openHouseTab('deco'); openInteriorFullscreen();
      for (let i = 0; i < 2000; i++) { await new Promise(r => setTimeout(r, 8)); const cv = document.querySelector('#if-topview canvas');
        if (cv && cv.width > 0) { const d = cv.getContext('2d').getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data; if (d[3] > 0) return performance.now() - t0; } } return null; })()`));
    await sleep(2500);
    out['꾸미기열때_요청수'] = net0.n - n1; out['꾸미기열때_KB'] = Math.round((net0.bytes - b1) / 1024);
    out['꾸미기열때_그림요청수'] = net0.urls.slice(n1).filter(u => /\/assets\//.test(u)).length;
    //  ④ 무거운 마당: 장식 200 + 바닥 절반. 그리기 함수의 동기 비용(중앙값) — 끌기 = 한 칸씩 옮기며, 핀치 = 2% 씩 키우며
    const heavy = JSON.parse(await ev(`(async () => {
      const ids = GAME_DATA.decorations.filter(d => d.cat === 'yard' && !d.hidden && !(d.size && (d.size.w > 1 || d.size.h > 1)) && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[d.id])).map(d => d.id);
      const list = []; let k = 0;
      for (let r = 6; r < 44 && list.length < 200; r += 2) for (let c = 1; c < 80 && list.length < 200; c += 2) { if (_isHC(r, c) || _isFarmCell(r, c)) continue; list.push({ id: ids[k++ % ids.length], area: 'yard', row: r, col: c }); }
      CUR.houseDecorations = list; const f = {}; const tiles = ['stone', 'water', 'sand', 'brick', 'dirt', 'flower'];
      for (let r = 0; r < 44; r++) for (let c = 0; c < 80; c++) if ((r + c) % 2 === 0 && !_isHC(r, c)) f[r + '_' + c] = tiles[(r * 7 + c * 3) % tiles.length];
      CUR.yardFloor = f; _decoSetZoom(1); _dPanX = 0; _dPanY = 0; _decoClampPan();
      const draw = () => { _dCtx.setTransform(2, 0, 0, 2, 0, 0); _dCtx.clearRect(0, 0, _dW, _dH); _dCtx.setTransform(2, 0, 0, 2, -_dPanX * 2, -_dPanY * 2); const t = performance.now(); _drawYard(); return performance.now() - t; };
      for (let i = 0; i < 40; i++) { draw(); await new Promise(r => setTimeout(r, 60)); }   // 그림이 다 올 때까지 데우기
      const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
      const dragC = []; for (let i = 0; i < 40; i++) { _dPanX += _dC; _decoClampPan(); dragC.push(draw()); }
      const pinch = []; for (let i = 0; i < 30; i++) { _dZoom = Math.min(3, _dZoom * 1.02); _initDeco(); pinch.push(draw()); }
      _dZoom = 0.625; _initDeco(); _dPanX = 0; _dPanY = 0; const whole = []; for (let i = 0; i < 10; i++) whole.push(draw());
      return JSON.stringify({ n: list.length, floor: Object.keys(f).length, drag: med(dragC), pinch: med(pinch), whole: med(whole) }); })()`));
    out['무거운마당_장식수'] = heavy.n; out['무거운마당_칠한칸'] = heavy.floor;
    out['끌기_한프레임_ms'] = r1(heavy.drag); out['핀치_한걸음_ms'] = r1(heavy.pinch); out['전체보기_한프레임_ms'] = r1(heavy.whole);
    //  ⑤ 학생 문서 크기 — 통째 저장이라 조작마다 이만큼 나간다(0.4초 묶음)
    const doc = JSON.parse(await ev(`(() => { const base = JSON.parse(JSON.stringify(CUR)); const mk = n => { base.houseDecorations = Array.from({ length: n }, (_, i) => ({ id: 'd_y' + (1 + i % 48), area: 'yard', row: 5 + (i % 38), col: i % 79 })); base.yardFloor = {}; return JSON.stringify(base).length; }; return JSON.stringify({ d0: mk(0), d100: mk(100), d300: mk(300) }); })()`));
    out['문서B_장식0'] = doc.d0; out['문서B_장식100'] = doc.d100; out['문서B_장식300'] = doc.d300; out['장식1개당_B'] = r1((doc.d300 - doc.d0) / 300);
    //  ⑦ 열고 닫기 20번 — 타이머·동물 층이 쌓이지 않나
    const leak = JSON.parse(await ev(`(async () => { CUR.houseDecorations = [{ id: 'd_y53', area: 'yard', row: 8, col: 5 }, { id: 'd_y55', area: 'yard', row: 9, col: 9 }];
      for (let i = 0; i < 20; i++) { closeInteriorFullscreen(); await new Promise(r => setTimeout(r, 30)); openInteriorFullscreen(); await new Promise(r => setTimeout(r, 120)); }
      await new Promise(r => setTimeout(r, 400));
      let timers = 0; _animLayers.forEach(rec => rec.items.forEach(st => { if (st.timer) timers++; }));
      return JSON.stringify({ layers: _animLayers.size, animEls: document.querySelectorAll('.deco-anim').length, timers, canvases: document.querySelectorAll('#if-topview canvas').length }); })()`));
    out['20번열닫_동물층'] = leak.layers; out['20번열닫_동물요소'] = leak.animEls; out['20번열닫_걷기타이머'] = leak.timers; out['20번열닫_캔버스'] = leak.canvases;
    try { ws.close(); } catch (e) {}
    return out;
  } finally { try { chrome.kill('SIGKILL'); } catch (e) {} await sleep(200); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
}

const playPort = await freePort();
const play = spawn(process.execPath, [path.join(HERE, '..', 'deco-save-count', 'play.mjs'), String(playPort)], { env: { ...process.env, REPO }, stdio: 'ignore' });
await sleep(600);
const all = [];
try { for (let i = 0; i < RUNS; i++) all.push(await once(playPort)); } finally { play.kill(); }
//  ⑥ 자체 파일 바이트(디스크 · gzip 아님)
const sizeKB = f => fs.existsSync(path.join(REPO, f)) ? Math.round(fs.statSync(path.join(REPO, f)).size / 1024) : null;
const files = ['student.js', 'student.css', 'student.html', 'gamedata.js', 'curriculum.js', 'curriculum_review.js', 'curriculum_reading.js', 'figures.js'];
const result = { 'CPU감속': CPU, '횟수': RUNS };
for (const k of Object.keys(all[0])) result[k] = median(all.map(o => o[k]).filter(v => v != null));
for (const f of files) result['파일KB_' + f] = sizeKB(f);
if (AS_JSON) console.log(JSON.stringify(result, null, 1));
else { for (const [k, v] of Object.entries(result)) console.log(k + '=' + v); console.log('끝=1'); }
