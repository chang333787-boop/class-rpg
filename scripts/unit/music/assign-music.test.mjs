// 음악실 리듬 과제 시험 [ASSIGN-MUSIC-1] — 판 설정 · 결과 모양 · 과제 칸 쓰기(AssignCore.appPatch) · 관리 고르기 칸 · 결과 표 · 덮개 안 앱 주소 · 버스터 짝
//  node scripts/unit/music/assign-music.test.mjs   (DOM 없음 · 네트워크 없음)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import '../../../common/assign-core.js';
import { rhythmSettings, rhythmPatch, myLine, LEVEL_KEYS } from '../../../music/js/assign-music.js';
import { LEVELS } from '../../../music/js/rhythm.js';
import { LIBRARY } from '../../../music/js/library.js';
import { fromTeacherSong } from '../../../music/js/song.js';   // [ASSIGN-TSONG-1] 관리 칸 = 아이 쪽 같은 id · 제목 · 마디

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const AC = globalThis.AssignCore;
const results = [];
//  시험은 적은 차례대로 하나씩(기다리는 시험도 있음 — 같은 관리 화면 vm 을 함께 쓰므로 겹치지 않게) [ASSIGN-TSONG-1]
const queue = [];
const test = (name, fn) => queue.push([name, fn]);
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb} · 실제 ${sa}`); };

const RAW = { id: 'aMus1', kind: 'music', title: '리듬 · 나비야', content: { music: { song: 'lib_nabiya', level: 'normal', tempo: 0.8, keys: 6 } }, roster: { s1: '하늘', s2: '바다', s3: '구름' }, createdAt: 1 };
const DEF = AC.normDef(RAW, 'aMus1');
const res = (acc, p = {}) => ({ score: Math.round(acc * 10000), acc, grade: acc >= 95 ? 'S' : acc >= 88 ? 'A' : acc >= 75 ? 'B' : acc >= 60 ? 'C' : 'D', maxCombo: 12, perfect: 20, great: 5, good: 3, miss: 4, ...p });
//  결과 칸에 patch 를 적용(서버 시각 = 숫자 · increment = 더하기) — 부모 학생 화면이 하는 일과 같은 셈
function apply(cell, up) {
  const c = JSON.parse(JSON.stringify(cell || {}));
  for (const [k, v] of Object.entries(up || {})) {
    const segs = k.split('/').slice(3);   // results/<과제>/<아이>/…
    let o = c; for (let i = 0; i < segs.length - 1; i++) o = o[segs[i]] = o[segs[i]] || {};
    const last = segs[segs.length - 1];
    o[last] = v && v.inc ? (o[last] || 0) + v.inc : v;
  }
  return c;
}
let clock = 1000;
const OPT = { TS: 0, INC: n => ({ inc: n }) };
const write = (cell, patch) => { const up = AC.appPatch(DEF, 's1', cell, patch, { ...OPT, TS: (clock += 1000) }); return { up, cell: apply(cell, up) }; };

test('rhythmSettings — 선생님이 정한 곡 · 난이도 · 키 수 · 빠르기 / 음악 과제가 아니면 null', () => {
  eq(rhythmSettings(DEF), { song: 'lib_nabiya', level: 'normal', keys: 6, tempo: 0.8 });
  const odd = AC.normDef({ ...RAW, id: 'aMus2', content: { music: { song: 'lib_star', level: 'zzz', tempo: 3, keys: 5 } } }, 'aMus2');
  eq(rhythmSettings(odd), { song: 'lib_star', level: 'easy', keys: 0, tempo: 1 }, '이상한 값은 기본');
  ok(rhythmSettings(AC.normDef({ id: 'aC', kind: 'coding', content: { coding: { stages: ['1-1'] } } }, 'aC')) === null, '코딩');
  ok(rhythmSettings(null) === null && rhythmSettings({ kind: 'music', content: {} }) === null, '빈 것');
});
test('rhythmPatch — 판 수 1 · 점수 = 정확도 반올림 / 100 · best(rank = 점수) · first(rank 0) · 친 음표가 있으면 done', () => {
  const p = rhythmPatch(res(87.46));
  ok(p.attempt === true && p.score === 88 && p.total === 100 && p.done === true, JSON.stringify(p));
  eq(p.detail.best, { rank: 874600, score: 874600, acc: 87.5, grade: 'B', maxCombo: 12, perfect: 20, great: 5, good: 3, miss: 4 });
  ok(p.detail.first && p.detail.first.rank === 0, 'first');
  ok(JSON.stringify(p.detail.best).length < 1000 && JSON.stringify(p.detail.first).length < 1000, '1KB 안');
});
test('rhythmPatch — 아무것도 안 치고 끝까지 둔 판 = 판 수만(끝 · 처음 판 아님) · 믿지 않는 값 정리', () => {
  const p = rhythmPatch(res(0, { perfect: 0, great: 0, good: 0, miss: 30, grade: 'D', score: 0 }));
  ok(p.attempt && !p.done && !p.detail.first && p.score === 0, JSON.stringify(p));
  const q = rhythmPatch({ score: 9e9, acc: 400, grade: '<b>', perfect: -3, great: 'x', good: 1.7, miss: null });
  ok(q.detail.best.score === 1000000 && q.detail.best.acc === 100 && q.detail.best.grade === 'D' && q.detail.best.perfect === 0 && q.detail.best.good === 1, JSON.stringify(q));
  ok(rhythmPatch(null) === null && rhythmPatch('x') === null, 'null');
});
test('과제 칸 — 70 → 60 → 90: 점수 · best 는 늘 때만 · first 는 처음 그대로 · 판 수 3 · doneAt 한 번', () => {
  let r = write(null, { start: true });
  ok(r.cell.startedAt && !r.cell.doneAt, '시작');
  r = write(r.cell, rhythmPatch(res(70))); const done1 = r.cell.doneAt;
  ok(r.cell.app.score === 70 && r.cell.app.detail.best.acc === 70 && r.cell.app.detail.first.acc === 70 && done1, '첫 판 ' + JSON.stringify(r.cell));
  r = write(r.cell, rhythmPatch(res(60)));
  ok(!(`results/aMus1/s1/app/score` in r.up) && !('results/aMus1/s1/app/detail/best' in r.up) && !('results/aMus1/s1/app/detail/first' in r.up), '나쁜 판은 안 덮음 ' + JSON.stringify(r.up));
  ok(r.cell.app.score === 70 && r.cell.app.detail.best.acc === 70, '그대로');
  r = write(r.cell, rhythmPatch(res(90)));
  ok(r.cell.app.score === 90 && r.cell.app.detail.best.acc === 90 && r.cell.app.detail.first.acc === 70 && r.cell.app.attempts === 3 && r.cell.doneAt === done1, JSON.stringify(r.cell));
  const s = AC.summarize(DEF, r.cell);
  ok(s.status === 'done' && s.correct === 90 && s.total === 100 && s.attempts === 3 && s.ms === done1 - r.cell.startedAt, JSON.stringify(s));
});
test('과제 칸 — 0 점 판만 친 아이 = 하는 중(끝 아님) · 남의 칸 · 문제 묶음 칸은 안 씀', () => {
  const r = write(null, rhythmPatch(res(0, { perfect: 0, great: 0, good: 0, miss: 30, score: 0 })));
  ok(AC.summarize(DEF, r.cell).status === 'doing', JSON.stringify(r.cell));
  ok(Object.keys(r.up).every(k => k.startsWith('results/aMus1/s1/')), '내 칸만 ' + Object.keys(r.up));
  ok(!Object.keys(r.up).some(k => k.includes('/answers/') || k.startsWith('mine/')), '문제 묶음 · 숙달도 칸 0');
});
test('myLine — 내 가장 좋은 기록 한 줄 · 칸이 없으면 빈 글', () => {
  ok(myLine(null) === '' && myLine({}) === '', '빈');
  ok(myLine({ app: { attempts: 2, detail: { best: { acc: 91.5, grade: 'A' } } } }) === '내 가장 좋은 기록 · 정확도 91.5% (A) · 2번 쳤어요');
});
test('음악실 기본 곡 15곡 — 모두 과제 곡 id 로 받아짐(normDef) · 같은 내용 견주기(contentSig)', () => {
  ok(LIBRARY.length === 15, '곡 수 ' + LIBRARY.length);
  for (const x of LIBRARY) {
    const d = AC.normDef({ ...RAW, id: 'aX', content: { music: { song: 'lib_' + x.key, level: 'easy' } } }, 'aX');
    ok(d && d.content.music.song === 'lib_' + x.key, x.key);
  }
  ok(AC.contentSig(DEF) === 'music:lib_nabiya:normal:0.8:6', AC.contentSig(DEF));
  //  키 수만 다른 과제 = 다른 내용(잘못된 '같은 내용' 확인 창 없음) [검토 반영]
  const k8 = AC.normDef({ ...RAW, id: 'aK8', content: { music: { ...RAW.content.music, keys: 8 } } }, 'aK8');
  ok(AC.contentSig(k8) !== AC.contentSig(DEF), AC.contentSig(k8));
});
test('난이도 표 — rhythm.js LEVELS = 과제 정의 난이도(assign-core) = 관리 고르기 표(이름 · 기본 키 · 빠르기)', () => {
  eq(Object.keys(LEVELS), LEVEL_KEYS, 'rhythm 키');
  const src = read('admin/assign-music.js');
  const tbl = JSON.parse(src.match(/const ASSIGN_MUSIC_LEVELS = (\[.*?\]);/)[1].replace(/'/g, '"'));
  eq(tbl.map(l => l[0]), LEVEL_KEYS, '관리 키');
  for (const [k, name, lanes, tempo] of tbl) ok(LEVELS[k].name === name && LEVELS[k].lanes === lanes && LEVELS[k].tempo === tempo, k);
  ok(/\['easy', 'normal', 'hard', 'expert'\]\.includes\(m\.level\)/.test(read('common/assign-core.js')), 'normDef 난이도 목록');
});
test('버스터 짝 — 관리 화면이 읽는 library.js ?v= = music/index.html import map 값 · common/assign*.js 값 = student.html assign-core 값', () => {
  const html = read('music/index.html');
  const lib = html.match(/"\.\/js\/library\.js": "\.\/js\/library\.js\?v=([^"]+)"/)[1];
  ok(read('admin/assign-music.js').includes(`'music/js/library.js?v=${lib}'`), 'library ?v=' + lib);
  const core = read('student.html').match(/common\/assign-core\.js\?v=([^"]+)"/)[1];
  ok(html.includes(`"../common/assign-core.js": "../common/assign-core.js?v=${core}"`), 'assign-core ' + core);
  ok(/"\.\.\/common\/assign\.js": "\.\.\/common\/assign\.js\?v=[^"]+"/.test(html), 'assign.js 키');
  ok(/"\.\/js\/assign-music\.js": "\.\/js\/assign-music\.js\?v=/.test(html), 'assign-music 키');
  const app = html.match(/"\.\/js\/app\.js": "\.\/js\/app\.js\?v=([^"]+)"/)[1];
  ok(html.includes(`<script type="module" src="js/app.js?v=${app}">`), 'app.js 두 곳 같은 값');
});
test('app.js — 과제면 그 곡 리듬만(다른 길 되돌림) · 결과는 reportAssign · 덮개 신호에 멈춤 · 닫힌 과제는 안 보냄', () => {
  const s = read('music/js/app.js');
  ok(/if \(A\) \{ await routeAssign\(my\); return; \}/.test(s), '모든 길이 과제 길로');
  ok(/history\.replaceState\(null, '', want\)/.test(s), '주소 되돌림');
  ok(/reportAssign\(store\.db, A\.aid, A\.sid, patch\)/.test(s) && /if \(!asg \|\| asg\.closed\) return 'closed'/.test(s), '보내기');
  ok(/onClassPause\(on =>/.test(s) && /if \(A && A\.live\) return;/.test(s), '덮개 멈춤(수업 안의 리듬은 제외)');
  const r = read('music/js/rhythm.js');
  ok(/const top = A \? ctx\.topBar/.test(r) && /A \? null : h\('button', \{ class: 'btn', onclick: \(\) => ctx\.go\('#\/pick\/rhythm'\) \}, '다른 곡'\)/.test(r), '과제: 고르기 칸 · 다른 곡 단추 없음');
  ok(/if \(A\) \{ sendAssign\(res, tops\); return; \}/.test(r), '과제: 우리 반 최고 판 대신 보내기');
  ok(/if \(tempo === 1 && hit\) ctx\.store\.saveRhythm/.test(r), '조금 느리게 판은 내 최고 기록에 안 섞음');
});

// ── 관리 화면(클래식 스크립트를 vm 에서) ──
const admin = (() => {
  const ctx = { console, document: { baseURI: 'https://funclassrpg.kr/admin.html', getElementById: () => null }, URL, AssignCore: AC, _AS: { draft: null }, _mask: false };
  vm.createContext(ctx);
  vm.runInContext(read('admin.js').match(/function escHtml[\s\S]*?\n}\n/)[0] + read('admin.js').match(/function escJsAttr[\s\S]*?\n}\n/)[0], ctx);
  vm.runInContext(read('admin/assign.js').replace('const _AS = {', 'var _AS_unused = {'), ctx);   // 공용 틀(_assignAppResultHTML · ASSIGN_APPS) — _AS 는 시험이 쥔다 [ASSIGN-APPS-1]
  vm.runInContext(`function _assignMasked() { return _mask; }
    function _assignNameHTML(n, i) { return _assignMasked() ? '학생 ' + (i + 1) : escHtml(n); }
    function _assignStatus(r) { return r.status; } function _assignMs(ms) { return Math.round(ms / 1000) + '초'; }`, ctx);
  vm.runInContext(read('admin/assign-music.js'), ctx);
  vm.runInContext(`_assignMusicLib = ${JSON.stringify(LIBRARY.map(x => ({ id: 'lib_' + x.key, title: x.title, origin: x.origin, level: x.level, practice: !!x.practice, beats: x.beats, tempo: x.tempo })))};`, ctx);
  return ctx;
})();
test('관리 고르기 칸 — 곡 15 · 고른 곡 ● · 난이도 넷 · 키 수 넷 · 빠르기 둘 · 이름은 곡 제목', () => {
  const d = { kind: 'music', music: { song: 'lib_star', level: 'hard', tempo: 0.8, keys: 0 } };
  admin._AS.draft = d;
  const html = admin.assignMusicPickerHTML(d);
  ok((html.match(/class="asg-mu-song[ "]/g) || []).length === 15, '곡 줄');
  ok((html.match(/asg-mu-song on/g) || []).length === 1 && /asg-mu-song on[^>]*lib_star/.test(html), '고른 곡');
  ok((html.match(/assignMusicDraft\('level'/g) || []).length === 4 && (html.match(/assignMusicDraft\('keys'/g) || []).length === 4 && (html.match(/assignMusicDraft\('tempo'/g) || []).length === 2, '칸');
  ok(html.includes('난이도 기본(8키)') && html.includes('빠르기 ×1.1'), '어려움 설명');
  admin.assignMusicDraft('keys', '6'); admin.assignMusicDraft('tempo', '1'); admin.assignMusicDraft('level', 'nope'); admin.assignMusicDraft('song', "x'><b>");
  eq(d.music, { song: '', level: 'easy', tempo: 1, keys: 6 }, '믿지 않는 값');
  d.music.song = 'lib_star'; d.music.tempo = 0.8;
  ok(admin.assignMusicAutoTitle(d) === '리듬 · 작은 별 · 쉬움 · 느리게', admin.assignMusicAutoTitle(d));
});
test('관리 결과 표 — 명단 기준(안 한 아이도) · 정확도 · 등급 · 판정 넷 · 처음 판 · 친 횟수 · 반 평균 · 이름 가리기 중엔 숫자 숨김', () => {
  let c1 = write(null, rhythmPatch(res(70))).cell; c1 = write(c1, rhythmPatch(res(96))).cell;
  const c2 = write(null, rhythmPatch(res(0, { perfect: 0, great: 0, good: 0, miss: 30, score: 0 }))).cell;
  const roster = [{ sid: 's1', name: '하늘' }, { sid: 's2', name: '바다' }, { sid: 's3', name: '<구름>' }];
  const t = AC.tally(DEF, { s1: c1, s2: c2 }, roster);
  const sum = admin.assignMusicSummary(t);
  ok(sum.n === 1 && sum.avg === 96 && sum.grades.S === 1, JSON.stringify(sum));
  admin._mask = false;
  const html = admin._assignAppResultHTML(DEF, t, false);
  ok((html.match(/<tr class="[^"]*"><td class="td-name">/g) || []).length === 3, "줄 셋");
  ok(html.includes('<b>96%</b>') && html.includes('70% (C)') && html.includes('&lt;구름&gt;') && !html.includes('<구름>'), '칸 · escape');
  ok(/<td>none<\/td>/.test(html) && /<td>doing<\/td>/.test(html) && /<td>done<\/td>/.test(html), '상태 셋');
  ok(admin.assignMusicLiveHTML(DEF, t).includes('정확도 평균 <b>96%</b>'), '수업 띠');
  admin._mask = true;
  const m = admin._assignAppResultHTML(DEF, t, false);
  ok(!m.includes('96') && !m.includes('하늘') && (m.match(/이름 가리기 중/g) || []).length === 3, '가리기');
});

test('관리 결과 표 — 수업 중이면 이름 칸 [빼기 / 다시 넣기] · 빠짐 표시 · asg-ex (문제 묶음 표와 같음) / 수업 밖 · 명단 밖은 단추 없음 [검토 반영]', () => {
  const c1 = write(null, rhythmPatch(res(80))).cell;
  const roster = [{ sid: 's1', name: '하늘' }, { sid: 's2', name: '바다' }];
  const t = AC.tally(DEF, { s1: c1, zz: c1 }, roster, { excused: { s2: true } });
  admin._mask = false;
  const on = admin._assignAppResultHTML(DEF, t, true);
  ok(on.includes(`assignExcuse('s1', true)`) && on.includes('>빼기</button>'), '빼기 ' + on);
  ok(on.includes(`assignExcuse('s2', false)`) && on.includes('>다시 넣기</button>') && on.includes('<span class="asg-tag">빠짐</span>'), '다시 넣기 · 빠짐');
  ok((on.match(/<tr class="asg-ex">/g) || []).length === 1, 'asg-ex 하나');
  ok(!on.includes(`assignExcuse('zz'`), '명단 밖은 단추 없음');
  ok(!admin._assignAppResultHTML(DEF, t, false).includes('assignExcuse'), '수업 밖 단추 없음');
  admin._mask = true;
  ok(admin._assignAppResultHTML(DEF, t, true).includes(`assignExcuse('s1', true)`), '이름 가리기 중에도 빼기는 됨');
  admin._mask = false;
  const a = read('admin/assign.js');
  ok(/_assignAppResultHTML\(def, t, liveOn\)/.test(a), 'assign.js 가 liveOn 을 넘김');
  ok(/AssignCore\.avgText\(def, t, '아이'\)/.test(a) && !/끝낸 아이 평균/.test(a), '결과 머리 평균은 종류별 한 함수(AssignCore.avgText) [ASSIGN-AVG-1]');
  const c9 = write(null, rhythmPatch(res(96))).cell, t9 = AC.tally(DEF, { s1: c9 }, roster);
  ok(AC.avgText(DEF, t9, '아이') === '끝까지 친 아이 정확도 평균 96%' && !/점$/.test(AC.avgText(DEF, t9)), '음악 머리 = 정확도 평균 %(점수 아님) ' + AC.avgText(DEF, t9));
});
test('곡 이름 — 쪽을 새로 열어 목록이 없으면 종류 줄이 곡 목록을 읽고 다시 그림 · 영어 열쇠만 남지 않음 [검토 반영]', () => {
  const src = read('admin/assign-music.js');
  ok(/function assignMusicKindLabel\(def\) \{\n  if \(_assignMusicLib === null\) _assignMusicLoad\(\);/.test(src), '종류 줄이 읽기를 부름(실패 뒤에는 되풀이 안 함)');
  ok(/if \(!force && typeof _assignRenderBits === 'function' && Array\.isArray\(_assignMusicLib\)\) _assignRenderBits\(true\);/.test(src), '다 읽히면 목록 다시 그림');
  ok(/if \(!force && el\.querySelector\('\.asg-mu-song'\)\) return;/.test(src) && /preload: _assignMusicLoad/.test(src) && /a\.preload\(\)/.test(read('admin/assign.js')), '쪽을 열 때 미리 읽음 · 곡이 이미 보이면 다시 안 그림(첫 클릭 안 빠짐)');
  ok(admin.assignMusicKindLabel(DEF).includes('나비야') && !admin.assignMusicKindLabel(DEF).includes('nabiya'), admin.assignMusicKindLabel(DEF));
});
// ── [ASSIGN-TSONG-1] 🎤 선생님 곡(공연 곡) — 반 저장소 tsongs → 관리 고르기 둘째 칸 · 곡 이름 · 지운 곡 ──
//  시험 곡은 모두 이 시험이 지은 짧은 가락(저작권 없음)
const TS = {
  ens_p2: { key: 'ens_p2', title: '우리 반 <합주>', part: '2부', origin: '선생님 곡', order: 2, beats: 4, sub: 2, tempo: 96, level: 1, inst: 'recorder', melody: 'C3/4 G3/4 | F3/4 C4/4 | A3/4 G3/4 | C3/8', t: 1 },
  ens_p1: { key: 'ens_p1', title: '우리 반 <합주>', part: '1부(가락)', origin: '선생님 곡', order: 1, beats: 4, sub: 2, tempo: 96, level: 2, inst: 'recorder', melody: 'C4/2 E4/2 G4/2 E4/2 | F4/2 A4/2 G4/4 | E4/2 D4/2 C4/2 D4/2 | E4/4 C4/4', t: 1 },
  solo: { key: 'solo', title: '가을 길', origin: '선생님 곡', order: 3, beats: 3, sub: 2, tempo: 120, level: 3, inst: 'piano', melody: 'G4/2 E4/2 E4/2 | F4/2 D4/2 D4/2 | C4/2 E4/2 G4/2 | C5/6', t: 1 },
  //  아이 쪽(fromTeacherSong)이 버리는 모양 — 관리 칸에도 안 뜬다
  bad_key: { key: 'bad key', title: '곡키 틀림', beats: 4, sub: 2, tempo: 100, melody: 'C4/8' },
  bad_tempo: { key: 'bad_tempo', title: '빠르기 틀림', beats: 4, sub: 2, tempo: 300, melody: 'C4/8' },
  bad_level: { key: 'bad_level', title: '난이도 틀림', beats: 4, sub: 2, tempo: 100, level: 7, melody: 'C4/8' },
  bad_beats: { key: 'bad_beats', title: '박 틀림', beats: 5, sub: 2, tempo: 100, melody: 'C4/10' },
  bad_order: { key: 'bad_order', title: '순서 틀림', order: 'x', beats: 4, sub: 2, tempo: 100, melody: 'C4/8' },
  no_melody: { key: 'no_melody', title: '가락 없음', beats: 4, sub: 2, tempo: 100 },
  no_title: { key: 'no_title', title: '  ', beats: 4, sub: 2, tempo: 100, melody: 'C4/8' },
  junk: 'x',
};
const tsLoad = val => vm.runInContext(`_assignMusicTs = _assignMusicTsList(${JSON.stringify(val)}); _assignMusicTsFor = ''; _assignMusicTsBusy = false; _assignMusicTs.length`, admin);
test('[ASSIGN-TSONG-1] 선생님 곡 목록 — 아이 쪽 fromTeacherSong 과 같은 id · 제목(제목 · 부분) · 마디 · 틀린 곡은 건너뜀 · 합주 부분은 붙여서(순서 → 부분)', () => {
  const list = vm.runInContext(`_assignMusicTsList(${JSON.stringify(TS)})`, admin);
  eq(list.map(s => s.id), ['ts_ens_p1', 'ts_ens_p2', 'ts_solo'], '차례(묶음 = 가장 앞 순서 · 묶음 안 = 순서)');
  for (const s of list) {
    const k = fromTeacherSong(TS[s.key]);
    ok(s.id === k.id && s.title === k.title && s.bars === k.bars && s.tempo === k.tempo && s.level === k.level, `${s.key}: 관리 ${JSON.stringify([s.id, s.title, s.bars, s.tempo, s.level])} · 아이 ${JSON.stringify([k.id, k.title, k.bars, k.tempo, k.level])}`);
  }
  for (const k of Object.keys(TS).filter(k => !['ens_p1', 'ens_p2', 'solo'].includes(k) && typeof TS[k] === 'object')) {
    let threw = false; try { fromTeacherSong(TS[k]); } catch (e) { threw = true; }
    ok(threw, '아이 쪽도 버림 ' + k);
  }
  eq(vm.runInContext(`_assignMusicTsList(null).length + _assignMusicTsList('x').length + _assignMusicTsList([]).length`, admin), 0, '빈 값');
});
test('[ASSIGN-TSONG-1] 관리 고르기 칸 — 기본 곡 15 그대로 + 둘째 칸 🎤 선생님 곡 3(합주 한 묶음 · 제목 · 부분 · 마디 · 빠르기) · 고르면 ● · 이름 = 제목 · 부분 · 이상한 id 막음', () => {
  tsLoad(TS);
  const d = { kind: 'music', music: { song: '', level: 'normal', tempo: 1, keys: 6 } };
  admin._AS.draft = d;
  let html = admin.assignMusicPickerHTML(d);
  ok((html.match(/class="asg-mu-song"/g) || []).length === 15, '기본 곡 15 ' + (html.match(/class="asg-mu-song"/g) || []).length);
  ok((html.match(/asg-mu-tsong/g) || []).length === 3 && html.includes('id="asg-mu-ts"') && html.includes('🎤 선생님 곡(공연 곡)') && html.includes('음악실 선생님 화면에서 넣은 곡 3곡'), '둘째 칸 3곡');
  ok(html.indexOf('id="asg-mu-ts"') > html.lastIndexOf('class="asg-mu-song"') && html.indexOf('id="asg-mu-ts"') < html.indexOf("assignMusicDraft('level'"), '기본 곡 밑 · 난이도 위');
  const ens = html.match(/<div class="asg-mu-ens">[\s\S]*?<\/button><\/div>/);
  ok(ens && (ens[0].match(/asg-mu-tsong/g) || []).length === 2 && ens[0].includes('🎼 <b>우리 반 &lt;합주&gt;</b>') && ens[0].includes('합주 · 부분 2개') && ens[0].indexOf('1부(가락)') < ens[0].indexOf('2부'), '합주 한 묶음(부분 둘 · 1부 먼저 · 제목 escape)');
  ok(!html.includes('<합주>') && html.includes('<b>가을 길</b>') && html.includes('4마디 · 빠르기 120') && html.includes('4마디 · 빠르기 96'), '제목 · 마디 · 빠르기');
  admin.assignMusicDraft('song', 'ts_ens_p1');
  ok(d.music.song === 'ts_ens_p1', '고름');
  html = admin.assignMusicPickerHTML(d);
  ok((html.match(/asg-mu-song[^"]*\bon\b/g) || []).length === 1 && /asg-mu-tsong on"[^>]*onclick="assignMusicDraft\('song','ts_ens_p1'\)">\s*<span class="asg-mu-radio">●/.test(html), '고른 곡 ● 하나');
  ok(admin.assignMusicAutoTitle(d) === '리듬 · 우리 반 <합주> · 1부(가락) · 보통', admin.assignMusicAutoTitle(d));
  for (const bad of ['ts_a.b', "ts_x'><b>", 'ex_star', 'nabiya', 'ts_' + 'a'.repeat(41)]) { admin.assignMusicDraft('song', bad); ok(d.music.song === '', '막음 ' + bad); }
  admin.assignMusicDraft('song', 'ts_solo');
  ok(d.music.song === 'ts_solo' && admin.assignMusicAutoTitle(d) === '리듬 · 가을 길 · 보통', admin.assignMusicAutoTitle(d));
  const b = vm.runInContext(`ASSIGN_APPS.music.build(${JSON.stringify(d)})`, admin);
  ok(b.content && b.content.music.song === 'ts_solo' && AC.normDef({ id: 'aB', kind: 'music', content: b.content }, 'aB'), '보내기 모양 → normDef 통과');
});
test('[ASSIGN-TSONG-1] 곡 이름 — 목록 · 결과 머리 = 🎤 제목 · 부분 / 지운 곡 = \'선생님 곡\' + 음악실에 없는 곡 · 보내기 막음 / 아직 못 읽음 = \'선생님 곡\'(곡키 안 보임)', () => {
  tsLoad(TS);
  const def = song => AC.normDef({ ...RAW, id: 'aTs', content: { music: { song, level: 'normal', keys: 6 } } }, 'aTs');
  ok(admin.assignMusicSongTitle('ts_ens_p2') === '우리 반 <합주> · 2부', admin.assignMusicSongTitle('ts_ens_p2'));
  let lab = admin.assignMusicKindLabel(def('ts_ens_p2'));
  ok(lab === '🎵 리듬 · 🎤 우리 반 &lt;합주&gt; · 2부 · 보통 · 6키', lab);
  ok(admin.assignMusicKindLabel(DEF).includes('나비야') && !admin.assignMusicKindLabel(DEF).includes('🎤'), '기본 곡 줄은 그대로');
  //  지운 곡(다 읽은 목록에 없음)
  ok(admin.assignMusicSongTitle('ts_gone') === '선생님 곡', '지운 곡 이름');
  lab = admin.assignMusicKindLabel(def('ts_gone'));
  ok(lab === '🎵 리듬 · 🎤 선생님 곡 <span class="asg-warn">음악실에 없는 곡</span> · 보통 · 6키' && !lab.includes('ts_gone') && !lab.includes('gone'), lab);
  const d = { kind: 'music', music: { song: 'ts_gone', level: 'easy', tempo: 1, keys: 0 } };
  ok(/음악실에 없어요/.test(vm.runInContext(`ASSIGN_APPS.music.build(${JSON.stringify(d)})`, admin).err || ''), '지운 곡은 보내기 막음');
  ok(admin.assignMusicAutoTitle(d) === '리듬 · 선생님 곡 · 쉬움', admin.assignMusicAutoTitle(d));
  //  아직 못 읽음(null) · 못 읽음('err') — '선생님 곡' · 경고 없음(모르니까) · 곡키 안 보임
  for (const st of ['null', "'err'"]) {
    vm.runInContext(`_assignMusicTs = ${st}; _assignMusicTsFor = 'list';`, admin);
    lab = admin.assignMusicKindLabel(def('ts_ens_p1'));
    ok(lab === '🎵 리듬 · 🎤 선생님 곡 · 보통 · 6키', st + ' ' + lab);
  }
});
test('[ASSIGN-TSONG-1] 둘째 칸 모양 — 읽는 중 · 못 읽음(다시 읽기) · 없음 · DB 없음에도 고르기 칸은 그대로(기본 곡 15 · 난이도 칸)', () => {
  const d = { kind: 'music', music: { song: '', level: 'easy', tempo: 1, keys: 0 } };
  const pick = st => { vm.runInContext(st + "; _assignMusicTsFor = '';", admin); return admin.assignMusicPickerHTML(d); };
  const shown = html => (html.match(/<div id="asg-mu-ts" class="asg-mu-ts">([\s\S]*?)<\/div>\s*<div class="asg-c-row"><span class="text-muted-sm">난이도/) || [])[1] || '';
  let h = pick('_assignMusicTs = null; _assignMusicTsBusy = true');
  ok(shown(h).includes('선생님 곡을 읽는 중…') && (h.match(/class="asg-mu-song"/g) || []).length === 15 && h.includes("assignMusicDraft('level'"), '읽는 중 ' + shown(h).slice(0, 120));
  h = pick("_assignMusicTs = 'err'; _assignMusicTsBusy = false");
  ok(shown(h).includes('선생님 곡을 읽지 못했어요') && shown(h).includes('onclick="assignMusicTsRetry()"') && !/asg-mu-tsong/.test(h) && (h.match(/class="asg-mu-song"/g) || []).length === 15, '못 읽음');
  h = pick('_assignMusicTs = []; _assignMusicTsBusy = false');
  ok(shown(h).includes('아직 넣은 선생님 곡이 없어요') && !/asg-mu-tsong/.test(h), '없음');
  //  DB 가 없는 화면(이 시험 같은 곳)에서 새 과제 — 던지지 않고 '못 읽음'
  vm.runInContext("_assignMusicTs = null; _assignMusicTsBusy = false; _assignMusicTsFor = null;", admin);
  h = admin.assignMusicPickerHTML({ ...d, aid: 'aNoDb' });
  ok(shown(h).includes('선생님 곡을 읽지 못했어요') && (h.match(/class="asg-mu-song"/g) || []).length === 15, 'DB 없음');
});
test('[ASSIGN-TSONG-1] 읽기 — classRPG_music/tsongs 를 once 한 번(구독 없음) · 같은 새 과제면 다시 안 읽음 · 새 과제면 다시 · 실패 = 옛 목록 그대로(없으면 못 읽음) · 시간 초과 뒤 늦게 와도 채움', async () => {
  const reads = [], timers = [];
  let reply = () => Promise.resolve({ val: () => TS });
  admin.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  admin.clearTimeout = () => {};
  vm.runInContext('var __renders = 0, __rb = _assignRenderBits; _assignRenderBits = function () { __renders++; };', admin);
  const con = admin.console; admin.console = { ...console, warn: () => {} };   // 일부러 낸 실패의 경고 줄은 숨김
  admin._AS.db = { ref: p => ({ once: (ev) => { reads.push(p + ':' + ev); return reply(); }, on: () => { throw new Error('구독 금지'); } }) };
  vm.runInContext("_assignMusicTs = null; _assignMusicTsBusy = false; _assignMusicTsFor = null;", admin);
  const flush = () => new Promise(r => setImmediate(r));
  admin._assignMusicTsLoad('aOne'); await flush();
  ok(reads.join() === 'classRPG_music/tsongs:value' && vm.runInContext('_assignMusicTs.length', admin) === 3 && admin.__renders >= 1, '한 번 읽음 ' + reads.join());
  ok(timers.length === 1 && timers[0].ms === 10000, '시간 초과 10초');
  admin._assignMusicTsLoad('aOne'); admin.assignMusicKindLabel(AC.normDef({ ...RAW, id: 'aK', content: { music: { song: 'ts_solo' } } }, 'aK')); await flush();
  ok(reads.length === 1, '같은 새 과제 · 목록 이름은 다시 안 읽음 ' + reads.length);
  reply = () => Promise.reject(new Error('끊김'));
  admin._assignMusicTsLoad('aTwo'); await flush();
  ok(reads.length === 2 && vm.runInContext('Array.isArray(_assignMusicTs) && _assignMusicTs.length === 3 && !_assignMusicTsBusy', admin), '새 과제 = 다시 읽음 · 실패해도 옛 목록');
  vm.runInContext("_assignMusicTs = null; _assignMusicTsFor = null;", admin);
  admin._assignMusicTsLoad('aThree'); await flush();
  ok(vm.runInContext("_assignMusicTs === 'err' && !_assignMusicTsBusy", admin), '처음부터 실패 = 못 읽음');
  //  시간 초과 → 못 읽음 → 늦게 온 답으로 채움
  let late; reply = () => new Promise(r => { late = r; });
  vm.runInContext("_assignMusicTs = null; _assignMusicTsFor = null;", admin);
  admin._assignMusicTsLoad('aFour'); timers[timers.length - 1].fn(); await flush();
  ok(vm.runInContext("_assignMusicTs === 'err' && !_assignMusicTsBusy", admin), '시간 초과 = 못 읽음');
  late({ val: () => ({ solo: TS.solo }) }); await flush();
  ok(vm.runInContext("Array.isArray(_assignMusicTs) && _assignMusicTs.length === 1 && _assignMusicTs[0].id === 'ts_solo'", admin), '늦게 와도 채움');
  //  다시 읽기 단추 — 같은 새 과제라도 다시
  reply = () => Promise.resolve({ val: () => TS });
  admin._AS.draft = { aid: 'aFour', kind: 'music', music: { song: '', level: 'easy', tempo: 1, keys: 0 } };
  const before = reads.length; admin.assignMusicTsRetry(); await flush();
  ok(reads.length === before + 1 && vm.runInContext('_assignMusicTs.length', admin) === 3, '다시 읽기');
  admin._AS.db = null; admin._AS.draft = null; admin.console = con; delete admin.setTimeout; delete admin.clearTimeout;
  vm.runInContext('_assignRenderBits = __rb;', admin);
});
test('[ASSIGN-TSONG-1] 아이 쪽 — 리듬 판 설정에 ts_ 곡 그대로 · 곡이 없으면 \'선생님 곡이 바뀌었어요 — 선생님께 알려 주세요\'(다시 불러오기) · 같은 id 로 연다', () => {
  const d = AC.normDef({ ...RAW, id: 'aKid', content: { music: { song: 'ts_ens_p1', level: 'hard', keys: 4, tempo: 0.8 } } }, 'aKid');
  eq(rhythmSettings(d), { song: 'ts_ens_p1', level: 'hard', keys: 4, tempo: 0.8 });
  const s = read('music/js/app.js');
  ok(/if \(ref\.startsWith\('ts_'\)\) return \(await teacherSongs\(\)\)\.find\(s => s\.id === ref\) \|\| null;/.test(s), 'ctx.resolve 가 ts_ 를 선생님 곡에서 찾음');
  ok(/if \(!song\) \{ current = asgScreen\('🎵', asg\.set\.song\.startsWith\('ts_'\) \? '선생님 곡이 바뀌었어요' : '곡을 찾지 못했어요', '선생님께 알려 주세요', h\('button', \{ class: 'btn', onclick: \(\) => location\.reload\(\) \}, '다시 불러오기'\)\); return; \}/.test(s), '없는 곡 화면');
});

test('TV — 정확도 평균 = 관리 화면 assignMusicSummary 와 같은 숫자(AssignCore.avgOf 한 셈) · 이름 보이기가 음악 화면에도 듣는다 [검토 반영]', () => {
  const tv = read('assign/js/tv.js');
  const musicAvg = t => (AC.avgOf(DEF, t) || {}).v;
  let c1 = write(null, rhythmPatch(res(100))).cell;
  const c2 = write(null, rhythmPatch(res(56.3))).cell;
  const t = AC.tally(DEF, { s1: c1, s2: c2 }, [{ sid: 's1', name: '하늘' }, { sid: 's2', name: '바다' }, { sid: 's3', name: '구름' }]);
  const want = admin.assignMusicSummary(t).avg;
  ok(want === 78.2 && musicAvg(t) === want, `관리 ${want} · TV ${musicAvg(t)} · tally ${t.avg}`);
  ok(/function appView\(def, live\)/.test(tv) && /const names = !!\(live && live\.names\), avg = AC\.avgText\(def, t, '친구'\)/.test(tv), 'appView 가 live.names · 같은 평균 함수를 읽음');
  ok(/view = appView\(def, live\)/.test(tv) && /return appView\(def, live\)/.test(tv), '부르는 곳 둘 다 live 넘김');
  ok(!/t\.avg/.test(tv.match(/function appView[\s\S]*?\n\}\n/)[0]), 'TV 음악 평균은 tally.avg(반올림 점수) 안 씀');
});
test('밑의 리듬 판이 수업 덮개로 멈추면 — 그 판은 버리고 준비 화면에 까닭 한 줄 · 다시 시작하면 지움 [검토 반영]', () => {
  const r = read('music/js/rhythm.js');
  ok(/pause\(\) \{ if \(state === 'play'\) \{ pausedByClass = true; stop\(\); \} \}/.test(r), 'pause 표시');
  ok(/pausedByClass \? h\('p', \{ class: 'r-asg-note' \}, '⏸ 선생님과 수업 때문에 치던 판이 멈췄어요/.test(r), '준비 화면 한 줄');
  ok(/function start\(\) \{\n    pausedByClass = false;/.test(r), 'start 에서 지움');
  ok(/리듬 판은 멈춤 = 그 판을 버림/.test(read('docs/class_assign_design.md')), '설계 §21 에 적음');
});

// ── 학생 화면 덮개 안 앱 주소(student/assign.js 를 vm 에서) ──
test('수업 덮개 안 앱 주소 — 스위치(AssignCore.LIVE_APPS)가 꺼져 있으면 없음(과제함으로만 · 보스 결정 10-05) · 켜면 학습 앱 창 주소 + &assign=<과제>&live=1 · 문제 묶음 · 모르는 앱 · 이상한 id 는 없음', () => {
  const mk = core => { const c = { console, AssignCore: core, externalStudyItems: () => [{ key: 'music', embed: true, href: 'music/index.html?sid=s1&n=%ED%95%98' }] }; vm.createContext(c); vm.runInContext(read('student/assign.js'), c); return c; };
  ok(mk(AC)._asgAppSrc(DEF) === '', '꺼짐 — 리듬은 덮개 안에 안 열림');
  const ctx = mk({ ...AC, isLiveKind: k => k === 'quiz' || k === 'music' });
  ok(ctx._asgAppSrc(DEF) === 'music/index.html?sid=s1&n=%ED%95%98&assign=aMus1&live=1', ctx._asgAppSrc(DEF));
  ok(ctx._asgAppSrc({ ...DEF, kind: 'quiz' }) === '', 'quiz');
  ok(ctx._asgAppSrc({ ...DEF, kind: 'coding' }) === '', '코딩(스위치에 없음 · 앱 창 없음)');
  ok(ctx._asgAppSrc({ ...DEF, id: "a'><x" }) === '', '이상한 id');
  const src = read('student/assign.js');
  ok(/lf && e\.source === lf\.contentWindow/.test(src), '덮개 안 앱 창이 보낸 결과도 받음');
  ok(/_asgAppFrameOff\(inst\);\n  _ASG\.inst\[inst\] = null;/.test(src) && /if \(fr\) fr\.remove\(\);/.test(src), '덮개 닫으면 앱 창을 뗌(소리 · 타이머 정지)');
});

for (const [name, fn] of queue) { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }
const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 리듬 과제: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
