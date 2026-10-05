// 오늘의 학습 고르기 채점 시험 [CHOICE-SPACING-1] — 문제 은행 전체(교과·보충·지문)로
//  ① 정답 보기는 언제나 정답 ② 정답과 다른 보기는 어떤 것도 정답으로 세지 않는다(띄어쓰기만 다른 보기 포함)
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ctx = { console }; vm.createContext(ctx);
for (const f of ['curriculum.js', 'curriculum_review.js', 'curriculum_reading.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^const (\w+) =/gm, 'var $1 ='), ctx);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('❌', m); } };
let n = 0, wrongAsRight = 0, rightRejected = 0;
for (const arr of [ctx.BASE_PROBLEMS, ctx.REVIEW_PROBLEMS, ctx.READING_ITEMS]) for (const p of arr || []) {
  if (p.type !== 'choice' || !Array.isArray(p.choices)) continue; n++;
  const a = String(p.a).trim().replace(/\s+/g, ' ');
  for (const c of p.choices) {
    const same = String(c).trim().replace(/\s+/g, ' ') === a;
    const got = ctx.CurriculumUtils.isCorrect(p, c);
    if (same && !got) { rightRejected++; if (rightRejected <= 3) console.log('  정답 보기를 틀렸다고 함:', p.id, c); }
    if (!same && got && !(p.alt || []).some(x => String(x).trim().replace(/\s+/g, ' ') === String(c).trim().replace(/\s+/g, ' '))) { wrongAsRight++; if (wrongAsRight <= 3) console.log('  오답 보기를 맞다고 함:', p.id, JSON.stringify(c), '정답', JSON.stringify(p.a)); }
  }
}
ok(n > 1500, `고르기 문항 수 ${n}`);
ok(rightRejected === 0, `정답 보기를 틀렸다고 한 수 ${rightRejected}`);
ok(wrongAsRight === 0, `오답 보기를 맞다고 한 수 ${wrongAsRight}(띄어쓰기만 다른 보기 포함)`);
// 대표 사례 — 국어 띄어쓰기
const p = { type: 'choice', a: '할 수 있다', choices: ['할 수 있다', '할수 있다', '할수있다', '할 수있다'] };
ok(ctx.CurriculumUtils.isCorrect(p, '할 수 있다') && ctx.CurriculumUtils.isCorrect(p, ' 할  수 있다 '), '정답(앞뒤·여러 칸 공백은 봐줌)');
ok(!ctx.CurriculumUtils.isCorrect(p, '할수 있다') && !ctx.CurriculumUtils.isCorrect(p, '할수있다'), '띄어쓰기가 다른 보기는 오답');
// 짧은 답·수 입력은 예전처럼 공백을 봐줌
ok(ctx.CurriculumUtils.isCorrect({ type: 'short', a: '대한민국' }, '대한 민국'), '짧은 답은 공백 무시(그대로)');
ok(ctx.CurriculumUtils.isCorrect({ type: 'number', a: '35' }, '35 명'), '수 입력 단위·공백(그대로)');
console.log(`오늘의 학습 고르기 채점 시험 — PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
