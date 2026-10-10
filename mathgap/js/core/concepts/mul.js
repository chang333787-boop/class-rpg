// 곱셈 (2~3학년)
import { nums, B, tbl } from './kit.js';
import { groups } from '../tokens.js';
import { addNoCarry } from './num.js';

const tens = (n) => Math.floor(n / 10) % 10, ones = (n) => n % 10;
// (몇십몇)×(몇)에서 올림을 안 더한 값 / 올린 수를 먼저 더하고 곱한 값 (오답 흉내)
export const forgotCarry = (a, b) => tens(a) * b * 10 + ((ones(a) * b) % 10) + (a >= 100 ? Math.floor(a / 100) * b * 100 : 0);
export const carryThenMul = (a, b) => (tens(a) + Math.floor((ones(a) * b) / 10)) * b * 10 + ((ones(a) * b) % 10);

const TABLE = (id, name, set, tip) => ({
  id, name, kid: name, g: '2-2', s: 'M', pre: ['M2'], timed: 5000, tip,
  gen: (r) => ({ a: r.pick(set), b: r.int(2, 9) }),
  make: (p) => nums([`${p.a} × ${p.b} = `, B(0)], p.a * p.b, {
    timed: true,
    bugs: [
      { test: (v) => v[0] === p.a * (p.b + 1) || v[0] === p.a * (p.b - 1), name: '이웃 칸과 헷갈림', to: null },
      { test: (v) => v[0] === p.a + p.b, name: '곱셈을 덧셈으로 함', to: 'M2' },
    ],
  }),
});

export default [
  {
    id: 'M1', name: '묶어 세기', kid: '몇씩 몇 묶음', g: '2-1', s: 'M', pre: ['N1', 'A1'],
    tip: '같은 수씩 묶고 "2, 4, 6…"처럼 뛰어 세기를 해요.',
    gen: (r) => ({ k: r.int(2, 5), n: r.int(2, 6) }),
    make: (p) => nums([{ svg: groups(p.k, p.n) }, `${p.n}씩 `, B(0), '묶음이에요. 모두 ', B(1), '개예요.'], [p.k, p.k * p.n], {
      bugs: [{ test: (v) => v[1] === p.k + p.n, name: '묶음 수와 한 묶음의 수를 더함', to: null }],
    }),
  },
  {
    id: 'M2', name: '몇의 몇 배', kid: '몇의 몇 배', g: '2-1', s: 'M', pre: ['M1'],
    tip: '"4의 3배"를 4씩 3묶음으로 그려요. 3을 더하는 것이 아니라 4를 세 번이에요.',
    gen: (r) => ({ a: r.int(2, 9), k: r.int(2, 5) }),
    make: (p) => nums([`${p.a}의 ${p.k}배는 `, B(0)], p.a * p.k, {
      bugs: [{ test: (v) => v[0] === p.a + p.k, name: '배를 더하기로 봄 (덧셈으로 지키기)', to: 'M1' }],
    }),
    steps: (p) => [{ c: 'M1', p: { k: p.k, n: p.a }, why: `${p.a}씩 ${p.k}묶음으로 봐요.` }],
  },
  TABLE('M3', '곱셈구구 2·5단', [2, 5], '2단·5단은 뛰어 세기(2, 4, 6… / 5, 10, 15…)와 이어요.'),
  TABLE('M4', '곱셈구구 3·6단', [3, 6], '6단은 3단을 두 번 한 것이에요: 6 × 4 = 3 × 4 + 3 × 4.'),
  TABLE('M5', '곱셈구구 4·8단', [4, 8], '8단은 4단을 두 번 한 것이에요.'),
  TABLE('M6', '곱셈구구 7·9단', [7, 9], '9단은 10단에서 빼요: 9 × 4 = 40 − 4. 7단은 5단 + 2단.'),
  {
    id: 'M7', name: '(몇십)×(몇)', kid: '몇십 곱하기', g: '3-1', s: 'M', pre: (p) => ['N5', tbl(p ? p.t / 10 : 2)],
    tip: '30 × 4는 10이 3개씩 4묶음 = 10이 12개 = 120. 수 모형으로 보여 줘요.',
    gen: (r) => ({ t: r.int(2, 9) * 10, b: r.int(2, 9) }),
    make: (p) => nums([`${p.t} × ${p.b} = `, B(0)], p.t * p.b, {
      bugs: [{ test: (v) => v[0] === (p.t / 10) * p.b, name: '0을 빠뜨림', to: 'N5' }, { test: (v) => v[0] === p.t * p.b * 10, name: '0을 더 붙임', to: 'N5' }],
    }),
  },
  {
    id: 'M8', name: '(몇십몇)×(몇)', kid: '두 자리 수 × 한 자리 수', g: '3-1', s: 'M', pre: (p) => ['M7', tbl(p ? p.a % 10 : 2), 'A8'],
    tip: '47 × 6 = 40 × 6 + 7 × 6. 두 부분 곱을 따로 쓰고 더하는 방법부터, 올림을 작게 적는 세로셈으로.',
    gen: (r) => { let a, b; do { a = r.int(12, 98); b = r.int(3, 9); } while (a % 10 === 0 || (a % 10) * b < 10); return { a, b }; },
    make: (p) => nums([`${p.a} × ${p.b} = `, B(0)], p.a * p.b, {
      bugs: [
        { test: (v) => v[0] === forgotCarry(p.a, p.b), name: '올림한 수를 안 더함', to: 'A5' },
        { test: (v) => v[0] === carryThenMul(p.a, p.b), name: '올린 수를 먼저 더하고 곱함', to: 'M7' },
      ],
    }),
    steps: (p) => [
      { c: tbl(ones(p.a)), p: { a: ones(p.a), b: p.b }, why: '일의 자리를 곱해요.' },
      { c: 'M7', p: { t: tens(p.a) * 10, b: p.b }, why: '십의 자리(몇십)를 곱해요.' },
      { c: 'A8', p: { op: '+', a: tens(p.a) * 10 * p.b, b: ones(p.a) * p.b }, why: '두 곱을 더해요.' },
    ],
  },
  {
    id: 'M9', name: '(몇십)×(몇십) · (몇십몇)×(몇십)', kid: '몇십 곱하기 몇십', g: '3-2', s: 'M', pre: (p) => (p && p.v === 'mt' ? ['M8', 'N5'] : ['M7', 'N5']),
    tip: '40 × 30 = 4 × 3 × 100. 10 × 10 = 100을 먼저 확인해요.',
    gen: (r) => r.chance(0.5) ? { v: 'tt', a: r.int(2, 9) * 10, t: r.int(2, 9) * 10 } : { v: 'mt', a: r.int(12, 49), t: r.int(2, 9) * 10 },
    make: (p) => nums([`${p.a} × ${p.t} = `, B(0)], p.a * p.t, {
      bugs: [{ test: (v) => v[0] * 10 === p.a * p.t, name: '0을 하나만 붙임', to: 'N5' }],
    }),
    steps: (p) => p.v === 'mt'
      ? [{ c: 'M8', p: { a: p.a, b: p.t / 10 }, why: `먼저 ${p.a} × ${p.t / 10}을 해요.` }, { c: 'N5', p: { v: 'tens', k: p.a * (p.t / 10) }, why: '그 수의 10배예요.' }]
      : [{ c: tbl(p.a / 10), p: { a: p.a / 10, b: p.t / 10 }, why: '0을 뺀 수끼리 곱해요.' }, { c: 'N5', p: { v: 'tens', k: (p.a / 10) * (p.t / 10) * 10 }, why: '10 × 10 = 100이에요.' }],
  },
  {
    id: 'M10', name: '(두 자리)×(두 자리)', kid: '두 자리 수 × 두 자리 수', g: '3-2', s: 'M', pre: ['M8', 'M9', 'A8'],
    tip: '58 × 37 = 58 × 7 + 58 × 30. 둘째 줄이 "몇십을 곱한 것"이라 한 칸 밀린다는 것을 넓이 그림으로 보여 줘요.',
    gen: (r) => { let a, b; do { a = r.int(13, 98); b = r.int(13, 98); } while (a % 10 === 0 || b % 10 < 2 || (a % 10) * (b % 10) < 10); return { a, b }; },
    make: (p) => {
      const bo = ones(p.b), bt = tens(p.b);
      return nums([`${p.a} × ${p.b} = `, B(0)], p.a * p.b, {
        bugs: [
          { test: (v) => v[0] === p.a * bo + p.a * bt, name: '둘째 줄을 한 칸 밀지 않음', to: 'M9' },
          { test: (v) => v[0] === Number(String(tens(p.a) * bt) + String(ones(p.a) * bo)), name: '같은 자리끼리만 곱함', to: 'M8' },
          { test: (v) => v[0] === forgotCarry(p.a, bo) + forgotCarry(p.a, bt) * 10, name: '곱셈 안의 올림을 잊음', to: 'M8' },
          { test: (v) => v[0] === addNoCarry(p.a * bo, p.a * bt * 10), name: '마지막 덧셈에서 받아올림을 잊음', to: 'A8' },
        ],
      });
    },
    steps: (p) => [
      { c: 'M8', p: { a: p.a, b: ones(p.b) }, why: `먼저 일의 자리 ${ones(p.b)}을(를) 곱해요.`.replace('을(를)', [0, 1, 3, 6, 7, 8].includes(ones(p.b)) ? '을' : '를') },
      { c: 'M9', p: { v: 'mt', a: p.a, t: tens(p.b) * 10 }, why: `이번엔 십의 자리 ${tens(p.b) * 10}을 곱해요. (세로셈의 둘째 줄)` },
      { c: 'A8', p: { op: '+', a: p.a * ones(p.b), b: p.a * tens(p.b) * 10 }, why: '두 줄을 더해요.' },
    ],
  },
];
