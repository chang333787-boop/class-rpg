// 마을 시뮬 도구 시험 — 네트워크 0 · 같은 시드는 같은 값 · 한 수가 표에 잡힌다 (약 20초)
import { spawn, spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, String(e.message).split('\n')[0]]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

function sim(args) {
  const out = path.join(os.tmpdir(), 'village-sim-test-' + process.pid + '-' + results.length + '.json');
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), ...args, '--json', out], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('run.mjs 실패: ' + (r.stderr || r.stdout).trim().split('\n').slice(-2).join(' '));
  const j = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out, { force: true }); j.text = r.stdout; return j;
}
const last = r => r.samples[r.samples.length - 1].m;

test('빈 땅이 열리고 하루 돈다 · 네트워크 0', () => {
  const j = sim(['--days', '1', '--seeds', '1']);
  ok(j.results.length === 1, '판 1개'); ok(j.results[0].네트워크 === 0, '네트워크 ' + j.results[0].네트워크);
  ok(j.results[0].자기파일.every(p => p.startsWith('/village/')), '마을 밖 파일: ' + j.results[0].자기파일.join(' '));   // 모델 glb 는 불러오려다 거절됨(프리미티브로)
});
let a1, a2;
test('같은 시드 = 같은 값 (pop88 · 하루)', () => {
  a1 = sim(['--save', 'village/stages/boards/pop88.json', '--days', '1', '--seeds', '1']).results[0];
  a2 = sim(['--save', 'village/stages/boards/pop88.json', '--days', '1', '--seeds', '1']).results[0];
  ok(JSON.stringify(a1.samples) === JSON.stringify(a2.samples), '두 번 돌린 값이 다름');
  ok(a1.네트워크 === 0, '네트워크 ' + a1.네트워크);
});
/* [MAC-SIMRAND] 그림 PR 의 거짓 FAIL 막기 — 그림·모형·three uuid 는 Math.random(lookseed), 판정은 simRand(seed).
   그림 줄기만 흔들어도 판정 값이 한 칸도 안 움직여야 한다. 누가 판정 코드에 Math.random 을 다시 쓰면 여기서 잡힌다. */
test('그림 난수를 흔들어도 판정 값이 같다 (pop88 · 하루 · lookseed 99)', () => {
  const j = sim(['--save', 'village/stages/boards/pop88.json', '--days', '1', '--seeds', '1', '--vs', '그림흔듦: lookseed=99']);
  const b = j.results.find(r => r.name === '기본'), v = j.results.find(r => r.name === '그림흔듦');
  const diff = []; b.samples.forEach((s, i) => Object.keys(s.m).forEach(k => { if (JSON.stringify(s.m[k]) !== JSON.stringify(v.samples[i].m[k])) diff.push(k + '@' + s.tick); }));
  ok(!diff.length, '판정 값이 움직임(판정 코드가 Math.random 을 씀?): ' + diff.slice(0, 5).join(' '));
  ok(JSON.stringify(a1.samples) === JSON.stringify(b.samples), '그림 흔들기 전 값이 같은 시드 값과 다름');
});
/* [MAC-ESEED] PA-04 판 시드 — 판 파일 `시드`가 판정 난수 줄기를 정하고, 시드 판은 틱 머리에서 사람을 맞춘다(브라우저 프레임 = 하네스 묶음).
   판은 stageSeed(load.mjs — __SIM_RAND 를 심지 않음 · 브라우저처럼)로 연다: 시드 판은 엔진이 판 시드 줄기를 세우고, 시드가 없으면 simRand = Math.random = lookSeed 줄기.
   견주는 칸 = 판정 값(__pop · __away · __flow · __goals · __snapshot(저장키 뺌) 조각별 해시) — 풍선(lookRand)은 뺐다(프레임 함수라 무화면에서 못 잰다).
   (가) help-places(시드 1) 이틀 · lookSeed 1 ↔ 7 같음 · 하네스 꼴(도구 __SIM_RAND 시드 1) = 판 시드 1 줄기
   (나) 시드를 뺀 자기 시험 판(시험 안에서 쓰고 finally 에서 지움) · lookSeed 1 ↔ 7 다름(시드가 실제로 걸렸다는 증거) · 판 규칙 eseed 끔 사본 = 시드 뺀 판(되돌리기 = 옛 동작)
       · 싣고 난 뒤 VRULES.eseed.on = false(하네스 --rules 꼴) = 그 틱부터 옛 동작(도구 시드 1 = tickSync 끔 · 판 시드 줄기는 Math.random 으로 돌아와 lookSeed 따라 다름)
   (다) 브라우저 꼴 — 프레임당 1틱 · 2틱(__tickBench(1)·(2) = 프레임 머리 syncFolks + 틱) = 묶음 150틱(help-places · two-villages) · 양성 대조: tickSync 끔이면 1틱 ↔ 150틱 다름
   (라) 시드 없는 판(farm) · 기본 마을은 엔진 길 0(판시드 null · 틱머리맞춤 0 — 옛과 같은 값인지는 village-check 의 vsref) */
const esOne = c => new Promise(done => {
  const src = `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import crypto from 'node:crypto';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1, lookSeed: ${c.look || 1}, stageSeed: ${!c.tool}, query: ${JSON.stringify(c.stage ? 'stage=' + c.stage : '')} });
${c.pre || ''}
for (let i = 0; i < ${c.ticks}; i += ${c.k}) w.__tickBench(Math.min(${c.k}, ${c.ticks} - i));
const h = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12), { 저장키, ...s } = w.__snapshot();
const 판정 = { pop: w.__pop(), away: w.__away(), flow: h(w.__flow()), goals: w.__goals().이룬것, 물건: h(s.물건), 집: h(s.집), 이름: h(s.이름), 나머지: h({ ...s, 물건: 0, 집: 0, 이름: 0 }) };
process.stdout.write('@@' + JSON.stringify({ 판정, es: w.__eseed(), 틱: w.__sim().틱 }) + '\\n', () => process.exit(0));`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', src], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('close', () => { const l = out.split('\n').find(x => x.startsWith('@@')); done(l ? JSON.parse(l.slice(2)) : { 오류: c.n + ' — ' + ((err || out).trim().split('\n').slice(-1)[0] || '출력 없음') }); }); });
{ const SELF = 'zz-eseed-selftest', OFF = 'zz-eseed-off', dir = path.join(ROOT, 'village/stages'), T = 3600;
  const hp = JSON.parse(fs.readFileSync(path.join(dir, 'help-places.json'), 'utf8')), noSeed = { ...hp, id: SELF }; delete noSeed.시드;
  const C = [{ n: '가1', stage: 'help-places', k: 150 }, { n: '가7', stage: 'help-places', k: 150, look: 7 }, { n: '도구', stage: 'help-places', k: 150, tool: true },
    { n: '틱1', stage: 'help-places', k: 1 }, { n: '틱2', stage: 'help-places', k: 2 }, { n: '끔1', stage: 'help-places', k: 1, pre: 'w.VRULES.eseed.tickSync = false;' }, { n: '끔150', stage: 'help-places', k: 150, pre: 'w.VRULES.eseed.tickSync = false;' },
    { n: '둘150', stage: 'two-villages', k: 150 }, { n: '둘1', stage: 'two-villages', k: 1 }, { n: '뺌1', stage: SELF, k: 150 }, { n: '뺌7', stage: SELF, k: 150, look: 7 }, { n: '규칙끔', stage: OFF, k: 150 },
    { n: '도중끔', stage: 'help-places', k: 150, tool: true, pre: 'w.VRULES.eseed.on = false;' }, { n: '도중끔1', stage: 'help-places', k: 150, pre: 'w.VRULES.eseed.on = false;' }, { n: '도중끔7', stage: 'help-places', k: 150, look: 7, pre: 'w.VRULES.eseed.on = false;' },
    { n: 'farm', stage: 'farm', k: 150, ticks: 300, tool: true }, { n: '기본', stage: null, k: 150, ticks: 300, tool: true }].map(c => ({ ticks: T, ...c }));
  const R = {};
  fs.writeFileSync(path.join(dir, SELF + '.json'), JSON.stringify(noSeed, null, 1));
  fs.writeFileSync(path.join(dir, OFF + '.json'), JSON.stringify({ ...hp, id: OFF, 규칙: { ...(hp.규칙 || {}), eseed: { on: false } } }, null, 1));
  try { const out = new Array(C.length); let next = 0;   /* 판 하나 = 프로세스 하나(모듈 상태가 전역) — 여섯씩 나란히 */
    await Promise.all(Array.from({ length: Math.min(6, C.length) }, async () => { while (next < C.length) { const i = next++; out[i] = await esOne(C[i]); } }));
    C.forEach((c, i) => { R[c.n] = out[i]; });
  } finally { fs.rmSync(path.join(dir, SELF + '.json'), { force: true }); fs.rmSync(path.join(dir, OFF + '.json'), { force: true }); }
  const same = (a, b) => JSON.stringify(R[a].판정) === JSON.stringify(R[b].판정);
  const where = (a, b) => `${a}↔${b} ` + Object.keys(R[a].판정).filter(k => JSON.stringify(R[a].판정[k]) !== JSON.stringify(R[b].판정[k])).join('·') + ` (인구 ${R[a].판정.pop.인구} ↔ ${R[b].판정.pop.인구})`;
  test('E-SEED: help-places(시드 1) 이틀 lookSeed 1 ↔ 7 같음 · 하네스 시드 1 = 판 시드 · 프레임당 1틱 · 2틱 = 묶음(two-villages 도) · 시드 뺀 판은 lookSeed 따라 다름 · 끄면(판 규칙 · 도중) 옛 동작 · 시드 없는 판 길 0', () => {
    const bad = C.filter(c => !R[c.n] || R[c.n].오류); ok(!bad.length, '못 돎: ' + bad.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / '));
    const a = R.가1;
    ok(a.틱 === T && a.es.판시드 === 1 && a.es.줄기 === '판 시드' && a.es.틱머리 === true && a.es.틱머리맞춤 > 0, '(가) 판 시드 길이 안 돎 ' + JSON.stringify({ 틱: a.틱, es: a.es }));
    ok(a.판정.pop.인구 > 74, '(가) 이틀 동안 마을이 안 자람(시작 인구 74) — 견줄 것이 없는 헛 같음 ' + a.판정.pop.인구);
    ok(same('가1', '가7'), '(가) lookSeed 1 ↔ 7 판정 값이 다름(판정 코드가 Math.random 을 씀?) — ' + where('가1', '가7'));
    ok(same('가1', '도구') && R.도구.es.줄기 === '도구(__SIM_RAND)' && R.도구.es.판시드 === 1, '(가) 하네스 꼴(도구 시드 1)이 판 시드 1 줄기와 다름 — ' + where('가1', '도구'));
    ok(same('가1', '틱1') && same('가1', '틱2') && same('둘150', '둘1'), '(다) 프레임당 1틱 · 2틱 ↔ 묶음 150틱이 다름 — ' + [where('가1', '틱1'), where('가1', '틱2'), where('둘150', '둘1')].join(' / '));
    ok(!same('끔1', '끔150') && R.끔1.es.틱머리 === false, '(다) 양성 대조 — tickSync 를 끄면 1틱 ↔ 150틱이 갈려야 한다(안 갈리면 이 시험이 틱 머리 맞추기를 못 본다) ' + where('끔1', '끔150'));
    ok(!same('뺌1', '뺌7'), '(나) 시드 뺀 판인데 lookSeed 1 ↔ 7 이 같음 — 시드가 걸렸는지 못 가린다(같으면 7 → 8) ' + where('뺌1', '뺌7'));
    ok(R.뺌1.es.판시드 === null && R.뺌1.es.줄기 === 'Math.random' && R.뺌1.es.틱머리맞춤 === 0, '(나) 시드 뺀 판에서 엔진 길이 돎(판 시드 줄기 · 틱 머리 맞추기는 시드 판만) ' + JSON.stringify(R.뺌1.es));
    ok(same('뺌1', '규칙끔') && R.규칙끔.es.판시드 === null && R.규칙끔.es.켜짐 === false, '(나) 판 규칙 eseed 끔 ≠ 시드 뺀 판 — ' + where('뺌1', '규칙끔') + ' ' + JSON.stringify(R.규칙끔.es));
    ok(same('도중끔', '끔150') && R.도중끔.es.도중끔 === 1 && R.도중끔.es.판시드 === null && !same('도중끔1', '도중끔7'), '(나) 도중에 끄기(VRULES.eseed.on = false · 싣고 난 뒤) — 틱 머리 맞추기가 멎고(도구 시드 1 = tickSync 끔) 줄기가 옛 것(Math.random)으로 돌아와야 한다 '
      + [where('도중끔', '끔150'), where('도중끔1', '도중끔7'), JSON.stringify(R.도중끔.es)].join(' / '));
    ok(['farm', '기본'].every(n => R[n].es.판시드 === null && R[n].es.틱머리맞춤 === 0 && R[n].es.줄기 === '도구(__SIM_RAND)'), '(라) 시드 없는 판 · 기본 마을에서 엔진 길이 돎 ' + JSON.stringify([R.farm.es, R.기본.es]));
  });
}
/* [MAC-SIMCLOCK] 벽시계가 판정에 스미지 않나 — wallclock.mjs 로 벽시계를 일부러 빨리(부를 때마다 500ms) 돌려도 값이 같아야 한다.
   09-24 에 두 곳이 스몄다: 싣기 끝 첫 loop() 가 미리 돈 틱(부하 때 1~2틱) · 땅 고르기 '진짜 30초' 저절로 열기(pop88 이틀째 인구 94 → 92). load.mjs 가 벽시계를 멈춘다. */
test('벽시계를 흔들어도 판정 값이 같다 (pop88 · 2일 · 시드 1)', () => {
  const go = env => { const out = path.join(os.tmpdir(), 'village-sim-wall-' + process.pid + '-' + Math.random().toString(36).slice(2, 7) + '.json');
    const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--save', 'village/stages/boards/pop88.json', '--days', '2', '--seeds', '1', '--json', out], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
    if (r.status !== 0) throw new Error('run.mjs 실패: ' + (r.stderr || r.stdout).trim().split('\n').slice(-1)[0]); const j = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out, { force: true }); return j.results[0]; };
  const a = go({}), b = go({ NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --import=' + JSON.stringify(path.join(HERE, 'wallclock.mjs'))).trim() });
  const diff = []; a.samples.forEach((s, i) => Object.keys(s.m).forEach(k => { if (JSON.stringify(s.m[k]) !== JSON.stringify(b.samples[i] && b.samples[i].m[k])) diff.push(k + '@' + s.tick); }));
  ok(a.samples.length === b.samples.length && !diff.length, '벽시계가 판정에 스밈(performance.now·Date.now 를 판정이 읽나?): ' + diff.slice(0, 5).join(' '));
});
test('저장본이 그대로 열린다 (pop88 · 인구 88)', () => { ok(a1.samples[0].m.인구 === 88, '인구 ' + a1.samples[0].m.인구); });
test('한 수: 가게 하나 → 일 먼 집이 준다 · 선택 대비 표가 나온다', () => {
  const j = sim(['--save', 'village/stages/boards/pop88.json', '--days', '1', '--seeds', '1', '--watch', '일먼집', '--vs', '가게1: do=put shop @jobs 1']);
  const b = j.results.find(r => r.name === '기본'), v = j.results.find(r => r.name === '가게1');
  ok(v.moves[0].됨 === 1, '가게가 안 놓임'); ok(last(v).일먼집 < last(b).일먼집, `일먼집 ${last(b).일먼집} → ${last(v).일먼집}`);
  ok(/\| 가게1 \| 일먼집 \| \+\d/.test(j.text), '비교 표 줄이 없음');
});
/* [MAC-STAGEKINDS] 판 전용 종류(field·villtree…)가 든 저장본을 --stage 없이 돌리면 크게 알린다 · 판을 주면 조용하다 */
test('판 전용 종류 저장본 + --stage 빠짐 → ⚠ 경고 · --stage 주면 조용', () => {
  const run = extra => spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--save', 'village/stages/starts/origin.json', '--days', '1', '--seeds', '1', '--warm', '30', '--every', '600', ...extra], { cwd: ROOT, encoding: 'utf8' });
  const a = run([]), b = run(['--stage', 'origin']);
  ok(a.status === 0 && /⚠ '기본' — .*villtree\((?:[^)]*·)?origin(?:·[^)]*)?\)/.test(a.stderr) && /못 살린 것 \d+개/.test(a.stdout), '경고가 없음: ' + (a.stderr + a.stdout).slice(0, 200));
  ok(b.status === 0 && !/⚠/.test(b.stderr + b.stdout), '판을 줬는데 경고가 남');
});
/* [MAC-VSREF] 기준 ① 한 줄 도구가 돈다 — HEAD 의 village/ 를 풀어 옛 쪽으로 · 표가 나온다(작업 트리에 고친 것이 있어도 되게 --allow) */
test('vsref: HEAD 와 견주는 표가 나온다 (pop88 · 하루 · 시드 1)', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'vsref.mjs'), '--ref', 'HEAD', '--boards', '기본+village/stages/boards/pop88.json', '--days', '1', '--seeds', '1', '--allow'], { cwd: ROOT, encoding: 'utf8' });
  ok(r.status === 0, '끝값 ' + r.status + ' — ' + (r.stderr + r.stdout).trim().split('\n').slice(-2).join(' '));
  ok(/\| 기본\+pop88 \| \d+ \| /.test(r.stdout) && /판정: PASS/.test(r.stdout), '표·판정 줄이 없음');
});
/* [MAC-ROUNDTRIP] 저장 왕복 — 하루 돌려 내보내고 새 프로세스에서 다시 열어 같은 마을인가. 산(판 개울·처음 길의 다리 — MAC-STAGEKEEP) · farm(흐름 가짜 1일 점 — MAC-DAYLOAD) */
test('저장 왕복: 다시 열어도 같은 마을 (산 · farm · 하루)', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'roundtrip.mjs'), '--boards', 'mountain,farm', '--days', '1'], { cwd: ROOT, encoding: 'utf8' });
  ok(r.status === 0 && /판정: PASS/.test(r.stdout), '끝값 ' + r.status + ' — ' + r.stdout.split('\n').filter(l => /\*\*|판정/.test(l)).slice(0, 2).join(' '));
});
test('규칙 덮기: VRULES 에 없는 키는 멈춘다', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--days', '1', '--seeds', '1', '--rules', 'nope.on=false'], { cwd: ROOT, encoding: 'utf8' });
  ok(r.status !== 0 && /VRULES 에 없음/.test(r.stderr + r.stdout), '멈추지 않음');
});
/* [MAC-CAMP] PA-05 수업 판 멈춤(CAMP 뼈대 최소) — 판규칙 흰 목록 거르기 · 뜻 검사 · VRULES.camp · 멈춤 고리 둘(이사 = tryMoveIn · 층자람 = growHouse).
   자기 시험 판 = help-places 를 베껴 판규칙만 더함(시험 안에서 쓰고 finally 에서 지움) · 도구 시드 1 · hour=10 · 4일(하루 1800틱) · 날마다 [인구, 2층 이상 집 수].
   (가) 멈춤{이사 · 층자람} → 다섯 날 모두 첫날 값 · __campStats 이사막음 ≥ 1 · 층막음 ≥ 1
   (나) 양성 대조 — 판규칙 없는 help-places 는 4일에 인구 · 2층 이상이 는다(고리를 빼면 (가)가 이 값) · 같은 판을 VRULES.camp.on = false 로 열면 판규칙 없는 판과 판정 값이 같다(되돌리기)
   (다) 칸마다 따로 — 이사만: 인구 그대로 · 층은 오름 / 층자람만: 인구는 늚 · 2층 이상 그대로
   (라) campRead — 흰 목록 밖 키(멈쳄)는 버리고 적음(= 층자람만 판과 같은 값) · 뜻 없는 덮기는 적음(엔진은 씀 · 판 검사가 FAIL) · 판규칙 없는 판(farm) · 기본 마을은 CAMP 길 0
   (마) 조용한 이사(moveInQuiet — 보이는 사람이 120 상한에 찬 큰 마을)도 tryMoveIn 안에서만 → jobs-short(pop167 땅) 판규칙 없으면 하루에 늚 · 멈춤{이사}면 그대로 */
const cpOne = c => new Promise(done => {
  const src = `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import crypto from 'node:crypto';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${c.save ? `(await import('node:fs')).readFileSync(${JSON.stringify(path.join(ROOT, c.save))}, 'utf8')` : 'null'}, seed: 1, hash: 'hour=10', query: ${JSON.stringify(c.stage ? 'stage=' + c.stage : '')} });
${c.pre || ''}
const day = () => { const p = w.__pop(); return [p.인구, p.층[1] + p.층[2]]; }, days = [day()];
for (let d = 0; d < ${c.days}; d++) { w.__tickBench(1800); days.push(day()); }
const h = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12), { 저장키, ...s } = w.__snapshot();
process.stdout.write('@@' + JSON.stringify({ days, 사람: w.__pop().사람, cs: w.__campStats(), 판정: { pop: w.__pop(), away: w.__away(), goals: w.__goals().이룬것, 물건: h(s.물건), 집: h(s.집), 나머지: h(s) } }) + '\\n', () => process.exit(0));`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', src], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('close', () => { const l = out.split('\n').find(x => x.startsWith('@@')), e = (err || out).trim().split('\n');
    done(l ? JSON.parse(l.slice(2)) : { 오류: c.n + ' — ' + (e.filter(x => /Error|ERR/.test(x)).slice(-1)[0] || e.slice(-1)[0] || '출력 없음') }); }); });
{ const dir = path.join(ROOT, 'village/stages'), 바탕 = n => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')), 뜻 = '시험 판 — 새 이웃 · 층 오름을 세운다';
  const SELF = { 'zz-camp-both': ['help-places', { 멈춤: { 이사: true, 층자람: true, 뜻 } }], 'zz-camp-move': ['help-places', { 멈춤: { 이사: true, 뜻 } }],
    'zz-camp-floor': ['help-places', { 멈춤: { 층자람: true, 뜻 } }], 'zz-camp-typo': ['help-places', { 멈쳄: { 이사: true, 뜻 }, 멈춤: { 층자람: true } }],
    'zz-camp-quiet': ['jobs-short', { 멈춤: { 이사: true, 뜻 } }] };
  const C = [{ n: 'hp', stage: 'help-places' }, { n: 'both', stage: 'zz-camp-both' }, { n: 'off', stage: 'zz-camp-both', pre: 'w.VRULES.camp.on = false;' },
    { n: 'move', stage: 'zz-camp-move' }, { n: 'floor', stage: 'zz-camp-floor' }, { n: 'typo', stage: 'zz-camp-typo' },
    { n: 'js', stage: 'jobs-short', days: 1 }, { n: 'quiet', stage: 'zz-camp-quiet', days: 1 },
    { n: 'farm', stage: 'farm', days: 1 }, { n: '기본', stage: null, save: 'village/stages/boards/pop88.json', days: 1 }].map(c => ({ days: 4, ...c }));
  const R = {};
  Object.entries(SELF).forEach(([id, [b, 판규칙]]) => fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ ...바탕(b), id, 판규칙 }, null, 1)));
  try { const out = new Array(C.length); let next = 0;   /* 판 하나 = 프로세스 하나 — 여섯씩 나란히 */
    await Promise.all(Array.from({ length: Math.min(6, C.length) }, async () => { while (next < C.length) { const i = next++; out[i] = await cpOne(C[i]); } }));
    C.forEach((c, i) => { R[c.n] = out[i]; });
  } finally { Object.keys(SELF).forEach(id => fs.rmSync(path.join(dir, id + '.json'), { force: true })); }
  const J = JSON.stringify, flat = (r, i) => r.days.every(d => d[i] === r.days[0][i]), grew = (r, i) => r.days[r.days.length - 1][i] > r.days[0][i], show = n => n + ' ' + J(R[n].days);
  test('CAMP: 판규칙 멈춤{이사 · 층자람} → help-places 4일 인구 · 2층 이상 매일 같음(판규칙 없으면 둘 다 늚) · 이사막음 · 층막음 ≥ 1 · 칸마다 따로 · camp 끄면 판규칙 없는 판과 같음 · 흰 목록 밖 키는 버림 · 뜻 없음 적음 · 조용한 이사도 막힘 · 판규칙 없는 판 길 0', () => {
    const bad = C.filter(c => !R[c.n] || R[c.n].오류); ok(!bad.length, '못 돎: ' + bad.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / '));
    const { hp: base, both, off, move, floor, typo } = R;
    ok(J(base.days[0]) === J([74, 6]) && grew(base, 0) && grew(base, 1), '(나) 판규칙 없는 help-places 가 4일에 안 자람 — 견줄 것이 없는 헛 같음 ' + show('hp'));
    ok(flat(both, 0) && flat(both, 1) && J(both.days[0]) === J(base.days[0]), '(가) 멈춤{이사 · 층자람}인데 인구나 2층 이상이 움직임 ' + show('both') + ' · ' + show('hp'));
    ok(both.cs.이사막음 >= 1 && both.cs.층막음 >= 1 && J(both.cs.지금막음) === J(['이사', '층자람']) && J(both.cs.판규칙) === J(['멈춤']), '(가) 고리가 안 걸림 ' + J(both.cs));
    ok(J(off.days) === J(base.days) && J(off.판정) === J(base.판정) && off.cs.켜짐 === false && off.cs.이사막음 === 0 && off.cs.층막음 === 0, '(나) VRULES.camp.on = false 인데 판규칙 없는 판과 다름 ' + show('off') + ' · ' + J(off.cs));
    ok(flat(move, 0) && grew(move, 1) && move.cs.이사막음 >= 1 && move.cs.층막음 === 0, '(다) 이사만 멈춘 판 — 인구 그대로 · 층은 올라야 한다 ' + show('move') + ' ' + J(move.cs));
    ok(grew(floor, 0) && flat(floor, 1) && floor.cs.층막음 >= 1 && floor.cs.이사막음 === 0, '(다) 층자람만 멈춘 판 — 인구는 늘고 2층 이상은 그대로여야 한다 ' + show('floor') + ' ' + J(floor.cs));
    ok(J(typo.cs.모르는키) === J(['멈쳄']) && J(typo.cs.뜻없음) === J(['멈춤']) && J(typo.cs.판규칙) === J(['멈춤']) && J(typo.days) === J(floor.days) && J(typo.판정) === J(floor.판정),
      '(라) 흰 목록 밖 키 · 뜻 없음 — 멈쳄은 버리고(= 층자람만 판) 둘 다 적어야 한다 ' + show('typo') + ' ' + J(typo.cs));
    ok(R.js.사람 >= 120 && R.js.days[0][0] > R.js.사람 && grew(R.js, 0) && flat(R.quiet, 0) && J(R.quiet.days[0]) === J(R.js.days[0]) && R.quiet.cs.이사막음 >= 1,
      '(마) 조용한 이사 — jobs-short 는 보이는 사람이 상한에 찬 채 늘고(조용한 이사) 멈춤{이사}면 그대로여야 한다 ' + show('js') + ' 사람 ' + R.js.사람 + ' · ' + show('quiet') + ' ' + J(R.quiet.cs));
    ok(['farm', '기본'].every(n => R[n].cs.판규칙 === null && !R[n].cs.모르는키.length && R[n].cs.이사막음 === 0 && R[n].cs.층막음 === 0 && R[n].cs.켜짐 === true) && grew(R.기본, 0),
      '(라) 판규칙 없는 판 · 기본 마을(pop88 — 하루에 이웃이 듦)에서 CAMP 길이 돎 ' + J([R.farm.cs, R.기본.cs]) + ' ' + show('기본'));
  });
}
/* [MAC-CLOCK] PA-06 시계 쥐기 — 판규칙 멈춤.생산 · 멈춤.일자리 · 배속최대 · boot 쥠. 무화면(load.mjs)은 타이머가 없어 시작 카드가 영영 안 뜬다 →
   카드 동안 멈춤 · Space · ❓ 여는 조건 · 쥐는 이 겹침 · 4× 단추 · 모형 단추는 dcheck --scene start-card(진짜 크롬). 여기서는 판정 쪽과 쥠 셈만.
   자기 시험 판(시험 안에서 쓰고 finally 에서 지움): zz-clock-make = two-villages + 판규칙 멈춤.생산 · zz-clock-job = 시작 pop88 + 판규칙 멈춤.일자리 ·
   zz-clock-job0 = 같은 판 판규칙 없이 · zz-clock-speed = two-villages + 배속최대 2 · 시작 저장본 speed 4(starts/zz-clock-speed.json). 도구 시드 1 · 하루 1800틱.
   (가) 멈춤.생산 → 하루 __flow().만듦 0 · 생산막음 1 · 모형 생산멈춤 켜짐 / 양성 대조: two-villages 는 하루에 만듦 > 0
   (나) 멈춤.일자리 → 하루 __jobs().출근 0 · 출근막음 ≥ 1 · 배정은 그대로 셈(찬자리 > 0) / 양성 대조: zz-clock-job0 은 하루 출근 > 0 · 출근막음 0
   (다) 배속최대 2 + 저장본 speed 4 → 열 때 2(깎음 1) · __setSpeed(4) → 2 · 내보낸 clock.speed 2 / 칸 없는 판(help-places)은 4 그대로
   (라) boot 쥠 — 카드가 안 뜰 판(town)은 규칙 뒤 풂(쥔 [] · 쥠 1 · 풂 1) · 뜰 판(two-villages · help-places)은 쥔 ['boot'](무화면은 카드가 안 와 그대로) ·
       쥔 동안 __setSpeed 는 다시 쥠 · 저장은 풀린 뒤의 배속(쥔 멈춤을 0 으로 안 적음) · 기본 마을(pop88)은 쥠 0 · 배속최대 4 · __setSpeed(4) → 4 · 멈춤 false */
const clOne = c => new Promise(done => {
  const src = `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${c.save ? `(await import('node:fs')).readFileSync(${JSON.stringify(path.join(ROOT, c.save))}, 'utf8')` : 'null'}, seed: 1, hash: 'hour=10', query: ${JSON.stringify(c.stage ? 'stage=' + c.stage : '')} });
w.VRULES.speedQuiet.on = false;   /* 무화면엔 getComputedStyle 이 없다 — 배속 말 쉼 고리가 그것을 부른다(배속 셈과 무관) */
const 처음 = w.__clockHold(), f0 = w.__flow().만듦, j0 = w.__jobs().출근, 배속 = ${c.speed != null ? 'w.__setSpeed(' + c.speed + ')' : 'null'};
w.__tickBench(1800);
process.stdout.write('@@' + JSON.stringify({ 처음, 배속, 뒤: w.__clockHold(), 만듦: w.__flow().만듦 - f0, 출근: w.__jobs().출근 - j0, 찬자리: w.__jobs().찬자리, cs: w.__campStats(), 모형: w.__protoMap().생산멈춤, 저장: JSON.parse(w.__exportText()).clock }) + '\\n', () => process.exit(0));`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', src], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('close', () => { const l = out.split('\n').find(x => x.startsWith('@@')), e = (err || out).trim().split('\n');
    done(l ? JSON.parse(l.slice(2)) : { 오류: c.n + ' — ' + (e.filter(x => /Error|ERR/.test(x)).slice(-1)[0] || e.slice(-1)[0] || '출력 없음') }); }); });
{ const dir = path.join(ROOT, 'village/stages'), 바탕 = n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')), 뜻 = '시험 판 — 판 시계', made = [];
  const put = (f, o) => { fs.writeFileSync(path.join(dir, f), JSON.stringify(o, null, 1)); made.push(path.join(dir, f)); };
  const tv = 바탕('two-villages.json'), st = 바탕('starts/two-villages.json'), job = { id: 'zz-clock-job', 이름: '시험 판', 교과: null, 시작: 'stages/boards/pop88.json' };
  const C = [{ n: 'tv', stage: 'two-villages' }, { n: 'make', stage: 'zz-clock-make' }, { n: 'job0', stage: 'zz-clock-job0' }, { n: 'job', stage: 'zz-clock-job' },
    { n: 'speed', stage: 'zz-clock-speed', speed: 4 }, { n: 'hp', stage: 'help-places', speed: 4 }, { n: 'town', stage: 'town' }, { n: '기본', stage: null, save: 'village/stages/boards/pop88.json', speed: 4 }];
  const R = {};
  try { put('zz-clock-make.json', { ...tv, id: 'zz-clock-make', 판규칙: { 멈춤: { 생산: true, 뜻 } } });
    put('zz-clock-job.json', { ...job, 판규칙: { 멈춤: { 일자리: true, 뜻 } } }); put('zz-clock-job0.json', { ...job, id: 'zz-clock-job0' });
    put('starts/zz-clock-speed.json', { ...st, clock: { ...st.clock, speed: 4 } }); put('zz-clock-speed.json', { ...tv, id: 'zz-clock-speed', 시작: 'stages/starts/zz-clock-speed.json', 배속최대: 2 });
    const out = new Array(C.length); let next = 0;   /* 판 하나 = 프로세스 하나 — 여섯씩 나란히 */
    await Promise.all(Array.from({ length: Math.min(6, C.length) }, async () => { while (next < C.length) { const i = next++; out[i] = await clOne(C[i]); } }));
    C.forEach((c, i) => { R[c.n] = out[i]; });
  } finally { made.forEach(f => fs.rmSync(f, { force: true })); }
  const J = JSON.stringify;
  test('CLOCK: 판규칙 멈춤.생산 → 하루 만듦 0 · 멈춤.일자리 → 하루 새 출근 0(출근막음 ≥ 1 · 배정 그대로) · 배속최대 2 → 저장본 4 를 열 때 2 · __setSpeed(4) → 2 · 저장 2 · boot 쥠은 카드가 안 뜰 판에서 규칙 뒤 풂 · 판 칸 없는 판 · 기본 마을 그대로', () => {
    const bad = C.filter(c => !R[c.n] || R[c.n].오류); ok(!bad.length, '못 돎: ' + bad.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / '));
    const { tv: a, make, job0, job, speed, hp, town, 기본: base } = R;
    ok(a.만듦 > 0 && make.만듦 === 0 && make.cs.생산막음 === 1 && make.모형 === true && J(make.cs.지금막음) === J(['생산']),
      '(가) 멈춤.생산 — 하루 만듦 two-villages ' + a.만듦 + ' → 판규칙 ' + make.만듦 + ' ' + J({ 생산막음: make.cs.생산막음, 모형: make.모형, 지금막음: make.cs.지금막음 }));
    ok(job0.출근 > 0 && job0.cs.출근막음 === 0 && job.출근 === 0 && job.cs.출근막음 >= 1 && job.찬자리 > 0 && J(job.cs.지금막음) === J(['일자리']),
      '(나) 멈춤.일자리 — 하루 출근 판규칙 없음 ' + job0.출근 + ' → 판규칙 ' + job.출근 + ' ' + J({ 출근막음: job.cs.출근막음, 찬자리: job.찬자리 }));
    ok(speed.처음.배속 === 2 && speed.처음.배속최대 === 2 && speed.처음.깎음 === 1 && speed.배속.배속 === 2 && speed.저장.speed === 2,
      '(다) 배속최대 2 — 열 때 · __setSpeed(4) · 저장 ' + J({ 처음: speed.처음.배속, 깎음: speed.처음.깎음, 단추: speed.배속.배속, 저장: speed.저장 }));
    ok(hp.처음.배속최대 === 4 && hp.처음.깎음 === 0 && hp.배속.배속 === 4, '(다) 배속최대 칸 없는 판(help-places)이 깎임 ' + J({ 처음: hp.처음, 단추: hp.배속 }));
    ok(J(town.처음.쥔) === '[]' && town.처음.쥠 === 1 && town.처음.풂 === 1 && !town.처음.멈춤, '(라) 카드가 안 뜰 판(town)인데 boot 를 안 풂 ' + J(town.처음));
    ok(J(a.처음.쥔) === J(['boot']) && J(hp.처음.쥔) === J(['boot']) && hp.배속.멈춤 === true && hp.뒤.되쥠 === 1 && hp.저장.speed === 4,
      '(라) 카드가 뜰 판 — 카드까지 boot 쥠 · 쥔 동안 __setSpeed 는 다시 쥠 · 저장은 풀린 뒤 배속 ' + J({ tv: a.처음.쥔, hp: hp.처음.쥔, 단추: hp.배속, 되쥠: hp.뒤.되쥠, 저장: hp.저장 }));
    ok(J(base.처음.쥔) === '[]' && base.처음.쥠 === 0 && base.처음.배속최대 === 4 && base.배속.배속 === 4 && base.배속.멈춤 === false && base.cs.출근막음 === 0,
      '(라) 기본 마을(pop88)에서 판 시계가 돎 ' + J({ 처음: base.처음, 단추: base.배속 }));
  });
}

/* [MAC-FLOWEND] 53-ⓑ102 — 목표 없는 흐름 판(proto-flow)만 실험 값을 결과로 · 길을 끊으면 못 받은 집이 는다 · 다른 판은 안 씀 */
test('FLOWEND: proto-flow 결과 = 곡식·선반·못 받은 집 · 끊으면 못 받은 집이 는다 · farm/town3/proto-vote 는 안 씀', () => {
  const go = (query, body) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1, query: ${JSON.stringify(query)} });
const out = (() => { ${body} })(); process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error(query + ' 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const f = go('stage=proto-flow', `const a = w.__flowEnd(); w.__tickBench(600); w.__del(142, 140); w.__tickBench(1800); return { a, b: w.__flowEnd() };`);
  ok(f.a.쓰는판 && /^🌾 쌓인 곡식 \d+ · 🏪 선반 \d+ · 🏠 못 받은 집 0$/.test(f.a.지금) && /못 받은 집 [1-9]/.test(f.b.지금) && f.a.지금 !== f.b.지금, JSON.stringify(f));
  for (const s of ['farm', 'town3', 'proto-vote']) { const o = go('stage=' + s, 'return w.__flowEnd();'); ok(o.쓰는판 === false && o.지금 === null, s + ' ' + JSON.stringify(o)); }
});
/* [MAC-NOWATER] 물 끔 — 기본 마을은 필요 셋 · 옛 우물 숨김 · 목표 bench1 · 물을 켜면(needWater.on — 우물을 지키는 판은 3b 뒤 없음 · 판 규칙 needWater 로 켤 수 있음) 옛 넷 · 옛 저장본의 well 은 bench1 으로 이어진다 */
test('물 끔: 기본 마을 필요 셋 · 물을 켜면 옛 넷 · pop88 은 목표 bench1 을 잇는다', () => {
  const nw = (query, save, pre) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${save ? `fs.readFileSync(${JSON.stringify(path.join(ROOT, save))}, 'utf8')` : 'null'}, seed: 1, query: ${JSON.stringify(query)} });
${pre ? pre + ' w.__tickBench(1);' : ''}
process.stdout.write('@@' + JSON.stringify(w.__needWater()) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8' });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('__needWater 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const a = nw(''), b = nw('', null, 'w.VRULES.needWater.on = true;'), c = nw('', 'village/stages/boards/pop88.json');
  ok(a.필요.join() === '장보기,놀이,쉼' && a.돌아섬필요.join() === '장보기,놀이,쉼', '기본 필요 ' + a.필요.join());
  ok(a.우물.필요 === null && a.우물.묶음 === '(숨김)' && a.분수 === '쉼' && a.연못.join() === '쉼,', '우물·분수·연못 ' + JSON.stringify([a.우물, a.분수, a.연못]));
  ok(a.목표.join() === 'bench1' && a.말.셋멀.startsWith('두 가지 더') && a.말.점.join() === '○○,●○,●●', '목표·말 ' + JSON.stringify([a.목표, a.말]));
  ok(!b.물끔 && b.필요.join() === '물,장보기,놀이,쉼' && b.목표.join() === 'well' && b.말.셋멀.startsWith('하나만 더'), '물 켬 ' + JSON.stringify(b.필요));
  ok(c.이음 === true && c.목표이음 === 1, 'pop88 이음 ' + c.이음);
});

/* [MAC-VOTEKEEP] · [MAC-STAGEKEEP] ④ — proto-vote 에서 적용한 의원은 다시 열어도 그 자리에 있고, 적용 상태·두 안의 값도 같다(옛 틈 · 09-26) */
test('결정 다시 열기: proto-vote A 적용 → 다시 열면 의원 그대로 · 적용 A · 두 안 값 같음 · 또 적용 안 됨', () => {
  const run = (save, body) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${save ? `fs.readFileSync(${JSON.stringify(save)}, 'utf8')` : 'null'}, seed: 1, query: 'stage=proto-vote' });
const out = (() => { ${body} })(); process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const tf = path.join(os.tmpdir(), 'village-sim-test-vote-' + process.pid + '.json');
  const a = run(null, `const A = w.__votePreview('A').집별, B = w.__votePreview('B').집별; const r = w.__voteApply('A'); w.__tickBench(5); return { A, B, 적용: w.__voteKeep().적용, t: w.__exportText() };`);
  fs.writeFileSync(tf, a.t);
  const b = run(tf, `const k = w.__voteKeep(); return { s: w.__START, k, A: w.__votePreview('A').집별, B: w.__votePreview('B').집별, 또: w.__voteApply('B'), 칸: w.__stream(137, 102).칸.종류 };`);
  fs.rmSync(tf, { force: true });
  ok(a.적용 === 'A', '첫 적용 ' + a.적용);
  ok(!/못 살린/.test(b.s) && b.칸 === 'clinic' && b.k.결정시설되살림 === 1, '다시 열면 의원 ' + JSON.stringify([b.s, b.칸, b.k]));
  ok(b.k.적용 === 'A' && b.k.되찾음 === 1 && JSON.stringify(b.k.표) === '["A","B"]', '적용 되찾음 ' + JSON.stringify(b.k));
  ok(JSON.stringify(b.A) === JSON.stringify(a.A) && JSON.stringify(b.B) === JSON.stringify(a.B), '두 안 값이 다름 ' + JSON.stringify({ a: [a.A, a.B], b: [b.A, b.B] }).slice(0, 300));
  ok(b.또 === '이미 적용했어요', '또 적용 ' + JSON.stringify(b.또));
});
/* [MAC-NOWATER] 문 앞 팻말 — 아이콘이 없는 부족(배움 · 정원)은 팻말을 세우지 않는다(전엔 '물' 방울로 떨어졌다 · 보스 #1064 검토) */
test('물 끔: city 기다리는 집의 부족이 배움이면 팻말 0 · 장보기면 팻말', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: fs.readFileSync(${JSON.stringify(path.join(ROOT, 'village/stages/boards/pop88.json'))}, 'utf8'), seed: 1, query: 'stage=city' });
w.__tickBench(300); process.stdout.write('@@' + JSON.stringify({ 물: w.__needWater().물끔, 배움: w.__waitSignTry('배움'), 장보기: w.__waitSignTry('장보기') }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8' });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); ok(l, '훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); const j = JSON.parse(l.slice(2));
  ok(j.물 === true && j.배움.집 != null, '물 끔 city 에 기다리는 집이 없음 ' + JSON.stringify(j));
  ok(j.배움.팻말부위 === 0 && j.장보기.팻말부위 > 0, '팻말 ' + JSON.stringify(j));
});

/* [MAC-BUBBLEHELP] 풍선 뜻 · 이사 규칙(사용자 09-26) — 빈 집을 누르면 규칙 그대로 · 카드 숫자는 코드 값 · 끄면 옛 말 */
test('풍선 뜻: pop88 빈 집 말 = "새 가족은 … 중 둘이 가까우면 와요 — 지금 …" · 카드에 10명·20명·6칸 · 끄면 옛 말', () => {
  const go = (pre) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: fs.readFileSync(${JSON.stringify(path.join(ROOT, 'village/stages/boards/pop88.json'))}, 'utf8'), seed: 1, query: '' });
${pre || ''} w.__tickBench(300); const t = []; for (let y = 90; y < 170; y++) for (let x = 90; x < 170; x++) { if (w.__stream(x, y).칸.종류 !== 'house') continue; const why = w.__why(x, y); if (why !== true && !t.includes(why)) t.push(why); }
const T = w.__sim().t, folk = [w.__bhFolk({ whyShow: '장보기', whyUntil: T + 4000 }), w.__bhFolk({ whyShow: '장보기', whyUntil: T - 1 })];
process.stdout.write('@@' + JSON.stringify({ t, 카드: w.__bubbleHelp().글, 일: w.__bhRule(['일자리']), folk, T }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const a = go(''), b = go('w.VRULES.bubbleHelp.on = false;');
  ok(a.t.some(x => /^새 가족은 가게·놀이터·긴의자 중 둘이 가까우면 와요 — 지금 가게 [✓✗] · 놀이터 [✓✗] · 긴의자 [✓✗]/.test(x)), '빈 집 말 ' + JSON.stringify(a.t));
  ok(/^주민 20명부터는 일할 곳/.test(a.일), '일할 곳 말 ' + a.일);
  ok(/주민 10명부터/.test(a.카드[2]) && /주민 20명부터/.test(a.카드[2]) && /6칸/.test(a.카드[2]) && /14칸/.test(a.카드[3]), '카드 숫자 ' + JSON.stringify(a.카드));
  ok(!b.t.some(x => /^새 가족은/.test(x)) && b.t.some(x => /가까이 있으면 이웃이 와요/.test(x)), '끄면 옛 말 ' + JSON.stringify(b.t));
  /* (10-03 엔진 검토) ① 주민 풍선 뜻은 시뮬 시각 — 저장본 마을(SIM.t 큼)에서 지난 풍선은 빈 말 ② 빈 집 규칙 문구도 귀띔 톤 정규식에 걸림 ③ 판이 끈 묶음(onebridge: 일자리 · 붐빔)은 카드가 말하지 않음 */
  ok(a.T > 1e6 && /^머리 위 .*가게가 멀어요/.test(a.folk[0]) && a.folk[1] === '', '풍선 뜻 시계 ' + JSON.stringify({ T: a.T, folk: a.folk }));
  const tone = fs.readFileSync(path.join(ROOT, 'village/index.html'), 'utf8').match(/\/\^빈집이에요 · \.\*\(([^)]+)\)\//);
  ok(tone, '빈 집 귀띔 톤 정규식을 못 찾음'); const re = new RegExp('^빈집이에요 · .*(' + (tone ? tone[1] : '') + ')');
  const rule = [...a.t.filter(x => /^(새 가족은|주민 \d+명부터)/.test(x)), a.일];   /* 이 PR 의 규칙 문구만(꽉 찬 집 '이 집은 꽉 찼어요' 같은 사는 집 말은 빈 집 토스트가 아님) */
  ok(rule.length >= 2 && rule.every(x => re.test('빈집이에요 · ' + x)), '귀띔 톤에 안 걸리는 빈 집 규칙 말 ' + JSON.stringify(rule.filter(x => !re.test('빈집이에요 · ' + x))));
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1, query: 'stage=onebridge' });
w.__tickBench(300); process.stdout.write('@@' + JSON.stringify({ 끔: w.__stageOff().끈묶음, 카드: w.__bubbleHelp().글 }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); ok(l, 'onebridge 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); const o = l ? JSON.parse(l.slice(2)) : { 끔: [], 카드: [] };
  ok(o.끔.includes('일자리') && o.끔.includes('붐빔') && !o.카드.some(x => /💼|일할 곳|🚶/.test(x)) && a.카드.some(x => /💼/.test(x)) && a.카드.some(x => /🚶/.test(x)), '판이 끈 묶음을 카드가 말함 ' + JSON.stringify(o));
});
/* [MAC-HEALTH] 건강 — 인구 100 이면 켜지고 저장 칸 건강:1 로 다시 열어도 · 판 규칙이 없는 수업 판(jobs-short)·물을 켠 마을(needWater.on)은 없음 · 규칙을 적은 수업 판(onebridge · PR 3b)은 있음 · 판 규칙으로 켜는 판(town3 · proto-vote — PR 3a)은 처음부터 · 스위치를 끄면 없음 */
test('건강: pop167 은 50틱 뒤 건강 · 다시 열어도 · jobs-short·물 켬은 없음 · onebridge(규칙)·town3·proto-vote 는 있음 · 끄면 없음', () => {
  const hl = (query, save, pre, ticks) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${save ? `fs.readFileSync(${JSON.stringify(path.isAbsolute(save) ? save : path.join(ROOT, save))}, 'utf8')` : 'null'}, seed: 1, query: ${JSON.stringify(query)} });
${pre || ''}
if (${ticks | 0} > 0) w.__tickBench(${ticks | 0});
process.stdout.write('@@' + JSON.stringify({ h: w.__health(), t: w.__exportText() }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('__health 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const P = 'village/stages/boards/pop167.json', tf = path.join(os.tmpdir(), 'village-sim-test-health-' + process.pid + '.json');
  const a = hl('', null, '', 0), b = hl('', P, '', 50); fs.writeFileSync(tf, b.t);
  const c = hl('', tf, '', 0), d = hl('stage=jobs-short', null, '', 50), g1 = hl('stage=onebridge', null, '', 50), e = hl('', null, 'w.VRULES.needWater.on = true;', 1), f = hl('', P, 'w.VRULES.health.on = false;', 50), g = hl('stage=town3', null, '', 0), v = hl('stage=proto-vote', null, '', 0); fs.rmSync(tf, { force: true });
  ok(a.h.필요.join() === '장보기,놀이,쉼' && a.h.돌아섬필요.join() === '장보기,놀이,쉼' && a.h.의원.필요 === '건강' && a.h.의원.트레이 && a.h.의원.해금 === 80, '빈 땅 ' + JSON.stringify(a.h.의원));
  ok(b.h.걸쇠 && b.h.필요.join() === '장보기,놀이,쉼,배움,건강' && b.h.의원.열림 && /"건강":\s*1/.test(b.t), 'pop167 ' + b.h.필요.join());
  ok(c.h.걸쇠 && c.h.필요.join() === '장보기,놀이,쉼,배움,건강' && c.h.되살림 === 1, '다시 열기 ' + c.h.필요.join());
  ok(!d.h.제공 && !d.h.필요.includes('건강'), 'jobs-short ' + d.h.필요.join());
  ok(g1.h.제공 && g1.h.필요.includes('건강'), 'onebridge(규칙 health) ' + g1.h.필요.join());
  ok(!e.h.제공 && e.h.필요.join() === '물,장보기,놀이,쉼' && e.h.의원.필요 === null, '물 켬 ' + e.h.필요.join());
  ok(g.h.제공 && g.h.걸쇠 && g.h.필요.join() === '장보기,놀이,쉼,건강' && g.h.의원.열림 && g.h.의원.트레이 && g.h.걸쇠켬 === 1, 'town3 ' + g.h.필요.join());
  ok(v.h.제공 && v.h.걸쇠 && v.h.필요.join() === '장보기,놀이,쉼,건강' && !v.h.의원.트레이, 'proto-vote ' + JSON.stringify(v.h.의원));
  ok(!f.h.제공 && !f.h.걸쇠 && !/"건강"/.test(f.t) && !/"clinic"/.test(f.t) && f.h.의원.필요 === null && !f.h.의원.트레이, '끔 ' + f.h.필요.join() + ' · clinic 해금 남음? ' + /"clinic"/.test(f.t));
});

/* [MAC-HEALTH] 도중에 끄기 — 인구 80 을 넘으며 checkUnlocks 가 연 의원 해금도 되돌린다(origin 시작 땅에서 80 줄을 잠가 두고 · 보스 #1085 검토) */
test('건강: 인구 80 에 열린 의원 해금도 도중에 끄면 저장 글에서 빠진다(origin)', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(ROOT, 'village/stages/starts/origin.json'))}, 'utf8')); d.unlocked = d.unlocked.filter(k => !['green', 'sbridge', 'station', 'clinic'].includes(k)); d.palette = d.palette.map(k => k === 'clinic' ? 'field' : k);   /* 원본 7차(PR 3b)는 의원 넷이 놓여 있어 해금이 처음부터 열린다 — 의원 없는 원본으로(같은 2×2 밭으로 바꿔 둔다) */
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: JSON.stringify(d), seed: 1, query: 'stage=origin' });
const a = w.__health().의원.열림; let n = 0; while (!w.__health().의원.열림 && n < 60) { w.__tickBench(100); n++; }
const b = w.__health().의원.열림; w.VRULES.health.on = false; w.__tickBench(5);
process.stdout.write('@@' + JSON.stringify({ a, b, 틱: n * 100, 인구80: w.__unlocked().includes('station'), 끈뒤: /"clinic"/.test(w.__exportText()) }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); ok(l, '훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); const j = JSON.parse(l.slice(2));
  ok(j.a === false && j.b === true && j.인구80, '인구 80 에 의원이 안 열림 ' + JSON.stringify(j));
  ok(j.끈뒤 === false, '끈 뒤에도 clinic 해금이 저장 글에 남음 ' + JSON.stringify(j));
});

/* [MAC-STAGEHINT] 창조자 51회 ⓑ101 · ⓑ100 — onebridge: 목표판엔 판 목표만(판 목표를 이루면 기본 목표가 다시) · 개울 건너 집 말 끝은 도서관 대신 판의 권유 · 누르면 다리 자리 셋 · 빈 끝 다리는 '빈 끝' 셈 */
test('onebridge 판 목표만 · 권유(🌉 · 📚 없음 · 자리 셋) · 다리 빈 끝 셈 · 이루면 기본 목표·권유 끝', () => {
  const go = (query, body) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1, query: ${JSON.stringify(query)} });
const out = (() => { ${body} })(); process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error(query + ' 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const o = go('stage=onebridge', `w.__tickBench(300); const g0 = w.__goals().지금목표, t0 = w.__houseText(152, 145), s0 = w.__where(152, 145).짚을칸;
  w.__put('road', 151, 138, 0); const e = w.__stageHint(151, 138); w.__undo(); w.__put('road', 151, 147, 0); const f = w.__stageHint(151, 147); w.__tickBench(900);
  return { g0, t0, s0, e: e.빈끝, f: f.빈끝, 판: w.__stage().목표[0][1], g1: w.__goals().지금목표.length, t1: w.__houseText(152, 145), 권유: w.__stageHint().판권유 };`);
  ok(o.g0.length === 1, '판 목표만 아님 ' + JSON.stringify(o.g0));
  ok(/🌉/.test(o.t0) && !/📚/.test(o.t0), '집 말 ' + o.t0);
  ok(JSON.stringify(o.s0) === '[[151,147],[151,144],[151,150]]', '짚을 칸 ' + JSON.stringify(o.s0));
  ok(o.e === 2 && o.f === 0, '빈 끝 ' + JSON.stringify([o.e, o.f]));
  ok(o.판 === true && o.g1 === 3 && o.권유 === null && !/🌉/.test(o.t1), '이룬 뒤 ' + JSON.stringify({ 판: o.판, g1: o.g1, 권유: o.권유, t1: o.t1 }));
  /* 길을 끄는 중 잇기 검사 미룸 — 끌다 멈춰 반쪽 길로 먼저 검사하면 뗀 뒤 거짓 '🛣️ 이어졌어요'(엔진 검토 10-03 · pop88 빈 줄 128~136,96) · 대조: 끄는 상태 없이 같은 수 */
  const rj = drag => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: fs.readFileSync(${JSON.stringify(path.join(ROOT, 'village/stages/boards/pop88.json'))}, 'utf8'), seed: 1, query: '' });
w.__tickBench(300); if (${drag}) w.__roadJoinDrag(true); for (let x = 128; x <= 132; x++) w.__put('road', x, 96, 0); const mid = w.__roadJoinNow();
for (let x = 133; x <= 136; x++) w.__put('road', x, 96, 0); if (${drag}) w.__roadJoinDrag(false); const end = w.__roadJoinNow();
process.stdout.write('@@' + JSON.stringify({ mid: [mid.말함, mid.이음말], end: [end.말함, end.이음말], 미룸: w.__stageHint().끄는중미룸 }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('길 끌기 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const d = rj(true), u = rj(false);
  ok(d.mid.join() === '0,0' && d.end.join() === '1,0' && d.미룸 >= 1, '끄는 중 검사 ' + JSON.stringify(d));
  ok(u.mid.join() === '1,0' && u.end.join() === '1,1', '대조(끄는 상태 없음)가 거짓 이어졌어요를 안 냄 — 시험이 가려내지 못함 ' + JSON.stringify(u));
});

/* [MAC-STAGEKEEP] ③ 옛 우물 · PR 3a proto-vote — 목록에서 뺀 우물도 되살아나고 옮기기·되돌리기가 된다(새로 고르는 길은 트레이 숨김) · 결정 시설 의원의 미리 보기 = 적용 */
test('PR 3a: proto-flow 옛 우물 둘 되살림 · 지운 뒤 ↩ 로 살아남 · proto-vote 의원 미리 보기 = 적용', () => {
  const go = (query, body) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1, query: ${JSON.stringify(query)} });
const out = (() => { ${body} })(); process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error(query + ' 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const f = go('stage=proto-flow', `const s = w.__START; const k = w.__stageKeep().옛우물, g = w.__needWater().우물.묶음; const kind = () => w.__stream(134, 138).칸.종류; const 전 = kind(); w.__erase(134, 138); const 지움 = kind(); w.__undo(); return { s, k, g, 전, 지움, 되돌림: kind() };`);
  ok(!/못 살린/.test(f.s) && f.k === 2 && f.g === '(숨김)', 'proto-flow 옛 우물(되살림 · 트레이 숨김) ' + JSON.stringify(f));
  ok(f.전 === 'well' && f.지움 === null && f.되돌림 === 'well', '옛 우물을 지운 뒤 ↩ 로 못 살림 ' + JSON.stringify(f));
  const pv = id => go('stage=proto-vote', `const p = w.__votePreview('${id}'), a = w.__voteApply('${id}'); return { 필요: w.__vote().필요, 막음: w.__put('clinic', 137, 102, 0), p: p.집별, a: a && a.집별 };`);
  const A = pv('A'), B = pv('B');
  ok(A.필요 === '건강' && /쓰지 않아요/.test(String(A.막음)), 'proto-vote 필요·막음 ' + JSON.stringify([A.필요, A.막음]));
  ok(A.p && JSON.stringify(A.p) === JSON.stringify(A.a) && B.p && JSON.stringify(B.p) === JSON.stringify(B.a), '미리 보기 ≠ 적용 ' + JSON.stringify({ A, B }).slice(0, 300));
});

/* [MAC-GOALLIVE] 목표판 '지금 n / m' — 길 곁 밭을 놓으면 1초(10틱) 안에 2 → 3 · 먼 밭은 그대로 · 목표판을 통째로 다시 그리지 않는다(창조자 61회 ⓑ106) */
test('목표판 지금 값: farm+mid36 길 곁 밭 → 1초 안에 3 / 4 · 먼 밭은 2 그대로 · 통째 0', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: fs.readFileSync(${JSON.stringify(path.join(ROOT, 'village/stages/boards/mid36.json'))}, 'utf8'), seed: 1, hash: 'hour=10', query: 'stage=farm' });
w.__tickBench(120); const a = w.__goalLive(); w.__put('field', 147, 127, 0); w.__tickBench(10); const b = w.__goalLive(); w.__put('field', 138, 153, 0); w.__tickBench(10); const c = w.__goalLive();
process.stdout.write('@@' + JSON.stringify({ a, b, c, u: w.__usable('field').쓸수있는 }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8' });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); ok(l, '__goalLive 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); const j = JSON.parse(l.slice(2));
  ok(j.a.보이는글 && j.a.보이는글[0] === '· 지금 2 / 4개' && j.b.보이는글[0] === '· 지금 2 / 4개' && j.b.고쳐씀 === 0, '먼 밭 ' + JSON.stringify([j.a, j.b]));
  ok(j.u === 3 && j.c.보이는글[0] === '· 지금 3 / 4개' && j.c.고쳐씀 === 1 && j.c.다시그림 === 0, '길 곁 밭 ' + JSON.stringify(j.c));
});
/* [MAC-NOUSE-2] 쓸수있는 목표 종류를 못 쓰는 자리에 놓으면 한 줄 — 불러오는 동안은 조용 · 먼 밭 → '길 옆에' · 둘째는 쉼 · 길 곁 밭은 조용 */
test('못 쓰는 자리 한 줄: farm 먼 밭 → 길 옆에 · 둘째 먼 밭 → 쉼 · 길 곁 밭 → 조용 · 불러오는 동안 → 조용', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: fs.readFileSync(${JSON.stringify(path.join(ROOT, 'village/stages/boards/mid36.json'))}, 'utf8'), seed: 1, query: 'stage=farm' });
w.__put('field', 147, 127, 0); const a = w.__noUseSay().말함; w.__tickBench(1); w.__LOADMS = 1;
w.__put('field', 150, 120, 0); const b = w.__noUseSay(); w.__put('field', 153, 120, 0); const c = w.__noUseSay(); w.__put('field', 138, 153, 0); const d = w.__noUseSay();
process.stdout.write('@@' + JSON.stringify({ a, b, c, d, 못씀: w.__usable('field').못쓰는자리.length }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); ok(l, '훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); const j = JSON.parse(l.slice(2));
  ok(j.a === 0, '불러오는 동안 말함 ' + j.a);
  ok(j.b.말함 === 1 && /^밭은 길 옆에 있어야 주민이 쓸 수 있어요/.test(j.b.마지막), '먼 밭 ' + JSON.stringify(j.b));
  ok(j.c.말함 === 1 && j.c.쉼 === 1, '둘째 먼 밭 ' + JSON.stringify(j.c));
  ok(j.d.말함 === 1 && j.d.쉼 === 1 && j.못씀 === 3, '길 곁 밭 ' + JSON.stringify(j));
});
/* [MAC-WAITCHIPSAY] 🏠 칩 말 = 그 집을 눌렀을 때의 말 · 빈 그림 없음 */
test('🏠 칩 말 = 그 집을 눌렀을 때 말 · 빈 그림 없음 (pop88 · farm+mid36)', () => {
  const tap = (query, save) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: fs.readFileSync(${JSON.stringify(path.join(ROOT, save))}, 'utf8'), seed: 1, query: ${JSON.stringify(query)} });
w.__tickBench(300); process.stdout.write('@@' + JSON.stringify([w.__waitHomesTap(), w.__waitHomesTap()]) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8' });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('__waitHomesTap 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const a = tap('', 'village/stages/boards/pop88.json'), b = tap('stage=farm', 'village/stages/boards/mid36.json');
  [...a, ...b].forEach(t => { ok(t.말 && t.말.endsWith(' · ' + t.집말), '칩 말 ≠ 집 말: ' + JSON.stringify(t)); ok(!/—\s+중에/.test(t.말), '빈 그림: ' + t.말); });
  ok(/^🏠 이 동네 18채 · (하나만 더|새 가족은)/.test(a[0].말), 'pop88 첫 동네 ' + a[0].말);   /* '새 가족은 …' = [MAC-BUBBLEHELP] 가 waitSayJob 을 규칙 문구로 바꾼 뒤 */
});
/* [MAC-JOBVACANT] 빈 일자리 💼 — 일할 어른이 없으면 안 띄움(origin: 옛 5 → 0) · 일할 어른이 있으면 그 집 가까운 빈 자리에만(pop88 에 길이 끊긴 가게 — 멀면 안 띄움 · near 를 넓히면 띄움) */
test('빈 자리 💼: origin 은 일할 어른 0 이라 안 띄움(끄면 옛 모습) · pop88 끊긴 가게는 가까울 때만', () => {
  const go = (query, save, body) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${save ? `fs.readFileSync(${JSON.stringify(path.join(ROOT, save))}, 'utf8')` : 'null'}, seed: 1, query: ${JSON.stringify(query)} });
const out = (() => { ${body} })(); process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error(query + ' 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const a = go('stage=origin', null, `w.__tickBench(600); const on = w.__jobVacant(); w.VRULES.jobVacant.on = false; return { on, off: w.__jobVacant() };`);
  ok(a.on.일없는어른 === 0 && a.on.빈자리 > 0 && a.on.띄움.length === 0 && a.off.띄움.length > 0, 'origin ' + JSON.stringify([a.on.띄움.length, a.off.띄움.length, a.on.빈자리]));
  const b = go('', 'village/stages/boards/pop88.json', `w.__tickBench(200); w.__put('road', 128, 110, 0); w.__put('shop', 129, 110, 0); w.__tickBench(400); const near = w.__jobVacant(); w.VRULES.jobVacant.near = 400; return { near, far: w.__jobVacant() };`);
  ok(b.near.일없는어른 > 0 && b.near.빈자리 > 0 && !b.near.띄움.includes('shop@129,110') && b.far.띄움.includes('shop@129,110'), 'pop88 끊긴 가게 ' + JSON.stringify(b));
  /* 첫 배정 바퀴 전 창 — 열고 틱 30~110(3~11초)에 옛 셈을 믿어 빈 자리마다 💼 가 떴다(origin 18 · pop88 7 · 엔진 검토 10-03) */
  const win = `const n = []; w.__tickBench(30); for (let t = 30; t <= 110; t += 10) { n.push(w.__jobVacant().띄움.length); w.__tickBench(10); } return n;`;
  const c = go('stage=origin', null, win), d = go('', 'village/stages/boards/pop88.json', win);
  ok(c.every(n => n === 0) && d.every(n => n === 0), '열고 3~11초 💼 ' + JSON.stringify({ origin: c, pop88: d }));
});

/* [MAC-TRAY] PA-01 판 칸 `트레이` — 자기 시험 판 = nohealth 를 베껴 `트레이: []` + 결정 칸(시험 안에서 쓰고 finally 에서 지운다).
   놓기 · 옮기기 · 치우기 모드 누름(오른쪽 누름 · 메뉴 치우기도 같은 keepGuard 길)이 막히고, 되살리기 · 되돌리기 · 결정 적용은 지난다 · 트레이 판은 값 줄 숨김 · 트레이 칸 없는 nohealth 는 그대로.
   끌어 치우기(sweepCell) · 길게 누름(holdOpen) · 오른쪽 누름(rcErase)은 __trayTry 로 실제 손 함수를 불러 잰다(칸이 그대로인가 · 손말이 났나).
   되살리기는 '구경 되살림'으로 잰다 — 부팅 때 되살리기는 판 고리가 붙기 전에 돌아(module 끝) 막힐 일이 없다. 양성 대조 = 스위치를 끄면 같은 수가 그대로 된다. */
const trayGo = (query, body, saveText) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${JSON.stringify(saveText == null ? null : saveText)}, seed: 1, query: ${JSON.stringify(query)} });
const n = k => w.__snapshot().물건.filter(t => t.startsWith(k + '@')).length, tap = (x, y) => { const p = w.__cellScreen(x, y); if (p) w.__click(p[0], p[1]); return !!p; };
const seen = (k, m) => w.__snapshot().물건.filter(t => t.startsWith(k + '@')).map(t => t.slice(k.length + 1).split(/[,/]/).slice(0, 2).map(Number)).filter(([x, y]) => w.__cellScreen(x, y)).slice(0, m || 2);
const out = (() => { ${body} })(); process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 27 });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error(query + ' 훅 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
const trayStage = (id, base, extra) => { const f = path.join(ROOT, 'village/stages', id + '.json'); fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(ROOT, 'village/stages', base + '.json'), 'utf8')), ...extra, id }, null, 1)); return f; };
const 손 = '✋ 이번엔 옮기거나 치우지 않아요';
test('트레이: 트레이 [] 판 놓기·옮기기·치우기(누름 · 오른쪽 누름 · 끌기 · 길게 누름) 막힘 · 되살리기·되돌리기·결정 적용 통과 · 값 줄 숨김 · nohealth 그대로 · 끄면 풀림', () => {
  const SELF = 'zz-tray-selftest', file = path.join(ROOT, 'village/stages', SELF + '.json');
  const def = JSON.parse(fs.readFileSync(path.join(ROOT, 'village/stages/nohealth.json'), 'utf8'));
  Object.assign(def, { id: SELF, 트레이: [], 결정: { on: true, 시설: 'clinic', 이름: '동네 의원', 필요: '건강',
    동네: [{ 이름: '서쪽', 집: [[112, 130], [112, 136], [115, 130], [115, 136], [118, 130]], 의견: '시험' }, { 이름: '동쪽', 집: [[121, 130], [121, 136], [124, 130], [124, 136]], 의견: '시험' }],
    후보: [{ id: 'A', 이름: 'A 자리', 자리: [109, 136], rot: 0 }, { id: 'B', 이름: 'B 자리', 자리: [125, 140], rot: 0 }] } });
  const go = trayGo, fileD = trayStage('zz-tray-noclinic', 'nohealth', { 규칙: {}, 트레이: ['road', 'clinic'] }), fileF = trayStage('zz-tray-fence', 'nohealth', { 트레이: ['road', 'fence'] });
  fs.writeFileSync(file, JSON.stringify(def, null, 1));
  try {
    const a = go('stage=' + SELF, `const ORDER수 = Object.keys(w.__placeRules().놓는법).length, put = w.__put('clinic', 109, 136, 0), carry = w.__carry(112, 130), t1 = w.__tray();
  w.__mode(null, 'erase'); const 누름 = tap(112, 130); w.__mode(null, null); const 집 = w.__stream(112, 130).칸.종류, 지킴 = w.__keep().막음;
  const er = w.__erase(115, 130); w.__undo(); const 되돌림 = w.__stream(115, 130).칸.종류;
  const c0 = n('clinic'), v = w.__voteApply('A'), c1 = n('clinic'), carry2 = w.__carry(109, 136);
  const [t0, t2] = seen('tree'), 손들 = { 끌기: w.__trayTry('sweep', ...t0), 메뉴: w.__trayTry('hold', 112, 130), 오른쪽: w.__trayTry('erase', ...t2) };
  const vis = w.__visitLoad(JSON.parse(w.__exportText())), t = w.__tray(); w.VRULES.stageTray.price = false;
  return { ORDER수, put, carry, t1, 누름, 집, 지킴, er, 되돌림, c0, v: typeof v === 'string' ? v : 'ok', c1, carry2, 손들, vis, t, 값끔: w.__tray().값숨김규칙 };`);
    const b = go('stage=' + SELF, `w.VRULES.stageTray.on = false; const put = w.__put('clinic', 109, 136, 0), carry = w.__carry(112, 130); w.__drop(112, 130);
  w.__mode(null, 'erase'); tap(112, 130); w.__mode(null, null); const 지킴 = w.__keep().막음, vis = w.__visitLoad(JSON.parse(w.__exportText()));
  return { put, carry, 지킴, vis, t: w.__tray() };`);
    b.손들 = go('stage=' + SELF, `w.VRULES.stageTray.on = false; const [t0, t2] = seen('tree'); return { 메뉴: w.__trayTry('hold', 112, 130), 끌기: w.__trayTry('sweep', ...t0), 오른쪽: w.__trayTry('erase', ...t2) };`);   /* 끄면 됨 — 구경 되살림 수를 흔들지 않게 따로 연다 */
    const c = go('stage=nohealth', `return { ORDER수: Object.keys(w.__placeRules().놓는법).length, put: w.__put('clinic', 109, 136, 0), t: w.__tray() };`);
    const d = go('stage=zz-tray-noclinic', `return w.__tray();`), fe = go('stage=zz-tray-fence', `return w.__tray();`);   /* fence = 옛 모양 묶음 — 트레이에 적혀도 탭에 안 선다 */   /* 건강이 꺼진 판(규칙 {}) — 의원은 ORDER 에 없어 트레이에 안 뜬다 */
    const s = sim(['--stage', SELF, '--days', '1', '--seeds', '1']).results[0];
    ok(a.put === '이번엔 놓지 않아요' && a.carry === false && a.t1.손말 === 손, '놓기·옮기기 ' + JSON.stringify([a.put, a.carry, a.t1.손말]));
    ok(a.t1.켜짐 === true && JSON.stringify(a.t1.트레이) === '[]' && JSON.stringify(a.t1.뜨는종류) === '[]' && JSON.stringify(a.t1.보이는카드) === '[]' && a.t1.막음 === 1 && a.t1.손막음 === 1, '__tray() ' + JSON.stringify(a.t1));
    { const h = a.손들, g = b.손들; ok(h.끌기.전 && /^tree@/.test(h.끌기.전) && h.끌기.그대로 && a.t.쓸기건너뜀 >= 1 && h.메뉴.메뉴 === false && h.메뉴.손말 === 손 && h.오른쪽.그대로 && h.오른쪽.손말 === 손
        && g.메뉴.메뉴 === true && g.끌기.후 === null && g.오른쪽.후 === null, '끌기 · 길게 누름 · 오른쪽 누름(켬 막힘 ↔ 끔 됨) ' + JSON.stringify({ 켬: h, 끔: g })); }
    ok(a.누름 && a.집 === 'house' && a.지킴 === 0 && a.t.손막음 >= 2, '치우기 모드 누름 ' + JSON.stringify({ 누름: a.누름, 집: a.집, 지킴: a.지킴, 손막음: a.t.손막음 }));
    ok(b.put === true && b.carry === true && b.지킴 === 1 && b.t.트레이 === null, '양성 대조(스위치 끔) — 같은 수가 되어야 함 ' + JSON.stringify({ put: b.put, carry: b.carry, 지킴: b.지킴 }));
    ok(a.er === true && a.되돌림 === 'house' && a.t.되돌림통과 >= 1, '되돌리기 ' + JSON.stringify([a.er, a.되돌림, a.t.되돌림통과]));
    ok(a.c0 === 3 && a.v === 'ok' && a.c1 === 4 && a.carry2 === false, '결정 적용 ' + JSON.stringify([a.c0, a.v, a.c1, a.carry2]));
    ok(a.vis.ok && a.vis.placed > 1000 && a.vis.placed === b.vis.placed && a.vis.skipped === b.vis.skipped && a.t.복원통과 >= a.vis.placed, '구경 되살림 ' + JSON.stringify({ 켬: a.vis, 끔: b.vis, 복원통과: a.t.복원통과 }));
    ok(a.t.값숨김규칙 === true && a.값끔 === false && c.put === true && c.t.트레이 === null && c.t.뜨는종류 === null && c.t.값숨김규칙 === false, '값 줄 · nohealth ' + JSON.stringify({ 켬: a.t.값숨김규칙, 끔: a.값끔, nohealth: [c.put, c.t.트레이, c.t.뜨는종류, c.t.값숨김규칙] }));
    ok(s.못살림 === 0 && s.판 && s.판.id === SELF && s.tray && s.tray.값숨김규칙 === true && JSON.stringify(s.tray.트레이) === '[]', 'run.mjs ' + JSON.stringify({ 못살림: s.못살림, tray: s.tray }));
    ok(a.ORDER수 > 20 && a.ORDER수 === c.ORDER수, '그릴 때만 거름 — ORDER 를 잘라 두지 않음 ' + JSON.stringify({ 트레이판: a.ORDER수, nohealth: c.ORDER수 }));
    ok(JSON.stringify(d.트레이) === '["road","clinic"]' && JSON.stringify(d.뜨는종류) === '["road"]' && JSON.stringify(d.뜨는길) === '["road"]', '뜨는종류 = 엔진이 실제로 띄우는 것(건강 꺼짐 → 의원 없음) ' + JSON.stringify({ 트레이: d.트레이, 뜨는종류: d.뜨는종류, 뜨는길: d.뜨는길 }));
    ok(JSON.stringify(fe.뜨는종류) === '["road"]', '뜨는종류 = 탭에 서는 것만(옛 모양 fence 는 빠짐) ' + JSON.stringify(fe.뜨는종류));
  } finally { fs.rmSync(file, { force: true }); fs.rmSync(fileD, { force: true }); fs.rmSync(fileF, { force: true }); }
});

/* [MAC-TRAY] 엔진 탐침(가정 놓기 — 이을 칸 셈 · 끊긴 칸 짚기 · 큰길 넓힐 자리)은 트레이를 모른다 — 트레이는 아이 손만 막는다.
   `트레이: []` 사본을 같은 시드 · 같은 틱으로 켬 ↔ 끔(VRULES.stageTray.on=false) 열어 견준다 — 집 말(모든 집 __houseText) · 일자리 까닭(JOB_WHY) ·
   ✨ 짚을 칸(__where) · 붐빔 점(__crowdPoint) · 밭 카드(__flowAt) · 공급 경로 칸(__pmapCut)까지 같아야 한다. 고침 전에는 '넓힐 자리가 없어요' 43집 · cut → none 으로 갈렸다.
   판 셋: jobs-short + pop167(붐빔 · 큰길 넓힐 자리) · jobs-short + pop88(길 끊음 + 길 곁이 다 끊긴 집 138,145 — 둘레 빈칸에서 셈) · proto-flow(밭 길 끊음 — 몇 칸 이으면). */
test('트레이: 엔진 탐침은 트레이를 모른다 — 트레이 [] 켬 ↔ 끔 집 말 · JOB_WHY · ✨ 짚을 칸 · 붐빔 점 · 밭 카드 · 공급 경로 같음 (pop167 · pop88 길 끊음 · proto-flow 밭 끊음)', () => {
  const runs = [['zz-tray-probe-a', 'jobs-short', 'stages/boards/pop167.json', [], 900], ['zz-tray-probe-b', 'jobs-short', 'stages/boards/pop88.json', [[139, 144], [138, 144]], 600],
    ['zz-tray-probe-c', 'proto-flow', null, [[142, 140]], 900]];
  const files = runs.map(([id, base, 시작]) => trayStage(id, base, { ...(시작 ? { 시작 } : {}), 트레이: [] }));
  const go = (id, off, cut, ticks, Wd) => trayGo('stage=' + id, `if (${off}) w.VRULES.stageTray.on = false; ${JSON.stringify(cut)}.forEach(([x, y]) => w.__del(x, y)); w.__tickBench(${ticks});
  const at = k => w.__snapshot().물건.filter(t => t.startsWith(k + '@')).map(t => t.slice(k.length + 1).split(/[,/]/).slice(0, 2).map(Number)), hs = at('house');
  return { 집: hs.length, 집칸: hs.map(([x, y]) => x + ',' + y), 말: hs.map(([x, y]) => w.__houseText(x, y)), 까닭: hs.map(([x, y]) => String(w.JOB_WHY(y * ${Wd} + x))), 자리: hs.map(([x, y]) => JSON.stringify((w.__where(x, y) || {}).짚을칸 || null)),
    점: [JSON.stringify(w.__crowdPoint(true))], 밭: at('field').map(([x, y]) => JSON.stringify(w.__flowAt(x, y))), 경로: [JSON.stringify(w.__pmapCut())], t: w.__tray(), 막기: ${off} ? null : w.__put('bench', 128, 100, 0) };`);
  try {
    runs.forEach(([id, base, 시작, cut, ticks]) => { const board = 시작 || JSON.parse(fs.readFileSync(path.join(ROOT, 'village/stages', base + '.json'), 'utf8')).시작, Wd = JSON.parse(fs.readFileSync(path.join(ROOT, 'village', board), 'utf8')).w || 256;
      const on = go(id, false, cut, ticks, Wd), off = go(id, true, cut, ticks, Wd), 다른 = k => on[k].filter((v, i) => v !== off[k][i]).length, 이름 = base + (시작 ? '+' + path.basename(시작, '.json') : '');
      ok((base === 'proto-flow' ? on.밭.length >= 3 : on.집 > 40) && on.집 === off.집 && on.밭.length === off.밭.length && JSON.stringify(on.t.트레이) === '[]' && off.t.트레이 === null, 이름 + ' 판 ' + JSON.stringify({ 켬: on.집, 끔: off.집, 트레이: [on.t.트레이, off.t.트레이] }));
      ok(['말', '까닭', '자리', '점', '밭', '경로'].every(k => !다른(k)), 이름 + ' 켬 ↔ 끔 다름 — ' + ['말', '까닭', '자리', '점', '밭', '경로'].map(k => k + ' ' + 다른(k)).join(' · ') + ' · 막음 ' + on.t.막음 + ' · 예 ' + (on.말.find((v, i) => v !== off.말[i]) || on.밭.find((v, i) => v !== off.밭[i]) || '').slice(-90));
      ok(on.t.탐침통과 > 0 && on.t.막음 === 0, 이름 + ' 탐침이 고리를 지났다(셈이 있었다) ' + JSON.stringify({ 탐침통과: on.t.탐침통과, 막음: on.t.막음 }));
      ok(on.t.탐침중 === 0 && on.막기 === '이번엔 놓지 않아요', 이름 + ' 탐침 셈이 새지 않음 — 다 돈 뒤 트레이 밖 놓기는 여전히 막힘 ' + JSON.stringify({ 탐침중: on.t.탐침중, 막기: on.막기 }));   /* 셈이 새면 트레이가 통째로 꺼진 것과 같아져 켬 ↔ 끔 같음이 헛 PASS 가 된다 */
      if (base === 'jobs-short' && cut.length) ok(off.까닭.includes('cut') && off.까닭[off.집칸.indexOf('138,145')] === 'cut', 이름 + ' 끊은 길 · 길 곁이 다 끊긴 집(138,145)이 까닭 cut 이 아님(시험이 헛돎) ' + JSON.stringify([...new Set(off.까닭)]) + ' · 138,145 ' + off.까닭[off.집칸.indexOf('138,145')]);
      if (base === 'proto-flow') ok(off.밭.length && off.밭.every(s => /"상태":"cut"/.test(s) && /"이으면":\{"칸":\d/.test(s)) && /"칸":\d/.test(off.경로[0]), 이름 + ' 끊은 밭이 cut · 이으면 · 공급 경로 칸이 아님(시험이 헛돎) ' + off.밭.join(' ').slice(0, 160) + ' · 경로 ' + off.경로[0]); });
  } finally { files.forEach(f => fs.rmSync(f, { force: true })); }
});

/* [MAC-TRAY] 손이 보는 종류 — 개울 다리(sbr)는 길의 한 모습(판이 길을 쓰면 다리도 쓴다) · 아파트는 놓이면 집 + 세대라 세대 수로 트레이 카드(apart)와 맞춘다.
   ⚠ 무화면은 벽시계가 멈춰 '30ms 안에 집 여러 채'(KEEP 맡김) 방어가 둘째 집 치움부터 세대를 버린다 — 아파트를 치우는 수(옮기기 · 돌리기)는 판 하나에 한 번씩. */
test('트레이: 손이 보는 종류 — 개울 다리 = 길(onebridge ["road"] 치우기·옮기기·길게 누름 됨) · 아파트 = apart(city ["road","apart"] 옮기기·돌리기·치우기 됨 · 보통 집은 막힘)', () => {
  const files = [trayStage('zz-tray-hand-a', 'onebridge', { 트레이: ['road'] }), trayStage('zz-tray-hand-b', 'city', { 트레이: ['road', 'apart'] })];
  try {
    const s = trayGo('stage=zz-tray-hand-a', `const st = w.__snapshot().물건.filter(t => t.startsWith('stream@')).map(t => t.slice(7).split(/[,/]/).slice(0, 2).map(Number));
  let at = null; for (const [x, y] of st) { const q = w.__stream(x, y); if (q.칸 && q.칸.곧음 >= 0 && w.__cellScreen(x, y) && w.__put('road', x, y, 0) === true) { at = [x, y]; break; } }
  if (!at) return { at }; const [x, y] = at, k = w.__stream(x, y).칸.종류, c = w.__trayTry('carry', x, y), h = w.__trayTry('hold', x, y), e = w.__trayTry('erase', x, y), [hs] = seen('house', 1);
  return { at, k, c, h, e, 집: hs ? w.__trayTry('carry', ...hs) : null };`);
    ok(s.at && s.k === 'sbr', '개울에 길 → 다리가 안 됨 ' + JSON.stringify([s.at, s.k]));
    ok(s.c.손종류 === 'road' && s.c.들림 === true && s.c.그대로 && s.h.메뉴 === true && !s.h.손말 && /^stream@/.test(s.e.후 || '') && !s.e.손말, '개울 다리 옮기기 · 길게 누름 · 치우기 ' + JSON.stringify({ c: s.c, h: s.h, e: s.e }));
    ok(s.집 && s.집.들림 === false && s.집.손말 === 손, '같은 판의 집(트레이 밖)은 막힘 ' + JSON.stringify(s.집));
    const a = trayGo('stage=zz-tray-hand-b', `const p = w.__put('apart', 140, 142, 0); w.VRULES.stageTray.on = false; const q = w.__put('house', 144, 142, 0); w.VRULES.stageTray.on = true;
  const 집 = w.__trayTry('erase', 144, 142), mv = w.__carry(140, 142), dr = w.__drop(146, 142), h = w.__trayTry('hold', 146, 142), e = w.__trayTry('erase', 146, 142);
  return { p, q, 집, mv, dr, 옛자리: w.__stream(140, 142).칸.종류, h, e, t: w.__tray() };`);
    ok(a.p === true && a.q === true && a.집.전 === 'house@144,142/0' && a.집.그대로 && a.집.손종류 === 'house' && a.집.손말 === 손, '보통 집(트레이 밖) 막힘 ' + JSON.stringify({ p: a.p, q: a.q, 집: a.집 }));
    ok(a.mv === true && a.옛자리 === null && a.h.전 === 'house@146,142/0' && a.h.손종류 === 'apart' && a.h.메뉴 === true && a.e.후 === null && a.t.손통과 >= 1, '아파트 옮기기(든 것 통과) · 길게 누름 · 치우기 ' + JSON.stringify({ mv: a.mv, 옛자리: a.옛자리, h: a.h, e: a.e, 손통과: a.t.손통과 }));
    const r = trayGo('stage=zz-tray-hand-b', `w.__put('apart', 140, 142, 0); const t = w.__trayTry('turn', 140, 142); return { t, 다시: w.__trayTry('hold', 140, 142).손종류 };`);
    ok(r.t.메뉴 === true && r.t.전 === 'house@140,142/0' && r.t.후 === 'house@140,142/1' && r.다시 === 'apart', '아파트 돌리기(돌리는 것 통과) ' + JSON.stringify(r));
  } finally { files.forEach(f => fs.rmSync(f, { force: true })); }
});

/* [MAC-TRAY] 트레이를 모르는 말 셋 — 새 말을 짓지 않고 거짓인 조각만 뺀다(해금 · 저장은 그대로).
   ① 🔓 해금 소식(checkUnlocks · 목표 보상): origin 시작 땅에서 인구 80 줄을 잠가 두고 연다 — 트레이에 기차역만 있으면 '기차역이 열렸어요' · 없으면 안 띄움.
   ② 보기 모드 물건 말: 트레이 밖이면 '🖐 로 옮기거나 🧽 로 치울 수 있어요'를 · [] 이면 '더 놓으려면 …'도 뺀다. ③ [] 판 빈 땅은 '먼저 고르세요'를 안 띄운다. 끄면 그대로. */
test('트레이: 트레이를 모르는 말 — 🔓 해금 소식은 트레이 종류만(origin 인구 80 · 목표 보상) · 물건 말은 거짓 조각만 뺌 · [] 빈 땅 말 없음 · 끄면 그대로', () => {
  const files = [trayStage('zz-tray-say-a', 'nohealth', { 트레이: ['road', 'bench'] }), trayStage('zz-tray-say-b', 'nohealth', { 트레이: [] }),
    trayStage('zz-tray-say-c', 'origin', { 트레이: ['road', 'house', 'station'] }), trayStage('zz-tray-say-d', 'origin', { 트레이: ['road', 'house'] })];
  try {
    const a = trayGo('stage=zz-tray-say-a', `const [tr] = seen('tree', 1), [rd] = seen('road', 1); return { 나무: w.__trayTry('look', ...tr).말, 길: w.__trayTry('look', ...rd).말 };`);
    ok(a.나무[0] === '🌳 나무 — 더 놓으려면 아래에서 카드를 골라요' && a.길[0] === '⬜ 길 — 🖐 로 옮기거나 🧽 로 치울 수 있어요 · 더 놓으려면 아래에서 카드를 골라요', '["road","bench"] 물건 말 ' + JSON.stringify(a));
    const b = trayGo('stage=zz-tray-say-b', `const [tr] = seen('tree', 1); let 빈칸 = null; for (let y = 125; y < 145 && !빈칸; y++) for (let x = 100; x < 130 && !빈칸; x++) if (!w.__stream(x, y).칸.종류 && w.__cellScreen(x, y)) 빈칸 = [x, y];
  const 빈 = w.__trayTry('look', ...빈칸), 나무 = w.__trayTry('look', ...tr).말; w.VRULES.stageTray.on = false;
  return { 빈칸, 빈: 빈.말, 빈전: 빈.전, 나무, 끈빈: w.__trayTry('look', ...빈칸).말, 끈나무: w.__trayTry('look', ...tr).말 };`);
    ok(b.빈전 === null && b.빈.length === 0 && b.나무[0] === '🌳 나무' && b.끈빈[0] === '아래에서 놓을 물건을 먼저 고르세요' && b.끈나무[0] === '🌳 나무 — 🖐 로 옮기거나 🧽 로 치울 수 있어요 · 더 놓으려면 아래에서 카드를 골라요', '[] 빈 땅 · 물건 말(끄면 그대로) ' + JSON.stringify(b));
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'village/stages/starts/origin.json'), 'utf8')); d.unlocked = d.unlocked.filter(k => !['green', 'sbridge', 'station', 'clinic'].includes(k)); d.palette = d.palette.map(k => k === 'clinic' ? 'field' : k);   /* 건강 시험과 같은 원본(의원 없는 80 줄) */
    const u = id => trayGo('stage=' + id, `let n = 0; while (!w.__unlocked().includes('station') && n < 80) { w.__tickBench(100); n++; }
  const 저장 = JSON.parse(w.__exportText()).unlocked || []; return { 열림: ['green', 'sbridge', 'station'].every(k => w.__unlocked().includes(k) && 저장.includes(k)), 해금말: w.__tray().해금말, t: w.__tray(), 자리: w.__spots('station') };`, JSON.stringify(d));
    const c = u('zz-tray-say-c'), e = u('zz-tray-say-d'), 팔십 = ([m]) => /^🔓 .*기차역.*열렸어요! \(인구 80명\)$/.test(m);
    ok(c.열림 && c.해금말.some(x => 팔십(x) && x[1] === '🔓 기차역이 열렸어요! (인구 80명)') && c.해금말.some(([m, t]) => m.startsWith('🔓 목표 보상! ') && t === null) && c.t.해금말줄임 >= 1, '["road","house","station"] 해금 소식 ' + JSON.stringify(c.해금말));
    ok(c.t.나감.includes('🔓 기차역이 열렸어요! (인구 80명)') && !c.t.나감.some(m => m.startsWith('🔓 목표 보상! ')) && c.자리.밝힘 >= 1, '["road","house","station"] 실제로 나간 소식 · 기차역 노란 자리 ' + JSON.stringify({ 나감: c.t.나감, 밝힘: c.자리.밝힘 }));   /* 장부가 아니라 나간 말(안쪽 기록) */
    ok(e.열림 && e.해금말.some(팔십) && e.해금말.every(([, t]) => t === null) && e.t.해금말뺌 >= 1 && e.t.해금말줄임 === 0, '["road","house"] 해금 소식 안 띄움 · 해금 · 저장 그대로 ' + JSON.stringify({ 열림: e.열림, 해금말: e.해금말 }));
    ok(!e.t.나감.some(m => /기차역|목표 보상/.test(m)) && e.자리.밝힘 === 0 && e.자리.밝힌것 === 0 && e.t.자리숨김 >= 1, '["road","house"] 실제로 나간 소식 0 · 트레이 밖 기차역 노란 자리 0 ' + JSON.stringify({ 나감: e.t.나감, 자리: e.자리, 자리숨김: e.t.자리숨김 }));
  } finally { files.forEach(f => fs.rmSync(f, { force: true })); }
});

/* [MAC-TRAY] 모르는 종류는 원래 canPlace 가 답한다 — 트레이 고리가 먼저 '이번엔 놓지 않아요'로 덮으면 run.mjs 의 '모르는 건물' 확인이 헛돈다 */
test('트레이: 트레이 판에서도 모르는 종류는 run.mjs 가 멈춘다(put raod → 모르는 건물)', () => {
  const f = trayStage('zz-tray-x', 'nohealth', { 트레이: ['road'] });
  try { const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--stage', 'zz-tray-x', '--days', '1', '--seeds', '1', '--do', 'put raod 140 140'], { cwd: ROOT, encoding: 'utf8' });
    ok(r.status !== 0 && /모르는 건물: raod/.test((r.stderr || '') + (r.stdout || '')), '끝값 ' + r.status + ' · ' + ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-1)[0]);
  } finally { fs.rmSync(f, { force: true }); }
});

results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
const f = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n요약: PASS ${results.length - f} · FAIL ${f}`);
process.exit(f ? 1 : 0);
