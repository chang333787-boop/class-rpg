#!/usr/bin/env node
// 꾸미기 그림 묶음 (DECO-BUNDLE-1 · 보스 결정 09-24 ⑥ — 폴더는 밑줄 없이 bundle/, 밑줄은 Jekyll 이 배포에서 뺀다)
//
//  assets/deco · assets/floor · assets/farm 의 SVG 를 한 파일(assets/deco/bundle/art.json)로 묶는다.
//  학생 화면은 꾸미기를 열 때 이 한 파일을 받아 필요한 그림만 blob 주소로 쓴다(요청 65건 → 1건 · 압축 약 155KB).
//  묶음이 없거나 낡았으면 화면은 예전처럼 낱장 파일을 부른다(깨지지 않는다) — 그래도 낡은 묶음은 precheck 가 FAIL 로 막는다.
//
//  사용: node scripts/deco-bundle.mjs           → 다시 만든다(그림을 고친 PR 은 이것까지 같이 올린다)
//        node scripts/deco-bundle.mjs --check   → 그림과 묶음이 같은지(precheck) · 다르면 exit 1
//  줄바꿈은 LF 로 맞춰 넣는다 — 학교 Windows(CRLF)에서 만들어도 같은 묶음이 나온다.
//  몇 번 만들어도 같은 결과(키 정렬 · 한 줄에 한 그림 · 시각·무작위 0) — 그래서 묶음에서 충돌이 나면 손으로 합치지 않고
//  main 을 받은 뒤 이 스크립트를 다시 돌리면 끝이다(보스 09-24).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['deco', 'floor', 'farm'];
const OUT = path.join(ROOT, 'assets', 'deco', 'bundle', 'art.json');
const CHECK = process.argv.includes('--check');

function build() {
  const files = {};
  for (const d of DIRS) {
    const dir = path.join(ROOT, 'assets', d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.svg')).sort()) {
      if (f.startsWith('_')) continue;   // 밑줄 파일은 배포에 없다(Jekyll)
      files[d + '/' + f] = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n?/g, '\n');
    }
  }
  //  한 줄에 한 그림 — 그림 한 장이 바뀌면 그 줄만 바뀐다(검토 · 충돌이 그림 단위)
  const text = '{"v":1,"files":{\n' + Object.keys(files).map(k => JSON.stringify(k) + ':' + JSON.stringify(files[k])).join(',\n') + '\n}}\n';
  return { files, text };
}

const { files, text } = build();
const n = Object.keys(files).length, kb = Math.round(Buffer.byteLength(text) / 1024);
if (!CHECK) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`그림 묶음을 만들었어요: ${path.relative(ROOT, OUT)} · ${n}장 · ${kb}KB`);
  process.exit(0);
}
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n?/g, '\n') : '';
if (old === text) { console.log(`요약: PASS · 그림 묶음 ${n}장 · ${kb}KB · 그림과 같음`); process.exit(0); }
let prev = {};
try { prev = JSON.parse(old).files || {}; } catch (e) {}
const diff = [];
for (const k of Object.keys(files)) if (prev[k] !== files[k]) diff.push((k in prev ? '바뀜 ' : '새로 ') + k);
for (const k of Object.keys(prev)) if (!(k in files)) diff.push('빠짐 ' + k);
for (const line of diff.slice(0, 12)) console.log('  ' + line);
if (diff.length > 12) console.log(`  … 그 밖에 ${diff.length - 12}장`);
console.log(`요약: FAIL · 그림이 바뀌었는데 묶음이 옛것(${old ? diff.length + '장 다름' : '묶음 파일 없음'}) → \`node scripts/deco-bundle.mjs\` 한 번 → assets/deco/bundle/art.json 을 같이 커밋`
  + ' · 묶음에서 충돌이 나면 손으로 합치지 말고 main 을 받은 뒤 이 스크립트를 다시 돌리면 끝');
process.exit(1);
