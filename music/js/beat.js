// 비트 만들기 — #/beat(새 비트) · #/beat/u.<sid>.<id>(저장한 비트 · 친구 비트는 듣기만) [MUSIC-BEAT-1]
//  사용자 10-10 '애들한테 장르를 가르치는 건 아니지만, 반복해서 비트 만드는 느낌을' — 장르 이름 없이:
//   ① 한 마디(16칸 · 한 박 = 네 칸)를 되풀이하며 칸을 눌러 북을 쌓고(꺼짐 → 보통 → 세게 · 끌어서 칠하기)
//   ② 베이스 · 화음을 겹치고(늘 어울리는 다섯 음 · 화음 카드 넷) ③ 패턴 A B C D 를 복사해 조금 바꿔 ④ 순서로 이어 붙인다(반복과 변화).
//  소리 = beatkit.js(공용 엔진의 소리 장치 위 · audio.js 는 안 고침) · 모양 · 셈 · 되풀이 박자기 = beatcore.js(node 시험)
//  저장 = classRPG_music/beats/<sid>/<id> · 우리 반 비트 모음 = beatclass/<sid>_<id>(제목이 고운 말일 때만) — store.js
//  ?debug=1 이면 window.__beat(읽기만 · 시험용)
//  [MUSIC-BEAT-MEL-1] 가락 줄(북 줄과 베이스 사이) — 가락 붓(도 ~ 높은 미 · 쉼 · 지우개)으로 칠하기 · 가락 악기 · 가락 주사위 · 메아리 ·
//   손으로 치기의 가락 건반(Z X C V B N M ,) 녹음. 붓 상자는 베이스 · 가락 · 화음 셋 가운데 하나만(1366×610 에 한 줄로) — 칸을 누른 줄을 따라 바뀐다.
import { h, toast, modal, lsGet, lsSet, READY_SEC, readyCount, clamp } from './util.js';
import { engine } from './audio.js';
import { colorOf } from './theory.js';
import { badWords, hidden } from './safety.js';
import * as C from './beatcore.js';
import { BeatKit, BeatMixer } from './beatkit.js';

const kit = new BeatKit(engine);        // 구운 소리는 화면을 나갔다 와도 그대로
const KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'], CAPS = ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';'];
const MKEYS = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma'], MCAPS = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ','];   // 가락 건반 [MUSIC-BEAT-MEL-1]
const BUDDIES = ['m23', 'm41', 'm27', 'm55', 'm29'];
const ROW_COLOR = { kick: '#e5484d', snare: '#f2a93b', clap: '#f2c230', hatc: '#4cc9b0', hato: '#59b7e8', tom: '#a77bdb', shaker: '#8fd07d', cymbal: '#7fa7e6', mel: '#7ee8fa', bass: '#ff8ab3', chord: '#ffc766' };
const PAL_TABS = [['bass', '베이스'], ['mel', '가락'], ['chord', '화음']];
const CHORD_COLOR = { I: '#f2a93b', IV: '#8fd07d', V: '#59b7e8', vi: '#b48be6' };
const PAT_COLOR = ['#f2a93b', '#4cc9b0', '#ff8ab3', '#b48be6'];
const L = C.LETTERS;
const DEBUG = /[?&]debug=1/.test(location.search);
const TABS = [['start', '시작 카드'], ['idea', '아이디어'], ['pad', '손으로 치기'], ['mine', '내 비트'], ['class', '우리 반']];
const day = t => (t ? `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}` : '-');

export function mountBeat(root, ctx, { ref = '' } = {}) {
  const store = ctx.store, me = store.me;
  let beat = C.emptyBeat(), readOnly = false, ownerName = '', dirty = false, alive = true, built = false;
  //  화면 상태(저장 안 함 · 이 기기 편의만)
  let tab = lsGet('music.beat.tab', 'start'); if (!TABS.some(([k]) => k === tab)) tab = 'start';
  let bassBrush = 0, chordBrush = 'I', ideaRow = 'kick', countPref = lsGet('music.beat.count', false) === true, tipIdx = 0, eucAt = 0, mixOpen = lsGet('music.beat.mix', false) === true;
  let buddyIdx = clamp(Number(lsGet('music.beat.buddy', 0)) | 0, 0, BUDDIES.length - 1);
  //  [MUSIC-BEAT-MEL-1] 가락 붓 · 붓 상자(베이스 · 가락 · 화음 가운데 보이는 것) · 녹음할 곳(북 패드 · 가락 건반)
  let melBrush = 0, palTab = lsGet('music.beat.pal', 'bass'), recTarget = 'drum';
  if (!PAL_TABS.some(([k]) => k === palTab)) palTab = 'bass';
  const undo = [];
  //  소리 · 재생
  let mixer = null, seq = null, timer = 0, raf = 0, playing = false, rec = false, counting = false, loopStart = 0, follow = true;
  let playPat = -1, playPos = -1, ph = -1, paint = null, warnedMute = 0, pv = null, mineList = [], classList = [], stopClass = null;
  const dance = { bounce: 0, wiggle: 0, flash: 0, pvMel: 0 };   // 시험용 셈(춤 친구 · 칸 반짝 · 들어 보기에서 울린 가락 음 수)
  const V = { live: [], bass: null, chord: null, openHat: null, mel: null, melPrev: null };
  const vq = [], stepLog = [], fired = [], skipOnce = new Set();
  const held = new Map();   // 누르고 있는 가락 건반: 음 번호 → { hd 소리, rec 녹음한 칸 }
  //  화면 조각
  let cells = {}, labDots = {}, bassCells = [], chordCells = [], melCells = [];
  const cur = () => beat.pats[beat.cur];
  const g = () => C.gridOf(beat.grid);
  const isSong = () => beat.mode === 'song' && beat.arr.length > 0;

  // ── 틀 ──
  const titleIn = h('input', { class: 'c-title bt-title', maxlength: 30, placeholder: '비트 이름', oninput: e => { beat.title = e.target.value.slice(0, 30); markDirty(false); } });
  const saveBtn = h('button', { class: 'btn small primary', onclick: () => saveDialog() }, '저장');
  const playBtn = h('button', { class: 'bt-play', title: '▶ 틀기 / ■ 멈추기 (스페이스)', onclick: () => (playing ? stop() : play()) });
  const recBtn = h('button', { class: 'bt-rec', title: '손으로 쳐서 넣기 (R)', onclick: () => toggleRec() }, '● 녹음');
  const bpmIn = h('input', { type: 'range', class: 'bt-range', min: C.BPM_MIN, max: C.BPM_MAX, step: 1, oninput: e => setBpm(+e.target.value) });
  const bpmVal = h('b', { class: 'bt-val' });
  const swIn = h('input', { type: 'range', class: 'bt-range sw', min: 0, max: C.SWING_MAX, step: 1, oninput: e => setSwing(+e.target.value) });
  const swVal = h('b', { class: 'bt-val' });
  const clickBtn = h('button', { class: 'bt-tog', title: '박마다 딸깍(메트로놈)', onclick: () => { beat.click = !beat.click; markDirty(false); renderTransport(); } }, '딸깍');
  const countBtn = h('button', { class: 'bt-tog', title: '▶ 을 누르면 3 · 2 · 1 다음 한 마디를 세고 시작', onclick: () => { countPref = !countPref; lsSet('music.beat.count', countPref); renderTransport(); } }, '3·2·1');
  const buddyImg = h('img', { alt: '', src: `../assets/monsters/${BUDDIES[buddyIdx]}.png` });
  const buddy = h('button', { class: 'bt-buddy', title: '춤 친구 — 눌러서 바꾸기', onclick: () => { buddyIdx = (buddyIdx + 1) % BUDDIES.length; lsSet('music.beat.buddy', buddyIdx); buddyImg.src = `../assets/monsters/${BUDDIES[buddyIdx]}.png`; bounce(); } }, buddyImg);
  const swingBox = h('label', { class: 'bt-knob', title: '둘째 칸마다 살짝 늦게 — 0% 는 곧게' }, h('span', { class: 'lbl' }, '통통 튀는 정도'), swIn, swVal);
  const trans = h('div', { class: 'bt-trans' }, playBtn, recBtn,
    h('div', { class: 'bt-knob' }, h('span', { class: 'lbl' }, '빠르기'), h('button', { class: 'bt-pm', onclick: () => setBpm(beat.bpm - 2) }, '−'), bpmIn, h('button', { class: 'bt-pm', onclick: () => setBpm(beat.bpm + 2) }, '+'), bpmVal),
    swingBox, clickBtn, countBtn, h('span', { class: 'sp' }), buddy);
  const patBtns = [0, 1, 2, 3].map(i => h('button', { class: 'bt-pat', style: { '--c': PAT_COLOR[i] }, title: `패턴 ${L[i]} (${i + 1})`, onclick: () => selectPattern(i) }, L[i]));
  const copyBtn = h('button', { class: 'btn small', onclick: () => copyDialog() }, '복사');
  const clearBtn = h('button', { class: 'btn small', onclick: () => clearDialog() }, '지우기');
  const undoBtn = h('button', { class: 'btn small', title: '되돌리기 (Ctrl+Z)', onclick: () => doUndo() }, '↶ 되돌리기');
  const arrBox = h('div', { class: 'bt-arr' });
  const arrBack = h('button', { class: 'btn small bt-arrdel', title: '순서 끝 칸 빼기', onclick: () => { if (readOnly || !beat.arr.length) return; pushUndo(); beat.arr.pop(); if (!beat.arr.length && beat.mode === 'song') beat.mode = 'loop'; markDirty(); renderPats(); } }, '⌫');
  const modeSeg = h('div', { class: 'seg bt-mode' });
  const pats = h('div', { class: 'bt-pats' }, h('span', { class: 'lbl' }, '패턴'), h('div', { class: 'bt-patbtns' }, ...patBtns), copyBtn, clearBtn, undoBtn,
    h('span', { class: 'sp' }), h('span', { class: 'lbl' }, '순서'), arrBox, arrBack, modeSeg);
  const grid = h('div', { class: 'bt-grid' });
  const countCv = h('canvas', { class: 'bt-count' });
  const gridBox = h('div', { class: 'bt-gridbox' }, grid, countCv);
  const pal = h('div', { class: 'bt-pal' });
  const tipText = h('span', { class: 'bt-tiptext' });
  const tip = h('div', { class: 'bt-tip' }, h('b', {}, '💡 왜 그럴까?'), tipText, h('button', { class: 'btn small', onclick: () => { tipIdx++; renderTip(); } }, '다음 ›'));
  const roNote = h('div', { class: 'bt-ro', style: { display: 'none' } });
  const main = h('div', { class: 'bt-main' }, roNote, trans, pats, gridBox, pal, tip);
  const tabsEl = h('div', { class: 'bt-tabs' });
  const tabBody = h('div', { class: 'bt-tabbody' });
  const side = h('aside', { class: 'bt-side' }, tabsEl, tabBody);
  const loading = h('div', { class: 'empty', style: { margin: '40px auto', maxWidth: '420px' } }, '비트를 불러오는 중…');
  root.replaceChildren(ctx.topBar('비트 만들기', { back: '#/' }), h('div', { class: 'view bt-view' }, loading));
  const g2 = countCv.getContext('2d');

  // ── 불러오기 ──
  async function load() {
    if (ref) {
      const m = /^u\.([^.]+)\.([^.]+)$/.exec(ref);
      let raw = null;
      if (m) { try { raw = await store.getBeat(m[1], m[2]); } catch (e) { console.warn('[MUSIC-BEAT-1] 비트를 못 읽음', e); } }
      if (!alive) return;
      if (!raw) { toast('비트를 찾지 못했어요'); setRef(''); }
      else {
        beat = C.normalizeBeat(raw);
        readOnly = !me.guest && m[1] !== me.sid;
        ownerName = beat.byName || '';
        if (readOnly && tab !== 'pad' && tab !== 'mine' && tab !== 'class') tab = 'class';
      }
    }
    build();
  }
  function build() {
    built = true;
    const right = readOnly ? [h('button', { class: 'btn small primary', onclick: () => ctx.go('#/beat') }, '내 비트 만들기')] : [titleIn, saveBtn];
    const title = readOnly ? `${ownerName || '친구'}의 비트${beat.title ? ' · ' + beat.title : ''}` : '비트 만들기';
    root.replaceChildren(ctx.topBar(title, { back: '#/', right }), h('div', { class: 'view bt-view' + (readOnly ? ' ro' : '') }, main, side));
    titleIn.value = beat.title || '';
    if (readOnly) { roNote.style.display = ''; roNote.textContent = '친구 비트는 들어 보기만 해요 — 패턴을 눌러 보고 ▶ 로 들어요. 내 비트는 \'내 비트 만들기\'에서!'; }
    kit.prepare(beat.kit).then(() => alive && renderGrid());
    renderAll();
    if (DEBUG) exposeDebug();
  }

  // ── 그리기 ──
  function renderAll() { renderTransport(); renderPats(); renderGrid(); renderPal(); renderTip(); renderSide(); }
  function renderTransport() {
    playBtn.textContent = playing ? '■' : '▶';
    playBtn.classList.toggle('on', playing);
    recBtn.classList.toggle('on', rec);
    recBtn.style.display = readOnly ? 'none' : '';
    recBtn.textContent = rec ? '● 녹음 중' : '● 녹음';
    bpmIn.value = beat.bpm; bpmVal.textContent = beat.bpm;
    swIn.value = beat.swing; swVal.textContent = beat.swing + '%';
    const swOK = C.swingable(g());
    swIn.disabled = !swOK; swingBox.classList.toggle('off', !swOK); swingBox.title = swOK ? '둘째 칸마다 살짝 늦게 — 0% 는 곧게' : '한 박이 세 칸이면 이미 통통 튀어요(스윙 없음)';
    clickBtn.classList.toggle('on', !!beat.click); countBtn.classList.toggle('on', countPref);
  }
  function renderPats() {
    patBtns.forEach((b, i) => {
      b.className = 'bt-pat' + (i === beat.cur ? ' on' : '') + (C.patternEmpty(beat.pats[i]) ? ' blank' : '') + (playing && playPat === i ? ' playing' : '') + (playing && !isSong() && i === beat.cur && playPat !== i ? ' next' : '');
      b.title = `패턴 ${L[i]} (${i + 1})` + (playing && !isSong() && i === beat.cur && playPat !== i ? ' — 다음 마디부터 들려요' : '');
    });
    for (const b of [copyBtn, clearBtn, undoBtn, arrBack]) b.style.display = readOnly ? 'none' : '';
    undoBtn.disabled = !undo.length;
    arrBox.replaceChildren(...Array.from({ length: 8 }, (_, k) => {
      const v = beat.arr[k];
      if (v != null) return h('button', { class: 'bt-slot' + (playing && isSong() && playPos === k ? ' playing' : ''), style: { '--c': PAT_COLOR[v] }, title: readOnly ? `${k + 1}번째 = 패턴 ${L[v]}` : '눌러서 다른 패턴으로 바꾸기',
        onclick: () => { if (readOnly) return; pushUndo(); beat.arr[k] = (v + 1) % 4; markDirty(); renderPats(); } }, L[v]);
      if (k === beat.arr.length && !readOnly) return h('button', { class: 'bt-slot add', title: `지금 패턴(${L[beat.cur]})을 순서 끝에 더하기`, onclick: () => { pushUndo(); beat.arr.push(beat.cur); markDirty(); renderPats(); } }, '+');
      return h('span', { class: 'bt-slot none' });
    }));
    modeSeg.replaceChildren(...[['loop', '지금 패턴만 반복'], ['song', '이어 붙인 순서대로']].map(([k, t]) => h('button', { class: beat.mode === k ? 'on' : '', onclick: () => setMode(k) }, t)));
  }
  function visibleRows() { return C.ROWS.filter(r => !C.EXTRA.includes(r) || beat.show[r] || beat.pats.some(p => p.d[r].some(Boolean))); }
  function cellClass(r, i, v) {
    const G = g(), b = Math.floor(i / G.sub);
    return 'bt-cell v' + v + ' b' + (b % 2) + (i % G.sub === 0 ? ' beat' : '') + (i && i % (G.beats * G.sub) === 0 ? ' bar' : '') + (ph === i ? ' ph' : '');
  }
  function renderGrid() {
    const G = g(), len = C.lenOf(G), p = cur(), rows = visibleRows(), sl = C.slotLen(G);
    grid.style.setProperty('--n', len);
    grid.classList.toggle('many', rows.length > 6);
    grid.classList.toggle('long', len > 16);
    grid.classList.toggle('mixopen', mixOpen);
    const kitSel = h('select', { class: 'bt-kit', title: '소리 묶음 — 바꾸면 줄 이름도 바뀌어요', onchange: e => setKit(e.target.value) },
      ...C.KIT_KEYS.map(k => { const o = h('option', { value: k }, `${C.KITS[k].em} ${C.KITS[k].name}`); if (k === beat.kit) o.selected = true; return o; }));
    const kids = [h('div', { class: 'bt-corner' }, kitSel)];
    for (let bt = 0; bt < C.beatsOf(G); bt++) kids.push(h('div', { class: 'bt-num' + (bt && bt % G.beats === 0 ? ' bar' : ''), style: { gridColumn: `span ${G.sub}` } }, h('b', {}, String((bt % G.beats) + 1)), h('i', {}, '박')));
    cells = {}; labDots = {};
    for (const r of rows) {
      kids.push(rowLabel(r));
      cells[r] = [];
      for (let i = 0; i < len; i++) {
        const c = h('button', { class: cellClass(r, i, p.d[r][i]), style: { '--c': ROW_COLOR[r] }, 'data-k': 'd', 'data-r': r, 'data-i': i, 'aria-label': `${C.rowName(beat.kit, r)} ${i + 1}칸` });
        cells[r].push(c); kids.push(c);
      }
    }
    //  줄 더 보기(쉐이커 · 심벌) · 소리 크기 막대 펴기(믹서 — 이름 칸이 넓어진다)
    const more = readOnly ? [] : C.EXTRA.map(r => {
      const used = beat.pats.some(q => q.d[r].some(Boolean)), shown = beat.show[r] || used;
      return h('button', { class: 'bt-morebtn' + (shown ? ' on' : ''), disabled: used, title: used ? '칸이 들어 있어서 숨길 수 없어요' : '',
        onclick: () => { beat.show[r] = !beat.show[r]; markDirty(false); renderGrid(); renderSide(); } }, (shown ? '− ' : '+ ') + C.rowName(beat.kit, r) + ' 줄');
    });
    more.push(h('button', { class: 'bt-morebtn mix' + (mixOpen ? ' on' : ''), title: '줄마다 소리 크기 막대', onclick: () => { mixOpen = !mixOpen; lsSet('music.beat.mix', mixOpen); renderGrid(); } }, mixOpen ? '🎚 소리 크기 접기' : '🎚 소리 크기'));
    kids.push(h('div', { class: 'bt-more' }, ...more));
    //  가락 줄 [MUSIC-BEAT-MEL-1] — 북 줄과 베이스 사이(음 칩 높이 = 음 높이 · 이어지는 칸 꼬리 · 쉼)
    kids.push(rowLabel('mel'));
    melCells = [];
    for (let i = 0; i < len; i++) { const c = h('button', { class: 'bt-mcell', 'data-k': 'm', 'data-i': i, 'aria-label': `가락 ${i + 1}칸` }); melCells.push(c); kids.push(c); }
    kids.push(rowLabel('bass'));
    bassCells = [];
    for (let i = 0; i < len; i++) { const c = h('button', { class: 'bt-bcell', 'data-k': 'b', 'data-i': i }); bassCells.push(c); kids.push(c); }
    kids.push(rowLabel('chord'));
    chordCells = [];
    for (let k = 0; k < C.slotsOf(G); k++) { const c = h('button', { class: 'bt-cslot', 'data-k': 'c', 'data-i': k, style: { gridColumn: `span ${sl}` } }); chordCells.push(c); kids.push(c); }
    grid.replaceChildren(...kids);
    renderMel(); renderBass(); renderChords();
    if (ph >= 0) { const i = ph; ph = -1; setPlayhead(i); }
  }
  function rowLabel(r) {
    const m = beat.mix[r];
    const dot = h('i', { class: 'bt-dot', style: { background: ROW_COLOR[r] } });
    labDots[r] = dot;
    return h('div', { class: 'bt-lab' + (m.m ? ' muted' : ''), 'data-r': r, title: C.rowWhat(beat.kit, r) },
      dot, h('b', {}, C.rowName(beat.kit, r)),
      h('button', { class: 'bt-m' + (m.m ? ' on' : ''), title: '음소거', onclick: () => { m.m = !m.m; mixChanged(); } }, 'M'),
      h('button', { class: 'bt-s' + (m.s ? ' on' : ''), title: '혼자 듣기', onclick: () => { m.s = !m.s; mixChanged(); } }, 'S'),
      h('input', { type: 'range', class: 'bt-vol', min: 0, max: 1, step: 0.05, value: m.v, title: '소리 크기', oninput: e => { m.v = +e.target.value; mixer && mixer.apply(beat.mix, beat.kit); markDirty(false); } }));
  }
  function mixChanged() { mixer && mixer.apply(beat.mix, beat.kit); markDirty(false); renderGrid(); }
  function updateCell(r, i) { const c = cells[r] && cells[r][i]; if (c) c.className = cellClass(r, i, cur().d[r][i]); }
  //  가락 줄 [MUSIC-BEAT-MEL-1] — 베이스 줄과 같은 그림(음 여덟 높이 · 높은 음은 위 점 · 이어지는 칸 꼬리 · 쉼)
  function renderMel() {
    const p = cur(), G = g(), len = C.lenOf(G);
    let ring = -1;
    for (let i = 0; i < len; i++) {
      const v = p.m[i], c = melCells[i]; if (!c) continue;
      c.className = 'bt-mcell b' + (Math.floor(i / G.sub) % 2) + (i % G.sub === 0 ? ' beat' : '') + (i && i % (G.beats * G.sub) === 0 ? ' bar' : '') + (ph === i ? ' ph' : '');
      if (v >= 0 && v <= C.M_TOP) {
        ring = v;
        c.replaceChildren(h('span', { class: 'chip', style: { '--y': (C.M_TOP - v) / C.M_TOP, background: colorOf(C.MEL[v].p) } }, C.melShort(v)));
      } else if (v === C.B_REST) { ring = -1; c.replaceChildren(h('span', { class: 'rest' }, '쉼')); }
      else if (ring >= 0) c.replaceChildren(h('span', { class: 'tail', style: { '--y': (C.M_TOP - ring) / C.M_TOP, background: colorOf(C.MEL[ring].p) } }));
      else c.replaceChildren();
    }
  }
  //  베이스 줄 — 음 칩(높이에 따라 위아래) · 이어지는 칸은 가는 꼬리 · 쉼
  function renderBass() {
    const p = cur(), len = C.lenOf(g());
    let ring = -1;
    for (let i = 0; i < len; i++) {
      const v = p.b[i], c = bassCells[i]; if (!c) continue;
      const G = g();
      c.className = 'bt-bcell b' + (Math.floor(i / G.sub) % 2) + (i % G.sub === 0 ? ' beat' : '') + (i && i % (G.beats * G.sub) === 0 ? ' bar' : '') + (ph === i ? ' ph' : '');
      if (v >= 0 && v <= 5) {
        ring = v;
        c.replaceChildren(h('span', { class: 'chip', style: { '--y': (5 - v) / 5, background: colorOf(C.BASS[v].p + 24) } }, v === 5 ? '도˙' : C.BASS[v].n));
      } else if (v === C.B_REST) { ring = -1; c.replaceChildren(h('span', { class: 'rest' }, '쉼')); }
      else if (ring >= 0) c.replaceChildren(h('span', { class: 'tail', style: { '--y': (5 - ring) / 5, background: colorOf(C.BASS[ring].p + 24) } }));
      else c.replaceChildren();
    }
  }
  function renderChords() {
    const p = cur(), G = g(), sl = C.slotLen(G);
    chordCells.forEach((c, k) => {
      const ch = p.c[k];
      c.className = 'bt-cslot' + (ch ? '' : ' blank') + (ph >= 0 && Math.floor(ph / sl) === k ? ' ph' : '');
      c.style.setProperty('--c', ch ? CHORD_COLOR[ch] : '#5a4a3a');
      //  치는 자리 점(길게 = 하나 · 쿵짝 · 짧게 톡톡 = 박마다)
      const marks = []; for (let j = 0; j < sl; j++) marks.push(h('i', { class: C.chordAt(p, G, k * sl + j) ? 'on' : '' }));
      if (!ch) {
        //  [MUSIC-BEAT-1] 빈 칸 — 앞 화음이 이어지면 흐리게 '도 이어서'(누르면 새 화음을 놓을 수 있음) · 앞에도 없으면 '+ 화음'
        const k0 = C.chordOwner(p, k);
        if (k0 < 0) { c.replaceChildren(h('span', { class: 'add' }, readOnly ? '' : '+ 화음')); return; }
        c.classList.add('cont'); c.style.setProperty('--c', CHORD_COLOR[p.c[k0]]);
        c.replaceChildren(h('b', {}, '⟵ ' + C.CHORDS[p.c[k0]].name), h('small', {}, '이어서'), h('span', { class: 'marks', style: { '--m': sl } }, ...marks));
        return;
      }
      c.replaceChildren(h('b', {}, C.CHORDS[ch].name), h('small', {}, ch === 'vi' ? '화음 · 단조' : '화음'), h('span', { class: 'marks', style: { '--m': sl } }, ...marks));
    });
  }
  //  붓 상자 [MUSIC-BEAT-MEL-1] — 베이스 · 가락 · 화음 셋 가운데 하나만 보인다(한 줄에 다 넣으면 1366×610 에서 넘침) · 칸을 누른 줄을 따라 바뀐다
  function setPalTab(k) { if (palTab === k || !PAL_TABS.some(([x]) => x === k)) return; palTab = k; lsSet('music.beat.pal', k); renderPal(); }
  function renderPal() {
    if (readOnly) { pal.style.display = 'none'; return; }
    pal.style.display = '';
    const brushBtn = (on, v, t, col, pick) => h('button', { class: 'bt-brush' + (on ? ' on' : '') + (v === 'erase' ? ' er' : ''), style: col ? { '--c': col } : {}, onclick: pick }, t);
    const seg = h('div', { class: 'seg bt-palseg', title: '어느 줄을 칠할 붓인지 골라요' }, ...PAL_TABS.map(([k, t]) => h('button', { class: palTab === k ? 'on' : '', 'data-pal': k, onclick: () => setPalTab(k) }, t)));
    let groups;
    if (palTab === 'mel') {
      const mb = [...C.MEL.map((x, i) => [i, x.n, colorOf(x.p)]), [C.B_REST, '쉼', '#6b5a48'], ['erase', '지우개', '']];
      const leadSel = h('select', { class: 'bt-lead', title: '가락 악기 — 비트마다 하나', onchange: e => setLead(e.target.value) },
        ...C.LEAD_KEYS.map(k => { const o = h('option', { value: k }, `${C.LEADS[k].em} ${C.LEADS[k].name}`); if (k === beat.lead) o.selected = true; return o; }));
      groups = [h('div', { class: 'bt-palg' }, h('span', { class: 'lbl', title: '고른 음을 가락 칸에 칠해요(같은 음을 다시 누르면 지워요)' }, '가락 붓'),
        ...mb.map(([v, t, col]) => brushBtn(melBrush === v, v, t, col, () => { melBrush = v; renderPal(); if (typeof v === 'number' && v <= C.M_TOP) previewMel(v); }))),
        h('label', { class: 'bt-palg' }, h('span', { class: 'lbl' }, '가락 악기'), leadSel)];
    } else if (palTab === 'chord') {
      const cb = [...C.CHORD_KEYS.map(k => [k, C.CHORDS[k].name + (k === 'vi' ? '(단조)' : ''), CHORD_COLOR[k]]), ['erase', '지우개', '']];
      groups = [h('div', { class: 'bt-palg' }, h('span', { class: 'lbl', title: '고른 화음 카드를 화음 칸에 넣어요' }, '화음 카드'),
        ...cb.map(([v, t, col]) => brushBtn(chordBrush === v, v, t, col, () => { chordBrush = v; renderPal(); if (v !== 'erase') previewChord(v); }))),
        h('div', { class: 'bt-palg' }, h('span', { class: 'lbl' }, '화음 치는 법'),
          h('div', { class: 'seg' }, ...C.STYLE_KEYS.map(k => h('button', { class: cur().cs === k ? 'on' : '', onclick: () => { if (cur().cs === k) return; pushUndo(); cur().cs = k; markDirty(); renderChords(); renderPal(); } }, C.STYLES[k]))))];
    } else {
      const bb = [...C.BASS.map((x, i) => [i, i === 5 ? '높은 도' : x.n, colorOf(x.p + 24)]), [C.B_REST, '쉼', '#6b5a48'], ['erase', '지우개', '']];
      groups = [h('div', { class: 'bt-palg' }, h('span', { class: 'lbl', title: '고른 음을 베이스 칸에 칠해요(같은 음을 다시 누르면 지워요)' }, '베이스 붓'),
        ...bb.map(([v, t, col]) => brushBtn(bassBrush === v, v, t, col, () => { bassBrush = v; renderPal(); if (typeof v === 'number' && v <= 5) previewBass(v); })))];
    }
    pal.replaceChildren(seg, ...groups);
  }
  function renderTip() { const list = C.tipsFor(beat); tipText.textContent = C.TIPS[list[tipIdx % list.length]] || ''; }
  let tipTimer = 0, sideTimer = 0;
  function markDirty(content = true) {
    if (readOnly) return;
    dirty = true;
    if (!content) return;
    renderPats(); clearTimeout(tipTimer); tipTimer = setTimeout(() => { tipIdx = 0; renderTip(); }, 350);
    //  아이디어 칸의 '몇 번'(고르게 나누기)도 칸을 고친 뒤 맞게
    if (tab === 'idea') { clearTimeout(sideTimer); sideTimer = setTimeout(() => { if (alive && tab === 'idea' && !document.querySelector('.modal-wrap')) renderSide(); }, 300); }
  }

  // ── 옆 칸 ──
  function renderSide() {
    const tabs = readOnly ? TABS.filter(([k]) => ['pad', 'mine', 'class'].includes(k)) : TABS;
    if (!tabs.some(([k]) => k === tab)) tab = tabs[tabs.length - 1][0];
    tabsEl.replaceChildren(...tabs.map(([k, t]) => h('button', { class: 'bt-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; lsSet('music.beat.tab', k); renderSide(); } }, t)));
    if (tab !== 'class' && stopClass) { stopClass(); stopClass = null; }
    tabBody.replaceChildren(...({ start: sideStart, idea: sideIdea, pad: sidePad, mine: sideMine, class: sideClass }[tab] || sideStart)());
  }
  function sideStart() {
    return [h('p', { class: 'bt-help' }, '카드를 누르면 지금 패턴(', h('b', {}, L[beat.cur]), ')에 북 · 가락 · 베이스 · 화음이 들어가요. 그다음 칸을 바꿔 내 비트로!'),
      h('div', { class: 'bt-cards' }, ...C.STARTERS.map(st => h('button', { class: 'bt-card', onclick: () => useStarter(st.id) },
        h('span', { class: 'em' }, st.em), h('b', {}, st.name), h('small', {}, st.desc),
        h('i', {}, `${C.KITS[st.kit].name}${st.m ? ` · ${C.LEADS[C.leadOf(st.lead)].name} 가락` : ''} · 빠르기 ${st.bpm}${st.swing ? ` · 통통 ${st.swing}%` : ''}${st.grid !== '16' ? ` · ${C.GRIDS[st.grid].name}` : ''}`))))];
  }
  function sideIdea() {
    const G = g(), len = C.lenOf(G), rows = visibleRows();
    if (!rows.includes(ideaRow)) ideaRow = 'kick';
    const n = cur().d[ideaRow].filter(Boolean).length, dsc = C.describeEuclid(n, len);
    return [
      h('h4', {}, '🎲 주사위'),
      h('button', { class: 'btn primary bt-wide', onclick: () => rollDice() }, '🎲 북 새로 만들기'),
      h('p', { class: 'bt-help' }, '아무렇게나가 아니라 규칙 안에서: 첫 박 쿵 · 2·4박 짝 · 칙은 고르게. 마음에 안 들면 ↶ 되돌리기.'),
      //  [MUSIC-BEAT-MEL-1] 가락 주사위 · 메아리
      h('h4', {}, '🎵 가락 만들기'),
      h('button', { class: 'btn bt-wide bt-meldice', onclick: () => rollMel() }, '🎲 가락 주사위'),
      h('p', { class: 'bt-help' }, '짧은 가락을 두 번 반복하고 끝만 살짝 바꾸면 귀에 쏙 들어와요. 첫 음은 그 박 화음의 음에서 시작해요.'),
      h('div', { class: 'bt-rot' }, h('button', { class: 'btn small', 'data-echo': '1', onclick: () => echo(1) }, '메아리 ⤴ 한 칸 위로'), h('button', { class: 'btn small', 'data-echo': '-1', onclick: () => echo(-1) }, '메아리 ⤵ 한 칸 아래로')),
      h('p', { class: 'bt-help' }, '메아리 = 앞 절반 가락을 뒤 절반에서 한 칸 높게(낮게) 따라 불러요 — 묻고 대답하는 느낌.'),
      h('h4', {}, '➗ 고르게 나누기'),
      h('div', { class: 'bt-chips' }, ...rows.map(r => h('button', { class: 'bt-chip' + (ideaRow === r ? ' on' : ''), style: { '--c': ROW_COLOR[r] }, onclick: () => { ideaRow = r; renderSide(); } }, C.rowName(beat.kit, r)))),
      h('div', { class: 'bt-euc' }, h('button', { class: 'btn small', onclick: () => setEuclid(n - 1) }, '−'), h('b', {}, `${n}번`), h('button', { class: 'btn small', onclick: () => setEuclid(n + 1) }, '+')),
      h('p', { class: 'bt-div' }, dsc.text),
      h('div', { class: 'bt-rot' }, h('button', { class: 'btn small', onclick: () => rotateRow(-1) }, '◀ 한 칸 앞으로'), h('button', { class: 'btn small', onclick: () => rotateRow(1) }, '한 칸 뒤로 ▶')),
      h('p', { class: 'bt-help' }, '한 칸 뒤로 = 엇박으로 밀기. 박 사이로 가면 통통 튀어요.'),
      h('h4', {}, '🔁 반복과 변화'),
      h('button', { class: 'btn bt-wide', onclick: () => makeAAAB() }, `${L[beat.cur]} ${L[beat.cur]} ${L[beat.cur]} ${L[(beat.cur + 1) % 4]} 순서 만들기`),
      h('label', { class: 'bt-check' }, (() => { const c = h('input', { type: 'checkbox', onchange: e => { beat.fill = e.target.checked; markDirty(); } }); c.checked = !!beat.fill; return c; })(),
        h('span', {}, h('b', {}, '4번째 반복마다 살짝 바꾸기'), h('small', {}, '네 번째 마디 끝 한 박에 통 · 짝 굴리기(필인) — 다음 마디 첫 박에 심벌'))),
      h('h4', {}, '🔲 칸 수'),
      h('div', { class: 'bt-chips' }, ...C.GRID_KEYS.map(k => h('button', { class: 'bt-chip' + (beat.grid === k ? ' on' : ''), title: C.GRIDS[k].hint, onclick: () => changeGrid(k) }, C.GRIDS[k].name))),
      h('p', { class: 'bt-help' }, C.GRIDS[beat.grid].hint),
    ];
  }
  function sidePad() {
    //  가락 건반 [MUSIC-BEAT-MEL-1] — 누르는 동안 울리고(신스 · 피아노 · 플루트 · 대금) 떼면 멈춘다 · 녹음할 곳이 '가락'이면 가장 가까운 칸에 들어감
    const melKey = (n) => h('button', { class: 'bt-mkey', 'data-n': n, style: { '--c': colorOf(C.MEL[n].p) },
      onpointerdown: e => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} melHit(n); },
      onpointerup: () => melRelease(n), onpointercancel: () => melRelease(n), onlostpointercapture: () => melRelease(n) },
      h('kbd', {}, MCAPS[n]), h('b', {}, C.melShort(n)));
    return [
      h('div', { class: 'bt-pads' }, ...C.ROWS.map((r, k) => h('button', { class: 'bt-pad', 'data-r': r, style: { '--c': ROW_COLOR[r] }, onpointerdown: e => { e.preventDefault(); padHit(r); } },
        h('kbd', {}, CAPS[k]), h('b', {}, C.rowName(beat.kit, r))))),
      h('h4', {}, `🎵 가락 건반 · ${C.LEADS[C.leadOf(beat.lead)].name}`),
      h('div', { class: 'bt-mkeys' }, ...C.MEL.map((_, n) => melKey(n))),
      readOnly ? null : h('div', { class: 'bt-rectg' }, h('span', { class: 'lbl' }, '녹음할 곳'),
        h('div', { class: 'seg' }, ...[['drum', '🥁 북 패드'], ['mel', '🎵 가락 건반']].map(([k, t]) => h('button', { class: recTarget === k ? 'on' : '', 'data-rt': k, onclick: () => { recTarget = k; renderSide(); } }, t)))),
      readOnly ? null : h('button', { class: 'btn bt-wide bt-rec2' + (rec ? ' on' : ''), onclick: () => toggleRec() }, rec ? '■ 녹음 그만' : `● 녹음 시작 (${recTarget === 'mel' ? '가락' : '북'})`),
      h('p', { class: 'bt-help' }, readOnly ? '패드 · 건반을 눌러 친구 비트에 맞춰 같이 쳐 봐요(넣지는 않아요).'
        : '녹음을 켜면 3 · 2 · 1 다음 한 마디를 세고 시작해요. 친 소리는 가장 가까운 칸에 들어가요 — 반복하니까 여러 바퀴 겹쳐 쳐도 돼요. 가락은 길게 누르면 길게, 짧게 누르면 짧게 들어가요.'),
      h('p', { class: 'bt-help' }, '글쇠: A S D F J K L ; = 북 패드 · Z X C V B N M , = 가락 건반 · ', readOnly ? '' : 'R = 녹음 · ', '스페이스 = ▶ / ■'),
      readOnly ? null : h('p', { class: 'bt-help' }, '↶ 되돌리기 = 방금 녹음한 한 바퀴를 한 번에 지우기'),
    ];
  }
  function sideMine() {
    const list = h('div', { class: 'list bt-list' }, h('div', { class: 'empty' }, '불러오는 중…'));
    store.listMyBeats().then(items => {
      mineList = items.map(x => C.normalizeBeat(x));
      if (!mineList.length) { list.replaceChildren(h('div', { class: 'empty' }, '아직 저장한 비트가 없어요. 위 \'저장\'을 누르면 여기에 쌓여요.')); return; }
      list.replaceChildren(...mineList.map(b => beatRow(b, { ref: `u.${me.sid}.${b.id}`, mine: true })));
    }).catch(e => { console.warn(e); list.replaceChildren(h('div', { class: 'empty' }, '내 비트를 불러오지 못했어요.')); });
    return [readOnly ? null : h('div', { class: 'bt-mineacts' }, h('button', { class: 'btn small', onclick: () => newBeat() }, '+ 새 비트'), h('button', { class: 'btn small primary', onclick: () => saveDialog() }, '저장')),
      me.guest ? h('p', { class: 'bt-help' }, '손님 — 이 기기에만 저장돼요.') : null, list];
  }
  function sideClass() {
    const list = h('div', { class: 'list bt-list' }, h('div', { class: 'empty' }, '불러오는 중…'));
    if (stopClass) stopClass();
    stopClass = store.watchBeatClass(all => {
      classList = all.filter(c => !badWords(c.t).length);
      if (!classList.length) { list.replaceChildren(h('div', { class: 'empty' }, '아직 올라온 비트가 없어요. 저장할 때 \'우리 반 비트 모음에 올리기\'를 고르면 여기 떠요.')); return; }
      list.replaceChildren(...classList.map(c => beatRow(null, { row: c, ref: `u.${c.sid}.${c.id}`, mine: c.sid === me.sid })));
    });
    return [h('p', { class: 'bt-help' }, '친구들이 올린 비트예요. ▶ 로 듣고, \'열어 보기\'로 칸을 볼 수 있어요(고칠 수는 없어요).'), list];
  }
  function beatRow(b, { ref, mine, row = null }) {
    const t = row ? row.t : b.title || '이름 없는 비트';
    const sub = row ? `${row.n || '친구'}${mine ? ' (나)' : ''} · 빠르기 ${row.bpm || '-'} · ${C.kitOf(row.kit).name}`
      : `빠르기 ${b.bpm} · 패턴 ${C.usedCount(b)}개 · ${C.KITS[b.kit].name} · ${day(b.updated)}${b.pub ? ' · 모음에 올림' : ''}`;
    const play = h('button', { class: 'play-i', title: '듣기', onclick: () => preview(row ? ref : b, play) });
    const acts = [play];
    if (mine && !row) acts.push(h('button', { class: 'btn small', onclick: () => openRef(ref) }, '열기'), h('button', { class: 'btn small', onclick: () => deleteDialog(b) }, '지우기'));
    else acts.push(h('button', { class: 'btn small', onclick: () => openRef(ref) }, mine ? '열기' : '열어 보기'));
    const open = beat.id && ref === `u.${beat.by || me.sid}.${beat.id}`;
    return h('div', { class: 'song-row bt-row' + (open ? ' open' : '') }, h('span', { class: 'dot', style: { background: PAT_COLOR[(t.charCodeAt(0) || 0) % 4] } }, t.slice(0, 1)),
      h('div', { class: 't' }, h('b', {}, t), h('span', {}, sub)), h('div', { class: 'acts' }, ...acts));
  }
  function openRef(r) { stopPreview(); ctx.go('#/beat/' + r); }
  //  주소만 바꾼다(화면은 그대로) — 저장한 뒤 · 새 비트
  function setRef(r) { if (ctx.replaceBeatRef) ctx.replaceBeatRef(r); else history.replaceState(null, '', '#/beat' + (r ? '/' + r : '')); }

  // ── 고치기 ──
  function snapshot() { const p = C.packBeat(beat); return JSON.stringify({ grid: p.grid, pats: p.pats, arr: p.arr, bpm: p.bpm, swing: p.swing, kit: p.kit, lead: p.lead, show: p.show, fill: p.fill, mode: p.mode }); }
  function pushUndo() { if (readOnly) return; undo.push(snapshot()); if (undo.length > 40) undo.shift(); undoBtn.disabled = false; }
  function doUndo() {
    if (readOnly || !undo.length) { if (!readOnly) toast('되돌릴 것이 없어요'); return; }
    const s = JSON.parse(undo.pop());
    const nb = C.normalizeBeat({ ...C.packBeat(beat), ...s });
    nb.cur = beat.cur;
    beat = nb; kit.prepare(beat.kit); mixer && mixer.apply(beat.mix, beat.kit);
    dirty = true; renderAll();
  }
  function setBeat(nb) { beat = nb; kit.prepare(beat.kit).then(() => alive && renderGrid()); mixer && mixer.apply(beat.mix, beat.kit); markDirty(); renderAll(); }
  function setDrum(r, i, v) { cur().d[r][i] = v; updateCell(r, i); markDirty(); }
  function setBass(i, v) { cur().b[i] = v; renderBass(); markDirty(); }
  function setMel(i, v) { cur().m[i] = v; renderMel(); markDirty(); }   // [MUSIC-BEAT-MEL-1]
  function setChord(k, v) { cur().c[k] = v; renderChords(); markDirty(); }
  function roToast() { toast('친구 비트는 들어 보기만 해요 — \'내 비트 만들기\'에서 만들어요'); }
  function cellValue(el) {
    const k = el.dataset.k, i = +el.dataset.i, p = cur();
    if (k === 'd') { const v = p.d[el.dataset.r][i]; return v === 0 ? 1 : v === 1 ? 2 : 0; }
    if (k === 'b') return bassBrush === 'erase' || p.b[i] === bassBrush ? C.B_EMPTY : bassBrush;
    if (k === 'm') return melBrush === 'erase' || p.m[i] === melBrush ? C.B_EMPTY : melBrush;
    return chordBrush === 'erase' || p.c[i] === chordBrush ? null : chordBrush;
  }
  function applyCell(el, v) {
    const k = el.dataset.k, i = +el.dataset.i;
    if (k === 'd') { setDrum(el.dataset.r, i, v); if (v && !playing) previewDrum(el.dataset.r, v); }
    else if (k === 'b') { setBass(i, v); if (v >= 0 && v <= 5 && !playing) previewBass(v); }
    else if (k === 'm') { setMel(i, v); if (v >= 0 && v <= C.M_TOP && !playing) previewMel(v); }
    else { setChord(i, v); if (v && !playing) previewChord(v); }
  }
  const PAL_OF = { b: 'bass', m: 'mel', c: 'chord' };            // 칸을 누른 줄의 붓 상자를 보여 준다
  grid.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    e.preventDefault();
    if (readOnly) { roToast(); return; }
    ensureAudio();
    pushUndo();
    const v = cellValue(el);
    applyCell(el, v);
    if (PAL_OF[el.dataset.k]) setPalTab(PAL_OF[el.dataset.k]);
    paint = { k: el.dataset.k, r: el.dataset.r, v, last: el };
    try { grid.setPointerCapture(e.pointerId); } catch (err) {}
  });
  grid.addEventListener('pointermove', e => {
    if (!paint) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY), el = hit && hit.closest ? hit.closest('[data-k]') : null;
    if (!el || el === paint.last || el.dataset.k !== paint.k || (paint.k === 'd' && el.dataset.r !== paint.r)) return;
    paint.last = el;
    const i = +el.dataset.i;
    if (paint.k === 'd') setDrum(paint.r, i, paint.v); else if (paint.k === 'b') setBass(i, paint.v); else if (paint.k === 'm') setMel(i, paint.v); else setChord(i, paint.v);
  });
  const endPaint = () => { paint = null; };
  grid.addEventListener('pointerup', endPaint); grid.addEventListener('pointercancel', endPaint);
  //  글쇠로 칸에 와서 Enter(눌러진 click · detail 0)도 같은 바꾸기
  grid.addEventListener('click', e => {
    if (e.detail !== 0) return;
    const el = e.target.closest('[data-k]'); if (!el) return;
    if (readOnly) { roToast(); return; }
    pushUndo(); applyCell(el, cellValue(el));
    if (PAL_OF[el.dataset.k]) setPalTab(PAL_OF[el.dataset.k]);
  });
  function selectPattern(i) {
    if (i === beat.cur) return;
    beat.cur = i;
    if (playing && isSong()) follow = false;
    renderGrid(); renderPats(); renderPal(); renderTip();
    if (tab === 'start' || tab === 'idea') renderSide();
  }
  function setMode(k) {
    if (k === 'song' && !beat.arr.length) { toast('순서 칸의 + 를 눌러 패턴을 먼저 이어 붙여요'); return; }
    beat.mode = k; follow = true; markDirty(false); renderPats();
  }
  function setBpm(v) { beat.bpm = clamp(Math.round(v), C.BPM_MIN, C.BPM_MAX); markDirty(false); renderTransport(); }
  function setSwing(v) { beat.swing = clamp(Math.round(v), 0, C.SWING_MAX); markDirty(false); renderTransport(); clearTimeout(tipTimer); tipTimer = setTimeout(renderTip, 350); }
  function setKit(k) {
    if (!C.KIT_KEYS.includes(k) || k === beat.kit) return;
    //  [MUSIC-BEAT-MEL-1] 가락 악기를 고른 적이 없으면(그 묶음의 처음 악기 그대로면) 새 묶음의 처음 악기로 같이 바꾼다 — 고른 악기는 그대로
    if (beat.lead === C.LEAD_DEF[beat.kit]) beat.lead = C.LEAD_DEF[k];
    beat.kit = k; markDirty(false); mixer && mixer.apply(beat.mix, k);
    kit.prepare(k).then(() => alive && renderGrid());
    renderGrid(); renderPal(); renderTip(); if (tab === 'pad' || tab === 'idea') renderSide();
    if (!playing) previewDrum('kick', 2);
  }
  //  가락 악기 [MUSIC-BEAT-MEL-1] — 바꾸면 다음 음부터(울리는 중이어도) · 멈춰 있으면 지금 붓 음으로 한 번 들려줌
  function setLead(k) {
    if (readOnly || !C.LEAD_KEYS.includes(k) || k === beat.lead) return;
    beat.lead = k; markDirty(false);
    renderPal(); if (tab === 'pad') renderSide();
    if (!playing) previewMel(typeof melBrush === 'number' && melBrush <= C.M_TOP ? melBrush : 2);
  }
  //  가락 주사위 — 지금 패턴의 화음을 보고 한 마디 가락(짧은 가락 → 한 번 더 → 끝만 바꿔 길게)
  function rollMel() {
    if (readOnly) return;
    pushUndo();
    cur().m = C.melDice(g(), cur().c);
    markDirty(); renderMel(); setPalTab('mel');
    if (!playing) play({ count: false });
  }
  //  메아리 — 앞 절반 가락을 뒤 절반에 한 칸 위(아래)로
  function echo(dir) {
    if (readOnly) return;
    const r = C.echoMel(cur().m, g(), dir);
    if (!r.notes) { toast('앞 절반에 가락이 없어요 — 먼저 가락 칸을 칠하거나 🎲 가락 주사위를 눌러요', 3200); return; }
    pushUndo();
    cur().m = r.m;
    markDirty(); renderMel(); setPalTab('mel');
    toast(r.clamped ? `메아리를 넣었어요 — 가장 ${dir > 0 ? '높은' : '낮은'} 음은 더 갈 수 없어서 그대로 두었어요` : `메아리를 넣었어요 — 뒤 절반이 한 칸 ${dir > 0 ? '위로' : '아래로'} 따라 해요`, 3000);
    if (!playing) play({ count: false });
  }
  function copyDialog() {
    const src = beat.cur;
    if (C.patternEmpty(cur())) { toast('빈 패턴은 복사할 것이 없어요'); return; }
    const close = modal(`패턴 ${L[src]} 를 어디에 복사할까요?`, h('div', { class: 'bt-copy' },
      h('div', { class: 'stars-row' }, ...[0, 1, 2, 3].filter(i => i !== src).map(i => h('button', { class: 'btn', style: { boxShadow: `inset 0 -3px 0 ${PAT_COLOR[i]}` },
        onclick: () => { close(); pushUndo(); beat.pats[i] = C.clonePattern(beat.pats[src]); beat.cur = i; markDirty(); renderAll(); toast(`${L[i]} 에 복사했어요 — 조금만 바꿔 보세요`); } },
        `${L[i]} ${C.patternEmpty(beat.pats[i]) ? '(비어 있음)' : '(덮어써요)'}`))),
      h('p', { class: 'muted', style: { marginTop: '10px' } }, '복사한 패턴을 조금만 바꾸면 비슷하지만 새로운 마디가 돼요. 순서에 A A A B 처럼 이어 붙여 보세요.')), [{ label: '그만두기' }]);
  }
  function clearDialog() {
    if (C.patternEmpty(cur())) { toast('이미 비어 있어요'); return; }
    modal(`패턴 ${L[beat.cur]} 를 지울까요?`, '북 · 가락 · 베이스 · 화음 칸을 모두 비워요. ↶ 되돌리기로 돌아올 수 있어요.', [{ label: '그만두기' },
      { label: '지우기', primary: true, onclick: c => { c(); pushUndo(); beat.pats[beat.cur] = C.emptyPattern(g()); markDirty(); renderAll(); } }]);
  }
  function useStarter(id) {
    if (readOnly) return;
    const st = C.STARTERS.find(s => s.id === id); if (!st) return;
    const r = C.applyStarter(beat, id);
    const go = () => {
      pushUndo(); setBeat(r.beat);
      toast(`패턴 ${L[beat.cur]} 에 '${st.name}' 카드를 넣었어요 — 들어 보고 칸을 바꿔 보세요`, 3000);
      if (!playing) play({ count: false });
    };
    if (r.converted) modal('칸 수가 바뀌어요', `이 카드는 ${C.GRIDS[st.grid].name}(${C.GRIDS[st.grid].hint})이에요. 다른 패턴도 ${C.GRIDS[st.grid].name}으로 옮겨져서 칸이 조금 달라질 수 있어요. ↶ 되돌리기로 돌아올 수 있어요.`,
      [{ label: '그만두기' }, { label: '카드 넣기', primary: true, onclick: c => { c(); go(); } }]);
    else go();
  }
  function rollDice() {
    if (readOnly) return;
    pushUndo();
    const d = C.dice(g());
    const p = cur();
    for (const r of C.ROWS) p.d[r] = d[r];
    markDirty(); renderGrid();
    if (!playing) play({ count: false });
  }
  function setEuclid(k) {
    if (readOnly) return;
    const len = C.lenOf(g());
    k = clamp(k, 0, len);
    if (Date.now() - eucAt > 1500) pushUndo();
    eucAt = Date.now();
    cur().d[ideaRow] = C.euclid(k, len).map((v, i) => (v ? (i === 0 ? 2 : 1) : 0));
    markDirty(); renderGrid(); renderSide();
  }
  function rotateRow(dir) {
    if (readOnly) return;
    if (!cur().d[ideaRow].some(Boolean)) { toast(`${C.rowName(beat.kit, ideaRow)} 줄이 비어 있어요`); return; }
    pushUndo(); cur().d[ideaRow] = C.rotate(cur().d[ideaRow], dir); markDirty(); renderGrid();
  }
  function makeAAAB() {
    if (readOnly) return;
    const a = beat.cur, b = (a + 1) % 4;
    if (C.patternEmpty(beat.pats[a])) { toast('먼저 지금 패턴에 칸을 채워요'); return; }
    pushUndo();
    const copied = C.patternEmpty(beat.pats[b]);
    if (copied) beat.pats[b] = C.clonePattern(beat.pats[a]);
    beat.arr = [a, a, a, b]; beat.mode = 'song'; beat.cur = b; follow = false;
    markDirty(); renderAll();
    toast(`순서 ${L[a]} ${L[a]} ${L[a]} ${L[b]}${copied ? ` — ${L[b]} 는 ${L[a]} 를 복사했어요. ${L[b]} 를 조금만 바꿔 보세요!` : ''}`, 4200);
  }
  function changeGrid(k) {
    if (readOnly || k === beat.grid) return;
    const go = () => { pushUndo(); beat = C.convertBeat(beat, k); markDirty(); renderAll(); };
    if (C.hasContent(beat)) modal(`${C.GRIDS[k].name}으로 바꿀까요?`, `${C.GRIDS[k].hint}. 들어 있는 칸은 가까운 박 자리로 옮겨요(조금 달라질 수 있어요). ↶ 되돌리기로 돌아올 수 있어요.`,
      [{ label: '그만두기' }, { label: '바꾸기', primary: true, onclick: c => { c(); go(); } }]);
    else go();
  }
  function newBeat() {
    const reset = () => { stop(); beat = C.emptyBeat(); dirty = false; undo.length = 0; titleIn.value = ''; setRef(''); renderAll(); };
    if (dirty && C.hasContent(beat)) modal('새 비트를 만들까요?', '지금 비트를 저장하지 않았어요.', [{ label: '그만두기' }, { label: '저장 안 하고 새로', onclick: c => { c(); reset(); } }, { label: '저장하기', primary: true, onclick: c => { c(); saveDialog(); } }]);
    else reset();
  }
  function deleteDialog(b) {
    modal(`'${b.title || '이름 없는 비트'}' 를 지울까요?`, '지우면 되돌릴 수 없어요. 비트 모음에 올렸다면 거기서도 빠져요.', [{ label: '그만두기' }, { label: '지우기', primary: true, onclick: async c => {
      c();
      try { await store.deleteBeat(b.id); toast('지웠어요'); if (beat.id === b.id) { beat.id = null; beat.pub = false; dirty = true; setRef(''); } }
      catch (e) { console.warn(e); toast('지우지 못했어요'); }
      renderSide();
    } }]);
  }
  function saveDialog(after) {
    if (readOnly) return;
    if (!C.hasContent(beat)) { toast('칸을 하나 이상 채워야 저장할 수 있어요'); return; }
    const t = h('input', { value: beat.title || titleIn.value || '', maxlength: 30, placeholder: '비트 이름', style: { width: '100%' } });
    const pub = h('input', { type: 'checkbox' }); pub.checked = !!beat.pub;
    const warn = h('p', { class: 'save-warn', style: { display: 'none' } });
    modal('비트 저장하기', h('div', { class: 'save' },
      h('label', {}, h('b', {}, '이름'), t),
      h('label', { class: 'chk' }, pub, h('span', {}, h('b', {}, '우리 반 비트 모음에 올리기'), h('small', { class: 'muted' }, '친구들이 들어 볼 수 있어요(고칠 수는 없어요)'))),
      me.guest ? h('p', { class: 'muted' }, '손님으로 열어서 이 기기에만 저장돼요. RPG 에서 열면 내 이름으로 저장돼요.') : null, warn),
    [{ label: '그만두기' }, { label: '저장', primary: true, onclick: async close => {
      const nt = (t.value || '').trim().slice(0, 30) || '이름 없는 비트';
      const bad = badWords(nt);
      //  비트 모음은 반 친구 모두가 보는 곳 — 고운 말이 아니면 올리지 않는다(나만 보기 저장은 된다) [MUSIC-SAFE-1 과 같은 방식]
      if (pub.checked && bad.length) { warn.style.display = ''; warn.textContent = `비트 모음은 반 친구 모두가 보는 곳이에요. 고운 말로 바꿔 주세요 — ${bad.map(hidden).join(', ')} (올리지 않으면 나만 보기로 저장돼요)`; return; }
      beat.title = nt; titleIn.value = nt; beat.pub = pub.checked;
      try {
        const saved = await store.saveBeat(C.packBeat(beat));
        for (const k of ['id', 'by', 'byName', 'created', 'updated', 'rev']) if (saved[k] != null) beat[k] = saved[k];
        dirty = false; close();
        toast(beat.pub ? '저장했어요 · 우리 반 비트 모음에 올렸어요' : '저장했어요');
        setRef(`u.${me.sid}.${beat.id}`);
        if (tab === 'mine' || tab === 'class') renderSide();
        after && after();
      } catch (e) { console.warn(e); toast('저장하지 못했어요 — 인터넷을 확인해 주세요', 3200); }
    } }]);
    setTimeout(() => t.focus(), 50);
  }

  // ── 소리 ──
  function ensureAudio() { engine.ensure(); if (!mixer) mixer = new BeatMixer(engine); mixer.apply(beat.mix, beat.kit); return mixer; }
  const outLat = () => { const c = engine.ctx; return c ? clamp(Number(c.outputLatency) || Number(c.baseLatency) || 0, 0, 0.15) : 0; };
  function track(hd) { if (!hd) return; V.live.push(hd); if (V.live.length > 48) { const now = engine.now; V.live = V.live.filter(x => x.end > now); } }
  function previewDrum(r, v = 1) { ensureAudio(); track(kit.hit(beat.kit, r, engine.now, v === 2 ? 1 : 0.62, mixer.ch[r])); }
  function previewBass(n) { ensureAudio(); track(kit.bass(beat.kit, C.BASS[n].p, engine.now, 0.32, 0.9, mixer.ch.bass)); }
  function previewMel(n) { ensureAudio(); track(kit.lead(beat.lead, beat.kit, C.MEL[n].p, engine.now, 0.36, 0.9, mixer.ch.mel)); }   // [MUSIC-BEAT-MEL-1]
  function previewChord(ch) { ensureAudio(); track(kit.chord(beat.kit, C.CHORDS[ch].notes, engine.now, 0.6, 0.75, mixer.ch.chord, 'long')); }
  //  사건 → 소리(재생 · 듣기 공용) — 열린 칙은 닫힌 칙이 오면 멈춤(드럼 세트처럼 · 우리 장단의 꽹과리 · 징은 그대로) · 베이스 · 화음은 한 번에 하나
  //   [MUSIC-BEAT-MEL-1] 가락도 한 번에 하나(다음 음 · 쉼에서 앞 음을 끊음) — 두드리거나 뜯는 악기만 앞 음을 하나 더 울리게 둔다(쉼에서는 모두 멈춤)
  function sound(e, mx, vs, kitId, leadId) {
    if (!mx) return;
    if (e.kind === 'drum') {
      if (kitId !== 'kor' && (e.row === 'hatc' || e.row === 'hato') && vs.openHat && vs.openHat.t < e.t - 0.001) { vs.openHat.h.stop(e.t); vs.openHat = null; }
      const hd = kit.hit(kitId, e.row, e.t, e.crash ? 0.75 : e.vel === 2 ? 1 : 0.62, mx.ch[e.row]);
      if (hd) { vs.live.push(hd); if (e.row === 'hato' && kitId !== 'kor') vs.openHat = { h: hd, t: e.t }; }
    } else if (e.kind === 'mel') {
      if (C.isRing(leadId)) { if (vs.melPrev) vs.melPrev.stop(e.t); vs.melPrev = vs.mel; } else if (vs.mel) vs.mel.stop(e.t);
      vs.mel = kit.lead(leadId, kitId, C.MEL[e.n].p, e.t, e.d, 0.9, mx.ch.mel); vs.mel && vs.live.push(vs.mel);
    } else if (e.kind === 'meloff') { for (const k of ['mel', 'melPrev']) if (vs[k]) { vs[k].stop(e.t); vs[k] = null; } }
    else if (e.kind === 'bass') { if (vs.bass) vs.bass.stop(e.t); vs.bass = kit.bass(kitId, C.BASS[e.n].p, e.t, e.d, 0.9, mx.ch.bass); vs.bass && vs.live.push(vs.bass); }
    else if (e.kind === 'bassoff') { if (vs.bass) { vs.bass.stop(e.t); vs.bass = null; } }
    else if (e.kind === 'chord') { if (vs.chord) vs.chord.stop(e.t); vs.chord = kit.chord(kitId, C.CHORDS[e.ch].notes, e.t, e.d, e.vel, mx.ch.chord, e.style); vs.chord && vs.live.push(vs.chord); }
    else if (e.kind === 'chordoff') { if (vs.chord) { vs.chord.stop(e.t); vs.chord = null; } }
    else if (e.kind === 'click') engine.click(e.t, e.accent, mx.master);
  }
  function cutAll(vs) { const now = engine.now; for (const x of vs.live) x.stop(now); vs.live = []; vs.bass = vs.chord = vs.openHat = vs.mel = vs.melPrev = null; }
  function emit(e) {
    if (DEBUG) { fired.push({ k: e.kind, t: e.t, w: engine.now, r: e.row, p: e.pat, s: e.step, b: e.bar, v: e.vel, n: e.n, d: e.d, L: e.kind === 'mel' ? beat.lead : undefined, ch: e.ch, c: !!e.count, crash: !!e.crash, fill: !!e.fill }); if (fired.length > 6000) fired.splice(0, 2000); }
    if (e.kind === 'step') { stepLog.push({ t: e.t, pat: e.pat, step: e.step, bar: e.bar }); if (stepLog.length > 64) stepLog.shift(); vq.push(e); return; }
    if (e.kind === 'drum' && skipOnce.size && skipOnce.delete(e.bar + '|' + e.step + '|' + e.row)) return;
    //  손으로 넣은 가락(아직 예약 안 한 칸) — 이번엔 손으로 친 소리만: 앞 음만 끊고 새로 치지 않는다 [MUSIC-BEAT-MEL-1]
    if (e.kind === 'mel' && skipOnce.size && skipOnce.delete(e.bar + '|' + e.step + '|mel')) { sound({ kind: 'meloff', t: e.t }, mixer, V, beat.kit, beat.lead); return; }
    sound(e, mixer, V, beat.kit, beat.lead);
  }
  async function play({ count = countPref, recording = false } = {}) {
    if (playing || !alive) return;
    stopPreview();
    ensureAudio(); engine.setReverb(0.1);
    playing = true;          // 굽는 동안 두 번 눌러도 한 번만
    if (!kit.ready(beat.kit)) await kit.prepare(beat.kit);
    if (!alive || !playing) return;
    const G = g(), countBar = G.beats * 60 / beat.bpm;
    loopStart = engine.now + 0.12 + (count ? READY_SEC + countBar : 0);
    seq = new C.Sequencer({ now: () => engine.now, emit, beat: () => beat });
    follow = true; rec = recording; counting = count; stepLog.length = 0; vq.length = 0; skipOnce.clear();
    seq.start({ at: loopStart, countIn: count });
    clearInterval(timer); timer = setInterval(tick, C.TICK_MS);
    if (count) showCount();
    renderTransport(); renderPats(); if (tab === 'pad') renderSide();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function tick() { if (!seq) return; seq.tick(); const now = engine.now; if (V.live.length > 48) V.live = V.live.filter(x => x.end > now); }
  function stop() {
    if (!playing && !seq) return;
    if (seq) seq.stop();
    clearInterval(timer); timer = 0; seq = null; playing = false; rec = false; counting = false; playPat = -1; playPos = -1;
    cutAll(V); vq.length = 0; skipOnce.clear(); held.clear(); hideCount(); setPlayhead(-1);
    if (!built) return;
    renderTransport(); renderPats(); if (tab === 'pad') renderSide();
  }
  function frame() {
    if (!alive) return;
    const now = engine.now, lat = outLat();
    while (vq.length && vq[0].t + lat <= now) applyStep(vq.shift());
    if (counting) { if (now >= loopStart) { counting = false; hideCount(); } else drawCount(now); }
    if (playing || vq.length) raf = requestAnimationFrame(frame);
  }
  function applyStep(e) {
    const changed = playPat !== e.pat || playPos !== e.pos;
    playPat = e.pat; playPos = e.pos;
    if (e.step === 0 && e.song && follow && beat.cur !== e.pat) { beat.cur = e.pat; renderGrid(); renderPal(); renderTip(); }
    if (changed || e.step === 0) renderPats();
    setPlayhead(e.pat === beat.cur ? e.step : -1);
    if (e.pat === beat.cur) for (const r of e.hits) flash(r, e.step);
    const hs = e.hits;
    if (hs.includes('kick') || (beat.kit === 'kor' && hs.includes('clap'))) bounce();
    else if (hs.includes('snare') || hs.includes('clap')) wiggle();
  }
  function colCells(i) {
    if (i < 0) return [];
    const out = []; for (const r in cells) cells[r][i] && out.push(cells[r][i]);
    melCells[i] && out.push(melCells[i]);
    bassCells[i] && out.push(bassCells[i]);
    const k = Math.floor(i / C.slotLen(g())); chordCells[k] && out.push(chordCells[k]);
    return out;
  }
  function setPlayhead(i) {
    if (ph === i) return;
    for (const c of colCells(ph)) c.classList.remove('ph');
    ph = i;
    for (const c of colCells(i)) c.classList.add('ph');
  }
  function flash(r, i) {
    const el = r === 'bass' ? bassCells[i] : r === 'mel' ? melCells[i] : r === 'chord' ? chordCells[Math.floor(i / C.slotLen(g()))] : cells[r] && cells[r][i];
    if (el && el.animate) { dance.flash++; el.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 170, easing: 'ease-out' }); }
    const d = labDots[r]; if (d && d.animate) d.animate([{ transform: 'scale(1.9)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.55 }], { duration: 220, easing: 'ease-out' });
  }
  function bounce() { dance.bounce++; buddyImg.animate && buddyImg.animate([{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(5px) scale(1.12,.86)', offset: 0.25 }, { transform: 'translateY(-9px) scale(.94,1.08)', offset: 0.6 }, { transform: 'translateY(0) scale(1,1)' }], { duration: 300, easing: 'ease-out' }); }
  function wiggle() { dance.wiggle++; buddyImg.animate && buddyImg.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }], { duration: 260, easing: 'ease-out' }); }
  //  셈(3 · 2 · 1 → 하나 둘 셋 넷) — 칸판 위 덮개 [MUSIC-READY-1 과 같은 글자 · 같은 차례]
  function showCount() {
    const dpr = Math.min(2, devicePixelRatio || 1), W = gridBox.clientWidth, H = gridBox.clientHeight;
    countCv.width = Math.max(1, W * dpr); countCv.height = Math.max(1, H * dpr); countCv.style.width = W + 'px'; countCv.style.height = H + 'px';
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); countCv.style.display = 'block';
  }
  function hideCount() { countCv.style.display = 'none'; }
  function drawCount(now) {
    const W = countCv.clientWidth, H = countCv.clientHeight, G = g(), bt = 60 / beat.bpm;
    g2.clearRect(0, 0, W, H); g2.fillStyle = 'rgba(10,8,6,.6)'; g2.fillRect(0, 0, W, H);
    readyCount(g2, now - loopStart, G.beats * bt, bt, G.beats, W / 2, H / 2 - 20);
  }
  // ── 손으로 치기 · 녹음 ──
  function toggleRec() {
    if (readOnly) return;
    if (rec) { rec = false; renderTransport(); if (tab === 'pad') renderSide(); toast('녹음을 멈췄어요 — 비트는 계속 돌아요'); return; }
    pushUndo();
    if (recTarget === 'mel') toast('가락 녹음 — 가락 건반(Z X C V B N M ,)을 쳐요. 길게 누르면 길게 들어가요', 3200);   // [MUSIC-BEAT-MEL-1]
    if (!playing) play({ count: true, recording: true });
    else { rec = true; renderTransport(); if (tab === 'pad') renderSide(); }
  }
  //  친 시각 T → 가장 가까운 칸(예약해 둔 칸 + 아직 예약 안 한 다음 칸) — 셈하는 동안 친 것 · 너무 먼 것은 null
  function recSlot(T) {
    const half = C.stepDur(beat.bpm, g()) / 2;
    if (T < loopStart - half) return null;                              // 셈하는 동안 친 것은 넣지 않는다
    const cands = stepLog.slice(-24), nx = seq.peek();
    if (nx) cands.push({ ...nx, bar: seq.bar, next: true });
    const best = C.nearestOf(T, cands);
    return !best || Math.abs(best.t - T) > half * 2.2 ? null : best;
  }
  function padHit(r) {
    ensureAudio();
    const now = engine.now;
    if (beat.kit !== 'kor' && (r === 'hatc' || r === 'hato') && V.openHat) { V.openHat.h.stop(now); V.openHat = null; }
    const hd = kit.hit(beat.kit, r, now, 0.9, mixer.ch[r]);
    if (hd) { track(hd); if (r === 'hato' && beat.kit !== 'kor') V.openHat = { h: hd, t: now }; }
    const pad = tabBody.querySelector(`.bt-pad[data-r="${r}"]`); pad && pad.animate && pad.animate([{ transform: 'scale(.9)', filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 160 });
    flashLabel(r);
    if (!mixer.audible(beat.mix, r) && Date.now() - warnedMute > 4000) { warnedMute = Date.now(); toast('그 줄은 음소거(M)나 혼자 듣기(S) 때문에 안 들려요'); }
    if (!rec || !playing || readOnly || !seq || recTarget !== 'drum') return;   // 녹음할 곳이 가락이면 북은 치기만
    const best = recSlot(now - outLat()); if (!best) return;
    const p = beat.pats[best.pat]; if (!p || !p.d[r] || best.step >= p.d[r].length) return;
    if (!p.d[r][best.step]) p.d[r][best.step] = 1;
    if (best.next) skipOnce.add(best.bar + '|' + best.step + '|' + r);   // 아직 예약 안 한 칸 — 이번엔 손으로 친 소리만(두 번 울리지 않게)
    if (C.EXTRA.includes(r) && !beat.show[r]) { beat.show[r] = true; renderGrid(); }
    else if (best.pat === beat.cur) updateCell(r, best.step);
    markDirty();
  }
  function flashLabel(r) { const d = labDots[r]; d && d.animate && d.animate([{ transform: 'scale(1.9)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.55 }], { duration: 220 }); }
  //  가락 건반 [MUSIC-BEAT-MEL-1] — 누르면 울리고(한 줄 가락: 누르고 있던 다른 건반은 멈춤 · 두드리는 악기는 그대로 울림) ·
  //   녹음 중 + 녹음할 곳 '가락' 이면 가장 가까운 칸에 그 음(있던 음은 바꿈) · 아직 예약 안 한 칸이면 이번엔 손으로 친 소리만(두 번 울리지 않게)
  function melHit(n) {
    if (!(n >= 0 && n <= C.M_TOP)) return;
    ensureAudio();
    const now = engine.now, ring = C.isRing(beat.lead);
    if (!ring) for (const [k, x] of held) if (k !== n && x.hd) { x.hd.stop(now); x.hd = null; }
    const old = held.get(n); if (old && old.hd && !ring) old.hd.stop(now);
    const hd = kit.lead(beat.lead, beat.kit, C.MEL[n].p, now, ring ? 1 : 4, 0.9, mixer.ch.mel);
    track(hd);
    const key = tabBody.querySelector(`.bt-mkey[data-n="${n}"]`); key && key.animate && key.animate([{ transform: 'translateY(3px)', filter: 'brightness(1.5)' }, { transform: 'none', filter: 'none' }], { duration: 170 });
    flashLabel('mel');
    if (!mixer.audible(beat.mix, 'mel') && Date.now() - warnedMute > 4000) { warnedMute = Date.now(); toast('가락 줄은 음소거(M)나 혼자 듣기(S) 때문에 안 들려요'); }
    const x = { hd, rec: null };
    held.set(n, x);
    if (!rec || !playing || readOnly || !seq || recTarget !== 'mel') return;
    const best = recSlot(now - outLat()); if (!best) return;
    const p = beat.pats[best.pat]; if (!p || best.step >= p.m.length) return;
    p.m[best.step] = n;
    if (best.next) skipOnce.add(best.bar + '|' + best.step + '|mel');
    x.rec = { pat: best.pat, step: best.step, t: best.t };
    if (best.pat === beat.cur) renderMel();
    markDirty();
  }
  //  건반을 뗌 — 소리 멈춤(두드리는 악기는 저절로) · 녹음 중이면 뗀 자리(가까운 칸)에 쉼: 짧게 누르면 짧은 음 · 사이에 다른 음이 있거나 마디 끝을 넘으면 그대로
  function melRelease(n) {
    const x = held.get(n); if (!x) return;
    held.delete(n);
    const now = engine.now, ring = C.isRing(beat.lead);
    if (x.hd && !ring) x.hd.stop(now);
    if (!x.rec || ring || !rec || !playing || readOnly) return;
    const p = beat.pats[x.rec.pat]; if (!p) return;
    const r = x.rec.step + Math.max(1, Math.round((now - outLat() - x.rec.t) / C.stepDur(beat.bpm, g())));
    if (r >= p.m.length) return;
    for (let j = x.rec.step + 1; j <= r; j++) if (p.m[j] !== C.B_EMPTY) return;
    p.m[r] = C.B_REST;
    if (x.rec.pat === beat.cur) renderMel();
    markDirty();
  }
  function releaseAll() { for (const n of [...held.keys()]) melRelease(n); }
  // ── 들어 보기(내 비트 · 우리 반 목록) ── 화면의 비트와 따로 — 따로 믹서 · 따로 박자기 · 순서가 있으면 순서 두 바퀴(16마디까지) · 없으면 네 마디
  async function preview(src, btn) {
    if (pv && pv.btn === btn) { stopPreview(); return; }
    stopPreview();
    if (playing) stop();
    let raw = src;
    if (typeof src === 'string') { const m = /^u\.([^.]+)\.([^.]+)$/.exec(src); raw = null; if (m) { try { raw = await store.getBeat(m[1], m[2]); } catch (e) { console.warn(e); } } }
    if (!alive) return;
    const b = raw ? C.normalizeBeat(raw) : null;
    if (!b || !C.hasContent(b)) { toast('들을 비트를 찾지 못했어요'); return; }
    ensureAudio(); engine.setReverb(0.1);
    await kit.prepare(b.kit);
    if (!alive) return;
    if (b.arr.length) b.mode = 'song';
    else { b.mode = 'loop'; if (C.patternEmpty(b.pats[b.cur])) b.cur = Math.max(0, b.pats.findIndex(p => !C.patternEmpty(p))); }
    const bars = b.arr.length ? Math.min(16, b.arr.length * 2) : 4;
    const mx = new BeatMixer(engine); mx.apply(b.mix, b.kit);
    const vs = { live: [], bass: null, chord: null, openHat: null, mel: null, melPrev: null };
    const sq = new C.Sequencer({ now: () => engine.now, emit: e => { if (e.kind === 'step') return; if (e.kind === 'mel') dance.pvMel++; sound(e, mx, vs, b.kit, b.lead); }, beat: () => b });
    sq.start({ at: engine.now + 0.08 });
    const tm = setInterval(() => { sq.tick(); if (sq.bar >= bars) stopPreview(); }, C.TICK_MS);
    btn.classList.add('stop');
    pv = { sq, mx, vs, tm, btn };
  }
  function stopPreview() {
    if (!pv) return;
    const p = pv; pv = null;
    p.sq.stop(); clearInterval(p.tm); cutAll(p.vs); p.btn.classList.remove('stop');
    setTimeout(() => p.mx.dispose(), 500);
  }

  // ── 글쇠 ──
  const onKey = e => {
    if (!alive || !built) return;
    const el = document.activeElement, tag = el && el.tagName;
    if ((tag === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox') || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.querySelector('.modal-wrap')) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); doUndo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = KEYS.indexOf(e.code);
    if (e.code === 'Space') { e.preventDefault(); if (tag === 'BUTTON' || tag === 'INPUT') el.blur(); if (!e.repeat) (playing ? stop() : play()); return; }
    if (e.code === 'Escape') { if (playing) stop(); return; }
    if (/^Digit[1-4]$/.test(e.code)) { selectPattern(+e.code.slice(5) - 1); return; }
    if (e.code === 'KeyR') { if (!e.repeat) toggleRec(); return; }
    if (k >= 0) { e.preventDefault(); if (!e.repeat) padHit(C.ROWS[k]); return; }
    const mk = MKEYS.indexOf(e.code);                                 // 가락 건반 [MUSIC-BEAT-MEL-1]
    if (mk >= 0) { e.preventDefault(); if (!e.repeat) melHit(mk); return; }
    if (tag === 'INPUT') return;                                      // 소리 크기 · 빠르기 막대는 화살표를 막대가 쓴다
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); setBpm(beat.bpm + (e.code === 'ArrowUp' ? 2 : -2)); return; }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); selectPattern((beat.cur + (e.code === 'ArrowRight' ? 1 : 3)) % 4); }
  };
  addEventListener('keydown', onKey);
  const onKeyUp = e => { const mk = MKEYS.indexOf(e.code); if (mk >= 0) melRelease(mk); };   // 가락 건반 떼기
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', releaseAll);
  const onVis = () => { if (document.hidden) { stop(); stopPreview(); } };
  document.addEventListener('visibilitychange', onVis);
  const beforeUnload = e => { if (dirty && !readOnly && C.hasContent(beat)) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', beforeUnload);

  // ── 시험용(?debug=1) — 읽기만(복사본) ──
  function exposeDebug() {
    window.__beat = {
      state: () => ({ dance: { ...dance }, playing, rec, counting, cur: beat.cur, playPat, playPos, bpm: beat.bpm, swing: beat.swing, kit: beat.kit, grid: beat.grid, mode: beat.mode, arr: beat.arr.slice(), fill: beat.fill, click: beat.click, tab, readOnly, dirty, undo: undo.length, loopStart, id: beat.id, title: beat.title,
        lead: beat.lead, palTab, recTarget, held: [...held.keys()] }),   // [MUSIC-BEAT-MEL-1]
      beat: () => JSON.parse(JSON.stringify(C.packBeat(beat))),
      log: () => fired.slice(),
      clearLog: () => { fired.length = 0; return true; },
      now: () => engine.now,
      lat: () => outLat(),
      ready: k => kit.ready(k || beat.kit),
      prepare: k => kit.prepare(k),
      kitStats: () => kit.stats(),
      voices: () => { const now = engine.now; return V.live.filter(x => x.end > now).length; },   // 지금 울리고 있는(끝나지 않은) 소리 수
      chGain: r => (mixer && mixer.ch[r] ? mixer.ch[r].gain.value : null),                            // 믹서 줄 크기(음소거 확인) [MUSIC-BEAT-MEL-1]
    };
  }

  load();
  return {
    pause() { stop(); stopPreview(); },
    unmount() {
      alive = false; stop(); stopPreview();
      cancelAnimationFrame(raf); clearTimeout(tipTimer); clearTimeout(sideTimer);
      if (stopClass) { stopClass(); stopClass = null; }
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('blur', releaseAll); removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', onVis);
      if (mixer) { const m = mixer; mixer = null; setTimeout(() => m.dispose(), 400); }
      if (DEBUG) { try { delete window.__beat; } catch (e) {} }
    },
    isDirty: () => dirty && !readOnly && C.hasContent(beat),
    leaveMsg: '저장하지 않은 비트가 있어요. 나갈까요?',
  };
}
