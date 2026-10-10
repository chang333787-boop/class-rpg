// 6학년 차시 (아이스크림 6-1 · 6-2) — 정의 방법은 docs/LESSONS.md
//   분수의 나눗셈은 개념 가족 F16~F21, 비와 비율·비례식은 R2~R10을 차시마다 나눠 쓴다(gen으로 유형을 좁히고 is로 가른다).
//   소수의 나눗셈과 '쓰이는 경우' 문제는 새 가족(g6_)이다.
import { divKind } from './ops.js';
import { nums, frac, pick, fx, fb, B, F, gcd } from '../concepts/kit.js';
import { near, fmt, lcm, eqv, simp, div as fdiv } from '../math.js';
import { toText } from '../tokens.js';
import FRACS from '../concepts/frac.js';
import RATIOS from '../concepts/ratio.js';

const C = Object.fromEntries([...FRACS, ...RATIOS].map((c) => [c.id, c]));

// 조건에 맞는 params가 나올 때까지 다시 뽑기 (무한 반복 방지)
const until = (r, make, ok, tries = 800) => { for (let i = 0; i < tries; i++) { const p = make(r); if (ok(p)) return p; } throw new Error('gen: 조건에 맞는 수를 못 찾음'); };

// ── 다른 학년 가족으로 가는 단계 (그 가족을 쓰는 차시로 저절로 간다)
const ext = (c, p, why) => ({ c, p, why });
const alt = (step, fallback) => (step ? [step] : fallback);

// ── 글 도우미 — 수(글자)의 마지막 숫자 읽기로 조사를 고른다 (2.6 → '육')
const NB = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
const pn = (s, withB, noB) => (NB[Number(String(s).slice(-1))] ? withB : noB);
const jn = (s, withB, noB) => `${s}${pn(s, withB, noB)}`;
const ron = (s) => { const d = Number(String(s).slice(-1)); return `${s}${NB[d] && d !== 1 && d !== 7 && d !== 8 ? '으로' : '로'}`; };
const bat = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
const jw = (w, withB, noB) => `${w}${bat(w) ? withB : noB}`;

// ── 소수 도우미 — 소수는 정수 a와 소수 자리 수 k로 들고 다닌다 (6.39 = {a: 639, k: 2})
const T = (k) => 10 ** k;
const r6 = (x) => Number(Number(x).toFixed(6));
const ds = (a, k) => fmt(a / T(k));
const norm = (a, k) => k === 0 || a % 10 !== 0; // 끝자리 0 없는 소수
// a ÷ b가 나누어떨어지려면 0을 몇 개 내려야 하나 (몫이 끝나지 않으면 -1)
const extra = (a, b) => { for (let m = 0; m <= 4; m++) if ((a * T(m)) % b === 0) return m; return -1; };
const quot = (a, k, b) => r6(a / b / T(k));
// 높은 자리부터 나눌 때 첫 몫 뒤로 나머지가 생기지 않는가 (각 자리에서 나누어떨어짐)
function noCarry(a, b) {
  let cur = 0, on = false;
  for (const ch of String(a)) {
    cur = cur * 10 + Number(ch);
    if (!on && cur < b) continue;
    on = true;
    if (cur % b) return false;
    cur = 0;
  }
  return true;
}
// (소수)÷(자연수)·(자연수)÷(자연수) {a, k, b} → 6-1-3 차시
function ddivKind(p) {
  if (!p || !Number.isInteger(p.a) || !Number.isInteger(p.b) || p.b < 2 || !norm(p.a, p.k)) return null;
  const { a, k, b } = p, m = extra(a, b);
  if (m < 0) return null;
  if (k === 0) return m > 0 ? '6-1-3:7' : null;
  const qi = (a * T(m)) / b, qp = k + m, tenths = Math.floor(qi / T(qp - 1)) % 10;
  if (qp >= 2 && tenths === 0) return '6-1-3:6';
  if (m > 0) return '6-1-3:5';
  if (a < b * T(k)) return '6-1-3:4';
  return noCarry(a, b) ? '6-1-3:2' : '6-1-3:3';
}
// (소수)÷(소수)·(자연수)÷(소수) {a, ka, b, kb} → 6-2-2 차시
function ddiv2Kind(p) {
  if (!p || !Number.isInteger(p.a) || !Number.isInteger(p.b) || !norm(p.a, p.ka) || !norm(p.b, p.kb)) return null;
  if (p.ka === 0 && p.kb >= 1) return '6-2-2:5';
  if (p.ka === 1 && p.kb === 1) return '6-2-2:2';
  if (p.ka === 2 && p.kb === 2) return '6-2-2:3';
  if (p.ka === 2 && p.kb === 1) return '6-2-2:4';
  return null;
}
const q2 = (p) => r6((p.a * T(p.kb)) / (p.b * T(p.ka)));

// ── 비례식 도우미 — a : b = c : d 에서 pos번째 항이 □
const propAns = (p) => [p.a, p.b, p.c, p.d][p.pos];

// 물건 이름 (할인율) · 물건과 세는 말 (비례식 활용)
const ITEMS = ['필통', '운동화', '가방', '모자', '책'];
const BUY = [['사탕', '개'], ['공책', '권'], ['연필', '자루'], ['지우개', '개']];
const a2n = (a, k) => r6(a / T(k));

// 몫을 q자리에서 반올림 (정수로만 계산 — 0.5 경계 오차 없음)
function roundQ(p, q) {
  const num = p.a * T(p.kb), den = p.b * T(p.ka);
  const t = Math.floor((num * T(q)) / den), nd = Math.floor((num * T(q + 1)) / den) % 10;
  return r6((t + (nd >= 5 ? 1 : 0)) / T(q));
}

// ── 새 문항 가족
const FAMS = [
  {
    id: 'g6_FDIVMUL', s: 'F', sec: 35,
    tip: '3/5 ÷ 2를 띠 그림으로 "3/5을 둘로 똑같이 나눈 하나 = 3/5의 1/2"로 보여 주고, ÷ 2와 × 1/2의 결과가 같음을 나란히 써요.',
    // n/d ÷ k = n/d × 1/□ = □/□
    make: (p) => {
      const { n, d, k } = p, ans = simp(F(n, d * k));
      const prompt = [fx(n, d), ` ÷ ${k} = `, fx(n, d), ' × ', { f: [1, B(0)] }, ' = ', fb(1, 2)];
      const sol = [k, ans.n, ans.d];
      return {
        prompt, sol, ans: toText(prompt, sol),
        check(v) {
          if (v.slice(0, 3).some((x) => !Number.isInteger(x)) || !v[2]) return { ok: false };
          const res = F(v[1], v[2]), resOk = eqv(res, ans);
          if (v[0] === k && resOk) return { ok: true };
          if (eqv(res, F(n * k, d))) return { ok: false, bug: { name: '자연수를 그대로 곱함', to: '6-1-1:4' } };
          if (v[0] === k && eqv(res, F(n, d))) return { ok: false, bug: { name: '분모끼리 곱하지 않음', to: '5-2-2:6' } };
          if (v[0] === k) return { ok: false, bug: { name: '분수의 곱셈에서 틀림', to: '5-2-2:6' } };
          return { ok: false, bug: { name: '÷ 자연수를 × 1/자연수로 바꾸지 못함', to: null } };
        },
      };
    },
    steps: (p) => [
      { c: 'F16', p: { v: 'small', a: 1, b: p.k }, why: `÷ ${jn(p.k, '은', '는')} × 1/${p.k}과 같아요. 1 ÷ ${jn(p.k, '은', '는')} 얼마인가요?` },
      ...alt(ext('F15', { n1: p.n, d1: p.d, n2: 1, d2: p.k }, `${p.n}/${p.d} × 1/${p.k}${pn(1, '을', '를')} 계산해요.`),
        [{ c: 'MUL', p: { a: p.d, b: p.k }, why: `분자는 그대로, 분모끼리 곱해요: ${p.d} × ${p.k}` }]),
    ],
  },
  {
    id: 'g6_DDIV', s: 'DEC', sec: 30,
    tip: '먼저 소수점을 떼고 자연수의 나눗셈을 한 뒤, "나뉠 수가 1/10(1/100)이면 몫도 1/10(1/100)"로 소수점을 찍어요. 세로셈에서는 몫의 소수점을 나뉠 수의 소수점 바로 위에 찍고, 어림으로 크기를 확인하게 해요.',
    // {a, k, b}: (a/10^k) ÷ b — k = 0이면 (자연수)÷(자연수)의 몫을 소수로
    make: (p) => {
      const { a, k, b } = p, D = ds(a, k), Q = quot(a, k, b), kind = ddivKind(p), m = extra(a, b);
      const qs = fmt(Q), bugs = [];
      if (m > 0) {
        const tr = r6(Math.floor(Q * T(k) + 1e-9) / T(k));
        bugs.push({ test: (v) => near(v[0], tr), name: k === 0 ? '몫을 자연수까지만 구함' : '소수점 아래 0을 내려 계산하지 않음', to: kind === '6-1-3:5' || kind === '6-1-3:7' ? null : '6-1-3:5' });
      }
      if (/\.0\d/.test(qs)) bugs.push({ test: (v) => near(v[0], Number(qs.replace('.0', '.'))), name: '몫의 소수 첫째 자리에 0을 쓰지 않음', to: '3-2-2:9' });
      if (k === 0 && a > b) {
        const q = Math.floor(a / b), rem = a % b;
        if (rem < 10 && !near(q + rem / 10, Q)) bugs.push({ test: (v) => near(v[0], q + rem / 10), name: '나머지를 소수 부분에 그대로 씀', to: '3-2-2:6' });
      }
      bugs.push({ test: (v) => [-2, -1, 1, 2, 3].some((j) => near(v[0], r6(Q * 10 ** j))), name: '몫의 소수점 위치가 틀림', to: '4-2-3:7' });
      const prompt = k === 0 ? [`${a} ÷ ${b}의 몫을 소수로 나타내면 `, B(0)] : [`${D} ÷ ${b} = `, B(0)];
      return nums(prompt, Q, { noFrac: true, bugs });
    },
    steps: (p) => {
      const { a, k, b } = p, m = extra(a, b), A = a * T(m), D = ds(a, k), out = [];
      if (k === 0 && a > b) out.push({ c: 'DIV', p: { a, b }, why: `먼저 ${a} ÷ ${b}의 몫과 나머지를 구해요.` });
      const why = k === 0
        ? `${jn(a, '을', '를')} ${ron(a.toFixed(m))} 보고 소수점을 떼면 ${A} ÷ ${jn(b, '과', '와')} 같은 숫자가 나와요.`
        : m > 0
          ? `${D} 뒤에 0을 ${m}개 내려 쓰고 소수점을 떼면 ${A} ÷ ${jn(b, '이에요', '예요')}.`
          : `소수점을 떼고 자연수의 나눗셈 ${A} ÷ ${jn(b, '을', '를')} 해요.`;
      out.push({ c: 'DIV', p: { a: A, b }, why });
      // 소수점 찍기는 4학년 '소수 사이의 관계'(1/10 · 1/100)로 — 뒤 차시(6-1-3:8 어림)로 보내지 않는다
      const Qi = A / b, qp = k + m, why2 = `${D}${pn(D, '은', '는')} ${A}의 1/${T(qp)}이니까 몫도 ${Qi}의 1/${T(qp)}이에요.`;
      if (qp === 1) out.push(ext('DEC4', { v: 'd10', k: Qi * 100 }, why2));
      else if (qp === 2) out.push({ c: '4-2-3:7', p: { v: 'd100', m: Qi * 10 }, why: why2 });
      else out.push(ext('DEC4', { v: 'd10', k: Qi }, `${why2} ${Qi}의 1/1000은 ${fmt(Qi / 100)}의 1/10이에요.`));
      return out;
    },
  },
  {
    id: 'g6_DPOINT', s: 'DEC', sec: 20,
    tip: '나뉠 수를 가까운 자연수로 어림해 몫이 몇쯤인지 먼저 말하게 해요(13.8 ÷ 6 → 14 ÷ 6 → 2쯤). 숫자 배열은 자연수의 나눗셈과 같고 소수점 위치만 어림으로 정한다는 것을 보여 줘요.',
    // {a, k, b, w}: 자연수 나눗셈 결과를 주고 소수점 위치를 고른다 (w = 보기 묶음)
    make: (p) => {
      const { a, k, b } = p, m = extra(a, b), A = a * T(m), Q = quot(a, k, b);
      const exps = [[-2, -1, 0], [-1, 0, 1], [0, 1, 2]][((p.w || 0) % 3 + 3) % 3];
      const ch = exps.map((e) => [fmt(r6(Q * 10 ** e))]);
      const bugs = {};
      exps.forEach((e, i) => { if (e) bugs[i] = { name: e > 0 ? '몫을 너무 크게 어림함' : '몫을 너무 작게 어림함', to: '4-2-3:7' }; });
      return pick([`${A} ÷ ${b} = ${jn(A / b, '이에요.', '예요.')}`, { br: 1 }, `${ds(a, k)} ÷ ${b}의 몫을 어림해 보고, 소수점을 바르게 찍은 것을 고르세요.`], ch, exps.indexOf(0), { bugs });
    },
    steps: (p) => {
      const D = a2n(p.a, p.k), Dr = Math.round(D);
      return Dr >= p.b && Dr !== D ? [{ c: 'DIV', p: { a: Dr, b: p.b }, why: `${ds(p.a, p.k)}${pn(ds(p.a, p.k), '을', '를')} 어림하면 ${Dr}. ${Dr} ÷ ${p.b}의 몫으로 크기를 짐작해요.` }] : [];
    },
  },
  {
    id: 'g6_RATEUSE', s: 'R', sec: 25,
    tip: '"무엇에 대한" 비율인지 문장에서 기준량을 먼저 찾게 해요. 빠르기(걸린 시간에 대한 거리)·인구 밀도(넓이에 대한 인구)·타율처럼 기준량이 다른 것끼리 비교할 때 비율이 필요하다는 것을 보여 줘요.',
    // {c: 0 빠르기 · 1 인구 밀도 · 2 타율 · 3 섞기, a: 비교하는 양, b: 기준량}
    make: (p) => {
      const { a, b } = p, ans = r6(a / b);
      const prompt = [
        [`자동차가 ${b}시간 동안 ${a} km를 달렸어요. 걸린 시간에 대한 달린 거리의 비율은 `, B(0)],
        [`넓이가 ${b} km²인 마을에 ${a}명이 살아요. 넓이에 대한 인구의 비율은 `, B(0)],
        [`어떤 타자가 ${b}타수 중에서 안타를 ${a}개 쳤어요. 타수에 대한 안타 수의 비율을 소수로 나타내면 `, B(0)],
        [`매실 원액 ${a} mL를 물 ${b} mL에 섞었어요. 물의 양에 대한 매실 원액의 양의 비율을 소수로 나타내면 `, B(0)],
      ][p.c];
      return nums(prompt, ans, {
        noFrac: p.c >= 2,
        bugs: [
          { test: (v) => near(v[0], b / a), name: '기준량과 비교하는 양을 바꿈', to: '6-1-4:3' },
          { test: (v) => p.c >= 2 && near(v[0], (a * 100) / b), name: '백분율로 씀', to: '6-1-4:4' },
        ],
      });
    },
    steps: (p) => [
      { c: 'R3', p: { v: 'base', a: p.a, b: p.b }, why: `비로 나타내면 ${p.a} : ${jn(p.b, '이에요', '예요')}. 기준량은 무엇인가요?` },
      p.c < 2
        ? { c: 'DIV', p: { a: p.a, b: p.b }, why: '비율 = 비교하는 양 ÷ 기준량' }
        : { c: 'R4', p: { v: 'dec', a: p.a, b: p.b }, why: '비율을 소수로 나타내요.' },
    ],
  },
  {
    id: 'g6_PCTUSE', s: 'R', sec: 35,
    tip: '할인율은 "원래 가격에 대한 할인 금액", 진하기는 "소금물 전체에 대한 소금"처럼 기준량을 말로 먼저 정하게 해요. 물의 양을 기준량으로 잡는 실수가 많아요.',
    // {c: 'sale'|'vote'|'salt'|'salt2', x: 기준량(원래 가격·전체 표·소금물), y: (산 값·얻은 표·소금), i: 물건}
    make: (p) => {
      const { x, y } = p, base = p.c === 'sale' ? x - y : y, ans = (base * 100) / x;
      let prompt;
      if (p.c === 'sale') { const it = ITEMS[p.i % ITEMS.length]; prompt = [`${x}원짜리 ${jw(it, '을', '를')} ${y}원에 샀어요. 할인율은 `, B(0), '%예요.']; }
      else if (p.c === 'vote') prompt = [`${x >= 100 ? '전교 회장' : '반장'} 선거에서 전체 ${x}표 중 ${y}표를 얻었어요. 득표율은 `, B(0), '%예요.'];
      else if (p.c === 'salt') prompt = [`소금 ${y} g을 녹여 소금물 ${x} g을 만들었어요. 소금물의 진하기는 `, B(0), '%예요.'];
      else prompt = [`물 ${x - y} g에 소금 ${y} g을 녹였어요. 소금물의 진하기는 `, B(0), '%예요.'];
      const bugs = [{ test: (v) => near(v[0], base / x), name: '100을 곱하지 않음', to: '6-1-4:6' }];
      if (p.c === 'sale') bugs.push({ test: (v) => near(v[0], (y * 100) / x), name: '낸 금액의 비율을 구함 (할인된 금액이 비교하는 양)', to: '6-1-4:3' }, { test: (v) => near(v[0], x - y), name: '할인된 금액을 그대로 씀', to: '6-1-4:6' });
      else bugs.push({ test: (v) => near(v[0], y) && y !== ans, name: '비교하는 양을 그대로 씀', to: '6-1-4:6' });
      if (p.c === 'salt2') bugs.push({ test: (v) => near(v[0], (y * 100) / (x - y)), name: '물의 양을 기준량으로 봄 (소금물 전체가 기준량)', to: '6-1-4:3' });
      return nums(prompt, ans, { bugs });
    },
    steps: (p) => {
      const { x, y } = p, base = p.c === 'sale' ? x - y : y, g = gcd(base, x);
      const den = p.c === 'sale' ? '원래 가격' : p.c === 'vote' ? '전체 표' : '소금물';
      const pct = { c: 'R5', p: { v: 'frac', n: base / g, d: x / g }, why: `${p.c === 'sale' ? '할인된 금액' : p.c === 'vote' ? '얻은 표' : '소금'} ÷ ${jw(den, '을', '를')} 백분율로 나타내요.` };
      if (p.c === 'sale') return [{ c: 'SUB', p: { a: x, b: y }, why: '할인된 금액을 구해요.' }, pct];
      if (p.c === 'salt2') return [{ c: 'ADD', p: { a: x - y, b: y }, why: '소금물의 무게 = 물 + 소금' }, pct];
      return [pct];
    },
  },
  {
    id: 'g6_DDIV2', s: 'DEC', sec: 30,
    tip: '나누는 수와 나뉠 수에 같은 수(10, 100)를 곱해도 몫은 같다는 것을 자연수 예(6 ÷ 2 = 60 ÷ 20)로 먼저 보여 줘요. 나누는 수가 자연수가 되도록 두 수의 소수점을 같은 자리만큼 옮겨요.',
    // {a, ka, b, kb}: (a/10^ka) ÷ (b/10^kb)
    make: (p) => {
      const D = ds(p.a, p.ka), E = ds(p.b, p.kb), Q = q2(p), kind = ddiv2Kind(p);
      return nums([`${D} ÷ ${E} = `, B(0)], Q, {
        noFrac: true,
        bugs: [
          { test: (v) => [1, 2].some((j) => near(v[0], r6(Q / 10 ** j))), name: '나누는 수만 자연수로 바꾸고 나뉠 수는 그대로 둠', to: kind === '6-2-2:2' ? '4-2-3:7' : '6-2-2:2' },
          { test: (v) => [1, 2].some((j) => near(v[0], r6(Q * 10 ** j))), name: '몫의 소수점 위치가 틀림', to: '6-1-3:8' },
        ],
      });
    },
    steps: (p) => {
      const { a, ka, b, kb } = p, s = T(kb), E = ds(b, kb), out = [];
      out.push(ext('DEC4', { v: kb === 1 ? 'x10' : 'x100', k: kb === 1 ? b * 10 : b }, `나누는 수 ${jn(E, '을', '를')} 자연수로 만들려면 ${s}배 해요.`));
      if (ka <= kb) {
        const A = a * T(kb - ka);
        out.push(A % b === 0
          ? { c: 'DIV', p: { a: A, b }, why: `나뉠 수도 ${s}배 하면 ${A} ÷ ${jn(b, '과', '와')} 몫이 같아요.` }
          : { c: 'g6_DDIV', p: { a: A, k: 0, b }, why: `나뉠 수도 ${s}배 하면 ${A} ÷ ${jn(b, '과', '와')} 몫이 같아요.` });
      } else out.push({ c: 'g6_DDIV', p: { a, k: ka - kb, b }, why: `나뉠 수도 ${s}배 하면 ${ds(a, ka - kb)} ÷ ${jn(b, '과', '와')} 몫이 같아요.` });
      return out;
    },
  },
  {
    id: 'g6_DROUND', s: 'DEC', sec: 40,
    tip: '나누어떨어지지 않는 몫은 구하려는 자리보다 한 자리 더 구한 다음 반올림해요. 계산기로 2 ÷ 3을 해 보면 끝없이 이어진다는 것도 보여 줘요.',
    // {a, ka, b, kb, pl}: 몫을 반올림하여 pl자리까지 (0 자연수 · 1 소수 첫째 · 2 소수 둘째)
    make: (p) => {
      const R = roundQ(p, p.pl), D = ds(p.a, p.ka), E = ds(p.b, p.kb);
      const num = p.a * T(p.kb), den = p.b * T(p.ka), t = Math.floor((num * T(p.pl)) / den);
      const tr = r6(t / T(p.pl)), up = r6((t + 1) / T(p.pl));
      const bugs = [];
      if (!near(tr, R)) bugs.push({ test: (v) => near(v[0], tr), name: '반올림하지 않고 버림', to: '5-2-1:7' });
      if (!near(up, R)) bugs.push({ test: (v) => near(v[0], up), name: '올림을 함', to: '5-2-1:7' });
      for (const q of [p.pl + 1, p.pl - 1]) if (q >= 0 && q <= 3) { const w = roundQ(p, q); if (!near(w, R)) bugs.push({ test: (v) => near(v[0], w), name: '반올림할 자리를 잘못 봄', to: '5-2-1:7' }); }
      return nums([`${D} ÷ ${E}의 몫을 반올림하여 ${['자연수로', '소수 첫째 자리까지', '소수 둘째 자리까지'][p.pl]} 나타내면 `, B(0)], R, { noFrac: true, bugs });
    },
    steps: (p) => {
      const e = p.kb + p.pl + 1 - p.ka, W = p.a * T(e), place = ['소수 첫째 자리', '소수 둘째 자리', '소수 셋째 자리'][p.pl];
      return [{ c: 'DIV', p: { a: W, b: p.b }, why: `몫을 ${place}까지 구하려고 소수점을 떼${e > 0 ? `고 0을 ${e}개 붙이` : ''}면 ${W} ÷ ${jn(p.b, '이에요', '예요')}. 이 몫에 소수점을 찍은 다음 반올림해요.` }];
    },
  },
  {
    id: 'g6_DREM', s: 'DEC', sec: 35,
    tip: '나누어 주는 상황(끈 자르기·병에 담기)을 그림으로 그리고, 몫은 자연수까지만 구한다는 것과 남는 양의 소수점은 나뉠 수의 소수점 위치를 따른다는 것을 확인해요. 남는 양 + 나누어 준 양 = 처음 양으로 검산해요.',
    // {a, b, c}: (a/10) ÷ b — 몫은 자연수, 남는 양은 소수
    make: (p) => {
      const D = ds(p.a, 1), Q = Math.floor(p.a / (10 * p.b)), R = r6(p.a / 10 - Q * p.b);
      const prompt = [
        [`끈 ${D} m를 ${p.b} m씩 자르면 `, B(0), '도막이 되고 ', B(1), ' m가 남아요.'],
        [`물 ${D} L를 한 병에 ${p.b} L씩 나누어 담으면 `, B(0), '병이 되고 ', B(1), ' L가 남아요.'],
        [`설탕 ${D} kg을 한 봉지에 ${p.b} kg씩 나누어 담으면 `, B(0), '봉지가 되고 ', B(1), ' kg이 남아요.'],
        [`${D} ÷ ${p.b}에서 몫을 자연수까지만 구하면 몫은 `, B(0), ', 남는 양은 ', B(1)],
      ][p.c];
      return nums(prompt, [Q, R], {
        noFrac: true,
        bugs: [
          { test: (v) => !Number.isInteger(v[0]), name: '몫을 소수까지 계산함 (몫은 자연수까지만)', to: null },
          { test: (v) => v[0] === Math.floor(p.a / p.b) && v[1] === p.a % p.b, name: '소수점을 떼고 나눈 몫과 나머지를 씀', to: '6-1-3:3' },
          { test: (v) => v[0] === Q && near(v[1], R * 10), name: '남는 양의 소수점을 빠뜨림', to: '4-2-3:7' },
          { test: (v) => v[0] === Q - 1 && near(v[1], R + p.b), name: '남는 양이 나누는 수보다 큼', to: '3-2-2:6' },
        ],
      });
    },
    steps: (p) => {
      const W = Math.floor(p.a / 10), Q = Math.floor(p.a / (10 * p.b));
      return [
        { c: 'DIV', p: { a: W, b: p.b }, why: `자연수 부분으로 몫을 구해요: ${W} ÷ ${p.b}` },
        { c: 'MUL', p: { a: p.b, b: Q }, why: `${p.b}씩 ${Q}번 나누어 준 양은 ${p.b} × ${jn(Q, '이에요', '예요')}.` },
        { c: 'g4_DECAS', p: { op: '-', a: p.a, ka: 1, b: Q * p.b * 10, kb: 1 }, why: `남는 양 = 처음 양 − 나누어 준 양이에요: ${ds(p.a, 1)} − ${Q * p.b}` },
      ];
    },
  },
  {
    id: 'g6_PROPUSE', s: 'R', sec: 40,
    tip: '알고 있는 두 양과 구하려는 두 양을 같은 순서로 비로 쓰게 해요(개수 : 값 = 개수 : 값). 비례식을 세운 뒤 비의 성질과 외항·내항의 곱 중 편한 방법으로 풀어요.',
    // {ctx: 0 물건값 · 1 빠르기 · 2 섞기 · 3 지도, a : b = c : d (d를 구함), i: 물건}
    make: (p) => {
      const { a, b, c, d } = p;
      let prompt;
      if (p.ctx === 0) { const [it, u] = BUY[p.i % BUY.length]; prompt = [`${it} ${a}${u}에 ${b}원이에요. 같은 ${it} ${c}${jw(u, '은', '는')} `, B(0), '원이에요.']; }
      else if (p.ctx === 1) prompt = [`자동차가 ${a}시간 동안 ${b} km를 달렸어요. 같은 빠르기로 ${c}시간 동안 달리면 `, B(0), ' km를 갈 수 있어요.'];
      else if (p.ctx === 2) prompt = [`물과 매실 원액을 ${a} : ${ron(b)} 섞어요. 물을 ${c} mL 넣으면 매실 원액은 `, B(0), ' mL 넣어야 해요.'];
      else prompt = [`지도에서 ${a} cm는 실제 거리 ${b} m예요. 지도에서 ${c} cm는 실제 거리 `, B(0), ' m예요.'];
      const add = b + (c - a);
      return nums(prompt, d, {
        bugs: [
          { test: (v) => add > 0 && v[0] === add, name: '같은 수를 더함 (덧셈으로 지키기)', to: '6-2-4:2' },
          { test: (v) => v[0] === b * c, name: '곱하기만 하고 나누지 않음', to: '6-2-4:5' },
        ],
      });
    },
    steps: (p) => [{ c: '6-2-4:5', p: { v: 'x', a: p.a, b: p.b, c: p.c, d: p.d, pos: 3 }, why: `비례식을 세우면 ${p.a} : ${p.b} = ${p.c} : □예요.` }],
  },
];

// ── (분수)÷(자연수) 문항 — 답 글은 기약분수로 (크기가 같으면 정답)
const fdivNat = (lead, p, more = []) => frac([...lead, ` ÷ ${p.k} = `, fb(0, 1)], simp(F(p.n, p.d * p.k)), {
  bugs: [
    ...more,
    { test: (v) => v[0] === p.n && v[1] * p.k === p.d, name: '분모를 나눔', to: '5-1-4:3' },
    { test: (v) => v[1] && eqv(F(v[0], v[1]), F(p.n * p.k, p.d)), name: '곱해 버림', to: '3-1-3:2' },
  ],
});

// 개념 가족 문항의 오답 방향만 바꾼다 (채점은 그대로) — { 오답 이름: 새 방향 }
const remapBugs = (it, map) => {
  const check = it.check;
  it.check = (v, r) => { const res = check.call(it, v, r); if (res && res.bug && res.bug.name in map) return { ...res, bug: { ...res.bug, to: map[res.bug.name] } }; return res; };
  return it;
};

// ── 단계 도우미 (분수의 나눗셈)
const f16 = (a, b, why) => ({ c: 'F16', p: { v: a < b ? 'small' : 'big', a, b }, why });

export default {
  FAMS,
  LESSONS: [
    // ── 6-1-1 분수의 나눗셈
    {
      id: '6-1-1:2', fam: 'F16', name: '몫을 분수로 (1보다 작은 몫)', kid: '나눗셈의 몫을 분수로 (1보다 작을 때)', sec: 12,
      gen: (r) => { let a, b; do { b = r.int(2, 9); a = r.int(1, b - 1); } while (gcd(a, b) !== 1); return { v: 'small', a, b }; },
      is: (p) => p.v === 'small' && p.a < p.b, prev: null, pre: ['3-1-6:5', '3-1-3:2'],
      steps: (p) => [p.a > 1 ? ext('F3', { v: 'build', n: p.a, d: p.b }, `1 ÷ ${p.b} = 1/${p.b}이에요. ${p.a} ÷ ${jn(p.b, '은', '는')} 1/${p.b}이 ${p.a}개예요.`) : null],
      hint: '1 ÷ 3은 1을 3으로 똑같이 나눈 하나라서 1/3이에요. 2 ÷ 3은 1/3이 2개라서 2/3!',
    },
    {
      id: '6-1-1:3', fam: 'F16', name: '몫을 분수로 (1보다 큰 몫)', kid: '나눗셈의 몫을 분수로 (1보다 클 때)', sec: 18,
      gen: (r) => { let a, b; do { b = r.int(2, 9); a = r.int(b + 1, 4 * b); } while (a % b === 0); return { v: 'big', a, b }; },
      is: (p) => p.v === 'big' && p.a > p.b && p.a % p.b !== 0, prev: '6-1-1:2', pre: ['3-2-4:5', '3-2-4:6', '3-2-2:6'],
      steps: (p) => [
        { c: 'DIV', p: { a: p.a, b: p.b }, why: `${p.a} ÷ ${p.b}의 몫과 나머지를 구해요.` },
        ext('F5', { v: 'toImp', w: Math.floor(p.a / p.b), n: p.a % p.b, d: p.b }, `나머지 ${p.a % p.b}까지 똑같이 나누면 몫은 ${jn(Math.floor(p.a / p.b), '과', '와')} ${p.a % p.b}/${p.b}${pn(p.a % p.b, '이에요', '예요')}. 가분수로 바꿔 봐요.`),
      ],
      hint: '5 ÷ 3은 1/3이 5개예요. 그래서 몫은 5/3! 대분수로 쓰면 1 2/3!',
      tip: '5 ÷ 3 = 5/3: "1 ÷ 3 = 1/3"이 5개라는 것을 피자 그림으로 보여 줘요. 몫 1, 나머지 2에서 나머지 2도 3으로 나누면 2/3라서 1 2/3로도 쓸 수 있어요.',
    },
    {
      id: '6-1-1:4', fam: 'F17', name: '(분수)÷(자연수)', kid: '분수 ÷ 자연수', sec: 25,
      gen: (r) => until(r, (r) => {
        const k = r.int(2, 4);
        if (r.chance(0.2)) { const d = r.int(2, 7); return { d, k, n: r.int(d + 1, 2 * d - 1) }; } // 가분수
        if (r.chance(0.5)) return { d: r.int(4, 9), k, n: k * r.int(1, 3) }; // 분자가 나누어떨어짐
        const d = r.int(3, 9); return { d, k, n: r.int(1, d - 1) };
      }, (p) => gcd(p.n, p.d) === 1 && p.n < 2 * p.d),
      is: (p) => !p.mix, prev: '6-1-1:2', pre: ['5-1-4:3'],
      make: (p) => fdivNat([fx(p.n, p.d)], p),
      steps: (p) => (p.n % p.k === 0
        ? [{ c: 'DIV', p: { a: p.n, b: p.k }, why: `분자 ${p.n}${pn(p.n, '을', '를')} ${ron(p.k)} 나눠요. 분모는 그대로예요.` }]
        : [
          ext('F7', { v: 'up', n: p.n, d: p.d, k: p.k }, `분자가 ${ron(p.k)} 나누어떨어지게 크기가 같은 분수로 바꿔요.`),
          { c: 'DIV', p: { a: p.n * p.k, b: p.k }, why: `${p.n}/${p.d} = ${p.n * p.k}/${p.d * p.k}${pn(p.n * p.k, '이니까', '니까')} 분자 ${p.n * p.k}${pn(p.n * p.k, '을', '를')} ${ron(p.k)} 나눠요.` },
        ]),
      hint: '분자가 나누어떨어지면 분자만 나눠요: 4/5 ÷ 2 = 2/5. 안 되면 크기가 같은 분수로 바꿔요: 3/5 ÷ 2 = 6/10 ÷ 2 = 3/10.',
      tip: '3/4 ÷ 2를 띠 그림으로 나눠 봐요. 분자 3이 2로 나누어떨어지지 않으면 크기가 같은 분수 6/8으로 바꿔 분자를 나눠요(6/8 ÷ 2 = 3/8). 분모를 나누는 실수(3/4 ÷ 2 = 3/2)는 그림으로 크기를 비교해 짚어 줘요.',
    },
    {
      id: '6-1-1:5', fam: 'g6_FDIVMUL', name: '(분수)÷(자연수)를 곱셈으로', kid: '÷ 자연수를 × 1/자연수로', sec: 35,
      gen: (r) => until(r, (r) => { const d = r.int(2, 9); return { n: r.chance(0.2) ? r.int(d + 1, 2 * d - 1) : r.int(1, d - 1), d, k: r.int(2, 6) }; }, (p) => gcd(p.n, p.d) === 1),
      is: (p) => p.n > 0 && p.d > 1 && p.k > 1, prev: '6-1-1:4', pre: ['5-2-2:6'],
      hint: '÷ 2는 1/2을 곱하는 것과 같아요. 3/5 ÷ 2 = 3/5 × 1/2 = 3/10!',
      bridge: '"÷ 자연수 = × 1/자연수"를 띠 그림으로 확인하는 것이 이 차시의 새 생각이에요.',
    },
    {
      id: '6-1-1:6', fam: 'F17', name: '(대분수)÷(자연수)', kid: '대분수 ÷ 자연수', sec: 35,
      gen: (r) => until(r, (r) => { const w = r.int(1, 3), d = r.int(2, 7), x = r.int(1, d - 1), k = r.int(2, 5), n = w * d + x; return { v: n % k ? 'eq' : 'div', n, d, k, mix: true }; }, (p) => gcd(p.n % p.d, p.d) === 1),
      is: (p) => !!p.mix && p.n > p.d && p.n % p.d !== 0, prev: '6-1-1:4', pre: ['3-2-4:6'],
      make: (p) => {
        const w = Math.floor(p.n / p.d), x = p.n % p.d, k = p.k, d = p.d;
        return fdivNat([{ m: [w, x, d] }], p, [
          { test: (v) => v[1] && eqv(F(v[0], v[1]), F(w * k * d + x, d * k)), name: '분수 부분만 나눔 (대분수를 가분수로 바꾸지 않음)', to: '3-2-4:6' },
          { test: (v) => v[1] && eqv(F(v[0], v[1]), F(w * d + x * k, d * k)), name: '자연수 부분만 나눔 (대분수를 가분수로 바꾸지 않음)', to: '3-2-4:6' },
        ]);
      },
      steps: (p) => [
        ext('F5', { v: 'toImp', w: Math.floor(p.n / p.d), n: p.n % p.d, d: p.d }, '대분수를 가분수로 바꿔요.'),
        { c: '6-1-1:4', p: { v: p.n % p.k ? 'eq' : 'div', n: p.n, d: p.d, k: p.k }, why: `${p.n}/${p.d} ÷ ${jn(p.k, '을', '를')} 계산해요.` },
      ],
      hint: '먼저 대분수를 가분수로 바꿔요. 2 2/5 ÷ 3 = 12/5 ÷ 3 = 4/5!',
      tip: '대분수를 가분수로 바꾼 뒤 (분수)÷(자연수)로 계산해요. 자연수 부분이나 분수 부분만 나누는 실수가 많으니, 2 2/5 ÷ 3을 띠 그림 세 묶음으로 나눠 보게 해요.',
    },

    // ── 6-1-3 소수의 나눗셈 (6-1)
    {
      id: '6-1-3:2', fam: 'g6_DDIV', name: '소수÷자연수 (각 자리 나누어떨어짐)', kid: '소수 ÷ 자연수 (자리마다 나누어떨어질 때)', sec: 20,
      gen: (r) => until(r, (r) => {
        const b = r.pick([2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9]), k = r.pick([1, 2, 2]), lim = Math.max(1, Math.floor(9 / b));
        let qi = r.int(1, 9); for (let i = 0; i < k; i++) qi = qi * 10 + r.int(1, lim);
        return { a: qi * b, k, b };
      }, (p) => ddivKind(p) === '6-1-3:2'),
      is: (p) => ddivKind(p) === '6-1-3:2', prev: null, pre: (p) => [p ? divKind(p.a, p.b) : '3-2-2:9', '4-2-3:7'],
      hint: '자연수의 나눗셈처럼 하고 몫의 소수점은 나뉠 수의 소수점 바로 위에 찍어요. 639 ÷ 3 = 213이니까 6.39 ÷ 3 = 2.13!',
    },
    {
      id: '6-1-3:3', fam: 'g6_DDIV', name: '소수÷자연수 (나누어떨어지지 않음)', kid: '소수 ÷ 자연수 (세로셈)', sec: 30,
      gen: (r) => until(r, (r) => { const b = r.int(2, 9), k = r.pick([1, 2, 2]); return { a: r.int(T(k) + 1, T(k) * (r.chance(0.8) ? 10 : 30) - 1) * b, k, b }; },
        (p) => ddivKind(p) === '6-1-3:3' && p.a < T(p.k + 2)),
      is: (p) => ddivKind(p) === '6-1-3:3', prev: '6-1-3:2', pre: (p) => [p ? divKind(p.a, p.b) : '3-2-2:9'],
      hint: '세로로 써서 자연수처럼 나누고, 몫의 소수점은 나뉠 수의 소수점 바로 위에 찍어요. 7.44 ÷ 3 = 2.48!',
    },
    {
      id: '6-1-3:4', fam: 'g6_DDIV', name: '소수÷자연수 (몫이 1보다 작음)', kid: '소수 ÷ 자연수 (몫이 1보다 작을 때)', sec: 30,
      gen: (r) => until(r, (r) => { const b = r.int(2, 9), k = r.pick([1, 2, 2]); return { a: r.int(T(k - 1), T(k) - 1) * b, k, b }; },
        (p) => ddivKind(p) === '6-1-3:4'),
      is: (p) => ddivKind(p) === '6-1-3:4', prev: '6-1-3:3', pre: (p) => [p ? divKind(p.a, p.b) : '3-2-2:9', '4-2-3:2'],
      hint: '나뉠 수가 나누는 수보다 작으면 몫의 일의 자리에 0을 쓰고 소수점을 찍어요. 1.36 ÷ 4 = 0.34!',
    },
    {
      id: '6-1-3:5', fam: 'g6_DDIV', name: '소수÷자연수 (0을 내려 계산)', kid: '소수 ÷ 자연수 (0을 내려서)', sec: 35,
      gen: (r) => until(r, (r) => { const k = r.pick([1, 1, 2]); return { a: k === 1 ? r.int(11, 199) : r.int(101, 999), k, b: r.pick([2, 4, 5, 5, 6, 8]) }; },
        (p) => ddivKind(p) === '6-1-3:5' && p.k + extra(p.a, p.b) <= 3),
      is: (p) => ddivKind(p) === '6-1-3:5', prev: '6-1-3:3', pre: (p) => [p ? divKind(p.a * T(extra(p.a, p.b)), p.b) : '3-2-2:9', '4-2-3:6'],
      hint: '나머지가 남으면 소수점 아래 끝에 0이 있다고 보고 내려 쓰며 계속 나눠요. 6.3 ÷ 5 = 6.30 ÷ 5 = 1.26!',
    },
    {
      id: '6-1-3:6', fam: 'g6_DDIV', name: '소수÷자연수 (몫에 0이 있음)', kid: '소수 ÷ 자연수 (몫의 소수 첫째 자리에 0)', sec: 35,
      gen: (r) => until(r, (r) => {
        const b = r.int(2, 9); let a = (r.int(1, 9) * 100 + r.int(1, 9)) * b, k = 2;
        while (k > 0 && a % 10 === 0) { a /= 10; k--; }
        return { a, k, b };
      }, (p) => ddivKind(p) === '6-1-3:6'),
      is: (p) => ddivKind(p) === '6-1-3:6', prev: '6-1-3:3',
      pre: (p) => [p ? divKind(p.a * T(extra(p.a, p.b)), p.b) : '3-2-2:9', ...(p && extra(p.a, p.b) > 0 ? ['6-1-3:5'] : [])],
      hint: '나눌 수 없는 자리가 나오면 몫에 0을 쓰고 다음 자리를 내려요. 6.24 ÷ 6 = 1.04!',
    },
    {
      id: '6-1-3:7', fam: 'g6_DDIV', name: '자연수÷자연수 몫을 소수로', kid: '나눗셈의 몫을 소수로', sec: 30,
      gen: (r) => until(r, (r) => ({ a: r.int(1, 60), k: 0, b: r.pick([2, 4, 5, 5, 6, 8]) }), (p) => ddivKind(p) === '6-1-3:7' && extra(p.a, p.b) <= 3),
      is: (p) => ddivKind(p) === '6-1-3:7', prev: '6-1-3:5', pre: (p) => [p ? divKind(p.a, p.b) : '3-2-2:6'],
      hint: '7을 7.00으로 보고 0을 내려 쓰며 나눠요. 7 ÷ 4 = 1.75!',
    },
    {
      id: '6-1-3:8', fam: 'g6_DPOINT', name: '어림으로 몫의 소수점 찾기', kid: '어림해서 몫에 소수점 찍기', sec: 20,
      gen: (r) => until(r, (r) => { const k = r.pick([1, 1, 2]); return { a: k === 1 ? r.int(21, 899) : r.int(201, 2999), k, b: r.int(2, 9), w: r.int(0, 2) }; },
        (p) => p.a % 10 !== 0 && extra(p.a, p.b) === 0 && quot(p.a, p.k, p.b) >= 0.1),
      is: (p) => Number.isInteger(p.a) && p.b > 1 && extra(p.a, p.b) >= 0, prev: null, pre: ['4-2-3:7', '5-2-4:8', '5-2-1:7'],
      hint: '나뉠 수를 자연수로 어림해서 몫이 몇쯤인지 먼저 짐작해요. 13.8 ÷ 6은 약 14 ÷ 6이라 2쯤이니까 2.3!',
    },

    // ── 6-1-4 비와 비율
    {
      id: '6-1-4:2', fam: 'R2', name: '두 수 비교 (뺄셈·나눗셈)', kid: '두 수를 차와 몇 배로 비교', sec: 15,
      gen: (r) => {
        const v = r.pick(['int', 'int', 'both', 'both', 'frac']);
        let small, k; do { small = r.int(2, 9); k = r.int(2, 6); } while (v === 'both' && small === 2 && k === 2);
        return { v, big: small * k, small };
      },
      is: (p) => ['int', 'both', 'frac'].includes(p.v) && p.big % p.small === 0,
      prev: null, pre: (p) => (p && p.v === 'frac' ? ['6-1-1:2'] : ['2-1-6:4', '3-1-3:6']),
      make: (p) => (p.v === 'both'
        ? nums([`${jn(p.big, '은', '는')} ${p.small}보다 `, B(0), ` 크고, ${p.small}의 `, B(1), '배예요.'], [p.big - p.small, p.big / p.small], {
          bugs: [
            { test: (v) => v[0] === p.big / p.small && v[1] === p.big - p.small, name: '차와 몇 배를 바꿈', to: null },
            { test: (v) => v[1] === p.big - p.small, name: '몇 배인지를 차이로 구함', to: '2-1-6:4' },
          ],
        })
        : remapBugs(C.R2.make(p), { '기준을 바꿈': '6-1-1:2' })),
      steps: (p) => (p.v === 'frac'
        ? [f16(p.small, p.big, `${p.small} ÷ ${jn(p.big, '을', '를')} 분수로 나타내요.`)]
        : [
          ...(p.v === 'both' ? [{ c: 'SUB', p: { a: p.big, b: p.small }, why: '뺄셈으로 비교하면 차이를 알 수 있어요.' }] : []),
          { c: 'DIV', p: { a: p.big, b: p.small }, why: '나눗셈으로 비교하면 몇 배인지 알 수 있어요.' },
        ]),
      hint: '12와 4를 뺄셈으로 비교하면 12는 4보다 8 커요. 나눗셈으로 비교하면 12는 4의 3배예요.',
    },
    {
      id: '6-1-4:3', fam: 'R3', name: '비 (기준량과 비교하는 양)', kid: '비로 나타내기', sec: 15,
      // 가로·세로로 비 쓰기 · 기준량 찾기 + 비를 읽는 여러 말(5에 대한 3의 비 · 3의 5에 대한 비 · 3과 5의 비)
      gen: (r) => (r.chance(0.35) ? (() => { let a, b; do { a = r.int(2, 12); b = r.int(2, 12); } while (a === b); return { v: 'read', a, b, form: r.int(0, 2) }; })() : C.R3.gen(r)),
      is: (p) => p.v === 'write' || p.v === 'base' || p.v === 'read', prev: '6-1-4:2', pre: [],
      make: (p) => {
        if (p.v === 'write') {
          // 6-1에서는 비를 간단히 하지 않는다 (6에 대한 9의 비 = 9 : 6) — 3 : 2로 쓰면 오답이지만 이름을 붙여 선생님이 알아보게
          const it = C.R3.make(p), check = it.check;
          it.check = (v, r) => { const res = check.call(it, v, r); if (!res.ok && !res.bug && v[0] > 0 && v[1] > 0 && v[0] * p.a === v[1] * p.b) return { ok: false, bug: { name: '비율이 같은 다른 비로 씀 (주어진 수 그대로)', to: null } }; return res; };
          return it;
        }
        if (p.v !== 'read') return C.R3.make(p);
        const { a, b } = p, say = [`${b}에 대한 ${a}의 비`, `${a}의 ${b}에 대한 비`, `${a}${pn(a, '과', '와')} ${b}의 비`][p.form % 3];
        return nums([`${say}는 `, B(0), ' : ', B(1)], [a, b], {
          bugs: [{ test: (v) => v[0] === b && v[1] === a, name: '기준량과 비교하는 양을 바꿈', to: null }],
        });
      },
      hint: '"~에 대한" 쪽이 기준량이고 기호 : 의 오른쪽에 써요. 5에 대한 3의 비는 3 : 5, 3과 5의 비도 3 : 5!',
    },
    {
      id: '6-1-4:4', fam: 'R4', name: '비율 (분수·소수)', kid: '비율을 분수와 소수로', sec: 20,
      gen: (r) => C.R4.gen(r),
      is: (p) => p.v === 'frac' || p.v === 'dec', prev: '6-1-4:3', pre: ['6-1-1:2', '5-1-4:7'],
      steps: (p) => [
        { c: 'R3', p: { v: 'base', a: p.a, b: p.b }, why: '기준량은 무엇인가요?' },
        f16(p.a, p.b, `비교하는 양 ÷ 기준량 = ${p.a} ÷ ${p.b}`),
        p.v === 'dec' ? ext('F11', { n: p.a, d: p.b }, '분수를 소수로 바꿔요.') : null,
      ],
      hint: '비율 = 비교하는 양 ÷ 기준량이에요. 3 : 5의 비율은 3/5 = 0.6!',
    },
    {
      id: '6-1-4:5', fam: 'g6_RATEUSE', name: '비율이 쓰이는 경우', kid: '빠르기·인구 밀도·타율', sec: 25,
      gen: (r) => {
        const c = r.pick([0, 0, 1, 1, 2, 3]);
        if (c === 0) { const b = r.int(2, 5); return { c, a: b * 5 * r.int(8, 18), b }; }
        if (c === 1) { const b = r.int(2, 9); return { c, a: b * 50 * r.int(3, 18), b }; }
        if (c === 2) { const b = r.pick([10, 20, 25, 40, 50]); return { c, a: r.int(1, Math.floor(b / 2)), b }; }
        return { c, a: 10 * r.int(2, 15), b: r.pick([200, 250, 400, 500]) };
      },
      is: (p) => [0, 1, 2, 3].includes(p.c), prev: '6-1-4:4', pre: (p) => (p && p.c < 2 ? [divKind(p.a, p.b)] : ['5-1-4:7']),
      hint: '무엇에 대한 비율인지 보고, 그것을 기준량으로 나눠요. 2시간 동안 120 km를 가면 걸린 시간에 대한 거리의 비율은 120 ÷ 2 = 60!',
    },
    {
      id: '6-1-4:6', fam: 'R5', name: '백분율', kid: '% 로 나타내기', sec: 20,
      gen: (r) => C.R5.gen(r),
      is: (p) => p.v === 'frac' || p.v === 'dec', prev: '6-1-4:4', pre: ['5-1-4:3', '4-2-3:7'],
      steps: (p) => (p.v === 'frac'
        ? (100 / p.d > 1 ? alt(ext('F7', { v: 'up', n: p.n, d: p.d, k: 100 / p.d }, '분모를 100으로 만들어요.'), [{ c: 'MUL', p: { a: p.n, b: 100 / p.d }, why: `분모 ${p.d}${pn(p.d, '을', '를')} 100으로 만들려면 ${100 / p.d}배 해요. 분자도 ${100 / p.d}배 해요.` }]) : [])
        : [ext('DEC4', { v: 'x100', k: p.k }, '100배 해요.')]),
      hint: '기준량을 100으로 볼 때의 비율이에요. 3/4 = 75/100 = 75%!',
    },
    {
      id: '6-1-4:7', fam: 'g6_PCTUSE', name: '백분율이 쓰이는 경우', kid: '할인율·득표율·진하기', sec: 35,
      gen: (r) => {
        const c = r.pick(['sale', 'sale', 'vote', 'salt', 'salt2']);
        if (c === 'sale') { const x = 1000 * r.int(2, 50), rate = r.pick([10, 20, 25, 30, 40, 50]); return { c, x, y: (x * (100 - rate)) / 100, i: r.int(0, ITEMS.length - 1) }; }
        if (c === 'vote') return until(r, (r) => { const x = r.pick([20, 25, 50, 200, 250, 300, 400, 500]); return { c, x, y: (x * 5 * r.int(2, 18)) / 100 }; }, (p) => Number.isInteger(p.y) && p.y > 0);
        return until(r, (r) => { const x = r.pick([100, 200, 250, 300, 400, 500]); return { c, x, y: (x * r.pick([4, 5, 6, 8, 10, 12, 15, 20])) / 100 }; }, (p) => Number.isInteger(p.y)); // 진하기 20% 이하 (실제로 녹는 만큼)
      },
      is: (p) => ['sale', 'vote', 'salt', 'salt2'].includes(p.c), prev: '6-1-4:6', pre: ['6-1-4:3'],
      hint: '무엇이 기준량인지 먼저 정하고, 비율에 100을 곱해요. 20000원짜리를 15000원에 사면 할인된 5000원 ÷ 20000원 × 100 = 25%!',
    },

    // ── 6-2-1 분수의 나눗셈
    {
      id: '6-2-1:2', fam: 'F18', name: '분모 같은 분수÷분수 (나누어떨어짐)', kid: '분모가 같은 분수끼리 나누기 (몫이 자연수)', sec: 20,
      gen: (r) => until(r, (r) => { const b = r.pick([1, 2, 2, 3, 3, 4]); return { a: b * r.int(2, 6), b, d: r.int(5, 13) }; }, (p) => p.a < p.d && gcd(p.a, p.d) === 1 && gcd(p.b, p.d) === 1),
      is: (p) => !p.mix1 && !p.mix2 && p.a % p.b === 0, prev: null, pre: ['3-1-6:5', '3-1-3:3'],
      steps: (p) => [
        ext('F3', { v: 'count', n: p.a, d: p.d }, `${p.a}/${p.d}${pn(p.a, '은', '는')} 1/${p.d}이 몇 개인가요?`),
        p.b > 1 ? ext('F3', { v: 'count', n: p.b, d: p.d }, `${p.b}/${p.d}${pn(p.b, '은', '는')} 1/${p.d}이 몇 개인가요?`) : null,
        ...(p.b > 1 ? alt(ext('D2', { d: p.b, q: p.a / p.b }, `${p.a}에서 ${jn(p.b, '을', '를')} 몇 번 덜어낼 수 있나요?`), [{ c: 'DIV', p: { a: p.a, b: p.b }, why: `분자끼리 나눠요: ${p.a} ÷ ${p.b}` }]) : []),
      ],
      hint: '분모가 같으면 분자끼리 나눠요. 6/7 ÷ 2/7 = 6 ÷ 2 = 3!',
      tip: '6/7 ÷ 2/7는 "6/7 안에 2/7가 몇 번 들어가나"예요. 1/7이 6개 ÷ 1/7이 2개 = 6 ÷ 2. 3학년 "몇 번 덜어내기"와 같아요.',
    },
    {
      id: '6-2-1:3', fam: 'F18', name: '분모 같은 분수÷분수 (안 떨어짐)', kid: '분모가 같은 분수끼리 나누기 (몫이 분수)', sec: 25,
      gen: (r) => until(r, (r) => { const d = r.int(5, 13); let a = r.int(1, d - 1), b = r.int(2, d - 1); if (a < b && r.chance(0.6)) [a, b] = [b, a]; return { a, b, d }; },
        (p) => p.b >= 2 && p.a !== p.b && p.a % p.b !== 0 && gcd(p.a, p.d) === 1 && gcd(p.b, p.d) === 1),
      make: (p) => { const g = gcd(p.a, p.b); return frac([fx(p.a, p.d), ' ÷ ', fx(p.b, p.d), ' = ', fb(0, 1)], F(p.a / g, p.b / g), {
        bugs: [
          { test: (v) => v[1] && near(v[0] / v[1], p.a / p.b / p.d), name: '나누는 분수를 자연수처럼 봄', to: '3-1-3:3' },
          { test: (v) => v[1] && eqv(F(v[0], v[1]), F(p.b, p.a)), name: '나뉠 수와 나누는 수를 바꿈', to: '6-1-1:2' },
        ],
      }); },
      is: (p) => !p.mix1 && !p.mix2 && p.a % p.b !== 0, prev: '6-2-1:2', pre: (p) => [p && p.a < p.b ? '6-1-1:2' : '6-1-1:3'],
      steps: (p) => [
        ext('F3', { v: 'count', n: p.a, d: p.d }, `${p.a}/${p.d}${pn(p.a, '은', '는')} 1/${p.d}이 몇 개인가요?`),
        ext('F3', { v: 'count', n: p.b, d: p.d }, `${p.b}/${p.d}${pn(p.b, '은', '는')} 1/${p.d}이 몇 개인가요?`),
        f16(p.a, p.b, `분자끼리 나누면 ${p.a} ÷ ${jn(p.b, '이에요', '예요')}. 몫을 분수로 써요.`),
      ],
      hint: '분자끼리 나눈 몫을 분수로 써요. 5/7 ÷ 2/7 = 5 ÷ 2 = 5/2!',
      tip: '5/7 ÷ 2/7는 1/7이 5개 ÷ 1/7이 2개 = 5 ÷ 2라서 몫은 5/2예요. 나누어떨어지지 않으면 6학년 1학기 "몫을 분수로 나타내기"를 그대로 써요. 2/7가 5/7 안에 2번 하고 반 들어간다는 것을 띠 그림으로 보여 줘요.',
    },
    {
      id: '6-2-1:4', fam: 'F19', name: '분모가 다른 (분수)÷(분수)', kid: '분모가 다른 분수끼리 나누기', sec: 45,
      gen: (r) => C.F19.gen(r),
      is: (p) => !p.mix1, prev: '6-2-1:3', pre: ['5-1-4:5'],
      // 앞 분수를 뒤집는 잘못은 뒤 차시(곱셈으로 나타내기)로 보내지 않는다
      make: (p) => remapBugs(C.F19.make(p), { '앞 분수를 뒤집음': null }),
      steps: (p) => {
        const L = lcm(p.d1, p.d2);
        return [
          ext('F9', { v: 'given', n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 }, '먼저 통분해요.'),
          { c: 'F18', p: { a: (p.n1 * L) / p.d1, b: (p.n2 * L) / p.d2, d: L }, why: `통분하면 ${(p.n1 * L) / p.d1}/${L} ÷ ${(p.n2 * L) / p.d2}/${L}, 분모가 같은 분수의 나눗셈이 돼요.` },
        ];
      },
      hint: '먼저 통분해서 분모를 같게 하고 분자끼리 나눠요. 3/4 ÷ 2/5 = 15/20 ÷ 8/20 = 15/8!',
    },
    {
      id: '6-2-1:5', fam: 'F21', name: '(자연수)÷(분수)', kid: '자연수 ÷ 분수', sec: 25,
      gen: (r) => { let n, d; do { d = r.int(2, 7); n = r.int(1, d - 1); } while (gcd(n, d) !== 1); return r.chance(0.3) ? { v: 'one', n, d } : { v: 'n', n, d, N: n * r.int(2, 5) }; },
      is: (p) => p.v === 'one' || p.v === 'n', prev: '6-2-1:2', pre: ['3-1-3:6'],
      steps: (p) => {
        if (p.v === 'one') return [ext('F3', { v: 'whole', w: 1, d: p.d }, `1은 1/${p.d}이 몇 개인가요?`)];
        const k = p.N / p.n;
        if (p.n === 1) return [{ c: 'MUL', p: { a: p.N, b: p.d }, why: `1은 1/${p.d}이 ${p.d}개예요. ${jn(p.N, '은', '는')} 1/${p.d}이 몇 개인가요? ${p.N} × ${p.d}` }];
        return [
          { c: 'DIV', p: { a: p.N, b: p.n }, why: `${p.n}/${p.d}${pn(p.n, '이', '가')} ${jn(p.N, '이면', '면')} 1/${p.d}${pn(1, '은', '는')} ${p.N} ÷ ${jn(p.n, '이에요', '예요')}.` },
          { c: 'MUL', p: { a: k, b: p.d }, why: `1은 1/${p.d}이 ${p.d}개예요.` },
        ];
      },
      hint: '6 ÷ 3/4은 "3/4이 6이면 1은 얼마?"예요. 1/4은 6 ÷ 3 = 2, 1은 2 × 4 = 8!',
    },
    {
      id: '6-2-1:6', fam: 'F20', name: '(분수)÷(분수)를 곱셈으로', kid: '나누는 분수를 뒤집어 곱하기', sec: 40,
      gen: (r) => until(r, (r) => { const d1 = r.int(2, 9), d2 = r.int(2, 9); return { n1: r.int(1, d1 - 1), d1, n2: r.int(1, d2 - 1), d2 }; }, (p) => gcd(p.n1, p.d1) === 1 && gcd(p.n2, p.d2) === 1 && (p.n1 * p.d2) % (p.d1 * p.n2) !== 0),
      is: (p) => p.n1 > 0 && p.n2 > 0, prev: '6-2-1:5', pre: ['5-2-2:6', '6-1-1:5'],
      // 단위분수로 나누면 × 자연수 (2/3 ÷ 1/5 = 2/3 × 5) — 5/1처럼 쓰게 하지 않는다 · 몫이 자연수면 빈칸 하나 (2/1로 쓰게 하지 않는다)
      make: (p) => {
        const res = fdiv(F(p.n1, p.d1), F(p.n2, p.d2)), unit = p.n2 === 1, whole = res.d === 1, k = unit ? 1 : 2;
        const prompt = [fx(p.n1, p.d1), ' ÷ ', fx(p.n2, p.d2), ' = ', fx(p.n1, p.d1), ' × ', unit ? B(0) : fb(0, 1), ' = ', whole ? B(k) : fb(k, k + 1)];
        const sol = [...(unit ? [p.d2] : [p.d2, p.n2]), ...(whole ? [res.n] : [res.n, res.d])];
        const len = sol.length;
        return {
          prompt, sol, ans: toText(prompt, sol),
          check(v) {
            const xs = v.slice(0, len);
            if (xs.some((x) => !Number.isInteger(x)) || (!unit && !xs[1]) || (!whole && !xs[k + 1])) return { ok: false };
            const flip = unit ? F(xs[0], 1) : F(xs[0], xs[1]), got = whole ? F(xs[k], 1) : F(xs[k], xs[k + 1]);
            const flipOk = eqv(flip, F(p.d2, p.n2)), resOk = eqv(got, res);
            if (flipOk && resOk) return { ok: true };
            if (eqv(flip, F(p.n2, p.d2)) || (unit && xs[0] === 1) || eqv(got, F(p.n1 * p.n2, p.d1 * p.d2))) return { ok: false, bug: { name: '나누는 수를 그대로 곱함', to: '6-2-1:5' } };
            if (flipOk) return { ok: false, bug: { name: '분수의 곱셈에서 틀림', to: unit ? '5-2-2:2' : '5-2-2:6' } };
            return { ok: false };
          },
        };
      },
      steps: (p) => [
        { c: 'F21', p: { v: 'one', n: p.n2, d: p.d2 }, why: `1 ÷ ${p.n2}/${p.d2}${pn(p.n2, '은', '는')} 얼마인가요?` },
        p.n2 !== 1
          ? ext('F15', { n1: p.n1, d1: p.d1, n2: p.d2, d2: p.n2 }, `${p.n1}/${p.d1}에 ${p.d2}/${p.n2}${pn(p.d2, '을', '를')} 곱해요.`)
          : p.n1 < p.d1
            ? ext('F13', { d: p.d1, n: p.n1, k: p.d2 }, `${p.n1}/${p.d1}에 ${jn(p.d2, '을', '를')} 곱해요.`)
            : { c: 'MUL', p: { a: p.n1, b: p.d2 }, why: `${p.n1}/${p.d1}에 ${jn(p.d2, '을', '를')} 곱하면 분자가 ${p.d2}배가 돼요: ${p.n1} × ${p.d2}` },
      ],
      tip: '÷ 4/5는 "4/5가 1이 되게 하는 수"를 곱하는 것이라 × 5/4예요. 먼저 1 ÷ 4/5 = 5/4를 그림으로 보여 주고, 통분해서 나눈 결과와 같은지 나란히 확인해요.',
      hint: '나누는 분수의 분모와 분자를 바꿔서 곱해요. 2/3 ÷ 4/5 = 2/3 × 5/4 = 10/12 = 5/6!',
    },
    {
      id: '6-2-1:7', fam: 'F19', name: '(대분수)÷(분수)', kid: '대분수 ÷ 분수', sec: 50,
      gen: (r) => {
        const w = r.int(1, 3), d1 = r.pick([2, 3, 4, 5, 6]); let x; do { x = r.int(1, d1 - 1); } while (gcd(x, d1) !== 1);
        let n2, d2; do { d2 = r.int(2, 9); n2 = r.int(1, d2 - 1); } while (gcd(n2, d2) !== 1);
        return { n1: w * d1 + x, d1, n2, d2, mix1: true };
      },
      is: (p) => !!p.mix1 && p.n1 > p.d1 && p.n1 % p.d1 !== 0, prev: '6-2-1:6', pre: ['3-2-4:6'],
      make: (p) => {
        const w = Math.floor(p.n1 / p.d1), x = p.n1 % p.d1, res = fdiv(F(p.n1, p.d1), F(p.n2, p.d2));
        // 몫이 자연수면 빈칸 하나 (1 1/2 ÷ 3/4 = 2)
        const whole = res.d === 1, same = (v, f) => (whole ? v[0] > 0 && eqv(F(v[0], 1), f) : v[1] && eqv(F(v[0], v[1]), f));
        const bugs = [
          { test: (v) => same(v, F(w * p.d1 * p.n2 + x * p.d2, p.d1 * p.n2)), name: '분수 부분만 나눔 (대분수를 가분수로 바꾸지 않음)', to: '3-2-4:6' },
          { test: (v) => same(v, F(p.n1 * p.n2, p.d1 * p.d2)), name: '나누는 분수를 뒤집지 않고 곱함', to: '6-2-1:6' },
          { test: (v) => same(v, F(p.d1 * p.n2, p.n1 * p.d2)), name: '앞 분수를 뒤집음', to: '6-2-1:6' },
        ];
        const lead = [{ m: [w, x, p.d1] }, ' ÷ ', fx(p.n2, p.d2), ' = '];
        return whole ? nums([...lead, B(0)], res.n, { bugs }) : frac([...lead, fb(0, 1)], res, { bugs });
      },
      steps: (p) => [
        ext('F5', { v: 'toImp', w: Math.floor(p.n1 / p.d1), n: p.n1 % p.d1, d: p.d1 }, '대분수를 가분수로 바꿔요.'),
        { c: '6-2-1:6', p: { n1: p.n1, d1: p.d1, n2: p.n2, d2: p.d2 }, why: `${p.n1}/${p.d1} ÷ ${p.n2}/${p.d2}${pn(p.n2, '을', '를')} 곱셈으로 바꿔 계산해요.` },
      ],
      hint: '대분수를 가분수로 바꾼 다음, 나누는 분수를 뒤집어 곱해요. 1 1/2 ÷ 3/4 = 3/2 × 4/3 = 2!',
      tip: '대분수를 가분수로 바꾸는 것이 먼저예요. 그다음은 통분해서 분자끼리 나누거나, 나누는 분수의 분모와 분자를 바꿔 곱해요. 분수 부분만 나누는 실수를 띠 그림으로 짚어 줘요.',
    },

    // ── 6-2-2 소수의 나눗셈 (6-2)
    {
      id: '6-2-2:2', fam: 'g6_DDIV2', name: '(소수 한 자리)÷(소수 한 자리)', kid: '소수 한 자리 수끼리 나누기', sec: 25,
      gen: (r) => until(r, (r) => { const e = r.chance(0.6) ? r.int(2, 9) : r.int(11, 29); return { a: (e <= 9 ? r.int(2, 19) : r.int(2, 9)) * e, ka: 1, b: e, kb: 1 }; },
        (p) => ddiv2Kind(p) === '6-2-2:2' && p.a < 1000),
      is: (p) => ddiv2Kind(p) === '6-2-2:2', prev: null, pre: (p) => ['6-1-3:2', '5-2-4:8', p ? divKind(p.a, p.b) : '3-1-3:6'],
      hint: '나뉠 수와 나누는 수를 똑같이 10배 해도 몫은 같아요. 3.6 ÷ 0.4 = 36 ÷ 4 = 9!',
    },
    {
      id: '6-2-2:3', fam: 'g6_DDIV2', name: '(소수 두 자리)÷(소수 두 자리)', kid: '소수 두 자리 수끼리 나누기', sec: 30,
      gen: (r) => until(r, (r) => { const e = r.chance(0.5) ? r.int(2, 9) : r.int(11, 99); return { a: r.int(2, 12) * e, ka: 2, b: e, kb: 2 }; },
        (p) => ddiv2Kind(p) === '6-2-2:3'),
      is: (p) => ddiv2Kind(p) === '6-2-2:3', prev: '6-2-2:2', pre: (p) => [p ? divKind(p.a, p.b) : '4-1-3:5'],
      hint: '둘 다 100배 하면 자연수의 나눗셈이 돼요. 1.44 ÷ 0.12 = 144 ÷ 12 = 12!',
    },
    {
      id: '6-2-2:4', fam: 'g6_DDIV2', name: '(소수 두 자리)÷(소수 한 자리)', kid: '소수 두 자리 수 ÷ 소수 한 자리 수', sec: 35,
      gen: (r) => until(r, (r) => { const e = r.chance(0.5) ? r.int(2, 9) : r.int(11, 39); return { a: r.int(11, 99) * e, ka: 2, b: e, kb: 1 }; },
        (p) => ddiv2Kind(p) === '6-2-2:4' && p.a < 10000 && !Number.isInteger(q2(p)) && ddivKind({ a: p.a, k: 1, b: p.b }) != null),
      is: (p) => ddiv2Kind(p) === '6-2-2:4', prev: '6-2-2:3', pre: (p) => [(p && ddivKind({ a: p.a, k: 1, b: p.b })) || '6-1-3:3'],
      hint: '나누는 수가 자연수가 되게 둘 다 10배 해요. 2.88 ÷ 1.2 = 28.8 ÷ 12 = 2.4!',
    },
    {
      id: '6-2-2:5', fam: 'g6_DDIV2', name: '(자연수)÷(소수)', kid: '자연수 ÷ 소수', sec: 30,
      gen: (r) => until(r, (r) => {
        const kb = r.chance(0.7) ? 1 : 2;
        const e = kb === 1 ? r.pick([2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 16, 24, 25, 35, 45]) : r.pick([5, 15, 25, 35, 45, 75, 125]);
        const Q = r.chance(0.75) ? r.int(2, 30) : r.int(11, 99) / 10;
        return { a: r6((Q * e) / T(kb)), ka: 0, b: e, kb };
      }, (p) => Number.isInteger(p.a) && p.a >= 1 && p.a <= 99 && ddiv2Kind(p) === '6-2-2:5' && (Number.isInteger(q2(p)) || ddivKind({ a: p.a * T(p.kb), k: 0, b: p.b }) === '6-1-3:7')),
      is: (p) => ddiv2Kind(p) === '6-2-2:5', prev: '6-2-2:2',
      pre: (p) => {
        if (!p) return ['4-2-3:7'];
        const A = p.a * T(p.kb);
        return [...(p.kb === 2 ? ['6-2-2:3'] : []), A % p.b === 0 ? divKind(A, p.b) : '6-1-3:7', '4-2-3:7'];
      },
      hint: '나누는 수가 자연수가 되게 둘 다 10배(100배) 해요. 6 ÷ 1.5 = 60 ÷ 15 = 4!',
    },
    {
      id: '6-2-2:6', fam: 'g6_DROUND', name: '몫을 반올림하여 나타내기', kid: '나눗셈의 몫을 반올림하기', sec: 40,
      gen: (r) => until(r, (r) => {
        const pl = r.pick([1, 1, 0, 2]), kb = pl === 2 ? 0 : r.chance(0.6) ? 1 : 0;
        const b = kb ? r.pick([3, 6, 7, 9, 11, 12, 13, 14, 17]) : r.pick([3, 6, 7, 9, 11, 12, 13]);
        return { a: r.int(11, pl === 2 ? 99 : 199), ka: 1, b, kb, pl };
      }, (p) => p.a % 10 !== 0 && ((p.a * T(p.kb) * T(p.pl)) % (p.b * T(p.ka))) !== 0 && (p.pl > 0 || p.a * T(p.kb) >= p.b * T(p.ka))),
      is: (p) => [0, 1, 2].includes(p.pl), prev: '6-2-2:2', pre: ['5-2-1:7', '6-1-3:7'],
      hint: '구하려는 자리보다 한 자리 더 구한 다음 반올림해요. 2.6 ÷ 0.7 = 3.71… → 소수 첫째 자리까지 3.7!',
    },
    {
      id: '6-2-2:7', fam: 'g6_DREM', name: '나누어 주고 남는 양', kid: '몫은 자연수, 남는 양은 소수', sec: 35,
      gen: (r) => until(r, (r) => { const b = r.int(2, 9); return { a: 10 * b * r.int(2, 9) + r.int(1, 10 * b - 1), b, c: r.int(0, 3) }; }, (p) => p.a % 10 !== 0),
      is: (p) => Number.isInteger(p.a) && p.a % 10 !== 0 && p.a > 10 * p.b, prev: null,
      pre: (p) => [p ? divKind(Math.floor(p.a / 10), p.b) : '3-2-2:6', '6-1-3:3', '4-2-3:10'],
      hint: '몫은 자연수까지만 구하고, 남는 양은 처음 양에서 나누어 준 양을 빼요. 14.6 m를 3 m씩 자르면 4도막, 14.6 − 12 = 2.6 m가 남아요.',
    },

    // ── 6-2-4 비례식과 비례배분
    {
      id: '6-2-4:2', fam: 'R6', name: '비의 성질', kid: '비율이 같은 비 만들기', sec: 15,
      gen: (r) => { let a, b; do { a = r.int(1, 7); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1); return { v: r.chance(0.65) ? 'mul' : 'div', a, b, k: r.int(2, 5), pos: r.chance(0.6) ? 3 : 2 }; },
      is: (p) => !p.v || p.v === 'mul' || p.v === 'div', prev: null, pre: ['5-1-4:3', '6-1-4:4'],
      make: (p) => {
        const { a, b, k } = p, pos = p.pos || 3, A = a * k, Bk = b * k;
        if (p.v === 'div') {
          const ans = pos === 3 ? b : a, sub = pos === 3 ? Bk - (A - a) : A - (Bk - b);
          const prompt = pos === 3 ? [`${A} : ${Bk} = ${a} : `, B(0)] : [`${A} : ${Bk} = `, B(0), ` : ${b}`];
          return nums(prompt, ans, { bugs: [{ test: (v) => sub > 0 && v[0] === sub, name: '같은 수를 뺌 (뺄셈으로 지키기)', to: '6-1-4:2' }] });
        }
        const ans = pos === 3 ? Bk : A, add = pos === 3 ? b + (A - a) : a + (Bk - b);
        const prompt = pos === 3 ? [`${a} : ${b} = ${A} : `, B(0)] : [`${a} : ${b} = `, B(0), ` : ${Bk}`];
        return nums(prompt, ans, { bugs: [{ test: (v) => v[0] === add, name: '같은 수를 더함 (덧셈으로 지키기)', to: '6-1-4:2' }] });
      },
      steps: (p) => {
        const { a, b, k } = p, pos = p.pos || 3, A = a * k, Bk = b * k;
        const [kn, kb2, other] = pos === 3 ? [a, A, b] : [b, Bk, a]; // 아는 짝(kn ↔ kb2)과 □ 짝의 다른 항
        const ratio = p.v === 'div'
          ? { c: 'R2', p: { v: 'int', big: kb2, small: kn }, why: `${kb2}${pn(kb2, '이', '가')} ${kn}${pn(kn, '이', '가')} 되었어요. 몇으로 나누었나요? (${kb2}${pn(kb2, '은', '는')} ${kn}의 몇 배?)` }
          : { c: 'R2', p: { v: 'int', big: kb2, small: kn }, why: `${kn}${pn(kn, '이', '가')} ${kb2}${pn(kb2, '이', '가')} 되었어요. 몇 배 했나요?` };
        return [
          kn > 1 ? ratio : null,
          p.v === 'div'
            ? { c: 'DIV', p: { a: other * k, b: k }, why: `다른 항도 같은 수로 나눠요: ${other * k} ÷ ${k}` }
            : { c: 'MUL', p: { a: other, b: k }, why: `다른 항에도 같은 수를 곱해요: ${other} × ${k}` },
        ];
      },
      hint: '앞과 뒤에 0이 아닌 같은 수를 곱하거나 같은 수로 나누어도 비율은 같아요. 2 : 3 = 4 : 6 = 8 : 12!',
    },
    {
      id: '6-2-4:3', fam: 'R7', name: '간단한 자연수의 비', kid: '비를 간단한 자연수의 비로', sec: 30,
      gen: (r) => {
        const v = r.pick(['int', 'int', 'int', 'dec', 'dec', 'frac', 'frac', 'mix']);
        if (v === 'int') { let a, b; do { a = r.int(1, 7); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1); return { v, a, b, k: r.pick([2, 3, 4, 5, 6]) }; }
        if (v === 'dec') return until(r, (r) => ({ v, a: r.int(1, 30), b: r.int(1, 30) }), (p) => p.a !== p.b && p.b % 10 !== 0 && p.a % 10 !== 0);
        if (v === 'frac') return until(r, (r) => { const d1 = r.int(2, 9), d2 = r.int(2, 9); return { v, n1: r.int(1, d1 - 1), d1, n2: r.int(1, d2 - 1), d2 }; }, (p) => p.d1 !== p.d2 && gcd(p.n1, p.d1) === 1 && gcd(p.n2, p.d2) === 1);
        return until(r, (r) => { const d = r.pick([2, 4, 5]); return { v, x: r.int(1, 9), n: r.int(1, d - 1), d }; }, (p) => gcd(p.n, p.d) === 1 && p.x * p.d !== 10 * p.n);
      },
      is: (p) => ['int', 'dec', 'frac', 'mix'].includes(p.v), prev: '6-2-4:2',
      pre: (p) => [!p || p.v === 'int' ? '5-1-2:4' : p.v === 'frac' ? '5-1-2:6' : '4-2-3:7'],
      make: (p) => {
        let prompt, ta, tb;
        const tail = [' → ', B(0), ' : ', B(1)];
        if (p.v === 'int') { ta = p.a; tb = p.b; prompt = [`${p.a * p.k} : ${jn(p.b * p.k, '을', '를')} 간단한 자연수의 비로`, ...tail]; }
        else if (p.v === 'dec') { const g = gcd(p.a, p.b); ta = p.a / g; tb = p.b / g; prompt = [`${ds(p.a, 1)} : ${jn(ds(p.b, 1), '을', '를')} 간단한 자연수의 비로`, ...tail]; }
        else if (p.v === 'frac') { const L = lcm(p.d1, p.d2); ta = (L / p.d1) * p.n1; tb = (L / p.d2) * p.n2; const g = gcd(ta, tb); ta /= g; tb /= g; prompt = [fx(p.n1, p.d1), ' : ', fx(p.n2, p.d2), `${pn(p.n2, '을', '를')} 간단한 자연수의 비로`, ...tail]; }
        else { ta = p.x * p.d; tb = 10 * p.n; const g = gcd(ta, tb); ta /= g; tb /= g; prompt = [`${ds(p.x, 1)} : `, fx(p.n, p.d), `${pn(p.n, '을', '를')} 간단한 자연수의 비로`, ...tail]; }
        return {
          prompt, sol: [ta, tb], ans: `${ta} : ${tb}`,
          check(v) {
            if (!Number.isInteger(v[0]) || !Number.isInteger(v[1]) || v[0] <= 0 || v[1] <= 0) return { ok: false };
            const same = v[0] * tb === v[1] * ta;
            if (same && gcd(v[0], v[1]) === 1) return { ok: true };
            if (same) return { ok: false, bug: { name: '끝까지 나누지 않음', to: '5-1-2:4' } };
            if (p.v === 'frac' && v[0] === p.d1 && v[1] === p.d2) return { ok: false, bug: { name: '분모를 그대로 비로 씀', to: '5-1-4:5' } };
            if (v[0] === tb && v[1] === ta) return { ok: false, bug: { name: '앞뒤를 바꿈', to: '6-1-4:3' } };
            return { ok: false };
          },
        };
      },
      steps: (p) => {
        if (p.v === 'int') return [ext('G3', { a: p.a * p.k, b: p.b * p.k }, '두 수의 최대공약수를 찾아요.'), { c: 'DIV', p: { a: p.a * p.k, b: p.k }, why: `앞의 수를 최대공약수 ${ron(p.k)} 나눠요.` }, { c: 'DIV', p: { a: p.b * p.k, b: p.k }, why: `뒤의 수도 ${ron(p.k)} 나눠요.` }];
        if (p.v === 'dec') return [ext('DEC4', { v: 'x10', k: p.a * 10 }, '앞과 뒤를 10배 해서 자연수의 비로 만들어요.'), gcd(p.a, p.b) > 1 ? ext('G3', { a: p.a, b: p.b }, `${p.a} : ${p.b}에서 ${jn(p.a, '과', '와')} ${p.b}의 최대공약수를 찾아요.`) : null].filter(Boolean);
        if (p.v === 'frac') {
          const L = lcm(p.d1, p.d2);
          return [ext('G4', { a: p.d1, b: p.d2 }, '두 분모의 최소공배수를 찾아요.'), ext('F14', { N: L, n: p.n1, d: p.d1 }, `앞의 분수에 ${jn(L, '을', '를')} 곱해요.`), ext('F14', { N: L, n: p.n2, d: p.d2 }, `뒤의 분수에도 ${jn(L, '을', '를')} 곱해요.`)];
        }
        // 소수 : 분수 — 분수를 소수로 바꾸고(3/4 = 0.75), 10배·100배 해서 자연수의 비로, 최대공약수로 나눈다
        const S = p.d === 4 ? 100 : 10, A = (p.x * S) / 10, Bn = (p.n * S) / p.d;
        return [
          ext('F11', { n: p.n, d: p.d }, '분수를 소수로 바꿔요.'),
          ext('DEC4', { v: S === 10 ? 'x10' : 'x100', k: p.x * 10 }, `${ds(p.x, 1)} : ${ds(Bn, S === 10 ? 1 : 2)}의 앞과 뒤를 ${S}배 해서 자연수의 비로 만들어요.`),
          gcd(A, Bn) > 1 ? ext('G3', { a: A, b: Bn }, `${A} : ${Bn}에서 ${jn(A, '과', '와')} ${Bn}의 최대공약수를 찾아요.`) : null,
        ].filter(Boolean);
      },
      hint: '자연수의 비는 최대공약수로 나누고, 소수의 비는 10배, 분수의 비는 분모의 공배수를 곱해요. 0.4 : 0.6 = 4 : 6 = 2 : 3!',
    },
    {
      id: '6-2-4:4', fam: 'R8', name: '비례식 (외항·내항)', kid: '비례식 알아보기', sec: 20,
      gen: (r) => { let a, b; do { a = r.int(1, 7); b = r.int(2, 9); } while (a === b || gcd(a, b) !== 1); return { v: r.chance(0.5) ? 'is' : 'terms', a, b, k: r.int(2, 4), t: r.chance(0.5) ? 'out' : 'in' }; },
      is: (p) => p.v === 'is' || p.v === 'terms', prev: '6-2-4:2', pre: ['6-1-4:4'],
      make: (p) => {
        if (p.v === 'is') {
          // 보기 셋: 비례식 · 같은 수를 더한 비 · 뒤 비의 앞뒤를 바꾼 비 (둘 중 하나 찍기를 막는다)
          const A = p.a, Bq = p.b, Cq = p.a * p.k, D = p.b * p.k;
          const ch = [`${A} : ${Bq} = ${Cq} : ${D}`, `${A} : ${Bq} = ${A + p.k} : ${Bq + p.k}`, `${A} : ${Bq} = ${D} : ${Cq}`];
          const order = [[0, 1, 2], [1, 0, 2], [1, 2, 0], [2, 0, 1]][(p.a + p.b + p.k) % 4];
          return pick(['비례식인 것을 고르세요.'], order.map((i) => [ch[i]]), order.indexOf(0), {
            bugs: { [order.indexOf(1)]: { name: '같은 수를 더한 비를 고름 (덧셈으로 지키기)', to: '6-2-4:2' }, [order.indexOf(2)]: { name: '뒤 비의 앞뒤를 바꾼 것을 고름 (비의 순서)', to: '6-1-4:3' } },
          });
        }
        const A = p.a, Bq = p.b, Cq = p.a * p.k, D = p.b * p.k;
        const [x, y] = p.t === 'out' ? [A, D] : [Bq, Cq], [ox, oy] = p.t === 'out' ? [Bq, Cq] : [A, D];
        return nums([`비례식 ${A} : ${Bq} = ${Cq} : ${D}에서 ${p.t === 'out' ? '외항' : '내항'}을 모두 쓰세요. → `, B(0), ', ', B(1)], [x, y], {
          order: false,
          bugs: [{ test: (v) => [v[0], v[1]].sort((m, n) => m - n).join() === [ox, oy].sort((m, n) => m - n).join(), name: '외항과 내항을 바꿈', to: null }],
        });
      },
      steps: (p) => (p.v === 'is' ? [{ c: 'R6', p: { v: 'mul', a: p.a, b: p.b, k: p.k, pos: 3 }, why: `${p.a} : ${p.b}의 앞과 뒤에 ${jn(p.k, '을', '를')} 곱해 봐요.` }] : []),
      hint: '비율이 같은 두 비를 =로 쓴 식이 비례식이에요. 2 : 3 = 4 : 6에서 바깥쪽 2와 6이 외항, 안쪽 3과 4가 내항!',
    },
    {
      id: '6-2-4:5', fam: 'R9', name: '비례식의 성질', kid: '외항의 곱 = 내항의 곱', sec: 30,
      gen: (r) => until(r, (r) => {
        let p0, q0; do { p0 = r.int(1, 6); q0 = r.int(2, 9); } while (p0 === q0 || gcd(p0, q0) !== 1);
        let u, w; do { u = r.int(1, 5); w = r.int(1, 6); } while (u === w);
        const [s1, s2] = r.chance(0.5) ? [u, w] : [w, u];
        const v = r.chance(0.25) ? 'prod' : 'x';
        return { v, a: p0 * s1, b: q0 * s1, c: p0 * s2, d: q0 * s2, pos: v === 'x' ? r.pick([3, 3, 2, 2, 1, 0]) : 3 };
      }, (p) => Math.max(p.a, p.b, p.c, p.d) <= 54),
      is: (p) => (p.v === 'x' || p.v === 'prod') && p.a * p.d === p.b * p.c, prev: '6-2-4:4', pre: ['5-1-4:5'],
      make: (p) => {
        const { a, b, c, d, pos } = p;
        if (p.v === 'prod') {
          return nums([`${a} : ${b} = ${c} : ${d}에서 외항의 곱은 `, B(0), ', 내항의 곱은 ', B(1)], [a * d, b * c], {
            bugs: [{ test: (v) => v[0] === a * b || v[0] === c * d || v[1] === a * b || v[1] === c * d, name: '한 비의 두 항끼리 곱함', to: '6-2-4:4' }, { test: (v) => v[0] === a * c || v[1] === a * c || v[0] === b * d || v[1] === b * d, name: '외항·내항을 헷갈림', to: '6-2-4:4' }],
          });
        }
        const t = [a, b, c, d], ans = t[pos];
        const prompt = [];
        t.forEach((x, i) => { prompt.push(i === pos ? B(0) : String(x)); if (i < 3) prompt.push(i === 1 ? ' = ' : ' : '); });
        const merged = []; for (const x of prompt) { if (typeof x === 'string' && typeof merged[merged.length - 1] === 'string') merged[merged.length - 1] += x; else merged.push(x); }
        // 같은 수를 더하거나 빼서 맞춘 답 · 외항과 내항을 바꿔 세운 답
        const add = [c - a + b, d - b + a, d - (c - a), c - (d - b)][[3, 2, 1, 0].indexOf(pos)];
        const swap = [(a * c) / b, (b * d) / a, (c * d) / a, (c * d) / b][[3, 2, 1, 0].indexOf(pos)];
        return nums(merged, ans, {
          bugs: [
            { test: (v) => add > 0 && add !== ans && v[0] === add, name: '같은 수를 더하거나 뺌 (덧셈으로 지키기)', to: '6-2-4:2' },
            { test: (v) => swap !== ans && near(v[0], swap), name: '외항과 내항을 헷갈림', to: '6-2-4:4' },
          ],
        });
      },
      steps: (p) => {
        const { a, b, c, d, pos } = p;
        if (p.v === 'prod') return [{ c: 'MUL', p: { a, b: d }, why: '외항끼리 곱해요.' }, { c: 'MUL', p: { a: b, b: c }, why: '내항끼리 곱해요.' }];
        // 비의 성질로 바로 되는 경우 (□ 짝이 아는 짝의 자연수 배)
        if (pos === 3 && c % a === 0 && c > a) return [{ c: 'R2', p: { v: 'int', big: c, small: a }, why: `${a}${pn(a, '이', '가')} ${c}${pn(c, '이', '가')} 되려면 몇 배?` }, { c: 'MUL', p: { a: b, b: c / a }, why: `${b}에도 같은 배를 해요.` }];
        if (pos === 2 && d % b === 0 && d > b) return [{ c: 'R2', p: { v: 'int', big: d, small: b }, why: `${b}${pn(b, '이', '가')} ${d}${pn(d, '이', '가')} 되려면 몇 배?` }, { c: 'MUL', p: { a, b: d / b }, why: `${a}에도 같은 배를 해요.` }];
        // 외항의 곱 = 내항의 곱
        const [x1, x2, by, side] = { 3: [b, c, a, '내항'], 2: [a, d, b, '외항'], 1: [a, d, c, '외항'], 0: [b, c, d, '내항'] }[pos];
        return [
          { c: 'MUL', p: { a: x1, b: x2 }, why: `${side}의 곱을 구해요: ${x1} × ${x2}` },
          { c: 'DIV', p: { a: x1 * x2, b: by }, why: `${by} × □ = ${jn(x1 * x2, '이니까', '니까')} □ = ${x1 * x2} ÷ ${by}` },
        ];
      },
      hint: '외항의 곱과 내항의 곱은 같아요. 3 : 4 = □ : 20이면 4 × □ = 3 × 20 = 60이라서 □ = 15!',
    },
    {
      id: '6-2-4:6', fam: 'g6_PROPUSE', name: '비례식 활용', kid: '비례식으로 문제 풀기', sec: 40,
      gen: (r) => until(r, (r) => {
        const ctx = r.int(0, 3);
        if (ctx === 0) { const a = r.int(2, 5), u = r.pick([100, 150, 200, 250, 300, 400, 500]), x = r.int(2, 12); return { ctx, a, b: a * u, c: x, d: x * u, i: r.int(0, BUY.length - 1) }; }
        if (ctx === 1) { const a = r.int(2, 4), u = 10 * r.int(4, 9), x = r.int(2, 8); return { ctx, a, b: a * u, c: x, d: x * u }; }
        if (ctx === 2) { let p0, q0; do { p0 = r.int(1, 5); q0 = r.int(1, 5); } while (p0 === q0 || gcd(p0, q0) !== 1); const w = r.pick([10, 20, 30, 40, 50, 100]); return { ctx, a: p0, b: q0, c: p0 * w, d: q0 * w }; }
        const a = r.int(1, 4), u = r.pick([50, 100, 200, 250, 500]), x = r.int(2, 12); return { ctx, a, b: a * u, c: x, d: x * u };
      }, (p) => p.c !== p.a),
      is: (p) => [0, 1, 2, 3].includes(p.ctx) && p.a * p.d === p.b * p.c, prev: '6-2-4:5', pre: ['6-1-4:3'],
      hint: '아는 두 양과 구하려는 두 양을 같은 순서로 써서 비례식을 세워요. 3개에 600원이면 3 : 600 = 5 : □, □ = 1000!',
    },
    {
      id: '6-2-4:7', fam: 'R10', name: '비례배분', kid: '전체를 비로 나누기', sec: 40,
      gen: (r) => C.R10.gen(r),
      is: (p) => p.N > 0 && p.N % (p.a + p.b) === 0, prev: null, pre: ['6-1-4:4', '5-2-2:4', '3-2-4:3'],
      steps: (p) => {
        const s = p.a + p.b;
        // 교과서 방법 그대로: 전체 × (앞)/(앞 + 뒤) — (자연수)×(분수) 차시로 내려간다
        const parts = [ext('F14', { N: p.N, n: p.a, d: s }, `앞의 몫은 ${p.N}의 ${p.a}/${s}${pn(p.a, '이에요', '예요')}.`), ext('F14', { N: p.N, n: p.b, d: s }, `뒤의 몫은 ${p.N}의 ${p.b}/${s}${pn(p.b, '이에요', '예요')}.`)];
        return [{ c: 'ADD', p: { a: p.a, b: p.b }, why: `전체를 ${p.a} + ${p.b} 조각으로 봐요.` }, ...parts];
      },
      hint: '전체를 (앞 + 뒤) 조각으로 나눠요. 35를 3 : 4로 나누면 7조각 중 3조각은 15, 4조각은 20!',
    },
  ],
};
