// 저장 왕복 시험 — 판마다 며칠 돌린 마을을 **내보내고 → 새 프로세스에서 다시 열어** 같은 마을인지 본다 (보스 09-24 무한 모드 '도구 두텁게' · [MAC-ROUNDTRIP]).
// 저장 칸이 자주 는다(배정 · 배움 · 흐름 …). 새 칸을 적기만 하고 되살리지 않으면(또는 그 반대면) 다시 연 마을이 조용히 달라진다 — 그것을 판마다 잡는다.
//   ① 글 고정점: 다시 연 마을을 곧바로 내보낸 글 == 처음 내보낸 글(칸마다 견줌)
//   ② 보이는 마을: __snapshot()(물건·집 식구/층·구역·표지판·꿈·흐름·목표·해금·이름·인구·시계) 이 같음
//      단 인구가 보이는 사람 상한(FOLK_CAP 120 · [MAC-POPCAP])을 넘으면 **누가 걸어 다니나**는 저장하지 않는다(집마다 식구 수만 저장) → 그 판은 이름을 안 견주고 '덧'에 적는다.
// 판은 하나씩 · 네트워크 0 · 창 0. 끝값: 0 모두 같음 · 1 다른 판 있음 · 2 못 돎.
//
//   node scripts/village-sim/roundtrip.mjs                       # 표준 판 열둘 · 하루 돌린 뒤
//   node scripts/village-sim/roundtrip.mjs --boards 기본+village/stages/boards/pop88.json --days 3
//   그 밖: --seed 1 · --json <파일> · --keep
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2), flag = k => args.includes('--' + k), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
const MID = 'village/stages/boards/mid36.json';
const BOARDS = opt('boards', `기본+village/stages/boards/pop88.json,기본+village/stages/boards/pop167.json,farm+${MID},farm,city,town3,town3-origin,origin,sea,mountain,proto-flow,proto-vote`).split(',').map(s => s.trim()).filter(Boolean);
const DAYS = +opt('days', '1'), SEED = +opt('seed', '1'), JSON_OUT = opt('json', null);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'village-rt-'));

/* 자식 한 번 = 마을 하나를 싣고(저장본 · 판) → n 틱 → 내보낸 글과 보이는 마을을 파일로. 모듈 상태가 전역이라 판마다 새 프로세스(run.mjs 와 같은 까닭) */
function child(saveFile, stage, ticks, outFile) {
  const f = path.join(tmp, 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.mjs');
  fs.writeFileSync(f, `import fs from 'node:fs'; import { loadVillage } from ${JSON.stringify(path.join(HERE, 'load.mjs'))};
const saveText = ${saveFile ? 'fs.readFileSync(' + JSON.stringify(saveFile) + ', "utf8")' : 'null'};
const { w } = await loadVillage({ root: ${JSON.stringify(ROOT)}, saveText, seed: ${SEED}, query: ${JSON.stringify(stage ? 'stage=' + encodeURIComponent(stage) : '')} });
if (${ticks} > 0) w.__tickBench(${ticks});
const text = w.__exportText(), snap = w.__snapshot();
fs.writeFileSync(${JSON.stringify(outFile)}, JSON.stringify({ text, snap, start: w.__START || null, 틱: w.__sim().틱 }));
process.exit(0);`);
  const r = spawnSync(process.execPath, [f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); fs.rmSync(f, { force: true });
  if (r.status !== 0 || !fs.existsSync(outFile)) throw new Error(((r.stderr || '') + (r.stdout || '')).trim().split('\n').filter(Boolean).slice(-1)[0] || '끝값 ' + r.status);
  return JSON.parse(fs.readFileSync(outFile, 'utf8'));
}
/* 깊이 견주기 — 처음 다른 자리(경로)와 다른 칸 수 */
function diffs(a, b, p = '', out = []) {
  if (out.length > 50) return out;
  if (a === b) return out; const ta = Array.isArray(a) ? 'arr' : typeof a, tb = Array.isArray(b) ? 'arr' : typeof b;
  if (ta !== tb || a === null || b === null || ta !== 'object' && ta !== 'arr') { if (JSON.stringify(a) !== JSON.stringify(b)) out.push([p || '(뿌리)', a, b]); return out; }
  if (ta === 'arr') { if (a.length !== b.length) out.push([p + '.length', a.length, b.length]); for (let i = 0; i < Math.min(a.length, b.length); i++) diffs(a[i], b[i], p + '[' + i + ']', out); return out; }
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diffs(a[k], b[k], p ? p + '.' + k : k, out)); return out;
}
const short = v => { const s = JSON.stringify(v); return s == null ? 'undefined' : s.length > 60 ? s.slice(0, 57) + '…' : s; };

const DAY_TICKS = 1800;   // 틱 · 하루 3분 ÷ 100ms — run.mjs 의 DAY 와 같게
const rows = [];
for (const spec of BOARDS) {
  const [name, save] = spec.split('+'), stage = name === '기본' ? '' : name, label = name + (save ? '+' + path.basename(save, '.json') : '');
  process.stderr.write('  ' + label + ' … '); const t0 = Date.now();
  try {
    const ticks = Math.max(1, Math.round(DAYS * DAY_TICKS));
    const A = child(save ? path.join(ROOT, save) : null, stage, ticks, path.join(tmp, 'a.json'));   // 처음: 저장본(또는 빈 땅)을 열어 며칠
    const f1 = path.join(tmp, 't1.json'); fs.writeFileSync(f1, A.text);
    const B = child(f1, stage, 0, path.join(tmp, 'b.json'));                                       // 다시: 그 글로 열고 곧바로
    const capped = s => Array.isArray(s.이름) && s.이름.length < s.인구, cap = capped(A.snap) || capped(B.snap);   // 보이는 사람 < 인구 — 누가 보이나는 저장 밖
    const nm = s => cap ? { ...s, 이름: undefined } : s;
    const d1 = diffs(JSON.parse(A.text), JSON.parse(B.text)), d2 = diffs(nm(A.snap), nm(B.snap));
    const note = cap ? `보이는 사람 ${A.snap.이름.length}/${A.snap.인구}명 → 이름 안 견줌(누가 걸어 다니나는 저장 밖)` : '';
    rows.push({ 판: label, 틱: A.틱, 글다름: d1.length, 글처음: d1[0] ? `${d1[0][0]}: ${short(d1[0][1])} → ${short(d1[0][2])}` : null, 마을다름: d2.length, 마을처음: d2[0] ? `${d2[0][0]}: ${short(d2[0][1])} → ${short(d2[0][2])}` : null, 덧: note, 다시연말: B.start });
    process.stderr.write(((Date.now() - t0) / 1000).toFixed(1) + '초\n');
  } catch (e) { rows.push({ 판: label, 실패: String(e.message || e).slice(0, 200) }); process.stderr.write('실패\n'); }
}
if (!flag('keep')) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

const L = [`저장 왕복 — 판 ${rows.length} · ${DAYS}일(하루 ${DAY_TICKS}틱) 돌린 뒤 내보내고 → 새 프로세스에서 다시 열어 곧바로 · 시드 ${SEED}`, '',
  '| 판 | 돌린 틱 | ① 글 다른 칸 | ② 마을 다른 칸 | 처음 다른 곳(처음 → 다시) | 덧 |', '|---|---|---|---|---|---|'];
let bad = 0, failed = 0;
for (const r of rows) {
  if (r.실패) { failed++; L.push(`| ${r.판} | — | 실패 | — | ${r.실패} | |`); continue; }
  if (r.글다름 || r.마을다름) bad++;
  const lost = /못 살린 것 (\d+)개/.exec(r.다시연말 || '');   // 다시 열 때 되살리지 못한 물건 — 글·마을이 같아도 적는다(곧 다시 깔리는 것일 수 있다)
  L.push(`| ${r.판} | ${r.틱} | ${r.글다름 ? '**' + r.글다름 + '**' : 0} | ${r.마을다름 ? '**' + r.마을다름 + '**' : 0} | ${r.글처음 || r.마을처음 || '—'} | ${[r.덧, lost ? '다시 열 때 못 살린 것 ' + lost[1] + '개' : ''].filter(Boolean).join(' · ')} |`);
}
L.push('', failed ? `판정: FAIL — 못 돈 판 ${failed}` : bad ? `판정: FAIL — 다시 연 마을이 달라진 판 ${bad}` : '판정: PASS — 모든 판에서 다시 연 마을이 같고, 다시 내보낸 글도 같다');
console.log(L.join('\n'));
if (JSON_OUT) fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({ days: DAYS, seed: SEED, dayTicks: DAY_TICKS, rows }, null, 1));
process.exit(failed ? 2 : bad ? 1 : 0);
