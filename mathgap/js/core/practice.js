// 연습하기 — 처음 막힌 곳부터 한 칸씩 위로. 화면과 상관없는 순수 로직
//   문제마다 제한 시간(기준 시간의 2배 — 진단의 '느림' 기준과 같다)이 있다
//   제한 시간 안에 맞히면 ●(불씨) 하나. 틀리면 ● 하나가 꺼진다(0 아래로는 안 감). 늦게 맞히면 ●는 그대로
//   ●가 5개 모이면 통과 · 늦게라도 6개를 이어서 맞히면 '느림'으로 통과
//   (10-10 교사 '틀리면 처음부터는 가혹' → 하나만 꺼지게 · 대신 5개 — 모의 실험: 정답률 60% 아이 통과 53%→49% · 90% 아이 4.9→5.9문항)
//   12문항 안에 통과 못 하면 '선생님과 함께'로 남기고 다음 개념으로 · 계획을 다 돌면 처음 못 푼 문제를 다시 푼다
import { byId, makeItem, stepsOf, sortByGrade, gradeIdx } from './lessons/index.js';
import { rng } from './math.js';

export const RULE = { streak: 5, slowStreak: 6, max: 12, fastX: 2 };
export const limitOf = (cid) => Math.round(byId[cid].sec * RULE.fastX); // 제한 시간(초)
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// { fast: 지금 모은 ●(시간 안 정답 +1 · 틀림 −1 · 늦은 정답 0), all: 끝에서부터 이어서 맞힌 수 }
export function chainOf(items) {
  let fast = 0, all = 0;
  for (const x of items) fast = x.fast ? fast + 1 : x.ok ? fast : Math.max(0, fast - 1);
  for (let i = items.length - 1; i >= 0 && items[i].ok; i--) all++;
  return { fast, all };
}

export function newPractice({ id, sid, plan, origin = null, from = null, now = Date.now() }) {
  const P = { v: 1, kind: 'prac', id, sid, t0: now, plan: plan.filter((c) => byId[c]), origin, from, idx: 0, seq: 0, per: {}, log: [], done: false };
  P.plan.forEach((c) => { P.per[c] = { items: [], state: 'doing' }; });
  if (!P.plan.length && origin) P.final = true;
  P.cur = P.plan.length ? nextItem(P, P.plan[0]) : origin ? { c: origin.c, p: origin.p, final: true } : null;
  if (!P.cur) finishPractice(P);
  return P;
}
function nextItem(P, c) { P.seq++; return { c, p: byId[c].gen(rng(hash(`${P.id}:${P.seq}`))) }; }

export function currentPractice(P) {
  if (P.done || !P.cur) return null;
  const c = P.cur.c, per = P.per[c];
  return { ...P.cur, item: makeItem(c, P.cur.p), n: per ? per.items.length + 1 : 1, streak: per ? chainOf(per.items).fast : 0, limit: limitOf(c), conceptIdx: P.idx, of: P.plan.length };
}
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// 답하기 → 화면에 보여 줄 되먹임 { ok, bug, ans, mastered?, gaveUp?, finalOk? }
export function answerPractice(P, { vals = [], raws = [], idk = false, ms = 0, t = Date.now() }) {
  const q = currentPractice(P);
  if (!q) return null;
  const res = idk ? { ok: false } : q.item.check(vals, raws);
  P.log.push({ c: q.c, p: q.p, vals, idk, ok: !!res.ok, bug: res.bug || null, ms, t, final: !!q.final });
  const fb = { ok: !!res.ok, bug: res.bug || null, ans: q.item.ans, c: q.c, p: q.p, final: !!q.final };
  if (q.final) { P.finalOk = !!res.ok; finishPractice(P); fb.finalOk = !!res.ok; return fb; }

  const per = P.per[q.c], c = byId[q.c];
  const fast = !!res.ok && ms <= limitOf(q.c) * 1000;
  per.items.push({ ok: !!res.ok, ms, idk, fast });
  const ch = chainOf(per.items);
  Object.assign(fb, { fast, dots: ch.fast, run: ch.all, limit: limitOf(q.c) });
  const chainMs = (ch.all ? per.items.slice(-ch.all) : []).filter((x) => x.fast).map((x) => x.ms);
  if (ch.fast >= RULE.streak) { per.state = 'mastered'; per.ms = median(chainMs); fb.mastered = true; }
  else if (ch.all >= RULE.slowStreak) { per.state = 'mastered-slow'; per.ms = median(per.items.slice(-ch.all).map((x) => x.ms)); fb.mastered = true; fb.slow = true; }
  else if (per.items.length >= RULE.max) { per.state = 'teacher'; fb.gaveUp = true; }
  if (per.state !== 'doing') advance(P);
  else P.cur = nextItem(P, q.c);
  return fb;
}

function advance(P) {
  P.idx++;
  if (P.idx < P.plan.length) { P.cur = nextItem(P, P.plan[P.idx]); return; }
  if (P.origin) { P.cur = { c: P.origin.c, p: P.origin.p, final: true }; return; }
  finishPractice(P);
}

export function stopPractice(P) { if (!P.done) { P.stopped = true; finishPractice(P); } return P; }

function finishPractice(P) {
  P.done = true; P.cur = null;
  const out = {};
  for (const [cid, per] of Object.entries(P.per)) {
    const c = byId[cid], n = per.items.length, ok = per.items.filter((x) => x.ok).length;
    if (!n) continue;
    let s;
    if (per.state === 'mastered') s = c.fact && per.ms <= c.sec * 1000 ? 'auto' : 'known';
    else if (per.state === 'mastered-slow') s = 'slow';
    else s = ok / n >= 0.5 ? 'unstable' : 'gap';
    out[cid] = { s, n, ok, ms: per.ms || 0 };
  }
  if (P.origin && P.finalOk) out[P.origin.c] = { s: 'known', n: 1, ok: 1 };
  P.outcome = out;
  return P;
}

// 같은 숫자로 쪼갠 풀이 (보기용) — 단계마다 { why, item, sol }
export function workedSteps(c, p) {
  return stepsOf(c, p).map((s) => { const it = makeItem(s.c, s.p); return { why: s.why, c: s.c, item: it, sol: it.sol }; });
}

// 진단 결과에서 연습 계획: 처음 막힌 곳(낮은 학년) → 그 위 흔들린 개념 → … (원래 문제는 마지막에 다시 풀기)
export function planFromResult(S) {
  const st = (S.result && S.result.states) || {}, C0 = S.mode === 'unit' ? null : S.problem.c;
  const pick = Object.keys(st).filter((c) => c !== C0 && byId[c] && ['gap', 'unstable', 'bridge', 'shaky', 'slow'].includes(st[c].s));
  return sortByGrade(pick).slice(0, 8);
}
// 학생 표에서 연습 계획: 처음 막힌 곳부터 → 그 위로 '아래 때문에 틀림'인 차시를 차례로 올라간다 (낮은 학년부터 6개)
export function planFromStates(states) {
  const main = Object.keys(states).filter((c) => byId[c] && ['gap', 'unstable', 'bridge', 'slow'].includes(states[c].s));
  const climb = Object.keys(states).filter((c) => byId[c] && states[c].s === 'shaky');
  return sortByGrade([...main, ...climb]).slice(0, 6);
}
