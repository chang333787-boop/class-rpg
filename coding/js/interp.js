// 프로그램 = 블록 나무(AST)  ·  짧은 글(판 정답 · 고치기 판의 틀린 코드) ↔ AST ↔ Blockly 저장 꼴
//  AST 마디 = { id?, t, n?(반복 횟수), v?(걸음 · 각도 · 색), body?(반복 안) }
//  짧은 글: F 앞으로 · L 왼쪽 돌기 · R 오른쪽 돌기 · U D W E 위·아래·왼쪽·오른쪽(게) · J 두 칸 뛰기 · P 도토리 줍기
//           n( … ) n번 반복 · f100 붓 앞으로 100 · r90 오른쪽 90도 · l90 왼쪽 90도 · c빨강 붓 색 · pu 붓 들기 · pd 붓 내리기
//           I:살피기( … ) 만약 · E:살피기( … | … ) 만약/아니면 · U( … ) 집에 닿을 때까지 반복   [CODING-U5]
import { PEN_COLORS } from './world.js';

export const T2TYPE = { fwd: 'm_fwd', left: 'm_left', right: 'm_right', up: 'm_up', down: 'm_down', west: 'm_west', east: 'm_east', jump: 'm_jump', pick: 'm_pick',
  repeat: 'c_repeat', if: 'c_if', ifelse: 'c_ifelse', until: 'c_until', pf: 'p_fwd', pr: 'p_right', pl: 'p_left', pc: 'p_color', pu: 'p_pen', pd: 'p_pen' };
const TYPE2T = { m_fwd: 'fwd', m_left: 'left', m_right: 'right', m_up: 'up', m_down: 'down', m_west: 'west', m_east: 'east', m_jump: 'jump', m_pick: 'pick',
  c_repeat: 'repeat', c_if: 'if', c_ifelse: 'ifelse', c_until: 'until', p_fwd: 'pf', p_right: 'pr', p_left: 'pl', p_color: 'pc', p_pen: 'pen' };
const LETTER = { F: 'fwd', L: 'left', R: 'right', U: 'up', D: 'down', W: 'west', E: 'east', J: 'jump', P: 'pick' };

export function parse(src) {
  const toks = String(src).match(/\d+\(|[IE]:[a-zA-Z]+\(|U\(|\)|\||pu|pd|f\d+|r\d+|l\d+|c[^\s()|]+|[FLRUDWEJP]/g) || [];
  let i = 0;
  const list = () => {
    const out = [];
    while (i < toks.length && toks[i] !== ')' && toks[i] !== '|') {
      const k = toks[i++];
      if (/^\d+\($/.test(k)) { const body = list(); i++; out.push({ t: 'repeat', n: parseInt(k, 10), body }); }
      else if (/^I:/.test(k)) { const body = list(); i++; out.push({ t: 'if', c: k.slice(2, -1), body }); }
      else if (/^E:/.test(k)) { const body = list(); i++; const els = list(); i++; out.push({ t: 'ifelse', c: k.slice(2, -1), body, else: els }); }
      else if (k === 'U(') { const body = list(); i++; out.push({ t: 'until', body }); }
      else if (LETTER[k]) out.push({ t: LETTER[k] });
      else if (k === 'pu' || k === 'pd') out.push({ t: k });
      else if (/^[frl]\d+$/.test(k)) out.push({ t: { f: 'pf', r: 'pr', l: 'pl' }[k[0]], v: parseInt(k.slice(1), 10) });
      else if (k[0] === 'c') { const c = PEN_COLORS.find(([n]) => n === k.slice(1)); out.push({ t: 'pc', v: c ? c[1] : k.slice(1) }); }
    }
    return out;
  };
  return list();
}

// 블록 수(반복 블록도 하나 · '시작하면'은 안 셈)
export const countBlocks = ast => ast.reduce((a, b) => a + 1 + (b.body ? countBlocks(b.body) : 0) + (b.else ? countBlocks(b.else) : 0), 0);

// Blockly 블록 줄 → AST(꺼진 블록 · 모르는 블록은 건너뜀)
export function astFromBlock(first) {
  const out = [];
  for (let b = first; b; b = b.getNextBlock()) {
    if (b.isEnabled && !b.isEnabled()) continue;
    const t = TYPE2T[b.type]; if (!t) continue;
    const node = { id: b.id, t };
    if (t === 'repeat') { node.n = Math.max(0, Math.round(Number(b.getFieldValue('N')) || 0)); node.body = astFromBlock(b.getInputTargetBlock('DO')); }
    else if (t === 'if' || t === 'ifelse') { node.c = b.getFieldValue('C'); node.body = astFromBlock(b.getInputTargetBlock('DO')); if (t === 'ifelse') node.else = astFromBlock(b.getInputTargetBlock('ELSE')); }
    else if (t === 'until') node.body = astFromBlock(b.getInputTargetBlock('DO'));
    else if (t === 'pf' || t === 'pr' || t === 'pl') node.v = Number(b.getFieldValue('N')) || 0;
    else if (t === 'pc') node.v = b.getFieldValue('C');
    else if (t === 'pen') node.t = b.getFieldValue('S') === 'up' ? 'pu' : 'pd';
    out.push(node);
  }
  return out;
}

// AST → Blockly 저장 꼴('시작하면' 밑에 줄줄이) — 고치기 판의 처음 코드 · 시험
export function stateFromAst(ast, pos = { x: 28, y: 28 }) {
  const blk = node => {
    const b = { type: T2TYPE[node.t] };
    if (node.t === 'repeat') { b.fields = { N: node.n }; const body = chain(node.body || []); if (body) b.inputs = { DO: { block: body } }; }
    else if (node.t === 'if' || node.t === 'ifelse' || node.t === 'until') {
      if (node.c) b.fields = { C: node.c };
      const body = chain(node.body || []), els = node.t === 'ifelse' ? chain(node.else || []) : null;
      if (body || els) { b.inputs = {}; if (body) b.inputs.DO = { block: body }; if (els) b.inputs.ELSE = { block: els }; }
    }
    else if (node.t === 'pf' || node.t === 'pr' || node.t === 'pl') b.fields = { N: node.v };
    else if (node.t === 'pc') b.fields = { C: node.v };
    else if (node.t === 'pu' || node.t === 'pd') b.fields = { S: node.t === 'pu' ? 'up' : 'down' };
    return b;
  };
  const chain = list => {
    if (!list.length) return null;
    const first = blk(list[0]); let cur = first;
    for (const n of list.slice(1)) { const b = blk(n); cur.next = { block: b }; cur = b; }
    return first;
  };
  const start = { type: 'start', id: 'start', x: pos.x, y: pos.y, deletable: false };
  const body = chain(ast); if (body) start.next = { block: body };
  return { blocks: { languageVersion: 0, blocks: [start] } };
}

// 한 걸음씩 — 마디마다 { id, kind, ok … } 를 내고, 안 되는 걸음이면 그 까닭으로 던진다(끝없는 반복은 max 걸음에서 멈춤)
export function* runAst(ast, world, { max = 3000 } = {}) {
  let steps = 0;
  const fail = (why, id) => { const e = new Error(why); e.why = why; e.id = id; return e; };
  function* list(xs) { for (const b of xs) yield* one(b); }
  function* one(b) {
    if (++steps > max) throw fail('loop', b.id);
    if (b.t === 'repeat') { for (let i = 0; i < b.n; i++) { yield { id: b.id, kind: 'loop', i, ok: true }; yield* list(b.body || []); } return; }
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
    const r = world.act(b.t, b.v);
    yield { id: b.id, t: b.t, v: b.v, ...r };
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
