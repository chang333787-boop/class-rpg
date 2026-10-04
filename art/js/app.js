// 명화 탐정 — 저작권이 끝난 옛 그림 열두 장을 자세히 보며 숨은 것을 찾고(찾기) · 단서로 생각하고(생각) · 느낌을 고르고 · 질문을 만든다
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/c/<그림> · #/t(선생님)
//  설계 = docs/art_detective_design.md · 사건 정본 = cases.js(시험 = scripts/unit/art/cases.test.mjs) · 그림 출처 = art/CREDITS.md
import { h, modal } from './util.js';
import { createStore } from './store.js';
import { CHAPTERS, CASES, caseById, casesOf } from './cases.js';
import { mountCase, HOST } from './play.js';
import { mountTeacher } from './teacher.js';

const Q = new URLSearchParams(location.search);
const TEACHER = Q.has('teacher');
const FROM = Q.get('from');   // ink = 먹 연구소 3장 · wc = 수채화 기초 차시 · print = 판화 놀이 4장에서 왔으면 윗줄에 돌아가는 단추
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const app = document.getElementById('app');
const inkHome = () => { const q = new URLSearchParams(location.search); q.delete('from'); q.delete('lesson'); return `../ink/index.html${q.toString() ? '?' + q : ''}#/`; };
const wcLesson = () => { const w = new URLSearchParams(); if (Q.get('course') === 'drawing') w.set('course', 'drawing'); if (Q.get('sid')) w.set('sid', Q.get('sid')); if (Q.get('lesson') != null) w.set('lesson', Q.get('lesson')); return `../watercolor/index.html?${w}`; };
const printHome = () => { const q = new URLSearchParams(location.search); q.delete('from'); q.delete('lesson'); return `../print/index.html${q.toString() ? '?' + q : ''}#/`; };
const backOut = () => (FROM === 'ink' ? h('a', { class: 'btn small back-ink', href: inkHome() }, '🖌 먹 연구소로') : FROM === 'wc' ? h('a', { class: 'btn small back-ink', href: wcLesson() }, Q.get('course') === 'drawing' ? '✏️ 데생 기초로' : '🎨 수채화 기초로')
  : FROM === 'print' ? h('a', { class: 'btn small back-ink', href: printHome() }, '🪞 판화 놀이로') : null);
let current = null, progress = {};

const ctx = {
  store, TEACHER,
  progress: () => progress,
  go: hash => { location.hash = hash; },
  //  기록 읽기가 늦거나(학교 와이파이) 끊겨도 화면은 4초 안에 연다
  onProgress: async () => { try { const p = await Promise.race([store.progress(), new Promise(r => setTimeout(() => r(null), 4000))]); if (p) progress = p; } catch (e) { console.warn(e); } },
  topBar(title, { back = null, right = [] } = {}) {
    const me = store.me;
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, '← 명화 탐정') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      backOut(),
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

function credits() {
  modal('그림 출처', h('div', {},
    h('p', {}, `그림 ${CASES.length}장은 모두 저작권이 끝난 옛 그림이에요. 위키미디어 공용(Wikimedia Commons)에서 받아 크기만 줄였어요.`),
    h('ul', { class: 'credits' }, ...CASES.map(c => h('li', {}, `${c.artist} 「${c.title}」 ${c.year} — ${c.where}`))),
    h('p', { class: 'muted small' }, '「초충도 — 수박과 들쥐」는 국립중앙박물관 공공누리 제1유형(출처 표시) · 나머지는 퍼블릭 도메인. 자세한 파일 주소는 art/CREDITS.md')), [{ label: '닫기', primary: true }], { wide: true });
}

function home() {
  const done = CASES.filter(c => progress[c.id]).length, stars = CASES.reduce((a, c) => a + ((progress[c.id] || {}).st || 0), 0);
  const card = c => {
    const p = progress[c.id];
    return h('button', { class: 'case-card' + (p ? ' done' : ''), 'data-c': c.id, onclick: () => ctx.go('#/c/' + c.id) },
      h('span', { class: 'thumb' }, h('img', { src: `img/thumb/${c.img}.webp`, alt: '', loading: 'lazy' })),
      h('span', { class: 'cc-t' }, h('b', {}, c.title), h('span', { class: 'muted small' }, `${c.artist} · ${c.year.replace(/\(.*\)/, '')}`)),
      h('span', { class: 'stars' }, p ? '★'.repeat(p.st) + '☆'.repeat(3 - p.st) : '🔍 사건 열기'));
  };
  app.replaceChildren(
    ctx.topBar('명화 탐정', { right: [TEACHER ? h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '탐정 기록') : null, h('button', { class: 'btn small', onclick: credits }, '그림 출처')].filter(Boolean) }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'intro' },
        h('img', { class: 'host', src: HOST, alt: '' }),
        h('div', { class: 'intro-t' }, h('h2', {}, '그림 속 사건을 푸는 탐정이 되어 봐요'),
          h('p', {}, `오래된 명화 ${CASES.length}장. 숨은 것을 찾고(찾기) → 무슨 일인지 그림 속 단서로 생각하고(생각) → 느낌을 고르고(느낌) → 궁금한 것을 질문으로 만들어요(질문). 자세히 볼수록 그림이 말을 걸어요.`)),
        h('div', { class: 'mine' }, h('b', {}, `${done} / ${CASES.length}`), h('span', {}, '해결한 사건'), h('b', {}, String(stars)), h('span', {}, '별'))),
      ...CHAPTERS.map(ch => h('div', { class: 'ccard' },
        h('div', { class: 'c-head' }, h('b', {}, `${ch.id}장 · ${ch.title}`), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${casesOf(ch.id).filter(c => progress[c.id]).length} / ${casesOf(ch.id).length}`)),
        h('p', {}, ch.intro),
        h('div', { class: 'cgrid' }, ...casesOf(ch.id).map(card)))),
      h('p', { class: 'muted small foot' }, '3~4학년 미술 감상 [4미03-01] 미술 작품을 자세히 보고 작품과 미술가에 관해 질문할 수 있다 · [4미03-02] 미술 작품의 특징과 작품에 관한 자신의 느낌과 생각을 설명할 수 있다. 진짜 미술관처럼 천천히, 오래 보세요.'))));
}

async function route() {
  if (current && current.unmount) { try { current.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  await ctx.onProgress();
  const [, a, b] = (location.hash || '#/').split('/');
  if (a === 'c' && b) { const c = caseById(b); if (!c) { ctx.go('#/'); return; } current = mountCase(app, ctx, c); return; }
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  home();
}
addEventListener('hashchange', route);
route();
