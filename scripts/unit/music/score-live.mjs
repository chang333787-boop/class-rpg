// 음악실 '악보로 자동 변환' 실제 화면 확인 [MUSIC-SCORE-1] — 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 진짜 마우스
//  ① 작곡(학생 s1 · 1366×610): '🎼 악보 같이 보기' 처음엔 켬 · 칸이 안 가려짐(elementFromPoint) · 칸을 눌러 음 놓기 → 띠 음표 머리 수 = 놓은 음 ·
//     음 지우기 · 끌어 늘이기(끄는 동안 띠가 다시 그려짐) · 화음 칸 → 둘째 오선 · ▶ → 띠에서 빛나는 음이 앞으로 감 · 끄기/켜기(이 기기에 기억 · 새로 고쳐도) ·
//     오케스트라 켜기 → 악보 보기 → '오케스트라 총보' 칸 — 영화 음악 · 행진곡 · 왈츠: 오선 · 악기 이름 · 낮은음자리표 · 인쇄
//  ② 비트(학생 s1): 시작 카드 → '🎼 악보' → 북 머리 수 = 친 칸 수 · 가락 · 베이스 머리 · 화음 이름 · 안내 · ▶ 들으며 보기(빛남이 움직임) · 인쇄 ·
//     순서(A A B · 이어 붙인 순서대로) → 패턴 글자 · 12칸(굿거리) → 12/8 · 우리 장단 이름
//  ③ 친구 비트(학생 s2 · 듣기만)에서도 '🎼 악보' · ④ 좁은 화면(390) 작곡 띠 · 비트 악보 + 페이지 오류 0 · 운영 주소 요청 0
//  실행: PP=8931 DP=9611 OUT=<폴더> node scripts/unit/music/score-live.mjs   (안에서 150초면 스스로 끝낸다 · 끝나면 크롬 · 서버를 닫는다)
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8931), DP = Number(process.env.DP || 9611);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 400) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE); process.exit(0); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const C = await import(pathToFileURL(path.join(ROOT, 'music/js/beatcore.js')).href);
const { EX_BEATS } = await import(pathToFileURL(path.join(ROOT, 'music/js/showcase.js')).href);
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'score-live-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과(150초)'); await cleanup(); process.exit(2); }, 150000);

const net = { all: [], prod: [] }, errs = {};
let ws, send; const sessName = {};
async function cdp() {
  let ver; for (let i = 0; i < 80; i++) { try { ver = await (await fetch(`http://127.0.0.1:${DP}/json/version`)).json(); break; } catch (e) {} await sleep(150); }
  ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  ws.onmessage = e => {
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
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
  //  사진 — 음표 글자(Noto Music)를 다 받은 뒤(받는 동안은 글자가 안 보임 · display=block)
  const shot = async n => { if (!OUT) return; await ev(`Promise.race([document.fonts.ready.then(() => document.fonts.load('40px "Noto Music"', '\u{1D11E}\u{1D122}')), new Promise(r => setTimeout(r, 4000))]).then(() => 1)`); const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
  const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? (buttons ? 'left' : 'none') : 'left', buttons, clickCount: 1 }, sessionId);
  const click = async (x, y) => { await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 0); };
  //  요소 찾는 식 → 가운데를 진짜 마우스로(덮여 있으면 'covered' · 꺼져 있으면 'disabled' · 없으면 false)
  const pressEl = async find => {
    const r = await ev(`(() => { const e = (${find}); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)), dis: !!e.disabled }; })()`);
    if (!r || typeof r !== 'object') return false;
    if (r.dis) return 'disabled';
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  return { name, ev, shot, mouse, click, pressEl, sessionId };
}
const until = async (d, expr, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(120); } return false; };
const btnQ = (txt, scope = 'document') => `[...${scope}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)})`;
const btnHas = (txt, scope = 'document') => `[...${scope}.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(txt)}))`;
const modalBtn = txt => `[...document.querySelectorAll('.modal-wrap .modal-btns button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)})`;
const closeModals = `(() => { document.querySelectorAll('.modal-wrap').forEach(w => w.remove()); document.querySelectorAll('.toast').forEach(t => t.remove()); return 1; })()`;
const heads = (scope, staff) => `[...document.querySelectorAll('${scope} g[data-staff="${staff}"]')].reduce((a, g) => a + g.querySelectorAll('ellipse.st-head, path.st-xhead, path.st-trihead').length, 0)`;
//  인쇄 — 새 창 대신 숨은 틀(인쇄 함수만 바꿔 셈) · 인쇄할 글에 악보 svg 가 있는지
const STUB_PRINT = `(() => { window.__printed = 0; window.open = () => { const f = document.createElement('iframe'); f.style.display = 'none'; document.body.append(f); const w = f.contentWindow; w.print = () => { window.__printed++; window.__printSvg = w.document.querySelectorAll('svg.staff').length; window.__printStaves = w.document.querySelectorAll('g.st-staff').length; }; return w; }; return 1; })()`;

try {
  await cdp();
  // ═════ ① 작곡 ═════
  const S = await device('학생', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/compose/new`);
  ok(await until(S, `!!document.querySelector('.c-grid .c-row') && !!document.querySelector('.c-strip svg')`, 15000), '작곡 화면 · 악보 띠');
  await sleep(300);
  const lay0 = await S.ev(`(() => { const g = document.querySelector('.c-grid'), st = document.querySelector('.c-strip'), btn = document.querySelector('.c-scorebtn'), gb = g.getBoundingClientRect(), sb = st.getBoundingClientRect(), v = document.querySelector('.view');
    const hitG = document.elementFromPoint(gb.left + 300, gb.bottom - 5), hitS = document.elementFromPoint(sb.left + 300, sb.top + sb.height / 2);
    return { on: btn.classList.contains('on') && btn.textContent.includes('악보 같이 보기'), disp: getComputedStyle(st).display, rh: parseFloat(getComputedStyle(g).getPropertyValue('--rh')), gridBottom: Math.round(gb.bottom), stripTop: Math.round(sb.top), stripBottom: Math.round(sb.bottom), H: innerHeight,
      overflow: v.scrollHeight - v.clientHeight, hitGrid: !!hitG && g.contains(hitG), hitStrip: !!hitS && st.contains(hitS), sameLeft: Math.abs(gb.left - sb.left) < 1 }; })()`);
  ok(lay0.on && lay0.disp !== 'none', "'🎼 악보 같이 보기' 처음엔 켬", JSON.stringify(lay0));
  ok(lay0.overflow <= 0 && lay0.stripBottom <= lay0.H && lay0.rh >= 22 && lay0.hitGrid && lay0.hitStrip && lay0.sameLeft && lay0.stripTop >= lay0.gridBottom, '1366×610 — 칸 아래 띠 · 둘 다 보임 · 칸이 안 가려짐 · 넘침 없음', JSON.stringify(lay0));
  await S.shot('s1_compose_on');
  //  칸을 진짜로 눌러 음 놓기(줄은 위에서부터 r · 칸 step)
  const cellXY = (step, r) => `(() => { const g = document.querySelector('.c-grid'), b = g.getBoundingClientRect(), cs = getComputedStyle(g); const cw = parseFloat(cs.getPropertyValue('--cw')), rh = parseFloat(cs.getPropertyValue('--rh')), lab = parseFloat(cs.getPropertyValue('--lab'));
    const x = b.left + lab + ${step} * cw + cw / 2, y = b.top + ${r} * rh + rh / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: hit ? hit.className : '' }; })()`;
  const plan = [[0, 7], [1, 6], [2, 5], [4, 4], [6, 3], [8, 2], [10, 1], [12, 3], [14, 4]];
  let placed = 0, track = [];
  for (const [st, r] of plan) {
    const c = await S.ev(cellXY(st, r));
    if (c && /c-row|c-grid/.test(c.hit)) { await S.click(c.x, c.y); placed++; await sleep(60); track.push(await S.ev(heads('.c-strip', 'mel'))); }
  }
  const nN = await S.ev(`document.querySelectorAll('.c-note:not(.harm)').length`);
  ok(placed === plan.length && nN === plan.length && track.join() === plan.map((_, k) => k + 1).join(), '칸을 누를 때마다 띠 음표가 하나씩(머리 수 = 놓은 음)', track.join());
  //  띠 음표 가로 자리 = 칸 가운데
  const xs = await S.ev(`(() => { const g = document.querySelector('.c-grid'), cs = getComputedStyle(g), cw = parseFloat(cs.getPropertyValue('--cw')), gl = g.getBoundingClientRect().left + parseFloat(cs.getPropertyValue('--lab'));
    return [...document.querySelectorAll('.c-strip g[data-staff="mel"] g.st-note')].map(n => { const e = n.querySelector('ellipse.st-head').getBoundingClientRect(); return Math.round(((e.left + e.right) / 2 - gl) / cw * 10) / 10; }); })()`);
  ok(Array.isArray(xs) && xs.length === plan.length && xs.every((x, k) => Math.abs(x - (plan[k][0] + 0.5)) <= 0.35), '띠 음표 = 그 칸 바로 아래', JSON.stringify(xs));
  //  음 지우기(누름) → 하나 줄어듦
  const del = await S.ev(cellXY(6, 3)); await S.click(del.x, del.y); await sleep(120);
  ok(await S.ev(heads('.c-strip', 'mel')) === plan.length - 1, '음을 지우면 띠에서도 빠짐', await S.ev(heads('.c-strip', 'mel')));
  //  끌어 늘이기 — 끄는 동안 띠가 다시 그려짐(첫 음 반 박 → 2박)
  const r0 = await S.ev(`window.__score.strip().renders`);
  const grip = await S.ev(`(() => { const n = [...document.querySelectorAll('.c-note:not(.harm)')].find(e => e._n && e._n.s === 4); const b = n.getBoundingClientRect(); const cw = parseFloat(getComputedStyle(document.querySelector('.c-grid')).getPropertyValue('--cw')); return { x: b.right - 3, y: b.top + b.height / 2, cw }; })()`);
  await S.mouse('mousePressed', grip.x, grip.y, 1);
  for (let k = 1; k <= 3; k++) { await S.mouse('mouseMoved', grip.x + k * grip.cw, grip.y, 1); await sleep(60); }
  const midDrag = await S.ev(`window.__score.strip().renders`);
  await S.mouse('mouseReleased', grip.x + 3 * grip.cw, grip.y, 0); await sleep(150);
  const dur = await S.ev(`[...document.querySelectorAll('.c-note:not(.harm)')].find(e => e._n && e._n.s === 4)._n.d`);
  const halfOrQ = await S.ev(`(() => { const g = [...document.querySelectorAll('.c-strip g[data-staff="mel"] g.st-note')][3]; return g ? g.querySelectorAll('line.st-stem').length + ':' + g.querySelectorAll('path.st-flag').length : '-'; })()`);
  ok(midDrag > r0 && dur === 4 && halfOrQ === '1:0', '끌어 늘이는 동안 띠가 다시 그려짐 · 반 박 → 2박(꼬리 없는 4분음표 · 2분음표)', `${r0}→${midDrag} d=${dur} ${halfOrQ}`);
  //  화음 칸 → 둘째 오선
  await S.pressEl(`[...document.querySelectorAll('.c-tools .seg button')].find(b => b.textContent === '화음')`);
  for (const [st, r] of [[0, 7], [2, 7], [8, 4]]) { const c = await S.ev(cellXY(st, r)); await S.click(c.x, c.y); await sleep(80); }
  await sleep(250);
  const h2 = await S.ev(`(() => ({ staves: [...document.querySelectorAll('.c-strip g.st-staff')].map(g => g.dataset.staff).join(','), harm: ${heads('.c-strip', 'harm')}, overflow: document.querySelector('.view').scrollHeight - document.querySelector('.view').clientHeight,
    rh: parseFloat(getComputedStyle(document.querySelector('.c-grid')).getPropertyValue('--rh')) }))()`);
  ok(h2.staves === 'mel,harm' && h2.harm === 3 && h2.rh >= 22, '화음 칸 음 → 띠에 둘째 오선(화음)', JSON.stringify(h2));
  await S.shot('s2_compose_harm');
  //  ▶ — 띠에서 빛나는 음이 앞으로
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.includes('들어 보기'))`);
  const seen = []; const phx = [];
  for (let k = 0; k < 14; k++) { await sleep(170); const v = await S.ev(`(() => { const n = [...document.querySelectorAll('.c-strip g.st-note.now')].map(e => e.dataset.i); const ph = document.querySelector('.c-strip .st-ph'); return { n, x: ph && ph.getAttribute('display') !== 'none' ? +ph.getAttribute('x1') : null }; })()`); seen.push(v.n.join('/')); if (v.x != null) phx.push(v.x); }
  const firstIdx = seen.map(x => x.split('/').filter(t => /^\d+$/.test(t)).map(Number)).filter(a => a.length).map(a => Math.min(...a));
  ok(firstIdx.length >= 4 && new Set(firstIdx).size >= 3 && firstIdx.every((v, k) => k === 0 || v >= firstIdx[k - 1]) && phx.length >= 5 && phx[phx.length - 1] > phx[0], '▶ — 띠에서 빛나는 음 · 재생 줄이 앞으로', seen.join(' | ') + ' ph ' + phx.map(Math.round).join(','));
  await S.shot('s3_compose_play');
  await S.pressEl(`[...document.querySelectorAll('.top button')].find(b => b.textContent.includes('멈추기'))`); await sleep(150);
  ok(await S.ev(`document.querySelectorAll('.c-strip .st-note.now').length === 0 && document.querySelector('.c-strip .st-ph').getAttribute('display') === 'none'`), '멈추면 빛 · 재생 줄 꺼짐');
  //  끄기 · 켜기 — 이 기기에 기억(새로 고쳐도)
  const rhOn = await S.ev(`parseFloat(getComputedStyle(document.querySelector('.c-grid')).getPropertyValue('--rh'))`);
  ok(await S.pressEl(`document.querySelector('.c-scorebtn')`) === true, '끄기 단추 누름(안 가려짐)');
  await sleep(200);
  const off = await S.ev(`({ disp: getComputedStyle(document.querySelector('.c-strip')).display, ls: localStorage.getItem('music.compose.score'), rh: parseFloat(getComputedStyle(document.querySelector('.c-grid')).getPropertyValue('--rh')), on: document.querySelector('.c-scorebtn').classList.contains('on') })`);
  ok(off.disp === 'none' && off.ls === 'false' && off.rh >= rhOn && !off.on, '끄면 띠 숨김 · 칸 줄이 다시 넓어짐 · 기억', JSON.stringify(off) + ' on ' + rhOn);
  await S.ev(`location.reload(); 1`); await sleep(400);
  ok(await until(S, `!!document.querySelector('.c-grid .c-row')`, 10000) && await S.ev(`getComputedStyle(document.querySelector('.c-strip')).display === 'none' && !document.querySelector('.c-scorebtn').classList.contains('on')`), '새로 고쳐도 꺼진 채(이 기기)');
  await S.pressEl(`document.querySelector('.c-scorebtn')`); await sleep(200);
  ok(await S.ev(`getComputedStyle(document.querySelector('.c-strip')).display !== 'none' && localStorage.getItem('music.compose.score') === 'true'`), '다시 켬');
  //  오케스트라 꺼짐 = 악보 보기에 칸 없음
  await S.pressEl(btnQ('악보 보기', `document.querySelector('.c-tools')`));
  ok(await until(S, `!!document.querySelector('.modal-wrap .staff-wrap svg.staff') && !document.querySelector('.modal-wrap .scv-tabs')`, 4000), '오케스트라를 안 켜면 가락 악보만(예전 그대로)');
  await S.ev(closeModals);

  //  칸 줄이 많은 곡(생일 축하 12줄) — 띠를 얇게(계이름 · 화음 이름 줄 빼기) · 넘침 없음
  const SB = await device('학생-넓은음역', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/compose/lib_birthday`);
  ok(await until(SB, `!!document.querySelector('.c-strip svg') && !!document.querySelector('.c-grid .c-row')`, 15000), '생일 축하 열기');
  await sleep(300); await SB.ev(closeModals);
  const sb = await SB.ev(`(() => { const v = document.querySelector('.view'), st = window.__score.strip(); return { rows: document.querySelectorAll('.c-lab').length, compact: st.compact, sol: document.querySelectorAll('.c-strip text.st-sol').length, heads: st.heads, overflow: v.scrollHeight - v.clientHeight, rh: parseFloat(getComputedStyle(document.querySelector('.c-grid')).getPropertyValue('--rh')) }; })()`);
  ok(sb.rows >= 12 && sb.compact && sb.sol === 0 && sb.heads > 20 && sb.overflow <= 0 && sb.rh >= 22, '칸 줄 12 — 얇은 띠 · 넘침 없음', JSON.stringify(sb));
  await SB.shot('s3b_compose_compact');

  //  오케스트라 총보 — 작은 별(기본 곡) 바꿔 쓰기에서 편성 셋
  const SO = await device('학생-총보', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/compose/lib_star`);
  ok(await until(SO, `!!document.querySelector('.c-grid .c-row') && !!document.querySelector('.oc-switch')`, 15000), '작은 별 열기');
  await SO.ev(closeModals);
  ok(await SO.pressEl(`document.querySelector('.oc-switch')`) === true, '🎻 오케스트라 켜기');
  await sleep(300); await SO.ev(closeModals);
  const WANT = { film: ['horn', 'timp', 'drums', 'harpR', 'harpL', 'lead', 'strings', 'cello', 'cb'], march: ['sparkle', 'winds', 'horn', 'tuba', 'timp', 'drums', 'lead'], waltz: ['horn', 'timp', 'drums', 'lead', 'strings', 'cello', 'cb'] };
  for (const k of ['film', 'march', 'waltz']) {
    await SO.pressEl(`document.querySelector('.oc-card[data-preset="${k}"]')`); await sleep(250); await SO.ev(closeModals);
    await SO.pressEl(btnQ('악보 보기', `document.querySelector('.c-tools')`));
    const tabs = await until(SO, `!!document.querySelector('.modal-wrap .scv-tabs [data-tab="orch"]')`, 4000);
    const tp = await SO.pressEl(`document.querySelector('.modal-wrap .scv-tabs [data-tab="orch"]')`);
    await sleep(350);
    const info = await SO.ev(`(() => { const s = document.querySelector('.modal-wrap .staff-wrap svg.score'); if (!s) return null; const ids = [...s.querySelectorAll('g.st-staff')].map(g => g.dataset.staff);
      return { ids: [...new Set(ids)], names: [...s.querySelectorAll('text.st-name:not(.sub)')].map(t => t.textContent), bass: s.querySelectorAll('text.st-clef.bass').length, heads: s.querySelectorAll('ellipse.st-head, path.st-xhead, path.st-trihead').length,
        rit: [...s.querySelectorAll('text.st-mark')].some(t => t.textContent.startsWith('rit.')), print: !!${modalBtn('인쇄')}, tabOn: document.querySelector('.scv-tabs [data-tab="orch"]').classList.contains('on') }; })()`);
    ok(tabs && tp === true && info && info.tabOn && info.ids.join() === WANT[k].join() && info.names.length >= WANT[k].length - 1 && info.bass > 0 && info.heads > 50 && info.print, `총보 ${k} — 오선 ${WANT[k].length} · 악기 이름 · 낮은음자리표 · 인쇄 단추`, JSON.stringify(info));
    if (k === 'film') { ok(info.rit, '영화 음악 = rit.(점점 느리게 끝내기)'); await SO.shot('s4_orch_film'); }
    if (k === 'march') await SO.shot('s5_orch_march');
    if (k === 'waltz') {
      await SO.ev(STUB_PRINT);
      await SO.pressEl(modalBtn('인쇄')); await sleep(900);
      const pr = await SO.ev(`({ n: window.__printed, svg: window.__printSvg, st: window.__printStaves })`);
      ok(pr.n === 1 && pr.svg === 1 && pr.st >= WANT.waltz.length, '총보 인쇄 — 보고 있는 칸(총보)이 인쇄 창에', JSON.stringify(pr));
      //  가락 악보 칸으로 돌아가면 예전 악보
      await SO.pressEl(`document.querySelector('.modal-wrap .scv-tabs [data-tab="mel"]')`); await sleep(200);
      ok(await SO.ev(`!document.querySelector('.modal-wrap .staff-wrap svg.score') && !!document.querySelector('.modal-wrap .staff-wrap svg.staff')`), "'가락 악보' 칸 = 예전 가락 악보");
    }
    await SO.ev(closeModals);
  }

  // ═════ ② 비트 ═════
  const B = await device('학생-비트', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/beat`);
  ok(await until(B, `!!document.querySelector('.bt-card') && !!document.querySelector('.bt-scorebtn')`, 15000), '비트 화면 · 🎼 악보 단추');
  //  단추 하나 더해도 줄이 안 늘어남(1366 에서 패턴 줄은 꽉 참 → 단추는 바로 위 재생 줄) — 단추를 숨겨 잰 높이와 같은지
  const rowsH = `(() => { const t = document.querySelector('.bt-trans'), p = document.querySelector('.bt-pats'), g = document.querySelector('.bt-grid'); return [Math.round(t.getBoundingClientRect().height), Math.round(p.getBoundingClientRect().height), Math.round(g.getBoundingClientRect().top)].join(','); })()`;
  const withBtn = await B.ev(rowsH);
  await B.ev(`document.querySelector('.bt-scorebtn').style.display = 'none'; 1`);
  const noBtn = await B.ev(rowsH);
  await B.ev(`document.querySelector('.bt-scorebtn').style.display = ''; 1`);
  ok(withBtn === noBtn && Number(withBtn.split(',')[1]) <= 44, '재생 줄 · 패턴 줄 높이 그대로(칸판이 안 밀림)', withBtn + ' · 단추 없을 때 ' + noBtn);
  await B.pressEl(`[...document.querySelectorAll('.bt-card:not(.ex)')].find(c => c.textContent.includes('쿵 짝 기본'))`); await sleep(600);
  if (await B.ev(`window.__beat.state().playing`)) await B.pressEl(`document.querySelector('.bt-play')`);
  await sleep(150); await B.ev(closeModals);
  const openScore = async d => { const r = await d.pressEl(`document.querySelector('.bt-scorebtn')`); const o = await until(d, `!!document.querySelector('.modal-wrap .scv-beat svg.score')`, 4000); return r === true && o; };
  ok(await openScore(B), "'🎼 악보' 누름 → 악보 창");
  const hitsOf = `(() => { const b = window.__beat.beat(), o = b.mode === 'song' && b.arr.length ? b.arr : [b.cur]; return o.reduce((a, i) => a + Object.values(b.pats[i].d).join('').replace(/0/g, '').length, 0); })()`;
  const mOf = `(() => { const b = window.__beat.beat(), o = b.mode === 'song' && b.arr.length ? b.arr : [b.cur]; return o.reduce((a, i) => a + b.pats[i].m.replace(/[.x]/g, '').length, 0); })()`;
  const bOf = `(() => { const b = window.__beat.beat(), o = b.mode === 'song' && b.arr.length ? b.arr : [b.cur]; return o.reduce((a, i) => a + b.pats[i].b.replace(/[.x]/g, '').length, 0); })()`;
  const readScore = `(() => { const s = document.querySelector('.modal-wrap .scv-beat svg.score'); return { drums: ${heads('.scv-beat', 'drums')}, mel: ${heads('.scv-beat', 'mel')}, bass: ${heads('.scv-beat', 'bass')},
    chords: [...s.querySelectorAll('text.st-chord')].map(t => t.textContent).join(','), ko: [...s.querySelectorAll('text.st-chordko')].map(t => t.textContent).join(','), marks: [...s.querySelectorAll('g.st-mark.box text')].map(t => t.textContent).join(''),
    ts: [...s.querySelectorAll('text.st-ts')].slice(0, 2).map(t => t.textContent).join('/'), legend: document.querySelectorAll('.scv-li').length, names: [...document.querySelectorAll('.scv-li b')].map(b => b.textContent.trim()).join(','),
    rep: s.querySelectorAll('circle.st-rdot').length, acc: s.querySelectorAll('path.st-accent').length }; })()`;
  let sc = await B.ev(readScore), want = { hits: await B.ev(hitsOf), m: await B.ev(mOf), b: await B.ev(bOf) };
  ok(sc.drums === want.hits && want.hits === 12, `북 음표 머리 = 친 칸 ${sc.drums}/${want.hits}`, JSON.stringify(sc));
  ok(sc.mel >= want.m && want.m > 0 && sc.bass >= want.b && want.b > 0, `가락 머리 ${sc.mel}(음 ${want.m}) · 베이스 머리 ${sc.bass}(음 ${want.b})`);
  ok(sc.chords === 'C,G' && sc.ko.includes('도 화음') && sc.ko.includes('솔 화음') && sc.ts === '4/4' && sc.marks === 'A' && sc.rep === 12 && sc.acc > 0, '화음 이름(C 도 화음 · G 솔 화음) · 4/4 · 패턴 A · 도돌이표 · 세게(>)', JSON.stringify(sc));
  ok(sc.legend >= 5 && /쿵/.test(sc.names) && /짝/.test(sc.names) && /칙/.test(sc.names) && /가락/.test(sc.names) && /베이스/.test(sc.names), '칸판 줄 ↔ 악보 안내', sc.names);
  await B.shot('s6_beat_score');
  //  ▶ 들으며 보기 — 악보에서 빛나는 칸이 움직임
  const before = await B.ev(`Math.round(document.querySelector('.scv-wrap').getBoundingClientRect().top)`);
  ok(await B.pressEl(`document.querySelector('.scv-play')`) === true, '▶ 들으며 보기 누름(악보 바로 위)');
  const after = await B.ev(`(() => { const w = document.querySelector('.scv-wrap').getBoundingClientRect(); return { top: Math.round(w.top), vis: w.top >= 0 && w.top < innerHeight - 150 }; })()`);
  ok(after.vis && Math.abs(after.top - before) < 2, '눌러도 악보가 그 자리(창 안에서 보임)', before + ' → ' + JSON.stringify(after));
  const lit = [];
  for (let k = 0; k < 12; k++) { await sleep(130); lit.push(await B.ev(`[...document.querySelectorAll('.scv-beat g.st-note.now')].map(e => e.dataset.i).join('/')`)); }
  const label = await B.ev(`document.querySelector('.scv-play').textContent`);
  ok(lit.filter(Boolean).length >= 5 && new Set(lit.filter(Boolean)).size >= 4 && label.includes('멈추기') && await B.ev(`window.__beat.state().playing`), '들으며 보기 — 악보에서 지금 칸이 빛남(움직임) · 단추 ■', lit.join(' | ') + ' ' + label);
  await B.shot('s7_beat_listen');
  await B.pressEl(`document.querySelector('.scv-play')`); await sleep(200);
  ok(!(await B.ev(`window.__beat.state().playing`)) && await B.ev(`document.querySelectorAll('.scv-beat g.st-note.now').length === 0`), '멈추기 → 빛 꺼짐');
  await B.ev(STUB_PRINT);
  await B.pressEl(`document.querySelector('.scv-print')`); await sleep(900);
  const bp = await B.ev(`({ n: window.__printed, svg: window.__printSvg, st: window.__printStaves })`);
  ok(bp.n === 1 && bp.svg >= 1 && bp.st >= 3, '비트 악보 인쇄(악보 + 안내)', JSON.stringify(bp));
  await B.pressEl(modalBtn('닫기')); await sleep(150);
  ok(await B.ev(`!document.querySelector('.modal-wrap')`), '닫기');
  //  순서 A A B → 이어 붙인 순서대로
  await B.pressEl(`document.querySelector('.bt-slot.add')`); await sleep(80);
  await B.pressEl(`document.querySelector('.bt-slot.add')`); await sleep(80);
  await B.pressEl(`document.querySelectorAll('.bt-pat')[1]`); await sleep(120);
  await B.pressEl(`[...document.querySelectorAll('.bt-card:not(.ex)')].find(c => c.textContent.includes('달리는'))`); await sleep(500);
  if (await B.ev(`window.__beat.state().playing`)) await B.pressEl(`document.querySelector('.bt-play')`);
  await B.ev(closeModals);
  await B.pressEl(`document.querySelector('.bt-slot.add')`); await sleep(80);
  await B.pressEl(btnQ('이어 붙인 순서대로')); await sleep(120);
  const st = await B.ev(`(() => { const s = window.__beat.state(); return s.mode + ':' + s.arr.join(''); })()`);
  ok(st === 'song:001', '순서 A A B · 이어 붙인 순서대로', st);
  ok(await openScore(B), '순서 악보 열기');
  sc = await B.ev(readScore); want = { hits: await B.ev(hitsOf) };
  ok(sc.marks === 'AAB' && sc.drums === want.hits && sc.rep === 0, `마디 위 패턴 글자 A A B · 도돌이표 없음 · 북 머리 ${sc.drums}/${want.hits}`, JSON.stringify(sc));
  ok(await B.ev(`document.querySelector('.modal-wrap .scv-head').textContent.includes('A A B')`), '창 머리 = 이어 붙인 순서');
  await B.shot('s8_beat_song');
  await B.pressEl(modalBtn('닫기')); await sleep(120);
  //  12칸(굿거리) — 12/8 · 우리 장단 이름
  await B.pressEl(btnQ('지금 패턴만 반복')); await sleep(100);
  await B.pressEl(`[...document.querySelectorAll('.bt-card:not(.ex)')].find(c => c.textContent.includes('굿거리'))`); await sleep(400);
  await B.pressEl(modalBtn('카드 넣기')); await sleep(500);
  if (await B.ev(`window.__beat.state().playing`)) await B.pressEl(`document.querySelector('.bt-play')`);
  await B.ev(closeModals);
  ok(await openScore(B), '굿거리 악보 열기');
  sc = await B.ev(readScore); want = { hits: await B.ev(hitsOf) };
  ok(sc.ts === '12/8' && sc.drums === want.hits && /장구 덩/.test(sc.names) && /북/.test(sc.names), `12/8 · 우리 장단 이름 · 북 머리 ${sc.drums}/${want.hits}`, JSON.stringify(sc));
  await B.shot('s9_beat_gutgeori');
  await B.ev(closeModals);

  // ═════ ③ 친구 비트(듣기만) ═════
  const ex = C.exampleBeat(EX_BEATS[0]);
  srv.store.set('classRPG_music/beats/s1/bseed', { ...C.packBeat(ex), id: 'bseed', by: 's1', byName: '테스트', title: '친구 비트 악보', updated: Date.now() });
  const F = await device('친구', `/music/index.html?sid=s2&n=${encodeURIComponent('친구')}&debug=1#/beat/u.s1.bseed`);
  ok(await until(F, `!!document.querySelector('.bt-view.ro') && !!document.querySelector('.bt-scorebtn')`, 15000), '친구 비트 = 듣기만 화면 · 🎼 악보 단추');
  ok(await openScore(F), '친구 비트 악보 열기');
  sc = await F.ev(readScore); want = { hits: await F.ev(hitsOf) };
  ok(sc.drums === want.hits && want.hits > 50 && sc.marks === 'ABABCDCD', `친구 비트 악보 — 순서 여덟 · 북 머리 ${sc.drums}/${want.hits}`, JSON.stringify(sc));
  ok(await F.ev(`document.querySelector('.modal-wrap h2').textContent.includes('테스트의 비트')`), '창 제목 = 친구 이름');
  await F.shot('s10_friend_score');
  await F.ev(closeModals);

  // ═════ ④ 좁은 화면(390) ═════
  const N = await device('좁은', `/music/index.html?sid=s3&n=${encodeURIComponent('좁게')}&debug=1#/compose/ex_hero`, { w: 390, h: 844 });
  ok(await until(N, `!!document.querySelector('.c-strip svg') && !!document.querySelector('.c-grid .c-row')`, 15000), '좁은 화면 작곡 · 띠');
  await sleep(500); await N.ev(closeModals);
  const nl = await N.ev(`(() => { const w = document.querySelector('.c-gridwrap'), st = document.querySelector('.c-strip'); return { docW: document.documentElement.scrollWidth, inWrap: w.contains(st), scrollable: w.scrollWidth > w.clientWidth, staves: [...st.querySelectorAll('g.st-staff')].map(g => g.dataset.staff).join(',') }; })()`);
  ok(nl.docW <= 390 && nl.inWrap && nl.scrollable && nl.staves === 'mel,harm', '390 — 띠가 칸과 같이 옆으로 밀림 · 페이지 가로 넘침 없음', JSON.stringify(nl));
  ok(await N.pressEl(`document.querySelector('.c-scorebtn')`) === true, '390 — 끄기 단추 누름');
  await N.pressEl(`document.querySelector('.c-scorebtn')`);
  await N.shot('s11_narrow_compose');
  //  예시 곡 '용사의 출발'(화음 칸 + 영화 음악) 총보 — 화음 칸은 목관이 분다 · 좁은 화면은 악보를 넓혀 옆으로 밀어 봄
  await N.pressEl(btnQ('악보 보기', `document.querySelector('.c-tools')`));
  await until(N, `!!document.querySelector('.modal-wrap .scv-tabs [data-tab="orch"]')`, 4000);
  await N.pressEl(`document.querySelector('.modal-wrap .scv-tabs [data-tab="orch"]')`); await sleep(400);
  const no = await N.ev(`(() => { const s = document.querySelector('.modal-wrap .staff-wrap svg.score'), w = document.querySelector('.modal-wrap .staff-wrap'); return s ? { ids: [...new Set([...s.querySelectorAll('g.st-staff')].map(g => g.dataset.staff))].join(','), narrow: s.classList.contains('narrow'), docW: document.documentElement.scrollWidth, scroll: w.scrollWidth > w.clientWidth } : null; })()`);
  ok(no && no.ids.includes('winds') && no.ids.includes('lead') && no.ids.includes('harpR') && no.narrow && no.docW <= 390 && no.scroll, "390 — 예시 곡 총보(화음 칸 = 목관) · 좁은 이름 칸 · 옆으로 밀어 봄", JSON.stringify(no));
  await N.shot('s13_narrow_orch');
  await N.ev(closeModals);
  const NB = await device('좁은-비트', `/music/index.html?sid=s3&n=${encodeURIComponent('좁게')}&debug=1#/beat`, { w: 390, h: 844 });
  ok(await until(NB, `!!document.querySelector('.bt-card')`, 15000), '좁은 화면 비트');
  await NB.pressEl(`[...document.querySelectorAll('.bt-card:not(.ex)')].find(c => c.textContent.includes('달리는'))`); await sleep(500);
  if (await NB.ev(`window.__beat.state().playing`)) await NB.pressEl(`document.querySelector('.bt-play')`);
  await NB.ev(closeModals);
  ok(await openScore(NB), '390 — 🎼 악보 누름');
  const nb = await NB.ev(`(() => { const w = document.querySelector('.scv-wrap'); return { docW: document.documentElement.scrollWidth, drums: ${heads('.scv-beat', 'drums')}, wrapScroll: w.scrollWidth >= w.clientWidth }; })()`);
  ok(nb.docW <= 390 && nb.drums === await NB.ev(hitsOf), '390 — 비트 악보(옆으로 밀어 봄) · 북 머리 = 친 칸', JSON.stringify(nb));
  await NB.shot('s12_narrow_beat');

  ok(net.prod.length === 0, '운영 주소 요청 0', net.prod.slice(0, 3).join(' | '));
  ok(Object.values(errs).flat().length === 0, '페이지 오류 0', JSON.stringify(errs).slice(0, 400));
} catch (e) { ok(false, '예외', e.stack); }
finally {
  clearTimeout(killer); await cleanup();
  const fail = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n음악실 악보 실제 화면: PASS ${results.length - fail} · FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
}
