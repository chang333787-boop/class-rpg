// 오늘의 수학 — 하루 흐름과 탑 계산(화면 · 저장과 상관없는 순수 로직 · 시험 = scripts/unit/mathgap/today.test.mjs)
//  탑 = 선생님이 고른 단원의 차시들(층) + 그 아래 옛 단원에서 처음 막힌 차시(기초 층)
//  하루 = ① 처음이면 하는 법 ② 이 단원을 아직 안 살펴봤으면 '탑 살펴보기'(단원 점검)
//        ③ 점검 날이 된 켠 층이 있으면 먼저 '불 점검'(최대 2문제 · 탑 완성 뒤엔 3문제) ④ 불 꺼진 층을 아래부터 하나씩 연습(불씨 5개)
//        — 하루 10분(선생님이 바꿈)이 차면 그날은 끝
//  참고 프로그램에서 가져온 것(10-10 · 화면은 늘리지 않음)
//   · Math Academy 간격 복습: 켠 층마다 1 → 3 → 7 → 14 → 30일 뒤 점검 · '포함' 복습: 위층을 맞히면 그 아래 켜진 층은 복습한 셈(점검 날을 뒤로)
//   · Math Academy · ALEKS 예제 먼저: 층에 불을 켜기 전 같은 단계로 푼 예제 하나(exampleOf)
//   · Eedi 오답 모으기: 아이가 낸 틀린 모양을 차시별로 센다(noteBug) — 선생님 화면 '자주 나온 실수'
//   · 지난 단원도 잊지 않게: 예전 탑에서 켠 층도 점검 날이 되면 몸풀기에 섞는다(지금 탑이 먼저) · 두 번 틀려 꺼지면 지금 탑의 기초 층으로
//   · 구구단 빠르기(교사 '구구단 안 되는 애가 통분을 어떻게 해'): 곱셈에 기대는 단원이면 살펴보기 끝에 2~9단 두 문제씩 16문제(한 달에 한 번 · 틀리면 같은 단 한 문제 더) —
//     틀림 + 느림이 둘 이상인 단은 그 단 곱셈구구 차시를 기초 층으로(단원 점검은 차시마다 2~3문제라 '7단만 느린 아이'를 놓칠 수 있어서)
//  옛 개념 다리(bridgeOf): 층 안내에 '예전에 배운 것 — 숫자만 바뀐 거야' · 같이 풀기 맨 앞에 예전 문제 · 두 번 못 풀면 그 차시가 기초 층으로
//  문항 기록(logItem → 저장소 log/<sid>/<날짜>): 차시 · 맞음/틀림 · 걸린 시간 · 틀린 모양 — 효과 확인과 실수 판정 모형을 실제 기록으로 맞추기 위해(이름 없음)
//  도전 층(10-11 · 교사 '문장제는 유형이 겹치고 단원 · 학년에 따라 숫자만 바뀐다'): 탑의 층을 다 켜면 꼭대기 위에 그 단원 숫자로 낸 문제집 유형 층(어떤 수 · 간격 · 수 카드 …)이 열린다.
//    불씨 3개(시간 재지 않음 · 틀리면 하나 꺼짐) · 틀리면 같이 풀기(식 고르기 → 계산)에서 처음 막힌 곳으로 까닭을 가른다:
//    read 이야기 읽기(이야기 확인에서 막힘) · struct 상황 파악(같은 상황 고르기에서 막힘 — 교사 '문장을 통으로 구조적으로 보는 능력')
//    tpl 문제 모양(식 고르기에서 막힘) · dom 숫자 영역(분수 · 소수 단원에서 식을 못 골랐는데 같은 문제를 작은 자연수로는 풂) · calc 계산 · plan 단계를 나눠 주면 다 풂
//    켠 유형은 단원과 상관없이 간격 복습(키 'T:유형') — 점검 날이면 지금 단원 숫자로 다시 나온다(숫자만 바뀐 같은 유형). 유형 시험 = 수학 빈칸 찾기 tests/types.test.mjs
//  아이 기록(kid) = { states, scans: { 단원: 요약 }, marks: { 차시: 'teacher' }, rev: { 차시: { i 간격 단계, due 점검 날(ms) } },
//                     bugs: { '차시|오답 이름': 수 }, run: 하던 것 | null, days: { 날짜: { ms, n, lit, review, extra } }, seen: { intro },
//                     types: { 유형: { lit: { 단원: 때 }, diag: { read, struct, tpl, dom, calc, plan }, n } } } · 도전 층 '선생님과' = marks['T:유형@단원']
import { byId, lessonsOfUnit, sortByGrade, makeItem, corePre, resolve } from './core/lessons/index.js';
import { newUnitScan, currentItem, answer, mergeStates } from './core/engine.js';
import { newPractice, currentPractice as coreCurrent, answerPractice as coreAnswer, workedSteps, limitOf, RULE } from './core/practice.js';
import { hasWords, storyOf } from './core/words.js';
import { rng } from './core/math.js';
import { TYPES, typesOfUnit, makeType, plainUnit, isType } from './core/types/index.js';
import { bridgeOf, hasBridge } from './core/bridges.js';
import { readExpr, answerOf, diagnose, testable, judge, chainOf } from './core/errors.js';

export const LIT = ['known', 'auto', 'slow'];
export const DEFAULT_MIN = 10;
export const REVIEW_DAYS = [1, 3, 7, 14, 30];   // 간격 단계별 다음 점검까지 날 수
export const WARM_N = 2, TOP_N = 3;              // 하루 불 점검 문제 수 — 연습하는 날은 2, 탑 완성 뒤엔 3
export { RULE, limitOf, workedSteps };

const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const blankKid = () => ({ states: {}, scans: {}, marks: {}, rev: {}, bugs: {}, run: null, days: {}, seen: {}, types: {}, why: {} });
const isLit = (kid, c) => !!(kid.states[c] && LIT.includes(kid.states[c].s));
// ── 불빛 3단계(10-12 교사 '아는 것과 숙련된 것 구분이 잘 안 됨' → 기준은 Claude) ──
//  1 할 수 있음(희미한 불) = 맞히지만 느림 — 살펴보기에서 가운데 시간이 기준 시간의 2배를 넘음(engine 'slow') · 연습에서 느리게 6연속
//  2 능숙(밝은 불) = 정확하고 빠름 — 연습 불씨 5개 · 살펴보기에서 빠르게 · 희미한 층은 빠르기 연습 불씨 3개 · 불 점검을 시간 안에
//  3 숙련(별) = 능숙 + 며칠 뒤 불 점검을 처음 시도에 두 번 맞힘(rev.ok ≥ MASTER_OK) · 도전 층(문장제)은 시간을 재지 않아 켜짐(2) → 숙련(3)
export const MASTER_OK = 2;
export function levelOf(kid, c) {
  if (isType(c)) { const t = c.slice(2); return typeLit(kid, t) ? (kid.rev[c] && kid.rev[c].ok >= MASTER_OK ? 3 : 2) : 0; }
  const s = kid.states[c] && kid.states[c].s;
  if (!LIT.includes(s)) return 0;
  if (s === 'slow') return 1;
  return kid.rev[c] && kid.rev[c].ok >= MASTER_OK ? 3 : 2;
}
const dayOf = (kid, now) => { const k = dayKey(now); return (kid.days[k] = kid.days[k] || { ms: 0, n: 0, lit: [] }); };

// ── 탑 ──
// floors: 단원 차시(아래 → 위) · base: 기초 층(옛 단원 · 살펴보기에서 처음 막힌 곳) · 층 상태 lit | dark | teacher(선생님과 함께) | q(아직 안 봄)
export function towerOf(unit, kid) {
  const scan = kid.scans[unit];
  const st = (c) => (!scan ? 'q' : isLit(kid, c) ? 'lit' : kid.marks[c] === 'teacher' ? 'teacher' : 'dark');
  const lv = (c) => (scan && isLit(kid, c) ? levelOf(kid, c) : 0);
  const floors = lessonsOfUnit(unit).map((c, i) => ({ c, no: i + 1, name: byId[c].kid, st: st(c), lv: lv(c) }));
  const base = scan ? (scan.base || []).filter((c) => byId[c]).map((c) => ({ c, name: byId[c].kid, st: st(c), lv: lv(c), base: true })) : [];
  const all = [...base, ...floors];
  const next = scan ? all.find((f) => f.st === 'dark') || null : null;
  // 도전 층 — 꼭대기 위 · 아래층을 다 켜기 전엔 잠김(lock)
  const tops = typesOfUnit(unit).map((t, i) => {
    const c = typeKey(t), on = typeLit(kid, t, unit);
    const st1 = !scan ? 'q' : on ? 'lit' : next ? 'lock' : kid.marks[`${c}@${unit}`] === 'teacher' ? 'teacher' : 'dark';
    return { c, t, no: i + 1, name: TYPES[t].name, st: st1, lv: on ? levelOf(kid, c) : 0, top: true };
  });
  const topNext = tops.find((f) => f.st === 'dark') || null;
  return { unit, floors, base, all, next, lit: all.filter((f) => f.st === 'lit').length, total: all.length, scanned: !!scan, waiting: all.filter((f) => f.st === 'teacher').length,
    dim: all.filter((f) => f.lv === 1).length, star: all.filter((f) => f.lv === 3).length,
    tops, topNext, topLit: tops.filter((f) => f.st === 'lit').length, topWaiting: tops.filter((f) => f.st === 'teacher').length };
}
export const typeKey = (t) => `T:${t}`;
const typeOf = (kid, t) => (kid.types[t] = kid.types[t] || { lit: {}, diag: {}, n: 0 });
export const typeLit = (kid, t, unit = null) => { const x = kid.types && kid.types[t]; return !!(x && x.lit && (unit ? x.lit[unit] : Object.keys(x.lit).length)); };
// 이 유형을 켠 다른 단원(가장 최근) — '지난 탑에서 켠 유형이에요'
export const litElsewhere = (kid, t, unit) => { const x = kid.types && kid.types[t]; if (!x || !x.lit) return null; const us = Object.keys(x.lit).filter((u) => u !== unit).sort((a, b) => x.lit[b] - x.lit[a]); return us[0] || null; };

// ── 간격 복습 ──
//  ok = 처음 시도에 맞힌 점검 수(숙련 판정) — 새로 켜면 0부터
function schedule(kid, c, i, now, ok = 0) { const k = Math.max(0, Math.min(REVIEW_DAYS.length - 1, i)); kid.rev[c] = { i: k, due: dayStart(now) + REVIEW_DAYS[k] * DAY, ...(ok ? { ok } : {}) }; }
const ancestorsOf = (c) => { const seen = new Set(), st = [c]; while (st.length) for (const y of corePre(st.pop())) if (!seen.has(y)) { seen.add(y); st.push(y); } return seen; };
// 위층을 맞히면 그 아래 켜진 층도 복습한 셈 — 점검 날을 그 단계 간격만큼 뒤로(단계는 올리지 않음)
function creditBelow(kid, unit, c, now) {
  for (const a of ancestorsOf(c)) { const r = kid.rev[a]; if (r && isLit(kid, a)) r.due = Math.max(r.due, dayStart(now) + REVIEW_DAYS[r.i] * DAY); }
}
// 오늘 점검할 켠 층 — 지금 탑에서 점검 날이 지난 것(오래 밀린 순) 다음에 예전 탑의 것(old: 그 탑 단원)
export function dueFloors(kid, unit, now = Date.now()) {
  const due = (f) => f.st === 'lit' && kid.rev[f.c] && kid.rev[f.c].due <= dayStart(now);
  const byDue = (a, b) => kid.rev[a.c].due - kid.rev[b.c].due;
  const here = towerOf(unit, kid).all.filter(due).sort(byDue), seen = new Set(here.map((f) => f.c));
  const old = [];
  for (const u of Object.keys(kid.scans)) {
    if (u === unit || !lessonsOfUnit(u).length) continue;
    for (const f of towerOf(u, kid).all) if (due(f) && !seen.has(f.c)) { seen.add(f.c); old.push({ ...f, old: u }); }
  }
  // 켠 유형 — 지금 단원에 그 유형이 있으면 지금 단원 숫자로, 없으면 마지막으로 켠 단원 숫자로(하루 하나까지는 startReview 가 정함)
  const ty = [];
  for (const t of Object.keys(kid.types || {})) {
    const c = typeKey(t), r = kid.rev[c];
    if (!TYPES[t] || !typeLit(kid, t) || !r || r.due > dayStart(now)) continue;
    const u = typesOfUnit(unit).includes(t) ? unit : litElsewhere(kid, t, null);
    if (u && TYPES[t].units[u]) ty.push({ c, t, name: TYPES[t].name, st: 'lit', type: true, u, old: u !== unit ? u : undefined });
  }
  return [...here, ...ty.sort((a, b) => kid.rev[a.c].due - kid.rev[b.c].due), ...old.sort(byDue)];
}

// ── 오늘 할 일 ──
// { stage: 'intro'|'scan'|'prac'|'review'|'top'|'wait'|'done'|'none', ... } · review 에 warm = 연습 전 몸풀기(탑이 아직 덜 켜짐)
export function todayOf(kid, cfg = {}, now = Date.now()) {
  const unit = cfg.unit;
  if (!unit || !lessonsOfUnit(unit).length) return { stage: 'none' };
  const d = kid.days[dayKey(now)] || { ms: 0, n: 0, lit: [] };
  const budget = ((cfg.minutes || DEFAULT_MIN) + (d.extra || 0)) * 60000;   // extra = 아이가 '5분만 더'로 늘린 분
  const tw = towerOf(unit, kid);
  const base = { unit, tower: tw, day: d, budget, left: Math.max(0, budget - d.ms) };
  if (!kid.seen.intro) return { ...base, stage: 'intro' };
  if (kid.run && kid.run.unit === unit) return { ...base, stage: kid.run.kind, resume: true, over: d.ms >= budget, ...(kid.run.kind === 'type' ? { top: tw.tops.find((f) => f.t === kid.run.ty) || tw.topNext } : {}) };
  if (d.ms >= budget) return { ...base, stage: 'done' };
  if (!tw.scanned) return { ...base, stage: 'scan' };
  if (needsFacts(unit) && !kid.scans[unit].facts) return { ...base, stage: 'facts' };
  const due = d.review ? [] : dueFloors(kid, unit, now);
  if (due.length) return { ...base, stage: 'review', due, warm: !!tw.next, n: Math.min(due.length, tw.next ? WARM_N : TOP_N) };
  if (tw.next) return { ...base, stage: 'prac', floor: tw.next };
  const dim = tw.all.find((f) => f.lv === 1 && (kid.states[f.c] || {}).speedDay !== dayKey(now));   // 빠르기 연습은 한 층에 하루 한 번
  if (dim) return { ...base, stage: 'prac', floor: dim, speed: true };
  if (tw.topNext) return { ...base, stage: 'type', top: tw.topNext };
  if (tw.waiting || tw.topWaiting) return { ...base, stage: 'wait' };
  return { ...base, stage: 'top' };
}

// ── 탑 살펴보기(단원 점검) ──
export function startScan(kid, unit, id, now = Date.now()) {
  const S = newUnitScan({ id, sid: 'kid', unit, prior: {}, opts: { maxItems: 30 }, now });
  kid.run = { unit, kind: 'scan', S, t: now };
  return S;
}
// 살펴보기가 끝나면 상태를 합치고 기초 층을 정한다 · 켜진 층은 점검 날을 잡는다(직접 맞힌 층 7일 · 미루어 안 층 3일 뒤)
export function finishScan(kid, unit, S, now = Date.now()) {
  kid.states = mergeStates(kid.states, S, now);
  const R = S.result, inUnit = new Set(lessonsOfUnit(unit));
  const below = [...R.roots, ...R.bridges, ...R.unstable].filter((c) => byId[c] && !inUnit.has(c));
  kid.scans[unit] = { t: now, n: S.log.length, ms: S.log.reduce((a, l) => a + Math.min(l.ms || 0, 60000), 0), base: sortByGrade([...new Set(below)]).slice(0, 4), boundaries: R.boundaries || [], roots: R.roots || [] };
  kid.run = null;
  if (needsFacts(unit) && kid.facts && now - kid.facts.t < FACTS_EVERY * DAY) applyFacts(kid, unit);
  const tw = towerOf(unit, kid);
  for (const f of tw.all) if (f.st === 'lit' && !kid.rev[f.c]) schedule(kid, f.c, kid.states[f.c].inf ? 1 : 2, now);
  return towerOf(unit, kid);
}

// ── 한 층 불 켜기(연습) ──
// ── 문장제 섞기(10-11 · 교사 '문제은행처럼 많이 · 진단하고 밖에서 연습하라면 연속성이 끊김') ──
//  계산 차시 연습에서 STORY_EVERY 번째 문제마다 같은 숫자의 문장제(core/words.js — 그 차시 식 그대로라 차시 규칙을 지킴)
//  답이 같아 불씨 규칙은 그대로 · 읽는 시간만큼 시간 ×STORY_X · 같이 풀기 = 식 고르기 → 그 차시 단계(kid.js)
export const STORY_EVERY = 3, STORY_X = 1.6;
const hs = (s) => String(s).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 17);
function storyNow(P, q) {
  if (!q || q.final || P.speed || !hasWords(q.c) || q.n % STORY_EVERY) return null;
  try { return storyOf(q.c, q.p, hs(`${P.id}:${q.n}`), { plain: true }); } catch (e) { return null; }
}
export function currentPractice(P) {
  const q = coreCurrent(P), s = storyNow(P, q);
  return s ? { ...q, item: s.item, story: s, limit: Math.round(q.limit * STORY_X) } : q;
}
export function answerPractice(P, a) {
  const q = currentPractice(P);
  if (!q) return null;
  let fb;
  if (!q.story) fb = coreAnswer(P, a);
  else { const pre = a.idk ? null : q.item.check(a.vals || [], a.raws || []); fb = { ...coreAnswer(P, { ...a, pre, limit: q.limit, story: true }), story: true }; }
  if (fb && !fb.ok && !P.done && stuckOn(P, q.c)) fb.stuck = true;   // 연달아 못 풂 → 같이 풀기 끝에 '아직 어려워요'
  return fb;
}

export function startFloor(kid, unit, c, id, now = Date.now(), { speed = false } = {}) {
  const P = newPractice({ id, sid: 'kid', plan: [c], speed, now });
  kid.run = { unit, kind: 'prac', c, P, t: now, ...(speed ? { speed: true } : {}) };
  return P;
}
// 연습이 끝났을 때(불이 켜졌거나 12문제 안에 못 켬) — { lit, teacher, slow }
export function finishFloor(kid, P, now = Date.now()) {
  const c = P.plan[0], o = (P.outcome || {})[c], unit = kid.run && kid.run.unit;
  kid.run = null;
  if (!o) return { lit: false };
  if (P.speed && !LIT.includes(o.s) || P.speed && o.s === 'slow') {   // 빠르기 연습에서 못 밝힘 — 정확도가 절반 넘으면 '할 수 있음' 그대로, 아니면 다시 꺼진 층
    const keep = o.ok / Math.max(1, o.n) >= 0.5, old = kid.states[c] || {};
    kid.states[c] = keep ? { ...old, speedDay: dayKey(now) } : { ...old, s: 'unstable', t: now };
    return { lit: false, speed: true, stay: keep };
  }
  const old = kid.states[c] || {};
  kid.states[c] = { s: o.s, t: now, h: [...(old.h || []), { t: now, s: o.s, sess: P.id, ok: o.ok, n: o.n }].slice(-12) };
  if (LIT.includes(o.s)) {
    delete kid.marks[c];
    delete kid.bugs[`${c}|${STEP_BUG}`];       // 다시 켰으니 '단계에서 막힘' 셈은 처음부터
    schedule(kid, c, 0, now);                 // 갓 켠 층은 다음 날 한 번 점검
    if (unit) creditBelow(kid, unit, c, now);
    return { lit: true, slow: o.s === 'slow' };
  }
  kid.marks[c] = 'teacher';
  return { lit: false, teacher: true };
}

// 예제 하나 — 그 차시 문제를 같은 숫자로 쪼갠 단계와 답까지(층에 불을 켜기 전 '이렇게 풀어요')
export function exampleOf(c, seed = 1) {
  const p = byId[c].gen(rng(seed)), item = makeItem(c, p);
  return { item, p, steps: workedSteps(c, p).slice(0, 4), bridge: bridgeOf(c, p) };
}

// ── 옛 개념 다리(10-11 · 교사 '옛날에 배웠지? 숫자만 바뀐 거야') — 지금 분수의 나눗셈 차시 · 내용 = core/bridges.js ──
//  같이 풀기 맨 앞에 예전 문제(그 차시 문제 그대로)를 낸다. 처음 시도에 두 번 못 풀면(다른 날이어도) 그 차시가 진짜 빈칸 →
//  지금 탑의 기초 층으로 데려온다(살펴보기 · 불 점검과 같은 길). 센 횟수는 틀린 모양 모으기(bugs)에 '다리 문제에서 막힘'으로.
export const BRIDGE_BUG = '다리 문제(예전에 배운 문제)에서 막힘';
export function bridgeMiss(kid, unit, oldC, now = Date.now()) {
  noteBug(kid, oldC, { name: BRIDGE_BUG });
  const n = kid.bugs[`${oldC}|${BRIDGE_BUG}`] || 0;
  if (n < 2 || isLit(kid, oldC) && n < 3) return { added: false, n };
  const d = goDown(kid, unit, oldC, kid.run && kid.run.c, now, 'bridge');
  return { added: d.added, n };
}

// ── 막힌 단계 → 그 차시로 내려가기 · '아직 어려워요' 인정하기(10-11 교사 시연: '가분수 ↔ 대분수를 모르는데 계속 새 문제 —
//    여러 번 틀려도 별일 없음 · 못 한다고 인정하는 장치가 없다') ──
//  같이 풀기 한 단계를 혼자 못 하면(첫 시도 틀림 · 알려 줘요) 그 단계 차시에 '막힘' 하나 → STUCK.miss 번이면 내려감
//  한 층에서 연달아 STUCK.row 문제를 못 풀거나 STUCK.max 문제가 되면 '아직 어려워요' — 막힌 앞 차시가 있으면 내려가고, 없으면 '선생님과'
export const STEP_BUG = '같이 풀기 단계에서 막힘';
export const STUCK = { miss: 2, row: 3, max: 8 };
const earlier = (a, b) => a !== b && sortByGrade([a, b])[0] === a;
// c 차시를 지금 탑에서 다시 켜야 할 곳으로 — 같은 탑의 아래층이면 불을 끄고, 앞 단원이면 기초 층으로 · from = 막힌 층(선생님 화면 기록)
export function goDown(kid, unit, c, from = null, now = Date.now(), src = 'step') {
  const sc = kid.scans[unit];
  if (!sc || !byId[c] || (from && !earlier(c, from))) return { added: false };
  const tw = towerOf(unit, kid), at = tw.all.find((f) => f.c === c);
  if (at && at.st !== 'lit') return { added: false, already: true, c };
  kid.states[c] = { ...(kid.states[c] || {}), s: 'unstable', t: now, src };
  delete kid.rev[c];
  if (!at) sc.base = sortByGrade([...new Set([...(sc.base || []), c])]).slice(0, 6);
  if (from) sc.down = { ...(sc.down || {}), [c]: from };
  return { added: true, c };
}
export function stepMiss(kid, unit, c, from, now = Date.now()) {
  if (!byId[c] || c === from || (from && !earlier(c, from))) return { added: false, n: 0 };
  noteBug(kid, c, { name: STEP_BUG });
  const n = kid.bugs[`${c}|${STEP_BUG}`] || 0;
  if (n < STUCK.miss) return { added: false, n };
  return { ...goDown(kid, unit, c, from, now), n };
}
// 이 층에서 막혔나 — 연달아 STUCK.row 문제 틀림(모름 포함) 또는 STUCK.max 문제째
export function stuckOn(P, c) {
  const per = P && P.per && P.per[c];
  if (!per || per.state !== 'doing') return false;
  const xs = per.items, tail = xs.slice(-STUCK.row);
  return (tail.length === STUCK.row && tail.every((x) => !x.ok)) || xs.length >= STUCK.max;
}
// '아직 어려워요' — 막힌 앞 차시(down)가 있으면 그리로 내려가고 지금 층은 그대로 두고, 없으면 지금 층을 '선생님과'로
export function giveUp(kid, unit, c, down = null, now = Date.now()) {
  kid.run = null;
  if (down) { const d = goDown(kid, unit, down, c, now); if (d.added || d.already) return { down }; }
  const old = kid.states[c] || {};
  kid.states[c] = { ...old, s: 'gap', t: now };
  kid.marks[c] = 'teacher';
  return { teacher: true };
}
export { bridgeOf, hasBridge };

// ── 도전 층(문제 유형) — 불씨 3개 · 시간 재지 않음 · 틀리면 하나 꺼짐 · 8문제 안에 못 켜면 '선생님과' ──
export const TRULE = { streak: 3, max: 8 };
const hashS = (s) => String(s).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
// 유형 문제 하나 — 문제 글을 답 칸에 붙여 둔다(화면이 같이 그림)
export function typeItem(t, unit, seed, easy = false) {
  const inst = makeType(t, unit, seed, { easy });
  inst.item.story = inst.story;
  return inst;
}
// 층 안내의 예제 — 같은 틀을 단계와 답까지(고르기는 맞는 보기, 계산은 답을 채워서)
export const typeExample = (t, unit) => typeItem(t, unit, hashS(`ex:${t}:${unit}`));
export function startType(kid, unit, t, id, now = Date.now()) {
  const Y = { id, kind: 'type', t, unit, seq: 0, out: [], cur: null, done: false };
  nextType(Y);
  kid.run = { unit, kind: 'type', ty: t, Y, t: now };
  return Y;
}
function nextType(Y, easy = false) { Y.cur = { seed: hashS(`${Y.id}:${++Y.seq}`), easy }; }
const chainT = (out) => { let f = 0; for (const x of out) if (!x.easy) f = x.ok ? f + 1 : Math.max(0, f - 1); return f; };
export function currentType(Y) {
  if (!Y || Y.done || !Y.cur) return null;
  const inst = typeItem(Y.t, Y.unit, Y.cur.seed, Y.cur.easy);
  return { inst, item: inst.item, c: typeKey(Y.t), easy: !!Y.cur.easy, n: Y.out.filter((x) => !x.easy).length + (Y.cur.easy ? 0 : 1), flames: chainT(Y.out) };
}
// 답하기 → { ok, easy, flames, lit?, teacher?, help(틀림 → 같이 풀기) } · 쉬운 숫자 문제는 불씨와 상관없고 까닭(dom · tpl)만 정한다
export function answerType(kid, Y, a, now = Date.now()) {
  const q = currentType(Y);
  if (!q) return null;
  const res = a.idk ? { ok: false } : q.item.check(a.vals || [], a.raws || []);
  const ok = !!res.ok, X = typeOf(kid, Y.t);
  Y.out.push({ ok, easy: q.easy, ms: a.ms || 0 });
  if (!a.idk && !ok) noteBug(kid, typeKey(Y.t), res.bug);
  const fb = { ok, bug: res.bug || null, ans: q.item.ans, easy: q.easy, before: q.flames };
  if (q.easy) {   // 쉬운 숫자로 한 번 더 — 풀면 숫자 영역, 못 풀면 문제 모양
    const d = ok ? 'dom' : 'tpl';
    X.diag[d] = (X.diag[d] || 0) + 1; fb.diag = d; Y.lastDiag = d;
    nextType(Y);
    fb.flames = chainT(Y.out);
    return fb;
  }
  X.n = (X.n || 0) + 1;
  fb.flames = chainT(Y.out);
  if (fb.flames >= TRULE.streak) { Y.done = true; Y.cur = null; fb.lit = true; return fb; }
  if (Y.out.filter((x) => !x.easy).length >= TRULE.max) { Y.done = true; Y.cur = null; fb.teacher = true; return fb; }
  if (!ok) { fb.help = true; Y.prevSeed = Y.cur.seed; }   // 같이 풀기에서 식을 못 고르면 이 문제의 쉬운 숫자 판을 낸다(같은 연산 짝)
  nextType(Y);
  return fb;
}
// 같이 풀기 끝 — 단계마다 처음 시도 결과 [{ kind, read, struct, key, ok, c, bug }] → 처음 막힌 겹(진단 사다리 · 10-11):
//   read 이야기 읽기 → struct 상황(구조) 파악 → tpl 문제 모양(식 세우기) · dom 숫자 영역(쉬운 숫자 문제로 정함) → calc 계산 → plan 단계를 나눠 주면 풂
export function typeHelpDone(kid, Y, steps, now = Date.now()) {
  const X = typeOf(kid, Y.t);
  const miss = (f) => steps.some((s) => f(s) && !s.ok);
  const keyMiss = miss((s) => s.key), calc = steps.find((s) => s.kind === 'calc' && !s.ok);
  let d;
  if (miss((s) => s.read)) d = 'read';
  else if (miss((s) => s.struct)) d = 'struct';
  else if (keyMiss) {
    if (plainUnit(Y.t, Y.unit) || !Y.cur || Y.done) d = 'tpl';
    else { Y.cur = { seed: Y.prevSeed != null ? Y.prevSeed : Y.cur.seed, easy: true }; d = 'easy'; }     // 다음 문제 = 방금 문제와 같은 틀 · 같은 연산 짝 · 작은 자연수 — 거기서 정한다
  } else if (calc) { d = 'calc'; if (calc.c && byId[calc.c]) noteBug(kid, calc.c, calc.bug); }
  else d = 'plan';
  if (d !== 'easy') { X.diag[d] = (X.diag[d] || 0) + 1; Y.lastDiag = d; }
  logItem(kid, { c: typeKey(Y.t), ok: false, ms: 0, kind: 'yd', bug: { name: d } }, now);
  return { diag: d, calc: calc ? calc.c : null };
}
// 도전 층이 끝났을 때 — 켜짐(간격 복습 시작) · 선생님과
export function finishType(kid, Y, now = Date.now()) {
  const unit = Y.unit, X = typeOf(kid, Y.t), c = typeKey(Y.t), lit = chainT(Y.out) >= TRULE.streak;
  kid.run = null;
  if (lit) { X.lit[unit] = now; delete kid.marks[`${c}@${unit}`]; schedule(kid, c, 0, now); return { lit: true }; }
  kid.marks[`${c}@${unit}`] = 'teacher';
  return { lit: false, teacher: true };
}
export const typeName = (c) => (isType(c) ? TYPES[c.slice(2)].name : '');

// ── 구구단 빠르기 — 2~9단 두 문제씩(16) · 단마다 틀림 · 느림(그 차시 기준 시간 넘김)을 센다 ──
export const FACTS_EVERY = 30;   // 날 — 한 번 하면 한 달은 그 결과를 쓴다
const FACT_STRANDS = ['M', 'D', 'F', 'G', 'R', 'X'];
// 곱셈에 기대는 단원 — 3학년 이상 곱셈 · 나눗셈 · 분수 · 약수배수 · 비 · 혼합 계산, 그리고 5학년 이상 소수(소수의 곱셈 · 나눗셈)
export const needsFacts = (unit) => { const g = Number(String(unit)[0]); return g >= 3 && lessonsOfUnit(unit).some((c) => FACT_STRANDS.includes(byId[c].s) || (g >= 5 && byId[c].s === 'DEC')); };
export function startFacts(kid, unit, id, now = Date.now()) {
  const r = rng(String(id).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 11));
  const items = [];
  for (let a = 2; a <= 9; a++) { const b1 = r.int(2, 9); let b2; do { b2 = r.int(2, 9); } while (b2 === b1); items.push({ a, b: b1 }, { a, b: b2 }); }
  for (let i = items.length - 1; i > 0; i--) { const j = r.int(0, i); [items[i], items[j]] = [items[j], items[i]]; }
  const F = { id, kind: 'facts', items, i: 0, out: [] };
  kid.run = { unit, kind: 'facts', F, t: now };
  return F;
}
export function currentFact(F) {
  if (!F || F.i >= F.items.length) return null;
  const cur = F.items[F.i], { a, b } = cur, r = resolve('MUL', { a, b });
  // 번호는 처음 16문제만 센다 — 덤(틀린 단 한 문제 더)은 번호를 늘리지 않음(10-11 점검: '16문제'라 했는데 21까지 늘어남)
  const n = F.items.slice(0, F.i + 1).filter((x) => !x.extra).length, of = F.items.filter((x) => !x.extra).length;
  return { c: r.c, p: r.p, item: makeItem(r.c, r.p), n, of, extra: !!cur.extra, sec: byId[r.c].sec };
}
export function answerFact(kid, F, a, now = Date.now()) {
  const q = currentFact(F);
  if (!q) return null;
  const res = a.idk ? { ok: false } : q.item.check(a.vals || [], a.raws || []);
  F.out.push({ c: q.c, ok: !!res.ok, ms: a.ms || 0 });
  // 한 번 틀리면 같은 단에서 한 문제 더(실수 하나로 약한 단이 되지 않게) — 단마다 한 번만
  const cur = F.items[F.i];
  if (!res.ok && !cur.extra) { const r = rng(F.i * 7919 + cur.a * 31 + cur.b); let b; do { b = r.int(2, 9); } while (b === cur.b); F.items.splice(F.i + 1, 0, { a: cur.a, b, extra: true }); }
  F.i++;
  const fb = { ok: !!res.ok, bug: res.bug || null, c: q.c, ans: q.item.ans, done: F.i >= F.items.length };
  if (fb.done) Object.assign(fb, finishFacts(kid, F, now));
  return fb;
}
function finishFacts(kid, F, now) {
  const by = {};
  for (const o of F.out) { const b = (by[o.c] = by[o.c] || { n: 0, wrong: 0, slow: 0 }); b.n++; if (!o.ok) b.wrong++; else if (o.ms > byId[o.c].sec * 1000) b.slow++; }
  // 약한 단 = 틀림 + 느림이 둘 이상(틀린 뒤 한 번 더 낸 문제까지 세어) — 한 번 실수는 넘어가고, 모르거나 늘 느린 단만
  const weak = Object.entries(by).filter(([, b]) => b.wrong + b.slow >= 2).sort((x, y) => y[1].wrong - x[1].wrong || y[1].slow - x[1].slow).map(([c]) => c);
  kid.facts = { t: now, res: by, weak };
  for (const c of weak) { kid.states[c] = { s: by[c].wrong ? 'gap' : 'unstable', t: now, src: 'facts' }; delete kid.rev[c]; }
  const unit = kid.run && kid.run.unit;
  kid.run = null;
  if (unit) applyFacts(kid, unit);
  return { weak, res: by };
}
// 구구단 빠르기 결과를 탑에 — 아직 안 켜진 약한 단 차시 둘까지 기초 층으로
function applyFacts(kid, unit) {
  const sc = kid.scans[unit];
  if (!sc) return;
  sc.facts = true;
  const weak = ((kid.facts && kid.facts.weak) || []).filter((c) => byId[c] && !isLit(kid, c)).slice(0, 2);
  if (weak.length) sc.base = sortByGrade([...new Set([...(sc.base || []), ...weak])]).slice(0, 6);
}

// ── 불 점검 — 점검 날이 된 켠 층에서 · 한 번 틀리면 같은 층 한 문제 더 · 두 번 틀리면 그 층 불이 꺼진다 ──
export function startReview(kid, unit, id, now = Date.now()) {
  const tw = towerOf(unit, kid);
  let oneType = false;   // 유형 문제는 길어서 하루 점검에 하나까지
  const due = dueFloors(kid, unit, now).filter((f) => !f.type || (!oneType && (oneType = true)));
  const pick = due.slice(0, tw.next ? WARM_N : TOP_N).map((f) => f.c), tyUnit = Object.fromEntries(due.filter((f) => f.type).map((f) => [f.c, f.u]));
  const R = { id, kind: 'review', unit, seq: 0, todo: pick, total: pick.length, miss: {}, out: [], cur: null, done: false, tyUnit };
  nextReview(R);
  kid.run = { unit, kind: 'review', R, t: now };
  if (R.done) endReview(kid, now);
  return R;
}
function nextReview(R) {
  if (!R.todo.length) { R.done = true; R.cur = null; return; }
  const c = R.todo[0], h = `${R.id}:${++R.seq}`.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  if (isType(c)) { R.cur = { c, seed: h, u: (R.tyUnit && R.tyUnit[c]) || R.unit }; return; }
  R.cur = { c, p: byId[c].gen(rng(h)) };
}
function endReview(kid, now) { dayOf(kid, now).review = true; kid.run = null; }
export function currentReview(R) {
  if (R.done || !R.cur) return null;
  if (isType(R.cur.c)) { const inst = typeItem(R.cur.c.slice(2), R.cur.u, R.cur.seed); return { ...R.cur, item: inst.item, inst, type: true, limit: null }; }
  return { ...R.cur, item: makeItem(R.cur.c, R.cur.p), limit: limitOf(R.cur.c) };
}
export function answerReview(kid, R, a, now = Date.now()) {
  const q = currentReview(R);
  if (!q) return null;
  const res = a.idk ? { ok: false } : q.item.check(a.vals || [], a.raws || []);
  const c = q.c, r = kid.rev[c] || { i: 0 };
  let faster = false, master = false;
  if (res.ok) {
    R.todo.shift(); R.out.push({ c, ok: true });
    const okN = (r.ok || 0) + (R.miss[c] ? 0 : 1), lv0 = levelOf(kid, c);
    // 느렸던 층을 처음 시도에 시간 안에 맞히면 밝게(할 수 있음 → 능숙)
    if (!R.miss[c] && !isType(c) && kid.states[c] && kid.states[c].s === 'slow' && (a.ms || 0) > 0 && a.ms <= limitOf(c) * 1000) { kid.states[c] = { ...kid.states[c], s: 'known', t: now }; faster = true; }
    schedule(kid, c, R.miss[c] ? r.i : r.i + 1, now, okN);   // 한 번에 맞히면 다음 간격으로, 다시 해서 맞히면 같은 간격
    master = lv0 === 2 && levelOf(kid, c) === 3;
    if (R.unit && !isType(c)) creditBelow(kid, R.unit, c, now);
  } else if (R.miss[c] && isType(c)) {   // 유형 — 두 번째로 틀리면 그 유형 불이 꺼진다(어느 단원에서 켰든) → 그 단원 도전 층에서 다시
    R.todo.shift(); R.out.push({ c, ok: false });
    typeOf(kid, c.slice(2)).lit = {};
    delete kid.rev[c];
  } else if (R.miss[c]) {           // 두 번째로 틀림 → 이 층 불이 꺼진다
    R.todo.shift(); R.out.push({ c, ok: false });
    kid.states[c] = { ...(kid.states[c] || {}), s: 'unstable', t: now };
    delete kid.rev[c];
    // 예전 탑의 층이면 지금 탑의 기초 층으로 데려와 다시 켠다
    const sc = R.unit && kid.scans[R.unit];
    if (sc && !towerOf(R.unit, kid).all.some((f) => f.c === c)) sc.base = sortByGrade([...new Set([...(sc.base || []), c])]).slice(0, 6);
  } else R.miss[c] = 1;            // 한 번 틀림 → 같은 층 새 숫자로 한 번 더
  if (!res.ok && !a.idk) noteBug(kid, c, res.bug);
  nextReview(R);
  if (R.done) endReview(kid, now);
  return { ok: !!res.ok, bug: res.bug || null, ans: q.item.ans, c, again: !res.ok && !!R.cur && R.cur.c === c, done: R.done, out: R.out, type: !!q.type, faster, master };
}

// ── 문항 기록 — 한 줄 글 '차시|결과|걸린 0.1초|무엇|틀린 모양' (결과 1 맞음 · 0 틀림 · 2 모르겠어요 · 무엇 s 살펴보기 · p 연습 · r 점검) ──
//  저장소가 날짜별로 따로 쌓는다(아이 기록을 열 때 같이 받지 않게) · 하루 400줄까지
export function logItem(kid, { c, ok, idk, ms, kind, bug }, now = Date.now()) {
  if (!byId[c] && !isType(c)) return null;
  const line = [c, idk ? 2 : ok ? 1 : 0, Math.round(Math.min(ms || 0, 600000) / 100), kind || '', bug && bug.name ? String(bug.name).slice(0, 40).replace(/\|/g, '/') : ''].join('|');
  const k = dayKey(now), L = (kid.logq = kid.logq || []);
  if (L.length < 400) L.push({ day: k, t: now, line });
  return line;
}

// 기록 한 줄 읽기 · 처음과 지금 견주기(선생님 화면) — lines 는 때 순서
export function parseLog(line) {
  const [c, r, ds, kind, bug] = String(line || '').split('|');
  if (!byId[c] && !isType(c)) return null;
  return { c, ok: r === '1', idk: r === '2', ms: (+ds || 0) * 100, kind: kind || '', bug: bug || '' };
}
const median = (xs) => { const v = xs.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };
// 차시마다 처음 몇 문제와 최근 몇 문제(겹치지 않게 · 4문제 넘게 푼 차시만): { c: { n, first: { n, acc, med }, last: { n, acc, med } } }
export function compareLogs(lines, ids = null) {
  const by = {};
  for (const ln of lines) { const x = typeof ln === 'string' ? parseLog(ln) : ln; if (x && (!ids || ids.includes(x.c))) (by[x.c] = by[x.c] || []).push(x); }
  const sum = (xs) => ({ n: xs.length, acc: Math.round(100 * xs.filter((x) => x.ok).length / xs.length), med: Math.round(median(xs.filter((x) => x.ok).map((x) => x.ms)) / 1000) });
  const out = {};
  for (const [c, xs] of Object.entries(by)) {
    if (xs.length < 4) continue;
    const k = Math.min(3, Math.floor(xs.length / 2));
    out[c] = { n: xs.length, first: sum(xs.slice(0, k)), last: sum(xs.slice(-k)) };
  }
  return out;
}
// 살펴볼 때(또는 그 뒤) 꺼져 있다가 지금 켜진 층 — 상태 기록에 켜지지 않은 때가 있었던 층
export const litAfterDark = (kid, unit) => towerOf(unit, kid).all.filter((f) => f.st === 'lit' && ((kid.states[f.c] && kid.states[f.c].h) || []).some((x) => !LIT.includes(x.s))).length;

// ── 틀린 모양 모으기(선생님 화면 '자주 나온 실수') — 많이 나온 40가지만 둔다 ──
export function noteBug(kid, c, bug) {
  if (!bug || !bug.name || (!byId[c] && !isType(c))) return;
  const k = `${c}|${String(bug.name).slice(0, 60)}`;
  kid.bugs[k] = (kid.bugs[k] || 0) + 1;
  const keys = Object.keys(kid.bugs);
  if (keys.length > 40) keys.sort((a, b) => kid.bugs[a] - kid.bugs[b]).slice(0, keys.length - 40).forEach((x) => delete kid.bugs[x]);
}
export const bugsOf = (kid) => Object.entries(kid.bugs || {}).map(([k, n]) => { const i = k.indexOf('|'); return { c: k.slice(0, i), name: k.slice(i + 1), n }; }).filter((b) => byId[b.c] || isType(b.c)).sort((a, b) => b.n - a.n);

// ── 하루 기록 ──
// 문제 밖에서 배운 시간(예제 읽기 · 같이 풀기) — 문제 수는 늘리지 않고 시간만(cap 까지 · 10-11 점검: 같이 푼 시간이 오늘 시간에 안 들어감)
export function addStudy(kid, ms, cap = 180000, now = Date.now()) { const d = dayOf(kid, now); d.ms += Math.max(0, Math.min(ms || 0, cap)); return d; }
export function addTime(kid, ms, now = Date.now()) {
  const d = dayOf(kid, now);
  d.ms += Math.max(0, Math.min(ms || 0, 60000));   // 한 문제에 1분 넘게 걸려도 1분까지만 센다(자리 비움)
  d.n += 1;
  return d;
}
// '5분만 더' — 오늘만
export function addExtra(kid, min = 5, now = Date.now()) { const d = dayOf(kid, now); d.extra = (d.extra || 0) + min; return d; }
export function markLit(kid, c, now = Date.now()) { const d = dayOf(kid, now); if (!d.lit.includes(c)) d.lit.push(c); }
// 오래된 날 기록은 30일만 둔다
export function pruneDays(kid, now = Date.now()) { const keep = new Set(Array.from({ length: 30 }, (_, i) => dayKey(now - i * DAY))); for (const k of Object.keys(kid.days)) if (!keep.has(k)) delete kid.days[k]; }

// RPG 홈 카드 · 선생님 표에 쓰는 짧은 요약
export function cardOf(kid, cfg, now = Date.now()) {
  const T = todayOf(kid, cfg, now);
  if (T.stage === 'none') return { stage: 'none', t: now };
  const tw = T.tower, d = T.day;
  return {
    unit: cfg.unit, stage: T.stage === 'intro' ? 'scan' : T.stage, lit: tw.lit, total: tw.total, scanned: tw.scanned,
    ...(() => { const nx = tw.next || (T.stage === 'prac' && T.floor) || null; return { next: nx ? nx.c : T.stage === 'type' && T.top ? T.top.c : null, nextName: nx ? nx.name : T.stage === 'type' && T.top ? T.top.name : '', nextNo: nx ? (nx.base ? 0 : nx.no) : null }; })(),
    ...(T.speed ? { speed: true } : {}), dim: tw.dim, star: tw.star,   // 빠르기 연습 날 · 희미한 층 수 · 숙련 층 수
    floors: tw.all.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : 0)).join(''),
    tops: tw.tops.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : f.st === 'lock' ? 8 : 0)).join(''),
    review: T.stage === 'review' ? (T.n || (kid.run && kid.run.R ? kid.run.R.todo.length : 0)) : 0,
    day: dayKey(now), ms: d.ms, n: d.n, doneToday: d.ms >= T.budget || T.stage === 'top', t: now,
  };
}

export { currentItem, answer, newPractice, TYPES, typesOfUnit, isType, plainUnit };

// ── 틀린 까닭(10-12 교사 '틀린 건 알겠는데 어떤 점으로 틀렸는지 — 단순 계산 실수인지, 어떤 개념을 헷갈렸는지') — core/errors.js ──
//  문제마다: 식이 보이는 계산 문제면 그 답을 틀린 방법(버그)들로 맞춰 본 가설 · 계산 실수 · 이 문제로 가릴 수 있던 버그를 남긴다(맞힌 문제도 — 반대 증거)
//  차시마다 모아 judge: 확실(같은 방법이 두 번 · 반대 증거가 더 많지 않음) · 계산 실수 · 혹시(한 번) · 모름 — 가상 아이 시험 tests/errors.test.mjs
const fmtAns = (x) => (!x ? '' : x.q != null ? `${x.q} … ${x.r}` : x.d ? `${x.w ? `${x.w} ` : ''}${x.n}/${x.d}` : x.v ? String(Number((x.v.n / x.v.d).toFixed(6))) : '');
//  calc = 식이 보이는 차시 문제(문장제면 그 차시 계산 문제) · ansItem = 아이가 답한 칸(문장제 답 칸) · a = { vals, idk } · ok · bug = 차시가 짚은 틀린 모양
export function noteWhy(kid, c, calc, ansItem, a, ok, bug = null, now = Date.now()) {
  if (!calc || !readExpr(calc)) return null;
  const rec = { o: ok ? 1 : 0, t: testable(calc), at: now };
  let d = null;
  if (!ok) {
    if (a.idk) rec.k = 1;
    else {
      const ans = answerOf(ansItem || calc, a.vals || []);
      d = ans ? diagnose(calc, ans, { lessonBug: bug }) : null;
      if (d && d.hyps.length) rec.h = d.hyps.map((x) => x.id);
      if (d && d.slip) rec.sl = d.slip;
      if (!d || d.kind === 'unknown') rec.u = 1;
      const ai = ansItem || calc;
      if (d && d.mid) { rec.a = chainOf(ai, a.vals || []); rec.e = chainOf(ai, ai.sol.map(Number)); }   // 가운데 칸만 틀림 — 줄 전체로 보여야 다른 곳이 보임
      else { rec.a = fmtAns(ans); rec.e = fmtAns(answerOf(ai, ai.sol.map(Number))); }
    }
  }
  kid.why = kid.why || {};
  const rs = (kid.why[c] = [...(kid.why[c] || []), rec].slice(-8));
  delete kid.why[c]; kid.why[c] = rs;   // 최근 차시가 뒤로
  const ks = Object.keys(kid.why); if (ks.length > 20) ks.slice(0, ks.length - 20).forEach((x) => delete kid.why[x]);
  return d;
}
// 한 차시를 모아 본 결과 — { verdict: concept · proc · slip · maybe · idk · unknown · none, sure, maybe, wrong, slips, ex: 대표 오답 }
export function whyOf(kid, c) {
  const rs = (kid.why && kid.why[c]) || [];
  if (!rs.length) return null;
  const J = judge(rs.map((r) => ({ ok: !!r.o, idk: !!r.k, d: r.o || r.k ? null : { hyps: (r.h || []).map((id) => ({ id })), slip: r.sl || null, kind: r.u ? 'unknown' : r.h && r.h.length ? 'bug' : r.sl ? 'slip' : 'unknown' }, tests: r.t || [] })));
  const top = J.sure[0] || J.maybe[0] || null;
  const ex = rs.slice().reverse().find((r) => !r.o && !r.k && r.a && (!top || (r.h || []).includes(top.id) || J.verdict === 'slip')) || null;
  return { ...J, ex: ex ? { a: ex.a, e: ex.e, sl: ex.sl || null } : null };
}
// 한 문제의 짧은 말(아이 · 같이 풀기 첫 줄) — d = noteWhy 결과
export function whyLine(d) {
  if (!d) return null;
  const h = d.hyps.find((x) => x.kind === 'concept') || d.hyps[0];
  if (h) return { kind: h.kind, text: h.name, also: !!d.slip };
  if (d.slip) return { kind: 'slip', text: d.slip };
  return null;
}
