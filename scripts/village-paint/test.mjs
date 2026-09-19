// 끌어 놓기·끌어 치우기의 '사이 칸 잇기' + 길 가족 방향 저절로 잡기 시험 — 브라우저 없이, village/index.html 에서 순수 함수만 꺼내 돌린다 (네트워크 0)
//   node scripts/village-paint/test.mjs
// 빠른 획 = 포인터가 몇 칸씩 건너뛰며 보고되는 것. 어떤 건너뜀에서도 ① 길은 변으로 이어져야 하고(4방향) ② 치우기는 빈틈이 없어야 한다(8방향).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.VILLAGE || join(here, '../../village/index.html'), 'utf8');
function grab(name) {                                   // "function 이름(…) { … }" 한 덩어리를 중괄호 짝으로 잘라 낸다
  const at = html.indexOf('function ' + name + '('); assert.ok(at >= 0, name + ' 를 index.html 에서 못 찾음');
  let i = html.indexOf('{', at), depth = 0; for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return new Function('return (' + html.slice(at, i + 1) + ')')();
}
const paintLine4 = grab('paintLine4'), sweepLine = grab('sweepLine');

const results = [];
function test(name, fn) { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, String(e.message).split('\n')[0]]); } }

/* 한 획을 흉내 낸다: 진짜 손가락 길(path)에서 every 칸마다 한 번만 보고된다고 치고, 보고된 칸 사이를 line 으로 잇는다 */
function stroke(path, every, line) { const seen = [path[0]]; let last = path[0];
  for (let i = every; i < path.length + every; i += every) { const c = path[Math.min(i, path.length - 1)]; if (c.x === last.x && c.y === last.y) continue; line(last.x, last.y, c.x, c.y).forEach(q => seen.push(q)); last = c; }
  return seen; }
const straight = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), out = []; for (let i = 0; i <= n; i++) out.push({ x: Math.round(x0 + (x1 - x0) * i / n), y: Math.round(y0 + (y1 - y0) * i / n) }); return out; };
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y), cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const SHAPES = { '가로': straight(10, 10, 40, 10), '세로': straight(10, 10, 10, 40), '대각선': straight(10, 10, 40, 40), '비스듬히(3:1)': straight(10, 10, 40, 20), '거꾸로 비스듬히': straight(40, 25, 10, 10),
  'ㄱ자': straight(10, 10, 30, 10).concat(straight(30, 10, 30, 30).slice(1)) };

for (const [shape, path] of Object.entries(SHAPES)) for (const every of [1, 2, 3, 5, 9]) {
  test('길 ' + shape + ' · ' + every + '칸씩 건너뜀 — 변으로 이어진다', () => { const cells = stroke(path, every, paintLine4);
    for (let i = 1; i < cells.length; i++) assert.equal(manhattan(cells[i - 1], cells[i]), 1, i + '번째 걸음이 변으로 안 닿음 ' + JSON.stringify([cells[i - 1], cells[i]]));
    assert.deepEqual(cells[cells.length - 1], path[path.length - 1], '끝 칸에 닿지 않음'); });
  test('치우기 ' + shape + ' · ' + every + '칸씩 건너뜀 — 빈틈이 없다', () => { const cells = stroke(path, every, sweepLine);
    for (let i = 1; i < cells.length; i++) assert.ok(cheb(cells[i - 1], cells[i]) === 1, i + '번째 걸음에 빈틈 ' + JSON.stringify([cells[i - 1], cells[i]])); });
}
test('같은 칸 → 아무것도 안 돌려준다', () => { assert.deepEqual(paintLine4(5, 5, 5, 5), []); assert.deepEqual(sweepLine(5, 5, 5, 5), []); });
test('이웃 칸(변) → 그 칸 하나', () => assert.deepEqual(paintLine4(5, 5, 6, 5), [{ x: 6, y: 5 }]));
test('이웃 칸(대각선) → 모서리 한 칸을 끼운다', () => assert.deepEqual(paintLine4(5, 5, 6, 6), [{ x: 6, y: 5 }, { x: 6, y: 6 }]));
test('첫 칸은 들어 있지 않다(이미 놓인 칸을 두 번 보지 않게)', () => assert.ok(!paintLine4(3, 3, 9, 7).some(q => q.x === 3 && q.y === 3)));
test('칸 수 — 직선 30칸은 30개(과하게 놓지 않는다)', () => assert.equal(paintLine4(10, 10, 40, 10).length, 30));

/* ── 여러 칸짜리 길 가족의 방향 저절로 잡기(MAC-ROADROT) — roadRotPlan(w, h, cur, L, R, U, D) ── */
const roadRotPlan = grab('roadRotPlan');
const long = (w, h, rot) => (rot & 1) ? { w: h, h: w } : { w, h };      // dims() 와 같은 셈
for (const [nm, w, h] of [['횡단보도 1×2', 1, 2], ['가로수 열 1×3', 1, 3], ['나무다리 2×1', 2, 1], ['돌다리 3×1', 3, 1]]) for (const cur of [0, 1, 2, 3]) {
  test(nm + ' · 들고 있던 방향 ' + cur + ' — 길이 왼쪽에만: 긴 쪽이 가로, 제자리', () => { const p = roadRotPlan(w, h, cur, true, false, false, false), d = long(w, h, p.rot); assert.ok(d.w > d.h, '가로로 안 누움'); assert.deepEqual([p.dx, p.dy], [0, 0]); });
  test(nm + ' · ' + cur + ' — 길이 오른쪽에만: 가로 + 길에서 멀어지는 쪽으로 옮겨 놓는다', () => { const p = roadRotPlan(w, h, cur, false, true, false, false), d = long(w, h, p.rot); assert.ok(d.w > d.h); assert.deepEqual([p.dx, p.dy], [-(Math.max(w, h) - 1), 0]); });
  test(nm + ' · ' + cur + ' — 길이 위에만: 긴 쪽이 세로, 제자리', () => { const p = roadRotPlan(w, h, cur, false, false, true, false), d = long(w, h, p.rot); assert.ok(d.h > d.w); assert.deepEqual([p.dx, p.dy], [0, 0]); });
  test(nm + ' · ' + cur + ' — 길이 아래에만: 세로 + 위로 옮겨 놓는다', () => { const p = roadRotPlan(w, h, cur, false, false, false, true), d = long(w, h, p.rot); assert.ok(d.h > d.w); assert.deepEqual([p.dx, p.dy], [0, -(Math.max(w, h) - 1)]); });
  test(nm + ' · ' + cur + ' — 모퉁이(왼쪽+위)·이웃 없음: 지금 방향 그대로', () => { assert.deepEqual(roadRotPlan(w, h, cur, true, false, true, false), { rot: cur, dx: 0, dy: 0 }); assert.deepEqual(roadRotPlan(w, h, cur, false, false, false, false), { rot: cur, dx: 0, dy: 0 }); });
  test(nm + ' · ' + cur + ' — 이미 맞는 방향이면 안 바꾼다(2 를 0 으로 되돌리지 않는다)', () => { const p = roadRotPlan(w, h, cur, true, true, false, false), want = w < h ? 1 : 0; if ((cur & 1) === want) assert.equal(p.rot, cur); });
}
const roadRotSpan = grab('roadRotSpan');
test('횡단보도 · 가로로 난 큰길 끝(아래 차선을 누름) — 세로로 서서 큰길의 위 칸부터 두 칸을 덮는다', () => assert.deepEqual(roadRotSpan(true, 1, 147, 139, 145, 138), { rot: 0, dx: 0, dy: -1 }));
test('횡단보도 · 세로로 난 큰길 끝 — 가로로 누워 큰길의 왼쪽 칸부터', () => assert.deepEqual(roadRotSpan(false, 0, 151, 140, 150, 138), { rot: 1, dx: -1, dy: 0 }));
test('횡단보도 · 이미 맞는 방향(2)이면 안 바꾼다', () => assert.equal(roadRotSpan(true, 2, 147, 138, 145, 138).rot, 2));
test('정사각(큰길 2×2)은 건드리지 않는다', () => assert.deepEqual(roadRotPlan(2, 2, 3, true, false, false, false), { rot: 3, dx: 0, dy: 0 }));

/* ── 도서관은 동네마다(MAC-LIBRARY) — 집의 말에 붙는 배움 귀띔 libHint(miss, libs, cap, open) ── */
const libHint = grab('libHint');
test('배움이 안 빠졌으면 귀띔 없음', () => { assert.equal(libHint(['물', '놀이'], 1, 5, true), ''); assert.equal(libHint([], 0, 5, true), ''); assert.equal(libHint(null, 0, 5, true), ''); });
test('도서관이 아직 안 열렸으면 언제 열리는지', () => assert.match(libHint(['배움'], 0, 5, false), /인구 50명/));
test('도서관이 없으면 "지어 봐요" · 있으면 "하나 더"', () => { assert.match(libHint(['배움'], 0, 5, true), /가까이에 도서관을 지어/); assert.match(libHint(['놀이', '배움'], 2, 5, true), /하나 더/); });
test('한도까지 놓았으면 옮기기를 권한다(더 지으라고 하지 않는다)', () => { const t = libHint(['배움'], 5, 5, true); assert.match(t, /옮겨/); assert.doesNotMatch(t, /하나 더/); });

/* ── 터치로 놓기(MAC-SEAT) — 앉혀서 놓는 종류인가 seatKindIs({ w, h, road, join, flower, roadFam, door }) ── */
const seatKindIs = grab('seatKindIs');
test('집(2×2 · 문) · 가게 · 광장(3×3 · 문 없음) · 우물(2×2)은 앉힌다', () => { for (const i of [{ w: 2, h: 2, door: true }, { w: 3, h: 3 }, { w: 2, h: 2 }, { w: 3, h: 2, door: true }]) assert.equal(seatKindIs(i), true); });
test('문이 있으면 작아도 앉힌다', () => assert.equal(seatKindIs({ w: 1, h: 1, door: true }), true));
test('길·큰길(2×2 길)·횡단보도·다리(길 가족)·울타리(이음)·꽃밭은 전처럼 즉시', () => { for (const i of [{ w: 1, h: 1, road: true }, { w: 2, h: 2, road: true }, { w: 1, h: 2, road: true, roadFam: true }, { w: 3, h: 1, roadFam: true }, { w: 1, h: 1, join: true }, { w: 1, h: 1, flower: true }]) assert.equal(seatKindIs(i), false); });
test('1×1 꾸밈 · 긴의자(2×1)는 즉시', () => { assert.equal(seatKindIs({ w: 1, h: 1 }), false); assert.equal(seatKindIs({ w: 2, h: 1 }), false); assert.equal(seatKindIs(null), false); });

/* ── 이웃을 기다리는 집(MAC-WAITHOMES-2) — waitSay · waitDots · waitClusters ── */
const waitSay = grab('waitSay'), waitDots = grab('waitDots'), waitClusters = grab('waitClusters');
test('넷 다 멀면 "두 가지 더" · 셋이 멀면 "하나만 더"', () => { assert.match(waitSay(['물', '장보기', '놀이', '쉼'], 2), /^두 가지 더/); assert.match(waitSay(['물', '놀이', '쉼'], 2), /^하나만 더/); });
test('말은 짧고, 빠진 것만 그림으로', () => { const t = waitSay(['물', '놀이', '쉼'], 2); assert.ok(t.length <= 40, t.length + '자'); assert.ok(t.includes('🪣🛝🪑')); assert.ok(!t.includes('🛒')); assert.doesNotMatch(t, /멀어서|돌아가요/); });
test('점: ○○ → ●○ (우물 하나로 차오른다)', () => { assert.equal(waitDots(4, 2), '○○'); assert.equal(waitDots(3, 2), '●○'); assert.equal(waitDots(2, 2), '●●'); });
test('동네 묶기: 가까운 집끼리 · 큰 동네부터', () => { const w = 256, r = (x, y) => y * w + x; const g = waitClusters([r(10, 10), r(12, 10), r(14, 11), r(80, 80), r(82, 80), r(200, 5)], w, 8); assert.deepEqual(g.map(q => q.length), [3, 2, 1]); });
test('동네 묶기: 사슬처럼 이어진 거리는 한 동네', () => { const w = 256, r = (x, y) => y * w + x; const g = waitClusters([0, 1, 2, 3, 4].map(i => r(10 + i * 6, 40)), w, 8); assert.equal(g.length, 1); });
/* ── 밤새 자라는 것(MAC-GROW) — growStage(e, 시뮬날, 실제날) · growClean(저장본, 살아있는칸, 종류) ── */
const growStage = grab('growStageOf'), growClean = grab('growClean');
test('기록이 없으면 다 자란 것(2) — 옛 저장본·다른 기기', () => assert.equal(growStage(undefined, 9, 99999), 2));
test('심은 날 = 새싹(0) · 마을 아침이 지나면 어린나무(1) · 실제 다음 날까지 지나면 다 자람(2)', () => { const e = [3, 20000]; assert.equal(growStage(e, 3, 20000), 0); assert.equal(growStage(e, 4, 20000), 1); assert.equal(growStage(e, 4, 20001), 2); });
test('실제 다음 날 열었는데 마을 아침은 아직 — 어린나무(1)부터', () => assert.equal(growStage([3, 20000], 3, 20001), 1));
test('불러올 때 걸러 낸다: 칸 번호·정수 둘만 · 살아 있는 자라는 종류만', () => { const kinds = new Set(['tree', 'flower']), alive = i => ({ 10: 'tree', 11: 'road', 12: 'flower' })[i] || null;
  const m = growClean({ 10: [1, 2], 11: [1, 2], 12: [1.5, 2], 13: [1, 2], abc: [1, 2], 14: 'x' }, alive, kinds); assert.deepEqual([...m.keys()], [10]); assert.deepEqual(m.get(10), [1, 2]); });
test('grow 가 없거나 배열·문자열이면 빈 것', () => { for (const v of [undefined, null, [], 'x', 3]) assert.equal(growClean(v, () => 'tree', new Set(['tree'])).size, 0); });

/* ── 비 오는 날의 절반쯤은 오후에 갠다(MAC-RAINCLEAR) — rainClearAt(날, 13, 16) ── */
const rainClearAt = grab('rainClearAt');
test('그치는 때는 13~16시 정시 또는 null(하루 내내)', () => { for (let d = 1; d <= 400; d++) { const h = rainClearAt(d, 13, 16); assert.ok(h === null || (Number.isInteger(h) && h >= 13 && h <= 16), d + '일 ' + h); } });
test('비 오는 날의 40~60% 가 오후에 갠다 · 네 시간대가 다 쓰인다', () => { const rainDay = d => ((d * 2654435761) >>> 0) % 3 === 0; let n = 0, c = 0; const hs = new Set(); for (let d = 1; d <= 600; d++) if (rainDay(d)) { n++; const h = rainClearAt(d, 13, 16); if (h != null) { c++; hs.add(h); } } assert.ok(c / n > 0.4 && c / n < 0.6, (c / n).toFixed(2)); assert.equal(hs.size, 4); });
test('같은 날은 늘 같은 때(다시 열어도)', () => { for (const d of [7, 22, 31, 100]) assert.equal(rainClearAt(d, 13, 16), rainClearAt(d, 13, 16)); });

const fail = results.filter(r => r[0] === 'FAIL');
results.forEach(r => { if (r[0] === 'FAIL') console.log('❌ FAIL  ', r[1], '—', r[2]); });
console.log('\n요약: PASS ' + (results.length - fail.length) + ' · FAIL ' + fail.length);
process.exit(fail.length ? 1 : 0);
