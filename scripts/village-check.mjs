// 마을 PR 검사 한 줄 — 마을 PR 을 올리기 전에 돌리는 것을 **차례로 하나씩** 돌리고 한 표로 (보스 09-24 무한 모드 '도구 두텁게' · [MAC-CHECK]).
//   ① module node --check(village/index.html 의 <script type="module"> 를 떼어) ② verify-safety ③ village-paint ④ village-sim 시험 ⑤ 판 검사(stages)
//   ⑥ 기준 ① — vsref(그 ref 를 통째로 푼 뿌리와 · 그림 흔들기 덤) ⑦ 화면 회귀 — village-look --vs-ref(그림)
// 무거운 것(⑥⑦)은 한 번에 하나. 창 0 · 네트워크 0(⑦은 전용 headless · 바깥 주소 막음). 끝값: 0 모두 통과 · 1 하나라도 FAIL · 2 못 돎.
//
//   node scripts/village-check.mjs                    # 전부 — origin/main 과(vsref 2일·시드 1-3 · look 세 장면 — 약 3~4분)
//   node scripts/village-check.mjs --quick            # ⑥ 하루·시드 1 · ⑦ default 장면만(잰 값 약 1분 50초)
//   node scripts/village-check.mjs --skip look,vsref  # 고르기(module·safety·paint·sim·stages·vsref·look)
//   node scripts/village-check.mjs --ref HEAD~1       # ⑥⑦ 의 견줄 쪽
//   그 밖: --allow(⑥ 에서 옛과 다른 값을 허용 — 의도한 차이 · PR 에 적는다) · --max <%>(⑦ 허용 차이)
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
  ['vsref', '기준 ① — vsref(' + REF + ')', () => { const r = node('scripts/village-sim/vsref.mjs', ['--ref', REF, ...(QUICK ? ['--days', '1', '--seeds', '1'] : []), ...(flag('allow') ? ['--allow'] : [])]);
    const s = last(r.out, /^판정:/); return { ok: r.code === 0, 요약: s || '판정 줄 없음', sec: r.sec, 실패: r.out.split('\n').filter(l => /^\| .*\*\*/.test(l)).slice(0, 3) }; }],
  ['look', '화면 회귀 — village-look(' + REF + ')', () => { const r = node('scripts/village-look/shots.mjs', ['--vs-ref', REF, ...(QUICK ? ['--shots', 'default'] : []), ...(opt('max', null) ? ['--max', opt('max')] : [])]);
    const s = last(r.out, /^판정:/); return { ok: r.code === 0, 요약: s || last(r.out, /\S/) || '판정 줄 없음', sec: r.sec, 실패: r.out.split('\n').filter(l => /^\| .*\*\*/.test(l)).slice(0, 3) }; }],
];

const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const head = git('rev-parse', '--short', 'HEAD'), dirty = !!git('status', '--porcelain', '--', 'village', 'scripts'), refSha = git('rev-parse', '--short', REF);
const rows = [];
for (const [key, name, fn] of STEPS) {
  if (SKIP.has(key)) { rows.push({ key, name, 건너뜀: true }); continue; }
  process.stderr.write(`  ${name} … `);
  let r; try { r = fn(); } catch (e) { r = { ok: false, 요약: '멈춤: ' + String(e.message || e).slice(0, 160), sec: 0 }; }
  rows.push({ key, name, ...r }); process.stderr.write((r.ok ? 'PASS' : 'FAIL') + ' · ' + r.sec.toFixed(1) + '초\n');
}
const L = [`마을 PR 검사 — 지금 ${head}${dirty ? ' + 고친 것' : ''} · 견줄 쪽 ${REF} (${refSha || '?'})${QUICK ? ' · 빠르게(--quick)' : ''}`, '', '| 검사 | 결과 | 초 | 요약 |', '|---|---|---|---|'];
for (const r of rows) {
  if (r.건너뜀) { L.push(`| ${r.name} | 건너뜀 | — | — |`); continue; }
  L.push(`| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.sec.toFixed(1)} | ${String(r.요약).replace(/\|/g, '/')} |`);
  (r.실패 || []).forEach(f => L.push(`|  | ↳ | | ${String(f).replace(/\|/g, '/').slice(0, 180)} |`));
}
const bad = rows.filter(r => !r.건너뜀 && !r.ok);
L.push('', bad.length ? `판정: FAIL — ${bad.map(r => r.key).join(' · ')}` : `판정: PASS — ${rows.filter(r => !r.건너뜀).length}가지 모두 통과`);
console.log(L.join('\n'));
process.exit(bad.length ? 1 : 0);
