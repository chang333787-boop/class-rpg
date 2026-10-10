// 음악실 악보 시험 [MUSIC-SCORE-1] — 악보로 자동 변환(작곡 '악보 같이 보기' · 오케스트라 총보 · 비트 악보)
//  node scripts/unit/music/score.test.mjs   (가짜 DOM 만 · 소리 없음 · 네트워크 없음)
//  · 예전 renderStaff(가락 악보) 그림이 한 글자도 안 바뀌었는지 — 기본 곡 15곡 × 너비 셋 × (화음 있음/없음)을 staff-golden.json 의 지문과 견준다
//    (지문 다시 만들기: UPDATE_GOLDEN=1 node scripts/unit/music/score.test.mjs — 예전 그림을 일부러 바꿀 때만)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { installFakeDom, serialize } from './fake-svg-dom.mjs';
installFakeDom();
const { renderStaff } = await import('../../../music/js/notation.js');
const { librarySongs, chordify } = await import('../../../music/js/song.js');
const { scaleRows } = await import('../../../music/js/theory.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, 'staff-golden.json');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

// ── 예전 가락 악보 지문 ──  화음 = 가락 음마다 음계 두 칸 아래(작곡 '아래 3도 넣기'와 같은 규칙)
function withThirds(song) {
  const rows = scaleRows(song.scale, song.notes), harm = [];
  for (const m of song.notes) { const i = rows.indexOf(m.p), q = rows[i - 2]; if (i >= 2 && q != null) harm.push({ s: m.s, d: m.d, p: q }); }
  return { ...song, harm: chordify(harm) };
}
function goldenCases() {
  const out = {};
  for (const s of librarySongs()) for (const w of [1000, 640, 380]) {
    out[`${s.lk}@${w}`] = sha(serialize(renderStaff(s, { width: w }).el));
    if (w === 1000) out[`${s.lk}@${w}+harm`] = sha(serialize(renderStaff(withThirds(s), { width: w }).el));
  }
  return out;
}
await test('예전 가락 악보(renderStaff) 그림 그대로 — 기본 곡 15곡 × 너비 셋 + 화음', () => {
  const now = goldenCases();
  if (process.env.UPDATE_GOLDEN) { fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n'); console.log('지문을 새로 썼어요: ' + Object.keys(now).length); }
  const old = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const diff = Object.keys(old).filter(k => old[k] !== now[k]);
  ok(Object.keys(old).length >= 60 && !diff.length, '바뀐 그림 ' + diff.length + ': ' + diff.slice(0, 6).join(', '));
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 악보: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
