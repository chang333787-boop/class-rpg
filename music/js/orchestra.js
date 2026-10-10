// 오케스트라 편곡 — 아이가 지은 가락 하나에 관현악 반주를 붙인다 [MUSIC-ORCH-1]
//  화면 · 소리 없음(node 로 시험 — scripts/unit/music/orchestra.test.mjs). song.js buildEvents 가 부르고, 나온 사건(칸 단위)을 초로 바꾼다.
//  song.orch = { on, preset(아래 PRESETS 이름), parts: { strings, bass, winds, brass, harp, perc, sparkle }(칸 켜고 끄기), dyn(셈여림 흐름), rit(점점 느리게 끝내기) }
//  편곡 원칙 — 초등 3~4학년이 '아, 오케스트라다' 하고 알아듣게 · 크롬북에서 가볍게:
//   · 화음 = 마디마다 fitChords(아이가 고른 I · IV · V 그대로) · 진행(prog)이 적힌 곡이면 박마다. V 다음이 I 이면 딸림7(가락과 안 부딪힐 때만)
//   · 칸마다 제 음역(아래 RANGE) — 낮은 현은 바닥, 화음은 가운데, 가락이 맨 위(화음이 가락 위로 안 올라감) · 앞 화음에서 가장 적게 움직이는 자리(목소리 이끌기)
//   · 4마디 = 한 악구 — 악구 끝 마디에서 금관 · 현이 부풀고(swell), 타악기는 악구 처음 · 끝에 · 마지막 마디 = 으뜸화음을 길게 + 팀파니 굴리기 + 심벌즈
//   · 셈여림 흐름(dyn)은 반주 세기에 곱한다(0.35 ~ 1.1) · 가락은 조금만 따른다(늘 또렷하게 — song.js)
//  사건 모양: 음 { s 시작 칸(소수 가능), d 칸 수, inst, p 음 높이(MIDI), vel, track, art? } · 북 { s, kind: 'drum', drum, vel, track: 'perc', span? 칸 수 }
import { SCALES, chordPcs, chordRoot, chordName, chordByName, fitChords, barSteps, totalSteps, pc } from './theory.js';

// ── 악기 음역(MIDI · 실제로 나는 소리 기준 · 60 = 가운데 도) ──
//  편곡이 칸마다 쓰는 자리는 이 안에서 더 좁게 잡는다(현 화음 50~72 · 낮은 현 첼로 38~55 / 콘트라베이스 28~43 · 호른 48~67 · 하프 43~84 · 팀파니 40~57)
export const RANGE = {
  violin: [55, 100],      // G3 ~ E7 — 가장 높은 현악기(가락을 많이 맡음)
  strings: [36, 96],      // 현악 합주(바이올린 · 비올라 · 첼로 여럿) C2 ~ C7
  cello: [36, 76],        // C2 ~ E5
  contrabass: [28, 67],   // E1 ~ G4(악보보다 한 옥타브 낮게 남)
  pizz: [28, 96],         // 현을 손가락으로 뜯기(어느 현이든)
  harp: [24, 103],        // C1 ~ G7(47줄)
  flute: [60, 96],        // C4 ~ C7
  clarinet: [50, 91],     // D3 ~ G6(B♭ 클라리넷 · 실제 소리)
  oboe: [58, 91],         // B♭3 ~ G6
  trumpet: [54, 82],      // F#3 ~ B♭5(실제 소리)
  horn: [41, 77],         // F2 ~ F5(F 호른 · 실제 소리)
  tuba: [28, 65],         // E1 ~ F4
  celesta: [60, 108],     // C4 ~ C8(악보보다 한 옥타브 높게 남)
  glock: [79, 108],       // G5 ~ C8(악보보다 두 옥타브 높게 남)
  choir: [48, 81],        // 합창(테너 ~ 소프라노) C3 ~ A5
  timpani: [40, 57],      // E2 ~ A3(큰 북 넷)
};
// 예전 악기 — 가락 높이를 옮기지 않는다(오케스트라를 꺼도 켜도 전과 똑같은 높이)
const BASE_INSTS = ['piano', 'xylo', 'marimba', 'recorder', 'gayageum', 'pad', 'bass'];
// 가락을 맡을 때 그 악기다운 높이(가운데) — 첼로는 한 옥타브 아래 · 첼레스타는 위 · 글로켄슈필은 두 옥타브 위 · 없는 악기는 음역 안이면 그대로
const LEAD_HOME = { cello: 56, contrabass: 47, tuba: 46, celesta: 80, glock: 90 };

// ── 고르는 것들(화면 글은 초등 3~4학년 말로) ──
export const PARTS = {
  strings: { name: '현악기 화음', fam: 'str', desc: '바이올린 · 비올라가 화음을 길게 깔아요' },
  bass:    { name: '낮은 현', fam: 'str', desc: '첼로 · 콘트라베이스가 낮은 뿌리음을 받쳐요' },
  winds:   { name: '목관 화음', fam: 'wood', desc: '클라리넷 · 오보에가 가락 아래에서 함께 불어요' },
  brass:   { name: '금관', fam: 'brass', desc: '호른이 부풀었다 가라앉아요 · 행진곡은 튜바와 엇박' },
  harp:    { name: '하프', fam: 'str', desc: '화음을 한 음씩 펼쳐 뜯어요' },
  perc:    { name: '타악기', fam: 'perc', desc: '팀파니 · 심벌즈 · 큰북 · 트라이앵글' },
  sparkle: { name: '반짝이', fam: 'perc', desc: '첼레스타 · 글로켄슈필이 가락을 높은 데서 살짝' },
};
export const PART_KEYS = Object.keys(PARTS);
export const DYN = { flat: '그대로', cresc: '점점 크게', dim: '점점 작게', arch: '작게 → 크게 → 작게' };
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const P6 = (strings, bass, winds, brass, harp, perc, sparkle) => ({ strings, bass, winds, brass, harp, perc, sparkle });
//  편성 — lead = 가락 악기(고르면 바뀜) · parts = 처음 켜지는 칸 · 아래 글자들 = 칸마다 연주하는 꼴
//   strings: sustain 길게 · pahpah 쿵'짝짝'의 짝 · offbeat 엇박 · high 높고 여리게 / bass: arco 활 · pedal 길게 깔기 · waltz 첫 박 · oompah 행진 · pizz 뜯기
//   brass: pads 길게 · swell 부풂 · march 엇박 화음 + 튜바 · pahpah 짝 / harp: up 오르기 · wave 오르내리기 · gliss = 끝 마디 글리산도 / perc: 아래 percPart
export const PRESETS = {
  full:    { name: '관현악', emoji: '🏛️', line: '오케스트라 모두 함께 — 웅장하고 꽉 찬 소리', lead: 'violin', reverb: 0.3, rit: true, mix: 0.78, parts: P6(true, true, true, true, false, true, false),
             strings: 'sustain', bass: 'arco', winds: 'clarinet', brass: 'pads', harp: 'up', perc: 'full', sparkle: 'celesta',
             why: '바이올린이 가락 · 현악기가 화음 · 첼로와 콘트라베이스가 바닥 · 클라리넷이 가락 아래 3도 · 호른이 부풀고 · 팀파니와 심벌즈가 처음과 끝을 알려요' },
  strings: { name: '현악 합주', emoji: '🎻', line: '현악기끼리 — 부드럽고 따뜻하게', lead: 'cello', reverb: 0.28, rit: true, mix: 1.2, parts: P6(true, true, false, false, false, false, false),
             strings: 'sustain', bass: 'arco', winds: 'clarinet', brass: 'pads', harp: 'up', perc: 'soft', sparkle: 'celesta', swell: true,
             why: '첼로가 가락을 한 옥타브 낮게(첼로다운 높이) · 바이올린 · 비올라가 위에서 화음 · 콘트라베이스가 바닥 · 악구 끝에서 활을 부풀려요' },
  march:   { name: '행진곡', emoji: '🥁', line: '씩씩하게 발맞춰 — 트럼펫과 작은북이 앞장서요', lead: 'trumpet', reverb: 0.16, rit: false, mix: 0.8, parts: P6(false, false, true, true, false, true, true),
             strings: 'offbeat', bass: 'oompah', winds: 'clarinet', brass: 'march', harp: 'up', perc: 'march', sparkle: 'glock',
             why: '트럼펫이 가락 · 튜바가 센박에 쿵 · 호른이 엇박에 짝 · 작은북 · 큰북이 발걸음 · 글로켄슈필이 반짝 — 행진곡은 끝까지 같은 빠르기로 걸어요' },
  film:    { name: '영화 음악', emoji: '🎬', line: '넓은 화면처럼 — 길게 깔리는 현악기, 하프, 둥둥 큰북', lead: 'horn', reverb: 0.45, rit: true, mix: 0.66, parts: P6(true, true, false, true, true, true, false),
             strings: 'sustain', voicing: 'open', bass: 'pedal', winds: 'oboe', brass: 'swell', harp: 'up', gliss: true, perc: 'film', sparkle: 'celesta', swell: true,
             why: '호른이 가락 · 현악기가 넓게 펼친 화음 · 낮은 현이 길게 깔고 · 하프가 화음을 펼치고 · 악구마다 팀파니와 큰북이 둥 · 끝 마디 앞에서 심벌이 부풀어요' },
  waltz:   { name: '왈츠', emoji: '💃', line: '쿵 짝 짝 — 빙글빙글 춤추는 세 박자', lead: 'flute', reverb: 0.26, rit: true, mix: 1.05, parts: P6(true, true, false, true, false, true, false),
             strings: 'pahpah', bass: 'waltz', winds: 'clarinet', brass: 'pahpah', harp: 'wave', perc: 'waltz', sparkle: 'glock',
             why: '플루트가 가락 · 첫 박 = 낮은 현 \'쿵\' · 둘째 · 셋째 박 = 현악기 · 호른 \'짝 짝\' · 트라이앵글이 가끔 팅 — 3/4 박자에서 가장 왈츠다워요' },
  fairy:   { name: '동화 나라', emoji: '🧚', line: '반짝반짝 마법 상자 — 첼레스타 · 하프 · 트라이앵글', lead: 'celesta', reverb: 0.4, rit: true, mix: 0.8, parts: P6(true, true, true, false, true, true, true),
             strings: 'high', bass: 'pizz', winds: 'flute', brass: 'pads', harp: 'wave', gliss: true, perc: 'fairy', sparkle: 'glock',
             why: '첼레스타가 가락(한 옥타브 위) · 하프가 오르내리고 · 플루트가 아래에서 함께 · 첼로는 활 대신 손가락으로 퉁 · 글로켄슈필과 트라이앵글이 반짝 · 끝 마디는 하프 글리산도' },
};
export const PRESET_KEYS = Object.keys(PRESETS);

// ── 곡에 붙는 칸 살피기 ──  모르는 값 → 기본값(저장된 곡 · 친구 곡이 무엇을 담고 와도 안 깨지게)
export function defaultOrch(preset = 'full') {
  const P = PRESETS[has(PRESETS, preset) ? preset : 'full'];
  return { on: false, preset: has(PRESETS, preset) ? preset : 'full', parts: { ...P.parts }, dyn: 'flat', rit: P.rit };
}
export function normOrch(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const d = defaultOrch(typeof o.preset === 'string' ? o.preset : 'full');
  const parts = o.parts && typeof o.parts === 'object' ? o.parts : {};
  for (const k of PART_KEYS) if (typeof parts[k] === 'boolean') d.parts[k] = parts[k];
  d.on = o.on === true;
  if (typeof o.dyn === 'string' && has(DYN, o.dyn)) d.dyn = o.dyn;
  if (typeof o.rit === 'boolean') d.rit = o.rit;
  return d;
}
//  오케스트라는 서양 음계(5음 · 장음계)에서만 — 평조 · 계면조는 지속음 · 장단이 반주(국악다운 소리)
export const orchOK = song => !!(song && SCALES[song.scale] && has(SCALES, song.scale) && SCALES[song.scale].family === 'west');
export const orchOn = song => !!(song && song.orch && song.orch.on === true && orchOK(song));
//  편성 고르기 — 가락 악기 · 칸 · 울림 · 끝맺기를 그 편성 기본으로(셈여림 흐름은 아이가 고른 그대로)
export function applyPreset(song, key) {
  const P = PRESETS[has(PRESETS, key) ? key : 'full'];
  const cur = normOrch(song.orch);
  song.orch = { ...cur, on: true, preset: has(PRESETS, key) ? key : 'full', parts: { ...P.parts }, rit: P.rit };
  song.inst = P.lead; song.reverb = P.reverb;
  return song;
}

// ── 셈여림 흐름 ── x = 곡 안의 자리(0 처음 ~ 1 끝) → 반주 세기에 곱하는 수(0.35 ~ 1.1)
export function dynAt(dyn, x) {
  x = Math.max(0, Math.min(1, Number(x) || 0));
  if (dyn === 'cresc') return 0.45 + 0.65 * x;
  if (dyn === 'dim') return 1.05 - 0.7 * x;
  if (dyn === 'arch') return 0.45 + 0.65 * Math.sin(Math.PI * x);
  return 1;
}

// ── 점점 느리게(리타르단도) ── t0 ~ t1(끝 두 마디) 사이를 늘인다: 빠르기가 1 → 1/(1+k)(k = 0.75 → 끝에서 약 57%)로 차츰 느려짐
//  at(u) = 악보 시각 u → 실제 시각(단조 증가 · t0 앞은 그대로) · inv(w) = 그 거꾸로(작곡 화면 재생 막대가 소리를 따라가게)
export const RIT_K = 0.75;
export function ritWarp(t0, t1, k = RIT_K) {
  const L = Math.max(1e-6, t1 - t0), end = t1 + L * k / 3;
  const at = u => u <= t0 ? u : u >= t1 ? end + (u - t1) * (1 + k) : t0 + L * (((u - t0) / L) + k * Math.pow((u - t0) / L, 3) / 3);
  const inv = w => {
    if (w <= t0) return w;
    if (w >= end) return t1 + (w - end) / (1 + k);
    const y = (w - t0) / L; let x = y;
    for (let i = 0; i < 12; i++) x -= (x + k * x * x * x / 3 - y) / (1 + k * x * x);
    return t0 + L * Math.max(0, Math.min(1, x));
  };
  return { at, inv, end };
}

// ── 가락 악기 높이 ── 곡 전체를 옥타브 하나로만 옮긴다(가락 모양 그대로) · 예전 악기는 0
export function leadShift(song, inst = song && song.inst) {
  const r = RANGE[inst];
  if (!r || BASE_INSTS.includes(inst) || !song || !song.notes || !song.notes.length) return 0;
  let lo = Infinity, hi = -Infinity;
  for (const n of song.notes) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
  const mid = (lo + hi) / 2, home = LEAD_HOME[inst];
  let best = 0, cost = Infinity;
  for (const k of [0, -12, 12, -24, 24]) {
    const out = Math.max(0, r[0] - (lo + k)) + Math.max(0, hi + k - r[1]);   // 음역 밖으로 나간 반음 수
    const c = out * 10 + (home != null ? Math.abs(mid + k - home) : Math.abs(k) * 0.01);
    if (c < cost - 1e-9) { cost = c; best = k; }
  }
  return best;
}
//  줄 하나(높이 목록)를 옥타브 하나로 옮겨 음역에 넣는 값 · 같으면 prefer 에 가까운 것
function lineShift(ps, [lo, hi], prefer = 0, cands = [0, -12, 12, -24, 24, 36]) {
  let best = cands[0], cost = Infinity;
  for (const k of cands) {
    let out = 0; for (const p of ps) out += Math.max(0, lo - (p + k)) + Math.max(0, p + k - hi);
    const c = out * 10 + Math.abs(k - prefer) * 0.01;
    if (c < cost - 1e-9) { cost = c; best = k; }
  }
  return best;
}
const fit = (p, [lo, hi]) => { while (p < lo) p += 12; while (p > hi) p -= 12; return p; };

// ── 화음 줄 ── [{ s 시작 칸, d 칸 수, bar, name, root 반음, pcs 반음들, roman? }] · 마디선에서 끊는다(현이 마디마다 활을 바꾸게)
const progChord = (song, beat) => { const nm = song.prog[Math.floor(beat / (song.progEvery || 1)) % song.prog.length]; return nm === '-' ? null : chordByName(nm); };
export function chordLine(song) {
  const bs = barSteps(song), key = song.key || 0, segs = [];
  if (song.prog && song.prog.length) {
    for (let b = 0; b < song.bars; b++) for (let k = 0; k < song.beats; k++) {
      const c = progChord(song, b * song.beats + k), last = segs[segs.length - 1];
      if (last && last.bar === b && last.name === (c ? c.name : null)) { last.d += song.sub; continue; }
      segs.push({ s: b * bs + k * song.sub, d: song.sub, bar: b, name: c ? c.name : null, root: c ? c.root : null, pcs: c ? c.pcs.slice() : null });
    }
    return segs;
  }
  const ro = fitChords(song, song.chords);
  const seg = (s, d, b, r) => ({ s, d, bar: b, roman: r, name: chordName(r, key), root: chordRoot(r, key), pcs: chordPcs(r, key) });
  for (let b = 0; b < song.bars; b++) segs.push(seg(b * bs, bs, b, ro[b]));
  //  마침 — 끝 마디 화음을 아이가 안 골랐고(자동) I 이 아닌데 가락 마지막 음이 으뜸음(도)이고 박 위에서 시작하면, 그 음부터 I 로(마디 안에서 V → I · '레 레 도')
  //   반주 친구(예전 반주)는 마디마다 하나 그대로 — 오케스트라만 끝을 맺는다
  const lb = song.bars - 1, lg = segs[lb], tail = [...song.notes].sort((a, z) => a.s - z.s).pop();
  if (lg && lg.roman !== 'I' && !(song.chords && song.chords[lb]) && tail && pc(tail.p) === key && tail.s > lg.s && tail.s < lg.s + bs && tail.s % song.sub === 0) {
    lg.d = tail.s - lg.s;
    segs.push(seg(tail.s, lb * bs + bs - tail.s, lb, 'I'));
  }
  //  딸림7 — V 다음이 I(마침)일 때 7음을 더한다. 그 마디 가락에 7음 바로 아래 음(다장조면 미)이 있으면 부딪히니 안 더한다
  for (let i = 0; i + 1 < segs.length; i++) {
    const g = segs[i], nx = segs[i + 1];
    if (g.roman !== 'V' || nx.roman !== 'I') continue;
    const clash = (g.root + 9) % 12;
    if (song.notes.some(n => n.s < g.s + g.d && n.s + n.d > g.s && pc(n.p) === clash)) continue;
    g.pcs = [...g.pcs, (g.root + 10) % 12]; g.name += '7';
  }
  return segs;
}

// ── 화음 자리 잡기(목소리 이끌기) ── pcs 를 [lo, hi] 안에 쌓는 여러 자리 중 앞 화음에서 가장 적게 움직이는 것 · top = 이 높이 위로는 되도록 안 올라감(가락)
//  open = 넓게 펼친 자리(영화 음악 · 둘째로 높은 음을 한 옥타브 내림) · 낮은 데(52 아래)에서 촘촘한 화음은 탁해서 감점
function voicings(pcs, lo, hi, open) {
  const base = pcs.length === 3 ? (open ? [...pcs, pcs[0]] : pcs) : pcs.slice(0, 4);
  const out = [];
  for (let inv = 0; inv < base.length; inv++) {
    const order = [...base.slice(inv), ...base.slice(0, inv)];
    for (let st = lo; st < lo + 12; st++) {
      if (pc(st) !== order[0]) continue;
      const v = [st];
      for (let i = 1; i < order.length; i++) { let q = v[i - 1] + 1; while (pc(q) !== order[i]) q++; v.push(q); }
      for (let oct = 0; v[v.length - 1] + oct <= hi; oct += 12) {
        const w = v.map(x => x + oct);
        out.push(w);
        if (open && w.length >= 3) { const x = [...w]; x[x.length - 2] -= 12; x.sort((a, z) => a - z); if (x[0] >= lo - 7) out.push(x); }
      }
    }
  }
  return out;
}
export function voiceChord(pcs, [lo, hi], prev, top, open = false) {
  const avg = v => v.reduce((a, x) => a + x, 0) / v.length;
  const mid = (lo + hi) / 2;
  let best = null, bc = Infinity;
  for (const v of voicings(pcs, lo, hi, open)) {
    let c = 0;
    if (prev && prev.length === v.length) for (let i = 0; i < v.length; i++) c += Math.abs(v[i] - prev[i]);
    else c += Math.abs(avg(v) - (prev && prev.length ? avg(prev) : mid)) * v.length * 0.8;
    if (top != null && v[v.length - 1] >= top) c += (v[v.length - 1] - top + 1) * 5;
    for (let i = 1; i < v.length; i++) if (v[i] - v[i - 1] <= 4 && v[i - 1] < 52) c += 4;
    c += Math.abs(avg(v) - mid) * 0.15;
    if (c < bc - 1e-9) { bc = c; best = v; }
  }
  return best || [];
}
//  두 음(호른 둘) — 화음 음 둘(3 ~ 9 반음 사이) 중 앞에서 가장 적게 움직이는 것
function dyad(pcs, [lo, hi], prev) {
  const ts = []; for (let p = lo; p <= hi; p++) if (pcs.includes(pc(p))) ts.push(p);
  let best = null, bc = Infinity;
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const iv = ts[j] - ts[i]; if (iv < 3 || iv > 9) continue;
    const c = (prev ? Math.abs(ts[i] - prev[0]) + Math.abs(ts[j] - prev[1]) : Math.abs((ts[i] + ts[j]) / 2 - (lo + hi) / 2)) + (pc(ts[i]) === pcs[0] && pc(ts[j]) === pcs[0] ? 3 : 0);
    if (c < bc) { bc = c; best = [ts[i], ts[j]]; }
  }
  return best || [];
}
//  가락 음 아래 화음 음 — 센박 · 긴 음 · 화음 음이면 화음 음 중 3도(→ 4도 · 6도 · 5도) 아래 · 지나가는 음이면 음계로 두 칸 아래(나란한 3도)
export function harmBelow(p, chord, scalePcs, strong) {
  if (chord && (strong || chord.includes(pc(p)))) for (const iv of [4, 3, 5, 8, 9, 7]) if (chord.includes(pc(p - iv))) return p - iv;
  let q = p, k = 0;
  while (k < 2 && q > p - 12) { q--; if (scalePcs.includes(pc(q))) k++; }
  return k === 2 ? q : p - 3;
}

// ── 편곡 ──  o = { sd 한 칸 초(빠르기 — 하프 음 간격), shift 가락을 옮긴 반음(leadShift), melody 가락이 울리나(false 면 반짝이 쉼) }
export function arrange(song, o = {}) {
  const orch = normOrch(song.orch), P = PRESETS[orch.preset], parts = orch.parts;
  const bs = barSteps(song), total = totalSteps(song), beats = song.beats, sub = song.sub, bars = song.bars, key = song.key || 0;
  const sd = o.sd > 0 ? o.sd : 0.3, shift = o.shift || 0;
  const mel = [...song.notes].sort((a, z) => a.s - z.s).map(n => ({ s: n.s, d: n.d, p: n.p + shift, w: n.p }));   // p = 나는 높이 · w = 적은 높이
  const ps = mel.map(n => n.p);
  const leadLo = ps.length ? Math.min(...ps) : 60, leadHi = ps.length ? Math.max(...ps) : 76, leadMid = (leadLo + leadHi) / 2;
  const hiLead = leadMid >= 62, lowLead = leadMid < 58;       // 가락이 높은 악기 / 첼로 · 튜바처럼 낮은 악기
  const segs = chordLine(song);
  const scalePcs = SCALES[song.scale].pcs.map(x => (x + key) % 12);
  const ev = [];
  const mix = P.mix || 1;                                     // 편성마다 반주 전체 크기(가락이 묻히지 않게 — 오프라인 렌더로 맞춤)
  const dyn = s => mix * dynAt(orch.dyn, s / Math.max(1, total));
  const add = (track, inst, s, d, p, vel, art) => { if (d > 0 && Number.isFinite(p)) ev.push({ s, d, inst, p, vel: Math.round(vel * 1000) / 1000, track, ...(art ? { art } : {}) }); };
  const hit = (drum, s, vel, span) => ev.push({ s, kind: 'drum', drum, vel: Math.round(vel * 1000) / 1000, track: 'perc', ...(span ? { span } : {}) });
  const last = bars - 1, finalSeg = segs[segs.length - 1];
  const phraseEnd = b => b !== last && (b === last - 1 || b % 4 === 3);           // 다음 악구(또는 끝 마디)로 넘어가기 전 마디
  const barEnd = g => g.s + g.d === (g.bar + 1) * bs;
  const segAt = s => segs.find(g => g.s <= s && s < g.s + g.d) || segs[segs.length - 1];
  const lowMel = (a, z) => { let m = null; for (const n of mel) if (n.s < z && n.s + n.d > a) m = m == null ? n.p : Math.min(m, n.p); return m; };
  //  '짝' 자리 — 왈츠(pahpah) = 첫 박 빼고 박마다(4박이면 둘째 · 넷째) · 행진곡(offbeat) 2박 = 박 사이(엇박)
  const pahPos = (g, style) => {
    const at = [];
    if (style === 'offbeat' && beats === 2) for (let k = 0; k < 2; k++) at.push(g.bar * bs + k * sub + (sub === 3 ? 2 : sub / 2));
    else for (const k of (beats === 4 ? [1, 3] : beats === 3 ? [1, 2] : [1])) at.push(g.bar * bs + k * sub);
    return at.filter(s => s >= g.s && s < g.s + g.d);
  };
  const pahLen = style => style === 'offbeat' && beats === 2 ? sub * 0.45 : sub * 0.55;

  // 현악기 화음
  if (parts.strings) {
    const style = P.strings, hiReg = style === 'high';
    const lo = hiReg ? 62 : hiLead ? 50 : Math.max(60, Math.round(leadHi) + 1);
    const range = hiReg ? [62, 84] : hiLead ? [50, 72] : [lo, lo + 19];
    const base = hiReg ? 0.24 : 0.32;
    let prev = null;
    for (const g of segs) {
      if (!g.pcs) continue;
      const v = voiceChord(g.pcs, range, prev, hiLead && !hiReg ? lowMel(g.s, g.s + g.d) : null, P.voicing === 'open');
      prev = v;
      if (style === 'sustain' || hiReg || g.bar === last) {
        const art = P.swell && phraseEnd(g.bar) && barEnd(g) ? 'swell' : null;
        for (const p of v) add('strings', 'strings', g.s, g.d, p, base * dyn(g.s), art);
      } else for (const s of pahPos(g, style)) for (const p of v) add('strings', 'strings', s, pahLen(style), p, (base + 0.04) * dyn(s), 'stacc');
    }
  }

  // 낮은 현 — 첼로(38~55) + 콘트라베이스(한 옥타브 아래 · 28 밑으로는 안 감) · 가락이 낮은 악기면 첼로는 가락을 맡은 셈 → 콘트라베이스만
  if (parts.bass) {
    const style = P.bass;
    let lastP = 45;
    const near = (r, lo, hi) => { let b = null; for (let p = lo; p <= hi; p++) if (pc(p) === r && (b == null || Math.abs(p - lastP) < Math.abs(b - lastP))) b = p; return b; };
    const down = p => (p - 12 >= 28 ? p - 12 : p);
    const approach = (target, from) => { let q = target; do { q += from < target ? -1 : 1; } while (!scalePcs.includes(pc(q))); return q; };   // 다음 뿌리음 바로 옆 음계 음(걸어서 다가감)
    let prevRoot = null;
    segs.forEach((g, i) => {
      if (!g.pcs) return;
      const nx = segs[i + 1], r = near(g.root, 38, 55);
      lastP = r;
      const fifthPc = (g.root + 7) % 12;
      let fifth = r + 7; if (fifth > 57) fifth -= 12; if (pc(fifth) !== fifthPc) fifth = near(fifthPc, 36, 57);
      const V = 0.4 * dyn(g.s), VB = 0.34 * dyn(g.s), full = g.d === bs;
      const same = prevRoot === g.root; prevRoot = g.root;
      if (style === 'pedal' || g.bar === last) {
        if (!lowLead) add('bass', 'cello', g.s, g.d, r, V, style === 'pedal' && phraseEnd(g.bar) && barEnd(g) ? 'swell' : null);
        add('bass', 'contrabass', g.s, g.d, down(r), VB);
      } else if (style === 'arco') {
        if (full && beats === 4) {
          const appr = nx && nx.pcs && nx.root !== g.root ? approach(near(nx.root, 38, 55), r) : null;
          if (!lowLead) {
            add('bass', 'cello', g.s, 2 * sub, r, V);
            add('bass', 'cello', g.s + 2 * sub, appr != null ? sub : 2 * sub, same ? fifth : r, V * 0.9);
            if (appr != null) add('bass', 'cello', g.s + 3 * sub, sub, appr, V * 0.85);
          }
          add('bass', 'contrabass', g.s, g.d, down(r), VB);
        } else { if (!lowLead) add('bass', 'cello', g.s, g.d, r, V); add('bass', 'contrabass', g.s, g.d, down(r), VB); }
      } else if (style === 'waltz' || style === 'oompah') {
        const ks = beats === 4 ? [0, 2] : beats === 2 && style === 'oompah' ? [0, 1] : [0];
        ks.forEach((k, j) => {
          const s = g.bar * bs + k * sub; if (s < g.s || s >= g.s + g.d) return;
          const p = j % 2 || (style === 'waltz' && same && g.bar % 2) ? fifth : r;
          if (!lowLead) add('bass', 'cello', s, sub * 0.8, p, V, 'stacc');
          add('bass', 'contrabass', s, sub * 0.8, down(p), VB, 'stacc');
        });
      } else if (style === 'pizz') {
        const ks = beats === 4 ? [0, 2] : [0];
        ks.forEach((k, j) => {
          const s = g.bar * bs + k * sub; if (s < g.s || s >= g.s + g.d) return;
          const p = j ? fifth : r;
          if (!lowLead) add('bass', 'pizz', s, sub, p, V * 1.1);
          if (!j || lowLead) add('bass', 'pizz', s, sub, down(p), VB);
        });
      }
    });
  }

  // 목관 화음 — 아이가 쌓은 화음 음이 있으면 그 음 그대로 · 없으면 가락 아래 화음 음(3도 쪽) · 줄 전체를 옥타브 하나로 옮겨 음역에
  if (parts.winds) {
    const inst = P.winds, R = inst === 'flute' ? [62, 93] : inst === 'oboe' ? [60, 88] : [52, 84];
    const line = song.harm && song.harm.length ? song.harm.map(x => ({ s: x.s, d: x.d, p: x.p }))
      : mel.map(m => { const g = segAt(m.s); return { s: m.s, d: m.d, p: harmBelow(m.w, g && g.pcs, scalePcs, m.s % sub === 0 || m.d >= sub) }; });
    const k = lineShift(line.map(x => x.p), R);
    for (const x of line) { const p = fit(x.p + k, R); add('winds', inst === 'oboe' && p < 62 ? 'clarinet' : inst, x.s, x.d, p, (inst === 'flute' ? 0.34 : 0.4) * dyn(x.s)); }
  }

  // 금관 — 호른 둘(길게 · 악구 끝에서 부풂) · 행진곡 = 호른 엇박 화음 + 튜바 센박 · 왈츠 = 호른 '짝'
  if (parts.brass) {
    const style = P.brass, R = hiLead ? [48, 67] : [57, 74];
    let prev = null, prevM = null, tubaP = 40;
    const nearT = r => { let b = null; for (let p = 33; p <= 52; p++) if (pc(p) === r && (b == null || Math.abs(p - tubaP) < Math.abs(b - tubaP))) b = p; return b; };
    for (const g of segs) {
      if (!g.pcs) continue;
      if (style === 'march' || style === 'pahpah') {
        if (style === 'march') {   // 튜바 — 센박에 뿌리음 · 다섯째 음 번갈아(끝 마디는 길게)
          const r = nearT(g.root); tubaP = r;
          const f5 = nearT((g.root + 7) % 12);
          if (g.bar === last) add('brass', 'tuba', g.s, g.d, r, 0.42 * dyn(g.s));
          else (beats === 4 ? [0, 2] : beats === 2 ? [0, 1] : [0]).forEach((kk, j) => { const s = g.bar * bs + kk * sub; if (s >= g.s && s < g.s + g.d) add('brass', 'tuba', s, sub * 0.6, j ? f5 : r, 0.42 * dyn(s), 'stacc'); });
        }
        if (g.bar === last) { const v = dyad(g.pcs, R, prev); prev = v; for (const p of v) add('brass', 'horn', g.s, g.d, p, 0.34 * dyn(g.s)); continue; }
        if (style === 'march') { const v = voiceChord(g.pcs, [53, 70], prevM, null); prevM = v; for (const s of pahPos(g, 'offbeat')) for (const p of v) add('brass', 'horn', s, pahLen('offbeat'), p, 0.3 * dyn(s), 'stacc'); }
        else { const v = dyad(g.pcs, R, prev); prev = v; for (const s of pahPos(g, 'pahpah')) for (const p of v) add('brass', 'horn', s, pahLen('pahpah'), p, 0.24 * dyn(s), 'stacc'); }
        continue;
      }
      const v = dyad(g.pcs, R, prev); prev = v;
      const sw = style === 'swell' ? (phraseEnd(g.bar) || g.bar % 2 === 1) : phraseEnd(g.bar);
      for (const p of v) add('brass', 'horn', g.s, g.d, p, 0.34 * dyn(g.s), sw && barEnd(g) ? 'swell' : null);
    }
  }

  // 하프 — 화음 음을 아래에서 위로 한 음씩(up) · 오르내리며(wave) · 음 간격은 0.14초 넘게(빠른 곡은 듬성듬성) · 끝 마디 = 글리산도(동화 · 영화)
  if (parts.harp) {
    const style = P.harp, R = [43, 84];
    const every = [1, 2, 3, 4, 6, 8, 12].filter(e => e % sub === 0 || sub % e === 0).find(e => e * sd >= 0.14) || sub;
    for (const g of segs) {
      if (!g.pcs) continue;
      if (g === finalSeg && P.gliss && bars > 1) {
        const run = []; for (let p = 55; p <= 86; p++) if (scalePcs.includes(pc(p))) run.push(p);
        run.forEach((p, j) => add('harp', 'harp', g.s + j * (sub / run.length), g.d - j * (sub / run.length), p, (0.16 + 0.12 * j / run.length) * dyn(g.s)));
        continue;
      }
      const T = []; for (let p = R[0]; p <= R[1]; p++) if (g.pcs.includes(pc(p))) T.push(p);
      const seq = T.slice(Math.max(0, T.findIndex(p => pc(p) === g.root)));
      const L = Math.min(seq.length, 8);
      for (let j = 0, s = g.s; s < g.s + g.d - 1e-9; j++, s += every) {
        let idx = j % L;
        if (style === 'wave' && L > 1) { const per = 2 * (L - 1), u = j % per; idx = u < L ? u : per - u; }
        add('harp', 'harp', s, g.s + g.d - s, seq[idx], 0.3 * dyn(s) * (1 - 0.2 * idx / 8));
      }
    }
  }

  // 타악기 — 팀파니는 으뜸음 · 딸림음 두 북(그 마디 화음 뿌리가 둘 중 하나일 때만) · 편성마다 다른 꼴
  if (parts.perc) {
    const style = P.perc, tonic = key, dom = (key + 7) % 12;
    const tp = r => { let b = null; for (let p = 40; p <= 57; p++) if (pc(p) === r && (b == null || Math.abs(p - 47) < Math.abs(b - 47))) b = p; return b; };
    const timp = (s, r, vel, d = sub, art) => add('perc', 'timpani', s, d, tp(r), vel, art);
    const tOK = g => !!g && (g.root === tonic || g.root === dom);
    for (let b = 0; b < bars; b++) {
      const s0 = b * bs, g = segAt(s0), D = dyn(s0);
      if (b === last && bars > 1) {   // 끝 마디 — 마지막 화음(마침 I)이 시작하는 곳에서
        const f0 = finalSeg.bar === last ? finalSeg.s : s0, fd = last * bs + bs - f0, F = dyn(f0);
        if (style === 'march') { hit('bassdrum', f0, 0.45 * F); hit('cymbal', f0, 0.42 * F); hit('snare', f0, 0.36 * F); timp(f0, tonic, 0.36 * F, sub); }
        else {
          timp(f0, tonic, (style === 'fairy' || style === 'soft' ? 0.26 : 0.4) * F, fd, 'roll');
          if (style === 'full' || style === 'film' || style === 'waltz') hit('cymbal', f0, (style === 'film' ? 0.55 : 0.42) * F);
          if (style === 'full' || style === 'film') hit('bassdrum', f0, 0.45 * F);
          if (style === 'fairy' || style === 'waltz') hit('triangle', f0, 0.4 * F);
        }
        continue;
      }
      if (style === 'full') {
        if (b === 0) { if (tOK(g)) timp(s0, g.root, 0.42 * D); hit('cymbal', s0, 0.28 * D); }
        else if (b % 4 === 0 && tOK(g)) timp(s0, g.root, 0.4 * D);
        if (phraseEnd(b) && b % 4 !== 0 && tOK(g)) timp(s0, g.root, 0.34 * D);
      } else if (style === 'soft') {
        if (phraseEnd(b) && tOK(g)) timp(s0, g.root, 0.28 * D);
      } else if (style === 'march') {
        for (let k = 0; k < beats; k++) {
          const s = s0 + k * sub, strong = k === 0 || (beats === 4 && k === 2);
          if (strong) hit('bassdrum', s, 0.46 * D);
          hit('snare', s, (k === 0 ? 0.42 : 0.3) * D);
          if (sub % 2 === 0 && (k === beats - 1 || beats === 2)) hit('snare', s + sub / 2, 0.24 * D);   // 따-닥
        }
        if (b % 4 === 0) hit('cymbal', s0, 0.3 * D);
      } else if (style === 'film') {
        if (b % 4 === 0) { if (tOK(g)) timp(s0, g.root, 0.44 * D); if (b > 0) hit('bassdrum', s0, 0.42 * D); }
        if (b === last - 1) hit('swell', s0, 0.62 * D, bs);                                         // 끝 마디 앞 — 심벌이 부풀어 오름
        else if (phraseEnd(b)) timp(s0 + (beats - 1) * sub, tonic, 0.34 * D, sub, 'roll');           // 악구 끝 박 — 두루루루 다음 악구로
      } else if (style === 'waltz') {
        if (b % 2 === 0 && tOK(g)) timp(s0, g.root, 0.28 * D);
        if (b % 4 === 0) hit('triangle', s0, 0.3 * D);
      } else if (style === 'fairy') {
        if (b % 2 === 0) hit('triangle', s0, 0.28 * D);
      }
    }
  }

  // 반짝이 — 가락을 첼레스타(또는 글로켄슈필)가 한두 옥타브 위에서 여리게(가락 악기와 겹치면 다른 하나로) · 가락이 쉬면(리듬 게임 도움 끔) 같이 쉼
  if (parts.sparkle && o.melody !== false && mel.length) {
    let inst = P.sparkle;
    if (inst === song.inst) inst = inst === 'celesta' ? 'glock' : 'celesta';
    const R = RANGE[inst], c = [12, 24, 36].filter(k => k >= shift + 12);
    const k = lineShift(mel.map(m => m.w), R, c[0], c.length ? c : [36]);
    for (const m of mel) add('sparkle', inst, m.s, m.d, fit(m.w + k, R), (inst === 'glock' ? 0.26 : 0.3) * dyn(m.s));
  }
  return ev.sort((a, z) => a.s - z.s);
}

// ── 악기 소개 ── 네 가족(+ 목소리) · 한 줄 설명 · ▶ 짧은 소리 · drum:<종류> = 타악기
export const FAMILIES = [
  { key: 'str', name: '현악기', emoji: '🎻', color: '#e0956a', how: '줄을 활로 긋거나 손가락으로 뜯어서 소리 내요',
    items: [['violin', '바이올린', '가장 높은 현악기 — 가락을 많이 맡아요'], ['strings', '현악 합주', '여러 대가 함께 — 구름처럼 부드러워요'],
      ['cello', '첼로', '사람 목소리처럼 따뜻한 낮은 소리'], ['contrabass', '콘트라베이스', '가장 크고 낮은 현악기 — 바닥을 받쳐요'],
      ['pizz', '피치카토', '활 대신 손가락으로 줄을 퉁겨요'], ['harp', '하프', '47줄을 손가락으로 뜯어요 — 맑게 울려요'], ['gayageum', '가야금', '우리나라 현악기 — 열두 줄을 뜯어요']] },
  { key: 'wood', name: '목관악기', emoji: '🪈', color: '#6cbf7a', how: '입김으로 관 속 공기를 떨게 해요',
    items: [['flute', '플루트', '옆으로 들고 불어요 — 맑고 가벼운 새소리'], ['clarinet', '클라리넷', '리드 한 장 — 둥글고 부드러워요'],
      ['oboe', '오보에', '리드 두 장 — 콧소리처럼 또렷해요'], ['recorder', '리코더', '우리가 부는 그 악기! 구멍을 막아 음을 바꿔요']] },
  { key: 'brass', name: '금관악기', emoji: '🎺', color: '#f2c230', how: '입술을 떨어서 소리 내요(쇠로 된 긴 관)',
    items: [['trumpet', '트럼펫', '가장 높고 밝은 금관 — 빠밤! 팡파르'], ['horn', '호른', '동그랗게 말린 관 — 멀리서 부르는 듯 부드러워요'], ['tuba', '튜바', '가장 크고 낮은 금관 — 붕붕']] },
  { key: 'perc', name: '건반·타악기', emoji: '🥁', color: '#7fa7e6', how: '치거나 두드리거나 건반을 눌러 소리 내요',
    items: [['timpani', '팀파니', '음 높이가 있는 큰 북 — 둥둥, 두루루루'], ['drum:bassdrum', '큰북', '쿵! 가장 낮은 북'], ['drum:snare', '작은북', '따다닥 — 행진곡의 발걸음'],
      ['drum:cymbal', '심벌즈', '챙! 가장 큰 순간에'], ['drum:triangle', '트라이앵글', '팅~ 작은 쇠막대 세모'], ['celesta', '첼레스타', '건반을 누르면 작은 망치가 쇠막대를 쳐요 — 요정 소리'],
      ['glock', '글로켄슈필', '쇠막대 실로폰 — 반짝반짝'], ['piano', '피아노', '건반을 누르면 망치가 줄을 쳐요'], ['xylo', '실로폰', '나무 막대를 채로 쳐요'], ['marimba', '마림바', '울림통이 달린 큰 나무 실로폰']] },
  { key: 'voice', name: '목소리', emoji: '🗣️', color: '#e58bb4', how: '사람 목소리도 악기예요',
    items: [['choir', '합창', '여럿이 함께 아~ 하고 노래해요']] },
];
//  가락 악기 고르기 칸의 묶음(작곡 화면 · 오케스트라 칸) — 타악기(팀파니 · 북)는 가락 악기가 아니라 뺀다
export const INST_GROUPS = FAMILIES.map(f => [f.name, f.items.map(x => x[0]).filter(k => !k.startsWith('drum:') && k !== 'timpani')]);
const FAM_OF = Object.fromEntries(FAMILIES.flatMap(f => f.items.map(x => [x[0], f.key])));
export const familyOf = k => FAM_OF[k] || 'perc';

//  ▶ 짧은 소리(초 단위 사건) — 그 악기다운 높이에서 도 · 레 · 미 · 솔 · 도(높은) / 화음 악기는 화음 / 북은 그 북다운 꼴
const SAMPLE_HOME = { violin: 67, cello: 48, contrabass: 36, pizz: 43, flute: 72, clarinet: 58, oboe: 65, recorder: 72, trumpet: 65, horn: 53, tuba: 34,
  celesta: 72, glock: 84, piano: 60, xylo: 72, marimba: 60, gayageum: 62 };
export function samplePhrase(key) {
  const note = (t, d, inst, p, vel = 0.8, art) => ({ t, d, kind: 'note', inst, p, vel, track: 'sample', ...(art ? { art } : {}) });
  if (key.startsWith('drum:')) {
    const k = key.slice(5), pat = { bassdrum: [[0, 0.8], [0.9, 0.6]], snare: [[0, 0.7], [0.25, 0.45], [0.375, 0.45], [0.5, 0.7], [0.75, 0.45], [0.875, 0.45], [1, 0.75]], cymbal: [[0, 0.8]], triangle: [[0, 0.7], [0.6, 0.55], [1.2, 0.7]] }[k] || [[0, 0.7]];
    return pat.map(([t, vel]) => ({ t, kind: 'drum', drum: k, vel, track: 'sample', span: 0.12 }));
  }
  if (key === 'timpani') return [note(0, 0.45, 'timpani', 43, 0.75), note(0.45, 0.45, 'timpani', 48, 0.75), note(0.9, 1.3, 'timpani', 43, 0.7, 'roll'), note(2.25, 0.6, 'timpani', 48, 0.85)];
  if (key === 'strings' || key === 'choir') return [...[48, 55, 64, 67].map(p => note(0, 1.1, key, p, 0.8)), ...[50, 55, 62, 71].map(p => note(1.15, 0.6, key, p, 0.8)), ...[48, 55, 64, 72].map(p => note(1.8, 1.4, key, p, 0.85, 'swell'))];
  if (key === 'harp') return [...[48, 52, 55, 60, 64, 67, 72, 76].map((p, i) => note(i * 0.12, 1.6, 'harp', p, 0.75)), ...[48, 55, 64, 72].map((p, i) => note(1.3 + i * 0.04, 1.8, 'harp', p, 0.7))];
  const h = SAMPLE_HOME[key] ?? 60;
  const steps = key === 'gayageum' ? [0, 2, 4, 7, 9] : [0, 2, 4, 7, 12];
  const len = key === 'tuba' || key === 'contrabass' ? 0.34 : key === 'pizz' ? 0.22 : 0.26;
  return steps.map((k, i) => note(i * len, i === steps.length - 1 ? len * 3 : len * 0.92, key, h + k, 0.8));
}
