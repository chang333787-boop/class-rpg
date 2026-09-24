// 마을 시뮬 도구 시험 — 네트워크 0 · 같은 시드는 같은 값 · 한 수가 표에 잡힌다 (약 20초)
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
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

/* [MAC-NOWATER] 물 끔 — 기본 마을은 필요 셋 · 옛 우물 숨김 · 목표 bench1 · 우물을 지키는 판(town3)은 옛 넷 · 옛 저장본의 well 은 bench1 으로 이어진다 */
test('물 끔: 기본 마을 필요 셋 · town3 는 물 그대로 · pop88 은 목표 bench1 을 잇는다', () => {
  const nw = (query, save) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${save ? `fs.readFileSync(${JSON.stringify(path.join(ROOT, save))}, 'utf8')` : 'null'}, seed: 1, query: ${JSON.stringify(query)} });
process.stdout.write('@@' + JSON.stringify(w.__needWater()) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8' });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('__needWater 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const a = nw(''), b = nw('stage=town3'), c = nw('', 'village/stages/boards/pop88.json');
  ok(a.필요.join() === '장보기,놀이,쉼' && a.돌아섬필요.join() === '장보기,놀이,쉼', '기본 필요 ' + a.필요.join());
  ok(a.우물.필요 === null && a.우물.묶음 === '(숨김)' && a.분수 === '쉼' && a.연못.join() === '쉼,', '우물·분수·연못 ' + JSON.stringify([a.우물, a.분수, a.연못]));
  ok(a.목표.join() === 'bench1' && a.말.셋멀.startsWith('두 가지 더') && a.말.점.join() === '○○,●○,●●', '목표·말 ' + JSON.stringify([a.목표, a.말]));
  ok(!b.물끔 && b.필요.join() === '물,장보기,놀이,쉼' && b.목표.join() === 'well' && b.말.셋멀.startsWith('하나만 더'), 'town3 ' + JSON.stringify(b.필요));
  ok(c.이음 === true && c.목표이음 === 1, 'pop88 이음 ' + c.이음);
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

/* [MAC-HEALTH] 건강 — 인구 100 이면 켜지고 저장 칸 건강:1 로 다시 열어도 · 판 규칙이 없는 수업 판(jobs-short)·물을 지키는 판(town3)은 없음 · 규칙을 적은 수업 판(onebridge · PR 3b)은 있음 · 스위치를 끄면 없음 */
test('건강: pop167 은 50틱 뒤 건강 · 다시 열어도 · jobs-short·town3 은 없음 · onebridge(규칙)는 있음 · 끄면 없음', () => {
  const hl = (query, save, pre, ticks) => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))}; import fs from 'node:fs';
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: ${save ? `fs.readFileSync(${JSON.stringify(path.isAbsolute(save) ? save : path.join(ROOT, save))}, 'utf8')` : 'null'}, seed: 1, query: ${JSON.stringify(query)} });
${pre || ''}
if (${ticks | 0} > 0) w.__tickBench(${ticks | 0});
process.stdout.write('@@' + JSON.stringify({ h: w.__health(), t: w.__exportText() }) + '\\n'); process.exit(0);`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); if (!l) throw new Error('__health 없음: ' + (r.stderr || '').trim().split('\n').slice(-1)[0]); return JSON.parse(l.slice(2)); };
  const P = 'village/stages/boards/pop167.json', tf = path.join(os.tmpdir(), 'village-sim-test-health-' + process.pid + '.json');
  const a = hl('', null, '', 0), b = hl('', P, '', 50); fs.writeFileSync(tf, b.t);
  const c = hl('', tf, '', 0), d = hl('stage=jobs-short', null, '', 50), g = hl('stage=onebridge', null, '', 50), e = hl('stage=town3', null, '', 0), f = hl('', P, 'w.VRULES.health.on = false;', 50); fs.rmSync(tf, { force: true });
  ok(a.h.필요.join() === '장보기,놀이,쉼' && a.h.돌아섬필요.join() === '장보기,놀이,쉼' && a.h.의원.필요 === '건강' && a.h.의원.트레이 && a.h.의원.해금 === 80, '빈 땅 ' + JSON.stringify(a.h.의원));
  ok(b.h.걸쇠 && b.h.필요.join() === '장보기,놀이,쉼,배움,건강' && b.h.의원.열림 && /"건강":\s*1/.test(b.t), 'pop167 ' + b.h.필요.join());
  ok(c.h.걸쇠 && c.h.필요.join() === '장보기,놀이,쉼,배움,건강' && c.h.되살림 === 1, '다시 열기 ' + c.h.필요.join());
  ok(!d.h.제공 && !d.h.필요.includes('건강'), 'jobs-short ' + d.h.필요.join());
  ok(g.h.제공 && g.h.필요.includes('건강'), 'onebridge(규칙 health) ' + g.h.필요.join());
  ok(!e.h.제공 && e.h.필요.join() === '물,장보기,놀이,쉼' && e.h.의원.필요 === null, 'town3 ' + e.h.필요.join());
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

results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
const f = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n요약: PASS ${results.length - f} · FAIL ${f}`);
process.exit(f ? 1 : 0);
