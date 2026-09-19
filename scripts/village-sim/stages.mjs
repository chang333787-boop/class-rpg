// 판(스테이지) 파일 검사 — village/stages/*.json (엔진 제안서 ② · 사회시뮬 흡수 C1·C2·C4·C10)
// ① 칸 모양 ② 교과 칸이 docs/village_curriculum_map.md 에 있나 ③ 시작 땅 파일 ④ 규칙 키가 VRULES 에 있나 ⑤ 건물 종류가 있나
// ⑥ VRULES 가 전부 rules.json 에 분류됐나(새 규칙은 판정/연기… 한 줄 필수) ⑦ 판이 바꾸는 판정 규칙 ≤ 3 (FAIL) · 수업 판(교과 칸 있음)은 켜진 판정 규칙 ≤ 6 (FAIL) — 자유 놀이 판은 면제
// ⑧ 판을 실제로 얹어 하루 돈다(시뮬 · 네트워크 0 · 판 오류 없음)
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..'), DIR = path.join(ROOT, 'village/stages');
const results = [];
const add = (kind, name, why) => results.push([kind, name, why || '']);
const FIELDS = ['id', '이름', '교과', '질문', '되돌아보기', '현상', '변수', '시작', '규칙', '건물', '목표'];
const SEMS = { kind: g => typeof g.k === 'string' && g.n > 0, pop: g => g.n > 0, hook: g => typeof g.훅 === 'string' && typeof g.n === 'number' && ['>=', '<='].includes(g.비교) };
const HOOKS = ['일닿음%'];   // index.html STAGE_HOOKS 와 같게

/* 마을을 한 번 실어 VRULES 기본값·건물 종류를 읽는다(시뮬 · 네트워크 0) */
const probe = path.join(os.tmpdir(), 'village-stages-probe-' + process.pid + '.mjs');
fs.writeFileSync(probe, `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1 });
process.stdout.write('@@' + JSON.stringify({ vrules: w.VRULES }) + '\\n'); process.exit(0);`);
const pr = spawnSync(process.execPath, [probe], { encoding: 'utf8' }); fs.rmSync(probe, { force: true });
const line = (pr.stdout || '').split('\n').find(l => l.startsWith('@@'));
if (!line) { console.log('FAIL 마을을 못 실음 —', (pr.stderr || '').trim().split('\n').slice(-2).join(' ')); process.exit(1); }
const { vrules } = JSON.parse(line.slice(2));

/* 건물 종류 확인: 판 밖 칸에 놓아 보면 모르는 종류는 오류가 난다(load.mjs 의 run.mjs 와 같은 꾀) */
function kindsOk(list) {
  const f = path.join(os.tmpdir(), 'village-stages-kinds-' + process.pid + '.mjs');
  fs.writeFileSync(f, `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1 });
const bad = ${JSON.stringify(list)}.filter(k => { try { w.__put(k, -1, -1, 0); return false; } catch { return true; } });
process.stdout.write('@@' + JSON.stringify(bad) + '\\n'); process.exit(0);`);
  const r = spawnSync(process.execPath, [f], { encoding: 'utf8' }); fs.rmSync(f, { force: true });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); return l ? JSON.parse(l.slice(2)) : list;
}

const rulesMap = JSON.parse(fs.readFileSync(path.join(DIR, 'rules.json'), 'utf8')).규칙;
const missing = Object.keys(vrules).filter(k => !rulesMap[k]), extra = Object.keys(rulesMap).filter(k => !vrules[k]);
if (missing.length) add('FAIL', 'rules.json 분류', '분류 안 된 VRULES: ' + missing.join(' ')); else add('PASS', `rules.json 분류 (VRULES ${Object.keys(vrules).length}개 전부)`);
if (extra.length) add('REVIEW', 'rules.json', 'VRULES 에 없는 키: ' + extra.join(' '));
const judge = Object.keys(rulesMap).filter(k => rulesMap[k] === '판정');
const curri = fs.readFileSync(path.join(ROOT, 'docs/village_curriculum_map.md'), 'utf8');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'rules.json').sort();
for (const f of files) {
  const n = f.replace(/\.json$/, ''), P = s => `${n}: ${s}`;
  let def; try { def = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { add('FAIL', P('JSON'), e.message); continue; }
  const lack = FIELDS.filter(k => !(k in def)); lack.length ? add('FAIL', P('칸'), '없는 칸: ' + lack.join(' ')) : add('PASS', P('칸 ' + FIELDS.length + '개'));
  def.id === n && /^[a-z0-9\-]{1,40}$/.test(n) ? add('PASS', P('id = 파일 이름')) : add('FAIL', P('id'), `id ${def.id} · 파일 ${n} (소문자·숫자·- 만)`);
  if (def.교과 != null) curri.includes('| ' + def.교과 + ' |') ? add('PASS', P('교과 칸이 교과 지도에 있음')) : add('FAIL', P('교과'), `docs/village_curriculum_map.md 에 '| ${def.교과} |' 가 없음`);
  if (def.시작 != null) fs.existsSync(path.join(ROOT, 'village', def.시작)) ? add('PASS', P('시작 땅 ' + def.시작)) : add('FAIL', P('시작'), 'village/' + def.시작 + ' 없음');
  const rk = Object.keys(def.규칙 || {}), unk = rk.filter(k => !vrules[k]);
  unk.length ? add('FAIL', P('규칙'), 'VRULES 에 없음: ' + unk.join(' ')) : add('PASS', P(`규칙 ${rk.length}개 모두 VRULES 에 있음`));
  const changed = rk.filter(k => rulesMap[k] === '판정' && vrules[k] && Object.keys(def.규칙[k]).some(x => JSON.stringify(def.규칙[k][x]) !== JSON.stringify(vrules[k][x])));
  changed.length <= 3 ? add('PASS', P(`기본과 다른 판정 규칙 ${changed.length}개 (≤3)` + (changed.length ? ': ' + changed.join(' ') : ''))) : add('FAIL', P('판정 규칙 차이'), `${changed.length}개 > 3: ${changed.join(' ')}`);
  const live = judge.filter(k => vrules[k] && ((def.규칙 || {})[k] && 'on' in def.규칙[k] ? def.규칙[k].on : vrules[k].on));
  if (def.교과 == null) add('PASS', P(`켜진 판정 규칙 ${live.length}개 — 자유 놀이 판(교과 없음)이라 ≤6 면제`));   // 보스 09-20: ≤6 은 수업 판에만
  else add(live.length <= 6 ? 'PASS' : 'FAIL', P(`켜진 판정 규칙 ${live.length}개`) + (live.length > 6 ? '' : ' (≤6 · 수업 판)'), live.length > 6 ? '수업 판은 6 까지 — ' + live.join(' ') : '');
  if (def.변수 != null && !rk.includes(def.변수)) add('REVIEW', P('변수'), `'${def.변수}' 가 규칙 칸에 없음`);
  if (def.건물 != null) { const bad = kindsOk(def.건물); bad.length ? add('FAIL', P('건물'), '없는 종류: ' + bad.join(' ')) : add('PASS', P(`건물 ${def.건물.length}종`)); if (!def.건물.includes('road')) add('FAIL', P('건물'), '길(road)이 없음'); }
  const gbad = (def.목표 || []).filter(g => !g.t || !SEMS[g.셈] || !SEMS[g.셈](g) || (g.셈 === 'hook' && !HOOKS.includes(g.훅)));
  gbad.length ? add('FAIL', P('목표'), '셈 꼴이 틀림: ' + gbad.map(g => g.t || '?').join(' · ')) : add('PASS', P(`목표 ${(def.목표 || []).length}개 셈 꼴`));
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--stage', n, '--days', '1', '--seeds', '1', '--json', path.join(os.tmpdir(), 'vs-stage-' + n + '.json')], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { add('FAIL', P('시뮬로 얹기'), (r.stderr || r.stdout).trim().split('\n').slice(-1)[0]); continue; }
  const j = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'vs-stage-' + n + '.json'), 'utf8')), res = j.results[0];
  const ok = res.네트워크 === 0 && res.판 && res.판.id === n && !res.판.모르는규칙.length;
  ok ? add('PASS', P(`시뮬로 얹어 하루 돎 · 인구 ${res.samples[0].m.인구}→${res.samples[res.samples.length - 1].m.인구} · 네트워크 0`)) : add('FAIL', P('시뮬로 얹기'), JSON.stringify({ 네트워크: res.네트워크, 판: res.판 }));
}

results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
const c = k => results.filter(r => r[0] === k).length;
console.log(`\n요약: PASS ${c('PASS')} · REVIEW ${c('REVIEW')} · FAIL ${c('FAIL')}`);
process.exit(c('FAIL') ? 1 : 0);
