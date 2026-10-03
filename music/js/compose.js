// 작곡 — 칸을 눌러 음을 놓고(음 길이를 골라서), 반주 친구와 함께 들어 보고, 악보·운지로 확인하고, 저장한다.
import { h, toast, modal, clamp } from './util.js';
import { SCALES, METERS, solfege, colorOf, scaleRows, barSteps, totalSteps, lengthChoices, valueName, beatsText, fitChords, chordName, ROMAN, pc } from './theory.js';
import { emptySong, normalize, placeNote, removeNote, buildEvents, INSTS, DRUMS } from './song.js';
import { engine, Player } from './audio.js';
import { renderStaff } from './notation.js';
import { coach, ideas } from './coach.js';
import { fingerSVG, recorderOK } from './recorder.js';
import { songBad, hidden } from './safety.js';

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
  let song = normalize(init || emptySong());
  if (init && init.lib) { song.title = init.title + ' 바꿔 쓰기'; song.id = null; delete song.lib; delete song.lk; delete song.pub; }
  let dirty = false, L = song.sub === 3 ? 3 : 2, erase = false, lyricsOn = song.notes.some(n => n.w);
  const player = new Player(engine);
  let raf = 0, playStart = 0, built = null;

  // ── 윗줄 ──
  const title = h('input', { class: 'c-title', placeholder: '곡 제목', maxlength: 30, value: song.title, oninput: () => { song.title = title.value; dirty = true; } });
  const playBtn = h('button', { class: 'btn primary', onclick: () => togglePlay() }, '▶ 들어 보기');
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
  const gridWrap = h('div', { class: 'c-gridwrap' }, chordRow, grid);
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
    tools.replaceChildren(
      h('span', { class: 'c-lbl' }, '음 길이'),
      ...lengthChoices(song.sub).map(d => h('button', { class: 'btn small len' + (!erase && L === d ? ' on' : ''), title: (valueName(d, song.sub) || '') + ' · ' + beatsText(d, song.sub),
        onclick: () => { L = d; erase = false; renderTools(); } }, h('i', {}, NOTE_ICON[d] || '♩'), beatsText(d, song.sub))),
      h('button', { class: 'btn small' + (erase ? ' on' : ''), onclick: () => { erase = !erase; renderTools(); } }, '지우개'),
      h('span', { class: 'sp' }),
      h('button', { class: 'btn small' + (lyricsOn ? ' on' : ''), onclick: () => { lyricsOn = !lyricsOn; renderTools(); layout(); } }, '노랫말'),
      h('button', { class: 'btn small', onclick: () => showStaff() }, '악보 보기'),
      h('button', { class: 'btn small', onclick: () => showFingers() }, '리코더 운지'),
      h('button', { class: 'btn small', onclick: () => { if (!song.notes.length) return; modal('모두 지울까요?', '놓은 음을 전부 지워요.', [{ label: '그만두기' }, { label: '모두 지우기', primary: true, onclick: c => { song.notes = []; dirty = true; c(); renderGrid(); } }]); } }, '모두 지우기'));
  }

  function layout() {
    rows = scaleRows(song.scale, song.notes).reverse();      // 위가 높은 음
    lyricRow.style.display = lyricsOn ? '' : 'none';
    const avW = Math.max(400, main.clientWidth - 8), avH = Math.max(200, root.clientHeight - 50 - 46 - 34 - (lyricsOn ? 44 : 0) - 74);
    const steps = totalSteps(song);
    cellW = clamp(Math.floor((avW - LABEL) / steps), 16, 46);
    rowH = clamp(Math.floor(avH / rows.length), 22, 40);
    renderGrid();
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
      kids.push(h('button', { class: 'c-lab' + (p >= 72 ? ' hi' : ''), style: { top: r * rowH + 'px', height: rowH + 'px', '--c': colorOf(p) }, title: solfege(p), onclick: () => engine.note(song.inst, p, engine.now, 0.5, 0.8) },
        h('i', {}), h('span', {}, solfege(p, { short: true }))));
    });
    song.notes.forEach(n => {
      const r = rows.indexOf(n.p);
      if (r < 0) return;
      const el = h('div', { class: 'c-note', style: { left: LABEL + n.s * cellW + 1 + 'px', top: r * rowH + 2 + 'px', width: n.d * cellW - 2 + 'px', height: rowH - 4 + 'px', '--c': colorOf(n.p) } },
        h('span', {}, n.w || (n.d * cellW >= 30 ? solfege(n.p, { short: true }) : '')), h('i', { class: 'grip' }));
      el._n = n;
      kids.push(el);
    });
    kids.push(h('div', { class: 'c-head', id: 'c-head' }));
    grid.replaceChildren(...kids);
    // 화음 이름(화음 친구가 켜졌을 때) — 누르면 I → IV → V → 자동
    const chords = fitChords(song, song.chords), korean = SCALES[song.scale].family === 'korean';
    chordRow.style.width = W + 'px';
    chordRow.replaceChildren(h('span', { class: 'c-chordlbl', style: { width: LABEL + 'px' } }, korean ? '지속음' : song.acc.chord ? '화음' : ''),
      ...Array.from({ length: song.bars }, (_, b) => {
        if (korean) return h('span', { class: 'c-chord drone', style: { width: bs * cellW + 'px' } }, b === 0 ? (song.scale === 'pyeong' ? '솔 + 레' : '라 + 미') : '');
        if (!song.acc.chord) return h('span', { class: 'c-chord', style: { width: bs * cellW + 'px' } });
        const manual = !!song.chords[b];
        return h('button', { class: 'c-chord' + (manual ? ' manual' : ''), style: { width: bs * cellW + 'px' }, title: ROMAN[chords[b]].ko + (manual ? ' (내가 고름)' : ' (자동) — 누르면 바꿔요'),
          onclick: () => { const order = [null, 'I', 'IV', 'V']; const cur = song.chords[b] || null; song.chords[b] = order[(order.indexOf(cur) + 1) % order.length]; dirty = true; renderGrid(); } },
          h('b', {}, chordName(chords[b], song.key || 0)), h('small', {}, ROMAN[chords[b]].ko));
      }));
    renderCoach();
    if (lyricsOn) syncLyricInput();
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
    const noteEl = e.target.closest('.c-note');
    const { step, row } = cellAt(e);
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
    dirty = true;
    engine.note(song.inst, n.p, engine.now, Math.min(0.9, n.d * 60 / song.tempo / song.sub), 0.85);
    renderGrid();
  });
  grid.addEventListener('pointermove', e => {
    if (!drag || drag.kind !== 'resize') return;
    const { step } = cellAt(e), n = drag.n, bs = barSteps(song);
    const barEnd = (Math.floor(n.s / bs) + 1) * bs;
    const next = song.notes.filter(x => x.s > n.s).sort((a, z) => a.s - z.s)[0];
    const lim = Math.min(barEnd, next ? next.s : Infinity);
    const d = clamp(step - n.s + 1, 1, lim - n.s);
    if (d !== n.d) { n.d = d; drag.el.style.width = d * cellW - 2 + 'px'; dirty = true; }
  });
  grid.addEventListener('pointerup', e => {
    if (!drag) return;
    const dd = drag; drag = null;
    if (dd.kind === 'tap' && Math.hypot(e.clientX - dd.x, e.clientY - dd.y) < 8) { removeNote(song, dd.n); dirty = true; }
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
    side.replaceChildren(
      h('h3', {}, '반주 친구'),
      h('div', { class: 'band' }, ...BAND.map(b => {
        const on = b.k === 'drum' ? song.acc.drum !== 'none' : song.acc[b.k];
        const disabled = b.k === 'bass' && korean;
        return h('button', { class: 'member' + (on && !disabled ? ' on' : ''), disabled, title: disabled ? '국악 느낌에서는 베이스 대신 지속음이 깔려요' : '',
          onclick: () => { if (b.k === 'drum') song.acc.drum = song.acc.drum === 'none' ? defaultDrum() : 'none'; else song.acc[b.k] = !song.acc[b.k]; dirty = true; renderSide(); renderGrid(); if (player.playing) togglePlay(true); } },
          h('img', { src: `../assets/monsters/${b.img}.png`, alt: '' }), h('b', {}, b.k === 'chord' && korean ? '지속음 친구' : b.name), h('small', {}, on && !disabled ? (b.k === 'drum' ? DRUMS[song.acc.drum] : '함께 연주 중') : '쉬는 중'));
      })),
      song.acc.drum !== 'none' ? h('label', { class: 'row' }, '장단', sel(Object.entries(DRUMS).filter(([k]) => k !== 'none'), song.acc.drum, v => { song.acc.drum = v; dirty = true; if (v !== 'basic' && !drumFits(v)) toast(v === 'semachi' ? '세마치 장단은 9/8 박자에서 쳐요 — 박자를 바꿔 보세요' : '굿거리 장단은 12/8 박자에서 쳐요 — 박자를 바꿔 보세요', 3200); if (player.playing) togglePlay(true); })) : null,
      h('h3', {}, '느낌 바꾸기'),
      h('div', { class: 'moods' }, ...Object.entries(MOODS).map(([k, m]) => h('button', { class: 'btn small' + (song.mood === k ? ' on' : ''), onclick: () => applyMood(k) }, m.name))),
      h('h3', {}, '음계'),
      sel(Object.entries(SCALES).map(([k, s]) => [k, s.name]), song.scale, v => { song.scale = v; dirty = true; if (SCALES[v].family === 'korean' && song.acc.drum === 'basic') song.acc.drum = defaultDrum(); layout(); renderSide(); }),
      h('p', { class: 'hint' }, SCALES[song.scale].hint),
      h('h3', {}, '박자 · 마디 · 악기'),
      h('label', { class: 'row' }, '박자', sel(METERS.map(m => [m.key, m.name]), METERS.find(m => m.beats === song.beats && m.sub === song.sub)?.key, v => changeMeter(METERS.find(m => m.key === v)))),
      h('label', { class: 'row' }, '마디', sel([[2, '2마디'], [4, '4마디'], [8, '8마디'], [12, '12마디'], [16, '16마디']], song.bars, v => changeBars(+v))),
      h('label', { class: 'row' }, '악기', sel(Object.entries(INSTS), song.inst, v => { song.inst = v; dirty = true; engine.note(v, 67, engine.now, 0.5, 0.8); })),
    );
  }
  const drumFits = k => (k === 'semachi' && song.beats === 3 && song.sub === 3) || (k === 'gutgeori' && song.beats === 4 && song.sub === 3);
  const defaultDrum = () => drumFits('semachi') ? 'semachi' : drumFits('gutgeori') ? 'gutgeori' : 'basic';
  function applyMood(k) {
    MOODS[k].apply(song); song.mood = k; dirty = true;
    engine.setReverb(song.reverb);
    tempoV.textContent = song.tempo;
    layout(); renderSide();
    modal(`'${MOODS[k].name}' 느낌으로 바꿨어요`, h('div', {}, h('p', {}, '가락(음 높이)은 그대로예요. 바뀐 것은:'), h('p', { class: 'why' }, MOODS[k].why), h('p', { class: 'muted', style: { marginTop: '8px' } }, '같은 가락이라도 빠르기 · 소리 · 울림 · 음계가 바뀌면 느낌이 달라져요. 들어 보세요!')),
      [{ label: '▶ 들어 보기', primary: true, onclick: c => { c(); togglePlay(true); } }]);
  }
  function changeMeter(m) {
    if (!m || (m.beats === song.beats && m.sub === song.sub)) return;
    const go = () => {
      song.beats = m.beats; song.sub = m.sub; song.notes = []; song.chords = []; L = m.sub === 3 ? 3 : 2;
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
    const listen = o => { const tmp = { ...song, notes: [...song.notes.filter(n => Math.floor(n.s / barSteps(song)) === r.bar - 1), ...o.notes] }; const b = buildEvents(tmp, { chord: false, bass: false, drum: 'none' }); const off = (r.bar - 1) * barSteps(song) * b.stepDur; player.start(b.events.filter(e => e.t >= off - 1e-6).map(e => ({ ...e, t: e.t - off })), { total: b.total - off }); };
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
    modal(song.title || '내 곡', h('div', { class: 'staff-wrap' }, el, h('p', { class: 'muted', style: { marginTop: '8px' } }, `음 아래 색 글자 = 계이름(다장조) · 위 빨간 글자 = 화음 · ${valueName(L, song.sub) ? '음 길이는 칸 수대로 음표가 돼요' : ''}`)),
      [{ label: '인쇄', onclick: () => printStaff(el) }, { label: '닫기', primary: true }], { wide: true });
  }
  function printStaff(el) {
    const w = window.open('', '_blank');
    if (!w) { toast('새 창이 막혀 있어요'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${(song.title || '내 곡').replace(/</g, '')}</title><link rel="stylesheet" href="${new URL('css/music.css', location.href)}"><style>body{background:#fff;color:#000;overflow:auto;padding:24px}h1{font:900 22px 'Noto Sans KR',sans-serif;margin-bottom:12px}</style><h1></h1>`);
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
    built = buildEvents(song);
    playStart = player.start(built.events, { total: built.total, onEnd: () => stopHead() });
    playBtn.textContent = '■ 멈추기';
    cancelAnimationFrame(raf);
    const head = () => {
      const el = grid.querySelector('#c-head');
      if (!player.playing) return;
      const t = engine.now - playStart, step = t / built.stepDur;
      if (el && step >= 0) { el.style.display = 'block'; el.style.left = LABEL + step * cellW + 'px'; }
      grid.querySelectorAll('.c-note').forEach(nel => nel.classList.toggle('now', step >= nel._n.s && step < nel._n.s + nel._n.d));
      raf = requestAnimationFrame(head);
    };
    raf = requestAnimationFrame(head);
  }
  function stopHead() {
    cancelAnimationFrame(raf); playBtn.textContent = '▶ 들어 보기';
    const el = grid.querySelector('#c-head'); if (el) el.style.display = 'none';
    grid.querySelectorAll('.c-note.now').forEach(n => n.classList.remove('now'));
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
  const onResize = () => layout();
  addEventListener('resize', onResize);
  const onKey = e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); togglePlay(); } };
  addEventListener('keydown', onKey);
  const beforeUnload = e => { if (dirty && song.notes.length) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', beforeUnload);
  return {
    unmount() { player.stop(); cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('keydown', onKey); removeEventListener('beforeunload', beforeUnload); },
    isDirty: () => dirty && song.notes.length > 0,
  };
}
