// 수 계산 도구 — 분수·최대공약수·난수. 화면과 상관없는 순수 함수만.

export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => (a / gcd(a, b)) * b;

// 분수 {n, d} — d > 0
export function F(n, d = 1) {
  if (d === 0) throw new Error('분모가 0');
  if (d < 0) { n = -n; d = -d; }
  return { n, d };
}
export const simp = (f) => { const g = gcd(f.n, f.d) || 1; return F(f.n / g, f.d / g); };
export const add = (a, b) => simp(F(a.n * b.d + b.n * a.d, a.d * b.d));
export const sub = (a, b) => simp(F(a.n * b.d - b.n * a.d, a.d * b.d));
export const mul = (a, b) => simp(F(a.n * b.n, a.d * b.d));
export const div = (a, b) => simp(F(a.n * b.d, a.d * b.n));
export const eqv = (a, b) => a.n * b.d === b.n * a.d;
export const isSimplest = (f) => gcd(f.n, f.d) === 1;
export const toMixed = (f) => ({ w: Math.floor(f.n / f.d), n: f.n % f.d, d: f.d });

// 소수 비교에 쓰는 안전한 같음 (부동소수 오차)
export const near = (a, b) => Math.abs(a - b) < 1e-9;
export const round = (x, k = 6) => Math.round(x * 10 ** k) / 10 ** k;

export function divisors(n) {
  const out = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}

// 재현 가능한 난수 (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
  return r;
}
export const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

// 입력 칸 글자 → 수 (빈칸이면 NaN). "3/7"·"2 1/3"(대분수)·"0.35"도 받는다
export function parseNum(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/,/g, '').replace(/\s+/g, ' ').replace(/^\./, '0.');
  if (!t) return NaN;
  let m = t.match(/^(-?\d+) (\d+)\/(\d+)$/);
  if (m) return +m[3] === 0 ? NaN : +m[1] + +m[2] / +m[3];
  m = t.match(/^(-?\d+)\/(\d+)$/);
  if (m) return +m[2] === 0 ? NaN : +m[1] / +m[2];
  if (!/^-?\d*(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

// 소수 → 보기 좋은 글자 (0.30000000000000004 막기)
export const fmt = (x) => String(Number(Number(x).toFixed(6)));
