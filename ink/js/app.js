// 먹 연구소 — 먹물과 물을 한 방울씩 섞어 먹색(농담)을 만들고, 한지에 붓으로 점 · 선 · 마른 붓 · 번짐을 그어 보는 미술실(+ 명화 탐정 수묵 사건)
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/s/<판> · #/t(선생님)
//  설계 = docs/ink_lab_design.md · 판 정본 = stages.js(시험 = scripts/unit/ink/stages.test.mjs) · 먹 엔진 = inkcolor.js · 붓 = brush.js
import { h } from './util.js';
import { createStore } from './store.js';
import { lightOf, TONES } from './inkcolor.js';
import { CHAPTERS, ST, INK_CASES, stById, stOf } from './stages.js';
import { mountStage, HOST, hx } from './play.js';
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
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, '← 먹 연구소') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

// 명화 탐정으로 — 같은 sid · 이름 그대로 + from=ink(저쪽 윗줄에 '먹 연구소로' 단추)
const artQuery = () => { const q = new URLSearchParams(location.search); q.delete('debug'); q.set('from', 'ink'); return q.toString(); };
// 판이 열렸나 — 장 안에서 앞 판을 풀어야 다음 판(선생님은 다 열림)
const isOpen = s => { if (TEACHER) return true; const l = stOf(s.ch), i = l.indexOf(s); return i === 0 || !!progress[l[i - 1].id]; };
const KIND = { predict: '예상', mix: '섞기', chain: '꼬리', brush: '붓', write: '쓰기' };
const TASK_ICON = { dots: 'radial-gradient(circle at 34% 40%,#1b1d22 0 18%,transparent 19%),radial-gradient(circle at 70% 64%,#1b1d22 0 9%,transparent 10%)', lines: 'linear-gradient(115deg,transparent 30%,#1b1d22 31% 44%,transparent 45% 62%,#555a60 63% 66%,transparent 67%)', dry: 'repeating-linear-gradient(0deg,#2a2c30 0 2px,transparent 2px 5px)', wet: 'radial-gradient(circle,#2a2c30 0 22%,rgba(42,44,48,.35) 30%,transparent 52%)', free: 'linear-gradient(160deg,transparent 40%,#8d9196 41% 54%,transparent 55%),linear-gradient(20deg,transparent 46%,#1b1d22 47% 66%,transparent 67%)' };
// 판 단추 그림 — 판이 무엇을 하는지 한눈에(작은 동그라미 하나)
function iconOf(s) {
  let bg;
  if (s.kind === 'predict') bg = `conic-gradient(#1b1d22 0 25%,#bcd8e6 25% 100%)`;
  else if (s.kind === 'mix') bg = hx(s.target.d);
  else if (s.kind === 'chain') bg = `linear-gradient(90deg,${TONES.map(t => hx(t)).join(',')})`;
  else if (s.kind === 'write') return h('span', { class: 'sicon glyph' }, s.glyph);   // 판본체 쓰기 — 그 판의 글자
  else bg = TASK_ICON[s.task] + ',#f1ebdf';
  return h('span', { class: 'sicon', style: { background: bg } });
}
// 내 먹색 다섯 — 1장에서 만든 먹색을 진한 차례로(진한 먹은 주어짐 · 종이는 그대로)
function myTones() {
  const made = { t1: hx(TONES[0]), paper: hx(TONES[4]) }, from = { t2: '1-2', t3: '1-4', t4: '1-3' };
  for (const [k, id] of Object.entries(from)) { const p = progress[id]; if (p && typeof p.c === 'string') made[k] = p.c; }
  return TONES.map(t => ({ t, c: made[t.k] || null }));
}

function home() {
  const scored = ST.filter(s => s.kind !== 'brush'), done = ST.filter(s => progress[s.id]).length, stars = scored.reduce((a, s) => a + ((progress[s.id] || {}).st || 0), 0);
  const tones = myTones(), got = tones.filter(x => x.c).length;
  const chCard = c => {
    const list = stOf(c.id), n = list.filter(s => progress[s.id]).length;
    return h('div', { class: 'ccard' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${n} / ${list.length}`)),
      h('p', {}, c.intro),
      h('div', { class: 'pgrid' }, ...list.map(s => {
        const pr = progress[s.id], open = isOpen(s);
        return h('button', { class: 'pbtn' + (pr ? ' done' : '') + (open ? '' : ' lock'), disabled: !open, title: s.story, onclick: () => ctx.go('#/s/' + s.id) },
          iconOf(s), h('span', { class: 'pid' }, s.id), h('span', { class: 'pt' }, s.title),
          h('span', { class: 'stars' }, pr ? (s.kind === 'brush' ? '✓ 해 봤어요' : '★'.repeat(pr.st) + '☆'.repeat(3 - pr.st)) : open ? KIND[s.kind] : '🔒'));
      })));
  };
  //  4장 = 명화 탐정의 수묵 사건으로(같은 sid · 이름 그대로 넘긴다)
  const artCard = () => {
    const c = CHAPTERS.find(x => x.id === 4), n = INK_CASES.filter(k => artDone[k.id]).length;
    return h('div', { class: 'ccard ink-art' },
      h('div', { class: 'c-head' }, h('b', {}, `${c.id}장 · ${c.title}`), h('span', { class: 'chip' }, c.concept), h('span', { class: 'sp' }), h('span', { class: 'muted' }, `${n} / ${INK_CASES.length}`)),
      h('p', {}, c.intro),
      h('div', { class: 'agrid' }, ...INK_CASES.map(k => h('a', { class: 'acase' + (artDone[k.id] ? ' done' : ''), href: `../art/index.html?${artQuery()}#/c/${k.id}`, 'data-c': k.id },
        h('span', { class: 'thumb' }, h('img', { src: `../art/img/thumb/${k.id}.webp`, alt: '', loading: 'lazy' })),
        h('span', { class: 'ac-t' }, h('b', {}, `${k.artist} 「${k.title}」`), h('span', { class: 'muted small' }, k.say)),
        h('span', { class: 'stars' }, artDone[k.id] ? '★'.repeat(artDone[k.id].st || 0) + ' 해결' : '🔍 명화 탐정에서 열기')))));
  };
  app.replaceChildren(
    ctx.topBar('먹 연구소', { right: TEACHER ? [h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '헷갈림 지도')] : [] }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'intro' },
        h('img', { class: 'host', src: HOST, alt: '' }),
        h('div', { class: 'intro-t' }, h('h2', {}, '먹 하나로 진하게, 옅게'),
          h('p', {}, '숯늑대의 먹 연구소예요. 먹은 나무나 기름을 태운 그을음을 아교로 굳혀 만들어요. 먹물에 물을 섞을수록 옅어지는 먹색(농담)을 만들고, 한지에 붓으로 점 · 선 · 마른 붓 · 번짐을 그어 보고, 판본체 글씨를 써요. 그다음 옛 화가의 그림에서 먹색을 읽어요.'),
          h('div', { class: 'intro-row' },
            h('div', { class: 'mine' }, h('b', {}, `${done} / ${ST.length}`), h('span', {}, '한 판'), h('b', {}, String(stars)), h('span', {}, '별')))),
        h('div', { class: 'my-tones' }, h('div', { class: 'mt-row' }, ...tones.map(x => h('span', { class: 'mt' + (x.c ? '' : ' is-empty'), style: { background: x.c || '' }, title: x.t.name }))),
          h('span', { class: 'muted small' }, `내 먹색 다섯 ${got} / 5`))),
      h('div', { class: 'chapters' }, ...CHAPTERS.filter(c => ST.some(s => s.ch === c.id)).map(chCard), artCard()),
      h('p', { class: 'muted small foot' }, '3~4학년 미술 [4미02-02] 표현 재료(한지 · 먹)와 용구의 특성 · 사용 방법 · [4미02-03] 조형 요소(선 · 질감) 탐색 · [4미03-02] 작품의 특징 설명. 미술 교과서 9종 모두 3학년에 먹 · 수묵화, 4학년에 판본체 붓글씨가 있어요. 진짜 먹과 붓으로 한 번 더 해 보면 손이 기억해요.'))));
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
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  try { const d = await Promise.race([store.artDone(), new Promise(r => setTimeout(() => r(null), 3000))]); if (d) artDone = d; } catch (e) { console.warn(e); }
  home();
}
addEventListener('hashchange', route);
route();
