// 음악실 오케스트라 실제 화면 확인 [MUSIC-ORCH-1] — 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 · 실제 소리 장치 시각
//  ① 악기 소리(OfflineAudioContext) — 오케스트라 악기 16 · 북 4: 숫자가 유한 · 꼭대기 < 1 · 들림(RMS) · 끝나면 잦아듦 / 편성 여섯 전체 소리 꼭대기 < 1
//  ② 작곡(학생 ?sid=s1): 칸을 실제로 눌러 가락 → 🎻 오케스트라 켜기 → 편성 카드 여섯 · ▶ 들어 보기 · 칸 칩 · 셈여림 · 점점 느리게 · 악기 소개(▶ 소리 · 가족 칸)
//     → 저장 → 서버 songs/s1/<곡>.orch → 다시 열기(켜짐 · 편성 그대로) → 첫 화면 '내 곡' 듣기 → 연습(반주 켬/끔) → 리듬 → 좁은 화면(390)에서도 오케스트라 칸 누름
//  + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8901 DP=9581 node scripts/unit/music/orchestra-live.mjs   (스크린샷 OUT=<폴더> · 가짜 서버 FAKE_RTDB=<…/server.mjs>) — 안에서 150초면 스스로 끝낸다
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8901), DP = Number(process.env.DP || 9581);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 400) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const V = (fs.readFileSync(path.join(ROOT, 'music/index.html'), 'utf8').match(/"\.\/js\/audio\.js\?v=([^"]+)"/) || [])[1] || '1';

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE + ' (FAKE_RTDB=<경로>)'); process.exit(0); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-live-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과(150초)'); await cleanup(); process.exit(2); }, 150000);
const db = (p) => srv.store.get(p);

const net = { all: [], prod: [] };
const errs = {};
let ws, send, sessName = {};
async function cdp() {
  let ver; for (let i = 0; i < 80; i++) { try { ver = await (await fetch(`http://127.0.0.1:${DP}/json/version`)).json(); break; } catch (e) {} await sleep(150); }
  ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    const who = sessName[m.sessionId] || '?';
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; net.all.push(who + ' ' + u); if (PROD.test(u)) net.prod.push(who + ' ' + u); }
    if (m.method === 'Network.webSocketCreated') { const u = m.params.url; if (PROD.test(u)) net.prod.push(who + ' WS ' + u); }
    if (m.method === 'Runtime.exceptionThrown') (errs[who] = errs[who] || []).push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').split('\n').slice(0, 2).join(' ').slice(0, 240));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { const t = m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 240); if (!/FIREBASE WARNING|favicon|Failed to load resource/.test(t)) (errs[who] = errs[who] || []).push('console.error ' + t); }
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true, promptText: 'x' }, m.sessionId);   // 선생님 비밀번호(가짜 서버 seed = x) · 지우기 확인
  };
}
async function device(name, url, { w = 1366, h = 610 } = {}) {
  const { browserContextId } = await send('Target.createBrowserContext', {});
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  sessName[sessionId] = name;
  for (const [mth, p] of [['Runtime.enable'], ['Page.enable'], ['Network.enable'], ['DOM.enable'],
    ['Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*'] }],
    ['Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }]]) await send(mth, p || {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PP}${url}` }, sessionId);
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
  const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
  const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); };
  //  요소 찾는 식 → 가운데를 실제 마우스로 누름(덮여 있으면 'covered' · 꺼져 있으면 'disabled')
  const pressEl = async (find) => {
    const r = await ev(`(() => { const e = (${find}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)), dis: !!e.disabled }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (r.dis) return 'disabled';
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  //  파일 고르기 창 대신 — 숨은 <input type=file> 에 파일을 바로 넣는다(사람이 고른 것과 같은 change 사건)
  const setFiles = async (sel, files) => {
    const r = await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(sel)})` }, sessionId);
    if (!r.result || !r.result.objectId) return false;
    await send('DOM.setFileInputFiles', { files, objectId: r.result.objectId }, sessionId); return true;
  };
  return { name, ev, shot, click, pressEl, setFiles, sessionId, targetId };
}
const until = async (d, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(150); } return false; };
const rowBtn = (rowText, btnText, scope = '') => `[...document.querySelectorAll(${JSON.stringify((scope + ' .song-row').trim())})].filter(r => r.textContent.includes(${JSON.stringify(rowText)})).map(r => [...r.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(btnText)}))[0]`;
const rows = (scope = '') => `[...document.querySelectorAll(${JSON.stringify((scope + ' .song-row').trim())})].map(r => r.querySelector('.t').textContent.replace(/\\s+/g, ' ').trim())`;
const toastHas = (txt) => `[...document.querySelectorAll('.toast')].some(t => t.textContent.includes(${JSON.stringify(txt)}))`;
const modalBtn = txt => `[...document.querySelectorAll('.modal-wrap .modal-btns button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)})`;
const closeModals = `(() => { document.querySelectorAll('.modal-wrap').forEach(w => w.remove()); return 1; })()`;

//  ① 악기 소리 — 페이지 안에서 audio.js 를 불러 OfflineAudioContext 로 짧게 그려 본다(재생 장치 없음)
const VOICES = ['violin', 'strings', 'cello', 'contrabass', 'pizz', 'flute', 'clarinet', 'oboe', 'trumpet', 'horn', 'tuba', 'harp', 'celesta', 'glock', 'choir', 'timpani'];
const RENDER = `(async () => {
  const { Engine } = await import('./js/audio.js?v=${V}');
  const stat = d => { let peak = 0, sum = 0, fin = true, tail = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; if (!Number.isFinite(x)) fin = false; const a = Math.abs(x); if (a > peak) peak = a; sum += x * x; if (i > d.length * 0.92 && a > tail) tail = a; } return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), fin, tail: +tail.toFixed(4) }; };
  const one = async (fn, sec = 3.4) => { const sr = 22050, ctx = new OfflineAudioContext(1, Math.round(sr * sec), sr), e = new Engine(); e._setup(ctx); fn(e); return stat((await ctx.startRendering()).getChannelData(0)); };
  const out = {};
  for (const v of ${JSON.stringify(VOICES)}) out[v] = await one(e => e.note(v, v === 'contrabass' || v === 'tuba' ? 40 : v === 'timpani' ? 45 : v === 'cello' ? 52 : 67, 0.05, 1.0, 0.85));
  for (const k of ['cymbal', 'bassdrum', 'triangle', 'snare']) out['drum:' + k] = await one(e => e.drum(k, 0.05, 0.85, null, 0.3));
  return JSON.stringify(out);
})()`;
//  편성 여섯 전체 소리 — 작은 별(앞 8마디)을 오케스트라로 · 사건을 바로 예약해 6초 그림
const ENSEMBLE = `(async () => {
  const { Engine } = await import('./js/audio.js?v=${V}');
  const S = await import('./js/song.js?v=${V}'), O = await import('./js/orchestra.js?v=${V}');
  const out = {};
  for (const k of O.PRESET_KEYS) {
    const lib = S.librarySongs().find(s => s.lk === 'star');
    const song = { ...lib, scale: 'major', orch: O.defaultOrch(k) }; O.applyPreset(song, k);
    const b = S.buildEvents(song, { orchFinale: true });
    const sr = 22050, sec = 6, ctx = new OfflineAudioContext(1, sr * sec, sr), e = new Engine(); e._setup(ctx); e.prewarm(b.events);
    for (const ev of b.events) { if (ev.t > sec - 0.5) break; if (ev.kind === 'note') e.note(ev.inst, ev.p, 0.05 + ev.t, ev.d, ev.vel, null, ev.art); else if (ev.kind === 'drum') e.drum(ev.drum, 0.05 + ev.t, ev.vel, null, ev.span); }
    const d = (await ctx.startRendering()).getChannelData(0); let peak = 0, sum = 0, fin = true; for (const x of d) { if (!Number.isFinite(x)) fin = false; peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    out[k] = { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), fin, n: b.events.length, tracks: [...new Set(b.events.map(x => x.track))].join(',') };
  }
  return JSON.stringify(out);
})()`;

try {
  await cdp();
  // ═════ ① 악기 소리 ═════
  const A = await device('소리', '/music/index.html');
  await until(A, `!!document.querySelector('.door')`, 15000);
  const vr = JSON.parse(await A.ev(RENDER) || '{}');
  for (const [k, r] of Object.entries(vr)) ok(r.fin && r.peak > 0.02 && r.peak < 1 && r.rms > 0.002 && r.tail < Math.max(0.02, r.peak * 0.35), '소리 ' + k, JSON.stringify(r));
  const er = JSON.parse(await A.ev(ENSEMBLE) || '{}');
  for (const [k, r] of Object.entries(er)) ok(r.fin && r.peak < 1 && r.rms > 0.01, '편성 소리 ' + k + ' (사건 ' + r.n + ')', JSON.stringify(r));

  // ═════ ② 작곡 ═════
  const S = await device('학생', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/compose/new`);
  ok(await until(S, `!!document.querySelector('.c-grid .c-row')`, 15000), '작곡 화면');
  await sleep(400);
  //  칸을 실제로 눌러 가락 여덟 음(두 마디) — 줄은 위에서부터 r, 칸은 step
  const cellXY = (step, r) => `(() => { const g = document.querySelector('.c-grid'), b = g.getBoundingClientRect(), cs = getComputedStyle(g); const cw = parseFloat(cs.getPropertyValue('--cw')), rh = parseFloat(cs.getPropertyValue('--rh')), lab = parseFloat(cs.getPropertyValue('--lab'));
    const x = b.left + lab + ${step} * cw + cw / 2, y = b.top + ${r} * rh + rh / 2; return { x, y, hit: document.elementFromPoint(x, y)?.className || '' }; })()`;
  const plan = [[0, 3], [2, 2], [4, 1], [6, 2], [8, 3], [10, 3], [12, 3], [14, 4]];
  let placed = 0;
  for (const [st, r] of plan) { const c = await S.ev(cellXY(st, r)); if (c && /c-row|c-grid/.test(c.hit)) { await S.click(c.x, c.y); placed++; await sleep(80); } }
  const nNotes = await S.ev(`document.querySelectorAll('.c-note:not(.harm)').length`);
  ok(placed >= 6 && nNotes >= 6, '칸을 눌러 가락 놓기 ' + nNotes + '음', placed);
  //  오케스트라 켜기
  const sw = await S.pressEl(`document.querySelector('.oc-switch')`);
  ok(sw === true, '🎻 오케스트라 스위치 누름', sw);
  ok(await until(S, `!!document.querySelector('.modal-wrap h2') && document.querySelector('.modal-wrap h2').textContent.includes('오케스트라')`, 5000), '켜기 설명 창');
  await S.pressEl(modalBtn('닫기'));
  ok(await until(S, `!!document.querySelector('.oc-switch.on') && document.querySelectorAll('.oc-card').length === 6 && !!document.querySelector('.band.resting')`, 5000), '켜짐 · 편성 카드 6 · 반주 친구 쉼');
  await S.shot('o1_on');
  //  편성 여섯 — 카드 누름 → 설명 창 → ▶ 들어 보기 → 2초 → 멈춤
  for (const k of ['full', 'strings', 'march', 'film', 'waltz', 'fairy']) {
    const pr = await S.pressEl(`document.querySelector('.oc-card[data-preset="${k}"]')`);
    const why = await until(S, `!!document.querySelector('.modal-wrap .oc-why')`, 4000);
    await S.pressEl(modalBtn('▶ 들어 보기'));
    const playing = await until(S, `[...document.querySelectorAll('.top button')].some(b => b.textContent.includes('■ 멈추기'))`, 4000);
    await sleep(1800);
    if (k === 'film') await S.shot('o2_film_playing');
    await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.includes('■ 멈추기'))`);
    const card = await S.ev(`document.querySelector('.oc-card.on')?.dataset.preset`);
    ok(pr === true && why && playing && card === k, '편성 ' + k + ' · 설명 · 들어 보기', `${pr} ${why} ${playing} ${card}`);
  }
  //  칸 칩 하나 끄고 켜기 · 셈여림 · 점점 느리게
  const chip0 = await S.ev(`document.querySelector('.oc-chip[data-part="harp"]')?.getAttribute('aria-pressed')`);
  await S.pressEl(`document.querySelector('.oc-chip[data-part="harp"]')`);
  const chip1 = await S.ev(`document.querySelector('.oc-chip[data-part="harp"]')?.getAttribute('aria-pressed')`);
  ok(chip0 != null && chip0 !== chip1, '하프 칩 바뀜', chip0 + ' → ' + chip1);
  await S.ev(`(() => { const s = [...document.querySelectorAll('.oc select')].find(x => [...x.options].some(o => o.value === 'arch')); s.value = 'arch'; s.dispatchEvent(new Event('change')); return 1; })()`);
  //  악기 소개 — ▶ 바이올린 · 가족 칸 바꾸기 · 닫기
  await S.pressEl(`document.querySelector('.oc-intro')`);
  ok(await until(S, `document.querySelectorAll('.fam-tabs button').length >= 4 && !!document.querySelector('[data-sample]')`, 4000), '악기 소개 창');
  const smp = await S.pressEl(`document.querySelector('[data-sample="trumpet"]') || document.querySelector('[data-sample]')`);
  await sleep(600);
  await S.pressEl(`[...document.querySelectorAll('.fam-tabs button')].find(b => b.textContent.includes('금관'))`);
  const famOk = await until(S, `!!document.querySelector('[data-sample="tuba"]')`, 3000);
  await S.shot('o3_families');
  await S.pressEl(modalBtn('닫기'));
  ok(smp === true && famOk, '악기 소개 ▶ · 가족 칸', smp + ' ' + famOk);
  //  저장
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.trim() === '저장')`);
  await until(S, `!!document.querySelector('.modal-wrap .save input')`, 4000);
  await S.ev(`(() => { const i = document.querySelector('.modal-wrap .save input'); i.value = '오케스트라 시험'; i.dispatchEvent(new Event('input')); return 1; })()`);
  await S.pressEl(`[...document.querySelectorAll('.modal-wrap .modal-btns button')].find(b => b.textContent.trim() === '저장')`);
  ok(await until(S, toastHas('저장했어요'), 6000), '저장했어요');
  const mine = db('classRPG_music/songs/s1') || {};
  const saved = Object.values(mine)[0] || {};
  ok(saved.orch && saved.orch.on === true && saved.orch.preset === 'fairy' && saved.orch.dyn === 'arch' && saved.orch.parts && saved.orch.parts.harp === (chip1 === 'true'), '서버 곡에 orch 저장', JSON.stringify(saved.orch));
  //  다시 열기
  await S.ev(`location.hash = '#/'`); await sleep(600);
  await S.ev(`location.hash = '#/compose/u.s1.${saved.id}'`);
  ok(await until(S, `!!document.querySelector('.oc-switch.on') && document.querySelector('.oc-card.on')?.dataset.preset === 'fairy'`, 8000), '다시 열면 오케스트라 켜짐 · 동화 나라');
  //  첫 화면 '내 곡' 듣기
  await S.ev(`location.hash = '#/'`);
  ok(await until(S, `[...document.querySelectorAll('.song-row')].some(r => r.textContent.includes('오케스트라 시험'))`, 8000), '첫 화면 내 곡');
  const lp = await S.pressEl(`[...document.querySelectorAll('.song-row')].find(r => r.textContent.includes('오케스트라 시험')).querySelector('.play-i')`);
  await sleep(1500);
  ok(lp === true && await S.ev(`!!document.querySelector('.play-i.stop')`), '내 곡 듣기(오케스트라)', lp);
  await S.pressEl(`document.querySelector('.play-i.stop')`);
  //  연습(반주 켬 · 끔) · 리듬
  await S.ev(`location.hash = '#/practice/u.s1.${saved.id}'`);
  ok(await until(S, `!!document.querySelector('.p-card h2')`, 8000), '연습 화면');
  await S.pressEl(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('▶ 시작'))`); await sleep(4200);
  ok(await S.ev(`document.querySelector('.p-stop')?.style.display !== 'none'`), '연습 반주 켬으로 시작');
  await S.ev(`document.querySelector('.p-stop')?.click(); 1`);
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.trim() === '반주')`);
  await S.pressEl(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('▶ 시작'))`); await sleep(3800);
  ok(await S.ev(`document.querySelector('.p-stop')?.style.display !== 'none'`), '연습 반주 끔으로 시작');
  await S.ev(`document.querySelector('.p-stop')?.click(); 1`);
  await S.ev(`location.hash = '#/rhythm/u.s1.${saved.id}'`);
  ok(await until(S, `!!window.__rhythm && window.__rhythm.chart().length > 0`, 8000), '리듬 화면');
  await S.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('▶ 시작'))?.click(); 1`); await sleep(4500);
  ok(await S.ev(`window.__rhythm.state() === 'play'`), '리듬 오케스트라 반주로 진행');
  await S.shot('o4_rhythm');
  //  좁은 화면 — 오케스트라 칸까지 내려가서 누름
  const N = await device('좁은', `/music/index.html?sid=s2&n=${encodeURIComponent('좁게')}#/compose/new`, { w: 390, h: 800 });
  ok(await until(N, `!!document.querySelector('.oc-switch')`, 15000), '좁은 화면 작곡');
  const nsw = await N.pressEl(`document.querySelector('.oc-switch')`);
  await sleep(500); await N.ev(closeModals);
  const ncard = await N.pressEl(`document.querySelector('.oc-card[data-preset="march"]')`);
  await sleep(400); await N.shot('o5_narrow');
  await N.ev(closeModals);
  ok(nsw === true && ncard === true, '좁은 화면에서 스위치 · 카드 누름', nsw + ' ' + ncard);

  ok(net.prod.length === 0, '운영 주소 요청 0', net.prod.slice(0, 3).join(' | '));
  ok(Object.values(errs).flat().length === 0, '페이지 오류 0', JSON.stringify(errs).slice(0, 400));
} catch (e) { ok(false, '예외', e.stack); }
finally {
  clearTimeout(killer); await cleanup();
  const fail = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n음악실 오케스트라 실제 화면: PASS ${results.length - fail} · FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
}
