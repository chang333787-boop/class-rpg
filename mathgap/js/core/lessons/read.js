// 선생님이 쓴 문제 글 → 차시 { c, p, note }
//   식을 읽어(자연수·소수·분수·대분수, 세 수 이상, 괄호, □ 자리) 그 모양이 될 수 있는 가족·params 후보를 만들고,
//   후보마다 그 차시가 실제로 만드는 문제 글과 쓴 글을 맞대 본다 — 똑같으면 그 차시. 같은 게 없으면 값이 맞는 첫 후보.
//   식이 아닌 문제(비례배분·최대공약수·통분 …)는 예전 읽기(parse.js)로 넘긴다
import { resolve, makeItem, byId, NODES } from './index.js';
import { rng } from '../math.js';
import { parseProblem } from '../parse.js';
import { toText } from '../tokens.js';
import { gcd, lcm } from '../math.js';

// ── 글 다듬기
export function normText(s) {
  return String(s || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s*나누기\s*/g, ' ÷ ').replace(/\s*곱하기\s*/g, ' × ').replace(/\s*더하기\s*/g, ' + ').replace(/\s*빼기\s*/g, ' − ')
    .replace(/[＋]/g, '+').replace(/[－–—-]/g, '−').replace(/[xX*✕]/g, '×').replace(/[：]/g, ':').replace(/[／]/g, '/')
    .replace(/[ㅁ?？○◯_]|\(\s*\)/g, '□').replace(/\.\.\.|…|⋯/g, ' … ')
    .replace(/(\d)\s*와\s*(\d+\s*\/\s*\d+)/g, '$1 $2')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}
// 맞대 보기용: 띄어쓰기·끝의 '= □' 지우기
// 답 칸만 있는 오른쪽(= □ · = □/□ · = □ □/3 · = □/3 = □ □/3 …)은 지우고 왼쪽 식만 맞댄다
const blanksOnly = (r) => r.includes('□') && /^[□\d\/=…\s]*$/.test(r);
const key = (s) => { let t = normText(s).replace(/\s/g, ''); const i = t.indexOf('='); if (i >= 0 && (blanksOnly(t.slice(i + 1)) || !t.slice(i + 1))) t = t.slice(0, i); return t; };

// ── 수 읽기: 대분수 '2 3/10' · 분수 · 소수 · 자연수
const NUMRE = /(\d+ \d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)/y;
function readNum(s, i) {
  NUMRE.lastIndex = i;
  const m = NUMRE.exec(s);
  if (!m) return null;
  const t = m[1];
  let v;
  if (/^\d+ \d+\/\d+$/.test(t)) { const [w, f] = t.split(' '); const [n, d] = f.split('/').map(Number); v = { k: 'mixed', w: Number(w), n, d, N: Number(w) * d + n }; }
  else if (t.includes('/')) { const [n, d] = t.split('/').map(Number); v = { k: 'frac', n, d }; }
  else if (t.includes('.')) { const [a, b] = t.split('.'); v = { k: 'dec', a: Number(a + b), d: b.length, x: Number(t) }; }
  else v = { k: 'int', x: Number(t) };
  v.t = t;
  return { v, end: i + t.length };
}
// 식 조각: 수 · 연산(+ − × ÷) · 괄호 · = · □ · …
function tokens(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') { i++; continue; }
    const n = /\d/.test(ch) ? readNum(s, i) : null;
    if (n) { out.push({ t: 'num', v: n.v }); i = n.end; continue; }
    if ('+−×÷()=□:…'.includes(ch)) { out.push({ t: ch }); i++; continue; }
    return null; // 식 아닌 글자가 섞임
  }
  return out;
}

// 자연수 수식의 값 (괄호·곱셈 먼저)
function evalInt(xs, os, g) {
  const prec = (o) => (o === '×' || o === '÷' ? 2 : 1);
  // 괄호 g = [i, j]: i~j 번째 수를 먼저
  if (g) {
    const inner = evalInt(xs.slice(g[0], g[1] + 1), os.slice(g[0], g[1]), null);
    if (inner == null) return null;
    return evalInt([...xs.slice(0, g[0]), inner, ...xs.slice(g[1] + 1)], [...os.slice(0, g[0]), ...os.slice(g[1])], null);
  }
  const vals = [xs[0]], ops = [];
  for (let k = 0; k < os.length; k++) {
    if (prec(os[k]) === 2) { const a = vals.pop(), b = xs[k + 1]; if (os[k] === '÷' && (b === 0 || a % b)) return null; vals.push(os[k] === '×' ? a * b : a / b); }
    else { vals.push(xs[k + 1]); ops.push(os[k]); }
  }
  let r = vals[0];
  ops.forEach((o, k) => { r = o === '+' ? r + vals[k + 1] : r - vals[k + 1]; });
  return r;
}

const fr = (v) => (v.k === 'frac' ? { n: v.n, d: v.d } : v.k === 'mixed' ? { n: v.N, d: v.d } : v.k === 'int' ? { n: v.x, d: 1 } : null);

// ── 후보 만들기
function candidates(T, raw, rhsShape = '') {
  const C = [];
  const add = (fam, p) => C.push({ fam, p });
  const nums = T.filter((x) => x.t === 'num').map((x) => x.v);
  const eq = T.findIndex((x) => x.t === '=');
  const lhs = eq >= 0 ? T.slice(0, eq) : T, rhs = eq >= 0 ? T.slice(eq + 1) : [];
  const boxAt = T.findIndex((x) => x.t === '□');
  const rhsIsBlank = rhs.length && rhs.every((x) => x.t === '□' || x.t === '…' || x.t === 'num' && false);

  // □가 식 안(왼쪽)에 있는 경우: a + □ = s · □ − b = c · 10 − □ = 3
  if (eq >= 0 && lhs.some((x) => x.t === '□') && rhs.length === 1 && rhs[0].t === 'num' && lhs.length === 3) {
    const s = rhs[0].v.x, op = lhs[1].t, left = lhs[0].t === '□', other = (left ? lhs[2] : lhs[0]).v;
    if (other && other.k === 'int' && Number.isInteger(s)) {
      if (op === '+') {
        const x = s - other.x;
        const tenK = () => { add('ADD', left ? { a: x, b: other.x, pos: 0 } : { a: other.x, b: x, pos: 1 }); add('ADD', left ? { a: x, b: other.x, pos: 1 } : { a: other.x, b: x, pos: 2 }); };
        if (s === 10 && other.x <= 9) tenK();      // 10이 되는 더하기(1학년)가 먼저
        add('A7', { a: other.x, s, left });
        if (s !== 10) tenK();
      }
      if (op === '−') {
        if (left) { const a = s + other.x; add('g2_SUBBOX', { a, b: other.x, pos: 1 }); add('g2_SUBBOX', { a, b: other.x, pos: 0 }); add('SUB', { a, b: other.x, pos: 0 }); }
        else {
          const b = other.x - s;
          if (other.x === 10) { add('SUB', { a: other.x, b, pos: 1 }); add('SUB', { a: other.x, b, pos: 2 }); }   // 10에서 빼기(1학년)가 먼저
          add('g2_SUBBOX', { a: other.x, b, pos: 2 }); add('g2_SUBBOX', { a: other.x, b, pos: 1 }); add('SUB', { a: other.x, b, pos: 1 }); add('SUB', { a: other.x, b, pos: 2 });
        }
      }
    }
  }
  // a + b = □ + c (등호)
  // a : b = c : d (□ 하나) — 비의 성질 · 비례식
  if (eq >= 0 && lhs.length === 3 && rhs.length === 3 && lhs[1].t === ':' && rhs[1].t === ':') {
    const q = [lhs[0], lhs[2], rhs[0], rhs[2]], pos = q.findIndex((x) => x.t === '□');
    if (pos >= 0 && q.filter((x) => x.t === '□').length === 1 && q.every((x) => x.t === '□' || (x.t === 'num' && x.v.k === 'int'))) {
      const v = q.map((x) => (x.t === 'num' ? x.v.x : null));
      // 빠진 수 채우기 (외항의 곱 = 내항의 곱)
      const full = v.slice();
      if (pos === 0) full[0] = (v[1] * v[2]) / v[3]; if (pos === 1) full[1] = (v[0] * v[3]) / v[2];
      if (pos === 2) full[2] = (v[0] * v[3]) / v[1]; if (pos === 3) full[3] = (v[1] * v[2]) / v[0];
      if (full.every(Number.isInteger)) {
        const [a, b, c, d] = full;
        for (const P0 of [pos, pos + 1]) {
          if (c % a === 0 && d % b === 0 && c / a === d / b) add('R6', { v: 'mul', a, b, k: c / a, pos: P0 });
          if (a % c === 0 && b % d === 0 && a / c === b / d) add('R6', { v: 'div', a: c, b: d, k: a / c, pos: P0 });
          add('R9', { v: 'x', a, b, c, d, pos: P0 });
        }
      }
    }
  }
  if (eq >= 0 && lhs.length === 3 && rhs.length === 3 && ['+', '−'].includes(lhs[1].t) && lhs[0].t === 'num' && lhs[2].t === 'num' && rhs.filter((x) => x.t === '□').length === 1 && rhs.some((x) => x.t === 'num')) {
    const a = lhs[0].v.x, b = lhs[2].v.x, c = (rhs[0].t === 'num' ? rhs[0] : rhs[2]).v.x;
    add('R0', { a, b, c });
  }
  // 수 하나 = 빈칸 (대분수↔가분수 · 소수로 · 크기가 같은 분수)
  if (eq >= 0 && lhs.length === 1 && lhs[0].t === 'num') {
    const v = lhs[0].v;
    if (v.k === 'mixed' && /^□\/\d+$/.test(rhsShape)) add('F5', { v: 'toImp', w: v.w, n: v.n, d: v.d });
    if (v.k === 'frac' && v.n > v.d && /^□□\/\d+$/.test(rhsShape)) add('F5', { v: 'toMix', w: Math.floor(v.n / v.d), n: v.n % v.d, d: v.d });
    if (v.k === 'frac' && /소수/.test(raw)) {
      if (v.d === 10) { add('DEC1', { v: 'frac', n: v.n }); add('DEC1', { v: 'frac10', n: v.n }); }
      if (v.d === 100) add('DEC2', { v: 'frac', n: v.n });
      add('F11', { v: 'toDec', n: v.n, d: v.d }); add('F11', { v: 'dec', n: v.n, d: v.d });
    }
    const m = /^□\/(\d+)$/.exec(rhsShape);
    if (v.k === 'frac' && m) { const d2 = Number(m[1]); if (d2 % v.d === 0) add('F7', { v: 'up', n: v.n, d: v.d, k: d2 / v.d }); if (v.d % d2 === 0 && v.n % (v.d / d2) === 0) add('F7', { v: 'down', d: d2, n: v.n / (v.d / d2), k: v.d / d2 }); }
  }
  // 왼쪽이 수식이고 오른쪽은 빈칸뿐(또는 없음)
  const right = eq < 0 || rhs.every((x) => x.t === '□' || x.t === '…');
  if (!right) return C;
  const L = lhs;
  if (L.some((x) => x.t === '□')) return C;
  const hasParen = L.some((x) => x.t === '(');
  const flat = L.filter((x) => x.t !== '(' && x.t !== ')');
  const xs = flat.filter((x) => x.t === 'num').map((x) => x.v), os = flat.filter((x) => '+−×÷'.includes(x.t)).map((x) => x.t);
  if (xs.length !== os.length + 1 || flat.length !== xs.length + os.length) return C;
  // 괄호 자리 (수 번호)
  let g = null;
  if (hasParen) {
    let k = 0, open = -1;
    for (const x of L) { if (x.t === 'num') k++; if (x.t === '(') open = k; if (x.t === ')') g = [open, k - 1]; }
  }
  // 두 수
  if (xs.length === 2 && !hasParen) {
    const [X, Y] = xs, op = os[0];
    const ints = X.k === 'int' && Y.k === 'int', decs = (X.k === 'dec' || X.k === 'int') && (Y.k === 'dec' || Y.k === 'int') && (X.k === 'dec' || Y.k === 'dec');
    const fracs = !ints && !decs && [X, Y].every((v) => ['frac', 'mixed', 'int'].includes(v.k));
    const ans = rhs.filter((x) => x.t === '□').length;
    if (ints) {
      const a = X.x, b = Y.x;
      if (op === '+') { add('ADD', { a, b }); }
      if (op === '−' && a >= b) add('SUB', { a, b });
      if (op === '×') add('MUL', { a, b });
      if (op === '÷' && b) {
        if (/분수/.test(raw) || a < b || rhsShape.includes('/')) { add('F16', { v: a < b ? 'small' : 'big', a, b }); add('F16', { v: 'big', a, b }); add('F16', { v: 'small', a, b }); }
        if (/소수/.test(raw)) add('g6_DDIV', { a, k: 0, b });
        add('DIV', { a, b });
      }
    }
    if (decs) {
      const A = X.k === 'dec' ? X : { a: X.x, d: 0 }, Bv = Y.k === 'dec' ? Y : { a: Y.x, d: 0 };
      if (op === '+' || op === '−') add('g4_DECAS', { op: op === '+' ? '+' : '-', a: A.a, ka: A.d, b: Bv.a, kb: Bv.d });
      if (op === '×') {
        // × 10·100·1000, × 0.1·0.01·0.001 이면 '곱의 소수점 위치'가 먼저
        const p10 = [10, 100, 1000].indexOf(Y.x);
        if (Y.k === 'int' && p10 >= 0) add('g5_DPOINT', { v: 'pow', xi: A.a, xd: A.d, e: p10 + 1 });
        if (Y.k === 'dec' && [1].includes(Bv.a)) add('g5_DPOINT', { v: 'pow', xi: A.a, xd: A.d, e: -Bv.d });
        add('g5_DMUL', { a: A.a, ad: A.d, b: Bv.a, bd: Bv.d });
      }
      if (op === '÷') {
        if (Y.k === 'int') add('g6_DDIV', { a: A.a, k: A.d, b: Y.x });
        add('g6_DDIV2', { a: A.a, ka: A.d, b: Bv.a, kb: Bv.d });
      }
    }
    if (fracs) {
      const f1 = fr(X), f2 = fr(Y);
      const sameD = f1.d === f2.d || X.k === 'int' || Y.k === 'int';
      if (op === '+' || op === '−') {
        const o = op === '+' ? '+' : '-';
        const mixedLike = X.k !== 'frac' || Y.k !== 'frac';
        if (X.k === 'frac' && Y.k === 'frac' && f1.d === f2.d) add('F6', { op: o, a: f1.n, b: f2.n, d: f1.d });
        if (sameD) {
          const d = X.k === 'int' ? f2.d : f1.d;
          const w1 = X.k === 'mixed' ? X.w : X.k === 'int' ? X.x : 0, n1 = X.k === 'mixed' ? X.n : X.k === 'frac' ? X.n : 0;
          const w2 = Y.k === 'mixed' ? Y.w : Y.k === 'int' ? Y.x : 0, n2 = Y.k === 'mixed' ? Y.n : Y.k === 'frac' ? Y.n : 0;
          if (mixedLike || n1 + n2 >= d) add('g4_FMIX', { op: o, w1, n1, w2, n2, d });
        }
        if (f1.d !== f2.d && X.k !== 'int' && Y.k !== 'int') {
          const L2 = lcm(f1.d, f2.d);
          if (X.k === 'frac' && Y.k === 'frac') add('F12', { n1: f1.n, d1: f1.d, n2: f2.n, d2: f2.d, L: L2, op: o });
          const w1 = X.k === 'mixed' ? X.w : 0, n1 = X.k === 'mixed' ? X.n : X.n, w2 = Y.k === 'mixed' ? Y.w : 0, n2 = Y.k === 'mixed' ? Y.n : Y.n;
          add(o === '+' ? 'g5_MIXADD' : 'g5_MIXSUB', { w1, n1, d1: f1.d, w2, n2, d2: f2.d, L: L2 });
        }
      }
      if (op === '×') {
        if (Y.k === 'int') { add('F13', { d: f1.d, n: f1.n, k: Y.x, ...(X.k === 'mixed' ? { mix: true } : {}) }); }
        else if (X.k === 'int') { add('F14', { d: f2.d, n: f2.n, N: X.x, ...(Y.k === 'mixed' ? { mix: true } : {}) }); }
        else {
          add('F15', { n1: f1.n, d1: f1.d, n2: f2.n, d2: f2.d, ...(X.k === 'mixed' ? { mix1: true } : {}), ...(Y.k === 'mixed' ? { mix2: true } : {}) });
          if (f1.n === 1 && f2.n === 1) { add('F15a', { a: f1.d, b: f2.d }); add('F15a', { d1: f1.d, d2: f2.d }); }
        }
      }
      if (op === '÷') {
        if (Y.k === 'int') { add('F17', { d: f1.d, k: Y.x, n: f1.n }); add('F17', { v: 'div', n: f1.n, d: f1.d, k: Y.x, ...(X.k === 'mixed' ? { mix: true } : {}) }); add('g6_FDIVMUL', { n: f1.n, d: f1.d, k: Y.x }); }
        else if (X.k === 'int') { add('F21', { v: X.x === 1 ? 'one' : 'n', n: f2.n, d: f2.d, N: X.x }); add('F21', { v: 'n', n: f2.n, d: f2.d, N: X.x }); }
        else {
          if (f1.d === f2.d && X.k === 'frac') add('F18', { a: f1.n, b: f2.n, d: f1.d });
          add('F19', { n1: f1.n, d1: f1.d, n2: f2.n, d2: f2.d, L: lcm(f1.d, f2.d), ...(X.k === 'mixed' ? { mix1: true } : {}), ...(Y.k === 'mixed' ? { mix2: true } : {}) });
          add('F20', { n1: f1.n, d1: f1.d, n2: f2.n, d2: f2.d });
        }
      }
    }
    void ans;
  }
  // 세 수 이상 (자연수)
  if (xs.length >= 3 && xs.every((v) => v.k === 'int')) {
    const ns = xs.map((v) => v.x);
    const small = ns.every((x) => x <= 18);
    const one = () => { if (!hasParen && xs.length === 3 && os.every((o) => o === '+')) add('ADD3', { a: ns[0], b: ns[1], c: ns[2] }); if (!hasParen && xs.length === 3 && os.every((o) => o === '−')) add('g1_SUB3', { a: ns[0], b: ns[1], c: ns[2] }); };
    const two = () => { if (!hasParen && xs.length === 3 && os.every((o) => o === '+' || o === '−')) add('g2_MIX3', { a: ns[0], o1: os[0] === '+' ? '+' : '-', b: ns[1], o2: os[1] === '+' ? '+' : '-', c: ns[2] }); };
    if (small) { one(); two(); } else { two(); one(); }   // 작은 수면 1학년 세 수 계산, 큰 수면 2학년
    if (evalInt(ns, os, g) != null) add('g5_MIX', { x: ns, o: os, g });
  }
  return C;
}

// 단위 바꾸기
function unitCands(raw) {
  const C = [];
  let m = /^(\d+) ?m (\d+) ?cm = □ ?cm$/.exec(raw); if (m) C.push({ fam: 'U1', p: { m: Number(m[1]), cm: Number(m[2]) } });
  m = /^(\d+) ?m = □ ?cm$/.exec(raw); if (m) C.push({ fam: 'U1', p: { m: Number(m[1]), cm: 0 } });
  m = /^(\d+) ?cm (\d+) ?mm = □ ?cm$/.exec(raw); if (m) C.push({ fam: 'DEC1', p: { v: 'cm', n: Number(m[1]) * 10 + Number(m[2]) } });
  return C;
}

// 쓴 글이 차시 문제와 똑같은지
function sameText(it, typed) { return key(toText(it.prompt)) === key(typed); }

// 모양 맞추기 — 숫자를 #로 바꾼 뼈대가 같은 차시를 찾는다 (864 = □ + 60 + 4 → '# = □ + # + #')
//   len: 자릿수까지 같은 뼈대(###)를 먼저 보고, 없으면 자릿수 없이. 처음 쓸 때 차시마다 문제를 뽑아 뼈대를 모아 둔다
const bone = (t, len) => key(t).replace(/\d+(\.\d+)?/g, (m) => (len ? '#' + m.replace('.', '').length + (m.includes('.') ? '.' : '') : '#'));
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  SHAPES = { len: new Map(), any: new Map() };
  const put = (m, k, id) => { const o = m.get(k) || {}; o[id] = (o[id] || 0) + 1; m.set(k, o); };
  for (const n of NODES) {
    if (!n.gen) continue;
    const r = rng(17);
    for (let i = 0; i < 40; i++) {
      let it; try { const p = n.gen(r); it = makeItem(n.id, p); } catch (e) { continue; }
      if (!it || !it.prompt || it.choices) continue;
      const t = toText(it.prompt);
      put(SHAPES.len, bone(t, true), n.id); put(SHAPES.any, bone(t, false), n.id);
    }
  }
  return SHAPES;
}
// 풀 수 없는 식(0으로 나누기 · 작은 수에서 큰 수 빼기)은 모양으로도 받지 않는다
function impossible(raw) {
  const m = key(raw).match(/^(\d+(?:\.\d+)?)([+−×÷])(\d+(?:\.\d+)?)$/);
  if (!m) return /÷0(?![\d.])/.test(key(raw));
  const a = Number(m[1]), b = Number(m[3]);
  return (m[2] === '−' && a < b) || (m[2] === '÷' && b === 0);
}
function byShape(raw, len) {
  if (impossible(raw)) return null;
  const o = shapes()[len ? 'len' : 'any'].get(bone(raw, len));
  if (!o) return null;
  const id = Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
  // 그 차시 문제를 새로 하나 — 쓴 숫자가 나오면 그대로
  const n = byId[id], r = rng(1);
  let pick = null;
  for (let i = 0; i < 400; i++) {
    let p, it; try { p = n.gen(r); it = makeItem(id, p); } catch (e) { continue; }
    if (it && it.prompt && !it.choices && sameText(it, raw)) return { c: id, p };
    if (!pick && it && it.prompt && !it.choices && bone(toText(it.prompt), len) === bone(raw, len)) pick = { c: id, p, note: '같은 모양의 그 차시 문제로 숫자를 바꿔 냈어요.' };
  }
  return pick;
}

// 두 문장·말이 붙은 식 — 비례식에서 외항·내항의 곱 · 자연수의 곱을 이용한 소수의 곱
function special(raw) {
  const out = [], t = raw.replace(/\s+/g, ' ');
  let m = t.match(/^(\d+) ?: ?(\d+) ?= ?(\d+) ?: ?(\d+) ?에서 (외항|내항)의 곱/);
  if (m) { const [a, b, c, d] = m.slice(1, 5).map(Number); out.push({ fam: 'R9', p: { v: 'prod', a, b, c, d, pos: 3 } }); }
  m = t.match(/^(\d+) ?× ?(\d+) ?= ?(\d+) ?(?:이에요|예요|입니다|이다|이고|일 때)?[.,]? ?(\d+(?:\.\d+)?) ?× ?(\d+(?:\.\d+)?) ?=/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), x = m[4], y = m[5];
    const dig = (s) => Number(s.replace('.', '').replace(/^0+(?=\d)/, '')), dp = (s) => (s.includes('.') ? s.length - s.indexOf('.') - 1 : 0);
    if (a * b === Number(m[3]) && dig(x) === a && dig(y) === b && dp(x) + dp(y) > 0) out.push({ fam: 'g5_DPOINT', p: { v: 'shift', a, b, ad: dp(x), bd: dp(y) } });
  }
  return out;
}

export function readProblem(input) {
  const raw = normText(input);
  if (!raw) return { error: '문제를 써 주세요.' };
  let exprPart = raw.replace(/를 계산하(면|세요).*$|을 계산하(면|세요).*$|의 몫을 (소수|분수)로.*$|\s*\((소수|분수)로\)$/, '').trim();
  const eqi = exprPart.indexOf('=');
  const rhsRaw = eqi >= 0 ? exprPart.slice(eqi + 1) : '';
  if (eqi >= 0 && blanksOnly(rhsRaw)) exprPart = `${exprPart.slice(0, eqi).trim()} = □`;
  else if (eqi >= 0 && /÷/.test(exprPart.slice(0, eqi)) && /×/.test(rhsRaw) && rhsRaw.includes('□')) exprPart = `${exprPart.slice(0, eqi).trim()} = □`; // 5/6 ÷ 3 = 5/6 × 1/□ = □/□
  const rhsShape = rhsRaw.replace(/\s/g, '');
  const tried = [];
  const unit = unitCands(raw);
  for (const { fam, p } of unit) { const r = resolve(fam, p); if (r.c && byId[r.c]) { try { const it = makeItem(r.c, r.p); if (sameText(it, raw)) return { c: r.c, p: r.p, text: input }; } catch (e) { /* */ } } }
  const T = tokens(exprPart);
  const S = special(raw);
  if (T || S.length) {
    let C = S.slice();
    try { if (T) C = C.concat(candidates(T, raw, rhsShape)); } catch (e) { /* */ }
    let first = null;
    for (const { fam, p } of C) {
      let r; try { r = resolve(fam, p); } catch (e) { continue; }
      if (!r.c || !byId[r.c]) continue;
      let it; try { it = makeItem(r.c, r.p); } catch (e) { continue; }
      if (!it || !it.prompt) continue;
      // 그 차시의 is(유형)에 맞는 params만
      const n = byId[r.c]; let okType = true; if (n.is) { try { okType = !!n.is(r.p); } catch (e) { okType = false; } }
      if (!okType) continue;
      tried.push(r.c);
      if (sameText(it, raw)) return { c: r.c, p: r.p, text: input };
      if (!first) first = { c: r.c, p: r.p, text: input, note: '쓴 모양과 조금 다르게 나와요(같은 차시 문제로 바꿔 냈어요).' };
    }
    const sh = byShape(raw, true);
    if (sh) return { ...sh, text: input };
    if (first) return first;
  }
  // 식이 아닌 문제 — 예전 읽기
  const old = parseProblem(input);
  if (!old.error) {
    const r = resolve(old.c, old.p);
    if (r.c && byId[r.c]) return { c: r.c, p: r.p, text: input, note: old.note };
  }
  const sh = byShape(raw, true) || byShape(raw, false);
  if (sh) return { ...sh, text: input };
  return { error: old.error || '이 문제 모양은 아직 알아보지 못해요. 아래 차시에서 골라 주세요.' };
}
export { gcd };
