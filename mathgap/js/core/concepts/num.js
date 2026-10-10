// 수·덧셈·뺄셈·길이·등호 (1~4학년)
import { nums, pick, B, J } from './kit.js';
import { dots } from '../tokens.js';

const tens = (n) => Math.floor(n / 10) % 10, ones = (n) => n % 10;

// 받아올림을 무시한 자리별 덧셈 (오답 흉내)
export function addNoCarry(a, b) {
  let r = 0, p = 1;
  while (a > 0 || b > 0) { r += ((a % 10 + b % 10) % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; }
  return r;
}
// 자리마다 큰 수에서 작은 수를 뺀 뺄셈 (오답 흉내)
export function subSmallFromLarge(a, b) {
  let r = 0, p = 1;
  while (a > 0 || b > 0) { r += Math.abs(a % 10 - b % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; }
  return r;
}

export default [
  {
    id: 'N1', name: '9까지의 수 세기', kid: '몇 개인지 세기', g: '1-1', s: 'N', pre: [],
    tip: '바둑돌을 하나씩 옮기며 마지막에 센 수가 전체 개수라는 것을 확인해요.',
    gen: (r) => ({ n: r.int(3, 9) }),
    make: (p) => nums([{ svg: dots(p.n) }, '모두 몇 개인가요? ', B(0), '개'], p.n, {
      bugs: [{ test: (v) => Math.abs(v[0] - p.n) === 1, name: '세다가 하나 어긋남', to: null }],
    }),
  },
  {
    id: 'N2', name: '두 수의 크기 비교', kid: '더 큰 수 고르기', g: '1-1', s: 'N', pre: ['N1'],
    tip: '수 배열표나 수직선에서 오른쪽(뒤)에 있는 수가 더 커요.',
    gen: (r) => { const two = r.chance(0.6); let a, b; do { a = two ? r.int(11, 50) : r.int(1, 9); b = two ? r.int(11, 50) : r.int(1, 9); } while (a === b || (two && tens(a) === tens(b))); return { a, b }; },
    make: (p) => {
      const right = p.a > p.b ? 0 : 1;
      const wrongOnes = p.a >= 10 && ones([p.a, p.b][1 - right]) > ones([p.a, p.b][right]);
      return pick(['더 큰 수를 고르세요.'], [[String(p.a)], [String(p.b)]], right, {
        bugs: { [1 - right]: wrongOnes ? { name: '일의 자리만 비교', to: 'N4' } : { name: '더 작은 수를 고름', to: 'N1' } },
      });
    },
  },
  {
    id: 'N3', name: '가르기와 모으기', kid: '수를 둘로 가르고 모으기', g: '1-1', s: 'N', pre: ['N1'],
    tip: '바둑돌 10개를 두 접시에 나눠 담는 놀이로 가르기·모으기를 몸으로 익혀요.',
    gen: (r) => { const t = r.int(4, 10), a = r.int(1, t - 1); return { v: r.chance(0.5) ? 'split' : 'join', t, a }; },
    make: (p) => p.v === 'split'
      ? nums([`${J(p.t, '을', '를')} 둘로 가르면 ${J(p.a, '과', '와')} `, B(0)], p.t - p.a, { bugs: [{ test: (v) => v[0] === p.t + p.a, name: '가르기를 모으기로 함', to: null }] })
      : nums([`${J(p.a, '과', '와')} ${J(p.t - p.a, '을', '를')} 모으면 `, B(0)], p.t, {}),
  },
  {
    id: 'N4', name: '10개씩 묶음과 낱개', kid: '10개씩 묶어 세기', g: '1-1', s: 'N', pre: ['N1', 'N3'],
    tip: '수 모형(10개 막대와 낱개)으로 묶음과 낱개를 직접 만들어 세요.',
    gen: (r) => { const n = r.int(12, 98); return r.chance(0.5) ? { v: 'bundle', t: tens(n), o: ones(n) } : { v: 'split', n }; },
    make: (p) => {
      if (p.v === 'bundle') return nums([`10개씩 묶음 ${p.t}개와 낱개 ${p.o}개는 `, B(0)], p.t * 10 + p.o, {
        bugs: [{ test: (v) => v[0] === p.t + p.o, name: '묶음 수와 낱개 수를 더함', to: 'N1' }, { test: (v) => v[0] === p.o * 10 + p.t, name: '묶음과 낱개 자리를 바꿈', to: null }],
      });
      if (p.v === 'split') return nums([`${J(p.n, '은', '는')} 10개씩 묶음 `, B(0), '개와 낱개 ', B(1), '개'], [tens(p.n), ones(p.n)], {});
      if (p.v === 'tenplus') return nums([`10과 ${J(p.o, '을', '를')} 모으면 `, B(0)], 10 + p.o, { bugs: [{ test: (v) => v[0] === p.o, name: '10을 빠뜨림', to: 'N3' }] });
      // split10: 13은 10과 □
      return nums([`${p.n} = 10 + `, B(0)], p.n - 10, {});
    },
  },
  {
    id: 'N5', name: '세 자리 수와 자릿값', kid: '자릿값 (백·십·일)', g: '2-1', s: 'N', pre: ['N4'],
    tip: '수 모형(백·십·일)으로 수를 만들고, 십 모형 10개를 백 모형 1개로 바꿔 봐요.',
    gen: (r) => r.chance(0.5) ? { v: 'expand', n: r.int(101, 989) } : { v: 'tens', k: r.int(11, 79) },
    make: (p) => {
      if (p.v === 'expand') {
        const h = Math.floor(p.n / 100) * 100, t = tens(p.n) * 10, o = ones(p.n);
        return nums([`${p.n} = ${h} + `, B(0), ` + ${o}`], t, { bugs: [{ test: (v) => v[0] === tens(p.n), name: '십의 자리 숫자만 씀', to: 'N4' }] });
      }
      if (p.v === 'regroup') return nums([`${p.n} = ${p.t} + `, B(0)], p.n - p.t, {});
      return nums([`10이 ${p.k}개이면 `, B(0)], p.k * 10, { bugs: [{ test: (v) => v[0] === p.k + 10, name: '10을 더함', to: 'N4' }, { test: (v) => v[0] === p.k * 100, name: '0을 하나 더 붙임', to: 'N4' }] });
    },
  },
  {
    id: 'A1', name: '한 자리 수의 덧셈', kid: '한 자리 수 더하기', g: '1-1', s: 'A', pre: ['N3'], timed: 5000,
    tip: '가르기·모으기 카드로 합이 10이 안 되는 덧셈을 빠르게 말하기 놀이를 해요.',
    gen: (r) => { const a = r.int(1, 8); return { a, b: r.int(1, 9 - a) }; },
    make: (p) => p.c != null
      ? nums([`${p.a} + ${p.b} + ${p.c} = `, B(0)], p.a + p.b + p.c, { timed: true })
      : nums([`${p.a} + ${p.b} = `, B(0)], p.a + p.b, { timed: true, bugs: [{ test: (v) => Math.abs(v[0] - p.a - p.b) === 1, name: '세다가 하나 어긋남', to: 'N3' }, { test: (v) => v[0] === Math.abs(p.a - p.b), name: '뺄셈을 함', to: null }] }),
  },
  {
    id: 'A2', name: '한 자리 수의 뺄셈', kid: '한 자리 수 빼기', g: '1-1', s: 'A', pre: ['N3'], timed: 5000,
    tip: '가르기로 뺄셈을 봐요: 7을 3과 4로 가르면 7 − 3 = 4.',
    gen: (r) => { const a = r.int(3, 10); return { a, b: r.int(1, a - 1) }; },
    make: (p) => p.tens
      ? nums([`${p.a * 10} − ${p.b * 10} = `, B(0)], (p.a - p.b) * 10, { bugs: [{ test: (v) => v[0] === p.a - p.b, name: '0을 빠뜨림', to: 'N4' }] })
      : nums([`${p.a} − ${p.b} = `, B(0)], p.a - p.b, { timed: true, bugs: [{ test: (v) => v[0] === p.a + p.b, name: '더함', to: 'N3' }, { test: (v) => Math.abs(v[0] - (p.a - p.b)) === 1, name: '세다가 하나 어긋남', to: 'N3' }] }),
  },
  {
    id: 'A3', name: '받아올림이 있는 덧셈 (10 만들기)', kid: '10을 만들어 더하기', g: '1-2', s: 'A', pre: ['A1', 'N3', 'N4'], timed: 6000,
    tip: '10칸 틀에 먼저 10을 채우고 남은 수를 더해요: 8 + 5 = 8 + 2 + 3.',
    gen: (r) => { let a, b; do { a = r.int(2, 9); b = r.int(2, 9); } while (a + b < 11); return { a, b }; },
    make: (p) => nums([`${p.a} + ${p.b} = `, B(0)], p.a + p.b, {
      timed: true,
      bugs: [{ test: (v) => v[0] === p.a + p.b - 10, name: '10을 빠뜨림', to: 'N4' }, { test: (v) => Math.abs(v[0] - (p.a + p.b)) === 1, name: '세다가 하나 어긋남', to: 'N3' }],
    }),
    steps: (p) => [
      { c: 'N3', p: { v: 'split', t: p.b, a: 10 - p.a }, why: `${p.a}에 ${J(10 - p.a, '을', '를')} 더하면 10이에요. ${J(p.b, '을', '를')} 그렇게 갈라요.` },
      { c: 'N4', p: { v: 'tenplus', o: p.a + p.b - 10 }, why: '10과 남은 수를 모아요.' },
    ],
  },
  {
    id: 'A4', name: '받아내림이 있는 뺄셈 (십몇 − 몇)', kid: '10에서 빼기', g: '1-2', s: 'A', pre: ['A2', 'N3', 'N4'], timed: 6000,
    tip: '13 − 5는 13을 10과 3으로 가르고 10에서 5를 빼요(5 + 3 = 8).',
    gen: (r) => { const a = r.int(11, 18); return { a, b: r.int(ones(a) + 1, 9) }; },
    make: (p) => nums([`${p.a} − ${p.b} = `, B(0)], p.a - p.b, {
      timed: true,
      bugs: [{ test: (v) => v[0] === 10 + (p.b - ones(p.a)), name: '작은 수에서 큰 수를 뺌', to: 'N4' }],
    }),
    steps: (p) => [
      { c: 'N4', p: { v: 'split10', n: p.a }, why: `${J(p.a, '을', '를')} 10과 몇으로 갈라요.` },
      { c: 'A2', p: { a: 10, b: p.b }, why: `10에서 ${J(p.b, '을', '를')} 빼요.` },
      { c: 'A1', p: { a: 10 - p.b, b: p.a - 10 }, why: '남은 수를 더해요.' },
    ],
  },
  {
    id: 'A5', name: '받아올림이 있는 두 자리 수 덧셈', kid: '두 자리 수 더하기', g: '2-1', s: 'A', pre: ['A3', 'N5'],
    tip: '수 모형으로 일 모형 10개를 십 모형 1개로 바꾸는 장면을 꼭 보여 줘요.',
    gen: (r) => { let a, b; do { a = r.int(12, 79); b = r.int(12, 79); } while (ones(a) + ones(b) < 10 || a + b > 99 || tens(a) + tens(b) > 8); return { a, b }; },
    make: (p) => nums([`${p.a} + ${p.b} = `, B(0)], p.a + p.b, {
      bugs: [
        { test: (v) => v[0] === (tens(p.a) + tens(p.b)) * 100 + ones(p.a) + ones(p.b), name: '받아올린 수를 자리에 그대로 씀', to: 'N5' },
        { test: (v) => v[0] === addNoCarry(p.a, p.b), name: '받아올림을 잊음', to: 'N5' },
      ],
    }),
    steps: (p) => [
      { c: 'A3', p: { a: ones(p.a), b: ones(p.b) }, why: '일의 자리끼리 더해요.' },
      { c: 'A1', p: { a: tens(p.a), b: tens(p.b), c: 1 }, why: '십의 자리끼리 더하고, 받아올린 1도 더해요.' },
    ],
  },
  {
    id: 'A6', name: '받아내림이 있는 두 자리 수 뺄셈', kid: '두 자리 수 빼기', g: '2-1', s: 'A', pre: ['A4', 'N5'],
    tip: '십 모형 하나를 일 모형 10개로 풀어 놓고 빼요. 풀어 쓴 십 하나가 줄어드는 것을 보여 줘요.',
    gen: (r) => { let a, b; do { a = r.int(31, 98); b = r.int(12, a - 10); } while (ones(a) >= ones(b) || ones(b) - ones(a) === 5 || tens(a) <= tens(b)); return { a, b }; },
    make: (p) => nums([`${p.a} − ${p.b} = `, B(0)], p.a - p.b, {
      bugs: [
        { test: (v) => v[0] === subSmallFromLarge(p.a, p.b), name: '작은 수에서 큰 수를 뺌', to: 'A4' },
        { test: (v) => v[0] === (tens(p.a) - tens(p.b)) * 10 + (10 + ones(p.a) - ones(p.b)), name: '받아내린 십을 안 뺌', to: 'N5' },
      ],
    }),
    steps: (p) => [
      { c: 'N5', p: { v: 'regroup', n: p.a, t: (tens(p.a) - 1) * 10 }, why: '십 하나를 일로 풀어요.' },
      { c: 'A4', p: { a: 10 + ones(p.a), b: ones(p.b) }, why: '일의 자리를 빼요.' },
      { c: 'A2', p: { a: tens(p.a) - 1, b: tens(p.b), tens: true }, why: '십의 자리를 빼요.' },
    ],
  },
  {
    id: 'A7', name: '□가 있는 덧셈식', kid: '□ 구하기', g: '2-1', s: 'A', pre: ['A2', 'N3'],
    tip: '□ + 5 = 12는 "12를 5와 □로 가르기"예요. 가르기 그림으로 □를 찾아요.',
    gen: (r) => { const a = r.int(2, 9), s = r.int(a + 2, 18); return { a, s, left: r.chance(0.5) }; },
    make: (p) => nums(p.left ? [B(0), ` + ${p.a} = ${p.s}`] : [`${p.a} + `, B(0), ` = ${p.s}`], p.s - p.a, {
      bugs: [{ test: (v) => v[0] === p.s + p.a, name: '보이는 수를 더함', to: 'N3' }],
    }),
  },
  {
    id: 'A8', name: '세 자리 수의 덧셈과 뺄셈', kid: '큰 수 더하기·빼기', g: '3-1', s: 'A', pre: ['A5', 'A6'],
    tip: '자리를 맞춰 세로로 쓰고, 받아올림·받아내림을 작은 숫자로 꼭 적게 해요.',
    gen: (r) => {
      if (r.chance(0.5)) { let a, b; do { a = r.int(120, 899); b = r.int(120, 899); } while (addNoCarry(a, b) === a + b); return { op: '+', a, b }; }
      let a, b; do { a = r.int(300, 999); b = r.int(110, a - 50); } while (subSmallFromLarge(a, b) === a - b); return { op: '-', a, b };
    },
    make: (p) => p.op === '+'
      ? nums([`${p.a} + ${p.b} = `, B(0)], p.a + p.b, { bugs: [{ test: (v) => v[0] === addNoCarry(p.a, p.b), name: '받아올림을 잊음', to: 'A5' }] })
      : nums([`${p.a} − ${p.b} = `, B(0)], p.a - p.b, { bugs: [{ test: (v) => v[0] === subSmallFromLarge(p.a, p.b), name: '작은 수에서 큰 수를 뺌', to: 'A6' }] }),
  },
  {
    id: 'U1', name: '길이 단위 (1 m = 100 cm)', kid: 'm와 cm 바꾸기', g: '2-2', s: 'N', pre: ['N5'],
    tip: '줄자로 1 m를 직접 재고, 1 m 안에 1 cm가 100번 들어가는 것을 확인해요.',
    gen: (r) => ({ m: r.int(1, 4), cm: r.int(5, 95) }),
    make: (p) => nums([`${p.m} m ${p.cm} cm = `, B(0), ' cm'], p.m * 100 + p.cm, {
      bugs: [{ test: (v) => v[0] === p.m + p.cm, name: '단위를 무시하고 더함', to: 'N5' }, { test: (v) => v[0] === p.m * 1000 + p.cm, name: '1 m를 1000 cm로 봄', to: 'N5' }],
    }),
  },
  {
    id: 'R0', name: '등호 양쪽이 같다 (동치)', kid: '= 양쪽 맞추기', g: '4-1', s: 'R', pre: ['A1'],
    tip: '양팔 저울 그림으로 "="는 양쪽 무게가 같다는 뜻이라는 것을 보여 줘요. (2022 개정 4학년 신설 · 1·2학년 해설에도 있음)',
    gen: (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(1, a + b - 1); return { a, b, c }; },
    make: (p) => nums([`${p.a} + ${p.b} = `, B(0), ` + ${p.c}`], p.a + p.b - p.c, {
      bugs: [{ test: (v) => v[0] === p.a + p.b, name: '등호를 답 쓰는 자리로 봄', to: null }, { test: (v) => v[0] === p.a + p.b + p.c, name: '모든 수를 더함', to: null }],
    }),
  },
];
