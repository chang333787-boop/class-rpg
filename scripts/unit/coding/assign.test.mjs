// 기초 코딩 · 선생님 과제 시험 [ASSIGN-CODING-1] — coding/js/asg.js 셈 · AssignCore.appPatch 와 맞물림 · 관리 결과 칸 · 이어 붙인 곳
//  node scripts/unit/coding/assign.test.mjs   (DOM 없음 · 네트워크 없음)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { asgState, nextAfter, runPatch, rankOf, STUCK_TRIES, PY_MAX } from '../../../coding/js/asg.js';
import { STAGES, UNITS } from '../../../coding/js/stages.js';
import '../../../common/assign-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const AC = globalThis.AssignCore;
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb} · 실제 ${sa}`); };

const DEF = AC.normDef({ id: 'aCd1', kind: 'coding', title: '반복하기', content: { coding: { stages: ['2-3', '2-4', '9-1'] } }, roster: { s1: '하늘', s2: '바다' }, createdAt: 1 }, 'aCd1');
const ST = DEF.content.coding.stages;
//  실행 한 번을 내 칸에 적용(부모 학생 화면이 하는 일 = AssignCore.appPatch 결과를 그대로 쓰기)
function apply(cell, up) {
  const c = JSON.parse(JSON.stringify(cell || {}));
  for (const [k, v] of Object.entries(up || {})) {
    const ks = k.split('/').slice(3);   // results/<aid>/<sid>/…
    let o = c; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] = o[ks[i]] || {};
    const last = ks[ks.length - 1];
    o[last] = v === 'INC' ? (o[last] || 0) + 1 : v;
  }
  return c;
}
const run = (cell, id, r, local = 0, py = '') => {
  const x = runPatch(ST, cell, id, r, { localTries: local, py });
  const up = x ? AC.appPatch(DEF, 's1', cell, x.patch, { TS: 1000, INC: () => 'INC' }) : null;
  return { x, up, cell: apply(cell, up) };
};

test('과제 판 id 가 모두 stages.js 에 있고 normDef 의 판 id 모양(1~12자)에 맞다 — 66판', () => {
  ok(STAGES.length === 66, '판 수 ' + STAGES.length);
  for (const s of STAGES) ok(/^[\w-]{1,12}$/.test(s.id) && /^[\w-]{1,30}$/.test(s.id), s.id);
  ok(UNITS.length === 9, '단원 수');
});
test('asgState — 빈 칸 · 안 푼 첫 판 · 다 했나', () => {
  const s = asgState(ST, null);
  eq([s.solved, s.total, s.done, s.firstOpen], [0, 3, false, '2-3']);
  const s2 = asgState(ST, { app: { detail: { '2-3': { ok: true, st: 3, tries: 2 }, '9-1': { ok: false, tries: 6 } } } });
  eq([s2.solved, s2.firstOpen, s2.list[2].stuck, s2.list[0].st], [1, '2-4', true, 3]);
  ok(asgState(ST, { app: { detail: { '2-3': { ok: true }, '2-4': { ok: true }, '9-1': { ok: true } } } }).done, '다 함');
});
test('nextAfter — 과제 차례의 다음 · 마지막은 null · 과제 밖 판은 undefined', () => {
  eq([nextAfter(ST, '2-3'), nextAfter(ST, '2-4'), nextAfter(ST, '9-1'), nextAfter(ST, '1-1')], ['2-4', '9-1', null, undefined]);
});
test('rankOf — 푼 기록 > 못 푼 기록 · 별 많을수록 · 블록 적을수록 · 못 풀면 실행 수', () => {
  ok(rankOf(true, 1, 99, 1) > rankOf(false, 0, 1, 999), '푼 것이 큼');
  ok(rankOf(true, 3, 9, 1) > rankOf(true, 2, 5, 1), '별');
  ok(rankOf(true, 3, 5, 1) > rankOf(true, 3, 6, 1), '블록');
  ok(rankOf(false, 0, 0, 6) > rankOf(false, 0, 0, 5), '실행 수');
});
test('실행 → 내 칸: 실패는 실행 수 · 까닭이 쌓이고, 다섯 번이면 막힘 · 풀면 별 · 점수 · 다 하면 doneAt', () => {
  let cell = { startedAt: 1 }, local = 0;
  for (let i = 0; i < STUCK_TRIES; i++) { const r = run(cell, '2-3', { ok: false, why: i % 2 ? 'wall' : 'short', n: 4 }, local, 'for i in range(3):\n  앞으로()'); cell = r.cell; local = r.x.tries; }
  const d = cell.app.detail['2-3'];
  eq([d.tries, d.ok, d.why.wall, d.why.short, cell.app.attempts], [5, false, 2, 3, 5]);
  ok(asgState(ST, cell).list[0].stuck, '막힘');
  ok(d.py.startsWith('for i in range(3)'), '마지막 코드');
  let r = run(cell, '2-3', { ok: true, n: 4, stars: 2 }, local); cell = r.cell;
  eq([cell.app.detail['2-3'].ok, cell.app.detail['2-3'].st, cell.app.detail['2-3'].tries, cell.app.score, cell.app.total], [true, 2, 6, 1, 3]);
  ok(!cell.doneAt, '아직 다 안 함');
  //  푼 뒤의 실패는 판 기록을 덮지 않는다(rank 가 작음) · 실행 수(app/attempts)는 는다
  r = run(cell, '2-3', { ok: false, why: 'wall', n: 9 }, 6); cell = r.cell;
  eq([cell.app.detail['2-3'].ok, cell.app.attempts], [true, 7]);
  ok(!('results/aCd1/s1/app/detail/2-3' in r.up), '푼 기록을 덮음');
  //  더 좋은 풀이(별 3)는 덮는다
  r = run(cell, '2-3', { ok: true, n: 3, stars: 3 }, 7); cell = r.cell;
  eq(cell.app.detail['2-3'].st, 3);
  //  같은 판을 다시 풀어도 점수는 그대로(푼 판 수)
  r = run(cell, '2-3', { ok: true, n: 3, stars: 3 }, 8); cell = r.cell;
  eq(cell.app.score, 1, '점수');
  r = run(cell, '2-4', { ok: true, n: 5, stars: 3 }); cell = r.cell;
  r = run(cell, '9-1', { ok: true, n: 9, stars: 1 }); cell = r.cell;
  eq([cell.app.score, cell.doneAt, asgState(ST, cell).done], [3, 1000, true]);
});
test('내 칸이 늦게 와도(같은 칸으로 두 번) 이 창의 실행 수가 줄지 않는다', () => {
  const a = runPatch(ST, null, '2-4', { ok: false, why: 'edge' }, { localTries: 0 });
  const b = runPatch(ST, null, '2-4', { ok: false, why: 'edge' }, { localTries: a.tries });
  eq([a.tries, b.tries], [1, 2]);
  ok(b.patch.detail['2-4'].rank > a.patch.detail['2-4'].rank, 'rank 가 커야 써진다');
});
test('runPatch — 과제 밖 판 · 이상한 값은 null · 코드는 300자 · 까닭 열쇠 정리 · 판 기록 1KB 안', () => {
  ok(runPatch(ST, null, '1-1', { ok: true }) === null, '과제 밖');
  ok(runPatch(ST, null, '2-3', null) === null, 'run 없음');
  const r = runPatch(ST, { app: { detail: { '2-3': { tries: 3, why: { 'a.b': 2 } } } } }, '2-3', { ok: false, why: 'x/y' }, { py: 'x'.repeat(5000) });
  const d = r.patch.detail['2-3'];
  eq([d.py.length, d.tries, Object.keys(d.why)], [PY_MAX, 4, ['a_b', 'x_y']]);
  ok(JSON.stringify(d).length < 1000, '1KB');
  const up = AC.appPatch(DEF, 's1', null, r.patch, { TS: 1, INC: () => 1 });
  ok(up['results/aCd1/s1/app/detail/2-3'] && Object.keys(up).every(k => k.startsWith('results/aCd1/s1/')), '내 칸 아래만');
});

// ── 이어 붙인 곳(글자 검사) ──
test('coding/index.html import map — asg.js · common/assign.js · assign-core.js(student · admin · assign html 과 같은 값)', () => {
  const html = read('coding/index.html');
  const v = f => (html.match(new RegExp('"' + f.replace(/[.]/g, '\\.') + '": "[^"?]+\\?v=([\\w]+)"')) || [])[1];
  ok(v('./js/asg.js'), 'asg.js');
  ok(v('../common/assign.js'), 'assign.js');
  const core = v('../common/assign-core.js');
  for (const f of ['student.html', 'admin.html', 'assign/index.html']) ok(read(f).includes('common/assign-core.js?v=' + core), f + ' 의 assign-core ?v= 가 ' + core + ' 아님');
  ok(v('./js/stages.js') === (read('admin/assign-coding.js').match(/ASSIGN_CODING_STAGES_V = '(\w+)'/) || [])[1], '관리 화면이 부르는 stages.js ?v= 가 앱 import map 과 다름');
});
test('app.js · play.js · store.js — 과제 판은 다른 열쇠 · 결과는 reportAssign · 멈춤 신호 · 수업 안에서는 뒤로 칸 안 쌓음', () => {
  const app = read('coding/js/app.js'), play = read('coding/js/play.js'), store = read('coding/js/store.js');
  ok(/from '\.\.\/\.\.\/common\/assign\.js'/.test(app), 'common/assign.js import');
  ok(app.includes("'__asg_' + A.aid") && app.includes('statsKey: k'), '코드 · 셈 열쇠');
  ok(/reportAssign\(store\.db, A\.aid, A\.sid, r\.patch\)/.test(app) && /\{ start: true \}/.test(app), 'reportAssign');
  ok(/onClassPause\(on => \{ if \(on && current && current\.pause\) current\.pause\(\); \}\)/.test(app), '멈춤');
  ok(/A && A\.live\) location\.replace\(hash\)/.test(app), 'live replace');
  ok((play.match(/ctx\.onRun && ctx\.onRun\(/g) || []).length === 2 && /return \{ pause,/.test(play) && /ctx\.nextOf \? ctx\.nextOf\(stage\.id\)/.test(play), 'play 갈고리');
  ok(/saveRun\(stage, \{ ok, why, n, stars \}, opt = \{\}\)/.test(store) && /online: true, db,/.test(store), 'store');
});
test('student/assign.js — 수업 덮개 안 기초 코딩 iframe(&live=1) · 그 iframe 의 결과도 받는다 · 끝나면 뗀다', () => {
  const s = read('student/assign.js');
  ok(/const ASG_LIVE_APPS = \['coding'\]/.test(s), 'ASG_LIVE_APPS');
  ok(s.includes("'&assign=' + encodeURIComponent(def.id) + '&live=1'"), 'live 주소');
  ok(/lf && e\.source === lf\.contentWindow/.test(s), '덮개 iframe 결과');
  ok(/_asgAppFrameOff\(inst\);\n  _ASG\.inst\[inst\] = null;/.test(s), '끝날 때 뗌');
});

// ── 관리 화면 결과 칸(vm — escHtml · 명단 · tally 그대로) ──
test('관리 결과 표 — 명단 기준 · 판마다 ★/실행/막힘 · 막힌 판 · 많이 한 실수 · 마지막 코드 escape · 이름 가리기', () => {
  const g = { console, URL, document: { baseURI: 'http://x/admin.html' }, AssignCore: AC };
  g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(read('admin.js').split('\n').slice(0, 27).join('\n'), g);   // escHtml · escJsAttr
  vm.runInContext(`var _maskOn = false; function _assignMasked(){ return _maskOn; }
    function _assignNameHTML(n, i){ return _assignMasked() ? '학생 ' + (i + 1) : escHtml(n); }
    function _assignStatus(r){ return r.status; } function _assignMs(ms){ return Math.round(ms / 1000) + '초'; }`, g);
  vm.runInContext(read('admin/assign-coding.js'), g);
  vm.runInContext(`_ASC.stages = [{ id: '2-3', unit: 2, title: '계단' }, { id: '2-4', unit: 2, title: '긴 길' }, { id: '9-1', unit: 9, title: '조종기' }]; _ASC.units = [];`, g);
  const R = {
    s1: { startedAt: 1, doneAt: 61001, app: { score: 3, total: 3, attempts: 9, detail: { '2-3': { ok: true, st: 3, n: 4, tries: 2 }, '2-4': { ok: true, st: 2, n: 6, tries: 1 }, '9-1': { ok: true, st: 1, n: 9, tries: 6, py: '<script>x</script>' } } } },
    s2: { startedAt: 1, app: { score: 0, total: 3, attempts: 6, detail: { '2-3': { ok: false, tries: 6, why: { wall: 4, short: 2 } } } } },
  };
  const t = AC.tally(DEF, R, [{ sid: 's1', name: '하늘' }, { sid: 's2', name: '바다' }, { sid: 's3', name: '<b>별</b>' }]);
  g.T = t; g.D = DEF;
  let html = vm.runInContext('assignCodingResultHTML(D, T)', g);
  ok(html.includes('하늘') && html.includes('&lt;b&gt;별&lt;/b&gt;') && !html.includes('<b>별</b>'), '명단 · escape');
  ok(html.includes('★★★ <small>(실행 2)') && html.includes('✗ <small>실행 6 막힘'), '칸');
  ok(html.includes('3 / 3') && html.includes('61초'), '푼 판 · 걸린 시간');
  ok(/class="asg-cd-stuck">2-3</.test(html), '막힌 판');
  ok(html.includes('막힘 1') && html.includes('나무에 부딪힘 4'), '판마다 셈 · 많이 한 실수');
  vm.runInContext("_ASC.cell = 's1|9-1'", g);
  html = vm.runInContext('assignCodingResultHTML(D, T)', g);
  ok(html.includes('&lt;script&gt;x&lt;/script&gt;') && !html.includes('<script>x'), '마지막 코드 escape');
  vm.runInContext('_maskOn = true', g);
  html = vm.runInContext('assignCodingResultHTML(D, T)', g);
  ok(!html.includes('하늘') && html.includes('이름 가리기 중') && !html.includes('&lt;script'), '이름 가리기');
});
test('관리 고르기 칸 — 단원 펼침 · 3판까지 · 고른 차례 번호', () => {
  const g = { console, URL, document: { baseURI: 'http://x/admin.html' }, AssignCore: AC };
  g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(read('admin.js').split('\n').slice(0, 27).join('\n'), g);
  vm.runInContext('var _AS = { draft: { kind: "coding", coding: { stages: [] } } }; var nW = 0; function _assignCWhat(){ nW++; } function _assignCMeta(){}', g);
  vm.runInContext(read('admin/assign-coding.js'), g);
  g.ST2 = STAGES.map(s => ({ id: s.id, unit: s.unit, title: s.title, best: s.best })); g.U2 = UNITS;
  vm.runInContext('_ASC.stages = ST2; _ASC.units = U2; assignCodingUnit(2);', g);
  for (const id of ['2-3', '2-1', '9-1', '2-2']) vm.runInContext(`assignCodingToggle('${id}')`, g);
  eq(vm.runInContext('_AS.draft.coding.stages', g), ['2-3', '2-1', '9-1'], '3판까지 · 차례');
  vm.runInContext("assignCodingToggle('2-1')", g);
  eq(vm.runInContext('_AS.draft.coding.stages', g), ['2-3', '9-1'], '빼기');
  const html = vm.runInContext('assignCodingPickerHTML(_AS.draft)', g);
  ok(html.includes('2단원') && (html.match(/class="asg-cd-stage[ "]/g) || []).length === STAGES.filter(s => s.unit === 2).length, '펼친 단원의 판');
  ok(html.includes('<span class="asg-cd-n">1</span><b>2-3</b>'), '고른 차례 번호');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`기초 코딩 과제 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
