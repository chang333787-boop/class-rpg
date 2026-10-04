// 우리반 성장 RPG — 관리(교사) 화면 스크립트 목록 (ADMIN-SPLIT-1, read-only)
//
//  admin.js 를 admin/*.js 로 떼어 옮겼다(글자 그대로 · 전역 그대로 · 클래식 <script> — student-sources.mjs 와 같은 방식).
//  시험이 admin.js 글자만 읽으면 옮긴 파일을 **조용히 빠뜨린다**(함수가 없다고 FAIL 이면 차라리 낫고,
//  '이런 모양이 없어야 한다'·'몇 곳까지'는 검사는 빈 곳을 보고 그냥 통과한다). 그래서 관리 코드를 읽는 시험은 여기 함수를 쓴다.
//  단일 출처 = admin.html 의 <script src> 순서(admin.js 다음 admin/*.js). 파일을 더하면 html 한 줄이면 시험도 따라온다.
//  나누기 전 체크아웃(admin/ 없음)에서도 그대로 돈다 — ['admin.js'] 하나를 돌려준다(GOLD_SIM_ROOT 로 옛 판 비교할 때).
//
//   adminScriptFiles(ROOT) → ['admin.js', 'admin/students.js', …]  (저장소 기준 경로, html 순서)
//   readAdminSources(ROOT) → 그 파일들을 순서대로 '\n' 으로 이은 글자 하나(함수 잘라 오기·글자 찾기용)
//   adminWhere(ROOT)       → readAdminSources 글자 자리(index) → 'admin/<파일>.js:<줄>' 로 바꾸는 함수(검사 메시지용)
//   adminDirFiles(ROOT)    → admin/ 폴더에 실제로 있는 .js (html 에 빠진 파일을 찾는 smoke 검사용)

import fs from 'node:fs';
import path from 'node:path';

export function adminScriptFiles(ROOT) {
  const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const src = (m[1].match(/\bsrc="([^"]+)"/) || [])[1];
    if (!src) continue;
    const p = src.split('?')[0].replace(/^\.\//, '');
    if ((p === 'admin.js' || /^admin\/[\w.-]+\.js$/.test(p)) && !out.includes(p)) out.push(p);
  }
  if (out[0] !== 'admin.js') throw new Error('admin.html 에서 admin.js 를 (admin/*.js 보다 먼저) 못 찾음');
  return out;
}

export function readAdminSources(ROOT) {
  return adminScriptFiles(ROOT).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

export function adminWhere(ROOT) {
  const parts = [];
  let at = 0;
  for (const f of adminScriptFiles(ROOT)) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    parts.push({ f, at, src });
    at += src.length + 1;   // 이을 때 '\n'
  }
  return (i) => {
    let p = parts[0];
    for (const q of parts) if (q.at <= i) p = q;
    return `${p.f}:${p.src.slice(0, i - p.at).split('\n').length}`;
  };
}

export function adminDirFiles(ROOT) {
  const dir = path.join(ROOT, 'admin');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => 'admin/' + f);
}
