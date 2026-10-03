// 무늬 공방 판 시험 — 움직임 대수 · 고르기 보기 넷이 다 다른 그림인가 · 탐정 판 정답 수 · 누구 말 판 · 무늬 판 · 고치기 판의 틀린 칸이 정말 하나인가
//  node scripts/unit/pattern/stages.test.mjs   (DOM 없음 · 네트워크 없음)
import { MOTIFS, MOVE_KEYS, apply, same, answersOfMove, mistakeOf, wallpaper, sameWall, unitAnswers, canon, ALIAS } from '../../../pattern/js/tiles.js';
import { PUZ, CHAPTERS } from '../../../pattern/js/stages.js';

const results = [];
const test = (name, fn) => { try { const r = fn(); results.push([r === false ? 'FAIL' : 'PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const key = g => g.join('|');

// ── 움직임 대수(교과서 사실) ──
for (const [k, m] of Object.entries(MOTIFS)) test(`도장 ${m.name} — 정사각형 · 움직임 대수`, () => {
  const g = m.g, n = g.length;
  ok(g.every(r => r.length === n && /^[0-9]+$/.test(r)), '정사각형 칸 그림이 아님');
  ok(same(apply(apply(apply(apply(g, 'r90'), 'r90'), 'r90'), 'r90'), g), '시계 방향 90° 네 번 ≠ 처음');
  ok(same(apply(apply(g, 'fh'), 'fh'), g) && same(apply(apply(g, 'fv'), 'fv'), g), '두 번 뒤집어도 처음이 아님');
  ok(same(apply(apply(g, 'fh'), 'fv'), apply(g, 'r180')), '오른쪽+아래쪽 뒤집기 ≠ 180°');
  ok(same(apply(apply(g, 'r90'), 'r90'), apply(g, 'r180')), '90° 두 번 ≠ 180°');
  ok(same(apply(g, 'cw270'), apply(g, 'r270')) && same(apply(g, 'fhL'), apply(g, 'fh')) && same(apply(g, 'cw360'), g), '다른 이름(왼쪽으로 · 시계 270° · 360°)이 다름');
  ok(g.some(r => /[1-9]/.test(r)), '빈 도장');
});
test('비대칭 도장 여섯은 움직임마다 다른 그림(답이 하나)', () => {
  for (const k of ['flag', 'giyeok', 'boot', 'note', 'face', 'boat']) ok(new Set(MOVE_KEYS.map(m => key(apply(MOTIFS[k].g, m)))).size === 6, k + ' 에 같은 그림이 있음');
});
test('헷갈림 이름', () => {
  ok(mistakeOf('fv', ['fh']) === 'axis' && mistakeOf('r270', ['r90']) === 'dir' && mistakeOf('r180', ['r90']) === 'angle', '뒤집기·방향·각도');
  ok(mistakeOf('fh', ['r180']) === 'fliprot' && mistakeOf('id', ['fh']) === 'still' && mistakeOf('fh', ['fh']) === null, '뒤집기·돌리기 · 그대로 · 정답');
  ok(mistakeOf('r90', ['fh', 'r270']) === 'dir', '정답이 여럿이면 같은 갈래(돌리기끼리)와 견줌');
});

// ── 판마다 ──
for (const p of PUZ) {
  test(`${p.id} ${p.title} — 판 설계대로`, () => {
    ok(CHAPTERS.find(c => c.id === p.ch), '장 없음');
    ok(p.story && p.hint && p.title, '이야기 · 힌트 없음');
    if (p.kind === 'predict') {
      ok(p.choices.length === 4 && p.choices.includes(p.move), '보기 넷 · 정답 포함');
      const imgs = p.choices.map(m => key(apply(p.grid, m)));
      ok(new Set(imgs).size === 4, '보기 넷 가운데 같은 그림이 있음');
      ok(p.choices.filter(m => same(apply(p.grid, m), p.target)).length === 1, '정답 그림이 보기에 하나가 아님');
    }
    if (p.kind === 'detect') {
      ok(p.answers.includes(p.move), '정답 움직임이 답에 없음');
      ok(p.multi ? p.answers.length > 1 : p.answers.length === 1, `답 수 ${p.answers.length} — multi=${!!p.multi} 와 다름`);
      if (p.multi) ok(/답이 둘/.test(p.story) === (p.answers.length === 2), '이야기의 답 수와 다름');
    }
    if (p.multi || p.kind === 'friend') ok(p.why, '끝나고 보여 줄 까닭(why) 없음');
    if (p.kind === 'friend') {
      ok(p.says.length === 2 && p.says.every(([w, m]) => w && (MOVE_KEYS.includes(m) || ALIAS[m])), '친구 말 둘');
      const right = p.says.map(([, m]) => same(apply(p.grid, m), p.target));
      ok(p.correct === (right[0] && right[1] ? 'both' : right[0] ? 'a' : right[1] ? 'b' : 'none'), '정답 셈');
    }
    if (p.kind === 'build') {
      ok(sameWall(wallpaper(p.motif, p.unit, p.cols, p.rows), p.wall), '정답 규칙이 목표 무늬를 못 만듦');
      ok(p.cols % p.unit[0].length === 0 && p.rows % p.unit.length === 0, '판이 규칙 칸으로 딱 나뉘지 않음');
      ok(unitAnswers(p.motif, p.unit).flat().every(a => a.length >= 1), '규칙 칸 정답 없음');
    }
    if (p.kind === 'fix') {
      const [wx, wy, wm] = p.wrong, shown = p.wall.map((row, y) => row.map((t, x) => (x === wx && y === wy ? apply(p.grid, wm) : t)));
      let diff = 0; shown.forEach((row, y) => row.forEach((t, x) => { if (!same(t, p.wall[y][x])) diff++; }));
      ok(diff === 1, `틀린 칸 ${diff}개`);
      ok(wx < p.cols && wy < p.rows, '틀린 칸이 판 밖');
    }
  });
}
test('장별 판 수', () => { const n = [1, 2, 3, 4, 5].map(c => PUZ.filter(p => p.ch === c).length); ok(n.join(',') === '6,6,6,6,4', n.join(',')); });
test('친구 말 판 — 정답이 고루(둘 다 · 한 명)', () => { const c = new Set(PUZ.filter(p => p.kind === 'friend').map(p => p.correct)); ok(c.has('both') && (c.has('a') || c.has('b')), [...c].join(',')); });
test('고르기 판 — 정답 자리가 고루', () => { const pos = new Set(PUZ.filter(p => p.kind === 'predict').map(p => p.choices.indexOf(p.move))); ok(pos.size >= 3, [...pos].join(',')); });
test('ㄱ을 180° 돌리면 ㄴ 모양', () => { const g = apply(MOTIFS.giyeok.g, 'r180'); ok(g[3] === '5550' && g.slice(0, 3).every(r => r === '5000'), g.join(' ')); });
test('canon — 다른 이름', () => { ok(canon('fhL') === 'fh' && canon('cw270') === 'r270' && canon('r90') === 'r90', 'canon'); });

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`\n요약: PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
