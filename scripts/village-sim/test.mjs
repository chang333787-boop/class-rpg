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
       쥔 동안 __setSpeed 는 다시 쥠 · 저장은 풀린 뒤의 배속(쥔 멈춤을 0 으로 안 적음 — 연 직후 저장 1) · 기본 마을(pop88)은 쥠 0 · 배속최대 4 · __setSpeed(4) → 4 · 멈춤 false
   (마) 되돌리기 스위치 — help-places 를 연 뒤 VRULES.stageClock.on = false: 쥔 채(boot)라도 저장은 옛 값(멈춤 = 0) · __setSpeed(4) 는 다시 쥐지 않고 흐름(되쥠 0)
       (이 둘은 기본 마을의 첫 안내 · ❓ · 칭호 카드에서도 도는 감싸기 — 스위치로 옛 동작으로 돌아가는지 · PA-06 반박 🟡4) */
const clOne = c => new Promise(done => {
  const src = `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${c.save ? `(await import('node:fs')).readFileSync(${JSON.stringify(path.join(ROOT, c.save))}, 'utf8')` : 'null'}, seed: 1, hash: 'hour=10', query: ${JSON.stringify(c.stage ? 'stage=' + c.stage : '')} });
w.VRULES.speedQuiet.on = false;   /* 무화면엔 getComputedStyle 이 없다 — 배속 말 쉼 고리가 그것을 부른다(배속 셈과 무관) */
${c.off ? 'w.VRULES.stageClock.on = false;' : ''}
const 처음 = w.__clockHold(), 저장0 = JSON.parse(w.__exportText()).clock.speed, f0 = w.__flow().만듦, j0 = w.__jobs().출근, 배속 = ${c.speed != null ? 'w.__setSpeed(' + c.speed + ')' : 'null'};
w.__tickBench(1800);
process.stdout.write('@@' + JSON.stringify({ 처음, 저장0, 배속, 뒤: w.__clockHold(), 만듦: w.__flow().만듦 - f0, 출근: w.__jobs().출근 - j0, 찬자리: w.__jobs().찬자리, cs: w.__campStats(), 모형: w.__protoMap().생산멈춤, 저장: JSON.parse(w.__exportText()).clock }) + '\\n', () => process.exit(0));`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', src], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('close', () => { const l = out.split('\n').find(x => x.startsWith('@@')), e = (err || out).trim().split('\n');
    done(l ? JSON.parse(l.slice(2)) : { 오류: c.n + ' — ' + (e.filter(x => /Error|ERR/.test(x)).slice(-1)[0] || e.slice(-1)[0] || '출력 없음') }); }); });
{ const dir = path.join(ROOT, 'village/stages'), 바탕 = n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')), 뜻 = '시험 판 — 판 시계', made = [];
  const put = (f, o) => { fs.writeFileSync(path.join(dir, f), JSON.stringify(o, null, 1)); made.push(path.join(dir, f)); };
  const tv = 바탕('two-villages.json'), st = 바탕('starts/two-villages.json'), job = { id: 'zz-clock-job', 이름: '시험 판', 교과: null, 시작: 'stages/boards/pop88.json' };
  const C = [{ n: 'tv', stage: 'two-villages' }, { n: 'make', stage: 'zz-clock-make' }, { n: 'job0', stage: 'zz-clock-job0' }, { n: 'job', stage: 'zz-clock-job' },
    { n: 'speed', stage: 'zz-clock-speed', speed: 4 }, { n: 'hp', stage: 'help-places', speed: 4 }, { n: 'town', stage: 'town' }, { n: '기본', stage: null, save: 'village/stages/boards/pop88.json', speed: 4 },
    { n: 'off', stage: 'help-places', speed: 4, off: true }];
  const R = {};
  try { put('zz-clock-make.json', { ...tv, id: 'zz-clock-make', 판규칙: { 멈춤: { 생산: true, 뜻 } } });
    put('zz-clock-job.json', { ...job, 판규칙: { 멈춤: { 일자리: true, 뜻 } } }); put('zz-clock-job0.json', { ...job, id: 'zz-clock-job0' });
    put('starts/zz-clock-speed.json', { ...st, clock: { ...st.clock, speed: 4 } }); put('zz-clock-speed.json', { ...tv, id: 'zz-clock-speed', 시작: 'stages/starts/zz-clock-speed.json', 배속최대: 2 });
    const out = new Array(C.length); let next = 0;   /* 판 하나 = 프로세스 하나 — 여섯씩 나란히 */
    await Promise.all(Array.from({ length: Math.min(6, C.length) }, async () => { while (next < C.length) { const i = next++; out[i] = await clOne(C[i]); } }));
    C.forEach((c, i) => { R[c.n] = out[i]; });
  } finally { made.forEach(f => fs.rmSync(f, { force: true })); }
  const J = JSON.stringify;
  test('CLOCK: 판규칙 멈춤.생산 → 하루 만듦 0 · 멈춤.일자리 → 하루 새 출근 0(출근막음 ≥ 1 · 배정 그대로) · 배속최대 2 → 저장본 4 를 열 때 2 · __setSpeed(4) → 2 · 저장 2 · boot 쥠은 카드가 안 뜰 판에서 규칙 뒤 풂 · 판 칸 없는 판 · 기본 마을 그대로 · 되돌리기 스위치', () => {
    const bad = C.filter(c => !R[c.n] || R[c.n].오류); ok(!bad.length, '못 돎: ' + bad.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / '));
    const { tv: a, make, job0, job, speed, hp, town, 기본: base, off } = R;
    ok(a.만듦 > 0 && make.만듦 === 0 && make.cs.생산막음 === 1 && make.모형 === true && J(make.cs.지금막음) === J(['생산']),
      '(가) 멈춤.생산 — 하루 만듦 two-villages ' + a.만듦 + ' → 판규칙 ' + make.만듦 + ' ' + J({ 생산막음: make.cs.생산막음, 모형: make.모형, 지금막음: make.cs.지금막음 }));
    ok(job0.출근 > 0 && job0.cs.출근막음 === 0 && job.출근 === 0 && job.cs.출근막음 >= 1 && job.찬자리 > 0 && J(job.cs.지금막음) === J(['일자리']),
      '(나) 멈춤.일자리 — 하루 출근 판규칙 없음 ' + job0.출근 + ' → 판규칙 ' + job.출근 + ' ' + J({ 출근막음: job.cs.출근막음, 찬자리: job.찬자리 }));
    ok(speed.처음.배속 === 2 && speed.처음.배속최대 === 2 && speed.처음.깎음 === 1 && speed.배속.배속 === 2 && speed.저장.speed === 2,
      '(다) 배속최대 2 — 열 때 · __setSpeed(4) · 저장 ' + J({ 처음: speed.처음.배속, 깎음: speed.처음.깎음, 단추: speed.배속.배속, 저장: speed.저장 }));
    ok(hp.처음.배속최대 === 4 && hp.처음.깎음 === 0 && hp.배속.배속 === 4, '(다) 배속최대 칸 없는 판(help-places)이 깎임 ' + J({ 처음: hp.처음, 단추: hp.배속 }));
    ok(J(town.처음.쥔) === '[]' && town.처음.쥠 === 1 && town.처음.풂 === 1 && !town.처음.멈춤, '(라) 카드가 안 뜰 판(town)인데 boot 를 안 풂 ' + J(town.처음));
    ok(J(a.처음.쥔) === J(['boot']) && J(hp.처음.쥔) === J(['boot']) && hp.저장0 === 1 && hp.배속.멈춤 === true && hp.뒤.되쥠 === 1 && hp.저장.speed === 4,
      '(라) 카드가 뜰 판 — 카드까지 boot 쥠 · 쥔 동안 __setSpeed 는 다시 쥠 · 저장은 풀린 뒤 배속 ' + J({ tv: a.처음.쥔, hp: hp.처음.쥔, 저장0: hp.저장0, 단추: hp.배속, 되쥠: hp.뒤.되쥠, 저장: hp.저장 }));
    ok(J(base.처음.쥔) === '[]' && base.처음.쥠 === 0 && base.처음.배속최대 === 4 && base.배속.배속 === 4 && base.배속.멈춤 === false && base.cs.출근막음 === 0,
      '(라) 기본 마을(pop88)에서 판 시계가 돎 ' + J({ 처음: base.처음, 단추: base.배속 }));
    ok(J(off.처음.쥔) === J(['boot']) && off.처음.멈춤 === true && off.처음.켜짐 === false && off.저장0 === 0 && off.배속.멈춤 === false && off.배속.배속 === 4 && off.뒤.되쥠 === 0 && off.저장.speed === 4,
      '(마) 되돌리기 스위치(stageClock.on = false) — 쥔 채 저장 0(옛 값) · __setSpeed(4) 는 다시 쥐지 않음 ' + J({ 쥔: off.처음.쥔, 저장0: off.저장0, 단추: off.배속, 되쥠: off.뒤.되쥠, 저장: off.저장 }));
  });
}
/* [MAC-C0T] PA-12 C0-T 기기 기록 + C0-H 해시 낱말 — 무화면 몫(화면 몫 — 다시 실림 · 토스트 · sync.js 요청 — 은 dcheck --scene c0t). 판 = help-places(시작 저장본 · 결정 칸).
   load.mjs: opts.store(미리 넣을 키) · opts.session(탭 저장소) · location.replace/assign/reload 는 적기만(__simNav — 다시싣기 = 조각 이동이 아님) · history 는 주소만.
   Date.now 는 싣는 순간 멈춘다 — 시각 키는 싣기 전 지금(now) 기준으로 넣고, 적힌 값은 멈춘 값(frozen)과 견준다.
   C0T (가) 번호 → SID: c3-07 · 07(글 그대로 — HP 는 7) · t · 교사(퍼센트 · 날글) → t · 한글 이름 · 7번 · 41자 → guest + 번호 칸 0 · & · 차례 무관 · 해시 없음 · adv · full · demo · guest · 반 기호 adv → 번호 없음 · 기본 마을 · 구경은 무시
       (나) 3시간: −4시간 → 지움 1 · 마을 · guide 지움 · 시작판 / −1시간 → 이어짐 / 시각 키 없음 → 적기만 / 앞머리 같은 번호 보존 / 시계가 뒤로(+4시간 — 3시간보다 크게 · 부호를 안 보면 지운다) → 지움 0 / 번호 둘 → 그 번호만
       (다) #기록지움(정오 ① ② ③): 시각 키가 있는 번호 전부 · 뒤붙이(.backup · .broken · .지난놓은 · .offered · .물없음)까지 / 시각 키 없는 번호(?sid=) · guest · 다른 판 · 앞머리 같은 번호는 그대로 ·
           싣는 중 location.replace 인데 LOAD ERR 0 · 다시싣기(?r= · 조각 이동 아님) · 해시 = 기록지움만 뺌 · & 로 이어도 · 저장 꺼짐(__save 해도 그 키 없음) · 표지 → 다시 실린 판이 읽고 지움 ·
           #n= 없는 판 = 옛 몸(그 번호 카드 기록만 · 해시 지움 · 다시 싣지 않음)
       (라) 저장이 되면 시각 키를 지금으로 · 꺼져 있으면(c0t 끔 · savingOff) 안 적음 · 번호 없는 판은 시각 키 0 · voteReset = ?r= + #n=(원래 줄) · 하네스 양성 대조(같은 주소 + # = 조각 이동) ·
           voteReset 이 붙이는 해시 = 남는 낱말만(n · 소리 · 크게 · 말2 — 끝 · end · fresh · 모르는 낱말은 버림 · & 로 이어도 쉼표로 · 차례 그대로) — ↺ 처음부터는 화면 몫(dcheck c0t (마))
       (마) 되돌리기 VRULES.c0t.on = false(엔진 기본값 한 줄을 바꾼 사본 — 판 `규칙` 은 싣기 뒤라 못 끔) — 3시간 지움 0 · 시각 키 그대로 · #기록지움 옛 몸 · 번호 읽기는 남음
       (바) 판에서 sync.js 를 안 싣는 고전 스크립트 — 엔진 STAGE.id(구경이면 null · stageIdOf) 와 같은 주소에서만 안 씀 · 쓰는 태그 꼴 · module 앞 · 옛 태그 0
   C0H 사례 셋: n=c3-07,끝 · 기록지움,n=c3-07 · 말2=vi,소리=끔 (+ 반 · 학년 · 대사 · 크게 · end · 모르는 낱말 · 같은 낱말 둘) */
const c0One = c => new Promise(done => {
  const J = JSON.stringify, src = `import { loadVillage } from ${J(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const now = Date.now(), H = 3600e3, START = fs.readFileSync(${J(path.join(ROOT, 'village/stages/starts/help-places.json'))}, 'utf8');
const { w, ls } = await loadVillage({ root: ${J(ROOT)}, saveText: null, seed: 1, query: ${J(c.query != null ? c.query : 'stage=help-places')}, hash: ${J(c.hash || '')}, store: ${c.store || '{}'}, session: ${c.session || '{}'}${c.html ? ', html: ' + J(c.html) : ''} });
const o = { now, frozen: Date.now(), st: w.__stage(), c0: w.__c0t(), h: w.__c0hash(), nav: w.__simNav.slice(), ss: Object.fromEntries(w.__simSession), keys: [...ls.keys()].sort(), 해시: w.location.hash };
${c.body || ''}
process.stdout.write('@@' + JSON.stringify(o) + '\\n', () => process.exit(0));`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', src], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('close', () => { const l = out.split('\n').find(x => x.startsWith('@@')), e = (err || out).trim().split('\n');
    done(l ? JSON.parse(l.slice(2)) : { 오류: c.n + ' — ' + (e.filter(x => /Error|ERR/.test(x)).slice(-1)[0] || e.slice(-1)[0] || '출력 없음') }); }); });
{ const J = JSON.stringify, R = {}, OFF = path.join(os.tmpdir(), 'village-sim-c0t-off-' + process.pid + '.html'), ON = '(window.VRULES = window.VRULES || {}).c0t = { on: true, 시간: 3 };';
  const html = fs.readFileSync(path.join(ROOT, 'village/index.html'), 'utf8'), onN = html.split(ON).length - 1;
  const old4 = `{ 'rpg.village.c3-07.help-places': START, 'rpg.guide.c3-07': '1', 'rpg.stagetime.c3-07.help-places': String(now - 4 * H) }`;
  const WIPE = `{ 'rpg.village.t.help-places': START, 'rpg.stagecard.t.help-places': '{"started":1}',
    'rpg.village.c3-07.help-places': START, 'rpg.village.c3-07.help-places.backup': START, 'rpg.village.c3-07.help-places.broken': 'x', 'rpg.stagecard.c3-07.help-places': '{"started":1}',
    'rpg.stagecard.c3-07.help-places.지난놓은': '{}', 'rpg.stagetime.c3-07.help-places': String(now - H), 'rpg.guide.c3-07': '1', 'rpg.album.c3-07': '[]', 'rpg.snap.c3-07': '{}', 'rpg.like.c3-07': '{}',
    'rpg.village.title.c3-07': '{}', 'rpg.village.title.c3-07.offered': '1', 'rpg.village.awaySeen.c3-07.물없음': '1', 'rpg.village.jobsNews.c3-07': '1',
    'rpg.village.stu1.help-places': START, 'rpg.stagecard.stu1.help-places': '{}', 'rpg.album.stu1': '[]', 'rpg.guide.guest': '1', 'rpg.album.guest': '[]', 'rpg.village.guest': START,
    'rpg.village.c3-07.farm': START, 'rpg.stagetime.c3-07.farm': String(now), 'rpg.guide.c3-0': '1', 'rpg.stagetime.x9.farm': String(now), 'rpg.village.x9.help-places': START, 'rpg.album.x9': '[]' }`;
  const C = [{ n: 'c307', hash: 'n=c3-07' }, { n: '07', hash: 'n=07' }, { n: 't', hash: 'n=t' }, { n: '교사', hash: 'n=%EA%B5%90%EC%82%AC' }, { n: '교사날글', hash: 'n=교사' },
    { n: '김', hash: 'n=%EA%B9%80' }, { n: '7번', hash: 'n=7번' }, { n: '41자', hash: 'n=' + 'a'.repeat(41) }, { n: '&', hash: 'n=c3-07&끝' }, { n: '차례', hash: '끝,n=c3-07' }, { n: '없음', hash: '' },
    { n: 'adv', hash: 'n=adv-07' }, { n: 'full', hash: 'n=c3-full' }, { n: 'demo', hash: 'n=demo7' }, { n: 'guest', hash: 'n=guest' }, { n: '반adv', hash: '반=adv,n=07' },
    { n: '기본', query: '', hash: 'n=c3-07' }, { n: '구경', query: 'stage=help-places&visit=c3-07', hash: 'n=c3-07' },
    { n: '4시간', hash: 'n=c3-07', store: old4 },
    { n: '1시간', hash: 'n=c3-07', store: `{ 'rpg.village.c3-07.help-places': START, 'rpg.guide.c3-07': '1', 'rpg.stagetime.c3-07.help-places': String(now - 1 * H) }` },
    { n: '시각없음', hash: 'n=c3-07', store: `{ 'rpg.village.c3-07.help-places': START }` },
    { n: '앞머리', hash: 'n=c3-07', store: `{ 'rpg.guide.c3-0': '1', 'rpg.guide.c3-07': '1', 'rpg.stagetime.c3-07.help-places': String(now - 4 * H) }` },
    { n: '앞머리2', hash: 'n=c3-0', store: `{ 'rpg.guide.c3-0': '1', 'rpg.guide.c3-07': '1', 'rpg.album.c3-07': '[]', 'rpg.village.title.c3-07.offered': '1', 'rpg.stagetime.c3-0.help-places': String(now - 4 * H) }` },
    { n: '뒤로', hash: 'n=c3-07', store: `{ 'rpg.village.c3-07.help-places': START, 'rpg.stagetime.c3-07.help-places': String(now + 4 * H) }` },   /* +4시간 — 차이가 3시간보다 커야 '부호를 안 본 셈'(Math.abs)을 가른다 */
    { n: '둘', hash: 'n=1', store: `{ 'rpg.village.1.help-places': START, 'rpg.village.2.help-places': START, 'rpg.stagetime.1.help-places': String(now - 4 * H), 'rpg.stagetime.2.help-places': String(now - 4 * H) }` },
    { n: '지움', hash: '기록지움,n=t', store: WIPE, body: `w.__save(); o.저장뒤 = [...ls.keys()].filter(k => k.includes('.t.help-places'));` },
    { n: '지움&', hash: 'n=c3-07&기록지움&끝', store: `{ 'rpg.village.c3-07.help-places': START }` },
    { n: '다시', hash: 'n=t', session: `{ 'rpg.c0t.wiped.help-places': '2' }` },
    { n: '옛몸', hash: '기록지움', store: `{ 'rpg.stagecard.guest.help-places': '{"started":1}', 'rpg.village.guest.help-places': START, 'rpg.village.c3-07.help-places': START, 'rpg.stagetime.c3-07.help-places': String(now - H) }` },
    { n: '저장', hash: 'n=c3-07', body: `const k = 'rpg.stagetime.c3-07.help-places'; ls.set(k, '1'); w.__save(); o.저장뒤 = ls.get(k); o.저장시각 = w.__c0t().stats.저장시각;
w.VRULES.c0t.on = false; ls.set(k, '2'); w.__save(); o.끈뒤 = ls.get(k); w.VRULES.c0t.on = true;
o.되돌림 = w.__voteReset(true); ls.set(k, '3'); w.__save(); o.꺼진뒤 = ls.get(k); o.nav2 = w.__simNav.slice();` },
    { n: '번호없음', hash: '', body: `w.__save(); o.시각키들 = [...ls.keys()].filter(k => k.startsWith('rpg.stagetime.')); o.되돌림 = w.__voteReset(true); o.nav2 = w.__simNav.slice();` },
    { n: '되돌림해시', hash: 'fresh,n=c3-07,끝,소리=끔&크게,zz=9,end,말2=vi', body: `o.되돌림 = w.__voteReset(true); o.nav2 = w.__simNav.slice();` },
    { n: '조각', hash: 'n=c3-07', body: `const last = () => w.__simNav[w.__simNav.length - 1]; w.location.replace(w.location.href); o.조각1 = last();
w.location.replace(w.location.pathname + w.location.search + '#n=x'); o.조각2 = last(); o.조각2해시 = w.location.hash; w.location.replace(w.__reopenUrl() + w.location.hash); o.다시1 = last();` },
    { n: 'H1', hash: 'n=c3-07,끝' }, { n: 'H2', hash: '기록지움,n=c3-07' }, { n: 'H3', hash: '말2=vi,소리=끔' }, { n: 'H4', hash: '반=c3,n=1,n=2,학년=3,대사=끔,크게,zz=9,end' },
    { n: '끔4시간', html: OFF, hash: 'n=c3-07', store: old4 },
    { n: '끔지움', html: OFF, hash: '기록지움,n=t', store: `{ 'rpg.village.t.help-places': START, 'rpg.stagecard.t.help-places': '{}', 'rpg.village.c3-07.help-places': START, 'rpg.stagetime.c3-07.help-places': String(now) }` }];
  try { if (onN === 1) fs.writeFileSync(OFF, html.replace(ON, ON.replace('on: true', 'on: false')));
    const out = new Array(C.length); let next = 0;   /* 판 하나 = 프로세스 하나 — 여섯씩 나란히 */
    await Promise.all(Array.from({ length: Math.min(6, C.length) }, async () => { while (next < C.length) { const i = next++; out[i] = await c0One(C[i]); } }));
    C.forEach((c, i) => { R[c.n] = out[i]; });
  } finally { fs.rmSync(OFF, { force: true }); }
  const bad = () => { const b = C.filter(c => !R[c.n] || R[c.n].오류); ok(!b.length, '못 돎(LOAD ERR?): ' + b.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / ')); };
  const key = n => R[n].st.저장키, num = n => R[n].c0.번호, has = (n, k) => R[n].keys.includes(k), url = x => new URL(x.주소), stamp = n => R[n].keys.filter(k => k.startsWith('rpg.stagetime.'));
  test('C0T (가) 번호 → SID: 판 + #n=c3-07 · 07 · t · 교사 → 그 번호 칸 · 시각 키 / 한글 · % · 41자 · adv · full · demo · guest → guest(번호 칸 0) · & · 차례 무관 · 기본 마을 · 구경 · 해시 없음은 번호 없음', () => { bad();
    ok(key('c307') === 'rpg.village.c3-07.help-places' && num('c307') === 'c3-07' && R.c307.c0.시각키 === String(R.c307.frozen) && R.c307.st.시작판 === true, 'c3-07 ' + J({ 키: key('c307'), c0: R.c307.c0 }));
    ok(key('07') === 'rpg.village.07.help-places' && num('07') === '07', 'n=07 은 글 그대로(HP 는 7) ' + key('07'));
    ok(key('t') === 'rpg.village.t.help-places' && num('t') === 't', '교사 기기 n=t ' + key('t'));
    ok(['교사', '교사날글'].every(n => key(n) === 'rpg.village.t.help-places' && num(n) === 't'), 'n=교사(퍼센트 · 날글) → t ' + J(['교사', '교사날글'].map(key)));
    ok(['김', '7번', '41자'].every(n => key(n) === 'rpg.village.guest.help-places' && num(n) === null && R[n].c0.시각키 === null && !stamp(n).length && !R[n].keys.some(k => /EA|B9|%|7번|aaaa/.test(k))),
      '틀린 꼴 n= → guest · 번호 칸 0 ' + J(['김', '7번', '41자'].map(n => [key(n), num(n), R[n].keys])));
    ok(['&', '차례'].every(n => key(n) === 'rpg.village.c3-07.help-places' && R[n].h.끝 === true), '& · 차례 무관 ' + J(['&', '차례'].map(n => [key(n), R[n].h])));
    ok(key('없음') === 'rpg.village.guest.help-places' && num('없음') === null && R.없음.c0.시각키 === null && !stamp('없음').length, '해시 없음 ' + J([key('없음'), stamp('없음')]));
    ok(['adv', 'full', 'demo', 'guest', '반adv'].every(n => num(n) === null && key(n) === 'rpg.village.guest.help-places' && !stamp(n).length), 'adv · full · demo · guest · 반 adv → 번호 없음(정오 ④) ' + J(['adv', 'full', 'demo', 'guest', '반adv'].map(n => [num(n), key(n)])));
    ok(key('기본') === 'rpg.village.guest' && num('기본') === null && !stamp('기본').length && R.구경.st.id === null && num('구경') === null && !stamp('구경').length, '기본 마을 · 구경은 #n= 무시 ' + J([key('기본'), R.구경.st]));
  });
  test('C0T (나) 3시간: −4시간 → 그 번호 마을 · guide 지움 · 시작판 새로 / −1시간 → 이어짐 / 시각 키 없음 → 적기만 / 앞머리 같은 번호(c3-0) 그대로 / 시계가 뒤로 → 지움 0 / 번호 둘 → 그 번호만', () => { bad();
    const a4 = R['4시간'], a1 = R['1시간'], n0 = R.시각없음, pf = R.앞머리, bk = R.뒤로, tw = R.둘;
    ok(a4.c0.지움 === 1 && a4.c0.지운키.includes('rpg.village.c3-07.help-places') && a4.c0.지운키.includes('rpg.guide.c3-07') && !has('4시간', 'rpg.guide.c3-07') && a4.st.시작판 === true && a4.c0.시각키 === String(a4.frozen),
      '−4시간 ' + J({ c0: a4.c0, 시작판: a4.st.시작판 }));
    ok(a1.c0.지움 === 0 && a1.st.시작판 === false && has('1시간', 'rpg.guide.c3-07') && a1.c0.시각키 === String(a1.frozen), '−1시간 이어짐 ' + J({ c0: a1.c0, 시작판: a1.st.시작판 }));
    ok(n0.c0.지움 === 0 && n0.c0.시각 === null && n0.st.시작판 === false && n0.c0.시각키 === String(n0.frozen), '시각 키 없음 → 적기만 ' + J({ c0: n0.c0, 시작판: n0.st.시작판 }));
    ok(pf.c0.지움 === 1 && !has('앞머리', 'rpg.guide.c3-07') && has('앞머리', 'rpg.guide.c3-0'), '앞머리 같은 번호 ' + J(pf.keys));
    ok(R.앞머리2.c0.지움 === 1 && !has('앞머리2', 'rpg.guide.c3-0') && ['rpg.guide.c3-07', 'rpg.album.c3-07', 'rpg.village.title.c3-07.offered'].every(k => has('앞머리2', k)), '짧은 번호(c3-0)를 지우며 c3-07 곁 키를 먹음 ' + J(R.앞머리2.keys));
    ok(bk.c0.지움 === 0 && bk.st.시작판 === false && bk.c0.시각 - bk.frozen > 3 * 3600e3, '시계가 뒤로(3시간보다 크게) ' + J(bk.c0));
    ok(tw.c0.지움 === 1 && tw.c0.지운키.includes('rpg.village.1.help-places') && tw.st.시작판 === true && has('둘', 'rpg.village.2.help-places') && has('둘', 'rpg.stagetime.2.help-places') && !tw.c0.지운키.some(k => k.includes('.2.')),
      '번호 둘 → 그 번호만 ' + J({ 지운키: tw.c0.지운키, keys: tw.keys }));
  });
  test('C0T (다) #기록지움: 시각 키가 있는 번호 전부(뒤붙이 · 곁 키까지) · ?sid= · guest · 다른 판 · 앞머리 그대로 · 싣는 중 replace 인데 LOAD ERR 0 · 다시싣기(?r=) · 해시 = 기록지움만 뺌 · 저장 꺼짐 · 표지 → 다시 실린 판 · #n= 없는 판 = 옛 몸', () => { bad();
    const wp = R.지움, nv = wp.nav, gone = ['rpg.village.t.help-places', 'rpg.stagecard.t.help-places', 'rpg.stagetime.t.help-places', 'rpg.village.c3-07.help-places', 'rpg.village.c3-07.help-places.backup',
      'rpg.village.c3-07.help-places.broken', 'rpg.stagecard.c3-07.help-places', 'rpg.stagecard.c3-07.help-places.지난놓은', 'rpg.stagetime.c3-07.help-places', 'rpg.guide.c3-07', 'rpg.album.c3-07', 'rpg.snap.c3-07',
      'rpg.like.c3-07', 'rpg.village.title.c3-07', 'rpg.village.title.c3-07.offered', 'rpg.village.awaySeen.c3-07.물없음', 'rpg.village.jobsNews.c3-07'];
    const kept = ['rpg.village.stu1.help-places', 'rpg.stagecard.stu1.help-places', 'rpg.album.stu1', 'rpg.guide.guest', 'rpg.album.guest', 'rpg.village.guest', 'rpg.village.c3-07.farm', 'rpg.stagetime.c3-07.farm', 'rpg.guide.c3-0',
      'rpg.stagetime.x9.farm', 'rpg.village.x9.help-places', 'rpg.album.x9'];   /* x9 = 다른 판(farm)에만 시각 키 — 이 판 번호가 아니다 */
    ok(gone.every(k => !wp.keys.includes(k)), '지울 키가 남음(정오 ③ · 뒤붙이): ' + gone.filter(k => wp.keys.includes(k)).join(' '));
    ok(kept.every(k => wp.keys.includes(k)), '남을 키가 지워짐(시각 키 없는 번호 · guest · 다른 판 · 앞머리): ' + kept.filter(k => !wp.keys.includes(k)).join(' '));
    ok(J(wp.c0.기록지움 && wp.c0.기록지움.번호.slice().sort()) === J(['c3-07', 't']) && wp.c0.떠남 === true && wp.ss['rpg.c0t.wiped.help-places'] === '2', '모은 번호 · 표지 ' + J({ c0: wp.c0.기록지움, ss: wp.ss }));
    ok(nv.length === 1 && nv[0].어떻게 === 'replace' && nv[0].다시싣기 === true && url(nv[0]).hash === '#n=t' && /^\d+$/.test(url(nv[0]).searchParams.get('r') || '') && url(nv[0]).searchParams.get('stage') === 'help-places',
      '다시 싣기(정오 ① — ?r= · 조각 이동 아님 · 해시 #n=t) ' + J(nv));
    ok(Array.isArray(wp.저장뒤) && !wp.저장뒤.length, '떠나는 판의 저장이 안 꺼짐 — __save 뒤 t 키 ' + J(wp.저장뒤));
    const am = R['지움&']; ok(am.nav.length === 1 && am.nav[0].다시싣기 && decodeURIComponent(url(am.nav[0]).hash) === '#n=c3-07,끝' && !am.keys.includes('rpg.village.c3-07.help-places'), '& 로 이은 #기록지움 ' + J(am.nav));
    ok(R.다시.c0.다시실린뒤 === 2 && !('rpg.c0t.wiped.help-places' in R.다시.ss) && R.다시.c0.떠남 === false, '다시 실린 판이 표지를 읽고 지움 ' + J({ c0: R.다시.c0, ss: R.다시.ss }));
    const old = R.옛몸; ok(old.c0.번호 === null && old.c0.기록지움 === null && !has('옛몸', 'rpg.stagecard.guest.help-places') && has('옛몸', 'rpg.village.guest.help-places') && has('옛몸', 'rpg.village.c3-07.help-places')
      && has('옛몸', 'rpg.stagetime.c3-07.help-places') && old.nav.length === 1 && old.nav[0].어떻게 === 'replaceState' && old.해시 === '' && !Object.keys(old.ss).length, '#n= 없는 판은 옛 몸 ' + J({ nav: old.nav, keys: old.keys, 해시: old.해시 }));
  });
  test('C0T (라) 저장이 되면 시각 키 = 지금 · c0t 끔 · 저장 꺼짐이면 안 적음 · 번호 없는 판 시각 키 0 · voteReset 다시 싣기 = ?r= + #n= · 남는 낱말만(끝 · end · fresh · 모르는 낱말 버림) · 하네스 양성 대조(같은 주소 + # = 조각 이동)', () => { bad();
    const sv = R.저장, vr = (sv.nav2 || []).filter(x => x.어떻게 === 'replace'), nn = R.번호없음, fr = R.조각, kh = R.되돌림해시, kv = (kh.nav2 || []).filter(x => x.어떻게 === 'replace');
    ok(kh.되돌림 === true && kh.c0.번호 === 'c3-07' && kv.length === 1 && kv[0].다시싣기 && decodeURIComponent(url(kv[0]).hash) === '#n=c3-07,소리=끔,크게,말2=vi' && /^\d+$/.test(url(kv[0]).searchParams.get('r') || ''),
      'voteReset 해시 = 남는 낱말만(#fresh 가 남으면 시작 저장본이 안 깔리고 · 끝 이 남으면 처음부터가 끝 카드) ' + J(kv.map(x => decodeURIComponent(x.주소))));
    ok(sv.저장뒤 === String(sv.frozen) && sv.저장시각 >= 1, '저장 → 시각 키 ' + J({ 저장뒤: sv.저장뒤, frozen: sv.frozen, 저장시각: sv.저장시각 }));
    ok(sv.끈뒤 === '2' && sv.되돌림 === true && sv.꺼진뒤 === '3', 'c0t 끔 · savingOff 인데 시각 키를 적음 ' + J({ 끈뒤: sv.끈뒤, 꺼진뒤: sv.꺼진뒤 }));
    ok(vr.length === 1 && vr[0].다시싣기 && url(vr[0]).hash === '#n=c3-07' && /^\d+$/.test(url(vr[0]).searchParams.get('r') || ''), 'voteReset 다시 싣기 ' + J(vr));
    ok(!nn.시각키들.length && nn.nav2.length === 1 && nn.nav2[0].다시싣기 && url(nn.nav2[0]).hash === '', '번호 없는 판 ' + J({ 시각키: nn.시각키들, nav: nn.nav2 }));
    ok(fr.조각1.다시싣기 === false && fr.조각2.다시싣기 === false && fr.조각2해시 === '#n=x' && fr.다시1.다시싣기 === true, '하네스 양성 대조 — location.replace(같은 주소 + #…) = 조각 이동 ' + J([fr.조각1, fr.조각2, fr.다시1]));
  });
  test('C0T (마) 되돌리기 VRULES.c0t.on = false(엔진 기본값 사본) — −4시간도 이어짐 · 시각 키 그대로 · #기록지움은 옛 몸 · 번호 읽기는 남음', () => { ok(onN === 1, 'c0t 기본값 줄을 못 찾음(' + onN + ')'); bad();
    const f4 = R.끔4시간, fw = R.끔지움;
    ok(f4.c0.켜짐 === false && num('끔4시간') === 'c3-07' && key('끔4시간') === 'rpg.village.c3-07.help-places' && f4.c0.지움 === 0 && f4.st.시작판 === false && has('끔4시간', 'rpg.guide.c3-07')
      && f4.c0.시각키 === String(f4.now - 4 * 3600e3), '끈 사본 −4시간 ' + J({ c0: f4.c0, 시작판: f4.st.시작판 }));
    ok(fw.c0.기록지움 === null && !has('끔지움', 'rpg.stagecard.t.help-places') && has('끔지움', 'rpg.village.t.help-places') && has('끔지움', 'rpg.village.c3-07.help-places') && fw.nav.length === 1 && fw.nav[0].어떻게 === 'replaceState' && fw.해시 === '',
      '끈 사본 #기록지움 ' + J({ nav: fw.nav, keys: fw.keys }));
  });
  { const vm = await import('node:vm'), line = html.split('\n').find(l => l.includes('[MAC-C0T]') && l.includes('document.write')), m = line ? /^<script>(.*)<\/script>\s*$/.exec(line.trim()) : null;
    const run = search => { const w = []; vm.runInNewContext(m[1], { location: { search }, URLSearchParams, document: { write: s => w.push(s) } }); return w; };
    test('C0T (바) 판에서 sync.js 를 안 싣는 고전 스크립트 — 엔진 STAGE.id 와 같은 주소에서만 안 씀 · 쓰는 태그 꼴 · module 앞 · 옛 태그 0', () => { ok(m, 'sync 고전 스크립트 줄을 못 찾음'); bad();
      const want = { '': 1, '?sid=guest': 1, '?sid=guest&dev=1': 1, '?stage=help-places': 0, '?stage=help-places&sid=guest': 0, '?sid=guest&stage=two-villages': 0, '?visit=c3-07': 1, '?visit=c3-07&stage=help-places': 1, '?stage=': 1, '?stage=%21%21': 1, '?stage=Help-Places': 0 };
      const miss = Object.entries(want).filter(([q, n]) => run(q).length !== n); ok(!miss.length, '쓰는 주소가 다름: ' + J(miss.map(([q, n]) => [q, '기대 ' + n, '씀 ' + run(q).length])));
      ok(/^<script src="\.\/sync\.js\?v=[^"]+"><\/script>$/.test(run('')[0] || ''), '쓰는 태그 꼴 ' + run('')[0]);
      const H0 = '?sid=guest&dev=1&', same = ['c307', '기본', '구경'].map(n => [n, !!R[n].st.id, run(H0 + (C.find(c => c.n === n).query ?? 'stage=help-places')).length === 0]);
      ok(same.every(([, st, skip]) => st === skip), '엔진 STAGE.id 와 다름(판이면 안 싣고 · 판이 아니면 싣는다): ' + J(same));
      const i = html.indexOf(line), j = html.indexOf('<script type="importmap">'), k = html.indexOf('<script type="module">');
      ok(i > 0 && i < j && j < k && !/<script src="\.\/sync\.js/.test(html.replace(line, '')), '차례(고전 스크립트 → importmap → module) · 옛 태그 0 ' + J([i, j, k]));
    }); }
  test('C0H 해시 낱말 사례 셋 — n=c3-07,끝(번호 + 끝) · 기록지움,n=c3-07(다시 연 해시 #n=c3-07) · 말2=vi,소리=끔(둘 다) · 반 · 학년 · 대사 · 크게 · end = 끝 · 모르는 낱말 버림 · 같은 낱말은 뒤엣것', () => { bad();
    const h1 = R.H1, h2 = R.H2, h3 = R.H3, h4 = R.H4;
    ok(h1.st.저장키 === 'rpg.village.c3-07.help-places' && h1.h.n === 'c3-07' && h1.h.끝 === true && h1.h.기록지움 === false, 'n=c3-07,끝 ' + J(h1.h));
    ok(h2.nav.length === 1 && h2.nav[0].다시싣기 && url(h2.nav[0]).hash === '#n=c3-07' && h2.h.기록지움 === true, '기록지움,n=c3-07 ' + J(h2.nav));
    ok(h3.h.말2 === 'vi' && h3.h.소리 === '끔' && h3.h.n === null && h3.c0.번호 === null, '말2=vi,소리=끔 ' + J(h3.h));
    ok(h4.h.n === '2' && h4.c0.번호 === '2' && h4.h.반 === 'c3' && h4.h.학년 === '3' && h4.h.대사 === '끔' && h4.h.크게 === true && h4.h.끝 === true && !('zz' in h4.h) && Object.keys(h4.h).length === 9, '낱말 여럿 ' + J(h4.h));
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

/* [MAC-K7] PA-07 K7-LAYER 안내 층 + (H16 · #1122) 수업 판 💬 · 길 끌기 기본 끔. 무화면은 풍선이 안 생겨 주민 줄은 __k7Folk(k) = bhFolkLine({ whyShow: k, whyUntil: Infinity })로 본다(정오표 ①).
   자기 시험 판(시험 안에서 쓰고 finally 에서 지움 · 도구 시드 1 · hour=10 · 300틱):
     zz-k7-ga3 = empty-shop-ga 사본 · 안내최대층 3(양성 대조) · zz-k7-garule = 사본 + 판 규칙 k7 끔 · zz-k7-hint = onebridge 사본 · 안내최대층 2(권유가 있는 탐정 판 — 판 검사는 FAIL · 엔진 이중 안전) ·
     zz-k7-pop2 · pop3 = 시작 pop88 · 안내최대층 2 · 3(📚 도서관 귀띔 · ✨ 붐빔 토막 · 💼 긴 말) · zz-k7-mid2 · mid3 = 시작 mid36(🛣️ 붐빔 귀띔 · crowdSay · widenShift 를 끄면 '넓힐 자리가 없어요') ·
     zz-k7-chirp = help-places + 판 규칙 chirp 켬 · zz-k7-end = proto-flow + 판 결과값 · zz-k7-cut2 · cut3 = jobs-short + 시작 pop88 · 2 · 3(길 139,144 를 지워 일터 cut 집 둘 · 600틱) ·
     zz-k7-full2 · full3 = empty-shop-ga + 가게 담을수 1 · 2 · 3(끊긴 길 152,140 을 이어 가게가 곧 차면 밭이 '가득 찼어요 — 가져갈 곳이 없어요').
   (가) empty-shop-ga(2층) — 주민 풍선 뜻 · 얼굴 줄에 꼬리(' — ' · 주세요 · 봐요 · 보세요) 0
   (나) 같은 판 안내최대층 3 사본 → '주세요' 있음 · 얼굴 줄 '보세요' 있음(#1119 그대로)
   (다) 판 검사 '탐정 판 권유' FAIL 은 stages.mjs 자기 시험(k7File — 판 루프와 같은 함수) · 여기서는 엔진 이중 안전: 2층 + 권유 판은 판 권유 null · 집 글 🌉 0 · ✨ 0 / onebridge(3층)는 🌉 · 자리
   (라) empty-shop-ga — __flowAt(129,138).카드 '끊겼' 0 · __flowAt(157,135).카드 '이으면' 0 · '길이 끊겨' 있음 · __where(129,138).짚을칸 null(정오표 ③ · 밭도 null) ·
       🔗 공급 경로 말 '✂️ 여기예요'(꼬리만 뗌 · ✨ 그대로 · 정오표 ④) · empty-shop-na 가게 카드 '빈 선반이에요'까지 / 3층 사본은 '끊겼어요' · '이으면' · 짚을 칸 · 공급 경로 꼬리가 있다 ·
       가득 찬 밭(full)은 상태 말 안의 까닭('— 가져갈 곳이 없어요')을 둔다(' — ' 수로 자르면 사라짐 — 정오표 ②)
   (마) 집 카드 층(satText) — pop88 · mid36 2층: 집 글 할 일 꼬리 · 📚 · 🛣️ 0 · ✨ 짚기 0 · 💼 긴 말(__k7Job = 💼 칩 · 돌아섬 말의 jobWhySay) = 짧은 까닭 · 풍선 뜻을 끈 돌아섬 말(빈 집)도 ·
       일터 cut 집 '💼 길이 끊겨 일터에 못 가요' · 문 앞 ✨ 0 · 💼 칩 일터 ✨(__k7Point) 0 / 3층 사본은 📚 · 🛣️ · 넓힐 자리 없음 · ✨ · 긴 말 꼬리 · '…지어 봐요' ·
       '💼 길 1칸만 이으면 일터에 닿아요' · ✨(139,144)가 있다(양성 대조)
   (바) 💬 · 길 끌기 — ?stage= 판(help-places · 2층 · 3층) 켜짐 false · false · W·A·S·D 켬 / 판 규칙 chirp 켬 → 💬 true(길 끌기 false 그대로) / 자유 모드(pop88) 셋 다 true · K7 길 0
   (사) 되돌리기 — 2층 판을 연 뒤 VRULES.k7.on = false · 판 규칙 k7 끔 → 3층 사본과 같은 글 · ✨ · 권유 / ③ flowEnd: 결과값 판은 쓰는판 false · k7 끄면 true · proto-flow true
   PA-07 고침(반박 검증 🟡 · 10-13) — zz-k7-na3 = empty-shop-na 사본 · 안내최대층 3:
   (가′) 진짜 바람 주민(합성 아님 · __k7Cards) — 2층(ga · na) 300틱 뒤 바람 주민 카드 글에 '있으면 좋겠어요' 0 · 그 집 카드의 현상 말('💬 가게에 물건이 없어요 — ') /
        3층 사본은 '있으면 좋겠어요' · 바람이 생긴 셈(나옴 · 누구 · 어느 집 · 무엇)은 2층 = 3층(생성 그대로 — 글만) · 판 규칙 k7 끔 · 연 뒤 끔 = 3층
   ⑨ 빈 가게 문 앞 팻말 — __flowShape(129,138).까닭 2층(ga · na) null · 조각수 3층보다 적음(팻말째 안 섬) / 3층 사본 ga '길' · na '밭' · 판 규칙 k7 끔 '길'
   ⑪ (층과 무관 · 맞는 말로 고침) 풍선 뜻 🛒? — 집 카드가 '가게에 물건이 없어요'인 집은 __k7Folk('장보기', x, y) = '머리 위 🛒? 가게에 물건이 없어요'(2층 · 3층 모두) ·
        그 밖의 집(proto-flow — 흐름 판이지만 몫을 못 받은 집이 아님)은 '가게가 멀어요' 그대로 / flowSay 끄면 옛 말('— 집 가까이 지어 주세요') · 자유 모드(흐름 없음) 0 */
const k7One = c => new Promise(done => {
  const src = `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${c.save ? `(await import('node:fs')).readFileSync(${JSON.stringify(path.join(ROOT, c.save))}, 'utf8')` : 'null'}, seed: 1, hash: 'hour=10', query: ${JSON.stringify(c.stage ? 'stage=' + c.stage : '')} });
w.VRULES.speedQuiet.on = false;
${c.pre || ''}
w.__tickBench(${c.ticks || 300});
${c.post || ''}
const 물건 = w.__snapshot().물건.map(t => /^([a-z0-9_]+)@(\\d+),(\\d+)/.exec(t)).filter(Boolean).map(m => [m[1], +m[2], +m[3]]);
const 집 = 물건.filter(o => o[0] === 'house').map(([, x, y]) => ({ at: [x, y], 글: w.__houseText(x, y), 짚: w.__where(x, y).짚을칸, 일: w.__k7Job(x, y) || '', 풍: w.__k7Folk('장보기', x, y) }));
const 흐름 = 물건.filter(o => o[0] !== 'house').map(([k, x, y]) => { const f = w.__flowAt(x, y); return f && f.카드 != null ? { k, at: [x, y], 카드: f.카드, 짚: w.__where(x, y).짚을칸 } : null; }).filter(Boolean);
const 주민 = ['장보기', '놀이', '쉼', '배움', '건강', '붐빔', '삭막', '일자리'].map(k => w.__k7Folk(k)), 얼굴 = [1, 2].map(n => w.__bhFolk({ faceShow: n, faceUntil: Infinity }));
const 바람 = w.__k7Cards().filter(c => c.바람).map(c => c.글), 바람셈 = (s => ({ 나옴: s.나옴, 지금: s.지금.map(o => [o.이름, o.집, o.바람]) }))(w.__wishes());
const 표 = (s => ({ 가게: s.가게 || null, 까닭: s.까닭 || null, 조각수: s.조각수 == null ? null : s.조각수 }))(w.__flowShape(129, 138));
const 공급 = ${c.route ? 'w.__k7Route()' : 'null'}, 일터점 = ${c.point ? `w.__k7Point(${c.point.join(', ')})` : 'null'};
process.stdout.write('@@' + JSON.stringify({ 집, 흐름, 주민, 얼굴, 바람, 바람셈, 표, 공급, 일터점, 권유: w.__stageHint().판권유, k7: w.__k7(), 채팅: w.__chirp().켜짐, 길끌기: w.__roadLine().켜짐, wasd: w.VRULES.wasd.on, 끝: w.__flowEnd().쓰는판 }) + '\\n', () => process.exit(0));`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', src], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('close', () => { const l = out.split('\n').find(x => x.startsWith('@@')), e = (err || out).trim().split('\n');
    done(l ? JSON.parse(l.slice(2)) : { 오류: c.n + ' — ' + (e.filter(x => /Error|ERR/.test(x)).slice(-1)[0] || e.slice(-1)[0] || '출력 없음') }); }); });
{ const dir = path.join(ROOT, 'village/stages'), 바탕 = n => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')), made = [];
  const put = (id, o) => { fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ ...o, id }, null, 1)); made.push(path.join(dir, id + '.json')); };
  const ga = 바탕('empty-shop-ga'), hp = 바탕('help-places'), 판 = 시작 => ({ 이름: '시험 판', 교과: null, 시작 });
  const 끔 = 'w.VRULES.k7.on = false;', 넓힘끔 = 'w.VRULES.crowdSay.on = false; w.VRULES.widenShift.on = false;';
  const 길끊음 = 'w.__del(139, 144);', 다시이음 = "w.__put('road', 152, 140, 0); w.__tickBench(60);";   /* 일터 cut 집 둘(138,142 · 138,145 — 길 한 칸 139,144 을 지움 · 문 앞 ✨ 도 그 칸) · 밭 full(가게 담을수 1 — 이으면 가게가 곧 차서 밭이 가득 참) */
  const C = [{ n: 'ga', stage: 'empty-shop-ga', route: true }, { n: 'ga3', stage: 'zz-k7-ga3', route: true }, { n: 'gaoff', stage: 'empty-shop-ga', route: true, post: 끔 },
    { n: 'garule', stage: 'zz-k7-garule', route: true }, { n: 'na', stage: 'empty-shop-na' },
    { n: 'hint', stage: 'zz-k7-hint' }, { n: 'hint3', stage: 'onebridge' }, { n: 'hintoff', stage: 'zz-k7-hint', post: 끔 },
    { n: 'pop2', stage: 'zz-k7-pop2' }, { n: 'pop3', stage: 'zz-k7-pop3' }, { n: 'mid2', stage: 'zz-k7-mid2' }, { n: 'mid3', stage: 'zz-k7-mid3' },
    { n: 'pop2b', stage: 'zz-k7-pop2', pre: 'w.VRULES.bubbleHelp.on = false;' }, { n: 'pop3b', stage: 'zz-k7-pop3', pre: 'w.VRULES.bubbleHelp.on = false;' },
    { n: 'cut2', stage: 'zz-k7-cut2', pre: 길끊음, ticks: 600, point: [138, 145] }, { n: 'cut3', stage: 'zz-k7-cut3', pre: 길끊음, ticks: 600, point: [138, 145] },
    { n: 'full2', stage: 'zz-k7-full2', post: 다시이음 }, { n: 'full3', stage: 'zz-k7-full3', post: 다시이음 },
    { n: 'mid2w', stage: 'zz-k7-mid2', pre: 넓힘끔 }, { n: 'mid3w', stage: 'zz-k7-mid3', pre: 넓힘끔 },
    { n: 'hp', stage: 'help-places' }, { n: 'chirp', stage: 'zz-k7-chirp' }, { n: '기본', stage: null, save: 'village/stages/boards/pop88.json' },
    { n: 'end', stage: 'zz-k7-end' }, { n: 'endoff', stage: 'zz-k7-end', post: 끔 }, { n: 'pf', stage: 'proto-flow' },
    { n: 'na3', stage: 'zz-k7-na3' }, { n: 'gasay', stage: 'zz-k7-ga3', pre: 'w.VRULES.flowSay.on = false;' }];   /* PA-07 고침 — 빈 가게 na 3층 사본 · 집 카드 흐름 말(flowSay)을 끈 3층 사본 */
  const R = {};
  try { put('zz-k7-ga3', { ...ga, 안내최대층: 3 }); put('zz-k7-garule', { ...ga, 규칙: { ...(ga.규칙 || {}), k7: { on: false } } }); put('zz-k7-na3', { ...바탕('empty-shop-na'), 안내최대층: 3 });
    put('zz-k7-hint', { ...바탕('onebridge'), 안내최대층: 2 });
    put('zz-k7-pop2', { ...판('stages/boards/pop88.json'), 안내최대층: 2 }); put('zz-k7-pop3', { ...판('stages/boards/pop88.json'), 안내최대층: 3 });
    put('zz-k7-mid2', { ...판('stages/boards/mid36.json'), 안내최대층: 2 }); put('zz-k7-mid3', { ...판('stages/boards/mid36.json'), 안내최대층: 3 });
    put('zz-k7-chirp', { ...hp, 규칙: { ...(hp.규칙 || {}), chirp: { on: true } } }); put('zz-k7-end', { ...바탕('proto-flow'), 결과값: { 축1: '못받은세대', 축2: '찾은고리' } });
    { const js = { ...바탕('jobs-short'), 시작: 'stages/boards/pop88.json' }; put('zz-k7-cut2', { ...js, 안내최대층: 2 }); put('zz-k7-cut3', { ...js, 안내최대층: 3 }); }
    { const 흐름 = { ...ga.흐름, 받는곳: { shop: { 담을수: 1 } } }; put('zz-k7-full2', { ...ga, 흐름 }); put('zz-k7-full3', { ...ga, 흐름, 안내최대층: 3 }); }
    const out = new Array(C.length); let next = 0;   /* 판 하나 = 프로세스 하나 — 여섯씩 나란히 */
    await Promise.all(Array.from({ length: Math.min(6, C.length) }, async () => { while (next < C.length) { const i = next++; out[i] = await k7One(C[i]); } }));
    C.forEach((c, i) => { R[c.n] = out[i]; });
  } finally { made.forEach(f => fs.rmSync(f, { force: true })); }
  const J = JSON.stringify, 꼬리 = /주세요|봐요|보세요|이으면|볼까요|하나 더/, 줄 = r => [...r.주민, ...r.얼굴], 글 = r => r.집.map(h => h.글);
  const at = (r, x, y) => (r.흐름.find(f => f.at[0] === x && f.at[1] === y) || {}), 짚음 = r => [...r.집, ...r.흐름].filter(o => o.짚 && o.짚.length).length, 셈 = (r, k) => r.k7[k] | 0;
  const K7S = ['권유', '주민', '흐름카드', '짚기', '집', '일자리', '일터반짝', '공급', '팻말', '바람'];
  test('K7: 탐정 판(2층) 주민 · 흐름 카드 · 집 카드 · 💼 긴 말에 할 일 꼬리 0 · ✨ 짚기 0(공급 경로 ✨ 는 그대로) · 권유 null / 3층 사본 · 자유 모드 그대로 · 되돌리기 · 결과값 판 flowEnd 0 · 수업 판 💬 · 길 끌기 기본 끔(판 규칙이 켬)', () => {
    const bad = C.filter(c => !R[c.n] || R[c.n].오류); ok(!bad.length, '못 돎: ' + bad.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / '));
    const { ga, ga3, gaoff, garule, na, hint, hint3, hintoff, pop2, pop3, mid2, mid3, mid2w, mid3w, pop2b, pop3b, cut2, cut3, full2, full3, hp, chirp, 기본: base, end, endoff, pf, na3, gasay } = R;
    ok(ga.k7.판층 === 2 && ga.k7.자름 && ga3.k7.판층 === 3 && !ga3.k7.자름, '판층 ' + J([ga.k7, ga3.k7]));
    ok(줄(ga).every(t => !t.includes(' — ') && !꼬리.test(t)) && 줄(ga).filter(Boolean).length === 10 && 셈(ga, '주민') >= 9, '(가) 2층 주민 줄에 꼬리 ' + J(줄(ga)));
    ok(ga3.주민.some(t => /주세요/.test(t)) && ga3.얼굴.every(t => /보세요/.test(t)) && 셈(ga3, '주민') === 0, '(나) 3층 사본 주민 줄 꼬리 없음 — 양성 대조가 안 섬 ' + J(줄(ga3)));
    const s2 = at(ga, 129, 138), f2 = at(ga, 157, 135), s3 = at(ga3, 129, 138), f3 = at(ga3, 157, 135);
    ok(s2.카드 && !/끊겼/.test(s2.카드) && /빈 선반이에요$/.test(s2.카드) && f2.카드 && !/이으면/.test(f2.카드) && /길이 끊겨 못 가요$/.test(f2.카드), '(라) 2층 흐름 카드 ' + J([s2.카드, f2.카드]));
    ok(/끊겼어요/.test(s3.카드 || '') && /이으면/.test(f3.카드 || ''), '(라) 3층 사본 흐름 카드 꼬리 없음 — 양성 대조 ' + J([s3.카드, f3.카드]));
    ok(s2.짚 === null && ga.흐름.every(f => f.짚 === null) && J(s3.짚) === '[[152,140]]' && ga3.흐름.every(f => J(f.짚) === '[[152,140]]'), '(라) 2층 __where 짚을칸 null · 3층 [152,140] ' + J([s2.짚, s3.짚, ga3.흐름.map(f => f.짚)]));
    ok(ga.공급 && ga.공급.말 === '✂️ 여기예요' && ga.공급.짚음 === 'cut' && ga.공급.반짝 >= 1 && /이으면 가게에 닿아요$/.test((ga3.공급 || {}).말 || '') && ga3.공급.반짝 === ga.공급.반짝,
      '(라) 🔗 공급 경로 — 2층 꼬리만 뗌 · ✨ 그대로 ' + J([ga.공급, ga3.공급]));
    ok(/빈 선반이에요$/.test((at(na, 129, 138).카드) || '') && 셈(na, '흐름카드') >= 1, '(라) empty-shop-na 가게 카드 ' + J(na.흐름));
    const 가득 = r => r.흐름.filter(f => f.k === 'field' && / · 가득 찼어요/.test(f.카드)).map(f => f.카드);
    ok(가득(full3).length >= 1 && J(가득(full2)) === J(가득(full3)) && 가득(full2).every(t => /가득 찼어요 — 가져갈 곳이 없어요$/.test(t)), "(라) 정오표 ② 상태로 자름 — 가득 찬 밭은 상태 말 안의 까닭('— 가져갈 곳이 없어요')을 둠(' — ' 수로 자르면 사라짐) " + J([가득(full2), 가득(full3)]));
    ok(글(ga).every(t => !꼬리.test(t)) && 셈(ga, '흐름카드') >= 4 && 셈(ga, '짚기') >= 4 && 셈(ga, '공급') === 1, '2층 집 글 · 셈 ' + J({ 글: 글(ga), k7: ga.k7 }));
    ok(hint.권유 === null && hint.집.every(h => !/🌉/.test(h.글)) && 짚음(hint) === 0 && 셈(hint, '권유') >= 1, '(다) 2층 + 권유 판 — 판 권유 · 🌉 · ✨ 남음 ' + J({ 권유: hint.권유, 다리말: hint.집.filter(h => /🌉/.test(h.글)).length, 짚음: 짚음(hint) }));
    ok(hint3.권유 && hint3.집.some(h => /🌉/.test(h.글)) && 짚음(hint3) > 0 && hintoff.권유 && J(글(hintoff)) === J(글(hint3)), '(다) 양성 대조 onebridge 3층 · 2층에서 k7 끄면 권유 되살아남 ' + J({ 셋째층: !!hint3.권유, 끔: !!hintoff.권유 }));
    ok([pop2, mid2, mid2w].every(r => 글(r).every(t => !꼬리.test(t) && !/📚|🛣️/.test(t)) && 짚음(r) === 0 && r.집.every(h => !h.일.includes(' — '))), '(마) 2층 집 카드 · ✨ · 💼 긴 말 ' +
      J([pop2, mid2, mid2w].map(r => ({ 꼬리: 글(r).filter(t => 꼬리.test(t) || /📚|🛣️/.test(t)).slice(0, 2), 짚음: 짚음(r), 일: r.집.map(h => h.일).filter(t => t.includes(' — ')).slice(0, 2) }))));
    ok(글(pop3).some(t => /📚 /.test(t)) && 짚음(pop3) > 0 && pop3.집.some(h => / — /.test(h.일)) && 글(mid3).some(t => /🛣️ .*넓혀 봐요/.test(t)) && 글(mid3w).some(t => /넓힐 자리가 없어요/.test(t)) && !글(mid2w).some(t => /넓힐 자리가 없어요/.test(t)),
      '(마) 3층 양성 대조 — 📚 · ✨ · 긴 말 · 🛣️ 넓혀 · 넓힐 자리 없음 ' + J({ 도서관: 글(pop3).filter(t => /📚 /.test(t)).length, 짚음: 짚음(pop3), 긴말: pop3.집.filter(h => / — /.test(h.일)).length, 넓혀: 글(mid3).filter(t => /넓혀 봐요/.test(t)).length, 자리없음: 글(mid3w).filter(t => /넓힐 자리가 없어요/.test(t)).length }));
    ok(셈(pop2, '집') >= 1 && 셈(pop2, '일자리') >= 1 && 셈(mid2, '집') >= 1 && pop2.집.filter(h => h.일).every(h => /^💼 [^—]+$/.test(h.일)), '(마) 2층 셈 · 💼 짧은 까닭 ' + J({ pop2: pop2.k7, mid2: mid2.k7, 일: [...new Set(pop2.집.map(h => h.일).filter(Boolean))] }));
    const 빈 = r => 글(r).filter(t => t.startsWith('빈집이에요 · 💼'));   /* 돌아섬 말(풍선 뜻을 끄면 waitSayJob 옛 길 — 빈 집 카드와 🏠 칩이 같은 말) */
    ok(빈(pop3b).some(t => /지어 봐요/.test(t)) && 빈(pop2b).length === 빈(pop3b).length && 빈(pop2b).every(t => !/ — |봐요/.test(t)), '(마) 돌아섬 말 💼 — 2층 할 일 꼬리 0 · 3층 그대로 ' + J([[...new Set(빈(pop2b))], [...new Set(빈(pop3b))]]));
    const 집at = (r, x, y) => r.집.find(h => h.at[0] === x && h.at[1] === y) || {}, c2 = 집at(cut2, 138, 145), c3 = 집at(cut3, 138, 145);
    const 끊긴집 = r => r.집.filter(h => /이으면 일터에 닿아요|길이 끊겨 일터에 못 가요/.test(h.일));
    ok(/^💼 길 1칸만 이으면 일터에 닿아요$/.test(c3.일 || '') && cut3.일터점 >= 1 && 끊긴집(cut3).length >= 2 && 끊긴집(cut3).every(h => J(h.짚) === '[[139,144]]'), '(마) 양성 대조 — 3층 일터 cut 집 긴 말 · 문 앞 ✨(139,144) · 💼 칩 일터 ✨ 가 안 섬 ' + J({ 일: c3.일, 일터점: cut3.일터점, 짚: 끊긴집(cut3).map(h => [h.at, h.짚]) }));
    ok(c2.일 === '💼 길이 끊겨 일터에 못 가요' && 끊긴집(cut2).length === 끊긴집(cut3).length && 끊긴집(cut2).every(h => h.일 === '💼 길이 끊겨 일터에 못 가요' && h.짚 === null) && cut2.일터점 === 0 && 셈(cut2, '일터반짝') === 1,
      '(마) 2층 일터 cut 집 — 짧은 까닭 · 문 앞 ✨ 0 · 💼 칩 일터 ✨ 0 ' + J({ 일: c2.일, 집: 끊긴집(cut2).map(h => [h.at, h.일, h.짚]).slice(0, 3), 일터점: cut2.일터점, k7: cut2.k7 }));
    ok([gaoff, garule].every(r => J(r.흐름) === J(ga3.흐름) && J(줄(r)) === J(줄(ga3)) && J(글(r)) === J(글(ga3)) && J((r.공급 || {}).말) === J(ga3.공급.말)) && !gaoff.k7.자름 && !garule.k7.자름 && garule.k7.켜짐 === false,
      '(사) 되돌리기 — 연 뒤 k7 끔 · 판 규칙 k7 끔 = 3층 사본 ' + J({ gaoff: gaoff.k7, garule: garule.k7 }));
    ok([hp, ga, ga3, hint].every(r => r.채팅 === false && r.길끌기 === false && r.wasd === true) && hp.k7.판층 === 3 && !hp.k7.자름, '(바) ?stage= 판 💬 · 길 끌기 끔 · W·A·S·D 켬 ' + J([hp, ga, ga3, hint].map(r => [r.채팅, r.길끌기, r.wasd])));
    ok(chirp.채팅 === true && chirp.길끌기 === false && chirp.wasd === true, '(바) 판 규칙 chirp 켬 → 💬 true · 길 끌기 그대로 끔 ' + J([chirp.채팅, chirp.길끌기, chirp.wasd]));
    ok(base.채팅 === true && base.길끌기 === true && base.wasd === true && base.k7.판층 === 3 && !base.k7.자름 && K7S.every(k => 셈(base, k) === 0) && 글(base).some(t => /📚 /.test(t)) && 짚음(base) > 0,
      '(바) 자유 모드 셋 다 켬 · K7 길 0 · 집 글 · ✨ 그대로 ' + J({ 셋: [base.채팅, base.길끌기, base.wasd], k7: base.k7 }));
    ok(end.끝 === false && end.k7.끝카드양보 && endoff.끝 === true && !endoff.k7.끝카드양보 && pf.끝 === true, '(사) ③ flowEnd — 결과값 판 0 · k7 끄면 · proto-flow 그대로 ' + J([end.끝, endoff.끝, pf.끝]));
  });
  test("K7 고침: 탐정 판(2층) 진짜 바람 주민 카드 '있으면 좋겠어요' 0(생성 그대로) · 빈 가게 팻말 까닭 그림 0 / 3층 사본 그대로 · 풍선 뜻 🛒? 는 집 카드와 같은 까닭(층과 무관)", () => {
    const bad = C.filter(c => !R[c.n] || R[c.n].오류); ok(!bad.length, '못 돎: ' + bad.map(c => R[c.n] ? R[c.n].오류 : c.n).join(' / '));
    const { ga, ga3, gaoff, garule, na, na3, gasay, pf, 기본: base } = R, 좋겠 = /있으면 좋겠어요/, 물없음 = /가게에 물건이 없어요/;
    /* (가′) 진짜 바람 주민 — 2층은 그 집 카드의 현상 말 · 3층은 옛 말 · 바람이 생긴 셈은 같음 */
    ok([ga, na].every(r => r.바람.length >= 1 && r.바람.every(t => !좋겠.test(t) && /^💬 가게에 물건이 없어요 — /.test(t)) && 셈(r, '바람') >= 1), "(가′) 2층 진짜 바람 주민 카드에 '있으면 좋겠어요' 0 · 그 집 현상 말 " + J([ga.바람, na.바람]));
    ok([ga3, na3].every(r => r.바람.length >= 1 && r.바람.every(t => 좋겠.test(t)) && 셈(r, '바람') === 0), "(가′) 양성 대조 — 3층 사본 바람 주민 카드 '있으면 좋겠어요' " + J([ga3.바람, na3.바람]));
    ok(ga.바람셈.나옴 >= 1 && J(ga.바람셈) === J(ga3.바람셈) && J(na.바람셈) === J(na3.바람셈), '(가′) 바람이 생긴 셈(나옴 · 누구 · 어느 집 · 무엇)은 2층 = 3층 — 글만 바꿈 ' + J([ga.바람셈, ga3.바람셈, na.바람셈, na3.바람셈]));
    ok([gaoff, garule].every(r => J(r.바람) === J(ga3.바람)), '(가′) 되돌리기 — 연 뒤 k7 끔 · 판 규칙 k7 끔 = 3층 사본 바람 글 ' + J([gaoff.바람, garule.바람]));
    /* ⑨ 빈 가게 문 앞 팻말 — 2층은 까닭 그림 0(팻말째 안 섬) · 3층 · 판 규칙 k7 끔은 그대로 */
    ok([ga, na].every(r => r.표.가게 === 'empty' && r.표.까닭 === null && 셈(r, '팻말') >= 1) && ga.표.조각수 < ga3.표.조각수 && na.표.조각수 < na3.표.조각수,
      '⑨ 2층 빈 가게 팻말 까닭 그림 0 · 조각 적음 ' + J({ ga: ga.표, ga3: ga3.표, na: na.표, na3: na3.표 }));
    ok(ga3.표.까닭 === '길' && na3.표.까닭 === '밭' && garule.표.까닭 === '길' && J(garule.표) === J(ga3.표) && 셈(ga3, '팻말') === 0, "⑨ 양성 대조 — 3층 사본 '길' · '밭' · 판 규칙 k7 끔 '길' " + J({ ga3: ga3.표, na3: na3.표, garule: garule.표 }));
    /* ⑪ 풍선 뜻 🛒? — 집 카드와 같은 까닭(층과 무관) · flowSay 끄면 옛 말 · 자유 모드 0 */
    const 맞음 = r => r.집.every(h => 물없음.test(h.글) ? h.풍 === '머리 위 🛒? 가게에 물건이 없어요' : /^머리 위 🛒\? 가게가 멀어요/.test(h.풍 || ''));
    ok([ga, ga3, na, na3].every(r => r.집.some(h => 물없음.test(h.글)) && 맞음(r)), "⑪ 풍선 뜻 🛒? — 집 카드가 '가게에 물건이 없어요'인 집은 같은 까닭(2층 · 3층) " + J([ga, ga3].map(r => r.집.map(h => [물없음.test(h.글), h.풍]))));
    ok(pf.집.length >= 1 && pf.집.every(h => !물없음.test(h.글)) && 맞음(pf), "⑪ 흐름 판이라도 몫을 못 받은 집이 아니면 '가게가 멀어요' 그대로(proto-flow) " + J(pf.집.map(h => [h.글, h.풍])));
    ok(gasay.집.every(h => !물없음.test(h.글) && h.풍 === '머리 위 🛒? 가게가 멀어요 — 집 가까이 지어 주세요') && base.집.length > 0 && base.집.every(h => !물없음.test(h.풍 || '')),
      '⑪ 양성 대조 — flowSay 끄면 옛 말 · 자유 모드(흐름 없음) 0 ' + J([gasay.집.slice(0, 2).map(h => [h.글, h.풍]), [...new Set(base.집.map(h => h.풍))]]));
  });
}

results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
const f = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n요약: PASS ${results.length - f} · FAIL ${f}`);
process.exit(f ? 1 : 0);
