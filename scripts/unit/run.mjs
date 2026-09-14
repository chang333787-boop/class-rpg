#!/usr/bin/env node
// 우리반 성장 RPG — 순수 함수 단위 테스트 (read-only, 앱 코드 수정 없음)
//
//  · scripts/smoke-test.mjs(구조·HTTP)와 별개. smoke 기준선(28)은 건드리지 않는다.
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
const pass = results.filter(r => r.ok), fail = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.msg}`);
console.log(`\n요약: PASS ${pass.length} · FAIL ${fail.length}`);
console.log(`최종 결과: ${fail.length ? '❌ FAIL' : '✅ PASS'}`);
process.exit(fail.length ? 1 : 0);
