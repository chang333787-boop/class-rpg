#!/usr/bin/env node
// 우리반 성장 RPG — 로컬 smoke-test (read-only)
// 현대화(점진 리팩토링) 전 안전망. 앱 코드를 수정하지 않고, 로컬에서 정적 구조와
// HTTP 응답이 정상인지 가볍게 점검한다. Node 기본 모듈만 사용(fs/path/http/url).
// 외부 패키지/네트워크(운영 사이트)/브라우저/Firebase 없음.
//
// ⚠️ 이 스크립트는 "브라우저 런타임 테스트"가 아니라 "로컬 HTTP/정적 구조 smoke-test"다.
//   - 실제 DOM 렌더링은 확인하지 않는다.
//   - pageerror(런타임 JS 오류) 0은 확인하지 않는다.
//   - Firebase 연결/쓰기 여부는 확인하지 않는다.
//   - 버튼 클릭/로그인/전투/저장 동작은 확인하지 않는다.
//   - 운영 사이트(funclassrpg.kr)를 호출하지 않는다 — 로컬 파일만 임시 서버로 서빙한다.
//   - 브라우저 자동화(Playwright/Puppeteer/jsdom 등)가 필요한 검사는 별도 Phase에서 논의한다.
//
// 결과: PASS / REVIEW(수동 검토) / FAIL. FAIL이 1개 이상이면 exit code 1.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = []; // { level, msg }
const add = (level, msg) => results.push({ level, msg });

const rel = (f) => path.join(ROOT, f);
const exists = (f) => fs.existsSync(rel(f));
const read = (f) => fs.readFileSync(rel(f), 'utf8');

const JS_FILES = ['gamedata.js', 'student.js', 'admin.js', 'kiosk.js'];
const HTML_FILES = ['student.html', 'admin.html', 'kiosk.html'];
const CSS_FILES = ['student.css', 'admin.css', 'kiosk.css'];
const REQUIRED = [...JS_FILES, ...HTML_FILES, ...CSS_FILES];
const PAGE_JS = { 'student.html': 'student.js', 'admin.html': 'admin.js', 'kiosk.html': 'kiosk.js' };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// ── 1) 필수 파일 존재 ──
{
  const missing = REQUIRED.filter((f) => !exists(f));
  if (missing.length === 0) add('PASS', `필수 파일 ${REQUIRED.length}개 모두 존재`);
  else add('FAIL', `필수 파일 누락: ${missing.join(', ')}`);
}

// ── 2) 로컬 HTTP 서버 smoke (운영 아님, 로컬 파일만, random free port, 종료 시 close) ──
{
  // 요청 경로를 ROOT 내부 실제 파일로 매핑한다. 쿼리스트링(?v=...)은 제거하고,
  // 경로 traversal(../ 등)은 ROOT 밖으로 못 나가게 차단한다.
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1'); // 쿼리스트링 분리
      const decoded = decodeURIComponent(u.pathname);
      const safe = path.normalize(decoded).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(ROOT, safe);
      // ROOT 경계 밖이면 차단
      if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.statusCode = 403; res.end('forbidden'); return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.statusCode = 404; res.end('not found'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      res.end(fs.readFileSync(filePath));
    } catch {
      res.statusCode = 500; res.end('error');
    }
  });

  // 포트 0 = OS가 빈 포트 자동 할당 (충돌 방지)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  // 캐시버스터를 실제 HTML에 적힌 그대로 둔 채로 200 확인 (쿼리 있어도 실제 파일로 매핑되는지)
  const urls = [
    '/student.html', '/admin.html', '/kiosk.html',
    '/gamedata.js?v=20260705b',
    '/student.js?v=20260713e', '/admin.js?v=20260705c', '/kiosk.js?v=20260705b',
    '/student.css?v=20260604', '/admin.css?v=20260604', '/kiosk.css?v=20260604',
  ];

  let ok = 0;
  const bad = [];
  for (const u of urls) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${u}`);
      // 본문도 비어있지 않은지 가볍게 확인
      const body = await r.text();
      if (r.status === 200 && body.length > 0) ok++;
      else bad.push(`${u}(${r.status})`);
    } catch (e) {
      bad.push(`${u}(ERR)`);
    }
  }

  await new Promise((resolve) => server.close(resolve)); // 반드시 닫기

  if (bad.length === 0) add('PASS', `로컬 HTTP 200 ${ok}/${urls.length} (포트 ${port}, 서버 close 완료)`);
  else add('FAIL', `로컬 HTTP 비정상 ${bad.length}건: ${bad.join(', ')}`);
}

// ── 3) HTML 로드 구조 (gamedata 우선 / 클래식 로드 / 인라인 0 / 캐시버스터) ──
for (const f of HTML_FILES) {
  if (!exists(f)) { add('FAIL', `${f}: 파일 없음`); continue; }
  const html = read(f);
  const js = PAGE_JS[f];

  // gamedata.js가 전용 JS보다 먼저 로드되는지
  const gIdx = html.indexOf('gamedata.js');
  const jIdx = html.indexOf(js);
  if (gIdx !== -1 && jIdx !== -1 && gIdx < jIdx) add('PASS', `${f}: gamedata.js → ${js} 로드 순서 정상`);
  else add('FAIL', `${f}: 로드 순서 비정상 (gamedata=${gIdx}, ${js}=${jIdx})`);

  // 전용 JS가 클래식 로드(module/async/defer 없음)
  const jsTag = (html.match(new RegExp(`<script\\b[^>]*\\b${js.replace('.', '\\.')}[^>]*>`)) || [])[0] || '';
  if (jsTag && /\b(type=["']?module|async|defer)\b/.test(jsTag)) add('FAIL', `${f}: ${js} 비클래식 로드 (${jsTag})`);
  else add('PASS', `${f}: ${js} 클래식 로드 (module/async/defer 없음)`);

  // 인라인 <script>(src 없음) / <style> 0건
  const scriptOpen = (html.match(/<script\b/g) || []).length;
  const scriptSrc = (html.match(/<script\b[^>]*\bsrc=/g) || []).length;
  const inlineScript = scriptOpen - scriptSrc;
  const styleTags = (html.match(/<style\b/g) || []).length;
  if (inlineScript === 0 && styleTags === 0) add('PASS', `${f}: 인라인 <script>/<style> 0건`);
  else add('FAIL', `${f}: 인라인 잔여 (script ${inlineScript}, style ${styleTags})`);

  // CSS link 캐시버스터 ?v=20260604
  const cssName = f.replace('.html', '.css');
  if (html.includes(`${cssName}?v=20260604`)) add('PASS', `${f}: ${cssName}?v=20260604 캐시버스터`);
  else add('REVIEW', `${f}: ${cssName} 캐시버스터(?v=20260604) 미발견 — CSS 갱신 시 확인 필요`);

  // 전용 JS script src 캐시버스터 (기대값 스냅샷 — 해당 JS 갱신 시 여기도 동기화)
  const jsVer = { 'student.js': '20260713e', 'admin.js': '20260705c', 'kiosk.js': '20260705b' }[js];
  if (html.includes(`${js}?v=${jsVer}`)) add('PASS', `${f}: ${js}?v=${jsVer} 캐시버스터`);
  else add('REVIEW', `${f}: ${js} 캐시버스터(?v=${jsVer}) 미발견 — JS 갱신 시 확인 필요`);

  // gamedata.js 캐시버스터 ?v=20260705 (2026-07-05 갱신 — 업적/씨앗 문구 수정 배포)
  if (html.includes('gamedata.js?v=20260705b')) add('PASS', `${f}: gamedata.js?v=20260705b 캐시버스터`);
  else add('REVIEW', `${f}: gamedata.js 캐시버스터(?v=20260705) 미발견 — gamedata 갱신 시 확인 필요`);
}

// ── 4) 주요 문자열/심볼 존재 (실행 없이 텍스트 기준) ──
{
  const checks = [
    ['gamedata.js', /\bconst DB\b|\bDB\s*=\s*{/, 'DB 레이어 정의'],
    ['gamedata.js', /_normalizeArrays/, '_normalizeArrays'],
    ['gamedata.js', /_migrate/, '_migrate'],
    ['gamedata.js', /\bconst Utils\b|\bUtils\s*=\s*{/, 'Utils 정의'],
    ['student.js', /window\.onload/, 'window.onload'],
    ['admin.js', /window\.onload/, 'window.onload'],
    ['kiosk.js', /window\.onload/, 'window.onload'],
    ['kiosk.js', /DB\._migrate\(\s*DB\._normalizeArrays/, 'kiosk 공유 정규화 호출'],
    ['admin.js', /Utils\.todayStr/, 'Utils.todayStr'],
    ['admin.js', /Utils\.weekStartStr/, 'Utils.weekStartStr'],
  ];
  for (const [f, re, label] of checks) {
    if (!exists(f)) { add('FAIL', `${f}: 파일 없음 (${label})`); continue; }
    if (re.test(read(f))) add('PASS', `${f}: ${label} 존재`);
    else add('FAIL', `${f}: ${label} 미발견`);
  }
}

// ── 결과 출력 (verify-safety와 동일 형식) ──
const order = { PASS: 0, REVIEW: 1, FAIL: 2 };
const icon = { PASS: '✅ PASS  ', REVIEW: '🟡 REVIEW', FAIL: '❌ FAIL  ' };
console.log('\n── 우리반 성장 RPG 로컬 smoke-test (HTTP/정적 구조) ──\n');
console.log('  ※ 브라우저 런타임 테스트 아님. DOM 렌더·pageerror·Firebase·버튼 동작은 검사하지 않음.\n');
results.sort((a, b) => order[a.level] - order[b.level]);
for (const r of results) console.log(`${icon[r.level]}  ${r.msg}`);

const pass = results.filter((r) => r.level === 'PASS').length;
const review = results.filter((r) => r.level === 'REVIEW').length;
const fail = results.filter((r) => r.level === 'FAIL').length;
console.log(`\n요약: PASS ${pass} · REVIEW ${review} · FAIL ${fail}`);
console.log(`최종 결과: ${fail > 0 ? '❌ FAIL' : '✅ PASS (REVIEW 항목은 수동 확인)'}\n`);
process.exit(fail > 0 ? 1 : 0);
