// 물감 연구소 판 시험 — 섞기 엔진(물감 사실) · 판마다 목표에 닿을 수 있나 · 대충 넣은 답은 안 통하나 · 보기끼리 또렷이 다른가 · 채점 규칙
//  node scripts/unit/paint/stages.test.mjs   (DOM 없음 · 네트워크 없음)
import { mix, dE, lchOf, PASS_DE, WHEEL, complementOf, TUBES, hex, readColor, WARMTH, nearestWheel, KEYS, dropsOf } from '../../../paint/js/color.js';
import { judgeMix, judgeBetween, judgeRung, ladderStars, nextStep, neighborsOf } from '../../../paint/js/judge.js';
import { ST, CHAPTERS, tubesOf, WHY_CHIPS } from '../../../paint/js/stages.js';

const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const L = d => lchOf(mix(d)).L, H = d => lchOf(mix(d)).h;
const fmt = d => KEYS.filter(k => d[k]).map(k => k + d[k]).join('');

// 그 판 물감으로 만들 수 있는 모든 섞기(한 통 0~6방울 — 판 목표는 다 6 안쪽)
function recipes(tubes, max = 6) {
  const ks = KEYS.filter(k => tubes.includes(k)), out = [];
  const rec = (i, d) => { if (i === ks.length) { if (dropsOf(d)) out.push({ ...d }); return; } for (let n = 0; n <= max; n++) { d[ks[i]] = n; rec(i + 1, d); } delete d[ks[i]]; };
  rec(0, {}); return out;
}

// ── 엔진: 물감이 섞이는 사실 ──
test('물감 사실 — 노랑 + 파랑 = 초록 · 빨강 + 노랑 = 주황 · 빨강 + 파랑 = 보라(빛과 다름)', () => {
  ok(nearestWheel(mix({ Y: 1, B: 1 })) === 6, '노랑 + 파랑이 초록이 아님 ' + hex(mix({ Y: 1, B: 1 })));
  ok(nearestWheel(mix({ R: 1, Y: 1 })) === 2 && nearestWheel(mix({ R: 1, B: 1 })) === 10, '주황 · 보라');
  ok(L({ R: 1, Y: 1, B: 1 }) < Math.min(L({ R: 1 }), L({ Y: 1 }), L({ B: 1 })), '세 색을 섞어도 어두워지지 않음');
});
test('비율 — 두 배로 넣어도 같은 색 · 흰색은 밝게 · 검정은 어둡게(한 방울이 흰색 두 방울만큼)', () => {
  for (const d of [{ R: 1, Y: 1 }, { Y: 2, B: 1 }, { R: 1, W: 2 }, { B: 3, Y: 1, K: 1 }]) ok(dE(mix(d), mix(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * 2])))) < 0.01, fmt(d) + ' ×2 가 다른 색');
  ok(L({ R: 1, W: 1 }) > L({ R: 1 }) && L({ R: 1, W: 3 }) > L({ R: 1, W: 1 }), '흰색');
  ok(L({ R: 1, K: 1 }) < L({ R: 1 }) && Math.abs(L({ W: 2, K: 1 }) - 53) < 3, '검정 · 흰색 2 + 검정 1 = 가운데 회색');
});
test('통 색 = 그 물감만 짠 팔레트 색', () => {
  for (const t of TUBES) if (t.k !== 'K') ok(t.css === hex(mix({ [t.k]: 1 })), t.name);
});
test('색 바퀴 — 열두 칸이 한 방향으로 이어짐(이웃 칸끼리 또렷이 다름) · 마주 보는 칸 = 보색', () => {
  WHEEL.forEach(([n, d], i) => { const nx = WHEEL[(i + 1) % 12]; ok(dE(mix(d), mix(nx[1])) > 14, `${n} ↔ ${nx[0]} 너무 비슷`); ok(nearestWheel(mix(d)) === i, n + ' 이 제자리가 아님'); });
  const pairs = [[0, 6], [4, 10], [8, 2], [1, 7], [3, 9], [5, 11]];
  for (const [a, b] of pairs) ok(complementOf(a) === b && complementOf(b) === a, WHEEL[a][0] + ' 보색');
});
test('색 읽기(아이 말) — 회색 · 갈색 · 분홍 · 따뜻함', () => {
  ok(readColor(mix({ W: 2, K: 1 })).name === '회색빛' && readColor(mix({ R: 1, Y: 1, K: 1 })).name === '갈색' && readColor(mix({ R: 1, W: 2 })).name === '분홍', '이름');
  ok(readColor(mix({ R: 1 })).warm === 'warm' && readColor(mix({ B: 1 })).warm === 'cool' && readColor(mix({ Y: 1, B: 1 })).warm === 'mid', '따뜻함');
});

// ── 판마다 ──
const TRIVIAL = tubes => { const ks = KEYS.filter(k => tubes.includes(k)), out = ks.map(k => ({ [k]: 1 })); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) out.push({ [ks[i]]: 1, [ks[j]]: 1 }); return out; };
const MUST_ALL = new Set(['1-2', '1-4', '1-5', '1-6', '1-7', '1-8', '2-2', '2-3', '3-4', '3-5']);   // 이 판은 정답 물감을 다 써야만 통과(3장 = 보색 없이 못 만듦)
const opts = new Set();
for (const s of ST) test(`${s.id} ${s.title} — 판 설계대로`, () => {
  const ch = CHAPTERS.find(c => c.id === s.ch), tubes = tubesOf(s);
  ok(ch && s.story && s.title, '장 · 이야기 없음');
  if (s.kind !== 'feel') ok(s.hint && s.why, '힌트 · 까닭 없음');
  if (s.kind === 'predict' || s.kind === 'contrast') {
    ok(s.opts.length === 4 && s.answer >= 0 && s.answer < 4, '보기 넷 · 정답');
    s.opts.forEach((x, i) => { if (i !== s.answer) ok(x.say, `틀린 보기 ‘${x.n}’에 설명 없음`); });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok(dE(mix(s.opts[i].d), mix(s.opts[j].d)) > 20, `보기 ${s.opts[i].n} · ${s.opts[j].n} 너무 비슷`);
  }
  if (s.kind === 'predict') ok(dE(mix(s.drops), mix(s.opts[s.answer].d)) < 0.01, '정답 보기 ≠ 실제로 섞은 색');
  if (s.kind === 'contrast') ok(nearestWheel(mix(s.opts[s.answer].d)) === complementOf(nearestWheel(mix(s.fg))), '정답 바탕이 보색이 아님');
  if (s.kind === 'mix') {
    const T = s.target.d;
    ok(Object.keys(T).every(k => tubes.includes(k) && T[k] <= 6), '그 판 물감으로 못 만듦 ' + fmt(T));
    ok(judgeMix(T, T, { min: 0 }).ok && judgeMix(T, T).stars === 3, '정답이 별 셋이 아님');
    for (const d of TRIVIAL(tubes)) if (dE(mix(d), mix(T)) > 0.01) ok(!judgeMix(T, d).ok, `대충 넣은 ${fmt(d)} 가 통과`);
    if (MUST_ALL.has(s.id)) {
      const need = Object.keys(T), sneak = recipes(tubes).filter(d => judgeMix(T, d).ok && !need.every(k => d[k]));
      ok(!sneak.length, `정답 물감 없이 통과: ${sneak.slice(0, 3).map(fmt).join(' ')}`);
    }
    if (s.min) {
      ok(dropsOf(T) < s.min && judgeMix(T, T, { min: s.min }).kind === 'amount', '모자라요 판인데 처음 비율로 통과');
      const big = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v * 2]));
      ok(dropsOf(big) >= s.min && judgeMix(T, big, { min: s.min }).ok, '두 배로 만든 답이 안 통함');
    }
    if (s.wheel != null) ok(dE(mix(WHEEL[s.wheel][1]), mix(T)) < 0.01, '색 바퀴 칸과 목표가 다름');
  }
  if (s.kind === 'fill' && s.layout === 'wheel') {
    ok(s.slots.every(i => ![0, 4, 8].includes(i) && i >= 0 && i < 12), '빈 칸이 삼원색 자리');
    for (const i of s.slots) {
      const r = judgeBetween(i, WHEEL[i][1]); ok(r.ok && r.stars === 3, WHEEL[i][0] + ' 정답이 안 통함');
      for (const j of neighborsOf(i)) { const w = judgeBetween(i, WHEEL[j][1]); ok(!w.ok && w.say.includes(WHEEL[j][0]), `${WHEEL[i][0]} 칸에 이웃 ${WHEEL[j][0]} 이 통과하거나 말이 틀림`); }
    }
  }
  if (s.kind === 'fill' && s.layout === 'ladder') {
    const base = mix(s.base), good = [{ B: 1, W: 3 }, { B: 1, W: 1 }, null, { B: 3, K: 1 }, { B: 1, K: 1 }].map(d => (d ? mix(d) : base));
    const slots = [null, null, base, null, null];
    for (const i of [0, 1, 3, 4]) { const r = judgeRung(slots, i, good[i], base); ok(r.ok, `띠 ${i + 1}칸 정답이 안 통함: ${r.say}`); slots[i] = good[i]; }
    ok(ladderStars(slots) === 3, '고른 띠가 별 셋이 아님');
    ok(!judgeRung([null, null, base, null, null], 0, mix({ W: 1 }), base).ok, '흰색만 = 통과');
    ok(!judgeRung([null, null, base, null, null], 4, mix({ K: 1 }), base).ok, '검정만 = 통과');
    ok(judgeRung([null, null, base, null, null], 1, mix({ B: 1, K: 1 }), base).kind === 'order', '어두운 색을 왼쪽에 = 통과');
    ok(judgeRung([good[0], null, base, null, null], 1, good[0], base).kind === 'order', '옆 칸과 같은 색 = 통과');
    ok(judgeRung([null, null, base, null, null], 0, mix({ Y: 1, W: 2 }), base).kind === 'hue', '노란 색 = 통과');
  }
  if (s.kind === 'wheel') ok(s.of.length && s.of.every(i => i >= 0 && i < 12), '보색 문제 칸');
  if (s.kind === 'sort') { const kinds = new Set(s.items.map(i => WARMTH[i])); ok(kinds.has('warm') && kinds.has('cool') && kinds.has('mid') && s.items.every(i => WARMTH[i]), '세 상자'); }
  for (const x of s.opts || []) opts.add(x.n);
});
test('판 수 · 차례 · 이름', () => {
  ok(ST.length === 33 && new Set(ST.map(s => s.id)).size === ST.length, '판 33 · 번호 겹침');
  for (const c of CHAPTERS) { const l = ST.filter(s => s.ch === c.id); ok(l.length >= 5 && l.every((s, i) => s.id === `${c.id}-${i + 1}`), c.id + '장 번호'); }
  ok(WHY_CHIPS.length >= 6 && new Set(WHY_CHIPS.map(c => c[0])).size === WHY_CHIPS.length, '느낌 칩');
});
test('1장을 다 풀면 색 바퀴 열두 칸이 다 찬다', () => {
  const filled = new Set([0, 4, 8]);
  for (const s of ST.filter(s => s.ch === 1)) { if (s.wheel != null) filled.add(s.wheel); for (const i of s.slots || []) filled.add(i); }
  ok(filled.size === 12, '빈 칸 ' + [...Array(12).keys()].filter(i => !filled.has(i)).map(i => WHEEL[i][0]).join(' '));
});
test('다음 한두 방울 힌트 — 그 판 물감만 · 늘 가까워지는 쪽', () => {
  const T = mix({ R: 2, Y: 1 });
  ok(nextStep({ R: 1 }, T, 'RYB').includes('노랑'), '빨강 1 → 다홍');
  ok(!/흰색|검정/.test(nextStep({ R: 1, Y: 1, B: 1 }, mix({ R: 2, Y: 2, B: 1 }), 'RYB')), '3장에 흰색 · 검정 힌트');
  ok(nextStep({ R: 2, Y: 1 }, T, 'RYB') === '', '이미 같은데 힌트');
  ok(judgeMix({ R: 1, W: 2 }, { R: 1 }, { misses: 1 }).say.startsWith('목표가 더 밝고 연해요'), '분홍을 탁하다고 함');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`물감 연구소 판 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
