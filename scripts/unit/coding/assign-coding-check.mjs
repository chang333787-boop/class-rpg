// 기초 코딩 선생님 과제 여러 기기 확인 [ASSIGN-CODING-1] — 공유 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 + 실제 SDK 9.23 + 실제 Blockly
//  기기: 교사(admin.html?auto) · 학생 셋(student.html?as=s1·s2·s3)
//   A 과제함: 교사가 만들기 창에서 [🧩 기초 코딩] → 2단원 펼쳐 판 둘(2-1 · 2-2)을 눌러 고르고 보냄 → 학생 홈 카드 → 학습 앱 창(?assign=) 이 첫 판을 바로 엶
//      → 학생1: 틀린 코드 한 번 · 맞는 코드 → 이긴 카드 '다음 과제 판' → 둘째 판 → 다 함 · 학생2: 다섯 번 틀림(막힘) · 학생3: 안 함
//      → 서버 결과 칸(판 기록 · 실행 수 · 푼 판 · doneAt) · 과제 판 코드는 다른 열쇠 · 교사 결과 표(명단 기준 · ★/실행/막힘 · 막힌 판 · 마지막 코드)
//   B 수업: 학생1 보통 코딩 창을 열어 둔 채 · 교사 [🔴 지금 모두 같이](기초 코딩 1-2 · 각자 풀기) → 모두 덮개 안 기초 코딩(&live=1) · 밑 창 그대로
//      → 학생1 덮개 안에서 풂 → 서버 결과 · 교사 수업 띠 '다 한 아이 1' · 뒤로 칸 안 쌓임 → 끝내기 → 덮개 걷힘 · iframe 뗌 · 밑 코딩 창 그대로
//   + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8852 DP=9552 node scripts/unit/coding/assign-coding-check.mjs   (FAKE_RTDB=<…/fake-rtdb/server.mjs> · 스크린샷 OUT=<폴더>)
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8852), DP = Number(process.env.DP || 9552);
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
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'assign-coding-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과'); await cleanup(); process.exit(2); }, 360000);
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
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
  const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
  const key = async (k) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 }, sessionId); };
  const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); };
  //  보이는 요소를 실제로 누른다(가운데 점이 그 요소인지 elementFromPoint 로 확인 → 마우스 눌림)
  const press = async (sel, idx = 0) => {
    const r = await ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getClientRects().length); const e = els[${idx}]; if (!e) return null;
      e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)) }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  //  iframe 안의 요소를 실제로 누른다(바깥 좌표 = iframe 자리 + 안쪽 자리 · 바깥 · 안쪽 모두 가운데 점 확인)
  const pressIn = async (frameSel, sel) => {
    const r = await ev(`(() => { const f = document.querySelector(${JSON.stringify(frameSel)}); if (!f || !f.contentDocument) return null; const d = f.contentDocument;
      const e = [...d.querySelectorAll(${JSON.stringify(sel)})].find(x => x.getClientRects().length); if (!e) return null;
      const b = e.getBoundingClientRect(), fb = f.getBoundingClientRect(); const ix = b.left + b.width / 2, iy = b.top + b.height / 2;
      const inner = d.elementFromPoint(ix, iy), outer = document.elementFromPoint(fb.left + ix, fb.top + iy);
      return { x: fb.left + ix, y: fb.top + iy, hit: !!inner && (inner === e || e.contains(inner)) && outer === f }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  //  iframe 안에서 식 하나
  const fev = (frameSel, x) => ev(`(() => { const f = document.querySelector(${JSON.stringify(frameSel)}); if (!f || !f.contentWindow) return 'noframe'; return f.contentWindow.eval(${JSON.stringify(x)}); })()`);
  return { name, ev, fev, shot, key, click, press, pressIn, sessionId, targetId };
}
const until = async (d, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(150); } return false; };
const untilIn = async (d, f, expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.fev(f, expr) === true) return true; await sleep(150); } return false; };
//  학습 앱 창 · 덮개 안 iframe 을 시험 손잡이(?debug=1)로 다시 연다(같은 주소 + debug — 뒤로 칸 안 생김)
const debugFrame = async (S, f) => { await S.ev(`(() => { const fr = document.querySelector(${JSON.stringify(f)}); fr.contentWindow.location.replace(fr.src + '&debug=1'); return 1; })()`); await sleep(400); };
//  코드를 넣고 ▶ 실행('바로' 빠르기) → 끝 글
const runCode = async (S, f, src) => { await S.fev(f, `__coding.load(${JSON.stringify(src)}); __coding.run(false); 1`); await sleep(200); return S.fev(f, '__coding.state().msg'); };

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
  //  기초 코딩: '바로' 빠르기 · 단원 안내 창은 이미 본 것으로(학생 기기 localStorage — iframe 과 같은 곳)
  for (const S of [S1, S2, S3]) await S.ev(`localStorage.setItem('coding.speed', '"instant"'); for (let u = 1; u <= 9; u++) localStorage.setItem('coding.intro.' + u, 'true'); window.confirm = () => true; 1`);
  await T.ev(`window.confirm = () => true; window.alert = () => {}; 1`);

  // ═════ A. 과제함 ═════
  await T.ev(`nav('assign', document.getElementById('nav-assign')); 1`);
  ok(await until(T, `!!document.querySelector('#assign-page .asg-toolbar')`, 5000), 'A0 관리 화면 📝 과제·수업 쪽');
  await T.press('.asg-toolbar .btn-sm');
  ok(await until(T, `!!document.querySelector('#asg-create .asg-create')`, 3000), 'A1 [+ 새 과제] → 만들기 창');
  const kindBtn = await T.press(`.asg-seg[onclick*="'kind','coding'"]`);
  ok(kindBtn === true && await until(T, `!!document.querySelector('#asg-pick-coding .asg-cd') && _AS.draft.kind === 'coding'`, 8000), 'A2 [🧩 기초 코딩] 단추가 열려 있고 누르면 판 고르기 칸(stages.js 를 불러옴)', String(kindBtn));
  const nStages = await T.ev(`_ASC.stages.length`);
  ok(nStages === 66, 'A3 판 목록 66판', String(nStages));
  await T.press('.asg-unit-h[onclick="assignCodingUnit(2)"]');
  await until(T, `!!document.querySelector('.asg-cd-stage[onclick*="\\'2-1\\'"]')`, 3000);
  const p1 = await T.press(`.asg-cd-stage[onclick*="'2-1'"]`); await sleep(120);
  const p2 = await T.press(`.asg-cd-stage[onclick*="'2-2'"]`); await sleep(120);
  const picked = await T.ev(`JSON.stringify(_AS.draft.coding.stages)`);
  ok(p1 === true && p2 === true && picked === '["2-1","2-2"]', 'A4 2단원을 펼쳐 판 둘을 실제로 눌러 고름(고른 차례)', picked);
  const liveBtn = await T.ev(`!document.querySelector('#asg-c-meta .asg-seg.live').disabled`);
  ok(liveBtn === true, 'A5 기초 코딩도 [🔴 지금 모두 같이] 단추가 열림');
  await T.shot('A_create_coding');
  const aidA = await T.ev(`_AS.draft.aid`);
  await T.press('#asg-send');
  ok(await until(T, `!!_AS.open[${JSON.stringify(aidA)}]`, 5000), 'A6 [과제함에 보내기] → open/<과제>', aidA);
  const defA = db(`classRPG_assign/open/${aidA}`) || {};
  ok(defA.kind === 'coding' && JSON.stringify(Object.values(defA.content.coding.stages)) === '["2-1","2-2"]' && defA.deliver === 'inbox', 'A7 정의: kind coding · 판 [2-1, 2-2] · 과제함', JSON.stringify(defA).slice(0, 200));
  ok((await Promise.all([S1, S2, S3].map(S => until(S, `!!document.querySelector('#main-area .asg-card') && document.querySelector('#main-area .asg-card').textContent.includes('기초 코딩 2판')`, 6000)))).every(Boolean), 'A8 학생 셋 홈에 선생님 과제 카드(기초 코딩 2판)');

  //  학생1 — 카드 → 학습 앱 창 → 첫 판(2-1)이 바로
  await S1.press('#main-area .asg-row');
  ok(await until(S1, `document.getElementById('m-embed') && document.getElementById('m-embed').style.display === 'flex' && /coding\\/index\\.html\\?sid=s1.*&assign=${aidA}/.test(document.getElementById('embed-frame').src)`, 5000), 'A9 카드를 누르면 학습 앱 창 coding/index.html?…&assign=<과제>');
  ok(await untilIn(S1, '#embed-frame', `location.hash === '#/s/2-1' && !!document.querySelector('.chip.asg-chip')`, 25000), 'A10 앱이 과제의 첫 판(2-1)을 바로 엶 · 윗줄 칩 "📝 선생님 과제 1/2"',
    JSON.stringify(await S1.fev('#embed-frame', `({ h: location.hash, chip: (document.querySelector('.chip.asg-chip') || {}).textContent, t: document.body.innerText.slice(0, 120) })`)));
  await sleep(500);
  ok(typeof (db(`classRPG_assign/results/${aidA}/s1`) || {}).startedAt === 'number', 'A11 처음 연 때(startedAt) — 부모 학생 화면이 내 칸에 씀');
  await debugFrame(S1, '#embed-frame');
  ok(await untilIn(S1, '#embed-frame', `typeof __coding !== 'undefined' && __coding.stage.id === '2-1'`, 25000), 'A12 (시험 손잡이) 2-1 판');
  await S1.shot('A_s1_stage1');
  const m1 = await runCode(S1, '#embed-frame', 'F F F');
  await sleep(900);
  let c1 = db(`classRPG_assign/results/${aidA}/s1`) || {};
  ok(/덜|못|모자|아직/.test(m1) && c1.app && c1.app.attempts === 1 && c1.app.detail['2-1'].ok === false && c1.app.detail['2-1'].tries === 1 && c1.app.detail['2-1'].why.short === 1, 'A13 틀린 코드 실행 → 실행 1 · 판 기록(못 풂 · 까닭 short)', m1 + ' ' + JSON.stringify(c1.app || {}).slice(0, 200));
  const m2 = await runCode(S1, '#embed-frame', '8(F)');
  await sleep(900);
  c1 = db(`classRPG_assign/results/${aidA}/s1`) || {};
  const d21 = (c1.app && c1.app.detail['2-1']) || {};
  ok(/성공/.test(m2) && d21.ok === true && d21.st === 3 && d21.tries === 2 && c1.app.score === 1 && c1.app.total === 2 && !c1.doneAt && /range\(8\)|8/.test(d21.py || ''), 'A14 맞는 코드 → 판 기록 ★3 · 실행 2 · 푼 판 1/2 · 마지막 코드', JSON.stringify(c1.app).slice(0, 300));
  const cd = db('classRPG_coding/code/s1') || {};
  ok(Object.keys(cd).some(k => k === '2-1__asg_' + aidA) && !cd['2-1'], 'A15 과제 판 코드는 다른 열쇠(2-1__asg_<과제>) — 아이의 원래 2-1 코드 자리는 그대로', JSON.stringify(Object.keys(cd)));
  const stt = db('classRPG_coding/stats/s1') || {};
  ok(stt['2-1__asg_' + aidA] && stt['2-1__asg_' + aidA].tries === 2 && !stt['2-1'], 'A16 실행 셈도 과제 열쇠에(막힘 지도 셈에 안 섞임)', JSON.stringify(stt));
  ok((db('classRPG_coding/progress/s1') || {})['2-1'], 'A17 푼 기록(progress)은 같은 판에 — 보통 화면에서도 푼 판');
  const histA = await S1.ev('history.length');
  const nx = await S1.pressIn('#embed-frame', '.win-card .btn.primary');
  ok(nx === true && await untilIn(S1, '#embed-frame', `typeof __coding !== 'undefined' && __coding.stage.id === '2-2'`, 15000), "A18 이긴 카드 '다음 과제 판 →' → 2-2", String(nx));
  await runCode(S1, '#embed-frame', 'F 3(L F R F)');
  await sleep(1000);
  c1 = db(`classRPG_assign/results/${aidA}/s1`) || {};
  ok(c1.app && c1.app.score === 2 && typeof c1.doneAt === 'number' && c1.app.detail['2-2'].ok === true, 'A19 둘째 판도 풂 → 푼 판 2/2 · doneAt', JSON.stringify(c1).slice(0, 200));
  const lastBtn = await S1.fev('#embed-frame', `(document.querySelector('.win-card .btn.primary') || {}).textContent`);
  ok(lastBtn === '📝 과제 목록으로', "A20 마지막 판의 이긴 카드 = '📝 과제 목록으로'", lastBtn);
  await S1.pressIn('#embed-frame', '.win-card .btn.primary');
  ok(await untilIn(S1, '#embed-frame', `!!document.querySelector('.asg-home') && document.querySelector('.asg-home .mine b').textContent === '2 / 2' && document.querySelectorAll('.asg-stage.done').length === 2`, 8000), 'A21 과제 쪽: 푼 판 2 / 2 · 두 판 모두 ★');
  await S1.shot('A_s1_asg_home');
  await S1.ev(`closeExternalEmbed(); 1`);
  ok(await until(S1, `document.querySelector('#main-area .asg-card').textContent.includes('다 했어요')`, 5000), 'A22 학습 앱 창을 닫으면 홈 카드 "다 했어요 ✓"');

  //  학생2 — 다섯 번 틀림(막힘) · 걸린 판에서 나감
  await S2.ev(`asgOpenInbox(${JSON.stringify(aidA)}); 1`);
  ok(await until(S2, `/assign=${aidA}/.test(document.getElementById('embed-frame').src)`, 5000), 'A23 학생2 과제 엶');
  await untilIn(S2, '#embed-frame', `location.hash === '#/s/2-1'`, 25000);
  await debugFrame(S2, '#embed-frame');
  await untilIn(S2, '#embed-frame', `typeof __coding !== 'undefined' && __coding.stage.id === '2-1'`, 25000);
  for (let k = 0; k < 5; k++) { await runCode(S2, '#embed-frame', k % 2 ? 'F F' : 'F F F'); await sleep(500); }
  await sleep(800);
  const c2 = db(`classRPG_assign/results/${aidA}/s2`) || {};
  ok(c2.app && c2.app.attempts === 5 && c2.app.detail['2-1'].tries === 5 && c2.app.detail['2-1'].ok === false && !c2.doneAt, 'A24 학생2 다섯 번 틀림 → 실행 5 · 판 기록 tries 5(막힘)', JSON.stringify(c2.app || {}).slice(0, 200));
  await S2.ev(`closeExternalEmbed(); 1`);

  //  교사 결과 표
  await T.ev(`_AS.mask = false; if (_AS.sel !== ${JSON.stringify(aidA)}) assignSelect(${JSON.stringify(aidA)}); else _assignRenderBits(true); 1`);   // 보낸 뒤 이미 골라져 있음(누르면 접힘)
  ok(await until(T, `!!document.querySelector('#asg-result .asg-cd-table')`, 5000), 'A25 교사 [결과] → 기초 코딩 결과 표');
  await sleep(400);
  const rows = await T.ev(`[...document.querySelectorAll('#asg-result .asg-cd-table tbody tr')].filter(r => !r.classList.contains('asg-rate')).map(r => [...r.children].map(td => td.textContent.trim().replace(/\\s+/g, ' ')))`);
  const byName = n => (rows || []).find(r => r[0].startsWith(n)) || [];
  const names = await T.ev(`DB.getStudents().map(s => s.id + ':' + s.name)`);
  const nm = sid => (names.find(x => x.startsWith(sid + ':')) || '').split(':')[1];
  const r1 = byName(nm('s1')), r2 = byName(nm('s2')), r3 = byName(nm('s3'));
  ok(rows.length >= 5 && r1[1] === '끝' && r1[2] === '2 / 2' && r1[5].startsWith('★★★') && r2[1] === '하는 중' && /✗ 실행 5 막힘/.test(r2[5]) && r2[7] === '2-1' && r3[1] === '안 함',
    'A26 명단 기준 표: 학생1 끝 2/2 ★★★ · 학생2 하는 중 · 2-1 ✗ 실행 5 막힘 · 막힌 판 2-1 · 학생3 안 함', JSON.stringify(rows));
  const sum = await T.ev(`(document.querySelector('#asg-result .asg-cd-table .asg-rate') || {}).textContent || ''`);
  ok(/푼 1/.test(sum) && /막힘 1/.test(sum) && /덜 감|나무에 부딪힘/.test(sum), 'A27 판마다: 푼 아이 · 막힌 아이 · 많이 한 실수', sum.replace(/\s+/g, ' '));
  await T.press('#asg-result .asg-cd-c.ok');
  ok(await until(T, `!!document.querySelector('#asg-result .asg-cd-py') && /8/.test(document.querySelector('#asg-result .asg-cd-py').textContent)`, 3000), 'A28 칸을 누르면 그 아이의 마지막 코드(글 코드)');
  await T.shot('A_teacher_result');
  const tvMasked = await T.ev(`(() => { _AS.mask = true; _assignRenderResult(); const t = document.querySelector('#asg-result').textContent; _AS.mask = false; _assignRenderResult(); return !t.includes(${JSON.stringify(nm('s1'))}) && t.includes('이름 가리기 중'); })()`);
  ok(tvMasked === true, 'A29 이름 가리기 — 이름 · 판 칸 · 코드 숨김');

  // ═════ B. 수업 모드 · 각자 풀기 ═════
  await S1.ev(`openExternalEmbed('coding'); 1`);
  await until(S1, `document.getElementById('m-embed').style.display === 'flex'`, 4000);
  const embSrc = await S1.ev(`document.getElementById('embed-frame').src`);
  const hist0 = await S1.ev('history.length');
  await T.press('.asg-toolbar .btn-sm');
  await until(T, `!!document.querySelector('#asg-create .asg-create')`, 3000);
  await T.press(`.asg-seg[onclick*="'kind','coding'"]`);
  await until(T, `!!document.querySelector('#asg-pick-coding .asg-cd')`, 5000);
  await T.press('.asg-unit-h[onclick="assignCodingUnit(1)"]'); await sleep(150);
  await T.press(`.asg-cd-stage[onclick*="'1-2'"]`); await sleep(120);
  await T.press('#asg-c-meta .asg-seg.live'); await sleep(150);
  const paceTxt = await T.ev(`document.querySelector('#asg-c-meta').textContent`);
  ok(/각자 풀기/.test(paceTxt) && !/한 문제씩 같이/.test(paceTxt), 'B1 기초 코딩 · 지금 모두 같이 → 진행은 각자 풀기만');
  const aidB = await T.ev(`_AS.draft.aid`);
  await T.press('#asg-send');
  ok(await until(T, `!!(_AS.live && _AS.live.on && _AS.live.aid === ${JSON.stringify(aidB)} && _AS.live.kind === 'coding' && _AS.live.pacing === 'self')`, 6000), 'B2 수업 시작(live: coding · 각자 풀기)');
  const lv = await Promise.all([S1, S2, S3].map(S => until(S, `classLiveIsOpen() && !!document.getElementById('asgl-frame') && /&assign=${aidB}&live=1/.test(document.getElementById('asgl-frame').src) && document.getElementById('class-live').classList.contains('asg-app')`, 8000)));
  ok(lv.every(Boolean), 'B3 학생 셋 모두 수업 덮개 · 덮개 안 기초 코딩 iframe(&assign=<과제>&live=1)', JSON.stringify(lv));
  const under = await S1.ev(`({ emb: document.getElementById('m-embed').style.display, src: document.getElementById('embed-frame').src })`);
  ok(under.emb === 'flex' && under.src === embSrc, 'B4 학생1 밑의 보통 코딩 창은 그대로(같은 주소)', JSON.stringify(under));
  ok(await untilIn(S1, '#asgl-frame', `location.hash === '#/s/1-2' && !!document.querySelector('.chip.asg-chip')`, 25000), 'B5 덮개 안 앱이 1-2 판을 바로 엶');
  await S1.key('Escape'); await sleep(300);
  ok(await S1.ev(`classLiveIsOpen() && !!document.getElementById('asgl-frame')`) === true, 'B6 Esc 로 못 나감');
  await S1.shot('B_s1_live_coding');
  await debugFrame(S1, '#asgl-frame');
  await untilIn(S1, '#asgl-frame', `typeof __coding !== 'undefined' && __coding.stage.id === '1-2'`, 25000);
  const mb = await runCode(S1, '#asgl-frame', 'F F F L F F');
  await sleep(1000);
  const cb = db(`classRPG_assign/results/${aidB}/s1`) || {};
  ok(/성공/.test(mb) && cb.app && cb.app.score === 1 && typeof cb.doneAt === 'number' && cb.app.detail['1-2'].ok === true, 'B7 덮개 안에서 풂 → 서버 결과(부모가 씀) · doneAt', JSON.stringify(cb).slice(0, 200));
  await S1.pressIn('#asgl-frame', '.win-card .btn.primary');
  ok(await untilIn(S1, '#asgl-frame', `!!document.querySelector('.asg-home') && /선생님이 끝낼 때까지/.test(document.querySelector('.asg-home').textContent) && !document.querySelector('.top .btn.small')`, 8000), "B8 다 하면 과제 쪽 '선생님이 끝낼 때까지…' · 다른 판 보기 단추 없음");
  ok(await S1.ev('history.length') === hist0 + 1, 'B9 덮개 안에서 판을 옮겨도 뒤로 칸이 늘지 않음(덮개 칸 하나만)', String(await S1.ev('history.length')) + ' vs ' + hist0);
  ok(await until(T, `/다 한 아이 1/.test(document.querySelector('#asg-live').textContent)`, 5000), "B10 교사 수업 띠 '다 한 아이 1'");
  await T.shot('B_teacher_band');
  await T.ev(`assignLiveEnd(false); 1`);
  const closed = await Promise.all([S1, S2, S3].map(S => until(S, `!classLiveIsOpen() && !document.getElementById('asgl-frame')`, 6000)));
  ok(closed.every(Boolean), 'B11 끝내기 → 덮개 걷힘 · 덮개 안 iframe 뗌', JSON.stringify(closed));
  const after = await S1.ev(`({ emb: document.getElementById('m-embed').style.display, src: document.getElementById('embed-frame').src, hist: history.state && history.state.embed })`);
  ok(after.emb === 'flex' && after.src === embSrc && after.hist === 'coding', 'B12 학생1 하던 자리 그대로(보통 코딩 창 · 뒤로 칸 embed)', JSON.stringify(after));

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
console.log(`기초 코딩 과제 여러 기기 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
