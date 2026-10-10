// 나눗셈 (3~4학년)
import { nums, B, J, tbl } from './kit.js';
import { dots } from '../tokens.js';

export default [
  {
    id: 'D1', name: '똑같이 나누기 (몇 묶음으로)', kid: '똑같이 나누기', g: '3-1', s: 'D', pre: ['M1', 'N3'],
    tip: '바둑돌을 접시 몇 개에 하나씩 번갈아 놓아 똑같이 나눠요(등분).',
    gen: (r) => ({ d: r.int(2, 5), q: r.int(2, 6) }),
    make: (p) => nums([{ svg: dots(p.d * p.q, { cols: Math.min(p.d * p.q, 6) }) }, `사탕 ${p.d * p.q}개를 ${p.d}명이 똑같이 나누면 한 명에 `, B(0), '개씩이에요.'], p.q, {
      bugs: [{ test: (v) => v[0] === p.d * p.q - p.d, name: '나누기를 빼기로 함', to: 'M1' }, { test: (v) => v[0] === p.d, name: '사람 수를 씀', to: 'M1' }],
    }),
  },
  {
    id: 'D2', name: '몇씩 덜어내기 (몇 번 들어가나)', kid: '몇 번 덜어낼 수 있나', g: '3-1', s: 'D', pre: ['M1', 'A2'],
    tip: '12 − 3 − 3 − 3 − 3 = 0처럼 덜어내고, 덜어낸 횟수가 몫이라는 것을 보여 줘요(포함). 6학년 분수 ÷ 분수의 뿌리예요.',
    gen: (r) => ({ d: r.int(2, 5), q: r.int(2, 6) }),
    make: (p) => {
      const n = p.d * p.q;
      return nums([`${n} − ${Array(p.q).fill(p.d).join(' − ')} = 0`, { br: 1 }, `${n}에서 ${J(p.d, '을', '를')} `, B(0), '번 덜어낼 수 있어요. ', `${n} ÷ ${p.d} = `, B(1)], [p.q, p.q], {
        bugs: [{ test: (v) => v[0] === n - p.d || v[1] === n - p.d, name: '나누기를 한 번 빼기로 봄', to: 'A2' }],
      });
    },
  },
  {
    id: 'D3', name: '곱셈과 나눗셈의 관계', kid: '곱셈식 ↔ 나눗셈식', g: '3-1', s: 'D', pre: (p) => ['D1', tbl(p ? p.a : 2)],
    tip: '한 그림(3개씩 4줄)을 곱셈식 하나와 나눗셈식 두 개로 나타내요.',
    gen: (r) => ({ v: r.chance(0.5) ? 'box' : 'q', a: r.int(2, 9), b: r.int(2, 9) }),
    make: (p) => p.v === 'box'
      ? nums([`${p.a} × `, B(0), ` = ${p.a * p.b}`], p.b, { bugs: [{ test: (v) => v[0] === p.a * p.b - p.a, name: '빼서 구함', to: 'D1' }, { test: (v) => v[0] === p.a * p.b * p.a, name: '곱해 버림', to: 'D1' }] })
      : nums([`${p.a} × ${p.b} = ${p.a * p.b}이므로 ${p.a * p.b} ÷ ${p.a} = `, B(0)], p.b, { bugs: [{ test: (v) => v[0] === p.a, name: '나누는 수를 씀', to: 'D1' }] }),
  },
  {
    id: 'D4', name: '나눗셈의 몫을 곱셈구구로', kid: '구구단으로 나누기', g: '3-1', s: 'D', pre: (p) => ['D3', tbl(p ? p.d : 2)],
    tip: '42 ÷ 7은 "7 × □ = 42"의 □예요. 7단을 거꾸로 짚어 보게 해요.',
    gen: (r) => ({ d: r.int(2, 9), q: r.int(2, 9) }),
    make: (p) => {
      if (p.n != null) {
        const q = p.n / p.d;
        return nums([`${p.n} ÷ ${p.d} = `, B(0)], q, { bugs: [{ test: (v) => v[0] * 10 === q, name: '0을 빠뜨림', to: 'N5' }] });
      }
      const n = p.d * p.q;
      return nums([`${n} ÷ ${p.d} = `, B(0)], p.q, {
        bugs: [{ test: (v) => Math.abs(v[0] - p.q) === 1, name: '구구단 한 줄 어긋남', to: tbl(p.d) }, { test: (v) => v[0] === n - p.d, name: '나누기를 빼기로 함', to: 'D2' }],
      });
    },
    steps: (p) => (p.n != null ? [] : [{ c: 'D3', p: { v: 'box', a: p.d, b: p.q }, why: `${p.d} × □ = ${p.d * p.q}의 □를 찾아요.` }]),
  },
  {
    id: 'D5', name: '몫과 나머지', kid: '나머지가 있는 나눗셈', g: '3-2', s: 'D', pre: (p) => ['D4', 'D2', 'A6'],
    tip: '17 ÷ 5: 5씩 덜어내다 5보다 작게 남으면 멈춰요. 나머지는 나누는 수보다 작아야 해요.',
    gen: (r) => { let d, q, x; do { d = r.int(3, 9); q = r.int(2, 9); x = r.int(1, d - 1); } while (d * q + x > 89); return { d, q, x }; },
    make: (p) => {
      const n = p.d * p.q + p.x;
      return nums([`${n} ÷ ${p.d} = `, B(0), ' … ', B(1)], [p.q, p.x], {
        bugs: [{ test: (v) => v[1] >= p.d, name: '나머지가 나누는 수보다 큼', to: 'D2' }, { test: (v) => Math.abs(v[0] - p.q) === 1, name: '몫을 하나 틀림', to: tbl(p.d) }],
      });
    },
    steps: (p) => [
      { c: tbl(p.d), p: { a: p.d, b: p.q }, why: `${p.d}단에서 ${p.d * p.q + p.x}보다 크지 않은 가장 큰 곱을 찾아요.` },
      { c: 'A8', p: { op: '-', a: p.d * p.q + p.x, b: p.d * p.q }, why: '남는 수를 구해요.' },
    ],
  },
  {
    id: 'D6', name: '(두 자리)÷(한 자리)', kid: '두 자리 수 나누기', g: '3-2', s: 'D', pre: ['D4', 'N5'],
    tip: '72 ÷ 3 = 60 ÷ 3 + 12 ÷ 3. 십 모형부터 나누고 남은 십 모형을 일 모형으로 바꿔요.',
    gen: (r) => { let d, qt, qo; do { d = r.int(2, 4); qt = r.int(1, 3); qo = r.int(1, 9); } while (d * (qt * 10 + qo) > 99 || d * qo < 10); return { d, qt, qo }; },
    make: (p) => {
      const q = p.qt * 10 + p.qo, n = p.d * q;
      return nums([`${n} ÷ ${p.d} = `, B(0)], q, { bugs: [{ test: (v) => v[0] === Math.floor(Math.floor(n / 10) / p.d) * 10 + Math.floor((n % 10) / p.d), name: '자리마다 따로 나눔', to: 'N5' }] });
    },
    steps: (p) => [
      { c: 'D4', p: { n: p.d * p.qt * 10, d: p.d }, why: '십의 자리부터 나눠요.' },
      { c: 'D4', p: { d: p.d, q: p.qo }, why: '남은 수를 나눠요.' },
    ],
  },
  {
    id: 'D7', name: '(세 자리)÷(두 자리)', kid: '두 자리 수로 나누기', g: '4-1', s: 'D', pre: ['D6', 'M10'],
    tip: '나누는 수를 몇십으로 어림해 몫을 짐작하고, 곱해서 확인한 뒤 고치게 해요.',
    gen: (r) => { let dv, q; do { dv = r.int(12, 29); q = r.int(12, 39); } while (dv * q > 999 || q % 10 === 0); return { dv, q }; },
    make: (p) => nums([`${p.dv * p.q} ÷ ${p.dv} = `, B(0)], p.q, {
      bugs: [{ test: (v) => Math.abs(v[0] - p.q) === 1, name: '어림한 몫을 고치지 않음', to: 'M10' }],
    }),
    steps: (p) => {
      const qt = Math.floor(p.q / 10) * 10, qo = p.q % 10, n = p.dv * p.q;
      return [
        { c: 'M9', p: { v: 'mt', a: p.dv, t: qt }, why: `${p.dv} × ${qt}을 먼저 빼요.` },
        { c: 'A8', p: { op: '-', a: n, b: p.dv * qt }, why: '남은 수를 구해요.' },
        { c: 'M8', p: { a: p.dv, b: qo }, why: `남은 수가 ${p.dv}의 몇 배인지 봐요.` },
      ];
    },
  },
];
