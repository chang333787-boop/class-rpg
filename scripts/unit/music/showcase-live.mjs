// 음악실 예시 작품 실제 화면 확인 [MUSIC-SHOWCASE-1] — 가짜 RTDB(운영 DB 0) + 헤드리스 크롬 + 실제 화면
//  첫 화면 '🌟 이렇게도 만들 수 있어요' 여섯 → ▶ 듣기 · 작곡 예시(작품 노트 · ▶) · 🪈 리코더로 · 비트 예시(작품 노트 · ▶ 순서대로) · 시작 카드 예시 칸 · 저장 · 390px
//  실행: PP=8941 DP=9621 node scripts/unit/music/showcase-live.mjs   (스크린샷 OUT=<폴더> · 가짜 서버 FAKE_RTDB=<…/server.mjs>) — 안에서 150초면 스스로 끝낸다
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8941), DP = Number(process.env.DP || 9621);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 400) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE + ' (FAKE_RTDB=<경로>)'); process.exit(0); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-live-'));
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
//  첫 화면 → 작곡 예시(작품 노트 · ▶) → 리코더로 → 비트 예시(작품 노트 · ▶ · 순서대로) → 시작 카드 예시 칸 → 저장 → 좁은 화면
try {
  await cdp();
  const S = await device('학생', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/`);
  ok(await until(S, `document.querySelectorAll('.showcase .sc-card').length === 6`, 15000), '첫 화면 예시 작품 여섯');
  const titles = await S.ev(`[...document.querySelectorAll('.sc-card b')].map(b => b.textContent)`);
  ok(JSON.stringify(titles) === JSON.stringify(['용사의 출발', '요정 숲의 왈츠', '운동회 행진곡', '몬스터 댄스 파티', '비 오는 날 숙제', '장구 신나라']), '제목', JSON.stringify(titles));
  ok(await S.ev(`document.querySelectorAll('.sc-card .sc-rec').length === 2`), '🪈 리코더로 = 용사 · 행진곡');
  await S.shot('s1_home');
  //  ▶ 바로 듣기(카드는 안 열림)
  const pl = await S.pressEl(`document.querySelector('.sc-card[data-ex="fairywaltz"] .play-i')`);
  await sleep(900);
  ok(pl === true && await S.ev(`!!document.querySelector('.sc-card[data-ex="fairywaltz"] .play-i.stop') && location.hash === '#/'`), '첫 화면에서 ▶ 듣기(그대로 첫 화면)');
  await S.pressEl(`document.querySelector('.sc-card[data-ex="fairywaltz"] .play-i')`);
  //  작곡 예시 — 카드 누름 → 작곡 화면 + 작품 노트 → ▶ 들어 보기
  await S.pressEl(`document.querySelector('.sc-card[data-ex="hero"]')`);
  ok(await until(S, `location.hash === '#/compose/ex_hero' && !!document.querySelector('.modal-wrap .ex-note') && document.querySelector('.modal-wrap h2').textContent.includes('용사의 출발')`, 8000), '작곡 화면 + 작품 노트');
  const comp = await S.ev(`({ title: document.querySelector('.c-title').value, orch: !!document.querySelector('.oc-switch.on'), preset: document.querySelector('.oc-card.on')?.dataset.preset, notes: document.querySelectorAll('.c-note:not(.harm)').length, harm: document.querySelectorAll('.c-note.harm').length })`);
  ok(comp.title === '용사의 출발 바꿔 쓰기' && comp.orch && comp.preset === 'film' && comp.notes >= 40, '예시 곡 = 오케스트라 켜짐 · 영화 음악 · 가락', JSON.stringify(comp));
  await S.shot('s2_compose_note');
  await S.pressEl(modalBtn('▶ 들어 보기'));
  ok(await until(S, `[...document.querySelectorAll('.top button')].some(b => b.textContent.includes('■ 멈추기'))`, 4000), '▶ 들어 보기 → 재생');
  await sleep(1500); await S.shot('s3_compose_playing');
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.includes('■ 멈추기'))`);
  //  리코더로 — 첫 화면 🪈
  await S.ev(`location.hash = '#/'`);
  await until(S, `!!document.querySelector('.sc-card[data-ex="sportsmarch"] .sc-rec')`, 6000);
  await S.pressEl(`document.querySelector('.sc-card[data-ex="sportsmarch"] .sc-rec')`);
  ok(await until(S, `location.hash === '#/practice/ex_sportsmarch' && !!document.querySelector('.p-card h2') && document.querySelector('.p-card h2').textContent.includes('운동회 행진곡')`, 8000), '🪈 리코더로 → 연습 화면');
  //  비트 예시 — 첫 화면 카드 → 비트 화면 + 작품 노트 → ▶ → 순서대로(패턴 A → B)
  await S.ev(`location.hash = '#/'`);
  await until(S, `!!document.querySelector('.sc-card[data-ex="monsterparty"]')`, 6000);
  await S.pressEl(`document.querySelector('.sc-card[data-ex="monsterparty"]')`);
  ok(await until(S, `location.hash === '#/beat/ex.monsterparty' && !!document.querySelector('.modal-wrap .ex-note') && !!window.__beat`, 10000), '비트 화면 + 작품 노트');
  const st0 = await S.ev(`window.__beat.state()`);
  ok(st0.mode === 'song' && st0.arr.join('') === '01012323' && st0.title === '몬스터 댄스 파티' && st0.fill === true && !st0.dirty, '예시 비트 = 순서대로 · 필인 · 바꾸기 전', JSON.stringify(st0));
  await S.shot('s4_beat_note');
  await S.pressEl(modalBtn('▶ 들어 보기'));
  await sleep(4800);
  const L1 = await S.ev(`({ st: window.__beat.state(), pats: [...new Set(window.__beat.log().filter(e => e.k === 'step' && e.t < window.__beat.now()).map(e => e.p))] })`);
  ok(L1.st.playing && L1.pats.includes(0) && L1.pats.includes(1), '▶ → 순서대로 A 다음 B', JSON.stringify(L1.pats));
  const mel = await S.ev(`window.__beat.log().filter(e => e.k === 'mel').length`);
  ok(mel > 3, '가락이 울림 ' + mel);
  await S.shot('s5_beat_playing');
  //  시작 카드 예시 칸 → 다른 예시(바꾸지 않았으니 묻지 않고 바로)
  await S.ev(`(() => { const t = [...document.querySelectorAll('.bt-side button')].find(b => b.textContent.trim() === '시작 카드'); t && t.click(); return 1; })()`);
  ok(await until(S, `document.querySelectorAll('.bt-card.ex').length === 3`, 4000), '시작 카드 예시 칸 셋');
  await S.pressEl(`document.querySelector('.bt-card.ex[data-ex="janggu"]')`);
  ok(await until(S, `location.hash === '#/beat/ex.janggu' && !!document.querySelector('.modal-wrap .ex-note') && window.__beat && window.__beat.state().kit === 'kor'`, 10000), '시작 카드 → 장구 신나라(우리 장단)');
  await S.shot('s6_janggu');
  await S.ev(closeModals);
  //  저장 → 내 비트(예시는 그대로)
  await S.ev(`(() => { const i = document.querySelector('.top input'); if (i) { i.value = '장구 신나라 내 판'; i.dispatchEvent(new Event('input')); } return 1; })()`);
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.trim() === '저장')`);
  await sleep(800);
  await S.ev(`(() => { const b = [...document.querySelectorAll('.modal-wrap .modal-btns button')].find(x => /저장/.test(x.textContent)); b && b.click(); return 1; })()`);
  ok(await until(S, `!!Object.keys(${JSON.stringify({})}) && true`, 300) && await (async () => { for (let i = 0; i < 30; i++) { const v = db('classRPG_music/beats/s1'); if (v && Object.values(v).some(b => b && b.kit === 'kor' && b.arr && Object.values(b.arr).length === 8 && b.title === '장구 신나라 내 판')) return true; await sleep(200); } return false; })(), '저장 → 내 비트(우리 장단 · 순서 8)', JSON.stringify(Object.values(db('classRPG_music/beats/s1') || {}).map(b => b.title)));
  //  좁은 화면 — 첫 화면 카드 두 줄로 · 누름
  const N = await device('좁은', `/music/index.html?sid=s2&n=${encodeURIComponent('좁게')}#/`, { w: 390, h: 800 });
  ok(await until(N, `document.querySelectorAll('.showcase .sc-card').length === 6`, 15000), '좁은 화면 예시 작품');
  await N.ev(`document.querySelector('.showcase').scrollIntoView(); 1`); await sleep(300); await N.shot('s7_narrow_home');
  const nc = await N.pressEl(`document.querySelector('.sc-card[data-ex="rainyday"]')`);
  ok(nc === true && await until(N, `location.hash === '#/beat/ex.rainyday' && !!document.querySelector('.modal-wrap .ex-note')`, 10000), '좁은 화면 카드 → 비 오는 날 숙제');
  await N.shot('s8_narrow_beat');
  ok(net.prod.length === 0, '운영 주소 요청 0', net.prod.slice(0, 3).join(' | '));
  ok(Object.values(errs).flat().length === 0, '페이지 오류 0', JSON.stringify(errs).slice(0, 400));
} catch (e) { ok(false, '예외', e.stack); }
finally {
  clearTimeout(killer); await cleanup();
  const fail = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n음악실 예시 작품 실제 화면: PASS ${results.length - fail} · FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
}
