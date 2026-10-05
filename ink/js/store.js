// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_ink 아래만 쓴다(물감 연구소 classRPG_paint 와 같은 꼴).
//  RPG 본 데이터(classRPG_v3)는 쓰지 않는다 — 읽기는 선생님 화면의 반 명단 classRPG_v3/students 하나(id · 이름만 · common/roster.js 가 store.db 로) [APP-ROSTER-1]. 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기도 선생님 화면만.
//  progress/<sid>/<판>  = 가장 좋은 기록 { st 별(붓 놀이는 0), n 틀린 수, t 때, c 내가 만든 먹색(#rrggbb · 꼬리 판은 [색…]) }  — 풀었을 때만
//  stats/<sid>/<판>     = 셈 { tries 답한 수, ok 푼 수, dark 너무 진함 · pale 너무 옅음 · amount 양 · pick 예상 · order 차례 · paper 먹 없음 }
//  names/<sid>          = 이름(선생님 화면 표)
//  3장(그림 속 먹)은 명화 탐정 사건 — 푼 것만 classRPG_art/progress/<sid> 에서 읽는다(쓰지 않음).
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';   // 설정 · 앱 만들기 · 관리자 비밀번호 확인 [SUBAPP-COMMON-1]

export const ROOT = 'classRPG_ink';
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
    async saveTry(stage, { ok, mistake, n, stars, c }) {
      const k = keyOf(stage), up = {};
      up[`stats/${sid}/${k}/tries`] = inc(1);
      up[`stats/${sid}/${k}/${ok ? 'ok' : keyOf(mistake || 'etc')}`] = inc(1);
      if (name) up[`names/${sid}`] = name;
      const p = await st.progress();
      if (ok && better(p[k], { st: stars, n })) { p[k] = { n, st: stars, t: Date.now(), ...(c ? { c } : {}) }; up[`progress/${sid}/${k}`] = p[k]; }
      await root.update(up);
    },
    async artDone() { return (await db.ref('classRPG_art/progress/' + sid).once('value')).val() || {}; },
    // ── 선생님 ──
    async teacherOK(pw) { return adminPwOK(db, pw); },
    async all() { const v = (await root.once('value')).val() || {}; return { progress: v.progress || {}, stats: v.stats || {}, names: v.names || {} }; },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'ink.local';
  const load = () => { const d = lsGet(KEY, {}); d.progress = d.progress || {}; d.stats = d.stats || {}; return d; };
  const save = d => lsSet(KEY, d);
  const bump = (d, k, w) => { const s = d.stats[k] = d.stats[k] || {}; s.tries = (s.tries || 0) + 1; s[w] = (s[w] || 0) + 1; };
  return {
    me: { sid, name, guest: true }, online: false,
    async progress() { return load().progress; },
    async saveTry(stage, { ok, mistake, n, stars, c }) {
      const d = load(), k = keyOf(stage);
      bump(d, k, ok ? 'ok' : keyOf(mistake || 'etc'));
      if (ok && better(d.progress[k], { st: stars, n })) d.progress[k] = { n, st: stars, t: Date.now(), ...(c ? { c } : {}) };
      save(d);
    },
    async artDone() { return (lsGet('art.local', {}) || {}).progress || {}; },   // 명화 탐정 손님 기록(같은 기기)
    async teacherOK() { return true; },
    async all() { const d = load(); return { progress: { [sid]: d.progress }, stats: { [sid]: d.stats }, names: { [sid]: name } }; },
  };
}
