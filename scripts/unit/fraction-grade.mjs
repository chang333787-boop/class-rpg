// [FRACTION-INPUT-1] 분수 입력칸 채점 회귀 — node scripts/unit/fraction-grade.mjs
//   값이 같은 다른 모양(가분수·받아올림 안 함·크기가 같은 분수)은 FRACTION_REQUIRE_MIXED=false면 정답, true면 오답.
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'curriculum.js'), 'utf8');
function load(requireMixed) {
  const ctx = { window: {}, console }; vm.createContext(ctx);
  const code = requireMixed ? src.replace('const FRACTION_REQUIRE_MIXED = false;', 'const FRACTION_REQUIRE_MIXED = true;') : src;
  vm.runInContext(code + '\n;this.U = CurriculumUtils; this.P = BASE_PROBLEMS;', ctx);
  return ctx;
}
const CASES = [ // [정답, 입력, 모양, 기본(false)일 때 정답?]
  ['4와 2/5', '4와 2/5', 'exact', true], ['4와 2/5', '4 2/5', 'exact', true], ['4와 2/5', '4과2/5', 'exact', true],
  ['4와 2/5', '22/5', 'equal', true], ['4와 2/5', '3과 7/5', 'equal', true], ['4와 2/5', '4와 4/10', 'equal', true],
  ['4와 2/5', '4와 3/5', 'wrong', false], ['4와 2/5', '2/5', 'wrong', false], ['3/6', '1/2', 'equal', true],
  ['3/6', '3/7', 'wrong', false], ['3/5', '３/５', 'exact', true], ['3/5', '3/0', 'wrong', false], ['3/5', '', 'wrong', false],
];
let fail = 0;
for (const mixed of [false, true]) {
  const { U, P } = load(mixed);
  for (const [a, u, form, okDefault] of CASES) {
    const p = { type: 'fraction', a };
    const want = mixed ? form === 'exact' : okDefault;
    const got = U.isCorrect(p, u), gotForm = U.fractionMatch(p, u);
    if (got !== want || gotForm !== form) { fail++; console.log(`FAIL mixed=${mixed} a=${a} u=${u} → ${got}/${gotForm}, 기대 ${want}/${form}`); }
  }
  const fr = P.filter(p => p.type === 'fraction');
  if (!fr.length || !fr.every(p => U.isCorrect(p, p.a))) { fail++; console.log(`FAIL mixed=${mixed} 분수 문항 자기 정답`); }
}
console.log(fail ? `❌ fraction-grade FAIL ${fail}` : `✅ fraction-grade PASS (${CASES.length}×2 + 문항 자기 정답)`);
process.exit(fail ? 1 : 0);
