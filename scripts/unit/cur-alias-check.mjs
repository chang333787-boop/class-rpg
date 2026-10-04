#!/usr/bin/env node
// 우리반 성장 RPG — CUR 별칭 검사 (CUR-ALIAS-CHECK-1, read-only)
//
//  왜: [SYNC-MERGE-2] 받은 판마다 학생은 **새 객체**다(gamedata.js _stuAdopt). 자기 저장 뒤에도 곧(마이크로태스크)
//      스냅샷이 와서 student.js onDataChange 가 `CUR = DB.getStudent(id)` 로 CUR 을 새 객체로 바꾼다.
//      그래서 한 함수에서
//         const s = CUR;   →   await / setTimeout / .then …   →   s.gold += 7;  …  DB.saveStudent(CUR)
//      처럼 **비동기 경계를 건넌 뒤 옛 별칭(s)을 고치면**, 그 고침은 새 CUR 로 저장할 때 안 나간다(검토 #7 · 실제 SDK 로 재현).
//      (옛 객체를 DB.saveStudent(옛 객체)로 저장하면 gamedata 가 이은 객체로 넘겨 주긴 하지만, 화면 코드는 대개 CUR 을 저장한다.)
//      `const prev = CUR; CUR = 친구; … CUR = prev;`(친구 마당 그리기)도 되돌리기가 비동기 뒤면 옛 학생으로 되돌린다.
//  규칙: 비동기 경계 뒤에는 CUR 을 다시 읽어 고칠 것. 별칭은 경계 앞에서만 쓴다.
//  무엇: student.js + student/*.js 의 맨 앞 칸 `function` 마다, `X = CUR` 별칭 뒤에 비동기 경계가 있고 그 뒤에
//        X 를 고치거나(X.칸 = · += · ++ · push…) 저장하거나(saveStudent(X)) `CUR = X` 로 되돌리는 줄이 있으면 적는다.
//  한계: 정적 검사(줄 단위·글자 모양). 함수를 건너가는 별칭(인자로 넘긴 CUR)·안쪽 함수의 범위는 못 가린다 — 넓게 잡아 사람이 본다.
//        --baseline N: N 곳까지는 기존 것으로 보고 넘기고(기본 0 = 2026-10-04 main), 늘면 FAIL.
//
//  사용: node scripts/unit/cur-alias-check.mjs [--baseline N] [--list]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studentScriptFiles } from './student-sources.mjs';

const ROOT = process.env.CUR_ALIAS_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // 시험용 폴더(run.mjs)
const argv = process.argv.slice(2);
const bi = argv.indexOf('--baseline');
const BASELINE = bi >= 0 ? Number(argv[bi + 1]) : 0;

const TOP_HEAD = /^(?:async\s+)?function\s+([\w$]+)\s*\(/;
const TOP_END = /^\};?\s*$/;
const ALIAS = /(?:\b(?:const|let|var)\s+|^\s*|[;,]\s*)([A-Za-z_$][\w$]*)\s*=\s*CUR\s*(?:[;,)]|$)/;
const ASYNC = /\bawait\b|\bsetTimeout\s*\(|\bsetInterval\s*\(|\.then\s*\(|\brequestAnimationFrame\s*\(|\baddEventListener\s*\(|\bnew\s+Promise\s*\(|\.onload\s*=|\.onerror\s*=|\bqueueMicrotask\s*\(/;

//  줄 끝 // 주석을 걷는다(따옴표 안의 // 는 남긴다 — 앞쪽 따옴표 수가 짝수일 때만 주석으로 본다)
function stripComment(line) {
  for (let i = line.indexOf('//'); i >= 0; i = line.indexOf('//', i + 2)) {
    const before = line.slice(0, i);
    const q = (ch) => (before.split(ch).length - 1) % 2;
    if (!q("'") && !q('"') && !q('`')) return before;
  }
  return line;
}
const esc = (s) => s.replace(/[$]/g, '\\$');
function usesAfter(x, text) {
  const X = esc(x);
  const pats = [
    new RegExp(`(?<![\\w$.])${X}(?:\\.[\\w$]+|\\[[^\\]]+\\])+\\s*(?:=(?!=)|\\+=|-=|\\*=|/=|\\|\\|=|&&=|\\?\\?=|\\+\\+|--)`),
    new RegExp(`(?<![\\w$.])${X}(?:\\.[\\w$]+)+\\.(?:push|splice|unshift|pop|shift|sort|reverse)\\s*\\(`),
    new RegExp(`\\bsaveStudent\\s*\\(\\s*${X}\\s*[,)]`),
    new RegExp(`(?<![\\w$.])CUR\\s*=\\s*${X}\\s*(?:[;,)]|$)`),
  ];
  return pats.some(p => p.test(text));
}

const found = [];
let aliases = 0, funcs = 0;
for (const file of studentScriptFiles(ROOT)) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const h = TOP_HEAD.exec(lines[i]);
    if (!h) continue;
    let j = i + 1;
    while (j < lines.length && !TOP_END.test(lines[j])) j++;
    funcs++;
    const body = lines.slice(i, j + 1).map(stripComment);
    for (let a = 0; a < body.length; a++) {
      const m = ALIAS.exec(body[a]);
      if (!m || m[1] === 'CUR') continue;
      aliases++;
      const x = m[1];
      // 별칭 줄의 나머지부터 비동기 경계를 찾고, 그 경계 뒤(같은 줄 나머지 + 뒤 줄)에서 별칭을 고치는지 본다
      for (let b = a; b < body.length; b++) {
        const seg = b === a ? body[b].slice(m.index + m[0].length) : body[b];
        const am = ASYNC.exec(seg);
        if (!am) continue;
        const rest = [seg.slice(am.index)].concat(body.slice(b + 1)).join('\n');
        if (usesAfter(x, rest)) {
          const k = body.slice(b).findIndex((l, n) => usesAfter(x, n === 0 ? seg.slice(am.index) : l));
          found.push({ file, fn: h[1], alias: x, aliasLine: i + a + 1, asyncLine: i + b + 1, useLine: i + b + Math.max(k, 0) + 1 });
        }
        break;   // 첫 경계만 본다(그 뒤 고침이면 이미 위험)
      }
    }
    i = j;
  }
}

console.log(`CUR 별칭 검사 — 학생 코드 ${studentScriptFiles(ROOT).length}파일 · 함수 ${funcs}개 · 별칭 ${aliases}곳`);
for (const f of found) console.log(`  🟠 ${f.file}:${f.aliasLine} ${f.fn}() — '${f.alias} = CUR' 뒤 ${f.asyncLine}줄 비동기 경계 → ${f.useLine}줄에서 옛 별칭을 고침/저장/되돌림`);
if (argv.includes('--list')) for (const f of found) console.log(JSON.stringify(f));
const over = found.length > BASELINE;
console.log(`요약: 비동기 경계 뒤 CUR 별칭 고침 ${found.length}곳 (기준선 ${BASELINE})`);
console.log(over ? '최종 결과: ❌ FAIL — 비동기 경계 뒤에는 CUR 을 다시 읽어 고칠 것(gamedata.js saveStudent 주석)' : '최종 결과: ✅ PASS');
process.exit(over ? 1 : 0);
