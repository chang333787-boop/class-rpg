// 음악실 비트 만들기 실제 화면 확인 [MUSIC-BEAT-1] — 가짜 RTDB(scripts/unit/fake-rtdb · 운영 DB 0) + 헤드리스 크롬 + 실제 화면 · 실제 소리 장치 시각
//  학생(?sid=s1 · 1366×610): 첫 화면 넷째 문 → 비트 화면 → 칸을 진짜 마우스로(누름 · 세게 · 끌어 칠하기 · elementFromPoint 로 가려지지 않음 확인)
//     → 베이스 붓 · 화음 카드 → ▶ → 박자기가 정한 칸 · 정한 시각에 울렸는지(window.__beat 기록 · 소리 시계) → 빠르기 · 스윙 바꾸기(다음 칸부터)
//     → 소리 묶음 셋(구운 소리 24개 크기 · 밝기) → 패턴 B · 기본 리듬 카드 · 복사 · 순서 A A B C · 필인 · 심벌 → 고르게 나누기 · 엇박 밀기 · 주사위
//     → 손으로 쳐서 녹음(셈 3 · 2 · 1 + 한 마디 → 정한 칸에 들어감 · 되돌리기) → 저장(고운 말 거르기 · 비트 모음) → 다시 불러오기 → 내 비트 · 우리 반 목록 → 폰 너비
//  학생2(s2): 우리 반 목록 듣기 · 열어 보기(듣기만 — 칸 안 바뀜) / 손님: 이 기기에만 저장 · 다시 열기 / 선생님: 아이별 비트 수 · 비트 모음에서 내리기
//  + 네트워크: 운영 주소 요청 0 · 페이지 오류 0
//  실행: PP=8911 DP=9591 node scripts/unit/music/beat-live.mjs   (스크린샷 OUT=<폴더> · 가짜 서버 FAKE_RTDB=<…/server.mjs>)
//  포트는 쓰기 전에 lsof -nP -iTCP:<포트> -sTCP:LISTEN 으로 비었는지 본다. 끝나면(시간 초과여도) 크롬 · 서버를 닫는다 — 안쪽 시계 150초.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PP = Number(process.env.PP || 8911), DP = Number(process.env.DP || 9591);
const OUT = process.env.OUT || '';
const FAKE = process.env.FAKE_RTDB || path.join(HERE, '..', 'fake-rtdb', 'server.mjs');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROD = /firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|firebasestorage\.googleapis\.com|identitytoolkit|securetoken/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (c, name, info) => { results.push([c ? 'PASS' : 'FAIL', name, info || '']); console.log(c ? 'PASS' : 'FAIL', name, info ? String(info).slice(0, 420) : ''); };
if (OUT) fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(FAKE)) { console.log('SKIP 가짜 RTDB 서버가 없음: ' + FAKE); process.exit(0); }
if (!fs.existsSync(CHROME)) { console.log('SKIP 헤드리스 크롬이 없음: ' + CHROME); process.exit(0); }
const { startServer } = await import(pathToFileURL(FAKE).href);
const srv = await startServer({ port: PP, host: '127.0.0.1', repo: ROOT, quiet: true });
const PROF = fs.mkdtempSync(path.join(os.tmpdir(), 'beat-live-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DP}`, `--user-data-dir=${PROF}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output',   // 소리 장치 없는 헤드리스에서도 소리 시각(currentTime)이 흐르게
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--host-resolver-rules=MAP *.firebaseio.com ~NOTFOUND, MAP *.firebasedatabase.app ~NOTFOUND, MAP firestore.googleapis.com ~NOTFOUND, MAP firebasestorage.googleapis.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
let cleaned = false;
const cleanup = async () => { if (cleaned) return; cleaned = true; try { chrome.kill('SIGKILL'); } catch (e) {} await srv.close().catch(() => {}); try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {} };
const killer = setTimeout(async () => { console.log('FAIL 시간 초과(150초)'); await cleanup(); process.exit(2); }, 150000);
const db = p => srv.store.get(p);

const net = { all: 0, prod: [] };
const errs = {};
let ws, send;
const sessName = {};
async function cdp() {
  let ver; for (let i = 0; i < 80; i++) { try { ver = await (await fetch(`http://127.0.0.1:${DP}/json/version`)).json(); break; } catch (e) {} await sleep(150); }
  ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    const who = sessName[m.sessionId] || '?';
    if (m.method === 'Network.requestWillBeSent') { net.all++; const u = m.params.request.url; if (PROD.test(u)) net.prod.push(who + ' ' + u); }
    if (m.method === 'Network.webSocketCreated' && PROD.test(m.params.url)) net.prod.push(who + ' WS ' + m.params.url);
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
  for (const [mth, p] of [['Runtime.enable'], ['Page.enable'], ['Network.enable'],
    ['Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*firestore.googleapis.com*', '*firebasestorage.googleapis.com*'] }],
    ['Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }]]) await send(mth, p || {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PP}${url}` }, sessionId);
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId); return r.exceptionDetails ? 'ERR:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) : r.result.value; };
  const shot = async n => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64')); };
  const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? (buttons ? 'left' : 'none') : 'left', buttons, clickCount: 1 }, sessionId);
  const click = async (x, y) => { await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 0); };
  //  요소 찾는 식 → 가운데를 실제 마우스로(덮여 있으면 'covered' · 꺼져 있으면 'disabled' · 없으면 false)
  const where = async find => ev(`(() => { const e = (${find}); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (hit === e || e.contains(hit)), dis: !!e.disabled }; })()`);
  const pressEl = async find => {
    const r = await where(find);
    if (!r || typeof r !== 'object') return false;
    if (r.dis) return 'disabled';
    if (!r.hit) return 'covered';
    await click(r.x, r.y); return true;
  };
  const key = async (code, k, vk) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk }, sessionId); };
  return { name, ev, shot, mouse, click, where, pressEl, key, sessionId };
}
const until = async (d, expr, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await d.ev(expr) === true) return true; await sleep(100); } return false; };
const cellQ = (r, i) => `document.querySelector('.bt-cell[data-r="${r}"][data-i="${i}"]')`;
const btnQ = (txt, scope = 'document') => `[...${scope}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)})`;
const btnHas = (txt, scope = 'document') => `[...${scope}.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(txt)}))`;
const toastHas = txt => `[...document.querySelectorAll('.toast')].some(t => t.textContent.includes(${JSON.stringify(txt)}))`;
const onSteps = (row) => `(window.__beat.beat().pats[window.__beat.state().cur].d.${row} || '').split('').map((v, i) => v !== '0' ? i : -1).filter(i => i >= 0)`;
const setRange = (sel, v) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${v}; e.dispatchEvent(new Event('input', { bubbles: true })); return +e.value; })()`;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
//  음 높이 재기(시험 전용) — 베이스 '도'(36 · 우리 장단은 한 옥타브 위) 를 자기상관으로 · 화음(도 미 솔)은 그 세 음 자리 힘 ÷ 다른 음 자리 힘(괴르첼)
const PITCH_PROBE = `(async () => { try {
  const K = await import('./js/beatkit.js'), sr = 44100, out = {};
  const f0 = d => { const lo = Math.floor(sr / 400), hi = Math.ceil(sr / 40), n = d.length - hi, r = new Float32Array(hi + 2); let e0 = 0; for (let i = 0; i < n; i++) e0 += d[i] * d[i];
    for (let L = lo; L <= hi + 1; L++) { let s = 0, e1 = 0; for (let i = 0; i < n; i++) { s += d[i] * d[i + L]; e1 += d[i + L] * d[i + L]; } r[L] = s / Math.sqrt(e0 * e1 || 1); }
    let mx = 0; for (let L = lo; L <= hi; L++) mx = Math.max(mx, r[L]);
    let L = lo; while (L < hi && !(r[L] >= 0.9 * mx && r[L] >= r[L - 1] && r[L] >= r[L + 1])) L++;
    const a = r[L - 1], b = r[L], c = r[L + 1], sh = (a - c) / (2 * (a - 2 * b + c) || 1); return sr / (L + sh); };
  const gz = (d, f) => { const w = 2 * Math.PI * f / sr, k = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (const x of d) { const s0 = x + k * s1 - s2; s2 = s1; s1 = s0; } return s1 * s1 + s2 * s2 - k * s1 * s2; };
  for (const kitId of ['elec', 'real', 'kor']) {
    const o1 = new OfflineAudioContext(1, sr, sr), k1 = new K.BeatKit({ ctx: o1 }); k1.bass(kitId, 36, 0, 0.8, 0.9, o1.destination);
    const d1 = (await o1.startRendering()).getChannelData(0).subarray(Math.round(sr * 0.06), Math.round(sr * 0.5));
    const o2 = new OfflineAudioContext(1, sr, sr), k2 = new K.BeatKit({ ctx: o2 }); k2.chord(kitId, [60, 64, 67], 0, 0.8, 0.8, o2.destination, 'long');
    const d2 = (await o2.startRendering()).getChannelData(0).subarray(Math.round(sr * 0.06), Math.round(sr * 0.6));
    const on = [261.63, 329.63, 392].map(f => gz(d2, f)), offs = [233.08, 293.66, 349.23, 440].map(f => gz(d2, f));
    out[kitId] = { bass: +f0(d1).toFixed(2), chord: +(10 * Math.log10(Math.min(...on) / Math.max(...offs))).toFixed(1) };
  }
  return out;
} catch (e) { return { err: String(e && e.stack || e).slice(0, 300) }; } })()`;
//  쪽 안에서 도는 어울림 재기(시험 전용) — 실제 모듈(beatkit · beatcore)을 OfflineAudioContext 에 붙여 박자기 그대로 그린다
const MIX_PROBE = `(async () => { try {
  const K = await import('./js/beatkit.js'), C = await import('./js/beatcore.js');
  const sr = 22050;
  async function render(id, kitId, layer) {
    const st = C.applyStarter(C.emptyBeat(), id).beat; st.kit = kitId;
    const G = C.gridOf(st.grid), secs = 2 * C.barDur(st.bpm, G) + 1, off = new OfflineAudioContext(1, Math.ceil(sr * secs), sr);
    const eng = { ctx: off, bus: () => { const g = off.createGain(); g.connect(off.destination); return g; } };
    const kit = new K.BeatKit(eng); await kit.prepare(kitId);
    const mx = new K.BeatMixer(eng);
    for (const r of C.MIX) st.mix[r].m = layer === 'all' ? false : layer === 'drums' ? (r === 'bass' || r === 'chord') : r !== layer;
    mx.apply(st.mix, kitId);
    let now = 0; const vs = {};
    const seq = new C.Sequencer({ now: () => now, beat: () => st, emit: e => {
      if (e.kind === 'drum') kit.hit(kitId, e.row, e.t, e.crash ? 0.75 : e.vel === 2 ? 1 : 0.62, mx.ch[e.row]);
      else if (e.kind === 'bass') { vs.b && vs.b.stop(e.t); vs.b = kit.bass(kitId, C.BASS[e.n].p, e.t, e.d, 0.9, mx.ch.bass); }
      else if (e.kind === 'bassoff') { vs.b && vs.b.stop(e.t); vs.b = null; }
      else if (e.kind === 'chord') { vs.c && vs.c.stop(e.t); vs.c = kit.chord(kitId, C.CHORDS[e.ch].notes, e.t, e.d, e.vel, mx.ch.chord, e.style); }
      else if (e.kind === 'chordoff') { vs.c && vs.c.stop(e.t); vs.c = null; } } });
    seq.start({ at: 0.05 });
    while (now < 2 * C.barDur(st.bpm, G) - 0.1) { now += 0.05; seq.tick(); }
    const d = (await off.startRendering()).getChannelData(0);
    let pk = 0; for (const x of d) pk = Math.max(pk, Math.abs(x));
    return { w: K.speakerLoud(d, sr, d.length / sr), pk };
  }
  const db = (a, b) => +(20 * Math.log10(a / b)).toFixed(1), cards = {}, alls = [];
  for (const [id, kitId] of [['basic', 'elec'], ['dance', 'elec'], ['bounce', 'real'], ['chill', 'real'], ['semachi', 'kor'], ['basic', 'real'], ['basic', 'kor']]) {
    const dr = await render(id, kitId, 'drums'), ba = await render(id, kitId, 'bass'), ch = await render(id, kitId, 'chord'), al = await render(id, kitId, 'all');
    cards[id + '/' + kitId] = { bass: db(ba.w, dr.w), chord: db(ch.w, dr.w), pk: +al.pk.toFixed(2) };
    if (id === 'basic') alls.push(al.w);
  }
  return { cards, kitSpread: db(Math.max(...alls), Math.min(...alls)) };
} catch (e) { return { err: String(e && e.stack || e).slice(0, 300) }; } })()`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  await cdp();
  // ═════ A. 학생 s1 ═════
  const S = await device('학생', `/music/index.html?sid=s1&n=${encodeURIComponent('테스트')}&debug=1#/`);
  ok(await until(S, `document.querySelectorAll('.doors .door').length === 4`, 15000), 'A1 첫 화면 문 넷(작곡 · 리코더 · 리듬 · 비트 만들기)');
  await sleep(300);
  await S.shot('A_home');
  const dP = await S.pressEl(`document.querySelector('.door.d-beat')`);
  ok(dP === true && await until(S, `location.hash === '#/beat' && !!document.querySelector('.bt-grid .bt-cell')`, 10000), 'A2 \'비트 만들기\' 문(가려지지 않음) → #/beat 칸판', String(dP));
  ok(await until(S, `!!window.__beat && window.__beat.ready() === true`, 10000), 'A3 전자 북 소리 굽기 끝(window.__beat · debug=1 일 때만)');
  const lay = await S.ev(`({ labs: [...document.querySelectorAll('.bt-lab b')].map(b => b.textContent), cells: document.querySelectorAll('.bt-cell').length, nums: [...document.querySelectorAll('.bt-num b')].map(b => b.textContent).join(''), b1: document.querySelectorAll('.bt-cell.b1').length,
    tabs: [...document.querySelectorAll('.bt-tab')].map(b => b.textContent), cards: document.querySelectorAll('.bt-card').length, bpm: document.querySelector('.bt-val').textContent, scrollX: document.scrollingElement.scrollWidth - innerWidth,
    mainOver: document.querySelector('.bt-main').scrollHeight - document.querySelector('.bt-main').clientHeight })`);
  ok(lay && same(lay.labs, ['쿵', '짝', '박수', '칙', '치이', '통', '베이스', '화음']) && lay.cells === 96 && lay.nums === '1234' && lay.b1 === 48 && lay.cards === 7 && lay.bpm === '96' && lay.scrollX <= 0 && lay.mainOver <= 0,
    'A4 줄 여섯(쿵 짝 박수 칙 치이 통) + 베이스 · 화음 · 16칸 × 6 · 박 1~4 · 박마다 칠(둘째 · 넷째 박) · 카드 일곱 · 빠르기 96 · 1366×610 에 다 들어감', JSON.stringify(lay));
  await S.shot('A_beat_empty');
  //  칸 — 진짜 마우스
  for (const [r, i] of [['kick', 0], ['kick', 8], ['snare', 4], ['snare', 12], ['snare', 12], ['clap', 2], ['clap', 2], ['clap', 2]]) { const p = await S.pressEl(cellQ(r, i)); if (p !== true) { ok(false, `A5 칸 누르기 ${r}${i}`, String(p)); break; } }
  const c5 = await S.ev(`({ kick: ${onSteps('kick')}, snare: window.__beat.beat().pats[0].d.snare, clap: ${onSteps('clap')}, cls: ${cellQ('snare', 12)}.className, cls4: ${cellQ('snare', 4)}.className })`);
  ok(c5 && same(c5.kick, [0, 8]) && c5.snare === '0000100000002000' && same(c5.clap, []) && /\bv2\b/.test(c5.cls) && /\bv1\b/.test(c5.cls4),
    'A5 누르면 꺼짐 → 보통 → 세게 → 꺼짐(짝 12 = 두 번 = 세게 · 박수 2 = 세 번 = 꺼짐) · 세게 칸은 v2', JSON.stringify(c5));
  //  끌어 칠하기 — 칙 0 → 7
  const a0 = await S.where(cellQ('hatc', 0)), a7 = await S.where(cellQ('hatc', 7));
  await S.mouse('mousePressed', a0.x, a0.y, 1);
  for (let k = 1; k <= 14; k++) await S.mouse('mouseMoved', a0.x + (a7.x - a0.x) * k / 14, a0.y, 1);
  await S.mouse('mouseReleased', a7.x, a7.y, 0);
  ok(same(await S.ev(onSteps('hatc')), [0, 1, 2, 3, 4, 5, 6, 7]) && same(await S.ev(onSteps('snare')), [4, 12]), 'A6 끌어서 칠하기: 칙 0~7 칸 · 다른 줄은 안 칠해짐');
  //  베이스 붓 · 화음 카드
  await S.pressEl(btnQ('도', `document.querySelector('.bt-pal')`)); await S.pressEl(`document.querySelector('.bt-bcell[data-i="0"]')`);
  await S.pressEl(btnQ('솔', `document.querySelector('.bt-pal')`)); await S.pressEl(`document.querySelector('.bt-bcell[data-i="8"]')`);
  await S.pressEl(btnQ('쉼', `document.querySelector('.bt-pal')`)); await S.pressEl(`document.querySelector('.bt-bcell[data-i="12"]')`);
  const cardBtns = `[...document.querySelectorAll('.bt-pal .bt-palg')][1]`;
  await S.pressEl(btnQ('도', cardBtns)); await S.pressEl(`document.querySelector('.bt-cslot[data-i="0"]')`);
  await S.pressEl(btnQ('솔', cardBtns)); await S.pressEl(`document.querySelector('.bt-cslot[data-i="2"]')`);
  const bc = await S.ev(`({ b: window.__beat.beat().pats[0].b, c: window.__beat.beat().pats[0].c, chips: [...document.querySelectorAll('.bt-bcell .chip')].map(c => c.textContent).join(','), tails: document.querySelectorAll('.bt-bcell .tail').length, slot: document.querySelector('.bt-cslot[data-i="2"]').textContent })`);
  ok(bc && bc.b === '0.......3...x...' && same(bc.c, ['I', '-', 'V', '-']) && bc.chips === '도,솔' && bc.tails === 10 && /솔화음/.test(bc.slot),
    'A7 베이스 붓(도 · 솔 · 쉼) · 이어지는 칸 꼬리 · 화음 카드(도 · 솔) — 저장 모양 그대로', JSON.stringify(bc));
  await S.shot('A_beat_made');
  //  ▶ — 박자기가 정한 칸 · 정한 시각에
  const pP = await S.pressEl(`document.querySelector('.bt-play')`);
  await sleep(3400);
  const L1 = await S.ev(`({ log: window.__beat.log(), now: window.__beat.now(), st: window.__beat.state(), ph: document.querySelectorAll('.bt-cell.ph').length, btn: document.querySelector('.bt-play').textContent })`);
  const fired = L1.log.filter(e => e.t < L1.now);
  const drums = fired.filter(e => e.k === 'drum'), sd = 60 / 96 / 4, t0 = L1.st.loopStart;
  const stepsOf = r => [...new Set(drums.filter(e => e.r === r).map(e => e.s))].sort((a, z) => a - z);
  const timeOK = fired.filter(e => e.k === 'step').every(e => near(e.t, t0 + (e.b * 16 + e.s) * sd, 1e-6));
  const bars = new Set(fired.filter(e => e.k === 'step').map(e => e.b));
  const bassEv = fired.filter(e => e.k === 'bass'), chordEv = fired.filter(e => e.k === 'chord');
  ok(pP === true && L1.st.playing && L1.btn === '■' && bars.has(0) && bars.has(1) && same(stepsOf('kick'), [0, 8]) && same(stepsOf('snare'), [4, 12]) && same(stepsOf('hatc'), [0, 1, 2, 3, 4, 5, 6, 7])
    && drums.filter(e => e.r === 'snare' && e.s === 12).every(e => e.v === 2) && drums.filter(e => e.r === 'snare' && e.s === 4).every(e => e.v === 1) && timeOK && L1.ph >= 6,
    `A8 ▶ → 3.4초 동안 울린 북 ${drums.length}번 = 정한 칸만(쿵 0 · 8 / 짝 4 · 12(세게) / 칙 0~7) · 칸 시각 = 시작 + 칸 × ${sd.toFixed(5)}초(마디 2.5초) · 지금 칸 빛`, JSON.stringify({ n: drums.length, bars: [...bars], ph: L1.ph, timeOK }));
  ok(bassEv.length >= 2 && bassEv.filter(e => e.s === 0).every(e => e.n === 0) && bassEv.filter(e => e.s === 8).every(e => e.n === 3) && fired.some(e => e.k === 'bassoff' && e.s === 12)
    && chordEv.filter(e => e.s === 0).every(e => e.ch === 'I') && chordEv.filter(e => e.s === 8).every(e => e.ch === 'V') && !fired.some(e => e.k === 'chordoff') && !chordEv.some(e => e.s === 4 || e.s === 12), 'A9 베이스(0칸 도 · 8칸 솔 · 12칸 쉼) · 화음(0칸 도 · 8칸 솔 · 빈 칸은 앞 화음이 이어짐 — 끊기 · 새로 치기 없음)');
  const late = L1.log.filter(e => e.k === 'step').length - fired.filter(e => e.k === 'step').length;
  ok(late >= 0 && late <= 2, 'A10 예약은 0.12초 앞까지만(아직 안 울린 칸 ' + late + '개)');
  ok(L1.st.dance.bounce >= 3 && L1.st.dance.wiggle >= 2 && L1.st.dance.flash >= 20, 'A10b 춤 친구가 쿵에 통통 · 짝에 흔들 · 소리 나는 칸이 반짝', JSON.stringify(L1.st.dance));
  await S.shot('A_beat_playing');
  //  빠르기 · 스윙(울리는 중에 바꿔도 다음 칸부터)
  await S.ev(setRange('.bt-trans .bt-range:not(.sw)', 120));
  await sleep(1100);
  let L2 = await S.ev(`({ log: window.__beat.log().filter(e => e.k === 'step'), now: window.__beat.now() })`);
  let st2 = L2.log.slice(-6), d2 = st2.slice(1).map((e, i) => e.t - st2[i].t);
  ok(d2.every(x => near(x, 60 / 120 / 4, 1e-6)) && (await S.ev(`document.querySelector('.bt-val').textContent`)) === '120', 'A11 빠르기 96 → 120(울리는 중) — 다음 칸부터 한 칸 0.125초', d2.map(x => x.toFixed(4)).join(','));
  await S.ev(setRange('.bt-range.sw', 50));
  await sleep(1100);
  L2 = await S.ev(`window.__beat.log().filter(e => e.k === 'step').slice(-8)`);
  const odd = L2.findIndex((e, i) => i > 0 && e.s % 2 === 1 && L2[i - 1].s === e.s - 1);
  ok(odd > 0 && near(L2[odd].t - L2[odd - 1].t, 0.125 * 1.5, 1e-6) && near(L2[odd + 1].t - L2[odd].t, 0.125 * 0.5, 1e-6), 'A12 통통 튀는 정도 50% — 둘째 칸만 반 칸 늦게(0.1875 · 0.0625초)', L2.map(e => e.s + ':' + e.t.toFixed(4)).join(' '));
  await S.key('Space', ' ', 32);
  ok(await until(S, `window.__beat.state().playing === false && document.querySelector('.bt-play').textContent === '▶'`, 2000), 'A13 스페이스 = 멈춤');
  const nAfter = await S.ev(`window.__beat.log().length`); await sleep(400);
  ok(await S.ev(`window.__beat.log().length`) === nAfter && await S.ev(`document.querySelectorAll('.bt-cell.ph').length`) === 0, 'A14 멈춘 뒤 새 사건 0 · 지금 칸 빛 꺼짐');
  await S.ev(setRange('.bt-range.sw', 0));
  //  소리 묶음 셋 — 줄 이름 · 구운 소리
  await S.ev(`(() => { const s = document.querySelector('.bt-kit'); s.value = 'kor'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  ok(await until(S, `window.__beat.ready('kor')`, 8000) && same(await S.ev(`[...document.querySelectorAll('.bt-lab b')].map(b => b.textContent).slice(0, 6)`), ['북', '장구 덕', '장구 덩', '꽹과리', '징', '장구 기덕']), 'A15 소리 묶음 \'우리 장단\' → 줄 이름 북 · 장구 덕 · 장구 덩 · 꽹과리 · 징 · 장구 기덕');
  await S.shot('A_beat_kor');
  await S.ev(`window.__beat.prepare('real')`);
  const ks = await S.ev(`window.__beat.kitStats()`);
  const allBufs = ['elec', 'real', 'kor'].flatMap(k => ['kick', 'snare', 'clap', 'hatc', 'hato', 'tom', 'shaker', 'cymbal'].map(r => [k, r, ks[k] && ks[k][r]]));
  const bufOK = allBufs.every(([, , s]) => s && s.nan === 0 && s.peak > 0.2 && s.peak <= 1 && s.rms > 0.004);
  const bright = ['elec', 'real'].every(k => ks[k].hatc.zcr > ks[k].kick.zcr * 10 && ks[k].cymbal.zcr > ks[k].tom.zcr * 10 && ks[k].kick.ring > ks[k].hatc.ring);
  ok(bufOK && bright && ks.kor.hato.ring > 1.5 && ks.kor.hatc.zcr > ks.kor.kick.zcr * 10, `A16 구운 소리 24개(묶음 셋 × 줄 여덟) — 비지 않음 · 꼭대기 ≤ 1 · NaN 0 · 칙/심벌이 쿵/통보다 밝음 · 징이 1.5초 넘게 울림 · 굽기 ${ks.elec.ms}/${ks.real.ms}/${ks.kor.ms}ms`,
    allBufs.map(([k, r, s]) => `${k}.${r}:${s ? s.peak + '/' + s.rms + '/' + s.zcr + '/' + s.ring : '없음'}`).join(' '));
  await S.ev(`(() => { const s = document.querySelector('.bt-kit'); s.value = 'elec'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  ok(same(await S.ev(`[...document.querySelectorAll('.bt-lab b')].map(b => b.textContent).slice(0, 2)`), ['쿵', '짝']), 'A17 전자 북으로 돌아오면 줄 이름도 쿵 · 짝');
  //  어울림(귀 대신 셈) — 기본 리듬 카드를 오프라인으로 두 마디 그려 '작은 스피커 크기'(150Hz 아래 깎은 RMS)로 북 · 베이스 · 화음을 견준다
  const mixRes = await S.ev(MIX_PROBE);
  const mixOK = mixRes && !mixRes.err && Object.values(mixRes.cards).every(c => c.bass >= -6 && c.bass <= 6 && c.chord >= -11 && c.chord <= -1 && c.pk <= 1.1) && mixRes.kitSpread <= 3;
  const pit = await S.ev(PITCH_PROBE);
  const want = { elec: 65.41, real: 65.41, kor: 130.81 };
  ok(pit && !pit.err && Object.entries(want).every(([k, f]) => Math.abs(pit[k].bass / f - 1) < 0.01 && pit[k].chord >= 10), 'A44 음 높이 — 베이스 도 = 65.41Hz(우리 장단 130.81 · ±1%) · 화음 도 미 솔 자리 힘이 다른 음 자리보다 10dB 넘게 큼', JSON.stringify(pit));
  ok(mixOK, 'A43 어울림(작은 스피커 크기 · dB) — 카드마다 베이스 = 북 ±6 · 화음 = 북 −11~−1 · 꼭대기 ≤ 1.1 · 같은 카드를 소리 묶음 셋으로 = 전체 크기 차 ≤ 3dB',
    mixRes && (mixRes.err || Object.entries(mixRes.cards).map(([k, c]) => `${k} 베이스${c.bass} 화음${c.chord} 꼭대기${c.pk}`).join(' · ') + ` · 묶음 차 ${mixRes.kitSpread}dB`));
  //  패턴 B · 기본 리듬 카드 · 복사 · 순서
  await S.pressEl(`document.querySelectorAll('.bt-pat')[1]`);
  ok(await S.ev(`window.__beat.state().cur === 1 && document.querySelectorAll('.bt-cell.v1, .bt-cell.v2').length === 0 && document.querySelectorAll('.bt-pat')[1].classList.contains('on')`), 'A18 패턴 B — 빈 칸판');
  const cardP = await S.pressEl(`[...document.querySelectorAll('.bt-card')].find(c => c.textContent.includes('춤추는 쿵쿵쿵쿵'))`);
  ok(cardP === true && await until(S, `window.__beat.state().playing === true`, 4000) && same(await S.ev(onSteps('kick')), [0, 4, 8, 12]) && same(await S.ev(onSteps('hato')), [2, 6, 10, 14]) && await S.ev(`window.__beat.state().bpm === 120`),
    'A19 기본 리듬 카드 \'춤추는 쿵쿵쿵쿵\' → B 에 북 · 베이스 · 화음 · 빠르기 120 · 바로 들림');
  await sleep(600);
  await S.shot('A_beat_card');
  await S.key('Space', ' ', 32);
  await S.pressEl(btnQ('복사'));
  ok(await until(S, `!!document.querySelector('.modal') && document.querySelector('.modal h2').textContent.includes('패턴 B')`, 3000), 'A20 [복사] → 어디에 복사할까요?');
  await S.pressEl(btnHas('C (비어 있음)', `document.querySelector('.modal')`));
  ok(await until(S, `window.__beat.state().cur === 2`, 3000) && await S.ev(`JSON.stringify(window.__beat.beat().pats[2]) === JSON.stringify(window.__beat.beat().pats[1])`), 'A21 B → C 복사 · C 로 옮겨 감');
  await S.pressEl(cellQ('snare', 14));
  await S.pressEl(`document.querySelectorAll('.bt-pat')[0]`);
  for (const p of [0, 0, 1, 2]) { await S.pressEl(`document.querySelectorAll('.bt-pat')[${p}]`); await S.pressEl(`document.querySelector('.bt-slot.add')`); }
  await S.pressEl(btnQ('이어 붙인 순서대로'));
  ok(same(await S.ev(`window.__beat.state().arr`), [0, 0, 1, 2]) && await S.ev(`window.__beat.state().mode`) === 'song' && await S.ev(`[...document.querySelectorAll('.bt-arr .bt-slot')].map(s => s.textContent).join('')`) === 'AABC+',
    'A22 순서 칸 + → A A B C · \'이어 붙인 순서대로\'');
  //  필인 켜고 빠르게 → 다섯 마디: 순서 A A B C · 넷째 마디 끝 필인 · 다섯째 마디 첫 칸 심벌
  await S.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '아이디어')`);
  await S.pressEl(`document.querySelector('.bt-check input')`);
  await S.ev(setRange('.bt-trans .bt-range:not(.sw)', 160));
  await S.ev(`window.__beat.clearLog()`);
  await S.pressEl(`document.querySelector('.bt-play')`);
  await sleep(6900);
  const L3 = await S.ev(`({ log: window.__beat.log(), now: window.__beat.now(), st: window.__beat.state() })`);
  await S.key('Space', ' ', 32);
  const f3 = L3.log.filter(e => e.t < L3.now);
  const order = f3.filter(e => e.k === 'step' && e.s === 0).map(e => 'ABCD'[e.p]).join('');
  const toms = f3.filter(e => e.k === 'drum' && e.r === 'tom'), crash = f3.filter(e => e.k === 'drum' && e.crash);
  ok(L3.st.fill === true && order.startsWith('AABCA') && toms.length > 0 && toms.every(e => e.b === 3 && e.s >= 12) && crash.length === 1 && crash[0].b === 4 && crash[0].s === 0,
    `A23 순서대로(빠르기 160) — 마디 차례 ${order} · 필인(통)은 넷째 마디 마지막 박에만 · 다섯째 마디 첫 칸 심벌`, JSON.stringify({ toms: toms.map(e => e.b + ':' + e.s), crash: crash.map(e => e.b + ':' + e.s) }));
  //  고르게 나누기 · 엇박으로 밀기 · 주사위(지금 패턴 = 순서가 보여 준 패턴이므로 A 로)
  await S.pressEl(btnQ('지금 패턴만 반복'));
  await S.pressEl(`document.querySelectorAll('.bt-pat')[0]`);
  await S.pressEl(`[...document.querySelectorAll('.bt-chips .bt-chip')].find(b => b.textContent === '통')`);
  for (let k = 0; k < 3; k++) await S.pressEl(btnQ('+', `document.querySelector('.bt-euc')`));
  const eu = await S.ev(`({ on: ${onSteps('tom')}, txt: document.querySelector('.bt-div').textContent })`);
  ok(same(eu.on, [0, 6, 11]) && eu.txt === '16칸 ÷ 3 = 5 … 1 → 5칸 사이 2번 · 6칸 사이 1번', 'A24 고르게 나누기 — 통 3번 = 0 · 6 · 11칸 · \'16칸 ÷ 3 = 5 … 1\'', JSON.stringify(eu));
  await S.pressEl(btnQ('한 칸 뒤로 ▶'));
  ok(same(await S.ev(onSteps('tom')), [1, 7, 12]), 'A25 한 칸 뒤로(엇박으로 밀기) → 1 · 7 · 12칸');
  await S.shot('A_beat_idea');
  await S.pressEl(btnHas('북 새로 만들기'));
  await sleep(300);
  const dc = await S.ev(`(() => { const d = window.__beat.beat().pats[0].d; return { k0: d.kick[0], s4: d.snare[4], s12: d.snare[12], hats: (d.hatc + d.hato).replace(/0/g, '').length }; })()`);
  ok(dc.k0 === '2' && dc.s4 === '2' && dc.s12 === '2' && dc.hats > 0 && await S.ev(`window.__beat.state().playing`) === true, 'A26 주사위 — 첫 박 쿵 · 2·4박 짝(세게) · 칙 있음 · 바로 들림', JSON.stringify(dc));
  await S.key('Space', ' ', 32);
  await S.pressEl(btnQ('↶ 되돌리기'));
  ok(same(await S.ev(onSteps('kick')), [0, 8]) && same(await S.ev(onSteps('tom')), [1, 7, 12]), 'A27 ↶ 되돌리기 — 주사위 앞으로');
  //  손으로 쳐서 녹음 — 빠르기 100 · 셈(3초 + 한 마디) 뒤 2 · 10칸에 A(쿵)
  await S.ev(setRange('.bt-trans .bt-range:not(.sw)', 100));
  await S.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '손으로 치기')`);
  ok(await S.ev(`document.querySelectorAll('.bt-pad').length === 8 && [...document.querySelectorAll('.bt-pad kbd')].map(k => k.textContent).join('') === 'ASDFJKL;'`), 'A28 패드 여덟(A S D F J K L ;)');
  await S.pressEl(`document.querySelector('.bt-rec2')`);
  ok(await until(S, `window.__beat.state().rec && window.__beat.state().counting && getComputedStyle(document.querySelector('.bt-count')).display === 'block'`, 2000), 'A29 녹음 → 셈 덮개(3 · 2 · 1)');
  await sleep(1200);
  await S.shot('A_beat_count');
  const cnt = await S.ev(`window.__beat.log().filter(e => e.k === 'click' && e.c).map(e => +(e.t - window.__beat.state().loopStart).toFixed(3))`);
  ok(same(cnt, [-2.4, -1.8, -1.2, -0.6]), 'A30 셈 딸깍 = 첫 칸 앞 한 마디(하나 둘 셋 넷)', JSON.stringify(cnt));
  ok(await until(S, `window.__beat.state().counting === false && window.__beat.now() > window.__beat.state().loopStart + 0.3`, 8000), 'A31 셈 끝 → 덮개 사라짐');
  const tapAt = async step => {   // 다음 그 칸 시각에 맞춰 A(쿵) — 소리 시계와 벽시계는 같은 빠르기로 흐른다
    const s = await S.ev(`({ now: window.__beat.now(), t0: window.__beat.state().loopStart, lat: window.__beat.lat() })`);
    const sdd = 60 / 100 / 4, bar = 16 * sdd, pos = s.now - s.t0, k = Math.ceil((pos - step * sdd + 0.25) / bar);
    const target = s.t0 + k * bar + step * sdd + s.lat;
    await sleep(Math.max(0, (target - s.now) * 1000 - 8));
    await S.key('KeyA', 'a', 65);
  };
  await tapAt(2); await tapAt(10);
  await sleep(200);
  const rk = await S.ev(onSteps('kick'));
  ok(rk.includes(2) && rk.includes(10) && rk.includes(0) && rk.includes(8) && rk.length === 4, 'A32 녹음 — 2 · 10칸에 친 쿵이 그 칸에 들어감(가장 가까운 칸)', JSON.stringify(rk));
  await S.pressEl(`document.querySelector('.bt-rec2')`);
  await S.key('Space', ' ', 32);
  await S.pressEl(btnQ('↶ 되돌리기'));
  ok(same(await S.ev(onSteps('kick')), [0, 8]), 'A33 ↶ 되돌리기 = 방금 녹음한 한 바퀴를 한 번에');
  //  저장 — 고운 말 거르기 → 비트 모음
  await S.pressEl(`document.querySelector('.top .btn.primary')`);
  ok(await until(S, `!!document.querySelector('.modal') && document.querySelector('.modal h2').textContent === '비트 저장하기'`, 3000), 'A34 [저장] → 저장 창');
  await S.ev(`(() => { const m = document.querySelector('.modal'); m.querySelector('label input').value = '쿵짝 시발 비트'; m.querySelector('.chk input').checked = true; return 1; })()`);
  await S.pressEl(btnQ('저장', `document.querySelector('.modal')`));
  ok(await until(S, `(document.querySelector('.modal .save-warn') || {}).textContent?.includes('고운 말로')`, 3000) && !db('classRPG_music/beats'), 'A35 고운 말이 아닌 이름으로 \'올리기\' → 막고 까닭 · 저장 안 됨');
  await S.ev(`(() => { const m = document.querySelector('.modal'); m.querySelector('label input').value = '쿵짝 시험 비트'; return 1; })()`);
  await S.pressEl(btnQ('저장', `document.querySelector('.modal')`));
  ok(await until(S, `${toastHas('우리 반 비트 모음에 올렸어요')} && /^#\\/beat\\/u\\.s1\\.b/.test(location.hash) && !document.querySelector('.modal')`, 5000), 'A36 저장 → \'비트 모음에 올렸어요\' · 주소 #/beat/u.s1.<id>');
  const bid = await S.ev(`location.hash.split('.').pop()`);
  const sv = db(`classRPG_music/beats/s1/${bid}`) || {}, row = db(`classRPG_music/beatclass/s1_${bid}`) || {};
  ok(sv.title === '쿵짝 시험 비트' && sv.grid === '16' && sv.pats && sv.pats[0].d.kick === '1000000010000000' && sv.pats[1].d.kick === '2000200020002000' && sv.by === 's1' && sv.byName === '테스트' && sv.pub === true && sv.rev === 1 && Object.values(sv.arr || {}).join('') === '0012'
    && row.t === '쿵짝 시험 비트' && row.sid === 's1' && row.id === bid && row.n === '테스트' && row.bpm === 100 && Object.keys(db('classRPG_music') || {}).sort().join() === 'beatclass,beats',
    'A37 서버: beats/s1/<id>(글자 줄 모양 · 누가 · 몇 번째 저장) + beatclass/s1_<id> 한 줄 · 음악실에 쓴 곳 = 이 둘뿐', JSON.stringify({ keys: Object.keys(sv), row }));
  await S.shot('A_beat_saved');
  //  다시 불러오기
  await S.ev(`window.__old = 1`);   // 새로 고친 쪽인지 알아보는 표(Page.reload 는 옛 쪽이 살아 있을 때 돌아온다)
  await send('Page.reload', {}, S.sessionId);
  ok(await until(S, `!window.__old && !!window.__beat && window.__beat.state().id === ${JSON.stringify(bid)} && document.querySelector('.bt-title').value === '쿵짝 시험 비트'`, 10000), 'A38 새로 고침 → 저장한 비트 그대로 열림(이름 · id)');
  const rl = await S.ev(`window.__beat.beat()`);
  ok(rl && rl.pats && rl.pats[0].d.kick === sv.pats[0].d.kick && rl.pats[1].b === sv.pats[1].b && same(rl.arr, [0, 0, 1, 2]) && rl.bpm === 100 && rl.fill === true && rl.mode === 'loop' && sv.mode === 'loop', 'A39 패턴 · 베이스 · 순서 · 빠르기 · 필인 · 모드(지금 패턴만) 다 같음', JSON.stringify(rl && { arr: rl.arr, bpm: rl.bpm, fill: rl.fill, mode: rl.mode }));
  await S.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '내 비트')`);
  ok(await until(S, `[...document.querySelectorAll('.bt-tabbody .song-row')].some(r => r.textContent.includes('쿵짝 시험 비트') && r.classList.contains('open'))`, 5000), 'A40 \'내 비트\' 목록 — 지금 연 비트 표시');
  await S.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '우리 반')`);
  ok(await until(S, `[...document.querySelectorAll('.bt-tabbody .song-row')].some(r => r.textContent.includes('쿵짝 시험 비트') && r.textContent.includes('테스트 (나)'))`, 5000), 'A41 \'우리 반\' 목록에 내 비트(나)');
  await S.shot('A_beat_class');
  //  빽빽한 비트(달리는 비트 · 빠르기 160)를 4초 — 메인 줄 긴 일(50ms 넘게) · 늦게 예약한 소리 · 한꺼번에 울리는 소리 수
  await S.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '시작 카드')`);
  await S.pressEl(`document.querySelectorAll('.bt-pat')[3]`);
  await S.pressEl(`[...document.querySelectorAll('.bt-card')].find(c => c.textContent.includes('달리는 비트'))`);
  await until(S, `window.__beat.state().playing`, 3000);
  await S.ev(setRange('.bt-trans .bt-range:not(.sw)', 160));
  await S.ev(`window.__beat.clearLog(); window.__lt = []; window.__vmax = 0; window.__po = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); window.__po.observe({ entryTypes: ['longtask'] }); window.__vt = setInterval(() => { window.__vmax = Math.max(window.__vmax, window.__beat.voices()); }, 50); 1`);
  await sleep(4000);
  const dn = await S.ev(`(() => { clearInterval(window.__vt); window.__po.disconnect(); const L = window.__beat.log(); return { lt: window.__lt, vmax: window.__vmax, n: L.filter(e => e.k === 'drum').length, late: L.filter(e => e.w > e.t + 1e-6).length, lead: Math.max(...L.filter(e => e.k === 'step').map(e => e.t - e.w)) }; })()`);
  await S.key('Space', ' ', 32);
  ok(dn.lt.length === 0 && dn.late === 0 && dn.n > 50 && dn.lead <= 0.121 && dn.vmax <= 40, `A45 빽빽한 비트 4초(북 ${dn.n}번 · 칙 16분) — 메인 줄 긴 일 0 · 늦게 예약 0 · 가장 앞선 예약 ${dn.lead.toFixed(3)}초 · 한꺼번에 울리는 소리 ${dn.vmax}개 이하`, JSON.stringify(dn));
  //  폰 너비
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 1, mobile: true }, S.sessionId);
  await sleep(500);
  const ph = await S.ev(`({ sx: document.scrollingElement.scrollWidth - innerWidth, grid: document.querySelector('.bt-gridbox').scrollWidth > document.querySelector('.bt-gridbox').clientWidth, hit: (() => { const c = ${cellQ('kick', 0)}; c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = c.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === c; })() })`);
  ok(ph.sx <= 0 && ph.hit, 'A42 폰 너비(390) — 쪽은 옆으로 안 밀림(칸판만 옆으로 넘김) · 칸이 가려지지 않음', JSON.stringify(ph));
  await S.shot('A_beat_phone');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 610, deviceScaleFactor: 1, mobile: false }, S.sessionId);

  // ═════ B. 학생 s2 — 우리 반 비트 듣기 · 열어 보기(듣기만) ═════
  const T = await device('학생2', `/music/index.html?sid=s2&n=${encodeURIComponent('친구')}&debug=1#/beat`);
  ok(await until(T, `!!window.__beat && !!document.querySelector('.bt-tab')`, 10000), 'B1 학생2 비트 화면');
  await T.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '우리 반')`);
  ok(await until(T, `[...document.querySelectorAll('.bt-tabbody .song-row')].some(r => r.textContent.includes('쿵짝 시험 비트') && r.textContent.includes('테스트'))`, 6000), 'B2 우리 반 목록에 친구(s1) 비트');
  const lp = await T.pressEl(`[...document.querySelectorAll('.bt-tabbody .song-row')].find(r => r.textContent.includes('쿵짝 시험 비트')).querySelector('.play-i')`);
  ok(lp === true && await until(T, `!!document.querySelector('.bt-tabbody .play-i.stop')`, 4000), 'B3 ▶ 듣기(따로 박자기 · 따로 믹서)');
  await sleep(900);
  await T.pressEl(`document.querySelector('.bt-tabbody .play-i.stop')`);
  ok(await until(T, `!document.querySelector('.bt-tabbody .play-i.stop')`, 2000), 'B4 다시 누르면 멈춤');
  await T.pressEl(btnQ('열어 보기', `[...document.querySelectorAll('.bt-tabbody .song-row')].find(r => r.textContent.includes('쿵짝 시험 비트'))`));
  ok(await until(T, `location.hash === '#/beat/u.s1.${bid}' && !!document.querySelector('.bt-view.ro') && window.__beat.state().readOnly === true`, 8000), 'B5 열어 보기 → 듣기만 화면');
  const ro = await T.ev(`({ h1: document.querySelector('.top h1').textContent, save: !!document.querySelector('.bt-title'), pal: getComputedStyle(document.querySelector('.bt-pal')).display, tabs: [...document.querySelectorAll('.bt-tab')].map(b => b.textContent).join(','), rec: getComputedStyle(document.querySelector('.bt-rec')).display })`);
  ok(ro.h1.includes('테스트의 비트') && ro.h1.includes('쿵짝 시험 비트') && !ro.save && ro.pal === 'none' && ro.tabs === '손으로 치기,내 비트,우리 반' && ro.rec === 'none', 'B6 제목 \'테스트의 비트\' · 저장 · 붓 · 녹음 · 카드 · 아이디어 없음', JSON.stringify(ro));
  const before = await T.ev(`window.__beat.beat().pats[0].d.kick`);
  await T.pressEl(cellQ('kick', 4));
  ok(await until(T, toastHas('친구 비트는 들어 보기만'), 2000) && await T.ev(`window.__beat.beat().pats[0].d.kick`) === before && await T.ev(`window.__beat.state().dirty`) === false, 'B7 칸을 눌러도 안 바뀜 · \'친구 비트는 들어 보기만\'');
  await T.pressEl(`document.querySelector('.bt-play')`);
  ok(await until(T, `window.__beat.state().playing && window.__beat.log().some(e => e.k === 'drum')`, 4000), 'B8 친구 비트 ▶ 들림');
  await T.shot('B_friend_readonly');
  await T.key('Space', ' ', 32);

  // ═════ C. 손님 — 이 기기에만 ═════
  const G = await device('손님', `/music/index.html?debug=1#/beat`);
  ok(await until(G, `!!window.__beat && document.querySelector('.top .who').textContent.includes('손님')`, 10000), 'C1 손님 비트 화면(\'이 기기에만 저장\')');
  await G.pressEl(cellQ('kick', 0)); await G.pressEl(cellQ('snare', 4));
  await G.pressEl(`document.querySelector('.top .btn.primary')`);
  await until(G, `!!document.querySelector('.modal')`, 3000);
  ok(await G.ev(`document.querySelector('.modal').textContent.includes('이 기기에만 저장돼요')`), 'C2 저장 창에 \'이 기기에만\' 안내');
  await G.ev(`(() => { document.querySelector('.modal label input').value = '손님 비트'; return 1; })()`);
  await G.pressEl(btnQ('저장', `document.querySelector('.modal')`));
  ok(await until(G, `${toastHas('저장했어요')} && /^#\\/beat\\/u\\.guest\\.b/.test(location.hash)`, 4000), 'C3 저장 → #/beat/u.guest.<id>');
  const loc = await G.ev(`(() => { const d = JSON.parse(localStorage.getItem('music.local') || '{}'); const b = Object.values(d.beats || {})[0]; return b ? { t: b.title, k: b.pats[0].d.kick, s: b.pats[0].d.snare } : null; })()`);
  ok(loc && loc.t === '손님 비트' && loc.k === '1000000000000000' && loc.s === '0000100000000000' && !Object.keys(db('classRPG_music/beats') || {}).includes('guest'), 'C4 localStorage(music.local · beats) 에만 · 서버엔 없음', JSON.stringify(loc));
  await G.ev(`window.__old = 1`);
  await send('Page.reload', {}, G.sessionId);
  ok(await until(G, `!window.__old && !!window.__beat && window.__beat.state().title === '손님 비트' && window.__beat.beat().pats[0].d.kick === '1000000000000000'`, 10000), 'C5 새로 고침 → 손님 비트 다시 열림');

  // ═════ D. 선생님 — 아이별 비트 수 · 비트 모음에서 내리기 ═════
  const P = await device('교사', '/music/index.html?teacher=1#/t');
  ok(await until(P, `[...document.querySelectorAll('.tk .tk-head')].some(h => h.textContent.includes('비트 1'))`, 15000), 'D1 교사 화면 — 아이 칸 \'비트 1\'(이름 = 반 명단)', await P.ev(`[...document.querySelectorAll('.tk .tk-head')].map(h => h.textContent).join(' / ')`));
  ok(await P.ev(`[...document.querySelectorAll('.tk .song-row')].some(r => r.textContent.includes('🥁 쿵짝 시험 비트') && r.textContent.includes('빠르기 100') && [...r.querySelectorAll('button')].some(b => b.textContent === '열어 보기'))`), 'D2 비트 줄(🥁 이름 · 빠르기 · 열어 보기)');
  const hP = await P.pressEl(`[...document.querySelectorAll('.tk .song-row')].find(r => r.textContent.includes('쿵짝 시험 비트')).querySelector('.acts button:last-child')`);
  ok(hP === true && await until(P, `${toastHas('비트 모음에서 내렸어요')}`, 4000) && (db(`classRPG_music/beatclass/s1_${bid}`) || {}).hide === true, 'D3 [비트 모음에서 내리기] → 서버 hide · 비트는 그대로', JSON.stringify(db(`classRPG_music/beatclass/s1_${bid}`)));
  await P.shot('D_teacher');
  ok(await until(T, `location.hash = '#/beat'; true`, 1000) && await until(T, `!!document.querySelector('.bt-tab')`, 8000), 'D4 학생2 다시 비트 화면');
  await T.pressEl(`[...document.querySelectorAll('.bt-tab')].find(b => b.textContent === '우리 반')`);
  ok(await until(T, `document.querySelector('.bt-tabbody .empty') && document.querySelector('.bt-tabbody .empty').textContent.includes('아직 올라온 비트가 없어요')`, 6000), 'D5 내린 비트는 우리 반 목록에서 빠짐');
  //  다시 저장해도 숨김은 남는다(모음 줄을 칸마다 씀)
  await S.ev(`location.hash = '#/beat/u.s1.${bid}'; 1`);
  await until(S, `!!window.__beat && window.__beat.state().id === ${JSON.stringify(bid)}`, 8000);
  await S.pressEl(cellQ('clap', 6));
  await S.pressEl(`document.querySelector('.top .btn.primary')`);
  await until(S, `!!document.querySelector('.modal')`, 3000);
  await S.pressEl(btnQ('저장', `document.querySelector('.modal')`));
  ok(await until(S, `${toastHas('올렸어요')}`, 4000) && (db(`classRPG_music/beatclass/s1_${bid}`) || {}).hide === true && (db(`classRPG_music/beats/s1/${bid}`) || {}).rev === 2, 'D6 아이가 다시 저장해도 선생님 숨김은 남음 · rev 2');

  ok(net.prod.length === 0, `운영 주소 요청 0 (전체 ${net.all})`, net.prod.slice(0, 5).join(' | '));
  const errList = Object.entries(errs).map(([k, v]) => k + ': ' + [...new Set(v)].slice(0, 4).join(' / '));
  ok(errList.length === 0, '페이지 오류 · console.error 0', errList.join(' || '));
  ws.close();
} catch (e) {
  ok(false, '예외', e && e.stack);
}
clearTimeout(killer);
await cleanup();
const fails = results.filter(r => r[0] === 'FAIL');
console.log(`음악실 비트 실제 화면 확인 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
