// 우리반 성장 RPG — 공유 코드(gamedata) 스크립트 목록 (GAMEDATA-SPLIT-1, read-only)
//
//  gamedata.js 를 gamedata/*.js 로 떼어 옮겼다(글자 그대로 · 전역 그대로 · 클래식 <script> — student-sources.mjs 와 같은 방식).
//  gamedata.js(바탕)에는 FIREBASE_CONFIG · DB 저장층 · Utils 가 남고, 상수 표·업적·감정·전투는 gamedata/ 로 갔다.
//  시험이 gamedata.js 글자만 읽으면 옮긴 코드를 **조용히 빠뜨린다**(함수가 없다고 FAIL 이면 차라리 낫고,
//  '이런 모양이 없어야 한다'·'몇 곳까지' 검사는 빈 곳을 보고 그냥 통과한다). 그래서 공유 코드를 읽는 시험은 여기 함수를 쓴다.
//  단일 출처 = student.html 의 <script src> 순서(gamedata.js 다음 gamedata/*.js). admin·kiosk·watercolor 도 같은 줄을
//  같은 순서·같은 ?v= 로 부르는지는 smoke-test 가 본다. 파일을 더하면 html 네 곳에 한 줄씩이면 시험도 따라온다.
//  나누기 전 체크아웃(gamedata/ 없음)에서도 그대로 돈다 — ['gamedata.js'] 하나를 돌려준다(GOLD_SIM_ROOT·밸런스 옛 판 비교).
//
//   GAMEDATA_HTMLS              → gamedata 를 부르는 html 네 곳(student · admin · kiosk · watercolor/index.html)
//   gamedataTagsIn(html)        → 그 html 의 gamedata 태그 [{ file:'gamedata/data.js', ver }] (저장소 기준 경로, 나온 순서)
//   gamedataScriptFiles(ROOT)   → ['gamedata.js', 'gamedata/data.js', …]  (student.html 순서)
//   readGamedataSources(ROOT)   → 그 파일들을 순서대로 '\n' 으로 이은 글자 하나(vm 에 올리기·글자 찾기용)
//   gamedataWhere(ROOT)         → readGamedataSources 글자 자리(index) → 'gamedata/<파일>.js:<줄>' (검사 메시지용)
//   gamedataDirFiles(ROOT)      → gamedata/ 폴더에 실제로 있는 .js (html 에 빠진 파일을 찾는 smoke 검사용)
//   gamedataSourcesAt(file)     → '…/gamedata.js' 경로 하나 → 그 체크아웃의 공유 코드 전체(옆에 student.html 이 없으면 그 파일만)
//   gamedataSourcesFromGit(ROOT, rev) → git 커밋의 공유 코드 전체(그 커밋의 student.html 순서 · 나누기 전 커밋이면 gamedata.js 하나)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const GAMEDATA_HTMLS = ['student.html', 'admin.html', 'kiosk.html', 'watercolor/index.html'];

export function gamedataTagsIn(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<script\b([^>]*)>/g)) {
    const src = (m[1].match(/\bsrc="([^"]+)"/) || [])[1];
    if (!src) continue;
    const [p, q = ''] = src.split('?');
    const file = p.replace(/^(?:\.\.?\/)+/, '');
    if (file === 'gamedata.js' || /^gamedata\/[\w.-]+\.js$/.test(file)) out.push({ file, ver: (q.match(/(?:^|&)v=([^&]*)/) || [])[1] || '' });
  }
  return out;
}

function filesFromHtml(html, where) {
  const out = [];
  for (const t of gamedataTagsIn(html)) if (!out.includes(t.file)) out.push(t.file);
  if (out[0] !== 'gamedata.js') throw new Error(`${where} 에서 gamedata.js 를 (gamedata/*.js 보다 먼저) 못 찾음`);
  return out;
}

export function gamedataScriptFiles(ROOT) {
  return filesFromHtml(fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8'), 'student.html');
}

export function readGamedataSources(ROOT) {
  return gamedataScriptFiles(ROOT).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

export function gamedataWhere(ROOT) {
  const parts = [];
  let at = 0;
  for (const f of gamedataScriptFiles(ROOT)) {
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

export function gamedataDirFiles(ROOT) {
  const dir = path.join(ROOT, 'gamedata');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => 'gamedata/' + f);
}

export function gamedataSourcesAt(file) {
  const dir = path.dirname(file);
  if (path.basename(file) === 'gamedata.js' && fs.existsSync(path.join(dir, 'student.html'))) return readGamedataSources(dir);
  return fs.readFileSync(file, 'utf8');
}

export function gamedataSourcesFromGit(ROOT, rev) {
  const show = (f) => execFileSync('git', ['-C', ROOT, 'show', `${rev}:${f}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let files = ['gamedata.js'];
  try { files = filesFromHtml(show('student.html'), `${rev}:student.html`); } catch (e) { if (!/못 찾음/.test(e.message)) throw e; }
  return files.map(show).join('\n');
}
