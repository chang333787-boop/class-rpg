// 시험 도구 — 벽시계를 일부러 빨리 돌린다(부를 때마다 WALL_STEP ms · 기본 500). test.mjs 의 '벽시계를 흔들어도 같은 값'이 쓴다([MAC-SIMCLOCK]).
//   NODE_OPTIONS=--import=scripts/village-sim/wallclock.mjs node scripts/village-sim/run.mjs …
// 시뮬 하네스(load.mjs)가 싣는 순간부터 벽시계를 멈추므로, 이것을 걸어도 판정 값은 같아야 한다 — 다르면 벽시계가 판정에 스민 것이다.
const STEP = +(process.env.WALL_STEP || '500'); let t = 1000; const d0 = Date.now();
Object.defineProperty(performance, 'now', { value: () => (t += STEP), configurable: true, writable: true });
Date.now = () => Math.floor(d0 + (t += STEP));
