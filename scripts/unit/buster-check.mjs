#!/usr/bin/env node
// 우리반 성장 RPG — 캐시버스터 누락 검사기 (read-only, git 읽기만)
//
//  PR(또는 로컬 브랜치)이 머지되기 전에 "고친 js/css 를 학생 브라우저가 옛 캐시로 읽는" 사고를 잡는다.
//  smoke-test [BUSTER-1] 은 한 시점의 html 만 보므로 "바뀌었는데 안 올렸다"는 못 본다 — 그 빈칸을 채운다.
//
//  사용:  node scripts/unit/buster-check.mjs [base=origin/main] [head=HEAD]
//
//  검사
//   판정은 **머지 뒤 값** 기준: 브랜치가 안 건드린 줄은 main 값이 남는다(뒤처진 브랜치 오탐 방지, #218로 확인).
//   ① 이 브랜치가 고친 js/css(merge-base..head) 를 참조하는 html 줄을 브랜치가 올렸는가 — 안 올렸으면 FAIL,
//      날짜가 main 끝보다 과거면 FAIL. main 도 같은 줄을 바꿨으면 충돌 예상 REVIEW.
//   ② 고치지 않은 파일인데 브랜치가 버스터를 과거 날짜로 바꿨는가 — 머지하면 되돌리는 셈이라 FAIL.
//   ③ 같은 파일(gamedata·curriculum 등)을 여러 html 이 참조하면 머지 뒤 값이 모두 같은가 — 다르면 FAIL.
//   ④ 로컬 js/css 참조에 ?v= 가 없으면 REVIEW.
//  [BUSTER-SUBAPP-1] 하위 앱(<폴더>/index.html)도 본다.
//   · 하위 앱이 **루트 파일**(../gamedata.js 등)을 부르면 그 줄은 루트 html 과 똑같이 ①②③ 으로 판정(FAIL 가능).
//   · 하위 앱 **자기 파일**(css · import map 의 ./js/*.js)은 REVIEW 수준: 고쳤는데 값 그대로 · import map 에 없는 js ·
//     같은 html 안에서 <script src> 와 import map 값이 다름(같은 모듈이 두 번 실행될 수 있음).
//     하위 앱은 정수 버스터(?v=7)를 쓰므로 날짜 비교는 하지 않는다.
//  [BUSTER-COMMON-1] 하위 앱 공통 파일(common/util.js · rpg-firebase.js · teacher-gate.js · subapp.css)은 import map 의 "../common/…" 키 ·
//   <link href="../common/…"> 로 부른다 → 루트 파일과 똑같이 ①②③(여러 앱이 부르면 머지 뒤 값이 모두 같은가 = FAIL 가능).
//   ⑤ 앱 모듈(그리고 그 모듈이 부르는 common 모듈)이 import 하는 common/*.js 가 그 앱 import map 에 없으면 FAIL — ?v= 없이 받아져 옛 캐시가 남는다.
//  순서는 **앞 8자리 날짜로만** 본다. 같은 날 세션 코드끼리(q3a·rfa·st…)는 글자 순서에 뜻이 없고,
//  캐시는 '처음 보는 문자열'이면 새로 받으므로 같은 날 다른 값이면 통과다(09-15 #220 q3a←rfa 오탐으로 확인).
//  진짜 위험은 ⓐ 그대로 ⓑ 날짜가 과거로 감(옛 값 재사용 가능성) 두 가지.
//
//  FAIL 1개 이상이면 exit 1.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [BASE = 'origin/main', HEAD = 'HEAD'] = process.argv.slice(2);
const HTML_FILES = ['student.html', 'admin.html', 'kiosk.html'];
const SUB_HTML_RE = /^[^/]+\/index\.html$/;   // [BUSTER-SUBAPP-1] art/index.html · watercolor/index.html …

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
const show = (rev, file) => { try { return git('show', `${rev}:${file}`); } catch { return null; } };

const dirOf = (h) => { const d = path.posix.dirname(h); return d === '.' ? '' : d; };
// html 안의 상대 주소 → 저장소 기준 경로(../gamedata.js → gamedata.js)
const resolveIn = (dir, p) => {
  const r = path.posix.normalize(path.posix.join(dir || '.', p));
  return r.startsWith('../') ? null : r;
};
const splitUrl = (u) => {
  const [p, q = ''] = u.split('?');
  return { p, ver: (q.match(/(?:^|&)v=([^&]*)/) || [])[1] || '' };
};

// dir: html 이 있는 폴더('' = 루트). via: 'tag'(src/href) | 'importmap'
export function parseRefs(html, dir = '') {
  const out = [];
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(?:https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('#') || u.includes('${')) continue;
    const { p, ver } = splitUrl(u);
    const file = resolveIn(dir, p);
    if (!file || !/\.(js|css)$/.test(file)) continue;
    out.push({ file, ver, via: 'tag' });
  }
  // [BUSTER-SUBAPP-1] import map 의 상대 주소 값("./js/app.js": "./js/app.js?v=7"). 맨 이름 키("three")는 외부 묶음이라 뺀다.
  //  [BUSTER-COMMON-1] "../common/util.js" 처럼 위 폴더 키도 본다(resolveIn 이 저장소 기준 common/util.js 로 바꾼다).
  for (const m of html.matchAll(/<script\s+type="importmap"\s*>([\s\S]*?)<\/script>/g)) {
    let map; try { map = JSON.parse(m[1]); } catch { continue; }
    for (const [key, val] of Object.entries((map && map.imports) || {})) {
      if (!/^\.\.?\//.test(key) || typeof val !== 'string') continue;
      const { p, ver } = splitUrl(val);
      const file = resolveIn(dir, p);
      if (!file || !/\.(js|css)$/.test(file)) continue;
      out.push({ file, ver, via: 'importmap' });
    }
  }
  return out;
}
const dateOf = (v) => (String(v).match(/^\d{8}/) || [''])[0];
const behind = (v, b) => dateOf(v) && dateOf(b) && dateOf(v) < dateOf(b);
const refMap = (html, dir = '') => { const m = new Map(); if (html) for (const r of parseRefs(html, dir)) m.set(r.file, r.ver); return m; };
// 하위 앱 html 의 '자기 파일'인가(그 폴더 안). 루트 html 은 늘 아님.
const ownOf = (h, file) => { const d = dirOf(h); return !!d && file.startsWith(d + '/'); };

// base = merge-base(갈라진 곳), tip = main 끝, head = 이 브랜치.
// 브랜치가 안 건드린 줄은 머지하면 main 값이 남는다(squash·3-way). 그래서 '머지 뒤 값'으로 판정한다.
// headFiles(선택): head 의 전체 파일 목록 — 하위 앱 import map 에 빠진 js 를 찾는 데 쓴다.
export function check({ changed, baseHtml, tipHtml = baseHtml, headHtml, headFiles = null }) {
  const results = [];
  const add = (level, msg) => results.push({ level, msg });
  const merged = new Map(); // file → [{html, ver}]  머지 뒤 값
  const htmlList = Object.keys(headHtml).filter(h => headHtml[h] != null)
    .sort((a, b) => (a.includes('/') - b.includes('/')) || HTML_FILES.indexOf(a) - HTML_FILES.indexOf(b) || a.localeCompare(b));
  for (const h of htmlList) {
    const dir = dirOf(h);
    const mb = refMap(baseHtml[h], dir), tip = refMap(tipHtml[h], dir), head = refMap(headHtml[h], dir);
    for (const [file, ver] of head) {
      const bv = mb.get(file), tv = tip.has(file) ? tip.get(file) : bv;
      const touched = ver !== bv;                       // 이 브랜치가 그 줄을 고쳤나
      const after = touched ? ver : tv;
      if (ownOf(h, file)) {
        // [BUSTER-SUBAPP-1] 하위 앱 자기 파일 — REVIEW 수준만
        if (!after) { add('REVIEW', `${h}: ${file} 에 ?v= 없음`); continue; }
        if (changed.has(file) && bv !== undefined && !touched) add('REVIEW', `${h}: ${file} 를 고쳤는데 ?v= 그대로 (v=${after}) — import map · <script>/<link> 값 올리기`);
        else if (changed.has(file) && touched) add('PASS', `${h}: ${file} ${bv ?? '(새)'} → ${ver}`);
        continue;
      }
      if (touched && bv !== undefined && tv !== bv) {
        add('REVIEW', `${h}: ${file} 버스터를 main 도 바꿨음 (${bv} → main ${tv} / 이 브랜치 ${ver}) — 충돌 예상, rebase 뒤 다시 검사`);
      }
      (merged.get(file) || merged.set(file, []).get(file)).push({ html: h, ver: after });
      if (!after) { add('REVIEW', `${h}: ${file} 에 ?v= 없음`); continue; }
      if (changed.has(file)) {
        if (bv === undefined) add('PASS', `${h}: ${file} 새 참조 (v=${after})`);
        else if (!touched) add('FAIL', `${h}: ${file} 를 고쳤는데 버스터 안 올림 (머지 뒤 v=${after}) — 학생 브라우저가 옛 파일을 씀`);
        else if (behind(ver, tv)) add('FAIL', `${h}: ${file} 버스터 날짜가 main 보다 과거 (${ver} < ${tv}) — 오늘 날짜로 올리기`);
        else add('PASS', `${h}: ${file} ${tv} → ${ver}`);
      } else if (touched && bv !== undefined) {
        if (behind(ver, tv)) add('FAIL', `${h}: ${file} 는 안 고쳤는데 버스터 날짜가 과거로 감 (${tv} → ${ver}) — 머지하면 되돌림`);
        else add('REVIEW', `${h}: ${file} 는 안 고쳤는데 버스터만 바뀜 (${bv} → ${ver}) — 해는 없음`);
      }
    }
    if (!dir) continue;
    // [BUSTER-SUBAPP-1] 같은 html 안에서 <script src> 와 import map 값이 다르면 같은 모듈이 두 주소로 두 번 돈다.
    const refs = parseRefs(headHtml[h], dir);
    const byFile = new Map();
    for (const r of refs) (byFile.get(r.file) || byFile.set(r.file, new Set()).get(r.file)).add(r.ver);
    for (const [file, vs] of byFile) if (vs.size > 1) add('REVIEW', `${h}: ${file} 값이 html 안에서 다름 (${[...vs].join(' · ')}) — <script src> 와 import map 을 같은 값으로`);
    // import map 에 빠진 자기 js(./js/ 아래) — 버스터 없이 받아져 옛 캐시가 남는다.
    const mapped = new Set(refs.filter(r => r.via === 'importmap').map(r => r.file));
    if (mapped.size) {
      const pool = new Set([...(headFiles || []), ...changed]);
      for (const f of pool) {
        if (f.startsWith(dir + '/js/') && f.endsWith('.js') && !mapped.has(f) && (!headFiles || headFiles.includes(f))) {
          add('REVIEW', `${h}: ${f} 가 import map 에 없음 — 버스터 없이 받아짐`);
        }
      }
    }
  }
  for (const [file, list] of merged) {
    if (list.length < 2) continue;
    if (new Set(list.map(x => x.ver)).size > 1) add('FAIL', `${file} 버스터가 html 마다 다름(머지 뒤): ${list.map(x => `${x.html}=${x.ver}`).join(' · ')}`);
    else add('PASS', `${file} html ${list.length}곳 동일 (v=${list[0].ver})`);
  }
  for (const f of changed) {
    if (!/\.(js|css)$/.test(f) || (f.includes('/') && !f.startsWith('common/'))) continue;   // [BUSTER-COMMON-1] common/ 도 루트처럼
    if (!htmlList.some(h => refMap(headHtml[h], dirOf(h)).has(f))) add('REVIEW', `${f} 를 고쳤지만 어느 html 에서도 참조 안 함`);
  }
  return results;
}

// [BUSTER-COMMON-1] ⑤ 하위 앱이 부르는 common 모듈이 그 앱 import map 에 있는가.
//  앱 js(<폴더>/js/*.js)의 상대 import 를 따라가 common/*.js 에 닿으면(공통 모듈끼리 부르는 것도 따라감) 그 html 의 import map 에 있어야 한다.
//  read(file) = 그 파일 글(없으면 null). 정적 import · export … from · import('…') 만 본다(이 저장소 꼴).
export function commonGaps({ headHtml, headFiles, read }) {
  const out = [];
  for (const h of Object.keys(headHtml)) {
    const dir = dirOf(h); if (!dir || !headHtml[h]) continue;
    const refs = parseRefs(headHtml[h], dir).filter(r => r.via === 'importmap');
    if (!refs.length) continue;
    const mapped = new Set(refs.map(r => r.file)), seen = new Set(), miss = new Map();
    const todo = headFiles.filter(f => f.startsWith(dir + '/js/') && f.endsWith('.js'));
    while (todo.length) {
      const f = todo.pop(); if (seen.has(f)) continue; seen.add(f);
      const src = read(f) || '';
      for (const m of src.matchAll(/^\s*(?:import|export)\b[^'"\n]*?from\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
        const spec = m[1] || m[2]; if (!/^\.\.?\//.test(spec)) continue;
        const t = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec));
        if (!t.startsWith('common/')) continue;
        if (!mapped.has(t) && !miss.has(t)) miss.set(t, f);
        todo.push(t);
      }
    }
    for (const [t, f] of miss) out.push({ level: 'FAIL', msg: `${h}: ${f} 가 ${t} 를 부르는데 import map 에 없음 — ?v= 없이 받아져 옛 캐시가 남음 ("../${t}" 키 더하기)` });
    if (!miss.size && [...seen].some(f => f.startsWith('common/'))) out.push({ level: 'PASS', msg: `${h}: 부르는 common 모듈 ${[...seen].filter(f => f.startsWith('common/')).length}개 모두 import map 에 있음` });
  }
  return out;
}

// ── 실행 ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mb = git('merge-base', BASE, HEAD).trim();
  const changed = new Set(git('diff', '--name-only', `${mb}..${HEAD}`).split(/\r?\n/).filter(Boolean));
  const headFiles = git('ls-tree', '-r', '--name-only', HEAD).split(/\r?\n/).filter(Boolean);
  const subHtml = headFiles.filter(f => SUB_HTML_RE.test(f));
  const baseHtml = {}, tipHtml = {}, headHtml = {};
  for (const h of [...HTML_FILES, ...subHtml]) { baseHtml[h] = show(mb, h); tipHtml[h] = show(BASE, h); headHtml[h] = show(HEAD, h); }
  const res = check({ changed, baseHtml, tipHtml, headHtml, headFiles });
  res.push(...commonGaps({ headHtml, headFiles, read: f => show(HEAD, f) }));   // [BUSTER-COMMON-1]
  const icon = { PASS: '✅ PASS  ', REVIEW: '🟡 REVIEW', FAIL: '❌ FAIL  ' };
  console.log(`base ${BASE} (${git('rev-parse', '--short', BASE).trim()}) · head ${HEAD} (${git('rev-parse', '--short', HEAD).trim()}) · merge-base ${mb.slice(0, 7)} · 바뀐 파일 ${changed.size} · html ${HTML_FILES.length}+하위 앱 ${subHtml.length}`);
  for (const r of res) console.log(`${icon[r.level]} ${r.msg}`);
  const n = l => res.filter(r => r.level === l).length;
  console.log(`\n요약: PASS ${n('PASS')} · REVIEW ${n('REVIEW')} · FAIL ${n('FAIL')}`);
  process.exit(n('FAIL') ? 1 : 0);
}
