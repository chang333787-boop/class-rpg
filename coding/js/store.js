// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_coding 아래만 쓴다(음악실 classRPG_music 과 같은 꼴).
//  RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다(선생님 화면의 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기만 예외).
//  progress/<sid>/<판>  = 가장 좋은 기록 { n 블록 수, st 별, t 때 }  — 풀었을 때만
//  stats/<sid>/<판>     = 셈 { tries 실행 수, ok 성공 수, wall · water · edge · tree · land · noacorn · short · acorns · loop · draw · empty 실패 까닭별 }
//  code/<sid>/<판>      = 마지막 코드 { j Blockly 저장 꼴(글) , t }  — 이어서 하기 · 선생님이 코드 보기
//  names/<sid>          = 이름(선생님 화면 표)
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';   // 설정 · 앱 만들기 · 관리자 비밀번호 확인 [SUBAPP-COMMON-1]

export const ROOT = 'classRPG_coding';
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
    me: { sid, name: name || '', guest: false }, online: true,
    async progress() { if (!mine) mine = (await root.child('progress/' + sid).once('value')).val() || {}; return mine; },
    // 한 번 실행한 결과 — 셈은 늘 · 기록은 더 좋을 때만 · 이름도 같이(선생님 표)
    async saveRun(stage, { ok, why, n, stars }) {
      const k = keyOf(stage), up = {};
      up[`stats/${sid}/${k}/tries`] = inc(1);
      up[`stats/${sid}/${k}/${ok ? 'ok' : keyOf(why || 'etc')}`] = inc(1);
      if (name) up[`names/${sid}`] = name;
      const p = await st.progress();
      if (ok && better(p[k], { st: stars, n })) { p[k] = { n, st: stars, t: Date.now() }; up[`progress/${sid}/${k}`] = p[k]; }
      await root.update(up);
    },
    async saveCode(stage, json) { await root.child(`code/${sid}/${keyOf(stage)}`).set({ j: json, t: Date.now() }); },
    async loadCode(stage) { const v = (await root.child(`code/${sid}/${keyOf(stage)}`).once('value')).val(); return v && v.j || null; },
    // ── 선생님 ──
    async teacherOK(pw) { return adminPwOK(db, pw); },
    async all() { const v = (await root.once('value')).val() || {}; return { progress: v.progress || {}, stats: v.stats || {}, names: v.names || {} }; },
    async codeOf(owner, stage) { const v = (await root.child(`code/${keyOf(owner)}/${keyOf(stage)}`).once('value')).val(); return v && v.j || null; },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'coding.local';
  const load = () => { const d = lsGet(KEY, {}); d.progress = d.progress || {}; d.stats = d.stats || {}; d.code = d.code || {}; return d; };
  const save = d => lsSet(KEY, d);
  return {
    me: { sid, name, guest: true }, online: false,
    async progress() { return load().progress; },
    async saveRun(stage, { ok, why, n, stars }) {
      const d = load(), k = keyOf(stage), s = d.stats[k] = d.stats[k] || {};
      s.tries = (s.tries || 0) + 1; const w = ok ? 'ok' : keyOf(why || 'etc'); s[w] = (s[w] || 0) + 1;
      if (ok && better(d.progress[k], { st: stars, n })) d.progress[k] = { n, st: stars, t: Date.now() };
      save(d);
    },
    async saveCode(stage, json) { const d = load(); d.code[keyOf(stage)] = json; save(d); },
    async loadCode(stage) { return load().code[keyOf(stage)] || null; },
    async teacherOK() { return true; },
    async all() { const d = load(); return { progress: { [sid]: d.progress }, stats: { [sid]: d.stats }, names: { [sid]: name } }; },
    async codeOf(owner, stage) { return load().code[keyOf(stage)] || null; },
  };
}
