#!/usr/bin/env node
// 캐릭터 모습 층 검사 (CHAR-LOOK-0, 2026-10-12)
//  student/char.js 의 composeCharBase 로 charType 1~4 기본 모습을 합쳐, 옛 한 장(assets/char/base_N.svg)과
//  **글자 하나까지 같은지** 본다. 층(lk_body·lk_hair_*)이나 base_N 을 고치면 둘이 어긋나지 않게 이 검사로 막는다.
//  + 모든 조합(피부×머리×머리색×눈×입)이 자리표시({{…}}) 없이 합쳐지는지.
//  실행: node scripts/unit/char-look-check.mjs   (어긋나면 exit 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'student/char.js'), 'utf8');
const code = src.slice(src.indexOf('const _CHAR_SVG'), src.indexOf('// 화면이 쓰는 입구')).replace(/try \{ loadCharDolls\(\); \}[^\n]*\n/, '');
const M = new Function('CUR', 'fetch', 'document', code + '\nreturn {_CHAR_SVG,_charInner,_charFileNames,composeCharBase,charLookOf,CHAR_LOOK,buildCharDoll};')(null, null, null);
for (const n of M._charFileNames()) {
  const f = path.join(ROOT, 'assets/char', n + '.svg');
  if (fs.existsSync(f)) M._CHAR_SVG[n] = M._charInner(fs.readFileSync(f, 'utf8'));
}
let fail = 0;
for (let ct = 1; ct <= 4; ct++) {
  const a = M.composeCharBase(M.charLookOf({ charType: ct })), b = M._CHAR_SVG['base_' + ct];
  if (a === b) console.log(`✅ PASS   charType ${ct} 층 합성 = base_${ct}.svg`);
  else {
    fail++;
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log(`❌ FAIL   charType ${ct} 층 합성 ≠ base_${ct}.svg (글자 ${i}: …${a.slice(i - 20, i + 40)}… vs …${b.slice(i - 20, i + 40)}…)`);
  }
}
const L = M.CHAR_LOOK; let n = 0, bad = 0;
for (const skin in L.skin) for (const hair in L.hair) for (const hairColor in L.hairColor) for (const eye in L.eye) for (const mouth in L.mouth) {
  n++;
  const out = M.composeCharBase({ skin, hair, hairColor, eye, mouth });
  if (!out || /\{\{|\}\}/.test(out)) { bad++; if (bad < 4) console.log(`❌ FAIL   ${skin}/${hair}/${hairColor}/${eye}/${mouth} 자리표시 남음`); }
}
if (bad) fail++; else console.log(`✅ PASS   조합 ${n}가지 모두 자리표시 없이 합쳐짐`);
const junk = M.charLookOf({ charType: 2, look: { skin: 'zz', hair: 'long', hairColor: 9 } });
if (junk.skin === 's2' && junk.hair === 'long' && junk.hairColor === 'purple') console.log('✅ PASS   모르는 look 값은 기본값으로');
else { fail++; console.log('❌ FAIL   모르는 look 값 처리', JSON.stringify(junk)); }
console.log(`\n최종 결과: ${fail ? '❌ FAIL ' + fail : '✅ PASS'}`);
process.exit(fail ? 1 : 0);
