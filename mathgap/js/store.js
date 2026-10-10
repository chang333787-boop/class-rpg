// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_mathgap 아래만 쓴다(다른 학습 앱과 같은 꼴 · RPG 본 데이터 classRPG_v3 는 쓰지 않는다)
//  읽기는 선생님 화면의 반 명단 classRPG_v3/students 하나(id · 이름만 · common/roster.js) + 관리자 비밀번호 확인 한 번.
//  config              = { unit: '4-2-1', minutes: 10, t }            선생님이 고른 단원 · 하루 시간(쓰기는 선생님 화면만)
//  kids/<sid>/st       = 차시 상태 JSON 글(차시 id → { s 상태, t 때, inf 미루어 앎 })
//  kids/<sid>/scans    = 단원별 살펴보기 요약 JSON 글
//  kids/<sid>/marks    = '선생님과 함께' 층 JSON 글
//  kids/<sid>/rev      = 간격 복습(차시 → { i 간격 단계, due 점검 날 }) JSON 글 · kids/<sid>/bugs = 틀린 모양 수('차시|이름' → 수) JSON 글
//  kids/<sid>/run      = 하던 것(살펴보기 · 연습 · 불 점검 세션) JSON 글 | 없음 — 다음에 열면 같은 문제로 이어서
//  kids/<sid>/days/<날짜> = { ms 푼 시간, n 문제 수, lit 켠 층, review 불 점검 함 }
//  kids/<sid>/seen     = { intro 하는 법 본 때 }
//  kids/<sid>/card     = 짧은 요약(RPG 홈 카드 · 선생님 표) — today.js cardOf
//  log/<sid>/<날짜>/<키> = 문항 한 줄('차시|결과|0.1초|무엇|틀린 모양' · today.js logItem) — kids 와 따로 두어 아이 기록을 열 때 같이 받지 않는다
//  이름은 저장하지 않는다(학급 DB 는 로그인 없이 읽힌다) — 선생님 화면은 반 명단에서 이름을 붙인다.
//  JSON 글로 두는 까닭: 세션 안의 빈 배열 · null 이 RTDB 에서 사라져 이어 풀기가 깨지지 않게.
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { keyOf, lsGet, lsSet } from './util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';
import { blankKid } from './today.js';

export const ROOT = 'classRPG_mathgap';
const J = { st: 'states', scans: 'scans', marks: 'marks', run: 'run' };
const parse = (s, d) => { if (typeof s !== 'string') return d; try { return JSON.parse(s); } catch { return d; } };
// RTDB 는 값 안에 undefined 가 하나라도 있으면 쓰기를 통째로 거절한다 — 쓰기 전에 걸러 낸다(JSON 왕복)
const clean = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
// 학급 DB 는 열려 있어 읽은 값을 거른다 — 모양이 아니면 버린다
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export function kidFrom(v) {
  v = obj(v);
  const k = blankKid();
  k.states = obj(parse(v.st, {}));
  k.scans = obj(parse(v.scans, {}));
  k.marks = obj(parse(v.marks, {}));
  for (const [c, r] of Object.entries(obj(parse(v.rev, {})))) if (r && Number.isFinite(+r.due)) k.rev[c] = { i: Math.max(0, Math.min(4, +r.i || 0)), due: +r.due };
  for (const [key, n] of Object.entries(obj(parse(v.bugs, {})))) if (Number.isFinite(+n) && +n > 0) k.bugs[String(key).slice(0, 80)] = Math.min(999, +n);
  const run = parse(v.run, null); k.run = run && typeof run === 'object' && run.kind ? run : null;
  for (const [d, x] of Object.entries(obj(v.days))) if (/^\d{4}-\d\d-\d\d$/.test(d) && x && typeof x === 'object') k.days[d] = { ms: +x.ms || 0, n: +x.n || 0, lit: Array.isArray(x.lit) ? x.lit.filter((c) => typeof c === 'string') : [], review: !!x.review, extra: Math.min(30, Math.max(0, +x.extra || 0)) };
  k.seen = obj(v.seen);
  return k;
}
export const cleanCfg = (c) => { c = obj(c); return { unit: typeof c.unit === 'string' && /^\d-\d-\d$/.test(c.unit) ? c.unit : null, name: typeof c.name === 'string' ? c.name.slice(0, 40) : '', minutes: [5, 10, 15, 20].includes(+c.minutes) ? +c.minutes : 10, t: +c.t || 0 }; };

export function createStore({ sid, name, fb = globalThis.firebase, offline = false } = {}) {
  sid = sid ? keyOf(sid) : '';
  if (sid && fb && !offline) return rtdbStore(fb, sid, name);
  return localStore(sid || 'guest', name || '');
}

function rtdbStore(fb, sid, name) {
  const db = rpgDb(fb), root = db.ref(ROOT);
  const st = {
    me: { sid, name: name || '', guest: false }, online: true, db,
    async config() { return cleanCfg((await root.child('config').once('value')).val()); },
    async kid(id = sid) { return kidFrom((await root.child('kids/' + keyOf(id)).once('value')).val()); },
    // 한 문제마다 — 하던 것 · 오늘 기록 · 카드만(작게) / 끝날 때 — 상태 · 살펴보기 · 표시까지
    async save(kid, { full = false, card = null, day = null } = {}) {
      const up = {}, base = `kids/${sid}/`;
      up[base + 'run'] = kid.run ? JSON.stringify(kid.run) : null;
      up[base + 'rev'] = JSON.stringify(kid.rev); up[base + 'bugs'] = JSON.stringify(kid.bugs);
      if (card) up[base + 'card'] = clean(card);
      if (full) {   // 날짜 기록은 통째로(30일 넘은 날은 빠진다) — 그래서 한 날짜 칸과 같이 쓰지 않는다
        up[base + 'st'] = JSON.stringify(kid.states); up[base + 'scans'] = JSON.stringify(kid.scans); up[base + 'marks'] = JSON.stringify(kid.marks);
        up[base + 'seen'] = Object.keys(kid.seen).length ? clean(kid.seen) : null;
        up[base + 'days'] = Object.keys(kid.days).length ? clean(kid.days) : null;
      } else if (day) up[base + 'days/' + day] = clean(kid.days[day]);
      // 쌓인 문항 기록을 한 줄씩(키 = 때 + 두 글자 · 같은 때에 겹치지 않게)
      for (const q of (kid.logq || []).splice(0)) up[`log/${sid}/${q.day}/${q.t.toString(36)}${Math.random().toString(36).slice(2, 4)}`] = q.line;
      await root.update(up);
    },
    // ── 선생님 ──
    async teacherOK(pw) { return adminPwOK(db, pw); },
    async setConfig(cfg) { await root.child('config').set({ ...cleanCfg(cfg), t: Date.now() }); },
    async all() { const v = obj((await root.child('kids').once('value')).val()); return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { kid: kidFrom(x), card: obj(obj(x).card) }])); },
    async resetKid(id, unit) {     // 이 단원 다시 살펴보기 — 살펴보기 요약과 하던 것만 지운다(차시 상태는 남김)
      const k = await st.kid(id); delete k.scans[unit]; if (k.run && k.run.unit === unit) k.run = null;
      for (const c of Object.keys(k.marks)) delete k.marks[c];
      await root.child('kids/' + keyOf(id)).update({ scans: JSON.stringify(k.scans), run: k.run ? JSON.stringify(k.run) : null, marks: JSON.stringify(k.marks) });
    },
    async clearMarks(id) { await root.child(`kids/${keyOf(id)}/marks`).set(JSON.stringify({})); },
  };
  return st;
}

function localStore(sid, name) {
  const KEY = 'mathgap.local';
  const load = () => { const d = lsGet(KEY, {}); d.kids = d.kids || {}; d.config = d.config || { unit: '4-2-1', minutes: 10 }; return d; };
  return {
    me: { sid, name, guest: true }, online: false,
    async config() { return cleanCfg(load().config); },
    async kid(id = sid) { return kidFrom(load().kids[id]); },
    async save(kid, { card = null } = {}) {
      const d = load();
      d.log = (d.log || []).concat((kid.logq || []).splice(0).map((q) => q.line)).slice(-300);
      d.kids[sid] = { st: JSON.stringify(kid.states), scans: JSON.stringify(kid.scans), marks: JSON.stringify(kid.marks), rev: JSON.stringify(kid.rev), bugs: JSON.stringify(kid.bugs), run: kid.run ? JSON.stringify(kid.run) : null, days: kid.days, seen: kid.seen, card: card || (d.kids[sid] || {}).card || null };
      lsSet(KEY, d);
    },
    async teacherOK() { return true; },
    async setConfig(cfg) { const d = load(); d.config = { ...cleanCfg(cfg), t: Date.now() }; lsSet(KEY, d); },
    async all() { const d = load(); return Object.fromEntries(Object.entries(d.kids).map(([k, x]) => [k, { kid: kidFrom(x), card: obj(x.card) }])); },
    async resetKid(id, unit) { const d = load(), x = d.kids[id]; if (!x) return; const k = kidFrom(x); delete k.scans[unit]; if (k.run && k.run.unit === unit) k.run = null; k.marks = {}; x.scans = JSON.stringify(k.scans); x.run = k.run ? JSON.stringify(k.run) : null; x.marks = '{}'; lsSet(KEY, d); },
    async clearMarks(id) { const d = load(); if (d.kids[id]) { d.kids[id].marks = '{}'; lsSet(KEY, d); } },
  };
}
