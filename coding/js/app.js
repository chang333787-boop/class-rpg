// 기초 코딩 — 몬스터에게 명령하기(길 찾기) · 불씨 참새 붓(그림) · 선생님 막힘 지도
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/s/<판> · #/t(선생님)
//  [ASSIGN-CODING-1] ?assign=<과제>(RPG 홈 '선생님 과제' 카드 · 수업 덮개는 &live=1) — #/ = 과제 쪽(그 판들만 · 잠금 없음) · #/all = 보통 첫 화면(과제함일 때만)
//   결과는 common/assign.js reportAssign → 부모 학생 화면이 내 칸에 쓴다 · 셈 = asg.js · 설계 = docs/class_assign_design.md §7-3
//  설계 = docs/coding_room_design.md · 판 정본 = stages.js(정답 시험 = scripts/unit/coding/stages.test.mjs)
import { h } from './util.js';
import { createStore } from './store.js';
import { HEROES } from './world.js';
import { UNITS, STAGES, stageById, stagesOf } from './stages.js';
import { mountPlay } from './play.js';
import { mountTeacher } from './teacher.js';
import { assignFromUrl, loadAssign, watchAssign, watchMine, reportAssign, onClassPause } from '../../common/assign.js';
import { asgState, nextAfter, runPatch } from './asg.js';

const Q = new URLSearchParams(location.search);
const TEACHER = Q.has('teacher');
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const app = document.getElementById('app');
let current = null, progress = {};
//  [ASSIGN-CODING-1] 선생님 과제 — A = { aid, sid, live } · asg = { def, cell, closed, tries:{판: 이 창에서 센 실행 수} } · 'loading' · 'fail' · 'kind'
const A = TEACHER ? null : assignFromUrl();
let asg = A ? 'loading' : null;
const asgStages = () => (asg && asg.def ? asg.def.content.coding.stages : []);
const isAsgStage = id => asgStages().includes(id);

const ctx = {
  store, TEACHER,
  //  수업 덮개 안(live)에서는 판을 옮겨도 뒤로 칸을 쌓지 않는다(부모 덮개의 뒤로 막기와 안 엉키게)
  go: hash => { if (A && A.live) location.replace(hash); else location.hash = hash; },
  //  기록 읽기가 늦거나(학교 와이파이) 끊겨도 화면은 4초 안에 연다 — 늦게 오면 다음 화면부터 반영
  onProgress: async () => { try { const p = await Promise.race([store.progress(), new Promise(r => setTimeout(() => r(null), 4000))]); if (p) progress = p; } catch (e) { console.warn(e); } },
  topBar(title, { back = null, right = [] } = {}) {
    const me = store.me;
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', onclick: () => ctx.go(back) }, asg && asg.def && back === '#/' ? '← 선생님 과제' : '← 기초 코딩') : null,
      h('h1', {}, title), h('span', { class: 'sp' }), ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
};

// 판이 열렸나 — 단원 안에서 앞 판을 풀어야 다음 판(선생님은 다 열림 · 선생님 과제 판도 늘 열림)
const isOpen = s => { if (TEACHER || isAsgStage(s.id)) return true; const l = stagesOf(s.unit), i = l.indexOf(s); return i === 0 || !!progress[l[i - 1].id]; };

function home() {
  const asgBtn = asg && asg.def ? [h('button', { class: 'btn small primary', onclick: () => ctx.go('#/') }, '📝 선생님 과제로')] : [];
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
    ctx.topBar('기초 코딩', { right: TEACHER ? [h('button', { class: 'btn small', onclick: () => ctx.go('#/t') }, '막힘 지도')] : asgBtn }),
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
  if (asg && !asg.def) { asgFallback(); return; }
  await ctx.onProgress();
  const [, a, b] = (location.hash || '#/').split('/');
  if (asg && asg.def && !a) { asgHome(); return; }
  if (asg && asg.def && a === 'all' && A.live) { ctx.go('#/'); return; }
  if (a === 's' && b) {
    const s = stageById(b);
    if (!s || !isOpen(s)) { ctx.go('#/'); return; }
    current = await mountStage(s);
    return;
  }
  if (a === 't') { current = await mountTeacher(app, ctx); return; }
  home();
}

// ── [ASSIGN-CODING-1] 선생님 과제 ──
const asgTop = () => ctx.topBar('📝 선생님 과제', { right: A && A.live ? [h('span', { class: 'chip asg-live-chip' }, '👩‍🏫 선생님과 수업 중')] : [h('button', { class: 'btn small', onclick: () => ctx.go('#/all') }, '기초 코딩 전체 보기')] });
//  과제를 못 불러옴 · 기초 코딩 과제가 아님 — 보통 모드로 슬쩍 가지 않는다(아이가 엉뚱한 판을 과제로 알지 않게)
function asgFallback() {
  const msg = asg === 'loading' ? ['⏳', '선생님 과제를 불러오는 중이에요', '']
    : asg === 'kind' ? ['🧩', '이 과제는 기초 코딩 과제가 아니에요', 'RPG 홈의 선생님 과제 카드에서 다시 열어 주세요.']
    : ['📡', '선생님 과제를 못 불러왔어요', '인터넷을 확인하고 다시 불러와 주세요.'];
  app.replaceChildren(ctx.topBar('📝 선생님 과제'), h('div', { class: 'view' }, h('div', { class: 'asg-wait' }, h('div', { class: 'asg-wait-ic' }, msg[0]), h('b', {}, msg[1]), msg[2] ? h('p', { class: 'muted' }, msg[2]) : null,
    asg === 'fail' ? h('button', { class: 'btn primary', onclick: () => asgBoot() }, '다시 불러오기') : null)));
}
//  과제 쪽 — 그 판들만(잠금 없음) · 판마다 별 · 실행 수 · 상태
function asgHome() {
  const def = asg.def, S = asgState(def.content.coding.stages, asg.cell);
  const card = (x, i) => {
    const s = stageById(x.id);
    if (!s) return h('div', { class: 'asg-stage miss' }, h('b', {}, x.id), h('span', { class: 'muted' }, '이 판을 찾지 못했어요'));
    const u = UNITS.find(v => v.id === s.unit) || {};
    return h('button', { class: 'asg-stage' + (x.ok ? ' done' : ''), onclick: () => ctx.go('#/s/' + s.id) },
      h('span', { class: 'asg-no' }, String(i + 1)),
      h('img', { src: '../assets/monsters/' + HEROES[s.hero].img + '.png', alt: '' }),
      h('span', { class: 'asg-txt' }, h('b', {}, `${s.id} · ${s.title}`), h('span', { class: 'muted small' }, `${u.id || ''}단원 ${u.title || ''}${s.buggy ? ' · 고치기' : ''}${s.game ? ' · 게임' : ''}`)),
      h('span', { class: 'asg-st' }, x.ok ? h('span', { class: 'stars' }, '★'.repeat(x.st) + '☆'.repeat(3 - x.st)) : x.tries ? `실행 ${x.tries}번` : '아직'),
      h('span', { class: 'btn small' + (x.ok ? '' : ' primary') }, x.ok ? '다시 하기' : x.tries ? '이어 하기' : '시작'));
  };
  const lead = asg.closed ? '선생님이 이 과제를 닫았어요 — 지금부터 푼 것은 과제에 안 들어가요'
    : S.done ? (A.live ? '다 했어요! ✓ 선생님이 끝낼 때까지 블록을 더 줄여 보거나 기다려요' : '다 했어요! ✓ 블록을 더 줄여 봐도 돼요')
    : '차례대로 풀어요. 판을 누르면 바로 열려요.';
  app.replaceChildren(asgTop(), h('div', { class: 'view' }, h('div', { class: 'home asg-home' },
    h('div', { class: 'intro' }, h('div', {}, h('h2', {}, def.title), h('p', {}, lead)),
      h('div', { class: 'mine' }, h('b', {}, `${S.solved} / ${S.total}`), h('span', {}, '푼 판'))),
    h('div', { class: 'asg-stages' }, ...S.list.map(card)))));
}
//  윗줄 칩 '📝 선생님 과제 1/3' — 과제 판에서만
ctx.assignChip = id => { const i = asgStages().indexOf(id); return i < 0 || asg.closed ? null : h('span', { class: 'chip asg-chip' }, `📝 선생님 과제 ${i + 1}/${asgStages().length}`); };
ctx.nextOf = id => (asg && asg.def && !asg.closed ? nextAfter(asgStages(), id) : undefined);
//  실행 한 번 — 과제 판이면 결과를 부모에게(부모가 내 칸에 씀)
ctx.onRun = (id, run, py) => {
  if (!asg || !asg.def || asg.closed || !isAsgStage(id)) return;
  const r = runPatch(asgStages(), asg.cell, id, run, { localTries: asg.tries[id] || 0, py });
  if (!r) return;
  asg.tries[id] = r.tries;
  reportAssign(store.db, A.aid, A.sid, r.patch).then(ok => { if (!ok) console.warn('[ASSIGN-CODING-1] 결과를 못 보냈어요'); });
};
//  과제 판은 코드 · 셈을 다른 열쇠에 — 아이가 전에 푼 코드를 안 덮고, 과제에서 처음 여는 판은 '새 종이'(판의 처음 모양)
function asgStore(id) {
  const k = id + '__asg_' + A.aid;
  return { ...store, loadCode: () => store.loadCode(k), saveCode: (_, j) => store.saveCode(k, j), saveRun: (st, r) => store.saveRun(st, r, { statsKey: k }) };
}
async function asgBoot() {
  asg = 'loading'; asgFallback();
  const db = store.db;
  const def = db ? await loadAssign(db, A.aid) : null;
  if (!def) { asg = 'fail'; asgFallback(); return; }
  if (def.kind !== 'coding') { asg = 'kind'; asgFallback(); return; }
  //  내 칸 — 첫 값이 온 뒤에(그 전에 견주면 좋은 기록을 덮는다) · 4초 넘으면 빈 칸으로 시작
  const box = { def, cell: null, closed: !!def.closed, tries: {} };
  await new Promise(res => {
    const t = setTimeout(res, 4000);
    watchMine(db, A.aid, A.sid, cell => { box.cell = cell; clearTimeout(t); res(); if (asg === box && !current && !(location.hash || '#/').split('/')[1]) asgHome(); });
  });
  watchAssign(db, A.aid, d => { if (d) { box.def = { ...d, closed: false }; box.closed = false; } else if (!box.closed) { box.closed = true; toast('선생님이 이 과제를 닫았어요'); if (!current && asg === box) asgHome(); } });
  asg = box;
  if (!box.cell || !box.cell.startedAt) reportAssign(db, A.aid, A.sid, { start: true });
  //  처음 들어오면 안 푼 첫 판으로(다 풀었으면 과제 쪽)
  const first = asgState(def.content.coding.stages, box.cell).firstOpen;
  if (first && !box.closed && !(location.hash || '').startsWith('#/s/')) { ctx.go('#/s/' + first); return; }   // hashchange 가 route 를 부른다
  route();
}
//  판을 열 때 과제 판이면 과제 저장소로
async function mountStage(s) { return mountPlay(app, asg && asg.def && isAsgStage(s.id) ? { ...ctx, store: asgStore(s.id) } : ctx, s); }
//  [ASSIGN-CODING-1] 부모 RPG 의 '선생님과 수업' 덮개 — 덮이면 돌던 실행 · 게임을 멈춘다(과제가 아니어도)
onClassPause(on => { if (on && current && current.pause) current.pause(); });

addEventListener('hashchange', route);
if (!globalThis.Blockly) app.replaceChildren(h('div', { class: 'empty big' }, '블록 엔진을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.'));
else if (A) asgBoot();
else route();
