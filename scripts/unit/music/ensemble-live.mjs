// 음악실 합주 연습 실제 화면 확인 [MUSIC-ENSEMBLE-1] — 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 · 실제 소리 장치 시각
//  교사(?teacher=1#/t · 비밀번호 x): '🎤 선생님 곡' 칸에 곡 파일 올리기(합주 2부분 · 3부분 · 마디가 어긋난 같은 제목 · 그냥 곡)
//  학생(?sid=s1&debug=1): 고르기 '선생님 곡' — 합주 부분끼리 한 상자 · '합주 · 2성부' 표 · 어긋난 묶음은 표 없음 · 🎶 합주 듣기(두 부분이 같은 칸 시각에 울림)
//    → 리코더 연습 ① — '🎶 함께 연주' 켜짐 · '함께: ②' · ▶ → Player 가 ② 음을 정해진 시각(세기 박 + 칸 · 빠르기 0.6 · 1 · 1.6)에 넘김 · 내 가락과 같은 칸은 같은 시각
//    → 끄면(치는 중) 짝 소리 0 · 이 기기에 기억(다시 열어도 꺼짐) → 3부분 곡 = 고르기(3부만) → 어긋난 곡 = 함께 연주 없음
//    → 리듬 게임 ① — 준비 칸 '🎶 함께 연주' · 끝까지 침(점수 = 내 음만) · ② 음 13개 모두 정해진 시각 · 끄면 0 → 폰 너비(390) 목록 · 연습 윗줄
//  + 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8951 DP=9631 OUT=<스크린샷 폴더> node scripts/unit/music/ensemble-live.mjs   — 안에서 150초면 스스로 끝낸다
//  시험 곡: 작은 별(프랑스 민요 · 저작권 끝남) ① + 직접 지은 짝 가락 ② · 나머지는 직접 지은 짧은 가락(진짜 공연 곡 아님). 시험 손잡이 = 주소의 &debug=1(읽기만).
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면 크롬 · 서버를 닫는다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fromTeacherSong } from '../../../music/js/song.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8951), DP = Number(process.env.DP || 9631);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 400) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// ── 시험 곡 — 임시 폴더에 곡 파일로 써서 교사 화면에 올린다 ──
const base = { beats: 4, sub: 2, tempo: 120, inst: 'recorder', origin: '시험' };
const TW1 = { ...base, key: 'tw_1', title: '작은 별 합주', part: '①', order: 1, melody: 'C4/2 C4/2 G4/2 G4/2 | A4/2 A4/2 G4/4 | F4/2 F4/2 E4/2 E4/2 | D4/2 D4/2 C4/4' };
const PLAIN = { ...base, key: 'plain', title: '그냥 곡', order: 2, melody: 'C4/8 | D4/8' };
const TW2 = { ...base, key: 'tw_2', title: '작은 별 합주', part: '②', order: 3, melody: 'E4/4 B4/4 | C5/2 C5/2 B4/4 | A4/1 A4/1 A4/2 G4/4 | F4/2 G4/2 E4/4' };
const TRI = [['1부', 'C5/2 D5/2 E5/2 | C5/6'], ['2부', 'E4/2 F4/2 G4/2 | E4/6'], ['3부', 'C4/6 | C4/6']].map(([part, melody], i) => ({ ...base, beats: 3, tempo: 90, key: 'tri_' + (i + 1), title: '세 부분 시험', part, order: 5 + i, melody }));
const BAR_A = { ...base, key: 'bar_a', title: '마디 다름', part: 'A', order: 9, melody: 'C4/8 | D4/8' }, BAR_B = { ...base, key: 'bar_b', title: '마디 다름', part: 'B', order: 10, melody: 'E4/8 | F4/8 | G4/8' };
const SONGS = [TW1, PLAIN, TW2, ...TRI, BAR_A, BAR_B];
const sTW1 = fromTeacherSong(TW1), sTW2 = fromTeacherSong(TW2), sTRI3 = fromTeacherSong(TRI[2]);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-songs-'));
const F1 = path.join(TMP, 'ensemble-songs.json');
fs.writeFileSync(F1, JSON.stringify({ kind: 'rpg-music-song', v: 1, songs: SONGS }, null, 1));

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE); process.exit(0); }
process.stdout.on('error', () => {});   // 출력이 끊겨도(| head) 끝까지 돌고 크롬 · 서버를 닫는다
//  포트가 이미 쓰이면(남은 크롬 · 다른 시험) 그 크롬에 붙지 않고 바로 멈춘다
if (await fetch(`http://127.0.0.1:${DP}/json/version`).then(() => true, () => false)) { console.log(`FAIL 포트 ${DP} 를 이미 쓰고 있어요(lsof -nP -iTCP:${DP} -sTCP:LISTEN)`); process.exit(2); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-live-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',   // 소리 장치 없는 헤드리스에서도 소리 시각이 흐르게
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); for (const d of [PROF, TMP]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } };
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
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true, promptText: 'x' }, m.sessionId);   // 선생님 비밀번호(가짜 서버 seed = x)
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
  const setFiles = async (sel, files) => {
    const r = await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(sel)})` }, sessionId);
    if (!r.result || !r.result.objectId) return false;
    await send('DOM.setFileInputFiles', { files, objectId: r.result.objectId }, sessionId); return true;
  };
  const reload = async () => { await send('Page.reload', { ignoreCache: false }, sessionId); };
  return { name, ev, shot, click, pressEl, setFiles, reload, sessionId, targetId };
}
const until = async (d, expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(120); } return false; };
const START = `[...document.querySelectorAll('.p-over button')].find(b => b.textContent.includes('▶ 시작'))`;
const TOG = `[...document.querySelectorAll('.top button')].find(b => b.textContent.includes('함께 연주'))`;
const setSel = (sel, v) => `(() => { const s = ${sel}; if (!s) return false; s.value = ${JSON.stringify(String(v))}; s.dispatchEvent(new Event('change')); return s.value === ${JSON.stringify(String(v))}; })()`;
//  짝 사건 시각 확인 — want = 짝 곡 음(칸) · built = 화면의 offset · stepDur · plan = 화면이 Player 에 넘긴 짝 사건 · fired = Player 가 소리 장치에 넘긴 사건
function checkTimes(tag, song, want, built, plan, fired, speed, { needFired = 2 } = {}) {
  const bad = [];
  if (!built) return ok(false, tag + ' built 없음');
  const exp = want.map(n => ({ s: n.s, p: n.p, t: built.offset + n.s * built.stepDur, ana: (song.beats + n.s / song.sub) * 60 / (song.tempo * speed) }));
  if (plan.length !== exp.length) bad.push(`계획 ${plan.length} ≠ ${exp.length}`);
  for (const e of exp) {
    const q = plan.find(x => x.p === e.p && x.t === e.t);
    if (!q) bad.push(`계획에 칸 ${e.s} 없음`);
    if (Math.abs(e.t - e.ana) > 1e-9) bad.push(`칸 ${e.s} 분석값 ${e.ana} ≠ ${e.t}`);
  }
  const fp = fired.filter(x => x.track === 'partner'), fm = fired.filter(x => x.track === 'melody');
  for (const f of fp) {
    const e = exp.find(x => x.t === f.t && x.p === f.p);
    if (!e) bad.push(`넘긴 짝 음 ${f.p}@${f.t} 계획 밖`);
    if (Math.abs(f.at - (built.t0 + f.t)) > 1e-9) bad.push(`소리 시각 ${f.at} ≠ t0+${f.t}`);
    if (f.at - f.now < -0.02 || f.at - f.now > 0.3) bad.push(`예약 앞섬 ${(f.at - f.now).toFixed(3)}초`);
    if (f.inst !== 'clarinet') bad.push('악기 ' + f.inst);
    const m = fm.find(x => x.t === f.t);
    if (e && song.notes.some(n => n.s === e.s) && fm.length && fm[fm.length - 1].t >= f.t && !m) bad.push(`칸 ${e.s} 내 가락 시각과 다름`);
  }
  const sameStep = fp.filter(f => fm.some(m => m.t === f.t)).length;
  ok(!bad.length && fp.length >= needFired, `${tag} — 짝 음 계획 ${plan.length}개 = 세기 박 + 칸 시각 · 넘긴 짝 음 ${fp.length}개(클라리넷 · 미리 예약) · 내 가락과 같은 시각 ${sameStep}개`, bad.slice(0, 4).join(' / '));
  return sameStep;
}
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
  ok(await until(T, `!!document.querySelector('.ts-card input[type=file]')`, 40000), 'A1 교사 화면 \'🎤 선생님 곡\' 칸',
    await T.ev(`location.href + ' | ' + (document.body ? document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200) : '')`));
  ok(await T.setFiles('.ts-card input[type=file]', [F1]), 'A2 곡 파일 고르기(합주 · 어긋난 묶음 · 그냥 곡 8곡)');
  ok(await until(T, `document.querySelectorAll('.ts-card .song-row').length === 8 && /8곡 넣었어요/.test((document.querySelector('.ts-card .ts-note') || {}).textContent || '')`, 10000), 'A3 \'8곡 넣었어요\' · 목록 8줄',
    await T.ev(`(document.querySelector('.ts-card .ts-note') || {}).textContent`));
  ok(Object.keys(db('classRPG_music/tsongs') || {}).length === 8, 'A4 서버 tsongs 8곡');
  if (Object.keys(db('classRPG_music/tsongs') || {}).length !== 8) throw new Error('선생님 곡을 못 넣어서 여기서 멈춤 — ' + JSON.stringify(errs).slice(0, 300));
  const ens = await T.ev(`[...document.querySelectorAll('.ts-card .ts-ens > div')].map(d => (d.className === 'bad' ? '!' : '') + d.textContent)`);
  ok(Array.isArray(ens) && ens.length === 3 && ens.some(x => x.startsWith('🎶 합주: 작은 별 합주 — ① · ②')) && ens.some(x => x.startsWith('🎶 합주: 세 부분 시험 — 1부 · 2부 · 3부'))
    && ens.includes('!⚠ 합주로 못 묶음: 마디 다름 — 부분마다 마디 수가 달라요'), 'A5 교사 화면 합주 알림: 묶인 둘 · 못 묶인 하나(까닭 = 마디 수)', JSON.stringify(ens));
  await T.shot('A_teacher_ensemble');

  // ═════ B. 학생 — 고르기 목록 ═════
  const S = await device('학생', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/pick/practice`);
  ok(await until(S, `(document.querySelector('.tabs .btn.on') || {}).textContent === '선생님 곡' && document.querySelectorAll('.pick .song-row').length === 8`, 15000), 'B1 리코더 연습 고르기 첫 칸 = 선생님 곡 · 8곡');
  const L = await S.ev(`({ order: [...document.querySelectorAll('.pick .song-row')].map(r => r.dataset.tk),
    grps: [...document.querySelectorAll('.pick .ens-grp')].map(g => ({ name: g.dataset.ens, rows: [...g.querySelectorAll('.song-row')].map(r => r.dataset.tk), badges: [...g.querySelectorAll('.ens-badge')].map(b => b.textContent), listen: !!g.querySelector('.ens-listen') })),
    loose: [...document.querySelectorAll('.pick .list > .song-row')].map(r => ({ tk: r.dataset.tk, badge: !!r.querySelector('.ens-badge') })) })`);
  ok(L && JSON.stringify(L.order) === JSON.stringify(['tw_1', 'tw_2', 'plain', 'tri_1', 'tri_2', 'tri_3', 'bar_a', 'bar_b']), 'B2 순서: 합주 부분끼리 붙음(② 가 ① 바로 뒤 · 그냥 곡은 그 뒤)', JSON.stringify(L && L.order));
  ok(L && L.grps.length === 2 && L.grps[0].name === '작은 별 합주' && L.grps[0].rows.join() === 'tw_1,tw_2' && L.grps[0].badges.every(b => b === '합주 · 2성부') && L.grps[0].badges.length === 2
    && L.grps[1].rows.join() === 'tri_1,tri_2,tri_3' && L.grps[1].badges.every(b => b === '합주 · 3성부') && L.grps.every(g => g.listen),
  'B3 합주 상자 둘 · \'합주 · 2성부\' · \'합주 · 3성부\' · 상자마다 🎶 합주 듣기', JSON.stringify(L && L.grps));
  ok(L && L.loose.length === 3 && L.loose.every(x => !x.badge) && L.loose.map(x => x.tk).join() === 'plain,bar_a,bar_b', 'B4 마디가 어긋난 같은 제목 · 그냥 곡 = 상자 · 표 없음', JSON.stringify(L && L.loose));
  await S.shot('B_pick_ensemble');
  //  🎶 합주 듣기 — 두 부분이 같은 칸 시각에 · 다시 누르면 멈춤
  const lp = await S.pressEl(`document.querySelector('.ens-grp[data-ens="작은 별 합주"] .ens-listen')`);
  ok(lp === true && await until(S, `document.querySelector('.ens-grp .ens-listen').classList.contains('stop') && window.__listen.playing()`, 3000), 'B5 [🎶 합주 듣기] → 듣는 중(■ 멈추기)', String(lp));
  await until(S, `window.__listen.fired().filter(x => x.track === 'partner').length >= 3`, 6000);
  const lf = await S.ev(`window.__listen.fired()`);
  const lm = lf.filter(x => x.track === 'melody'), lpn = lf.filter(x => x.track === 'partner');
  const lSame = lpn.filter(p => lm.some(m => m.t === p.t)).length;
  ok(lpn.length >= 3 && lm.length >= 3 && lSame >= 2 && lpn.every(x => x.inst === 'recorder' && x.part === '②') && lm.every(x => x.inst === 'recorder'),
    `B6 합주 듣기: ① ${lm.length}음 · ② ${lpn.length}음(제 악기 리코더) · 같은 시각 ${lSame}`, JSON.stringify(lpn.slice(0, 3)));
  await S.shot('B_pick_listen');
  await S.pressEl(`document.querySelector('.ens-grp .ens-listen')`);
  ok(await until(S, `!document.querySelector('.ens-grp .ens-listen').classList.contains('stop') && !window.__listen.playing()`, 3000), 'B7 다시 누르면 멈춤');

  // ═════ C. 리코더 연습 ① — 함께 연주 ═════
  const pr = await S.pressEl(`[...document.querySelectorAll('.pick .song-row')].find(r => r.dataset.tk === 'tw_1').querySelector('.btn.primary')`);
  ok(pr === true && await until(S, `location.hash === '#/practice/ts_tw_1' && !!window.__practice && window.__practice.partners().join() === 'tw_2'`, 8000), 'C1 [연습] → 리코더 연습 ① · 짝 = ②', String(pr));
  const top = await S.ev(`(() => { const t = ${TOG}, chip = document.querySelector('.top .ens-chip'), box = document.querySelector('.top .ens-box');
    const b = t && t.getBoundingClientRect(); return { box: box && getComputedStyle(box).display !== 'none', on: !!t && t.classList.contains('on'), chip: chip && getComputedStyle(chip).display !== 'none' ? chip.textContent : null,
    inView: !!b && b.right <= innerWidth && b.bottom <= innerHeight && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === t, line: (document.querySelector('.p-over .ens-line') || {}).textContent || '' }; })()`);
  ok(top && top.box && top.on && top.chip === '함께: ②' && top.inView && /함께 연주: ② 소리도 같이 나와요/.test(top.line), 'C2 윗줄 \'🎶 함께 연주\' 켜짐(처음) · \'함께: ②\' 칩 · 가려지지 않음 · 준비 칸 안내', JSON.stringify(top));
  await S.shot('C_practice_ready');
  //  빠르기 셋 — ▶ → 짝 음을 정해진 시각에 넘김
  for (const sp of [0.6, 1, 1.6]) {
    ok(await S.ev(setSel(`document.querySelector('.top select')`, sp)) === true && await S.ev(`window.__practice.speed()`) === sp, `C3 빠르기 ${sp}`);
    const st = await S.pressEl(START);
    const firstAt = (4 * 60 / (120 * sp)) + 3.1, need = sp === 0.6 ? 2 : 3;
    await until(S, `window.__practice.fired().filter(x => x.track === 'partner').length >= ${need}`, (firstAt + 4) * 1000);
    if (sp === 1) { await sleep(900); await S.shot('C_practice_playing_ghost'); }
    const [built, plan, fired, ghost] = await Promise.all(['built()', 'plan()', 'fired()', 'ghost()'].map(x => S.ev('window.__practice.' + x)));
    checkTimes(`C4 연습 ×${sp}`, sTW1, sTW2.notes, built, plan, fired, sp, { needFired: need });
    ok(st === true && ghost === sTW2.notes.length, `C5 ×${sp} ▶ 시작 · 아래 얇은 줄 = ② 음표 ${ghost}개`);
    await S.pressEl(`document.querySelector('.p-stop')`);
    await until(S, `window.__practice.state() === 'ready'`, 3000);
  }
  //  치는 중에 끄기 → 처음부터 · 짝 소리 0 · 이 기기에 기억
  await S.ev(setSel(`document.querySelector('.top select')`, 1));
  await S.pressEl(START);
  await sleep(1200);
  const off1 = await S.pressEl(TOG);
  ok(off1 === true && await until(S, `window.__practice.together() === false && window.__practice.state() === 'play' && localStorage.getItem('music.together') === 'false'`, 3000), 'C6 치는 중 \'함께 연주\' 끄기 → 처음부터 다시 · 이 기기에 기억(false)');
  await until(S, `window.__practice.fired().filter(x => x.track === 'melody').length >= 4`, 9000);
  const offF = await S.ev(`({ f: window.__practice.fired(), plan: window.__practice.plan().length, chip: getComputedStyle(document.querySelector('.top .ens-chip')).display, on: (${TOG}).classList.contains('on'), ghost: window.__practice.ghost() })`);
  ok(offF.f.filter(x => x.track === 'partner').length === 0 && offF.f.filter(x => x.track === 'melody').length >= 4 && offF.plan === 0 && offF.chip === 'none' && !offF.on && offF.ghost === 0,
    'C7 끄면 짝 음 0(계획도 0) · 내 가락은 그대로 · 칩 · 얇은 줄 숨김', JSON.stringify({ partner: offF.f.filter(x => x.track === 'partner').length, melody: offF.f.filter(x => x.track === 'melody').length, plan: offF.plan, chip: offF.chip, ghost: offF.ghost }));
  await S.pressEl(`document.querySelector('.p-stop')`);
  //  다시 열어도 꺼짐 → 켜기
  await S.ev(`window.__practice = null; 1`);
  await S.reload();
  ok(await until(S, `!!window.__practice && window.__practice.partners().join() === 'tw_2' && !!(${TOG}) && getComputedStyle(document.querySelector('.top .ens-box')).display !== 'none'`, 10000), 'C8 다시 열기');
  const kept = await S.ev(`({ on: (${TOG}).classList.contains('on'), t: window.__practice.together(), line: (document.querySelector('.p-over .ens-line') || {}).textContent || '' })`);
  ok(kept && !kept.on && kept.t === false && /켜면 ② 소리도 같이 나와요/.test(kept.line), 'C9 다시 열어도 꺼짐(기억) · 준비 칸 \'켜면 ② 소리도\'', JSON.stringify(kept));
  await S.pressEl(TOG);
  ok(await until(S, `window.__practice.together() === true && localStorage.getItem('music.together') === 'true' && (${TOG}).classList.contains('on')`, 3000), 'C10 다시 켜기 → 기억(true)');
  //  반주 끄고 함께 연주만
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.trim() === '반주')`);
  await S.pressEl(START);
  await until(S, `window.__practice.fired().filter(x => x.track === 'partner').length >= 2`, 9000);
  const noAcc = await S.ev(`window.__practice.fired()`);
  ok(noAcc.filter(x => x.track === 'partner').length >= 2 && !noAcc.some(x => ['chord', 'bass', 'drum'].includes(x.track)) && await S.ev(`window.__practice.acc() === false`), 'C11 반주를 꺼도 함께 연주는 울림(화음 · 베이스 · 북 0)', JSON.stringify([...new Set(noAcc.map(x => x.track))]));
  await S.pressEl(`document.querySelector('.p-stop')`);

  // ═════ D. 세 부분 곡 — 고르기 · 어긋난 곡 — 없음 ═════
  await S.ev(`location.hash = '#/practice/ts_tri_1'; 1`);
  ok(await until(S, `!!window.__practice && window.__practice.partners().join() === 'tri_2,tri_3' && !!document.querySelector('.top .ens-sel')`, 8000), 'D1 세 부분 곡 1부 → 짝 2부 · 3부 · 작은 고르기');
  const opts = await S.ev(`({ o: [...document.querySelector('.top .ens-sel').options].map(o => o.textContent), chip: getComputedStyle(document.querySelector('.top .ens-chip')).display, v: document.querySelector('.top .ens-sel').value })`);
  ok(opts && opts.o.join('|') === '함께: 모두|함께: 2부|함께: 3부' && opts.chip === 'none' && opts.v === 'all', 'D2 고르기 = 모두 · 2부 · 3부(칩 대신)', JSON.stringify(opts));
  ok(await S.ev(setSel(`document.querySelector('.top .ens-sel')`, 'tri_3')) === true && await S.ev(`window.__practice.active().join()`) === 'tri_3', 'D3 \'함께: 3부\' 고름');
  await S.shot('D_practice_three_parts');
  await S.pressEl(START);
  await until(S, `window.__practice.fired().filter(x => x.track === 'partner').length >= 1`, 9000);
  const [b3, p3, f3] = await Promise.all(['built()', 'plan()', 'fired()'].map(x => S.ev('window.__practice.' + x)));
  checkTimes('D4 3부만(×0.8)', fromTeacherSong(TRI[0]), sTRI3.notes, b3, p3, f3, 0.8, { needFired: 1 });
  ok(p3.every(x => x.part === '3부') && f3.filter(x => x.track === 'partner').every(x => x.part === '3부'), 'D5 2부 소리는 없음(3부만)');
  await S.pressEl(`document.querySelector('.p-stop')`);
  await S.ev(`location.hash = '#/practice/ts_bar_a'; 1`);
  ok(await until(S, `!!window.__practice && document.querySelector('.top h1').textContent.includes('마디 다름')`, 8000), 'D6 마디가 어긋난 곡 연습 화면');
  await sleep(600);
  ok(await S.ev(`window.__practice.partners().length === 0 && getComputedStyle(document.querySelector('.top .ens-box')).display === 'none' && !document.querySelector('.p-over .ens-line')`) === true, 'D7 함께 연주 칸 없음(박 · 마디가 어긋나면 합주로 안 묶음)');

  // ═════ E. 리듬 게임 ① ═════
  await S.ev(`location.hash = '#/rhythm/ts_tw_1'; 1`);
  ok(await until(S, `!!window.__rhythm && !!window.__rhythm.ens && window.__rhythm.ens.partners().join() === 'tw_2' && !!document.querySelector('.p-over .ens-tog')`, 8000), 'E1 리듬 게임 ① · 준비 칸 \'🎶 함께 연주\'');
  const rr = await S.ev(`({ on: document.querySelector('.p-over .ens-tog').classList.contains('on'), line: (document.querySelector('.p-over .ens-line') || {}).textContent || '', chart: window.__rhythm.chart().length })`);
  ok(rr && rr.on && /② 소리도 같이 나와요 · 점수와는 상관없어요/.test(rr.line) && rr.chart === sTW1.notes.length, 'E2 켜짐 · 안내 줄 · 악보 = 내 음만(' + sTW1.notes.length + ')', JSON.stringify(rr));
  await S.shot('E_rhythm_ready');
  const nBot = await S.ev(BOT);
  ok(nBot === sTW1.notes.length, 'E3 ▶ 시작 → 모든 음표를 침', String(nBot));
  await sleep(6500);
  await S.shot('E_rhythm_playing');
  ok(await until(S, `window.__rhythm.state() === 'done'`, 20000), 'E4 끝까지 → 결과');
  const [rb, rp, rf, rs] = await Promise.all(['ens.built()', 'ens.plan()', 'ens.fired()', 'stats()'].map(x => S.ev('window.__rhythm.' + x)));
  checkTimes('E5 리듬(보통 · 원래 빠르기)', sTW1, sTW2.notes, rb, rp, rf, 1, { needFired: sTW2.notes.length });
  ok(rf.filter(x => x.track === 'partner').length === sTW2.notes.length && rs && rs.count === sTW1.notes.length + sTW1.notes.filter(n => n.d >= sTW1.sub * 2).length && rs.miss <= 1,
    `E6 ② 음 ${sTW2.notes.length}개 모두 넘김 · 점수 칸 수 = 내 음만(${rs && rs.count}) · 놓침 ${rs && rs.miss}`, JSON.stringify(rs));
  //  끄고 다시 → 짝 소리 0
  await S.pressEl(`[...document.querySelectorAll('.p-over button')].find(b => b.textContent.trim() === '다시 하기')`);
  await sleep(300); await S.ev(`(() => { clearInterval(window.__bot); return 1; })()`);
  await S.ev(`(() => { const e = new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }); dispatchEvent(e); return 1; })()`);
  ok(await until(S, `window.__rhythm.state() === 'ready' && !!document.querySelector('.p-over .ens-tog')`, 4000), 'E7 준비 칸으로');
  await S.pressEl(`document.querySelector('.p-over .ens-tog')`);
  ok(await until(S, `window.__rhythm.ens.together() === false && !document.querySelector('.p-over .ens-tog').classList.contains('on') && localStorage.getItem('music.together') === 'false'`, 3000), 'E8 리듬 준비 칸에서 끄기(기억)');
  await S.pressEl(START);
  await sleep(6200);
  const rOff = await S.ev(`({ f: window.__rhythm.ens.fired(), plan: window.__rhythm.ens.plan().length, st: window.__rhythm.state() })`);
  ok(rOff.st === 'play' && rOff.plan === 0 && rOff.f.filter(x => x.track === 'partner').length === 0 && rOff.f.some(x => x.track === 'count'), 'E9 끄면 짝 음 0 · 반주는 그대로', JSON.stringify({ plan: rOff.plan, tracks: [...new Set(rOff.f.map(x => x.track))] }));
  await S.ev(`(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); return 1; })()`);
  await S.pressEl(`document.querySelector('.p-over .ens-tog')`);   // 다시 켜 둠

  // ═════ F. 폰 너비(390) ═════
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 1, mobile: true }, S.sessionId);
  await S.ev(`location.hash = '#/pick/practice'; 1`);
  ok(await until(S, `document.querySelectorAll('.pick .ens-grp').length === 2 && document.querySelector('.ens-grp .ens-listen').getBoundingClientRect().right <= innerWidth + 0.5
    && [...document.querySelectorAll('.pick .song-row .acts')].every(a => a.getBoundingClientRect().right <= innerWidth + 0.5)`, 8000), 'F1 폰 너비 목록: 합주 상자 둘 · 합주 듣기 · 줄마다 [연습] 단추가 화면 안(긴 제목은 … 으로)',
    JSON.stringify(await S.ev(`[...document.querySelectorAll('.pick .song-row .acts, .ens-listen')].map(a => Math.round(a.getBoundingClientRect().right))`)));
  ok(await S.ev(`document.documentElement.scrollWidth <= innerWidth + 1`) === true, 'F2 가로로 넘치지 않음');
  await S.shot('F_pick_phone');
  await S.ev(`location.hash = '#/practice/ts_tw_1'; 1`);
  ok(await until(S, `!!window.__practice && window.__practice.partners().join() === 'tw_2'`, 8000), 'F3 폰 너비 연습 화면');
  await sleep(300);
  const ph = await S.ev(`(() => { const t = ${TOG}, b = t.getBoundingClientRect(), all = [...document.querySelectorAll('.top button, .top select, .top .ens-chip')].map(e => e.getBoundingClientRect());
    return { tog: b.right <= innerWidth && b.left >= 0 && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === t, inside: all.every(r => r.right <= innerWidth + 0.5 && r.left >= -0.5), topH: Math.round(document.querySelector('.top').getBoundingClientRect().height), stageH: Math.round(document.querySelector('.p-stage').getBoundingClientRect().height) }; })()`);
  ok(ph && ph.tog && ph.inside && ph.stageH > 200, 'F4 폰 너비 연습 윗줄: 단추가 둘째 줄로 내려가 모두 화면 안 · 함께 연주 단추 누를 수 있음', JSON.stringify(ph));
  await S.shot('F_practice_phone');

  ok(net.prod.length === 0, `운영 주소 요청 0 (전체 ${net.all.length})`, net.prod.slice(0, 5).join(' | '));
  const errList = Object.entries(errs).map(([k, v]) => k + ': ' + [...new Set(v)].slice(0, 4).join(' / '));
  ok(errList.length === 0, '페이지 오류 · console.error 0', errList.join(' || '));
  ws.close();
} catch (e) {
  ok(false, '예외', e && e.stack);
  console.log('페이지 오류:', JSON.stringify(errs).slice(0, 600));
}
clearTimeout(killer);
await cleanup();
const fails = results.filter(r => r[0] === 'FAIL');
console.log(`음악실 합주 실제 화면 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length} (${Math.round((Date.now() - T0) / 1000)}초)`);
process.exit(fails.length ? 1 : 0);
