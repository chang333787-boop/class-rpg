// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_pattern 아래만 쓴다(기초 코딩 classRPG_coding 과 같은 꼴).
//  RPG 본 데이터(classRPG_v3)는 쓰지 않는다 — 읽기는 선생님 화면의 반 명단 classRPG_v3/students 하나(id · 이름만 · common/roster.js 가 store.db 로) [APP-ROSTER-1]. 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기도 선생님 화면만.
//  progress/<sid>/<판>  = 가장 좋은 기록 { st 별, n 틀린 수, t 때 }  — 풀었을 때만
//  stats/<sid>/<판>     = 셈 { tries 답한 수, ok 푼 수, axis · dir · angle · fliprot · still · samepic · find 헷갈림별 }
//  names/<sid>          = 이름(선생님 화면 표 · 우리 반 무늬 전시)
//  works/<sid>/<id>     = 나의 무늬 { g 도장 칸 그림, u 규칙 칸 움직임, t 때 }  — [PATTERN-6] 한 아이 12개까지 · 글 없음(이름은 names)
//  solves/<sid>__<id>/<맞힌 sid> = 때  — 친구 무늬의 규칙을 맞힌 친구
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';   // 설정 · 앱 만들기 · 관리자 비밀번호 확인 [SUBAPP-COMMON-1]

export const ROOT = 'classRPG_pattern';
export const MAX_WORKS = 12;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const better = (a, b) => !a || (b.st > (a.st || 0)) || (b.st === a.st && b.n < a.n);

export function createStore({ sid, name, fb = globalThis.firebase, offline = false } = {}) {
  sid = sid ? keyOf(sid) : '';
  if (sid && fb && !offline) return rtdbStore(fb, sid, name);
  return localStore(sid || 'guest', name || '나');
}

function rtdbStore(fb, sid, name) {
  const db = rpgDb(fb), root = db.ref(ROOT), inc = n => fb.database.ServerValue.increment(n);
  let mine = null;
  const st = {
    me: { sid, name: name || '', guest: false }, online: true, db,   // db = 선생님 화면 반 명단 읽기(common/roster.js) [APP-ROSTER-1]
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
    // ── [PATTERN-6] 나의 무늬 · 우리 반 무늬 전시 ──
    async saveWork({ g, u }) { const id = newId(), up = { [`works/${sid}/${id}`]: { g, u, t: Date.now() } }; if (name) up[`names/${sid}`] = name; await root.update(up); return id; },
    async myWorks() { return (await root.child('works/' + sid).once('value')).val() || {}; },
    async gallery() {
      const [w, n, s] = await Promise.all(['works', 'names', 'solves'].map(k => root.child(k).once('value')));
      return { works: w.val() || {}, names: n.val() || {}, solves: s.val() || {} };
    },
    async deleteWork(owner, id) { await root.child(`works/${keyOf(owner)}/${keyOf(id)}`).remove(); },
    async solve(owner, id) { await root.child(`solves/${keyOf(owner)}__${keyOf(id)}/${sid}`).set(Date.now()); },
    // ── 선생님 ──
    async teacherOK(pw) { return adminPwOK(db, pw); },
    async all() { const v = (await root.once('value')).val() || {}; return { progress: v.progress || {}, stats: v.stats || {}, names: v.names || {}, works: v.works || {} }; },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'pattern.local';
  const load = () => { const d = lsGet(KEY, {}); d.progress = d.progress || {}; d.stats = d.stats || {}; d.works = d.works || {}; d.solves = d.solves || {}; return d; };
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
    async saveWork({ g, u }) { const d = load(), id = newId(); d.works[id] = { g, u, t: Date.now() }; save(d); return id; },
    async myWorks() { return load().works; },
    async gallery() { const d = load(); return { works: { [sid]: d.works }, names: { [sid]: name }, solves: d.solves }; },
    async deleteWork(owner, id) { const d = load(); delete d.works[id]; save(d); },
    async solve(owner, id) { const d = load(), k = keyOf(owner) + '__' + keyOf(id); d.solves[k] = { ...(d.solves[k] || {}), [sid]: Date.now() }; save(d); },
    async teacherOK() { return true; },
    async all() { const d = load(); return { progress: { [sid]: d.progress }, stats: { [sid]: d.stats }, names: { [sid]: name }, works: { [sid]: d.works } }; },
  };
}
