// 판화 놀이 — 나무판을 새기고 잉크를 발라 찍어 보며 판화의 원리(좌우가 바뀐다 · 파낸 곳은 하얗게 · 여러 장)를 익히는 미술실(+ 명화 탐정 판화 사건)
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/s/<판> · #/t(선생님)
//  설계 = docs/print_lab_design.md · 판 정본 = stages.js(시험 = scripts/unit/print/stages.test.mjs) · 판 엔진 = block.js · 그리기 = draw.js
import { h } from './util.js';
import { createStore } from './store.js';
import { CHAPTERS, ST, PRINT_CASES, stById, stOf, blocks } from './stages.js';
import { mountStage, HOST, maskOf, idealOf } from './play.js';
import { drawBlock } from './draw.js';
import { mountTeacher } from './teacher.js';

const Q = new URLSearchParams(location.search);
const TEACHER = Q.has('teacher');
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const app = document.getElementById('app');
let current = null, progress = {}, artDone = {};

const ctx = {
  store, TEACHER, ST,
  progress: () => progress,
  go: hash => { location.hash = hash; },
  //  기록 읽기가 늦거나(학교 와이파이) 끊겨도 화면은 4초 안에 연다 — 늦게 오면 다음 화면부터 반영
  onProgress: async () => { try { const p = await Promise.race([store.progress(), new Promise(r => setTimeout(() => r(null), 4000))]); if (p) progress = p; } catch (e) { console.warn(e); } },
  topBar(title, { back = null, right = [] } = {}) {
    const me = store.me;
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, '← 판화 놀이') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

// 명화 탐정으로 — 같은 sid · 이름 그대로 + from=print(저쪽 윗줄에 '판화 놀이로' 단추)
const artQuery = () => { const q = new URLSearchParams(location.search); q.delete('debug'); q.set('from', 'print'); return q.toString(); };
// 판이 열렸나 — 장 안에서 앞 판을 풀어야 다음 판(선생님은 다 열림)
const isOpen = s => { if (TEACHER) return true; const l = stOf(s.ch), i = l.indexOf(s); return i === 0 || !!progress[l[i - 1].id]; };
const KIND = { predict: '예상', choose: '판 고르기', carve: '새기기', press: '찍기', multi: '여러 장', free: '자유' };
// 판 단추 그림 — 그 판의 나무판을 작게(새기기 판은 다 판 모습)
function iconOf(s) {
  const c = h('canvas', { class: 'sicon' });
  const m = s.kind === 'carve' ? idealOf(s.target) : s.kind === 'choose' ? maskOf(s.target.startsWith('text:') ? s.target : 'ballOutside', 'mirror') : maskOf(s.block || 'plain');
  try { drawBlock(c, m, { size: 44 }); } catch (e) { console.warn(e); }
  return c;
}

function home() {
  const scored = ST.filter(s => s.kind !== 'free'), done = ST.filter(s => progress[s.id]).length, stars = scored.reduce((a, s) => a + ((progress[s.id] || {}).st || 0), 0);
  const chCard = c => {
    const list = stOf(c.id), n = list.filter(s => progress[s.id]).length;
    return h('div', { class: 'ccard' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${n} / ${list.length}`)),
      h('p', {}, c.intro),
      h('div', { class: 'pgrid' }, ...list.map(s => {
        const pr = progress[s.id], open = isOpen(s);
        return h('button', { class: 'pbtn' + (pr ? ' done' : '') + (open ? '' : ' lock'), disabled: !open, title: s.story, onclick: () => ctx.go('#/s/' + s.id) },
          iconOf(s), h('span', { class: 'pid' }, s.id), h('span', { class: 'pt' }, s.title),
          h('span', { class: 'stars' }, pr ? (s.kind === 'free' ? '✓ 찍었어요' : '★'.repeat(pr.st) + '☆'.repeat(3 - pr.st)) : open ? KIND[s.kind] : '🔒'));
      })));
  };
  //  4장 = 명화 탐정의 판화 사건으로
  const artCard = () => {
    const c = CHAPTERS.find(x => x.id === 4), n = PRINT_CASES.filter(k => artDone[k.id]).length;
    return h('div', { class: 'ccard print-art' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${n} / ${PRINT_CASES.length}`)),
      h('p', {}, c.intro),
      h('div', { class: 'agrid' }, ...PRINT_CASES.map(k => h('a', { class: 'acase' + (artDone[k.id] ? ' done' : ''), href: `../art/index.html?${artQuery()}#/c/${k.id}`, 'data-c': k.id },
        h('span', { class: 'thumb' }, h('img', { src: `../art/img/thumb/${k.id}.webp`, alt: '', loading: 'lazy' })),
        h('span', { class: 'ac-t' }, h('b', {}, `${k.artist} 「${k.title}」`), h('span', { class: 'muted small' }, k.say)),
        h('span', { class: 'stars' }, artDone[k.id] ? '★'.repeat(artDone[k.id].st || 0) + ' 해결' : '🔍 명화 탐정에서 열기')))));
  };
  const demo = h('canvas', { class: 'demo' });
  app.replaceChildren(
    ctx.topBar('판화 놀이', { right: TEACHER ? [h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '헷갈림 지도')] : [] }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'intro' },
        h('img', { class: 'host', src: HOST, alt: '' }),
        h('div', { class: 'intro-t' }, h('h2', {}, '판에 새기고, 찍으면 거울처럼'),
          h('p', {}, '거울 장어의 판화 놀이예요. 나무판에 칼로 새기고, 롤러로 잉크를 발라 종이에 찍어요. 찍으면 좌우가 바뀌고, 파낸 곳은 하얗게 남아요. 한 판으로 몇 장이든 찍을 수 있어요.'),
          h('div', { class: 'intro-row' }, h('div', { class: 'mine' }, h('b', {}, `${done} / ${ST.length}`), h('span', {}, '한 판'), h('b', {}, String(stars)), h('span', {}, '별')))),
        demo),
      h('div', { class: 'chapters' }, ...CHAPTERS.filter(c => ST.some(s => s.ch === c.id)).map(chCard), artCard()),
      h('p', { class: 'muted small foot' }, '3~4학년 미술 [4미02-02] 표현 재료와 용구(판 · 칼 · 롤러 · 바렌)의 특성 · 사용 방법 · [4미02-03] 조형 요소(형 · 선) 탐색. 미술 교과서 8종이 4학년에 판화를 다뤄요. 칼을 쓸 때는 늘 손을 칼 앞에 두지 않아요.'))));
  try { drawBlock(demo, blocks.pressFish(), { size: 132 }); } catch (e) { console.warn(e); }
}

async function route() {
  if (current && current.unmount) { try { current.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  await ctx.onProgress();
  const [, a, b] = (location.hash || '#/').split('/');
  if (a === 's' && b) {
    const s = stById(b);
    if (!s || !isOpen(s)) { ctx.go('#/'); return; }
    try { await Promise.race([document.fonts.load('900 64px "Noto Sans KR"', '가해'), new Promise(r => setTimeout(r, 2500))]); } catch {}   // 글자 판(‘가’ · ‘해’)은 글꼴이 온 뒤에 새긴다(늦으면 기본 글꼴로)
    current = mountStage(app, ctx, s);
    return;
  }
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  try { const d = await Promise.race([store.artDone(), new Promise(r => setTimeout(() => r(null), 3000))]); if (d) artDone = d; } catch (e) { console.warn(e); }
  home();
}
addEventListener('hashchange', route);
route();
