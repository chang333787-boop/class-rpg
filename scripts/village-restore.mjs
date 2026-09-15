#!/usr/bin/env node
// scripts/village-restore.mjs — 우리 마을 한 학생 되살리기   [VILLAGE-BACKUP-1]
//
// ⚠ 기본은 **보여 주기만**(GET 만). 실제로 쓰려면 --apply, 운영이면 --yes-production 까지.
//   실행은 보스/사용자. 절차서: docs/village-restore.md
//
//   node scripts/village-restore.mjs --file tmp/village_backup_20260915_0900.json --sid s1774671589091
//   node scripts/village-restore.mjs --file … --sid … --apply --yes-production
//   node scripts/village-restore.mjs --file … --sid … --apply --db http://127.0.0.1:9000 --ns demo-village   (에뮬레이터)
//
// 무엇을 쓰나: classRPG_villages/<sid> 한 곳을 백업의 meta + plots 로 **바꿔 쓴다**(PUT 1번).
//   · meta.savedAt 을 **지금 서버 시각**으로, meta.dev 를 'restore-…' 로 바꾼다.
//     백업의 옛 savedAt 을 그대로 두면, 학생 기기의 sync.js 가 "원격이 더 옛것"으로 보고 **로컬로 복원을 덮는다.**
//     지금 시각이면 기기는 원격(복원본)을 받고, 그 기기에만 있던 것은 .sync-backup 에 남긴다(말없이 버리지 않음).
//   · session 은 쓰지 않는다(지워진다) — 다음에 여는 기기가 새로 가져간다.
// 언제 막나: 그 학생 마을이 **지금 열려 있으면**(session.at 90초 안) 거절. 열린 기기가 복원을 곧바로 덮기 때문.
import fs from 'node:fs';

const PROD = 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app';
const argv = process.argv.slice(2);
const flag = k => argv.includes('--' + k);
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const db = String(opt('db') || PROD).replace(/\/+$/, '');
const nsq = opt('ns') ? '?ns=' + encodeURIComponent(opt('ns')) : '';
const file = opt('file'), sid = opt('sid');
const apply = flag('apply'), isProd = db === PROD;
const STALE_MS = 90000;

// Windows 의 Node 24 는 fetch 직후 process.exit() 에서 libuv assertion 으로 127 을 낸다(실측) → exitCode 로 자연 종료
const fail = m => { console.error('❌ ' + m); return 1; };
async function main() {
  if (!file || !sid) return fail('--file <백업 파일> --sid <학생 id> 가 필요합니다');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(sid) || sid === 'guest') return fail('sid 모양이 규칙과 다릅니다');
  if (apply && isProd && !flag('yes-production')) return fail('운영에 쓰려면 --yes-production 을 함께 주세요');

  const env = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!env || env.kind !== 'classRPG_villages-backup') return fail('village-backup.mjs 로 만든 파일이 아닙니다');
  const src = env.data && env.data[sid];
  if (!src || !src.meta) return fail(`백업(${env.takenAt})에 ${sid} 마을이 없습니다`);

  const u = p => `${db}/classRPG_villages/${encodeURIComponent(sid)}${p ? '/' + p : ''}.json${nsq}`;
  const cur = await (await fetch(u(''))).json();
  const nowServer = Date.now();
  const open = !!(cur && cur.session && typeof cur.session.at === 'number' && nowServer - cur.session.at < STALE_MS);
  const count = v => (v && v.plots && typeof v.plots === 'object') ? Object.keys(v.plots).length : 0;
  const pad = n => String(n).padStart(2, '0'), t0 = new Date();
  const stamp = `${t0.getFullYear()}${pad(t0.getMonth() + 1)}${pad(t0.getDate())}${pad(t0.getHours())}${pad(t0.getMinutes())}`;   // 지역 시각
  const payload = { meta: Object.assign({}, src.meta, { savedAt: { '.sv': 'timestamp' }, dev: 'restore-' + stamp }), plots: src.plots || {} };

  console.log(`대상   ${isProd ? '운영' : db} · classRPG_villages/${sid}`);
  console.log(`백업   ${env.takenAt} · 구역 ${count(src)} · 원래 저장 ${src.meta.savedAt ? new Date(src.meta.savedAt).toLocaleString('ko-KR') : '-'}`);
  console.log(`지금   ${cur ? `구역 ${count(cur)} · 마지막 저장 ${cur.meta && cur.meta.savedAt ? new Date(cur.meta.savedAt).toLocaleString('ko-KR') : '-'}` : '없음(지워짐)'} · ${open ? '🟢 열려 있음' : '닫힘'}`);
  console.log(`쓸 것  PUT 1번 · ${JSON.stringify(payload).length.toLocaleString()}B · savedAt=서버 지금 · dev=${payload.meta.dev} · session 지움`);
  if (open && !flag('force')) return fail('지금 열려 있는 마을입니다. 학생이 닫고 90초 뒤에 다시 하세요(열린 기기가 복원을 곧바로 덮습니다)');
  if (!apply) { console.log('\n보여 주기만 했습니다(쓰기 0). 실제로 되살리려면 --apply' + (isProd ? ' --yes-production' : '')); return 0; }

  const r = await fetch(u(''), { method: 'PUT', body: JSON.stringify(payload) });
  if (!r.ok) return fail(`쓰기 실패 ${r.status} ${await r.text()}`);
  const after = await (await fetch(u(''))).json();
  const samePlots = JSON.stringify(Object.entries(after.plots || {}).sort()) === JSON.stringify(Object.entries(src.plots || {}).sort());
  console.log(`\n되살림 ✅ · 구역 ${count(after)} · 백업과 구역 문자열 ${samePlots ? '같음' : '다름 ❌'} · savedAt ${new Date(after.meta.savedAt).toLocaleString('ko-KR')}`);
  return samePlots ? 0 : 2;
}
main().then(code => { process.exitCode = code; }, e => { console.error('❌', e); process.exitCode = 1; });
