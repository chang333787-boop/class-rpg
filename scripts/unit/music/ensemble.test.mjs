// 음악실 합주 연습 시험 [MUSIC-ENSEMBLE-1] — 묶기 규칙(박 · 칸 · 마디 · 빠르기가 어긋나면 안 묶음) · 짝 부분 · 목록 순서 ·
//  함께 연주 사건이 연습하는 곡의 칸 시각과 똑같은지(빠르기 0.6~1.6 · 세기 박 포함) · 켬/끔 · 반주 끔 · 부분 고르기 · 세기 · 화면 연결(글)
//  node scripts/unit/music/ensemble.test.mjs   (DOM 없음 · 네트워크 없음)
//  시험 곡: 작은 별(프랑스 민요 · 저작권 끝남) ①과 직접 지은 짝 가락 ② · 나머지는 직접 지은 짧은 가락. 진짜 공연 곡 가락은 쓰지 않는다
//   (실제 합주 곡과 같은 '모양' — 제목 · 부분 이름 · 박 · 마디 · 빠르기 — 만 본뜬 곡은 가락이 아무 음이다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromTeacherSong, fromLibrary, buildEvents } from '../../../music/js/song.js';
import { LIBRARY } from '../../../music/js/library.js';
import { totalSteps } from '../../../music/js/theory.js';
import { PARTNER, TOGETHER_KEY, ensembleWhy, ensembleGroups, ensembleReport, groupOf, partnersOf, ensembleOrder, pickPartners, partLabel, partnerEvents, withPartners, ghostNotes, tapFired } from '../../../music/js/ensemble.js';
import { practiceEvents } from '../../../music/js/practice.js';
import { rhythmEvents } from '../../../music/js/rhythm.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 300)} · 실제 ${sa.slice(0, 300)}`); };
const near = (a, b, m, tol = 1e-9) => ok(Math.abs(a - b) <= tol, `${m || ''} ${a} ≠ ${b}`);

// ── 시험 곡 ──
const T = (o) => fromTeacherSong({ beats: 4, sub: 2, tempo: 120, inst: 'recorder', origin: '시험', ...o });
const TW1 = T({ key: 'tw_1', title: '작은 별 합주', part: '①', order: 1, melody: 'C4/2 C4/2 G4/2 G4/2 | A4/2 A4/2 G4/4 | F4/2 F4/2 E4/2 E4/2 | D4/2 D4/2 C4/4' });
const TW2 = T({ key: 'tw_2', title: '작은 별 합주', part: '②', order: 3, melody: 'E4/4 B4/4 | C5/2 C5/2 B4/4 | A4/1 A4/1 A4/2 G4/4 | F4/2 G4/2 E4/4' });   // 직접 지은 짝 가락(엇갈린 칸 17 포함)
const PLAIN = T({ key: 'plain', title: '그냥 곡', order: 2, melody: 'C4/8 | D4/8' });
const P = n => T({ key: 'tri_' + n, title: '세 부분 시험', part: n + '부', order: 4 + n, beats: 3, tempo: 90, melody: ['', 'C5/2 D5/2 E5/2 | C5/6', 'E4/2 F4/2 G4/2 | E4/6', 'C4/6 | C4/6'][n] });
const P1 = P(1), P2 = P(2), P3 = P(3);
const SP1 = T({ key: 'sp_1', title: '띄어  쓰기', part: '①', order: 20, melody: 'C4/8' }), SP2 = T({ key: 'sp_2', title: '띄어 쓰기', part: '②', order: 21, melody: 'E4/8' });
//  어긋나는 묶음 — 마디 · 빠르기 · 박 · 한 박 칸 수 · 같은 부분 이름 · 혼자
const BAR_A = T({ key: 'bar_a', title: '마디 다름', part: 'A', order: 30, melody: 'C4/8 | D4/8' }), BAR_B = T({ key: 'bar_b', title: '마디 다름', part: 'B', order: 31, melody: 'E4/8 | F4/8 | G4/8' });
const TEM_A = T({ key: 'tem_a', title: '빠르기 다름', part: 'A', order: 32, tempo: 100, melody: 'C4/8' }), TEM_B = T({ key: 'tem_b', title: '빠르기 다름', part: 'B', order: 33, tempo: 110, melody: 'E4/8' });
const BEA_A = T({ key: 'bea_a', title: '박 다름', part: 'A', order: 34, beats: 4, melody: 'C4/8' }), BEA_B = T({ key: 'bea_b', title: '박 다름', part: 'B', order: 35, beats: 3, melody: 'E4/6' });
const SUB_A = T({ key: 'sub_a', title: '칸 다름', part: 'A', order: 36, beats: 2, sub: 2, melody: 'C4/4' }), SUB_B = T({ key: 'sub_b', title: '칸 다름', part: 'B', order: 37, beats: 2, sub: 4, melody: 'E4/8' });
const DUP_A = T({ key: 'dup_a', title: '같은 부분', part: '1부', order: 38, melody: 'C4/8' }), DUP_B = T({ key: 'dup_b', title: '같은 부분', part: '1부', order: 39, melody: 'E4/8' });
const SOLO = T({ key: 'solo', title: '혼자', part: '1부', order: 40, melody: 'C4/8' });
//  실제 합주 곡 '모양'만 본뜸(가락은 아무 음): 4/4 · 16마디 · 92 · '1부(S1)' / '2부(S2)' · 3/4 · 32마디 · 104 · '①' '②'
const fill = (bars, tok) => Array(bars).fill(tok).join(' | ');
const W1 = T({ key: 'win_1', title: '겨울 밤 시험', part: '1부(S1)', order: 10, tempo: 92, key2: 7, melody: fill(16, 'G4/8') }), W2 = T({ key: 'win_2', title: '겨울 밤 시험', part: '2부(S2)', order: 11, tempo: 92, key2: 7, melody: fill(16, 'B4/8') });
const L1 = T({ key: 'leaf_1', title: '나뭇잎 시험', part: '①', order: 14, beats: 3, tempo: 104, melody: fill(32, 'G4/6') }), L2 = T({ key: 'leaf_2', title: '나뭇잎 시험', part: '②', order: 15, beats: 3, tempo: 104, melody: fill(32, 'D5/6') });
const ALL = [TW1, PLAIN, TW2, P1, P2, P3, SP1, SP2, BAR_A, BAR_B, TEM_A, TEM_B, BEA_A, BEA_B, SUB_A, SUB_B, DUP_A, DUP_B, SOLO, W1, W2, L1, L2];
const LIB0 = fromLibrary(LIBRARY[0]);
const keys = arr => arr.map(s => s.tk);

await test('묶기 — 같은 제목 · 다른 부분 · 박 · 칸 · 마디 · 빠르기가 같을 때만 · 부분 순서(order) · 빈칸 맞춤', () => {
  const gs = ensembleGroups(ALL);
  eq(gs.map(g => [g.name, keys(g.members)]), [['작은 별 합주', ['tw_1', 'tw_2']], ['세 부분 시험', ['tri_1', 'tri_2', 'tri_3']], ['띄어 쓰기', ['sp_1', 'sp_2']], ['겨울 밤 시험', ['win_1', 'win_2']], ['나뭇잎 시험', ['leaf_1', 'leaf_2']]]);
  eq(keys(ensembleGroups([TW2, TW1])[0].members), ['tw_1', 'tw_2'], '목록 순서와 상관없이 order 순');
  eq(ensembleGroups([LIB0, { ...LIB0, part: '1부', name: LIB0.title }]), [], '기본 곡(선생님 곡 아님)은 안 묶음');
  eq(ensembleGroups([]), []); eq(ensembleGroups(null), []);
});
await test('안 묶는 까닭 — 마디 수 · 빠르기 · 박 · 한 박 칸 수 · 같은 부분 이름 · 부분 하나', () => {
  eq(ensembleWhy([BAR_A, BAR_B]), '부분마다 마디 수가 달라요');
  eq(ensembleWhy([TEM_A, TEM_B]), '부분마다 빠르기가 달라요');
  eq(ensembleWhy([BEA_A, BEA_B]), '부분마다 박이 달라요');
  eq(ensembleWhy([SUB_A, SUB_B]), '부분마다 한 박 칸 수가 달라요');
  eq(ensembleWhy([DUP_A, DUP_B]), '같은 부분 이름이 두 번 있어요');
  eq(ensembleWhy([SOLO]), '부분이 하나뿐이에요');
  eq(ensembleWhy([TW1, TW2]), '');
  for (const s of [BAR_A, BAR_B, TEM_A, TEM_B, BEA_A, BEA_B, SUB_A, SUB_B, DUP_A, DUP_B, SOLO, PLAIN]) { eq(partnersOf(s, ALL), [], s.tk + ' 짝 없음'); ok(groupOf(s, ALL) === null, s.tk + ' 묶음 없음'); }
});
await test('교사 알림 — 부분 이름이 있는 같은 제목 묶음마다 묶임 · 못 묶인 까닭', () => {
  const r = Object.fromEntries(ensembleReport(ALL).map(g => [g.name, [g.parts.join('|'), g.why]]));
  eq(r['작은 별 합주'], ['①|②', '']); eq(r['세 부분 시험'], ['1부|2부|3부', '']); eq(r['겨울 밤 시험'], ['1부(S1)|2부(S2)', '']); eq(r['띄어 쓰기'], ['①|②', '']);
  eq(r['마디 다름'], ['A|B', '부분마다 마디 수가 달라요']); eq(r['빠르기 다름'][1], '부분마다 빠르기가 달라요'); eq(r['박 다름'][1], '부분마다 박이 달라요');
  eq(r['칸 다름'][1], '부분마다 한 박 칸 수가 달라요'); eq(r['같은 부분'][1], '같은 부분 이름이 두 번 있어요'); eq(r['혼자'], ['1부', '부분이 하나뿐이에요']);
  ok(!('그냥 곡' in r), '부분 이름 없는 곡은 알림에 없음');
  eq(ensembleReport([]), []);
});
await test('짝 부분 — 나를 뺀 나머지(순서대로) · 목록에 없는 곡 · 기본 곡 · 빈 목록', () => {
  eq(keys(partnersOf(TW1, ALL)), ['tw_2']); eq(keys(partnersOf(TW2, ALL)), ['tw_1']);
  eq(keys(partnersOf(P2, ALL)), ['tri_1', 'tri_3']); eq(keys(partnersOf(W1, ALL)), ['win_2']); eq(keys(partnersOf(L2, ALL)), ['leaf_1']);
  eq(partnersOf({ ...TW1, tk: 'other' }, ALL), [], '같은 제목이지만 목록에 없는 곡');
  eq(partnersOf(LIB0, ALL), []); eq(partnersOf(TW1, []), []); eq(partnersOf(null, ALL), []);
  ok(groupOf(TW1, ALL).members.length === 2 && groupOf(P3, ALL).members.length === 3, '성부 수');
});
await test('고르기 목록 순서 — 합주 부분끼리 붙임(첫 부분 자리) · 다른 곡 순서 그대로', () => {
  //  앱 목록 = order → 제목 순: 작은 별 ①(1) · 그냥 곡(2) · 작은 별 ②(3) · …
  const sorted = [...ALL].sort((a, z) => (a.order - z.order) || a.title.localeCompare(z.title, 'ko'));
  const out = ensembleOrder(sorted);
  eq(keys(out).slice(0, 3), ['tw_1', 'tw_2', 'plain'], '② 가 ① 바로 뒤로');
  eq(out.length, sorted.length, '빠지거나 겹친 곡 없음');
  eq(new Set(out).size, sorted.length);
  const rest = sorted.filter(s => !groupOf(s, sorted));
  eq(keys(out.filter(s => !groupOf(s, sorted))), keys(rest), '합주 아닌 곡 순서 그대로');
  for (const g of ensembleGroups(sorted)) { const i = out.indexOf(g.members[0]); eq(keys(out.slice(i, i + g.members.length)), keys(g.members), g.name + ' 붙어 있음'); }
});
await test('부분 고르기 · 이름 — all/모르는 값 = 모두 · 곡키 = 그 부분 · 이름 잇기', () => {
  const ps = partnersOf(P1, ALL);
  eq(keys(pickPartners(ps, 'all')), ['tri_2', 'tri_3']); eq(keys(pickPartners(ps, 'tri_3')), ['tri_3']); eq(keys(pickPartners(ps, 'nope')), ['tri_2', 'tri_3']);
  eq(pickPartners([], 'all'), []); eq(pickPartners(null, 'x'), []);
  eq(partLabel([TW2]), '②'); eq(partLabel(ps), '2부 · 3부'); eq(partLabel(partnersOf(W1, ALL)), '2부(S2)');
  ok(TOGETHER_KEY === 'music.together', '기억 칸 이름');
});

//  함께 연주 사건이 연습하는 곡과 같은 칸 시각인지 — 분석값(세기 박 + 칸/한 박) · 같은 칸이면 내 가락 사건과 똑같은 수
function checkAlign(built, song, partners, speed, tag) {
  const sd = 60 / (song.tempo * speed) / song.sub, beat = sd * song.sub, off = song.beats * beat;
  near(built.offset, off, tag + ' 세기 박 길이', 1e-12); near(built.stepDur, sd, tag + ' 칸 길이', 1e-12);
  const pe = built.events.filter(e => e.track === 'partner');
  const want = partners.flatMap(q => q.notes.map(n => ({ s: n.s, d: n.d, p: n.p, part: q.part })));
  eq(pe.length, want.length, tag + ' 짝 음 수');
  const mel = new Map(built.events.filter(e => e.track === 'melody').map(e => [song.notes[e.i].s, e.t]));
  let same = 0;
  for (const w of want) {
    const e = pe.find(x => x.p === w.p && x.part === w.part && Math.abs(x.t - (built.offset + w.s * built.stepDur)) < 1e-12);
    ok(e, `${tag} 칸 ${w.s} 음 ${w.p} 없음`);
    ok(e.t === built.offset + w.s * built.stepDur, `${tag} 칸 ${w.s}: ${e.t}`);   // 연습 곡의 offset · stepDur 그대로(같은 수)
    near(e.t, (song.beats + w.s / song.sub) * 60 / (song.tempo * speed), `${tag} 칸 ${w.s} 분석값`);
    near(e.d, w.d * sd, `${tag} 칸 ${w.s} 길이`);
    ok(e.t >= built.offset - 1e-12, tag + ' 세기 박 뒤에서 시작');
    if (mel.has(w.s)) { ok(mel.get(w.s) === e.t, `${tag} 칸 ${w.s}: 내 가락 ${mel.get(w.s)} ≠ 짝 ${e.t}`); same++; }
  }
  for (let i = 1; i < built.events.length; i++) ok(built.events[i - 1].t <= built.events[i].t, tag + ' 사건이 시각 순서');
  ok(built.events.filter(e => e.track === 'count').every(e => e.t < built.offset), tag + ' 세기 박이 먼저');
  return same;
}
await test('리코더 연습 — 짝 사건 시각 = 연습 곡 칸 시각(빠르기 0.6 · 0.8 · 1 · 1.2 · 1.4 · 1.6 · 세기 박 포함) · 같은 칸은 내 가락과 똑같은 수', () => {
  for (const speed of [0.6, 0.8, 1, 1.2, 1.4, 1.6]) {
    const b = practiceEvents(TW1, { speed, acc: true, partners: [TW2], together: true });
    const same = checkAlign(b, TW1, [TW2], speed, '연습 ×' + speed);
    ok(same === 11, `같은 칸 11 (실제 ${same})`);   // 0 4 8 10 12 16 18 20 24 26 28 · 짝만 = 칸 17
    eq(b.total, b.offset + totalSteps(TW1) * b.stepDur, '끝 시각 그대로');
  }
  //  세 부분 · 3/4 · 90 — 짝 둘
  for (const speed of [0.6, 1, 1.6]) checkAlign(practiceEvents(P1, { speed, partners: partnersOf(P1, ALL), together: true }), P1, partnersOf(P1, ALL), speed, '세 부분 ×' + speed);
  //  실제 곡 모양(16마디 · 92 · 32마디 3/4 · 104)
  checkAlign(practiceEvents(W1, { speed: 0.6, partners: [W2], together: true }), W1, [W2], 0.6, '겨울 밤 모양');
  checkAlign(practiceEvents(L2, { speed: 1.6, partners: [L1], together: true }), L2, [L1], 1.6, '나뭇잎 모양');
});
await test('리듬 게임 — 짝 사건 시각 = 칸 시각(빠르기 × 난이도: 0.6 ~ 2.0) · 악보는 내 곡 음만', () => {
  for (const tempo of [0.6, 0.8, 1, 1.1, 1.25, 1.6, 2.0]) {
    const b = rhythmEvents(TW1, { tempo, guide: true, partners: [TW2], together: true });
    checkAlign(b, TW1, [TW2], tempo, '리듬 ×' + tempo);
  }
  const rh = read('music/js/rhythm.js');
  ok(rh.includes('chart = notes.map(') && rh.includes('const notes = [...song.notes]'), '리듬 악보는 song.notes 로만 짠다(짝 부분은 소리만 · 점수와 상관없음)');
});
await test('켬 · 끔 — 끄면 짝 사건 0 · 켜도 내 사건(가락 · 반주 · 세기 박)은 한 치도 안 바뀜 · 반주를 꺼도 함께 연주는 됨', () => {
  for (const speed of [0.6, 1, 1.6]) {
    const on = practiceEvents(TW1, { speed, partners: [TW2], together: true }), off = practiceEvents(TW1, { speed, partners: [TW2], together: false });
    eq(off.events.filter(e => e.track === 'partner').length, 0, '끔 ×' + speed);
    ok(on.events.filter(e => e.track === 'partner').length === TW2.notes.length, '켬');
    eq(on.events.filter(e => e.track !== 'partner'), off.events, '내 사건 그대로 ×' + speed);
    eq([on.offset, on.stepDur, on.total], [off.offset, off.stepDur, off.total]);
    eq(practiceEvents(TW1, { speed, partners: [], together: true }).events, off.events, '짝 없으면 켜도 0');
    const ron = rhythmEvents(TW1, { tempo: speed, partners: [TW2], together: true }), roff = rhythmEvents(TW1, { tempo: speed, partners: [TW2], together: false });
    eq(roff.events.filter(e => e.track === 'partner').length, 0, '리듬 끔');
    eq(ron.events.filter(e => e.track !== 'partner'), roff.events, '리듬 내 사건 그대로');
  }
  //  반주 끔 + 함께 연주 켬 → 화음 · 베이스 · 북 없음 · 짝은 있음
  const noAcc = practiceEvents(TW1, { speed: 1, acc: false, partners: [TW2], together: true });
  const tracks = new Set(noAcc.events.map(e => e.track));
  ok(!tracks.has('chord') && !tracks.has('bass') && !tracks.has('drum') && tracks.has('partner') && tracks.has('melody') && tracks.has('count'), [...tracks].join(','));
  //  예전 연습 사건과 같은지(함께 연주 끔 = 바뀌기 전 start() 그대로)
  const old = buildEvents(TW1, { scale: 0.8, countIn: TW1.beats, melody: true, chord: TW1.acc.chord, bass: TW1.acc.bass, drum: TW1.acc.drum, orch: true, lead: false });
  eq(practiceEvents(TW1, { speed: 0.8, acc: true }).events, old.events.map(e => e.track === 'melody' ? { ...e, inst: 'recorder', vel: 0.75 } : { ...e, vel: (e.vel || 0.8) * 0.7 }), '연습 사건 = 예전 그대로');
  const oldR = buildEvents(TW1, { scale: 1, countIn: TW1.beats, melody: false, harm: false, lead: false });
  eq(rhythmEvents(TW1, { tempo: 1, guide: false }).events, oldR.events.map(e => e.track === 'melody' ? { ...e, vel: 0.35 } : e), '리듬 사건 = 예전 그대로');
});
await test('소리 — 짝 = 클라리넷(내 리코더와 다른 소리) · 내 가락보다 작게 · 부분이 여럿이면 √n 로 나눔 · 합주 듣기 = 제 악기', () => {
  const b = practiceEvents(TW1, { speed: 1, partners: [TW2], together: true });
  const pe = b.events.filter(e => e.track === 'partner'), me = b.events.filter(e => e.track === 'melody');
  ok(pe.every(e => e.inst === 'clarinet' && e.vel === PARTNER.vel && e.kind === 'note' && e.part === '②'), JSON.stringify(pe[0]));
  ok(me.every(e => e.inst === 'recorder' && e.vel === 0.75) && PARTNER.vel < 0.75, '연습: 짝 < 내 가락(0.75)');
  ok(PARTNER.vel < 0.9, '리듬: 짝 < 내가 치는 소리(0.9)');
  const three = practiceEvents(P1, { speed: 1, partners: partnersOf(P1, ALL), together: true }).events.filter(e => e.track === 'partner');
  ok(three.every(e => e.vel === Math.round(PARTNER.vel / Math.SQRT2 * 1000) / 1000) && new Set(three.map(e => e.part)).size === 2, '둘이면 0.7/√2');
  const lead = buildEvents(TW1), lis = partnerEvents(TW1, [TW2], lead, { ownInst: true });
  ok(lis.every(e => e.inst === 'recorder'), '합주 듣기 = 부분마다 제 악기');
});
await test('곡 끝을 넘는 짝 음은 자름 · 빈 짝 · withPartners 정렬 · 아래 얇은 줄 음표', () => {
  const odd = { ...TW2, notes: [{ s: 0, d: 4, p: 64 }, { s: 30, d: 8, p: 67 }, { s: 32, d: 2, p: 69 }, { s: -1, d: 2, p: 60 }] };
  const ev = partnerEvents(TW1, [odd], buildEvents(TW1));
  eq(ev.map(e => [e.p, +(e.d / buildEvents(TW1).stepDur).toFixed(6)]), [[64, 4], [67, 2]], '끝 넘는 음 · 음수 칸');
  eq(partnerEvents(TW1, [], buildEvents(TW1)), []); eq(partnerEvents(TW1, [TW2], null), []);
  const base = buildEvents(TW1); ok(withPartners(base, []) === base, '짝 없으면 그대로');
  eq(ghostNotes([P2, P3]).map(n => n.s), [0, 0, 2, 4, 6, 6], '얇은 줄 = 짝 음표(칸 순)');
});
await test('시험용 손잡이 tapFired — 끈 줄은 안 적고 · 원래 _fire 는 그대로 부름', () => {
  const calls = [], player = { mute: { melody: true }, t0: 10, _fire(ev) { calls.push(ev.track); } }, log = [];
  tapFired(player, log, () => 9.9);
  player._fire({ track: 'partner', t: 1, p: 64, d: 0.5, inst: 'clarinet', vel: 0.7, part: '②' });
  player._fire({ track: 'melody', t: 1, p: 60 });
  eq(calls, ['partner', 'melody'], '원래 _fire');
  eq(log, [{ track: 'partner', t: 1, at: 11, now: 9.9, p: 64, d: 0.5, inst: 'clarinet', vel: 0.7, part: '②' }]);
});
await test('화면 연결(글로 확인) — 연습 · 리듬이 같은 사건 함수 · 기억 칸 · 목록 묶음 · 합주 듣기 · import map 버스터', () => {
  const prac = read('music/js/practice.js'), rh = read('music/js/rhythm.js'), app = read('music/js/app.js'), html = read('music/index.html'), css = read('music/css/music.css');
  ok(prac.includes('built = practiceEvents(song, { speed, acc, partners: activePartners(), together });') && prac.includes('lsGet(TOGETHER_KEY, true) !== false') && prac.includes('lsSet(TOGETHER_KEY, v)'), '연습');
  ok(prac.includes("tog('🎶 함께 연주'") && prac.includes("'함께: ' + partLabel(activePartners())") && prac.includes('ctx.teacherSongs().then(list =>'), '연습 윗줄 · 짝 찾기');
  ok(rh.includes('built = rhythmEvents(song, { tempo: effTempo(), guide, partners: activePartners(), together });') && rh.includes('lsGet(TOGETHER_KEY, true) !== false') && rh.includes('lsSet(TOGETHER_KEY, together)'), '리듬');
  ok(app.includes('ensembleOrder(ts).map(') && app.includes('ensBoxes(rowEls,') && app.includes('`합주 · ${grp.members.length}성부`') && app.includes('listenEnsemble(g, play)'), '목록');
  ok(css.includes('.ens-grp{') && css.includes('.ens-badge{') && css.includes('.top .ens-chip{') && css.includes('.ts-ens{'), 'css');
  ok(read('music/js/teacher.js').includes('ensembleReport(rows.map(r => r.s).filter(Boolean))') && read('music/js/teacher.js').includes('⚠ 합주로 못 묶음:'), '교사 화면 알림');
  const v = m => (html.match(new RegExp(`"\\./js/${m}\\.js": "\\./js/${m}\\.js\\?v=([^"]+)"`)) || [])[1];
  const after = x => Number(String(x || '').slice(0, 8)) >= 20261011;
  for (const m of ['ensemble', 'app', 'practice', 'rhythm', 'teacher']) ok(after(v(m)), m + ' 버스터 ' + v(m));
  const tagV = (html.match(/<script type="module" src="js\/app\.js\?v=([^"]+)">/) || [])[1], cssV = (html.match(/css\/music\.css\?v=([^"]+)"/) || [])[1];
  ok(tagV === v('app') && after(cssV), 'script · css 버스터 ' + tagV + ' · ' + cssV);
  ok(!/브랜치/.test(prac + rh + app + read('music/js/ensemble.js')), '쓰지 않기로 한 낱말 없음');
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 합주: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
