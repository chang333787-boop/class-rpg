// 음악실 북 치기 시험 [MUSIC-DRUM-1] — 마디 글 · 단계 악보(덩은 5단계부터) · 곡 반주 악보(기본 곡 모두 × 난이도 셋 · 3박 · 한 박 3칸 · 16분) ·
//  끝맺기 · 구음 글 · 소리 사건(곡의 원래 북 빠짐 · 북 소리 도움 칸 시각 · 가락 없는 판의 박 소리) · 판정(쿵 · 딱 · 덩 같이 · 덩 반쪽 · 반대쪽 · 놓침) ·
//  기록 열쇠 · 화면 연결(글: app.js 길 · 첫 화면 문 · import map · 소리 장치 북 이름)
//  node scripts/unit/music/drum.test.mjs   (DOM 없음 · 네트워크 없음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { librarySongs, fromTeacherSong } from '../../../music/js/song.js';
import { totalSteps, barSteps } from '../../../music/js/theory.js';
import * as D from '../../../music/js/drumcore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 300)} · 실제 ${sa.slice(0, 300)}`); };
const LIB = librarySongs();
const lib = k => LIB.find(s => s.id === 'lib_' + k);
const T = o => fromTeacherSong({ key: 'tt', title: '시험 곡', tempo: 90, inst: 'recorder', origin: '시험', ...o });

await test('마디 글 — 칸 수 · 글자 · 띄어쓰기', () => {
  eq(D.parseBar('D.K. DDK.', 8), [{ at: 0, k: 'D' }, { at: 2, k: 'K' }, { at: 4, k: 'D' }, { at: 5, k: 'D' }, { at: 6, k: 'K' }]);
  let bad = 0; try { D.parseBar('D.K', 4); } catch { bad++; } try { D.parseBar('D.X.', 4); } catch { bad++; }
  eq(bad, 2, '칸 수 · 모르는 글자는 오류');
});
await test('같은 칸 둘 → 쿵 + 딱 = 덩 · 칸 순서', () => {
  eq(D.tidy([{ s: 4, k: 'K' }, { s: 0, k: 'D' }, { s: 4, k: 'D' }, { s: 2, k: 'K' }, { s: 2, k: 'K' }]), [{ s: 0, k: 'D' }, { s: 2, k: 'K' }, { s: 4, k: 'B' }]);
});
await test('단계 아홉 — 악보가 곡 안 · 덩은 5단계부터 · 반주 곡이 있음', () => {
  eq(D.STAGES.length, 9);
  const firstB = D.STAGES.findIndex(st => st.key === 'deong');
  D.STAGES.forEach((st, i) => {
    const song = D.stageSong(st), c = D.stageChart(st, song);
    ok(c.length >= 20, st.key + ' 음표가 너무 적음 ' + c.length);
    ok(D.chartOK(song, c), st.key + ' 악보가 곡 밖 · 겹침');
    const hasB = c.some(x => x.k === 'B');
    ok(i < firstB ? !hasB : true, st.key + ' 덩을 배우기 전 단계에 덩');
    ok(st.goal && st.tip && st.title, st.key + ' 글 빠짐');
    if (st.song) ok(song.notes.length > 0, st.key + ' 반주 곡 가락 없음');
  });
  eq(D.usedKinds(D.stageChart(D.STAGES[0])), ['D'], '1단계는 쿵만');
  eq(D.stageByKey('nope'), null);
});
await test('세마치 단계 — 3박 · 한 박 3칸 · 덩·덩 쿵·딱 쿵딱', () => {
  const st = D.stageByKey('semachi'), song = D.stageSong(st), c = D.stageChart(st, song);
  eq([song.beats, song.sub, song.notes.length], [3, 3, 0]);
  eq(D.sayText(song, c, 0), '덩·덩 쿵·딱 쿵딱');
  eq(D.sayText(song, c, song.bars - 1), '덩 · ·', '가락 없으면 마지막 마디 첫 박 덩으로 맺음');
});
await test('곡 반주 — 기본 곡 모두 × 난이도 셋: 곡 안 · 순서 · 겹침 없음 · 덩으로 맺음', () => {
  for (const s of LIB) for (const lv of Object.keys(D.DRUM_LEVELS)) {
    const c = D.songChart(s, lv);
    ok(c.length > 0 && D.chartOK(s, c), `${s.id} ${lv}`);
    eq(c[c.length - 1].k, 'B', `${s.id} ${lv} 끝`);
  }
});
await test('곡 반주 — 작은 별: 박 치기 · 반주 리듬 · 가락 리듬', () => {
  const s = lib('star');
  eq(D.sayText(s, D.songChart(s, 'easy'), 0), '쿵 딱 쿵 딱');
  eq(D.sayText(s, D.songChart(s, 'normal'), 0), '덩 딱 쿵쿵 딱', '네 마디 첫 박 덩 · 반 박');
  eq(D.sayText(s, D.songChart(s, 'normal'), 1), '쿵 딱 쿵쿵 딱');
  eq(D.sayText(s, D.songChart(s, 'hard'), 1), '쿵 딱 쿵 ·', '가락 리듬(라 라 솔—) · 센 박 쿵');
  eq(D.sayText(s, D.songChart(s, 'easy'), s.bars - 1), '쿵 딱 덩 ·', '마지막 음(도)에서 덩 · 그 뒤 쉼');
});
await test('곡 반주 — 3박(생일) · 2박(나비야) · 한 박 4칸(16분) · 굿거리 · 세마치 곡', () => {
  eq(D.sayText(lib('birthday'), D.songChart(lib('birthday'), 'easy'), 1), '쿵 딱 딱');
  eq(D.sayText(lib('nabiya'), D.songChart(lib('nabiya'), 'normal'), 1), '쿵쿵 딱');
  const s16 = T({ beats: 4, sub: 4, melody: 'C4/2 D4/2 E4/4 F4/1 F4/1 G4/2 A4/4 | C5/16' });
  const c16 = D.songChart(s16, 'normal');
  eq(c16.filter(x => x.s < 16).map(x => x.s), [0, 4, 8, 10, 12], '16분 곡도 반 박 = 2칸');
  const h16 = D.songChart(s16, 'hard');
  ok(h16.every((x, i) => !i || x.s - h16[i - 1].s >= 2), '가락 따라: 16분 둘이 붙으면 하나만');
  const gut = T({ beats: 4, sub: 3, drum: 'gutgeori', melody: 'G4/12 | A4/12 | G4/12' });
  eq(D.sayText(gut, D.songChart(gut, 'normal'), 1), '덩·딱 쿵·딱 쿵·딱 쿵·딱', '굿거리(덩 · 기덕 줄임)');
  eq(D.sayText(gut, D.songChart(gut, 'easy'), 1), '쿵 딱 쿵 딱', '쉬움은 박마다');
  eq(D.sayText(gut, D.songChart(gut, 'easy'), 2), '덩 · · ·', '마지막 음(마지막 마디 첫 박)에서 덩');
  const se = T({ beats: 3, sub: 3, drum: 'semachi', melody: 'G4/9 | A4/9 | G4/9' });
  eq(D.accompBars(se, 'normal'), ['B.BD.KDK.'], '세마치 곡은 세마치 장단');
  eq(D.sayText(se, D.songChart(se, 'normal'), 1), '덩·덩 쿵·딱 쿵딱');
});
await test('끝맺기 — 마지막 음이 마지막 두 마디 밖이면 마지막 마디 첫 박', () => {
  const s = T({ beats: 4, sub: 2, melody: 'C4/8 | R/8 | R/8' });
  const c = D.ending(s, [{ s: 0, k: 'D' }, { s: 10, k: 'K' }, { s: 18, k: 'K' }], 'B');
  eq(c, [{ s: 0, k: 'D' }, { s: 10, k: 'K' }, { s: 16, k: 'B' }]);
});
await test('소리 사건 — 원래 북 빠짐 · 북 소리 도움 = 칸 시각 · 가락 = 리코더 · 세기 박', () => {
  const s = lib('airplane'), c = D.songChart(s, 'easy'), b = D.drumEvents(s, c, { speed: 0.8 });
  ok(!b.events.some(e => e.track === 'drum'), '곡의 원래 북(쿵짝)은 뺀다');
  const gd = b.events.filter(e => e.track === 'guide');
  eq(gd.length, c.length);
  gd.forEach((e, i) => ok(Math.abs(e.t - (b.offset + c[i].s * b.stepDur)) < 1e-9 && e.drum === D.HITS[c[i].k].drum, '도움 소리 시각 · 이름 ' + i));
  ok(Math.abs(b.stepDur - 60 / (s.tempo * 0.8) / s.sub) < 1e-12, '빠르기 배');
  ok(b.events.filter(e => e.track === 'melody').every(e => e.inst === 'recorder'), '가락 = 리코더');
  eq(b.events.filter(e => e.track === 'count').length, s.beats, '한 마디 세기');
  for (let i = 1; i < b.events.length; i++) ok(b.events[i - 1].t <= b.events[i].t, '시각 순서');
  const st = D.stageByKey('semachi'), ss = D.stageSong(st), sb = D.drumEvents(ss, D.stageChart(st, ss));
  eq(sb.events.filter(e => e.track === 'metro').length, ss.bars * ss.beats, '가락 없는 판 = 박마다 박 소리');
});
await test('판정 — 쿵 · 딱 맞히기 · 넓이 · 놓침', () => {
  const j = D.createJudge([{ t: 1, k: 'D' }, { t: 2, k: 'K' }, { t: 3, k: 'D' }, { t: 4, k: 'K' }]);
  eq(j.hit('D', 1.03).kind, 'perfect');
  eq(j.hit('K', 2.08).kind, 'great');
  eq(j.hit('D', 2.88).kind, 'good');
  eq(j.hit('K', 3.5).kind, 'free', '음표 없는 곳 = 그냥 소리');
  eq(j.sweep(4.2).map(x => x.kind), ['miss']);
  eq([j.stats.perfect, j.stats.great, j.stats.good, j.stats.miss, j.stats.maxCombo, j.stats.combo], [1, 1, 1, 1, 3, 0]);
  eq(j.score(), Math.round(1e6 * (1 + 0.7 + 0.4) / 4));
});
await test('판정 — 덩: 쿵과 딱을 같이 = 한 번 · 한쪽만 = 반쪽(0.5) · 순서는 상관없음', () => {
  const j = D.createJudge([{ t: 1, k: 'B' }, { t: 2, k: 'B' }, { t: 3, k: 'B' }]);
  eq(j.hit('K', 1.01).kind, 'pending');
  eq(j.hit('D', 1.04).kind, 'perfect', '딱 먼저 · 쿵 나중도 덩');
  eq(j.hit('D', 2.0).kind, 'pending');
  eq(j.sweep(2.05).length, 0, 'PAIR 안에서는 기다림');
  const half = j.sweep(2.2);
  eq([half.length, half[0].kind, half[0].half], [1, 'good', true]);
  eq(j.hit('D', 3.0).kind, 'pending');
  eq(j.hit('K', 3.0 + D.PAIR + 0.01).kind, 'free', 'PAIR 지나 온 딱은 그 덩에 안 붙음(이미 반쪽 판정 대기)');
  j.sweep(3.5);
  eq([j.stats.perfect, j.stats.good, j.stats.half], [1, 2, 2]);
  eq(j.stats.sum, 1 + 0.5 + 0.5);
});
await test('판정 — 반대쪽을 치면 음표는 남고 알림 · 곧 맞는 쪽 = 인정(완벽 → 좋아)', () => {
  const j = D.createJudge([{ t: 1, k: 'D' }, { t: 2, k: 'K' }]);
  const w = j.hit('K', 1.0);
  eq([w.kind, w.want], ['wrong', 'D']);
  eq(j.hit('D', 1.01).kind, 'great', '반대쪽을 한 번 친 음표는 완벽 대신 좋아');
  eq(j.stats.wrong, 1);
  eq(j.hit('K', 2.0).kind, 'perfect');
  eq(j.stats.combo, 2, '반대쪽은 콤보를 끊지 않음');
});
await test('판정 — 촘촘한 반 박(빠른 곡)은 가장 이른 음표부터', () => {
  const j = D.createJudge([{ t: 1, k: 'D' }, { t: 1.2, k: 'D' }]);
  eq(j.hit('D', 1.1).note.t, 1, '둘 다 넓이 안이면 먼저 온 음표');
  eq(j.hit('D', 1.21).kind, 'perfect');
});
await test('등급 · 별 · 기록 열쇠(40자에서 잘려도 난이도끼리 안 섞임)', () => {
  eq(['S', 'A', 'B', 'C', 'D'].map(D.starsOf), [3, 3, 2, 1, 0]);
  eq([96, 90, 80, 61, 10].map(D.gradeOf), ['S', 'A', 'B', 'C', 'D']);
  eq(D.stageRecKey(D.STAGES[0]), 'dst_don');
  const long = 'u_' + 'x'.repeat(30) + '_' + 'y'.repeat(30);
  const ks = ['easy', 'normal', 'hard'].map(lv => D.songRecKey(long, lv).replace(/[^\w-]/g, '_').slice(0, 40));
  eq(new Set(ks).size, 3);
});
await test('구음 띠 칸 — 박 머리 표시 · 칸마다 소리', () => {
  const s = lib('star'), cells = D.sayBar(s, D.songChart(s, 'normal'), 1);
  eq(cells.length, barSteps(s));
  eq(cells.map(c => c.k || '.').join(''), 'D.K.DDK.');
  eq(cells.filter(c => c.beat).length, s.beats);
});
// ── 공연 편곡 [MUSIC-DRUM-ARR-1] ──  진짜 공연 곡 가락은 쓰지 않는다(저작권) — 같은 박 · 칸 · 마디 수의 빈 가락(온음표)으로 본뜸
const { TEACHER_DRUMS } = await import('../../../music/js/drumparts.js');
const shell = (tk, a, bars = a.bars) => fromTeacherSong({ key: tk, title: '본뜬 곡', tempo: 100, beats: a.beats, sub: a.sub, origin: '시험', melody: Array(bars).fill(`C4/${a.beats * a.sub}`).join(' | ') });
await test('공연 편곡 — 마디 글 칸 수 · 글자 · seq 이름 · 마디 수 · 이름표 순서', () => {
  ok(Object.keys(TEACHER_DRUMS).length >= 2, '바나나 차차 · 피노키오');
  for (const [tk, a] of Object.entries(TEACHER_DRUMS)) {
    for (const [k, p] of Object.entries(a.pats)) D.parseBar(p, a.beats * a.sub);   // 틀리면 오류
    const seq = D.arrangedSeq(a);
    eq(seq.length, a.bars, tk + ' seq 마디 수');
    ok(seq.every(k => a.pats[k]), tk + ' seq 에 없는 마디 글');
    ok(a.marks.every((m, i) => m[0] >= 1 && m[0] <= a.bars && (!i || a.marks[i - 1][0] < m[0])), tk + ' 이름표 순서');
    const c = D.arrangedChart(shell(tk, a)), gap = a.sub / 2;
    ok(c.every((x, i) => !i || x.s - c[i - 1].s >= gap), tk + ' 두 소리 사이는 반 박 이상(16분 연타 없음)');
  }
});
await test('공연 편곡 — 박 · 칸 · 마디가 같을 때만 · 다르면 자동 반주로 · 난이도 목록', () => {
  for (const [tk, a] of Object.entries(TEACHER_DRUMS)) {
    const s = shell(tk, a), c = D.arrangedChart(s);
    ok(c && c.length > a.bars && D.chartOK(s, c), tk + ' 악보');
    eq(c[c.length - 1].k, 'B', tk + ' 덩으로 맺음');
    eq(D.levelsFor(s)[0], 'arr', tk + ' 편곡이 맨 앞');
    eq(D.songChart(s, 'arr'), c);
    const bad = shell(tk, a, a.bars - 1);
    eq(D.arrangedChart(bad), null, tk + ' 마디가 다르면 안 씀');
    ok(!D.levelsFor(bad).includes('arr'), tk + ' 그때는 편곡 칸도 없음');
    eq(D.songChart(bad, 'arr'), D.songChart(bad, 'normal'), tk + ' 반주 리듬으로');
  }
  ok(!D.levelsFor(lib('star')).includes('arr'), '기본 곡엔 편곡 없음');
  eq(D.arrangedChart(fromTeacherSong({ key: 'banana_chacha_x', title: 'x', tempo: 100, beats: 4, sub: 4, origin: '시험', melody: 'C4/16' })), null, '곡 키가 다르면 없음');
});
await test('공연 편곡 — 바나나 차차: 들어가기 · 후렴 구음 · 이름표 · 반 박 표시', () => {
  const a = TEACHER_DRUMS.banana_chacha, s = shell('banana_chacha', a), c = D.arrangedChart(s);
  eq(D.sayText(s, c, 0), '· · ·딱 딱딱', '들어가기 = 차 차 차');
  eq(D.sayText(s, c, 1), '덩쿵 · 쿵딱 딱딱', 'A 후렴');
  eq([D.markAt(s, 0), D.markAt(s, 1), D.markAt(s, 18), D.markAt(s, 58), D.markAt(s, 66)], ['들어가기', 'A 후렴', 'C', '마무리', '끝']);
  const p = TEACHER_DRUMS.pinocchio, ps = shell('pinocchio', p), pc = D.arrangedChart(ps);
  eq(D.sayText(ps, pc, 0), '딱딱 딱딱 쿵 쿵', '피노키오 톡톡 = 테두리');
});
await test('맞추기 시험 — 가운데 값 · 손 풀기 · 튄 누름 · 다섯 번 미만', () => {
  const beat = 60 / 90, N = 16, skip = 4;
  const taps = Array.from({ length: N }, (_, i) => i * beat + 0.06 + ((i * 7) % 5 - 2) * 0.004);   // +0.06초 ± 조금
  taps.push(9 * beat + 0.29);   // 튄 누름 하나(0.3초 안 — 그래도 가운데 값은 안 흔들림)
  taps.push(1 * beat + 0.2);    // 손 풀기 자리(안 셈)
  const r = D.calibrateFrom(taps, beat, N, skip);
  ok(r && Math.abs(r.offset - 0.06) < 0.006, '가운데 값 ' + (r && r.offset));
  eq(r.n, N - skip + 1);
  ok(r.spread < 0.02, '고르기');
  eq(D.calibrateFrom(taps.slice(0, 6), beat, N, skip), null, '손 풀기 뒤 다섯 번이 안 되면 잴 수 없음');
  const early = D.calibrateFrom(Array.from({ length: 12 }, (_, i) => (i + 4) * beat - 0.03), beat, N, skip);
  ok(Math.abs(early.offset + 0.03) < 1e-9, '서둘러 누르면 음수');
});
await test('화면 연결(글) — 편곡 · 맞추기 시험', () => {
  const html = read('music/index.html'), app = read('music/js/app.js'), drum = read('music/js/drum.js');
  ok(/"\.\/js\/drumparts\.js": "\.\/js\/drumparts\.js\?v=\w+"/.test(html), 'import map drumparts');
  ok(app.includes("from './drumparts.js'") && app.includes('공연 편곡'), '곡 고르기 편곡 표');
  ok(drum.includes('function calibrate()') && drum.includes('calibrateFrom(') && drum.includes('e.timeStamp'), '맞추기 시험');
  ok(drum.includes('levelsFor(song)') && drum.includes('markAt(song'), '편곡 난이도 · 이름표');
});
await test('화면 연결(글) — 길 · 문 · 곡 고르기 · import map · 북 소리 이름', () => {
  const app = read('music/js/app.js'), html = read('music/index.html'), audio = read('music/js/audio.js'), drum = read('music/js/drum.js');
  ok(/parts\[0\] === 'drum'/.test(app) && app.includes("import('./drum.js')"), 'app.js 길');
  ok(app.includes("ctx.go('#/drum')") && app.includes('d-drum'), '첫 화면 문');
  ok(app.includes("'#/drum/song/' + ref") && app.includes("mode === 'drum'"), '곡 고르기 북 반주');
  for (const f of ['drum.js', 'drumcore.js']) ok(new RegExp(`"\\./js/${f.replace('.', '\\.')}": "\\./js/${f.replace('.', '\\.')}\\?v=\\w+"`).test(html), 'import map ' + f);
  const v = html.match(/"\.\/js\/app\.js": "\.\/js\/app\.js\?v=(\w+)"/)[1];
  ok(html.includes(`<script type="module" src="js/app.js?v=${v}">`), 'app.js script 값 = import map 값');
  for (const k of ['don', 'ka', 'donka']) ok(audio.includes(`case '${k}':`), '소리 장치 ' + k);
  for (const k of Object.values(D.HITS)) ok(audio.includes(`case '${k.drum}':`), 'HITS 소리 이름 ' + k.drum);
  ok(drum.includes("KeyF: 'D'") && drum.includes("KeyK: 'K'"), '키 F J = 쿵 · D K = 딱');
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`음악실 북 치기: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
