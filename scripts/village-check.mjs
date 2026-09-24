// 마을 PR 검사 한 줄 — 마을 PR 을 올리기 전에 돌리는 것을 **차례로 하나씩** 돌리고 한 표로 (보스 09-24 무한 모드 '도구 두텁게' · [MAC-CHECK]).
//   ① module node --check(village/index.html 의 <script type="module"> 를 떼어) ② verify-safety ③ village-paint ④ village-sim 시험 ⑤ 판 검사(stages)
//   ⑥ 저장 왕복(roundtrip — 며칠 돌려 내보내고 다시 열어 같은 마을인가) ⑦ 기준 ① — vsref(그 ref 를 통째로 푼 뿌리와 · 그림 흔들기 덤) ⑧ 화면 회귀 — village-look --vs-ref(그림)
// 무거운 것(⑦⑧)은 한 번에 하나. 창 0 · 네트워크 0(⑧은 전용 headless · 바깥 주소 막음). 끝값: 0 모두 통과 · 1 하나라도 FAIL · 2 못 돎.
//
//   node scripts/village-check.mjs                    # 전부 — origin/main 과(vsref 2일·시드 1-3 · look 세 장면 — 약 3~4분)
//   node scripts/village-check.mjs --quick            # ⑥ 하루 ⑦ 하루·시드 1 · ⑧ default 장면만(잰 값 약 1분 50초)
//   node scripts/village-check.mjs --skip look,vsref  # 고르기(module·safety·paint·sim·stages·roundtrip·vsref·look)
//   node scripts/village-check.mjs --ref HEAD~1       # ⑦⑧ 의 견줄 쪽
//   그 밖: --allow(⑦ 에서 옛과 다른 값을 허용 — 의도한 차이 · PR 에 적는다) · --max <%>(⑧ 허용 차이)
// [MAC-CHECKCHANGED] PR 이 바꾼 판은 스스로 더한다 — `git diff --name-only <ref>`(+ 새 파일)에 판 파일(stages/<id>.json) · 시작 땅(stages/starts/*) · 저장본(stages/boards/*)이
//   있으면 그 판을 ⑦⑧ 에 더하고, 그 판의 차이는 FAIL 이 아니라 '⚠ 바뀐 판 — 의도한 차이? PR 에 적기' 줄로 보인다. rules.json · README 같은 공용 파일만 바뀐 것은 빼고,
//   옛(ref)에 없는 새 판은 '새 판 — 옛에 없음'(견주지 않음). 끄기: --no-changed
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = k => args.includes('--' + k), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
const REF = opt('ref', 'origin/main'), QUICK = flag('quick'), SKIP = new Set(String(opt('skip', '')).split(',').map(s => s.trim()).filter(Boolean));
const node = (file, a = [], ms = 900000) => { const t0 = Date.now(); const r = spawnSync(process.execPath, [path.join(ROOT, file), ...a], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 27, timeout: ms });
  return { code: r.status == null ? -1 : r.status, out: (r.stdout || '') + (r.stderr || ''), sec: (Date.now() - t0) / 1000 }; };
const last = (s, re) => { const m = String(s).split('\n').filter(l => re.test(l)); return m.length ? m[m.length - 1].trim() : null; };

/* ① module — index.html 의 module 을 떼어 node --check(줄 번호는 index.html 기준으로 옮겨 적는다) */
function moduleCheck() { const t0 = Date.now(), html = fs.readFileSync(path.join(ROOT, 'village/index.html'), 'utf8'), m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) return { ok: false, 요약: 'module 스크립트를 못 찾음', sec: 0 };
  const f = path.join(os.tmpdir(), 'village-check-' + process.pid + '.mjs'); fs.writeFileSync(f, m[1]);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); fs.rmSync(f, { force: true });
  const base = html.slice(0, m.index).split('\n').length, err = (r.stderr || '').replace(/\S*village-check-\d+\.mjs/g, 'module').replace(/:(\d+)\n/, (s, n) => ' · index.html ' + (+n + base - 1) + '줄 무렵\n').split('\n').filter(Boolean).slice(0, 2).join(' ');
  return { ok: r.status === 0, 요약: r.status === 0 ? 'MODULE_OK' : err.slice(0, 200), sec: (Date.now() - t0) / 1000 }; }

const STEPS = [
  ['module', 'module node --check', () => moduleCheck()],
  ['safety', 'verify-safety', () => { const r = node('scripts/verify-safety.mjs'); const s = last(r.out, /^요약:/); return { ok: r.code === 0 && /FAIL 0/.test(s || ''), 요약: s || '요약 줄 없음', sec: r.sec }; }],
  ['paint', 'village-paint', () => { const r = node('scripts/village-paint/test.mjs'); const s = last(r.out, /^요약:/); return { ok: r.code === 0 && /FAIL 0/.test(s || ''), 요약: s || '요약 줄 없음', sec: r.sec }; }],
  ['sim', 'village-sim 시험', () => { const r = node('scripts/village-sim/test.mjs'); const s = last(r.out, /^요약:/); return { ok: r.code === 0 && /FAIL 0/.test(s || ''), 요약: s || '요약 줄 없음', sec: r.sec, 실패: r.out.split('\n').filter(l => l.startsWith('FAIL')).slice(0, 3) }; }],
  ['stages', '판 검사(stages)', () => { const r = node('scripts/village-sim/stages.mjs'); const s = last(r.out, /^요약:/); return { ok: r.code === 0 && /FAIL 0/.test(s || ''), 요약: s || '요약 줄 없음', sec: r.sec, 실패: r.out.split('\n').filter(l => l.startsWith('FAIL')).slice(0, 3) }; }],
  ['roundtrip', '저장 왕복', () => { const r = node('scripts/village-sim/roundtrip.mjs', ['--days', QUICK ? '1' : '2']);
    const s = last(r.out, /^판정:/); return { ok: r.code === 0, 요약: s || '판정 줄 없음', sec: r.sec, 실패: r.out.split('\n').filter(l => /^\| .*\*\*/.test(l)).slice(0, 3) }; }],
  ['vsref', '기준 ① — vsref(' + REF + ')', () => { const r = node('scripts/village-sim/vsref.mjs', ['--ref', REF, ...(QUICK ? ['--days', '1', '--seeds', '1'] : []), ...(flag('allow') ? ['--allow'] : []), ...chArgs]);
    const s = last(r.out, /^판정:/), w = warnLine(r.out); return { ok: r.code === 0, 요약: s || '판정 줄 없음', sec: r.sec, 경고: w, 실패: r.out.split('\n').filter(l => /^\| .*\*\*/.test(l) && !/\(바뀐 판\)/.test(l)).slice(0, 3) }; }],
  ['look', '화면 회귀 — village-look(' + REF + ')', () => { const r = node('scripts/village-look/shots.mjs', ['--vs-ref', REF, ...(QUICK ? ['--shots', 'default'] : []), ...(opt('max', null) ? ['--max', opt('max')] : []), ...chArgs]);
    const s = last(r.out, /^판정:/), w = warnLine(r.out); return { ok: r.code === 0, 요약: s || last(r.out, /\S/) || '판정 줄 없음', sec: r.sec, 경고: w, 실패: r.out.split('\n').filter(l => /^\| .*\*\*/.test(l) && !/\(바뀐 판\)/.test(l)).slice(0, 3) }; }],
];

const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
/* [MAC-CHECKCHANGED] 바뀐 판 — 판 파일 · 시작 땅(판의 '시작' 칸이 가리킴) · 저장본(표준 판 pop88·pop167·mid36 은 이미 있고, 새 저장본은 기본 판으로 더함) */
const STD_SAVES = ['pop88', 'pop167', 'mid36'];   // vsref·look 표준 판이 쓰는 저장본(vsref.mjs · shots.mjs 의 BOARDS 와 같게)
function changedBoards() { if (flag('no-changed')) return null;
  const files = [...new Set([...(git('diff', '--name-only', REF, '--', 'village/stages') || '').split('\n'), ...(git('ls-files', '--others', '--exclude-standard', '--', 'village/stages') || '').split('\n')].map(f => f.trim()).filter(Boolean))];
  const dir = path.join(ROOT, 'village/stages'), stages = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'rules.json').map(f => { let d = null; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch {} return [f.slice(0, -5), d]; });
  const has = id => stages.some(([s]) => s === id), ids = new Set(), saves = new Set(), gone = [];
  for (const f of files) { const m1 = f.match(/^village\/stages\/([a-z0-9-]+)\.json$/); if (m1) { if (m1[1] === 'rules') continue; if (has(m1[1])) ids.add(m1[1]); else gone.push(m1[1]); continue; }
    const m2 = f.match(/^village\/stages\/(starts|boards)\/([^/]+)\.json$/); if (!m2) continue;
    stages.forEach(([id, d]) => { if (d && d.시작 === 'stages/' + m2[1] + '/' + m2[2] + '.json') ids.add(id); }); if (m2[1] === 'boards' && fs.existsSync(path.join(dir, 'boards', m2[2] + '.json'))) saves.add(m2[2]); }
  const more = [...ids, ...[...saves].filter(b => !STD_SAVES.includes(b)).map(b => '기본+village/stages/boards/' + b + '.json')];
  const soft = [...ids, ...[...saves].flatMap(b => ['기본+' + b, ...stages.map(([id]) => id + '+' + b)])];
  return { files: files.length, ids: [...ids], saves: [...saves], gone, more, soft }; }
const CH = changedBoards(), chArgs = CH && CH.more.length + CH.soft.length ? [...(CH.more.length ? ['--more', CH.more.join(',')] : []), '--soft', CH.soft.join(',')] : [];
const warnLine = out => last(out, /^⚠ 바뀐 판/);
const head = git('rev-parse', '--short', 'HEAD'), dirty = !!git('status', '--porcelain', '--', 'village', 'scripts'), refSha = git('rev-parse', '--short', REF);
const rows = [];
for (const [key, name, fn] of STEPS) {
  if (SKIP.has(key)) { rows.push({ key, name, 건너뜀: true }); continue; }
  process.stderr.write(`  ${name} … `);
  let r; try { r = fn(); } catch (e) { r = { ok: false, 요약: '멈춤: ' + String(e.message || e).slice(0, 160), sec: 0 }; }
  rows.push({ key, name, ...r }); process.stderr.write((r.ok ? 'PASS' : 'FAIL') + ' · ' + r.sec.toFixed(1) + '초\n');
}
const L = [`마을 PR 검사 — 지금 ${head}${dirty ? ' + 고친 것' : ''} · 견줄 쪽 ${REF} (${refSha || '?'})${QUICK ? ' · 빠르게(--quick)' : ''}`,
  ...(CH && (CH.ids.length || CH.saves.length || CH.gone.length) ? [`바뀐 판(스스로 더해 봄 · 차이는 '의도한 차이?'로): ${[...CH.ids, ...CH.saves.map(b => '저장본 ' + b)].join(' · ') || '—'}${CH.gone.length ? ' · 지워진 판 ' + CH.gone.join(' ') : ''}`] : []), '', '| 검사 | 결과 | 초 | 요약 |', '|---|---|---|---|'];
for (const r of rows) {
  if (r.건너뜀) { L.push(`| ${r.name} | 건너뜀 | — | — |`); continue; }
  L.push(`| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.sec.toFixed(1)} | ${String(r.요약).replace(/\|/g, '/')} |`);
  if (r.경고) L.push(`|  | ⚠ | | ${String(r.경고).replace(/\|/g, '/').slice(0, 220)} |`);   // [MAC-CHECKCHANGED] 바뀐 판 차이 — PASS 여도 보인다
  (r.실패 || []).forEach(f => L.push(`|  | ↳ | | ${String(f).replace(/\|/g, '/').slice(0, 180)} |`));
}
const bad = rows.filter(r => !r.건너뜀 && !r.ok);
const warned = rows.filter(r => r.경고).map(r => r.key);
L.push('', (bad.length ? `판정: FAIL — ${bad.map(r => r.key).join(' · ')}` : `판정: PASS — ${rows.filter(r => !r.건너뜀).length}가지 모두 통과`) + (warned.length ? ` · ⚠ 바뀐 판 차이(${warned.join(' · ')}) — 의도한 차이면 PR 에 적기` : ''));
console.log(L.join('\n'));
process.exit(bad.length ? 1 : 0);
