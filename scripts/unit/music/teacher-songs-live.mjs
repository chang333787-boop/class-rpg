// 음악실 선생님 곡(공연 곡) 실제 화면 확인 [MUSIC-TSONG-1] — 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 · 실제 소리 장치 시각
//  교사(music/index.html?teacher=1#/t · 관리자 비밀번호 x): 맨 위 '🎤 선생님 곡' 칸 → 곡 파일 올리기(CDP DOM.setFileInputFiles · 파일은 임시 폴더에만)
//     → 목록 · 서버 classRPG_music/tsongs/<곡키> · 같은 곡키 = 바꿨어요 · 틀린 곡은 까닭과 함께 막힘 · 지우기 · 악보 · 아이 칸도 그대로
//  학생(?sid=s1): 리코더 연습 고르기 첫 칸(처음 고른 칸) = 선생님 곡 · 저먼식이면 시♭ 곡 [연습] 꺼짐 → 연습 화면(22마디)
//     → 리듬 고르기 → 64마디 곡 리듬 화면 · 끝까지 침 → rhythm/ts_<곡키>/s1 · 짧은 곡 연습 끝까지 → practice/s1/ts_<곡키>
//     → 첫 화면 '선생님 곡 3' 표 · 작곡 길(#/compose/ts_…) 막힘
//  + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8893 DP=9573 node scripts/unit/music/teacher-songs-live.mjs   (스크린샷 OUT=<폴더> · 가짜 서버 FAKE_RTDB=<…/server.mjs>)
//  시험 곡은 모두 저작권이 끝난 가락(작은 별 · 나비야). 리듬 판을 치려고 학생 주소에 &debug=1(window.__rhythm — 시험 전용 손잡이)을 붙인다.
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fromTeacherSong } from '../../../music/js/song.js';
import { LIBRARY } from '../../../music/js/library.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8893), DP = Number(process.env.DP || 9573);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 400) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// ── 시험 곡(저작권 끝난 가락) — 임시 폴더에 곡 파일로 써서 교사 화면에 올린다 ──
const STAR = { key: 'test_star_f', title: '작은 별 시험', part: '1부(가락)', origin: '프랑스 민요', memo: '시험용', order: 1, beats: 4, sub: 4, tempo: 96, key2: 5, scale: 'major', inst: 'recorder', level: 2,
  melody: 'F4/4 F4/4 C5/4 C5/4 | D5/4 D5/4 C5/8 | Bb4/4 Bb4/4 A4/4 A4/4 | G4/4 G4/4 F4/8 | C5/4 C5/4 Bb4/4 Bb4/4 | A4/4 A4/4 G4/8 | C5/4 C5/4 Bb4/4 Bb4/4 | A4/4 A4/4 G4/8 |'
    + 'F4/4 F4/4 C5/4 C5/4 | D5/4 D5/4 C5/8 | Bb4/4 Bb4/4 A4/4 A4/4 | G4/4 G4/4 F4/8 | F4/3 F4/1 C5/3 C5/1 D5/2 D5/2 C5/4 | Bb4/2 Bb4/2 A4/2 A4/2 G4/1 A4/1 G4/2 F4/4 |'
    + 'C5/3 C5/1 Bb4/3 Bb4/1 A4/2 A4/2 G4/4 | C5/3 C5/1 Bb4/3 Bb4/1 A4/2 A4/2 G4/4~ | G4/4 F4/4 F4/4 C5/4 | D5/4 D5/4 C5/8 | Bb4/4 Bb4/4 A4/4 A4/4 | G4/4 G4/4 F4/8~ | F4/16~ | F4/8 R/8',
  prog: 'F Bb F C7', progEvery: 4, extra: '버릴 칸' };
const NABIYA = LIBRARY.find(x => x.key === 'nabiya').melody;
const LONG = { key: 'test_long', title: '나비야 네 번', origin: '독일 민요', order: 3, beats: 2, sub: 2, tempo: 200, inst: 'recorder', melody: [NABIYA, NABIYA, NABIYA, NABIYA].join(' | ') };
const SHORT = { key: 'test_short', title: '짧은 연습 곡', origin: '연습곡', order: 2, beats: 4, sub: 2, tempo: 200, key2: 5, melody: 'F4/2 G4/2 A4/2 Bb4/2 | C5/4 C5/4 | Bb4/2 A4/2 G4/2 F4/2 | F4/8' };
const BAD = { key: 'test_bad', title: '틀린 곡', beats: 4, sub: 2, tempo: 100, melody: 'C4/8 | C4/4 D4/2' };
const DEL = { key: 'test_del', title: '지울 곡', beats: 2, sub: 2, tempo: 100, melody: 'C4/2 D4/2 | E4/4' };
const sStar = fromTeacherSong(STAR), sLong = fromTeacherSong(LONG), sShort = fromTeacherSong(SHORT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tsongs-'));
const F1 = path.join(TMP, 'concert-songs.json'), F2 = path.join(TMP, 'fix.json'), F3 = path.join(TMP, 'extra.json');
fs.writeFileSync(F1, JSON.stringify({ kind: 'rpg-music-song', v: 1, songs: [STAR, LONG, SHORT] }, null, 1));
fs.writeFileSync(F2, JSON.stringify([{ ...STAR, memo: '바뀐 메모' }, BAD]));
fs.writeFileSync(F3, JSON.stringify(DEL));

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE + ' (FAKE_RTDB=<경로>)'); process.exit(0); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'tsongs-live-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',   // 소리 장치 없는 헤드리스에서도 소리 시각(currentTime)이 흐르게
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); for (const d of [PROF, TMP]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과'); await cleanup(); process.exit(2); }, 300000);
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
//  리듬 판 치기(debug 손잡이) — 실제 [▶ 시작] 단추를 누르고 소리 장치 시각에 맞춰 모든 음표를 누름 · 뗌
const BOT = `(() => { const R = window.__rhythm; if (!R) return 'no-rhythm';
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('▶ 시작')); if (!b) return 'no-start';
  b.click();
  const ch = R.chart(); clearInterval(window.__bot);
  window.__bot = setInterval(() => { if (R.state() !== 'play') return; const t = R.now();
    ch.forEach(c => { if (c._b) return; if (t >= c.t - 0.004) { c._b = 1; R.press(c.lane); setTimeout(() => R.release(c.lane), c.long ? c.d * 1000 + 40 : 50); } }); }, 3);
  return ch.length; })()`;

try {
  await cdp();
  // ═════ A. 교사 — 곡 파일 넣기 ═════
  const T = await device('교사', '/music/index.html?teacher=1#/t');
  ok(await until(T, `!!document.querySelector('.pick.teacher .ts-card .ts-head') && document.querySelector('.ts-card').textContent.includes('아직 넣은 곡이 없어요')`, 20000),
    'A1 교사 화면(비밀번호 x) 맨 위 \'🎤 선생님 곡\' 칸 · 아직 곡 없음', await T.ev(`(document.querySelector('.view') || document.body).textContent.replace(/\\s+/g, ' ').slice(0, 200)`));
  const head = await T.ev(`({ head: document.querySelector('.ts-card .ts-head').textContent, help: document.querySelector('.ts-card .ts-help').textContent, input: (() => { const i = document.querySelector('.ts-card input[type=file]'); return i ? { multiple: i.multiple, accept: i.accept, hidden: getComputedStyle(i).display === 'none' } : null; })(), first: document.querySelector('.pick.teacher').firstElementChild.classList.contains('ts-card') })`);
  ok(head && /선생님 곡 · 공연 곡/.test(head.head) && /곡 파일 고르기/.test(head.head) && /리코더 연습 · 리듬 게임/.test(head.help) && head.input && head.input.multiple && head.input.accept === '.json,application/json' && head.input.hidden && head.first,
    'A2 제목 · [곡 파일 고르기] · 안내 한 줄 · 숨은 파일 칸(여러 개 · .json) · 칸이 맨 위', JSON.stringify(head));
  ok(await until(T, `/아직 안 했어요|아직 아무도/.test(document.querySelector('.pick.teacher').textContent)`, 10000), 'A3 아래 아이 칸도 그대로 그려짐(명단 · 아직 안 했어요)');
  await T.shot('A_teacher_empty');
  ok(await T.setFiles('.ts-card input[type=file]', [F1]), 'A4 곡 파일 고르기(곡 셋을 담은 파일 하나)');
  ok(await until(T, `document.querySelectorAll('.ts-card .song-row').length === 3 && (document.querySelector('.ts-card .ts-note') || {}).textContent === '3곡 넣었어요'`, 10000),
    'A5 \'3곡 넣었어요\' · 목록 3줄', JSON.stringify(await T.ev(`({ note: (document.querySelector('.ts-card .ts-note') || {}).textContent, rows: ${rows('.ts-card')} })`)));
  const listA = await T.ev(rows('.ts-card'));
  ok(Array.isArray(listA) && /작은 별 시험 · 1부\(가락\)/.test(listA[0]) && /4\/4 · 22마디 · 음 84개/.test(listA[0]) && /저먼식 리코더로는 못 부는 음/.test(listA[0]) && /짧은 연습 곡/.test(listA[1]) && /나비야 네 번/.test(listA[2]) && /64마디/.test(listA[2]),
    'A6 목록: 순서(order) · 제목 · 부분 · 22마디 · 음 84개 · 저먼식 알림 / 64마디 곡', JSON.stringify(listA));
  const v1 = db('classRPG_music/tsongs/test_star_f') || {};
  ok(v1.melody === STAR.melody && v1.title === STAR.title && v1.part === STAR.part && typeof v1.t === 'number' && !('extra' in v1) && db('classRPG_music/tsongs/test_long') && db('classRPG_music/tsongs/test_short'),
    'A7 서버 classRPG_music/tsongs/<곡키> 셋 · 정한 칸만(모르는 칸 버림) · 넣은 때 t', JSON.stringify(Object.keys(v1)));
  ok(Object.keys(db('classRPG_music') || {}).join() === 'tsongs', 'A8 음악실 저장소에 쓴 곳 = tsongs 하나뿐', Object.keys(db('classRPG_music') || {}).join());
  await T.shot('A_teacher_list');
  //  두 파일 한 번에: 같은 곡키(바꿔 넣기) + 틀린 곡 / 새 곡 하나
  ok(await T.setFiles('.ts-card input[type=file]', [F2, F3]), 'A9 파일 둘 한 번에(같은 곡키 · 틀린 곡 · 새 곡)');
  ok(await until(T, `document.querySelectorAll('.ts-card .song-row').length === 4 && /못 넣었어요/.test((document.querySelector('.ts-card .ts-note') || {}).textContent || '')`, 10000), 'A10 목록 4줄 · 알림 칸');
  const note2 = await T.ev(`document.querySelector('.ts-card .ts-note').textContent`);
  ok(/^1곡 넣고 1곡 바꾸고 1곡은 못 넣었어요:/.test(note2) && /fix\.json \(test_bad\): 가락\(melody\): 마디 2 칸 수 6 ≠ 8/.test(note2),
    'A11 \'1곡 넣고 1곡 바꾸고 1곡은 못 넣었어요\' · 파일 · 곡키 · 까닭', note2.replace(/\n/g, ' / '));
  ok((db('classRPG_music/tsongs/test_star_f') || {}).memo === '바뀐 메모' && !db('classRPG_music/tsongs/test_bad') && !!db('classRPG_music/tsongs/test_del'), 'A12 서버: 같은 곡키는 바뀜 · 틀린 곡 없음 · 새 곡 있음');
  await T.shot('A_teacher_import2');
  //  지우기(확인 창 → 예)
  const delP = await T.pressEl(rowBtn('지울 곡', '지우기', '.ts-card'));
  ok(delP === true && await until(T, `document.querySelectorAll('.ts-card .song-row').length === 3 && !document.querySelector('.ts-card').textContent.includes('지울 곡')`, 8000) && !db('classRPG_music/tsongs/test_del'),
    'A13 [지우기] → 확인 → 목록 · 서버에서 빠짐', String(delP));
  //  악보 — 22마디 곡(붙임줄 · 16분음표)이 오선으로
  const stP = await T.pressEl(rowBtn('작은 별 시험', '악보', '.ts-card'));
  ok(stP === true && await until(T, `!!document.querySelector('.modal svg.staff') && document.querySelector('.modal h2').textContent.includes('작은 별 시험')`, 5000), 'A14 [악보] → 오선 악보 창(22마디)');
  const acc = await T.ev(`({ acc: [...document.querySelectorAll('.modal .st-acc')].map(t => t.textContent).join(''), sol: [...document.querySelectorAll('.modal .st-sol')].filter(t => t.textContent === '시♭').length, bars: document.querySelectorAll('.modal .st-bar').length })`);
  ok(acc && /^♭+$/.test(acc.acc) && acc.sol > 0, 'A15 바장조 곡 오선: 시♭ 은 ♭(시 자리) · ♯ 없음 · 계이름 \'시♭\'', JSON.stringify(acc));
  await T.shot('A_teacher_staff');
  await T.ev(`document.querySelector('.modal .modal-btns .btn').click(); 1`);

  // ═════ B. 학생 — 고르기 첫 칸 · 연습 · 리듬 ═════
  const S = await device('학생', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/pick/practice`);
  ok(await until(S, `!!document.querySelector('.tabs .btn.on') && document.querySelector('.tabs .btn.on').textContent === '선생님 곡' && document.querySelectorAll('.pick .song-row').length === 3`, 15000),
    'B1 리코더 연습 고르기: 처음 칸 = \'선생님 곡\' · 3곡', JSON.stringify(await S.ev(`({ tabs: [...document.querySelectorAll('.tabs .btn')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), n: document.querySelectorAll('.pick .song-row').length })`)));
  const pk = await S.ev(`({ tabs: [...document.querySelectorAll('.tabs .btn')].map(b => b.textContent), rows: ${rows('.pick')}, btns: [...document.querySelectorAll('.pick .song-row')].map(r => [...r.querySelectorAll('button')].map(b => b.textContent.trim() + (b.disabled ? '(꺼짐)' : '')).join('|')) })`);
  ok(pk.tabs.join('|') === '선생님 곡|기본 곡|내 곡|우리 반 곡' && /작은 별 시험 · 1부\(가락\)/.test(pk.rows[0]) && /프랑스 민요 · 4\/4 · 22마디 · 장음계 · 바뀐 메모/.test(pk.rows[0]) && /짧은 연습 곡/.test(pk.rows[1]) && /나비야 네 번/.test(pk.rows[2]),
    'B2 칸 순서 · 줄: 제목 · 부분 / 출처 · 박자 · 마디 · 음계 · 메모', JSON.stringify(pk.rows));
  ok(pk.btns.every(b => b === '|연습') , 'B3 선생님 곡 줄 단추 = 듣기 · 연습(고치기 · 바꿔 쓰기 없음) · 바로크식이면 시♭ 곡도 켜짐', JSON.stringify(pk.btns));
  await S.shot('B_pick_practice');
  //  저먼식으로 바꾸면 시♭ 곡은 [연습] 꺼짐 + 까닭 · 다시 바로크
  await S.ev(`(() => { const s = document.querySelector('.top select'); s.value = 'german'; s.dispatchEvent(new Event('change')); return 1; })()`);
  await until(S, `document.querySelectorAll('.pick .song-row').length === 3`, 3000);
  const ger = await S.ev(`(() => { const r = [...document.querySelectorAll('.pick .song-row')].find(x => x.textContent.includes('작은 별 시험')); const b = [...r.querySelectorAll('button')].find(x => x.textContent.trim() === '연습'); return { dis: b.disabled, why: r.textContent.includes('저먼식으로는 불 수 없는 음'), tab: document.querySelector('.tabs .btn.on').textContent }; })()`);
  ok(ger && ger.dis === true && ger.why && ger.tab === '선생님 곡', 'B4 저먼식: 시♭ 곡 [연습] 꺼짐 · \'저먼식으로는 불 수 없는 음\' · 칸은 그대로', JSON.stringify(ger));
  await S.ev(`(() => { const s = document.querySelector('.top select'); s.value = 'baroque'; s.dispatchEvent(new Event('change')); return 1; })()`);
  await sleep(300);
  const prP = await S.pressEl(rowBtn('작은 별 시험', '연습', '.pick'));
  ok(prP === true && await until(S, `location.hash === '#/practice/ts_test_star_f' && !!document.querySelector('canvas.p-cv') && document.querySelector('.top h1').textContent.includes('작은 별 시험 · 1부(가락)')`, 8000),
    'B5 [연습] → 리코더 연습 화면(그림판 · 제목)', String(prP));
  const card = await S.ev(`document.querySelector('.p-over').textContent.replace(/\\s+/g, ' ')`);
  ok(/22마디 · 음 84개/.test(card) && !/불 수 없는 음/.test(card), 'B6 준비 칸: 22마디 · 음 84개 · 바로크식으로 다 붊', card.slice(0, 160));
  //  잠깐 불어 보기 — 시작 → 그림이 흐르고(첫 음 운지) → 그만
  await S.pressEl(`[...document.querySelectorAll('.p-over button')].find(b => b.textContent.includes('▶ 시작'))`);
  await sleep(5200);
  const pl = await S.ev(`({ stop: getComputedStyle(document.querySelector('.p-stop')).display !== 'none', name: document.querySelector('.p-name').textContent, finger: !!document.querySelector('.p-big svg.finger') })`);
  ok(pl && pl.stop && pl.finger && pl.name.length > 0, 'B7 ▶ 시작 → 그만 단추 · 큰 운지 그림 · 지금 음 이름', JSON.stringify(pl));
  await S.shot('B_practice_star');
  await S.pressEl(`document.querySelector('.p-stop')`);
  //  리듬 고르기 → 64마디 곡
  await S.ev(`location.hash = '#/pick/rhythm'; 1`);
  ok(await until(S, `document.querySelector('.top h1').textContent.includes('리듬 게임') && (document.querySelector('.tabs .btn.on') || {}).textContent === '선생님 곡' && document.querySelectorAll('.pick .song-row').length === 3`, 8000), 'B8 리듬 게임 고르기: 처음 칸 = 선생님 곡 · 3곡');
  const rb = await S.ev(`[...document.querySelectorAll('.pick .song-row')].map(r => [...r.querySelectorAll('button')].map(b => b.textContent.trim()).join('|'))`);
  ok(Array.isArray(rb) && rb.every(b => b === '|리듬 게임'), 'B9 선생님 곡 줄 단추 = 듣기 · 리듬 게임', JSON.stringify(rb));
  await S.shot('B_pick_rhythm');
  const rhP = await S.pressEl(rowBtn('나비야 네 번', '리듬 게임', '.pick'));
  ok(rhP === true && await until(S, `location.hash === '#/rhythm/ts_test_long' && !!document.querySelector('canvas.r-cv') && !!window.__rhythm && document.querySelector('.top h1').textContent.includes('나비야 네 번')`, 8000), 'B10 [리듬 게임] → 리듬 화면(64마디 곡)', String(rhP));
  const ch = await S.ev(`(() => { const c = window.__rhythm.chart(); const l = c[c.length - 1]; return { n: c.length, end: l.t + l.d, lanes: window.__rhythm.layout().lanes, key: window.__rhythm.layout().key }; })()`);
  const wantEnd = 64 * 2 * 60 / 200;
  ok(ch && ch.n === sLong.notes.length && Math.abs(ch.end - wantEnd) < 1e-6 && ch.key === 'ts_test_long', `B11 리듬 악보 = 음 ${sLong.notes.length}개 전부 · 끝 ${wantEnd}초(64마디 · 16마디에서 안 잘림) · 기록 키 ts_test_long`, JSON.stringify(ch));
  const nBot = await S.ev(BOT);
  ok(nBot === sLong.notes.length, 'B12 [▶ 시작] → 소리 시각에 맞춰 모든 음표를 침', String(nBot));
  await sleep(8000);
  await S.shot('B_rhythm_long_play');
  ok(await until(S, `window.__rhythm.state() === 'done' && /점/.test(document.querySelector('.p-over').textContent)`, 70000), 'B13 64마디를 끝까지 → 결과 칸');
  await sleep(1500);
  const res = await S.ev(`({ st: window.__rhythm.stats(), txt: document.querySelector('.p-over').textContent.replace(/\\s+/g, ' ') })`);
  const rec = db('classRPG_music/rhythm/ts_test_long/s1') || {};
  ok(res.st && res.st.miss <= 3 && res.st.perfect + res.st.great + res.st.good >= sLong.notes.length - 3 && rec.best > 0 && rec.n === '테스트' && /첫 기록|새 최고/.test(res.txt),
    'B14 거의 다 맞힘(놓침 3 이하 · 헤드리스 타이머 흔들림 몫) · 서버 rhythm/ts_test_long/s1 최고 기록 · \'첫 기록!\'', JSON.stringify({ st: res.st, rec }));
  await S.shot('B_rhythm_long_done');
  //  짧은 곡 연습을 끝까지 → 별 → 리코더 기록장 기록(practice/s1/ts_test_short)
  await S.ev(`location.hash = '#/practice/ts_test_short'; 1`);
  ok(await until(S, `!!document.querySelector('canvas.p-cv') && document.querySelector('.top h1').textContent.includes('짧은 연습 곡')`, 8000), 'B15 짧은 곡 연습 화면');
  await S.pressEl(`[...document.querySelectorAll('.p-over button')].find(b => b.textContent.includes('▶ 시작'))`);
  ok(await until(S, `document.querySelector('.p-over').textContent.includes('끝까지 불었어요!')`, 30000), 'B16 끝까지 → \'끝까지 불었어요!\'');
  await S.pressEl(`document.querySelector('.p-over .star-btn')`);
  ok(await until(S, `document.querySelector('.p-over').textContent.includes('이 곡 1번째 연습!')`, 8000), 'B17 별 셋 → \'이 곡 1번째 연습!\'');
  const pr = db('classRPG_music/practice/s1/ts_test_short') || {};
  ok(pr.n === 1 && pr.stars === 3 && pr.t === '짧은 연습 곡' && pr.log && Object.keys(pr.log).length === 1, 'B18 서버 practice/s1/ts_test_short = 1번 · 별 3 · 제목', JSON.stringify(pr));
  //  첫 화면 표 · 작곡 길 막힘
  await S.ev(`location.hash = '#/'; 1`);
  ok(await until(S, `(() => { const b = document.querySelector('.door.d-practice .ts-badge'); return !!b && getComputedStyle(b).display !== 'none' && b.textContent === '선생님 곡 3'; })()`, 8000), 'B19 첫 화면 리코더 연습 문 위 \'선생님 곡 3\'');
  const badgeBox = await S.ev(`(() => { const b = document.querySelector('.door.d-practice .ts-badge').getBoundingClientRect(), d = document.querySelector('.door.d-practice').getBoundingClientRect(); return { inside: b.left >= d.left && b.right <= d.right && b.top >= d.top && b.bottom <= d.bottom, hit: document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === document.querySelector('.door.d-practice .ts-badge') }; })()`);
  ok(badgeBox && badgeBox.inside && badgeBox.hit, 'B20 표가 문 안 · 가려지지 않음', JSON.stringify(badgeBox));
  await S.shot('B_home_badge');
  await S.ev(`location.hash = '#/compose/ts_test_star_f'; 1`);
  ok(await until(S, `${toastHas('선생님 곡은 연습 · 리듬 게임으로 해요')} && location.hash === '#/' && !!document.querySelector('.doors')`, 5000), 'B21 #/compose/ts_… → \'선생님 곡은 연습 · 리듬 게임으로 해요\' · 첫 화면으로');
  //  작은 화면(폰 너비)에서도 고르기 첫 칸이 보임
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 1, mobile: true }, S.sessionId);
  await S.ev(`location.hash = '#/pick/practice'; 1`);
  ok(await until(S, `(document.querySelector('.tabs .btn.on') || {}).textContent === '선생님 곡' && document.querySelectorAll('.pick .song-row').length === 3`, 8000), 'B22 폰 너비(390)에서도 처음 칸 = 선생님 곡');
  await S.shot('B_pick_phone');

  ok(net.prod.length === 0, `운영 주소 요청 0 (전체 ${net.all.length})`, net.prod.slice(0, 5).join(' | '));
  const errList = Object.entries(errs).map(([k, v]) => k + ': ' + [...new Set(v)].slice(0, 4).join(' / '));
  ok(errList.length === 0, '페이지 오류 · console.error 0', errList.join(' || '));
  ws.close();
} catch (e) {
  ok(false, '예외', e && e.stack);
}
clearTimeout(killer);
await cleanup();
const fails = results.filter(r => r[0] === 'FAIL');
console.log(`음악실 선생님 곡 실제 화면 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
