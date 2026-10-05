// 과제 · 수업 여러 기기 확인 [CLASS-ASSIGN-1] [CLASS-LIVE-1] — 공유 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 + 실제 SDK 9.23
//  기기(서로 다른 브라우저 문맥): 교사(admin.html?auto) · 학생 셋(student.html?as=s1·s2·s3) · TV(assign/) · 늦게 들어온 학생(s4)
//   A 과제함: 교사가 만들기 창에서 문제 넷(보기 · 수 · 분수 · 글)을 직접 골라 보냄 → 학생 홈 카드 → 실제로 눌러 풂 → 결과 칸 · 교사 결과 표(명단 기준 · 분포)
//   B 수업: 학생1 오늘의 학습 3번 문제 푸는 중 · 학생2 전투 중 · 학생3 꾸미기 전체화면(바닥 칠함 · 저장 대기) + 코딩 학습 앱 창
//      → 교사 '지금 모두 같이 · 한 문제씩' → 모두 덮개(밑 상태 그대로 · Esc · 뒤로 · 밑 클릭 막힘 · 꾸미기 먼저 저장) → 늦게 로그인한 학생4 바로 덮개
//      → 문제 1: 셋이 답(정답 1 · 같은 오답 2) → 교사 분포 · 답 공개 → 학생 공개 화면 · TV 막대(가장 많이 고른 오답 주황) → 정리 → 끝내기
//      → 덮개 걷힘 · 하던 자리 그대로(학습 창 같은 문제 · 전투 · 꾸미기 · 코딩 창 · 뒤로 칸)
//      + [CLASS-LIVE-KEY-1] 덮개에 포커스(입력 칸 밖)일 때 Ctrl+Z · Delete 가 밑의 꾸미기 · document 처리기로 안 감
//   C 갇힘 방지: 교사 기기(관리 · TV)를 모두 닫고 끊긴 지 4분으로 → 학생 화면 풀림 → 관리 화면 다시 열면 다시 덮임
//      + 덮개 안 입력 칸의 Enter 는 그 칸(내기)까지 가고 document 로는 안 올라감
//   D [ASSIGN-END-INBOX-1] 과제함 과제를 수업으로 돌린 뒤 그냥 끝내기(관리 · TV E) → 과제함으로 되돌아감(안 한 아이 카드 그대로)
//   + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8871 DP=9551 node scripts/unit/assign/assign-live-check.mjs
//        (가짜 서버가 다른 체크아웃에 있으면 FAKE_RTDB=<…/fake-rtdb/server.mjs> · 스크린샷 OUT=<폴더>)
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8871), DP = Number(process.env.DP || 9551);
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
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'assign-live-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run',
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
async function device(name, url, { w = 1366, h = 610, mobile = false } = {}) {
  const { browserContextId } = await send('Target.createBrowserContext', {});
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  sessName[sessionId] = name;
  for (const [mth, p] of [['Runtime.enable'], ['Page.enable'], ['Network.enable'],
    ['Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*'] }],
    ['Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }]]) await send(mth, p || {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PP}${url}` }, sessionId);
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
  const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
  const key = async (k, mods = 0) => { const code = { Escape: 'Escape', ArrowLeft: 'ArrowLeft' }[k] || k; for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: k === 'Escape' ? 27 : k === 'ArrowLeft' ? 37 : 0, modifiers: mods }, sessionId); };
  const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); };
  //  보이는 요소를 실제로 누른다(가운데 점이 그 요소인지 elementFromPoint 로 확인 → 마우스 눌림)
  const press = async (sel, idx = 0) => {
    const r = await ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getClientRects().length && e.offsetParent !== null || getComputedStyle(e).position === 'fixed'); const e = els[${idx}]; if (!e) return null;
      e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)) }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  return { name, ev, shot, key, click, press, sessionId, targetId };
}
const until = async (d, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(120); } return false; };

try {
  await cdp();
  // ── 기기 ──
  const T = await device('교사', '/admin.html?auto');
  const S1 = await device('학생1', '/student.html?as=s1');
  const S2 = await device('학생2', '/student.html?as=s2');
  const S3 = await device('학생3', '/student.html?as=s3');
  const ready = async (S, sid) => until(S, `typeof CUR !== 'undefined' && !!CUR && CUR.id === '${sid}' && document.getElementById('s-game').classList.contains('active') && typeof _ASG !== 'undefined' && _ASG.sid === '${sid}' && _ASG.connected`, 25000);
  const tReady = await until(T, `document.getElementById('admin-app')?.style.display === 'grid' && typeof _AS !== 'undefined' && _AS.booted && _AS.connected`, 25000);
  const sReady = [await ready(S1, 's1'), await ready(S2, 's2'), await ready(S3, 's3')];
  ok(tReady && sReady.every(Boolean), '기기 입장(교사 · 학생 셋) — 가짜 서버', JSON.stringify({ tReady, sReady }));
  for (const d of [T, S1, S2, S3]) await d.ev(`window.confirm = () => true; window.alert = () => {}; 1`);
  await sleep(800);
  const hosts1 = db('classRPG_assign/hosts') || {};
  ok(Object.values(hosts1).some(h => h && h.on === true && h.w === 'admin'), '관리 화면 로그인 = 교사 기기 연결(hosts) 한 칸', JSON.stringify(hosts1));

  // ═════ A. 과제함 ═════
  await T.ev(`nav('assign', document.getElementById('nav-assign')); 1`);
  ok(await until(T, `!!document.querySelector('#assign-page .asg-toolbar')`, 5000), 'A0 관리 화면 📝 과제·수업 쪽 열림');
  //  만들기 창 — 실제 단추로: [+ 새 과제] → 수학 · 직접 고르기 → 단원 펼쳐 문제 넷 고르기
  await T.press('.asg-toolbar .btn-sm');
  ok(await until(T, `!!document.querySelector('#asg-create .asg-create')`, 3000), 'A1 [+ 새 과제] → 만들기 창');
  const pickIds = await T.ev(`(() => {
    const bank = CurriculumUtils.problemsBySubject('math');
    const want = [p => p.type === 'choice' && !p.fig && p.choices.length === 4, p => p.type === 'number', p => p.type === 'fraction', p => p.type === 'choice' && p.fig];
    return want.map(f => (bank.find(f) || {}).id);
  })()`);
  for (const id of pickIds) {
    const unit = await T.ev(`CurriculumUtils.allProblems().find(p => p.id === ${JSON.stringify(id)}).unitId`);
    await T.ev(`_AS.draft.openUnit = ''; 1`);
    await T.press(`.asg-unit-h[onclick*="${unit}"]`);
    await sleep(150);
    const r = await T.press(`.asg-prow input[onchange*="${id}"]`);
    if (r !== true) console.log('  고르기 실패', id, r);
    await sleep(120);
  }
  const picked = await T.ev(`JSON.stringify(_AS.draft.picked)`);
  ok(JSON.parse(picked).length === 4, 'A2 단원을 펼쳐 문제 넷을 실제로 눌러 고름(보기 · 수 · 분수 · 그림)', picked);
  await T.ev(`document.querySelector('#asg-create input[maxlength]').value = '분수 복습'; assignDraft('title', '분수 복습'); 1`);
  await T.shot('A_create');
  const aidA = await T.ev(`_AS.draft.aid`);
  const todoNum = async S => { const t = await S.ev(`(document.querySelector('#main-area .hs-head h2') || {}).textContent || ''`); const m = /할 일 (\d+)개/.exec(t); return m ? +m[1] : 0; };
  const todoBefore = await todoNum(S1);   // [ASG-TODO-FIRST-1] 첫 과제가 오면 '오늘 할 일' 이 하나 늘어야 한다(예전 시험은 숫자 꼴만 봐서 놓침)
  await T.press('#asg-send');
  ok(await until(T, `!!_AS.open[${JSON.stringify(aidA)}]`, 5000) && !!db(`classRPG_assign/open/${aidA}`), 'A3 [과제함에 보내기] → open/<과제> 하나(서버)', aidA);
  const defA = db(`classRPG_assign/open/${aidA}`);
  ok(defA && Object.values(defA.content.quiz.items).length === 4 && defA.deliver === 'inbox' && Object.keys(defA.roster).length === 5, 'A4 정의: 문항 사본 4 · 과제함 · 명단 5', JSON.stringify({ n: defA && Object.values(defA.content.quiz.items).length, roster: defA && Object.keys(defA.roster) }));
  //  두 번 눌러도 하나(멱등) — 같은 id 로 다시 set
  const openCount = Object.keys(db('classRPG_assign/open') || {}).length;
  ok(openCount === 1, 'A5 열린 과제 수 = 1');

  //  학생 홈 카드
  const cardOk = await Promise.all([S1, S2, S3].map(S => until(S, `!!document.querySelector('#main-area .asg-card') && document.querySelector('#main-area .asg-card').textContent.includes('분수 복습')`, 6000)));
  ok(cardOk.every(Boolean), 'A6 학생 셋 홈 \'오늘\' 맨 위에 선생님 과제 카드', JSON.stringify(cardOk));
  const todoAfter = await (async () => { for (let i = 0; i < 30; i++) { const n = await todoNum(S1); if (n === todoBefore + 1) return n; await sleep(100); } return todoNum(S1); })();
  ok(todoAfter === todoBefore + 1, 'A7 첫 과제가 오면 오늘 할 일 수가 하나 늘어남', `${todoBefore} → ${todoAfter}`);
  await S1.shot('A_home_card');
  //  학생1: 카드 → 과제함 창 → 넷 다 실제로 풂(정답)
  await S1.press('#main-area .asg-row');
  ok(await until(S1, `!!document.querySelector('#m-assign.open #asgi-body .asg-q')`, 5000), 'A8 카드를 누르면 과제함 창(학습 창과 같은 모양) · 첫 문제');
  await S1.shot('A_inbox_q1');
  const solve = async (S, inst, correct, wrongPick = 0) => {
    const P = inst === 'l' ? 'asgl' : 'asgi';
    const info = await S.ev(`(() => { const st = _ASG.inst.${inst}; const sc = _asgScreen(st); if (sc.i == null || sc.i < 0) return null; const it = st.def.content.quiz.items[sc.i]; return { i: sc.i, type: it.type, a: it.a, choices: it.choices || null, ox: AssignCore.isOX(it) }; })()`);
    if (!info || info === 'ERR') return 'no-question';
    if (info.type === 'choice') {
      const ci = correct ? info.choices.indexOf(info.a) : info.choices.findIndex((c, k) => c !== info.a && k >= wrongPick) ;
      const sel = info.ox ? `#${P}-body .st-ox-btn` : `#${P}-body .asg-opt`;
      const r = info.ox ? await S.press(sel, ci) : await S.press(sel, ci);
      return r === true ? 'ok' : 'press:' + r;
    }
    if (info.type === 'fraction') {
      const a = CurriculumParse(info.a);
      const val = correct ? a : { w: '', n: '1', d: '99' };
      await S.ev(`(() => { document.getElementById('${P}-fw').value = ${JSON.stringify(val.w)}; document.getElementById('${P}-fn').value = ${JSON.stringify(val.n)}; document.getElementById('${P}-fd').value = ${JSON.stringify(val.d)}; return 1; })()`);
      return (await S.press(`#${P}-body .asg-ok`)) === true ? 'ok' : 'press-frac';
    }
    await S.ev(`(() => { const el = document.getElementById('${P}-input'); el.focus(); el.value = ${JSON.stringify(correct ? info.a : '987654')}; return 1; })()`);
    return (await S.press(`#${P}-body .asg-ok`)) === true ? 'ok' : 'press-text';
  };
  function CurriculumParse(a) { const m = String(a).match(/^(?:(\d+)\s*[와과]?\s+)?(\d+)\/(\d+)$/); return m ? { w: m[1] || '', n: m[2], d: m[3] } : { w: String(a), n: '', d: '' }; }
  const steps1 = [];
  for (let k = 0; k < 4; k++) {
    steps1.push(await solve(S1, 'i', true));
    await sleep(250);
    const fb = await S1.ev(`!!document.querySelector('#asgi-body .asg-fb-title')`);
    if (fb) { if (k === 0) await S1.shot('A_inbox_feedback'); await S1.press('#asgi-body .asg-main-btn'); await sleep(200); }
  }
  ok(steps1.every(s => s === 'ok'), 'A9 학생1 넷 다 실제로 눌러 풂(보기 · 수 · 분수 · 그림)', steps1.join(','));
  await sleep(600);
  const c1 = db(`classRPG_assign/results/${aidA}/s1`) || {};
  const a1 = Object.values(c1.answers || {});
  ok(a1.length === 4 && a1.every(a => a.ok === true) && typeof c1.startedAt === 'number' && typeof c1.doneAt === 'number', 'A10 서버 결과 칸: 답 4 · 모두 맞음 · startedAt · doneAt(서버 시각)', JSON.stringify(c1).slice(0, 300));
  const m1 = db(`classRPG_assign/mine/s1/${aidA}`) || {};
  ok(m1.s === 'math' && Object.keys(m1.q || {}).length === 4, 'A11 숙달도 칸(mine/s1) 4문항 — problemRecords(classRPG_v3)에는 안 씀', JSON.stringify(m1).slice(0, 200));
  ok(!db('classRPG_v3/problemRecords'), 'A12 classRPG_v3/problemRecords 생기지 않음');
  const stars = await S1.ev(`(() => { invalidateMastery(); const id = _ASG.open[${JSON.stringify(aidA)}].content.quiz.items[0].id; return (masteryOf(id) || {}).lv; })()`);
  ok(stars === 1, 'A13 함께 푼 문제가 내 별(숙달도)에 들어감(1→★)', String(stars));
  const done1 = await S1.ev(`document.querySelector('#asgi-body .asg-score') ? document.querySelector('#asgi-body .asg-score').textContent : ''`);
  ok(/4 \/ 4/.test(done1), 'A14 다 하면 결과 화면 4 / 4', done1);
  await S1.shot('A_inbox_done');
  await S1.press('#asgi-body .asg-main-btn');
  ok(await until(S1, `!document.querySelector('#m-assign.open') && document.querySelector('#main-area .asg-card').textContent.includes('다 했어요')`, 4000), 'A15 [닫기] → 카드에 다 했어요 ✓');
  //  학생2: 둘만 풂(하나 틀림) · 학생3: 안 함
  await S2.ev(`asgOpenInbox(${JSON.stringify(aidA)}); 1`);
  await until(S2, `!!document.querySelector('#asgi-body .asg-q')`, 4000);
  const s2a = await solve(S2, 'i', false); await sleep(250); await S2.press('#asgi-body .asg-main-btn'); await sleep(150);
  const s2b = await solve(S2, 'i', true); await sleep(250);
  await S2.ev(`asgCloseInbox(); 1`);
  ok(s2a === 'ok' && s2b === 'ok', 'A16 학생2 두 문제(하나 틀림) 풀고 닫음', s2a + ',' + s2b);
  await sleep(600);
  //  교사 결과 표 — 명단 기준(안 한 아이도) · 상태 · 점수 · 1번 분포
  await T.ev(`_AS.mask = false; _assignRenderBits(true); 1`);
  await sleep(300);
  const tbl = await T.ev(`(() => { const rows = [...document.querySelectorAll('#asg-result .asg-table tbody tr')].filter(r => !r.classList.contains('asg-rate')); return rows.map(r => [...r.children].slice(0, 3).map(td => td.textContent.trim().replace(/\\s+/g, ' '))); })()`);
  const rowOf = n => (tbl || []).find(r => r[0].startsWith(n));
  ok(Array.isArray(tbl) && tbl.length === 5 && rowOf('하늘') && rowOf('하늘')[1] === '끝' && rowOf('하늘')[2] === '4/4' && rowOf('바다')[1] === '하는 중' && rowOf('구름')[1] === '안 함',
    'A17 교사 결과 표: 명단 5줄 · 하늘 끝 4/4 · 바다 하는 중 · 구름 안 함', JSON.stringify(tbl));
  await T.press('#asg-result .asg-c.rate', 0);
  await sleep(250);
  const dist = await T.ev(`document.querySelector('#asg-result .asg-item') ? document.querySelector('#asg-result .asg-item').textContent.replace(/\\s+/g, ' ').slice(0, 200) : ''`);
  ok(/1번/.test(dist) && /명/.test(dist), 'A18 맞힌 비율 칸을 누르면 그 문제의 보기 분포', dist);
  await T.shot('A_teacher_result');

  // ═════ B. 수업(한 문제씩) — 밑의 상태 보존 ═════
  //  학생1: 오늘의 학습 3번 문제 푸는 중(앞 두 문제 냄)
  const st1 = await S1.ev(`(async () => { openStudyModal(); startStudySession('math'); for (let k = 0; k < 2; k++) { const p = STUDY_SESSION.questions[STUDY_SESSION.cur]; submitStudyAnswer(p.a); nextStudyQuestion(); } window.__ss = STUDY_SESSION; return { cur: STUDY_SESSION.cur, n: STUDY_SESSION.answers.length, q: STUDY_SESSION.questions[STUDY_SESSION.cur].id }; })()`);
  //  학생2: 전투 중(내 차례)
  const bt2 = await S2.ev(`(() => { decideFirstTurn = () => 'player'; normalizeBattleDaily(CUR); CUR.battleDaily.used = 0; CUR.battleInProgress = null; BATTLE_DONE = false; startBattle('m1'); window.__bs = BATTLE_STATE; return !!BATTLE_STATE; })()`);
  //  학생3: 꾸미기 전체화면 · 바닥 3칸 칠함(0.4초 묶음 저장 대기 중) + 그 위에서 코딩 학습 앱 창
  const dc3 = await S3.ev(`(async () => { openHouseTab('deco'); await decoLoad(); openInteriorFullscreen(); DECO_SCENE = 'yard'; CUR_FLOOR_TILE = 'dirt'; await new Promise(r => setTimeout(r, 900));
    for (let i = 0; i < 3; i++) _paintFloor(4 + i, 5);
    clearTimeout(_decoSaveTimer); _decoSaveTimer = setTimeout(() => { _decoSaveTimer = null; DB.saveStudent(CUR); }, 600000);   // 묶음 저장이 아직 안 나간 상태로 붙잡아 둔다
    return { if: _ifMode, pending: !!_decoSaveTimer }; })()`);
  await S3.ev(`openExternalEmbed('coding'); 1`);
  await sleep(1500);
  const emb3 = await S3.ev(`document.getElementById('embed-frame').src`);
  ok(st1 && st1.cur === 2 && bt2 === true && dc3 && dc3.if === true && /coding\/index\.html/.test(emb3), 'B0 준비: 학생1 학습 3번째 · 학생2 전투 · 학생3 꾸미기(저장 대기) + 코딩 창', JSON.stringify({ st1, bt2, dc3, emb3 }));
  const floorBefore = JSON.stringify(db('classRPG_v3/students/s3/yardFloor') || {});
  //  교사: 만들기 → 사회 OX + 보기 문제(자동 뽑기 대신 직접) → 지금 모두 같이 · 한 문제씩
  await T.ev(`assignNew(); 1`); await sleep(200);
  await T.ev(`(() => { assignDraft('subject', 'social'); const b = CurriculumUtils.problemsBySubject('social'); const ox = b.find(p => p.cat === 'ox'); const ch = b.filter(p => p.type === 'choice' && p.cat !== 'ox' && !p.passageId).slice(0, 2); [ch[0], ox, ch[1]].forEach(p => assignPick(p.id, true)); assignDraft('deliver', 'live'); assignDraft('pacing', 'step'); return 1; })()`);
  await sleep(200);
  await T.shot('B_create_live');
  const aidDraftB = await T.ev(`_AS.draft.aid`);
  await T.press('#asg-send');
  ok(await until(T, `!!(_AS.live && _AS.live.on && _AS.live.pacing === 'step')`, 6000), 'B1 [지금 보내고 수업 시작] → live 켜짐(transaction) · 한 문제씩');
  const aidB = await T.ev(`_AS.live.aid`);
  await until(T, `!!_AS.open[_AS.live.aid]`, 5000);
  const liveB = db('classRPG_assign/live');
  ok(liveB && liveB.on === true && liveB.step === -1 && liveB.phase === 'lobby' && !!db(`classRPG_assign/open/${aidB}`), 'B2 서버: live(lobby) + 정의', JSON.stringify(liveB));
  const covered = await Promise.all([S1, S2, S3].map(S => until(S, `getComputedStyle(document.getElementById('class-live') || document.body).display === 'flex' && classLiveIsOpen()`, 6000)));
  ok(covered.every(Boolean), 'B3 학생 셋 모두 바로 수업 덮개(무엇을 하든)', JSON.stringify(covered));
  await sleep(500);
  for (const [S, n] of [[S1, 'B_s1_lobby'], [S2, 'B_s2_lobby'], [S3, 'B_s3_lobby']]) await S.shot(n);
  //  덮개 위 · 밑 상태 그대로
  const under1 = await S1.ev(`({ same: STUDY_SESSION === window.__ss, cur: STUDY_SESSION && STUDY_SESSION.cur, modal: document.getElementById('m-study').classList.contains('open') })`);
  const under2 = await S2.ev(`({ same: BATTLE_STATE === window.__bs, fin: BATTLE_STATE && BATTLE_STATE.finished, modal: document.getElementById('m-battle').classList.contains('open') })`);
  await sleep(600);
  const floorAfter = JSON.stringify(db('classRPG_v3/students/s3/yardFloor') || {});
  const under3 = await S3.ev(`({ if: _ifMode, pending: !!_decoSaveTimer, src: document.getElementById('embed-frame').src, emb: document.getElementById('m-embed').style.display })`);
  ok(under1.same && under1.cur === 2 && under1.modal, 'B4 학생1: 오늘의 학습 창 · 같은 세션 · 같은 문제(밑에 그대로)', JSON.stringify(under1));
  ok(under2.same && !under2.fin && under2.modal, 'B5 학생2: 전투 그대로(밑에 멈춤)', JSON.stringify(under2));
  ok(under3.if && !under3.pending && floorAfter !== floorBefore && under3.src === emb3 && under3.emb === 'flex', 'B6 학생3: 꾸미기 묶음 저장을 먼저 보냄(decoFlush) · 꾸미기 · 코딩 창 그대로', JSON.stringify({ under3, saved: floorAfter !== floorBefore }));
  //  못 나감: Esc · 뒤로(history.back) · 밑 클릭
  for (const S of [S1, S2, S3]) { await S.key('Escape'); await S.ev(`history.back(); 1`); await sleep(350); }
  const still = await Promise.all([S1, S2, S3].map(S => S.ev(`classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'flex'`)));
  const emb3b = await S3.ev(`({ src: document.getElementById('embed-frame').src, emb: document.getElementById('m-embed').style.display })`);
  ok(still.every(v => v === true), 'B7 Esc · 뒤로 → 덮개 그대로(아이는 못 나감)', JSON.stringify(still));
  ok(emb3b.src === emb3 && emb3b.emb === 'flex', 'B8 뒤로를 눌러도 밑의 코딩 창이 안 닫힘', JSON.stringify(emb3b));
  const hit = await S2.ev(`(() => { const e = document.elementFromPoint(683, 400); return !!e && !!e.closest('#class-live'); })()`);
  ok(hit === true, 'B9 화면 어디를 눌러도 덮개가 받음(밑 전투 단추에 안 닿음)');
  //  [CLASS-LIVE-KEY-1] 덮개에 포커스(입력 칸 밖) — Ctrl+Z · Delete 가 밑의 꾸미기 되돌리기 · document 듣기에 안 닿음
  const kz = await S3.ev(`(() => { window.__dk = 0; document.addEventListener('keydown', () => { window.__dk++; }); window.__yf = JSON.stringify(CUR.yardFloor || {});
    const el = document.getElementById('class-live'); el.focus(); return { focus: document.activeElement === el, fs: document.getElementById('interior-fullscreen').style.display, n: Object.keys(CUR.yardFloor || {}).length }; })()`);
  await S3.key('z', 2); await S3.key('Z', 2); await S3.key('Delete');
  await sleep(400);
  const kz2 = await S3.ev(`({ same: JSON.stringify(CUR.yardFloor || {}) === window.__yf, dk: window.__dk, open: classLiveIsOpen() })`);
  ok(kz && kz.focus && kz.fs !== 'none' && kz2.same && kz2.dk === 0 && kz2.open, 'B9b 덮개 포커스에서 Ctrl+Z · Delete → 밑 꾸미기 바닥 그대로 · document keydown 0번', JSON.stringify({ kz, kz2 }));
  //  늦게 로그인한 학생4 — 바로 덮개
  const S4 = await device('학생4', '/student.html?as=s4');
  ok(await until(S4, `typeof classLiveIsOpen === 'function' && classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'flex'`, 25000), 'B10 늦게 로그인한 학생4도 바로 수업 방');
  await S4.ev(`window.confirm = () => true; 1`);
  //  로비 → 첫 문제
  await T.press('#asg-live .btn-sm[onclick*="assignLiveNext"]');
  ok(await until(T, `_AS.live.step === 0 && _AS.live.phase === 'answer'`, 5000), 'B11 교사 [첫 문제 ▶] → 문제 1(transaction)');
  const asked = await Promise.all([S1, S2, S3, S4].map(S => until(S, `!!document.querySelector('#asgl-body .asg-q')`, 5000)));
  ok(asked.every(Boolean), 'B12 학생 넷 화면에 문제 1(같은 보기 차례)', JSON.stringify(asked));
  const orders = await Promise.all([S1, S2, S3].map(S => S.ev(`[...document.querySelectorAll('#asgl-body .asg-opt, #asgl-body .st-ox-btn')].map(b => b.textContent.trim()).join('|')`)));
  ok(new Set(orders).size === 1 && orders[0].length > 0, 'B13 보기 차례가 셋 모두 같음', orders[0].slice(0, 120));
  //  입력 중 live 이벤트(이름 켜기 · 10분 더)에도 화면을 다시 그리지 않음 — 덮개 DOM 이 그대로
  await S4.ev(`window.__q = document.querySelector('#asgl-body .asg-q'); 1`);
  await T.ev(`assignLiveNames(true); 1`); await sleep(300); await T.ev(`assignLiveExtend(); 1`); await sleep(400);
  ok(await S4.ev(`document.querySelector('#asgl-body .asg-q') === window.__q`), 'B14 수업 상태가 바뀌어도(TV 이름 · 10분 더) 문제 화면을 다시 그리지 않음(쓰던 답 보존)');
  //  답: 학생1 정답 · 학생2 · 학생3 같은 오답 · 학생4 안 냄
  const rs = [await solve(S1, 'l', true), await solve(S2, 'l', false, 0), await solve(S3, 'l', false, 0)];
  await sleep(500);
  ok(rs.every(r => r === 'ok'), 'B15 학생 셋이 실제로 눌러 답을 냄', rs.join(','));
  const sentView = await Promise.all([S1, S2, S3].map(S => S.ev(`!!document.querySelector('#asgl-body .asg-wait') && document.querySelector('#asgl-body').textContent.includes('답을 냈어요')`)));
  ok(sentView.every(Boolean), 'B16 낸 아이 화면: 답을 냈어요 — 정답 공개를 기다림', JSON.stringify(sentView));
  await sleep(300);
  const strip = await T.ev(`document.querySelector('#asg-live .asg-live-card') ? document.querySelector('#asg-live .asg-live-card').textContent.replace(/\\s+/g, ' ') : ''`);
  ok(/냈어요 3 \/ 4/.test(strip), 'B17 교사 수업 띠: 냈어요 3 / 4(들어온 아이 기준)', strip.slice(0, 260));
  await T.shot('B_teacher_strip');
  //  TV(새 문맥 — 관리 화면 문 표시가 없으니 비밀번호 'x' 를 묻는다)
  const V = await device('TV', '/assign/index.html#/', { w: 1920, h: 1080 });
  ok(await until(V, `!!document.querySelector('.tv-q-text')`, 15000), 'B18 TV 문(관리자 비밀번호) 통과 → 지금 수업을 따라감(문제 1)');
  await V.shot('B_tv_ask');
  await T.press('#asg-live .btn-sm.gold');
  ok(await until(T, `_AS.live.phase === 'reveal'`, 5000), 'B19 교사 [답 공개] → reveal');
  const rv = await Promise.all([S1, S2, S3, S4].map(S => until(S, `document.querySelector('#asgl-body .asg-fb-title') !== null`, 5000)));
  const rvTxt = await Promise.all([S1, S2, S4].map(S => S.ev(`document.querySelector('#asgl-body .asg-fb-title').textContent`)));
  ok(rv.every(Boolean) && rvTxt[0] === '맞았어요!' && rvTxt[1] === '아쉬워요' && rvTxt[2] === '이 문제는 못 냈어요', 'B20 학생 화면 공개: 맞았어요 · 아쉬워요 · 못 냈어요', JSON.stringify(rvTxt));
  ok(await until(V, `!!document.querySelector('.tv-ch.top') && !!document.querySelector('.tv-ch.ok') && /2명/.test(document.querySelector('.tv-ch.top').textContent)`, 5000), 'B21 TV: 보기별 막대 · 정답 초록 · 가장 많이 고른 오답(2명) 주황');
  const tvTalk = await V.ev(`document.querySelector('.tv-talk') ? document.querySelector('.tv-talk').textContent : ''`);
  ok(/2명/.test(tvTalk) && !/(하늘|바다|구름|별님)/.test(await V.ev(`document.body.textContent`)), 'B22 TV 이야기 줄 · 이름 0(TV 는 누가 골랐는지 안 보임)', tvTalk);
  await V.shot('B_tv_reveal');
  await S2.shot('B_s2_reveal');
  //  공개 뒤에 낸 답은 막힘(학생4)
  ok(await S4.ev(`(() => { _asgAnswer('l', 0, { ci: 0 }); return !AssignCore.ansAt(_ASG.cells[_ASG.inst.l.aid], 0); })()`), 'B23 공개 뒤에는 새로 못 냄');
  //  다음 · 다음 → 정리 · TV 키(→)로도
  await until(V, `!!document.querySelector('.tv-choices.reveal')`, 3000);   // TV 도 '0번 · 공개'를 본 뒤
  const rev0 = db('classRPG_assign/live/rev');
  await Promise.all([T.ev(`assignLiveNext(); 1`), V.key('ArrowRight')]);   // 같은 순간 — 둘 다 '0번 · 공개'를 보고 누름
  await sleep(1500);
  const lv24 = db('classRPG_assign/live');
  ok(lv24.step === 1 && lv24.phase === 'answer' && lv24.rev === rev0 + 1, 'B24 관리와 TV 가 같은 순간 [다음] — 한 칸만(transaction · 같은 단계일 때만)', JSON.stringify({ step: lv24.step, phase: lv24.phase, rev: lv24.rev, rev0 }));
  await T.ev(`assignLiveNext(); 1`); await until(T, `_AS.live.step === 2`, 4000);
  await T.ev(`assignLiveNext(); 1`);
  ok(await until(T, `_AS.live.phase === 'summary'`, 4000), 'B25 마지막 뒤 정리');
  ok(await until(S1, `!!document.querySelector('#asgl-body .asg-score')`, 4000), 'B26 학생 정리 화면(점수 · 다시 볼 문제)');
  await S1.shot('B_s1_summary'); await V.shot('B_tv_summary');
  //  끝내기
  await T.ev(`assignLiveEnd(false); 1`);
  ok(await until(T, `!_AS.live.on`, 5000), 'B27 교사 [끝내기] → live 꺼짐 · 정의는 닫은 과제로');
  const closed = await Promise.all([S1, S2, S3, S4].map(S => until(S, `!classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'none'`, 5000)));
  ok(closed.every(Boolean), 'B28 학생 넷 덮개 걷힘', JSON.stringify(closed));
  await sleep(700);
  const back1 = await S1.ev(`({ same: STUDY_SESSION === window.__ss, cur: STUDY_SESSION && STUDY_SESSION.cur, modal: document.getElementById('m-study').classList.contains('open'), body: document.body.style.overflow })`);
  const back2 = await S2.ev(`({ same: BATTLE_STATE === window.__bs, fin: BATTLE_STATE && BATTLE_STATE.finished, modal: document.getElementById('m-battle').classList.contains('open'), btn: !!document.querySelector('.bv2-atk:not([disabled])') })`);
  const back3 = await S3.ev(`({ if: _ifMode, src: document.getElementById('embed-frame').src, emb: document.getElementById('m-embed').style.display, hist: history.state && history.state.embed })`);
  ok(back1.same && back1.cur === 2 && back1.modal, 'B29 학생1: 하던 학습 3번째 문제로 돌아옴', JSON.stringify(back1));
  ok(back2.same && !back2.fin && back2.modal && back2.btn, 'B30 학생2: 전투로 돌아옴 · 내 차례 단추 살아 있음', JSON.stringify(back2));
  ok(back3.if && back3.src === emb3 && back3.emb === 'flex' && back3.hist === 'coding', 'B31 학생3: 코딩 창(같은 주소) · 그 밑 꾸미기 · 뒤로 칸(embed) 그대로', JSON.stringify(back3));
  //  학생1이 남은 오늘의 학습을 이어서 풀 수 있음 — 기록 · 하루 10문제 셈에 과제가 안 섞임
  const studyNext = await S1.ev(`(() => { const p = STUDY_SESSION.questions[STUDY_SESSION.cur]; submitStudyAnswer(p.a); return STUDY_SESSION.answers.length; })()`);
  const todayCnt = await S1.ev(`getTodayStudyRecords(CUR.id).filter(r => r.assign).length`);
  ok(studyNext === 3 && todayCnt === 0, 'B32 학습을 이어 풂(3번째 답) · 오늘의 학습 기록에 과제 기록 0', JSON.stringify({ studyNext, todayCnt }));
  await S1.shot('B_s1_back');
  const res = db(`classRPG_assign/results/${aidB}`) || {};
  ok(Object.keys(res).sort().join() === 's1,s2,s3' && db(`classRPG_assign/archive/${aidB}`) && !db(`classRPG_assign/open/${aidB}`), 'B33 결과 칸 = 낸 아이 셋 · 정의는 archive', Object.keys(res).join());

  // ═════ C. 갇힘 방지 — 교사 기기를 모두 닫음 ═════
  await T.ev(`(() => { const d = _assignBuildDef({ ...(() => { assignNew(); return _AS.draft; })(), subject: 'math', how: 'pick', picked: CurriculumUtils.problemsBySubject('math').filter(p => p.type === 'number').slice(0, 2).map(p => p.id), deliver: 'live', pacing: 'self', title: '갇힘 시험' }); _assignStartLive(d.def, 40, false, true); return 1; })()`);
  ok(await until(T, `!!(_AS.live && _AS.live.on && _AS.live.pacing === 'self')`, 6000), 'C1 각자 풀기 수업 시작');
  ok((await Promise.all([S1, S2].map(S => until(S, `classLiveIsOpen()`, 6000)))).every(Boolean), 'C2 학생 덮개');
  //  [CLASS-LIVE-KEY-1] 덮개 안 입력 칸의 Enter → 그 칸의 내기(asgSubmit)까지 감 · document 로는 안 올라감
  const aidC = await T.ev(`_AS.live.aid`);
  await until(S1, `!!document.querySelector('#class-live input.st-input')`, 5000);
  const inC = await S1.ev(`(() => { const i = document.querySelector('#class-live input.st-input'); if (!i) return null; window.__dk1 = 0; document.addEventListener('keydown', () => { window.__dk1++; }); i.focus(); i.value = '7'; return { focus: document.activeElement === i }; })()`);
  await S1.key('Enter');
  const sentC = await until(S1, `!!(_ASG.cells['${aidC}'] && AssignCore.ansAt(_ASG.cells['${aidC}'], 0))`, 5000);
  const dk1 = await S1.ev(`window.__dk1`);
  ok(inC && inC.focus && sentC && dk1 === 0, 'C2b 덮개 안 입력 칸 Enter → 답 냄 · document keydown 0번', JSON.stringify({ inC, sentC, dk1 }));
  await send('Target.closeTarget', { targetId: T.targetId });
  await send('Target.closeTarget', { targetId: V.targetId });
  await sleep(1500);
  const hs = db('classRPG_assign/hosts') || {};
  ok(Object.values(hs).every(h => h.on === false && typeof h.left === 'number'), 'C3 관리 · TV 를 닫으면 onDisconnect 가 끊긴 시각(서버)을 남김', JSON.stringify(hs).slice(0, 300));
  ok(await until(S1, `classLiveIsOpen() && document.getElementById('asgl-st-txt').textContent.includes('선생님 화면이 꺼졌어요')`, 4000), 'C4 끊긴 지 3분 전: 덮개 그대로 + "선생님 화면이 꺼졌어요 — 조금 기다려 볼게요"',
    JSON.stringify(await S1.ev(`({ st: _asgLiveState(), open: classLiveIsOpen(), txt: (document.getElementById('asgl-st-txt') || {}).textContent, hosts: _ASG.hosts, live: _ASG.live, now: _asgNow() })`)));
  //  끊긴 지 4분인 것처럼(서버 값의 left 를 4분 앞으로) — 어느 기기든 같은 셈이라 바로 풀림
  const back4 = Date.now() - 4 * 60000;
  await S1.ev(`(() => { const up = { 'live/startedAt': ${back4 - 2 * 60000}, 'live/resumeAt': ${back4 - 2 * 60000} }; for (const k of Object.keys(_ASG.hosts || {})) { up['hosts/' + k + '/left'] = ${back4}; up['hosts/' + k + '/at'] = ${back4 - 3 * 60000}; } return _asgRef('').update(up).then(() => 1); })()`);
  ok((await Promise.all([S1, S2].map(S => until(S, `!classLiveIsOpen()`, 6000)))).every(Boolean), 'C5 교사 기기가 3분 넘게 없음 → 두 학생 모두 풀림(같은 서버 시각 셈)',
    JSON.stringify(await S1.ev(`({ st: _asgLiveState(), hosts: _ASG.hosts, now: _asgNow() })`)));
  const T2 = await device('교사2', '/admin.html?auto');
  await until(T2, `typeof _AS !== 'undefined' && _AS.booted && _AS.connected`, 25000);
  ok((await Promise.all([S1, S2].map(S => until(S, `classLiveIsOpen()`, 8000)))).every(Boolean), 'C6 관리 화면을 다시 열면(빈 틈 4분 < 15분) 다시 덮임');
  await T2.ev(`window.confirm = () => true; assignLiveEnd(false); 1`);
  ok((await Promise.all([S1, S2].map(S => until(S, `!classLiveIsOpen()`, 6000)))).every(Boolean), 'C7 끝내기 → 풀림');

  // ═════ D. 과제함 과제 → [수업으로] → 그냥 끝내기 = 과제함으로 되돌림 [ASSIGN-END-INBOX-1] ═════
  const aidD = await T2.ev(`(async () => { assignNew(); const d = _AS.draft; Object.assign(d, { subject: 'math', how: 'pick', picked: CurriculumUtils.problemsBySubject('math').slice(4, 6).map(p => p.id), deliver: 'inbox' }); const aid = d.aid; await assignSend(); return aid; })()`);
  const hasCard = (S) => until(S, `_asgMyDefs().some(d => d.id === '${aidD}') && !!document.querySelector('.asg-row')`, 8000);
  ok(!!db(`classRPG_assign/open/${aidD}`) && await hasCard(S2), 'D1 과제함으로 보냄 → 학생2 홈 카드');
  await T2.ev(`assignStartFromGo('${aidD}', 'self'); 1`);
  ok(await until(T2, `!!(_AS.live && _AS.live.on && _AS.live.aid === '${aidD}')`, 6000) && (db(`classRPG_assign/open/${aidD}`) || {}).fromInbox === true, 'D2 [수업으로] → live 켜짐 · 정의에 fromInbox 표시');
  ok(await until(S2, `classLiveIsOpen()`, 6000), 'D3 학생2 덮개');
  await T2.ev(`assignLiveEnd(false); 1`);
  ok(await until(T2, `!_AS.live.on`, 6000), 'D4 관리 [끝내기] → live 꺼짐');
  await sleep(600);
  const oD = db(`classRPG_assign/open/${aidD}`);
  ok(oD && oD.deliver === 'inbox' && oD.pacing === 'self' && !oD.fromInbox && !db(`classRPG_assign/archive/${aidD}`), 'D5 과제는 과제함으로 되돌아감(archive 아님 · fromInbox 지움)', JSON.stringify(oD && { deliver: oD.deliver, pacing: oD.pacing, fromInbox: oD.fromInbox }));
  ok(await until(S2, `!classLiveIsOpen()`, 5000) && await hasCard(S2), 'D6 학생2(안 함) 홈 카드 그대로');
  //  TV 의 E(끝내기)도 같게 — 그리고 끝내기가 된 때만
  const V2 = await device('TV2', '/assign/index.html#/', { w: 1920, h: 1080 });
  await V2.ev(`window.confirm = () => true; 1`);
  await sleep(2500);
  await T2.ev(`assignStartFromGo('${aidD}', 'self'); 1`);
  ok(await until(T2, `!!(_AS.live && _AS.live.on && _AS.live.aid === '${aidD}')`, 6000), 'D7 다시 [수업으로]');
  await sleep(1500);
  await V2.key('e');
  ok(await until(T2, `!_AS.live.on`, 6000), 'D8 TV E → live 꺼짐');
  await sleep(800);
  const oD2 = db(`classRPG_assign/open/${aidD}`);
  ok(oD2 && oD2.deliver === 'inbox' && !oD2.fromInbox && !db(`classRPG_assign/archive/${aidD}`) && await hasCard(S2), 'D9 TV 끝내기도 과제함으로 되돌림 · 카드 그대로', JSON.stringify(oD2 && { deliver: oD2.deliver, fromInbox: oD2.fromInbox }));

  // ── 네트워크 · 오류 ──
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
console.log(`과제 · 수업 여러 기기 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
