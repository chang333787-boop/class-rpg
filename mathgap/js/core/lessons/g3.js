// 3학년 차시 (아이스크림 3-1 · 3-2) — 정의 방법은 docs/LESSONS.md
import { isKind, addKind, subKind, mulKind, divKind, danOf, ones, tens, addCarries, subBorrows, mulCarries, OPSBY } from './ops.js';
import { nums, pick, frac, fx, fb, B, J, P, RO, F } from '../concepts/kit.js';
import { dots, groups, bar, pie } from '../tokens.js';
import { rng, fmt, near } from '../math.js';
import DIVC from '../concepts/div.js';
import FRACC from '../concepts/frac.js';
import DECC from '../concepts/dec.js';

// 조건에 맞는 params가 나올 때까지 다시 뽑기 (무한 반복 방지)
const until = (r, make, ok, tries = 400) => { for (let i = 0; i < tries; i++) { const p = make(r); if (ok(p)) return p; } throw new Error('gen: 조건에 맞는 수를 못 찾음'); };

// 기존 개념 가족의 make를 빌려 쓸 때 (차시가 변형을 더할 때만)
const famOf = (list, id) => list.find((c) => c.id === id);
const D2 = famOf(DIVC, 'D2'), F1 = famOf(FRACC, 'F1'), F2 = famOf(FRACC, 'F2'), F3 = famOf(FRACC, 'F3'), DEC1 = famOf(DECC, 'DEC1');

const d1 = (k) => fmt(k / 10); // 0.1이 k개인 수의 글자
const dec1 = (k) => Number((k / 10).toFixed(1));

// 가족의 채점은 그대로 두고, 더 알맞은 오답 모양 이름을 먼저 본다 (가족 오답 모양보다 앞에)
const withFirst = (it, first) => {
  const check = it.check;
  it.check = function (vals, raws) {
    const res = check.call(this, vals, raws);
    if (res.ok) return res;
    for (const b of first) { try { if (b.test(vals)) return { ok: false, bug: { name: b.name, to: b.to } }; } catch (e) { /* 무시 */ } }
    return res;
  };
  return it;
};
// 3학년은 약분을 배우지 않았으므로 보여 주는 정답은 나눈 그대로(2/4) — 크기가 같은 분수(1/2)도 정답으로 받는다
const fracKeep = (prompt, f, bugs) => frac(prompt, f, { keep: true, bugs });
// 단위분수 1/d이 n개 → n/d (F3 'build'와 같은 문항 · 정답을 약분하지 않고 보여 준다)
const buildUnits = (p) => fracKeep([fx(1, p.d), `이 ${p.n}개이면 `, fb(0, 1)], F(p.n, p.d), [
  { test: (v) => (v[0] === p.n || v[0] === 1) && v[1] === p.d * p.n, name: '분모도 곱함', to: 'F1' },
  { test: (v) => v[0] === p.d && v[1] === p.n, name: '분모와 분자를 바꿈', to: 'F1' },
]);

// ── 그림: 똑같이 / 똑같지 않게 나눈 막대·원 (parts = 조각 크기 비율, 합 1)
function cutBar(parts, w = 180, h = 44) {
  let x = 2, s = '';
  for (const f of parts) { const cw = f * w; s += `<rect x="${x.toFixed(2)}" y="2" width="${cw.toFixed(2)}" height="${h}" class="cell"/>`; x += cw; }
  return `<svg viewBox="0 0 ${w + 4} ${h + 4}" width="${w + 4}" height="${h + 4}" role="img" aria-label="막대를 ${parts.length}조각으로 나눈 그림">${s}</svg>`;
}
function cutPie(parts, r = 42) {
  const c = r + 4; let a0 = -Math.PI / 2, s = '';
  for (const f of parts) {
    const a1 = a0 + f * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0), x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    s += `<path d="M${c} ${c}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" class="cell"/>`;
    a0 = a1;
  }
  return `<svg viewBox="0 0 ${2 * c} ${2 * c}" width="${2 * c}" height="${2 * c}" role="img" aria-label="원을 ${parts.length}조각으로 나눈 그림">${s}</svg>`;
}
const equalParts = (d) => Array(d).fill(1 / d);
// 조각 수는 d개 그대로, 크기는 1 : 2로 섞어 눈에 띄게 다르게
function unequalParts(R, d) {
  let ws; do { ws = Array.from({ length: d }, () => R.int(1, 2)); } while (ws.every((w) => w === ws[0]));
  const t = ws.reduce((a, b) => a + b, 0);
  return ws.map((w) => w / t);
}

// ── 두 자리 ÷ 한 자리: 몫의 십의 자리만큼 먼저 덜어 내고(몇십 ÷ 몇) 남은 수를 나눈다 (교과서의 '가르기' 풀이)
//   self = 이 차시 id — 남은 수의 나눗셈이 같은 차시로 분류되면 곱셈구구 + 뺄셈으로 대신 쪼갠다
function divSplit(a, b, self) {
  const q = Math.floor(a / b);
  const byTable = (x) => {
    const qq = Math.floor(x / b), rr = x % b;
    return rr
      ? [{ c: 'MUL', p: { a: b, b: qq }, why: `${b}단에서 ${x}보다 크지 않은 가장 큰 곱을 찾아요.` }, { c: 'SUB', p: { a: x, b: b * qq }, why: '남는 수(나머지)를 구해요.' }]
      : [{ c: 'MUL', p: { a: b, b: qq }, why: `${b}단에서 곱이 ${x}인 것을 찾아요.` }];
  };
  if (q <= 9) return byTable(a);
  const qt = Math.floor(q / 10) * 10, a1 = b * qt, a2 = a - a1, q2 = Math.floor(a2 / b);
  if (a2 === 0) return [{ c: 'DIV', p: { a: a / 10, b }, why: `0을 뺀 ${a / 10} ÷ ${b}부터 해요. 몫은 그 10배예요.` }];
  const rest = a2 < b ? ` 남은 ${a2}${P(a2, '은', '는')} ${b}보다 작으니 나머지예요.` : '';
  const out = [{ c: 'DIV', p: { a: a1, b }, why: `${J(a, '을', '를')} ${J(a1, '과', '와')} ${RO(a2)} 갈라 ${a1} ÷ ${b}부터 해요.${rest}` }];
  if (a2 >= b) {
    if (divKind(a2, b) === self) out.push(...byTable(a2));
    else out.push({ c: 'DIV', p: { a: a2, b }, why: `남은 ${a2} ÷ ${J(b, '을', '를')} 해요.` });
    out.push({ c: 'ADD', p: { a: qt, b: q2 }, why: '두 몫을 더해요.' });
  }
  return out;
}
// 몇십 ÷ 몇 중 이 차시에 드는 것 (가짓수가 적어 목록에서 고른다)
const DIVTENS = (id) => { const out = []; for (let t = 1; t <= 9; t++) for (let b = 2; b <= 9; b++) if (divKind(10 * t, b) === id) out.push({ a: 10 * t, b }); return out; };
const DIV2 = DIVTENS('3-2-2:2'), DIV4 = DIVTENS('3-2-2:4');

// (세 자리)×(한 자리)에서 처음 올림이 생기는 자리 (0 일 · 1 십 · 2 백)
function carryAt(a, b) { let c = 0; for (let i = 0; i < 3; i++) { const s = (Math.floor(a / 10 ** i) % 10) * b + c; c = Math.floor(s / 10); if (s >= 10) return i; } return -1; }
const mul22 = (r, ok) => until(r, (r) => ({ a: r.int(11, 99), b: r.int(11, 99) }), (p) => p.a % 10 !== 0 && p.b % 10 !== 0 && ok(p));
const carries22 = (a, b) => mulCarries(a, ones(b)) + mulCarries(a, tens(b)) + addCarries(a * ones(b), a * tens(b) * 10);

// 분수만큼은 얼마 — 길이와 시간 (1 m = 100 cm · 1시간 = 60분 · 하루 = 24시간)
const QTY = {
  m: { N: 100, whole: '1 m', eq: '1 m = 100 cm', tail: ' cm예요.', ds: [2, 4, 5] },
  h: { N: 60, whole: '1시간', eq: '1시간 = 60분', tail: '분이에요.', ds: [2, 3, 4, 5, 6] },
  day: { N: 24, whole: '하루', eq: '하루 = 24시간', tail: '시간이에요.', ds: [2, 3, 4, 6, 8] },
};
// 분모가 같은 분수 — 대분수 또는 가분수로 보이기
const showFrac = (x, d, mixed) => (mixed ? { m: [Math.floor(x / d), x % d, d] } : fx(x, d));

// ── 3학년에서 새로 만든 문항 가족
const FAMS = [
  {
    id: 'g3_EQ', s: 'F', sec: 10,
    tip: '같은 종이를 접어서 나눈 것과 아무렇게나 자른 것을 겹쳐 보게 해요. 조각 수가 같아도 크기가 같아야 "똑같이 나눈 것"이에요.',
    // { v: 'eq' 똑같이 나눈 것 고르기 | 'not' 똑같이 나누지 않은 것 고르기, shape, d, d2, right, s }
    make: (p) => {
      const R = rng(p.s), pic = (parts) => ({ svg: p.shape === 'pie' ? cutPie(parts) : cutBar(parts) });
      let eqSeen = 0;
      const ch = [0, 1, 2].map((k) => {
        const isEq = p.v === 'eq' ? k === p.right : k !== p.right;
        const parts = isEq ? equalParts(eqSeen++ === 1 ? p.d2 : p.d) : unequalParts(R, p.d);
        return [pic(parts), ['가', '나', '다'][k]];
      });
      const bugs = {};
      [0, 1, 2].filter((k) => k !== p.right).forEach((k) => {
        bugs[k] = p.v === 'eq' ? { name: '조각 수만 보고 크기가 같은지 보지 않음', to: null } : { name: '똑같이 나눈 것과 아닌 것을 가리지 못함', to: null };
      });
      const what = p.shape === 'pie' ? '원' : '막대';
      return pick([p.v === 'eq' ? `${what}${p.shape === 'pie' ? '을' : '를'} ${p.d}조각으로 똑같이 나눈 것을 고르세요.` : `똑같이 나누지 않은 ${what}${p.shape === 'pie' ? '을' : '를'} 고르세요.`], ch, p.right, { bugs });
    },
  },
  {
    id: 'g3_FRACW', s: 'F', sec: 12,
    tip: '"5분의 3"은 분모(5)부터 읽어요. 쓸 때도 가로선과 분모를 먼저 쓰게 하면 순서가 헷갈리지 않아요. 색칠하지 않은 부분도 전체를 분모로 나타내요.',
    // { v: 'rest' 색칠하지 않은 부분 | 'read' 읽은 말을 분수로 | 'term' 분모·분자, d, n, shape }
    make: (p) => {
      if (p.v === 'rest') {
        return fracKeep([{ svg: p.shape === 'pie' ? pie(p.d, p.n) : bar(p.d, p.n) }, '색칠하지 않은 부분은 전체의 ', fb(0, 1)], F(p.d - p.n, p.d), [
          { test: (v) => v[0] === p.n && v[1] === p.d, name: '색칠한 부분을 씀', to: null },
          { test: (v) => v[0] === p.d - p.n && v[1] === p.n, name: '안 칠한 칸 수 / 칠한 칸 수로 씀 (전체를 분모로 안 씀)', to: '3-1-6:3' },
        ]);
      }
      if (p.v === 'read') {
        return nums([`${p.d}분의 ${J(p.n, '을', '를')} 분수로 쓰면 `, fb(0, 1)], [p.n, p.d], {
          bugs: [{ test: (v) => v[0] === p.d && v[1] === p.n, name: '읽은 순서대로 위에 씀 (분모와 분자를 바꿈)', to: null }],
        });
      }
      return nums(['분수 ', fx(p.n, p.d), '에서', { br: 1 }, '분모: ', B(0), '    분자: ', B(1)], [p.d, p.n], {
        bugs: [{ test: (v) => v[0] === p.n && v[1] === p.d, name: '분모와 분자를 바꿔 앎', to: null }],
      });
    },
    steps: (p) => (p.v === 'rest'
      ? [{ c: 'F1', p: { d: p.d, n: p.n, shape: p.shape }, why: '먼저 색칠한 부분을 분수로 나타내 봐요.' }, { c: 'SUB', p: { a: p.d, b: p.n }, why: p.shape === 'pie' ? `전체 ${p.d}조각 중 색칠하지 않은 조각은 몇 개인가요?` : `전체 ${p.d}칸 중 색칠하지 않은 칸은 몇 칸인가요?` }]
      : []),
  },
  {
    id: 'g3_DECCMP', s: 'DEC', sec: 8,
    tip: '0.1 칸 띠나 수직선에 두 소수를 나타내 봐요. 자연수 부분부터 비교하고, 같으면 소수 첫째 자리를 비교해요. "0.1이 몇 개"로 바꾸면 자연수 비교가 돼요.',
    // { v, xs: [0.1이 몇 개인 수…], ask: 'max'(기본) | 'min' } — 가장 큰(작은) 수 고르기
    make: (p) => {
      const min = p.ask === 'min', right = p.xs.indexOf((min ? Math.min : Math.max)(...p.xs)), top = p.xs[right], bugs = {};
      p.xs.forEach((x, k) => {
        if (k === right) return;
        // 소수 첫째 자리만 보면 이 수를 고르게 되는 경우 (자연수 부분을 먼저 보지 않음)
        const trap = min ? x % 10 < top % 10 && Math.floor(x / 10) > Math.floor(top / 10) : x % 10 > top % 10 && Math.floor(x / 10) < Math.floor(top / 10);
        bugs[k] = trap ? { name: '소수 부분만 보고 비교함', to: '3-1-6:9' }
          : { name: min ? '더 큰 수를 고름' : '더 작은 수를 고름', to: Math.max(...p.xs) < 10 ? '3-1-6:8' : '3-1-6:9' };
      });
      const q = p.xs.length > 2 ? (min ? '가장 작은 수를 고르세요.' : '가장 큰 수를 고르세요.') : (min ? '더 작은 수를 고르세요.' : '더 큰 수를 고르세요.');
      return pick([q], p.xs.map((x) => [d1(x)]), right, { bugs });
    },
    steps: (p) => p.xs.map((x) => ({ c: 'DEC1', p: { v: 'units', n: x }, why: `${d1(x)}${P(x, '은', '는')} 0.1이 몇 개인가요?` })),
  },
  {
    id: 'g3_DIVCHK', s: 'D', sec: 20,
    tip: '나눗셈을 하고 나면 "나누는 수 × 몫 + 나머지 = 나누어지는 수"와 "나머지 < 나누는 수" 두 가지를 맞춰 보게 해요.',
    // { v: 'check' 확인 식 채우기 | 'find' 나누어지는 수 찾기 | 'judge' 맞는 계산 고르기, b, q, rem, k(judge의 정답 자리) }
    make: (p) => {
      const a = p.b * p.q + p.rem;
      if (p.v === 'check') {
        return nums([`${a} ÷ ${p.b} = ${p.q} … ${p.rem}`, { br: 1 }, '맞는지 확인하는 식: ', `${p.b} × `, B(0), ' + ', B(1), ` = ${a}`], [p.q, p.rem], {
          bugs: [
            { test: (v) => v[0] === p.rem && v[1] === p.q, name: '몫과 나머지 자리를 바꿈', to: null },
            { test: (v) => v[1] >= p.b, name: '나머지가 나누는 수보다 큼', to: '3-2-2:6' },
          ],
        });
      }
      if (p.v === 'find') {
        return nums([`어떤 수를 ${RO(p.b)} 나누었더니 몫이 ${p.q}, 나머지가 ${J(p.rem, '이었어요', '였어요')}.`, { br: 1 }, '어떤 수는 ', B(0)], a, {
          bugs: [
            { test: (v) => v[0] === p.b * p.q, name: '나머지를 더하지 않음', to: null },
            { test: (v) => v[0] === p.b * p.q - p.rem, name: '나머지를 뺌', to: null },
            { test: (v) => v[0] === p.b * (p.q + p.rem), name: '몫과 나머지를 더해서 곱함', to: null },
          ],
        });
      }
      const ok = [p.q, p.rem], big = [p.q - 1, p.rem + p.b], off = p.rem + 1 < p.b ? [p.q, p.rem + 1] : [p.q, p.rem - 1];
      const rest = [big, off], list = [], bugs = {};
      for (let k = 0, j = 0; k < 3; k++) {
        if (k === p.k) { list.push(ok); continue; }
        const w = rest[j++];
        list.push(w);
        bugs[k] = w === big ? { name: '나머지가 나누는 수보다 큼', to: '3-2-2:6' } : { name: '나누는 수 × 몫 + 나머지로 확인하지 않음', to: null };
      }
      return pick([`${a} ÷ ${p.b}${P(p.b, '을', '를')} 바르게 계산한 것을 고르세요.`], list.map(([q, m]) => [`${a} ÷ ${p.b} = ${q} … ${m}`]), p.k, { bugs });
    },
    steps: (p) => {
      const a = p.b * p.q + p.rem;
      if (p.v === 'judge') return [{ c: 'DIV', p: { a, b: p.b }, why: `직접 ${a} ÷ ${J(p.b, '을', '를')} 해 봐요.` }];
      return [
        { c: 'MUL', p: { a: p.b, b: p.q }, why: `나누는 수 × 몫: ${p.b} × ${J(p.q, '을', '를')} 해요.` },
        { c: 'ADD', p: { a: p.b * p.q, b: p.rem }, why: '거기에 나머지를 더해요.' },
      ];
    },
  },
  {
    id: 'g3_FDISC', s: 'F', sec: 15,
    tip: '바둑돌을 몇 개씩 묶어 놓고 "전체 몇 묶음 중 몇 묶음"인지 말하게 해요. 분모는 낱개 수가 아니라 묶음 수예요.',
    // { G 묶음 수, k 한 묶음의 수, m 부분 묶음 수 }
    make: (p) => {
      const N = p.G * p.k, part = p.m * p.k;
      return fracKeep([{ svg: groups(p.G, p.k) }, `${J(N, '을', '를')} ${p.k}씩 묶으면 ${part}${P(part, '은', '는')} ${N}의 `, fb(0, 1)], F(p.m, p.G), [
        { test: (v) => v[0] === p.m && v[1] === p.k, name: '한 묶음 안의 수를 분모로 씀', to: '3-1-3:3' },
        { test: (v) => v[0] === p.m && v[1] === p.G - p.m, name: '부분 묶음 수 / 나머지 묶음 수로 씀', to: '3-1-6:3' },
        { test: (v) => v[0] === part && v[1] === p.G, name: '낱개 수와 묶음 수를 섞어 씀', to: '3-1-3:3' },
      ]);
    },
    steps: (p) => [
      { c: 'DIV', p: { a: p.G * p.k, b: p.k }, why: `${J(p.G * p.k, '을', '를')} ${p.k}씩 묶으면 모두 몇 묶음인가요?` },
      { c: 'DIV', p: { a: p.m * p.k, b: p.k }, why: `${p.m * p.k}${P(p.m * p.k, '은', '는')} 몇 묶음인가요?` },
    ],
  },
  {
    id: 'g3_FQTY', s: 'F', sec: 20,
    tip: '1 m 띠(100 cm)나 시계(60분)를 똑같이 나눠 보게 해요. 먼저 1 m = 100 cm, 1시간 = 60분으로 바꾸면 "100의 3/4"처럼 개수에 대한 분수와 같아져요.',
    // { u: 'm' | 'h' | 'day', n, d }
    make: (p) => {
      const Q = QTY[p.u], k = Q.N / p.d;
      return nums([`${Q.whole}의 `, fx(p.n, p.d), `${P(p.n, '은', '는')} `, B(0), Q.tail], k * p.n, {
        bugs: [
          { test: (v) => p.n > 1 && v[0] === k, name: '1/몇만큼만 구함', to: '3-2-4:3' },
          { test: (v) => p.u === 'h' && 100 % p.d === 0 && v[0] === (100 / p.d) * p.n, name: '1시간을 100분으로 봄', to: null },
          { test: (v) => p.u === 'm' && v[0] === p.n * 10, name: '1 m를 cm로 바꾸지 못함', to: '2-2-3:2' },
        ],
      });
    },
    steps: (p) => { const Q = QTY[p.u]; return [{ c: 'F4', p: { N: Q.N, n: p.n, d: p.d }, why: `${Q.eq}. ${Q.N}의 ${p.n}/${p.d}${P(p.n, '을', '를')} 구해요.` }]; },
  },
  {
    id: 'g3_FCMP', s: 'F', sec: 12,
    tip: '대분수끼리는 자연수 부분부터 비교해요. 가분수와 대분수는 한쪽으로 바꿔서 비교해요. 분모가 같은 가분수끼리는 분자가 큰 쪽이 커요.',
    // { v: 'mm' 대분수끼리 | 'im' 가분수와 대분수 | 'ii' 가분수끼리 | 'three' 섞어서, d, xs: [분자…] (크기 x/d), ms: [1이면 대분수로 보임…], ask: 'max'(기본) | 'min' }
    make: (p) => {
      const min = p.ask === 'min', right = p.xs.indexOf((min ? Math.min : Math.max)(...p.xs)), top = p.xs[right], bugs = {};
      p.xs.forEach((x, k) => {
        if (k === right) return;
        const fracTrap = min ? x % p.d < top % p.d : x % p.d > top % p.d;
        bugs[k] = p.ms[k] !== p.ms[right] ? { name: '가분수와 대분수를 같은 꼴로 바꾸지 않고 비교함', to: '3-2-4:6' }
          : p.ms[k] && fracTrap ? { name: '분수 부분만 보고 비교함', to: '3-2-4:6' }
            : p.ms[k] ? { name: min ? '더 큰 수를 고름' : '더 작은 수를 고름', to: '3-2-4:6' } : { name: min ? '분자가 큰 쪽을 고름' : '분자가 작은 쪽을 고름', to: '3-1-6:6' };
      });
      const q = p.xs.length > 2 ? (min ? '가장 작은 수를 고르세요.' : '가장 큰 수를 고르세요.') : (min ? '더 작은 수를 고르세요.' : '더 큰 수를 고르세요.');
      return pick([q], p.xs.map((x, k) => [showFrac(x, p.d, p.ms[k])]), right, { bugs });
    },
    // 가분수와 대분수가 섞여 있으면 대분수를 가분수로 바꿔 본다
    steps: (p) => (p.ms.some((m) => m) && p.ms.some((m) => !m)
      ? p.xs.filter((x, k) => p.ms[k]).map((x) => ({ c: 'F5', p: { v: 'toImp', w: Math.floor(x / p.d), n: x % p.d, d: p.d }, why: `${Math.floor(x / p.d)} ${x % p.d}/${p.d}${P(x % p.d, '을', '를')} 가분수로 바꾸면 분자끼리 비교할 수 있어요.` }))
      : []),
  },
];

export default {
  FAMS,
  LESSONS: [
    // ── 3-1-1 덧셈과 뺄셈
    {
      id: '3-1-1:2', fam: 'ADD', name: '세 자리 덧셈 (받아올림 없음)', kid: '세 자리 수 더하기 (받아올림 없이)', sec: 20,
      gen: (r) => until(r, (r) => ({ a: r.int(101, 899), b: r.int(101, 899) }), (p) => addKind(p.a, p.b) === '3-1-1:2'),
      is: isKind('ADD', '3-1-1:2'), prev: null, pre: ['2-1-1:5', '1-2-2:3'],
      hint: '백은 백끼리, 십은 십끼리, 일은 일끼리 더해요. 253 + 215는 400 + 60 + 8 = 468이에요.',
      tip: '수 모형(백·십·일)을 자리별로 모아 세로셈과 연결해요. 자리를 맞춰 쓰는 것과 일의 자리부터 더하는 순서를 함께 짚어요.',
    },
    {
      id: '3-1-1:3', fam: 'ADD', name: '세 자리 덧셈 (받아올림 한 번)', kid: '세 자리 수 더하기 (받아올림 한 번)', sec: 25,
      gen: (r) => until(r, (r) => ({ a: r.int(101, 899), b: r.int(101, 899) }), (p) => addKind(p.a, p.b) === '3-1-1:3' && p.a + p.b < 1000),
      is: isKind('ADD', '3-1-1:3'), prev: '3-1-1:2', pre: ['2-1-3:3', '1-2-4:2'],
      hint: '같은 자리 합이 10을 넘으면 바로 윗자리에 1을 작게 써서 같이 더해요. 517 + 425에서 7 + 5 = 12라 2를 쓰고 1을 십의 자리로 올려 942예요.',
      tip: '일 모형 10개를 십 모형 1개로 바꾸는 장면을 보여 주고, 세로셈에서 받아올린 1을 윗자리 위에 작게 쓰게 해요. 받아올린 1을 빠뜨리는 실수가 가장 흔해요.',
    },
    {
      id: '3-1-1:4', fam: 'ADD', name: '세 자리 덧셈 (받아올림 여러 번)', kid: '세 자리 수 더하기 (받아올림 여러 번)', sec: 30,
      gen: (r) => until(r, (r) => ({ a: r.int(101, 899), b: r.int(101, 899) }), (p) => addKind(p.a, p.b) === '3-1-1:4'),
      is: isKind('ADD', '3-1-1:4'), prev: '3-1-1:3', pre: ['2-1-3:4'],
      hint: '일의 자리부터 차례로 더하고, 받아올린 1을 잊지 말고 윗자리에 더해요. 258 + 394 = 652예요.',
      tip: '받아올림이 두세 번 이어질 때 받아올린 1을 자리마다 작게 적게 해요. 합이 네 자리가 되면 천의 자리에 1을 쓰는 것도 짚어요.',
    },
    {
      id: '3-1-1:5', fam: 'SUB', name: '세 자리 뺄셈 (받아내림 없음)', kid: '세 자리 수 빼기 (받아내림 없이)', sec: 20,
      gen: (r) => until(r, (r) => { const a = r.int(211, 999); return { a, b: r.int(101, a - 100) }; }, (p) => subKind(p.a, p.b) === '3-1-1:5'),
      is: isKind('SUB', '3-1-1:5'), prev: null, pre: ['2-1-1:5', '1-2-2:5'],
      hint: '백은 백끼리, 십은 십끼리, 일은 일끼리 빼요. 476 − 113 = 363이에요.',
      tip: '수 모형에서 같은 자리끼리 덜어 내고 세로셈과 연결해요. 자리를 맞춰 쓰게 해요.',
    },
    {
      id: '3-1-1:6', fam: 'SUB', name: '세 자리 뺄셈 (받아내림 한 번)', kid: '세 자리 수 빼기 (받아내림 한 번)', sec: 25,
      gen: (r) => until(r, (r) => { const a = r.int(211, 999); return { a, b: r.int(101, a - 100) }; }, (p) => subKind(p.a, p.b) === '3-1-1:6'),
      is: isKind('SUB', '3-1-1:6'), prev: '3-1-1:5', pre: ['2-1-3:7'],
      hint: '일의 자리에서 뺄 수 없으면 십의 자리에서 10을 받아내려요. 361 − 124는 11 − 4 = 7, 십의 자리는 5 − 2 = 3이라 237이에요.',
      tip: '십 모형 1개를 일 모형 10개로 바꾸는 장면을 보여 주고, 받아내려 준 자리의 숫자를 지우고 1 작은 수를 쓰게 해요. "큰 수에서 작은 수를 빼는" 실수를 짚어요.',
    },
    {
      id: '3-1-1:7', fam: 'SUB', name: '세 자리 뺄셈 (받아내림 두 번)', kid: '세 자리 수 빼기 (받아내림 두 번)', sec: 30,
      gen: (r) => until(r, (r) => { const a = r.int(301, 999); return { a, b: r.int(101, a - 50) }; }, (p) => subKind(p.a, p.b) === '3-1-1:7' && p.a - p.b >= 10),
      is: isKind('SUB', '3-1-1:7'), prev: '3-1-1:6', pre: ['1-2-6:4'],
      hint: '받아내림을 두 번 해요. 받아내려 준 자리는 1이 줄어든다는 것을 작게 써 두면 헷갈리지 않아요: 423 − 198 = 225.',
      tip: '받아내림이 두 번이면 바뀐 숫자를 자리마다 작게 고쳐 쓰게 해요. 603 − 258처럼 십의 자리가 0이면 백의 자리에서 먼저 받아내려야 하는 것을 따로 짚어요.',
    },
    // ── 3-1-3 나눗셈 (등분제 → 포함제 → 곱셈과의 관계 → 곱셈식 → 곱셈구구)
    {
      id: '3-1-3:2', fam: 'D1', name: '똑같이 나누기 (몇 묶음으로)', kid: '똑같이 나누면 하나에 몇 개', sec: 12,
      gen: (r) => ({ d: r.int(2, 6), q: r.int(2, 6) }),
      is: (p) => p.d >= 2 && p.q >= 1, prev: null, pre: ['2-1-6:3'],
      hint: '사탕 12개를 3명이 똑같이 나누려면 한 명에게 하나씩 돌아가며 나눠 줘요. 한 명이 4개씩 가져요.',
      bridge: '"모두 몇 개를 몇 명에게 똑같이" — 나누는 수가 묶음(사람) 수인 나눗셈이에요.',
    },
    {
      id: '3-1-3:3', fam: 'D2', name: '똑같이 나누기 (몇씩 덜어 내기)', kid: '몇 개씩 덜어 내면 몇 번', sec: 15,
      gen: (r) => ({ v: r.chance(0.5) ? 'sub' : 'pic', d: r.int(2, 5), q: r.int(2, 6) }),
      make: (p) => {
        if (p.v !== 'pic') return D2.make(p);
        const n = p.d * p.q;
        return nums([{ svg: dots(n, { cols: Math.min(n, 6) }) }, `${n}개를 ${p.d}개씩 묶으면 `, B(0), '묶음이에요.', { br: 1 }, `${n} ÷ ${p.d} = `, B(1)], [p.q, p.q], {
          bugs: [
            { test: (v) => v[0] === p.d || v[1] === p.d, name: '한 묶음의 수와 묶음 수를 헷갈림', to: '3-1-3:2' },
            { test: (v) => v[0] === n - p.d || v[1] === n - p.d, name: '나누기를 한 번 빼기로 봄', to: '1-1-3:10' },
          ],
        });
      },
      is: (p) => (p.v == null || p.v === 'sub' || p.v === 'pic') && p.d >= 2 && p.q >= 1, prev: '3-1-3:2', pre: ['2-1-6:3'],
      hint: '12에서 3씩 덜어 내면 12 − 3 − 3 − 3 − 3 = 0, 네 번이에요. 그래서 12 ÷ 3 = 4예요.',
      bridge: '"몇 개씩 덜어 내면 몇 번" — 나누는 수가 한 묶음의 크기인 나눗셈이에요. 6학년 분수 ÷ 분수의 뿌리예요.',
    },
    {
      id: '3-1-3:4', fam: 'D3', def: true, name: '곱셈과 나눗셈의 관계', kid: '곱셈식으로 나눗셈식 만들기', sec: 12,
      gen: (r) => { const a = r.int(2, 9); let b; do { b = r.int(2, 9); } while (b === a); return { v: 'q', a, b }; },
      // 곱셈식 하나로 나눗셈식 두 개 (교과서: 3 × 4 = 12 → 12 ÷ 3 = 4, 12 ÷ 4 = 3)
      make: (p) => {
        const n = p.a * p.b;
        return nums([`곱셈식 ${p.a} × ${p.b} = ${RO(n)} 나눗셈식 두 개를 만들어요.`, { br: 1 }, `${n} ÷ ${p.a} = `, B(0), { br: 1 }, `${n} ÷ ${p.b} = `, B(1)], [p.b, p.a], {
          bugs: [
            { test: (v) => p.a !== p.b && v[0] === p.a && v[1] === p.b, name: '나누는 수를 몫으로 씀', to: '3-1-3:2' },
            { test: (v) => v[0] === n - p.a || v[1] === n - p.b, name: '나누기를 한 번 빼기로 봄', to: '3-1-3:3' },
          ],
        });
      },
      is: (p) => p.v === 'q', prev: '3-1-3:3', pre: (p) => [p ? danOf(p.a) : '2-2-2:4', '2-1-6:7'],
      hint: '3 × 4 = 12이면 12 ÷ 3 = 4, 12 ÷ 4 = 3이에요. 곱셈식 하나로 나눗셈식 두 개를 만들 수 있어요.',
    },
    {
      id: '3-1-3:5', fam: 'D3', name: '나눗셈의 몫을 곱셈식으로', kid: '곱셈식으로 몫 찾기', sec: 12,
      gen: (r) => { const a = r.int(2, 9); let b; do { b = r.int(2, 9); } while (b === a); return { v: 'box', a, b }; },
      make: (p) => {
        const n = p.a * p.b;
        return nums([`${n} ÷ ${p.a}의 몫을 곱셈식으로 구해요.`, { br: 1 }, `${p.a} × `, B(0), ` = ${n}`, { br: 1 }, `${n} ÷ ${p.a} = `, B(1)], [p.b, p.b], {
          bugs: [
            { test: (v) => v[0] === n - p.a || v[1] === n - p.a, name: '빼서 구함', to: '3-1-3:3' },
            { test: (v) => p.a !== p.b && v[1] === p.a, name: '나누는 수를 몫으로 씀', to: '3-1-3:4' },
            { test: (v) => v[0] === p.b && v[1] !== p.b, name: '곱셈식의 □를 몫으로 옮기지 못함', to: '3-1-3:4' },
          ],
        });
      },
      is: (p) => p.v === 'box', prev: '3-1-3:4', pre: (p) => [p ? danOf(p.a) : '2-2-2:4'],
      hint: '12 ÷ 3의 몫은 3 × □ = 12의 □예요. 3 × 4 = 12니까 몫은 4예요.',
      tip: '12 ÷ 3 = □를 3 × □ = 12로 바꿔 읽게 해요. 나눗셈의 몫은 곱셈식의 빈칸이라는 것을 말로 하게 해요.',
    },
    {
      id: '3-1-3:6', fam: 'DIV', name: '나눗셈의 몫을 곱셈구구로', kid: '구구단으로 나누기', sec: 8,
      gen: (r) => { const b = r.int(2, 9); return { a: b * r.int(2, 9), b }; },
      is: isKind('DIV', '3-1-3:6'), prev: '3-1-3:5', pre: (p) => [p ? danOf(p.b) : '2-2-2:6'],
      hint: '42 ÷ 7은 7단에서 곱이 42인 곳을 찾아요. 7 × 6 = 42니까 몫은 6이에요.',
      tip: '나누는 수의 단을 거꾸로 짚어 곱이 나누어지는 수가 되는 곳을 찾게 해요. 곱셈구구가 흔들리는 단이 있으면 그 단부터 다시 다져요.',
    },
    // ── 3-1-4 곱셈 (예시: 같은 단원 차시는 prev로, 옛 단원은 pre로. 구구단은 수에 따라 단이 달라 pre를 함수로)
    {
      id: '3-1-4:2', fam: 'MUL', name: '(몇십)×(몇)', kid: '몇십 곱하기 몇', sec: 12,
      gen: (r) => ({ a: r.int(2, 9) * 10, b: r.int(2, 9) }), // 차시명 그대로 (몇십)×(몇)만 — (몇백)×(몇)은 내지 않는다
      is: isKind('MUL', '3-1-4:2'), prev: null, pre: (p) => [p ? danOf(p.a / (p.a % 100 === 0 ? 100 : 10)) : '2-2-2:2', '2-1-1:3'],
      hint: '30 × 4는 3 × 4 = 12에 0을 하나 붙여 120이에요. 십 모형 3개씩 4묶음이니까요.',
      tip: '십 모형 3개씩 4묶음 = 십 모형 12개 = 120. "0을 붙인다"를 외우기보다 3 × 4의 10배라는 까닭을 말하게 해요.',
    },
    {
      id: '3-1-4:3', fam: 'MUL', name: '(몇십몇)×(몇) 올림 없음', kid: '두 자리 × 한 자리 (올림 없이)', sec: 15,
      gen: (r) => until(r, (r) => ({ a: r.int(11, 44), b: r.int(2, 4) }), (p) => mulKind(p.a, p.b) === '3-1-4:3'),
      is: isKind('MUL', '3-1-4:3'), prev: '3-1-4:2', pre: (p) => [p ? danOf(ones(p.a)) : '2-2-2:2', '1-2-2:3'],
      hint: '십의 자리와 일의 자리를 따로 곱해서 더해요. 12 × 3은 10 × 3 = 30과 2 × 3 = 6을 더해 36이에요.',
      tip: '수 모형으로 12씩 3묶음을 만들어 십 모형·일 모형을 따로 세게 해요. 가로셈(30 + 6)과 세로셈을 연결해요.',
    },
    {
      id: '3-1-4:4', fam: 'MUL', name: '(몇십몇)×(몇) 십의 자리 올림', kid: '두 자리 × 한 자리 (십의 자리 올림)', sec: 18,
      gen: (r) => until(r, (r) => ({ a: r.int(31, 94), b: r.int(2, 9) }), (p) => mulKind(p.a, p.b) === '3-1-4:4'),
      is: isKind('MUL', '3-1-4:4'), prev: '3-1-4:3', pre: (p) => [p ? danOf(tens(p.a)) : '2-2-2:4', '2-1-1:4'],
      hint: '십의 자리 곱이 10을 넘으면 백의 자리로 넘어가요. 42 × 3은 40 × 3 = 120과 2 × 3 = 6을 더해 126이에요.',
      tip: '십의 자리 곱(4 × 3 = 12)이 실제로는 120이라 백의 자리까지 쓴다는 것을 세로셈 자리에 맞춰 보여 줘요.',
    },
    {
      id: '3-1-4:5', fam: 'MUL', name: '(몇십몇)×(몇) 일의 자리 올림', kid: '두 자리 × 한 자리 (일의 자리 올림)', sec: 20,
      gen: (r) => until(r, (r) => ({ a: r.int(12, 49), b: r.int(2, 9) }), (p) => mulKind(p.a, p.b) === '3-1-4:5'),
      is: isKind('MUL', '3-1-4:5'), prev: '3-1-4:4', pre: (p) => [p ? danOf(ones(p.a)) : '2-2-2:6', '2-1-3:2'],
      hint: '일의 자리 곱에서 10은 십의 자리로 올리고, 올린 수는 십의 자리 곱에 더해요. 16 × 4는 6 × 4 = 24에서 2를 올려 1 × 4 + 2 = 6, 답은 64예요.',
      tip: '일의 자리 곱(24)의 2를 십의 자리 위에 작게 쓰고, 십의 자리를 곱한 다음에 더하게 해요. 올린 수를 먼저 더하고 곱하는 실수를 짚어요.',
    },
    {
      id: '3-1-4:6', fam: 'MUL', name: '(몇십몇)×(몇) 올림 두 번', kid: '두 자리 × 한 자리 (올림 두 번)', sec: 22,
      gen: (r) => until(r, (r) => ({ a: r.int(23, 98), b: r.int(3, 9) }), (p) => mulKind(p.a, p.b) === '3-1-4:6'),
      is: isKind('MUL', '3-1-4:6'), prev: '3-1-4:5', pre: (p) => [p ? danOf(tens(p.a)) : '2-2-2:6', '3-1-1:3'],
      hint: '일의 자리에서 올린 수를 십의 자리 곱에 더하고, 그 합이 10을 넘으면 백의 자리에 써요. 37 × 5는 35에서 3을 올려 3 × 5 + 3 = 18, 답은 185예요.',
      tip: '올림이 두 번 이어지는 세로셈을 천천히 따라 쓰게 하고, 30 × 5 + 7 × 5 = 150 + 35 같은 가로셈으로 답을 확인하게 해요.',
    },
    // ── 3-1-6 분수와 소수 (똑같이 나누기 → 분수 → 단위분수 → 비교 → 소수)
    {
      id: '3-1-6:2', fam: 'g3_EQ', name: '똑같이 나누었는지 알기', kid: '똑같이 나눈 것 찾기', sec: 10,
      gen: (r) => { const d = r.int(2, 6); let d2; do { d2 = r.int(2, 6); } while (d2 === d); return { v: r.chance(0.65) ? 'eq' : 'not', shape: r.pick(['bar', 'pie']), d, d2, right: r.int(0, 2), s: r.int(1, 99999) }; },
      is: (p) => p.v === 'eq' || p.v === 'not', prev: null, pre: ['3-1-3:2'],
      hint: '조각 수가 같아도 크기가 다르면 똑같이 나눈 것이 아니에요. 조각끼리 겹쳐 보면 크기가 꼭 같아야 해요.',
      bridge: '"몇 조각"이 아니라 "크기가 같은 조각"이라야 분수의 전체를 나눈 것이에요.',
    },
    {
      id: '3-1-6:3', fam: 'F1', name: '분수 알기 (색칠한 부분)', kid: '색칠한 부분을 분수로', sec: 10,
      gen: (r) => { const d = r.int(2, 8), q = { d, n: r.int(1, d - 1), shape: r.pick(['bar', 'pie']) }; return r.chance(0.3) ? { ...q, v: 'words' } : q; },
      make: (p) => (p.v === 'words'
        ? nums([`전체를 똑같이 ${RO(p.d)} 나눈 것 중의 ${J(p.n, '을', '를')} 분수로 쓰면 `, fb(0, 1)], [p.n, p.d], {
          bugs: [{ test: (v) => v[0] === p.d && v[1] === p.n, name: '분모와 분자를 바꿈', to: null }, { test: (v) => v[0] === p.n && v[1] === p.d - p.n, name: '부분 / 나머지로 씀', to: null }],
        })
        : fracKeep([{ svg: p.shape === 'pie' ? pie(p.d, p.n) : bar(p.d, p.n) }, '색칠한 부분은 전체의 ', fb(0, 1)], F(p.n, p.d), [
          { test: (v) => v[0] === p.n && v[1] === p.d - p.n, name: '색칠한 칸 수 / 안 칠한 칸 수로 씀 (전체를 분모로 안 씀)', to: '3-1-6:2' },
          { test: (v) => v[0] === p.d && v[1] === p.n, name: '분모와 분자를 바꿈', to: null },
        ])),
      is: (p) => (!p.v || p.v === 'words') && p.n >= 1 && p.n < p.d, prev: '3-1-6:2', pre: [],
      hint: '전체를 똑같이 4로 나눈 것 중의 3은 3/4이에요. 아래(분모)는 나눈 수, 위(분자)는 색칠한 수예요.',
    },
    {
      id: '3-1-6:4', fam: 'g3_FRACW', name: '분수 알기 (읽기·분모와 분자)', kid: '분수 읽고 쓰기', sec: 12,
      gen: (r) => { const v = r.pick(['rest', 'read', 'term']), d = r.int(2, v === 'rest' ? 8 : 9); return { v, d, n: r.int(1, d - 1), shape: r.pick(['bar', 'pie']) }; },
      is: (p) => ['rest', 'read', 'term'].includes(p.v), prev: '3-1-6:3', pre: [],
      hint: '3/5는 분모 5부터 읽어 "5분의 3"이라고 해요. 아래 5가 분모, 위 3이 분자예요.',
    },
    {
      id: '3-1-6:5', fam: 'F3', def: true, name: '단위분수', kid: '1/몇이 몇 개', sec: 8,
      gen: (r) => { const d = r.int(3, 10); return { v: r.pick(['count', 'build']), d, n: r.int(2, d - 1) }; },
      make: (p) => (p.v === 'build' ? buildUnits(p) : F3.make(p)),
      is: (p) => (p.v === 'count' || p.v === 'build') && p.n >= 1 && p.n < p.d, prev: '3-1-6:4', pre: [],
      hint: '1/5, 1/3처럼 분자가 1인 분수가 단위분수예요. 3/5는 1/5이 3개예요.',
    },
    {
      id: '3-1-6:6', fam: 'F3', name: '분모가 같은 분수 크기 비교', kid: '분모가 같은 분수 비교', sec: 8,
      gen: (r) => {
        // 둘 중 고르기는 찍어서 맞히기 쉬워 셋 중 고르기를 주로 낸다
        const d = r.int(3, 10);
        if (d >= 4 && r.chance(0.85)) { let ns; do { ns = [0, 1, 2].map(() => r.int(1, d - 1)); } while (new Set(ns).size < 3); return { v: 'cmp3', d, ns, want: r.pick(['max', 'min']) }; }
        const n = r.int(1, d - 1); let m; do { m = r.int(1, d - 1); } while (m === n); return { v: 'cmp', d, n, m };
      },
      make: (p) => {
        if (p.v !== 'cmp3') return F3.make(p);
        const right = p.ns.indexOf((p.want === 'max' ? Math.max : Math.min)(...p.ns)), bugs = {};
        p.ns.forEach((n, k) => { if (k !== right) bugs[k] = { name: p.want === 'max' ? '분자가 작은 쪽을 고름' : '분자가 큰 쪽을 고름', to: '3-1-6:3' }; });
        return pick([p.want === 'max' ? '가장 큰 수를 고르세요.' : '가장 작은 수를 고르세요.'], p.ns.map((n) => [fx(n, p.d)]), right, { bugs });
      },
      is: (p) => (p.v === 'cmp' && p.n < p.d && p.m < p.d) || (p.v === 'cmp3' && Array.isArray(p.ns) && p.ns.every((n) => n < p.d)), prev: '3-1-6:5', pre: ['1-1-1:8'],
      hint: '분모가 같으면 조각 크기가 같아서 분자가 클수록 커요. 4/7은 1/7이 4개라 2/7보다 커요.',
      tip: '분모가 같은 분수는 단위분수가 몇 개인지로 비교해요. 같은 길이의 수 막대 두 개를 위아래로 놓고 색칠한 칸 수를 비교하게 해요.',
    },
    {
      id: '3-1-6:7', fam: 'F2', name: '단위분수 크기 비교', kid: '1/몇끼리 비교', sec: 8,
      gen: (r) => {
        if (r.chance(0.8)) { let ds; do { ds = [0, 1, 2].map(() => r.int(2, 10)); } while (new Set(ds).size < 3); return { v: 'three', ds, want: r.pick(['max', 'min']) }; }
        let a, b; do { a = r.int(2, 10); b = r.int(2, 10); } while (a === b); return { a, b };
      },
      make: (p) => {
        if (p.v !== 'three') return F2.make(p);
        const big = p.ds.indexOf(Math.min(...p.ds)), small = p.ds.indexOf(Math.max(...p.ds)), max = p.want === 'max', right = max ? big : small, bugs = {};
        p.ds.forEach((d, k) => {
          if (k === right) return;
          bugs[k] = k === (max ? small : big) ? { name: max ? '분모가 클수록 크다고 봄 (자연수 규칙)' : '분모가 작을수록 작다고 봄 (자연수 규칙)', to: '3-1-6:3' } : { name: '가운데 크기의 수를 고름', to: null };
        });
        return pick([max ? '가장 큰 수를 고르세요.' : '가장 작은 수를 고르세요.'], p.ds.map((d) => [fx(1, d)]), right, { bugs });
      },
      is: (p) => (p.v === 'three' && Array.isArray(p.ds)) || (!p.v && p.a !== p.b && p.a >= 2 && p.b >= 2), prev: '3-1-6:5', pre: ['3-1-3:2'],
      hint: '같은 것을 많이 나눌수록 한 조각은 작아져요. 1/3이 1/5보다 커요.',
      bridge: '분모(나눈 수)가 클수록 한 조각이 작아요 — 자연수의 크기 규칙과 거꾸로라 따로 짚어요.',
    },
    {
      id: '3-1-6:8', fam: 'DEC1', def: true, name: '소수 알기 (0.1~0.9)', kid: '0.1이 몇 개', sec: 8,
      gen: (r) => { const v = r.pick(['count', 'frac', 'mm']); return { v, n: r.int(v === 'count' ? 2 : 1, 9) }; },
      make: (p) => (p.v === 'mm'
        ? nums([`${p.n} mm = `, B(0), ' cm'], dec1(p.n), {
          noFrac: true,
          bugs: [{ test: (v) => v[0] === p.n, name: 'mm 수를 그대로 씀', to: null }, { test: (v) => near(v[0], p.n / 100), name: '0.1과 0.01을 헷갈림', to: '3-1-6:5' }],
        })
        : DEC1.make(p)),
      is: (p) => (['count', 'frac', 'mm', 'units'].includes(p.v)) && p.n >= 1 && p.n <= 9, prev: '3-1-6:5', pre: [],
      hint: '1/10은 0.1이라고 쓰고 "영 점 일"이라고 읽어요. 0.1이 7개이면 0.7이에요.',
      bridge: '분수 1/10을 소수 0.1로 쓰는 약속 — 소수점은 "1보다 작은 부분이 시작되는 곳"이에요.',
    },
    {
      id: '3-1-6:9', fam: 'DEC1', name: '소수 알기 (몇.몇)', kid: '1보다 큰 소수', sec: 10,
      gen: (r) => ({ v: r.pick(['units', 'cm', 'join']), n: r.int(1, 9) * 10 + r.int(1, 9) }),
      make: (p) => {
        const w = Math.floor(p.n / 10), m = p.n % 10, x = dec1(p.n);
        if (p.v === 'cm') {
          return nums([`${w} cm ${m} mm = `, B(0), ' cm'], x, {
            noFrac: true,
            bugs: [{ test: (v) => v[0] === p.n, name: 'mm로 바꿔 씀', to: null }, { test: (v) => near(v[0], w + m / 100), name: '1 mm를 0.01 cm로 봄', to: '3-1-6:8' }],
          });
        }
        if (p.v === 'join') {
          return nums([`${J(w, '과', '와')} 0.${m}만큼을 소수로 쓰면 `, B(0)], x, {
            noFrac: true,
            bugs: [{ test: (v) => v[0] === w + m, name: '자연수와 소수 부분의 숫자를 더함', to: '3-1-6:8' }, { test: (v) => near(v[0], m / 10), name: '자연수 부분을 빠뜨림', to: null }],
          });
        }
        return DEC1.make(p);
      },
      is: (p) => (['units', 'cm', 'join'].includes(p.v) && p.n >= 11) || ((p.v === 'count' || p.v === 'frac') && p.n >= 10),
      prev: '3-1-6:8', pre: ['1-2-1:3'],
      hint: '2와 0.3만큼은 2.3이고, 0.1이 23개예요. 3 cm 5 mm는 3.5 cm예요.',
      tip: '수직선에서 2와 3 사이를 10칸으로 나눠 2.3을 짚게 해요. 자 위에서 3 cm 5 mm = 3.5 cm를 읽으며 "자연수 부분 + 0.1이 몇 개"로 말하게 해요.',
    },
    {
      id: '3-1-6:10', fam: 'g3_DECCMP', name: '소수의 크기 비교', kid: '소수 비교', sec: 10,
      gen: (r) => {
        // 언제나 세 수 중에서 고른다 (둘 중 고르기는 찍어서 맞히기 쉬움) · trap = 소수 첫째 자리만 보면 틀리게
        const t = () => r.int(1, 9), v = r.pick(['lt1', 'same', 'trap', 'trap', 'three']), ask = r.chance(0.6) ? 'max' : 'min';
        let xs;
        do {
          if (v === 'lt1') xs = [t(), t(), t()];
          else if (v === 'same') { const w = r.int(1, 9); xs = [w * 10 + t(), w * 10 + t(), w * 10 + t()]; }
          else if (v === 'trap') {
            const w = r.int(1, 8), hi = r.int(6, 9), lo = r.int(1, 3);
            xs = ask === 'max' ? [w * 10 + hi, (w + 1) * 10 + lo, w * 10 + r.int(1, hi - 1)] : [(w + 1) * 10 + lo, w * 10 + hi, (w + 1) * 10 + r.int(lo + 1, 9)];
            xs = r.shuffle(xs);
          } else { const w = r.int(0, 3); xs = r.shuffle([w * 10 + t(), (w + r.int(0, 1)) * 10 + t(), (w + 1) * 10 + t()]); }
        } while (new Set(xs).size !== xs.length);
        return { v, ask, xs };
      },
      is: (p) => Array.isArray(p.xs), prev: '3-1-6:9', pre: ['1-2-1:5'],
      hint: '먼저 자연수 부분을 비교하고, 같으면 소수 첫째 자리를 비교해요. 2.8보다 3.1이 커요.',
    },
    // ── 3-2-1 곱셈
    {
      id: '3-2-1:2', fam: 'MUL', name: '세 자리×한 자리 (올림 없음)', kid: '세 자리 × 한 자리 (올림 없이)', sec: 20,
      gen: (r) => until(r, (r) => ({ a: r.int(101, 444), b: r.int(2, 4) }), (p) => mulKind(p.a, p.b) === '3-2-1:2'),
      is: isKind('MUL', '3-2-1:2'), prev: null, pre: (p) => ['3-1-4:3', p ? danOf(p.b) : '2-2-2:2'],
      hint: '백, 십, 일의 자리를 따로 곱해서 더해요. 213 × 3 = 600 + 30 + 9 = 639.',
      tip: '세로셈에서 일의 자리부터 곱하고, 올린 수는 바로 윗자리 위에 작게 써서 그 자리 곱에 더하게 해요. 213 × 3 = 600 + 30 + 9처럼 자리마다 나눈 가로셈으로 답을 확인해요.',
    },
    {
      id: '3-2-1:3', fam: 'MUL', name: '세 자리×한 자리 (올림 한 번)', kid: '세 자리 × 한 자리 (올림 한 번)', sec: 25,
      // 올림 자리: 일 40% · 십 35% · 백(곱이 네 자리) 25% — 백의 자리 올림만 있는 곱은 쉬운 편이라 덜 낸다
      gen: (r) => { const at = r.chance(0.4) ? 0 : r.chance(0.58) ? 1 : 2; return until(r, (r) => ({ a: r.int(101, 999), b: r.int(2, 9) }), (p) => mulKind(p.a, p.b) === '3-2-1:3' && carryAt(p.a, p.b) === at); },
      is: isKind('MUL', '3-2-1:3'), prev: '3-2-1:2', pre: (p) => ['3-1-4:5', p ? danOf(p.b) : '2-2-2:4'],
      hint: '곱이 10을 넘는 자리에서는 윗자리로 올리고, 올린 수는 윗자리 곱에 더해요. 216 × 3에서 6 × 3 = 18의 1을 올려 648이에요.',
      tip: '세로셈에서 일의 자리부터 곱하고, 올린 수는 바로 윗자리 위에 작게 써서 그 자리 곱에 더하게 해요. 213 × 3 = 600 + 30 + 9처럼 자리마다 나눈 가로셈으로 답을 확인해요.',
    },
    {
      id: '3-2-1:4', fam: 'MUL', name: '세 자리×한 자리 (올림 여러 번)', kid: '세 자리 × 한 자리 (올림 여러 번)', sec: 30,
      gen: (r) => until(r, (r) => ({ a: r.int(101, 999), b: r.int(3, 9) }), (p) => mulKind(p.a, p.b) === '3-2-1:4'),
      is: isKind('MUL', '3-2-1:4'), prev: '3-2-1:3', pre: (p) => ['3-1-4:6', p ? danOf(p.b) : '2-2-2:6'],
      hint: '일의 자리부터 곱하고, 올린 수를 작게 적어 두었다가 윗자리 곱에 꼭 더해요. 358 × 4 = 1432예요.',
      tip: '세로셈에서 일의 자리부터 곱하고, 올린 수는 바로 윗자리 위에 작게 써서 그 자리 곱에 더하게 해요. 213 × 3 = 600 + 30 + 9처럼 자리마다 나눈 가로셈으로 답을 확인해요.',
    },
    {
      id: '3-2-1:5', fam: 'MUL', name: '(한 자리·두 자리)×(몇십)', kid: '몇십 곱하기', sec: 15,
      gen: (r) => until(r, (r) => ({ a: r.chance(0.4) ? r.int(2, 9) : r.int(11, 99), b: r.int(2, 9) * 10 }), (p) => mulKind(p.a, p.b) === '3-2-1:5'),
      // 23 × 30 → 69처럼 0을 빠뜨린 답은 '몇십의 0을 빠뜨림'으로 (가족의 '둘째 줄을 밀지 않음'은 두 자리 × 두 자리용)
      make: (p) => withFirst(OPSBY.MUL.make(p), [{ test: (v) => v[0] * 10 === p.a * p.b, name: '곱하는 몇십의 0을 빠뜨림', to: '3-1-4:2' }]),
      is: isKind('MUL', '3-2-1:5'), prev: null, pre: ['3-1-4:2', '3-1-4:6'],
      hint: '6 × 40은 6 × 4 = 24에 0을 하나 붙여 240이에요. 23 × 30도 23 × 3 = 69에 0을 붙여 690이에요.',
      tip: '6 × 40 = 6 × 4 × 10이에요. "0을 붙인다"를 외우기보다 몇십은 몇의 10배라서 곱도 10배가 된다는 까닭을 말하게 해요.',
    },
    {
      id: '3-2-1:6', fam: 'MUL', name: '(한 자리)×(몇십몇)', kid: '한 자리 × 두 자리', sec: 20,
      gen: (r) => until(r, (r) => ({ a: r.int(2, 9), b: r.int(11, 99) }), (p) => mulKind(p.a, p.b) === '3-2-1:6'),
      is: isKind('MUL', '3-2-1:6'), prev: '3-2-1:5',
      pre: (p) => ['3-1-4:6', p ? danOf(Math.min(p.a, p.b)) : '2-2-2:6'],
      steps: (p) => {
        const s = Math.min(p.a, p.b), t = Math.max(p.a, p.b), tt = t - ones(t), o = ones(t);
        return [
          { c: 'MUL', p: { a: s, b: tt }, why: `${s} × ${J(tt, '을', '를')} 해요.` },
          { c: 'MUL', p: { a: s, b: o }, why: `${s} × ${J(o, '을', '를')} 해요.` },
          { c: 'ADD', p: { a: s * tt, b: s * o }, why: '두 곱을 더해요.' },
        ];
      },
      hint: '4 × 23은 4 × 20과 4 × 3을 따로 구해서 더해요. 80 + 12 = 92예요.',
      tip: '4 × 23 = 4 × 20 + 4 × 3을 모눈종이 직사각형(4줄 × 23칸)을 20칸과 3칸으로 잘라 보여 줘요. 곱하는 순서를 바꿔도(23 × 4) 곱이 같다는 것도 짚어요.',
    },
    {
      id: '3-2-1:7', fam: 'MUL', name: '두 자리×두 자리 (올림 한 번)', kid: '두 자리 × 두 자리 (올림 한 번)', sec: 45,
      gen: (r) => mul22(r, (p) => mulKind(p.a, p.b) === '3-2-1:7' && carries22(p.a, p.b) === 1),
      is: isKind('MUL', '3-2-1:7'), prev: '3-2-1:5', pre: ['3-1-4:5', '3-1-1:3'],
      hint: '13 × 14는 13 × 4와 13 × 10을 따로 구해서 더해요. 52 + 130 = 182예요.',
      tip: '세로셈 두 줄(13 × 4, 13 × 10)을 쓰고 둘째 줄은 몇십을 곱한 것이라 일의 자리가 0이라는 것을 짚어요. 모눈 넓이 그림으로 두 부분 곱을 보여 주면 좋아요.',
    },
    {
      id: '3-2-1:8', fam: 'MUL', name: '두 자리×두 자리 (올림 여러 번)', kid: '두 자리 × 두 자리 (올림 여러 번)', sec: 60,
      gen: (r) => mul22(r, (p) => mulKind(p.a, p.b) === '3-2-1:8'),
      is: isKind('MUL', '3-2-1:8'), prev: '3-2-1:7', pre: ['3-1-4:6', '3-1-1:4'],
      hint: '58 × 37은 58 × 7 = 406과 58 × 30 = 1740을 더해 2146이에요. 둘째 줄은 몇십을 곱한 것이라 한 칸 밀어 써요.',
      tip: '부분 곱마다 올림이 생기므로 올린 수를 줄마다 따로 적게 해요. 둘째 줄을 한 칸 밀어 쓰지 않는 실수(58 × 3으로 계산)를 꼭 짚어요.',
    },
    // ── 3-2-2 나눗셈
    {
      id: '3-2-2:2', fam: 'DIV', name: '(몇십)÷(몇) 내림 없음', kid: '몇십 나누기 몇 (내림 없이)', sec: 12,
      gen: (r) => ({ ...r.pick(r.chance(0.75) ? DIV2.filter((x) => x.a / x.b !== 10) : DIV2) }), // 몫이 10인 것(70 ÷ 7)은 가끔만
      is: isKind('DIV', '3-2-2:2'), prev: null, pre: ['3-1-3:6', '3-1-4:2'],
      steps: (p) => divSplit(p.a, p.b, '3-2-2:2'),
      hint: '60 ÷ 3은 6 ÷ 3 = 2에 0을 붙여 20이에요. 십 모형 6개를 3묶음으로 나누는 것과 같아요.',
      tip: '십 모형 6개를 3묶음으로 나누면 한 묶음에 십 모형 2개 = 20이에요. 6 ÷ 3의 몫에 0을 붙이는 까닭을 수 모형으로 말하게 해요.',
    },
    {
      id: '3-2-2:3', fam: 'DIV', name: '(몇십몇)÷(몇) 내림 없음', kid: '두 자리 나누기 한 자리 (내림 없이)', sec: 18,
      gen: (r) => until(r, (r) => { const b = r.chance(0.8) ? r.int(2, 4) : r.int(5, 9), m = Math.floor(9 / b); return { a: b * (10 * r.int(1, m) + r.int(1, m)), b }; }, (p) => divKind(p.a, p.b) === '3-2-2:3'),
      is: isKind('DIV', '3-2-2:3'), prev: '3-2-2:2', pre: ['3-1-3:6'],
      steps: (p) => divSplit(p.a, p.b, '3-2-2:3'),
      hint: '48 ÷ 4는 40 ÷ 4 = 10과 8 ÷ 4 = 2를 더해서 12예요.',
      tip: '십 모형 4개와 일 모형 8개를 4묶음으로 나누어 보여 주고, 세로셈에서 십의 자리 몫부터 자리를 맞춰 쓰게 해요.',
    },
    {
      id: '3-2-2:4', fam: 'DIV', name: '(몇십)÷(몇) 내림 있음', kid: '몇십 나누기 몇 (내림 있음)', sec: 20,
      gen: (r) => ({ ...r.pick(DIV4) }),
      is: isKind('DIV', '3-2-2:4'), prev: '3-2-2:2', pre: ['3-1-3:6'],
      steps: (p) => divSplit(p.a, p.b, '3-2-2:4'),
      hint: '50 ÷ 2는 40 ÷ 2 = 20과 10 ÷ 2 = 5를 더해서 25예요. 남은 십 모형 1개는 일 모형 10개로 바꿔 나눠요.',
      bridge: '십의 자리에서 남은 십 모형을 일 모형 10개로 바꿔 나누는 것(내림)이 새로 나와요.',
      tip: '50 ÷ 2: 십 모형 5개를 2묶음으로 나누면 1개가 남아요. 그 1개를 일 모형 10개로 바꿔 다시 나누게 해요(내림).',
    },
    {
      id: '3-2-2:5', fam: 'DIV', name: '(몇십몇)÷(몇) 내림 있음', kid: '두 자리 나누기 한 자리 (내림 있음)', sec: 25,
      gen: (r) => until(r, (r) => { const b = r.int(2, 8); return { a: b * r.int(10, Math.floor(99 / b)), b }; }, (p) => divKind(p.a, p.b) === '3-2-2:5'),
      is: isKind('DIV', '3-2-2:5'), prev: '3-2-2:4', pre: ['3-1-3:6', '3-2-2:3'],
      steps: (p) => divSplit(p.a, p.b, '3-2-2:5'),
      hint: '72 ÷ 3은 60 ÷ 3 = 20과 12 ÷ 3 = 4를 더해서 24예요.',
      tip: '세로셈에서 7 ÷ 3 = 2 … 1, 남은 1(십)을 일의 자리 2와 합쳐 12 ÷ 3을 해요. 내려 쓰는 과정을 수 모형 바꾸기와 연결해요.',
    },
    {
      id: '3-2-2:6', fam: 'DIV', name: '나머지 있는 나눗셈 (내림 없음)', kid: '나머지가 있는 나눗셈', sec: 20,
      gen: (r) => until(r, (r) => {
        const b = r.int(2, 9);
        if (r.chance(0.5)) { const q = r.int(2, 9); return { a: b * q + r.int(1, b - 1), b }; }
        return { a: 10 * b * r.int(1, Math.floor(9 / b)) + r.int(1, 9), b };
      }, (p) => p.a >= 10 && divKind(p.a, p.b) === '3-2-2:6'),
      is: isKind('DIV', '3-2-2:6'), prev: '3-2-2:3', pre: (p) => ['3-1-3:6', p ? danOf(p.b) : '2-2-2:4'],
      steps: (p) => divSplit(p.a, p.b, '3-2-2:6'),
      hint: '17 ÷ 5는 5단에서 17을 넘지 않는 15를 찾아 몫이 3, 남은 2가 나머지예요. 나머지는 5보다 작아야 해요.',
      tip: '바둑돌 17개를 5개씩 덜어 내고 남는 2개가 나머지라는 것을 보여 줘요. 나머지가 나누는 수보다 크면 더 덜어 낼 수 있다는 것을 꼭 확인하게 해요.',
      bridge: '똑같이 나누고 남는 수(나머지)는 언제나 나누는 수보다 작다는 것이 새로 나와요.',
    },
    {
      id: '3-2-2:7', fam: 'DIV', name: '나머지 있는 나눗셈 (내림 있음)', kid: '나머지가 있는 나눗셈 (내림 있음)', sec: 30,
      gen: (r) => until(r, (r) => { const b = r.int(2, 8); return { a: r.int(10 * b, 99), b }; }, (p) => divKind(p.a, p.b) === '3-2-2:7'),
      is: isKind('DIV', '3-2-2:7'), prev: '3-2-2:6', pre: (p) => ['3-2-2:5', p ? danOf(p.b) : '2-2-2:5'],
      steps: (p) => divSplit(p.a, p.b, '3-2-2:7'),
      hint: '57 ÷ 4는 40 ÷ 4 = 10, 남은 17 ÷ 4 = 4 … 1이에요. 몫은 10 + 4 = 14, 나머지는 1이에요.',
      tip: '세로셈에서 십의 자리에서 남은 1을 내려 17 ÷ 4를 하게 해요. 마지막에 남은 수가 나누는 수보다 작은지 확인하고, 4 × 14 + 1 = 57로 검산해요.',
    },
    {
      id: '3-2-2:8', fam: 'g3_DIVCHK', name: '나눗셈 계산 확인하기', kid: '나눗셈이 맞는지 확인', sec: 20,
      gen: (r) => until(r, (r) => {
        const v = r.pick(['check', 'find', 'judge']), b = r.int(v === 'judge' ? 3 : 2, 9), q = r.int(2, 19), p = { v, b, q, rem: r.int(1, b - 1) };
        if (v === 'judge') p.k = r.int(0, 2);
        return p;
      }, (p) => p.b * p.q + p.rem <= 99),
      is: (p) => ['check', 'find', 'judge'].includes(p.v), prev: '3-2-2:6',
      pre: ['3-2-1:6', '2-1-3:2'],
      hint: '나누는 수 × 몫 + 나머지 = 나누어지는 수예요. 17 ÷ 5 = 3 … 2이면 5 × 3 + 2 = 17이라 맞아요.',
    },
    {
      id: '3-2-2:9', fam: 'DIV', name: '(세 자리)÷(한 자리)', kid: '세 자리 수 나누기', sec: 35,
      gen: (r) => { const b = r.int(2, 9); return { a: b * r.int(Math.ceil(100 / b), Math.floor(999 / b)), b }; },
      is: isKind('DIV', '3-2-2:9'), prev: '3-2-2:5', pre: (p) => [p ? danOf(p.b) : '2-2-2:6'],
      hint: '백의 자리부터 차례로 나누고, 남은 수는 다음 자리와 함께 나눠요. 576 ÷ 4 = 144예요.',
      tip: '백의 자리부터 나누고, 나눌 수 없으면(1 ÷ 4) 다음 자리와 합쳐(15 ÷ 4) 나눠요. 몫을 쓰는 자리를 맞추는 것이 핵심이에요.',
    },
    {
      id: '3-2-2:10', fam: 'DIV', name: '나머지 있는 (세 자리)÷(한 자리)', kid: '세 자리 수 나누기 (나머지 있음)', sec: 45,
      gen: (r) => until(r, (r) => ({ a: r.int(100, 999), b: r.int(2, 9) }), (p) => p.a % p.b !== 0),
      is: isKind('DIV', '3-2-2:10'), prev: '3-2-2:9', pre: ['3-2-2:7'],
      hint: '높은 자리부터 나누고, 마지막에 남은 수가 나머지예요. 125 ÷ 4 = 31 … 1이고, 나머지 1은 4보다 작아요.',
      tip: '높은 자리부터 나누고 마지막에 남은 수를 나머지로 써요. 나누는 수 × 몫 + 나머지로 검산하게 해요.',
    },
    // ── 3-2-4 분수 (분수로 나타내기 → 분수만큼 → 진분수·가분수·대분수 → 비교)
    {
      id: '3-2-4:2', fam: 'g3_FDISC', name: '분수로 나타내기 (묶음)', kid: '묶음으로 분수 나타내기', sec: 15,
      gen: (r) => { const G = r.int(2, 6); return { G, k: r.int(2, 6), m: r.int(1, G - 1) }; },
      is: (p) => p.G >= 2 && p.k >= 1 && p.m >= 1 && p.m < p.G, prev: null, pre: ['3-1-6:3', '3-1-3:3'],
      hint: '12를 3씩 묶으면 4묶음이에요. 6은 4묶음 중 2묶음이라 12의 2/4예요.',
      tip: '바둑돌을 몇 개씩 묶어 놓고 "전체 몇 묶음 중 몇 묶음"인지 말하게 해요. 분모는 낱개 수가 아니라 묶음 수예요. (약분을 배우기 전이므로 2/4를 1/2로 바꾸게 하지 않아요.)',
      bridge: '전체가 여러 개일 때는 "몇 묶음 중 몇 묶음"으로 분수를 봐요 — 분모는 낱개가 아니라 묶음 수예요.',
    },
    {
      id: '3-2-4:3', fam: 'F4', name: '분수만큼은 얼마 (개수)', kid: '몇의 몇 분의 몇', sec: 15,
      gen: (r) => { const d = r.int(2, 6); return { d, n: r.int(1, d - 1), N: d * r.int(2, 6) }; },
      is: (p) => p.N % p.d === 0 && p.n >= 1 && p.n < p.d, prev: '3-2-4:2',
      pre: (p) => ['3-1-3:6', ...(p && p.n > 1 && p.N / p.d <= 9 ? [danOf(p.N / p.d)] : [])],
      // 같은 숫자로: 전체를 분모만큼 똑같이 나누고(÷) 한 묶음을 분자만큼 모은다(×) — 길이·시간(100, 60)에서 넘어와도 같은 두 단계
      steps: (p) => {
        if (p.N % p.d) return [];
        const k = p.N / p.d;
        return [
          { c: 'DIV', p: { a: p.N, b: p.d }, why: `${J(p.N, '을', '를')} ${p.d}묶음으로 똑같이 나누면 한 묶음은 얼마인가요?` },
          p.n > 1 ? { c: 'MUL', p: { a: k, b: p.n }, why: `한 묶음이 ${k}이니까 ${p.n}묶음은 얼마인가요?` } : null,
        ];
      },
      hint: '12의 2/3는 12를 3묶음으로 똑같이 나눈 것 중 2묶음이에요. 12 ÷ 3 = 4, 4 × 2 = 8이에요.',
    },
    {
      id: '3-2-4:4', fam: 'g3_FQTY', name: '분수만큼은 얼마 (길이·시간)', kid: '1 m, 1시간의 몇 분의 몇', sec: 20,
      gen: (r) => { const u = r.pick(['m', 'm', 'h', 'h', 'day']), d = r.pick(QTY[u].ds); return { u, d, n: r.int(1, d - 1) }; },
      is: (p) => !!QTY[p.u], prev: '3-2-4:3', pre: ['2-2-3:2', '3-2-2:4'],
      hint: '1 m = 100 cm라서 1 m의 1/4은 100 ÷ 4 = 25 cm예요. 1시간 = 60분이라서 1시간의 1/3은 20분이에요.',
    },
    {
      id: '3-2-4:5', fam: 'F3', name: '진분수와 가분수', kid: '진분수, 가분수 알기', sec: 12,
      gen: (r) => {
        const v = r.pick(['kind', 'kind', 'build', 'whole']);
        if (v === 'whole') return { v, w: r.int(1, 3), d: r.int(2, 9) };
        if (v === 'build') { const d = r.int(2, 9); return { v, d, n: r.int(d + 1, 3 * d) }; }
        const want = r.pick(['imp', 'prop']), right = r.int(0, 2);
        const prop = () => { const d = r.int(2, 9); return [r.int(1, d - 1), d]; };
        const imp = () => { const d = r.int(2, 9); return [r.chance(0.3) ? d : r.int(d + 1, 2 * d + 1), d]; };
        let fs;
        do { fs = [0, 1, 2].map((k) => ((k === right) === (want === 'imp') ? imp() : prop())); } while (new Set(fs.map((f) => f.join('/'))).size < 3);
        return { v, want, right, fs };
      },
      make: (p) => {
        if (p.v === 'build') return buildUnits(p);
        if (p.v !== 'kind') return F3.make(p);
        const bugs = {};
        p.fs.forEach(([n, d], k) => {
          if (k === p.right) return;
          bugs[k] = p.want === 'imp' ? { name: '진분수를 가분수로 봄', to: null }
            : n === d ? { name: '분자와 분모가 같은 분수를 진분수로 봄', to: null } : { name: '가분수를 진분수로 봄', to: null };
        });
        return pick([p.want === 'imp' ? '가분수를 고르세요.' : '진분수를 고르세요.'], p.fs.map(([n, d]) => [fx(n, d)]), p.right, { bugs });
      },
      is: (p) => p.v === 'kind' || p.v === 'whole' || ((p.v === 'count' || p.v === 'build') && p.n >= p.d),
      prev: null, pre: ['3-1-6:5'],
      hint: '분자가 분모보다 작으면 진분수, 분자가 분모와 같거나 크면 가분수예요. 1/4이 5개이면 5/4로 가분수예요.',
      tip: '1/4 조각을 하나씩 이어 붙여 4개면 1(4/4), 5개면 1보다 큰 5/4가 되는 것을 수 막대로 보여 줘요. 분자와 분모가 같은 4/4도 가분수라는 것을 짚어요.',
      bridge: '1보다 큰 양도 단위분수의 개수로 셀 수 있어요 — 4/4 = 1, 5/4는 1보다 1/4 커요.',
    },
    {
      id: '3-2-4:6', fam: 'F5', name: '대분수 (가분수와 바꾸기)', kid: '대분수 ↔ 가분수', sec: 15,
      gen: (r) => { const d = r.int(2, 9); return { v: r.chance(0.5) ? 'toImp' : 'toMix', w: r.int(1, 4), n: r.int(1, d - 1), d }; },
      is: (p) => (p.v === 'toImp' || p.v === 'toMix') && p.w >= 1 && p.n >= 1 && p.n < p.d,
      prev: '3-2-4:5', pre: (p) => ['3-2-2:6', p ? danOf(p.d) : '2-2-2:4'],
      steps: (p) => (p.v === 'toImp'
        ? [{ c: 'F3', p: { v: 'whole', w: p.w, d: p.d }, why: `${p.w}${P(p.w, '은', '는')} 1/${p.d}이 몇 개인가요?` },
          { c: 'ADD', p: { a: p.w * p.d, b: p.n }, why: `1/${p.d}이 ${p.w * p.d}개와 분수 부분의 ${p.n}개를 더해요.` }]
        : [{ c: 'DIV', p: { a: p.w * p.d + p.n, b: p.d }, why: `${p.w * p.d + p.n} 안에 ${p.d}${P(p.d, '이', '가')} 몇 번 들어가고 몇이 남는지 봐요.` }]),
      hint: '2 1/3에서 2는 3/3이 두 번이라 6/3이에요. 6/3과 1/3을 더하면 7/3이에요.',
    },
    {
      id: '3-2-4:7', fam: 'g3_FCMP', name: '가분수·대분수 크기 비교', kid: '가분수·대분수 크기 비교', sec: 15,
      gen: (r) => {
        // 언제나 세 수 중에서 고른다 (둘 중 고르기는 찍어서 맞히기 쉬움) · 가장 큰 수 60% · 가장 작은 수 40%
        const d = r.int(3, 9), v = r.pick(['mm', 'im', 'ii', 'three', 'three']), ask = r.chance(0.6) ? 'max' : 'min';
        const mix = (w) => w * d + r.int(1, d - 1);
        let xs, ms;
        do {
          if (v === 'mm') { const w = r.int(1, 4); xs = [mix(w), mix(w), mix(r.int(1, 4))]; ms = [1, 1, 1]; }
          else if (v === 'im') {
            const b = mix(r.int(1, 3)), [e1, e2] = r.shuffle([-3, -2, -1, 1, 2, 3]);
            const pairs = r.shuffle([[b, 1], [b + e1, 0], [b + e2, r.chance(0.5) ? 1 : 0]]);
            xs = pairs.map((q) => q[0]); ms = pairs.map((q) => q[1]);
          } else if (v === 'ii') { xs = [0, 1, 2].map(() => r.int(d, 4 * d)); ms = [0, 0, 0]; }
          else { const w = r.int(1, 3); xs = [0, 1, 2].map(() => r.int(w * d + 1, (w + 2) * d - 1)); ms = xs.map((x) => (x % d && r.chance(0.5) ? 1 : 0)); }
        } while (new Set(xs).size !== xs.length || Math.min(...xs) <= d - (v === 'ii' ? 1 : 0) || xs.some((x, k) => ms[k] && x % d === 0));
        return { v, d, xs, ms, ask };
      },
      is: (p) => ['mm', 'im', 'ii', 'three'].includes(p.v) && Array.isArray(p.xs), prev: '3-2-4:6', pre: ['3-1-6:6'],
      hint: '대분수는 자연수 부분부터 비교해요. 가분수와 대분수는 한쪽으로 바꿔서 비교해요. 11/4 = 2 3/4이라 2 1/4보다 커요.',
    },
  ],
};
