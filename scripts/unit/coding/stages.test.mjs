// 기초 코딩 판 시험 — 정답이 정말 풀리나 · 블록 수 · 몬스터가 아는 명령만 썼나 · 고치기 판의 처음 코드는 정말 틀렸나 · 붓 그림이 판 안에 들어가나
//  node scripts/unit/coding/stages.test.mjs   (DOM 없음 · 네트워크 없음)
import { STAGES, HERO_BLOCKS } from '../../../coding/js/stages.js';
import { parse, countBlocks, runToEnd, runAst, T2TYPE, usesCall } from '../../../coding/js/interp.js';
import { makeMaze, makePen, compareDrawing } from '../../../coding/js/world.js';

const results = [];
const test = (name, fn) => { try { const r = fn(); results.push([r === false ? 'FAIL' : 'PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const typesOf = ast => ast.flatMap(n => [T2TYPE[n.t], ...(n.body ? typesOf(n.body) : []), ...(n.else ? typesOf(n.else) : [])]);
const condsOf = ast => ast.flatMap(n => [...(n.c ? [n.c] : []), ...(n.body ? condsOf(n.body) : []), ...(n.else ? condsOf(n.else) : [])]);
const mapsOf = s => s.maps || [{ map: s.map, dir: s.dir }];
const solveAll = (s, src) => mapsOf(s).map(m => { const w = makeMaze({ ...s, map: m.map, dir: m.dir }), r = runToEnd(parse(src), w); return r.ok && w.result().ok ? 'ok' : (r.ok ? w.result().why : r.why); });
// 첫 길에서 정답이 실제로 한 걸음들(앞으로 · 돌기 …)만 그대로 받아 적은 코드 — 이것이 다른 길에서도 풀리면 '만약'이 필요 없는 판이다
const traceOn = (s, m) => { const w = makeMaze({ ...s, map: m.map, dir: m.dir }), out = []; try { for (const ev of runAst(parse(s.sol), w)) if (ev.kind && !['loop', 'check'].includes(ev.kind)) out.push({ t: ev.t }); } catch (e) {} return out; };
const penSegs = (s, src) => { const w = makePen({ start: s.start }); const r = runToEnd(parse(src), w); return { r, segs: w.st.segs }; };

for (const s of STAGES) {
  test(`${s.id} ${s.title} — 정답이 풀린다`, () => {
    const ast = parse(s.sol);
    if (s.world === 'maze') {
      const res = solveAll(s, s.sol);
      ok(res.every(x => x === 'ok'), `정답이 길마다: ${res.join(', ')}`);
      void ast;
    } else {
      const { r, segs } = penSegs(s, s.sol);
      ok(r.ok && segs.length, '정답 그림 없음');
      const xs = segs.flatMap(g => [g.x1, g.x2]), ys = segs.flatMap(g => [g.y1, g.y2]);
      ok(Math.min(...xs) >= 10 && Math.max(...xs) <= 390 && Math.min(...ys) >= 10 && Math.max(...ys) <= 390, `그림이 판 밖: x ${Math.min(...xs).toFixed(0)}~${Math.max(...xs).toFixed(0)} y ${Math.min(...ys).toFixed(0)}~${Math.max(...ys).toFixed(0)}`);
      ok(compareDrawing(segs, segs).ok, '자기 자신과 다름');
    }
  });
  test(`${s.id} 몬스터가 아는 명령만 · 블록 수`, () => {
    const allowed = new Set(s.blocks), used = typesOf(parse(s.sol));
    for (const t of used) if (s.unit < 7 || /^m_/.test(t)) ok(allowed.has(t), `${t} 는 이 판 블록이 아님`);   // 7단원부터는 종류 칸 서랍 — 움직임만 몬스터 것인지 본다
    ok(s.best === countBlocks(parse(s.sol)), 'best 셈');
    if (s.limit) ok(s.best <= s.limit, `정답 ${s.best} > 한도 ${s.limit}`);
    if (s.unit === 1) ok(!used.includes('c_repeat'), '1단원 정답에 반복');
    for (const c of condsOf(parse(s.sol))) ok((s.conds || []).includes(c), `살피기 ${c} 는 이 몬스터 것이 아님`);
  });
  if (s.require) test(`${s.id} 꼭 써야 하는 것(${s.require})을 정답이 쓴다`, () => {
    const ast = parse(s.sol), all = [...ast, ...ast.filter(n => n.t === 'def').flatMap(d => d.body)];
    const has = (l, f) => l.some(n => f(n) || (n.body && has(n.body, f)) || (n.else && has(n.else, f)));
    if (s.require === 'var') ok(has(all, n => n.t === 'set') && has(all, n => n.e && JSON.stringify(n.e).includes('"k":"var"')), '주머니 넣기·꺼내 쓰기 없음');
    if (s.require === 'call') ok(usesCall(ast.filter(n => n.t !== 'def')), '기술 쓰기 없음');
  });
  if (s.prefill) test(`${s.id} 처음 놓아 둔 기술 껍데기만으로는 안 풀린다`, () => {
    if (s.world === 'maze') ok(solveAll(s, s.prefill).some(x => x !== 'ok'), '껍데기로 풀림');
    else ok(!compareDrawing(penSegs(s, s.sol).segs, penSegs(s, s.prefill).segs).ok, '껍데기로 같은 그림');
  });
  if (s.maps && s.maps.length > 1) test(`${s.id} 길 둘 — 첫 길만 받아 적은 코드는 둘째 길에서 실패`, () => {
    const flat = traceOn(s, s.maps[0]);
    ok(flat.length, '받아 적기 없음');
    const w = makeMaze({ ...s, map: s.maps[1].map, dir: s.maps[1].dir }), r = runToEnd(flat, w);
    ok(!(r.ok && w.result().ok), '첫 길 차례만으로 둘째 길도 풀림(만약이 필요 없음)');
  });
  if (s.buggy) test(`${s.id} 고치기 판 — 처음 코드는 틀렸다`, () => {
    if (s.world === 'maze') {
      ok(solveAll(s, s.buggy).some(x => x !== 'ok'), '처음 코드가 이미 모든 길에서 풀림');
    } else {
      const target = penSegs(s, s.sol).segs, drawn = penSegs(s, s.buggy).segs;
      ok(!compareDrawing(target, drawn).ok, '처음 그림이 이미 같음');
    }
  });
}
// 그림 견주기 — 같은 변을 둘로 나눠 그려도 같다 · 왼쪽으로 돌면(뒤집힌 네모) 다르다
test('붓: 나눠 그려도 같은 그림', () => {
  const s = STAGES.find(x => x.id === '2-8');
  const a = penSegs(s, '4(f100 r90)').segs, b = penSegs(s, '4(f50 f50 r90)').segs, c = penSegs(s, '4(f100 l90)').segs;
  ok(compareDrawing(a, b).ok, '나눠 그린 네모가 다르다고 함');
  ok(!compareDrawing(a, c).ok, '뒤집힌 네모가 같다고 함');
});
test('끝없는 반복은 멈춘다', () => { const w = makeMaze(STAGES[0]); const r = runToEnd(parse('999(L)'), w, { max: 500 }); ok(!r.ok && r.why === 'loop', String(r.why)); });
test('단원별 판 수', () => { const n = [1, 2, 3, 4, 5, 6, 7, 8].map(u => STAGES.filter(s => s.unit === u).length); ok(n.join(',') === '10,10,6,8,7,6,6,6', n.join(',')); });
test('기술 · 받는 값 · 주머니 — 실행기', () => {
  const s = STAGES.find(x => x.id === '8-3'), w = makePen({ start: s.start }), r = runToEnd(parse(s.sol), w);
  ok(r.ok && w.st.segs.length === 3 + 4 + 5 + 6, '다각형 선 수 ' + w.st.segs.length);
  const v = makePen({ start: { x: 200, y: 200, h: 0 } }); runToEnd(parse('set(a,5) add(a,3) f[a*2]'), v); ok(Math.abs(v.st.y - (200 - 16)) < 1e-6, '주머니 셈 ' + v.st.y);
  const z = makePen({ start: { x: 200, y: 200, h: 0 } }); ok(!runToEnd(parse('C:없는기술()'), z).ok, '없는 기술이 돌았다');
  const rec = makePen({ start: { x: 200, y: 200, h: 0 } }); const rr = runToEnd(parse('D:또:(C:또()) C:또()'), rec, { max: 5000 }); ok(!rr.ok && rr.why === 'loop', '끝없는 기술 부르기 ' + rr.why);
});
test('끝없이 도는 고치기 판은 걸음 한도에서 멈춘다(6-6)', () => { const s = STAGES.find(x => x.id === '6-6'); const w = makeMaze({ ...s, map: s.maps[0].map, dir: s.maps[0].dir }); const r = runToEnd(parse(s.buggy), w, { max: 600 }); ok(!r.ok && r.why === 'loop', String(r.why)); });

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`\n요약: PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
