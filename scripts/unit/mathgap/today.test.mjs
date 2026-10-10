// 오늘의 수학 하루 흐름 시험 — 가상 아이로 며칠을 돌려 본다(DOM 없음 · 네트워크 없음)
//  node scripts/unit/mathgap/today.test.mjs
//  · 다 아는 아이: 첫날 살펴보기로 탑이 다 켜지고, 점검 날(미루어 안 층 3일 · 직접 맞힌 층 7일 뒤)에만 불 점검
//  · 간격 복습(1 → 3 → 7 → 14 → 30일) · 위층을 맞히면 아래 켜진 층의 점검 날이 뒤로 · 연습하는 날 몸풀기는 2문제까지
//  · 틀린 모양 모으기 · 예제 · 저장소 거르기(kidFrom)
//  · 기초가 빈 아이: 살펴보기가 기초 층을 찾고, 날마다 10분 안에서 아래부터 켜며 올라가 탑을 완성
//  · 끝내 못 배우는 아이: 12문제 안에 못 켜면 '선생님과 함께'로 남기고 멈춤(끝없이 돌지 않음)
//  · 날마다 기록을 JSON 으로 저장했다 다시 읽어도(저장소 흉내) 같은 문제로 이어진다
//  · 도전 층(문제 유형): 아래층을 다 켜야 열림 · 불씨 3개 · 같이 풀기 까닭(문제 모양 · 숫자 영역 · 계산 · 단계) · 8문제 → 선생님과 · 점검은 지금 단원 숫자로 · 하루 하나
import { byId, preOf, corePre, lessonsOfUnit } from '../../../mathgap/js/core/lessons/index.js';
import { blankKid, todayOf, towerOf, startScan, finishScan, startFloor, finishFloor, startReview, answerReview, currentReview, addTime, markLit, cardOf,
  currentItem, answer, currentPractice, answerPractice, RULE, DEFAULT_MIN, REVIEW_DAYS, dueFloors, noteBug, bugsOf, exampleOf, dayKey, logItem,
  startFacts, currentFact, answerFact, needsFacts, parseLog, compareLogs, litAfterDark,
  startType, currentType, answerType, typeHelpDone, finishType, TRULE, typesOfUnit, plainUnit, typeLit } from '../../../mathgap/js/today.js';
import { kidFrom, createStore } from '../../../mathgap/js/store.js';
import { rng } from '../../../mathgap/js/core/math.js';

const results = [];
const pending = [];
const test = (name, fn) => { const fail = (e) => results.push(['FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')]); try { const r = fn(); if (r && typeof r.then === 'function') pending.push(r.then(() => results.push(['PASS', name]), fail)); else results.push(['PASS', name]); } catch (e) { fail(e); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const R = rng(11);
const DAY = 864e5, T0 = new Date(2026, 9, 12, 9, 0).getTime();
const roundtrip = (kid) => JSON.parse(JSON.stringify(kid));

// 가상 아이 — gaps 에 든 차시와 그 위(언제나 필요한 줄)는 못 푼다. learn: 연습에서 틀리고 풀이를 n번 보면 그 차시를 배운다
//  types: 'know' 도전 층도 앎 · 'none' 문제 모양을 모름(쉬운 숫자도 못 풂) · 'dom' 쉬운 숫자로는 풀지만 분수 · 소수면 식을 못 고름 · 'calc' 식은 고르지만 계산에서 틀림
function kidModel(gaps, { learnAfter = 2, slip = 0.03, ms = 6000, factMs = 1500, types = 'know' } = {}) {
  const seen = {};
  const okC = (c) => !gaps.has(c) && corePre(c).every(okC);
  const can = (c, p) => !gaps.has(c) && preOf(c, p).every(okC);
  return {
    gaps,
    respond(c, p, item) {
      const t = (c.startsWith('2-2-2:') ? factMs : ms) + Math.floor(R.next() * (c.startsWith('2-2-2:') ? 1000 : 3000));   // 구구단은 2~3초
      if (can(c, p) && !R.chance(slip)) return { vals: item.sol.map(Number), raws: item.sol.map(String), ms: t };
      if (item.choices) return { vals: [(item.sol[0] + 1) % item.choices.length], ms: t };
      return { vals: item.sol.map((x) => (x == null ? x : Number(x) + 1)), raws: item.sol.map((x) => String(Number(x) + 1)), ms: t };
    },
    sawHelp(c) { seen[c] = (seen[c] || 0) + 1; if (seen[c] >= learnAfter) gaps.delete(c); },
    // 도전 층 문제 · 같이 풀기 단계
    typeOk(q) { return types === 'know' || (types === 'dom' && q.easy); },
    stepOk(s, q) { if (types === 'know') return true; if (types === 'calc') return s.kind !== 'calc'; if (types === 'dom') return q.easy || !s.key; return false; },
  };
}
const solve = (it) => ({ vals: it.sol.map(Number), raws: it.sol.map(String) });
const wrong = (it) => (it.choices ? { vals: [(it.sol[0] + 1) % it.choices.length] } : { vals: it.sol.map((x) => Number(x) + 1), raws: it.sol.map((x) => String(Number(x) + 1)) });

// 하루 — 화면이 하는 일을 그대로: 오늘 할 일을 묻고, 문제를 풀고, 끝나면 정리. 문항마다 저장(roundtrip)
function playDay(kidIn, model, cfg, now, until = null) {
  let kid = roundtrip(kidIn), steps = 0, items = 0;
  const log = [];
  while (steps++ < 400) {
    const T = todayOf(kid, cfg, now);
    if (T.stage === 'intro') { kid.seen.intro = now; continue; }
    if (['done', 'top', 'wait', 'none'].includes(T.stage)) { log.push(T.stage); break; }
    if (T.resume && T.over) { log.push('over'); break; }
    if (T.stage === 'scan') {
      const S = kid.run ? kid.run.S : startScan(kid, cfg.unit, 'scan' + now, now);
      const q = currentItem(S);
      const a = model.respond(q.c, q.p, q.item);
      answer(S, { ...a, t: now }); addTime(kid, a.ms, now); items++;
      if (S.done) { finishScan(kid, cfg.unit, S, now); log.push('scanned'); }
    } else if (T.stage === 'prac') {
      const P = kid.run ? kid.run.P : startFloor(kid, cfg.unit, T.floor.c, 'f' + now + T.floor.c, now);
      const q = currentPractice(P);
      const a = model.respond(q.c, q.p, q.item);
      const fb = answerPractice(P, { ...a, t: now }); addTime(kid, a.ms, now); items++;
      if (!fb.ok) { model.sawHelp(q.c); noteBug(kid, q.c, fb.bug); }
      if (P.done) { const r = finishFloor(kid, P, now); if (r.lit) markLit(kid, q.c, now); log.push(r.lit ? 'lit:' + q.c : 'teacher:' + q.c); }
    } else if (T.stage === 'facts') {
      const F = kid.run ? kid.run.F : startFacts(kid, cfg.unit, 'fx' + now, now);
      const q = currentFact(F);
      const a = model.respond(q.c, q.p, q.item);
      const fb = answerFact(kid, F, a, now); addTime(kid, a.ms, now); items++;
      if (fb.done) log.push('facts');
    } else if (T.stage === 'type') {
      const Y = kid.run ? kid.run.Y : startType(kid, cfg.unit, T.top.t, 'y' + now + T.top.t, now);
      const q = currentType(Y), good = model.typeOk(q), ms2 = 20000;
      const fb = answerType(kid, Y, { ...(good ? solve(q.item) : wrong(q.item)), ms: ms2 }, now); addTime(kid, ms2, now); items++;
      if (fb.help) { const r = typeHelpDone(kid, Y, q.inst.steps.map((st) => ({ kind: st.kind, key: !!st.key, ok: model.stepOk(st, q), c: st.c || null, bug: null })), now); log.push('help:' + r.diag); }
      if (q.easy) log.push('easy:' + fb.diag);
      if (Y.done) { const r = finishType(kid, Y, now); if (r.lit) markLit(kid, 'T:' + Y.t, now); log.push(r.lit ? 'tlit:' + Y.t : 'tteacher:' + Y.t); }
    } else if (T.stage === 'review') {
      const Rv = kid.run ? kid.run.R : startReview(kid, cfg.unit, 'rv' + now, now);
      const q = currentReview(Rv);
      const a = model.respond(q.c, q.p, q.item);
      const fb = answerReview(kid, Rv, a, now); addTime(kid, a.ms, now); items++;
      if (fb.done) log.push('reviewed');
    }
    kid = roundtrip(kid);
    if (until && log.some(until)) break;
  }
  ok(steps < 400, '하루가 끝나지 않음 ' + log.join(','));
  return { kid, log, items, ms: (kid.days[Object.keys(kid.days).sort().pop()] || {}).ms || 0 };
}

const cfg = { unit: '4-2-1', minutes: DEFAULT_MIN };

test('다 아는 아이 — 첫날 살펴보기로 탑이 다 켜지고, 점검 날에만 불 점검(다음 날은 할 일 없음)', () => {
  const m = kidModel(new Set(), { slip: 0 });
  let d1 = playDay(blankKid(), m, cfg, T0);
  ok(d1.log.includes('scanned'), '살펴보기 안 끝남 ' + d1.log);
  const tw = towerOf(cfg.unit, d1.kid);
  ok(tw.lit === tw.total && tw.base.length === 0, `탑 ${tw.lit}/${tw.total} 기초 ${tw.base.length}`);
  const nTop = typesOfUnit(cfg.unit).length;
  ok(d1.log.includes('facts') && d1.items <= 14 + 16 + nTop * TRULE.streak, '살펴보기 + 구구단 빠르기 + 도전 층 문항 ' + d1.items + ' ' + d1.log);
  ok(d1.log.filter((x) => x.startsWith('tlit:')).length === nTop, '도전 층을 다 켜지 않음 ' + d1.log);
  ok(d1.log[d1.log.length - 1] === 'top', '첫날 끝 ' + d1.log);
  const d2 = playDay(d1.kid, m, cfg, T0 + DAY);
  ok(d2.items === 1 && d2.log.includes('reviewed') && d2.log[d2.log.length - 1] === 'top', `둘째 날은 갓 켠 도전 층 하나만 점검 ${d2.log} ${d2.items}문항`);
  const d4 = playDay(d1.kid, m, cfg, T0 + 7 * DAY);
  ok(d4.log.includes('reviewed') && d4.items === 3, `7일 뒤 불 점검 3문제 ${d4.log} ${d4.items}문항`);
  const d4b = playDay(d4.kid, m, cfg, T0 + 7 * DAY + 3600e3);
  ok(d4b.items === 0 && d4b.log[0] === 'top', '같은 날 또 점검 ' + d4b.log);
});

test('기초가 빈 아이(대분수 ↔ 가분수) — 기초 층을 찾고, 아래부터 켜며 며칠 안에 탑 완성 · 하루 10분 안', () => {
  const m = kidModel(new Set(['3-2-4:6']));
  let kid = blankKid(), days = 0, maxMs = 0;
  const first = playDay(kid, m, cfg, T0, (x) => x === 'scanned');
  const tw1 = towerOf(cfg.unit, first.kid);
  ok(tw1.base.some((f) => f.c === '3-2-4:6'), '기초 층에 대분수 ↔ 가분수가 없음 ' + JSON.stringify(tw1.base.map((f) => f.c)) + ' 뿌리 ' + JSON.stringify(first.kid.scans[cfg.unit].roots));
  ok(tw1.lit < tw1.total && tw1.next.c === '3-2-4:6', '살펴본 뒤 다음 층이 기초가 아님 ' + (tw1.next && tw1.next.c));
  const day1 = playDay(first.kid, m, cfg, T0); kid = day1.kid; days++; maxMs = day1.ms;
  while (days < 10) {
    const d = playDay(kid, m, cfg, T0 + days * DAY); kid = d.kid; days++; maxMs = Math.max(maxMs, d.ms);
    if (towerOf(cfg.unit, kid).lit === towerOf(cfg.unit, kid).total) break;
  }
  const tw = towerOf(cfg.unit, kid);
  ok(tw.lit === tw.total, `${days}일에도 탑이 다 안 켜짐 ${tw.lit}/${tw.total} ` + JSON.stringify(tw.all.map((f) => f.c + ':' + f.st)));
  ok(maxMs <= DEFAULT_MIN * 60000 + 60000, '하루 시간 넘침 ' + maxMs);
  ok(days <= 5, '며칠 걸림 ' + days);
  // 아래부터: 기초 층이 단원 층보다 먼저 켜졌다
  const litOrder = Object.keys(kid.days).sort().flatMap((k) => kid.days[k].lit);
  ok(litOrder[0] === '3-2-4:6', '처음 켠 층이 기초가 아님 ' + litOrder);
});

test('끝내 못 배우는 아이 — 12문제 안에 못 켜면 선생님과 함께로 남기고, 다음 층으로 · 끝없이 돌지 않음', () => {
  const m = kidModel(new Set(['4-2-1:3', '4-2-1:6']), { learnAfter: 999 });
  let kid = blankKid(), days = 0, stages = [];
  while (days < 8) { const d = playDay(kid, m, cfg, T0 + days * DAY); kid = d.kid; days++; stages.push(d.log[d.log.length - 1]); if (d.log.includes('wait')) break; }
  const tw = towerOf(cfg.unit, kid);
  ok(tw.waiting >= 1, '선생님과 함께 층이 없음 ' + JSON.stringify(tw.all.map((f) => f.st)));
  const last = T0 + (days - 1) * DAY + 3600e3;   // 그날 다시 열어도(다음 날은 점검이 먼저 나올 수 있음)
  ok(todayOf(kid, cfg, last).stage === 'wait', '멈추지 않음 ' + todayOf(kid, cfg, last).stage);
  ok(cardOf(kid, cfg, T0 + days * DAY).floors.includes('2'), '카드에 선생님 층 표시 없음');
});

test('불 점검 — 켠 층을 잊었으면 두 번 틀린 층의 불이 꺼지고 다음 날 다시 연습', () => {
  const m = kidModel(new Set(), { slip: 0 });
  const d1 = playDay(blankKid(), m, cfg, T0);
  const forget = lessonsOfUnit(cfg.unit);
  const m2 = kidModel(new Set(forget), { learnAfter: 999 });
  const d2 = playDay(d1.kid, m2, cfg, T0 + 7 * DAY, (x) => x === 'reviewed');
  ok(d2.log.includes('reviewed'), '점검 안 함 ' + d2.log);
  const tw = towerOf(cfg.unit, d2.kid);
  ok(tw.lit === tw.total - 3, `꺼진 층 ${tw.total - tw.lit} (3이어야)`);
  ok(todayOf(d2.kid, cfg, T0 + 7 * DAY).stage === 'prac', '점검 뒤 연습으로 이어지지 않음 ' + todayOf(d2.kid, cfg, T0 + 7 * DAY).stage);
  const d1b = playDay(d1.kid, m, cfg, T0 + 3600e3);
  ok(d1b.items === 0 && d1b.log[0] === 'top', '탑을 다 켠 날 또 점검 ' + d1b.log);
});

test('저장했다 다시 읽기 — 살펴보기 · 연습 중간에 끊겨도 같은 문제로 이어짐 · 10분이 차면 그날은 끝', () => {
  const m = kidModel(new Set(['3-2-4:6']));
  const kid = blankKid(); kid.seen.intro = T0;
  const S = startScan(kid, cfg.unit, 'sx', T0);
  for (let i = 0; i < 3; i++) { const q = currentItem(S); answer(S, { ...m.respond(q.c, q.p, q.item), t: T0 }); }
  const k2 = roundtrip(kid), q1 = currentItem(kid.run.S), q2 = currentItem(k2.run.S);
  ok(q1.c === q2.c && JSON.stringify(q1.p) === JSON.stringify(q2.p), '살펴보기가 다른 문제로');
  const kid3 = blankKid(); kid3.seen.intro = T0; kid3.days[new Date(T0).toISOString().slice(0, 10)] = { ms: 0, n: 0, lit: [] };
  addTime(kid3, 0, T0); kid3.days[Object.keys(kid3.days).pop()].ms = DEFAULT_MIN * 60000;
  ok(todayOf(kid3, cfg, T0).stage === 'done', '10분이 찼는데 ' + todayOf(kid3, cfg, T0).stage);
  ok(todayOf(kid3, { ...cfg, minutes: 15 }, T0).stage === 'scan', '선생님이 15분으로 늘리면 이어서');
});

test('카드 요약 — 단원 · 켠 층 · 다음 층 · 오늘 한 시간', () => {
  const m = kidModel(new Set(['3-2-4:6']));
  const d = playDay(blankKid(), m, cfg, T0);
  const c = cardOf(d.kid, cfg, T0);
  ok(c.unit === cfg.unit && c.total === towerOf(cfg.unit, d.kid).total && c.floors.length === c.total, JSON.stringify(c));
  ok(typeof c.ms === 'number' && c.day && ['prac', 'done', 'top'].includes(c.stage), '단계 ' + c.stage);
  ok(cardOf(blankKid(), {}, T0).stage === 'none', '단원 없음');
});

test('카드 요약 — 어느 단계에서도 빈 값(undefined)이 없다(RTDB 는 빈 값이 든 쓰기를 통째로 거절)', () => {
  const holes = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v === undefined ? [p + k] : v && typeof v === 'object' ? holes(v, p + k + '.') : []));
  const m = kidModel(new Set(['3-2-4:6']));
  const seen = new Set();
  let kid = blankKid();
  const check = (k, t) => { const c = cardOf(k, cfg, t); seen.add(c.stage + (k.run ? ':이어서' : '')); const h = holes(c); ok(!h.length, `${c.stage} 카드에 빈 값 ${h}`); };
  check(kid, T0);
  // 하루를 한 문항씩 돌리며 단계마다 카드 확인 · 불 점검을 '이어서' 하는 중도 포함
  for (let day = 0; day < 9; day++) {
    const now = T0 + day * DAY;
    if (day === 8) for (const f of towerOf(cfg.unit, kid).all) if (kid.rev[f.c]) kid.rev[f.c].due = now - DAY;
    let g = 0;
    while (g++ < 300) {
      const T = todayOf(kid, cfg, now); check(kid, now);
      if (T.stage === 'intro') { kid.seen.intro = now; continue; }
      if (['done', 'top', 'wait', 'none'].includes(T.stage)) break;
      if (T.stage === 'scan') { const S = kid.run ? kid.run.S : startScan(kid, cfg.unit, 's' + now, now); const q = currentItem(S); answer(S, { ...m.respond(q.c, q.p, q.item), t: now }); addTime(kid, 5000, now); if (S.done) finishScan(kid, cfg.unit, S, now); }
      else if (T.stage === 'prac') { const P = kid.run ? kid.run.P : startFloor(kid, cfg.unit, T.floor.c, 'f' + now, now); const q = currentPractice(P); const fb = answerPractice(P, { ...m.respond(q.c, q.p, q.item), t: now }); addTime(kid, 5000, now); if (!fb.ok) m.sawHelp(q.c); if (P.done) finishFloor(kid, P, now); }
      else if (T.stage === 'facts') { const F = kid.run ? kid.run.F : startFacts(kid, cfg.unit, 'x' + now, now); check(kid, now); const q = currentFact(F); answerFact(kid, F, m.respond(q.c, q.p, q.item), now); addTime(kid, 2000, now); }
      else if (T.stage === 'review') { const Rv = kid.run ? kid.run.R : startReview(kid, cfg.unit, 'r' + now, now); check(kid, now); const q = currentReview(Rv); answerReview(kid, Rv, m.respond(q.c, q.p, q.item), now); addTime(kid, 5000, now); }
      kid = roundtrip(kid);
    }
  }
  ok(seen.has('review:이어서') && seen.has('scan:이어서') && seen.has('prac:이어서') && seen.has('facts:이어서'), '확인 못 한 단계 ' + [...seen]);
});

test('지난 단원도 잊지 않게 — 단원이 바뀌어도 예전 탑의 켠 층이 점검에 섞이고(지금 탑 먼저), 꺼지면 지금 탑의 기초 층으로', () => {
  const A = { unit: '4-2-1' }, B = { unit: '4-2-3' };
  const m = kidModel(new Set(), { slip: 0 });
  let kid = playDay(blankKid(), m, A, T0).kid;                       // 4-2 분수 탑을 다 켬
  kid = playDay(kid, m, B, T0 + DAY).kid;                            // 선생님이 4-2 소수로 바꿈
  ok(towerOf(B.unit, kid).scanned, '새 단원 살펴보기');
  const late = T0 + 40 * DAY;
  const due = dueFloors(kid, B.unit, late);
  const firstOld = due.findIndex((f) => f.old);
  ok(firstOld > 0 && due.slice(0, firstOld).every((f) => !f.old) && due.slice(firstOld).every((f) => f.old === A.unit), '지금 탑 먼저 · 예전 탑 다음이 아님 ' + due.map((f) => (f.old ? 'old' : 'now')).join(','));
  // 지금 탑 점검 표를 미래로 미뤄 예전 탑만 남기고 → 예전 층 하나를 두 번 틀림
  for (const f of towerOf(B.unit, kid).all) if (kid.rev[f.c]) kid.rev[f.c].due = late + 9 * DAY;
  for (const k of Object.keys(kid.rev)) if (k.startsWith('T:')) kid.rev[k].due = late + 9 * DAY;   // 도전 층 점검도 미룬다
  const target = dueFloors(kid, B.unit, late)[0].c;
  const R = startReview(kid, B.unit, 'xr', late);
  while (!R.done) { const q = currentReview(R); answerReview(kid, R, q.c === target ? { idk: true } : { vals: q.item.sol.map(Number), raws: q.item.sol.map(String) }, late); }
  const tw = towerOf(B.unit, kid);
  ok(tw.base.some((f) => f.c === target) && tw.next && tw.next.c === target, `꺼진 예전 층이 지금 탑 기초로 안 옴 ${target} · 기초 ${tw.base.map((f) => f.c)} · 다음 ${tw.next && tw.next.c}`);
});

test('문항 기록 — 한 줄 글 · 하루 400줄까지 · 저장소는 log/<번호>/<날짜>/ 에 따로 쓰고 아이 기록 자리엔 안 섞는다 · 빈 값 0', async () => {
  const kid = blankKid();
  const line = logItem(kid, { c: '4-2-1:3', ok: false, ms: 12345, kind: 'p', bug: { name: '분모끼리도 더함' } }, T0);
  ok(line === '4-2-1:3|0|123|p|분모끼리도 더함', line);
  ok(logItem(kid, { c: '없는차시', ok: true }) === null, '없는 차시를 적음');
  for (let i = 0; i < 500; i++) logItem(kid, { c: '4-2-1:2', ok: true, ms: 1000, kind: 's' }, T0);
  ok(kid.logq.length === 400, '줄 수 ' + kid.logq.length);
});

test('저장소 쓰기 — 가짜 Firebase 로 경로와 값을 본다(문항 기록은 log/ 에 · 쓴 뒤 줄이 비워짐 · undefined 0)', () => {
  const writes = [];
  const ref = (path) => ({ path, child: (c) => ref(path + '/' + c), update: async (up) => { writes.push({ path, up }); }, set: async (v) => { writes.push({ path, up: { '': v } }); }, once: async () => ({ val: () => null }) });
  const fb = { apps: [1], initializeApp() {}, database: () => ({ ref }) };
  const st = createStore({ sid: 's7', name: '', fb });
  const kid = withPracticeLit('4-2-1:3');
  logItem(kid, { c: '4-2-1:3', ok: true, ms: 3000, kind: 'p' }, T0); logItem(kid, { c: '4-2-1:2', ok: false, ms: 9000, kind: 'r', bug: { name: 'x|y' } }, T0);
  kid.days[dayKey(T0)].oops = undefined;
  return st.save(kid, { full: true, card: { a: 1, b: undefined } }).then(() => {
    const up = writes[0].up, keys = Object.keys(up);
    ok(writes[0].path === 'classRPG_mathgap', '루트 ' + writes[0].path);
    const logs = keys.filter((k) => k.startsWith('log/s7/' + dayKey(T0) + '/'));
    ok(logs.length === 2 && logs.every((k) => /^log\/s7\/\d{4}-\d\d-\d\d\/[0-9a-z]+$/.test(k)), '기록 경로 ' + keys.filter((k) => k.startsWith('log')).join(','));
    ok(Object.values(up).includes('4-2-1:2|0|90|r|x/y'), '기록 줄 ' + logs.map((k) => up[k]));
    ok(!keys.some((k) => k.startsWith('kids/s7/log')), '아이 기록 자리에 기록이 섞임');
    const holes = (o) => (o === undefined ? 1 : o && typeof o === 'object' ? Object.values(o).reduce((a, v) => a + holes(v), 0) : 0);
    ok(holes(up) === 0, 'undefined 가 남음');
    ok(typeof up['kids/s7/st'] === 'string' && typeof up['kids/s7/rev'] === 'string', '상태 · 점검 표가 글이 아님');
    ok(kid.logq.length === 0, '쓴 뒤 줄이 안 비워짐');
  });
});

test('구구단 빠르기 — 곱셈에 기대는 단원만 · 7단을 모르면 7단 곱셈구구가 기초 층(맨 먼저 켤 층) → 연습으로 켜짐', () => {
  ok(needsFacts('4-2-1') && needsFacts('5-2-4') && !needsFacts('4-2-3') && !needsFacts('2-2-2') && !needsFacts('1-2-6'), '단원 고르기');
  const m = kidModel(new Set(['2-2-2:6']));
  const d1 = playDay(blankKid(), m, cfg, T0, (x) => x === 'facts');
  const tw = towerOf(cfg.unit, d1.kid);
  ok(d1.kid.facts && d1.kid.facts.weak.includes('2-2-2:6'), '약한 단 ' + JSON.stringify(d1.kid.facts && d1.kid.facts.weak));
  ok(tw.base.some((f) => f.c === '2-2-2:6') && tw.next.c === '2-2-2:6', '7단이 기초 · 다음 층이 아님 ' + tw.base.map((f) => f.c) + ' 다음 ' + (tw.next && tw.next.c));
  let kid = d1.kid;
  for (let day = 0; day < 4; day++) kid = playDay(kid, m, cfg, T0 + day * DAY).kid;
  ok(towerOf(cfg.unit, kid).all.find((f) => f.c === '2-2-2:6').st === 'lit', '7단 층이 안 켜짐');
});

test('구구단 빠르기 — 맞히지만 느린 단(두 문제 다 기준 시간 넘김)도 기초 층 · 한 달 안의 다음 단원은 다시 묻지 않고 결과만 반영', () => {
  // 7단만 느린 아이: 7단 문제에 6초
  const slow = kidModel(new Set(), { slip: 0, factMs: 1500 });
  const resp = slow.respond.bind(slow);
  slow.respond = (c, p, item) => { const a = resp(c, p, item); if (c === '2-2-2:6') a.ms = 6500; return a; };
  const d1 = playDay(blankKid(), slow, cfg, T0, (x) => x === 'facts');
  ok(d1.kid.facts.weak.includes('2-2-2:6') && d1.kid.states['2-2-2:6'].s === 'unstable', '느린 7단 ' + JSON.stringify(d1.kid.facts.res['2-2-2:6']));
  ok(d1.kid.facts.weak.length === 1, '다른 단까지 약하다고 봄 ' + d1.kid.facts.weak);
  // 열흘 뒤 다른 곱셈 단원(5-1 약분과 통분) — 구구단 빠르기를 다시 하지 않고, 아직 안 켜진 7단은 이 탑에도 기초로
  const B = { unit: '5-1-4' };
  const d2 = playDay(d1.kid, slow, B, T0 + 10 * DAY, (x) => x === 'scanned');
  ok(!d2.log.includes('facts') && todayOf(d2.kid, B, T0 + 10 * DAY).stage !== 'facts', '한 달 안에 또 물음');
  ok(towerOf(B.unit, d2.kid).base.some((f) => f.c === '2-2-2:6'), '새 탑에 7단 기초가 없음');
  // 마흔 날 뒤 새 단원이면 다시 묻는다
  const C = { unit: '6-1-1' };
  const d3 = playDay(d2.kid, slow, C, T0 + 40 * DAY, (x) => x === 'scanned');
  ok(todayOf(d3.kid, C, T0 + 40 * DAY).stage === 'facts', '한 달이 지났는데 안 물음');
});

test('구구단 빠르기 — 한 번 실수는 같은 단 한 문제를 더 내고 넘어간다(약한 단 아님)', () => {
  const kid = blankKid(); kid.seen.intro = T0; kid.scans[cfg.unit] = { t: T0, base: [] };
  const F = startFacts(kid, cfg.unit, 'slip', T0);
  let first = true, n = 0;
  while (currentFact(F)) { const q = currentFact(F); const wrong = first && q.item.sol[0] !== undefined; first = false; answerFact(kid, F, wrong ? { vals: [q.item.sol[0] + 1], raws: [String(q.item.sol[0] + 1)], ms: 1500 } : { vals: q.item.sol.map(Number), raws: q.item.sol.map(String), ms: 1500 }, T0); n++; }
  ok(n === 17 && kid.facts.weak.length === 0, `문항 ${n} · 약한 단 ${kid.facts.weak}`);
});

test('처음과 지금 — 기록 줄을 읽어 차시마다 처음 · 최근 정답률과 가운데 시간을 견준다 · 꺼져 있다가 켠 층을 센다', () => {
  ok(parseLog('4-2-1:3|1|123|p|') && parseLog('4-2-1:3|1|123|p|').ms === 12300 && parseLog('없음|1|1|p|') === null, '줄 읽기');
  const lines = ['4-2-1:3|0|400|s|', '4-2-1:3|2|300|s|', '4-2-1:3|1|410|p|', '4-2-1:3|1|200|p|', '4-2-1:3|1|180|p|', '4-2-1:3|1|150|p|', '4-2-1:2|1|50|s|'];
  const c = compareLogs(lines, ['4-2-1:3', '4-2-1:2']);
  ok(c['4-2-1:3'] && c['4-2-1:3'].first.acc === 33 && c['4-2-1:3'].first.med === 41 && c['4-2-1:3'].last.acc === 100 && c['4-2-1:3'].last.med === 18 && !c['4-2-1:2'], JSON.stringify(c));
  const kid = withPracticeLit('4-2-1:3');
  ok(litAfterDark(kid, cfg.unit) >= 1, '꺼져 있다가 켠 층 ' + litAfterDark(kid, cfg.unit));
});

test('불씨 규칙 — 5개 · 틀리면 하나 꺼짐', () => ok(RULE.streak === 5, 'RULE.streak ' + RULE.streak));

// 연습으로 켠 층 하나를 가진 아이를 만든다(살펴보기 뒤 c 층만 연습으로 켬)
function withPracticeLit(c) {
  const m = kidModel(new Set([c]), { slip: 0, learnAfter: 1 });
  let kid = playDay(blankKid(), m, cfg, T0, (x) => x === 'scanned').kid;
  const P = startFloor(kid, cfg.unit, c, 'p1', T0);
  let g = 0; while (!P.done && g++ < 40) { const q = currentPractice(P); answerPractice(P, { vals: q.item.sol.map(Number), raws: q.item.sol.map(String), ms: 2000, t: T0 }); }
  const r = finishFloor(kid, P, T0); ok(r.lit, '연습으로 안 켜짐');
  return kid;
}

test('간격 복습 — 연습으로 켠 층은 다음 날 · 한 번에 맞히면 3일 · 다시 해서 맞히면 같은 간격 · 두 번 틀리면 꺼짐', () => {
  const c = '4-2-1:3';
  let kid = withPracticeLit(c);
  ok(kid.rev[c].i === 0 && kid.rev[c].due === new Date(2026, 9, 13).getTime(), '다음 날로 안 잡힘 ' + JSON.stringify(kid.rev[c]));
  ok(!dueFloors(kid, cfg.unit, T0).some((f) => f.c === c), '오늘 바로 점검');
  ok(dueFloors(kid, cfg.unit, T0 + DAY).some((f) => f.c === c), '다음 날 점검에 없음');
  // 한 번에 맞힘 → 3일
  const k1 = roundtrip(kid), R1 = startReview(k1, cfg.unit, 'r1', T0 + DAY);
  while (!R1.done) { const q = currentReview(R1); answerReview(k1, R1, { vals: q.item.sol.map(Number), raws: q.item.sol.map(String) }, T0 + DAY); }
  ok(k1.rev[c].i === 1 && k1.rev[c].due === new Date(2026, 9, 13 + REVIEW_DAYS[1]).getTime(), '한 번에 맞혔는데 ' + JSON.stringify(k1.rev[c]));
  // 틀렸다 맞힘 → 같은 간격
  const k2 = roundtrip(kid), R2 = startReview(k2, cfg.unit, 'r2', T0 + DAY);
  let first = true;
  while (!R2.done) { const q = currentReview(R2); const right = !(first && q.c === c); if (q.c === c) first = false; answerReview(k2, R2, right ? { vals: q.item.sol.map(Number), raws: q.item.sol.map(String) } : { idk: true }, T0 + DAY); }
  ok(k2.rev[c] && k2.rev[c].i === 0, '틀렸다 맞혔는데 단계가 바뀜 ' + JSON.stringify(k2.rev[c]));
  // 두 번 틀림 → 꺼짐 · 점검 표에서 빠짐
  const k3 = roundtrip(kid), R3 = startReview(k3, cfg.unit, 'r3', T0 + DAY);
  while (!R3.done) { const q = currentReview(R3); answerReview(k3, R3, q.c === c ? { idk: true } : { vals: q.item.sol.map(Number), raws: q.item.sol.map(String) }, T0 + DAY); }
  ok(towerOf(cfg.unit, k3).all.find((f) => f.c === c).st === 'dark' && !k3.rev[c], '두 번 틀렸는데 안 꺼짐');
});

test('포함 복습 — 위층을 켜면 그 아래 켜진 층은 복습한 셈(점검 날이 뒤로)', () => {
  const up = '4-2-1:3', low = '4-2-1:2';   // 대분수의 덧셈은 진분수의 덧셈을 꺼내 쓴다
  ok([...corePre(up)].includes(low) || preOf(up, null).includes(low), '줄 가정이 틀림');
  const m = kidModel(new Set([up]), { slip: 0, learnAfter: 1 });
  let kid = playDay(blankKid(), m, cfg, T0, (x) => x === 'scanned').kid;
  ok(kid.rev[low], '아래층 점검 표가 없음');
  kid.rev[low].due = new Date(2026, 9, 13).getTime();     // 내일이 점검 날이었다고 치고
  const P = startFloor(kid, cfg.unit, up, 'p2', T0 + DAY);
  let g = 0; while (!P.done && g++ < 40) { const q = currentPractice(P); answerPractice(P, { vals: q.item.sol.map(Number), raws: q.item.sol.map(String), ms: 2000 }); }
  finishFloor(kid, P, T0 + DAY);
  ok(kid.rev[low].due > new Date(2026, 9, 13).getTime(), '위층을 켰는데 아래층 점검 날 그대로 ' + new Date(kid.rev[low].due).toISOString());
});

test('몸풀기 — 아직 켤 층이 있는 날은 점검 2문제까지, 탑 완성 뒤엔 3문제까지', () => {
  const m = kidModel(new Set(['4-2-1:7']), { slip: 0, learnAfter: 999 });
  const kid = playDay(blankKid(), m, cfg, T0, (x) => x === 'facts').kid;
  for (const f of towerOf(cfg.unit, kid).all) if (f.st === 'lit') kid.rev[f.c] = { i: 1, due: T0 - DAY };
  const T = todayOf(kid, cfg, T0 + DAY);
  ok(T.stage === 'review' && T.warm && T.n === 2, '몸풀기 ' + JSON.stringify({ s: T.stage, w: T.warm, n: T.n }));
  const R = startReview(kid, cfg.unit, 'w', T0 + DAY);
  ok(R.total === 2, '점검 문제 수 ' + R.total);
});

test('틀린 모양 모으기 — 차시별로 세고 많이 나온 40가지만', () => {
  const kid = blankKid();
  for (let i = 0; i < 3; i++) noteBug(kid, '4-2-1:3', { name: '분수 부분이 1보다 큰데 그대로 둠' });
  noteBug(kid, '4-2-1:3', { name: '분모끼리도 더함' }); noteBug(kid, '없는차시', { name: 'x' }); noteBug(kid, '4-2-1:3', null);
  const b = bugsOf(kid);
  ok(b.length === 2 && b[0].n === 3 && b[0].c === '4-2-1:3', JSON.stringify(b));
  for (let i = 0; i < 60; i++) noteBug(kid, '4-2-1:2', { name: '오답' + i });
  ok(Object.keys(kid.bugs).length <= 40 && kid.bugs['4-2-1:3|분수 부분이 1보다 큰데 그대로 둠'] === 3, '40가지 넘음 또는 많이 나온 것이 지워짐');
});

test('예제 — 모든 차시가 예제를 만들고, 단계는 4개까지 · 답이 정답', () => {
  const bad = [];
  for (const c of Object.keys(byId)) {
    try { const ex = exampleOf(c, 7); if (ex.steps.length > 4) bad.push(c + ' 단계'); const it = ex.item; const r = it.choices ? it.check([it.sol[0]]) : it.check(it.sol.map(Number), it.sol.map(String)); if (!r.ok) bad.push(c + ' 답'); }
    catch (e) { bad.push(c + ' ' + e.message); }
  }
  ok(!bad.length, bad.slice(0, 5).join(' | '));
});

test('저장소 거르기 — 점검 표 · 틀린 모양이 JSON 글로 왕복하고, 이상한 값은 버린다', () => {
  const kid = withPracticeLit('4-2-1:3'); noteBug(kid, '4-2-1:3', { name: '분모끼리도 더함' });
  const raw = { st: JSON.stringify(kid.states), scans: JSON.stringify(kid.scans), marks: '{}', rev: JSON.stringify({ ...kid.rev, bad: { i: 'x', due: 'no' } }), bugs: JSON.stringify({ ...kid.bugs, 'x|y': -3 }), run: null, days: kid.days, seen: kid.seen };
  const k = kidFrom(raw);
  ok(k.rev['4-2-1:3'] && k.rev['4-2-1:3'].i === 0 && !k.rev.bad, '점검 표 ' + JSON.stringify(k.rev));
  ok(k.bugs['4-2-1:3|분모끼리도 더함'] === 1 && !k.bugs['x|y'], '틀린 모양 ' + JSON.stringify(k.bugs));
  ok(kidFrom({ rev: '{망가짐', bugs: 5 }).rev && Object.keys(kidFrom({ rev: '{망가짐' }).rev).length === 0, '망가진 글');
});

// ── 도전 층(문제 유형) ──
// 탑(차시 층)을 다 켠 아이 — 살펴보기에서 모두 맞힘
function towerDone(unit, now = T0) {
  const m = kidModel(new Set(), { slip: 0 });
  let kid = playDay(blankKid(), m, { unit }, now, (x) => x === 'scanned').kid;
  if (todayOf(kid, { unit }, now).stage === 'facts') kid = playDay(kid, m, { unit }, now, (x) => x === 'facts').kid;
  return kid;
}
const diagOf = (kid, t) => (kid.types[t] || {}).diag || {};

test('도전 층 — 아래층을 다 켜기 전엔 잠김 · 다 켜면 열림 · 불씨 3개로 켜짐 · 다음 날 점검 · 카드에 도전 층', () => {
  const m = kidModel(new Set(['4-2-1:7']), { slip: 0, learnAfter: 999 });
  const k0 = playDay(blankKid(), m, cfg, T0, (x) => x === 'facts').kid;
  const tw0 = towerOf(cfg.unit, k0);
  ok(tw0.tops.length === typesOfUnit(cfg.unit).length && tw0.tops.every((f) => f.st === 'lock') && !tw0.topNext, '아래층이 남았는데 잠기지 않음 ' + tw0.tops.map((f) => f.st));
  const kid = towerDone(cfg.unit);
  const T1 = todayOf(kid, cfg, T0);
  ok(T1.stage === 'type' && T1.top && T1.top.t === typesOfUnit(cfg.unit)[0], '탑을 다 켰는데 도전 층이 아님 ' + T1.stage);
  const card = cardOf(kid, cfg, T0);
  ok(card.stage === 'type' && card.nextName === T1.top.name && card.tops === '0'.repeat(typesOfUnit(cfg.unit).length), '카드 ' + JSON.stringify(card));
  const Y = startType(kid, cfg.unit, T1.top.t, 'yy', T0);
  for (let i = 0; i < TRULE.streak; i++) { const q = currentType(Y); ok(q.flames === i, '불씨 ' + q.flames); answerType(kid, Y, solve(q.item), T0); }
  ok(Y.done, '3개 맞혔는데 안 끝남');
  const r = finishType(kid, Y, T0);
  ok(r.lit && typeLit(kid, T1.top.t, cfg.unit) && kid.rev['T:' + T1.top.t].i === 0, '켜지지 않음 ' + JSON.stringify(kid.types));
  ok(towerOf(cfg.unit, kid).tops[0].st === 'lit', '탑에 안 보임');
  ok(dueFloors(kid, cfg.unit, T0 + DAY).some((f) => f.c === 'T:' + T1.top.t), '다음 날 점검에 없음');
});

test('도전 층 — 틀리면 불씨 하나 꺼짐 · 분수 단원에서 식을 못 고르면 다음은 쉬운 숫자 · 풀면 숫자 영역(dom) · 못 풀면 문제 모양(tpl)', () => {
  ok(!plainUnit('INV', '4-2-1') && plainUnit('INV', '3-1-1'), '쉬운 숫자 판 가정');
  for (const [model, want] of [['dom', 'dom'], ['none', 'tpl']]) {
    const kid = towerDone(cfg.unit), m = kidModel(new Set(), { types: model });
    const Y = startType(kid, cfg.unit, 'INV', 'yd' + model, T0);
    answerType(kid, Y, solve(currentType(Y).item), T0);            // 불씨 1
    const q = currentType(Y), fb = answerType(kid, Y, wrong(q.item), T0);
    ok(!fb.ok && fb.help && fb.flames === 0 && fb.before === 1, '틀렸는데 ' + JSON.stringify(fb));
    const h1 = typeHelpDone(kid, Y, q.inst.steps.map((st) => ({ kind: st.kind, key: !!st.key, ok: m.stepOk(st, q), c: st.c || null })), T0);
    ok(h1.diag === 'easy', '식 고르기를 틀렸는데 쉬운 숫자로 안 감 ' + h1.diag);
    const e = currentType(Y);
    ok(e.easy && e.inst.st === 'W', '다음 문제가 쉬운 숫자가 아님');
    ok(e.inst.p.good === q.inst.p.good && e.inst.p.bad === q.inst.p.bad, `쉬운 숫자 판의 연산 짝이 다름 ${e.inst.p.good}${e.inst.p.bad} ≠ ${q.inst.p.good}${q.inst.p.bad}`);
    const fe = answerType(kid, Y, m.typeOk(e) ? solve(e.item) : wrong(e.item), T0);
    ok(fe.easy && fe.diag === want && diagOf(kid, 'INV')[want] === 1, `${model} 아이 까닭 ${fe.diag}`);
    ok(fe.flames === 0 && !currentType(Y).easy, '쉬운 숫자 문제가 불씨를 바꿈 / 다음도 쉬운 숫자');
  }
});

test('도전 층 — 자연수 단원은 식을 못 고르면 바로 문제 모양 · 계산에서 막히면 그 차시 틀린 모양 · 다 풀면 단계', () => {
  const u = { unit: '3-1-1' };
  for (const [model, want] of [['none', 'tpl'], ['calc', 'calc'], ['know', 'plan']]) {
    const kid = towerDone(u.unit), m = kidModel(new Set(), { types: model });
    const Y = startType(kid, u.unit, 'INV', 'yw' + model, T0);
    const q = currentType(Y); answerType(kid, Y, wrong(q.item), T0);
    const steps = q.inst.steps.map((st) => ({ kind: st.kind, key: !!st.key, ok: m.stepOk(st, q), c: st.c || null, bug: st.kind === 'calc' ? { name: '받아내린 자리에서 1을 빼지 않음' } : null }));
    const r = typeHelpDone(kid, Y, steps, T0);
    ok(r.diag === want && diagOf(kid, 'INV')[want] === 1, `${model} → ${r.diag}`);
    if (want === 'calc') ok(r.calc && byId[r.calc] && bugsOf(kid).some((b) => b.c === r.calc), '계산 차시 틀린 모양이 안 모임 ' + JSON.stringify(kid.bugs));
    ok(!currentType(Y).easy, '자연수 단원인데 쉬운 숫자로 감');
  }
});

test('도전 층 — 8문제 안에 못 켜면 선생님과(표시) · 하루가 멈춤 · 표시 지우면 다시 연습', () => {
  const kid = towerDone(cfg.unit), t = typesOfUnit(cfg.unit)[0];
  const Y = startType(kid, cfg.unit, t, 'yt', T0);
  let g = 0; while (!Y.done && g++ < 30) { const q = currentType(Y); const fb = answerType(kid, Y, wrong(q.item), T0); if (fb.help) typeHelpDone(kid, Y, q.inst.steps.map((st) => ({ kind: st.kind, key: !!st.key, ok: true, c: st.c || null })), T0); }
  ok(Y.done && Y.out.filter((x) => !x.easy).length === TRULE.max, '8문제에서 안 멈춤 ' + Y.out.length);
  const r = finishType(kid, Y, T0);
  ok(r.teacher && kid.marks[`T:${t}@${cfg.unit}`] === 'teacher' && towerOf(cfg.unit, kid).tops[0].st === 'teacher', '선생님과 표시 없음');
  ok(todayOf(kid, cfg, T0).top.t !== t, '선생님과 층을 또 냄');
  delete kid.marks[`T:${t}@${cfg.unit}`];
  ok(todayOf(kid, cfg, T0).top.t === t, '표시를 지웠는데 다시 안 열림');
});

test('도전 층 점검 — 다른 단원에서 켠 유형이 지금 단원 숫자로 · 하루 하나 · 두 번 틀리면 꺼지고 지금 단원 도전 층에서 다시', () => {
  const A = '3-1-1', B = '4-2-1';                     // 어떤 수 구하기: 세 자리 수 → 분모가 같은 분수
  const kid = towerDone(A);
  for (const t of typesOfUnit(A)) { const Y = startType(kid, A, t, 'ya' + t, T0); while (!Y.done) answerType(kid, Y, solve(currentType(Y).item), T0); finishType(kid, Y, T0); }
  ok(typesOfUnit(A).every((t) => typeLit(kid, t, A)), 'A 단원 유형이 다 안 켜짐');
  const later = T0 + 3 * DAY;
  const due = dueFloors(kid, B, later).filter((f) => f.type);
  const inv = due.find((f) => f.t === 'INV'), card = due.find((f) => f.t === 'CARD');
  ok(inv && inv.u === B && !inv.old, '어떤 수 점검이 지금 단원 숫자가 아님 ' + JSON.stringify(inv));
  ok(card && card.u === A && card.old === A, 'B 에 없는 유형(수 카드)은 켠 단원 숫자로 ' + JSON.stringify(card));
  const kidB = roundtrip(kid); kidB.seen.intro = T0;
  const R = startReview(kidB, B, 'rb', later);
  ok(R.todo.filter((c) => c.startsWith('T:')).length === 1, '하루 점검에 유형이 하나가 아님 ' + R.todo);
  const c = R.todo.find((x) => x.startsWith('T:'));
  let saw = null;
  while (!R.done) { const q = currentReview(R); if (q.c === c) { saw = q; answerReview(kidB, R, { idk: true }, later); } else answerReview(kidB, R, solve(q.item), later); }
  ok(saw && saw.type && saw.inst.unit === (c === 'T:INV' ? B : A), '점검 문제 단원 ' + (saw && saw.inst.unit));
  ok(!typeLit(kidB, c.slice(2)) && !kidB.rev[c], '두 번 틀렸는데 안 꺼짐');
  if (c === 'T:INV') { kidB.scans[B] = kidB.scans[B] || { t: later, base: [] }; const tw = towerOf(B, kidB); ok(tw.tops.find((f) => f.t === 'INV').st !== 'lit', 'B 도전 층이 켜진 채'); }
});

test('도전 층 저장 — 하던 것이 JSON 왕복 뒤 같은 문제 · 저장소가 이상한 값을 거름 · 카드에 빈 값 없음', () => {
  const holes = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v === undefined ? [p + k] : v && typeof v === 'object' ? holes(v, p + k + '.') : []));
  const kid = towerDone(cfg.unit), t = typesOfUnit(cfg.unit)[0];
  const Y = startType(kid, cfg.unit, t, 'ys', T0);
  answerType(kid, Y, solve(currentType(Y).item), T0);
  const k2 = roundtrip(kid), a = currentType(kid.run.Y), b = currentType(k2.run.Y);
  ok(JSON.stringify(a.inst.story) === JSON.stringify(b.inst.story) && a.flames === b.flames && a.flames === 1, '이어서 할 때 다른 문제');
  const T2 = todayOf(k2, cfg, T0);
  ok(T2.stage === 'type' && T2.resume && T2.top && T2.top.t === t, '이어서 하기 ' + T2.stage);
  const c = cardOf(k2, cfg, T0);
  ok(!holes(c).length && c.stage === 'type' && c.nextName, '카드 빈 값 ' + holes(c) + JSON.stringify(c));
  kid.types.INV.diag = { tpl: 2, dom: -1, calc: 'x' };
  const raw = { st: JSON.stringify(kid.states), scans: JSON.stringify(kid.scans), marks: '{}', rev: '{}', bugs: '{}', types: JSON.stringify({ ...kid.types, ZZZ: { lit: { '4-2-1': 1 } }, OVL: { lit: { '../x': 5, '4-2-1': -2, '3-1-1': T0 }, diag: {}, n: 'a' } }), run: null, days: {}, seen: {} };
  const k = kidFrom(raw);
  ok(k.types.INV && k.types.INV.diag.tpl === 2 && !('dom' in k.types.INV.diag) && !('calc' in k.types.INV.diag), '까닭 거르기 ' + JSON.stringify(k.types.INV));
  ok(!k.types.ZZZ && Object.keys(k.types.OVL.lit).join() === '3-1-1' && k.types.OVL.n === 0, '유형 거르기 ' + JSON.stringify(k.types));
  ok(Object.keys(kidFrom({}).types).length === 0, '빈 기록');
});

test('모든 도전 층 단원 — 탑을 다 켠 아이가 도전 층을 끝까지(오류 없음) · 모르는 아이는 선생님과로 멈춤', () => {
  let n = 0;
  for (const u of [...new Set(Object.keys(byId).map((c) => byId[c].u))]) {
    if (!typesOfUnit(u).length) continue;
    for (const model of ['know', 'none']) {
      const kid = towerDone(u), m = kidModel(new Set(), { types: model });
      for (const t of typesOfUnit(u)) {
        const Y = startType(kid, u, t, 'ya' + u + t + model, T0);
        let g = 0;
        while (!Y.done && g++ < 40) {
          const q = currentType(Y), fb = answerType(kid, Y, m.typeOk(q) ? solve(q.item) : wrong(q.item), T0);
          if (fb.help) typeHelpDone(kid, Y, q.inst.steps.map((st) => ({ kind: st.kind, key: !!st.key, ok: m.stepOk(st, q), c: st.c || null })), T0);
        }
        const r = finishType(kid, Y, T0);
        ok(model === 'know' ? r.lit : r.teacher, `${u} ${t} ${model} → ${JSON.stringify(r)}`);
      }
      n++;
    }
  }
  ok(n >= 30, '단원 수 ' + n);
});

// 단원마다 한 번씩 — 어느 단원이든 살펴보기 → 연습 → 완성이 돈다(기초 빈칸 하나씩)
test('모든 단원 — 살펴보기와 연습이 오류 없이 돈다', () => {
  const units = [...new Set(Object.keys(byId).map((c) => byId[c].u))];
  let n = 0;
  for (const u of units) {
    if (lessonsOfUnit(u).length < 2) continue;
    const ids = lessonsOfUnit(u), g = ids[Math.floor(ids.length / 2)];
    const m = kidModel(new Set([g]));
    let kid = blankKid();
    for (let day = 0; day < 3; day++) kid = playDay(kid, m, { unit: u }, T0 + day * DAY).kid;
    ok(towerOf(u, kid).scanned, u + ' 살펴보기 안 끝남');
    n++;
  }
  ok(n >= 35, '단원 수 ' + n);
});

await Promise.all(pending);
const fails = results.filter((r) => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`오늘의 수학 하루 흐름 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
