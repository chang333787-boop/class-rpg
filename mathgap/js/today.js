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
//  문항 기록(logItem → 저장소 log/<sid>/<날짜>): 차시 · 맞음/틀림 · 걸린 시간 · 틀린 모양 — 효과 확인과 실수 판정 모형을 실제 기록으로 맞추기 위해(이름 없음)
//  아이 기록(kid) = { states, scans: { 단원: 요약 }, marks: { 차시: 'teacher' }, rev: { 차시: { i 간격 단계, due 점검 날(ms) } },
//                     bugs: { '차시|오답 이름': 수 }, run: 하던 것 | null, days: { 날짜: { ms, n, lit, review, extra } }, seen: { intro } }
import { byId, lessonsOfUnit, sortByGrade, makeItem, corePre } from './core/lessons/index.js';
import { newUnitScan, currentItem, answer, mergeStates } from './core/engine.js';
import { newPractice, currentPractice, answerPractice, workedSteps, limitOf, RULE } from './core/practice.js';
import { rng } from './core/math.js';

export const LIT = ['known', 'auto', 'slow'];
export const DEFAULT_MIN = 10;
export const REVIEW_DAYS = [1, 3, 7, 14, 30];   // 간격 단계별 다음 점검까지 날 수
export const WARM_N = 2, TOP_N = 3;              // 하루 불 점검 문제 수 — 연습하는 날은 2, 탑 완성 뒤엔 3
export { RULE, limitOf, workedSteps };

const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const blankKid = () => ({ states: {}, scans: {}, marks: {}, rev: {}, bugs: {}, run: null, days: {}, seen: {} });
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
  return { unit, floors, base, all, next, lit: all.filter((f) => f.st === 'lit').length, total: all.length, scanned: !!scan, waiting: all.filter((f) => f.st === 'teacher').length };
}

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
  return [...here, ...old.sort(byDue)];
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
  if (kid.run && kid.run.unit === unit) return { ...base, stage: kid.run.kind, resume: true, over: d.ms >= budget };
  if (d.ms >= budget) return { ...base, stage: 'done' };
  if (!tw.scanned) return { ...base, stage: 'scan' };
  const due = d.review ? [] : dueFloors(kid, unit, now);
  if (due.length) return { ...base, stage: 'review', due, warm: !!tw.next, n: Math.min(due.length, tw.next ? WARM_N : TOP_N) };
  if (tw.next) return { ...base, stage: 'prac', floor: tw.next };
  if (tw.waiting) return { ...base, stage: 'wait' };
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
  const tw = towerOf(unit, kid);
  for (const f of tw.all) if (f.st === 'lit' && !kid.rev[f.c]) schedule(kid, f.c, kid.states[f.c].inf ? 1 : 2, now);
  return tw;
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

// ── 불 점검 — 점검 날이 된 켠 층에서 · 한 번 틀리면 같은 층 한 문제 더 · 두 번 틀리면 그 층 불이 꺼진다 ──
export function startReview(kid, unit, id, now = Date.now()) {
  const tw = towerOf(unit, kid);
  const pick = dueFloors(kid, unit, now).slice(0, tw.next ? WARM_N : TOP_N).map((f) => f.c);
  const R = { id, kind: 'review', unit, seq: 0, todo: pick, total: pick.length, miss: {}, out: [], cur: null, done: false };
  nextReview(R);
  kid.run = { unit, kind: 'review', R, t: now };
  if (R.done) endReview(kid, now);
  return R;
}
function nextReview(R) {
  if (!R.todo.length) { R.done = true; R.cur = null; return; }
  const c = R.todo[0], r = rng(`${R.id}:${++R.seq}`.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7));
  R.cur = { c, p: byId[c].gen(r) };
}
function endReview(kid, now) { dayOf(kid, now).review = true; kid.run = null; }
export const currentReview = (R) => (R.done || !R.cur ? null : { ...R.cur, item: makeItem(R.cur.c, R.cur.p), limit: limitOf(R.cur.c) });
export function answerReview(kid, R, a, now = Date.now()) {
  const q = currentReview(R);
  if (!q) return null;
  const res = a.idk ? { ok: false } : q.item.check(a.vals || [], a.raws || []);
  const c = q.c, r = kid.rev[c] || { i: 0 };
  if (res.ok) {
    R.todo.shift(); R.out.push({ c, ok: true });
    schedule(kid, c, R.miss[c] ? r.i : r.i + 1, now);   // 한 번에 맞히면 다음 간격으로, 다시 해서 맞히면 같은 간격
    if (R.unit) creditBelow(kid, R.unit, c, now);
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
  return { ok: !!res.ok, bug: res.bug || null, ans: q.item.ans, c, again: !res.ok && !!R.cur && R.cur.c === c, done: R.done, out: R.out };
}

// ── 문항 기록 — 한 줄 글 '차시|결과|걸린 0.1초|무엇|틀린 모양' (결과 1 맞음 · 0 틀림 · 2 모르겠어요 · 무엇 s 살펴보기 · p 연습 · r 점검) ──
//  저장소가 날짜별로 따로 쌓는다(아이 기록을 열 때 같이 받지 않게) · 하루 400줄까지
export function logItem(kid, { c, ok, idk, ms, kind, bug }, now = Date.now()) {
  if (!byId[c]) return null;
  const line = [c, idk ? 2 : ok ? 1 : 0, Math.round(Math.min(ms || 0, 600000) / 100), kind || '', bug && bug.name ? String(bug.name).slice(0, 40).replace(/\|/g, '/') : ''].join('|');
  const k = dayKey(now), L = (kid.logq = kid.logq || []);
  if (L.length < 400) L.push({ day: k, t: now, line });
  return line;
}

// ── 틀린 모양 모으기(선생님 화면 '자주 나온 실수') — 많이 나온 40가지만 둔다 ──
export function noteBug(kid, c, bug) {
  if (!bug || !bug.name || !byId[c]) return;
  const k = `${c}|${String(bug.name).slice(0, 60)}`;
  kid.bugs[k] = (kid.bugs[k] || 0) + 1;
  const keys = Object.keys(kid.bugs);
  if (keys.length > 40) keys.sort((a, b) => kid.bugs[a] - kid.bugs[b]).slice(0, keys.length - 40).forEach((x) => delete kid.bugs[x]);
}
export const bugsOf = (kid) => Object.entries(kid.bugs || {}).map(([k, n]) => { const i = k.indexOf('|'); return { c: k.slice(0, i), name: k.slice(i + 1), n }; }).filter((b) => byId[b.c]).sort((a, b) => b.n - a.n);

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
    next: tw.next ? tw.next.c : null, nextName: tw.next ? tw.next.name : '', nextNo: tw.next ? (tw.next.base ? 0 : tw.next.no) : null,
    floors: tw.all.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : 0)).join(''),
    review: T.stage === 'review' ? (T.n || (kid.run && kid.run.R ? kid.run.R.todo.length : 0)) : 0,
    day: dayKey(now), ms: d.ms, n: d.n, doneToday: d.ms >= T.budget || T.stage === 'top', t: now,
  };
}

export { currentItem, answer, currentPractice, answerPractice, newPractice };
