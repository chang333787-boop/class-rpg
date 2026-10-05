// 가짜 RTDB 서버 + 실제 화면 + 실제 Firebase SDK 9.23 끝에서 끝 확인 [FAKE-RTDB-1]
//  헤드리스 크롬에 '기기' 다섯(서로 다른 브라우저 문맥 = 저장소·쿠키 따로): 교사(admin.html?auto) · 학생 둘(student.html?as=s1·s2) ·
//  키오스크 · 하위 앱(물감 연구소). 모두 이 서버의 같은 메모리 DB 를 쓴다.
//   ① 교사가 보상 승인 → 학생 화면 골드가 바뀌기까지(1초 안)
//   ② 학생이 퀘스트 신청 → 교사 대기 배지
//   ③ 꾸미기(바닥 10칸 칠하기) 저장 → 서버·교사 화면에 그대로
//   ④ 동시 저장(gold-sync-sim 의 earn 순서) — 학생 둘이 계속 벌고, 그 사이 교사가 둘 다 승인 → 유실 0
//   + 네트워크 기록: 운영 RTDB·Firestore·Storage 주소로 간 요청 0(막힌 시도까지 센다) · WebSocket 은 이 서버만
//  운영 주소는 세 겹으로 막는다: shim(주소 돌림) · Network.setBlockedURLs · host-resolver-rules.
//  실행: PP=8854 DP=9554 node scripts/unit/fake-rtdb/live-check.mjs   (CHROME=<크롬 경로> 로 바꿀 수 있음)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PP = Number(process.env.PP || 8854), DP = Number(process.env.DP || 9554);
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info || ''); };

const srv = await startServer({ port: PP, host: '127.0.0.1', quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-rtdb-chrome-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과'); await cleanup(); process.exit(2); }, 240000);

const net = { all: [], ws: [], prod: [] };
const errs = {};
try {
  let ver; for (let i = 0; i < 80; i++) { try { ver = await (await fetch(`http://127.0.0.1:${DP}/json/version`)).json(); break; } catch (e) {} await sleep(150); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map(); const sessName = {};
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    const who = sessName[m.sessionId] || '?';
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; net.all.push(who + ' ' + u); if (PROD.test(u)) net.prod.push(who + ' ' + u); }
    if (m.method === 'Network.webSocketCreated') { const u = m.params.url; net.ws.push(who + ' ' + u); if (PROD.test(u)) net.prod.push(who + ' WS ' + u); }
    if (m.method === 'Runtime.exceptionThrown') (errs[who] = errs[who] || []).push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').split('\n')[0].slice(0, 200));
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }, m.sessionId);
  };
  async function device(name, url) {
    const { browserContextId } = await send('Target.createBrowserContext', {});
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    sessName[sessionId] = name;
    for (const [mth, p] of [['Runtime.enable'], ['Page.enable'], ['Network.enable'],
      ['Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*'] }],
      ['Emulation.setDeviceMetricsOverride', { width: 1366, height: 610, deviceScaleFactor: 1, mobile: false }]]) await send(mth, p || {}, sessionId);
    await send('Page.navigate', { url: `http://127.0.0.1:${PP}${url}` }, sessionId);
    const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
    return { name, ev, sessionId };
  }
  const until = async (d, expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(100); } return false; };
  const server = (p) => srv.store.get(p);

  const T = await device('교사', '/admin.html?auto');
  const S1 = await device('학생1', '/student.html?as=s1');
  const S2 = await device('학생2', '/student.html?as=s2');
  const K = await device('키오스크', '/kiosk.html');
  const A = await device('물감앱', '/paint/');

  const tReady = await until(T, `document.getElementById('admin-app')?.style.display === 'grid'`);
  const s1Ready = await until(S1, `typeof CUR !== 'undefined' && CUR && CUR.id === 's1' && document.getElementById('hud-gold')?.textContent === '1000'`);
  const s2Ready = await until(S2, `typeof CUR !== 'undefined' && CUR && CUR.id === 's2'`);
  const kStu = (sid) => `Object.values(DB_DATA.students || {}).find(s => s && s.id === '${sid}')`;
  const kReady = await until(K, `typeof DB_DATA !== 'undefined' && !!DB_DATA && Object.values(DB_DATA.students || {}).length === 5`);
  const aReady = await until(A, `!!(window.firebase && firebase.apps.length)`);
  ok(tReady && s1Ready && s2Ready && kReady && aReady, '다섯 기기 입장(교사 ?auto · 학생 ?as= · 키오스크 · 물감앱)', JSON.stringify({ tReady, s1Ready, s2Ready, kReady, aReady }));
  const urls = await Promise.all([T, S1, K, A].map(d => d.ev(`firebase.app().options.databaseURL`)));
  ok(urls.every(u => u === `http://127.0.0.1:${PP}/?ns=fake-rpg`), 'databaseURL = 가짜 서버(교사·학생·키오스크·하위 앱)', urls.join(' | '));
  ok(await S1.ev(`!!DB._snaps`) === true, '학생 기기 = 노드별 구독 판(shallow REST 가 가짜 서버에서 됨)');
  await sleep(1500);

  // ① 교사 승인 → 학생 골드
  await S1.ev(`window.__seen = null; (function p(){ if (document.getElementById('hud-gold').textContent === '1050') { window.__seen = Date.now(); return; } setTimeout(p, 10); })(); 1`);
  const tA = await T.ev(`(() => { const t = Date.now(); approveSingle('s1', 'rw_demo1'); return t; })()`);
  await until(S1, `window.__seen !== null`, 5000);
  const seen = await S1.ev(`window.__seen`);
  const ms1 = seen ? seen - tA : null;
  ok(ms1 !== null && ms1 <= 1000, `① 교사 승인 → 학생 화면 골드 1000→1050 (${ms1}ms)`);
  ok(server('classRPG_v3/students/s1/gold') === 1050 && !(server('classRPG_v3/students/s1/pendingRewards')), '① 서버: 골드 1050 · 대기 보상 비움');

  // ② 학생 퀘스트 신청 → 교사 대기 배지
  await until(T, `getComputedStyle(document.getElementById('pending-badge')).display === 'none'`, 3000);
  await T.ev(`window.__badge = null; (function p(){ const b = document.getElementById('pending-badge'); if (b.style.display !== 'none' && b.textContent === '1') { window.__badge = Date.now(); return; } setTimeout(p, 10); })(); 1`);
  const tQ = await S2.ev(`(() => { const t = Date.now(); submitQuestFromMain('bq_read'); return t; })()`);
  await until(T, `window.__badge !== null`, 5000);
  const tb = await T.ev(`window.__badge`);
  ok(tb && tb - tQ <= 1000, `② 학생2 퀘스트 신청 → 교사 대기 배지 1 (${tb ? tb - tQ : '안 뜸'}ms)`);
  ok(await until(K, `Object.values(${kStu('s2')}.pendingRewards || {}).length === 1`, 3000), '② 키오스크도 같은 신청을 봄');

  // ③ 꾸미기 저장
  const deco = await S1.ev(`(async () => {
    openModal('m-house'); if (typeof renderHouse === 'function') renderHouse();
    if (typeof decoLoad === 'function') await decoLoad();
    DECO_SCENE = 'yard'; CUR_FLOOR_TILE = 'dirt';
    for (let i = 0; i < 10; i++) { _paintFloor(2 + i, 3); await new Promise(r => setTimeout(r, 40)); }
    await new Promise(r => setTimeout(r, 1500));
    const n = (o) => o && typeof o === 'object' ? Object.values(o).reduce((a, v) => a + n(v), 0) : (o ? 1 : 0);
    return { mem: n(CUR.yardFloor), gold: CUR.gold };
  })()`);
  await sleep(500);
  const cnt = (o) => o && typeof o === 'object' ? Object.values(o).reduce((a, v) => a + cnt(v), 0) : (o ? 1 : 0);
  const srvFloor = cnt(server('classRPG_v3/students/s1/yardFloor'));
  const tFloor = await T.ev(`(() => { const n = (o) => o && typeof o === 'object' ? Object.values(o).reduce((a, v) => a + n(v), 0) : (o ? 1 : 0); return n(DB.getStudent('s1').yardFloor); })()`);
  ok(deco && deco.mem === 10 && srvFloor === 10 && tFloor === 10 && server('classRPG_v3/students/s1/gold') === 1050, `③ 꾸미기 바닥 10칸 → 학생 ${deco && deco.mem} · 서버 ${srvFloor} · 교사 화면 ${tFloor} · 골드 그대로`, JSON.stringify(deco));
  await S1.ev(`typeof closeModal === 'function' && closeModal('m-house'); 1`);

  // ④ 동시 저장 — 학생 둘이 계속 벌고(gold-sync-sim earn 순서), 그 사이 교사가 둘 다 승인
  await S1.ev(`submitQuestFromMain('bq_jump'); 1`);
  await sleep(1200);
  const pr1 = (server('classRPG_v3/students/s1/pendingRewards') && Object.values(server('classRPG_v3/students/s1/pendingRewards'))) || [];
  const pr2 = (server('classRPG_v3/students/s2/pendingRewards') && Object.values(server('classRPG_v3/students/s2/pendingRewards'))) || [];
  const before = { s1: { g: server('classRPG_v3/students/s1/gold'), t: server('classRPG_v3/students/s1/totalGold') }, s2: { g: server('classRPG_v3/students/s2/gold'), t: server('classRPG_v3/students/s2/totalGold') } };
  const earnLoop = (n, g, gap) => `(async () => { for (let i = 0; i < ${n}; i++) {
      CUR.gold += ${g}; CUR.totalGold = (CUR.totalGold || 0) + ${g};
      DB.logGold(CUR.id, 'battle', ${g}); DB.saveStudent(CUR);
      await new Promise(r => setTimeout(r, ${gap})); } return true; })()`;
  const staleBefore = srv.stats.stale;
  const p1 = S1.ev(earnLoop(25, 3, 120));
  const p2 = S2.ev(earnLoop(18, 5, 170));
  await sleep(1000);
  await T.ev(`approveSingle('s1', ${JSON.stringify(pr1[0] && pr1[0].id)}); 1`);
  await sleep(500);
  await T.ev(`approveSingle('s2', ${JSON.stringify(pr2[0] && pr2[0].id)}); 1`);
  await Promise.all([p1, p2]);
  await sleep(2500);
  const want = { s1: before.s1.g + 25 * 3 + (pr1[0] ? pr1[0].gold : 0), s2: before.s2.g + 18 * 5 + (pr2[0] ? pr2[0].gold : 0) };
  const wantT = { s1: before.s1.t + 25 * 3 + (pr1[0] ? pr1[0].gold : 0), s2: before.s2.t + 18 * 5 + (pr2[0] ? pr2[0].gold : 0) };
  const got = { s1: server('classRPG_v3/students/s1/gold'), s2: server('classRPG_v3/students/s2/gold') };
  const gotT = { s1: server('classRPG_v3/students/s1/totalGold'), s2: server('classRPG_v3/students/s2/totalGold') };
  const views = { s1cur: await S1.ev(`CUR.gold`), s2cur: await S2.ev(`CUR.gold`), t1: await T.ev(`DB.getStudent('s1').gold`), t2: await T.ev(`DB.getStudent('s2').gold`), k1: await K.ev(`${kStu('s1')}.gold`) };
  ok(pr1.length === 1 && pr2.length === 1, '④ 준비: 두 학생 대기 보상 하나씩', `${pr1.length}/${pr2.length}`);
  ok(got.s1 === want.s1 && got.s2 === want.s2, `④ 동시 저장 유실 0 — 골드 s1 ${got.s1}/${want.s1} · s2 ${got.s2}/${want.s2}`);
  ok(gotT.s1 === wantT.s1 && gotT.s2 === wantT.s2, `④ 누적 골드 s1 ${gotT.s1}/${wantT.s1} · s2 ${gotT.s2}/${wantT.s2}`);
  ok(views.s1cur === want.s1 && views.t1 === want.s1 && views.k1 === want.s1 && views.s2cur === want.s2 && views.t2 === want.s2, '④ 모든 화면이 같은 값으로 모임', JSON.stringify(views));
  ok(!server('classRPG_v3/students/s1/pendingRewards') && !server('classRPG_v3/students/s2/pendingRewards'), '④ 승인한 보상이 되살아나지 않음');
  const daily = server('classRPG_v3/goldDaily') || {};
  let logged = 0; for (const k of Object.keys(daily)) for (const src of ['battle']) logged += daily[k][src] || 0;
  ok(logged === 25 * 3 + 18 * 5, `④ goldDaily(increment) 전투 합 ${logged}/${25 * 3 + 18 * 5}`);
  console.log('   transaction datastale(다시 하기) 횟수:', srv.stats.stale - staleBefore, '· 서버 받은 메시지:', JSON.stringify(srv.stats.byAction));

  // ⑤ 교사 화면 둘이 같은 보상을 같은 순간 승인 → 한 번만 지급(transaction 해시 · datastale 다시 하기를 실제 SDK 로)
  const T2 = await device('교사2', '/admin.html?auto');
  await until(T2, `document.getElementById('admin-app')?.style.display === 'grid'`);
  await S1.ev(`submitQuestFromMain('bq_diary'); 1`);
  await until(T2, `(DB.getStudent('s1').pendingRewards || []).length === 1`, 5000);
  await until(T, `(DB.getStudent('s1').pendingRewards || []).length === 1`, 5000);
  const pr5 = Object.values(server('classRPG_v3/students/s1/pendingRewards') || {})[0];
  const g5 = server('classRPG_v3/students/s1/gold'), stale5 = srv.stats.stale;
  await Promise.all([T.ev(`approveSingle('s1', ${JSON.stringify(pr5 && pr5.id)}); 1`), T2.ev(`approveSingle('s1', ${JSON.stringify(pr5 && pr5.id)}); 1`)]);
  await sleep(2500);
  ok(pr5 && server('classRPG_v3/students/s1/gold') === g5 + pr5.gold && !server('classRPG_v3/students/s1/pendingRewards'),
    `⑤ 두 교사 동시 승인 → 한 번만 지급 (${g5} → ${server('classRPG_v3/students/s1/gold')}, 보상 ${pr5 && pr5.gold}G) · datastale ${srv.stats.stale - stale5}번`);

  // 네트워크 기록
  ok(net.prod.length === 0, `운영 주소 요청 0 (전체 요청 ${net.all.length} · WebSocket ${net.ws.length})`, net.prod.slice(0, 5).join(' | '));
  ok(net.ws.length >= 5 && net.ws.every(u => u.includes(`ws://127.0.0.1:${PP}/.ws`)), 'WebSocket 은 모두 가짜 서버', net.ws.join(' | '));
  const hosts = [...new Set(net.all.map(s => { try { return new URL(s.split(' ')[1]).host; } catch (e) { return '?'; } }))];
  console.log('   요청한 호스트:', hosts.join(', '));
  ok(hosts.every(h => h === `127.0.0.1:${PP}` || h === 'www.gstatic.com' || h === 'cdn.jsdelivr.net' || h === 'cdnjs.cloudflare.com' || h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com' || h === ''), '바깥 호스트는 SDK·라이브러리·글꼴 파일뿐', hosts.join(', '));
  const errList = Object.entries(errs).map(([k, v]) => k + ': ' + [...new Set(v)].slice(0, 3).join(' / '));
  console.log('   페이지 오류:', errList.length ? errList.join(' || ') : '없음');
  ws.close();
} catch (e) {
  ok(false, '예외', e && e.stack);
}
clearTimeout(killer);
await cleanup();
const fails = results.filter(r => r[0] === 'FAIL');
console.log(`가짜 RTDB 실제 화면 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
