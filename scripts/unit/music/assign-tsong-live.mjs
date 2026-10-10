// 선생님 곡(공연 곡) 리듬 과제 여러 기기 확인 [ASSIGN-TSONG-1] — 공유 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 · 실제 리듬 판(소리 장치 시각)
//  가짜 DB 처음 데이터에 선생님 곡 셋(이 시험이 지은 짧은 가락 — 합주 한 곡의 부분 둘 + 한 곡)을 classRPG_music/tsongs 에 넣고 시작한다(곡 파일 올리기는 teacher-songs-live.mjs 가 본다)
//  기기: 교사(admin.html?auto) · 학생 둘(student.html?as=s1 · s2) · TV(assign/) · 새로 연 교사 화면
//   1 교사: [+ 새 과제] → [🎵 음악실 리듬] → 기본 곡 15 밑 '🎤 선생님 곡' 칸(합주 부분 둘은 한 묶음) → 부분 하나를 실제로 눌러 고름 · 보통 · 6키 → 과제함에 보냄
//   2 학생1: 홈 카드(곡 제목 · 부분) → 학습 앱 창(음악실 ?assign=) → 그 선생님 곡 리듬이 선생님 판(보통 · 6키)으로 열림 → 끝까지 침 → 선생님께 보냄
//   3 교사 결과 표: 머리에 🎤 곡 제목 · 부분 · 하늘 '끝' / TV 정리: 과제 이름(곡 제목)
//   4 지운 곡: 반 저장소에서 그 곡을 지움 → 학생2 카드 → '선생님 곡이 바뀌었어요 — 선생님께 알려 주세요'(깨지지 않음) · 새로 연 교사 화면 목록 = '🎤 선생님 곡' + '음악실에 없는 곡'(곡키 안 보임)
//   + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8961 DP=9641 node scripts/unit/music/assign-tsong-live.mjs   (스크린샷 OUT=<폴더> · 가짜 서버 FAKE_RTDB=<…/server.mjs>)
//  리듬 판을 치려고 앱 창 주소에 &debug=1(window.__rhythm — 시험 전용 손잡이)을 덧붙인다. 그 밖에는 실제 화면 그대로.
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면(시간 초과 145초 포함) 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fromTeacherSong } from '../../../music/js/song.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8961), DP = Number(process.env.DP || 9641);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 400) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// ── 선생님 곡 셋(이 시험이 지은 짧은 가락) — 음악실 교사 화면이 저장하는 모양(store.saveTeacherSong = cleanTeacherSong + t) ──
const TS = {
  live_ens_1: { key: 'live_ens_1', title: '가을 소풍 합주', part: '1부(가락)', origin: '선생님 곡', order: 1, beats: 4, sub: 2, tempo: 160, key2: 0, scale: 'major', inst: 'recorder', level: 2,
    melody: 'E4/2 G4/2 A4/2 G4/2 | E4/2 D4/2 C4/4 | D4/2 E4/2 G4/2 E4/2 | D4/4 R/4 | C4/2 E4/2 G4/2 A4/2 | G4/4 C5/4', t: 1 },
  live_ens_2: { key: 'live_ens_2', title: '가을 소풍 합주', part: '2부(낮은 소리)', origin: '선생님 곡', order: 2, beats: 4, sub: 2, tempo: 160, key2: 0, scale: 'major', inst: 'recorder', level: 1,
    melody: 'C3/8 | G3/8 | A3/4 F3/4 | G3/8 | C3/4 E3/4 | G3/4 C3/4', t: 1 },
  live_solo: { key: 'live_solo', title: '달빛 왈츠', origin: '선생님 곡', order: 3, beats: 3, sub: 2, tempo: 120, key2: 0, scale: 'major', inst: 'piano', level: 2,
    melody: 'C4/2 E4/2 G4/2 | A4/4 G4/2 | F4/2 E4/2 D4/2 | C4/6', t: 1 },
};
const PICK = TS.live_ens_1, PICK_ID = 'ts_' + PICK.key, PICK_TITLE = fromTeacherSong(PICK).title;   // '가을 소풍 합주 · 1부(가락)'
for (const k of Object.keys(TS)) fromTeacherSong(TS[k]);   // 시험 곡이 아이 쪽 검사를 통과하는지 먼저(틀리면 여기서 던짐)

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE + ' (FAKE_RTDB=<경로>)'); process.exit(0); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const seed = JSON.parse(fs.readFileSync(path.join(path.dirname(FAKE), 'seed.json'), 'utf8'));
seed.classRPG_music = { ...(seed.classRPG_music || {}), tsongs: TS };
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true, seed });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'assign-tsong-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',   // 소리 장치 없는 헤드리스에서도 소리 시각(currentTime)이 흐르게
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과(145초)'); await cleanup(); process.exit(2); }, 145000);
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
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true, promptText: 'x' }, m.sessionId);   // TV 문(가짜 서버 관리자 비밀번호 x) · 확인 창
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
  const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); };
  //  실제 클릭 — 보이는 그 요소 한가운데가 덮이지 않았을 때만(elementFromPoint) · 'covered' · false(없음)
  const press = async (sel, idx = 0) => {
    const r = await ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getClientRects().length && e.offsetParent !== null || getComputedStyle(e).position === 'fixed'); const e = els[${idx}]; if (!e) return null;
      e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)) }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  return { name, ev, fr, shot, click, press, sessionId, targetId };
}
const until = async (d, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(150); } return false; };
const untilFr = async (d, sel, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.fr(sel, expr) === true) return true; await sleep(200); } return false; };
//  리듬 판 치기(앱 창 안 · debug 손잡이) — 모든 음표 · 실제 [▶ 시작] 단추를 누르고 소리 장치 시각에 맞춰 누름 · 뗌
const BOT = `(() => { const R = window.__rhythm; if (!R) return 'no-rhythm';
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('▶ 시작')); if (!b) return 'no-start';
  b.click();
  const ch = R.chart(); clearInterval(window.__bot);
  window.__bot = setInterval(() => { if (R.state() !== 'play') return; const t = R.now();
    ch.forEach((c, i) => { if (c._b) return; if (t >= c.t - 0.004) { c._b = 1; R.press(c.lane); setTimeout(() => R.release(c.lane), c.long ? c.d * 1000 + 40 : 50); } }); }, 3);
  return ch.length; })()`;
const FRAME_DEBUG = (sel) => `(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return ''; const u = f.src; if (!/debug=1/.test(u)) f.src = u.replace(/(#|$)/, '&debug=1$1'); return f.src; })()`;
const T0 = Date.now();
const lap = () => ((Date.now() - T0) / 1000).toFixed(1) + '초';

try {
  await cdp();
  const T = await device('교사', '/admin.html?auto');
  const S1 = await device('학생1', '/student.html?as=s1');
  const S2 = await device('학생2', '/student.html?as=s2');
  const ready = async (S, sid) => until(S, `typeof CUR !== 'undefined' && !!CUR && CUR.id === '${sid}' && document.getElementById('s-game').classList.contains('active') && typeof _ASG !== 'undefined' && _ASG.sid === '${sid}' && _ASG.connected`, 25000);
  const tReady = await until(T, `document.getElementById('admin-app')?.style.display === 'grid' && typeof _AS !== 'undefined' && _AS.booted && _AS.connected`, 25000);
  const sReady = [await ready(S1, 's1'), await ready(S2, 's2')];
  ok(tReady && sReady.every(Boolean), '기기 입장(교사 · 학생 둘) — 가짜 서버 · 선생님 곡 셋을 넣고 시작', JSON.stringify({ tReady, sReady, tsongs: Object.keys(db('classRPG_music/tsongs') || {}), t: lap() }));
  for (const d of [T, S1, S2]) await d.ev(`window.confirm = () => true; window.alert = () => {}; 1`);

  // ═════ 1. 교사: 만들기 → 🎵 음악실 리듬 → 🎤 선생님 곡 칸에서 실제로 고름 ═════
  await T.ev(`nav('assign', document.getElementById('nav-assign')); 1`);
  await until(T, `!!document.querySelector('#assign-page .asg-toolbar')`, 5000);
  await T.press('.asg-toolbar .btn-sm');
  ok(await until(T, `!!document.querySelector('#asg-create .asg-create')`, 3000), '1-1 [+ 새 과제] → 만들기 창');
  const kindPress = await T.press('#asg-c-kind .asg-seg[onclick*="music"]');
  ok(kindPress === true && await until(T, `document.querySelectorAll('#asg-pick-music .asg-mu-song:not(.asg-mu-tsong)').length === 15 && document.querySelectorAll('#asg-pick-music .asg-mu-tsong').length === 3`, 10000),
    '1-2 [🎵 음악실 리듬] → 기본 곡 15 + 🎤 선생님 곡 3(반 저장소에서 그때 읽음)', JSON.stringify(await T.ev(`({ lib: document.querySelectorAll('#asg-pick-music .asg-mu-song:not(.asg-mu-tsong)').length, ts: document.querySelectorAll('#asg-pick-music .asg-mu-tsong').length, box: ((document.getElementById('asg-mu-ts') || {}).textContent || '').replace(/\\s+/g, ' ').slice(0, 160) })`)));
  const box = await T.ev(`(() => { const ts = document.getElementById('asg-mu-ts'), ens = ts && ts.querySelector('.asg-mu-ens'); const all = [...document.querySelectorAll('#asg-pick-music .asg-mu-song')];
    return { head: ts ? ts.querySelector('.asg-c-row').textContent.replace(/\\s+/g, ' ').trim() : '', ensHead: ens ? ens.querySelector('.asg-mu-ens-h').textContent.replace(/\\s+/g, ' ').trim() : '',
      ensParts: ens ? [...ens.querySelectorAll('.asg-mu-tsong')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()) : [],
      solo: [...ts.querySelectorAll(':scope > .asg-mu-songs > .asg-mu-tsong')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()),
      afterLib: all.indexOf(ts.querySelector('.asg-mu-tsong')) === 15, beforeLevel: !!(ts.compareDocumentPosition(document.querySelector('#asg-pick-music .asg-seg[onclick*="level"]')) & Node.DOCUMENT_POSITION_FOLLOWING) }; })()`);
  ok(box && /🎤 선생님 곡\(공연 곡\)/.test(box.head) && /3곡/.test(box.head) && /가을 소풍 합주/.test(box.ensHead) && /부분 2개/.test(box.ensHead)
    && box.ensParts.length === 2 && /^○ ?1부\(가락\)/.test(box.ensParts[0]) && /6마디 · 빠르기 160/.test(box.ensParts[0]) && /^○ ?2부\(낮은 소리\)/.test(box.ensParts[1])
    && box.solo.length === 1 && /달빛 왈츠/.test(box.solo[0]) && /4마디 · 빠르기 120/.test(box.solo[0]) && box.afterLib && box.beforeLevel,
  '1-3 둘째 칸: 기본 곡 밑 · 합주 부분 둘은 한 묶음(1부 먼저) · 제목 · 부분 · 마디 · 빠르기', JSON.stringify(box));
  await T.shot('1_picker_tsongs');
  const songPress = await T.press(`#asg-pick-music .asg-mu-tsong[onclick*="${PICK_ID}"]`);
  await sleep(200);
  await T.press(`#asg-pick-music .asg-seg[onclick*="'level','normal'"]`); await sleep(150);
  await T.press(`#asg-pick-music .asg-seg[onclick*="'keys','6'"]`); await sleep(150);
  const draft = await T.ev(`({ m: _AS.draft.music, title: (document.querySelector('#asg-create input[maxlength]') || {}).value, on: [...document.querySelectorAll('#asg-pick-music .asg-mu-song.on')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()) })`);
  ok(songPress === true && draft.m.song === PICK_ID && draft.m.level === 'normal' && draft.m.keys === 6 && draft.on.length === 1 && /^● ?1부\(가락\)/.test(draft.on[0])
    && draft.title === `리듬 · ${PICK_TITLE} · 보통`, '1-4 부분을 실제로 눌러 고름 ● · 보통 · 6키 · 과제 이름 = 리듬 · 곡 제목 · 부분 · 난이도', JSON.stringify(draft));
  await T.shot('1_picked');
  const aid = await T.ev(`_AS.draft.aid`);
  await T.press('#asg-send');
  ok(await until(T, `!!_AS.open[${JSON.stringify(aid)}]`, 6000), '1-5 [과제함에 보내기] → open/<과제>');
  const def = db(`classRPG_assign/open/${aid}`) || {};
  ok(def.kind === 'music' && def.deliver === 'inbox' && def.content && def.content.music && def.content.music.song === PICK_ID && def.content.music.level === 'normal' && def.content.music.keys === 6 && def.title === `리듬 · ${PICK_TITLE} · 보통`,
    '1-6 정의: 음악 · 과제함 · 곡 = ts_<곡키> · 보통 · 6키 · 이름', JSON.stringify({ title: def.title, music: def.content && def.content.music }));

  // ═════ 2. 학생1: 카드 → 그 선생님 곡 리듬(선생님 판) → 끝까지 침 ═════
  ok(await until(S1, `!!document.querySelector('#main-area .asg-card') && document.querySelector('#main-area .asg-card').textContent.includes(${JSON.stringify(PICK_TITLE)})`, 8000), '2-1 학생1 홈 카드에 곡 제목 · 부분', await S1.ev(`((document.querySelector('#main-area .asg-card') || {}).textContent || '').replace(/\\s+/g, ' ').slice(0, 160)`));
  await S1.shot('2_s1_card');
  const cardPress = await S1.press('#main-area .asg-row');
  ok(cardPress === true && await until(S1, `(document.getElementById('embed-frame') || {}).src && document.getElementById('embed-frame').src.includes('assign=${aid}') && document.getElementById('m-embed').style.display === 'flex'`, 8000), '2-2 카드 실제 클릭 → 학습 앱 창(음악실 ?assign=<과제>)');
  await S1.ev(FRAME_DEBUG('#embed-frame'));
  ok(await untilFr(S1, '#embed-frame', `!!window.__rhythm && !!document.querySelector('.r-asg-chip') && location.hash === '#/rhythm/${PICK_ID}'`, 20000), '2-3 앱이 그 선생님 곡 리듬을 바로 엶(#/rhythm/ts_<곡키>)');
  const view = await S1.fr('#embed-frame', `({ chip: document.querySelector('.r-asg-chip').textContent, top: (document.querySelector('.top h1') || {}).textContent || '', lay: window.__rhythm.layout(), n: window.__rhythm.chart().length, sels: document.querySelectorAll('.top select').length })`);
  ok(view && /보통 · 6키/.test(view.chip) && view.top === '선생님 과제 · ' + PICK_TITLE && view.lay && view.lay.lanes === 6 && view.lay.key === PICK_ID + '__6k' && view.n === fromTeacherSong(PICK).notes.length && view.sels === 1,
    '2-4 선생님 판: 칩 \'👩‍🏫 보통 · 6키\' · 제목 = 곡 제목 · 부분 · 6건반 · 음표 수 = 그 곡 · 난이도/키 고르기 없음', JSON.stringify(view));
  await S1.shot('2_s1_ready');
  const n1 = await S1.fr('#embed-frame', BOT);
  ok(n1 > 0, '2-5 [▶ 시작] → 소리 장치 시각에 맞춰 침', JSON.stringify({ n1, t: lap() }));
  await sleep(5000);
  await S1.shot('2_s1_play');
  ok(await untilFr(S1, '#embed-frame', `document.body.textContent.includes('선생님께 보냈어요')`, 40000), '2-6 끝까지 침 → \'선생님께 보냈어요 ✓\'', lap());
  await S1.shot('2_s1_done');
  await sleep(500);
  const c1 = db(`classRPG_assign/results/${aid}/s1`) || {}, b1 = c1.app && c1.app.detail && c1.app.detail.best;
  ok(b1 && c1.app.score === Math.round(b1.acc) && c1.app.total === 100 && c1.app.attempts === 1 && typeof c1.doneAt === 'number' && b1.acc >= 80 && c1.app.detail.first,
    '2-7 서버 칸(학생1): 점수 = 정확도 · best · first · doneAt', JSON.stringify(c1).slice(0, 300));
  const endS1 = await S1.fr('#embed-frame', `({ board: document.body.textContent.includes('우리 반 최고'), other: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '다른 곡') })`);
  const t8 = Date.now(); while (!db(`classRPG_music/rhythm/${PICK_ID}__6k/s1`) && Date.now() - t8 < 4000) await sleep(150);
  ok(endS1 && !endS1.board && !endS1.other && !!db(`classRPG_music/rhythm/${PICK_ID}__6k/s1`) && !db('classRPG_v3/problemRecords'),
    '2-8 끝 화면: 우리 반 최고 판 · [다른 곡] 없음 · 내 최고 기록은 그 선생님 곡 자리(rhythm/ts_<곡키>__6k) · 문제 기록 0', JSON.stringify({ endS1, rhythm: Object.keys(db('classRPG_music/rhythm') || {}) }));
  await S1.ev(`closeExternalEmbed(); 1`);

  // ═════ 3. 교사 결과 표 · TV ═════
  await T.ev(`_AS.mask = false; if (_AS.sel !== ${JSON.stringify(aid)}) assignSelect(${JSON.stringify(aid)}); else _assignRenderBits(true); 1`);
  ok(await until(T, `!!document.querySelector('#asg-result .asg-mu-sum') && [...document.querySelectorAll('#asg-result .asg-table tbody tr')].some(r => r.textContent.includes('하늘') && r.textContent.includes('끝'))`, 8000), '3-1 결과 표: 하늘 끝');
  const res = await T.ev(`({ head: (document.querySelector('#asg-result .tc-title') || {}).textContent.replace(/\\s+/g, ' '), list: [...document.querySelectorAll('#asg-lists tr')].map(r => r.textContent.replace(/\\s+/g, ' ')).find(t => t.includes(${JSON.stringify(PICK_TITLE)})) || '', row: [...document.querySelectorAll('#asg-result .asg-table tbody tr')].map(r => [...r.children].map(td => td.textContent.trim())).find(r => r[0].startsWith('하늘')) })`);
  ok(res && res.head.includes(`🎵 리듬 · 🎤 ${PICK_TITLE} · 보통 · 6키`) && res.list.includes(`🎵 리듬 · 🎤 ${PICK_TITLE} · 보통 · 6키`) && res.row && res.row[1] === '끝' && res.row[2].startsWith(b1.acc + '%') && !/ts_live/.test(res.head + res.list),
    '3-2 결과 머리 · 목록 줄 = 🎵 리듬 · 🎤 곡 제목 · 부분 · 보통 · 6키 · 정확도', JSON.stringify(res));
  await T.shot('3_teacher_result');
  const V = await device('TV', `/assign/index.html#/a/${aid}`, { w: 1920, h: 1080 });
  ok(await until(V, `/끝낸 친구 1 \\/ \\d+/.test(document.body.textContent) && (document.querySelector('.tv-title') || {}).textContent === ${JSON.stringify(`리듬 · ${PICK_TITLE} · 보통`)}`, 15000), '3-3 TV 정리: 과제 이름(곡 제목 · 부분) · 끝낸 친구 1',
    await V.ev(`document.body.textContent.replace(/\\s+/g, ' ').slice(0, 200)`));
  await V.shot('3_tv');
  await send('Target.closeTarget', { targetId: V.targetId });

  // ═════ 4. 지운 곡 — 반 저장소에서 지움 → 아이는 한 줄 안내 · 새로 연 교사 화면은 '선생님 곡' + 경고 ═════
  srv.store.set(`classRPG_music/tsongs/${PICK.key}`, null);
  ok(!db(`classRPG_music/tsongs/${PICK.key}`) && !!db('classRPG_music/tsongs/live_ens_2'), '4-1 반 저장소에서 그 곡만 지움');
  ok(await until(S2, `!!document.querySelector('#main-area .asg-row')`, 6000), '4-2 학생2 카드');
  const p2 = await S2.press('#main-area .asg-row');
  ok(p2 === true && await untilFr(S2, '#embed-frame', `!!document.querySelector('.asg-screen h2') && document.querySelector('.asg-screen h2').textContent === '선생님 곡이 바뀌었어요'`, 20000),
    '4-3 카드 → 음악실: \'선생님 곡이 바뀌었어요\'(깨지지 않음)', await S2.fr('#embed-frame', `(document.getElementById('app') || document.body).textContent.replace(/\\s+/g, ' ').slice(0, 160)`));
  const gone = await S2.fr('#embed-frame', `({ p: (document.querySelector('.asg-screen p') || {}).textContent || '', btn: [...document.querySelectorAll('.asg-screen button')].map(b => b.textContent), rhythm: !!document.querySelector('.r-cv') })`);
  ok(gone && gone.p === '선생님께 알려 주세요' && gone.btn.includes('다시 불러오기') && !gone.rhythm, '4-4 \'선생님께 알려 주세요\' · [다시 불러오기] · 리듬 판 없음', JSON.stringify(gone));
  await S2.shot('4_s2_song_gone');
  ok(!db(`classRPG_assign/results/${aid}/s2/app`), '4-5 학생2 결과 칸에 판 없음(친 것이 없으니)');
  const T2 = await device('교사2', '/admin.html?auto');
  await until(T2, `document.getElementById('admin-app')?.style.display === 'grid' && typeof _AS !== 'undefined' && _AS.booted`, 25000);
  await T2.ev(`window.confirm = () => true; nav('assign', document.getElementById('nav-assign')); 1`);
  const goneOk = await until(T2, `/🎵 리듬 · 🎤 선생님 곡 음악실에 없는 곡 · 보통 · 6키/.test(((document.getElementById('asg-lists') || {}).textContent || '').replace(/\\s+/g, ' '))`, 12000);
  const goneTxt = await T2.ev(`((document.getElementById('asg-lists') || {}).textContent || '').replace(/\\s+/g, ' ')`);
  ok(goneOk && !/ts_live|live_ens/.test(goneTxt) && goneTxt.includes(`리듬 · ${PICK_TITLE} · 보통`), '4-6 새로 연 교사 화면 목록: \'🎵 리듬 · 🎤 선생님 곡\' + \'음악실에 없는 곡\'(곡키 안 보임 · 과제 이름은 그대로)', (goneTxt.match(/리듬 · [^·]*·[^·]*·[^·]*· 보통[^끝]*/) || [goneTxt.slice(0, 200)])[0]);
  await T2.shot('4_teacher2_list_gone');
  //  새 과제에서는 그 곡이 안 보이고(남은 부분 · 한 곡만) 보내기도 안 됨
  await T2.ev(`assignNew(); assignDraft('kind', 'music'); 1`);
  ok(await until(T2, `document.querySelectorAll('#asg-pick-music .asg-mu-tsong').length === 2 && !document.querySelector('#asg-pick-music .asg-mu-tsong[onclick*="${PICK_ID}"]')`, 10000), '4-7 새 과제 둘째 칸 = 남은 곡 둘(지운 곡 없음)');
  await T2.ev(`assignCancel(); 1`);

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
console.log(`선생님 곡 리듬 과제 여러 기기 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length} · ${lap()}${OUT ? ' · 스크린샷 ' + OUT : ''}`);
process.exit(fails.length ? 1 : 0);
