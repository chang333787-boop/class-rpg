// 기초 코딩 — 몬스터에게 명령하기(길 찾기) · 불씨 참새 붓(그림) · 선생님 막힘 지도
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/s/<판> · #/t(선생님)
//  설계 = docs/coding_room_design.md · 판 정본 = stages.js(정답 시험 = scripts/unit/coding/stages.test.mjs)
import { h } from './util.js';
import { createStore } from './store.js';
import { HEROES } from './world.js';
import { UNITS, STAGES, stageById, stagesOf } from './stages.js';
import { mountPlay } from './play.js';
import { mountTeacher } from './teacher.js';

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
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, '← 기초 코딩') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

// 판이 열렸나 — 단원 안에서 앞 판을 풀어야 다음 판(선생님은 다 열림)
const isOpen = s => { if (TEACHER) return true; const l = stagesOf(s.unit), i = l.indexOf(s); return i === 0 || !!progress[l[i - 1].id]; };

function home() {
  const total = STAGES.length, done = STAGES.filter(s => progress[s.id]).length, stars = STAGES.reduce((a, s) => a + ((progress[s.id] || {}).st || 0), 0);
  const heroCards = ['slime', 'crab', 'frog', 'squirrel', 'sparrow'].map(k => h('div', { class: 'hero' },
    h('img', { src: '../assets/monsters/' + HEROES[k].img + '.png', alt: '' }), h('b', {}, HEROES[k].name), h('span', {}, HEROES[k].about)));
  const unitCard = u => {
    const list = stagesOf(u.id), got = list.filter(s => progress[s.id]).length;
    if (!u.open) return h('div', { class: 'ucard soon' },
      h('div', { class: 'u-head' }, h('b', {}, `${u.id}단원 · ${u.title}`), h('span', { class: 'chip' }, u.concept), h('span', { class: 'soon-tag' }, '곧 열려요')),
      h('p', {}, u.intro));
    return h('div', { class: 'ucard' },
      h('div', { class: 'u-head' }, h('b', {}, `${u.id}단원 · ${u.title}`), h('span', { class: 'chip' }, u.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${got} / ${list.length}`)),
      h('p', {}, u.intro),
      h('div', { class: 'sgrid' }, ...list.map(s => {
        const p = progress[s.id], open = isOpen(s);
        return h('button', { class: 'sbtn' + (p ? ' done' : '') + (open ? '' : ' lock'), disabled: !open, title: s.story, onclick: () => ctx.go('#/s/' + s.id) },
          h('img', { src: '../assets/monsters/' + HEROES[s.hero].img + '.png', alt: '' }),
          h('span', { class: 'sid' }, s.id), h('span', { class: 'st' }, s.title),
          h('span', { class: 'stars' }, p ? '★'.repeat(p.st) + '☆'.repeat(3 - p.st) : open ? (s.buggy ? '고치기' : '') : '🔒'));
      })));
  };
  app.replaceChildren(
    ctx.topBar('기초 코딩', { right: TEACHER ? [h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '막힘 지도')] : [] }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'intro' },
        h('div', {}, h('h2', {}, '몬스터에게 명령해요'), h('p', {}, '블록을 이어 몬스터를 움직이고, 불씨 참새로 그림을 그려요. 몬스터마다 알아듣는 명령이 달라요 — 컴퓨터도 기계마다 쓰는 명령이 달라요.')),
        h('div', { class: 'mine' }, h('b', {}, `${done} / ${total}`), h('span', {}, '푼 판'), h('b', {}, String(stars)), h('span', {}, '별'))),
      h('div', { class: 'heroes' }, ...heroCards),
      h('div', { class: 'units' }, ...UNITS.map(unitCard)),
      h('p', { class: 'muted small foot' }, '1단원부터 차례로 풀어 가면 마지막에는 작은 게임까지 만들 수 있어요.'))));
}

async function route() {
  if (current && current.unmount) { try { current.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  await ctx.onProgress();
  const [, a, b] = (location.hash || '#/').split('/');
  if (a === 's' && b) {
    const s = stageById(b);
    if (!s || !isOpen(s)) { ctx.go('#/'); return; }
    current = await mountPlay(app, ctx, s);
    return;
  }
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  home();
}
addEventListener('hashchange', route);
if (!globalThis.Blockly) app.replaceChildren(h('div', { class: 'empty big' }, '블록 엔진을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.'));
else route();
