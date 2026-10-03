// [CODING-U9] 작은 게임 — 이벤트: '키를 누르면' · '도토리에 닿으면' · '시계가 똑딱할 때마다'. DOM 없음(시험에서도 그대로 돈다).
//  블록이 위에서 아래로 한 번 도는 게 아니라, 일이 생길 때마다 그 일의 블록 묶음이 돈다. 주머니(점수)는 모든 묶음이 함께 쓴다.
//  게임 안에서는 나무에 부딪혀도 끝나지 않는다(그 자리에서 쿵). 끝나는 것 = 이김 · 끝없는 반복 · 없는 기술 · 점수판이 틀림.
import { runAst } from './interp.js';

export const KEY_OF = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };   // 키보드 → 키 이름
export const TOK = { '^': 'up', v: 'down', '<': 'left', '>': 'right' };   // 놀이 글(판 정답 놀이 · 시험): ^ v < > = 화살표 · . = 똑딱

// 짧은 글을 읽은 AST → 게임 프로그램(맨 위 칸: '시작하면' 밑 · 이벤트 묶음 · 기술)
export const progOf = ast => ({ start: ast.filter(n => n.t !== 'on' && n.t !== 'def'), on: ast.filter(n => n.t === 'on'), defs: ast.filter(n => n.t === 'def') });

// world = makeMaze(…) · prog = { start, on, defs } · score = 점수판에 걸린 주머니 이름(그 판만)
export function makeGame(world, prog, { score = '' } = {}) {
  const on = new Map(), globals = new Map(), total = world.map.acorns.length;
  for (const h of prog.on || []) { const name = h.ev === 'tick' ? 'tick' : h.ev + ':' + h.k; if (!on.has(name)) on.set(name, []); on.get(name).push(h.body || []); }
  const opts = { max: 400, defs: prog.defs || [], globals, soft: true };
  //  한 묶음을 걸음마다 — 몬스터가 새 칸에 들어서면(걷기 · 뛰기) 그 칸의 '닿으면' 묶음이 끼어든다(닿으면 안에서는 또 끼어들지 않음)
  function* body(list, inTouch) {
    for (const ev of runAst(list, world, opts)) {
      yield ev;
      if (!inTouch && ev.ok && (ev.kind === 'move' || ev.kind === 'jump')) yield* touched();
    }
  }
  function* touched() {
    if (!world.st.acorns.has(world.st.x + ',' + world.st.y)) return;
    for (const b of on.get('touch:acorn') || []) yield* body(b, true);
  }
  return {
    world, globals,
    has: name => on.has(name),
    begin: () => body(prog.start || [], false),
    *fire(name) { for (const b of on.get(name) || []) yield* body(b, false); },
    picked: () => total - world.st.acorns.size,
    score: () => (score ? (globals.has(score) ? globals.get(score) : 0) : null),
    // 일 하나가 끝날 때마다 — 점수판이 맞나(주운 도토리 = 점수) · 이겼나(집 + 도토리 다)
    check() {
      const picked = total - world.st.acorns.size;
      if (score) { const s = globals.has(score) ? globals.get(score) : 0; if (s !== picked) return { fail: true, why: 'score', picked, score: s }; }
      const m = world.map, at = world.st.x === m.goal.x && world.st.y === m.goal.y;
      if (at && !world.st.acorns.size) return { won: true };
      if (at) return { note: 'acornsLeft', left: world.st.acorns.size };
      return {};
    },
  };
}

// 놀이 글대로 해 보기(시험) — '^ ^ > . .' · 끝까지 해도 못 이기면 { won: false, why }
export function playScript(world, prog, script, o) {
  const g = makeGame(world, prog, o), drain = gen => { for (const _ of gen) { /* 걸음마다 */ } };
  try {
    drain(g.begin());
    let s = g.check(); if (s.fail || s.won) return s;
    for (const tok of String(script || '').trim().split(/\s+/).filter(Boolean)) {
      drain(g.fire(tok === '.' ? 'tick' : 'key:' + (TOK[tok] || tok)));
      s = g.check(); if (s.fail || s.won) return s;
    }
    return { won: false, why: s.note === 'acornsLeft' ? 'acorns' : 'short', left: s.left };
  } catch (e) { return { fail: true, why: e.why || 'unknown' }; }
}
