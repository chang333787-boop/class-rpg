// 판 화면 — 왼쪽 = 몬스터 세계(이야기 · 판 · 실행 단추) · 오른쪽 = 블록 작업판(+ 글 코드)
//  ▶ 실행 = 끝까지 움직이며 지금 블록을 밝힌다 · 한 걸음씩 = 누를 때마다 블록 하나(디버깅) · ⟲ = 처음 자리로
import { h, toast, modal, lsGet, lsSet } from './util.js';
import { HEROES, makeMaze, makePen, compareDrawing, whyText } from './world.js';
import { parse, countBlocks, runAst, astFromBlock, stateFromAst, runToEnd, defsOf, usesCall } from './interp.js';
import { makeWorkspace, startOf, pythonOf, setConds } from './blocks.js';
import { drawMaze, drawPen, heroImg } from './draw.js';
import { UNITS, stagesOf } from './stages.js';

const SPEEDS = [['slow', '천천히', 700], ['normal', '보통', 380], ['fast', '빠르게', 150], ['instant', '바로', 0]];
const durOf = sp => (SPEEDS.find(s => s[0] === sp) || SPEEDS[1])[2];
const starsOf = (n, best) => n <= best ? 3 : n <= best + 2 ? 2 : 1;
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);

export async function mountPlay(root, ctx, stage) {
  const Bk = globalThis.Blockly;
  const hero = HEROES[stage.hero], unit = UNITS.find(u => u.id === stage.unit);
  const list = stagesOf(stage.unit), idx = list.indexOf(stage), next = list[idx + 1] || null;
  let speed = lsGet('coding.speed', 'normal'), running = false, gen = null, world = null, view = null, raf = 0, failN = 0, pyOpen = lsGet('coding.py', false), saveT = 0, alive = true;
  const target = stage.world === 'pen' ? (() => { const w = makePen({ start: stage.start }); runToEnd(parse(stage.sol), w); return w.st.segs; })() : [];

  // ── 화면 ──
  const cv = h('canvas', { class: 'w-cv' }), over = h('div', { class: 'w-over' });
  const stageWrap = h('div', { class: 'w-stage' }, cv, over);
  const msg = h('div', { class: 'w-msg' });
  const runBtn = h('button', { class: 'btn primary', onclick: () => run(false) }, '▶ 실행');
  const stepBtn = h('button', { class: 'btn', onclick: () => run(true), title: '블록 하나씩 실행해요(어디서 틀렸는지 찾기)' }, '한 걸음씩');
  const resetBtn = h('button', { class: 'btn', onclick: () => reset() }, '⟲ 처음으로');
  const speedSel = h('select', { class: 'speed', onchange: e => { speed = e.target.value; lsSet('coding.speed', speed); } },
    ...SPEEDS.map(([v, t]) => { const o = h('option', { value: v }, t); if (v === speed) o.selected = true; return o; }));
  const hintBtn = h('button', { class: 'btn small hint', onclick: () => modal('💡 힌트', stage.hint || '블록을 하나씩 따라가 보세요.') }, '💡 힌트');
  hintBtn.style.display = 'none';
  const bugBtn = stage.buggy ? h('button', { class: 'btn small', onclick: () => { loadState(stateFromAst(parse(stage.buggy))); toast('처음 코드로 돌렸어요'); } }, '처음 코드로') : null;
  const countEl = h('span', { class: 'bcount' });
  const pyPre = h('pre', { class: 'py' });
  const pyBtn = h('button', { class: 'btn small' + (pyOpen ? ' on' : ''), onclick: () => { pyOpen = !pyOpen; lsSet('coding.py', pyOpen); pyBtn.classList.toggle('on', pyOpen); pyPre.hidden = !pyOpen; updatePy(); Bk.svgResize(ws); } }, '글 코드');
  pyPre.hidden = !pyOpen;
  const wsDiv = h('div', { class: 'ws' });
  const heroPic = h('img', { class: 'st-hero', src: '../assets/monsters/' + hero.img + '.png', alt: hero.name });
  //  [CODING-U5] 길 둘 이상 — 코드 하나로 모두. 탭 = 미리 보기(실행 중이 아닐 때) · 표시 ✓ ✗
  const maps = stage.maps && stage.maps.length > 1 ? stage.maps : null;
  let mi = 0, mapRes = [];
  const tabs = h('div', { class: 'maptabs' });
  //  [CODING-U7] 실행하는 동안 주머니(변수) · 받는 값이 지금 몇인지
  const varsEl = h('div', { class: 'vars' });
  function showVars(v) { if (!v || !Object.keys(v).length) { varsEl.replaceChildren(); return; } varsEl.replaceChildren(h('span', { class: 'muted' }, '주머니'), ...Object.entries(v).map(([k, x]) => h('span', { class: 'vchip' }, `${k} = ${Math.round(x * 100) / 100}`))); }
  function renderTabs() {
    if (!maps) return;
    tabs.replaceChildren(h('span', { class: 'muted' }, '코드 하나로'), ...maps.map((m, i) => h('button', { class: 'btn small' + (i === mi ? ' on' : ''), onclick: () => { if (running || gen) return; fresh(i); render(); } },
      `길 ${i + 1}${mapRes[i] === 'ok' ? ' ✓' : mapRes[i] === 'bad' ? ' ✗' : ''}`)), h('span', { class: 'muted' }, '모두 가야 성공'));
  }
  root.replaceChildren(
    ctx.topBar(`${stage.id} · ${stage.title}`, { back: '#/', right: [h('span', { class: 'chip c-unit' }, `${unit.id}단원 ${unit.title}`), h('span', { class: 'chip' }, hero.name)] }),
    h('div', { class: 'play' },
      h('section', { class: 'world' },
        h('div', { class: 'story' }, heroPic, h('div', {}, h('b', {}, stage.title), h('p', {}, stage.story))),
        maps ? tabs : null, stageWrap, varsEl, msg,
        h('div', { class: 'ctrl' }, runBtn, stepBtn, resetBtn, speedSel, h('span', { class: 'sp' }), hintBtn, bugBtn)),
      h('section', { class: 'code' },
        h('div', { class: 'code-head' }, h('b', {}, '블록'), countEl, h('span', { class: 'sp' }), h('span', { class: 'muted small' }, hero.about), pyBtn),
        wsDiv, pyPre)));
  const g = cv.getContext('2d');
  let W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = stageWrap.clientWidth; H = stageWrap.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0); render();
  };

  // ── 작업판 ──
  setConds(stage.conds);   // [CODING-U5] 만약 블록의 살피기 = 이 몬스터 것만
  const ws = makeWorkspace(wsDiv, stage);
  function loadState(state) {
    ws.clear();
    try { Bk.serialization.workspaces.load(state, ws); } catch (e) { console.warn(e); }
    if (!startOf(ws)) Bk.serialization.workspaces.load(stateFromAst([]), ws);
    const st = startOf(ws); if (st) st.setDeletable(false);
    ws.scrollCenter && ws.scroll(0, 0);
    updateCount(); updatePy();
  }
  let saved = null;
  try { saved = await Promise.race([ctx.store.loadCode(stage.id), new Promise(r => setTimeout(() => r(null), 3000))]); } catch (e) { console.warn(e); }   // 늦으면 새로 시작
  if (!alive) return { unmount() {} };
  let first = null; try { first = saved ? JSON.parse(saved) : null; } catch (e) { first = null; }
  loadState(first || stateFromAst(stage.buggy ? parse(stage.buggy) : stage.prefill ? parse(stage.prefill) : []));
  ws.addChangeListener(e => {
    if (e.isUiEvent) return;
    if (running || gen) stopRun();
    updateCount(); updatePy();
    clearTimeout(saveT);
    saveT = setTimeout(() => { saveT = 0; try { ctx.store.saveCode(stage.id, JSON.stringify(Bk.serialization.workspaces.save(ws))).catch(err => console.warn(err)); } catch (err) { console.warn(err); } }, 700);
  });
  function program() { const st = startOf(ws); return st ? astFromBlock(st.getNextBlock()) : []; }
  function defsNow() { return stage.unit >= 8 ? defsOf(ws) : []; }   // 함수 선언(작업판을 처음 실을 때 이미 불린다)
  //  [CODING-U7·U8] 이 판에서 꼭 써야 하는 것 — 주머니(넣고 꺼내 쓰기) · 기술(만들어 쓰기)
  function hasVarUse(list) { return list.some(n => (n.e && JSON.stringify(n.e).includes('"k":"var"')) || (n.body && hasVarUse(n.body)) || (n.else && hasVarUse(n.else))); }
  function hasSet(list) { return list.some(n => n.t === 'set' || (n.body && hasSet(n.body)) || (n.else && hasSet(n.else))); }
  function needs(ast, defs) {
    const all = [...ast, ...defs.flatMap(d => d.body)];
    if (stage.require === 'var' && !(hasSet(all) && hasVarUse(all))) return 'needvar';
    if (stage.require === 'call' && !usesCall(ast)) return 'needcall';
    return '';
  }
  function updateCount() {
    const n = countBlocks(program());
    const nn = n + countBlocks(defsNow());
    countEl.textContent = `${nn}${stage.limit ? ' / ' + stage.limit : ''}개 · ★★★ = ${stage.best}개 이하`;
    countEl.classList.toggle('over', !!stage.limit && n > stage.limit);
  }
  function updatePy() { if (pyOpen) pyPre.textContent = pythonOf(ws) || '# ‘시작하면’ 아래에 블록을 이어요'; }

  // ── 세계 ──
  function fresh(i = mi) {
    mi = i;
    world = stage.world === 'maze' ? makeMaze(maps ? { ...stage, map: maps[i].map, dir: maps[i].dir } : stage) : makePen({ start: stage.start });
    view = stage.world === 'maze' ? { x: world.st.x, y: world.st.y, dir: world.st.dir } : { x: world.st.x, y: world.st.y, h: world.st.h };
    renderTabs();
  }
  function render() { if (!W || !world) return; stage.world === 'maze' ? drawMaze(g, W, H, world, view) : drawPen(g, W, H, world, target, view); }
  function say(t, kind = '') { msg.textContent = t; msg.className = 'w-msg ' + kind; }
  function highlight(id) { try { ws.highlightBlock(id || null); } catch (e) {} }
  function setButtons() { runBtn.disabled = running; stepBtn.textContent = gen && !running ? '다음 한 걸음' : '한 걸음씩'; }
  function stopRun() { running = false; gen = null; cancelAnimationFrame(raf); highlight(null); setButtons(); over.replaceChildren(); over.style.display = 'none'; }
  function reset() { stopRun(); mapRes = []; fresh(0); say(''); render(); }

  // 지금 세계 상태 그대로의 모습(바로 실행 · 움직임 끝)
  function syncView(ev) {
    if (stage.world === 'pen') {
      let hv = world.st.h;
      if (view && typeof view.h === 'number') {   // 돈 만큼 그대로(270도 오른쪽은 왼쪽 90도가 아니다)
        if (ev && (ev.t === 'pr' || ev.t === 'pl')) hv = view.h + (ev.t === 'pr' ? ev.v : -ev.v);
        else { let d = world.st.h - (((view.h % 360) + 360) % 360); if (d > 180) d -= 360; if (d < -180) d += 360; hv = view.h + d; }
      }
      view = { x: world.st.x, y: world.st.y, h: hv }; return;
    }
    let dir = world.st.dir;
    if (view && typeof view.dir === 'number') { const cur = Math.round(view.dir), d = ((world.st.dir - ((cur % 4) + 4) % 4) + 4) % 4; dir = cur + (d === 3 ? -1 : d); }
    view = { x: world.st.x, y: world.st.y, dir };
  }
  const BUMP = { fwd: null, jump: null, up: [0, -1], down: [0, 1], west: [-1, 0], east: [1, 0] }, FACE = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // 움직임 하나를 dur 동안 그린다(끝나면 done) — 막힌 걸음은 그쪽으로 살짝 부딪혔다 돌아온다
  function animate(ev, done) {
    const dur = durOf(speed), from = { ...view };
    if (!dur || ev.kind === 'loop' || ev.kind === 'color' || ev.kind === 'pen') {
      syncView(ev); render(); if (ev.kind === 'loop' && dur) setTimeout(done, 90); else done(); return;
    }
    syncView(ev); const to = view; view = from;
    const D = ev.kind === 'draw' ? Math.max(dur, Math.min(dur * 3, dur * ev.len / 100)) : ev.ok ? dur : dur * 1.2, t0 = performance.now();
    const seg = ev.kind === 'draw' && world.st.down && ev.len ? world.st.segs[world.st.segs.length - 1] : null;
    const dv = !ev.ok ? (BUMP[ev.t] || FACE[world.st.dir]) : null;
    const tick = now => {
      if (!alive) return;
      const p = Math.min(1, (now - t0) / D), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      if (stage.world === 'maze') {
        view = dv ? { ...from, bump: { dx: dv[0], dy: dv[1], p } }
          : { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, dir: from.dir + (to.dir - from.dir) * e, hop: ev.kind === 'jump' ? p : 0, sparkle: ev.kind === 'pick' ? { p } : null };
      } else {
        view = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, h: from.h + (to.h - from.h) * e, hideLast: !!seg, partial: seg ? { ...seg, p: e } : null };
      }
      render();
      if (p < 1) raf = requestAnimationFrame(tick);
      else { view = dv ? { x: from.x, y: from.y, dir: from.dir } : to; render(); done(); }
    };
    raf = requestAnimationFrame(tick);
  }

  let curAst = null, nUsed = 0;
  let curDefs = [];
  function startMap(i) { fresh(i); gen = runAst(curAst, world, { max: 1500, defs: curDefs }); showVars(null); }
  function run(step) {
    if (running) return;
    over.style.display = 'none';
    if (!gen) {
      const ast = program();
      if (!ast.length) { say(whyText('empty', stage.hero), 'bad'); return; }
      if (stage.limit && countBlocks(ast) > stage.limit) { say(`블록이 ${stage.limit}개를 넘었어요 — 반복으로 줄여 봐요`, 'bad'); return; }
      const defs = defsNow(), need = needs(ast, defs);
      if (need) { say(whyText(need, stage.hero), 'bad'); return; }
      curAst = ast; curDefs = defs; nUsed = countBlocks(ast) + countBlocks(defs); mapRes = []; startMap(0); say(maps ? '길 1부터 가요' : '');
    }
    running = !step; setButtons();
    if (speed === 'instant' && !step) {   // 바로 = 움직임 없이 끝까지(막히면 그 자리에서 멈춤) · 길 둘이면 차례로
      for (;;) {
        try { let r; while (!(r = gen.next()).done) { if (r.value.vars) showVars(r.value.vars); } } catch (e) { syncView(); render(); return fail(e.why, e.id); }
        syncView(); render();
        const r = mapEnd(); if (r !== 'next') return r;
      }
    }
    advance();
  }
  function advance() {
    if (!gen) return;
    let r;
    try { r = gen.next(); } catch (e) { return fail(e.why, e.id); }
    if (r.done) { const m = mapEnd(); if (m === 'next') { if (running) setTimeout(() => { if (alive && gen) advance(); }, 650); else setButtons(); } return; }
    const ev = r.value;
    highlight(ev.id); if (ev.vars) showVars(ev.vars);
    animate(ev, () => {
      if (!gen) return;
      if (!ev.ok) { try { gen.next(); } catch (e) { return fail(e.why, e.id); } return fail(ev.why, ev.id); }
      if (running) advance(); else setButtons();
    });
  }
  // 한 길이 끝났을 때 — 이 길을 못 가면 실패, 다음 길이 있으면 'next'(같은 코드로 다시), 다 갔으면 성공
  function mapEnd() {
    const res = stage.world === 'maze' ? world.result() : (compareDrawing(target, world.st.segs).ok ? { ok: true } : { ok: false, why: 'draw' });
    if (!res.ok) { fail(res.why, null, res); return 'fail'; }
    if (maps && mi < maps.length - 1) {
      mapRes[mi] = 'ok'; say(`길 ${mi + 1} 성공! 같은 코드로 길 ${mi + 2}도 가 봐요`, 'good');
      startMap(mi + 1); render(); return 'next';
    }
    if (maps) mapRes[mi] = 'ok';
    finish(); return 'done';
  }
  async function finish() {
    const n = nUsed;
    running = false; gen = null; setButtons(); renderTabs();
    highlight(null);
    const stars = starsOf(n, stage.best);
    say(`🎉 성공! ${STAR(stars)} · 블록 ${n}개${maps ? ' · 길 ' + maps.length + '개 모두' : ''}`, 'good');
    try { await ctx.store.saveRun(stage.id, { ok: true, n, stars }); } catch (e) { console.warn(e); }
    ctx.onProgress && ctx.onProgress();
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'win-card' },
      h('img', { src: heroImg(stage.hero).src, alt: '' }),
      h('div', { class: 'stars' }, STAR(stars)),
      h('b', {}, '성공!'),
      h('p', {}, `블록 ${n}개로 풀었어요.` + (maps ? ` 같은 코드로 길 ${maps.length}개를 다 갔어요.` : '') + (n > stage.best ? ` 블록 ${stage.best}개로도 풀 수 있어요 — 더 줄여 볼래요?` : ' 가장 짧은 코드예요!')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; reset(); } }, '다시 하기'),
        next ? h('button', { class: 'btn primary', onclick: () => ctx.go('#/s/' + next.id) }, '다음 판 →') : h('button', { class: 'btn primary', onclick: () => ctx.go('#/') }, `${stage.unit}단원 끝! 목록으로`))));
  }
  async function fail(why, id, res = {}) {
    const n = nUsed;
    running = false; gen = null; setButtons();
    if (maps) { mapRes[mi] = 'bad'; renderTabs(); }
    if (id) highlight(id); else highlight(null);
    failN++;
    say((maps ? `길 ${mi + 1}: ` : '') + whyText(why, stage.hero, res), 'bad');
    if (failN >= 2 && stage.hint) hintBtn.style.display = '';
    try { await ctx.store.saveRun(stage.id, { ok: false, why, n }); } catch (e) { console.warn(e); }
  }

  // ── 첫 그림 · 단원 안내(처음 한 번) ──
  fresh();
  const ro = new ResizeObserver(() => { size(); Bk.svgResize(ws); }); ro.observe(stageWrap); ro.observe(wsDiv);
  size(); setButtons();
  heroImg(stage.hero).onload = () => render();
  if (idx === 0 && !lsGet('coding.intro.' + unit.id, false)) { lsSet('coding.intro.' + unit.id, true); modal(`${unit.id}단원 · ${unit.title}`, h('div', {}, h('p', {}, unit.intro), h('p', { class: 'muted' }, `배우는 것: ${unit.concept}`))); }
  if (stage.buggy && !saved) say('이 코드는 틀렸어요. ▶ 실행해서 어디서 어긋나는지 보고 고쳐요.', '');
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__coding = { ws, stage, world: () => world, program, run, reset, state: () => ({ running, gen: !!gen, msg: msg.textContent }), load: src => loadState(stateFromAst(parse(src))) };
  //  나갈 때 아직 안 쓴 코드는 바로 쓴다(고치고 0.7초 안에 나가도 남게)
  const flush = () => { if (!saveT) return; clearTimeout(saveT); saveT = 0; try { ctx.store.saveCode(stage.id, JSON.stringify(Bk.serialization.workspaces.save(ws))).catch(err => console.warn(err)); } catch (err) { console.warn(err); } };
  addEventListener('pagehide', flush);
  return { unmount() { alive = false; flush(); removeEventListener('pagehide', flush); cancelAnimationFrame(raf); ro.disconnect(); try { ws.dispose(); } catch (e) {} } };
}
