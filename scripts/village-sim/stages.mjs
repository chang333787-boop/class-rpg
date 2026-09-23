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
const 지형이름 = ['물', '모래'];   // index.html [MAC-TERRAIN] TERR_COL 과 같게(물가는 칠하기 색일 뿐)

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

/* [MAC-TERRAIN] 지형이 깔린 판을 실제로 열어 — 바닥을 읽고 · 바다엔 길 ✕ · 물가 부두 ○ · 뭍 부두 ✕ · 풀밭 나무 ○ (시뮬 · 네트워크 0) */
function terrainProbe(n, tries) {
  const f = path.join(os.tmpdir(), 'village-stages-terrain-' + process.pid + '.mjs');
  fs.writeFileSync(f, `import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText: null, seed: 1, query: 'stage=' + ${JSON.stringify(n)} });
const out = { t: w.__terrain ? w.__terrain() : null, r: ${JSON.stringify(tries)}.map(([k, x, y]) => { try { return w.__put(k, x, y, 0); } catch (e) { return 'ERR ' + e.message; } }) };
process.stdout.write('@@' + JSON.stringify(out) + '\\n'); process.exit(0);`);
  const r = spawnSync(process.execPath, [f], { encoding: 'utf8' }); fs.rmSync(f, { force: true });
  const l = (r.stdout || '').split('\n').find(x => x.startsWith('@@')); return l ? JSON.parse(l.slice(2)) : { err: (r.stderr || '').trim().split('\n').slice(-1)[0] };
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
   수용량(shopCap)은 **정원이 적힌 필요 시설이 그 판에 있을 때만** 돈다 — 기본 종류에는 정원이 없다. 도는 것만 센다(끄기 #787 과 같은 잣대).
   [MAC-FACILCAP] 가게에서 학교로(#857) — '장보기' 에서 '필요가 있는 시설 무엇이든' 으로 넓혔다. */
const 조건부 = { shopCap: def => Object.entries(def.건물정의 || {}).some(([k, t]) => t && t.need && t.정원 > 0 && (!Array.isArray(def.건물) || def.건물.includes(k))) };
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
  if (def.지형 != null) { const L = def.지형 && def.지형.칸;   /* [MAC-TERRAIN] 지형 = 바닥(칸 네모 목록 · 뒤엣것이 덮음) */
    const 나쁨 = Array.isArray(L) ? L.filter(r => !Array.isArray(r) || r.length !== 5 || r.slice(0, 4).some(v => !Number.isInteger(v) || v < 0 || v > 255) || !지형이름.includes(r[4])) : null;
    if (!나쁨) add('FAIL', P('지형'), '칸 이 배열이어야 한다');
    else if (나쁨.length) add('FAIL', P('지형'), '꼴이 틀림(네모 [x0,y0,x1,y1,이름] · 이름 ' + 지형이름.join('·') + '): ' + 나쁨.map(r => JSON.stringify(r)).join(' '));
    else { const 바닥 = new Map(); L.forEach(([x0, y0, x1, y1, nm]) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) 바닥.set(y * 256 + x, nm); });
      let 뭍 = 0; for (let y = 128; y < 160; y++) for (let x = 128; x < 160; x++) if (!바닥.has(y * 256 + x) || 바닥.get(y * 256 + x) !== '물') 뭍++;
      뭍 >= 512 ? add('PASS', P(`지형 ${L.length}네모 · ${바닥.size}칸 · 첫 구역 뭍 ${뭍}/1024`)) : add('FAIL', P('지형'), `첫 구역(128~159)의 뭍이 ${뭍}칸 — 반은 남겨야 마을이 선다`);
      /* 실제로 열어 규칙을 누른다 — 물가(모래 옆 물) 한 곳 · 바다 한 칸 · 뭍 한 칸을 첫 구역에서 찾는다 */
      const at = (x, y) => 바닥.get(y * 256 + x) || '풀';
      let 물가 = null, 바다 = null, 풀 = null;
      for (let y = 129; y < 158 && !(물가 && 바다 && 풀); y++) for (let x = 129; x < 158; x++) {
        if (!물가 && at(x, y) === '모래' && at(x, y + 1) === '물' && at(x + 1, y) === '모래' && at(x + 1, y + 1) === '물') 물가 = [x, y];
        if (!바다 && at(x, y) === '물' && at(x + 1, y) === '물' && at(x, y + 1) === '물' && at(x + 1, y + 1) === '물' && y > 130) 바다 = [x, y];
        if (!풀 && y < 140 && x > 131 && x < 150 && at(x, y) === '풀') 풀 = [x, y]; }
      if (!풀) add('REVIEW', P('지형 규칙'), '첫 구역에 풀 칸이 없어 규칙을 못 눌러 봄');
      else { const tries = [], 뜻 = [];
        if (바다) { tries.push(['road', ...바다]); 뜻.push(['바다에 길', v => typeof v === 'string' && v.includes('바다')]); }
        if (물가 && (def.건물 || []).includes('pier')) { tries.push(['pier', ...물가]); 뜻.push(['물가에 부두', v => v === true]);
          tries.push(['pier', ...풀]); 뜻.push(['뭍에 부두', v => typeof v === 'string' && v.includes('물가')]); }
        tries.push(['tree', 풀[0], 풀[1] + 4]); 뜻.push(['풀밭에 나무', v => v === true]);
        const o = terrainProbe(n, tries);
        if (!o.t || !o.t.켜짐) add('FAIL', P('지형 규칙'), '판을 열었는데 지형이 안 켜짐: ' + JSON.stringify(o));
        else { const 틀림 = 뜻.map(([m, ok], i) => ok(o.r[i]) ? null : m + ' → ' + JSON.stringify(o.r[i])).filter(Boolean);
          틀림.length ? add('FAIL', P('지형 규칙'), 틀림.join(' · ')) : add('PASS', P(`지형 규칙 ${뜻.length}가지(${뜻.map(x => x[0]).join(' · ')}) · 엔진 지형 ${o.t.칸}칸`)); } } } }
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
   켜진 판정이 하나 늘어 **한도를 넘어 FAIL** 이어야 한다(정원을 빼면 하나 줄어야 한다). 보스 09-23 '반대쪽 시험을 같이'
   [MAC-FACILCAP] 정원 시설이 상가에서 초등학교로 옮겨도 서게 — 있음은 필요 시설 하나에 정원을 적고, 없음은 모든 정원을 뺀다 */
{ const city = JSON.parse(fs.readFileSync(path.join(DIR, 'city.json'), 'utf8')); delete city.끄기;
  const 있음 = JSON.parse(JSON.stringify(city)), 없음 = JSON.parse(JSON.stringify(city));
  const 쓰는 = k => 있음.건물정의[k].need && (!Array.isArray(있음.건물) || 있음.건물.includes(k)), 이름들 = Object.keys(있음.건물정의 || {});
  const 시설 = 이름들.find(k => 쓰는(k) && 있음.건물정의[k].정원 > 0) || 이름들.find(쓰는);
  if (시설) 있음.건물정의[시설].정원 = 있음.건물정의[시설].정원 || 40; Object.values(없음.건물정의 || {}).forEach(d => { delete d.정원; });
  const a = liveOf(있음, new Set()), b = liveOf(없음, new Set());
  (a.includes('shopCap') && !b.includes('shopCap') && a.length === b.length + 1 && a.length > 한도)
    ? add('PASS', `조건부 판정 자기 시험 — city 에 정원(${시설})을 두고 끄기를 빼면 켜진 판정 ${a.length}개 > ${한도} → FAIL 로 잡힌다 (정원 없으면 ${b.length}개)`)
    : add('FAIL', '조건부 판정 자기 시험', `정원 있음 ${a.length}개(${a.join(' ')}) · 없음 ${b.length}개 — 정원이 적힌 판이 한도 넘김으로 안 잡힌다`); }

/* [MAC-STAGEOFF] 정본 2번 — 끄기를 한 번도 안 써 보면 이 칸이 서지 않는다. 판이 하나도 안 끄면 FAIL */
끈판 ? add('PASS', `판정을 끈 판 ${끈판}개 (정본 2번 — 끄기를 실제로 쓴 판이 있다)`)
     : add('FAIL', '끄기를 쓴 판', '판정 규칙을 끈 판이 하나도 없다 — 상한(≤6)이 꽉 찬 채로도 PASS 하게 된다');

results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
const c = k => results.filter(r => r[0] === k).length;
console.log(`\n요약: PASS ${c('PASS')} · REVIEW ${c('REVIEW')} · FAIL ${c('FAIL')}`);
process.exit(c('FAIL') ? 1 : 0);
