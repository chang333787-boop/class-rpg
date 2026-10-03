// 프로그램 = 블록 나무(AST)  ·  짧은 글(판 정답 · 고치기 판의 틀린 코드) ↔ AST ↔ Blockly 저장 꼴
//  AST 마디 = { id?, t, n?(반복 횟수), v?(걸음 · 각도 · 색 · 주머니 이름), e?(값 식), body?, else?, name?, params?, args? }
//  값 식 e = { k:'num', n } | { k:'var', v } | { k:'op', op:'+ - * / ^', a, b }   ([CODING-U7] 주머니(변수) · 셈)
//  짧은 글: F 앞으로 · L 왼쪽 돌기 · R 오른쪽 돌기 · U D W E 위·아래·왼쪽·오른쪽(게) · J 두 칸 뛰기 · P 도토리 줍기
//           n( … ) n번 반복 · f100 붓 앞으로 100 · r90 오른쪽 90도 · l90 왼쪽 90도 · c빨강 붓 색 · pu 붓 들기 · pd 붓 내리기
//           I:살피기( … ) 만약 · E:살피기( … | … ) 만약/아니면 · U( … ) 집에 닿을 때까지 반복   [CODING-U5]
//           set(걸음,10) 넣기 · add(걸음,10) 늘리기 · f[걸음] r[360/변] 값 칸 붓 · [변]( … ) 값 칸 반복                [CODING-U7]
//           D:기술:받는값,받는값( … ) 기술(함수) 만들기 · C:기술(값,값) 기술 쓰기                                         [CODING-U8]
import { PEN_COLORS } from './world.js';

export const T2TYPE = { fwd: 'm_fwd', left: 'm_left', right: 'm_right', up: 'm_up', down: 'm_down', west: 'm_west', east: 'm_east', jump: 'm_jump', pick: 'm_pick',
  repeat: 'c_repeat', if: 'c_if', ifelse: 'c_ifelse', until: 'c_until', pf: 'p_fwd', pr: 'p_right', pl: 'p_left', pc: 'p_color', pu: 'p_pen', pd: 'p_pen',
  set: 'variables_set', change: 'math_change', call: 'procedures_callnoreturn', def: 'procedures_defnoreturn' };
const V_TYPE = { repeat: 'c_repeat_v', pf: 'p_fwd_v', pr: 'p_right_v', pl: 'p_left_v' };   // 값 칸 꼴(7단원부터)
const TYPE2T = { m_fwd: 'fwd', m_left: 'left', m_right: 'right', m_up: 'up', m_down: 'down', m_west: 'west', m_east: 'east', m_jump: 'jump', m_pick: 'pick',
  c_repeat: 'repeat', c_if: 'if', c_ifelse: 'ifelse', c_until: 'until', p_fwd: 'pf', p_right: 'pr', p_left: 'pl', p_color: 'pc', p_pen: 'pen',
  c_repeat_v: 'repeat', p_fwd_v: 'pf', p_right_v: 'pr', p_left_v: 'pl', variables_set: 'set', math_change: 'change', procedures_callnoreturn: 'call' };
const LETTER = { F: 'fwd', L: 'left', R: 'right', U: 'up', D: 'down', W: 'west', E: 'east', J: 'jump', P: 'pick' };
const OPS = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '^' }, OP_NAME = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));

// 값 식 글 → e  (곱셈·나눗셈 먼저 · 괄호 없음)
export function parseExpr(src) {
  const toks = String(src).match(/\d+(\.\d+)?|[+\-*/^]|[^\s+\-*/^]+/g) || ['0'];
  let i = 0;
  const atom = () => { const k = toks[i++]; return /^\d/.test(k) ? { k: 'num', n: parseFloat(k) } : { k: 'var', v: k }; };
  const prod = () => { let a = atom(); while (toks[i] === '*' || toks[i] === '/' || toks[i] === '^') { const op = toks[i++]; a = { k: 'op', op, a, b: atom() }; } return a; };
  let a = prod(); while (toks[i] === '+' || toks[i] === '-') { const op = toks[i++]; a = { k: 'op', op, a, b: prod() }; }
  return a;
}

export function parse(src) {
  const toks = String(src).match(/D:[^:()\s]+:[^()\s]*\(|C:[^()\s]+\([^)]*\)|set\([^)]*\)|add\([^)]*\)|\[[^\]]+\]\(|[frl]\[[^\]]+\]|\d+\(|[IE]:[a-zA-Z]+\(|U\(|\)|\||pu|pd|f\d+|r\d+|l\d+|c[^\s()|]+|[FLRUDWEJP]/g) || [];
  let i = 0;
  const list = () => {
    const out = [];
    while (i < toks.length && toks[i] !== ')' && toks[i] !== '|') {
      const k = toks[i++];
      if (/^\d+\($/.test(k)) { const body = list(); i++; out.push({ t: 'repeat', n: parseInt(k, 10), body }); }
      else if (/^\[.+\]\($/.test(k)) { const body = list(); i++; out.push({ t: 'repeat', e: parseExpr(k.slice(1, -2)), body }); }
      else if (/^I:/.test(k)) { const body = list(); i++; out.push({ t: 'if', c: k.slice(2, -1), body }); }
      else if (/^E:/.test(k)) { const body = list(); i++; const els = list(); i++; out.push({ t: 'ifelse', c: k.slice(2, -1), body, else: els }); }
      else if (k === 'U(') { const body = list(); i++; out.push({ t: 'until', body }); }
      else if (/^D:/.test(k)) { const [, name, ps] = k.slice(0, -1).split(':'); const body = list(); i++; out.push({ t: 'def', name, params: ps ? ps.split(',').filter(Boolean) : [], body }); }
      else if (/^C:/.test(k)) { const m = /^C:([^(]+)\((.*)\)$/.exec(k); out.push({ t: 'call', name: m[1], args: m[2] ? m[2].split(',').map(parseExpr) : [] }); }
      else if (/^set\(/.test(k)) { const [v, x] = k.slice(4, -1).split(','); out.push({ t: 'set', v, e: parseExpr(x) }); }
      else if (/^add\(/.test(k)) { const [v, x] = k.slice(4, -1).split(','); out.push({ t: 'change', v, e: parseExpr(x) }); }
      else if (/^[frl]\[/.test(k)) out.push({ t: { f: 'pf', r: 'pr', l: 'pl' }[k[0]], e: parseExpr(k.slice(2, -1)) });
      else if (LETTER[k]) out.push({ t: LETTER[k] });
      else if (k === 'pu' || k === 'pd') out.push({ t: k });
      else if (/^[frl]\d+$/.test(k)) out.push({ t: { f: 'pf', r: 'pr', l: 'pl' }[k[0]], v: parseInt(k.slice(1), 10) });
      else if (k[0] === 'c') { const c = PEN_COLORS.find(([n]) => n === k.slice(1)); out.push({ t: 'pc', v: c ? c[1] : k.slice(1) }); }
    }
    return out;
  };
  return list();
}

// 블록 수 — 명령 블록만 센다(값 칸에 넣은 숫자 · 주머니 · 셈 블록은 안 셈) · 반복/만약/기술은 하나 + 안쪽
export const countBlocks = ast => ast.reduce((a, b) => a + 1 + (b.body ? countBlocks(b.body) : 0) + (b.else ? countBlocks(b.else) : 0), 0);
export const usesCall = ast => ast.some(b => b.t === 'call' || (b.body && usesCall(b.body)) || (b.else && usesCall(b.else)));

// ── Blockly 블록 → AST ──
const varName = (b, f) => { try { return b.getField(f).getText(); } catch (e) { return ''; } };
export function exprOf(b) {
  if (!b) return { k: 'num', n: 0 };
  if (b.type === 'math_number') return { k: 'num', n: Number(b.getFieldValue('NUM')) || 0 };
  if (b.type === 'variables_get') return { k: 'var', v: varName(b, 'VAR') };
  if (b.type === 'math_arithmetic') return { k: 'op', op: OPS[b.getFieldValue('OP')] || '+', a: exprOf(b.getInputTargetBlock('A')), b: exprOf(b.getInputTargetBlock('B')) };
  return { k: 'num', n: 0 };
}
export function astFromBlock(first) {
  const out = [];
  for (let b = first; b; b = b.getNextBlock()) {
    if (b.isEnabled && !b.isEnabled()) continue;
    const t = TYPE2T[b.type]; if (!t) continue;
    const node = { id: b.id, t };
    if (b.type === 'c_repeat') { node.n = Math.max(0, Math.round(Number(b.getFieldValue('N')) || 0)); node.body = astFromBlock(b.getInputTargetBlock('DO')); }
    else if (b.type === 'c_repeat_v') { node.e = exprOf(b.getInputTargetBlock('N')); node.body = astFromBlock(b.getInputTargetBlock('DO')); }
    else if (t === 'if' || t === 'ifelse') { node.c = b.getFieldValue('C'); node.body = astFromBlock(b.getInputTargetBlock('DO')); if (t === 'ifelse') node.else = astFromBlock(b.getInputTargetBlock('ELSE')); }
    else if (t === 'until') node.body = astFromBlock(b.getInputTargetBlock('DO'));
    else if (/^p_(fwd|right|left)_v$/.test(b.type)) node.e = exprOf(b.getInputTargetBlock('N'));
    else if (t === 'pf' || t === 'pr' || t === 'pl') node.v = Number(b.getFieldValue('N')) || 0;
    else if (t === 'pc') node.v = b.getFieldValue('C');
    else if (t === 'pen') node.t = b.getFieldValue('S') === 'up' ? 'pu' : 'pd';
    else if (t === 'set') { node.v = varName(b, 'VAR'); node.e = exprOf(b.getInputTargetBlock('VALUE')); }
    else if (t === 'change') { node.v = varName(b, 'VAR'); node.e = exprOf(b.getInputTargetBlock('DELTA')); }
    else if (t === 'call') { node.name = b.getFieldValue('NAME'); node.args = []; for (let k = 0; b.getInput('ARG' + k); k++) node.args.push(exprOf(b.getInputTargetBlock('ARG' + k))); }
    out.push(node);
  }
  return out;
}
// 작업판의 기술(함수) 정의들 — 어디에 놓여 있어도 쓴다(‘시작하면’ 밑이 아니어도)
export function defsOf(ws) {
  return ws.getTopBlocks(false).filter(b => b.type === 'procedures_defnoreturn' && (!b.isEnabled || b.isEnabled()))
    .map(b => ({ t: 'def', id: b.id, name: b.getFieldValue('NAME'), params: b.getVars ? b.getVars() : [], body: astFromBlock(b.getInputTargetBlock('STACK')) }));
}

// ── AST → Blockly 저장 꼴('시작하면' 밑에 줄줄이 · 기술 정의는 옆에 따로) ──
export function stateFromAst(ast, pos = { x: 28, y: 28 }) {
  const vars = new Set();
  const defs = new Map(ast.filter(n => n.t === 'def').map(d => [d.name, d]));
  const ex = e => {
    if (!e || e.k === 'num') return { shadow: { type: 'math_number', fields: { NUM: e ? e.n : 0 } } };
    if (e.k === 'var') { vars.add(e.v); return { block: { type: 'variables_get', fields: { VAR: { id: 'v_' + e.v } } } }; }
    return { block: { type: 'math_arithmetic', fields: { OP: OP_NAME[e.op] || 'ADD' }, inputs: { A: ex(e.a), B: ex(e.b) } } };
  };
  const blk = node => {
    if (node.t === 'call') return { type: 'procedures_callnoreturn', extraState: { name: node.name, params: (defs.get(node.name) || { params: [] }).params }, inputs: Object.fromEntries((node.args || []).map((a, k) => ['ARG' + k, ex(a)])) };
    if (node.t === 'set' || node.t === 'change') { vars.add(node.v); return { type: T2TYPE[node.t], fields: { VAR: { id: 'v_' + node.v } }, inputs: { [node.t === 'set' ? 'VALUE' : 'DELTA']: ex(node.e) } }; }
    const b = { type: node.e && V_TYPE[node.t] ? V_TYPE[node.t] : T2TYPE[node.t] };
    if (node.t === 'repeat') {
      if (node.e) b.inputs = { N: ex(node.e) }; else b.fields = { N: node.n };
      const body = chain(node.body || []); if (body) b.inputs = { ...(b.inputs || {}), DO: { block: body } };
    } else if (node.t === 'if' || node.t === 'ifelse' || node.t === 'until') {
      if (node.c) b.fields = { C: node.c };
      const body = chain(node.body || []), els = node.t === 'ifelse' ? chain(node.else || []) : null;
      if (body || els) { b.inputs = {}; if (body) b.inputs.DO = { block: body }; if (els) b.inputs.ELSE = { block: els }; }
    } else if (node.t === 'pf' || node.t === 'pr' || node.t === 'pl') { if (node.e) b.inputs = { N: ex(node.e) }; else b.fields = { N: node.v }; }
    else if (node.t === 'pc') b.fields = { C: node.v };
    else if (node.t === 'pu' || node.t === 'pd') b.fields = { S: node.t === 'pu' ? 'up' : 'down' };
    return b;
  };
  const chain = list => {
    list = list.filter(n => n.t !== 'def');
    if (!list.length) return null;
    const first = blk(list[0]); let cur = first;
    for (const n of list.slice(1)) { const b = blk(n); cur.next = { block: b }; cur = b; }
    return first;
  };
  const start = { type: 'start', id: 'start', x: pos.x, y: pos.y, deletable: false };
  const body = chain(ast); if (body) start.next = { block: body };
  const blocks = [start];
  [...defs.values()].forEach((d, k) => {
    d.params.forEach(p => vars.add(p));
    const st = chain(d.body || []);
    blocks.push({ type: 'procedures_defnoreturn', x: pos.x + 360, y: pos.y + k * 220, fields: { NAME: d.name },
      ...(d.params.length ? { extraState: { params: d.params.map(p => ({ name: p, id: 'v_' + p })) } } : {}), ...(st ? { inputs: { STACK: { block: st } } } : {}) });
  });
  const state = { blocks: { languageVersion: 0, blocks } };
  if (vars.size) state.variables = [...vars].map(v => ({ name: v, id: 'v_' + v }));
  return state;
}

// ── 한 걸음씩 — 마디마다 { id, kind, ok … } 를 내고, 안 되는 걸음이면 그 까닭으로 던진다 ──
//  끝없는 반복은 max 걸음에서 · 기술 부르기는 40겹까지. 주머니(변수)는 판 하나 동안 살아 있고, 기술 안의 받는 값은 그 기술 안에서만.
export function* runAst(ast, world, { max = 3000, defs: extDefs = null } = {}) {
  let steps = 0, depth = 0;
  const fail = (why, id) => { const e = new Error(why); e.why = why; e.id = id; return e; };
  const defs = new Map(); (extDefs || []).forEach(d => defs.set(d.name, d)); ast.forEach(n => { if (n.t === 'def') defs.set(n.name, n); });
  const globals = new Map(), frames = [];
  const get = v => { const f = frames[frames.length - 1]; if (f && f.has(v)) return f.get(v); return globals.has(v) ? globals.get(v) : 0; };
  const put = (v, x) => { const f = frames[frames.length - 1]; if (f && f.has(v)) f.set(v, x); else globals.set(v, x); };
  const val = e => { if (!e) return 0; if (e.k === 'num') return e.n; if (e.k === 'var') return get(e.v); const a = val(e.a), b = val(e.b);
    return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : e.op === '/' ? (b ? a / b : 0) : e.op === '^' ? Math.pow(a, b) : 0; };
  const snap = () => { const o = Object.fromEntries(globals); const f = frames[frames.length - 1]; if (f) for (const [k, v] of f) o[k] = v; return o; };
  function* list(xs) { for (const b of xs) yield* one(b); }
  function* one(b) {
    if (b.t === 'def') return;   // 기술 정의는 부를 때만 돈다
    if (++steps > max) throw fail('loop', b.id);
    if (b.t === 'repeat') { const n = b.e ? Math.max(0, Math.floor(val(b.e))) : b.n; for (let i = 0; i < n; i++) { yield { id: b.id, kind: 'loop', i, ok: true, vars: snap() }; yield* list(b.body || []); } return; }
    if (b.t === 'if' || b.t === 'ifelse') {   // 살피고(움직이지 않음) 맞으면 안쪽 · 아니면 '아니면' 쪽
      const yes = !!world.sense(b.c);
      yield { id: b.id, t: b.t, kind: 'check', c: b.c, res: yes, ok: true };
      yield* list(yes ? (b.body || []) : (b.t === 'ifelse' ? b.else || [] : []));
      return;
    }
    if (b.t === 'until') {   // 집에 닿을 때까지 — 한 바퀴마다 걸음을 센다(빈 반복도 끝없이 돌지 않게)
      while (!world.sense('goal')) { if (++steps > max) throw fail('loop', b.id); yield { id: b.id, kind: 'loop', ok: true }; yield* list(b.body || []); }
      return;
    }
    if (b.t === 'set' || b.t === 'change') { put(b.v, b.t === 'set' ? val(b.e) : get(b.v) + val(b.e)); yield { id: b.id, t: b.t, kind: 'var', ok: true, v: b.v, vars: snap() }; return; }
    if (b.t === 'call') {
      const d = defs.get(b.name);
      if (!d) throw fail('nofunc', b.id);
      if (++depth > 40) throw fail('loop', b.id);
      const fr = new Map(); (d.params || []).forEach((p, k) => fr.set(p, val((b.args || [])[k])));
      frames.push(fr);
      yield { id: b.id, t: 'call', kind: 'call', ok: true, name: b.name, vars: snap() };
      try { yield* list(d.body || []); } finally { frames.pop(); depth--; }
      return;
    }
    const v = b.e ? val(b.e) : b.v;
    const r = world.act(b.t, v);
    yield { id: b.id, t: b.t, v, ...r, vars: snap() };
    if (!r.ok) throw fail(r.why, b.id);
  }
  yield* list(ast);
}

// 그림 없이 끝까지 — { ok, why, id, steps }
export function runToEnd(ast, world, opts) {
  let n = 0;
  try { for (const _ of runAst(ast, world, opts)) n++; } catch (e) { return { ok: false, why: e.why || 'unknown', id: e.id, steps: n }; }
  return { ok: true, steps: n };
}
