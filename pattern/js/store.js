// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_pattern 아래만 쓴다(기초 코딩 classRPG_coding 과 같은 꼴).
//  RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다(선생님 화면의 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기만 예외).
//  progress/<sid>/<판>  = 가장 좋은 기록 { st 별, n 틀린 수, t 때 }  — 풀었을 때만
//  stats/<sid>/<판>     = 셈 { tries 답한 수, ok 푼 수, axis · dir · angle · fliprot · still · samepic · find 헷갈림별 }
//  names/<sid>          = 이름(선생님 화면 표)
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';

export const ROOT = 'classRPG_pattern';
const CONFIG = {   // gamedata.js FIREBASE_CONFIG 와 같은 값(학급 RPG 프로젝트)
  apiKey: 'AIzaSyCV_u6yKdGInPuCJanK4bzBfnLJuvIbyX4',
  authDomain: 'class-rpg-6f409.firebaseapp.com',
  databaseURL: 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'class-rpg-6f409',
  storageBucket: 'class-rpg-6f409.firebasestorage.app',
  messagingSenderId: '408824743154',
  appId: '1:408824743154:web:382fdd431f7e2dbce13c6b',
};
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
  const st = {
    me: { sid, name: name || '', guest: false }, online: true,
    async progress() { if (!mine) mine = (await root.child('progress/' + sid).once('value')).val() || {}; return mine; },
    // 한 번 답한 결과 — 셈은 늘 · 기록은 더 좋을 때만 · 이름도 같이(선생님 표)
    async saveTry(puz, { ok, mistake, n, stars }) {
      const k = keyOf(puz), up = {};
      up[`stats/${sid}/${k}/tries`] = inc(1);
      up[`stats/${sid}/${k}/${ok ? 'ok' : keyOf(mistake || 'etc')}`] = inc(1);
      if (name) up[`names/${sid}`] = name;
      const p = await st.progress();
      if (ok && better(p[k], { st: stars, n })) { p[k] = { n, st: stars, t: Date.now() }; up[`progress/${sid}/${k}`] = p[k]; }
      await root.update(up);
    },
    // ── 선생님 ──
    async teacherOK(pw) { const real = (await db.ref('classRPG_adminPw').once('value')).val(); return real != null && String(pw) === String(real); },
    async all() { const v = (await root.once('value')).val() || {}; return { progress: v.progress || {}, stats: v.stats || {}, names: v.names || {} }; },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'pattern.local';
  const load = () => { const d = lsGet(KEY, {}); d.progress = d.progress || {}; d.stats = d.stats || {}; return d; };
  const save = d => lsSet(KEY, d);
  return {
    me: { sid, name, guest: true }, online: false,
    async progress() { return load().progress; },
    async saveTry(puz, { ok, mistake, n, stars }) {
      const d = load(), k = keyOf(puz), s = d.stats[k] = d.stats[k] || {};
      s.tries = (s.tries || 0) + 1; const w = ok ? 'ok' : keyOf(mistake || 'etc'); s[w] = (s[w] || 0) + 1;
      if (ok && better(d.progress[k], { st: stars, n })) d.progress[k] = { n, st: stars, t: Date.now() };
      save(d);
    },
    async teacherOK() { return true; },
    async all() { const d = load(); return { progress: { [sid]: d.progress }, stats: { [sid]: d.stats }, names: { [sid]: name } }; },
  };
}
