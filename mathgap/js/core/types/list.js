// 문제 유형(틀) 7가지 — 문제집 목차에서 단원을 넘나드는 틀(분석: 아티팩트 '문장제 유형 지도', 2026-10-11)
//   틀 = 풀이 방법이 같은 문제 모양. 단원마다 '숫자 영역'만 바꿔 낸다(그 단원에서 배우는 계산이 단계로 들어가게).
//   하나 만들기: make(spec, r) → { story 문제 글 조각, item 답 칸, x 정답 값, steps 같이 풀기 단계, ... }
//     steps[i] = { kind: 'pick' 식 고르기 | 'calc' 계산, key 틀을 아는지 가르는 단계, why 설명, item, c 차시(계산 · 못 찾으면 null) }
//   글 규칙: 이름 있는 사람 없음 · 4학년 눈높이 · 단위는 띄어 씀(cm) · 조사는 수의 마지막 읽기로
import { R, F, val, whole, lt, ar, txt, tok, q, S, pj, uj, uro, expr, exprT, answerItem, choose, calcItem, divRemItem, until, fs, places, gcd, lcm, INV, eqv } from './kit.js';
import { RO, P } from '../concepts/kit.js';
import { resolve, makeItem } from '../lessons/index.js';

const W = (n) => F(n, 1);
const ro = (x, st) => { const t = txt(x, st); return RO(t).slice(t.length); };
const ye = (s) => `${s}${P(String(s).trim().split(/\s+/).pop(), '이에요', '예요')}`;   // 식이면 마지막 수(분수는 분자) 기준
const dec = (r, lo, hi, k) => R(until(r, (r) => r.int(lo, hi), (a) => a % 10 !== 0), 10 ** k);   // 끝자리 0 없는 소수 k자리
const frc = (r, dmin = 2, dmax = 9) => until(r, (r) => { const d = r.int(dmin, dmax); return F(r.int(1, d - 1), d); }, (x) => gcd(x.n, x.d) === 1);
const mixF = (r, wlo, whi, dmin = 2, dmax = 9) => { const f = frc(r, dmin, dmax); return R(r.int(wlo, whi) * f.d + f.n, f.d); };
// 분모가 다른 두 분수 — 교과서처럼 통분한 분모가 24 이하인 짝(2와 3 · 4와 6 · 3과 8 …)
const DPAIRS = [[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [4, 6], [6, 8], [3, 6], [2, 6], [4, 8], [2, 8], [5, 10], [3, 9], [6, 9], [3, 8], [2, 7], [4, 10], [2, 9]];
const fracD = (r, d) => until(r, (r) => F(r.int(1, d - 1), d), (x) => gcd(x.n, x.d) === 1);
const mixD = (r, d, wlo, whi) => { const f = fracD(r, d); return R(r.int(wlo, whi) * d + f.n, d); };
const dpair = (r) => r.shuffle(r.pick(DPAIRS));
const okStep = (s) => s && s.item;
const pickStep = (why, prompt, opts, r) => ({ kind: 'pick', key: true, why, item: choose(prompt, opts, r) });
const calcStep = (why, op, x, y, st, more = {}) => { const k = calcItem(op, x, y, st); return { kind: 'calc', why, item: k.item, c: k.c, z: k.z, ...more }; };
// 카드 그림(수 카드) — 색은 CSS(.card · .cardt)
function cardsSvg(ds) {
  const w = 46, h = 60, g = 12, Wd = ds.length * (w + g) - g + 6;
  const s = ds.map((d, i) => { const x = 3 + i * (w + g); return `<rect x="${x}" y="3" width="${w}" height="${h}" rx="9" class="card"/><text x="${x + w / 2}" y="${3 + h / 2 + 11}" text-anchor="middle" class="cardt">${d}</text>`; }).join('');
  return `<svg viewBox="0 0 ${Wd} ${h + 6}" width="${Wd}" height="${h + 6}" role="img" aria-label="수 카드 ${ds.join(', ')}">${s}</svg>`;
}
const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
const num = (ds) => Number(ds.join(''));

// ───────────────────────────── 어떤 수 · 잘못 계산 ─────────────────────────────
const SUBJ = { '+': '에 ', '−': '에서 ', '×': '에 ', '÷': '를 ' };
const SHOULD = { '+': '더해야', '−': '빼야', '×': '곱해야', '÷': '나누어야' };
const PAST = { '+': '더했더니', '−': '뺐더니', '×': '곱했더니', '÷': '나누었더니' };
const obj = (op, x, st) => (op === '÷' ? ro(x, st) : pj(x, st, '을', '를'));
// 단원마다 두 연산(good 바르게 · bad 잘못)과 수 고르기
const INV_SPECS = {
  '2-1-3': { st: 'W', max: 150, gen: (r) => (r.chance(0.5)
    ? (() => { const b = r.int(12, 48); return { good: '+', bad: '−', x: W(r.int(b + 11, 99)), b: W(b) }; })()
    : (() => { const x = r.int(35, 99); return { good: '−', bad: '+', x: W(x), b: W(r.int(11, x - 12)) }; })()) },
  '3-1-1': { st: 'W', max: 999, gen: (r) => (r.chance(0.5)
    ? (() => { const b = r.int(115, 489); return { good: '+', bad: '−', x: W(r.int(b + 102, 899)), b: W(b) }; })()
    : (() => { const x = r.int(300, 899); return { good: '−', bad: '+', x: W(x), b: W(r.int(112, x - 105)) }; })()) },
  '3-1-3': { st: 'W', max: 99, gen: (r) => { const b = r.int(3, 9), qq = r.int(3, 9); return { good: '÷', bad: r.pick(['+', '−']), x: W(b * qq), b: W(b) }; } },
  '3-1-4': { st: 'W', max: 999, gen: (r) => ({ good: '×', bad: r.pick(['+', '−']), x: W(until(r, (r) => r.int(12, 48), (n) => n % 10 !== 0)), b: W(r.int(3, 9)) }) },
  '3-2-1': { st: 'W', max: 3000, gen: (r) => (r.chance(0.5)
    ? { good: '×', bad: r.pick(['+', '−']), x: W(until(r, (r) => r.int(112, 389), (n) => n % 10 !== 0)), b: W(r.int(2, 6)) }
    : { good: '×', bad: '+', x: W(until(r, (r) => r.int(13, 49), (n) => n % 10 !== 0)), b: W(until(r, (r) => r.int(12, 38), (n) => n % 10 !== 0)) }) },
  '3-2-2': { st: 'W', max: 999, gen: (r) => { const b = r.int(3, 9); if (r.chance(0.5)) { const qq = r.int(12, Math.floor(99 / b)); return { good: '÷', bad: '×', x: W(b * qq), b: W(b) }; } return { good: '÷', bad: '+', x: W(b * r.int(12, Math.floor(999 / b))), b: W(b) }; } },
  '4-1-3': { st: 'W', max: 30000, gen: (r) => { const b = until(r, (r) => r.int(12, 39), (n) => n % 10 !== 0); if (r.chance(0.5)) return { good: '×', bad: '÷', x: W(b * r.int(12, Math.floor(999 / b))), b: W(b) }; return { good: '÷', bad: '+', x: W(b * r.int(12, Math.floor(999 / b))), b: W(b) }; } },
  '4-2-1': { st: 'FS', gen: (r) => { const d = r.int(4, 9); if (r.chance(0.5)) return { good: '+', bad: '−', x: fs(r.int(2, 6), r.int(0, d - 1), d), b: fs(r.int(0, 3), r.int(1, d - 1), d) }; return { good: '−', bad: '+', x: fs(r.int(2, 6), r.int(0, d - 1), d), b: fs(r.int(0, 2), r.int(1, d - 1), d) }; },
    ok: (p) => { const d = p.x.d, xn = p.x.n % d, bn = p.b.n % d; return xn < bn || xn + bn >= d; } },   // 받아올림이나 받아내림이 한 번은 있게
  '4-2-3': { st: 'D', gen: (r) => { const k1 = r.int(1, 2), k2 = r.int(1, 2); const x = k1 === 1 ? dec(r, 21, 89, 1) : dec(r, 211, 899, 2), b = k2 === 1 ? dec(r, 11, 59, 1) : dec(r, 111, 599, 2); return r.chance(0.5) ? { good: '+', bad: '−', x, b } : { good: '−', bad: '+', x, b }; } },
  '5-1-5': { st: 'F', gen: (r) => { const [d1, d2] = dpair(r), x = mixD(r, d1, 2, 4), b = mixD(r, d2, 1, 2); return r.chance(0.5) ? { good: '+', bad: '−', x, b } : { good: '−', bad: '+', x, b }; } },
  '5-2-2': { st: 'F', gen: (r) => { const [d1, d2] = dpair(r), b = fracD(r, d2), x = r.chance(0.3) ? W(r.int(2, 9)) : fracD(r, d1); return { good: '×', bad: r.pick(['+', '−']), x, b }; } },
  '5-2-4': { st: 'D', gen: (r) => ({ good: '×', bad: r.pick(['+', '−']), x: dec(r, 12, 98, 1), b: r.chance(0.5) ? W(r.int(2, 9)) : dec(r, 2, 28, 1) }) },
  '6-1-1': { st: 'F', gen: (r) => ({ good: '÷', bad: '×', x: r.chance(0.6) ? frc(r, 3, 9) : mixF(r, 1, 3, 2, 7), b: W(r.int(2, 5)) }) },
  '6-1-3': { st: 'D', gen: (r) => { const k = r.int(2, 9), A = r.chance(0.5) ? dec(r, 12, 49, 1) : dec(r, 112, 349, 2); return { good: '÷', bad: '×', x: ar('×', A, W(k)), b: W(k) }; },
    ok: (p) => places(p.x) >= 1 && places(p.x) <= 2 },
  '6-2-1': { st: 'F', gen: (r) => { const b = frc(r, 2, 9), x = r.chance(0.6) ? frc(r, 2, 9) : mixF(r, 1, 3, 2, 6); return r.chance(0.65) ? { good: '÷', bad: '×', x, b } : { good: '×', bad: '÷', x, b }; } },
  '6-2-2': { st: 'D', gen: (r) => { const b = dec(r, 2, 25, 1); if (r.chance(0.6)) return { good: '÷', bad: '×', x: ar('×', W(r.int(2, 9)), b), b }; return { good: '×', bad: '÷', x: ar('×', dec(r, 2, 9, 1), b), b }; },
    ok: (p) => places(p.x) >= 1 && places(p.x) <= 2 },
};
// 쉬운 숫자(같은 두 연산 · 작은 자연수) — 틀을 모르는지, 숫자가 바뀌어서 흔들리는지 가르기
const INV_EASY = (pair) => (r) => {
  const [good, bad] = pair;
  if (good === '+' || good === '−') { const b = r.int(11, 29), x = r.int(b + 11, 70); return { good, bad, x: W(x), b: W(b) }; }
  if (good === '÷') { const b = r.int(2, 5), qq = r.int(2, 9); return { good, bad, x: W(b * qq), b: W(b) }; }
  if (bad === '÷') { const b = r.int(2, 5); return { good, bad, x: W(b * r.int(2, 9)), b: W(b) }; }
  return { good, bad, x: W(r.int(3, 9)), b: W(r.int(2, 9)) };
};
function invMake(spec, r) {
  const p = until(r, spec.gen, (p) => {
    const Rv = ar(p.bad, p.x, p.b, spec.st), A = ar(p.good, p.x, p.b, spec.st);
    if (!(Rv.n > 0) || !(A.n > 0)) return false;
    if (spec.st === 'W' && (!whole(Rv) || !whole(A) || (spec.max && (val(Rv) > spec.max || val(A) > spec.max)))) return false;
    if (spec.st === 'D' && (places(Rv) < 0 || places(Rv) > 3 || places(A) < 0 || places(A) > 3)) return false;
    if (spec.st === 'F' && (Rv.d > 48 || A.d > 48)) return false;
    if (eqv(Rv, p.b) || eqv(A, p.b) || eqv(Rv, A) || eqv(Rv, p.x)) return false;
    return !spec.ok || spec.ok(p);
  });
  const { good, bad, x, b } = p, st = spec.st, Rv = ar(bad, x, b, st), A = ar(good, x, b, st);
  const sameObj = (good === '÷') === (bad === '÷');
  const story = S('어떤 수', SUBJ[good], q(b, st), obj(good, b, st), ` ${SHOULD[good]} 할 것을 잘못하여 `,
    sameObj ? '' : S(q(b, st), obj(bad, b, st), ' '), `${PAST[bad]} `, q(Rv, st), pj(Rv, st, '이', '가'), ' 되었어요.', { br: 1 }, '바르게 계산하면 얼마일까요?');
  const back = ar(INV[bad], Rv, b, st);   // = x
  const bugs = [{ x, name: '어떤 수까지만 구함' }];
  const g2 = ar(good, Rv, b, st); if (g2.n > 0) bugs.push({ x: g2, name: '잘못 계산한 값에 바로 바르게 계산함' });
  const w1 = ar(bad, Rv, b, st); if (w1.n > 0) { const w2 = ar(good, w1, b, st); if (w2.n > 0) bugs.push({ x: w2, name: '어떤 수를 거꾸로 구하지 않음' }); }
  const steps = [
    pickStep('잘못 계산한 것을 어떤 수 대신 □를 써서 식으로 나타내 봐요.', '어떤 식일까요?', [
      { t: S('□ ', bad, ' ', tok(b, st), ' = ', tok(Rv, st)), right: true },
      { t: S('□ ', good, ' ', tok(b, st), ' = ', tok(Rv, st)), name: '잘못한 계산 대신 바르게 할 계산으로 식을 씀' },
      { t: S('□ ', bad, ' ', tok(Rv, st), ' = ', tok(b, st)), name: '두 수의 자리를 바꿔 씀' },
    ], r),
    calcStep(`□ ${bad} ${txt(b, st)} = ${txt(Rv, st)}이면 □는 거꾸로 ${ye(exprT(INV[bad], Rv, b, st))}. 어떤 수를 구해요.`, INV[bad], Rv, b, st),
    calcStep(`어떤 수는 ${ye(txt(back, st))}. 이제 바르게 계산해요.`, good, x, b, st),
  ];
  return { story, item: answerItem('답 ', A, st, '', bugs), x: A, steps, p: { good, bad } };
}

// ───────────────────────────── □ 안에 들어갈 수 있는 수 ─────────────────────────────
//   kind: plus(a + □ < T · 가장 큰) · more(□ + a > T · 가장 작은) · minus(T − □ > a · 가장 큰) · mul(□ × k + c < T · 가장 큰)
const RANGE_SPECS = {
  '2-1-3': { st: 'W', gen: (r) => { const kind = r.pick(['plus', 'more', 'minus']), T = r.int(41, 99), a = r.int(12, T - 15); return { kind, T, a }; } },
  '5-1-1': { st: 'W', gen: (r) => { const k = r.int(3, 9), c = r.int(5, 39), T = r.int(c + k * 6, Math.min(99, c + k * 12)); return { kind: 'mul', T, a: c, k }; } },
};
const RANGE_EASY = (r) => { const kind = r.pick(['plus', 'more', 'minus']), T = r.int(15, 30), a = r.int(4, T - 6); return { kind, T, a }; };
function rangeMake(spec, r) {
  const p = spec.gen(r), { kind, T, a } = p;
  const box = (s) => S('□ 안에 들어갈 수 있는 수 중에서 ', s, '를 구하세요.');
  if (kind === 'mul') {
    const k = p.k, M = T - a, qq = Math.floor(M / k), rem = M % k, best = rem ? qq : qq - 1;
    const ineq = `□ × ${k} + ${a} < ${T}`;
    const story = S(box('가장 큰 자연수'), { br: 1 }, ineq);
    const dr = divRemItem(M, k);
    const steps = [
      calcStep(`먼저 □ × ${k} + ${a} = ${T}${P_(T, '이라고', '라고')} 생각해요. □ × ${k}${P_(k, '은', '는')} ${T}에서 ${a}${P_(a, '을', '를')} 뺀 수예요.`, '−', W(T), W(a), 'W'),
      pickStep(`${ineq}이려면 □ × ${k}${P_(k, '은', '는')} ${M}보다 어때야 할까요?`, `□ × ${k}${P_(k, '은', '는')} ${M}보다…`, [
        { t: '작아야 해요', right: true }, { t: '커야 해요', name: '부등호 방향을 거꾸로 봄' }], r),
      { kind: 'calc', why: `${M} ÷ ${k}${P_(k, '을', '를')} 해 봐요. □ × ${k}${P_(k, '이', '가')} ${M}보다 작은 가장 큰 □를 찾는 데 써요.`, item: dr.item, c: dr.c },
      pickStep(rem ? `${k} × ${qq} = ${k * qq}, ${k} × ${qq + 1} = ${k * (qq + 1)}이에요. ${M}보다 작으려면?` : `${k} × ${qq} = ${M}이에요. ${M}보다 작아야 하니까?`, '가장 큰 □는?', [
        { t: String(best), right: true }, { t: String(best + 1), name: '경계의 수도 넣음' }, { t: String(best - 1), name: '하나 작게 셈' }], r),
    ];
    return { story, item: answerItem('답 ', W(best), 'W', '', [{ x: W(best + 1), name: '경계의 수도 넣음' }, { x: W(qq), name: '몫을 그대로 답함' }]), x: W(best), steps, p: { kind } };
  }
  const B0 = T - a;   // □ = B0 이면 등호
  const ineq = kind === 'plus' ? `${a} + □ < ${T}` : kind === 'more' ? `□ + ${a} > ${T}` : `${T} − □ > ${a}`;
  const ask = kind === 'more' ? '가장 작은 수' : '가장 큰 수';
  const ans = kind === 'more' ? B0 + 1 : B0 - 1;
  const small = kind !== 'more';   // □가 B0 보다 작아야
  const story = S(box(ask), { br: 1 }, ineq);
  const eq = kind === 'plus' ? `${a} + □ = ${T}` : kind === 'more' ? `□ + ${a} = ${T}` : `${T} − □ = ${a}`;
  const steps = [
    calcStep(`먼저 ${eq}${P_(T, '이', '가')} 되는 □를 구해요.`, '−', W(T), W(a), 'W'),
    pickStep(`${ineq}이려면 □는 ${B0}보다 어때야 할까요?${kind === 'minus' ? ` (□가 커지면 ${T} − □는 작아져요)` : ''}`, `□는 ${B0}보다…`, [
      { t: '작아야 해요', right: small, name: small ? null : '부등호 방향을 거꾸로 봄' }, { t: '커야 해요', right: !small, name: small ? '부등호 방향을 거꾸로 봄' : null }], r),
    pickStep(`그러면 □ 안에 들어갈 수 있는 수 중에서 ${ask}${P_(ask, '은', '는')}?`, `${ask}${P_(ask, '은', '는')}?`, [
      { t: String(ans), right: true }, { t: String(B0), name: '경계의 수도 넣음' }, { t: String(small ? B0 + 1 : B0 - 1), name: '방향을 거꾸로 봄' }], r),
  ];
  return { story, item: answerItem('답 ', W(ans), 'W', '', [{ x: W(B0), name: '경계의 수도 넣음' }, { x: W(small ? B0 + 1 : B0 - 1), name: '부등호 방향을 거꾸로 봄' }]), x: W(ans), steps, p: { kind } };
}
const P_ = (s, a, b) => P(String(s), a, b);

// ───────────────────────────── 수 카드 ─────────────────────────────
const CARD_SPECS = {
  '3-1-1': { st: 'W', kind: 'bs3' }, '3-1-4': { st: 'W', kind: 'm21' }, '3-2-1': { st: 'W', kind: 'm22' }, '4-1-3': { st: 'W', kind: 'm32' }, '6-2-1': { st: 'F', kind: 'fdiv' },
};
function cardMake(spec, r) {
  const k = spec.kind;
  if (k === 'bs3') {
    const ds = until(r, (r) => { const s = new Set(r.chance(0.65) ? [0] : []); while (s.size < 4) s.add(r.int(1, 9)); return r.shuffle([...s]); }, (ds) => true);
    const desc = [...ds].sort((a, b) => b - a), asc = [...ds].sort((a, b) => a - b);
    const big = num(desc.slice(0, 3));
    const lead = asc.find((d) => d > 0), rest = asc.filter((d) => d !== lead).slice(0, 2), small = num([lead, ...rest]);
    const zeroFirst = asc[0] === 0 ? num(asc.slice(0, 3)) : null;
    const op = r.chance(0.5) ? '+' : '−', A = op === '+' ? big + small : big - small;
    const story = S({ svg: cardsSvg(ds) }, `수 카드 4장 중에서 3장을 골라 한 번씩만 써서 세 자리 수를 만들려고 해요. 만들 수 있는 가장 큰 수와 가장 작은 수의 ${op === '+' ? '합' : '차'}${op === '+' ? '은' : '는'} 얼마일까요?`);
    const sw = (n) => { const s = String(n); return Number(s[0] + s[2] + s[1]); };
    const steps = [
      pickStep('가장 큰 세 자리 수는 높은 자리부터 큰 숫자를 놓아요.', '가장 큰 세 자리 수는?', [
        { t: String(big), right: true }, { t: String(sw(big)), name: '높은 자리부터 큰 숫자를 놓지 않음' }, { t: String(num([desc[1], desc[0], desc[2]])), name: '높은 자리부터 큰 숫자를 놓지 않음' }], r),
      pickStep(zeroFirst != null ? '가장 작은 세 자리 수는 높은 자리부터 작은 숫자를 놓아요. 0은 맨 앞에 올 수 없어요.' : '가장 작은 세 자리 수는 높은 자리부터 작은 숫자를 놓아요.', '가장 작은 세 자리 수는?', [
        { t: String(small), right: true }, ...(zeroFirst != null ? [{ t: '0' + String(zeroFirst).padStart(2, '0'), name: '0을 맨 앞에 놓음' }] : []), { t: String(sw(small)), name: '높은 자리부터 작은 숫자를 놓지 않음' }], r),
      calcStep(`이제 ${big}${P_(big, '과', '와')} ${small}의 ${op === '+' ? '합을' : '차를'} 구해요.`, op, W(big), W(small), 'W'),
    ];
    const bugs = zeroFirst != null ? [{ x: W(op === '+' ? big + zeroFirst : big - zeroFirst), name: '0을 맨 앞에 놓음' }] : [];
    return { story, item: answerItem('답 ', W(A), 'W', '', bugs), x: W(A), steps, p: { kind: k } };
  }
  if (k === 'm21' || k === 'm22' || k === 'm32') {
    const n = { m21: 3, m22: 4, m32: 5 }[k], la = { m21: 2, m22: 2, m32: 3 }[k];
    const ds = until(r, (r) => { const s = new Set(); while (s.size < n) s.add(r.int(2, 9)); return [...s]; }, () => true);
    const all = perms(ds).map((p) => ({ a: num(p.slice(0, la)), b: num(p.slice(la)) })).filter((e) => e.a >= e.b || la !== n - la);
    all.sort((x, y) => y.a * y.b - x.a * x.b || y.a - x.a);
    const best = all[0], desc = [...ds].sort((a, b) => b - a);
    const naive = { a: num(desc.slice(0, la)), b: num(desc.slice(la)) };   // 큰 숫자를 한 수에 몰아 놓기
    const prod = (e) => e.a * e.b, others = all.filter((e) => prod(e) !== prod(best));
    const d1 = others.find((e) => e.a === naive.a && e.b === naive.b) || others[0];
    const d2 = others.find((e) => prod(e) !== prod(d1));
    const shape = { m21: '(두 자리 수) × (한 자리 수)', m22: '(두 자리 수) × (두 자리 수)', m32: '(세 자리 수) × (두 자리 수)' }[k];
    const story = S({ svg: cardsSvg(r.shuffle(ds)) }, `수 카드 ${n}장을 한 번씩 모두 써서 ${shape}의 곱셈식을 만들려고 해요. 곱이 가장 크게 되도록 만들었을 때, 그 곱은 얼마일까요?`);
    const hint = k === 'm21' ? '한 자리 수에는 가장 큰 숫자를 놓아야 곱이 커져요. 여러 가지를 어림해 견주어 봐요.' : '큰 숫자를 두 수의 가장 높은 자리에 나누어 놓아요. 어림해서 견주어 봐요.';
    const steps = [
      pickStep(hint, '곱이 가장 큰 식은?', [
        { t: `${best.a} × ${best.b}`, right: true },
        { t: `${d1.a} × ${d1.b}`, name: d1.a === naive.a && d1.b === naive.b ? '큰 숫자를 한 수에 몰아 놓음' : '곱이 가장 큰 식을 고르지 못함' },
        ...(d2 ? [{ t: `${d2.a} × ${d2.b}`, name: '곱이 가장 큰 식을 고르지 못함' }] : [])], r),
      calcStep('그 곱셈을 해요.', '×', W(best.a), W(best.b), 'W'),
    ];
    return { story, item: answerItem('답 ', W(best.a * best.b), 'W', '', [{ x: W(d1.a * d1.b), name: '곱이 가장 큰 식을 고르지 못함' }]), x: W(best.a * best.b), steps, p: { kind: k } };
  }
  if (k === 'd21') {   // 분수의 나눗셈 수 카드의 쉬운 판 — (두 자리 수) ÷ (한 자리 수), 몫이 가장 크게
    const ds = until(r, (r) => { const s = new Set(); while (s.size < 3) s.add(r.int(2, 9)); return [...s]; }, () => true);
    const all = perms(ds).map((p) => ({ a: num(p.slice(0, 2)), b: p[2] })).sort((x, y) => y.a / y.b - x.a / x.b);
    const best = all[0], bigDiv = [...all].sort((x, y) => y.b - x.b || y.a - x.a)[0], other = all.find((e) => e !== best && e !== bigDiv && Math.floor(e.a / e.b) !== Math.floor(best.a / best.b)) || all[all.length - 1];
    const qq = Math.floor(best.a / best.b);
    const story = S({ svg: cardsSvg(r.shuffle(ds)) }, '수 카드 3장을 한 번씩 모두 써서 (두 자리 수) ÷ (한 자리 수)의 나눗셈식을 만들려고 해요. 몫이 가장 크게 되도록 만들었을 때, 그 몫은 얼마일까요? (나머지는 생각하지 않아요.)');
    const dr = divRemItem(best.a, best.b);
    const steps = [
      pickStep('몫이 크려면 나누어지는 수는 크게, 나누는 수는 작게 만들어요.', '몫이 가장 큰 식은?', [
        { t: `${best.a} ÷ ${best.b}`, right: true }, { t: `${bigDiv.a} ÷ ${bigDiv.b}`, name: '나누는 수도 크게 만듦 (나누면 작아진다고 봄)' }, { t: `${other.a} ÷ ${other.b}`, name: '몫이 가장 큰 식을 고르지 못함' }], r),
      { kind: 'calc', why: '그 나눗셈을 해요.', item: dr.item, c: dr.c, z: W(qq) },
    ];
    return { story, item: answerItem('답 ', W(qq), 'W', '', [{ x: W(Math.floor(bigDiv.a / bigDiv.b)), name: '나누는 수도 크게 만듦 (나누면 작아진다고 봄)' }]), x: W(qq), steps, p: { kind: k } };
  }
  // fdiv — 진분수 ÷ 진분수, 몫이 가장 크게(나누는 수가 작을수록 몫이 커요)
  const ds = until(r, (r) => { const s = new Set(); while (s.size < 4) s.add(r.int(1, 9)); return [...s]; }, () => true);
  const all = perms(ds).filter((p) => p[0] < p[1] && p[2] < p[3]).map((p) => ({ x: F(p[0], p[1]), y: F(p[2], p[3]), v: (p[0] / p[1]) / (p[2] / p[3]) }));
  all.sort((a, b) => b.v - a.v);
  const best = all[0], A = ar('÷', best.x, best.y);
  const bigDiv = [...all].sort((a, b) => (b.y.n / b.y.d) - (a.y.n / a.y.d))[0];
  const other = all.find((e) => e !== best && e !== bigDiv && Math.abs(e.v - best.v) > 1e-9) || all[all.length - 1];
  const fx = (e) => S(tok(e.x, 'F'), ' ÷ ', tok(e.y, 'F'));
  const story = S({ svg: cardsSvg(r.shuffle(ds)) }, '수 카드 4장을 한 번씩 모두 써서 진분수 두 개를 만들고, (진분수) ÷ (진분수)의 나눗셈식을 만들려고 해요. 몫이 가장 크게 되도록 만들었을 때, 그 몫은 얼마일까요?');
  const steps = [
    pickStep('몫이 크려면 나누어지는 수는 크게, 나누는 수는 작게 만들어요. 1보다 작은 수로 나누면 몫이 커져요.', '몫이 가장 큰 식은?', [
      { t: fx(best), right: true }, { t: fx(bigDiv), name: '나누는 수도 크게 만듦 (나누면 작아진다고 봄)' }, { t: fx(other), name: '몫이 가장 큰 식을 고르지 못함' }], r),
    calcStep('그 나눗셈을 해요.', '÷', best.x, best.y, 'F'),
  ];
  return { story, item: answerItem('답 ', A, 'F', '', [{ x: ar('÷', bigDiv.x, bigDiv.y), name: '나누는 수도 크게 만듦 (나누면 작아진다고 봄)' }]), x: A, steps, p: { kind: 'fdiv' } };
}

// ───────────────────────────── 이어 붙이기(겹침) ─────────────────────────────
const OVL_SPECS = {
  '3-1-1': { st: 'W', unit: 'cm', gen: (r) => ({ L1: W(r.int(125, 480)), L2: W(r.int(125, 480)), o: W(r.int(12, 65)) }) },
  '3-1-4': { st: 'W', unit: 'cm', n: true, gen: (r) => ({ L: W(until(r, (r) => r.int(15, 48), (x) => x % 10 !== 0)), n: r.int(3, 6), o: W(r.int(2, 9)) }) },
  '4-2-1': { st: 'FS', unit: 'm', gen: (r) => { const d = r.int(4, 9); return { L1: fs(r.int(1, 4), r.int(1, d - 1), d), L2: fs(r.int(1, 4), r.int(1, d - 1), d), o: fs(0, r.int(1, d - 1), d) }; } },
  '4-2-3': { st: 'D', unit: 'm', gen: (r) => ({ L1: r.chance(0.5) ? dec(r, 12, 49, 1) : dec(r, 112, 499, 2), L2: r.chance(0.5) ? dec(r, 12, 49, 1) : dec(r, 112, 499, 2), o: r.chance(0.5) ? dec(r, 1, 6, 1) : dec(r, 11, 59, 2) }) },
  '5-1-5': { st: 'F', unit: 'm', gen: (r) => { const [d1, d2] = dpair(r), L1 = mixD(r, d1, 1, 3), L2 = mixD(r, d2, 1, 3), o = fracD(r, r.pick([d1, d2, lcm(d1, d2)])); return { L1, L2, o }; } },
};
const OVL_EASY = (r) => ({ L1: W(r.int(12, 40)), L2: W(r.int(12, 40)), o: W(r.int(2, 9)) });
function ovlMake(spec, r) {
  const st = spec.st, u = spec.unit || 'cm';
  if (spec.n) {
    const { L, n, o } = spec.gen(r), tot = ar('×', L, W(n)), ov = ar('×', o, W(n - 1)), A = ar('−', tot, ov);
    const story = S(`길이가 `, q(L, st, u), `인 색 테이프 ${n}장을 `, q(o, st, u), `씩 겹치게 한 줄로 이어 붙였어요. 이어 붙인 색 테이프 전체의 길이는 몇 ${u}일까요?`);
    const steps = [
      pickStep(`테이프 ${n}장을 한 줄로 이으면 겹친 곳은 몇 군데일까요? 그림을 떠올려 봐요.`, '겹친 곳은?', [
        { t: `${n - 1}군데`, right: true }, { t: `${n}군데`, name: '겹친 곳을 테이프 수만큼 셈' }, { t: `${n + 1}군데`, name: '겹친 곳을 잘못 셈' }], r),
      calcStep(`먼저 테이프 ${n}장의 길이를 모두 더해요(곱셈으로).`, '×', L, W(n), st),
      calcStep(`겹친 길이는 ${n - 1}군데만큼이에요.`, '×', o, W(n - 1), st),
      calcStep('전체 길이에서 겹친 길이를 빼요.', '−', tot, ov, st),
    ];
    const bugs = [{ x: tot, name: '겹친 부분을 빼지 않음' }, { x: ar('−', tot, ar('×', o, W(n))), name: '겹친 곳을 테이프 수만큼 셈' }];
    return { story, item: answerItem('답 ', A, st, ` ${u}`, bugs), x: A, steps, p: { n } };
  }
  const { L1, L2, o } = until(r, spec.gen, (p) => lt(p.o, p.L1) && lt(p.o, p.L2) && !eqv(p.L1, p.L2));
  const sum = ar('+', L1, L2, st), A = ar('−', sum, o, st);
  const story = S('길이가 ', q(L1, st, u), '인 색 테이프와 ', q(L2, st, u), '인 색 테이프를 ', q(o, st, u), '만큼 겹치게 이어 붙였어요. 이어 붙인 색 테이프 전체의 길이는 몇 ', u, '일까요?');
  const steps = [
    pickStep('겹친 부분은 두 테이프에 모두 들어 있어요. 어떤 식으로 구할까요?', '전체 길이를 구하는 식은?', [
      { t: S(tok(L1, st), ' + ', tok(L2, st), ' − ', tok(o, st)), right: true },
      { t: S(tok(L1, st), ' + ', tok(L2, st), ' + ', tok(o, st)), name: '겹친 부분을 더함' },
      { t: S(tok(L1, st), ' + ', tok(L2, st)), name: '겹친 부분을 빼지 않음' }], r),
    calcStep('두 테이프의 길이를 더해요.', '+', L1, L2, st),
    calcStep('겹친 길이를 빼요.', '−', sum, o, st),
  ];
  const bugs = [{ x: sum, name: '겹친 부분을 빼지 않음' }, { x: ar('+', sum, o, st), name: '겹친 부분을 더함' }];
  return { story, item: answerItem('답 ', A, st, ` ${u}`, bugs), x: A, steps, p: {} };
}

// ───────────────────────────── 일정한 간격 ─────────────────────────────
//   road 길 한쪽 처음부터 끝까지(나무 = 간격 + 1) · pond 둥근 연못 둘레(의자 = 간격) · cut 끈 자르기(자른 횟수 = 도막 − 1)
//   len 나무 수 → 길이 · gap 나무 수와 길이 → 간격
const GAP_SPECS = {
  '3-1-3': { st: 'W', ask: 'count', gen: (r) => { const g = r.int(2, 9), k = r.int(4, 9); return { kind: r.pick(['road', 'road', 'pond', 'cut']), g: W(g), k }; } },
  '3-2-1': { st: 'W', ask: 'len', gen: (r) => ({ kind: 'road', g: W(until(r, (r) => r.int(12, 45), (x) => x % 10 !== 0)), n: r.int(12, 30) }) },
  '3-2-2': { st: 'W', ask: 'count', gen: (r) => { const g = r.int(3, 9), k = r.int(12, Math.floor(999 / g)); return { kind: r.pick(['road', 'road', 'pond']), g: W(g), k }; } },
  '5-2-4': { st: 'D', ask: 'len', gen: (r) => ({ kind: 'road', g: dec(r, 12, 48, 1), n: r.int(4, 12) }) },
  '6-1-3': { st: 'D', ask: 'gap', gen: (r) => { const n = r.int(4, 10); return { kind: 'road', g: r.chance(0.6) ? dec(r, 12, 48, 1) : dec(r, 112, 349, 2), n }; } },
  '6-2-2': { st: 'D', ask: 'count', gen: (r) => ({ kind: r.pick(['road', 'road', 'pond']), g: dec(r, 12, 45, 1), k: r.int(5, 18) }) },
};
const GAP_EASY = (r) => ({ kind: r.pick(['road', 'pond', 'cut']), g: W(r.int(2, 5)), k: r.int(3, 6) });
function gapMake(spec, r) {
  const st = spec.st, ask = spec.ask || 'count', p = spec.gen(r), g = p.g;
  if (ask === 'len' || ask === 'gap') {
    const n = p.n, k = n - 1, L = ar('×', g, W(k));
    const story = ask === 'len'
      ? S(`길 한쪽에 처음부터 끝까지 나무 ${n}그루를 `, q(g, st, 'm'), ' 간격으로 심었어요. 이 길의 길이는 몇 m일까요? (나무의 두께는 생각하지 않아요.)')
      : S('길이가 ', q(L, st, 'm'), `인 길 한쪽에 처음부터 끝까지 나무 ${n}그루를 똑같은 간격으로 심으려고 해요. 나무 사이의 간격을 몇 m로 해야 할까요? (나무의 두께는 생각하지 않아요.)`);
    const steps = [
      pickStep(`길의 처음과 끝에 모두 나무가 있으면, 나무 ${n}그루 사이의 간격은 몇 군데일까요?`, '간격은?', [
        { t: `${k}군데`, right: true }, { t: `${n}군데`, name: '간격 수와 나무 수를 같게 봄' }, { t: `${n + 1}군데`, name: '간격 수를 잘못 셈' }], r),
      ask === 'len' ? calcStep('간격 하나의 길이에 간격 수를 곱해요.', '×', g, W(k), st) : calcStep('길의 길이를 간격 수로 나눠요.', '÷', L, W(k), st),
    ];
    const A = ask === 'len' ? L : g;
    const bugs = ask === 'len' ? [{ x: ar('×', g, W(n)), name: '간격 수와 나무 수를 같게 봄' }] : [{ x: ar('÷', L, W(n)), name: '간격 수와 나무 수를 같게 봄' }];
    return { story, item: answerItem('답 ', A, st, ' m', bugs), x: A, steps, p: { kind: p.kind, ask } };
  }
  const k = p.k, L = ar('×', g, W(k)), kind = p.kind;
  let story, ans, choices;
  if (kind === 'road') {
    story = S('길이가 ', q(L, st, 'm'), '인 길 한쪽에 처음부터 끝까지 ', q(g, st, 'm'), ' 간격으로 나무를 심으려고 해요. 나무는 모두 몇 그루 필요할까요? (나무의 두께는 생각하지 않아요.)');
    ans = k + 1; choices = [{ t: `${k + 1}그루`, right: true }, { t: `${k}그루`, name: '간격 수와 나무 수를 같게 봄' }, { t: `${k - 1}그루`, name: '양 끝을 빼고 셈' }];
  } else if (kind === 'pond') {
    story = S('둘레가 ', q(L, st, 'm'), '인 둥근 연못 둘레에 ', q(g, st, 'm'), ' 간격으로 의자를 놓으려고 해요. 의자는 모두 몇 개 필요할까요? (의자의 크기는 생각하지 않아요.)');
    ans = k; choices = [{ t: `${k}개`, right: true }, { t: `${k + 1}개`, name: '둥글게 놓을 때도 하나를 더함' }, { t: `${k - 1}개`, name: '간격 수를 잘못 셈' }];
  } else {
    story = S('길이가 ', q(L, st, 'cm'), '인 끈을 ', q(g, st, 'cm'), '씩 똑같이 자르려고 해요. 모두 몇 번 잘라야 할까요?');
    ans = k - 1; choices = [{ t: `${k - 1}번`, right: true }, { t: `${k}번`, name: '자르는 횟수와 도막 수를 같게 봄' }, { t: `${k + 1}번`, name: '자르는 횟수를 잘못 셈' }];
  }
  const steps = [
    calcStep(kind === 'cut' ? '먼저 끈이 몇 도막이 되는지 구해요.' : `먼저 ${kind === 'pond' ? '둘레' : '길'}에 간격이 몇 군데 생기는지 구해요.`, '÷', L, g, st),
    pickStep(kind === 'road' ? `간격이 ${k}군데예요. 길의 처음과 끝에 모두 심으면 나무는?` : kind === 'pond' ? `간격이 ${k}군데예요. 둥글게 놓으면 처음과 끝이 만나요. 의자는?` : `${k}도막이 되려면 몇 번 잘라야 할까요?`,
      kind === 'road' ? '나무는 모두?' : kind === 'pond' ? '의자는 모두?' : '자르는 횟수는?', choices, r),
  ];
  const tail = { road: '그루', pond: '개', cut: '번' }[kind];
  const bugs = choices.filter((c) => !c.right).map((c) => ({ x: W(Number(c.t.replace(/\D/g, ''))), name: c.name }));
  return { story, item: answerItem('답 ', W(ans), 'W', tail, bugs), x: W(ans), steps, p: { kind, ask } };
}

// ───────────────────────────── 합과 차로 두 수 ─────────────────────────────
const SUMDIF_SPECS = {
  '3-2-2': { st: 'W', gen: (r) => { const s = r.int(14, 120), d = r.int(4, 60); return { small: W(s), dif: W(d) }; } },
};
const SUMDIF_EASY = (r) => ({ small: W(r.int(5, 20)), dif: W(r.int(2, 9)) });
const THINGS = [['빨간 구슬', '파란 구슬', '개'], ['노란 색종이', '초록 색종이', '장'], ['동화책', '과학책', '권'], ['딸기 사탕', '포도 사탕', '개']];
function sumdifMake(spec, r) {
  const st = spec.st, { small, dif } = spec.gen(r), big = ar('+', small, dif), sum = ar('+', big, small);
  const [A, Bn, u] = r.pick(THINGS), askBig = r.chance(0.5), ans = askBig ? big : small;
  const story = S(`${A}${P_(A, '과', '와')} ${Bn}${P_(Bn, '이', '가')} 모두 `, q(sum, st, u), ` 있어요. ${A}${P_(A, '이', '가')} ${Bn}보다 `, q(dif, st, u), ` 더 많아요. ${askBig ? A : Bn}${P_(askBig ? A : Bn, '은', '는')} 몇 ${u}일까요?`);
  const S2 = ar('−', sum, dif);
  const steps = [
    pickStep(`${A}에서 더 많은 만큼인 ${txt(dif, st)}${P_(txt(dif, st), '을', '를')} 빼면 두 가지가 같은 수가 돼요. ${Bn}의 수를 구하는 식은?`, `${Bn}의 수는?`, [
      { t: `(${txt(sum, st)} − ${txt(dif, st)}) ÷ 2`, right: true }, { t: `${txt(sum, st)} ÷ 2`, name: '합을 반으로만 나눔' }, { t: `(${txt(sum, st)} + ${txt(dif, st)}) ÷ 2`, name: '많은 쪽과 적은 쪽을 헷갈림' }, { t: `${txt(sum, st)} − ${txt(dif, st)}`, name: '2로 나누지 않음' }], r),
    calcStep('모두에서 더 많은 만큼을 빼요.', '−', sum, dif, st),
    calcStep('똑같은 두 묶음이 되었으니 2로 나눠요.', '÷', S2, W(2), st),
    ...(askBig ? [calcStep(`${A}${P_(A, '은', '는')} ${Bn}보다 ${txt(dif, st)} 더 많아요.`, '+', small, dif, st)] : []),
  ];
  const bugs = [{ x: askBig ? small : big, name: '많은 쪽과 적은 쪽을 헷갈림' }, ...(whole(ar('÷', sum, W(2))) ? [{ x: ar('÷', sum, W(2)), name: '합을 반으로만 나눔' }] : []), { x: S2, name: '2로 나누지 않음' }];
  return { story, item: answerItem('답 ', ans, st, u, bugs), x: ans, steps, p: { askBig } };
}

// ───────────────────────────── 부분 · 남은 양 ─────────────────────────────
//   count 3학년 '분수만큼은 얼마'(개수) · frac 5학년 처음 전체의 몇 분의 몇 · share 6학년 남은 양을 똑같이 나누기
const PART_SPECS = {
  '3-2-4': { st: 'W', kind: 'count' },
  '5-2-2': { st: 'F', kind: 'frac' },
  '6-1-1': { st: 'F', kind: 'share' },
};
// 'N의 n/d' — 3학년 '분수만큼은 얼마(개수)' 차시 문제 그대로
function f4Step(N, n, d, why) {
  try {
    const r = resolve('F4', { N, n, d }), it = makeItem(r.c, r.p);
    if (r.c && Math.abs(Number(it.sol[it.sol.length - 1]) - (N * n) / d) < 1e-9) return { kind: 'calc', why, item: it, c: r.c };
  } catch (e) { /* 아래 식으로 */ }
  return calcStep(why, '×', W(N), F(n, d), 'F');
}
const PART_THINGS = [
  { all: '가진 돈', p: '로', a: '책을 사고', b: '공책을 샀어요', left: '남은 돈', first: '처음 가진 돈' },
  { all: '가진 색 테이프', p: '로', a: '꽃을 만들고', b: '상자를 꾸몄어요', left: '남은 색 테이프', first: '처음 가진 색 테이프' },
  { all: '밭', p: '에', a: '감자를 심고', b: '상추를 심었어요', left: '아무것도 심지 않은 밭', first: '전체 밭' },
];
function partMake(spec, r) {
  const kind = spec.kind;
  if (kind === 'count') {
    const p = until(r, (r) => { const b = r.int(2, 6), a = r.int(1, b - 1), e = r.int(2, 5), c = r.int(1, e - 1), N = b * e * r.int(1, 4) * (r.chance(0.5) ? 1 : 2); return { a, b, c, e, N }; },
      (p) => p.N >= 12 && p.N <= 96 && gcd(p.a, p.b) === 1 && gcd(p.c, p.e) === 1 && (p.N - (p.N / p.b) * p.a) % p.e === 0);
    const { a, b, c, e, N } = p, eat = (N / b) * a, M = N - eat, give = (M / e) * c, A = M - give;
    const story = S(`사탕이 ${N}개 있어요. 그중에서 `, { f: [a, b] }, `${P_(`${a}/${b}`, '을', '를')} 먹고, 남은 사탕의 `, { f: [c, e] }, `${P_(`${c}/${e}`, '을', '를')} 친구에게 주었어요. 지금 남은 사탕은 몇 개일까요?`);
    const steps = [
      f4Step(N, a, b, `먼저 ${N}의 ${a}/${b}${P_(`${a}/${b}`, '을', '를')} 구해요. 먹은 사탕이에요.`),
      calcStep('처음 사탕에서 먹은 사탕을 빼요.', '−', W(N), W(eat), 'W'),
      pickStep(`친구에게 준 사탕은 무엇의 ${c}/${e}일까요?`, '무엇의 몇 분의 몇?', [
        { t: `남은 사탕 ${M}개의 ${c}/${e}`, right: true }, { t: `처음 사탕 ${N}개의 ${c}/${e}`, name: '처음 전체를 기준으로 봄' }], r),
      f4Step(M, c, e, `${M}의 ${c}/${e}${P_(`${c}/${e}`, '을', '를')} 구해요. 친구에게 준 사탕이에요.`),
      calcStep('남은 사탕에서 친구에게 준 사탕을 빼요.', '−', W(M), W(give), 'W'),
    ];
    const bugs = [{ x: W(N - eat - (N / e) * c), name: '처음 전체를 기준으로 봄' }, { x: W(M), name: '한 번만 뺌' }, { x: W(give), name: '준 사탕 수를 답함' }];
    return { story, item: answerItem('답 ', W(A), 'W', '개', bugs.filter((x) => x.x.n > 0)), x: W(A), steps, p: { kind } };
  }
  if (kind === 'frac') {
    const p = until(r, (r) => ({ a: frc(r, 3, 7), c: frc(r, 2, 6) }), () => true);
    const left = ar('−', W(1), p.a), give = ar('×', left, p.c), A = ar('−', left, give);
    const T = r.pick(PART_THINGS);
    const pp = (x) => (T.p === '로' ? ro(x, 'F') : T.p);
    const story = S(`${T.all}의 `, tok(p.a, 'F'), `${pp(p.a)} ${T.a}, ${T.left.startsWith('남은') ? T.left : '남은 ' + T.all}의 `, tok(p.c, 'F'), `${pp(p.c)} ${T.b}. ${T.left}${P_(T.left, '은', '는')} ${T.first}의 몇 분의 몇일까요?`);
    const steps = [
      calcStep(`${T.first}${P_(T.first, '을', '를')} 1로 봐요. 처음에 쓰고 남은 것은 1에서 ${txt(p.a, 'F')}${P_(txt(p.a, 'F'), '을', '를')} 뺀 만큼이에요.`, '−', W(1), p.a, 'F'),
      pickStep(`두 번째로 쓴 것은 무엇의 ${txt(p.c, 'F')}일까요?`, '무엇의 몇 분의 몇?', [
        { t: S('남은 것(', tok(left, 'F'), ')의 ', tok(p.c, 'F')), right: true }, { t: S('처음 전체(1)의 ', tok(p.c, 'F')), name: '처음 전체를 기준으로 봄' }], r),
      calcStep('남은 것의 몇 분의 몇은 곱셈으로 구해요.', '×', left, p.c, 'F'),
      calcStep('남은 것에서 두 번째로 쓴 것을 빼요.', '−', left, give, 'F'),
    ];
    const wrong = ar('−', left, p.c);
    const bugs = [...(wrong.n > 0 ? [{ x: wrong, name: '처음 전체를 기준으로 봄' }] : []), { x: left, name: '한 번만 뺌' }, { x: give, name: '두 번째로 쓴 양을 답함' }];
    return { story, item: answerItem('답 ', A, 'F', '', bugs), x: A, steps, p: { kind } };
  }
  if (kind === 'sharew') {   // 남은 양 나누기의 쉬운 판 — 사탕 N개의 a/b를 먹고 남은 것을 k명이 똑같이
    const p = until(r, (r) => { const b = r.int(2, 5), a = r.int(1, b - 1), k = r.int(2, 5); return { a, b, k, N: b * k * r.int(1, 4) }; }, (p) => gcd(p.a, p.b) === 1 && p.N <= 80 && p.N >= 12);
    const { a, b, k, N } = p, eat = (N / b) * a, M = N - eat, A = M / k;
    const story = S(`사탕이 ${N}개 있어요. 그중에서 `, { f: [a, b] }, `${P_(`${a}/${b}`, '을', '를')} 먹고, 남은 사탕을 ${k}명이 똑같이 나누어 가졌어요. 한 명이 가진 사탕은 몇 개일까요?`);
    const steps = [
      f4Step(N, a, b, `먼저 ${N}의 ${a}/${b}${P_(`${a}/${b}`, '을', '를')} 구해요. 먹은 사탕이에요.`),
      calcStep('처음 사탕에서 먹은 사탕을 빼요.', '−', W(N), W(eat), 'W'),
      pickStep(`${k}명이 똑같이 나누는 것은 어떤 사탕일까요?`, '나누는 식은?', [
        { t: `${M} ÷ ${k}`, right: true }, { t: `${N} ÷ ${k}`, name: '처음 전체를 나눔' }, { t: `${M} × ${k}`, name: '나누지 않고 곱함' }], r),
      calcStep(`남은 사탕을 ${k}명이 똑같이 나눠요.`, '÷', W(M), W(k), 'W'),
    ];
    const bugs = [{ x: W(N / k), name: '처음 전체를 나눔' }, { x: W(M), name: '나누지 않음' }];
    return { story, item: answerItem('답 ', W(A), 'W', '개', bugs.filter((x) => whole(x.x))), x: W(A), steps, p: { kind } };
  }
  // share — 주스 m L 의 a 를 마시고 남은 것을 k 명이 똑같이
  const p = until(r, (r) => ({ m: r.int(2, 6), a: frc(r, 2, 6), k: r.int(2, 5) }), (p) => !whole(ar('÷', ar('×', W(p.m), ar('−', W(1), p.a)), W(p.k))) && !whole(ar('×', W(p.m), p.a)));
  const drink = ar('×', W(p.m), p.a), left = ar('−', W(p.m), drink), A = ar('÷', left, W(p.k));
  const story = S(`주스 ${p.m} L 중에서 `, tok(p.a, 'F'), `${pj(p.a, 'F', '을', '를')} 마시고, 남은 주스를 ${p.k}명이 똑같이 나누어 마셨어요. 한 명이 마신 주스는 몇 L일까요?`);
  const steps = [
    calcStep(`먼저 마신 주스는 ${p.m} L의 ${ye(txt(p.a, 'F'))}.`, '×', W(p.m), p.a, 'F'),
    calcStep('처음 주스에서 마신 주스를 빼요.', '−', W(p.m), drink, 'F'),
    pickStep(`${p.k}명이 똑같이 나누는 것은 어떤 주스일까요?`, '나누는 식은?', [
      { t: S(tok(left, 'F'), ` ÷ ${p.k}`), right: true }, { t: `${p.m} ÷ ${p.k}`, name: '처음 전체를 나눔' }, { t: S(tok(left, 'F'), ` × ${p.k}`), name: '나누지 않고 곱함' }], r),
    calcStep(`남은 주스를 ${p.k}명이 똑같이 나눠요.`, '÷', left, W(p.k), 'F'),
  ];
  const bugs = [{ x: ar('÷', W(p.m), W(p.k)), name: '처음 전체를 나눔' }, { x: left, name: '나누지 않음' }, { x: ar('÷', drink, W(p.k)), name: '마신 주스를 나눔' }];
  return { story, item: answerItem('답 ', A, 'F', ' L', bugs), x: A, steps, p: { kind } };
}

// ───────────────────────────── 목록 ─────────────────────────────
//   name 층 이름(아이) · idea 하는 법 한 줄(아이) · tip 가르치는 법(선생님) · units 단원 → 숫자 영역 · easy 쉬운 숫자(자연수)
export const TYPES = {
  INV: {
    id: 'INV', name: '어떤 수 구하기', short: '어떤 수',
    idea: '잘못한 계산을 □가 있는 식으로 쓰고, 거꾸로 계산해 어떤 수를 구한 뒤, 바르게 다시 계산해요.',
    tip: "잘못한 계산을 □ 식으로 먼저 쓰게 해요(□ − 18 = 25). '어떤 수 구하기'와 '바르게 계산하기'가 두 단계라는 것을 말로 정리해요. 분수 · 소수 단원에서는 같은 문제를 작은 자연수로 바꿔 먼저 풀게 해요.",
    units: INV_SPECS, make: invMake, easy: (inst) => ({ st: 'W', max: 999, gen: INV_EASY([inst.p.good, inst.p.bad]) }),
  },
  RANGE: {
    id: 'RANGE', name: '□ 안에 들어갈 수', short: '□ 범위',
    idea: '먼저 =가 되는 수를 구하고, < · > 이면 그 수보다 커야 하는지 작아야 하는지 따져요. 경계의 수는 들어가지 않아요.',
    tip: '등호(=)가 되는 수를 먼저 구하고 수직선에 표시하게 해요. "경계의 수도 넣음"이 가장 흔한 실수예요. 빼는 수가 □일 때(73 − □ > 25)는 □가 커질수록 결과가 작아진다는 것을 수 몇 개로 확인해요.',
    units: RANGE_SPECS, make: rangeMake, easy: () => ({ st: 'W', gen: RANGE_EASY }),
  },
  CARD: {
    id: 'CARD', name: '수 카드로 가장 큰 값', short: '수 카드',
    idea: '높은 자리에 큰 숫자를 놓아요. 곱셈 · 나눗셈은 어림해서 몇 가지를 견주어 봐요.',
    tip: '카드를 실제로 옮겨 보며 두세 가지 식을 어림으로 견주게 해요. "큰 숫자를 한 수에 몰아 놓기"(96 × 85보다 95 × 86이 큼)와 0을 맨 앞에 놓는 실수를 짚어요. 분수의 나눗셈에서는 나누는 수가 작을수록 몫이 커진다는 것이 핵심이에요.',
    units: CARD_SPECS, make: cardMake, easy: (inst) => ({ st: 'W', kind: inst.p.kind === 'fdiv' ? 'd21' : 'bs3' }),
  },
  OVL: {
    id: 'OVL', name: '테이프 이어 붙이기', short: '이어 붙이기',
    idea: '겹친 부분은 두 테이프에 모두 들어 있어요. 길이를 모두 더한 뒤 겹친 길이를 빼요. 여러 장이면 겹친 곳은 장 수보다 하나 적어요.',
    tip: '종이띠 두세 장을 실제로 겹쳐 붙여 보게 해요. "겹친 곳 = 장 수 − 1"을 그림으로 확인하고, 분수 · 소수 길이에서도 식은 같다는 것을 짚어요.',
    units: OVL_SPECS, make: ovlMake, easy: () => ({ st: 'W', unit: 'cm', gen: OVL_EASY }),
  },
  GAP: {
    id: 'GAP', name: '일정한 간격 (나무 심기)', short: '간격',
    idea: '간격 수를 먼저 구해요. 길의 처음과 끝에 모두 심으면 나무는 간격보다 1 많고, 둥글게 놓으면 같고, 자르는 횟수는 도막보다 1 적어요.',
    tip: '손가락 다섯 개 사이의 틈이 네 개라는 것으로 시작해요. 길(양 끝) · 둥근 연못 · 끈 자르기 세 가지를 나란히 놓고 ±1이 왜 달라지는지 그림으로 견주게 해요.',
    units: GAP_SPECS, make: gapMake, easy: () => ({ st: 'W', ask: 'count', gen: GAP_EASY }),
  },
  SUMDIF: {
    id: 'SUMDIF', name: '합과 차로 두 수', short: '합 · 차',
    idea: '많은 쪽에서 더 많은 만큼을 빼면 두 수가 같아져요. 그걸 2로 나누면 적은 쪽이에요.',
    tip: '막대 두 개(긴 막대 = 짧은 막대 + 차)를 그려 "차만큼 잘라 내면 같은 막대 두 개"를 보여 줘요. 합을 반으로만 나누는 실수가 가장 흔해요.',
    units: SUMDIF_SPECS, make: sumdifMake, easy: () => ({ st: 'W', gen: SUMDIF_EASY }),
  },
  PART: {
    id: 'PART', name: '남은 양 구하기', short: '남은 양',
    idea: '"남은 것의 몇 분의 몇"은 처음 전체가 아니라 남은 것을 기준으로 해요. 한 번에 하나씩 빼요.',
    tip: '띠 그림을 두 번 나눠 그리게 해요(전체를 먼저 나누고, 남은 부분을 다시 나눔). "처음 전체를 기준으로 봄"이 가장 흔한 실수예요.',
    units: PART_SPECS, make: partMake, easy: (inst) => ({ st: 'W', kind: inst.p.kind === 'share' ? 'sharew' : 'count' }),
  },
};
// 단원 → 도전 층(틀) 순서 — 문제집에서 그 단원에 자주 나오는 것 · 단원마다 셋까지
export const UNIT_TYPES = {
  '2-1-3': ['INV', 'RANGE'],
  '3-1-1': ['INV', 'OVL', 'CARD'],
  '3-1-3': ['INV', 'GAP'],
  '3-1-4': ['INV', 'OVL', 'CARD'],
  '3-2-1': ['INV', 'GAP', 'CARD'],
  '3-2-2': ['INV', 'GAP', 'SUMDIF'],
  '3-2-4': ['PART'],
  '4-1-3': ['INV', 'CARD'],
  '4-2-1': ['INV', 'OVL'],
  '4-2-3': ['INV', 'OVL'],
  '5-1-1': ['RANGE'],
  '5-1-5': ['INV', 'OVL'],
  '5-2-2': ['INV', 'PART'],
  '5-2-4': ['INV', 'GAP'],
  '6-1-1': ['INV', 'PART'],
  '6-1-3': ['INV', 'GAP'],
  '6-2-1': ['INV', 'CARD'],
  '6-2-2': ['INV', 'GAP'],
};
export { okStep, expr, F };
