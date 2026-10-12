// 오답 분석 — 틀린 답이 '어떤 점으로' 틀렸는지(10-12 교사 '단순 계산 실수인지, 어떤 개념을 헷갈렸는지 · 숫자마다 변수가 다를 텐데')
//   방법: 답 모양을 외우지 않고, 틀린 방법(버그)을 그 문제의 숫자로 직접 돌려 예측한 답과 아이 답을 맞춰 본다
//     (Brown & Burton 1978 BUGGY · VanLehn 1990 Mind Bugs · Ashlock 오류 유형) — 숫자가 바뀌면 예측도 따라 바뀐다.
//   · 그 숫자로는 정답과 같아지는 방법(받아올림이 없는데 '받아올림 잊음')은 이 문제로 못 가림 → testable 에서 뺀다
//   · 같은 답을 여러 방법이 설명하면 모두 남긴다(애매) — 하나를 찍지 않는다
//   · 계산 실수(slip)는 '방법은 맞고 한 군데만 삐끗한 답'의 모음: 한 자리 숫자만 다름 · 이웃 숫자 바꿈 · 곱셈구구 한 칸 · 분자/자연수 ±1
//   kind: concept 개념 오류(다른 규칙) · proc 절차 실수(받아올림 · 받아내림 · 자릿값 · 형태) · slip 계산 실수 · unknown 설명 못 함
//   한 문제는 가설일 뿐 — 여러 문제를 모아 정하는 것은 앱(today.js whyNote · whyOf): 같은 방법이 두 번 맞고, 그 방법이었으면 틀렸어야 할 문제를 맞히지 않았을 때 '확실'
//   시험 = tests/errors.test.mjs(가상 아이: 계산 실수형 · 버그형마다 · 섞인 형)
import { toText } from './tokens.js';
import { F, eqv, gcd, lcm, isSimplest } from './math.js';

// ── 식 읽기(보이는 꼴 그대로: 대분수 · 분수 · 소수 · 자연수) ──
const NUM = String.raw`\d+ \d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?`;
const EXPR = new RegExp(`^\\s*(${NUM})\\s*([+−×÷])\\s*(${NUM})\\s*=`);
function part(s) {
  let m;
  if ((m = s.match(/^(\d+) (\d+)\/(\d+)$/))) return { k: 'F', w: +m[1], n: +m[2], d: +m[3], v: F(+m[1] * +m[3] + +m[2], +m[3]) };
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return { k: 'F', w: 0, n: +m[1], d: +m[2], v: F(+m[1], +m[2]) };
  if (s.includes('.')) { const p = s.split('.')[1].length; return { k: 'D', p, i: Math.round(Number(s) * 10 ** p), v: F(Math.round(Number(s) * 10 ** p), 10 ** p) }; }
  return { k: 'W', i: Number(s), v: F(Number(s), 1) };
}
export function readExpr(it) {
  if (!it || it.choices) return null;
  const m = toText(it.prompt).match(EXPR);
  if (!m) return null;
  const A = part(m[1]), B = part(m[3]);
  const st = A.k === 'D' || B.k === 'D' ? 'D' : A.k === 'F' || B.k === 'F' ? 'F' : 'W';
  const X = { A, B, op: m[2], st };
  // 몫을 자연수(또는 몫 … 나머지)로 쓰는 나눗셈인가 — 6학년 '몫을 분수로'에는 몫 자리 버그를 쓰지 않음
  if (X.op === '÷' && st === 'W') X.intQ = (it.sol && it.sol.length === 2) || A.i % B.i === 0;
  return X;
}

// ── 아이 답 읽기 — 마지막 '=' 뒤 빈칸(자연수 · 몫 … 나머지 · 분수 · 대분수) · '='가 없으면(문장제 답 칸) 빈칸 전체 ──
const isB = (x) => x && typeof x === 'object' && 'b' in x;
const val = (x, vals) => (isB(x) ? Number(vals[x.b]) : Number(x));
export function answerOf(it, vals) {
  const p = it.prompt || [];
  let k = -1;
  for (let i = p.length - 1; i >= 0; i--) if (typeof p[i] === 'string' && p[i].includes('=')) { k = i; break; }
  const tail = p.slice(k + 1).filter((t) => t && typeof t === 'object' && (isB(t) || ('f' in t && t.f.some(isB)) || ('m' in t && t.m.some(isB))));
  if (!tail.length) return null;
  if (tail.length === 2 && isB(tail[0]) && isB(tail[1])) { const q = val(tail[0], vals), r = val(tail[1], vals); return Number.isFinite(q) && Number.isFinite(r) ? { q, r, v: null } : null; }
  const t = tail[tail.length - 1];
  if (isB(t)) { const x = val(t, vals); if (!Number.isFinite(x)) return null; const s = String(vals[t.b] ?? x); const pl = s.includes('.') ? s.split('.')[1].length : 0; return { v: F(Math.round(x * 10 ** pl), 10 ** pl), x }; }
  if ('f' in t) { const n = val(t.f[0], vals), d = val(t.f[1], vals); return Number.isInteger(n) && Number.isInteger(d) && d > 0 ? { v: F(n, d), w: 0, n, d } : null; }
  const w = val(t.m[0], vals), n = val(t.m[1], vals), d = val(t.m[2], vals);
  return [w, n, d].every(Number.isInteger) && d > 0 ? { v: F(w * d + n, d), w, n, d } : null;
}

// 첫 '=' 뒤 줄을 글로(가운데 칸까지) — 9/8 = 1 1/8 · 가운데 칸 실수의 예를 보일 때
export function chainOf(it, vals) {
  const p = it.prompt || [], k = p.findIndex((t) => typeof t === 'string' && t.includes('='));
  const v = (t) => (isB(t) ? vals[t.b] : t);
  return p.slice(k + 1).map((t) => (typeof t === 'string' ? t.trim() : !t ? '' : 'b' in t ? String(v(t)) : 'f' in t ? `${v(t.f[0])}/${v(t.f[1])}` : 'm' in t ? `${v(t.m[0])} ${v(t.m[1])}/${v(t.m[2])}` : '')).filter(Boolean).join(' ');
}

// ── 자연수 세로셈(자리 숫자 배열 · 낮은 자리부터) ──
const digs = (n) => String(n).split('').reverse().map(Number);
const fromDigs = (ds) => Number(ds.slice().reverse().join('') || '0');
const len = (n) => String(n).length;
function colAdd(a, b, { carry = true, concat = false } = {}) {
  const x = digs(a), y = digs(b), L = Math.max(x.length, y.length), out = []; let c = 0;
  if (concat) { const parts = []; for (let i = 0; i < L; i++) parts.unshift(String((x[i] || 0) + (y[i] || 0))); return Number(parts.join('')); }
  for (let i = 0; i < L; i++) { const s = (x[i] || 0) + (y[i] || 0) + (carry ? c : 0); out.push(s % 10); c = s >= 10 ? 1 : 0; }
  if (carry && c) out.push(1);
  return fromDigs(out);
}
// 받아내림 버그 — big: 자리마다 큰 수에서 작은 수 · noDec: 받아내리고 윗자리를 안 줄임 · zero: 0에서 받아내릴 때 0을 9로 안 바꿈
function colSub(a, b, bug = null) {
  const x = digs(a), y = digs(b), out = [];
  if (bug === 'big') { for (let i = 0; i < x.length; i++) out.push(Math.abs(x[i] - (y[i] || 0))); return fromDigs(out); }
  const top = x.slice();
  for (let i = 0; i < top.length; i++) {
    const yi = y[i] || 0;
    if (top[i] < yi) {
      if (bug !== 'noDec') {
        let j = i + 1;
        while (j < top.length && top[j] === 0) { if (bug !== 'zero') top[j] = 9; j++; }
        if (j >= top.length) return null;
        top[j] -= 1;
      }
      out.push(top[i] + 10 - yi);
    } else out.push(top[i] - yi);
  }
  return fromDigs(out);
}
// 곱셈(□ × 한 자리) — noCarry: 곱의 일의 자리만 · preAdd: 올린 수를 곱하기 전에 더함
function colMul1(a, m, bug = null) {
  const x = digs(a), out = []; let c = 0;
  for (let i = 0; i < x.length; i++) {
    const last = i === x.length - 1;
    const p = bug === 'preAdd' ? (x[i] + c) * m : x[i] * m + (bug === 'noCarry' ? 0 : c);
    if (last) { out.push(...digs(p)); break; }   // 맨 앞 자리는 곱을 그대로 씀
    out.push(p % 10); c = Math.floor(p / 10);
  }
  return fromDigs(out);
}
// 나눗셈 몫 자리(긴 나눗셈) — dropZero: 몫 가운데 0을 빠뜨림
function longDiv(a, b, { dropZero = false } = {}) {
  const ds = String(a).split('').map(Number); let r = 0; const q = [];
  for (const d of ds) { r = r * 10 + d; const qi = Math.floor(r / b); q.push(qi); r -= qi * b; }
  let s = q.join('').replace(/^0+(?=\d)/, '');
  if (dropZero) s = s.replace(/0/g, '') || '0';
  return { q: Number(s), r };
}

// ── 틀린 방법(버그) 목록 — 그 숫자로 예측한 답 · 못 하면 null ──
//   pred → { v } 값 · { q, r } 몫과 나머지 · { v, form } 값은 같고 꼴만 다름(impr 분수 부분이 1보다 큼 · unsimp 약분 안 함)
const MW = (n) => ({ v: F(n, 1) });
const BUGS = [
  // 덧셈(자연수 · 소수는 자릿수를 맞춘 정수로)
  { id: 'add.noCarry', op: '+', st: ['W', 'D'], kind: 'proc', name: '받아올림을 잊음', f: (X) => intOp(X, (a, b) => colAdd(a, b, { carry: false })) },
  { id: 'add.concat', op: '+', st: ['W'], kind: 'proc', name: '자리마다 합을 그대로 붙여 씀(받아올림을 안 함)', f: (X) => intOp(X, (a, b) => colAdd(a, b, { concat: true })) },
  { id: 'add.align', op: '+', st: ['W'], kind: 'concept', name: '자리를 맞추지 않고 더함(자릿값)', f: (X) => (len(X.A.i) !== len(X.B.i) ? MW(len(X.A.i) > len(X.B.i) ? X.A.i + X.B.i * 10 ** (len(X.A.i) - len(X.B.i)) : X.B.i + X.A.i * 10 ** (len(X.B.i) - len(X.A.i))) : null) },
  // 뺄셈
  { id: 'sub.big', op: '−', st: ['W', 'D'], kind: 'proc', name: '자리마다 큰 수에서 작은 수를 뺌(받아내림을 안 함)', f: (X) => intOp(X, (a, b) => colSub(a, b, 'big')) },
  { id: 'sub.noDec', op: '−', st: ['W', 'D'], kind: 'proc', name: '받아내리고 윗자리에서 1을 안 뺌', f: (X) => intOp(X, (a, b) => colSub(a, b, 'noDec')) },
  { id: 'sub.zero', op: '−', st: ['W'], kind: 'proc', name: '0에서 받아내릴 때 0을 9로 바꾸지 않음', f: (X) => intOp(X, (a, b) => colSub(a, b, 'zero')) },
  // 곱셈
  { id: 'mul.noCarry', op: '×', st: ['W'], kind: 'proc', name: '곱셈에서 올린 수를 안 더함', f: (X) => mul1(X, 'noCarry') },
  { id: 'mul.preAdd', op: '×', st: ['W'], kind: 'proc', name: '올린 수를 곱하기 전에 더함', f: (X) => mul1(X, 'preAdd') },
  { id: 'mul.noShift', op: '×', st: ['W'], kind: 'proc', name: '둘째 줄을 한 칸 밀지 않음', f: (X) => { const [a, b] = big2(X); if (!b || b < 10 || b > 99) return null; return MW(a * (b % 10) + a * Math.floor(b / 10)); } },
  { id: 'mul.same', op: '×', st: ['W'], kind: 'concept', name: '같은 자리끼리만 곱함', f: (X) => { const [a, b] = big2(X); if (!b || a < 10 || a > 99 || b < 10 || b > 99) return null; return MW(Number(`${Math.floor(a / 10) * Math.floor(b / 10)}${(a % 10) * (b % 10)}`)); } },
  { id: 'mul.zero', op: '×', st: ['W'], kind: 'proc', name: '0을 빠뜨림(자릿값)', f: (X) => { const ok = (n) => n % 10 === 0; if (!(ok(X.A.i) || ok(X.B.i))) return null; const z = (n) => { let k = 0; while (n && n % 10 === 0) { n /= 10; k++; } return [n, k]; }; const [a] = z(X.A.i), [b] = z(X.B.i); return MW(a * b); } },
  // 나눗셈
  { id: 'div.dropZero', op: '÷', st: ['W'], kind: 'proc', name: '몫 가운데 0을 빠뜨림', f: (X) => { if (!X.intQ || X.B.i > 9 || !/0/.test(String(Math.floor(X.A.i / X.B.i)))) return null; const t = longDiv(X.A.i, X.B.i, { dropZero: true }); return { q: t.q, r: X.A.i % X.B.i, v: F(t.q, 1) }; } },
  { id: 'div.underQ', op: '÷', st: ['W'], kind: 'proc', name: '몫을 하나 덜 구함(나머지가 나누는 수보다 큼)', f: (X) => { const q = Math.floor(X.A.i / X.B.i); if (!X.intQ || q < 1) return null; return { q: q - 1, r: X.A.i - X.B.i * (q - 1), v: F(q - 1, 1) }; } },
  { id: 'div.swapQR', op: '÷', st: ['W'], kind: 'proc', name: '몫과 나머지를 바꿔 씀', f: (X) => { const q = Math.floor(X.A.i / X.B.i), r = X.A.i % X.B.i; return r && r !== q ? { q: r, r: q, v: null } : null; } },
  // 분수 · 대분수 덧셈 · 뺄셈
  { id: 'fr.addDen', op: '+', st: ['F'], kind: 'concept', name: '분모끼리도 더함', f: (X) => fr(X.A.w + X.B.w, X.A.n + X.B.n, X.A.d + X.B.d) },
  { id: 'fr.subDen', op: '−', st: ['F'], kind: 'concept', name: '분모끼리도 뺌', f: (X) => (X.A.d !== X.B.d && X.A.d > X.B.d && X.A.n >= X.B.n ? fr(X.A.w - X.B.w, X.A.n - X.B.n, X.A.d - X.B.d) : null) },
  { id: 'fr.keepDen', op: '+', st: ['F'], kind: 'concept', name: '분모를 같게 하지 않고 분자만 더함', f: (X) => (X.A.d !== X.B.d ? fr(X.A.w + X.B.w, X.A.n + X.B.n, Math.max(X.A.d, X.B.d)) : null) },
  { id: 'fr.keepDenS', op: '−', st: ['F'], kind: 'concept', name: '분모를 같게 하지 않고 분자만 뺌', f: (X) => (X.A.d !== X.B.d && X.A.n >= X.B.n ? fr(X.A.w - X.B.w, X.A.n - X.B.n, Math.max(X.A.d, X.B.d)) : null) },
  { id: 'fr.lcdNum', op: '+', st: ['F'], kind: 'proc', name: '통분할 때 분모만 바꾸고 분자는 그대로 둠', f: (X) => (X.A.d !== X.B.d ? fr(X.A.w + X.B.w, X.A.n + X.B.n, lcm(X.A.d, X.B.d)) : null) },
  { id: 'fr.lcdNumS', op: '−', st: ['F'], kind: 'proc', name: '통분할 때 분모만 바꾸고 분자는 그대로 둠', f: (X) => (X.A.d !== X.B.d && X.A.n >= X.B.n ? fr(X.A.w - X.B.w, X.A.n - X.B.n, lcm(X.A.d, X.B.d)) : null) },
  { id: 'fr.noCarry', op: '+', st: ['F'], kind: 'proc', name: '분수 부분에서 받아올린 1을 자연수에 더하지 않음', f: (X) => { const D = lcm(X.A.d, X.B.d), s = X.A.n * (D / X.A.d) + X.B.n * (D / X.B.d); return s >= D ? fr(X.A.w + X.B.w, s - D, D) : null; } },
  { id: 'fr.subBig', op: '−', st: ['F'], kind: 'proc', name: '분수 부분을 큰 수에서 작은 수로 뺌', f: (X) => { const D = lcm(X.A.d, X.B.d), a = X.A.n * (D / X.A.d), b = X.B.n * (D / X.B.d); return a < b && X.A.w > X.B.w && X.A.n > 0 ? fr(X.A.w - X.B.w, b - a, D) : null; } },
  { id: 'fr.borrowNoDec', op: '−', st: ['F'], kind: 'proc', name: '자연수에서 1을 받아내리고 자연수는 안 줄임', f: (X) => { const D = lcm(X.A.d, X.B.d), a = X.A.n * (D / X.A.d), b = X.B.n * (D / X.B.d); return a < b && X.A.w > X.B.w ? fr(X.A.w - X.B.w, a + D - b, D) : null; } },
  { id: 'fr.borrow10', op: '−', st: ['F'], kind: 'concept', name: '받아내린 1을 10으로 봄(자연수 습관)', f: (X) => { const D = lcm(X.A.d, X.B.d), a = X.A.n * (D / X.A.d), b = X.B.n * (D / X.B.d); return a < b && X.A.w > X.B.w && D !== 10 && a + 10 - b >= 0 ? fr(X.A.w - 1 - X.B.w, a + 10 - b, D) : null; } },
  { id: 'fr.wholeKeep', op: '−', st: ['F'], kind: 'concept', name: '자연수에서 분수를 빼지 않고 분수를 그대로 붙임', f: (X) => (X.A.n === 0 && X.B.w >= 0 && X.B.n > 0 && X.A.w > X.B.w ? fr(X.A.w - X.B.w, X.B.n, X.B.d) : null) },
  { id: 'fr.impr', op: '+', st: ['F'], kind: 'proc', name: '분수 부분이 1보다 커요 — 대분수로 바꾸지 않음', form: 'impr', f: () => null },
  // 소수
  { id: 'dec.alignRight', op: '+', st: ['D'], kind: 'concept', name: '소수점을 맞추지 않고 끝자리를 맞춤', f: (X) => decRight(X, (a, b) => a + b) },
  { id: 'dec.alignRightS', op: '−', st: ['D'], kind: 'concept', name: '소수점을 맞추지 않고 끝자리를 맞춤', f: (X) => decRight(X, (a, b) => a - b) },
];
// 정수 꼴로 돌리기 — 자연수는 그대로, 소수는 자릿수를 맞춰 정수로 바꾸고 결과를 다시 소수로
function intOp(X, g) {
  if (X.st === 'W') { const r = g(X.A.i, X.B.i); return r == null ? null : MW(r); }
  if (X.st !== 'D') return null;
  const p = Math.max(X.A.k === 'D' ? X.A.p : 0, X.B.k === 'D' ? X.B.p : 0), s = (P) => (P.k === 'D' ? P.i * 10 ** (p - P.p) : P.i * 10 ** p);
  const r = g(s(X.A), s(X.B));
  return r == null ? null : { v: F(r, 10 ** p) };
}
const big2 = (X) => (X.A.i >= X.B.i ? [X.A.i, X.B.i] : [X.B.i, X.A.i]);
function mul1(X, bug) { const [a, m] = X.B.i <= 9 ? [X.A.i, X.B.i] : X.A.i <= 9 ? [X.B.i, X.A.i] : [null, null]; if (a == null || a < 10) return null; return MW(colMul1(a, m, bug)); }
function fr(w, n, d) { if (d <= 0 || n < 0 || w < 0) return null; return { v: F(w * d + n, d), w, n, d }; }   // 꼴(w n/d)도 들고 감 — 값이 같은 두 방법을 꼴로 가름
function decRight(X, g) {   // 끝자리를 맞춤 = 소수점을 떼고 정수로 계산한 뒤 자릿수가 많은 쪽 소수점을 찍음
  const pa = X.A.k === 'D' ? X.A.p : 0, pb = X.B.k === 'D' ? X.B.p : 0;
  if (pa === pb) return null;
  const r = g(X.A.i, X.B.i), p = Math.max(pa, pb);
  return r < 0 ? null : { v: F(r, 10 ** p) };
}

// ── 맞게 계산한 값 ──
function rightOf(X) {
  const a = X.A.v, b = X.B.v;
  if (X.op === '+') return F(a.n * b.d + b.n * a.d, a.d * b.d);
  if (X.op === '−') return F(a.n * b.d - b.n * a.d, a.d * b.d);
  if (X.op === '×') return F(a.n * b.n, a.d * b.d);
  return F(a.n * b.d, a.d * b.n);
}
const same = (p, ans) => {
  if (!p || !ans) return false;
  if (ans.q != null) return p.q != null && ans.q === p.q && ans.r === p.r;
  return !!(p.v && ans.v && eqv(p.v, ans.v));
};
const remItem = (it, X) => X.op === '÷' && it.sol && it.sol.length === 2;
// 그 방법의 답이 정답과 같은가(이 문제로 못 가림) — 몫 · 나머지 문제는 둘 다, 아니면 값
function predRight(p, X, right, rem) {
  if (rem) { if (p.q == null) return null; return p.q === Math.floor(right.n / right.d) && p.r === X.A.i % X.B.i; }
  if (!p.v) return null;
  return eqv(p.v, right);
}

// ── 계산 실수(방법은 맞고 한 군데 삐끗) ──
function slipOf(X, ans, right) {
  // 정수(자연수 · 소수를 정수로 · 몫)
  const asInt = (v) => (v && v.d && Number.isInteger((v.n / v.d) * 10 ** 6) ? v : null);
  if (ans.q != null) {
    const q = Math.floor(right.n / right.d), r = X.A.i - X.B.i * q;
    if (ans.q === q && ans.r !== r && Math.abs(ans.r - r) <= 2) return '나머지 계산 실수';
    if (ans.r === r && ans.q !== q) { const s = digitSlip(q, ans.q, X); if (s) return s; }
    return null;
  }
  if (X.st === 'F' || (ans.d && ans.d > 1)) {
    if (!ans.d) return null;
    const R = right, D = ans.d;
    if ((D * R.n) % R.d !== 0) return null;   // 답의 분모로 정답을 못 씀 → 분자 실수로 볼 수 없음
    const N = (D * R.n) / R.d, rw = Math.floor(N / D), rn = N - rw * D, aw = ans.w || 0;
    if (ans.n < D && aw === rw && Math.abs(ans.n - rn) <= 2 && ans.n !== rn) return '분자 계산 실수';
    if (ans.n === rn && Math.abs(aw - rw) === 1) return '자연수 부분 계산 실수';
    return null;
  }
  if (!asInt(ans.v)) return null;
  const p = Math.max(0, ...[X.A, X.B].map((P) => (P.k === 'D' ? P.p : 0)));
  const ri = Math.round((right.n / right.d) * 10 ** p), ai = Math.round((ans.v.n / ans.v.d) * 10 ** p);
  return digitSlip(ri, ai, X);
}
function digitSlip(r, a, X) {
  if (!Number.isInteger(r) || !Number.isInteger(a) || r === a || a < 0) return null;
  const rs = String(r), as = String(a);
  if (rs.length === as.length) {
    const diff = [...rs].map((ch, i) => (ch !== as[i] ? i : -1)).filter((i) => i >= 0);
    if (diff.length === 2 && diff[1] === diff[0] + 1 && rs[diff[0]] === as[diff[1]] && rs[diff[1]] === as[diff[0]]) return '이웃한 숫자를 바꿔 씀';
    if (diff.length === 1) return Math.abs(+rs[diff[0]] - +as[diff[0]]) === 1 ? '한 자리 계산 실수(1 차이)' : '한 자리 계산 실수';
  }
  // 곱셈구구 한 칸(7 × 8 을 7 × 7 로) — 차이가 곱하는 수의 한 자리 숫자 × 10^k
  if (X && X.op === '×') {
    const d = Math.abs(r - a), ms = new Set([...String(X.A.i ?? ''), ...String(X.B.i ?? '')].map(Number).filter((x) => x > 0));
    for (let k = 0; k <= 4; k++) for (const m of ms) if (d === m * 10 ** k) return '곱셈구구 하나를 틀림';
  }
  // 받아올림 · 받아내림을 한 자리에서만 삐끗(차이가 10^k) — 한 번이면 계산 실수, 늘 그러면 절차(버그 쪽이 모아서 가림)
  const d = Math.abs(r - a);
  if (d > 0 && Number.isInteger(Math.log10(d)) && 10 ** Math.round(Math.log10(d)) === d) return '한 자리 계산 실수(받아올림 · 받아내림 하나)';
  return null;
}

// 답 칸 모양에 그 예측을 쓸 수 있는가 — 분모가 정해진 칸(□/8)에 9/16 은 못 씀 · 한 칸에 몫 … 나머지는 못 씀
function fits(it, p) {
  const pr = it.prompt || [], k = pr.map((t, i) => (typeof t === 'string' && t.includes('=') ? i : -1)).filter((i) => i >= 0).pop();
  const tail = pr.slice(k + 1).filter((t) => t && typeof t === 'object'), B = (x) => x && typeof x === 'object' && 'b' in x;
  const t = tail[tail.length - 1];
  if (!t) return false;
  if (tail.length === 2 && B(tail[0]) && B(tail[1])) return p.q != null;
  if (!p.v) return false;
  if (B(t)) return true;
  const d = p.d != null ? p.d : p.v.d, w = p.w != null ? p.w : Math.floor(p.v.n / p.v.d);
  if ('m' in t) return B(t.m[2]) || t.m[2] === d || (p.d == null && (t.m[2] * p.v.n) % p.v.d === 0);
  if ('f' in t) return !w && (B(t.f[1]) || t.f[1] === d);
  return false;
}
// 이 문제로 가릴 수 있는 버그(그 방법이면 정답과 다른 답이 나오고, 그 답을 이 답 칸에 쓸 수 있음) — 맞힌 문제는 그 버그의 반대 증거
export function testable(it) {
  const X = readExpr(it);
  if (!X) return [];
  const right = rightOf(X), out = [];
  for (const g of BUGS) {
    if (g.op !== X.op || !g.st.includes(X.st) || g.form) continue;
    let p = null; try { p = g.f(X); } catch (e) { p = null; }
    if (!p) continue;
    const isRight = predRight(p, X, right, remItem(it, X));
    if (isRight === false && fits(it, p)) out.push(g.id);
  }
  return out;
}

// ── 한 문제의 오답 분석 ── it = 차시 문제(식이 보이는 것) · ans = answerOf(답 칸, vals) — 문장제는 그 차시 계산 문제와 문장제 답 값을 넘긴다
//  → { kind, hyps: [{ id, name, kind }], slip: 이름|null, ambiguous, testable: [버그 id] } | null(분석할 수 없는 문제)
export function diagnose(it, ans, { lessonBug = null } = {}) {
  const X = readExpr(it);
  if (!X || !ans) return null;
  const right = rightOf(X), hyps = [], tests = testable(it);
  const rightNow = ans.q != null ? ans.q === Math.floor(right.n / right.d) && ans.r === X.A.i % X.B.i : ans.v && eqv(ans.v, right);
  if (rightNow) {
    // 값은 맞는데 꼴이 틀림(대분수로 안 바꿈 · 약분 안 함)
    if (ans.d && ans.n >= ans.d) hyps.push({ id: 'fr.impr', name: '분수 부분이 1보다 커요 — 대분수로 바꾸지 않음', kind: 'proc' });
    else if (ans.d && ans.n && !isSimplest(F(ans.n, ans.d))) hyps.push({ id: 'fr.unsimp', name: '분수 부분을 약분하지 않음', kind: 'proc' });
    if (hyps.length) return { kind: 'proc', hyps, slip: null, ambiguous: false, testable: tests };
    // 마지막 답은 맞는데 틀렸다고 함 → 가운데 칸(가분수 · 중간 계산)이 틀림 — diagnose 는 틀린 답에만 부르므로
    return { kind: 'slip', hyps, slip: '가운데 칸 계산 실수', mid: true, ambiguous: false, testable: tests };
  }
  const hit = [];
  for (const g of BUGS) {
    if (g.op !== X.op || !g.st.includes(X.st) || g.form || !tests.includes(g.id)) continue;
    let p = null; try { p = g.f(X); } catch (e) { p = null; }
    if (same(p, ans)) hit.push({ g, p });
  }
  // 값이 같은 방법이 여럿이면 아이가 쓴 꼴(1 8/5 · 2 3/5)과 똑같은 것만 남김 — 꼴까지 같은 게 없으면 모두
  const exact = ans.d ? hit.filter(({ p }) => p.d === ans.d && p.n === ans.n && (p.w || 0) === (ans.w || 0)) : [];
  for (const { g } of exact.length ? exact : hit) hyps.push({ id: g.id, name: g.name, kind: g.kind });
  if (lessonBug && lessonBug.name && !hyps.some((h) => h.name === lessonBug.name)) hyps.push({ id: `lesson:${lessonBug.name}`, name: lessonBug.name, kind: kindOfName(lessonBug.name), to: lessonBug.to || null });
  const slip = slipOf(X, ans, right);
  const kinds = new Set(hyps.map((h) => h.kind));
  const kind = kinds.has('concept') ? 'concept' : kinds.has('proc') ? 'proc' : slip ? 'slip' : 'unknown';
  return { kind, hyps, slip, ambiguous: hyps.length + (slip ? 1 : 0) > 1, testable: tests };
}
// 차시에 적어 둔 틀린 모양 이름 → 종류(절차 · 개념) — 낱말로 가름
export function kindOfName(name) {
  const s = String(name || '');
  if (/실수/.test(s)) return 'slip';
  if (/받아올림|받아내림|올린 수|올림을|자리를|자릿값|0의 개수|0을|한 칸|밀지|약분|대분수로|가분수로|소수점|빠뜨림|나머지가|꼴|형태|순서를 바꿔 씀/.test(s)) return 'proc';
  return 'concept';
}
export const BUG_LIST = BUGS.map((g) => ({ id: g.id, name: g.name, kind: g.kind, op: g.op, st: g.st }));
const BY_ID = Object.fromEntries(BUGS.map((g) => [g.id, g]));

// ── 여러 문제 모으기(한 차시) ── recs = [{ ok, d: diagnose 결과 | null, tests: testable(it) }]
//  그 방법이 설명한 틀린 답 s · 그 방법이었으면 틀렸어야 할 문제에서 다르게 답함(맞힘 · 다른 오답) a
//  sure = s ≥ 2 이고 s ≥ a(두 번 맞아떨어지고, 반대 증거가 더 많지 않음 · 가상 아이로 정함: 버그를 60%만 쓰는 아이도 86% 찾고 헛짚음 0%) · maybe = s 1 · a 0
//  verdict: concept · proc(확실한 방법이 있음) · slip(틀린 답이 계산 실수로만 설명되고 확실한 방법이 없음) · maybe · unknown · none(틀린 적 없음)
export function judge(recs) {
  const H = {}; let wrong = 0, slips = 0, unk = 0, idk = 0;
  const nm = (id) => (BY_ID[id] ? BY_ID[id].name : String(id).replace(/^lesson:/, ''));
  const get = (id, h) => (H[id] = H[id] || { id, name: (h && h.name) || nm(id), kind: (h && h.kind) || (BY_ID[id] ? BY_ID[id].kind : kindOfName(nm(id))), s: 0, a: 0 });
  for (const r of recs) {
    if (!r) continue;
    if (!r.ok) {
      wrong++;
      if (r.idk) { idk++; continue; }
      if (r.d) { for (const h of r.d.hyps) get(h.id, h).s++; if (!r.d.hyps.length && r.d.slip) slips++; if (r.d.kind === 'unknown') unk++; } else unk++;
    }
    for (const id of r.tests || []) if (!r.idk && (r.ok || !(r.d && r.d.hyps.some((h) => h.id === id)))) get(id).a++;
  }
  const hs = Object.values(H).filter((h) => h.s > 0);
  const sure = hs.filter((h) => h.s >= 2 && h.s >= h.a).sort((x, y) => y.s - x.s);
  const maybe = hs.filter((h) => h.s === 1 && h.a === 0 && !sure.includes(h));
  const verdict = !wrong ? 'none' : sure.length ? (sure.some((h) => h.kind === 'concept') ? 'concept' : 'proc') : slips && slips >= wrong - idk - unk && slips >= (wrong - idk) / 2 ? 'slip' : maybe.length ? 'maybe' : idk >= wrong / 2 ? 'idk' : 'unknown';
  return { verdict, sure, maybe, wrong, slips, unk, idk };
}
export { rightOf };
// 시험용 — 그 버그를 쓴 아이의 답(vals) · 그 버그로 가릴 수 없으면 null(tests/errors.test.mjs)
export function __predict(it, id) {
  const X = readExpr(it), g = BY_ID[id];
  if (!X || !g || g.form) return null;
  let p = null; try { p = g.f(X); } catch (e) { return null; }
  if (!p) return null;
  const k = (it.prompt || []).map((t, i) => (typeof t === 'string' && t.includes('=') ? i : -1)).filter((i) => i >= 0).pop();
  const tail = it.prompt.slice(k + 1).filter((t) => t && typeof t === 'object'), vals = it.sol.slice().map(Number);
  const B = (x) => x && typeof x === 'object' && 'b' in x;
  const bs = tail.filter(B);
  if (p.q != null && bs.length === 2 && tail.length === 2) { vals[bs[0].b] = p.q; vals[bs[1].b] = p.r; return vals; }
  if (!p.v) return null;
  const t = tail[tail.length - 1];
  if (!t) return null;
  if (B(t)) { vals[t.b] = Number((p.v.n / p.v.d).toFixed(6)); return vals; }
  const w = p.w != null ? p.w : Math.floor(p.v.n / p.v.d), d = p.d != null ? p.d : p.v.d, n = p.n != null ? p.n : p.v.n - w * p.v.d;
  if ('m' in t) { if (!B(t.m[2]) && t.m[2] !== d) return null; [w, n, d].forEach((y, i) => { if (B(t.m[i])) vals[t.m[i].b] = y; }); return vals; }
  if ('f' in t) { if (w) return null; if (!B(t.f[1]) && t.f[1] !== d) return null; if (B(t.f[0])) vals[t.f[0].b] = n; if (B(t.f[1])) vals[t.f[1].b] = d; return vals; }
  return null;
}
