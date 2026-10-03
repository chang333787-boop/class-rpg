// 물감 연구소 — 빨강 · 노랑 · 파랑 + 흰색 · 검정을 한 방울씩 섞어 색을 만드는 미술실(색 섞기 · 밝게 어둡게 · 보색 · 자연의 색 · 느낌의 색)
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/s/<판> · #/lab(자유 실험실) · #/t(선생님)
//  설계 = docs/paint_lab_design.md · 판 정본 = stages.js(시험 = scripts/unit/paint/stages.test.mjs) · 색 엔진 = color.js
import { h } from './util.js';
import { createStore } from './store.js';
import { mix, hex, WHEEL, TUBES } from './color.js';
import { CHAPTERS, ST, stById, stOf } from './stages.js';
import { wheelSvg, wheelColors } from './draw.js';
import { mountStage, mountLab, myWheel, HOST } from './play.js';
import { mountTeacher } from './teacher.js';

const Q = new URLSearchParams(location.search);
const TEACHER = Q.has('teacher');
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const app = document.getElementById('app');
let current = null, progress = {};

const ctx = {
  store, TEACHER, ST,
  progress: () => progress,
  go: hash => { location.hash = hash; },
  //  기록 읽기가 늦거나(학교 와이파이) 끊겨도 화면은 4초 안에 연다 — 늦게 오면 다음 화면부터 반영
  onProgress: async () => { try { const p = await Promise.race([store.progress(), new Promise(r => setTimeout(() => r(null), 4000))]); if (p) progress = p; } catch (e) { console.warn(e); } },
  topBar(title, { back = null, right = [] } = {}) {
    const me = store.me;
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, '← 물감 연구소') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

// 판이 열렸나 — 장 안에서 앞 판을 풀어야 다음 판(선생님은 다 열림)
const isOpen = s => { if (TEACHER) return true; const l = stOf(s.ch), i = l.indexOf(s); return i === 0 || !!progress[l[i - 1].id]; };
const KIND = { predict: '예상', mix: '섞기', fill: '채우기', wheel: '보색', contrast: '대비', sort: '나누기', feel: '느낌' };
const hx = d => hex(mix(d));
// 판 단추 그림 — 판이 무엇을 하는지 한눈에(작은 동그라미 하나)
function iconOf(s) {
  const tube = k => TUBES.find(t => t.k === k).css;
  let bg;
  if (s.kind === 'predict') { const c = Object.entries(s.drops).flatMap(([k, n]) => Array(n).fill(tube(k))); bg = `conic-gradient(${c.map((x, i) => `${x} ${i * 100 / c.length}% ${(i + 1) * 100 / c.length}%`).join(',')})`; }
  else if (s.kind === 'mix') bg = hx(s.target.d);
  else if (s.kind === 'fill' && s.layout === 'wheel') bg = `conic-gradient(${s.slots.map((i, j) => `${hx(WHEEL[i][1])} ${j * 100 / 3}% ${(j + 1) * 100 / 3}%`).join(',')})`;
  else if (s.kind === 'fill') bg = 'linear-gradient(90deg,#d6e0f0,#1f5ab3 50%,#0c1a33)';
  else if (s.kind === 'wheel') bg = `linear-gradient(90deg,${hx(WHEEL[s.of[0]][1])} 50%,${hx(WHEEL[(s.of[0] + 6) % 12][1])} 50%)`;
  else if (s.kind === 'contrast') bg = `radial-gradient(circle,${hx(s.fg)} 38%,${hx(s.opts[s.answer].d)} 40%)`;
  else if (s.kind === 'sort') bg = `conic-gradient(${hx(WHEEL[2][1])} 0 33%,${hx(WHEEL[8][1])} 33% 66%,${hx(WHEEL[6][1])} 66%)`;
  else { const p = progress[s.id]; bg = p && typeof p.c === 'string' ? p.c : 'conic-gradient(#f4b183,#a9d18e,#9dc3e6,#c9a7e8,#f4b183)'; }
  return h('span', { class: 'sicon', style: { background: bg } });
}

function home() {
  const scored = ST.filter(s => s.kind !== 'feel'), total = ST.length, done = ST.filter(s => progress[s.id]).length, stars = scored.reduce((a, s) => a + ((progress[s.id] || {}).st || 0), 0);
  const mine = myWheel(progress, ST), filled = Object.keys(mine).length + 3;
  const chCard = c => {
    const list = stOf(c.id), got = list.filter(s => progress[s.id]).length;
    return h('div', { class: 'ccard' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${got} / ${list.length}`)),
      h('p', {}, c.intro),
      h('div', { class: 'pgrid' }, ...list.map(s => {
        const pr = progress[s.id], open = isOpen(s);
        return h('button', { class: 'pbtn' + (pr ? ' done' : '') + (open ? '' : ' lock'), disabled: !open, title: s.story, onclick: () => ctx.go('#/s/' + s.id) },
          iconOf(s), h('span', { class: 'pid' }, s.id), h('span', { class: 'pt' }, s.title),
          h('span', { class: 'stars' }, pr ? (s.kind === 'feel' ? '✓ 붙였어요' : '★'.repeat(pr.st) + '☆'.repeat(3 - pr.st)) : open ? KIND[s.kind] : '🔒'));
      })));
  };
  app.replaceChildren(
    ctx.topBar('물감 연구소', { right: TEACHER ? [h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '헷갈림 지도')] : [] }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'intro' },
        h('img', { class: 'host', src: HOST, alt: '' }),
        h('div', { class: 'intro-t' }, h('h2', {}, '빨강 · 노랑 · 파랑, 세 물감으로 만드는 색'),
          h('p', {}, '물방울 젤리의 물감 연구소예요. 물감 통을 눌러 한 방울씩 섞어요. 섞기 전에 어떤 색이 될지 먼저 예상하고, 목표 색과 내 색을 나란히 놓고 견주어요. 흰색으로 밝게, 검정으로 어둡게, 마주 보는 색으로 수수하게 — 자연의 색과 마음의 색까지 만들어 봐요.'),
          h('div', { class: 'intro-row' },
            h('button', { class: 'btn', onclick: () => ctx.go('#/lab') }, '🧪 자유 실험실'),
            h('div', { class: 'mine' }, h('b', {}, `${done} / ${total}`), h('span', {}, '한 판'), h('b', {}, String(stars)), h('span', {}, '별')))),
        h('div', { class: 'my-wheel' }, wheelSvg({ colors: wheelColors(mine), size: 150, labels: false }), h('span', { class: 'muted small' }, `내 색 바퀴 ${filled} / 12`))),
      h('div', { class: 'chapters' }, ...CHAPTERS.map(chCard)),
      h('p', { class: 'muted small foot' }, '3~4학년 미술 [4미02-03] 조형 요소(색)의 특징 탐색 · 5~6학년 [6미02-03] 조형 요소의 어울림 → 조형 원리(대비). 아이 낱말은 밝기 · 선명함 · 색깔(명도 · 채도는 쓰지 않아요). 진짜 물감으로는 ‘수채화 기초’ 2차시 색 섞기 · 9차시 색상환과 보색에서 이어서 해요.'))));
}

async function route() {
  if (current && current.unmount) { try { current.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  await ctx.onProgress();
  const [, a, b] = (location.hash || '#/').split('/');
  if (a === 's' && b) {
    const s = stById(b);
    if (!s || !isOpen(s)) { ctx.go('#/'); return; }
    current = mountStage(app, ctx, s);
    return;
  }
  if (a === 'lab') { current = mountLab(app, ctx); return; }
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  home();
}
addEventListener('hashchange', route);
route();
