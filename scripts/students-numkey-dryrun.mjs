#!/usr/bin/env node
// scripts/students-numkey-dryrun.mjs — students 옛 숫자 키(0,1,2…) 삭제 **드라이런** (읽기만 · Firebase 쓰기 0)   [STUDENTS-NUMKEY-DRYRUN-1]
//
// 왜: 운영 classRPG_v3/students 에 옛 배열 시절의 숫자 키 레코드가 id 키 레코드와 함께 남아 있다.
//     화면은 id 로 중복을 걸러 쓰지만(#228 조사), 백업·통계·새 코드가 숫자 키 쪽을 잘못 집을 수 있다.
//     지우기는 **사용자 결정**이라, 이 스크립트는 "지워도 되는가"를 보여 주고 지울 목록만 출력한다.
//
// 쓰는 법
//   node scripts/students-numkey-dryrun.mjs                 → 판정표 + tmp/students_backup_<YYYYMMDD_HHMM>.json(로컬 백업)
//   node scripts/students-numkey-dryrun.mjs --db http://127.0.0.1:9000 --ns demo   (에뮬레이터 시험)
//
// 하는 일: GET students · questLogs · classRPG_backups(shallow) → 로컬 백업 파일(되읽기 확인) → 숫자 키마다 판정 → 지울 목록
// 하지 않는 일: PUT/PATCH/DELETE 없음. --apply 같은 옵션도 없다. 이 파일에는 fetch 의 method 를 바꾸는 줄이 없다.
//               학생 이름·비밀번호는 출력하지 않는다(키·개수만).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROD = 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]]) : a), []));
const db = String(args.db || PROD).replace(/\/+$/, '');
const ns = args.ns ? '?ns=' + encodeURIComponent(args.ns) : '';
const qs = (extra) => (ns ? ns + (extra ? '&' + extra : '') : (extra ? '?' + extra : ''));
const outDir = path.resolve(String(args.out || 'tmp'));

const pad = n => String(n).padStart(2, '0');
const d = new Date();
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
const arr = x => Array.isArray(x) ? x.filter(Boolean) : (x && typeof x === 'object') ? Object.values(x).filter(Boolean) : [];

async function getJSON(p, extra) {
  const res = await fetch(`${db}/${p}.json${qs(extra)}`);   // GET 만
  if (!res.ok) throw new Error(`${p} 읽기 실패 ${res.status}`);
  return { text: null, json: await res.json() };
}

// Windows 의 Node 24 는 fetch 직후 process.exit() 에서 libuv assertion 으로 127 을 낸다(실측) → exitCode 로 자연 종료
async function main() {
  const [{ json: students }, { json: logsRaw }, { json: backups }] = await Promise.all([
    getJSON('classRPG_v3/students'), getJSON('classRPG_v3/questLogs'), getJSON('classRPG_backups', 'shallow=true'),
  ]);
  if (!students || typeof students !== 'object') { console.error('students 가 비어 있음 — 할 일 없음'); return 1; }

  // ① 로컬 백업(students 통째) — 지우기 전에 되살릴 근거
  const envelope = { kind: 'classRPG_v3-students-backup', v: 1, takenAt: d.toISOString(), source: db + (ns ? ' ' + ns : ''), data: students };
  const body = JSON.stringify(envelope);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `students_backup_${stamp}.json`);
  fs.writeFileSync(file, body);
  const same = JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')).data) === JSON.stringify(students);
  const sha = crypto.createHash('sha256').update(body).digest('hex');

  // ② 교사 화면 자동 백업(classRPG_backups) 최신 날짜
  const days = Object.keys(backups || {}).sort();
  const last = days[days.length - 1] || null;
  const ageDays = last ? Math.floor((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(last)) / 86400000) : null;

  // ③ 숫자 키 판정
  const logs = arr(logsRaw).filter(l => l.approved !== false);
  const keys = Object.keys(students);
  const numeric = keys.filter(k => /^\d+$/.test(k)).sort((a, b) => a - b);
  const rows = numeric.map(k => {
    const r = students[k] || {};
    const twin = r.id && students[r.id] ? students[r.id] : null;
    const twinPending = new Set(arr(twin && twin.pendingRewards).map(p => p.id));
    const onlyHere = arr(r.pendingRewards).filter(p => !twinPending.has(p.id));
    const settled = onlyHere.filter(p => logs.some(l => l.studentId === r.id && l.boardQuestId && l.boardQuestId === p.boardQuestId && l.date === p.date));
    const unsettled = onlyHere.length - settled.length;
    // 숫자 키 쪽이 id 키보다 앞서 있으면(누적값이 더 큼) 아직 어느 기기가 거기에 쓰고 있다는 뜻 → 지우면 안 됨
    const ahead = !!twin && ['totalGold', 'exp'].some(f => (Number(r[f]) || 0) > (Number(twin[f]) || 0));
    let verdict;
    if (!r.id) verdict = '🟠 주인 모름(id 없음) — 남은 보상 ' + arr(r.pendingRewards).length + '건 사용자 판단';
    else if (!twin) verdict = '🔴 지우면 안 됨 — id 키 레코드가 없음(이게 유일본)';
    else if (ahead) verdict = '🔴 지우면 안 됨 — 숫자 키 쪽 누적 골드·경험치가 id 키보다 큼(아직 쓰이는 중일 수 있음)';
    else if (unsettled > 0) verdict = `🟠 숫자 키에만 있는 미정산 보상 ${unsettled}건 — 옮길지 사용자 판단`;
    else verdict = '✅ 지워도 됨 — id 키 레코드 있음 · 숫자 키에만 있는 보상은 모두 승인 로그와 맞음';
    return { k, hasId: !!r.id, twin: !!twin, ahead, onlyHere: onlyHere.length, settled: settled.length, unsettled, verdict, ok: verdict.startsWith('✅') };
  });

  console.log(`원본        ${db}/classRPG_v3/students.json${ns}`);
  console.log(`로컬 백업   ${file} · ${body.length}B · SHA-256 ${sha.slice(0, 16)}… · 되읽기 ${same ? '같음 ✅' : '다름 ❌'}`);
  console.log(`교사 자동 백업 최신  ${last || '없음'}${ageDays != null ? ` (${ageDays}일 전)` : ''}${ageDays == null || ageDays > 0 ? '  ⚠️ 지우기 전에 교사 화면 💾 백업을 오늘 날짜로 한 번' : ''}`);
  console.log(`students 키 ${keys.length}개 · 숫자 키 ${numeric.length}개\n`);
  console.log('숫자키 | id | id키 레코드 | 숫자키가 앞섬 | 숫자키에만 있는 보상 | 그중 승인 로그와 맞음 | 판정');
  for (const x of rows) console.log(`${x.k} | ${x.hasId ? '있음' : '없음'} | ${x.twin ? '있음' : '없음'} | ${x.ahead ? '예' : '아니오'} | ${x.onlyHere} | ${x.settled} | ${x.verdict}`);

  const del = rows.filter(x => x.ok).map(x => x.k);
  console.log(`\n지워도 되는 키: ${del.length ? del.join(', ') : '없음'}`);
  if (del.length) {
    console.log('사용자가 직접 실행할 때 쓸 한 번 쓰기(콘솔 또는 사용자 판단 — 이 스크립트는 실행하지 않음):');
    console.log('  PATCH classRPG_v3/students.json  ' + JSON.stringify(Object.fromEntries(del.map(k => [k, null]))));
  }
  const hold = rows.filter(x => !x.ok).map(x => x.k);
  if (hold.length) console.log(`판단이 필요한 키: ${hold.join(', ')} (위 판정 칸)`);
  console.log('\n쓰기 0 — 이 스크립트는 읽고 로컬 파일만 남겼습니다.');
  return same ? 0 : 1;
}

main().then(c => { process.exitCode = c; }, e => { console.error('실패: ' + (e && e.message || e)); process.exitCode = 1; });
