#!/usr/bin/env node
// 꾸미기 하네스 판정(DECO-HARNESS-PRECHECK-1) — run.mjs 출력을 읽어 exit 코드로 말한다(precheck 가 부른다).
//  run.mjs 는 값을 찍기만 한다(사람이 읽었다). 여기서 '틀린 줄'을 센다:
//   · `=false` · `"맞나":false` · `ERR` · `안눌리는단추_*` 가 "없음" 이 아님 · 출력이 아예 없음
//  브라우저가 없으면 SKIP(exit 0) — 크롬/엣지 없는 기기에서 precheck 가 통째로 막히지 않게.
//  틀린 줄이 있으면 **한 번 더** 돌린다: 두 번 다 틀리면 FAIL(exit 1), 두 번째가 맞으면 REVIEW(exit 0, 흔들림 — 줄 이름을 PR 에 적을 것).
//  사용: node scripts/unit/deco-save-count/check.mjs      (약 1분 · 운영 통신 0: 없는 프로젝트 + goOffline)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BROWSER = process.env.BROWSER || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
if (!fs.existsSync(BROWSER)) { console.log(`요약: SKIP · 브라우저 없음(${BROWSER}) — BROWSER 환경변수로 지정`); process.exit(0); }

function once() {
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs')], { encoding: 'utf8', maxBuffer: 64e6, timeout: 200000 });
  const lines = ((r.stdout || '') + (r.stderr || '')).split('\n').map(s => s.trim()).filter(Boolean);
  const checks = lines.filter(l => /^[^=\s]+=/.test(l));
  const bad = checks.filter(l => /=false$/.test(l) || /"맞나":false/.test(l) || /^ERR/.test(l) || (/^안눌리는단추_/.test(l) && !/="없음"$/.test(l)));
  if (r.status !== 0 || checks.length < 20) bad.push(`출력 없음/중단(exit ${r.status}, ${checks.length}줄): ${lines.slice(-1)[0] || ''}`.slice(0, 200));
  return { checks: checks.length, bad };
}
const a = once();
if (!a.bad.length) { console.log(`요약: PASS · 꾸미기 하네스 ${a.checks}줄 · 틀린 줄 0`); process.exit(0); }
console.log('첫 번째에서 틀린 줄:'); a.bad.forEach(l => console.log('  ' + l));
const b = once();
if (!b.bad.length) { console.log(`요약: REVIEW · 흔들림 — 첫 번째만 틀림(${a.bad.map(l => l.split('=')[0]).join(', ')}) · 두 번째 ${b.checks}줄 틀린 줄 0`); process.exit(0); }
console.log('두 번째에서도 틀린 줄:'); b.bad.forEach(l => console.log('  ' + l));
console.log(`요약: FAIL · 꾸미기 하네스 틀린 줄 ${b.bad.length}`);
process.exit(1);
