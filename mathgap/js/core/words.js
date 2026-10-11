// 기본 문장제(차시마다) — 그 차시 문제의 식을 그대로 읽어(같은 숫자 · 같은 계산) 이야기로 바꾼다
//   10-11 교사 '문제은행처럼 엄청 늘려야 · 막힌 곳은 간단한 개념과 반복 풀이로' → 계산 차시 약 100개에 문장제 모양이 생긴다.
//   같은 숫자를 쓰므로 그 차시의 교육과정 규칙(tests/rules.test.mjs · 받아올림 · 나머지 …)을 그대로 지킨다.
//   구조(Riley · Greeno · Heller 1983 · Vergnaud 1983): 덧셈 · 뺄셈 = 보태기 · 덜기 · 모으기 · 비교 · 처음 수 모름 · 낱말과 연산이 반대인 비교
//     곱셈 = 같은 묶음 · 몇 배 · 몇의 몇 분의 몇 · 단위당 양 / 나눗셈 = 똑같이 나누기(등분제) · 몇씩 담기(포함제) · 몇 배
//   storyOf(차시, params, seed) → { story 문제 글, item 답 칸, steps 같이 풀기(식 고르기 → 그 차시 계산), kind 구조, x 정답 } | null(문장으로 바꾸지 않는 차시)
//   시험 = tests/words.test.mjs
import { byId, makeItem } from './lessons/index.js';
import { toText } from './tokens.js';
import { nums, P, B } from './concepts/kit.js';
import { F, simp, ar, txt, tok, q, S, uj, answerItem, choose, val, whole, rng, eqv } from './types/kit.js';

// 문장으로 바꾸는 계산 가족 — 식이 '수 연산 수 ='로 시작하는 차시만
const FAMS = new Set(['ADD', 'SUB', 'ADD3', 'MUL', 'DIV', 'F6', 'g4_FMIX', 'g4_DECAS', 'F12', 'g5_MIXADD', 'g5_MIXSUB', 'F13', 'F14', 'F15', 'g5_DMUL', 'F16', 'F17', 'g6_FDIVMUL', 'g6_DDIV', 'F18', 'F19', 'F21', 'F20', 'g6_DDIV2']);
export const hasWords = (c) => !!(byId[c] && FAMS.has(byId[c].fam));

// ── 식 읽기(화면 글 그대로) ──
const NUM = String.raw`\d+ \d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?`;
const EXPR = new RegExp(`^\\s*(${NUM})\\s*([+−×÷])\\s*(${NUM})\\s*(?:([+])\\s*(${NUM})\\s*)?=`);
function num(s) {
  let m;
  if ((m = s.match(/^(\d+) (\d+)\/(\d+)$/))) return { x: F(+m[1] * +m[3] + +m[2], +m[3]), k: 'F' };
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return { x: +m[1] > +m[2] ? { ...F(+m[1], +m[2]), imp: true } : F(+m[1], +m[2]), k: 'F' };   // 가분수는 가분수 그대로 보임
  if (s.includes('.')) { const p = s.split('.')[1].length; return { x: simp(F(Math.round(Number(s) * 10 ** p), 10 ** p)), k: 'D' }; }
  return { x: F(Number(s), 1), k: 'W' };
}
// 차시 문제 → { a, op, b, c?, st, rem } · 빈칸이 둘 이상인 나눗셈 = 몫과 나머지
function readItem(it) {
  if (it.choices) return null;
  const t = toText(it.prompt), m = t.match(EXPR);
  if (!m) return null;
  const a = num(m[1]), b = num(m[3]), c = m[5] ? num(m[5]) : null;
  const kinds = [a.k, b.k, c && c.k].filter(Boolean);
  const st = kinds.includes('D') ? 'D' : kinds.includes('F') ? 'F' : 'W';
  const rem = m[2] === '÷' && / … /.test(t) && it.sol.length === 2;
  return { a: a.x, op: m[2], b: b.x, c: c ? c.x : null, st, rem };
}

// ── 이야기 재료 ──
//   글 기준 = QUALITY.md(10-11 교사 '비문 · 맞춤법 · 어순까지') — tests/words.test.mjs 의 '글 검사'가 기계로 거르고, 사람 교정 읽기를 한 번 더 한다
//   ① 한 문장에 한 사실 · 이어지는 주어는 생략(같은 말 되풀이 없음) ② 길이는 '길다 · 짧다', 그릇에 든 양은 '들어 있다', 책꽂이의 책은 '꽂혀 있다'
//   ③ 셀 수 있는 것은 '몇 개', 양은 '얼마' ④ 사람 이름 없음 ⑤ 숫자가 그 맥락에서 그럴듯함(아래 max · aMax …) ⑥ 0 · 음수 없음 ⑦ 그 학년이 안 배운 연산은 보기에도 없음
// 개수 — max = 이 맥락에 어울리는 가장 큰 수(이야기 속 모든 수와 답) · lo = 비교 · 모으기에서 작은 쪽도 이만큼은(도서관 2층에 책 7권 X)
//   own = 처음에 가진 곳: 'me'(나는 ○을 가지고 있었어요) 또는 자리 이름(우리 반에 · 책꽂이에 …) · give = 더 받는 곳(친구에게 …)
//   at = 비교 · 모으기의 두 자리 · sh = 두 번째부터 부르는 짧은 이름 · use(n) = 덜어 낸 수 n에 맞는 말 [했어요, 했더니, 한]
//   col = 세 번 모으는 말 [했어요, 한] · share = 똑같이 나누는 상대(people 30명까지 · 그보다 많으면 bag) · bag = 나누어 넣는 그릇
const COUNT = [
  { T: '구슬', u: '개', max: 100, own: 'me', give: '친구에게 ', add: '더 받았어요', at: ['빨간 상자', '파란 상자'], use: () => ['동생에게 주었어요', '동생에게 주었더니', '동생에게 준'], col: ['모았어요', '모은'], share: 'people', bag: '주머니' },
  { T: '사탕', u: '개', max: 50, own: 'me', give: '친구에게 ', add: '더 받았어요', at: ['왼쪽 바구니', '오른쪽 바구니'], use: (n) => (n <= 5 ? ['먹었어요', '먹었더니', '먹은'] : ['친구들에게 나누어 주었어요', '친구들에게 나누어 주었더니', '친구들에게 나누어 준']), col: ['받았어요', '받은'], share: 'people', bag: '봉지' },
  { T: '색종이', u: '장', max: 2000, own: (m) => (m <= 30 ? 'me' : '우리 반'), add: '더 샀어요', at: ['1반', '2반'], use: () => ['썼어요', '썼더니', '쓴'], col: ['접었어요', '접은'], share: 'people', bag: '봉투' },
  { T: '동화책', u: '권', max: 100, own: '책꽂이', inV: '꽂혀 있', inA: '꽂힌', add: '더 꽂았어요', at: ['우리 반', '옆 반'], use: () => ['친구들에게 빌려주었어요', '친구들에게 빌려주었더니', '친구들에게 빌려준'], col: ['읽었어요', '읽은'], share: 'people', bag: '상자' },
  { T: '연필', u: '자루', max: 60, own: '우리 모둠', add: '더 샀어요', at: ['1모둠', '2모둠'], use: () => ['친구들에게 나누어 주었어요', '친구들에게 나누어 주었더니', '친구들에게 나누어 준'], col: ['샀어요', '산'], share: 'people', bag: '필통' },
  { T: '책', u: '권', min: 100, lo: 20, max: 3000, own: '도서관', add: '새로 들여왔어요', at: ['도서관 1층', '도서관 2층'], sh: ['1층', '2층'], use: () => ['학생들이 빌려 갔어요', '학생들이 빌려 갔더니', '학생들이 빌려 간'], share: 'box', bag: '상자' },
  { T: '사과', u: '개', min: 50, lo: 20, max: 3000, own: '창고', add: '더 따 왔어요', at: ['우리 과수원', '이웃 과수원'], use: () => ['팔았어요', '팔았더니', '판'], share: 'box', bag: '상자' },
];
// 양 — hold = 그릇에 든 것(물 · 밀가루 · 그릇은 양에 맞게 고름) · len = 길이(리본 · 철사 — 내가 가진 것)
const MEASURE = [
  { T: '물', u: 'L', how: 'hold', max: 30, add: '더 부었어요', use: (n) => (n <= 1 ? ['마셨어요', '마셨더니', '마신'] : ['썼어요', '썼더니', '쓴']) },
  { T: '밀가루', u: 'kg', how: 'hold', max: 20, add: '더 넣었어요', use: () => ['썼어요', '썼더니', '쓴'] },
  { T: '리본', u: 'm', how: 'len', max: 30, own: 'me', at: ['빨간 리본', '파란 리본'], add: '더 샀어요', use: () => ['잘라 썼어요', '잘라 썼더니', '잘라 쓴'] },
  { T: '철사', u: 'm', how: 'len', max: 30, own: 'me', at: ['굵은 철사', '가는 철사'], add: '더 샀어요', use: () => ['잘라 썼어요', '잘라 썼더니', '잘라 쓴'] },
];
// 그릇 — 물은 2 L 까지 물병 · 12 L 까지 물통 · 그보다 많으면 수조 / 밀가루는 5 kg 까지 봉지 · 그보다 많으면 통
const holder = (M, m) => (M.T === '물' ? (m <= 2 ? '물병' : m <= 12 ? '물통' : '수조') : m <= 5 ? '봉지' : '통');
// 같은 묶음 — aMin ≤ 한 묶음의 수 ≤ aMax · 묶음 수 ≤ bMax · put = 몇씩 나누어 넣는 말 · cnt 가 있으면 '꽃병 3개'(없으면 '3봉지')
const GROUPS = [
  { g: '봉지', T: '사탕', u: '개', v: '들어 있', aMax: 20, bMax: 20, put: '담으면' },
  { g: '상자', T: '귤', u: '개', v: '들어 있', aMin: 5, aMax: 100, bMax: 50, put: '담으면' },
  { g: '묶음', T: '연필', u: '자루', v: '있', aMax: 12, bMax: 99, put: '묶으면' },
  { g: '묶음', T: '색종이', u: '장', v: '있', aMin: 5, aMax: 100, bMax: 99, put: '묶으면' },
  { g: '상자', T: '공책', u: '권', v: '들어 있', aMax: 30, bMax: 99, put: '담으면' },
  { g: '꽃병', T: '꽃', u: '송이', v: '꽂혀 있', aMax: 9, bMax: 9, put: '꽂으면', cnt: '개', one: true },
];
const ITEMS = [{ T: '지우개', u: '개' }, { T: '공책', u: '권' }, { T: '풀', u: '개' }, { T: '색연필', u: '자루' }];   // 값 이야기의 물건과 세는 말
const j = (w, a, b) => P(String(w), a, b);
const grade = (c) => Number(byId[c].u[0]);
const big = (...xs) => Math.max(...xs.filter(Boolean).map((x) => (typeof x === 'number' ? x : val(x))));
const fits = (C, m) => m <= C.max && m >= (C.min || 0);
// 맞는 맥락 중 하나(없으면 가장 큰 수를 견디는 것)
function ctx(r, list, m, ok = () => true) {
  const good = list.filter((C) => fits(C, m) && ok(C));
  if (good.length) return r.pick(good);
  const any = list.filter(ok);
  return (any.length ? any : list).reduce((a, c) => (c.max > a.max ? c : a));
}
const gN = (G, n) => (G.cnt ? `${G.g} ${n}${G.cnt}` : `${n}${G.g}`);
const cont = (L) => (L <= 0.5 ? '컵' : L <= 2 ? '병' : '물통');   // 물 한 그릇의 크기 → 컵 · 병 · 물통

// 식 고르기 단계 — 맞는 식 + 아이가 실제로 고를 만한 틀린 식(낱말만 보고 연산을 고름 · 연산을 바꿈) · 그 학년이 아직 안 배운 연산은 보기에 넣지 않음
function pickStep(right, wrongs, r) {
  return { kind: 'pick', key: true, why: '이야기를 식으로 나타내 봐요. 어떤 식일까요?', item: choose('어떤 식으로 구할까요?', [{ t: right, right: true }, ...wrongs], r) };
}
const E = (x, op, y, st) => S(tok(x, st), ` ${op} `, tok(y, st));
const ge = (x, y) => x.n * y.d >= y.n * x.d;

// ── 덧셈 · 뺄셈 ──
function addSub(e, r, g) {
  const { a, b, op, st } = e, W = st === 'W';
  const x = ar(op, a, b, st), m = big(a, b, x), lo = Math.min(val(a), val(b), x.n ? val(x) : Infinity);
  const M = ctx(r, W ? COUNT : MEASURE, m, (C) => !C.lo || lo >= C.lo), u = M.u, T = M.T;
  const Q = (y) => q(y, st, u);
  const nu = (y, w1, w2) => (W ? j(txt(y, st) + u, w1, w2) : uj(u, w1, w2));   // '수 + 단위' 뒤 조사
  const cop = (y) => nu(y, '이에요', '예요');
  const many = `몇 ${u}`, was = j(u, '이었을까요', '였을까요');
  const len = M.how === 'len', hold = M.how === 'hold';
  const box = hold ? holder(M, m) : null;
  const [A, B0] = hold ? [`첫째 ${box}`, `둘째 ${box}`] : M.at, [As, Bs] = M.sh || [A, B0];   // 처음은 온이름, 그다음은 짧은 이름
  const atV = hold ? '들어 있' : '있';
  const tj = j(T, '이', '가'), tn = j(T, '은', '는'), tl = j(T, '을', '를'), Ae = j(As, '은', '는'), Be = j(Bs, '은', '는');
  // 처음에 가진 것 — 나는 ○을 가지고 있었어요 / ○○에 ○이 있었어요(들어 · 꽂혀)
  const own = typeof M.own === 'function' ? M.own(m) : M.own, me = own === 'me', place = hold ? box : me ? null : own;   // 작은 수는 내 것, 큰 수는 우리 반 것
  const inV = M.inV || atV, inA = M.inA || (hold ? '든' : '있는');
  const have = (y) => (me ? S(`나는 ${T}${tl} `, y, ' 가지고 있었어요.') : S(`${place}에 ${T}${tj} `, y, ` ${inV}었어요.`));
  const haveQ = me ? `나는 ${T}${tl} ${many} 가지고 있었는데` : `${place}에 ${T}${tj} ${many} ${inV}었는데`;
  const all = me ? `내 ${T}${tn}` : `${place}에 ${inA} ${T}${tn}`;
  const left = me ? `남은 ${T}${tn}` : `${place}에 남은 ${T}${tn}`;
  const first = me ? `처음에 가지고 있던 ${T}${tn}` : `처음에 ${inV}던 ${T}${tn}`;
  const unit = W ? u : ` ${u}`;
  // 비교 — 비교하는 쪽을 주어로(10-11 교정: '…있고, ○○보다 적게 있어요'는 누가 적은지 문장에 없음)
  const cmp = (who, than, y, word) => (len ? S(`${who}${j(who, '은', '는')} ${than}보다 `, y, ` ${word}.`) : S(`${who}${j(who, '은', '는')} ${than}보다 ${T}${tj} `, y, ` ${word}.`));
  const at1 = (y) => (len ? S(`${A}${j(A, '은', '는')} `, y, `${cop(y)}.`) : S(`${A}에는 ${T}${tj} `, y, ` ${atV}어요.`));
  const askB = len ? `${Bs}${Be} ${many}일까요?` : `${Bs}에는 ${T}${tj} ${many} ${atV}을까요?`;
  if (op === '+') {
    const kinds = g <= 1 || e.plain ? ['join', 'join', 'combine'] : g === 2 ? ['join', 'join', 'combine', 'more', 'start'] : ['join', 'join', 'combine', 'more', 'less', 'start'];
    const kind = r.pick(kinds), U = M.use(val(b));
    let story;
    if (kind === 'join') story = S(have(Q(a)), ` ${M.give || ''}`, Q(b), `${nu(b, '을', '를')} ${M.add}. ${all} 모두 ${many}일까요?`);
    else if (kind === 'combine') story = len ? S(`${A}${j(A, '은', '는')} `, Q(a), `, ${Bs}${Be} `, Q(b), `${cop(b)}. 두 ${T}의 길이는 모두 ${many}일까요?`)
      : S(`${A}에 ${T}${tj} `, Q(a), `, ${Bs}에 `, Q(b), ` ${atV}어요. ${T}${tn} 모두 ${many}일까요?`);
    else if (kind === 'more') story = S(at1(Q(a)), ' ', cmp(Bs, As, Q(b), len ? '더 길어요' : '더 많아요'), ` ${askB}`);
    else if (kind === 'less') story = S(at1(Q(a)), ' ', cmp(As, Bs, Q(b), len ? '짧아요' : '적어요'), ` ${askB}`);
    else story = S(`${haveQ} `, Q(b), `${nu(b, '을', '를')} ${U[1]} `, Q(a), `${nu(a, '이', '가')} 남았어요. ${first} ${many}${was}?`);
    const cue = kind === 'less' ? `'${len ? '짧아요' : '적어요'}'만 보고 뺄셈을 고름` : kind === 'start' ? "'남았어요'만 보고 뺄셈을 고름" : '덧셈 대신 뺄셈을 고름';
    const wrongs = [ge(a, b) ? { t: E(a, '−', b, st), name: cue } : { t: E(b, '−', a, st), name: cue }];
    if (W && g >= 3) wrongs.push({ t: E(a, '×', b, st), name: '덧셈 대신 곱셈을 고름' });
    return { story, x, kind, wrongs, right: E(a, '+', b, st), unit };
  }
  const kinds = !x.n ? ['take'] : e.plain ? ['take', 'take', 'diff'] : g <= 1 ? ['take', 'take', 'diff', 'part'] : ['take', 'take', 'diff', 'part', 'more', 'change'];
  const kind = r.pick(kinds), U = M.use(val(kind === 'change' ? x : b));   // 덜어 낸 수에 맞는 말(바뀐 수 구하기는 답이 덜어 낸 수)
  let story;
  if (kind === 'take') story = S(have(Q(a)), ' 그중 ', Q(b), `${nu(b, '을', '를')} ${U[0]}. ${left} ${many}일까요?`);
  else if (kind === 'diff') story = len ? S(`${A}${j(A, '은', '는')} `, Q(a), `, ${Bs}${Be} `, Q(b), `${cop(b)}. ${As}${Ae} ${Bs}보다 ${many} 더 길까요?`)
    : S(`${A}에는 ${T}${tj} `, Q(a), `, ${Bs}에는 `, Q(b), ` ${atV}어요. ${As}${Ae} ${Bs}보다 ${T}${tj} ${many} 더 많을까요?`);
  else if (kind === 'part') story = len ? S(`${A}${j(A, '과', '와')} ${Bs}의 길이를 더하면 `, Q(a), `${cop(a)}. ${As}${j(As, '이', '가')} `, Q(b), `이면 ${Bs}${Be} ${many}일까요?`)
    : S(`${A}${j(A, '과', '와')} ${Bs}에 ${T}${tj} 모두 `, Q(a), ` ${atV}어요. 그중 `, Q(b), `${nu(b, '이', '가')} ${As}에 ${atV}어요. ${askB}`);
  else if (kind === 'more') story = S(at1(Q(a)), ' ', cmp(As, Bs, Q(b), len ? '더 길어요' : '더 많아요'), ` ${askB}`);
  else story = S(`${me ? '나는 ' : hold ? `${box}에 든 ` : ''}${T} `, Q(a), ` 중에서 ${W ? `몇 ${u}${j(u, '을', '를')}` : '얼마를'} ${U[1]} `, Q(b), `${nu(b, '이', '가')} 남았어요. ${U[2]} ${T}${tn} ${many}일까요?`);
  const cue = kind === 'diff' ? "'더'만 보고 덧셈을 고름" : kind === 'more' ? `'${len ? '더 길어요' : '더 많아요'}'만 보고 덧셈을 고름` : kind === 'part' ? "'모두'만 보고 덧셈을 고름" : '뺄셈 대신 덧셈을 고름';
  const wrongs = [{ t: E(a, '+', b, st), name: cue }];
  if (W && g >= 3) wrongs.push({ t: E(a, '×', b, st), name: '뺄셈 대신 곱셈을 고름' });
  return { story, x, kind, wrongs, right: E(a, '−', b, st), unit };
}

// ── 세 수의 덧셈 ──
function add3(e, r) {
  const x = ar('+', ar('+', e.a, e.b), e.c);
  const M = ctx(r, COUNT, big(e.a, e.b, e.c, x), (C) => C.col), Q = (y) => q(y, 'W', M.u);
  const story = S(`${M.T}${j(M.T, '을', '를')} 첫째 날 `, Q(e.a), ', 둘째 날 ', Q(e.b), ', 셋째 날 ', Q(e.c), ` ${M.col[0]}. ${M.col[1]} ${M.T}${j(M.T, '은', '는')} 모두 몇 ${M.u}일까요?`);
  return { story, x, kind: 'add3', right: S(txt(e.a, 'W'), ' + ', txt(e.b, 'W'), ' + ', txt(e.c, 'W')), wrongs: [{ t: S(txt(e.a, 'W'), ' + ', txt(e.b, 'W')), name: '세 수 중 하나를 빠뜨림' }], unit: M.u };
}

// ── 곱셈 ──
// 큰 수의 같은 묶음 — 값 · 줄넘기 · 쪽 · 걸음(한 번에 a, b번)
const BIGMUL = [
  { aMin: 100, aMax: 9999, bMin: 2, bMax: 99, ten: true, make: (a, b, r) => { const it = r.pick(ITEMS); return [`${b > 30 ? '학교에서 ' : ''}한 ${it.u}에 ${a}원인 ${it.T}${j(it.T, '을', '를')} ${b}${it.u} 사려고 해요. 내야 할 돈은 모두 얼마일까요?`, '원']; } },   // 값은 10원 단위만 · 30개 넘게는 학교가 삼
  { aMin: 10, aMax: 500, bMin: 2, bMax: 99, make: (a, b) => [`하루에 줄넘기를 ${a}번씩 했어요. ${b}일 동안 줄넘기를 모두 몇 번 했을까요?`, '번'] },
  { aMin: 2, aMax: 50, bMin: 2, bMax: 31, make: (a, b) => [`하루에 동화책을 ${a}쪽씩 읽었어요. ${b}일 동안 모두 몇 쪽을 읽었을까요?`, '쪽'] },
  { aMin: 100, aMax: 9999, bMin: 2, bMax: 99, make: (a, b) => [`하루에 ${a}걸음씩 걸었어요. ${b}일 동안 모두 몇 걸음을 걸었을까요?`, '걸음'] },
];
function mul(e, r, g) {
  const { a, b, st } = e;
  const right = E(a, '×', b, st), x = ar('×', a, b);
  const wrongs = [{ t: E(a, '+', b, st), name: '곱셈 대신 덧셈을 고름' }];
  if (whole(a) && whole(b)) {
    const A = a.n / a.d, Bv = b.n / b.d, opts = [];
    for (const G of GROUPS) if (A <= G.aMax && A >= (G.aMin || 2) - (G.one ? 1 : 0) && Bv <= G.bMax && Bv >= 2) opts.push(['groups', G], ['groups', G]);
    if (A >= 2 && A <= 12 && Bv >= 2 && Bv <= 12) opts.push(['rows']);
    if (A >= 2 && Bv >= 2 && Bv <= 9) { const C = COUNT.filter((C) => fits(C, A * Bv) && (!C.lo || A >= C.lo)); if (C.length) opts.push(['times', r.pick(C)]); }
    for (const K of BIGMUL) if (A >= K.aMin && A <= K.aMax && Bv >= K.bMin && Bv <= K.bMax && (!K.ten || A % 10 === 0)) opts.push(['big', K]);
    if (!opts.length) opts.push(['big', BIGMUL[3]]);
    const [kind, Z] = r.pick(opts);
    if (kind === 'rows') return { story: S(`의자를 한 줄에 ${A}개씩 ${Bv}줄로 놓았어요. 의자는 모두 몇 개일까요?`), x, kind, right, wrongs, unit: '개' };
    if (kind === 'times') {
      const [P1] = Z.at, [S1, P2] = Z.sh || Z.at;
      return { story: S(`${P1}에는 ${Z.T}${j(Z.T, '이', '가')} `, q(a, 'W', Z.u), ` 있어요. ${P2}의 ${Z.T}${j(Z.T, '은', '는')} ${S1}의 ${Bv}배예요. ${P2}에는 ${Z.T}${j(Z.T, '이', '가')} 몇 ${Z.u} 있을까요?`), x, kind, right, wrongs, unit: Z.u };
    }
    if (kind === 'big') { const [t, unit] = Z.make(A, Bv, r); return { story: S(t), x, kind: 'groups', right, wrongs, unit }; }
    const G = Z;
    return { story: S(`${G.T}${j(G.T, '이', '가')} 한 ${G.g}에 `, q(a, 'W', G.u), `씩 ${G.v}어요. ${gN(G, Bv)}에는 ${G.T}${j(G.T, '이', '가')} 모두 몇 ${G.u} ${G.v}을까요?`), x, kind, right, wrongs, unit: G.u };
  }
  if (whole(b)) {   // 분수 · 소수 × 자연수 — 한 병에 ○ L씩 · 선물 하나에 리본 ○ m · 상자 하나의 무게
    const Bv = b.n / b.d, A = val(a), k = r.int(0, st === 'D' ? 2 : 1);
    if (k === 0) { const c = cont(A); return { story: c === '병' ? S('한 병에 물이 ', q(a, st, 'L'), `씩 들어 있어요. ${Bv}병에 든 물은 모두 몇 L일까요?`) : S(`한 ${c}에 물이 `, q(a, st, 'L'), `씩 들어 있어요. ${c} ${Bv}개에 든 물은 모두 몇 L일까요?`), x, kind: 'groups', right, wrongs, unit: ' L' }; }
    if (k === 1) return { story: A <= 2 ? S('선물 한 개를 포장하는 데 리본이 ', q(a, st, 'm'), ` 필요해요. 선물 ${Bv}개를 포장하려면 리본은 모두 몇 m 필요할까요?`) : S('길이가 ', q(a, st, 'm'), `인 끈이 ${Bv}개 있어요. 끈의 길이는 모두 몇 m일까요?`), x, kind: 'groups', right, wrongs, unit: ' m' };
    return { story: S('한 개의 무게가 ', q(a, st, 'kg'), `인 상자 ${Bv}개의 무게는 모두 몇 kg일까요?`), x, kind: 'groups', right, wrongs, unit: ' kg' };
  }
  if (whole(a)) {   // 자연수 × 분수(몇의 몇 분의 몇 · 몇 배) · 자연수 × 소수(무게)
    const A = a.n / a.d;
    if (st === 'D') return { story: S('한 개의 무게가 ', q(b, st, 'kg'), `인 상자 ${A}개의 무게는 모두 몇 kg일까요?`), x, kind: 'groups', right, wrongs, unit: ' kg' };
    if (val(b) > 1) return { story: S(`빨간 끈은 ${A} m이고, 파란 끈은 빨간 끈의 `, tok(b, st), '배예요. 파란 끈은 몇 m일까요?'), x, kind: 'times', right, wrongs, unit: ' m' };
    const C = COUNT.filter((C) => fits(C, A));
    if (whole(x) && C.length) { const M = r.pick(C); return { story: S(`${M.T} `, q(a, 'W', M.u), '의 ', tok(b, st), `${j(txt(b, st), '은', '는')} 몇 ${M.u}일까요?`), x, kind: 'of', right, wrongs, unit: M.u }; }
    return { story: S(`끈 ${A} m의 `, tok(b, st), `${j(txt(b, st), '은', '는')} 몇 m일까요?`), x, kind: 'of', right, wrongs, unit: ' m' };
  }
  if (st === 'D') { const rod = val(a) > 0.5 ? '쇠막대' : '철사'; return { story: S('1 m의 무게가 ', q(a, st, 'kg'), `인 ${rod} `, q(b, st, 'm'), '의 무게는 몇 kg일까요?'), x, kind: 'rate', right, wrongs, unit: ' kg' }; }
  if (val(b) < 1) return { story: S('리본 ', q(a, st, 'm'), '의 ', tok(b, st), `${j(txt(b, st), '은', '는')} 몇 m일까요?`), x, kind: 'of', right, wrongs, unit: ' m' };
  return { story: S('빨간 리본은 ', q(a, st, 'm'), '이고, 파란 리본은 빨간 리본의 ', tok(b, st), '배예요. 파란 리본은 몇 m일까요?'), x, kind: 'times', right, wrongs, unit: ' m' };
}

// ── 나눗셈 ──
function divide(e, r, g) {
  const { a, b, st, rem } = e;
  const right = E(a, '÷', b, st), x = ar('÷', a, b);
  const wrongs = [{ t: E(a, '×', b, st), name: '나눗셈 대신 곱셈을 고름' }];
  if (g >= 6) wrongs.push({ t: E(b, '÷', a, st), name: '나누는 수와 나뉘는 수를 바꿈' });
  else if (whole(a) && whole(b)) wrongs.push({ t: E(a, '−', b, st), name: '나눗셈 대신 뺄셈을 고름' });
  if (whole(a) && whole(b)) {
    const A = a.n / a.d, Bv = b.n / b.d, qn = Math.floor(A / Bv), rn = A % Bv;
    if (!rem && (A < Bv || rn)) {   // 몫이 분수 · 소수(6-1) — 끈을 똑같이 나누기
      return { story: S(`끈 ${A} m를 ${Bv}명이 똑같이 나누어 가지면 한 명이 몇 m씩 가질까요?`), x, kind: 'share', right, wrongs, unit: ' m', st: e.asDecimal ? 'D' : 'F' };
    }
    const R = rem ? { rem: [qn, rn] } : {};
    const opts = [];
    // 똑같이 나누기(등분제) — 30명까지는 사람, 그보다 많으면 상자
    if (Bv >= 2) { const C = COUNT.filter((C) => fits(C, A) && (!C.lo || Bv <= 30 || C.share === 'box')); if (C.length) opts.push(['share', r.pick(C)]); }
    // 몇씩 담기(포함제)
    for (const G of GROUPS) if (Bv <= G.aMax && Bv >= (G.aMin || 2) - (G.one ? 1 : 0) && qn <= G.bMax && qn >= 1) opts.push(['pack', G]);
    if (Bv >= 100 && Bv % 10 === 0 && qn >= 1) opts.push(['money']);   // 값은 10원 단위만
    if (!rem && A <= 300 && Bv <= 50 && qn >= 2 && qn <= 31) opts.push(['pages']);   // 동화책 한 권은 300쪽까지
    if (!opts.length) opts.push(['pack', GROUPS[3]]);
    const [kind, Z] = r.pick(opts);
    if (kind === 'share') {
      const M = Z, obj = `${M.T} ${A}${M.u}${j(M.u, '을', '를')}`;
      const u2 = `${M.u}씩, 남는 ${M.T} `;
      if (M.share === 'people' && Bv <= 30) return { story: S(`${obj} ${Bv}명이 똑같이 나누어 가지면 한 명이 몇 ${M.u}씩 ${rem ? `가지고, 몇 ${M.u}${j(M.u, '이', '가')} 남을까요?` : '가질까요?'}`), x, kind, ...R, right, wrongs, unit: M.u, unit2: u2 };
      return { story: S(`${obj} ${M.bag} ${Bv}개에 똑같이 나누어 넣으면 한 ${M.bag}에 몇 ${M.u}씩 ${rem ? `넣을 수 있고, 몇 ${M.u}${j(M.u, '이', '가')} 남을까요?` : '넣을 수 있을까요?'}`), x, kind, ...R, right, wrongs, unit: M.u, unit2: u2 };
    }
    if (kind === 'money') {
      const it = r.pick(ITEMS), lead = `${A}원으로 한 ${it.u}에 ${Bv}원인 ${it.T}${j(it.T, '을', '를')}`;
      return { story: S(rem ? `${lead} 몇 ${it.u}까지 살 수 있고, 남는 돈은 얼마일까요?` : `${lead} 몇 ${it.u} 살 수 있을까요?`), x, kind: 'pack', ...R, right, wrongs, unit: rem ? '원' : it.u, unit2: `${it.u}, 남는 돈 ` };
    }
    if (kind === 'pages') return { story: S(`동화책 ${A}쪽을 하루에 ${Bv}쪽씩 읽으면 며칠 만에 다 읽을까요?`), x, kind: 'pack', right, wrongs, unit: '일' };
    const G = Z, obj = `${G.T} ${A}${G.u}${j(G.u, '을', '를')} 한 ${G.g}에 ${Bv}${G.u}씩 ${G.put}`;
    if (G.cnt) return { story: S(rem ? `${obj} ${G.g} 몇 ${G.cnt}에 ${G.put.replace('으면', '을')} 수 있고, 몇 ${G.u}${j(G.u, '이', '가')} 남을까요?` : `${obj} ${G.g}${j(G.g, '이', '가')} 몇 ${G.cnt} 필요할까요?`), x, kind: 'pack', ...R, right, wrongs, unit: rem ? G.u : G.cnt, unit2: `${G.cnt}, 남는 ${G.T} ` };
    return { story: S(rem ? `${obj} 몇 ${G.g}${j(G.g, '이', '가')} 되고, 몇 ${G.u}${j(G.u, '이', '가')} 남을까요?` : `${obj} 몇 ${G.g}${j(G.g, '이', '가')} 될까요?`), x, kind: 'pack', ...R, right, wrongs, unit: rem ? G.u : G.g, unit2: `${G.g}, 남는 ${G.T} ` };
  }
  if (whole(b)) {   // 분수 · 소수 ÷ 자연수 — 똑같이 나누기(길이는 사람에게 · 물과 밀가루는 그릇에 · 물은 한 명이 1 L 이하일 때만 마시기)
    const Bv = b.n / b.d, M = ctx(r, MEASURE, val(a));
    if (M.how === 'len') return { story: S(`${M.T} `, q(a, st, M.u), `${uj(M.u, '을', '를')} ${Bv}명이 똑같이 나누어 가지면 한 명이 몇 ${M.u}씩 가질까요?`), x, kind: 'share', right, wrongs, unit: ` ${M.u}` };
    if (M.T === '물' && val(x) <= 1 && Bv <= 30) return { story: S('물 ', q(a, st, 'L'), `${uj('L', '을', '를')} ${Bv}명이 똑같이 나누어 마시면 한 명이 몇 L씩 마실까요?`), x, kind: 'share', right, wrongs, unit: ' L' };
    const box = holder(M, val(x));   // 한 그릇에 담길 양에 맞는 그릇
    return { story: S(`${M.T} `, q(a, st, M.u), `${uj(M.u, '을', '를')} ${box} ${Bv}개에 똑같이 나누어 담으면 한 ${box}에 몇 ${M.u}씩 담을 수 있을까요?`), x, kind: 'share', right, wrongs, unit: ` ${M.u}` };
  }
  if (whole(x)) {   // ÷ 분수 · 소수, 몫이 자연수 — 몇씩 자르기 · 그릇에 나누어 담기(포함제)
    if (whole(a)) { const c = cont(val(b)); return { story: S('물 ', q(a, st, 'L'), `${uj('L', '을', '를')} 한 ${c}에 `, q(b, st, 'L'), `씩 나누어 담으면 ${c === '물통' ? '물통이 몇 개 필요할까요?' : `몇 ${c}${j(c, '이', '가')} 될까요?`}`), x, kind: 'pack', right, wrongs, unit: c === '물통' ? '개' : c }; }
    return { story: S('리본 ', q(a, st, 'm'), `${uj('m', '을', '를')} `, q(b, st, 'm'), '씩 자르면 몇 도막이 될까요?'), x, kind: 'pack', right, wrongs, unit: '도막' };
  }
  return { story: S('빨간 리본은 ', q(a, st, 'm'), ', 파란 리본은 ', q(b, st, 'm'), '예요. 빨간 리본의 길이는 파란 리본의 몇 배일까요?'), x, kind: 'times', right, wrongs, unit: '배' };
}

// ── 하나 만들기 ──
//   plain = 바로 읽히는 구조만(보태기 · 모으기 · 덜기 · 차이) — 연습(불 켜기)에 섞을 때: 계산을 익히는 곳에서 반대 낱말 비교 · 처음 수 모름 같은 어려운 구조가 불을 막지 않게
export function storyOf(c, p, seed = 1, { plain = false } = {}) {
  if (!hasWords(c) || p == null) return null;
  let it; try { it = makeItem(c, p); } catch (e) { return null; }
  const e = readItem(it);
  if (!e || !e.a.n || !e.b.n || (e.c && !e.c.n)) return null;   // 0이 든 식(0을 더하기 · 0의 곱)은 이야기로 바꾸지 않음
  if (byId[c].fam === 'g6_DDIV' && e.st === 'W') e.asDecimal = true;   // 자연수 ÷ 자연수의 몫을 소수로(6-1)
  e.plain = plain;
  const r = rng(seed), g = grade(c);
  if (g === 4 && e.st === 'F') e.st = 'FS';   // 4학년은 약분을 아직 안 배움 — 분모를 그대로(7 2/6)
  let s;
  if (e.op === '+' && e.c) s = add3(e, r);
  else if (e.op === '+' || e.op === '−') s = addSub(e, r, g);
  else if (e.op === '×') s = mul(e, r, g);
  else s = divide(e, r, g);
  if (!s) return null;
  const st = s.st || e.st;
  let item;
  if (s.rem) item = nums(['답 ', B(0), s.unit2, B(1), s.unit], s.rem, { bugs: [] });
  else {
    const bugs = (s.wrongs || []).map((w) => { try { const t = toText([].concat(w.t)), m = t.match(new RegExp(`^(${NUM}) ([+−×÷]) (${NUM})$`)); if (!m) return null; const y = ar(m[2], num(m[1]).x, num(m[3]).x, st); return y.n > 0 ? { x: y, name: w.name } : null; } catch (er) { return null; } }).filter(Boolean);
    item = answerItem('답 ', s.x, st === 'W' && !whole(s.x) ? 'F' : st, s.unit, bugs);
  }
  item.story = s.story;
  const calc = { kind: 'calc', why: '그 식을 계산해요.', item: makeItem(c, p), c };
  return { c, story: s.story, item, x: s.x || null, rem: s.rem || null, kind: s.kind, steps: [pickStep(s.right, s.wrongs || [], r), calc], ans: item.ans, unit: s.unit || '', unit2: s.unit2 || '' };
}
export { readItem };
// 글 검사(tests/text.test.mjs)에 쓰는 낱말 — 조사가 붙는 이름들
export const VOCAB = [...new Set([
  ...COUNT.flatMap((C) => [C.T, C.u, ...C.at, ...(C.sh || []), typeof C.own === 'string' && C.own !== 'me' && C.own, C.bag].filter(Boolean)), '우리 반',
  ...MEASURE.flatMap((M) => [M.T, ...(M.at || [])]), '물병', '수조', '통', '쇠막대',
  ...GROUPS.flatMap((G) => [G.T, G.u, G.g]), ...ITEMS.map((x) => x.T), '끈', '리본', '철사', '물통', '컵', '병', '도막', '의자', '선물', '상자', '봉지',
])];
