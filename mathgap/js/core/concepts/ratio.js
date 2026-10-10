// 대응 관계 · 비와 비율 · 비례식과 비례배분 (5~6학년)
import { nums, frac, pick, fx, fb, B, P, J, RO, tbl, F, gcd } from './kit.js';
import { near, fmt, lcm, eqv } from '../math.js';

const CTX = [['탁자', '의자', '개'], ['모둠', '연필', '자루'], ['오징어', '다리', '개'], ['자전거', '바퀴', '개']];
const RATE = { 탁자: 4, 오징어: 10, 자전거: 2 };

export default [
  {
    id: 'R1', name: '대응 관계', kid: '두 양 사이의 규칙', g: '5-1', s: 'R', pre: (p) => (p && p.op === '+' ? ['A1'] : ['M2']),
    tip: '표를 가로로만 보지 말고 위아래 짝을 보게 해요("탁자 1개에 의자 4개"). 한 양만 보면 덧셈 규칙으로 착각해요.',
    gen: (r) => { const c = r.int(0, CTX.length - 1), k = RATE[CTX[c][0]] || r.int(3, 6); return { c, k, op: '×', x: r.int(6, 9) }; },
    make: (p) => {
      const [a, b, u] = CTX[p.c], ys = [1, 2, 3, 4].map((x) => x * p.k);
      return nums([`${a} 수: 1, 2, 3, 4`, { br: 1 }, `${b} 수: ${ys.join(', ')}`, { br: 1 }, `${a} 수가 ${J(p.x, '이면', '면')} ${b} 수는 `, B(0), u], p.x * p.k, {
        bugs: [{ test: (v) => v[0] === p.x + p.k - 1, name: '차이로 봄 (덧셈 규칙)', to: 'M2' }, { test: (v) => v[0] === ys[3] + p.k, name: '표의 다음 칸만 구함', to: null }],
      });
    },
  },
  {
    id: 'R2', name: '두 양을 배로 비교', kid: '몇 배인가', g: '6-1', s: 'R', pre: (p) => (p && p.v === 'frac' ? ['F16'] : ['M2', 'D4']),
    tip: '"6명과 3명"을 뺄셈(3명 더 많다)과 나눗셈(2배)으로 둘 다 비교해 보고, 모둠이 늘 때 무엇이 그대로인지 봐요.',
    gen: (r) => { const small = r.int(2, 9), k = r.int(2, 6); return { v: r.chance(0.7) ? 'int' : 'frac', big: small * k, small }; },
    make: (p) => p.v === 'int'
      ? nums([`${J(p.big, '은', '는')} ${p.small}의 `, B(0), '배예요.'], p.big / p.small, { bugs: [{ test: (v) => v[0] === p.big - p.small, name: '차이로 비교 (덧셈으로 지키기)', to: 'M2' }] })
      : frac([`${J(p.small, '은', '는')} ${p.big}의 `, fb(0, 1), '배예요.'], F(p.small, p.big), { bugs: [{ test: (v) => near(v[0] / v[1], p.big / p.small), name: '기준을 바꿈', to: 'F16' }] }),
    steps: (p) => (p.v === 'int' ? [{ c: 'D4', p: { d: p.small, q: p.big / p.small }, why: `${p.big} ÷ ${p.small}` }] : [{ c: 'F16', p: { v: 'small', a: p.small, b: p.big }, why: `${p.small} ÷ ${p.big}` }]),
    bridge: '차이로 보던 비교를 배로 보는 비교로 바꾸는 마디예요(지도서: 의도적으로 지도).',
  },
  {
    id: 'R3', name: '비 (기준량과 비교하는 양)', kid: '비로 나타내기', g: '6-1', s: 'R', pre: ['R2'],
    tip: '"~에 대한"이 붙은 쪽이 기준량이고 기호 :의 오른쪽에 써요. 말로 바꿔 읽기 연습을 해요.',
    gen: (r) => { let a, b; do { a = r.int(2, 12); b = r.int(2, 12); } while (a === b); return { v: r.chance(0.6) ? 'write' : 'base', a, b }; },
    make: (p) => p.v === 'write'
      ? nums([`가로 ${p.a} cm, 세로 ${p.b} cm예요. 가로에 대한 세로의 비는 `, B(0), ' : ', B(1)], [p.b, p.a], { bugs: [{ test: (v) => v[0] === p.a && v[1] === p.b, name: '기준량과 비교하는 양을 바꿈', to: null }] })
      : nums([`${p.a} : ${p.b}에서 기준량은 `, B(0)], p.b, { bugs: [{ test: (v) => v[0] === p.a, name: '앞의 수를 기준량으로 봄', to: null }] }),
  },
  {
    id: 'R4', name: '비율', kid: '비율 (분수·소수)', g: '6-1', s: 'R', pre: ['R3', 'F16', 'F11'],
    tip: '비율 = 비교하는 양 ÷ 기준량. 타율·득표율처럼 기준량이 다른 것을 비교할 때 왜 필요한지부터.',
    gen: (r) => { const b = r.pick([2, 4, 5, 10, 20, 25]); let a; do { a = r.int(1, b - 1); } while (gcd(a, b) !== 1); return { v: r.chance(0.5) ? 'frac' : 'dec', a, b }; },
    make: (p) => p.v === 'frac'
      ? frac([`${p.a} : ${p.b}의 비율을 분수로 나타내면 `, fb(0, 1)], F(p.a, p.b), { bugs: [{ test: (v) => eqv(F(v[0], v[1] || 1), F(p.b, p.a)), name: '기준량을 위로 씀', to: 'R3' }] })
      : nums([`${p.a} : ${p.b}의 비율을 소수로 나타내면 `, B(0)], p.a / p.b, { noFrac: true, bugs: [{ test: (v) => near(v[0], p.b / p.a), name: '기준량을 비교하는 양으로 나눔', to: 'R3' }] }),
    steps: (p) => {
      const out = [{ c: 'R3', p: { v: 'base', a: p.a, b: p.b }, why: '기준량이 무엇인가요?' }, { c: 'F16', p: { v: 'small', a: p.a, b: p.b }, why: '비교하는 양 ÷ 기준량' }];
      if (p.v === 'dec') out.push({ c: 'F11', p: { n: p.a, d: p.b }, why: '분수를 소수로 바꿔요.' });
      return out;
    },
  },
  {
    id: 'R5', name: '백분율', kid: '% 로 나타내기', g: '6-1', s: 'R', pre: ['R4', 'F7', 'DEC4'],
    tip: '기준량을 100으로 볼 때의 비율이에요. 100칸 모눈에 칠해 보고, 비율 × 100으로 이어요.',
    gen: (r) => { const d = r.pick([2, 4, 5, 10, 20, 25, 50]); let n; do { n = r.int(1, d - 1); } while (gcd(n, d) !== 1); return r.chance(0.5) ? { v: 'frac', n, d } : { v: 'dec', k: r.int(5, 98) }; },
    make: (p) => p.v === 'frac'
      ? nums([fx(p.n, p.d), ' = ', B(0), '%'], (p.n * 100) / p.d, { bugs: [{ test: (v) => v[0] === p.n, name: '분자를 그대로 씀', to: 'F7' }, { test: (v) => near(v[0], (p.n * 10) / p.d), name: '10을 곱함', to: 'DEC4' }] })
      : nums([`${fmt(p.k / 100)} = `, B(0), '%'], p.k, { bugs: [{ test: (v) => near(v[0], p.k / 10), name: '10을 곱함', to: 'DEC4' }, { test: (v) => near(v[0], p.k / 100), name: '그대로 씀', to: 'DEC4' }] }),
    steps: (p) => (p.v === 'frac'
      ? [{ c: 'F7', p: { v: 'up', n: p.n, d: p.d, k: 100 / p.d }, why: '분모를 100으로 만들어요.' }]
      : [{ c: 'DEC4', p: { v: 'x100', k: p.k }, why: '100배 해요.' }]),
  },
  {
    id: 'R6', name: '비의 성질', kid: '비율이 같은 비', g: '6-2', s: 'R', pre: (p) => ['R3', 'F7', 'R2'],
    tip: '전항과 후항에 같은 수를 곱해도 비율이 같아요. 5학년 크기가 같은 분수(3/4 = 6/8)와 같은 규칙이라는 것을 나란히 써 보여 줘요.',
    gen: (r) => { let a, b; do { a = r.int(1, 7); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1); return { a, b, k: r.int(2, 5) }; },
    make: (p) => nums([`${p.a} : ${p.b} = ${p.a * p.k} : `, B(0)], p.b * p.k, {
      bugs: [{ test: (v) => v[0] === p.b + (p.a * p.k - p.a), name: '같은 수를 더함 (덧셈으로 지키기)', to: 'R2' }],
    }),
    steps: (p) => [
      { c: 'R2', p: { v: 'int', big: p.a * p.k, small: p.a }, why: `${p.a}${P(p.a, '이', '가')} ${p.a * p.k}${P(p.a * p.k, '이', '가')} 되려면 몇 배?` },
      { c: tbl(p.b), p: { a: p.b, b: p.k }, why: `후항 ${p.b}에도 같은 배를 해요.` },
    ],
    bridge: '"3 : 4 = 6 : 8"과 "3/4 = 6/8"이 같은 말이라는 것이 다리예요.',
  },
  {
    id: 'R7', name: '간단한 자연수의 비', kid: '비를 간단히', g: '6-2', s: 'R', pre: (p) => ['R6', p && p.v === 'dec' ? 'DEC4' : p && p.v === 'frac' ? 'G4' : 'G3'],
    tip: '자연수의 비는 최대공약수로, 소수의 비는 10배·100배로, 분수의 비는 분모의 공배수를 곱해요.',
    gen: (r) => {
      const v = r.pick(['int', 'int', 'dec', 'frac']);
      let a, b; do { a = r.int(1, 7); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1);
      if (v === 'int') return { v, a, b, k: r.pick([2, 3, 4, 6]) };
      if (v === 'dec') return { v, a, b };
      let d1, d2; do { d1 = r.int(2, 6); d2 = r.int(2, 6); } while (d1 === d2); return { v, n1: 1, d1, n2: 1, d2 };
    },
    make: (p) => {
      let shown, ta, tb;
      if (p.v === 'int') { shown = `${p.a * p.k} : ${p.b * p.k}`; ta = p.a; tb = p.b; }
      else if (p.v === 'dec') { shown = `${fmt(p.a / 10)} : ${fmt(p.b / 10)}`; const g = gcd(p.a, p.b); ta = p.a / g; tb = p.b / g; }
      else { const L = lcm(p.d1, p.d2); ta = L / p.d1 * p.n1; tb = L / p.d2 * p.n2; const g = gcd(ta, tb); ta /= g; tb /= g; }
      const prompt = p.v === 'frac' ? [fx(p.n1, p.d1), ' : ', fx(p.n2, p.d2), '을 간단한 자연수의 비로 → ', B(0), ' : ', B(1)] : [`${shown}${P(p.v === 'int' ? p.b * p.k : p.b, '을', '를')} 간단한 자연수의 비로 → `, B(0), ' : ', B(1)];
      return {
        prompt, ans: `${ta} : ${tb}`, sol: [ta, tb],
        check(v) {
          if (!Number.isInteger(v[0]) || !Number.isInteger(v[1]) || v[0] <= 0 || v[1] <= 0) return { ok: false };
          const same = v[0] * tb === v[1] * ta;
          if (same && gcd(v[0], v[1]) === 1) return { ok: true };
          if (same) return { ok: false, bug: { name: '끝까지 나누지 않음', to: 'G3' } };
          if (p.v === 'frac' && v[0] === p.d1 && v[1] === p.d2) return { ok: false, bug: { name: '분모를 그대로 비로 씀', to: 'F2' } };
          if (v[0] === tb && v[1] === ta) return { ok: false, bug: { name: '앞뒤를 바꿈', to: 'R3' } };
          return { ok: false };
        },
      };
    },
    steps: (p) => {
      if (p.v === 'int') return [{ c: 'G3', p: { a: p.a * p.k, b: p.b * p.k }, why: '두 수의 최대공약수로 나눠요.' }];
      if (p.v === 'dec') return [{ c: 'DEC4', p: { v: 'x10', k: p.a * 10 }, why: '10배 하면 자연수가 돼요.' }];
      const L = lcm(p.d1, p.d2);
      return [{ c: 'G4', p: { a: p.d1, b: p.d2 }, why: '분모의 최소공배수를 찾아요.' }, { c: 'F14', p: { N: L, n: p.n1, d: p.d1 }, why: '그 수를 곱해요.' }];
    },
  },
  {
    id: 'R8', name: '비례식과 그 성질', kid: '외항의 곱 = 내항의 곱', g: '6-2', s: 'R', pre: ['R6', 'R0'],
    tip: '비율이 같은 두 비를 등호로 놓은 식이에요. 외항의 곱 = 내항의 곱은 두 비율을 통분한 결과라는 것을 보여 줘요(2/3 = 4/6 → 2 × 6 = 3 × 4).',
    gen: (r) => { let a, b; do { a = r.int(1, 7); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1); return { v: r.chance(0.6) ? 'prod' : 'is', a, b, k: r.int(2, 4) }; },
    make: (p) => {
      const A = p.a, Bq = p.b, C = p.a * p.k, D = p.b * p.k;
      if (p.v === 'eq') {
        // a : b = c : d 에서 □ 자리의 곱 (pos 2 = c 모름 → b × □ = a × d / pos 3 = d 모름 → a × □ = b × c)
        return p.pos === 2
          ? nums([`${p.a} : ${p.b} = □ : ${p.d}에서 ${p.b} × □ = ${p.a} × ${p.d} = `, B(0)], p.a * p.d, { bugs: [{ test: (v) => v[0] === p.a * p.b || v[0] === p.b * p.d, name: '외항·내항을 헷갈림', to: null }] })
          : nums([`${p.a} : ${p.b} = ${p.c} : □에서 ${p.a} × □ = ${p.b} × ${p.c} = `, B(0)], p.b * p.c, { bugs: [{ test: (v) => v[0] === p.a * p.b || v[0] === p.a * p.c, name: '외항·내항을 헷갈림', to: null }] });
      }
      if (p.v === 'prod') return nums([`${A} : ${Bq} = ${C} : ${D}에서 외항의 곱은 `, B(0), ', 내항의 곱은 ', B(1)], [A * D, Bq * C], { bugs: [{ test: (v) => v[0] === A * Bq || v[1] === C * D, name: '외항·내항을 헷갈림', to: null }] });
      const good = [`${A} : ${Bq} = ${C} : ${D}`], bad = [`${A} : ${Bq} = ${A + p.k} : ${Bq + p.k}`];
      const right = p.k % 2 ? 0 : 1;
      return pick(['비례식인 것을 고르세요.'], right ? [bad, good] : [good, bad], right, { bugs: { [1 - right]: { name: '같은 수를 더한 비를 고름 (덧셈으로 지키기)', to: 'R6' } } });
    },
  },
  {
    id: 'R9', name: '비례식 풀기', kid: '비례식의 □ 구하기', g: '6-2', s: 'R', pre: (p) => ['R6', 'R8', tbl(p ? p.a : 2)],
    tip: '두 방법을 다 보여 줘요: 비의 성질(4가 12가 되려면 3배 → 3도 3배)과 비례식의 성질(4 × □ = 3 × 12).',
    gen: (r) => { let a, b; do { a = r.int(1, 8); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1); const k = r.int(2, 6); return { a, b, c: a * k, d: b * k, pos: r.chance(0.6) ? 2 : 3 }; },
    make: (p) => {
      // a : b = c : d — pos 2면 c, pos 3이면 d가 □
      const prompt = p.pos === 2 ? [`${p.a} : ${p.b} = `, B(0), ` : ${p.d}`] : [`${p.a} : ${p.b} = ${p.c} : `, B(0)];
      const ans = p.pos === 2 ? (p.a * p.d) / p.b : (p.b * p.c) / p.a;
      const add = p.pos === 2 ? p.a + (p.d - p.b) : p.b + (p.c - p.a);
      return nums(prompt, ans, { bugs: [{ test: (v) => near(v[0], add), name: '같은 수를 더함 (덧셈으로 지키기)', to: 'R2' }] });
    },
    steps: (p) => {
      const [known, base, other] = p.pos === 2 ? [p.d, p.b, p.a] : [p.c, p.a, p.b];
      if (known % base === 0 && known / base <= 9 && other <= 9) {
        const k = known / base;
        return [
          { c: 'R2', p: { v: 'int', big: known, small: base }, why: `${base}${P(base, '이', '가')} ${known}${P(known, '이', '가')} 되려면 몇 배?` },
          { c: tbl(other), p: { a: other, b: k }, why: `${other}에도 같은 배를 해요.` },
        ];
      }
      return [{ c: 'R8', p: { v: 'eq', a: p.a, b: p.b, c: p.c, d: p.d, pos: p.pos }, why: '외항의 곱 = 내항의 곱으로 식을 세워요.' }];
    },
  },
  {
    id: 'R10', name: '비례배분', kid: '비로 나누기', g: '6-2', s: 'R', pre: ['R3', 'F14', 'A1'],
    tip: '전체를 (앞 항 + 뒤 항) 조각으로 보고 각자 몇 조각인지 봐요: 35를 3 : 4로 → 7조각 중 3조각, 4조각.',
    gen: (r) => { let a, b; do { a = r.int(1, 6); b = r.int(1, 6); } while (a === b || gcd(a, b) !== 1 || a + b > 10); return { a, b, N: (a + b) * r.int(2, 9) }; },
    make: (p) => {
      const s = p.a + p.b, x = (p.N * p.a) / s, y = (p.N * p.b) / s;
      return nums([`${J(p.N, '을', '를')} ${p.a} : ${RO(p.b)} 나누면 `, B(0), ', ', B(1)], [x, y], {
        bugs: [
          { test: (v) => near(v[0], (p.N * p.a) / p.b), name: '전체를 잘못 잡음 (뒤 항을 전체로 봄)', to: 'F4' },
          { test: (v) => near(v[0], y) && near(v[1], x), name: '순서를 바꿈', to: 'R3' },
          { test: (v) => near(v[0], p.N / 2), name: '반으로 나눔', to: 'R3' },
        ],
      });
    },
    steps: (p) => [
      { c: 'A1', p: { a: p.a, b: p.b }, why: '전체를 몇 조각으로 보나요?' },
      { c: 'F14', p: { N: p.N, n: p.a, d: p.a + p.b }, why: `${p.N}의 ${p.a}/${p.a + p.b}` },
      { c: 'F14', p: { N: p.N, n: p.b, d: p.a + p.b }, why: `${p.N}의 ${p.b}/${p.a + p.b}` },
    ],
  },
];
