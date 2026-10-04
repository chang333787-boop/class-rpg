// 채점 — 새기기(판 칸 셈: 파야 할 곳을 얼마나 · 남겨야 할 곳을 얼마나 팠나 · 거울 실수) · 찍기(잉크 · 문지르기 고르기). DOM 없음
import { count, and, invert } from './block.js';

const cov = (m, carved) => (m ? count(and(m, carved)) / Math.max(1, count(m)) : 0);
// 판마다 말(무엇을 파는지)
const WORDS = {
  '1-4': { less: '밑그림 테두리를 따라 더 파요', mirror: '찍으면 물고기가 왼쪽을 봐요 — 판에서는 반대 방향 물고기를 파야 해요', both: '두 마리를 다 팠어요 — 한 마리만 파야 한 마리가 찍혀요' },
  '2-3': { less: '별 안을 더 파요 — 판 곳이 하얗게 찍혀요', over: '별 밖까지 팠어요 — 별 밖은 남겨야 검게 찍혀요' },
  '2-4': { less: '공 둘레를 더 파요 — 남은 곳은 모두 검게 찍혀요', over: '공 안까지 팠어요 — 공은 남겨야 검게 찍혀요' },
};
export function judgeCarve(id, spec, carved) {
  const w = WORDS[id] || {}, must = cov(spec.must, carved), over = cov(spec.keep, carved), other = cov(spec.other, carved);
  const base = { must, over, other };
  if (count(carved) < 20) return { ...base, ok: false, kind: 'less', say: '아직 거의 안 팠어요 — 밑그림을 보고 파요' };
  if (spec.other) {
    if (other > spec.otherMax && must < spec.need) return { ...base, ok: false, kind: 'mirror', say: w.mirror };
    if (other > spec.otherMax) return { ...base, ok: false, kind: 'mirror', say: w.both };
  }
  if (spec.keep && over > spec.overMax) return { ...base, ok: false, kind: 'over', say: w.over };
  if (must < spec.need) return { ...base, ok: false, kind: 'less', say: w.less };
  const waste = Math.max(over, other);
  return { ...base, ok: true, stars: waste <= 0.04 && must >= 0.85 ? 3 : waste <= 0.08 ? 2 : 1 };
}

// 찍기 — 남은 면(잉크가 묻을 곳) 가운데 잉크가 넉넉히 묻은 몫 · 문지른 몫
export const GOOD = 0.6;
export function pressCoverage(mask, ink, rub) {
  let surf = 0, inked = 0, rubbed = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) continue;
    surf++;
    if (ink[i] >= GOOD) inked++;
    if (ink[i] >= GOOD && rub[i] >= GOOD) rubbed++;
  }
  return { ink: inked / Math.max(1, surf), rub: rubbed / Math.max(1, inked) };
}
export function judgePress(c) {
  if (c.ink < 0.85) return { ok: false, kind: 'ink', say: `잉크가 덜 묻은 곳이 하얗게 비었어요(잉크 ${Math.round(c.ink * 100)}%) — 롤러를 더 굴려요` };
  if (c.rub < 0.85) return { ok: false, kind: 'rub', say: `덜 문지른 곳이 흐리게 찍혔어요(문지르기 ${Math.round(c.rub * 100)}%) — 바렌으로 구석구석` };
  return { ok: true, stars: c.ink >= 0.95 && c.rub >= 0.95 ? 3 : c.ink >= 0.9 && c.rub >= 0.9 ? 2 : 1 };
}
export const surfaceOf = mask => invert(mask);
