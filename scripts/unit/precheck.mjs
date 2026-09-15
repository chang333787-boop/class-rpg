#!/usr/bin/env node
// 우리반 성장 RPG — PR 사전 검사 한 번에 (PRECHECK-1, read-only)
//
//  PR 마다 따로 돌리던 검사를 한 명령으로 묶는다. 각 검사는 **따로 프로세스**로 돌려 서로 영향이 없고,
//  기준선 숫자는 각 스크립트가 원래 쓰는 것을 그대로 쓴다(이 파일은 판정을 바꾸지 않고 모으기만 한다).
//
//  사용: node scripts/unit/precheck.mjs [--base origin/main] [--gold] [--save-order-baseline N]
//    --base    buster-check 비교 기준(기본 origin/main). 현재 체크아웃(HEAD)을 검사한다.
//    --gold    느린 골드 검사도 돌린다: gold-sync-sim · gold-loss-real-sdk(엣지 필요). 저장 경로를 건드린 PR이면 켤 것.
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
];
// 폴더에 있는 다른 자기검사 시뮬들(각자 exit 코드로 판정)
for (const f of ['fraction-grade', 'promo-sync-sim', 'settings-field-sim', 'student-known-check']) {
  CHECKS.push({ name: f, file: `scripts/unit/${f}.mjs`, args: [], pick: /(최종 결과:[^\n]*|PASS[^\n]*|FAIL[^\n]*)$/m, optional: true });
}
if (GOLD) {
  CHECKS.push({ name: 'gold-sync-sim', file: 'scripts/unit/gold-sync-sim.mjs', args: GOLD_STRICT ? ['--expect-fixed'] : [], pick: /무작위[^\n]*/, gold: true, timeout: 900000 });
  CHECKS.push({ name: 'gold-real-sdk', file: 'scripts/unit/gold-loss-real-sdk/run.mjs', args: GOLD_STRICT ? ['--expect-fixed'] : [], pick: /최종 결과:[^\n]*/, gold: true, timeout: 900000 });
}

const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
console.log(`사전 검사 · HEAD ${head} · base ${BASE}${GOLD ? ` · 골드 ${GOLD_STRICT ? '엄격' : '기록'}` : ''}\n`);

const rows = [];
for (const c of CHECKS) {
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
  rows.push({ ...c, status, line, sec: ((Date.now() - t0) / 1000).toFixed(1) });
}

const icon = { PASS: '✅', REVIEW: '🟡', FAIL: '❌', SKIP: '⏭️' };
const w = Math.max(...rows.map(r => r.name.length));
for (const r of rows) console.log(`${icon[r.status]} ${r.name.padEnd(w)}  ${r.line}${r.sec ? `  (${r.sec}s)` : ''}`);
const n = (s) => rows.filter(r => r.status === s).length;
console.log(`\n요약: PASS ${n('PASS')} · REVIEW ${n('REVIEW')} · FAIL ${n('FAIL')}${n('SKIP') ? ` · SKIP ${n('SKIP')}` : ''}`);
console.log(n('FAIL') ? '최종 결과: ❌ FAIL — 머지 전에 고칠 것' : n('REVIEW') ? '최종 결과: 🟡 PASS (REVIEW 항목은 PR 본문에 적을 것)' : '최종 결과: ✅ PASS');
process.exit(n('FAIL') ? 1 : 0);
