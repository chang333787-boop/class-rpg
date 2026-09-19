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

const fail = results.filter(r => r[0] === 'FAIL');
results.forEach(r => { if (r[0] === 'FAIL') console.log('❌ FAIL  ', r[1], '—', r[2]); });
console.log('\n요약: PASS ' + (results.length - fail.length) + ' · FAIL ' + fail.length);
process.exit(fail.length ? 1 : 0);
