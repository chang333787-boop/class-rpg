// 선생님이 입력한 문제 글 → { c: 개념 id, p: 숫자들 }
// 예) "3/4 ÷ 2/5", "3 : 4 = □ : 12", "58 × 37", "12와 18의 최대공약수", "35를 3 : 4로 비례배분"
import { gcd, lcm } from './math.js';
import { byId, makeItem } from './concepts/index.js';
import { tbl } from './concepts/kit.js';

export const EXAMPLES = [
  '3 : 4 = □ : 12', '35를 3 : 4로 비례배분', '3/4 ÷ 2/5', '6/7 ÷ 2/7', '6 ÷ 3/4', '2/3 × 4/5', '12 × 2/3',
  '1/2 + 1/3', '3/4, 5/6 통분', '12/18 약분', '12와 18의 최대공약수', '4와 6의 최소공배수',
  '58 × 37', '47 × 6', '72 ÷ 3', '17 ÷ 5', '42 ÷ 7', '61 − 27', '38 + 47', '8 + 5', '2/5 + 1/5', '12의 2/3', '17/20 백분율',
];

function norm(s) {
  return String(s || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s*나누기\s*/g, ' ÷ ').replace(/\s*곱하기\s*/g, ' × ').replace(/\s*더하기\s*/g, ' + ').replace(/\s*빼기\s*/g, ' − ')
    .replace(/[＋]/g, '+').replace(/[－–—-]/g, '−').replace(/[x*X✕]/g, '×').replace(/[：]/g, ':')
    .replace(/[ㅁ?？○◯_]|\(\s*\)/g, '□')
    .replace(/(\d)\s*와\s*(\d+\s*\/\s*\d+)/g, '$1 $2')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

// 수 하나 읽기
const NUM = /(\d+ \d+\/\d+|\d+\/\d+|\d+\.\d+|\d+|□)/g;
function val(t) {
  if (t === '□') return { k: 'box' };
  let m = t.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return { k: 'mixed', w: +m[1], n: +m[2], d: +m[3], N: +m[1] * +m[3] + +m[2] };
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return { k: 'frac', n: +m[1], d: +m[2] };
  if (t.includes('.')) return { k: 'dec', v: Number(t), h: Math.round(Number(t) * 100) };
  return { k: 'int', v: Number(t) };
}
const nums = (s) => (s.match(NUM) || []).map(val);
const asFrac = (x) => (x.k === 'mixed' ? { k: 'frac', n: x.N, d: x.d, mix: true } : x);
const isF = (x) => x.k === 'frac' || x.k === 'mixed';
const ok = (c, p, note) => {
  try { makeItem(c, p); } catch (e) { return { error: '이 숫자로는 문제를 만들 수 없어요.' }; }
  return { c, p, label: byId[c].name, note };
};

function intOp(a, op, b) {
  if (op === '+') {
    if (a < 10 && b < 10) return a + b <= 9 ? ok('A1', { a, b }) : ok('A3', { a, b });
    if (a < 100 && b < 100) return ok('A5', { a, b });
    return ok('A8', { op: '+', a, b });
  }
  if (op === '−') {
    if (b > a) return { error: '빼는 수가 더 커요.' };
    if (a <= 10 && b < 10) return ok('A2', { a, b });
    if (a < 20 && b < 10) return a % 10 < b ? ok('A4', { a, b }) : ok('A2', { a, b });
    if (a < 100) return ok('A6', { a, b });
    return ok('A8', { op: '-', a, b });
  }
  if (op === '×') {
    if (a < 10 && b >= 10) [a, b] = [b, a];
    if (a < 10 && b < 10) return ok(tbl(a), { a, b });
    if (a % 10 === 0 && a < 100 && b < 10) return ok('M7', { t: a, b });
    if (a < 100 && b < 10) return ok('M8', { a, b });
    if (b % 10 === 0 && b < 100) return a % 10 === 0 && a < 100 ? ok('M9', { v: 'tt', a, t: b }) : ok('M9', { v: 'mt', a, t: b });
    if (a % 10 === 0 && a < 100) return ok('M9', { v: 'mt', a: b, t: a });
    return ok('M10', { a, b });
  }
  if (op === '÷') {
    if (b === 0) return { error: '0으로 나눌 수 없어요.' };
    if (a < b) return ok('F16', { v: 'small', a, b }, '몫이 1보다 작아 분수로 나타내는 문제로 봤어요.');
    const q = Math.floor(a / b), x = a % b;
    if (x === 0) {
      if (b < 10 && q < 10) return ok('D4', { d: b, q });
      if (b < 10 && a < 100) return ok('D6', { d: b, qt: Math.floor(q / 10), qo: q % 10 });
      if (b >= 10 && a < 1000) return ok('D7', { dv: b, q });
      return { error: '아직 이 크기의 나눗셈은 다루지 않아요.' };
    }
    if (b < 10) return ok('D5', { d: b, q, x });
    return { error: '나머지가 있는 두 자리 수 나눗셈은 아직 다루지 않아요.' };
  }
  return null;
}

function fracOp(x, op, y) {
  if (op === '+' || op === '−') {
    const A = asFrac(x), Bf = asFrac(y);
    if (!isF(A) || !isF(Bf)) return { error: '분수와 자연수의 덧셈·뺄셈은 아직 다루지 않아요.' };
    const o = op === '+' ? '+' : '-';
    if (o === '-' && A.n * Bf.d < Bf.n * A.d) return { error: '빼는 수가 더 커요.' };
    if (A.d === Bf.d) return ok('F6', { op: o, a: A.n, b: Bf.n, d: A.d });
    return ok('F12', { op: o, n1: A.n, d1: A.d, n2: Bf.n, d2: Bf.d, mix1: A.mix, mix2: Bf.mix });
  }
  if (op === '×') {
    if (x.k === 'int' && isF(y)) { const f = asFrac(y); return ok('F14', { N: x.v, n: f.n, d: f.d, mix: f.mix }); }
    if (isF(x) && y.k === 'int') { const f = asFrac(x); return ok('F13', { n: f.n, d: f.d, k: y.v, mix: f.mix }); }
    const A = asFrac(x), Bf = asFrac(y);
    if (A.n === 1 && Bf.n === 1) return ok('F15a', { a: A.d, b: Bf.d });
    return ok('F15', { n1: A.n, d1: A.d, n2: Bf.n, d2: Bf.d, mix1: A.mix, mix2: Bf.mix });
  }
  if (op === '÷') {
    if (isF(x) && y.k === 'int') { const f = asFrac(x); return ok('F17', { n: f.n, d: f.d, k: y.v, mix: f.mix }); }
    if (x.k === 'int' && isF(y)) { const f = asFrac(y); return x.v === 1 ? ok('F21', { v: 'one', n: f.n, d: f.d, mix: f.mix }) : ok('F21', { v: 'n', N: x.v, n: f.n, d: f.d, mix: f.mix }); }
    const A = asFrac(x), Bf = asFrac(y);
    if (A.d === Bf.d) return ok('F18', { a: A.n, b: Bf.n, d: A.d, mix1: A.mix, mix2: Bf.mix });
    return ok('F19', { n1: A.n, d1: A.d, n2: Bf.n, d2: Bf.d, mix1: A.mix, mix2: Bf.mix });
  }
  return null;
}

export function parseProblem(input) {
  const s = norm(input);
  if (!s) return { error: '문제를 입력해 주세요.' };
  const ns = nums(s);
  const ints = ns.filter((x) => x.k === 'int').map((x) => x.v);

  // 1) 낱말이 있는 문제
  if (/최대공약수/.test(s) && ints.length >= 2) return ok('G3', { a: ints[0], b: ints[1] });
  if (/최소공배수/.test(s) && ints.length >= 2) return ok('G4', { a: ints[0], b: ints[1] });
  if (/약수/.test(s) && ints.length === 1) return ok('G1', { v: 'count', n: ints[0] });
  if (/배수/.test(s) && ints.length === 1) return ok('G2', { v: 'seq', n: ints[0] });
  if (/통분/.test(s) && ns.filter(isF).length === 2) {
    const [a, b] = ns.filter(isF).map(asFrac);
    if (a.d === b.d) return { error: '이미 분모가 같아요.' };
    return ok('F9', { v: 'given', n1: a.n, d1: a.d, n2: b.n, d2: b.d });
  }
  if (/약분|기약/.test(s) && ns.length === 1 && ns[0].k === 'frac') {
    const { n, d } = ns[0], g = gcd(n, d);
    if (g === 1) return { error: '이미 기약분수예요.' };
    return ok('F8', { n: n / g, d: d / g, k: g });
  }
  if (/비례배분|나누면|나누어|나누기/.test(s) && /:/.test(s) && ints.length === 3) {
    const [N, a, b] = ints;
    return ok('R10', { a, b, N });
  }
  if (/간단|자연수의 비/.test(s) && /:/.test(s)) {
    if (ns.length === 2 && ns.every((x) => x.k === 'int')) {
      const [a, b] = ints, g = gcd(a, b);
      if (g === 1) return { error: '이미 간단한 자연수의 비예요.' };
      return ok('R7', { v: 'int', a: a / g, b: b / g, k: g });
    }
    if (ns.length === 2 && ns.every((x) => x.k === 'dec')) {
      const a = Math.round(ns[0].v * 10), b = Math.round(ns[1].v * 10), g = gcd(a, b);
      if (Math.abs(ns[0].v * 10 - a) > 1e-9) return { error: '소수 한 자리 비만 다뤄요.' };
      return ok('R7', { v: 'dec', a, b }, g === 1 ? '10배 하면 바로 간단한 자연수의 비가 돼요.' : undefined);
    }
    if (ns.length === 2 && ns.every(isF)) { const [a, b] = ns.map(asFrac); return ok('R7', { v: 'frac', n1: a.n, d1: a.d, n2: b.n, d2: b.d }); }
  }
  if (/백분율|%|퍼센트/.test(s)) {
    if (ns[0] && ns[0].k === 'frac' && 100 % ns[0].d === 0) return ok('R5', { v: 'frac', n: ns[0].n, d: ns[0].d });
    if (ns[0] && ns[0].k === 'dec' && ns[0].v < 1) return ok('R5', { v: 'dec', k: ns[0].h });
  }
  if (/비율/.test(s) && /:/.test(s) && ints.length === 2) return ok('R4', { v: /소수/.test(s) ? 'dec' : 'frac', a: ints[0], b: ints[1] });
  if (/소수로/.test(s) && ns.length === 1 && ns[0].k === 'frac') {
    if (100 % ns[0].d) return { error: '분모가 10이나 100이 되는 분수만 다뤄요.' };
    return ok('F11', { n: ns[0].n, d: ns[0].d });
  }
  if (/가분수/.test(s) && ns[0] && ns[0].k === 'mixed') return ok('F5', { v: 'toImp', w: ns[0].w, n: ns[0].n, d: ns[0].d });
  if (/대분수/.test(s) && ns[0] && ns[0].k === 'frac' && ns[0].n > ns[0].d && ns[0].n % ns[0].d) return ok('F5', { v: 'toMix', w: Math.floor(ns[0].n / ns[0].d), n: ns[0].n % ns[0].d, d: ns[0].d });
  if (/몫을 분수|분수로/.test(s) && /÷/.test(s) && ints.length === 2) { const [a, b] = ints; return ok('F16', { v: a < b ? 'small' : 'big', a, b }); }
  if (/배/.test(s) && ints.length === 2 && /의/.test(s) && !/:/.test(s)) {
    const [x, y] = ints;
    if (x % y === 0) return ok('R2', { v: 'int', big: x, small: y });
    if (y % x === 0) return ok('R2', { v: 'frac', big: y, small: x });
  }
  // "12의 2/3"
  const m4 = s.match(/^(\d+)의 (\d+\/\d+)/);
  if (m4) { const f = val(m4[2]); return ok('F4', { N: +m4[1], n: f.n, d: f.d }); }

  // 2) 식
  if (/=/.test(s)) {
    const [L, R] = s.split('=').map((x) => x.trim());
    // 비례식
    if (/:/.test(L) && /:/.test(R)) {
      const l = nums(L), r = nums(R);
      if (l.length === 2 && r.length === 2) {
        let q = [...l, ...r];
        const bi = q.findIndex((x) => x.k === 'box');
        if (bi < 0 || q.filter((x) => x.k === 'box').length !== 1) return { error: '□가 하나 있는 비례식을 써 주세요.' };
        if (q.some((x) => x.k !== 'box' && x.k !== 'int')) return { error: '자연수 비례식만 다뤄요.' };
        let pos = bi;
        if (bi < 2) { q = [q[2], q[3], q[0], q[1]]; pos = bi + 2; }
        const v = q.map((x) => x.v);
        return ok('R9', { a: v[0], b: v[1], c: pos === 2 ? undefined : v[2], d: pos === 3 ? undefined : v[3], pos }, bi < 2 ? '양쪽을 바꿔 □가 오른쪽에 오게 했어요.' : undefined);
      }
    }
    const l = nums(L), r = nums(R);
    // 분수 = □/분모
    if (l.length === 1 && isF(l[0]) && /□\/\d+|\d+\/□/.test(R)) {
      const m = R.match(/□\/(\d+)/);
      if (m) {
        const D = +m[1], f = l[0];
        if (f.k === 'mixed') return D === f.d ? ok('F5', { v: 'toImp', w: f.w, n: f.n, d: f.d }) : { error: '분모가 같은 가분수로만 바꿀 수 있어요.' };
        if (D % f.d === 0) { const g = gcd(f.n, f.d); return g === 1 ? ok('F7', { v: 'up', n: f.n, d: f.d, k: D / f.d }) : ok('F7', { v: 'up', n: f.n, d: f.d, k: D / f.d }); }
        if (f.d % D === 0 && f.n % (f.d / D) === 0) return ok('F7', { v: 'down', n: f.n / (f.d / D), d: D, k: f.d / D });
        return { error: '크기가 같은 분수로 만들 수 없는 분모예요.' };
      }
    }
    // □ + a = s / a + □ = s
    const ma = s.match(/^□ ?\+ ?(\d+) ?= ?(\d+)$/), mb = s.match(/^(\d+) ?\+ ?□ ?= ?(\d+)$/);
    if (ma) return ok('A7', { a: +ma[1], s: +ma[2], left: true });
    if (mb) return ok('A7', { a: +mb[1], s: +mb[2], left: false });
    const m0 = s.match(/^(\d+) ?\+ ?(\d+) ?= ?□ ?\+ ?(\d+)$/);
    if (m0) return ok('R0', { a: +m0[1], b: +m0[2], c: +m0[3] });
  }

  // 3) 두 수 비교 ("1/3 ○ 1/5", "3/5, 4/7 중 큰 수")
  if (/[<>]|비교|큰|작은|□/.test(s) && ns.filter(isF).length === 2 && !/[+×÷−]/.test(s)) {
    const [a, b] = ns.filter(isF).map(asFrac);
    if (a.n === 1 && b.n === 1 && a.d !== b.d) return ok('F2', { a: a.d, b: b.d });
    if (a.d === b.d && a.n !== b.n) return ok('F3', { v: 'cmp', d: a.d, n: a.n, m: b.n });
    return ok('F10', { n1: a.n, d1: a.d, n2: b.n, d2: b.d });
  }

  // 4) 두 수의 계산
  const mo = s.replace(/ ?= ?□?$/, '').match(/^(\S+(?: \d+\/\d+)?) ?([+−×÷]) ?(\S+(?: \d+\/\d+)?)$/);
  if (mo) {
    const x = val(mo[1]), op = mo[2], y = val(mo[3]);
    if (x.k === 'dec' && y.k === 'int' && (op === '×' || op === '÷') && [10, 100].includes(y.v)) {
      return ok('DEC4', { v: op === '÷' ? 'd10' : y.v === 10 ? 'x10' : 'x100', k: x.h });
    }
    if (x.k === 'int' && y.k === 'int') return intOp(x.v, op, y.v) || { error: '알아보지 못했어요.' };
    if (isF(x) || isF(y)) return fracOp(x, op, y) || { error: '알아보지 못했어요.' };
  }
  return { error: '이 문제 모양은 아직 알아보지 못해요. 아래 예시처럼 써 주세요.' };
}
