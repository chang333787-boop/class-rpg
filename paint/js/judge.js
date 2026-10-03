// 채점 — 판 종류마다 한 곳에서(DOM 없음 · 시험 = scripts/unit/paint/stages.test.mjs)
//  섞기 = 목표와 ΔE · 사이 색(색 바퀴) = 숨은 목표 + 이웃 두 칸 · 진하기 띠 = 차례 규칙(밝은 쪽 → 어두운 쪽 · 파랑빛 유지)
import { mix, dE, closeness, starsOf, PASS_DE, diffOf, lchOf, dropsOf, WHEEL, KEYS, TUBE_NAME } from './color.js';

// 받침이 있으면 '을' — 빨강을 · 노랑을 · 파랑을 · 흰색을 · 검정을
const eul = w => { const c = String(w).charCodeAt(String(w).length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '을' : '를'); };

// 다음 한두 방울 — 그 판에 있는 물감만, 한 방울 더 · 빼기를 한 번이나 두 번 해 보고 목표에 가장 가까워지는 것(셈으로 고르니 틀린 말이 없다)
//  두 번까지 보는 까닭: 빨강 1 → 다홍(빨강 2 · 노랑 1)은 '빨강 더'만으로는 색이 그대로라(비율이 같음) 한 번으로는 못 찾는다
export function nextStep(drops, targetRgb, tubes) {
  const now = mix(drops), base = now ? dE(now, targetRgb) : 999;
  const moves = [];
  for (const k of KEYS) if (tubes.includes(k)) for (const s of [1, -1]) moves.push([k, s]);
  const tryOf = list => {
    const d = { ...drops };
    for (const [k, s] of list) { d[k] = (d[k] || 0) + s; if (d[k] < 0 || d[k] > 9) return null; }
    const m = mix(d); return m ? dE(m, targetRgb) : null;
  };
  let one = null, two = null;
  for (const a of moves) { const e = tryOf([a]); if (e != null && (!one || e < one.e)) one = { list: [a], e }; }
  for (let i = 0; i < moves.length; i++) for (let j = i; j < moves.length; j++) {
    const a = moves[i], b = moves[j];
    if (a[0] === b[0] && a[1] !== b[1]) continue;          // 넣었다 빼기 = 그대로
    const e = tryOf([a, b]); if (e != null && (!two || e < two.e)) two = { list: [a, b], e };
  }
  //  한 번으로 충분히 가까워지면 한 번(아이에게 짧은 말) · 두 번이 훨씬 나으면 두 번
  const pick = one && one.e < base - 0.5 && (!two || base - one.e >= (base - two.e) * 0.7) ? one : two && two.e < base - 0.5 ? two : null;
  if (!pick) return '';
  const [a, b] = pick.list;
  if (!b) return `${eul(TUBE_NAME[a[0]])} 한 방울 ${a[1] > 0 ? '더 넣어' : '빼'} 볼까요?`;
  if (a[0] === b[0]) return `${eul(TUBE_NAME[a[0]])} 두 방울 ${a[1] > 0 ? '더 넣어' : '빼'} 볼까요?`;
  if (a[1] === b[1]) return `${TUBE_NAME[a[0]]} 한 방울, ${TUBE_NAME[b[0]]} 한 방울을 ${a[1] > 0 ? '더 넣어' : '빼'} 볼까요?`;
  const [p, m] = a[1] > 0 ? [a, b] : [b, a];
  return `${eul(TUBE_NAME[p[0]])} 한 방울 더 넣고, ${eul(TUBE_NAME[m[0]])} 한 방울 빼 볼까요?`;
}

// 섞기(목표가 보이는 판) — min = 물감을 이만큼 이상(같은 색을 넉넉히 = 비율)
export function judgeMix(target, drops, { min = 0, tubes = 'RYBWK', misses = 0 } = {}) {
  const mine = mix(drops);
  if (!mine) return { ok: false, empty: true, say: '팔레트가 비었어요 — 물감 통을 눌러 물감을 넣어요' };
  const T = mix(target), d = dE(mine, T), n = dropsOf(drops), base = { d, close: closeness(d), stars: starsOf(d), rgb: mine };
  if (d <= PASS_DE && n < min) return { ...base, ok: false, kind: 'amount', say: `색은 맞아요! 그런데 물감이 ${n}방울뿐 — 같은 색을 ${min}방울 이상으로 만들어요` };
  if (d <= PASS_DE) return { ...base, ok: true };
  const df = diffOf(mine, T), step = misses >= 1 ? nextStep(drops, T, tubes) : '';
  return { ...base, ok: false, kind: df.kind, say: df.say + (step ? '. ' + step : '') };
}

// 사이 색(색 바퀴 빈 칸) — 목표는 숨기고 이웃 두 칸으로 말한다
export const neighborsOf = i => [(i + 11) % 12, (i + 1) % 12];
export function judgeBetween(i, drops, { tubes = 'RYB', misses = 0 } = {}) {
  const mine = mix(drops);
  if (!mine) return { ok: false, empty: true, say: '팔레트가 비었어요 — 물감 통을 눌러 물감을 넣어요' };
  const T = mix(WHEEL[i][1]), d = dE(mine, T), base = { d, close: closeness(d), stars: starsOf(d), rgb: mine };
  if (d <= PASS_DE) return { ...base, ok: true };
  const [a, b] = neighborsOf(i).map(j => ({ j, name: WHEEL[j][0], d: dE(mine, mix(WHEEL[j][1])) }));
  const step = misses >= 1 ? nextStep(drops, T, tubes) : '';
  const near = [a, b].filter(x => x.d < d).sort((x, z) => x.d - z.d)[0];
  if (near) {
    const other = near === a ? b : a;
    return { ...base, ok: false, kind: 'hue', say: `‘${near.name}’ 쪽에 더 가까워요 — ‘${other.name}’ 쪽으로 조금 더` + (step ? '. ' + step : '') };
  }
  const df = diffOf(mine, T);
  return { ...base, ok: false, kind: df.kind, say: df.say.replace('목표', '사이 색') + (step ? '. ' + step : '') };
}

// 진하기 띠 — 0 = 가장 밝음 … 4 = 가장 어두움 · 가운데(base)는 물감 그대로. 칸 하나를 칠할 때마다 이미 칠한 칸과 차례가 맞나
export const RUNG_GAP = 5;            // 이웃 칸과 밝기(L)가 이만큼은 달라야 '다른 칸'
export function judgeRung(slots, i, rgb, baseRgb) {
  if (!rgb) return { ok: false, empty: true, say: '팔레트가 비었어요 — 물감 통을 눌러 물감을 넣어요' };
  const c = lchOf(rgb), b = lchOf(baseRgb);
  if (c.C < 6) return { ok: false, kind: 'hue', say: c.L > 70 ? '파랑빛이 사라졌어요 — 흰색만 남았어요. 파랑을 조금 넣어요' : '파랑빛이 사라졌어요 — 회색 · 검정이 됐어요. 파랑을 더 넣어요' };
  let dh = Math.abs(c.h - b.h); dh = Math.min(dh, 360 - dh);
  if (dh > 35) return { ok: false, kind: 'hue', say: '파랑이 아닌 다른 색깔이 됐어요 — 파랑에 흰색이나 검정만 섞어요' };
  for (let j = 0; j < slots.length; j++) {
    if (j === i || !slots[j]) continue;
    const L = lchOf(slots[j]).L;
    const side = j < i ? '왼쪽' : '오른쪽', want = j < i ? '더 진하게(어둡게)' : '더 연하게(밝게)';
    const gap = j < i ? L - c.L : c.L - L;
    if (gap <= 0) return { ok: false, kind: 'order', say: `${side} ${j + 1}번 칸보다 ${j < i ? '밝아요' : '어두워요'} — 왼쪽은 연하게, 오른쪽으로 갈수록 진하게` };
    if (gap < RUNG_GAP) return { ok: false, kind: 'order', say: `${side} ${j + 1}번 칸과 거의 같아요 — 조금 ${want}` };
  }
  return { ok: true };
}
// 다 칠한 띠의 별 — 이웃 칸끼리 가장 덜 다른 곳이 얼마나 다른가(칸마다 또렷하게 다를수록 ★)
export function ladderStars(slots) {
  const L = slots.map(s => lchOf(s).L), gaps = L.slice(1).map((x, k) => L[k] - x), g = Math.min(...gaps);
  return g >= 10 ? 3 : g >= 7 ? 2 : 1;
}

// 따뜻한 · 차가운 · 그 사이 나누기
export const BINS = [['warm', '따뜻한 색', '해 · 불 · 여름'], ['cool', '차가운 색', '물 · 얼음 · 겨울'], ['mid', '그 사이(중성색)', '어느 쪽이라 하기 어려운 색']];
