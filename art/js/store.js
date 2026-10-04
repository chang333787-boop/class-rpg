// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_art 아래만 쓴다(물감 연구소 classRPG_paint 와 같은 꼴).
//  RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다(선생님 화면의 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기만 예외).
//  progress/<sid>/<그림>    = 사건 해결 { st 별, n 헛짚은 수, h 힌트 수, t }
//  stats/<sid>/<그림>       = 셈 { tries 짚은 수, ok 찾은 수, miss 헛짚음, hint, tmiss 생각 단서 헛짚음 }
//  think/<그림>/<sid>       = 생각 { o 고른 것(번호 · 놀이 이름 · 색 'blue,white'), t }
//  feel/<그림>/<sid>        = 느낌 { f 'excited,noisy', b 'color', t }
//  ask/<그림>/<질문 id>     = 질문 { s sid, k 갈래, p 이름 붙은 곳 번호, x, y, t } — 글 입력 없음(문장은 cases.js · ask.js 가 만든다)
//  like/<그림>/<질문 id>/<sid> = 1 — 나도 궁금해요
//  names/<sid>              = 이름(선생님 화면 · 질문판)
//  ── 조형 요소 찾기(hunt.js) ──
//  elem/<sid>/<카드>        = { f 찾은 곳 'caseId:x:y|…', st 별(셋 다 찾으면), n 헛짚음, h 힌트, t }
//  estats/<sid>/<카드>      = 셈 { tries, ok, miss, hint, x_<요소> = 찾다가 다른 요소를 짚음 }
//  efeel/<카드>/<sid>       = { f 'calm,wide', t } — 그 요소가 주는 느낌(우리 반 셈)
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';

export const ROOT = 'classRPG_art';
const CONFIG = {   // gamedata.js FIREBASE_CONFIG 와 같은 값(학급 RPG 프로젝트)
  apiKey: 'AIzaSyCV_u6yKdGInPuCJanK4bzBfnLJuvIbyX4',
  authDomain: 'class-rpg-6f409.firebaseapp.com',
  databaseURL: 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'class-rpg-6f409',
  storageBucket: 'class-rpg-6f409.firebasestorage.app',
  messagingSenderId: '408824743154',
  appId: '1:408824743154:web:382fdd431f7e2dbce13c6b',
};
export const MAX_ASK = 3;   // 한 그림에 한 아이 질문 셋까지
const newId = sid => sid + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
const better = (a, b) => !a || (b.st > (a.st || 0)) || (b.st === a.st && b.n < a.n);

export function createStore({ sid, name, fb = globalThis.firebase, offline = false } = {}) {
  sid = sid ? keyOf(sid) : '';
  if (sid && fb && !offline) return rtdbStore(fb, sid, name);
  return localStore(sid || 'guest', name || '나');
}

function rtdbStore(fb, sid, name) {
  if (!fb.apps.length) fb.initializeApp(CONFIG);
  const db = fb.database(), root = db.ref(ROOT), inc = n => fb.database.ServerValue.increment(n);
  let mine = null;
  const withName = up => { if (name) up[`names/${sid}`] = name; return up; };
  const st = {
    me: { sid, name: name || '', guest: false }, online: true,
    async progress() { if (!mine) mine = (await root.child('progress/' + sid).once('value')).val() || {}; return mine; },
    async tap(c, kind) { const up = {}; up[`stats/${sid}/${keyOf(c)}/tries`] = inc(1); up[`stats/${sid}/${keyOf(c)}/${keyOf(kind)}`] = inc(1); await root.update(up); },
    async solve(c, { st: stars, n, h }) {
      const k = keyOf(c), p = await st.progress(), up = withName({});
      if (better(p[k], { st: stars, n })) { p[k] = { st: stars, n, h, t: Date.now() }; up[`progress/${sid}/${k}`] = p[k]; }
      await root.update(up);
    },
    async think(c, o) { await root.update(withName({ [`think/${keyOf(c)}/${sid}`]: { o: String(o), t: Date.now() } })); },
    async feel(c, f, b) { await root.update(withName({ [`feel/${keyOf(c)}/${sid}`]: { f, b, t: Date.now() } })); },
    async ask(c, q) { const id = newId(sid); await root.update(withName({ [`ask/${keyOf(c)}/${id}`]: { s: sid, ...q, t: Date.now() } })); return id; },
    async unask(c, id) { await root.update({ [`ask/${keyOf(c)}/${keyOf(id)}`]: null, [`like/${keyOf(c)}/${keyOf(id)}`]: null }); },
    async like(c, id, on) { await root.child(`like/${keyOf(c)}/${keyOf(id)}/${sid}`).set(on ? 1 : null); },
    async board(c) {
      const k = keyOf(c), [th, fe, as, li, nm] = await Promise.all([`think/${k}`, `feel/${k}`, `ask/${k}`, `like/${k}`, 'names'].map(x => root.child(x).once('value')));
      return { think: th.val() || {}, feel: fe.val() || {}, ask: as.val() || {}, like: li.val() || {}, names: nm.val() || {} };
    },
    // ── 선생님 ──
    async teacherOK(pw) { const real = (await db.ref('classRPG_adminPw').once('value')).val(); return real != null && String(pw) === String(real); },
    async all() { const v = (await root.once('value')).val() || {}; return { progress: v.progress || {}, stats: v.stats || {}, names: v.names || {}, think: v.think || {}, feel: v.feel || {}, ask: v.ask || {}, like: v.like || {} }; },
    async removeAsk(c, id) { await st.unask(c, id); },
    // ── 조형 요소 찾기 ──
    async elemProgress() { return (await root.child('elem/' + sid).once('value')).val() || {}; },
    async elemSave(k, rec) { await root.update(withName({ [`elem/${sid}/${keyOf(k)}`]: { ...rec, t: Date.now() } })); },
    async elemTap(k, kind) { const up = {}, b = `estats/${sid}/${keyOf(k)}`; up[`${b}/tries`] = inc(1); up[`${b}/${keyOf(kind)}`] = inc(1); await root.update(up); },
    async elemFeel(k, f) { await root.update(withName({ [`efeel/${keyOf(k)}/${sid}`]: { f, t: Date.now() } })); },
    async elemBoard(k) { const [fe, nm] = await Promise.all([root.child('efeel/' + keyOf(k)).once('value'), root.child('names').once('value')]); return { feel: fe.val() || {}, names: nm.val() || {} }; },
    async elemAll() { const [e, s, f, nm] = await Promise.all(['elem', 'estats', 'efeel', 'names'].map(x => root.child(x).once('value'))); return { elem: e.val() || {}, estats: s.val() || {}, efeel: f.val() || {}, names: nm.val() || {} }; },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'art.local';
  const load = () => { const d = lsGet(KEY, {}); for (const k of ['progress', 'stats', 'think', 'feel', 'ask', 'like', 'elem', 'estats', 'efeel']) d[k] = d[k] || {}; return d; };
  const save = d => lsSet(KEY, d);
  const at = (o, a, b) => (o[a] = o[a] || {}, o[a][b] = o[a][b] || {}, o[a][b]);
  const st = {
    me: { sid, name, guest: true }, online: false,
    async progress() { return load().progress; },
    async tap(c, kind) { const d = load(), t = d.stats[c] = d.stats[c] || {}; t.tries = (t.tries || 0) + 1; t[kind] = (t[kind] || 0) + 1; save(d); },
    async solve(c, { st: stars, n, h }) { const d = load(); if (better(d.progress[c], { st: stars, n })) d.progress[c] = { st: stars, n, h, t: Date.now() }; save(d); },
    async think(c, o) { const d = load(); d.think[c] = { ...(d.think[c] || {}), [sid]: { o: String(o), t: Date.now() } }; save(d); },
    async feel(c, f, b) { const d = load(); d.feel[c] = { ...(d.feel[c] || {}), [sid]: { f, b, t: Date.now() } }; save(d); },
    async ask(c, q) { const d = load(), id = newId(sid); d.ask[c] = { ...(d.ask[c] || {}), [id]: { s: sid, ...q, t: Date.now() } }; save(d); return id; },
    async unask(c, id) { const d = load(); if (d.ask[c]) delete d.ask[c][id]; if (d.like[c]) delete d.like[c][id]; save(d); },
    async like(c, id, on) { const d = load(); const l = at(d.like, c, id); if (on) l[sid] = 1; else delete l[sid]; save(d); },
    async board(c) { const d = load(); return { think: d.think[c] || {}, feel: d.feel[c] || {}, ask: d.ask[c] || {}, like: d.like[c] || {}, names: { [sid]: name } }; },
    async teacherOK() { return true; },
    async all() { const d = load(); return { progress: { [sid]: d.progress }, stats: { [sid]: d.stats }, names: { [sid]: name }, think: d.think, feel: d.feel, ask: d.ask, like: d.like }; },
    async removeAsk(c, id) { await st.unask(c, id); },
    async elemProgress() { return load().elem; },
    async elemSave(k, rec) { const d = load(); d.elem[k] = { ...rec, t: Date.now() }; save(d); },
    async elemTap(k, kind) { const d = load(), t = d.estats[k] = d.estats[k] || {}; t.tries = (t.tries || 0) + 1; t[kind] = (t[kind] || 0) + 1; save(d); },
    async elemFeel(k, f) { const d = load(); d.efeel[k] = { ...(d.efeel[k] || {}), [sid]: { f, t: Date.now() } }; save(d); },
    async elemBoard(k) { const d = load(); return { feel: d.efeel[k] || {}, names: { [sid]: name } }; },
    async elemAll() { const d = load(); return { elem: { [sid]: d.elem }, estats: { [sid]: d.estats }, efeel: d.efeel, names: { [sid]: name } }; },
  };
  return st;
}
