// 판 화면 — 왼쪽 = 판(나무판 · 새기기 · 롤러 · 종이 · 바렌) · 오른쪽 = 답(보기 · 도구 · 찍힌 종이 · 할 일)
//  틀린 답마다 무엇이 달랐는지(예상 · 판 고르기 · 거울 실수 · 넘쳐 팜 · 덜 팜 · 잉크 · 문지르기)를 센다 → 선생님 헷갈림 지도.
import { h, modal, lsGet, lsSet, toast } from './util.js';
import { N, clone, count, carve, carveLine, band, erode } from './block.js';
import { CHAPTERS, stOf, blocks, specs, INKS } from './stages.js';
import { drawBlock, drawPrint, textBlock } from './draw.js';
import { judgeCarve, pressCoverage, judgePress } from './judge.js';

export const HOST = '../assets/monsters/m71.png';   // 거울 장어 — 판화 놀이 조수(판화는 거울처럼 좌우가 바뀐다)
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const starsByWrong = w => (w === 0 ? 3 : w <= 2 ? 2 : 1);
const canvas = cls => h('canvas', { class: cls });
const INK0 = INKS[0][2];
export const maskOf = (key, variant = 'same') => (key.startsWith('text:') ? textBlock(key.slice(5), variant) : blocks[key]());
// '이렇게 찍히게' — 맞게 판 판(이 판을 찍으면 목표 종이)
export function idealOf(t) {
  if (t === 'print:fishR') return band(blocks.fishGuideL(), 1.6);
  if (t === 'print:starWhite') return blocks.starGuide();
  if (t === 'print:ball') return blocks.ballOutside();
  if (t.startsWith('text:')) return textBlock(t.slice(5), 'mirror');
  return blocks.plain();
}
const TOOLS = { v: ['세모칼', '가는 선', 1.5], u: ['둥근칼', '넓게', 4.8] };

export function mountStage(root, ctx, s) {
  const ch = CHAPTERS.find(c => c.id === s.ch), list = stOf(s.ch), idx = list.indexOf(s), next = list[idx + 1] || null;
  let wrong = 0, done = false, solved = false, alive = true, cleanup = null;
  const msg = h('div', { class: 'msg' });
  const say = (t, kind = '') => { msg.textContent = t; msg.className = 'msg ' + kind; };
  const hintBtn = h('button', { class: 'btn small hint', onclick: () => modal('💡 힌트', h('p', {}, s.hint)) }, '💡 힌트');
  hintBtn.style.display = ['press', 'multi', 'free'].includes(s.kind) ? '' : 'none';
  const over = h('div', { class: 'over' });
  const Q = h('div', { class: 'q-body' }), A = h('div', { class: 'a-body' });
  root.replaceChildren(
    ctx.topBar(`${s.id} · ${s.title}`, { back: '#/', right: [h('span', { class: 'chip c-ch' }, `${ch.id}장 ${ch.title}`)] }),
    h('div', { class: 'pz' + (['carve', 'press', 'free', 'multi'].includes(s.kind) ? ' wide' : '') },
      h('section', { class: 'q' }, h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, s.title), h('p', {}, s.story))), Q),
      h('section', { class: 'a' }, A, h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), hintBtn)),
      over));

  function miss(mistake) {
    wrong++;
    if (wrong >= 2) hintBtn.style.display = '';
    ctx.store.saveTry(s.id, { ok: false, mistake: mistake || 'etc' }).catch(e => console.warn(e));
  }
  //  stars = null → 별 없이 ✓(자유 판화)
  async function finish(text, stars, { show = null } = {}) {
    if (done) return;
    done = true;
    say('🎉 ' + text, 'good');
    try { await ctx.store.saveTry(s.id, { ok: true, n: wrong, stars: stars || 0 }); } catch (e) { console.warn(e); }
    ctx.onProgress && ctx.onProgress();
    await sleep(stars == null ? 500 : 1100);
    if (!alive) return;
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'win-card' },
      h('img', { src: HOST, alt: '' }), h('div', { class: 'stars' }, stars == null ? '✓' : STAR(stars)), h('b', {}, '해냈어요!'), show, h('p', {}, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; } }, stars == null ? '더 하기' : '다시 보기'),
        next ? h('button', { class: 'btn primary', onclick: () => ctx.go('#/s/' + next.id) }, '다음 판 →') : h('button', { class: 'btn primary', onclick: () => ctx.go('#/') }, `${s.ch}장 끝! 목록으로`))));
  }
  const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter(Boolean));
  const goBtn = (label, fn, act) => h('button', { class: 'btn primary go', 'data-act': act || 'go', onclick: fn }, label);
  const card = (cv, label, cls = '') => h('figure', { class: 'card ' + cls }, cv, h('figcaption', {}, label));
  //  종이가 판에서 떨어지며 찍힌 모습이 나타난다(예상 · 고르기 판)
  async function reveal(where, mask, label = '종이에 찍힌 모습') {
    const pc = canvas('pr'); drawPrint(pc, mask, { size: 280 });
    const f = card(pc, label, 'peel'); where.append(f);
    await sleep(900);
    return f;
  }

  // ── 찍으면 어떻게 될까(그림 보기 넷) ──
  function predict() {
    const mask = maskOf(s.block), bc = canvas('blk'); drawBlock(bc, mask, { size: 280 });
    const row = h('div', { class: 'pair' }, card(bc, '판(나무판)'));
    put(Q, row, h('p', { class: 'cap c' }, '먼저 예상해요 — 맞히면 실제로 찍어 볼게요.'));
    const SW = { ink: INK0, paper: '#f4efe3', gray: '#8c8a86', half: `linear-gradient(90deg, ${INK0} 50%, #f4efe3 50%)` };
    const btns = s.opts.map(([k, label], i) => {
      let pic;
      if (s.swatch) pic = h('span', { class: 'swatch', style: { background: SW[k] } });
      else { pic = canvas('thumb'); drawPrint(pic, mask, { size: 112, variant: k }); }
      return h('button', { class: 'choice pic', 'data-i': i, onclick: () => pick(i) }, pic, h('b', {}, label));
    });
    put(A, h('p', { class: 'a-q' }, s.swatch ? '파낸 선은 무슨 색으로 찍힐까요?' : '종이에는 어떻게 찍힐까요?'), h('div', { class: 'choices4' }, ...btns));
    async function pick(i) {
      const b = btns[i], k = s.opts[i][0];
      if (solved || b.classList.contains('bad')) return;
      if (i !== s.answer) { b.classList.add('bad'); miss('pick'); say(`${s.say[k] || '다시 생각해 봐요.'} 다시 골라 봐요.`, 'bad'); return; }
      solved = true; b.classList.add('ok'); say('찍어 볼게요…');
      await reveal(row, mask);
      finish(s.why, starsByWrong(wrong));
    }
  }

  // ── 바르게 찍히는 판 고르기(목표 종이 → 판 보기) ──
  function choose() {
    const tc = canvas('pr'); drawPrint(tc, idealOf(s.target), { size: 280 });
    const row = h('div', { class: 'pair' }, card(tc, '이렇게 찍히게 하려면?', 'target'));
    put(Q, row, h('p', { class: 'cap c' }, '오른쪽에서 판을 골라요 — 고른 판으로 찍어 볼게요.'));
    const masks = s.opts.map(([k]) => (s.target.startsWith('text:') ? textBlock(s.target.slice(5), k) : blocks[k]()));
    const btns = s.opts.map(([k, label], i) => { const c = canvas('thumb'); drawBlock(c, masks[i], { size: 112 }); return h('button', { class: 'choice pic', 'data-i': i, onclick: () => pick(i) }, c, h('b', {}, label)); });
    put(A, h('p', { class: 'a-q' }, '어느 판으로 찍어야 할까요?'), h('div', { class: 'choices4' }, ...btns));
    async function pick(i) {
      const b = btns[i], k = s.opts[i][0];
      if (solved || b.classList.contains('bad')) return;
      if (i !== s.answer) { b.classList.add('bad'); miss('choose'); say(`${s.say[k] || '그 판으로 찍으면 다르게 나와요.'} 다시 골라 봐요.`, 'bad'); return; }
      solved = true; b.classList.add('ok'); say('이 판으로 찍어 볼게요…');
      await reveal(row, masks[i], '고른 판으로 찍은 종이');
      finish(s.why, starsByWrong(wrong));
    }
  }

  // ── 새기기 판(밑그림 · 칼 · 되돌리기 · 찍어 보기) — 새기기 · 자유 판화가 함께 쓴다 ──
  function carveBoard({ size = 384, guides = [], tool = 'v', onChange = () => {} } = {}) {
    let mask = maskOf('plain'), cur = null, undo = [], raf = 0, tl = tool, chipN = 0;
    const cv = canvas('blk carve'), wrap = h('div', { class: 'carve-wrap' }, cv);
    const gm = guides.map(k => blocks[k]());
    const redraw = () => { raf = 0; drawBlock(cv, mask, { size, guides: gm }); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(redraw); };
    const cell = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * N, (e.clientY - b.top) / b.height * N]; };
    function chip(e) {   // 나뭇조각이 튄다(꾸밈)
      if ((chipN++ % 3) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const b = wrap.getBoundingClientRect(), c = h('span', { class: 'woodchip', style: { left: e.clientX - b.left + 'px', top: e.clientY - b.top + 'px' } });
      wrap.append(c);
      const dx = (Math.random() - 0.5) * 60, dy = -20 - Math.random() * 40, rot = (Math.random() - 0.5) * 540;
      c.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => c.remove();
    }
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
      undo.push(clone(mask)); if (undo.length > 20) undo.shift();
      const p = cell(e); cur = { id: e.pointerId, p };
      if (carve(mask, p[0], p[1], TOOLS[tl][2])) { chip(e); schedule(); onChange(); }
    });
    cv.addEventListener('pointermove', e => {
      if (!cur || e.pointerId !== cur.id) return;
      const p = cell(e);
      if (carveLine(mask, cur.p, p, TOOLS[tl][2])) { chip(e); schedule(); onChange(); }
      cur.p = p;
    });
    const end = e => { if (cur && e.pointerId === cur.id) cur = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    redraw();
    const toolSeg = h('div', { class: 'seg' }, ...Object.entries(TOOLS).map(([k, [n, sub]]) => h('button', { class: 'segb tool-' + k + (k === tl ? ' on' : ''), 'data-t': k, onclick: e => { tl = k; e.currentTarget.parentNode.querySelectorAll('.segb').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, h('b', {}, n), h('span', { class: 'small' }, ` ${sub}`))));
    const undoBtn = h('button', { class: 'btn small', 'data-act': 'undo', onclick: () => { if (undo.length) { mask = undo.pop(); redraw(); onChange(); } } }, '↶ 되돌리기');
    const resetBtn = h('button', { class: 'btn small', onclick: () => { undo.push(clone(mask)); mask = maskOf('plain'); redraw(); onChange(); } }, '🪵 새 판');
    return { wrap, toolSeg, undoBtn, resetBtn, get mask() { return mask; }, set mask(m) { mask = clone(m); redraw(); }, destroy() { cancelAnimationFrame(raf); } };
  }

  // ── 새기기 — 찍어 보면 채점 ──
  function carveStage() {
    const spec = specs[s.id](), board = carveBoard({ guides: s.guides, tool: s.tool });
    cleanup = () => board.destroy();
    const tc = canvas('mini'); drawPrint(tc, idealOf(s.target), { size: 150 });
    const res = h('div', { class: 'result' });
    put(Q, board.wrap);
    put(A, h('div', { class: 'tgt' }, card(tc, '이렇게 찍히게', 'target'), h('div', { class: 'tgt-t' }, h('p', { class: 'a-q' }, '칼'), board.toolSeg, h('div', { class: 'row' }, board.undoBtn, board.resetBtn))),
      h('div', { class: 'go-row' }, h('span', { class: 'muted small' }, '판 위를 눌러 끌면 파여요'), h('span', { class: 'sp' }), goBtn('🖨 찍어 보기', test, 'print')), res);
    async function test() {
      if (solved) return;
      const m = board.mask, pc = canvas('pr'); drawPrint(pc, m, { size: 200 });
      const r = judgeCarve(s.id, spec, m);
      put(res, card(pc, '찍어 본 종이', 'peel'), h('p', { class: 'small ' + (r.ok ? 'good' : 'bad') }, r.ok ? '목표처럼 찍혔어요!' : r.say));
      if (!r.ok) { miss(r.kind); say(r.say, 'bad'); return; }
      solved = true;
      await sleep(700);
      finish(s.why, r.stars, { show: (() => { const c = canvas('mini'); drawPrint(c, m, { size: 150 }); return c; })() });
    }
  }

  // ── 찍기 — 롤러로 잉크 → 종이 덮기 → 바렌으로 문지르기 → 떼기 ──
  function press() {
    const S = 384, mask = maskOf(s.block), ink = new Float32Array(N * N), rub = new Float32Array(N * N);
    let phase = 'ink', cur = null, raf = 0;
    const bc = canvas('blk'), ghost = canvas('ghost');
    const roller = h('div', { class: 'roller' }, h('span', { class: 'roll' }), h('span', { class: 'handle' }));
    const paperEl = h('div', { class: 'paper-sheet' }, ghost), barren = h('div', { class: 'barren' });
    const stage = h('div', { class: 'press-wrap' }, bc, paperEl, roller, barren);
    const bars = { ink: h('i'), rub: h('i') };
    const stepEls = {
      ink: h('li', { 'data-step': 'ink' }, h('b', {}, '① 롤러로 잉크 바르기'), h('span', { class: 'bar' }, bars.ink), h('span', { class: 'muted small pct' })),
      paper: h('li', { 'data-step': 'paper' }, h('b', {}, '② 종이 덮기'), h('button', { class: 'btn small', 'data-act': 'paper', onclick: () => setPhase('rub') }, '종이 덮기')),
      rub: h('li', { 'data-step': 'rub' }, h('b', {}, '③ 바렌으로 문지르기'), h('span', { class: 'bar' }, bars.rub), h('span', { class: 'muted small pct' })),
      lift: h('li', { 'data-step': 'lift' }, h('b', {}, '④ 종이 떼기'), h('button', { class: 'btn primary small', 'data-act': 'lift', onclick: () => lift() }, '종이 떼기')),
    };
    const res = h('div', { class: 'result' });
    const redraw = () => { raf = 0; drawBlock(bc, mask, { size: S, ink, inkColor: INK0 }); if (phase === 'rub') drawPrint(ghost, mask, { size: S, ink, rub, variant: 'same', ghost: true }); updateBars(); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(redraw); };
    function updateBars() {
      const c = pressCoverage(mask, ink, rub);
      bars.ink.style.width = Math.round(c.ink * 100) + '%'; stepEls.ink.querySelector('.pct').textContent = Math.round(c.ink * 100) + '%';
      bars.rub.style.width = Math.round(c.rub * 100) + '%'; stepEls.rub.querySelector('.pct').textContent = phase === 'ink' ? '' : Math.round(c.rub * 100) + '%';
    }
    function setPhase(p) {
      phase = p;
      for (const [k, el] of Object.entries(stepEls)) el.classList.toggle('now', k === p || (p === 'ink' && k === 'paper') || (p === 'rub' && k === 'lift'));
      stepEls.paper.querySelector('button').disabled = p !== 'ink'; stepEls.lift.querySelector('button').disabled = p !== 'rub';
      stage.dataset.phase = p;
      paperEl.style.display = p === 'rub' ? 'block' : 'none';
      say(p === 'ink' ? '판 위를 눌러 끌면 롤러가 굴러가요 — 판 전체에 잉크를!' : p === 'rub' ? '종이 위를 눌러 끌며 바렌으로 문질러요 — 구석구석!' : '');
      schedule();
    }
    const cell = e => { const b = bc.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * N, (e.clientY - b.top) / b.height * N]; };
    const RW = N * 0.56, RH = N * 0.13, BR = N * 0.11;
    function deposit(arr, cx, cy, kind) {
      let ch = 0;
      if (kind === 'ink') {
        const x0 = Math.max(0, Math.floor(cx - RW / 2)), x1 = Math.min(N - 1, Math.ceil(cx + RW / 2)), y0 = Math.max(0, Math.floor(cy - RH / 2)), y1 = Math.min(N - 1, Math.ceil(cy + RH / 2));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (!mask[i] && arr[i] < 1) { arr[i] = Math.min(1, arr[i] + 0.09); ch++; } }
      } else {
        const x0 = Math.max(0, Math.floor(cx - BR)), x1 = Math.min(N - 1, Math.ceil(cx + BR)), y0 = Math.max(0, Math.floor(cy - BR)), y1 = Math.min(N - 1, Math.ceil(cy + BR));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= BR * BR && arr[i] < 1) { arr[i] = Math.min(1, arr[i] + 0.12); ch++; } }
      }
      return ch;
    }
    function tool(e) {   // 롤러 · 바렌 그림이 손을 따라온다
      const b = stage.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      roller.style.transform = `translate(${x}px, ${y}px)`; barren.style.transform = `translate(${x}px, ${y}px)`;
    }
    function work(e, p0, p1) {
      const kind = phase === 'ink' ? 'ink' : phase === 'rub' ? 'rub' : null; if (!kind) return;
      const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), steps = Math.max(1, Math.ceil(d));
      let ch = 0;
      for (let k = 1; k <= steps; k++) ch += deposit(kind === 'ink' ? ink : rub, p0[0] + (p1[0] - p0[0]) * k / steps, p0[1] + (p1[1] - p0[1]) * k / steps, kind);
      if (ch) schedule();
    }
    stage.addEventListener('pointerdown', e => { if (phase !== 'ink' && phase !== 'rub') return; e.preventDefault(); try { stage.setPointerCapture(e.pointerId); } catch {} const p = cell(e); cur = { id: e.pointerId, p }; tool(e); work(e, p, p); stage.classList.add('down'); });
    stage.addEventListener('pointermove', e => { tool(e); if (!cur || e.pointerId !== cur.id) return; const p = cell(e); work(e, cur.p, p); cur.p = p; });
    const end = e => { if (cur && e.pointerId === cur.id) { cur = null; stage.classList.remove('down'); } };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    async function lift() {
      if (phase !== 'rub' || solved) return;
      phase = 'lift'; stage.dataset.phase = 'lift';
      paperEl.classList.add('lifting'); await sleep(650); paperEl.classList.remove('lifting');
      const c = pressCoverage(mask, ink, rub), r = judgePress(c), pc = canvas('pr');
      drawPrint(pc, mask, { size: 220, ink, rub });
      put(res, card(pc, '떼어 낸 종이', 'peel'), h('p', { class: 'small ' + (r.ok ? 'good' : 'bad') }, r.ok ? '깨끗하게 찍혔어요!' : r.say),
        r.ok ? null : h('button', { class: 'btn small', 'data-act': 'again', onclick: () => { ink.fill(0); rub.fill(0); put(res); setPhase('ink'); } }, '🔁 다시 찍기'));
      if (!r.ok) { miss(r.kind); say(r.say, 'bad'); return; }
      solved = true;
      finish(s.why, r.stars, { show: (() => { const m = canvas('mini'); drawPrint(m, mask, { size: 150, ink, rub }); return m; })() });
    }
    put(Q, stage);
    put(A, h('ol', { class: 'steps' }, ...Object.values(stepEls)), res);
    setPhase('ink');
    cleanup = () => cancelAnimationFrame(raf);
  }

  // ── 한 판으로 여러 장 — 색을 바꿔 세 장 ──
  function multi() {
    const S = 250, mask = maskOf(s.block), bc = canvas('blk'), full = new Float32Array(N * N).fill(1);
    let color = INKS[0], prints = [];
    const slots = h('div', { class: 'slots' }, ...Array.from({ length: s.need }, () => h('div', { class: 'slot-p' })));
    const draw = () => drawBlock(bc, mask, { size: S, ink: prints.length ? full : null, inkColor: color[2] });
    const pal = h('div', { class: 'inks' }, ...INKS.map(c => h('button', { class: 'inkb' + (c === color ? ' on' : ''), 'data-c': c[0], title: c[1], onclick: e => { color = c; e.currentTarget.parentNode.querySelectorAll('.inkb').forEach(b => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, h('i', { style: { background: c[2] } }), c[1])));
    async function printOne() {
      if (done || prints.length >= s.need) return;
      if (prints.length && prints[prints.length - 1] === color[0]) toast('색을 바꿔 찍어 봐요!');
      prints.push(color[0]); draw();
      const pc = canvas('pr'); drawPrint(pc, mask, { size: 150, inkColor: color[2] });
      const slot = slots.children[prints.length - 1]; slot.replaceChildren(pc); slot.classList.add('peel', 'full');
      say(`${prints.length}장째 — ${color[1]}`, 'good');
      if (prints.length >= s.need) { solved = true; await sleep(700); finish(s.why, new Set(prints).size >= 3 ? 3 : new Set(prints).size === 2 ? 2 : 1, { show: h('div', { class: 'win-prints' }, ...[...slots.children].map(x => { const c = x.querySelector('canvas'); const k = canvas('mini'); k.width = c.width; k.height = c.height; k.style.width = k.style.height = '90px'; k.getContext('2d').drawImage(c, 0, 0); return k; })) }); }
    }
    draw();
    put(Q, h('div', { class: 'multi-wrap' }, card(bc, '판(색이 바뀌어요)'), slots));
    put(A, h('p', { class: 'a-q' }, '잉크 색'), pal, h('div', { class: 'go-row' }, h('span', { class: 'muted small' }, `세 장을 찍어요 — 색을 바꿔 가며`), h('span', { class: 'sp' }), goBtn('🖨 찍기', printOne, 'print')));
  }

  // ── 나만의 판화 — 자유롭게 새기고, '찍으면 이렇게'를 보며, 색을 골라 찍기 ──
  function free() {
    let color = INKS[0], raf = 0, n = 0;
    const prev = canvas('mini');
    const board = carveBoard({ tool: 'v', onChange: () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawPrint(prev, board.mask, { size: 150, inkColor: color[2] }); }); } });
    cleanup = () => { board.destroy(); cancelAnimationFrame(raf); };
    const gallery = h('div', { class: 'slots small' });
    const pal = h('div', { class: 'inks' }, ...INKS.map(c => h('button', { class: 'inkb' + (c === color ? ' on' : ''), 'data-c': c[0], title: c[1], onclick: e => { color = c; e.currentTarget.parentNode.querySelectorAll('.inkb').forEach(b => b.classList.toggle('on', b === e.currentTarget)); drawPrint(prev, board.mask, { size: 150, inkColor: color[2] }); } }, h('i', { style: { background: c[2] } }), c[1])));
    function printIt() {
      if (count(board.mask) < 10) { say('먼저 판에 무언가 새겨요', 'bad'); return; }
      const pc = canvas('pr'); drawPrint(pc, board.mask, { size: 120, inkColor: color[2] });
      gallery.prepend(h('div', { class: 'slot-p full peel' }, pc)); while (gallery.children.length > 3) gallery.lastChild.remove();
      n++; say(`${n}장 찍었어요! 판은 그대로 — 더 새기거나 색을 바꿔 또 찍어요.`, 'good');
      if (!done) finish(s.why, null);
    }
    drawPrint(prev, board.mask, { size: 150, inkColor: color[2] });
    put(Q, board.wrap);
    put(A, h('div', { class: 'tgt' }, card(prev, '찍으면 이렇게(거울)', 'target'), h('div', { class: 'tgt-t' }, h('p', { class: 'a-q' }, '칼'), board.toolSeg, h('div', { class: 'row' }, board.undoBtn, board.resetBtn))),
      h('p', { class: 'a-q' }, '잉크 색'), pal, h('div', { class: 'go-row' }, h('span', { class: 'sp' }), goBtn('🖨 찍기', printIt, 'print')), gallery);
  }

  const RUN = { predict, choose, carve: carveStage, press, multi, free };
  RUN[s.kind]();
  // 장 안내(처음 한 번)
  if (idx === 0 && !lsGet('print.intro.' + ch.id, false)) { lsSet('print.intro.' + ch.id, true); modal(`${ch.id}장 · ${ch.title}`, h('div', {}, h('p', {}, ch.intro))); }
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__print = { s, state: () => ({ done, solved, wrong, msg: msg.textContent }) };
  return { unmount() { alive = false; cleanup && cleanup(); } };
}
