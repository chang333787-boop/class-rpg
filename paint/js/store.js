// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_paint 아래만 쓴다(무늬 공방 classRPG_pattern 과 같은 꼴).
//  RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다(선생님 화면의 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기만 예외).
//  progress/<sid>/<판>  = 가장 좋은 기록 { st 별, n 틀린 수, t 때, c 내가 만든 색(#rrggbb · 색 바퀴 · 띠 판은 [색…]) }  — 풀었을 때만
//  stats/<sid>/<판>     = 셈 { tries 답한 수, ok 푼 수, light · chroma · hue · amount · pick · wheel · contrast · sort · order 헷갈림별 }
//  names/<sid>          = 이름(선생님 화면 표 · 느낌의 색 모자이크)
//  feel/<판>/<sid>      = 느낌의 색 { c #rrggbb, w 고른 까닭 칩 'bright,warm', t }  — 글 입력 없음(색과 칩뿐)
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';   // 설정 · 앱 만들기 · 관리자 비밀번호 확인 [SUBAPP-COMMON-1]

export const ROOT = 'classRPG_paint';
const better = (a, b) => !a || (b.st > (a.st || 0)) || (b.st === a.st && b.n < a.n);
// 학급 DB 는 열려 있어 그리기 전에 거른다 — 색은 #rrggbb · 칩은 아는 낱말만
export const validHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
export const cleanFeel = (f, chips) => (f && validHex(f.c) ? { c: f.c.toLowerCase(), w: String(f.w || '').split(',').filter(x => chips.includes(x)).slice(0, 2).join(','), t: +f.t || 0 } : null);

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
    // 느낌의 색 — 다시 붙이면 내 칸을 바꾼다(판은 '했어요'로)
    async saveFeel(stage, { c, w }) {
      const k = keyOf(stage), up = {}, t = Date.now(), p = await st.progress();
      up[`feel/${k}/${sid}`] = { c, w, t };
      p[k] = { st: 0, n: 0, t, c }; up[`progress/${sid}/${k}`] = p[k];
      up[`stats/${sid}/${k}/tries`] = inc(1); up[`stats/${sid}/${k}/ok`] = inc(1);
      if (name) up[`names/${sid}`] = name;
      await root.update(up);
    },
    async feelOf(stage) {
      const [f, n] = await Promise.all([root.child('feel/' + keyOf(stage)).once('value'), root.child('names').once('value')]);
      return { feel: f.val() || {}, names: n.val() || {} };
    },
    // ── 선생님 ──
    async teacherOK(pw) { return adminPwOK(db, pw); },
    async all() { const v = (await root.once('value')).val() || {}; return { progress: v.progress || {}, stats: v.stats || {}, names: v.names || {}, feel: v.feel || {} }; },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'paint.local';
  const load = () => { const d = lsGet(KEY, {}); d.progress = d.progress || {}; d.stats = d.stats || {}; d.feel = d.feel || {}; return d; };
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
    async saveFeel(stage, { c, w }) {
      const d = load(), k = keyOf(stage), t = Date.now();
      d.feel[k] = { ...(d.feel[k] || {}), [sid]: { c, w, t } }; d.progress[k] = { st: 0, n: 0, t, c }; bump(d, k, 'ok');
      save(d);
    },
    async feelOf(stage) { const d = load(); return { feel: d.feel[keyOf(stage)] || {}, names: { [sid]: name } }; },
    async teacherOK() { return true; },
    async all() { const d = load(); return { progress: { [sid]: d.progress }, stats: { [sid]: d.stats }, names: { [sid]: name }, feel: d.feel }; },
  };
}
