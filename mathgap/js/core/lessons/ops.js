// 자연수 사칙 계산 — 모든 학년이 함께 쓰는 문항 가족과 '이 계산은 몇 학년 몇 차시인가' 분류기
//   ADD {a,b} · ADD3 {a,b,c} · SUB {a,b} · MUL {a,b} · DIV {a,b} (나누어떨어지지 않으면 몫과 나머지)
//   addKind/subKind/mulKind/divKind(a, b) → 차시 id. 차시 정의의 is(p)는 이 분류기와 같아야 한다(한 곳에서만 정함)
//   예전 개념 id(A1~A8, M3~M10, D4~D7)로 적힌 단계·오답 방향은 ALIAS로 이 가족에 옮겨 온다
import { nums, B, J, P } from '../concepts/kit.js';
import { addNoCarry, subSmallFromLarge } from '../concepts/num.js';
import { forgotCarry, carryThenMul } from '../concepts/mul.js';

const len = (n) => String(Math.abs(Math.trunc(n))).length;
const dig = (n, k) => Math.floor(n / 10 ** k) % 10;
export const ones = (n) => n % 10;
export const tens = (n) => Math.floor(n / 10) % 10;

// 받아올림 수 (자리마다 합 + 올림 ≥ 10)
export function addCarries(a, b) {
  let c = 0, k = 0, n = 0;
  for (let i = 0; i < Math.max(len(a), len(b)); i++) { const s = dig(a, i) + dig(b, i) + c; c = s >= 10 ? 1 : 0; n += c; k++; }
  return n;
}
// 받아내림 수
export function subBorrows(a, b) {
  let br = 0, n = 0;
  for (let i = 0; i < len(a); i++) { const x = dig(a, i) - br, y = dig(b, i); br = x < y ? 1 : 0; n += br; }
  return n;
}
// (여러 자리) × (한 자리)의 올림 수
export function mulCarries(a, d) {
  let c = 0, n = 0;
  for (let i = 0; i < len(a); i++) { const s = dig(a, i) * d + c; c = Math.floor(s / 10); if (s >= 10) n++; }
  return n;
}

// ── 분류기 (차시 id)
export function addKind(a, b) {
  const big = Math.max(a, b), small = Math.min(a, b), s = a + b, dl = len(big), ds = len(small);
  if (s <= 9) return small === 0 ? '1-1-3:12' : '1-1-3:6';
  if (dl === 1) return s === 10 ? '1-2-4:4' : '1-2-6:2';
  if (dl === 2 && ds === 1) return addCarries(a, b) ? '2-1-3:2' : '1-2-2:2';
  if (dl === 2) { const c = addCarries(a, b); return c === 0 ? '1-2-2:3' : s >= 100 ? '2-1-3:4' : '2-1-3:3'; }
  const c = addCarries(a, b);
  return c === 0 ? '3-1-1:2' : c === 1 ? '3-1-1:3' : '3-1-1:4';
}
export function subKind(a, b) {
  if (a <= 9) return b === 0 || a === b ? '1-1-3:12' : '1-1-3:10';
  if (a === 10 && b <= 9) return '1-2-4:5';
  const la = len(a), lb = len(b), br = subBorrows(a, b);
  if (la === 2 && lb === 1) return !br ? '1-2-2:4' : a < 20 ? '1-2-6:4' : '2-1-3:5';
  if (la === 2) return !br ? '1-2-2:5' : ones(a) === 0 ? '2-1-3:6' : '2-1-3:7';
  return br === 0 ? '3-1-1:5' : br === 1 ? '3-1-1:6' : '3-1-1:7';
}
const DAN = { 0: '2-2-2:8', 1: '2-2-2:8', 2: '2-2-2:2', 5: '2-2-2:3', 3: '2-2-2:4', 6: '2-2-2:4', 4: '2-2-2:5', 8: '2-2-2:5', 7: '2-2-2:6', 9: '2-2-2:7' };
export const danOf = (a) => DAN[a];
export function mulKind(a, b) {
  if (a <= 9 && b <= 9) return b === 0 ? '2-2-2:8' : DAN[a];
  if (b <= 9) {
    if (a <= 9) return mulKind(b, a);
    if (a < 100) {
      if (a % 10 === 0) return '3-1-4:2';
      const oc = ones(a) * b >= 10, top = tens(a) * b + Math.floor((ones(a) * b) / 10);
      if (!oc) return tens(a) * b >= 10 ? '3-1-4:4' : '3-1-4:3';
      return top >= 10 ? '3-1-4:6' : '3-1-4:5';
    }
    if (a < 1000 && a % 100 === 0) return '3-1-4:2';
    if (a < 1000) { const c = mulCarries(a, b); return c === 0 ? '3-2-1:2' : c === 1 ? '3-2-1:3' : '3-2-1:4'; }
    return '3-2-1:4';
  }
  if (a <= 9) return b % 10 === 0 && b < 100 ? '3-2-1:5' : b < 100 ? '3-2-1:6' : mulKind(b, a);
  if (a < 100 && b < 100) {
    if (b % 10 === 0) return '3-2-1:5';
    if (a % 10 === 0) return mulKind(b, a);
    const c = mulCarries(a, ones(b)) + mulCarries(a, tens(b)) + addCarries(a * ones(b), a * tens(b) * 10);
    return c <= 1 ? '3-2-1:7' : '3-2-1:8';
  }
  if (a < 100 && b >= 100) return mulKind(b, a);
  if (b % 10 === 0 && b < 100) return '4-1-3:2';
  return '4-1-3:3';
}
export function divKind(a, b) {
  const q = Math.floor(a / b), r = a % b;
  if (b <= 9) {
    if (!r && q <= 9) return '3-1-3:6';
    if (a >= 100) return r ? '3-2-2:10' : '3-2-2:9';
    if (r) return q <= 9 || tens(a) % b === 0 ? '3-2-2:6' : '3-2-2:7';
    if (ones(a) === 0) return tens(a) % b === 0 ? '3-2-2:2' : '3-2-2:4';
    return tens(a) % b === 0 ? '3-2-2:3' : '3-2-2:5';
  }
  if (b % 10 === 0 && b < 100) return '4-1-3:4';
  if (q <= 9) return '4-1-3:5';
  return r ? '4-1-3:7' : '4-1-3:6';
}
export const KIND = { ADD3: (p) => (p.a + p.b === 10 || p.b + p.c === 10 || p.a + p.c === 10 ? '1-2-4:6' : '1-2-4:2'), ADD: (p) => addKind(p.a, p.b), SUB: (p) => subKind(p.a, p.b), MUL: (p) => mulKind(p.a, p.b), DIV: (p) => divKind(p.a, p.b) };
// 차시 정의에서: is: isKind('MUL', '3-1-4:5')
export const isKind = (fam, id) => (p) => KIND[fam](p) === id;

// ── 문항 가족
const plus = (a, b) => `${a} + ${b} = `, minus = (a, b) => `${a} − ${b} = `, times = (a, b) => `${a} × ${b} = `;
export const FAMS = [
  {
    id: 'ADD', s: 'A', sec: 15, tip: '같은 자리끼리 더하고, 10이 넘으면 윗자리로 1을 올려요.',
    make: (p) => nums([plus(p.a, p.b), B(0)], p.a + p.b, {
      bugs: [{ test: (v) => v[0] === addNoCarry(p.a, p.b) && addCarries(p.a, p.b) > 0, name: '받아올림한 수를 더하지 않음', to: len(Math.max(p.a, p.b)) >= 3 ? '2-1-3:3' : '1-2-6:2' },
        { test: (v) => Math.abs(v[0] - (p.a + p.b)) === 1, name: '하나 차이 (세다가 어긋남)', to: null }],
    }),
    steps: (p) => addColumns(p.a, p.b),
  },
  {
    id: 'ADD3', s: 'A', sec: 15, tip: '앞의 두 수를 먼저 더하고, 그 결과에 나머지 수를 더해요.',
    make: (p) => nums([`${p.a} + ${p.b} + ${p.c} = `, B(0)], p.a + p.b + p.c, {
      bugs: [{ test: (v) => v[0] === p.a + p.b || v[0] === p.b + p.c || v[0] === p.a + p.c, name: '세 수 중 하나를 빠뜨림', to: null }],
    }),
    steps: (p) => [{ c: 'ADD', p: { a: p.a, b: p.b }, why: '앞의 두 수를 먼저 더해요.' }, { c: 'ADD', p: { a: p.a + p.b, b: p.c }, why: '그 결과에 남은 수를 더해요.' }],
  },
  {
    id: 'SUB', s: 'A', sec: 15, tip: '같은 자리끼리 빼고, 뺄 수 없으면 윗자리에서 10을 받아내려요.',
    make: (p) => nums([minus(p.a, p.b), B(0)], p.a - p.b, {
      bugs: [{ test: (v) => v[0] === subSmallFromLarge(p.a, p.b) && subBorrows(p.a, p.b) > 0, name: '자리마다 큰 수에서 작은 수를 뺌', to: len(p.a) >= 3 ? '2-1-3:7' : '1-2-6:4' },
        { test: (v) => subBorrows(p.a, p.b) > 0 && (v[0] === p.a - p.b + 10 ** Math.max(1, firstBorrow(p.a, p.b)) || v[0] === subNoDecrement(p.a, p.b)), name: '받아내린 자리에서 1을 빼지 않음', to: len(p.a) >= 3 ? '2-1-3:7' : '1-2-6:4' }],
    }),
    steps: (p) => subColumns(p.a, p.b),
  },
  {
    id: 'MUL', s: 'M', sec: 20, tip: '곱하는 수를 자리마다 나누어 곱하고, 부분 곱을 더해요.',
    make: (p) => nums([times(p.a, p.b), B(0)], p.a * p.b, { bugs: mulBugs(p.a, p.b) }),
    steps: (p) => mulParts(p.a, p.b),
  },
  {
    id: 'DIV', s: 'D', sec: 25, tip: '나누는 수의 단 곱셈구구로 몫을 찾고, 남은 수가 나누는 수보다 작은지 확인해요.',
    make: (p) => {
      const q = Math.floor(p.a / p.b), r = p.a % p.b;
      if (!r) return nums([`${p.a} ÷ ${p.b} = `, B(0)], q, { bugs: divBugs(p.a, p.b) });
      return nums([`${p.a} ÷ ${p.b} = `, B(0), ' … ', B(1)], [q, r], {
        bugs: [{ test: (v) => v[1] >= p.b, name: '나머지가 나누는 수보다 큼', to: '3-2-2:6' }, ...divBugs(p.a, p.b)],
      });
    },
    steps: (p) => divParts(p.a, p.b),
  },
];

// 받아내림은 하는데 빌려 준 자리에서 1을 하나도 빼지 않은 답 (523 − 168 → 465)
function subNoDecrement(a, b) { let r = 0; for (let i = 0; i < len(a); i++) { const x = dig(a, i), y = dig(b, i); r += (x < y ? x + 10 - y : x - y) * 10 ** i; } return r; }
function firstBorrow(a, b) { let br = 0; for (let i = 0; i < len(a); i++) { const x = dig(a, i) - br; if (x < dig(b, i)) return i + 1; br = 0; } return 0; }

function mulBugs(a, b) {
  const out = [];
  if (b <= 9 && a >= 10 && a < 100) out.push({ test: (v) => v[0] === forgotCarry(a, b) && forgotCarry(a, b) !== a * b, name: '올림한 수를 안 더함', to: '3-1-4:5' }, { test: (v) => v[0] === carryThenMul(a, b) && carryThenMul(a, b) !== a * b, name: '올린 수를 먼저 더하고 곱함', to: '3-1-4:5' });
  if (b >= 10 && b < 100 && a >= 10 && ones(b) !== 0) out.push({ test: (v) => v[0] === a * ones(b) + a * tens(b), name: '둘째 줄을 한 칸 밀지 않음 (몇십을 몇으로 곱함)', to: '3-2-1:5' });
  if (a <= 9 && b <= 9) out.push({ test: (v) => v[0] === a * (b - 1) || v[0] === a * (b + 1), name: '한 묶음을 더 세거나 덜 셈', to: '2-1-6:4' });
  if ((a % 10 === 0 || b % 10 === 0) && a * b >= 100) out.push({ test: (v) => v[0] * 10 === a * b || v[0] === a * b * 10, name: '0의 개수를 틀림', to: '3-1-4:2' });
  return out;
}
function divBugs(a, b) {
  const q = Math.floor(a / b);
  // ÷몇십에서 몫이 하나 어긋나면 그 몇의 단 구구단 쪽 (240 ÷ 30 → 24 ÷ 3), 몇십몇이면 어림한 몫 고치기
  const out = b >= 10 && b % 10 === 0 && b <= 90 ? [{ test: (v) => Math.abs(v[0] - q) === 1, name: '몇십을 몇으로 보고 구구단에서 한 칸 어긋남', to: DAN[b / 10] }]
    : [{ test: (v) => b >= 10 && Math.abs(v[0] - q) === 1, name: '어림한 몫을 고치지 않음', to: '4-1-3:5' }];
  if (b <= 9) out.push({ test: (v) => Math.abs(v[0] - q) === 1 && q <= 9, name: '곱셈구구에서 한 칸 어긋남', to: DAN[b] });
  return out;
}

// ── 같은 숫자로 쪼갠 단계
function addColumns(a, b) {
  const L = Math.max(len(a), len(b));
  if (L === 1) return [];
  if (len(Math.min(a, b)) === 1 && L === 2) {
    // (두 자리)+(한 자리): 일의 자리끼리 더하고 몇십을 더한다
    const big = Math.max(a, b), small = Math.min(a, b);
    return [{ c: 'ADD', p: { a: ones(big), b: small }, why: '일의 자리끼리 더해요.' }, { c: 'ADD', p: { a: big - ones(big), b: ones(big) + small }, why: `몇십에 그 결과를 더해요.` }];
  }
  const out = []; let c = 0;
  const names = ['일', '십', '백', '천', '만'];
  for (let i = 0; i < L; i++) {
    const x = dig(a, i), y = dig(b, i);
    if (i > 0 && x === 0 && y === 0 && !c) continue;
    // 받아올린 1까지 세 수 — 10이 되는 짝이 없고 합이 10을 넘으면 (5 + 8 + 1) '세 수 덧셈'(9까지)이 아니라 받아올림 덧셈이 필요하므로 1을 먼저 더한 두 수로
    if (c && x + y + c >= 10 && x + y !== 10 && x !== 9 && y !== 9) out.push({ c: 'ADD', p: { a: x + c, b: y }, why: `${names[i]}의 자리: 받아올린 1을 ${x}에 먼저 더하면 ${x + c}, 여기에 ${y}${P(y, '을', '를')} 더해요.` });
    else if (c) out.push({ c: 'ADD3', p: { a: x, b: y, c }, why: `${names[i]}의 자리: 받아올린 1까지 더해요.` });
    else out.push({ c: 'ADD', p: { a: x, b: y }, why: `${names[i]}의 자리끼리 더해요.` });
    c = x + y + c >= 10 ? 1 : 0;
  }
  return out.filter((s) => !(s.c === 'ADD' && s.p.a === 0 && s.p.b === 0));
}
function subColumns(a, b) {
  if (a <= 10 || (a < 20 && b <= 9)) {
    if (a > 10 && a < 20 && ones(a) < b) return [{ c: 'SUB', p: { a: 10, b: b - ones(a) }, why: `${b}${P(b, '을', '를')} ${ones(a)}${P(ones(a), '과', '와')} ${b - ones(a)}(으)로 갈라 10에서 빼요.` }];
    return [];
  }
  const out = []; let br = 0;
  const names = ['일', '십', '백', '천', '만'];
  for (let i = 0; i < len(a); i++) {
    const x = dig(a, i) - br, y = dig(b, i);
    if (i >= len(b) && !br) break;
    if (x < y) { out.push({ c: 'SUB', p: { a: x + 10, b: y }, why: `${names[i]}의 자리: 윗자리에서 10을 받아내려 ${x + 10} − ${y}${P(y, '을', '를')} 해요.` }); br = 1; }
    else { if (x >= 0 && !(x === 0 && y === 0)) out.push({ c: 'SUB', p: { a: x, b: y }, why: br ? `${names[i]}의 자리: 1을 받아내려 주고 남은 ${x}에서 빼요.` : `${names[i]}의 자리끼리 빼요.` }); br = 0; }
  }
  return out.filter((s) => s.p.a >= s.p.b && !(s.p.a === 0));
}
function mulParts(a, b) {
  if (a <= 9 && b <= 9) return [];
  // 앞 수가 한 자리(6 × 47 · 9 × 30)면 쓴 순서 그대로 '6 × 40'처럼 보여 준다
  const m = (big, small, sw) => (sw ? { a: small, b: big } : { a: big, b: small });
  const ms = (big, small, sw) => (sw ? `${small} × ${big}` : `${big} × ${small}`);
  const sw = a <= 9 && b > 9;
  const [A, Bb] = sw ? [b, a] : [a, b];
  if (Bb <= 9 && A % 10 === 0 && A < 100) return [{ c: 'MUL', p: m(A / 10, Bb, sw), why: `0을 뺀 ${ms(A / 10, Bb, sw)}부터 해요. 그다음 10배예요.` }];
  if (Bb <= 9 && A % 100 === 0 && A < 1000) return [{ c: 'MUL', p: m(A / 100, Bb, sw), why: `0을 뺀 ${ms(A / 100, Bb, sw)}부터 해요. 그다음 100배예요.` }];
  if (Bb <= 9) {
    // 일의 자리부터 자리마다 곱해서 더한다 (교과서 세로셈 순서)
    const parts = [];
    for (let i = 0; i < len(A); i++) { const d = dig(A, i); if (d) parts.push(d * 10 ** i); }
    const steps = parts.map((x) => ({ c: 'MUL', p: m(x, Bb, sw), why: `${ms(x, Bb, sw)}${P(sw ? x : Bb, '을', '를')} 해요.` }));
    if (parts.length === 2) steps.push({ c: 'ADD', p: { a: parts[1] * Bb, b: parts[0] * Bb }, why: '부분 곱을 더해요.' });
    if (parts.length === 3) { steps.push({ c: 'ADD', p: { a: parts[1] * Bb, b: parts[0] * Bb }, why: '아래 두 자리의 곱을 더해요.' }, { c: 'ADD', p: { a: parts[2] * Bb, b: (parts[0] + parts[1]) * Bb }, why: '남은 자리의 곱을 더해요.' }); }
    return steps;
  }
  if (b % 10 === 0 && b < 100) return [{ c: 'MUL', p: { a, b: b / 10 }, why: `${a} × ${b / 10}부터 해요. 그다음 10배예요.` }];
  if (a % 10 === 0 && a < 100 && b < 100) return mulParts(b, a);
  if (b < 100) {
    const o = ones(b), t = tens(b) * 10;
    const st = [];
    if (o) st.push({ c: 'MUL', p: { a, b: o }, why: `${a} × ${o}(일의 자리)를 해요.` });
    st.push({ c: 'MUL', p: { a, b: t }, why: `${a} × ${t}(몇십)을 해요.` });
    if (o) st.push({ c: 'ADD', p: { a: a * t, b: a * o }, why: '두 부분 곱을 더해요.' });
    return st;
  }
  return [];
}
function divParts(a, b) {
  const q = Math.floor(a / b), r = a % b;
  if (b <= 9 && q <= 9) return r ? [{ c: 'MUL', p: { a: b, b: q }, why: `${b}의 단에서 ${a}보다 크지 않은 가장 큰 곱을 찾아요.` }, { c: 'SUB', p: { a, b: b * q }, why: '남는 수를 구해요.' }] : [{ c: 'MUL', p: { a: b, b: q }, why: `${b}의 단에서 곱이 ${a}인 것을 찾아요.` }];
  if (b <= 9) {
    // 높은 자리부터 나눈다
    const out = [];
    let rem = 0;
    const s = String(a);
    for (let i = 0; i < s.length; i++) {
      const cur = rem * 10 + Number(s[i]);
      if (cur < b && i === 0) { rem = cur; continue; }
      const qq = Math.floor(cur / b);
      const place = 10 ** (s.length - 1 - i);
      if (cur >= b) out.push({ c: 'DIV', p: { a: cur, b }, why: `${place > 1 ? `${['', '십', '백', '천'][s.length - 1 - i]}의 자리: ` : '일의 자리: '}${cur} ÷ ${b}${P(b, '을', '를')} 해요.` });
      rem = cur - qq * b;
    }
    return out.slice(0, 3);
  }
  // 두 자리 수로 나누기: 몇십으로 어림하고 곱해서 확인
  const t = Math.round(b / 10) * 10 || 10;
  const st = [];
  if (b % 10 !== 0) st.push({ c: 'DIV', p: { a: Math.floor(a / 10) * 10 - ((Math.floor(a / 10) * 10) % t), b: t }, why: `${b}${P(b, '을', '를')} ${RO10(t)} 어림해서 몫을 짐작해요.` });
  if (q >= 10) { const qt = Math.floor(q / 10) * 10; st.push({ c: 'MUL', p: { a: b, b: qt }, why: `${b} × ${qt}${P(qt, '을', '를')} 해 봐요.` }, { c: 'SUB', p: { a, b: b * qt }, why: '남은 수를 구해요.' }); }
  else st.push({ c: 'MUL', p: { a: b, b: q }, why: `짐작한 몫으로 ${b} × ${q}${P(q, '을', '를')} 해서 확인해요.` });
  return st.filter((s) => !(s.c === 'DIV' && (s.p.a < s.p.b || s.p.a <= 0)));
}
const RO10 = (t) => `${t}(으)로`;

// 한 차시가 여러 가족의 문항을 받을 때(예: '0을 더하거나 빼기') — 분류기로 들어온 params에는 p.fam이 붙어 온다
export const OPSBY = Object.fromEntries(FAMS.map((f) => [f.id, f]));
export const makeBy = (p, fallback = 'ADD') => OPSBY[p.fam || fallback].make(p);
export const stepsBy = (p, fallback = 'ADD') => OPSBY[p.fam || fallback].steps(p);

// ── 예전 개념 id → 이 가족 (단계·오답 방향이 예전 id로 적혀 있을 때)
export const ALIAS = {
  A1: (p) => (p && p.c ? { c: 'ADD3', p: { a: p.a, b: p.b, c: p.c } } : { c: 'ADD', p: p && { a: p.a, b: p.b } }),
  A2: (p) => ({ c: 'SUB', p: p && { a: p.a, b: p.b } }),
  A3: (p) => ({ c: 'ADD', p: p && { a: p.a, b: p.b } }),
  A4: (p) => ({ c: 'SUB', p: p && { a: p.a, b: p.b } }),
  A5: (p) => ({ c: 'ADD', p: p && { a: p.a, b: p.b } }),
  A6: (p) => ({ c: 'SUB', p: p && { a: p.a, b: p.b } }),
  A8: (p) => ({ c: p && p.op === '-' ? 'SUB' : 'ADD', p: p && { a: p.a, b: p.b } }),
  M3: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.b } }), M4: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.b } }),
  M5: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.b } }), M6: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.b } }),
  M7: (p) => ({ c: 'MUL', p: p && { a: p.t, b: p.b } }),
  M8: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.b } }),
  M9: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.t } }),
  M10: (p) => ({ c: 'MUL', p: p && { a: p.a, b: p.b } }),
  D4: (p) => ({ c: 'DIV', p: p && (p.n != null ? { a: p.n, b: p.d } : { a: p.d * p.q, b: p.d }) }),
  D5: (p) => ({ c: 'DIV', p: p && { a: p.d * p.q + p.x, b: p.d } }),
  D6: (p) => ({ c: 'DIV', p: p && { a: p.d * (p.qt * 10 + p.qo), b: p.d } }),
  D7: (p) => ({ c: 'DIV', p: p && { a: p.dv * p.q, b: p.dv } }),
  F15a: (p) => ({ c: 'F15', p: p && { n1: 1, d1: p.a, n2: 1, d2: p.b } }), // 1/몇 × 1/몇 = 진분수의 곱셈 차시
};
// 예전 id의 대표 차시 (params 없이 오답 방향만 있을 때)
export const ALIAS_DEFAULT = {
  A1: '1-1-3:6', A2: '1-1-3:10', A3: '1-2-6:2', A4: '1-2-6:4', A5: '2-1-3:3', A6: '2-1-3:7', A8: '3-1-1:4',
  M3: '2-2-2:2', M4: '2-2-2:4', M5: '2-2-2:5', M6: '2-2-2:6', M7: '3-1-4:2', M8: '3-1-4:5', M9: '3-2-1:5', M10: '3-2-1:8',
  D4: '3-1-3:6', D5: '3-2-2:6', D6: '3-2-2:5', D7: '4-1-3:6', F15a: '5-2-2:6',
};
