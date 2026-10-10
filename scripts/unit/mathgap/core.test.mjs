// 오늘의 수학 핵심(js/core — 수학 빈칸 찾기에서 옮김) 빠른 시험 — 차시마다 문제를 뽑아 정답은 정답으로 · 틀린 답은 틀림으로 채점되는지 · 도전 층 유형이 만들어지는지,
//  같은 숫자로 쪼갠 단계가 있는 차시로 이어지는지, 단원 점검 세션이 JSON 으로 저장했다 이어 가도 같은지
//  node scripts/unit/mathgap/core.test.mjs   (DOM 없음 · 네트워크 없음 · 전체 시험은 수학 빈칸 찾기 저장소의 npm test)
import { NODES, byId, makeItem, stepsOf, lessonsOfUnit, UNITS } from '../../../mathgap/js/core/lessons/index.js';
import { newUnitScan, currentItem, answer } from '../../../mathgap/js/core/engine.js';
import { rng } from '../../../mathgap/js/core/math.js';
import { makeType, typesOfUnit, UNIT_TYPES } from '../../../mathgap/js/core/types/index.js';

const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

test('차시 229개 — 문제마다 정답은 맞음 · 엉뚱한 답은 틀림 · 단계는 있는 차시로', () => {
  ok(NODES.length === 229, '차시 수 ' + NODES.length);
  const bad = [];
  for (const L of NODES) {
    const r = rng(L.id.length * 7919 + 13);
    for (let i = 0; i < 12; i++) {
      let p, it; try { p = L.gen(r); it = makeItem(L.id, p); } catch (e) { bad.push(`${L.id} 만들기 ${e.message}`); break; }
      const right = it.choices ? it.check([it.sol[0]]) : it.check(it.sol.map(Number), it.sol.map(String));
      if (!right.ok) { bad.push(`${L.id} 정답이 틀림 ${it.ans}`); break; }
      const wrong = it.choices ? it.check([(it.sol[0] + 1) % it.choices.length]) : it.check(it.sol.map((x) => Number(x) + 977), it.sol.map((x) => String(Number(x) + 977)));
      if (wrong.ok) { bad.push(`${L.id} 엉뚱한 답이 맞음 ${it.ans}`); break; }
      for (const s of stepsOf(L.id, p)) if (!byId[s.c]) { bad.push(`${L.id} 단계 ${s.c}`); break; }
    }
  }
  ok(!bad.length, bad.slice(0, 5).join(' | '));
});

test('단원 점검 — 문항마다 JSON 으로 저장했다 이어 가도 같은 문제 · 같은 결과(모든 단원)', () => {
  let diff = 0, n = 0;
  for (const u of UNITS.map((x) => x.id).filter((x) => lessonsOfUnit(x).length >= 3)) {
    const ids = lessonsOfUnit(u), badC = new Set([ids[1]]);
    const A = newUnitScan({ id: 'c' + u, sid: 'k', unit: u });
    let B = JSON.parse(JSON.stringify(A)), g = 0;
    while (!A.done && g++ < 60) {
      const q = currentItem(A), q2 = currentItem(B);
      if (!q2 || q.c !== q2.c || JSON.stringify(q.p) !== JSON.stringify(q2.p)) { diff++; break; }
      const a = badC.has(q.c) ? { idk: true } : { vals: q.item.sol.map(Number), raws: q.item.sol.map(String), ms: 3000 };
      answer(A, a); answer(B, a); B = JSON.parse(JSON.stringify(B));
    }
    n++;
  }
  ok(!diff && n >= 30, `달라진 단원 ${diff}/${n}`);
});

test('도전 층 유형 — 단원마다 문제를 만들고 정답은 정답 · 단계마다 정답은 정답 · 같은 seed 는 같은 문제(전체 시험은 수학 빈칸 찾기 tests/types.test.mjs)', () => {
  const bad = [];
  const right = (it) => (it.choices ? it.check([it.sol[0]]) : it.check(it.sol.map(Number), it.sol.map(String))).ok;
  for (const u of Object.keys(UNIT_TYPES)) for (const t of typesOfUnit(u)) for (let s = 1; s <= 25; s++) {
    let a; try { a = makeType(t, u, s * 7919); } catch (e) { bad.push(`${u} ${t} 만들기 ${e.message}`); break; }
    if (!right(a.item)) bad.push(`${u} ${t} 정답이 틀림 ${a.ans}`);
    a.steps.forEach((st, i) => { if (!right(st.item)) bad.push(`${u} ${t} 단계 ${i + 1}`); });
    if (JSON.stringify(makeType(t, u, s * 7919).story) !== JSON.stringify(a.story)) bad.push(`${u} ${t} seed 가 같은데 다른 문제`);
  }
  ok(!bad.length, bad.slice(0, 5).join(' | '));
});

const fails = results.filter((r) => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`오늘의 수학 핵심 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
