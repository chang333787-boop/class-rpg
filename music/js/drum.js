// 북 치기 화면 [MUSIC-DRUM-1] — #/drum = 단계 고르기 · #/drum/stage/<단계> · #/drum/song/<곡> = 치기 화면(app.js 가 처음 열 때만 불러온다)
//  치는 방법 둘 —
//   🥁 진짜 북: 화면을 보며 진짜 북을 친다(기기 연동 없음 · 판정 없음). 음표가 판정 원에 닿는 순간 아래 북 그림의 그 자리가 빛나고
//              '북 소리 도움'이 그 소리를 내 준다. 끝나면 리코더 연습처럼 스스로 별을 매긴다.
//   ⌨️ 키보드 · 화면: F · J = 쿵(가운데) · D · K = 딱(테두리) · 쿵과 딱을 같이 = 덩 · 북 그림을 눌러도 된다(두 손가락 = 덩). 판정 · 점수 · 우리 반 최고.
//  화면: 위 = 구음 띠(이번 마디 · 다음 마디를 '쿵 딱 쿵쿵 딱'으로 크게 — 멀리 TV 에서도 읽게) · 가운데 = 음표 길(오른쪽 → 왼쪽) · 그 아래 = 리코더 가락 띠 · 맨 아래 = 북 그림
//  음표 모양 = 북에서 칠 곳: 쿵 = 빨간 원(가운데) · 딱 = 파란 테 + 빈 가운데(테두리) · 덩 = 파란 테 + 빨간 가운데(둘 다 · 조금 크게)
import { h, toast, lsGet, lsSet, READY_SEC, readyCount } from './util.js';
import { solfege, colorOf, totalSteps } from './theory.js';
import { engine, Player } from './audio.js';
import { HITS, STAGES, stageChart, DRUM_LEVELS, songChart, drumEvents, createJudge, gradeOf, starsOf, sayBar, sayText, stageRecKey, songRecKey, usedKinds, chartOK, stageSong, levelsFor, markAt, calibrateFrom } from './drumcore.js';
import { partnersOf, partnerEvents, withPartners } from './ensemble.js';   // [MUSIC-ENSEMBLE-1] 선생님 곡이 합주면 다른 부분도 '가락 소리'로

const SPEEDS = [[0.6, '느리게'], [0.8, '조금 느리게'], [1, '원래 빠르기'], [1.2, '조금 빠르게'], [1.4, '빠르게']];
const KEYMAP = { KeyF: 'D', KeyJ: 'D', KeyD: 'K', KeyK: 'K' };
const JUDGE = { perfect: { ko: '완벽!', c: '#ffe48f' }, great: { ko: '좋아!', c: '#8fd07d' }, good: { ko: '괜찮아', c: '#7fc4f0' }, miss: { ko: '놓쳤어', c: '#e5484d' } };
const STAR_KEY = 'music.drumStars';   // 이 기기의 단계 · 곡별 가장 좋은 별(저장소 연습 기록과 합쳐 보여 줌)
const HOW_KEY = 'music.drumHow';      // 치는 방법 — 'real'(진짜 북) | 'keys'(키보드 · 화면)
const RED = HITS.D.color, BLUE = HITS.K.color, CREAM = '#f1e6cc';
//  [MUSIC-DRUM-SYNC-1] 소리 · 화면 맞추기(이 기기에 기억) — 0 보다 크면 음표가 그만큼 늦게 닿는다(블루투스 · TV 스피커처럼 소리가 늦게 나는 기기)
const SYNC_KEY = 'music.drumSync';
//  [MUSIC-DRUM-SYNC-2] 0.02초 간격 −0.12 ~ +0.40 · 맞추기 시험이 잰 값(0.01초 단위)도 받는다
const SYNC_MIN = -0.12, SYNC_MAX = 0.4;
const syncLabel = v => (Math.abs(v) < 0.005 ? '맞춤 그대로' : `음표 ${Math.abs(v).toFixed(2)}초 ${v > 0 ? '늦게' : '빨리'}`);
const syncOpts = cur => { const vs = []; for (let k = -6; k <= 20; k++) vs.push(Math.round(k * 2) / 100); if (!vs.some(v => Math.abs(v - cur) < 0.001)) vs.push(cur); return vs.sort((a, z) => a - z).map(v => [v, syncLabel(v)]); };
const okSync = v => typeof v === 'number' && Number.isFinite(v) && v >= SYNC_MIN && v <= SYNC_MAX;
//  [MUSIC-DRUM-SYNC-2] 화면은 그린 다음 화면에 뜨기까지 한두 장면(약 0.02초) 늦다 — 그리는 시각을 그만큼 앞당긴다(판정 시계는 그대로)
const VIS_LEAD = 0.02;
//  [MUSIC-DRUM-SYNC-1] 귀에 '들리는' 소리 시각(초 · 소리 장치 시계).
//   currentTime 은 소리 장치에 넘기는 시각이라 실제로 귀에 닿는 때보다 출력 지연만큼 앞서고, Windows 에서는 10~20ms 씩 뚝뚝 오른다
//   (2026-11-13 학교 PC 잼: outputLatency 0.04 + baseLatency 0.01초 · 걸음 11~20ms) → 화면이 소리보다 약 0.05초 먼저 · 음표가 떨려 '싱크가 이상'.
//   getOutputTimestamp(지금 스피커로 나가는 소리의 시각 + 그때 performance 시각)로 고르게 잇는다 · perf = 누른 순간(event.timeStamp)도 받는다 · 없으면 currentTime − 지연
function heard(perf = performance.now()) {
  const c = engine.ctx;
  if (!c) return 0;
  const fall = c.currentTime - (c.outputLatency || 0) - (c.baseLatency || 0);
  const ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null;
  if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
    const v = ts.contextTime + (perf - ts.performanceTime) / 1000;
    if (Math.abs(v - fall) < 0.3) return v;
  }
  return fall;
}

const starsLocal = () => { const m = lsGet(STAR_KEY, {}); return m && typeof m === 'object' ? m : {}; };
function keepStars(key, n) { const m = starsLocal(); if (!(m[key] >= n)) { m[key] = n; lsSet(STAR_KEY, m); } }
//  연습 기록(practice) → { 열쇠: 가장 좋은 별 }
function bestFromPractice(items) {
  const out = {};
  for (const x of items || []) { const b = Math.max(x.stars || 0, ...(x.log || []).map(l => l.st || 0)); if (b) out[x.key] = b; }
  return out;
}
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

//  음표 하나 그리기 — 북에서 칠 곳 모양(가운데 = 빨강 · 테두리 = 파랑)
function noteIcon(g, x, y, k, r) {
  g.lineWidth = Math.max(2, r * 0.08);
  if (k === 'D') {
    g.fillStyle = RED; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = `900 ${Math.round(r * 0.86)}px "Noto Sans KR",sans-serif`;
  } else if (k === 'K') {
    g.fillStyle = BLUE; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = CREAM; g.beginPath(); g.arc(x, y, r * 0.58, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b5f8a'; g.font = `900 ${Math.round(r * 0.66)}px "Noto Sans KR",sans-serif`;
  } else if (k === 'R') {   // [MUSIC-DRUM-ROLL-1] 굴리기 머리 — 주황 원 '다라'
    g.fillStyle = HITS.R.color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#3a1d00'; g.font = `900 ${Math.round(r * 0.62)}px "Noto Sans KR",sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('다라', x, y + 1);
    return;
  } else {
    g.fillStyle = BLUE; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffe48f'; g.lineWidth = Math.max(3, r * 0.1); g.stroke();
    g.fillStyle = RED; g.beginPath(); g.arc(x, y, r * 0.62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `900 ${Math.round(r * 0.7)}px "Noto Sans KR",sans-serif`;
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(HITS[k].say, x, y + 1);
}
//  작은 북 그림(단계 고르기 첫 줄 · 문 그림) — 위에서 비스듬히 본 모습: 크림색 가죽 · 금빛 징 · 빨간 몸통
function drumIcon(size = 120) {
  const NS = 'http://www.w3.org/2000/svg', el = (tag, a) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const s = el('svg', { viewBox: '0 0 120 100', width: size, height: Math.round(size * 0.83), 'aria-hidden': 'true', class: 'dr-icon' });
  s.append(el('ellipse', { cx: 60, cy: 70, rx: 50, ry: 26, fill: '#7d1a1f' }), el('rect', { x: 10, y: 44, width: 100, height: 26, fill: '#b3262b' }),
    el('ellipse', { cx: 60, cy: 44, rx: 50, ry: 26, fill: CREAM }), el('ellipse', { cx: 60, cy: 44, rx: 30, ry: 15.5, fill: 'none', stroke: 'rgba(229,72,77,.55)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; s.append(el('circle', { cx: 60 + Math.cos(a) * 49, cy: 44 + Math.sin(a) * 25.4, r: 2.3, fill: '#d2aa50' })); }
  return s;
}

// ── 단계 고르기 ──
export function mountDrumHome(root, ctx) {
  const cards = h('div', { class: 'dr-stages' });
  const legend = h('div', { class: 'dr-legend' }, ...['D', 'K', 'B'].map(k => h('span', { class: 'dr-chip' }, h('i', { class: 'dr-dot k-' + k }, HITS[k].say), h('span', {}, h('b', {}, HITS[k].say), ' = ', HITS[k].part))));
  root.replaceChildren(ctx.topBar('북 치기', { back: '#/' }), h('div', { class: 'view' }, h('div', { class: 'dr-home' },
    h('section', { class: 'dr-intro' }, drumIcon(132), h('div', {},
      h('h2', {}, '작은 북 하나로 쿵 · 딱 · 덩'),
      h('p', {}, '가운데를 치면 쿵, 옆 테두리(플라스틱)를 치면 딱, 둘을 한꺼번에 치면 덩. 화면을 보며 진짜 북으로 치거나 키보드로 쳐요.'),
      legend)),
    h('button', { class: 'dr-songdoor', onclick: () => ctx.go('#/pick/drum') },
      h('b', {}, '🎵 리코더 곡에 맞춰 북 반주'), h('span', {}, '선생님 곡 · 기본 곡 · 내 곡 — 리코더 가락이 흐르고, 북은 반주를 맡아요'), h('i', {}, '곡 고르기 →')),
    h('h3', { class: 'dr-h3' }, '단계별 연습', h('small', {}, '처음이면 1단계부터 — 별 두 개를 받으면 다음 단계로!')),
    cards)));
  const draw = best => {
    const rec = STAGES.findIndex(st => !((best[stageRecKey(st)] || 0) >= 2));
    cards.replaceChildren(...STAGES.map((st, i) => {
      const song = stageSong(st), chart = stageChart(st, song), n = best[stageRecKey(st)] || 0;
      const seen = new Set(), prev = [];
      st.bars.forEach((b, j) => { if (!seen.has(b) && prev.length < 2) { seen.add(b); prev.push(sayText(song, chart, j)); } });
      return h('button', { class: 'dr-stage' + (i === rec ? ' rec' : '') + (n >= 2 ? ' clear' : ''), 'data-stage': st.key, onclick: () => ctx.go('#/drum/stage/' + st.key) },
        h('span', { class: 'no' }, i + 1), i === rec ? h('em', { class: 'here' }, '여기부터!') : null,
        h('b', {}, st.title), h('small', {}, st.goal),
        h('span', { class: 'say' }, prev.join('  |  ')),
        h('span', { class: 'stars' + (n ? ' got' : '') }, starText(n)));
    }));
  };
  let best = starsLocal();
  draw(best);
  ctx.store.listPractice().then(items => { const db = bestFromPractice(items); for (const [k, v] of Object.entries(db)) if (!(best[k] >= v)) best = { ...best, [k]: v }; draw(best); }).catch(() => {});
  return { unmount() {} };
}

// ── 치기 화면 ──  stage = 단계(없으면 곡 반주) · key = songKey(곡 반주 기록 열쇠)
export function mountDrum(root, ctx, { song, stage = null, key = '' }) {
  const stageNo = stage ? STAGES.indexOf(stage) + 1 : 0, nextStage = stage ? STAGES[stageNo] || null : null;
  //  [MUSIC-DRUM-ARR-1] 공연 편곡이 있는 곡은 편곡이 처음 · 그 밖은 이 기기에 기억한 난이도(편곡은 기억하지 않음)
  const levels = stage ? [] : levelsFor(song), savedLv = lsGet('music.drumLevel', 'easy');
  let level = stage ? null : levels.includes('arr') ? 'arr' : levels.includes(savedLv) && savedLv !== 'arr' ? savedLv : 'easy';
  let how = lsGet(HOW_KEY, 'real') === 'keys' ? 'keys' : 'real';
  //  [MUSIC-DRUM-ROLL-1] 곡 반주 빠르기는 이 기기에 기억(사용자 11-13 '애들 조금 빠르게로 할 거라서' — 한 번 고르면 다음에도)
  const savedSp = lsGet('music.drumSpeed', 0.8);
  let speed = stage ? 1 : SPEEDS.some(([v]) => v === savedSp) ? savedSp : 0.8, guide = how === 'real', melodyOn = true;
  let sync = okSync(lsGet(SYNC_KEY, 0)) ? lsGet(SYNC_KEY, 0) : 0, lastT = -1e9;   // [MUSIC-DRUM-SYNC-1]
  let chart = [], J = null, state = 'ready', raf = 0, t0 = 0, built = null, tEnd = 0, cue = 0, alive = true, partners = [];
  let flash = { D: -9, K: -9 }, bursts = [], judgeShow = null, hint = null, cheerT = -9;
  //  반짝임 세기 1 → 0(dur 초 동안) — 시계가 뒤로 가면(그만 → 준비 화면 t = −1) 0. 예전엔 음수 반지름으로 arc 가 오류 → '그만'이 멈췄다 [MUSIC-DRUM-SYNC-1]
  const fade = (t, at, dur) => (t >= at && t - at < dur ? 1 - (t - at) / dur : 0);
  const clearFx = () => { bursts = []; judgeShow = null; hint = null; flash = { D: -9, K: -9 }; cheerT = -9; };
  const player = new Player(engine);
  const hasMel = (song.notes || []).length > 0;
  const recKey = () => (stage ? stageRecKey(stage) : songRecKey(key, level));
  const recTitle = () => (stage ? `🥁 ${stageNo}단계 ${stage.title}` : `🥁 ${song.title || '곡'} · ${DRUM_LEVELS[level].name}`);
  const cheer = new Image(); cheer.src = '../assets/monsters/m25.png';
  const stepDur = () => 60 / (song.tempo * speed) / song.sub;
  const beatDur = () => 60 / (song.tempo * speed);
  function makeChart() {
    chart = stage ? stageChart(stage, song) : songChart(song, level);
    if (!chartOK(song, chart)) { console.warn('[MUSIC-DRUM-1] 악보 이상 — 칸 밖 · 겹침을 뺌'); chart = chart.filter(c => c.s >= 0 && c.s < totalSteps(song)); }
    const sd = stepDur();
    J = createJudge(chart.map(c => ({ ...c, t: c.s * sd, dur: (c.d || 0) * sd })));   // [MUSIC-DRUM-ROLL-1] 굴리기 길이(초)
    cue = 0;
  }

  const sel = (opts, val, on) => h('select', { onchange: e => on(e.target.value) }, ...opts.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(val)) o.selected = true; return o; }));
  const tog = (label, get, set, title) => { const b = h('button', { class: 'btn small' + (get() ? ' on' : ''), title, onclick: () => { set(!get()); b.classList.toggle('on', get()); applyMute(); } }, label); return b; };
  const guideBtn = tog('🥁 북 소리 도움', () => guide, v => { guide = v; }, '쳐야 할 북 소리를 대신 내 줘요');
  const melBtn = hasMel ? tog('🎵 가락 소리', () => melodyOn, v => { melodyOn = v; }, '리코더 가락 소리(진짜 리코더와 같이 하면 꺼도 돼요)') : null;
  const right = [];
  if (!stage) right.push(sel(levels.map(k => [k, DRUM_LEVELS[k].name]), level, v => { level = v; if (v !== 'arr') lsSet('music.drumLevel', v); changed(); }));
  right.push(sel(SPEEDS, speed, v => { speed = +v; if (!stage) lsSet('music.drumSpeed', speed); changed(); }), guideBtn);
  if (melBtn) right.push(melBtn);
  const top = ctx.topBar(stage ? `북 치기 · ${stageNo}단계 ${stage.title}` : `북 반주 · ${song.title || '곡'}`, { back: () => ctx.go(stage ? '#/drum' : '#/pick/drum'), right });
  const cv = h('canvas', { class: 'r-cv dr-cv' });
  const over = h('div', { class: 'p-over' });
  const stopBtn = h('button', { class: 'btn p-stop', style: { display: 'none' }, onclick: () => stop() }, '■ 그만');
  const stage$ = h('div', { class: 'r-stage dr-stage-cv', tabindex: 0 }, cv, over, stopBtn);
  root.replaceChildren(top, h('div', { class: 'view r-view' }, stage$));
  const g = cv.getContext('2d');
  let W = 0, H = 0, L = null, drumImg = null;
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = stage$.clientWidth; H = stage$.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = layout(); drumImg = paintDrum(L, dpr);
    draw();
  }
  //  자리 셈 — 구음 띠 · 판정 글 자리 · 음표 길 · 가락 띠 · 북
  function layout() {
    const sayY = 24, sayH = Math.max(46, Math.min(64, H * 0.11));
    const laneH = Math.max(76, Math.min(116, H * 0.2));
    const laneY = sayY + sayH + 34 + laneH / 2;
    const melY = laneY + laneH / 2 + 6, melH = hasMel ? 22 : 0;
    const jx = Math.max(78, Math.min(W * 0.17, 220));
    const drumTop = melY + melH + 14, avail = Math.max(60, H - drumTop - 10);
    const R = Math.max(44, Math.min(165, avail / 1.6, W * 0.19));
    const ry = R * 0.6, body = R * 0.34, cy = drumTop + ry + 2;
    const pxBeat = Math.max(96, Math.min(170, W * 0.11));
    return { sayY, sayH, laneH, laneY, melY, melH, jx, R, ry, body, cx: W / 2, cy, pxBeat, rN: laneH * 0.27, rB: laneH * 0.36 };
  }
  //  북 그림(바뀌지 않는 부분)은 크기가 바뀔 때만 한 번 그려 둔다(크롬북에서 매 장면 그리지 않게)
  function paintDrum(L, dpr) {
    const { R, ry, body } = L, w = Math.ceil(R * 2 + 16), hh = Math.ceil(ry * 2 + body + 16);
    const c = document.createElement('canvas'); c.width = w * dpr; c.height = hh * dpr;
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = w / 2, cy = ry + 8;
    x.fillStyle = '#6e161b'; x.beginPath(); x.ellipse(cx, cy + body, R, ry, 0, 0, Math.PI * 2); x.fill();
    const gr = x.createLinearGradient(cx - R, 0, cx + R, 0); gr.addColorStop(0, '#8e1d22'); gr.addColorStop(0.45, '#c9343a'); gr.addColorStop(1, '#7d1a1f');
    x.fillStyle = gr; x.fillRect(cx - R, cy, R * 2, body);
    const hg = x.createRadialGradient(cx - R * 0.2, cy - ry * 0.3, R * 0.1, cx, cy, R); hg.addColorStop(0, '#fbf3df'); hg.addColorStop(1, '#e6d6b2');
    x.fillStyle = hg; x.beginPath(); x.ellipse(cx, cy, R, ry, 0, 0, Math.PI * 2); x.fill();
    x.setLineDash([8, 6]); x.strokeStyle = 'rgba(229,72,77,.45)'; x.lineWidth = 2.5; x.beginPath(); x.ellipse(cx, cy, R * 0.62, ry * 0.62, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    const N = Math.round(Math.max(16, Math.min(30, R / 5)));
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, tx = cx + Math.cos(a) * R * 0.975, ty = cy + Math.sin(a) * ry * 0.975, r = Math.max(2, R * 0.034);
      x.fillStyle = '#9c7a2e'; x.beginPath(); x.arc(tx, ty + 1, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e2bd62'; x.beginPath(); x.arc(tx - r * 0.2, ty - r * 0.2, r * 0.8, 0, Math.PI * 2); x.fill();
    }
    return { c, w, hh, ox: cx, oy: cy };
  }
  //  북 그림 위 어디를 눌렀나 — 가운데(점선 안) = 쿵 · 그 밖 가죽 · 몸통 = 딱 · 북 밖 = 없음
  function sideAt(px, py) {
    if (!L) return null;
    const dx = (px - L.cx) / L.R, dy = (py - L.cy) / L.ry, r = Math.hypot(dx, dy);
    if (r < 0.62) return 'D';
    if (r <= 1.12) return 'K';
    if (Math.abs(dx) <= 1.05 && py >= L.cy && py <= L.cy + L.body + L.ry) return 'K';
    return null;
  }

  // ── 시간 ──
  //  [MUSIC-DRUM-SYNC-1] 첫 음부터 초 — 들리는 소리 기준 − 맞추기 · 치는 중에는 뒤로 가지 않게(시계 이음새에서 음표가 뒤로 튀지 않게)
  const playT = perf => heard(perf) - t0 - (built ? built.offset : 0) - sync;
  let peekT = null;   // 시험용(?debug=1) — 그 시각의 화면만 그려 보기(소리 없음)
  const now = () => {
    if (peekT != null) return peekT;
    if (state === 'play') { const v = playT(); if (v < lastT && lastT - v < 0.05) return lastT; return (lastT = v); }
    return state === 'done' ? tEnd : -1;
  };
  const visT = () => now() + (state === 'play' ? VIS_LEAD : 0);   // [MUSIC-DRUM-SYNC-2] 그리기 · 진짜 북 빛 신호용
  const totalT = () => totalSteps(song) * stepDur();

  // ── 그리기 ──
  function draw() {
    if (!W || !L) return;
    const t = visT(), { laneY, laneH, jx, rN, rB, pxBeat } = L, pxSec = pxBeat / beatDur();
    g.clearRect(0, 0, W, H);
    // 진행 막대
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(16, 8, W - 32, 5);
    g.fillStyle = '#f2a93b'; g.fillRect(16, 8, Math.max(0, Math.min(1, t / Math.max(0.1, totalT()))) * (W - 32), 5);
    drawSay(t);
    // 음표 길
    const lx = jx - rB - 12;
    g.fillStyle = 'rgba(0,0,0,.38)'; rr(lx, laneY - laneH / 2, W - 10 - lx, laneH, 16); g.fill();
    // 박선 · 마디선
    const bd = beatDur(), b0 = Math.max(0, Math.floor((t - (jx - lx) / pxSec) / bd)), b1 = Math.ceil((t + (W - jx) / pxSec) / bd);
    for (let b = b0; b <= Math.min(b1, song.bars * song.beats); b++) {
      const x = jx + (b * bd - t) * pxSec; if (x < lx + 4) continue;
      const bar = b % song.beats === 0;
      g.fillStyle = bar ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)'; g.fillRect(x - (bar ? 1 : 0.5), laneY - laneH / 2 + 6, bar ? 2 : 1, laneH - 12);
    }
    // 판정 원
    const pulse = fade(t, Math.max(flash.D, flash.K), 0.15);
    g.fillStyle = `rgba(255,228,143,${0.08 + pulse * 0.18})`; g.beginPath(); g.arc(jx, laneY, rB + 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(jx, laneY, rN + 2, 0, Math.PI * 2); g.stroke();
    g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.arc(jx, laneY, rB + 2, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // 음표(먼 것부터 그려서 가까운 것이 위에)
    const ns = J ? J.notes : [];
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i], x = jx + (n.t - t) * pxSec;
      if (n.k === 'R') {   // [MUSIC-DRUM-ROLL-1] 굴리기 — 주황 띠(머리 → 꼬리). 굴리는 동안 머리는 판정 원에 붙어 있고 띠가 줄어든다 · 친 횟수 표시
        const xe = jx + (n.t + n.dur - t) * pxSec;
        if (xe < lx - rN || x > W + rB) continue;
        if (how === 'keys' && n.hit && n.hit !== 'miss') continue;
        const on = t >= n.t && t <= n.t + n.dur, xh = on ? jx : x, h0 = rN * 1.3;
        g.globalAlpha = how === 'keys' && n.hit === 'miss' ? 0.3 : how === 'real' && t > n.t + n.dur ? 0.2 : 1;
        g.fillStyle = 'rgba(255,159,26,.55)'; rr(xh, laneY - h0 / 2, Math.max(0, xe - xh), h0, h0 / 2); g.fill();
        g.strokeStyle = 'rgba(255,228,143,.9)'; g.lineWidth = 2; rr(xh, laneY - h0 / 2, Math.max(0, xe - xh), h0, h0 / 2); g.stroke();
        if (xe - xh > rN * 3) { g.fillStyle = '#3a1d00'; g.font = `900 ${Math.round(rN * 0.62)}px "Noto Sans KR",sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('라라라라라', xh + rN * 1.2, laneY + 1); }
        noteIcon(g, xh, laneY, 'R', rN * (on ? 1 + 0.08 * Math.sin(t * 40) : 1));
        if (on && how === 'keys' && n.rolls) { g.fillStyle = '#ffe48f'; g.font = '900 22px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(`×${n.rolls}`, jx, laneY + rN + 26); }
        g.globalAlpha = 1;
        continue;
      }
      if (x > W + rB || x < lx - rB) continue;
      if (how === 'keys' && n.hit && n.hit !== 'miss') continue;
      const dead = how === 'keys' && n.hit === 'miss', gone = how === 'real' && n.t < t;
      g.globalAlpha = dead ? 0.3 : gone ? Math.max(0.12, 1 - (t - n.t) / 0.5) : 1;
      noteIcon(g, x, laneY, n.k, n.k === 'B' ? rB : rN);
      g.globalAlpha = 1;
    }
    // 맞힌 반짝
    bursts = bursts.filter(b => fade(t, b.at, 0.32) > 0);
    for (const b of bursts) { const u = 1 - fade(t, b.at, 0.32); g.globalAlpha = 1 - u; g.strokeStyle = b.c; g.lineWidth = 5 - u * 3; g.beginPath(); g.arc(jx, laneY, rB * (0.8 + u * 0.7), 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
    // 판정 글 · 알림(반대! · 둘 다 같이!) — 길 위 빈 띠에
    if (judgeShow && t >= judgeShow.at && t - judgeShow.at < 0.5) {
      const J0 = JUDGE[judgeShow.kind], u = (t - judgeShow.at) / 0.5;
      g.globalAlpha = 1 - u * u; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = `900 ${Math.round(28 - u * 4)}px "Noto Sans KR",sans-serif`;
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(J0.ko, jx, laneY - laneH / 2 - 8); g.fillStyle = J0.c; g.fillText(J0.ko, jx, laneY - laneH / 2 - 8); g.globalAlpha = 1;
    }
    if (hint && t >= hint.at && t - hint.at < 0.7) {
      g.globalAlpha = Math.min(1, 2 - (t - hint.at) / 0.35); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '900 20px "Noto Sans KR",sans-serif';
      g.fillStyle = hint.c; g.fillText(hint.text, jx + rB + 18, laneY - laneH / 2 - 9); g.globalAlpha = 1;
    }
    drawMelody(t, pxSec);
    drawDrum(t);
    if (how === 'keys' && J) drawScore(t);
    // 세어 주기 3 · 2 · 1 → 하나 둘 셋 [MUSIC-READY-1]
    if (state === 'play' && t < 0) readyCount(g, t, built ? built.offset : 0, beatDur(), song.beats, W / 2, laneY);
  }
  //  구음 띠 — 이번 마디(왼쪽) · 다음 마디(오른쪽) · 칸마다 쿵 딱 덩 · 박 머리 쉼 = · · 지금 칠 소리는 크게
  function drawSay(t) {
    const { sayY, sayH } = L, bs = song.beats * song.sub, barT = bs * stepDur();
    const cur = Math.max(0, Math.min(song.bars - 1, Math.floor(Math.max(0, t) / barT)));
    const pad = 16, half = (W - pad * 2 - 20) / 2, cw = half / bs, fs = Math.round(Math.max(15, Math.min(sayH * 0.54, cw * 0.82)));
    g.fillStyle = 'rgba(255,255,255,.05)'; rr(pad, sayY, W - pad * 2, sayH, 12); g.fill();
    const act = J ? J.notes.find(n => t >= n.t - 0.06 && t < n.t + Math.min(0.3, stepDur() * 0.9)) : null;
    [cur, cur + 1].forEach((bar, j) => {
      if (bar >= song.bars) return;
      const x0 = pad + 10 + j * (half + 20), cells = sayBar(song, chart, bar);
      g.font = '800 11px "Noto Sans KR",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = j ? 'rgba(255,255,255,.4)' : '#ffe48f';
      const mk = markAt(song, bar), mkPrev = bar ? markAt(song, bar - 1) : '';   // [MUSIC-DRUM-ARR-1] 편곡 이름표(바뀌는 마디는 금빛)
      g.fillText((j ? '다음 마디' : state === 'ready' ? '첫 마디' : '이번 마디') + (mk ? ' · ' + mk : ''), x0, sayY + 4);
      if (mk && mk !== mkPrev && j) { const w = g.measureText(j ? '다음 마디 · ' : '').width; g.fillStyle = '#ffe48f'; g.fillText(mk + ' ▶', x0 + w, sayY + 4); }
      cells.forEach((c, i) => {
        const x = x0 + i * cw + cw / 2, y = sayY + sayH / 2 + 8;
        if (c.beat && i) { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x0 + i * cw - 0.5, sayY + 16, 1, sayH - 22); }
        if (c.k === 'R') {   // [MUSIC-DRUM-ROLL-1] 굴리기 — 덮는 칸 넓이에 '다라라라라라'(주황 띠)
          const s = bar * bs + i, span = Math.min(c.d, bs - i) * cw, x1 = x0 + i * cw + 2, now$ = !j && J && J.notes.some(n => n.s === s && t >= n.t - 0.06 && t <= n.t + n.dur);
          g.globalAlpha = j ? 0.7 : 1;
          g.fillStyle = now$ ? 'rgba(255,159,26,.4)' : 'rgba(255,159,26,.18)'; rr(x1, y - fs * 0.62, span - 4, fs * 1.24, fs * 0.5); g.fill();
          g.fillStyle = HITS.R.color; g.font = `900 ${Math.round(fs * (now$ ? 1.12 : 1))}px "Noto Sans KR",sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
          const word = '다라라라라라라라라라'.slice(0, Math.max(3, Math.min(10, Math.floor((span - 12) / (fs * 0.92)))));
          g.fillText(word, x1 + 6, y); g.globalAlpha = 1;
          return;
        }
        if (c.roll) return;   // 굴리기가 덮은 칸(앞 마디에서 이어진 것 포함) — 쉼 표시 안 함
        if (!c.k) { if (c.beat) { g.fillStyle = 'rgba(255,255,255,.28)'; g.font = `900 ${fs}px "Noto Sans KR",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('·', x, y); } return; }
        const s = bar * bs + i, isNow = !j && act && act.s === s, past = !j && J && J.notes.some(n => n.s === s && n.t < t - 0.3);
        g.globalAlpha = past ? 0.35 : j ? 0.7 : 1;
        g.font = `900 ${Math.round(fs * (isNow ? 1.28 : 1))}px "Noto Sans KR",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = HITS[c.k].color; g.fillText(HITS[c.k].say, x, y);
        g.globalAlpha = 1;
      });
    });
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(pad + 10 + half + 9, sayY + 10, 2, sayH - 20);
  }
  //  리코더 가락 띠 — 음표 길과 같은 시간 축(북 치는 아이가 노래 어디쯤인지 본다)
  function drawMelody(t, pxSec) {
    if (!hasMel) return;
    const { melY, melH, jx } = L, sd = stepDur(), x0 = 52;
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x0 - 4, melY, W - x0 - 6, melH);
    for (const n of song.notes) {
      const x = jx + (n.s * sd - t) * pxSec, w = Math.max(4, n.d * sd * pxSec - 3);
      if (x > W || x + w < x0) continue;
      const on = n.s * sd <= t && t < (n.s + n.d) * sd;
      g.globalAlpha = (n.s + n.d) * sd < t ? 0.3 : on ? 1 : 0.75;
      g.fillStyle = colorOf(n.p); rr(Math.max(x0, x), melY + 3, Math.min(w, x + w - x0), melH - 6, 5); g.fill();
      if (w > 22 && x >= x0) { g.fillStyle = '#fff'; g.font = '800 11px "Noto Sans KR",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(solfege(n.p, { short: true }), x + 5, melY + melH / 2 + 1); }
      g.globalAlpha = 1;
    }
    g.fillStyle = '#bfe3ff'; g.font = '800 11px "Noto Sans KR",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('🎵 가락', 6, melY + melH / 2 + 1);
    g.fillStyle = 'rgba(255,228,143,.6)'; g.fillRect(jx - 1, melY, 2, melH);
  }
  //  북 그림 + 빛(쿵 = 가운데 빨강 · 딱 = 테두리 · 몸통 파랑) + 칠 곳 이름 · 키 자리
  function drawDrum(t) {
    const { cx, cy, R, ry, body } = L;
    const fD = fade(t, flash.D, 0.18), fK = fade(t, flash.K, 0.18);
    const sq = 1 - Math.max(fD, fK) * 0.025;
    if (drumImg) { const { c, w, hh, ox, oy } = drumImg; g.drawImage(c, cx - ox, cy - oy * sq, w, hh * sq); }
    if (fK) {
      g.globalAlpha = fK * 0.85; g.strokeStyle = BLUE; g.lineWidth = R * 0.16; g.beginPath(); g.ellipse(cx, cy, R * 0.9, ry * 0.88, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(47,163,230,.55)'; g.fillRect(cx - R, cy, R * 2, body); g.globalAlpha = 1;
    }
    if (fD) {
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, R * 0.62); gr.addColorStop(0, `rgba(255,90,90,${0.8 * fD})`); gr.addColorStop(1, 'rgba(229,72,77,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, R * 0.62, ry * 0.62, 0, 0, Math.PI * 2); g.fill();
    }
    // 이름표 — 진짜 북이면 '가운데 쿵 · 테두리 딱' · 키보드면 키 자리(F J = 가운데 · D K = 테두리)
    const fs = Math.round(Math.max(12, Math.min(20, R * 0.13)));
    g.textBaseline = 'middle'; g.textAlign = 'center';
    if (how === 'keys') {
      key$(cx - R * 0.28, cy, 'F', RED, fs); key$(cx + R * 0.28, cy, 'J', RED, fs);
      key$(cx - R - fs * 1.9, cy + body * 0.5, 'D', BLUE, fs); key$(cx + R + fs * 1.9, cy + body * 0.5, 'K', BLUE, fs);
    } else {
      g.font = `900 ${fs + 4}px "Noto Sans KR",sans-serif`; g.fillStyle = 'rgba(160,40,44,.85)'; g.fillText('쿵', cx, cy - fs * 0.45);
      g.font = `800 ${fs - 2}px "Noto Sans KR",sans-serif`; g.fillStyle = 'rgba(110,60,40,.7)'; g.fillText('가운데', cx, cy + fs * 0.75);
      g.font = `900 ${fs + 2}px "Noto Sans KR",sans-serif`; g.fillStyle = BLUE;
      g.textAlign = 'right'; g.fillText('딱 ◀', cx - R - 10, cy + body * 0.5);
      g.textAlign = 'left'; g.fillText('▶ 딱', cx + R + 10, cy + body * 0.5);
      g.font = `800 ${fs - 3}px "Noto Sans KR",sans-serif`; g.fillStyle = 'rgba(127,196,240,.75)';
      g.textAlign = 'right'; g.fillText('테두리', cx - R - 10, cy + body * 0.5 + fs + 2);
      g.textAlign = 'left'; g.fillText('테두리', cx + R + 10, cy + body * 0.5 + fs + 2);
    }
    // 응원 몬스터 — 콤보마다 폴짝
    if (cheer.complete && cheer.naturalWidth) { const jump = fade(t, cheerT, 0.25), sz = Math.min(110, R * 0.75); g.drawImage(cheer, W - sz - 24, H - sz - 16 - jump * 22, sz, sz); }
  }
  function key$(x, y, k, col, fs) {
    const s = fs * 1.7;
    g.fillStyle = 'rgba(20,14,10,.78)'; rr(x - s / 2, y - s / 2, s, s, 7); g.fill();
    g.strokeStyle = col; g.lineWidth = 2; rr(x - s / 2, y - s / 2, s, s, 7); g.stroke();
    g.fillStyle = '#fff'; g.font = `900 ${fs}px "Noto Sans KR",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, x, y + 1);
  }
  //  점수 · 콤보(키보드로 칠 때만)
  function drawScore(t) {
    const st = J.stats, { cx, cy, R } = L, x = Math.max(16, cx - R - 210);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#a8977d'; g.font = '700 12px "Noto Sans KR",sans-serif'; g.fillText('점수', x, cy - 52);
    g.fillStyle = '#f3e8d6'; g.font = '900 26px "Noto Sans KR",sans-serif'; g.fillText(J.score().toLocaleString(), x, cy - 24);
    g.font = '700 12px "Noto Sans KR",sans-serif';
    ['perfect', 'great', 'good', 'miss'].forEach((k, i) => { g.fillStyle = JUDGE[k].c; g.fillText(`${JUDGE[k].ko} ${st[k]}`, x, cy + i * 18); });
    if (st.combo >= 3) { g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.92)'; g.font = '900 40px "Noto Sans KR",sans-serif'; g.fillText(String(st.combo), cx + R + 120, cy - 4); g.font = '800 12px "Noto Sans KR",sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('콤보', cx + R + 120, cy + 16); }
  }
  function rr(x, y, w, hh, r) { r = Math.max(0, Math.min(r, hh / 2, w / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ── 치기 ──
  //  perf = 누른 순간(event.timeStamp) — 렉 있는 PC 에서 처리가 늦게 돌아도 누른 때로 판정 [MUSIC-DRUM-SYNC-1]
  function press(side, perf) {
    const t = state === 'play' && perf > 0 ? playT(perf) : now();
    flash[side] = t;
    engine.drum(HITS[side].drum, engine.now, 0.85);
    if (state !== 'play' || how !== 'keys' || t < -0.3) return;
    const r = J.hit(side, t);
    if (JUDGE[r.kind]) shown(r);
    else if (r.kind === 'roll') { bursts.push({ at: t, c: HITS.R.color }); cheerT = t; }   // [MUSIC-DRUM-ROLL-1] 굴리기 — 칠 때마다 반짝 · 횟수는 길 위 ×N
    else if (r.kind === 'wrong') hint = { text: r.want === 'D' ? '✋ 가운데!' : '✋ 테두리!', c: r.want === 'D' ? '#ff8a8a' : '#8fd0ff', at: t };
  }
  function shown(r) {
    judgeShow = { kind: r.kind, at: r.at };
    if (r.kind !== 'miss') { bursts.push({ at: r.at, c: JUDGE[r.kind].c }); cheerT = r.at; }
    if (r.half) hint = { text: '둘 다 같이 쳐야 덩!', c: '#ffe48f', at: r.at };
  }
  function applyMute() { player.mute = { melody: !melodyOn, partner: !melodyOn, guide: !guide }; }

  // ── 흐름 ──
  function loop() {
    if (state !== 'play') return;
    const t = now();
    if (how === 'keys') for (const r of J.sweep(t)) shown(r);
    else {
      while (cue < J.notes.length && J.notes[cue].t <= t + VIS_LEAD) { const k = J.notes[cue].k; if (k !== 'K') flash.D = J.notes[cue].t; if (k === 'K' || k === 'B') flash.K = J.notes[cue].t; cue++; }
      //  [MUSIC-DRUM-ROLL-1] 굴리는 동안 가운데가 0.08초마다 빛남(다라라라)
      const tv = t + VIS_LEAD, rl = J.notes.find(n => n.k === 'R' && tv >= n.t && tv <= n.t + n.dur);
      if (rl && tv - flash.D >= 0.08) flash.D = tv;
    }   // 진짜 북: 칠 때 북 그림이 빛남
    draw(); raf = requestAnimationFrame(loop);
  }
  function start() {
    engine.ensure(); engine.setReverb(0.08);
    makeChart(); clearFx();
    const b = drumEvents(song, chart, { speed });
    built = partners.length ? withPartners(b, partnerEvents(song, partners, b, { vel: 0.5 })) : b;
    applyMute();
    lastT = -1e9;
    t0 = player.start(built.events, { at: engine.now + READY_SEC + 0.1, total: built.total + 0.8, onEnd: () => finish(), ahead: 0.35 });   // [MUSIC-READY-1] 3초 준비 → 한 마디 세기 → 첫 박 · [MUSIC-DRUM-SYNC-1] 0.35초 미리 예약
    state = 'play'; over.style.display = 'none'; stopBtn.style.display = '';
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    try { stage$.focus({ preventScroll: true }); } catch {}
  }
  function stop() { player.stop(); state = 'ready'; cancelAnimationFrame(raf); stopBtn.style.display = 'none'; makeChart(); clearFx(); draw(); showReady(); }
  function changed() { if (state === 'play') { player.stop(); start(); } else { state = 'ready'; makeChart(); clearFx(); draw(); showReady(); } }
  function finish() {
    tEnd = now(); state = 'done'; cancelAnimationFrame(raf); stopBtn.style.display = 'none';
    if (how === 'keys') J.sweep(1e9);
    draw(); over.style.display = 'grid';
    if (how === 'keys') return finishKeys();
    const stars = [3, 2, 1].map(n => h('button', { class: 'star-btn', onclick: () => rate(n) }, h('b', {}, '★'.repeat(n)), h('span', {}, { 3: '잘 맞춰 쳤어요', 2: '조금 틀렸어요', 1: '어려웠어요' }[n])));
    over.replaceChildren(h('div', { class: 'p-card' }, h('img', { src: cheer.src, alt: '' }), h('h2', {}, '끝까지 쳤어요! 🥁'), h('p', { class: 'muted' }, '스스로 생각해 보면 어땠나요?'), h('div', { class: 'stars-row' }, ...stars)));
  }
  async function rate(n) {
    keepStars(recKey(), n);
    let count = null;
    try { count = await ctx.store.addPractice(recKey(), recTitle(), { sp: speed, stars: n }); } catch (e) { console.warn(e); toast('기록을 저장하지 못했어요'); }
    const msg = n === 3 ? (nextStage ? `좋아요! 다음은 ${stageNo + 1}단계 '${nextStage.title}'예요.` : speed < 1 ? '좋아요! 다음엔 빠르기를 한 단계 올려 볼까요?' : '멋져요! 리코더 친구들과 같이 맞춰 봐요.')
      : n === 2 ? '틀린 곳은 위 구음 띠를 입으로 "쿵 딱" 말하며 한 번 더 쳐 봐요.' : "빠르기를 '느리게'로 바꾸고, 북 소리 도움을 켜고 따라 쳐 봐요.";
    over.replaceChildren(h('div', { class: 'p-card' }, h('img', { src: cheer.src, alt: '' }),
      h('h2', {}, count ? `${count}번째 연습!` : '연습 끝!'), h('p', { class: 'muted' }, msg), endButtons(n >= 2)));
  }
  async function finishKeys() {
    const acc = J.acc(), score = J.score(), grade = gradeOf(acc), stars = starsOf(grade), st = J.stats;
    const res = { score, acc, maxCombo: st.maxCombo, grade };
    const tops = h('div', { class: 'r-tops' }, h('span', { class: 'muted' }, '기록을 저장하는 중…'));
    over.replaceChildren(h('div', { class: 'p-card r-card' },
      h('div', { class: 'grade g-' + grade }, grade),
      h('h2', {}, score.toLocaleString() + '점'),
      h('p', { class: 'dr-res-stars' }, starText(stars)),
      h('p', {}, `정확도 ${acc}% · 최대 콤보 ${st.maxCombo}`),
      h('p', { class: 'muted' }, ['perfect', 'great', 'good', 'miss'].map(k => `${JUDGE[k].ko} ${st[k]}`).join(' · ') + (st.half ? ` · 덩 반쪽 ${st.half}` : '') + (st.wrong ? ` · 반대쪽 ${st.wrong}` : '')),
      tops, endButtons(stars >= 2)));
    if (stars) keepStars(recKey(), stars);
    try {
      const r = await ctx.store.saveRhythm(recKey(), res);
      ctx.store.addPractice(recKey(), recTitle(), { sp: speed, stars }).catch(() => {});
      const list = await ctx.store.topRhythm(recKey(), 3);
      tops.replaceChildren(r.newBest ? h('p', { class: 'newbest' }, r.prev ? `새 최고 기록! (전 ${r.prev.toLocaleString()})` : '첫 기록!') : h('p', { class: 'muted' }, '내 최고 기록은 그대로예요'),
        list.length ? h('div', { class: 'r-board' }, h('b', {}, stage ? `${stageNo}단계 우리 반 최고` : `이 곡 북 반주 우리 반 최고 · ${DRUM_LEVELS[level].name}`), ...list.map((x, i) => h('span', {}, `${i + 1}. ${x.n || '친구'} ${Number(x.best).toLocaleString()} (${x.grade})`))) : null);
    } catch (e) { console.warn(e); tops.replaceChildren(h('p', { class: 'muted' }, '기록을 저장하지 못했어요')); }
  }
  function endButtons(passed) {
    return h('div', { class: 'stars-row' },
      h('button', { class: 'btn' + (passed && nextStage ? '' : ' primary'), onclick: () => start() }, '다시 하기'),
      passed && nextStage ? h('button', { class: 'btn primary', onclick: () => ctx.go('#/drum/stage/' + nextStage.key) }, `다음 단계 → ${nextStage.title}`) : null,
      h('button', { class: 'btn', onclick: () => ctx.go(stage ? '#/drum' : '#/pick/drum') }, stage ? '단계 고르기' : '다른 곡'));
  }
  function showReady() {
    over.style.display = 'grid';
    const kinds = usedKinds(chart), seen = new Set(), prev = [];
    if (stage) stage.bars.forEach((b, j) => { if (!seen.has(b) && prev.length < 2) { seen.add(b); prev.push(sayText(song, chart, j)); } });
    else for (let b = 0; b < Math.min(song.bars, 2); b++) prev.push(sayText(song, chart, b));
    const howBtn = (k, label, sub) => h('button', { class: 'dr-how' + (how === k ? ' on' : ''), 'data-how': k, onclick: () => { how = k; lsSet(HOW_KEY, k); guide = k === 'real'; guideBtn.classList.toggle('on', guide); draw(); showReady(); } }, h('b', {}, label), h('small', {}, sub));
    over.replaceChildren(h('div', { class: 'p-card dr-ready' },
      h('h2', {}, stage ? `${stageNo}단계 · ${stage.title}` : `🥁 ${song.title || '곡'} 북 반주`),
      h('p', { class: 'lv-line' }, stage ? stage.goal : `${DRUM_LEVELS[level].name} — ${DRUM_LEVELS[level].line}`),
      stage ? h('p', { class: 'muted' }, stage.tip) : (partners.length ? h('p', { class: 'muted small' }, '🎶 합주 곡이라 다른 부분 가락도 같이 나와요') : null),
      h('div', { class: 'dr-say' }, ...prev.map(s => h('span', {}, s))),
      h('div', { class: 'dr-legend' }, ...kinds.map(k => h('span', { class: 'dr-chip' }, h('i', { class: 'dr-dot k-' + k }, HITS[k].say), h('span', {}, h('b', {}, HITS[k].say), ' = ', HITS[k].part)))),
      h('div', { class: 'dr-hows' }, howBtn('real', '🥁 진짜 북으로', '화면을 보며 북을 쳐요 · 점수 없이 스스로 별'), howBtn('keys', '⌨️ 키보드 · 화면으로', 'F J = 쿵 · D K = 딱 · 같이 = 덩 · 점수')),
      h('p', { class: 'muted small' }, how === 'real' ? '음표가 동그라미에 닿을 때 쳐요. 아래 북 그림에서 칠 곳이 빛나요.' : '쿵과 딱을 같이 누르면 덩. 북 그림을 눌러도 돼요(두 손가락 = 덩).'),
      syncRow(),
      h('button', { class: 'btn primary big', onclick: () => start() }, '▶ 시작'),
      h('p', { class: 'muted small' }, 'Space = 시작 · Esc = 그만')));
  }

  //  [MUSIC-DRUM-SYNC-1] 소리 · 화면 맞추기 — 이 기기에 기억(블루투스 · TV 스피커는 소리가 늦게 나서 '음표 늦게')
  //  [MUSIC-DRUM-SYNC-2] '🎯 맞추기 시험' — 딸깍에 맞춰 눌러 보면 얼마나 어긋났는지 숫자로 알려 주고 그 값으로 맞춘다
  function syncRow() {
    const s = sel(syncOpts(sync), sync, v => { sync = +v; lsSet(SYNC_KEY, sync); draw(); });
    s.classList.add('dr-sync-sel'); s.title = '음표가 동그라미에 닿은 뒤에 소리가 나면 "늦게", 소리가 먼저 나면 "빨리"';
    return h('div', { class: 'dr-sync' }, h('span', {}, '⏱ 소리 · 화면 맞추기'), s,
      h('button', { class: 'btn small dr-cal-btn', onclick: () => calibrate() }, '🎯 맞추기 시험'),
      h('small', {}, '맞는지 모르겠으면 "맞추기 시험" — 딸깍 소리에 맞춰 12번 누르면 알아서 맞춰요'));
  }
  // ── 맞추기 시험 [MUSIC-DRUM-SYNC-2] ──  90 빠르기 딸깍 16번(넷째마다 높게) · 동그라미가 소리와 같이 깜빡 · F J D K · 스페이스 · 동그라미 누르기
  //   앞 4번은 손 풀기(안 셈) · 누른 때 = 들리는 소리 시계(event.timeStamp) · 가운데 값 → 맞추기 값(0.01초 단위 · −0.12 ~ +0.40)
  let cal = null;
  const CAL = { bpm: 90, n: 16, skip: 4 };
  function calibrate() {
    if (state === 'play') return;
    engine.ensure();
    const beat = 60 / CAL.bpm, cp = new Player(engine);
    const ev = Array.from({ length: CAL.n }, (_, i) => ({ t: i * beat, kind: 'click', accent: i % 4 === 0, track: 'cal' }));
    const dot = h('button', { class: 'dr-cal-dot', 'aria-label': '여기를 눌러도 돼요' }), cnt = h('b', { class: 'dr-cal-n' }, '');
    const c0 = cp.start(ev, { at: engine.now + 1.2, total: CAL.n * beat + 0.4, ahead: 0.35, onEnd: () => calDone() });
    cal = { taps: [], beat, c0, cp, raf: 0, dot, cnt, prev: sync };
    dot.addEventListener('pointerdown', e => { e.preventDefault(); calTap(e.timeStamp); });
    over.replaceChildren(h('div', { class: 'p-card dr-cal' },
      h('h2', {}, '🎯 소리 · 화면 맞추기 시험'),
      h('p', {}, '"딸깍" 소리에 맞춰 ', h('b', {}, 'F 키'), '(또는 아래 동그라미)를 눌러요. 처음 네 번은 손 풀기예요.'),
      dot, cnt,
      h('p', { class: 'muted small' }, '동그라미가 깜빡이는 때와 딸깍 소리가 같이 나는지도 눈으로 봐 주세요.'),
      h('button', { class: 'btn small', onclick: () => calStop(true) }, '그만두기')));
    const tick = () => {
      if (!cal) return;
      const x = heard() - cal.c0, i = Math.round(x / beat), d = x - i * beat;
      dot.classList.toggle('on', i >= 0 && i < CAL.n && d >= 0 && d < 0.11);
      dot.classList.toggle('warm', i < CAL.skip);
      cnt.textContent = x < -0.05 ? '준비…' : i < CAL.skip ? `손 풀기 ${Math.min(CAL.skip, Math.max(1, i + 1))} / ${CAL.skip}` : `${Math.min(CAL.n - CAL.skip, Math.max(1, i - CAL.skip + 1))} / ${CAL.n - CAL.skip}`;
      cal.raf = requestAnimationFrame(tick);
    };
    cal.raf = requestAnimationFrame(tick);
  }
  function calTap(perf) { if (!cal) return; cal.taps.push(heard(perf) - cal.c0); cal.dot.classList.add('hit'); setTimeout(() => cal && cal.dot.classList.remove('hit'), 90); }
  function calStop(back) { if (!cal) return; cal.cp.stop(); cancelAnimationFrame(cal.raf); cal = null; if (back) showReady(); }
  function calDone() {
    if (!cal) return;
    const r = calibrateFrom(cal.taps, cal.beat, CAL.n, CAL.skip), prev = cal.prev;
    calStop(false);
    const again = h('button', { class: 'btn', onclick: () => calibrate() }, '다시 하기');
    if (!r) { over.replaceChildren(h('div', { class: 'p-card dr-cal' }, h('h2', {}, '조금 더 눌러 주세요'), h('p', { class: 'muted' }, '딸깍마다 한 번씩, 적어도 다섯 번은 맞춰 눌러야 잴 수 있어요.'), h('div', { class: 'stars-row' }, again, h('button', { class: 'btn', onclick: () => showReady() }, '돌아가기')))); return; }
    const v = Math.max(SYNC_MIN, Math.min(SYNC_MAX, Math.round(r.offset * 100) / 100));
    sync = v; lsSet(SYNC_KEY, v);
    const ms = Math.round(Math.abs(r.offset) * 1000), steady = r.spread <= 0.04;
    const head = ms <= 20 ? '잘 맞아요 👍' : r.offset > 0 ? `소리가 ${ms / 1000}초 늦게 들려요` : `조금 서둘러 눌렀어요(${ms / 1000}초)`;
    over.replaceChildren(h('div', { class: 'p-card dr-cal' },
      h('h2', {}, head),
      h('p', {}, `가운데 값 ${r.offset >= 0 ? '+' : '−'}${ms / 1000}초 · ${r.n}번 잼 · 고르기 ±${Math.round(r.spread * 1000) / 1000}초`),
      h('p', { class: 'lv-line' }, `→ ${syncLabel(v)}(으)로 맞췄어요`),
      steady ? null : h('p', { class: 'warn' }, '누른 때가 고르지 않아요 — 한 번 더 해 보면 더 정확해요.'),
      h('p', { class: 'muted small' }, '이 기기에 기억돼요. 스피커를 바꾸면(블루투스 · TV) 다시 해 주세요.'),
      h('div', { class: 'stars-row' }, h('button', { class: 'btn primary', onclick: () => showReady() }, '좋아요'), again,
        h('button', { class: 'btn', onclick: () => { sync = prev; lsSet(SYNC_KEY, prev); showReady(); } }, '되돌리기'))));
  }

  // ── 입력 ──  키보드(누르고 있으면 되풀이 무시) · 북 그림 누르기(손가락마다 따로 → 두 손가락 = 덩)
  const onDown = e => {
    if (cal) {   // [MUSIC-DRUM-SYNC-2] 맞추기 시험 중 — F J D K · 스페이스 = 누름 · Esc = 그만두기
      if (e.code === 'Escape') { calStop(true); return; }
      if (KEYMAP[e.code] || e.code === 'Space') { e.preventDefault(); if (!e.repeat) calTap(e.timeStamp); }
      return;
    }
    if (e.code === 'Escape' && state === 'play') { stop(); return; }
    const side = KEYMAP[e.code];
    if (!side) { if (e.code === 'Space' && state !== 'play' && over.querySelector('.dr-ready')) { e.preventDefault(); start(); } return; }
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    e.preventDefault();
    if (e.repeat) return;
    press(side, e.timeStamp);
  };
  addEventListener('keydown', onDown);
  cv.addEventListener('pointerdown', e => { const s = sideAt(e.offsetX, e.offsetY); if (s) { e.preventDefault(); press(s, e.timeStamp); } });
  const ro = new ResizeObserver(() => size()); ro.observe(stage$);
  cheer.onload = () => draw();
  makeChart(); showReady(); size();
  //  합주 곡(선생님 곡 · 부분)이면 다른 부분 가락도 '가락 소리'로 같이(못 읽으면 그대로)
  if (song.ts && ctx.teacherSongs) ctx.teacherSongs().then(list => { if (!alive) return; partners = partnersOf(song, list); if (partners.length && state === 'ready') showReady(); }).catch(() => {});
  //  시험용(?debug=1 일 때만)
  if (/[?&]debug=1/.test(location.search)) window.__drum = { chart: () => chart.map(c => ({ ...c })), notes: () => J.notes.map(n => ({ ...n })), now, press, stats: () => ({ ...J.stats }), start, stop, state: () => state, how: () => how,
    setHow: k => { how = k; guide = k === 'real'; }, layout: () => ({ ...L }), sideAt, sync: () => sync, setSync: v => { sync = v; },
    clock: () => { const c = engine.ctx; return c ? { cur: c.currentTime, heard: heard(), out: c.outputLatency || 0, base: c.baseLatency || 0 } : null; }, mute: () => ({ ...player.mute }), built: () => (built ? { offset: built.offset, stepDur: built.stepDur, total: built.total, t0, guide: built.events.filter(e => e.track === 'guide').length } : null), recKey, level: () => level, calibrate, calTap, cal: () => (cal ? { taps: cal.taps.length, c0: cal.c0, beat: cal.beat } : null), heard: () => heard(), peek: sec => { peekT = sec; over.style.display = sec == null ? 'grid' : 'none'; draw(); } };
  return { pause() { calStop(false); if (state === 'play') stop(); }, unmount() { alive = false; calStop(false); player.stop(); cancelAnimationFrame(raf); removeEventListener('keydown', onDown); ro.disconnect(); } };
}
