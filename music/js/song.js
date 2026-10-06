// 곡 한 개의 모양과 다루기 — 저장 모양 = 화면 모양(점 경로 없음). 한 번에 한 음(단선율)만 울리는 가락.
//  song = { v, id, title, beats, sub, bars, tempo, key(조: 다장조 0), scale, inst, notes:[{ s 시작 칸, d 칸 수, p 음 높이, w 노랫말 한 글자 }],
//           chords:[마디별로 손으로 고른 화음 'I'|'IV'|'V'|null], acc:{ chord, bass, drum }, mood, reverb,
//           harm:[{ s, d, p }] = 아이가 직접 쌓는 화음 음(같은 때 최대 3음 · 같은 때 시작한 음은 길이가 같다 = 화음 하나) }
import { chordName } from './theory.js';
import { parsePitch, letter, barSteps, totalSteps, stepSec, fitChords, chordPcs, chordRoot, chordByName, ROMAN, SCALES } from './theory.js';
import { LIBRARY } from './library.js';

export const INSTS = {
  piano: '피아노', xylo: '실로폰', marimba: '마림바', recorder: '리코더', gayageum: '가야금',
};
export const DRUMS = { basic: '쿵짝 리듬', semachi: '세마치 장단', gutgeori: '굿거리 장단', none: '없음' };

export function emptySong() {
  return { v: 1, id: null, title: '', beats: 4, sub: 2, bars: 4, tempo: 100, key: 0, scale: 'penta', inst: 'piano',
    notes: [], harm: [], chords: [], acc: { chord: true, bass: true, drum: 'basic' }, mood: null, reverb: 0.12 };
}

// 'G4/1 E4/1 E4/2 | F4/1 …' → { notes, bars }
//  [MUSIC-TSONG-1] 붙임줄 '~' — 'C4/4~ | C4/4' = 다음 음(다음 마디여도)과 이어 한 음(길이 = 둘의 합 · 'A4/1~ A4/3~ | A4/4' 처럼 줄줄이도).
//   이어지는 음은 높이가 같아야 하고, 쉼표에는 못 붙인다. 마디 칸 수는 전처럼 마디마다 제 칸만 센다.
//   기본 곡(library)은 '~' 를 안 쓴다 → 결과가 전과 같다(scripts/unit/music/teacher-songs.test.mjs 가 견줌)
export function parseMelody(str, bs) {
  const notes = [];
  let s = 0, bars = 0, tie = null;     // tie = '~' 로 다음 음에 이어질 음(다음 음 길이를 여기에 더한다)
  for (const bar of String(str).split('|')) {
    const toks = bar.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const start = bars * bs;
    s = start;
    for (const t of toks) {
      const tied = t.endsWith('~');
      const [ps, ds] = (tied ? t.slice(0, -1) : t).split('/');
      const d = Number(ds);
      if (!(d > 0)) throw new Error('길이 없음: ' + t);
      if (ps === 'R') {
        if (tie) throw new Error('붙임줄(~) 다음이 쉼표예요: ' + t);
        if (tied) throw new Error('쉼표에는 붙임줄(~)을 못 붙여요: ' + t);
      } else {
        const p = parsePitch(ps); if (p == null) throw new Error('음 이름: ' + t);
        if (tie) {
          if (tie.p !== p) throw new Error('붙임줄(~)로 이은 음의 높이가 달라요: ' + t);
          tie.d += d;
          if (!tied) tie = null;
        } else {
          const n = { s, d, p };
          notes.push(n);
          if (tied) tie = n;
        }
      }
      s += d;
    }
    if (s - start !== bs) throw new Error(`마디 ${bars + 1} 칸 수 ${s - start} ≠ ${bs}`);
    bars++;
  }
  if (tie) throw new Error('마지막 음에 붙임줄(~)이 있어요 — 이어질 음이 없어요');
  return { notes, bars };
}

export function fromLibrary(item) {
  const bs = item.beats * item.sub;
  const { notes, bars } = parseMelody(item.melody, bs);
  const drum = item.beats === 3 && item.sub === 3 ? 'semachi' : item.beats === 4 && item.sub === 3 ? 'gutgeori' : 'basic';
  return { v: 1, id: 'lib_' + item.key, lib: true, lk: item.key, title: item.title, origin: item.origin, level: item.level,
    beats: item.beats, sub: item.sub, bars, tempo: item.tempo, key: item.key2 || 0, scale: item.scale, inst: item.inst,
    notes, harm: [], chords: [], acc: { chord: true, bass: true, drum: item.drum || drum }, mood: null, reverb: 0.12, practice: !!item.practice,
    ...(item.prog ? { prog: item.prog.trim().split(/\s+/), progEvery: item.progEvery || 1 } : {}) };
}
export const librarySongs = () => LIBRARY.map(fromLibrary);

// ── 선생님 곡(공연 곡) [MUSIC-TSONG-1] ──
//  선생님이 교사 화면에서 넣는 곡 파일(.json)의 곡 하나. 저작권이 있는 곡이라 공개 저장소(library.js)에 넣지 않고 반 저장소 tsongs/<곡키> 에만.
//  가락 글은 library 꼴 그대로('~' 붙임줄 포함) · normalize 를 거치지 않는다(16마디로 자르지 않음 — 긴 공연 곡 · 노랫말 없음).
export const TSONG_KEY = /^[a-z0-9_-]{1,40}$/i;
export const TSONG_LIMIT = { title: 30, part: 12, origin: 30, memo: 60, melody: 40000, bars: 200, prog: 2000 };
//  곡 파일 하나(JSON.parse 한 값) → 곡 목록 — 곡 하나 · 곡 배열 · { kind: 'rpg-music-song', v: 1, songs: [ … ] }
export function teacherSongsIn(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') throw new Error('곡 파일 모양이 아니에요');
  if (data.songs == null && data.kind == null) return [data];
  if (data.kind != null && data.kind !== 'rpg-music-song') throw new Error('곡 파일 종류(kind)가 달라요: ' + String(data.kind).slice(0, 30));
  if (!Array.isArray(data.songs)) throw new Error('곡 파일의 songs 칸이 목록이 아니에요');
  return data.songs;
}
//  받은 곡 하나를 믿지 않고 살핀다 → { c = 저장할 모양(정한 칸만 · 앞뒤 빈칸 뺌 · 기본값 채움), notes, bars } · 틀리면 까닭을 담아 Error
function checkTeacherSong(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('곡 모양이 아니에요');
  const text = (k, name, need) => {
    const v = raw[k];
    if (v != null && typeof v !== 'string') throw new Error(`${name}: 글이어야 해요`);
    const t = (v || '').trim();
    if (need && !t) throw new Error(`${name}: 비었어요`);
    if (t.length > TSONG_LIMIT[k]) throw new Error(`${name}: ${TSONG_LIMIT[k]}자까지예요(지금 ${t.length}자)`);
    return t;
  };
  const oneOf = (k, name, list, d) => {
    const v = raw[k] == null ? d : typeof list[0] === 'number' ? Number(raw[k]) : raw[k];
    if (!list.includes(v)) throw new Error(`${name}: ${list.join(' · ')} 중 하나예요(지금 ${raw[k] == null ? '없음' : String(raw[k]).slice(0, 20)})`);
    return v;
  };
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  if (!TSONG_KEY.test(key)) throw new Error(`곡키(key): 영어 · 숫자 · _ · - 로 1~40자예요(지금 ${raw.key == null ? '없음' : String(raw.key).slice(0, 44)})`);
  const c = { key, title: text('title', '제목(title)', true) };
  const part = text('part', '부분(part)'), memo = text('memo', '메모(memo)');
  if (part) c.part = part;
  c.origin = text('origin', '출처(origin)') || '선생님 곡';
  if (memo) c.memo = memo;
  if (raw.order == null) c.order = 99;
  else { c.order = Number(raw.order); if (!Number.isFinite(c.order)) throw new Error('순서(order): 숫자여야 해요'); }
  c.beats = oneOf('beats', '박(beats)', [2, 3, 4]);
  c.sub = oneOf('sub', '한 박 칸 수(sub)', [2, 3, 4]);
  c.tempo = Math.round(Number(raw.tempo));
  if (!(c.tempo >= 40 && c.tempo <= 200)) throw new Error(`빠르기(tempo): 40~200이에요(지금 ${raw.tempo == null ? '없음' : String(raw.tempo).slice(0, 20)})`);
  c.key2 = oneOf('key2', '조(key2)', [0, 2, 5, 7], 0);
  c.scale = oneOf('scale', '음계(scale)', Object.keys(SCALES), 'major');
  c.inst = oneOf('inst', '악기(inst)', Object.keys(INSTS), 'recorder');
  if (raw.drum != null) c.drum = oneOf('drum', '북(drum)', Object.keys(DRUMS));
  c.level = raw.level == null ? 2 : Number(raw.level);
  if (!Number.isInteger(c.level) || c.level < 0 || c.level > 4) throw new Error('난이도(level): 0~4예요');
  if (typeof raw.melody !== 'string' || !raw.melody.trim()) throw new Error('가락(melody): 비었어요');
  c.melody = raw.melody.trim();
  if (c.melody.length > TSONG_LIMIT.melody) throw new Error(`가락(melody): 너무 길어요(${TSONG_LIMIT.melody}자까지 · 지금 ${c.melody.length}자)`);
  const bs = c.beats * c.sub;
  let got;
  try { got = parseMelody(c.melody, bs); } catch (e) { throw new Error('가락(melody): ' + e.message); }
  const { notes, bars } = got;
  if (!bars) throw new Error('가락(melody): 마디가 없어요');
  if (bars > TSONG_LIMIT.bars) throw new Error(`가락(melody): ${TSONG_LIMIT.bars}마디까지예요(지금 ${bars}마디)`);
  if (!notes.length) throw new Error('가락(melody): 음이 하나도 없어요');
  for (const n of notes) {
    if (!Number.isInteger(n.s) || !Number.isInteger(n.d)) throw new Error(`가락(melody) ${Math.floor(n.s / bs) + 1}마디: 길이는 칸 수(정수)로 적어요`);
    if (n.p < 48 || n.p > 84) throw new Error(`가락(melody) ${Math.floor(n.s / bs) + 1}마디: ${letter(n.p)} 음은 너무 낮거나 높아요(C3~C6 안)`);
  }
  if (raw.prog != null && raw.prog !== '') {
    if (typeof raw.prog !== 'string') throw new Error('화음(prog): 글이어야 해요');
    const prog = raw.prog.trim().split(/\s+/).filter(Boolean).join(' ');
    if (prog.length > TSONG_LIMIT.prog) throw new Error(`화음(prog): 너무 길어요(${TSONG_LIMIT.prog}자까지)`);
    const bad = prog.split(' ').find(x => x !== '-' && !chordByName(x));
    if (bad) throw new Error('화음(prog): 모르는 화음 이름 ' + bad.slice(0, 12));
    if (prog) c.prog = prog;
  }
  if (raw.progEvery != null) {
    c.progEvery = Number(raw.progEvery);
    if (!Number.isInteger(c.progEvery) || c.progEvery < 1 || c.progEvery > 8) throw new Error('화음 바꾸는 박 수(progEvery): 1~8이에요');
  }
  return { c, notes, bars };
}
//  저장할 모양만(교사 화면 → store.saveTeacherSong) — 정한 칸 말고는 버린다(노랫말 · 모르는 칸 없음)
export const cleanTeacherSong = raw => checkTeacherSong(raw).c;
//  곡 파일의 곡 하나 → 곡(fromLibrary 와 같은 모양 · 16마디로 자르지 않음). id = 'ts_<곡키>' · 화면 제목 = 제목 · 부분
export function fromTeacherSong(raw) {
  const { c, notes, bars } = checkTeacherSong(raw);
  const drum = c.drum || (c.beats === 3 && c.sub === 3 ? 'semachi' : c.beats === 4 && c.sub === 3 ? 'gutgeori' : 'basic');
  return { v: 1, id: 'ts_' + c.key, ts: true, tk: c.key, lib: false, title: c.title + (c.part ? ' · ' + c.part : ''), name: c.title, part: c.part || '',
    origin: c.origin, memo: c.memo || '', order: c.order, level: c.level,
    beats: c.beats, sub: c.sub, bars, tempo: c.tempo, key: c.key2, scale: c.scale, inst: c.inst,
    notes, harm: [], chords: [], acc: { chord: true, bass: true, drum }, mood: null, reverb: 0.12, practice: false,
    ...(c.prog ? { prog: c.prog.split(' '), progEvery: c.progEvery || 1 } : {}) };
}

const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : d; };
// 받은 곡(저장소·친구 곡)을 믿지 않고 모양을 맞춘다
export function normalize(raw) {
  const s = emptySong();
  if (!raw || typeof raw !== 'object') return s;
  s.id = raw.id ? String(raw.id).slice(0, 60) : null;
  s.title = String(raw.title || '').slice(0, 30);
  s.beats = [2, 3, 4].includes(+raw.beats) ? +raw.beats : 4;
  s.sub = [2, 3, 4].includes(+raw.sub) ? +raw.sub : 2;
  s.bars = num(raw.bars, 1, 16, 4);
  s.tempo = num(raw.tempo, 40, 200, 100);
  s.key = [0, 2, 5, 7].includes(+raw.key) ? +raw.key : 0;
  s.scale = SCALES[raw.scale] ? raw.scale : 'penta';
  s.inst = INSTS[raw.inst] ? raw.inst : 'piano';
  const acc = raw.acc || {};
  s.acc = { chord: acc.chord !== false, bass: acc.bass !== false, drum: DRUMS[acc.drum] ? acc.drum : 'basic' };
  s.mood = ['bright', 'dreamy', 'sad'].includes(raw.mood) ? raw.mood : null;
  s.reverb = Math.max(0, Math.min(0.6, Number(raw.reverb) || 0.12));
  const total = totalSteps(s);
  const list = Array.isArray(raw.notes) ? raw.notes : raw.notes && typeof raw.notes === 'object' ? Object.values(raw.notes) : [];
  s.notes = list.map(n => ({ s: Math.round(+n.s), d: Math.round(+n.d), p: Math.round(+n.p), w: n.w ? String(n.w).slice(0, 3) : '' }))
    .filter(n => Number.isFinite(n.s) && Number.isFinite(n.d) && Number.isFinite(n.p) && n.s >= 0 && n.d >= 1 && n.s < total && n.p >= 48 && n.p <= 84)
    .map(n => ({ ...n, d: Math.min(n.d, total - n.s) }));
  s.notes = mono(s.notes);
  const hl = Array.isArray(raw.harm) ? raw.harm : raw.harm && typeof raw.harm === 'object' ? Object.values(raw.harm) : [];
  s.harm = chordify(hl.map(n => ({ s: Math.round(+n.s), d: Math.round(+n.d), p: Math.round(+n.p) }))
    .filter(n => Number.isFinite(n.s) && Number.isFinite(n.d) && Number.isFinite(n.p) && n.s >= 0 && n.d >= 1 && n.s < total && n.p >= 48 && n.p <= 84)
    .map(n => ({ ...n, d: Math.min(n.d, total - n.s) })).slice(0, 400));
  const ch = Array.isArray(raw.chords) ? raw.chords : raw.chords && typeof raw.chords === 'object' ? Object.assign([], raw.chords) : [];
  s.chords = Array.from({ length: s.bars }, (_, i) => ROMAN[ch[i]] ? ch[i] : null);
  for (const k of ['lib', 'lk', 'origin', 'level', 'practice', 'by', 'byName', 'created', 'updated', 'pub', 'rev']) if (raw[k] != null) s[k] = raw[k];
  return s;
}
// 겹치면 앞 음을 뒤 음 시작에서 자른다(단선율)
export function mono(notes) {
  const a = [...notes].sort((x, y) => x.s - y.s || y.d - x.d);
  const out = [];
  for (const n of a) {
    const last = out[out.length - 1];
    if (last && last.s === n.s) continue;                 // 같은 칸에 두 음 → 먼저 것만
    if (last && last.s + last.d > n.s) last.d = n.s - last.s;
    out.push({ ...n });
  }
  return out.filter(n => n.d >= 1);
}
// 화음 음 정리 — 같은 때 시작한 음 = 화음 하나(길이는 가장 짧은 것 · 3음까지) · 뒤 화음이 시작하면 앞 화음은 거기서 끝
export function chordify(harm) {
  const by = new Map();
  for (const n of harm) { if (!by.has(n.s)) by.set(n.s, []); const c = by.get(n.s); if (!c.some(x => x.p === n.p)) c.push(n); }
  const starts = [...by.keys()].sort((a, z) => a - z), out = [];
  starts.forEach((st, k) => {
    const c = by.get(st).slice(0, 3);
    let d = Math.min(...c.map(n => n.d));
    if (k + 1 < starts.length) d = Math.min(d, starts[k + 1] - st);
    if (d >= 1) for (const n of c.sort((a, z) => a.p - z.p)) out.push({ s: st, d, p: n.p });
  });
  return out;
}
export const chordAt = (song, s) => song.harm.filter(n => n.s === s);
// 화음 음 하나 놓기 — 그 자리에 화음이 있으면 거기에 쌓고(길이는 그 화음 것), 없으면 새 화음(마디·다음 화음 앞까지)
export function placeHarm(song, s, p, d) {
  const total = totalSteps(song), bs = barSteps(song);
  const here = chordAt(song, s);
  if (here.some(n => n.p === p)) return null;
  if (here.length >= 3) return 'full';
  if (here.length) { song.harm = chordify([...song.harm, { s, d: here[0].d, p }]); return true; }
  const next = song.harm.filter(n => n.s > s).sort((a, z) => a.s - z.s)[0];
  const barEnd = (Math.floor(s / bs) + 1) * bs;
  d = Math.max(1, Math.min(d, total - s, barEnd - s, next ? next.s - s : Infinity));
  // 앞 화음이 이 자리를 덮고 있으면 여기서 끊는다
  const cut = song.harm.map(n => n.s < s && n.s + n.d > s ? { ...n, d: s - n.s } : n);
  song.harm = chordify([...cut, { s, d, p }]);
  return true;
}
export function removeHarm(song, n) { song.harm = song.harm.filter(x => !(x.s === n.s && x.p === n.p)); }
export const noteAt = (song, step) => song.notes.find(n => n.s <= step && step < n.s + n.d) || null;
// 칸 s 에 길이 d 의 음 p 를 놓는다 — 그 자리의 음은 비키고(잘리거나 지워짐), 마디·곡 끝을 넘지 않는다
export function placeNote(song, s, p, d) {
  const total = totalSteps(song);
  d = Math.max(1, Math.min(d, total - s));
  const keep = [];
  for (const n of song.notes) {
    const a = n.s, z = n.s + n.d;
    if (z <= s || a >= s + d) { keep.push(n); continue; }
    if (a < s) keep.push({ ...n, d: s - a });              // 앞부분만 남김
    else if (z > s + d && a >= s) { /* 새 음 뒤로 남는 꼬리는 버린다(아이가 헷갈리지 않게) */ }
  }
  keep.push({ s, d, p, w: '' });
  song.notes = mono(keep);
  return song.notes.find(n => n.s === s);
}
export function removeNote(song, n) { song.notes = song.notes.filter(x => x !== n && !(x.s === n.s && x.p === n.p)); }

// 곡 키 — 연습 기록·리듬 기록이 곡을 가리키는 이름 · 선생님 곡 = 'ts_<곡키>'(practice/<sid>/ts_… · rhythm/ts_…) [MUSIC-TSONG-1]
export const songKey = song => song.ts ? 'ts_' + song.tk : song.lib ? 'lib_' + song.lk : 'u_' + String(song.by || 'me').replace(/[^\w-]/g, '_').slice(0, 30) + '_' + String(song.id || 'x').replace(/[^\w-]/g, '_').slice(0, 30);

// ── 소리 사건 만들기 ──  t = 시작부터 초. 반주는 '친구'들
// 화음 소리 자리: 50~61(레3~시3) 안에서 · 베이스: 45~56(라2~솔#3) 안에서 — 가락(도4 위)과 안 겹치게
const voice = (roman, key) => chordPcs(roman, key).map(c => 50 + ((c - 50 % 12 + 12) % 12)).sort((a, z) => a - z);
const bassOf = (roman, key) => 45 + ((chordRoot(roman, key) - 45 % 12 + 12) % 12);
const DRONE_VOICE = { pyeong: [55, 62], gyemyeon: [57, 64] };

// 박 k 의 화음(진행이 적힌 곡만) — { name, root, pcs } · '-' 또는 없으면 null
export function progAt(song, beat) {
  if (!song.prog || !song.prog.length) return null;
  const nm = song.prog[Math.floor(beat / (song.progEvery || 1)) % song.prog.length];
  return nm === '-' ? null : chordByName(nm);
}
// 박마다 반주 화음(진행이 있으면 그것, 없으면 마디 자동 화음) — 리듬 게임 화음 음표 · 악보 화음 이름이 쓴다
export function beatChords(song) {
  const out = [], key = song.key || 0;
  const auto = song.prog ? null : fitChords(song, song.chords);
  for (let b = 0; b < song.bars * song.beats; b++) {
    if (song.prog) { out.push(progAt(song, b)); continue; }
    const r = auto[Math.floor(b / song.beats)];
    out.push({ name: chordName(r, key), root: chordRoot(r, key), pcs: chordPcs(r, key) });
  }
  return out;
}
export function buildEvents(song, o = {}) {
  const opt = { melody: true, chord: song.acc.chord, bass: song.acc.bass, drum: song.acc.drum, scale: 1, countIn: 0, ...o };
  const sd = stepSec(song, opt.scale), bs = barSteps(song), beat = sd * song.sub;
  const off = opt.countIn * beat;
  const ev = [];
  for (let i = 0; i < opt.countIn; i++) ev.push({ t: i * beat, kind: 'click', accent: i === 0, track: 'count' });
  if (opt.melody) song.notes.forEach((n, i) => ev.push({ t: off + n.s * sd, d: n.d * sd, kind: 'note', inst: song.inst, p: n.p, vel: 0.85, track: 'melody', i }));
  if (opt.harm !== false) for (const n of song.harm || []) ev.push({ t: off + n.s * sd, d: n.d * sd, kind: 'note', inst: song.inst, p: n.p, vel: 0.5, track: 'harm' });   // 아이가 쌓은 화음
  const korean = SCALES[song.scale]?.family === 'korean';
  const chords = fitChords(song, song.chords);
  for (let b = 0; b < song.bars; b++) {
    const t0 = off + b * bs * sd;
    if (korean) {
      if (opt.chord) for (const p of DRONE_VOICE[song.scale]) ev.push({ t: t0, d: bs * sd * 0.98, kind: 'note', inst: 'pad', p, vel: 0.22, track: 'chord' });
    } else {
      const ch = chords[b];
      const beats = song.beats;
      if (song.prog) { progBar(ev, song, b, t0, beat, opt); for (const d of drumBar(song, opt.drum)) ev.push({ t: t0 + d.at * sd, kind: 'drum', drum: d.k, vel: d.v ?? 0.8, track: 'drum', span: sd }); continue; }
      const bassBeats = beats === 4 ? [0, 2] : [0];
      const chordBeats = opt.bass ? (beats === 4 ? [1, 3] : beats === 3 ? [1, 2] : [1]) : [...Array(beats).keys()];
      if (opt.bass) for (const k of bassBeats) ev.push({ t: t0 + k * beat, d: beat * 0.9, kind: 'note', inst: 'bass', p: bassOf(ch, song.key || 0), vel: 0.55, track: 'bass' });
      if (opt.chord) for (const k of chordBeats) for (const p of voice(ch, song.key || 0)) ev.push({ t: t0 + k * beat, d: beat * 0.8, kind: 'note', inst: 'pad', p, vel: 0.2, track: 'chord' });
    }
    for (const d of drumBar(song, opt.drum)) ev.push({ t: t0 + d.at * sd, kind: 'drum', drum: d.k, vel: d.v ?? 0.8, track: 'drum', span: sd });
  }
  ev.sort((a, z) => a.t - z.t);
  return { events: ev, total: off + totalSteps(song) * sd, stepDur: sd, beatDur: beat, barDur: bs * sd, offset: off, chords };
}

// 한 마디의 북 — at = 칸(소수 가능). 장단은 박자가 맞을 때만(아니면 쿵짝)
export function drumBar(song, kind) {
  const { beats, sub } = song;
  if (kind === 'none' || !kind) return [];
  if (kind === 'semachi' && beats === 3 && sub === 3)       // 덩 . 덩 | 쿵 . 덕 | 쿵 덕 .
    return [{ at: 0, k: 'deong' }, { at: 2, k: 'deong', v: 0.7 }, { at: 3, k: 'kung' }, { at: 5, k: 'deok' }, { at: 6, k: 'kung' }, { at: 7, k: 'deok' }];
  if (kind === 'gutgeori' && beats === 4 && sub === 3)      // 덩 . 기덕 | 쿵 . 더러러러 | 쿵 . 기덕 | 쿵 . 더러러러
    return [{ at: 0, k: 'deong' }, { at: 2, k: 'gi', v: 0.45 }, { at: 2.5, k: 'deok' }, { at: 3, k: 'kung' }, { at: 5, k: 'roll' },
            { at: 6, k: 'kung' }, { at: 8, k: 'gi', v: 0.45 }, { at: 8.5, k: 'deok' }, { at: 9, k: 'kung' }, { at: 11, k: 'roll' }];
  const out = [];
  for (let b = 0; b < beats; b++) {
    const at = b * sub;
    const strong = b === 0 || (beats === 4 && b === 2);
    out.push({ at, k: strong ? 'kick' : 'snare', v: strong ? 0.9 : beats === 3 ? 0.5 : 0.7 });
    for (let i = 0; i < sub; i++) out.push({ at: at + i, k: 'hat', v: i === 0 ? 0.35 : 0.22 });
  }
  return out;
}
// 진행이 적힌 곡의 한 마디 반주 — 박마다(화음이 바뀌는 박에) 베이스 뿌리음 + 화음
function progBar(ev, song, b, t0, beat, opt) {
  for (let k = 0; k < song.beats; k++) {
    const c = progAt(song, b * song.beats + k);
    if (!c) continue;
    const prev = k || b ? progAt(song, b * song.beats + k - 1) : null;
    const change = !prev || prev.name !== c.name;
    const t = t0 + k * beat;
    if (opt.bass && (change || k === 0)) ev.push({ t, d: beat * 0.9, kind: 'note', inst: 'bass', p: 45 + ((c.root - 45 % 12 + 12) % 12), vel: 0.55, track: 'bass' });
    if (opt.chord) for (const pc of c.pcs.slice(0, 3)) ev.push({ t, d: beat * 0.85, kind: 'note', inst: 'pad', p: 50 + ((pc - 50 % 12 + 12) % 12), vel: change ? 0.22 : 0.16, track: 'chord' });
  }
}
export const JANGDAN_TEXT = { deong: '덩', kung: '쿵', deok: '덕', gi: '기', roll: '더러러러' };
