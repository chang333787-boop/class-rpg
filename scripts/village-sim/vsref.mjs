// 기준 ① 한 줄 — 지금 작업 트리와 그 ref(기본 origin/main)를 **같은 시드끼리 · 모든 표본 · 모든 지표**로 견준다 (보스 09-24 · [MAC-VSREF]).
// '옛'은 그 ref 의 village/ 를 통째로 푼 자리다(index.html · 판 파일 · vendor 모두 그 ref 것 — run.mjs 의 vs 칸 root=). 저장본은 두 쪽 다 이 저장소 것(같은 입력).
// 덤으로 '그림 흔들기'(lookseed 99): 판정이 그림 난수를 안 먹는지(#926) 같이 본다 — 이것은 늘 0 이어야 한다.
// 판은 하나씩(run.mjs 가 시드를 나눠 돌린다) · 네트워크 0 · 창 0.
//
//   node scripts/village-sim/vsref.mjs                          # origin/main 과 · 표준 판 열하나 · 2일 · 시드 1-3
//   node scripts/village-sim/vsref.mjs --ref HEAD~1 --boards 기본+village/stages/boards/pop88.json,sea --days 1 --seeds 1
//   그 밖: --no-look(흔들기 빼기) · --allow(옛과 다른 값이 있어도 끝값 0 — PR 에 '의도한 차이'로 적을 때) · --json <파일> · --keep
// 끝값: 0 PASS · 1 옛과 다름(--allow 없이) 또는 흔들기에 다른 값 · 2 못 돎
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2), flag = k => args.includes('--' + k), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
const MID = 'village/stages/boards/mid36.json';
const BOARDS = opt('boards', `기본+village/stages/boards/pop88.json,기본+village/stages/boards/pop167.json,farm+${MID},farm,city,town3,town3-origin,origin,sea,mountain,proto-flow,proto-vote`).split(',').map(s => s.trim()).filter(Boolean);
const REF = opt('ref', 'origin/main'), DAYS = opt('days', '2'), SEEDS = opt('seeds', '1-3'), LOOK = !flag('no-look'), ALLOW = flag('allow'), JSON_OUT = opt('json', null);
const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const refSha = git('rev-parse', '--short', REF); if (!refSha) { console.error('ref 를 못 찾음: ' + REF + ' (git fetch 했나?)'); process.exit(2); }
const head = git('rev-parse', '--short', 'HEAD'), dirty = !!git('status', '--porcelain', '--', 'village');

/* 그 ref 의 village/ 를 임시 폴더로 — 옛 쪽 뿌리 */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'village-vsref-')), tar = path.join(tmp, 'v.tar');
const cleanup = () => { if (!flag('keep')) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} };
{ const a = spawnSync('git', ['archive', '--format=tar', '-o', tar, REF, 'village'], { cwd: ROOT, encoding: 'utf8' }); if (a.status !== 0) { console.error('git archive 실패: ' + (a.stderr || '').trim()); cleanup(); process.exit(2); }
  const x = spawnSync('tar', ['-xf', tar, '-C', tmp], { encoding: 'utf8' }); if (x.status !== 0) { console.error('tar 실패: ' + (x.stderr || '').trim()); cleanup(); process.exit(2); } fs.rmSync(tar, { force: true }); }

const boardName = spec => { const [n, s] = spec.split('+'); return (n === '기본' ? '기본' : n) + (s ? '+' + path.basename(s, '.json') : ''); };
const rows = [];
for (const spec of BOARDS) {
  const [name, save] = spec.split('+'), out = path.join(tmp, 'r-' + rows.length + '.json');
  const a = ['--days', DAYS, '--seeds', SEEDS, '--vs', '옛: root=' + tmp, '--json', out];
  if (name !== '기본') a.unshift('--stage', name); if (save) a.unshift('--save', save); if (LOOK) a.push('--vs', '흔듦: lookseed=99');
  process.stderr.write('  ' + boardName(spec) + ' … '); const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), ...a], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0 || !fs.existsSync(out)) { const why = ((r.stderr || '') + (r.stdout || '')).trim().split('\n').filter(Boolean).slice(-1)[0] || '끝값 ' + r.status; rows.push({ 판: boardName(spec), 실패: why.slice(0, 200) }); process.stderr.write('실패\n'); continue; }
  const j = JSON.parse(fs.readFileSync(out, 'utf8')), baseName = j.variants[0].name, base = j.results.filter(x => x.name === baseName);
  const cmp = vn => { let n = 0, diff = 0, first = null; const vr = j.results.filter(x => x.name === vn);
    if (vr.length !== base.length) return { 값: 0, 다른값: -1, 처음: '표본 수가 다름' };
    for (const v of vr) { const b = base.find(x => x.seed === v.seed); if (!b) return { 값: n, 다른값: -1, 처음: '시드 ' + v.seed + ' 없음' };
      v.samples.forEach((s, i) => { const bs = b.samples[i]; if (!bs) { diff++; return; } Object.keys({ ...s.m, ...bs.m }).forEach(k => { n++; if (JSON.stringify(s.m[k]) !== JSON.stringify(bs.m[k])) { diff++; if (!first) first = `${k} · 시드 ${v.seed} · 틱 ${bs.tick}: ${JSON.stringify(s.m[k])} → ${JSON.stringify(bs.m[k])}`; } }); }); }
    return { 값: n, 다른값: diff, 처음: first }; };
  const old = cmp('옛'), look = LOOK ? cmp('흔듦') : null;
  rows.push({ 판: boardName(spec), 값: old.값, 옛다름: old.다른값, 옛처음: old.처음, 흔듦다름: look ? look.다른값 : null, 흔듦처음: look ? look.처음 : null });
  process.stderr.write(((Date.now() - t0) / 1000).toFixed(1) + '초\n');
}
cleanup();

/* 표 — 처음 다른 곳은 '옛 → 지금'으로 적는다 */
const L = [`기준 ① — 옛 = ${REF} (${refSha} · 판 파일·vendor 까지) · 지금 = 작업 트리 ${head}${dirty ? ' + 고친 것' : ''} · ${DAYS}일 · 시드 ${SEEDS} · 값 = 모든 표본의 모든 지표${LOOK ? ' · 그림 흔들기 = lookseed 99' : ''}`, '',
  `| 판 | 값 | 옛과 다른 값 |${LOOK ? ' 그림 흔들기 다른 값 |' : ''} 처음 다른 곳(옛 → 지금) |`, `|---|---|---|${LOOK ? '---|' : ''}---|`];
let oldBad = 0, lookBad = 0, failed = 0;
for (const r of rows) {
  if (r.실패) { failed++; L.push(`| ${r.판} | — | 실패 |${LOOK ? ' — |' : ''} ${r.실패} |`); continue; }
  if (r.옛다름) oldBad++; if (r.흔듦다름) lookBad++;
  const first = r.옛처음 ? r.옛처음 : r.흔듦처음 ? '흔들기 · ' + r.흔듦처음 + '(흔든 쪽 → 지금)' : '—';   // cmp 가 이미 '비교 쪽 → 지금' 순서로 적는다
  L.push(`| ${r.판} | ${r.값} | ${r.옛다름 ? '**' + r.옛다름 + '**' : 0} |${LOOK ? ' ' + (r.흔듦다름 ? '**' + r.흔듦다름 + '**' : 0) + ' |' : ''} ${first} |`);
}
const verdict = failed ? 'FAIL — 못 돈 판 ' + failed : lookBad ? 'FAIL — 그림 난수를 흔들었더니 판정 값이 움직인 판 ' + lookBad + ' (판정 코드가 Math.random 을 쓰나? #926)'
  : oldBad ? (ALLOW ? 'PASS(허용) — 옛과 다른 판 ' + oldBad + ' · PR 에 의도한 차이로 적을 것' : 'FAIL — 옛과 다른 판 ' + oldBad + ' (의도한 차이면 --allow 로 · PR 에 적기)') : 'PASS — 모든 판에서 옛과 같고' + (LOOK ? ', 그림 난수를 흔들어도 판정이 같다' : '');
L.push('', '판정: ' + verdict);
console.log(L.join('\n'));
if (JSON_OUT) fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({ ref: REF, refSha, head, dirty, days: DAYS, seeds: SEEDS, rows }, null, 1));
process.exit(failed ? 2 : (lookBad || (oldBad && !ALLOW)) ? 1 : 0);
