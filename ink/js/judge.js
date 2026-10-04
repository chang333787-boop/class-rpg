// 채점 — 먹색 맞추기(밝기 L* 차이) · 농담 꼬리 잇기(차례 규칙) · 붓 놀이(붓 자국 셈). DOM 없음 · 시험 = scripts/unit/ink/stages.test.mjs
import { lightOf, PASS_DL, closeness, starsOf, MAX_DROPS } from './inkcolor.js';

const total = d => (d.ink || 0) + (d.water || 0);
// 다음 한두 방울 — 먹 · 물을 한 방울 더/빼기를 한두 번 해 보고 가장 가까워지는 것(셈으로 고르니 틀린 말이 없다)
export function nextStep(d, T) {
  const now = lightOf(d.ink, d.water), base = now == null ? 999 : Math.abs(now - T);
  const moves = [['ink', 1], ['ink', -1], ['water', 1], ['water', -1]], NAME = { ink: '먹', water: '물' };
  const tryOf = list => { const x = { ...d }; for (const [k, s] of list) { x[k] = (x[k] || 0) + s; if (x[k] < 0 || x[k] > MAX_DROPS) return null; } const L = lightOf(x.ink, x.water); return L == null || !x.ink ? null : Math.abs(L - T); };
  let best = null;
  for (const a of moves) { const e = tryOf([a]); if (e != null && (!best || e < best.e)) best = { l: [a], e }; }
  for (const a of moves) for (const b of moves) { if (a[0] === b[0] && a[1] !== b[1]) continue; const e = tryOf([a, b]); if (e != null && e < (best ? best.e : base) - 1.5) best = { l: [a, b], e }; }
  if (!best || best.e > base - 0.5) return '';
  const [a, b] = best.l, w = ([k, s]) => `${NAME[k]}을 한 방울 ${s > 0 ? '더' : '빼고'}`;
  if (!b) return `${NAME[a[0]]}을 한 방울 ${a[1] > 0 ? '더 넣어' : '빼'} 볼까요?`;
  if (a[0] === b[0]) return `${NAME[a[0]]}을 두 방울 ${a[1] > 0 ? '더 넣어' : '빼'} 볼까요?`;
  return `${w(a)}, ${NAME[b[0]]}을 한 방울 ${b[1] > 0 ? '더 넣어' : '빼'} 볼까요?`;
}

export function judgeMix(target, d, { min = 0, misses = 0 } = {}) {
  const L = lightOf(d.ink, d.water);
  if (L == null) return { ok: false, empty: true, say: '접시가 비었어요 — 먹 · 물 통을 눌러 한 방울씩 넣어요' };
  const T = lightOf(target.ink, target.water), dl = Math.abs(L - T), base = { dl, close: closeness(dl), stars: starsOf(dl), L, T };
  if (!d.ink) return { ...base, ok: false, kind: 'paper', say: '먹이 없어요 — 물만 칠하면 종이색이에요' };
  if (dl <= 6 && total(d) < min) return { ...base, ok: false, kind: 'amount', say: `먹색은 맞아요! 그런데 ${total(d)}방울뿐 — 같은 먹색을 ${min}방울 이상으로` };
  if (dl <= PASS_DL) return { ...base, ok: true };
  const step = misses >= 1 ? nextStep(d, T) : '';
  //  kind = 무엇이 달랐나(선생님 헷갈림 지도) — dark: 내 먹이 너무 진함(물 모자람) · pale: 너무 옅음(먹 모자람)
  return { ...base, ok: false, kind: T > L ? 'dark' : 'pale', say: (T > L ? '목표가 더 옅어요' : '목표가 더 진해요') + (step ? '. ' + step : '') };
}

// 농담 꼬리 잇기 — 칸 0 = 진한 먹(주어짐). 다음 칸은 앞 칸보다 GAP 넘게 옅게 · 먹이 들어가야 · 마지막 칸은 아주 옅게(L* 70 넘게)
export const CHAIN_GAP = 8, CHAIN_LAST = 70;
export function judgeCell(cells, i, d) {
  const L = lightOf(d.ink, d.water);
  if (L == null) return { ok: false, empty: true, say: '접시가 비었어요 — 먹 · 물을 넣어요' };
  if (!d.ink) return { ok: false, kind: 'paper', say: '먹이 없으면 종이색이에요 — 먹을 한 방울은 넣어요' };
  const prev = cells[i - 1];
  if (prev) {
    const P = lightOf(prev.ink, prev.water);
    if (L <= P) return { ok: false, kind: 'order', say: `${L < P - 1 ? '앞 칸보다 진해요' : '앞 칸과 똑같아요'} — 물을 더 섞어 옅게` };
    if (L - P < CHAIN_GAP) return { ok: false, kind: 'order', say: '앞 칸과 거의 같아요 — 물을 두 배로 늘려 봐요' };
  }
  if (i === cells.length - 1 && L < CHAIN_LAST) return { ok: false, kind: 'dark', say: '마지막 칸은 아주 옅게 — 물을 더 많이(먹이 두 방울이면 한 방울 빼고)' };
  return { ok: true, L };
}
export function chainStars(cells) {
  const L = cells.map(c => lightOf(c.ink, c.water)), g = Math.min(...L.slice(1).map((x, k) => x - L[k]));
  return g >= 13 ? 3 : g >= 10 ? 2 : 1;
}

// 붓 놀이 — 붓 자국 셈(brush.js 가 붓질마다 넘기는 값: dot · len · avgW · maxW · dry · wet · tone)
//  점 크기(지름 px): 큰 점 = 붓을 0.35초 넘게 누름 · 작은 점 = 살짝 콕(0.15초 안). 선 굵기: 굵은 선 = 평균 13 넘게(천천히) · 가는 선 = 7 아래(빠르게)
export const BIG = 20, SMALL = 12, THICK = 13, THIN = 7;
export const TASKS = {
  dots: { parts: [['큰 점 둘', s => s.filter(x => x.dot && x.maxW >= BIG).length >= 2], ['작은 점 둘', s => s.filter(x => x.dot && x.maxW <= SMALL).length >= 2]] },
  lines: { parts: [['굵은 선(천천히)', s => s.some(x => !x.dot && x.len >= 120 && x.avgW >= THICK)], ['가는 선(빠르게)', s => s.some(x => !x.dot && x.len >= 120 && x.avgW <= THIN)]] },
  dry: { parts: [['갈라진 마른 붓 자국', s => s.some(x => !x.dot && x.len >= 150 && x.dry >= 0.25)]] },
  wet: { parts: [['번지는 점(물 많이)', s => s.some(x => x.dot && x.wet)], ['또렷한 점(물 적게)', s => s.some(x => x.dot && !x.wet)]] },
  free: { parts: [['세 번 이상 긋기', s => s.filter(x => !x.dot).length >= 3], ['먹색 두 가지 이상', s => new Set(s.map(x => x.tone)).size >= 2]] },
};
export function judgeBrush(task, strokes) {
  const parts = TASKS[task].parts.map(([label, f]) => ({ label, ok: !!f(strokes) }));
  return { parts, done: parts.every(p => p.ok) };
}

// 붓 자국 읽어 주기 — 아이가 방금 그은 자국이 무엇인지(내 것 읽기)
export function readStroke(x) {
  if (x.dot) return `${x.wet ? '번진 ' : ''}${x.maxW >= BIG ? '큰' : x.maxW <= SMALL ? '작은' : '중간'} 점 (지름 ${Math.round(x.maxW)})`;
  const w = x.avgW >= THICK ? '굵은' : x.avgW <= THIN ? '가는' : '중간 굵기';
  return `${w} 선 (굵기 ${Math.round(x.avgW)} · 길이 ${x.len})` + (x.dry >= 0.25 ? ` · 갈라진 마른 붓 ${Math.round(x.dry * 100)}%` : '') + (x.wet ? ' · 번짐' : '') + (x.len < 120 ? ' — 더 길게 그어 봐요' : '');
}
