// 작곡 — 칸을 눌러 음을 놓고(음 길이를 골라서), 반주 친구와 함께 들어 보고, 악보·운지로 확인하고, 저장한다.
import { h, toast, modal, clamp, lsGet, lsSet } from './util.js';
import { SCALES, METERS, solfege, colorOf, scaleRows, barSteps, totalSteps, lengthChoices, valueName, beatsText, fitChords, chordName, ROMAN, pc } from './theory.js';
import { emptySong, normalize, placeNote, removeNote, buildEvents, INSTS, DRUMS, placeHarm, removeHarm, chordify } from './song.js';
import { engine, Player } from './audio.js';
import { PRESETS, PRESET_KEYS, PARTS, PART_KEYS, DYN, FAMILIES, INST_GROUPS, orchOK, orchOn, applyPreset, defaultOrch, leadShift, chordLine, samplePhrase } from './orchestra.js';   // [MUSIC-ORCH-1]
import { renderStaff } from './notation.js';
import { coach, ideas } from './coach.js';
import { fingerSVG, recorderOK } from './recorder.js';
import { songBad, hidden } from './safety.js';
import { EX_SONGS, EX_BY } from './showcase.js';   // [MUSIC-SHOWCASE-1]
import { scoreStrip, scoreTabs } from './scoreview.js';   // [MUSIC-SCORE-1] 악보 같이 보기 띠 · 오케스트라 총보

const NOTE_ICON = { 1: '♪', 2: '♩', 3: '♩.', 4: '𝅗𝅥', 6: '𝅗𝅥.', 8: '𝅝' };
const MOODS = {
  bright: { name: '밝게', apply: s => { s.tempo = 116; s.inst = 'xylo'; s.reverb = 0.1; s.acc = { ...s.acc, drum: 'basic', bass: true }; if (SCALES[s.scale].family === 'korean') s.scale = 'penta'; },
    why: '빠르기를 조금 빠르게(116) · 실로폰처럼 맑은 소리 · 도로 끝나는 밝은 음계 · 쿵짝 리듬' },
  dreamy: { name: '몽환적으로', apply: s => { s.tempo = 74; s.inst = 'marimba'; s.reverb = 0.45; s.acc = { ...s.acc, drum: 'none', bass: false, chord: true }; },
    why: '느리게(74) · 울림을 크게 · 북은 쉬고 화음만 은은하게 · 둥근 마림바 소리' },
  sad: { name: '쓸쓸하게', apply: s => { s.tempo = 68; s.inst = 'recorder'; s.reverb = 0.25; s.scale = 'gyemyeon'; s.acc = { ...s.acc, drum: 'none' }; },
    why: '아주 느리게(68) · 라로 끝나는 계면조 느낌 · 혼자 부는 리코더 소리 · 북은 쉼' },
};
const BAND = [
  { k: 'chord', name: '화음 친구', img: 'm22', sub: '화음을 깔아요' },
  { k: 'bass', name: '베이스 친구', img: 'm38', sub: '낮은 뿌리음' },
  { k: 'drum', name: '장단 친구', img: 'm28', sub: '박을 쳐요' },
];

export function mountCompose(root, ctx, { song: init, ref }) {
  const exKey = init && typeof init.lk === 'string' && init.lk.startsWith('ex_') ? init.lk.slice(3) : null;   // [MUSIC-SHOWCASE-1] 예시 곡에서 열었나
  let song = normalize(init || emptySong());
  if (init && init.lib) { song.title = init.title + ' 바꿔 쓰기'; song.id = null; delete song.lib; delete song.lk; delete song.pub; }
  //  [MUSIC-HALF-1] 처음 음 길이 = 한 칸(2/4 · 3/4 · 4/4 = 반 박 · 겹박자 = 8분음표) — 선생님 10-10 '기본이 1박이면 덜 직관적 · 반 박으로'
  let dirty = false, L = 1, erase = false, lyricsOn = song.notes.some(n => n.w);
  let layer = 'mel', cursor = 0;   // [MUSIC-HARM-1] 가락 칸 / 화음 칸 · [MUSIC-KEYS-1] 키보드로 놓는 자리
  const player = new Player(engine);
  //  [MUSIC-ORCH-1] 가락 악기 높이(첼로 = 한 옥타브 아래 · 첼레스타 = 위 …) — 칸을 누를 때 나는 소리도 들어 보기와 같은 높이 · 예전 악기는 0
  const sh = () => leadShift(song);
  let beforeOrch = null, lastOrch = null, lastChip = null;   // 오케스트라를 켜기 전 악기 · 울림(끄면 되돌림) · 끄기 전 오케스트라 악기(다시 켜면 그것) · 마지막으로 누른 칸
  let raf = 0, playStart = 0, built = null;

  // ── 윗줄 ──
  const title = h('input', { class: 'c-title', placeholder: '곡 제목', maxlength: 30, value: song.title, oninput: () => { song.title = title.value; dirty = true; } });
  const playBtn = h('button', { class: 'btn primary', title: 'Enter', onclick: () => togglePlay() }, '▶ 들어 보기');
  const tempoV = h('b', {}, String(song.tempo));
  const tempo = d => { song.tempo = clamp(song.tempo + d, 50, 180); tempoV.textContent = song.tempo; dirty = true; if (player.playing) togglePlay(true); };
  const top = ctx.topBar('작곡', {
    back: () => leave(),
    right: [title,
      h('div', { class: 'c-tempo' }, h('span', { class: 'muted' }, '빠르기'), h('button', { class: 'btn small', onclick: () => tempo(-4) }, '−'), tempoV, h('button', { class: 'btn small', onclick: () => tempo(4) }, '+')),
      playBtn, h('button', { class: 'btn', onclick: () => saveDialog() }, '저장')],
  });

  // ── 가운데: 도구 · 칸 · 노랫말 · 코치 ──
  const tools = h('div', { class: 'c-tools' });
  const chordRow = h('div', { class: 'c-chords' });
  const grid = h('div', { class: 'c-grid', role: 'grid', 'aria-label': '작곡 칸' });
  //  [MUSIC-SCORE-1] 칸 바로 아래 오선 띠(칸과 같이 가로로 밀림) — '🎼 악보 같이 보기'로 켜고 끔(이 기기에 기억 · 처음엔 켬)
  const strip = scoreStrip(), SCORE_LS = 'music.compose.score';
  let scoreOn = lsGet(SCORE_LS, true) !== false, stripH = -1, stripRaf = 0;
  strip.el.style.display = scoreOn ? '' : 'none';
  const gridWrap = h('div', { class: 'c-gridwrap' }, chordRow, grid, strip.el);
  const lyric = h('input', { class: 'c-lyric', placeholder: '노랫말을 쓰면 음표에 한 글자씩 붙어요 (예: 나비야나비야)', maxlength: 120, oninput: () => applyLyrics() });
  const lyricRow = h('div', { class: 'c-lyricrow' }, h('b', {}, '노랫말'), lyric, h('span', { class: 'muted c-lyrichint' }));
  const coachBox = h('div', { class: 'c-coach' });
  const main = h('div', { class: 'c-main' }, tools, gridWrap, lyricRow, coachBox);
  const side = h('aside', { class: 'c-side' });
  const body = h('div', { class: 'c-body' }, main, side);
  root.replaceChildren(top, h('div', { class: 'view' }, body));

  let rows = [], cellW = 26, rowH = 32;
  const LABEL = 58;

  function renderTools() {
    tools.replaceChildren(...[
      h('div', { class: 'seg', role: 'group', 'aria-label': '칸' },
        h('button', { class: layer === 'mel' ? 'on' : '', onclick: () => setLayer('mel'), title: 'Tab 으로 바꿔요' }, '가락'),
        h('button', { class: layer === 'harm' ? 'on' : '', onclick: () => setLayer('harm'), title: 'Tab 으로 바꿔요' }, '화음')),
      h('span', { class: 'c-lbl' }, '음 길이'),
      ...lengthChoices(song.sub).map(d => h('button', { class: 'btn small len' + (!erase && L === d ? ' on' : ''), title: (valueName(d, song.sub) || '') + ' · ' + beatsText(d, song.sub),
        onclick: () => { L = d; erase = false; renderTools(); } }, h('i', {}, NOTE_ICON[d] || '♩'), beatsText(d, song.sub))),
      h('button', { class: 'btn small' + (erase ? ' on' : ''), onclick: () => { erase = !erase; renderTools(); } }, '지우개'),
      layer === 'harm' ? h('button', { class: 'btn small', title: '가락 음마다 두 칸 아래(3도) 음을 화음으로', onclick: () => thirdsBelow() }, '아래 3도 넣기') : null,
      layer === 'harm' && song.harm.length ? h('button', { class: 'btn small', onclick: () => { song.harm = []; dirty = true; renderGrid(); } }, '화음 지우기') : null,
      h('span', { class: 'sp' }),
      layer === 'mel' ? h('button', { class: 'btn small' + (lyricsOn ? ' on' : ''), onclick: () => { lyricsOn = !lyricsOn; renderTools(); layout(); } }, '노랫말') : null,
      h('button', { class: 'btn small', title: '키보드로 작곡하는 법', onclick: () => showKeys() }, '⌨ 키보드'),
      h('button', { class: 'btn small', onclick: () => showStaff() }, '악보 보기'),
      h('button', { class: 'btn small c-scorebtn' + (scoreOn ? ' on' : ''), 'aria-pressed': String(scoreOn), title: '칸 아래에 오선 악보를 같이 보여 줘요 — 음을 놓으면 바로 음표가 돼요', onclick: () => toggleScore() }, '🎼 악보 같이 보기'),
      layer === 'mel' ? h('button', { class: 'btn small', onclick: () => showFingers() }, '리코더 운지') : null,
      layer === 'mel' ? h('button', { class: 'btn small', onclick: () => { if (!song.notes.length) return; modal('모두 지울까요?', '놓은 음을 전부 지워요.', [{ label: '그만두기' }, { label: '모두 지우기', primary: true, onclick: c => { song.notes = []; dirty = true; c(); renderGrid(); } }]); } }, '다 지우기') : null,
    ].filter(Boolean));
  }

  function setLayer(v) { layer = v; erase = false; renderTools(); renderGrid(); }
  // 화음 도우미 — 가락 음마다 음계에서 두 칸 아래 음(장음계면 3도)을 같은 길이로. 이미 있는 화음 자리는 그대로
  function thirdsBelow() {
    if (!song.notes.length) { toast('먼저 가락 칸에 음을 놓아 주세요'); return; }
    const rowsUp = scaleRows(song.scale, [...song.notes, ...song.harm]);
    let n = 0;
    for (const m of song.notes) {
      if (song.harm.some(x => x.s === m.s)) continue;
      const i = rowsUp.indexOf(m.p), q = rowsUp[i - 2];
      if (i >= 2 && q != null) { song.harm.push({ s: m.s, d: m.d, p: q }); n++; }
    }
    song.harm = chordify(song.harm);
    dirty = true; renderGrid();
    toast(n ? `가락 아래 두 칸 음 ${n}개를 화음으로 넣었어요 — 들어 보고 마음에 안 드는 곳은 지워요` : '더 넣을 자리가 없어요(이미 화음이 있거나 너무 낮은 음)', 3200);
  }

  function layout() {
    rows = scaleRows(song.scale, [...song.notes, ...song.harm]).reverse();      // 위가 높은 음
    lyricRow.style.display = lyricsOn ? '' : 'none';
    const steps = totalSteps(song);
    cellW = clamp(Math.floor((Math.max(400, main.clientWidth - 8) - LABEL) / steps), 16, 46);
    //  [MUSIC-SCORE-1] 띠 높이만큼 칸 줄을 낮춘다(띠 높이는 음 범위로 정해져 음을 놓아도 그대로) · 도구 줄(1366 에서 두 줄) · 코치 칸은 잰 높이로
    stripH = scoreOn ? strip.render(song, stripGeom()) + 4 : 0;
    const fixed = 16 + tools.offsetHeight + 6 + 36 + (lyricsOn ? lyricRow.offsetHeight + 6 : 0) + 6 + coachBox.offsetHeight;
    const avH = Math.max(scoreOn ? rows.length * 22 : 200, root.clientHeight - 50 - fixed - stripH);
    rowH = clamp(Math.floor(avH / rows.length), 22, 40);
    renderGrid();
  }
  //  [MUSIC-SCORE-1] 악보 같이 보기 — 칸과 같은 가로 자리(이름 칸 · 한 칸 너비) · 음 범위(칸 줄의 가장 낮은 음 ~ 가장 높은 음)
  const stripGeom = () => ({ left: LABEL, stepW: cellW, rows: [rows[rows.length - 1], rows[0]] });
  function stripNow() {
    if (!scoreOn || !rows.length) return;
    const hh = strip.render(song, stripGeom()) + 4;
    if (hh !== stripH) requestAnimationFrame(layout);   // 화음 칸을 처음 놓거나 다 지우면 오선이 늘고 줄어 → 칸 줄 높이를 다시
  }
  const stripSoon = () => { if (scoreOn && !stripRaf) stripRaf = requestAnimationFrame(() => { stripRaf = 0; stripNow(); }); };   // 끌어 늘이는 동안(한 그림에 한 번)
  function toggleScore() {
    scoreOn = !scoreOn; lsSet(SCORE_LS, scoreOn);
    strip.el.style.display = scoreOn ? '' : 'none';
    if (!scoreOn) strip.highlight(null);
    renderTools(); layout();
  }

  function renderGrid() {
    const bs = barSteps(song), steps = totalSteps(song), W = LABEL + steps * cellW, H = rows.length * rowH;
    grid.style.width = W + 'px'; grid.style.height = H + 'px';
    grid.style.setProperty('--cw', cellW + 'px'); grid.style.setProperty('--rh', rowH + 'px');
    grid.style.setProperty('--bw', cellW * song.sub + 'px'); grid.style.setProperty('--barw', cellW * bs + 'px'); grid.style.setProperty('--lab', LABEL + 'px');
    const kids = [];
    rows.forEach((p, r) => {
      const isTonic = pc(p) === SCALES[song.scale].tonic;
      kids.push(h('div', { class: 'c-row' + (isTonic ? ' tonic' : ''), style: { top: r * rowH + 'px', height: rowH + 'px' } }));
      kids.push(h('button', { class: 'c-lab' + (p >= 72 ? ' hi' : ''), style: { top: r * rowH + 'px', height: rowH + 'px', '--c': colorOf(p) }, title: solfege(p), onclick: () => engine.note(song.inst, p + sh(), engine.now, 0.5, 0.8) },
        h('i', {}), h('span', {}, solfege(p, { short: true }))));
    });
    song.notes.forEach(n => {
      const r = rows.indexOf(n.p);
      if (r < 0) return;
      const el = h('div', { class: 'c-note' + (layer === 'harm' ? ' dim' : ''), style: { left: LABEL + n.s * cellW + 1 + 'px', top: r * rowH + 2 + 'px', width: n.d * cellW - 2 + 'px', height: rowH - 4 + 'px', '--c': colorOf(n.p) } },
        h('span', {}, n.w || (n.d * cellW >= 30 ? solfege(n.p, { short: true }) : '')), h('i', { class: 'grip' }));
      el._n = n;
      kids.push(el);
    });
    song.harm.forEach(n => {                                      // [MUSIC-HARM-1] 화음 음 = 테두리 칸
      const r = rows.indexOf(n.p);
      if (r < 0) return;
      const el = h('div', { class: 'c-note harm' + (layer === 'mel' ? ' dim' : ''), style: { left: LABEL + n.s * cellW + 1 + 'px', top: r * rowH + 2 + 'px', width: n.d * cellW - 2 + 'px', height: rowH - 4 + 'px', '--c': colorOf(n.p) } },
        h('span', {}, n.d * cellW >= 30 ? solfege(n.p, { short: true }) : ''), h('i', { class: 'grip' }));
      el._h = n;
      kids.push(el);
    });
    kids.push(h('div', { class: 'c-cursor', style: { left: LABEL + Math.min(cursor, steps) * cellW + 'px' }, title: '키보드로 놓는 자리' }));
    kids.push(h('div', { class: 'c-head', id: 'c-head' }));
    grid.replaceChildren(...kids);
    // 화음 이름(화음 친구가 켜졌을 때) — 누르면 I → IV → V → 자동
    const chords = fitChords(song, song.chords), korean = SCALES[song.scale].family === 'korean';
    //  [MUSIC-ORCH-1] 오케스트라가 켜져 있으면 오케스트라가 치는 화음 이름(끝 마디 'G7→C' 마침 · 딸림7 포함) — 반주 친구를 쉬게 해도 화음은 고를 수 있다
    const orchLine = orchOn(song) ? chordLine(song) : null;
    chordRow.style.width = W + 'px';
    chordRow.replaceChildren(h('span', { class: 'c-chordlbl', style: { width: LABEL + 'px' } }, korean ? '지속음' : song.acc.chord || orchLine ? '화음' : ''),
      ...Array.from({ length: song.bars }, (_, b) => {
        if (korean) return h('span', { class: 'c-chord drone', style: { width: bs * cellW + 'px' } }, b === 0 ? (song.scale === 'pyeong' ? '솔 + 레' : '라 + 미') : '');
        if (!song.acc.chord && !orchLine) return h('span', { class: 'c-chord', style: { width: bs * cellW + 'px' } });
        const manual = !!song.chords[b];
        const name = orchLine ? orchLine.filter(g => g.bar === b).map(g => g.name).join('→') : chordName(chords[b], song.key || 0);
        return h('button', { class: 'c-chord' + (manual ? ' manual' : ''), style: { width: bs * cellW + 'px' }, title: ROMAN[chords[b]].ko + (manual ? ' (내가 고름)' : ' (자동) — 누르면 바꿔요'),
          onclick: () => { const order = [null, 'I', 'IV', 'V']; const cur = song.chords[b] || null; song.chords[b] = order[(order.indexOf(cur) + 1) % order.length]; dirty = true; renderGrid(); } },
          h('b', {}, name), h('small', {}, ROMAN[chords[b]].ko));
      }));
    renderCoach();
    if (lyricsOn) syncLyricInput();
    stripNow();   // [MUSIC-SCORE-1]
  }

  // ── 칸 누르기 · 길이 늘이기 ──
  const cellAt = e => {
    const r = grid.getBoundingClientRect();
    const x = e.clientX - r.left - LABEL, y = e.clientY - r.top;
    return { step: Math.floor(x / cellW), row: Math.floor(y / rowH) };
  };
  let drag = null;
  grid.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const noteEl = e.target.closest(layer === 'harm' ? '.c-note.harm' : '.c-note:not(.harm)');
    const { step, row } = cellAt(e);
    if (layer === 'harm') {
      if (noteEl) {
        const n = noteEl._h, rect = noteEl.getBoundingClientRect();
        if (!erase && e.clientX > rect.right - Math.max(10, Math.min(18, rect.width * 0.35))) { drag = { h: n, el: noteEl, kind: 'hresize' }; grid.setPointerCapture(e.pointerId); return; }
        drag = { h: n, kind: 'htap', x: e.clientX, y: e.clientY };
        return;
      }
      if (step < 0 || step >= totalSteps(song) || row < 0 || row >= rows.length || erase) return;
      const r = placeHarm(song, step, rows[row], L);
      if (r === 'full') { toast('화음은 한 자리에 세 음까지예요'); return; }
      if (r) { dirty = true; cursor = step; engine.note(song.inst, rows[row] + sh(), engine.now, 0.6, 0.7); renderGrid(); }
      return;
    }
    if (noteEl) {
      const n = noteEl._n, rect = noteEl.getBoundingClientRect();
      if (!erase && e.clientX > rect.right - Math.max(10, Math.min(18, rect.width * 0.35))) { drag = { n, el: noteEl, kind: 'resize' }; grid.setPointerCapture(e.pointerId); return; }
      drag = { n, el: noteEl, kind: 'tap', x: e.clientX, y: e.clientY };
      return;
    }
    if (step < 0 || step >= totalSteps(song) || row < 0 || row >= rows.length) return;
    if (erase) return;
    const bs = barSteps(song), barEnd = (Math.floor(step / bs) + 1) * bs;
    const n = placeNote(song, step, rows[row], Math.min(L, barEnd - step));
    dirty = true; cursor = n.s + n.d;
    engine.note(song.inst, n.p + sh(), engine.now, Math.min(0.9, n.d * 60 / song.tempo / song.sub), 0.85);
    renderGrid();
  });
  grid.addEventListener('pointermove', e => {
    if (drag && drag.kind === 'hresize') {                         // 화음 하나(같은 때 시작한 음 모두)의 길이
      const { step } = cellAt(e), n = drag.h, bs = barSteps(song);
      const barEnd = (Math.floor(n.s / bs) + 1) * bs;
      const next = song.harm.filter(x => x.s > n.s).sort((a, z) => a.s - z.s)[0];
      const d = clamp(step - n.s + 1, 1, Math.min(barEnd, next ? next.s : Infinity) - n.s);
      if (d !== n.d) { for (const x of song.harm) if (x.s === n.s) x.d = d; dirty = true; grid.querySelectorAll('.c-note.harm').forEach(el => { if (el._h.s === n.s) el.style.width = d * cellW - 2 + 'px'; }); stripSoon(); }
      return;
    }
    if (!drag || drag.kind !== 'resize') return;
    const { step } = cellAt(e), n = drag.n, bs = barSteps(song);
    const barEnd = (Math.floor(n.s / bs) + 1) * bs;
    const next = song.notes.filter(x => x.s > n.s).sort((a, z) => a.s - z.s)[0];
    const lim = Math.min(barEnd, next ? next.s : Infinity);
    const d = clamp(step - n.s + 1, 1, lim - n.s);
    if (d !== n.d) { n.d = d; drag.el.style.width = d * cellW - 2 + 'px'; dirty = true; stripSoon(); }
  });
  grid.addEventListener('pointerup', e => {
    if (!drag) return;
    const dd = drag; drag = null;
    if (dd.kind === 'tap' && Math.hypot(e.clientX - dd.x, e.clientY - dd.y) < 8) { removeNote(song, dd.n); dirty = true; }
    if (dd.kind === 'htap' && Math.hypot(e.clientX - dd.x, e.clientY - dd.y) < 8) { removeHarm(song, dd.h); dirty = true; }
    renderGrid();
  });

  // ── 노랫말 ── 글자(띄어쓰기 빼고)를 시간 순서대로 음표에 하나씩
  function applyLyrics() {
    const chars = [...lyric.value.replace(/\s+/g, '')];
    const ns = [...song.notes].sort((a, z) => a.s - z.s);
    ns.forEach((n, i) => { n.w = chars[i] || ''; });
    dirty = true;
    const hint = lyricRow.querySelector('.c-lyrichint');
    hint.textContent = chars.length > ns.length ? `글자가 ${chars.length - ns.length}개 남아요 — 음표를 더 놓거나 글자를 줄여요` : chars.length && chars.length < ns.length ? `음표 ${ns.length - chars.length}개에는 글자가 없어요` : '';
    renderGrid();
  }
  function syncLyricInput() {
    if (document.activeElement === lyric) return;
    lyric.value = [...song.notes].sort((a, z) => a.s - z.s).map(n => n.w || '').join('');
  }

  // ── 오른쪽: 반주 친구 · 느낌 · 음계 · 박자 · 악기 · 아이디어 친구 ──
  function renderSide() {
    const sel = (opts, val, on) => h('select', { onchange: e => on(e.target.value) }, ...opts.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(val)) o.selected = true; return o; }));
    const korean = SCALES[song.scale].family === 'korean';
    const orchActive = orchOn(song);   // [MUSIC-ORCH-1] 오케스트라가 반주하면 반주 친구는 쉰다
    side.replaceChildren(...[   // replaceChildren 은 null 을 'null' 글자로 넣는다 → 걸러서(장단 친구를 쉬게 했을 때 보이던 'null' 도)
      h('h3', {}, '반주 친구'),
      h('div', { class: 'band' + (orchActive ? ' resting' : '') }, ...BAND.map(b => {
        const on = b.k === 'drum' ? song.acc.drum !== 'none' : song.acc[b.k];
        const disabled = (b.k === 'bass' && korean) || orchActive;
        return h('button', { class: 'member' + (on && !disabled ? ' on' : ''), disabled, title: orchActive ? '지금은 오케스트라가 반주해요' : disabled ? '국악 느낌에서는 베이스 대신 지속음이 깔려요' : '',
          onclick: () => { if (b.k === 'drum') song.acc.drum = song.acc.drum === 'none' ? defaultDrum() : 'none'; else song.acc[b.k] = !song.acc[b.k]; dirty = true; renderSide(); renderGrid(); if (player.playing) togglePlay(true); } },
          h('img', { src: `../assets/monsters/${b.img}.png`, alt: '' }), h('b', {}, b.k === 'chord' && korean ? '지속음 친구' : b.name), h('small', {}, on && !disabled ? (b.k === 'drum' ? DRUMS[song.acc.drum] : '함께 연주 중') : '쉬는 중'));
      })),
      orchActive ? h('p', { class: 'hint band-note' }, '🎻 지금은 오케스트라가 반주해요 — 반주 친구는 쉬어요') : null,
      !orchActive && song.acc.drum !== 'none' ? h('label', { class: 'row' }, '장단', sel(Object.entries(DRUMS).filter(([k]) => k !== 'none'), song.acc.drum, v => { song.acc.drum = v; dirty = true; if (v !== 'basic' && !drumFits(v)) toast(v === 'semachi' ? '세마치 장단은 9/8 박자에서 쳐요 — 박자를 바꿔 보세요' : '굿거리 장단은 12/8 박자에서 쳐요 — 박자를 바꿔 보세요', 3200); if (player.playing) togglePlay(true); })) : null,
      orchSection(sel),
      h('h3', {}, '느낌 바꾸기'),
      h('div', { class: 'moods' }, ...Object.entries(MOODS).map(([k, m]) => h('button', { class: 'btn small' + (song.mood === k ? ' on' : ''), onclick: () => applyMood(k) }, m.name))),
      h('h3', {}, '음계'),
      sel(Object.entries(SCALES).map(([k, s]) => [k, s.name]), song.scale, v => { song.scale = v; dirty = true; if (SCALES[v].family === 'korean' && song.acc.drum === 'basic') song.acc.drum = defaultDrum(); orchRestForKorean(); layout(); renderSide(); }),
      h('p', { class: 'hint' }, SCALES[song.scale].hint),
      h('h3', {}, orchActive ? '박자 · 마디' : '박자 · 마디 · 악기'),
      h('label', { class: 'row' }, '박자', sel(METERS.map(m => [m.key, m.name]), METERS.find(m => m.beats === song.beats && m.sub === song.sub)?.key, v => changeMeter(METERS.find(m => m.key === v)))),
      h('label', { class: 'row' }, '마디', sel([[2, '2마디'], [4, '4마디'], [8, '8마디'], [12, '12마디'], [16, '16마디']], song.bars, v => changeBars(+v))),
      orchActive ? null : h('label', { class: 'row' }, '악기', instSel()),
    ].filter(Boolean));
  }
  //  [MUSIC-ORCH-1] 가락 악기 고르기 — 현악기 · 목관악기 · 금관악기 · 건반·타악기 · 목소리로 묶음 · 고르면 그 악기 소리로 한 음
  function instSel() {
    return h('select', { class: 'inst-sel', 'aria-label': '가락 악기', onchange: e => { song.inst = e.target.value; dirty = true; engine.note(song.inst, 67 + sh(), engine.now, 0.6, 0.8); if (player.playing) togglePlay(true); } },
      ...INST_GROUPS.map(([name, ks]) => h('optgroup', { label: name }, ...ks.map(k => { const o = h('option', { value: k }, INSTS[k]); if (k === song.inst) o.selected = true; return o; }))));
  }

  // ── 오케스트라 [MUSIC-ORCH-1] ──  켜기 · 편성 여섯 · 가락 악기 · 칸 일곱 · 셈여림 흐름 · 점점 느리게 끝내기 · 악기 소개
  function orchSection(sel) {
    const ok = orchOK(song), on = orchOn(song), o = song.orch;
    const sw = h('button', { class: 'oc-switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': '오케스트라 켜기', disabled: !ok, title: ok ? '' : '국악 느낌 음계에서는 쓸 수 없어요', onclick: () => orchToggle() });
    const intro = h('button', { class: 'btn small oc-intro', onclick: () => showFamilies() }, '🎼 악기 소개');
    const head = h('div', { class: 'oc-head' }, h('h3', {}, '🎻 오케스트라'), sw);
    if (!ok) return h('section', { class: 'oc' }, head, h('p', { class: 'hint' }, '국악 느낌 음계(평조 · 계면조)에서는 오케스트라 대신 지속음과 장단이 반주해요. 5음 음계나 장음계로 바꾸면 쓸 수 있어요.'), h('div', { class: 'oc-acts' }, intro));
    if (!on) return h('section', { class: 'oc' }, head, h('p', { class: 'hint' }, '가락은 그대로 두고, 바이올린 · 플루트 · 트럼펫 · 팀파니 … 오케스트라가 반주해요. 켜 보세요!'), h('div', { class: 'oc-acts' }, intro));
    const chip = k => h('button', { class: 'oc-chip f-' + PARTS[k].fam + (o.parts[k] ? ' on' : ''), 'aria-pressed': String(!!o.parts[k]), 'data-part': k, title: PARTS[k].desc,
      onclick: () => { o.parts[k] = !o.parts[k]; lastChip = k; dirty = true; renderSide(); if (player.playing) togglePlay(true); } }, PARTS[k].name);
    return h('section', { class: 'oc on' }, head,
      h('div', { class: 'oc-cards', role: 'group', 'aria-label': '편성' }, ...PRESET_KEYS.map(k => {
        const P = PRESETS[k];
        return h('button', { class: 'oc-card' + (o.preset === k ? ' on' : ''), 'data-preset': k, 'aria-pressed': String(o.preset === k), title: P.line, onclick: () => pickPreset(k) },
          h('span', { class: 'em' }, P.emoji), h('b', {}, P.name), h('small', {}, P.line));
      })),
      h('label', { class: 'row' }, '가락 악기', instSel()),
      h('div', { class: 'oc-lbl' }, '함께 연주하는 칸 — 눌러서 켜고 꺼요'),
      h('div', { class: 'oc-chips' }, ...PART_KEYS.map(chip)),
      h('p', { class: 'hint oc-chiphint' }, lastChip ? `${PARTS[lastChip].name}${o.parts[lastChip] ? ' 켬' : ' 끔'} — ${PARTS[lastChip].desc}` : '칸 위에 마우스를 올리면 무엇을 하는지 보여요'),
      h('label', { class: 'row' }, '셈여림', sel(Object.entries(DYN), o.dyn, v => { o.dyn = v; dirty = true; if (player.playing) togglePlay(true); })),
      h('div', { class: 'oc-acts' },
        h('button', { class: 'btn small oc-rit' + (o.rit ? ' on' : ''), 'aria-pressed': String(!!o.rit), title: '끝 두 마디를 점점 느리게 · 마지막 화음을 길게', onclick: () => { o.rit = !o.rit; dirty = true; renderSide(); if (player.playing) togglePlay(true); } }, '🐢 점점 느리게 끝내기'),
        intro));
  }
  function orchToggle() {
    if (!orchOK(song)) return;
    if (!song.orch.on) {
      beforeOrch = { inst: song.inst, reverb: song.reverb };
      const fresh = JSON.stringify(song.orch) === JSON.stringify(defaultOrch(song.orch.preset));   // 처음 켬 = 편성 기본(가락 악기 · 칸 · 울림)
      if (fresh || !lastOrch) applyPreset(song, song.orch.preset);
      else { song.orch.on = true; song.inst = lastOrch.inst; song.reverb = lastOrch.reverb; }
      dirty = true; engine.setReverb(song.reverb); renderSide(); renderGrid();
      explainPreset(song.orch.preset, true);
    } else {
      lastOrch = { inst: song.inst, reverb: song.reverb };
      song.orch.on = false;
      if (beforeOrch) { song.inst = beforeOrch.inst; song.reverb = beforeOrch.reverb; beforeOrch = null; }
      dirty = true; engine.setReverb(song.reverb); renderSide(); renderGrid();
      if (player.playing) togglePlay(true);
      toast('오케스트라를 껐어요 — 반주 친구가 다시 함께해요');
    }
  }
  function pickPreset(k) {
    if (!song.orch.on) beforeOrch = { inst: song.inst, reverb: song.reverb };
    applyPreset(song, k); dirty = true; engine.setReverb(song.reverb);
    renderSide(); renderGrid();
    explainPreset(k, false);
  }
  //  무엇이 바뀌었나(느낌 바꾸기처럼) — 가락은 그대로 · 바뀐 악기 · 칸 · 울림 · 끝맺기 + 이 곡 박자 · 빠르기에 맞는 귀띔 한 줄
  function explainPreset(k, first) {
    const P = PRESETS[k];
    const tip = k === 'waltz' && song.beats !== 3 ? `왈츠는 세 박자(3/4)에서 가장 왈츠다워요 — 지금은 ${song.beats}박이라 '쿵 짝'으로 쳐요.`
      : k === 'march' && song.beats === 3 ? '행진곡은 두 박이나 네 박이 발맞추기 좋아요(박자 바꾸기).'
      : k === 'march' && song.tempo < 100 ? '행진곡은 빠르기를 110쯤으로 올리면 더 씩씩해요(위 빠르기 +).'
      : k === 'film' && song.tempo > 120 ? '영화 음악은 느릴수록 넓게 들려요(위 빠르기 −).' : '';
    const on = Object.entries(song.orch.parts).filter(([, v]) => v).map(([x]) => PARTS[x].name);
    modal(first ? `🎻 오케스트라가 함께해요 — ${P.emoji} ${P.name}` : `${P.emoji} '${P.name}'(으)로 바꿨어요`, h('div', { class: 'oc-why' },
      h('p', {}, '가락(음 높이와 리듬)은 그대로예요. 바뀐 것은:'),
      h('p', { class: 'why' }, P.why),
      h('p', { class: 'muted' }, `가락 악기 = ${INSTS[P.lead]} · 함께하는 칸 = ${on.join(' · ') || '없음'} · ${P.rit ? '끝에서 점점 느리게' : '끝까지 같은 빠르기'}`),
      tip ? h('p', { class: 'oc-tip' }, '💡 ' + tip) : null,
      h('p', { class: 'muted' }, '칸을 켜고 끄며 들어 보세요. 반주 친구는 오케스트라가 쉬면 다시 나와요.')),
      [{ label: '닫기' }, { label: '▶ 들어 보기', primary: true, onclick: c => { c(); togglePlay(true); } }]);
  }
  //  국악 느낌 음계로 바꾸면 오케스트라는 쉰다(되돌리면 다시 켜면 됨)
  function orchRestForKorean() {
    if (song.orch.on && !orchOK(song)) {
      song.orch.on = false;
      if (beforeOrch) { song.inst = beforeOrch.inst; song.reverb = beforeOrch.reverb; beforeOrch = null; }
      toast('국악 느낌 음계에서는 오케스트라 대신 지속음과 장단이 반주해요', 3200);
    }
  }
  //  악기 소개 — 가족(현악기 · 목관악기 · 금관악기 · 건반·타악기 · 목소리) 칸을 눌러 보고 ▶ 로 짧은 소리 · 가락 악기로 고르기
  function showFamilies() {
    if (player.playing) { player.stop(); stopHead(); }
    const sp = new Player(engine);
    let fam = FAMILIES.find(f => f.items.some(x => x[0] === song.inst))?.key || 'str', nowBtn = null;
    const tabs = h('div', { class: 'fam-tabs', role: 'tablist' }), body = h('div', { class: 'fam-body' });
    const play = (k, btn) => {
      if (nowBtn) nowBtn.classList.remove('stop');
      if (nowBtn === btn && sp.playing) { sp.stop(); nowBtn = null; return; }
      engine.ensure(); engine.setReverb(0.22);
      const ev = samplePhrase(k), end = Math.max(...ev.map(e => e.t + (e.d || 0.6))) + 0.4;
      sp.start(ev, { total: end, onEnd: () => { btn.classList.remove('stop'); if (nowBtn === btn) nowBtn = null; engine.setReverb(song.reverb); } });
      nowBtn = btn; btn.classList.add('stop');
    };
    const draw = () => {
      tabs.replaceChildren(...FAMILIES.map(f => h('button', { class: 'btn small' + (f.key === fam ? ' on' : ''), role: 'tab', 'aria-selected': String(f.key === fam), style: { '--fc': f.color }, onclick: () => { fam = f.key; draw(); } }, f.emoji + ' ' + f.name)));
      const f = FAMILIES.find(x => x.key === fam);
      body.replaceChildren(h('p', { class: 'fam-how' }, f.how),
        h('div', { class: 'fam-list', style: { '--fc': f.color } }, ...f.items.map(([k, name, line]) => {
          const b = h('button', { class: 'play-i', title: name + ' 소리 듣기', 'aria-label': name + ' 소리 듣기', 'data-sample': k, onclick: () => play(k, b) });
          const lead = INSTS[k] ? h('button', { class: 'btn small' + (song.inst === k ? ' on' : ''), title: '이 악기로 가락을 연주해요', onclick: () => { song.inst = k; dirty = true; toast(`가락 악기 = ${name}`); renderSide(); draw(); } }, song.inst === k ? '가락 악기' : '가락으로') : null;
          return h('div', { class: 'fam-item' }, b, h('div', { class: 'fam-t' }, h('b', {}, name), h('span', {}, line)), lead);
        })));
    };
    draw();
    modal('🎼 오케스트라 악기 소개', h('div', { class: 'fam-wrap' }, h('p', { class: 'muted' }, '오케스트라는 악기 가족 넷이 함께 연주해요. ▶ 를 눌러 소리를 들어 보세요.'), tabs, body),
      [{ label: '닫기', primary: true }], { wide: true, onclose: () => { sp.stop(); engine.setReverb(song.reverb); } });
  }
  const drumFits = k => (k === 'semachi' && song.beats === 3 && song.sub === 3) || (k === 'gutgeori' && song.beats === 4 && song.sub === 3);
  const defaultDrum = () => drumFits('semachi') ? 'semachi' : drumFits('gutgeori') ? 'gutgeori' : 'basic';
  function applyMood(k) {
    const wasOrch = orchOn(song);
    MOODS[k].apply(song); song.mood = k; dirty = true;
    orchRestForKorean();   // [MUSIC-ORCH-1] '쓸쓸하게'(계면조)면 오케스트라는 쉼
    engine.setReverb(song.reverb);
    tempoV.textContent = song.tempo;
    layout(); renderSide();
    const orchLine = wasOrch ? (orchOn(song) ? `🎻 오케스트라는 그대로 반주해요 — 가락 악기만 ${INSTS[song.inst]}(으)로 바뀌었어요(반주 친구 설정은 오케스트라를 끄면 들려요).` : '🎻 국악 느낌 음계라서 오케스트라는 쉬고, 반주 친구가 나와요.') : '';
    modal(`'${MOODS[k].name}' 느낌으로 바꿨어요`, h('div', {}, h('p', {}, '가락(음 높이)은 그대로예요. 바뀐 것은:'), h('p', { class: 'why' }, MOODS[k].why), orchLine ? h('p', { class: 'oc-tip' }, orchLine) : null, h('p', { class: 'muted', style: { marginTop: '8px' } }, '같은 가락이라도 빠르기 · 소리 · 울림 · 음계가 바뀌면 느낌이 달라져요. 들어 보세요!')),
      [{ label: '▶ 들어 보기', primary: true, onclick: c => { c(); togglePlay(true); } }]);
  }
  function changeMeter(m) {
    if (!m || (m.beats === song.beats && m.sub === song.sub)) return;
    const go = () => {
      song.beats = m.beats; song.sub = m.sub; song.notes = []; song.chords = []; L = 1;
      if (m.jangdan) song.acc.drum = m.jangdan; else if (song.acc.drum !== 'none') song.acc.drum = 'basic';
      dirty = true; renderTools(); layout(); renderSide();
    };
    if (song.notes.length) modal('박자를 바꿀까요?', '박자가 바뀌면 칸이 달라져서 놓은 음을 지워요.', [{ label: '그만두기', onclick: c => { c(); renderSide(); } }, { label: '바꾸기', primary: true, onclick: c => { c(); go(); } }]);
    else go();
  }
  function changeBars(n) {
    const keep = n * barSteps(song);
    const lost = song.notes.filter(x => x.s >= keep).length;
    const go = () => { song.bars = n; song.notes = song.notes.filter(x => x.s < keep).map(x => ({ ...x, d: Math.min(x.d, keep - x.s) })); song.chords = song.chords.slice(0, n); dirty = true; layout(); renderSide(); };
    if (lost) modal('마디를 줄일까요?', `뒤쪽 음 ${lost}개가 지워져요.`, [{ label: '그만두기', onclick: c => { c(); renderSide(); } }, { label: '줄이기', primary: true, onclick: c => { c(); go(); } }]);
    else go();
  }

  // ── 코치 ──
  function renderCoach() {
    const tips = coach(song);
    coachBox.replaceChildren(h('img', { src: '../assets/monsters/m27.png', alt: '' }),
      h('div', { class: 'c-tips' }, ...tips.map(t => h('p', { class: t.kind }, t.text))),
      h('button', { class: 'btn idea', onclick: () => showIdeas() }, h('img', { src: '../assets/monsters/m1.png', alt: '' }), h('span', {}, h('b', {}, '아이디어 친구'), h('small', {}, '다음 마디 같이 지어 볼까?'))));
  }
  // ── 아이디어 친구 ──
  function showIdeas() {
    const r = ideas(song, scaleRows(song.scale, song.notes));
    if (!r) { modal('아이디어 친구', song.notes.length ? '이어서 지을 빈 마디가 없어요. 마디를 늘리거나(오른쪽 \'마디\'), 마디 하나를 비워 보세요.' : '먼저 첫 마디에 음을 몇 개 놓아 주세요. 그걸 보고 다음 마디를 같이 생각해 볼게요.'); return; }
    let close = null;
    const listen = o => { const tmp = { ...song, notes: [...song.notes.filter(n => Math.floor(n.s / barSteps(song)) === r.bar - 1), ...o.notes] }; const b = buildEvents(tmp, { chord: false, bass: false, drum: 'none', orch: false }); const off = (r.bar - 1) * barSteps(song) * b.stepDur; player.start(b.events.filter(e => e.t >= off - 1e-6).map(e => ({ ...e, t: e.t - off })), { total: b.total - off }); };
    close = modal(`${r.bar + 1}마디를 같이 지어 볼까?`, h('div', { class: 'ideas' },
      h('p', { class: 'muted' }, `${r.bar}마디를 보고 생각한 것들이에요. 들어 보고 마음에 드는 것을 넣은 다음, 마음대로 고쳐도 돼요.`),
      ...r.options.map(o => h('div', { class: 'idea-row' }, h('div', {}, h('b', {}, o.name), h('span', { class: 'muted' }, o.why)),
        h('button', { class: 'btn small', onclick: () => listen(o) }, '▶ 들어 보기'),
        h('button', { class: 'btn small primary', onclick: () => { for (const n of o.notes) placeNote(song, n.s, n.p, n.d); dirty = true; player.stop(); close(); layout(); } }, '넣기')))),
      [{ label: '닫기', onclick: c => { player.stop(); c(); } }], { onclose: () => player.stop() });
  }
  // ── 악보 · 운지 ──
  function showStaff() {
    const w = Math.min(1060, innerWidth - 80);
    const { el } = renderStaff(song, { width: w - 10 });
    const note = h('p', { class: 'muted', style: { marginTop: '8px' } }, `음 아래 색 글자 = 계이름(다장조) · 위 빨간 글자 = 화음 · ${valueName(L, song.sub) ? '음 길이는 칸 수대로 음표가 돼요' : ''}`);
    //  [MUSIC-SCORE-1] 오케스트라가 켜져 있으면 '가락 악보 | 오케스트라 총보' 두 칸 — 인쇄는 보고 있는 칸
    const tabs = orchOn(song) ? scoreTabs(song, el, w - 10, note) : null;
    modal(song.title || '내 곡', tabs ? tabs.body : h('div', { class: 'staff-wrap' }, el, note),
      [{ label: '인쇄', onclick: () => printStaff(tabs ? tabs.current() : el) }, { label: '닫기', primary: true }], { wide: true });
  }
  function printStaff(el) {
    const w = window.open('', '_blank');
    if (!w) { toast('새 창이 막혀 있어요'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${(song.title || '내 곡').replace(/</g, '')}</title><link rel="stylesheet" href="${(document.querySelector('link[href*="music.css"]') || {}).href || new URL('css/music.css', location.href)}"><style>body{background:#fff;color:#000;overflow:auto;padding:24px}h1{font:900 22px 'Noto Sans KR',sans-serif;margin-bottom:12px}</style><h1></h1>`);
    w.document.querySelector('h1').textContent = (song.title || '내 곡') + (ctx.store.me.name ? ' — ' + ctx.store.me.name : '');
    w.document.body.append(w.document.importNode(el, true));
    setTimeout(() => w.print(), 400);
  }
  function showFingers() {
    const ns = [...song.notes].sort((a, z) => a.s - z.s);
    if (!ns.length) { toast('먼저 음을 놓아 주세요'); return; }
    const sys = ctx.sys();
    const ok = recorderOK(song, sys);
    modal('리코더로 불어 볼까?', h('div', {},
      h('div', { class: 'fingers' }, ...ns.slice(0, 32).map((n, i) => h('div', { class: 'fg' }, fingerSVG(n.p, { size: 128, sys, prev: ns[i - 1]?.p, label: false }), h('b', { style: { color: colorOf(n.p) } }, solfege(n.p))))),
      ns.length > 32 ? h('p', { class: 'muted' }, `앞의 32음만 보여요(모두 ${ns.length}음).`) : null,
      h('p', { class: 'muted' }, `노란 테두리 = 앞 음에서 바뀌는 구멍 · ${sys === 'german' ? '저먼식' : '바로크식'} 운지${ok ? '' : ' · 리코더로 불 수 없는 음이 있어요'}`)),
      [{ label: '닫기' }, ok ? { label: '리코더 연습하기', primary: true, onclick: c => { c(); ctx.openPractice(song); } } : null].filter(Boolean), { wide: true });
  }

  // ── 재생 ──
  function togglePlay(restart = false) {
    if (player.playing && !restart) { player.stop(); stopHead(); return; }
    engine.ensure(); engine.setReverb(song.reverb);
    built = buildEvents(song, { orchFinale: true });   // [MUSIC-ORCH-1] 오케스트라 곡이면 '점점 느리게 끝내기'까지
    playStart = player.start(built.events, { total: built.total, onEnd: () => stopHead() });
    playBtn.textContent = '■ 멈추기';
    cancelAnimationFrame(raf);
    const head = () => {
      const el = grid.querySelector('#c-head');
      if (!player.playing) return;
      const t = engine.now - playStart, step = built.stepAt ? built.stepAt(t) : t / built.stepDur;   // 늘인 끝 두 마디도 소리를 따라감
      if (el && step >= 0) { el.style.display = 'block'; el.style.left = LABEL + step * cellW + 'px'; }
      //  [MUSIC-SHOWCASE-1] 화음 칸 음(.c-note.harm)은 _h — 예전엔 _n 만 읽어 화음 칸이 있는 곡을 ▶ 하면 첫 그림에서 TypeError(재생 막대 · 지금 음 빛이 멈춤)
      grid.querySelectorAll('.c-note').forEach(nel => { const n = nel._n || nel._h; if (n) nel.classList.toggle('now', step >= n.s && step < n.s + n.d); });
      if (scoreOn) strip.highlight(step);   // [MUSIC-SCORE-1] 악보 띠도 울리는 음이 빛남
      raf = requestAnimationFrame(head);
    };
    raf = requestAnimationFrame(head);
  }
  function stopHead() {
    cancelAnimationFrame(raf); playBtn.textContent = '▶ 들어 보기';
    const el = grid.querySelector('#c-head'); if (el) el.style.display = 'none';
    grid.querySelectorAll('.c-note.now').forEach(n => n.classList.remove('now'));
    strip.highlight(null);
  }

  // ── 저장 ──
  function saveDialog(after) {
    if (!song.notes.length) { toast('음을 하나 이상 놓아야 저장할 수 있어요'); return; }
    const t = h('input', { value: song.title, maxlength: 30, placeholder: '곡 제목', style: { width: '100%' } });
    const pub = h('input', { type: 'checkbox' }); pub.checked = !!song.pub;
    const warn = h('p', { class: 'save-warn', style: { display: 'none' } });
    modal('곡 저장하기', h('div', { class: 'save' },
      h('label', {}, h('b', {}, '제목'), t),
      h('label', { class: 'chk' }, pub, h('span', {}, h('b', {}, '우리 반 음악회에 올리기'), h('small', { class: 'muted' }, '친구들이 듣고, 내 곡으로 리듬 게임 · 리코더 연습도 할 수 있어요'))),
      ctx.store.me.guest ? h('p', { class: 'muted' }, '손님으로 열어서 이 기기에만 저장돼요. RPG 에서 열면 내 이름으로 저장돼요.') : null, warn),
      [{ label: '그만두기' }, { label: '저장', primary: true, onclick: async c => {
        const nt = (t.value || '').trim().slice(0, 30) || '제목 없는 곡';
        // [MUSIC-SAFE-1] 음악회는 반 친구 모두가 보는 곳 — 고운 말이 아니면 올리지 않는다(나만 보기 저장은 된다)
        const bad = songBad({ ...song, title: nt });
        if (pub.checked && (bad.title.length || bad.lyrics.length)) {
          warn.style.display = '';
          warn.textContent = '음악회는 반 친구 모두가 보는 곳이에요. 고운 말로 바꿔 주세요 — ' + [bad.title.length ? '제목: ' + bad.title.map(hidden).join(', ') : '', bad.lyrics.length ? '노랫말: ' + bad.lyrics.map(hidden).join(', ') : ''].filter(Boolean).join(' · ') + ' (음악회에 올리지 않으면 나만 보기로 저장돼요)';
          return;
        }
        song.title = nt; title.value = song.title; song.pub = pub.checked;
        try { await ctx.store.saveSong(song); dirty = false; c(); toast(song.pub ? '저장했어요 · 우리 반 음악회에 올렸어요' : '저장했어요'); ctx.replaceRef(ctx.refOf(song)); after && after(); }
        catch (e) { console.warn(e); toast('저장하지 못했어요 — 인터넷을 확인해 주세요', 3200); }
      } }]);
    setTimeout(() => t.focus(), 50);
  }
  function leave() {
    if (!dirty || !song.notes.length) { ctx.go('#/'); return; }
    modal('저장하지 않고 나갈까요?', '고친 것이 저장되지 않았어요.', [
      { label: '나가기', onclick: c => { dirty = false; c(); ctx.go('#/'); } },
      { label: '저장하고 나가기', primary: true, onclick: c => { c(); saveDialog(() => ctx.go('#/')); } }]);
  }

  renderTools(); renderSide();
  requestAnimationFrame(layout);
  //  [MUSIC-SHOWCASE-1] 예시 곡 — 작품 노트(어떻게 만들었나 · 해 볼 것) → ▶ 들어 보기
  const ex = exKey && EX_SONGS.find(x => x.key === exKey);
  if (ex) setTimeout(() => {
    if (!root.isConnected) return;
    modal(`${ex.em} ${ex.title}`, h('div', { class: 'ex-note' },
      h('p', { class: 'muted' }, `${ex.kind} · 만든 사람: ${EX_BY} · ${song.bars}마디 · 빠르기 ${song.tempo}`),
      h('h4', {}, '🛠 이렇게 만들었어요'), h('ul', {}, ...ex.notes.map(t => h('li', {}, t))),
      h('h4', {}, '🙋 이렇게 바꿔 봐요'), h('ul', {}, ...ex.tryIt.map(t => h('li', {}, t))),
      h('p', { class: 'muted' }, '바꾼 다음 \'저장\'하면 내 곡이 돼요(예시는 그대로 남아요).')),
      [{ label: '닫기' }, { label: '▶ 들어 보기', primary: true, onclick: c => { c(); togglePlay(true); } }], { wide: true });
  }, 60);
  const onResize = () => layout();
  addEventListener('resize', onResize);
  // [MUSIC-KEYS-1] 키보드로 작곡 — 리듬 게임과 같은 자리: A S D F J K L ; = 도 레 미 파 솔 라 시 높은 도 (Shift = 한 옥타브 위)
  //   스페이스 = 쉼(커서를 음 길이만큼) · Backspace = 앞 음 지우기 · ← → = 한 칸 · 1~6 = 음 길이 · Tab = 가락/화음 칸 · Enter = 들어 보기
  const KEY_P = { KeyA: 60, KeyS: 62, KeyD: 64, KeyF: 65, KeyJ: 67, KeyK: 69, KeyL: 71, Semicolon: 72 };
  const onKey = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.querySelector('.modal-wrap')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const total = totalSteps(song), bs = barSteps(song);
    if (e.code === 'Enter') { e.preventDefault(); togglePlay(); return; }
    if (e.code === 'Tab') { e.preventDefault(); setLayer(layer === 'mel' ? 'harm' : 'mel'); return; }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); cursor = clamp(cursor + (e.code === 'ArrowRight' ? 1 : -1), 0, total); renderGrid(); return; }
    if (/^Digit[1-6]$/.test(e.code)) { const d = lengthChoices(song.sub)[+e.code.slice(5) - 1]; if (d) { L = d; erase = false; renderTools(); } return; }
    if (e.code === 'Space') { e.preventDefault(); cursor = Math.min(total, layer === 'mel' ? cursor + L : nextMelStart()); renderGrid(); return; }
    if (e.code === 'Backspace') { e.preventDefault(); backspace(); return; }
    const base = KEY_P[e.code];
    if (base == null || e.repeat) return;
    e.preventDefault();
    const p = Math.min(84, base + (e.shiftKey ? 12 : 0));
    if (cursor >= total) { toast('곡 끝이에요 — 마디를 늘리거나 ← 로 돌아가요'); return; }
    if (layer === 'harm') {
      const r = placeHarm(song, cursor, p, L);
      if (r === 'full') { toast('화음은 한 자리에 세 음까지예요'); return; }
      engine.note(song.inst, p + sh(), engine.now, 0.6, 0.7); dirty = true; layout(); return;
    }
    const n = placeNote(song, cursor, p, Math.min(L, (Math.floor(cursor / bs) + 1) * bs - cursor));
    engine.note(song.inst, p + sh(), engine.now, Math.min(0.9, n.d * 60 / song.tempo / song.sub), 0.85);
    cursor = n.s + n.d; dirty = true; layout();
  };
  // 화음 칸에서 스페이스 = 다음 가락 음 자리로(가락 음마다 화음을 쌓기 좋게)
  const nextMelStart = () => { const nx = song.notes.filter(n => n.s > cursor).sort((a, z) => a.s - z.s)[0]; return nx ? nx.s : cursor + L; };
  function backspace() {
    if (layer === 'harm') {
      const at = song.harm.filter(n => n.s <= cursor).sort((a, z) => z.s - a.s || z.p - a.p)[0];
      if (at) { removeHarm(song, at); cursor = at.s; dirty = true; renderGrid(); }
      return;
    }
    const prev = song.notes.filter(n => n.s < cursor).sort((a, z) => z.s - a.s)[0];
    if (prev) { removeNote(song, prev); cursor = prev.s; dirty = true; } else cursor = 0;
    renderGrid();
  }
  function showKeys() {
    modal('키보드로 작곡하기', h('div', { class: 'keys-help' },
      h('div', { class: 'kh-row' }, ...['A 도', 'S 레', 'D 미', 'F 파', 'J 솔', 'K 라', 'L 시', '; 높은 도'].map(t => { const [k, n] = t.split(' '); return h('span', { class: 'kh-key' }, h('b', {}, k), n + (t.split(' ')[2] ? ' ' + t.split(' ')[2] : '')); })),
      h('p', {}, h('b', {}, 'Shift'), ' + 글쇠 = 한 옥타브 위(높은 레 · 높은 미 …)'),
      h('p', {}, h('b', {}, '스페이스'), ' = 쉼(음 길이만큼 건너뛰기) · ', h('b', {}, 'Backspace'), ' = 앞 음 지우기 · ', h('b', {}, '← →'), ' = 한 칸 옮기기'),
      h('p', {}, h('b', {}, '1 ~ 6'), ' = 음 길이 고르기 · ', h('b', {}, 'Tab'), ' = 가락 칸 / 화음 칸 · ', h('b', {}, 'Enter'), ' = 들어 보기 / 멈추기'),
      h('p', { class: 'muted' }, '노란 세로줄이 음이 놓일 자리예요. 칸을 누르면 그 뒤로 옮겨 가요.')));
  }
  addEventListener('keydown', onKey);
  const beforeUnload = e => { if (dirty && song.notes.length) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', beforeUnload);
  return {
    unmount() { player.stop(); cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('keydown', onKey); removeEventListener('beforeunload', beforeUnload); },
    isDirty: () => dirty && song.notes.length > 0,
  };
}
