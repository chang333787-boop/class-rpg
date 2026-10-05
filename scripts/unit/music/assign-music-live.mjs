// 음악실 리듬 과제 여러 기기 확인 [ASSIGN-MUSIC-1] — 공유 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 · 실제 리듬 판(소리 장치 시각)
//  기기: 교사(admin.html?auto) · 학생 셋(student.html?as=s1·s2·s3) · TV(assign/)
//   A 과제함: 교사가 만들기 창에서 [🎵 음악실 리듬] → 곡(솔·라·시 연습) 실제로 눌러 고름 → 과제함에 보냄
//      → 학생1 홈 카드 → 학습 앱 창(음악실 ?assign=) → 정한 판 칩 · 고르기 칸 없음 → 리듬을 끝까지 침(모든 음표) · 학생2 하나 걸러 침 · 학생3 안 함
//      → 서버 결과 칸(점수 = 정확도 · best · first · 판 수 · doneAt) → 교사 결과 표(명단 기준 · 정확도 · 판정 넷 · 처음 판 · 친 횟수)
//   B 수업(각자 풀기): 학생2 는 밑에 음악실 리듬을 치는 중 → 교사 '지금 모두 같이' → 덮개 안에 리듬 앱 창(&live=1) · 밑의 리듬은 멈춤
//      → 학생1 덮개 안에서 침 → 교사 수업 띠 · TV '끝낸 친구 1' · 결과 표 → 끝내기 → 덮개 걷힘 · 밑의 음악실 창 그대로
//   + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: FAKE_RTDB=<…/fake-rtdb/server.mjs> PP=8873 DP=9553 node scripts/unit/music/assign-music-live.mjs   (스크린샷 OUT=<폴더>)
//  리듬 판을 치려고 앱 창 주소에 &debug=1(window.__rhythm — 시험 전용 손잡이)을 덧붙인다. 그 밖에는 실제 화면 그대로.
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8873), DP = Number(process.env.DP || 9553);
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
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'assign-music-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',   // 소리 장치 없는 헤드리스에서도 소리 시각(currentTime)이 흐르게
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과'); await cleanup(); process.exit(2); }, 420000);
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
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true, promptText: 'x' }, m.sessionId);
  };
}
async function device(name, url, { w = 1366, h = 610 } = {}) {
  const { browserContextId } = await send('Target.createBrowserContext', {});
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  sessName[sessionId] = name;
  for (const [mth, p] of [['Runtime.enable'], ['Page.enable'], ['Network.enable'],
    ['Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*'] }],
    ['Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }]]) await send(mth, p || {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PP}${url}` }, sessionId);
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
  //  같은 출처 iframe 안에서 식 하나(그 창의 eval) — 없으면 null
  const fr = async (sel, x) => ev(`(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f || !f.contentWindow || !f.contentWindow.eval) return null; try { return f.contentWindow.eval(${JSON.stringify(x)}); } catch (e) { return 'ERR:' + e.message; } })()`);
  const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
  const key = async (k) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 }, sessionId); };
  const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); };
  const press = async (sel, idx = 0) => {
    const r = await ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getClientRects().length && e.offsetParent !== null || getComputedStyle(e).position === 'fixed'); const e = els[${idx}]; if (!e) return null;
      e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)) }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  return { name, ev, fr, shot, key, click, press, sessionId, targetId };
}
const until = async (d, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(150); } return false; };
const untilFr = async (d, sel, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.fr(sel, expr) === true) return true; await sleep(200); } return false; };

//  리듬 판 치기(앱 창 안 · debug 손잡이) — every = 1 모든 음표 · 2 하나 걸러 · 실제 [▶ 시작] 단추를 누르고 소리 장치 시각에 맞춰 누름 · 뗌
const BOT = (every) => `(() => { const R = window.__rhythm; if (!R) return 'no-rhythm';
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('▶ 시작')); if (!b) return 'no-start';
  b.click();
  const ch = R.chart(); clearInterval(window.__bot);
  window.__bot = setInterval(() => { if (R.state() !== 'play') return; const t = R.now();
    ch.forEach((c, i) => { if (c._b || i % ${every}) return; if (t >= c.t - 0.004) { c._b = 1; R.press(c.lane); setTimeout(() => R.release(c.lane), c.long ? c.d * 1000 + 40 : 50); } }); }, 3);
  return ch.length; })()`;
const FRAME_DEBUG = (sel) => `(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return ''; const u = f.src; if (!/debug=1/.test(u)) f.src = u.replace(/(#|$)/, '&debug=1$1'); return f.src; })()`;

try {
  await cdp();
  const T = await device('교사', '/admin.html?auto');
  const S1 = await device('학생1', '/student.html?as=s1');
  const S2 = await device('학생2', '/student.html?as=s2');
  const S3 = await device('학생3', '/student.html?as=s3');
  const ready = async (S, sid) => until(S, `typeof CUR !== 'undefined' && !!CUR && CUR.id === '${sid}' && document.getElementById('s-game').classList.contains('active') && typeof _ASG !== 'undefined' && _ASG.sid === '${sid}' && _ASG.connected`, 25000);
  const tReady = await until(T, `document.getElementById('admin-app')?.style.display === 'grid' && typeof _AS !== 'undefined' && _AS.booted && _AS.connected`, 25000);
  const sReady = [await ready(S1, 's1'), await ready(S2, 's2'), await ready(S3, 's3')];
  ok(tReady && sReady.every(Boolean), '기기 입장(교사 · 학생 셋) — 가짜 서버', JSON.stringify({ tReady, sReady }));
  for (const d of [T, S1, S2, S3]) await d.ev(`window.confirm = () => true; window.alert = () => {}; 1`);

  // ═════ A. 과제함 ═════
  await T.ev(`nav('assign', document.getElementById('nav-assign')); 1`);
  await until(T, `!!document.querySelector('#assign-page .asg-toolbar')`, 5000);
  await T.press('.asg-toolbar .btn-sm');
  ok(await until(T, `!!document.querySelector('#asg-create .asg-create')`, 3000), 'A1 [+ 새 과제] → 만들기 창');
  const kindBtn = await T.ev(`(() => { const b = document.querySelector('#asg-c-kind .asg-seg[onclick*="music"]'); return b ? { dis: b.disabled, txt: b.textContent.trim() } : null; })()`);
  ok(kindBtn && kindBtn.dis === false && !/곧/.test(kindBtn.txt), 'A2 [🎵 음악실 리듬] 단추가 열려 있음(곧 아님)', JSON.stringify(kindBtn));
  await T.press('#asg-c-kind .asg-seg[onclick*="music"]');
  ok(await until(T, `document.querySelectorAll('#asg-pick-music .asg-mu-song').length === 15`, 6000), 'A3 곡 목록 15곡(음악실 library.js 를 그때 읽음)', await T.ev(`document.querySelectorAll('#asg-pick-music .asg-mu-song').length`));
  const songPress = await T.press(`#asg-pick-music .asg-mu-song[onclick*="lib_sola"]`);
  await sleep(200);
  const draftA = await T.ev(`({ m: _AS.draft.music, title: (document.querySelector('#asg-create input[maxlength]') || {}).value, on: document.querySelectorAll('#asg-pick-music .asg-mu-song.on').length, live: (document.querySelector('#asg-create .asg-seg.live') || {}).disabled })`);
  ok(songPress === true && draftA.m.song === 'lib_sola' && draftA.m.level === 'easy' && draftA.on === 1 && /솔·라·시 연습/.test(draftA.title || ''), 'A4 곡을 실제로 눌러 고름 · 이름 자동(곡 · 난이도)', JSON.stringify(draftA));
  ok(draftA.live === false, 'A5 리듬은 \'지금 모두 같이\'도 열림');
  await T.shot('A_create_music');
  const aidA = await T.ev(`_AS.draft.aid`);
  await T.press('#asg-send');
  ok(await until(T, `!!_AS.open[${JSON.stringify(aidA)}]`, 5000), 'A6 [과제함에 보내기] → open/<과제>');
  const defA = db(`classRPG_assign/open/${aidA}`) || {};
  ok(defA.kind === 'music' && defA.deliver === 'inbox' && defA.content && defA.content.music && defA.content.music.song === 'lib_sola', 'A7 정의: 음악 · 과제함 · 곡', JSON.stringify(defA.content));

  const cardOk = await Promise.all([S1, S2, S3].map(S => until(S, `!!document.querySelector('#main-area .asg-card') && document.querySelector('#main-area .asg-card').textContent.includes('솔·라·시')`, 6000)));
  ok(cardOk.every(Boolean), 'A8 학생 셋 홈 \'오늘\' 맨 위 선생님 과제 카드', JSON.stringify(cardOk));
  await S1.press('#main-area .asg-row');
  ok(await until(S1, `(document.getElementById('embed-frame') || {}).src && document.getElementById('embed-frame').src.includes('assign=${aidA}') && document.getElementById('m-embed').style.display === 'flex'`, 6000), 'A9 카드 → 학습 앱 창(음악실 ?assign=<과제>)',
    await S1.ev(`(document.getElementById('embed-frame') || {}).src`));
  ok(await untilFr(S1, '#embed-frame', `!!document.querySelector('.r-asg-chip') && location.hash === '#/rhythm/lib_sola'`, 15000), 'A10 앱이 그 곡 리듬을 바로 엶 · 정한 판 칩');
  const topA = await S1.fr('#embed-frame', `({ chip: document.querySelector('.r-asg-chip').textContent, sels: document.querySelectorAll('.top select').length, back: !!document.querySelector('.top .back, .top [title="뒤로"]'), note: (document.querySelector('.r-asg-note') || {}).textContent || '' })`);
  ok(topA && /쉬움 · 4키/.test(topA.chip) && topA.sels === 1 && /선생님 과제/.test(topA.note), 'A11 칩 \'👩‍🏫 쉬움 · 4키\' · 난이도/키 고르기 없음(음표 빠르기만) · 과제 안내 줄', JSON.stringify(topA));
  await S1.shot('A_s1_ready');
  //  학생1 · 학생2 — 같은 창을 debug 손잡이와 함께 다시 열고 친다(학생2 는 카드 대신 같은 함수)
  await S2.ev(`asgOpenInbox(${JSON.stringify(aidA)}); 1`);
  for (const S of [S1, S2]) await S.ev(FRAME_DEBUG('#embed-frame'));
  const rOk = await Promise.all([S1, S2].map(S => untilFr(S, '#embed-frame', `!!window.__rhythm && !!document.querySelector('.r-asg-chip')`, 15000)));
  ok(rOk.every(Boolean), 'A12 리듬 판 준비(학생1 · 학생2)', JSON.stringify(rOk));
  const n1 = await S1.fr('#embed-frame', BOT(1)), n2 = await S2.fr('#embed-frame', BOT(2));
  ok(n1 > 0 && n2 > 0, 'A13 [▶ 시작] → 소리 장치 시각에 맞춰 침(학생1 모든 음표 · 학생2 하나 걸러)', JSON.stringify({ n1, n2 }));
  await sleep(4000);
  await S1.shot('A_s1_play');
  const fin = await Promise.all([S1, S2].map(S => untilFr(S, '#embed-frame', `document.body.textContent.includes('선생님께 보냈어요')`, 60000)));
  ok(fin.every(Boolean), 'A14 끝까지 침 → \'선생님께 보냈어요 ✓\'', JSON.stringify(fin));
  const endA = await S1.fr('#embed-frame', `({ board: document.body.textContent.includes('우리 반 최고'), other: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '다른 곡'), again: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '다시 하기') })`);
  ok(endA && !endA.board && !endA.other && endA.again, 'A15 끝 화면: 우리 반 최고 판 없음 · [다른 곡] 없음 · [다시 하기] 있음', JSON.stringify(endA));
  await S1.shot('A_s1_done');
  await sleep(500);
  const c1 = db(`classRPG_assign/results/${aidA}/s1`) || {}, c2 = db(`classRPG_assign/results/${aidA}/s2`) || {};
  const b1 = c1.app && c1.app.detail && c1.app.detail.best, b2 = c2.app && c2.app.detail && c2.app.detail.best;
  ok(b1 && c1.app.score === Math.round(b1.acc) && c1.app.total === 100 && c1.app.attempts === 1 && typeof c1.doneAt === 'number' && typeof c1.startedAt === 'number' && c1.app.detail.first && b1.acc >= 80,
    'A16 서버 칸(학생1): 점수 = 정확도 · 100 · 판 수 1 · best · first · startedAt · doneAt', JSON.stringify(c1).slice(0, 400));
  ok(b2 && b2.acc < b1.acc && b2.miss > 0 && c2.app.attempts === 1, 'A17 서버 칸(학생2): 하나 걸러 친 만큼 낮은 정확도 · 놓침 있음', JSON.stringify(b2));
  ok(!db(`classRPG_assign/results/${aidA}/s3`) && !db('classRPG_v3/problemRecords') && !db(`classRPG_assign/mine/s1/${aidA}`), 'A18 학생3 칸 없음 · problemRecords · 숙달도 칸 0(리듬은 문제 기록 아님)');
  //  다시 하기 — 판 수 2 · first 그대로
  const firstAcc = c1.app.detail.first.acc;
  await S1.fr('#embed-frame', `(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '다시 하기').click(); return 1; })()`);
  await sleep(300);
  await S1.fr('#embed-frame', `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('▶ 시작')); return !!b; })()`);
  //  [다시 하기]는 바로 시작한다(준비 화면 없음) → 그 판은 아무것도 안 침 = 판 수만 · 끝 아님
  await untilFr(S1, '#embed-frame', `window.__rhythm.state() === 'done'`, 60000);
  await sleep(1200);
  const c1b = db(`classRPG_assign/results/${aidA}/s1`) || {};
  ok(c1b.app && c1b.app.attempts === 2 && c1b.app.detail.first.acc === firstAcc && c1b.app.detail.best.acc === b1.acc && c1b.app.score === c1.app.score && c1b.doneAt === c1.doneAt,
    'A19 다시 하기(이번엔 안 침) → 판 수 2 · 점수 · best · first · doneAt 그대로(나쁜 판이 안 덮음)', JSON.stringify(c1b.app));
  await S1.ev(`closeExternalEmbed(); 1`);
  await S2.ev(`closeExternalEmbed(); 1`);
  //  교사 결과 표
  await T.ev(`_AS.mask = false; if (_AS.sel !== ${JSON.stringify(aidA)}) assignSelect(${JSON.stringify(aidA)}); else _assignRenderBits(true); 1`);   // assignSelect 는 펼침/접기 — 보낸 뒤 이미 펼쳐져 있을 수 있음
  ok(await until(T, `!!document.querySelector('#asg-result .asg-mu-sum')`, 5000), 'A20 결과 열기 → 음악용 결과 칸');
  await until(T, `document.querySelectorAll('#asg-result .asg-table tbody tr').length === 5`, 5000);
  const tbl = await T.ev(`({ head: [...document.querySelectorAll('#asg-result .asg-table thead th')].map(t => t.textContent.trim()), rows: [...document.querySelectorAll('#asg-result .asg-table tbody tr')].map(r => [...r.children].map(td => td.textContent.trim().replace(/\\s+/g, ' '))), sum: (document.querySelector('#asg-result .asg-mu-sum') || {}).textContent || '' })`);
  if (!tbl || typeof tbl !== 'object') console.log('  표 읽기', tbl, await T.ev(`(document.getElementById('asg-result') || {}).innerHTML.slice(0, 600)`));
  const rowOf = n => ((tbl && tbl.rows) || []).find(r => r[0].startsWith(n));
  ok(tbl && tbl.head && tbl.head.join('|') === '이름|상태|정확도|판정|최대 콤보|처음 판|친 횟수|걸린 시간' && tbl.rows.length === 5, 'A21 결과 표 머리(정확도 · 판정 · 처음 판 · 친 횟수) · 명단 5줄', JSON.stringify(tbl && tbl.head));
  const r1 = rowOf('하늘'), r2 = rowOf('바다'), r3 = rowOf('구름');
  ok(r1 && r1[1] === '끝' && r1[2].startsWith(b1.acc + '%') && r1[6] === '2' && r2 && r2[1] === '끝' && r3 && r3[1] === '안 함' && r3[2] === '-',
    'A22 하늘 끝 · 정확도 · 친 횟수 2 / 바다 끝 / 구름 안 함', JSON.stringify([r1, r2, r3]));
  ok(tbl && /끝까지 친 아이 2 \/ 5/.test(String(tbl.sum).replace(/\s+/g, ' ')) && /정확도 평균/.test(tbl.sum), 'A23 위 줄: 끝까지 친 아이 2 / 5 · 정확도 평균 · 등급별 수', String(tbl && tbl.sum).replace(/\s+/g, ' ').slice(0, 200));
  const headA = await T.ev(`(document.querySelector('#asg-result .tc-title') || {}).textContent || ''`);
  ok(/끝 2/.test(headA) && !/평균 [\d.]+점/.test(headA), 'A23b [검토 반영] 결과 머리에 \'끝낸 아이 평균 N점\' 없음(평균은 위 줄 정확도 % 하나)', headA.replace(/\s+/g, ' ').slice(0, 160));
  const avgAdminA = (String(tbl && tbl.sum).match(/정확도 평균 ([\d.]+)%/) || [])[1];
  await T.shot('A_teacher_result');
  await T.ev(`_AS.mask = true; _assignRenderBits(true); 1`); await sleep(300);
  const masked = await T.ev(`document.querySelector('#asg-result .asg-table tbody').textContent`);
  ok(/이름 가리기 중/.test(masked) && !masked.includes(String(b1.acc) + '%'), 'A24 이름 가리기 중엔 정확도 숫자 숨김');
  await T.ev(`_AS.mask = null; _AS.sel = ''; _assignRenderBits(true); 1`);

  //  [검토 반영] 관리 화면을 새로 열면(만들기 칸을 안 열어도) 목록 종류 줄이 곡 제목 — 영어 열쇠(sola) 아님
  const T2 = await device('교사2', '/admin.html?auto');
  await until(T2, `document.getElementById('admin-app')?.style.display === 'grid' && typeof _AS !== 'undefined' && _AS.booted`, 25000);
  await T2.ev(`window.confirm = () => true; nav('assign', document.getElementById('nav-assign')); 1`);
  const fresh = await until(T2, `/🎵 리듬 · 솔·라·시 연습/.test((document.getElementById('assign-page') || {}).textContent || '')`, 10000);
  const freshTxt = await T2.ev(`((document.getElementById('assign-page') || {}).textContent || '').replace(/\s+/g, ' ')`);
  ok(fresh && !/🎵 리듬 · sola/.test(freshTxt), 'A25 [검토 반영] 새로 연 관리 화면 목록: \'🎵 리듬 · 솔·라·시 연습\'(영어 열쇠 아님)', (freshTxt.match(/🎵 리듬[^·]*·[^·]*/) || [''])[0]);
  await T2.shot('A_teacher2_list');
  await send('Target.closeTarget', { targetId: T2.targetId });
  await sleep(300);

  // ═════ B. 수업(각자 풀기) ═════
  //  학생2: 밑에 음악실(보통 모드) 리듬을 치는 중
  await S2.ev(`openExternalEmbed('music', '&debug=1#/rhythm/lib_star'); 1`);
  ok(await untilFr(S2, '#embed-frame', `!!window.__rhythm && !document.querySelector('.r-asg-chip')`, 15000), 'B0 학생2 밑에서 음악실 리듬(보통 모드 · 과제 아님) 준비');
  const s2pre = await S2.fr('#embed-frame', `(() => { [...document.querySelectorAll('button')].find(x => x.textContent.includes('▶ 시작')).click(); return window.__rhythm.state(); })()`);
  const emb2 = await S2.ev(`document.getElementById('embed-frame').src`);
  //  교사: 새 과제 → 리듬(도·레·미 연습 · 조금 느리게 아님) → 지금 모두 같이 → 보내기
  await T.ev(`assignNew(); 1`); await sleep(200);
  await T.press('#asg-c-kind .asg-seg[onclick*="music"]');
  await until(T, `document.querySelectorAll('#asg-pick-music .asg-mu-song').length === 15`, 6000);
  await T.press(`#asg-pick-music .asg-mu-song[onclick*="lib_dore"]`);
  await sleep(150);
  await T.press('#asg-create .asg-seg.live');
  await sleep(150);
  const metaB = await T.ev(`({ deliver: _AS.draft.deliver, pacing: _AS.draft.pacing, step: !!document.querySelector('#asg-create input[name=asg-pace][onchange*="step"]'), btn: document.getElementById('asg-send').textContent })`);
  ok(metaB.deliver === 'live' && metaB.pacing === 'self' && !metaB.step && /수업 시작/.test(metaB.btn), 'B1 지금 모두 같이 · 각자 풀기만(한 문제씩 없음)', JSON.stringify(metaB));
  await T.shot('B_create_live');
  await T.press('#asg-send');
  ok(await until(T, `!!(_AS.live && _AS.live.on && _AS.live.pacing === 'self')`, 6000), 'B2 수업 시작(live transaction · 각자 풀기)');
  const aidB = await T.ev(`_AS.live.aid`);
  const covered = await Promise.all([S1, S2, S3].map(S => until(S, `typeof classLiveIsOpen === 'function' && classLiveIsOpen() && !!document.querySelector('#class-live.asg-app-mode #asgl-app') && document.getElementById('asgl-app').src.includes('assign=${aidB}&live=1')`, 8000)));
  ok(covered.every(Boolean), 'B3 학생 셋 덮개 안에 리듬 앱 창(&assign=<과제>&live=1 · 덮개를 꽉 채움)', JSON.stringify(covered));
  ok(await untilFr(S1, '#asgl-app', `!!document.querySelector('.r-asg-chip') && /선생님과 리듬/.test(document.body.textContent)`, 15000), 'B4 덮개 안 앱: \'선생님과 리듬 · 도·레·미 연습\' · 칩');
  await sleep(600);
  const s2under = await S2.fr('#embed-frame', `window.__rhythm.state()`);
  const s2src = await S2.ev(`({ src: document.getElementById('embed-frame').src, emb: document.getElementById('m-embed').style.display })`);
  ok(s2pre === 'play' && s2under === 'ready' && s2src.src === emb2 && s2src.emb === 'flex', 'B5 학생2 밑의 리듬: 치던 판이 멈춤(play → ready) · 창은 그대로', JSON.stringify({ s2pre, s2under, s2src }));
  await S2.shot('B_s2_cover');
  //  못 나감: Esc · 뒤로
  for (const S of [S1, S2]) { await S.key('Escape'); await S.ev(`history.back(); 1`); await sleep(300); }
  ok((await Promise.all([S1, S2].map(S => S.ev(`classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'flex'`)))).every(v => v === true), 'B6 Esc · 뒤로 → 덮개 그대로');
  //  학생1 덮개 안에서 침
  await S1.ev(FRAME_DEBUG('#asgl-app'));
  ok(await untilFr(S1, '#asgl-app', `!!window.__rhythm && !!document.querySelector('.r-asg-chip')`, 15000), 'B7 덮개 안 리듬 준비');
  await sleep(700);
  ok(await S1.ev(`document.activeElement === document.getElementById('asgl-app')`) === true, 'B7b 다 읽힌 덮개 안 앱 창에 포커스(키 D F J K 가 그 창으로 · 포커스 지킴이가 안 뺏음)');
  const nB = await S1.fr('#asgl-app', BOT(1));
  ok(nB > 0, 'B8 [▶ 시작] → 침', String(nB));
  await sleep(3000); await S1.shot('B_s1_play');
  ok(await untilFr(S1, '#asgl-app', `document.body.textContent.includes('선생님께 보냈어요')`, 60000), 'B9 끝까지 침 → 선생님께 보냈어요 · 덮개 그대로');
  const liveNote = await S1.fr('#asgl-app', `document.body.textContent.includes('선생님이 끝낼 때까지')`);
  ok(liveNote === true && await S1.ev(`classLiveIsOpen()`) === true, 'B10 \'선생님이 끝낼 때까지 기다려요\' · 아이는 못 나감');
  await sleep(600);
  const cB = db(`classRPG_assign/results/${aidB}/s1`) || {};
  ok(cB.app && cB.app.detail && cB.app.detail.best && typeof cB.doneAt === 'number' && cB.app.score >= 80, 'B11 서버 칸(덮개 안 앱 → 부모가 씀): best · doneAt', JSON.stringify(cB).slice(0, 300));
  //  교사 수업 띠 · TV
  await T.ev(`_AS.mask = false; _assignRenderBits(true); 1`); await sleep(400);
  const strip = await T.ev(`document.querySelector('#asg-live .asg-live-card') ? document.querySelector('#asg-live .asg-live-card').textContent.replace(/\\s+/g, ' ') : ''`);
  ok(/다 한 아이 1 \/ 5/.test(strip) && /끝까지 친 아이 1/.test(strip) && /정확도 평균/.test(strip), 'B12 교사 수업 띠: 다 한 아이 1 / 5 · 끝까지 친 아이 · 정확도 평균', strip.slice(0, 260));
  await T.shot('B_teacher_strip');
  const V = await device('TV', '/assign/index.html#/', { w: 1920, h: 1080 });
  ok(await until(V, `/끝낸 친구 1 \\/ 5/.test(document.body.textContent) && /정확도 평균/.test(document.body.textContent)`, 15000), 'B13 TV: 끝낸 친구 1 / 5 · 정확도 평균',
    await V.ev(`document.body.textContent.replace(/\\s+/g, ' ').slice(0, 200)`));
  ok(!/(하늘|바다|구름|별님|나무)/.test(await V.ev(`document.body.textContent`)), 'B14 TV 에 이름 0');
  await V.shot('B_tv');
  //  [검토 반영] TV 평균 = 관리 화면 평균(같은 셈 · 소수 한 자리)
  const tvTxt = await V.ev(`document.body.textContent`);
  const avgTv = (tvTxt.match(/정확도 평균 ([\d.]+)%/) || [])[1], avgStrip = (strip.match(/정확도 평균 ([\d.]+)%/) || [])[1];
  ok(avgTv && avgTv === avgStrip, 'B14b [검토 반영] TV 정확도 평균 = 관리 수업 띠 평균', JSON.stringify({ avgTv, avgStrip, avgAdminA }));
  //  [검토 반영] TV [이름 보이기] → 음악 화면에도 명단 차례 이름 · 다시 누르면 숨김
  const dots = await V.ev(`document.querySelectorAll('.tv-dots .tv-dot').length`);
  await V.ev(`[...document.querySelectorAll('.tv-ctl button')].find(b => /이름 보이기/.test(b.textContent)).click(); 1`);
  const shown = await until(V, `/✓ 하늘/.test(document.body.textContent) && /구름/.test(document.body.textContent)`, 6000);
  await V.shot('B_tv_names');
  await V.ev(`[...document.querySelectorAll('.tv-ctl button')].find(b => /이름 숨기기/.test(b.textContent)).click(); 1`);
  const hidden = await until(V, `!/(하늘|바다|구름)/.test(document.body.textContent)`, 6000);
  ok(dots === 5 && shown && hidden, 'B14c [검토 반영] TV 음악: 점 5 · [이름 보이기] → \'✓ 하늘\' … · [이름 숨기기] → 이름 0', JSON.stringify({ dots, shown, hidden }));
  await T.ev(`if (_AS.sel !== ${JSON.stringify(aidB)}) assignSelect(${JSON.stringify(aidB)}); 1`);
  ok(await until(T, `!!document.querySelector('#asg-result .asg-mu-sum') && /끝까지 친 아이 1/.test(document.querySelector('#asg-result .asg-mu-sum').textContent)`, 5000), 'B15 수업 과제 결과 표(음악용)');
  //  [검토 반영] 수업 중 한 아이만 빼기(보건실 · 화장실) — 음악 결과 표 이름 칸 [빼기] → 그 아이 덮개만 걷힘 · '빠짐' → [다시 넣기] → 다시 덮임
  const exBtns = await T.ev(`[...document.querySelectorAll('#asg-result .asg-table tbody tr button.asg-mini')].map(b => b.textContent.trim())`);
  ok(Array.isArray(exBtns) && exBtns.length === 5 && exBtns.every(t => t === '빼기'), 'B15b [검토 반영] 음악 결과 표 이름 칸마다 [빼기](5)', JSON.stringify(exBtns));
  const rowIdx = await T.ev(`[...document.querySelectorAll('#asg-result .asg-table tbody tr')].findIndex(r => r.textContent.includes('구름'))`);
  const pr1 = await T.press('#asg-result .asg-table tbody tr button.asg-mini', rowIdx);
  const s3out = await until(S3, `!classLiveIsOpen()`, 8000);
  const exRow = await until(T, `(() => { const r = [...document.querySelectorAll('#asg-result .asg-table tbody tr')].find(r => r.textContent.includes('구름')); return !!r && r.classList.contains('asg-ex') && r.textContent.includes('빠짐') && r.textContent.includes('다시 넣기'); })()`, 5000);
  const othersIn = (await Promise.all([S1, S2].map(S => S.ev(`classLiveIsOpen()`)))).every(v => v === true);
  ok(pr1 === true && s3out && exRow && othersIn, 'B15c [검토 반영] [빼기](구름) → 학생3 덮개만 걷힘 · 표에 \'빠짐\' · [다시 넣기] · 다른 아이 그대로', JSON.stringify({ pr1, s3out, exRow, othersIn }));
  await T.shot('B_teacher_excused');
  const pr2 = await T.press('#asg-result .asg-table tbody tr button.asg-mini', rowIdx);
  const s3in = await until(S3, `classLiveIsOpen() && !!document.querySelector('#class-live.asg-app-mode #asgl-app')`, 8000);
  ok(pr2 === true && s3in, 'B15d [검토 반영] [다시 넣기] → 학생3 다시 덮개(리듬 앱 창)', JSON.stringify({ pr2, s3in }));
  //  끝내기
  await T.ev(`assignLiveEnd(false); 1`);
  ok(await until(T, `!_AS.live.on`, 5000), 'B16 교사 [끝내기] → live 꺼짐');
  const closed = await Promise.all([S1, S2, S3].map(S => until(S, `!classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'none' && !document.getElementById('class-live').classList.contains('asg-app-mode')`, 6000)));
  ok(closed.every(Boolean), 'B17 학생 셋 덮개 걷힘', JSON.stringify(closed));
  const lf = await S1.ev(`(document.getElementById('asgl-app') || { src: 'gone' }).src`);
  ok(lf === 'about:blank' || lf === 'gone', 'B18 덮개 안 앱 창 = about:blank(소리 · 타이머 정지)', lf);
  await sleep(500);
  const back2 = await S2.ev(`({ src: document.getElementById('embed-frame').src, emb: document.getElementById('m-embed').style.display })`);
  const back2r = await S2.fr('#embed-frame', `window.__rhythm.state()`);
  ok(back2.src === emb2 && back2.emb === 'flex' && back2r === 'ready', 'B19 학생2 밑의 음악실 창 그대로(멈춘 판 = 준비 화면)', JSON.stringify({ back2, back2r }));
  const pauseNote = await S2.fr('#embed-frame', `document.body.textContent.includes('선생님과 수업 때문에 치던 판이 멈췄어요')`);
  ok(pauseNote === true, 'B19b [검토 반영] 밑의 리듬 준비 화면에 \'⏸ 선생님과 수업 때문에 치던 판이 멈췄어요 — ▶ 시작을 눌러 처음부터\'');
  await S2.shot('B_s2_back');
  ok(!!db(`classRPG_assign/archive/${aidB}`) && Object.keys(db(`classRPG_assign/results/${aidB}`) || {}).includes('s1'), 'B20 정의는 archive · 결과 칸 남음');

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
console.log(`음악실 리듬 과제 여러 기기 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
