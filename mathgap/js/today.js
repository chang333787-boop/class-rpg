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
//  문항 기록(logItem → 저장소 log/<sid>/<날짜>): 차시 · 맞음/틀림 · 걸린 시간 · 틀린 모양 — 효과 확인과 실수 판정 모형을 실제 기록으로 맞추기 위해(이름 없음)
//  도전 층(10-11 · 교사 '문장제는 유형이 겹치고 단원 · 학년에 따라 숫자만 바뀐다'): 탑의 층을 다 켜면 꼭대기 위에 그 단원 숫자로 낸 문제집 유형 층(어떤 수 · 간격 · 수 카드 …)이 열린다.
//    불씨 3개(시간 재지 않음 · 틀리면 하나 꺼짐) · 틀리면 같이 풀기(식 고르기 → 계산)에서 처음 막힌 곳으로 까닭을 가른다:
//    tpl 문제 모양(식 고르기에서 막힘) · dom 숫자 영역(분수 · 소수 단원에서 식을 못 골랐는데 같은 문제를 작은 자연수로는 풂) · calc 계산 · plan 단계를 나눠 주면 다 풂
//    켠 유형은 단원과 상관없이 간격 복습(키 'T:유형') — 점검 날이면 지금 단원 숫자로 다시 나온다(숫자만 바뀐 같은 유형). 유형 시험 = 수학 빈칸 찾기 tests/types.test.mjs
//  아이 기록(kid) = { states, scans: { 단원: 요약 }, marks: { 차시: 'teacher' }, rev: { 차시: { i 간격 단계, due 점검 날(ms) } },
//                     bugs: { '차시|오답 이름': 수 }, run: 하던 것 | null, days: { 날짜: { ms, n, lit, review, extra } }, seen: { intro },
//                     types: { 유형: { lit: { 단원: 때 }, diag: { tpl, dom, calc, plan }, n } } } · 도전 층 '선생님과' = marks['T:유형@단원']
import { byId, lessonsOfUnit, sortByGrade, makeItem, corePre, resolve } from './core/lessons/index.js';
import { newUnitScan, currentItem, answer, mergeStates } from './core/engine.js';
import { newPractice, currentPractice, answerPractice, workedSteps, limitOf, RULE } from './core/practice.js';
import { rng } from './core/math.js';
import { TYPES, typesOfUnit, makeType, plainUnit, isType } from './core/types/index.js';

export const LIT = ['known', 'auto', 'slow'];
export const DEFAULT_MIN = 10;
export const REVIEW_DAYS = [1, 3, 7, 14, 30];   // 간격 단계별 다음 점검까지 날 수
export const WARM_N = 2, TOP_N = 3;              // 하루 불 점검 문제 수 — 연습하는 날은 2, 탑 완성 뒤엔 3
export { RULE, limitOf, workedSteps };

const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const blankKid = () => ({ states: {}, scans: {}, marks: {}, rev: {}, bugs: {}, run: null, days: {}, seen: {}, types: {} });
const isLit = (kid, c) => !!(kid.states[c] && LIT.includes(kid.states[c].s));
const dayOf = (kid, now) => { const k = dayKey(now); return (kid.days[k] = kid.days[k] || { ms: 0, n: 0, lit: [] }); };

// ── 탑 ──
// floors: 단원 차시(아래 → 위) · base: 기초 층(옛 단원 · 살펴보기에서 처음 막힌 곳) · 층 상태 lit | dark | teacher(선생님과 함께) | q(아직 안 봄)
export function towerOf(unit, kid) {
  const scan = kid.scans[unit];
  const st = (c) => (!scan ? 'q' : isLit(kid, c) ? 'lit' : kid.marks[c] === 'teacher' ? 'teacher' : 'dark');
  const floors = lessonsOfUnit(unit).map((c, i) => ({ c, no: i + 1, name: byId[c].kid, st: st(c) }));
  const base = scan ? (scan.base || []).filter((c) => byId[c]).map((c) => ({ c, name: byId[c].kid, st: st(c), base: true })) : [];
  const all = [...base, ...floors];
  const next = scan ? all.find((f) => f.st === 'dark') || null : null;
  // 도전 층 — 꼭대기 위 · 아래층을 다 켜기 전엔 잠김(lock)
  const tops = typesOfUnit(unit).map((t, i) => {
    const c = typeKey(t), on = typeLit(kid, t, unit);
    const st1 = !scan ? 'q' : on ? 'lit' : next ? 'lock' : kid.marks[`${c}@${unit}`] === 'teacher' ? 'teacher' : 'dark';
    return { c, t, no: i + 1, name: TYPES[t].name, st: st1, top: true };
  });
  const topNext = tops.find((f) => f.st === 'dark') || null;
  return { unit, floors, base, all, next, lit: all.filter((f) => f.st === 'lit').length, total: all.length, scanned: !!scan, waiting: all.filter((f) => f.st === 'teacher').length,
    tops, topNext, topLit: tops.filter((f) => f.st === 'lit').length, topWaiting: tops.filter((f) => f.st === 'teacher').length };
}
export const typeKey = (t) => `T:${t}`;
const typeOf = (kid, t) => (kid.types[t] = kid.types[t] || { lit: {}, diag: {}, n: 0 });
export const typeLit = (kid, t, unit = null) => { const x = kid.types && kid.types[t]; return !!(x && x.lit && (unit ? x.lit[unit] : Object.keys(x.lit).length)); };
// 이 유형을 켠 다른 단원(가장 최근) — '지난 탑에서 켠 유형이에요'
export const litElsewhere = (kid, t, unit) => { const x = kid.types && kid.types[t]; if (!x || !x.lit) return null; const us = Object.keys(x.lit).filter((u) => u !== unit).sort((a, b) => x.lit[b] - x.lit[a]); return us[0] || null; };

// ── 간격 복습 ──
function schedule(kid, c, i, now) { const k = Math.max(0, Math.min(REVIEW_DAYS.length - 1, i)); kid.rev[c] = { i: k, due: dayStart(now) + REVIEW_DAYS[k] * DAY }; }
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
export function startFloor(kid, unit, c, id, now = Date.now()) {
  const P = newPractice({ id, sid: 'kid', plan: [c], now });
  kid.run = { unit, kind: 'prac', c, P, t: now };
  return P;
}
// 연습이 끝났을 때(불이 켜졌거나 12문제 안에 못 켬) — { lit, teacher, slow }
export function finishFloor(kid, P, now = Date.now()) {
  const c = P.plan[0], o = (P.outcome || {})[c], unit = kid.run && kid.run.unit;
  kid.run = null;
  if (!o) return { lit: false };
  const old = kid.states[c] || {};
  kid.states[c] = { s: o.s, t: now, h: [...(old.h || []), { t: now, s: o.s, sess: P.id, ok: o.ok, n: o.n }].slice(-12) };
  if (LIT.includes(o.s)) {
    delete kid.marks[c];
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
  return { item, steps: workedSteps(c, p).slice(0, 4) };
}

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
// 같이 풀기 끝 — 단계마다 처음 시도 결과 [{ kind, key, ok, c, bug }] → 까닭 tpl · dom(쉬운 숫자 문제로 정함) · calc · plan
export function typeHelpDone(kid, Y, steps, now = Date.now()) {
  const X = typeOf(kid, Y.t);
  const keyMiss = steps.some((s) => s.key && !s.ok), calc = steps.find((s) => s.kind === 'calc' && !s.ok);
  let d;
  if (keyMiss) {
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
  const { a, b } = F.items[F.i], r = resolve('MUL', { a, b });
  return { c: r.c, p: r.p, item: makeItem(r.c, r.p), n: F.i + 1, of: F.items.length, sec: byId[r.c].sec };
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
  if (res.ok) {
    R.todo.shift(); R.out.push({ c, ok: true });
    schedule(kid, c, R.miss[c] ? r.i : r.i + 1, now);   // 한 번에 맞히면 다음 간격으로, 다시 해서 맞히면 같은 간격
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
  return { ok: !!res.ok, bug: res.bug || null, ans: q.item.ans, c, again: !res.ok && !!R.cur && R.cur.c === c, done: R.done, out: R.out, type: !!q.type };
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
    next: tw.next ? tw.next.c : T.stage === 'type' && T.top ? T.top.c : null, nextName: tw.next ? tw.next.name : T.stage === 'type' && T.top ? T.top.name : '', nextNo: tw.next ? (tw.next.base ? 0 : tw.next.no) : null,
    floors: tw.all.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : 0)).join(''),
    tops: tw.tops.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : f.st === 'lock' ? 8 : 0)).join(''),
    review: T.stage === 'review' ? (T.n || (kid.run && kid.run.R ? kid.run.R.todo.length : 0)) : 0,
    day: dayKey(now), ms: d.ms, n: d.n, doneToday: d.ms >= T.budget || T.stage === 'top', t: now,
  };
}

export { currentItem, answer, currentPractice, answerPractice, newPractice, TYPES, typesOfUnit, isType, plainUnit };
