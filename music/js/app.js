// 음악실 — 작곡 · 리코더 연습 · 리듬 게임 · 우리 반 음악회 · 리코더 기록장
//  RPG 안(?sid=&n=)에서 열면 내 이름으로 저장, 아니면 손님(이 기기에만). 주소: #/ · #/compose/<곡> · #/practice/<곡> · #/rhythm/<곡> · #/pick/<모드> · #/log · #/t
//  [ASSIGN-MUSIC-1] ?assign=<과제>(선생님 과제 · &live=1 = 선생님과 수업) — 그 곡 리듬 화면만 연다(다른 길은 막음) · 결과는 common/assign.js 로
import { h, toast, modal, lsGet, lsSet } from './util.js';
import { createStore } from './store.js';
import { librarySongs, normalize, buildEvents, songKey, emptySong, fromTeacherSong, libraryOnce } from './song.js';
import { engine, Player } from './audio.js';
import { SCALES, colorOf, meterOf, solfege } from './theory.js';
import { recorderOK, SYSTEMS } from './recorder.js';
import { badWords, songBad } from './safety.js';
import { mountCompose } from './compose.js';
import { mountPractice } from './practice.js';
import { mountRhythm } from './rhythm.js';
import { mountTeacher } from './teacher.js';
import { assignFromUrl, loadAssign, watchAssign, watchMine, reportAssign, onClassPause } from '../../common/assign.js';
import { rhythmSettings, rhythmPatch, myLine } from './assign-music.js';

const Q = new URLSearchParams(location.search);
// 선생님은 관리 화면에서 ?teacher=1 로 연다 → sid 'teacher' 로 같은 저장소(선생님이 지은 곡도 음악회에 올릴 수 있다)
const TEACHER = Q.has('teacher');
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const LIB = librarySongs();
const app = document.getElementById('app');
const listenPlayer = new Player(engine);
let current = null, temp = null;     // temp = 저장 전 곡(작곡 → 연습으로 바로 갈 때)
//  [ASSIGN-MUSIC-1] 선생님 과제 — A = { aid, sid, live } · asg = 불러온 뒤 { def, set, closed, cell } (null = 아직 · false = 못 불러옴)
const A = store.online ? assignFromUrl() : null;
let asg = null;
//  [MUSIC-TSONG-1] 선생님 곡(공연 곡) — 반 저장소 tsongs 를 쪽마다 한 번만 읽는다(교사 화면이 넣거나 지우면 다시 읽게 비움).
//   곡마다 fromTeacherSong 으로 살펴 틀린 곡은 건너뛴다 · 못 읽으면 빈 목록(다음에 다시) · 순서 = order → 제목
let tsongsP = null;
function teacherSongs() {
  if (!tsongsP) tsongsP = store.listTeacherSongs().then(list => {
    const out = [];
    for (const raw of list || []) { try { out.push(fromTeacherSong(raw)); } catch (e) { console.warn('[MUSIC-TSONG-1] 곡을 건너뜀', raw && raw.key, e.message); } }
    return out.sort((a, z) => (a.order - z.order) || a.title.localeCompare(z.title, 'ko'));
  }).catch(e => { console.warn('[MUSIC-TSONG-1] 선생님 곡을 못 읽음', e); tsongsP = null; return []; });
  return tsongsP;
}

const ctx = {
  store, LIB,
  go: hash => { location.hash = hash; },
  replaceRef: ref => { history.replaceState(null, '', '#/compose/' + ref); shownHash = location.hash; },
  refOf: s => s.lib || s.ts ? s.id : `u.${s.by || store.me.sid}.${s.id}`,
  teacherSongs, resetTeacherSongs: () => { tsongsP = null; },   // [MUSIC-TSONG-1] 교사 화면이 곡을 넣거나 지운 뒤 비운다
  sys: () => lsGet('music.sys', 'baroque'),
  setSys: v => lsSet('music.sys', v),
  openPractice: s => { temp = s; ctx.go('#/practice/_temp'); },
  openRhythm: s => { temp = s; ctx.go('#/rhythm/_temp'); },
  topBar(title, { back = null, right = [] } = {}) {
    const me = store.me;
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', onclick: typeof back === 'function' ? back : () => ctx.go(back) }, '← 음악실') : null,
      h('h1', {}, title),
      h('span', { class: 'sp' }),
      ...right,
      h('span', { class: 'who' }, me.guest ? h('span', {}, '손님', h('span', { class: 'guest' }, '이 기기에만 저장')) : h('b', {}, me.name || '나')));
  },
  async resolve(ref) {
    if (ref === '_temp') return temp;
    if (ref.startsWith('lib_')) return LIB.find(s => s.id === ref) || null;
    if (ref.startsWith('ts_')) return (await teacherSongs()).find(s => s.id === ref) || null;   // [MUSIC-TSONG-1]
    if (ref.startsWith('u.')) {
      const [, owner, id] = ref.split('.');
      const raw = await store.getSong(owner, id);
      if (!raw) return null;
      const s = normalize(raw);
      // [MUSIC-SAFE-1] 친구 곡: 노랫말이 고운 말이 아니면 노랫말 없이(가락은 그대로)
      if (owner !== store.me.sid && songBad(s).lyrics.length) s.notes = s.notes.map(n => ({ ...n, w: '' }));
      return s;
    }
    return null;
  },
  listen,
};

// ── 듣기(목록에서) ──  같은 단추를 다시 누르면 멈춤
let listenBtn = null;
function listen(song, btn) {
  if (listenPlayer.playing && listenBtn === btn) { listenPlayer.stop(); btn && btn.classList.remove('stop'); listenBtn = null; return; }
  if (listenBtn) listenBtn.classList.remove('stop');
  engine.ensure(); engine.setReverb(song.reverb || 0.12);
  const b = buildEvents(song, { orchFinale: true });   // [MUSIC-ORCH-1] 오케스트라 곡은 '점점 느리게 끝내기'까지(내 곡 · 음악회 · 선생님 화면 듣기)
  listenPlayer.start(b.events, { total: b.total, onEnd: () => { btn && btn.classList.remove('stop'); listenBtn = null; } });
  listenBtn = btn; btn && btn.classList.add('stop');
}

// ── 첫 화면 ──
function mountHome(root) {
  const mine = h('div', { class: 'list' }, h('div', { class: 'empty' }, '불러오는 중…'));
  const tsBadge = h('em', { class: 'ts-badge', style: { display: 'none' } });   // [MUSIC-TSONG-1] '선생님 곡 N' — 늦게 와도 · 못 읽어도 첫 화면은 그대로
  const concert = h('div', { class: 'list' }, h('div', { class: 'empty' }, '불러오는 중…'));
  const logLine = h('button', { class: 'btn small', onclick: () => ctx.go('#/log') }, '리코더 기록장');
  root.replaceChildren(
    ctx.topBar('음악실', { right: [logLine] }),
    h('div', { class: 'view' }, h('div', { class: 'home' },
      h('div', { class: 'doors' },
        h('button', { class: 'door d-compose', onclick: () => ctx.go('#/compose/new') },
          h('img', { src: '../assets/monsters/m22.png', alt: '' }), h('b', {}, '작곡하기'), h('span', {}, '칸을 눌러 가락을 짓고, 반주 친구와 함께 들어요')),
        h('button', { class: 'door d-practice', onclick: () => ctx.go('#/pick/practice') },
          h('img', { src: '../assets/monsters/m1.png', alt: '' }), h('b', {}, '리코더 연습'), h('span', {}, '음표 발판이 흘러가요. 운지를 보며 따라 불어요'), tsBadge),
        h('button', { class: 'door d-rhythm', onclick: () => ctx.go('#/pick/rhythm') },
          h('img', { src: '../assets/monsters/m28.png', alt: '' }), h('b', {}, '리듬 게임'), h('span', {}, '떨어지는 음표를 박에 맞춰 키보드로'),
          h('span', { class: 'keys' }, ...'ASDFJKL;'.split('').map(k => h('i', {}, k))))),
      h('div', { class: 'shelf' },
        h('section', {}, h('h2', {}, '내 곡', h('button', { class: 'btn small', onclick: () => ctx.go('#/compose/new') }, '+ 새 곡')), mine),
        h('section', {}, h('h2', {}, '우리 반 음악회'), concert)))));
  store.listMySongs().then(list => {
    mine.replaceChildren(...(list.length ? list.slice(0, 4).map(s => songRow(normalize(s), 'mine')) : [h('div', { class: 'empty' }, '아직 지은 곡이 없어요. "작곡하기"에서 첫 곡을 지어 보세요. 기본 곡을 바꿔 쓰는 것도 좋아요.')]));
    if (list.length > 4) mine.append(h('button', { class: 'btn small', onclick: () => ctx.go('#/pick/mine') }, `내 곡 모두 보기 (${list.length})`));
  }).catch(e => { console.warn(e); mine.replaceChildren(h('div', { class: 'empty' }, '내 곡을 불러오지 못했어요.')); });
  const stopWatch = store.watchConcert(all => {
    const list = all.filter(c => !badWords(c.t).length);   // [MUSIC-SAFE-1]
    concert.replaceChildren(...(list.length ? list.slice(0, 4).map(c => concertRow(c)) : [h('div', { class: 'empty' }, '아직 올라온 곡이 없어요. 곡을 저장할 때 "우리 반 음악회에 올리기"를 고르면 여기 떠요.')]));
    if (list.length > 4) concert.append(h('button', { class: 'btn small', onclick: () => ctx.go('#/pick/class') }, `모두 보기 (${list.length})`));
  });
  store.listPractice().then(p => { const n = p.reduce((a, x) => a + (x.n || 0), 0); if (n) logLine.textContent = `리코더 기록장 · ${n}번`; }).catch(() => {});
  teacherSongs().then(list => { if (list.length) { tsBadge.textContent = `선생님 곡 ${list.length}`; tsBadge.style.display = ''; } }).catch(() => {});
  return { unmount: () => { stopWatch && stopWatch(); listenPlayer.stop(); } };
}

const tagOf = s => `${meterOf(s).key} · ${s.bars}마디 · ${SCALES[s.scale]?.short || ''}`;
function dotOf(title, p = 67) { return h('span', { class: 'dot', style: { background: colorOf(p) } }, (title || '♪').slice(0, 1)); }
function songRow(s, kind) {
  const ref = ctx.refOf(s);
  const play = h('button', { class: 'play-i', title: '듣기', onclick: () => listen(s, play) });
  return h('div', { class: 'song-row' }, dotOf(s.title, s.notes[0]?.p), h('div', { class: 't' }, h('b', {}, s.title || '제목 없는 곡'), h('span', {}, tagOf(s) + (s.pub ? ' · 음악회에 올림' : ''))),
    h('div', { class: 'acts' }, play,
      kind === 'mine' ? h('button', { class: 'btn small', onclick: () => ctx.go('#/compose/' + ref) }, '고치기') : null,
      h('button', { class: 'btn small', onclick: () => ctx.go('#/rhythm/' + ref) }, '리듬'),
      h('button', { class: 'btn small', onclick: () => ctx.go('#/practice/' + ref) }, '연습')));
}
function concertRow(c) {
  const ref = `u.${c.sid}.${c.id}`;
  const play = h('button', { class: 'play-i', title: '듣기', onclick: async () => { const s = await ctx.resolve(ref); if (s) listen(s, play); else toast('곡을 찾지 못했어요'); } });
  return h('div', { class: 'song-row' }, dotOf(c.t), h('div', { class: 't' }, h('b', {}, c.t), h('span', {}, `${c.n || '친구'} · ${tagOf({ beats: c.beats, sub: c.sub, bars: c.bars, scale: c.scale })}`)),
    h('div', { class: 'acts' }, play,
      h('button', { class: 'btn small', onclick: () => ctx.go('#/rhythm/' + ref) }, '리듬'),
      h('button', { class: 'btn small', onclick: () => ctx.go('#/practice/' + ref) }, '연습')));
}

// ── 곡 고르기 ──  mode: practice | rhythm | mine | class
//  [MUSIC-TSONG-1] 연습 · 리듬이면 선생님 곡이 있을 때 맨 앞 칸 '선생님 곡'을 처음 칸으로(연습 · 리듬 게임 · 듣기만 — 고치기 · 바꿔 쓰기 없음).
//   선생님 곡을 2초 안에 못 읽으면 기본 곡부터 보이고, 늦게 오면 칸만 더한다(아이가 보던 칸은 안 바꿈)
function mountPick(root, mode) {
  const forPlay = mode === 'practice' || mode === 'rhythm';
  let tab = mode === 'mine' ? 'mine' : mode === 'class' ? 'class' : 'lib';
  let ts = [], drawn = false, alive = true, drawSeq = 0;
  const list = h('div', { class: 'list' }, h('div', { class: 'empty' }, '불러오는 중…'));
  const sysSel = h('select', { onchange: e => { ctx.setSys(e.target.value); draw(); } }, ...Object.entries(SYSTEMS).map(([k, v]) => { const o = h('option', { value: k }, v + ' 리코더'); if (k === ctx.sys()) o.selected = true; return o; }));
  const tabs = h('div', { class: 'tabs' });
  const title = mode === 'practice' ? '리코더 연습 — 곡 고르기' : mode === 'rhythm' ? '리듬 게임 — 곡 고르기' : mode === 'mine' ? '내 곡' : '우리 반 음악회';
  root.replaceChildren(ctx.topBar(title, { back: '#/', right: mode === 'practice' ? [sysSel] : [] }), h('div', { class: 'view' }, h('div', { class: 'pick' }, tabs, list)));
  async function draw() {
    drawn = true;
    const my = ++drawSeq;
    tabs.replaceChildren(...[...(forPlay && ts.length ? [['ts', '선생님 곡']] : []), ['lib', '기본 곡'], ['mine', '내 곡'], ['class', '우리 반 곡']].map(([k, t]) => h('button', { class: 'btn' + (tab === k ? ' on' : ''), onclick: () => { tab = k; draw(); } }, t)));
    list.replaceChildren(h('div', { class: 'empty' }, '불러오는 중…'));
    let songs = [];
    try {
      if (tab === 'ts') songs = ts.map(s => ({ s, ref: s.id }));
      else if (tab === 'lib') songs = LIB.map(s => ({ s, ref: s.id }));
      else if (tab === 'mine') songs = (await store.listMySongs()).map(r => normalize(r)).map(s => ({ s, ref: ctx.refOf(s) }));
      else songs = (await store.listConcert()).filter(c => !badWords(c.t).length).map(c => ({ c, ref: `u.${c.sid}.${c.id}` }));
    } catch (e) { console.warn(e); }
    if (my !== drawSeq) return;   // 그사이 다른 칸을 눌렀으면 그 칸이 그린다
    if (!songs.length) { list.replaceChildren(h('div', { class: 'empty' }, tab === 'mine' ? '아직 지은 곡이 없어요.' : tab === 'class' ? '아직 음악회에 올라온 곡이 없어요.' : tab === 'ts' ? '선생님 곡이 아직 없어요.' : '')); return; }
    list.replaceChildren(...songs.map(({ s, c, ref }) => {
      const name = s ? s.title : c.t;
      const sub = s ? (s.ts ? `${s.origin} · ${tagOf(s)}${s.memo ? ' · ' + s.memo : ''}` : (s.lib ? `${s.origin} · ` : '') + tagOf(s)) : `${c.n || '친구'} · ${tagOf({ beats: c.beats, sub: c.sub, bars: c.bars, scale: c.scale })}`;
      const lv = s && (s.lib || s.ts) ? h('span', { class: 'lv' }, s.practice ? '첫걸음' : '★'.repeat(s.level || 1)) : null;
      const okRec = !s || recorderOK(s, ctx.sys());
      const play = h('button', { class: 'play-i', title: '듣기', onclick: async () => { const x = s || await ctx.resolve(ref); if (x) listen(x, play); } });
      const acts = [play];
      if (mode !== 'rhythm') acts.push(h('button', { class: 'btn small' + (mode === 'practice' ? ' primary' : ''), disabled: !okRec, title: okRec ? '' : '이 리코더로 불 수 없는 음이 있어요', onclick: () => ctx.go('#/practice/' + ref) }, '연습'));
      if (mode !== 'practice') acts.push(h('button', { class: 'btn small' + (mode === 'rhythm' ? ' primary' : ''), onclick: () => ctx.go('#/rhythm/' + ref) }, '리듬 게임'));
      if (s && s.lib && !forPlay) acts.push(h('button', { class: 'btn small', onclick: () => ctx.go('#/compose/' + ref) }, '바꿔 쓰기'));
      if (s && !s.lib && !s.ts) acts.push(h('button', { class: 'btn small', onclick: () => ctx.go('#/compose/' + ref) }, '고치기'));
      if (s && s.lib && forPlay && mode === 'practice' && !okRec) acts.push(h('span', { class: 'muted', style: { fontSize: '.78rem' } }, '저먼식으로는 불 수 없는 음'));
      if (s && s.ts && mode === 'practice' && !okRec) acts.push(h('span', { class: 'muted', style: { fontSize: '.78rem' } }, `${SYSTEMS[ctx.sys()] || ''}으로는 불 수 없는 음`));
      return h('div', { class: 'song-row' }, dotOf(name, s?.notes[0]?.p), h('div', { class: 't' }, h('b', {}, name, lv), h('span', {}, sub)), h('div', { class: 'acts' }, ...acts));
    }));
  }
  if (!forPlay) draw();
  else {
    const late = setTimeout(() => { if (alive && !drawn) draw(); }, 2000);
    teacherSongs().then(got => { clearTimeout(late); if (!alive) return; ts = got; if (ts.length && !drawn) tab = 'ts'; draw(); });
  }
  return { unmount: () => { alive = false; listenPlayer.stop(); } };
}

// ── 리코더 기록장 ──
function mountLog(root) {
  const box = h('div', { class: 'pick' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('리코더 기록장', { back: '#/' }), h('div', { class: 'view' }, box));
  store.listPractice().then(items => {
    if (!items.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 연습 기록이 없어요. "리코더 연습"에서 한 곡을 끝까지 불면 여기에 쌓여요.')); return; }
    items.sort((a, z) => (z.last || 0) - (a.last || 0));
    const total = items.reduce((a, x) => a + (x.n || 0), 0);
    const days = new Set(items.flatMap(x => (x.log || []).map(l => new Date(l.t).toDateString()))).size;
    const day = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
    box.replaceChildren(
      h('div', { class: 'log-sum' }, h('div', {}, h('b', {}, total), h('span', {}, '번 불었어요')), h('div', {}, h('b', {}, items.length), h('span', {}, '곡')), h('div', {}, h('b', {}, days), h('span', {}, '일 연습'))),
      h('div', { class: 'list' }, ...items.map(x => {
        const last = (x.log || []).slice(-12);
        return h('div', { class: 'song-row log' }, dotOf(x.t || '곡'),
          h('div', { class: 't' }, h('b', {}, x.t || '곡'), h('span', {}, `${x.n}번 · 마지막 ${x.last ? day(x.last) : '-'}`)),
          h('div', { class: 'spark', title: '최근 연습(별 = 스스로 매긴 점수)' }, ...last.map(l => h('i', { style: { height: 8 + (l.st || 0) * 9 + 'px' }, title: `${day(l.t)} · ${'★'.repeat(l.st || 0)}${l.sp && l.sp < 1 ? ' · 느리게' : ''}` }))),
          h('span', { class: 'stars' }, '★'.repeat(x.stars || 0) + '☆'.repeat(3 - (x.stars || 0))));
      })));
  }).catch(e => { console.warn(e); box.replaceChildren(h('div', { class: 'empty' }, '기록을 불러오지 못했어요.')); });
  return { unmount() {} };
}

// ── 길 찾기 ──
let seq = 0, shownHash = location.hash;
async function route() {
  const my = ++seq;
  const hash = (location.hash || '#/').slice(1) || '/';
  // 작곡 중 저장 안 하고 (뒤로 가기 등으로) 나가려 하면 한 번 묻는다 — 남으면 주소만 되돌린다(화면은 그대로)
  if (current && current.isDirty && current.isDirty() && !confirm('저장하지 않은 곡이 있어요. 나갈까요?')) { history.replaceState(null, '', shownHash); return; }
  shownHash = location.hash;
  current && current.unmount && current.unmount();
  current = null;
  listenPlayer.stop();
  const parts = hash.split('/').filter(Boolean);
  document.body.dataset.view = parts[0] || 'home';
  try {
    if (A) { await routeAssign(my); return; }
    if (!parts.length) current = mountHome(app);
    else if (parts[0] === 'pick') current = mountPick(app, parts[1] || 'practice');
    else if (parts[0] === 'log') current = mountLog(app);
    else if (parts[0] === 't') current = await mountTeacher(app, ctx);
    else if (parts[0] === 'compose') {
      const ref = parts.slice(1).join('/');
      if (decodeURIComponent(ref).startsWith('ts_')) { toast('선생님 곡은 연습 · 리듬 게임으로 해요'); ctx.go('#/'); return; }   // [MUSIC-TSONG-1] 고치기 · 바꿔 쓰기 없음
      let song = ref && ref !== 'new' ? await ctx.resolve(decodeURIComponent(ref)) : emptySong();
      if (song && song.lib && song.rep > 1) song = libraryOnce(song.lk) || song;   // [MUSIC-LIB-REPEAT-1] 바꿔 쓰기는 되풀이 없이 한 번(작곡 칸 16마디)
      if (my !== seq) return;
      if (!song) { toast('곡을 찾지 못했어요'); ctx.go('#/'); return; }
      if (!song.lib && song.by && song.by !== store.me.sid) { toast('친구 곡은 고칠 수 없어요 — 리듬 게임 · 연습은 할 수 있어요'); ctx.go('#/'); return; }
      current = mountCompose(app, ctx, { song, ref });
    } else if (parts[0] === 'practice' || parts[0] === 'rhythm') {
      const ref = decodeURIComponent(parts.slice(1).join('/'));
      const song = await ctx.resolve(ref);
      if (my !== seq) return;
      if (!song) { toast('곡을 찾지 못했어요'); ctx.go('#/'); return; }
      current = (parts[0] === 'practice' ? mountPractice : mountRhythm)(app, ctx, { song, key: songKey(song) });
    } else current = mountHome(app);
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'empty', style: { margin: '40px auto', maxWidth: '480px' } }, '화면을 여는 중에 문제가 생겼어요. ', h('button', { class: 'btn small', onclick: () => location.reload() }, '다시 열기')));
  }
}
// ── 선생님 과제 [ASSIGN-MUSIC-1] ──
function asgScreen(icon, title, sub, btn) {
  app.replaceChildren(h('div', { class: 'asg-screen' }, h('div', { class: 'asg-screen-ic' }, icon), h('h2', {}, title), sub ? h('p', { class: 'muted' }, sub) : null, btn || null));
  return { unmount() {} };
}
async function routeAssign(my) {
  if (asg === null) {
    asgScreen('⏳', '선생님 과제를 불러오는 중이에요', '');
    const def = await loadAssign(store.db, A.aid);
    if (my !== seq) return;
    const set = rhythmSettings(def);
    asg = def && set ? { def, set, closed: !!def.closed, cell: null } : false;
    if (asg) {
      watchAssign(store.db, A.aid, d => { if (!d) asg.closed = true; else { asg.def = d; asg.closed = false; } });
      watchMine(store.db, A.aid, A.sid, c => { asg.cell = c; });
      if (!asg.closed) reportAssign(store.db, A.aid, A.sid, { start: true });
    }
  }
  if (asg === false) { current = asgScreen('📪', '과제를 불러오지 못했어요', '인터넷을 확인하고 다시 불러와요. 계속 안 되면 선생님께 알려 주세요.', h('button', { class: 'btn primary', onclick: () => location.reload() }, '다시 불러오기')); asg = null; return; }
  if (asg.closed && !A.live) { current = asgScreen('📪', '선생님이 이 과제를 닫았어요', '낸 기록은 그대로 남아요'); return; }
  const want = '#/rhythm/' + asg.set.song;
  if (location.hash !== want) { history.replaceState(null, '', want); shownHash = location.hash; }   // 다른 길(홈 · 작곡 …)은 과제 곡으로 되돌린다
  const song = await ctx.resolve(asg.set.song);
  if (my !== seq) return;
  if (!song) { current = asgScreen('🎵', '곡을 찾지 못했어요', '선생님께 알려 주세요'); return; }
  current = mountRhythm(app, ctx, { song, key: songKey(song), assign: { ...asg.set, live: A.live, line: () => myLine(asg.cell), send: sendAssign } });
}
//  한 판 끝 → 선생님께(RPG 안이면 부모 학생 화면이 쓴다 · 2초 안에 답이 없으면 직접) → 'ok' | 'closed' | 'fail'
async function sendAssign(res) {
  if (!asg || asg.closed) return 'closed';
  const patch = rhythmPatch(res);
  if (!patch) return 'fail';
  const ok = await reportAssign(store.db, A.aid, A.sid, patch);
  return ok ? 'ok' : asg.closed ? 'closed' : 'fail';
}
//  RPG 의 '선생님과 수업' 덮개가 이 창을 덮으면(밑에 깔린 음악실) — 치던 판 · 듣기를 멈추고 소리 장치를 쉬게 한다 · 걷히면 소리만 다시
onClassPause(on => {
  if (A && A.live) return;   // 덮개 안의 리듬(수업 그 자체)은 멈추지 않는다
  try {
    if (on) { current && current.pause && current.pause(); listenPlayer.stop(); engine.ctx && engine.ctx.suspend && engine.ctx.suspend(); }
    else if (engine.ctx && engine.ctx.resume) engine.ctx.resume();
  } catch (e) { console.warn('[ASSIGN-MUSIC-1] 멈춤', e); }
});

addEventListener('hashchange', route);
// 처음 한 번 누를 때 소리 장치를 깨운다(브라우저 규칙)
addEventListener('pointerdown', () => engine.ensure(), { once: true, capture: true });
addEventListener('keydown', () => engine.ensure(), { once: true, capture: true });
route();
