// 리코더 연습 — 음표 발판이 오른쪽에서 흘러오고, 몬스터가 박에 맞춰 발판을 밟는다. 왼쪽 = 지금 음의 큰 운지.
//  소리를 듣고 틀린 음을 잡지는 않는다(마이크 없음). 끝나면 스스로 별을 매기고 '리코더 기록장'에 쌓인다.
import { h, toast, lsGet, lsSet, READY_SEC, readyCount } from './util.js';
import { solfege, colorOf, totalSteps } from './theory.js';
import { buildEvents } from './song.js';
import { engine, Player } from './audio.js';
import { fingerSVG, fingering, SYSTEMS } from './recorder.js';
import { TOGETHER_KEY, partnersOf, pickPartners, partLabel, partnerEvents, withPartners, ghostNotes, tapFired } from './ensemble.js';   // [MUSIC-ENSEMBLE-1] 합주 연습

//  [MUSIC-FAST-1] 원래 빠르기보다 빠르게도(사용자 10-06 '원래 빠르기보다 더 빠르게도 · 리코더도') — 1.2 · 1.4 · 1.6배
const SPEEDS = [[0.6, '느리게'], [0.8, '조금 느리게'], [1, '원래 빠르기'], [1.2, '조금 빠르게'], [1.4, '빠르게'], [1.6, '아주 빠르게']];
const HOPPERS = ['m1', 'm22', 'm27', 'm24'];

//  [MUSIC-ENSEMBLE-1] 연습 소리 사건 — 가락(리코더 · '가락 소리'는 Player.mute 로 끄고 켬) + 반주(세기 ×0.7) + 함께 연주(짝 부분 · 켰을 때만 · 세기 그대로)
//   짝 부분은 이 곡의 offset · stepDur 로 얹으니 빠르기(0.6~1.6) · 세기 박이 바뀌어도 칸이 같으면 시각이 똑같다. start() 와 시험(ensemble.test)이 같이 쓴다
export function practiceEvents(song, { speed = 1, acc = true, partners = [], together = false } = {}) {
  //  [MUSIC-ORCH-1] 오케스트라 곡 — '반주'를 끄면 오케스트라도 끔(orch: acc) · 가락은 아이가 부는 높이 그대로(lead: false) · 늘이기(점점 느리게)는 안 함
  const built = buildEvents(song, { scale: speed, countIn: song.beats, melody: true, chord: acc && song.acc.chord, bass: acc && song.acc.bass, drum: acc ? song.acc.drum : 'none', orch: acc, lead: false });
  const events = built.events.map(e => e.track === 'melody' ? { ...e, inst: 'recorder', vel: 0.75 } : { ...e, vel: (e.vel || 0.8) * 0.7 });
  return withPartners({ ...built, events }, together ? partnerEvents(song, partners, built) : []);
}

export function mountPractice(root, ctx, { song, key }) {
  let speed = 0.8, guide = true, acc = true, sys = ctx.sys(), state = 'ready', raf = 0, t0 = 0, built = null, lastIdx = -2, alive = true;
  const player = new Player(engine);
  //  [MUSIC-ENSEMBLE-1] 함께 연주 — 이 곡이 합주의 한 부분이면(선생님 곡 목록을 읽은 뒤) 윗줄에 켬 · 끔(처음 = 켬 · 이 기기에 기억) + '함께: 2부'
  //   부분이 셋 이상이면 칩 대신 작은 고르기(모두 · 한 부분) · 치는 중에 바꾸면 처음부터(가락 소리 · 반주와 같음) · 반주를 꺼도 함께 연주는 따로
  let together = lsGet(TOGETHER_KEY, true) !== false, partners = [], pick = 'all', ghost = [];
  const activePartners = () => pickPartners(partners, pick);
  const fired = [];   // 시험용(?debug=1) — Player 가 소리 장치에 넘긴 사건
  const notes = [...song.notes].sort((a, z) => a.s - z.s);
  const pitches = [...new Set(notes.map(n => n.p))].sort((a, z) => a - z);
  // [MUSIC-REST-1] 쉼표 — 음과 음 사이 빈 곳(처음·끝 포함). 발판처럼 보여서 '여기서 쉬어요'를 눈으로 센다
  const rests = [];
  { let at = 0; for (const n of notes) { if (n.s > at) rests.push({ s: at, d: n.s - at }); at = Math.max(at, n.s + n.d); } const end = totalSteps(song); if (end > at) rests.push({ s: at, d: end - at }); }
  const hopper = new Image(); hopper.src = `../assets/monsters/${HOPPERS[(song.title || '').length % HOPPERS.length]}.png`;

  const sel = (opts, val, on) => h('select', { onchange: e => on(e.target.value) }, ...opts.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(val)) o.selected = true; return o; }));
  const tog = (label, get, set) => { const b = h('button', { class: 'btn small' + (get() ? ' on' : ''), onclick: () => { set(!get()); b.classList.toggle('on', get()); if (state === 'play') restart(); } }, label); return b; };
  const ensTog = tog('🎶 함께 연주', () => together, v => { together = v; lsSet(TOGETHER_KEY, v); ensShow(); });
  ensTog.title = '같은 곡의 다른 부분이 같이 연주해요';
  const ensChip = h('span', { class: 'ens-chip' });
  let ensSel = null;
  const ensBox = h('span', { class: 'ens-box', style: { display: 'none' } }, ensTog, ensChip);
  function ensShow() {
    ghost = together ? ghostNotes(activePartners()) : [];
    ensBox.style.display = partners.length ? '' : 'none';
    if (partners.length > 1 && !ensSel) {
      ensSel = sel([['all', '함께: 모두'], ...partners.map(q => [q.tk, '함께: ' + q.part])], pick, v => { pick = v; ensShow(); if (state === 'play') restart(); });
      ensSel.classList.add('ens-sel'); ensSel.title = '같이 연주할 부분'; ensBox.append(ensSel);
    }
    ensChip.textContent = '함께: ' + partLabel(activePartners());
    ensChip.style.display = together && partners.length === 1 ? '' : 'none';
    if (ensSel) ensSel.style.display = together ? '' : 'none';
    if (state === 'ready') showReady();
    draw(currentTime());
  }
  const top = ctx.topBar('리코더 연습 · ' + (song.title || '곡'), {
    back: () => ctx.go('#/pick/practice'),
    right: [sel(SPEEDS, speed, v => { speed = +v; if (state === 'play') restart(); }),
      tog('가락 소리', () => guide, v => { guide = v; }), tog('반주', () => acc, v => { acc = v; }), ensBox,
      sel(Object.entries(SYSTEMS), sys, v => { sys = v; ctx.setSys(v); lastIdx = -2; })],
  });
  const bigF = h('div', { class: 'p-big' }), bigName = h('div', { class: 'p-name' }), nextBox = h('div', { class: 'p-next' });
  const left = h('div', { class: 'p-left' }, h('div', { class: 'p-cap' }, '지금 음'), bigName, bigF, nextBox);
  const cv = h('canvas', { class: 'p-cv' });
  const over = h('div', { class: 'p-over' });
  const lyric = h('div', { class: 'p-lyric' });
  const stage = h('div', { class: 'p-stage' }, cv, lyric, over);
  root.replaceChildren(top, h('div', { class: 'view p-view' }, left, stage));
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = stage.clientWidth; H = stage.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(currentTime());
  }

  // ── 시간 ──
  const beatSec = () => 60 / (song.tempo * speed);
  const stepSec = () => beatSec() / song.sub;
  const off = () => (built ? built.offset : 0);
  const currentTime = () => state === 'play' ? engine.now - t0 - off() : state === 'done' ? (built ? built.total - off() : 0) : -beatSec() * song.beats;
  const noteT = n => n.s * stepSec();
  const idxAt = t => { let k = -1; for (let i = 0; i < notes.length; i++) { if (noteT(notes[i]) <= t + 0.02) k = i; else break; } return k; };

  const restAt = t => rests.find(r => r.s * stepSec() <= t + 0.02 && t < (r.s + r.d) * stepSec() - 0.02) || null;
  // ── 왼쪽 운지 ──  쉬는 동안에는 '숨 쉬고 다음 음 준비'(다음 음 운지를 크게)
  function showFinger(i, rest = null) {
    const key = rest ? 'r' + rest.s : i;
    if (key === lastIdx) return;
    lastIdx = key;
    if (rest) {
      const nx = notes.find(n => n.s >= rest.s + rest.d);
      bigF.replaceChildren(...(nx ? [fingerSVG(nx.p, { size: Math.min(300, stage.clientHeight - 150), sys, prev: i >= 0 ? notes[i]?.p : null })] : []));
      bigName.replaceChildren(h('b', { class: 'rest-now' }, '쉼'), h('small', { class: 'rest-sub' }, nx ? `숨 쉬고 · 다음 '${solfege(nx.p, { short: true })}' 준비` : '끝까지 쉬어요'));
      nextBox.replaceChildren(h('span', {}, `${(rest.d / song.sub)}박 쉬어요`));
      return;
    }
    const n = notes[Math.max(0, i)], nx = notes[i + 1];
    const p = i < 0 ? notes[0]?.p : n?.p;
    if (p == null) return;
    bigF.replaceChildren(fingerSVG(p, { size: Math.min(300, stage.clientHeight - 150), sys, prev: i > 0 ? notes[i - 1].p : null }));
    bigName.replaceChildren(...[h('b', { style: { color: colorOf(p) } }, solfege(p)), fingering(p, sys) ? null : h('small', {}, `${SYSTEMS[sys]}으로는 불 수 없는 음`)].filter(Boolean));
    nextBox.replaceChildren(...(i >= 0 && nx ? [h('span', {}, '다음'), fingerSVG(nx.p, { size: 110, sys, prev: p, label: false }), h('b', { style: { color: colorOf(nx.p) } }, solfege(nx.p, { short: true }))] : i < 0 ? [h('span', {}, '첫 음부터 준비!')] : []));
  }

  // ── 그리기 ──
  function draw(t) {
    if (!W) return;
    g.clearRect(0, 0, W, H);
    const playX = Math.round(W * 0.22), pxBeat = 118, pxSec = pxBeat / beatSec();
    const topM = 42, botM = song.notes.some(n => n.w) ? 70 : 36;
    const rows = pitches.length, rowH = Math.max(22, Math.min(64, (H - topM - botM) / Math.max(rows, 4)));
    const used = rowH * rows, y0 = topM + (H - topM - botM - used) / 2;
    const yOf = p => y0 + (rows - 1 - pitches.indexOf(p)) * rowH + rowH / 2;
    // 줄과 이름
    g.textBaseline = 'middle';
    for (const p of pitches) { const y = yOf(p); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // 마디선
    const bs = song.beats * song.sub;
    for (let b = 0; b <= song.bars; b++) {
      const x = playX + (b * bs * stepSec() - t) * pxSec;
      if (x < -2 || x > W + 2) continue;
      g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, topM - 10); g.lineTo(x, H - botM + 10); g.stroke();
    }
    // 발판
    const ph = Math.max(14, rowH * 0.56);
    // 쉼표 발판 — 음 줄 가운데에 점선 칸. 지금 쉬는 칸은 밝게
    const yMid = y0 + used / 2;
    for (const r of rests) {
      const x = playX + (r.s * stepSec() - t) * pxSec, w = Math.max(10, r.d * stepSec() * pxSec - 6);
      if (x > W + 10 || x + w < -10) continue;
      const now = r.s * stepSec() <= t && t < (r.s + r.d) * stepSec(), past = (r.s + r.d) * stepSec() < t;
      g.globalAlpha = past ? 0.25 : 1;
      g.setLineDash([6, 5]); g.lineWidth = now ? 2.5 : 1.6; g.strokeStyle = now ? '#ffe48f' : 'rgba(255,255,255,.45)';
      g.fillStyle = now ? 'rgba(255,228,143,.12)' : 'rgba(255,255,255,.05)';
      round(x, yMid - ph * 0.42, w, ph * 0.84, 10); g.fill(); g.stroke(); g.setLineDash([]);
      if (w >= 34) { g.fillStyle = now ? '#ffe48f' : 'rgba(255,255,255,.7)'; g.font = '800 12px "Noto Sans KR","Noto Music",sans-serif'; g.textAlign = 'left'; g.fillText(w >= 70 ? '쉼 · 숨 쉬기' : '쉼', x + 8, yMid + 1); }
      g.globalAlpha = 1;
    }
    notes.forEach((n, i) => {
      const x = playX + (noteT(n) - t) * pxSec, w = Math.max(10, n.d * stepSec() * pxSec - 6);
      if (x > W + 10 || x + w < -10) return;
      const y = yOf(n.p) - ph / 2;
      const past = noteT(n) + n.d * stepSec() < t, now = noteT(n) <= t && t < noteT(n) + n.d * stepSec();
      g.globalAlpha = past ? 0.32 : 1;
      g.fillStyle = 'rgba(0,0,0,.28)'; round(x + 2, y + 5, w, ph, 8); g.fill();
      g.fillStyle = colorOf(n.p); round(x, y, w, ph, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)'; round(x + 3, y + 3, w - 6, ph * 0.32, 5); g.fill();
      if (now) { g.strokeStyle = '#fff'; g.lineWidth = 3; round(x - 1.5, y - 1.5, w + 3, ph + 3, 9); g.stroke(); }
      if (w >= 26) { g.fillStyle = '#fff'; g.font = '900 13px "Noto Sans KR",sans-serif'; g.textAlign = 'left'; g.fillText(solfege(n.p, { short: true }), x + 7, y + ph / 2 + 1); }
      g.globalAlpha = 1;
    });
    // [MUSIC-ENSEMBLE-1] 함께 연주 — 짝 부분 음표를 맨 아래 얇은 줄에(언제 같이 나오는지만 · 높이는 안 그림 · 화면을 어지럽히지 않게)
    if (ghost.length) {
      const gy = H - 15, gh = 7;
      g.fillStyle = 'rgba(127,196,240,.07)'; g.fillRect(0, gy - 3, W, gh + 6);
      for (const n of ghost) {
        const a = n.s * stepSec(), z = (n.s + n.d) * stepSec(), x = playX + (a - t) * pxSec, w = Math.max(4, (z - a) * pxSec - 3);
        if (x > W + 10 || x + w < -10) continue;
        g.fillStyle = a <= t && t < z ? 'rgba(191,227,255,.95)' : z < t ? 'rgba(127,196,240,.2)' : 'rgba(127,196,240,.55)';
        round(x, gy, w, gh, 3); g.fill();
      }
      g.fillStyle = 'rgba(16,22,18,.88)'; g.fillRect(0, gy - 5, 40, gh + 10);
      g.fillStyle = '#bfe3ff'; g.font = '800 10px "Noto Sans KR",sans-serif'; g.textAlign = 'left'; g.fillText('함께', 7, gy + gh / 2 + 1);
    }
    // 줄 이름(발판 위에 덮어 그림)
    g.fillStyle = 'rgba(16,22,18,.82)'; g.fillRect(0, topM - 12, 40, H - topM - botM + 24);
    g.font = '800 13px "Noto Sans KR",sans-serif'; g.textAlign = 'left';
    for (const p of pitches) { g.fillStyle = colorOf(p); g.fillText(solfege(p, { short: true }) + (p >= 72 ? '˙' : ''), 10, yOf(p)); }
    // 지금 선
    const grd = g.createLinearGradient(playX - 14, 0, playX + 14, 0);
    grd.addColorStop(0, 'rgba(255,228,143,0)'); grd.addColorStop(0.5, 'rgba(255,228,143,.35)'); grd.addColorStop(1, 'rgba(255,228,143,0)');
    g.fillStyle = grd; g.fillRect(playX - 14, topM - 18, 28, H - topM - botM + 36);
    g.fillStyle = '#ffe48f'; g.fillRect(playX - 1.5, topM - 18, 3, H - topM - botM + 36);
    // 몬스터 — 발판 위에서 다음 발판으로 포물선
    if (notes.length && hopper.complete && hopper.naturalWidth) {
      const k = idxAt(t), cur = notes[Math.max(0, k)], nx = notes[k + 1];
      const sz = Math.max(46, Math.min(78, rowH * 1.25));
      let yy = yOf(cur.p) - ph / 2;
      if (k >= 0 && nx) {
        const z = noteT(nx), a = Math.max(noteT(cur) + cur.d * stepSec() * 0.55, z - 0.42);   // 쉬는 동안은 발판에 앉아 기다렸다 다음 음 직전에 뜀
        if (t > a && z > a) { const u = Math.min(1, (t - a) / (z - a)); const ya = yOf(cur.p), yb = yOf(nx.p); yy = (ya + (yb - ya) * u) - ph / 2 - Math.sin(Math.PI * u) * (rowH * 0.9 + 18); }
      } else if (k < 0) yy = yOf(notes[0].p) - ph / 2;
      const squash = k >= 0 && t - noteT(cur) < 0.08 ? 0.9 : 1;
      g.drawImage(hopper, playX - sz / 2, yy - sz * squash + 4, sz, sz * squash);
    }
    // 진행 막대
    const total = built ? built.total - off() : notes.length ? (notes[notes.length - 1].s + notes[notes.length - 1].d) * stepSec() : 1;
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(16, 14, W - 32, 6);
    g.fillStyle = '#f2a93b'; g.fillRect(16, 14, Math.max(0, Math.min(1, t / total)) * (W - 32), 6);
    // 세어 주기
    if (state === 'play' && t < 0) readyCount(g, t, off(), beatSec(), song.beats, W * 0.6, H / 2);   // [MUSIC-READY-1] 3 · 2 · 1 → 하나 둘 셋 넷
    showFinger(t < 0 ? -1 : idxAt(t), t >= 0 ? restAt(t) : null);
    // 노랫말
    if (song.notes.some(n => n.w)) {
      const k = idxAt(t), from = Math.max(0, k - 6);
      lyric.replaceChildren(...notes.slice(from, from + 16).map((n, j) => h('span', { class: from + j === k ? 'now' : from + j < k ? 'past' : '' }, n.w || '·')));
    }
  }
  function round(x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ── 흐름 ──
  function loop() { draw(currentTime()); if (state === 'play') raf = requestAnimationFrame(loop); }
  function start() {
    engine.ensure(); engine.setReverb(0.1);
    built = practiceEvents(song, { speed, acc, partners: activePartners(), together });   // [MUSIC-ENSEMBLE-1] 가락 · 반주 · 함께 연주
    player.mute = { melody: !guide, sparkle: !guide };   // '가락 소리'를 끄면 가락을 따라 치는 반짝이(첼레스타)도 쉼
    fired.length = 0;
    t0 = player.start(built.events, { at: engine.now + READY_SEC + 0.1, total: built.total, onEnd: () => finish() });   // [MUSIC-READY-1] 3초 뒤에 반주가 시작(리코더를 들 시간)
    state = 'play'; over.replaceChildren(); over.style.display = 'none';
    stopBtn.style.display = '';
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function restart() { player.stop(); start(); }
  function stop() { player.stop(); state = 'ready'; cancelAnimationFrame(raf); stopBtn.style.display = 'none'; lastIdx = -2; draw(currentTime()); showReady(); }
  function finish() {
    state = 'done'; cancelAnimationFrame(raf); stopBtn.style.display = 'none'; draw(currentTime());
    over.style.display = 'grid';
    const stars = [3, 2, 1].map(n => h('button', { class: 'star-btn', onclick: () => rate(n) }, h('b', {}, '★'.repeat(n)), h('span', {}, { 3: '잘 불었어요', 2: '조금 틀렸어요', 1: '어려웠어요' }[n])));
    over.replaceChildren(h('div', { class: 'p-card' }, h('img', { src: hopper.src, alt: '' }), h('h2', {}, '끝까지 불었어요!'), h('p', { class: 'muted' }, '스스로 생각해 보면 어땠나요?'), h('div', { class: 'stars-row' }, ...stars)));
  }
  async function rate(n) {
    let count = null;
    try { count = await ctx.store.addPractice(key, song.title, { sp: speed, stars: n }); } catch (e) { console.warn(e); toast('기록을 저장하지 못했어요'); }
    over.replaceChildren(h('div', { class: 'p-card' }, h('img', { src: hopper.src, alt: '' }),
      h('h2', {}, count ? `이 곡 ${count}번째 연습!` : '연습 끝!'), h('p', { class: 'muted' }, n === 3 ? (speed >= SPEEDS[SPEEDS.length - 1][0] ? '아주 빠르게까지 해냈어요! 대단해요.' : `좋아요! 다음엔 '${SPEEDS[SPEEDS.findIndex(x => x[0] === speed) + 1]?.[1] || '조금 빠르게'}'(으)로 한 단계 올려 볼까요?`) : n === 2 ? '틀린 곳 앞에서 운지를 한 번 더 보고 불어 봐요.' : '느리게로 바꿔서 한 번 더 해 봐요. 가락 소리를 켜고 따라 하면 쉬워요.'),
      h('div', { class: 'stars-row' }, h('button', { class: 'btn primary', onclick: () => start() }, '한 번 더'), h('button', { class: 'btn', onclick: () => ctx.go('#/log') }, '리코더 기록장'), h('button', { class: 'btn', onclick: () => ctx.go('#/pick/practice') }, '다른 곡'))));
  }
  function showReady() {
    over.style.display = 'grid';
    const bad = notes.filter(n => !fingering(n.p, sys)).length;
    over.replaceChildren(h('div', { class: 'p-card' },
      h('h2', {}, song.title || '곡'),
      h('p', { class: 'muted' }, `${song.bars}마디 · 음 ${notes.length}개 · 처음에 ${song.beats}번 세고 시작해요`),
      bad ? h('p', { class: 'warn' }, `${SYSTEMS[sys]} 리코더로 불 수 없는 음이 ${bad}개 있어요(물음표).`) : null,
      partners.length ? h('p', { class: 'ens-line' }, together ? `🎶 함께 연주: ${partLabel(activePartners())} 소리도 같이 나와요` : `🎶 '함께 연주'를 켜면 ${partLabel(partners)} 소리도 같이 나와요`) : null,   // [MUSIC-ENSEMBLE-1]
      h('button', { class: 'btn primary big', onclick: () => start() }, '▶ 시작'),
      h('p', { class: 'muted small' }, '스페이스 키로도 시작 · 멈춤')));
  }
  const stopBtn = h('button', { class: 'btn p-stop', style: { display: 'none' }, onclick: () => stop() }, '■ 그만');
  stage.append(stopBtn);
  const onKey = e => { if (e.code === 'Space') { e.preventDefault(); state === 'play' ? stop() : start(); } };
  addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => size()); ro.observe(stage);
  hopper.onload = () => draw(currentTime());
  showReady(); size();
  //  [MUSIC-ENSEMBLE-1] 짝 부분 찾기 — 선생님 곡이고 합주로 묶일 때만(목록은 이미 읽어 둔 것 · 못 읽으면 함께 연주 없이 그대로)
  if (song.ts && ctx.teacherSongs) ctx.teacherSongs().then(list => { if (!alive) return; partners = partnersOf(song, list); if (partners.length) ensShow(); }).catch(() => {});
  //  시험용(?debug=1 일 때만) — Player 가 소리 장치에 넘긴 사건 · 짝 사건 계획(읽기만 · 복사본)
  if (/[?&]debug=1/.test(location.search)) {
    tapFired(player, fired, () => engine.now);
    window.__practice = { fired: () => fired.map(x => ({ ...x })), plan: () => (built ? built.events.filter(e => e.track === 'partner').map(e => ({ ...e })) : []),
      built: () => (built ? { offset: built.offset, stepDur: built.stepDur, total: built.total, t0 } : null), state: () => state, speed: () => speed, guide: () => guide, acc: () => acc,
      together: () => together, partners: () => partners.map(q => q.tk), active: () => (together ? activePartners().map(q => q.tk) : []), ghost: () => ghost.length };
  }
  return { unmount() { alive = false; player.stop(); cancelAnimationFrame(raf); removeEventListener('keydown', onKey); ro.disconnect(); } };
}
