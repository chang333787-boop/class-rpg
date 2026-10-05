// 시연판 끝에서 끝 확인 [CLASS-DEMO-1] — server.mjs --demo 와 같은 서버(포트 셋 · 메모리 DB 하나) + 헤드리스 크롬 탭 하나에 시연판(/.fake/demo)
//  시연판 안의 네 칸(교사 관리 · TV · 학생 A · 학생 B = iframe)을 '선생님이 눌러 볼 순서' 그대로 누른다. 누르기는 화면 좌표의 실제 마우스
//  (칸의 줄임 배율 · 칸 안 iframe 까지 셈 · 가운데 점이 그 요소인지 elementFromPoint 로 확인). 리듬 치기 · 코딩 코드 넣기만 앱의 시험 손잡이(&debug=1).
//   1 과제함: 수학 자동 뽑기 5문제 → 학생 A 카드로 다섯 문제 풂 → 교사 결과 표(A 끝 5/5 · B 안 함) · 맞힌 비율 → 분포
//   2 수업: A 오늘의 학습 2번째 문제 · B 꾸미기 전체 화면 → 교사 직접 고르기 3문제 · 지금 모두 같이 · 한 문제씩 → 덮개 · TV 따라감
//      → 첫 문제 · 답(A 맞음 · B 틀림) · 답 공개 · TV 막대 → … 정리 → 끝내기 → A 학습 같은 문제 · B 꾸미기 그대로
//   3 영어 직접 고르기(소리 문제 포함) → 학생 B 풂 → 결과
//   4 기초 코딩 1-1 · 1-2 → 학생 A 코딩 창(그 판 바로) → 두 판 풂 → 교사 결과(★ · 마지막 코드)
//   5 음악실 리듬(솔·라·시 연습) → 학생 B 끝까지 침 → 교사 결과(정확도) → 교사 [TV] 단추 → 새 창 대신 TV 칸이 그 과제로
//   + 시연판 [⤢ 크게] · 운영 주소 요청 0 · 페이지 오류 0
//  실행(저장소 = 과제 · 코딩 · 음악 갈래를 합친 폴더):  DP=9554 BASE=8872 OUT=<스크린샷 폴더> node scripts/unit/fake-rtdb/demo-check.mjs
//  포트(BASE · BASE+1 · BASE+2 · DP)는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const BASE = Number(process.env.BASE || 8872), DP = Number(process.env.DP || 9554);
const OUT = process.env.OUT || '';
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 300) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });
for (const f of ['admin/assign.js', 'student/assign.js', 'assign/index.html']) {
  if (!fs.existsSync(path.join(ROOT, f))) { console.log('SKIP 과제 · 수업이 없는 체크아웃: ' + f + ' 없음'); process.exit(0); }
}

const srv = await startServer({ port: BASE, host: '127.0.0.1', repo: ROOT, quiet: true, extraPorts: [BASE + 1, BASE + 2] });
const db = (p) => srv.store.get(p);
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'class-demo-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과'); await cleanup(); process.exit(2); }, 600000);

// ── CDP: 탭 하나 · 프레임마다 실행 문맥 ─────────────────────
const net = { all: 0, prod: [], ws: [], hosts: new Set() };
const errs = [];
const ctxOf = new Map(), frameOfCtx = new Map();
let ws, send, SID;
async function cdp() {
  let ver; for (let i = 0; i < 80; i++) { try { ver = await (await fetch(`http://127.0.0.1:${DP}/json/version`)).json(); break; } catch (e) {} await sleep(150); }
  ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  send = (method, params = {}, sessionId = SID) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    const P = m.params || {};
    if (m.method === 'Runtime.executionContextCreated' && P.context.auxData && P.context.auxData.isDefault) { ctxOf.set(P.context.auxData.frameId, P.context.id); frameOfCtx.set(P.context.id, P.context.origin); }
    if (m.method === 'Runtime.executionContextDestroyed') { for (const [f, c] of ctxOf) if (c === P.executionContextId) ctxOf.delete(f); }
    if (m.method === 'Runtime.executionContextsCleared') ctxOf.clear();
    if (m.method === 'Network.requestWillBeSent') { net.all++; try { const u = new URL(P.request.url); if (/^https?:$/.test(u.protocol)) net.hosts.add(u.host); } catch (e) {} if (PROD.test(P.request.url)) net.prod.push(P.request.url); }
    if (m.method === 'Network.webSocketCreated') { net.ws.push(P.url); if (PROD.test(P.url)) net.prod.push('WS ' + P.url); }
    if (m.method === 'Runtime.exceptionThrown') errs.push((frameOfCtx.get(P.exceptionDetails.executionContextId) || '?') + ' ' + (P.exceptionDetails?.exception?.description || P.exceptionDetails?.text || '').split('\n').slice(0, 2).join(' ').slice(0, 220));
    if (m.method === 'Runtime.consoleAPICalled' && P.type === 'error') { const t = P.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 220); if (!/FIREBASE WARNING|favicon|Failed to load resource/.test(t)) errs.push((frameOfCtx.get(P.executionContextId) || '?') + ' console.error ' + t); }
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true, promptText: 'x' });   // 확인 창은 '확인'
  };
}
//  프레임 찾기 — 칸(교사 · tv · a · b) 또는 칸 안의 학습 앱 창(a/embed · b/embed · a/live)
async function frames() {
  const { frameTree } = await send('Page.getFrameTree');
  const out = [];
  const walk = (n, parent) => { out.push({ id: n.frame.id, url: n.frame.url, parent }); (n.childFrames || []).forEach(c => walk(c, n.frame.id)); };
  walk(frameTree, null);
  return out;
}
const PANE_URL = { teacher: `:${BASE}/admin.html`, tv: `:${BASE}/assign/index.html`, a: `:${BASE + 1}/student.html`, b: `:${BASE + 2}/student.html` };
async function frameId(key) {
  const fs_ = await frames();
  if (key === 'top') return fs_[0].id;
  const [pane, sub] = key.split('/');
  const pf = fs_.find(f => f.parent === fs_[0].id && f.url.includes(PANE_URL[pane]));
  if (!pf || !sub) return pf && pf.id;
  //  embed = 학습 앱 창(과제함) · live = 수업 덮개 안 앱 창
  const kids = fs_.filter(f => f.parent === pf.id && /\/(coding|music)\//.test(f.url));
  const k = sub === 'live' ? kids.find(f => /live=1/.test(f.url)) : kids.find(f => !/live=1/.test(f.url));
  return k && k.id;
}
async function ev(key, x) {
  for (let t = 0; t < 30; t++) {
    const fid = await frameId(key), ctx = fid && ctxOf.get(fid);
    if (ctx) {
      const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, contextId: ctx }).catch(e => ({ exceptionDetails: { text: String(e.message) } }));
      if (!r.exceptionDetails) return r.result.value;
      if (!/Cannot find context|context with specified id/i.test(r.exceptionDetails.text || '')) return 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300);
    }
    await sleep(150);
  }
  return 'ERR:frame ' + key;
}
const until = async (key, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(key, expr) === true) return true; await sleep(150); } return false; };
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
const typeText = (text) => send('Input.insertText', { text });
const keyPress = async (key, code, vk) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code: code || key, windowsVirtualKeyCode: vk || 0 }); };
//  칸 iframe(줄임 배율) → 탭 좌표. 칸 안 학습 앱 창이면 그 창 자리를 더한다
async function toTop(key, x, y) {
  const [pane, sub] = key.split('/');
  if (sub) {
    const sel = sub === 'live' ? '#asgl-frame, #asgl-app' : '#embed-frame';
    const o = await ev(pane, `(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return null; const b = f.getBoundingClientRect(); return { l: b.left, t: b.top }; })()`);
    if (!o || typeof o !== 'object') return null;
    x += o.l; y += o.t;
  }
  return ev('top', `(() => { document.querySelectorAll('.stage').forEach(s => { s.scrollTop = 0; s.scrollLeft = 0; }); const f = document.getElementById('f-${pane}'); const b = f.getBoundingClientRect(); const s = b.width / f.offsetWidth;
    const X = b.left + ${x} * s, Y = b.top + ${y} * s; return { x: X, y: Y, hit: document.elementFromPoint(X, Y) === f, s }; })()`);
}
//  보이는 요소를 실제로 누른다(그 문서 안 가운데 점 확인 → 탭 좌표 확인 → 마우스)
async function press(key, sel, idx = 0) {
  const r = await ev(key, `(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getClientRects().length); const e = els[${idx}]; if (!e) return null;
    e.scrollIntoView({ block: 'center', inline: 'nearest' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
    return { x, y, hit: !!hit && (hit === e || e.contains(hit)) }; })()`);
  if (!r || typeof r !== 'object') return 'none:' + sel;
  if (!r.hit) return 'covered:' + sel;
  if (key === 'top') { await click(r.x, r.y); return true; }
  const t = await toTop(key, r.x, r.y);
  if (!t || !t.hit) return 'pane-covered:' + sel;
  await click(t.x, t.y); return true;
}
//  누른 뒤 상태가 안 바뀌었으면 다시 누른다(누르는 사이 칸이 다시 그려지면 클릭이 빠질 수 있음 — 선생님도 한 번 더 누름)
async function pressUntil(key, sel, cond, tries = 3) {
  let r;
  for (let k = 0; k < tries; k++) { r = await press(key, sel); if (await until(key, cond, 2500)) return { r, tries: k + 1 }; }
  return { r, tries: 0 };
}
const big = async (pane, n) => { await press('top', `#big-${pane}`); await sleep(500); await shot(n); await press('top', `#big-${pane}`); await sleep(300); };

//  문제 하나 풀기(과제함 = i · 수업 = l) — 정답이면 그 답, 아니면 다른 보기 · 다른 수
async function solve(pane, inst, correct) {
  const P = inst === 'l' ? 'asgl' : 'asgi';
  const info = await ev(pane, `(() => { const st = _ASG.inst.${inst}; if (!st) return null; const sc = _asgScreen(st); if (sc.i == null || sc.i < 0) return null; const it = st.def.content.quiz.items[sc.i]; return { i: sc.i, type: it.type, a: it.a, choices: it.choices || null, ox: AssignCore.isOX(it) }; })()`);
  if (!info || typeof info !== 'object') return 'no-question:' + info;
  if (info.type === 'choice') {
    const ci = correct ? info.choices.indexOf(info.a) : info.choices.findIndex(c => c !== info.a);
    return press(pane, info.ox ? `#${P}-body .st-ox-btn` : `#${P}-body .asg-opt`, ci);
  }
  if (info.type === 'fraction') {
    const m = String(info.a).match(/^(?:(\d+)\s*[와과]?\s+)?(\d+)\/(\d+)$/);
    const v = correct && m ? { w: m[1] || '', n: m[2], d: m[3] } : { w: '', n: '1', d: '99' };
    for (const [k, val] of [['fw', v.w], ['fn', v.n], ['fd', v.d]]) { if (!val) continue; if (await press(pane, `#${P}-${k}`) === true) await typeText(val); }
    return press(pane, `#${P}-body .asg-ok`);
  }
  const r = await press(pane, `#${P}-input`);
  if (r !== true) return 'input:' + r;
  await typeText(correct ? String(info.a) : '987654');
  return press(pane, `#${P}-body .asg-ok`);
}
//  리듬 판 치기(시험 손잡이 window.__rhythm) — 모든 음표를 소리 장치 시각에 맞춰 누르고 뗌
const BOT = `(() => { const R = window.__rhythm; if (!R) return 'no-rhythm';
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('▶ 시작')); if (!b) return 'no-start';
  b.click(); const ch = R.chart(); clearInterval(window.__bot);
  window.__bot = setInterval(() => { if (R.state() !== 'play') return; const t = R.now();
    ch.forEach(c => { if (c._b) return; if (t >= c.t - 0.004) { c._b = 1; R.press(c.lane); setTimeout(() => R.release(c.lane), c.long ? c.d * 1000 + 40 : 50); } }); }, 3);
  return ch.length; })()`;
const frameDebug = (pane) => ev(pane, `(() => { const f = document.getElementById('embed-frame'); const u = f.src; if (!/debug=1/.test(u)) f.src = u.replace(/(#|$)/, '&debug=1$1'); return f.src; })()`);

try {
  await cdp();
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  ({ sessionId: SID } = await send('Target.attachToTarget', { targetId, flatten: true }, null));
  for (const [mth, p] of [['Runtime.enable'], ['Page.enable'], ['Network.enable'],
    ['Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*'] }],
    ['Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }]]) await send(mth, p || {});
  await send('Page.navigate', { url: `http://127.0.0.1:${BASE}/.fake/demo` });
  const pages = async () => (await send('Target.getTargets', {}, null)).targetInfos.filter(t => t.type === 'page').length;
  const tabs0 = await pages();   // 크롬을 켤 때 생긴 빈 탭 포함

  // ═════ 0. 시연판 ═════
  const tReady = await until('teacher', `document.getElementById('admin-app')?.style.display === 'grid' && typeof _AS !== 'undefined' && _AS.booted && _AS.connected`, 30000);
  const sReady = await Promise.all([['a', 's1'], ['b', 's2']].map(([k, sid]) => until(k, `typeof CUR !== 'undefined' && !!CUR && CUR.id === '${sid}' && document.getElementById('s-game').classList.contains('active') && typeof _ASG !== 'undefined' && _ASG.connected`, 30000)));
  const tvReady = await until('tv', `!!document.querySelector('#app') && document.querySelector('#app').textContent.length > 0 && !/비밀번호/.test(document.body.textContent)`, 20000);
  ok(tReady && sReady.every(Boolean) && tvReady, '0-1 시연판 네 칸 입장(교사 ?auto · 학생 A s1 · 학생 B s2 · TV 비밀번호 없이)', JSON.stringify({ tReady, sReady, tvReady }));
  const origins = await ev('top', `[...document.querySelectorAll('.stage iframe')].map(f => new URL(f.src).origin)`);
  ok(Array.isArray(origins) && new Set(origins).size === 3 && origins[0] === origins[1], '0-2 교사 · TV = 같은 출처 · 학생 A · B = 각자 다른 출처(포트 +1 · +2)', JSON.stringify(origins));
  const urls = await Promise.all(['teacher', 'tv', 'a', 'b'].map(k => ev(k, `firebase.app().options.databaseURL`)));
  ok(urls.every(u => /^http:\/\/127\.0\.0\.1:\d+\/\?ns=fake-rpg$/.test(u)), '0-3 네 칸 모두 databaseURL = 가짜 서버', urls.join(' | '));
  const names = await ev('top', `[document.getElementById('sub-a').textContent, document.getElementById('sub-b').textContent]`);
  ok(/하늘/.test(names[0]) && /바다/.test(names[1]), '0-4 학생 칸 이름표(하늘 · 바다)', JSON.stringify(names));
  await sleep(800);
  await shot('00_demo_start');
  //  시험 전용: 코딩 앱 처음 안내 · 빠르기(학생 A 출처의 localStorage)
  await ev('a', `localStorage.setItem('coding.speed', '"instant"'); for (let u = 1; u <= 9; u++) localStorage.setItem('coding.intro.' + u, 'true'); 1`);

  // ═════ 1. 과제함 — 수학 자동 5문제 ═════
  ok(await press('teacher', '#nav-assign') === true && await until('teacher', `!!document.querySelector('#assign-page .asg-toolbar')`, 5000), '1-1 교사: 메뉴 [과제·수업]');
  await press('teacher', '.asg-toolbar .btn-sm');
  ok(await until('teacher', `!!document.querySelector('#asg-create .asg-create')`, 4000), '1-2 [+ 새 과제] → 만들기 창');
  const r13 = [await press('teacher', `.asg-seg[onclick*="'how','auto'"]`)];
  await sleep(150); r13.push(await press('teacher', `.asg-chip-btn[onclick*="'n', 5"]`));
  await sleep(150); r13.push(await press('teacher', `button[onclick="assignDraw()"]`));
  await sleep(250);
  const d13 = await ev('teacher', `({ how: _AS.draft.how, n: _AS.draft.n, drawn: (_AS.draft.drawn || []).length, subject: _AS.draft.subject, deliver: _AS.draft.deliver })`);
  ok(r13.every(x => x === true) && d13.how === 'auto' && d13.n === 5 && d13.drawn === 5 && d13.subject === 'math' && d13.deliver === 'inbox', '1-3 수학 · 자동 뽑기 · 5 · [미리 뽑아 보기] → 5문제 · 과제함', JSON.stringify({ r13, d13 }));
  await big('teacher', '01_teacher_create_math5');
  const aid1 = await ev('teacher', `_AS.draft.aid`);
  await press('teacher', '#asg-send');
  ok(await until('teacher', `!!_AS.open[${JSON.stringify(aid1)}]`, 6000) && !!db(`classRPG_assign/open/${aid1}`), '1-4 [과제함에 보내기] → 열린 과제(서버)', aid1);
  ok(await until('a', `!!document.querySelector('#main-area .asg-row[onclick*="${aid1}"]')`, 8000) && await until('b', `!!document.querySelector('#main-area .asg-row[onclick*="${aid1}"]')`, 8000), '1-5 학생 A · B 홈 \'오늘\' 맨 위 선생님 과제 카드');
  await shot('02_cards');
  await press('a', `#main-area .asg-row[onclick*="${aid1}"]`);
  ok(await until('a', `!!document.querySelector('#m-assign.open #asgi-body .asg-q')`, 6000), '1-6 학생 A 카드 → 과제함 창 · 첫 문제');
  const st1 = [];
  for (let k = 0; k < 5; k++) {
    st1.push(await solve('a', 'i', true));
    await sleep(350);
    if (k === 0) await big('a', '03_a_first_answer');
    if (await ev('a', `!!document.querySelector('#asgi-body .asg-fb-title') && !document.querySelector('#asgi-body .asg-score')`)) { await press('a', '#asgi-body .asg-main-btn'); await sleep(250); }
  }
  const sc1 = await ev('a', `(document.querySelector('#asgi-body .asg-score') || {}).textContent || ''`);
  ok(st1.every(x => x === true) && /5 \/ 5/.test(sc1), '1-7 학생 A 다섯 문제를 눌러 풂 → 결과 5 / 5', JSON.stringify({ st1, sc1 }));
  await big('a', '04_a_done_5of5');
  await press('a', '#asgi-body .asg-main-btn');
  ok(await until('a', `!document.querySelector('#m-assign.open') && /다 했어요/.test(document.querySelector('#main-area .asg-card').textContent)`, 5000), '1-8 [닫기] → 카드 \'다 했어요 ✓\'');
  if (await ev('teacher', `!document.querySelector('#asg-result .asg-table')`)) await press('teacher', `#asg-lists button[onclick="assignSelect('${aid1}')"]`);
  await until('teacher', `document.querySelectorAll('#asg-result .asg-table tbody tr:not(.asg-rate)').length === 5`, 6000);
  const tb1 = await ev('teacher', `[...document.querySelectorAll('#asg-result .asg-table tbody tr')].filter(r => !r.classList.contains('asg-rate')).map(r => [...r.children].slice(0, 3).map(td => td.textContent.trim().replace(/\\s+/g, ' ')))`);
  const row = (t, n) => (Array.isArray(t) ? t : []).find(r => r[0].startsWith(n)) || [];
  ok(row(tb1, '하늘')[1] === '끝' && row(tb1, '하늘')[2] === '5/5' && row(tb1, '바다')[1] === '안 함', '1-9 교사 결과 표: 하늘 끝 5/5 · 바다 안 함(명단 5줄)', JSON.stringify(tb1));
  await press('teacher', '#asg-result .asg-c.rate', 0);
  ok(await until('teacher', `!!document.querySelector('#asg-result .asg-item') && /1번/.test(document.querySelector('#asg-result .asg-item').textContent)`, 4000), '1-10 맞힌 비율 칸 → 1번 문제 보기 분포');
  await big('teacher', '05_teacher_result_math5');

  // ═════ 2. 지금 모두 같이 · 한 문제씩 ═════
  //  밑에서 하던 일: A = 오늘의 학습 2번째 문제 · B = 꾸미기(마당) 전체 화면
  const pre = await ev('a', `(() => { openStudyModal(); startStudySession('math'); const p = STUDY_SESSION.questions[STUDY_SESSION.cur]; submitStudyAnswer(p.a); nextStudyQuestion(); window.__ss = STUDY_SESSION; return { cur: STUDY_SESSION.cur, q: STUDY_SESSION.questions[STUDY_SESSION.cur].id }; })()`);
  const preB = await ev('b', `(async () => { openHouseTab('deco'); await decoLoad(); openInteriorFullscreen(); DECO_SCENE = 'yard'; await new Promise(r => setTimeout(r, 900)); return { if: _ifMode, scene: DECO_SCENE }; })()`);
  ok(pre && pre.cur === 1 && preB && preB.if === true, '2-1 준비: A 오늘의 학습 2번째 문제 · B 꾸미기 전체 화면', JSON.stringify({ pre, preB }));
  await shot('06_before_live');
  await press('teacher', '.asg-toolbar .btn-sm');
  await until('teacher', `!!document.querySelector('#asg-create .asg-create')`, 4000);
  const pk = await ev('teacher', `(() => { const b = CurriculumUtils.problemsBySubject('math').filter(p => p.type === 'choice' && !p.passageId && !p.fig && (p.choices || []).length >= 3);
    const by = {}; for (const p of b) (by[p.unitId] = by[p.unitId] || []).push(p.id); const u = Object.keys(by).find(k => by[k].length >= 3); return { unit: u, ids: by[u].slice(0, 3) }; })()`);
  await press('teacher', `.asg-unit-h[onclick*="${pk.unit}"]`); await sleep(200);
  const pr2 = [];
  for (const id of pk.ids) { pr2.push(await press('teacher', `.asg-prow input[onchange*="${id}"]`)); await sleep(150); }
  pr2.push(await press('teacher', '#asg-c-meta .asg-seg.live')); await sleep(200);
  pr2.push(await press('teacher', `#asg-c-meta input[name=asg-pace][onchange*="step"]`)); await sleep(200);
  const d22 = await ev('teacher', `({ picked: _AS.draft.picked.length, deliver: _AS.draft.deliver, pacing: _AS.draft.pacing, btn: document.getElementById('asg-send').textContent })`);
  ok(pr2.every(x => x === true) && d22.picked === 3 && d22.deliver === 'live' && d22.pacing === 'step' && /수업 시작/.test(d22.btn), '2-2 교사: 직접 고르기 3문제 · 🔴 지금 모두 같이 · 한 문제씩', JSON.stringify({ pr2, d22 }));
  await big('teacher', '07_teacher_create_live');
  await press('teacher', '#asg-send');
  ok(await until('teacher', `!!(_AS.live && _AS.live.on && _AS.live.pacing === 'step')`, 8000), '2-3 [지금 보내고 수업 시작] → 수업 켜짐');
  const cov = await Promise.all(['a', 'b'].map(k => until(k, `typeof classLiveIsOpen === 'function' && classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'flex'`, 8000)));
  const tvLobby = await until('tv', `/곧 시작|기다|첫 문제/.test(document.body.textContent) || !!document.querySelector('.tv-q-text')`, 8000);
  ok(cov.every(Boolean) && tvLobby, '2-4 학생 A · B \'선생님과 수업 중\' 덮개 · TV 가 수업을 따라감', JSON.stringify({ cov, tvLobby }));
  await sleep(500);
  await shot('08_live_lobby');
  const ans = [];
  for (let q = 0; q < 3; q++) {
    await press('teacher', '#asg-live .btn-sm[onclick*="assignLiveNext"]');
    await until('teacher', `_AS.live.step === ${q} && _AS.live.phase === 'answer'`, 6000);
    await Promise.all(['a', 'b'].map(k => until(k, `!!document.querySelector('#asgl-body .asg-q')`, 6000)));
    await until('tv', `!!document.querySelector('.tv-q-text')`, 6000);
    ans.push(await solve('a', 'l', true), await solve('b', 'l', false));
    await sleep(500);
    if (q === 0) { await shot('09_live_q1_answered'); await big('teacher', '10_teacher_strip_q1'); }
    await press('teacher', '#asg-live .btn-sm.gold');
    await until('teacher', `_AS.live.phase === 'reveal'`, 5000);
    await Promise.all(['a', 'b'].map(k => until(k, `!!document.querySelector('#asgl-body .asg-fb-title')`, 6000)));
    await until('tv', `!!document.querySelector('.tv-ch.ok')`, 6000);
    if (q === 0) {
      const fb = await Promise.all(['a', 'b'].map(k => ev(k, `document.querySelector('#asgl-body .asg-fb-title').textContent`)));
      const bar = await ev('tv', `!!document.querySelector('.tv-ch.ok') && !/(하늘|바다)/.test(document.body.textContent)`);
      ok(fb[0] === '맞았어요!' && fb[1] === '아쉬워요' && bar === true, '2-5 [답 공개] → A 맞았어요 · B 아쉬워요 · TV 보기 막대(이름 없음)', JSON.stringify({ fb, bar }));
      await shot('11_live_q1_reveal');
      await big('tv', '12_tv_reveal');
    }
  }
  ok(ans.every(x => x === true), '2-6 세 문제 모두 A · B 가 눌러 답함', JSON.stringify(ans));
  await press('teacher', '#asg-live .btn-sm[onclick*="assignLiveNext"]');
  ok(await until('teacher', `_AS.live.phase === 'summary'`, 5000) && await until('a', `!!document.querySelector('#asgl-body .asg-score')`, 5000), '2-7 [정리 ▶] → 학생 정리 화면(점수)');
  await shot('13_live_summary');
  const aid2 = await ev('teacher', `_AS.live.aid`);
  await press('teacher', `#asg-live .btn-sm.danger[onclick="assignLiveEnd(false)"]`);
  ok(await until('teacher', `!_AS.live.on`, 6000), '2-8 [끝내기] → 수업 꺼짐');
  const unc = await Promise.all(['a', 'b'].map(k => until(k, `!classLiveIsOpen() && getComputedStyle(document.getElementById('class-live')).display === 'none'`, 6000)));
  await sleep(600);
  const backA = await ev('a', `({ same: STUDY_SESSION === window.__ss, cur: STUDY_SESSION && STUDY_SESSION.cur, open: document.getElementById('m-study').classList.contains('open') })`);
  const backB = await ev('b', `({ if: _ifMode, fs: document.getElementById('interior-fullscreen').style.display })`);
  ok(unc.every(Boolean) && backA.same && backA.cur === 1 && backA.open && backB.if === true && backB.fs !== 'none', '2-9 덮개 걷힘 → A 풀던 학습 2번째 문제 그대로 · B 꾸미기 그대로', JSON.stringify({ unc, backA, backB }));
  await shot('14_after_live_back');
  ok(Object.keys(db(`classRPG_assign/results/${aid2}`) || {}).sort().join() === 's1,s2' && !!db(`classRPG_assign/archive/${aid2}`), '2-10 서버: 결과 칸 A · B · 수업 과제는 닫은 과제로');
  //  다음 단계를 위해 하던 창을 닫고 홈으로(아이가 닫는 것과 같음)
  await ev('a', `closeStudyModal(); 1`);
  await ev('b', `closeInteriorFullscreen(); closeModal('m-house'); 1`);
  await sleep(400);

  // ═════ 3. 영어 — 직접 고르기 ═════
  await press('teacher', '.asg-toolbar .btn-sm');
  await until('teacher', `!!document.querySelector('#asg-create .asg-create')`, 4000);
  //  과목 고르기(선택 칸 = 값 바꾸고 change — 헤드리스는 목록 팝업을 못 누름)
  await ev('teacher', `(() => { const s = document.querySelector('#asg-c-what select'); s.value = 'english'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await sleep(250);
  const en = await ev('teacher', `(() => { const b = CurriculumUtils.problemsBySubject('english').filter(p => p.type === 'choice' && !p.passageId && (p.choices || []).length >= 2);
    const by = {}; for (const p of b) (by[p.unitId] = by[p.unitId] || []).push(p);
    const u = Object.keys(by).find(k => by[k].some(p => p.audio) && by[k].filter(p => !p.audio).length >= 2) || Object.keys(by).find(k => by[k].length >= 3);
    const L = by[u]; const a = L.find(p => p.audio); const rest = L.filter(p => p !== a).slice(0, a ? 2 : 3);
    return { unit: u, ids: [a, ...rest].filter(Boolean).map(p => p.id), audio: !!a, note: /오늘의 학습에서 숨겨/.test(document.querySelector('#asg-c-what').textContent) }; })()`);
  await press('teacher', `.asg-unit-h[onclick*="${en.unit}"]`); await sleep(200);
  const pr3 = [];
  for (const id of en.ids) { pr3.push(await press('teacher', `.asg-prow input[onchange*="${id}"]`)); await sleep(150); }
  const d3 = await ev('teacher', `({ s: _AS.draft.subject, n: _AS.draft.picked.length, audio: /소리 문제/.test(document.querySelector('#asg-c-meta').textContent) })`);
  ok(pr3.every(x => x === true) && d3.s === 'english' && d3.n === en.ids.length && en.note && (!en.audio || d3.audio), `3-1 교사: 영어 · 직접 고르기 ${en.ids.length}문제(소리 ${en.audio ? '있음' : '없음'}) · '오늘의 학습에서 숨긴 과목' 안내`, JSON.stringify({ pr3, d3, en }));
  await big('teacher', '15_teacher_create_english');
  const aid3 = await ev('teacher', `_AS.draft.aid`);
  await press('teacher', '#asg-send');
  await until('teacher', `!!_AS.open[${JSON.stringify(aid3)}]`, 6000);
  ok(await until('b', `!!document.querySelector('#main-area .asg-row[onclick*="${aid3}"]')`, 8000), '3-2 학생 B 카드');
  await press('b', `#main-area .asg-row[onclick*="${aid3}"]`);
  await until('b', `!!document.querySelector('#m-assign.open #asgi-body .asg-q')`, 6000);
  await big('b', '16_b_english_q1');
  const st3 = [];
  for (let k = 0; k < en.ids.length; k++) {
    st3.push(await solve('b', 'i', true)); await sleep(350);
    if (await ev('b', `!!document.querySelector('#asgi-body .asg-fb-title') && !document.querySelector('#asgi-body .asg-score')`)) { await press('b', '#asgi-body .asg-main-btn'); await sleep(250); }
  }
  const sc3 = await ev('b', `(document.querySelector('#asgi-body .asg-score') || {}).textContent || ''`);
  ok(st3.every(x => x === true) && new RegExp(`${en.ids.length} / ${en.ids.length}`).test(sc3), '3-3 학생 B 영어 문제를 눌러 풂 → 다 맞음', JSON.stringify({ st3, sc3 }));
  await press('b', '#asgi-body .asg-main-btn'); await sleep(300);
  if (await ev('teacher', `_AS.sel !== ${JSON.stringify(aid3)}`)) await press('teacher', `#asg-lists button[onclick="assignSelect('${aid3}')"]`);
  await until('teacher', `document.querySelectorAll('#asg-result .asg-table tbody tr:not(.asg-rate)').length === 5`, 6000);
  const tb3 = await ev('teacher', `[...document.querySelectorAll('#asg-result .asg-table tbody tr')].filter(r => !r.classList.contains('asg-rate')).map(r => [...r.children].slice(0, 3).map(td => td.textContent.trim().replace(/\\s+/g, ' ')))`);
  ok(row(tb3, '바다')[1] === '끝', '3-4 교사 결과: 바다 끝', JSON.stringify(tb3));

  // ═════ 4. 기초 코딩 — 판 보내기 ═════
  await press('teacher', '.asg-toolbar .btn-sm');
  await until('teacher', `!!document.querySelector('#asg-create .asg-create')`, 4000);
  await press('teacher', `.asg-seg[onclick*="'kind','coding'"]`);
  ok(await until('teacher', `!!document.querySelector('#asg-pick-coding .asg-cd') && _AS.draft.kind === 'coding'`, 10000), '4-1 교사: [🧩 기초 코딩] → 판 고르기');
  await press('teacher', '.asg-unit-h[onclick="assignCodingUnit(1)"]'); await sleep(200);
  const pr4 = [await press('teacher', `.asg-cd-stage[onclick*="'1-1'"]`)]; await sleep(150);
  pr4.push(await press('teacher', `.asg-cd-stage[onclick*="'1-2'"]`)); await sleep(150);
  const d4 = await ev('teacher', `JSON.stringify(_AS.draft.coding.stages)`);
  ok(pr4.every(x => x === true) && d4 === '["1-1","1-2"]', '4-2 1단원 판 둘(1-1 · 1-2)을 눌러 고름', JSON.stringify({ pr4, d4 }));
  await big('teacher', '17_teacher_create_coding');
  const aid4 = await ev('teacher', `_AS.draft.aid`);
  await press('teacher', '#asg-send');
  await until('teacher', `!!_AS.open[${JSON.stringify(aid4)}]`, 6000);
  ok(await until('a', `!!document.querySelector('#main-area .asg-row[onclick*="${aid4}"]')`, 8000), '4-3 학생 A 카드(기초 코딩 2판)');
  await press('a', `#main-area .asg-row[onclick*="${aid4}"]`);
  ok(await until('a/embed', `location.hash === '#/s/1-1' && !!document.querySelector('.chip.asg-chip')`, 25000), '4-4 학생 A 코딩 창이 1-1 판을 바로 엶 · \'📝 선생님 과제\' 칩');
  await big('a', '18_a_coding_stage1');
  await frameDebug('a'); await sleep(500);
  await until('a/embed', `typeof __coding !== 'undefined' && __coding.stage && __coding.stage.id === '1-1'`, 25000);
  const run = async (src) => { await ev('a/embed', `__coding.load(${JSON.stringify(src)}); __coding.run(false); 1`); await sleep(400); return ev('a/embed', '__coding.state().msg'); };
  const m41 = await run('F F F');
  await sleep(900);
  const nx = await press('a/embed', '.win-card .btn.primary');
  const on12 = await until('a/embed', `typeof __coding !== 'undefined' && __coding.stage.id === '1-2'`, 15000);
  const m42 = await run('F F F L F F');
  await sleep(1200);
  const c4 = db(`classRPG_assign/results/${aid4}/s1`) || {};
  ok(/성공/.test(m41) && nx === true && on12 && /성공/.test(m42) && c4.app && c4.app.score === 2 && typeof c4.doneAt === 'number', "4-5 1-1 풂 → 이긴 카드 '다음 과제 판' 실제로 누름 → 1-2 풂 → 서버 푼 판 2/2", JSON.stringify({ m41, nx, on12, m42, app: c4.app && { score: c4.app.score, attempts: c4.app.attempts } }));
  await big('a', '19_a_coding_done');
  await ev('a', `closeExternalEmbed(); 1`); await sleep(300);
  if (await ev('teacher', `_AS.sel !== ${JSON.stringify(aid4)}`)) await press('teacher', `#asg-lists button[onclick="assignSelect('${aid4}')"]`);
  ok(await until('teacher', `!!document.querySelector('#asg-result .asg-cd-table')`, 6000), '4-6 교사 [결과] → 기초 코딩 결과 표');
  await press('teacher', '#asg-result .asg-cd-c.ok');
  ok(await until('teacher', `!!document.querySelector('#asg-result .asg-cd-py')`, 4000), '4-7 ★ 칸을 누르면 그 아이의 마지막 코드');
  await big('teacher', '20_teacher_result_coding');

  // ═════ 5. 음악실 리듬 — 곡 보내기 ═════
  await press('teacher', '.asg-toolbar .btn-sm');
  await until('teacher', `!!document.querySelector('#asg-create .asg-create')`, 4000);
  await press('teacher', '#asg-c-kind .asg-seg[onclick*="music"]');
  ok(await until('teacher', `document.querySelectorAll('#asg-pick-music .asg-mu-song').length >= 10`, 8000), '5-1 교사: [🎵 음악실 리듬] → 곡 목록');
  await sleep(600);   // 곡 목록이 다 읽히면 칸을 한 번 다시 그린다
  const p5 = await pressUntil('teacher', `#asg-pick-music .asg-mu-song[onclick*="lib_sola"]`, `_AS.draft.music.song === 'lib_sola'`);
  await sleep(200);
  const d5 = await ev('teacher', `({ song: _AS.draft.music.song, title: document.querySelector('#asg-create input[maxlength]').value })`);
  ok(p5.r === true && p5.tries > 0 && d5.song === 'lib_sola' && /솔·라·시/.test(d5.title), `5-2 곡(솔·라·시 연습)을 눌러 고름 · 이름 자동${p5.tries > 1 ? ` (${p5.tries}번째 누름에 됨)` : ''}`, JSON.stringify({ p5, d5 }));
  await big('teacher', '21_teacher_create_music');
  const aid5 = await ev('teacher', `_AS.draft.aid`);
  await press('teacher', '#asg-send');
  await until('teacher', `!!_AS.open[${JSON.stringify(aid5)}]`, 6000);
  ok(await until('b', `!!document.querySelector('#main-area .asg-row[onclick*="${aid5}"]')`, 8000), '5-3 학생 B 카드(리듬)');
  await press('b', `#main-area .asg-row[onclick*="${aid5}"]`);
  ok(await until('b/embed', `!!document.querySelector('.r-asg-chip') && location.hash === '#/rhythm/lib_sola'`, 20000), '5-4 학생 B 음악실이 그 곡을 바로 엶 · 정한 판 칩');
  await big('b', '22_b_rhythm_ready');
  await frameDebug('b'); await sleep(500);
  await until('b/embed', `!!window.__rhythm && !!document.querySelector('.r-asg-chip')`, 15000);
  const nNotes = await ev('b/embed', BOT);
  await sleep(3500);
  await big('b', '23_b_rhythm_play');
  const fin5 = await until('b/embed', `document.body.textContent.includes('선생님께 보냈어요')`, 90000);
  const c5 = db(`classRPG_assign/results/${aid5}/s2`) || {};
  ok(nNotes > 0 && fin5 && c5.app && typeof c5.doneAt === 'number' && c5.app.score >= 80, `5-5 학생 B 끝까지 침(음표 ${nNotes}) → '선생님께 보냈어요' · 서버 정확도 ${c5.app && c5.app.score}%`, JSON.stringify(c5.app || {}).slice(0, 200));
  await ev('b', `closeExternalEmbed(); 1`); await sleep(300);
  if (await ev('teacher', `_AS.sel !== ${JSON.stringify(aid5)}`)) await press('teacher', `#asg-lists button[onclick="assignSelect('${aid5}')"]`);
  ok(await until('teacher', `!!document.querySelector('#asg-result .asg-mu-sum') && /끝까지 친 아이 1/.test(document.querySelector('#asg-result .asg-mu-sum').textContent)`, 6000), '5-6 교사 결과: 음악용 칸(끝까지 친 아이 1 · 정확도 평균)');
  await big('teacher', '24_teacher_result_music');
  //  교사 [TV] 단추 → 새 창 대신 TV 칸이 그 과제로
  const tvBtn = await press('teacher', `#asg-lists button[onclick="assignOpenTV('${aid5}')"]`);
  const tvTo = await until('tv', `location.hash === '#/a/${aid5}'`, 6000);
  const tabs = await pages();
  ok(tvBtn === true && tvTo && tabs === tabs0, '5-7 교사 [TV] → 새 창 없이 TV 칸이 그 과제 화면으로(새 탭 0)', JSON.stringify({ tvBtn, tvTo, tabs0, tabs }));
  await sleep(1200);
  await shot('25_tv_follows_music');

  // ── 네트워크 · 오류 ──
  ok(net.prod.length === 0, `운영 주소 요청 0 (전체 요청 ${net.all} · WebSocket ${net.ws.length}개 모두 127.0.0.1)`, net.prod.slice(0, 5).join(' | '));
  ok(net.ws.every(u => /^ws:\/\/127\.0\.0\.1:\d+\/\.ws/.test(u)), 'WebSocket 은 가짜 서버로만', [...new Set(net.ws.map(u => u.replace(/\?.*$/, '')))].join(' · '));
  const outside = [...net.hosts].filter(h => !/^127\.0\.0\.1:\d+$/.test(h));
  ok(outside.every(h => /^(www\.gstatic\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)$/.test(h)), '바깥 호스트는 SDK · 라이브러리 · 글꼴 파일뿐', [...net.hosts].join(', '));
  const errList = [...new Set(errs)];
  ok(errList.length === 0, '페이지 오류 · console.error 0', errList.slice(0, 6).join(' || '));
  ws.close();
} catch (e) {
  ok(false, '예외', e && e.stack);
}
clearTimeout(killer);
await cleanup();
const fails = results.filter(r => r[0] === 'FAIL');
console.log(`시연판 끝에서 끝 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
