// 무늬 공방 — 밀기 · 뒤집기 · 돌리기(4학년 수학 '평면도형의 이동')로 도장을 움직여 무늬를 만드는 미술실 놀이
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/p/<판> · #/make(도장 공방) · #/gallery(우리 반 무늬 전시) · #/w/<sid>/<id>(친구 무늬 맞히기) · #/t(선생님)
//  설계 = docs/pattern_workshop_design.md · 판 정본 = stages.js(시험 = scripts/unit/pattern/stages.test.mjs)
import { h } from './util.js';
import { createStore } from './store.js';
import { apply, wallpaper } from './tiles.js';
import { CHAPTERS, PUZ, puzById, puzOf } from './stages.js';
import { tileCanvas, wallCanvas } from './draw.js';
import { mountPuzzle, HOST } from './play.js';
import { mountTeacher } from './teacher.js';
import { mountMake } from './make.js';
import { mountGallery, mountFriend } from './gallery.js';

const Q = new URLSearchParams(location.search);
const TEACHER = Q.has('teacher');
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const app = document.getElementById('app');
let current = null, progress = {};

const ctx = {
  store, TEACHER,
  go: hash => { location.hash = hash; },
  //  기록 읽기가 늦거나(학교 와이파이) 끊겨도 화면은 4초 안에 연다 — 늦게 오면 다음 화면부터 반영
  onProgress: async () => { try { const p = await Promise.race([store.progress(), new Promise(r => setTimeout(() => r(null), 4000))]); if (p) progress = p; } catch (e) { console.warn(e); } },
  topBar(title, { back = null, right = [] } = {}) {
    const me = store.me;
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, '← 무늬 공방') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

// 판이 열렸나 — 장 안에서 앞 판을 풀어야 다음 판(선생님은 다 열림)
const isOpen = p => { if (TEACHER) return true; const l = puzOf(p.ch), i = l.indexOf(p); return i === 0 || !!progress[l[i - 1].id]; };
const KIND = { predict: '고르기', detect: '탐정', friend: '누구 말?', build: '만들기', fix: '고치기' };

function home() {
  const total = PUZ.length, done = PUZ.filter(p => progress[p.id]).length, stars = PUZ.reduce((a, p) => a + ((progress[p.id] || {}).st || 0), 0);
  const chCard = c => {
    const list = puzOf(c.id), got = list.filter(p => progress[p.id]).length;
    if (c.free) return h('div', { class: 'ccard free' },   // [PATTERN-6] 나의 무늬 — 판 대신 공방 · 전시
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept)),
      h('p', {}, c.intro),
      h('div', { class: 'free-row' },
        h('button', { class: 'fbtn', onclick: () => ctx.go('#/make') }, h('span', { class: 'big' }, '🎨'), h('b', {}, '도장 공방'), h('span', { class: 'muted small' }, '도장 그리기 · 규칙 칸 · 전시에 걸기')),
        h('button', { class: 'fbtn', onclick: () => ctx.go('#/gallery') }, h('span', { class: 'big' }, '🖼'), h('b', {}, '우리 반 무늬 전시'), h('span', { class: 'muted small' }, '친구 무늬의 규칙 맞히기'))),
      h('p', { class: 'muted small' }, '4장 무늬 만들기를 먼저 해 보면 규칙 칸이 쉬워요.'));
    if (!c.open) return h('div', { class: 'ccard soon' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'soon-tag' }, '곧 열려요')), h('p', {}, c.intro));
    return h('div', { class: 'ccard' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${got} / ${list.length}`)),
      h('p', {}, c.intro),
      h('div', { class: 'pgrid' }, ...list.map(p => {
        const pr = progress[p.id], open = isOpen(p);
        const icon = p.kind === 'build' || p.kind === 'fix' ? apply(p.grid, p.unit[0][p.unit[0].length - 1]) : p.target;
        return h('button', { class: 'pbtn' + (pr ? ' done' : '') + (open ? '' : ' lock'), disabled: !open, title: p.story, onclick: () => ctx.go('#/p/' + p.id) },
          tileCanvas(icon, 30), h('span', { class: 'pid' }, p.id), h('span', { class: 'pt' }, p.title),
          h('span', { class: 'stars' }, pr ? '★'.repeat(pr.st) + '☆'.repeat(3 - pr.st) : open ? KIND[p.kind] : '🔒'));
      })));
  };
  //  첫 화면 띠 — 바람개비 무늬 두 줄(도장 하나 + 돌리기 넷)
  const band = wallCanvas(wallpaper('tri', [['id', 'r90'], ['r270', 'r180']], 16, 2), 20, { gap: 1 });
  app.replaceChildren(
    ctx.topBar('무늬 공방', { right: TEACHER ? [h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '헷갈림 지도')] : [] }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'intro' },
        h('img', { class: 'host', src: HOST, alt: '' }),
        h('div', {}, h('h2', {}, '도장을 밀고 · 뒤집고 · 돌려서 무늬를 만들어요'),
          h('p', {}, '마법 애벌레의 무늬 공방이에요. 도장 하나를 어떻게 움직이느냐에 따라 마주 보는 장화, 바람개비, 거울 무늬가 생겨요. 움직이면 어떤 모양이 될지 먼저 머릿속으로 그려 보고, 도장이 실제로 움직이는 걸 보며 확인해요.'),
          band),
        h('div', { class: 'mine' }, h('b', {}, `${done} / ${total}`), h('span', {}, '푼 판'), h('b', {}, String(stars)), h('span', {}, '별'))),
      h('div', { class: 'chapters' }, ...CHAPTERS.map(chCard)),
      h('p', { class: 'muted small foot' }, '밀고 · 뒤집고 · 돌려서 무늬를 만들어요. 수학 시간에 배우는 ‘평면도형의 이동’과 이어져요.'))));
}

async function route() {
  if (current && current.unmount) { try { current.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  await ctx.onProgress();
  const [, a, b] = (location.hash || '#/').split('/');
  if (a === 'p' && b) {
    const p = puzById(b);
    if (!p || !isOpen(p)) { ctx.go('#/'); return; }
    current = mountPuzzle(app, ctx, p);
    return;
  }
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  if (a === 'make') { current = mountMake(app, ctx); return; }
  if (a === 'gallery') { current = await mountGallery(app, ctx); return; }
  if (a === 'w' && b) { const c = (location.hash || '').split('/')[3] || ''; current = await mountFriend(app, ctx, decodeURIComponent(b), decodeURIComponent(c)); return; }
  home();
}
addEventListener('hashchange', route);
route();
