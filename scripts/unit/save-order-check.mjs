#!/usr/bin/env node
// 우리반 성장 RPG — 저장 순서 검사 (SAVE-ORDER-CHECK-1, read-only)
//
//  왜: firebase compat SDK 9.23.0 은 이 기기가 쓴 update()/set() **안에서** 루트 on('value') 콜백을 동기로 부른다
//      (scripts/unit/firebase-sync-event-probe.html). 그래서 한 함수 안에서
//         CUR.gold += g  →  DB.logGold(...)  →  …  →  DB.saveStudent(CUR)
//      순서면, logGold 의 동기 에코가 CUR 을 옛 캐시로 바꾼 뒤 saveStudent 가 g 빠진 학생을 저장한다(골드 유실 M1).
//      같은 모양으로 #218 의 logSpend 가 '상점 구매 공짜'를 만들었다(2026-09-15, 5분 만에 되돌림).
//  무엇: student.js·gamedata.js·admin.js 의 함수마다, **다른 경로 쓰기(logGold·logSpend·saveQuestLog)가
//        같은 함수의 saveStudent 보다 앞에** 있으면 적는다. 실제 SDK 테스트(gold-loss-real-sdk)가 못 도는
//        경로(돌연변이 수확, 감정 보상, 교사 화면 등)까지 코드 모양으로 훑기 위한 것.
//  한계: 정적 검사다.
//        · 함수를 건너가는 경우(_finishBattle → finalizeBattle 안의 logGold → 돌아와 saveStudent)는 못 본다 —
//          그 경로는 gold-loss-real-sdk 의 battle 케이스가 잡는다.
//        · 에코를 막는 수정(#288 류)이 들어가면 이 순서는 더 이상 위험하지 않을 수 있다.
//        → 기본은 REVIEW(목록만, exit 0). `--strict` 는 하나라도 있으면 exit 1.
//          `--baseline N` 은 N 곳까지는 기존 것으로 보고 넘기고, 늘면 FAIL(#218 같은 새 자리 추가를 막을 때).
//
//  사용: node scripts/unit/save-order-check.mjs [--strict] [--baseline N]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['student.js', 'gamedata.js', 'admin.js'];
const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const bi = argv.indexOf('--baseline');
const BASELINE = bi >= 0 ? Number(argv[bi + 1]) : null;

// 줄 단위로 훑는다. 파서 없이 문자열·정규식을 정확히 걷어 내기는 어렵다(1차판에서 student.js 정규식 안 따옴표에 흔들려
//   함수 경계를 놓쳤다). 이 저장소는 함수가 **맨 앞 칸 `function`**(student.js·admin.js) 또는 **두 칸 들여쓴 메서드**
//   (gamedata.js 의 DB 객체)로 시작하고 같은 들여쓰기의 `}` 로 끝나는 규칙을 지키므로 그 경계를 쓴다.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'function']);
const TOP_HEAD = /^(?:async\s+)?function\s+([\w$]+)\s*\(/;
const METHOD_HEAD = /^  (?:async\s+)?([\w$]+)\s*\([^)]*\)\s*\{\s*$/;
const TOP_END = /^\};?\s*$/;
const METHOD_END = /^  \},?\s*$/;
const WRITE_ON_LINE = /\b(?:DB|this)\.(logGold|logSpend|saveQuestLog)\s*\(/;
const DEF_LINE = /^\s*(?:async\s+)?(?:logGold|logSpend|saveQuestLog)\s*\(/;
const SAVE_ON_LINE = /\b(?:DB|this)\.saveStudent\s*\(/;
const isComment = (l) => /^\s*\/\//.test(l);

const findings = [];
for (const f of FILES) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/);
  const methods = f === 'gamedata.js';
  const headOf = (l) => {
    const m = l.match(TOP_HEAD) || (methods ? l.match(METHOD_HEAD) : null);
    return m && !KEYWORDS.has(m[1]) ? m[1] : null;
  };
  const isEnd = (l) => TOP_END.test(l) || (methods && METHOD_END.test(l));
  let fn = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = headOf(l);
    if (h) fn = h;
    if (fn && !isComment(l) && !DEF_LINE.test(l)) {
      const w = l.match(WRITE_ON_LINE);
      if (w) {
        for (let j = i; j < lines.length; j++) {
          if (j > i && (isEnd(lines[j]) || headOf(lines[j]))) break;
          const seg = j === i ? l.slice(l.indexOf(w[0]) + w[0].length) : lines[j];
          if (!isComment(lines[j]) && SAVE_ON_LINE.test(seg)) {
            findings.push({ file: f, fn, write: w[1], line: i + 1, saveLine: j + 1 });
            break;
          }
        }
      }
    }
    if (isEnd(l)) fn = null;
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const x of findings) console.log(`🟡 REVIEW ${x.file}:${x.line} ${x.fn}() — ${x.write} 가 saveStudent(${x.file}:${x.saveLine}) 보다 앞`);
const n = findings.length;
let fail = false;
if (STRICT && n > 0) fail = true;
if (BASELINE !== null && n > BASELINE) fail = true;
console.log(`\n요약: 저장보다 앞선 다른 경로 쓰기 ${n}곳${BASELINE !== null ? ` (기준선 ${BASELINE})` : ''}`);
console.log(fail ? '최종 결과: ❌ FAIL' : n ? '최종 결과: 🟡 REVIEW (에코 수정 전에는 이 자리들이 골드 유실 후보)' : '최종 결과: ✅ 없음');
process.exit(fail ? 1 : 0);
