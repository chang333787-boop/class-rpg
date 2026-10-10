// 문제 유형(틀) 도구 — 값 · 글 · 답 칸 · 고르기 · 계산 한 단계
//   값은 분수 {n, d}로 정확하게 들고 다닌다. 모양(style)에 따라 보이는 꼴이 다르다:
//     W 자연수 · D 소수 · F 분수(약분해서 보임 — 5학년부터) · FS 분모가 같은 분수(약분하지 않음 — 4학년은 약분을 아직 안 배움)
//   계산 한 단계(calcItem)는 그 계산을 가르치는 차시의 문제로 만든다(같은 숫자 · 그 차시의 틀린 모양 · 같이 풀기) — 못 찾으면 그냥 식
import { F, simp, gcd, lcm, eqv, near, fmt, rng as mkRng } from '../math.js';
import { nums, frac, mixed, pick, B, fb, P } from '../concepts/kit.js';
import { resolve, makeItem, byId } from '../lessons/index.js';
import { toText } from '../tokens.js';

export const rng = mkRng;
export const R = (n, d = 1) => simp(F(n, d));
export const val = (x) => x.n / x.d;
export const whole = (x) => x.n % x.d === 0;
export const lt = (a, b) => a.n * b.d < b.n * a.d;
export const same = (a, b) => eqv(a, b);
export const pos = (x) => x.n > 0;
export const INV = { '+': '−', '−': '+', '×': '÷', '÷': '×' };
const ASCII = { '+': '+', '−': '-', '×': '×', '÷': '÷' };

// 계산 — FS(분모가 같은 분수)의 덧셈 · 뺄셈은 분모를 그대로 둔다(약분하지 않음)
export function ar(op, x, y, st = 'F') {
  if (st === 'FS' && (op === '+' || op === '−')) {
    const D = lcm(x.d, y.d), a = x.n * (D / x.d), b = y.n * (D / y.d);
    return F(op === '+' ? a + b : a - b, D);
  }
  if (op === '+') return simp(F(x.n * y.d + y.n * x.d, x.d * y.d));
  if (op === '−') return simp(F(x.n * y.d - y.n * x.d, x.d * y.d));
  if (op === '×') return simp(F(x.n * y.n, x.d * y.d));
  return simp(F(x.n * y.d, x.d * y.n));
}
// 소수 자리 수(유한소수가 아니면 -1)
export function places(x) {
  const s = simp(x); let d = s.d, a = 0, b = 0;
  while (d % 2 === 0) { d /= 2; a++; }
  while (d % 5 === 0) { d /= 5; b++; }
  return d === 1 ? Math.max(a, b) : -1;
}
// 분수 모양 — 자연수 부분 · 분자 · 분모(FS 는 분모 그대로)
const parts = (x) => { const w = Math.floor(x.n / x.d); return { w, n: x.n - w * x.d, d: x.d }; };

// ── 보이는 꼴 ──
// 글(정답 글 · 보고서 · 단계 설명)
export function txt(x, st) {
  if (whole(x)) return String(x.n / x.d);
  if (st === 'D') return fmt(val(x));
  const { w, n, d } = parts(x);
  return w ? `${w} ${n}/${d}` : `${n}/${d}`;
}
// 문제 조각(문제 글 안 · 고르기 보기)
export function tok(x, st) {
  if (whole(x) || st === 'D' || st === 'W') return txt(x, st);
  const { w, n, d } = parts(x);
  return w ? { m: [w, n, d] } : { f: [n, d] };
}
// 수 뒤 조사 — 마지막에 소리 내어 읽는 것(분수는 분자) 기준
export const pj = (x, st, withB, noB) => P(txt(x, st), withB, noB);
// 단위 뒤 조사 — cm(센티미터) · m · L 는 받침 없음 · kg · g 은 받침
const UB = { cm: 0, mm: 0, m: 0, km: 0, L: 0, mL: 0, kg: 1, g: 1 };
const hb = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; };
export const uj = (unit, withB, noB) => ((unit in UB ? UB[unit] : hb(unit) > 0) ? withB : noB);
export const uro = (unit) => (unit in UB ? (UB[unit] ? '으로' : '로') : hb(unit) > 0 && hb(unit) !== 8 ? '으로' : '로');
// 수 + 단위 조각들 — 'cm' 처럼 로마자 단위는 띄우고 '개' 처럼 한글 단위는 붙인다
export function q(x, st, unit = '') {
  const t = tok(x, st);
  if (!unit) return [t];
  if (/^[가-힣]/.test(unit)) return typeof t === 'string' ? [t + unit] : [t, unit];
  return [t, ` ${unit}`];
}
// 조각 이어 붙이기 — 글자끼리는 합친다
export function S(...xs) {
  const out = [];
  for (const x of xs.flat(3)) {
    if (x == null || x === '') continue;
    if (typeof x === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += x;
    else out.push(x);
  }
  return out;
}
// 두 수와 연산 하나(보기 · 설명)
export const expr = (op, x, y, st) => S(tok(x, st), ` ${op} `, tok(y, st));
export const exprT = (op, x, y, st) => `${txt(x, st)} ${op} ${txt(y, st)}`;

// ── 답 칸 — 값 모양에 맞게(자연수 · 소수 = 칸 하나 · 진분수 = 분수 칸 · 1보다 큰 분수 = 대분수 칸) ──
//   bugs: [{ x: 그 답이 나오는 값, name: 틀린 모양 이름, to?: 차시 }] — 정답과 같은 값은 버린다
export function answerItem(lead, x, st, tail = '', bugs = []) {
  const bs = []; const seen = [x];
  for (const b of bugs) if (b && b.x && b.x.d && !seen.some((y) => eqv(y, b.x))) { seen.push(b.x); bs.push(b); }
  const hit = (v, y) => Number.isFinite(v) && near(v, val(y));
  const T = (lst, f) => lst.map((b) => ({ test: (v) => hit(f(v), b.x), name: b.name, to: b.to || null }));
  const L = [].concat(lead), Tl = tail ? [tail] : [];
  let it;
  if (whole(x) || st === 'D' || st === 'W') it = nums([...L, B(0), ...Tl], val(x), { bugs: T(bs, (v) => v[0]) });
  else if (x.n < x.d) it = frac([...L, fb(0, 1), ...Tl], x, { keep: st === 'FS', bugs: T(bs, (v) => (v[1] ? v[0] / v[1] : NaN)) });
  else it = mixed([...L, { m: [B(0), B(1), B(2)] }, ...Tl], x, { bugs: T(bs, (v) => (v[2] ? v[0] + v[1] / v[2] : NaN)) });
  it.ansText = txt(x, st); it.bugList = bs;
  return it;
}

// ── 고르기 — opts: [{ t: 조각 배열 | 글, right?: true, name?: 틀린 까닭 }] · 같은 글은 하나만 · r 로 섞는다 ──
export function choose(prompt, opts, r) {
  const seen = new Set(), list = [];
  for (const o of opts) { const t = [].concat(o.t), k = toText(t); if (seen.has(k)) continue; seen.add(k); list.push({ ...o, t }); }
  const sh = r ? r.shuffle(list) : list;
  const right = sh.findIndex((o) => o.right), bugs = {};
  sh.forEach((o, i) => { if (!o.right && o.name) bugs[i] = { name: o.name, to: null }; });
  const it = pick([].concat(prompt), sh.map((o) => o.t), right, { bugs });
  it.ansText = toText(sh[right].t);
  return it;
}

// ── 계산 한 단계 ──
// 차시 문제의 정답 값 — 빈칸이 든 마지막 조각을 sol 로 채워 계산
function itemValue(it) {
  const p = it.prompt || [], sol = it.sol || [];
  const part = (x) => (x && typeof x === 'object' && 'b' in x ? Number(sol[x.b]) : Number(x));
  for (let i = p.length - 1; i >= 0; i--) {
    const t = p[i];
    if (!t || typeof t !== 'object') continue;
    if ('b' in t) return part(t);
    if ('f' in t && t.f.some((x) => x && typeof x === 'object')) return part(t.f[0]) / part(t.f[1]);
    if ('m' in t && t.m.some((x) => x && typeof x === 'object')) return part(t.m[0]) + part(t.m[1]) / part(t.m[2]);
  }
  return NaN;
}
const dec = (x) => { const k = places(x); return { a: Math.round(val(x) * 10 ** k), k }; };
// 이 계산을 가르치는 차시 후보 — { fam, p } 들(차시 정의의 params 꼴)
function candidates(op, x, y, st) {
  const o = ASCII[op], out = [];
  const X = parts(x), Y = parts(y), xi = whole(x), yi = whole(y);
  if (xi && yi) {
    const a = x.n / x.d, b = y.n / y.d;
    out.push({ fam: { '+': 'ADD', '−': 'SUB', '×': 'MUL', '÷': 'DIV' }[op], p: { a, b } });
    return out;
  }
  if (st === 'D') {
    const A = dec(x), Bd = dec(y);
    if (A.k < 0 || Bd.k < 0) return out;
    if (op === '+' || op === '−') out.push({ fam: 'g4_DECAS', p: { op: o, a: A.a, ka: A.k, b: Bd.a, kb: Bd.k } });
    if (op === '×') out.push({ fam: 'g5_DMUL', p: { a: A.a, ad: A.k, b: Bd.a, bd: Bd.k } });
    if (op === '÷' && yi) out.push({ fam: 'g6_DDIV', p: { a: A.a, k: A.k, b: Bd.a } });
    if (op === '÷' && !yi) out.push({ fam: 'g6_DDIV2', p: { a: A.a, ka: A.k, b: Bd.a, kb: Bd.k } });
    return out;
  }
  if (op === '+' || op === '−') {
    if (x.d === y.d || st === 'FS' || xi || yi) {   // 분모가 같거나 한쪽이 자연수(3 − 1 1/5)면 분모가 같은 분수의 계산
      const d = lcm(x.d, y.d), xn = x.n * (d / x.d), yn = y.n * (d / y.d), w1 = Math.floor(xn / d), w2 = Math.floor(yn / d);
      if (!w1 && !w2) out.push({ fam: 'F6', p: { op: o, a: xn, b: yn, d } });
      out.push({ fam: 'g4_FMIX', p: { op: o, w1, n1: xn - w1 * d, w2, n2: yn - w2 * d, d } });
    } else {
      if (!X.w && !Y.w) out.push({ fam: 'F12', p: { n1: X.n, d1: X.d, n2: Y.n, d2: Y.d, L: lcm(X.d, Y.d), op: o } });
      out.push({ fam: op === '+' ? 'g5_MIXADD' : 'g5_MIXSUB', p: { w1: X.w, n1: X.n, d1: X.d, w2: Y.w, n2: Y.n, d2: Y.d, L: lcm(X.d, Y.d) } });
    }
    return out;
  }
  if (op === '×') {
    if (yi) out.push({ fam: 'F13', p: { d: x.d, n: x.n, k: y.n, ...(x.n > x.d ? { mix: true } : {}) } });
    if (xi) out.push({ fam: 'F14', p: { N: x.n, n: y.n, d: y.d, ...(y.n > y.d ? { mix: true } : {}) } });
    if (!xi && !yi) out.push({ fam: 'F15', p: { n1: x.n, d1: x.d, n2: y.n, d2: y.d, ...(x.n > x.d ? { mix1: true } : {}), ...(y.n > y.d ? { mix2: true } : {}) } });
    return out;
  }
  // ÷
  if (yi) out.push({ fam: 'F17', p: { v: x.n % y.n ? 'eq' : 'div', d: x.d, k: y.n, n: x.n, ...(x.n > x.d ? { mix: true } : {}) } });
  if (xi && (x.n * y.d) % y.n === 0) out.push({ fam: 'F21', p: { v: 'n', n: y.n, d: y.d, N: x.n } });
  if (!xi && !yi && x.d === y.d) out.push({ fam: 'F18', p: { a: x.n, b: y.n, d: x.d, ...(x.n > x.d ? { mix1: true } : {}) } });
  if (!xi && !yi) out.push({ fam: 'F19', p: { n1: x.n, d1: x.d, n2: y.n, d2: y.d, L: lcm(x.d, y.d), ...(x.n > x.d ? { mix1: true } : {}) } });
  return out;
}
// 보이는 수가 같은가 — 문제 글에 두 수가 그 꼴 그대로 있는지(분모가 같은 분수를 약분해 보여 주면 안 됨)
const shows = (it, op, x, y, st) => toText(it.prompt).replace(/\s+/g, ' ').startsWith(`${txt(x, st)} ${op === '−' ? '−' : op} ${txt(y, st)}`.replace(/\s+/g, ' '));
// op(x, y) 한 단계 → { c: 차시(못 찾으면 null), p, item, z: 결과 값 }
export function calcItem(op, x, y, st = 'F', { lead = null } = {}) {
  const z = ar(op, x, y, st);
  let guess = null;   // 값은 맞는데 보이는 꼴이 다른 차시(4 3/5 − 0 1/5) — 식은 우리 꼴로, 차시는 그것으로
  for (const k of candidates(op, x, y, st)) {
    let r; try { r = resolve(k.fam, k.p); } catch (e) { continue; }
    if (!r || !r.c || !byId[r.c]) continue;
    let it; try { it = makeItem(r.c, r.p); } catch (e) { continue; }
    if (it.choices || it.nBlanks > 3 || !near(itemValue(it), val(z))) continue;
    if (!shows(it, op, x, y, st)) { guess = guess || r.c; continue; }
    if (lead) it.prompt = [...[].concat(lead), ...it.prompt];
    return { c: r.c, p: r.p, item: it, z };
  }
  const it = answerItem(S(lead || [], expr(op, x, y, st), ' = '), z, st);
  return { c: guess, p: null, item: it, z, own: true };
}
// 몫과 나머지(자연수) — DIV 차시 문제 그대로(빈칸 둘)
export function divRemItem(a, b) {
  const r = resolve('DIV', { a, b });
  return { c: r.c, p: r.p, item: makeItem(r.c, r.p), q: Math.floor(a / b), rem: a % b };
}

// 조건에 맞을 때까지 다시 뽑기
export function until(r, make, ok, tries = 600) {
  for (let i = 0; i < tries; i++) { const p = make(r); if (p && ok(p)) return p; }
  throw new Error('유형: 조건에 맞는 수를 못 찾음');
}
// 분모 d 인 분수(FS) — 자연수 부분 w, 분자 n
export const fs = (w, n, d) => F(w * d + n, d);
export { F, simp, gcd, lcm, eqv, near, fmt };
