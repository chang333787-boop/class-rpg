// 가짜 RTDB 서버 시험 [FAKE-RTDB-1] — 브라우저 없이 서버 프로토콜만. 127.0.0.1 빈 포트 · 운영 DB·바깥 통신 0.
//  확인: 인사(h) · listen 첫 값 · 다른 연결의 put/merge 알림 · increment/timestamp · transaction 해시(맞으면 ok ·다르면 datastale) ·
//        태그 쿼리(orderByKey startAt/endAt) 걸러 보내기 · unlisten · get · onDisconnect · 조각 메시지 · REST(shallow·쓰기) ·
//        html 끼움 · 저장소 밖 파일 막음 · 서버 코드에 바깥으로 나가는 요청 없음 · 시작 데이터 모양
//  실행: node scripts/unit/fake-rtdb/fake-rtdb.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { startServer, hashOf, queryView } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const ok = (c, name, extra) => { results.push([c ? 'PASS' : 'FAIL', name, c ? '' : (extra || '')]); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const killer = setTimeout(() => { console.log('FAIL 시간 초과'); process.exit(1); }, 30000);

const seed = JSON.parse(fs.readFileSync(path.join(HERE, 'seed.json'), 'utf8'));
seed.classRPG_v3.emotionLogs = { s1_a: { m: 1 }, s1_b: { m: 2 }, s2_a: { m: 3 }, s10_a: { m: 4 } };
const srv = await startServer({ port: 0, host: '127.0.0.1', seed, quiet: true });
const BASE = `http://127.0.0.1:${srv.port}`;

//  SDK 처럼 말하는 작은 손님
async function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/.ws?v=5&ns=fake-rpg`);
  const C = { pushes: [], hello: null, r: 0, wait: new Map() };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'c') { C.hello = m.d; return; }
    if (m.d && m.d.r != null && C.wait.has(m.d.r)) { C.wait.get(m.d.r)(m.d.b); C.wait.delete(m.d.r); return; }
    if (m.d && m.d.a) C.pushes.push(m.d);
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  C.ws = ws;
  C.req = (a, b) => new Promise(res => { const r = ++C.r; C.wait.set(r, res); ws.send(JSON.stringify({ t: 'd', d: { r, a, b } })); });
  C.raw = (s) => ws.send(s);
  C.last = (p) => [...C.pushes].reverse().find(x => x.b.p === p);
  for (let i = 0; i < 50 && !C.hello; i++) await sleep(10);
  return C;
}

try {
  const A = await client(), B = await client();
  ok(A.hello && A.hello.t === 'h' && A.hello.d.v === '5' && A.hello.d.h === `127.0.0.1:${srv.port}`, '인사(h) — 호스트 = 이 서버', JSON.stringify(A.hello));

  // listen 첫 값
  const s1 = 'classRPG_v3/students/s1';
  const r1 = await A.req('q', { p: '/' + s1, h: '' });
  ok(r1.s === 'ok' && A.last(s1)?.b.d?.gold === 1000, 'listen → 첫 값(골드 1000)');

  // B 의 put → A 알림
  const r2 = await B.req('p', { p: '/' + s1 + '/gold', d: 1050 });
  await sleep(30);
  ok(r2.s === 'ok' && A.last(s1 + '/gold')?.b.d === 1050, '다른 연결의 put → listen 알림', JSON.stringify(A.pushes.slice(-2)));

  // merge(점 경로 포함)
  await B.req('m', { p: '/' + s1, d: { gold: 1100, 'stats/read': 5 } });
  await sleep(30);
  const st = srv.store.get(s1);
  ok(st.gold === 1100 && st.stats.read === 5 && st.stats.study === 1, 'merge — 다른 칸은 그대로', JSON.stringify(st.stats));
  ok(A.last(s1)?.b.d?.gold === 1100, 'merge → listen 알림');

  // increment · timestamp
  await B.req('m', { p: '/classRPG_v3/goldDaily/d1', d: { battle: { '.sv': { increment: 5 } } } });
  await B.req('m', { p: '/classRPG_v3/goldDaily/d1', d: { battle: { '.sv': { increment: 7 } }, at: { '.sv': 'timestamp' } } });
  const gd = srv.store.get('classRPG_v3/goldDaily/d1');
  ok(gd.battle === 12 && Math.abs(gd.at - Date.now()) < 5000, 'ServerValue increment(5+7=12) · timestamp', JSON.stringify(gd));

  // transaction 해시
  ok(hashOf(1) === 'YPVfR2bXt/lcDjiQZ8pOkAd3qkQ=' && hashOf({ gold: 1050, name: '하늘' }) === 'yv1zMm/K/w9DG5dYicsYlUTLeuo=', '해시 = SDK 값(브라우저 실측판과 같은 벡터)');
  const goldPath = '/' + s1 + '/gold';
  const good = await B.req('p', { p: goldPath, d: 1200, h: hashOf(1100) });
  const bad = await B.req('p', { p: goldPath, d: 9999, h: hashOf(1100) });
  ok(good.s === 'ok' && bad.s === 'datastale' && srv.store.get(s1 + '/gold') === 1200, 'transaction — 해시 맞으면 ok · 옛 해시면 datastale(값 그대로)', `${good.s}/${bad.s}/${srv.store.get(s1 + '/gold')}`);
  const empty = await B.req('p', { p: '/classRPG_v3/counter/x', d: 1, h: '' });
  ok(empty.s === 'ok' && srv.store.get('classRPG_v3/counter/x') === 1, 'transaction — 빈 자리 해시("")');

  // 태그 쿼리(학생 기기 attachMine 과 같은 모양)
  const qo = { sp: 's1_', ep: 's1_', i: '.key' };
  A.pushes.length = 0;
  await A.req('q', { p: '/classRPG_v3/emotionLogs', q: qo, t: 7, h: '' });
  const first = A.pushes.find(x => x.b.t === 7);
  ok(first && JSON.stringify(Object.keys(first.b.d || {})) === '["s1_a","s1_b"]', '태그 쿼리 첫 값 — 내 것만(s1_)', JSON.stringify(first));
  A.pushes.length = 0;
  await B.req('p', { p: '/classRPG_v3/emotionLogs/s2_b', d: { m: 9 } });
  await B.req('p', { p: '/classRPG_v3/emotionLogs/s1_c', d: { m: 8 } });
  await sleep(30);
  const tq = A.pushes.filter(x => x.b.t === 7);
  ok(tq.length >= 1 && tq.every(x => Object.keys(x.b.d || {}).every(k => k.startsWith('s1_'))) && 's1_c' in (tq.at(-1).b.d || {}), '태그 쿼리 알림 — 남의 것 안 섞임 · 새 내 것 들어옴', JSON.stringify(tq));
  ok(!A.pushes.some(x => x.b.t == null && /emotionLogs/.test(x.b.p)), '태그 쿼리에 태그 없는 알림 안 감');

  // unlisten
  await A.req('n', { p: '/classRPG_v3/emotionLogs', q: qo, t: 7 });
  A.pushes.length = 0;
  await B.req('p', { p: '/classRPG_v3/emotionLogs/s1_d', d: { m: 1 } });
  await sleep(30);
  ok(!A.pushes.some(x => /emotionLogs/.test(x.b.p)), 'unlisten 뒤 알림 없음');

  // get
  const g = await A.req('g', { p: '/classRPG_v3/settings/className' });
  ok(g.s === 'ok' && g.d === '시연반', 'get');

  // queryView 다른 꼴
  const v = { a: { n: 3 }, b: { n: 1 }, c: { n: 2 }, d: { n: 2 } };
  ok(JSON.stringify(Object.keys(queryView(v, { i: 'n', l: 2, vf: 'r' }) || {})) === '["d","a"]', 'orderByChild + limitToLast(2)', JSON.stringify(queryView(v, { i: 'n', l: 2, vf: 'r' })));
  ok(JSON.stringify(queryView(v, { i: 'n', sp: 2, ep: 2 })) === JSON.stringify({ c: { n: 2 }, d: { n: 2 } }), 'orderByChild equalTo(2)');
  ok(JSON.stringify(Object.keys(queryView({ '10': 1, '9': 1, b: 1, a: 1 }, { i: '.key', l: 3, vf: 'l' }))) === JSON.stringify(Object.keys({ '9': 1, '10': 1, a: 1 })), 'orderByKey — 숫자 키 먼저(9 < 10 < a)');

  // onDisconnect
  const C = await client();
  await C.req('p', { p: '/presence/c', d: true });
  await C.req('o', { p: '/presence/c', d: null });
  C.ws.close();
  await sleep(150);
  ok(srv.store.get('presence/c') == null, 'onDisconnect — 끊기면 실행');

  // 조각 메시지(16KB 넘는 저장)
  const big = 'x'.repeat(40000);
  const msg = JSON.stringify({ t: 'd', d: { r: 999, a: 'p', b: { p: '/classRPG_v3/big', d: big } } });
  const parts = msg.match(/[\s\S]{1,16384}/g);
  const done = new Promise(res => B.wait.set(999, res));
  B.raw(String(parts.length)); for (const p of parts) B.raw(p);
  ok((await done).s === 'ok' && srv.store.get('classRPG_v3/big') === big, `조각 메시지 ${parts.length}개 → 한 저장`);

  // REST
  const sh = await (await fetch(`${BASE}/classRPG_v3.json?ns=fake-rpg&shallow=true`)).json();
  ok(sh.students === true && sh.settings === true && !('gold' in sh), 'REST shallow(학생 기기 노드 목록)', JSON.stringify(sh));
  A.pushes.length = 0;
  const put = await fetch(`${BASE}/.rtdb/classRPG_v3/students/s1/gold.json`, { method: 'PUT', body: '1300' });
  await sleep(30);
  ok(put.ok && srv.store.get(s1 + '/gold') === 1300 && A.last(s1 + '/gold')?.b.d === 1300, 'REST PUT → WebSocket listen 알림');
  const pm = await fetch(`${BASE}/.rtdb/classRPG_v3/students/s1.json`, { method: 'PATCH', body: JSON.stringify({ job: '요리사' }) });
  ok(pm.ok && srv.store.get(s1 + '/job') === '요리사' && srv.store.get(s1 + '/gold') === 1300, 'REST PATCH');

  // html 끼움
  const html = await (await fetch(`${BASE}/student.html`)).text();
  const iShim = html.indexOf('/.fake/shim.js'), iApp = html.indexOf('firebase-app-compat.js');
  ok(iShim > 0 && iShim < iApp, 'student.html — shim 이 SDK 보다 먼저');
  ok(/database-compat\.js"><\/script><script>window\.__FAKE_RTDB && __FAKE_RTDB\.init\(\)<\/script>/.test(html), 'student.html — database SDK 바로 뒤 init');
  ok(!/<script src="[^"]*(firestore|storage)-compat/.test(html), 'student.html — firestore·storage SDK 태그 뺌');
  for (const pg of ['admin.html', 'kiosk.html', 'art/', 'watercolor/']) {
    const h = await (await fetch(`${BASE}/${pg}`)).text();
    ok(h.includes('/.fake/shim.js') && h.includes('__FAKE_RTDB.init()'), pg + ' — 끼움');
  }
  const shim = await fetch(`${BASE}/.fake/shim.js`);
  ok(shim.ok && (await shim.text()).includes('__FAKE_RTDB'), 'shim.js 서빙');

  // 저장소 밖 파일
  const trav = await new Promise(res => http.get({ host: '127.0.0.1', port: srv.port, path: '/%2e%2e/%2e%2e/%2e%2e/etc/hosts' }, r => { r.resume(); res(r.statusCode); }));
  ok(trav === 403 || trav === 404, '저장소 밖 파일 막음', String(trav));

  // 서버 코드: 바깥으로 나가는 요청 없음 · 운영 주소 없음
  const code = fs.readFileSync(path.join(HERE, 'server.mjs'), 'utf8');
  ok(!/http\.request|https\.|http\.get|fetch\(|net\.connect|tls\.connect|new WebSocket/.test(code), '서버 코드에 바깥 요청 없음');
  ok(!/class-rpg-6f409|firebaseio\.com|firebasedatabase\.app/.test(code), '서버 코드에 운영 주소 없음');

  // 시작 데이터
  const ss = Object.values(seed.classRPG_v3.students);
  ok(ss.length >= 4 && ss.length <= 6 && ss.every(s => s.pw === 'x' && s.id && s.name && s.charType) && seed.classRPG_adminPw === 'x', '시작 데이터 — 학생 4~6명 · 비번 x · 관리 x');
  ok((seed.classRPG_v3.boardQuests || []).length >= 3, '시작 데이터 — 퀘스트');

  A.ws.close(); B.ws.close();
} catch (e) {
  ok(false, '예외', e && e.stack);
}
await srv.close();
clearTimeout(killer);
const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`가짜 RTDB 서버 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
