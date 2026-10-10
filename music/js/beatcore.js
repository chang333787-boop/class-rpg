// 비트 만들기 — 모양 · 살피기 · 셈(화면 · 소리 없음 · node 로 시험) [MUSIC-BEAT-1]
//  사용자 10-10 '반복해서 비트 만드는 느낌' — 짧은 마디(패턴)를 되풀이하며 북 · 베이스 · 화음을 겹겹이 쌓고,
//  조금 바꾼 패턴(A B C D)을 이어 붙여(순서) 한 곡처럼 만든다. 장르 이름은 쓰지 않는다.
//  · 칸(grid) = 한 마디를 몇 칸으로: 16칸(한 박 = 네 칸 · 기본) · 8칸(쉽게) · 32칸(두 마디) · 12칸(한 박 = 세 칸) · 9칸(세 박 · 세마치)
//  · 북 칸 값 0 꺼짐 · 1 보통 · 2 세게 / 베이스 칸 -1 빈칸(앞 음이 이어짐) · 0~5 음(도 레 미 솔 라 높은 도) · 9 쉼(끊기)
//    화음 = 박마다(두 마디 패턴은 두 박마다) 카드 하나 · 치는 법 = 길게 · 쿵짝 · 짧게 톡톡
//  · 저장 모양은 글자 줄(북 '0102…' · 베이스 '0..3x…' · 화음 ['I','-','V','vi']) — Firebase 가 배열을 객체로 바꾸거나 빈칸을 빼도 안 깨지게.
//    읽을 때는 normalizeBeat 이 모든 칸을 다시 살핀다(모르는 칸 · 너무 긴 글 · 틀린 값은 버리거나 기본값 — 화면이 깨지지 않게).
//  · Sequencer = 소리 시계(AudioContext 시각)로 0.12초 앞서 예약하는 되풀이 박자기 — 25ms 마다 tick. 화면이 버벅여도 박이 안 흔들리고,
//    칸을 고치면 아직 예약 안 한 칸부터 바로 들린다(끊김 없이). 패턴 바꾸기 · 순서 · 빠르기는 다음 칸 · 다음 마디부터.
//  [MUSIC-BEAT-MEL-1] 가락(멜로디) 줄 — 선생님 10-10 '비트는 멜로디 없이 박자만 가지고 하는 거야?' → 북 → 베이스 → 화음 위에 되풀이하는 짧은 가락.
//    가락 칸 값 -1 빈칸(앞 음이 이어짐) · 0~7 음(도 레 미 솔 라 높은 도 높은 레 높은 미 — 다섯 음 음계 한 옥타브 반) · 9 쉼 — 베이스와 같은 규칙.
//    저장 글자 줄 '2.3.x…'(패턴마다 m) · 가락 악기 = 비트마다 하나(lead). 예전에 저장한 비트(m · lead 없음)는 빈 가락 · 소리 묶음의 기본 악기로 읽는다.

export const GRIDS = {
  16: { key: '16', beats: 4, sub: 4, bars: 1, name: '16칸', hint: '한 박 = 네 칸' },
  8: { key: '8', beats: 4, sub: 2, bars: 1, name: '8칸', hint: '쉽게 · 한 박 = 두 칸' },
  32: { key: '32', beats: 4, sub: 4, bars: 2, name: '32칸', hint: '두 마디' },
  12: { key: '12', beats: 4, sub: 3, bars: 1, name: '12칸', hint: '한 박 = 세 칸 · 굿거리 장단' },
  9: { key: '9', beats: 3, sub: 3, bars: 1, name: '9칸', hint: '세 박 · 한 박 = 세 칸 · 세마치 장단' },
};
export const GRID_KEYS = ['16', '8', '32', '12', '9'];
const own = (o, k) => (typeof k === 'string' || typeof k === 'number') && Object.prototype.hasOwnProperty.call(o, String(k));
export const gridOf = k => (own(GRIDS, k) ? GRIDS[k] : GRIDS[16]);
export const lenOf = g => g.beats * g.sub * g.bars;
export const slotsOf = g => (g.beats === 3 ? 3 : 4);          // 화음 칸 수
export const slotLen = g => lenOf(g) / slotsOf(g);             // 화음 한 칸 = 몇 칸(16칸 = 4 · 32칸 = 8)
export const beatsOf = g => g.beats * g.bars;                  // 패턴 전체 박 수

// ── 줄(악기) ──  저장 이름은 소리 묶음(kit)과 상관없이 같다 → 소리 묶음을 바꿔도 패턴은 그대로, 줄 이름만 바뀐다
export const ROWS = ['kick', 'snare', 'clap', 'hatc', 'hato', 'tom', 'shaker', 'cymbal'];
export const EXTRA = ['shaker', 'cymbal'];                     // 보였다 숨겼다 하는 줄
export const MIX = [...ROWS, 'mel', 'bass', 'chord'];          // 믹서 줄(북 여덟 + 가락 + 베이스 + 화음) [MUSIC-BEAT-MEL-1 가락 더함]
const NAMES = { kick: '쿵', snare: '짝', clap: '박수', hatc: '칙', hato: '치이', tom: '통', shaker: '쉐이커', cymbal: '심벌' };
const WHAT = { kick: '큰북(킥)', snare: '작은북(스네어)', clap: '손뼉', hatc: '닫힌 하이햇', hato: '열린 하이햇', tom: '탐탐', shaker: '흔드는 쉐이커', cymbal: '크게 울리는 심벌' };
export const KITS = {
  elec: { name: '전자 북', em: '🎛️', rows: NAMES, what: WHAT, hint: '깊고 길게 울리는 쿵 · 톡 쏘는 짝 · 쇠붙이 같은 칙' },
  real: { name: '진짜 북', em: '🥁', rows: NAMES, what: WHAT, hint: '드럼 세트를 손으로 치는 듯한 소리' },
  kor: { name: '우리 장단', em: '🪘', hint: '북 · 장구 · 꽹과리 · 징',
    rows: { kick: '북', snare: '장구 덕', clap: '장구 덩', hatc: '꽹과리', hato: '징', tom: '장구 기덕', shaker: '장구 쿵', cymbal: '더러러러' },
    what: { kick: '소리북(둥)', snare: '장구 채편(딱)', clap: '장구 양편을 같이(덩)', hatc: '꽹과리(쨍)', hato: '징(길게 웅)', tom: '장구 기덕(살짝 + 딱)', shaker: '장구 궁편(쿵)', cymbal: '장구 굴리기(더러러러)' } },
};
export const KIT_KEYS = ['elec', 'real', 'kor'];
export const kitOf = k => (own(KITS, k) ? KITS[k] : KITS.elec);
export const rowName = (kit, r) => (r === 'bass' ? '베이스' : r === 'chord' ? '화음' : r === 'mel' ? '가락' : kitOf(kit).rows[r] || r);
export const rowWhat = (kit, r) => (r === 'bass' ? '베이스 반복' : r === 'chord' ? '화음 반복' : r === 'mel' ? '가락(멜로디) 반복' : kitOf(kit).what[r] || '');

// ── 베이스 · 화음 ──  늘 어울리게: 베이스 = 다섯 음 음계(도 레 미 솔 라) + 높은 도 · 화음 = 도 · 파 · 솔 · 라(단조) 화음(다장조 I · IV · V · vi)
export const BASS = [
  { n: '도', p: 36 }, { n: '레', p: 38 }, { n: '미', p: 40 }, { n: '솔', p: 43 }, { n: '라', p: 45 }, { n: '높은 도', p: 48 },
];
export const B_EMPTY = -1, B_REST = 9;
export const CHORDS = {
  I: { name: '도', full: '도 화음', notes: [60, 64, 67] },
  IV: { name: '파', full: '파 화음', notes: [60, 65, 69] },
  V: { name: '솔', full: '솔 화음', notes: [59, 62, 67] },
  vi: { name: '라', full: '라 화음(단조)', notes: [60, 64, 69], minor: true },
};
export const CHORD_KEYS = ['I', 'IV', 'V', 'vi'];
export const STYLES = { long: '길게', oom: '쿵짝', short: '짧게 톡톡' };
export const STYLE_KEYS = ['long', 'oom', 'short'];
// ── 가락(멜로디) ── [MUSIC-BEAT-MEL-1]  다섯 음 음계(도 레 미 솔 라)를 한 옥타브 반 — 반음으로 붙는 음(파 · 시)이 없어서
//  화음 카드 넷(도 · 파 · 솔 · 라) 어느 위에 놓아도 거칠게 부딪히지 않는다. 칸 값 = 이 표의 번호(0~7) · 빈칸 · 쉼은 베이스와 같은 수(B_EMPTY · B_REST)
export const MEL = [
  { n: '도', p: 60 }, { n: '레', p: 62 }, { n: '미', p: 64 }, { n: '솔', p: 67 }, { n: '라', p: 69 }, { n: '높은 도', p: 72 }, { n: '높은 레', p: 74 }, { n: '높은 미', p: 76 },
];
export const M_TOP = MEL.length - 1;
export const melShort = v => (v >= 5 ? MEL[v - 5].n + '˙' : MEL[v] ? MEL[v].n : '');   // 칸 안 짧은 이름(높은 음 = 위 점)
//  화음마다 그 화음의 음인 가락 칸(가락 주사위 — 첫 음 · 끝 음을 여기서 고른다)
export const CHORD_MEL = { I: [0, 2, 3, 5, 7], IV: [0, 4, 5], V: [1, 3, 6], vi: [0, 2, 4, 5, 7] };
//  가락 악기 — 비트마다 하나. ring = 두드리거나 뜯는 악기(소리가 저절로 잦아듦 · 다음 음이 와도 앞 음을 바로 끊지 않음 · 손을 떼도 그대로)
//   소리는 beatkit.js(신스 · 대금은 그 안에서 만들고, 나머지는 공용 엔진 악기)
export const LEADS = {
  synth: { name: '신스', em: '🎛️', hint: '네모 · 톱니 물결을 부드럽게 깎은 전자 소리' },
  xylo: { name: '실로폰', em: '🎵', ring: true, hint: '나무 막대를 채로 톡톡' },
  piano: { name: '피아노', em: '🎹', hint: '건반을 누르는 동안 울려요' },
  flute: { name: '플루트', em: '🪈', hint: '맑고 가벼운 숨소리' },
  glock: { name: '글로켄', em: '🔔', ring: true, hint: '쇠막대 — 반짝반짝 오래 울려요' },
  daegeum: { name: '대금', em: '🎋', hint: '대나무 피리 — 숨소리 · 떨리는 소리' },
  gayageum: { name: '가야금', em: '🪕', ring: true, hint: '열두 줄을 손가락으로 뜯어요' },
};
export const LEAD_KEYS = ['synth', 'xylo', 'piano', 'flute', 'glock', 'daegeum', 'gayageum'];
export const LEAD_DEF = { elec: 'synth', real: 'xylo', kor: 'daegeum' };      // 소리 묶음마다 처음 악기
export const leadOf = k => (own(LEADS, k) ? k : 'synth');
export const isRing = k => !!LEADS[leadOf(k)].ring;
//  치는 자리(박 안 몇째 칸) — 쿵짝 = 박 사이(짝)에 · 짧게 톡톡 = 반 박마다
const STYLE_POS = { oom: { 4: [2], 2: [1], 3: [1, 2] }, short: { 4: [0, 2], 2: [0, 1], 3: [0, 2] } };

export const BPM_MIN = 70, BPM_MAX = 160, BPM_DEF = 96, SWING_MAX = 60;
export const VOL_DEF = 0.8;
export function defaultMix() { const m = {}; for (const r of MIX) m[r] = { v: VOL_DEF, m: false, s: false }; return m; }
export function emptyPattern(g = GRIDS[16]) {
  const len = lenOf(g), d = {};
  for (const r of ROWS) d[r] = new Array(len).fill(0);
  return { d, m: new Array(len).fill(B_EMPTY), b: new Array(len).fill(B_EMPTY), c: new Array(slotsOf(g)).fill(null), cs: 'long' };
}
export function emptyBeat() {
  return { v: 1, id: null, title: '', grid: '16', bpm: BPM_DEF, swing: 0, kit: 'elec', lead: LEAD_DEF.elec, pats: [0, 1, 2, 3].map(() => emptyPattern(GRIDS[16])),
    arr: [], mode: 'loop', cur: 0, mix: defaultMix(), show: { shaker: false, cymbal: false }, fill: false, click: false };
}
export const patternEmpty = p => ROWS.every(r => p.d[r].every(v => !v)) && p.m.every(v => v === B_EMPTY) && p.b.every(v => v === B_EMPTY) && p.c.every(c => !c);
export const hasContent = b => b.pats.some(p => !patternEmpty(p));
export const usedCount = b => b.pats.filter(p => !patternEmpty(p)).length;
export const melCount = p => p.m.filter(v => v >= 0 && v <= M_TOP).length;   // 가락 음 수 [MUSIC-BEAT-MEL-1]
export const clonePattern = p => ({ d: Object.fromEntries(ROWS.map(r => [r, p.d[r].slice()])), m: p.m.slice(), b: p.b.slice(), c: p.c.slice(), cs: p.cs });
export const LETTERS = ['A', 'B', 'C', 'D'];

// ── 살피기 ──  읽은 값(저장소 · 손님 기기 · 친구 비트)을 믿지 않는다. 앞에서부터 정한 수만큼만 읽는다(커다란 배열 · 객체로 멈추지 않게)
const at = (v, i) => (v == null || (typeof v !== 'string' && typeof v !== 'object') ? undefined : v[i]);
const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const yes = v => v === true || v === 1;
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : typeof v === 'number' && Number.isFinite(v) ? String(v).slice(0, n) : '');
//  북 줄: '0102…' · [0,1,2…] · { 0: 1 … }(Firebase) → 길이 len · 값 0/1/2
export function drumRow(v, len) {
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i++) { const x = at(v, i); const n = typeof x === 'number' ? x : typeof x === 'string' && x.length === 1 ? Number(x) : 0; out[i] = n === 1 || n === 2 ? n : 0; }
  return out;
}
//  베이스 줄: '0..3x…'(. = 빈칸 · x = 쉼) · [0,-1,9…] → 길이 len
export function bassRow(v, len) {
  const out = new Array(len).fill(B_EMPTY);
  for (let i = 0; i < len; i++) {
    const x = at(v, i);
    if (x === 'x' || x === B_REST || x === '9') out[i] = B_REST;
    else if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 5) out[i] = x;
    else if (typeof x === 'string' && /^[0-5]$/.test(x)) out[i] = Number(x);
  }
  return out;
}
//  가락 줄: '2.3.x…'(. = 빈칸 · x = 쉼 · 0~7 음) · [2,-1,9…] → 길이 len — 베이스 줄과 같은 규칙(음 번호만 0~7) [MUSIC-BEAT-MEL-1]
export function melRow(v, len) {
  const out = new Array(len).fill(B_EMPTY);
  for (let i = 0; i < len; i++) {
    const x = at(v, i);
    if (x === 'x' || x === B_REST || x === '9') out[i] = B_REST;
    else if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= M_TOP) out[i] = x;
    else if (typeof x === 'string' && /^[0-7]$/.test(x)) out[i] = Number(x);
  }
  return out;
}
//  화음 줄: ['I','-','V','vi'] · 'I,-,V,vi' · { 0: 'I' … } → 칸 수 n · 모르는 카드는 빈칸
export function chordRow(v, n) {
  const src = typeof v === 'string' ? v.slice(0, 64).split(',') : v;
  const out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) { const x = at(src, i); out[i] = typeof x === 'string' && own(CHORDS, x) ? x : null; }
  return out;
}
function normPattern(raw, g) {
  const p = emptyPattern(g), len = lenOf(g);
  if (!raw || typeof raw !== 'object') return p;
  const d = raw.d && typeof raw.d === 'object' ? raw.d : {};
  for (const r of ROWS) p.d[r] = drumRow(d[r], len);
  p.m = melRow(raw.m, len);                                     // 예전 비트(m 없음) = 빈 가락
  p.b = bassRow(raw.b, len);
  p.c = chordRow(raw.c, slotsOf(g));
  p.cs = own(STYLES, raw.cs) ? raw.cs : 'long';
  return p;
}
export function normalizeBeat(raw) {
  const b = emptyBeat();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return b;
  b.grid = own(GRIDS, raw.grid) ? String(raw.grid) : '16';
  const g = gridOf(b.grid);
  b.id = str(raw.id, 60) || null;
  b.title = str(raw.title, 30);
  b.bpm = num(raw.bpm, BPM_MIN, BPM_MAX, BPM_DEF);
  b.swing = num(raw.swing, 0, SWING_MAX, 0);
  b.kit = own(KITS, raw.kit) ? raw.kit : 'elec';
  b.lead = own(LEADS, raw.lead) ? raw.lead : LEAD_DEF[b.kit];   // 예전 비트(lead 없음) = 소리 묶음의 처음 악기
  b.pats = [0, 1, 2, 3].map(i => normPattern(at(raw.pats, i), g));
  const arrSrc = typeof raw.arr === 'string' ? raw.arr.slice(0, 8) : raw.arr;
  for (let i = 0; i < 8; i++) {
    const x = at(arrSrc, i);
    if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 3) b.arr.push(x);
    else if (typeof x === 'string' && /^[0-3]$/.test(x)) b.arr.push(Number(x));
  }
  b.mode = raw.mode === 'song' ? 'song' : 'loop';
  b.cur = num(raw.cur, 0, 3, 0);
  const mix = raw.mix && typeof raw.mix === 'object' ? raw.mix : {};
  for (const r of MIX) {
    const m = mix[r];
    if (!m || typeof m !== 'object') continue;
    const v = Number(m.v);
    b.mix[r] = { v: m.v !== null && m.v !== '' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 100) / 100 : VOL_DEF, m: yes(m.m), s: yes(m.s) };
  }
  const show = raw.show && typeof raw.show === 'object' ? raw.show : {};
  b.show = { shaker: yes(show.shaker), cymbal: yes(show.cymbal) };
  b.fill = yes(raw.fill); b.click = yes(raw.click);
  //  누가 · 언제(저장소가 붙임)
  if (raw.by != null) b.by = str(raw.by, 40);
  if (raw.byName != null) b.byName = str(raw.byName, 20);
  for (const k of ['created', 'updated']) if (Number.isFinite(Number(raw[k])) && raw[k] !== null && raw[k] !== '') b[k] = Number(raw[k]);
  if (raw.rev != null) b.rev = num(raw.rev, 0, 1e6, 0);
  if (raw.pub != null) b.pub = yes(raw.pub);
  return b;
}
//  저장할 모양(글자 줄) — normalizeBeat(packBeat(b)) 은 b 와 같다
const line = (row, len) => row.slice(0, len).map(x => (x === B_REST ? 'x' : x < 0 ? '.' : String(x))).join('');   // 베이스 · 가락 줄 → '0..3x…'
export function packBeat(b) {
  const g = gridOf(b.grid), len = lenOf(g);
  const out = {
    v: 1, title: String(b.title || '').slice(0, 30), grid: g.key, bpm: b.bpm, swing: b.swing, kit: b.kit, lead: leadOf(b.lead), mode: b.mode, cur: b.cur, fill: !!b.fill, click: !!b.click,
    show: { shaker: !!b.show.shaker, cymbal: !!b.show.cymbal },
    mix: Object.fromEntries(MIX.map(r => [r, { v: b.mix[r].v, m: !!b.mix[r].m, s: !!b.mix[r].s }])),
    pats: b.pats.map(p => ({
      d: Object.fromEntries(ROWS.map(r => [r, p.d[r].slice(0, len).join('')])),
      m: line(p.m, len),
      b: line(p.b, len),
      c: p.c.map(x => x || '-'), cs: p.cs })),
    arr: b.arr.slice(0, 8),
  };
  for (const k of ['id', 'by', 'byName', 'created', 'updated', 'rev', 'pub']) if (b[k] != null) out[k] = b[k];
  return out;
}

// ── 시간 ──
export const stepDur = (bpm, g) => 60 / bpm / g.sub;           // 한 칸(초)
export const swingable = g => g.sub % 2 === 0;                  // 한 박 = 세 칸이면 이미 통통 — 스윙 없음
//  마디 시작부터 칸 i 까지(초) — 둘째 칸마다 swing% × 한 칸만큼 늦게(통통 튀는 정도)
export const swingOff = (i, swing, g, sd) => (swingable(g) && i % 2 === 1 ? (swing / 100) * sd : 0);
export const stepOffset = (i, bpm, swing, g) => { const sd = stepDur(bpm, g); return i * sd + swingOff(i, swing, g, sd); };
export const barDur = (bpm, g) => lenOf(g) * stepDur(bpm, g);
//  친 때(pos = 마디 시작부터 지난 초 · 음수도 · 마디보다 길어도) → 가장 가까운 칸(되풀이하니 마디 끝 가까이는 첫 칸)
export function nearestStep(pos, bpm, swing, g) {
  const len = lenOf(g), bd = barDur(bpm, g), x = ((pos % bd) + bd) % bd;
  let best = 0, dist = Infinity;
  for (let i = 0; i <= len; i++) { const t = i === len ? bd : stepOffset(i, bpm, swing, g); const d = Math.abs(x - t); if (d < dist) { dist = d; best = i % len; } }
  return best;
}
//  예약해 둔 칸들 [{ t, pat, step }] 가운데 T 에 가장 가까운 것(녹음 — 빠르기를 바꿔도 · 스윙이어도 실제로 울린 시각으로 고른다)
export function nearestOf(T, cands) {
  let best = null, dist = Infinity;
  for (const c of cands) { const d = Math.abs(c.t - T); if (d < dist) { dist = d; best = c; } }
  return best;
}

// ── 고르게 나누기(유클리드 리듬) ──  n 칸에 k 번을 될 수 있는 대로 고르게(첫 칸부터) — 사이는 n÷k 의 몫이거나 몫+1
export function euclid(k, n) {
  k = Math.max(0, Math.min(n, Math.round(k)));
  return Array.from({ length: n }, (_, i) => ((i * k) % n < k ? 1 : 0));
}
export function gaps(row) {
  const on = row.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  return on.map((x, j) => (j + 1 < on.length ? on[j + 1] : on[0] + row.length) - x);
}
//  '16칸 ÷ 3 = 5 … 1' 처럼 나눗셈으로 알려 준다
export function describeEuclid(k, n) {
  if (k <= 0) return { q: 0, r: 0, text: `${n}칸에 하나도 없어요` };
  if (k >= n) return { q: 1, r: 0, text: `${n}칸 ÷ ${n} = 1 → 모든 칸` };
  const q = Math.floor(n / k), r = n % k;
  return { q, r, text: r === 0 ? `${n}칸 ÷ ${k} = ${q} → ${q}칸마다 한 번` : `${n}칸 ÷ ${k} = ${q} … ${r} → ${q}칸 사이 ${k - r}번 · ${q + 1}칸 사이 ${r}번` };
}
//  엇박으로 밀기 — 한 칸 뒤로(dir 1) · 앞으로(dir -1) · 끝 칸은 처음으로 돌아온다
export function rotate(row, dir = 1) {
  const n = row.length; if (!n) return [];
  const s = ((dir % n) + n) % n;
  return row.map((_, i) => row[(i - s + n) % n]);
}

// ── 필인 ──  '4번째 반복마다 살짝 바꾸기' — 마지막 한 박을 통 · 짝 굴리기로(앞 칸 · 원래 패턴은 그대로 · 쿵은 남김)
const FILLS = {
  4: [[['tom', 1], ['tom', 1], ['snare', 1], ['snare', 2]], [['snare', 1], ['snare', 1], ['snare', 2], ['snare', 2]], [['tom', 1], ['snare', 1], ['tom', 1], ['snare', 2]]],
  3: [[['tom', 1], ['snare', 1], ['snare', 2]], [['snare', 1], ['snare', 1], ['snare', 2]], [['tom', 1], ['tom', 1], ['snare', 2]]],
  2: [[['tom', 1], ['snare', 2]], [['snare', 1], ['snare', 2]], [['snare', 2], ['snare', 2]]],
};
export function fillDrums(d, g, variant = 0) {
  const len = lenOf(g), from = len - g.sub, out = {};
  for (const r of ROWS) out[r] = d[r].slice();
  for (let i = from; i < len; i++) for (const r of ['snare', 'clap', 'hatc', 'hato', 'tom', 'shaker']) out[r][i] = 0;
  const shape = FILLS[g.sub][((variant % 3) + 3) % 3];
  shape.forEach(([r, v], j) => { out[r][from + j] = v; });
  return out;
}

// ── 주사위 ──  아무렇게나가 아니라 규칙 안에서: 첫 박 쿵 · 2·4박 짝(세 박이면 2·3박) · 칙은 고르게(조금씩 다르게)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function dice(g, rng = Math.random) {
  const len = lenOf(g), S = g.sub, d = {};
  for (const r of ROWS) d[r] = new Array(len).fill(0);
  const pick = (arr, n) => { const a = arr.slice(), out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]); return out; };
  const hatMode = Math.floor(rng() * 3);                       // 0 반 박마다 · 1 칸마다(세기 섞기) · 2 엇박에 열린 칙
  for (let bar = 0; bar < g.bars; bar++) {
    const o = bar * g.beats * S;
    d.kick[o] = 2;
    if (g.beats === 4) { d.snare[o + S] = 2; d.snare[o + 3 * S] = 2; } else { d.snare[o + S] = 1; d.snare[o + 2 * S] = 2; }
    //  쿵 더하기 — 짝 자리를 피한 곳에서 하나~셋(박 위 · 반 박 · 엇박 섞어)
    const backs = new Set(g.beats === 4 ? [S, 3 * S] : [S, 2 * S]);
    const spots = []; for (let i = 1; i < g.beats * S; i++) if (!backs.has(i)) spots.push(i);
    for (const i of pick(spots, 1 + Math.floor(rng() * 3))) d.kick[o + i] = rng() < 0.5 ? 2 : 1;
    //  여린 짝(살짝) — 가끔
    for (let i = 0; i < g.beats * S; i++) if (!backs.has(i) && i % S !== 0 && rng() < 0.12) d.snare[o + i] = 1;
    if (g.beats === 4 && rng() < 0.4) d.clap[o + 3 * S] = 1;
    //  칙
    for (let i = 0; i < g.beats * S; i++) {
      if (hatMode === 0) { if (S !== 4 || i % 2 === 0) d.hatc[o + i] = i % S === 0 ? 2 : 1; }
      else if (hatMode === 1) { if (rng() < 0.85) d.hatc[o + i] = i % S === 0 ? 2 : 1; }
      else if (i % S === 0) d.hatc[o + i] = 1;
      else if (S !== 3 && i % S === S / 2) d.hato[o + i] = 1;
      else if (S === 3 && i % S === 2) d.hato[o + i] = 1;
    }
  }
  return d;
}

// ── 베이스 · 화음 사건 ──
//  칸 i 에서: 쉼이면 { rest } · 음이면 { n, end }(end = 다음 음 · 쉼 자리 — 없으면 마디 끝까지 이어짐) · 빈칸이면 null
export function bassAt(p, i, len) {
  const v = p.b[i];
  if (v === B_REST) return { rest: true };
  if (!(v >= 0 && v <= 5)) return null;
  let j = i + 1; while (j < len && p.b[j] === B_EMPTY) j++;
  return { n: v, end: j };
}
//  가락도 같은 규칙(음 번호 0~7) — 다음 음 · 쉼 자리까지 이어지고, 없으면 패턴 끝에서 끝난다(다음 마디로 넘어가지 않음) [MUSIC-BEAT-MEL-1]
export function melAt(p, i, len) {
  const v = p.m[i];
  if (v === B_REST) return { rest: true };
  if (!(v >= 0 && v <= M_TOP)) return null;
  let j = i + 1; while (j < len && p.m[j] === B_EMPTY) j++;
  return { n: v, end: j };
}
//  빈 화음 칸 = 앞 화음이 이어진다(베이스 빈칸과 같은 규칙 — '도'만 놓고 '길게'면 패턴 끝까지 도) [MUSIC-BEAT-1 · 검토 반영]
//   예전에는 빈 칸에서 화음이 끊겨 '도 하나 + 길게'가 한 박만 울렸다 · 우리 장단 카드(['I', -, -])도 이제 마디 내내 깔린다
//  칸 k 를 맡은 화음 칸 번호(k 이하에서 가장 가까운 채운 칸 · 없으면 -1)
export function chordOwner(p, k) { for (let j = Math.min(k, p.c.length - 1); j >= 0; j--) if (p.c[j]) return j; return -1; }
//  칸 i 에서 화음을 친다면 { ch, d(칸), vel } — 길게 = 화음을 놓은 칸 처음에 한 번(다음 화음 칸 · 없으면 패턴 끝까지) · 쿵짝 · 짧게 톡톡 = 박 안 정한 자리마다(빈 칸이면 앞 화음으로)
export function chordAt(p, g, i) {
  const sl = slotLen(g), k = Math.floor(i / sl), k0 = chordOwner(p, k);
  if (k0 < 0) return null;
  const ch = p.c[k0];
  if (p.cs === 'long') {
    if (i % sl !== 0 || !p.c[k]) return null;
    let j = k + 1; while (j < p.c.length && !p.c[j]) j++;
    return { ch, d: (j - k) * sl, vel: 0.75 };
  }
  const inBeat = i % g.sub, pos = STYLE_POS[p.cs][g.sub];
  if (!pos.includes(inBeat)) return null;
  return { ch, d: p.cs === 'short' ? 1 : g.sub === 4 ? 2 : 1, vel: inBeat === 0 ? 0.8 : 0.62 };
}
//  화음 칸 처음인데 맡은 화음이 없으면(앞쪽 칸이 모두 비었으면 — 치던 중에 화음을 지운 때 등) 울리던 화음을 거기서 끝낸다
export const chordGap = (p, g, i) => i % slotLen(g) === 0 && chordOwner(p, i / slotLen(g)) < 0;

// ── 칸 수 바꾸기 ──  박 자리로 옮긴다(16칸 '2박 첫 칸' → 8칸 '2박 첫 칸'). 두 마디 ↔ 한 마디 = 첫 마디만 / 되풀이
export function convertPattern(p, fromKey, toKey) {
  const from = gridOf(fromKey), to = gridOf(toKey);
  if (from.key === to.key) return clonePattern(p);
  const fBar = from.beats * from.sub, tBar = to.beats * to.sub, out = emptyPattern(to);
  const map = i => { const beat = i / from.sub; if (beat >= to.beats) return -1; const j = Math.round(beat * to.sub); return j < tBar ? j : -1; };
  //  베이스 · 가락: 두 칸이 한 자리로 모이면 먼저 온 음이 그 자리 — 다만 음이 쉼을 이긴다 [MUSIC-BEAT-MEL-1]
  //   (16칸 → 8칸에서 '반 박 앞 쉼'이 '박 첫 음'을 지워 버리던 것 · 예: 7칸 쉼 + 8칸 음 → 4칸에 음)
  const put = (row, k, v) => { if (v === B_EMPTY) return; const o = row[k]; if (o === B_EMPTY || (o === B_REST && v !== B_REST)) row[k] = v; };
  for (let bar = 0; bar < to.bars; bar++) {
    const fo = (bar % from.bars) * fBar, to0 = bar * tBar;
    for (let i = 0; i < fBar; i++) {
      const j = map(i); if (j < 0) continue;
      for (const r of ROWS) out.d[r][to0 + j] = Math.max(out.d[r][to0 + j], p.d[r][fo + i] || 0);
      put(out.b, to0 + j, p.b[fo + i]);
      put(out.m, to0 + j, p.m[fo + i]);
    }
  }
  //  화음: 새 칸이 시작하는 박의 화음(옛 패턴이 짧으면 되풀이한 자리)
  const fBeats = beatsOf(from), fSlotBeats = fBeats / slotsOf(from), tSlotBeats = beatsOf(to) / slotsOf(to);
  out.c = out.c.map((_, k) => { const beat = (k * tSlotBeats) % fBeats; return p.c[Math.min(slotsOf(from) - 1, Math.floor(beat / fSlotBeats))] || null; });
  out.cs = p.cs;
  return out;
}
export function convertBeat(b, toKey) {
  if (!own(GRIDS, toKey) || String(toKey) === b.grid) return b;
  return { ...b, grid: String(toKey), pats: b.pats.map(p => convertPattern(p, b.grid, toKey)) };
}

// ── 기본 리듬 카드 ──  장르 이름 없이 아이 말로. 카드마다 북 + 베이스 + 화음 + 가락이 다 있는 한 패턴(지금 패턴 칸에 들어간다 · 그다음 바꿔 쓰기)
//  북 줄 글: X 세게 · x 보통 · . 빈칸(띄어쓰기는 박 구분일 뿐) / 베이스 글: 0~5 음 · x 쉼 · . 빈칸 / 화음: 박마다(세 박이면 셋)
//  [MUSIC-BEAT-MEL-1] 가락 글 m: 0~7 음(도 레 미 솔 라 높은 도 · 레 · 미) · x 쉼 · . 빈칸(앞 음이 이어짐) · lead = 가락 악기
//   가락은 짧게 되풀이하는 한 마디 — 앞 두 박을 뒤 두 박에서 한 번 더 하고 끝만 바꿔 길게(그 박 화음의 음으로 끝남)
export const STARTERS = [
  { id: 'basic', name: '쿵 짝 기본', em: '🥁', desc: '쿵은 1·3박, 짝은 2·4박 — 모든 비트의 시작', grid: '16', bpm: 96, swing: 0, kit: 'elec', lead: 'synth',
    d: { kick: 'X... .... X... ....', snare: '.... X... .... X...', hatc: 'x.x. x.x. x.x. x.x.' }, b: '0... .... 3... ....', c: ['I', 'I', 'V', 'V'], cs: 'long',
    m: '2.3. 4.3x 2.3. 1...' },                               // 미 솔 라 솔 · 미 솔 레 —
  { id: 'run', name: '달리는 비트', em: '🏃', desc: '칙칙칙칙 잘게 쪼갠 칙 위로 쿵이 앞으로 달려요', grid: '16', bpm: 128, swing: 0, kit: 'elec', lead: 'synth',
    d: { kick: 'X... ..x. X.x. ....', snare: '.... X... .... X...', hatc: 'Xxxx Xxxx Xxxx Xxxx' }, b: '0x0x 0x0x 4x4x 3x3x', c: ['I', 'I', 'vi', 'V'], cs: 'short',
    m: '5.5x 3.5. 4.4x 6...' },                               // 높은 도 도 · 솔 도 | 라 라 · 높은 레 —
  { id: 'bounce', name: '통통 튀는', em: '🐸', desc: '둘째 칸이 살짝 늦게 와요 — 통통 튀는 정도 38%', grid: '16', bpm: 90, swing: 38, kit: 'real', lead: 'xylo',
    d: { kick: 'X... ...x ..x. ....', snare: '.... X... .... X...', hatc: 'x.xx x.xx x.xx x.xx' }, b: '0... ...0 ..4. ....', c: ['I', 'I', 'vi', 'vi'], cs: 'oom',
    m: '0.2. 3.2x 0.2. 4...' },                               // 도 미 솔 미 · 도 미 라 —
  { id: 'chill', name: '느긋하게', em: '🌙', desc: '짝을 3박에 한 번만 — 걸음이 반으로 느려져요', grid: '16', bpm: 76, swing: 0, kit: 'real', lead: 'piano',
    d: { kick: 'X... .... ..x. ....', snare: '.... .... X... ....', hatc: 'x.x. x.x. x.x. x...', hato: '.... .... .... ..x.' }, b: '4... .... 0... ....', c: ['vi', 'vi', 'IV', 'IV'], cs: 'long',
    m: '7... 6.5. 4... 5...' },                               // 높은 미 — 레 도 · 라 — 높은 도 —
  { id: 'dance', name: '춤추는 쿵쿵쿵쿵', em: '🕺', desc: '박마다 쿵! 박 사이에 치이 — 저절로 춤이 나와요', grid: '16', bpm: 120, swing: 0, kit: 'elec', lead: 'synth',
    d: { kick: 'X... X... X... X...', clap: '.... X... .... X...', hatc: 'x... x... x... x...', hato: '..x. ..x. ..x. ..x.' }, b: '..4x ..4x ..0x ..3x', c: ['vi', 'vi', 'IV', 'V'], cs: 'short',
    m: '4..4 ..5. 4..4 ..3.' },                               // 라 · 라 · 높은 도 | 라 · 라 · 솔(3 + 3 + 2 칸)
  { id: 'semachi', name: '우리 장단 · 세마치', em: '🪘', desc: '세 박 장단 — 한 박이 세 칸: 덩 · 덩 | 쿵 · 덕 | 쿵 덕 ·', grid: '9', bpm: 80, swing: 0, kit: 'kor', show: ['shaker'], lead: 'daegeum',
    d: { kick: 'X.. ... ...', clap: 'X.X ... ...', shaker: '... X.. X..', snare: '... ..X .X.', hato: 'x.. ... ...' }, b: '0.. ... ...', c: ['I', null, null], cs: 'long',
    m: '3.4 5.4 3..' },                                       // 솔 라 | 높은 도 라 | 솔 —
  { id: 'gutgeori', name: '우리 장단 · 굿거리', em: '🎎', desc: '네 박 장단 — 덩 · 기덕 | 쿵 · 더러러러 | 쿵 · 기덕 | 쿵 · 더러러러', grid: '12', bpm: 72, swing: 0, kit: 'kor', show: ['shaker', 'cymbal'], lead: 'daegeum',
    d: { kick: 'X.. ... ... ...', clap: 'X.. ... ... ...', tom: '..X ... ..X ...', shaker: '... X.. X.. X..', cymbal: '... ..x ... ..x', hato: 'x.. ... ... ...' }, b: '0.. ... ... ...', c: ['I', null, null, null], cs: 'long',
    m: '3.4 5.. 4.3 2..' },                                   // 솔 라 높은 도 — 라 솔 미 —
];
const parseDrum = (s, len) => { const c = String(s || '').replace(/\s/g, ''); return Array.from({ length: len }, (_, i) => (c[i] === 'X' ? 2 : c[i] === 'x' ? 1 : 0)); };
const parseBass = (s, len) => { const c = String(s || '').replace(/\s/g, ''); return Array.from({ length: len }, (_, i) => (c[i] === 'x' ? B_REST : /[0-5]/.test(c[i] || '') ? Number(c[i]) : B_EMPTY)); };
const parseMel = (s, len) => { const c = String(s || '').replace(/\s/g, ''); return Array.from({ length: len }, (_, i) => (c[i] === 'x' ? B_REST : /[0-7]/.test(c[i] || '') ? Number(c[i]) : B_EMPTY)); };
export function starterPattern(st) {
  const g = gridOf(st.grid), len = lenOf(g), p = emptyPattern(g);
  for (const r of ROWS) if (st.d[r]) p.d[r] = parseDrum(st.d[r], len);
  p.m = parseMel(st.m, len);                                    // 가락 없는 카드 = 빈 가락
  p.b = parseBass(st.b, len);
  p.c = Array.from({ length: slotsOf(g) }, (_, i) => (own(CHORDS, st.c[i]) ? st.c[i] : null));
  p.cs = st.cs;
  return p;
}
//  카드를 지금 패턴에 — 빠르기 · 스윙 · 소리 묶음 · 가락 악기도 카드대로. 칸 수가 다르면 다른 패턴도 그 칸 수로 옮긴다(converted)
export function applyStarter(b, id) {
  const st = STARTERS.find(s => s.id === id);
  if (!st) return { beat: b, converted: false };
  const converted = b.grid !== st.grid && b.pats.some((p, i) => i !== b.cur && !patternEmpty(p));
  const nb = convertBeat(b, st.grid);
  const pats = nb.pats.map((p, i) => (i === b.cur ? starterPattern(st) : p));
  const show = { ...b.show }; for (const r of st.show || []) show[r] = true;
  return { beat: { ...nb, pats, bpm: st.bpm, swing: st.swing, kit: st.kit, lead: leadOf(st.lead || LEAD_DEF[st.kit]), show }, converted };
}

// ── 가락 주사위 ── [MUSIC-BEAT-MEL-1]  아무렇게나가 아니라 '짧은 가락 → 한 번 더 → 끝만 바꿔 길게':
//  ① 두 박짜리 짧은 가락(음 3~5개 · 리듬 틀에서 고름) — 첫 음은 그 자리 화음의 음(화음이 없으면 도 · 미 · 솔 · 높은 도) · 다음 음은 대개 한두 칸씩(계단)
//  ② 뒤 두 박 = 앞 두 박의 첫 박을 그대로 한 번 더 + 넷째 박에 긴 음(그 박 화음의 음 가운데 앞 음과 가장 가까운 것)으로 끝
//  · 세 박(9칸) = 한 박 가락 → 둘째 박에서 한 칸 높게(낮게) 따라 하기 → 셋째 박 긴 음 · 두 마디(32칸) = A A | A 끝바꿈(네 번 중 마지막만 바꿈)
//  · 리듬 틀 = 한 박이 몇 칸(2 · 3 · 4)인지마다 두 박 안의 음 자리
const RIFF_RHY = {
  2: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [0, 1, 2, 3]],
  3: [[0, 2, 3, 5], [0, 3, 5], [0, 2, 3], [0, 1, 2, 3, 5], [0, 3, 4, 5], [0, 2, 3, 4]],
  4: [[0, 2, 4, 6], [0, 3, 6], [0, 2, 3, 6], [0, 1, 2, 4], [0, 3, 4, 6], [0, 2, 4, 5, 6], [0, 2, 3, 4, 6], [0, 1, 3, 4, 6], [0, 4, 6]],
};
const RIFF_RHY_1 = [[0, 2], [0, 1, 2], [0, 1]];                // 세 박 장단 — 한 박(세 칸) 안의 음 자리
const HOME = [0, 2, 3, 5];                                      // 화음이 없을 때 고를 음(도 · 미 · 솔 · 높은 도)
export function melDice(g, chords = [], rng = Math.random) {
  const len = lenOf(g), S = g.sub, sl = slotLen(g), m = new Array(len).fill(B_EMPTY);
  const pick = a => a[Math.floor(rng() * a.length)];
  //  칸 i 의 화음 음(빈 화음 칸 = 앞 화음이 이어짐 — chordOwner 와 같은 규칙)
  const tonesAt = i => { const k = Math.floor(i / sl); for (let j = Math.min(k, chords.length - 1); j >= 0; j--) if (typeof chords[j] === 'string' && own(CHORD_MEL, chords[j])) return CHORD_MEL[chords[j]]; return HOME; };
  //  끝 음 = 그 박 화음의 음 가운데 앞 음과 가장 가까운 다른 음(같은 거리면 낮은 쪽 — 내려앉는 느낌)
  const nearest = (tones, v) => { const o = tones.filter(x => x !== v), a = o.length ? o : tones; return a.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) || (Math.abs(x - v) === Math.abs(b - v) && x < b) ? x : b), a[0]); };
  const first = i => { const t = tonesAt(i), mid = t.filter(x => x >= 1 && x <= 5); return pick(mid.length ? mid : t); };
  //  계단처럼 — 한 방향으로 한두 칸 · 가끔 제자리(같은 음은 두 번까지) · 가끔 반대로(끝에 닿으면 돌아섬)
  const walk = (start, n) => {
    const dir = rng() < 0.5 ? 1 : -1, out = [start];
    for (let k = 1; k < n; k++) {
      let d = pick([dir, dir, dir, 2 * dir, 0, -dir]);
      if (d === 0 && k >= 2 && out[k - 1] === out[k - 2]) d = dir;
      let v = out[k - 1] + d;
      if (v < 0 || v > M_TOP) v = out[k - 1] - d;
      out.push(Math.max(0, Math.min(M_TOP, v)));
    }
    return out;
  };
  const put = (at, rhy, notes) => rhy.forEach((r, k) => { m[at + r] = notes[k]; });
  const gap = S === 4 ? 2 : 1;                                   // 가락 끝 음 뒤 쉼까지(16칸 = 반 박)
  if (g.beats === 3) {
    //  세 박: 한 박 가락 → 따라 하기(한 칸 위 · 아래) → 긴 음
    for (let bar = 0; bar < g.bars; bar++) {
      const o = bar * 3 * S, rhy = pick(RIFF_RHY_1), notes = walk(first(o), rhy.length);
      const sh = rng() < 0.5 ? 1 : -1, echo = notes.map(v => Math.max(0, Math.min(M_TOP, v + sh)));
      put(o, rhy, notes); put(o + S, rhy, echo);
      m[o + 2 * S] = nearest(tonesAt(o + 2 * S), echo[echo.length - 1]);
    }
    return m;
  }
  const ml = 2 * S, rhy = pick(RIFF_RHY[S] || RIFF_RHY[4]), notes = walk(first(0), rhy.length);
  const motif = at => { put(at, rhy, notes); const last = at + rhy[rhy.length - 1] + gap; if (last < at + ml) m[last] = B_REST; };
  //  끝바꿈: 첫 박 음만 그대로 + 넷째 박 긴 음(마디 끝까지)
  const ending = at => {
    const keep = rhy.filter(r => r < S);
    keep.forEach(r => { m[at + r] = notes[rhy.indexOf(r)]; });
    const prev = notes[rhy.indexOf(keep[keep.length - 1])];
    m[at + S] = nearest(tonesAt(at + S), prev);
  };
  const units = (len / ml) | 0;                                  // 두 박 묶음 수(16칸 = 둘 · 32칸 = 넷)
  for (let u = 0; u < units; u++) (u === units - 1 ? ending : motif)(u * ml);
  return m;
}
//  메아리 — 앞 절반 가락을 뒤 절반에 한 칸 높게(dir 1) · 낮게(dir -1) 옮겨 적는다(세 박 = 첫 박 → 둘째 박). 끝(도 · 높은 미)을 넘는 음은 끝에 멈춤
//   앞 절반 첫 칸이 비었으면(조용히 시작) 뒤 절반 첫 칸은 쉼(조용히 시작 — 앞 음이 넘어오지 않게) · 돌려줌 { m, notes 옮긴 음 수, clamped 끝에 멈춘 음 수 }
export function echoMel(m, g, dir = 1) {
  const len = lenOf(g), half = beatsOf(g) % 2 === 0 ? len / 2 : g.sub, out = m.slice(0, len);
  let notes = 0, clamped = 0;
  for (let i = 0; i < half; i++) {
    const v = m[i];
    if (v >= 0 && v <= M_TOP) { const w = v + (dir < 0 ? -1 : 1); if (w < 0 || w > M_TOP) clamped++; out[half + i] = Math.max(0, Math.min(M_TOP, w)); notes++; }
    else out[half + i] = i === 0 && v === B_EMPTY ? B_REST : v;
  }
  return { m: out, notes, clamped };
}

// ── 순서 ──  '이어 붙인 순서대로'이면 순서 칸들(비었으면 지금 패턴만)
export const playOrder = b => (b.mode === 'song' && b.arr.length ? b.arr.slice(0, 8) : [b.cur]);

// ── 왜 그럴까? ──  지금 패턴을 보고 맞는 한 줄을 고른다(앞이 먼저)
export const TIPS = {
  start: '칸을 눌러 소리를 넣고 ▶ 을 눌러 보세요. 네 칸이 한 박이에요.',
  backbeat: '쿵은 1·3박, 짝은 2·4박 — 그래서 몸이 저절로 들썩여요.',
  hats: '칙칙은 박을 잘게 나눠요. 시계처럼 일정하게 시간을 알려 줘요.',
  offbeat: '박과 박 사이(엇박)에 넣은 소리는 통통 튀어요.',
  swing: '통통 튀는 정도를 올리면 둘째 칸이 살짝 늦게 와서 깡충깡충 걸어요.',
  bass: '베이스를 쿵과 같은 칸에 넣으면 소리가 단단하게 붙어요.',
  chord: '화음이 도 → 솔 → 도 로 가면 집에 돌아온 느낌이 들어요.',
  repeat: '네 번 반복하고 한 번 바꾸면 귀가 즐거워요 — A A A B 처럼 이어 붙여 보세요.',
  copy: '패턴을 복사해서 조금만 바꾸면 \'비슷하지만 새로운\' 마디가 돼요.',
  fill: '마디 끝의 북 굴리기(필인)는 \'이제 바뀐다!\'고 미리 알려 줘요.',
  jangdan: '우리 장단은 한 박이 세 칸으로 나뉘어요 — 그래서 덩실덩실 흔들려요.',
  dense: '칸을 다 채우면 오히려 박이 안 들려요. 쉬는 칸이 리듬을 만들어요.',
  tempo: '빠르기를 바꾸면 같은 비트도 느낌이 달라져요. 70 과 140 을 견줘 보세요.',
  euclid: '16칸을 3이나 5로 나누면 딱 떨어지지 않아서 엇갈리는 재미있는 리듬이 나와요.',
  //  [MUSIC-BEAT-MEL-1] 가락
  mel: '짧은 가락을 두 번 반복하고 끝만 살짝 바꾸면 귀에 쏙 들어와요.',
  melchord: '가락의 첫 음과 끝 음을 그 박 화음의 음(도 화음이면 도 · 미 · 솔)으로 고르면 잘 어울려요.',
  layers: '북 → 베이스 → 화음 → 가락 차례로 하나씩 쌓아 보세요. 박자가 음악이 돼요.',
  melrest: '가락 사이에 쉼을 넣으면 숨을 쉬듯 또렷하게 들려요.',
};
export function tipsFor(b) {
  const g = gridOf(b.grid), p = b.pats[b.cur], len = lenOf(g), S = g.sub, out = [];
  if (!hasContent(b)) return ['start', 'copy'];
  const on = r => p.d[r].map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  const kick = on('kick'), back = [...on('snare'), ...on('clap')];
  if (g.beats === 4 && kick.includes(0) && kick.includes(2 * S) && back.includes(S) && back.includes(3 * S)) out.push('backbeat');
  if (b.kit === 'kor' || S === 3) out.push('jangdan');
  if (on('hatc').length + on('hato').length >= len / 2) out.push('hats');
  if ([...kick, ...back].some(i => i % S !== 0)) out.push('offbeat');
  if (b.swing > 0 && swingable(g)) out.push('swing');
  const bassOn = p.b.map((v, i) => (v >= 0 && v <= 5 ? i : -1)).filter(i => i >= 0);
  if (bassOn.length && kick.length) out.push('bass');
  if (p.c.includes('I') && p.c.includes('V')) out.push('chord');
  //  가락 — 있으면 반복 · 화음 음 · 쉼 이야기 / 없는데 베이스나 화음이 있으면 '가락까지 쌓아 보기'
  const melN = melCount(p);
  if (melN) { out.push('mel'); if (p.c.some(Boolean)) out.push('melchord'); if (melN >= 4 && !p.m.includes(B_REST)) out.push('melrest'); }
  else if (bassOn.length || p.c.some(Boolean)) out.push('layers');
  if (b.fill) out.push('fill');
  const cells = ROWS.reduce((a, r) => a + on(r).length, 0);
  if (cells > len * 4) out.push('dense');
  out.push(b.arr.length >= 3 ? 'repeat' : 'copy', 'euclid', 'tempo');
  return [...new Set(out)];
}

// ── 되풀이 박자기 ──  now() = 소리 시계 · emit(사건) = 소리 내기/화면 · beat() = 지금 비트(고치면 다음 칸부터)
//  사건: { kind: 'drum', t, row, vel } · { kind: 'mel', t, n, d } · { kind: 'meloff', t } · { kind: 'bass', t, n, d } · { kind: 'bassoff', t } · { kind: 'chord', t, ch, d, vel, style } · { kind: 'chordoff', t }
//        · { kind: 'click', t, accent, count? } · { kind: 'step', t, pat, step, bar, pos, song, hits, fill } (화면용 · 소리 뒤에)
export const LOOKAHEAD = 0.12, TICK_MS = 25;
export class Sequencer {
  constructor({ now, emit, beat }) { this.now = now; this.emit = emit; this.beat = beat; this.playing = false; }
  //  at = 첫 칸 시각 · countIn = 그 앞 한 마디 딸깍(하나 둘 셋 넷)
  start({ at, countIn = false }) {
    const b = this.beat(), g = gridOf(b.grid);
    this.playing = true; this.step = 0; this.bar = 0; this.crash = false; this.gridT = at; this.t0 = at;
    this.song = b.mode === 'song' && b.arr.length > 0; this.pos = 0; this.pat = this.song ? b.arr[0] : b.cur;
    this.autoClick = !hasContent(b);
    if (countIn) { const bt = 60 / b.bpm; for (let k = 0; k < g.beats; k++) this.emit({ kind: 'click', t: at - (g.beats - k) * bt, accent: k === 0, count: true }); }
    this.tick();
  }
  stop() { this.playing = false; }
  nextTime() { const b = this.beat(), g = gridOf(b.grid), sd = stepDur(b.bpm, g); return this.gridT + swingOff(this.step, b.swing, g, sd); }
  //  다음에 울 칸(녹음 — 아직 예약 안 한 칸도 견주려고)
  peek() { return { t: this.nextTime(), pat: this.pat, step: this.step }; }
  tick() {
    if (!this.playing) return 0;
    const now = this.now();
    //  탭이 오래 멈췄다 깨면(늦은 칸) 한꺼번에 몰아 울리지 않고 건너뛴다 — 마디 자리는 그대로
    let skip = 0;
    while (this.nextTime() < now - 0.02 && skip < 8192) { this._advance(true); skip++; }
    const horizon = now + LOOKAHEAD;
    let n = 0;
    while (this.playing && this.nextTime() < horizon && n < 256) { this._advance(false); n++; }
    return n;
  }
  _advance(silent) {
    const b = this.beat(), g = gridOf(b.grid), len = lenOf(g), sd = stepDur(b.bpm, g);
    if (this.step >= len) this._barEnd(b, false);             // 칸 수가 줄었으면
    const i = this.step, t = this.gridT + swingOff(i, b.swing, g, sd), p = b.pats[this.pat] || b.pats[0];
    const fillBar = !!b.fill && this.bar % 4 === 3;
    if (!silent) {
      const d = fillBar ? fillDrums(p.d, g, Math.floor(this.bar / 4)) : p.d, hits = [], ev = { pat: this.pat, step: i, bar: this.bar };
      for (const r of ROWS) { const v = d[r][i]; if (v) { hits.push(r); this.emit({ kind: 'drum', t, row: r, vel: v, ...ev }); } }
      if (i === 0 && this.crash) { if (b.kit !== 'kor' && !d.cymbal[0]) { hits.push('cymbal'); this.emit({ kind: 'drum', t, row: 'cymbal', vel: 1, crash: true, ...ev }); } }
      const ml = melAt(p, i, len);                              // 가락 [MUSIC-BEAT-MEL-1] — 베이스와 같은 길이 셈
      if (ml && ml.rest) this.emit({ kind: 'meloff', t, ...ev });
      else if (ml) { const end = this.gridT + (ml.end - i) * sd + (ml.end < len ? swingOff(ml.end, b.swing, g, sd) : 0); this.emit({ kind: 'mel', t, n: ml.n, d: end - t, ...ev }); hits.push('mel'); }
      const bs = bassAt(p, i, len);
      if (bs && bs.rest) this.emit({ kind: 'bassoff', t, ...ev });
      else if (bs) { const end = this.gridT + (bs.end - i) * sd + (bs.end < len ? swingOff(bs.end, b.swing, g, sd) : 0); this.emit({ kind: 'bass', t, n: bs.n, d: end - t, ...ev }); hits.push('bass'); }
      const ch = chordAt(p, g, i);
      if (ch) { const j = i + ch.d, end = this.gridT + ch.d * sd + (j < len ? swingOff(j, b.swing, g, sd) : 0); this.emit({ kind: 'chord', t, ch: ch.ch, d: end - t, vel: ch.vel, style: p.cs, ...ev }); hits.push('chord'); }
      else if (chordGap(p, g, i)) this.emit({ kind: 'chordoff', t, ...ev });
      if ((b.click || this.autoClick) && i % g.sub === 0) this.emit({ kind: 'click', t, accent: i === 0, ...ev });
      this.emit({ kind: 'step', t, pos: this.pos, song: this.song, hits, fill: fillBar, ...ev });
    }
    if (i === 0) this.crash = false;
    this.gridT += sd; this.step++;
    if (this.step >= len) this._barEnd(b, fillBar);
  }
  _barEnd(b, fillBar) {
    this.step = 0; this.bar++;
    if (fillBar) this.crash = true;
    const song = b.mode === 'song' && b.arr.length > 0;
    if (song) { this.pos = this.song ? (this.pos + 1) % b.arr.length : 0; this.pat = b.arr[this.pos]; }
    else { this.pos = 0; this.pat = b.cur; }
    this.song = song;
    this.autoClick = !hasContent(b);
  }
}
