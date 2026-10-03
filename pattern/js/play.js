// 판 화면 — 왼쪽 = 문제(이야기 · 도장 · 결과 / 목표 무늬) · 오른쪽 = 답(보기 · 움직임 버튼 · 규칙 칸 · 고칠 칸)
//  답을 고르면 도장이 그 움직임을 실제로 해 보인다 — 맞으면 그 모습 그대로 멈추고, 틀리면 "그렇게 움직이면 이렇게 돼요"를 보여 주고 되돌린다.
//  틀린 답마다 헷갈림 이름(좌우·위아래 / 돌리는 방향 / 각도 / 뒤집기·돌리기 …)을 센다 → 선생님 헷갈림 지도.
import { h, modal, lsGet, lsSet } from './util.js';
import { MOTIFS, MOVES, MOVE_KEYS, apply, same, canon, mistakeOf, answersOfMove, unitAnswers } from './tiles.js';
import { tileCanvas, wallCanvas, fitPx, moveEl, resetEl } from './draw.js';
import { CHAPTERS, puzOf } from './stages.js';

export const HOST = '../assets/monsters/m3.png';   // 마법 애벌레 — 무늬 공방 주인(마디마디 되풀이 · 나비가 되면 대칭)
const WHY = {
  id: '그대로 밀면 모양은 그대로, 자리만 바뀌어요.',
  fh: '오른쪽으로 뒤집으면 왼쪽과 오른쪽이 바뀌고, 위와 아래는 그대로예요.',
  fv: '아래쪽으로 뒤집으면 위와 아래가 바뀌고, 왼쪽과 오른쪽은 그대로예요.',
  r90: '시계 방향으로 90° 돌리면 도장의 위쪽이 오른쪽으로 가요.',
  r180: '180° 돌리면 위는 아래로, 오른쪽은 왼쪽으로 — 둘 다 바뀌어요.',
  r270: '시계 반대 방향으로 90° 돌리면 도장의 위쪽이 왼쪽으로 가요.',
};
const DONE = { id: '그대로 민', fh: '오른쪽으로 뒤집은', fv: '아래쪽으로 뒤집은', r90: '시계 방향으로 90° 돌린', r180: '180° 돌린', r270: '시계 반대 방향으로 90° 돌린' };
const SAID = { id: '그대로 밀었어요', fh: '오른쪽으로 뒤집었어요', fhL: '왼쪽으로 뒤집었어요', fv: '아래쪽으로 뒤집었어요', fvU: '위쪽으로 뒤집었어요',
  r90: '시계 방향으로 90° 돌렸어요', r180: '180° 돌렸어요', r270: '시계 반대 방향으로 90° 돌렸어요', cw270: '시계 방향으로 270° 돌렸어요',
  ccw270: '시계 반대 방향으로 270° 돌렸어요', cw360: '시계 방향으로 360° 돌렸어요', ccw180: '시계 반대 방향으로 180° 돌렸어요' };
const starsOf = wrong => (wrong === 0 ? 3 : wrong === 1 ? 2 : 1);
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const blank = n => Array.from({ length: n }, () => '0'.repeat(n));
// 아이 이름 + '이'(받침이 있으면) — 민준이 말 · 지호 말
const nameI = n => { const c = String(n).charCodeAt(String(n).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? n + '이' : n; };
const mvBtn = (m, onclick, extra = '') => h('button', { class: 'mvbtn' + extra, 'data-m': m, onclick }, h('span', { class: 'ic' }, MOVES[m].icon), h('span', {}, MOVES[m].short));

export function mountPuzzle(root, ctx, p) {
  const ch = CHAPTERS.find(c => c.id === p.ch), list = puzOf(p.ch), idx = list.indexOf(p), next = list[idx + 1] || null;
  //  solved = 정답을 고른 순간(뒤 클릭 무시) · done = 맞았어요 카드까지 · tok = 마지막 클릭(움직임 중에 또 누르면 앞 것의 되돌리기는 버림)
  let wrong = 0, done = false, solved = false, alive = true, tok = 0, onSize = () => {};
  const msg = h('div', { class: 'msg' });
  const say = (t, kind = '') => { msg.textContent = t; msg.className = 'msg ' + kind; };
  const hintBtn = h('button', { class: 'btn small hint', onclick: () => modal('💡 힌트', p.hint) }, '💡 힌트');
  hintBtn.style.display = 'none';
  const over = h('div', { class: 'over' });
  const Q = h('div', { class: 'q-body' }), A = h('div', { class: 'a-body' });
  root.replaceChildren(
    ctx.topBar(`${p.id} · ${p.title}`, { back: '#/', right: [h('span', { class: 'chip c-ch' }, `${ch.id}장 ${ch.title}`), h('span', { class: 'chip' }, `도장: ${MOTIFS[p.motif].name}`)] }),
    h('div', { class: 'pz' },
      h('section', { class: 'q' }, h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, p.title), h('p', {}, p.story))), Q),
      h('section', { class: 'a' }, A, h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), hintBtn)),
      over));

  // 틀린 답 하나 — 셈 · 힌트(두 번 틀리면)
  function miss(mistake) {
    wrong++;
    if (wrong >= 2) hintBtn.style.display = '';
    ctx.store.saveTry(p.id, { ok: false, mistake: mistake || 'etc' }).catch(e => console.warn(e));
  }
  async function finish(text, st) {
    if (done) return;
    done = true;
    const stars = st || starsOf(wrong);
    say('🎉 ' + text, 'good');
    try { await ctx.store.saveTry(p.id, { ok: true, n: wrong, stars }); } catch (e) { console.warn(e); }
    ctx.onProgress && ctx.onProgress();
    await sleep(1000);
    if (!alive) return;
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'win-card' },
      h('img', { src: HOST, alt: '' }), h('div', { class: 'stars' }, STAR(stars)), h('b', {}, '맞았어요!'), h('p', {}, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; } }, '그림 다시 보기'),
        next ? h('button', { class: 'btn primary', onclick: () => ctx.go('#/p/' + next.id) }, '다음 판 →') : h('button', { class: 'btn primary', onclick: () => ctx.go('#/') }, `${p.ch}장 끝! 목록으로`))));
  }
  const stageRow = (left, right, label) => h('div', { class: 'stage-row' }, h('div', { class: 'stamp-wrap' }, left), h('div', { class: 'arrow' }, label ? h('span', { class: 'mv-chip' }, label) : null, h('b', {}, '→')), right);

  // ── 고르기: 움직이면 어떤 모양? ──
  function predict() {
    const stamp = h('div', { class: 'stamp' }, tileCanvas(p.grid, 176));
    Q.replaceChildren(stageRow(stamp, h('div', { class: 'qbox' }, '?'), MOVES[p.move].name));
    const btns = p.choices.map((m, i) => h('button', { class: 'choice', 'data-i': i, onclick: () => pick(m, btns[i]) }, tileCanvas(apply(p.grid, m), 128)));
    A.replaceChildren(h('p', { class: 'a-q' }, `${MOVES[p.move].name} — 어떤 모양이 될까요?`), h('div', { class: 'choices' }, ...btns));
    async function pick(m, b) {
      if (solved || b.classList.contains('bad')) return;
      const my = ++tok; resetEl(stamp);
      if (same(apply(p.grid, m), p.target)) {
        solved = true; b.classList.add('ok'); await moveEl(stamp, p.move); finish(WHY[p.move]);
        return;
      }
      b.classList.add('bad'); miss(mistakeOf(m, p.answers));
      say(`그건 ${DONE[m]} 모양이에요 — 도장이 그렇게 움직여 볼게요.`, 'bad');
      await moveEl(stamp, m); if (my !== tok) return;
      await sleep(900); if (my !== tok) return;
      resetEl(stamp); say(`그건 ${DONE[m]} 모양이었어요. '${MOVES[p.move].name}'는 어떤 모양일까요?`, 'bad');
    }
  }

  // ── 탐정: 어떻게 움직였을까? (답이 여럿이면 다 찾기) ──
  function detect() {
    const stamp = h('div', { class: 'stamp' }, tileCanvas(p.grid, 156));
    Q.replaceChildren(stageRow(stamp, h('div', { class: 'res' }, tileCanvas(p.target, 156))), h('p', { class: 'cap c' }, '왼쪽 도장이 움직여서 오른쪽 모양이 됐어요'));
    const found = new Set(), btns = {};
    MOVE_KEYS.forEach(m => { btns[m] = mvBtn(m, () => tryMove(m)); });
    A.replaceChildren(h('p', { class: 'a-q' }, p.multi ? `어떻게 움직였을까요? 답 ${p.answers.length}개를 모두 찾아요.` : '어떻게 움직였을까요?'), h('div', { class: 'moves' }, ...MOVE_KEYS.map(m => btns[m])));
    async function tryMove(m) {
      if (solved || found.has(m)) return;
      const my = ++tok; resetEl(stamp);
      const right = p.answers.includes(m);
      if (right) { found.add(m); btns[m].classList.add('ok'); if (found.size === p.answers.length) solved = true; }
      else { btns[m].classList.add('bad'); miss(mistakeOf(m, p.answers)); }
      await moveEl(stamp, m);
      if (right && solved) { finish(p.multi ? p.why : WHY[m]); return; }
      if (my !== tok) { btns[m].classList.remove('bad'); return; }
      if (right) { say('맞아요! 그런데 답이 하나 더 있어요 — 다른 움직임으로도 같은 모양이 돼요.', 'good'); return; }
      say(`${DONE[m]} 모양은 이래요 — 오른쪽 그림과 달라요. 다시 해 봐요.`, 'bad');
      await sleep(1100); btns[m].classList.remove('bad'); if (my === tok) resetEl(stamp);
    }
  }

  // ── 누구 말이 맞을까? — 직접 해 보기 · 넷 중 하나 ──
  function friend() {
    const stamp = h('div', { class: 'stamp' }, tileCanvas(p.grid, 140));
    const [[na, ma], [nb, mb]] = p.says;
    Q.replaceChildren(stageRow(stamp, h('div', { class: 'res' }, tileCanvas(p.target, 140))),
      h('div', { class: 'says' }, h('div', { class: 'say' }, h('b', {}, na), ` "${SAID[ma]}"`), h('div', { class: 'say' }, h('b', {}, nb), ` "${SAID[mb]}"`)));
    async function demo(m) { if (done) return; const my = ++tok; resetEl(stamp); await moveEl(stamp, m); await sleep(1000); if (my === tok && !done) resetEl(stamp); }
    const opts = [['a', `${nameI(na)} 말만 맞아요`], ['b', `${nameI(nb)} 말만 맞아요`], ['both', '둘 다 맞아요'], ['none', '둘 다 틀렸어요']];
    const btns = opts.map(([k, t]) => h('button', { class: 'opt', 'data-k': k, onclick: e => answer(k, e.currentTarget) }, t));
    A.replaceChildren(h('p', { class: 'a-q' }, '누구 말이 맞을까요?'),
      h('div', { class: 'tries' }, h('span', { class: 'muted small' }, '직접 해 보기'),
        h('button', { class: 'btn small', 'data-demo': 'a', onclick: () => demo(ma) }, `${nameI(na)}처럼 움직이기`), h('button', { class: 'btn small', 'data-demo': 'b', onclick: () => demo(mb) }, `${nameI(nb)}처럼 움직이기`)),
      h('div', { class: 'opts' }, ...btns));
    function answer(k, b) {
      if (solved) return;
      if (k === p.correct) { solved = true; b.classList.add('ok'); finish(p.why); return; }
      b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 900);
      //  헷갈림: 틀린 친구를 맞다고 했으면 그 움직임의 헷갈림 · 맞는 친구를 틀렸다고 했으면 '같은 그림 놓침'
      const thinks = { a: [true, false], b: [false, true], both: [true, true], none: [false, false] }[k];
      let mk = null;
      p.says.forEach(([, m], i) => { const real = p.answers.includes(canon(m)); if (!mk && thinks[i] && !real) mk = mistakeOf(m, p.answers); if (!mk && !thinks[i] && real) mk = 'samepic'; });
      miss(mk);
      say("다시 생각해 봐요 — '직접 해 보기'로 두 친구의 움직임을 해 보고 오른쪽 그림과 견줘요.", 'bad');
    }
  }

  // ── 무늬 만들기 — 규칙 칸에 움직임을 정하면 밀어서 판을 채운다(실시간) · 목표와 같으면 끝 ──
  function build() {
    const uw = p.unit[0].length, uh = p.unit.length, ans = unitAnswers(p.motif, p.unit), cells = uw * uh;
    const cur = p.unit.map(r => r.map(() => ''));
    let sel = [0, 0], changes = 0;
    const tBox = h('div', { class: 'wallbox' }), pBox = h('div', { class: 'wallbox small' }), unitEl = h('div', { class: 'unit' }), picker = h('div', { class: 'moves small' });
    unitEl.style.gridTemplateColumns = `repeat(${uw}, auto)`;
    Q.replaceChildren(h('p', { class: 'cap' }, '목표 무늬'), tBox);
    A.replaceChildren(h('p', { class: 'a-q' }, `규칙 칸(가로 ${uw} × 세로 ${uh})의 움직임을 정해요 — 칸을 누르고 아래에서 골라요`), h('div', { class: 'unit-row' }, unitEl, picker),
      h('p', { class: 'cap' }, '내 무늬 — 규칙 칸(점선)을 밀어서 채운 것'), pBox);
    const tileAt = (x, y) => { const m = cur[y % uh][x % uw]; return m ? apply(p.grid, m) : blank(p.grid.length); };
    const mine = () => Array.from({ length: p.rows }, (_, y) => Array.from({ length: p.cols }, (_, x) => tileAt(x, y)));
    function renderUnit() {
      unitEl.replaceChildren(...cur.flatMap((row, y) => row.map((m, x) => h('button', { class: 'ucell' + (sel[0] === x && sel[1] === y ? ' sel' : ''), 'data-xy': x + ',' + y, onclick: () => { sel = [x, y]; renderUnit(); renderPicker(); } },
        tileCanvas(m ? apply(p.grid, m) : blank(p.grid.length), 70), h('span', {}, m ? MOVES[m].short : '?')))));
    }
    function renderPicker() { picker.replaceChildren(...MOVE_KEYS.map(m => mvBtn(m, () => setMove(m), cur[sel[1]][sel[0]] === m ? ' on' : ''))); }
    function renderWalls() {
      const tw = tBox.clientWidth || 560, th = tBox.clientHeight || 360, pw = pBox.clientWidth || 300, ph = pBox.clientHeight || 150;
      tBox.replaceChildren(wallCanvas(p.wall, fitPx(p.cols, p.rows, tw, th)));
      pBox.replaceChildren(wallCanvas(mine(), fitPx(p.cols, p.rows, pw, ph), { unit: [uw, uh] }));
    }
    function setMove(m) {
      if (solved) return;
      const [x, y] = sel; if (cur[y][x] === m) return;
      cur[y][x] = m; changes++;
      const mk = mistakeOf(m, ans[y][x]); if (mk) miss(mk);
      renderUnit(); renderPicker(); renderWalls();
      const all = cur.every(r => r.every(Boolean)), match = all && cur.every((r, yy) => r.every((mm, xx) => ans[yy][xx].includes(mm)));
      if (match) { solved = true; finish('규칙 칸 하나를 밀어서 판을 가득 — 이게 규칙적인 무늬예요.', changes <= cells ? 3 : changes <= cells + 2 ? 2 : 1); }
      else if (all) say('아직 목표 무늬와 달라요 — 목표 무늬의 왼쪽 위 칸들을 하나씩 견줘 봐요.', '');
      else { const nx = cur.flat().findIndex(v => !v); if (nx >= 0) { sel = [nx % uw, Math.floor(nx / uw)]; renderUnit(); renderPicker(); } }
    }
    renderUnit(); renderPicker(); onSize = renderWalls; requestAnimationFrame(renderWalls);
  }

  // ── 무늬 고치기 — 틀린 칸 하나를 찾아 맞는 움직임으로 ──
  function fix() {
    const [wx, wy, wm] = p.wrong, uh = p.unit.length, uw = p.unit[0].length;
    const shown = p.wall.map((row, y) => row.map((t, x) => (x === wx && y === wy ? apply(p.grid, wm) : t)));
    const ansHere = answersOfMove(p.motif, p.unit[wy % uh][wx % uw]);
    let found = false;
    const gridEl = h('div', { class: 'fixgrid' }); gridEl.style.gridTemplateColumns = `repeat(${p.cols}, auto)`;
    const right = h('div', { class: 'fix-a' });
    Q.replaceChildren(h('p', { class: 'cap' }, '규칙에서 벗어난 칸을 눌러요'), gridEl);
    A.replaceChildren(right);
    right.replaceChildren(h('p', { class: 'a-q' }, '무늬의 규칙을 찾아요'), h('p', { class: 'muted' }, '같은 규칙 칸이 옆으로, 아래로 되풀이돼요. 줄끼리, 칸끼리 견줘서 혼자 다른 칸을 찾아요.'));
    let px = 60;
    function renderGrid() {
      px = fitPx(p.cols, p.rows, (gridEl.parentElement && gridEl.parentElement.clientWidth) || 560, ((gridEl.parentElement && gridEl.parentElement.clientHeight) || 380) - 30, 6);
      gridEl.replaceChildren(...shown.flatMap((row, y) => row.map((t, x) => h('button', { class: 'fcell' + (found && x === wx && y === wy ? ' sel' : ''), 'data-xy': x + ',' + y, onclick: e => tap(x, y, e.currentTarget) }, tileCanvas(t, px)))));
    }
    function tap(x, y, b) {
      if (solved) return;
      if (x === wx && y === wy) {
        found = true; renderGrid(); say('찾았어요! 이 칸은 어떤 움직임이어야 할까요?', 'good');
        right.replaceChildren(h('p', { class: 'a-q' }, '이 칸을 어떤 움직임으로 고칠까요?'),
          h('div', { class: 'moves pics' }, ...MOVE_KEYS.map(m => h('button', { class: 'mvbtn pic', 'data-m': m, onclick: e => choose(m, e.currentTarget) }, tileCanvas(apply(p.grid, m), 54), h('span', {}, MOVES[m].short)))));
      } else {
        miss('find'); b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 700);
        say('그 칸은 규칙에 맞아요 — 혼자 다른 칸을 찾아봐요.', 'bad');
      }
    }
    function choose(m, b) {
      if (solved) return;
      if (ansHere.includes(m)) { solved = true; shown[wy][wx] = apply(p.grid, m); renderGrid(); b.classList.add('ok'); finish(`고쳤어요! ${MOVES[m].name} — 이제 규칙대로 되풀이돼요.`); return; }
      b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 700); miss(mistakeOf(m, ansHere));
      say('그 모양도 규칙에 안 맞아요 — 같은 자리의 다른 칸들과 견줘 봐요.', 'bad');
    }
    onSize = renderGrid; requestAnimationFrame(renderGrid);
  }

  ({ predict, detect, friend, build, fix })[p.kind]();
  // 장 안내(처음 한 번)
  if (idx === 0 && !lsGet('pattern.intro.' + ch.id, false)) { lsSet('pattern.intro.' + ch.id, true); modal(`${ch.id}장 · ${ch.title}`, h('div', {}, h('p', {}, ch.intro))); }
  const ro = new ResizeObserver(() => { if (alive) onSize(); }); ro.observe(Q);
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__pattern = { p, state: () => ({ done, solved, wrong, msg: msg.textContent }) };
  return { unmount() { alive = false; ro.disconnect(); } };
}
