#!/usr/bin/env node
// 우리반 RPG — 시연·여러 기기 시험용 가짜 Realtime Database 서버 [FAKE-RTDB-1]
//
//  무엇: Node 하나로 ① 저장소 폴더를 정적으로 서빙하고 ② Firebase compat SDK 9.23 이 쓰는 RTDB WebSocket 프로토콜을
//        흉내 낸다. 학생·관리·키오스크·하위 앱 화면이 **같은 메모리 DB 를 실시간으로** 함께 쓴다. 운영 DB 통신 0.
//        - html 을 내줄 때 shim.js 를 끼운다(맨 앞: 운영 주소로 가는 WebSocket·fetch 를 이 서버로 돌림 /
//          database SDK 바로 뒤: 가짜 프로젝트 initializeApp · firestore·storage 막기 · ?as=<학생> 자동 입장).
//        - 이 서버는 바깥으로 요청을 하나도 보내지 않는다(받기만 한다). 데이터는 메모리 — 끄면 사라진다.
//  흉내 내는 것: listen(q, 태그 쿼리 orderByKey/Child/Value · startAt/endAt · limit) · unlisten · put · merge ·
//        transaction(해시 조건 → datastale) · ServerValue.increment/timestamp · get · onDisconnect · REST 읽기(shallow)·쓰기 · SSE.
//  실행: node scripts/unit/fake-rtdb/server.mjs 8870            → http://127.0.0.1:8870/.fake/
//        --seed <json> (기본 seed.json) · --repo <폴더> (기본 이 저장소) · --lan (같은 와이파이 기기도 접속 · 0.0.0.0)
//        --demo  한 화면 네 칸 시연판(/.fake/demo) — 학생 A · B 칸은 포트+1 · 포트+2 로 따로 연다(같은 DB · 저장소는 따로) [CLASS-DEMO-1]
//  시험: node scripts/unit/fake-rtdb/fake-rtdb.test.mjs (브라우저 없이 프로토콜만)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, '..', '..', '..');

// ── 값·경로 도우미 ─────────────────────────────────────────
const seg = (p) => String(p || '').split('/').filter(Boolean);
const join = (p) => seg(p).join('/');
const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
//  RTDB 처럼 저장: 배열 → 번호 키 객체 · null/빈 객체는 없앰
function norm(v) {
  if (v == null) return null;
  if (typeof v !== 'object') return (typeof v === 'number' && !Number.isFinite(v)) ? null : v;
  const o = {};
  for (const k of Object.keys(v)) { const c = norm(v[k]); if (c != null) o[k] = c; }
  return Object.keys(o).length ? o : null;
}
const under = (a, b) => { const A = seg(a), B = seg(b); return B.length <= A.length && B.every((x, i) => x === A[i]); };   // a 가 b 아래(같음 포함)

// ── SDK 와 같은 해시(transaction 조건) ──────────────────────
const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('base64');
function d2s(v) { const b = Buffer.alloc(8); b.writeDoubleBE(v); return b.toString('hex'); }   // SDK doubleToIEEE754String 과 같은 값
const INT = /^-?(0*)\d{1,10}$/;
const tryInt = (s) => { if (INT.test(s)) { const n = Number(s); if (n >= -2147483648 && n <= 2147483647) return n; } return null; };
export function nameCmp(a, b) {
  if (a === b) return 0;
  const ai = tryInt(a), bi = tryInt(b);
  if (ai !== null) { if (bi !== null) return ai - bi === 0 ? a.length - b.length : ai - bi; return -1; }
  if (bi !== null) return 1;
  return a < b ? -1 : 1;
}
export function hashOf(v) {
  if (v == null) return '';
  if (typeof v !== 'object') return sha1(typeof v + ':' + (typeof v === 'number' ? d2s(v) : String(v)));
  let t = '';
  for (const k of Object.keys(v).sort(nameCmp)) { const h = hashOf(v[k]); if (h !== '') t += ':' + k + ':' + h; }
  return t === '' ? '' : sha1(t);
}

// ── 쿼리(태그 listen · get) ────────────────────────────────
const rank = (v) => v == null ? 0 : v === false ? 1 : v === true ? 2 : typeof v === 'number' ? 3 : typeof v === 'string' ? 4 : 5;
function idxCmp(a, b) {
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 3) return a - b;
  if (ra === 4) return a < b ? -1 : a > b ? 1 : 0;
  return 0;
}
export function queryView(val, q) {
  if (!q || !Object.keys(q).length || val == null || typeof val !== 'object') return val;
  const i = q.i || '.priority';
  const byKey = i === '.key';
  const iv = (k) => i === '.value' ? (typeof val[k] === 'object' ? null : val[k]) : i === '.priority' ? null
    : (() => { let c = val[k]; for (const s of seg(i)) { if (c == null || typeof c !== 'object') return null; c = c[s]; } return c === undefined || (c && typeof c === 'object') ? null : c; })();
  const cmp = (ka, kb) => byKey ? nameCmp(ka, kb) : (idxCmp(iv(ka), iv(kb)) || nameCmp(ka, kb));
  //  자리 비교: 시작(sp, sn) · 끝(ep, en). 이름이 없으면 같은 값 전체가 포함(sin/ein=false 면 전체 제외)
  const side = (k, pv, pn, incl, sign) => {   // sign 1 = 시작(뒤쪽이면 통과) · -1 = 끝(앞쪽이면 통과)
    let c;
    if (byKey) c = nameCmp(k, String(pv));
    else { c = idxCmp(iv(k), pv); if (c === 0) { if (pn === undefined) return incl; c = nameCmp(k, pn); } }
    return c * sign > 0 || (c === 0 && incl);
  };
  let keys = Object.keys(val).sort(cmp);
  if ('sp' in q) keys = keys.filter(k => side(k, q.sp, q.sn, q.sin !== false, 1));
  if ('ep' in q) keys = keys.filter(k => side(k, q.ep, q.en, q.ein !== false, -1));
  if (typeof q.l === 'number') keys = q.vf === 'r' ? keys.slice(Math.max(0, keys.length - q.l)) : keys.slice(0, q.l);
  if (!keys.length) return null;
  const o = {}; for (const k of keys) o[k] = val[k];
  return o;
}

// ── 메모리 DB ─────────────────────────────────────────────
export function createStore(seedData) {
  const S = { tree: norm(clone(seedData)) };
  S.get = (p) => { let c = S.tree; for (const k of seg(p)) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : c; };
  S.set = (p, val) => {
    const ks = seg(p); val = norm(clone(val));
    if (!ks.length) { S.tree = val; return; }
    if (S.tree == null || typeof S.tree !== 'object') S.tree = {};
    let c = S.tree; const stack = [];
    for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; stack.push([c, ks[i]]); c = c[ks[i]]; }
    if (val == null) delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = val;
    for (let i = stack.length - 1; i >= 0; i--) { const [o, k] = stack[i]; if (o[k] && typeof o[k] === 'object' && !Object.keys(o[k]).length) delete o[k]; }
    if (S.tree && typeof S.tree === 'object' && !Object.keys(S.tree).length) S.tree = null;
  };
  //  서버 값: {'.sv':'timestamp'} · {'.sv':{increment:n}} — 쓰는 자리의 지금 값으로 계산
  S.resolve = (p, v) => {
    if (v && typeof v === 'object') {
      if ('.sv' in v) {
        const sv = v['.sv'];
        if (sv === 'timestamp') return Date.now();
        if (sv && typeof sv === 'object' && 'increment' in sv) { const cur = S.get(p); return (typeof cur === 'number' ? cur : 0) + Number(sv.increment || 0); }
        return null;
      }
      const o = {}; for (const k of Object.keys(v)) o[k] = S.resolve(p + '/' + k, v[k]); return o;
    }
    return v;
  };
  return S;
}

// ── 최소 WebSocket(RFC 6455) — 바깥 패키지 없이 ─────────────
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function wsFrame(op, payload) {
  const len = payload.length;
  const head = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 127; b.writeBigUInt64BE(BigInt(len), 2); return b; })();
  return Buffer.concat([head, payload]);
}
function wsAccept(req, socket, onText, onClose) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return null; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  let buf = Buffer.alloc(0), parts = [], closed = false;
  const W = {
    send(text) { if (!closed && !socket.destroyed) socket.write(wsFrame(1, Buffer.from(text, 'utf8'))); },
    close() { if (closed) return; closed = true; try { socket.end(wsFrame(8, Buffer.alloc(0))); } catch (e) {} onClose(); },
    get open() { return !closed && !socket.destroyed; },
  };
  socket.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { W.close(); return; }
      if (op === 9) { socket.write(wsFrame(10, payload)); continue; }
      if (op === 10) continue;
      parts.push(payload);
      if (fin) { const text = Buffer.concat(parts).toString('utf8'); parts = []; try { onText(text); } catch (e) { console.error('[가짜 RTDB] 처리 오류', e); } }
    }
  });
  socket.on('close', () => { if (!closed) { closed = true; onClose(); } });
  socket.on('error', () => {});
  return W;
}

// ── 서버 ──────────────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };

//  html 에 끼우기: 맨 앞(가드) + database SDK 바로 뒤(가짜 프로젝트). firestore·storage SDK 태그는 뺀다.
export function injectHtml(html) {
  html = html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*(firestore|storage)-compat\.js"><\/script>\s*/g, '');
  const guard = '<script src="/.fake/shim.js"></script>';
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + guard);
  else html = guard + html;
  html = html.replace(/(<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*database-compat\.js"><\/script>)/, '$1<script>window.__FAKE_RTDB && __FAKE_RTDB.init()</script>');
  return html;
}

export function startServer({ port = 8870, host = '127.0.0.1', repo = DEFAULT_REPO, seed = path.join(HERE, 'seed.json'), quiet = false, extraPorts = [] } = {}) {
  const seedData = typeof seed === 'string' ? JSON.parse(fs.readFileSync(seed, 'utf8')) : seed;
  const S = createStore(seedData);
  const conns = new Set();
  const sse = new Set();
  const stats = { started: Date.now(), connections: 0, messages: 0, writes: 0, stale: 0, rest: 0, byAction: {} };
  let sess = 0;
  const log = (...a) => { if (!quiet) console.log('[가짜 RTDB]', ...a); };

  // 쓰기 뒤 알림: 이 경로와 겹치는 모든 listen 에 새 값
  function broadcast(wpath) {
    for (const c of conns) {
      if (!c.ws.open) continue;
      for (const L of c.listens) {
        if (L.t != null) {
          if (under(wpath, L.p) || under(L.p, wpath)) c.push({ a: 'd', b: { p: join(L.p), d: queryView(S.get(L.p), L.q), t: L.t } });
        } else if (under(wpath, L.p)) c.push({ a: 'd', b: { p: join(wpath), d: S.get(wpath) } });
        else if (under(L.p, wpath)) c.push({ a: 'd', b: { p: join(L.p), d: S.get(L.p) } });
      }
    }
    for (const e of sse) {
      if (under(wpath, e.p)) e.send('put', { path: '/' + seg(wpath).slice(seg(e.p).length).join('/'), data: S.get(wpath) });
      else if (under(e.p, wpath)) e.send('put', { path: '/', data: S.get(e.p) });
    }
  }
  function put(p, d) { S.set(p, S.resolve(p, d)); stats.writes++; broadcast(p); }
  function merge(p, d) {
    for (const k of Object.keys(d || {})) { const cp = seg(p).concat(seg(k)).join('/'); S.set(cp, S.resolve(cp, d[k])); }
    stats.writes++; broadcast(p);
  }

  function onMessage(c, raw) {
    //  SDK 는 16KB 넘는 메시지를 "조각 수" + 조각들로 나눠 보낸다
    if (c.frames == null && /^\d+$/.test(raw)) { if (raw === '0') return; c.frames = Number(raw); c.buf = ''; return; }
    if (c.frames != null) { c.buf += raw; if (--c.frames > 0) return; raw = c.buf; c.frames = null; c.buf = ''; }
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t !== 'd' || !m.d) return;
    stats.messages++;
    const r = m.d.r, a = m.d.a, b = m.d.b || {};
    stats.byAction[a] = (stats.byAction[a] || 0) + 1;
    const reply = (s, d) => { if (r != null) c.push(null, { r, b: { s, d: d === undefined ? '' : d } }); };
    switch (a) {
      case 'q': {   // listen
        const L = { p: join(b.p), q: b.q || null, t: b.t != null ? b.t : null };
        c.listens = c.listens.filter(x => !(x.p === L.p && x.t === L.t));
        c.listens.push(L);
        c.push({ a: 'd', b: L.t != null ? { p: L.p, d: queryView(S.get(L.p), L.q), t: L.t } : { p: L.p, d: S.get(L.p) } });
        return reply('ok', {});
      }
      case 'n': {   // unlisten
        const p = join(b.p), t = b.t != null ? b.t : null;
        c.listens = c.listens.filter(x => !(x.p === p && x.t === t));
        return reply('ok');
      }
      case 'g': return reply('ok', queryView(S.get(b.p), b.q));
      case 'p': {
        if ('h' in b) {   // transaction: 보낸 기기가 본 값의 해시가 서버 지금 값과 다르면 다시 하라고
          if (hashOf(norm(clone(S.get(b.p)))) !== b.h) { stats.stale++; return reply('datastale', 'transaction hash does not match'); }
        }
        put(b.p, b.d); return reply('ok');
      }
      case 'm': merge(b.p, b.d); return reply('ok');
      case 'o': c.onDisc.push({ k: 'p', p: b.p, d: b.d }); return reply('ok');
      case 'om': c.onDisc.push({ k: 'm', p: b.p, d: b.d }); return reply('ok');
      case 'oc': c.onDisc = c.onDisc.filter(x => !under(x.p, b.p)); return reply('ok');
      default: return reply('ok');   // s(통계) · auth · unauth · appcheck … — 다 받아 준다
    }
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p;
    try { p = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); return res.end(); }

    // 가짜 서버 도구
    if (p === '/.fake/shim.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(path.join(HERE, 'shim.js'))); }
    if (p === '/.fake/db') { res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(S.get(u.searchParams.get('path') || ''), null, 1)); }
    if (p === '/.fake/stats') { res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ ...stats, clients: [...conns].map(c => ({ id: c.id, ua: c.ua, listens: c.listens.length })) }, null, 1)); }
    if (p === '/.fake/reset' && req.method === 'POST') { S.tree = norm(clone(seedData)); broadcast(''); log('처음 데이터로 되돌림'); res.writeHead(200); return res.end('ok'); }
    if (p === '/.fake/demo' || p === '/.fake/demo.html') return sendDemo(res, req);
    if (p === '/.fake' || p === '/.fake/' || p === '/') return sendHome(res, req);

    // REST(shallow 읽기 · 마을 sync 쓰기): ?ns= 가 붙은 *.json 또는 shim 이 돌린 /.rtdb/…
    const isRest = p.startsWith('/.rtdb/') || (p.endsWith('.json') && u.searchParams.has('ns'));
    if (isRest) return rest(req, res, u, p.replace(/^\/\.rtdb/, '').replace(/\.json$/, ''));

    // 정적 파일(저장소 폴더 밖은 안 냄)
    let file = path.resolve(repo, '.' + p);
    if (!file.startsWith(path.resolve(repo))) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' + u.search }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('없음'); }
    let body = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') body = Buffer.from(injectHtml(body.toString('utf8')));
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });

  function rest(req, res, u, dbPath) {
    stats.rest++;
    const send = (code, obj, extra) => { res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...(extra || {}) }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const etag = () => { const h = hashOf(S.get(dbPath)); return h === '' ? 'null_etag' : h; };
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,PATCH,POST,DELETE', 'Access-Control-Allow-Headers': '*' }); return res.end(); }
    if (req.method === 'GET' && /text\/event-stream/.test(req.headers.accept || '')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
      const e = { p: join(dbPath), send: (ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`) };
      sse.add(e); e.send('put', { path: '/', data: S.get(dbPath) });
      const ka = setInterval(() => res.write('event: keep-alive\ndata: null\n\n'), 30000);
      req.on('close', () => { clearInterval(ka); sse.delete(e); });
      return;
    }
    if (req.method === 'GET') {
      let v = S.get(dbPath);
      if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = typeof v[k] === 'object' ? true : v[k]; v = o; }
      return send(200, v, /true/i.test(req.headers['x-firebase-etag'] || '') ? { ETag: etag() } : null);
    }
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let d = null; try { d = body ? JSON.parse(body) : null; } catch (e) { return send(400, { error: 'Invalid data; couldn\'t parse JSON object.' }); }
      const im = req.headers['if-match'];
      if (im && im !== etag()) return send(412, { error: 'ETag mismatch.' }, { ETag: etag() });
      if (req.method === 'PUT') { put(dbPath, d); return send(200, S.get(dbPath), { ETag: etag() }); }
      if (req.method === 'PATCH') { merge(dbPath, d); return send(200, d); }
      if (req.method === 'DELETE') { put(dbPath, null); return send(200, null); }
      if (req.method === 'POST') { const k = '-F' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex'); put(join(dbPath) + '/' + k, d); return send(200, { name: k }); }
      return send(405, { error: 'method' });
    });
  }

  //  시연판 [CLASS-DEMO-1] — 교사 · TV 칸은 이 포트, 학생 A · B 칸은 다른 포트(= 다른 출처: localStorage · sessionStorage 가 섞이지 않는다)
  function sendDemo(res, req) {
    const hostName = String(req.headers.host || '127.0.0.1').replace(/:\d+$/, '');
    const cfg = { teacher: listenPorts[0], a: listenPorts[1] || null, b: listenPorts[2] || null, host: hostName };
    const html = fs.readFileSync(path.join(HERE, 'demo.html'), 'utf8').replace('/*DEMO_CFG*/null', JSON.stringify(cfg));
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    res.end(html);
  }

  function sendHome(res, req) {
    const st = S.get('classRPG_v3/students') || {};
    const kids = Object.values(st).filter(s => s && s.id).map(s => `<li><a href="/student.html?as=${encodeURIComponent(s.id)}">${escHtml(s.name)}</a> <small>(${escHtml(s.id)})</small></li>`).join('');
    const apps = ['art', 'coding', 'ink', 'mathgap', 'music', 'paint', 'pattern', 'print', 'thinkboard', 'watercolor'].filter(a => fs.existsSync(path.join(repo, a, 'index.html')))
      .map(a => `<a href="/${a}/">${a}</a>`).join(' · ');
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>가짜 DB 시연</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#222;background:#fff}h1{font-size:20px}code{background:#f3f3f3;padding:1px 5px;border-radius:4px}.tag{background:#7a2;color:#fff;border-radius:6px;padding:2px 8px;font-weight:700;font-size:13px}</style>
<h1><span class="tag">🧪 시연용</span> 가짜 DB 서버</h1>
<p>이 서버의 기록은 <b>메모리에만</b> 있어요. 운영 DB 와 이어지지 않고, 서버를 끄면 사라져요.</p>
<h2>학생 (비밀번호 x · 누르면 바로 입장)</h2><ul>${kids || '<li>학생 없음</li>'}</ul>
<p><a href="/student.html">학생 로그인 화면</a></p>
<h2>선생님</h2><p><a href="/admin.html?auto">관리 화면 (바로 입장)</a> · <a href="/admin.html">관리 로그인 화면</a> (비밀번호 x) · <a href="/kiosk.html">키오스크</a></p>
<h2>학습 앱</h2><p>${apps}</p>
<h2>시연판</h2><p><a href="/.fake/demo">한 화면 네 칸(교사 · 학생 A · 학생 B · TV)</a> — 서버를 <code>--demo</code> 로 켜야 학생 칸이 따로 열려요</p>
<h2>도구</h2><p><a href="/.fake/db?path=classRPG_v3/students">학생 기록 보기</a> · <a href="/.fake/stats">연결 수</a> · 처음으로 되돌리기: <code>curl -X POST ${escHtml('http://' + (req.headers.host || '') + '/.fake/reset')}</code></p>`);
  }

  server.on('upgrade', (req, socket) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname !== '/.ws' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
    const c = { id: ++sess, ua: String(req.headers['user-agent'] || '').slice(0, 60), listens: [], onDisc: [], frames: null, buf: '' };
    c.ws = wsAccept(req, socket, (text) => onMessage(c, text), () => {
      conns.delete(c);
      for (const o of c.onDisc) { if (o.k === 'p') put(o.p, o.d); else merge(o.p, o.d); }
      c.onDisc = [];
    });
    if (!c.ws) return;
    //  push(데이터 알림) · push(null, 응답)
    c.push = (data, resp) => c.ws.send(JSON.stringify({ t: 'd', d: resp || data }));
    conns.add(c); stats.connections++;
    c.ws.send(JSON.stringify({ t: 'c', d: { t: 'h', d: { ts: Date.now(), v: '5', h: req.headers.host, s: 'fake' + c.id } } }));
  });

  //  [CLASS-DEMO-1] 같은 처리기 · 같은 메모리 DB 를 다른 포트에도 연다(시연판 학생 칸 = 다른 출처)
  const listenPorts = [];
  const servers = [server, ...extraPorts.map(() => {
    const s2 = http.createServer(server.listeners('request')[0]);
    s2.on('upgrade', server.listeners('upgrade')[0]);
    return s2;
  })];
  const listen = (sv, pt) => new Promise((resolve, reject) => { sv.once('error', reject); sv.listen(pt, host, () => resolve(sv.address().port)); });
  return (async () => {
    listenPorts.push(await listen(server, port));
    try { for (let i = 0; i < extraPorts.length; i++) listenPorts.push(await listen(servers[i + 1], extraPorts[i])); }
    catch (e) { server.close(); for (const sv of servers.slice(1)) { try { sv.close(); } catch (er) {} } throw e; }
    log(`http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${listenPorts[0]}/.fake/  (저장소 ${repo})${listenPorts.length > 1 ? ' · 함께 여는 포트 ' + listenPorts.slice(1).join(' · ') : ''}`);
    return {
      server, store: S, stats, port: listenPorts[0], ports: listenPorts.slice(), conns,
      close: () => new Promise(r => {
        for (const c of conns) { try { c.ws.close(); } catch (e) {} }
        for (const e of sse) { try { e.send('cancel', null); } catch (er) {} }
        let left = servers.length;
        for (const sv of servers) { sv.close(() => { if (--left === 0) r(); }); sv.closeAllConnections?.(); }
      }),
    };
  })();
}

function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── 명령줄 ────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const argv = process.argv.slice(2);
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const port = Number(argv.find(a => /^\d+$/.test(a)) || 8870);
  const lan = argv.includes('--lan');
  const demo = argv.includes('--demo');
  const { port: real } = await startServer({ port, host: lan ? '0.0.0.0' : '127.0.0.1', repo: opt('--repo') ? path.resolve(opt('--repo')) : DEFAULT_REPO, seed: opt('--seed') ? path.resolve(opt('--seed')) : undefined,
    extraPorts: demo ? [port + 1, port + 2] : [] });
  if (demo) console.log(`[가짜 RTDB] 시연판(교사 · 학생 A · 학생 B · TV): http://127.0.0.1:${real}/.fake/demo`);
  if (lan) {
    const ips = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
    for (const ip of ips) console.log(`[가짜 RTDB] 같은 와이파이 기기: http://${ip}:${real}/.fake/`);
  }
  console.log('[가짜 RTDB] 끝내려면 Ctrl+C');
}
