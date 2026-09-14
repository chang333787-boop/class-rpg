#!/usr/bin/env node
// scripts/village-backup.mjs — 우리 마을 백업 (읽기만 · Firebase 쓰기 0)   [VILLAGE-BACKUP-1]
//
// 왜: 마을(classRPG_villages)은 RPG 백업(BACKUP_NODES)에 들어가지 않고, 지우기는 규칙으로 못 막는다.
//     하루 한 번 통째로 받아 로컬 파일로 남겨 두면 누가 지워도 되살릴 수 있다.
//
// 쓰는 법
//   node scripts/village-backup.mjs                    → ./tmp/village_backup_<YYYYMMDD_HHMM>.json
//   node scripts/village-backup.mjs --out D:/백업        → 그 폴더에
//   node scripts/village-backup.mjs --db http://127.0.0.1:9000 --ns demo-village   (에뮬레이터 시험)
//
// 하는 일: GET classRPG_villages.json 한 번 → 모양 검사 → 파일 쓰기 → 요약(학생 수·구역 수·크기·SHA-256)
// 하지 않는 일: PUT/PATCH/DELETE 없음. 이 파일에는 fetch 의 method 를 바꾸는 줄이 없다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROD = 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]]) : a), []));
const db = String(args.db || PROD).replace(/\/+$/, '');
const ns = args.ns ? '?ns=' + encodeURIComponent(args.ns) : '';
const outDir = path.resolve(String(args.out || 'tmp'));

const pad = n => String(n).padStart(2, '0');
const d = new Date();
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;

// Windows 의 Node 24 는 fetch 직후 process.exit() 에서 libuv assertion 으로 127 을 낸다(실측) → exitCode 로 자연 종료
async function main() {
  const url = `${db}/classRPG_villages.json${ns}`;
  const res = await fetch(url);                       // GET 만
  if (!res.ok) { console.error(`읽기 실패 ${res.status} ${await res.text()} — 파일을 쓰지 않았습니다`); return 1; }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { console.error('JSON 이 아님 — 파일을 쓰지 않았습니다'); return 1; }

  // 모양 검사(경고만 — 받은 그대로 저장한다. 복원 판단은 사람이)
  const villages = data && typeof data === 'object' ? data : {};
  const warn = [];
  let plotsTotal = 0;
  const perSid = Object.entries(villages).map(([sid, v]) => {
    const plots = v && v.plots && typeof v.plots === 'object' ? Object.keys(v.plots).length : 0;
    plotsTotal += plots;
    if (!v || !v.meta) warn.push(`${sid}: meta 없음`);
    return { sid, plots, savedAt: v && v.meta && v.meta.savedAt || null };
  });

  const envelope = { kind: 'classRPG_villages-backup', v: 1, takenAt: d.toISOString(), source: db + (ns ? ' ' + ns : ''), data };
  const body = JSON.stringify(envelope);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `village_backup_${stamp}.json`);
  fs.writeFileSync(file, body);

  // 되읽어 확인 — 쓴 파일이 받은 것과 같은가
  const back = JSON.parse(fs.readFileSync(file, 'utf8'));
  const same = JSON.stringify(back.data) === JSON.stringify(data);
  const sha = crypto.createHash('sha256').update(body).digest('hex');

  console.log(`원본  ${url}`);
  console.log(`파일  ${file}`);
  console.log(`학생  ${perSid.length}명 · 구역 ${plotsTotal}개 · ${body.length.toLocaleString()}B · SHA-256 ${sha.slice(0, 16)}…`);
  perSid.forEach(r => console.log(`  - ${r.sid}  구역 ${r.plots}  마지막 저장 ${r.savedAt ? new Date(r.savedAt).toLocaleString('ko-KR') : '-'}`));
  if (!perSid.length) console.log('  (마을이 아직 없음 — 빈 백업도 남긴다: 언제부터 비어 있었는지가 기록이 된다)');
  warn.forEach(w => console.log('  ⚠ ' + w));
  console.log(same ? '되읽기 확인: 받은 것과 같음 ✅' : '되읽기 확인: 다름 ❌');
  return same ? 0 : 2;
}
main().then(code => { process.exitCode = code; }, e => { console.error('❌', e); process.exitCode = 1; });
