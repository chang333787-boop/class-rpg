// 무늬 공방 — 도장(정사각형 칸 그림) · 움직임(밀기 · 뒤집기 · 돌리기) · 무늬(규칙 칸을 밀어 채우기). DOM 없음(시험에서도 그대로 돈다).
//  [PATTERN-1] 4학년 수학 [4수03-04] 밀기 · 뒤집기 · 돌리기 / [4수03-12] 모양을 만들거나 채우기. 겹친 움직임(돌리고 뒤집기)은 다루지 않는다(교육과정 적용 시 고려 사항).
//  채점은 움직임 이름이 아니라 결과 그림으로 — 위아래가 같은 도장은 '그대로'와 '아래쪽으로 뒤집기'가 둘 다 정답(설명 방법이 다양할 수 있음).

// 칸 색 — 0 = 빈칸 · 글자 하나가 칸 하나
export const PALETTE = { 0: '', 1: '#e5484d', 2: '#f08c2e', 3: '#f2c230', 4: '#3fae62', 5: '#2f7fe0', 6: '#8e5bd0', 7: '#4a3a2a', 8: '#ffffff', 9: '#c9ab6d' };

// 도장 — 이름 · 칸 그림(정사각형). 위아래 · 좌우가 같은 도장은 일부러 섞었다(답이 여럿인 판)
export const MOTIFS = {
  flag: { name: '깃발', g: ['71100', '71110', '71100', '70000', '70000'] },
  giyeok: { name: 'ㄱ', g: ['0555', '0005', '0005', '0005'] },
  boot: { name: '장화', g: ['0550', '0550', '0555', '0555'] },
  half: { name: '반쪽 색칠 정사각형', g: ['1000', '1100', '1110', '1111'] },
  tri: { name: '두 색 세모', g: ['5222', '5522', '5552', '5555'] },
  arrow: { name: '화살표', g: ['00200', '00220', '22222', '00220', '00200'] },
  mushroom: { name: '버섯', g: ['01110', '11811', '11111', '00900', '00900'] },
  note: { name: '음표', g: ['00770', '00707', '00700', '07700', '07700'] },
  face: { name: '윙크 슬라임', g: ['04440', '48474', '44444', '47744', '04440'] },
  boat: { name: '돛단배', g: ['00300', '00330', '00333', '22222', '02220'] },
};

// 움직임 — 버튼 6개(기본) · 친구 말에 나오는 다른 이름은 ALIAS
export const MOVES = {
  id: { name: '그대로(밀기)', short: '그대로', icon: '⇢' },
  fh: { name: '오른쪽으로 뒤집기', short: '오른쪽으로 뒤집기', icon: '⇄' },
  fv: { name: '아래쪽으로 뒤집기', short: '아래쪽으로 뒤집기', icon: '⇅' },
  r90: { name: '시계 방향으로 90°만큼 돌리기', short: '시계 방향 90°', icon: '↻' },
  r180: { name: '180°만큼 돌리기', short: '180° 돌리기', icon: '⟳' },
  r270: { name: '시계 반대 방향으로 90°만큼 돌리기', short: '시계 반대 방향 90°', icon: '↺' },
};
export const MOVE_KEYS = Object.keys(MOVES);
export const ALIAS = {
  fhL: { name: '왼쪽으로 뒤집기', is: 'fh' }, fvU: { name: '위쪽으로 뒤집기', is: 'fv' },
  cw270: { name: '시계 방향으로 270°만큼 돌리기', is: 'r270' }, ccw270: { name: '시계 반대 방향으로 270°만큼 돌리기', is: 'r90' },
  cw360: { name: '시계 방향으로 360°만큼 돌리기', is: 'id' }, ccw180: { name: '시계 반대 방향으로 180°만큼 돌리기', is: 'r180' },
};
export const canon = m => (ALIAS[m] ? ALIAS[m].is : m);
export const moveName = m => (MOVES[m] || ALIAS[m] || { name: m }).name;

// 움직인 그림 — 새 칸 (x, y) 에 옛 칸 어디가 오나
export function apply(g, m) {
  m = canon(m);
  const n = g.length, at = (x, y) => g[y][x];
  const f = { id: (x, y) => at(x, y), fh: (x, y) => at(n - 1 - x, y), fv: (x, y) => at(x, n - 1 - y),
    r90: (x, y) => at(y, n - 1 - x), r180: (x, y) => at(n - 1 - x, n - 1 - y), r270: (x, y) => at(n - 1 - y, x) }[m];
  if (!f) throw new Error('움직임 없음: ' + m);
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => f(x, y)).join(''));
}
export const same = (a, b) => a.length === b.length && a.every((r, i) => r === b[i]);
export const gridOf = motif => (typeof motif === 'string' ? MOTIFS[motif].g : motif);
// 이 도장을 target 그림으로 만드는 움직임 모두(답이 여럿일 수 있다)
export const answersFor = (motif, target) => MOVE_KEYS.filter(k => same(apply(gridOf(motif), k), target));
export const answersOfMove = (motif, m) => answersFor(motif, apply(gridOf(motif), m));

// 틀린 답 → 헷갈림 이름. right = 정답 움직임들(같은 갈래가 있으면 그것과 견준다: 뒤집기끼리 · 돌리기끼리)
const FLIP = new Set(['fh', 'fv']), ROT = new Set(['r90', 'r180', 'r270']);
export const MISTAKES = { axis: '좌우·위아래 뒤집기 헷갈림', dir: '돌리는 방향 헷갈림', angle: '돌린 각도 헷갈림', fliprot: '뒤집기·돌리기 헷갈림', still: '움직임 못 봄',
  samepic: '설명이 달라도 같은 그림인 것을 놓침', find: '틀린 칸 못 찾음' };
export function mistakeOf(chosen, right) {
  chosen = canon(chosen);
  if (right.includes(chosen)) return null;
  const fam = s => (FLIP.has(s) ? 'F' : ROT.has(s) ? 'R' : 'I');
  const k = right.find(r => fam(r) === fam(chosen)) || right[0];
  if (chosen === 'id' || k === 'id') return 'still';
  if (FLIP.has(chosen) && FLIP.has(k)) return 'axis';
  if (ROT.has(chosen) && ROT.has(k)) return (chosen === 'r180' || k === 'r180') ? 'angle' : 'dir';
  return 'fliprot';
}

// 무늬 — 규칙 칸(unit = [[움직임, …], …])을 밀어(밀기) cols × rows 칸을 채운다. 칸마다 그림
export function wallpaper(motif, unit, cols, rows) {
  const g = gridOf(motif), uh = unit.length, uw = unit[0].length;
  return Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => apply(g, unit[y % uh][x % uw])));
}
export const sameWall = (a, b) => a.length === b.length && a.every((row, y) => row.length === b[y].length && row.every((t, x) => same(t, b[y][x])));
// 규칙 칸마다 정답 움직임들(그림이 같으면 다 정답)
export const unitAnswers = (motif, unit) => unit.map(row => row.map(m => answersOfMove(motif, m)));
