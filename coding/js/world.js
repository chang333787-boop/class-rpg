// 코딩 세계 — 몬스터 길 찾기(칸 판) · 불씨 참새 붓(선 그림). DOM 없음(시험에서도 그대로 돈다).
//  [CODING-ROOM-1] 몬스터마다 알아듣는 명령이 다르다(실과 [6실05-02] '컴퓨터에게 명령하는 방법' — 기계마다 명령어가 다르다).

// 몬스터(도감과 같은 그림 · gamedata.js 이름 그대로) — mode: rel = 바라보는 쪽 기준(앞으로·돌기) · abs = 화면 기준(위·아래·옆)
export const HEROES = {
  slime:    { name: '슬라임',      img: 'm1',  mode: 'rel', about: '앞으로 가고, 제자리에서 왼쪽·오른쪽으로 돌아요.' },
  crab:     { name: '조약돌 게',   img: 'm26', mode: 'abs', about: '돌지 못해요. 대신 위·아래·왼쪽·오른쪽으로 바로 걸어요.' },
  frog:     { name: '거품 개구리', img: 'm23', mode: 'rel', about: '웅덩이는 두 칸 뛰기로 넘어요(나무는 못 넘어요).' },
  squirrel: { name: '새싹 다람쥐', img: 'm24', mode: 'rel', about: '도토리 위에서 줍기를 해요. 도토리를 다 모아야 집에 들어가요.' },
  sparrow:  { name: '불씨 참새',   img: 'm21', mode: 'pen', about: '날아간 자리에 불꽃 선이 남아요. 걸음 수와 돌 각도를 정해 그림을 그려요.' },
};

// ── 길 찾기 판 ──
//  '#' 나무 · ' ' 풀밭(못 감) · '.' 길 · 'S' 출발 · 'G' 집 · '~' 웅덩이(개구리만 뛰어넘음) · 'a' 도토리가 있는 길
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 위 · 오른쪽 · 아래 · 왼쪽
export const DIR_OF = { N: 0, E: 1, S: 2, W: 3 };
const WALK = '.SGa';

export function parseMap(rows) {
  const grid = rows.map(r => r.split('')), h = grid.length, w = Math.max(...rows.map(r => r.length));
  let start = null, goal = null; const acorns = [];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c === 'S') start = { x, y }; if (c === 'G') goal = { x, y }; if (c === 'a') acorns.push(x + ',' + y); }));
  return { grid, w, h, start, goal, acorns };
}

export function makeMaze(def) {
  const m = parseMap(def.map);
  const cell = (x, y) => (y >= 0 && y < m.h && x >= 0 && x < m.w) ? (m.grid[y][x] || ' ') : null;
  const st = { x: m.start.x, y: m.start.y, dir: DIR_OF[def.dir || 'E'], acorns: new Set(m.acorns), steps: 0, trail: [[m.start.x, m.start.y]] };
  function stepTo(dx, dy) {
    const nx = st.x + dx, ny = st.y + dy, c = cell(nx, ny);
    if (c == null) return { ok: false, why: 'edge' };
    if (c === '~') return { ok: false, why: 'water' };
    if (!WALK.includes(c)) return { ok: false, why: 'wall' };
    st.x = nx; st.y = ny; st.trail.push([nx, ny]);
    return { ok: true, kind: 'move' };
  }
  return {
    kind: 'maze', def, map: m, st, cell,
    act(t) {
      st.steps++;
      switch (t) {
        case 'fwd': return stepTo(...DIRS[st.dir]);
        case 'left': st.dir = (st.dir + 3) % 4; return { ok: true, kind: 'turn' };
        case 'right': st.dir = (st.dir + 1) % 4; return { ok: true, kind: 'turn' };
        case 'up': return stepTo(0, -1);
        case 'down': return stepTo(0, 1);
        case 'west': return stepTo(-1, 0);
        case 'east': return stepTo(1, 0);
        case 'jump': {
          const [dx, dy] = DIRS[st.dir], mid = cell(st.x + dx, st.y + dy), land = cell(st.x + 2 * dx, st.y + 2 * dy);
          if (mid === '#') return { ok: false, why: 'tree' };
          if (land == null) return { ok: false, why: 'edge' };
          if (!WALK.includes(land)) return { ok: false, why: land === '~' ? 'water' : 'land' };
          st.x += 2 * dx; st.y += 2 * dy; st.trail.push([st.x, st.y]);
          return { ok: true, kind: 'jump' };
        }
        case 'pick': {
          const k = st.x + ',' + st.y;
          if (!st.acorns.has(k)) return { ok: false, why: 'noacorn' };
          st.acorns.delete(k); return { ok: true, kind: 'pick' };
        }
      }
      return { ok: false, why: 'unknown' };
    },
    // 끝난 뒤: 집에 닿았고 도토리를 다 모았나
    result() {
      const atGoal = st.x === m.goal.x && st.y === m.goal.y;
      if (atGoal && !st.acorns.size) return { ok: true };
      if (atGoal) return { ok: false, why: 'acorns', left: st.acorns.size };
      return { ok: false, why: 'short' };
    },
  };
}

// ── 불씨 참새 붓 ──  판 400×400 · 방향 0 = 위, 시계 방향으로 도(°)
export const PEN_COLORS = [['빨강', '#e5484d'], ['주황', '#f08c2e'], ['노랑', '#f2c230'], ['초록', '#3fae62'], ['파랑', '#2f7fe0'], ['보라', '#8e5bd0'], ['검정', '#2b2b2b'], ['흰색', '#ffffff']];
export function makePen(def) {
  const s = def.start || { x: 200, y: 200, h: 0 };
  const st = { x: s.x, y: s.y, h: s.h || 0, down: true, color: '#f08c2e', segs: [], steps: 0 };
  return {
    kind: 'pen', def, st,
    act(t, v) {
      st.steps++;
      if (t === 'pf') {
        const r = st.h * Math.PI / 180, nx = st.x + v * Math.sin(r), ny = st.y - v * Math.cos(r);
        if (st.down && v) st.segs.push({ x1: st.x, y1: st.y, x2: nx, y2: ny, c: st.color });
        const from = { x: st.x, y: st.y }; st.x = nx; st.y = ny;
        return { ok: true, kind: 'draw', from, len: Math.abs(v) };
      }
      if (t === 'pr') { st.h = ((st.h + v) % 360 + 360) % 360; return { ok: true, kind: 'turn' }; }
      if (t === 'pl') { st.h = ((st.h - v) % 360 + 360) % 360; return { ok: true, kind: 'turn' }; }
      if (t === 'pc') { st.color = v; return { ok: true, kind: 'color' }; }
      if (t === 'pu') { st.down = false; return { ok: true, kind: 'pen' }; }
      if (t === 'pd') { st.down = true; return { ok: true, kind: 'pen' }; }
      return { ok: false, why: 'unknown' };
    },
  };
}

// 두 그림이 같은가 — 선을 4px 칸에 찍어 칸 모음끼리 견준다(같은 변을 두 번에 나눠 그려도 · 차례가 달라도 같다)
//  한쪽 칸마다 다른 쪽 칸이 한 칸 안에 있으면 '덮임'. 목표의 97% 이상이 덮이고, 내 그림의 97% 이상이 목표에 있으면 같다.
const CELL = 4;
function rasterOf(segs) {
  const set = new Set();
  for (const s of segs) {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = Math.max(1, Math.ceil(len));
    for (let i = 0; i <= n; i++) { const x = s.x1 + (s.x2 - s.x1) * i / n, y = s.y1 + (s.y2 - s.y1) * i / n; set.add(Math.round(x / CELL) + ',' + Math.round(y / CELL)); }
  }
  return set;
}
function coverage(a, b) {   // a 의 칸 가운데 b 의 칸이 한 칸 안에 있는 비율
  if (!a.size) return 1;
  let hit = 0;
  for (const k of a) {
    const [x, y] = k.split(',').map(Number);
    let ok = false;
    for (let dx = -1; dx <= 1 && !ok; dx++) for (let dy = -1; dy <= 1 && !ok; dy++) if (b.has((x + dx) + ',' + (y + dy))) ok = true;
    if (ok) hit++;
  }
  return hit / a.size;
}
export function compareDrawing(target, drawn) {
  const T = rasterOf(target), D = rasterOf(drawn);
  const covered = coverage(T, D), extra = 1 - coverage(D, T);
  return { ok: covered >= 0.97 && extra <= 0.03, covered, extra };
}

// 받침이 있으면 앞 것(이 · 은 · 을), 없으면 뒤 것(가 · 는 · 를)
export const josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b); };
// 실패 까닭 → 아이 말(몬스터 이름을 넣는다)
export function whyText(why, hero, extra = {}) {
  const n = (HEROES[hero] || {}).name || '몬스터';
  return {
    wall: `${josa(n, '이', '가')} 나무에 부딪혔어요! 어디서 돌아야 했을까요?`,
    water: hero === 'frog' ? `웅덩이에 빠질 뻔했어요 — '두 칸 뛰기'로 넘어 봐요` : `웅덩이예요! ${josa(n, '은', '는')} 물에 못 들어가요`,
    edge: `길 밖으로 나갈 뻔했어요`,
    tree: `나무는 뛰어넘을 수 없어요 — 웅덩이만 넘어요`,
    land: `뛰어서 내릴 자리가 길이 아니에요`,
    noacorn: `여기엔 도토리가 없어요 — 도토리 위에서 줍기를 해요`,
    short: `아직 집에 못 갔어요 — 블록이 더 필요해요`,
    acorns: `집에 왔지만 도토리를 ${extra.left || ''}개 덜 주웠어요`,
    loop: `너무 오래 걸려요 — 끝없이 반복하는 건 아닐까요?`,
    draw: `그림이 안내선과 달라요 — 걸음 수와 돌 각도를 살펴봐요`,
    empty: `'시작하면' 아래에 블록을 이어 주세요`,
    unknown: `이 몬스터가 모르는 명령이에요`,
  }[why] || '다시 해 봐요';
}
