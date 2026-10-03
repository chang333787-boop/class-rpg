// 리듬 게임 — 음표가 위에서 떨어지면 판정선에서 키를 누른다. 누를 때 그 음이 울려서, 잘 치면 내가 가락을 연주하는 셈.
//  8줄 = 건반처럼 A S D F | J K L ; = 도 레 미 파 | 솔 라 시 높은도 (음 높이를 손으로 익힘) · 4줄 = D F J K (쉬움, 가락의 오르내림대로)
//  2박 넘는 긴 음은 끝까지 누르고 있기. 반주(화음·베이스·장단)는 뒤에서 깔린다.
import { h, toast, lsGet, lsSet } from './util.js';
import { solfege, colorOf, pc } from './theory.js';
import { buildEvents, beatChords } from './song.js';
import { engine, Player } from './audio.js';

const KEYS = { 8: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'], 4: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'] };
const CAPS = { 8: ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';'], 4: ['D', 'F', 'J', 'K'] };
const LANE8 = ['도', '레', '미', '파', '솔', '라', '시', '높은 도'];
const LANE8_COLOR = [0, 2, 4, 5, 7, 9, 11, 0].map(c => colorOf(60 + c));
const LANE4_COLOR = ['#e5484d', '#f2c230', '#2fa3e6', '#9b59d0'];
const DIAT = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
// [MUSIC-LEVEL-1] 난이도 — 판정 넓이 · 줄 수 · 빠르기 · 화음 음표(두 키 같이) · 사라지는 음표
const LEVELS = {
  easy:   { name: '쉬움', lanes: 4, win: { perfect: 0.075, great: 0.13, good: 0.2 }, tempo: 1, extra: false, hide: false },
  normal: { name: '보통', lanes: 8, win: { perfect: 0.055, great: 0.105, good: 0.16 }, tempo: 1, extra: false, hide: false },
  hard:   { name: '어려움', lanes: 8, win: { perfect: 0.042, great: 0.085, good: 0.13 }, tempo: 1, extra: true, hide: false },
  expert: { name: '아주 어려움', lanes: 8, win: { perfect: 0.035, great: 0.07, good: 0.11 }, tempo: 1.15, extra: true, hide: true },
};
const LANE8_P = [60, 62, 64, 65, 67, 69, 71, 72];
const JUDGE = { perfect: { ko: '완벽!', w: 1, c: '#ffe48f' }, great: { ko: '좋아!', w: 0.7, c: '#8fd07d' }, good: { ko: '괜찮아', w: 0.4, c: '#7fc4f0' }, miss: { ko: '놓쳤어', w: 0, c: '#e5484d' } };
const SPEEDS = [[300, '느리게'], [420, '보통'], [560, '빠르게']];

export function mountRhythm(root, ctx, { song, key }) {
  let level = LEVELS[lsGet('music.rlevel', 'normal')] ? lsGet('music.rlevel', 'normal') : 'normal';
  let lanes = LEVELS[level].lanes, WIN = LEVELS[level].win, pxSec = lsGet('music.rspeed', 420), guide = false, tempo = 1;
  const effTempo = () => tempo * LEVELS[level].tempo;
  const levelKey = () => level === 'normal' ? key : key + '__' + level;   // 기록은 난이도마다 따로(보통 = 예전 기록 그대로)
  let state = 'ready', raf = 0, t0 = 0, built = null, chart = [], stats = null, held = {}, fx = [], judgeShow = null, cheerT = -9;
  const player = new Player(engine);
  const cheer = new Image(); cheer.src = '../assets/monsters/m28.png';
  const notes = [...song.notes].sort((a, z) => a.s - z.s);
  const distinct = [...new Set(notes.map(n => n.p))].sort((a, z) => a - z);

  const sel = (opts, val, on) => h('select', { onchange: e => on(e.target.value) }, ...opts.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(val)) o.selected = true; return o; }));
  const top = ctx.topBar('리듬 게임 · ' + (song.title || '곡'), {
    back: () => ctx.go('#/pick/rhythm'),
    right: [sel(Object.entries(LEVELS).map(([k, v]) => [k, v.name + (v.lanes === 4 ? ' · 4줄' : ' · 8줄')]), level, v => { level = v; lsSet('music.rlevel', v); lanes = LEVELS[v].lanes; WIN = LEVELS[v].win; if (state !== 'play') { makeChart(); draw(); showReady(); } }),
      sel([...SPEEDS, [700, '아주 빠르게']], pxSec, v => { pxSec = +v; lsSet('music.rspeed', pxSec); draw(); }),
      sel([[1, '원래 빠르기'], [0.8, '조금 느리게']], tempo, v => { tempo = +v; if (state !== 'play') { makeChart(); draw(); } })],
  });
  const cv = h('canvas', { class: 'r-cv' });
  const over = h('div', { class: 'p-over' });
  const stage = h('div', { class: 'r-stage' }, cv, over);
  root.replaceChildren(top, h('div', { class: 'view r-view' }, stage));
  const g = cv.getContext('2d');
  let W = 0, H = 0;
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = stage.clientWidth; H = stage.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function laneOf(p) {
    if (lanes === 8) return p >= 72 && pc(p) === 0 ? 7 : DIAT[pc(p)];
    const r = distinct.indexOf(p);
    return Math.min(3, Math.floor(r * 4 / Math.max(1, distinct.length)));
  }
  function makeChart() {
    const st = 60 / (song.tempo * effTempo()) / song.sub, beat = st * song.sub;
    chart = notes.map(n => {
      const d = n.d * st;
      return { t: n.s * st, d, p: n.p, lane: laneOf(n.p), long: n.d >= song.sub * 2 && d >= 0.6, hit: null, tail: null, holding: false, voice: null };
    });
    // 어려움 이상: 화음 음표 — 아이가 쌓은 화음(있으면) 또는 마디 첫 박의 화음 뿌리음. 가락과 같은 줄이면 뺀다(두 번 못 누르니까)
    //  어려움 = 마디 첫 박(4박자는 셋째 박도)에 화음의 뿌리음 + 5음(두 키) · 아주 어려움 = 박마다 세 음 화음(뿌리·3·5음)
    //  화음 음 높이 = 다장조 한 옥타브(도~시) 안 — 8줄 건반 그대로. 가락과 같은 줄이면 뺀다(두 번 못 누르니까)
    if (LEVELS[level].extra && lanes === 8) {
      const extra = [], near = (a, b) => Math.abs(a - b) < 0.03;
      const busy = (lane, t) => chart.some(c => c.lane === lane && near(c.t, t)) || extra.some(c => c.lane === lane && near(c.t, t));
      const add = (p, t, d) => { const lane = laneOf(p); if (!busy(lane, t)) extra.push({ t, d, p, lane, long: false, hit: null, tail: null, holding: false, voice: null, extra: true }); };
      if ((song.harm || []).length) for (const n of song.harm) add(n.p, n.s * st, n.d * st);   // 아이가 쌓은 화음이 있으면 그것부터
      const chords = beatChords(song), full = level === 'expert';
      chords.forEach((c, b) => {
        if (!c) return;
        const inBar = b % song.beats;
        const strong = inBar === 0 || (song.beats === 4 && inBar === 2);
        if (!full && !strong) return;
        const t = b * beat, tones = full ? c.pcs.slice(0, 3) : [c.pcs[0], c.pcs[2]];
        for (const pcv of tones) add(60 + pcv, t, beat * 0.9);
      });
      chart = [...chart, ...extra].sort((a, z) => a.t - z.t);
    }
    stats = { perfect: 0, great: 0, good: 0, miss: 0, combo: 0, maxCombo: 0, sum: 0, count: chart.length + chart.filter(c => c.long).length };
    return beat;
  }
  let tEnd = -1;
  const now = () => state === 'play' ? engine.now - t0 - (built ? built.offset : 0) : state === 'done' ? tEnd : -1;

  // ── 판정 ──
  function judge(c, kind, at) {
    stats[kind]++; stats.sum += JUDGE[kind].w;
    if (kind === 'miss') stats.combo = 0; else { stats.combo++; stats.maxCombo = Math.max(stats.maxCombo, stats.combo); cheerT = at; }
    judgeShow = { kind, at };
  }
  function press(lane) {
    if (state !== 'play') return;
    const t = now();
    held[lane] = true;
    let best = null;
    for (const c of chart) { if (c.hit || c.lane !== lane) continue; const dt = Math.abs(c.t - t); if (dt <= WIN.good && (!best || dt < Math.abs(best.t - t))) best = c; if (c.t - t > WIN.good) break; }
    const pitch = best ? best.p : null;
    if (!best) {
      // 빗나간 누름도 그 줄의 음이 울린다(진짜 악기처럼) — 8줄은 그 건반 음, 4줄은 그 줄에 다음으로 올 음
      const nx = chart.find(c => c.lane === lane && c.t > t);
      const p = lanes === 8 ? LANE8_P[lane] : nx ? nx.p : distinct[Math.min(distinct.length - 1, Math.round(lane * (distinct.length - 1) / 3))] || 60;
      engine.note(song.inst === 'pad' ? 'piano' : song.inst, p, engine.now, 0.22, 0.55);
      fx.push({ lane, at: t, kind: 'tap' }); return;
    }
    const dt = Math.abs(best.t - t), kind = dt <= WIN.perfect ? 'perfect' : dt <= WIN.great ? 'great' : 'good';
    best.hit = kind; judge(best, kind, t);
    fx.push({ lane, at: t, kind: 'hit', color: JUDGE[kind].c });
    best.voice = engine.note(song.inst === 'pad' ? 'piano' : song.inst, pitch, engine.now, best.long ? best.d + 0.05 : Math.max(0.12, Math.min(0.6, best.d)), 0.9);
    if (best.long) best.holding = true;
  }
  function release(lane) {
    held[lane] = false;
    if (state !== 'play') return;
    const t = now();
    for (const c of chart) if (c.long && c.holding && c.lane === lane) {
      c.holding = false;
      if (t >= c.t + c.d - 0.18) { c.tail = 'ok'; judge(c, 'perfect', t); }
      else { c.tail = 'miss'; judge(c, 'miss', t); c.voice && c.voice.stop(engine.now); }
    }
  }
  function sweep(t) {                      // 지나간 음 = 놓침 · 끝까지 누른 긴 음 = 성공
    for (const c of chart) {
      if (!c.hit && t > c.t + WIN.good) { c.hit = 'miss'; judge(c, 'miss', t); if (c.long) { c.tail = 'miss'; judge(c, 'miss', t); } }
      if (c.long && c.holding && t >= c.t + c.d) { c.holding = false; c.tail = 'ok'; judge(c, 'perfect', t); }
    }
  }

  // ── 그리기 ──
  function draw() {
    if (!W) return;
    const t = now();
    g.clearRect(0, 0, W, H);
    const laneW = Math.min(lanes === 8 ? 84 : 116, (W - 360) / lanes), boardW = laneW * lanes, bx = Math.round((W - boardW) / 2);
    const lineY = H - 92;
    // 판
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx - 6, 0, boardW + 12, H);
    for (let i = 0; i < lanes; i++) {
      const x = bx + i * laneW, col = lanes === 8 ? LANE8_COLOR[i] : LANE4_COLOR[i];
      g.fillStyle = held[i] ? hexA(col, 0.22) : i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.05)';
      g.fillRect(x, 0, laneW, H);
      if (lanes === 8 && i === 3) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + laneW - 1, 0, 2, H); }   // 두 손 사이
    }
    // 판정선
    g.fillStyle = 'rgba(255,228,143,.25)'; g.fillRect(bx, lineY - 8, boardW, 16);
    g.fillStyle = '#ffe48f'; g.fillRect(bx, lineY - 1.5, boardW, 3);
    // 음표
    for (const c of chart) {
      const y = lineY - (c.t - t) * pxSec;
      const tailY = lineY - (c.t + c.d - t) * pxSec;
      if (tailY > H + 20 || (c.long ? tailY : y) < -40 && y < -40) continue;
      if (c.hit && c.hit !== 'miss' && !c.long) continue;
      if (c.long && c.tail === 'ok') continue;
      const x = bx + c.lane * laneW + 5, w = laneW - 10, col = lanes === 8 ? colorOf(c.p) : LANE4_COLOR[c.lane];
      const dead = c.hit === 'miss' || c.tail === 'miss';
      // 아주 어려움: 판정선 가까이 오면 음표가 사라진다(박을 머리로 세야 함)
      const fade = LEVELS[level].hide && !dead ? Math.max(0, Math.min(1, (lineY - 40 - y) / 120)) : 1;
      g.globalAlpha = dead ? 0.3 : fade;
      if (c.long) {
        const yy = c.holding ? lineY : y;
        g.fillStyle = hexA(col, c.holding ? 0.75 : 0.5); round(x + w * 0.22, tailY, w * 0.56, Math.max(4, yy - tailY), 6); g.fill();
      }
      if (!(c.long && c.holding) && c.extra) {                // 화음 음표 = 테두리 음표
        g.fillStyle = hexA(col, 0.25); round(x + 3, y - 11, w - 6, 22, 8); g.fill();
        g.strokeStyle = col; g.lineWidth = 3; round(x + 3, y - 11, w - 6, 22, 8); g.stroke();
      } else if (!(c.long && c.holding)) {
        g.fillStyle = col; round(x, y - 13, w, 26, 9); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; round(x + 4, y - 10, w - 8, 7, 4); g.fill();
        if (w > 40) { g.fillStyle = '#fff'; g.font = '900 13px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(solfege(c.p, { short: true }), x + w / 2, y + 1); }
      }
      g.globalAlpha = 1;
    }
    // 키 모양
    for (let i = 0; i < lanes; i++) {
      const x = bx + i * laneW, col = lanes === 8 ? LANE8_COLOR[i] : LANE4_COLOR[i];
      g.fillStyle = held[i] ? col : '#2e241a'; round(x + 6, lineY + 18, laneW - 12, 46, 10); g.fill();
      g.strokeStyle = col; g.lineWidth = 2; round(x + 6, lineY + 18, laneW - 12, 46, 10); g.stroke();
      g.fillStyle = held[i] ? '#1a1208' : '#f3e8d6'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 17px "Noto Sans KR",sans-serif'; g.fillText(CAPS[lanes][i], x + laneW / 2, lineY + 34);
      if (lanes === 8) { g.font = '700 11px "Noto Sans KR",sans-serif'; g.fillStyle = held[i] ? '#1a1208' : col; g.fillText(LANE8[i], x + laneW / 2, lineY + 53); }
    }
    // 반짝
    fx = fx.filter(f => t - f.at < 0.3);
    for (const f of fx) {
      const u = (t - f.at) / 0.3, x = bx + f.lane * laneW + laneW / 2;
      g.globalAlpha = 1 - u; g.strokeStyle = f.color || 'rgba(255,255,255,.6)'; g.lineWidth = f.kind === 'hit' ? 4 : 2;
      g.beginPath(); g.ellipse(x, lineY, laneW * (0.35 + u * 0.4), 14 + u * 16, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    // 판정 글자 · 콤보
    if (state === 'play' && judgeShow && t >= judgeShow.at && t - judgeShow.at < 0.55) {
      const J = JUDGE[judgeShow.kind], u = (t - judgeShow.at) / 0.55;
      g.globalAlpha = 1 - u * u; g.fillStyle = J.c; g.font = `900 ${34 - u * 6}px "Noto Sans KR",sans-serif`; g.textAlign = 'center';
      g.fillText(J.ko, bx + boardW / 2, H * 0.42); g.globalAlpha = 1;
    }
    if (stats && stats.combo >= 3) { g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '900 46px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.fillText(String(stats.combo), bx + boardW / 2, H * 0.28); g.font = '800 13px "Noto Sans KR",sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('콤보', bx + boardW / 2, H * 0.28 + 32); }
    // 왼쪽: 점수 · 진행
    const sc = stats ? Math.round(1e6 * stats.sum / Math.max(1, stats.count)) : 0;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#a8977d'; g.font = '700 13px "Noto Sans KR",sans-serif'; g.fillText('점수', 24, 40);
    g.fillStyle = '#f3e8d6'; g.font = '900 30px "Noto Sans KR",sans-serif'; g.fillText(sc.toLocaleString(), 24, 74);
    if (stats) { g.font = '700 13px "Noto Sans KR",sans-serif'; ['perfect', 'great', 'good', 'miss'].forEach((k, i) => { g.fillStyle = JUDGE[k].c; g.fillText(`${JUDGE[k].ko} ${stats[k]}`, 24, 108 + i * 22); }); }
    const total = chart.length ? chart[chart.length - 1].t + chart[chart.length - 1].d : 1;
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(bx, 8, boardW, 5); g.fillStyle = '#f2a93b'; g.fillRect(bx, 8, Math.max(0, Math.min(1, t / total)) * boardW, 5);
    // 오른쪽: 응원 몬스터
    if (cheer.complete && cheer.naturalWidth) { const jump = Math.max(0, 1 - (t - cheerT) / 0.25); const sz = 120; g.drawImage(cheer, W - sz - 30, H - sz - 70 - jump * 26, sz, sz); }
    // 세어 주기
    if (state === 'play' && t < 0) { const beat = 60 / (song.tempo * effTempo()); g.fillStyle = 'rgba(255,255,255,.92)'; g.font = '900 90px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.ceil(-t / beat)), bx + boardW / 2, H * 0.45); }
  }
  function round(x, y, w, hh, r) { r = Math.min(r, hh / 2, w / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // ── 흐름 ──
  function loop() { if (state !== 'play') return; sweep(now()); draw(); raf = requestAnimationFrame(loop); }
  function start() {
    engine.ensure(); engine.setReverb(0.1);
    makeChart(); held = {}; fx = []; judgeShow = null;
    built = buildEvents(song, { scale: effTempo(), countIn: song.beats, melody: guide, harm: guide });
    t0 = player.start(built.events.map(e => e.track === 'melody' ? { ...e, vel: 0.35 } : e), { total: built.total + 0.6, onEnd: () => finish() });
    state = 'play'; over.style.display = 'none';
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    try { stage.focus(); } catch {}
  }
  function stop() { player.stop(); state = 'ready'; cancelAnimationFrame(raf); for (const c of chart) c.voice && c.voice.stop(); draw(); showReady(); }
  async function finish() {
    tEnd = now(); sweep(1e9); state = 'done'; cancelAnimationFrame(raf); draw();
    const acc = Math.round(1000 * stats.sum / Math.max(1, stats.count)) / 10;
    const score = Math.round(1e6 * stats.sum / Math.max(1, stats.count));
    const grade = acc >= 95 ? 'S' : acc >= 88 ? 'A' : acc >= 75 ? 'B' : acc >= 60 ? 'C' : 'D';
    const res = { score, acc, maxCombo: stats.maxCombo, grade };
    const tops = h('div', { class: 'r-tops' }, h('span', { class: 'muted' }, '기록을 저장하는 중…'));
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'p-card r-card' },
      h('div', { class: 'grade g-' + grade }, grade),
      h('h2', {}, score.toLocaleString() + '점'),
      h('p', { class: 'muted' }, `난이도 ${LEVELS[level].name}${LEVELS[level].tempo !== 1 ? ' · 빠르기 ×' + LEVELS[level].tempo : ''}`),
      h('p', {}, `정확도 ${acc}% · 최대 콤보 ${stats.maxCombo}`),
      h('p', { class: 'muted' }, ['perfect', 'great', 'good', 'miss'].map(k => `${JUDGE[k].ko} ${stats[k]}`).join(' · ')),
      tops,
      h('div', { class: 'stars-row' }, h('button', { class: 'btn primary', onclick: () => start() }, '다시 하기'), h('button', { class: 'btn', onclick: () => ctx.go('#/pick/rhythm') }, '다른 곡'))));
    try {
      const r = await ctx.store.saveRhythm(levelKey(), res);
      const list = await ctx.store.topRhythm(levelKey(), 3);
      tops.replaceChildren(r.newBest ? h('p', { class: 'newbest' }, r.prev ? `새 최고 기록! (전 ${r.prev.toLocaleString()})` : '첫 기록!') : h('p', { class: 'muted' }, '내 최고 기록은 그대로예요'),
        list.length ? h('div', { class: 'r-board' }, h('b', {}, `이 곡 우리 반 최고 · ${LEVELS[level].name}`), ...list.map((x, i) => h('span', {}, `${i + 1}. ${x.n || '친구'} ${Number(x.best).toLocaleString()} (${x.grade})`))) : null);
    } catch (e) { console.warn(e); tops.replaceChildren(h('p', { class: 'muted' }, '기록을 저장하지 못했어요')); }
  }
  function showReady() {
    over.style.display = 'grid';
    const guideBtn = h('button', { class: 'btn small' + (guide ? ' on' : ''), onclick: () => { guide = !guide; guideBtn.classList.toggle('on', guide); } }, '가락 도와주기');
    over.replaceChildren(h('div', { class: 'p-card' },
      h('h2', {}, song.title || '곡'),
      h('p', { class: 'lv-line' }, `난이도 ${LEVELS[level].name}`, LEVELS[level].extra ? ' · 테두리 음표 = 화음(두 키 같이)' : '', LEVELS[level].hide ? ' · 음표가 판정선 앞에서 사라져요' : ''),
      h('p', { class: 'muted' }, lanes === 8 ? '건반처럼: 왼손 A S D F = 도 레 미 파 · 오른손 J K L ; = 솔 라 시 높은 도' : '4줄: D F J K — 가락이 올라가면 오른쪽, 내려가면 왼쪽'),
      h('p', { class: 'muted' }, '길게 이어진 음표는 끝까지 누르고 있어요. 화면을 눌러서 칠 수도 있어요.'),
      h('div', { class: 'stars-row' }, guideBtn),
      h('button', { class: 'btn primary big', onclick: () => start() }, '▶ 시작'),
      h('p', { class: 'muted small' }, 'Esc = 그만')));
  }
  // 입력 — 키보드(반복 무시) · 화면 누르기
  const onDown = e => {
    if (e.code === 'Escape' && state === 'play') { stop(); return; }
    const i = KEYS[lanes].indexOf(e.code);
    if (i < 0) { if (e.code === 'Space' && state !== 'play') { e.preventDefault(); start(); } return; }
    e.preventDefault();
    if (e.repeat) return;
    press(i);
  };
  const onUp = e => { const i = KEYS[lanes].indexOf(e.code); if (i >= 0) release(i); };
  addEventListener('keydown', onDown); addEventListener('keyup', onUp);
  const laneAt = x => { const laneW = Math.min(lanes === 8 ? 84 : 116, (W - 360) / lanes), bx = (W - laneW * lanes) / 2; const i = Math.floor((x - bx) / laneW); return i >= 0 && i < lanes ? i : -1; };
  const touch = new Map();
  cv.addEventListener('pointerdown', e => { const i = laneAt(e.offsetX); if (i < 0) return; touch.set(e.pointerId, i); press(i); });
  const up = e => { if (touch.has(e.pointerId)) { release(touch.get(e.pointerId)); touch.delete(e.pointerId); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const ro = new ResizeObserver(() => size()); ro.observe(stage);
  makeChart(); showReady(); size();
  cheer.onload = () => draw();
  if (/[?&]debug=1/.test(location.search)) window.__rhythm = { chart: () => chart, now, press, release, stats: () => stats, start, state: () => state, setLevel: v => { level = v; lanes = LEVELS[v].lanes; WIN = LEVELS[v].win; makeChart(); } };   // 시험용(주소에 debug=1 일 때만)
  return { unmount() { player.stop(); cancelAnimationFrame(raf); removeEventListener('keydown', onDown); removeEventListener('keyup', onUp); ro.disconnect(); for (const c of chart) c.voice && c.voice.stop(); } };
}
