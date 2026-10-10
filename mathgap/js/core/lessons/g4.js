// 4학년 차시 (아이스크림 4-1 · 4-2) — 정의 방법은 docs/LESSONS.md
// FAMS: 이 학년에서 새로 만든 문항 가족 · LESSONS: 차시 정의
//   큰 수 g4_MAN·g4_FIVE·g4_BIG·g4_EOK·g4_JO·g4_SKIP·g4_BCMP · 규칙 g4_SEQ·g4_RULEX·g4_EQPAT·g4_MDPAT
//   대분수 g4_FMIX · 소수 g4_DEC3P·g4_DECAS — 자연수 계산은 ops.js(MUL·DIV), 기존 개념 F6·R0·DEC2·DEC3·DEC4를 다시 씀
import { nums, frac, mixed, pick, fx, fb, B, J, P, RO, F } from '../concepts/kit.js';
import { near } from '../math.js';
import { isKind, addKind, subKind, mulKind, divKind, danOf, ones, OPSBY } from './ops.js';
import NUM, { addNoCarry, subSmallFromLarge } from '../concepts/num.js';
import FRAC from '../concepts/frac.js';
import DEC from '../concepts/dec.js';

const C = Object.fromEntries([...NUM, ...FRAC, ...DEC].map((c) => [c.id, c]));

// 조건에 맞는 params가 나올 때까지 다시 뽑기 (무한 반복 방지)
const until = (r, make, ok, tries = 400) => { for (let i = 0; i < tries; i++) { const p = make(r); if (ok(p)) return p; } throw new Error('gen: 조건에 맞는 수를 못 찾음'); };
const dig = (n, k) => Math.floor(n / 10 ** k) % 10;
const lenOf = (n) => String(Math.trunc(n)).length;
const PLACE = ['일', '십', '백', '천', '만', '십만', '백만', '천만', '억', '십억', '백억', '천억', '조', '십조'];

// 글 뒤 조사 — 마지막 글자(한글이면 받침, 숫자면 읽기)로
const BATD = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
const hasB = (s) => {
  const ch = String(s).trim().slice(-1), c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (ch >= '0' && ch <= '9') return !!BATD[Number(ch)];
  return false;
};
const PK = (s, a, b) => (hasB(s) ? a : b);

// 큰 수 읽기 (만·억·조 단위로 띄어 씀, 십·백·천 앞의 '일'은 읽지 않음, 맨 앞 '일만'은 '만')
const KD = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const read4 = (g) => ['천', '백', '십', ''].map((u, i) => { const d = Math.floor(g / 10 ** (3 - i)) % 10; return d ? (d === 1 && u ? '' : KD[d]) + u : ''; }).join('');
function readKo(n) {
  const out = [];
  ['조', '억', '만', ''].forEach((u, i) => {
    const g = Math.floor(n / 10 ** (12 - 4 * i)) % 10000;
    if (!g) return;
    out.push((u === '만' && g === 1 && !out.length ? '' : read4(g)) + u);
  });
  return out.join(' ') || '영';
}
const roS = (n) => RO(n).slice(String(n).length); // 수 뒤 '으로/로'
const x10bug = (ans, to, name = '0의 개수를 틀림 (자리를 하나 잘못 셈)') => ({ test: (v) => v[0] === ans * 10 || v[0] * 10 === ans, name, to });

// 소수: 정수 m과 소수 자리 수 k로 (0.30000000004 막기)
const fmtD = (m, k) => String(Number((m / 10 ** k).toFixed(k))); // 끝자리 0은 쓰지 않는다 (97.40 → 97.4, 974.0 → 974)
const decV = (m, k) => Number((m / 10 ** k).toFixed(k));

// 문항에 오답 모양을 더 붙인다 (가족의 채점은 그대로)
const withMore = (it, more) => {
  const check = it.check;
  it.check = function (vals, raws) {
    const res = check.call(this, vals, raws);
    if (res.ok || res.bug) return res;
    for (const b of more) { try { if (b.test(vals)) return { ok: false, bug: { name: b.name, to: b.to } }; } catch (e) { /* 무시 */ } }
    return res;
  };
  return it;
};
// 가족의 오답 모양보다 먼저 볼 오답 모양 (더 알맞은 이름·방향이 있을 때)
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
// 4학년 분수의 덧셈·뺄셈은 약분을 배우기 전 — 보여 주는 정답은 계산한 그대로(4/8), 크기가 같은 분수(1/2)도 정답
const fracKeep = (prompt, f, bugs) => frac(prompt, f, { keep: true, bugs });

const ORD = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', 5: '다섯째', 6: '여섯째', 7: '일곱째', 8: '여덟째', 9: '아홉째', 10: '열째', 12: '열두째', 15: '열다섯째', 20: '스무째' };

// ── 4-1-1 큰 수 ────────────────────────────────────────────────
const BIGUNITS = [
  ['십만', '만', 10], ['백만', '만', 100], ['천만', '만', 1000], ['백만', '십만', 10], ['천만', '백만', 10], ['천만', '십만', 100],
  ['100000', '10000', 10], ['1000000', '10000', 100], ['10000000', '1000000', 10],
];
const EOKUNITS = [
  ['1억은 1000만이 ', 10, '개인 수예요.'], ['1억은 100만이 ', 100, '개인 수예요.'], ['100000000은 10000000이 ', 10, '개인 수예요.'],
  ['1억은 9000만보다 ', 1000, '만 더 큰 수예요.'], ['1억은 9900만보다 ', 100, '만 더 큰 수예요.'], ['1억은 9990만보다 ', 10, '만 더 큰 수예요.'], ['1억은 9999만보다 ', 1, '만 더 큰 수예요.'],
];
const JOUNITS = [
  ['1조는 1000억이 ', 10, '개인 수예요.'], ['1조는 100억이 ', 100, '개인 수예요.'],
  ['1조는 9000억보다 ', 1000, '억 더 큰 수예요.'], ['1조는 9900억보다 ', 100, '억 더 큰 수예요.'], ['1조는 9990억보다 ', 10, '억 더 큰 수예요.'], ['1조는 9999억보다 ', 1, '억 더 큰 수예요.'],
];
// 자리 숫자를 묻는 문항: 이웃 자리 숫자를 쓰면 '자리를 하나 잘못 셈'
const digitBug = (n, i, to) => ({ test: (v) => v[0] !== dig(n, i) && (v[0] === dig(n, i + 1) || (i > 0 && v[0] === dig(n, i - 1))), name: '자리를 하나 잘못 셈', to });
// 숫자가 나타내는 값을 묻는 문항
const valueBugs = (d, i, to) => [
  { test: (v) => i > 0 && v[0] === d, name: '숫자만 씀 (자릿값을 붙이지 않음)', to },
  { test: (v) => v[0] === d * 10 ** (i + 1) || (i > 0 && v[0] === d * 10 ** (i - 1)), name: '자리를 하나 잘못 셈', to },
];
// 그 수에 한 번만 나오는 0 아닌 숫자의 자리 (lo~hi)
const uniqPlaces = (n, lo, hi) => { const s = String(n); const out = []; for (let i = lo; i <= Math.min(hi, s.length - 1); i++) { const d = dig(n, i); if (d && s.split('').filter((c) => c === String(d)).length === 1) out.push(i); } return out; };
// 네 자리 묶음 하나 (0이 섞이기도)
const group4 = (r, lo = 1000) => { let g = r.int(lo, 9999); if (r.chance(0.5)) { const z = r.int(0, 2); g -= dig(g, z) * 10 ** z; } return Math.max(g, lo); };

const FAMS = [
  {
    id: 'g4_MAN', s: 'N', sec: 10,
    tip: '천 원짜리 지폐 10장 = 만 원. 천 모형 10개를 모아 만을 만들고, 9000·9900·9990·9999에서 10000까지 얼마나 더 가야 하는지 수직선으로 보여 줘요.',
    make: (p) => {
      if (p.v === 'more') return nums([`10000은 ${p.x}보다 `, B(0), '만큼 더 큰 수예요.'], 10000 - p.x, { bugs: [x10bug(10000 - p.x, '2-2-1:5')] });
      if (p.v === 'count') {
        const k = 10000 / p.u;
        if (p.money) return nums([`10000원은 ${p.u}원짜리 ${p.u >= 1000 ? '지폐' : '동전'} `, B(0), p.u >= 1000 ? '장이에요.' : '개예요.'], k, { bugs: [x10bug(k, '2-2-1:5')] });
        return nums([`10000은 ${p.u}${P(p.u, '이', '가')} `, B(0), '개인 수예요.'], k, { bugs: [x10bug(k, '2-2-1:5')] });
      }
      return nums([`10000이 ${p.k}개이면 `, B(0)], p.k * 10000, { bugs: [x10bug(p.k * 10000, '2-2-1:3')] });
    },
  },
  {
    id: 'g4_FIVE', s: 'N', sec: 15,
    tip: '자릿값 판(만·천·백·십·일)에 숫자 카드를 놓고, 빈 자리에는 0 카드를 놓게 해요. 읽을 때는 0인 자리를 읽지 않는다는 것도 함께 짚어요.',
    make: (p) => {
      const n = p.n, noZero = Number(String(n).replace(/0/g, ''));
      const zeroBug = { test: (v) => /0/.test(String(n)) && v[0] === noZero, name: '빈 자리에 0을 쓰지 않음', to: '2-2-1:4' };
      if (p.v === 'build') {
        const parts = [4, 3, 2, 1, 0].filter((i) => dig(n, i)).map((i) => `${10 ** i}${P(10 ** i, '이', '가')} ${dig(n, i)}개`);
        return nums([`${parts.join(', ')}인 수는 `, B(0)], n, { bugs: [zeroBug] });
      }
      if (p.v === 'read') { const k = readKo(n); return nums([`${k}${PK(k, '을', '를')} 수로 쓰면 `, B(0)], n, { bugs: [zeroBug] }); }
      const d = dig(n, p.i), val = d * 10 ** p.i;
      if (p.v === 'value') return nums([`${n}에서 숫자 ${d}${P(d, '이', '가')} 나타내는 값은 `, B(0)], val, { bugs: valueBugs(d, p.i, '2-2-1:5') });
      const tok = [`${n} = `];
      [4, 3, 2, 1, 0].filter((j) => dig(n, j)).forEach((j, k) => { if (k) tok.push(' + '); tok.push(j === p.i ? B(0) : String(dig(n, j) * 10 ** j)); });
      return nums(tok, val, { bugs: valueBugs(d, p.i, '2-2-1:5') });
    },
  },
  {
    id: 'g4_BIG', s: 'N', sec: 15,
    tip: '자릿값 표에 일·십·백·천 / 만·십만·백만·천만을 두 줄로 써서 "네 자리마다 이름이 바뀐다"를 보여 줘요. 오른쪽에서부터 네 자리씩 끊어 읽는 연습을 해요.',
    make: (p) => {
      if (p.v === 'unit') { const [big, small, k] = BIGUNITS[p.j]; return nums([`${big}${PK(big, '은', '는')} ${small}${PK(small, '이', '가')} `, B(0), '개인 수예요.'], k, { bugs: [x10bug(k, '4-1-1:2', '10배씩 커지는 자리를 하나 잘못 셈')] }); }
      if (p.v === 'man') return nums([`${p.n} = `, B(0), '만 ', B(1)], [Math.floor(p.n / 10000), p.n % 10000], { bugs: [{ test: (v) => v[0] === Math.floor(p.n / 1000), name: '네 자리씩 끊지 않음', to: '4-1-1:3' }] });
      if (p.v === 'digit') return nums([`${p.n}에서 ${PLACE[p.i]}의 자리 숫자는 `, B(0)], dig(p.n, p.i), { bugs: [digitBug(p.n, p.i, '4-1-1:3')] });
      if (p.v === 'value') { const d = dig(p.n, p.i); return nums([`${p.n}에서 숫자 ${d}${P(d, '이', '가')} 나타내는 값은 `, B(0)], d * 10 ** p.i, { bugs: valueBugs(d, p.i, '4-1-1:3') }); }
      const k = readKo(p.n), lo = p.n % 10000;
      return nums([`${k}${PK(k, '을', '를')} 수로 쓰면 `, B(0)], p.n, {
        bugs: [{ test: (v) => lo > 0 && lo < 1000 && v[0] === Number(`${Math.floor(p.n / 10000)}${lo}`), name: '빈 자리에 0을 쓰지 않음', to: '4-1-1:3' }, x10bug(p.n, '4-1-1:3')],
      });
    },
  },
  {
    id: 'g4_EOK', s: 'N', sec: 18,
    tip: '1000만이 10개 → 1억. 자릿값 표에 세 번째 줄(억·십억·백억·천억)을 더해 보여 줘요. 2억 3500만 = 235000000처럼 억·만을 섞어 쓴 것과 숫자로만 쓴 것을 오가게 해요.',
    make: (p) => {
      if (p.v === 'unit') { const [a, k, b] = EOKUNITS[p.j]; return nums([a, B(0), b], k, { bugs: [x10bug(k, '4-1-1:4', '10배씩 커지는 자리를 하나 잘못 셈')] }); }
      if (p.v === 'digit') return nums([`${p.n}에서 ${PLACE[p.i]}의 자리 숫자는 `, B(0)], dig(p.n, p.i), { bugs: [digitBug(p.n, p.i, '4-1-1:4')] });
      if (p.v === 'bigdigit') return nums([`${p.a}억 ${p.b}만에서 ${PLACE[8 + p.i]}의 자리 숫자는 `, B(0)], dig(p.a, p.i), { bugs: [digitBug(p.a, p.i, '4-1-1:4')] });
      if (p.v === 'readmix') { const k = readKo(p.a * 1e8 + p.b * 1e4); return nums([`${k}${PK(k, '을', '를')} 수로 쓰면 `, B(0), '억 ', B(1), '만'], [p.a, p.b], { bugs: [{ test: (v) => v[0] === p.a * 10 || v[0] * 10 === p.a || v[1] === p.b * 10 || v[1] * 10 === p.b, name: '빈 자리에 0을 쓰지 않거나 더 씀', to: '4-1-1:3' }] }); }
      const n = p.a * 1e8 + p.b * 1e4;
      if (p.v === 'count') return nums([`${p.a}억 ${p.b}만은 만이 `, B(0), '개인 수예요.'], p.a * 10000 + p.b, { bugs: [{ test: (v) => v[0] === p.a * 1000 + p.b, name: '1억을 1000만으로 봄', to: '4-1-1:4' }] });
      const k = p.v === 'mix' ? `${p.a}억 ${p.b}만` : readKo(n);
      return nums([`${k}${PK(k, '을', '를')} 수로 쓰면 `, B(0)], n, { bugs: [x10bug(n, '4-1-1:4')] });
    },
  },
  {
    id: 'g4_JO', s: 'N', sec: 18,
    tip: '만·억·조가 네 자리마다 바뀐다는 것을 표로 정리해요. 1조 = 1000억의 10배 = 억이 10000개. 신문 기사의 나라 예산 같은 수로 읽기 연습을 해요.',
    make: (p) => {
      if (p.v === 'unit') { const [a, k, b] = JOUNITS[p.j]; return nums([a, B(0), b], k, { bugs: [x10bug(k, '4-1-1:5', '10배씩 커지는 자리를 하나 잘못 셈')] }); }
      const X = p.a * 10000 + p.b;
      if (p.v === 'digit') {
        const names = ['억', '십억', '백억', '천억', '조', '십조', '백조', '천조'];
        return nums([`${p.a}조 ${p.b}억에서 ${names[p.i]}의 자리 숫자는 `, B(0)], dig(X, p.i), { bugs: [digitBug(X, p.i, '4-1-1:5')] });
      }
      // 읽은 말을 조·억 단위로 쓰기 (13자리 수를 다 치지 않게 두 칸)
      if (p.v === 'read') {
        const k = readKo(p.a * 1e12 + p.b * 1e8);
        return nums([`${k}${PK(k, '을', '를')} 수로 쓰면 `, B(0), '조 ', B(1), '억'], [p.a, p.b], {
          bugs: [{ test: (v) => v[1] !== p.b && (v[1] * 10 === p.b || v[1] === p.b * 10 || String(v[1]) === String(p.b).replace(/0/g, '')), name: '빈 자리에 0을 쓰지 않거나 더 씀', to: '4-1-1:3' }],
        });
      }
      const k = `${p.a}조 ${p.b}억`;
      return nums([`${k}${PK(k, '은', '는')} 억이 `, B(0), '개인 수예요.'], X, {
        bugs: [{ test: (v) => v[0] === p.a * 1000 + p.b, name: '1조를 1000억으로 봄', to: '4-1-1:5' }, { test: (v) => v[0] === p.a + p.b, name: '조와 억의 개수를 그냥 더함', to: '4-1-1:5' }],
      });
    },
  },
  {
    id: 'g4_SKIP', s: 'N', sec: 25,
    tip: '수 배열표나 자릿값 표에서 어느 자리 숫자가 1씩 바뀌는지 색칠해요. 9 다음에 윗자리로 올라가는 곳(390000 → 400000)을 꼭 짚어요.',
    make: (p) => {
      const D = 10 ** p.e, u = p.u || '', val = (i) => p.s + p.dir * i * D;
      const lab = u ? `${D}${u}` : ({ 3: '1000', 4: '1만', 5: '10만', 6: '100만', 7: '1000만' })[p.e];
      const how = p.dir > 0 ? '씩 뛰어 세었어요.' : '씩 거꾸로 뛰어 세었어요.';
      if (p.v === 'step') {
        const tok = [[0, 1, 2, 3].map((i) => `${val(i)}${u}`).join(', '), { br: 1 }, B(0), `${u}${how}`];
        return nums(tok, D, { bugs: [x10bug(D, '4-1-1:3', '다른 자리의 숫자를 봄')] });
      }
      const tok = [`${lab}${how}`, { br: 1 }], ans = [];
      for (let i = 0; i < 5; i++) {
        if (i) tok.push(', ');
        if (p.holes.includes(i)) { tok.push(B(ans.length)); if (u) tok.push(u); ans.push(val(i)); } else tok.push(`${val(i)}${u}`);
      }
      // 9 다음에 윗자리로 올리지 않은 수 (자리 숫자만 돌아감)
      const d0 = dig(p.s, p.e), noCarry = (i) => p.s - d0 * D + ((((d0 + p.dir * i) % 10) + 10) % 10) * D;
      return nums(tok, ans, {
        bugs: [
          { test: (v) => p.holes.some((h, k) => noCarry(h) !== val(h) && v[k] === noCarry(h)), name: p.dir > 0 ? '9 다음에 윗자리로 1을 올리지 않음' : '0에서 윗자리에서 1을 받아내리지 않음', to: '2-2-1:6' },
          { test: (v) => p.holes.some((h, k) => v[k] === val(h - 1) + p.dir * D * 10 || v[k] === val(h - 1) + p.dir * (D / 10) || v[k] === p.s + p.dir * h * D * 10 || v[k] === p.s + p.dir * h * (D / 10)), name: '다른 자리에서 뛰어 셈', to: '4-1-1:3' },
        ],
      });
    },
  },
  {
    id: 'g4_BCMP', s: 'N', sec: 12,
    tip: '① 자리 수가 다르면 자리 수가 많은 쪽이 커요. ② 같으면 가장 높은 자리부터 비교해요. 자릿값 표에 두 수를 위아래로 써서 처음으로 다른 자리를 찾게 해요.',
    make: (p) => {
      const val = (x) => (typeof x === 'number' ? x : x[0] * 1e8 + x[1] * 1e4);
      const txt = (x) => (typeof x === 'number' ? String(x) : `${x[0]}억 ${x[1]}만`);
      const vs = p.xs.map(val), best = p.ask === 'min' ? Math.min(...vs) : Math.max(...vs), right = vs.indexOf(best);
      const q = p.xs.length === 2 ? '더 큰 수를 고르세요.' : p.ask === 'min' ? '가장 작은 수를 고르세요.' : '가장 큰 수를 고르세요.';
      const bugs = {};
      p.xs.forEach((x, k) => {
        if (k === right) return;
        const lenTrap = p.ask === 'min' ? lenOf(vs[k]) > lenOf(best) : lenOf(vs[k]) < lenOf(best);
        bugs[k] = p.v === 'mix' ? { name: '억·만으로 나타낸 수를 잘못 읽음', to: '4-1-1:5' }
          : lenTrap ? { name: '자리 수를 세지 않고 앞자리 숫자만 비교', to: '4-1-1:3' }
            : { name: '높은 자리부터 차례로 비교하지 않음', to: '2-2-1:7' };
      });
      return pick([q], p.xs.map((x) => [txt(x)]), right, { bugs });
    },
  },

  // ── 4-1-6 규칙과 관계 ──────────────────────────────────────────
  {
    id: 'g4_SEQ', s: 'R', sec: 25,
    tip: '두 수 사이의 차이(뺄셈)와 몇 배(나눗셈)를 화살표 위에 적게 해요. 수 배열표는 → 방향과 ↓ 방향 규칙을 따로 찾아요.',
    make: (p) => {
      if (p.v === 'grid' || p.v === 'grule') {
        const cell = (i, j) => p.base + i * p.dr + j * p.dc;
        const tok = [p.v === 'grid' ? '수 배열표에서 규칙을 찾아 빈칸에 알맞은 수를 써요.' : '수 배열표의 규칙을 찾아요.'];
        for (let i = 0; i < 3; i++) {
          tok.push({ br: 1 });
          for (let j = 0; j < 4; j++) { if (j) tok.push('   '); tok.push(p.v === 'grid' && i === p.hi && j === p.hj ? B(0) : String(cell(i, j))); }
        }
        if (p.v === 'grid') {
          return nums(tok, cell(p.hi, p.hj), {
            bugs: [{ test: (v) => v[0] === cell(0, p.hj) || v[0] === cell(p.hi, 0), name: '한 방향 규칙만 봄', to: '4-1-1:7' }],
          });
        }
        const k = p.dir === 'row' ? p.dc : p.dr, other = p.dir === 'row' ? p.dr : p.dc;
        tok.push({ br: 1 }, p.dir === 'row' ? '→ 방향으로 ' : '↓ 방향으로 ', B(0), '씩 커져요.');
        return nums(tok, k, { bugs: [{ test: (v) => v[0] === other, name: '방향을 헷갈림', to: null }, x10bug(k, '4-1-1:7', '다른 자리의 숫자를 봄')] });
      }
      const t = seqTerms(p);
      if (p.v === 'rule') {
        const tail = p.op === '×' ? '배씩 커져요.' : p.op === '+' ? '씩 커져요.' : '씩 작아져요.';
        const k = p.d;
        return nums(['수의 배열에서 규칙을 찾아요.', { br: 1 }, t.join(', '), { br: 1 }, B(0), tail], k, {
          bugs: p.op === '×' ? [{ test: (v) => v[0] === t[1] - t[0], name: '곱하는 규칙을 더하는 규칙으로 봄', to: null }] : [x10bug(k, '4-1-1:7', '다른 자리의 숫자를 봄')],
        });
      }
      const tok = ['규칙을 찾아 빈칸에 알맞은 수를 써요.', { br: 1 }], ans = [];
      t.forEach((x, i) => { if (i) tok.push(', '); if (p.holes.includes(i)) { tok.push(B(ans.length)); ans.push(x); } else tok.push(String(x)); });
      // 곱하는(나누는) 배열을 '보이는 두 수의 차'만큼 더하는 배열로 본 답 — 차는 빈칸이 아닌 이웃한 두 수로 잰다
      const seen = [0, 1, 2, 3].find((i) => !p.holes.includes(i) && !p.holes.includes(i + 1)), gap = seen == null ? null : t[seen + 1] - t[seen];
      return nums(tok, ans, {
        bugs: (p.op === '×' || p.op === '÷') && gap != null ? [{ test: (v) => p.holes.some((h, k) => h > 0 && v[k] !== t[h] && v[k] === t[h - 1] + gap), name: '곱하는 규칙을 더하는 규칙으로 봄', to: null }] : [],
      });
    },
    steps: (p) => {
      if (p.v === 'grid') { const cell = (i, j) => p.base + i * p.dr + j * p.dc; return p.hj > 0 ? [{ c: 'ADD', p: { a: cell(p.hi, p.hj - 1), b: p.dc }, why: '바로 왼쪽 수에서 → 방향 규칙대로 해요.' }] : []; }
      if (p.v !== 'line') return [];
      const t = seqTerms(p), h = p.holes[0];
      if (h === 0) return [];
      if (p.op === '+') return [{ c: 'ADD', p: { a: t[h - 1], b: p.d }, why: '바로 앞의 수에 규칙대로 더해요.' }];
      if (p.op === '−') return [{ c: 'SUB', p: { a: t[h - 1], b: p.d }, why: '바로 앞의 수에서 규칙대로 빼요.' }];
      if (p.op === '×') return [{ c: 'MUL', p: { a: t[h - 1], b: p.d }, why: '바로 앞의 수에 규칙대로 곱해요.' }];
      return [{ c: 'DIV', p: { a: t[h - 1], b: p.d }, why: '바로 앞의 수를 규칙대로 나눠요.' }];
    },
  },
  {
    id: 'g4_RULEX', s: 'R', sec: 30,
    tip: '"다섯째 수 = 첫째 수 + 3 × 4"처럼 뛴 횟수(4)와 순서(5)가 하나 차이 난다는 것을 수직선에 화살표로 그려 보여 줘요.',
    make: (p) => {
      const t = (i) => seqTerms(p, i + 1)[i];
      const list = [0, 1, 2, 3].map(t).join(', ');
      if (p.v === 'next') {
        const sym = { '+': ' + ', '−': ' − ', '×': ' × ' }[p.op];
        return nums([`수의 배열: ${list}, …`, { br: 1 }, `다음 수를 구하는 식: ${t(3)}${sym}`, B(0), ' = ', B(1)], [p.d, t(4)], {
          bugs: p.op === '×' ? [{ test: (v) => v[0] === t(3) - t(2) || v[0] === t(1) - t(0), name: '곱하는 규칙을 더하는 규칙으로 봄', to: '4-1-6:2' }] : [],
        });
      }
      if (p.v === 'nth') {
        return nums([`수의 배열: ${list}, …`, { br: 1 }, `${ORD[p.n]} 수를 식으로 나타내면 ${p.s} + ${p.d} × `, B(0), ' = ', B(1)], [p.n - 1, p.s + p.d * (p.n - 1)], {
          bugs: [{ test: (v) => v[0] === p.n, name: '뛴 횟수를 하나 더 셈 (순서와 뛴 횟수를 헷갈림)', to: '4-1-6:2' }],
        });
      }
      return nums([`수의 배열: ${list}, …`, { br: 1 }, `이 규칙으로 ${ORD[p.n]} 수는 `, B(0)], p.s + p.d * (p.n - 1), {
        bugs: [{ test: (v) => v[0] === p.s + p.d * p.n, name: '뛴 횟수를 하나 더 셈 (순서와 뛴 횟수를 헷갈림)', to: '4-1-6:2' }],
      });
    },
    steps: (p) => {
      if (p.v === 'nth' || p.v === 'far') return [
        { c: 'MUL', p: { a: p.d, b: p.n - 1 }, why: `첫째 수에서 ${ORD[p.n]} 수까지 ${p.d}씩 몇 번 뛰는지 세어 곱해요.` },
        { c: 'ADD', p: { a: p.s, b: p.d * (p.n - 1) }, why: '첫째 수에 그만큼 더해요.' },
      ];
      return [];
    },
  },
  {
    id: 'g4_EQPAT', s: 'R', sec: 25,
    tip: '식을 위아래로 놓고 바뀌는 수에 색을 칠해요. "더하는 수가 10 커지면 합도 10 커진다"를 말로 하게 한 뒤 계산 없이 다음 식을 쓰게 해요.',
    make: (p) => {
      const L = eqLines(p), sym = p.op === '+' ? ' + ' : ' − ';
      const tok = ['규칙에 따라 다음 식을 완성해요.'];
      for (let i = 0; i < p.n; i++) tok.push({ br: 1 }, `${L[i][0]}${sym}${L[i][1]} = ${L[i][2]}`);
      const [x, y, z] = L[p.n];
      const prevZ = L[p.n - 1][2];
      tok.push({ br: 1 });
      const bugs = [];
      if (p.ask === 'res') {
        tok.push(`${x}${sym}${y} = `, B(0));
        if (p.op === '+' && p.kind === 'both') bugs.push({ test: (v) => v[0] === prevZ + p.k, name: '두 수가 함께 커진 것을 하나만 셈', to: '4-1-6:2' });
        if (p.kind === 'opp' || (p.op === '−' && p.kind === 'both')) bugs.push({ test: (v) => v[0] === prevZ + p.k || v[0] === prevZ - p.k || v[0] === prevZ + 2 * p.k, name: p.op === '+' ? '합이 그대로인 규칙을 못 찾음' : '차가 그대로인 규칙을 못 찾음', to: '4-1-6:2' });
        bugs.push({ test: (v) => p.op === '+' && addNoCarry(x, y) !== z && v[0] === addNoCarry(x, y), name: '받아올림을 빠뜨림', to: addKind(x, y) });
        return nums(tok, z, { bugs });
      }
      // 바뀌는 쪽 수를 묻는다 (빼는 수만 바뀌는 배열이면 빼는 수)
      if (p.kind === 'sub') { tok.push(`${x}${sym}`, B(0), ` = ${z}`); return nums(tok, y, { bugs: [{ test: (v) => v[0] === L[p.n - 1][1], name: '앞 식의 수를 그대로 씀', to: '4-1-6:2' }] }); }
      tok.push(B(0), `${sym}${y} = ${z}`);
      return nums(tok, x, { bugs: [{ test: (v) => v[0] === L[p.n - 1][0], name: '앞 식의 수를 그대로 씀', to: '4-1-6:2' }] });
    },
    // 같은 숫자로: ① 규칙대로 앞 식에서 바뀐 만큼 ② 직접 계산해 확인 (빈칸이 식 안의 수이면 거꾸로 셈으로 — 답을 미리 보여 주지 않게)
    steps: (p) => {
      const L = eqLines(p), [x, y, z] = L[p.n], [px, py, pz] = L[p.n - 1], what = p.op === '+' ? '합이' : '차가';
      if (p.ask === 'res') {
        const dz = z - pz;
        return [
          dz > 0 ? { c: 'ADD', p: { a: pz, b: dz }, why: `규칙대로라면 ${what} 앞 식의 ${pz}보다 ${dz}만큼 커져요.` }
            : dz < 0 ? { c: 'SUB', p: { a: pz, b: -dz }, why: `규칙대로라면 ${what} 앞 식의 ${pz}보다 ${-dz}만큼 작아져요.` } : null,
          { c: p.op === '+' ? 'ADD' : 'SUB', p: { a: x, b: y }, why: '다음 식을 직접 계산해 확인해요.' },
        ];
      }
      if (p.kind === 'sub') return [
        { c: 'ADD', p: { a: py, b: p.k }, why: `빼는 수가 ${p.k}씩 커져요. 앞 식의 ${py}에 ${J(p.k, '을', '를')} 더해요.` },
        { c: 'SUB', p: { a: x, b: z }, why: `${x} − □ = ${z}이니까 ${x} − ${RO(z)} 확인해요.` },
      ];
      return [
        { c: 'ADD', p: { a: px, b: p.k }, why: `${p.op === '+' ? '더해지는' : '빼지는'} 수가 ${p.k}씩 커져요. 앞 식의 ${px}에 ${J(p.k, '을', '를')} 더해요.` },
        p.op === '+' ? { c: 'SUB', p: { a: z, b: y }, why: `□ + ${y} = ${z}이니까 ${z} − ${RO(y)} 확인해요.` } : { c: 'ADD', p: { a: z, b: y }, why: `□ − ${y} = ${z}이니까 ${z} + ${RO(y)} 확인해요.` },
      ];
    },
  },
  {
    id: 'g4_MDPAT', s: 'R', sec: 30,
    tip: '곱해지는 수·곱하는 수가 어떻게 바뀔 때 곱이 어떻게 바뀌는지(2배 → 2배, 10배 → 0이 하나 더) 말로 정리하게 해요. 계산기로 확인하는 것도 좋아요.',
    make: (p) => {
      const L = mdLines(p), tok = ['규칙에 따라 빈칸에 알맞은 수를 써요.'];
      for (let i = 0; i < L.length - 1; i++) tok.push({ br: 1 }, `${L[i][0]} ${L[i][3]} ${L[i][1]} = ${L[i][2]}`);
      const [a, b, c, o] = L[L.length - 1];
      tok.push({ br: 1 });
      if (p.ask === 'left') { tok.push(B(0), ` ${o} ${b} = ${c}`); return nums(tok, a, {}); }
      tok.push(`${a} ${o} ${b} = `, B(0));
      const bugs = [];
      if (p.kind === 'x10') bugs.push(x10bug(c, '3-2-1:5', '0의 개수를 틀림'));
      if (p.kind === 'dbl') bugs.push({ test: (v) => v[0] === L[L.length - 2][2] + (L[L.length - 2][2] - L[L.length - 3][2]), name: '곱이 같은 만큼씩 커진다고 봄 (2배 규칙을 못 봄)', to: '4-1-6:2' });
      if (p.kind === 'dsame') bugs.push({ test: (v) => v[0] !== c && (v[0] === c * 2 || v[0] * 2 === c), name: '나누는 수도 커진 것을 안 봄', to: '4-1-6:2' });
      return nums(tok, c, { bugs });
    },
    steps: (p) => {
      const L = mdLines(p), [a, b, c, o] = L[L.length - 1];
      if (p.kind === 'x10') return [{ c: 'MUL', p: { a: L[0][0], b: L[0][1] }, why: `곱하는 수가 10배가 되면 곱도 10배예요. 먼저 첫째 식 ${L[0][0]} × ${L[0][1]}부터 확인해요.` }];
      if (p.kind === 'dbl') { const pc = L[L.length - 2][2]; return [{ c: 'MUL', p: { a: pc, b: 2 }, why: `곱하는 수가 2배가 되면 곱도 2배예요. 앞 식의 곱 ${pc}의 2배를 구해요.` }]; }
      if (p.kind === 'divk') return [
        { c: 'MUL', p: { a: p.q, b: p.at }, why: `나누어지는 수가 첫째 식의 ${p.at}배이니 몫도 ${p.q}의 ${p.at}배예요.` },
        { c: 'DIV', p: { a, b }, why: '직접 나눠 확인해요.' },
      ];
      if (p.kind === 'r101' && p.ask !== 'left' && o === '×') return [{ c: 'MUL', p: { a, b }, why: '규칙이 헷갈리면 직접 곱해 확인해요.' }];
      return [];
    },
  },

  // ── 4-2-1 분수의 덧셈과 뺄셈 (대분수) ──────────────────────────
  {
    id: 'g4_FMIX', s: 'F', sec: 30,
    tip: '자연수끼리, 분수끼리 따로 계산하는 방법과 가분수로 바꿔 계산하는 방법을 둘 다 보여 줘요. 받아내림은 "1 = 5/5"를 수 막대로 — 자연수 뺄셈처럼 10을 받아내리지 않아요.',
    make: (p) => {
      const { d } = p;
      if (p.op === '=') {
        const rhs = p.w - 1 >= 1 ? { m: [p.w - 1, B(0), d] } : { f: [B(0), d] };
        return nums([mixTok(p.w, p.n, d), ' = ', rhs], p.n + d, {
          bugs: [{ test: (v) => v[0] === p.n + 10, name: '1을 10으로 바꿈 (자연수 받아내림처럼)', to: '3-2-4:6' }, { test: (v) => v[0] === p.n + 1, name: '1을 분자에 1로 더함', to: '3-2-4:5' }],
        });
      }
      const { w1, n1, w2, n2 } = p;
      const A = w1 * d + n1, Bn = w2 * d + n2, res = F(p.op === '+' ? A + Bn : A - Bn, d);
      const prompt = [mixTok(w1, n1, d), p.op === '+' ? ' + ' : ' − ', mixTok(w2, n2, d), ' = '];
      const cand = [];
      if (p.op === '+') {
        cand.push({ w: w1 + w2, n: n1 + n2, d: 2 * d, name: '분모끼리도 더함', to: '4-2-1:2' });
        if (n1 + n2 >= d) cand.push({ w: w1 + w2, n: n1 + n2, d, name: '분수 부분이 1보다 큰데 그대로 둠', to: '3-2-4:6' }, { w: w1 + w2, n: n1 + n2 - d, d, name: '받아올린 1을 자연수 부분에 더하지 않음', to: '3-2-4:6' });
      } else if (n1 === 0) {
        cand.push({ w: w1 - w2, n: d - n2, d, name: '자연수에서 1을 분수로 바꾸고 자연수 부분에서 1을 빼지 않음', to: '3-2-4:6' }, { w: w1 - w2, n: n2, d, name: '빼는 분수를 그대로 내려 씀', to: '3-2-4:6' });
      } else if (n1 >= n2) {
        cand.push({ w: w1 - w2, n: n1 + n2, d, name: '분수 부분을 더함', to: '4-2-1:4' });
      } else {
        cand.push({ w: w1 - 1 - w2, n: 10 + n1 - n2, d, name: '1을 10으로 받아내림 (자연수 뺄셈처럼)', to: '3-2-4:6' },
          { w: w1 - w2, n: n2 - n1, d, name: '분수 부분에서 큰 수에서 작은 수를 뺌', to: '4-2-1:6' },
          { w: w1 - w2, n: d + n1 - n2, d, name: '받아내린 뒤 자연수 부분에서 1을 빼지 않음', to: '4-2-1:6' });
      }
      return fracAns(prompt, res, cand);
    },
    steps: (p) => {
      if (p.op === '=') return [];
      const { w1, n1, w2, n2, d } = p;
      if (p.op === '+') return [
        w2 ? { c: 'ADD', p: { a: w1, b: w2 }, why: '자연수 부분끼리 더해요.' } : null,
        { c: 'F6', p: { op: '+', a: n1, b: n2, d }, why: n1 + n2 > d ? '분수 부분끼리 더해요. 1보다 크면 대분수로 바꿔서 자연수 부분에 1을 더해요.' : '분수 부분끼리 더해요.' },
      ];
      if (n1 === 0) return [
        { c: 'F3', p: { v: 'whole', w: 1, d }, why: `빼는 수에 분수가 있으니 자연수에서 1을 분수로 바꿔야 해요. 1은 1/${d}이 몇 개인가요?` },
        w2 && w1 - 1 > w2 ? { c: 'SUB', p: { a: w1 - 1, b: w2 }, why: `${w1}에서 1을 ${d}/${d}${roS(d)} 바꾸면 자연수 ${w1 - 1}${P(w1 - 1, '이', '가')} 남아요. 자연수 부분끼리 빼요.` } : null,
        { c: 'F6', p: { op: '-', a: d, b: n2, d }, why: `1을 ${d}/${d}${roS(d)} 바꿔서 분수 부분을 빼요.` },
      ];
      if (n1 >= n2) return [
        w2 ? { c: 'SUB', p: { a: w1, b: w2 }, why: '자연수 부분끼리 빼요.' } : null,
        { c: 'F6', p: { op: '-', a: n1, b: n2, d }, why: '분수 부분끼리 빼요.' },
      ];
      return [
        { c: 'g4_FMIX', p: { op: '=', w: w1, n: n1, d }, why: `${n1}/${d}에서 ${n2}/${d}${P(n2, '을', '를')} 뺄 수 없어요. 자연수에서 1을 ${d}/${d}${roS(d)} 바꿔 분수 부분에 보태요.` },
        w2 && w1 - 1 > w2 ? { c: 'SUB', p: { a: w1 - 1, b: w2 }, why: '1을 보내고 남은 자연수 부분끼리 빼요.' } : null,
        { c: 'F6', p: { op: '-', a: d + n1, b: n2, d }, why: '분수 부분끼리 빼요.' },
      ];
    },
  },

  // ── 4-2-3 소수의 덧셈과 뺄셈 ───────────────────────────────────
  {
    id: 'g4_DEC3P', s: 'DEC', sec: 15,
    tip: '1 m = 1000 mm, 1 km = 1000 m로 0.001을 보여 줘요. 1.234 = 1 + 0.2 + 0.03 + 0.004처럼 자리마다 나눠 써요.',
    make: (p) => {
      if (p.v === 'count') return nums([`0.001이 ${p.n}개이면 `, B(0)], decV(p.n, 3), { noFrac: true, bugs: [{ test: (v) => near(v[0], p.n / 100), name: '0.001을 0.01로 봄', to: '4-2-3:2' }] });
      if (p.v === 'units') { const s = fmtD(p.n, 3); return nums([`${s}${PK(s, '은', '는')} 0.001이 `, B(0), '개예요.'], p.n, { bugs: [{ test: (v) => v[0] === Math.floor(p.n / 10), name: '0.01이 몇 개인지로 셈', to: '4-2-3:2' }] }); }
      if (p.v === 'km') return nums([`${p.n} m = `, B(0), ' km'], decV(p.n, 3), { noFrac: true, bugs: [{ test: (v) => near(v[0], p.n / 100), name: '1 km를 100 m로 봄', to: null }] });
      if (p.v === 'frac') return nums([fx(p.n, 1000), ' = ', B(0), ' (소수로)'], decV(p.n, 3), { noFrac: true, bugs: [{ test: (v) => near(v[0], p.n / 100), name: '자리를 하나 올림', to: '4-2-3:2' }] });
      // value: 숫자가 나타내는 값
      const s = fmtD(p.n, 3), d = dig(p.n, p.i), val = decV(d * 10 ** p.i, 3);
      return nums([`${s}에서 숫자 ${d}${P(d, '이', '가')} 나타내는 값은 `, B(0)], val, {
        noFrac: true,
        bugs: [{ test: (v) => p.i < 3 && v[0] === d, name: '숫자만 씀 (자릿값을 붙이지 않음)', to: '4-2-3:2' }, { test: (v) => near(v[0], val * 10) || near(v[0], val / 10), name: '자리를 하나 잘못 셈', to: '4-2-3:2' }],
      });
    },
  },
  {
    id: 'g4_DECAS', s: 'DEC', sec: 25,
    tip: '소수점끼리 세로로 맞춰 쓰고 자연수의 덧셈·뺄셈처럼 계산한 뒤 소수점을 그대로 내려 찍어요. 자릿수가 다르면 끝에 0을 붙여(1.2 = 1.20) 자리를 맞춰요.',
    make: (p) => {
      const K = Math.max(p.ka, p.kb), A = p.a * 10 ** (K - p.ka), Bm = p.b * 10 ** (K - p.kb), S = p.op === '+' ? A + Bm : A - Bm;
      const lowTo = K === 1 ? '3-1-6:9' : '4-2-3:2';
      const tok = [`${fmtD(p.a, p.ka)} ${p.op === '+' ? '+' : '−'} ${fmtD(p.b, p.kb)} = `, B(0)];
      const bugs = [];
      if (p.op === '+') {
        const nc = addNoCarry(A, Bm);
        bugs.push({ test: (v) => nc !== S && near(v[0], decV(nc, K)), name: '받아올림을 하지 않음', to: addKind(A, Bm) });
        const W = Math.floor(A / 10 ** K) + Math.floor(Bm / 10 ** K), Fs = (A % 10 ** K) + (Bm % 10 ** K);
        if (Fs >= 10 ** K) bugs.push({ test: (v) => near(v[0], Number(`${W}.${Fs}`)), name: '소수 부분의 합을 그대로 붙임 (일의 자리로 올리지 않음)', to: lowTo });
        if (p.ka !== p.kb) bugs.push({ test: (v) => near(v[0], decV(p.a + p.b, K)) || near(v[0], decV(p.a + p.b, Math.min(p.ka, p.kb))), name: '소수점을 맞추지 않고 끝자리를 맞춤', to: '4-2-3:2' });
      } else {
        const sl = subSmallFromLarge(A, Bm), nd = subNoDec(A, Bm);
        bugs.push({ test: (v) => sl !== S && near(v[0], decV(sl, K)), name: '자리마다 큰 수에서 작은 수를 뺌', to: subKind(A, Bm) });
        bugs.push({ test: (v) => nd !== S && near(v[0], decV(nd, K)), name: '받아내린 자리에서 1을 빼지 않음', to: subKind(A, Bm) });
        if (p.ka < p.kb) bugs.push({ test: (v) => near(v[0], decV(Math.abs(p.a - Math.floor(p.b / 10)) * 10 + (p.b % 10), 2)) || near(v[0], decV(Math.abs(p.b - p.a), 2)), name: '소수점을 맞추지 않음 (빈 자리를 0으로 보지 않음)', to: '4-2-3:2' });
        if (p.ka > p.kb) bugs.push({ test: (v) => p.a > p.b && near(v[0], decV(p.a - p.b, K)), name: '소수점을 맞추지 않고 끝자리를 맞춤', to: '4-2-3:2' });
      }
      bugs.push({ test: (v) => v[0] === S && S >= 10, name: '소수점을 찍지 않음', to: lowTo });
      return nums(tok, decV(S, K), { noFrac: true, bugs });
    },
    steps: (p) => decCols(p),
  },
];

// 수의 배열 (첫째 ~ n째)
function seqTerms(p, n = 5) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (p.op === '+') out.push(p.s + i * p.d);
    else if (p.op === '−') out.push(p.s - i * p.d);
    else if (p.op === '×') out.push(p.s * p.d ** i);
    else out.push(p.s * p.d ** (n - 1 - i));
  }
  return out;
}
// 덧셈식·뺄셈식 배열: [앞 수, 뒤 수, 결과] (0 ~ n줄)
function eqLines(p) {
  const out = [];
  for (let i = 0; i <= p.n; i++) {
    let x = p.a, y = p.b;
    if (p.kind === 'both') { x += i * p.k; y += i * p.k; } else if (p.kind === 'one') x += i * p.k; else if (p.kind === 'opp') { x += i * p.k; y -= i * p.k; } else if (p.kind === 'sub') y += i * p.k;
    out.push([x, y, p.op === '+' ? x + y : x - y]);
  }
  return out;
}
// 곱셈식·나눗셈식 배열: [앞 수, 뒤 수, 결과, 기호] — 마지막 줄이 묻는 줄
function mdLines(p) {
  const L = [];
  if (p.kind === 'r101') { for (let i = 0; i < 3; i++) { const x = p.x + i * p.g; L.push([101, x, 101 * x, '×']); } const x = p.x + p.at * p.g; L.push([101, x, 101 * x, '×']); }
  if (p.kind === 'd101') { for (let i = 0; i < 3; i++) { const x = p.x + i * p.g; L.push([101 * x, 101, x, '÷']); } const x = p.x + p.at * p.g; L.push([101 * x, 101, x, '÷']); }
  if (p.kind === 'x10') for (let i = 0; i < 4; i++) L.push([p.a, p.b * 10 ** i, p.a * p.b * 10 ** i, '×']);
  if (p.kind === 'dbl') for (let i = 0; i < 4; i++) L.push([p.a, p.b * 2 ** i, p.a * p.b * 2 ** i, '×']);
  if (p.kind === 'divk') { for (let i = 1; i <= 3; i++) L.push([i * p.q * p.dv, p.dv, i * p.q, '÷']); L.push([p.at * p.q * p.dv, p.dv, p.at * p.q, '÷']); }
  if (p.kind === 'dsame') for (let i = 0; i < 4; i++) L.push([p.q * p.m * 2 ** i, p.m * 2 ** i, p.q, '÷']);
  if (p.kind === 'nines') { const ks = p.w === 9 ? [9, 99, 999, 9999] : [11, 111, 1111, 11111]; ks.forEach((k) => L.push([k, k, k * k, '×'])); }
  return L;
}
// 받아내림을 하고 윗자리에서 1을 빼지 않은 뺄셈 (오답 흉내)
function subNoDec(a, b) { let r = 0, q = 1; while (a > 0 || b > 0) { const x = a % 10, y = b % 10; r += (x < y ? x + 10 - y : x - y) * q; a = Math.floor(a / 10); b = Math.floor(b / 10); q *= 10; } return r; }

// 분수 조각: 자연수 / 진분수 / 대분수
const mixTok = (w, n, d) => (n === 0 ? String(w) : w === 0 ? fx(n, d) : { m: [w, n, d] });
// 답 칸 모양을 답에 맞춰 고른다 — 자연수 □ / 진분수 □/□ / 대분수 □ □/□. cand = 오답 모양 {w, n, d, name, to}
function fracAns(prompt, res, cand) {
  const w = Math.floor(res.n / res.d), r = res.n % res.d;
  const form = r === 0 ? 'whole' : w === 0 ? 'frac' : 'mixed';
  const bugs = cand.filter((c) => c.n >= 0 && c.w >= 0).map((c) => ({
    name: c.name, to: c.to,
    test: (v) => (form === 'mixed' ? v[0] === c.w && v[1] === c.n && v[2] === c.d : form === 'frac' ? v[0] === c.w * c.d + c.n && v[1] === c.d : c.n === 0 && v[0] === c.w),
  }));
  if (form === 'whole') return nums([...prompt, B(0)], w, { bugs });
  if (form === 'frac') return fracKeep([...prompt, fb(0, 1)], res, bugs);
  return mixed([...prompt, { m: [B(0), B(1), B(2)] }], res, { bugs });
}
// 분모가 같은 분수의 덧셈 (F6 모양 {op, a, b, d}) — 합이 1보다 크면 가분수 → 대분수 두 칸
function addSameDen(p) {
  if (p.op !== '+') return subSameDen(p);
  const s = p.a + p.b;
  if (s < p.d) {
    return fracKeep([fx(p.a, p.d), ' + ', fx(p.b, p.d), ' = ', fb(0, 1)], F(s, p.d), [
      { test: (v) => v[0] === s && v[1] === 2 * p.d, name: '분모끼리도 더함', to: '3-1-6:5' },
      { test: (v) => p.a > 1 && p.b > 1 && v[0] === p.a * p.b && v[1] === p.d, name: '분자끼리 곱함', to: null },
    ]);
  }
  const w = Math.floor(s / p.d), r = s % p.d;
  return nums([fx(p.a, p.d), ' + ', fx(p.b, p.d), ' = ', { f: [B(0), p.d] }, ' = ', r ? { m: [B(1), B(2), p.d] } : B(1)], r ? [s, w, r] : [s, w], {
    bugs: [{ test: (v) => v[0] === s && !(v[1] === w && (!r || v[2] === r)), name: '가분수를 대분수로 바꾸지 못함', to: '3-2-4:6' }, { test: (v) => p.a > 1 && p.b > 1 && v[0] === p.a * p.b, name: '분자끼리 곱함', to: null }],
  });
}
function subSameDen(p) {
  return fracKeep([fx(p.a, p.d), ' − ', fx(p.b, p.d), ' = ', fb(0, 1)], F(p.a - p.b, p.d), [
    { test: (v) => v[0] === p.a + p.b && v[1] === p.d, name: '빼지 않고 더함', to: null },
  ]);
}

// 소수의 덧셈·뺄셈을 같은 숫자로 쪼갠 단계 — 자리를 맞추고(자릿수가 다르면) 낮은 자리부터 자리마다
const DPL = { 1: ['소수 첫째 자리', '일의 자리', '십의 자리'], 2: ['소수 둘째 자리', '소수 첫째 자리', '일의 자리', '십의 자리'] };
function decCols(p) {
  const K = Math.max(p.ka, p.kb), A = p.a * 10 ** (K - p.ka), Bm = p.b * 10 ** (K - p.kb), names = DPL[K] || DPL[2];
  const out = [];
  if (p.ka !== p.kb && K === 2) {
    // 1.2를 1.20으로 (끝자리 0을 그대로 보여 준다)
    const [m, k] = p.ka < p.kb ? [p.a, p.ka] : [p.b, p.kb], s = fmtD(m, k), s0 = (m / 10 ** k).toFixed(2);
    out.push({ c: 'DEC2', p: { v: 'units', n: m * 10 }, why: `${s}${PK(s, '을', '를')} ${s0}으로 보면 소수점을 맞출 수 있어요.` });
  }
  const L = Math.max(lenOf(A), lenOf(Bm));
  if (p.op === '+') {
    let c = 0;
    for (let i = 0; i < L; i++) {
      const x = dig(A, i), y = dig(Bm, i), nm = names[i] || '윗자리';
      if (c && (x === 0 || y === 0)) { if (x + y) out.push({ c: 'ADD', p: { a: x + y, b: 1 }, why: `${nm}: 받아올린 1을 더해요.` }); }
      else if (c) out.push({ c: 'ADD3', p: { a: x, b: y, c: 1 }, why: `${nm}: 받아올린 1까지 더해요.` });
      else if (x && y) out.push({ c: 'ADD', p: { a: x, b: y }, why: `${nm}끼리 더해요.` });
      c = x + y + c >= 10 ? 1 : 0;
    }
  } else {
    let br = 0;
    for (let i = 0; i < lenOf(A); i++) {
      const x = dig(A, i) - br, y = dig(Bm, i), nm = names[i] || '윗자리';
      if (x < y) { out.push({ c: 'SUB', p: { a: x + 10, b: y }, why: `${nm}: 윗자리에서 1을 받아내려 ${x + 10} − ${y}${P(y, '을', '를')} 해요.` }); br = 1; continue; }
      if (y || br) { if (x > 0 || y > 0) out.push({ c: 'SUB', p: { a: x, b: y }, why: br ? `${nm}: 1을 받아내려 주고 남은 ${x}에서 빼요.` : `${nm}끼리 빼요.` }); }
      br = 0;
    }
  }
  return out.slice(0, 4);
}

// ── 차시 ─────────────────────────────────────────────────────
// 큰 수 뛰어 세기·비교는 수의 크기에 따라 앞 차시가 다르다
const scaleOf = (n) => (n >= 1e8 ? '4-1-1:5' : n >= 1e5 ? '4-1-1:4' : '4-1-1:3');

// 나눗셈 단계 (같은 숫자로)
function divByTens(p) {
  const q = Math.floor(p.a / p.b), r = p.a % p.b;
  return [
    r ? { c: 'MUL', p: { a: p.b, b: q }, why: `${p.b} × ${q}${P(q, '이', '가')} ${p.a}${P(p.a, '을', '를')} 넘지 않는 가장 큰 곱인지 확인해요.` }
      : { c: 'MUL', p: { a: p.b, b: q }, why: `${p.b} × ${q}${P(q, '이', '가')} ${p.a}${P(p.a, '이', '가')} 되는지 확인해요.` },
    r ? { c: 'SUB', p: { a: p.a, b: p.b * q }, why: '나누어지는 수에서 그 곱을 빼면 나머지예요.' } : null,
  ];
}
function divOneDigitQ(p) {
  const q = Math.floor(p.a / p.b), r = p.a % p.b, t = Math.round(p.b / 10) * 10, qe = Math.floor(p.a / t);
  return [
    t >= 10 && t < 100 && t !== p.b && qe >= 1 && qe <= 9 ? { c: 'DIV', p: { a: p.a, b: t }, why: `${p.b}${P(p.b, '을', '를')} ${RO(t)} 어림해서 몫을 짐작해요.` } : null,
    { c: 'MUL', p: { a: p.b, b: q }, why: `짐작한 몫을 고쳐 가며 ${p.b} × ${q}${P(q, '을', '를')} 해서 확인해요.` },
    r ? { c: 'SUB', p: { a: p.a, b: p.b * q }, why: '나머지를 구해요. 나머지는 나누는 수보다 작아야 해요.' } : null,
  ];
}
function divTwoDigitQ(p) {
  const q = Math.floor(p.a / p.b), head = Math.floor(p.a / 10), q1 = Math.floor(head / p.b), rest = p.a - p.b * q1 * 10;
  if (q < 10 || q1 < 1 || q1 > 9) return OPSBY.DIV.steps(p);
  return [
    { c: 'DIV', p: { a: head, b: p.b }, why: `몫의 십의 자리: 앞의 두 자리 ${head} 안에 ${p.b}${P(p.b, '이', '가')} 몇 번 들어가는지 봐요.` },
    { c: 'MUL', p: { a: p.b, b: q1 * 10 }, why: `${p.b} × ${q1 * 10}${P(q1 * 10, '을', '를')} 해요.` },
    { c: 'SUB', p: { a: p.a, b: p.b * q1 * 10 }, why: `${p.a}에서 그 곱을 빼요.` },
    rest >= p.b ? { c: 'DIV', p: { a: rest, b: p.b }, why: `남은 ${rest}${P(rest, '을', '를')} ${RO(p.b)} 나눠요. 이 몫이 일의 자리예요.` } : null,
  ];
}
// 두 자리 수(10~94, 몇십 아님)
const twoDigit = (r, lo = 11, hi = 94) => until(r, (r) => r.int(lo, hi), (b) => b % 10 !== 0);

// 소수 가족 gen 도우미: 끝자리가 0이 아닌 정수
const nz = (r, lo, hi) => until(r, (r) => r.int(lo, hi), (n) => n % 10 !== 0);
const decIs = (op, K) => (p) => p.op === op && Math.max(p.ka, p.kb) === K && p.ka >= 1 && p.kb >= 1;
const decPre = (K, op) => (p) => [K === 1 ? '3-1-6:9' : '4-2-3:2', ...(p ? [op === '+' ? addKind(p.a * 10 ** (K - p.ka), p.b * 10 ** (K - p.kb)) : subKind(p.a * 10 ** (K - p.ka), p.b * 10 ** (K - p.kb))] : [])];

const LESSONS = [
  // ── 4-1-1 큰 수
  {
    id: '4-1-1:2', fam: 'g4_MAN', name: '만', kid: '만(10000) 알아보기', sec: 10,
    gen: (r) => r.pick([
      () => ({ v: 'more', x: 10000 - r.pick([1, 2, 5, 10, 20, 50, 100, 200, 300, 500, 1000, 2000, 3000]) }),
      () => ({ v: 'count', u: r.pick([1000, 100, 10]) }),
      () => ({ v: 'count', u: r.pick([1000, 5000, 100, 500]), money: true }),
      () => ({ v: 'many', k: r.int(2, 9) }),
    ])(),
    prev: null, pre: ['2-2-1:2', '2-2-1:3'],
    hint: '1000이 10개면 10000이고 "만"이라고 읽어요. 10000은 9990보다 10만큼 더 큰 수예요.',
  },
  {
    id: '4-1-1:3', fam: 'g4_FIVE', name: '다섯 자리 수', kid: '다섯 자리 수 (자릿값)', sec: 15,
    gen: (r) => {
      const v = r.pick(['build', 'read', 'value', 'expand']);
      const mk = () => { let n = r.int(1, 9) * 10000; for (let i = 0; i < 4; i++) n += r.int(1, 9) * 10 ** i; if ((v === 'build' || v === 'read') && r.chance(0.7)) { const z = r.int(0, 3); n -= dig(n, z) * 10 ** z; } return n; };
      if (v === 'build' || v === 'read') return { v, n: mk() };
      return until(r, () => { const n = mk(), ok = uniqPlaces(n, 1, 4); return { v, n, i: ok.length ? r.pick(ok) : -1 }; }, (p) => p.i >= 1);
    },
    prev: '4-1-1:2', pre: ['2-2-1:4', '2-2-1:5'],
    hint: '35027은 10000이 3개, 1000이 5개, 10이 2개, 1이 7개예요. 100이 없는 자리에는 0을 써요.',
  },
  {
    id: '4-1-1:4', fam: 'g4_BIG', name: '십만, 백만, 천만', kid: '십만·백만·천만', sec: 15,
    gen: (r) => {
      const v = r.pick(['unit', 'man', 'digit', 'value', 'read']);
      if (v === 'unit') return { v, j: r.int(0, BIGUNITS.length - 1) };
      if (v === 'man') return { v, n: r.int(10, 9999) * 10000 + r.int(1, 9999) };
      if (v === 'digit') return until(r, (r) => ({ v, n: r.int(10000000, 99999999), i: r.int(4, 7) }), (p) => dig(p.n, p.i) !== dig(p.n, p.i + 1) && dig(p.n, p.i) !== dig(p.n, p.i - 1));
      if (v === 'value') return until(r, (r) => { const n = r.int(1000000, 99999999), ok = uniqPlaces(n, 5, 7); return { v, n, i: ok.length ? r.pick(ok) : -1 }; }, (p) => p.i >= 5);
      return { v, n: group4(r, 100) * 10000 + (r.chance(0.5) ? 0 : group4(r, 1)) };
    },
    prev: '4-1-1:3', pre: ['2-2-1:5'],
    hint: '큰 수는 오른쪽에서부터 네 자리씩 끊어 읽어요. 38645127은 3864만 5127이에요.',
  },
  {
    id: '4-1-1:5', fam: 'g4_EOK', name: '억', kid: '억 알아보기', sec: 18,
    gen: (r) => {
      const v = r.pick(['unit', 'digit', 'read', 'mix', 'count', 'bigdigit', 'readmix']);
      if (v === 'unit') return { v, j: r.int(0, EOKUNITS.length - 1) };
      if (v === 'bigdigit') return until(r, (r) => ({ v, a: r.int(1000, 9999), b: group4(r, 100), i: r.int(0, 3) }), (p) => dig(p.a, p.i) !== dig(p.a, p.i + 1) && (p.i === 0 || dig(p.a, p.i) !== dig(p.a, p.i - 1)));
      if (v === 'readmix') return { v, a: group4(r, 10), b: group4(r, 100) };
      if (v === 'digit') return until(r, (r) => ({ v, n: r.int(100000000, 999999999), i: r.int(6, 8) }), (p) => dig(p.n, p.i) !== dig(p.n, p.i + 1) && dig(p.n, p.i) !== dig(p.n, p.i - 1));
      return { v, a: r.int(1, 9), b: group4(r, 100) };
    },
    prev: '4-1-1:4', pre: ['2-2-1:5'],
    hint: '1000만이 10개면 1억(100000000)이에요. 0이 8개예요! 235000000은 2억 3500만이에요.',
  },
  {
    id: '4-1-1:6', fam: 'g4_JO', name: '조', kid: '조 알아보기', sec: 18,
    gen: (r) => {
      const v = r.pick(['unit', 'count', 'read', 'digit']);
      if (v === 'unit') return { v, j: r.int(0, JOUNITS.length - 1) };
      if (v === 'digit') return until(r, (r) => { const a = r.pick([r.int(10, 99), r.int(100, 999), r.int(1000, 9999)]); return { v, a, b: r.int(1000, 9999), i: r.int(0, 3 + lenOf(a)) }; }, (p) => { const X = p.a * 10000 + p.b; return dig(X, p.i) !== dig(X, p.i + 1) && (p.i === 0 || dig(X, p.i) !== dig(X, p.i - 1)); });
      return { v, a: r.int(1, 9), b: group4(r, 100) };
    },
    prev: '4-1-1:5', pre: ['2-2-1:5'],
    hint: '1000억이 10개면 1조예요. 1조는 억이 10000개인 수라서, 3조 2500억은 억이 32500개예요.',
  },
  {
    id: '4-1-1:7', fam: 'g4_SKIP', name: '큰 수 뛰어 세기', kid: '큰 수 뛰어 세기', sec: 25,
    gen: (r) => {
      // 수가 너무 길지 않게: 1000·1만·10만씩은 수 그대로(일곱 자리까지), 10만·100만·1000만씩은 '만',
      //   10억·100억·1000억씩은 '억', 1조·10조씩은 '조'(몇십조·몇백조)를 붙여 쓴다 (교과서처럼 단위를 섞어 쓰기)
      const v = r.chance(0.75) ? 'blank' : 'step', dir = r.chance(0.75) ? 1 : -1;
      const mode = r.pick(['plain', 'plain', 'plain', 'man', 'man', 'eok', 'eok', 'eok', 'eok', 'eok', 'jo']); // 억 단위가 가장 많게 · 조는 가끔만
      const u = { plain: '', man: '만', eok: '억', jo: '조' }[mode];
      const e = mode === 'plain' ? r.int(3, 5) : mode === 'jo' ? r.int(0, 1) : r.int(1, 3), D = 10 ** e;
      const lo = mode === 'plain' ? D * 10 : mode === 'jo' ? D * 10 : 1000, top = mode === 'jo' ? 999 : u ? 9999 : 9999999;
      return until(r, (r) => {
        let s = u ? r.int(lo, top) : r.int(10 ** (e + 1), Math.min(10 ** (e + 3) - 1, top));
        if (!u && r.chance(0.6)) s -= s % 10 ** (e - 2); // 뛰어 세는 자리보다 두 자리 아래부터는 0 (읽기 쉽게)
        if (r.chance(0.6)) { const want = dir > 0 ? r.int(6, 9) : r.int(0, 3); s += (want - dig(s, e)) * D; }
        const holes = r.shuffle([1, 2, 3, 4]).slice(0, 2).sort((a, b) => a - b);
        return { v, s, e, dir, holes, ...(u ? { u } : {}) };
      }, (p) => { const last = p.s + p.dir * 4 * D; return p.s >= lo && last >= lo && last <= top && lenOf(last) === lenOf(p.s); });
    },
    prev: '4-1-1:3', pre: (p) => [p ? ({ 만: '4-1-1:4', 억: '4-1-1:5', 조: '4-1-1:6' }[p.u] || scaleOf(Math.max(p.s, p.s + p.dir * 4 * 10 ** p.e))) : '4-1-1:4', '2-2-1:6'],
    hint: '10만씩 뛰어 세면 십만의 자리 숫자가 1씩 커져요. 9 다음에는 윗자리로 1을 올려요: 390000 → 400000.',
  },
  {
    id: '4-1-1:8', fam: 'g4_BCMP', name: '큰 수의 크기 비교', kid: '큰 수 비교하기', sec: 12,
    gen: (r) => {
      // 언제나 세 수 중에서 고른다 (둘 중 고르기는 찍어서 맞히기 쉬움)
      const v = r.pick(['len', 'same', 'same', 'mix']), ask = r.pick(['max', 'min']);
      if (v === 'len') {
        // 자리 수가 다른 세 수 — 앞자리 숫자만 보면 틀리게
        const L = r.int(6, 9), mk = (len, lo, hi) => r.int(lo, hi) * 10 ** (len - 1) + r.int(0, 10 ** (len - 1) - 1);
        const xs = ask === 'max' ? [mk(L, 1, 3), mk(L - 1, 4, 6), mk(L - 1, 7, 9)] : [mk(L - 1, 7, 9), mk(L, 1, 3), mk(L, 4, 6)];
        return { v, ask, xs: r.shuffle(xs) };
      }
      if (v === 'mix') {
        const a = r.int(1, 9), b = r.int(1000, 9999), X = a * 1e8 + b * 1e4;
        const near1 = () => X + r.pick([-1, 1]) * r.pick([r.int(1, 9) * 1e4, r.int(1, 9) * 1e5, r.int(1, 9) * 1e6, r.int(1, 9) * 1e7]) + r.pick([0, r.int(1, 9999)]);
        return until(r, () => ({ v, ask, xs: r.shuffle([[a, b], near1(), near1()]) }), (p) => { const ys = p.xs.filter((x) => typeof x === 'number'); return ys[0] !== ys[1] && ys.every((y) => y !== X && y >= 1e8 && y < 1e9); });
      }
      // 자리 수가 같은 세 수 — 처음으로 다른 자리 뒤의 숫자는 반대로 (뒷자리에 끌리면 틀리게)
      const L = r.int(6, 9), k = r.int(1, L - 2);
      const prefix = [r.int(1, 9), ...Array.from({ length: k - 1 }, () => r.int(0, 9))];
      const ds = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3).sort((x, y) => x - y);
      const tail = (big) => Array.from({ length: L - k - 1 }, () => (big ? r.int(5, 9) : r.int(0, 4)));
      return { v, ask, xs: r.shuffle(ds.map((d, j) => Number([...prefix, d, ...tail(ask === 'max' ? j < 2 : j === 0)].join('')))) };
    },
    prev: '4-1-1:3', pre: (p) => [p ? (p.v === 'mix' ? '4-1-1:5' : scaleOf(Math.max(...p.xs.map((x) => (typeof x === 'number' ? x : 1e8))))) : '4-1-1:4', '2-2-1:7'],
    hint: '먼저 자리 수를 세어요. 일곱 자리 수 9500000은 여덟 자리 수 12000000보다 작고, 자리 수가 같으면 가장 높은 자리부터 차례로 비교해요.',
  },

  // ── 4-1-3 곱셈과 나눗셈
  {
    id: '4-1-3:2', fam: 'MUL', name: '(세 자리)×(몇십)', kid: '세 자리 수 × 몇십', sec: 25,
    gen: (r) => ({ a: r.chance(0.85) ? until(r, (r) => r.int(101, 999), (a) => a % 100 !== 0) : r.int(2, 9) * 100, b: r.int(2, 9) * 10 }),
    // 253 × 30 → 759처럼 0을 빠뜨린 답은 '몇십의 0을 빠뜨림'으로 (가족의 '둘째 줄을 밀지 않음'은 × 몇십몇용)
    make: (p) => withFirst(OPSBY.MUL.make(p), [{ test: (v) => v[0] * 10 === p.a * p.b, name: '곱하는 몇십의 0을 빠뜨림', to: '3-2-1:5' }]),
    is: isKind('MUL', '4-1-3:2'), prev: null, pre: (p) => [p ? mulKind(p.a, p.b / 10) : '3-2-1:4', '3-2-1:5'],
    hint: '253 × 30은 253 × 3 = 759를 먼저 구하고 0을 하나 붙여 7590이에요. 30은 3의 10배니까요.',
    tip: '300 × 30 = 9000처럼 몇백 × 몇십부터 0의 개수를 세게 하고, 253 × 30 = 253 × 3 × 10으로 넓혀요. 세로셈에서 일의 자리에 0을 먼저 쓰고 253 × 3을 그 왼쪽에 쓰게 해요.',
  },
  {
    id: '4-1-3:3', fam: 'MUL', name: '(세 자리)×(몇십몇)', kid: '세 자리 수 × 두 자리 수', sec: 50,
    gen: (r) => ({ a: until(r, (r) => r.int(101, 999), (a) => a % 100 !== 0), b: twoDigit(r, 12, 98) }),
    is: isKind('MUL', '4-1-3:3'), prev: '4-1-3:2',
    pre: (p) => [p ? mulKind(p.a, ones(p.b)) : '3-2-1:4', '3-2-1:8', p ? addKind(p.a * (p.b - ones(p.b)), p.a * ones(p.b)) : '3-1-1:4'],
    hint: '253 × 34는 253 × 4와 253 × 30을 따로 구해 더해요. 둘째 줄은 몇십을 곱한 것이라 한 칸 밀어 써요.',
    tip: '세로셈 두 줄(253 × 4 = 1012, 253 × 30 = 7590)을 쓰고 더하게 해요. 둘째 줄을 한 칸 밀어 쓰는 까닭(몇십을 곱한 것)을 말로 하게 하고, 줄마다 올림을 따로 적게 해요.',
  },
  {
    id: '4-1-3:4', fam: 'DIV', name: '몇십으로 나누기', kid: '몇십으로 나누기', sec: 25,
    gen: (r) => until(r, (r) => { const b = r.int(2, 9) * 10, q = r.int(2, 9), rr = r.chance(0.4) ? 0 : r.chance(0.5) ? r.int(1, b / 10 - 1) * 10 : r.int(1, b - 1); return { a: b * q + rr, b }; }, (p) => p.a >= 100 && p.a <= 999),
    make: (p) => {
      const q = Math.floor(p.a / p.b), r = p.a % p.b;
      // 몇십으로 나눌 때 몫이 1 어긋나면 '어림'이 아니라 몇십 × 몫을 확인하지 않은 것 (가족 이름은 몇십몇으로 나누기용)
      const it = withFirst(OPSBY.DIV.make(p), [{ test: (v) => Math.abs(v[0] - q) === 1 && (!r || v[1] == null || v[1] < p.b), name: '몫이 1 크거나 작음 (몇십 × 몫으로 확인하지 않음)', to: '3-1-4:2' }]);
      return withMore(it, [{ test: (v) => r % 10 === 0 && r > 0 && v[0] === q && v[1] === r / 10, name: '나머지에 0을 붙이지 않음 (몇십을 몇으로 보고 나눔)', to: null }]);
    },
    steps: divByTens,
    is: isKind('DIV', '4-1-3:4'), prev: null, pre: (p) => ['3-1-4:2', p && p.a % p.b ? '3-2-2:6' : '3-1-3:6'],
    hint: '170 ÷ 30은 30 × 5 = 150이 170을 넘지 않는 가장 큰 곱이라 몫이 5예요. 나머지는 170 − 150 = 20이에요.',
    tip: '170 ÷ 30은 17 ÷ 3과 몫이 같지만 나머지는 10배(20)라는 것을 짚어요. 30 × 몫으로 확인하고, 나머지를 2로 쓰는 실수를 살펴요.',
  },
  {
    id: '4-1-3:5', fam: 'DIV', name: '몇십몇으로 나누기 (몫 한 자리)', kid: '두 자리 수로 나누기 (몫이 한 자리)', sec: 35,
    gen: (r) => { const b = twoDigit(r, 15, 94), q = r.int(2, 9), rr = r.chance(0.4) ? 0 : r.int(1, b - 1); return { a: b * q + rr, b }; },
    steps: divOneDigitQ,
    is: isKind('DIV', '4-1-3:5'), prev: '4-1-3:4', pre: (p) => [p ? mulKind(p.b, Math.floor(p.a / p.b)) : '3-1-4:6', '3-2-2:7', ...(p && p.a % p.b ? [subKind(p.a, p.a - (p.a % p.b))] : [])],
    hint: '196 ÷ 28은 28을 30으로 어림해 몫을 6으로 짐작해요. 28 × 6 = 168이고 남은 28이 28보다 작지 않으니 몫을 7로 고쳐요.',
    tip: '나누는 수를 몇십으로 어림해(28 → 30) 몫을 짐작하고, 곱이 나누어지는 수보다 크면 1 줄이고 남은 수가 나누는 수보다 크거나 같으면 1 늘려요. 고치는 과정을 말로 하게 해요.',
    bridge: '나누는 수를 몇십으로 어림해 몫을 짐작하고, 곱해 보고 몫을 1 크게·작게 고치는 생각이 새로 나와요.',
  },
  {
    id: '4-1-3:6', fam: 'DIV', name: '몇십몇으로 나누기 (몫 두 자리)', kid: '두 자리 수로 나누기 (몫이 두 자리, 나누어떨어짐)', sec: 50,
    gen: (r) => until(r, (r) => { const b = twoDigit(r, 11, 89); return { a: b * r.int(10, Math.floor(999 / b)), b }; }, (p) => (p.a / p.b) % 10 !== 0 || r.chance(0.15)),
    steps: divTwoDigitQ,
    is: isKind('DIV', '4-1-3:6'), prev: '4-1-3:5', pre: ['3-2-1:5', '3-2-2:9'],
    hint: '672 ÷ 32는 먼저 67 ÷ 32로 몫의 십의 자리 2를 구해요. 672 − 640 = 32를 다시 32로 나누면 몫의 일의 자리 1, 몫은 21이에요.',
    tip: '앞의 두 자리(67)를 32로 나눠 몫 2를 십의 자리에 쓰고, 32 × 20 = 640을 빼고 남은 수를 다시 나눠요. 몫을 쓰는 자리를 맞추는 것이 핵심이에요.',
  },
  {
    id: '4-1-3:7', fam: 'DIV', name: '몇십몇으로 나누기 (나머지)', kid: '두 자리 수로 나누기 (몫이 두 자리, 나머지 있음)', sec: 60,
    gen: (r) => until(r, (r) => { const b = twoDigit(r, 11, 89), q = r.int(10, Math.floor(998 / b)); return { a: b * q + r.int(1, Math.min(b - 1, 999 - b * q)), b }; }, (p) => Math.floor(p.a / p.b) % 10 !== 0 || r.chance(0.15)),
    steps: divTwoDigitQ,
    is: isKind('DIV', '4-1-3:7'), prev: '4-1-3:6', pre: ['3-2-2:10'],
    hint: '685 ÷ 32는 68 ÷ 32로 몫의 십의 자리 2, 남은 45 ÷ 32로 일의 자리 1을 구해 21 … 13이에요. 나머지 13은 32보다 작아야 해요.',
    tip: '몫의 십의 자리부터 구하고 남은 수를 내려 다시 나눠요. 끝에 나머지가 나누는 수보다 작은지 확인하고 32 × 21 + 13 = 685로 검산하게 해요.',
  },

  // ── 4-1-6 규칙과 관계
  {
    id: '4-1-6:2', fam: 'g4_SEQ', name: '수의 배열에서 규칙', kid: '수의 배열에서 규칙 찾기', sec: 25,
    gen: (r) => {
      const v = r.pick(['line', 'line', 'line', 'grid', 'rule', 'grule']);
      if (v === 'grid' || v === 'grule') {
        return until(r, (r) => {
          const dr = r.pick([1000, 100, 10000, 10]), dc = r.pick([1, 10, 100, 11, 101, 1000, 1001].filter((x) => x !== dr && x * 4 < dr * 10)), base = r.int(1000, 8999);
          return { v, base, dr, dc, hi: r.int(1, 2), hj: r.int(1, 3), ...(v === 'grule' ? { dir: r.pick(['row', 'col']) } : {}) };
        }, (p) => p.base + 2 * p.dr + 3 * p.dc <= 99999 && p.dc !== p.dr);
      }
      const op = r.pick(['+', '+', '−', '×', '÷']);
      const p = { v, op };
      if (op === '+' || op === '−') { p.d = r.pick([10, 100, 1000, 11, 101, 110, 1001, 1010, 1100, 200, 500, 2000, 50, 25]); p.s = op === '+' ? r.int(100, 9000) : r.int(4 * p.d + 100, 4 * p.d + 9000); }
      else { p.d = r.pick([2, 3, 4, 5, 10]); p.s = r.int(1, p.d === 10 ? 9 : 5); }
      if (v === 'rule' && op === '÷') p.op = '×';
      p.holes = r.chance(0.6) ? [r.int(1, 4)] : r.shuffle([1, 2, 3, 4]).slice(0, 2).sort((a, b) => a - b);
      return p;
    },
    prev: null, pre: (p) => (p && (p.op === '×' || p.op === '÷') ? [danOf(p.d === 10 ? 1 : p.d), '2-1-6:4'] : ['4-1-1:7', '2-2-1:6']),
    hint: '옆의 수와 얼마나 차이 나는지, 몇 배인지 살펴봐요. 1205, 1305, 1405는 100씩 커져요.',
  },
  {
    id: '4-1-6:3', fam: 'g4_RULEX', name: '규칙을 식으로', kid: '규칙을 식으로 나타내기', sec: 30,
    gen: (r) => {
      const v = r.pick(['next', 'nth', 'nth', 'far']);
      if (v === 'next') {
        const op = r.pick(['+', '−', '×']);
        if (op === '×') return { v, op, s: r.int(1, 5), d: r.pick([2, 3, 4, 5]) };
        const d = r.pick([3, 4, 5, 6, 7, 8, 9, 11, 12, 15, 20, 25, 50, 100]);
        return { v, op, d, s: op === '+' ? r.int(1, 60) : r.int(5 * d + 1, 5 * d + 60) };
      }
      return { v, op: '+', s: r.int(1, 20), d: r.int(2, 9), n: v === 'nth' ? r.int(5, 9) : r.pick([10, 12, 15, 20]) };
    },
    prev: '4-1-6:2', pre: (p) => [p && p.v !== 'next' ? mulKind(p.d, p.n - 1) : '2-1-6:7'],
    hint: '5, 8, 11, 14는 3씩 커져요. 다섯째 수는 첫째 수에서 3을 4번 더한 수라서 5 + 3 × 4 = 17이에요.',
  },
  {
    id: '4-1-6:6', fam: 'g4_EQPAT', name: '덧셈식·뺄셈식 배열의 규칙', kid: '덧셈식·뺄셈식에서 규칙 찾기', sec: 25,
    gen: (r) => until(r, (r) => {
      const op = r.pick(['+', '−']), kind = op === '+' ? r.pick(['both', 'one', 'opp']) : r.pick(['both', 'one', 'sub']);
      const k = r.pick([1, 10, 100, 11, 20, 50, 200]), n = r.int(3, 4);
      const a = r.int(1, 7) * 100 + r.int(0, 9) * 10 + r.int(0, 9), b = r.int(1, 5) * 100 + r.int(0, 9) * 10 + r.int(0, 9);
      return { op, kind, k, n, a: op === '−' ? a + b + (kind === 'sub' ? n * k : 0) : a, b: kind === 'opp' ? b + n * k : b, ask: r.chance(0.7) ? 'res' : 'opnd' };
    }, (p) => eqLines(p).every(([x, y, z]) => x > 0 && y > 0 && z > 0 && x < 10000 && y < 10000)),
    prev: '4-1-6:2', pre: (p) => { if (!p) return ['3-1-1:4']; const [x, y] = eqLines(p)[p.n]; return [p.op === '+' ? addKind(x, y) : subKind(x, y)]; },
    hint: '더하는 두 수가 각각 10씩 커지면 합은 20씩 커져요. 한 수가 커지고 다른 수가 똑같이 작아지면 합은 그대로예요.',
  },
  {
    id: '4-1-6:7', fam: 'g4_MDPAT', name: '곱셈식·나눗셈식 배열의 규칙', kid: '곱셈식·나눗셈식에서 규칙 찾기', sec: 30,
    gen: (r) => {
      const kind = r.pick(['r101', 'd101', 'x10', 'dbl', 'divk', 'dsame', 'r101', 'nines']);
      if (kind === 'r101' || kind === 'd101') { const g = r.pick([1, 11, 2, 10, 3]), at = r.int(4, 6); return { kind, g, at, x: r.int(11, 99 - at * g), ask: r.chance(0.25) ? 'left' : 'res' }; }
      if (kind === 'x10') return { kind, a: r.int(11, 99), b: r.int(2, 9) };
      if (kind === 'dbl') return { kind, a: r.int(11, 40), b: r.int(2, 6) };
      if (kind === 'divk') return { kind, dv: r.int(2, 9), q: r.int(11, 40), at: r.int(4, 6) };
      if (kind === 'dsame') return { kind, q: r.int(2, 9) * r.pick([1, 10]), m: r.int(11, 19) };
      return { kind, w: r.pick([9, 1]) };
    },
    prev: '4-1-6:6',
    pre: (p) => { if (!p) return ['4-1-3:3']; const L = mdLines(p), [a, b, , o] = L[L.length - 1]; return [o === '×' ? mulKind(a, b) : divKind(a, b)]; },
    hint: '101 × 23 = 2323, 101 × 24 = 2424처럼 곱해지는 두 자리 수가 두 번 나와요. 식이 어떻게 바뀌는지 보면 계산하지 않고도 알 수 있어요.',
  },
  {
    id: '4-1-6:8', fam: 'R0', name: '등호로 같은 양 나타내기', kid: '= 양쪽을 같게 만들기', sec: 15,
    gen: (r) => {
      const v = r.pick(['+', '+', 'plus2', '−', '×', 'judge']);
      if (v === '+' || v === 'judge') { const p = until(r, (r) => { const a = r.int(2, 9), b = r.int(2, 9); return { a, b, c: r.int(1, a + b - 1) }; }, (p) => p.c !== p.a && p.c !== p.b && p.a + p.b - p.c !== p.c); return v === 'judge' ? { op: 'judge', ...p, d: r.int(1, 2), order: r.shuffle([0, 1, 2]) } : p; }
      if (v === 'plus2') { const a = until(r, (r) => r.int(21, 68), (a) => a % 10 >= 5), b = r.int(12, 39); return r.chance(0.5) ? { a, b, c: Math.ceil(a / 10) * 10 } : { a: b, b: a, c: Math.ceil(a / 10) * 10 }; }
      if (v === '−') return r.chance(0.5) ? { op: '-', a: r.int(11, 19), b: r.int(2, 9), c: r.int(1, 9) } : until(r, (r) => { const b = r.int(12, 49); return { op: '-', a: r.int(b + 10, 89), b, c: Math.ceil(b / 10) * 10 }; }, (p) => p.b % 10 >= 5);
      return until(r, (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9); return { op: '×', a, b, c }; }, (p) => p.c !== p.a && p.c !== p.b && (p.a * p.b) % p.c === 0 && (p.a * p.b) / p.c <= 9 && (p.a * p.b) / p.c >= 2 && (p.a * p.b) / p.c !== p.a && (p.a * p.b) / p.c !== p.b);
    },
    make: (p) => {
      if (!p.op) return C.R0.make(p);
      if (p.op === '-') return nums([`${p.a} − ${p.b} = `, B(0), ` − ${p.c}`], p.a - p.b + p.c, {
        bugs: [{ test: (v) => v[0] === p.a - p.b, name: '등호를 답 쓰는 자리로 봄', to: null }, { test: (v) => v[0] === p.a - p.b - p.c, name: '양쪽이 같아지게 하지 않고 이어서 뺌', to: '2-1-3:9' }],
      });
      if (p.op === '×') return nums([`${p.a} × ${p.b} = ${p.c} × `, B(0)], (p.a * p.b) / p.c, {
        bugs: [{ test: (v) => v[0] === p.a * p.b, name: '등호를 답 쓰는 자리로 봄', to: null }],
      });
      const s = p.a + p.b, eqs = [`${p.a} + ${p.b} = ${p.c} + ${s - p.c}`, `${p.a} + ${p.b} = ${s} + ${p.c}`, `${p.a} + ${p.b} = ${p.c} + ${s - p.c + p.d}`];
      const ch = p.order.map((k) => [eqs[k]]);
      return pick(['옳은 식을 고르세요.'], ch, p.order.indexOf(0), {
        bugs: { [p.order.indexOf(1)]: { name: '등호 뒤를 답 쓰는 자리로 봄 (이어서 계산)', to: null }, [p.order.indexOf(2)]: { name: '양쪽 크기를 비교하지 않음', to: '2-1-3:10' } },
      });
    },
    steps: (p) => {
      if (p.op === 'judge') return [];
      if (!p.op) return [{ c: 'ADD', p: { a: p.a, b: p.b }, why: '왼쪽을 먼저 계산해요.' }, { c: 'SUB', p: { a: p.a + p.b, b: p.c }, why: `오른쪽도 ${p.a + p.b}${P(p.a + p.b, '이', '가')} 되어야 해요. 그 수에서 ${p.c}${P(p.c, '을', '를')} 빼요.` }];
      if (p.op === '-') return [{ c: 'SUB', p: { a: p.a, b: p.b }, why: '왼쪽을 먼저 계산해요.' }, { c: 'ADD', p: { a: p.a - p.b, b: p.c }, why: `□에서 ${p.c}${P(p.c, '을', '를')} 빼면 ${p.a - p.b}${P(p.a - p.b, '이', '가')} 되어야 해요.` }];
      return [{ c: 'MUL', p: { a: p.a, b: p.b }, why: '왼쪽을 먼저 계산해요.' }, { c: 'DIV', p: { a: p.a * p.b, b: p.c }, why: `${p.c}에 몇을 곱하면 ${p.a * p.b}${P(p.a * p.b, '이', '가')} 되는지 찾아요.` }];
    },
    prev: null, pre: (p) => (p && p.op === '×' ? ['3-1-3:4', '2-1-3:10'] : ['2-1-3:10', '2-1-3:9']),
    hint: '=는 "양쪽 크기가 같다"는 뜻이에요. 7 + 5 = □ + 6이면 왼쪽이 12니까 □ + 6도 12가 되어야 해요.',
    bridge: '등호를 "계산 결과를 쓰라"는 신호가 아니라 양쪽이 같다는 관계로 보는 생각이에요(2022 개정 신설).',
  },

  // ── 4-2-1 분수의 덧셈과 뺄셈 (분모가 같은 분수)
  {
    id: '4-2-1:2', fam: 'F6', name: '진분수의 덧셈', kid: '진분수 더하기', sec: 20, def: true,
    gen: (r) => {
      const d = r.int(3, 12);
      if (r.chance(0.5)) { const a = r.int(1, d - 2); return { op: '+', a, b: r.int(1, d - 1 - a), d }; }
      const a = r.int(2, d - 1); return { op: '+', a, b: r.int(d - a + 1, d - 1), d };
    },
    make: addSameDen,
    steps: (p) => {
      const s = p.a + p.b, w = Math.floor(s / p.d), r = s % p.d;
      return [
        { c: 'ADD', p: { a: p.a, b: p.b }, why: `분모는 그대로 두고 분자끼리 더해요. 1/${p.d}이 모두 몇 개인가요?` },
        w >= 1 && r ? { c: 'F5', p: { v: 'toMix', w, n: r, d: p.d }, why: `1보다 큰 ${s}/${p.d}${P(s, '을', '를')} 대분수로 바꿔요.` } : null,
      ];
    },
    is: (p) => p.op === '+', prev: null, pre: (p) => ['3-1-6:5', ...(p && p.a + p.b >= p.d ? ['3-2-4:6'] : [])],
    hint: '분모가 같으면 분자끼리 더해요. 4/7 + 5/7 = 9/7이고, 1보다 크면 1 2/7처럼 대분수로 바꿔요.',
  },
  {
    id: '4-2-1:3', fam: 'g4_FMIX', name: '대분수의 덧셈', kid: '대분수 더하기', sec: 30,
    gen: (r) => {
      const d = r.int(3, 10), w1 = r.int(1, 5), w2 = r.int(1, 4);
      if (r.chance(0.5)) { const n1 = r.int(1, d - 2); return { op: '+', w1, n1, w2, n2: r.int(1, d - 1 - n1), d }; }
      const n1 = r.int(2, d - 1); return { op: '+', w1, n1, w2, n2: r.int(d - n1 + 1, d - 1), d };
    },
    is: (p) => p.op === '+', prev: '4-2-1:2', pre: ['3-2-4:6'],
    hint: '자연수끼리, 분수끼리 더해요. 1 3/5 + 2 4/5 = 3 7/5이고, 7/5은 1 2/5니까 4 2/5예요.',
    tip: '자연수끼리, 분수끼리 더하고 분수 부분이 1보다 크면(7/5) 1을 자연수 부분으로 올려요. 가분수로 바꿔 더하는 방법(8/5 + 14/5 = 22/5)도 보여 주고 두 답이 같음을 확인해요.',
  },
  {
    id: '4-2-1:4', fam: 'F6', name: '진분수의 뺄셈', kid: '진분수 빼기', sec: 15,
    gen: (r) => { const d = r.int(3, 12), a = r.int(2, d - 1); return { op: '-', a, b: r.int(1, a - 1), d }; },
    make: subSameDen,
    steps: (p) => [{ c: 'SUB', p: { a: p.a, b: p.b }, why: `분모는 그대로 두고 분자끼리 빼요. 1/${p.d}이 몇 개 남나요?` }],
    is: (p) => p.op === '-', prev: null, pre: ['3-1-6:5'],
    hint: '분모가 같으면 분자끼리 빼요. 분모는 그대로예요: 5/8 − 2/8 = 3/8.',
    tip: '5/8 − 2/8은 1/8이 5개에서 2개를 덜어 내 3개 = 3/8이에요. 분모끼리도 빼거나 분모를 바꾸는 실수를 수 막대로 짚어요.',
  },
  {
    id: '4-2-1:5', fam: 'g4_FMIX', name: '대분수의 뺄셈 (받아내림 없음)', kid: '대분수 빼기 (분수끼리 뺄 수 있을 때)', sec: 25,
    gen: (r) => { const d = r.int(3, 10), n1 = r.int(2, d - 1), w1 = r.int(2, 6); return { op: '-', w1, n1, w2: r.chance(0.2) ? 0 : r.int(1, w1 - 1), n2: r.int(1, n1 - 1), d }; },
    is: (p) => p.op === '-' && p.n1 > 0 && p.n1 >= p.n2, prev: '4-2-1:4', pre: ['3-2-4:6'],
    hint: '자연수끼리, 분수끼리 빼요. 3 4/5 − 1 1/5 = 2 3/5예요.',
    tip: '자연수끼리, 분수끼리 빼는 방법과 가분수로 바꿔 빼는 방법(19/5 − 6/5 = 13/5)을 둘 다 보여 주고 답이 같음을 확인해요.',
  },
  {
    id: '4-2-1:6', fam: 'g4_FMIX', name: '자연수와 분수의 뺄셈', kid: '자연수에서 분수 빼기', sec: 30,
    gen: (r) => { const d = r.int(3, 10), w1 = r.int(1, 6); return { op: '-', w1, n1: 0, w2: w1 > 1 && r.chance(0.7) ? r.int(1, w1 - 1) : 0, n2: r.int(1, d - 1), d }; },
    is: (p) => p.op === '=' || (p.op === '-' && !p.n1), prev: '4-2-1:5', pre: ['3-2-4:6', '3-2-4:5'],
    hint: '자연수에서 1을 분수로 바꿔요. 3 − 1 2/5는 3을 2 5/5로 바꿔서 2 5/5 − 1 2/5 = 1 3/5예요.',
    bridge: '자연수 1을 분모가 같은 가분수(5/5)로 바꾸는 생각이 새로 나와요.',
  },
  {
    id: '4-2-1:7', fam: 'g4_FMIX', name: '대분수의 뺄셈 (받아내림)', kid: '대분수 빼기 (분수끼리 뺄 수 없을 때)', sec: 40,
    gen: (r) => { const d = r.int(3, 10), n1 = r.int(1, d - 2), w1 = r.int(2, 7); return { op: '-', w1, n1, w2: r.chance(0.2) ? 0 : r.int(1, w1 - 1), n2: r.int(n1 + 1, d - 1), d }; },
    is: (p) => p.op === '-' && p.n1 > 0 && p.n1 < p.n2, prev: '4-2-1:6', pre: ['3-2-4:6'],
    hint: '분수 부분끼리 뺄 수 없으면 자연수에서 1을 5/5처럼 분수로 바꿔 보태요. 3 1/5 − 1 3/5는 2 6/5 − 1 3/5 = 1 3/5예요.',
    bridge: '자연수 뺄셈의 받아내림(10)과 달리 1을 분모만큼의 조각(5/5)으로 바꿔 보태요.',
  },

  // ── 4-2-3 소수의 덧셈과 뺄셈
  {
    id: '4-2-3:2', fam: 'DEC2', name: '소수 두 자리 수', kid: '소수 두 자리 수 (0.01이 몇 개)', sec: 12,
    gen: (r) => r.pick([
      () => ({ v: 'count', n: nz(r, 11, 999) }),
      () => ({ v: 'expand', n: until(r, (r) => r.int(101, 999), (n) => n % 10 !== 0 && dig(n, 1) !== 0) }),
      () => ({ v: 'units', n: nz(r, 11, 999) }),
      () => ({ v: 'frac', n: nz(r, 11, 99) }),
    ])(),
    make: (p) => {
      // 끝자리가 0인 수(1.20 → 1.2)는 읽는 글자에 맞춰 조사를 붙인다
      if (p.v !== 'units' || p.n % 10) return C.DEC2.make(p);
      const s = fmtD(p.n / 10, 1);
      return nums([`${s}${PK(s, '은', '는')} 0.01이 `, B(0), '개예요.'], p.n, { bugs: [{ test: (v) => v[0] === Math.floor(p.n / 10), name: '0.1이 몇 개인지로 셈', to: '3-1-6:9' }] });
    },
    is: (p) => ['count', 'expand', 'units', 'frac'].includes(p.v), prev: null, pre: ['3-1-6:9', '3-1-6:8'],
    hint: '0.01이 100개면 1이에요. 1.25는 1과 0.2와 0.05예요.',
  },
  {
    id: '4-2-3:4', fam: 'g4_DEC3P', name: '소수 세 자리 수', kid: '소수 세 자리 수 (0.001이 몇 개)', sec: 15,
    gen: (r) => r.pick([
      () => ({ v: 'count', n: nz(r, 11, 999) }),
      () => ({ v: 'units', n: nz(r, 1001, 9999) }),
      () => ({ v: 'km', n: nz(r, 1001, 9999) }),
      () => ({ v: 'frac', n: nz(r, 11, 999) }),
      () => until(r, (r) => { const n = nz(r, 1001, 9999), ok = uniqPlaces(n, 0, 3); return { v: 'value', n, i: ok.length ? r.pick(ok) : -1 }; }, (p) => p.i >= 0),
    ])(),
    prev: '4-2-3:2', pre: ['3-1-6:9'],
    hint: '0.001이 1000개면 1이에요. 1.234에서 4는 소수 셋째 자리 숫자이고 0.004를 나타내요.',
  },
  {
    id: '4-2-3:6', fam: 'DEC3', name: '소수의 크기 비교', kid: '소수 크기 비교', sec: 10,
    gen: (r) => {
      if (r.chance(0.2)) {
        // 자릿수가 적은 수가 답이 되거나(0.7 > 0.65·0.68) 함정이 되게(0.6은 0.62보다 작아요) — 세 수 중에서
        const ask = r.pick(['max', 'min']), w = r.int(0, 9), t = r.int(2, 8), u1 = r.int(1, 9), u2 = until(r, (r) => r.int(1, 9), (x) => x !== u1);
        const xs = ask === 'max' ? [[w * 10 + t, 1], [w * 100 + (t - 1) * 10 + u1, 2], [w * 100 + (t - 1) * 10 + u2, 2]]
          : [[w * 10 + t, 1], [w * 100 + t * 10 + u1, 2], [w * 100 + (t - 1) * 10 + u2, 2]];
        return { ask, xs: r.shuffle(xs) };
      }
      // 자릿수가 서로 다른(한·두·세 자리) 세 소수 — 자릿수에 끌리면 틀리게
      const ask = r.pick(['max', 'min']), w = r.int(0, 9), t = r.int(1, 8);
      if (r.chance(0.2)) return { ask, xs: r.shuffle([[w * 100 + 90 + r.int(1, 9), 2], [(w + 1) * 10 + r.int(1, 3), 1], [w * 1000 + 800 + r.int(1, 99), 3]].map(([m, k]) => [m % 10 ? m : m + 1, k])) };
      const mkd = (k) => { let m = w; for (let j = 1; j <= k; j++) m = m * 10 + (j === 1 ? t + r.int(0, 1) : j === k ? r.int(1, 9) : r.int(0, 9)); return [m, k]; };
      return { ask, xs: r.shuffle([mkd(1), mkd(2), mkd(3)]) };
    },
    make: (p) => {
      if (p.xs == null) return C.DEC3.make(p);
      const vs = p.xs.map(([m, k]) => m / 10 ** k), best = p.ask === 'min' ? Math.min(...vs) : Math.max(...vs), right = vs.indexOf(best), kr = p.xs[right][1];
      const bugs = {};
      p.xs.forEach(([, k], j) => {
        if (j === right) return;
        bugs[j] = p.ask !== 'min' && k > kr ? { name: '자릿수가 많으면 크다고 봄 (자연수 규칙)', to: '4-2-3:2' }
          : p.ask === 'min' && k < kr ? { name: '자릿수가 적으면 작다고 봄 (자연수 규칙)', to: '4-2-3:2' }
            : { name: '높은 자리부터 비교하지 않음', to: '4-2-3:2' };
      });
      return pick([p.ask === 'min' ? '가장 작은 수를 고르세요.' : '가장 큰 수를 고르세요.'], p.xs.map(([m, k]) => [fmtD(m, k)]), right, { bugs });
    },
    prev: '4-2-3:4', pre: ['3-1-6:10'],
    hint: '자연수 부분부터, 그다음 소수 첫째 자리, 둘째 자리 순서로 비교해요. 0.7은 0.65보다 커요(0.70 > 0.65).',
  },
  {
    id: '4-2-3:7', fam: 'DEC4', name: '소수 사이의 관계', kid: '소수의 10배, 100배, 1/10, 1/100', sec: 12,
    gen: (r) => {
      const v = r.pick(['x10', 'x100', 'd10', 'd100', 'rel', 'inv']);
      if (v === 'd100') return { v, m: nz(r, 11, 999) };
      if (v === 'rel') { const i = r.int(0, 2), j = r.int(i + 1, 3); return { v, i, j, big: r.chance(0.5) }; }
      if (v === 'inv') { const f = r.pick([10, 100]); return { v, f, m: f === 10 ? nz(r, 101, 999) : nz(r, 11, 999) }; }
      return { v, k: nz(r, 11, 299) };
    },
    make: (p) => {
      if (['x10', 'x100', 'd10'].includes(p.v)) return C.DEC4.make(p);
      if (p.v === 'd100') { const s = fmtD(p.m, 1); return nums([`${s}의 1/100은 `, B(0)], decV(p.m, 3), { noFrac: true, bugs: [{ test: (v) => near(v[0], decV(p.m, 2)), name: '1/10과 1/100을 헷갈림', to: '4-2-3:4' }, { test: (v) => near(v[0], p.m * 10), name: '1/100을 100배로 봄', to: '4-2-3:4' }] }); }
      if (p.v === 'rel') {
        const U = ['1', '0.1', '0.01', '0.001'], k = 10 ** (p.j - p.i);
        const tok = p.big ? [`${U[p.i]}은 ${U[p.j]}의 `, B(0), '배예요.'] : [`${U[p.j]}은 ${U[p.i]}의 `, { f: [1, B(0)] }, '이에요.'];
        return nums(tok, k, { bugs: [x10bug(k, '4-2-3:4', '자리 수를 하나 잘못 셈')] });
      }
      const k = p.f === 10 ? 2 : 1, s = fmtD(p.m, k);
      return nums([B(0), `의 ${p.f}배는 ${s}${PK(s, '이에요', '예요')}.`], decV(p.m, 3), {
        noFrac: true, bugs: [{ test: (v) => near(v[0], decV(p.m * p.f, k)), name: '거꾸로 커지게 함 (□를 구하려면 나눠야 해요)', to: null }],
      });
    },
    prev: '4-2-3:4', pre: ['4-1-1:4'],
    hint: '10배 하면 숫자가 한 자리씩 왼쪽으로, 1/10 하면 오른쪽으로 옮겨 가요. 2.57의 10배는 25.7, 1/10은 0.257이에요.',
  },
  {
    id: '4-2-3:8', fam: 'g4_DECAS', name: '소수 한 자리 수의 덧셈', kid: '소수 한 자리 수 더하기', sec: 20,
    gen: (r) => until(r, (r) => ({ op: '+', a: nz(r, 2, 99), ka: 1, b: nz(r, 2, 99), kb: 1 }), (p) => (p.a % 10) + (p.b % 10) >= 10 || r.chance(0.35)),
    is: decIs('+', 1), prev: null, pre: decPre(1, '+'),
    hint: '소수점을 맞춰 세로로 쓰고 자연수처럼 더해요. 소수 첫째 자리 합이 10이 넘으면 일의 자리로 1을 올려요: 1.7 + 2.5 = 4.2.',
  },
  {
    id: '4-2-3:9', fam: 'g4_DECAS', name: '소수 두 자리 수의 덧셈', kid: '소수 두 자리 수 더하기', sec: 25,
    gen: (r) => {
      if (r.chance(0.3)) { const one = nz(r, 2, 99), two = nz(r, 11, 999); return r.chance(0.5) ? { op: '+', a: one, ka: 1, b: two, kb: 2 } : { op: '+', a: two, ka: 2, b: one, kb: 1 }; }
      return until(r, (r) => ({ op: '+', a: nz(r, 11, 999), ka: 2, b: nz(r, 11, 999), kb: 2 }), (p) => addCarries(p.a, p.b) > 0 || r.chance(0.3));
    },
    is: decIs('+', 2), prev: '4-2-3:8', pre: decPre(2, '+'),
    hint: '소수점끼리 맞춰 써요. 1.2 + 0.35는 1.20 + 0.35로 보고 더해 1.55예요.',
    bridge: '자릿수가 다르면 끝을 맞추지 않고 소수점을 맞춰요(1.2 = 1.20).',
  },
  {
    id: '4-2-3:10', fam: 'g4_DECAS', name: '소수 한 자리 수의 뺄셈', kid: '소수 한 자리 수 빼기', sec: 20,
    gen: (r) => until(r, (r) => { const a = nz(r, 12, 99); return { op: '-', a, ka: 1, b: nz(r, 1, a - 1), kb: 1 }; }, (p) => p.a - p.b >= 1 && (p.a % 10 < p.b % 10 || r.chance(0.35))),
    is: decIs('-', 1), prev: null, pre: decPre(1, '-'),
    hint: '소수점을 맞추고 자연수처럼 빼요. 소수 첫째 자리에서 뺄 수 없으면 일의 자리에서 1을 받아내려요: 4.2 − 1.7 = 2.5.',
  },
  {
    id: '4-2-3:11', fam: 'g4_DECAS', name: '소수 두 자리 수의 뺄셈', kid: '소수 두 자리 수 빼기', sec: 30,
    gen: (r) => {
      if (r.chance(0.3)) {
        return until(r, (r) => (r.chance(0.6) ? { op: '-', a: nz(r, 12, 99), ka: 1, b: nz(r, 11, 999), kb: 2 } : { op: '-', a: nz(r, 101, 999), ka: 2, b: nz(r, 1, 99), kb: 1 }), (p) => p.a * 10 ** (2 - p.ka) - p.b * 10 ** (2 - p.kb) >= 1);
      }
      return until(r, (r) => { const a = nz(r, 102, 999); return { op: '-', a, ka: 2, b: nz(r, 11, a - 1), kb: 2 }; }, (p) => subBorrowsLocal(p.a, p.b) > 0 || r.chance(0.3));
    },
    is: decIs('-', 2), prev: '4-2-3:10', pre: decPre(2, '-'),
    hint: '소수점끼리 맞춰 써요. 3.5 − 1.27은 3.50 − 1.27로 보고 빼서 2.23이에요.',
  },
];

function addCarries(a, b) { let c = 0, n = 0; while (a > 0 || b > 0) { const s = (a % 10) + (b % 10) + c; c = s >= 10 ? 1 : 0; n += c; a = Math.floor(a / 10); b = Math.floor(b / 10); } return n; }
function subBorrowsLocal(a, b) { let br = 0, n = 0; while (a > 0) { const x = (a % 10) - br, y = b % 10; br = x < y ? 1 : 0; n += br; a = Math.floor(a / 10); b = Math.floor(b / 10); } return n; }

export default { FAMS, LESSONS };
