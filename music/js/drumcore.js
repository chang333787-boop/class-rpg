// 북 치기 [MUSIC-DRUM-1] — 작은 북 한 개(사용자 반 7개 · 채 두 개)를 두 곳으로 친다.
//  가운데 = 쿵(D) · 옆 테두리(플라스틱) = 딱(K) · 둘을 한꺼번에 = 덩(B — 장구의 '덩'처럼 두 손을 같이. 세게가 아니라 '같이'가 핵심).
//  두 가지로 쓴다 — ① 단계(스테이지): 쿵 → 딱 → 쿵짝 → 쉼 → 덩 → 반 박 → 3박자 → 세마치 → 도전 (기본 곡 반주 위에서)
//                  ② 곡 반주: 리코더 곡(선생님 곡 · 기본 곡 · 내 곡 · 우리 반 곡)에 북 반주를 붙여 친다 — 박 치기 · 반주 리듬 · 가락 리듬 따라
//  기기 연동 없음(마이크 · 블루투스 0) — 화면을 보고 진짜 북을 치거나(점수 없음 · 스스로 별), 키보드 · 화면을 눌러 친다(판정 · 점수).
//  DOM 없음 — node 로 시험: scripts/unit/music/drum.test.mjs
import { barSteps, totalSteps } from './theory.js';
import { buildEvents, fromLibrary } from './song.js';
import { LIBRARY } from './library.js';

//  치는 곳 셋 — drum = 소리 장치(audio.js Engine.drum) 이름 · say = 입으로 말하는 소리(구음)
export const HITS = {
  D: { say: '쿵', part: '가운데', drum: 'don', color: '#e5484d' },
  K: { say: '딱', part: '테두리', drum: 'ka', color: '#2fa3e6' },
  B: { say: '덩', part: '가운데 + 테두리 같이', drum: 'donka', color: '#f2a93b' },
};

// ── 마디 글 ──  한 글자 = 한 칸(곡의 sub 칸이 한 박) · D 쿵 · K 딱 · B 덩 · . 쉼 · 띄어쓰기는 읽기 좋게(무시)
export function parseBar(str, bs) {
  const s = String(str).replace(/\s+/g, '');
  if (s.length !== bs) throw new Error(`마디 글 '${str}' 칸 수 ${s.length} ≠ ${bs}`);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '.') continue;
    if (!HITS[c]) throw new Error(`마디 글 '${str}' 모르는 글자 ${c}`);
    out.push({ at: i, k: c });
  }
  return out;
}
//  같은 칸에 둘 → 하나로(쿵 + 딱 = 덩) · 칸 순서대로
export function tidy(hits) {
  const by = new Map();
  for (const x of hits) {
    const p = by.get(x.s);
    by.set(x.s, !p ? x.k : p === x.k ? p : 'B');
  }
  return [...by.entries()].sort((a, z) => a[0] - z[0]).map(([s, k]) => ({ s, k }));
}
//  끝맺기 — 마지막 가락 음이 나오는 칸에 '맺는 소리'(덩, 덩을 아직 안 배운 단계는 쿵) 한 번 · 그 뒤는 쉼.
//   마지막 음이 마지막 두 마디 밖이면(끝이 길게 쉬는 곡) 마지막 마디 첫 박에서 맺는다 · 가락이 없으면 마지막 마디 첫 박
export function ending(song, hits, end = 'B') {
  const bs = barSteps(song), lastBar = (song.bars - 1) * bs;
  const notes = song.notes || [];
  const last = notes.length ? notes.reduce((a, n) => (n.s > a.s ? n : a)) : null;
  const fin = last && last.s >= lastBar - bs ? last.s : lastBar;
  return tidy([...hits.filter(x => x.s < fin), { s: fin, k: end }]);
}

// ── 단계(스테이지) ──  song = 반주로 깔 기본 곡(library 키) · bars = 마디 글(곡 길이만큼 돌려 씀) · end = 맺는 소리
//  덩(B)은 5단계에서 처음 배운다 — 그 앞 단계는 마디 글에도 맺는 소리에도 덩이 없다(시험이 본다)
//  세마치는 기본 곡에 3박 · 한 박 3칸 곡이 없어 가락 없이(평조 울림 + 박 소리) 장단만
export const STAGES = [
  { key: 'don', title: '가운데 쿵', song: 'star', bars: ['D.D.D.D.'], end: 'D',
    goal: '박마다 북 가운데를 "쿵"', tip: '채를 북에 대고 누르지 말고, 공이 튀듯 톡 튕겨요. 입으로 "쿵" 하고 말하면서!' },
  { key: 'ka', title: '테두리 딱', song: 'airplane', bars: ['K.K.K.K.', 'K.K.K.K.', 'D.D.K.K.', 'D.D.K.K.'], end: 'D',
    goal: '옆 테두리를 "딱" · 쿵과 바꿔 치기', tip: '북 옆 플라스틱 테두리를 채 끝으로 딱! 가운데 소리와 어떻게 다른지 들어 봐요.' },
  { key: 'kungjjak', title: '쿵짝 쿵짝', song: 'nabiya', bars: ['D.K.'], end: 'D',
    goal: '센 박은 쿵, 여린 박은 딱', tip: '우리가 아는 "쿵짝" 반주예요. 노래에 맞춰 몸을 흔들며 쳐 봐요.' },
  { key: 'rest', title: '쉼표도 박이에요', song: 'london', bars: ['D.K.D...', 'D.K.D...', 'K.K.K...', 'D...D...'], end: 'D',
    goal: '쉬는 박에서는 채를 들고 기다리기', tip: '안 치는 박도 마음속으로 "하나 둘 셋 넷" 세요. 쉬는 것도 음악이에요.' },
  { key: 'deong', title: '덩! 같이 치기', song: 'jingle', bars: ['B.K.D.K.'], end: 'B',
    goal: '덩 = 가운데와 테두리를 한꺼번에', tip: '한 손은 가운데, 한 손은 테두리. 세게 칠 필요 없어요 — 두 소리가 "동시에" 나는 게 중요해요.' },
  { key: 'eighth', title: '반 박 쪼개기', song: 'joy', bars: ['D.K.DDK.'], end: 'B',
    goal: '"쿵쿵" = 반 박씩 빠르게 두 번', tip: '오른손 · 왼손을 번갈아 치면 쉬워요. "쿵 딱 쿵쿵 딱"' },
  { key: 'three', title: '셋으로 세기', song: 'birthday', bars: ['B.K.K.', 'D.K.K.'], end: 'B',
    goal: '3박자 — "하나 둘 셋"의 첫 박을 쿵', tip: '왈츠처럼 첫 박만 힘주고, 둘 · 셋은 가볍게 딱 딱.' },
  { key: 'semachi', title: '세마치 장단', song: null, beats: 3, sub: 3, tempo: 72, nbars: 12, bars: ['B.BD.KDK.'], end: 'B',
    goal: '덩 · 덩 | 쿵 · 딱 | 쿵 딱 ·', tip: '우리 장단 세마치! 장구의 "덩 덩 쿵 덕 쿵 덕"을 북의 덩 · 쿵 · 딱으로 쳐요.' },
  { key: 'mix', title: '도전! 섞어 치기', song: 'mountain', bars: ['D.K.DDK.', 'D.KKD.K.', 'DDK.DDK.', 'B.K.B...'], end: 'B',
    goal: '지금까지 배운 것을 모두', tip: '빠른 곡이에요. 어려우면 위에서 "조금 느리게"로 바꿔 쳐 봐요.' },
];
export const stageByKey = k => STAGES.find(x => x.key === k) || null;
//  단계의 반주 곡 — 기본 곡이면 그 곡 그대로(되풀이 포함) · 없으면 가락 없는 판(장단 연습용)
export function stageSong(stage) {
  if (stage.song) {
    const item = LIBRARY.find(x => x.key === stage.song);
    if (!item) throw new Error('단계 반주 곡이 없어요: ' + stage.song);
    return fromLibrary(item);
  }
  return { v: 1, id: 'drum_' + stage.key, title: stage.title, beats: stage.beats, sub: stage.sub, bars: stage.nbars, tempo: stage.tempo, key: 0,
    scale: 'pyeong', inst: 'piano', notes: [], harm: [], chords: [], acc: { chord: true, bass: false, drum: 'none' }, mood: null, reverb: 0.12 };
}
//  마디 글을 곡 길이만큼 돌려 쓴 북 악보
export function patternChart(song, bars, end = 'B') {
  const bs = barSteps(song), parsed = bars.map(b => parseBar(b, bs)), out = [];
  for (let b = 0; b < song.bars; b++) for (const x of parsed[b % parsed.length]) out.push({ s: b * bs + x.at, k: x.k });
  return ending(song, out, end);
}
export const stageChart = (stage, song = stageSong(stage)) => patternChart(song, stage.bars, stage.end);

// ── 곡 반주 ──  리코더 곡 하나 → 북 반주 악보. 난이도 셋
export const DRUM_LEVELS = {
  easy:   { name: '박 치기', line: '박마다 한 번 — 센 박은 쿵, 여린 박은 딱' },
  normal: { name: '반주 리듬', line: '반 박이 섞인 반주 · 네 마디마다 첫 박은 덩' },
  hard:   { name: '가락 리듬 따라', line: '리코더 가락의 리듬을 그대로 · 센 박은 쿵, 나머지는 딱' },
};
//  반 박(8분) 글 → 칸 글: 한 박 2칸이면 그대로 · 4칸이면 반 박 = 2칸
const fromEighths = (s, sub) => (sub === 4 ? s.split('').map(c => c + '.').join('') : s);
//  박 · 칸에 맞춘 반주 마디 글(돌려 씀)
export function accompBars(song, level) {
  const { beats, sub } = song;
  if (sub === 3) {   // 한 박이 셋으로 나뉘는 곡(세마치 · 굿거리 · 6/8)
    if (level === 'normal' && beats === 3 && song.acc && song.acc.drum === 'semachi') return ['B.BD.KDK.'];
    if (level === 'normal' && beats === 4 && song.acc && song.acc.drum === 'gutgeori') return ['B.KD.KD.KD.K'];
    const one = i => (level === 'easy' ? (i === 0 || (beats === 4 && i === 2) ? 'D..' : 'K..') : i === 0 || (beats === 4 && i === 2) ? 'D.K' : 'K.K');
    return [Array.from({ length: beats }, (_, i) => one(i)).join('')];
  }
  const E = {
    easy:   { 2: ['D.K.'], 3: ['D.K.K.'], 4: ['D.K.D.K.'] },
    normal: { 2: ['D.K.', 'DDK.'], 3: ['D.K.K.', 'D.KKK.'], 4: ['D.K.DDK.'] },
  }[level === 'easy' ? 'easy' : 'normal'][beats] || ['D.K.'];
  return E.map(s => fromEighths(s, sub));
}
export function songChart(song, level = 'easy') {
  const bs = barSteps(song), out = [];
  if (level === 'hard') {
    //  가락 리듬 따라 — 음이 시작하는 칸마다 · 센 박(첫 박 · 4박자의 셋째 박) 머리 = 쿵 · 그 밖(여린 박 · 박 사이) = 딱 ·
    //   너무 붙은 음(16분 둘)은 하나만 · 네 마디 첫 박 = 덩
    const gap = song.sub >= 4 ? 2 : 1;
    let last = -99;
    for (const n of [...(song.notes || [])].sort((a, z) => a.s - z.s)) {
      if (n.s - last < gap) continue;
      last = n.s;
      const at = n.s % bs, beat = at / song.sub, strong = beat === 0 || (song.beats === 4 && beat === 2);
      out.push({ s: n.s, k: at === 0 && (n.s / bs) % 4 === 0 ? 'B' : strong ? 'D' : 'K' });
    }
  } else {
    const bars = accompBars(song, level).map(b => parseBar(b, bs));
    for (let b = 0; b < song.bars; b++) for (const x of bars[b % bars.length]) {
      const s = b * bs + x.at;
      out.push({ s, k: level === 'normal' && x.at === 0 && b % 4 === 0 ? 'B' : x.k });
    }
  }
  return ending(song, out, 'B');
}

// ── 소리 사건 ──  반주(가락 = 리코더 소리 · 화음 · 베이스 · 곡의 원래 북은 뺌 — 북은 아이 몫) + 북 소리 도움(track 'guide')
//  가락이 없으면(세마치) 박마다 작은 박 소리(track 'metro') · 시작 전 한 마디 세기(track 'count')
//  Player.mute.melody / .guide 로 치는 중에도 끄고 켠다(가락 소리 · 북 소리 도움)
export function drumEvents(song, chart, { speed = 1 } = {}) {
  const built = buildEvents(song, { scale: speed, countIn: song.beats, melody: true, drum: 'none', orch: false, lead: false });
  const events = built.events.map(e => (e.track === 'melody' ? { ...e, inst: 'recorder', vel: 0.6 } : e.track === 'count' ? e : { ...e, vel: (e.vel ?? 0.8) * 0.75 }));
  if (!(song.notes || []).length) for (let b = 0; b < song.bars * song.beats; b++) events.push({ t: built.offset + b * built.beatDur, kind: 'drum', drum: 'hat', vel: b % song.beats ? 0.16 : 0.28, track: 'metro' });
  for (const c of chart) events.push({ t: built.offset + c.s * built.stepDur, kind: 'drum', drum: HITS[c.k].drum, vel: 0.62, track: 'guide' });
  events.sort((a, z) => a.t - z.t);
  return { ...built, events };
}

// ── 판정 ──  키보드 · 화면 누르기로 칠 때만(진짜 북은 판정 없음)
//  t = 첫 음부터 초 · side = 'D'(쿵) | 'K'(딱)
//  · 덩은 쿵과 딱이 PAIR 초 안에 같이 와야 한 번 — 한쪽만 오면 '반쪽'(괜찮아 · 0.5)
//  · 다른 쪽을 쳤으면(쿵 자리에 딱) 음표는 그대로 두고 '반대!'만 알린다 — 곧바로 맞는 쪽을 치면 인정(완벽은 못 받음)
export const DRUM_WIN = { perfect: 0.05, great: 0.1, good: 0.15 };
export const PAIR = 0.09;
export const JUDGE_W = { perfect: 1, great: 0.7, good: 0.4, half: 0.5, miss: 0 };
export function createJudge(chart, win = DRUM_WIN) {
  const notes = chart.map(c => ({ t: c.t, k: c.k, s: c.s, hit: null, got: {}, wrong: false }));
  const stats = { perfect: 0, great: 0, good: 0, miss: 0, half: 0, wrong: 0, combo: 0, maxCombo: 0, sum: 0, count: notes.length };
  const kindOf = dt => (dt <= win.perfect ? 'perfect' : dt <= win.great ? 'great' : 'good');
  function judge(n, kind, at, half = false) {
    if (kind === 'perfect' && n.wrong) kind = 'great';
    n.hit = kind; n.at = at; n.half = half;
    if (half) stats.half++;
    stats[kind]++; stats.sum += half ? JUDGE_W.half : JUDGE_W[kind];
    if (kind === 'miss') stats.combo = 0; else { stats.combo++; stats.maxCombo = Math.max(stats.maxCombo, stats.combo); }
    return { kind, note: n, at, half };
  }
  function hit(side, t) {
    const near = notes.filter(n => !n.hit && Math.abs(n.t - t) <= win.good);
    //  ① 한쪽을 이미 받은 덩 — 다른 쪽이 PAIR 안에 오면 한 번으로
    const open = near.find(n => n.k === 'B' && !n.got[side] && Object.keys(n.got).length && Math.abs(Object.values(n.got)[0] - t) <= PAIR);
    if (open) { open.got[side] = t; const first = Math.min(...Object.values(open.got)); return judge(open, kindOf(Math.abs(first - open.t)), t); }
    //  ② 맞는 쪽(또는 덩)의 가장 이른 음표
    const n = near.find(x => x.k === side || (x.k === 'B' && !Object.keys(x.got).length));   // 한쪽을 받은 지 PAIR 가 지난 덩은 반쪽 판정을 기다린다(sweep)
    if (n && n.k === side) return judge(n, kindOf(Math.abs(n.t - t)), t);
    if (n) { n.got[side] = t; return { kind: 'pending', note: n, at: t }; }
    //  ③ 다른 쪽을 쳤다
    const w = near.find(x => x.k !== 'B');
    if (w) { if (!w.wrong) { w.wrong = true; stats.wrong++; } return { kind: 'wrong', note: w, at: t, want: w.k }; }
    return { kind: 'free', note: null, at: t };
  }
  //  지나간 음표 — 한쪽만 받은 덩은 PAIR 가 지나면 반쪽 · 아무것도 안 받은 음표는 판정 넓이가 지나면 놓침
  function sweep(t) {
    const out = [];
    for (const n of notes) {
      if (n.hit) continue;
      const got = Object.values(n.got);
      if (got.length) { if (t - got[0] > PAIR) out.push(judge(n, 'good', t, true)); }
      else if (t > n.t + win.good) out.push(judge(n, 'miss', t));
    }
    return out;
  }
  const score = () => Math.round(1e6 * stats.sum / Math.max(1, stats.count));
  const acc = () => Math.round(1000 * stats.sum / Math.max(1, stats.count)) / 10;
  return { notes, stats, hit, sweep, score, acc };
}
export const gradeOf = acc => (acc >= 95 ? 'S' : acc >= 88 ? 'A' : acc >= 75 ? 'B' : acc >= 60 ? 'C' : 'D');
export const starsOf = grade => ({ S: 3, A: 3, B: 2, C: 1 })[grade] || 0;

// ── 입으로 말하기(구음) ──  한 마디 → [{ at 칸, k | null, beat 박 머리인지 }] — 화면 위 '구음 띠' · 단계 카드 미리보기
export function sayBar(song, chart, bar) {
  const bs = barSteps(song), a = bar * bs, by = new Map(chart.filter(c => c.s >= a && c.s < a + bs).map(c => [c.s - a, c.k]));
  return Array.from({ length: bs }, (_, i) => ({ at: i, k: by.get(i) || null, beat: i % song.sub === 0 }));
}
//  한 마디를 글로 — '쿵 · 딱 · 쿵쿵 딱 ·' (박마다 띄움 · 박 머리 쉼 = ·)
export function sayText(song, chart, bar) {
  const cells = sayBar(song, chart, bar), beats = [];
  for (let b = 0; b < song.beats; b++) {
    const cs = cells.slice(b * song.sub, (b + 1) * song.sub), lastHit = cs.map(c => !!c.k).lastIndexOf(true);
    //  박 머리 쉼 = · · 박 안에서 두 소리 사이 쉼 = · (세마치 '덩·덩') · 박 끝에 남는 쉼은 안 적음
    beats.push(cs.map((c, i) => (c.k ? HITS[c.k].say : i === 0 || i < lastHit ? '·' : '')).join('') || '·');
  }
  return beats.join(' ');
}
//  기록 열쇠 — 리코더 기록장(practice) · 최고 기록(rhythm) 이름. 단계 = 'dst_<단계>' · 곡 = 'dsg<난이도 첫 글자>_<곡키>'
//   (저장소 열쇠는 40자에서 잘리므로 난이도를 앞에 — 긴 곡키여도 난이도끼리 안 섞인다)
export const stageRecKey = stage => 'dst_' + stage.key;
export const songRecKey = (songKey, level) => 'dsg' + String(level || 'easy')[0] + '_' + songKey;
export const usedKinds = chart => ['D', 'K', 'B'].filter(k => chart.some(c => c.k === k));
//  악보가 곡 안에 있는지(시험 · 화면 안전망) — 칸이 0 ~ 곡 끝 안 · 순서대로 · 겹침 없음
export const chartOK = (song, chart) => chart.every((c, i) => c.s >= 0 && c.s < totalSteps(song) && HITS[c.k] && (i === 0 || chart[i - 1].s < c.s));
