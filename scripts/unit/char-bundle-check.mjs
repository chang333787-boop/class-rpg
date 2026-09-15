// assets/char/all.json 이 assets/char/*.svg 84장과 같은지 검사 (CHAR-BUNDLE-1)
//   실행: node scripts/unit/char-bundle-check.mjs   → 다르면 FAIL(묶음이 낡음: node scripts/char-bundle.mjs 로 다시 만들 것)
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'assets', 'char');
const names = [];
for (let i = 1; i <= 4; i++) names.push('base_' + i);
for (let i = 1; i <= 30; i++) names.push('body_e_b' + i);
for (let i = 1; i <= 10; i++) names.push('head_e_h' + i, 'glove_e_g' + i, 'shoe_e_s' + i, 'weapon_e_w' + i, 'weapon_e_ws' + i);
let pass = 0, fail = 0;
const p = join(dir, 'all.json');
if (!existsSync(p)) { console.log('FAIL all.json 없음'); process.exit(1); }
const j = JSON.parse(readFileSync(p, 'utf8'));
for (const n of names) {
  const svg = readFileSync(join(dir, n + '.svg'), 'utf8').replace(/\r\n/g, '\n');
  if (j[n] === svg) pass++; else { fail++; console.log('FAIL 묶음과 다름:', n); }
}
const extra = Object.keys(j).filter(k => !names.includes(k));
if (extra.length) { fail++; console.log('FAIL 묶음에 남는 키:', extra.join(',')); }
console.log(`요약: PASS ${pass} · FAIL ${fail}`);
console.log(fail ? '최종 결과: 🔴 FAIL — node scripts/char-bundle.mjs 로 all.json 다시 만들 것' : '최종 결과: ✅ PASS');
process.exit(fail ? 1 : 0);
