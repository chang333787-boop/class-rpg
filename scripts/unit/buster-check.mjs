#!/usr/bin/env node
// 우리반 성장 RPG — 캐시버스터 누락 검사기 (read-only, git 읽기만)
//
//  PR(또는 로컬 브랜치)이 머지되기 전에 "고친 js/css 를 학생 브라우저가 옛 캐시로 읽는" 사고를 잡는다.
//  smoke-test [BUSTER-1] 은 한 시점의 html 만 보므로 "바뀌었는데 안 올렸다"는 못 본다 — 그 빈칸을 채운다.
//
//  사용:  node scripts/unit/buster-check.mjs [base=origin/main] [head=HEAD]
//
//  검사
//   판정은 **머지 뒤 값** 기준: 브랜치가 안 건드린 줄은 main 값이 남는다(뒤처진 브랜치 오탐 방지, #218로 확인).
//   ① 이 브랜치가 고친 js/css(merge-base..head) 를 참조하는 html 줄을 브랜치가 올렸는가 — 안 올렸으면 FAIL,
//      날짜가 main 끝보다 과거면 FAIL. main 도 같은 줄을 바꿨으면 충돌 예상 REVIEW.
//   ② 고치지 않은 파일인데 브랜치가 버스터를 과거 날짜로 바꿨는가 — 머지하면 되돌리는 셈이라 FAIL.
//   ③ 같은 파일(gamedata·curriculum 등)을 여러 html 이 참조하면 머지 뒤 값이 모두 같은가 — 다르면 FAIL.
//   ④ 로컬 js/css 참조에 ?v= 가 없으면 REVIEW.
//  순서는 **앞 8자리 날짜로만** 본다. 같은 날 세션 코드끼리(q3a·rfa·st…)는 글자 순서에 뜻이 없고,
//  캐시는 '처음 보는 문자열'이면 새로 받으므로 같은 날 다른 값이면 통과다(09-15 #220 q3a←rfa 오탐으로 확인).
//  진짜 위험은 ⓐ 그대로 ⓑ 날짜가 과거로 감(옛 값 재사용 가능성) 두 가지.
//
//  FAIL 1개 이상이면 exit 1.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [BASE = 'origin/main', HEAD = 'HEAD'] = process.argv.slice(2);
const HTML_FILES = ['student.html', 'admin.html', 'kiosk.html'];

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
const show = (rev, file) => { try { return git('show', `${rev}:${file}`); } catch { return null; } };

export function parseRefs(html) {
  const out = [];
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(?:https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('#')) continue;
    const [p, q = ''] = u.split('?');
    const file = p.replace(/^\.\//, '');
    if (!/\.(js|css)$/.test(file)) continue;
    const ver = (q.match(/(?:^|&)v=([^&]*)/) || [])[1] || '';
    out.push({ file, ver });
  }
  return out;
}
const dateOf = (v) => (String(v).match(/^\d{8}/) || [''])[0];
const behind = (v, b) => dateOf(v) && dateOf(b) && dateOf(v) < dateOf(b);
const refMap = (html) => { const m = new Map(); if (html) for (const r of parseRefs(html)) m.set(r.file, r.ver); return m; };

// base = merge-base(갈라진 곳), tip = main 끝, head = 이 브랜치.
// 브랜치가 안 건드린 줄은 머지하면 main 값이 남는다(squash·3-way). 그래서 '머지 뒤 값'으로 판정한다.
export function check({ changed, baseHtml, tipHtml = baseHtml, headHtml }) {
  const results = [];
  const add = (level, msg) => results.push({ level, msg });
  const merged = new Map(); // file → [{html, ver}]  머지 뒤 값
  for (const h of HTML_FILES) {
    const mb = refMap(baseHtml[h]), tip = refMap(tipHtml[h]), head = refMap(headHtml[h]);
    for (const [file, ver] of head) {
      const bv = mb.get(file), tv = tip.has(file) ? tip.get(file) : bv;
      const touched = ver !== bv;                       // 이 브랜치가 그 줄을 고쳤나
      if (touched && bv !== undefined && tv !== bv) {
        add('REVIEW', `${h}: ${file} 버스터를 main 도 바꿨음 (${bv} → main ${tv} / 이 브랜치 ${ver}) — 충돌 예상, rebase 뒤 다시 검사`);
      }
      const after = touched ? ver : tv;
      (merged.get(file) || merged.set(file, []).get(file)).push({ html: h, ver: after });
      if (!after) { add('REVIEW', `${h}: ${file} 에 ?v= 없음`); continue; }
      if (changed.has(file)) {
        if (bv === undefined) add('PASS', `${h}: ${file} 새 참조 (v=${after})`);
        else if (!touched) add('FAIL', `${h}: ${file} 를 고쳤는데 버스터 안 올림 (머지 뒤 v=${after}) — 학생 브라우저가 옛 파일을 씀`);
        else if (behind(ver, tv)) add('FAIL', `${h}: ${file} 버스터 날짜가 main 보다 과거 (${ver} < ${tv}) — 오늘 날짜로 올리기`);
        else add('PASS', `${h}: ${file} ${tv} → ${ver}`);
      } else if (touched && bv !== undefined) {
        if (behind(ver, tv)) add('FAIL', `${h}: ${file} 는 안 고쳤는데 버스터 날짜가 과거로 감 (${tv} → ${ver}) — 머지하면 되돌림`);
        else add('REVIEW', `${h}: ${file} 는 안 고쳤는데 버스터만 바뀜 (${bv} → ${ver}) — 해는 없음`);
      }
    }
  }
  for (const [file, list] of merged) {
    if (list.length < 2) continue;
    if (new Set(list.map(x => x.ver)).size > 1) add('FAIL', `${file} 버스터가 html 마다 다름(머지 뒤): ${list.map(x => `${x.html}=${x.ver}`).join(' · ')}`);
    else add('PASS', `${file} html ${list.length}곳 동일 (v=${list[0].ver})`);
  }
  for (const f of changed) {
    if (!/\.(js|css)$/.test(f) || f.includes('/')) continue;
    if (!HTML_FILES.some(h => refMap(headHtml[h]).has(f))) add('REVIEW', `${f} 를 고쳤지만 세 html 어디서도 참조 안 함`);
  }
  return results;
}

// ── 실행 ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mb = git('merge-base', BASE, HEAD).trim();
  const changed = new Set(git('diff', '--name-only', `${mb}..${HEAD}`).split(/\r?\n/).filter(Boolean));
  const baseHtml = {}, tipHtml = {}, headHtml = {};
  for (const h of HTML_FILES) { baseHtml[h] = show(mb, h); tipHtml[h] = show(BASE, h); headHtml[h] = show(HEAD, h); }
  const res = check({ changed, baseHtml, tipHtml, headHtml });
  const icon = { PASS: '✅ PASS  ', REVIEW: '🟡 REVIEW', FAIL: '❌ FAIL  ' };
  console.log(`base ${BASE} (${git('rev-parse', '--short', BASE).trim()}) · head ${HEAD} (${git('rev-parse', '--short', HEAD).trim()}) · merge-base ${mb.slice(0, 7)} · 바뀐 파일 ${changed.size}`);
  for (const r of res) console.log(`${icon[r.level]} ${r.msg}`);
  const n = l => res.filter(r => r.level === l).length;
  console.log(`\n요약: PASS ${n('PASS')} · REVIEW ${n('REVIEW')} · FAIL ${n('FAIL')}`);
  process.exit(n('FAIL') ? 1 : 0);
}
