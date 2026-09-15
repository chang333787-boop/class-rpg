#!/usr/bin/env node
// 우리반 성장 RPG — 모음 통째 set 검사기 (read-only, 소스 읽기만) (WHOLE-SET-CHECK-1)
//
//  `child('<모음>').set(<내 캐시의 배열>)` 은 기기가 본 판으로 모음 전체를 덮는다.
//  두 기기가 거의 동시에 쓰면 나중 쪽이 앞쪽 변경을 지운다 — 승급 신청에서 재현(PROMO-PER-ID-1).
//  이미 있는 통째 set 은 아래 BASELINE 에 적어 두고, **새로 생기거나 늘면 FAIL** 로 알린다.
//  새로 쓰려면: 한 기기(교사)만 쓰는 모음인지 확인 → 맞으면 BASELINE 에 사유와 함께 올리고,
//  여러 기기가 쓰면 child('<모음>/' + id).set / .remove / transaction 으로.
//
//  사용: node scripts/unit/whole-set-check.mjs   (FAIL 1개 이상이면 exit 1)
//  smoke(28)·unit(60) 기준선과 별개 파일 — 숫자를 바꾸지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['gamedata.js', 'admin.js', 'student.js', 'kiosk.js'];

// 파일 → 모음 → { n: 허용 개수, why }
//  학생 기기에서도 불리는 곳(gamedata 의 학생 경로)은 why 에 "여러 기기" 로 적고 줄이는 게 목표.
const BASELINE = {
  'gamedata.js': {
    settings:          { n: 1, why: '교사 + 학생 기기(ensureDailyQuests 가 autoDailyLastDate 쓰려고 settings 통째) — 한 칸 쓰기로 줄일 후보' },
    artworks:          { n: 1, why: '교사 삭제 — id 키 객체로 씀(artworksObj)' },
    customProblems:    { n: 2, why: '교사만' },
    memories:          { n: 3, why: '여러 기기(학생 올리기↔교사 승인) — 판정 대기, 보고_20260915/판정_추억사진_저장방식_rf.md' },
    memoryAlbums:      { n: 2, why: '교사만' },
    promotionRequests: { n: 3, why: '여러 기기 — PROMO-PER-ID-1(#271) 머지 뒤 1(교사 고아 정리, id 키 객체)' },
    recorderSongs:     { n: 2, why: '교사만(리코더 제거 판정 대기)' },
  },
  'admin.js': {
    settings:             { n: 6, why: '교사만' },
    boardQuests:          { n: 6, why: '교사만 — 학생 아침 자동등록은 transaction' },
    customMonsters:       { n: 4, why: '교사만' },
    customQuestTemplates: { n: 3, why: '교사만' },
    hiddenQuestTemplates: { n: 2, why: '교사만' },
    artworks:             { n: 2, why: '교사만 — id 키 객체' },
    promotionRequests:    { n: 1, why: '교사 dedupeAll' },
  },
  'student.js': {},
  'kiosk.js': {},
};
const ROOT_SET_BASELINE = { 'gamedata.js': 1, 'admin.js': 1 };   // _fbRef.set(data) — 초기화·전체 복원

const RE = /\.child\((['"`])([A-Za-z_]+)\1\)\s*\.set\(/g;
const RE_ROOT = /_fbRef\.set\(/g;
const lineOf = (src, i) => src.slice(0, i).split('\n').length;

let pass = 0, fail = 0;
const out = [];
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const found = {};
  for (const m of src.matchAll(RE)) (found[m[2]] ||= []).push(lineOf(src, m.index));
  const base = BASELINE[f] || {};
  for (const name of new Set([...Object.keys(found), ...Object.keys(base)])) {
    const lines = found[name] || [], allow = base[name]?.n || 0;
    if (lines.length > allow) {
      fail++; out.push(`❌ FAIL   ${f}: child('${name}').set 이 ${lines.length}곳(허용 ${allow}) — 줄 ${lines.join(',')} · 여러 기기가 쓰면 id 경로로, 교사만이면 BASELINE 에 사유 적기`);
    } else if (lines.length < allow) {
      pass++; out.push(`✅ PASS   ${f}: ${name} ${lines.length}곳(허용 ${allow}) — 줄었음, BASELINE 낮춰도 됨`);
    } else if (allow) {
      pass++; out.push(`✅ PASS   ${f}: ${name} ${allow}곳 · ${base[name].why}`);
    }
  }
  const roots = [...src.matchAll(RE_ROOT)].map(m => lineOf(src, m.index));
  const rAllow = ROOT_SET_BASELINE[f] || 0;
  if (roots.length > rAllow) { fail++; out.push(`❌ FAIL   ${f}: root 통째 set ${roots.length}곳(허용 ${rAllow}) — 줄 ${roots.join(',')}`); }
  else if (rAllow) { pass++; out.push(`✅ PASS   ${f}: root 통째 set ${roots.length}곳(허용 ${rAllow})`); }
}
console.log(out.join('\n'));
console.log(`\n요약: PASS ${pass} · FAIL ${fail}`);
process.exitCode = fail ? 1 : 0;
