#!/usr/bin/env node
// 우리반 성장 RPG — 안전성 검증 스크립트 (read-only)
// 앱 코드를 수정하지 않고, 리팩토링 안전 규칙이 유지되는지 점검한다.
// Node 기본 모듈만 사용(fs/path/child_process). 외부 패키지/네트워크/브라우저 없음.
//
// 결과: PASS / REVIEW(수동 검토) / FAIL. FAIL이 1개 이상이면 exit code 1.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = []; // { level, msg }
const add = (level, msg) => results.push({ level, msg });

const rel = (f) => path.join(ROOT, f);
const exists = (f) => fs.existsSync(rel(f));
const read = (f) => fs.readFileSync(rel(f), 'utf8');
const countMatches = (text, re) => (text.match(re) || []).length;

const JS_FILES = ['gamedata.js', 'student.js', 'admin.js', 'kiosk.js'];
const HTML_FILES = ['student.html', 'admin.html', 'kiosk.html'];
const CSS_FILES = ['student.css', 'admin.css', 'kiosk.css'];
const REQUIRED = [...JS_FILES, ...HTML_FILES, ...CSS_FILES];
const PAGE_JS = { 'student.html': 'student.js', 'admin.html': 'admin.js', 'kiosk.html': 'kiosk.js' };

// ── 1) 필수 파일 존재 ──
{
  const missing = REQUIRED.filter((f) => !exists(f));
  if (missing.length === 0) add('PASS', `필수 파일 ${REQUIRED.length}개 모두 존재`);
  else add('FAIL', `필수 파일 누락: ${missing.join(', ')}`);
}

// ── 2) JS 문법 검사 (node --check) ──
for (const f of JS_FILES) {
  if (!exists(f)) { add('FAIL', `node --check ${f}: 파일 없음`); continue; }
  try {
    execFileSync(process.execPath, ['--check', rel(f)], { stdio: 'pipe' });
    add('PASS', `node --check ${f}`);
  } catch (e) {
    add('FAIL', `node --check ${f}: 문법 오류`);
  }
}

// ── 3) 금지 저장 패턴 (DB.save( / this.save() ──
for (const { label, pat } of [
  { label: 'DB.save(', pat: /\bDB\.save\(/g },
  { label: 'this.save(', pat: /\bthis\.save\(/g },
]) {
  let total = 0;
  const hits = [];
  for (const f of JS_FILES) {
    if (!exists(f)) continue;
    const n = countMatches(read(f), pat);
    if (n > 0) hits.push(`${f}:${n}`);
    total += n;
  }
  if (total === 0) add('PASS', `${label} 0건`);
  else add('FAIL', `${label} ${total}건 발견 (${hits.join(', ')})`);
}

// ── 4) kiosk pendingRewards 부분 저장 유지 ──
if (exists('kiosk.js')) {
  const k = read('kiosk.js');
  const partial = countMatches(k, /\/pendingRewards'\)\.set\(s\.pendingRewards\)/g);
  const fullSet = countMatches(k, /child\('students\/'\+s\.id\)\.set\(s\)/g);
  if (partial === 2 && fullSet === 0) {
    add('PASS', `kiosk pendingRewards 부분 저장 2건 / 전체 set 0건`);
  } else {
    add('FAIL', `kiosk 저장 기대(부분 2, 전체 0) ≠ 실제(부분 ${partial}, 전체 ${fullSet})`);
  }
} else {
  add('FAIL', 'kiosk.js 없음 — pendingRewards 검사 불가');
}

// ── 5) root write 후보 (REVIEW — 의도된 작업 존재하므로 자동 FAIL 아님) ──
{
  const re = /(_fbRef|fbRef)\.(set|update|remove)\(/g;
  const hits = [];
  let total = 0;
  for (const f of JS_FILES) {
    if (!exists(f)) continue;
    const n = countMatches(read(f), re);
    if (n > 0) hits.push(`${f}:${n}`);
    total += n;
  }
  add('REVIEW', `root write 후보 ${total}건 (${hits.join(', ') || '없음'}) — import/rollback/reset/init 등 의도 작업 수동 확인`);
}

// ── 6) HTML 인라인 script/style 잔여 (REVIEW) ──
for (const f of HTML_FILES) {
  if (!exists(f)) continue;
  const html = read(f);
  const scriptOpen = countMatches(html, /<script\b/g);
  const scriptSrc = countMatches(html, /<script\b[^>]*\bsrc=/g);
  const inlineScript = scriptOpen - scriptSrc;
  const styleTags = countMatches(html, /<style\b/g);
  if (inlineScript > 0) add('REVIEW', `${f} 인라인 <script> ${inlineScript}건 (알려진 잔여: _lbTouchX 1줄 허용)`);
  if (styleTags > 0) add('REVIEW', `${f} <style> ${styleTags}건 (알려진 잔여: @keyframes ldBar 허용)`);
}

// ── 7) script 로드 순서 (gamedata.js → 전용 JS) ──
for (const f of HTML_FILES) {
  if (!exists(f)) continue;
  const html = read(f);
  const gi = html.indexOf('./gamedata.js');
  const pj = PAGE_JS[f];
  const di = html.indexOf('./' + pj);
  if (gi === -1 || di === -1) add('FAIL', `${f} 로드 순서: gamedata.js(${gi}) 또는 ${pj}(${di}) 누락`);
  else if (gi < di) add('PASS', `${f} 로드 순서 정상 (gamedata.js → ${pj})`);
  else add('FAIL', `${f} 로드 순서 역전 (gamedata.js가 ${pj} 뒤)`);
}

// ── 8) 전용 JS script 태그에 module/async/defer 금지 ──
for (const f of HTML_FILES) {
  if (!exists(f)) continue;
  const html = read(f);
  const pj = PAGE_JS[f];
  // 전용 JS를 로드하는 <script ...src="./page.js"...> 태그 추출
  const m = html.match(new RegExp(`<script\\b[^>]*src=["']\\./${pj.replace('.', '\\.')}[^>]*>`));
  if (!m) { add('FAIL', `${f}: ${pj} script 태그 못 찾음`); continue; }
  const tag = m[0];
  const bad = ['type="module"', 'defer', 'async'].filter((x) => tag.includes(x));
  if (bad.length === 0) add('PASS', `${f}: ${pj} 클래식 로드 (module/async/defer 없음)`);
  else add('FAIL', `${f}: ${pj} 태그에 금지 속성 ${bad.join(', ')}`);
}

// ── 9) 안전 규칙 문서 존재 ──
{
  const doc = 'docs/rpg_refactor_safety_rules.md';
  if (exists(doc)) add('PASS', `안전 규칙 문서 존재 (${doc})`);
  else add('FAIL', `안전 규칙 문서 누락 (${doc})`);
}

// ── 10) admin 날짜 helper 재발 방지 (Utils.todayStr/weekStartStr로 통일 유지) ──
if (exists('admin.js')) {
  const a = read('admin.js');
  const defToday = countMatches(a, /function\s+todayStr\(/g);
  const defWeek  = countMatches(a, /function\s+weekStartStr\(/g);
  // bare 호출 = 전체 호출 − Utils. 프리픽스 − 함수 정의
  const bareToday = countMatches(a, /todayStr\(/g) - countMatches(a, /Utils\.todayStr\(/g) - defToday;
  const bareWeek  = countMatches(a, /weekStartStr\(/g) - countMatches(a, /Utils\.weekStartStr\(/g) - defWeek;
  const uToday = countMatches(a, /Utils\.todayStr\(/g);
  const uWeek  = countMatches(a, /Utils\.weekStartStr\(/g);
  const probs = [];
  if (defToday > 0) probs.push(`function todayStr ${defToday}`);
  if (defWeek > 0) probs.push(`function weekStartStr ${defWeek}`);
  if (bareToday > 0) probs.push(`bare todayStr( ${bareToday}`);
  if (bareWeek > 0) probs.push(`bare weekStartStr( ${bareWeek}`);
  if (uToday < 1) probs.push('Utils.todayStr( 0건');
  if (uWeek < 1) probs.push('Utils.weekStartStr( 0건');
  if (probs.length === 0) add('PASS', `admin 날짜 helper Utils 통일 유지 (Utils.todayStr ${uToday}, Utils.weekStartStr ${uWeek})`);
  else add('FAIL', `admin 날짜 helper 통일 위반: ${probs.join(', ')}`);
} else {
  add('FAIL', 'admin.js 없음 — 날짜 helper 검사 불가');
}

// ── 11) kiosk normalizeData 통일 유지 (DB._migrate(DB._normalizeArrays())) ──
if (exists('kiosk.js')) {
  const k = read('kiosk.js');
  const unified = /DB\._migrate\(\s*DB\._normalizeArrays\(/.test(k);
  const localToArr = countMatches(k, /function\s+toArr\(/g);
  const qlAlias = countMatches(k, /data\.questLogs\s*=\s*data\.quests/g);
  const probs = [];
  if (!unified) probs.push('DB._migrate(DB._normalizeArrays()) 호출 없음');
  if (localToArr > 0) probs.push(`로컬 function toArr ${localToArr}`);
  if (qlAlias > 0) probs.push(`questLogs alias ${qlAlias}`);
  if (probs.length === 0) add('PASS', 'kiosk normalizeData 공유 정규화 통일 유지');
  else add('FAIL', `kiosk normalizeData 통일 위반: ${probs.join(', ')}`);
} else {
  add('FAIL', 'kiosk.js 없음 — normalizeData 검사 불가');
}

// ── 12) gamedata 정규화 helper 존재 (_normalizeArrays / _migrate) ──
if (exists('gamedata.js')) {
  const g = read('gamedata.js');
  const hasNorm = /_normalizeArrays\s*\(\s*data\s*\)\s*\{/.test(g);
  const hasMig  = /_migrate\s*\(\s*data\s*\)\s*\{/.test(g);
  if (hasNorm && hasMig) add('PASS', 'gamedata 정규화 helper 존재 (_normalizeArrays/_migrate)');
  else add('FAIL', `gamedata 정규화 helper 누락 (_normalizeArrays:${hasNorm}, _migrate:${hasMig})`);
} else {
  add('FAIL', 'gamedata.js 없음 — 정규화 helper 검사 불가');
}

// ── 결과 출력 ──
const order = { PASS: 0, REVIEW: 1, FAIL: 2 };
results.sort((a, b) => order[a.level] - order[b.level]);
const icon = { PASS: '✅ PASS  ', REVIEW: '🟡 REVIEW', FAIL: '❌ FAIL  ' };
console.log('\n── 우리반 성장 RPG 안전성 검증 ──\n');
for (const r of results) console.log(`${icon[r.level]} ${r.msg}`);

const pass = results.filter((r) => r.level === 'PASS').length;
const review = results.filter((r) => r.level === 'REVIEW').length;
const fail = results.filter((r) => r.level === 'FAIL').length;
console.log(`\n요약: PASS ${pass} · REVIEW ${review} · FAIL ${fail}`);
console.log(`최종 결과: ${fail > 0 ? '❌ FAIL' : '✅ PASS (REVIEW 항목은 수동 확인)'}\n`);

process.exit(fail > 0 ? 1 : 0);
