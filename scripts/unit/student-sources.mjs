// 우리반 성장 RPG — 학생 화면 스크립트 목록 (SPLIT-1, read-only)
//
//  2026-10-04 student.js 를 student/*.js 로 떼어 옮겼다(글자 그대로 · 전역 그대로 · 클래식 <script>).
//  시험이 student.js 글자만 읽으면 옮긴 파일을 **조용히 빠뜨린다**(함수가 없다고 FAIL 이면 차라리 낫고,
//  '이런 모양이 없어야 한다'는 검사는 빈 곳을 보고 그냥 통과한다). 그래서 학생 코드를 읽는 시험은 여기 두 함수를 쓴다.
//  단일 출처 = student.html 의 <script src> 순서(student.js 다음 student/*.js). 파일을 더하면 html 한 줄이면 시험도 따라온다.
//
//   studentScriptFiles(ROOT) → ['student.js', 'student/char.js', …]  (저장소 기준 경로, html 순서)
//   readStudentSources(ROOT) → 그 파일들을 순서대로 '\n' 으로 이은 글자 하나(함수 잘라 오기·글자 찾기용)
//   studentDirFiles(ROOT)    → student/ 폴더에 실제로 있는 .js (html 에 빠진 파일을 찾는 smoke 검사용)

import fs from 'node:fs';
import path from 'node:path';

export function studentScriptFiles(ROOT) {
  const html = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const src = (m[1].match(/\bsrc="([^"]+)"/) || [])[1];
    if (!src) continue;
    const p = src.split('?')[0].replace(/^\.\//, '');
    if ((p === 'student.js' || /^student\/[\w.-]+\.js$/.test(p)) && !out.includes(p)) out.push(p);
  }
  if (out[0] !== 'student.js') throw new Error('student.html 에서 student.js 를 (student/*.js 보다 먼저) 못 찾음');
  return out;
}

export function readStudentSources(ROOT) {
  return studentScriptFiles(ROOT).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

export function studentDirFiles(ROOT) {
  const dir = path.join(ROOT, 'student');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => 'student/' + f);
}
