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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const AC = globalThis.AssignCore;
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
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

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 리듬 과제: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
