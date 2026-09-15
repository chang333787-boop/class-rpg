// 캐릭터 종이인형 84장 → assets/char/all.json 한 장 (CHAR-BUNDLE-1)
//   실행: node scripts/char-bundle.mjs   (assets/char/*.svg 를 고친 뒤 반드시 다시 실행)
//   형식: { "base_1": "<svg …>…</svg>", … } — student.js loadCharDolls 가 1회 fetch 로 받아 _charInner 로 벗긴다.
//   묶음이 없거나 깨지면 loadCharDolls 는 84장 개별 fetch 로 폴백한다(코드 쪽 규칙).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'assets', 'char');
const names = [];
for (let i = 1; i <= 4; i++) names.push('base_' + i);
for (let i = 1; i <= 30; i++) names.push('body_e_b' + i);
for (let i = 1; i <= 10; i++) names.push('head_e_h' + i, 'glove_e_g' + i, 'shoe_e_s' + i, 'weapon_e_w' + i, 'weapon_e_ws' + i);
const out = {};
let missing = 0;
for (const n of names) {
  const p = join(dir, n + '.svg');
  if (!existsSync(p)) { missing++; console.warn('없음:', n); continue; }
  out[n] = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}
const json = JSON.stringify(out);
writeFileSync(join(dir, 'all.json'), json);
console.log(`all.json: ${Object.keys(out).length}장, ${json.length.toLocaleString()} B, 누락 ${missing}`);
if (missing) process.exit(1);
