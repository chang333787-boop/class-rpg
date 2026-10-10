#!/usr/bin/env node
// 우리반 RPG — 넣기 전 확인 장치 [GATE-1]
//
//  무엇: 가짜 RTDB 서버(scripts/unit/fake-rtdb/server.mjs) 위에서 헤드리스 크롬으로 주요 화면을 **실제로 눌러 본다**.
//        페이지 예외 · console.error · 같은 출처 파일 400 넘는 응답 · 운영 Firebase 주소 요청 · 화면이 안 뜸/안 닫힘 이
//        하나라도 있으면 NOT CLEAN(exit 1).
//   ① 학생(student.html?as=s1 · 1366×610 = 학교 크롬북): 홈 네 구역(오늘 · 배우고 만들기 · 나의 공간 · 모험)과 HUD 에서
//      누를 수 있는 것([onclick] · [role=button] · button)을 DOM 에서 찾아 하나씩 **마우스로** 누르고 → 열린 창을 닫고(✕ · Esc)
//      → 다음. 학습 앱 문(음악실 · 코딩 · 물감 …)은 화면 안 창(iframe)이 다 뜰 때까지 기다린다.
//      + 폰(390×800)에서 아래 탭 전부.
//   ② 관리(admin.html?auto): 왼쪽 메뉴 전부 + 그 안의 탭(…Tab( 단추). 그린 글에 `${` · undefined · NaN 이 보이면 adminLiteral.
//   ③ 키오스크(kiosk.html): 첫 화면이 그려지나 + 위 탭 셋.
//   ④ 학습 앱 바로(각 앱 폴더 index.html): 첫 화면 + 선생님 화면(?teacher=1#/t · sessionStorage '<앱>.teacher'='1' 미리)
//      · 음악실은 #/compose/new · #/pick/practice · #/pick/rhythm · #/beat 도.
//  운영 DB 는 절대 안 건드린다: 가짜 서버(shim 이 운영 RTDB 주소를 이 서버로 돌림) + 크롬 이름 풀기 막기 + 요청 막기(cdp.mjs).
//   그래도 운영 주소로 가려던 요청은 막힌 것까지 하나하나 FAIL 로 센다. 영어 복습앱처럼 **바깥 주소**로 여는 문은 누르지 않고
//   '건너뜀'으로 적는다(그 앱은 운영 사이트 · 운영 DB 를 쓴다).
//  오류는 '그때 누르던 것'에 붙여 적는다 — 늦게 나는 오류(타이머 등)는 다음 단추에 붙을 수 있다.
//
//  사용: node scripts/gate/gate.mjs [--only student,admin,kiosk,apps] [--repo <체크아웃>] [--serial] [-v]
//    --only    일부만(쉼표로 여럿). student = 크롬북 홈 + 폰 아래 탭
//    --repo    다른 체크아웃을 시험(기본 = 이 파일이 든 저장소). 가짜 서버 · 이 장치는 이 저장소 것을 쓴다.
//    --serial  화면들을 하나씩 차례로(기본은 네 줄을 함께 — 더 빠름)
//    -v        누른 것 하나하나 · 찾은 오류를 바로 찍음
//    --no-cdn-cache  바깥 라이브러리 · 글꼴을 진짜 CDN 에서(기본은 처음 받은 것을 ~/Library/Caches/class-rpg-gate/cdn 에 두고 씀 · GATE_CACHE)
//    포트: PP(가짜 서버 · 기본 8971) · DP(크롬 디버깅 · 기본 9651) — GPP · GDP 가 있으면 그것. 이미 쓰고 있으면 바로 멈춘다(lsof).
//    CHROME=<헤드리스 크롬 경로> · GATE_LIMIT_S(기본 175 — 이 안에 못 끝나면 크롬 · 서버를 끄고 NOT CLEAN · exit 2)
//  끝줄: `CLEAN — 예외 0 · console.error 0 · …` (exit 0)  ·  `NOT CLEAN — …` (exit 1)  ·  돌리지 못함(포트 · 크롬 · 시간 초과) exit 2
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { openBrowser, Page, CdnCache, PROD_RE, BLOCK_URLS, DEFAULT_CHROME, sleep } from './cdp.mjs';
import { startServer } from '../unit/fake-rtdb/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : d; };
const REPO = path.resolve(opt('--repo', path.resolve(HERE, '..', '..')));
const PHASES = ['student', 'admin', 'kiosk', 'apps'];
const ONLY = opt('--only', PHASES.join(',')).split(',').map(s => s.trim()).filter(Boolean);
const SERIAL = argv.includes('--serial');
const VERBOSE = argv.includes('-v') || argv.includes('--verbose');
const PP = Number(process.env.GPP || process.env.PP || 8971);
const DP = Number(process.env.GDP || process.env.DP || 9651);
const LIMIT_S = Number(process.env.GATE_LIMIT_S || 175);
const CHROME = process.env.CHROME || DEFAULT_CHROME;
const CDN = argv.includes('--no-cdn-cache') ? null
  : new CdnCache(process.env.GATE_CACHE || path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches' : '.cache', 'class-rpg-gate', 'cdn'));
const ORIGIN = `http://127.0.0.1:${PP}`;
const T0 = Date.now();
const SOFT_END = T0 + Math.max(30, LIMIT_S - 20) * 1000;   // 이 뒤로는 새 단추를 안 누르고 '시간이 모자람'으로 적는다
const took = (t) => ((Date.now() - t) / 1000).toFixed(1) + 's';
const log = (...a) => console.log(...a);

function bail(msg, code = 2) { log(`NOT CLEAN — 확인 장치를 돌리지 못함: ${msg}`); process.exit(code); }
if (ONLY.some(x => !PHASES.includes(x))) bail(`--only 는 ${PHASES.join(' · ')} 중에서 (받은 것: ${ONLY.join(',')})`);
if (!fs.existsSync(path.join(REPO, 'student.html'))) bail(`저장소가 아니에요: ${REPO}`);

// ── 무엇을 FAIL 로 세나 · 무엇을 참고로만 적나 ───────────────────────
const KINDS = { exc: '예외', cerr: 'console.error', http: 'http≥400', prod: '운영 주소', literal: 'adminLiteral', render: '안 뜸·못 닫음' };
const found = Object.fromEntries(Object.keys(KINDS).map(k => [k, new Map()]));
const NOTE_KO = { dialog: '대화상자', popup: '새 창', ext: '바깥 파일 실패', covered: '가려져 스크립트로 누름', skip: '건너뜀', fallback: '되살림', ignored: '무시' };
const notes = Object.fromEntries(Object.keys(NOTE_KO).map(k => [k, new Map()]));
//  환경 탓(운영 아님)이라 세지 않는 것 — 하나하나 '무시' 로 수만 보여 준다
const IGNORE = [
  { kind: 'cerr', re: /FIREBASE WARNING/i, why: 'FIREBASE WARNING(SDK 경고)' },
  { kind: 'cerr', re: /favicon/i, why: 'favicon' },
  { kind: 'http', re: /favicon\.ico/i, why: 'favicon' },
];
const hosts = new Set();
const where = (pg) => pg ? `${pg.name} › ${pg.action}` : '-';
function bump(map, key, info) { const o = map.get(key); if (o) o.n++; else map.set(key, { n: 1, ...info }); }
function rec(kind, pg, msg) {
  msg = String(msg || '').slice(0, 300);
  for (const ig of IGNORE) if (ig.kind === kind && ig.re.test(msg)) { bump(notes.ignored, ig.why, { where: where(pg), msg: ig.why }); return; }
  bump(found[kind], where(pg) + ' ‖ ' + msg, { where: where(pg), msg });
  if (VERBOSE) log(`    ✗ [${KINDS[kind]}] ${where(pg)} — ${msg}`);
}
function note(kind, pg, msg) { bump(notes[kind], where(pg) + ' ‖ ' + msg, { where: where(pg), msg: String(msg).slice(0, 200) }); }
const short = (u, n = 100) => String(u || '').replace(ORIGIN, '').replace(/[?&]v=[^&#]*/, '').slice(0, n);
const first = (s) => String(s || '').split('\n')[0].trim();
function at(url, line, st) {
  const f = st && st.callFrames && st.callFrames.find(c => c.url);
  const u = f ? f.url : url, l = f ? f.lineNumber + 1 : (typeof line === 'number' ? line + 1 : null);
  return u ? ` @ ${short(u, 80)}${l ? ':' + l : ''}` : '';
}

// ── 포트: 다른 세션의 서버 · 크롬이 잡고 있으면 바로 멈춘다(옛 장치가 엉뚱한 앱을 시험한 일) ──
function lsofBusy(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  if (r.error) return null;
  const rows = (r.stdout || '').trim().split('\n').slice(1).filter(Boolean);
  return rows.length ? rows.map(l => l.split(/\s+/).slice(0, 2).join(' pid ')).join(', ') : '';
}
const connects = (port) => new Promise(res => {
  const s = net.connect({ port, host: '127.0.0.1' });
  const done = (v) => { s.destroy(); res(v); };
  s.once('connect', () => done(true)); s.once('error', () => done(false)); setTimeout(() => done(false), 800);
});
for (const [name, port] of [['PP(가짜 서버)', PP], ['DP(크롬 디버깅)', DP]]) {
  const who = lsofBusy(port);
  if (who || await connects(port)) bail(`포트 ${port} ${name} 를 이미 누가 쓰고 있어요(${who || '연결됨'}) — 다른 세션의 서버 · 크롬일 수 있어요. GPP=<빈 포트> GDP=<빈 포트> 로 바꿔 돌리세요`);
}

// ── 페이지 안 도우미(문자열로 넣는다) ─────────────────────────────
function gateLib() {
  return {
    vis(el) {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none';
    },
    label(el) { return ((el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.id || el.tagName).replace(/\s+/g, ' ').slice(0, 40); },
    key(el) { const oc = el.getAttribute('onclick') || ''; return oc ? 'oc:' + oc : 'tx:' + this.label(el); },
    list(scope, sel) {
      const root = document.querySelector(scope);
      if (!root) return null;
      const seen = new Map();
      return [...root.querySelectorAll(sel)].filter(el => this.vis(el)).map(el => {
        const k = this.key(el), nth = seen.get(k) || 0; seen.set(k, nth + 1);
        return { k, nth, oc: el.getAttribute('onclick') || '', text: this.label(el), tag: el.tagName.toLowerCase(), href: el.getAttribute('href') || '' };
      });
    },
    find(scope, sel, t) {
      const root = document.querySelector(scope);
      if (!root) return null;
      let n = 0;
      for (const el of root.querySelectorAll(sel)) { if (this.vis(el) && this.key(el) === t.k && n++ === t.nth) return el; }
      return null;
    },
    //  누를 자리: 화면 안으로 굴린 뒤 가운데(가려졌으면 네 점 더). 그 점에 이 단추(또는 그 안)가 맞나 elementFromPoint 로 본다
    aim(el) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return { hidden: true };
      const W = innerWidth, H = innerHeight;
      const px = (f) => Math.round(Math.min(Math.max(r.left + r.width * f, 1), W - 2));
      const py = (f) => Math.round(Math.min(Math.max(r.top + r.height * f, 1), H - 2));
      const pts = [[px(.5), py(.5)], [px(.25), py(.5)], [px(.75), py(.5)], [px(.5), py(.3)], [px(.5), py(.7)]];
      window.__gateEl = el;
      let hit = null;
      for (const [x, y] of pts) { const h = document.elementFromPoint(x, y); if (h && (h === el || el.contains(h))) return { x, y, ok: true }; hit = hit || h; }
      const d = (e) => !e ? '없음' : e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
      return { x: pts[0][0], y: pts[0][1], ok: false, hit: d(hit) };
    },
    //  지금 열린 큰 덮개(화면 25% 넘게 덮는 fixed/absolute) — base(아무것도 안 연 홈)에 있던 것은 뺀다. 위에 있는 것부터
    state(base) {
      const W = innerWidth, H = innerHeight, out = [];
      const cands = new Set([...document.body.children, ...document.querySelectorAll('.overlay.open, [id^="m-"], #interior-fullscreen')]);
      for (const el of cands) {
        if (!this.vis(el)) continue;
        const cs = getComputedStyle(el);
        if ((cs.position !== 'fixed' && cs.position !== 'absolute') || +cs.opacity === 0) continue;
        const r = el.getBoundingClientRect();
        const a = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
        if (a < W * H * 0.25) continue;
        const name = el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
        if (base && base.includes(name)) continue;
        out.push({ name, z: parseInt(cs.zIndex, 10) || 0 });
      }
      out.sort((a, b) => b.z - a.z);
      const g = document.getElementById('s-game');
      return { extra: out.map(o => o.name), path: location.pathname, cur: (typeof CUR !== 'undefined' && CUR) ? CUR.id : null, sec: g ? (g.dataset.homeSec || '') : '' };
    },
    //  덮개 안의 닫기: aria-label 닫기 → .modal-close → ✕·닫기·나가기 글 → onclick 에 close/닫
    closer(name) {
      let root = null;
      try { root = name[0] === '#' ? document.getElementById(name.slice(1)) : document.querySelector(name); } catch (e) {}
      if (!root) return null;
      const score = (e) => {
        const oc = e.getAttribute('onclick') || '', t = (e.innerText || '').trim();
        if (e.getAttribute('aria-label') === '닫기') return 0;
        if (e.classList.contains('modal-close')) return 1;
        if (/^(✕|×|✖|X|닫기|나가기|돌아가기|← ?돌아가기|뒤로|그만하기)$/.test(t)) return 2;
        if (/close|Close|닫/.test(oc)) return 3;
        return 9;
      };
      const best = [...root.querySelectorAll('[aria-label="닫기"], .modal-close, button, [onclick], [role="button"]')]
        .filter(e => this.vis(e)).map(e => [score(e), e]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0])[0];
      return best ? best[1] : null;
    },
  };
}
const L = `(window.__gate || (window.__gate = (${gateLib.toString()})()))`;
const CLICKABLE = '[onclick], [role="button"], button, a[href]';
const J = (v) => JSON.stringify(v);

// ── 서버 · 크롬 ──────────────────────────────────────────────
let srv = null, B = null, cleaned = false;
const cleanup = async () => {
  if (cleaned) return; cleaned = true;
  try { if (B) await B.close(); } catch (e) {}
  try { if (srv) await Promise.race([srv.close(), sleep(2000)]); } catch (e) {}
};
const killer = setTimeout(async () => {
  log(`\n시간 초과 — ${LIMIT_S}초 안에 못 끝남. 지금까지 찾은 것:`);
  printFound();
  log(`NOT CLEAN — 시간 초과(${LIMIT_S}초) · ${tally()}`);
  await cleanup(); process.exit(2);
}, LIMIT_S * 1000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { log(`\n${sig} — 크롬 · 서버를 끄고 멈춤`); await cleanup(); process.exit(2); });
process.on('exit', () => { try { if (B) B.proc.kill('SIGKILL'); } catch (e) {} });

try {
  srv = await startServer({ port: PP, host: '127.0.0.1', repo: REPO, quiet: true });
} catch (e) { bail(`가짜 서버를 못 켬(포트 ${PP}): ${e.message}`); }
//  이 포트에서 답하는 것 = 방금 켠 가짜 서버 + 이 저장소 파일?
try {
  const stats = await (await fetch(`${ORIGIN}/.fake/stats`)).json();
  const js = await (await fetch(`${ORIGIN}/student.js`)).text();
  const html = await (await fetch(`${ORIGIN}/student.html`)).text();
  if (!stats || js !== fs.readFileSync(path.join(REPO, 'student.js'), 'utf8') || !html.includes('/.fake/shim.js')) throw new Error('다른 서버 · 다른 저장소가 답함');
} catch (e) { await cleanup(); bail(`가짜 서버 확인 실패: ${e.message}`); }

// ── 이벤트 → 기록 ────────────────────────────────────────────
const owner = new Map();     // 세션 id → Page(다른 출처 iframe · 워커 세션도 그 탭으로)
const reqUrl = new Map();
const pageByTarget = new Map();
const popups = new Map();
async function onAttached(parentSid, p) {
  const pg = owner.get(parentSid), sid = p.sessionId, ti = p.targetInfo || {};
  const s = (m, prm) => B.send(m, prm || {}, sid, 5000).catch(() => {});
  try {
    if (pg) {
      owner.set(sid, pg);
      await Promise.all([s('Runtime.enable'), s('Network.enable'), s('Log.enable')]);
      await s('Network.setBlockedURLs', { urls: BLOCK_URLS });
      if (ti.type === 'iframe') await s('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
      if (VERBOSE) log(`    · 붙음 ${ti.type} ${short(ti.url, 80)}`);
    }
  } finally { if (p.waitingForDebugger) await s('Runtime.runIfWaitingForDebugger'); }
}
//  CDN 파일(Blockly · Firebase SDK · 글꼴) — 저장본으로 바로 준다. 못 받으면 크롬이 직접 받게 둔다
async function onPaused(sid, p) {
  const send = (m, prm) => B.send(m, prm, sid, 30000).catch(() => {});
  const req = p.request || {};
  if (!CDN || req.method !== 'GET') return send('Fetch.continueRequest', { requestId: p.requestId });
  try {
    const r = await CDN.get(req.url, req.headers || {});
    return send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: r.status, responseHeaders: r.headers, body: r.body.toString('base64') });
  } catch (e) { return send('Fetch.continueRequest', { requestId: p.requestId }); }
}
function onEvent(sid, method, p) {
  if (!sid) {
    //  window.open · target=_blank 새 창: 적고 잠시 뒤 닫는다(연 쪽 코드가 끝날 틈을 준다)
    if (method === 'Target.targetCreated' || method === 'Target.targetInfoChanged') {
      const ti = p.targetInfo || {};
      if (ti.type !== 'page') return;
      if (method === 'Target.targetCreated' && ti.openerId && pageByTarget.has(ti.openerId)) {
        const pg = pageByTarget.get(ti.openerId);
        popups.set(ti.targetId, pg);
        note('popup', pg, ti.url || 'about:blank');
        setTimeout(() => B && B.send('Target.closeTarget', { targetId: ti.targetId }).catch(() => {}), 1500);
      }
      if (popups.has(ti.targetId) && PROD_RE.test(ti.url || '')) rec('prod', popups.get(ti.targetId), '새 창 ' + short(ti.url, 120));
    }
    return;
  }
  if (method === 'Target.attachedToTarget') { onAttached(sid, p); return; }
  if (method === 'Fetch.requestPaused') { onPaused(sid, p); return; }
  const pg = owner.get(sid);
  if (!pg) return;
  switch (method) {
    case 'Runtime.exceptionThrown': {
      const d = p.exceptionDetails || {};
      const desc = (d.exception && (d.exception.description || (d.exception.value !== undefined ? String(d.exception.value) : ''))) || d.text || '';
      rec('exc', pg, first(desc) + at(d.url, d.lineNumber, d.stackTrace));
      break;
    }
    case 'Runtime.consoleAPICalled': {
      if (p.type !== 'error' && p.type !== 'assert') break;
      const txt = (p.args || []).map(a => a.value !== undefined ? (typeof a.value === 'object' ? J(a.value) : String(a.value)) : (a.description || a.type)).join(' ');
      rec('cerr', pg, first(txt) + at(null, null, p.stackTrace));
      break;
    }
    case 'Log.entryAdded': {   // 브라우저가 내는 오류(보안 · 개입 등). 'Failed to load resource'(network)는 아래 네트워크 칸에서 센다
      const e = p.entry || {};
      if (e.level === 'error' && e.source !== 'network') rec('cerr', pg, first(e.text) + (e.url ? ' @ ' + short(e.url, 80) : ''));
      break;
    }
    case 'Network.requestWillBeSent': {
      const u = (p.request && p.request.url) || '';
      reqUrl.set(sid + ':' + p.requestId, u);
      try { const h = new URL(u).host; if (h && !u.startsWith(ORIGIN)) hosts.add(h); } catch (e) {}
      if (PROD_RE.test(u)) rec('prod', pg, short(u, 120));
      break;
    }
    case 'Network.webSocketCreated': {
      const u = p.url || '';
      if (PROD_RE.test(u)) rec('prod', pg, 'WebSocket ' + short(u, 120));
      else if (!u.startsWith(ORIGIN.replace('http', 'ws'))) note('ext', pg, 'WebSocket ' + short(u, 100));
      break;
    }
    case 'Network.responseReceived': {
      const r = p.response || {};
      if (r.status >= 400 && String(r.url).startsWith(ORIGIN)) rec('http', pg, `${r.status} ${short(r.url)}`);
      break;
    }
    case 'Network.loadingFailed': {
      const u = reqUrl.get(sid + ':' + p.requestId) || '';
      if (p.canceled || /ERR_ABORTED/.test(p.errorText || '') || PROD_RE.test(u)) break;   // 운영 주소는 보내려던 순간 이미 셈
      if (u.startsWith(ORIGIN)) rec('http', pg, `불러오기 실패 ${p.errorText} ${short(u)}`);
      else if (u && !/^(data|blob):/.test(u)) note('ext', pg, `${p.errorText} ${short(u, 100)}`);
      break;
    }
    case 'Page.javascriptDialogOpening': {   // alert · confirm 은 '예' · prompt 는 '취소'(넣을 말을 모름)
      note('dialog', pg, `${p.type}: ${first(p.message).slice(0, 80)}`);
      if (p.type === 'prompt') pg.prompted = true;
      B.send('Page.handleJavaScriptDialog', { accept: p.type !== 'prompt' }, sid).catch(() => {});
      break;
    }
    case 'Inspector.targetCrashed': rec('exc', pg, '렌더러가 멈춤(crash)'); break;
  }
}

try {
  B = await openBrowser({ chrome: CHROME, port: DP, onEvent });
  await B.send('Target.setDiscoverTargets', { discover: true });
} catch (e) { await cleanup(); bail(e.message); }
const head = (spawnSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout || '?').trim();
log(`[GATE-1] 넣기 전 확인 장치 — ${REPO} (HEAD ${head}) · 가짜 서버 ${ORIGIN} · 크롬 ${DP}${B.pidChecked ? '(내가 띄운 것 확인)' : ''} · ${B.version} · ${ONLY.join(',')}${SERIAL ? ' · 차례로' : ''}`);

async function newPage(name, opts) {
  const pg = new Page(B, name);
  const sid = await pg.attach();
  owner.set(sid, pg); pageByTarget.set(pg.targetId, pg);
  await pg.setup({ ...opts, cdn: !!CDN });
  return pg;
}
//  누르기: 찾은 단추를 화면 안으로 굴려 그 자리를 마우스로. 다른 것에 가려졌으면 스크립트 click() + '가려짐' 참고
async function clickBy(pg, findExpr) {
  const r = await pg.evSafe(`(() => { const el = ${findExpr}; return el ? ${L}.aim(el) : null; })()`);
  if (!r) return { how: 'gone' };
  if (r.hidden) return { how: 'hidden' };
  if (r.ok) { await pg.click(r.x, r.y); return { how: 'mouse' }; }
  await pg.evSafe(`window.__gateEl && window.__gateEl.click()`);
  note('covered', pg, `위에 ${r.hit}`);
  return { how: 'js', hit: r.hit };
}
const late = () => Date.now() > SOFT_END;

// ══ ① 학생 — 크롬북 1366×610 ══════════════════════════════════
const SEC_KO = { today: '오늘', learn: '배우고 만들기', me: '나의 공간', adv: '모험' };
const doors = { today: 0, adv: 0, learn: 0, me: 0, hud: 0, phone: 0 };
const stu = { opened: 0, embeds: 0, embedApps: [], skipped: [], left: 0 };

async function studentHome(pg, mobile) {
  pg.action = '입장';
  const ok = await pg.goto(`${ORIGIN}/student.html?as=s1`).catch(e => { rec('render', pg, e.message); return false; });
  const box = mobile ? '#mob-main-tab' : '#main-area';
  if (!ok || !await pg.until(`typeof CUR !== 'undefined' && !!CUR && CUR.id === 's1' && document.querySelectorAll('${box} .home-sec').length === 4`, 20000)) {
    rec('render', pg, '학생 홈이 안 뜸(?as=s1 입장 · 홈 네 구역)'); return null;
  }
  await sleep(1200);   // 첫 그리기 뒤 늦게 오는 구독 · 그림
  const st = await pg.evSafe(`${L}.state(null)`);
  return st ? st.extra : [];
}
//  누른 뒤: 무엇이 열렸나 보고(학습 앱 창이면 다 뜰 때까지) → 닫기. 못 닫으면 다시 들어가고 '못 닫음'
async function afterClick(pg, ctx) {
  await sleep(450);
  let st = await pg.evSafe(`${L}.state(${J(ctx.base)})`);
  if (!st) { rec('render', pg, '누른 뒤 페이지가 답하지 않음'); ctx.base = await studentHome(pg, ctx.mobile); return; }
  if (st.path !== '/student.html') { note('fallback', pg, `다른 페이지로 감(${st.path}) → 다시 들어감`); ctx.base = await studentHome(pg, ctx.mobile); return; }
  const what = st.extra.slice();
  if (what.length) stu.opened++;
  if (what.includes('#m-embed')) {
    stu.embeds++;
    const src = await pg.evSafe(`(document.getElementById('embed-frame') || {}).getAttribute ? document.getElementById('embed-frame').getAttribute('src') : ''`) || '';
    const app = (src.match(/^([a-z]+)\//) || [])[1] || short(src, 30);
    stu.embedApps.push(app);
    pg.action += ` [${app}]`;
    const ok = await pg.until(`(() => { const f = document.getElementById('embed-frame'); if (!f) return false;
      const fb = document.getElementById('embed-fallback'); if (fb && fb.style.display === 'flex') return true;
      let d; try { d = f.contentDocument; } catch (e) { return true; }
      if (!d || d.readyState !== 'complete' || d.location.href === 'about:blank') return false;
      const a = d.getElementById('app') || d.body; return !!a && (a.children.length > 0 || (a.innerText || '').trim().length > 0); })()`, 12000);
    if (!ok) {
      const why = await pg.evSafe(`(() => { const d = document.getElementById('embed-frame').contentDocument; return d ? 'readyState ' + d.readyState + ' · #app ' + ((d.getElementById('app') || {}).children || []).length : '문서 없음'; })()`);
      rec('render', pg, `학습 앱 창이 12초 안에 안 뜸(${why || '?'})`);
    }
    else if (await pg.evSafe(`(document.getElementById('embed-fallback') || {}).style?.display === 'flex'`)) rec('render', pg, '학습 앱 창이 "앱을 불러오지 못했어요"');
    await sleep(1000);   // 앱 안에서 데이터 받은 뒤 그리며 나는 오류까지
  } else if (what.length) await sleep(350);
  if (VERBOSE) log(`    · ${where(pg)} → ${what.length ? what.join(' ') + ' 열림' : '덮개 없음'}`);
  const closed = await closeAll(pg, ctx.base);
  if (closed === 'js') note('fallback', pg, `닫기 단추 · Esc 로 안 닫혀 앱 함수로 닫음(${what.join(' ')})`);
  if (!closed) { rec('render', pg, `열린 창이 안 닫힘: ${what.join(' ')}`); ctx.base = await studentHome(pg, ctx.mobile); }
}
async function closeAll(pg, base) {
  for (let round = 0; round < 7; round++) {
    const st = await pg.evSafe(`${L}.state(${J(base)})`);
    if (!st) return false;
    if (!st.extra.length) {
      if (round === 0) return true;
      await sleep(300);   // 닫은 뒤 늦게 열리는 것(지연 로드 등)까지 한 번 더 본다
      const again = await pg.evSafe(`${L}.state(${J(base)})`);
      if (again && !again.extra.length) return true;
      continue;
    }
    let r = { how: 'gone' };
    if (round < 5) r = await clickBy(pg, `${L}.closer(${J(st.extra[0])})`);
    if (r.how === 'gone' || r.how === 'hidden' || round >= 3) await pg.key('Escape').catch(() => {});
    await sleep(round < 2 ? 280 : 450);
  }
  await pg.evSafe(`(() => { try { closeExternalEmbed(); } catch (e) {} try { if (typeof _ifMode !== 'undefined' && _ifMode) closeInteriorFullscreen(); } catch (e) {}
    try { if (typeof closeArtFree === 'function') closeArtFree(); } catch (e) {}
    document.querySelectorAll('.overlay.open').forEach(o => { try { closeModal(o.id); } catch (e) { o.classList.remove('open'); } }); })()`);
  await sleep(400);
  const st = await pg.evSafe(`${L}.state(${J(base)})`);
  return st && !st.extra.length ? 'js' : false;
}
async function selectSec(pg, sec) {
  await clickBy(pg, `document.querySelector('#home-rail .hr-item[data-sec="${sec}"]')`);
  if (!await pg.until(`document.getElementById('s-game').dataset.homeSec === '${sec}'`, 2500)) rec('render', pg, `홈 구역 '${SEC_KO[sec]}' 로 안 바뀜`);
  await sleep(150);
}
//  한 구역(scope) 안의 누를 것을 차례로
async function pressAll(pg, ctx, { scope, region, ext, ensure, label }) {
  const list = await pg.evSafe(`${L}.list(${J(scope)}, ${J(CLICKABLE)})`);
  if (!list) { rec('render', pg, `${label} 구역을 못 찾음(${scope})`); return; }
  for (const t of list) {
    pg.action = `${label} › "${t.text}"`;
    if (t.tag === 'a' && !t.oc) { stu.skipped.push(`${label}: 링크 "${t.text}"`); note('skip', pg, `링크(누르지 않음) ${short(t.href, 60)}`); continue; }
    const ek = ext.find(k => t.oc.includes(`openExternalEmbed('${k}'`));
    if (ek) { stu.skipped.push(`${label}: ${ek}(바깥 주소)`); note('skip', pg, `바깥 주소 앱(${ek}) — 운영 사이트라 누르지 않음`); continue; }
    if (late()) { stu.left++; continue; }
    if (ensure) await ensure();
    const r = await clickBy(pg, `${L}.find(${J(scope)}, ${J(CLICKABLE)}, ${J({ k: t.k, nth: t.nth })})`);
    if (r.how === 'gone' || r.how === 'hidden') { note('skip', pg, '다시 그려진 뒤 못 찾음'); continue; }
    doors[region]++;
    await afterClick(pg, ctx);
  }
}
async function phaseStudent() {
  const t0 = Date.now();
  const pg = await newPage('학생', { width: 1366, height: 610 });
  const ctx = { base: await studentHome(pg, false), mobile: false };
  if (!ctx.base) return { line: `학생   홈이 안 떠서 멈춤 · ${took(t0)}` };
  const ext = await pg.evSafe(`(() => { try { return externalStudyItems().filter(x => { try { return new URL(x.href, location.href).origin !== location.origin; } catch (e) { return true; } }).map(x => x.key); } catch (e) { return []; } })()`) || [];
  for (const sec of ['today', 'learn', 'me', 'adv']) {
    pg.action = `${SEC_KO[sec]} 고르기`;
    await selectSec(pg, sec);
    const ensure = async () => {
      const st = await pg.evSafe(`${L}.state(${J(ctx.base)})`);
      if (!st || st.path !== '/student.html' || st.cur !== 's1') { note('fallback', pg, '홈이 아니어서 다시 들어감'); ctx.base = await studentHome(pg, false); }
      else if (st.extra.length) { const c = await closeAll(pg, ctx.base); if (!c) { rec('render', pg, `남은 창이 안 닫힘: ${st.extra.join(' ')}`); ctx.base = await studentHome(pg, false); } }
      const s2 = await pg.evSafe(`${L}.state(${J(ctx.base)})`);
      if (s2 && s2.sec !== sec) await selectSec(pg, sec);
    };
    await pressAll(pg, ctx, { scope: `#main-area .home-sec[data-sec="${sec}"]`, region: sec, ext, ensure, label: SEC_KO[sec] });
  }
  //  HUD(위 띠) — 아바타 · 승급 배지 등
  await pressAll(pg, ctx, { scope: '.hud', region: 'hud', ext, label: 'HUD' });
  await pg.close();
  return { line: `학생   doors ${J(doors)} · 열린 창 ${stu.opened} · 학습 앱 창 ${stu.embeds}(${[...new Set(stu.embedApps)].join(' ')})`
    + `${stu.skipped.length ? ` · 건너뜀 ${stu.skipped.length}(${[...new Set(stu.skipped)].join(' · ')})` : ''}${stu.left ? ` · 시간이 모자라 못 누름 ${stu.left}` : ''} · ${took(t0)}` };
}
// ══ ① 학생 — 폰 390×800 아래 탭 ═════════════════════════════════
async function phasePhone() {
  const t0 = Date.now();
  const pg = await newPage('학생 폰', { width: 390, height: 800, mobile: true, scale: 2, touch: true });
  const ctx = { base: await studentHome(pg, true), mobile: true };
  if (!ctx.base) return { line: `학생 폰 홈이 안 떠서 멈춤 · ${took(t0)}` };
  const list = await pg.evSafe(`${L}.list('.bottom-tabs', '.btab')`) || [];
  if (!list.length) rec('render', pg, '아래 탭이 안 보임');
  for (const t of list) {
    pg.action = `아래 탭 "${t.text}"`;
    if (late()) { stu.left++; continue; }
    const st = await pg.evSafe(`${L}.state(${J(ctx.base)})`);
    if (!st || st.cur !== 's1') ctx.base = await studentHome(pg, true);
    const r = await clickBy(pg, `${L}.find('.bottom-tabs', '.btab', ${J({ k: t.k, nth: t.nth })})`);
    if (r.how === 'gone' || r.how === 'hidden') { note('skip', pg, '못 찾음'); continue; }
    doors.phone++;
    await afterClick(pg, ctx);
  }
  await pg.close();
  return { line: `학생 폰 아래 탭 ${doors.phone} · ${took(t0)}` };
}

// ══ ② 관리 ══════════════════════════════════════════════════
const LITERAL = `(() => {
  const root = document.querySelector('.page.active');
  const t = ((document.getElementById('topbar-title') || {}).innerText || '') + '\\n' + (root ? root.innerText : '');
  const out = [], re = /\\$\\{|\\bundefined\\b|\\bNaN\\b/g; let m;
  while ((m = re.exec(t)) && out.length < 5) out.push(t.slice(Math.max(0, m.index - 24), m.index + 30).replace(/\\s+/g, ' '));
  return out;
})()`;
const adm = { nav: 0, inner: 0, literal: 0 };
async function adminLiteral(pg) {
  const hits = await pg.evSafe(LITERAL) || [];
  for (const h of hits) { adm.literal++; rec('literal', pg, `"…${h}…"`); }
}
async function phaseAdmin() {
  const t0 = Date.now();
  const pg = await newPage('관리', { width: 1366, height: 610 });
  pg.action = '입장';
  const ok = await pg.goto(`${ORIGIN}/admin.html?auto`).catch(e => { rec('render', pg, e.message); return false; });
  if (!ok || !await pg.until(`(document.getElementById('admin-app') || {}).style?.display === 'grid'`, 20000)) { rec('render', pg, '관리 화면이 안 열림(?auto 입장)'); await pg.close(); return { line: `관리   입장 실패 · ${took(t0)}` }; }
  await sleep(1000);
  const navs = await pg.evSafe(`${L}.list('#admin-sidebar', '.nav-item')`) || [];
  if (!navs.length) rec('render', pg, '왼쪽 메뉴가 안 보임');
  for (const n of navs) {
    const name = n.text.replace(/\s+\d+$/, '');
    pg.action = `메뉴 "${name}"`;
    if (late()) { adm.left = (adm.left || 0) + 1; continue; }
    const page = (n.oc.match(/nav\('([^']+)'/) || [])[1];
    const r = await clickBy(pg, `${L}.find('#admin-sidebar', '.nav-item', ${J({ k: n.k, nth: n.nth })})`);
    if (r.how === 'gone' || r.how === 'hidden') { rec('render', pg, '메뉴를 못 누름'); continue; }
    adm.nav++;
    if (page && !await pg.until(`!!document.querySelector('#p-${page}.active')`, 4000)) rec('render', pg, `페이지 #p-${page} 가 안 열림`);
    await sleep(650);   // 비동기로 그리는 칸(REST 읽기 등)
    await adminLiteral(pg);
    //  그 페이지 안의 탭(switchQuestTab · battleTab · switchShopTab …)
    const inner = (await pg.evSafe(`${L}.list('.page.active', '[onclick]')`) || []).filter(t => /^\s*\w*Tab\(/.test(t.oc));
    for (const t of inner) {
      pg.action = `메뉴 "${name}" › 탭 "${t.text}"`;
      if (late()) { adm.left = (adm.left || 0) + 1; continue; }
      const r2 = await clickBy(pg, `${L}.find('.page.active', '[onclick]', ${J({ k: t.k, nth: t.nth })})`);
      if (r2.how === 'gone' || r2.how === 'hidden') { note('skip', pg, '탭을 못 찾음'); continue; }
      adm.inner++;
      await sleep(350);
      await adminLiteral(pg);
    }
  }
  await pg.close();
  return { line: `관리   tabs ${J({ nav: adm.nav, inner: adm.inner })} · adminLiteral ${adm.literal}${adm.left ? ` · 시간이 모자라 못 누름 ${adm.left}` : ''} · ${took(t0)}` };
}

// ══ ③ 키오스크 ═══════════════════════════════════════════════
async function phaseKiosk() {
  const t0 = Date.now();
  const pg = await newPage('키오스크', { width: 1366, height: 610 });
  pg.action = '첫 화면';
  const ok = await pg.goto(`${ORIGIN}/kiosk.html`).catch(e => { rec('render', pg, e.message); return false; });
  if (!ok || !await pg.until(`(() => { const m = document.getElementById('main-wrap'), c = document.getElementById('kiosk-content'); return !!m && m.style.display !== 'none' && !!c && c.children.length > 0; })()`, 20000)) {
    rec('render', pg, '키오스크 첫 화면(#kiosk-content)이 안 그려짐'); await pg.close(); return { line: `키오스크 첫 화면 실패 · ${took(t0)}` };
  }
  await sleep(800);
  const tabs = await pg.evSafe(`${L}.list('#header', '.kiosk-tab')`) || [];
  let n = 0;
  for (const t of tabs) {
    pg.action = `탭 "${t.text}"`;
    const r = await clickBy(pg, `${L}.find('#header', '.kiosk-tab', ${J({ k: t.k, nth: t.nth })})`);
    if (r.how === 'gone' || r.how === 'hidden') continue;
    n++;
    await sleep(600);
  }
  await pg.close();
  return { line: `키오스크 첫 화면 OK · tabs ${n} · ${took(t0)}` };
}

// ══ ④ 학습 앱 바로 ════════════════════════════════════════════
const MUSIC_ROUTES = ['#/compose/new', '#/pick/practice', '#/pick/rhythm', '#/beat'];
function appSources(dir) {
  const out = [];
  const walk = (d, depth) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 2 && !['vendor', 'assets', 'img', 'videos', 'stages'].includes(e.name)) walk(f, depth + 1); }
      else if (/\.(m?js|html)$/.test(e.name) && fs.statSync(f).size < 3e6) out.push(fs.readFileSync(f, 'utf8'));
    }
  };
  walk(dir, 0);
  return out.join('\n');
}
const RENDERED = `(() => { const a = document.getElementById('app') || document.body; return !!a && a.children.length > 0 && (document.body.innerText || '').trim().length > 0; })()`;
async function phaseApps() {
  const t0 = Date.now();
  const apps = fs.readdirSync(REPO, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !['docs', 'scripts', 'assets', 'common', 'node_modules'].includes(d.name) && fs.existsSync(path.join(REPO, d.name, 'index.html')))
    .map(d => d.name).sort();
  //  선생님 문 키 · #/t 길 — 앱 파일에서 읽는다(생각판 = tb.teacher · 수채화 = wc.teacher(localStorage) · 수업 TV = 첫 화면이 곧 선생님 화면)
  const info = apps.map(a => {
    const src = appSources(path.join(REPO, a));
    const key = (src.match(/['"]([a-z]+\.teacher)['"]/) || [])[1] || '';
    const local = !!key && new RegExp(`localStorage\\.getItem\\(['"]${key.replace('.', '\\.')}['"]`).test(src);
    const tRoute = /['"]#\/t['"]|parts\[0\] === 't'|=== '\/t'/.test(src);
    return { a, key, local, tRoute };
  });
  const keys = info.filter(i => i.key && !i.local).map(i => i.key);
  const init = `try { ${keys.map(k => `sessionStorage.setItem(${J(k)}, '1');`).join(' ')} } catch (e) {}`;
  const pg = await newPage('학습 앱', { width: 1366, height: 610, init });
  const cnt = { home: 0, teacher: 0, music: 0 };
  const check = async (label, url, kind, it) => {
    pg.action = label; pg.prompted = false;
    if (late()) { cnt.left = (cnt.left || 0) + 1; return; }
    const ok = await pg.goto(url, 15000).catch(e => { rec('render', pg, e.message); return false; });
    if (!ok || !await pg.until(RENDERED, 10000)) rec('render', pg, '화면이 안 그려짐');
    await sleep(1100);   // 데이터 받은 뒤 그리며 나는 오류까지
    if (kind === 'teacher' && pg.prompted) rec('render', pg, `선생님 문이 비밀번호를 물음 — 미리 넣은 '${it.key}' 가 안 먹음`);
    cnt[kind]++;
  };
  for (const it of info) {
    await check(`${it.a}/ 첫 화면`, `${ORIGIN}/${it.a}/index.html`, 'home', it);
    if (it.a === 'music') {
      for (const r of MUSIC_ROUTES) {
        pg.action = `music/ ${r}`;
        if (late()) { cnt.left = (cnt.left || 0) + 1; continue; }
        await pg.evSafe(`location.hash = ${J(r)}`);
        await sleep(300);
        if (!await pg.until(RENDERED, 6000)) rec('render', pg, '화면이 안 그려짐');
        await sleep(900);
        cnt.music++;
      }
    }
    if (it.key && (it.tRoute || it.local)) {
      if (it.local) await pg.evSafe(`localStorage.setItem(${J(it.key)}, '1')`);
      await check(`${it.a}/ 선생님 화면`, `${ORIGIN}/${it.a}/index.html?teacher=1${it.tRoute ? '#/t' : ''}`, 'teacher', it);
      if (it.local) await pg.evSafe(`localStorage.removeItem(${J(it.key)})`);
    }
  }
  await pg.close();
  return { line: `학습 앱 pages ${J({ home: cnt.home, teacher: cnt.teacher, music: cnt.music })} (${apps.join(' ')})${cnt.left ? ` · 시간이 모자라 못 봄 ${cnt.left}` : ''} · ${took(t0)}` };
}

// ── 돌리기 ──────────────────────────────────────────────────
function tally() {
  const n = (k) => [...found[k].values()].reduce((a, v) => a + v.n, 0);
  return `예외 ${n('exc')} · console.error ${n('cerr')} · http≥400 ${n('http')} · 운영 주소 ${n('prod')} · adminLiteral ${n('literal')} · 안 뜸·못 닫음 ${n('render')}`;
}
function printFound() {
  for (const k of Object.keys(KINDS)) for (const v of found[k].values()) log(`  [${KINDS[k]}] ${v.where} — ${v.msg}${v.n > 1 ? ` (×${v.n})` : ''}`);
}
const lanes = [];
if (ONLY.includes('student')) lanes.push([phaseStudent], [phasePhone]);
if (ONLY.includes('admin')) lanes.push([phaseAdmin]);
if (ONLY.includes('kiosk')) lanes.push([phaseKiosk]);
if (ONLY.includes('apps')) lanes.push([phaseApps]);
const lines = [];
const runLane = async (fns) => {
  for (const fn of fns) {
    try { const r = await fn(); if (r && r.line) { lines.push(r.line); log(r.line); } }
    catch (e) { rec('render', { name: fn.name, action: '진행' }, `확인 장치가 멈춤: ${first(e && e.message)}`); log(`${fn.name} 멈춤: ${e && e.message}`); }
  }
};
if (SERIAL) { for (const l of lanes) await runLane(l); }
else await Promise.all(lanes.map(runLane));

clearTimeout(killer);
await sleep(300);   // 마지막 이벤트까지
const extHosts = [...hosts].sort();
log(`바깥 호스트: ${extHosts.join(', ') || '없음'}${CDN ? ` · CDN 저장본 ${CDN.stat.hit} · 새로 받음 ${CDN.stat.miss}${CDN.stat.fail ? ` · 못 받음 ${CDN.stat.fail}` : ''}` : ' · CDN 저장본 안 씀'}`);
const noteLine = Object.keys(NOTE_KO).map(k => [k, [...notes[k].values()].reduce((a, v) => a + v.n, 0)]).filter(([, n]) => n).map(([k, n]) => `${NOTE_KO[k]} ${n}`);
if (noteLine.length) log(`참고(FAIL 아님): ${noteLine.join(' · ')}`);
if (VERBOSE) for (const k of Object.keys(NOTE_KO)) for (const v of notes[k].values()) log(`  (${NOTE_KO[k]}) ${v.where} — ${v.msg}${v.n > 1 ? ` (×${v.n})` : ''}`);
else for (const k of ['covered', 'fallback']) for (const v of notes[k].values()) log(`  (${NOTE_KO[k]}) ${v.where} — ${v.msg}`);
await cleanup();
const bad = Object.keys(KINDS).some(k => found[k].size);
if (bad) { log('── 찾은 것 ──'); printFound(); }
log(`${bad ? 'NOT CLEAN' : 'CLEAN'} — ${tally()} · 전체 ${took(T0)}`);
process.exit(bad ? 1 : 0);
