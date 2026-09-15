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
const pass = results.filter(r => r.ok), fail = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.msg}`);
console.log(`\n요약: PASS ${pass.length} · FAIL ${fail.length}`);
console.log(`최종 결과: ${fail.length ? '❌ FAIL' : '✅ PASS'}`);
process.exit(fail.length ? 1 : 0);
