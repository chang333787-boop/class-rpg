// [PATTERN-6] 우리 반 무늬 전시 · 친구 무늬 규칙 맞히기
//  전시 = 친구들이 건 무늬(최근 것부터) · 내 무늬는 '맞힌 친구 n명'과 내리기. 이름은 RPG 이름(글 입력 없음 — 낯선 글이 오르지 않게).
//  규칙 맞히기 = 친구 무늬를 목표로, 규칙 칸 크기만 알려 주고 움직임을 찾게 한다(4장 무늬 만들기와 같은 판 · 그림이 같으면 맞음).
//  친구 작품이 탐정 문제가 된다 — 교육과정 '다른 친구들의 설명을 검토'를 무늬로.
import { h, toast } from './util.js';
import { validWork, wallpaper, WALL, MOVES } from './tiles.js';
import { tileCanvas, wallCanvas } from './draw.js';
import { makeBuilder } from './builder.js';
import { HOST } from './play.js';

const withTimeout = (p, ms = 5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
const listOf = data => {
  const out = [];
  for (const [sid, ws] of Object.entries((data && data.works) || {})) for (const [id, w] of Object.entries(ws || {})) {
    if (!validWork(w)) continue;
    out.push({ sid, id, w, name: ((data.names || {})[sid] || '친구').slice(0, 20), solved: Object.keys(((data.solves || {})[sid + '__' + id]) || {}) });
  }
  return out.sort((a, z) => (z.w.t || 0) - (a.w.t || 0));
};

export async function mountGallery(root, ctx) {
  const box = h('div', { class: 'gallery' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('6장 · 우리 반 무늬 전시', { back: '#/', right: [h('button', { class: 'btn small primary', onclick: () => ctx.go('#/make') }, '🎨 도장 공방')] }), h('div', { class: 'view' }, box));
  let data = null;
  try { data = await withTimeout(ctx.store.gallery()); } catch (e) { console.warn(e); }
  if (!data) { box.replaceChildren(h('div', { class: 'empty' }, '전시를 불러오지 못했어요 — 인터넷을 확인하고 다시 열어 봐요.')); return { unmount() {} }; }
  const me = ctx.store.me.sid, list = listOf(data);
  const mine = list.filter(x => x.sid === me), others = list.filter(x => x.sid !== me);
  const card = x => {
    const isMine = x.sid === me, iSolved = x.solved.includes(me), go = () => ctx.go(`#/w/${x.sid}/${x.id}`);
    return h('div', { class: 'wcard' + (isMine ? ' mine' : '') },
      h('button', { class: 'wthumb', 'data-w': x.sid + '/' + x.id, onclick: () => { if (!isMine) go(); } }, wallCanvas(wallpaper(x.w.g, x.w.u, WALL.cols, WALL.rows), 30)),
      h('div', { class: 'wmeta' }, h('b', {}, isMine ? '내 무늬' : `${x.name}의 무늬`), h('span', { class: 'muted small' }, `규칙 칸 ${x.w.u[0].length}×${x.w.u.length} · 맞힌 친구 ${x.solved.filter(s => s !== x.sid).length}명`)),
      isMine
        ? h('button', { class: 'btn small', onclick: async () => { if (!confirm('이 무늬를 전시에서 내릴까요?')) return; try { await ctx.store.deleteWork(x.sid, x.id); toast('전시에서 내렸어요'); } catch (e) { console.warn(e); toast('내리지 못했어요'); } mountGallery(root, ctx); } }, '내리기')
        : h('button', { class: 'btn small' + (iSolved ? '' : ' primary'), 'data-solve': x.sid + '/' + x.id, onclick: go }, iSolved ? '✓ 맞혔어요 · 다시' : '🔍 규칙 맞히기'));
  };
  box.replaceChildren(
    h('div', { class: 'g-intro' }, h('img', { src: HOST, alt: '' }), h('p', {}, '친구 무늬를 눌러 규칙을 맞혀 봐요. 규칙 칸의 크기만 알려 줘요 — 움직임을 찾아 똑같은 무늬를 만들면 맞힌 거예요.')),
    h('h3', {}, `내 무늬 ${mine.length}`),
    mine.length ? h('div', { class: 'wgrid' }, ...mine.map(card)) : h('div', { class: 'empty' }, '아직 건 무늬가 없어요 — 도장 공방에서 만들어 걸어요.'),
    h('h3', {}, `친구 무늬 ${others.length}`),
    others.length ? h('div', { class: 'wgrid' }, ...others.map(card)) : h('div', { class: 'empty' }, ctx.store.me.guest ? '손님으로 열면 이 기기 무늬만 보여요. RPG 안에서 열면 우리 반 친구들 무늬가 보여요.' : '아직 친구 무늬가 없어요. 친구가 걸면 여기에 떠요.'));
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__gallery = { list };
  return { unmount() {} };
}

// 친구 무늬 규칙 맞히기 — 목표 = 친구 무늬 · 규칙 칸 크기는 알려 줌 · 맞히면 친구 무늬에 '맞힌 친구'로 남는다
export async function mountFriend(root, ctx, owner, id) {
  const back = h('div', { class: 'empty' }, '불러오는 중…');
  root.replaceChildren(ctx.topBar('6장 · 친구 무늬 규칙 맞히기', { back: '#/gallery' }), h('div', { class: 'view' }, back));
  let data = null;
  try { data = await withTimeout(ctx.store.gallery()); } catch (e) { console.warn(e); }
  const w = data && data.works && data.works[owner] && data.works[owner][id];
  if (!validWork(w)) { back.textContent = '그 무늬를 찾지 못했어요 — 전시에서 다시 골라 봐요.'; return { unmount() {} }; }
  const name = ((data.names || {})[owner] || '친구').slice(0, 20), mine = owner === ctx.store.me.sid;
  const uw = w.u[0].length, uh = w.u.length, target = wallpaper(w.g, w.u, WALL.cols, WALL.rows);
  const msg = h('div', { class: 'msg' }), say = (t, k = '') => { msg.textContent = t; msg.className = 'msg ' + k; };
  const over = h('div', { class: 'over' });
  let wrong = 0, alive = true;
  const b = makeBuilder({ grid: w.g, uw, uh, cols: WALL.cols, rows: WALL.rows, target }, {
    onWrong: () => { wrong++; },
    onMismatch: () => say('아직 달라요 — 친구 무늬의 왼쪽 위 칸부터 하나씩 견줘 봐요.'),
    onSolved: async () => {
      say('🎉 맞혔어요!', 'good');
      if (!mine) { try { await ctx.store.solve(owner, id); } catch (e) { console.warn(e); } }
      setTimeout(() => {
        if (!alive) return;
        over.style.display = 'grid';
        over.replaceChildren(h('div', { class: 'win-card' }, h('img', { src: HOST, alt: '' }), h('b', {}, '맞혔어요!'),
          h('p', {}, `${mine ? '내' : name + '의'} 무늬 규칙: ${w.u.map(r => r.map(m => MOVES[m].short).join(' · ')).join(' / ')}${wrong ? ` · 틀린 고르기 ${wrong}번` : ' · 한 번에!'}`),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; } }, '무늬 다시 보기'), h('button', { class: 'btn primary', onclick: () => ctx.go('#/gallery') }, '전시로 →'))));
      }, 900);
    },
  });
  root.replaceChildren(
    ctx.topBar('6장 · 친구 무늬 규칙 맞히기', { back: '#/gallery', right: [h('span', { class: 'chip' }, mine ? '내 무늬' : `${name}의 무늬`)] }),
    h('div', { class: 'pz' },
      h('section', { class: 'q' },
        h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, `${mine ? '내' : name + '의'} 무늬 — 규칙을 맞혀요`), h('p', {}, `이 무늬는 규칙 칸 가로 ${uw} × 세로 ${uh}를 밀어서 채웠어요. 도장을 어떻게 움직였을까요?`))),
        h('div', { class: 'q-body' }, h('div', { class: 'stamp-cap' }, h('span', { class: 'cap' }, '도장'), tileCanvas(w.g, 54)), b.tBox)),
      h('section', { class: 'a' },
        h('div', { class: 'a-body' }, h('p', { class: 'a-q' }, '규칙 칸의 움직임을 정해요 — 칸을 누르고 아래에서 골라요'), h('div', { class: 'unit-row' }, b.unitEl, b.picker),
          h('p', { class: 'cap' }, '내가 만든 무늬'), b.prevBox),
        h('div', { class: 'foot-row' }, msg)),
      over));
  b.render();
  const ro = new ResizeObserver(() => { if (alive) b.renderWalls(); }); ro.observe(b.tBox);
  requestAnimationFrame(b.renderWalls);
  return { unmount() { alive = false; ro.disconnect(); } };
}
