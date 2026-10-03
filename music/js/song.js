// 곡 한 개의 모양과 다루기 — 저장 모양 = 화면 모양(점 경로 없음). 한 번에 한 음(단선율)만 울리는 가락.
//  song = { v, id, title, beats, sub, bars, tempo, key(조: 다장조 0), scale, inst, notes:[{ s 시작 칸, d 칸 수, p 음 높이, w 노랫말 한 글자 }],
//           chords:[마디별로 손으로 고른 화음 'I'|'IV'|'V'|null], acc:{ chord, bass, drum }, mood, reverb }
import { parsePitch, barSteps, totalSteps, stepSec, fitChords, chordPcs, chordRoot, ROMAN, SCALES } from './theory.js';
import { LIBRARY } from './library.js';

export const INSTS = {
  piano: '피아노', xylo: '실로폰', marimba: '마림바', recorder: '리코더', gayageum: '가야금',
};
export const DRUMS = { basic: '쿵짝 리듬', semachi: '세마치 장단', gutgeori: '굿거리 장단', none: '없음' };

export function emptySong() {
  return { v: 1, id: null, title: '', beats: 4, sub: 2, bars: 4, tempo: 100, key: 0, scale: 'penta', inst: 'piano',
    notes: [], chords: [], acc: { chord: true, bass: true, drum: 'basic' }, mood: null, reverb: 0.12 };
}

// 'G4/1 E4/1 E4/2 | F4/1 …' → { notes, bars }
export function parseMelody(str, bs) {
  const notes = [];
  let s = 0, bars = 0;
  for (const bar of String(str).split('|')) {
    const toks = bar.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const start = bars * bs;
    s = start;
    for (const t of toks) {
      const [ps, ds] = t.split('/');
      const d = Number(ds);
      if (!(d > 0)) throw new Error('길이 없음: ' + t);
      if (ps !== 'R') { const p = parsePitch(ps); if (p == null) throw new Error('음 이름: ' + t); notes.push({ s, d, p }); }
      s += d;
    }
    if (s - start !== bs) throw new Error(`마디 ${bars + 1} 칸 수 ${s - start} ≠ ${bs}`);
    bars++;
  }
  return { notes, bars };
}

export function fromLibrary(item) {
  const bs = item.beats * item.sub;
  const { notes, bars } = parseMelody(item.melody, bs);
  const drum = item.beats === 3 && item.sub === 3 ? 'semachi' : item.beats === 4 && item.sub === 3 ? 'gutgeori' : 'basic';
  return { v: 1, id: 'lib_' + item.key, lib: true, lk: item.key, title: item.title, origin: item.origin, level: item.level,
    beats: item.beats, sub: item.sub, bars, tempo: item.tempo, key: item.key2 || 0, scale: item.scale, inst: item.inst,
    notes, chords: [], acc: { chord: true, bass: true, drum }, mood: null, reverb: 0.12, practice: !!item.practice };
}
export const librarySongs = () => LIBRARY.map(fromLibrary);

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

// 곡 키 — 연습 기록·리듬 기록이 곡을 가리키는 이름
export const songKey = song => song.lib ? 'lib_' + song.lk : 'u_' + String(song.by || 'me').replace(/[^\w-]/g, '_').slice(0, 30) + '_' + String(song.id || 'x').replace(/[^\w-]/g, '_').slice(0, 30);

// ── 소리 사건 만들기 ──  t = 시작부터 초. 반주는 '친구'들
// 화음 소리 자리: 50~61(레3~시3) 안에서 · 베이스: 45~56(라2~솔#3) 안에서 — 가락(도4 위)과 안 겹치게
const voice = (roman, key) => chordPcs(roman, key).map(c => 50 + ((c - 50 % 12 + 12) % 12)).sort((a, z) => a - z);
const bassOf = (roman, key) => 45 + ((chordRoot(roman, key) - 45 % 12 + 12) % 12);
const DRONE_VOICE = { pyeong: [55, 62], gyemyeon: [57, 64] };

export function buildEvents(song, o = {}) {
  const opt = { melody: true, chord: song.acc.chord, bass: song.acc.bass, drum: song.acc.drum, scale: 1, countIn: 0, ...o };
  const sd = stepSec(song, opt.scale), bs = barSteps(song), beat = sd * song.sub;
  const off = opt.countIn * beat;
  const ev = [];
  for (let i = 0; i < opt.countIn; i++) ev.push({ t: i * beat, kind: 'click', accent: i === 0, track: 'count' });
  if (opt.melody) song.notes.forEach((n, i) => ev.push({ t: off + n.s * sd, d: n.d * sd, kind: 'note', inst: song.inst, p: n.p, vel: 0.85, track: 'melody', i }));
  const korean = SCALES[song.scale]?.family === 'korean';
  const chords = fitChords(song, song.chords);
  for (let b = 0; b < song.bars; b++) {
    const t0 = off + b * bs * sd;
    if (korean) {
      if (opt.chord) for (const p of DRONE_VOICE[song.scale]) ev.push({ t: t0, d: bs * sd * 0.98, kind: 'note', inst: 'pad', p, vel: 0.22, track: 'chord' });
    } else {
      const ch = chords[b];
      const beats = song.beats;
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
export const JANGDAN_TEXT = { deong: '덩', kung: '쿵', deok: '덕', gi: '기', roll: '더러러러' };
