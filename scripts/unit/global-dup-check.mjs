#!/usr/bin/env node
// 우리반 성장 RPG — 한 페이지 클래식 스크립트끼리 최상위 이름 겹침 검사 (GLOBAL-DUP-1, read-only)
//
//  student.html 은 gamedata.js · curriculum*.js · figures.js · student.js 를 **클래식 <script>** 로 차례로 부른다.
//  클래식 스크립트의 최상위 이름은 모두 한 전역에 들어가므로
//   · function / var 이름이 겹치면 **뒤 파일이 앞 파일 것을 말없이 덮는다**(앞 파일 안의 호출도 뒤 판을 부름).
//   · let / const / class 가 다른 파일 이름과 겹치면 뒤 스크립트가 SyntaxError 로 **통째로 안 돈다**.
//  이 검사는 html 의 실제 <script> 순서대로 각 파일의 최상위 선언을 모아 겹침을 찾는다.
//
//  사용: node scripts/unit/global-dup-check.mjs [--list]
//    --list   페이지별로 읽은 스크립트 순서와 선언 수도 찍는다.
//
//  최상위 판단: **줄 첫 칸(들여쓰기 0)** 에서 시작하는 선언만 센다. 이 저장소는 최상위만 첫 칸에 쓰고
//  함수 안 선언은 들여 쓴다(figures.js 처럼 IIFE 로 감싼 파일은 바깥 이름 하나만 잡힌다).
//  검사 페이지 = student.html · admin.html · kiosk.html + 루트 파일을 함께 부르는 하위 앱(watercolor/index.html).
//  document.write 로 이름을 만들어 부르는 스크립트(watercolor 의 course_*.js)는 못 본다.
//
//  판정: 새 겹침(function·var) = FAIL · let/const/class 겹침 = FAIL · 기준선(아래 BASELINE, 의도된 덮어쓰기) = PASS.
//        기준선 항목이 더는 겹치지 않으면 REVIEW(기준선에서 지울 것). FAIL 1개 이상이면 exit 1.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAZY_STUDENT_FILES } from './student-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIST = process.argv.includes('--list');
const PAGES = ['student.html', 'admin.html', 'kiosk.html', 'watercolor/index.html'];

// 의도된 덮어쓰기 — 'html|이름|앞 파일|뒤 파일': 까닭
const BASELINE = {
  // admin 판은 GAME_DATA 몬스터에 _custom 표시를 붙여 관리 화면 목록이 '고친 몬스터'를 가려 본다. 학생·키오스크는 gamedata 판.
  // [ADMIN-SPLIT-1] admin.js 를 나눈 뒤 이 함수는 admin/battle.js 에 있다(admin.html 에서 gamedata.js 뒤 — 덮는 순서 그대로)
  'admin.html|getActiveMonsters|gamedata.js|admin/battle.js': '관리 화면 전용 판(_custom 표시) — 2026-10-04 확인',
};

const DECL = /^(?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|(var|let|const|class)\s+([A-Za-z_$][\w$]*))/;

// 한 소스의 최상위 선언 → [{name, kind, line}]
export function topDecls(src) {
  const out = [];
  src.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(DECL);
    if (!m) return;
    out.push(m[1] ? { name: m[1], kind: 'function', line: i + 1 } : { name: m[3], kind: m[2], line: i + 1 });
  });
  return out;
}

// html → 클래식 스크립트 순서 [{label, src}] (외부 주소·type=module·importmap 은 뺀다)
export function classicScripts(html, dir, readFile, page = 'page') {
  const out = [];
  let inline = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    const type = (attrs.match(/\btype="([^"]*)"/) || [])[1];
    if (type && !/^(text|application)\/javascript$/.test(type)) continue;
    const srcAttr = (attrs.match(/\bsrc="([^"]+)"/) || [])[1];
    if (srcAttr) {
      if (/^(?:https?:)?\/\//.test(srcAttr)) continue;
      const file = path.posix.normalize(path.posix.join(dir || '.', srcAttr.split('?')[0]));
      const src = readFile(file);
      if (src == null) continue;
      out.push({ label: file, src });
    } else {
      inline++;
      out.push({ label: `${page}#inline${inline}`, src: m[2] });
    }
  }
  return out;
}

// 페이지 하나 검사 → [{level, msg}]
export function checkPage(page, scripts, baseline = BASELINE) {
  const res = [];
  const seen = new Map();   // name → {file, kind, line}
  let overlaps = 0;
  for (const s of scripts) {
    const mine = new Set();
    for (const d of topDecls(s.src)) {
      if (mine.has(d.name)) continue;          // 같은 파일 안 중복은 이 검사 밖
      mine.add(d.name);
      const prev = seen.get(d.name);
      if (prev && prev.file !== s.label) {
        overlaps++;
        const where = `${prev.file}:${prev.line} → ${s.label}:${d.line}`;
        const lexical = ['let', 'const', 'class'].includes(d.kind) || ['let', 'const', 'class'].includes(prev.kind);
        const key = `${page}|${d.name}|${prev.file}|${s.label}`;
        if (lexical) res.push({ level: 'FAIL', msg: `${page}: ${d.name} (${prev.kind} / ${d.kind}) 이름 겹침 ${where} — 뒤 스크립트가 SyntaxError 로 안 돎` });
        else if (baseline[key]) res.push({ level: 'PASS', msg: `${page}: ${d.name} 덮어쓰기 ${where} — 기준선: ${baseline[key]}`, key });
        else res.push({ level: 'FAIL', msg: `${page}: ${d.name} 를 뒤 파일이 덮음 ${where} — 앞 파일 판은 안 쓰임. 하나를 지우거나 이름을 바꾸고, 일부러면 BASELINE 에 까닭과 함께` });
      }
      seen.set(d.name, { file: s.label, kind: d.kind, line: d.line });
    }
  }
  if (!overlaps) res.push({ level: 'PASS', msg: `${page}: 스크립트 ${scripts.length}개 최상위 이름 ${seen.size}개 겹침 0` });
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
  const all = [];
  for (const page of PAGES) {
    const html = read(page);
    if (html == null) { all.push({ level: 'REVIEW', msg: `${page} 없음` }); continue; }
    const dir = path.posix.dirname(page) === '.' ? '' : path.posix.dirname(page);
    const scripts = classicScripts(html, dir, read, page);
    //  [DECO-LAZY-1] student.html 이 태그 없이 늦게 부르는 파일(student/deco.js)도 같은 전역에 들어온다 — 다른 파일이 다 돈 뒤라 맨 뒤에.
    //  늦게 부르는 파일의 let/const 가 앞 파일 이름과 겹치면 **불러오는 순간** SyntaxError(꾸미기가 통째로 안 열림)라 여기서 잡는다.
    if (page === 'student.html') for (const f of LAZY_STUDENT_FILES) if (!scripts.some(x => x.label === f)) { const src = read(f); if (src != null) scripts.push({ label: f, src }); }
    if (LIST) console.log(`· ${page}: ${scripts.map(s => `${s.label}(${topDecls(s.src).length})`).join(' → ')}`);
    all.push(...checkPage(page, scripts));
  }
  const used = new Set(all.map(r => r.key).filter(Boolean));
  for (const k of Object.keys(BASELINE)) if (!used.has(k)) all.push({ level: 'REVIEW', msg: `기준선 '${k}' 은 더는 겹치지 않음 — BASELINE 에서 지울 것` });
  const icon = { PASS: '✅ PASS  ', REVIEW: '🟡 REVIEW', FAIL: '❌ FAIL  ' };
  for (const r of all) console.log(`${icon[r.level]} ${r.msg}`);
  const n = (l) => all.filter(r => r.level === l).length;
  console.log(`\n요약: PASS ${n('PASS')} · REVIEW ${n('REVIEW')} · FAIL ${n('FAIL')}`);
  process.exit(n('FAIL') ? 1 : 0);
}
