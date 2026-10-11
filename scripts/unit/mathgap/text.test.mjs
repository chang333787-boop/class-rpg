// 오늘의 수학 화면 글 검사(10-11 교사 '비문 · 맞춤법 · 어순까지') — mathgap/js(핵심 core 는 수학 빈칸 찾기 저장소의 npm test 가 검사) · student/mathgap.js
//  lint_ko.mjs = 수학 빈칸 찾기 tests/lint_ko.mjs 를 그대로 옮긴 것(바꾸면 둘 다)
//  node scripts/unit/mathgap/text.test.mjs
//   ① 고정 글: 수 뒤 조사 · 띄어쓰기 · 맞춤법 ② 바뀌는 값 바로 뒤에 붙은 조사(`${x}은`)는 조사 도우미(P · J · j · pn · jn …)를 거쳐야 함
//   늘 받침이 정해진 값이면 그 줄 끝에 '// 조사 고정: 까닭'을 단다.
//   (아래는 수학 빈칸 찾기 tests/src.test.mjs 와 같은 규칙)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lintKo } from "./lint_ko.mjs";

const ROOT = decodeURIComponent(new URL('../../../', import.meta.url).pathname);
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'core') walk(p); } else if (/\.js$/.test(f)) files.push(p); } };
walk(join(ROOT, 'mathgap/js')); files.push(join(ROOT, 'student/mathgap.js'));

// 글 꺼내기 — 따옴표 세 가지 · 템플릿 안의 ${ } 는 ⟨⟩로 바꾸고, 그 안의 글도 따로 꺼낸다 · 주석은 건너뜀
function strings(src) {
  const out = []; let i = 0, line = 1;
  const adv = () => { if (src[i] === '\n') line++; i++; };
  function tpl() {   // src[i] === '`'
    const start = line; let text = '', parts = []; adv();
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { text += src[i] + src[i + 1]; adv(); adv(); continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        adv(); adv(); let depth = 1, inner = '';
        while (i < src.length && depth) {
          const c = src[i];
          if (c === '`') { out.push(tpl()); inner += '``'; continue; }
          if (c === "'" || c === '"') { const s = quote(c); out.push(s); inner += `'${s.text}'`; continue; }
          if (c === '{') depth++;
          if (c === '}') { depth--; if (!depth) { adv(); break; } }
          inner += c; adv();
        }
        parts.push({ at: text.length, inner }); text += '⟨⟩'; continue;
      }
      text += src[i]; adv();
    }
    adv();
    return { text, parts, line: start };
  }
  function quote(q) { const start = line; let text = ''; adv(); while (i < src.length && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { text += src[i + 1]; adv(); adv(); continue; } text += src[i]; adv(); } adv(); return { text, parts: [], line: start }; }
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') adv(); continue; }
    if (c === '/' && src[i + 1] === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) adv(); adv(); adv(); continue; }
    if (c === '/' && /[=(,:;!&|?{}\[\n]\s*$/.test(src.slice(Math.max(0, i - 20), i))) {   // 정규식 글자 건너뜀
      adv(); let cls = false;
      while (i < src.length && src[i] !== '\n') { if (src[i] === '\\') { adv(); adv(); continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; adv(); }
      adv(); continue;
    }
    if (c === '`') { out.push(tpl()); continue; }
    if (c === "'" || c === '"') { out.push(quote(c)); continue; }
    adv();
  }
  return out;
}
const PART = /^(은|는|이|가|을|를|과|와|으로|로|이에요|예요)(?![가-힣])/;
const bad = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8'), lines = src.split('\n');
  for (const s of strings(src)) {
    if (!/[가-힣]/.test(s.text)) continue;
    const L = lines[s.line - 1] || '';
    if (/조사 고정/.test(L) || /조사 고정/.test(lines[s.line] || '') && /^\s*\/\//.test(lines[s.line] || '')) continue;
    const where = `${f}:${s.line}`;
    // ② 바뀌는 값 뒤 조사
    for (const p of s.parts) {
      const after = s.text.slice(p.at + 2), m = after.match(PART);
      if (!m) continue;
      const inner = p.inner.trim(), before = s.text.slice(0, p.at);
      if (/^\d+$/.test(inner)) continue;
      const fr = before.match(/(\d+)\/$/);   // 분자가 정해진 분수(1/${d}이) — 분자로 판정
      if (fr) { if (lintKo(`${fr[1]}/9${m[1]}`).length) bad.push(`${where} 조사: '${fr[1]}/\${…}${m[1]}'`); continue; }
      const lits = [...inner.matchAll(/'([^']*)'/g)].map((x) => x[1]);
      if (lits.length && inner.replace(/'[^']*'/g, '').replace(/[\s?:|()=!<>\w.]/g, '') === '') {   // 보기가 글자 그대로인 식
        const wrong = lits.filter((w) => w && lintKo(`${w}${m[1]}`, { nouns: [w] }).length);
        if (wrong.length) bad.push(`${where} 조사: '${wrong[0]}${m[1]}'`);
        continue;
      }
      bad.push(`${where} 바뀌는 값 뒤 조사 '\${${inner.slice(0, 40)}}${m[1]}' — 조사 도우미를 쓰거나 '조사 고정' 주석`);
    }
    // ① 고정 글 — HTML 이면 태그 · 줄 사이를 끊어 조각마다(들여쓰기 빈칸은 셈하지 않음)
    const segs = /<[a-z/][^>]*>|\n/.test(s.text) ? s.text.split(/<[^>]*>|\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => /[가-힣]/.test(x)) : [s.text];
    for (const seg of segs) for (const e of lintKo(seg)) bad.push(`${where} ${e} — ${seg.slice(0, 100)}`);
  }
}
for (const b of bad.slice(0, Number(process.env.SHOW || 80))) console.log('FAIL', b);
console.log(`오늘의 수학 화면 글 검사 — 파일 ${files.length}개 · ${bad.length ? 'FAIL ' + bad.length : 'PASS'}`);
process.exit(bad.length ? 1 : 0);
