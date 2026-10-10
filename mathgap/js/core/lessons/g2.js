// 2학년 차시 (국정 2-1 · 2-2 재구성) — 정의 방법은 docs/LESSONS.md
// FAMS: 이 학년에서 새로 만든 문항 가족 · LESSONS: 차시 정의
//   기존 개념 가족(N5·A7·M1·M2·U1)을 쓰는 차시는 그 가족의 모양을 그대로 받고, 필요한 갈래만 차시 make에 더한다.
import { nums, pick, B, J, P } from '../concepts/kit.js';
import { groups } from '../tokens.js';
import NUM from '../concepts/num.js';
import MULC from '../concepts/mul.js';
import { isKind, addKind, subKind, danOf, ones, tens, makeBy } from './ops.js';
import { until, sino, JW, PJ, anyOf, choose, addBugs } from './g1.js';

const BASE = Object.fromEntries([...NUM, ...MULC].map((c) => [c.id, c]));
const SIN = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const UN = ['', '십', '백', '천'];
const PL = ['일', '십', '백', '천'];
const len = (n) => String(n).length;
const dig = (n, i) => Math.floor(n / 10 ** i) % 10;
const noZero = (n) => Number(String(n).replace(/0/g, '') || 0);
// 0이 있는 자리를 '영'으로 읽기 (406 → 사백영육) · 1을 '일'로 읽기 (115 → 일백일십오) — 오답 보기
function readZero(n) {
  const ds = String(n).split('').map(Number), L = ds.length;
  let last = L - 1; while (last > 0 && ds[last] === 0) last--;
  return ds.map((d, i) => (i > last ? '' : !d ? '영' : (d === 1 && L - 1 - i > 0 ? '' : SIN[d]) + UN[L - 1 - i])).join('');
}
const readOne = (n) => String(n).split('').map(Number).map((d, i, ds) => (!d ? '' : SIN[d] + UN[ds.length - 1 - i])).join('');
// 자리 수가 L인 수 (zero: 0인 자리가 나올 확률)
const numL = (r, L, zero = 0.3) => { const ds = [r.int(1, 9)]; for (let i = 1; i < L; i++) ds.push(r.chance(zero) ? 0 : r.int(1, 9)); return Number(ds.join('')); };

// ── 기존 개념 가족에 갈래를 더한 make
// N5 자릿값 — {v:'digit', n, i} 숫자가 나타내는 값 · {v:'which', n, i} 자리의 숫자 · {v:'expand', n, i} 몇백 + 몇십 + 몇 (i 자리가 빈칸)
//   그 밖의 모양({v:'tens',k}·{v:'regroup',…})은 원래 N5 make로
function placeMake(p) {
  if (!['digit', 'which', 'expand'].includes(p.v)) return BASE.N5.make(p);
  const n = p.n, L = len(n), low = L === 3 ? '1-2-1:3' : '2-1-1:5', d = dig(n, p.i), val = d * 10 ** p.i;
  if (p.v === 'digit') {
    return nums([`${n}에서 숫자 ${d}${P(d, '은', '는')} 얼마를 나타내나요? `, B(0)], val, {
      bugs: [{ test: (v) => v[0] === d, name: '숫자만 씀 (자리의 값을 붙이지 않음)', to: low }, { test: (v) => v[0] === val * 10 || v[0] * 10 === val, name: '자리를 하나 잘못 봄', to: low }],
    });
  }
  if (p.v === 'which') {
    return nums([`${n}에서 ${PL[p.i]}의 자리 숫자는 `, B(0)], d, {
      bugs: [{ test: (v) => d > 0 && v[0] === val, name: '숫자 대신 나타내는 값을 씀', to: null }, { test: (v) => v[0] === dig(n, L - 1 - p.i), name: '자리를 거꾸로 셈', to: low }],
    });
  }
  const toks = [`${n} = `];
  let j = 0;
  for (let i = L - 1; i >= 0; i--) {
    if (!dig(n, i)) continue;
    if (j++) toks.push(' + ');
    toks.push(i === p.i ? B(0) : String(dig(n, i) * 10 ** i));
  }
  return nums(toks, val, { bugs: [{ test: (v) => v[0] === d, name: '숫자만 씀 (자리의 값을 붙이지 않음)', to: low }] });
}
const placeGen = (L) => (r) => {
  const v = r.pick(['digit', 'digit', 'which', 'expand']);
  return until(r, (r) => ({ v, n: numL(r, L, v === 'which' ? 0.3 : 0.2), i: r.int(0, L - 1) }), (p) => {
    const d = dig(p.n, p.i), ds = String(p.n).split('');
    if (p.v === 'digit') return d > 0 && ds.filter((x) => Number(x) === d).length === 1;
    if (p.v === 'expand') return d > 0 && ds.filter((x) => x !== '0').length >= 2;
    return true;
  });
};
// U1 길이 — {m, cm} m·cm → cm (원래 U1) · {v:'rev', m, cm} cm → m·cm · {v:'m', m} m → cm
function lenMake(p) {
  const all = p.m * 100 + (p.cm || 0);
  if (p.v === 'rev' && !p.cm) return nums([`${all} cm = `, B(0), ' m'], p.m, { bugs: [{ test: (v) => v[0] === all / 10 || v[0] === all, name: '1 m가 100 cm인 것을 헷갈림', to: '2-1-1:3' }] });
  if (p.v === 'rev') {
    return nums([`${all} cm = `, B(0), ' m ', B(1), ' cm'], [p.m, p.cm], {
      bugs: [{ test: (v) => v[0] === Math.floor(all / 10) && v[1] === all % 10, name: '1 m를 10 cm로 봄', to: '2-1-1:5' }, { test: (v) => v[0] === p.m && v[1] !== p.cm, name: 'cm 부분을 잘못 씀', to: '2-1-1:5' }],
    });
  }
  if (p.v === 'm' || !p.cm) {
    return nums([`${p.m} m = `, B(0), ' cm'], all, { bugs: [{ test: (v) => v[0] === p.m * 10 || v[0] === p.m * 1000, name: '1 m가 100 cm인 것을 헷갈림', to: '2-1-1:3' }, { test: (v) => v[0] === p.m, name: 'm의 수를 그대로 씀', to: '2-1-1:3' }] });
  }
  return nums([`${p.m} m ${p.cm} cm = `, B(0), ' cm'], all, {
    bugs: [{ test: (v) => p.cm < 10 && v[0] === Number(`${p.m}${p.cm}`), name: '빈 자리에 0을 쓰지 않음', to: '2-1-1:5' },
      { test: (v) => v[0] === p.m + p.cm, name: '단위를 생각하지 않고 더함', to: '2-1-1:5' },
      { test: (v) => v[0] === p.m * 1000 + p.cm || v[0] === p.m * 10 + p.cm, name: '1 m가 100 cm인 것을 헷갈림', to: '2-1-1:3' }],
  });
}

// ── 이 학년의 새 가족
const skipTerms = (p) => Array.from({ length: 5 }, (_, i) => p.s + p.d * (p.dir || 1) * i);
const cmpLen = (p) => len(Math.max(p.a, p.b));

const FAMS = [
  {
    id: 'g2_BIG', s: 'N', sec: 8,
    tip: '수 모형으로 십 모형 10개를 백 모형 1개로(백 모형 10개를 천 모형 1개로) 바꿔 보고, 99·990·999 바로 다음 수를 세어 봐요.',
    // {base:100|1000, v:'up', k} x보다 k만큼 더 큰 수 · {v:'gap', k} base는 x보다 □만큼 큼 · {v:'cnt'|'tensto', u} base는 u가 □개
    make: (p) => {
      const b = p.base, x = b - (p.k || 0), low = b === 100 ? '1-2-1:2' : '2-1-1:3';
      if (p.v === 'up') {
        return nums([`${x}보다 ${p.k}만큼 더 큰 수는 `, B(0)], b, {
          bugs: [{ test: (v) => v[0] === b * 10 || v[0] * 10 === b, name: '0의 개수를 틀림', to: low },
            { test: (v) => p.k >= 10 && v[0] === x + Number(String(p.k)[0]), name: '몇십(몇백)만큼을 몇만큼으로 셈', to: b === 100 ? '1-2-1:4' : '2-1-1:6' }],
        });
      }
      if (p.v === 'gap') return nums([`${b}은 ${x}보다 `, B(0), '만큼 더 큰 수예요.'], p.k, { bugs: [{ test: (v) => v[0] === p.k * 10 || v[0] * 10 === p.k, name: '자리를 잘못 봄', to: low }] });
      const ans = b / p.u;
      const bugs = [{ test: (v) => v[0] === ans * 10 || v[0] * 10 === ans, name: '0의 개수를 틀림', to: low }];
      if (p.v === 'tensto') return nums([`${p.u}이 `, B(0), `개이면 ${b}이에요.`], ans, { bugs });
      return nums([`${b}은 ${p.u}이 `, B(0), '개인 수예요.'], ans, { bugs });
    },
  },
  {
    id: 'g2_MANY', s: 'N', sec: 8,
    tip: '백(천) 모형을 하나씩 늘어놓으며 "백, 이백, 삼백…"으로 세어요. 칠백은 100이 7개라서 0을 두 개 써요.',
    // {u:100|1000, k, v:'units'|'count'|'word'|'read', o(보기 순서)}
    make: (p) => {
      const n = p.k * p.u, low = p.u === 100 ? '1-2-1:2' : '2-1-1:3', w = sino(n);
      if (p.v === 'count') return nums([`${n}은 ${p.u}이 `, B(0), '개인 수예요.'], p.k, { bugs: [{ test: (v) => v[0] === p.k * 10 || v[0] === n, name: '0의 개수를 틀림', to: low }] });
      if (p.v === 'word') {
        return nums([`'${w}'${PJ(w, '을', '를')} 수로 쓰면 `, B(0)], n, {
          bugs: [{ test: (v) => v[0] === Number(`${p.k}${p.u}`), name: '읽은 대로 이어 씀', to: low }, { test: (v) => v[0] * 10 === n || v[0] === n * 10, name: '0의 개수를 틀림', to: low }],
        });
      }
      if (p.v === 'read') {
        const wr = [sino(n / 10), sino(((p.k % 9) + 1) * p.u)];
        return choose([`${J(n, '을', '를')} 바르게 읽은 것을 고르세요.`], w, wr, p.o, [{ name: '자리를 하나 잘못 읽음', to: low }, { name: '다른 수로 읽음', to: null }]);
      }
      return nums([`${p.u}이 ${p.k}개이면 `, B(0)], n, { bugs: [{ test: (v) => v[0] * 10 === n || v[0] === n * 10, name: '0의 개수를 틀림', to: low }, { test: (v) => v[0] === p.u + p.k, name: `${p.u}에 개수를 더함`, to: null }] });
    },
  },
  {
    id: 'g2_NUM', s: 'N', sec: 12,
    tip: '수 모형을 자리마다 놓고 수를 써요. 빈 자리(0)도 꼭 0으로 써야 한다는 것을 "406 ↔ 46"처럼 비교해 보여 줘요.',
    // {n, v:'comp'|'word'|'read', o}
    make: (p) => {
      const n = p.n, L = len(n), low = L === 3 ? '1-2-1:3' : '2-1-1:4', w = sino(n);
      const zbug = { test: (v) => noZero(n) !== n && v[0] === noZero(n), name: '빈 자리에 0을 쓰지 않음', to: low };
      if (p.v === 'word') return nums([`'${w}'${PJ(w, '을', '를')} 수로 쓰면 `, B(0)], n, { bugs: [zbug] });
      if (p.v === 'read') {
        const cand = [[readZero(n), '0인 자리를 영으로 읽음'], [readOne(n), '1을 일로 읽음'], [sino(noZero(n)), '0인 자리를 빼고 읽음'], [sino(n + 10 < 10 ** L ? n + 10 : n - 10), '다른 수로 읽음'], [sino(n - 1), '다른 수로 읽음']];
        const wr = [];
        for (const [x, nm] of cand) if (x !== w && !wr.some((y) => y[0] === x) && wr.length < 2) wr.push([x, nm]);
        return choose([`${J(n, '을', '를')} 바르게 읽은 것을 고르세요.`], w, wr.map((x) => x[0]), p.o, wr.map((x) => ({ name: x[1], to: x[1] === '다른 수로 읽음' ? null : low })));
      }
      const parts = [];
      for (let i = L - 1; i >= 0; i--) if (dig(n, i)) parts.push(`${10 ** i}이 ${dig(n, i)}개`);
      return nums([`${parts.join(', ')}인 수는 `, B(0)], n, { bugs: [zbug] });
    },
  },
  {
    id: 'g2_SKIP', s: 'N', sec: 15,
    tip: '수 모형을 하나씩 더하며 어느 자리 숫자가 바뀌는지 보게 해요. 10씩 뛰어 세면 십의 자리가, 100씩이면 백의 자리가 1씩 커져요.',
    // {s, d, dir:±1, v:'fill'|'step', miss:[칸]}
    make: (p) => {
      const terms = skipTerms(p), low = Math.max(...terms) < 1000 ? '2-1-1:5' : '2-2-1:5';
      if (p.v === 'step') {
        return nums(['몇씩 뛰어 세었나요?', { br: 1 }, terms.join(', '), { br: 1 }, B(0), '씩'], p.d, { bugs: [{ test: (v) => v[0] === p.d * 10 || v[0] * 10 === p.d, name: '바뀐 자리를 잘못 봄', to: low }] });
      }
      const toks = [`${p.d}씩 ${p.dir < 0 ? '거꾸로 ' : ''}뛰어 세어 보세요.`, { br: 1 }], ans = [];
      terms.forEach((t, i) => { if (i) toks.push(', '); if (p.miss.includes(i)) { toks.push(B(ans.length)); ans.push(t); } else toks.push(String(t)); });
      return nums(toks, ans, {
        bugs: [{ test: (v) => ans.some((a, i) => v[i] !== a && (Math.abs(v[i] - a) === p.d * 10 || Math.abs(v[i] - a) * 10 === p.d || (p.d >= 10 && Math.abs(v[i] - a) === p.d / 10))), name: '다른 자리 숫자를 바꿈', to: low }],
      });
    },
  },
  {
    id: 'g2_CMP', s: 'N', sec: 8,
    tip: '두 수를 자리를 맞춰 위아래로 쓰고, 가장 높은 자리부터 차례로 비교해요. 높은 자리에서 정해지면 아래 자리는 보지 않아요.',
    // {v:'sym', a, b} > < 고르기 · {v:'max', a, b, c, lo, o} 가장 큰(작은) 수
    make: (p) => {
      const low = cmpLen(p) === 3 ? '2-1-1:5' : '2-2-1:5';
      const trap = (big, sm) => ones(sm) > ones(big) || tens(sm) > tens(big);
      if (p.v === 'max') {
        const ns = [p.a, p.b, p.c], want = p.lo ? Math.min(...ns) : Math.max(...ns), others = ns.filter((x) => x !== want);
        return choose([p.lo ? '가장 작은 수를 고르세요.' : '가장 큰 수를 고르세요.'], want, others, p.o,
          others.map((x) => ({ name: (p.lo ? trap(x, want) : trap(want, x)) ? '높은 자리부터 비교하지 않음' : '크기를 잘못 비교함', to: low })));
      }
      const right = p.a > p.b ? 0 : 1, big = Math.max(p.a, p.b), sm = Math.min(p.a, p.b);
      return pick(['○ 안에 >, < 중 알맞은 것을 고르세요.', { br: 1 }, `${p.a} ○ ${p.b}`], [['>'], ['<']], right, {
        bugs: { [1 - right]: trap(big, sm) ? { name: '높은 자리부터 비교하지 않음', to: low } : { name: '>와 <를 헷갈림', to: null } },
      });
    },
  },
  {
    id: 'g2_MIX3', s: 'A', sec: 30,
    tip: '세 수의 계산은 앞에서부터 차례로 해요. 첫 계산의 답을 식 위에 작게 써 두게 하면 순서를 지키기 쉬워요.',
    // {a, o1:'+'|'-', b, o2, c} 앞에서부터
    make: (p) => {
      const f = (x, o, y) => (o === '+' ? x + y : x - y), sym = (o) => (o === '+' ? '+' : '−');
      const r1 = f(p.a, p.o1, p.b), ans = f(r1, p.o2, p.c), rtl = f(p.a, p.o1, f(p.b, p.o2, p.c));
      return nums([`${p.a} ${sym(p.o1)} ${p.b} ${sym(p.o2)} ${p.c} = `, B(0)], ans, {
        bugs: [{ test: (v) => rtl !== ans && v[0] === rtl, name: '뒤의 두 수를 먼저 계산함', to: null }, { test: (v) => v[0] === r1, name: '앞의 두 수만 계산함', to: null }],
      });
    },
    steps: (p) => {
      const r1 = p.o1 === '+' ? p.a + p.b : p.a - p.b;
      return [{ c: p.o1 === '+' ? 'ADD' : 'SUB', p: { a: p.a, b: p.b }, why: '앞의 두 수를 먼저 계산해요.' }, { c: p.o2 === '+' ? 'ADD' : 'SUB', p: { a: r1, b: p.c }, why: '그 결과와 남은 수를 계산해요.' }];
    },
  },
  {
    id: 'g2_REL', s: 'A', sec: 25,
    tip: '세 수(예: 17, 25, 42)로 덧셈식 2개와 뺄셈식 2개를 만들어, 가장 큰 수가 덧셈식에서는 합이고 뺄셈식에서는 맨 앞의 수(빼지는 수)임을 보여 줘요.',
    // {x, y, v:'a2s'|'s2a'|'one', f}
    make: (p) => {
      const s = p.x + p.y;
      if (p.v === 'a2s') {
        return anyOf([`덧셈식 ${p.x} + ${p.y} = ${s}${P(s, '을', '를')} 보고 뺄셈식을 만들어 보세요.`, { br: 1 }, B(0), ' − ', B(1), ' = ', B(2)], [[s, p.x, p.y], [s, p.y, p.x]], {
          bugs: [{ test: (v) => v[0] !== s, name: '가장 큰 수(합)에서 빼야 함을 모름', to: '1-1-3:13' }],
        });
      }
      if (p.v === 's2a') {
        return anyOf([`뺄셈식 ${s} − ${p.x} = ${p.y}${P(p.y, '을', '를')} 보고 덧셈식을 만들어 보세요.`, { br: 1 }, B(0), ' + ', B(1), ' = ', B(2)], [[p.x, p.y, s], [p.y, p.x, s]], {
          bugs: [{ test: (v) => v[2] !== s, name: '가장 큰 수가 합이 됨을 모름', to: '1-1-3:13' }],
        });
      }
      const [k, ans] = p.f ? [p.x, p.y] : [p.y, p.x];
      return nums(['덧셈식을 보고 □에 알맞은 수를 쓰세요.', { br: 1 }, `${p.x} + ${p.y} = ${s}`, { br: 1 }, `${s} − ${k} = `, B(0)], ans, {
        bugs: [{ test: (v) => v[0] === s + k, name: '빼야 할 때 더함', to: '1-1-3:13' }, { test: (v) => v[0] === k, name: '빼는 수를 그대로 씀', to: null }],
      });
    },
  },
  {
    id: 'g2_SUBBOX', s: 'A', sec: 18,
    tip: '□ − 5 = 8은 "8에 5를 더하면 □", 13 − □ = 8은 "13에서 8을 빼면 □"예요. 덧셈과 뺄셈의 관계로 바꿔 쓰게 해요.',
    // {a, b, pos:1|2}: pos 1 → □ − b = c · pos 2 → a − □ = c
    make: (p) => {
      const c = p.a - p.b;
      if (p.pos === 1) return nums([B(0), ` − ${p.b} = ${c}`], p.a, { bugs: [{ test: (v) => v[0] === c - p.b, name: '더해야 할 때 뺌', to: '2-1-3:9' }, { test: (v) => v[0] === c, name: '보이는 수를 그대로 씀', to: null }] });
      return nums([`${p.a} − `, B(0), ` = ${c}`], p.b, { bugs: [{ test: (v) => v[0] === p.a + c, name: '빼야 할 때 더함', to: '2-1-3:9' }] });
    },
    steps: (p) => {
      const c = p.a - p.b;
      return p.pos === 1 ? [{ c: 'ADD', p: { a: c, b: p.b }, why: `□는 ${J(c, '과', '와')} ${J(p.b, '을', '를')} 더한 수예요.` }] : [{ c: 'SUB', p: { a: p.a, b: c }, why: `□는 ${p.a}에서 ${J(c, '을', '를')} 뺀 수예요.` }];
    },
  },
  {
    id: 'g2_MULEQ', s: 'M', sec: 12,
    tip: '"3씩 4묶음 = 3의 4배 = 3 + 3 + 3 + 3 = 3 × 4"를 한 줄로 이어 써 보며, ×는 같은 수를 여러 번 더하는 것을 짧게 쓴 것임을 보여 줘요.',
    // {a, k, v:'add2mul'|'mul2add'|'bae'}
    make: (p) => {
      const n = p.a * p.k;
      if (p.v === 'add2mul') {
        return nums([`${Array(p.k).fill(p.a).join(' + ')} = ${p.a} × `, B(0)], p.k, { bugs: [{ test: (v) => v[0] === n, name: '곱 대신 합을 씀', to: null }, { test: (v) => v[0] === p.a, name: '더한 수를 씀 (몇 번 더했는지 아님)', to: '2-1-6:4' }] });
      }
      if (p.v === 'mul2add') {
        return nums([`${p.a} × ${p.k}${P(p.k, '은', '는')} ${J(p.a, '을', '를')} `, B(0), '번 더한 것과 같아요.'], p.k, { bugs: [{ test: (v) => v[0] === p.a, name: '곱하는 수와 곱해지는 수를 헷갈림', to: '2-1-6:4' }] });
      }
      return nums([`${p.a}의 ${p.k}배를 곱셈식으로 나타내면 ${p.a} × `, B(0), ' = ', B(1)], [p.k, n], { bugs: [{ test: (v) => v[1] === p.a + p.k, name: '곱을 덧셈으로 구함', to: '2-1-6:4' }] });
    },
    steps: (p) => [{ c: 'M2', p: { a: p.a, k: p.k }, why: `${p.a}의 ${p.k}배가 얼마인지 먼저 생각해요.` }],
  },
  {
    id: 'g2_MULPIC', s: 'M', sec: 20,
    tip: '그림을 보고 "몇씩 몇 묶음"을 먼저 말하게 한 뒤 곱셈식으로 써요. 한 묶음의 수를 앞에 쓰는 것이 교과서 순서예요(순서를 바꿔도 곱은 같아요).',
    // {n(한 묶음), k(묶음 수), v:'pic'|'story', o, box}
    make: (p) => {
      const nk = p.n * p.k, box = ['접시', '봉지', '상자', '바구니'][p.box || 0], o = ['사탕', '쿠키', '귤', '구슬', '딸기'][p.o || 0];
      const lead = p.v === 'pic' ? [{ svg: groups(p.k, p.n) }, '모두 몇 개인지 곱셈식으로 나타내 보세요.'] : [`한 ${box}에 ${JW(o, '이', '가')} ${p.n}개씩 ${p.k}${box} 있어요. 모두 몇 개인지 곱셈식으로 나타내 보세요.`];
      return anyOf([...lead, { br: 1 }, B(0), ' × ', B(1), ' = ', B(2)], [[p.n, p.k, nk], [p.k, p.n, nk]], {
        bugs: [{ test: (v) => v[2] === p.n + p.k, name: '곱 대신 두 수를 더함', to: '2-1-6:6' },
          { test: (v) => ((v[0] === p.n && v[1] === p.k) || (v[0] === p.k && v[1] === p.n)) && v[2] !== nk, name: '곱을 잘못 셈', to: '2-1-6:4' }],
      });
    },
    steps: (p) => [{ c: 'M1', p: { k: p.k, n: p.n }, why: '몇씩 몇 묶음인지 먼저 세어요.' }],
  },
  {
    id: 'g2_TABLE', s: 'M', sec: 10,
    tip: '곱셈표를 색칠하며 규칙을 찾게 해요: ■단은 ■씩 커지고, 3 × 5와 5 × 3처럼 곱하는 두 수를 바꿔도 곱이 같아요.',
    // {v:'swap', a, b} · {v:'row', a, j(시작 칸), m(빈칸)} · {v:'rule', a}
    make: (p) => {
      if (p.v === 'swap') return nums(['곱셈표에서 곱이 같은 칸을 찾아요.', { br: 1 }, `${p.a} × ${p.b} = ${p.b} × `, B(0)], p.a, { bugs: [{ test: (v) => v[0] === p.a * p.b, name: '곱을 씀', to: null }, { test: (v) => v[0] === p.b && p.a !== p.b, name: '같은 수를 씀', to: null }] });
      if (p.v === 'row') {
        const xs = [0, 1, 2, 3].map((i) => p.a * (p.j + i));
        const toks = [`곱셈표의 ${p.a}단 줄이에요. □에 알맞은 수를 쓰세요.`, { br: 1 }];
        xs.forEach((x, i) => { if (i) toks.push(', '); toks.push(i === p.m ? B(0) : String(x)); });
        return nums(toks, xs[p.m], { bugs: [{ test: (v) => Math.abs(v[0] - xs[p.m]) === p.a, name: '한 칸 어긋남', to: danOf(p.a) }] });
      }
      return nums([`곱셈표에서 ${p.a}단의 곱은 `, B(0), '씩 커져요.'], p.a, { bugs: [{ test: (v) => v[0] === 1, name: '곱하는 수만 봄', to: null }] });
    },
  },
];

// ── 차시
const mulDan = (set) => (r) => ({ a: r.pick(set), b: r.int(1, 9) });
const MULPRE = ['2-1-6:4', '2-1-6:6'];
const skipGen = (L) => (r) => {
  const lo = 10 ** (L - 1), hi = 10 * lo - 1, d = r.pick(L === 3 ? [1, 10, 10, 100, 100] : [1, 10, 100, 100, 1000, 1000]);
  const v = r.chance(0.3) ? 'step' : 'fill', dir = v === 'fill' && r.chance(0.25) ? -1 : 1;
  const s = dir > 0 ? r.int(lo, hi - 4 * d) : r.int(lo + 4 * d, hi);
  const m1 = r.int(1, 4), m2 = r.chance(0.5) ? null : r.int(0, 4);
  return { s, d, dir, v, miss: [...new Set([m1, m2].filter((x) => x != null))].sort((x, y) => x - y) };
};
// 세 자리·네 자리 수 쓰고 읽기 — 몇백·몇천은 앞 차시라 빼고, 읽기 문제는 0이나 1이 든 수(실제로 틀리는 수)를 주로
const numGen = (L) => (r) => {
  const v = r.pick(['comp', 'word', 'read']), z = v === 'read' && r.chance(0.75);
  const n = until(r, (r) => numL(r, L, z ? 0.45 : 0.3), (x) => x % 10 ** (L - 1) !== 0 && (!z || /[01]/.test(String(x).slice(1))));
  return { n, v, o: r.int(0, 2) };
};
// L자리 수 두 개 (위에서 i째 자리부터 다름 · 아래 자리는 아무렇게나 → 아래 자리가 더 큰 함정이 저절로 섞임)
const cmpGen = (L) => (r) => {
  const near = (r, a) => {
    const ds = String(a).split('').map(Number), i = r.int(0, L - 1), bs = ds.slice();
    bs[i] = until(r, (r) => r.int(i === 0 ? 1 : 0, 9), (x) => x !== ds[i]);
    for (let j = i + 1; j < L; j++) bs[j] = r.int(0, 9);
    return Number(bs.join(''));
  };
  const a = numL(r, L, 0.15);
  if (r.chance(0.7)) return { v: 'sym', a, b: near(r, a) };
  return until(r, (r) => ({ v: 'max', a, b: near(r, a), c: near(r, a), lo: r.chance(0.4), o: r.int(0, 2) }), (p) => new Set([p.a, p.b, p.c]).size === 3);
};

// 받아올림 덧셈: 일의 자리 합을 받아올리지 않고 그대로 붙여 쓴 모양 (27 + 5 → 212 · 38 + 45 → 713)
const carryAddMake = (p) => {
  const os = ones(p.a) + ones(p.b), ts = tens(p.a) + tens(p.b);
  return addBugs(makeBy({ ...p, fam: 'ADD' }), [{ test: (v) => os >= 10 && v[0] === ts * 100 + os, name: '일의 자리 합을 그대로 붙여 씀', to: '2-1-1:5' }]);
};
// 받아내림 뺄셈: 십 하나를 낱개 10으로 풀고 십의 자리에서 1을 빼지 않은 모양 (52 − 27 → 35)
const borrowSubMake = (p) => addBugs(makeBy({ ...p, fam: 'SUB' }), [{ test: (v) => ones(p.a) < ones(p.b) && v[0] === p.a - p.b + 10, name: '받아내린 십의 자리에서 1을 빼지 않음', to: '2-1-1:5' }]);
// 곱셈구구: 곱셈을 덧셈으로 · 0과 1의 곱을 헷갈린 모양
const danMake = (p) => addBugs(makeBy({ ...p, fam: 'MUL' }), [
  { test: (v) => (p.a === 0 || p.b === 0) && p.a + p.b > 0 && v[0] === p.a + p.b, name: '0을 곱해도 그 수 그대로라고 봄', to: '1-1-3:12' },
  { test: (v) => (p.a === 1 || p.b === 1) && p.a * p.b !== 1 && v[0] === 1, name: '1을 곱하면 1이 된다고 봄', to: '2-1-6:4' },
  { test: (v) => p.a * p.b !== p.a + p.b && v[0] === p.a + p.b, name: '곱셈을 덧셈으로 함', to: '2-1-6:6' },
]);

export default {
  FAMS,
  LESSONS: [
    // ── 2-1-1 세 자리 수
    {
      id: '2-1-1:2', fam: 'g2_BIG', name: '백 알기', kid: '100 알기', sec: 8,
      gen: (r) => { const v = r.pick(['up', 'up', 'gap', 'cnt', 'tensto']); return v === 'up' || v === 'gap' ? { base: 100, v, k: r.pick([1, 2, 3, 5, 10, 20, 30, 50]) } : { base: 100, v, u: r.pick([10, 10, 1]) }; },
      is: (p) => p.base === 100, prev: null, pre: ['1-2-1:4'],
      hint: '99보다 1만큼 더 큰 수, 90보다 10만큼 더 큰 수가 100이에요. 100은 10이 10개예요.',
    },
    {
      id: '2-1-1:3', fam: 'g2_MANY', name: '몇백 알기', kid: '몇백 (200, 300…)', sec: 8,
      gen: (r) => ({ u: 100, k: r.int(2, 9), v: r.pick(['units', 'count', 'word', 'read']), o: r.int(0, 2) }),
      is: (p) => p.u === 100, prev: '2-1-1:2', pre: [],
      hint: '100이 3개이면 300이고 삼백이라고 읽어요. 0을 두 개 써요.',
    },
    {
      id: '2-1-1:4', fam: 'g2_NUM', name: '세 자리 수 쓰고 읽기', kid: '세 자리 수 알기', sec: 12,
      gen: numGen(3),
      is: (p) => len(p.n) === 3, prev: '2-1-1:3', pre: [],
      hint: '100이 4개, 1이 6개이면 406이에요. 10이 없는 십의 자리에는 0을 써요. 사백육이라고 읽어요.',
    },
    {
      id: '2-1-1:5', fam: 'N5', name: '세 자리 수의 자릿값', kid: '각 자리 숫자가 나타내는 값 (세 자리)', sec: 10, def: true,
      gen: placeGen(3), make: placeMake, is: (p) => p.n != null && len(p.n) === 3, prev: '2-1-1:4', pre: ['1-2-1:3'],
      hint: '352에서 3은 백의 자리라서 300, 5는 십의 자리라서 50, 2는 2를 나타내요.',
      tip: '수 모형(백·십·일)으로 수를 만들고 자리마다 나타내는 값을 말하게 해요(352 = 300 + 50 + 2). 같은 숫자라도 자리에 따라 값이 달라지는 수(333 등)를 꼭 다뤄요.',
    },
    {
      id: '2-1-1:6', fam: 'g2_SKIP', name: '뛰어 세기 (세 자리)', kid: '1씩·10씩·100씩 뛰어 세기', sec: 15,
      gen: skipGen(3), is: (p) => Math.max(...skipTerms(p)) < 1000, prev: '2-1-1:5', pre: [],
      hint: '100씩 뛰어 세면 백의 자리 숫자가 1씩 커져요. 350, 450, 550… 10씩이면 십의 자리가 커져요.',
    },
    {
      id: '2-1-1:7', fam: 'g2_CMP', name: '세 자리 수의 크기 비교', kid: '세 자리 수 크기 비교', sec: 8,
      gen: cmpGen(3), is: (p) => cmpLen(p) === 3, prev: '2-1-1:5', pre: ['1-2-1:5'],
      hint: '백의 자리부터 비교하고, 같으면 십의 자리, 그다음 일의 자리를 비교해요. 452와 461은 십의 자리가 5 < 6이라서 452 < 461!',
    },
    // ── 2-1-3 덧셈과 뺄셈 (덧셈 2~4 · 뺄셈 5~7 · 세 수 8 · 관계와 □ 9~11)
    {
      id: '2-1-3:2', fam: 'ADD', name: '받아올림 (두 자리)+(한 자리)', kid: '두 자리 수 + 한 자리 수 (받아올림)', sec: 12,
      gen: (r) => until(r, (r) => { const big = r.int(11, 89), small = r.int(2, 9); return r.chance(0.2) ? { a: small, b: big } : { a: big, b: small }; }, (p) => addKind(p.a, p.b) === '2-1-3:2' && p.a + p.b <= 99),
      make: carryAddMake, is: isKind('ADD', '2-1-3:2'), prev: null, pre: ['1-2-6:2', '1-2-2:2'],
      steps: (p) => {
        const big = Math.max(p.a, p.b), small = Math.min(p.a, p.b), t = big - ones(big), s1 = ones(big) + small;
        return [{ c: 'ADD', p: { a: ones(big), b: small }, why: '일의 자리끼리 더해요.' }, { c: 'ADD', p: { a: t, b: s1 }, why: `${t}에 ${J(s1, '을', '를')} 더해요.` }];
      },
      hint: '일의 자리끼리 더해 10이 넘으면 십의 자리로 1을 올려요. 27 + 5 → 7 + 5 = 12, 20 + 12 = 32!',
      tip: '수 모형으로 일 모형 10개를 십 모형 1개로 바꾸는 장면을 보여 줘요. 27 + 5는 7 + 5 = 12에서 10을 십의 자리로 올려 32가 돼요.',
    },
    {
      id: '2-1-3:3', fam: 'ADD', name: '받아올림 (두 자리)+(두 자리) 1', kid: '두 자리 수 + 두 자리 수 (일의 자리에서 받아올림)', sec: 15,
      gen: (r) => until(r, (r) => ({ a: r.int(11, 79), b: r.int(11, 79) }), (p) => addKind(p.a, p.b) === '2-1-3:3'),
      make: carryAddMake, is: isKind('ADD', '2-1-3:3'), prev: '2-1-3:2', pre: ['1-2-6:2', '2-1-1:5'],
      hint: '일의 자리 합이 10이 넘으면 십의 자리 위에 1을 작게 쓰고, 십의 자리를 더할 때 같이 더해요. 38 + 45 = 83!',
      tip: '세로셈에서 받아올린 1을 십의 자리 위에 작게 쓰게 하고, 십의 자리를 더할 때 그 1을 손가락으로 짚게 해요.',
      bridge: '일의 자리에서 만든 10을 십의 자리 1로 바꿔 올리는 생각 — 수 모형으로 낱개 10개를 십 모형 1개로 바꾸는 장면을 꼭 보여 줘요.',
    },
    {
      id: '2-1-3:4', fam: 'ADD', name: '받아올림 (두 자리)+(두 자리) 2', kid: '두 자리 수 + 두 자리 수 (합이 100을 넘음)', sec: 18,
      gen: (r) => until(r, (r) => ({ a: r.int(21, 98), b: r.int(21, 98) }), (p) => addKind(p.a, p.b) === '2-1-3:4'),
      make: carryAddMake, is: isKind('ADD', '2-1-3:4'), prev: '2-1-3:3', pre: ['2-1-1:4'],
      hint: '십의 자리 합이 10이 넘으면 백의 자리로 1을 올려요. 76 + 58 → 일의 자리 14, 십의 자리 7 + 5 + 1 = 13 → 134!',
      tip: '십 모형 10개를 백 모형 1개로 바꾸는 장면을 보여 줘요. 받아올림이 두 번 있는 계산은 올린 1을 자리마다 작게 쓰게 해요.',
    },
    {
      id: '2-1-3:5', fam: 'SUB', name: '받아내림 (두 자리)−(한 자리)', kid: '두 자리 수 − 한 자리 수 (받아내림)', sec: 15,
      gen: (r) => until(r, (r) => ({ a: r.int(20, 98), b: r.int(2, 9) }), (p) => subKind(p.a, p.b) === '2-1-3:5'),
      make: borrowSubMake, is: isKind('SUB', '2-1-3:5'), prev: null, pre: ['1-2-6:4', '1-2-2:4'],
      steps: (p) => [
        { c: 'SUB', p: { a: 10 + ones(p.a), b: p.b }, why: `십 하나를 낱개 10으로 풀어 ${10 + ones(p.a)} − ${J(p.b, '을', '를')} 해요.` },
        { c: 'N4', p: { v: 'bundle', t: tens(p.a) - 1, o: 10 + ones(p.a) - p.b }, why: `십의 자리는 하나 줄어 ${J(tens(p.a) - 1, '이에요', '예요')}. 남은 낱개와 합쳐요.` },
      ],
      hint: '일의 자리에서 뺄 수 없으면 십의 자리에서 10을 받아내려요. 32 − 5 → 12 − 5 = 7, 십의 자리는 2 → 27!',
      tip: '수 모형에서 십 모형 하나를 일 모형 10개로 바꿔 놓고 빼게 해요. 바꾼 십 모형만큼 십의 자리가 하나 줄어든다는 것을 꼭 보여 줘요.',
    },
    {
      id: '2-1-3:6', fam: 'SUB', name: '받아내림 (몇십)−(몇십몇)', kid: '몇십 − 두 자리 수 (받아내림)', sec: 18,
      gen: (r) => until(r, (r) => { const a = r.int(2, 9) * 10; return { a, b: r.int(11, a - 1) }; }, (p) => subKind(p.a, p.b) === '2-1-3:6'),
      make: borrowSubMake, is: isKind('SUB', '2-1-3:6'), prev: '2-1-3:5', pre: ['1-2-2:5'],
      hint: '일의 자리 0에서는 뺄 수 없으니 십의 자리에서 10을 받아내려요. 50 − 23 → 10 − 3 = 7, 4 − 2 = 2 → 27!',
      tip: '몇십의 일의 자리 0에서는 뺄 수 없어요. 십 모형 하나를 일 모형 10개로 바꾸고 10에서 빼게 해요(50 − 23 → 10 − 3). 0 − 3을 3으로 쓰는 실수를 살펴요.',
    },
    {
      id: '2-1-3:7', fam: 'SUB', name: '받아내림 (두 자리)−(두 자리)', kid: '두 자리 수 − 두 자리 수 (받아내림)', sec: 20,
      gen: (r) => until(r, (r) => { const a = r.int(31, 98); return { a, b: r.int(12, a - 1) }; }, (p) => subKind(p.a, p.b) === '2-1-3:7'),
      make: borrowSubMake, is: isKind('SUB', '2-1-3:7'), prev: '2-1-3:6', pre: ['2-1-1:5'],
      hint: '일의 자리에서 뺄 수 없으면 10을 받아내리고, 십의 자리는 1을 줄여서 빼요. 52 − 27 → 12 − 7 = 5, 4 − 2 = 2 → 25!',
      tip: '세로셈에서 받아내린 10을 일의 자리 위에, 하나 줄어든 십의 자리 숫자를 그 위에 작게 고쳐 쓰게 해요.',
    },
    {
      id: '2-1-3:8', fam: 'g2_MIX3', name: '세 수의 계산', kid: '세 수의 덧셈과 뺄셈', sec: 30,
      gen: (r) => until(r, (r) => ({ a: r.int(12, 70), o1: r.pick(['+', '-']), b: r.chance(0.3) ? r.int(2, 9) : r.int(11, 39), o2: r.pick(['+', '-', '-']), c: r.chance(0.3) ? r.int(2, 9) : r.int(11, 39) }), (p) => {
        const r1 = p.o1 === '+' ? p.a + p.b : p.a - p.b, z = p.o2 === '+' ? r1 + p.c : r1 - p.c;
        const k1 = p.o1 === '+' ? addKind(p.a, p.b) : subKind(p.a, p.b), k2 = p.o2 === '+' ? addKind(r1, p.c) : subKind(r1, p.c);
        return r1 >= 1 && r1 <= 99 && z >= 1 && z <= 99 && !(p.o1 === '+' && p.o2 === '+') && (k1.startsWith('2-1-3') || k2.startsWith('2-1-3'));
      }),
      prev: null, pre: ['1-2-4:2', '1-2-4:3'],
      hint: '앞에서부터 차례로 계산해요. 45 − 18 + 9 → 45 − 18 = 27, 27 + 9 = 36!',
    },
    {
      id: '2-1-3:9', fam: 'g2_REL', name: '덧셈과 뺄셈의 관계', kid: '덧셈식을 뺄셈식으로, 뺄셈식을 덧셈식으로', sec: 25,
      gen: (r) => until(r, (r) => ({ x: r.int(11, 59), y: r.int(5, 39), v: r.pick(['a2s', 's2a', 'one']), f: r.int(0, 1) }), (p) => p.x + p.y <= 99 && p.x !== p.y),
      prev: null, pre: ['1-1-3:13'],
      hint: '세 수 중 가장 큰 수가 덧셈식에서는 합, 뺄셈식에서는 맨 앞의 수예요. 17 + 25 = 42 → 42 − 25 = 17, 42 − 17 = 25.',
    },
    {
      id: '2-1-3:10', fam: 'A7', name: '□가 있는 덧셈식', kid: '덧셈식에서 □ 구하기', sec: 15,
      make: (p) => nums(p.left ? [B(0), ` + ${p.a} = ${p.s}`] : [`${p.a} + `, B(0), ` = ${p.s}`], p.s - p.a, {
        bugs: [{ test: (v) => v[0] === p.s + p.a, name: '빼야 할 때 더함', to: '2-1-3:9' }, { test: (v) => v[0] === p.s, name: '보이는 수를 그대로 씀', to: null }],
      }),
      gen: (r) => until(r, (r) => { const a = r.chance(0.4) ? r.int(3, 9) : r.int(11, 49); return { a, s: r.int(a + 3, 99), left: r.chance(0.5) }; }, (p) => p.s >= 12),
      prev: '2-1-3:9', pre: [],
      steps: (p) => [{ c: 'SUB', p: { a: p.s, b: p.a }, why: `□는 ${p.s}에서 ${J(p.a, '을', '를')} 뺀 수예요.` }],
      hint: '□ + 18 = 45는 "45에서 18을 빼면 □"예요. 뺄셈식으로 바꿔서 구해요.',
      tip: '□ + 18 = 45를 45 − 18 = □로 바꿔 쓰게 해요. 막대 그림(전체 45 = □ + 18)으로 □가 "전체에서 아는 부분을 뺀 수"임을 보여 줘요.',
    },
    {
      id: '2-1-3:11', fam: 'g2_SUBBOX', name: '□가 있는 뺄셈식', kid: '뺄셈식에서 □ 구하기', sec: 18,
      gen: (r) => until(r, (r) => { const a = r.int(15, 99); return { a, b: r.int(3, a - 3), pos: r.chance(0.5) ? 1 : 2 }; }, (p) => p.a - p.b >= 3),
      prev: '2-1-3:10', pre: [],
      hint: '□ − 17 = 25이면 □는 25 + 17이에요. 52 − □ = 25이면 □는 52 − 25예요.',
    },
    // ── 2-1-6 곱셈
    {
      id: '2-1-6:3', fam: 'M1', name: '묶어 세기', kid: '몇씩 몇 묶음', sec: 12,
      gen: (r) => (r.chance(0.5) ? { k: r.int(2, 5), n: r.int(2, 6) } : { v: 'skip', k: r.int(3, 5), n: r.int(2, 6) }),
      make: (p) => {
        if (p.v !== 'skip') return BASE.M1.make(p);
        const xs = Array.from({ length: p.k }, (_, i) => p.n * (i + 1)), miss = [p.k - 2, p.k - 1], toks = [{ svg: groups(p.k, p.n) }, `${p.n}씩 뛰어 세어 빈칸에 알맞은 수를 쓰세요.`, { br: 1 }];
        xs.forEach((x, i) => { if (i) toks.push(', '); toks.push(miss.includes(i) ? B(miss.indexOf(i)) : String(x)); });
        return nums(toks, miss.map((i) => xs[i]), { bugs: [{ test: (v) => v[0] === xs[p.k - 3] + 1, name: '묶음이 아니라 하나씩 셈', to: '1-1-5:6' }, { test: (v) => v[1] === p.n + p.k, name: '묶음 수와 한 묶음의 수를 더함', to: null }] });
      },
      prev: null, pre: ['1-1-5:6'],
      hint: '똑같은 수씩 묶어서 세면 빨라요. 3씩 4묶음은 3, 6, 9, 12 → 12개!',
    },
    {
      id: '2-1-6:4', fam: 'M2', name: '몇의 몇 배', kid: '2의 몇 배 (몇의 몇 배)', sec: 10,
      gen: (r) => { const a = r.chance(0.6) ? 2 : r.int(3, 5); return { a, k: r.int(2, a === 2 ? 9 : 5), ask: r.chance(0.45) }; },
      make: (p) => (p.ask
        ? nums([{ svg: groups(p.k, p.a) }, `${p.a}씩 묶었어요. 모두 ${p.a * p.k}개는 ${p.a}의 `, B(0), '배예요.'], p.k, { bugs: [{ test: (v) => v[0] === p.a * p.k, name: '몇 배 대신 전체 수를 씀', to: '2-1-6:3' }, { test: (v) => v[0] === p.a, name: '한 묶음의 수를 씀', to: '2-1-6:3' }] })
        : nums([`${p.a}의 ${p.k}배는 `, B(0)], p.a * p.k, { bugs: [{ test: (v) => v[0] === p.a + p.k, name: '몇 배를 더하기로 봄', to: '2-1-6:3' }, { test: (v) => Math.abs(v[0] - p.a * p.k) === p.a, name: '한 묶음을 더 세거나 덜 셈', to: '2-1-6:3' }] })),
      steps: (p) => [{ c: 'M1', p: { k: p.k, n: p.a }, why: p.ask ? `${p.a}씩 몇 묶음인지 세어 봐요.` : `${p.a}의 ${p.k}배는 ${p.a}씩 ${p.k}묶음이에요. 모두 몇 개인지 세어 봐요.` }],
      prev: '2-1-6:3', pre: [],
      hint: '2의 4배는 2씩 4묶음이에요. 2 + 2 + 2 + 2 = 8. 2와 4를 더하는 게 아니에요!',
    },
    {
      id: '2-1-6:6', fam: 'g2_MULEQ', name: '곱셈식 알기', kid: '덧셈식을 곱셈식으로', sec: 12,
      gen: (r) => ({ a: r.int(2, 9), k: r.int(2, 6), v: r.pick(['add2mul', 'mul2add', 'bae']) }),
      steps: (p) => (p.v === 'bae' ? [{ c: 'M2', p: { a: p.a, k: p.k }, why: `${p.a}의 ${p.k}배가 얼마인지 먼저 구해요.` }] : []),
      prev: '2-1-6:4', pre: [],
      hint: '3 + 3 + 3 + 3은 3을 4번 더한 것이라 3 × 4로 써요. "3 곱하기 4"라고 읽어요.',
    },
    {
      id: '2-1-6:7', fam: 'g2_MULPIC', name: '곱셈식으로 나타내기', kid: '그림·이야기를 곱셈식으로', sec: 20,
      gen: (r) => ({ n: r.int(2, 6), k: r.int(2, 5), v: r.chance(0.5) ? 'pic' : 'story', o: r.int(0, 4), box: r.int(0, 3) }),
      prev: '2-1-6:6', pre: [],
      hint: '먼저 몇씩 몇 묶음인지 세어요. 4씩 3묶음이면 4 × 3 = 12예요.',
    },
    // ── 2-2-1 네 자리 수
    {
      id: '2-2-1:2', fam: 'g2_BIG', name: '천 알기', kid: '1000 알기', sec: 8,
      gen: (r) => { const v = r.pick(['up', 'up', 'gap', 'cnt', 'tensto']); return v === 'up' || v === 'gap' ? { base: 1000, v, k: r.pick([1, 2, 10, 20, 100, 200, 300, 500]) } : { base: 1000, v, u: r.pick([100, 100, 10]) }; },
      is: (p) => p.base === 1000, prev: null, pre: ['2-1-1:6'],
      hint: '900보다 100만큼 더 큰 수, 990보다 10만큼 더 큰 수, 999보다 1만큼 더 큰 수가 모두 1000이에요.',
    },
    {
      id: '2-2-1:3', fam: 'g2_MANY', name: '몇천 알기', kid: '몇천 (2000, 3000…)', sec: 8,
      gen: (r) => ({ u: 1000, k: r.int(2, 9), v: r.pick(['units', 'count', 'word', 'read']), o: r.int(0, 2) }),
      is: (p) => p.u === 1000, prev: '2-2-1:2', pre: [],
      hint: '1000이 4개이면 4000이고 사천이라고 읽어요. 0을 세 개 써요.',
      tip: '천 모형을 하나씩 늘어놓으며 "천, 이천, 삼천…"으로 세어요. 사천은 1000이 4개라서 0을 세 개 쓴다는 것을 몇백과 견주어 보여 줘요.',
    },
    {
      id: '2-2-1:4', fam: 'g2_NUM', name: '네 자리 수 쓰고 읽기', kid: '네 자리 수 알기', sec: 15,
      gen: numGen(4),
      is: (p) => len(p.n) === 4, prev: '2-2-1:3', pre: [],
      hint: '1000이 3개, 10이 5개이면 3050이에요. 빈 자리에는 0을 써요. 삼천오십이라고 읽어요.',
    },
    {
      id: '2-2-1:5', fam: 'N5', name: '네 자리 수의 자릿값', kid: '각 자리 숫자가 나타내는 값 (네 자리)', sec: 10,
      gen: placeGen(4), make: placeMake, is: (p) => p.n != null && len(p.n) === 4, prev: '2-2-1:4', pre: [],
      hint: '5283에서 5는 천의 자리라서 5000, 2는 200, 8은 80, 3은 3을 나타내요.',
      tip: '수 모형(천·백·십·일)으로 수를 만들고, 같은 숫자 5라도 자리에 따라 5000·500·50·5로 나타내는 값이 달라진다는 것을 보게 해요.',
    },
    {
      id: '2-2-1:6', fam: 'g2_SKIP', name: '뛰어 세기 (네 자리)', kid: '1씩~1000씩 뛰어 세기', sec: 18,
      gen: skipGen(4), is: (p) => Math.min(...skipTerms(p)) >= 1000, prev: '2-2-1:5', pre: [],
      hint: '1000씩 뛰어 세면 천의 자리 숫자가 1씩 커져요. 2340, 3340, 4340…',
    },
    {
      id: '2-2-1:7', fam: 'g2_CMP', name: '네 자리 수의 크기 비교', kid: '네 자리 수 크기 비교', sec: 8,
      gen: cmpGen(4), is: (p) => cmpLen(p) === 4, prev: '2-2-1:5', pre: ['2-1-1:7'],
      hint: '천의 자리부터 차례로 비교해요. 4385와 4512는 천의 자리가 같고 백의 자리가 3 < 5라서 4385 < 4512!',
    },
    // ── 2-2-2 곱셈구구 (셈 사실 — 빠르고 정확한지도 봄)
    {
      id: '2-2-2:2', fam: 'MUL', name: '2단', kid: '2단 곱셈구구', sec: 4, timed: true,
      gen: mulDan([2]), make: danMake, is: isKind('MUL', '2-2-2:2'), prev: null, pre: MULPRE,
      hint: '2단은 2씩 커져요. 2 × 6은 2, 4, 6, 8, 10, 12 → 12!',
      tip: '2씩 뛰어 세기(2, 4, 6 …)로 2단을 만들고, 곱하는 수가 1 커지면 곱이 2씩 커지는 것을 보게 해요.',
    },
    {
      id: '2-2-2:3', fam: 'MUL', name: '5단', kid: '5단 곱셈구구', sec: 4, timed: true,
      gen: mulDan([5]), make: danMake, is: isKind('MUL', '2-2-2:3'), prev: null, pre: MULPRE,
      hint: '5단은 5씩 커지고 곱의 일의 자리가 5, 0, 5, 0으로 바뀌어요. 5 × 7 = 35!',
      tip: '5씩 뛰어 세기와 시계(5분씩)로 5단을 익히고, 곱의 일의 자리가 5와 0으로 번갈아 나온다는 것을 찾게 해요.',
    },
    {
      id: '2-2-2:4', fam: 'MUL', name: '3단·6단', kid: '3단과 6단 곱셈구구', sec: 4, timed: true,
      gen: mulDan([3, 6]), make: danMake, is: isKind('MUL', '2-2-2:4'), prev: null, pre: MULPRE,
      hint: '3단은 3씩, 6단은 6씩 커져요. 6 × 4는 3 × 4를 두 번 더한 것이라 12 + 12 = 24!',
      tip: '3단은 3씩 뛰어 세기로, 6단은 3단을 두 번 더해(6 × 4 = 3 × 4 + 3 × 4) 만들어 보게 해요.',
    },
    {
      id: '2-2-2:5', fam: 'MUL', name: '4단·8단', kid: '4단과 8단 곱셈구구', sec: 4, timed: true,
      gen: mulDan([4, 8]), make: danMake, is: isKind('MUL', '2-2-2:5'), prev: '2-2-2:2', pre: MULPRE,
      hint: '4단은 2단을 두 번, 8단은 4단을 두 번 더한 것이에요. 8 × 3은 4 × 3을 두 번 더해 12 + 12 = 24!',
      tip: '4단은 2단을 두 번, 8단은 4단을 두 번 더해 만들어 보게 해요. 4단과 8단의 곱은 모두 짝수라는 것도 찾게 해요.',
    },
    {
      id: '2-2-2:6', fam: 'MUL', name: '7단', kid: '7단 곱셈구구', sec: 4, timed: true,
      gen: mulDan([7]), make: danMake, is: isKind('MUL', '2-2-2:6'), prev: null, pre: MULPRE,
      hint: '7단은 7씩 커져요. 7 × 6은 5 × 6 = 30과 2 × 6 = 12를 더해 42!',
      tip: '7단은 5단과 2단을 더해 만들 수 있어요(7 × 6 = 5 × 6 + 2 × 6). 자주 틀리는 7 × 7, 7 × 8을 따로 짚어 줘요.',
    },
    {
      id: '2-2-2:7', fam: 'MUL', name: '9단', kid: '9단 곱셈구구', sec: 4, timed: true,
      gen: mulDan([9]), make: danMake, is: isKind('MUL', '2-2-2:7'), prev: null, pre: MULPRE,
      hint: '9단은 9씩 커져요. 9 × 4는 10 × 4 = 40에서 4를 빼서 36이에요.',
      tip: '9단은 곱의 십의 자리가 1씩 커지고 일의 자리가 1씩 작아져요. 10씩 묶음에서 하나씩 덜어 내는 그림(9 × 4 = 40 − 4)도 보여 줘요.',
    },
    {
      id: '2-2-2:8', fam: 'MUL', name: '1단과 0의 곱', kid: '1단과 0의 곱', sec: 4, timed: true, lowVariety: true,
      gen: (r) => [{ a: 1, b: r.int(0, 9) }, { a: 0, b: r.int(0, 9) }, { a: r.int(2, 9), b: 0 }][r.int(0, 2)],
      make: danMake, is: isKind('MUL', '2-2-2:8'), prev: null, pre: ['2-1-6:6', '1-1-3:12'],
      hint: '1 × 6은 1이 6개라서 6이에요. 0 × 6, 6 × 0처럼 0이 있으면 곱은 0이에요.',
      tip: '1 × 4는 1씩 4묶음, 0 × 4는 빈 접시 4개, 4 × 0은 4씩 0묶음(아무것도 없음)으로 보여 줘요.',
    },
    {
      id: '2-2-2:9', fam: 'g2_TABLE', name: '곱셈표', kid: '곱셈표 규칙 찾기', sec: 10,
      gen: (r) => {
        const v = r.pick(['swap', 'swap', 'row', 'row', 'rule']), a = r.int(2, 9);
        if (v === 'swap') return { v, a, b: until(r, (r) => r.int(2, 9), (x) => x !== a) };
        if (v === 'row') return { v, a, j: r.int(1, 6), m: r.int(1, 3) };
        return { v, a };
      },
      prev: null, pre: ['2-1-6:6'],
      hint: '곱셈표에서 3단은 3씩 커져요. 4 × 7과 7 × 4처럼 곱하는 두 수의 순서를 바꿔도 곱이 같아요.',
    },
    // ── 2-2-3 길이 재기
    {
      id: '2-2-3:2', fam: 'U1', name: '1 m = 100 cm', kid: 'm와 cm 바꾸기', sec: 12,
      gen: (r) => {
        const m = r.int(1, 9), v = r.pick(['to', 'to', 'rev', 'm']), cm = r.chance(0.3) ? r.int(1, 9) : r.int(10, 99);
        return v === 'm' ? { v, m } : v === 'rev' ? { v, m, cm: r.chance(0.15) ? 0 : cm } : { m, cm };
      },
      make: lenMake, prev: null, pre: ['2-1-1:5'],
      hint: '1 m는 100 cm예요. 2 m 5 cm는 200 cm와 5 cm라서 205 cm예요.',
    },
  ],
};
