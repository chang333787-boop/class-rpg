// 음악실 선생님 곡(공연 곡) 시험 [MUSIC-TSONG-1] — 곡 파일 모양 · 살피기(틀린 곡은 까닭과 함께 막힘) · 붙임줄 '~' · 16마디 넘는 곡 · 곡 키 · 저장 모양 · 시♭ 운지
//  node scripts/unit/music/teacher-songs.test.mjs   (DOM 없음 · 네트워크 없음)
//  시험 곡은 모두 저작권이 끝난 가락(작은 별 = 프랑스 민요 · 나비야 = 독일 민요). 진짜 공연 곡은 저장소에 넣지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMelody, fromLibrary, librarySongs, fromTeacherSong, cleanTeacherSong, teacherSongsIn, songKey, buildEvents, beatChords, TSONG_LIMIT } from '../../../music/js/song.js';
import { LIBRARY } from '../../../music/js/library.js';
import { parsePitch, solfege, totalSteps, fitChords } from '../../../music/js/theory.js';
import { fingering, recorderOK } from '../../../music/js/recorder.js';
import { staffPos } from '../../../music/js/notation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 300)} · 실제 ${sa.slice(0, 300)}`); };
//  막혀야 하는 것 — Error 이고 까닭이 한국어(교사 화면 알림에 그대로 나간다) · want = 까닭에 들어 있어야 할 말
const throws = (fn, want, m) => {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  ok(err instanceof Error, `${m || ''} — 안 막힘`);
  ok(/[가-힣]/.test(err.message), `${m || ''} — 까닭이 한국어가 아님: ${err.message}`);
  if (want) ok(want instanceof RegExp ? want.test(err.message) : err.message.includes(want), `${m || ''} — 까닭 '${err.message}' 에 '${want}' 없음`);
  return err.message;
};

//  붙임줄을 더하기 전 parseMelody(origin/main 그대로 옮김) — 기본 곡 결과가 한 글자도 안 바뀌었는지 견준다
function parseMelodyBefore(str, bs) {
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

//  시험 곡: 작은 별(프랑스 민요)을 바장조로 · 4/4 · 한 박 4칸(16분음표) · 22마디(16마디 넘음) · 시♭ · 붙임줄(마디 넘어 · 셋 줄줄이)
const THEME = 'F4/4 F4/4 C5/4 C5/4 | D5/4 D5/4 C5/8 | Bb4/4 Bb4/4 A4/4 A4/4 | G4/4 G4/4 F4/8 |'
  + 'C5/4 C5/4 Bb4/4 Bb4/4 | A4/4 A4/4 G4/8 | C5/4 C5/4 Bb4/4 Bb4/4 | A4/4 A4/4 G4/8 |'
  + 'F4/4 F4/4 C5/4 C5/4 | D5/4 D5/4 C5/8 | Bb4/4 Bb4/4 A4/4 A4/4 | G4/4 G4/4 F4/8 |';
const VAR = 'F4/3 F4/1 C5/3 C5/1 D5/2 D5/2 C5/4 | Bb4/2 Bb4/2 A4/2 A4/2 G4/1 A4/1 G4/2 F4/4 |'
  + 'C5/3 C5/1 Bb4/3 Bb4/1 A4/2 A4/2 G4/4 | C5/3 C5/1 Bb4/3 Bb4/1 A4/2 A4/2 G4/4~ |'
  + 'G4/4 F4/4 F4/4 C5/4 | D5/4 D5/4 C5/8 | Bb4/4 Bb4/4 A4/4 A4/4 | G4/4 G4/4 F4/8~ | F4/16~ | F4/8 R/8';
const FX = { key: 'test_star_f', title: '  작은 별 (바장조 시험)  ', part: '1부(가락)', origin: '프랑스 민요', memo: '시험용 곡', order: 1,
  beats: 4, sub: 4, tempo: 96.4, key2: 5, scale: 'major', inst: 'recorder', level: 2, melody: THEME + VAR, prog: 'F  Bb F C7', progEvery: 4, extra: '버릴 칸' };
const bad = (patch) => ({ ...FX, ...patch });
//  나비야(독일 민요 · 기본 곡과 같은 가락) 네 번 = 64마디 — 긴 곡
const NABIYA = LIBRARY.find(x => x.key === 'nabiya').melody;
const LONG = { key: 'test_long', title: '나비야 네 번', beats: 2, sub: 2, tempo: 200, melody: [NABIYA, NABIYA, NABIYA, NABIYA].join(' | ') };

await test('기본 곡 15곡 — 붙임줄을 더한 parseMelody 결과가 예전과 한 글자도 같음(notes · bars) · librarySongs 도 같은 음', () => {
  ok(LIBRARY.length === 15, '곡 수 ' + LIBRARY.length);
  for (const x of LIBRARY) {
    ok(!x.melody.includes('~'), x.key + ' 에 ~');
    const bs = x.beats * x.sub;
    eq(parseMelody(x.melody, bs), parseMelodyBefore(x.melody, bs), x.key);
  }
  const libs = librarySongs();
  for (const [i, x] of LIBRARY.entries()) eq(libs[i].notes, parseMelodyBefore(x.melody, x.beats * x.sub).notes, 'librarySongs ' + x.key);
  ok(libs.every(s => s.lib === true && !s.ts && songKey(s) === 'lib_' + s.lk), '기본 곡 곡 키 그대로');
  eq(fromLibrary(LIBRARY[0]).id, 'lib_nabiya');
});

await test('붙임줄 — 한 마디 안 · 마디 넘어 · 셋 줄줄이 = 한 음(길이 합) · 마디 칸 수는 제 마디만 셈', () => {
  eq(parseMelody('C4/1~ C4/1 D4/2', 4), { notes: [{ s: 0, d: 2, p: 60 }, { s: 2, d: 2, p: 62 }], bars: 1 }, '한 마디 안');
  eq(parseMelody('C4/2 D4/2~ | D4/4', 4), { notes: [{ s: 0, d: 2, p: 60 }, { s: 2, d: 6, p: 62 }], bars: 2 }, '마디 넘어');
  eq(parseMelody('A4/1~ A4/3~ | A4/4', 4), { notes: [{ s: 0, d: 8, p: 69 }], bars: 2 }, '셋 줄줄이');
  eq(parseMelody('R/2 Bb4/2~ | Bb4/4~ | Bb4/2 R/2', 4), { notes: [{ s: 2, d: 8, p: 70 }], bars: 3 }, '시♭ 세 마디에 걸쳐');
  eq(parseMelody('C4/4~ |  | C4/4', 4), { notes: [{ s: 0, d: 8, p: 60 }], bars: 2 }, '빈 마디(| |)는 건너뜀');
  throws(() => parseMelody('C4/2~ | C4/6', 4), '마디 1 칸 수 2', '붙인 음도 제 마디 칸만 센다');
});
await test('붙임줄 틀림 — 쉼표에 ~ · 마지막 음에 ~ · ~ 다음이 쉼표 · ~ 다음이 다른 높이', () => {
  throws(() => parseMelody('R/2~ C4/2', 4), '쉼표에는 붙임줄', '쉼표에 ~');
  throws(() => parseMelody('C4/2 D4/2~', 4), '마지막 음에 붙임줄', '마지막 음에 ~');
  throws(() => parseMelody('C4/2 D4/2~ | D4/2 E4/2~', 4), '마지막 음에 붙임줄', '마지막 음(다음 마디 끝)에 ~');
  throws(() => parseMelody('C4/2~ R/2', 4), '다음이 쉼표', '~ 다음이 쉼표');
  throws(() => parseMelody('R/2 C4/2~ | R/4', 4), '다음이 쉼표', '~ 다음 마디가 쉼표');
  throws(() => parseMelody('C4/2~ D4/2', 4), '높이가 달라요', '~ 다음이 다른 높이');
  throws(() => parseMelody('R/2 C4/2~ | D4/4', 4), '높이가 달라요', '~ 다음 마디가 다른 높이');
});
await test('붙임줄 — 이름이 달라도 같은 높이(Bb4 = A#4)는 이어짐', () => {
  eq(parseMelody('Bb4/2~ A#4/2', 4), { notes: [{ s: 0, d: 4, p: 70 }], bars: 1 });
});

await test('선생님 곡 — 22마디(16마디로 안 자름) · id/곡 키 ts_<곡키> · 제목 · 부분 · 바장조 · 시♭ · 16분음표 · 붙임줄 이어짐', () => {
  const s = fromTeacherSong(FX);
  ok(s.bars === 22 && s.bars > 16, '마디 ' + s.bars);
  ok(s.id === 'ts_test_star_f' && s.ts === true && s.tk === 'test_star_f' && s.lib === false, JSON.stringify({ id: s.id, ts: s.ts, tk: s.tk, lib: s.lib }));
  ok(songKey(s) === 'ts_test_star_f', '곡 키 ' + songKey(s));
  ok(s.title === '작은 별 (바장조 시험) · 1부(가락)' && s.name === '작은 별 (바장조 시험)' && s.part === '1부(가락)', s.title);
  ok(s.origin === '프랑스 민요' && s.memo === '시험용 곡' && s.order === 1 && s.level === 2, '표시 칸');
  ok(s.beats === 4 && s.sub === 4 && s.tempo === 96 && s.key === 5 && s.scale === 'major' && s.inst === 'recorder', '박 · 빠르기(반올림) · 조');
  ok(s.notes.length === 84, '음 수 ' + s.notes.length);
  ok(s.notes.some(n => n.p === 70), '시♭(70) 있음');
  ok(s.notes.some(n => n.s === 12 * 16 + 3 && n.d === 1 && n.p === 65), '16분음표(13마디 F4/1)');
  ok(s.notes.some(n => n.s === 15 * 16 + 12 && n.d === 8 && n.p === 67), '16→17마디 붙임줄 G4 = 8칸');
  ok(s.notes.some(n => n.s === 19 * 16 + 8 && n.d === 32 && n.p === 65), '20→21→22마디 셋 줄줄이 F4 = 32칸');
  ok(s.notes.every(n => !('w' in n)), '노랫말 칸 없음');
  eq(s.prog, ['F', 'Bb', 'F', 'C7']); ok(s.progEvery === 4, 'progEvery');
  ok(s.acc.drum === 'basic' && s.acc.chord && s.acc.bass && Array.isArray(s.harm) && Array.isArray(s.chords), '반주');
  ok(totalSteps(s) === 22 * 16, '칸 수');
  const b = buildEvents(s);
  ok(b.events.filter(e => e.track === 'melody').length === 84, '가락 소리 사건 = 음 수');
  ok(Math.abs(b.total - 22 * 16 * (60 / 96 / 4)) < 1e-9, '길이 ' + b.total);
  ok(beatChords(s).length === 22 * 4 && beatChords(s).every(c => c && c.pcs.length >= 3), '박마다 화음(진행)');
});
await test('저장 모양(cleanTeacherSong) — 정한 칸만(모르는 칸 버림) · 앞뒤 빈칸 뺌 · 기본값 채움 · 두 번 해도 같음', () => {
  const c = cleanTeacherSong(FX);
  ok(!('extra' in c) && c.title === '작은 별 (바장조 시험)' && c.tempo === 96 && c.prog === 'F Bb F C7', JSON.stringify(c).slice(0, 200));
  eq(Object.keys(c).sort(), ['beats', 'inst', 'key', 'key2', 'level', 'melody', 'memo', 'order', 'origin', 'part', 'prog', 'progEvery', 'scale', 'sub', 'tempo', 'title'].sort(), '칸');
  eq(cleanTeacherSong(c), c, '다시 해도 같음');
  eq(cleanTeacherSong({ ...c, t: 123 }), c, '저장소의 t(넣은 때)는 버림');
  const m = cleanTeacherSong({ key: 'mini', title: '짧은 곡', beats: 2, sub: 2, tempo: 100, melody: 'C4/2 D4/2' });
  eq(m, { key: 'mini', title: '짧은 곡', origin: '선생님 곡', order: 99, beats: 2, sub: 2, tempo: 100, key2: 0, scale: 'major', inst: 'recorder', level: 2, melody: 'C4/2 D4/2' }, '기본값');
  const sm = fromTeacherSong(m);
  ok(sm.title === '짧은 곡' && sm.part === '' && sm.memo === '' && !sm.prog && sm.acc.drum === 'basic', '부분 · 메모 · 진행 없음');
  ok(fromTeacherSong({ ...m, beats: 3, sub: 3, melody: 'C4/9' }).acc.drum === 'semachi' && fromTeacherSong({ ...m, beats: 4, sub: 3, melody: 'C4/12' }).acc.drum === 'gutgeori', '장단 기본(fromLibrary 와 같음)');
  ok(fromTeacherSong({ ...m, drum: 'none' }).acc.drum === 'none', 'drum 고름');
  ok(cleanTeacherSong({ ...m, key: ' a-B_9 ' }).key === 'a-B_9', '곡키 앞뒤 빈칸');
});
await test('막힘 — 곡키 · 마디 칸 수 · 음 높이 · 가락 길이 · 마디 수 · 화음 이름 · 그 밖의 칸', () => {
  throws(() => fromTeacherSong(bad({ key: 'bad key!' })), '곡키(key)', '곡키 빈칸 · 느낌표');
  throws(() => fromTeacherSong(bad({ key: '' })), '곡키(key)', '곡키 빈');
  throws(() => fromTeacherSong(bad({ key: undefined })), '곡키(key)', '곡키 없음');
  throws(() => fromTeacherSong(bad({ key: 'a'.repeat(41) })), '곡키(key)', '곡키 41자');
  ok(fromTeacherSong(bad({ key: 'a'.repeat(40) })).id === 'ts_' + 'a'.repeat(40), '곡키 40자는 됨');
  throws(() => fromTeacherSong(bad({ key: '한글키' })), '곡키(key)', '곡키 한글');
  throws(() => fromTeacherSong(bad({ melody: 'F4/4 F4/4 C5/4 | D5/4 D5/4 C5/8' })), '마디 1 칸 수 12 ≠ 16', '마디 칸 수');
  throws(() => fromTeacherSong(bad({ melody: THEME + 'F4/4 F4/4 C5/4 C5/2' })), '마디 13 칸 수 14 ≠ 16', '13마디 칸 수');
  throws(() => fromTeacherSong(bad({ melody: 'C2/16' })), '너무 낮거나 높아요', '음 높이(낮음 C2)');
  throws(() => fromTeacherSong(bad({ melody: 'F4/8 C7/8' })), '1마디: C7 음은 너무 낮거나 높아요', '음 높이(높음 C7)');
  ok(fromTeacherSong(bad({ melody: 'C3/8 C6/8' })).notes.length === 2, 'C3 · C6 끝은 됨');
  throws(() => fromTeacherSong(bad({ melody: 'X4/16' })), '음 이름', '음 이름');
  throws(() => fromTeacherSong(bad({ melody: 'C4/16 ' + ' '.repeat(10) + '| ' + 'C4/1 '.repeat(8100) })), '너무 길어요', '가락 4만 자 넘음');
  ok((THEME + VAR).length < TSONG_LIMIT.melody, '시험 곡은 한도 안');
  const bars201 = Array.from({ length: 201 }, () => 'C4/16').join(' | ');
  throws(() => fromTeacherSong(bad({ melody: bars201 })), '200마디까지', '201마디');
  ok(fromTeacherSong(bad({ melody: Array.from({ length: 200 }, () => 'C4/16').join(' | ') })).bars === 200, '200마디는 됨');
  throws(() => fromTeacherSong(bad({ prog: 'F Bb H7 C' })), '모르는 화음 이름 H7', '화음 이름');
  throws(() => fromTeacherSong(bad({ prog: 'F '.repeat(1001) })), '너무 길어요', '화음 2천 자 넘음');
  ok(fromTeacherSong(bad({ prog: 'F - Dm Bdim E7 F# Ab' })).prog.length === 7, '- · m · dim · 7 · # · b 는 됨');
  throws(() => fromTeacherSong(bad({ progEvery: 9 })), 'progEvery', 'progEvery 9');
  throws(() => fromTeacherSong(bad({ beats: 5 })), '박(beats)', 'beats 5');
  throws(() => fromTeacherSong(bad({ sub: 1 })), 'sub', 'sub 1');
  throws(() => fromTeacherSong(bad({ tempo: 30 })), '빠르기(tempo)', 'tempo 30');
  throws(() => fromTeacherSong(bad({ tempo: 250 })), '빠르기(tempo)', 'tempo 250');
  throws(() => fromTeacherSong(bad({ tempo: undefined })), '빠르기(tempo)', 'tempo 없음');
  throws(() => fromTeacherSong(bad({ title: '   ' })), '제목(title)', '제목 빈');
  throws(() => fromTeacherSong(bad({ title: '가'.repeat(31) })), '30자까지', '제목 31자');
  throws(() => fromTeacherSong(bad({ part: '가'.repeat(13) })), '부분(part)', 'part 13자');
  throws(() => fromTeacherSong(bad({ memo: '가'.repeat(61) })), '메모(memo)', 'memo 61자');
  throws(() => fromTeacherSong(bad({ origin: '가'.repeat(31) })), '출처(origin)', 'origin 31자');
  throws(() => fromTeacherSong(bad({ key2: 3 })), '조(key2)', 'key2 3');
  throws(() => fromTeacherSong(bad({ scale: 'blues' })), '음계(scale)', 'scale');
  throws(() => fromTeacherSong(bad({ scale: 'constructor' })), '음계(scale)', 'scale 이 Object 이름');
  throws(() => fromTeacherSong(bad({ inst: 'violin' })), '악기(inst)', 'inst');
  throws(() => fromTeacherSong(bad({ drum: 'x' })), '북(drum)', 'drum');
  throws(() => fromTeacherSong(bad({ level: 5 })), '난이도(level)', 'level 5');
  throws(() => fromTeacherSong(bad({ order: 'x' })), '순서(order)', 'order');
  throws(() => fromTeacherSong(bad({ melody: 'C4/1.5 C4/14.5' })), '정수', '칸 수가 정수 아님');
  throws(() => fromTeacherSong(bad({ melody: 'R/16 | R/16' })), '음이 하나도 없어요', '쉼표만');
  throws(() => fromTeacherSong(bad({ melody: '  ' })), '가락(melody)', '가락 빈');
  throws(() => fromTeacherSong(bad({ melody: 12 })), '가락(melody)', '가락이 글이 아님');
  throws(() => fromTeacherSong(bad({ melody: 'C4/16~' })), '마지막 음에 붙임줄', '가락 붙임줄 틀림도 막힘');
  throws(() => fromTeacherSong(null), '곡 모양', 'null');
  throws(() => fromTeacherSong([FX]), '곡 모양', '배열');
  ok(fromTeacherSong(bad({ beats: '4', sub: '4', tempo: '96', key2: '5', level: '2' })).bars === 22, '숫자 글("4")도 됨');
});
await test('곡 파일 모양 — 곡 하나 · 곡 배열 · { kind, v, songs } · 틀린 모양은 막힘', () => {
  eq(teacherSongsIn(FX), [FX], '곡 하나');
  eq(teacherSongsIn([FX, LONG]), [FX, LONG], '배열');
  eq(teacherSongsIn({ kind: 'rpg-music-song', v: 1, songs: [FX, LONG] }), [FX, LONG], '담는 모양');
  eq(teacherSongsIn({ songs: [LONG] }), [LONG], 'kind 없이 songs');
  eq(teacherSongsIn([]), [], '빈 배열(교사 화면이 \'곡이 없어요\')');
  throws(() => teacherSongsIn({ kind: 'other', songs: [] }), 'kind', '다른 종류');
  throws(() => teacherSongsIn({ kind: 'rpg-music-song', songs: { a: FX } }), 'songs', 'songs 가 목록이 아님');
  throws(() => teacherSongsIn('곡'), '모양', '글');
  throws(() => teacherSongsIn(null), '모양', 'null');
  const all = teacherSongsIn(JSON.parse(JSON.stringify({ kind: 'rpg-music-song', v: 1, songs: [FX, LONG] }))).map(fromTeacherSong);
  ok(all.length === 2 && all[0].bars === 22 && all[1].bars === 64, 'JSON 을 거쳐도 그대로');
});
await test('긴 곡 64마디(나비야 네 번) — 자르지 않음 · 소리 사건 · 화음 · 마디 화음 자리 모두 64마디', () => {
  const s = fromTeacherSong(LONG);
  const one = parseMelody(NABIYA, 4);
  ok(s.bars === 64 && s.notes.length === one.notes.length * 4, `마디 ${s.bars} · 음 ${s.notes.length}`);
  ok(s.notes[s.notes.length - 1].s === 63 * 4 + one.notes[one.notes.length - 1].s - 15 * 4, '마지막 음 자리');
  const b = buildEvents(s, { countIn: 2 });
  const mel = b.events.filter(e => e.track === 'melody');
  ok(mel.length === s.notes.length && mel[mel.length - 1].t < b.total, '가락 사건');
  ok(Math.abs(b.total - b.offset - 64 * 4 * (60 / 200 / 2)) < 1e-9, '길이 ' + b.total);
  ok(fitChords(s, s.chords).length === 64 && beatChords(s).length === 128, '마디 화음 64 · 박 화음 128');
  ok(b.events.filter(e => e.track === 'drum').length > 0 && b.events.filter(e => e.track === 'bass').length >= 64, '반주가 끝까지');
  ok(recorderOK(s, 'baroque') && recorderOK(s, 'german'), '나비야는 두 리코더 다 됨');
});
await test('시♭(70) — 바로크식 운지 = 엄지 · 1 · 3 · 4 · 저먼식은 넣지 않음(66 · 77 처럼) · 이름 = 시♭', () => {
  eq(fingering(70, 'baroque'), [1, 1, 0, 1, 1, 0, 0, 0], '바로크 70');
  ok(fingering(70, 'german') === null, '저먼 70 없음');
  ok(fingering(66, 'german') === null && fingering(77, 'german') === null && fingering(66, 'baroque') && fingering(77, 'baroque'), '66 · 77 그대로');
  eq(fingering(65, 'german'), [1, 1, 1, 1, 1, 0, 0, 0], '저먼 파 그대로');
  ok(solfege(70) === '시♭' && solfege(70, { short: true }) === '시♭' && solfege(82) === '높은 시♭' && solfege(58) === '낮은 시♭', solfege(70));
  ok(solfege(66) === '파#' && solfege(68) === '솔#' && solfege(71) === '시', '다른 이름 그대로');
  const s = fromTeacherSong(FX);
  ok(recorderOK(s, 'baroque') === true && recorderOK(s, 'german') === false, '바장조 시험 곡: 바로크 됨 · 저먼 안 됨(연습 칸에서 꺼짐)');
  ok(staffPos(70) === staffPos(71) && staffPos(70) === staffPos(69) + 1 && staffPos(58) === staffPos(59) && staffPos(66) === staffPos(65) && staffPos(61) === staffPos(60), '오선: 시♭ = 시 자리(♭) · 다른 반음(파# · 도#)은 아래 음 자리(♯) 그대로');
  ok(/const SHARP = new Set\(\[1, 3, 6, 8\]\), FLAT = new Set\(\[10\]\);/.test(read('music/js/notation.js')), '오선: ♯ 넷 · ♭ 하나');
});

//  저장소 — 이 기기(localStorage)와 학급 RTDB 가 같은 모양: listTeacherSongs · saveTeacherSong(정한 칸만 + t) · deleteTeacherSong
const mem = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true,
  value: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } });
const { createStore, ROOT: MUSIC_ROOT } = await import('../../../music/js/store.js');
await test('저장소(이 기기) — 넣기 · 같은 곡키는 바꿔 넣기 · 지우기 · 틀린 곡은 안 들어감 · 다른 기록은 그대로', async () => {
  mem.set('music.local', JSON.stringify({ songs: { s1: { id: 's1', title: '내 곡' } }, practice: {}, rhythm: {} }));   // tsongs 칸이 없던 예전 기록
  const st = createStore({});
  ok(st.me.guest === true, '손님');
  eq(await st.listTeacherSongs(), [], '처음엔 없음');
  ok(await st.saveTeacherSong(FX) === 'test_star_f', '곡키');
  let list = await st.listTeacherSongs();
  ok(list.length === 1 && list[0].key === 'test_star_f' && typeof list[0].t === 'number' && !('extra' in list[0]) && list[0].title === '작은 별 (바장조 시험)', JSON.stringify(list[0]).slice(0, 160));
  ok(fromTeacherSong(list[0]).bars === 22, '저장한 것을 다시 곡으로');
  await st.saveTeacherSong({ ...FX, memo: '바뀐 메모' });
  list = await st.listTeacherSongs();
  ok(list.length === 1 && list[0].memo === '바뀐 메모', '같은 곡키 = 바꿔 넣기');
  let threw = false; try { await st.saveTeacherSong(bad({ key: 'x y' })); } catch (e) { threw = true; }
  ok(threw && (await st.listTeacherSongs()).length === 1, '틀린 곡은 안 들어감');
  await st.deleteTeacherSong('test_star_f');
  eq(await st.listTeacherSongs(), [], '지움');
  ok(JSON.parse(mem.get('music.local')).songs.s1.title === '내 곡', '내 곡은 그대로');
});
await test('저장소(학급 RTDB) — classRPG_music/tsongs/<곡키> 에만 쓴다 · 읽기 · 지우기', async () => {
  const tree = {};
  const seg = p => p.split('/').filter(Boolean);
  const get = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree) ?? null;
  const put = (p, v) => { const ks = seg(p); let o = tree; ks.slice(0, -1).forEach(k => { o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; }); if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v)); };
  const writes = [];
  const ref = p => ({ child: c => ref(p + '/' + c), once: async () => ({ val: () => get(p) }), set: async v => { writes.push(p); put(p, v); }, remove: async () => { writes.push(p); put(p, null); },
    update: async up => { for (const [k, v] of Object.entries(up)) { writes.push(p + '/' + k); put(p + '/' + k, v); } }, push: () => ref(p + '/x'), on() {}, off() {} });
  const fb = { apps: [1], database: () => ({ ref }) };
  const st = createStore({ sid: 's1', name: '하늘', fb });
  ok(st.online === true && MUSIC_ROOT === 'classRPG_music', 'RTDB 저장소');
  await st.saveTeacherSong(FX); await st.saveTeacherSong(LONG);
  eq(writes, ['classRPG_music/tsongs/test_star_f', 'classRPG_music/tsongs/test_long'], '쓴 곳');
  const v = get('classRPG_music/tsongs/test_star_f');
  ok(v && v.melody === (THEME + VAR) && typeof v.t === 'number' && !('extra' in v), JSON.stringify(v).slice(0, 120));
  ok((await st.listTeacherSongs()).map(x => x.key).sort().join() === 'test_long,test_star_f', '읽기');
  await st.deleteTeacherSong('test_long');
  ok(get('classRPG_music/tsongs/test_long') === null && (await st.listTeacherSongs()).length === 1, '지우기');
  ok(writes.every(p => p.startsWith('classRPG_music/tsongs/')), '다른 곳은 안 씀');
});
await test('교사 화면 알림 한 줄 — 넣었어요 · 바꿨어요 · 못 넣은 곡과 까닭', async () => {
  const { importMsg } = await import('../../../music/js/teacher.js');
  ok(importMsg(3, 0, []) === '3곡 넣었어요' && importMsg(0, 1, []) === '1곡 바꿨어요' && importMsg(2, 1, []) === '2곡 넣고 1곡 바꿨어요', '잘 들어감');
  ok(importMsg(2, 0, ['a.json: 가락(melody): 마디 3 칸 수 15 ≠ 16']) === '2곡 넣고 1곡은 못 넣었어요: a.json: 가락(melody): 마디 3 칸 수 15 ≠ 16', importMsg(2, 0, ['a.json: x']));
  ok(importMsg(0, 0, ['b.json: 곡 파일(JSON) 모양이 아니에요']) === '1곡은 못 넣었어요: b.json: 곡 파일(JSON) 모양이 아니에요', '하나도 못 넣음');
  ok(/외 1$/.test(importMsg(1, 1, ['a', 'b'])), '여럿이면 외 N');
});
await test('화면 연결(글로 확인) — 고르기 첫 칸 · 작곡 막기 · 곡 키 · 버스터 · 저장 경로 설명', () => {
  const app = read('music/js/app.js'), html = read('music/index.html');
  ok(app.includes("[...(forPlay && ts.length ? [['ts', '선생님 곡']] : []), ['lib', '기본 곡']"), '선생님 곡 칸이 맨 앞(연습 · 리듬만)');
  ok(app.includes("if (ts.length && !drawn) tab = 'ts';"), '처음 칸 = 선생님 곡');
  ok(app.includes("toast('선생님 곡은 연습 · 리듬 게임으로 해요'); ctx.go('#/');"), '작곡 길 막기');
  ok(/if \(s && !s\.lib && !s\.ts\) acts\.push\(h\('button', \{ class: 'btn small', onclick: \(\) => ctx\.go\('#\/compose\/' \+ ref\) \}, '고치기'\)\)/.test(app), '선생님 곡에 고치기 없음');
  ok(read('music/js/store.js').includes('tsongs/<곡키> = 선생님이 올린 곡(공연 곡) — 가락 글(library 꼴) · 공개 저장소에 넣지 않는 곡(저작권)'), '저장 경로 설명');
  const v = m => (html.match(new RegExp(`"\\./js/${m}\\.js": "\\./js/${m}\\.js\\?v=([^"]+)"`)) || [])[1];
  ok(['app', 'song', 'store', 'teacher', 'recorder', 'theory', 'notation'].every(m => v(m) === '20261006ts1'), '고친 모듈 버스터 ' + ['app', 'song', 'store', 'teacher', 'recorder', 'theory', 'notation'].map(v).join(','));
  ok(html.includes('<script type="module" src="js/app.js?v=20261006ts1">') && html.includes('css/music.css?v=20261006ts1'), 'script · css 버스터');
  ok(v('library') === '2' && read('admin/assign-music.js').includes("'music/js/library.js?v=2'"), 'library.js 는 그대로(관리 화면 짝)');
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 선생님 곡: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
