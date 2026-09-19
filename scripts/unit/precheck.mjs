#!/usr/bin/env node
// 우리반 성장 RPG — PR 사전 검사 한 번에 (PRECHECK-1, read-only)
//
//  PR 마다 따로 돌리던 검사를 한 명령으로 묶는다. 각 검사는 **따로 프로세스**로 돌려 서로 영향이 없고,
//  기준선 숫자는 각 스크립트가 원래 쓰는 것을 그대로 쓴다(이 파일은 판정을 바꾸지 않고 모으기만 한다).
//
//  사용: node scripts/unit/precheck.mjs [--base origin/main] [--gold] [--deco|--no-deco] [--save-order-baseline N] [--balance-strict]
//    --base    buster-check 비교 기준(기본 origin/main). 현재 체크아웃(HEAD)을 검사한다.
//    --gold    느린 골드 검사도 돌린다: gold-sync-sim · gold-loss-real-sdk(엣지 필요). 저장 경로를 건드린 PR이면 켤 것.
//    --deco    꾸미기 하네스(헤드리스 크롬/엣지, 약 1분)를 무조건 돌린다. 안 줘도 **base 대비 꾸미기 파일**
//              (student.js·student.css·student.html·scripts/unit/deco-save-count/)을 고친 PR 이면 저절로 돈다. --no-deco 로 끈다.
//    --save-order-baseline N   save-order-check 기준선(기본 11 = 2026-09-15 main). 새 자리가 늘면 FAIL.
//
//  판정: 하나라도 FAIL(exit≠0)이면 exit 1. 골드 검사는 **수정 전 main 에서 LOSS 가 정상**이라
//        --gold 는 기본 REVIEW(기록만)이고, `--gold-strict` 를 주면 --expect-fixed 로 돌려 FAIL 로 셈한다.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const BASE = opt('--base', 'origin/main');
const GOLD = argv.includes('--gold') || argv.includes('--gold-strict');
const GOLD_STRICT = argv.includes('--gold-strict');
const SAVE_BASELINE = opt('--save-order-baseline', '11');

const exists = (p) => fs.existsSync(path.join(ROOT, p));
const CHECKS = [
  { name: 'smoke',        file: 'scripts/smoke-test.mjs',            args: [],                                pick: /요약:[^\n]*/ },
  { name: 'verify-safety',file: 'scripts/verify-safety.mjs',         args: [],                                pick: /요약:[^\n]*/ },
  { name: 'unit',         file: 'scripts/unit/run.mjs',              args: [],                                pick: /요약:[^\n]*/ },
  { name: 'buster-check', file: 'scripts/unit/buster-check.mjs',     args: [BASE, 'HEAD'],                    pick: /요약:[^\n]*/ },
  { name: 'whole-set',    file: 'scripts/unit/whole-set-check.mjs',  args: [],                                pick: /요약:[^\n]*/ },
  { name: 'save-order',   file: 'scripts/unit/save-order-check.mjs', args: ['--baseline', SAVE_BASELINE],     pick: /요약:[^\n]*/ },
  // [CHAR-COMBO-CHECK-1] 캐릭터 종이인형 84장 조립 규칙(잘림·뚫림·무기-모자 닿음). assets/char 를 고친 PR 은 여기서 잡힌다.
  { name: 'char-combo',   file: 'scripts/unit/char-combo-check.mjs', args: [],                                pick: /요약:[^\n]*/ },
];
// 폴더에 있는 다른 자기검사 시뮬들(각자 exit 코드로 판정)
for (const f of ['fraction-grade', 'promo-sync-sim', 'settings-field-sim', 'student-known-check']) {
  CHECKS.push({ name: f, file: `scripts/unit/${f}.mjs`, args: [], pick: /(최종 결과:[^\n]*|PASS[^\n]*|FAIL[^\n]*)$/m, optional: true });
}
// [PRECHECK-BALANCE-1] 밸런스 빠른 검사(밸런스 조수 제공, 각 약 2초).
//   identity: main 대비 밸런스 출력이 같은가. --review 라 달라도 exit 0 이고 요약 줄이 'REVIEW' → 여기서 REVIEW 로 표시
//             (값을 일부러 바꾸는 PR 이 있으므로). 구조만 옮기는 PR 은 `--balance-strict` 로 FAIL 로 셈.
//   gate:     운영 설정 기준 회귀 경보(풀장비 최저 ≥50%·Lv1/2 ≥90%·절벽 ≤35%p). 걸리면 exit 1 → FAIL.
const BALANCE_STRICT = argv.includes('--balance-strict');
CHECKS.push({ name: 'balance-identity', file: 'scripts/balance/identity.mjs', args: BALANCE_STRICT ? ['--quick'] : ['--quick', '--review'], pick: /요약:[^\n]*/, optional: true, balanceReview: !BALANCE_STRICT });
CHECKS.push({ name: 'balance-gate', file: 'scripts/balance/gate.mjs', args: ['--quick', '--settings', 'scripts/balance/settings/prod-20260915.json'], pick: /요약:[^\n]*/, optional: true });
// [DECO-HARNESS-PRECHECK-1] 꾸미기 하네스 — 실제 student.html 을 없는 프로젝트+오프라인으로 띄워 100줄쯤을 잰다(운영 통신 0).
//   느려서(약 1분) 꾸미기 파일을 고친 PR 에서만 저절로 돈다. 판정은 deco-save-count/check.mjs(틀린 줄 0 = PASS · 흔들림 = REVIEW).
{
  const DECO_PATHS = /^(student\.(js|css|html)|scripts\/unit\/deco-save-count\/)/;
  let touched = false;
  try {
    const d = spawnSync('git', ['diff', '--name-only', `${BASE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
    const w = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout || '';   // 아직 커밋 안 한 것도
    touched = d.split('\n').concat(w.split('\n').map(l => l.slice(3))).some(f => DECO_PATHS.test(f.trim()));
  } catch (e) {}
  const on = !argv.includes('--no-deco') && (argv.includes('--deco') || touched);
  if (on) CHECKS.push({ name: 'deco-harness', file: 'scripts/unit/deco-save-count/check.mjs', args: [], pick: /요약:[^\n]*/, optional: true, decoReview: true, timeout: 600000 });
  else CHECKS.push({ name: 'deco-harness', file: 'scripts/unit/deco-save-count/check.mjs', skip: argv.includes('--no-deco') ? '--no-deco' : '꾸미기 파일 변경 없음(--deco 로 강제)' });
}
if (GOLD) {
  CHECKS.push({ name: 'gold-sync-sim', file: 'scripts/unit/gold-sync-sim.mjs', args: GOLD_STRICT ? ['--expect-fixed'] : [], pick: /무작위[^\n]*/, gold: true, timeout: 900000 });
  CHECKS.push({ name: 'gold-real-sdk', file: 'scripts/unit/gold-loss-real-sdk/run.mjs', args: GOLD_STRICT ? ['--expect-fixed'] : [], pick: /최종 결과:[^\n]*/, gold: true, timeout: 900000 });
}

const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
console.log(`사전 검사 · HEAD ${head} · base ${BASE}${GOLD ? ` · 골드 ${GOLD_STRICT ? '엄격' : '기록'}` : ''}\n`);

const rows = [];
for (const c of CHECKS) {
  if (c.skip) { rows.push({ ...c, status: 'SKIP', line: c.skip }); continue; }
  if (!exists(c.file)) { rows.push({ ...c, status: c.optional ? 'SKIP' : 'FAIL', line: '파일 없음' }); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [c.file, ...c.args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6, timeout: c.timeout || 300000 });
  const outText = (r.stdout || '') + (r.stderr || '');
  const m = outText.match(c.pick);
  const line = (m ? m[0] : outText.trim().split('\n').pop() || '').replace(/\s+/g, ' ').slice(0, 110);
  let status = r.status === 0 ? 'PASS' : 'FAIL';
  if (r.error) status = 'FAIL';
  if (c.gold && !GOLD_STRICT) status = /LOSS|REPRO|유실 난 판 [1-9]/.test(outText) ? 'REVIEW' : 'PASS';
  if (c.name === 'save-order' && status === 'PASS' && /저장보다 앞선 다른 경로 쓰기 [1-9]/.test(outText)) status = 'REVIEW';
  if (c.balanceReview && status === 'PASS' && /요약: REVIEW/.test(outText)) status = 'REVIEW';
  if (c.decoReview && status === 'PASS' && /요약: REVIEW/.test(outText)) status = 'REVIEW';
  if (c.decoReview && status === 'PASS' && /요약: SKIP/.test(outText)) status = 'SKIP';
  rows.push({ ...c, status, line, sec: ((Date.now() - t0) / 1000).toFixed(1) });
}

const icon = { PASS: '✅', REVIEW: '🟡', FAIL: '❌', SKIP: '⏭️' };
const w = Math.max(...rows.map(r => r.name.length));
for (const r of rows) console.log(`${icon[r.status]} ${r.name.padEnd(w)}  ${r.line}${r.sec ? `  (${r.sec}s)` : ''}`);
const n = (s) => rows.filter(r => r.status === s).length;
console.log(`\n요약: PASS ${n('PASS')} · REVIEW ${n('REVIEW')} · FAIL ${n('FAIL')}${n('SKIP') ? ` · SKIP ${n('SKIP')}` : ''}`);
console.log(n('FAIL') ? '최종 결과: ❌ FAIL — 머지 전에 고칠 것' : n('REVIEW') ? '최종 결과: 🟡 PASS (REVIEW 항목은 PR 본문에 적을 것)' : '최종 결과: ✅ PASS');
process.exit(n('FAIL') ? 1 : 0);
