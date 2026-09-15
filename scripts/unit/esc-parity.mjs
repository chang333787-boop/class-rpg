#!/usr/bin/env node
// 우리반 성장 RPG — 출력 이스케이프 도우미 검사기 (read-only, 소스 읽기만) (ESC-PARITY-1)
//
//  escHtml · escJsAttr · safeUrl 은 student.js · admin.js · kiosk.js · watercolor/index.html 에 **따로 복사**돼 있다.
//  한 곳만 고치면 화면마다 다르게 새므로, 같은 입력에 같은 결과를 내는지 본다.
//  그리고 이스케이프가 **정상 이름을 망가뜨리지 않는지**(& · < · 따옴표 · 이모지가 브라우저에서 글자 그대로 보이는지)
//  HTML 디코드 → 원문 복원으로 확인한다. onclick 속성 안 JS 문자열은 디코드 → JS 해석 → 원문으로 확인한다.
//
//  사용: node scripts/unit/esc-parity.mjs   (FAIL 1개 이상이면 exit 1)
//  smoke·unit 기준선과 별개 파일 — 숫자를 바꾸지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['student.js', 'admin.js', 'kiosk.js', 'watercolor/index.html'];
const results = [];
const add = (ok, msg) => results.push({ ok, msg });

// 함수 원문 잘라 오기 — 한 줄짜리(watercolor)와 여러 줄 모두
function sliceFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) return src.slice(m.index, i + 1); }
  return null;
}
function load(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const fns = {};
  const ctx = {};
  vm.createContext(ctx);
  for (const name of ['escHtml', 'escJsAttr', 'safeUrl']) {
    const code = sliceFn(src, name);
    if (!code) continue;
    vm.runInContext(code + `\n;this.__${name} = ${name};`, ctx);
    fns[name] = ctx['__' + name];
  }
  return fns;
}
const decodeHtml = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const NAMES = ['김하나', "O'Neil", '민"수', 'A&B 반', '<b>굵게</b>', '🐯 호랑이', '', '  공백  ', 'a\\b', '1 < 2 > 0', "&amp; 이미", null, undefined, 0, 12345];
const URLS = [
  ['https://naver.com', 'https://naver.com'], ['HTTP://A.b/c?d=1&e=2', 'HTTP://A.b/c?d=1&e=2'], ['naver.com', 'https://naver.com'],
  ['//evil.com', 'https://evil.com'], ['javascript:alert(1)', ''], [' JavaScript:alert(1)', ''], ['java\tscript:alert(1)', ''],
  ['java\nscript:alert(1)', ''], ['data:text/html,<b>', ''], ['vbscript:x', ''], ['ftp://x.y/a', ''], ['file:///C:/a.txt', ''], ['chrome://settings', ''], ['', ''], [null, ''], [undefined, ''],
];

const impl = Object.fromEntries(FILES.map(f => [f, load(f)]));

// ① escHtml — 모든 파일에 있고, 결과가 같고, 디코드하면 원문, 위험 글자 5개가 남지 않는다
{
  const have = FILES.filter(f => impl[f].escHtml);
  add(have.length === FILES.length, `escHtml 있음: ${have.length}/${FILES.length} (${FILES.filter(f => !impl[f].escHtml).join(', ') || '빠짐 없음'})`);
  let same = true, round = true, clean = true;
  for (const v of NAMES) {
    const outs = have.map(f => impl[f].escHtml(v));
    if (new Set(outs).size !== 1) { same = false; add(false, `escHtml 결과가 파일마다 다름: ${JSON.stringify(v)} → ${JSON.stringify(Object.fromEntries(have.map((f, i) => [f, outs[i]])))}`); }
    const expect = v == null ? '' : String(v);
    if (decodeHtml(outs[0]) !== expect) { round = false; add(false, `escHtml 디코드가 원문과 다름: ${JSON.stringify(v)} → ${JSON.stringify(outs[0])}`); }
    if (/[<>"']|&(?!amp;|lt;|gt;|quot;|#39;)/.test(outs[0])) { clean = false; add(false, `escHtml 뒤 위험 글자 남음: ${JSON.stringify(outs[0])}`); }
  }
  if (same) add(true, `escHtml ${have.length}벌 결과 동일 (${NAMES.length}개 입력)`);
  if (round) add(true, 'escHtml → 브라우저 디코드 = 원문 (& · < · 따옴표 · 이모지 · 숫자 · null)');
  if (clean) add(true, 'escHtml 뒤 < > " \' 날 & 없음');
}

// ② escJsAttr — onclick="fn('${escJsAttr(x)}')" 가 디코드 → JS 해석 뒤 원문을 넘기는가
{
  const have = FILES.filter(f => impl[f].escJsAttr);
  add(have.length >= 1, `escJsAttr 있음: ${have.join(', ') || '없음'}`);
  for (const f of have) {
    let ok = true;
    for (const v of NAMES.filter(x => typeof x === 'string')) {
      const attr = `fn('${impl[f].escJsAttr(v)}')`;
      if (/"/.test(attr)) { ok = false; add(false, `${f} escJsAttr 뒤 큰따옴표가 남아 속성을 닫음: ${JSON.stringify(v)}`); continue; }
      let got;
      try { new Function('fn', decodeHtml(attr))((x) => { got = x; }); } catch (e) { ok = false; add(false, `${f} escJsAttr 뒤 JS 오류: ${JSON.stringify(v)} → ${e.name}`); continue; }
      if (got !== v) { ok = false; add(false, `${f} escJsAttr 가 원문을 못 넘김: ${JSON.stringify(v)} → ${JSON.stringify(got)}`); }
    }
    if (ok) add(true, `${f} escJsAttr: 따옴표·역슬래시·꺾쇠 이름이 onclick 에서 원문 그대로 넘어감`);
  }
}

// ③ safeUrl — 있는 파일끼리 같은 결과 + 기대값
{
  const have = FILES.filter(f => impl[f].safeUrl);
  add(have.length >= 1, `safeUrl 있음: ${have.join(', ') || '없음'}`);
  let ok = true;
  for (const [inp, exp] of URLS) {
    const outs = have.map(f => impl[f].safeUrl(inp));
    if (new Set(outs).size !== 1) { ok = false; add(false, `safeUrl 결과가 파일마다 다름: ${JSON.stringify(inp)} → ${JSON.stringify(outs)}`); }
    if (outs[0] !== exp) { ok = false; add(false, `safeUrl(${JSON.stringify(inp)}) = ${JSON.stringify(outs[0])} (기대 ${JSON.stringify(exp)})`); }
  }
  if (ok) add(true, `safeUrl ${have.length}벌 동일 · http(s)만 · 스킴 없으면 https · 제어 문자 섞은 javascript: 거부 (${URLS.length}개)`);
}

for (const r of results) console.log(`${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.msg}`);
const fail = results.filter(r => !r.ok).length;
console.log(`\n요약: PASS ${results.length - fail} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
