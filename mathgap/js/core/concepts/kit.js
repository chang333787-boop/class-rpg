// 문항 만드는 도구. 문항 = { prompt, choices?, check(vals) → {ok, bug?}, ans(정답 글), timed? }
// bug = { name: '오답 모양 이름', to: '내려가 볼 개념 id' | [id…] }
import { F, eqv, isSimplest, near, gcd } from '../math.js';
import { toText, blankCount } from '../tokens.js';

const fails = (vals) => vals.some((v) => v == null || Number.isNaN(v));

function withBugs(ok, vals, bugs) {
  if (ok) return { ok: true };
  for (const b of bugs || []) {
    try { if (b.test(vals)) return { ok: false, bug: { name: b.name, to: b.to } }; } catch (e) { /* 무시 */ }
  }
  return { ok: false };
}

// 빈칸 여러 개 — 각 칸이 정해진 수
export function nums(prompt, answers, { bugs, timed, order = true, noFrac = false } = {}) {
  const ans = [].concat(answers).map((a) => Number(Number(a).toFixed(9)));
  return {
    prompt,
    sol: ans,
    ans: toText(prompt, ans.map((a) => String(Number(a.toFixed(6))))),
    timed,
    check(vals, raws = []) {
      if (fails(vals.slice(0, ans.length))) return { ok: false };
      if (noFrac && raws.some((s) => String(s).includes('/'))) return { ok: false, bug: { name: '분수로 씀 (소수로 써야 해요)', to: null } };
      let ok;
      if (order) ok = ans.every((a, i) => near(vals[i], a));
      else { const s = vals.slice(0, ans.length).map(Number).sort((x, y) => x - y); ok = ans.slice().sort((x, y) => x - y).every((a, i) => near(s[i], a)); }
      return withBugs(ok, vals, bugs);
    },
  };
}

// 분수 빈칸 (위 = vals[i], 아래 = vals[j]) — 크기가 같으면 정답 (simplest면 기약분수만)
export function frac(prompt, ans, { i = 0, j = 1, simplest = false, den = null, bugs, extra, keep = false } = {}) {
  // 보여 주는 정답은 기약분수로 (크기가 같은 분수는 모두 정답 · 분모가 정해진 칸이나 keep이면 그대로)
  const g0 = den == null && !keep ? gcd(ans.n, ans.d) || 1 : 1;
  // 답이 자연수(2/1)면 분수 칸 대신 빈칸 하나 — 분수 칸이 마지막 칸일 때만 (칸 번호가 밀리지 않게)
  if (den == null && !keep) {
    const k = ans.d / g0 === 1 && j === i + 1 && blankCount(prompt) === j + 1 ? prompt.findIndex((t) => t && typeof t === 'object' && 'f' in t && t.f[0] && t.f[0].b === i && t.f[1] && t.f[1].b === j) : -1;
    if (k >= 0) {
      const p2 = prompt.slice(); p2[k] = { b: i };
      const w = ans.n / g0, sol1 = Object.assign([], { [i]: w });
      return {
        prompt: p2, sol: sol1, ans: toText(p2, sol1),
        check(vals) {
          const v = vals[i];
          if (fails([v])) return { ok: false };
          let ok = v === w;
          if (ok && extra) ok = extra(vals);
          return withBugs(ok, Object.assign([], vals, { [j]: 1 }), bugs);
        },
      };
    }
  }
  const sol = Object.assign([], { [i]: ans.n / g0, [j]: ans.d / g0 });
  if (den != null) sol.length = i + 1;
  return {
    prompt,
    sol,
    ans: toText(prompt, sol),
    check(vals) {
      const n = vals[i], d = den != null ? den : vals[j];
      if (fails([n, d]) || d === 0) return { ok: false };
      let ok = eqv(F(n, d), ans) && Number.isInteger(n) && Number.isInteger(d);
      if (ok && simplest && !isSimplest(F(n, d))) {
        return { ok: false, bug: { name: '끝까지 약분하지 않음', to: 'G3' } };
      }
      if (ok && extra) ok = extra(vals);
      return withBugs(ok, vals, bugs);
    },
  };
}

// 대분수 빈칸 — prompt 안에 {m:[{b:wi},{b:ni},{b:di}]} (또는 di 대신 고정 분모 den). 크기가 같고 분수 부분이 진분수면 정답
//   simplest: 분수 부분을 기약분수로 써야 정답
export function mixed(prompt, ans, { wi = 0, ni = 1, di = 2, den = null, simplest = false, bugs } = {}) {
  const w = Math.floor(ans.n / ans.d), r = ans.n - w * ans.d;
  const g = gcd(r, ans.d) || 1, rn = simplest ? r / g : r, rd = den != null ? den : simplest ? ans.d / g : ans.d;
  const k = den != null ? den / ans.d : 1;
  const sol = Object.assign([], { [wi]: w, [ni]: den != null ? r * k : rn }, den != null ? {} : { [di]: rd });
  return {
    prompt,
    sol,
    ans: toText(prompt, sol),
    check(vals) {
      const W = vals[wi], N = vals[ni], D = den != null ? den : vals[di];
      if (fails([W, N, D]) || !D || ![W, N, D].every(Number.isInteger)) return withBugs(false, vals, bugs);
      let ok = N >= 0 && N < D && eqv(F(W * D + N, D), ans);
      if (ok && simplest && N > 0 && !isSimplest(F(N, D))) return { ok: false, bug: { name: '분수 부분을 끝까지 약분하지 않음', to: 'G3' } };
      return withBugs(ok, vals, bugs);
    },
  };
}

// 고르기 — choices는 조각 배열들, right = 정답 번호, bugs = {번호: {name, to}}
export function pick(prompt, choices, right, { bugs = {}, timed } = {}) {
  return {
    prompt, choices, timed,
    sol: [right],
    ans: toText(choices[right]),
    check(vals) {
      const k = vals[0];
      if (k === right) return { ok: true };
      return { ok: false, bug: bugs[k] };
    },
  };
}

// 구구단 개념 id — a × b 를 'a단'으로 본다
export function tbl(a) {
  if ([2, 5, 1, 0].includes(a)) return 'M3';
  if ([3, 6].includes(a)) return 'M4';
  if ([4, 8].includes(a)) return 'M5';
  return 'M6';
}

// 수 뒤 조사 — 마지막 자리 읽기의 받침으로 (0 십·백 / 1 일 / 3 삼 / 6 육 / 7 칠 / 8 팔 = 받침)
const BAT = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
const RIEUL = [0, 1, 0, 0, 0, 0, 0, 1, 1, 0];
// 마지막에 소리 내어 읽는 것: 소수는 끝자리(2.3 → 삼), 분수는 분자(3/4 → 사분의 삼), 한글로 끝나면 그 글자(5272만 → 만)
function lastSound(n) {
  let t = typeof n === 'number' ? String(Number(n.toFixed(10))) : String(n).trim();
  const h = t.charCodeAt(t.length - 1);
  if (h >= 0xac00 && h <= 0xd7a3) { const jong = (h - 0xac00) % 28; return { bat: jong > 0, rieul: jong === 8 }; }
  if (t.endsWith('%')) return { bat: false, rieul: false };
  if (t.includes('/')) t = t.slice(0, t.indexOf('/'));
  const m = t.match(/(\d)\D*$/), d = m ? Number(m[1]) : 0;
  return { bat: !!BAT[d], rieul: !!RIEUL[d] };
}
export const J = (n, withB, noB) => `${n}${lastSound(n).bat ? withB : noB}`;
export const P = (n, withB, noB) => (lastSound(n).bat ? withB : noB);
export const RO = (n) => { const s = lastSound(n); return `${n}${s.bat && !s.rieul ? '으로' : '로'}`; };

export const fx = (n, d) => ({ f: [n, d] });
export const B = (i) => ({ b: i });
export const fb = (i, j) => ({ f: [{ b: i }, { b: j }] });
export { F, gcd };
