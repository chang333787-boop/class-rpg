// 학습 범위 켜진 단원 시험 [UNIT-NEW-ON-1] · 영어 L9 문항 [ENGLISH-L9-1]
//  node scripts/unit/curriculum/active-units.test.mjs   (precheck 가 저절로 모은다)
//  선생님이 학습 범위를 저장해 둔 뒤에 들어온 단원(units 의 since)은 끄기 전까지 켜진 것으로 본다 — 저장하면(activeProblemUnitsAt) 그때 목록이 된다.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let S = {};
const ctx = { console, DB: { getSettings: () => S, getCustomProblems: () => [] } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'curriculum.js'), 'utf8').replace(/^const (\w+) =/gm, 'var $1 ='), ctx);
const CU = ctx.CurriculumUtils;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('❌', m); } };
const act = (st) => { S = st; const r = CU.activeUnitIds(); return r && [...r]; };

ok(act({}) === null && act({ activeProblemUnits: [] }) === null, '범위 없음 = 전체 허용(null)');
const old = act({ activeProblemUnits: ['ko4-1-1'] });   // 예전에 저장한 범위(저장한 때 모름)
ok(old.includes('ko4-1-1') && ['en4-2-7', 'en4-2-8', 'en4-2-9'].every(id => old.includes(id)), '저장한 때를 모르면 since 단원은 켜짐 ' + old);
ok(!old.includes('en4-1-1') && !old.includes('ko4-1-2'), 'since 없는 단원은 그대로 꺼짐');
const mid = act({ activeProblemUnits: ['ko4-1-1'], activeProblemUnitsAt: Date.parse('2026-10-06T09:00:00+09:00') });
ok(mid.includes('en4-2-9') && !mid.includes('en4-2-7') && !mid.includes('en4-2-8'), '10-06 저장 → 10-12 에 들어온 L9 만 켜짐 ' + mid);
const off = act({ activeProblemUnits: ['ko4-1-1'], activeProblemUnitsAt: Date.parse('2026-10-13T09:00:00+09:00') });
ok(off.length === 1 && off[0] === 'ko4-1-1', 'L9 가 들어온 뒤에 저장(=선생님이 봄)하면 목록 그대로 — 끈 단원은 꺼짐');
const dup = act({ activeProblemUnits: ['en4-2-9'] });
ok(dup.filter(x => x === 'en4-2-9').length === 1, '이미 켠 단원은 두 번 안 들어감');
S = {};
// L9 문항 — 65개 · 짜임 · 보기에 정답 · 듣기에 소리 · id 겹침 없음
const all = CU.allProblems(), l9 = CU.problemsByUnit('en4-2-9');
ok(l9.length === 65, 'L9 문항 65 · 실제 ' + l9.length);
ok(l9.filter(p => p.type === 'choice').length === 43 && l9.filter(p => p.type === 'short').length === 22, 'L9 보기 43 · 쓰기 22');
ok(l9.every(p => p.type !== 'choice' || (p.choices.length === 4 && p.choices.includes(p.a) && new Set(p.choices).size === 4)), 'L9 보기 4개 · 정답 포함 · 겹침 없음');
ok(l9.filter(p => p.cat === 'listen').every(p => p.audio) && l9.filter(p => p.cat === 'listen').length === 15, 'L9 듣기 15 · 모두 소리 글');
ok(l9.every(p => p.hint && p.q && [1, 2, 3].includes(p.level)), 'L9 힌트 · 물음 · 수준');
ok(l9.filter(p => p.type === 'short').every(p => CU.isCorrect(p, p.a) && (p.alt || []).every(x => CU.isCorrect(p, x))), 'L9 쓰기 정답 · 다른 답 모두 맞음');
ok(new Set(all.map(p => p.id)).size === all.length, '문제 은행 id 겹침 없음');
const u9 = CU.unitById('en4-2-9');
ok(u9 && u9.subjectKey === 'english' && u9.no === 9, '단원 en4-2-9 = 영어 9단원');
console.log(`학습 범위 켜진 단원 · 영어 L9 시험 — PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
