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

const JS_FILES = ['gamedata.js', 'curriculum.js', 'curriculum_review.js', 'curriculum_reading.js', 'figures.js', 'student.js', 'admin.js', 'kiosk.js'];
const HTML_FILES = ['student.html', 'admin.html', 'kiosk.html'];
const CSS_FILES = ['student.css', 'admin.css', 'kiosk.css'];
const REQUIRED = [...JS_FILES, ...HTML_FILES, ...CSS_FILES];
const PAGE_JS = { 'student.html': 'student.js', 'admin.html': 'admin.js', 'kiosk.html': 'kiosk.js' };

// [BUSTER-1] 캐시버스터 단일 출처 — 값을 여기 적어 두지 않는다.
//   전에는 기대값을 이 파일에 하드코딩해 두고 대조했다. 그래서 캐시버스터를 올릴 때마다
//   html 1곳 + 이 파일 3곳을 같이 고쳐야 했고, rebase 충돌이 거의 매번 그 자리에서 났다.
//   이제 **html에 적힌 것이 정답**이고, 이 파일은 html에서 읽어 온다.
//   대신 '값이 스냅샷과 같은가'라는 (이제 자동 통과가 될) 검사를 버리고,
//   실제로 자주 깨지는 세 가지를 본다 → 아래 [BUSTER-1] 검사 ①②③.
const localRefs = (html) =>
  [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(?:https?:)?\/\//.test(u) && !u.startsWith('data:') && !u.startsWith('#'))
    .map((u) => {
      const [pathPart, query] = u.split('?');
      return { raw: u, file: pathPart.replace(/^\.\//, ''), ver: (query || '').replace(/^v=/, '') };
    });

// html별 참조 목록 (자산 = js·css, 페이지 = html 링크)
const HTML_REFS = {};
for (const f of HTML_FILES) {
  if (!exists(f)) { HTML_REFS[f] = { assets: [], pages: [] }; continue; }
  const refs = localRefs(read(f));
  HTML_REFS[f] = {
    assets: refs.filter((r) => /\.(js|css)$/.test(r.file)),
    pages:  refs.filter((r) => /\.html$/.test(r.file)),
  };
}

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

  // [BUSTER-1] 목록을 손으로 적지 않는다 — html에 적힌 참조 그대로 받아 온다
  //   (쿼리가 붙어 있어도 실제 파일로 매핑되는지 확인하는 것이 목적)
  const urls = [
    ...HTML_FILES.map((f) => '/' + f),
    ...[...new Set(
      HTML_FILES.flatMap((f) => HTML_REFS[f].assets.map((r) => '/' + r.file + (r.ver ? '?v=' + r.ver : '')))
    )],
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

  // [BUSTER-1] 캐시버스터 값 대조는 여기서 하지 않는다(html이 단일 출처).
  //   대신 아래 [BUSTER-1] 검사 ①②③이 실제로 깨지는 자리를 본다.
}

// ── [BUSTER-1] 캐시버스터 세 가지 검사 ─────────────────────────
{
  // ① 여러 html이 같은 파일을 참조하면 버전도 같아야 한다.
  //    gamedata.js를 student·admin·kiosk 셋이 참조하는데, 한 곳만 올리고 빠뜨리기 쉽다.
  //    그러면 그 화면만 옛 코드를 물고 돌아 재현이 어려운 버그가 된다.
  const byFile = new Map();
  for (const f of HTML_FILES) {
    for (const r of HTML_REFS[f].assets) {
      if (!byFile.has(r.file)) byFile.set(r.file, []);
      byFile.get(r.file).push({ html: f, ver: r.ver });
    }
  }
  const shared = [...byFile.entries()].filter(([, uses]) => uses.length > 1);
  const mismatched = shared.filter(([, uses]) => new Set(uses.map((u) => u.ver)).size > 1);
  if (mismatched.length === 0) {
    add('PASS', `공유 파일 ${shared.length}개의 캐시버스터가 html 사이에서 일치` +
      (shared.length ? ` (${shared.map(([file, uses]) => `${file}=${uses[0].ver || '없음'}×${uses.length}`).join(', ')})` : ''));
  } else {
    add('FAIL', '공유 파일 캐시버스터 불일치: ' + mismatched
      .map(([file, uses]) => `${file} → ${uses.map((u) => `${u.html}:${u.ver || '없음'}`).join(' / ')}`).join(' · '));
  }

  // ② 참조한 파일이 저장소에 실제로 있어야 한다(경로 오타 방어).
  const allRefs = HTML_FILES.flatMap((f) =>
    [...HTML_REFS[f].assets, ...HTML_REFS[f].pages].map((r) => ({ ...r, html: f })));
  const missingRefs = allRefs.filter((r) => !exists(r.file));
  if (missingRefs.length === 0) add('PASS', `html이 참조하는 로컬 파일 ${allRefs.length}건 모두 존재`);
  else add('FAIL', '없는 파일 참조: ' + missingRefs.map((r) => `${r.html} → ${r.raw}`).join(', '));

  // ③ js·css 참조에는 캐시버스터가 반드시 있어야 한다.
  //    빠지면 학생 브라우저가 옛 파일을 계속 쓴다(배포해도 안 바뀌는 것처럼 보인다).
  const noVer = HTML_FILES.flatMap((f) =>
    HTML_REFS[f].assets.filter((r) => !r.ver).map((r) => `${f} → ${r.raw}`));
  if (noVer.length === 0) {
    const total = HTML_FILES.reduce((n, f) => n + HTML_REFS[f].assets.length, 0);
    add('PASS', `js·css 참조 ${total}건 모두 ?v= 캐시버스터 있음`);
  } else {
    add('FAIL', '캐시버스터 없는 참조: ' + noVer.join(', '));
  }
}

// ── 4) 주요 문자열/심볼 존재 (실행 없이 텍스트 기준) ──
{
  const checks = [
    ['gamedata.js', /\bconst DB\b|\bDB\s*=\s*{/, 'DB 레이어 정의'],
    ['gamedata.js', /_normalizeArrays/, '_normalizeArrays'],
    ['gamedata.js', /_migrate/, '_migrate'],
    ['gamedata.js', /\bconst Utils\b|\bUtils\s*=\s*{/, 'Utils 정의'],
    ['curriculum.js', /\bconst CURRICULUM\b/, 'CURRICULUM 정의'],
    ['curriculum.js', /\bconst BASE_PROBLEMS\b/, 'BASE_PROBLEMS 정의'],
    ['curriculum.js', /\bconst CurriculumUtils\b/, 'CurriculumUtils 정의'],
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


// ── [DUP-STUDENT-1] 학생 중복 시 id 키 본 우선 ──────────────────
//  students 에는 옛 숫자 키(낡은 스냅샷)와 지금 id 키(현재 본)가 함께 있다.
//  _normalizeArrays 의 "나중 것 승"이 맞게 동작하는 건 Object.keys 가
//  정수형 키를 먼저 돌려주기 때문이다(gamedata.js 그 자리 주석 참고).
//  그 전제가 깨지면 낡은 레벨·골드가 이겨 화면이 과거로 보이고, 그 상태로
//  저장되면 진행이 사라진다 — 에러는 안 난다. 그래서 여기서 값으로 잡는다.
{
  const vm = await import('node:vm');
  const OLD = { level: 16, gold: 34641 };
  const NEW = { level: 21, gold: 50984 };
  const ids = ['s1773621060764', 's1773621060765', 's1773621060766'];
  const names = ['가나다', '라마바', '사아자'];
  const raw = {};
  raw['0'] = { pendingRewards: { r: { label: '껍데기' } } };          // id·name 없는 옛 노드
  ids.forEach((id, i) => { raw[String(i + 1)] = { id, name: names[i], ...OLD }; });  // 낡은 본
  ids.forEach((id, i) => { raw[id] = { id, name: names[i], ...NEW }; });            // 현재 본

  try {
    const sb = { console, window: {}, setTimeout,
      document: { getElementById: () => null, querySelectorAll: () => [] },
      localStorage: { getItem: () => null, setItem: () => {} }, alert: () => {} };
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(read('gamedata.js') + ';globalThis.__DB = DB;', sb);
    const out = sb.__DB._normalizeArrays({ students: JSON.parse(JSON.stringify(raw)) }).students;
    const okCount = out.length === ids.length;
    const okWinner = out.every(s => s.level === NEW.level && s.gold === NEW.gold);
    if (okCount && okWinner) add('PASS', `학생 중복 시 id 키 본 우선 (숫자 키 ${ids.length} + id 키 ${ids.length} → ${out.length}명, 최신값 채택)`);
    else add('FAIL', `학생 중복 처리 깨짐 — ${out.length}명, 레벨 ${out.map(s => s.level).join('/')} (기대: ${ids.length}명 전원 ${NEW.level})`);
  } catch (e) {
    add('FAIL', `학생 중복 검사 실행 실패: ${e.message}`);
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
