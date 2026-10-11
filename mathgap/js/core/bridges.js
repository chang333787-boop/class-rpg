// 옛 개념 다리 — "예전에 배웠지? 숫자만 바뀐 거야"(10-11 교사: 6 ÷ 2를 배울 때처럼 분수도 등분제 · 포함제를 오가며 가르친다)
//   bridgeOf(차시, params) → { old: { c, p, item } 예전에 배운 차시 문제(아이가 직접 풂), idea 그때 배운 생각, same 같은 것, change 바뀐 것, leap 다리가 끊기는 곳 | null }
//   같은 숫자를 되도록 그대로 쓴다(8 ÷ 7 → 8 ÷ 7 = 1 … 1). 예전 문제를 못 풀면 그게 진짜 빈칸이다(앱이 기초 층으로).
//   '끊기는 곳'(도약): 앞 개념을 완벽히 해도 저절로 되지 않는 새 생각 — 화면에 그대로 적는다(교사 강조).
//   지금은 분수의 나눗셈(6-1-1 · 6-2-1)부터. 시험 = tests/bridges.test.mjs
import { byId, makeItem, resolve } from './lessons/index.js';
import { gcd } from './math.js';
import { P } from './concepts/kit.js';

const mk = (fam, p) => { try { const r = resolve(fam, p); if (!r.c || !byId[r.c]) return null; return { c: r.c, p: r.p, item: makeItem(r.c, r.p) }; } catch (e) { return null; } };
const frac = (n, d) => `${n}/${d}`;
// 조사 — 분수는 분자를 읽는 소리로(5/4 → 사분의 오 → '는')
const j = (t, a, b) => `${t}${P(String(t).trim().split(/\s+/).pop(), a, b)}`;   // 식이면 마지막 수 기준
const ye = (t) => j(t, '이에요', '예요');
// '로/으로' — ㄹ 받침(1 · 7 · 8)은 '로'
const RO_ = (n) => { const d = String(n).slice(-1); return '0368'.includes(d) && d !== '8' ? '으로' : '로'; };
const mixedT = (n, d) => { const w = Math.floor(n / d), r = n % d; return w ? (r ? `${w} ${r}/${d}` : String(w)) : `${r}/${d}`; };

const B = {
  // 몫을 분수로 (1보다 작을 때) — 등분제: a개를 b명이 똑같이
  '6-1-1:2': (p) => {
    const q = 2, old = mk('D1', { d: p.b, q });
    return old && {
      old, idea: '똑같이 나누기 — 몇 명이 똑같이 나누면 한 명이 얼마',
      same: `${p.a} ÷ ${p.b}도 ${p.a}개를 ${p.b}명이 똑같이 나누는 거예요.`,
      change: `한 명에게 1개씩도 돌아가지 않아요. 그래서 하나를 ${p.b}조각으로 쪼개 나눠요 — 한 명이 1/${p.b}씩, ${p.a}개면 ${frac(p.a, p.b)}.`,
      leap: '자연수 나눗셈으로는 몫이 0이지만, 분수로 나타내면 1보다 작은 몫도 쓸 수 있어요.',
    };
  },
  // 몫을 분수로 (1보다 클 때) — 나머지가 있는 나눗셈과 같은 숫자
  '6-1-1:3': (p) => {
    const old = mk('DIV', { a: p.a, b: p.b }), q = Math.floor(p.a / p.b), r = p.a % p.b;
    return old && {
      old, idea: '나머지가 있는 나눗셈',
      same: `${p.a} ÷ ${p.b} = ${q} … ${ye(r)}. 여기까지는 예전과 똑같아요.`,
      change: `남은 ${r}도 ${p.b}${RO_(p.b)} 나눠요 → ${frac(r, p.b)}. 그래서 몫은 ${mixedT(p.a, p.b)} = ${ye(frac(p.a, p.b))}.`,
      leap: null,
    };
  },
  // (분수) ÷ (자연수) — 등분제: 1/d이 n개를 k명이
  '6-1-1:4': (p) => {
    const ok = p.n % p.k === 0, A = ok ? p.n : p.n * p.k;
    const old = A <= 81 ? mk('DIV', { a: A, b: p.k }) : null;
    return old && {
      old, idea: '똑같이 나누기(구구단으로)',
      same: ok ? `${j(frac(p.n, p.d), '은', '는')} 1/${p.d}이 ${p.n}개예요. ${p.n}개를 ${p.k}명이 나누는 것과 같아요.` : `${j(frac(p.n, p.d), '은', '는')} 1/${p.d}이 ${p.n}개 — ${p.n}개는 ${p.k}명이 똑같이 나눌 수 없어요.`,
      change: ok ? `세는 단위만 1개 → 1/${p.d}로 바뀌었어요. 한 명이 1/${p.d}이 ${p.n / p.k}개 = ${frac(p.n / p.k, p.d)}.`
        : `조각을 ${p.k}배로 잘게 쪼개면(크기가 같은 분수) ${frac(p.n * p.k, p.d * p.k)} — 1/${p.d * p.k}이 ${p.n * p.k}개라 ${p.k}명이 나눌 수 있어요. 한 명이 ${frac(p.n, p.d * p.k)}.`,
      leap: ok ? null : '분자가 나누어떨어지지 않으면, 크기가 같은 분수로 바꿔 조각을 잘게 쪼개는 새 생각이 필요해요(5학년 크기가 같은 분수).',
    };
  },
  // ÷ 자연수 = × 1/자연수 — 3학년 '몇의 몇 분의 1'
  '6-1-1:5': (p) => {
    const old = mk('F4', { N: p.k * 3, n: 1, d: p.k });
    return old && {
      old, idea: '몇의 1/몇(분수만큼은 얼마)',
      same: `${j(`${p.k * 3} ÷ ${p.k}`, '과', '와')} ${p.k * 3}의 1/${j(p.k, '은', '는')} 같은 값이에요.`,
      change: `분수도 똑같아요. ${frac(p.n, p.d)} ÷ ${p.k} = ${frac(p.n, p.d)}의 1/${p.k} = ${frac(p.n, p.d)} × 1/${p.k}.`,
      leap: null,
    };
  },
  // (대분수) ÷ (자연수) — 대분수를 가분수로
  '6-1-1:6': (p) => {
    const w = Math.floor(p.n / p.d), r = p.n % p.d, old = mk('F5', { v: 'toImp', w, n: r, d: p.d });
    return old && {
      old, idea: '대분수를 가분수로 바꾸기',
      same: `${j(`${w} ${frac(r, p.d)}`, '을', '를')} 가분수로 바꾸면 ${ye(frac(p.n, p.d))}.`,
      change: `그다음은 (분수) ÷ (자연수)와 똑같아요: ${frac(p.n, p.d)} ÷ ${p.k}.`,
      leap: null,
    };
  },
  // 분모가 같은 (분수) ÷ (분수), 나누어떨어짐 — 포함제: 몇 개씩 덜어 내면 몇 번
  '6-2-1:2': (p) => {
    const q = p.a / p.b, old = mk('D2', { v: 'pic', d: p.b, q }) || (p.a <= 81 ? mk('DIV', { a: p.a, b: p.b }) : null);
    return old && {
      old, idea: '몇 개씩 덜어 내면 몇 번(포함제)',
      same: `${frac(p.a, p.d)} ÷ ${frac(p.b, p.d)}도 ${p.a}개를 ${p.b}개씩 덜어 내는 거예요.`,
      change: `세는 단위만 1개 → 1/${p.d}로 바뀌었어요. 1/${p.d}이 ${p.a}개 안에 1/${p.d}이 ${p.b}개가 ${q}번 들어가요.`,
      leap: null,
    };
  },
  // 분모가 같은 (분수) ÷ (분수), 안 나누어떨어짐 — 6-1 몫을 분수로
  '6-2-1:3': (p) => {
    const old = mk('F16', { v: p.a < p.b ? 'small' : 'big', a: p.a, b: p.b });
    return old && {
      old, idea: '나눗셈의 몫을 분수로',
      same: `${j(`${frac(p.a, p.d)} ÷ ${frac(p.b, p.d)}`, '은', '는')} 1/${p.d}이 ${p.a}개 ÷ 1/${p.d}이 ${p.b}개 — ${j(`${p.a} ÷ ${p.b}`, '과', '와')} 같아요.`,
      change: `${p.a} ÷ ${p.b}의 몫을 분수로 쓰면 ${frac(p.a, p.b)}${gcd(p.a, p.b) > 1 ? `(= ${frac(p.a / gcd(p.a, p.b), p.b / gcd(p.a, p.b))})` : ''}. 분모 ${j(p.d, '은', '는')} 세는 단위라 몫에 남지 않아요.`,
      leap: null,
    };
  },
  // 분모가 다른 (분수) ÷ (분수) — 통분하면 분모가 같은 나눗셈
  '6-2-1:4': (p) => {
    const old = mk('F9', { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 });
    const L = p.d1 * p.d2 / gcd(p.d1, p.d2);
    return old && {
      old, idea: '통분하기',
      same: `통분하면 ${frac(p.n1 * L / p.d1, L)} ÷ ${frac(p.n2 * L / p.d2, L)} — 분모가 같은 나눗셈이에요.`,
      change: `분모가 같으면 분자끼리 나눠요: ${p.n1 * L / p.d1} ÷ ${p.n2 * L / p.d2}.`,
      leap: null,
    };
  },
  // (자연수) ÷ (분수) — 포함제로 보면 '나누면 커지는' 까닭이 보인다
  '6-2-1:5': (p) => {
    const one = p.v === 'one', NN = one ? 1 : p.N, N = NN * p.d, unitOld = one || p.n === 1;
    const old = unitOld ? mk('F3', { v: 'whole', w: NN, d: p.d }) : N <= 81 ? mk('DIV', { a: N, b: p.n }) : null;
    p = { ...p, N: NN };
    return old && {
      old, idea: unitOld ? '자연수를 1/몇이 몇 개로 세기' : '몇 개씩 덜어 내면 몇 번(포함제)',
      same: `${j(p.N, '을', '를')} 1/${p.d}로 세면 1/${p.d}이 ${N}개예요. 그 안에 1/${p.d}이 ${p.n}개씩 몇 번 들어가나 — ${N} ÷ ${p.n}.`,
      change: `세는 단위만 1개 → 1/${p.d}로 바뀌었어요.`,
      leap: `몫이 처음 수 ${p.N}보다 커져요. 1보다 작은 수로 나누면 몫이 커져요 — "나누면 작아진다"가 깨지는 곳이에요.`,
    };
  },
  // (분수) ÷ (분수)를 곱셈으로 — ÷ 자연수 = × 1/자연수 를 넓힘
  '6-2-1:6': (p) => {
    const old = mk('g6_FDIVMUL', { n: p.n1, d: p.d1, k: Math.max(2, p.d2) });
    return old && {
      old, idea: '÷ 자연수를 × 1/자연수로',
      same: `÷ ${j(Math.max(2, p.d2), '이', '가')} × ${j(`1/${Math.max(2, p.d2)}`, '이었던', '였던')} 것처럼, ÷ ${j(frac(p.n2, p.d2), '은', '는')} 나누는 분수를 뒤집어 × ${frac(p.d2, p.n2)}.`,
      change: `${frac(p.n1, p.d1)} ÷ ${frac(p.n2, p.d2)} = ${frac(p.n1, p.d1)} × ${frac(p.d2, p.n2)}.`,
      leap: '분수로 나눌 때 왜 뒤집는지는 새 생각이에요 — 1 ÷ ' + frac(p.n2, p.d2) + ' = ' + frac(p.d2, p.n2) + '(1 안에 몇 번 들어가나)부터 확인해요.',
    };
  },
  // (대분수) ÷ (분수) — 대분수를 가분수로
  '6-2-1:7': (p) => {
    const w = Math.floor(p.n1 / p.d1), r = p.n1 % p.d1, old = mk('F5', { v: 'toImp', w, n: r, d: p.d1 });
    return old && {
      old, idea: '대분수를 가분수로 바꾸기',
      same: `${j(`${w} ${frac(r, p.d1)}`, '을', '를')} 가분수로 바꾸면 ${ye(frac(p.n1, p.d1))}.`,
      change: `그다음은 (분수) ÷ (분수)와 똑같아요: ${frac(p.n1, p.d1)} ÷ ${frac(p.n2, p.d2)}.`,
      leap: null,
    };
  },
};
export const BRIDGE_LESSONS = Object.keys(B);
export const hasBridge = (c) => !!B[c];
export function bridgeOf(c, p) {
  const f = B[c];
  if (!f || !p) return null;
  let b; try { b = f(p); } catch (e) { return null; }
  if (!b || !b.old || !b.old.item) return null;
  // 예전 문제는 지금 차시보다 앞 차시여야 한다
  const ord = (id) => { const L = byId[id], [x, y, z] = L.u.split('-').map(Number); return ((x * 10 + y) * 10 + z) * 100 + L.n; };
  if (ord(b.old.c) >= ord(c)) return null;
  return b;
}
