// 분수 (3~6학년)
import { nums, frac, pick, fx, fb, B, P, J, RO, tbl, F, gcd } from './kit.js';
import { lcm, eqv, mul, div, near, isSimplest } from '../math.js';
import { toText, bar, pie } from '../tokens.js';

// 입력이 대분수였으면 대분수로 보여 준다
const FX = (n, d, mix) => (mix && n > d && n % d ? { m: [Math.floor(n / d), n % d, d] } : fx(n, d));
const cop = (r, d) => { let n; do { n = r.int(1, d - 1); } while (gcd(n, d) !== 1); return n; };
// 분모가 다른 두 진분수 (통분 문제용)
function pair(r, maxL = 36, wantShared = 0.7) {
  let d1, d2, L;
  do {
    d1 = r.int(2, 9); d2 = r.int(2, 9); L = lcm(d1, d2);
  } while (d1 === d2 || L > maxL || L === Math.max(d1, d2) && r.chance(0.6) || (r.chance(wantShared) && gcd(d1, d2) === 1));
  return { n1: cop(r, d1), d1, n2: cop(r, d2), d2, L };
}

export default [
  {
    id: 'F1', name: '똑같이 나눈 것 중 몇 (분수)', kid: '분수 읽기', g: '3-1', s: 'F', pre: ['D1'],
    tip: '종이띠·원을 직접 접어 똑같이 나누고, "전체를 4로 똑같이 나눈 것 중 3"을 3/4로 써요. 똑같지 않게 나눈 것과 비교해요.',
    gen: (r) => { const d = r.int(2, 8); return { d, n: r.int(1, d - 1), shape: r.pick(['bar', 'pie']) }; },
    make: (p) => frac([{ svg: p.shape === 'pie' ? pie(p.d, p.n) : bar(p.d, p.n) }, '색칠한 부분은 전체의 ', fb(0, 1)], F(p.n, p.d), {
      bugs: [
        { test: (v) => v[0] === p.n && v[1] === p.d - p.n, name: '색칠한 칸 ÷ 안 칠한 칸', to: 'D1' },
        { test: (v) => v[0] === p.d && v[1] === p.n, name: '분모와 분자를 바꿈', to: null },
      ],
    }),
  },
  {
    id: 'F2', name: '단위분수의 크기 비교', kid: '1/몇 끼리 비교', g: '3-1', s: 'F', pre: ['F1'],
    tip: '같은 종이띠를 2, 3, 5조각으로 잘라 한 조각끼리 대 봐요. 많이 나눌수록 한 조각은 작아요.',
    gen: (r) => { let a, b; do { a = r.int(2, 9); b = r.int(2, 9); } while (a === b); return { a, b }; },
    make: (p) => pick(['더 큰 수를 고르세요.'], [[fx(1, p.a)], [fx(1, p.b)]], p.a < p.b ? 0 : 1, {
      bugs: { [p.a < p.b ? 1 : 0]: { name: '분모가 클수록 크다고 봄 (자연수 규칙)', to: 'F1' } },
    }),
  },
  {
    id: 'F3', name: '분모가 같은 분수 = 단위분수 몇 개', kid: '1/몇이 몇 개', g: '3-1', s: 'F', pre: ['F1'],
    tip: '"3/5는 1/5이 3개"를 수 막대로 세어요. 4학년 분수의 덧셈, 6학년 분수의 나눗셈까지 쓰이는 생각이에요.',
    gen: (r) => { const d = r.int(3, 9), v = r.pick(['count', 'build', 'cmp']); let n = r.int(2, d - 1), m; do { m = r.int(1, d - 1); } while (m === n); return { v, d, n, m }; },
    make: (p) => {
      if (p.v === 'count') return nums([fx(p.n, p.d), `${P(p.n, '은', '는')} `, fx(1, p.d), '이 ', B(0), '개예요.'], p.n, { bugs: [{ test: (v) => v[0] === p.d, name: '분모를 셈', to: 'F1' }] });
      if (p.v === 'build') return frac([fx(1, p.d), `이 ${p.n}개이면 `, fb(0, 1)], F(p.n, p.d), { bugs: [{ test: (v) => v[0] === p.n && v[1] === p.d * p.n, name: '분모도 곱함', to: 'F1' }, { test: (v) => v[0] === 1 && v[1] === p.d * p.n, name: '분모도 곱함', to: 'F1' }] });
      if (p.v === 'whole') return nums([`${p.w}${P(p.w, '은', '는')} `, fx(1, p.d), '이 ', B(0), '개예요.'], p.w * p.d, { bugs: [{ test: (v) => v[0] === p.w, name: '자연수를 단위분수로 못 봄', to: 'F1' }] });
      return pick(['더 큰 수를 고르세요.'], [[fx(p.n, p.d)], [fx(p.m, p.d)]], p.n > p.m ? 0 : 1, { bugs: { [p.n > p.m ? 1 : 0]: { name: '분자가 작은 쪽을 고름', to: 'F1' } } });
    },
  },
  {
    id: 'F4', name: '분수만큼은 얼마', kid: '몇의 몇 분의 몇', g: '3-2', s: 'F', pre: ['F1', 'D4'],
    tip: '사과 12개를 3묶음으로 나눠 놓고 "2묶음"을 가리켜요. 12의 2/3 = 12 ÷ 3 × 2.',
    gen: (r) => { const d = r.int(2, 6); return { d, n: r.int(1, d - 1), N: d * r.int(2, 6) }; },
    make: (p) => {
      const tok = [`${p.N}의 `, fx(p.n, p.d), `${P(p.n, '은', '는')} `];
      if (p.N % p.d) return frac([...tok, fb(0, 1)], F(p.N * p.n, p.d), { bugs: [{ test: (v) => eqv(F(v[0], v[1] || 1), F(p.N * p.d, p.n)), name: '분모·분자를 거꾸로', to: 'F1' }] });
      const k = p.N / p.d;
      return nums([...tok, B(0)], k * p.n, {
        bugs: [
          { test: (v) => p.n > 1 && p.N % p.n === 0 && v[0] === p.N / p.n, name: '분자로 나눔', to: 'F1' },
          { test: (v) => p.n > 1 && v[0] === k, name: '1/몇만큼만 구함', to: 'F3' },
        ],
      });
    },
    steps: (p) => {
      if (p.N % p.d) return [];
      const k = p.N / p.d, out = [];
      if (p.d <= 9 && k <= 9) out.push({ c: 'D4', p: { d: p.d, q: k }, why: `${J(p.N, '을', '를')} ${p.d}묶음으로 똑같이 나누면 한 묶음이에요.` });
      if (p.n > 1 && k <= 9) out.push({ c: tbl(k), p: { a: k, b: p.n }, why: `그 묶음 ${p.n}개예요.` });
      return out;
    },
  },
  {
    id: 'F5', name: '대분수와 가분수', kid: '대분수 ↔ 가분수', g: '3-2', s: 'F', pre: (p) => ['F3', tbl(p ? p.d : 2)],
    tip: '2 1/3은 1/3이 몇 개인지 수 막대로 세요: 1 = 3/3이니까 2 = 6/3, 더하기 1/3.',
    gen: (r) => { const d = r.int(2, 9); return { v: r.chance(0.5) ? 'toImp' : 'toMix', w: r.int(1, 4), n: r.int(1, d - 1), d }; },
    make: (p) => p.v === 'toImp'
      ? nums([{ m: [p.w, p.n, p.d] }, ' = ', { f: [B(0), p.d] }], p.w * p.d + p.n, { bugs: [{ test: (v) => v[0] === p.w + p.n, name: '자연수와 분자를 더함', to: 'F3' }, { test: (v) => v[0] === p.w * p.n, name: '자연수와 분자를 곱함', to: 'F3' }] })
      : nums([fx(p.w * p.d + p.n, p.d), ' = ', { m: [B(0), B(1), p.d] }], [p.w, p.n], { bugs: [{ test: (v) => v[0] === p.n && v[1] === p.w, name: '자연수와 분자 자리를 바꿈', to: 'D5' }] }),
    steps: (p) => p.v === 'toImp'
      ? [{ c: 'F3', p: { v: 'whole', w: p.w, d: p.d }, why: `${p.w}${P(p.w, '을', '를')} 1/${p.d}의 개수로 봐요.` }, { c: 'F6', p: { op: '+', a: p.w * p.d, b: p.n, d: p.d }, why: '거기에 분수 부분을 더해요.' }]
      : [{ c: 'D5', p: { d: p.d, q: p.w, x: p.n }, why: `${p.w * p.d + p.n} 안에 ${p.d}${P(p.d, '이', '가')} 몇 번 들어가는지 봐요.` }],
  },
  {
    id: 'F6', name: '분모가 같은 분수의 덧셈과 뺄셈', kid: '분모가 같은 분수 더하기', g: '4-2', s: 'F', pre: ['F3', 'A1'],
    tip: '"2/5 + 1/5 = 1/5이 2개 + 1/5이 1개 = 1/5이 3개". 분모는 무엇으로 셌는지 알려 주는 이름이라 더하지 않아요.',
    gen: (r) => { const d = r.int(3, 12); if (r.chance(0.6)) { const a = r.int(1, d - 2); return { op: '+', a, b: r.int(1, d - 1 - a), d }; } const a = r.int(2, d - 1); return { op: '-', a, b: r.int(1, a - 1), d }; },
    make: (p) => {
      const res = p.op === '+' ? p.a + p.b : p.a - p.b;
      return frac([fx(p.a, p.d), p.op === '+' ? ' + ' : ' − ', fx(p.b, p.d), ' = ', fb(0, 1)], F(res, p.d), {
        bugs: [{ test: (v) => p.op === '+' && v[0] === p.a + p.b && v[1] === 2 * p.d, name: '분모끼리도 더함', to: 'F3' }],
      });
    },
    steps: (p) => [
      { c: 'F3', p: { v: 'count', n: p.a, d: p.d }, why: `${p.a}/${p.d}${P(p.a, '은', '는')} 1/${p.d}이 몇 개인지 봐요.` },
      { c: 'F3', p: { v: 'build', n: p.op === '+' ? p.a + p.b : p.a - p.b, d: p.d }, why: '1/몇의 개수를 다시 분수로 써요.' },
    ],
  },
  {
    id: 'F7', name: '크기가 같은 분수', kid: '크기가 같은 분수', g: '5-1', s: 'F', pre: (p) => ['F3', 'M2', tbl(p ? p.d : 2)],
    tip: '같은 길이의 띠를 1/2, 2/4, 3/6으로 접어 겹쳐요. 분모·분자에 같은 수를 "곱한다"(더하지 않는다)는 것을 띠로 확인해요.',
    gen: (r) => { const d = r.int(2, 9); return { v: r.chance(0.6) ? 'up' : 'down', d, n: cop(r, d), k: r.int(2, 5) }; },
    make: (p) => p.v === 'up'
      ? nums([fx(p.n, p.d), ' = ', { f: [B(0), p.d * p.k] }], p.n * p.k, { bugs: [{ test: (v) => v[0] === p.n + (p.d * p.k - p.d), name: '분모·분자에 같은 수를 더함 (덧셈으로 지키기)', to: 'M2' }] })
      : nums([fx(p.n * p.k, p.d * p.k), ' = ', { f: [B(0), p.d] }], p.n, { bugs: [{ test: (v) => v[0] === p.n * p.k - (p.d * p.k - p.d), name: '분모·분자에서 같은 수를 뺌 (덧셈으로 지키기)', to: 'M2' }] }),
    steps: (p) => p.v === 'up'
      ? [{ c: 'D3', p: { v: 'box', a: p.d, b: p.k }, why: `분모 ${p.d}에 몇을 곱하면 ${p.d * p.k}${P(p.d * p.k, '이', '가')} 되나요?` }, { c: tbl(p.n), p: { a: p.n, b: p.k }, why: '분자에도 같은 수를 곱해요.' }]
      : [{ c: 'D3', p: { v: 'box', a: p.d, b: p.k }, why: `${p.d * p.k}${P(p.d * p.k, '은', '는')} ${p.d}의 몇 배인가요?` }, { c: 'D4', p: { d: p.k, q: p.n }, why: '분자도 같은 수로 나눠요.' }],
  },
  {
    id: 'F8', name: '약분과 기약분수', kid: '약분하기', g: '5-1', s: 'F', pre: ['F7', 'G3'],
    tip: '분모와 분자를 최대공약수로 한 번에 나누면 기약분수예요. 공약수로 여러 번 나눠도 된다는 것도 보여 줘요.',
    gen: (r) => { let d, n, k; do { d = r.int(2, 9); n = cop(r, d); k = r.pick([2, 3, 4, 6, 8, 9]); } while (d * k > 72); return { d, n, k }; },
    make: (p) => frac([fx(p.n * p.k, p.d * p.k), `${P(p.n * p.k, '을', '를')} 기약분수로 나타내면 `, fb(0, 1)], F(p.n, p.d), {
      simplest: true,
      bugs: [{ test: () => true, name: '크기가 달라짐', to: 'F7' }],
    }),
    steps: (p) => [
      { c: 'G3', p: { a: p.n * p.k, b: p.d * p.k }, why: '분모와 분자의 최대공약수를 찾아요.' },
      { c: 'F7', p: { v: 'down', n: p.n, d: p.d, k: p.k }, why: '그 수로 분모와 분자를 나눠요.' },
    ],
  },
  {
    id: 'F9', name: '통분', kid: '분모를 같게 만들기', g: '5-1', s: 'F', pre: ['F7', 'G4'],
    tip: '두 분수를 같은 크기의 조각(공통분모)으로 다시 잘라요. 분모의 곱이나 최소공배수를 써요.',
    gen: (r) => ({ v: 'given', ...pair(r) }),
    make: (p) => {
      const L = p.L || lcm(p.d1, p.d2);
      if (p.v === 'find') {
        return {
          prompt: [fx(p.n1, p.d1), `${P(p.n1, '과', '와')} `, fx(p.n2, p.d2), `${P(p.n2, '을', '를')} 통분하면 `, fb(0, 1), ' , ', fb(2, 3)],
          ans: `${p.n1 * L / p.d1}/${L}, ${p.n2 * L / p.d2}/${L}`,
          sol: [p.n1 * L / p.d1, L, p.n2 * L / p.d2, L],
          check(v) {
            if (v.slice(0, 4).some((x) => !Number.isInteger(x)) || !v[1] || !v[3]) return { ok: false };
            if (v[1] !== v[3]) return { ok: false, bug: { name: '분모가 같지 않음', to: 'G4' } };
            const ok = eqv(F(v[0], v[1]), F(p.n1, p.d1)) && eqv(F(v[2], v[3]), F(p.n2, p.d2));
            if (ok) return { ok: true };
            if (v[0] === p.n1 && v[2] === p.n2) return { ok: false, bug: { name: '분모만 바꿈', to: 'F7' } };
            return { ok: false };
          },
        };
      }
      return nums([`분모를 ${RO(L)} 통분해요.`, { br: 1 }, fx(p.n1, p.d1), ' → ', { f: [B(0), L] }, '      ', fx(p.n2, p.d2), ' → ', { f: [B(1), L] }], [p.n1 * L / p.d1, p.n2 * L / p.d2], {
        bugs: [
          { test: (v) => v[0] === p.n1 && v[1] === p.n2, name: '분모만 바꿈', to: 'F7' },
          { test: (v) => v[0] === p.n1 + L - p.d1 || v[1] === p.n2 + L - p.d2, name: '분모·분자에 같은 수를 더함 (덧셈으로 지키기)', to: 'F7' },
        ],
      });
    },
    steps: (p) => {
      const L = p.L || lcm(p.d1, p.d2), out = [{ c: 'G4', p: { a: p.d1, b: p.d2 }, why: '두 분모의 최소공배수를 찾아요.' }];
      if (L / p.d1 > 1) out.push({ c: 'F7', p: { v: 'up', n: p.n1, d: p.d1, k: L / p.d1 }, why: `${p.n1}/${p.d1}${P(p.n1, '을', '를')} 분모 ${L}인 분수로 바꿔요.` });
      if (L / p.d2 > 1) out.push({ c: 'F7', p: { v: 'up', n: p.n2, d: p.d2, k: L / p.d2 }, why: `${p.n2}/${p.d2}${P(p.n2, '을', '를')} 분모 ${L}인 분수로 바꿔요.` });
      return out;
    },
  },
  {
    id: 'F10', name: '분모가 다른 분수의 크기 비교', kid: '분모가 다른 분수 비교', g: '5-1', s: 'F', pre: ['F9', 'F3'],
    tip: '통분해서 분자끼리 비교하거나, 1/2 같은 기준과 견주어 어림해요.',
    gen: (r) => { let q; do { q = pair(r); } while (eqv(F(q.n1, q.d1), F(q.n2, q.d2))); return q; },
    make: (p) => { const big = p.n1 * p.d2 > p.n2 * p.d1 ? 0 : 1; return pick(['더 큰 수를 고르세요.'], [[fx(p.n1, p.d1)], [fx(p.n2, p.d2)]], big, { bugs: { [1 - big]: { name: '통분하지 않고 비교', to: 'F9' } } }); },
    steps: (p) => [{ c: 'F9', p: { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 }, why: '분모를 같게 하면 분자끼리 비교할 수 있어요.' }],
  },
  {
    id: 'F11', name: '분수를 소수로', kid: '분수 ↔ 소수', g: '5-1', s: 'F', pre: ['F7', 'DEC2'],
    tip: '분모를 10이나 100으로 만드는 크기가 같은 분수를 거쳐요: 3/5 = 6/10 = 0.6.',
    gen: (r) => { const d = r.pick([2, 4, 5, 10, 20, 25, 50]); return { d, n: cop(r, d) }; },
    make: (p) => nums([fx(p.n, p.d), ' = ', B(0), ' (소수로)'], p.n / p.d, {
      noFrac: true,
      bugs: [{ test: (v) => near(v[0], Number(`0.${p.n}${p.d}`)), name: '분자와 분모를 이어 씀', to: 'F7' }, { test: (v) => near(v[0], p.d / p.n), name: '분모를 분자로 나눔', to: 'F7' }],
    }),
    steps: (p) => {
      const ten = 10 % p.d === 0, D = ten ? 10 : 100, k = D / p.d, out = [];
      if (k > 1) out.push({ c: 'F7', p: { v: 'up', n: p.n, d: p.d, k }, why: `분모를 ${D}으로 만들어요.` });
      out.push({ c: ten ? 'DEC1' : 'DEC2', p: { v: 'frac', n: p.n * k }, why: '소수로 써요.' });
      return out;
    },
  },
  {
    id: 'F12', name: '분모가 다른 분수의 덧셈과 뺄셈', kid: '분모가 다른 분수 더하기', g: '5-1', s: 'F', pre: ['F9', 'F6'],
    tip: '먼저 통분하고, 그다음은 4학년의 분모가 같은 분수 덧셈이에요. 1/2 + 1/3을 띠로 그려 2/5가 왜 안 되는지 보여 줘요.',
    gen: (r) => { let q; do { q = pair(r); } while (eqv(F(q.n1, q.d1), F(q.n2, q.d2))); const big = q.n1 * q.d2 > q.n2 * q.d1; return { ...q, op: r.chance(0.6) ? '+' : (big ? '-' : '+') }; },
    make: (p) => {
      const a = F(p.n1, p.d1), b = F(p.n2, p.d2);
      const res = p.op === '+' ? F(a.n * b.d + b.n * a.d, a.d * b.d) : F(a.n * b.d - b.n * a.d, a.d * b.d);
      return frac([FX(p.n1, p.d1, p.mix1), p.op === '+' ? ' + ' : ' − ', FX(p.n2, p.d2, p.mix2), ' = ', fb(0, 1)], res, {
        bugs: [{ test: (v) => p.op === '+' && v[0] === p.n1 + p.n2 && v[1] === p.d1 + p.d2, name: '분자끼리, 분모끼리 더함', to: 'F6' }, { test: (v) => p.op === '-' && v[0] === p.n1 - p.n2 && v[1] === Math.abs(p.d1 - p.d2), name: '분자끼리, 분모끼리 뺌', to: 'F6' }],
      });
    },
    steps: (p) => {
      const L = lcm(p.d1, p.d2);
      return [
        { c: 'F9', p: { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 }, why: '먼저 통분해요.' },
        { c: 'F6', p: { op: p.op, a: p.n1 * L / p.d1, b: p.n2 * L / p.d2, d: L }, why: '분모가 같은 분수의 계산이 돼요.' },
      ];
    },
  },
  {
    id: 'F13', name: '(분수)×(자연수)', kid: '분수 × 자연수', g: '5-2', s: 'F', pre: ['F6', 'M2'],
    tip: '2/5 × 3 = 2/5 + 2/5 + 2/5. 1/5이 2개씩 3묶음이라 1/5이 6개예요. 분모는 그대로예요.',
    gen: (r) => { const d = r.int(3, 9); return { d, n: r.int(1, d - 1), k: r.int(2, 5) }; },
    make: (p) => frac([FX(p.n, p.d, p.mix), ` × ${p.k} = `, fb(0, 1)], F(p.n * p.k, p.d), {
      bugs: [{ test: (v) => v[0] === p.n * p.k && v[1] === p.d * p.k, name: '분모에도 곱함', to: 'F6' }],
    }),
    steps: (p) => [
      { c: 'F3', p: { v: 'count', n: p.n, d: p.d }, why: `${p.n}/${p.d}${P(p.n, '은', '는')} 1/${p.d}이 몇 개?` },
      { c: tbl(p.n), p: { a: p.n, b: p.k }, why: `그것이 ${p.k}묶음이에요.` },
      { c: 'F3', p: { v: 'build', n: p.n * p.k, d: p.d }, why: '1/몇의 개수를 분수로 써요.' },
    ],
  },
  {
    id: 'F14', name: '(자연수)×(분수)', kid: '자연수 × 분수', g: '5-2', s: 'F', pre: ['F4'],
    tip: '12 × 2/3은 "12의 2/3"이에요. 3학년의 "분수만큼은 얼마"와 같은 계산이에요.',
    gen: (r) => { const d = r.int(2, 6); return { d, n: r.int(1, d - 1), N: d * r.int(2, 6) }; },
    make: (p) => {
      const tok = [`${p.N} × `, FX(p.n, p.d, p.mix), ' = '];
      if (p.N % p.d) return frac([...tok, fb(0, 1)], F(p.N * p.n, p.d), { bugs: [{ test: (v) => v[0] === p.N * p.n && v[1] === p.d * p.N, name: '분모에도 곱함', to: 'F4' }] });
      return nums([...tok, B(0)], (p.N / p.d) * p.n, {
        bugs: [
          { test: (v) => p.n > 1 && p.N % p.n === 0 && v[0] === (p.N / p.n) * p.d, name: '분모·분자를 거꾸로', to: 'F4' },
          { test: (v) => v[0] === p.N * p.n, name: '분모로 안 나눔', to: 'F4' },
        ],
      });
    },
    steps: (p) => [{ c: 'F4', p: { N: p.N, n: p.n, d: p.d }, why: `${p.N} × ${p.n}/${p.d}${P(p.n, '은', '는')} ${p.N}의 ${p.n}/${p.d}${P(p.n, '이에요', '예요')}.` }],
  },
  {
    id: 'F15a', name: '(단위분수)×(단위분수)', kid: '1/몇 × 1/몇', g: '5-2', s: 'F', pre: (p) => ['F2', tbl(p ? p.a : 2)],
    tip: '1/3 × 1/5은 "1/3의 1/5". 정사각형을 가로 3, 세로 5로 나눈 한 칸이에요(모눈 넓이).',
    gen: (r) => ({ a: r.int(2, 6), b: r.int(2, 6) }),
    make: (p) => nums([fx(1, p.a), ' × ', fx(1, p.b), ' = ', { f: [1, B(0)] }], p.a * p.b, {
      bugs: [{ test: (v) => v[0] === p.a + p.b, name: '분모끼리 더함', to: 'F2' }],
    }),
  },
  {
    id: 'F15', name: '(분수)×(분수)', kid: '분수 × 분수', g: '5-2', s: 'F', pre: ['F15a', 'F14'],
    tip: '넓이 그림(모눈)으로 분자끼리·분모끼리 곱하는 까닭을 보여 줘요. 진분수를 곱하면 작아진다는 것도 함께.',
    gen: (r) => { const d1 = r.int(2, 7), d2 = r.int(2, 7); return { n1: r.int(1, d1 - 1), d1, n2: r.int(1, d2 - 1), d2 }; },
    make: (p) => frac([FX(p.n1, p.d1, p.mix1), ' × ', FX(p.n2, p.d2, p.mix2), ' = ', fb(0, 1)], mul(F(p.n1, p.d1), F(p.n2, p.d2)), {
      bugs: [
        { test: (v) => eqv(F(v[0], v[1]), F(p.n1 * p.d2, p.d1 * p.n2)), name: '나눗셈처럼 뒤집음', to: 'F15a' },
        { test: (v) => v[0] === p.n1 * p.n2 && (v[1] === p.d1 || v[1] === p.d2), name: '분자만 곱함', to: 'F15a' },
      ],
    }),
    steps: (p) => [
      { c: 'F15a', p: { a: p.d1, b: p.d2 }, why: '먼저 1/몇 × 1/몇을 봐요.' },
      { c: tbl(p.n1), p: { a: p.n1, b: p.n2 }, why: '그 조각이 분자끼리 곱한 만큼 있어요.' },
    ],
  },
  {
    id: 'F16', name: '나눗셈의 몫을 분수로', kid: '몫을 분수로', g: '6-1', s: 'F', pre: (p) => (p && p.v === 'big' ? ['D5', 'F5'] : ['F1', 'F3']),
    tip: '1 ÷ 4 = 1/4(케이크 하나를 4명이)에서 시작해요. 3 ÷ 4는 1/4이 3개.',
    gen: (r) => {
      if (r.chance(0.5)) { let a, b; do { b = r.int(2, 9); a = r.int(1, b - 1); } while (gcd(a, b) !== 1); return { v: 'small', a, b }; }
      let a, b; do { b = r.int(2, 6); a = r.int(b + 1, 4 * b); } while (a % b === 0); return { v: 'big', a, b };
    },
    make: (p) => frac([`${p.a} ÷ ${p.b} = `, fb(0, 1)], F(p.a, p.b), {
      bugs: [
        { test: (v) => v[0] === p.b && v[1] === p.a, name: '나누는 수를 위로 씀', to: 'F1' },
        { test: (v) => p.v === 'big' && v[1] === p.a, name: '나머지를 나뉠 수로 나눔', to: 'D5' },
      ],
    }),
    steps: (p) => p.v === 'big'
      ? [{ c: 'D5', p: { d: p.b, q: Math.floor(p.a / p.b), x: p.a % p.b }, why: '몫과 나머지를 구해요.' }, { c: 'F5', p: { v: 'toImp', w: Math.floor(p.a / p.b), n: p.a % p.b, d: p.b }, why: '나머지까지 똑같이 나누면 대분수, 가분수로 바꿀 수 있어요.' }]
      : [{ c: 'F3', p: { v: 'build', n: p.a, d: p.b }, why: `1 ÷ ${p.b} = 1/${p.b}, ${p.a} ÷ ${p.b}${P(p.b, '은', '는')} 1/${p.b}이 ${p.a}개예요.` }],
  },
  {
    id: 'F17', name: '(분수)÷(자연수)', kid: '분수 ÷ 자연수', g: '6-1', s: 'F', pre: ['F7', 'F16'],
    tip: '3/4 ÷ 2: 분자 3이 2로 안 나누어지면 크기가 같은 분수 6/8로 바꿔 나눠요. × 1/2과 같다는 것도.',
    gen: (r) => {
      if (r.chance(0.5)) { let d, k, m; do { d = r.int(4, 9); k = r.int(2, 3); m = r.int(1, 3); } while (m * k >= d); return { v: 'div', d, k, n: m * k }; }
      let d, k, n; do { d = r.int(3, 9); k = r.int(2, 4); n = r.int(1, d - 1); } while (n % k === 0); return { v: 'eq', d, k, n };
    },
    make: (p) => frac([FX(p.n, p.d, p.mix), ` ÷ ${p.k} = `, fb(0, 1)], F(p.n, p.d * p.k), {
      bugs: [
        { test: (v) => v[0] === p.n && v[1] * p.k === p.d, name: '분모를 나눔', to: 'F7' },
        { test: (v) => v[0] === p.n * p.k && v[1] === p.d, name: '곱해 버림', to: 'D1' },
      ],
    }),
    steps: (p) => p.n % p.k === 0
      ? [{ c: 'D4', p: { d: p.k, q: p.n / p.k }, why: '분자를 자연수로 나눠요.' }]
      : [{ c: 'F7', p: { v: 'up', n: p.n, d: p.d, k: p.k }, why: '분자가 나누어떨어지게 크기가 같은 분수로 바꿔요.' }, { c: 'D4', p: { d: p.k, q: p.n }, why: '분자를 나눠요.' }],
  },
  {
    id: 'F18', name: '분모가 같은 (분수)÷(분수)', kid: '분모가 같은 분수끼리 나누기', g: '6-2', s: 'F', pre: (p) => ['F3', 'D2', ...(p && p.a % p.b ? ['F16'] : [])],
    tip: '6/7 ÷ 2/7는 "6/7 안에 2/7가 몇 번 들어가나"예요. 1/7이 6개 ÷ 1/7이 2개 = 6 ÷ 2. 3학년 "몇 번 덜어내기"와 같아요.',
    gen: (r) => {
      if (r.chance(0.7)) { let d, b, q; do { d = r.int(5, 13); b = r.int(1, 4); q = r.int(2, 6); } while (b * q >= d); return { a: b * q, b, d }; }
      let d, a, b; do { d = r.int(5, 13); b = r.int(2, 5); a = r.int(b + 1, d - 1); } while (a % b === 0); return { a, b, d };
    },
    make: (p) => {
      const tokens = [FX(p.a, p.d, p.mix1), ' ÷ ', FX(p.b, p.d, p.mix2), ' = '];
      if (p.a % p.b === 0) {
        return nums([...tokens, B(0)], p.a / p.b, {
          bugs: [{ test: (v) => near(v[0], p.a / p.b / p.d), name: '나누는 분수를 자연수처럼 봄', to: 'D2' }, { test: (v) => near(v[0], (p.a * p.b) / (p.d * p.d)), name: '곱해 버림', to: 'D2' }],
        });
      }
      return frac([...tokens, fb(0, 1)], F(p.a, p.b), {
        bugs: [{ test: (v) => near(v[0] / v[1], p.a / p.b / p.d), name: '나누는 분수를 자연수처럼 봄', to: 'D2' }],
      });
    },
    steps: (p) => [
      { c: 'F3', p: { v: 'count', n: p.a, d: p.d }, why: `${p.a}/${p.d}${P(p.a, '은', '는')} 1/${p.d}이 몇 개?` },
      { c: 'F3', p: { v: 'count', n: p.b, d: p.d }, why: `${p.b}/${p.d}${P(p.b, '은', '는')} 1/${p.d}이 몇 개?` },
      p.a % p.b === 0
        ? { c: 'D2', p: { d: p.b, q: p.a / p.b }, why: `${p.a} 안에 ${p.b}${P(p.b, '이', '가')} 몇 번 들어가나요?` }
        : { c: 'F16', p: { v: p.a < p.b ? 'small' : 'big', a: p.a, b: p.b }, why: '나누어떨어지지 않으면 몫을 분수로 써요.' },
    ],
    bridge: '"1/7이 6개 ÷ 1/7이 2개"로 바꿔 보는 생각이 이 개념의 다리예요.',
  },
  {
    id: 'F19', name: '분모가 다른 (분수)÷(분수)', kid: '분모가 다른 분수끼리 나누기', g: '6-2', s: 'F', pre: ['F18', 'F9', 'F16'],
    tip: '통분하면 분모가 같은 나눗셈이 돼요: 3/4 ÷ 2/5 = 15/20 ÷ 8/20 = 15 ÷ 8.',
    gen: (r) => ({ ...pair(r, 40, 0.5) }),
    make: (p) => {
      const res = div(F(p.n1, p.d1), F(p.n2, p.d2)), tok = [FX(p.n1, p.d1, p.mix1), ' ÷ ', FX(p.n2, p.d2, p.mix2), ' = '];
      const bugs = [
        { test: (v) => near(v.length > 1 ? v[0] / v[1] : v[0], (p.d1 * p.n2) / (p.n1 * p.d2)), name: '앞 분수를 뒤집음', to: null },
        { test: (v) => near(v.length > 1 ? v[0] / v[1] : v[0], (p.n1 * p.n2) / (p.d1 * p.d2)), name: '나눗셈을 곱셈으로 계산', to: 'F18' },
      ];
      if (res.d === 1) return nums([...tok, B(0)], res.n, { bugs: bugs.map((x) => ({ ...x, test: (v) => x.test([v[0]]) })) });
      return frac([...tok, fb(0, 1)], res, { bugs });
    },
    steps: (p) => {
      const L = lcm(p.d1, p.d2), N1 = p.n1 * L / p.d1, N2 = p.n2 * L / p.d2;
      return [
        { c: 'F9', p: { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 }, why: '먼저 통분해요.' },
        { c: 'F18', p: { a: N1, b: N2, d: L }, why: '분모가 같은 분수끼리의 나눗셈이 돼요.' },
      ];
    },
  },
  {
    id: 'F20', name: '(분수)÷(분수)를 곱셈으로', kid: '나누는 분수를 뒤집어 곱하기', g: '6-2', s: 'F', pre: ['F15', 'F21', 'F17'],
    tip: '÷ 4/5는 "4/5가 1이 되게 하는 것"이라 × 5/4. 먼저 1 ÷ 4/5 = 5/4를 그림으로 보여 줘요.',
    gen: (r) => { const d1 = r.int(2, 7), d2 = r.int(2, 7); return { n1: r.int(1, d1 - 1), d1, n2: r.int(1, d2 - 1), d2 }; },
    make: (p) => {
      const res = div(F(p.n1, p.d1), F(p.n2, p.d2));
      return {
        prompt: [fx(p.n1, p.d1), ' ÷ ', fx(p.n2, p.d2), ' = ', fx(p.n1, p.d1), ' × ', fb(0, 1), ' = ', fb(2, 3)],
        ans: `${p.n1}/${p.d1} × ${p.d2}/${p.n2} = ${res.n}/${res.d}`,
        sol: [p.d2, p.n2, res.n, res.d],
        check(v) {
          if (v.slice(0, 4).some((x) => !Number.isInteger(x)) || !v[1] || !v[3]) return { ok: false };
          const flipOk = eqv(F(v[0], v[1]), F(p.d2, p.n2)), resOk = eqv(F(v[2], v[3]), res);
          if (flipOk && resOk) return { ok: true };
          if (eqv(F(v[0], v[1]), F(p.n2, p.d2))) return { ok: false, bug: { name: '나누는 수를 그대로 곱함', to: 'F21' } };
          if (flipOk && !resOk) return { ok: false, bug: { name: '분수의 곱셈에서 틀림', to: 'F15' } };
          return { ok: false };
        },
      };
    },
    steps: (p) => [
      { c: 'F21', p: { v: 'one', n: p.n2, d: p.d2 }, why: `1 ÷ ${p.n2}/${p.d2}${P(p.n2, '은', '는')} 얼마인가요?` },
      { c: 'F15', p: { n1: p.n1, d1: p.d1, n2: p.d2, d2: p.n2 }, why: '그 수를 곱해요.' },
    ],
  },
  {
    id: 'F21', name: '(자연수)÷(분수)', kid: '자연수 ÷ 분수', g: '6-2', s: 'F', pre: ['F18', 'D4'],
    tip: '6 ÷ 3/4: 3/4이 6이면 1/4은 2, 1(= 4/4)은 8. 분수로 나누면 커질 수 있다는 것을 띠 그림으로 보여 줘요.',
    gen: (r) => { const d = r.int(2, 7), n = r.int(1, d - 1); return r.chance(0.3) ? { v: 'one', n, d } : { v: 'n', n, d, N: n * r.int(2, 5) }; },
    make: (p) => {
      if (p.v === 'one' && p.n === 1) return nums(['1 ÷ ', fx(1, p.d), ' = ', B(0)], p.d, { bugs: [{ test: (v) => near(v[0], 1 / p.d), name: '나누면 작아진다고 봄 (자연수 규칙)', to: null }] });
      if (p.v === 'one') return frac(['1 ÷ ', FX(p.n, p.d, p.mix), ' = ', fb(0, 1)], F(p.d, p.n), { bugs: [{ test: (v) => eqv(F(v[0], v[1] || 1), F(p.n, p.d)), name: '나누면 작아진다고 봄 (자연수 규칙)', to: null }] });
      return nums([`${p.N} ÷ `, FX(p.n, p.d, p.mix), ' = ', B(0)], (p.N * p.d) / p.n, {
        bugs: [
          { test: (v) => near(v[0], (p.N * p.n) / p.d), name: '곱해 버림 (나누면 작아진다고 봄)', to: null },
          { test: (v) => near(v[0], p.N / p.n), name: '1/몇만큼만 구함', to: 'F4' },
        ],
      });
    },
    steps: (p) => {
      if (p.v === 'one') return [{ c: 'F3', p: { v: 'whole', w: 1, d: p.d }, why: `1은 1/${p.d}이 몇 개인가요?` }];
      if (p.N % p.n || p.n > 9 || p.N / p.n > 9) return [];
      const k = p.N / p.n;
      return [{ c: 'D4', p: { d: p.n, q: k }, why: `${p.n}/${p.d}${P(p.n, '이', '가')} ${J(p.N, '이면', '면')} 1/${p.d}은?` }, { c: tbl(k), p: { a: k, b: p.d }, why: `1은 1/${p.d}이 ${p.d}개예요.` }];
    },
    bridge: '"나누면 작아진다"가 깨지는 마디예요.',
  },
];
