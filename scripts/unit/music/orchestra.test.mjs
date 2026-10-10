// 음악실 오케스트라 시험 [MUSIC-ORCH-1] — 편곡(orchestra.js) · 곡 모양(normalize) · 소리 사건(buildEvents) · 예전 곡이 그대로인지
//  node scripts/unit/music/orchestra.test.mjs   (DOM 없음 · 소리 없음 · 네트워크 없음)
//  · 편성 6 × 칸 켜고 끄기 128 × 박자 넷 = 사건이 모두 유한 · 곡 길이 안 · 악기 음역 안
//  · 아이가 쌓은 화음이 있으면 목관이 그 음을 분다 · 셈여림 0.3 ~ 1.1 · 점점 느리게(늘이기)는 단조 증가 · orchFinale 일 때만
//  · normalize 가 orch 를 살핀다 · 기본 곡 15곡 · 예전 악기 · 국악 음계 · 선생님 곡은 예전 buildEvents(아래에 옮겨 둔 것)와 한 글자도 같다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, buildEvents, librarySongs, libraryOnce, fromTeacherSong, emptySong, INSTS, drumBar } from '../../../music/js/song.js';
import { PRESETS, PRESET_KEYS, PARTS, PART_KEYS, DYN, RANGE, INST_GROUPS, FAMILIES, defaultOrch, normOrch, orchOn, orchOK, applyPreset, dynAt, ritWarp, RIT_K,
  leadShift, chordLine, arrange, harmBelow, voiceChord, samplePhrase, familyOf } from '../../../music/js/orchestra.js';
import { stepSec, barSteps, totalSteps, fitChords, chordPcs, chordRoot, chordByName, chordName, SCALES, pc } from '../../../music/js/theory.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 260)} · 실제 ${sa.slice(0, 260)}`); };

// ── 예전 buildEvents(origin/main 7a8242b9 그대로 옮김) — 오케스트라를 끈 곡이 한 글자도 안 바뀌었는지 견준다 ──
const voiceB = (roman, key) => chordPcs(roman, key).map(c => 50 + ((c - 50 % 12 + 12) % 12)).sort((a, z) => a - z);
const bassOfB = (roman, key) => 45 + ((chordRoot(roman, key) - 45 % 12 + 12) % 12);
const DRONE_B = { pyeong: [55, 62], gyemyeon: [57, 64] };
function progAtB(song, beat) {
  if (!song.prog || !song.prog.length) return null;
  const nm = song.prog[Math.floor(beat / (song.progEvery || 1)) % song.prog.length];
  return nm === '-' ? null : chordByName(nm);
}
function drumBarB(song, kind) {
  const { beats, sub } = song;
  if (kind === 'none' || !kind) return [];
  if (kind === 'semachi' && beats === 3 && sub === 3)
    return [{ at: 0, k: 'deong' }, { at: 2, k: 'deong', v: 0.7 }, { at: 3, k: 'kung' }, { at: 5, k: 'deok' }, { at: 6, k: 'kung' }, { at: 7, k: 'deok' }];
  if (kind === 'gutgeori' && beats === 4 && sub === 3)
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
function progBarB(ev, song, b, t0, beat, opt) {
  for (let k = 0; k < song.beats; k++) {
    const c = progAtB(song, b * song.beats + k);
    if (!c) continue;
    const prev = k || b ? progAtB(song, b * song.beats + k - 1) : null;
    const change = !prev || prev.name !== c.name;
    const t = t0 + k * beat;
    if (opt.bass && (change || k === 0)) ev.push({ t, d: beat * 0.9, kind: 'note', inst: 'bass', p: 45 + ((c.root - 45 % 12 + 12) % 12), vel: 0.55, track: 'bass' });
    if (opt.chord) for (const pc of c.pcs.slice(0, 3)) ev.push({ t, d: beat * 0.85, kind: 'note', inst: 'pad', p: 50 + ((pc - 50 % 12 + 12) % 12), vel: change ? 0.22 : 0.16, track: 'chord' });
  }
}
function buildEventsBefore(song, o = {}) {
  const opt = { melody: true, chord: song.acc.chord, bass: song.acc.bass, drum: song.acc.drum, scale: 1, countIn: 0, ...o };
  const sd = stepSec(song, opt.scale), bs = barSteps(song), beat = sd * song.sub;
  const off = opt.countIn * beat;
  const ev = [];
  for (let i = 0; i < opt.countIn; i++) ev.push({ t: i * beat, kind: 'click', accent: i === 0, track: 'count' });
  if (opt.melody) song.notes.forEach((n, i) => ev.push({ t: off + n.s * sd, d: n.d * sd, kind: 'note', inst: song.inst, p: n.p, vel: 0.85, track: 'melody', i }));
  if (opt.harm !== false) for (const n of song.harm || []) ev.push({ t: off + n.s * sd, d: n.d * sd, kind: 'note', inst: song.inst, p: n.p, vel: 0.5, track: 'harm' });
  const korean = SCALES[song.scale]?.family === 'korean';
  const chords = fitChords(song, song.chords);
  for (let b = 0; b < song.bars; b++) {
    const t0 = off + b * bs * sd;
    if (korean) {
      if (opt.chord) for (const p of DRONE_B[song.scale]) ev.push({ t: t0, d: bs * sd * 0.98, kind: 'note', inst: 'pad', p, vel: 0.22, track: 'chord' });
    } else {
      const ch = chords[b];
      const beats = song.beats;
      if (song.prog) { progBarB(ev, song, b, t0, beat, opt); for (const d of drumBarB(song, opt.drum)) ev.push({ t: t0 + d.at * sd, kind: 'drum', drum: d.k, vel: d.v ?? 0.8, track: 'drum', span: sd }); continue; }
      const bassBeats = beats === 4 ? [0, 2] : [0];
      const chordBeats = opt.bass ? (beats === 4 ? [1, 3] : beats === 3 ? [1, 2] : [1]) : [...Array(beats).keys()];
      if (opt.bass) for (const k of bassBeats) ev.push({ t: t0 + k * beat, d: beat * 0.9, kind: 'note', inst: 'bass', p: bassOfB(ch, song.key || 0), vel: 0.55, track: 'bass' });
      if (opt.chord) for (const k of chordBeats) for (const p of voiceB(ch, song.key || 0)) ev.push({ t: t0 + k * beat, d: beat * 0.8, kind: 'note', inst: 'pad', p, vel: 0.2, track: 'chord' });
    }
    for (const d of drumBarB(song, opt.drum)) ev.push({ t: t0 + d.at * sd, kind: 'drum', drum: d.k, vel: d.v ?? 0.8, track: 'drum', span: sd });
  }
  ev.sort((a, z) => a.t - z.t);
  return { events: ev, total: off + totalSteps(song) * sd, stepDur: sd, beatDur: beat, barDur: bs * sd, offset: off, chords };
}
//  연습(반주 켬 · 끔) · 리듬(가락 도움 켬 · 끔) · 목록 듣기 · 작곡 ▶ 가 부르는 모양 그대로
const CALLS = {
  listen: s => ({}), finale: s => ({ orchFinale: true }), count: s => ({ countIn: 2 }),
  practiceOn: s => ({ scale: 0.8, countIn: s.beats, melody: true, chord: s.acc.chord, bass: s.acc.bass, drum: s.acc.drum, orch: true, lead: false }),
  practiceOff: s => ({ scale: 1.2, countIn: s.beats, melody: true, chord: false, bass: false, drum: 'none', orch: false, lead: false }),
  rhythmGuide: s => ({ scale: 1.1, countIn: s.beats, melody: true, harm: true, lead: false }),
  rhythmNo: s => ({ scale: 1.6, countIn: s.beats, melody: false, harm: false, lead: false }),
  idea: s => ({ chord: false, bass: false, drum: 'none', orch: false }),
};
const strip = b => ({ ...b, stepAt: undefined, orch: undefined });   // 오케스트라 길에만 있는 칸(없으면 undefined → JSON 에서 빠짐)

//  시험 곡 — 박자 넷(4/4 · 3/4 · 2/4 사장조 · 9/8 겹박자) · 가락 도4 ~ 미5(작곡 칸 기본 넓이)
const mk = (o) => normalize({ title: '시험', notes: [], ...o });
const twinkle = () => { const s = normalize(libraryOnce('star')); s.scale = 'major'; return s; };
const waltzSong = () => mk({ beats: 3, sub: 2, bars: 8, tempo: 132, scale: 'major', notes: [
  { s: 0, d: 2, p: 67 }, { s: 2, d: 2, p: 64 }, { s: 4, d: 2, p: 64 }, { s: 6, d: 2, p: 65 }, { s: 8, d: 2, p: 62 }, { s: 10, d: 2, p: 62 },
  { s: 12, d: 2, p: 60 }, { s: 14, d: 2, p: 62 }, { s: 16, d: 2, p: 64 }, { s: 18, d: 6, p: 67 }, { s: 24, d: 2, p: 69 }, { s: 26, d: 2, p: 67 }, { s: 28, d: 2, p: 65 },
  { s: 30, d: 6, p: 64 }, { s: 36, d: 2, p: 62 }, { s: 38, d: 2, p: 64 }, { s: 40, d: 2, p: 62 }, { s: 42, d: 6, p: 60 }] });
const marchG = () => mk({ beats: 2, sub: 2, bars: 8, tempo: 116, key: 7, scale: 'major', notes: [
  { s: 0, d: 1, p: 67 }, { s: 1, d: 1, p: 71 }, { s: 2, d: 2, p: 74 }, { s: 4, d: 2, p: 72 }, { s: 6, d: 2, p: 71 }, { s: 8, d: 1, p: 69 }, { s: 9, d: 1, p: 71 }, { s: 10, d: 2, p: 72 },
  { s: 12, d: 4, p: 69 }, { s: 16, d: 2, p: 67 }, { s: 18, d: 2, p: 71 }, { s: 20, d: 2, p: 74 }, { s: 22, d: 2, p: 76 }, { s: 24, d: 2, p: 74 }, { s: 26, d: 2, p: 72 }, { s: 28, d: 4, p: 67 }] });
const compound = () => mk({ beats: 3, sub: 3, bars: 4, tempo: 90, scale: 'penta', acc: { chord: true, bass: true, drum: 'semachi' }, notes: [
  { s: 0, d: 3, p: 60 }, { s: 3, d: 2, p: 62 }, { s: 5, d: 1, p: 64 }, { s: 6, d: 3, p: 67 }, { s: 9, d: 6, p: 69 }, { s: 15, d: 3, p: 67 }, { s: 18, d: 3, p: 64 }, { s: 21, d: 3, p: 62 }, { s: 27, d: 9, p: 60 }] });
const SONGS = { twinkle, waltz: waltzSong, march: marchG, compound };
const ORCH_TRACKS = new Set(['melody', 'harm', 'strings', 'bass', 'winds', 'brass', 'harp', 'perc', 'sparkle', 'count']);
const NOTE_RANGE = inst => RANGE[inst] || null;
function checkOrch(b, song, tag, { finale = false } = {}) {
  const end = b.offset + totalSteps(song) * b.stepDur;
  for (const e of b.events) {
    ok(Number.isFinite(e.t) && e.t >= -1e-9, `${tag}: 시각 ${e.t}`);
    ok(ORCH_TRACKS.has(e.track), `${tag}: 모르는 트랙 ${e.track}`);
    if (e.kind !== 'click') ok(Number.isFinite(e.vel) && e.vel > 0 && e.vel <= 1, `${tag}: 세기 ${e.vel} (${e.track})`);
    if (e.kind === 'note') {
      ok(Number.isFinite(e.d) && e.d > 0 && Number.isFinite(e.p), `${tag}: 길이/높이 ${e.d} ${e.p}`);
      if (!finale) ok(e.t + e.d <= end + 1e-6, `${tag}: 곡 끝을 넘음 ${e.track} ${e.inst} ${(e.t + e.d).toFixed(3)} > ${end.toFixed(3)}`);
      const R = NOTE_RANGE(e.inst);
      if (R && e.track !== 'melody' && e.track !== 'harm') ok(e.p >= R[0] && e.p <= R[1], `${tag}: ${e.inst} 음역 밖 ${e.p} [${R}] (${e.track})`);
      if (e.art) ok(['swell', 'stacc', 'roll'].includes(e.art), `${tag}: 연주법 ${e.art}`);
      if (e.art === 'roll') ok(e.inst === 'timpani', `${tag}: 굴리기는 팀파니만`);
    } else if (e.kind === 'drum') {
      ok(['timpani', 'cymbal', 'bassdrum', 'triangle', 'snare', 'swell'].includes(e.drum), `${tag}: 북 ${e.drum}`);
      ok(e.t <= end + 1e-6, `${tag}: 북이 곡 끝 뒤 ${e.t}`);
      ok(Number.isFinite(e.span) && e.span > 0, `${tag}: span ${e.span}`);
    } else ok(e.kind === 'click', `${tag}: 사건 종류 ${e.kind}`);
  }
  if (finale) ok(b.total >= end - 1e-9, `${tag}: 늘인 길이 ${b.total} < ${end}`);
  else ok(Math.abs(b.total - end) < 1e-9, `${tag}: 길이 ${b.total} ≠ ${end}`);
}

await test('편성 6 × 칸 켜고 끄기 128 × 곡 넷 — 사건이 모두 유한 · 곡 길이 안 · 악기 음역 안 · 트랙 이름(작곡 ▶ · 리듬)', () => {
  let n = 0, evN = 0;
  for (const [sk, mkS] of Object.entries(SONGS)) for (const pk of PRESET_KEYS) for (let mask = 0; mask < 128; mask++) {
    const s = mkS(); applyPreset(s, pk);
    PART_KEYS.forEach((k, i) => { s.orch.parts[k] = !!(mask & (1 << i)); });
    s.orch.dyn = Object.keys(DYN)[mask % 4];
    const b = buildEvents(s);
    checkOrch(b, s, `${sk}/${pk}/${mask}`);
    const tr = new Set(b.events.map(e => e.track));
    PART_KEYS.forEach((k, i) => { if (!(mask & (1 << i))) ok(!tr.has(k), `${sk}/${pk}/${mask}: 끈 칸 ${k} 이 울림`); });
    ok(!tr.has('chord') && !tr.has('drum'), `${sk}/${pk}: 반주 친구(chord · drum)가 같이 울림`);
    if (mask === 127) for (const k of PART_KEYS) ok(tr.has(k) || (k === 'harm'), `${sk}/${pk}: 다 켰는데 ${k} 없음`);
    if (mask % 37 === 0) { const r = buildEvents(s, CALLS.rhythmGuide(s)); checkOrch(r, s, `${sk}/${pk}/${mask} 리듬`); n++; }
    n++; evN += b.events.length;
  }
  ok(n > 3000 && evN > 200000, `조합 ${n} · 사건 ${evN}`);
});
await test('가락 악기 높이 — 첼로 −12 · 콘트라베이스 · 튜바 아래로 · 첼레스타 +12 · 글로켄슈필 +24 · 바이올린 · 플루트 그대로 · 예전 악기 0 · 가락 모양 그대로(옥타브 하나)', () => {
  const s = twinkle();
  const sh = inst => leadShift({ ...s, inst });
  eq([sh('cello'), sh('celesta'), sh('glock'), sh('violin'), sh('flute'), sh('trumpet'), sh('piano'), sh('recorder'), sh('gayageum')], [-12, 12, 24, 0, 0, 0, 0, 0, 0]);
  ok(sh('contrabass') <= -12 && sh('tuba') <= -12, '낮은 악기 ' + sh('contrabass') + ' ' + sh('tuba'));
  for (const inst of Object.keys(INSTS)) {
    const t = { ...s, inst }, k = leadShift(t), R = RANGE[inst];
    ok(k % 12 === 0, inst + ' 옥타브 하나 ' + k);
    if (R) ok(t.notes.every(n => n.p + k >= R[0] && n.p + k <= R[1]), `${inst} 가락이 음역 안(${k})`);
    const b = buildEvents({ ...t, orch: { ...t.orch, on: true } });
    const mel = b.events.filter(e => e.track === 'melody');
    ok(mel.length === t.notes.length && mel.every((e, i) => e.p === t.notes[i].p + k), inst + ' 가락 사건 높이');
    const r = buildEvents({ ...t, orch: { ...t.orch, on: true } }, CALLS.rhythmGuide(t));
    ok(r.events.filter(e => e.track === 'melody').every((e, i) => e.p === t.notes[i].p), inst + ' 리듬 = 적은 높이 그대로(lead: false)');
  }
  ok(leadShift({ ...s, notes: [] , inst: 'cello' }) === 0, '빈 곡 0');
});
await test('아이가 쌓은 화음 — 목관 칸이 켜져 있으면 목관이 그 음(같은 때 · 같은 길이 · 옥타브 하나만 옮김)을 분다 · 가락 악기 harm 트랙은 쉼 · 목관을 끄면 예전처럼 harm', () => {
  const s = twinkle();
  s.harm = [{ s: 0, d: 2, p: 55 }, { s: 0, d: 2, p: 52 }, { s: 4, d: 2, p: 57 }, { s: 8, d: 4, p: 60 }, { s: 16, d: 2, p: 62 }];
  const N = normalize(s);
  for (const pk of PRESET_KEYS) {
    const t = normalize(N); applyPreset(t, pk); t.orch.parts.winds = true;
    const b = buildEvents(t), w = b.events.filter(e => e.track === 'winds');
    ok(!b.events.some(e => e.track === 'harm'), pk + ': harm 트랙이 남음');
    eq(w.map(e => [Math.round(e.t / b.stepDur), Math.round(e.d / b.stepDur)]), N.harm.map(h => [h.s, h.d]), pk + ' 때 · 길이');
    const ks = new Set(w.map((e, i) => e.p - N.harm[i].p));
    ok(ks.size === 1 && [...ks][0] % 12 === 0, pk + ' 옥타브 하나만 ' + [...ks]);
    t.orch.parts.winds = false;
    const b2 = buildEvents(t);
    ok(b2.events.filter(e => e.track === 'harm').length === N.harm.length && !b2.events.some(e => e.track === 'winds'), pk + ' 목관 끔 → harm');
  }
});
await test('화음 음이 없으면 목관 = 가락 아래(화음 음 쪽 3도 · 4도 · 6도) — 가락과 부딪히는 음정(반음 · 온음 · 7도) 없음 · 지나가는 음은 음계로 두 칸 아래', () => {
  for (const mkS of Object.values(SONGS)) {
    const s = mkS(); applyPreset(s, 'full');
    const b = buildEvents(s), w = b.events.filter(e => e.track === 'winds'), m = b.events.filter(e => e.track === 'melody');
    ok(w.length === m.length, '음 수 ' + w.length + ' ' + m.length);
    w.forEach((e, i) => { const iv = ((m[i].p - e.p) % 12 + 12) % 12; ok(![1, 2, 6, 10, 11].includes(iv), `가락 ${m[i].p} · 목관 ${e.p} 음정 ${iv}`); });
  }
  eq([harmBelow(67, [0, 4, 7], [0, 2, 4, 5, 7, 9, 11], true), harmBelow(64, [0, 4, 7], [0, 2, 4, 5, 7, 9, 11], true), harmBelow(62, [0, 4, 7], [0, 2, 4, 5, 7, 9, 11], false)], [64, 60, 59], 'harmBelow');
});
await test('셈여림 흐름 — 모든 자리에서 0.3 ~ 1.1 · 점점 크게 = 늘어남 · 점점 작게 = 줄어듦 · 작게→크게→작게 = 가운데가 가장 큼 · 그대로 = 1', () => {
  for (const k of [...Object.keys(DYN), 'bogus', undefined]) for (let i = 0; i <= 200; i++) { const v = dynAt(k, i / 200); ok(v >= 0.3 && v <= 1.1, `${k} ${i / 200} → ${v}`); }
  for (let i = 1; i <= 100; i++) { ok(dynAt('cresc', i / 100) > dynAt('cresc', (i - 1) / 100), '점점 크게'); ok(dynAt('dim', i / 100) < dynAt('dim', (i - 1) / 100), '점점 작게'); }
  ok(dynAt('arch', 0.5) > dynAt('arch', 0.1) && dynAt('arch', 0.5) > dynAt('arch', 0.9) && dynAt('flat', 0.3) === 1, '아치 · 그대로');
  ok(dynAt('cresc', -1) === dynAt('cresc', 0) && dynAt('cresc', 9) === dynAt('cresc', 1), '0 ~ 1 밖은 끝값');
  //  실제 반주 세기에도 — 점점 크게 곡의 끝 마디 반주가 첫 마디보다 크다
  const s = twinkle(); applyPreset(s, 'full'); s.orch.dyn = 'cresc';
  const b = buildEvents(s), st = b.events.filter(e => e.track === 'strings');
  ok(st[st.length - 1].vel > st[0].vel * 1.8, `현 세기 ${st[0].vel} → ${st[st.length - 1].vel}`);
});
await test('점점 느리게 끝내기 — 늘이기는 단조 증가 · 끝 두 마디 앞은 그대로 · 거꾸로(inv)도 맞음 · orchFinale 일 때만(연습 · 리듬 · 아이디어는 안 늘임)', () => {
  const W = ritWarp(10, 16);
  let prev = -Infinity;
  for (let u = 0; u <= 20; u += 0.01) { const w = W.at(u); ok(w > prev, `단조 ${u}`); prev = w; if (u <= 10) ok(Math.abs(w - u) < 1e-12, '앞은 그대로'); ok(Math.abs(W.inv(w) - u) < 1e-6, `inv ${u}`); }
  ok(Math.abs(W.end - (16 + 6 * RIT_K / 3)) < 1e-9 && W.at(16) === W.end, '끝');
  const sl = (W.at(15.999) - W.at(15.989)) / 0.01; ok(sl > 1 + RIT_K * 0.95 && sl < 1 + RIT_K + 1e-6, '끝 빠르기 1/(1+k) ' + sl);
  for (const [sk, mkS] of Object.entries(SONGS)) for (const pk of PRESET_KEYS) {
    const s = mkS(); applyPreset(s, pk); s.orch.rit = true;
    const plain = buildEvents(s), fin = buildEvents(s, CALLS.finale(s));
    checkOrch(fin, s, sk + '/' + pk + ' 늘임', { finale: true });
    const T0 = (s.bars - 2) * barSteps(s) * plain.stepDur;
    ok(fin.total > plain.total + plain.beatDur, `${sk}/${pk}: 늘인 길이 ${fin.total} vs ${plain.total}`);
    ok(typeof fin.stepAt === 'function' && !plain.stepAt, '재생 막대 함수');
    for (let t = 0; t < fin.total; t += 0.05) { const a = fin.stepAt(t), z = fin.stepAt(t + 0.05); ok(z >= a - 1e-9 && a >= 0 && a <= totalSteps(s), 'stepAt 단조 · 칸 안'); }
    const pm = plain.events.filter(e => e.track === 'melody'), fm = fin.events.filter(e => e.track === 'melody');
    pm.forEach((e, i) => { if (e.t < T0 - 1e-9) ok(Math.abs(fm[i].t - e.t) < 1e-9, '앞 마디 그대로'); else if (e.t > T0 + 1e-6) ok(fm[i].t > e.t, '끝 두 마디는 늦어짐'); });
    const lastEnd = Math.max(...fin.events.filter(e => e.kind === 'note').map(e => e.t + e.d));
    ok(lastEnd > Math.max(...plain.events.filter(e => e.kind === 'note').map(e => e.t + e.d)) + plain.beatDur, '마지막 화음 늘임');
    for (const c of ['practiceOn', 'rhythmGuide', 'rhythmNo', 'count']) {
      const o = CALLS[c](s), b = buildEvents(s, o), sd = stepSec(s, o.scale || 1), off = (o.countIn || 0) * sd * s.sub;
      ok(!b.stepAt && Math.abs(b.total - (off + totalSteps(s) * sd)) < 1e-9, `${c}: 안 늘임`);
      b.events.filter(e => e.track === 'melody').forEach(e => ok(Math.abs(e.t - (off + s.notes[e.i].s * sd)) < 1e-9 && Math.abs(e.d - s.notes[e.i].d * sd) < 1e-9, `${c}: 가락 = n.s 그대로`));
    }
    s.orch.rit = false;
    ok(!buildEvents(s, CALLS.finale(s)).stepAt, '끝맺기 끔 → 안 늘임');
  }
});
await test('곡 모양 — normalize 가 orch 를 살핀다(모르는 값 → 기본 · 꺼짐) · 고른 값은 그대로 · 두 번 해도 같음 · emptySong 기본 꺼짐', () => {
  const D = defaultOrch();
  eq(normalize({}).orch, D, '빈 곡');
  eq(emptySong().orch, D, 'emptySong');
  for (const bad of [null, 'x', 7, [], [1, 2], { on: 'yes' }, { on: 1 }, { preset: 'constructor' }, { preset: '__proto__' }, { preset: 5 }, { dyn: 'loud' }, { dyn: 'toString' }, { rit: 1 }, { parts: 'all' }, { parts: [true] }])
    { const o = normalize({ orch: bad }).orch; ok(o.on === false && PRESET_KEYS.includes(o.preset) && Object.keys(DYN).includes(o.dyn) && typeof o.rit === 'boolean', JSON.stringify(bad)); eq(Object.keys(o.parts), PART_KEYS, '칸 이름 ' + JSON.stringify(bad)); }
  const g = normalize({ orch: { on: true, preset: 'film', parts: { strings: false, harp: true, bogus: true, perc: 'no' }, dyn: 'arch', rit: false, extra: 1 } }).orch;
  eq(g, { on: true, preset: 'film', parts: { ...PRESETS.film.parts, strings: false, harp: true }, dyn: 'arch', rit: false }, '고른 값');
  eq(normalize(normalize({ orch: g })).orch, g, '두 번');
  ok(!('extra' in g) && !('bogus' in g.parts), '모르는 칸 버림');
  eq(normOrch({ preset: 'march' }).parts, PRESETS.march.parts, '편성 기본 칸');
  ok(normOrch({ preset: 'march' }).rit === false && normOrch({ preset: 'film' }).rit === true, '편성 기본 끝맺기');
  const saved = JSON.parse(JSON.stringify(normalize({ notes: [{ s: 0, d: 2, p: 60 }], orch: { on: true, preset: 'waltz' } })));
  ok(orchOn(normalize(saved)) && normalize(saved).orch.preset === 'waltz', '저장 → 불러오기(JSON) 그대로');
});
await test('기본 곡 15곡 · 오케스트라 끔 — buildEvents 가 예전과 한 글자도 같음(목록 듣기 · 연습 반주 켬/끔 · 리듬 · 세기 · normalize 를 거친 곡도)', () => {
  const libs = librarySongs();
  ok(libs.length === 15, '곡 수');
  let n = 0;
  for (const s of libs) {
    ok(!s.orch && !orchOn(s), s.lk + ' orch 없음');
    for (const [c, f] of Object.entries(CALLS)) { eq(strip(buildEvents(s, f(s))), buildEventsBefore(s, f(s)), `${s.lk} ${c}`); n++; }
    const N = normalize(s);
    for (const [c, f] of Object.entries(CALLS)) { eq(strip(buildEvents(N, f(N))), buildEventsBefore(N, f(N)), `${s.lk} normalize ${c}`); n++; }
    const once = libraryOnce(s.lk);
    eq(strip(buildEvents(once)), buildEventsBefore(once), s.lk + ' 한 번짜리');
  }
  ok(n === 15 * Object.keys(CALLS).length * 2, '견준 수 ' + n);
});
await test('예전 악기 다섯(+ 반주 pad · bass) · 내 곡 · 오케스트라 끔 = 예전과 같음 · 오케스트라를 켜도 국악 음계(평조 · 계면조)면 예전 그대로', () => {
  for (const inst of ['piano', 'xylo', 'marimba', 'recorder', 'gayageum']) for (const mkS of Object.values(SONGS)) {
    const s = mkS(); s.inst = inst; s.harm = [{ s: 0, d: 2, p: 55 }];
    for (const [c, f] of Object.entries(CALLS)) eq(strip(buildEvents(s, f(s))), buildEventsBefore(s, f(s)), `${inst} ${c}`);
    s.orch.on = true; s.orch.preset = 'full';
    for (const sc of ['pyeong', 'gyemyeon']) {
      const k = { ...s, scale: sc, acc: { ...s.acc, drum: 'semachi' } };
      ok(!orchOK(k) && !orchOn(k), sc + ' 오케스트라 안 됨');
      for (const [c, f] of Object.entries(CALLS)) eq(strip(buildEvents(k, f(k))), buildEventsBefore(k, f(k)), `${inst} ${sc} ${c}`);
    }
    ok(orchOK(s) && orchOn(s), '서양 음계는 됨');
  }
  ok(orchOK({ scale: 'penta' }) && orchOK({ scale: 'major' }) && !orchOK({ scale: 'constructor' }) && !orchOK(null), 'orchOK');
});
await test('선생님 곡 — orch 없음 · buildEvents 예전과 같음 · 곡 파일 악기는 예전 다섯 가지만(violin 은 막힘)', () => {
  const T = { key: 'orch_t', title: '시험 곡', beats: 4, sub: 2, tempo: 100, melody: 'C4/2 D4/2 E4/2 F4/2 | G4/8', prog: 'C G7', progEvery: 2 };
  const s = fromTeacherSong(T);
  ok(!s.orch && !orchOn(s), 'orch 없음');
  for (const [c, f] of Object.entries(CALLS)) eq(strip(buildEvents(s, f(s))), buildEventsBefore(s, f(s)), '선생님 곡 ' + c);
  let msg = ''; try { fromTeacherSong({ ...T, inst: 'violin' }); } catch (e) { msg = e.message; }
  ok(/악기\(inst\): piano · xylo · marimba · recorder · gayageum 중 하나예요/.test(msg), msg);
});
await test('연습 · 리듬 — 반주 끔(orch: false) = 오케스트라 없음 · 반주 켬 = 오케스트라(가락 = 적은 높이) · 리듬 가락 도움 끔이면 반짝이(가락 따라 하기)도 쉼', () => {
  const s = twinkle(); applyPreset(s, 'fairy');
  const off = buildEvents(s, CALLS.practiceOff(s));
  ok(off.events.every(e => ['melody', 'count'].includes(e.track)), '반주 끔: ' + [...new Set(off.events.map(e => e.track))]);
  const on = buildEvents(s, CALLS.practiceOn(s));
  const tr = new Set(on.events.map(e => e.track));
  ok(['strings', 'bass', 'winds', 'harp', 'perc', 'sparkle'].every(k => tr.has(k)), '반주 켬: ' + [...tr]);
  ok(on.events.filter(e => e.track === 'melody').every(e => e.p === s.notes[e.i].p), '가락 = 적은 높이(리코더가 부는 높이)');
  const no = buildEvents(s, CALLS.rhythmNo(s));
  ok(!no.events.some(e => e.track === 'melody' || e.track === 'sparkle') && no.events.some(e => e.track === 'harp'), '리듬 도움 끔: 가락 · 반짝이 없음 · 반주는 있음');
  ok(read('music/js/practice.js').includes("player.mute = { melody: !guide, sparkle: !guide }"), '연습 가락 소리 끔 = 반짝이도');
});
await test('화음 줄 — 마디마다(fitChords) · 끝 마디 자동 V + 마지막 음 도 = 그 음부터 I(마침) · 아이가 고른 화음은 그대로 · V → I 앞 딸림7(미와 부딪히면 안 더함) · 진행 곡은 박마다', () => {
  const s = twinkle();
  const L = chordLine(s);
  eq(L.map(g => g.name).join(' '), 'C F F G G7 C C C C F F G7 C', '작은 별');
  const tail = L[L.length - 1];
  ok(tail.bar === 11 && tail.s === 11 * 8 + 4 && tail.d === 4 && tail.roman === 'I', '끝 마디 셋째 박부터 I');
  const m = normalize(s); m.chords[11] = 'V';
  ok(chordLine(m).filter(g => g.bar === 11).length === 1 && chordLine(m).pop().roman === 'V', '아이가 V 를 고르면 V 그대로');
  ok(fitChords(s, s.chords)[11] === 'V', '반주 친구(예전)는 마디 하나 그대로');
  const e = normalize({ beats: 4, sub: 2, bars: 2, scale: 'major', notes: [{ s: 0, d: 4, p: 67 }, { s: 4, d: 4, p: 64 }, { s: 8, d: 8, p: 60 }], chords: ['V', 'I'] });
  ok(chordLine(e)[0].name === 'G', '미와 부딪히는 V 는 7 안 더함');
  const p = { ...s, prog: ['C', 'C', 'Am', 'G7'], progEvery: 1 };
  const pl = chordLine(p);
  ok(pl.length === 3 * 12 && pl[0].d === 4 && pl[1].name === 'Am' && pl[2].name === 'G7' && pl[2].pcs.length === 4, '진행 곡 박마다(같은 화음은 이어 붙임) ' + pl.slice(0, 3).map(g => g.name + g.d));
  const lib = librarySongs().find(x => x.lk === 'canon'); const n = normalize(lib); n.prog = lib.prog; n.progEvery = 1; n.orch = { ...n.orch, on: true };
  checkOrch(buildEvents(n), n, '캐논 진행 + 오케스트라');
});
await test('목소리 이끌기 — 현 화음은 가락보다 위로 안 올라감(높은 가락) · 화음 음만 · 한 마디에서 다음 마디로 크게 안 뜀', () => {
  for (const mkS of [twinkle, waltzSong]) {
    const s = mkS(); applyPreset(s, 'full');
    const b = buildEvents(s), st = b.events.filter(e => e.track === 'strings'), mel = b.events.filter(e => e.track === 'melody');
    const segs = chordLine(s);
    for (const e of st) {
      const step = e.t / b.stepDur, g = segs.find(x => x.s <= step + 1e-6 && step < x.s + x.d - 1e-6);
      ok(g && g.pcs.includes(pc(e.p)), `화음 밖 음 ${e.p} (${g && g.name})`);
      const over = mel.filter(m => m.t < e.t + e.d - 1e-9 && m.t + m.d > e.t + 1e-9);
      if (over.length) ok(e.p < Math.min(...over.map(m => m.p)) + 1, `현 ${e.p} 이 가락 ${Math.min(...over.map(m => m.p))} 위`);
    }
    const byT = new Map(); for (const e of st) { const k = e.t.toFixed(4); if (!byT.has(k)) byT.set(k, []); byT.get(k).push(e.p); }
    const vs = [...byT.values()].map(v => v.sort((a, z) => a - z));
    for (let i = 1; i < vs.length; i++) if (vs[i].length === vs[i - 1].length) ok(vs[i].reduce((a, p, j) => a + Math.abs(p - vs[i - 1][j]), 0) <= 9, '크게 뜀 ' + vs[i - 1] + ' → ' + vs[i]);
  }
  eq(voiceChord([0, 4, 7], [50, 72], [52, 55, 60], null), [52, 55, 60], '같은 화음 = 그대로');
});
await test('편성 · 칸 · 악기 묶음 · 악기 소개 — 이름 · 한 줄 · 가락 악기가 INSTS 안 · 울림 0 ~ 0.6 · 묶음이 INSTS 를 한 번씩 · ▶ 짧은 소리가 모두 유한', () => {
  eq(PRESET_KEYS, ['full', 'strings', 'march', 'film', 'waltz', 'fairy']);
  for (const [k, P] of Object.entries(PRESETS)) {
    ok(P.name && P.emoji && P.line && P.why && INSTS[P.lead] && P.reverb >= 0 && P.reverb <= 0.6 && typeof P.rit === 'boolean', k);
    eq(Object.keys(P.parts), PART_KEYS, k + ' 칸');
    ok(!/브랜치/.test(P.name + P.line + P.why), k + ' 금지 낱말');
    const s = twinkle(); applyPreset(s, k);
    ok(s.inst === P.lead && s.reverb === P.reverb && s.orch.on && s.orch.preset === k && s.orch.rit === P.rit, k + ' applyPreset');
  }
  ok(PART_KEYS.every(k => PARTS[k].name && PARTS[k].desc && ['str', 'wood', 'brass', 'perc'].includes(PARTS[k].fam)), '칸');
  const all = INST_GROUPS.flatMap(([, ks]) => ks);
  eq([...all].sort(), Object.keys(INSTS).sort(), '묶음 = INSTS 한 번씩');
  eq(INST_GROUPS.map(g => g[0]), ['현악기', '목관악기', '금관악기', '건반·타악기', '목소리'], '묶음 이름');
  for (const f of FAMILIES) for (const [k, name, line] of f.items) {
    ok(name && line && line.length <= 40, k + ' 한 줄');
    const ev = samplePhrase(k);
    ok(ev.length >= 1 && ev.every(e => Number.isFinite(e.t) && e.t >= 0 && e.t < 4 && (e.kind === 'drum' ? !!e.drum : Number.isFinite(e.p) && e.d > 0 && !!e.inst)), k + ' 소리');
    ok(familyOf(k) === f.key, k + ' 가족');
  }
});
await test('빈 곡 · 한 마디 · 16마디 · 화음 칸 끝 · 아주 빠르게/느리게 — 오케스트라가 안 깨짐', () => {
  for (const pk of PRESET_KEYS) for (const o of [{ notes: [] }, { bars: 1 }, { bars: 16 }, { tempo: 200 }, { tempo: 40 }, { bars: 2, beats: 2 }]) {
    const s = { ...twinkle(), ...o }; const N = normalize(s); applyPreset(N, pk); N.orch.dyn = 'dim';
    checkOrch(buildEvents(N), N, pk + ' ' + JSON.stringify(o));
    checkOrch(buildEvents(N, { orchFinale: true }), N, pk + ' 늘임 ' + JSON.stringify(o), { finale: true });
  }
});
await test('화면 연결(글로 확인) — 작곡 ▶ · 목록 듣기만 orchFinale · 연습 orch: acc · 리듬 lead: false · 아이디어 친구 orch: false · Player 연주법 · 버스터', () => {
  const app = read('music/js/app.js'), comp = read('music/js/compose.js'), prac = read('music/js/practice.js'), rh = read('music/js/rhythm.js'), au = read('music/js/audio.js'), html = read('music/index.html');
  ok(/buildEvents\(song, \{ orchFinale: true \}\)/.test(app), 'app listen');
  ok(/built = buildEvents\(song, \{ orchFinale: true \}\)/.test(comp), '작곡 ▶');
  ok(/buildEvents\(tmp, \{ chord: false, bass: false, drum: 'none', orch: false \}\)/.test(comp), '아이디어 친구');
  ok(/orch: acc, lead: false/.test(prac) && !/orchFinale/.test(prac), '연습');
  ok(/lead: false/.test(rh) && !/orchFinale/.test(rh), '리듬');
  ok(au.includes('this.e.note(ev.inst, ev.p, t, ev.d, ev.vel, this.bus, ev.art)'), 'Player 연주법');
  const v = m => (html.match(new RegExp(`"\\./js/${m}\\.js": "\\./js/${m}\\.js\\?v=([^"]+)"`)) || [])[1];
  //  [MUSIC-BEAT-1] 뒤에 다시 고친 모듈(app · css — 비트 만들기 bt1)도 있으니 '10-08 이후 값'인지만 본다(teacher-songs 시험과 같은 방식)
  const after = x => Number(String(x || '').slice(0, 8)) >= 20261008;
  for (const m of ['orchestra', 'audio', 'song', 'compose', 'app', 'practice', 'rhythm']) ok(after(v(m)), m + ' 버스터 ' + v(m));
  const tagV = (html.match(/<script type="module" src="js\/app\.js\?v=([^"]+)">/) || [])[1], cssV = (html.match(/css\/music\.css\?v=([^"]+)"/) || [])[1];
  ok(tagV === v('app') && after(cssV), 'script · css 버스터 ' + tagV + ' · ' + cssV);
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 오케스트라: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
