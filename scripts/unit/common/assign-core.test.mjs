// 과제 · 수업 규칙 시험 [CLASS-ASSIGN-1] — common/assign-core.js 의 순수 함수(브라우저 · 네트워크 · Firebase 없음)
//  node scripts/unit/common/assign-core.test.mjs   (precheck 가 저절로 모은다)
//  문제 은행(curriculum.js · curriculum_reading.js)을 vm 에 올려 2,516문항 전체로도 본다: 보기 채점 · 소리 말(itemLang) · 크기.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import '../../../common/assign-core.js';
import { readStudentSources } from '../student-sources.mjs';

const AC = globalThis.AssignCore;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb} · 실제 ${sa}`); };
//  씨앗 고정 난수(같은 씨앗 = 같은 차례)
const seeded = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };

// ── 문제 은행 · study.js 조각 ──
const bank = (() => {
  const sb = { console }; vm.createContext(sb);
  for (const f of ['curriculum.js', 'curriculum_reading.js']) vm.runInContext(read(f), sb, { filename: f });
  vm.runInContext('globalThis.__CU = CurriculumUtils; globalThis.__RP = READING_PASSAGES;', sb);
  return { CU: sb.__CU, all: sb.__CU.allProblems(), passages: sb.__RP };
})();
const study = (() => {
  const S = readStudentSources(ROOT);
  const slice = (name) => { const m = new RegExp(`^function ${name}\\s*\\(`, 'm').exec(S); if (!m) throw new Error('함수 없음 ' + name); let i = S.indexOf('{', m.index), d = 0; for (; i < S.length; i++) { if (S[i] === '{') d++; else if (S[i] === '}' && --d === 0) return S.slice(m.index, i + 1); } throw new Error('안 닫힘'); };
  const c = S.match(/^const DICTATION_STRICT_SPACING[^\n]*\n/m)[0];
  const sb = {}; vm.createContext(sb);
  vm.runInContext(c + slice('problemLang') + slice('dictationGrade') + ';globalThis.__x = { problemLang, dictationGrade };', sb);
  return sb.__x;
})();
const deps = { isCorrect: (p, v) => bank.CU.isCorrect(p, v), dictation: study.dictationGrade };

// ── 견본 ──
const T0 = 1_800_000_000_000;
const MIN = 60000;
const items = [
  { id: 'p1', unitId: 'ma4-1-1', type: 'choice', cat: 'calc', level: 1, q: '1+1?', choices: ['1', '2', '3', '4'], a: '2', hint: '' },
  { id: 'p2', unitId: 'ma4-1-1', type: 'number', cat: 'calc', level: 1, q: '2+3?', a: '5', hint: '' },
  { id: 'p3', unitId: 'so4-1-1', type: 'choice', cat: 'ox', level: 1, q: 'O?', choices: ['O', 'X'], a: 'O', hint: '' },
  { id: 'p4', unitId: 'en4-1-1', type: 'short', cat: 'vocab', level: 1, q: '"안녕"', a: 'hello', alt: ['hi'], hint: '' },
];
const mkDef = (over = {}) => AC.normDef({ id: 'aT1', kind: 'quiz', title: '견본', deliver: 'inbox', pacing: 'self',
  content: { quiz: { subject: 'math', items, passages: {}, src: { how: 'pick', units: [], n: 4 } } }, roster: { s1: '하늘', s2: '바다', s3: '구름' }, createdAt: T0, ...over }, 'aT1');

// ═════ 정의 모양 ═════
test('normDef — 이상한 값은 null(객체 아님 · 모르는 종류 · 문항 0 · id 다름)', () => {
  ok(AC.normDef(null) === null && AC.normDef('x') === null && AC.normDef([]) === null, '모양');
  ok(AC.normDef({ id: 'a1', kind: 'bomb', content: {} }, 'a1') === null, '종류');
  ok(AC.normDef({ id: 'a1', kind: 'quiz', content: { quiz: { items: [] } } }, 'a1') === null, '문항 0');
  ok(mkDef() && AC.normDef({ ...mkDef(), id: 'aOther' }, 'aT1') === null, 'id 다름');
});
test('normDef — 넘치는 것 자르기(제목 40 · 문항 30) · 위험 글자는 그대로(화면이 escape)', () => {
  const many = Array.from({ length: 45 }, (_, i) => ({ ...items[0], id: 'x' + i }));
  const d = AC.normDef({ id: 'a1', kind: 'quiz', title: 'ㄱ'.repeat(90) + '<img src=x onerror=1>', content: { quiz: { subject: 'math', items: many } } }, 'a1');
  ok(d.title.length === 40 && d.n === 30 && d.content.quiz.items.length === 30, `제목 ${d.title.length} · 문항 ${d.n}`);
  const d2 = AC.normDef({ id: 'a2', kind: 'quiz', title: '<b>"x"</b>', content: { quiz: { items: [{ ...items[0], q: '<script>1</script>' }] } } }, 'a2');
  ok(d2.title === '<b>"x"</b>' && d2.content.quiz.items[0].q === '<script>1</script>', '글자 그대로');
});
test('normDef — 보기 둘 미만 문항 빼기 · RTDB 가 배열을 객체로 줘도 같은 순서', () => {
  const d = AC.normDef({ id: 'a1', kind: 'quiz', content: { quiz: { items: { 1: items[1], 0: { ...items[0], choices: ['하나'] }, 2: items[2] } } } }, 'a1');
  eq(d.content.quiz.items.map(i => i.id), ['p2', 'p3']);
});
test('normDef — 받는 아이 · 명단 · 공개 시각 · 진행(한 문제씩은 문제 묶음만)', () => {
  const d = AC.normDef({ ...mkDef(), targets: ['s1', 'bad/key', 's2'], revealed: { q0: 5, zz: 9 }, pacing: 'step' }, 'aT1');
  eq(d.targets, ['s1', 's2']); eq(d.revealed, { q0: 5 }); ok(d.pacing === 'step', 'step');
  const c = AC.normDef({ id: 'a3', kind: 'coding', pacing: 'step', content: { coding: { stages: ['2-3', '2-4', '2-5', '2-6', 'x y'] } } }, 'a3');
  ok(c.pacing === 'self' && c.n === 3, `코딩 진행 ${c.pacing} · 판 ${c.n}`);
  const m = AC.normDef({ id: 'a4', kind: 'music', content: { music: { song: 'lib_nabiya', level: 'zz', tempo: 0.8, keys: 6 } } }, 'a4');
  eq(m.content.music, { song: 'lib_nabiya', level: 'easy', tempo: 0.8, keys: 6 });
  ok(AC.normDef({ id: 'a5', kind: 'music', content: { music: { song: '../x' } } }, 'a5') === null, '곡 id 검사');
});
test('isTarget — targets 없으면 반 모두 · 있으면 그 아이만', () => {
  ok(AC.isTarget(mkDef(), 's9'), '모두'); const d = mkDef({ targets: ['s1'] });
  ok(AC.isTarget(d, 's1') && !AC.isTarget(d, 's2') && !AC.isTarget(d, ''), '골라서');
});

// ═════ 문항 사본 · 자동 뽑기 ═════
test('snapItem — 보기는 섞되 같은 보기들 · OX 는 그대로 · 원본 안 바뀜', () => {
  const p = { ...items[0], choices: ['a', 'b', 'c', 'd'], a: 'c' }, before = JSON.stringify(p);
  const s = AC.snapItem(p, seeded(7));
  ok(JSON.stringify(p) === before, '원본 바뀜');
  ok([...s.choices].sort().join() === 'a,b,c,d' && s.choices.includes(s.a), '보기');
  eq(AC.snapItem(items[2], seeded(3)).choices, ['O', 'X'], 'OX');
});
test('pickSet — 같은 씨앗이면 같은 차례 · 단원을 고르게 · 겹침 0 · n > 풀이면 풀 전부', () => {
  const pool = ['u1', 'u2', 'u3'].flatMap(u => Array.from({ length: 6 }, (_, i) => ({ id: `${u}_${i}`, unitId: u })));
  const a = AC.pickSet(pool, 9, seeded(11)).map(p => p.id), b = AC.pickSet(pool, 9, seeded(11)).map(p => p.id);
  eq(a, b, '씨앗');
  const per = {}; for (const id of a) per[id.slice(0, 2)] = (per[id.slice(0, 2)] || 0) + 1;
  eq(Object.values(per).sort(), [3, 3, 3], '단원 고르게');
  ok(new Set(a).size === 9, '겹침');
  ok(AC.pickSet(pool.slice(0, 5), 20, seeded(1)).length === 5, 'n > 풀');
});
test('pickSet — 지문 세트는 많아야 하나 · 세트 문항은 연달아(은행 국어 4-1-1 단원)', () => {
  const pool = bank.CU.problemsByUnit('ko4-1-1');
  ok(pool.some(p => p.passageId), '견본 단원에 지문 문항이 있어야');
  for (let s = 1; s <= 40; s++) {
    const got = AC.pickSet(pool, 15, seeded(s));
    const sets = [...new Set(got.filter(p => p.passageId).map(p => p.passageId))];
    ok(sets.length <= 1, `씨앗 ${s}: 지문 세트 ${sets.length}`);
    if (sets.length) { const idx = got.map((p, i) => p.passageId ? i : -1).filter(i => i >= 0); ok(idx[idx.length - 1] - idx[0] === idx.length - 1, `씨앗 ${s}: 세트가 떨어짐`); }
    ok(new Set(got.map(p => p.id)).size === got.length, '겹침');
  }
});
test('자동 뽑기 = 반 전체 같은 문제 · 같은 보기 차례(보낼 때 한 번 → 정의 하나를 25명이 읽음)', () => {
  const pool = bank.CU.problemsBySubject('math');
  const picked = AC.pickSet(pool, 10, Math.random).map(p => AC.snapItem(p, Math.random));
  const def = AC.normDef({ id: 'aAuto', kind: 'quiz', content: { quiz: { subject: 'math', items: picked } } }, 'aAuto');
  const wire = JSON.stringify(def);
  const seen = new Set(Array.from({ length: 25 }, () => JSON.stringify(AC.normDef(JSON.parse(wire), 'aAuto').content.quiz.items)));
  ok(seen.size === 1 && def.n === 10, `아이마다 다른 문제 ${seen.size}`);
});

// ═════ 채점 ═════
test('grade — 보기는 번호로 · 보기 글자 그대로(===) 견줌', () => {
  const it = AC.normItem(items[0]);
  eq(AC.grade(it, { ci: 1 }, deps), { a: '2', ci: 1, ok: true });
  ok(AC.grade(it, { ci: 0 }, deps).ok === false && AC.grade(it, { ci: 9 }, deps) === null && AC.grade(it, {}, deps) === null, '틀림 · 범위 밖');
});
test('grade — 은행 보기 1,532문항: 정답 보기만 맞음 · 공백만 다른 보기(17문항)의 오답 43개가 정답으로 안 셈', () => {
  let ch = 0, wrongOk = 0, spaceItems = 0, spaceWrong = 0, isCorrectWrongOk = 0;
  for (const p of bank.all) {
    if (p.type !== 'choice') continue; ch++;
    const it = AC.normItem(p);
    const ns = p.choices.map(c => AC.normAns(c));
    const spaced = new Set(ns).size !== ns.length;
    if (spaced) spaceItems++;
    p.choices.forEach((c, ci) => {
      const r = AC.grade(it, { ci }, deps);
      if (c === p.a) ok(r.ok, `${p.id} 정답 보기가 오답`);
      else { if (r.ok) wrongOk++; if (spaced) { spaceWrong++; if (bank.CU.isCorrect(p, c)) isCorrectWrongOk++; } }
    });
  }
  ok(ch === 1532 && wrongOk === 0, `보기 ${ch} · 오답이 정답 ${wrongOk}`);
  ok(spaceItems === 17 && isCorrectWrongOk === 43, `공백만 다른 보기 문항 ${spaceItems} · isCorrect 로는 오답이 정답 ${isCorrectWrongOk}(이 시험이 막는 것)`);
});
test('grade — 글 · 수 · 분수는 isCorrect(단위 · 값 같은 분수) · 받아쓰기는 dictationGrade(띄어쓰기는 점수 밖)', () => {
  ok(AC.grade(AC.normItem(items[1]), { v: '5개' }, deps).ok, '단위');
  const fr = AC.normItem(bank.all.find(p => p.type === 'fraction' && p.a === '3/5'));
  ok(AC.grade(fr, { v: '6/10' }, deps).ok && !AC.grade(fr, { v: '2/5' }, deps).ok, '분수');
  const dict = AC.normItem(bank.all.find(p => p.cat === 'dictation'));
  ok(AC.grade(dict, { v: dict.a.replace(/ /g, '') }, deps).ok, '받아쓰기 띄어쓰기');
  ok(AC.grade(AC.normItem(items[1]), { v: '   ' }, deps) === null, '빈 답');
});
test('grade — 영어 글 답: 한글이 섞이면 채점 안 함(blocked) · 둥근 따옴표는 곧은 따옴표로', () => {
  const en = AC.normItem(items[3]);
  eq(AC.grade(en, { v: 'ㅗ디ㅣㅐ' }, deps), { blocked: 'hangul' });
  ok(AC.grade(en, { v: 'Hi' }, deps).ok, 'alt');
  const ap = AC.normItem(bank.all.find(p => p.unitId.startsWith('en') && p.type === 'short' && /'/.test(p.a)) || { ...items[3], id: 'pa', a: "I'm fine" });
  const curly = ap.a.replace(/'/g, '’');
  ok(AC.grade(ap, { v: curly }, deps).ok, `둥근 따옴표 ${curly}`);
  ok(AC.grade(AC.normItem({ ...items[1], unitId: 'ma4-1-1' }), { v: '오' }, deps).ok === false, '영어가 아니면 한글 답도 그냥 채점');
});
test('itemLang = study.js problemLang (은행 2,516문항 전체)', () => {
  let n = 0; for (const p of bank.all) { if (AC.itemLang(AC.normItem(p)) !== study.problemLang(p)) throw new Error(p.id); n++; }
  ok(n === 2516, '문항 수 ' + n);
});

// ═════ 교사 기기 연결 · 덮개 ═════
const LIVE = (over = {}) => ({ on: true, aid: 'aT1', kind: 'quiz', pacing: 'self', step: 0, phase: 'run', startedAt: T0, resumeAt: T0, endsAt: T0 + 40 * MIN, rev: 1, ...over });
const H = (...iv) => Object.fromEntries(iv.map(([at, left], k) => ['c' + k, left == null ? { on: true, at } : { on: false, at, left }]));
test('liveState — 꺼짐 · 정의 없음 · 대상 아님 · 빠짐 · 시간 지남', () => {
  const d = mkDef({ targets: ['s1'] }), hosts = H([T0 - MIN]);
  eq(AC.liveState(null, d, 's1', { now: T0 }).why, 'off');
  eq(AC.liveState(LIVE({ on: false }), d, 's1', { now: T0 }).why, 'off');
  eq(AC.liveState(LIVE(), null, 's1', { now: T0, hosts }).why, 'noDef');
  eq(AC.liveState(LIVE(), d, 's2', { now: T0, hosts }).why, 'notTarget');
  eq(AC.liveState(LIVE(), d, 's1', { now: T0, hosts, excused: true }).why, 'excused');
  eq(AC.liveState(LIVE(), d, 's1', { now: T0 + 41 * MIN, hosts }).why, 'expired');
  eq(AC.liveState(LIVE(), d, 's1', { now: T0 + 5 * MIN, hosts }), { show: true, why: 'ok', endsAt: T0 + 40 * MIN, gapNow: 0 });
});
test('liveState — 교사 기기가 모두 끊김: 2분 → 덮개(기다림) · 4분 → 풀림 · 돌아오면 다시 덮음(빈 틈 < 15분)', () => {
  const d = mkDef();
  const left = H([T0 - MIN, T0 + 10 * MIN]);
  eq(AC.liveState(LIVE(), d, 's1', { now: T0 + 12 * MIN, hosts: left }).why, 'waitHost');
  eq(AC.liveState(LIVE(), d, 's1', { now: T0 + 14 * MIN, hosts: left }).why, 'hostAway');
  const back = H([T0 - MIN, T0 + 10 * MIN], [T0 + 18 * MIN]);
  eq(AC.liveState(LIVE(), d, 's1', { now: T0 + 19 * MIN, hosts: back }).why, 'ok');
});
test('liveState — 판정은 데이터(서버 시각)만 본다: 늦게 로그인 · 새로고침한 아이도 같은 답(3분을 다시 세지 않음)', () => {
  const d = mkDef(), hosts = H([T0 - MIN, T0 + 10 * MIN]);
  const a = AC.liveState(LIVE(), d, 's1', { now: T0 + 14 * MIN, hosts }), b = AC.liveState(LIVE(), d, 's2', { now: T0 + 14 * MIN, hosts });
  eq(a, b); eq(a.why, 'hostAway');
});
test('liveState — TV 를 먼저 켜고 → 시작 → 관리 닫기 → 3분 뒤에도 덮개 유지(TV 가 host)', () => {
  const hosts = { tv: { on: true, at: T0 - 30 * MIN }, adm: { on: false, at: T0 - 5 * MIN, left: T0 + 2 * MIN } };
  eq(AC.liveState(LIVE(), mkDef(), 's1', { now: T0 + 6 * MIN, hosts }).why, 'ok');
});
test('liveState — 15분 넘게 빈 수업 = 멈춘 수업: 교사가 돌아와도 저절로 안 덮음 · 이어 하기(resumeAt) 뒤에만 다시', () => {
  const d = mkDef(), hosts = H([T0 - MIN, T0 + 5 * MIN], [T0 + 30 * MIN]);
  eq(AC.liveState(LIVE({ endsAt: T0 + 90 * MIN }), d, 's1', { now: T0 + 31 * MIN, hosts }).why, 'stale');
  eq(AC.liveState(LIVE({ endsAt: T0 + 90 * MIN, resumeAt: T0 + 31 * MIN }), d, 's1', { now: T0 + 32 * MIN, hosts }).why, 'ok');
  eq(AC.liveState(LIVE({ endsAt: T0 + 90 * MIN }), d, 's1', { now: T0 + 25 * MIN, hosts: H([T0 - MIN, T0 + 5 * MIN]) }).why, 'stale', '아직 안 돌아옴도 멈춤');
});
test('liveState — host 기록이 아예 없으면 시작부터 셈 · 안전 끝은 시작 뒤 120분까지만(장난 값)', () => {
  eq(AC.liveState(LIVE(), mkDef(), 's1', { now: T0 + 2 * MIN, hosts: null }).why, 'waitHost');
  eq(AC.liveState(LIVE(), mkDef(), 's1', { now: T0 + 4 * MIN, hosts: {} }).why, 'hostAway');
  ok(AC.endsAtOf(LIVE({ endsAt: T0 + 9e9 })) === T0 + 120 * MIN, '120분');
});
test('[ASSIGN-LIVE-APPS-1] 스위치 — LIVE_APPS 비어 있음(보스 결정 10-05) · 수업으로 못 여는 학습 앱은 덮지 않음(appOff) · 기본 안전 시간 45분', () => {
  eq(AC.LIVE_APPS, [], '코딩 · 리듬은 과제함으로만');
  ok(Object.isFrozen(AC.LIVE_APPS), '고정');
  ok(AC.isLiveKind('quiz') && !AC.isLiveKind('coding') && !AC.isLiveKind('music') && !AC.isLiveKind('x'), 'isLiveKind');
  const hosts = H([T0]);
  const c = AC.normDef({ id: 'aT1', kind: 'coding', content: { coding: { stages: ['2-3'] } } }, 'aT1');
  const m = AC.normDef({ id: 'aT1', kind: 'music', content: { music: { song: 'lib_sola' } } }, 'aT1');
  eq(AC.liveState(LIVE({ kind: 'coding' }), c, 's1', { now: T0 + MIN, hosts }).why, 'appOff');
  eq(AC.liveState(LIVE({ kind: 'music' }), m, undefined, { now: T0 + MIN, hosts }).show, false, '로그인 화면 띠도 안 뜸');
  eq(AC.liveState(LIVE(), mkDef(), 's1', { now: T0 + MIN, hosts }).why, 'ok', '문제 묶음은 그대로');
  eq(AC.MIN_DEFAULT, 45);
  const st = AC.ctl.start(mkDef(), {}, T0)(null);
  eq(st.endsAt - st.startedAt, 45 * MIN, '분을 안 주면 45분');
});
test('[ASSIGN-AVG-1] avgOf · avgText — 문제 묶음 = 끝낸 아이 점수 · 기초 코딩 = 시작한 아이 푼 판 · 리듬 = 끝까지 친 아이 정확도', () => {
  const q = mkDef();
  const tq = { rows: [{ status: 'done', correct: 3, total: 4 }, { status: 'none' }], avg: 75 };
  eq(AC.avgText(q, tq, '아이'), '끝낸 아이 평균 75점');
  const c = AC.normDef({ id: 'aC', kind: 'coding', content: { coding: { stages: ['2-3', '2-4', '2-5'] } } }, 'aC');
  const tc = { rows: [{ status: 'done', correct: 3 }, { status: 'doing', correct: 1 }, { status: 'none', correct: 0 }], avg: 100 };
  eq(AC.avgOf(c, tc), { v: 2, n: 2, of: 3 }, '안 한 아이는 빼고 · 끝낸 아이만이면 늘 3');
  eq(AC.avgText(c, tc, '친구'), '시작한 친구 푼 판 평균 2 / 3');
  const m = AC.normDef({ id: 'aM', kind: 'music', content: { music: { song: 'lib_sola' } } }, 'aM');
  const tm = { rows: [{ status: 'done', detail: { best: { acc: 100 } } }, { status: 'done', detail: { best: { acc: 56.3 } } }, { status: 'doing', detail: { best: { acc: 99 } } }], avg: 78 };
  eq(AC.avgText(m, tm), '끝까지 친 아이 정확도 평균 78.2%', '끝까지 친 판만 · 소수 한 자리');
  eq(AC.avgText(m, { rows: [{ status: 'none' }] }), '', '아무도 없으면 빈 글');
  eq(AC.avgOf(null, tm), null);
});
test('[ASSIGN-END-INBOX-2] endPlan — 못 한 아이 과제함으로(기본 켬) · 모두 다 했으면 닫기 · 과제함에서 돌린 수업은 원래대로', () => {
  const left = { rows: [{ status: 'done' }, { status: 'doing' }] }, all = { rows: [{ status: 'done' }, { status: 'done' }] };
  eq(AC.endPlan({}, left, true), 'inbox');
  eq(AC.endPlan({}, all, true), 'close', '모두 다 함');
  eq(AC.endPlan({ fromInbox: true }, all, true), 'back');
  eq(AC.endPlan({ fromInbox: true }, left, false), 'back', '칸 끔 + 과제함에서 돌림');
  eq(AC.endPlan({}, left, false), 'close', '칸 끔');
  eq(AC.endPlan(null, null, true), 'close', '셈 없음');
});
test('liveScreen — 각자: 안 푼 첫 문항 · 다 하면 done(정리면 summary 표시)', () => {
  const d = mkDef(), cell = { answers: { q0: { a: '2', ok: true, at: T0 } } };
  eq(AC.liveScreen(LIVE(), d, cell), { view: 'self', i: 1 });
  const full = { answers: { q0: {}, q1: {}, q2: {}, q3: {} } };
  eq(AC.liveScreen(LIVE({ phase: 'summary' }), d, full), { view: 'done', i: -1, summary: true });
});
test('liveScreen — 한 문제씩: lobby · ask · sent · reveal · summary', () => {
  const d = mkDef({ pacing: 'step' }), L = (step, phase) => LIVE({ pacing: 'step', step, phase });
  eq(AC.liveScreen(L(-1, 'lobby'), d, {}).view, 'lobby');
  eq(AC.liveScreen(L(1, 'answer'), d, {}), { view: 'ask', i: 1 });
  eq(AC.liveScreen(L(1, 'answer'), d, { answers: { q1: { a: '5' } } }), { view: 'sent', i: 1 });
  eq(AC.liveScreen(L(1, 'reveal'), d, {}), { view: 'reveal', i: 1 });
  eq(AC.liveScreen(L(4, 'summary'), d, {}).view, 'summary');
});
test('canAnswer — 과제함은 안 낸 문항 · 한 문제씩은 그 문항이 묻는 중일 때만 · 이미 낸 것은 안 됨', () => {
  const d = mkDef({ pacing: 'step' }), L = (step, phase) => LIVE({ pacing: 'step', step, phase });
  ok(AC.canAnswer('inbox', null, d, {}, 2), '과제함');
  ok(!AC.canAnswer('inbox', null, d, { answers: { q2: { a: 'x' } } }, 2), '이미 냄');
  ok(AC.canAnswer('live', L(2, 'answer'), d, {}, 2) && !AC.canAnswer('live', L(2, 'reveal'), d, {}, 2) && !AC.canAnswer('live', L(1, 'answer'), d, {}, 2), '묻는 중만');
  ok(!AC.canAnswer('live', { ...L(2, 'answer'), aid: 'zz' }, d, {}, 2) && !AC.canAnswer('inbox', null, d, {}, 7), '다른 수업 · 범위 밖');
});

// ═════ 쓰기 모양 ═════
test('answerPatch — 결과 칸 · 내 숙달도 칸 아래 경로만 · startedAt 은 없을 때만 · doneAt 은 다 찼을 때만', () => {
  const d = mkDef(), TS = { '.sv': 'timestamp' };
  const p0 = AC.answerPatch(d, 's1', null, 0, { a: '2', ci: 1, ok: true }, { TS, date: '2026-10-06' });
  eq(Object.keys(p0).sort(), ['mine/s1/aT1/q/q0', 'mine/s1/aT1/s', 'results/aT1/s1/answers/q0', 'results/aT1/s1/startedAt']);
  eq(p0['results/aT1/s1/answers/q0'], { a: '2', ok: true, at: TS, ci: 1 });
  eq(p0['mine/s1/aT1/q/q0'], { p: 'p1', u: 'ma4-1-1', c: true, d: '2026-10-06' });
  const cell = { startedAt: 5, answers: { q0: {}, q1: {}, q2: {} } };
  const p3 = AC.answerPatch(d, 's1', cell, 3, { a: 'hello', ok: true }, { TS, date: '2026-10-06' });
  ok('results/aT1/s1/doneAt' in p3 && !('results/aT1/s1/startedAt' in p3), 'doneAt');
  ok(Object.keys(p3).every(k => k.startsWith('results/aT1/s1/') || k.startsWith('mine/s1/aT1/')), '남의 칸');
});
test('answerPatch — 이미 낸 문항 · 범위 밖 · 이상한 아이 id 는 null · 건너뛰기는 숙달도에 안 넣음', () => {
  const d = mkDef();
  ok(AC.answerPatch(d, 's1', { answers: { q1: {} } }, 1, { a: '5', ok: true }) === null, '이미 냄');
  ok(AC.answerPatch(d, 's1', {}, 4, { a: '5', ok: true }) === null && AC.answerPatch(d, 'a/b', {}, 0, { a: '5' }) === null, '범위 · id');
  const sk = AC.answerPatch(d, 's1', {}, 1, { a: '', ok: true, skip: true }, { date: '2026-10-06' });
  eq(sk['results/aT1/s1/answers/q1'].ok, false); ok(sk['results/aT1/s1/answers/q1'].skip === true, 'skip');
  ok(!Object.keys(sk).some(k => k.startsWith('mine/')), '건너뛰기가 숙달도에');
});

// ═════ 교사 진행(transaction) ═════
test('ctl.start — 수업 중이면 그만(undefined) · 아니면 켬(한 문제씩은 lobby) · 안전 시간 10~120분', () => {
  const d = mkDef({ pacing: 'step' });
  ok(AC.ctl.start(d, { minutes: 40 }, T0)(LIVE()) === undefined, '두 관리 탭이 동시에 시작 → 하나만');
  const s = AC.ctl.start(d, { minutes: 999 }, T0)(null);
  ok(s.on && s.aid === 'aT1' && s.step === -1 && s.phase === 'lobby' && s.endsAt === T0 + 120 * MIN && s.resumeAt === T0, JSON.stringify(s));
  const s2 = AC.ctl.start(mkDef(), { minutes: 1 }, T0)({ on: false, rev: 4 });
  ok(s2.phase === 'run' && s2.endsAt === T0 + 10 * MIN && s2.rev === 5, JSON.stringify(s2));
});
test('ctl.next · prev · reveal — 본 단계일 때만(관리와 TV 가 같은 순간 눌러도 한 칸) · 공개한 문항으로 가면 공개 화면', () => {
  const n = 4, L = (step, phase, rv) => LIVE({ pacing: 'step', step, phase, revealAt: rv });
  eq(AC.ctl.next('aT1', -1, 'lobby', n, T0)(L(-1, 'lobby')).step, 0);
  const a = AC.ctl.next('aT1', 0, 'answer', n, T0), first = a(L(0, 'answer'));
  ok(first.step === 1 && first.phase === 'answer', '다음');
  ok(a(first) === undefined, '두 번째 기기는 그만');
  const r = AC.ctl.reveal('aT1', 1, T0 + 5)(L(1, 'answer', { q0: T0 }));
  ok(r.phase === 'reveal' && r.revealAt.q1 === T0 + 5 && r.revealAt.q0 === T0, '공개 시각');
  ok(AC.ctl.reveal('aT1', 1, T0 + 9)(r) === undefined, '두 번 공개');
  const p = AC.ctl.prev('aT1', 1, 'reveal')(r);
  ok(p.step === 0 && p.phase === 'reveal', '앞(공개된 문항) ' + JSON.stringify(p));
  const nx = AC.ctl.next('aT1', 0, 'reveal', n, T0)(p);
  ok(nx.step === 1 && nx.phase === 'reveal', '이미 공개한 문항으로 다음 → 공개 화면(정답 본 뒤 다시 묻지 않음)');
  eq(AC.ctl.next('aT1', 3, 'reveal', n, T0)(L(3, 'reveal')).phase, 'summary');
});
test('ctl.end — 그 수업일 때만 · aid 없으면 무엇이든 끔(장난 수업도 늘 끝냄) · extend · resume', () => {
  ok(AC.ctl.end('zz', T0)(LIVE()) === undefined, '다른 수업');
  const e = AC.ctl.end('', T0 + 1)(LIVE({ aid: 'prank' }));
  ok(e.on === false && e.endedAt === T0 + 1, '끔');
  ok(AC.ctl.extend('aT1', 10, T0)(LIVE()).endsAt === T0 + 50 * MIN, '10분 더');
  const rs = AC.ctl.resume('aT1', T0 + 60 * MIN)(LIVE());
  ok(rs.resumeAt === T0 + 60 * MIN && rs.endsAt >= T0 + 80 * MIN, '이어 하기 ' + JSON.stringify(rs));
});

// ═════ 셈 ═════
const R = {
  s1: { startedAt: T0, answers: { q0: { a: '2', ci: 1, ok: true, at: T0 + 1000 }, q1: { a: '5', ok: true, at: T0 + 2000 }, q2: { a: 'X', ci: 1, ok: false, at: T0 + 3000 }, q3: { a: 'hi', ok: true, at: T0 + 9000 } } },
  s2: { answers: { q0: { a: '3', ci: 2, ok: false, at: T0 + 1500 }, q1: { a: '6', ok: false, at: T0 + 2500 } } },
  s4: { answers: { q0: { a: '3', ci: 2, ok: false, at: T0 + 1700 }, q1: { a: ' 6 ', ok: false, at: T0 + 2600 } } },
  s5: { answers: { q0: { a: '1', ci: 0, ok: false, at: T0 + 99000 } } },   // 공개 뒤 도착
  s6: { answers: { q0: { a: '', ok: false, skip: true, at: T0 + 1000 } } },
};
const roster = [{ sid: 's3', name: '구름' }, { sid: 's1', name: '하늘' }, { sid: 's2', name: '바다' }, { sid: 's4', name: '별님' }, { sid: 's5', name: '나무' }, { sid: 's6', name: '해' }];
test('summarize — 상태는 답에서(doneAt 없어도 다 냈으면 끝) · 점수 분모 = 문항 수 · 걸린 시간 = 처음 연 때 ~ 마지막 답', () => {
  const d = mkDef();
  const a = AC.summarize(d, R.s1); ok(a.status === 'done' && a.correct === 3 && a.total === 4 && a.ms === 9000, JSON.stringify(a));
  const b = AC.summarize(d, R.s2); ok(b.status === 'doing' && b.answered === 2 && b.ms === null, JSON.stringify(b));
  ok(AC.summarize(d, undefined).status === 'none' && AC.summarize(d, { startedAt: 3 }).status === 'doing', '안 함 · 열어 봄');
});
test('itemStats — 보기별 수 · 가장 많이 고른 오답(2명 이상 · 같으면 앞 보기) · 늦게 낸 답과 건너뛰기는 빼기', () => {
  const d = mkDef({ revealed: { q0: T0 + 50000 } });
  const s = AC.itemStats(d, R, 0, roster.map(x => x.sid));
  eq(s.dist.map(x => x.c), [0, 1, 2, 0]); ok(s.n === 3 && s.ok === 1 && s.late === 1 && s.skip === 1, JSON.stringify(s));
  eq(s.topWrong, { ci: 2, v: '3', c: 2 }); ok(s.rate === 33, 'rate ' + s.rate);
  const one = AC.itemStats(d, { s2: R.s2 }, 0, ['s2']); ok(one.topWrong === null && one.rate === null, '1명 · 3명 미만');
});
test('itemStats — 글 · 수 답은 normAns 로 묶어 많은 차례 셋', () => {
  const s = AC.itemStats(mkDef(), R, 1, roster.map(x => x.sid));
  eq(s.wrongTop, [{ v: '6', c: 2 }]); eq(s.topWrong, { v: '6', c: 2 });
});
test('tally — 명단 차례 그대로(점수 차례 아님) · 안 한 아이도 줄 · 명단 밖 결과는 따로 · 빠진 아이 셈', () => {
  const t = AC.tally(mkDef(), { ...R, sX: R.s2 }, roster, { excused: { s3: true } });
  eq(t.rows.map(r => r.sid), ['s3', 's1', 's2', 's4', 's5', 's6']);
  ok(t.rows[0].status === 'none' && t.outside.length === 1 && t.outside[0].sid === 'sX', '안 함 · 명단 밖');
  eq(t.counts, { none: 0, doing: 4, done: 1, excused: 1 });
  ok(t.avg === 75 && t.items.length === 4, `평균 ${t.avg}`);
});
test('tally — targets 가 있으면 그 아이들만 줄', () => {
  const t = AC.tally(mkDef({ targets: ['s1', 's2'] }), R, roster);
  eq(t.rows.map(r => r.sid), ['s1', 's2']);
});

// ═════ 숙달도 ═════
const mine = {
  aB: { s: 'math', q: { q0: { p: 'p1', u: 'ma4-1-1', c: true, d: '2026-10-06' }, q1: { p: 'p2', u: 'ma4-1-1', c: false, d: '2026-10-06' }, q2: { p: 'p9', u: 'ma4-1-2', c: false, d: '2026-10-07' } } },
  aA: { s: 'korean', q: { q0: { p: 'k1', u: 'ko4-1-1', c: true, d: '2026-10-05' } } },
  bad: 'x',
};
test('masteryRecords — 오늘의 학습 기록과 같은 모양 · 과제 · 날짜마다 한 건 · id = prob_<날짜>_<sid>_asg_<aid>', () => {
  const r = AC.masteryRecords(mine, 's1');
  eq(r.map(x => x.id), ['prob_2026-10-05_s1_asg_aA', 'prob_2026-10-06_s1_asg_aB', 'prob_2026-10-07_s1_asg_aB']);
  const b = r[1];
  eq(Object.keys(b).sort(), ['answers', 'assign', 'correct', 'date', 'id', 'review', 'studentId', 'subjectKey', 'total', 'unitId', 'wrongIds']);
  eq(b.answers, [{ problemId: 'p1', unitId: 'ma4-1-1', correct: true }, { problemId: 'p2', unitId: 'ma4-1-1', correct: false }]);
  ok(b.total === 2 && b.correct === 1 && b.wrongIds[0] === 'p2' && b.review === false, JSON.stringify(b));
});
test('masteryRecords — 기존 기록 키 차례에 섞임: 과제 기록 10건이 있어도 \'최근 8건\'이 날짜 차례(최근 학습 오답이 안 밀림)', () => {
  const study = ['2026-10-01', '2026-10-08', '2026-10-09'].map((d, k) => ({ id: `prob_${d}_s1_17${k}0000000000`, date: d, wrongIds: ['w' + d] }));
  const asg = {}; for (let k = 0; k < 10; k++) asg['a0' + k] = { s: 'math', q: { q0: { p: 'x' + k, u: 'ma4-1-1', c: false, d: '2026-10-0' + (k % 7 + 1) } } };
  const all = study.concat(AC.masteryRecords(asg, 's1')).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const recent = all.slice(-8).map(r => r.date);
  ok(recent.includes('2026-10-08') && recent.includes('2026-10-09'), '최근 학습 기록이 밀림: ' + recent.join(','));
  ok(recent.every((d, i) => i === 0 || recent[i - 1] <= d), '날짜 차례 아님: ' + recent.join(','));
});

// ═════ 크기 ═════
test('크기 — 과제 정의(10문항 + 지문 + 명단 25) ≤ 6KB · 결과 칸(10문항) ≤ 1KB · 숙달도 칸 ≤ 0.8KB', () => {
  const pool = bank.CU.problemsByUnit('ko4-1-1');
  const pick = AC.pickSet(pool, 10, seeded(5)).map(p => AC.snapItem(p, seeded(5)));
  const pids = [...new Set(pick.map(p => p.passageId).filter(Boolean))];
  const passages = Object.fromEntries(pids.map(id => { const x = bank.passages.find(p => p.id === id); return [id, { id, title: x.title, text: x.text }]; }));
  const rosterObj = Object.fromEntries(Array.from({ length: 25 }, (_, i) => ['s17' + String(i).padStart(11, '0'), '학생이름' + i]));
  const def = AC.normDef({ id: 'amg9x0k2q7fq', kind: 'quiz', title: '국어 · 1단원 10문제', content: { quiz: { subject: 'korean', items: pick, passages } }, roster: rosterObj, createdAt: T0 }, 'amg9x0k2q7fq');
  const dk = JSON.stringify(def).length / 1024;
  let cell = {}, mineE = { s: 'korean', q: {} };
  for (let i = 0; i < 10; i++) {
    const it = def.content.quiz.items[i];
    const p = AC.answerPatch(def, 's1728000000000', cell, i, { a: (it.choices ? it.choices[0] : it.a).slice(0, 80), ci: it.choices ? 0 : undefined, ok: true }, { TS: T0 + i, date: '2026-10-06' });
    cell = { ...cell, startedAt: T0, answers: { ...(cell.answers || {}), ['q' + i]: p[`results/amg9x0k2q7fq/s1728000000000/answers/q${i}`] } };
    mineE.q['q' + i] = p[`mine/s1728000000000/amg9x0k2q7fq/q/q${i}`];
  }
  const ck = JSON.stringify(cell).length / 1024, mk = JSON.stringify(mineE).length / 1024;
  ok(dk <= 6 && ck <= 1 && mk <= 0.8, `정의 ${dk.toFixed(2)}KB · 결과 ${ck.toFixed(2)}KB · 숙달도 ${mk.toFixed(2)}KB`);
  console.log(`  크기: 정의 ${dk.toFixed(2)}KB · 결과 칸 ${ck.toFixed(2)}KB · 숙달도 칸 ${mk.toFixed(2)}KB`);
});
test('경로 — 모두 classRPG_assign 아래 · 학생 기록(classRPG_v3)에는 쓰지 않는다', () => {
  ok(AC.ROOT === 'classRPG_assign' && AC.path.full(AC.path.result('a', 's')) === 'classRPG_assign/results/a/s', '경로');
  const src = read('common/assign-core.js');
  ok(!/classRPG_v3/.test(src.replace(/\/\/[^\n]*/g, '')), 'classRPG_v3 를 코드에서 씀');
});
test('클래식 · 모듈 겸용 — 최상위 선언 0(전역 겹침 영향 0) · 두 번 읽어도 같은 것', () => {
  const src = read('common/assign-core.js');
  ok(/^\(function \(g\) \{/m.test(src) && !/^(?:const|let|var|function|class)\s/m.test(src), '최상위 선언');
  const sb = {}; vm.createContext(sb); vm.runInContext(src, sb); vm.runInContext(src, sb);
  ok(sb.AssignCore && Object.isFrozen(sb.AssignCore), '클래식으로 읽기');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`과제 · 수업 규칙 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
