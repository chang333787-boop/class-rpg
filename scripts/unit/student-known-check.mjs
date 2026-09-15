#!/usr/bin/env node
// 우리반 성장 RPG — 학생 기기 노드 목록 검사 (STUDENT-KNOWN-CHECK-1, read-only)
//
//  학생 기기(STUDENT-COLD-1)는 root 대신 노드별로 구독한다. 구독 목록 = 운영 shallow ∪ DB.STUDENT_KNOWN − DB.STUDENT_COLD.
//  운영에 **아직 없는** 새 노드를 코드가 쓰기 시작하면, KNOWN 에 없을 때 학생 기기는 그 노드가 생겨도 새로고침 전까지 못 본다
//  (#337 때 promotionRequests 가 그 경우였다).
//  그래서 앱 코드가 쓰는 **최상위 노드 이름 전부**가 STUDENT_KNOWN ∪ STUDENT_COLD 안에 있어야 한다. 빠지면 FAIL.
//
//  노드 이름을 찾는 곳(app 코드 4파일):
//   · `.child('<이름>'` / `.child('<이름>/…'` / `.child(\`<이름>/…\`` — _fbRef·fbRef·DB._fbRef 아래 쓰기·읽기
//   · gamedata `_normalizeArrays` 의 `data.<이름> =`
//   · admin.js `BACKUP_NODES` 목록
//  사용: node scripts/unit/student-known-check.mjs   (FAIL 이면 exit 1)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FILES = ['gamedata.js', 'student.js', 'admin.js', 'kiosk.js'];

const sb = { console: { log() {}, warn() {}, error() {} }, window: {}, setTimeout, document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} }, alert() {} };
sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(read('gamedata.js') + ';globalThis.__DB = DB;', sb);
const DB = sb.__DB;
const KNOWN = new Set(DB.STUDENT_KNOWN || []), COLD = new Set(DB.STUDENT_COLD || []);
if (!KNOWN.size) { console.log('❌ FAIL  gamedata DB.STUDENT_KNOWN 이 없음'); process.exitCode = 1; }

// 이름 → 어디서 봤나
const seen = new Map();
const add = (name, where) => { if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return; if (!seen.has(name)) seen.set(name, new Set()); seen.get(name).add(where); };
const lineOf = (src, i) => src.slice(0, i).split('\n').length;
for (const f of FILES) {
  const src = read(f);
  for (const m of src.matchAll(/\.child\(\s*(['"`])([A-Za-z][A-Za-z0-9_]*)(?:\/|\1)/g)) add(m[2], `${f}:${lineOf(src, m.index)}`);
}
{
  const src = read('gamedata.js');
  const s = src.indexOf('_normalizeArrays(');
  const body = s >= 0 ? src.slice(s, src.indexOf('\n  },', s)) : '';
  for (const m of body.matchAll(/\bdata\.([A-Za-z][A-Za-z0-9_]*)\s*=/g)) add(m[1], 'gamedata.js _normalizeArrays');
}
{
  const src = read('admin.js');
  const m = /const BACKUP_NODES = \[([\s\S]*?)\];/.exec(src);
  if (m) for (const n of m[1].matchAll(/'([A-Za-z][A-Za-z0-9_]*)'/g)) add(n[1], 'admin.js BACKUP_NODES');
}

// root 밖 노드(다른 ref) — classRPG_v3 아래가 아니므로 제외
const OUTSIDE = new Set(['classRPG_adminPw', 'classRPG_backups', 'classRPG_villages']);
let pass = 0, fail = 0;
const out = [];
for (const [name, where] of [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (OUTSIDE.has(name)) continue;
  if (KNOWN.has(name) || COLD.has(name)) { pass++; continue; }
  fail++;
  out.push(`❌ FAIL   '${name}' 가 STUDENT_KNOWN·STUDENT_COLD 어디에도 없음 — ${[...where].slice(0, 3).join(', ')}`
    + `\n         학생 화면이 읽으면 gamedata STUDENT_KNOWN 에, 안 읽고 크거나 남의 것이면 STUDENT_COLD 에 넣을 것`);
}
for (const n of KNOWN) if (COLD.has(n)) { fail++; out.push(`❌ FAIL   '${n}' 가 KNOWN 과 COLD 둘 다에 있음`); }
console.log(out.join('\n'));
console.log(`코드가 쓰는 classRPG_v3 최상위 노드 ${pass + (fail - out.filter(l => l.includes('둘 다')).length)}개 · KNOWN ${KNOWN.size} · COLD ${COLD.size}`);
console.log(`\n요약: PASS ${pass} · FAIL ${fail}`);
process.exitCode = fail ? 1 : (process.exitCode || 0);
