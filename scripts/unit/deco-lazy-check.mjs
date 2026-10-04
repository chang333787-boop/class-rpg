#!/usr/bin/env node
// 우리반 성장 RPG — 꾸미기 늦게 불러오기 진입점 검사 (DECO-LAZY-CHECK-1, read-only)
//
//  student/deco.js 는 html 태그 없이 꾸미기·친구 마당을 열 때 student.js 의 decoLoad() 가 부른다(DECO-LAZY-1).
//  불러오기 **전에는 deco.js 의 이름이 없다** — 바깥에서 부르면 ReferenceError(단추 먹통), 대입하면 불러올 때 deco.js 의 let 에 가려 값이 사라진다.
//  그래서 deco.js 최상위 이름 × 바깥 참조(student.html 이 부르는 다른 스크립트 · student.html 인라인 처리기 · 스크립트가 만드는 onclick 글자)를
//  전부 찾아 셋 중 하나인지 본다:
//   ① 지킴이     student.js 의 `window.이름 = function …` — 불러온 뒤 진짜로 이어 부른다. deco.js 쪽은 function 선언이어야 진짜로 바뀌어 끼워진다.
//   ② 가드       같은 줄에 `typeof 이름` — 없으면 건너뛴다.
//   ③ 불러온 뒤만 (a) html: deco.js 만 띄우는 판(AFTER_LOAD_BOXES) 안의 처리기
//                 (b) `decoLoad().then(…)` 콜백 안
//                 (c) AFTER_LOAD 목록(파일 · 그 줄 모양 · 까닭) — 예: `if (_ifMode) _drawDeco()`(마당이 열려 있을 때만)
//  그 밖은 FAIL. 같은 최상위 문장(함수·IIFE) 안에서 같은 이름을 지역으로 선언했으면 다른 뜻이라 건넌다(예: figures.js 의 DY).
//  이 밖에도 본다: 지킴이 이름이 deco.js 에 function 으로 있나 · decoLoad·DECO_SRC(?v=) 가 있나 · deco.js 맨 끝 줄이 _decoReadyMark 인가 ·
//                  AFTER_LOAD_BOXES 판을 바깥 파일이 띄우지 않나(띄우면 (a) 판정이 깨진다).
//
//  사용: node scripts/unit/deco-lazy-check.mjs [--list]     (--list = 바깥 참조를 한 줄씩 다 찍는다)
//  판정: FAIL 1개 이상이면 exit 1. deco.js 가 늦게 부르는 파일이 아니면(LAZY_STUDENT_FILES 에 없음) SKIP.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize, topStatements } from './js-tokens.mjs';
import { LAZY_STUDENT_FILES } from './student-sources.mjs';
import { classicScripts } from './global-dup-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DECO = 'student/deco.js';

// 불러온 뒤에만 화면에 뜨는 판 — 이 안의 html 처리기는 deco.js 가 있을 때만 눌린다
export const AFTER_LOAD_BOXES = {
  'interior-fullscreen': '꾸미기 전체화면 — deco.js 의 openInteriorFullscreen 만 띄운다',
  'friend-fullscreen': '친구 마당 구경 — deco.js 의 openFriendFullscreen 만 띄운다',
  'floor-tile-row': '옛 바닥 단추 줄(늘 숨김) — deco.js 의 setDecoMode 만 보인다',
};
// 불러온 뒤에만 도는 JS 자리 — { file, name, line: 그 줄 모양, why }
export const AFTER_LOAD = [
  { file: 'student.js', name: '_drawDeco', line: /\bif \(_ifMode\) _drawDeco\(\)/, why: '마당이 열려 있을 때만(_ifMode 는 deco.js 의 openInteriorFullscreen 이 켠다)' },
];

const OPEN = new Set(['(', '[', '{', '${']), CLOSE = new Set([')', ']', '}', '}$']);

// deco.js 최상위 선언 이름 → kind
export function topNames(src) {
  const toks = tokenize(src), names = new Map();
  for (const s of topStatements(src, toks)) {
    const T = toks.slice(s.startTok, s.endTok + 1), t0 = T[0];
    if (t0.value === 'function' || (t0.value === 'async' && T[1] && T[1].value === 'function')) {
      let k = t0.value === 'async' ? 2 : 1; if (T[k] && T[k].value === '*') k++;
      if (T[k] && T[k].type === 'id') names.set(T[k].value, { kind: 'function', line: s.startLine });
    } else if (t0.value === 'class' && T[1]) names.set(T[1].value, { kind: 'class', line: s.startLine });
    else if (['let', 'const', 'var'].includes(t0.value)) {
      let d = 0, expect = true;
      for (let k = 1; k < T.length; k++) {
        const t = T[k];
        if (d === 0 && expect && t.type === 'id') { names.set(t.value, { kind: t0.value, line: s.startLine }); expect = false; continue; }
        if (d === 0 && expect && (t.value === '{' || t.value === '[')) {   // 구조분해 — 안의 이름들
          let dd = 0;
          for (; k < T.length; k++) {
            if (OPEN.has(T[k].value)) dd++; else if (CLOSE.has(T[k].value)) { dd--; if (dd === 0) break; }
            else if (T[k].type === 'id' && [',', '}', ']', '='].includes(T[k + 1] && T[k + 1].value)) names.set(T[k].value, { kind: t0.value, line: s.startLine });
          }
          expect = false; continue;
        }
        if (OPEN.has(t.value)) d++; else if (CLOSE.has(t.value)) d--;
        else if (d === 0 && t.value === ',') expect = true;
      }
    }
  }
  return names;
}

// 한 최상위 문장 안에서 지역으로 묶이는 이름(선언·매개변수·catch) — 같은 문장 안의 참조는 다른 뜻이다
function localNames(T) {
  const out = new Set();
  const params = (a, b) => {   // T[a] = '(' … T[b] = ')' 사이 매개변수 이름(기본값 식 안은 빼고)
    let d = 0;
    for (let k = a + 1; k < b; k++) {
      const t = T[k];
      if (OPEN.has(t.value)) { d++; continue; } if (CLOSE.has(t.value)) { d--; continue; }
      if (t.type === 'id' && [',', ')', '=', '}', ']'].includes(T[k + 1] && T[k + 1].value) && !(T[k - 1] && T[k - 1].value === '=')) out.add(t.value);
    }
  };
  const match = (k) => { let d = 0; for (let j = k; j < T.length; j++) { if (OPEN.has(T[j].value)) d++; else if (CLOSE.has(T[j].value)) { d--; if (d === 0) return j; } } return T.length - 1; };
  const back = (k) => { let d = 0; for (let j = k; j >= 0; j--) { if (CLOSE.has(T[j].value)) d++; else if (OPEN.has(T[j].value)) { d--; if (d === 0) return j; } } return 0; };
  for (let k = 0; k < T.length; k++) {
    const t = T[k];
    if (t.type !== 'id' && t.type !== 'punc') continue;
    if (['let', 'const', 'var'].includes(t.value) && t.type === 'id') {
      let d = 0, expect = true;
      for (let j = k + 1; j < T.length; j++) {
        const u = T[j];
        if (d === 0 && expect && u.type === 'id') { out.add(u.value); expect = false; continue; }
        if (d === 0 && expect && (u.value === '{' || u.value === '[')) { params(j - 1 < 0 ? 0 : j, match(j)); j = match(j); expect = false; continue; }
        if (OPEN.has(u.value)) d++; else if (CLOSE.has(u.value)) { if (d === 0) break; d--; }
        else if (d === 0 && (u.value === ';' || (u.type === 'id' && ['of', 'in'].includes(u.value)))) break;
        else if (d === 0 && u.value === ',') expect = true;
      }
    } else if (t.value === 'function' && t.type === 'id') {
      let j = k + 1; if (T[j] && T[j].value === '*') j++;
      if (T[j] && T[j].type === 'id') { if (k > 0) out.add(T[j].value); j++; }
      if (T[j] && T[j].value === '(') params(j, match(j));
    } else if (t.value === 'catch' && T[k + 1] && T[k + 1].value === '(') params(k + 1, match(k + 1));
    else if (t.value === 'class' && T[k + 1] && T[k + 1].type === 'id' && k > 0) out.add(T[k + 1].value);
    else if (t.value === '=>') {
      const p = T[k - 1];
      if (p && p.type === 'id') out.add(p.value);
      else if (p && p.value === ')') params(back(k - 1), k - 1);
    }
  }
  return out;
}

// 토큰 k 가 `decoLoad().then(` 의 괄호 안에 있나
function insideDecoThen(T, k) {
  let d = 0;
  for (let j = k - 1; j >= 0; j--) {
    const v = T[j].value;
    if (CLOSE.has(v)) d++;
    else if (OPEN.has(v)) {
      if (d > 0) { d--; continue; }
      if (v === '(' && T[j - 1] && T[j - 1].value === 'then' && T[j - 2] && T[j - 2].value === '.' && T[j - 3] && T[j - 3].value === ')'
        && T[j - 4] && T[j - 4].value === '(' && T[j - 5] && T[j - 5].value === 'decoLoad') return true;
    }
  }
  return false;
}

// 한 JS 글자 안의 deco 이름 참조 → [{ name, line, how: 'id'|'string', guard, afterThen, text }]
export function findRefs(src, names, { lineBase = 0 } = {}) {
  const toks = tokenize(src), L = src.split('\n'), out = [];
  const nameRe = new RegExp('(?<![\\w$.])(' + [...names].map(n => n.replace(/\$/g, '\\$')).sort((a, b) => b.length - a.length).join('|') + ')\\s*(?:\\(|=(?!=))', 'g');
  for (const s of topStatements(src, toks)) {
    const T = toks.slice(s.startTok, s.endTok + 1);
    let locals = null;
    for (let k = 0; k < T.length; k++) {
      const t = T[k];
      if (t.type === 'id' && names.has(t.value)) {
        const prev = T[k - 1], prev2 = T[k - 2];
        if (prev && (prev.value === '.' || prev.value === '?.') && !(prev2 && ['window', 'globalThis', 'self'].includes(prev2.value))) continue;   // 남의 속성
        if (T[k + 1] && T[k + 1].value === ':' && prev && (prev.value === '{' || prev.value === ',')) continue;   // 객체 키
        if (prev && prev.value === 'function' && k === 1) continue;
        if (!locals) locals = localNames(T);
        if (locals.has(t.value)) { out.push({ name: t.value, line: lineBase + t.line, how: 'local', text: (L[t.line - 1] || '').trim() }); continue; }
        const text = L[t.line - 1] || '';
        const guard = new RegExp(`typeof\\s+(?:window\\.)?${t.value.replace(/\$/g, '\\$')}\\b`).test(text);
        out.push({ name: t.value, line: lineBase + t.line, how: 'id', guard, afterThen: insideDecoThen(T, k), text: text.trim() });
      } else if (t.type === 'str' || t.type === 'tpl') {
        for (const m of t.value.matchAll(nameRe)) {
          const ln = t.line + (t.value.slice(0, m.index).split('\n').length - 1);
          out.push({ name: m[1], line: lineBase + ln, how: 'string', guard: false, afterThen: insideDecoThen(T, k), text: (L[ln - 1] || '').trim() });
        }
      }
    }
  }
  return out;
}

// html 안 요소(id) 의 [시작, 끝) 글자 범위 — 같은 태그 이름의 열고 닫기를 센다
export function elementRange(html, id) {
  const m = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="${id}"`).exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase(), re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = m.index; let d = 0, x;
  while ((x = re.exec(html))) { if (x[1]) { d--; if (d === 0) return [m.index, re.lastIndex]; } else if (!x[0].endsWith('/>')) d++; }
  return [m.index, html.length];
}

// html 인라인 처리기(on…="…") 안의 deco 이름 참조
export function htmlRefs(html, names) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));   // 주석은 지우되 줄·글자 자리는 그대로
  const boxes = Object.keys(AFTER_LOAD_BOXES).map(id => ({ id, r: elementRange(clean, id) })).filter(b => b.r);
  const out = [];
  for (const m of clean.matchAll(/\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const code = (m[1] != null ? m[1] : m[2]).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const line = clean.slice(0, m.index).split('\n').length;
    let refs; try { refs = findRefs(code, names); } catch (e) { continue; }
    const box = boxes.find(b => m.index >= b.r[0] && m.index < b.r[1]);
    for (const r of refs) out.push({ ...r, line: line + r.line - 1, box: box ? box.id : null, text: code.trim().slice(0, 120) });
  }
  return out;
}

// 판정 — { decoSrc, studentSrc, files: [{label, src}], html } → { rows, fails, counts }
export function judge({ decoSrc, studentSrc, files, html }) {
  const names = topNames(decoSrc), set = new Set(names.keys());
  const fails = [], rows = [];
  const counts = { '지킴이': 0, '가드': 0, '불러온 뒤만': 0, '지역 이름': 0 };
  // 지킴이: student.js 의 window.이름 = function
  const stubs = new Set([...String(studentSrc).matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=\s*function\b/g)].map(m => m[1]).filter(n => set.has(n)));
  for (const n of stubs) if (names.get(n).kind !== 'function') fails.push(`지킴이 ${n} — deco.js 쪽이 function 선언이 아님(${names.get(n).kind}) · 불러와도 진짜로 안 바뀐다`);
  const refs = [];
  for (const f of files) for (const r of findRefs(f.src, set)) refs.push({ ...r, file: f.label });
  for (const r of htmlRefs(html, set)) refs.push({ ...r, file: 'student.html' });
  for (const r of refs) {
    let how = null, why = '';
    if (r.how === 'local') { how = '지역 이름'; why = '같은 함수 안 지역 이름(다른 뜻)'; }
    else if (stubs.has(r.name)) { how = '지킴이'; why = 'window.' + r.name + ' 지킴이'; }
    else if (r.guard) { how = '가드'; why = 'typeof ' + r.name; }
    else if (r.afterThen) { how = '불러온 뒤만'; why = 'decoLoad().then 안'; }
    else if (r.box) { how = '불러온 뒤만'; why = '#' + r.box + ' 안 — ' + AFTER_LOAD_BOXES[r.box]; }
    else { const a = AFTER_LOAD.find(x => x.file === r.file && x.name === r.name && x.line.test(r.text)); if (a) { how = '불러온 뒤만'; why = a.why; } }
    if (!how) fails.push(`${r.file}:${r.line} ${r.name} — 불러오기 전에 불릴 수 있는 자리(지킴이·typeof 가드·불러온 뒤만 아님): ${r.text.slice(0, 100)}`);
    else counts[how]++;
    rows.push({ ...r, verdict: how || 'FAIL', why });
  }
  // AFTER_LOAD 판을 바깥 파일이 띄우면 (a) 판정이 깨진다
  for (const f of files) {
    f.src.split('\n').forEach((l, i) => {
      for (const id of Object.keys(AFTER_LOAD_BOXES)) {
        if (!l.includes(`'${id}'`) && !l.includes(`"${id}"`)) continue;
        if (/\.style\.display\s*=\s*(?!['"]none['"])/.test(l) || /classList\.(?:add|toggle)\(/.test(l)) fails.push(`${f.label}:${i + 1} #${id} 를 deco.js 밖에서 띄움 — 그 안 단추가 불러오기 전에 눌릴 수 있다`);
      }
    });
  }
  return { names, stubs, rows, fails, counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const LIST = process.argv.includes('--list');
  const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
  if (!LAZY_STUDENT_FILES.includes(DECO)) { console.log(`요약: SKIP · ${DECO} 는 늦게 부르는 파일이 아님(student-sources LAZY_STUDENT_FILES)`); process.exit(0); }
  const html = read('student.html'), decoSrc = read(DECO), studentSrc = read('student.js');
  const files = classicScripts(html, '', read, 'student.html').filter(s => !s.label.includes('#inline') && !LAZY_STUDENT_FILES.includes(s.label));
  const { names, stubs, rows, fails, counts } = judge({ decoSrc, studentSrc, files, html });
  // 뼈대: decoLoad · DECO_SRC(?v=) · 맨 끝 표시
  if (!/^function decoLoad\(/m.test(studentSrc)) fails.push('student.js 에 function decoLoad( 가 없음');
  if (!new RegExp(`['"\`]\\./${DECO.replace(/[./]/g, '\\$&')}\\?v=[\\w.-]+['"\`]`).test(studentSrc)) fails.push(`student.js 에 './${DECO}?v=…' 주소가 없음`);
  const lastLine = decoSrc.trimEnd().split('\n').pop();
  if (!/^const _decoReadyMark = true;/.test(lastLine)) fails.push(`${DECO} 맨 끝 줄이 'const _decoReadyMark = true;' 가 아님 — 중간에서 멈춰도 다 불렀다고 볼 수 있다`);
  const byName = new Map();
  for (const r of rows) (byName.get(r.name) || byName.set(r.name, []).get(r.name)).push(r);
  console.log(`${DECO} 최상위 이름 ${names.size}개 · 바깥에서 쓰는 이름 ${byName.size}개 · 자리 ${rows.length}곳 · 지킴이 ${[...stubs].join('·') || '없음'}`);
  const icon = { '지킴이': '✅', '가드': '✅', '불러온 뒤만': '✅', '지역 이름': '·', FAIL: '❌' };
  for (const [n, rs] of byName) {
    const groups = new Map();
    for (const r of rs) { const k = r.verdict + ' | ' + r.why; (groups.get(k) || groups.set(k, []).get(k)).push(`${r.file}:${r.line}`); }
    for (const [k, w] of groups) { const [v, why] = k.split(' | '); console.log(`${icon[v]} ${v.padEnd(6)} ${n} — ${why} · ${w.length}곳 ${LIST ? w.join(', ') : w.slice(0, 3).join(', ') + (w.length > 3 ? ' …' : '')}`); }
  }
  for (const f of fails) console.log('❌ FAIL  ' + f);
  console.log(`\n요약: ${fails.length ? 'FAIL ' + fails.length : 'PASS'} · 바깥 참조 ${rows.length}곳 — 지킴이 ${counts['지킴이']} · 가드 ${counts['가드']} · 불러온 뒤만 ${counts['불러온 뒤만']} · 지역 이름 ${counts['지역 이름']}`);
  process.exit(fails.length ? 1 : 0);
}
