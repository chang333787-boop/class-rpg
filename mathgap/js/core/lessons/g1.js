// 1학년 차시 (국정 1-1 · 1-2 재구성) — 정의 방법은 docs/LESSONS.md
// FAMS: 이 학년에서 새로 만든 문항 가족 · LESSONS: 차시 정의
//   기존 개념 가족(N1~N4)을 쓰는 차시는 make를 차시에 두어 그 가족의 모양({n}·{a,b}·{v,t,a}·{v,t,o}…)을 그대로 받고
//   읽기·그림 같은 갈래만 더한다(모르는 모양은 원래 가족 make로).
import { nums, pick, B, J, P, RO } from '../concepts/kit.js';
import { dots, groups } from '../tokens.js';
import NUM from '../concepts/num.js';
import { isKind, KIND, makeBy, addKind, subKind, ones, tens } from './ops.js';

const BASE = Object.fromEntries(NUM.map((c) => [c.id, c]));

// 조건에 맞는 params가 나올 때까지 다시 뽑기 (무한 반복 방지)
export const until = (r, make, ok, tries = 400) => { for (let i = 0; i < tries; i++) { const p = make(r); if (ok(p)) return p; } throw new Error('gen: 조건에 맞는 수를 못 찾음'); };

// ── 말 도구 (2학년 파일도 씀)
const NAT = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NAT10 = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const SIN = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const ORD = ['', '첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째'];
export const native = (n) => NAT10[tens(n)] + NAT[ones(n)]; // 1~99 (스물셋)
// 한자어 읽기 0~9999 (406 → 사백육, 1000 → 천)
export function sino(n) {
  if (n === 0) return '영';
  const ds = String(n).split('').map(Number), L = ds.length, U = ['', '십', '백', '천'];
  return ds.map((d, i) => { const u = L - 1 - i; return !d ? '' : (d === 1 && u > 0 ? '' : SIN[d]) + U[u]; }).join('');
}
const batchim = (w) => { const s = String(w), c = s.charCodeAt(s.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0; };
// 한글 낱말 뒤 조사 (셋을 · 하나를 · 사과는 · 공은)
export const JW = (w, a, b) => `${w}${batchim(w) ? a : b}`;
export const PJ = (w, a, b) => (batchim(w) ? a : b);

// 정답이 여러 모양일 수 있는 빈칸 (예: 3 + 4 = 7 과 4 + 3 = 7) — sols[0]이 대표 정답
export function anyOf(prompt, sols, opt = {}) {
  const it = nums(prompt, sols[0], opt), base = it.check;
  it.check = function (vals, raws) {
    const res = base.call(this, vals, raws);
    if (res.ok) return res;
    if (sols.slice(1).some((s) => s.every((a, i) => vals[i] === a))) return { ok: true };
    return res;
  };
  return it;
}
// 고르기 — right가 정답, wrongs가 오답 보기. k(gen이 정함)만큼 순서를 돌린다. wbugs[i] = wrongs[i]를 골랐을 때의 오답 모양
export function choose(prompt, right, wrongs, k = 0, wbugs = []) {
  const all = [right, ...wrongs], n = all.length, order = all.map((_, i) => (i + (k || 0)) % n);
  const bugs = {};
  order.forEach((j, pos) => { if (j > 0 && wbugs[j - 1]) bugs[pos] = wbugs[j - 1]; });
  return pick(prompt, order.map((j) => [String(all[j])]), order.indexOf(0), { bugs });
}
// 가족 문항(사칙 등)에 이 차시만의 오답 모양을 먼저 붙인다 — 문제 글은 그대로(선생님 글 읽기와 맞대기용)
//   틀린 답에만, 빈칸이 다 채워졌을 때만 본다. 맞으면 가족의 오답 모양으로
export function addBugs(it, bugs) {
  const base = it.check, n = it.sol.length;
  it.check = function (vals, raws) {
    const res = base.call(this, vals, raws);
    if (res.ok || vals.slice(0, n).some((v) => v == null || Number.isNaN(v))) return res;
    for (const b of bugs) { try { if (b.test(vals)) return { ok: false, bug: { name: b.name, to: b.to } }; } catch (e) { /* 무시 */ } }
    return res;
  };
  return it;
}

// ── 그림
// 두 묶음 (모으기·덧셈)
function two(x, y) {
  const g = 22, r = 8;
  let s = '', ox = 4, H = 0;
  for (const n of [x, y]) {
    const cols = Math.max(1, Math.min(n, 5)), rows = Math.max(1, Math.ceil(n / 5)), w = cols * g + 10, h = rows * g + 10;
    s += `<rect x="${ox}" y="4" width="${w}" height="${h}" rx="10" class="grp"/>`;
    for (let i = 0; i < n; i++) s += `<circle cx="${ox + 5 + g / 2 + (i % 5) * g}" cy="${9 + g / 2 + Math.floor(i / 5) * g}" r="${r}" class="dot"/>`;
    ox += w + 16; H = Math.max(H, h);
  }
  const W = ox - 12;
  return `<svg viewBox="0 0 ${W} ${H + 8}" width="${W}" height="${H + 8}" role="img" aria-label="점 ${x}개와 점 ${y}개">${s}</svg>`;
}
// 한 줄 네모 d개 중 왼쪽에서 k째 색칠 (몇째)
function row(d, k) {
  const s = 30, gap = 6;
  let out = '';
  for (let i = 0; i < d; i++) out += `<rect x="${4 + i * (s + gap)}" y="4" width="${s}" height="${s}" rx="5" class="${i === k - 1 ? 'cell on' : 'cell'}"/>`;
  const W = 8 + d * (s + gap) - gap;
  return `<svg viewBox="0 0 ${W} ${s + 8}" width="${W}" height="${s + 8}" role="img" aria-label="네모 ${d}개 중 1개 색칠">${out}</svg>`;
}
// 점 n개 중 뒤의 gone개에 ×표 (뺄셈)
function crossed(n, gone) {
  const g = 26, r = 9, cols = Math.min(n, 5), rows = Math.ceil(n / 5), W = cols * g + 8, H = rows * g + 8;
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 4 + g / 2 + (i % 5) * g, y = 4 + g / 2 + Math.floor(i / 5) * g, off = i >= n - gone;
    s += `<circle cx="${x}" cy="${y}" r="${r}" class="${off ? 'cell' : 'dot'}"/>`;
    if (off) s += `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" stroke="currentColor" stroke-width="2.5"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="점 ${n}개 중 ${gone}개에 엑스 표">${s}</svg>`;
}

const OBJ = ['사과', '공', '사탕', '구슬', '풍선', '딸기', '쿠키', '귤'];
// 같은 무리끼리 견주기 (과일 · 과자 · 놀잇감) — "귤은 구슬보다 몇 개 더 많은지"처럼 엉뚱한 짝을 막는다
const KIN = [[0, 5, 7], [2, 6], [1, 3, 4]];
const kinOf = (o) => KIN.find((g) => g.includes(o));

// ── 기존 개념 가족에 갈래를 더한 make (그 가족의 모양은 그대로 받는다)
// N1 {n} 점 세기 + {v:'nat'|'sin', n} 수 이름 → 수
function countMake(p) {
  if (p.v === 'nat' || p.v === 'sin') {
    const w = p.v === 'nat' ? NAT[p.n] : SIN[p.n];
    return nums([`'${w}'${batchim(w) ? '을' : '를'} 수로 쓰면 `, B(0)], p.n, {
      bugs: [{ test: (v) => Math.abs(v[0] - p.n) === 1, name: '수 이름과 수를 하나 어긋나게 짝지음', to: null }],
    });
  }
  return BASE.N1.make(p);
}
// N2 {a,b} 더 큰 수 + lo: 더 작은 수 + c: 세 수 중 가장 큰(작은) 수 (두 개 중 고르기는 찍어도 반은 맞으니 섞는다)
const cmpMax = (p) => Math.max(p.a, p.b, p.c == null ? 0 : p.c);
function cmpMake(p) {
  const lo = !!p.lo, ns = p.c == null ? [p.a, p.b] : [p.a, p.b, p.c];
  const want = lo ? Math.min(...ns) : Math.max(...ns), right = ns.indexOf(want), mx = cmpMax(p);
  // 수의 순서를 모름 → 수의 순서 차시 · 십의 자리를 안 보고 일의 자리만 비교 → 묶음과 낱개 차시
  const seq = mx <= 9 ? '1-1-1:6' : mx <= 50 ? '1-1-5:8' : '1-2-1:4', place = mx <= 50 ? '1-1-5:6' : '1-2-1:3';
  const bugs = {};
  ns.forEach((o, k) => {
    if (k === right) return;
    const trap = want >= 10 && o >= 10 && tens(want) !== tens(o) && (lo ? ones(o) < ones(want) : ones(o) > ones(want));
    bugs[k] = trap ? { name: '일의 자리만 비교함', to: place } : { name: lo ? '더 큰 수를 고름' : '더 작은 수를 고름', to: seq };
  });
  const ask = ns.length === 3 ? (lo ? '가장 작은 수를 고르세요.' : '가장 큰 수를 고르세요.') : lo ? '더 작은 수를 고르세요.' : '더 큰 수를 고르세요.';
  return pick([ask], ns.map((x) => [String(x)]), right, { bugs });
}
// N3 {v,t,a} 모으기·가르기 + pic: 두 묶음 그림 + {v:'ten', t:10, w} 10 알기 (w 0 = 9보다 1만큼 더 큰 수 · 1 = '열' · 2 = 점 10개 세기)
function n3Make(p) {
  if (p.v === 'ten') {
    if (p.w === 1) return nums(["'열'을 수로 쓰면 ", B(0)], 10, { bugs: [{ test: (v) => v[0] === 1 || v[0] === 100, name: '10을 쓰는 법을 헷갈림', to: null }] });
    if (p.w === 2) return nums([{ svg: dots(10) }, '모두 몇 개인가요? ', B(0), '개'], 10, { bugs: [{ test: (v) => Math.abs(v[0] - 10) === 1, name: '세다가 하나 어긋남', to: '1-1-1:3' }] });
    return nums(['9보다 1만큼 더 큰 수는 ', B(0)], 10, { bugs: [{ test: (v) => v[0] === 8, name: '1만큼 더 작은 수를 씀', to: '1-1-1:7' }, { test: (v) => v[0] === 9, name: '그 수를 그대로 씀', to: '1-1-1:7' }] });
  }
  const it = BASE.N3.make(p);
  if (p.pic && p.v === 'join') it.prompt = [{ svg: two(p.a, p.t - p.a) }, ...it.prompt];
  if (p.v === 'join') addBugs(it, [{ test: (v) => Math.abs(v[0] - p.t) === 1, name: '이어 세다가 하나 어긋남', to: p.t <= 9 ? '1-1-1:6' : null }]);
  return it;
}
// N4 {v:'bundle'|'split'|'tenplus'|'split10', …} + {v:'pic', t, o} 그림 세기 + {v:'read', n, nat, k} 읽기 고르기
const n4val = (p) => (p.v === 'bundle' || p.v === 'pic' ? p.t * 10 + p.o : p.v === 'tenplus' ? 10 + p.o : p.n);
function n4Make(p) {
  const n = n4val(p);
  if (p.v === 'read') {
    const say = (x) => (p.nat ? native(x) : sino(x));
    const swap = ones(n) && ones(n) !== tens(n) ? ones(n) * 10 + tens(n) : null;
    const cand = [swap, n + 1, n - 1, n + 10, n - 10, n - 20, n + 20];
    const wr = [];
    for (const x of cand) if (x != null && x >= 10 && x <= 99 && x !== n && !wr.includes(x) && (n % 10 !== 0 || x % 10 === 0) && wr.length < 2) wr.push(x);
    return choose([`${J(n, '을', '를')} 바르게 읽은 것을 고르세요.`], say(n), wr.map(say), p.k,
      wr.map((x) => ({ name: x === swap ? '십의 자리와 일의 자리를 바꿔 읽음' : '다른 수로 읽음', to: null })));
  }
  // '10개씩 묶음 = 10'을 모름 → 10 알기(십몇) · 몇십(50까지) · 몇십(60~90)
  const ten = n < 20 ? '1-1-5:2' : n <= 50 ? '1-1-5:5' : '1-2-1:2';
  const addUp = { test: (v) => p.o > 0 && v[0] === p.t + p.o, name: '묶음 수와 낱개 수를 더함', to: ten };
  const swap = { test: (v) => p.o > 0 && p.o !== p.t && v[0] === p.o * 10 + p.t, name: '묶음과 낱개 자리를 바꿈', to: null };
  if (p.v === 'pic') {
    return nums([{ svg: groups(p.t, 10) }, ...(p.o ? [{ svg: dots(p.o) }] : []), '10개씩 묶었어요. 모두 몇 개인가요? ', B(0), '개'], n, { bugs: [addUp, swap] });
  }
  if (p.v === 'bundle' && !p.o) return nums([`10개씩 묶음 ${p.t}개는 `, B(0)], n, { bugs: [{ test: (v) => v[0] === p.t, name: '묶음 수만 씀', to: ten }] });
  if (p.v === 'bundle') return nums([`10개씩 묶음 ${p.t}개와 낱개 ${p.o}개는 `, B(0)], n, { bugs: [addUp, swap] });
  if (p.v === 'split' && n % 10 === 0) return nums([`${J(n, '은', '는')} 10개씩 묶음 `, B(0), '개예요.'], n / 10, { bugs: [{ test: (v) => v[0] === n, name: '묶음 수 대신 전체 수를 씀', to: ten }] });
  if (p.v === 'split') {
    return nums([`${J(n, '은', '는')} 10개씩 묶음 `, B(0), '개와 낱개 ', B(1), '개예요.'], [tens(n), ones(n)], {
      bugs: [{ test: (v) => tens(n) !== ones(n) && v[0] === ones(n) && v[1] === tens(n), name: '묶음과 낱개 자리를 바꿈', to: ten }],
    });
  }
  if (p.v === 'tenplus') return nums([`10과 ${J(p.o, '을', '를')} 모으면 `, B(0)], 10 + p.o, { bugs: [{ test: (v) => v[0] === p.o, name: '10을 빠뜨림', to: '1-1-5:2' }, { test: (v) => v[0] === 100 + p.o, name: '10 뒤에 낱개를 이어 씀', to: null }] });
  if (p.v === 'split10') return nums([`${p.n} = 10 + `, B(0)], p.n - 10, { bugs: [{ test: (v) => v[0] === p.n, name: '10을 빼지 않고 그대로 씀', to: '1-1-5:2' }] });
  return BASE.N4.make(p);
}

// ── 이 학년의 새 가족
const seqMax = (p) => (p.v === 'between' ? p.b : p.v === 'next' ? Math.max(p.n, p.n + p.d) : p.v === 'grid' ? p.x + 12 : Math.max(p.a, p.a + p.dir * (p.n - 1)));

const FAMS = [
  {
    id: 'g1_ORD', s: 'N', sec: 8,
    tip: '줄 선 친구들을 앞에서부터 "첫째, 둘째…"로 세어 보고, "셋"(개수)과 "셋째"(자리)가 어떻게 다른지 손으로 짚어 보게 해요.',
    // {v:'pos'|'before', d(네모 수), k(왼쪽에서 k째 색칠), side:'L'|'R'}
    make: (p) => {
      const pos = p.side === 'R' ? p.d - p.k + 1 : p.k, sw = p.side === 'R' ? '오른쪽' : '왼쪽';
      if (p.v === 'before') {
        return nums([{ svg: row(p.d, p.k) }, `색칠한 네모는 ${sw}에서 ${ORD[pos]}예요. 색칠한 네모보다 ${sw}에 있는 네모는 몇 개인가요? `, B(0), '개'], pos - 1, {
          bugs: [{ test: (v) => v[0] === pos, name: '몇째와 몇 개를 헷갈림', to: null }],
        });
      }
      // '몇째'는 말(첫째·둘째…)로 답한다 — 숫자 칸에 '4째'라고 쓰게 하지 않는다
      const opp = p.d - pos + 1, near1 = pos < p.d ? pos + 1 : pos - 1;
      const opts = [...new Set([pos, opp, near1, pos > 1 ? pos - 1 : pos + 2])].filter((x) => x >= 1 && x <= 9).slice(0, 3);
      const order = opts.slice().sort((a, b) => a - b);
      const bugs = {};
      order.forEach((x, i) => { if (x === opp && x !== pos) bugs[i] = { name: '반대쪽부터 셈', to: null }; else if (x !== pos) bugs[i] = { name: '세다가 하나 어긋남', to: '1-1-1:3' }; });
      return pick([{ svg: row(p.d, p.k) }, `네모 ${p.d}개 중 색칠한 네모는 ${sw}에서 몇째인가요?`], order.map((x) => [ORD[x]]), order.indexOf(pos), { bugs });
    },
  },
  {
    id: 'g1_SEQ', s: 'N', sec: 10,
    tip: '수 카드를 늘어놓고 빈 카드를 채우게 해요. 거꾸로 세기·사이의 수·수 배열표(아래 칸은 10 큼)도 함께 봐요.',
    // {v:'run', a, n, dir, miss:[칸]} · {v:'between', a, b} · {v:'next', n, d:±1} · {v:'grid', x, miss:[0~5]}
    make: (p) => {
      if (p.v === 'between') {
        const ans = []; for (let x = p.a + 1; x < p.b; x++) ans.push(x);
        const toks = [`${J(p.a, '과', '와')} ${p.b} 사이에 있는 수를 모두 쓰세요. `];
        ans.forEach((_, i) => { if (i) toks.push(', '); toks.push(B(i)); });
        return nums(toks, ans, { order: false, bugs: [{ test: (v) => v.includes(p.a) || v.includes(p.b), name: '양 끝의 수까지 넣음', to: null }] });
      }
      if (p.v === 'next') {
        return nums([`${p.n} 바로 ${p.d > 0 ? '뒤' : '앞'}의 수는 `, B(0)], p.n + p.d, { bugs: [{ test: (v) => v[0] === p.n - p.d, name: '앞과 뒤를 바꿈', to: null }] });
      }
      if (p.v === 'grid') {
        const cells = [p.x, p.x + 1, p.x + 2, p.x + 10, p.x + 11, p.x + 12], ans = [];
        const toks = ['수 배열표의 한 부분이에요. 빈칸에 알맞은 수를 쓰세요.'];
        cells.forEach((c, i) => {
          if (i % 3 === 0) toks.push({ br: 1 }); else toks.push(', ');
          if (p.miss.includes(i)) { toks.push(B(ans.length)); ans.push(c); } else toks.push(String(c));
        });
        return nums(toks, ans, {
          bugs: [{ test: (v) => p.miss.some((m, i) => m >= 3 && v[i] === cells[m] - 9), name: '아래 칸을 옆으로 이어 셈 (아래 칸은 10 큼)', to: '1-2-1:3' }],
        });
      }
      const terms = Array.from({ length: p.n }, (_, i) => p.a + p.dir * i), ans = [];
      const toks = [p.dir > 0 ? '수를 순서대로 썼어요. 빈칸에 알맞은 수를 쓰세요.' : '수를 거꾸로 세어 썼어요. 빈칸에 알맞은 수를 쓰세요.', { br: 1 }];
      terms.forEach((t, i) => { if (i) toks.push(', '); if (p.miss.includes(i)) { toks.push(B(ans.length)); ans.push(t); } else toks.push(String(t)); });
      return nums(toks, ans, {
        bugs: [{ test: (v) => ans.some((a, i) => Math.abs(v[i] - a) === 1), name: '수를 하나 건너뛰거나 겹쳐 셈', to: null }],
      });
    },
  },
  {
    id: 'g1_ONE', s: 'N', sec: 6,
    tip: '수 카드를 차례로 놓고 "바로 뒤의 수 = 1만큼 더 큰 수, 바로 앞의 수 = 1만큼 더 작은 수"를 짚어요. 1보다 1만큼 더 작은 수가 0이에요.',
    // {n, d:±1, pic}
    make: (p) => {
      const w = p.d > 0 ? '큰' : '작은';
      const lead = p.pic ? [{ svg: dots(p.n) }, `점의 수보다 1만큼 더 ${w} 수는 `] : [`${p.n}보다 1만큼 더 ${w} 수는 `];
      return nums([...lead, B(0)], p.n + p.d, {
        bugs: [{ test: (v) => v[0] === p.n - p.d, name: '1만큼 더 큰 수와 더 작은 수를 바꿈', to: '1-1-1:6' },
          { test: (v) => v[0] === p.n, name: '그 수를 그대로 씀', to: null }],
      });
    },
  },
  {
    id: 'g1_ADDM', s: 'A', sec: 15,
    tip: '두 묶음을 "모은다"는 말을 + 로, "모두"를 = 로 바꿔 쓰게 해요. 3 + 4 = 7을 "3 더하기 4는 7과 같습니다"로 읽어요.',
    // {a, b, v:'pic'|'story', o(물건), t(이야기 틀)}
    make: (p) => {
      const s = p.a + p.b, o = OBJ[p.o || 0];
      const lead = p.v === 'pic'
        ? [{ svg: two(p.a, p.b) }, '모두 몇 개인지 덧셈식으로 나타내 보세요.']
        : [p.t ? `${o} ${p.a}개와 ${p.b}개를 한 바구니에 모았어요. 모두 몇 개인지 덧셈식으로 나타내 보세요.` : `${o} ${p.a}개가 있어요. ${p.b}개를 더 가져왔어요. 모두 몇 개인지 덧셈식으로 나타내 보세요.`];
      return anyOf([...lead, { br: 1 }, B(0), ' + ', B(1), ' = ', B(2)], [[p.a, p.b, s], [p.b, p.a, s]], {
        bugs: [{ test: (v) => v[2] === Math.abs(p.a - p.b), name: '뺄셈을 함', to: null },
          { test: (v) => ((v[0] === p.a && v[1] === p.b) || (v[0] === p.b && v[1] === p.a)) && v[2] !== s, name: '모두의 수를 잘못 셈', to: '1-1-3:2' }],
      });
    },
    steps: (p) => [{ c: 'N3', p: { v: 'join', t: p.a + p.b, a: p.a }, why: `${J(p.a, '과', '와')} ${J(p.b, '을', '를')} 모으면 모두 몇인지 먼저 생각해요.` }],
  },
  {
    id: 'g1_SUBM', s: 'A', sec: 15,
    tip: '"남은 것은?"(덜어 내기)과 "몇 개 더 많은가?"(비교) 두 상황을 모두 − 로 쓴다는 것을 그림으로 보여 줘요. 큰 수를 앞에 써요.',
    // {a, b, v:'pic'|'take'|'cmp', o, o2}
    make: (p) => {
      const o = OBJ[p.o || 0], o2 = OBJ[p.o2 == null ? 1 : p.o2];
      const lead = p.v === 'pic'
        ? [{ svg: crossed(p.a, p.b) }, '×표 한 것을 빼면 몇 개가 남는지 뺄셈식으로 나타내 보세요.']
        : p.v === 'cmp'
          ? [`${JW(o, '이', '가')} ${p.a}개, ${JW(o2, '이', '가')} ${p.b}개 있어요. ${JW(o, '은', '는')} ${o2}보다 몇 개 더 많은지 뺄셈식으로 나타내 보세요.`]
          : [`${o} ${p.a}개가 있었어요. ${p.b}개를 친구에게 주었어요. 남은 ${JW(o, '은', '는')} 몇 개인지 뺄셈식으로 나타내 보세요.`];
      return nums([...lead, { br: 1 }, B(0), ' − ', B(1), ' = ', B(2)], [p.a, p.b, p.a - p.b], {
        bugs: [{ test: (v) => v[0] === p.b && v[1] === p.a, name: '작은 수에서 큰 수를 빼는 식으로 씀', to: null },
          { test: (v) => v[2] === p.a + p.b, name: '덧셈을 함', to: null },
          { test: (v) => v[0] === p.a && v[1] === p.a - p.b && v[2] === p.b, name: '뺀 수 자리에 남은 수를 씀', to: null },
          { test: (v) => v[0] === p.a && v[1] === p.b && v[2] !== p.a - p.b, name: '남은 수를 잘못 셈', to: '1-1-3:3' }],
      });
    },
    steps: (p) => [{ c: 'N3', p: { v: 'split', t: p.a, a: p.b }, why: `${J(p.a, '을', '를')} ${J(p.b, '과', '와')} 몇으로 가를 수 있는지 먼저 생각해요.` }],
  },
  {
    id: 'g1_PM', s: 'A', sec: 10,
    tip: '세 수(예: 2, 5, 7)로 덧셈식 2개, 뺄셈식 2개를 만들어 보며 덧셈과 뺄셈이 한 가족이라는 것을 보여 줘요.',
    // {v:'sign', a, b, op} · {v:'calc', a, b, op} · {v:'make', x, y, op, ord}
    make: (p) => {
      const sub = p.op === '-';
      if (p.v === 'make') {
        const s = p.x + p.y, list = [[p.x, p.y, s], [p.x, s, p.y], [p.y, p.x, s], [p.y, s, p.x], [s, p.x, p.y], [s, p.y, p.x]][p.ord || 0];
        const lead = `세 수 ${list[0]}, ${list[1]}, ${RO(list[2])} ${sub ? '뺄셈식' : '덧셈식'}을 만들어 보세요.`;
        return sub
          ? anyOf([lead, { br: 1 }, B(0), ' − ', B(1), ' = ', B(2)], [[s, p.x, p.y], [s, p.y, p.x]], { bugs: [{ test: (v) => v[0] !== s, name: '가장 큰 수에서 빼야 함을 모름', to: '1-1-3:9' }] })
          : anyOf([lead, { br: 1 }, B(0), ' + ', B(1), ' = ', B(2)], [[p.x, p.y, s], [p.y, p.x, s]], { bugs: [{ test: (v) => v[2] !== s, name: '가장 큰 수가 합이 됨을 모름', to: '1-1-3:5' }] });
      }
      const c = sub ? p.a - p.b : p.a + p.b, other = sub ? p.a + p.b : p.a - p.b;
      if (p.v === 'sign') {
        return pick(['○ 안에 +, − 중 알맞은 것을 고르세요.', { br: 1 }, `${p.a} ○ ${p.b} = ${c}`], [['+'], ['−']], sub ? 1 : 0, {
          bugs: { [sub ? 0 : 1]: { name: '덧셈과 뺄셈을 헷갈림', to: sub ? '1-1-3:9' : '1-1-3:5' } },
        });
      }
      return nums([`${p.a} ${sub ? '−' : '+'} ${p.b} = `, B(0)], c, { bugs: [{ test: (v) => v[0] === other, name: '덧셈과 뺄셈을 바꿔 함', to: null }] });
    },
  },
  {
    id: 'g1_SUB3', s: 'A', sec: 10,
    tip: '앞에서부터 차례로 빼요. 바둑돌을 두 번 덜어 내는 장면으로 보여 주면 "두 번 뺀다"가 잘 보여요.',
    // {a, b, c}: a − b − c
    make: (p) => nums([`${p.a} − ${p.b} − ${p.c} = `, B(0)], p.a - p.b - p.c, {
      bugs: [{ test: (v) => v[0] === p.a - p.b + p.c, name: '마지막 수를 더함', to: null },
        { test: (v) => v[0] === p.a - p.b || v[0] === p.a - p.c, name: '수 하나를 빼지 않음', to: null }],
    }),
    steps: (p) => [{ c: 'SUB', p: { a: p.a, b: p.b }, why: '앞의 두 수를 먼저 빼요.' }, { c: 'SUB', p: { a: p.a - p.b, b: p.c }, why: '그 결과에서 남은 수를 빼요.' }],
  },
  {
    id: 'g1_EVEN', s: 'N', sec: 6,
    tip: '바둑돌을 둘씩 짝 지어 남는 것이 없으면 짝수, 하나 남으면 홀수예요. 두 자리 수는 일의 자리만 보면 된다는 것을 찾게 해요.',
    // {v:'which', n} · {v:'pic', n} · {v:'find', even, ns:[3수], k}
    make: (p) => {
      if (p.v === 'find') {
        const want = p.even ? '짝수' : '홀수', r = p.ns[0];
        return choose([`${want}를 고르세요.`], r, p.ns.slice(1), p.k, [{ name: '짝수와 홀수를 헷갈림', to: null }, { name: '짝수와 홀수를 헷갈림', to: null }]);
      }
      const ev = p.n % 2 === 0;
      const lead = p.v === 'pic' ? [{ svg: dots(p.n, { cols: Math.ceil(p.n / 2) }) }, '둘씩 짝을 지어 보세요. 점의 수는 짝수인가요, 홀수인가요?'] : [`${p.n}${P(p.n, '은', '는')} 짝수인가요, 홀수인가요?`];
      return pick(lead, [['짝수'], ['홀수']], ev ? 0 : 1, { bugs: { [ev ? 1 : 0]: { name: '짝수와 홀수를 헷갈림', to: null } } });
    },
  },
];

// ── 차시
// 0을 더하거나 빼기 · 덧셈과 뺄셈 (한 자리)
const ADD9 = (r) => { const a = r.int(1, 8); return { a, b: r.int(1, 9 - a) }; };
const SUB9 = (r) => { const a = r.int(2, 9); return { a, b: r.int(1, a - 1) }; };
// 10이 되는 더하기·10에서 빼기: pos 0 = 식 그대로 · 1 = 앞 칸 · 2 = 뒤 칸 (단계에서 pos 없이 오면 식 그대로)
const tenBugs = (ans, shown, s) => [{ test: (v) => v[0] === s + shown, name: '두 수를 그냥 더함', to: '1-1-5:2' }, { test: (v) => Math.abs(v[0] - ans) === 1, name: '10 가르기가 하나 어긋남', to: '1-1-5:2' }];
const tenAddMake = (p) => {
  const s = p.a + p.b;
  if (p.pos === 1) return nums([B(0), ` + ${p.b} = ${s}`], p.a, { bugs: tenBugs(p.a, p.b, s) });
  if (p.pos === 2) return nums([`${p.a} + `, B(0), ` = ${s}`], p.b, { bugs: tenBugs(p.b, p.a, s) });
  return makeBy({ ...p, fam: 'ADD' });
};
const tenSubMake = (p) => {
  const c = p.a - p.b;
  if (p.pos === 2) return nums([`${p.a} − `, B(0), ` = ${c}`], p.b, { bugs: [{ test: (v) => v[0] === p.a + c, name: '두 수를 그냥 더함', to: '1-1-5:2' }, { test: (v) => Math.abs(v[0] - p.b) === 1, name: '10 가르기가 하나 어긋남', to: '1-1-5:2' }] });
  return addBugs(makeBy({ ...p, fam: 'SUB' }), [{ test: (v) => p.a === 10 && Math.abs(v[0] - c) === 1, name: '10 가르기가 하나 어긋남', to: '1-1-5:2' }]);
};
// 한 자리 수 덧셈·뺄셈 — 기호를 바꿔 계산한 모양
const add9Make = (p) => addBugs(makeBy({ ...p, fam: 'ADD' }), [{ test: (v) => p.a !== p.b && v[0] === Math.abs(p.a - p.b), name: '뺄셈을 함', to: '1-1-3:5' }]);
const sub9Make = (p) => addBugs(makeBy({ ...p, fam: 'SUB' }), [{ test: (v) => v[0] === p.a + p.b, name: '덧셈을 함', to: '1-1-3:9' }]);
// 0을 더하거나 빼기 — 0에 대한 생각이 틀린 모양을 먼저 본다
const zeroMake = (p) => {
  const sub = p.fam === 'SUB', ans = sub ? p.a - p.b : p.a + p.b, n = Math.max(p.a, p.b);
  return addBugs(makeBy(p), [
    { test: (v) => ans !== 0 && v[0] === 0, name: sub ? '0을 빼면 0이 된다고 봄' : '0을 더하면 0이 된다고 봄', to: null },
    { test: (v) => sub && p.a === p.b && v[0] === p.a, name: '같은 수를 빼도 그대로라고 봄', to: '1-1-3:9' },
    { test: (v) => (sub ? p.b === 0 && v[0] === p.a - 1 : v[0] === n + 1), name: '0을 1처럼 셈', to: null },
  ]);
};
// 받아올림 (몇)+(몇) · 받아내림 (십몇)−(몇) — 10을 만들거나 10에서 빼는 생각이 빠진 모양
const carry1Make = (p) => addBugs(makeBy({ ...p, fam: 'ADD' }), [
  { test: (v) => v[0] === p.a + p.b - 10, name: '10을 빠뜨리고 낱개만 씀', to: '1-1-5:3' },
  { test: (v) => v[0] === 100 + p.a + p.b - 10, name: '10 뒤에 낱개를 이어 씀', to: '1-1-5:3' },
]);
const borrow1Make = (p) => {
  const o = ones(p.a);
  return addBugs(makeBy({ ...p, fam: 'SUB' }), [
    { test: (v) => p.a > 10 && p.b > o && (v[0] === p.b - o || v[0] === 10 + p.b - o), name: '낱개끼리 거꾸로 뺌 (큰 수에서 작은 수)', to: '1-2-4:5' },
    { test: (v) => p.a > 10 && p.b > o && v[0] === 10 - p.b, name: '10에서 뺀 뒤 남은 낱개를 안 더함', to: '1-1-5:3' },
  ]);
};
// (몇십몇)±(몇) 받아올림·받아내림 없음 — 한 자리 수를 십의 자리에 맞춰 계산한 모양
const placeAddMake = (p) => { const big = Math.max(p.a, p.b), small = Math.min(p.a, p.b); return addBugs(makeBy({ ...p, fam: 'ADD' }), [{ test: (v) => small <= 9 && v[0] === big + small * 10, name: '한 자리 수를 십의 자리에 더함', to: '1-2-1:3' }]); };
const placeSubMake = (p) => addBugs(makeBy({ ...p, fam: 'SUB' }), [{ test: (v) => p.b <= 9 && p.a - p.b * 10 >= 0 && v[0] === p.a - p.b * 10, name: '한 자리 수를 십의 자리에서 뺌', to: '1-2-1:3' }]);
// 세 수 중 합이 10인 두 수
const pair10 = (p) => (p.a + p.b === 10 ? [p.a, p.b, p.c] : p.b + p.c === 10 ? [p.b, p.c, p.a] : [p.a, p.c, p.b]);
const runGen = (lo, hi) => (r) => {
  const dir = r.chance(0.65) ? 1 : -1, n = 5;
  const a = dir > 0 ? r.int(lo, hi - 4) : r.int(lo + 4, hi);
  const m1 = r.int(1, 4), m2 = r.chance(0.5) ? null : r.int(0, 4);
  return { v: 'run', a, n, dir, miss: [...new Set([m1, m2].filter((x) => x != null))].sort((x, y) => x - y) };
};
// 크기 비교: 두 수(65%) 또는 세 수(35%) — 첫 수 a는 lo~hi, 나머지는 a와 십의 자리가 같거나(일의 자리가 큰 함정 포함) 아무 수
const cmpGen2 = (lo, hi, t0, t1, any = lo) => (r) => {
  const near = (r, a) => { const k = r.int(0, 2); return k === 0 ? tens(a) * 10 + r.int(0, 9) : k === 1 ? r.int(t0, t1) * 10 + r.int(ones(a), 9) : r.int(any, hi); };
  const three = r.chance(0.35), lo2 = r.chance(three ? 0.4 : 0.35);
  return until(r, (r) => { const a = r.int(lo, hi); return three ? { a, b: near(r, a), c: near(r, a), lo: lo2 } : { a, b: near(r, a), lo: lo2 }; },
    (p) => { const ns = [p.a, p.b, p.c].filter((x) => x != null); return ns.every((x) => x >= 10 && x <= hi) && new Set(ns).size === ns.length; });
};
const isN4 = (lo, hi, tensOnly) => (p) => { const x = n4val(p); return x >= lo && x <= hi && (tensOnly ? x % 10 === 0 : x % 10 !== 0 || x < 20); };

export default {
  FAMS,
  LESSONS: [
    // ── 1-1-1 9까지의 수
    {
      id: '1-1-1:2', fam: 'N1', name: '1~5 세기·읽기', kid: '1부터 5까지 세고 읽기', sec: 6,
      gen: (r) => ({ n: r.int(1, 5), v: r.pick(['dots', 'dots', 'nat', 'sin']) }), make: countMake,
      is: (p) => p.n >= 1 && p.n <= 5, prev: null, pre: [],
      hint: '하나씩 손가락으로 짚으며 세어 봐요. 마지막에 센 수가 모두의 수예요. 셋도 3, 삼도 3이에요.',
    },
    {
      id: '1-1-1:3', fam: 'N1', name: '6~9 세기·읽기', kid: '6부터 9까지 세고 읽기', sec: 8,
      gen: (r) => ({ n: r.int(6, 9), v: r.pick(['dots', 'dots', 'nat', 'sin']) }), make: countMake,
      is: (p) => p.n >= 6 && p.n <= 9, prev: '1-1-1:2', pre: [],
      hint: '5개를 먼저 묶고 나머지를 이어 세어요. 5 다음은 6, 7, 8, 9예요. 여섯도 6, 육도 6이에요.',
    },
    {
      id: '1-1-1:5', fam: 'g1_ORD', name: '몇째', kid: '몇째인지 알기', sec: 8,
      gen: (r) => { const d = r.int(5, 9), before = r.chance(0.3), k = r.int(1, d), side = r.chance(0.5) ? 'L' : 'R'; const pos = side === 'R' ? d - k + 1 : k; return before && pos >= 2 ? { v: 'before', d, k, side } : { v: 'pos', d, k, side }; },
      prev: '1-1-1:3', pre: [],
      hint: '어느 쪽부터 세는지 먼저 보고, 그쪽 끝부터 첫째, 둘째, 셋째… 하고 세어요. 셋은 개수, 셋째는 자리예요.',
    },
    {
      id: '1-1-1:6', fam: 'g1_SEQ', name: '9까지 수의 순서', kid: '수의 순서 (9까지)', sec: 10,
      gen: runGen(1, 9), is: (p) => seqMax(p) <= 9, prev: '1-1-1:3', pre: [],
      hint: '1, 2, 3, 4…처럼 하나씩 커져요. 거꾸로 셀 때는 9, 8, 7…처럼 하나씩 작아져요.',
    },
    {
      id: '1-1-1:7', fam: 'g1_ONE', name: '1만큼 더 큰 수·작은 수', kid: '1만큼 더 큰 수와 작은 수', sec: 6,
      gen: (r) => { const d = r.chance(0.5) ? 1 : -1, n = d > 0 ? r.int(0, 8) : r.int(1, 9); return { n, d, pic: n > 0 && r.chance(0.35) }; },
      prev: '1-1-1:6', pre: [],
      hint: '1만큼 더 큰 수는 바로 뒤의 수, 1만큼 더 작은 수는 바로 앞의 수예요. 1보다 1만큼 더 작은 수는 0이에요.',
    },
    {
      id: '1-1-1:8', fam: 'N2', name: '9까지 수의 크기 비교', kid: '어느 수가 더 클까요 (9까지)', sec: 5,
      gen: (r) => (r.chance(0.35)
        ? until(r, (r) => ({ a: r.int(1, 9), b: r.int(1, 9), c: r.int(1, 9), lo: r.chance(0.4) }), (p) => new Set([p.a, p.b, p.c]).size === 3)
        : until(r, (r) => ({ a: r.int(1, 9), b: r.int(1, 9), lo: r.chance(0.35) }), (p) => p.a !== p.b)), make: cmpMake,
      is: (p) => cmpMax(p) <= 9, prev: '1-1-1:7', pre: [],
      hint: '수를 차례로 셀 때 뒤에 나오는 수가 더 커요. 7은 5보다 뒤에 나오니까 7이 더 커요.',
      tip: '수 카드를 차례로 늘어놓고 "뒤에 있을수록 큰 수"를 짚어 보게 해요. 바둑돌을 하나씩 짝 지어 남는 쪽이 더 많다는 것도 보여 줘요.',
    },
    // ── 1-1-3 덧셈과 뺄셈 (모으기 → 덧셈 · 가르기 → 뺄셈 두 갈래)
    {
      id: '1-1-3:2', fam: 'N3', name: '모으기 (9까지)', kid: '두 수를 모으기', sec: 6,
      gen: (r) => { const t = r.int(2, 9); return { v: 'join', t, a: r.int(1, t - 1), pic: r.chance(0.5) }; }, make: n3Make,
      is: (p) => p.v === 'join' && p.t <= 9, prev: null, pre: ['1-1-1:3'],
      hint: '두 묶음을 한곳에 모은다고 생각해요. 3과 4를 모으면 3 다음부터 4개를 이어 세어 7!',
      tip: '두 접시의 바둑돌을 한 접시에 모아 보며 "모으면 모두 몇?"을 말하게 해요. 큰 수에서 시작해 이어 세는 법도 보여 줘요.',
    },
    {
      id: '1-1-3:3', fam: 'N3', name: '가르기 (9까지)', kid: '수를 둘로 가르기', sec: 6, def: true,
      gen: (r) => { const t = r.int(2, 9); return { v: 'split', t, a: r.int(1, t - 1) }; }, make: n3Make,
      is: (p) => p.v === 'split' && p.t <= 9, prev: null, pre: ['1-1-1:3'],
      hint: '바둑돌을 두 쪽으로 나눠 놓는다고 생각해요. 7을 3과 몇으로 가르면? 3에서 7까지 이어 세면 4예요.',
      tip: '바둑돌을 두 접시에 여러 가지로 나눠 담아 보며(7 = 1과 6, 2와 5 …) 한쪽이 늘면 다른 쪽이 준다는 것을 보게 해요.',
    },
    {
      id: '1-1-3:5', fam: 'g1_ADDM', name: '덧셈식으로 나타내기', kid: '덧셈식 알기', sec: 18,
      gen: (r) => { const a = r.int(1, 8); return { a, b: r.int(1, 9 - a), v: r.pick(['pic', 'story']), o: r.int(0, OBJ.length - 1), t: r.int(0, 1) }; },
      prev: '1-1-3:2', pre: [],
      hint: '"모으면 모두"는 + 와 = 로 써요. 3개와 2개를 모으면 3 + 2 = 5예요.',
    },
    {
      id: '1-1-3:6', fam: 'ADD', name: '합이 9까지인 덧셈', kid: '한 자리 수 더하기 (9까지)', sec: 5, timed: true,
      gen: ADD9, make: add9Make, is: isKind('ADD', '1-1-3:6'), prev: '1-1-3:5', pre: [],
      hint: '큰 수에서 시작해서 작은 수만큼 이어 세어요. 2 + 5는 5 다음부터 6, 7 → 7!',
      tip: '두 수를 모으기로 보고, 큰 수부터 이어 세게 해요(2 + 5는 5, 6, 7). 합이 같은 덧셈(1 + 4, 2 + 3)을 모아 보는 것도 좋아요.',
    },
    {
      id: '1-1-3:9', fam: 'g1_SUBM', name: '뺄셈식으로 나타내기', kid: '뺄셈식 알기', sec: 18,
      gen: (r) => { const a = r.int(2, 9), o = r.int(0, OBJ.length - 1); return { a, b: r.int(1, a - 1), v: r.pick(['pic', 'take', 'cmp']), o, o2: r.pick(kinOf(o).filter((x) => x !== o)) }; },
      prev: '1-1-3:3', pre: [],
      hint: '"남은 것"이나 "몇 개 더 많은지"는 − 로 써요. 큰 수를 앞에 써요. 7개에서 3개를 주면 7 − 3 = 4예요.',
    },
    {
      id: '1-1-3:10', fam: 'SUB', name: '9까지 수의 뺄셈', kid: '한 자리 수 빼기', sec: 5, timed: true,
      gen: SUB9, make: sub9Make, is: isKind('SUB', '1-1-3:10'), prev: '1-1-3:9', pre: [],
      hint: '빼기는 가르기예요. 8 − 3은 "8을 3과 몇으로 가를까?" 하고 생각해요. 답은 5!',
      tip: '바둑돌을 덜어 내거나 가르기로 보여 줘요(8을 3과 5로 가르면 8 − 3 = 5). 뺀 수와 남은 수를 더하면 처음 수가 되는지 확인하게 해요.',
    },
    {
      id: '1-1-3:12', s: 'A', name: '0을 더하거나 빼기', kid: '0 더하기·0 빼기', sec: 5,
      gen: (r) => { const n = r.int(1, 9), f = r.int(0, 3); return [{ a: 0, b: n, fam: 'ADD' }, { a: n, b: 0, fam: 'ADD' }, { a: n, b: 0, fam: 'SUB' }, { a: n, b: n, fam: 'SUB' }][f]; },
      make: zeroMake, is: (p) => KIND[p.fam || 'ADD'](p) === '1-1-3:12',
      prev: null, pre: ['1-1-3:5', '1-1-3:9'],
      hint: '0은 아무것도 없는 것이에요. 5 + 0 = 5, 5 − 0 = 5, 그리고 5 − 5 = 0이에요.',
      tip: '빈 접시(0)를 모으거나 덜어 내는 장면으로 보여 줘요. 전체를 다 덜어 내면 0이 남는다는 것도 함께 봐요.',
    },
    {
      id: '1-1-3:13', fam: 'g1_PM', name: '덧셈과 뺄셈 함께', kid: '덧셈과 뺄셈 골라 쓰기', sec: 10,
      gen: (r) => {
        const v = r.pick(['sign', 'make', 'calc']), op = r.chance(0.5) ? '+' : '-';
        if (v === 'make') return until(r, (r) => { const x = r.int(1, 7); return { v, x, y: r.int(1, 9 - x), op, ord: r.int(0, 5) }; }, (p) => p.x !== p.y);
        return { v, op, ...(op === '+' ? ADD9(r) : SUB9(r)) };
      },
      prev: '1-1-3:10', pre: ['1-1-3:6'],
      hint: '모두 몇인지 구하면 +, 남은 것이나 차이를 구하면 − 예요. 세 수 2, 5, 7로 2 + 5 = 7, 7 − 5 = 2를 만들 수 있어요.',
    },
    // ── 1-1-5 50까지의 수
    {
      id: '1-1-5:2', fam: 'N3', name: '10 알기·모으기·가르기', kid: '10 알기 (9 다음 수)', sec: 6,
      gen: (r) => {
        if (r.chance(0.3)) return { v: 'ten', t: 10, w: r.int(0, 2) };
        const v = r.chance(0.5) ? 'join' : 'split'; return { v, t: 10, a: r.int(1, 9), pic: v === 'join' && r.chance(0.4) };
      }, make: n3Make,
      is: (p) => p.t === 10, prev: null, pre: ['1-1-3:3'],
      hint: '10은 9보다 1만큼 더 큰 수예요. 십 또는 열이라고 읽고, 7과 3, 6과 4, 5와 5로 가를 수 있어요.',
      tip: '10칸 틀에 바둑돌을 9개 놓고 하나를 더 놓아 10을 만들어요. 그다음 10개를 두 접시에 여러 가지로 나눠 담아 봐요.',
    },
    {
      id: '1-1-5:3', fam: 'N4', name: '십몇 알기', kid: '십몇 (10과 몇)', sec: 8,
      gen: (r) => {
        const o = r.int(1, 9), v = r.pick(['tenplus', 'split10', 'bundle', 'split', 'read', 'pic']);
        return v === 'tenplus' ? { v, o } : v === 'bundle' || v === 'pic' ? { v, t: 1, o } : v === 'read' ? { v, n: 10 + o, nat: r.chance(0.5), k: r.int(0, 2) } : { v, n: 10 + o };
      },
      make: n4Make, is: isN4(11, 19), prev: '1-1-5:2', pre: [],
      hint: '십몇은 10과 몇이에요. 10개씩 묶음 1개와 낱개 4개는 14, 십사 또는 열넷이라고 읽어요.',
      tip: '10개 막대 1개와 낱개로 십몇을 만들고 "10과 몇"으로 말하게 해요. 십사와 열넷처럼 두 가지로 읽어 보게 해요.',
    },
    {
      id: '1-1-5:4', fam: 'N3', name: '십몇 모으기·가르기', kid: '십몇을 모으고 가르기', sec: 8,
      gen: (r) => until(r, (r) => { const a = r.int(2, 9), b = r.int(2, 9); return { v: r.chance(0.5) ? 'join' : 'split', t: a + b, a }; }, (p) => p.t >= 11), make: n3Make,
      is: (p) => p.t >= 11 && p.t <= 19, prev: '1-1-5:3', pre: [],
      hint: '먼저 10을 만들어 봐요. 8과 5를 모으면 8과 2로 10, 남은 3과 합쳐 13이에요.',
      tip: '바둑돌을 10칸 틀에 먼저 채우고 남은 것을 옆에 두게 해요. 13을 가를 때도 10과 3을 먼저 떠올리게 하면 쉬워요.',
    },
    {
      id: '1-1-5:5', fam: 'N4', name: '10개씩 묶음 (몇십)', kid: '10개씩 묶어 세기 (50까지)', sec: 8,
      gen: (r) => { const t = r.int(2, 5), v = r.pick(['bundle', 'split', 'read', 'pic']); return v === 'bundle' || v === 'pic' ? { v, t, o: 0 } : v === 'read' ? { v, n: t * 10, nat: r.chance(0.5), k: r.int(0, 2) } : { v, n: t * 10 }; },
      make: n4Make, is: isN4(20, 50, true), prev: '1-1-5:3', pre: [],
      hint: '10개씩 묶음 3개는 30이에요. 삼십 또는 서른이라고 읽어요.',
      tip: '달걀판이나 10개 막대로 10개씩 묶어 세게 하고, 20 이십·스물, 30 삼십·서른처럼 두 가지로 읽게 해요.',
    },
    {
      id: '1-1-5:6', fam: 'N4', name: '50까지 묶음과 낱개', kid: '50까지의 수 세기', sec: 10,
      gen: (r) => {
        const n = until(r, (r) => r.int(21, 49), (x) => x % 10 !== 0), v = r.pick(['bundle', 'split', 'pic', 'pic', 'read']);
        return v === 'bundle' || v === 'pic' ? { v, t: tens(n), o: ones(n) } : v === 'read' ? { v, n, nat: r.chance(0.5), k: r.int(0, 2) } : { v, n };
      },
      make: n4Make, is: isN4(21, 49), prev: '1-1-5:5', pre: [],
      hint: '10개씩 묶음을 먼저 세고 낱개를 세어요. 10개씩 묶음 3개와 낱개 7개는 37이에요.',
      tip: '10개씩 묶음을 먼저 세고 낱개를 이어 세게 해요. 묶음 수가 십의 자리, 낱개 수가 일의 자리라는 것을 짚어 줘요.',
    },
    {
      id: '1-1-5:8', fam: 'g1_SEQ', name: '50까지 수의 순서', kid: '수의 순서 (50까지)', sec: 10,
      gen: (r) => {
        const v = r.pick(['run', 'run', 'between', 'next']);
        if (v === 'between') { const a = r.int(10, 47); return { v, a, b: a + r.pick([2, 3]) }; }
        if (v === 'next') { const d = r.chance(0.5) ? 1 : -1; return { v, n: d > 0 ? r.int(10, 49) : r.int(11, 50), d }; }
        return runGen(10, 50)(r);
      },
      is: (p) => seqMax(p) >= 10 && seqMax(p) <= 50, prev: '1-1-5:6', pre: [],
      hint: '일의 자리가 1씩 커지다가 9 다음에는 십의 자리가 1 커져요. 29 다음은 30이에요.',
    },
    {
      id: '1-1-5:9', fam: 'N2', name: '50까지 수의 크기 비교', kid: '어느 수가 더 클까요 (50까지)', sec: 5,
      gen: cmpGen2(10, 50, 1, 4), make: cmpMake,
      is: (p) => cmpMax(p) >= 10 && cmpMax(p) <= 50, prev: '1-1-5:8', pre: ['1-1-1:8'],
      hint: '10개씩 묶음의 수를 먼저 비교해요. 묶음 수가 같으면 낱개를 비교해요. 29보다 31이 더 커요.',
      tip: '두 수를 10개씩 묶음과 낱개로 놓아 보고 묶음 수부터 비교하게 해요. 29와 31처럼 낱개가 큰데도 더 작은 수를 꼭 다뤄요.',
    },
    // ── 1-2-1 100까지의 수
    {
      id: '1-2-1:2', fam: 'N4', name: '몇십 (60~90)', kid: '몇십 알기 (예순~아흔)', sec: 8,
      gen: (r) => { const t = r.int(6, 9), v = r.pick(['bundle', 'split', 'read', 'read', 'pic']); return v === 'bundle' || v === 'pic' ? { v, t, o: 0 } : v === 'read' ? { v, n: t * 10, nat: r.chance(0.6), k: r.int(0, 2) } : { v, n: t * 10 }; },
      make: n4Make, is: isN4(60, 90, true), prev: null, pre: ['1-1-5:5'],
      hint: '10개씩 묶음 7개는 70이에요. 칠십 또는 일흔이라고 읽어요. 60 예순, 80 여든, 90 아흔!',
      tip: '10개 막대 6~9개로 몇십을 만들고 예순·일흔·여든·아흔을 소리 내어 읽게 해요. 일흔과 칠십처럼 두 가지 읽기를 짝 지어 봐요.',
    },
    {
      id: '1-2-1:3', fam: 'N4', name: '99까지의 수', kid: '99까지의 수 알기', sec: 10, def: true,
      gen: (r) => {
        const n = until(r, (r) => r.int(51, 99), (x) => x % 10 !== 0), v = r.pick(['bundle', 'split', 'read', 'pic']);
        return v === 'bundle' || v === 'pic' ? { v, t: tens(n), o: ones(n) } : v === 'read' ? { v, n, nat: r.chance(0.5), k: r.int(0, 2) } : { v, n };
      },
      make: n4Make, is: isN4(51, 99), prev: '1-2-1:2', pre: ['1-1-5:6'],
      hint: '74는 10개씩 묶음 7개와 낱개 4개예요. 칠십사 또는 일흔넷이라고 읽어요.',
      tip: '10개씩 묶음과 낱개로 수를 만들고 두 가지로 읽게 해요. 74와 47처럼 숫자 자리를 바꾸면 다른 수가 된다는 것도 보여 줘요.',
    },
    {
      id: '1-2-1:4', fam: 'g1_SEQ', name: '100까지 수의 순서', kid: '수의 순서 (100까지)', sec: 12,
      gen: (r) => {
        const v = r.pick(['run', 'between', 'next', 'grid']);
        if (v === 'between') { const a = r.int(50, 97); return { v, a, b: a + r.pick([2, 3]) }; }
        if (v === 'next') { const d = r.chance(0.5) ? 1 : -1; return { v, n: d > 0 ? r.int(51, 99) : r.int(52, 100), d }; }
        if (v === 'grid') { const x = until(r, (r) => r.int(41, 88), (x) => (x - 1) % 10 <= 7); const m = r.int(0, 2), m2 = r.int(3, 5); return { v, x, miss: [m, m2] }; }
        return runGen(51, 100)(r);
      },
      is: (p) => seqMax(p) >= 51 && seqMax(p) <= 100, prev: '1-2-1:3', pre: ['1-1-5:8'],
      hint: '99 다음 수는 100이에요. 수 배열표에서 오른쪽으로 가면 1씩, 아래로 가면 10씩 커져요.',
    },
    {
      id: '1-2-1:5', fam: 'N2', name: '100까지 수의 크기 비교', kid: '어느 수가 더 클까요 (100까지)', sec: 5,
      gen: cmpGen2(51, 99, 5, 9, 20), make: cmpMake,
      is: (p) => cmpMax(p) >= 51 && cmpMax(p) <= 99, prev: '1-2-1:4', pre: ['1-1-5:9'],
      hint: '십의 자리 숫자를 먼저 비교하고, 같으면 일의 자리 숫자를 비교해요. 68보다 72가 더 커요.',
      tip: '수 배열표에서 두 수의 자리를 찾아 아래 줄(십의 자리가 큰 수)일수록 크다는 것을 보게 해요. 68과 72처럼 일의 자리가 큰데도 더 작은 수를 꼭 다뤄요.',
    },
    {
      id: '1-2-1:6', fam: 'g1_EVEN', name: '짝수와 홀수', kid: '짝수와 홀수', sec: 6,
      gen: (r) => {
        const v = r.pick(['which', 'which', 'pic', 'find']);
        if (v === 'pic') return { v, n: r.int(3, 12) };
        if (v === 'which') return { v, n: r.int(1, 50) };
        const even = r.chance(0.5), pickP = (par) => until(r, (r) => r.int(1, 50), (x) => x % 2 === par);
        const a = pickP(even ? 0 : 1), b = until(r, () => pickP(even ? 1 : 0), (x) => x !== a), c = until(r, () => pickP(even ? 1 : 0), (x) => x !== a && x !== b);
        return { v, even, ns: [a, b, c], k: r.int(0, 2) };
      },
      prev: '1-2-1:3', pre: [],
      hint: '둘씩 짝을 지어 남는 것이 없으면 짝수, 하나 남으면 홀수예요. 일의 자리가 0, 2, 4, 6, 8이면 짝수!',
    },
    // ── 1-2-2 덧셈과 뺄셈 (1) 받아올림·받아내림 없음
    {
      id: '1-2-2:2', fam: 'ADD', name: '(몇십몇)+(몇)', kid: '두 자리 수 + 한 자리 수 (받아올림 없이)', sec: 10,
      gen: (r) => until(r, (r) => { const big = r.int(11, 98), small = r.int(1, 9); return r.chance(0.2) ? { a: small, b: big } : { a: big, b: small }; }, (p) => addKind(p.a, p.b) === '1-2-2:2'),
      make: placeAddMake, is: isKind('ADD', '1-2-2:2'), prev: null, pre: ['1-1-3:6', '1-2-1:3'],
      steps: (p) => {
        const big = Math.max(p.a, p.b), small = Math.min(p.a, p.b);
        return [ones(big) ? { c: 'ADD', p: { a: ones(big), b: small }, why: '낱개(일의 자리)끼리 더해요.' } : null,
          { c: 'N4', p: { v: 'bundle', t: tens(big), o: ones(big) + small }, why: '10개씩 묶음은 그대로예요. 묶음과 낱개를 합쳐요.' }];
      },
      hint: '일의 자리끼리 더하고 십의 자리는 그대로 내려 써요. 32 + 5 = 37!',
      tip: '수 모형으로 낱개끼리 모으고 10개씩 묶음은 그대로 두는 장면을 보여 줘요. 세로로 쓸 때 한 자리 수를 일의 자리에 맞춰 쓰게 해요.',
    },
    {
      id: '1-2-2:3', fam: 'ADD', name: '(몇십몇)+(몇십몇)', kid: '두 자리 수 + 두 자리 수 (받아올림 없이)', sec: 12,
      gen: (r) => (r.chance(0.15)
        ? (() => { const a = r.int(1, 8) * 10; return { a, b: r.int(1, 9 - a / 10) * 10 }; })()
        : until(r, (r) => { const a = r.int(10, 88); return { a, b: r.int(10, 99 - a) }; }, (p) => addKind(p.a, p.b) === '1-2-2:3' && ones(p.a) + ones(p.b) > 0)),
      is: isKind('ADD', '1-2-2:3'), prev: '1-2-2:2', pre: [],
      hint: '일의 자리는 일의 자리끼리, 십의 자리는 십의 자리끼리 더해요. 23 + 45 = 68!',
      tip: '수 모형으로 낱개는 낱개끼리, 10개씩 묶음은 묶음끼리 모아요. 세로셈에서 자리를 줄 맞춰 쓰게 해요(30 + 20 같은 몇십끼리도).',
    },
    {
      id: '1-2-2:4', fam: 'SUB', name: '(몇십몇)−(몇)', kid: '두 자리 수 − 한 자리 수 (받아내림 없이)', sec: 10,
      gen: (r) => until(r, (r) => { const a = r.int(12, 99); return { a, b: r.int(1, Math.max(1, ones(a))) }; }, (p) => subKind(p.a, p.b) === '1-2-2:4' && ones(p.a) >= 1),
      make: placeSubMake, is: isKind('SUB', '1-2-2:4'), prev: null, pre: ['1-1-3:10', '1-2-1:3'],
      steps: (p) => [{ c: 'SUB', p: { a: ones(p.a), b: p.b }, why: '낱개(일의 자리)끼리 빼요.' },
        p.a - p.b === 10 ? null : { c: 'N4', p: { v: 'bundle', t: tens(p.a), o: ones(p.a) - p.b }, why: '10개씩 묶음은 그대로예요. 묶음과 남은 낱개를 합쳐요.' }],
      hint: '일의 자리끼리 빼고 십의 자리는 그대로 내려 써요. 47 − 3 = 44!',
      tip: '수 모형에서 낱개만 덜어 내고 10개씩 묶음은 그대로 두는 장면을 보여 줘요. 세로로 쓸 때 빼는 수를 일의 자리에 맞춰 쓰게 해요.',
    },
    {
      id: '1-2-2:5', fam: 'SUB', name: '(몇십몇)−(몇십몇)', kid: '두 자리 수 − 두 자리 수 (받아내림 없이)', sec: 12,
      gen: (r) => until(r, (r) => { const a = r.int(21, 99); return { a, b: r.int(10, a - 1) }; }, (p) => subKind(p.a, p.b) === '1-2-2:5'),
      is: isKind('SUB', '1-2-2:5'), prev: '1-2-2:4', pre: [],
      hint: '일의 자리끼리, 십의 자리끼리 빼요. 68 − 25 = 43!',
      tip: '수 모형에서 낱개는 낱개끼리, 10개씩 묶음은 묶음끼리 덜어 내요. 세로셈에서 자리를 줄 맞춰 쓰게 해요.',
    },
    // ── 1-2-4 덧셈과 뺄셈 (2)
    {
      id: '1-2-4:2', fam: 'ADD3', name: '세 수의 덧셈', kid: '세 수 더하기', sec: 10,
      gen: (r) => until(r, (r) => ({ a: r.int(1, 6), b: r.int(1, 5), c: r.int(1, 5) }), (p) => p.a + p.b + p.c <= 9),
      is: (p) => KIND.ADD3(p) === '1-2-4:2', prev: null, pre: ['1-1-3:6'],
      hint: '앞의 두 수를 먼저 더하고, 그 결과에 나머지 수를 더해요. 2 + 3 + 4 → 5 + 4 = 9!',
      tip: '바둑돌을 세 번 모으는 장면으로 보여 주고, 앞의 두 수를 더한 답을 식 위에 작게 써 두게 해요.',
    },
    {
      id: '1-2-4:3', fam: 'g1_SUB3', name: '세 수의 뺄셈', kid: '세 수 빼기', sec: 10,
      gen: (r) => until(r, (r) => { const a = r.int(4, 9); return { a, b: r.int(1, a - 2), c: r.int(1, 5) }; }, (p) => p.a - p.b - p.c >= 0),
      prev: null, pre: ['1-1-3:10'],
      hint: '앞에서부터 차례로 빼요. 9 − 3 − 2 → 6 − 2 = 4!',
    },
    {
      id: '1-2-4:4', fam: 'ADD', name: '10이 되는 더하기', kid: '더해서 10 만들기', sec: 5, timed: true,
      gen: (r) => { const a = r.int(1, 9); return { a, b: 10 - a, pos: r.pick([0, 1, 2, 2]) }; }, make: tenAddMake,
      is: isKind('ADD', '1-2-4:4'), prev: null, pre: ['1-1-5:2'],
      hint: '10은 1과 9, 2와 8, 3과 7, 4와 6, 5와 5로 가를 수 있어요. 7 + □ = 10이면 □는 3!',
      tip: '10칸 틀에 바둑돌을 놓고 빈칸이 몇 개인지 세게 해요. 1과 9, 2와 8 … 10이 되는 짝을 노래처럼 익혀요.',
    },
    {
      id: '1-2-4:5', fam: 'SUB', name: '10에서 빼기', kid: '10에서 빼기', sec: 5, timed: true,
      gen: (r) => ({ a: 10, b: r.int(1, 9), pos: r.pick([0, 0, 2]) }), make: tenSubMake,
      is: isKind('SUB', '1-2-4:5'), prev: '1-2-4:4', pre: [],
      hint: '10을 둘로 갈라 생각해요. 10은 6과 4니까 10 − 6 = 4예요.',
      tip: '10칸 틀에서 바둑돌을 덜어 내며 남은 칸을 세게 해요. "10은 6과 4"처럼 10이 되는 짝과 이어 줘요.',
    },
    {
      id: '1-2-4:6', fam: 'ADD3', name: '10을 만들어 더하기', kid: '10을 만들어 세 수 더하기', sec: 12,
      gen: (r) => { const x = r.int(1, 9), y = 10 - x, z = r.int(1, 9); return [{ a: x, b: y, c: z }, { a: z, b: x, c: y }, { a: x, b: z, c: y }][r.int(0, 2)]; },
      is: (p) => KIND.ADD3(p) === '1-2-4:6', prev: '1-2-4:4', pre: ['1-1-5:3'],
      steps: (p) => { const [x, y, z] = pair10(p); return [{ c: 'ADD', p: { a: x, b: y, pos: 0 }, why: `합이 10이 되는 ${J(x, '과', '와')} ${J(y, '을', '를')} 먼저 더해요.` }, { c: 'N4', p: { v: 'tenplus', o: z }, why: `10과 남은 ${J(z, '을', '를')} 모아요.` }]; },
      hint: '합이 10이 되는 두 수를 먼저 찾아 더해요. 4 + 6 + 5 → 10 + 5 = 15!',
      tip: '세 수 중 합이 10이 되는 두 수에 ○표 하고 먼저 더하게 해요. 더하는 순서를 바꿔도 합은 같다는 것을 바둑돌로 보여 줘요.',
      bridge: '세 수 중 10이 되는 짝을 먼저 찾는 눈 — 순서대로만 더하던 아이에게 "더하는 순서를 바꿔도 된다"를 보여 줘요.',
    },
    // ── 1-2-6 덧셈과 뺄셈 (3) 받아올림·받아내림
    {
      id: '1-2-6:2', fam: 'ADD', name: '받아올림 (몇)+(몇)', kid: '10을 넘는 한 자리 수 덧셈', sec: 6, timed: true,
      gen: (r) => until(r, (r) => ({ a: r.int(2, 9), b: r.int(2, 9) }), (p) => p.a + p.b >= 11),
      make: carry1Make, is: isKind('ADD', '1-2-6:2'), prev: null, pre: ['1-2-4:4', '1-1-3:3'],
      steps: (p) => [
        { c: 'ADD', p: { a: p.a, b: 10 - p.a, pos: 2 }, why: `${J(p.a, '과', '와')} 더해서 10이 되는 수를 찾아요.` },
        { c: 'N3', p: { v: 'split', t: p.b, a: 10 - p.a }, why: `${J(p.b, '을', '를')} ${J(10 - p.a, '과', '와')} 몇으로 갈라요.` },
        { c: 'N4', p: { v: 'tenplus', o: p.a + p.b - 10 }, why: '10과 남은 수를 모아요.' },
      ],
      hint: '먼저 10을 만들어요. 8 + 5는 8에 2를 더해 10, 남은 3을 더해 13!',
      tip: '10칸 틀 두 개로 앞의 수를 10까지 채우고 남은 바둑돌을 옆 틀에 놓게 해요(8 + 5 = 8 + 2 + 3). 뒤의 수를 가르는 말을 소리 내어 하게 해요.',
      bridge: '뒤의 수를 "10을 채울 만큼"과 "남은 수"로 가르는 생각 — 10 가르기와 십몇을 알아도 둘을 이어 쓰는 것은 따로 연습해요.',
    },
    {
      id: '1-2-6:4', fam: 'SUB', name: '받아내림 (십몇)−(몇)', kid: '십몇에서 한 자리 수 빼기 (받아내림)', sec: 6, timed: true,
      gen: (r) => { const a = r.int(11, 18); return { a, b: r.int(ones(a) + 1, 9) }; },
      make: borrow1Make, is: isKind('SUB', '1-2-6:4'), prev: null, pre: ['1-2-4:5', '1-1-5:3'],
      steps: (p) => [
        { c: 'N4', p: { v: 'split10', n: p.a }, why: `${J(p.a, '을', '를')} 10과 몇으로 갈라요.` },
        { c: 'SUB', p: { a: 10, b: p.b }, why: `10에서 ${J(p.b, '을', '를')} 빼요.` },
        { c: 'ADD', p: { a: 10 - p.b, b: ones(p.a) }, why: '남은 수와 낱개를 더해요.' },
      ],
      hint: '13 − 5는 13을 10과 3으로 갈라요. 10에서 5를 빼면 5, 남은 3을 더하면 8!',
      tip: '13을 10칸 틀 하나(10)와 낱개 3으로 놓고, 10에서 5를 덜어 낸 뒤 남은 5와 3을 모으게 해요. 낱개 3에서 5를 뺄 수 없다는 것부터 확인해요.',
      bridge: '빼는 수가 낱개보다 클 때 10에서 빼고 낱개를 다시 더하는 생각 — "빼고 더한다"가 처음이라 따로 짚어 줘요.',
    },
  ],
};
