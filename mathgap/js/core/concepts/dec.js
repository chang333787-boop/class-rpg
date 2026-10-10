// 소수 (3~4학년) · 약수와 배수 (5학년)
import { nums, pick, fx, B, P, J, tbl } from './kit.js';
import { near, fmt, divisors, gcd, lcm } from '../math.js';

const d2 = (k) => fmt(k / 100), d1 = (k) => fmt(k / 10);

export default [
  {
    id: 'DEC1', name: '소수 한 자리 (0.1이 몇 개)', kid: '0.1이 몇 개', g: '3-1', s: 'DEC', pre: ['F3'],
    tip: '1 cm = 10 mm 자로 0.1 cm = 1 mm를 보여 줘요. 0.7은 0.1이 7개.',
    gen: (r) => r.pick([{ v: 'count', n: r.int(2, 9) }, { v: 'frac', n: r.int(1, 9) }, { v: 'units', n: r.int(11, 49) }]),
    make: (p) => {
      if (p.v === 'count') return nums([`0.1이 ${p.n}개이면 `, B(0)], p.n / 10, { noFrac: true, bugs: [{ test: (v) => v[0] === p.n, name: '개수를 그대로 씀', to: 'F3' }, { test: (v) => near(v[0], p.n / 100), name: '0.1과 0.01을 헷갈림', to: 'F3' }] });
      if (p.v === 'frac') return nums([fx(p.n, 10), ' = ', B(0), ' (소수로)'], p.n / 10, { noFrac: true, bugs: [{ test: (v) => v[0] === p.n, name: '분자를 그대로 씀', to: 'F3' }] });
      return nums([`${d1(p.n)}${P(p.n, '은', '는')} 0.1이 `, B(0), '개예요.'], p.n, { bugs: [{ test: (v) => v[0] === p.n % 10, name: '자연수 부분을 빠뜨림', to: 'N4' }] });
    },
  },
  {
    id: 'DEC2', name: '소수 두·세 자리와 자릿값', kid: '0.01이 몇 개', g: '4-2', s: 'DEC', pre: ['DEC1', 'N5'],
    tip: '모눈 100칸 판에서 한 칸 = 0.01. 1.25 = 1 + 0.2 + 0.05로 자리마다 나눠 써요.',
    gen: (r) => r.pick([{ v: 'count', n: r.int(11, 99) }, { v: 'expand', n: r.int(101, 499) }, { v: 'units', n: r.int(11, 99) }, { v: 'frac', n: r.int(11, 99) }]),
    make: (p) => {
      if (p.v === 'count') return nums([`0.01이 ${p.n}개이면 `, B(0)], p.n / 100, { noFrac: true, bugs: [{ test: (v) => near(v[0], p.n / 10), name: '0.01을 0.1로 봄', to: 'DEC1' }] });
      if (p.v === 'expand') {
        const w = Math.floor(p.n / 100), t = Math.floor(p.n / 10) % 10, o = p.n % 10;
        return nums([`${d2(p.n)} = ${w} + ${d1(t)} + `, B(0)], o / 100, { noFrac: true, bugs: [{ test: (v) => near(v[0], o / 10), name: '자리를 하나 올림', to: 'DEC1' }, { test: (v) => v[0] === o, name: '숫자만 씀', to: 'DEC1' }] });
      }
      if (p.v === 'frac') return nums([fx(p.n, 100), ' = ', B(0), ' (소수로)'], p.n / 100, { noFrac: true, bugs: [{ test: (v) => near(v[0], p.n / 10), name: '자리를 하나 올림', to: 'DEC1' }] });
      return nums([`${d2(p.n)}${P(Number(String(d2(p.n)).slice(-1)), '은', '는')} 0.01이 `, B(0), '개예요.'], p.n, { bugs: [{ test: (v) => v[0] === Math.floor(p.n / 10), name: '0.1이 몇 개인지로 셈', to: 'DEC1' }] });
    },
  },
  {
    id: 'DEC3', name: '소수의 크기 비교', kid: '소수 비교', g: '4-2', s: 'DEC', pre: ['DEC2'],
    tip: '0.7과 0.65를 모눈판에 칠해 비교해요. 자리 수가 많다고 크지 않아요.',
    gen: (r) => { const a = r.int(2, 9), b = r.int(11, 99); return Math.floor(b / 10) === a ? { a: a * 10 + (b % 10 >= 5 ? 1 : 9), b } : { a: a * 10, b }; },
    make: (p) => {
      const A = p.a % 10 === 0 ? d1(p.a / 10) : d2(p.a), Bv = d2(p.b);
      const big = p.a > p.b ? 0 : 1;
      return pick(['더 큰 수를 고르세요.'], [[A], [Bv]], big, { bugs: { [1 - big]: { name: '자릿수가 많으면 크다고 봄 (자연수 규칙)', to: 'DEC2' } } });
    },
  },
  {
    id: 'DEC4', name: '소수의 10배·100배·1/10', kid: '소수 10배, 100배', g: '4-2', s: 'DEC', pre: ['DEC2'],
    tip: '수 카드를 자리판에서 한 칸·두 칸 옮겨요. 소수점이 움직이는 게 아니라 숫자가 자리를 옮겨요.',
    gen: (r) => ({ v: r.pick(['x10', 'x100', 'd10']), k: r.int(11, 299) }),
    make: (p) => {
      const x = p.k / 100, f = { x10: 10, x100: 100, d10: 0.1 }[p.v], lab = { x10: '10배', x100: '100배', d10: '1/10' }[p.v];
      return nums([`${d2(p.k)}의 ${lab}${p.v === 'd10' ? '은' : '는'} `, B(0)], x * f, {
        noFrac: true,
        bugs: [
          { test: (v) => p.v === 'x100' && near(v[0], x * 10), name: '10배와 100배를 헷갈림', to: 'DEC2' },
          { test: (v) => p.v !== 'd10' && near(v[0], x), name: '0을 붙이면 커진다고 봄 (자연수 규칙)', to: 'DEC2' },
          { test: (v) => p.v === 'd10' && near(v[0], x * 10), name: '1/10을 10배로 봄', to: 'DEC2' },
        ],
      });
    },
  },
  {
    id: 'G1', name: '약수', kid: '약수 찾기', g: '5-1', s: 'G', pre: (p) => ['D4', 'D5'],
    tip: '12를 직사각형 모양으로 늘어놓는 방법(1×12, 2×6, 3×4)을 모두 찾아요. 1과 자기 자신도 약수예요.',
    gen: (r) => ({ v: r.chance(0.5) ? 'count' : 'isnt', n: r.pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48]), s: r.int(0, 999) }),
    make: (p) => {
      const ds = divisors(p.n);
      if (p.v === 'count') return nums([`${p.n}의 약수는 모두 `, B(0), '개예요.'], ds.length, { bugs: [{ test: (v) => v[0] === ds.length - 1 || v[0] === ds.length - 2, name: '1이나 자기 자신을 빠뜨림', to: 'D4' }] });
      const cand = []; for (let i = 2; i < p.n; i++) if (p.n % i) cand.push(i);
      const not = cand[p.s % cand.length];
      const yes = ds.filter((x) => x > 1 && x < p.n);
      const three = [yes[p.s % yes.length], yes[(p.s + 1) % yes.length], yes[(p.s + 2) % yes.length]];
      const all = [...new Set(three)];
      while (all.length < 3) all.push(all.length === 1 ? 1 : p.n);
      const ch = [...all.slice(0, 3), not].sort((a, b) => a - b);
      return pick([`${p.n}의 약수가 아닌 것을 고르세요.`], ch.map((x) => [String(x)]), ch.indexOf(not), {});
    },
  },
  {
    id: 'G2', name: '배수', kid: '배수 찾기', g: '5-1', s: 'G', pre: (p) => [tbl(p ? p.n : 2)],
    tip: '배수는 곱셈구구의 한 단이에요. 수 배열표에 4의 배수를 색칠해요.',
    gen: (r) => ({ v: r.chance(0.6) ? 'seq' : 'is', n: r.int(3, 9), s: r.int(0, 999) }),
    make: (p) => {
      if (p.v === 'seq') return nums([`${p.n}의 배수를 작은 수부터: ${p.n}, ${p.n * 2}, `, B(0), ', ', B(1)], [p.n * 3, p.n * 4], { bugs: [{ test: (v) => v[0] === p.n * 2 + 1 || v[0] === p.n + 2, name: '배수를 1씩·2씩 늘림', to: 'M2' }] });
      const right = p.n * (3 + (p.s % 6));
      const wrong = [right + 1, right - 2, right + p.n - 1].filter((x) => x % p.n !== 0);
      const ch = [right, ...wrong.slice(0, 3)].sort((a, b) => a - b);
      return pick([`${p.n}의 배수를 고르세요.`], ch.map((x) => [String(x)]), ch.indexOf(right), {});
    },
  },
  {
    id: 'G3', name: '최대공약수', kid: '최대공약수', g: '5-1', s: 'G', pre: ['G1'],
    tip: '두 수의 약수를 나란히 쓰고 겹치는 것에 동그라미 → 그중 가장 큰 수.',
    gen: (r) => { let g, x, y; do { g = r.int(2, 9); x = r.int(1, 6); y = r.int(2, 7); } while (x === y || gcd(x, y) !== 1 || g * x > 60 || g * y > 60); return { a: g * x, b: g * y }; },
    make: (p) => {
      const g = gcd(p.a, p.b);
      return nums([`${p.a}, ${p.b}의 최대공약수는 `, B(0)], g, {
        bugs: [
          { test: (v) => v[0] < g && g % v[0] === 0, name: '공약수지만 가장 크지 않음', to: 'G1' },
          { test: (v) => v[0] === lcm(p.a, p.b), name: '최소공배수와 헷갈림', to: 'G1' },
        ],
      });
    },
    steps: (p) => [
      { c: 'G1', p: { v: 'count', n: p.a }, why: `${p.a}의 약수를 모두 찾아요.` },
      { c: 'G1', p: { v: 'count', n: p.b }, why: `${p.b}의 약수를 모두 찾아요.` },
    ],
  },
  {
    id: 'G4', name: '최소공배수', kid: '최소공배수', g: '5-1', s: 'G', pre: ['G2'],
    tip: '두 수의 배수를 나란히 쓰다 처음 만나는 수예요. 두 수를 곱한 수가 언제나 최소는 아니에요.',
    gen: (r) => { let a, b; do { a = r.int(2, 12); b = r.int(2, 12); } while (a === b || lcm(a, b) > 72 || (r.chance(0.7) && gcd(a, b) === 1)); return { a, b }; },
    make: (p) => {
      const L = lcm(p.a, p.b);
      return nums([`${p.a}, ${p.b}의 최소공배수는 `, B(0)], L, {
        bugs: [
          { test: (v) => v[0] === p.a * p.b && p.a * p.b !== L, name: '두 수를 곱함', to: 'G2' },
          { test: (v) => v[0] === gcd(p.a, p.b), name: '최대공약수와 헷갈림', to: 'G3' },
          { test: (v) => v[0] > L && v[0] % L === 0, name: '공배수지만 가장 작지 않음', to: 'G2' },
        ],
      });
    },
    steps: (p) => [
      { c: 'G2', p: { v: 'seq', n: p.a }, why: `${p.a}의 배수를 늘어놓아요.` },
      { c: 'G2', p: { v: 'seq', n: p.b }, why: `${p.b}의 배수를 늘어놓아요.` },
    ],
  },
];
