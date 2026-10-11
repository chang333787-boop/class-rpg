// 문제 유형(틀) — 단원마다 '도전 층'으로 내는 문제집 유형(어떤 수 · □ 범위 · 수 카드 · 이어 붙이기 · 간격 · 합과 차 · 남은 양)
//   makeType(틀, 단원, seed, { easy }) → 문제 하나(같은 seed 면 같은 문제 — 저장은 seed 만)
//     { t, unit, st, easy, name, story 문제 글 조각, item 답 칸(prompt · check · sol · ans), x 정답 값, ans 정답 글, steps 같이 풀기 단계 }
//   easy = 같은 틀을 작은 자연수로(분수 · 소수 단원에서 틀렸을 때 — 틀을 모르는지, 숫자가 바뀌어 흔들리는지 가르기)
import { TYPES, UNIT_TYPES } from './list.js';
import { rng } from './kit.js';
import { byId } from '../lessons/index.js';

export { TYPES, UNIT_TYPES };
export const typesOfUnit = (u) => (UNIT_TYPES[u] || []).filter((t) => TYPES[t] && TYPES[t].units[u]);
export const isType = (id) => typeof id === 'string' && /^T:[A-Z]+$/.test(id) && !!TYPES[id.slice(2)];
export const typeKey = (t) => `T:${t}`;
// 이 단원 숫자가 이미 작은 자연수인가(그러면 '쉬운 숫자로 한 번 더'가 필요 없음)
export const plainUnit = (t, u) => !!(TYPES[t] && TYPES[t].units[u] && TYPES[t].units[u].st === 'W');
// 교육과정 규칙(10-11 교사 '새 숫자가 무한한 것도 위험 — 교육 내용에 맞게 점검'): 도전 층 문제의 계산 단계는
//   ① 그 단원보다 뒤 단원의 차시가 나오면 안 되고 ② 그 단원에서 배우는 계산이 한 번은 나와야 한다(EXEMPT 는 단원 계산이 식 전체라 단계로 안 잡히는 틀).
//   맞지 않으면 같은 seed 에서 이어지는 숫자로 다시 뽑는다(같은 seed = 같은 문제는 그대로) · 시험 = tests/types.test.mjs
const ord = (u) => { const [a, b, c] = String(u).split('-').map(Number); return (a * 10 + b) * 10 + c; };
const EXEMPT = new Set(['5-1-1 RANGE']);
export function curriculumOk(inst, unit) {
  const cs = inst.steps.filter((s) => s.kind === 'calc' && s.c && byId[s.c]).map((s) => byId[s.c].u);
  if (cs.some((u) => ord(u) > ord(unit))) return false;
  return EXEMPT.has(`${unit} ${inst.t}`) || cs.includes(unit);
}
export function makeType(t, unit, seed = 1, { easy = false } = {}) {
  const T = TYPES[t];
  if (!T || !T.units[unit]) throw new Error(`유형 없음: ${t} · ${unit}`);
  let spec = T.units[unit];
  if (easy) spec = T.easy(T.make(spec, rng(seed)));
  let inst;
  for (let k = 0; k < 40; k++) {
    inst = T.make(spec, rng(((easy ? seed ^ 0x5bd1e995 : seed) + k * 7919) >>> 0));
    if (easy || curriculumOk({ ...inst, t }, unit)) break;
  }
  return { t, unit, seed, easy, st: spec.st, name: T.name, ...inst, ans: inst.item.ans };
}
