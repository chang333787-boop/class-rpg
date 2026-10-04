// 우리반 성장 RPG — 가벼운 JS 토크나이저 + 최상위 문장 나누기 (JS-TOKENS-1, read-only 도우미)
//
//  저장소에 파서(acorn 등)를 들이지 않으려고 직접 만든 작은 낱말 자르기. 학생 코드 나누기 지도(SPLIT-MAP-6)에서
//  student.js 전체로 검증한 것을 옮겨 왔다. 쓰는 곳: scripts/unit/deco-lazy-check.mjs(꾸미기 늦게 불러오기 진입점 검사).
//   tokenize(src)          → [{ type: 'id'|'num'|'str'|'tpl'|'regex'|'punc', value, line, pos, end }]
//                            템플릿 글자는 'tpl' 조각과 '${' … '}$' 사이 토큰으로 나뉜다(안의 식도 토큰으로 본다).
//   topStatements(src, toks) → 최상위 문장 [{ startTok, endTok, startLine, endLine, pos, end, head }]
//  완벽한 파서는 아니다(정규식 앞뒤 판단은 직전 토큰으로 추측) — 이 저장소의 학생 코드에서 맞게 도는 것만 확인했다.

const KW_BEFORE_REGEX = new Set(['return','typeof','instanceof','in','of','new','delete','void','throw','case','do','else','yield','await']);
const KEYWORDS = new Set(['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','let','new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield','await','async','of','null','true','false','undefined','static','get','set']);

export function tokenize(src) {
  const toks = [];
  let i = 0, line = 1;
  const n = src.length;
  const braceStack = []; // 'b' normal brace, 't' template-expression brace
  let prev = null; // previous significant token
  const push = (t) => { toks.push(t); prev = t; };
  const isIdStart = c => /[A-Za-z_$\u0080-￿]/.test(c);
  const isId = c => /[A-Za-z0-9_$\u0080-￿]/.test(c);
  function regexAllowed() {
    if (!prev) return true;
    if (prev.type === 'num' || prev.type === 'str' || prev.type === 'tpl' || prev.type === 'regex') return false;
    if (prev.type === 'id') return KW_BEFORE_REGEX.has(prev.value);
    if (prev.type === 'punc') return !(prev.value === ')' || prev.value === ']' || prev.value === '}' || prev.value === '++' || prev.value === '--');
    return true;
  }
  function scanTemplate(startLine, startPos) {
    // i points just after ` or after } closing ${...}
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += src[i] + (src[i+1]||''); if (src[i+1] === '\n') line++; i += 2; continue; }
      if (c === '`') { i++; push({ type: 'tpl', value: s, line: startLine, pos: startPos, end: i, tplEnd: true }); return; }
      if (c === '$' && src[i+1] === '{') { i += 2; push({ type: 'tpl', value: s, line: startLine, pos: startPos, end: i, tplEnd: false }); braceStack.push('t'); push({ type: 'punc', value: '${', line, pos: i-2, end: i }); return; }
      if (c === '\n') line++;
      s += c; i++;
    }
    throw new Error('unterminated template at line ' + startLine);
  }
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '﻿' || c === ' ') { i++; continue; }
    if (c === '/' && src[i+1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i+1] === '*') { const e = src.indexOf('*/', i+2); for (let k = i; k < e; k++) if (src[k] === '\n') line++; i = e + 2; continue; }
    const pos = i, l0 = line;
    if (c === '"' || c === "'") {
      let s = ''; i++;
      while (i < n && src[i] !== c) { if (src[i] === '\\') { s += src[i] + src[i+1]; if (src[i+1]==='\n') line++; i += 2; continue; } if (src[i] === '\n') throw new Error('newline in string at ' + line); s += src[i++]; }
      i++; push({ type: 'str', value: s, line: l0, pos, end: i }); continue;
    }
    if (c === '`') { i++; scanTemplate(l0, pos); continue; }
    if (c === '/' && regexAllowed()) {
      i++; let inClass = false;
      while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '\n') throw new Error('newline in regex at ' + line); if (inClass) { if (d === ']') inClass = false; } else if (d === '[') inClass = true; else if (d === '/') break; i++; }
      i++; while (i < n && /[a-z]/.test(src[i])) i++;
      push({ type: 'regex', value: src.slice(pos, i), line: l0, pos, end: i }); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i+1]))) {
      while (i < n && /[0-9A-Za-z_.]/.test(src[i])) { if ((src[i] === 'e' || src[i] === 'E') && (src[i+1] === '+' || src[i+1] === '-')) i++; i++; }
      push({ type: 'num', value: src.slice(pos, i), line: l0, pos, end: i }); continue;
    }
    if (isIdStart(c) || c === '\\') {
      while (i < n && isId(src[i])) i++;
      push({ type: 'id', value: src.slice(pos, i), line: l0, pos, end: i }); continue;
    }
    if (c === '#' ) { i++; while (i < n && isId(src[i])) i++; push({ type: 'id', value: src.slice(pos, i), line: l0, pos, end: i }); continue; }
    // punctuators
    const p4 = src.substr(i, 4), p3 = src.substr(i, 3), p2 = src.substr(i, 2);
    let p;
    if (['>>>='].includes(p4)) p = p4;
    else if (['===','!==','**=','<<=','>>=','>>>','...','&&=','||=','??='].includes(p3)) p = p3;
    else if (['=>','==','!=','<=','>=','&&','||','??','?.','++','--','+=','-=','*=','/=','%=','&=','|=','^=','<<','>>','**'].includes(p2)) p = p2;
    else p = c;
    if (p === '?.' && /[0-9]/.test(src[i+2])) p = '?';
    i += p.length;
    if (p === '{') braceStack.push('b');
    if (p === '}') {
      const top = braceStack.pop();
      if (top === 't') { push({ type: 'punc', value: '}$', line: l0, pos, end: i }); scanTemplate(line, i); continue; }
    }
    push({ type: 'punc', value: p, line: l0, pos, end: i });
  }
  return toks;
}

// 최상위 문장 나누기: 토큰 깊이 0 기준
export function topStatements(src, toks) {
  const stmts = [];
  let depth = 0, start = 0;
  const OPEN = new Set(['(', '[', '{', '${']), CLOSE = new Set([')', ']', '}', '}$']);
  const endsWith = new Set(['function', 'class', 'if', 'for', 'while', 'try', 'switch', 'do']);
  const contPunc = new Set(['.', '?.', ',', '=', '+', '-', '*', '/', '%', '&&', '||', '??', '?', ':', '=>', '(', '[', '===', '!==', '==', '!=', '<', '>', '<=', '>=', '+=', '-=', '|', '&', '^', '...', '!']);
  let headKind = null;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (k === start) {
      headKind = t.type === 'id' ? t.value : (t.type === 'punc' ? t.value : t.type);
      if (headKind === 'async' && toks[k+1] && toks[k+1].value === 'function') headKind = 'function';
    }
    if (t.type === 'punc' && OPEN.has(t.value)) depth++;
    else if (t.type === 'punc' && CLOSE.has(t.value)) depth--;
    if (depth !== 0) continue;
    const next = toks[k+1];
    let end = false;
    if (t.type === 'punc' && t.value === ';') end = !(next && next.type === 'id' && next.value === 'else');
    else if (t.type === 'punc' && t.value === '}' && endsWith.has(headKind)) {
      // function/class decl body 끝? else/catch/finally/while 이어짐
      if (next && next.type === 'id' && ['else', 'catch', 'finally'].includes(next.value)) end = false;
      else if (headKind === 'do') end = false;
      else if (headKind === 'if' || headKind === 'for' || headKind === 'while' || headKind === 'try' || headKind === 'switch' || headKind === 'function' || headKind === 'class') {
        // 함수/클래스 '선언'만 여기서 끝(표현식 아님 — 문장 머리면 선언)
        end = true;
      }
    } else if (next && next.line > t.line) {
      // ASI 후보
      const tEndsExpr = !(t.type === 'punc' && contPunc.has(t.value)) && !(t.type === 'id' && ['return','typeof','new','in','of','instanceof','else','const','let','var','function','async','await','case'].includes(t.value)) && !(t.type === 'tpl' && !t.tplEnd);
      const nextCont = (next.type === 'punc' && contPunc.has(next.value) && next.value !== '!') || (next.type === 'tpl');
      const nextContId = next.type === 'id' && ['in', 'of', 'instanceof'].includes(next.value);
      if (tEndsExpr && !nextCont && !nextContId && !(t.type === 'punc' && t.value === '}' && headKind === 'do')) end = true;
    }
    if (!next) end = true;
    if (end) {
      const a = toks[start], b = t;
      stmts.push({ startTok: start, endTok: k, startLine: a.line, endLine: b.line, pos: a.pos, end: b.end, head: headKind });
      start = k + 1;
    }
  }
  return stmts;
}

