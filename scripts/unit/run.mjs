#!/usr/bin/env node
// 우리반 성장 RPG — 순수 함수 단위 테스트 (read-only, 앱 코드 수정 없음)
//
//  · scripts/smoke-test.mjs(구조·HTTP)와 별개. smoke 기준선(29)은 건드리지 않는다.
//  · student.js 는 최상위에서 document 를 만지므로 통째로 로드하지 않고,
//    함수 이름으로 **본문만 잘라내어** vm 샌드박스에서 돌린다(아래 sliceFn).
//    함수가 이름을 바꾸거나 사라지면 여기서 FAIL 이 난다 — 그게 의도다.
//  · gamedata.js 는 smoke-test 와 같은 방식으로 통째로 로드한다(DB._normalizeArrays).
//  · 외부 패키지·네트워크·Firebase 없음. Node 기본 모듈만.
//
// 실행: node scripts/unit/run.mjs   (FAIL 1개 이상이면 exit 1)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const results = [];
let cur = '';
const test = (name, fn) => {
  try { fn(); results.push({ ok: true, msg: `${cur} · ${name}` }); }
  catch (e) { results.push({ ok: false, msg: `${cur} · ${name} — ${e.message}` }); }
};
const eq = (a, b, note = '') => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${note ? note + ': ' : ''}기대 ${sb}, 실제 ${sa}`);
};

// ── 소스에서 함수/상수 하나를 이름으로 잘라낸다 ──────────────────
//  "function NAME(" 이 줄 머리에 있는 곳부터 중괄호 짝이 맞는 곳까지.
//  문자열·정규식·주석 안의 중괄호를 완벽히 세지는 않지만, 대상 함수들은 그런 경우가 없다.
//  [DECO-SPACE-1] 꾸미기 함수들은 '지금 공간'의 장식·바닥만 본다 — 시험 샌드박스에 공간 도우미를 먼저 넣는다(공간 1)
const NL = String.fromCharCode(10);
const SPACE_PRELUDE = (S) => 'let DECO_SPACE = 1;' + NL + ['_decoSpaceOf', '_decoList', '_yardFloorGet', '_yardFloorMap', '_floorParse']
  .map(n => sliceFn(S, n)).join(NL) + NL;

//  [DECO-BUNDLE-1] 그림 묶음 로더 — 모래상자엔 fetch 가 없어 늘 낱장 주소로 간다(기존 기대값 그대로)
//  [DECO-LOOK-0] 마당 모습 표 + 해석기(YARD_LOOK_BASE ~ _yardPhase) — 계절 · 때를 읽는 그리기 함수가 쓴다(_seaNow 가 있어야 한다)
const LOOK_PRELUDE = (S) => { const a = S.indexOf('const YARD_LOOK_BASE'), b = S.indexOf('\n', S.indexOf('function _yardPhase(')); if (a < 0 || b < 0) throw new Error('YARD_LOOKS 표를 못 찾음'); return S.slice(a, b) + '\n'; };
const ART_PRELUDE = (S) => sliceConst(S, 'ART_BUNDLE_URL') + sliceConst(S, '_ART') + ['_artStart', '_artSrc', '_artHas'].map(n => sliceFn(S, n)).join(NL) + NL;

function sliceFn(src, name) {
  const re = new RegExp(`^function ${name}\\s*\\(`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`함수 없음: ${name}`);
  let i = src.indexOf('{', m.index), depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
  }
  throw new Error(`중괄호 안 닫힘: ${name}`);
}
function sliceConst(src, name) {
  const re = new RegExp(`^(?:const|let|var) ${name}\\s*=[^\\n]*\\n`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`상수 없음: ${name}`);
  return m[0];
}

const STUDENT = read('student.js');

// 샌드박스 하나: student.js 에서 필요한 조각만 넣고, 바깥 의존(DB·Utils·CurriculumUtils·CUR)은 스텁으로.
function studentSandbox(stubs = {}) {
  const sb = { console, ...stubs };
  sb.globalThis = sb;
  vm.createContext(sb);
  const pieces = [
    sliceFn(STUDENT, 'escHtml'),
    sliceConst(STUDENT, 'DICTATION_STRICT_SPACING'),
    sliceFn(STUDENT, 'dictationGrade'),
    sliceFn(STUDENT, 'dictationMarks'),
    sliceFn(STUDENT, 'dictationDiffHtml'),
    sliceConst(STUDENT, 'MASTERY_GAP'),
    'let _masteryCache = null, _masteryOwner = null;',
    sliceFn(STUDENT, 'invalidateMastery'),
    sliceFn(STUDENT, 'addDaysStr'),
    sliceFn(STUDENT, 'masteryMap'),
    sliceFn(STUDENT, 'masteryOf'),
    sliceFn(STUDENT, 'isDueForReview'),
    sliceFn(STUDENT, 'starsText'),
    sliceFn(STUDENT, 'dueCountsBySubject'),
    sliceFn(STUDENT, 'unitMastery'),
    sliceFn(STUDENT, 'problemLang'),
  ];
  vm.runInContext(pieces.join('\n') + `
;globalThis.__x = { escHtml, dictationGrade, dictationMarks, dictationDiffHtml, addDaysStr, masteryMap,
  masteryOf, isDueForReview, starsText, dueCountsBySubject, unitMastery, invalidateMastery, problemLang, MASTERY_GAP };`, sb);
  return sb.__x;
}

// ═══════════════════════════════════════════════════════════════
cur = 'escHtml';
{
  const { escHtml } = studentSandbox();
  test('null·undefined → 빈 문자열', () => { eq(escHtml(null), ''); eq(escHtml(undefined), ''); });
  test('다섯 글자 이스케이프', () => eq(escHtml(`<b a="1">&'`), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;'));
  test('숫자·보통 문자열은 그대로', () => { eq(escHtml(12), '12'); eq(escHtml('가나다 abc'), '가나다 abc'); });
  test('& 를 먼저 바꿔 이중 이스케이프 없음', () => eq(escHtml('&lt;'), '&amp;lt;'));
}

// ═══════════════════════════════════════════════════════════════
cur = 'dictationGrade';
{
  const { dictationGrade } = studentSandbox();
  const p = { a: '나는 학교에 간다' };
  test('정답 그대로 → ok·charOk·spaceOk', () => eq(dictationGrade(p, '나는 학교에 간다'), { ok: true, charOk: true, spaceOk: true }));
  test('띄어쓰기만 다름 → 글자 맞음, 띄어쓰기 틀림, ok(느슨 정책)', () =>
    eq(dictationGrade(p, '나는학교에 간다'), { ok: true, charOk: true, spaceOk: false }));
  test('글자 틀림 → ok 아님, 띄어쓰기 모양은 따로 판정', () =>
    eq(dictationGrade(p, '나는 학교에 갔다'), { ok: false, charOk: false, spaceOk: true }));
  test('앞뒤 공백·여러 칸은 무시', () => eq(dictationGrade(p, '  나는   학교에 간다 ').ok, true));
  test('빈 답·null 은 틀림(에러 없음)', () => { eq(dictationGrade(p, '').ok, false); eq(dictationGrade(p, null).ok, false); });
}

// ═══════════════════════════════════════════════════════════════
cur = 'dictationMarks(LCS)';
{
  const { dictationMarks, dictationDiffHtml } = studentSandbox();
  test('완전 일치 → 전부 맞음', () => { const r = dictationMarks('학교', '학교'); eq([r.matched, r.total], [2, 2]); });
  test('글자 하나 틀림 → total-1', () => { const r = dictationMarks('나는 간다', '나는 갔다'); eq([r.matched, r.total], [3, 4]); eq([...r.okIdx].sort(), [0, 1, 3]); });
  test('빠뜨린 글자 → 그 자리만 빠짐', () => { const r = dictationMarks('가나다라', '가다라'); eq(r.matched, 3); eq(r.okIdx.has(1), false); });
  test('빈 입력 → 0 맞음, 에러 없음', () => { const r = dictationMarks('가나', ''); eq([r.matched, r.total], [0, 2]); eq(dictationMarks('가나', null).matched, 0); });
  test('공백은 세지 않는다', () => eq(dictationMarks('가 나', '가나').matched, 2));
  test('diffHtml: 맞은 글자 emerald·틀린 글자 red, 공백 유지', () => {
    const h = dictationDiffHtml('가 나', '가 다');
    if (!/emerald[^<]*>가</.test(h) || !/red[^<]*>나</.test(h) || !h.includes('> ')) throw new Error('색 표시 어긋남: ' + h);
  });
}

// ═══════════════════════════════════════════════════════════════
cur = 'addDaysStr';
{
  const { addDaysStr } = studentSandbox();
  // 이 테스트는 시간대에 상관없이 같은 답이 나와야 한다(학교 PC·크롬북은 KST).
  test('+0 은 같은 날', () => eq(addDaysStr('2026-09-15', 0), '2026-09-15'));
  test('+1 은 다음 날', () => eq(addDaysStr('2026-09-15', 1), '2026-09-16'));
  test('+14 는 달을 넘긴다', () => eq(addDaysStr('2026-09-20', 14), '2026-10-04'));
  test('+7 연말 넘김', () => eq(addDaysStr('2026-12-28', 7), '2027-01-04'));
  test('윤년 2월', () => eq(addDaysStr('2028-02-28', 1), '2028-02-29'));
  test('이상한 문자열은 그대로 돌려준다', () => eq(addDaysStr('없음', 3), '없음'));
}

// ═══════════════════════════════════════════════════════════════
cur = 'masteryMap';
function masteryStubs(records, today = '2026-09-15', extra = {}) {
  return {
    CUR: { id: 'sA' },
    DB: { getProblemRecords: (id) => (id === 'sA' ? records : []) },
    Utils: { todayStr: () => today },
    CurriculumUtils: extra.CurriculumUtils || { activeUnitIds: () => null, subjects: () => [], problemsByUnit: () => [] },
  };
}
{
  const recs = [
    { date: '2026-09-10', answers: [{ problemId: 'p1', correct: true }, { problemId: 'p2', correct: false }] },
    { date: '2026-09-12', answers: [{ problemId: 'p1', correct: true }, { problemId: 'p2', correct: true }] },
    { date: '2026-09-11', answers: [{ problemId: 'p1', correct: false }] },         // 날짜 뒤섞임 → 정렬해서 셈
    { date: '2026-09-13', review: true, answers: [{ problemId: 'p1', correct: true }] }, // 복습 세션은 제외
    { date: '2026-09-13', answers: null },                                            // 모양 이상 → 무시
    { date: '2026-09-14', answers: [null, { problemId: '' }, { problemId: 'p3', correct: true }] },
  ];
  const x = studentSandbox(masteryStubs(recs));
  const m = x.masteryMap();
  test('날짜순으로 별 오르내림 (p1: +1 −1 +1 = 1)', () => eq(m.get('p1').lv, 1));
  test('별 0 에서 틀리면 0 유지 (p2: −→0, + → 1)', () => eq(m.get('p2').lv, 1));
  test('복습(review) 기록은 세지 않는다', () => eq(m.get('p1').last, '2026-09-12'));
  test('answers 가 배열 아니면 건너뜀·빈 problemId 무시', () => { eq(m.has(''), false); eq(m.get('p3').lv, 1); });
  test('next = last + GAP[lv] (lv1 → 하루 뒤)', () => eq(m.get('p1').next, x.addDaysStr('2026-09-12', x.MASTERY_GAP[1])));
  test('별 상한 5', () => {
    const five = Array.from({ length: 8 }, (_, i) => ({ date: `2026-09-0${i + 1}`, answers: [{ problemId: 'q', correct: true }] }));
    const y = studentSandbox(masteryStubs(five));
    eq(y.masteryMap().get('q').lv, 5);
    eq(y.masteryMap().get('q').next, y.addDaysStr('2026-09-08', 14));
  });
  test('같은 학생이면 캐시, 다른 id 면 새로 계산', () => {
    const y = studentSandbox(masteryStubs(recs));
    const a = y.masteryMap('sA'); const b = y.masteryMap('sA');
    if (a !== b) throw new Error('캐시 안 됨');
    eq(y.masteryMap('sB').size, 0);
  });
  test('invalidateMastery 뒤 다시 계산', () => {
    const y = studentSandbox(masteryStubs(recs));
    const a = y.masteryMap(); y.invalidateMastery(); const b = y.masteryMap();
    if (a === b) throw new Error('캐시 안 비워짐');
  });
  test('getProblemRecords 가 던지면 빈 맵 (처음 쓰는 학생과 같음)', () => {
    const y = studentSandbox({ ...masteryStubs([]), DB: { getProblemRecords: () => { throw new Error('boom'); } } });
    eq(y.masteryMap().size, 0);
  });
  test('DB.getProblemRecords 없으면 빈 맵', () => {
    const y = studentSandbox({ ...masteryStubs([]), DB: {} });
    eq(y.masteryMap().size, 0);
  });
}

// ═══════════════════════════════════════════════════════════════
cur = 'isDueForReview';
{
  const recs = [
    { date: '2026-09-14', answers: [{ problemId: 'fresh', correct: true }] },   // lv1 → next 09-15 (오늘) → due
    { date: '2026-09-15', answers: [{ problemId: 'todayOk', correct: true }] }, // lv1 → next 09-16 → 아직
    { date: '2026-09-15', answers: [{ problemId: 'wrong', correct: false }] },  // lv0 → next 09-15 → 바로 due
  ];
  const x = studentSandbox(masteryStubs(recs, '2026-09-15'));
  test('안 푼 문항은 복습 아님', () => eq(x.isDueForReview('never'), false));
  test('오늘 맞힌 것(lv1)은 내일부터', () => eq(x.isDueForReview('todayOk'), false));
  test('어제 맞힌 것(lv1)은 오늘 복습', () => eq(x.isDueForReview('fresh'), true));
  test('틀린 것(lv0)은 바로 복습', () => eq(x.isDueForReview('wrong'), true));
  test('starsText', () => { eq(x.starsText(0), '☆☆☆☆☆'); eq(x.starsText(3), '★★★☆☆'); eq(x.starsText(5), '★★★★★'); });
}

// ═══════════════════════════════════════════════════════════════
cur = 'dueCountsBySubject·unitMastery';
{
  const recs = [
    { date: '2026-09-01', answers: [{ problemId: 'm1', correct: true }, { problemId: 'm2', correct: true }, { problemId: 'k1', correct: true }, { problemId: 'e1', correct: true }] },
    { date: '2026-09-15', answers: [{ problemId: 'm2', correct: true }] },   // m2 lv2 → 09-17 → 아직
  ];
  const problems = { 'math-1': [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], 'ko-1': [{ id: 'k1' }], 'en-1': [{ id: 'e1' }], 'soc-1': [{ id: 's1' }] };
  const CurriculumUtils = {
    activeUnitIds: () => ['math-1', 'ko-1', 'en-1', 'soc-1'],
    subjects: () => [
      { key: 'math', label: '수학', icon: '🔢', units: [{ id: 'math-1' }] },
      { key: 'korean', label: '국어', icon: '📗', units: [{ id: 'ko-1' }] },
      { key: 'english', label: '영어', icon: '🔤', units: [{ id: 'en-1' }] },
      { key: 'social', label: '사회', icon: '🌏', units: [{ id: 'soc-1' }] },
    ],
    problemsByUnit: (u) => problems[u] || [],
  };
  const x = studentSandbox(masteryStubs(recs, '2026-09-15', { CurriculumUtils }));
  test('과목별 오늘 복습 수 (영어 제외·0 은 빼고)', () =>
    eq(x.dueCountsBySubject().map(o => [o.key, o.n]), [['math', 1], ['korean', 1]]));
  test('교사가 끈 단원은 세지 않는다', () => {
    const y = studentSandbox(masteryStubs(recs, '2026-09-15', { CurriculumUtils: { ...CurriculumUtils, activeUnitIds: () => ['ko-1'] } }));
    eq(y.dueCountsBySubject().map(o => o.key), ['korean']);
  });
  test('activeUnitIds 가 null 이면 전부 센다', () => {
    const y = studentSandbox(masteryStubs(recs, '2026-09-15', { CurriculumUtils: { ...CurriculumUtils, activeUnitIds: () => null } }));
    eq(y.dueCountsBySubject().map(o => o.key), ['math', 'korean']);
  });
  test('unitMastery: 평균 별·본 문항·복습·전체', () => eq(x.unitMastery('math-1'), { avg: 2, seen: 2, due: 1, total: 3 }));
  test('unitMastery: 안 푼 단원은 0/0', () => eq(x.unitMastery('soc-1'), { avg: 0, seen: 0, due: 0, total: 1 }));
  test('problemLang: 문항 lang 우선, 국어 단원은 ko-KR, 그 외 en-US', () => {
    eq(x.problemLang({ lang: 'ja-JP' }), 'ja-JP'); eq(x.problemLang({ unitId: 'ko-3' }), 'ko-KR'); eq(x.problemLang({ unitId: 'math-1' }), 'en-US'); eq(x.problemLang(null), 'en-US');
  });
}

// ═══════════════════════════════════════════════════════════════
cur = 'gamedata._normalizeArrays';
{
  const sb = { console, window: {}, setTimeout,
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} }, alert: () => {} };
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('gamedata.js') + ';globalThis.__DB = DB;', sb);
  const norm = (d) => sb.__DB._normalizeArrays(JSON.parse(JSON.stringify(d)));

  test('학생 객체 → 배열, 하위 배열 필드 8개 전부 배열화', () => {
    const out = norm({ students: { s1: { id: 's1', name: '가', farm: { a: 1 }, inventory: null } } });
    const s = out.students[0];
    for (const k of ['farm', 'inventory', 'books', 'houseDecorations', 'achievements', 'titles', 'monsterLog', 'pendingRewards'])
      if (!Array.isArray(s[k])) throw new Error(k + ' 가 배열 아님');
    eq(s.farm, [1]);
  });
  test('id·name 없는 껍데기 학생 제외', () =>
    eq(norm({ students: [{ id: 's1' }, { name: '가' }, null, { id: 's2', name: '나' }] }).students.map(s => s.id), ['s2']));
  test('중복 학생: 숫자 키(낡은 본)보다 id 키(현재 본)가 이긴다', () => {
    const out = norm({ students: { 0: { id: 's7', name: '가', level: 3 }, s7: { id: 's7', name: '가', level: 9 } } });
    eq(out.students.map(s => s.level), [9]);
  });
  test('학생 정렬은 id 숫자 기준 (s10 이 s9 뒤)', () =>
    eq(norm({ students: { s10: { id: 's10', name: 'a' }, s9: { id: 's9', name: 'b' }, s1: { id: 's1', name: 'c' } } }).students.map(s => s.id), ['s1', 's9', 's10']));
  test('quests 는 questLogs 에서만 만든다 (studentId 없는 것 제외)', () => {
    const out = norm({ students: [], quests: [{ id: 'x' }], questLogs: { a: { studentId: 's1', q: 1 }, b: { q: 2 }, c: null } });
    eq(out.quests, [{ studentId: 's1', q: 1 }]);
  });
  test('빈 입력도 배열 필드가 전부 배열', () => {
    const out = norm({});
    for (const k of ['students', 'quests', 'promotionRequests', 'boardQuests', 'artworks', 'memories'])
      if (!Array.isArray(out[k])) throw new Error(k + ' 가 배열 아님');
  });
  test('memories: 같은 id 는 albumId 있는 것 우선 보존', () => {
    const out = norm({ students: [], memories: [{ id: 'm1' }, { id: 'm1', albumId: 'al' }, { id: 'm2', albumId: 'x' }, { id: 'm2' }] });
    const m1 = out.memories.find(m => m.id === 'm1'), m2 = out.memories.find(m => m.id === 'm2');
    eq(out.memories.length, 2); eq(m1.albumId, 'al'); eq(m2.albumId, 'x');
  });
}

// ═══════════════════════════════════════════════════════════════
cur = 'buster-check';
{
  const { check } = await import('./buster-check.mjs');
  const page = (js, gd, cur2) => `<script src="./gamedata.js?v=${gd}"></script><script src="./curriculum.js?v=${cur2}"></script><script src="./${js}"></script><link href="https://x/y.css?v=1">`;
  const H = (st, ad, ki) => ({ 'student.html': st, 'admin.html': ad, 'kiosk.html': ki });
  const base = H(page('student.js?v=20260914b', '20260910g', '20260909e'), page('admin.js?v=20260910k', '20260910g', '20260909e'), '<script src="./gamedata.js?v=20260910g"></script>');
  const lv = (r, l) => r.filter(x => x.level === l).map(x => x.msg);
  test('고친 파일 버스터 올림 → FAIL 0', () => {
    const head = { ...base, 'student.html': page('student.js?v=20260915q1a', '20260910g', '20260909e') };
    eq(lv(check({ changed: new Set(['student.js']), baseHtml: base, headHtml: head }), 'FAIL').length, 0);
  });
  test('고쳤는데 버스터 그대로 → FAIL', () => {
    const r = check({ changed: new Set(['student.js']), baseHtml: base, headHtml: base });
    eq(lv(r, 'FAIL').length, 1);
  });
  test('rebase 뒤 날짜가 main 보다 과거 (0914q1a < main 0915q3a) → FAIL', () => {
    const main = { ...base, 'student.html': page('student.js?v=20260915q3a', '20260910g', '20260909e') };
    const head = { ...base, 'student.html': page('student.js?v=20260914q1a', '20260910g', '20260909e') };
    eq(lv(check({ changed: new Set(['student.js']), baseHtml: main, tipHtml: main, headHtml: head }), 'FAIL').length, 1);
  });
  test('뒤처진 브랜치: 안 건드린 줄은 main 값이 남으므로 FAIL 아님 (#218 오탐 방지)', () => {
    const tip = { ...base, 'admin.html': page('admin.js?v=20260915q3a', '20260910g', '20260909e') };
    const head = { ...base, 'student.html': page('student.js?v=20260915bla', '20260910g', '20260909e') };
    eq(lv(check({ changed: new Set(['student.js']), baseHtml: base, tipHtml: tip, headHtml: head }), 'FAIL').length, 0);
  });
  test('뒤처진 브랜치가 admin.js 를 고쳤는데 버스터 안 올림 → main 이 딴 PR로 올렸어도 FAIL', () => {
    const tip = { ...base, 'admin.html': page('admin.js?v=20260915q3a', '20260910g', '20260909e') };
    eq(lv(check({ changed: new Set(['admin.js']), baseHtml: base, tipHtml: tip, headHtml: base }), 'FAIL').length, 1);
  });
  test('main 도 같은 버스터 줄을 바꿈 → 충돌 예상 REVIEW', () => {
    const tip = { ...base, 'admin.html': page('admin.js?v=20260915q3a', '20260910g', '20260909e') };
    const head = { ...base, 'admin.html': page('admin.js?v=20260915bla', '20260910g', '20260909e') };
    const r = check({ changed: new Set(['admin.js']), baseHtml: base, tipHtml: tip, headHtml: head });
    if (!lv(r, 'REVIEW').some(m => m.includes('충돌'))) throw new Error('충돌 예고 없음');
  });
  test('같은 날 다른 세션 코드 (main rfa → q3a) → 통과 (#220 오탐 방지)', () => {
    const main = { ...base, 'admin.html': page('admin.js?v=20260915rfa', '20260910g', '20260909e') };
    const head = { ...base, 'admin.html': page('admin.js?v=20260915q3a', '20260910g', '20260909e') };
    eq(lv(check({ changed: new Set(['admin.js']), baseHtml: main, tipHtml: main, headHtml: head }), 'FAIL').length, 0);
  });
  test('안 고친 파일 버스터가 뒤로 감 → FAIL', () => {
    const main = { ...base, 'admin.html': page('admin.js?v=20260915q3a', '20260910g', '20260909e') };   // head 는 옛 20260910k 로 되돌림
    eq(lv(check({ changed: new Set(['student.js']), baseHtml: main, tipHtml: main, headHtml: { ...main, 'admin.html': base['admin.html'], 'student.html': page('student.js?v=20260915q1a', '20260910g', '20260909e') } }), 'FAIL').length, 1);
  });
  test('gamedata 를 한 html 에서만 올림 → 불일치 FAIL', () => {
    const head = { ...base, 'student.html': page('student.js?v=20260914b', '20260915q1a', '20260909e') };
    const f = lv(check({ changed: new Set(['gamedata.js']), baseHtml: base, headHtml: head }), 'FAIL');
    if (!f.some(m => m.includes('html 마다 다름'))) throw new Error('불일치 못 잡음: ' + JSON.stringify(f));
  });
  test('세 html 동시에 올림 → FAIL 0', () => {
    const head = H(page('student.js?v=20260914b', '20260915q1b', '20260909e'), page('admin.js?v=20260910k', '20260915q1b', '20260909e'), '<script src="./gamedata.js?v=20260915q1b"></script>');
    eq(lv(check({ changed: new Set(['gamedata.js']), baseHtml: base, headHtml: head }), 'FAIL').length, 0);
  });
  test('?v= 없는 로컬 참조 → REVIEW, 외부 URL 무시', () => {
    const head = { ...base, 'kiosk.html': base['kiosk.html'] + '<script src="./kiosk.js"></script>' };
    eq(lv(check({ changed: new Set(), baseHtml: base, headHtml: head }), 'REVIEW').length, 1);
  });
}

// ═══════════════════════════════════════════════════════════════
cur = 'admin 비번 초기화 알림(PW-NOTIFY-1)';
{
  //  교사 PC 는 TV 로 미러링된다. 초기화 알림(notify)에 새 비밀번호 값이 찍히면 반 아이들이 본다.
  const ADMIN = read('admin.js');
  const run = (fnName, call) => {
    const said = [];
    const stu = { id: 's1', name: '학생1', pw: 'old' };
    const sb = {
      notify: (m) => said.push(String(m)), prompt: () => 'zq7Secret',
      document: { getElementById: (id) => (id.startsWith('newpw-') ? { value: ' zq7Secret ' } : null) },
      DB: { getStudent: () => stu, saveStudent() {}, removePwResetRequest() {} },
      renderAll() {}, renderPwResetList() {}, updatePwResetBadge() {},
    };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(sliceFn(ADMIN, fnName) + `\n${call};`, sb);
    return { said, stu };
  };
  for (const [fn, call] of [['approvePwResetDash', "approvePwResetDash('r1','s1',{})"], ['resetStudentPw', "resetStudentPw('r1','s1')"]]) {
    test(`${fn}: 비번은 바뀌고 알림엔 값이 없다`, () => {
      const { said, stu } = run(fn, call);
      eq(stu.pw, 'zq7Secret', '저장된 비번');
      if (!said.length) throw new Error('알림이 없음');
      const leak = said.filter(m => m.includes('zq7Secret'));
      if (leak.length) throw new Error('알림에 새 비번 값: ' + JSON.stringify(leak));
    });
  }
}

// ═══════════════════════════════════════════════════════════════
cur = 'admin 학생 상세 비번 가림(DET-PW-MASK-1)';
{
  //  학생 상세를 열면 비밀번호 칸이 TV 에 그대로 보였다. 기본은 가림(type=password), [보기] 로만 잠깐.
  const ADMIN = read('admin.js');
  // openStudentDetail 은 화면 전체를 그리므로 통째로 돌리지 않고, 비밀번호 칸 줄만 본다
  const m = /<input[^>]*id="det-pw"[^>]*>/.exec(sliceFn(ADMIN, 'openStudentDetail'));
  test('det-pw 칸이 있다', () => { if (!m) throw new Error('det-pw input 없음'); });
  test('det-pw 는 기본 가림(type=password)', () => { if (!m || !/type="password"/.test(m[0])) throw new Error(m ? m[0] : '없음'); });
  test('det-pw 값은 escHtml 로 넣는다', () => { if (!m || !/value="\$\{escHtml\(/.test(m[0])) throw new Error(m ? m[0] : '없음'); });
  test('toggleDetPw: 보기 ↔ 가리기', () => {
    const inp = { type: 'password' }, btn = { textContent: '보기' };
    const sb = { document: { getElementById: (id) => (id === 'det-pw' ? inp : id === 'det-pw-toggle' ? btn : null) } };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(sliceFn(ADMIN, 'toggleDetPw') + '\ntoggleDetPw();', sb);
    eq([inp.type, btn.textContent], ['text', '가리기'], '한 번');
    vm.runInContext('toggleDetPw();', sb);
    eq([inp.type, btn.textContent], ['password', '보기'], '두 번');
  });
}

// ═══════════════════════════════════════════════════════════════
cur = 'admin 작품 키 정리·중복 정리 확인(DEDUPE-ART-1·DEDUPE-CONFIRM-1)';
try {
  //  운영 artworks 는 옛 배열(숫자 키). 내리기·좋아요는 artworks/<id>/… 에만 써서 진짜 작품이 안 내려갔다.
  //  정리는 통째 set 이 아니라 **바뀔 키만** update 하고, id 키에 쓰인 조각(hidden·likes)은 합쳐야 한다.
  const ADMIN = read('admin.js');
  const sliceAsync = (name) => {
    const m = new RegExp('^async function ' + name + '[ \\t]*[(]', 'm').exec(ADMIN);
    if (!m) throw new Error('함수 없음: ' + name);
    let i = ADMIN.indexOf('{', m.index), dep = 0;
    for (; i < ADMIN.length; i++) { if (ADMIN[i] === '{') dep++; else if (ADMIN[i] === '}' && --dep === 0) return ADMIN.slice(m.index, i + 1); }
    throw new Error('중괄호: ' + name);
  };
  const runNorm = async (raw, keepSrc) => {
    const writes = [];
    const node = { once: async () => ({ val: () => JSON.parse(JSON.stringify(raw)) }), update: async (u) => { writes.push(u); }, set: async () => { writes.push('SET'); } };
    // 규칙은 gamedata DB._artworkKeyFix(ART-KEY-FIX-1) — 실제 gamedata.js 에서 가져온다
    const gd = { console, window: {}, setTimeout, document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} }, alert() {} };
    gd.globalThis = gd; vm.createContext(gd); vm.runInContext(read('gamedata.js') + ';globalThis.__DB = DB;', gd);
    const sb = { DB: { _artworkKeyFix: gd.__DB._artworkKeyFix, _fbRef: { child: (p) => { if (p !== 'artworks') throw new Error('다른 경로: ' + p); return node; } } } };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(sliceAsync('normalizeArtworkKeys') + '\nglobalThis.__n = normalizeArtworkKeys;', sb);
    const r = await sb.__n(vm.runInContext(keepSrc, sb));
    return { r, writes };
  };
  const A = (id, sid, extra = {}) => ({ id, studentId: sid, title: 't' + id, ...extra });
  const cases = [];
  cases.push(['옛 숫자 키 2개 → id 키로 옮기고 숫자 키는 null', await runNorm({ 0: A('a1', 's1'), 1: A('a2', 's2') }, '() => true'),
    ({ r, writes }) => { eq(writes.length, 1, 'update 1번'); eq(writes[0], { 0: null, 1: null, a1: A('a1', 's1'), a2: A('a2', 's2') }); eq(r, { moved: 2, removed: 0 }); }]);
  cases.push(['숫자 키 판에서 내리기로 생긴 유령 {hidden} 은 진짜 작품에 합쳐진다', await runNorm({ 0: A('a1', 's1'), a1: { hidden: true, likes: { s9: true } } }, '() => true'),
    ({ writes }) => { eq(writes[0], { 0: null, a1: { ...A('a1', 's1'), hidden: true, likes: { s9: true } } }); }]);
  cases.push(['이미 id 키인 작품(그 순간 올라온 새 작품)은 건드리지 않는다', await runNorm({ 0: A('a1', 's1'), new1: A('new1', 's2') }, '() => true'),
    ({ writes }) => { if ('new1' in writes[0]) throw new Error('새 작품을 건드림: ' + JSON.stringify(writes[0])); }]);
  cases.push(['같은 작품이 숫자 키·id 키 둘 다 → 숫자 키만 지움', await runNorm({ 0: A('a1', 's1'), a1: A('a1', 's1') }, '() => true'),
    ({ r, writes }) => { eq(writes[0], { 0: null }); eq(r, { moved: 0, removed: 1 }); }]);
  cases.push(['고아 정리: keep 가 false 인 작품만 지움', await runNorm({ a1: A('a1', 's1'), a2: A('a2', 'gone'), 0: A('a3', 'gone') }, "a => a.studentId !== 'gone'"),
    ({ r, writes }) => { eq(writes[0], { a2: null, 0: null }); eq(r.removed, 2); }]);
  cases.push(['고칠 것이 없으면 쓰지 않는다 · 통째 set 은 절대 안 씀', await runNorm({ a1: A('a1', 's1') }, '() => true'),
    ({ writes }) => { eq(writes, []); }]);
  for (const [name, res, check] of cases) test(name, () => check(res));

  // 확인창에서 취소하면 아무것도 안 쓴다
  const wrote = [];
  const sb = {
    confirm: () => false, notify() {}, renderAll() {},
    DB: { load: () => { wrote.push('load'); return {}; }, getStudents: () => [], saveStudent: () => wrote.push('saveStudent'), _promoObj: (x) => x,
          _fbRef: { child: () => ({ set: () => wrote.push('set'), update: () => wrote.push('update'), once: async () => ({ val: () => ({}) }) }) } },
  };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(sliceAsync('dedupeAll') + '\nglobalThis.__d = dedupeAll;', sb);
  await sb.__d();
  test('dedupeAll: 확인창 취소 → 쓰기 0', () => eq(wrote, []));
} catch (e) {
  test('작품 키 정리 함수·확인창이 있다', () => { throw e; });
}

// ═══════════════════════════════════════════════════════════════
cur = 'gamedata 작품 쓰기가 실제 키에(ART-RAW-KEY-1)';
{
  //  운영 artworks 는 숫자 키. 내리기·좋아요·고치기가 artworks/<id>/… 에 쓰면 진짜 작품은 그대로, 유령만 생겼다.
  //  세 모양(숫자 키만 · id 키만 · 둘 다) 모두에서 **value.id 가 같은 키 전부**에 쓰이고 유령 키가 없어야 한다.
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const memRef = (root) => {
    const seg = (p) => p.split('/').filter(Boolean);
    const get = (p) => seg(p).reduce((c, k) => (c == null ? null : c[k] ?? null), root.tree);
    const put = (p, v) => { const ks = seg(p); let c = root.tree; for (const k of ks.slice(0, -1)) { if (c[k] == null || typeof c[k] !== 'object') c[k] = {}; c = c[k]; } if (v == null) delete c[ks.at(-1)]; else c[ks.at(-1)] = clone(v); };
    const ref = (p) => ({ child: (k) => ref(p + '/' + k), once: async () => ({ val: () => clone(get(p)) }), set: async (v) => put(p, v), remove: async () => put(p, null),
      update: async (o) => { for (const k of Object.keys(o)) put(p + '/' + k, o[k]); } });
    return ref('');
  };
  const boot = (artworks) => {
    const sb = { console, window: {}, setTimeout: (f) => f(), document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} }, alert() {} };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(read('gamedata.js') + ';globalThis.__DB = DB;', sb);
    const root = { tree: { artworks: clone(artworks) } };
    const DB = sb.__DB;
    DB._fbRef = memRef(root);
    DB._cache = DB._normalizeArrays(clone({ artworks, students: [], settings: {} }));
    DB._onSaveError = (e) => { throw e; };
    return { DB, root };
  };
  const art = { id: 'art_1', studentId: 's1', title: '그림' };
  const layouts = {
    '숫자 키만(운영 지금)': { 0: art, 1: { id: 'art_2', studentId: 's2' } },
    'id 키만': { art_1: art, art_2: { id: 'art_2', studentId: 's2' } },
    '둘 다(섞인 판)': { 0: art, art_1: art, art_2: { id: 'art_2', studentId: 's2' } },
  };
  const copies = (tree) => Object.entries(tree.artworks).filter(([, v]) => v && v.id === 'art_1');
  const ghosts = (tree) => Object.entries(tree.artworks).filter(([, v]) => !v || !v.id).map(([k]) => k);
  const results2 = [];
  for (const [name, lay] of Object.entries(layouts)) {
    let r = boot(lay); await r.DB.hideArtwork('art_1', true);
    results2.push([`${name}: 내리기 → 모든 복사본 hidden · 유령 0`, () => { const c = copies(r.root.tree); if (!c.length || c.some(([, v]) => v.hidden !== true)) throw new Error(JSON.stringify(r.root.tree)); eq(ghosts(r.root.tree), []); }]);
    const r2 = boot(lay); await r2.DB.setArtworkLike('art_1', 's9', true);
    results2.push([`${name}: 좋아요 → 모든 복사본 likes.s9 · 유령 0`, () => { const c = copies(r2.root.tree); if (!c.length || c.some(([, v]) => !(v.likes && v.likes.s9))) throw new Error(JSON.stringify(r2.root.tree)); eq(ghosts(r2.root.tree), []); }]);
    const r3 = boot(lay); await r3.DB.updateArtwork('art_1', { title: '새 제목' });
    results2.push([`${name}: 고치기 → 복사본 수 그대로 · 제목 바뀜`, () => { const before = Object.values(lay).filter(v => v.id === 'art_1').length; const c = copies(r3.root.tree); eq(c.length, before, '복사본 수'); if (c.some(([, v]) => v.title !== '새 제목')) throw new Error(JSON.stringify(r3.root.tree)); }]);
    results2.push([`${name}: 다른 작품(art_2)은 안 건드림`, () => eq(Object.values(r.root.tree.artworks).find(v => v && v.id === 'art_2').hidden, undefined)]);
    // [ART-KEY-FIX-1] 지우기: 캐시에 없는 새 작품(그 순간 다른 기기가 올림)이 서버에 있어도 살아남고, 숫자 키 구멍·유령이 안 남는다
    const r4 = boot(lay); r4.root.tree.artworks.new_1 = { id: 'new_1', studentId: 's3' };
    await r4.DB.deleteArtwork('art_1');
    results2.push([`${name}: 지우기 → 복사본 0 · art_2 남음 · 그 순간 올라온 new_1 남음 · 숫자 키·유령 0`, () => {
      const t = r4.root.tree.artworks;
      eq(copies(r4.root.tree).length, 0, 'art_1 복사본');
      eq(Object.keys(t).sort(), ['art_2', 'new_1']);
      eq(ghosts(r4.root.tree), []);
    }]);
  }
  {
    const r5 = boot({ 0: art, art_1: { hidden: true }, 1: { id: 'art_2', studentId: 's2' } });
    await r5.DB.deleteArtwork('art_1');
    results2.push(['지우기: 지운 작품의 유령 조각(hidden)도 같이 사라진다', () => eq(Object.keys(r5.root.tree.artworks), ['art_2'])]);
  }
  for (const [n, f] of results2) test(n, f);
}

// ═══════════════════════════════════════════════════════════════
cur = '학생 기기 부분 캐시 가드(STUDENT-COLD-1)';
try {
  //  설계 G1·G3·G4·G7. 바이트·캐시 값 비교는 실제 SDK + 에뮬레이터(scripts/unit/init-single-load/README.md).
  const mk = () => {
    const sb = { console: { log() {}, warn() {}, error() {} }, window: {}, setTimeout, document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} }, alert() {} };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(read('gamedata.js') + ';globalThis.__DB = DB; globalThis.__AU = AchievementUtils;', sb);
    return sb;
  };
  // G1
  {
    const sb = mk(); const DB = sb.__DB; const wrote = [];
    DB._fbRef = { set: (d) => { wrote.push(d); return Promise.resolve(); } };
    DB._profile = 'student';
    if (typeof DB._rootSet !== 'function') throw new Error('DB._rootSet 없음');
    let threw = false; try { DB._rootSet({ a: 1 }); } catch (e) { threw = true; }
    test('G1 학생 판: root 통째 저장 → 던지고 쓰기 0', () => { eq(threw, true); eq(wrote.length, 0); });
    DB._profile = null; DB._rootSet({ a: 1 });
    test('G1 교사 판: root 저장은 그대로 된다(빈 DB 설치)', () => eq(wrote.length, 1));
  }
  // G4
  {
    const sb = mk(); const DB = sb.__DB;
    DB._cache = DB._normalizeArrays({ students: {}, emotionLogs: {}, settings: {} });
    const stu = { id: 's1', name: '가', achievements: ['ach_emo1', 'ach_emo5'] };
    sb.__AU.checkNew(stu);
    test('G4 감정 기록이 아직 안 온 캐시로 업적 판정 → 이미 딴 감정 업적은 그대로', () => {
      if (!stu.achievements.includes('ach_emo1') || !stu.achievements.includes('ach_emo5')) throw new Error(JSON.stringify(stu.achievements));
    });
  }
  // G7 + 첫 판 캐시 반영
  {
    const sb = mk(); const DB = sb.__DB;
    const log = [];
    const snap = (v) => ({ val: () => JSON.parse(JSON.stringify(v)) });
    const data = { emotionLogs: { s1_a: { studentId: 's1' }, s2_a: { studentId: 's2' } }, emotionReflections: { s1_r: { studentId: 's1' }, s2_r: { studentId: 's2' } } };
    DB._fbRef = { child: (name) => ({ orderByKey: () => ({ startAt: (a) => ({ endAt: () => ({
      on: (ev, cb) => { log.push('on ' + name + ' ' + a); const out = {}; for (const k of Object.keys(data[name])) if (k.startsWith(a)) out[k] = data[name][k]; cb(snap(out)); },
      off: () => log.push('off ' + name + ' ' + a),
    }) }) }) }) };
    DB._snaps = {}; DB._studentReady = true; DB._liveHandler = () => {};
    DB._cache = { emotionLogs: {}, emotionReflections: {} };
    await DB.attachMine('s1');
    const c1 = JSON.stringify([Object.keys(DB._cache.emotionLogs), Object.keys(DB._cache.emotionReflections)]);
    await DB.attachMine('s2');
    test('attachMine: 첫 판이 캐시에 바로(내 것만)', () => eq(c1, JSON.stringify([['s1_a'], ['s1_r']])));
    test('G7 학생이 바뀌면 이전 구독 off · 캐시에 이전 학생 기록 없음', () => {
      for (const n of ['emotionLogs', 'emotionReflections']) if (!log.includes('off ' + n + ' s1_')) throw new Error(JSON.stringify(log));
      eq([Object.keys(DB._cache.emotionLogs), Object.keys(DB._cache.emotionReflections)], [['s2_a'], ['s2_r']]);
    });
  }
  // G3 — doLogin 은 attachMine 이 끝난 뒤에만 enterGame
  {
    const STU = read('student.js');
    let resolveMine; const calls = [];
    const sb = {
      SEL_STUDENT: 's1', CUR: null, checkAccessTime: () => false,
      document: { getElementById: (id) => (id === 'pw-input' ? { value: 'pw' } : { textContent: '' }), querySelector: () => null },
      DB: { getStudent: () => ({ id: 's1', pw: 'pw', charType: 'warrior' }), attachMine: () => new Promise(r => { resolveMine = r; }) },
      hideScreen: (s) => calls.push('hide ' + s), showScreen: (s) => calls.push('show ' + s), enterGame: () => calls.push('enterGame'),
    };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(sliceFn(STU, 'doLogin') + '\nglobalThis.__login = doLogin;', sb);
    sb.__login(); sb.__login();   // 엔터 두 번
    const before = calls.slice();
    resolveMine(); await new Promise(r => setTimeout(r, 0));
    test('G3 내 기록 오기 전엔 화면 안 바뀜 · 온 뒤 enterGame 한 번', () => { eq(before, []); eq(calls, ['hide s-login', 'enterGame']); });
  }
} catch (e) {
  test('부분 캐시 가드 함수가 있다', () => { throw e; });
}

// ═══════════════════════════════════════════════════════════════
cur = 'admin 전투 설정 저장·초기화(BATTLE-SET-NAN-1·BATTLE-RESET-KEEP-1)';
{
  const ADMIN = read('admin.js');
  const hasNan = (v) => v !== null && typeof v === 'object' ? Object.values(v).some(hasNan) : (typeof v === 'number' && Number.isNaN(v));
  const run = (fields, initialCbs, confirmAns = true, fn = 'saveBattleSettings') => {
    const writes = [], said = [];
    const db = { settings: { customBattleSettings: JSON.parse(JSON.stringify(initialCbs)) } };
    const sb = {
      document: { getElementById: (id) => (id in fields ? { value: fields[id] } : { value: '' }) },
      confirm: () => confirmAns, notify: (m) => said.push(m), loadBattleSettings() {}, applyBattleSettings() {},
      SKILL_MULTIPLIERS: { normal: { 1: 1, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 1.6 }, element: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 } },
      DB: { load: () => db, _cache: null, _fbRef: { child: (p) => ({
        // 실제 SDK 처럼 NaN 이 들어 있으면 던진다(에뮬레이터에서 확인: "value argument contains NaN")
        set: (v) => { if (hasNan(v)) throw new Error('set failed: value argument contains NaN'); writes.push(['set', p, JSON.parse(JSON.stringify(v))]); },
        update: (v) => { writes.push(['update', p, JSON.parse(JSON.stringify(v))]); },
        remove: () => writes.push(['remove', p]),
      }) } },
    };
    sb.globalThis = sb; vm.createContext(sb);
    const pieces = [];
    try { pieces.push(sliceFn(ADMIN, 'battleNum')); } catch (e) { /* main 에는 없음 */ }
    const keysLine = /^const BATTLE_RESET_KEYS = [^\n]*\n/m.exec(ADMIN);
    if (keysLine) pieces.push(keysLine[0]);
    pieces.push(sliceFn(ADMIN, fn));
    let err = null;
    try { vm.runInContext(pieces.join('\n') + `\n${fn}();`, sb); } catch (e) { err = e.message; }
    return { writes, said, db, err };
  };
  const cbs0 = { dailyBattleLimit: 5, equipment: { e1: { atk: 3 } }, skillBooks: { b1: { price: 9 } }, ghostNormalMult: 0.4, normalMults: { 1: 2 } };
  {
    const r = run({ 'bs-daily-limit': '5', 'bs-infinite-limit': '' }, cbs0);
    test('무한배틀 칸 비움 → 저장이 던지지 않고 1 로 저장 · 알림', () => {
      if (r.err) throw new Error('저장 실패: ' + r.err);
      eq(r.writes.length, 1); eq(r.writes[0][2].infiniteBattleLimit, 1); eq(r.writes[0][2].dailyBattleLimit, 5);
      if (!r.said.length) throw new Error('알림 없음');
    });
    test('저장값 어디에도 NaN 없음 · 장비·스킬북 보존', () => { eq(hasNan(r.writes[0][2]), false); eq(r.writes[0][2].equipment, cbs0.equipment); eq(r.writes[0][2].skillBooks, cbs0.skillBooks); });
  }
  {
    const r = run({ 'bs-daily-limit': 'abc', 'bs-infinite-limit': '0', 'bs-ghost-mult': '', 'bs-mon-hp-mult': '1.5', 'bs-nm-1': 'x' }, {});
    test('칸 전수: 글자 → 기본값 · 무한배틀 0 은 0 · 숫자는 그대로', () => {
      if (r.err) throw new Error(r.err);
      const v = r.writes[0][2];
      eq([v.dailyBattleLimit, v.infiniteBattleLimit, v.ghostNormalMult, v.monsterHpMult, v.normalMults[1], v.elemChart.advantageMult], [3, 0, 0.55, 1.5, 1, 1.4]);
    });
  }
  {
    const r = run({}, cbs0, true, 'resetBattleSettings');
    test('초기화 → 배율 키만 null update · 하루 횟수·장비·스킬북 보존(통째 remove 없음)', () => {
      if (r.err) throw new Error(r.err);
      eq(r.writes.filter(w => w[0] === 'remove').length, 0, 'remove');
      const u = r.writes.find(w => w[0] === 'update');
      if (!u) throw new Error('update 없음: ' + JSON.stringify(r.writes));
      eq(Object.keys(u[2]).sort(), ['defChart', 'elemChart', 'elementMults', 'ghostNormalMult', 'monsterAtkMult', 'monsterHpMult', 'normalMults']);
      eq(Object.values(u[2]).every(x => x === null), true);
      const c = r.db.settings.customBattleSettings;
      eq([c.dailyBattleLimit, c.equipment, c.skillBooks, c.ghostNormalMult], [5, cbs0.equipment, cbs0.skillBooks, undefined]);
    });
    const r2 = run({}, cbs0, false, 'resetBattleSettings');
    test('초기화 확인창 취소 → 쓰기 0', () => eq(r2.writes, []));
  }
}

// ═══════════════════════════════════════════════════════════════
cur = '홈 펼침 상태 유지(HOME-KEEP-OPEN-1)';
try {
  //  onDataChange 가 홈을 다시 그리면(innerHTML) 펼친 섹션이 접혔다. 펼친 것만 기억해 다시 펼치는지.
  const STU = read('student.js');
  const mkBox = (ids) => {
    const els = {};
    for (const id of ids) els[id] = { id, style: { display: 'none' }, textContent: id.endsWith('arrow') ? '▼' : '' };
    return { els, querySelector: (sel) => { const m = /\[id="([^"]+)"\]/.exec(sel); return m ? els[m[1]] || null : null; } };
  };
  const ids = ['today-links', 'today-links-arrow', 'quest-section', 'quest-arrow'];
  let box = mkBox(ids);
  const sb = { document: { querySelectorAll: (sel) => { const m = /\[id="([^"]+)"\]/.exec(sel); return m && box.els[m[1]] ? [box.els[m[1]]] : []; } } };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext([sliceFn(STU, '_homeEl').replace("el.closest('#main-area, #mob-main-tab')", 'null'), sliceFn(STU, 'toggleSection'), sliceConst(STU, '_homeOpen'), sliceFn(STU, '_restoreHomeOpen'),
    'globalThis.__t = toggleSection; globalThis.__r = _restoreHomeOpen;'].join('\n'), sb);
  sb.__t('today-links', 'today-links-arrow');
  box = mkBox(ids);            // 다시 그리기: 새 요소는 기본 접힘
  sb.__r(box);
  test('펼친 오늘의 링크는 다시 그린 뒤에도 펼침·화살표 ▲', () => eq([box.els['today-links'].style.display, box.els['today-links-arrow'].textContent], ['', '▲']));
  test('안 펼친 퀘스트 섹션은 그대로 접힘', () => eq(box.els['quest-section'].style.display, 'none'));
  sb.__t('today-links', 'today-links-arrow');   // 이제 접음
  box = mkBox(ids); sb.__r(box);
  test('접은 뒤 다시 그리면 접힘', () => eq(box.els['today-links'].style.display, 'none'));
} catch (e) {
  test('홈 펼침 유지 함수가 있다', () => { throw e; });
}

// ═══════════════════════════════════════════════════════════════
cur = 'admin 기본값 초기화 범위(RESET-SCOPE-1)';
{
  const ADMIN = read('admin.js');
  const run = (fn, db, extra = {}) => {
    const writes = [];
    const sb = {
      confirm: () => true, notify() {}, renderMonsters() {}, location: { reload() {} }, setTimeout() {}, ...extra,
      DB: { load: () => db, _cache: null, _fbRef: { child: (p) => ({
        set: (v) => writes.push(['set', p, JSON.parse(JSON.stringify(v))]),
        update: (v) => writes.push(['update', p, JSON.parse(JSON.stringify(v))]),
        remove: () => writes.push(['remove', p]),
      }) } },
    };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(sliceFn(ADMIN, fn) + `\n${fn}();`, sb);
    return writes;
  };
  {
    const db = { customMonsters: { m3: { id: 'm3', gold: 99, _custom: true, _new: false }, cm_1: { id: 'cm_1', name: '새몹', _custom: true, _new: true } } };
    const w = run('resetCustomMonsters', db);
    test('몬스터 초기화 → 기본 몬스터 조정만 null · 새로 만든 몬스터 남음 · 통째 set 없음', () => {
      eq(w, [['update', 'customMonsters', { m3: null }]]);
      eq(Object.keys(db.customMonsters), ['cm_1']);
    });
  }
  {
    const db = { settings: { className: '반', todayLinks: [{ t: 1 }], shopOverrides: { seeds: { s1: {} }, equipment: { e1: {} } } } };
    const w = run('resetShopOverrides', db, { CUR_SHOP_TAB: 'equip' });
    test('상점 장비 탭 초기화 → settings/shopOverrides/equipment 만 remove · settings 통째 set 없음', () => {
      eq(w, [['remove', 'settings/shopOverrides/equipment']]);
      eq(Object.keys(db.settings.shopOverrides), ['seeds']);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
cur = 'admin 승급 직업은 꿈 기준(PROMO-JOB-DREAM-1)';
try {
  const ADMIN = read('admin.js');
  const gd = { console: { log() {}, warn() {}, error() {} }, window: {}, setTimeout, document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} }, alert() {} };
  gd.globalThis = gd; vm.createContext(gd); vm.runInContext(read('gamedata.js') + ';globalThis.__U = Utils;', gd);
  const stu = { id: 's1', name: '가', job: '대학생', dream: '의사', level: 19, exp: 0, gold: 0, totalGold: 0, promotedLevels: [] };
  const req = { id: 'r1', studentId: 's1', level: 20 };
  const sb = { Utils: gd.__U, notify() {}, renderAll() {},
    DB: { getPromotionRequests: () => [req], getStudent: () => stu, saveQuestLog() {}, saveStudent() {}, removePromotionRequest() {} } };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(sliceFn(ADMIN, 'approvePromotion') + "\napprovePromotion('r1');", sb);
  test('Lv20 승급: job "대학생"·꿈 "의사" → "의사 지망생"(예전 "대학생 지망생")', () => eq(stu.job, '의사 지망생'));
} catch (e) {
  test('승급 직업 계산을 돌릴 수 있다', () => { throw e; });
}


// ═══════════════════════════════════════════════════════════════
cur = '꾸미기 동물 움직임(DECO-ANIM-1 · DECO-ANIM-LIVE-1)';
//  [DECO-ANIM-LIVE-1] 동물 시험 공용 모래상자 — 가짜 DOM · 가짜 시계(타이머는 정해진 때 순서로 돈다) · requestAnimationFrame 없음(엔진이 16ms 타이머로 대신)
function animSandbox(S, { decos, size, hc, farm, extraConsts = [], extraFns = [] }) {
  const mkEl = (tag) => {
    const el = { tag, className: '', style: {}, children: [], parentNode: null, dataset: {}, offsetWidth: 0, textContent: '', src: '',
      classList: { toggle(c, on) { el._cls = el._cls || new Set(); if (on) el._cls.add(c); else el._cls.delete(c); },
                   add(c) { el._cls = el._cls || new Set(); el._cls.add(c); }, remove(c) { el._cls = el._cls || new Set(); el._cls.delete(c); },
                   contains(c) { return !!(el._cls && el._cls.has(c)); } },
      appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
      removeChild(c) { el.children = el.children.filter(x => x !== c); c.parentNode = null; return c; },
      querySelector(sel) { const want = sel.charAt(0) === '.' ? sel.slice(1) : sel;
        const walk = (n) => { for (const c of n.children) { if (c.tag === want || c.className === want) return c; const r = walk(c); if (r) return r; } return null; };
        return walk(el); } };
    return el;
  };
  const host = mkEl('div'); host.id = 'if-topview';
  const clock = { t: 1e12 }, timers = new Map(); let tid = 1;
  const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Boolean, Set, Map, Infinity,
    Date: { now: () => clock.t },
    document: { hidden: false, getElementById: (id) => (id === 'if-topview' ? host : null), createElement: mkEl, addEventListener() {} },
    window: { matchMedia: () => ({ matches: false }) }, Image: function () { return { set src(v) {}, naturalWidth: 0 }; },
    getComputedStyle: () => ({ position: 'static' }),
    setTimeout: (fn, ms) => { const id = tid++; timers.set(id, { fn, due: clock.t + Math.max(0, ms || 0) }); return id; }, clearTimeout: (id) => timers.delete(id),
    encodeURIComponent,
    DY: { rows: 28, cols: 50 }, _isHC: hc || (() => false), _isFarmCell: farm || (() => false),
    getDecoSize: size || ((id) => { const d = decos.filter(x => x.id === id)[0]; return (d && d.size) || { w: 1, h: 1 }; }),
    GAME_DATA: { decorations: decos } };
  sb.globalThis = sb; vm.createContext(sb);
  let src = SPACE_PRELUDE(S) + ART_PRELUDE(S) + 'let _decoBBox = null;' + NL;
  for (const n of ['ANIM_DECO', 'ANIM_MOOD', 'ANIM_STEP_MS', 'ANIM_ART_KEYS', 'GROUND_HARD', 'FEED_RANGE', '_animArt', '_animLayers', '_animHooked', '_animRaf'].concat(extraConsts)) {
    let at = S.indexOf('\nconst ' + n); if (at < 0) at = S.indexOf('\nlet ' + n);
    if (at < 0) throw new Error('선언 없음: ' + n);
    let depth = 0, end = -1;
    for (let i = at; i < S.length; i++) { const ch = S.charAt(i);
      if ('{[('.indexOf(ch) >= 0) depth++; else if ('}])'.indexOf(ch) >= 0) depth--; else if (ch === ';' && depth === 0) { end = i; break; } }
    src += S.slice(at, end + 1) + NL;
  }
  for (const n of ['_isPenDeco', '_penAt', '_feedersOf', '_feederFor', '_groundKind', '_groundAt', '_animGroundOk', '_animWhyNot', '_animProbeArt', '_animFile', '_animSrcFor',
    '_animApplySrc', '_animSetState', '_animFace', '_animPlace', '_animRnd', '_animReduced', '_decoOverflowCells', '_animFreeMaker', '_animOccMaker', '_animBounds', '_animBfs',
    '_animKick', '_animFrame', '_animLoopStop', '_animTick', '_animWalk', '_animNextSeg', '_animAdvance', '_animThink', '_animGather', '_animShelter', '_animStopLayer', '_animStopAll',
    '_animPauseAll', '_animResumeAll', '_animAt', '_animOverCells', '_animPoke', '_animSyncLayer'].concat(extraFns)) src += sliceFn(S, n) + NL;
  src += ';globalThis.__A = { ' + ['_animSyncLayer', '_animStopLayer', '_animLayers', '_animBfs', '_animOccMaker', '_groundKind', '_animGroundOk', '_animWhyNot', '_animAt', '_animPoke',
    '_animFreeMaker', '_isPenDeco', '_penAt', '_feedersOf'].concat(extraFns).join(', ') + ' };';
  vm.runInContext(src, sb);
  //  ms 만큼 시계를 돌린다 — each(now) 는 50ms 마다
  const run = (ms, each) => {
    const end = clock.t + ms; let nextSample = clock.t;
    for (let guard = 0; guard < 200000; guard++) {
      let best = null; for (const [id, t] of timers) if (!best || t.due < best[1].due) best = [id, t];
      const due = best ? Math.min(best[1].due, end) : end;
      while (each && nextSample <= due) { clock.t = Math.max(clock.t, nextSample); each(clock.t); nextSample += 50; }
      if (!best || best[1].due > end) { clock.t = end; return; }
      timers.delete(best[0]); clock.t = best[1].due; best[1].fn();
    }
    throw new Error('시계가 끝나지 않는다');
  };
  return { sb, A: sb.__A, host, timers, clock, run };
}
try {
  const S = read('student.js');
  const DECOS = [
    { id: 'd_y39', name: '닭 3마리', size: { w: 2, h: 1 } },
    { id: 'd_y40', name: '양', size: { w: 2, h: 1 } },
    { id: 'd_y5',  name: '정원 벤치', size: { w: 2, h: 1 } },
  ];
  const X = animSandbox(S, { decos: DECOS, hc: (r, c) => r < 3 && c >= 44, farm: (r, c) => r >= 20 && r < 24 && c >= 0 && c < 6 });
  const A = X.A, host = X.host;

  // ① 칸 길찾기(BFS) — 순수
  const stub = (free, occ) => ({ cur: { row: 5, col: 5 }, home: { row: 5, col: 5 }, cfg: { radius: 3 }, w: 1, h: 1, id: 'x', pen: null, feeder: null, swim: false, isFree: free });
  const adj = (p, from) => p.every((q, i) => { const a = i ? p[i - 1] : from; return Math.abs(q.row - a.row) + Math.abs(q.col - a.col) === 1; });
  test('BFS: 막힌 칸(세로 벽)을 돌아간다 · 한 걸음은 이웃 칸', () => {
    const wall = (r, c) => !(c === 6 && r >= 4 && r <= 6);
    const p = A._animBfs(stub(wall), (r, c) => r === 5 && c === 7);
    if (!p) throw new Error('길 없음');
    if (p.some(q => !wall(q.row, q.col))) throw new Error('벽을 뚫었다: ' + JSON.stringify(p));
    if (!adj(p, { row: 5, col: 5 })) throw new Error('건너뛰었다: ' + JSON.stringify(p));
    eq(p[p.length - 1], { row: 5, col: 7 });
    if (p.length < 6) throw new Error('돌아가지 않았다(길이 ' + p.length + ')');
  });
  test('BFS: 반지름 밖 목표는 길이 없다', () => eq(A._animBfs(stub(() => true), (r, c) => r === 5 && c === 9), null));
  test('BFS: 다른 동물이 예약한 칸은 피한다', () => {
    const p = A._animBfs(stub(() => true), (r, c) => r === 5 && c === 7, (r, c) => r === 5 && c === 6);
    if (!p || p.some(q => q.row === 5 && q.col === 6)) throw new Error(JSON.stringify(p));
  });

  // ② 층 만들기 — 동물 수만큼 요소 · 돌림은 하나
  const stu = { houseDecorations: [
    { id: 'd_y39', area: 'yard', row: 6, col: 6 },
    { id: 'd_y40', area: 'yard', row: 10, col: 10 },
    { id: 'd_y5',  area: 'yard', row: 6, col: 8 },     // 장식(움직이지 않음)
    { id: 'd_y39', area: 'indoor', row: 1, col: 1 },   // 집 안은 대상 아님
  ] };
  A._animSyncLayer('if-topview', stu, 'yard', 20, 1000, 560, 0, 0);
  const layer = host.children.find(c => c.className === 'deco-anim-layer');
  const world = layer && layer.children.find(c => c.className === 'deco-anim-world');
  test('마당에 동물 층이 생기고 동물 수만큼 요소가 생긴다(장식·집 안은 제외)', () => {
    if (!layer) throw new Error('층 없음');
    if (!world) throw new Error('세계 겹 없음');
    eq(world.children.length, 2);
  });
  test('동물이 몇이든 돌림(타이머)은 하나', () => eq(X.timers.size, 1));
  test('층은 캔버스 위에 절대 위치 · 손가락을 통과시킨다(CSS 클래스)', () => eq(layer.className, 'deco-anim-layer'));

  // ③ 5분 동안 — 반지름·금지 구역·장식·판 밖으로 안 나가고, 걸음은 늘 이웃 칸으로(미끄러져 건너뛰지 않는다)
  const st = [...A._animLayers.get('if-topview').items.values()][0];
  let bad = null, moved = 0, lastCur = JSON.stringify(st.cur), jump = null;
  X.run(300000, () => {
    if (bad) return;
    for (const p of [st.cur, { row: Math.round(st.fy), col: Math.round(st.fx) }]) {
      if (Math.abs(p.row - st.home.row) > st.cfg.radius || Math.abs(p.col - st.home.col) > st.cfg.radius) bad = '반지름 밖 ' + JSON.stringify(p);
      for (let dc = 0; dc < st.w; dc++) {
        if (X.sb._isHC(p.row, p.col + dc) || X.sb._isFarmCell(p.row, p.col + dc)) bad = '금지 구역 ' + JSON.stringify(p);
        if (p.row === 6 && (p.col + dc === 8 || p.col + dc === 9)) bad = '장식 위 ' + JSON.stringify(p);
      }
      if (p.row + st.h > 28 || p.col + st.w > 50 || p.row < 0 || p.col < 0) bad = '판 밖 ' + JSON.stringify(p);
    }
    if (st.seg && Math.abs(st.seg.r1 - st.seg.r0) + Math.abs(st.seg.c1 - st.seg.c0) !== 1) jump = JSON.stringify(st.seg);
    const k = JSON.stringify(st.cur); if (k !== lastCur) { moved++; lastCur = k; }
  });
  test('5분 동안 반지름·집·농장·다른 장식·판 밖으로 나가지 않는다', () => { if (bad) throw new Error(bad); });
  test('걸음 한 번은 늘 이웃 한 칸(건너뛰어 미끄러지지 않는다)', () => { if (jump) throw new Error(jump); });
  test('5분 동안 실제로 여러 칸을 걷는다', () => { if (moved < 5) throw new Error('걸은 칸 ' + moved); });
  test('걷고 난 뒤에도 돌림이 끊기지 않는다', () => { if (!X.timers.size) throw new Error('돌림이 끊겼다'); });

  // ④ 집 안으로 바꾸면 층이 사라지고 타이머가 남지 않는다
  A._animSyncLayer('if-topview', stu, 'indoor', 20, 1000, 560);
  test('집 안으로 바꾸면 층이 사라진다', () => eq(host.children.filter(c => c.className === 'deco-anim-layer').length, 0));
  test('층이 사라지면 타이머도 0개(앱 전환·닫기 때 새지 않는다)', () => eq(X.timers.size, 0));

  // ⑤ 같은 자리 다시 맞추면 같은 요소를 지킨다(처음부터 걷지 않게)
  A._animSyncLayer('if-topview', stu, 'yard', 20, 1000, 560, 0, 0);
  const l2w = host.children.find(c => c.className === 'deco-anim-layer').children.find(c => c.className === 'deco-anim-world');
  const first = [...A._animLayers.get('if-topview').items.values()][0];
  first.cur = { row: first.home.row + 2, col: first.home.col };
  A._animSyncLayer('if-topview', stu, 'yard', 20, 1000, 560, 0, 0);
  const again = [...A._animLayers.get('if-topview').items.values()][0];
  test('다시 그려도 동물이 지금 자리를 지킨다', () => eq(again.cur, { row: first.home.row + 2, col: first.home.col }));
  test('다시 그려도 요소를 새로 만들지 않는다', () => eq(l2w.children.length, 2));

  // ⑥ 화면 밖이면 쉰다(한 장 그림 · 생각 안 함)
  A._animSyncLayer('if-topview', stu, 'yard', 20, 1000, 560, 5000, 5000);
  test('화면 밖 동물은 쉰다(한 장 그림)', () => { const a = [...A._animLayers.get('if-topview').items.values()]; if (!a.every(x => x.frozen && /d_y\d+\.svg$/.test(x.src))) throw new Error(JSON.stringify(a.map(x => [x.frozen, x.src]))); });
  A._animStopLayer('if-topview');
} catch (e) {
  test('동물 움직임 코드를 돌릴 수 있다', () => { throw e; });
}



// ═══════════════════════════════════════════════════════════════
cur = '꾸미기 확대·이동(DECO-ZOOM-1)';
try {
  const S = read('student.js');
  const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Boolean, Set, Map };
  sb.globalThis = sb; vm.createContext(sb);
  let src = SPACE_PRELUDE(S);
  // 상태 선언
  for (const d of ['let _dCv', 'const DECO_ZOOM_MIN', 'const DECO_YARD_TOP', 'const DY_BASE', 'let _dZoom',
                   'const DY_NORMAL', 'const DY_FULL', 'const DI_NORMAL', 'const DI_FULL', 'const DH ', 'let DY ', 'let DI ']) {
    const at = S.indexOf(d);
    if (at < 0) throw new Error('선언 없음: ' + d);
    const nl = S.indexOf('\n', at);
    src += S.slice(at, nl) + '\n';
  }
  src += "let DECO_SCENE='yard';\n";
  for (const n of ['_decoBoardPx', '_decoClampPan', '_decoVisible', '_decoWholeZoom', '_decoZoomMin', '_decoSetZoom', '_houseCol0', '_isHC', '_getFarmZone', '_isFarmCell'])
    src += sliceFn(S, n) + '\n';
  // _decoSetZoom 이 부르는 것들은 흉내만 (칸 크기 = 기준칸 20 × 줌)
  src += `
    let drawCount = 0;
    function _initDeco(){ _dC = Math.max(4, Math.round(20 * _dZoom)); _dW = 1000; _dH = 560; _decoClampPan(); }
    function _drawDeco(){ drawCount++; }
    function getFarmLayout(){ return { cols: 4, rows: 3 }; }
    let CUR = { level: 5 };
    globalThis.__Z = { get zoom(){return _dZoom;}, get panX(){return _dPanX;}, get panY(){return _dPanY;}, get C(){return _dC;},
      get draws(){return drawCount;}, setDY(v){ DY = v; }, setState(z,x,y){ _dZoom=z; _initDeco(); _dPanX=x; _dPanY=y; _decoClampPan(); },
      _decoVisible, _decoSetZoom, _decoClampPan, _houseCol0, _isHC, _getFarmZone, DY_BASE, DY_FULL, DY_NORMAL };
  `;
  vm.runInContext(src, sb);
  const Z = sb.__Z;

  Z.setDY({ ...Z.DY_FULL });

  test('마당이 80×44 로 넓어졌다(전체화면 판)', () => eq(Z.DY_FULL, { cols: 80, rows: 44 }));

  // ① 보이는 칸만 도는지
  Z.setState(1, 0, 0);
  {
    const v = Z._decoVisible(44, 80);
    test('줌 1·왼쪽 위: 보이는 칸 범위가 판 전체보다 좁다(컬링)', () => {
      if (!(v.c1 - v.c0 < 80)) throw new Error('열 범위가 안 좁혀졌다: ' + JSON.stringify(v));
      if (!(v.r1 - v.r0 <= 44)) throw new Error('줄 범위 이상: ' + JSON.stringify(v));
      if (v.r0 !== 0 || v.c0 !== 0) throw new Error('왼쪽 위인데 시작이 0이 아니다');
    });
  }
  // ② 오른쪽 끝으로 밀어도 범위가 판을 안 넘는다
  Z.setState(1, 99999, 99999);
  {
    const v = Z._decoVisible(44, 80);
    test('끝까지 밀어도 보이는 범위가 판을 넘지 않는다', () => { eq([v.r1, v.c1], [44, 80]); });
    test('끝까지 밀면 이동값이 판 크기에 맞게 잘린다', () => {
      const maxX = 80 * Z.C - 1000, maxY = 44 * Z.C - 560;
      eq([Z.panX, Z.panY], [maxX, maxY]);
    });
  }
  // ③ 판이 창보다 작으면 이동 0
  Z.setDY({ cols: 20, rows: 10 });
  Z.setState(1, 500, 500);
  test('판이 창보다 작으면 화면이 안 움직인다(이동 0)', () => eq([Z.panX, Z.panY], [0, 0]));
  Z.setDY({ ...Z.DY_FULL });

  // ④ 확대: 손가락 아래 점이 제자리
  Z.setState(1, 400, 200);
  {
    const fx = 300, fy = 150;
    const beforeBoard = { x: (400 + fx) / 1, y: (200 + fy) / 1 };   // 줌 1 기준 판 좌표
    Z._decoSetZoom(2, fx, fy);
    const afterBoard = { x: (Z.panX + fx) / Z.zoom, y: (Z.panY + fy) / Z.zoom };
    test('두 손가락으로 벌려도 손가락 아래 자리가 그대로다(오차 1 이하)', () => {
      if (Math.abs(afterBoard.x - beforeBoard.x) > 1 || Math.abs(afterBoard.y - beforeBoard.y) > 1)
        throw new Error('기준점이 밀렸다: ' + JSON.stringify(afterBoard) + ' vs ' + JSON.stringify(beforeBoard));
    });
    test('확대하면 칸이 커진다', () => { if (!(Z.C > 20)) throw new Error('칸 크기 ' + Z.C); });
  }
  // ⑤ 상한·하한
  Z._decoSetZoom(99);
  test('확대 상한 3 을 넘지 않는다', () => eq(Z.zoom, 3));
  Z._decoSetZoom(0.01);
  test('축소 하한 0.5 아래로 안 간다', () => eq(Z.zoom, 0.5));

  // ⑥ 집·농장 자리가 확대·창 크기와 무관하게 고정
  test('집은 기준 판(50칸) 오른쪽 위에 고정 — 마당을 넓혀도 44열', () => eq(Z._houseCol0(), 44));
  test('집 영역은 44~49열·0~2줄만(그 오른쪽 새 땅은 쓸 수 있다)', () => {
    eq([Z._isHC(0, 44), Z._isHC(0, 49), Z._isHC(0, 50), Z._isHC(3, 44)], [true, true, false, false]);
  });
  {
    const a = Z._getFarmZone();
    Z._decoSetZoom(2);
    const b = Z._getFarmZone();
    test('농장 자리가 확대해도 안 움직인다(예전에는 창 크기·확대에 따라 움직였다)', () => eq(a, b));
    test('농장은 기준 판 오른쪽 아래(45,24 부근)', () => eq([a.startCol, a.startRow], [50 - 4 - 1, 28 - 3 - 1]));
  }
} catch (e) {
  test('확대·이동 계산을 돌릴 수 있다', () => { throw e; });
}


// ═══════════════════════════════════════════════════════════════
cur = '꾸미기 동물 규칙·상호작용(DECO-ANIM-2)';
try {
  const S = read('student.js');
  const X = animSandbox(S, { decos: [{ id: 'd_y56', name: '오리 한 마리' }, { id: 'd_y57', name: '양 한 마리' }, { id: 'd_y53', name: '강아지' }, { id: 'd_y55', name: '닭 한 마리' }],
    size: () => ({ w: 1, h: 1 }) });
  const R = X.A;

  // ① 바닥 묶음
  test('바닥 묶음: water=물 · stone/brick/deck=단단한 길 · grass/dirt=풀·흙', () => {
    eq([R._groundKind('water'), R._groundKind('stone'), R._groundKind('brick'), R._groundKind('deck'),
        R._groundKind('grass'), R._groundKind('dirt'), R._groundKind('flower')],
       ['water', 'hard', 'hard', 'hard', 'soft', 'soft', 'soft']);
  });

  // ② 동물별 놓을 수 있는 곳
  const stu = { yardFloor: { '5_5': 'water', '5_6': 'water', '7_7': 'stone' }, houseDecorations: [] };
  test('🦆 오리는 물에 놓을 수 있다', () => eq(R._animGroundOk('d_y56', stu, 5, 5, 1, 1), true));
  test('🐑 양은 물에 못 놓는다', () => eq(R._animGroundOk('d_y57', stu, 5, 5, 1, 1), false));
  test('🐑 양은 풀밭에 놓을 수 있다', () => eq(R._animGroundOk('d_y57', stu, 1, 1, 1, 1), true));
  test('🐶 강아지는 길(단단한 바닥)에 놓을 수 있다', () => eq(R._animGroundOk('d_y53', stu, 7, 7, 1, 1), true));
  test('🐶 강아지는 물에 못 놓는다', () => eq(R._animGroundOk('d_y53', stu, 5, 5, 1, 1), false));
  test('🐔 닭은 길에 못 놓는다(풀·흙만)', () => eq(R._animGroundOk('d_y55', stu, 7, 7, 1, 1), false));
  test('안 되는 이유를 아이 말로 알려 준다', () => {
    if (R._animWhyNot('d_y57').indexOf('풀밭') < 0) throw new Error(R._animWhyNot('d_y57'));
    if (R._animWhyNot('d_y53').indexOf('물') < 0) throw new Error(R._animWhyNot('d_y53'));
  });

  // ③ 물에 놓인 오리는 물 밖으로 안 나간다(물은 5줄 한 줄뿐)
  const water = {};
  for (let c = 4; c <= 8; c++) water['5_' + c] = 'water';
  const stu2 = { yardFloor: water, houseDecorations: [{ id: 'd_y56', area: 'yard', row: 5, col: 6 }] };
  R._animSyncLayer('if-topview', stu2, 'yard', 20, 1000, 560, 0, 0);
  const duck = [...R._animLayers.get('if-topview').items.values()][0];
  test('물에 놓인 오리는 헤엄 상태가 된다', () => eq(duck.swim, true));
  let out = null;
  X.run(120000, () => { const g = (stu2.yardFloor[duck.cur.row + '_' + duck.cur.col] || 'grass'); if (!out && g !== 'water') out = JSON.stringify(duck.cur); });
  test('2분 동안 오리가 물 밖으로 안 나간다', () => { if (out) throw new Error('물 밖: ' + out); });
  test('물이 한 줄이면 오리는 그 줄에 있다', () => eq(duck.cur.row, 5));

  // ④ 땅 동물은 물에 안 들어간다
  R._animStopLayer('if-topview');
  const stu3 = { yardFloor: water, houseDecorations: [{ id: 'd_y57', area: 'yard', row: 5, col: 2 }] };
  R._animSyncLayer('if-topview', stu3, 'yard', 20, 1000, 560, 0, 0);
  const sheep = [...R._animLayers.get('if-topview').items.values()][0];
  let wet = null;
  X.run(120000, () => { if (!wet && (stu3.yardFloor[sheep.cur.row + '_' + sheep.cur.col] || 'grass') === 'water') wet = JSON.stringify(sheep.cur); });
  test('양은 2분 동안 물에 안 들어간다', () => { if (wet) throw new Error('물에 들어갔다: ' + wet); });

  // ⑤ 둘이 한 칸에 겹치지 않는다(가는 칸·목표 칸 예약)
  R._animStopLayer('if-topview');
  const flock = { yardFloor: {}, houseDecorations: [0, 1, 2, 3, 4, 5].map(i => ({ id: 'd_y55', area: 'yard', row: 10 + (i % 2), col: 10 + Math.floor(i / 2) })) };
  R._animSyncLayer('if-topview', flock, 'yard', 20, 1000, 560, 0, 0);
  const hens = [...R._animLayers.get('if-topview').items.values()];
  let clash = null;
  X.run(180000, () => {
    if (clash) return;
    const cells = new Map();
    for (const h of hens) for (const c of [h.cur, h.seg && { row: h.seg.r1, col: h.seg.c1 }]) {
      if (!c) continue; const k = c.row + '_' + c.col, o = cells.get(k);
      if (o && o !== h) clash = k; cells.set(k, h);
    }
  });
  test('닭 여섯이 3분 동안 한 칸에 겹치지 않는다(지금 칸·가는 칸)', () => { if (clash) throw new Error('겹침 ' + clash); });

  // ⑥ 누르면 반응 · 강아지는 다가온다
  R._animStopLayer('if-topview');
  const stu4 = { yardFloor: {}, houseDecorations: [{ id: 'd_y53', area: 'yard', row: 3, col: 3 }] };
  R._animSyncLayer('if-topview', stu4, 'yard', 20, 1000, 560, 0, 0);
  const dog = R._animAt('if-topview', 3, 3);
  test('누른 칸의 동물을 찾는다', () => { if (!dog) throw new Error('못 찾음'); });
  test('빈 칸을 누르면 동물이 없다(놓기로 넘어간다)', () => eq(R._animAt('if-topview', 10, 10), null));
  const before = dog.cur.col;
  R._animPoke(dog, 8);
  test('누르면 말풍선과 💗 가 뜬다', () => {
    const say = dog.el.children.filter(c => c.className === 'deco-anim-say')[0], heart = dog.el.children.filter(c => c.className === 'deco-anim-heart')[0];
    if (!say || !heart) throw new Error('말풍선/하트 없음');
    eq(say.textContent, '왈!');
  });
  X.run(1500);
  test('🐶 강아지는 누른 쪽으로 한 칸 걸어온다', () => eq(dog.cur.col, before + 1));
  //  강아지가 아닌 동물은 그 자리에서 기뻐한다(0.9초 뒤 다음 생각)
  R._animStopLayer('if-topview');
  R._animSyncLayer('if-topview', { yardFloor: {}, houseDecorations: [{ id: 'd_y55', area: 'yard', row: 3, col: 3 }, { id: 'd_y57', area: 'yard', row: 3, col: 7 }] }, 'yard', 20, 1000, 560, 0, 0);
  const [h1, s1] = [...R._animLayers.get('if-topview').items.values()];
  h1.seg = null; s1.seg = null; s1.state = 'idle'; s1.dir = 1;
  R._animPoke(h1);
  test('닭을 누르면 기쁨 상태', () => eq(h1.state, 'happy'));
  test('둘레의 가만히 있는 양이 누른 닭 쪽(왼쪽)을 본다', () => eq(s1.dir, -1));
  R._animStopLayer('if-topview');
  //  [DECO-DAYNIGHT-1] 밤이면 잔다(쉼터가 없으면 그 자리에서) · 낮이 되면 다시 논다
  X.sb._decoPhase = () => 'night';
  R._animSyncLayer('if-topview', { yardFloor: {}, houseDecorations: [0, 1, 2].map(i => ({ id: 'd_y55', area: 'yard', row: 5, col: 5 + i * 3 })) }, 'yard', 20, 1000, 560, 0, 0);
  X.run(12000);
  const sleepers = [...R._animLayers.get('if-topview').items.values()];
  test('밤이면 동물이 잔다', () => { if (!sleepers.every(h => h.state === 'sleep' && !h.seg)) throw new Error(sleepers.map(h => h.state).join()); });
  X.sb._decoPhase = () => 'day';
  X.run(20000);
  test('낮이 되면 깨어 논다', () => { if (sleepers.some(h => h.state === 'sleep')) throw new Error(sleepers.map(h => h.state).join()); });
  delete X.sb._decoPhase;
  R._animStopLayer('if-topview');
} catch (e) {
  test('동물 규칙 코드를 돌릴 수 있다', () => { throw e; });
}


// ═══════════════════════════════════════════════════════════════
cur = '꾸미기 동물 우리(DECO-ANIM-3)';
try {
  const S = read('student.js');
  const DECOS = [
    { id: 'd_y55', name: '닭 한 마리' },
    { id: 'pen_hen', name: '닭장', size: { w: 3, h: 3 }, pen: true },
    { id: 'd_y5', name: '벤치', size: { w: 2, h: 1 } },
  ];
  const X = animSandbox(S, { decos: DECOS });
  const P = X.A;

  test('장식 표의 pen:true 를 우리로 알아본다(보통 장식은 아니다)', () => {
    eq([P._isPenDeco('pen_hen'), P._isPenDeco('d_y5'), P._isPenDeco('없는것')], [true, false, false]);
  });
  const stu = { yardFloor: {}, houseDecorations: [
    { id: 'pen_hen', area: 'yard', row: 10, col: 10 },
    { id: 'd_y55',   area: 'yard', row: 11, col: 11 },
    { id: 'd_y5',    area: 'yard', row: 11, col: 14 },   // 우리 밖 벤치
  ] };
  test('우리 사각형을 찾는다(안은 찾고 밖은 못 찾는다)', () => {
    eq(P._penAt(stu, 11, 11), { r0: 11, c0: 11, r1: 11, c1: 11, water: false });   // 울타리 줄 뺀 안쪽
    eq(P._penAt(stu, 9, 10), null);
  });
  test('동물은 우리 칸을 지날 수 있고, 보통 장식 칸은 못 지난다', () => {
    const free = P._animFreeMaker(stu, 28, 50);
    eq([free(10, 10, 1, 1, 'd_y55', false), free(11, 14, 1, 1, 'd_y55', false)], [true, false]);
  });
  P._animSyncLayer('if-topview', stu, 'yard', 20, 1000, 560, 0, 0);
  const hen = [...P._animLayers.get('if-topview').items.values()][0];
  test('우리 안에 놓인 닭은 울타리 줄을 뺀 안쪽만 기억한다', () => eq(hen.pen, { r0: 11, c0: 11, r1: 11, c1: 11, water: false }));
  let out = null;
  X.run(200000, () => { const p = hen.cur; if (!out && (p.row !== 11 || p.col !== 11)) out = JSON.stringify(p); });
  test('200초 동안 닭이 울타리 줄을 밟지 않는다(3×3 은 안쪽 1칸)', () => { if (out) throw new Error('울타리 줄: ' + out); });

  P._animStopLayer('if-topview');
  DECOS.push({ id: 'pen_pond', name: '연못 우리', size: { w: 4, h: 3 }, pen: true, penWater: true });
  DECOS.push({ id: 'd_y56', name: '오리 한 마리' });
  const stuP = { yardFloor: {}, houseDecorations: [
    { id: 'pen_pond', area: 'yard', row: 5, col: 5 },
    { id: 'd_y56',    area: 'yard', row: 6, col: 6 },
  ] };
  P._animSyncLayer('if-topview', stuP, 'yard', 20, 1000, 560, 0, 0);
  const duckPen = [...P._animLayers.get('if-topview').items.values()][0];
  test('연못 우리 안의 오리는 바닥이 잔디여도 헤엄한다', () => eq(duckPen.swim, true));
  let outP = null, movedP = false;
  X.run(120000, () => { const p = duckPen.cur; if (p.col === 7) movedP = true; if (!outP && (p.row !== 6 || p.col < 6 || p.col > 7)) outP = JSON.stringify(p); });
  test('2분 동안 오리가 연못 우리 안쪽(울타리 줄 뺀 곳)에만 있는다', () => { if (outP) throw new Error('밖: ' + outP); });
  test('우리 안에서도 걷는다', () => eq(movedP, true));

  P._animStopLayer('if-topview');
  const stu2 = { yardFloor: {}, houseDecorations: [{ id: 'd_y55', area: 'yard', row: 3, col: 3 }] };
  P._animSyncLayer('if-topview', stu2, 'yard', 20, 1000, 560, 0, 0);
  const free2 = [...P._animLayers.get('if-topview').items.values()][0];
  test('우리 밖 동물은 우리가 없다(반지름 규칙 그대로)', () => eq(free2.pen, null));
  P._animStopLayer('if-topview');
} catch (e) {
  test('우리 코드를 돌릴 수 있다', () => { throw e; });
}


// ═══════════════════════════════════════════════════════════════
cur = '꾸미기 울타리 자동 이음·먹이통(DECO-FENCE-1·DECO-FEED-1)';
try {
  const S = read('student.js');
  const DECOS = [
    { id: 'd_y49', name: '울타리 가로형' }, { id: 'd_y50', name: '울타리 세로형' },
    { id: 'd_y51', name: '울타리 왼쪽 코너' }, { id: 'd_y52', name: '울타리 오른쪽 코너' },
    { id: 'd_y70', name: '울타리', autoFence: true },
    { id: 'd_y69', name: '먹이통', feeder: true },
    { id: 'd_y55', name: '닭 한 마리' }, { id: 'd_y53', name: '강아지' }, { id: 'd_y54', name: '고양이' },
  ];
  const X = animSandbox(S, { decos: DECOS, size: () => ({ w: 1, h: 1 }), extraConsts: ['FENCE_IDS', 'FENCE_ART'], extraFns: ['_isFenceCell', '_fenceArtOr', '_fencePick', '_fenceArtFor'] });
  const F = X.A;

  test('혼자 있는 울타리는 가로 ─', () => eq(F._fencePick(false, false, false, false), 'd_y49'));
  test('좌우로 지나가면 가로 ─', () => eq(F._fencePick(true, true, false, false), 'd_y49'));
  test('위아래로 지나가면 세로 │', () => eq(F._fencePick(false, false, true, true), 'd_y50'));
  test('위+오른 → └ (d_y51)', () => eq(F._fencePick(false, true, true, false), 'd_y51'));
  test('위+왼 → ┘ (d_y52)', () => eq(F._fencePick(true, false, true, false), 'd_y52'));
  test('아래 꺾임은 그림이 없으면 세로로 대신한다', () => {
    eq([F._fencePick(false, true, false, true), F._fencePick(true, false, false, true)], ['d_y50', 'd_y50']);
  });
  test('아래 꺾임 그림이 표에 있으면 ┌ ┐ 를 쓴다(#398)', () => {
    DECOS.push({ id: 'd_y71', name: '울타리 모퉁이 ┌', hidden: true }, { id: 'd_y72', name: '울타리 모퉁이 ┐', hidden: true });
    try {
      eq([F._fencePick(false, true, false, true), F._fencePick(true, false, false, true)], ['d_y71', 'd_y72']);
      eq([F._fencePick(false, true, true, false), F._fencePick(true, false, true, false)], ['d_y51', 'd_y52']);
    } finally { DECOS.length = DECOS.length - 2; }
  });
  test('세 갈래·네 갈래는 가로로 읽는다(줄이 끊겨 보이지 않게)', () => {
    eq([F._fencePick(true, true, true, false), F._fencePick(true, true, true, true)], ['d_y49', 'd_y49']);
  });
  test('이웃이 위 하나면 세로 · 왼 하나면 가로', () => {
    eq([F._fencePick(false, false, true, false), F._fencePick(true, false, false, false)], ['d_y50', 'd_y49']);
  });
  const fstu = { yardFloor: {}, houseDecorations: [
    { id: 'd_y70', area: 'yard', row: 5, col: 5 },
    { id: 'd_y70', area: 'yard', row: 5, col: 6 },
    { id: 'd_y49', area: 'yard', row: 5, col: 7 },   // 옛 가로형도 이웃이다
    { id: 'd_y70', area: 'yard', row: 6, col: 5 },
  ] };
  test('줄로 이어진 가운데는 가로', () => eq(F._fenceArtFor(fstu, 5, 6), 'd_y49'));
  test('아래로도 이어진 왼쪽 끝은 아래 꺾임 → 그림 없으니 세로', () => eq(F._fenceArtFor(fstu, 5, 5), 'd_y50'));
  test('세로로만 이어진 아래 칸은 세로', () => eq(F._fenceArtFor(fstu, 6, 5), 'd_y50'));

  // ③ 먹이통 — 둘레 고리로 모인다(창조자 27회 · 디자인 움직이는 장면 06: 겹쳐 쌓이고 세로 한 줄로 서던 것)
  const stu = { yardFloor: {}, houseDecorations: [
    { id: 'd_y69', area: 'yard', row: 10, col: 10 },
    { id: 'd_y55', area: 'yard', row: 12, col: 14 },
    { id: 'd_y55', area: 'yard', row: 13, col: 12 },
    { id: 'd_y53', area: 'yard', row: 8, col: 14 },
    { id: 'd_y54', area: 'yard', row: 12, col: 8 },
    { id: 'd_y55', area: 'yard', row: 7, col: 9 },
  ] };
  test('먹이통을 찾는다', () => eq(F._feedersOf(stu).length, 1));
  F._animSyncLayer('if-topview', stu, 'yard', 20, 1000, 560, 0, 0);
  const all = [...F._animLayers.get('if-topview').items.values()];
  test('가까운 동물은 모두 갈 먹이통을 물고 있다', () => { if (!all.every(s => s.feeder)) throw new Error('먹이통 없는 동물'); });
  const cheb = s => Math.max(Math.abs(s.cur.row - 10), Math.abs(s.cur.col - 10));
  let overlap = null, onFeeder = null;
  X.run(40000, () => {
    const seen = new Set();
    for (const s of all) { const k = s.cur.row + '_' + s.cur.col; if (seen.has(k) && !overlap) overlap = k; seen.add(k); if (s.cur.row === 10 && s.cur.col === 10) onFeeder = k; }
  });
  test('40초 안에 모두 먹이통 둘레(2칸 고리 안)에 모인다', () => { const far = all.filter(s => cheb(s) > 2 || cheb(s) < 1); if (far.length) throw new Error(far.map(s => s.id + '@' + JSON.stringify(s.cur)).join(' ')); });
  test('모이는 동안 한 칸에 둘이 겹치지 않는다 · 먹이통 칸에 서지 않는다', () => { if (overlap || onFeeder) throw new Error(overlap || onFeeder); });
  test('세로 한 줄이 아니다(둘 이상의 열 · 둘 이상의 줄)', () => {
    const cols = new Set(all.map(s => s.cur.col)), rows = new Set(all.map(s => s.cur.row));
    if (cols.size < 2 || rows.size < 2) throw new Error('열 ' + [...cols] + ' · 줄 ' + [...rows]);
  });
  test('모인 동물은 먹이통 쪽을 본다', () => {
    const wrong = all.filter(s => !s.seg && s.cur.col !== 10 && s.dir !== (s.cur.col < 10 ? 1 : -1));
    if (wrong.length) throw new Error(wrong.map(s => s.id + '@' + JSON.stringify(s.cur) + ' dir ' + s.dir).join(' '));
  });
  test('칸 안에서 조금씩 비켜 선다(흔들림 · 가로 ±.25 · 세로 ±.18)', () => {
    if (!all.some(s => Math.abs(s.jx) > .01 || Math.abs(s.jy) > .01)) throw new Error('비켜 선 동물 없음');
    if (all.some(s => Math.abs(s.jx) > .25 + 1e-9 || Math.abs(s.jy) > .18 + 1e-9)) throw new Error('너무 멀리');
  });

  F._animStopLayer('if-topview');
  const far = { yardFloor: {}, houseDecorations: [
    { id: 'd_y69', area: 'yard', row: 2, col: 2 },
    { id: 'd_y55', area: 'yard', row: 20, col: 30 },
  ] };
  F._animSyncLayer('if-topview', far, 'yard', 20, 1000, 560, 0, 0);
  const far1 = [...F._animLayers.get('if-topview').items.values()][0];
  test('먹이통이 멀면(7칸 넘음) 그 동물은 안 간다', () => eq(far1.feeder, null));
  F._animStopLayer('if-topview');
} catch (e) {
  test('울타리·먹이통 코드를 돌릴 수 있다', () => { throw e; });
}


// ═══════════════════════════════════════════════════════════════
//  [DECO-FLOOR-PARSE-1] 바닥 저장값 해석 — '이름#색+마감'. 옛 값은 이름 그대로여야 옛 마당이 안 바뀐다.
cur = '꾸미기 바닥 저장값 해석(DECO-FLOOR-PARSE-1)';
try {
  const S = read('student.js');
  const sb = {}; sb.globalThis = sb; vm.createContext(sb);
  //  FLOOR_TILES 표(옛 바닥 14종)를 소스에서 그대로 잘라 온다 — 표에 있는 이름은 전부 '이름 그대로'여야 한다
  const at = S.indexOf('const FLOOR_TILES = {'), end = S.indexOf(NL + '};', at);
  if (at < 0 || end < 0) throw new Error('FLOOR_TILES 표를 못 찾음');
  vm.runInContext(SPACE_PRELUDE(S) + S.slice(at, end + 3) + NL + sliceConst(S, 'GROUND_HARD') + sliceFn(S, '_groundKind') + NL + sliceFn(S, '_groundAt') + NL
    + ';globalThis.__R = { _floorParse, _groundAt, FLOOR_TILES };', sb);
  const P = sb.__R._floorParse, plain = (v) => { const o = P(v); return { name: o.name, color: o.color, rim: o.rim }; };
  const OLD = Object.keys(sb.__R.FLOOR_TILES).slice(0, 14);
  test('옛 바닥 14종이 표에 있다(이 검사가 빈 표를 보고 통과하지 않게)', () => eq(OLD.length >= 14, true));
  test('옛 값은 이름 그대로 · 색·마감 없음', () => OLD.forEach(k => eq(plain(k), { name: k, color: '', rim: '' }, k)));
  test("'#'·'+' 가 없는 낯선 값도 이름 그대로(전과 같은 길 — 그림이 없으면 잔디색)", () => eq(plain('Some-Old Value'), { name: 'Some-Old Value', color: '', rim: '' }));
  test('빈 값·없는 값·글자가 아닌 값 = 잔디', () => [undefined, null, '', 0, false, 5, {}, []].forEach(v => eq(plain(v), { name: 'grass', color: '', rim: '' }, String(v))));
  test('이름#색+마감', () => eq(plain('tulipbed#red+picket'), { name: 'tulipbed', color: 'red', rim: 'picket' }));
  test('이름+마감(색 없음)', () => eq(plain('hydrangea+stone'), { name: 'hydrangea', color: '', rim: 'stone' }));
  test('이름#색(마감 없음)', () => eq(plain('tulipcol#yellow'), { name: 'tulipcol', color: 'yellow', rim: '' }));
  test('못 읽는 새 형식은 잔디(순서 뒤집힘 · 빈 조각 · 주소에 못 쓰는 글자)', () =>
    ['tulipbed+picket#red', 'tulipbed#', 'tulipbed+', '#red', '+brick', 'tulipbed#red+', 'tulipbed#re d', 'tulipbed#../x', 'tulipbed#red#blue', 'a+b+c', 'Tulip#red']
      .forEach(v => eq(plain(v), { name: 'grass', color: '', rim: '' }, v)));
  test('같은 값은 같은 객체(기억) · 얼어 있다', () => {
    eq(P('lavender+brick') === P('lavender+brick'), true); eq(Object.isFrozen(P('stone')), true); eq(P(undefined) === P(undefined), true);
  });
  test('기억은 끝없이 자라지 않는다(서로 다른 값 1000개 뒤에도 300 남짓)', () => {
    for (let i = 0; i < 1000; i++) P('x' + i);
    eq(P._m.size <= 301, true); eq(plain('stone'), { name: 'stone', color: '', rim: '' });
  });
  test('동물 바닥 묶음은 이름으로 본다 — 마감 붙은 꽃밭 = 풀·흙, 물·돌은 전과 같다', () => {
    const stu = { yardFloor: { '1_1': 'lavender+brick', '1_2': 'tulipbed#red+picket', '2_2': 'water', '3_3': 'stone' } };
    eq([sb.__R._groundAt(stu, 1, 1), sb.__R._groundAt(stu, 1, 2), sb.__R._groundAt(stu, 2, 2), sb.__R._groundAt(stu, 3, 3), sb.__R._groundAt(stu, 9, 9)],
       ['soft', 'soft', 'water', 'hard', 'soft']);
  });
} catch (e) {
  test('바닥 저장값 해석 코드를 돌릴 수 있다', () => { throw e; });
}

// ═══════════════════════════════════════════════════════════════
//  [DECO-FLOOR-COLOR-1] 정원 바닥 — 변형 표·색 표가 그림 파일과 맞는가 · 색이 그림 주소와 기억 키에 들어가는가 · 쓴 색만 부르는가
cur = '꾸미기 정원 바닥 색(DECO-FLOOR-COLOR-1)';
try {
  const S = read('student.js');
  const srcs = [], draws = [];
  const sb = { Image: function () { const o = { naturalWidth: 100, naturalHeight: 100 }; Object.defineProperty(o, 'src', { set(v) { srcs.push(v); } }); return o; },
    encodeURIComponent, _drawDeco() {}, _ffRedrawSoon() {}, _dCtx: { drawImage(img) { draws.push(img); } } };
  sb.globalThis = sb; vm.createContext(sb);
  const at = S.indexOf('const _FLOOR_COLORS = {'), end = S.indexOf(NL + '};', at);
  if (at < 0 || end < 0) throw new Error('_FLOOR_COLORS 표를 못 찾음');
  const vAt = S.indexOf('const _FLOOR_VARIANTS = {'), vEnd = S.indexOf('};', vAt);
  const eAt = S.indexOf('const _FLOOR_EDGE_COLOR = '), eEnd = S.indexOf(NL + '});', eAt);
  if (eAt < 0 || eEnd < 0) throw new Error('_FLOOR_EDGE_COLOR 표를 못 찾음');
  vm.runInContext(ART_PRELUDE(S) + 'const _FLOOR_IMG = {};' + NL + S.slice(vAt, vEnd + 2) + NL + S.slice(at, end + 3) + NL
    + sliceConst(S, '_FLOOR_BED_COLORS') + sliceConst(S, '_FLOOR_RIMS') + S.slice(eAt, eEnd + 4) + NL
    + ['_seaNow', '_seaHash', '_floorImg', '_floorBaseName', '_floorIsGrass', '_bmpStep', '_svgBmp', '_floorBmp', '_floorPaint', '_drawFloorSVG'].map(n => sliceFn(S, n)).join(NL) + NL
    + LOOK_PRELUDE(S) + 'const _SVG_BMP = new Map();' + NL
    + ';globalThis.__R = { _FLOOR_IMG, _FLOOR_VARIANTS, _FLOOR_COLORS, _FLOOR_BED_COLORS, _FLOOR_RIMS, _FLOOR_EDGE_COLOR, _floorImg, _floorIsGrass, _drawFloorSVG };', sb);
  const R = sb.__R, DIR = path.join(ROOT, 'assets', 'floor');
  const GARDEN = Object.keys(R._FLOOR_COLORS);
  test('정원 바닥 7종', () => eq(GARDEN.slice().sort(), ['daisyfield', 'hydrangea', 'lavender', 'sunflowerbed', 'tulipbed', 'tulipcol', 'wildflower']));
  test('변형 표의 개수 = 실제 그림 파일 수(옛 바닥 포함 전부)', () => Object.keys(R._FLOOR_VARIANTS).forEach(t => {
    const n = 'abcd'.split('').filter(v => fs.existsSync(path.join(DIR, 'tile_' + t + '_' + v + '.svg'))).length;
    eq(R._FLOOR_VARIANTS[t], n, t);
  }));
  test('색 표 = 그림 파일 안의 `#색:target` (변형마다 전부 · 빠짐도 남음도 없이)', () => GARDEN.forEach(t => {
    for (let i = 0; i < R._FLOOR_VARIANTS[t]; i++) {
      const svg = fs.readFileSync(path.join(DIR, 'tile_' + t + '_' + 'abcd'[i] + '.svg'), 'utf8');
      const inFile = [...new Set([...svg.matchAll(/#([a-z0-9_]+):target/g)].map(m => m[1]))].sort();
      eq(R._FLOOR_COLORS[t].slice().sort(), inFile, 'tile_' + t + '_' + 'abcd'[i]);
    }
  }));
  test('색 이름은 저장값 해석이 받는 글자만([a-z0-9_])', () => GARDEN.forEach(t => R._FLOOR_COLORS[t].forEach(c => eq(/^[a-z0-9_]+$/.test(c), true, t + '#' + c))));
  const T = () => 'grass';   // 이웃은 전부 잔디
  test('색 없는 값은 전과 같은 주소·같은 기억 키', () => {
    srcs.length = 0; R._drawFloorSVG('stone', 2, 3, 0, 0, 20, T);
    eq(srcs.length, 1); eq(/^\.\/assets\/floor\/tile_stone_[ab]\.svg$/.test(srcs[0]), true, srcs[0]);
    eq(Object.keys(R._FLOOR_IMG).filter(k => k.indexOf('#') >= 0).length, 0);
  });
  test('색 있는 정원 바닥은 주소 끝에 #색 · 기억 키도 색까지', () => {
    srcs.length = 0; R._drawFloorSVG('tulipbed', 2, 3, 0, 0, 20, T, 'red');
    eq(/^\.\/assets\/floor\/tile_tulipbed_[ab]\.svg#red$/.test(srcs[0]), true, srcs[0]);
    eq(Object.keys(R._FLOOR_IMG).filter(k => /^tile_tulipbed_[ab]#red$/.test(k)).length, 1);
  });
  test('같은 파일·다른 색은 따로 부른다 · 같은 색은 다시 안 부른다', () => {
    srcs.length = 0;
    R._drawFloorSVG('tulipbed', 2, 3, 0, 0, 20, T, 'yellow'); R._drawFloorSVG('tulipbed', 2, 3, 0, 0, 20, T, 'yellow'); R._drawFloorSVG('tulipbed', 2, 3, 0, 0, 20, T, '');
    eq(srcs.map(u => u.split('/').pop().replace(/_[ab]\./, '_x.')), ['tile_tulipbed_x.svg#yellow', 'tile_tulipbed_x.svg']);
  });
  test('표에 없는 색·옛 바닥에 붙은 색은 기본색으로(그림을 새로 안 부른다)', () => {
    srcs.length = 0;
    R._drawFloorSVG('tulipbed', 2, 3, 0, 0, 20, T, 'nosuchcolor'); R._drawFloorSVG('tulipbed', 2, 3, 0, 0, 20, T, 'pink'); R._drawFloorSVG('stone', 2, 3, 0, 0, 20, T, 'red');
    eq(srcs, []);
  });
  test('쓴 색만 부른다 — 여기까지 부른 정원 바닥 그림은 셋(빨강·노랑·기본)', () =>
    eq(Object.keys(R._FLOOR_IMG).filter(k => /^tile_tulipbed/.test(k)).length, 3));
  test('그림이 오면 색마다 제 그림을 그린다', () => {
    Object.keys(R._FLOOR_IMG).forEach(k => { R._FLOOR_IMG[k].ok = true; R._FLOOR_IMG[k].img.tag = k; });
    const first = (type, col) => { draws.length = 0; R._drawFloorSVG(type, 2, 3, 0, 0, 20, () => type, col); return draws[0] && draws[0].tag; };
    eq([first('tulipbed', 'red'), first('tulipbed', 'yellow'), first('tulipbed', ''), first('tulipbed', 'nosuchcolor')].map(k => k.replace(/_[ab]/, '')),
       ['tile_tulipbed#red', 'tile_tulipbed#yellow', 'tile_tulipbed', 'tile_tulipbed']);
  });
  // ── [DECO-FLOOR-EDGE-1] 꽃밭 가장자리 · 마감 · 들꽃 잔디 = 풀 ──
  cur = '꾸미기 꽃밭 가장자리(DECO-FLOOR-EDGE-1)';
  const BEDS = Object.keys(R._FLOOR_EDGE_COLOR);
  const PIECES = ['n', 'e', 's', 'w', 'n2', 'e2', 's2', 'w2', 'in_ne', 'in_nw', 'in_se', 'in_sw', 'out_ne', 'out_nw', 'out_se', 'out_sw'];
  test('꽃밭 무리 = 정원 7종에서 들꽃 잔디를 뺀 6종', () => eq(BEDS.slice().sort(), GARDEN.filter(t => t !== 'wildflower').sort()));
  test('들꽃 잔디는 풀 · 꽃밭 무리는 풀이 아니다', () => { eq(R._floorIsGrass('wildflower'), true); eq(R._floorIsGrass('grass'), true); eq(R._floorIsGrass('flower'), true); BEDS.forEach(t => eq(R._floorIsGrass(t), false, t)); eq(R._floorIsGrass('stone'), false); });
  test('가장자리·마감 조각 16개씩이 파일로 있다(bed · rim_picket · rim_stone · rim_brick)', () =>
    ['bed'].concat(R._FLOOR_RIMS.map(m => 'rim_' + m)).forEach(pre => PIECES.forEach(k => eq(fs.existsSync(path.join(DIR, pre + '_' + k + '.svg')), true, pre + '_' + k))));
  test('꽃잎 색 표 = bed_*.svg 안의 `#색:target`(16조각 전부) · 마감 그림에는 색이 없다', () => {
    PIECES.forEach(k => { const svg = fs.readFileSync(path.join(DIR, 'bed_' + k + '.svg'), 'utf8');
      eq([...new Set([...svg.matchAll(/#([a-z0-9_]+):target/g)].map(m => m[1]))].sort(), R._FLOOR_BED_COLORS.slice().sort(), 'bed_' + k); });
    R._FLOOR_RIMS.forEach(m => PIECES.forEach(k => eq(/:target/.test(fs.readFileSync(path.join(DIR, 'rim_' + m + '_' + k + '.svg'), 'utf8')), false, 'rim_' + m + '_' + k)));
  });
  test('짝 표의 값은 전부 꽃잎 색 · 열쇠는 그 종류의 바탕 색(또는 기본색 \'\') · 종류마다 기본색 짝이 있다', () => BEDS.forEach(t => {
    eq(typeof R._FLOOR_EDGE_COLOR[t][''], 'string', t + ' 기본색 짝');
    Object.keys(R._FLOOR_EDGE_COLOR[t]).forEach(c => { eq(c === '' || R._FLOOR_COLORS[t].indexOf(c) >= 0, true, t + '#' + c); eq(R._FLOOR_BED_COLORS.indexOf(R._FLOOR_EDGE_COLOR[t][c]) >= 0, true, t + '#' + c + ' → ' + R._FLOOR_EDGE_COLOR[t][c]); });
  }));
  //  그린 조각 이름을 순서대로 모은다(그림은 전부 '왔다'고 친다 — 기억 표를 미리 채우는 대신 Image 가 오면 ok 로)
  const piecesOf = (type, color, rim, grid) => {   // grid: '-1,0' → 이웃 이름(없으면 잔디)
    const T = (rr, cc, wantRim) => { const v = (rr === 2 && cc === 3) ? type + (rim ? '+' + rim : '') : ((grid || {})[(rr - 2) + ',' + (cc - 3)] || 'grass'); return v.split('+')[wantRim ? 1 : 0] || ''; };
    for (let pass = 0; pass < 4; pass++) {   // 바탕이 와야 조각을 부르고, 조각이 와야 그린다 — 새로 부른 그림이 없을 때까지
      const n0 = Object.keys(R._FLOOR_IMG).length;
      Object.keys(R._FLOOR_IMG).forEach(k => { R._FLOOR_IMG[k].ok = true; R._FLOOR_IMG[k].img.tag = k; });
      draws.length = 0; R._drawFloorSVG(type, 2, 3, 0, 0, 20, T, color, rim);
      if (pass && Object.keys(R._FLOOR_IMG).length === n0) break;
    }
    return draws.map(i => i.tag).slice(1);   // 맨 앞은 바탕
  };
  const all8 = v => ({ '-1,-1': v, '-1,0': v, '-1,1': v, '0,-1': v, '0,1': v, '1,-1': v, '1,0': v, '1,1': v });
  test('잔디에 홀로 선 꽃밭 = 변 4 + 안 모서리 4, 순서도 물가와 같다 · 잔디 번짐은 안 얹는다', () =>
    eq(piecesOf('tulipbed', '', ''), ['bed_n2', 'bed_e2', 'bed_s2', 'bed_w2', 'bed_in_ne', 'bed_in_nw', 'bed_in_se', 'bed_in_sw']));
  test('꽃밭에 둘러싸이면 조각 0 — 종류·색이 달라도(줄무늬 화단은 한 밭)', () => { eq(piecesOf('tulipbed', 'red', '', all8('tulipbed')), []); eq(piecesOf('tulipbed', 'red', '', all8('lavender')), []); });
  test('변은 꽃밭인데 대각선만 바깥 = 바깥 모서리 조각', () => eq(piecesOf('tulipbed', '', '', Object.assign(all8('tulipbed'), { '-1,1': 'grass', '1,-1': 'wildflower' })), ['bed_out_ne', 'bed_out_sw']));
  test('들꽃 잔디·돌·물 옆은 바깥', () => ['wildflower', 'stone', 'water'].forEach(v => eq(piecesOf('hydrangea', '', '', Object.assign(all8('hydrangea'), { '0,1': v })), ['bed_e2#blue'], v)));
  test('짝 표는 빠짐없다 — 꽃밭 6종의 바탕 색 전부에 짝이 있다(디자인 표 #636)', () => BEDS.forEach(t => R._FLOOR_COLORS[t].forEach(c => eq(typeof R._FLOOR_EDGE_COLOR[t][c], 'string', t + '#' + c))));
  const e1 = (t, c) => piecesOf(t, c, '', Object.assign(all8(t), { '0,1': 'grass' }))[0];
  test('꽃잎 색 = 짝 표 그대로 · 눈으로 고른 짝(candy→red · duo→violet · moon→yellow · lemon→yellow · night→violet · sherbet→pink) · pink 는 주소에 안 붙인다', () => {
    eq([e1('tulipbed', 'red'), e1('tulipbed', ''), e1('tulipbed', 'candy'), e1('tulipbed', 'sherbet'), e1('tulipcol', 'night'), e1('tulipcol', 'yellow'),
        e1('hydrangea', ''), e1('hydrangea', 'pink'), e1('hydrangea', 'duo'), e1('hydrangea', 'moon'),
        e1('sunflowerbed', ''), e1('sunflowerbed', 'lemon'), e1('lavender', ''), e1('lavender', 'white'), e1('daisyfield', ''), e1('daisyfield', 'pink')],
       ['bed_e2#red', 'bed_e2', 'bed_e2#red', 'bed_e2', 'bed_e2#violet', 'bed_e2#yellow',
        'bed_e2#blue', 'bed_e2', 'bed_e2#violet', 'bed_e2#yellow',
        'bed_e2#yellow', 'bed_e2#yellow', 'bed_e2#violet', 'bed_e2#white', 'bed_e2#white', 'bed_e2']);
  });
  test('짝 표에 없는 새 바탕 색 → 그 바닥의 기본 짝(\'\' 줄) · 물려받은 이름(constructor)도 기본 짝', () => {
    R._FLOOR_COLORS.hydrangea.push('zzz', 'constructor');
    try { eq([e1('hydrangea', 'zzz'), e1('hydrangea', 'constructor')], ['bed_e2#blue', 'bed_e2#blue']); }
    finally { R._FLOOR_COLORS.hydrangea.splice(-2, 2); }
  });
  test('마감이 있으면 rim_<마감>_* · 색 없음 · 없는 마감은 그냥 가장자리', () => {
    eq(piecesOf('tulipbed', 'red', 'picket', Object.assign(all8('tulipbed#red+picket'.replace('#red', '')), { '1,0': 'grass' })), ['rim_picket_s2']);
    eq(piecesOf('lavender', '', 'brick'), ['n2', 'e2', 's2', 'w2', 'in_ne', 'in_nw', 'in_se', 'in_sw'].map(k => 'rim_brick_' + k));
    eq(piecesOf('tulipbed', 'red', 'nosuchrim', Object.assign(all8('tulipbed'), { '1,0': 'grass' })), ['bed_s2#red']);
  });
  test('마감 있는 칸은 같은 마감의 꽃밭만 안쪽 — 울타리는 빙 둘러 닫힌다 · 마감 없는 칸은 꽃밭이면 다 안쪽', () => {
    const RING = ['n2', 'e2', 's2', 'w2', 'in_ne', 'in_nw', 'in_se', 'in_sw'];
    eq(piecesOf('sunflowerbed', '', 'picket', all8('hydrangea')), RING.map(k => 'rim_picket_' + k));          // 마감 없는 밭에 둘러싸여도 말뚝은 사방
    eq(piecesOf('sunflowerbed', '', 'picket', all8('hydrangea+brick')), RING.map(k => 'rim_picket_' + k));    // 다른 마감도 바깥
    eq(piecesOf('sunflowerbed', '', 'picket', all8('lavender+picket')), []);                                  // 같은 마감이면 종류가 달라도 한 밭
    eq(piecesOf('hydrangea', '', '', all8('sunflowerbed+picket')), []);                                       // 마감 없는 칸: 옆 밭 울타리까지 꽃이 닿는다
    eq(piecesOf('sunflowerbed', '', 'picket', Object.assign(all8('sunflowerbed+picket'), { '-1,1': 'hydrangea' })), ['rim_picket_out_ne']);
  });
  test('들꽃 잔디 칸에는 아무 조각도 없다 · 돌 칸은 들꽃 잔디 쪽으로 잔디가 번진다 · 꽃밭 쪽으로는 안 번진다', () => {
    eq(piecesOf('wildflower', 'snow', ''), []);
    eq(piecesOf('stone', '', '', Object.assign(all8('stone'), { '0,1': 'wildflower' })), ['fringe_grass_e2']);
    eq(piecesOf('stone', '', '', Object.assign(all8('stone'), { '0,1': 'tulipbed' })), []);
  });
  test('물 칸은 전과 같다 — 물가 8 다음에 잔디 번짐 8', () => eq(piecesOf('water', '', ''),
    ['n', 'e', 's', 'w', 'in_ne', 'in_nw', 'in_se', 'in_sw'].map(k => 'shore_' + k).concat(['n2', 'e2', 's2', 'w2', 'in_ne', 'in_nw', 'in_se', 'in_sw'].map(k => 'fringe_grass_' + k))));
  test("물려받은 이름('constructor')은 꽃밭이 아니다", () => eq(R._FLOOR_EDGE_COLOR.constructor, undefined));
} catch (e) {
  test('정원 바닥 색 코드를 돌릴 수 있다', () => { throw e; });
}

//  [DECO-EVENT-1] 계절 행사 날짜 — 표 한 줄씩 · 끝날 포함 · 그 밖은 없음
cur = '꾸미기 계절 행사 날짜(DECO-EVENT-1)';
try {
  const S = read('student.js'), a = S.indexOf('const DECO_EVENTS = ['), f = S.indexOf('function _decoEventNow('), b = S.indexOf('\n}\n', f);
  if (a < 0 || f < 0 || b < 0) throw new Error('DECO_EVENTS · _decoEventNow 를 못 찾음');
  const sb = {}; vm.createContext(sb);
  vm.runInContext(S.slice(a, S.indexOf('\n];\n', a) + 4) + NL + 'let _decoEventOv = null, _decoEventDev = null;' + NL + S.slice(f, b + 3) + ';globalThis.__E = { DECO_EVENTS, _decoEventNow };', sb);
  const E = sb.__E, at = (m, d) => (E._decoEventNow(new Date(2026, m - 1, d)) || {}).key || '';
  test('수확제 10/13 ~ 10/19(끝날 포함) · 앞뒤 날은 없음', () => eq([at(10, 12), at(10, 13), at(10, 19), at(10, 20)], ['', 'autumn', 'autumn', '']));
  test('벚꽃 4/1 ~ 4/7 · 물놀이 7/8 ~ 7/14 · 눈사람 12/15 ~ 12/21', () => eq([at(3, 31), at(4, 1), at(4, 7), at(4, 8), at(7, 7), at(7, 8), at(7, 14), at(7, 15), at(12, 14), at(12, 15), at(12, 21), at(12, 22)],
    ['', 'spring', 'spring', '', '', 'summer', 'summer', '', '', 'winter', 'winter', '']));
  test('오늘(9월 말)은 행사 없음', () => eq(at(9, 24), ''));
  test('행사 한 벌은 제 덩어리 안에(3×3 · 여름 3×2)', () => E.DECO_EVENTS.forEach(e => e.set.forEach(([id, r, c, w, h]) => eq(r >= 0 && c >= 0 && r + h <= e.h && c + w <= e.w, true, e.key + ':' + id))));
  test('그림 파일이 다 있다(주소 뒤 조각은 ev_lanterns 안 :target)', () => E.DECO_EVENTS.forEach(e => e.set.forEach(([id, , , , , frag]) => {
    const f = path.join(ROOT, 'assets', 'deco', id + '.svg'); eq(fs.existsSync(f), true, id);
    if (frag) eq(fs.readFileSync(f, 'utf8').includes('#' + frag + ':target'), true, id + '#' + frag);
  })));
} catch (e) {
  test('계절 행사 코드를 돌릴 수 있다', () => { throw e; });
}

//  [DECO-LOOK-0] 마당 모습 표 — 계절 넷 줄 · 여름 = 바탕 · 겨울만 눈 · 줄에 때가 박혀 있으면 실제 시각보다 먼저(별빛은 밤 고정)
cur = '꾸미기 마당 모습 표(DECO-LOOK-0)';
try {
  const S = read('student.js'), sb = { __sea: 'summer', __ph: 'day' };
  vm.createContext(sb);
  vm.runInContext('function _seaNow() { return globalThis.__sea; }' + NL + 'function _decoPhase() { return globalThis.__ph; }' + NL + LOOK_PRELUDE(S)
    + ';globalThis.__L = { YARD_LOOKS, YARD_LOOK_BASE, _yardLook, _yardPhase };', sb);
  const L = sb.__L;
  test('계절 넷 줄 · season 칸 = 제 이름', () => ['spring', 'summer', 'autumn', 'winter'].forEach(k => eq(L.YARD_LOOKS[k].season, k, k)));
  test('여름 줄 = 바탕(막 · 흩뿌림 · 눈 · 조각 없음 · 그림자 · 집 밑 땅 · 밭 모래는 기본값)', () => {
    const su = L.YARD_LOOKS.summer;
    eq([su.film, su.scatter, su.snow, su.groundFrag, su.waterFrag, su.bedWinter, su.ground, su.groundBg], ['', null, false, '', '', false, 'grass', '']);
    eq([su.shadow, su.houseGround, su.farmSand.join(',')], ['rgba(30,52,14,.30)', 'grass', '#c8a855,#b89545']);
  });
  test('겨울만 눈 · 꽃밭 겨울잠 · 얼음 물 · 눈 바탕', () => ['spring', 'summer', 'autumn'].forEach(k => {
    const r = L.YARD_LOOKS[k]; eq([r.snow, r.bedWinter, r.waterFrag, r.ground], [false, false, '', 'grass'], k);
  }) || eq((w => [w.snow, w.bedWinter, w.waterFrag, w.ground, w.groundBg])(L.YARD_LOOKS.winter), [true, true, 'winter', 'snow', '#eef3f8']));
  test('봄 · 가을만 막과 흩뿌림(봄 = 벚나무 꽃잎 · 가을 = 잎 나무 일곱 낙엽)', () => {
    eq([L.YARD_LOOKS.spring.scatter.name, L.YARD_LOOKS.spring.scatter.trees], ['season_petals_', ['d_y12']]);
    eq([L.YARD_LOOKS.autumn.scatter.name, L.YARD_LOOKS.autumn.scatter.trees.length], ['season_leaves_', 7]);
    eq([!!L.YARD_LOOKS.spring.film, !!L.YARD_LOOKS.autumn.film, !!L.YARD_LOOKS.winter.film], [true, true, false]);
  });
  test('해석기: 계절대로 줄 · 모르는 계절은 여름', () => {
    sb.__sea = 'autumn'; eq(L._yardLook(1), L.YARD_LOOKS.autumn);
    sb.__sea = '?'; eq(L._yardLook(1), L.YARD_LOOKS.summer); sb.__sea = 'summer';
  });
  test('줄은 고정 객체(부를 때마다 새로 만들지 않는다 — 칸마다 부르는 길)', () => eq(L._yardLook(1) === L._yardLook(2), true));
  test('별빛 줄: 계절 없음(여름 그림) · 남색 땅 · 풀 번짐·밑동 풀·물·헤엄 #star · 남색 그림자 · 눈·막·흩뿌림 없음', () => {
    const st = L.YARD_LOOKS.star;
    eq([st.season, st.ground, st.groundFrag, st.waterFrag, st.swimFrag, st.shadow], ['summer', 'star', 'star', 'star', 'star', 'rgba(8,10,34,.4)']);
    eq([st.snow, st.film, st.scatter, st.bedWinter], [false, '', null, false]);
  });
  test('별밤 칸(P5): 별빛 = 밤 고정 · 섬 · 하늘 · 이름표 막 위 / 막(.30 · 고르는 동안 .15) · 동물 필터는 계절 넷과 같다(#1088)', () => {
    const st = L.YARD_LOOKS.star;
    eq([st.phase, st.island, st.sky, st.labelOverFilm], ['night', true, true, true]);
    ['spring', 'summer', 'autumn', 'winter', 'star'].forEach(k => { const r = L.YARD_LOOKS[k];
      eq([r.nightFilm, r.nightFilmEdit, r.animNight], ['rgba(20,30,80,.30)', 'rgba(20,30,80,.15)', 'brightness(.8) saturate(.85)'], k); });
    ['spring', 'summer', 'autumn', 'winter'].forEach(k => { const r = L.YARD_LOOKS[k]; eq([r.phase, r.island, r.sky, r.labelOverFilm], ['', false, false, false], k); });
  });
  test('개발 스위치 ?look= — 놀이판(__PLAY + play-deco-none)에서만 · 다른 프로젝트 · 모르는 값은 무시(계절 줄)', () => {
    const run = (win, pid, search) => { sb.window = win; sb.firebase = { app: () => ({ options: { projectId: pid } }) }; sb.location = { search }; sb.URLSearchParams = URLSearchParams;
      vm.runInContext('_yardLookDev = null;', sb); const r = L._yardLook(1); delete sb.window; delete sb.firebase; delete sb.location; vm.runInContext('_yardLookDev = null;', sb); return r; };
    sb.__sea = 'autumn';
    eq(run({ __PLAY: {} }, 'play-deco-none', '?look=star'), L.YARD_LOOKS.star);
    eq(run({}, 'play-deco-none', '?look=star'), L.YARD_LOOKS.autumn);                 // 놀이판 표지 없음
    eq(run({ __PLAY: {} }, 'class-rpg-prod', '?look=star'), L.YARD_LOOKS.autumn);      // 다른 프로젝트
    eq(run({ __PLAY: {} }, 'play-deco-none', '?look=moon'), L.YARD_LOOKS.autumn);      // 모르는 줄
    eq(run({ __PLAY: {} }, 'play-deco-none', '?look=constructor'), L.YARD_LOOKS.autumn); // 물려받은 이름
    sb.__sea = 'summer';
  });
  test('때: 줄에 없으면 실제 시각 · 줄에 박혀 있으면 그것(별빛 = 밤 고정)', () => {
    sb.__ph = 'evening'; eq(L._yardPhase(1), 'evening');
    L.YARD_LOOKS.summer.phase = 'night'; eq(L._yardPhase(1), 'night'); L.YARD_LOOKS.summer.phase = ''; sb.__ph = 'day';
  });
} catch (e) {
  test('마당 모습 표 코드를 돌릴 수 있다', () => { throw e; });
}

//  [DECO-FLOOR-PICK-1] 바닥 고르기 — 저장값은 `_floorJoin` 한 곳. 지우개 판정이 글자 그대로 비교하므로 한 조합 = 한 글자여야 한다.
cur = '꾸미기 바닥 고르기(DECO-FLOOR-PICK-1)';
try {
  const S = read('student.js');
  const own = {};   // 가진 장식 id → 수(잠긴 색 문턱)
  const DECOS = [{ id: 'd_y1', k: 'plant' }, { id: 'd_y21', k: 'plant' }, { id: 'd_y43', k: 'plant' }, { id: 'd_y42', k: 'plant' }, { id: 'd_y41', k: 'plant' }, { id: 'd_y7', k: 'plant' },
    ...Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, k: 'plant' })), ...['d_y10', 'd_y20', 'd_y31', 'd_y59'].map(id => ({ id, k: 'water' })),
    { id: 'd_y6', k: 'prop' }, { id: 'd_y14', k: 'prop' }, ...Array.from({ length: 6 }, (_, i) => ({ id: 'a' + i, k: 'animal' })), ...Array.from({ length: 5 }, (_, i) => ({ id: 't' + i, k: 'tree' })),
    { id: 'hid', k: 'plant', hidden: true }, { id: 'w_h1', k: 'water', hidden: true }, { id: 'w_h2', k: 'water', hidden: true }];
  const sb = { GAME_DATA: { decorations: DECOS.map(d => ({ id: d.id, cat: 'yard', hidden: !!d.hidden, _k: d.k })) },
    _decoQtyOf: id => own[id] || 0, _decoShopKind: d => d._k };
  sb.globalThis = sb; vm.createContext(sb);
  const at = S.indexOf('const _FLOOR_COLORS = {'), end = S.indexOf(NL + '};', at);
  const eAt = S.indexOf('const _FLOOR_EDGE_COLOR = '), eEnd = S.indexOf(NL + '});', eAt);
  const fAt = S.indexOf('const FLOOR_TILES = {'), fEnd = S.indexOf(NL + '};', fAt);
  const arr = n => { const i = S.indexOf('const ' + n + ' = ['), j = S.indexOf(']];', i); if (i < 0 || j < 0) throw new Error(n + ' 표를 못 찾음'); return S.slice(i, j + 3) + NL; };
  vm.runInContext(SPACE_PRELUDE(S) + S.slice(at, end + 3) + NL + sliceConst(S, '_FLOOR_RIMS') + S.slice(eAt, eEnd + 4) + NL + S.slice(fAt, fEnd + 3) + NL
    + arr('_FLOOR_BASIC') + arr('_FLOOR_FAMS') + ['_floorJoin', '_floorHas', '_floorKindCount', '_floorLockWhy'].map(n => sliceFn(S, n)).join(NL) + NL
    + ';globalThis.__R = { _floorParse, _floorJoin, _floorLockWhy, _FLOOR_COLORS, _FLOOR_RIMS, _FLOOR_EDGE_COLOR, _FLOOR_BASIC, _FLOOR_FAMS, FLOOR_TILES };', sb);
  const R = sb.__R, J = R._floorJoin, P = R._floorParse;
  const combos = [];
  R._FLOOR_FAMS.forEach(([n]) => [''].concat(R._FLOOR_COLORS[n]).forEach(c => [''].concat(R._FLOOR_RIMS).forEach(m => combos.push([n, c, m]))));
  test('가족 칩 7개 = 정원 바닥 7종(순서: 튤립 · 세로 튤립 · 수국 · 라벤더 · 해바라기 · 데이지 · 들꽃)', () =>
    eq(R._FLOOR_FAMS.map(f => f[0]), ['tulipbed', 'tulipcol', 'hydrangea', 'lavender', 'sunflowerbed', 'daisyfield', 'wildflower']));
  test('기본 14바닥 = 옛 단추 순서 그대로 · 옛 바닥 표와 같은 14종', () => {
    eq(R._FLOOR_BASIC.map(b => b[0]), ['grass', 'dirt', 'dark_earth', 'stone', 'stone_floor', 'sand', 'gravel', 'brick', 'wood', 'water', 'flower', 'deck', 'dry_earth', 'gravel_yard']);
    eq(R._FLOOR_BASIC.map(b => b[0]).sort(), Object.keys(R.FLOOR_TILES).slice(0, 14).sort());
  });
  test('기본 색은 그림의 기본이라 색 표에 없다(저장값에 #기본색 이 생길 길이 없다)', () => R._FLOOR_FAMS.forEach(([n, , d]) => eq(R._FLOOR_COLORS[n].indexOf(d), -1, n + '#' + d)));
  test('만든 값을 해석하면 고른 그대로 · 다시 만들면 같은 글자(왕복)', () => combos.forEach(([n, c, m]) => {
    const v = J(n, c, m), p = P(v), m2 = R._FLOOR_EDGE_COLOR[n] ? m : '';
    eq([p.name, p.color, p.rim], [n, c, m2], v); eq(J(p.name, p.color, p.rim), v, v);
  }));
  test('한 조합 = 한 글자(겹침 없음) · 기본색이면 # 없음 · 자연이면 + 없음', () => {
    const vs = combos.filter(([n, , m]) => R._FLOOR_EDGE_COLOR[n] || !m).map(x => J(...x));
    eq(new Set(vs).size, vs.length);
    eq([J('tulipbed', '', ''), J('tulipbed', 'red', 'picket'), J('tulipcol', 'yellow', ''), J('hydrangea', '', 'stone'), J('hydrangea', 'pink', ''), J('lavender', '', 'brick'), J('daisyfield', '', ''), J('wildflower', 'rainbow', '')],
       ['tulipbed', 'tulipbed#red+picket', 'tulipcol#yellow', 'hydrangea+stone', 'hydrangea#pink', 'lavender+brick', 'daisyfield', 'wildflower#rainbow']);   // 규칙 문서 §4 표 그대로
  });
  test('붙을 수 없는 것은 떨어진다 — 기본색 이름 · 모르는 색 · 들꽃의 마감 · 옛 바닥의 색·마감 · 이상한 이름', () =>
    eq([J('tulipbed', 'pink', ''), J('hydrangea', 'blue', ''), J('tulipbed', 'nosuch', 'nosuch'), J('wildflower', 'snow', 'picket'), J('brick', 'red', 'stone'), J('', '', ''), J('Tulip#x', '', ''), J('constructor', 'red', 'picket')],
       ['tulipbed', 'hydrangea', 'tulipbed', 'wildflower#snow', 'brick', 'grass', 'grass', 'constructor']));
  const shut = n => [''].concat(R._FLOOR_COLORS[n]).filter(c => R._floorLockWhy(n, c));
  test('아무것도 없으면: 튤립은 분홍·노랑만 · 수국은 파랑만 · 들꽃은 기본만 · 라벤더·해바라기·데이지는 전부 열림', () => {
    eq(shut('tulipbed'), ['red', 'white', 'violet', 'orange', 'candy', 'sherbet', 'night']); eq(shut('tulipcol'), shut('tulipbed'));
    eq(shut('hydrangea'), ['violet', 'pink', 'white', 'duo', 'moon']); eq(shut('wildflower'), ['rainbow', 'snow']);
    ['lavender', 'sunflowerbed', 'daisyfield'].forEach(n => eq(shut(n), [], n));
  });
  test('문턱: 장미 하나 → 빨강 · 꽃·풀 8가지 → 사탕 · 물 2가지 → 수국 세 색 · 가로등 → 달빛 · 숨은 장식은 안 센다', () => {
    own.d_y43 = 1; eq(shut('tulipbed').indexOf('red'), -1);
    ['d_y1', 'd_y21', 'd_y42', 'd_y41', 'd_y7', 'p0'].forEach(id => { own[id] = 1; }); eq(shut('tulipbed'), ['candy', 'sherbet', 'night']);
    own.p1 = 1; eq(shut('tulipbed'), ['sherbet', 'night']);   // 8가지
    own.d_y10 = 1; own.d_y20 = 1; eq(shut('hydrangea'), ['duo', 'moon']); own.d_y6 = 1; eq(shut('hydrangea'), ['duo']);
    for (let i = 2; i < 10; i++) own['p' + i] = 1; eq(shut('tulipbed'), []);   // 전부 = 숨은 것 빼고 16가지
    eq(/지금 \d+가지/.test(R._floorLockWhy('wildflower', 'rainbow')), true);
  });
  test('[DECO-RETIRE-2] 상점에서 뺀 연못만 가진 아이 → 수국 물 색은 열린 그대로 · \'전부\'는 상점에 있는 것만 본다', () => {
    Object.keys(own).forEach(k => delete own[k]);
    eq(shut('hydrangea'), ['violet', 'pink', 'white', 'duo', 'moon']);
    own.w_h1 = 1; own.w_h2 = 1; eq(shut('hydrangea'), ['duo', 'moon']);                     // 숨긴 둘도 '가진 것'
    ['d_y10', 'd_y20', 'd_y31', 'd_y59'].forEach(id => { own[id] = 1; }); eq(shut('hydrangea'), ['moon']);   // 상점에 있는 물 넷 전부
    delete own.d_y59; eq(/1\/4|3\/4/.test(R._floorLockWhy('hydrangea', 'duo')), true);
  });
} catch (e) {
  test('바닥 고르기 코드를 돌릴 수 있다', () => { throw e; });
}

//  [DECO-FLOOR-RECT-1] ⬛ 네모로 — 시작 칸 ↔ 지금 칸 네모 · 상한(칸 수)을 넘으면 시작 칸 쪽으로 줄인다
cur = '꾸미기 바닥 네모로(DECO-FLOOR-RECT-1)';
try {
  const S = read('student.js');
  const sb = {}; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(sliceConst(S, 'DECO_RECT_MAX') + sliceFn(S, '_decoRectFrom') + ';globalThis.__R = { _decoRectFrom, DECO_RECT_MAX };', sb);
  const F = sb.__R._decoRectFrom, box = o => [o.r0, o.c0, o.r1, o.c1, o.w, o.h, o.capped];
  test('상한 = 400칸', () => eq(sb.__R.DECO_RECT_MAX, 400));
  test('어느 쪽으로 끌어도 같은 네모 · 한 칸도 네모', () => {
    eq(box(F(5, 5, 7, 9, 400)), [5, 5, 7, 9, 5, 3, false]);
    eq(box(F(7, 9, 5, 5, 400)), [5, 5, 7, 9, 5, 3, false]);
    eq(box(F(3, 3, 3, 3, 400)), [3, 3, 3, 3, 1, 1, false]);
  });
  test('상한을 넘으면 시작 칸에서 줄인다(칸 수 ≤ 상한) · 폭만 넘으면 한 줄', () => {
    const a = F(0, 0, 99, 99, 400); eq([a.w * a.h <= 400, a.r0, a.c0, a.capped], [true, 0, 0, true]);
    const b = F(50, 60, 0, 0, 400); eq([b.w * b.h <= 400, b.r1, b.c1, b.capped], [true, 50, 60, true]);   // 시작 칸(오른쪽 아래)은 늘 네모 안
    eq(box(F(0, 0, 0, 500, 400)), [0, 0, 0, 399, 400, 1, true]);
  });
} catch (e) {
  test('네모로 코드를 돌릴 수 있다', () => { throw e; });
}

cur = '꾸미기 친해지기 저장 칸(DECO-LIFE-1)';
try {
  const S = read('student.js');
  const sb = { DB: { _fbRef: { child: (p) => ({ update: (up) => { sb.__sent.push({ p, up }); return Promise.resolve(); } }) } }, __sent: [] };
  sb.globalThis = sb; vm.createContext(sb);
  const names = ['_lifeDay', '_lifeObj', '_lifeGet', '_lifeOk', '_lifeHearts', '_lifeStage', '_lifeNo', '_lifeFriendAt', '_lifeApply', '_lifeSend', '_lifeWrite', '_lifePet'];
  vm.runInContext(SPACE_PRELUDE(S) + sliceConst(S, 'LIFE_STAGE_AT') + 'let _lifeWrites = 0;' + NL + names.map(n => sliceFn(S, n)).join(NL)
    + ';globalThis.__L = { ' + names.join(', ') + ', writes: () => _lifeWrites };', sb);
  const L = sb.__L, day = L._lifeDay(Date.UTC(2026, 8, 24, 3)), T = d => (d - 0) * 86400000 - 9 * 3600000 + 3600000;   // T(일 번호) = 그날 한국 새벽 1시
  const kid = () => ({ id: 's1', houseDecorations: [{ id: 'd_y53', area: 'yard', row: 5, col: 9 }, { id: 'd_y55', area: 'yard', row: 7, col: 3 }] });
  test('없으면 빈 것 · 읽기만으로는 필드가 안 생긴다', () => {
    const k = kid(), g = L._lifeGet(k);
    eq([g.ro, g.c, Object.keys(g.a).length, Object.keys(g.g).length, 'decoLife' in k], [false, 0, 0, 0, false]);
  });
  test('모양이 틀린 칸은 없는 셈(배열 · 숫자 · null) · 지우지 않는다', () => {
    for (const bad of [[], 7, null, 'x', { a: [], g: 3, s: null, c: -4, p: 'x' }]) {
      const k = kid(); k.decoLife = bad; const g = L._lifeGet(k);
      eq([Object.keys(g.a).length, Object.keys(g.s).length, Object.keys(g.g).length, g.c, g.p], [0, 0, 0, 0, 0], JSON.stringify(bad));
      eq(JSON.stringify(k.decoLife), JSON.stringify(bad), '그대로');
    }
  });
  test('모르는 모양 번호(v:2)면 읽기 전용 — 쓰다듬어도 쓰기 0', () => {
    const k = kid(); k.decoLife = { v: 2, a: {} }; sb.__sent.length = 0;
    eq([L._lifeGet(k).ro, L._lifePet(k, k.houseDecorations[0], T(day)), sb.__sent.length], [true, null, 0]);
  });
  test('단계 문턱 0/3/7/12/20(보스 09-24 · 전 0/3/8/15/25)', () => {
    eq([0, 2, 3, 6, 7, 11, 12, 19, 20, 99].map(L._lifeStage), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  test('처음 쓰다듬기 = 새 친구 한 줄 · 잎 쓰기 1번(한 update) · 선 자리 · 하트 1', () => {
    const k = kid(); sb.__sent.length = 0;
    const r = L._lifePet(k, k.houseDecorations[0], T(day));
    eq([r.u, r.gained, r.stage], ['a1', 1, 1]);
    eq(k.decoLife.a.a1, { k: 'd_y53', r: 5, c: 9, m: day, h: 1, d: day });
    eq([k.decoLife.v, k.decoLife.c], [1, 2]);
    eq(sb.__sent.length, 1); eq(sb.__sent[0].p, 'students/s1');
    eq(Object.keys(sb.__sent[0].up).sort(), ['decoLife/a/a1', 'decoLife/c', 'decoLife/v']);
    eq(k.houseDecorations[0], { id: 'd_y53', area: 'yard', row: 5, col: 9 }, '자리 객체는 그대로');
  });
  test('같은 날 또 쓰다듬기 = 하트 그대로 · 쓰기 0 / 다음 날 = +1(서버 더하기)', () => {
    const k = kid(); L._lifePet(k, k.houseDecorations[0], T(day)); sb.__sent.length = 0;
    eq(L._lifePet(k, k.houseDecorations[0], T(day) + 5 * 3600000).gained, 0); eq(sb.__sent.length, 0);
    const r = L._lifePet(k, k.houseDecorations[0], T(day + 1));
    eq([r.gained, k.decoLife.a.a1.h, k.decoLife.a.a1.d], [1, 2, day + 1]);
    eq(sb.__sent[0].up['decoLife/a/a1/d'], day + 1);
    eq(Object.keys(sb.__sent[0].up).sort(), ['decoLife/a/a1/d', 'decoLife/a/a1/h']);
  });
  test('단계가 오르는 날 스티커 +1 · 사진 조각 +1 · 알림 신호(stageUp)', () => {
    const k = kid(); k.decoLife = { v: 1, c: 2, a: { a1: { k: 'd_y53', r: 5, c: 9, m: day - 9, h: 2, d: day - 1 } } };
    const r = L._lifePet(k, k.houseDecorations[0], T(day));
    eq([r.stage, r.stageUp, k.decoLife.a.a1.h, k.decoLife.g.sticker, k.decoLife.p], [2, true, 3, 1, 1]);   // 사진 조각도 하나(디자인 #1003)
  });
  test('옮기기(치우고 다른 자리에 놓기) = 쉬던 친구가 돌아온다 · 선 자리만 고침', () => {
    const k = kid(); k.decoLife = { v: 1, c: 3, a: { a1: { k: 'd_y53', r: 5, c: 9, m: day - 9, h: 6, d: day - 1, n: 2 }, a2: { k: 'd_y53', r: 1, c: 1, m: day - 3, h: 2, d: day - 1 } } };
    k.houseDecorations = [{ id: 'd_y53', area: 'yard', row: 12, col: 20 }];      // 둘 다 쉬는 친구 → 하트 많은 a1
    const r = L._lifePet(k, k.houseDecorations[0], T(day));
    eq([r.u, k.decoLife.a.a1.r, k.decoLife.a.a1.c, k.decoLife.a.a1.h, k.decoLife.a.a1.n], ['a1', 12, 20, 7, 2]);
    k.houseDecorations.push({ id: 'd_y53', area: 'yard', row: 2, col: 2 });      // 둘째 강아지 → 남은 쉬는 친구 a2
    eq(L._lifePet(k, k.houseDecorations[1], T(day)).u, 'a2');
  });
  test('다른 종류 · 다른 공간 자리는 짝이 아니다 · 친구 번호는 늘기만(빈 번호를 다시 안 씀)', () => {
    const k = kid(); k.decoLife = { v: 1, c: 5, a: { a4: { k: 'd_y53', r: 5, c: 9, sp: 2, h: 1, d: day - 1 } } };
    k.houseDecorations = [{ id: 'd_y53', area: 'yard', row: 5, col: 9, sp: 2 }, { id: 'd_y55', area: 'yard', row: 5, col: 9 }];
    eq(L._lifePet(k, k.houseDecorations[1], T(day)).u, 'a5');                   // 닭 — 강아지 친구와 짝 아님 · c=5 부터
    eq(L._lifeFriendAt(k, k.houseDecorations[0], L._lifeGet(k)), 'a4');          // 공간 2 의 강아지
  });
  test('모르는 칸은 보존 · 빈 것 왕복(친구 0 · 선물 0)', () => {
    const k = kid(); k.decoLife = { v: 1, future: { x: 1 } };
    L._lifePet(k, k.houseDecorations[0], T(day));
    eq(k.decoLife.future, { x: 1 });
    const e = kid(); e.decoLife = JSON.parse(JSON.stringify({ v: 1, a: {}, g: {} }));
    eq([Object.keys(L._lifeGet(e).a).length, L._lifeGet(e).ro], [0, false]);
  });
} catch (e) {
  test('친해지기 저장 코드를 돌릴 수 있다', () => { throw e; });
}

cur = '꾸미기 동물 카드 · 이름(DECO-LIFE-2)';
try {
  const S = read('student.js');
  const sb = {}; sb.globalThis = sb; vm.createContext(sb);
  const names = ['_lifeObj', '_lifeOk', '_lifeHearts', '_lifeStage', '_lifeNo', '_lifeNameOf', '_lifeHeartRow'];
  vm.runInContext(sliceConst(S, 'LIFE_STAGE_AT') + sliceConst(S, 'LIFE_NAMES_HIDDEN')
    + S.match(/^const LIFE_NAMES = \[[\s\S]*?\];/m)[0] + NL + names.map(n => sliceFn(S, n)).join(NL)
    + ';globalThis.__C = { ' + names.join(', ') + ', LIFE_NAMES };', sb);
  const C = sb.__C;
  test('이름 목록 40 · 번호 1 = 콩이 · 26 = 봄봄 · 40 = 해님(디자인 #969 순서)', () => eq([C.LIFE_NAMES.length, C.LIFE_NAMES[0], C.LIFE_NAMES[25], C.LIFE_NAMES[39]], [40, '콩이', '봄봄', '해님']));
  test('같은 이름은 처음 만난 순서로 숫자(저장 안 함) · 번호 밖은 이름 없음', () => {
    const L = { a: { a1: { k: 'd_y53', m: 30, n: 1 }, a2: { k: 'd_y53', m: 10, n: 1 }, a3: { k: 'd_y55', m: 5, n: 11 }, a4: { k: 'd_y55', m: 1, n: 99 }, a5: { k: 'd_y55', m: 1 } } };
    eq([C._lifeNameOf(L, 'a2'), C._lifeNameOf(L, 'a1'), C._lifeNameOf(L, 'a3'), C._lifeNameOf(L, 'a4'), C._lifeNameOf(L, 'a5')], ['콩이', '콩이 2', '꼬꼬', '', '']);
  });
  test('하트 칸 = 다음 단계까지 필요한 수(3 · 4 · 5 · 8 — #1022) · 가족은 다섯 칸 다 참', () => {
    const r = h => { const x = C._lifeHeartRow(h); return [x.st, x.have, x.need, x.left]; };
    eq([r(0), r(2), r(3), r(6), r(7), r(19), r(20), r(40)], [[1, 0, 3, 3], [1, 2, 3, 1], [2, 0, 4, 4], [2, 3, 4, 1], [3, 0, 5, 5], [4, 7, 8, 1], [5, 5, 5, 0], [5, 5, 5, 0]]);
  });
} catch (e) {
  test('동물 카드 코드를 돌릴 수 있다', () => { throw e; });
}

cur = '꾸미기 작은 선물(DECO-LIFE-3)';
try {
  const S = read('student.js');
  const sb = {}; sb.globalThis = sb; vm.createContext(sb);
  const names = ['_lifeOk', '_lifeObj', '_lifeHearts', '_lifeStage', '_lifeGiftKind', '_lifeGiftDay', '_lifeGiftOpen'];
  vm.runInContext(sliceConst(S, 'LIFE_STAGE_AT') + sliceConst(S, 'LIFE_GIFT_OF')
    + "const ANIM_DECO = { d_y55: { mood: 'hen' }, d_y32: { mood: 'duck' }, d_y57: { mood: 'sheep' }, d_y53: { mood: 'dog' }, d_y54: { mood: 'cat' }, d_y99: { mood: 'fox' } };" + NL
    + names.map(n => sliceFn(S, n)).join(NL) + ';globalThis.__G = { ' + names.join(', ') + ' };', sb);
  const G = sb.__G, days = (u, h) => Array.from({ length: 12 }, (_, i) => G._lifeGiftDay(u, { h }, 20700 + i)).filter(Boolean).length;
  test('선물 종류 — 닭 달걀 · 오리 오리알 · 양 양털 · 강아지 나뭇가지 · 고양이 털실 공 · 모르는 동물은 없음', () => eq(['d_y55', 'd_y32', 'd_y57', 'd_y53', 'd_y54', 'd_y99'].map(G._lifeGiftKind), ['egg', 'duck_egg', 'wool', 'stick', 'yarn', '']));
  test('빈도(보스 ②) — 1단계 없음 · 2단계 3일 · 3단계 2일 · 4단계 이상 매일(12일 중)', () => eq([days('a1', 0), days('a1', 3), days('a1', 8), days('a1', 15), days('a1', 25)], [0, 4, 6, 12, 12]));
  test('친구마다 날이 어긋난다(같은 2단계라도)', () => {
    const on = u => Array.from({ length: 3 }, (_, i) => G._lifeGiftDay(u, { h: 3 }, 20700 + i));
    eq(JSON.stringify(on('a1')) !== JSON.stringify(on('a2')) || JSON.stringify(on('a1')) !== JSON.stringify(on('a3')), true);
  });
  test('받은 날(gd = 오늘)이면 땅에 없다 · 다음 선물 날엔 다시', () => {
    eq([G._lifeGiftOpen('a1', { h: 20 }, 20700), G._lifeGiftOpen('a1', { h: 20, gd: 20700 }, 20700), G._lifeGiftOpen('a1', { h: 20, gd: 20700 }, 20701)], [true, false, true]);
  });
} catch (e) {
  test('선물 코드를 돌릴 수 있다', () => { throw e; });
}

cur = '꾸미기 그림 묶음(DECO-BUNDLE-1)';
try {
  const S = read('student.js');
  const mk = (fetchImpl) => {
    const sb = { Blob: class { constructor(p, o) { this.p = p; this.o = o; } }, URL: { createObjectURL: () => 'blob:art/' + (++sb.__n) }, __n: 0, __ready: 0, fetch: fetchImpl };
    sb.globalThis = sb; vm.createContext(sb);
    vm.runInContext(ART_PRELUDE(S) + 'function _artReady() { globalThis.__ready++; }' + NL + ';globalThis.__B = { _artStart, _artSrc, _artHas, _ART };', sb);
    return sb;
  };
  const flush = () => new Promise(r => setImmediate(r));
  let hold; const A = mk(() => new Promise(r => { hold = r; }));
  const loading = A.__B._artSrc('deco/d_y1.svg');
  hold({ ok: true, json: () => Promise.resolve({ v: 1, files: { 'deco/d_y1.svg': '<svg/>', 'floor/tile_water_a.svg': '<svg/>' } }) });
  await flush(); await flush(); await flush();
  const got = [A.__B._ART.state, A.__B._artSrc('deco/d_y1.svg'), A.__B._artSrc('deco/d_y1.svg'), A.__B._artSrc('floor/tile_water_a.svg', 'winter'), A.__B._artSrc('deco/없는 그림.svg'), A.__B._artHas('deco/d_y1_walk.svg'), A.__ready];
  const B = mk(() => Promise.reject(new Error('net')));
  B.__B._artSrc('deco/d_y1.svg'); await flush(); await flush(); await flush();
  const C = mk(() => Promise.resolve({ ok: false }));
  C.__B._artSrc('deco/d_y1.svg'); await flush(); await flush(); await flush();
  test('받는 중엔 null(부른 쪽은 기록을 안 남긴다) · 도착하면 다시 그리기 한 번', () => eq([loading, got[0], got[6]], [null, 'ready', 1]));
  test('묶음에 있으면 blob 주소 · 같은 그림은 같은 주소(한 번만 만든다) · #색은 뒤에 그대로', () => eq([got[1], got[2], got[3]], ['blob:art/1', 'blob:art/1', 'blob:art/2#winter']));
  test('묶음에 없는 그림은 낱장 파일 주소(이름은 주소용으로 바꿈) · 있나 = false', () => eq([got[4], got[5]], ['./assets/deco/' + encodeURIComponent('없는 그림.svg'), false]));
  test('받기 실패 · 404 면 꺼짐 → 늘 낱장 파일(예전 그대로)', () => eq([B.__B._ART.state, B.__B._artSrc('floor/tile_grass_a.svg', 'autumn'), C.__B._ART.state, C.__B._artHas('deco/d_y1.svg')], ['off', './assets/floor/tile_grass_a.svg#autumn', 'off', null]));
} catch (e) {
  test('그림 묶음 코드를 돌릴 수 있다', () => { throw e; });
}

// ═══════════════════════════════════════════════════════════════
const pass = results.filter(r => r.ok), fail = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.msg}`);
console.log(`\n요약: PASS ${pass.length} · FAIL ${fail.length}`);
console.log(`최종 결과: ${fail.length ? '❌ FAIL' : '✅ PASS'}`);
process.exit(fail.length ? 1 : 0);
