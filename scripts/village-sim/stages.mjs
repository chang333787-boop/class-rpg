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
const HOOKS = ['일닿음%', '다있음%'];   // index.html STAGE_HOOKS 와 같게

/* 마을을 한 번 실어 VRULES 기본값·건물 종류를 읽는다(시뮬 · 네트워크 0) */
const probe = path.join(os.tmpdir(), 'village-stages-probe-' + process.pid + '.mjs');
fs.writeFileSync(probe, `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1 });
process.stdout.write('@@' + JSON.stringify({ vrules: w.VRULES, 끄기이름: (w.__stageOff ? w.__stageOff().쓸수있는이름 : null) }) + '\\n'); process.exit(0);`);
const pr = spawnSync(process.execPath, [probe], { encoding: 'utf8' }); fs.rmSync(probe, { force: true });
const line = (pr.stdout || '').split('\n').find(l => l.startsWith('@@'));
if (!line) { console.log('FAIL 마을을 못 실음 —', (pr.stderr || '').trim().split('\n').slice(-2).join(' ')); process.exit(1); }
const { vrules, 끄기이름 } = JSON.parse(line.slice(2));

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
/* [MAC-STAGEOFF] 묶음 표는 rules.json 한 곳에만 둔다 — index.html 의 SOFF_ALL 과 같은지, 든 규칙이 판정인지 */
const 묶음 = JSON.parse(fs.readFileSync(path.join(DIR, 'rules.json'), 'utf8')).묶음 || {};
const 묶음이름 = Object.keys(묶음);
if (!끄기이름) add('FAIL', '끄기 묶음', 'index.html 에 __stageOff 가 없다(MAC-STAGEOFF 가 안 실렸다)');
else {
  const 빠짐 = 끄기이름.filter(k => !묶음이름.includes(k)), 남음 = 묶음이름.filter(k => !끄기이름.includes(k));
  (빠짐.length || 남음.length)
    ? add('FAIL', '끄기 묶음 이름', 'rules.json 과 index.html 이 다르다 — 코드에만: ' + (빠짐.join(' ') || '없음') + ' · 표에만: ' + (남음.join(' ') || '없음'))
    : add('PASS', `끄기 묶음 이름 ${묶음이름.length}개가 코드와 같음 (${묶음이름.join('·')})`);
  const 안판정 = 묶음이름.flatMap(g => 묶음[g].filter(k => rulesMap[k] !== '판정').map(k => g + ':' + k));
  안판정.length ? add('FAIL', '끄기 묶음 속', '판정이 아닌 규칙: ' + 안판정.join(' ')) : add('PASS', '끄기 묶음 속이 모두 판정 규칙');
}
let 끈판 = 0;
/* [MAC-SHOPCAP] ㉮ 조건부 판정 — 그 판에서 한 줄도 안 도는 규칙은 켜진 판정으로 세지 않는다(보스 09-23 · 설계 5-나).
   수용량(shopCap)은 **정원이 적힌 장보기 건물이 그 판에 있을 때만** 돈다 — 기본 shop 에는 정원이 없다. 도는 것만 센다(끄기 #787 과 같은 잣대) */
const 조건부 = { flowGrow: def => !!(def.흐름 && def.흐름.on),   /* [MAC-FLOWGROW] 흐름이 켜진 판에서만 돈다 */
  shopCap: def => Object.entries(def.건물정의 || {}).some(([k, t]) => t && t.need === '장보기' && t.정원 > 0 && (!Array.isArray(def.건물) || def.건물.includes(k))) };
const 한도 = 6;   // 수업 판(교과 칸 있음)의 켜진 판정 규칙 상한
const liveOf = (def, 끈것) => judge.filter(k => !끈것.has(k) && vrules[k] && (!조건부[k] || 조건부[k](def)) && ((def.규칙 || {})[k] && 'on' in def.규칙[k] ? def.규칙[k].on : vrules[k].on));
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
  /* [MAC-STAGEOFF] 판이 끄는 묶음 — 모르는 이름은 조용히 지나가면 안 된다(아무것도 안 꺼진 채 PASS 한다) */
  let 끈것 = new Set();
  if (def.끄기 != null) {
    if (!Array.isArray(def.끄기)) add('FAIL', P('끄기'), '배열이어야 한다');
    else { const 모름 = def.끄기.filter(g => !묶음이름.includes(String(g)));
      if (모름.length) add('FAIL', P('끄기'), '모르는 묶음 이름: ' + 모름.map(x => JSON.stringify(x)).join(' ') + ' — 쓸 수 있는 것: ' + 묶음이름.join('·'));
      else { def.끄기.forEach(g => (묶음[g] || []).forEach(k => 끈것.add(k)));
        add('PASS', P(`끄기 ${def.끄기.length}묶음 (${def.끄기.join('·')}) → 판정 ${끈것.size}개를 끔`)); 끈판++; } }
  }
  const live = liveOf(def, 끈것);   /* [MAC-SHOPCAP] ㉮ 조건부 규칙은 그 판에서 돌 때만 */
  if (def.교과 == null) add('PASS', P(`켜진 판정 규칙 ${live.length}개 — 자유 놀이 판(교과 없음)이라 ≤6 면제`));   // 보스 09-20: ≤6 은 수업 판에만
  else add(live.length <= 한도 ? 'PASS' : 'FAIL', P(`켜진 판정 규칙 ${live.length}개`) + (끈것.size ? ` — 끄기 뒤 (끄기 전 ${live.length + 끈것.size})` : '') + (live.length > 한도 ? '' : ' (≤6 · 수업 판)'), live.length > 한도 ? '수업 판은 6 까지 — ' + live.join(' ') : '');
  if (def.변수 != null && !rk.includes(def.변수)) add('REVIEW', P('변수'), `'${def.변수}' 가 규칙 칸에 없음`);
  if (def.모습 != null) { const S = def.모습, 철 = ['봄', '여름', '가을', '겨울'];   /* [MAC-SKIN] */
    const 나쁨 = [];
    if (S.계절 != null && !철.includes(S.계절)) 나쁨.push('계절');
    ['풀', '바닥'].forEach(k => { const v = S[k]; if (v != null && !(typeof v === 'string' && (/^#[0-9a-fA-F]{6}$/.test(v) || /^[a-zA-Z]+$/.test(v)))) 나쁨.push(k); });
    나쁨.length ? add('FAIL', P('모습'), '칸이 틀림: ' + 나쁨.join(' ')) : add('PASS', P('모습 칸(계절·풀·바닥)')); }
  /* [MAC-SKIN] 판이 스스로 만드는 종류(건물정의)는 기본 판에 없는 게 맞다 — 빼고 검사하고, 정의 자체를 따로 본다 */
  const 새종류 = def.건물정의 && typeof def.건물정의 === 'object' ? Object.keys(def.건물정의) : [];
  if (새종류.length) {
    const G = ['box', 'cyl', 'cone', 'half', 'sph'];
    const 나쁨 = 새종류.filter(k => { const t = def.건물정의[k];
      return !/^[a-z][a-z0-9_]{1,15}$/.test(k) || !t || !Array.isArray(t.parts) || !t.parts.length
        || t.parts.some(q => !q || !G.includes(q.g) || !Array.isArray(q.s) || q.s.length !== 3 || !Array.isArray(q.p) || q.p.length !== 3 || q.c == null); });
    나쁨.length ? add('FAIL', P('건물정의'), '꼴이 틀림: ' + 나쁨.join(' ')) : add('PASS', P(`건물정의 ${새종류.length}종(모양 조각 꼴 OK)`));
    const 겹침 = 새종류.filter(k => !kindsOk([k]).length);
    if (겹침.length) add('FAIL', P('건물정의'), '이미 있는 종류를 덮으려 함: ' + 겹침.join(' '));
  }
  if (def.건물 != null) { const bad = kindsOk(def.건물.filter(k => !새종류.includes(k))); bad.length ? add('FAIL', P('건물'), '없는 종류: ' + bad.join(' ')) : add('PASS', P(`건물 ${def.건물.length}종`)); if (!def.건물.includes('road')) add('FAIL', P('건물'), '길(road)이 없음'); }
  const gbad = (def.목표 || []).filter(g => !g.t || !SEMS[g.셈] || !SEMS[g.셈](g) || (g.셈 === 'hook' && !HOOKS.includes(g.훅)));
  gbad.length ? add('FAIL', P('목표'), '셈 꼴이 틀림: ' + gbad.map(g => g.t || '?').join(' · ')) : add('PASS', P(`목표 ${(def.목표 || []).length}개 셈 꼴`));
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--stage', n, '--days', '1', '--seeds', '1', '--json', path.join(os.tmpdir(), 'vs-stage-' + n + '.json')], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { add('FAIL', P('시뮬로 얹기'), (r.stderr || r.stdout).trim().split('\n').slice(-1)[0]); continue; }
  const j = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'vs-stage-' + n + '.json'), 'utf8')), res = j.results[0];
  const ok = res.네트워크 === 0 && res.판 && res.판.id === n && !res.판.모르는규칙.length;
  if (새종류.length) { const 생김 = (res.판 && res.판.새종류 || []).map(String);   /* [MAC-SKIN] 판을 실제로 열었을 때 생겼나 */
    const 빠짐 = 새종류.filter(k => !생김.includes(k));
    빠짐.length ? add('FAIL', P('건물정의'), '판을 열었는데 안 생긴 종류: ' + 빠짐.join(' ')) : add('PASS', P(`건물정의 ${새종류.length}종이 판에서 실제로 생김`)); }
  ok ? add('PASS', P(`시뮬로 얹어 하루 돎 · 인구 ${res.samples[0].m.인구}→${res.samples[res.samples.length - 1].m.인구} · 네트워크 0`)) : add('FAIL', P('시뮬로 얹기'), JSON.stringify({ 네트워크: res.네트워크, 판: res.판 }));
}

/* [MAC-SHOPCAP] ㉮ 반대쪽 자기 시험 — 조건부 셈이 규칙을 **숨기지 않나**. city 를 베껴 끄기를 빼고 상가에 정원을 적으면
   켜진 판정이 하나 늘어 **한도를 넘어 FAIL** 이어야 한다(정원을 빼면 하나 줄어야 한다). 보스 09-23 '반대쪽 시험을 같이' */
{ const city = JSON.parse(fs.readFileSync(path.join(DIR, 'city.json'), 'utf8')); delete city.끄기;
  const 있음 = JSON.parse(JSON.stringify(city)), 없음 = JSON.parse(JSON.stringify(city));
  있음.건물정의.store.정원 = 6; delete 없음.건물정의.store.정원;
  const a = liveOf(있음, new Set()), b = liveOf(없음, new Set());
  (a.includes('shopCap') && !b.includes('shopCap') && a.length === b.length + 1 && a.length > 한도)
    ? add('PASS', `조건부 판정 자기 시험 — city 에 정원을 적고 끄기를 빼면 켜진 판정 ${a.length}개 > ${한도} → FAIL 로 잡힌다 (정원 없으면 ${b.length}개)`)
    : add('FAIL', '조건부 판정 자기 시험', `정원 있음 ${a.length}개(${a.join(' ')}) · 없음 ${b.length}개 — 정원이 적힌 판이 한도 넘김으로 안 잡힌다`); }

/* [MAC-STAGEOFF] 정본 2번 — 끄기를 한 번도 안 써 보면 이 칸이 서지 않는다. 판이 하나도 안 끄면 FAIL */
끈판 ? add('PASS', `판정을 끈 판 ${끈판}개 (정본 2번 — 끄기를 실제로 쓴 판이 있다)`)
     : add('FAIL', '끄기를 쓴 판', '판정 규칙을 끈 판이 하나도 없다 — 상한(≤6)이 꽉 찬 채로도 PASS 하게 된다');

results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
const c = k => results.filter(r => r[0] === k).length;
console.log(`\n요약: PASS ${c('PASS')} · REVIEW ${c('REVIEW')} · FAIL ${c('FAIL')}`);
process.exit(c('FAIL') ? 1 : 0);
