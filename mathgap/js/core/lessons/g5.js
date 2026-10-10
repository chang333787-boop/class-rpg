// 5학년 차시 (아이스크림 5-1 · 5-2) — 정의 방법은 docs/LESSONS.md
//   새 가족: g5_MIX 혼합 계산 · g5_CORR 대응 관계(표·식) · g5_EQF 그림으로 보는 크기가 같은 분수
//            g5_MIXADD · g5_MIXSUB 분모가 다른 대분수의 덧셈·뺄셈 · g5_RANGE 이상·이하·초과·미만 · g5_ROUND 올림·버림·반올림
//            g5_DMUL 소수의 곱셈 · g5_DPOINT 곱의 소수점 위치
//   다시 쓴 개념 가족: G1~G4 · R1 · F7~F15a (차시마다 gen으로 유형을 좁히고 is로 가른다)
import { nums, frac, mixed, pick, fx, fb, B, P, F, gcd } from '../concepts/kit.js';
import { lcm, eqv, near, fmt, divisors, simp } from '../math.js';
import { twoBars, toText } from '../tokens.js';
import { KIND, danOf } from './ops.js';
import FRAC from '../concepts/frac.js';
import DECS from '../concepts/dec.js';
import RATIO from '../concepts/ratio.js';

const CF = Object.fromEntries([...FRAC, ...DECS, ...RATIO].map((c) => [c.id, c]));
// 조건에 맞는 params가 나올 때까지 다시 뽑기 (무한 반복 방지)
const until = (r, make, ok, tries = 4000) => { for (let i = 0; i < tries; i++) { const p = make(r); if (ok(p)) return p; } throw new Error('gen: 조건에 맞는 수를 못 찾음'); };
const uniq = (a) => [...new Set(a.filter(Boolean))];
const cop = (r, d) => { let n; do { n = r.int(1, d - 1); } while (gcd(n, d) !== 1); return n; };
// 글자로 쓴 수(소수 포함) 뒤 조사 — 마지막으로 읽는 숫자의 받침으로
const BAT = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
const jx = (s, withB, noB) => `${s}${BAT[Number(String(s).slice(-1))] ? withB : noB}`;
// 분모가 다른 두 진분수 (concepts/frac.js의 pair와 같은 규칙)
function pair(r, maxL = 36, wantShared = 0.7) {
  let d1, d2, L;
  do { d1 = r.int(2, 9); d2 = r.int(2, 9); L = lcm(d1, d2); } while (d1 === d2 || L > maxL || (L === Math.max(d1, d2) && r.chance(0.6)) || (r.chance(wantShared) && gcd(d1, d2) === 1));
  return { n1: cop(r, d1), d1, n2: cop(r, d2), d2, L };
}
// 답이 자연수면 빈칸 하나, 아니면 대분수 빈칸 (분수 부분이 진분수이고 크기가 같으면 정답)
const mixAns = (prompt, f, bugs = []) => (f = simp(f), f.n % f.d === 0
  ? nums([...prompt, B(0)], f.n / f.d, { bugs })
  : mixed([...prompt, { m: [B(0), B(1), B(2)] }], f, { bugs }));
const MX = (w, n, d) => ({ m: [w, n, d] });
// 답이 자연수면 빈칸 하나, 아니면 분수 빈칸 (가분수·크기가 같은 분수도 정답) — 보여 주는 답은 기약분수
const fracAns = (prompt, f, bugs = []) => (f = simp(f), f.n % f.d === 0 ? nums([...prompt, B(0)], f.n / f.d, { bugs }) : frac([...prompt, fb(0, 1)], f, { bugs }));

// ───────────── 5-1-1 자연수의 혼합 계산 (g5_MIX)
//   params { x: [수…], o: ['+','−','×','÷'…], g: [i, j] | null } — g = 괄호로 묶은 수의 번호 i~j
const OPF = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => (b && a % b === 0 ? a / b : NaN) };
const OPFAM = { '+': 'ADD', '−': 'SUB', '×': 'MUL', '÷': 'DIV' };
const isMD = (o) => o === '×' || o === '÷';
// 계산 순서대로 한 번에 하나씩. 오답 모양을 흉내 낼 때: paren 괄호 무시 · prec 곱셈·나눗셈 먼저를 무시 · rAS/rMD 같은 단계를 뒤에서부터
function evalX(p, { paren = true, prec = true, rAS = false, rMD = false } = {}) {
  const x = p.x.slice(), o = p.o.slice(), st = [];
  let g = paren && p.g ? p.g.slice() : null;
  while (o.length) {
    const inG = !!g;
    let cand = [];
    for (let k = g ? g[0] : 0; k <= (g ? g[1] - 1 : o.length - 1); k++) cand.push(k);
    let md = false;
    if (prec) { const m = cand.filter((k) => isMD(o[k])); if (m.length) { cand = m; md = true; } }
    const k = prec && (md ? rMD : rAS) ? cand[cand.length - 1] : cand[0];
    const a = x[k], b = x[k + 1], v = OPF[o[k]](a, b);
    if (!Number.isInteger(v) || v < 0) return { ok: false, v: NaN, st };
    st.push({ op: o[k], a, b, v, inG, first: isMD(o[k]) && o.some((q) => !isMD(q)), last: o.length === 1 });
    x.splice(k, 2, v); o.splice(k, 1);
    if (g) { if (k < g[0]) { g[0]--; g[1]--; } else if (k < g[1]) g[1]--; if (g[1] <= g[0]) g = null; }
  }
  return { ok: true, v: x[0], st };
}
const exprText = (p) => p.x.map((n, i) => `${p.g && p.g[0] === i ? '(' : ''}${n}${p.g && p.g[1] === i ? ')' : ''}`).reduce((s, t, i) => (i ? `${s} ${p.o[i - 1]} ${t}` : t), '');
export function mixKind(p) {
  const md = p.o.some(isMD), as = p.o.some((o) => !isMD(o));
  if (!md) return '5-1-1:2';
  if (!as) return '5-1-1:3';
  const m = p.o.includes('×'), d = p.o.includes('÷');
  return m && d ? '5-1-1:6' : m ? '5-1-1:4' : '5-1-1:5';
}
function mixBugs(p, ans) {
  const L = mixKind(p), out = [], seen = new Set([ans]);
  const add = (q, name, to) => { if (!q.ok || seen.has(q.v)) return; seen.add(q.v); const w = q.v; out.push({ test: (v) => v[0] === w, name, to }); };
  const md = p.o.some(isMD), as = p.o.some((o) => !isMD(o));
  if (p.g) add(evalX(p, { paren: false }), '괄호 안을 먼저 계산하지 않음', L === '5-1-1:2' ? null : '5-1-1:2');
  if (md && as) {
    const precTo = { '5-1-1:4': null, '5-1-1:5': '5-1-1:4', '5-1-1:6': ['5-1-1:4', '5-1-1:5'] }[L];
    add(evalX(p, { prec: false }), '곱셈·나눗셈보다 앞의 덧셈·뺄셈을 먼저 함 (앞에서부터 계산)', precTo);
    if (p.g) add(evalX(p, { prec: false, paren: false }), '괄호도 곱셈·나눗셈도 생각하지 않고 앞에서부터 계산함', uniq(['5-1-1:2', ...[].concat(precTo || [])]));
  }
  add(evalX(p, { rAS: true }), '덧셈과 뺄셈을 앞에서부터 차례로 하지 않음', L === '5-1-1:2' ? null : '5-1-1:2');
  add(evalX(p, { rMD: true }), '곱셈과 나눗셈을 앞에서부터 차례로 하지 않음', L === '5-1-1:3' ? null : '5-1-1:3');
  return out;
}
const opName = (o) => ({ '+': '덧셈', '−': '뺄셈', '×': '곱셈', '÷': '나눗셈' }[o]);
const mixWhy = (s) => (s.inG ? `괄호 안의 ${s.a} ${s.op} ${jx(s.b, '을', '를')} 먼저 계산해요.`
  : s.first ? `${opName(s.op)}을 덧셈·뺄셈보다 먼저 계산해요.`
    : s.last ? '남은 계산을 해요.' : '앞에서부터 차례로 계산해요.');
// 차시마다 쓰는 연산 (n = 수의 개수)
const MIXSPEC = {
  '5-1-1:2': { n: (r) => (r.chance(0.75) ? 3 : 4), pool: ['+', '−'], need: () => ['+', '−'], paren: 0.45 },
  '5-1-1:3': { n: () => 3, pool: ['×', '÷'], need: () => ['×', '÷'], paren: 0.45 },
  '5-1-1:4': { n: (r) => (r.chance(0.7) ? 4 : 3), pool: ['+', '−', '×'], need: (n) => (n === 4 ? ['+', '−', '×'] : ['×']), paren: 0.5 },
  '5-1-1:5': { n: (r) => (r.chance(0.7) ? 4 : 3), pool: ['+', '−', '÷'], need: (n) => (n === 4 ? ['+', '−', '÷'] : ['÷']), paren: 0.5 },
  '5-1-1:6': { n: () => 5, pool: ['+', '−', '×', '÷'], need: () => ['+', '−', '×', '÷'], paren: 0.5 },
};
function genMix(r, id) {
  const S = MIXSPEC[id], paren = r.chance(S.paren), mulFirst = id === '5-1-1:3' && !paren && r.chance(0.3), trap = !mulFirst && r.chance(0.85);
  return until(r, (r) => {
    const n = S.n(r), o = [];
    for (let i = 0; i < n - 1; i++) o.push(r.pick(S.pool));
    if (mulFirst) { o[0] = '×'; o[1] = '÷'; }
    const x = [];
    for (let i = 0; i < n; i++) {
      const L = o[i - 1], R = o[i];
      if (L === '×' || L === '÷') x.push(r.int(2, 9));
      else if (R === '÷') x.push(0);
      else if (R === '×') x.push(r.chance(0.6) ? r.int(2, 9) : r.int(11, 25));
      else x.push(i === 0 ? r.int(20, 99) : r.int(2, 60));
    }
    for (let i = 0; i < n - 1; i++) if (o[i] === '÷' && x[i] === 0) x[i] = x[i + 1] * r.int(2, 15);
    let g = null;
    if (paren) { const i = r.int(0, n - 2), j = r.int(i + 1, n - 1); if (!(i === 0 && j === n - 1)) g = [i, j]; }
    return { x, o, g, n };
  }, (p) => {
    if (!S.need(p.n).every((q) => p.o.includes(q)) || p.o.some((q, i) => q === '÷' && p.o[i + 1] === '÷')) return false;
    // ÷ 2 × 2처럼 같은 수로 나누고 곱하면 계산 없이 지워져 순서를 잴 수 없다
    if (p.o.some((q, i) => i + 1 < p.o.length && isMD(q) && isMD(p.o[i + 1]) && q !== p.o[i + 1] && p.x[i + 1] === p.x[i + 2])) return false;
    if (mixKind(p) !== id) return false;
    const e = evalX(p);
    // 나눗셈 몫이 1인 식(27 ÷ (9 × 3) = 27 ÷ 27)은 교과서에 거의 없고 계산 순서를 재기에도 싱겁다
    if (!e.ok || e.st.some((s) => s.v < 1 || s.v > 999 || (s.op === '÷' && s.v < 2))) return false;
    if (paren !== !!p.g) return false;
    if (p.g) { const q = evalX(p, { paren: false }); return q.ok && q.v !== e.v; }
    const md = p.o.some(isMD), as = p.o.some((q) => !isMD(q));
    if (md && as) return evalX(p, { prec: false }).v !== e.v;
    if (!trap) return true;
    const q = evalX(p, { rAS: true, rMD: true });
    return q.ok && q.v !== e.v;
  });
}
const clean = ({ x, o, g }) => ({ x, o, g });
const mixPre = (base) => (p) => {
  if (!p) return base;
  const ks = uniq(evalX(p).st.map((s) => KIND[OPFAM[s.op]]({ a: s.a, b: s.b }))).sort().reverse();
  return uniq([...base, ...ks.slice(0, 2)]);
};

const MIXFAM = {
  id: 'g5_MIX', s: 'X', sec: 40,
  tip: '식 위에 계산 순서를 ①②③으로 먼저 적게 해요. 괄호가 있을 때와 없을 때를 나란히 계산해 결과가 달라지는 것을 보여 주면 순서가 왜 약속인지 납득해요.',
  make: (p) => { const v = evalX(p).v; return nums([`${exprText(p)} = `, B(0)], v, { bugs: mixBugs(p, v) }); },
  steps: (p) => evalX(p).st.map((s) => ({ c: OPFAM[s.op], p: { a: s.a, b: s.b }, why: mixWhy(s) })),
};

// ───────────── 5-1-3 대응 관계 (g5_CORR)
//   params { c: 상황 번호, k, s: 표 첫 수, v: 'val'(표 → 값) | 'eq'(식의 빈칸) | 'pick'(식 고르기), dir: 'fwd'|'back', q: 묻는 수, ord }
//   상황: [△ 쪽 이름, 단위, ○ 쪽 이름, 단위, 연산, k 범위, 표 첫 수 범위]
const CORR = [
  ['동생 나이', '살', '내 나이', '살', '+', [2, 5], [6, 9]],
  ['끈을 자른 횟수', '번', '끈 도막 수', '도막', '+', [1, 1], [1, 1]],
  ['1층에서 올라간 층 수', '층', '도착한 층', '층', '+', [1, 1], [1, 3]],
  ['내 나이', '살', '동생 나이', '살', '−', [2, 5], [9, 12]],
  ['자동차 수', '', '바퀴 수', '개', '×', [4, 4], [1, 1]],
  ['세발자전거 수', '', '바퀴 수', '개', '×', [3, 3], [1, 1]],
  ['상자 수', '', '사과 수', '개', '×', [6, 12], [1, 1]],
  ['과자 수', '', '봉지 수', '봉지', '÷', [5, 8], [1, 1]],
];
// 낱말 뒤 조사 (마지막 글자 받침으로)
const kj = (w, withB, noB) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return `${w}${c >= 0 && c < 11172 && c % 28 ? withB : noB}`; };
const corrY = (op, k, x) => ({ '+': x + k, '−': x - k, '×': x * k, '÷': x / k }[op]);
function corrTable(p) {
  const C = CORR[p.c], op = C[4];
  const xs = [0, 1, 2, 3].map((i) => (op === '÷' ? (p.s + i) * p.k : p.s + i)), ys = xs.map((x) => corrY(op, p.k, x));
  return { C, op, xs, ys, tok: [`${C[0]}: ${xs.join(', ')}`, { br: 1 }, `${C[2]}: ${ys.join(', ')}`, { br: 1 }] };
}
const CORRFAM = {
  id: 'g5_CORR', s: 'R', sec: 20,
  tip: '표를 위아래 짝으로 읽게 해요. "동생 나이에 3을 더하면 내 나이"처럼 말로 먼저 말한 뒤 △, ○를 넣은 식으로 옮겨요.',
  make: (p) => {
    const { C, op, xs, ys, tok } = corrTable(p);
    if (p.v === 'val') {
      const y = corrY(op, p.k, p.q);
      // 합·차 관계에서 방향을 바꾸는 잘못은 이 차시(위아래 짝 읽기) 자체의 잘못 — 곱 관계 차시(5-1-3:2)로 보내지 않는다
      if (p.dir === 'fwd') {
        const next = corrY(op, p.k, xs[3] + 1), flip = corrY(op === '+' ? '−' : '+', p.k, p.q);
        return nums([...tok, `${kj(C[0], '이', '가')} ${p.q}${C[1]}일 때 ${kj(C[2], '은', '는')} `, B(0), `${kj(C[3], '이에요', '예요')}.`], y, {
          bugs: [{ test: (v) => v[0] === next, name: '표의 다음 칸만 구함', to: null },
            { test: (v) => v[0] === flip, name: '더하고 빼는 방향을 바꿈', to: null }],
        });
      }
      return nums([...tok, `${kj(C[2], '이', '가')} ${y}${C[3]}일 때 ${kj(C[0], '은', '는')} `, B(0), `${kj(C[1], '이에요', '예요')}.`], p.q, {
        bugs: [{ test: (v) => v[0] === corrY(op, p.k, y), name: '거꾸로 구하지 않고 같은 규칙을 그대로 씀', to: null }],
      });
    }
    const head = [...tok, `${kj(C[0], '을', '를')} △, ${kj(C[2], '을', '를')} ○라고 할 때`];
    if (p.v === 'eq') {
      const bugs = [];
      if (op === '×' && ys[0] - xs[0] !== p.k) bugs.push({ test: (v) => v[0] === ys[0] - xs[0], name: '곱의 관계를 차이로 봄', to: '5-1-3:2' });
      return nums([...head, { br: 1 }, `○ = △ ${op} `, B(0)], p.k, { bugs });
    }
    // 식 고르기 — 맞는 식 하나 + 연산을 바꾼 식 + (곱·나눗셈) 두 양을 바꾼 식 / (덧셈·뺄셈) 차이를 잘못 읽은 식
    const mul = op === '×' || op === '÷', wrongOp = { '+': '−', '−': '+', '×': '+', '÷': '×' }[op];
    const ch = [`○ = △ ${op} ${p.k}`, `○ = △ ${wrongOp} ${p.k}`, mul ? `△ = ○ ${op} ${p.k}` : `○ = △ ${op} ${p.k + 1}`];
    const order = [[0, 1, 2], [1, 0, 2], [2, 0, 1], [1, 2, 0]][p.ord % 4];
    const name1 = op === '×' ? '곱의 관계를 덧셈 관계로 봄' : op === '÷' ? '곱하고 나누는 방향을 바꿈' : '더하고 빼는 방향을 바꿈';
    return pick([...head, ' 대응 관계를 바르게 나타낸 식을 고르세요.'], order.map((i) => [ch[i]]), order.indexOf(0), {
      bugs: { [order.indexOf(1)]: { name: name1, to: mul ? '5-1-3:2' : '5-1-3:3' },
        [order.indexOf(2)]: mul ? { name: '△와 ○의 자리를 바꿈', to: null } : { name: '표에서 두 양의 차이를 잘못 읽음', to: '5-1-3:3' } },
    });
  },
  steps: (p) => {
    const { C, op, xs, ys } = corrTable(p);
    const rule = op === '+' ? { c: 'SUB', p: { a: ys[0], b: xs[0] }, why: `${kj(C[2], '이', '가')} ${C[0]}보다 얼마나 큰지 표에서 구해요.` }
      : op === '−' ? { c: 'SUB', p: { a: xs[0], b: ys[0] }, why: `${kj(C[2], '이', '가')} ${C[0]}보다 얼마나 작은지 표에서 구해요.` }
        : op === '×' ? { c: 'DIV', p: { a: ys[2], b: xs[2] }, why: `${kj(C[2], '은', '는')} ${C[0]}의 몇 배인지 표에서 구해요.` }
          : { c: 'DIV', p: { a: xs[1], b: ys[1] }, why: `${kj(C[0], '은', '는')} ${C[2]}의 몇 배인지 표에서 구해요.` };
    if (p.v !== 'val') return [rule];
    const y = corrY(op, p.k, p.q);
    const use = p.dir === 'fwd'
      ? { c: op === '+' ? 'ADD' : 'SUB', p: { a: p.q, b: p.k }, why: `${C[0]} ${p.q}${C[1]}에 그 규칙을 써요.` }
      : { c: op === '+' ? 'SUB' : 'ADD', p: { a: y, b: p.k }, why: `${C[2]} ${y}${C[3]}에서 거꾸로 생각해요.` };
    return [rule, use];
  },
};
function genCorr(r, v) {
  const ops = v === 'val' ? ['+', '−'] : ['+', '−', '×', '÷'];
  const cs = CORR.map((_, i) => i).filter((i) => ops.includes(CORR[i][4]));
  const c = r.pick(cs), C = CORR[c], k = r.int(C[5][0], C[5][1]), s = r.int(C[6][0], C[6][1]);
  if (v === 'val') return { v, c, k, s, dir: r.chance(0.6) ? 'fwd' : 'back', q: s + r.int(6, 20) };
  return { v: r.chance(0.5) ? 'eq' : 'pick', c, k, s, ord: r.int(0, 3) };
}

// ───────────── 5-1-4:2 크기가 같은 분수를 그림으로 (g5_EQF)
//   params { v: 'pic'(두 막대) | 'pick'(크기가 같은 분수 고르기), n, d, k, dir: 'up'|'down', ord }
const EQFFAM = {
  id: 'g5_EQF', s: 'F', sec: 15,
  tip: '같은 길이의 종이띠를 2칸, 4칸, 8칸으로 접어 색칠한 길이를 맞대 봐요. 칸 수가 2배가 되면 색칠한 칸 수도 2배라는 것을 띠에서 세게 해요.',
  make: (p) => {
    const N = p.n * p.k, D = p.d * p.k;
    if (p.v === 'pic') {
      const head = [{ svg: p.dir === 'up' ? twoBars(p.d, p.n, D, N) : twoBars(D, N, p.d, p.n) }, '두 막대에서 색칠한 부분의 크기가 같아요.', { br: 1 }];
      return p.dir === 'up'
        ? nums([...head, fx(p.n, p.d), ' = ', { f: [B(0), D] }], N, { bugs: [{ test: (v) => v[0] === p.n + (D - p.d), name: '분모·분자에 같은 수를 더함', to: '2-1-6:4' }] })
        : nums([...head, fx(N, D), ' = ', { f: [B(0), p.d] }], p.n, { bugs: [{ test: (v) => v[0] === N - (D - p.d), name: '분모·분자에서 같은 수를 뺌', to: '2-1-6:4' }] });
    }
    const j = D - p.d, add = [p.n + j, p.d + j], only = [N, p.d];
    const ch = [[N, D], add, only];
    const order = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [1, 2, 0]][p.ord % 4];
    return pick([fx(p.n, p.d), `${P(p.n, '과', '와')} 크기가 같은 분수를 고르세요.`], order.map((i) => [fx(ch[i][0], ch[i][1])]), order.indexOf(0), {
      bugs: { [order.indexOf(1)]: { name: '분모·분자에 같은 수를 더함', to: '2-1-6:4' }, [order.indexOf(2)]: { name: '분자에만 곱함', to: null } },
    });
  },
  steps: (p) => {
    const N = p.n * p.k, D = p.d * p.k;
    if (p.v === 'pic' && p.dir === 'down') return [{ c: 'DIV', p: { a: D, b: p.d }, why: `분모 ${D}${P(D, '이', '가')} ${p.d}${P(p.d, '이', '가')} 되었어요. 몇으로 나눈 걸까요?` }, { c: 'DIV', p: { a: N, b: p.k }, why: '분자도 같은 수로 나눠요.' }];
    return [{ c: 'DIV', p: { a: D, b: p.d }, why: `분모 ${p.d}${P(p.d, '이', '가')} ${D}${P(D, '이', '가')} 되었어요. 몇 배일까요?` }, { c: 'MUL', p: { a: p.n, b: p.k }, why: '분자에도 같은 수를 곱해요.' }];
  },
};
function genEqf(r) {
  const d = r.int(2, 6), k = r.int(2, 4);
  return { v: r.chance(0.6) ? 'pic' : 'pick', n: cop(r, d), d, k, dir: r.chance(0.6) ? 'up' : 'down', ord: r.int(0, 3) };
}

// ───────────── 5-2-1 이상·이하·초과·미만 (g5_RANGE)
//   params { v: 'cnt'(목록에서 세기) | 'span'(두 끝 사이 자연수 개수) | 'edge'(가장 작은·큰 자연수) | 'line'(수직선 읽기), m, m2?, b, b2?, list? }
const RN = { ge: '이상', le: '이하', gt: '초과', lt: '미만' };
const open = (m) => m === 'gt' || m === 'lt';
const inR = (m, b, x) => (m === 'ge' ? x >= b : m === 'le' ? x <= b : m === 'gt' ? x > b : x < b);
function numLine(b, m) {
  const lo = b - 3, hi = b + 3, W = 320, X = (v) => Math.round((20 + ((v - lo) / (hi - lo)) * (W - 40)) * 10) / 10, y = 22, cx = X(b), r = 6;
  const right = m === 'ge' || m === 'gt', closed = !open(m);
  let s = `<line x1="8" y1="${y}" x2="${cx - r}" y2="${y}" stroke="currentColor" stroke-width="1.5"/><line x1="${cx + r}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="currentColor" stroke-width="1.5"/>`;
  for (let v = lo; v <= hi; v++) s += `${v === b ? '' : `<line x1="${X(v)}" y1="${y - 6}" x2="${X(v)}" y2="${y + 6}" stroke="currentColor"/>`}<text x="${X(v)}" y="${y + 26}" text-anchor="middle" font-size="14" fill="currentColor">${v}</text>`;
  s += `<line x1="${right ? cx + r : 8}" y1="${y}" x2="${right ? W - 8 : cx - r}" y2="${y}" stroke="currentColor" stroke-width="5"/>`;
  s += `<circle cx="${cx}" cy="${y}" r="${r}" fill="${closed ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"/>`;
  return `<svg viewBox="0 0 ${W} 56" width="${W}" height="56" role="img" aria-label="수직선">${s}</svg>`;
}
const RANGEFAM = {
  id: 'g5_RANGE', s: 'N', sec: 15,
  tip: '수직선에 ●(기준 수를 넣음)과 ○(기준 수를 빼고)를 직접 찍어 보게 해요. "이상·이하는 그 수도 들어가요"를 기준 수 하나로 확인해요.',
  make: (p) => {
    const toLe = open(p.m) || (p.m2 && open(p.m2)) ? '5-2-1:2' : null;
    if (p.v === 'cnt') {
      const ans = p.list.filter((x) => inR(p.m, p.b, x)).length;
      const flip = { ge: 'gt', gt: 'ge', le: 'lt', lt: 'le' }[p.m], other = p.list.filter((x) => inR(flip, p.b, x)).length;
      const opp = p.list.filter((x) => !inR(p.m, p.b, x)).length;
      const bugs = [];
      if (other !== ans) bugs.push({ test: (v) => v[0] === other, name: open(p.m) ? '기준 수도 넣음 (이상·이하와 헷갈림)' : '기준 수를 빼고 셈 (초과·미만과 헷갈림)', to: toLe });
      if (opp !== ans && opp !== other) bugs.push({ test: (v) => v[0] === opp, name: '반대쪽 수를 셈', to: null });
      return nums([p.list.join(',  '), { br: 1 }, `위의 수 중에서 ${p.b} ${RN[p.m]}인 수는 모두 `, B(0), '개예요.'], ans, { bugs });
    }
    if (p.v === 'span') {
      let lo = p.b + (open(p.m) ? 1 : 0), hi = p.b2 - (open(p.m2) ? 1 : 0);
      const ans = hi - lo + 1, all = p.b2 - p.b + 1, none = p.b2 - p.b - 1, one = p.b2 - p.b;
      const bugs = [];
      if (all !== ans) bugs.push({ test: (v) => v[0] === all, name: '두 끝 수를 모두 넣음 (이상·이하와 헷갈림)', to: toLe });
      if (none !== ans) bugs.push({ test: (v) => v[0] === none, name: '두 끝 수를 모두 뺌', to: null });
      if (one !== ans) bugs.push({ test: (v) => v[0] === one, name: '끝 수 하나를 잘못 셈', to: null });
      return nums([`${p.b} ${RN[p.m]} ${p.b2} ${RN[p.m2]}인 자연수는 모두 `, B(0), '개예요.'], ans, { bugs });
    }
    if (p.v === 'edge') {
      const up = p.m === 'ge' || p.m === 'gt', ans = p.m === 'gt' ? p.b + 1 : p.m === 'lt' ? p.b - 1 : p.b;
      const wrong = open(p.m) ? p.b : up ? p.b + 1 : p.b - 1;
      return nums([`${p.b} ${RN[p.m]}인 자연수 중에서 가장 ${up ? '작은' : '큰'} 수는 `, B(0)], ans, {
        bugs: [{ test: (v) => v[0] === wrong, name: open(p.m) ? '기준 수를 넣음 (이상·이하와 헷갈림)' : '기준 수를 빼고 봄', to: toLe }],
      });
    }
    const ms = ['ge', 'le', 'gt', 'lt'], right = ms.indexOf(p.m);
    const twin = { ge: 'gt', gt: 'ge', le: 'lt', lt: 'le' }[p.m], mirror = { ge: 'le', le: 'ge', gt: 'lt', lt: 'gt' }[p.m];
    return pick([{ svg: numLine(p.b, p.m) }, '수직선에 나타낸 수의 범위를 고르세요.'], ms.map((m) => [`${p.b} ${RN[m]}`]), right, {
      bugs: { [ms.indexOf(twin)]: { name: '●(점)과 ○(빈 점)을 헷갈림', to: toLe }, [ms.indexOf(mirror)]: { name: '수직선의 방향을 헷갈림', to: null } },
    });
  },
};
function genRange(r, opened) {
  const one = opened ? r.pick(['gt', 'lt']) : r.pick(['ge', 'le']), b = r.int(12, 95);
  const v = r.pick(['cnt', 'cnt', 'span', 'span', 'edge', 'line']);
  if (v === 'cnt') {
    const pool = []; for (let x = b - 4; x <= b + 4; x++) if (x !== b) pool.push(x);
    const list = r.shuffle([b, ...r.shuffle(pool).slice(0, 5)]);
    return { v, m: one, b, list };
  }
  if (v === 'span') {
    const b2 = b + r.int(4, 12);
    const [m, m2] = opened ? r.pick([['gt', 'lt'], ['gt', 'lt'], ['gt', 'lt'], ['ge', 'lt'], ['gt', 'le']]) : ['ge', 'le'];
    return { v, m, m2, b, b2 };
  }
  return { v, m: one, b };
}
const isOpenRange = (p) => open(p.m) || (!!p.m2 && open(p.m2));

// ───────────── 5-2-1 올림·버림·반올림 (g5_ROUND)
//   params { m: 'up'|'down'|'half', v: 'val'(어림한 수) | 'which'(어림하면 T가 되는 수 고르기), xi(정수로 쓴 수), dp(소수 자리 수), pk(어느 자리까지: 2 = 백의 자리, −1 = 소수 첫째 자리), ch?, T? }
const PLACE = { 4: '만의 자리', 3: '천의 자리', 2: '백의 자리', 1: '십의 자리', 0: '일의 자리', '-1': '소수 첫째 자리', '-2': '소수 둘째 자리' };
const MNAME = { up: '올림', down: '버림', half: '반올림' };
const roundI = (m, xi, u) => (m === 'up' ? Math.ceil(xi / u) * u : m === 'down' ? Math.floor(xi / u) * u : Math.floor((xi + u / 2) / u) * u);
const dshow = (xi, dp) => fmt(xi / 10 ** dp);
const placeLesson = (p) => (p.dp ? '4-2-3:2' : p.xi >= 10000 ? '4-1-1:3' : '2-2-1:5');
const ROUNDFAM = {
  id: 'g5_ROUND', s: 'N', sec: 15,
  tip: '구하려는 자리 아래를 손가락으로 가리고 "가린 부분이 0이 아니면 올림, 무조건 0으로 버림, 바로 아래 숫자가 5 이상이면 올림"을 말로 정리해요. 반올림은 바로 아래 한 자리만 본다는 것을 3449 같은 수로 확인해요.',
  make: (p) => {
    const u = 10 ** (p.pk + p.dp), val = (xi) => Number((xi / 10 ** p.dp).toFixed(p.dp));
    const how = `${MNAME[p.m]}하여 ${PLACE[p.pk]}까지 나타내면`;
    if (p.v === 'which') {
      const right = p.ch.findIndex((x) => roundI(p.m, x, u) === p.T), h = u / 2, bugs = {};
      p.ch.forEach((x, i) => {
        if (i === right) return;
        if (p.m === 'up' && x === p.T - u) bugs[i] = { name: '아래 자리가 모두 0인 수도 올림한다고 봄', to: null };
        if (p.m === 'down' && x === p.T + u) bugs[i] = { name: '아래 자리가 모두 0인 수도 버림한다고 봄', to: null };
        if (p.m === 'half' && x === p.T + h) bugs[i] = { name: '바로 아래 숫자가 5일 때 버림', to: null };
        if (p.m === 'half' && u >= 100 && roundI('half', roundI('half', x, u / 10), u) === p.T) bugs[i] = { name: '끝자리부터 차례로 반올림함', to: null };
      });
      return pick([`${how} ${jx(p.T, '이', '가')} 되는 수를 고르세요.`], p.ch.map((x) => [String(x)]), right, { bugs });
    }
    const xs = dshow(p.xi, p.dp), ans = roundI(p.m, p.xi, u), bugs = [], seen = new Set([ans]);
    const add = (xi, name, to) => { if (seen.has(xi) || xi <= 0) return; seen.add(xi); const w = val(xi); bugs.push({ test: (v) => near(v[0], w), name, to }); };
    if (p.m === 'half') add(roundI('half', roundI('half', p.xi, u / 10), u), '끝자리부터 차례로 반올림함', null);
    if (p.m !== 'up') add(roundI('up', p.xi, u), p.m === 'half' ? '바로 아래 숫자가 5보다 작은데 올림' : '올림을 함', null);
    if (p.m !== 'down') add(roundI('down', p.xi, u), p.m === 'half' ? '바로 아래 숫자가 5 이상인데 버림' : '버림을 함', null);
    if (p.m !== 'half') add(roundI('half', p.xi, u), '반올림을 함', null);
    if (p.m === 'up') add(p.xi % u === 0 ? p.xi + u : Math.floor(p.xi / u) * u + u + (p.xi % u), p.xi % u === 0 ? '아래 자리가 모두 0인데도 올림' : '아래 자리를 0으로 바꾸지 않음', null);
    if (p.m === 'down') add(p.xi % u ? p.xi : p.xi - u, p.xi % u ? '아래 자리를 0으로 바꾸지 않음' : '아래 자리가 모두 0인데도 내림', null);
    [u * 10, u / 10].forEach((w) => { if (w >= 1) add(roundI(p.m, p.xi, w), '어느 자리까지인지 잘못 봄', placeLesson(p)); });
    const it = nums([`${jx(xs, '을', '를')} ${how} `, B(0)], val(ans), { noFrac: true, bugs });
    // 소수 □째 자리까지 나타낸 답은 끝자리 0도 보여 준다 (5.703 → 5.70 · 9.98 → 10.0) — 채점은 5.7도 정답
    if (p.pk < 0) it.ans = toText(it.prompt, [(ans / 10 ** p.dp).toFixed(-p.pk)]);
    return it;
  },
};
function genRound(r, m) {
  return until(r, (r) => {
    const dec = r.chance(0.3);
    if (dec) {
      const dp = r.int(2, 3), xi = r.int(10 ** dp / 10 + 1, 10 ** (dp + 1) - 1), pk = -r.int(0, dp - 1);
      return { m, v: 'val', xi, dp, pk };
    }
    const D = r.int(3, 5), xi = r.int(10 ** (D - 1) + 1, 10 ** D - 1), pk = r.int(1, D - 1);
    const zero = m !== 'half' && r.chance(0.1);
    const u = 10 ** pk;
    if (!zero && r.chance(0.3)) {
      // 어림하면 T가 되는 수 고르기 — 맞는 것 하나 + 함정 셋
      const T = roundI(m, xi, u);
      if (T < 10 ** (D - 1) || T >= 10 ** D) return null;
      const h = u / 2, rd = () => r.int(1, Math.max(1, h - 1));
      const traps = m === 'up' ? [T - u, T + rd(), T - u - rd()] : m === 'down' ? [T + u, T - rd(), T + u + rd()] : [T - h - rd(), T + h, T - u + rd()];
      const right = m === 'up' ? T - r.int(1, u - 1) : m === 'down' ? T + r.int(1, u - 1) : r.chance(0.5) ? T - r.int(1, h) : T + r.int(1, h - 1);
      if (m === 'half' && u >= 100) traps[0] = T - h - r.int(1, u / 20);
      return { m, v: 'which', xi, dp: 0, pk, T, ch: r.shuffle([right, ...traps]) };
    }
    return { m, v: 'val', xi: zero ? Math.floor(xi / u) * u : xi, dp: 0, pk };
  }, (p) => {
    if (!p) return false;
    const u = 10 ** (p.pk + p.dp);
    if (p.v === 'which') return new Set(p.ch).size === 4 && p.ch.every((x) => x > 0) && p.ch.filter((x) => roundI(p.m, x, u) === p.T).length === 1;
    if (p.dp && p.xi % 10 === 0) return false;
    if (roundI(p.m, p.xi, u) <= 0) return false;
    if (p.xi % u === 0) return p.m !== 'half' && p.dp === 0;
    return p.m !== 'half' || r.chance(0.5) || roundI('up', p.xi, u) !== roundI('half', p.xi, u);
  });
}

// ───────────── 5-1-5 분모가 다른 대분수의 덧셈·뺄셈 (g5_MIXADD · g5_MIXSUB)
//   params { w1, n1, d1, w2, n2, d2, L } — w n/d 대분수 둘 (분수 부분은 진분수, 분모가 다름)
const fpart = (p, op) => simp(op === '+' ? F(p.n1 * p.d2 + p.n2 * p.d1, p.d1 * p.d2) : F(p.n1 * p.d2 - p.n2 * p.d1, p.d1 * p.d2));
const MIXADDFAM = {
  id: 'g5_MIXADD', s: 'F', sec: 60,
  tip: '자연수는 자연수끼리, 분수는 통분해서 분수끼리 더해요. 분수 부분의 합이 1보다 크면 1을 자연수 부분으로 올려요. 가분수로 바꿔 더하는 방법과 결과를 비교해 보게 해요.',
  make: (p) => {
    const fs = fpart(p, '+'), tot = F((p.w1 + p.w2) * fs.d + fs.n, fs.d);
    return mixed([MX(p.w1, p.n1, p.d1), ' + ', MX(p.w2, p.n2, p.d2), ' = ', MX(B(0), B(1), B(2))], tot, {
      bugs: [
        { test: (v) => v[1] === p.n1 + p.n2 && v[2] === p.d1 + p.d2, name: '분자끼리, 분모끼리 더함', to: '5-1-5:2' },
        { test: (v) => fs.n >= fs.d && v[0] === p.w1 + p.w2 && v[2] > 0 && eqv(F(v[1], v[2]), fs), name: '분수 부분의 합이 1보다 큰데 자연수로 올리지 않음', to: '5-1-5:3' },
      ],
    });
  },
  steps: (p) => fmixSteps(p, '+'),
};
const MIXSUBFAM = {
  id: 'g5_MIXSUB', s: 'F', sec: 60,
  tip: '분수 부분끼리 뺄 수 없으면 자연수에서 1을 받아내려 (분모)/(분모)로 바꿔 분수 부분에 더해요. 통분을 먼저 해야 어느 쪽이 큰지 보인다는 것을 짚어 줘요.',
  make: (p) => {
    const fs = fpart(p, '-'), borrow = fs.n < 0;
    const res = simp(F((p.w1 - p.w2) * fs.d + fs.n, fs.d));
    const bugs = [{ test: (v) => v[1] === p.n1 - p.n2 && v[2] === Math.abs(p.d1 - p.d2), name: '분자끼리, 분모끼리 뺌', to: '5-1-5:5' }];
    if (borrow) {
      bugs.push({ test: (v) => v[0] === p.w1 - p.w2 && v[2] > 0 && eqv(F(v[1], v[2]), F(-fs.n, fs.d)), name: '분수 부분을 거꾸로 뺌 (큰 쪽에서 작은 쪽)', to: '4-2-1:7' },
        { test: (v) => v[0] === p.w1 - p.w2 && v[2] > 0 && eqv(F(v[1], v[2]), F(fs.n + fs.d, fs.d)), name: '받아내린 1을 자연수 부분에서 빼지 않음', to: '4-2-1:7' });
    }
    return mixed([MX(p.w1, p.n1, p.d1), ' − ', MX(p.w2, p.n2, p.d2), ' = ', MX(B(0), B(1), B(2))], res, { bugs });
  },
  steps: (p) => fmixSteps(p, '-'),
};
// 통분(5-1-4:5) → 분모가 같은 대분수의 덧셈·뺄셈(4-2-1:3 · :5 · :7)
function fmixSteps(p, op) {
  const L = p.L || lcm(p.d1, p.d2), N1 = (p.n1 * L) / p.d1, N2 = (p.n2 * L) / p.d2;
  const why = op === '+'
    ? `분모가 같은 대분수가 되었어요. 자연수끼리, 분수끼리 더해요.${N1 + N2 >= L ? ' 분수 부분의 합이 1보다 크면 1을 자연수 부분으로 올려요.' : ''}`
    : N1 < N2
      ? `분모가 같은 대분수가 되었어요. ${N1}/${L}에서 ${N2}/${L}${P(N2, '을', '를')} 뺄 수 없으니 자연수에서 1을 받아내려 빼요.`
      : '분모가 같은 대분수가 되었어요. 자연수끼리, 분수끼리 빼요.';
  return [
    { c: 'F9', p: { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2, L }, why: '분수 부분을 먼저 통분해요.' },
    { c: 'g4_FMIX', p: { op, w1: p.w1, n1: N1, w2: p.w2, n2: N2, d: L }, why },
  ];
}
function genMixPair(r, kind) {
  return until(r, (r) => {
    const q = pair(r), w1 = r.int(1, 5), w2 = r.int(1, 5);
    return { w1, n1: q.n1, d1: q.d1, w2, n2: q.n2, d2: q.d2, L: q.L };
  }, (p) => {
    const c = p.n1 * p.d2 - p.n2 * p.d1;
    if (kind === 'add') return p.n1 * p.d2 + p.n2 * p.d1 !== p.d1 * p.d2 && p.w1 <= 4 && p.w2 <= 4;
    if (kind === 'sub1') return c > 0 && p.w1 - p.w2 >= 1;
    return c < 0 && p.w1 - 1 - p.w2 >= 1;
  });
}

// ───────────── 5-2-4 소수의 곱셈 (g5_DMUL)
//   params { a, ad, b, bd } — 곱하는 두 수 = a ÷ 10^ad, b ÷ 10^bd (정수로 들고 다녀서 소수 끝자리 오류가 없다)
const dnum = (i, d) => fmt(i / 10 ** d);
const dval = (i, d) => Number((i / 10 ** d).toFixed(d));
const placeStep = (n, k) => {
  if (k === 1) return [{ c: 'DEC1', p: { v: 'count', n }, why: `0.1이 ${n}개이면 얼마인지 생각해요.` }];
  if (k === 2) return [{ c: 'DEC2', p: { v: 'count', n }, why: `0.01이 ${n}개이면 얼마인지 생각해요.` }];
  return [{ c: 'DEC2', p: { v: 'count', n }, why: `0.01이 ${n}개이면 얼마인지 생각해요.` }, { c: 'DEC4', p: { v: 'd10', k: n }, why: '그 수의 1/10이 곱이에요 (0.001이 몇 개인지).' }];
};
const DMULFAM = {
  id: 'g5_DMUL', s: 'DEC', sec: 25,
  tip: '소수를 0.1·0.01이 몇 개인지로 바꿔 자연수의 곱셈으로 계산하고, 곱하는 두 수의 소수점 아래 자리 수를 더한 만큼 곱의 소수점을 옮겨요. 어림(0.3 × 4는 1보다 조금 큼)으로 소수점 위치를 확인하게 해요.',
  make: (p) => {
    const pr = p.a * p.b, k = p.ad + p.bd, ans = dval(pr, k), A = dval(p.a, p.ad), Bv = dval(p.b, p.bd);
    const bugs = [], seen = new Set([ans]);
    const add = (w, name, to) => { if (seen.has(w)) return; seen.add(w); bugs.push({ test: (v) => near(v[0], w), name, to }); };
    add(pr, '소수점을 찍지 않음', '4-2-3:7');
    if (p.ad && p.bd) add(dval(pr, Math.max(p.ad, p.bd)), '소수점 아래 자리 수를 더하지 않음 (한 수의 자리 수만 셈)', '4-2-3:7');
    add(dval(pr, k + 1), '소수점 위치를 틀림', '4-2-3:7');
    if (k > 1) add(dval(pr, k - 1), '소수점 위치를 틀림', '4-2-3:7');
    add(Number((A + Bv).toFixed(Math.max(p.ad, p.bd))), '곱하지 않고 더함', null);
    return nums([`${dnum(p.a, p.ad)} × ${dnum(p.b, p.bd)} = `, B(0)], ans, { noFrac: true, bugs });
  },
  steps: (p) => {
    const pr = p.a * p.b, k = p.ad + p.bd;
    const unit = (i, d) => (d ? `${jx(dnum(i, d), '은', '는')} ${d === 1 ? '0.1' : '0.01'}이 ${i}개예요.` : '');
    const why = `${[unit(p.a, p.ad), unit(p.b, p.bd)].filter(Boolean).join(' ')} 소수점을 떼고 ${p.a} × ${p.b}부터 해요.`;
    return [{ c: 'MUL', p: { a: p.a, b: p.b }, why }, ...placeStep(pr, k)];
  },
};
// 소수 한 자리(끝자리가 0이 아님) · 소수 두 자리
const tenths = (r, lo, hi) => { let a; do { a = r.int(lo, hi); } while (a % 10 === 0); return a; };
const DMULSPEC = {
  '5-2-4:2': (r) => ({ a: tenths(r, 2, 59), ad: 1, b: r.chance(0.85) ? r.int(2, 9) : r.int(11, 15), bd: 0 }),
  '5-2-4:3': (r) => ({ a: r.chance(0.6) ? tenths(r, 11, 99) : tenths(r, 101, 399), ad: 2, b: r.int(2, 9), bd: 0 }),
  '5-2-4:4': (r) => ({ a: r.chance(0.7) ? r.int(2, 9) : r.int(11, 20), ad: 0, b: tenths(r, 2, 39), bd: 1 }),
  '5-2-4:5': (r) => ({ a: r.chance(0.8) ? r.int(2, 9) : r.int(11, 15), ad: 0, b: r.chance(0.6) ? tenths(r, 11, 99) : tenths(r, 101, 299), bd: 2 }),
  '5-2-4:6': (r) => (r.chance(0.4) ? { a: r.int(2, 9), ad: 1, b: r.int(2, 9), bd: 1 } : { a: tenths(r, 2, 39), ad: 1, b: tenths(r, 2, 29), bd: 1 }),
  '5-2-4:7': (r) => (r.chance(0.5) ? { a: tenths(r, 11, 299), ad: 2, b: tenths(r, 2, 29), bd: 1 } : { a: tenths(r, 2, 29), ad: 1, b: tenths(r, 11, 299), bd: 2 }),
};
const dmulKind = (p) => (p.ad === 1 && p.bd === 0 ? '5-2-4:2' : p.ad === 2 && p.bd === 0 ? '5-2-4:3' : p.ad === 0 && p.bd === 1 ? '5-2-4:4'
  : p.ad === 0 && p.bd === 2 ? '5-2-4:5' : p.ad === 1 && p.bd === 1 ? '5-2-4:6' : p.ad && p.bd && p.ad + p.bd === 3 ? '5-2-4:7' : null);

// ───────────── 5-2-4:8 곱의 소수점 위치 (g5_DPOINT)
//   params { v: 'pow', xi, xd, e } — (xi ÷ 10^xd) × 10^e   ·   { v: 'shift', a, b, ad, bd } — a × b를 알 때 (a ÷ 10^ad) × (b ÷ 10^bd)
const POW = { 1: '10', 2: '100', 3: '1000', '-1': '0.1', '-2': '0.01', '-3': '0.001' };
const shiftVal = (xi, xd, e) => (xd - e >= 0 ? dval(xi, xd - e) : xi * 10 ** (e - xd));
const DPOINTFAM = {
  id: 'g5_DPOINT', s: 'DEC', sec: 15,
  tip: '× 10, × 100은 숫자가 왼쪽으로 한 자리·두 자리, × 0.1, × 0.01은 오른쪽으로 옮겨 간다는 것을 자리판으로 보여 줘요. 자연수의 곱을 알 때는 두 수의 소수점 아래 자리 수를 더해 곱의 소수점을 찍어요.',
  make: (p) => {
    if (p.v === 'pow') {
      const ans = shiftVal(p.xi, p.xd, p.e), bugs = [], seen = new Set([ans]);
      const add = (w, name) => { if (seen.has(w) || !(w > 0)) return; seen.add(w); bugs.push({ test: (v) => near(v[0], w), name, to: '4-2-3:7' }); };
      add(shiftVal(p.xi, p.xd, -p.e), p.e < 0 ? '0.1, 0.01을 곱하면 커진다고 봄' : '10, 100을 곱하면 작아진다고 봄');
      add(shiftVal(p.xi, p.xd, p.e > 0 ? p.e - 1 : p.e + 1), '옮길 자리 수를 하나 적게 셈');
      add(shiftVal(p.xi, p.xd, p.e > 0 ? p.e + 1 : p.e - 1), '옮길 자리 수를 하나 많게 셈');
      return nums([`${dnum(p.xi, p.xd)} × ${POW[p.e]} = `, B(0)], ans, { noFrac: true, bugs });
    }
    const k = p.ad + p.bd, pr = p.a * p.b, ans = dval(pr, k), bugs = [];
    [k - 1, k + 1, Math.max(p.ad, p.bd)].forEach((j) => { const w = j >= 0 ? dval(pr, j) : null; if (w != null && w !== ans && !bugs.some((b) => b.w === w)) bugs.push({ w, test: (v) => near(v[0], w), name: '곱의 소수점 아래 자리 수를 잘못 셈', to: '4-2-3:7' }); });
    return nums([`${p.a} × ${p.b} = ${jx(pr, '이에요', '예요')}.`, { br: 1 }, `${dnum(p.a, p.ad)} × ${dnum(p.b, p.bd)} = `, B(0)], ans, { noFrac: true, bugs });
  },
  steps: (p) => {
    if (p.v === 'shift') {
      // 자연수의 곱은 주어졌으니, 소수점 아래 자리 수를 더해 0.1·0.01이 몇 개인 수인지로 소수점을 찍는다
      const k = p.ad + p.bd, st = placeStep(p.a * p.b, k);
      st[0] = { ...st[0], why: `두 수의 소수점 아래 자리 수를 더하면 ${p.ad} + ${p.bd} = ${k}개예요. ${st[0].why}` };
      return st;
    }
    if (p.xd > 2 || ![1, 2, -1].includes(p.e)) return [];
    const k = p.xi * 10 ** (2 - p.xd);
    return [{ c: 'DEC4', p: { v: { 1: 'x10', 2: 'x100', '-1': 'd10' }[p.e], k }, why: p.e > 0 ? `${POW[p.e]}을 곱하는 것은 ${POW[p.e]}배예요.` : '0.1을 곱하는 것은 1/10이에요.' }];
  },
};
function genDpoint(r) {
  // 교과서처럼: 소수 × 10·100·1000, 자연수 × 0.1·0.01·0.001 · 자연수의 곱을 이용해 소수의 곱 구하기
  if (r.chance(0.6)) {
    const e = r.pick([1, 2, 3, -1, -2, -3]);
    if (e > 0) { const xd = r.int(1, 3); return { v: 'pow', xi: tenths(r, 10 ** xd / 10 + 1, 10 ** xd * 10 - 1), xd, e }; }
    return { v: 'pow', xi: r.chance(0.5) ? r.int(2, 99) : r.int(101, 999), xd: 0, e };
  }
  const a = tenths(r, 12, 99), b = tenths(r, 12, 99);
  const [ad, bd] = r.pick([[1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1], [1, 2]]);
  return { v: 'shift', a, b, ad, bd };
}

// F12(분모가 다른 진분수의 덧셈·뺄셈)와 같은 채점·오답 모양 — 보여 주는 답만 기약분수로
const f12make = (p) => {
  const res = fpart(p, p.op);
  return frac([fx(p.n1, p.d1), p.op === '+' ? ' + ' : ' − ', fx(p.n2, p.d2), ' = ', fb(0, 1)], res, {
    bugs: [{ test: (v) => p.op === '+' && v[0] === p.n1 + p.n2 && v[1] === p.d1 + p.d2, name: '분자끼리, 분모끼리 더함', to: '4-2-1:2' },
      { test: (v) => p.op === '-' && v[0] === p.n1 - p.n2 && v[1] === Math.abs(p.d1 - p.d2), name: '분자끼리, 분모끼리 뺌', to: '4-2-1:4' }],
  });
};

// 개념 가족 문항의 오답 방향만 바꾼다 (채점은 그대로) — { 오답 이름: 새 방향 }
// 약수가 아닌 수 (2 ~ 절반 사이에서)
const g1Not = (p) => { const cand = []; for (let i = 2; i <= p.n / 2; i++) if (p.n % i) cand.push(i); return cand[p.s % cand.length]; };
const remapBugs = (it, map) => {
  const check = it.check;
  it.check = (v, r) => { const res = check.call(it, v, r); if (res && res.bug && res.bug.name in map) return { ...res, bug: { ...res.bug, to: map[res.bug.name] } }; return res; };
  return it;
};

// ───────────── 차시
const isFam = (_, ok) => (p) => !!p && ok(p);
const proper2 = (p) => !p.mix1 && !p.mix2 && p.n1 < p.d1 && p.n2 < p.d2;
const sum1 = (p) => p.n1 * p.d2 + p.n2 * p.d1 - p.d1 * p.d2; // 두 진분수의 합 − 1 의 부호
const G3c = CF.G3, G4c = CF.G4;
const isProperMul = (p) => p.a == null && !p.mix1 && !p.mix2 && p.n1 < p.d1 && p.n2 < p.d2; // 5-2-2:6 (진분수끼리) — 나머지 F15 모양은 5-2-2:8

export default {
  FAMS: [MIXFAM, CORRFAM, EQFFAM, MIXADDFAM, MIXSUBFAM, RANGEFAM, ROUNDFAM, DMULFAM, DPOINTFAM],
  LESSONS: [
    // ── 5-1-1 자연수의 혼합 계산
    {
      id: '5-1-1:2', fam: 'g5_MIX', name: '덧셈·뺄셈이 섞인 식', kid: '덧셈과 뺄셈이 섞인 식 계산하기', sec: 30,
      gen: (r) => clean(genMix(r, '5-1-1:2')), is: (p) => mixKind(p) === '5-1-1:2', prev: null, pre: mixPre(['2-1-3:8']),
      hint: '덧셈과 뺄셈만 있으면 앞에서부터 차례로 계산해요. ( )가 있으면 ( ) 안을 먼저 해요. 42 − (15 + 23) = 42 − 38 = 4.',
    },
    {
      id: '5-1-1:3', fam: 'g5_MIX', name: '곱셈·나눗셈이 섞인 식', kid: '곱셈과 나눗셈이 섞인 식 계산하기', sec: 30,
      gen: (r) => clean(genMix(r, '5-1-1:3')), is: (p) => mixKind(p) === '5-1-1:3', prev: '5-1-1:2', pre: mixPre([]),
      hint: '곱셈과 나눗셈만 있으면 앞에서부터 차례로 계산해요. 36 ÷ 4 × 3 = 9 × 3 = 27. ( )가 있으면 ( ) 안을 먼저 해요.',
    },
    {
      id: '5-1-1:4', fam: 'g5_MIX', name: '덧셈·뺄셈·곱셈이 섞인 식', kid: '덧셈, 뺄셈, 곱셈이 섞인 식 계산하기', sec: 45,
      gen: (r) => clean(genMix(r, '5-1-1:4')), is: (p) => mixKind(p) === '5-1-1:4', prev: '5-1-1:2', pre: mixPre([]),
      hint: '곱셈을 덧셈·뺄셈보다 먼저 계산해요. 25 − 3 × 4 + 6 = 25 − 12 + 6 = 19. ( )가 있으면 ( ) 안이 맨 먼저예요.',
      bridge: '앞에서부터 계산하던 습관을 깨고 곱셈을 먼저 하는 약속을 받아들이는 마디예요.',
    },
    {
      id: '5-1-1:5', fam: 'g5_MIX', name: '덧셈·뺄셈·나눗셈이 섞인 식', kid: '덧셈, 뺄셈, 나눗셈이 섞인 식 계산하기', sec: 45,
      gen: (r) => clean(genMix(r, '5-1-1:5')), is: (p) => mixKind(p) === '5-1-1:5', prev: '5-1-1:4', pre: mixPre([]),
      hint: '나눗셈을 덧셈·뺄셈보다 먼저 계산해요. 30 − 12 ÷ 4 = 30 − 3 = 27. ( )가 있으면 ( ) 안이 맨 먼저예요.',
    },
    {
      id: '5-1-1:6', fam: 'g5_MIX', name: '사칙 연산이 섞인 식', kid: '덧셈, 뺄셈, 곱셈, 나눗셈이 섞인 식 계산하기', sec: 60,
      gen: (r) => clean(genMix(r, '5-1-1:6')), is: (p) => mixKind(p) === '5-1-1:6', prev: '5-1-1:5', pre: mixPre(['5-1-1:3']),
      hint: '( ) 안 → 곱셈·나눗셈(앞에서부터) → 덧셈·뺄셈(앞에서부터) 순서예요. 20 + 12 ÷ 4 × 2 − 5 = 20 + 6 − 5 = 21.',
    },
    // ── 5-1-2 약수와 배수 (G1~G4)
    {
      id: '5-1-2:2', fam: 'G1', name: '약수', kid: '약수 찾기', sec: 25,
      gen: (r) => CF.G1.gen(r), is: (p) => p.v === 'count' || p.v === 'isnt', prev: null, pre: ['3-1-3:6', '3-2-2:6'],
      // '약수가 아닌 것' 보기는 그럴듯한 수(그 수의 절반 이하)로 — 45의 31처럼 한눈에 보이는 답을 내지 않는다
      make: (p) => {
        if (p.v !== 'isnt') return CF.G1.make(p);
        const yes = divisors(p.n).filter((x) => x > 1 && x < p.n), not = g1Not(p);
        const three = uniq([0, 1, 2].map((i) => yes[(p.s + i) % yes.length]));
        const ch = [...three, not].sort((a, b) => a - b), right = ch.indexOf(not), bugs = {};
        ch.forEach((x, i) => { if (i !== right) bugs[i] = { name: '약수인 수를 약수가 아니라고 봄 (나누어 보지 않음)', to: KIND.DIV({ a: p.n, b: x }) }; });
        return pick([`${p.n}의 약수가 아닌 것을 고르세요.`], ch.map((x) => [String(x)]), right, { bugs });
      },
      steps: (p) => {
        const ds = divisors(p.n).filter((x) => x > 1 && x < p.n);
        if (p.v === 'count') return ds.slice(0, 2).map((d) => ({ c: 'DIV', p: { a: p.n, b: d }, why: `${p.n} ÷ ${d}${P(d, '이', '가')} 나누어떨어지면 ${d}${P(d, '과', '와')} 그 몫이 모두 약수예요.` }));
        const not = g1Not(p);
        return [{ c: 'DIV', p: { a: p.n, b: not }, why: `${p.n} ÷ ${not}${P(not, '을', '를')} 해 봐요. 나머지가 있으면 약수가 아니에요.` }];
      },
      hint: '그 수를 나누어떨어지게 하는 수가 약수예요. 12 = 1 × 12 = 2 × 6 = 3 × 4니까 12의 약수는 1, 2, 3, 4, 6, 12예요.',
    },
    {
      id: '5-1-2:3', fam: 'G2', name: '배수', kid: '배수 찾기', sec: 15,
      gen: (r) => CF.G2.gen(r), is: (p) => p.v === 'seq' || p.v === 'is', prev: null, pre: (p) => ['2-1-6:4', p && p.n <= 9 ? danOf(p.n) : '2-2-2:4'],
      steps: (p) => {
        if (p.v === 'seq') return [{ c: 'MUL', p: { a: p.n, b: 3 }, why: `${p.n}의 3배를 구해요.` }, { c: 'MUL', p: { a: p.n, b: 4 }, why: `${p.n}의 4배를 구해요.` }];
        const right = p.n * (3 + (p.s % 6));
        return [{ c: 'DIV', p: { a: right, b: p.n }, why: `${right} ÷ ${p.n}${P(p.n, '이', '가')} 나누어떨어지면 ${right}${P(right, '은', '는')} ${p.n}의 배수예요.` }];
      },
      hint: '어떤 수를 1배, 2배, 3배… 한 수가 배수예요. 4의 배수는 4, 8, 12, 16…이에요.',
    },
    {
      id: '5-1-2:4', fam: 'G3', name: '공약수와 최대공약수', kid: '공약수, 최대공약수', sec: 25,
      gen: (r) => ({ ...G3c.gen(r), v: r.chance(0.7) ? 'gcd' : 'cnt' }), is: (p) => p.a != null && p.b != null, prev: '5-1-2:2', pre: ['3-1-3:6'],
      make: (p) => {
        // 최소공배수(뒤 차시)와 헷갈린 것은 약수·배수 뜻부터 — 약수 차시로
        if (p.v !== 'cnt') return remapBugs(G3c.make(p), { '최소공배수와 헷갈림': '5-1-2:2' });
        const g = gcd(p.a, p.b), n = divisors(g).length;
        return nums([`${p.a}${P(p.a, '과', '와')} ${p.b}의 공약수는 모두 `, B(0), '개예요.'], n, {
          bugs: [{ test: (v) => v[0] === n - 1, name: '공약수 1을 빠뜨림', to: '5-1-2:2' }, { test: (v) => v[0] === g, name: '최대공약수를 개수로 씀', to: null }],
        });
      },
      hint: '두 수의 약수를 나란히 쓰고 겹치는 수에 동그라미를 해요. 12와 18의 공약수는 1, 2, 3, 6이고 가장 큰 6이 최대공약수예요.',
    },
    {
      id: '5-1-2:6', fam: 'G4', name: '공배수와 최소공배수', kid: '공배수, 최소공배수', sec: 25,
      gen: (r) => ({ ...G4c.gen(r), v: r.chance(0.7) ? 'lcm' : 'cms' }), is: (p) => p.a != null && p.b != null, prev: '5-1-2:3', pre: [],
      make: (p) => {
        if (p.v !== 'cms') return G4c.make(p);
        const L = lcm(p.a, p.b), ab = p.a * p.b;
        return nums([`${p.a}${P(p.a, '과', '와')} ${p.b}의 공배수를 작은 수부터 3개 쓰면 `, B(0), ', ', B(1), ', ', B(2)], [L, 2 * L, 3 * L], {
          bugs: [{ test: (v) => ab !== L && v[0] === ab, name: '두 수를 곱한 수부터 셈', to: '5-1-2:3' }, { test: (v) => v[0] === L && v[1] === L + 1, name: '공배수를 1씩 늘림', to: '5-1-2:3' }],
        });
      },
      hint: '두 수의 배수를 나란히 쓰다가 처음 만나는 수가 최소공배수예요. 4와 6이면 12! 공배수는 12, 24, 36…처럼 최소공배수의 배수예요.',
    },
    // ── 5-1-3 대응 관계
    {
      id: '5-1-3:2', fam: 'R1', name: '두 양 사이의 관계 (곱)', kid: '표에서 두 양의 관계 찾기', sec: 20,
      gen: (r) => CF.R1.gen(r), is: (p) => p.op === '×', prev: null, pre: (p) => uniq(['4-1-6:2', p && p.k <= 9 ? danOf(p.k) : null]),
      // 개념 가족 R1 문항 그대로 + 조사(9면)와 끝맺음(□개예요.)만 다듬는다
      make: (p) => {
        const it = CF.R1.make(p), last = it.prompt.length - 1;
        it.prompt = it.prompt.map((t) => (typeof t === 'string' ? t.replace(`가 ${p.x}이면 `, `가 ${p.x}${P(p.x, '이면', '면')} `) : t));
        if (typeof it.prompt[last] === 'string') it.prompt[last] += '예요.';
        it.ans = toText(it.prompt, it.sol);
        return it;
      },
      steps: (p) => [{ c: 'MUL', p: { a: p.x, b: p.k }, why: `하나에 ${p.k}씩이니까 ${p.x} × ${p.k}${P(p.k, '을', '를')} 해요.` }],
      hint: '표를 위아래 짝으로 봐요. 탁자 1개에 의자 4개, 탁자 2개에 의자 8개면 의자 수는 탁자 수의 4배예요.',
    },
    {
      id: '5-1-3:3', fam: 'g5_CORR', name: '두 양 사이의 관계 (합·차)', kid: '표에서 두 양의 관계 찾기 (더하고 빼기)', sec: 20,
      gen: (r) => genCorr(r, 'val'), is: (p) => p.v === 'val', prev: '5-1-3:2', pre: ['4-1-6:2'],
      hint: '위아래 짝에서 늘 같은 것을 찾아요. 동생이 7살일 때 내가 10살이면 나는 늘 동생보다 3살 많아요.',
    },
    {
      id: '5-1-3:4', fam: 'g5_CORR', name: '대응 관계를 식으로', kid: '대응 관계를 △, ○를 써서 식으로', sec: 25,
      gen: (r) => genCorr(r, 'eq'), is: (p) => p.v === 'eq' || p.v === 'pick', prev: '5-1-3:3', pre: ['4-1-6:3', '4-1-6:8'],
      hint: '말로 먼저 해 봐요. "바퀴 수는 자동차 수의 4배"면 자동차 수를 △, 바퀴 수를 ○라고 할 때 ○ = △ × 4예요.',
    },
    // ── 5-1-4 약분과 통분
    {
      id: '5-1-4:2', fam: 'g5_EQF', name: '크기가 같은 분수 알기', kid: '그림으로 크기가 같은 분수 찾기', sec: 15,
      gen: (r) => genEqf(r), is: (p) => p.v === 'pic' || p.v === 'pick', prev: null, pre: ['3-1-6:4', '2-1-6:4'],
      hint: '색칠한 길이가 같으면 크기가 같은 분수예요. 1/2과 2/4는 막대에서 색칠한 길이가 같아요.',
    },
    {
      id: '5-1-4:3', fam: 'F7', name: '크기가 같은 분수 만들기', kid: '분모·분자에 같은 수를 곱하거나 나누기', sec: 12,
      gen: (r) => CF.F7.gen(r), is: (p) => p.v === 'up' || p.v === 'down', prev: '5-1-4:2', pre: (p) => [p ? danOf(p.k) : '2-2-2:2', '3-1-3:6'],
      steps: (p) => (p.v === 'up'
        ? [{ c: 'DIV', p: { a: p.d * p.k, b: p.d }, why: `분모 ${p.d}에 몇을 곱하면 ${p.d * p.k}${P(p.d * p.k, '이', '가')} 되나요?` }, { c: 'MUL', p: { a: p.n, b: p.k }, why: '분자에도 같은 수를 곱해요.' }]
        : [{ c: 'DIV', p: { a: p.d * p.k, b: p.d }, why: `${p.d * p.k}${P(p.d * p.k, '은', '는')} ${p.d}의 몇 배인가요?` }, { c: 'DIV', p: { a: p.n * p.k, b: p.k }, why: '분자도 같은 수로 나눠요.' }]),
      hint: '분모와 분자에 같은 수를 곱하거나, 같은 수로 나누면 크기가 같은 분수가 돼요. 2/3 = 4/6 = 8/12.',
    },
    {
      id: '5-1-4:4', fam: 'F8', name: '약분과 기약분수', kid: '분수를 간단하게 (약분)', sec: 20,
      gen: (r) => CF.F8.gen(r), is: (p) => p.k != null, prev: '5-1-4:3', pre: ['5-1-2:4'],
      hint: '분모와 분자를 두 수의 공약수로 나눠요. 최대공약수로 나누면 한 번에 기약분수가 돼요. 12/18 → 6으로 나누면 2/3.',
    },
    {
      id: '5-1-4:5', fam: 'F9', name: '통분', kid: '분모가 같은 분수로 나타내기', sec: 30,
      gen: (r) => { const q = pair(r); return { v: r.chance(0.7) ? 'given' : 'find', ...q }; }, is: (p) => p.v === 'given' || p.v === 'find', prev: '5-1-4:3', pre: ['5-1-2:6'],
      // '공통분모를 스스로 정하기'는 조사만 다듬는다 (1/6과 2/3를 통분하면) — 어떤 공통분모로 해도 정답
      make: (p) => {
        const it = CF.F9.make(p);
        if (p.v !== 'find') return it;
        it.prompt = [fx(p.n1, p.d1), `${P(p.n1, '과', '와')} `, fx(p.n2, p.d2), `${P(p.n2, '을', '를')} 통분하면 `, fb(0, 1), ', ', fb(2, 3)];
        it.ans = toText(it.prompt, it.sol);
        return it;
      },
      hint: '두 분모의 공배수(최소공배수가 편해요)를 공통분모로 정하고 분자에도 같은 수를 곱해요. 1/4과 1/6 → 3/12과 2/12.',
    },
    {
      id: '5-1-4:6', fam: 'F10', name: '분모가 다른 분수의 크기 비교', kid: '분모가 다른 분수 비교', sec: 25,
      gen: (r) => {
        const v = r.pick(['two', 'two', 'two', 'three', 'same']);
        if (v === 'three') return until(r, (r) => { const q = pair(r), d3 = r.int(2, 9); return { v, ...q, n3: cop(r, d3), d3 }; },
          (p) => p.d3 !== p.d1 && p.d3 !== p.d2 && lcm(lcm(p.d1, p.d2), p.d3) <= 72 && new Set([p.n1 / p.d1, p.n2 / p.d2, p.n3 / p.d3]).size === 3);
        if (v === 'same') { const d = r.int(2, 5), n = cop(r, d), k1 = r.int(2, 3), k2 = k1 + r.int(1, 2); return { v, n1: n * k1, d1: d * k1, n2: n * k2, d2: d * k2 }; }
        const q = CF.F10.gen(r); return { v, ...q, ord: r.int(0, 1) };
      },
      is: (p) => p.d1 != null, prev: '5-1-4:5', pre: ['3-2-4:7'],
      make: (p) => {
        const fs = [[p.n1, p.d1], [p.n2, p.d2]].concat(p.v === 'three' ? [[p.n3, p.d3]] : []);
        if (p.v === 'three') {
          const big = fs.reduce((b, f, i) => (f[0] * fs[b][1] > fs[b][0] * f[1] ? i : b), 0);
          const bugs = {}; fs.forEach((_, i) => { if (i !== big) bugs[i] = { name: '통분하지 않고 비교함', to: '5-1-4:5' }; });
          return pick(['가장 큰 수를 고르세요.'], fs.map((f) => [fx(f[0], f[1])]), big, { bugs });
        }
        const same = p.n1 * p.d2 === p.n2 * p.d1, big = same ? 2 : p.n1 * p.d2 > p.n2 * p.d1 ? 0 : 1;
        const bugs = same ? { 0: { name: '크기가 같은 분수를 알아보지 못함', to: '5-1-4:4' }, 1: { name: '크기가 같은 분수를 알아보지 못함', to: '5-1-4:4' } }
          : { [1 - big]: { name: '통분하지 않고 비교함', to: '5-1-4:5' }, 2: { name: '분모가 달라도 크기가 같다고 봄', to: '5-1-4:5' } };
        return pick(['더 큰 수를 고르세요.'], [[fx(p.n1, p.d1)], [fx(p.n2, p.d2)], ['두 수의 크기가 같아요']], big, { bugs });
      },
      steps: (p) => {
        const out = [{ c: 'F9', p: { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 }, why: '분모를 같게 하면 분자끼리 비교할 수 있어요.' }];
        if (p.v === 'three') {
          // 앞의 두 수 중 큰 수를 남은 수와 견준다
          const [wn, wd] = p.n1 * p.d2 > p.n2 * p.d1 ? [p.n1, p.d1] : [p.n2, p.d2];
          out.push({ c: 'F9', p: { v: 'given', n1: wn, d1: wd, n2: p.n3, d2: p.d3 }, why: `더 큰 ${wn}/${wd}${P(wn, '과', '와')} 남은 ${p.n3}/${p.d3}${P(p.n3, '을', '를')} 통분해서 비교해요.` });
        }
        if (p.v === 'same') out.unshift({ c: 'F8', p: { n: p.n1 / gcd(p.n1, p.d1), d: p.d1 / gcd(p.n1, p.d1), k: gcd(p.n1, p.d1) }, why: '약분해 보면 같은 분수인지 바로 보여요.' });
        return out;
      },
      hint: '통분해서 분모를 같게 하면 분자만 비교하면 돼요. 3/4과 5/6 → 9/12, 10/12 → 더 큰 수는 5/6!',
    },
    {
      id: '5-1-4:7', fam: 'F11', name: '분수와 소수의 크기 비교', kid: '분수를 소수로 바꿔 비교하기', sec: 20,
      gen: (r) => {
        // 분모가 10인 분수(3/10 = 0.3)는 3학년 소수 차시 그대로라 뺀다 — 분모를 10·100으로 바꾸는 단계가 있는 분수만
        let f; do { f = CF.F11.gen(r); } while (f.d === 10);
        const D = 10 % f.d === 0 ? 10 : 100, xi = (f.n * D) / f.d, u = r.next();
        if (u < 0.3) return f; // 분수 → 소수
        if (u < 0.5) return { v: 'toFrac', ...f, xi, D }; // 소수 → 분수 (0.25 = 25/100 = 1/4)
        if (r.chance(0.2)) return { v: 'cmp', ...f, yi: xi, D, ord: r.int(0, 1) };
        let yi; do { yi = xi + r.pick([-3, -2, -1, 1, 2, 3]) * (D === 10 ? 1 : r.pick([1, 5, 10])); } while (yi <= 0 || yi >= D);
        return { v: 'cmp', ...f, yi, D, ord: r.int(0, 1) };
      },
      is: (p) => p.d != null, prev: '5-1-4:3', pre: ['4-2-3:6', '4-2-3:2'],
      make: (p) => {
        if (p.v === 'toFrac') {
          const ds = fmt(p.xi / p.D), wrongPlace = p.D === 100 ? F(p.xi, 10) : F(p.xi, 100);
          return frac([`${jx(ds, '을', '를')} 분수로 나타내면 `, fb(0, 1)], F(p.n, p.d), {
            bugs: [
              { test: (v) => v[1] > 0 && eqv(F(v[0], v[1]), wrongPlace), name: p.D === 100 ? '0.01을 0.1로 봄 (분모를 10으로 씀)' : '0.1을 0.01로 봄 (분모를 100으로 씀)', to: p.D === 100 ? '4-2-3:2' : '3-1-6:8' },
              { test: (v) => v[0] > 0 && v[1] > 0 && eqv(F(v[0], v[1]), F(p.D, p.xi)), name: '분모와 분자를 바꿔 씀', to: null },
            ],
          });
        }
        if (p.v !== 'cmp') return CF.F11.make(p);
        const F0 = [fx(p.n, p.d)], D0 = [fmt(p.yi / p.D)], ch = p.ord ? [D0, F0, ['두 수의 크기가 같아요']] : [F0, D0, ['두 수의 크기가 같아요']];
        const diff = p.n * p.D - p.yi * p.d, fi = p.ord ? 1 : 0, right = diff === 0 ? 2 : diff > 0 ? fi : 1 - fi;
        const bugs = {}; [0, 1, 2].forEach((i) => { if (i !== right) bugs[i] = { name: diff === 0 ? '분수와 소수가 같은 크기인지 알아보지 못함' : '분수를 소수로 바꾸지 않고 비교함', to: '5-1-4:3' }; });
        return pick(['더 큰 수를 고르세요.'], ch, right, { bugs });
      },
      steps: (p) => {
        if (p.v !== 'toFrac') return CF.F11.steps({ n: p.n, d: p.d });
        const ds = fmt(p.xi / p.D), g = gcd(p.xi, p.D);
        return [
          { c: p.D === 10 ? 'DEC1' : 'DEC2', p: { v: 'units', n: p.xi }, why: `${jx(ds, '은', '는')} ${p.D === 10 ? '0.1' : '0.01'}이 몇 개인가요? 그 수가 분모 ${p.D}인 분수의 분자예요.` },
          g > 1 ? { c: 'F8', p: { n: p.xi / g, d: p.D / g, k: g }, why: `${p.xi}/${p.D}${P(p.xi, '을', '를')} 약분해서 간단하게 나타내요.` } : null,
        ].filter(Boolean);
      },
      hint: '분모를 10이나 100으로 바꾸면 소수로 쓸 수 있어요. 3/5 = 6/10 = 0.6이니까 3/5과 0.7 중에서 0.7이 더 커요.',
      tip: '분수 → 소수는 분모를 10·100으로 만드는 크기가 같은 분수를 거치고(3/5 = 6/10 = 0.6), 소수 → 분수는 0.1·0.01이 몇 개인지로 써서 약분해요(0.25 = 25/100 = 1/4). 두 방향을 다 해 본 뒤 한쪽으로 맞춰 비교하게 해요.',
    },
    // ── 5-1-5 분수의 덧셈과 뺄셈 (분모가 다른)
    {
      id: '5-1-5:2', fam: 'F12', name: '진분수의 덧셈 (합이 1보다 작음)', kid: '분모가 다른 진분수 더하기 (합 < 1)', sec: 45,
      gen: (r) => until(r, (r) => ({ ...pair(r), op: '+' }), (p) => sum1(p) < 0), is: isFam('F12', (p) => p.op === '+' && proper2(p) && sum1(p) < 0),
      prev: null, pre: ['5-1-4:5', '4-2-1:2'],
      make: f12make,
      hint: '먼저 통분해서 분모를 같게 하고, 분자끼리 더해요. 1/4 + 1/6 = 3/12 + 2/12 = 5/12.',
    },
    {
      id: '5-1-5:3', fam: 'F12', name: '진분수의 덧셈 (합이 1보다 큼)', kid: '분모가 다른 진분수 더하기 (합 > 1)', sec: 50,
      gen: (r) => until(r, (r) => ({ ...pair(r), op: '+' }), (p) => sum1(p) > 0), is: isFam('F12', (p) => p.op === '+' && proper2(p) && sum1(p) > 0),
      prev: '5-1-5:2', pre: ['3-2-4:6'],
      make: (p) => {
        const s = simp(F(p.n1 * p.d2 + p.n2 * p.d1, p.d1 * p.d2));
        return mixed([fx(p.n1, p.d1), ' + ', fx(p.n2, p.d2), ' = ', MX(B(0), B(1), B(2))], s, {
          bugs: [{ test: (v) => v[1] === p.n1 + p.n2 && v[2] === p.d1 + p.d2, name: '분자끼리, 분모끼리 더함', to: '4-2-1:2' },
            { test: (v) => (v[0] === 0 || Number.isNaN(v[0])) && v[2] > 0 && eqv(F(v[1], v[2]), s), name: '가분수를 대분수로 나타내지 않음', to: '3-2-4:6' }],
        });
      },
      steps: (p) => {
        const L = lcm(p.d1, p.d2), a = (p.n1 * L) / p.d1, b = (p.n2 * L) / p.d2;
        return [
          { c: 'F9', p: { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2, L }, why: '먼저 통분해요.' },
          { c: 'F6', p: { op: '+', a, b, d: L }, why: '분모가 같은 분수의 덧셈이 돼요. 1보다 크면 대분수로 바꿔요.' },
        ];
      },
      hint: '통분해서 더한 뒤, 분자가 분모보다 크면 대분수로 바꿔요. 3/4 + 5/6 = 9/12 + 10/12 = 19/12 = 1 7/12.',
    },
    {
      id: '5-1-5:4', fam: 'g5_MIXADD', name: '대분수의 덧셈 (분모가 다름)', kid: '분모가 다른 대분수 더하기', sec: 60,
      gen: (r) => genMixPair(r, 'add'), is: (p) => p.w1 != null, prev: '5-1-5:3', pre: ['4-2-1:3'],
      hint: '자연수는 자연수끼리, 분수는 통분해서 분수끼리 더해요. 1 1/2 + 2 2/3 = 3 + 7/6 = 4 1/6.',
    },
    {
      id: '5-1-5:5', fam: 'F12', name: '진분수의 뺄셈 (분모가 다름)', kid: '분모가 다른 진분수 빼기', sec: 45,
      gen: (r) => until(r, (r) => ({ ...pair(r), op: '-' }), (p) => p.n1 * p.d2 > p.n2 * p.d1), is: isFam('F12', (p) => p.op === '-' && proper2(p)),
      prev: null, pre: ['5-1-4:5', '4-2-1:4'],
      make: f12make,
      hint: '먼저 통분해서 분모를 같게 하고, 분자끼리 빼요. 5/6 − 1/4 = 10/12 − 3/12 = 7/12.',
      tip: '먼저 통분하고, 그다음은 4학년의 분모가 같은 분수의 뺄셈이에요. 1/2 − 1/3을 띠로 그려 "분자끼리, 분모끼리 빼서 0/1"이 왜 안 되는지 보여 줘요.',
    },
    {
      id: '5-1-5:6', fam: 'g5_MIXSUB', name: '대분수의 뺄셈 (받아내림 없음)', kid: '분모가 다른 대분수 빼기', sec: 60,
      gen: (r) => genMixPair(r, 'sub1'), is: (p) => p.n1 * p.d2 > p.n2 * p.d1, prev: '5-1-5:5', pre: ['4-2-1:5'],
      hint: '자연수는 자연수끼리, 분수는 통분해서 분수끼리 빼요. 3 3/4 − 1 1/6 = 2 + (9/12 − 2/12) = 2 7/12.',
    },
    {
      id: '5-1-5:7', fam: 'g5_MIXSUB', name: '대분수의 뺄셈 (받아내림)', kid: '분모가 다른 대분수 빼기 (받아내림)', sec: 70,
      gen: (r) => genMixPair(r, 'sub2'), is: (p) => p.n1 * p.d2 < p.n2 * p.d1, prev: '5-1-5:6', pre: ['4-2-1:7'],
      hint: '통분한 뒤 분수끼리 뺄 수 없으면 자연수에서 1을 받아내려요. 3 1/4 − 1 2/3 = 3 3/12 − 1 8/12 = 2 15/12 − 1 8/12 = 1 7/12.',
    },
    // ── 5-2-1 수의 범위와 어림하기
    {
      id: '5-2-1:2', fam: 'g5_RANGE', name: '이상과 이하', kid: '이상, 이하', sec: 15,
      gen: (r) => genRange(r, false), is: (p) => !isOpenRange(p), prev: null, pre: ['1-2-1:4', '1-2-1:5'],
      hint: '이상과 이하는 기준 수도 들어가요. 20 이상인 수는 20, 21, 22…이고 수직선에 ●로 나타내요.',
    },
    {
      id: '5-2-1:3', fam: 'g5_RANGE', name: '초과와 미만', kid: '초과, 미만', sec: 15,
      gen: (r) => genRange(r, true), is: isOpenRange, prev: '5-2-1:2', pre: ['1-2-1:4'],
      hint: '초과와 미만은 기준 수가 들어가지 않아요. 20 초과인 수는 21, 22…이고 수직선에 ○로 나타내요.',
    },
    {
      id: '5-2-1:5', fam: 'g5_ROUND', name: '올림', kid: '올림하기', sec: 15,
      gen: (r) => genRound(r, 'up'), is: (p) => p.m === 'up', prev: null, pre: (p) => [p ? placeLesson(p) : '2-2-1:5'],
      hint: '구하려는 자리 아래 수가 0이 아니면 그 자리 숫자를 1 크게 하고 아래는 0으로 써요. 3472를 올림하여 백의 자리까지 → 3500.',
    },
    {
      id: '5-2-1:6', fam: 'g5_ROUND', name: '버림', kid: '버림하기', sec: 15,
      gen: (r) => genRound(r, 'down'), is: (p) => p.m === 'down', prev: '5-2-1:5', pre: (p) => [p ? placeLesson(p) : '2-2-1:5'],
      hint: '구하려는 자리 아래 수를 모두 0으로 써요. 3472를 버림하여 백의 자리까지 → 3400.',
    },
    {
      id: '5-2-1:7', fam: 'g5_ROUND', name: '반올림', kid: '반올림하기', sec: 15,
      gen: (r) => genRound(r, 'half'), is: (p) => p.m === 'half', prev: '5-2-1:6', pre: (p) => uniq(['5-2-1:5', p ? placeLesson(p) : '2-2-1:5']),
      hint: '구하려는 자리 바로 아래 숫자 하나만 봐요. 0~4면 버리고 5~9면 올려요. 3472를 반올림하여 백의 자리까지 → 바로 아래 7 → 3500.',
    },
    // ── 5-2-2 분수의 곱셈
    {
      id: '5-2-2:2', fam: 'F13', name: '(진분수)×(자연수)', kid: '진분수 × 자연수', sec: 20,
      gen: (r) => { const d = r.int(3, 9); return { d, n: cop(r, d), k: r.int(2, 6) }; }, is: (p) => !p.mix && p.n < p.d, prev: null, pre: ['4-2-1:2', '3-2-4:3'],
      make: (p) => fracAns([fx(p.n, p.d), ` × ${p.k} = `], F(p.n * p.k, p.d), [{ test: (v) => v[0] === p.n * p.k && v[1] === p.d * p.k, name: '분모에도 곱함', to: '4-2-1:2' }]),
      // 1/몇이 몇 개인지로 — 분자가 1이면 '1개'를 세는 단계는 건너뛰고, 곱이 자연수면 1이 몇 개인지로 끝낸다
      steps: (p) => {
        const N = p.n * p.k;
        return [
          p.n > 1 ? { c: 'F3', p: { v: 'count', n: p.n, d: p.d }, why: `${p.n}/${p.d}${P(p.n, '은', '는')} 1/${p.d}이 몇 개인가요?` } : null,
          p.n > 1 ? { c: 'MUL', p: { a: p.n, b: p.k }, why: `1/${p.d}이 ${p.n}개씩 ${p.k}묶음이에요.` } : null,
          N % p.d
            ? { c: 'F3', p: { v: 'build', n: N, d: p.d }, why: `1/${p.d}이 ${N}개인 수를 분수로 써요.` }
            : { c: 'DIV', p: { a: N, b: p.d }, why: `1/${p.d}이 ${p.d}개면 1이에요. 1/${p.d}이 ${N}개는 1이 몇 개인지 나눗셈으로 구해요.` },
        ].filter(Boolean);
      },
      hint: '2/5 × 3은 2/5를 3번 더한 것이에요. 분모는 그대로, 분자에 3을 곱해요: 6/5 = 1 1/5.',
    },
    {
      id: '5-2-2:3', fam: 'F13', name: '(대분수)×(자연수)', kid: '대분수 × 자연수', sec: 35,
      gen: (r) => { const d = r.int(2, 9), w = r.int(1, 3), n = cop(r, d); return { d, n: w * d + n, k: r.int(2, 5), mix: true }; }, is: (p) => !!p.mix && p.n > p.d,
      prev: '5-2-2:2', pre: ['3-2-4:6'],
      make: (p) => {
        const w = Math.floor(p.n / p.d), rr = p.n % p.d;
        return mixAns([MX(w, rr, p.d), ` × ${p.k} = `], F(p.n * p.k, p.d), [
          { test: (v) => v[0] === w * p.k && v[2] > 0 && eqv(F(v[1], v[2]), F(rr, p.d)), name: '자연수 부분에만 곱함', to: '3-2-4:6' },
        ]);
      },
      steps: (p) => [
        { c: 'MUL', p: { a: Math.floor(p.n / p.d), b: p.k }, why: `자연수 부분에 ${p.k}${P(p.k, '을', '를')} 곱해요.` },
        { c: 'F13', p: { d: p.d, n: p.n % p.d, k: p.k }, why: `분수 부분에도 ${p.k}${P(p.k, '을', '를')} 곱해요. 두 결과를 더하면 돼요.` },
      ].filter((x) => !(x.c === 'MUL' && x.p.a === 1)),
      hint: '대분수를 가분수로 바꿔 곱하거나, 자연수 부분과 분수 부분에 따로 곱해 더해요. 1 2/3 × 2 = 2 + 4/3 = 3 1/3.',
      tip: '두 방법을 나란히 써요: ① 가분수로 바꿔 곱하기(1 2/3 × 2 = 5/3 × 2 = 10/3) ② 자연수 부분과 분수 부분에 각각 곱해 더하기(1 × 2 + 2/3 × 2). 자연수 부분에만 곱하는 실수를 띠 그림으로 짚어 줘요.',
    },
    {
      id: '5-2-2:4', fam: 'F14', name: '(자연수)×(진분수)', kid: '자연수 × 진분수', sec: 20,
      gen: (r) => { const d = r.int(2, 9), n = cop(r, d); if (r.chance(0.7)) return { d, n, N: d * r.int(2, 6) }; let N; do { N = r.int(2, 12); } while (N % d === 0); return { d, n, N }; },
      is: (p) => !p.mix && p.n < p.d, prev: null, pre: ['3-2-4:3', '3-2-4:4'],
      make: (p) => (p.N % p.d === 0 ? CF.F14.make(p)
        : fracAns([`${p.N} × `, fx(p.n, p.d), ' = '], F(p.N * p.n, p.d), [{ test: (v) => v[0] === p.N * p.n && v[1] === p.d * p.N, name: '분모에도 곱함', to: '3-2-4:3' }])),
      steps: (p) => (p.N % p.d === 0 ? [{ c: 'F4', p: { N: p.N, n: p.n, d: p.d }, why: `${p.N} × ${p.n}/${p.d}${P(p.n, '은', '는')} ${p.N}의 ${p.n}/${p.d}${P(p.n, '이라는', '라는')} 뜻이에요.` }] : [
        p.n > 1 ? { c: 'F3', p: { v: 'count', n: p.n, d: p.d }, why: `${p.n}/${p.d}${P(p.n, '은', '는')} 1/${p.d}이 몇 개인가요?` } : null,
        p.n > 1 ? { c: 'MUL', p: { a: p.n, b: p.N }, why: `그것이 ${p.N}묶음이에요.` } : null,
        { c: 'F3', p: { v: 'build', n: p.N * p.n, d: p.d }, why: `1/${p.d}이 ${p.N * p.n}개를 분수로 써요.` },
      ].filter(Boolean)),
      hint: '12 × 2/3는 "12의 2/3"라는 뜻이에요. 12를 3묶음으로 나눈 것 중 2묶음 → 12 ÷ 3 × 2 = 8.',
      tip: '12 × 2/3는 "12의 2/3"라는 뜻이에요. 3학년의 "분수만큼은 얼마"와 같은 계산이에요(12 ÷ 3 × 2). 곱이 자연수가 아니면(8 × 1/6) 1/6이 8개인 수로 생각하게 해요.',
    },
    {
      id: '5-2-2:5', fam: 'F14', name: '(자연수)×(대분수)', kid: '자연수 × 대분수', sec: 35,
      gen: (r) => { const d = r.int(2, 9), w = r.int(1, 3), n = cop(r, d); return { d, n: w * d + n, N: r.int(2, 9), mix: true }; }, is: (p) => !!p.mix && p.n > p.d,
      prev: '5-2-2:4', pre: ['3-2-4:6'],
      make: (p) => {
        const w = Math.floor(p.n / p.d), rr = p.n % p.d;
        return mixAns([`${p.N} × `, MX(w, rr, p.d), ' = '], F(p.N * p.n, p.d), [
          { test: (v) => v[0] === p.N * w && v[2] > 0 && eqv(F(v[1], v[2]), F(rr, p.d)), name: '자연수 부분에만 곱함', to: '3-2-4:6' },
        ]);
      },
      steps: (p) => [
        { c: 'MUL', p: { a: p.N, b: Math.floor(p.n / p.d) }, why: '대분수의 자연수 부분을 곱해요.' },
        { c: 'F14', p: { N: p.N, n: p.n % p.d, d: p.d }, why: '분수 부분도 곱해요. 두 결과를 더하면 돼요.' },
      ].filter((x) => !(x.c === 'MUL' && x.p.b === 1)),
      hint: '대분수를 가분수로 바꿔 곱하면 편해요. 3 × 1 2/5 = 3 × 7/5 = 21/5 = 4 1/5.',
      tip: '자연수 × 대분수는 대분수를 가분수로 바꿔 곱하거나(3 × 7/5), 자연수 부분과 분수 부분에 각각 곱해 더해요(3 × 1 + 3 × 2/5). 자연수 부분에만 곱하고 분수 부분을 그대로 두는 실수가 많아요.',
    },
    {
      id: '5-2-2:6', fam: 'F15', name: '진분수의 곱셈', kid: '진분수 × 진분수', sec: 20,
      gen: (r) => (r.chance(0.35) ? { a: r.int(2, 9), b: r.int(2, 9) } : (() => { const d1 = r.int(2, 9), d2 = r.int(2, 9); return { n1: cop(r, d1), d1, n2: cop(r, d2), d2 }; })()),
      is: (p) => (p.a != null ? p.n1 == null : isProperMul(p)), prev: '5-2-2:4', pre: (p) => ['3-1-6:5', danOf(p ? (p.a != null ? p.a : p.d1) : 2)],
      make: (p) => (p.a != null ? CF.F15a.make(p) : CF.F15.make(p)),
      steps: (p) => (p.a != null
        ? [{ c: 'MUL', p: { a: p.a, b: p.b }, why: `1/${p.a}을 다시 ${p.b}조각으로 나눈 하나예요. 분모끼리 곱해요.` }]
        : [{ c: 'MUL', p: { a: p.n1, b: p.n2 }, why: '분자끼리 곱해요.' }, { c: 'MUL', p: { a: p.d1, b: p.d2 }, why: '분모끼리 곱해요.' }].filter((s) => s.p.a > 1 && s.p.b > 1)),
      hint: '분자는 분자끼리, 분모는 분모끼리 곱해요. 2/3 × 4/5 = 8/15. 1/3 × 1/4 = 1/12처럼 진분수끼리 곱하면 더 작아져요.',
    },
    {
      id: '5-2-2:8', fam: 'F15', name: '(대분수)×(대분수)', kid: '대분수 × 대분수', sec: 45,
      gen: (r) => { const d1 = r.int(2, 6), d2 = r.int(2, 6), w1 = r.int(1, 3), w2 = r.int(1, 2); return { n1: w1 * d1 + cop(r, d1), d1, n2: w2 * d2 + cop(r, d2), d2, mix1: true, mix2: true }; },
      is: (p) => p.a == null && !isProperMul(p), prev: '5-2-2:6', pre: ['3-2-4:6', '5-2-2:3'],
      make: (p) => {
        // 다른 차시의 단계에서 가분수·자연수가 섞여 오면(6학년 나눗셈을 곱셈으로) 개념 가족 F15 모양 그대로
        if (!(p.mix1 && p.mix2)) return CF.F15.make(p);
        const w1 = Math.floor(p.n1 / p.d1), r1 = p.n1 % p.d1, w2 = Math.floor(p.n2 / p.d2), r2 = p.n2 % p.d2;
        return mixAns([MX(w1, r1, p.d1), ' × ', MX(w2, r2, p.d2), ' = '], F(p.n1 * p.n2, p.d1 * p.d2), [
          { test: (v) => v[0] === w1 * w2 && v[2] > 0 && eqv(F(v[1], v[2]), F(r1 * r2, p.d1 * p.d2)), name: '자연수끼리, 분수끼리 곱함', to: '3-2-4:6' },
        ]);
      },
      steps: (p) => [
        p.mix1 && p.n1 % p.d1 ? { c: 'F5', p: { v: 'toImp', w: Math.floor(p.n1 / p.d1), n: p.n1 % p.d1, d: p.d1 }, why: '앞의 대분수를 가분수로 바꿔요.' } : null,
        p.mix2 && p.n2 % p.d2 ? { c: 'F5', p: { v: 'toImp', w: Math.floor(p.n2 / p.d2), n: p.n2 % p.d2, d: p.d2 }, why: '뒤의 대분수도 가분수로 바꿔요.' } : null,
        { c: 'MUL', p: { a: p.n1, b: p.n2 }, why: '분자끼리 곱해요.' },
        { c: 'MUL', p: { a: p.d1, b: p.d2 }, why: '분모끼리 곱해요.' },
      ].filter((x) => x && !(x.c === 'MUL' && (x.p.a === 1 || x.p.b === 1))),
      hint: '두 대분수를 가분수로 바꾼 뒤 분자끼리, 분모끼리 곱해요. 1 1/2 × 2 2/3 = 3/2 × 8/3 = 24/6 = 4.',
      tip: '두 대분수를 가분수로 바꾼 뒤 분자끼리, 분모끼리 곱해요. 자연수끼리·분수끼리 곱하는 실수(1 1/2 × 2 1/3 → 2 1/6, 바른 답은 3 1/2)를 넓이 그림으로 보여 줘요.',
    },
    // ── 5-2-4 소수의 곱셈
    ...['2', '3', '4', '5', '6', '7'].map((n) => {
      const id = `5-2-4:${n}`;
      const M = {
        2: ['(소수 한 자리)×(자연수)', '소수 × 자연수 (소수 한 자리)', 20, null, ['4-2-3:7'], '0.3 × 4는 0.1이 3 × 4 = 12개예요. 그래서 1.2!'],
        3: ['(소수 두 자리)×(자연수)', '소수 × 자연수 (소수 두 자리)', 25, '5-2-4:2', ['4-2-3:2'], '0.25 × 3은 0.01이 25 × 3 = 75개예요. 그래서 0.75!'],
        4: ['(자연수)×(소수 한 자리)', '자연수 × 소수 (소수 한 자리)', 20, '5-2-4:2', ['4-2-3:7'], '4 × 0.3은 4 × 3 = 12의 1/10이에요. 그래서 1.2! 1보다 작은 수를 곱하면 작아져요.'],
        5: ['(자연수)×(소수 두 자리)', '자연수 × 소수 (소수 두 자리)', 25, '5-2-4:4', ['4-2-3:2'], '3 × 0.25는 3 × 25 = 75의 1/100이에요. 그래서 0.75!'],
        6: ['(소수 한 자리)×(소수 한 자리)', '소수 × 소수 (소수 한 자리)', 25, '5-2-4:4', ['5-2-2:6', '4-2-3:7'], '0.3 × 0.4는 3 × 4 = 12에서 소수점 아래 자리가 1 + 1 = 2개 → 0.12!'],
        7: ['(소수 두 자리)×(소수 한 자리)', '소수 × 소수 (소수 두 자리)', 35, '5-2-4:6', ['4-2-3:4'], '0.25 × 0.3은 25 × 3 = 75에서 소수점 아래 자리가 2 + 1 = 3개 → 0.075!'],
      }[n];
      return {
        id, fam: 'g5_DMUL', name: M[0], kid: M[1], sec: M[2], prev: M[3],
        gen: DMULSPEC[id], is: (p) => dmulKind(p) === id,
        pre: (p) => uniq([...M[4], p ? KIND.MUL({ a: p.a, b: p.b }) : '3-2-1:3']),
        hint: M[5],
      };
    }),
    {
      id: '5-2-4:8', fam: 'g5_DPOINT', name: '곱의 소수점 위치', kid: '곱의 소수점 위치 (× 10, × 0.1 …)', sec: 15,
      gen: genDpoint, is: (p) => p.v === 'pow' || p.v === 'shift', prev: '5-2-4:7', pre: ['4-2-3:7'],
      hint: '× 10, × 100이면 소수점이 오른쪽으로 한 칸·두 칸, × 0.1, × 0.01이면 왼쪽으로 옮겨 가요. 3.42 × 100 = 342, 27 × 0.01 = 0.27.',
    },
  ],
};
