// student/deco.js — 꾸미기(인테리어 = 마당·집 안 장식 배치) + 친구 마당 구경·방문(꾸미기 이름을 씀) · 집 허브·농장은 student.js 에 남음
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'deco' — 원래 student.js 4573~12402줄 ──
// ══ 인테리어 (장식 배치) ══
// ══ 집 인테리어 (탑뷰 SVG) ══
// ── 바닥 타일 시스템 ──
const FLOOR_TILES = {
  grass:      { bg:'#4a8c2a', alt:'#3f7a24', border:'rgba(255,255,255,.06)' },
  dirt:       { bg:'#8B6340', alt:'#7a5635', border:'rgba(0,0,0,.1)' },
  stone:      { bg:'#7a7a8a', alt:'#6e6e7c', border:'rgba(0,0,0,.15)' },
  sand:       { bg:'#c8a855', alt:'#b89545', border:'rgba(255,255,255,.1)' },
  wood:       { bg:'#9B6B3A', alt:'#8a5c2e', border:'rgba(0,0,0,.12)' },
  // ── 새 타일 ──
  water:      { bg:'#2a7ab8', alt:'#1e6aa0', border:'rgba(255,255,255,.1)' },
  brick:      { bg:'#9a5840', alt:'#8a4e38', border:'rgba(0,0,0,.15)' },
  gravel:     { bg:'#8a8878', alt:'#7c7a6c', border:'rgba(0,0,0,.12)' },
  dark_earth: { bg:'#5a3820', alt:'#4a2e18', border:'rgba(0,0,0,.2)' },
  flower:     { bg:'#4a8c2a', alt:'#3f7a24', border:'rgba(255,255,255,.06)' },
  stone_floor:{ bg:'#9a9898', alt:'#888686', border:'rgba(0,0,0,.15)' },
  // ── 2차 신규 타일 ──
  deck:       { bg:'#a07838', alt:'#8c6828', border:'rgba(0,0,0,.12)' },
  dry_earth:  { bg:'#c0a060', alt:'#b09050', border:'rgba(0,0,0,.1)' },
  gravel_yard:{ bg:'#989080', alt:'#888070', border:'rgba(0,0,0,.12)' },
};
const FLOOR_TILE_COLORS = {
  grass:      { bg:'rgba(74,140,42,.2)',  color:'#a8e06a', border:'rgba(74,140,42,.5)' },
  dirt:       { bg:'rgba(139,99,64,.3)',  color:'#d4a574', border:'rgba(139,99,64,.5)' },
  stone:      { bg:'rgba(120,120,140,.25)',color:'#c0c0d0',border:'rgba(120,120,140,.5)' },
  sand:       { bg:'rgba(200,168,85,.25)',color:'#f0d080', border:'rgba(200,168,85,.5)' },
  wood:       { bg:'rgba(155,107,58,.3)', color:'#d4a870', border:'rgba(155,107,58,.5)' },
  water:      { bg:'rgba(42,122,184,.3)', color:'#7ec8e3', border:'rgba(42,122,184,.6)' },
  brick:      { bg:'rgba(154,88,64,.3)',  color:'#d4987a', border:'rgba(154,88,64,.6)' },
  gravel:     { bg:'rgba(138,136,120,.3)',color:'#c8c6b0', border:'rgba(138,136,120,.5)' },
  dark_earth: { bg:'rgba(90,56,32,.4)',   color:'#a07848', border:'rgba(90,56,32,.6)' },
  flower:     { bg:'rgba(74,140,42,.2)',  color:'#f0a8d0', border:'rgba(200,100,180,.5)' },
  stone_floor:{ bg:'rgba(154,152,152,.3)',color:'#d0cece', border:'rgba(154,152,152,.5)' },
  deck:       { bg:'rgba(160,120,56,.3)', color:'#d4a870', border:'rgba(160,120,56,.5)' },
  dry_earth:  { bg:'rgba(192,160,96,.3)', color:'#e8d0a0', border:'rgba(192,160,96,.5)' },
  gravel_yard:{ bg:'rgba(152,144,128,.3)',color:'#ccc8b8', border:'rgba(152,144,128,.5)' },
};
let DECO_MODE = 'deco';   // 'deco' | 'floor'
let CUR_FLOOR_TILE = 'grass';

function setDecoMode(mode, btn) {
  DECO_MODE = mode;
  document.querySelectorAll('.deco-mode-btn').forEach(b => {
    b.style.background = 'rgba(255,255,255,.06)';
    b.style.color = 'var(--txt2)';
    b.style.borderColor = 'rgba(255,255,255,.1)';
  });
  if (btn) {
    btn.style.background = mode==='deco'?'rgba(255,215,0,.12)':'rgba(93,173,226,.12)';
    btn.style.color = mode==='deco'?'var(--gold)':'var(--sky)';
    btn.style.borderColor = mode==='deco'?'rgba(255,215,0,.4)':'rgba(93,173,226,.4)';
  }
  document.body.classList.toggle('deco-floor-mode', mode === 'floor');   // [DECO-PT-2] 바닥 모드면 장식 서랍 접기
  _floorPickShow(mode === 'floor');   // [DECO-FLOOR-PICK-1] 접힌 서랍 자리에 바닥 고르기 판
  if (_decoRectPrev) { _decoRectPrev = null; _decoRectTip(); }   // [DECO-FLOOR-RECT-1]
  if (_inRoomPrev && _inRoomPrev.ghost) _inRoomPrevSet(null);   // [DECO-ROOM-HOUSE-1] 크기 칩 미리 보기는 그 모드에서만
  setTimeout(() => { try { _decoPillarSync(); } catch (e) {} }, 0);
  document.body.classList.toggle('deco-erase-mode', mode === 'erase');
  if (mode === 'erase') { SEL_DECO = null; if (typeof renderDecoInv === 'function') renderDecoInv(); }
  const floorRow = document.getElementById('floor-tile-row');
  const hint = document.getElementById('deco-mode-hint');
  if (floorRow) floorRow.style.display = mode==='floor' ? 'flex' : 'none';
  if (hint) hint.style.display = mode==='floor' ? 'none' : '';
  _drawDeco();
}

function setCurFloor(type, btn) {
  CUR_FLOOR_TILE = type;
  document.querySelectorAll('.floor-tile-btn').forEach(b => {
    b.style.background = 'rgba(255,255,255,.06)';
    b.style.color = 'var(--txt2)';
    b.style.borderColor = 'rgba(255,255,255,.1)';
  });
  if (btn) {
    const fc = FLOOR_TILE_COLORS[type]||{};
    btn.style.background = fc.bg||'rgba(255,255,255,.1)';
    btn.style.color = fc.color||'var(--gold)';
    btn.style.borderColor = fc.border||'rgba(255,255,255,.3)';
  }
}

// ══ 바닥 고르기 화면 (DECO-FLOOR-PICK-1 · 정원 바닥 연결 ④-1) ══════════════
//  규칙 원본: docs/deco_floor_picker_20260920.md — (다) 견본 판 + 가족 칩 · 색 · 테두리 세 줄. 칠하기는 지금의 '끌어서' 그대로(④-2 에서 '네모로').
//  · 저장값은 `_floorJoin` 한 곳에서만 만든다 — 늘 `이름#색+마감` 순서 · 기본색이면 `#` 없이 · 자연(마감 없음)이면 `+` 없이.
//    지우개 판정 네 곳이 저장값을 **글자 그대로** 비교하므로(같은 바닥을 다시 칠하면 걷힌다) 한 조합 = 한 글자여야 한다.
//  · 견본·칩·동그라미 그림은 마당과 같은 `_drawFloorSVG` 로 그린다(가장자리·마감까지 칠해질 모습 그대로).
//  · 판·칩·동그라미·말풍선 모양은 `_pk*` 로 떼어 두었다 — 집 안 벽지·바닥 고르기(IN-2)가 그림 그리는 함수만 바꿔 같은 말투로 쓰게.
function _floorJoin(name, color, rim) {
  name = String(name || '');
  if (!/^[a-z][a-z0-9_]*$/.test(name)) return 'grass';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const cols = own(_FLOOR_COLORS, name) ? _FLOOR_COLORS[name] : null;
  const col = (color && cols && cols.indexOf(color) >= 0) ? color : '';                       // 기본색·모르는 색 → 글자 없음
  const rm = (rim && _FLOOR_EDGE_COLOR[name] && _FLOOR_RIMS.indexOf(rim) >= 0) ? rim : '';    // 꽃밭 무리만 마감(들꽃·옛 바닥은 없음)
  return name + (col ? '#' + col : '') + (rm ? '+' + rm : '');
}
//  기본 14바닥 — 지금 단추 순서·글자 그대로(보스 ⓓ: 쓰던 바닥이 사라져 보이면 안 된다)
const _FLOOR_BASIC = [['grass', '🌿 잔디'], ['dirt', '🟫 흙'], ['dark_earth', '⬛ 어두운 흙'], ['stone', '🪨 돌'], ['stone_floor', '🪟 돌바닥'],
  ['sand', '🏜️ 모래'], ['gravel', '🔘 자갈'], ['brick', '🧱 벽돌'], ['wood', '🪵 나무'], ['water', '🔵 물'], ['flower', '🌸 꽃밭'],
  ['deck', '🪵 데크'], ['dry_earth', '🟡 마른 흙'], ['gravel_yard', '⬜ 자갈마당']];
//  가족 칩 — 순서 고정 · [이름, 칩 글자, 기본 색(그림 파일의 기본 · 저장값에는 안 붙는다)]
const _FLOOR_FAMS = [['tulipbed', '튤립', 'pink'], ['tulipcol', '세로 튤립', 'pink'], ['hydrangea', '수국', 'blue'], ['lavender', '라벤더', 'violet'],
  ['sunflowerbed', '해바라기', 'yellow'], ['daisyfield', '데이지', 'white'], ['wildflower', '들꽃', '']];
const _FLOOR_COLOR_KO = { pink: '분홍', red: '빨강', yellow: '노랑', white: '흰', violet: '보라', orange: '주황', blue: '파랑',
  candy: '사탕', sherbet: '복숭아', night: '검보라', duo: '두 빛', moon: '달빛', lemon: '레몬', rainbow: '무지개', snow: '눈꽃' };
const _FLOOR_RIM_ORDER = [['', '자연'], ['brick', '벽돌'], ['stone', '돌'], ['picket', '흰 말뚝']];

//  잠긴 색 — docs/deco_garden_family_20260920.md '열린 색 / 잠긴 색' 표. 열렸으면 '' · 잠겼으면 아이 말 두 줄.
//  ⚠️ 문턱은 원래 '가진 적 있음'(도감)인데 도감 기록이 아직 없다 → 지금은 **지금 가진 것**(인벤토리)으로 본다.
//     팔면 그 색이 다시 잠기지만, 이미 칠한 칸은 그대로 남는다(저장값은 안 건드린다). 도감 코드가 붙으면 `_floorHas` 만 바꾼다.
//  라벤더·해바라기·데이지는 표에 문턱이 없어 전부 열림.
function _floorHas(id) { return _decoQtyOf(id) > 0; }
//  [DECO-RETIRE-2] '가진 것'은 상점에서 뺀(hidden) 것도 센다 — 장식을 상점에서 빼도 그걸 가진 아이의 색이 다시 잠기지 않게.
//  '전부'는 **지금 상점에 있는 것 전부**(뺀 것은 더 살 수 없으니 목표에서 뺀다).
function _floorKindCount(kind) {
  const yard = GAME_DATA.decorations.filter(d => d.cat === 'yard' && _decoShopKind(d) === kind), shop = yard.filter(d => !d.hidden);
  return { have: yard.filter(d => _floorHas(d.id)).length, all: shop.length, allHave: shop.filter(d => _floorHas(d.id)).length };
}
function _floorLockWhy(name, color) {
  const fam = name === 'tulipcol' ? 'tulipbed' : name;
  const any = ids => ids.some(_floorHas);
  const need = (kind, n, what, icon) => { const k = _floorKindCount(kind), ok = n ? k.have >= n : k.allHave >= k.all;
    return ok ? '' : `${icon} ${what} 장식을 ${n ? n + '가지' : '전부'} 모으면 열려요!\n지금 ${n ? k.have + '가지' : k.allHave + '/' + k.all} · 🛒 상점에서 찾아볼 수 있어요`; };
  const one = (ids, what) => any(ids) ? '' : `${what} 장식을 가져 보면 열려요!\n🛒 상점에서 찾아볼 수 있어요`;
  if (fam === 'tulipbed') {
    if (color === 'red') return one(['d_y1', 'd_y21', 'd_y43'], '🌹 장미');
    if (color === 'white') return one(['d_y42'], '🌼 데이지');
    if (color === 'violet') return one(['d_y41'], '💜 라벤더');
    if (color === 'orange') return one(['d_y7'], '🌻 해바라기');
    if (color === 'candy') return need('plant', 8, '꽃·풀', '🌷');
    if (color === 'sherbet') return need('plant', 12, '꽃·풀', '🌷');
    if (color === 'night') return need('plant', 0, '꽃·풀', '🌷');
  }
  if (fam === 'hydrangea') {
    if (color === 'violet' || color === 'pink' || color === 'white') return need('water', 2, '물', '💧');
    if (color === 'duo') return need('water', 0, '물', '💧');
    if (color === 'moon') return any(['d_y6', 'd_y14']) ? '' : '🏮 가로등이나 석등을 가져 보면 열려요!\n밤에 피는 꽃이에요';
  }
  if (fam === 'wildflower') {
    if (color === 'rainbow') return need('animal', 6, '동물', '🐾');
    if (color === 'snow') return need('tree', 5, '나무', '🌳');
  }
  return '';
}

// ── 고르기 화면 공용 조각(마당·집 안) ── draw(ctx, w, h) 는 CSS 픽셀 좌표로 그린다(2배 판에 알아서 맞춘다)
function _pkCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 2); cv.height = Math.round(h * 2);
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.setAttribute('aria-hidden', 'true');
  cv._pkDraw = draw; cv._pkW = w; cv._pkH = h; _pkPaint(cv);
  return cv;
}
function _pkPaint(cv) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, cv._pkW, cv._pkH);
  try { cv._pkDraw(ctx, cv._pkW, cv._pkH); } catch (e) {}
}
function _pkButton(cls, label, on, onTap, extra) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls + (on ? ' is-on' : ''); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', e => { e.stopPropagation(); onTap(b); });
  if (extra) extra(b);
  return b;
}
//  칩 = 그림 + 짧은 이름 · 동그라미 = 그림만(잠기면 🔒) · 네모 = 그림만
function _pkChip(name, w, h, draw, on, onTap, cls) {
  return _pkButton('pk-chip' + (cls ? ' ' + cls : ''), name, on, onTap, b => { b.appendChild(_pkCanvas(w, h, draw)); const s = document.createElement('span'); s.textContent = name; b.appendChild(s); });
}
function _pkDot(label, size, draw, on, locked, onTap) {
  return _pkButton('pk-dot' + (locked ? ' is-locked' : ''), label + (locked ? ' (잠김)' : ''), on, onTap, b => {
    b.appendChild(_pkCanvas(size, size, draw));
    if (locked) { const l = document.createElement('span'); l.className = 'pk-lk'; l.textContent = '🔒'; b.appendChild(l); }
  });
}
function _pkTile(label, size, draw, on, onTap) {
  return _pkButton('pk-tile', label, on, onTap, b => b.appendChild(_pkCanvas(size, size, draw)));
}
//  견본 판 — 그림 + 이름 줄 + 캡션(줄마다) · locked 면 어둡게 + 가운데 🔒
function _pkSwatch(box, w, h, draw, name, caps, locked) {
  box.textContent = '';
  const f = document.createElement('div'); f.className = 'pk-sw';
  f.appendChild(_pkCanvas(w, h, (ctx, W, H) => { draw(ctx, W, H); if (locked) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H); } }));
  if (locked) { const l = document.createElement('span'); l.className = 'pk-sw-lk'; l.textContent = '🔒'; f.appendChild(l); }
  box.appendChild(f);
  const n = document.createElement('div'); n.className = 'pk-name'; n.textContent = name; box.appendChild(n);
  caps.forEach(t => { const c = document.createElement('div'); c.className = 'pk-cap'; c.textContent = t; box.appendChild(c); });
}
//  [DECO-FLOOR-RECT-1] 둘 중 하나 고르기(도구 토글) — items = [[값, 글자]…]
function _pkSeg(items, cur, onTap, label) {
  const g = document.createElement('div'); g.className = 'pk-seg'; g.setAttribute('role', 'group'); if (label) g.setAttribute('aria-label', label);
  items.forEach(([v, t]) => { const b = _pkButton('pk-seg-b', t, v === cur, () => onTap(v)); b.dataset.v = v; b.textContent = t; g.appendChild(b); });
  return g;
}
//  말풍선 — anchor 위에 한 줄(두 줄까지). host 는 position:relative 인 판
function _pkBubble(host, anchor, text) {
  let bb = host.querySelector('.pk-bubble');
  if (!bb) { bb = document.createElement('div'); bb.className = 'pk-bubble'; bb.setAttribute('role', 'status'); host.appendChild(bb); }
  if (!anchor || !text) { bb.hidden = true; return; }
  bb.textContent = text; bb.hidden = false;
  const hr = host.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
  const bw = bb.offsetWidth, x = Math.max(6, Math.min(hr.width - bw - 6, ar.left - hr.left + ar.width / 2 - bw / 2));
  bb.style.left = x + 'px'; bb.style.top = (ar.top - hr.top - bb.offsetHeight - 10) + 'px';
  bb.style.setProperty('--pk-tail', (ar.left - hr.left + ar.width / 2 - x) + 'px');
}

// ── 마당 바닥 그림: 작은 판을 마당과 같은 그리기로 ──
//  cellAt(r,c) → 저장값. 판 밖은 '경계 없음'(마당의 격자 밖과 같다) — 둘레를 보이려면 판 안에 잔디 테를 둔다.
function _floorBoard(ctx, cols, rows, C, ox, oy, cellAt) {
  const keep = _dCtx;
  _dCtx = ctx;
  try {
    ctx.save(); ctx.translate(ox, oy);
    const typeAt = (rr, cc, wantRim) => (rr < 0 || cc < 0 || rr >= rows || cc >= cols) ? null : _floorParse(cellAt(rr, cc))[wantRim ? 'rim' : 'name'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = _floorParse(cellAt(r, c));
      if (FLOOR_SVG && _drawFloorSVG(p.name, r, c, c * C, r * C, C, typeAt, p.color, p.rim)) continue;
      const t = FLOOR_TILES[p.name] || FLOOR_TILES.grass;     // 그림이 아직 안 왔으면 단색(오면 다시 그린다)
      ctx.fillStyle = t.bg; ctx.fillRect(c * C, r * C, C, C);
    }
    ctx.restore();
  } finally { _dCtx = keep; }
}
//  값 v 를 잔디 가운데 (bw×bh) 로 깐 판 — 테 두께 m 칸. 캔버스 W×H 에 가로로 맞추고 세로는 가운데 자른다.
const _floorBedDraw = (v, bw, bh, m) => (ctx, W, H) => {
  const cols = bw + 2, rows = bh + 2, C = W / (bw + 2 * m);
  _floorBoard(ctx, cols, rows, C, -(1 - m) * C, (H - (bh + 2 * m) * C) / 2 - (1 - m) * C,
    (r, c) => (r >= 1 && r <= bh && c >= 1 && c <= bw) ? v : 'grass');
};
const _floorCellDraw = v => (ctx, W) => _floorBoard(ctx, 1, 1, W, 0, 0, () => v);
//  테두리 단추 그림 = 꽃밭 모퉁이를 확대해 자른 것(그 마감이 둘러진 모습)
const _floorCornerDraw = v => (ctx, W) => { const C = W / 1.45; _floorBoard(ctx, 3, 3, C, -0.55 * C, -0.55 * C, (r, c) => (r >= 1 && c >= 1) ? v : 'grass'); };

// ── 상태 · 그리기 ──
const _fpk = { fam: 'basic', basic: 'grass', col: {}, rim: {}, peek: null, peekT: 0, soon: 0 };
function _floorPickRead(v) {   // 거꾸로 읽기 — 지금 붓(CUR_FLOOR_TILE)을 칩·색·테두리로
  const p = _floorParse(v || 'grass');
  if (_FLOOR_FAMS.some(f => f[0] === p.name)) { _fpk.fam = p.name; _fpk.col[p.name] = p.color; _fpk.rim[p.name] = p.rim; }
  else { _fpk.fam = 'basic'; _fpk.basic = _FLOOR_BASIC.some(b => b[0] === p.name) ? p.name : 'grass'; }
}
function _floorPickValue() { return _fpk.fam === 'basic' ? _fpk.basic : _floorJoin(_fpk.fam, _fpk.col[_fpk.fam] || '', _fpk.rim[_fpk.fam] || ''); }
function _floorPickName(v) {
  const p = _floorParse(v), b = _FLOOR_BASIC.find(x => x[0] === p.name);
  if (b) return b[1];
  const f = _FLOOR_FAMS.find(x => x[0] === p.name); if (!f) return p.name;
  const col = _FLOOR_COLOR_KO[p.color || f[2]] || '';
  const rim = p.rim ? ' · ' + (_FLOOR_RIM_ORDER.find(x => x[0] === p.rim) || ['', p.rim])[1] : '';
  return (col ? col + ' ' : '') + f[1] + rim;
}
function _floorPickTap(patch, anchor) {
  _floorPickPeekEnd(false);
  if (patch.fam !== undefined) {
    _fpk.fam = patch.fam;
    if (patch.fam !== 'basic' && _floorLockWhy(patch.fam, _fpk.col[patch.fam] || '')) _fpk.col[patch.fam] = '';   // 마지막 색이 그 새 잠겼으면 기본색
  }
  if (patch.basic !== undefined) _fpk.basic = patch.basic;
  if (patch.rim !== undefined) _fpk.rim[_fpk.fam] = patch.rim;
  if (patch.col !== undefined) {
    const why = _floorLockWhy(_fpk.fam, patch.col);
    if (why) {   // 잠긴 색 — 칠하지 않는다. 견본만 그 색으로 어둡게 + 말풍선. 고른 것은 누르기 전 그대로
      _fpk.peek = { col: patch.col, why };
      _floorPickRender();
      const host = document.getElementById('if-floor-picker');
      const dot = host && host.querySelector('.pk-dot[data-col="' + patch.col + '"]');
      if (host) _pkBubble(host, dot, why);
      _fpk.peekT = setTimeout(() => _floorPickPeekEnd(true), 2500);
      return;
    }
    _fpk.col[_fpk.fam] = patch.col;
  }
  CUR_FLOOR_TILE = _floorPickValue();
  _floorPickRender();
}
function _floorPickPeekEnd(redraw) {
  if (_fpk.peekT) { clearTimeout(_fpk.peekT); _fpk.peekT = 0; }
  if (!_fpk.peek) return;
  _fpk.peek = null;
  const host = document.getElementById('if-floor-picker'); if (host) _pkBubble(host, null, '');
  if (redraw) _floorPickRender();
}
function _floorPickRender() {
  if (DECO_SCENE !== 'yard') return _inLookRender();   // [INDOOR-LOOK-1] 집 안이면 같은 판에 벽지·바닥
  const host = document.getElementById('if-floor-picker');
  if (!host || host.hidden) return;
  const colLab = host.querySelector('.fpk-row[data-row="cols"] .fpk-lab'); if (colLab) colLab.textContent = '색';   // 집 안의 '톤'을 되돌린다
  const wide = innerWidth >= 1200, small = innerWidth < 900;
  const fam = _fpk.fam, isBed = !!_FLOOR_EDGE_COLOR[fam], famRow = _FLOOR_FAMS.find(f => f[0] === fam);
  const peekV = _fpk.peek ? _floorJoin(fam, _fpk.peek.col, _fpk.rim[fam] || '') : '';
  const v = peekV || _floorPickValue();
  //  견본 180×112(좁으면 150×96) — 잔디 7×5 가운데 5×3 을 고른 조합으로
  const sw = host.querySelector('.fpk-side'), swW = small ? 150 : 180, swH = small ? 96 : 112;
  const caps = [_fpk.peek ? '🔒 아직 잠긴 색이에요' : DECO_FLOOR_TOOL === 'rect' ? '모서리에서 모서리로 끌어요' : '이렇게 칠해져요'];
  if (isBed && !_fpk.peek) caps.push('테두리는 저절로 둘러져요');
  _pkSwatch(sw, swW, swH, _floorBedDraw(v, 5, 3, 1), _floorPickName(v), caps, !!_fpk.peek);
  //  [DECO-FLOOR-RECT-1] 도구 토글 — 폭 1200 이상은 가족 칩 줄 맨 앞(가는 세로줄로 가름), 미만은 견본 아래
  const seg = _pkSeg([['drag', '✏️ 끌어서'], ['rect', '⬛ 네모로']], DECO_FLOOR_TOOL, t => decoFloorTool(t), '칠하는 도구');
  const slot = host.querySelector('.fpk-tool');
  if (slot) { slot.textContent = ''; slot.hidden = !wide; if (wide) slot.appendChild(seg); }
  if (!wide || !slot) sw.appendChild(seg);
  const keepX = {};
  host.querySelectorAll('.fpk-scroll').forEach(el => { keepX[el.dataset.row] = el.scrollLeft; });
  const row = (name, items) => {
    const r = host.querySelector('.fpk-row[data-row="' + name + '"]'); if (!r) return;
    r.hidden = !items; if (!items) return;
    const sc = r.querySelector('.fpk-scroll'); sc.textContent = ''; items.forEach(el => sc.appendChild(el));
    if (keepX[name]) sc.scrollLeft = keepX[name];
  };
  //  1줄: 가족 칩(그림 = 3×2 꽃밭 + 자연 가장자리 · 기본 칩은 벽돌)
  const cw = wide ? 52 : 54, ch = wide ? 34 : 40;
  row('fams', [['basic', '기본', 'brick']].concat(_FLOOR_FAMS.map(f => [f[0], f[1], f[0]])).map(([id, name, pic]) =>
    _pkChip(name, cw, ch, _floorBedDraw(pic, 3, 2, 0.35), fam === id, () => _floorPickTap({ fam: id }))));
  if (fam === 'basic') {
    row('cols', null); row('rims', null);
    row('basics', _FLOOR_BASIC.map(([id, lab]) => _pkTile(lab, 40, _floorCellDraw(id), _fpk.basic === id, () => _floorPickTap({ basic: id }))));
  } else {
    row('basics', null);
    //  2줄: 색 — 기본 색 먼저 · 열린 색 · 잠긴 색은 뒤로
    const cur = _fpk.col[fam] || '', all = [''].concat(_FLOOR_COLORS[fam] || []);
    const open = all.filter(c => !_floorLockWhy(fam, c)), shut = all.filter(c => _floorLockWhy(fam, c));
    row('cols', open.concat(shut).map(c => {
      const shutC = shut.indexOf(c) >= 0, name = (_FLOOR_COLOR_KO[c || (famRow && famRow[2])] || '기본') + ' ' + (famRow ? famRow[1] : '');
      const b = _pkDot(name, 40, _floorCellDraw(_floorJoin(fam, c, '')), cur === c, shutC, () => _floorPickTap({ col: c }));
      b.dataset.col = c; return b;
    }));
    //  3줄: 테두리(꽃밭 무리만 — 들꽃은 없다)
    row('rims', isBed ? _FLOOR_RIM_ORDER.map(([id, lab]) => _pkChip(lab, 40, 40, _floorCornerDraw(_floorJoin(fam, cur, id)),
      (_fpk.rim[fam] || '') === id, () => _floorPickTap({ rim: id }), 'pk-rim')) : null);
  }
}
//  그림이 늦게 오면 판만 다시 칠한다(단추는 그대로 — 누르는 도중에 단추가 바뀌면 눌림이 사라진다). 몰려와도 한 번.
function _floorPickSoon(rebuild) {
  const host = document.getElementById('if-floor-picker');
  if (!host || host.hidden || _fpk.soon) return;
  _fpk.soon = setTimeout(() => { _fpk.soon = 0; if (rebuild) _floorPickRender(); else host.querySelectorAll('canvas').forEach(_pkPaint); }, 80);
}
function _floorPickShow(on) {
  const host = document.getElementById('if-floor-picker'); if (!host) return;
  if (!on) { _floorPickPeekEnd(false); host.hidden = true; return; }
  host.hidden = false;
  if (DECO_SCENE !== 'yard') { _inLookShow(); return; }   // [INDOOR-LOOK-1]
  _floorPickRead(CUR_FLOOR_TILE);
  _floorPickRender();
}
if (typeof window !== 'undefined') {
  addEventListener('resize', () => { if (DECO_MODE === 'floor') _floorPickSoon(true); });   // 폭 1200·900 에서 칩·견본 크기가 바뀐다
  //  말풍선은 다른 곳을 누르면 닫힌다(고른 것은 그대로). 판 안 단추는 제 click 에서 닫는다(여기서 다시 그리면 그 click 이 사라진다)
  addEventListener('pointerdown', e => { if (_fpk.peek && !(e.target.closest && e.target.closest('#if-floor-picker'))) _floorPickPeekEnd(true); }, true);
}

// ══ 집 안 벽지·바닥 고르기 (INDOOR-LOOK-1 · IN-2) ══════════════
//  규칙 원본: docs/indoor_look_rules_20260920.md §3 · 저장: docs/indoor_rooms_proposal_20260920.md (나)
//  · 저장은 새 필드 하나 — `indoor["<공간>"].look = "바닥,벽지"`, 각 값은 마당 바닥과 같은 `이름#색`(기본색이면 `#` 없음).
//    배열이 아니라 객체 맵이라 `_normalizeArrays` 를 안 탄다 · 옛 JS 는 모르는 필드를 `...s` 로 싣고 통째 저장에 그대로 내보낸다.
//  · **고르지 않은 집 안은 지금 그림 그대로**(`tile_indoor_wood` + `wall_floral` — 파일 이름까지 같다 = 한 픽셀도 안 바뀐다).
//    보통 마루·꽃무늬를 다시 고르면 저장값에서 그 칸을 비운다(둘 다 기본이면 필드째 지운다) — '고르기 전'과 같은 글자가 되게.
//  · 표에 없는 이름·색은 조용히 기본으로(마당 `_floorParse` 와 같은 태도).
//  · 방이 없는 지금은 판 어디를 눌러도 큰 방 하나가 바뀐다(방 만들기 IN-3 은 아직).
const INDOOR_WALLS = [['plain', '민무늬', []], ['stripe', '줄무늬', []], ['floral', '꽃무늬', []],
  ['star', '별무늬', ['sky', 'night', 'pink']], ['gingham', '체크', ['blue', 'green', 'yellow']],
  ['wood', '나무 판벽', ['light', 'dark', 'white']], ['tile', '타일 벽', ['mint', 'sky', 'pink']], ['brick', '벽돌 벽', ['white', 'gray']]];
const INDOOR_FLOORS = [['plank', '마루', ['light', 'dark']], ['tile', '타일', ['white', 'sky', 'terra']],
  ['check', '체크 타일', ['mint', 'pink', 'blue']], ['carpet', '카펫', ['blue', 'pink', 'green']]];
//  색 이름 — '' 는 그 그림 파일의 기본색(파일마다 다르다)
const _IN_COLOR_KO = { sky: '하늘', night: '밤', pink: '분홍', blue: '파랑', green: '초록', yellow: '노랑', light: '밝은', dark: '짙은',
  white: '흰', mint: '민트', gray: '회색', terra: '벽돌빛' };
const _IN_BASE_KO = { wall: { star: '크림', gingham: '다홍', wood: '나무', tile: '아이보리', brick: '붉은' },
  floor: { plank: '보통', tile: '베이지', check: '밤색', carpet: '베이지' } };
const _inTable = kind => kind === 'wall' ? INDOOR_WALLS : INDOOR_FLOORS;
//  한 쪽 값 'star#sky' → { name, color } · 못 읽으면 null(= 기본)
function _inPartParse(kind, v) {
  const m = /^([a-z]+)(?:#([a-z]+))?$/.exec(String(v || ''));
  if (!m) return null;
  const row = _inTable(kind).find(x => x[0] === m[1]);
  if (!row) return null;
  return { name: row[0], color: (m[2] && row[2].indexOf(m[2]) >= 0) ? m[2] : '' };
}
//  기본(보통 마루·꽃무늬)이면 '' — 저장값에서 그 칸을 비운다
function _inPartJoin(kind, p) {
  if (!p || (kind === 'floor' ? p.name === 'plank' : p.name === 'floral') && !p.color) return '';
  return p.name + (p.color ? '#' + p.color : '');
}
function _inLookParse(v) {
  const a = String(v || '').split(',');
  return { floor: _inPartParse('floor', a[0]), wall: _inPartParse('wall', a[1]) };
}
function _inLookJoin(floor, wall) {
  const f = _inPartJoin('floor', floor), w = _inPartJoin('wall', wall);
  return (f || w) ? f + ',' + w : '';
}
//  그 공간의 look 글자(없으면 '') — 읽기만, 필드를 만들지 않는다
function _inLookGet(student, sp) {
  const m = student && student.indoor, e = m && m[sp || DECO_SPACE];
  return (e && typeof e.look === 'string') ? e.look : '';
}
//  쓰기 — '' 면 지우고, 빈 것이 남으면 필드째 지운다(Firebase 는 빈 객체를 어차피 지운다)
function _inLookSet(student, v, sp) {
  sp = sp || DECO_SPACE;
  if (v) {
    student.indoor = (student.indoor && typeof student.indoor === 'object') ? student.indoor : {};
    const e = (student.indoor[sp] && typeof student.indoor[sp] === 'object') ? student.indoor[sp] : (student.indoor[sp] = {});
    e.look = v;
    return;
  }
  const m = student.indoor, e = m && m[sp];
  if (!e || typeof e !== 'object') return;
  delete e.look;
  if (!Object.keys(e).length) delete m[sp];
  if (!Object.keys(m).some(k => m[k] != null)) delete student.indoor;
}
//  그릴 그림 파일 — 고르지 않았으면 지금 그림(옛 파일 이름 그대로)
function _inLookArt(kind, p) {
  if (kind === 'floor') return (p && !(p.name === 'plank' && !p.color)) ? ['tile_in_' + p.name, p.color] : ['tile_indoor_wood', ''];
  return (p && !(p.name === 'floral' && !p.color)) ? ['wall_' + p.name, p.color] : ['wall_floral', ''];
}
function _inPartName(kind, p) {
  const row = _inTable(kind).find(x => x[0] === (p ? p.name : (kind === 'floor' ? 'plank' : 'floral')));
  if (!row) return '';
  if (!row[2].length) return row[1];
  const c = p && p.color ? _IN_COLOR_KO[p.color] : (_IN_BASE_KO[kind][row[0]] || '');
  return (c ? c + ' ' : '') + row[1];
}

// ══ 집 안 방 만들기 (INDOOR-ROOMS-1 · IN-3) ══════════════════
//  제안서 (나) 네모로 끌어 방 만들기 · 겉모습 규칙 docs/indoor_look_rules_20260920.md §1·§2.
//  · 저장: indoor["<공간>"].rooms = { "a": "r,c,w,h,바닥,벽지" } — 객체 맵 + 짧은 문자열(방 하나 ≈ 28B). 문은 저절로 나서 저장 0.
//  · 좌표·판(50×28)은 그대로 — 있는 가구는 한 칸도 안 움직인다. 방이 하나도 없으면 **지금 큰 방 그대로**(한 픽셀도 안 바뀐다).
//  · 방이 생기면 방 밖은 '빈 터'(INDOOR_OUTSIDE — 확정 'blueprint' 어두운 도면). 가구는 방 안·빈 터 어디나 놓인다(막다른 길 0).
//  · 방의 벽 띠 = 방 윗줄 바로 위 한 줄(그 줄의 벽걸이는 거기 걸린다). 방끼리는 벽 띠 줄까지 안 겹친다.
//  · 못 읽는 값·판 밖·겹치는 방은 조용히 버린다(읽는 쪽에서) — 저장본이 무엇이든 그리기가 깨지지 않게.
const INDOOR_OUTSIDE = 'blueprint';   // 'blueprint' | 'oldfloor' | 'concrete' — 지금은 'blueprint' 만 그린다(나머지는 스위치 자리)
const ROOM_MIN = [4, 3], ROOM_MAX = [20, 12], ROOM_MAX_N = 8, ROOM_IDS = 'abcdefghijklmnop';
const ROOM_SIZES = [['작은 방', 6, 4], ['보통 방', 9, 5], ['큰 방', 13, 7]];
function _inRoomOverlap(a, b) {   // 벽 띠 줄(r-1)까지 방의 몫
  return a.r - 1 <= b.r + b.h - 1 && b.r - 1 <= a.r + a.h - 1 && a.c <= b.c + b.w - 1 && b.c <= a.c + a.w - 1;
}
//  그 공간의 방들 [{id,r,c,w,h,floor,wall}] — 한 번 읽은 글자는 기억(칸마다·그릴 때마다 불린다)
function _inRooms(student, sp) {
  const m = student && student.indoor, e = m && m[sp || DECO_SPACE], raw = e && e.rooms;
  if (!raw || typeof raw !== 'object') return [];
  const key = JSON.stringify(raw), M = _inRooms._m || (_inRooms._m = new Map());
  if (M.has(key)) return M.get(key);
  const out = [];
  Object.keys(raw).sort().forEach(id => {
    const a = String(raw[id] || '').split(','), n = a.slice(0, 4).map(x => parseInt(x, 10));
    if (n.some(x => !isFinite(x))) return;
    const rm = { id, r: n[0], c: n[1], w: n[2], h: n[3], floor: _inPartParse('floor', a[4]), wall: _inPartParse('wall', a[5]) };
    if (rm.r < 0 || rm.c < 0 || rm.r + rm.h > DI_FULL.rows || rm.c + rm.w > DI_FULL.cols) return;
    if (rm.w < ROOM_MIN[0] || rm.h < ROOM_MIN[1] || rm.w > ROOM_MAX[0] || rm.h > ROOM_MAX[1]) return;
    if (out.length >= ROOM_MAX_N || out.some(o => _inRoomOverlap(o, rm))) return;
    out.push(Object.freeze(rm));
  });
  if (M.size > 50) M.clear();
  M.set(key, out);
  return out;
}
function _inRoomStr(rm) { return [rm.r, rm.c, rm.w, rm.h, _inPartJoin('floor', rm.floor), _inPartJoin('wall', rm.wall)].join(','); }
//  쓰기 — 빈 방 목록이면 rooms 를 지우고, 빈 것이 남으면 필드째 지운다
function _inRoomsSet(student, list, sp) {
  sp = sp || DECO_SPACE;
  if (list && list.length) {
    student.indoor = (student.indoor && typeof student.indoor === 'object') ? student.indoor : {};
    const e = (student.indoor[sp] && typeof student.indoor[sp] === 'object') ? student.indoor[sp] : (student.indoor[sp] = {});
    e.rooms = {}; list.forEach(rm => { e.rooms[rm.id] = _inRoomStr(rm); });
    return;
  }
  const m = student.indoor, e = m && m[sp];
  if (!e || typeof e !== 'object') return;
  delete e.rooms;
  if (!Object.keys(e).length) delete m[sp];
  if (!Object.keys(m).some(k => m[k] != null)) delete student.indoor;
}
//  (r,c) 가 어느 방 안(band=false)·어느 방 벽 띠(band=true)인가
function _inRoomAt(r, c, student) {
  for (const rm of _inRooms(student || CUR)) {
    if (c < rm.c || c >= rm.c + rm.w) continue;
    if (r >= rm.r && r < rm.r + rm.h) return { rm, band: false };
    if (r === rm.r - 1) return { rm, band: true };
  }
  return null;
}
//  벽걸이가 걸리는 줄인가 — 판 맨 윗줄(큰 방의 벽) 또는 어느 방의 윗줄
function _inIsWallRow(r, c) {
  const rooms = _inRooms(CUR);
  if (r === 0 && !rooms.length) return true;   // 방이 없으면 판 맨 윗줄이 큰 방의 벽
  const h = _inRoomAt(r, c);
  if (!(h && !h.band && h.rm.r === r)) return r === 0 && !h;
  //  [DECO-INDOOR-RULE-1] 위아래 문이 난 두 칸은 벽 띠가 아니라 통로다 — 그 칸엔 벽걸이가 안 걸린다
  return !_inRoomDoors(rooms).some(d => d.row === r - 1 && c >= d.c0 && c < d.c1);
}
//  [DECO-RULE-R3] (r,c,w,h) 가 방 벽을 가로지르나 — 칸마다 '어느 방 안인가'(벽 띠·빈 터는 '밖')가 하나여야 한다.
//  반은 방 안·반은 빈 터(또는 옆 방)면 벽이 가구를 가른다.
function _inCrossesWall(r, c, w, h, rooms) {
  if (!rooms.length) return false;
  let zone = null;
  for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
    const rr = r + dr, cc = c + dc;
    const rm = rooms.find(o => rr >= o.r && rr < o.r + o.h && cc >= o.c && cc < o.c + o.w);
    const z = rm ? rm.id : '-';
    if (zone === null) zone = z; else if (z !== zone) return true;
  }
  return false;
}
//  새 방을 놓아도 되나 — 안 되면 아이 말
function _inRoomWhy(rooms, nr, skipId) {
  if (nr.w < ROOM_MIN[0] || nr.h < ROOM_MIN[1]) return `방은 가로 ${ROOM_MIN[0]}칸 · 세로 ${ROOM_MIN[1]}칸보다 커야 해요`;
  if (nr.w > ROOM_MAX[0] || nr.h > ROOM_MAX[1]) return `방은 가로 ${ROOM_MAX[0]}칸 · 세로 ${ROOM_MAX[1]}칸까지예요`;
  const others = rooms.filter(o => o.id !== skipId);
  if (others.length >= ROOM_MAX_N) return `방은 ${ROOM_MAX_N}개까지 만들 수 있어요`;
  if (others.some(o => _inRoomOverlap(o, nr))) return '다른 방과 겹쳐요 — 방 사이에 벽 한 줄이 필요해요';
  //  [DECO-RULE-R3] 벽이 이미 놓인 가구를 가르면 — 가구를 옮기지 않는다(아이 것은 그 자리) · 네모를 옮기게 말한다
  const next = others.concat([Object.assign({ id: '~' }, nr)]);
  const cut = _decoList(CUR).find(p => p.area === 'indoor' && !_isWallDeco(p.id)
    && _inCrossesWall(p.row, p.col, getDecoSize(p.id).w, getDecoSize(p.id).h, next));
  if (cut) { const d = GAME_DATA.decorations.find(x => x.id === cut.id); return `벽이 ${d ? d.icon + ' ' + d.name : '가구'}${_josa(d ? d.name : '가구', '을', '를')} 가르게 돼요 — 네모를 조금 옮겨 보세요`; }
  return '';
}
//  네모(r0,c0)~(r1,c1) → 판 안으로 자른 방(맨 윗줄은 벽 띠가 들어갈 자리가 필요 없다 — 판 위 여백이 벽이다)
function _inRoomFrom(r0, c0, r1, c1) {
  const r = Math.max(0, Math.min(r0, r1)), c = Math.max(0, Math.min(c0, c1));
  return { r, c, w: Math.min(DI_FULL.cols, Math.max(c0, c1) + 1) - c, h: Math.min(DI_FULL.rows, Math.max(r0, r1) + 1) - r };
}
//  저절로 난 문 — 옆으로 맞닿은 두 방의 벽 가운데 2줄 [{x 칸 경계, r0, r1}]
//  [DECO-INDOOR-WALL-1] 위아래로 맞닿은 방(아랫방 벽 띠 줄이 윗방 바로 아래)도 같은 규칙 — 맞닿은 벽이 2칸 이상이면 가운데 2칸 {row, c0, c1}
//  (row = 윗방 아래 벽선 = 아랫방 벽 띠 줄 · 옆문은 지금 모양 그대로 {col, r0, r1})
function _inRoomDoors(rooms) {
  const out = [], door = (o, a, b) => Object.defineProperties(o, { a: { value: a }, b: { value: b } });   // [DECO-INDOOR-WALL-2] 이은 두 방(열거 안 됨 — 문 모양은 그대로)
  rooms.forEach(a => rooms.forEach(b => {
    if (a === b) return;
    if (a.c + a.w === b.c) {
      const top = Math.max(a.r, b.r), bot = Math.min(a.r + a.h, b.r + b.h);
      if (bot - top >= 2) { const mid = Math.floor((top + bot) / 2); out.push(door({ col: b.c, r0: mid - 1, r1: mid + 1 }, a, b)); }
    }
    if (b.r - 1 === a.r + a.h) {
      const l = Math.max(a.c, b.c), r = Math.min(a.c + a.w, b.c + b.w);
      if (r - l >= 2) { const mid = Math.floor((l + r) / 2); out.push(door({ row: a.r + a.h, c0: mid - 1, c1: mid + 1 }, a, b)); }
    }
  }));
  return out;
}
//  [DECO-INDOOR-WALL-1] 나가기 문 자리 — 규칙으로 정한다(저장 0): 가장 아래 방(같으면 왼쪽) 아래 벽 가운데 2칸 · 방이 없으면 판 아래 가운데
//  발판 = 그 두 칸의 방 맨 아랫줄 · 칸 경계에 맞춘다(그림 가운데가 칸 반에 걸려 벽 틈과 어긋나지 않게)
function _inExitSpot(rooms) {
  const low = rooms.slice().sort((a, b) => (b.r + b.h) - (a.r + a.h) || a.c - b.c)[0];
  const cc = low ? low.c + Math.floor(low.w / 2) : Math.floor(DI.cols / 2), wallRow = low ? low.r + low.h : DI.rows;
  return { room: low || null, c0: cc - 1, c1: cc + 1, wallRow, matRow: wallRow - 1 };
}
//  [DECO-INDOOR-WALL-2] 나가기 문은 **문으로 이어진 방 묶음마다 하나** — 떨어져 따로 둔 방에도 들어갈 길(창조자 29-ⓑ63 · 48회 '방 다섯 중 셋')
//  묶음마다 _inExitSpot 규칙(맨 아래 방 · 아래 벽 가운데 2칸) · 첫째는 전과 같은 자리(가장 아래 방) — 방이 다 붙은 집은 그대로. 저장 0.
function _inExitSpots(rooms) {
  if (rooms.length < 2) return [_inExitSpot(rooms)];
  return _inRoomGroups(rooms).map(_inExitSpot).sort((e, f) => (f.room.r + f.room.h) - (e.room.r + e.room.h) || e.room.c - f.room.c);
}
//  문으로 이어진 방 묶음들 [[방…]…] — 같은 목록의 방 객체끼리 문(_inRoomDoors 의 a·b)으로 잇는다
function _inRoomGroups(rooms) {
  const up = new Map(rooms.map(r => [r, r])), top = r => { while (up.get(r) !== r) r = up.get(r); return r; };
  _inRoomDoors(rooms).forEach(d => { const x = top(d.a), y = top(d.b); if (x !== y) up.set(x, y); });
  const groups = new Map();
  rooms.forEach(r => { const k = top(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  return [...groups.values()];
}

// ══ 집은 한 채 (DECO-ROOM-HOUSE-1) ══════════════════════════
//  사용자 지적(10-03 운영 화면): 방을 떨어뜨려 지으면 잔디밭 위에 오두막 여러 채가 되고, 방마다 '나가기'가 생기고,
//  방 밖에 남은 TV·책장이 잔디 위에(벽에 박혀) 서 있었다. → 두 번째 방부터는 **있는 방에 문으로 붙여** 짓는다.
//  · 붙는다 = 문이 나는 맞닿음(옆으로 2줄 · 위아래로 2칸 이상 — _inRoomDoors 규칙 그대로). 떨어진 자리를 누르거나 끌면
//    가장 가까운 붙는 자리로 옮겨 짓는다(크기 칩은 겹쳐도 옮긴다 — 누른 칸이 방의 왼쪽 위라 겨누기 어렵다).
//  · 집을 둘로 가르는 일(가운데 방 없애기 · 크기를 줄여 떨어뜨리기)은 막는다. 옛 저장본의 떨어진 방은 그대로 그린다(묶음마다 문).
//  · 저장 모양은 그대로(r,c,w,h) — 규칙은 짓는 손짓에만 있다.
function _inRoomGroupCount(rooms) { return rooms.length < 2 ? rooms.length : _inRoomGroups(rooms).length; }
function _inRoomAttached(rooms, nr) {
  if (!rooms.length) return true;
  const t = Object.assign({ id: '~' }, nr);
  return _inRoomDoors(rooms.concat([t])).some(d => d.a === t || d.b === t);
}
//  같은 크기로 있는 방의 네 변을 따라 미끄러뜨린 자리 중 nr 에 가장 가까운 '붙는 자리'(없으면 null)
//  옆 = 옆벽을 나눔 · 아래 = 아랫방 벽 띠가 윗방 바로 아래 줄 · 위 = 그 반대(_inRoomDoors 와 같은 꼴)
function _inRoomSnap(rooms, nr) {
  if (!rooms.length) return null;
  const { w, h } = nr, cx = nr.c + w / 2, cy = nr.r + h / 2, cand = [];
  rooms.forEach(o => {
    for (let r = o.r - h + 2; r <= o.r + o.h - 2; r++) cand.push({ r, c: o.c + o.w, w, h }, { r, c: o.c - w, w, h });
    for (let c = o.c - w + 2; c <= o.c + o.w - 2; c++) cand.push({ r: o.r + o.h + 1, c, w, h }, { r: o.r - 1 - h, c, w, h });
  });
  return cand.filter(k => k.r >= 0 && k.c >= 0 && k.r + k.h <= DI_FULL.rows && k.c + k.w <= DI_FULL.cols)
    .map(k => ({ k, d: (k.c + w / 2 - cx) ** 2 + (k.r + h / 2 - cy) ** 2 })).sort((a, b) => a.d - b.d)
    .map(x => x.k).find(k => !_inRoomWhy(rooms, k) && _inRoomAttached(rooms, k)) || null;
}
//  새 방 자리 정하기 → { rect, why, moved }. loose = 크기 칩(겹쳐도 옮긴다) · 끌기는 겹치면 그 까닭(빨간 네모)
function _inRoomPlan(rooms, nr, loose) {
  const why = _inRoomWhy(rooms, nr);
  if (!rooms.length) return { rect: nr, why, moved: false };
  const fixed = rooms.length >= ROOM_MAX_N || nr.w < ROOM_MIN[0] || nr.h < ROOM_MIN[1] || nr.w > ROOM_MAX[0] || nr.h > ROOM_MAX[1];   // 옮겨도 안 되는 까닭
  if (fixed) return { rect: nr, why, moved: false };
  if (!why && _inRoomAttached(rooms, nr)) return { rect: nr, why: '', moved: false };
  if (!loose && rooms.some(o => _inRoomOverlap(o, nr))) return { rect: nr, why, moved: false };
  const s = _inRoomSnap(rooms, nr);
  return s ? { rect: s, why: '', moved: true } : { rect: nr, why: '집에 붙일 자리가 없어요 — 방은 있는 방에 붙여 지어요', moved: false };
}
//  크기 칩 방 — 누른 칸이 왼쪽 위 · 판 끝이면 판 안으로 민다(전엔 판 밖으로 나간 만큼 방이 잘려 작아졌다)
function _inChipRect(r, c, sz) {
  const w = sz[1], h = sz[2];
  return { r: Math.max(0, Math.min(r, DI_FULL.rows - h)), c: Math.max(0, Math.min(c, DI_FULL.cols - w)), w, h };
}
//  크기를 바꾼 방이 집에서 떨어지면 그 까닭 — 크기 · 겹침 · 가구 가름 규칙(_inRoomWhy) 다음
function _inRoomResizeWhy(rooms, id, nr) {
  const why = _inRoomWhy(rooms, nr, id);
  if (why) return why;
  const next = rooms.map(o => o.id === id ? Object.assign({ id }, nr) : o);
  return _inRoomGroupCount(next) > _inRoomGroupCount(rooms) ? '방이 집에서 떨어져요 — 다른 방과 두 칸 넘게 맞닿게 해 주세요' : '';
}
//  방 목록을 바꾸고 ↩ 한 단계로 적는다
function _inRoomsCommit(list, msg) {
  const prev = JSON.stringify(_inRooms(CUR)), next = JSON.stringify(list);
  if (prev === next) return false;
  _inRoomsSet(CUR, list);
  //  [DECO-RULE-R4] 방이 없어져 **벽이 사라진 벽걸이**는 가방으로 — 액자가 빈 바닥 한가운데 서 있지 않게.
  //  (벽걸이 규칙 `_decoRuleWhy` 로는 이미 '안 되는 자리'다.) 같은 ↩ 한 단계에 담아, 되돌리면 방과 액자가 같이 돌아온다.
  //  [DECO-ROOM-SHRINK-1] 방 크기를 줄이면 그 방 안에 있던 가구 중 새 방 밖(마당 잔디)에 남게 된 것도 같이 가방으로(보스 · #1075 뒤).
  //  [DECO-ROOM-HOUSE-1] 같은 규칙을 **방 자리가 바뀌는 모든 때**로 — 첫 방을 지을 때 · 방을 없앨 때 · 크기를 바꿀 때, 방이 하나라도 남으면
  //  방 밖(잔디)에 서게 된 가구와 나가기 문 발판을 막게 된 가구는 가방으로(놓기 규칙 _decoRuleWhy 로는 이미 '안 되는 자리'다).
  //  벽지·바닥만 바꾼 것은 자리 정리를 안 한다. 방이 다 없어지면 집 전체가 한 방이라 가구는 그 자리에 그대로.
  const inside = (p, o) => { const z = getDecoSize(p.id); return p.row >= o.r && p.col >= o.c && p.row + z.h <= o.r + o.h && p.col + z.w <= o.c + o.w; };
  const geo = rs => rs.map(o => [o.id, o.r, o.c, o.w, o.h].join(',')).sort().join(' ');
  const tidy = list.length > 0 && geo(JSON.parse(prev)) !== geo(list), exits = tidy ? _inExitSpots(_inRooms(CUR)) : [];
  const onMat = p => { const z = getDecoSize(p.id); return exits.some(ex => p.row <= ex.matRow && p.row + z.h > ex.matRow && p.col < ex.c1 && p.col + z.w > ex.c0); };
  const bag = _decoList(CUR).filter(p => p.area === 'indoor' && (_isWallDeco(p.id) ? !_inIsWallRow(p.row, p.col)
    : tidy && (!list.some(o => inside(p, o)) || onMat(p))));
  if (bag.length) CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => bag.indexOf(p) < 0);
  _decoUndoPush({ t: 'rooms', sp: DECO_SPACE, prev, next, bag: bag.map(p => Object.assign({}, p)) });
  decoDirty(); _drawDeco(); renderDecoInv(); _inLookRender();
  if (bag.length) {
    const p0 = bag[0], d = GAME_DATA.decorations.find(x => x.id === p0.id), nm = d ? d.icon + ' ' + d.name : '벽걸이';
    const where = _isWallDeco(p0.id) ? '벽에 걸려 있던' : list.some(o => inside(p0, o)) ? '문 앞을 막던' : '방 밖에 남은';
    msg = (msg || '').replace(/ \(↩ 되돌리기\)$/, '') + ` · 🎒 ${where} ${nm}${bag.length > 1 ? ' 등 ' + bag.length + '개' : ''}${_josa(d ? d.name : '벽걸이', '은', '는')} 가방으로 (↩ 되돌리기)`;
  }
  if (msg) toast(msg);
  return true;
}
function _inRoomAdd(nr, loose) {
  const rooms = _inRooms(CUR), plan = _inRoomPlan(rooms, nr, loose);   // [DECO-ROOM-HOUSE-1] 두 번째 방부터는 집에 붙여
  if (plan.why) { toast('🧱 ' + plan.why); return false; }
  nr = { r: plan.rect.r, c: plan.rect.c, w: plan.rect.w, h: plan.rect.h };
  const id = ROOM_IDS.split('').find(x => !rooms.some(o => o.id === x));
  const first = !rooms.length;
  _inRoomsCommit(rooms.concat([Object.assign({ id, floor: null, wall: null }, nr)]),
    `🧱 ${nr.w} × ${nr.h} 방이 생겼어요${first ? ' — 방 밖은 마당 · 다음 방은 이 방에 붙여요' : plan.moved ? ' — 집에 붙여 지었어요 · 문은 저절로' : ' — 문이 저절로 났어요'} (↩ 되돌리기)`);
  //  [DECO-INDOOR-WALL-1] 방을 만들면 방들 둘레에 맞춰 본다(창조자 29회 — 만든 방이 화면 구석에 작게 남았다 · 768 에서 칸 15px)
  if (_ifMode) setTimeout(() => { if (DECO_SCENE !== 'yard') _inFitRooms(); }, 0);
  return true;
}
//  가구 둘레로 첫 방 — 이미 가구가 있는 아이가 '내 가구가 밖에 버려진' 느낌 없이 시작하게
function _inRoomAroundFurniture() {
  const list = _decoList(CUR).filter(p => p.area === 'indoor');
  if (!list.length) { toast('🪑 집 안에 가구가 아직 없어요 — 크기를 고르거나 네모로 끌어 보세요'); return; }
  let r0 = 99, c0 = 99, r1 = -1, c1 = -1;
  list.forEach(p => { const z = getDecoSize(p.id); r0 = Math.min(r0, p.row); c0 = Math.min(c0, p.col); r1 = Math.max(r1, p.row + z.h - 1); c1 = Math.max(c1, p.col + z.w - 1); });
  const nr = _inRoomFrom(r0 - 1, c0 - 1, Math.max(r1 + 1, r0 - 1 + ROOM_MIN[1] - 1), Math.max(c1 + 1, c0 - 1 + ROOM_MIN[0] - 1));
  if (nr.w > ROOM_MAX[0] || nr.h > ROOM_MAX[1]) { toast(`🪑 가구가 너무 넓게 퍼져 있어요 — 방은 ${ROOM_MAX[0]} × ${ROOM_MAX[1]}칸까지라, 네모로 끌어 나눠 만들어 보세요`); return; }
  _inRoomAdd(nr);
}
//  네모 끄는 동안 미리 보기(그리기는 _drawIndoor 가 · 아래 글은 마당 네모로와 같은 자리)
let _inRoomPrev = null;
function _inRoomPrevSet(p) {
  _inRoomPrev = p;
  const host = document.getElementById('if-topview'); if (!host) return;
  let el = document.getElementById('if-rect-tip');
  if (!p) { if (el) el.hidden = true; _drawDeco(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'if-rect-tip'; el.className = 'deco-rect-tip'; el.setAttribute('role', 'status'); host.appendChild(el); }
  el.hidden = false;
  el.classList.toggle('is-capped', !!p.why);
  el.textContent = p.why ? `${p.w} × ${p.h}칸 · ${p.why}` : p.resize ? `${p.w} × ${p.h}칸 — 손을 떼면 이 크기로 · 잘못하면 ↩`
    : p.ghost ? `${p.w} × ${p.h}칸 — 누르면 여기에 방${p.moved ? ' · 집에 붙여 지어요' : ''}`   // [DECO-ROOM-HOUSE-1] 크기 칩 — 마우스가 올라간 자리
    : `${p.w} × ${p.h}칸 — ${p.moved ? '집에 붙여 지어요 · ' : ''}손을 떼면 방이 돼요 · 잘못하면 ↩`;   // [DECO-ROOM-RESIZE-1]
  _drawDeco();
}
//  방 둘레에 맞춰 보기(열 때·'전체') — 방이 없으면 false
function _inFitRooms() {
  const rooms = _inRooms(CUR);
  if (DECO_SCENE === 'yard' || !rooms.length || !_dCv) return false;
  let r0 = 99, c0 = 99, r1 = -1, c1 = -1;
  rooms.forEach(rm => { r0 = Math.min(r0, rm.r - 1); c0 = Math.min(c0, rm.c); r1 = Math.max(r1, rm.r + rm.h); c1 = Math.max(c1, rm.c + rm.w); });
  //  [DECO-INDOOR-FIT-2] 둘레 여백 — 가로 3칸 · 세로 1칸(좌우 같게 — 판 끝에 붙은 방도 가운데 · 방이 있으면 판 밖도 도면이라 밀 수 있다).
  //   방에 딱 맞추면 다음 방을 붙일 자리가 화면 밖이었다(창조자 54-ⓒ89) · 넓은 화면은 세로가 먼저 차서 가로 여백은 칸 크기를 거의 줄이지 않는다.
  //   만든 직후 · 들어올 때 · [전체] 모두 같은 틀.
  r0 -= 1; r1 += 1; c0 -= 3; c1 += 3;
  const bw = c1 - c0 + 1, bh = r1 - r0 + 1, C0 = Math.floor(_dW / DI.cols);
  const z = Math.max(DECO_ZOOM_MIN, Math.min(DECO_ZOOM_MAX, Math.min(_dW / (bw * C0), _dH / (bh * C0)) * 0.95));
  _dZoom = z; _initDeco();
  const C = _dC, offX = Math.max(0, Math.floor((_dW - DI.cols * C) / 2)), offY = Math.max(Math.floor(C * .9), Math.floor((_dH - DI.rows * C) / 2));
  _dPanX = offX + c0 * C - Math.max(0, (_dW - bw * C) / 2);
  _dPanY = offY + r0 * C - Math.max(0, (_dH - bh * C) / 2);
  _decoClampPan(); _drawDeco();
  return true;
}
//  집 안에 들어올 때 — 방이 있으면 방 둘레로, 없으면 지금처럼(폰은 크게)
function _decoIndoorStart() { if (!_inFitRooms()) _decoPhoneStart(); }

//  방 누르기(🖌️ 벽지·바닥 판이 열려 있을 때)
function _inTap(r, c) {
  const kind = _inPk.tab, hit = _inRoomAt(r, c), rooms = _inRooms(CUR);
  if (kind === 'room') {
    if (_inPk.tool === 'erase') {
      if (!hit) { toast('🗑️ 없앨 방을 눌러 주세요'); return; }
      const rest = rooms.filter(o => o.id !== hit.rm.id);
      //  [DECO-ROOM-HOUSE-1] 가운데 방을 없애 집이 둘로 갈라지면 막는다(끝 방부터) · 마지막 방이면 집 전체가 다시 한 방(가구 그대로)
      if (rest.length && _inRoomGroupCount(rest) > _inRoomGroupCount(rooms)) { toast('🧱 이 방을 없애면 집이 둘로 나뉘어요 — 끝에 붙은 방부터 없애 보세요'); return; }
      _inRoomsCommit(rest, rest.length ? '🗑️ 방을 없앴어요 (↩ 되돌리기)' : '🗑️ 방을 없앴어요 — 다시 집 전체가 한 방이에요 · 가구는 그 자리에 (↩ 되돌리기)');
      return;
    }
    const sz = ROOM_SIZES[_inPk.tool === 's1' ? 1 : _inPk.tool === 's2' ? 2 : _inPk.tool === 's0' ? 0 : -1];
    if (!sz) { toast('⬛ 빈 곳을 네모로 끌거나, 방 크기를 고르고 눌러 주세요'); return; }
    _inRoomPrevSet(null);   // [DECO-ROOM-HOUSE-1] 마우스 미리 보기를 걷고
    _inRoomAdd(_inChipRect(r, c, sz), true);
    return;
  }
  if (!rooms.length) { _inLookApply(); return; }   // 방이 없으면 큰 방(IN-2)
  if (!hit) { toast('방을 눌러 주세요 — 방 밖은 빈 터예요'); return; }
  const part = _inPk[kind], cur = hit.rm[kind];
  if (_inPartJoin(kind, part) === _inPartJoin(kind, cur)) { toast(kind === 'wall' ? '🧱 이미 이 벽지예요' : '🟫 이미 이 바닥이에요'); return; }
  _inRoomsCommit(rooms.map(o => o.id === hit.rm.id ? Object.assign({}, o, { [kind]: part }) : o),
    (kind === 'wall' ? '🧱 벽지가' : '🟫 바닥이') + ' 바뀌었어요 — ' + _inPartName(kind, part) + ' · 이 방만 (↩ 되돌리기)');
}

// ── 고르기 판 — 마당 바닥 고르기와 같은 판(#if-floor-picker)·같은 조각(_pk*) ──
//  붓 = 탭마다 고른 것(미리 보기). 판(방)을 누르면 지금 탭 쪽만 그 방에 바뀐다.
const _inPk = { tab: 'wall', wall: null, floor: null, tool: '' };   // tool = [INDOOR-ROOMS-1] 's0'·'s1'·'s2'(크기 칩) · 'erase'(방 없애기) · ''(네모 끌기)
//  작은 방 그림: 위 한 줄 벽 띠(벽지 + 걸레받이) · 아래 floorRows 줄 바닥 · 벽에 액자(있으면)
function _inRoomDraw(wall, floor, floorRows, frame) {
  return (ctx, W, H) => {
    const rows = 1 + floorRows, C = H / rows, cols = Math.ceil(W / C);
    const [fa, fc] = _inLookArt('floor', floor), [wa, wc] = _inLookArt('wall', wall);
    const fi = _floorImg(fa, fc), wi = _floorImg(wa, wc), bb = _floorImg('wall_baseboard');
    ctx.fillStyle = '#C4955A'; ctx.fillRect(0, C, W, H - C);
    ctx.fillStyle = '#8B6520'; ctx.fillRect(0, 0, W, C);
    for (let c = 0; c < cols; c++) {
      if (wi) ctx.drawImage(wi, c * C, 0, C, C);
      if (bb) ctx.drawImage(bb, c * C, 0, C, C);
      if (fi) for (let r = 1; r < rows; r++) ctx.drawImage(fi, c * C, r * C, C, C);
    }
    const fr = frame && _decoImg('d_i4_wall');
    if (fr) ctx.drawImage(fr, Math.floor(cols / 2) * C, 0, C, C);
  };
}
//  칩·동그라미 그림: 그 벽지(걸레받이까지) 또는 그 바닥을 rows 줄로 채운다
function _inTileDraw(kind, part, rows) {
  return (ctx, W, H) => {
    const C = H / rows, cols = Math.ceil(W / C), [a, c] = _inLookArt(kind, part);
    const im = _floorImg(a, c), bb = kind === 'wall' ? _floorImg('wall_baseboard') : null;
    ctx.fillStyle = kind === 'wall' ? '#8B6520' : '#C4955A'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
      if (im) ctx.drawImage(im, x * C, r * C, C, C);
      if (bb) ctx.drawImage(bb, x * C, r * C, C, C);
    }
  };
}
function _inLookShow() {
  const cur = _inLookParse(_inLookGet(CUR));
  _inPk.wall = cur.wall; _inPk.floor = cur.floor;   // 거꾸로 읽기 — 지금 방의 것을 고른 상태로
  _inLookRender();
}
function _inLookRender() {
  const host = document.getElementById('if-floor-picker');
  if (!host || host.hidden) return;
  _decoHandSync();   // [INDOOR-ROOMS-1] 탭·크기 칩이 바뀌면 한 손가락 끌기가 '네모'↔'화면 이동'으로 바뀐다 → ✋ 도 따라간다
  const wide = innerWidth >= 1200, small = innerWidth < 900, kind = _inPk.tab;
  if (kind === 'room') return _inRoomRender(host, wide, small);   // [INDOOR-ROOMS-1]
  const saved = _inLookParse(_inLookGet(CUR));
  const wall = kind === 'wall' ? _inPk.wall : saved.wall, floor = kind === 'floor' ? _inPk.floor : saved.floor;
  //  견본 — 고른 쪽은 붓, 다른 쪽은 지금 방의 것
  const sw = host.querySelector('.fpk-side');
  _pkSwatch(sw, small ? 150 : 180, small ? 96 : 112, _inRoomDraw(wall, floor, 3, true), _inPartName(kind, _inPk[kind]), ['방을 누르면 이렇게 바뀌어요']);
  const seg = _inSeg(kind);
  const slot = host.querySelector('.fpk-tool');
  if (slot) { slot.textContent = ''; slot.hidden = !wide; if (wide) slot.appendChild(seg); }
  if (!wide || !slot) sw.appendChild(seg);
  const row = (name, items, lab) => {
    const r = host.querySelector('.fpk-row[data-row="' + name + '"]'); if (!r) return;
    r.hidden = !items; if (!items) return;
    const l = r.querySelector('.fpk-lab'); if (l && lab) l.textContent = lab;
    const sc = r.querySelector('.fpk-scroll'); sc.textContent = ''; items.forEach(el => sc.appendChild(el));
  };
  row('rims', null); row('basics', null);
  const pick = _inPk[kind], pickName = pick ? pick.name : (kind === 'floor' ? 'plank' : 'floral');
  const cw = wide ? 52 : 54, ch = wide ? 34 : 40;
  //  1줄: 종류 칩 — 벽지 = 벽 띠 조각 + 걸레받이 · 바닥 = 바닥 두 줄
  row('fams', _inTable(kind).map(([id, lab]) => _pkChip(lab, cw, ch,
    _inTileDraw(kind, { name: id, color: '' }, kind === 'wall' ? 1 : 2),
    pickName === id, () => { _inPk[kind] = { name: id, color: (_inPk[kind] && _inPk[kind].name === id) ? _inPk[kind].color : '' }; _inLookRender(); })));
  //  2줄: 색(마루는 '톤') — 동그라미 44px + 아래 이름 10px(벽지 색은 그림만으로 헷갈린다) · 색이 없는 종류는 줄을 감춘다
  const tRow = _inTable(kind).find(x => x[0] === pickName), cols = tRow ? tRow[2] : [];
  if (!cols.length) { row('cols', null); return; }
  const order = pickName === 'plank' ? ['light', '', 'dark'] : [''].concat(cols);
  row('cols', order.map(c => {
    const part = { name: pickName, color: c }, name = _inPartName(kind, part);
    const w = document.createElement('div'); w.className = 'pk-dotn';
    const dot = _pkDot(name, 40, _inTileDraw(kind, part, 1), (pick ? pick.color : '') === c, false, () => { _inPk[kind] = part; _inLookRender(); });
    dot.dataset.col = c;
    const t = document.createElement('span'); t.textContent = (c ? _IN_COLOR_KO[c] : (_IN_BASE_KO[kind][pickName] || '기본'));
    w.appendChild(dot); w.appendChild(t);
    return w;
  }), pickName === 'plank' ? '톤' : '색');
}
//  [INDOOR-ROOMS-1] 탭 셋 — 벽지 · 바닥 · 방 만들기
function _inSeg(kind) {
  return _pkSeg([['wall', '🧱 벽지'], ['floor', '🟫 바닥'], ['room', '⬛ 방']], kind, t => { _inPk.tab = t; _inRoomPrevSet(null); _inLookRender(); }, '무엇을 할까');
}
//  방 탭: 견본 = 도면 위의 방 · 크기 칩 셋 + (가구 둘레로) + 방 없애기
function _inRoomDrawSmall(w, h) {
  return (ctx, W, H) => {
    ctx.fillStyle = '#161b28'; ctx.fillRect(0, 0, W, H);
    const C = Math.min(W / (w + 2), H / (h + 2.2)), ox = (W - w * C) / 2, oy = (H - (h + 1) * C) / 2 + C;
    ctx.strokeStyle = 'rgba(140,170,220,.18)'; ctx.lineWidth = .5;
    for (let x = ox % C; x < W; x += C) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = oy % C; y < H; y += C) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const fi = _floorImg('tile_indoor_wood'), wi = _floorImg('wall_floral'), bb = _floorImg('wall_baseboard');
    ctx.fillStyle = '#C4955A'; ctx.fillRect(ox, oy, w * C, h * C);
    for (let c = 0; c < w; c++) {
      if (wi) ctx.drawImage(wi, ox + c * C, oy - C, C, C);
      if (bb) ctx.drawImage(bb, ox + c * C, oy - C, C, C);
      if (fi) for (let r = 0; r < h; r++) ctx.drawImage(fi, ox + c * C, oy + r * C, C, C);
    }
    const t = Math.max(2, C * .16);
    ctx.fillStyle = '#5b3a20';
    ctx.fillRect(ox - t / 2, oy - C - t / 2, w * C + t, t); ctx.fillRect(ox - t / 2, oy - C, t, (h + 1) * C);
    ctx.fillRect(ox + w * C - t / 2, oy - C, t, (h + 1) * C); ctx.fillRect(ox - t / 2, oy + h * C - t / 2, w * C + t, t);
  };
}
function _inRoomRender(host, wide, small) {
  const rooms = _inRooms(CUR), tool = _inPk.tool;
  const sw = host.querySelector('.fpk-side');
  //  [DECO-ROOM-HOUSE-1] 두 번째 방부터는 집에 붙는다 — 말도 그 순서로
  const caps = tool === 'erase' ? ['없앨 방을 눌러요', '끝 방부터 없앨 수 있어요']
    : tool ? (rooms.length ? ['누른 곳 가까이 집에 붙어요', '붙은 방 사이엔 문이 저절로'] : ['빈 곳을 누르면 첫 방', '다음 방은 이 방에 붙여요'])
    : (rooms.length ? ['집 옆을 끌면 새 방', '노란 손잡이 = 크기 바꾸기', '붙은 방 사이엔 문이 저절로'] : ['빈 곳을 끌면 첫 방', '다음 방은 이 방에 붙여요']);   // [DECO-ROOM-RESIZE-1] 한 줄씩 짧게(180px 판)
  const szI = tool === 's0' ? 0 : tool === 's1' ? 1 : tool === 's2' ? 2 : 1;
  _pkSwatch(sw, small ? 150 : 180, small ? 96 : 112, _inRoomDrawSmall(ROOM_SIZES[szI][1], ROOM_SIZES[szI][2]),
    tool === 'erase' ? '🗑️ 방 없애기' : tool ? ROOM_SIZES[szI][0] + ' ' + ROOM_SIZES[szI][1] + '×' + ROOM_SIZES[szI][2] : '⬛ 네모로 방 만들기', caps);
  const seg = _inSeg('room'), slot = host.querySelector('.fpk-tool');
  if (slot) { slot.textContent = ''; slot.hidden = !wide; if (wide) slot.appendChild(seg); }
  if (!wide || !slot) sw.appendChild(seg);
  ['cols', 'rims', 'basics'].forEach(n => { const r = host.querySelector('.fpk-row[data-row="' + n + '"]'); if (r) r.hidden = true; });
  const r = host.querySelector('.fpk-row[data-row="fams"]'); if (!r) return;
  r.hidden = false;
  const sc = r.querySelector('.fpk-scroll'); sc.textContent = '';
  const cw = wide ? 52 : 54, ch = wide ? 34 : 40, pickT = t => { _inPk.tool = _inPk.tool === t ? '' : t; _inRoomPrevSet(null); _inLookRender(); };   // [DECO-ROOM-HOUSE-1] 칩이 바뀌면 미리 보기도
  ROOM_SIZES.forEach(([lab, w, h], i) => sc.appendChild(_pkChip(lab, cw, ch, _inRoomDrawSmall(w, h), tool === 's' + i, () => pickT('s' + i))));
  if (!rooms.length && _decoList(CUR).some(p => p.area === 'indoor'))
    sc.appendChild(_pkButton('pk-chip', '가구 둘레로 첫 방 만들기', false, () => _inRoomAroundFurniture(), b => { b.textContent = '🪑 가구 둘레로'; }));
  if (rooms.length) sc.appendChild(_pkButton('pk-chip', '방 없애기', tool === 'erase', () => pickT('erase'), b => { b.textContent = '🗑️ 방 없애기'; }));
}
//  판을 누르면 — 지금 탭 쪽만 그 방에(방이 없으면 큰 방). 같으면 아무 일 없음 · ↩ 한 단계
function _inLookApply() {
  const kind = _inPk.tab, prev = _inLookGet(CUR), saved = _inLookParse(prev);
  const next = kind === 'wall' ? _inLookJoin(saved.floor, _inPk.wall) : _inLookJoin(_inPk.floor, saved.wall);
  if (next === prev) { toast(kind === 'wall' ? '🧱 이미 이 벽지예요' : '🟫 이미 이 바닥이에요'); return false; }
  _inLookSet(CUR, next);
  _decoUndoPush({ t: 'look', sp: DECO_SPACE, prev, next });
  decoDirty(); _drawDeco(); _inLookRender();
  toast((kind === 'wall' ? '🧱 벽지가' : '🟫 바닥이') + ' 바뀌었어요 — ' + _inPartName(kind, _inPk[kind]) + ' (↩ 되돌리기)');
  return true;
}

// 장식 크기 가져오기 (없으면 1x1)
function getDecoSize(decoId) {
  const d = GAME_DATA.decorations.find(x=>x.id===decoId);
  return d?.size || {w:1,h:1};
}

// 멀티셀 장식 충돌 체크
// ══ 꾸미기 공간 1~3 (DECO-SPACE-1) ═══════════════════════════════
//  선생님: "지금 꾸미기를 공간 1 이라 하고 공간 3 까지 줘도 돼. 공간 1 에서 쓴 것은 소모된 상태로
//  다른 공간에서 쓰는 거지." → 장식은 한 목록(houseDecorations)에 두고 **공간 번호(sp)만 붙인다.**
//  · 공간 1 은 지금 그대로(sp 없음 = 1) → **있는 꾸미기는 한 글자도 안 바뀐다.**
//  · 가진 개수는 **모든 공간을 합쳐** 센다(공간 1 에 놓은 것은 다른 공간에서 못 쓴다).
//  · 바닥은 공간 1 = yardFloor(그대로), 공간 2·3 = yardFloors["2"|"3"] (새 필드, 있을 때만).
//  · 농장은 공간 1 에만 있다(작물은 하나다). 친구가 구경 오면 공간 1 을 본다.
//  저장 형식은 **추가만**(sp · yardFloors) — 옛 판이 새 저장본을 읽어도 공간 1 은 그대로 열린다.
const DECO_SPACES = 3;
let DECO_SPACE = 1;
function _decoSpaceOf(p) { return (p && p.sp) || 1; }
function _decoList(student) {
  return ((student && student.houseDecorations) || []).filter(p => _decoSpaceOf(p) === DECO_SPACE);
}
function _decoNew(id, area, row, col) {
  const o = { id, area, row, col };
  if (DECO_SPACE !== 1) o.sp = DECO_SPACE;
  return o;
}
//  읽기용(없으면 빈 것 — 필드를 만들지 않는다)
function _yardFloorGet(student) {
  if (!student) return {};
  if (DECO_SPACE === 1) return student.yardFloor || {};
  return (student.yardFloors && student.yardFloors[DECO_SPACE]) || {};
}
//  쓰기용(없으면 만든다)
function _yardFloorMap(student) {
  if (DECO_SPACE === 1) { student.yardFloor = student.yardFloor || {}; return student.yardFloor; }
  student.yardFloors = student.yardFloors || {};
  student.yardFloors[DECO_SPACE] = student.yardFloors[DECO_SPACE] || {};
  return student.yardFloors[DECO_SPACE];
}

function decoSpaceSet(n) {
  n = Math.max(1, Math.min(DECO_SPACES, n | 0));
  if (n === DECO_SPACE) return;
  decoFlush('공간 바꿈');
  _decoUndoClear();
  _decoViewSave();
  DECO_SPACE = n;
  try { localStorage.setItem('rpg.deco.space', String(n)); } catch (e) {}
  _decoSpaceSync();
  _animStopAll();
  _dCv = null; _dCtx = null;
  renderHouseDeco();
  const used = _decoList(CUR).length;
  toast('🏡 공간 ' + n + (used ? '' : ' — 비어 있어요. 새로 꾸며 보세요!'));
}
function _decoSpaceSync() {
  for (let i = 1; i <= DECO_SPACES; i++) {
    const b = document.getElementById('if-space-' + i);
    if (b) { b.classList.toggle('is-on', i === DECO_SPACE); b.setAttribute('aria-pressed', String(i === DECO_SPACE)); }
  }
}

// [DECO-PT-2] 말이 되게 — 물 위에는 물에 사는 것·물가 것만, 벽에 거는 것은 벽(맨 윗줄)에만
//  (디자인2 플레이 시험: "연못 한가운데 나무가 자라!" · "그림 액자가 방바닥 한가운데 있어")
const DECO_WATER_OK = { d_y29: 1, d_y30: 1 };   // 갈대 묶음 · 징검돌 (+ 물을 좋아하는 동물은 동물 규칙이 본다)
//  [INDOOR-WALL-1] 벽걸이 — 괘종시계(d_i3)는 서 있는 시계라 뺐다(그림에 바닥 그림자 · docs/indoor_look_rules_20260920.md §4, 보스 승인).
//  벽걸이는 저장은 **0번 줄 그대로**, 그림만 한 칸 위 벽 띠에 그린다(`DECO_WALL_ART` 의 벽걸이 판 · 없으면 몸통을 띠에).
const DECO_WALL = { d_i4: 1,                     // 그림 액자
  //  [DECO-INDOOR-ITEMS-1] 두꺼운 벽 묶음 벽걸이 여섯 — 그림이 곧 벽 띠 판(못·그림자·걸레받이 위)
  in_w_curtain: 1, in_w_window2: 1, in_w_clock: 1, in_w_board: 1, in_w_shelf: 1, in_w_bookshelf: 1 };
const DECO_WALL_ART = { d_i4: 'd_i4_wall',       // 벽 띠에 그릴 그림(assets/deco/<이름>.svg — 못·끈·벽 그림자까지 그린 판)
  in_w_curtain: 'in_w_curtain', in_w_window2: 'in_w_window2', in_w_clock: 'in_w_clock', in_w_board: 'in_w_board', in_w_shelf: 'in_w_shelf', in_w_bookshelf: 'in_w_bookshelf' };
function _isWallDeco(id) { return !!DECO_WALL[id]; }
function _decoRuleWhy(id, area, r, c, w, h) {
  if (!id) return '';
  if (area === 'yard' && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[id]) && !DECO_WATER_OK[id]) {
    const fl = _yardFloorGet(CUR);
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++)
      if (fl[(r + dr) + '_' + (c + dc)] === 'water') return '🌊 물 위에는 놓을 수 없어요 — 물가 풀밭에 놓아 보세요';
  }
  //  [DECO-RULE-R5] 동물을 키 큰 장식 바로 뒷줄(솟은 그림 밑)에 놓으면 지붕·나무 위에 선 것처럼 보인다
  if (area === 'yard' && typeof ANIM_DECO !== 'undefined' && ANIM_DECO[id]) {
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const t = _decoOverflowAt(CUR, r + dr, c + dc);
      if (t) { const d = GAME_DATA.decorations.find(x => x.id === t.id); return `${d ? d.icon + ' ' + d.name : '큰 장식'} 바로 뒤라 동물이 올라선 것처럼 보여요 — 앞쪽이나 옆에 놓아요`; }
    }
  }
  //  [DECO-INDOOR-FIT-2] 방이 있으면 벽은 방 윗벽뿐 — 안내도 하나로(맨 윗줄은 '방 밖은 마당'으로 거절되던 것 · 창조자 54-ⓑ103)
  if (area === 'indoor' && DECO_WALL[id] && !_inIsWallRow(r, c)) return _inRooms(CUR).length ? '🖼️ 벽에 거는 거예요 — 방의 윗벽을 눌러 걸어 주세요' : '🖼️ 벽에 거는 거예요 — 위쪽 벽(맨 윗줄)을 눌러 걸어 주세요';
  //  [DECO-INDOOR-RULE-1] 방이 있으면 벽은 방에만 있다 — 판 맨 윗줄(방 밖 마당)에 새로 걸지 않는다(이미 걸린 것은 그대로)
  if (area === 'indoor' && DECO_WALL[id] && _inRooms(CUR).length) { const hw = _inRoomAt(r, c); if (!(hw && !hw.band && hw.rm.r === r)) return '🖼️ 방의 윗벽에 걸어 주세요 — 방 밖은 마당이에요'; }
  //  [DECO-RULE-R3] 가구가 방 벽을 가로지르면(반은 방 안·반은 밖) 안 놓는다
  if (area === 'indoor' && !DECO_WALL[id] && _inCrossesWall(r, c, w, h, _inRooms(CUR))) return '🧱 벽에 걸려요 — 방 안에 다 들어가게 놓아 주세요';
  //  [DECO-INDOOR-RULE-1] 보스 결정 ① 방이 하나라도 있으면 방 밖(마당 잔디)에는 가구를 놓지 않는다 · 방이 없으면 바닥 전체가 한 방
  //  보스 결정 ② 나가기 문 발판 칸은 비워 둔다(나가는 길) — 둘 다 이미 놓인 것은 그대로(옮기지 않는다 · R3 와 같은 원칙)
  if (area === 'indoor' && !DECO_WALL[id]) {
    const rooms = _inRooms(CUR);
    if (rooms.length && !rooms.some(o => r >= o.r && c >= o.c && r + h <= o.r + o.h && c + w <= o.c + o.w)) return '🌿 방 밖은 마당이에요 — 방 안에 놓아 주세요';
    if (_inExitSpots(rooms).some(ex => r <= ex.matRow && r + h > ex.matRow && c < ex.c1 && c + w > ex.c0)) return '🚪 나가는 길이에요 — 문 앞 두 칸은 비워 두어요';   // [DECO-INDOOR-WALL-2] 문마다
  }
  return '';
}

//  [DECO-PT-2] 우리(pen)와 동물은 서로 겹쳐도 된다 — 우리 안에 동물을 넣고, 동물이 있는 자리에 우리를 두른다
function _decoOverlapOk(placingId, other) {
  if (!placingId || !other) return false;
  const isAnim = id => typeof ANIM_DECO !== 'undefined' && !!ANIM_DECO[id];
  if (other.area === 'indoor' && _isRugDeco(placingId) !== _isRugDeco(other.id)) return true;   // [INDOOR-RUG-1] 깔개 ↔ 가구
  //  [INDOOR-WALL-1] 벽에 건 것 ↔ 그 앞 바닥의 가구 — 액자는 벽 띠에 걸려 있어 0번 줄 바닥 칸을 차지하지 않는다
  if (other.area === 'indoor' && _inIsWallRow(other.row, other.col) && _isWallDeco(placingId) !== _isWallDeco(other.id)) return true;   // [INDOOR-ROOMS-1] 방 윗줄도
  return (isAnim(placingId) && _isPenDeco(other.id)) || (_isPenDeco(placingId) && isAnim(other.id));
}
// [INDOOR-RUG-1] 깔개(러그) = 장식 표의 layer:'floor' — 그릴 때 먼저 그려지던 바로 그 표시다(_isFloorLayerDeco 와 같은 잣대 · id 목록을 따로 두지 않는다).
//  깔개와 가구는 한 칸에 같이 놓인다(깔개 위에 소파 · 소파 밑에 깔개). **깔개끼리·가구끼리는 지금처럼 안 겹친다.**
//  저장 형식 변경 0 — 같은 칸에 기록이 둘 생길 뿐이고, 옛 JS 도 러그를 먼저 그리니 같은 그림이 나온다.
function _isRugDeco(id) { return !!id && _isFloorLayerDeco({ id }); }
//  이 자리(r,c,w,h)에 placingId 를 못 놓게 막는 놓인 것 하나(없으면 null) — "여기엔 이미 ○○" 의 ○○ 를 바르게 말하려고
function _decoBlockerAt(r, c, w, h, area, placingId) {
  return _decoList(CUR).find(p => {
    if (p.area !== area || _decoOverlapOk(placingId, p)) return false;
    const ps = getDecoSize(p.id);
    return r < p.row + ps.h && r + h > p.row && c < p.col + ps.w && c + w > p.col;
  }) || null;
}

function canPlaceDeco(r, c, w, h, area, excludeId, placingId) {
  if (placingId === undefined) placingId = SEL_DECO;   // [DECO-PT-2] 무엇을 놓는지(우리·동물 겹침 판단용)
  const placed = _decoList(CUR).filter(p=>p.area===area && p.id!==excludeId);   // [DECO-SPACE-1] 이 공간만
  for (let dr=0; dr<h; dr++) for (let dc=0; dc<w; dc++) {
    const tr=r+dr, tc=c+dc;
    if (area==='yard') {
      if (tr>=DY.rows || tc>=DY.cols) return false;
      if (_isHC(tr,tc)) return false;
      if (_isFarmCell(tr,tc)) return false; // 농장 존에는 장식 배치 불가
    } else {
      if (tr>=DI.rows || tc>=DI.cols) return false;
    }
    // 다른 장식과 겹침 체크
    for (const p of placed) {
      const ps = getDecoSize(p.id);
      if (tr>=p.row && tr<p.row+ps.h && tc>=p.col && tc<p.col+ps.w) {
        if (_decoOverlapOk(placingId, p)) continue;   // [DECO-PT-2] 우리 안 동물
        return false;
      }
    }
  }
  return true;
}

let SEL_DECO = null;
let DECO_SCENE = 'yard'; // 'yard' | 'indoor'
let _dCv = null, _dCtx = null, _dC = 28, _dW = 0, _dH = 0;
// [DECO-ZOOM-1] 꾸미기 확대/축소·화면 이동 — 판은 격자 좌표 그대로 그리고, 보이는 창만 옮긴다.
//  _dZoom 1 = 지금까지 보던 크기. 칸 크기 C = 기준칸 × _dZoom.
//  _dPanX/_dPanY = 보이는 창의 왼쪽 위가 판의 어디인지(판 픽셀). 저장하지 않는다(화면 상태).
const DECO_ZOOM_MIN = 0.5, DECO_ZOOM_MAX = 3, DECO_ZOOM_STEP = 1.25;
const DY_BASE = { cols: 50, rows: 28 };   // 집·농장 자리를 재는 기준 판(넓혀도 자리가 안 움직이게)
let _dZoom = 1, _dPanX = 0, _dPanY = 0;
let _ifMode = false; // 전체화면 인테리어 모드 여부

// ── 그리드 상수 ──
// 전체화면 모드: 셀 24px 기준으로 화면 크기에서 역산
// 일반 모드(포트폴리오 내): 기존 cols/rows 유지
const DY_NORMAL  = {cols:20, rows:14};  // 마당 일반 모드
const DY_FULL    = {cols:80, rows:44};  // 마당 전체화면 모드 — [DECO-LAND-1] 50×28 → 80×44(2.2배). 좌표는 그대로라 있는 마당은 안 움직인다
const DI_NORMAL  = {cols:12, rows:8};   // 집 안 일반 모드
const DI_FULL    = {cols:50, rows:28};  // 집 안 전체화면 모드
const DH = {cols:6, rows:3};            // 집 건물 차지 영역 (우상단)

// 현재 활성 그리드 (모드에 따라 전환)
let DY = {...DY_NORMAL};
let DI = {...DI_NORMAL};

// [DECO-ZOOM-1] 집은 기준 판(50칸) 오른쪽 위에 고정한다 — 마당을 넓혀도 집·문이 제자리.
function _houseCol0(){ return Math.min(DY.cols, DY_BASE.cols) - DH.cols; }
function _isHC(r,c){ const c0=_houseCol0(); return r < DH.rows && c >= c0 && c < c0 + DH.cols; }

// ── 전체화면 인테리어 모드 ──────────────────────────────
function openInteriorFullscreen() {
  _ifMode = true;
  _decoPhaseOv = null; setTimeout(() => { try { _decoPhaseSync(); } catch (e) {} }, 0);   // [DECO-DAYNIGHT-1] 다시 열면 실제 시각
  _decoWindStart();   // [DECO-WIND-1]
  _dZoom = 1; _dPanX = 0; _dPanY = 0;   // [DECO-ZOOM-1]
  try { const sp = +localStorage.getItem('rpg.deco.space'); if (sp >= 1 && sp <= DECO_SPACES) DECO_SPACE = sp; } catch (e) {}   // [DECO-SPACE-1]
  setTimeout(_decoSpaceSync, 0);
  _decoUndoClear();   // [DECO-UNDO-1] 다시 열면 0단계
  DY = {...DY_FULL};
  DI = {...DI_FULL};
  const fs = document.getElementById('interior-fullscreen');
  fs.style.display = 'flex';
  setTimeout(() => { try { _decoPillarSync(); } catch (e) {} }, 0);   // [DECO-PT-4] 보이게 된 뒤 기둥 자리
  _dCv = null; _dCtx = null;
  _ifActiveContainer = 'if-topview';
  ifSyncScene();
  ifSyncModeBtn();
  // 레이아웃 완료 후 렌더
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!_ifMode) return;   // [DECO-RCLICK-1·정리] 그사이 닫혔으면(탭이 가려져 rAF 가 멈춘 사이 등) 닫힌 판을 전체화면 값으로 다시 그리지 않는다
      renderHouseDeco();
      if (!_decoViewRestore()) (DECO_SCENE === 'yard' ? _decoPhoneStart() : _decoIndoorStart());   // [DECO-VIEW-1] 지난번 보던 자리로 · [DECO-PT-1] 처음이면 폰은 크게 · [INDOOR-ROOMS-1] 집 안은 방 둘레
      _decoLandHint();
    });
  });
}

// [DECO-LAND-1] 마당이 넓어진 것을 한 번만 알려 준다(기기에만 기록 — DB 쓰기 0)
//  [DECO-WORDS-1] '넓어졌어요'는 **좁은 옛 마당을 본 아이**에게만 맞는 말이다 — 마당에 장식이 하나도 없는 처음 아이에게는
//  안 띄우고(그대로 한 번 본 것으로 적는다), 집 안으로 곧장 들어왔을 때는 마당에 나올 때까지 미룬다.
function _decoLandHint() {
  if (DECO_SCENE !== 'yard') return;
  try {
    if (localStorage.getItem('rpg.deco.landHint') === '1') return;
    localStorage.setItem('rpg.deco.landHint', '1');
  } catch (e) { return; }
  if (!(CUR.houseDecorations || []).some(p => p.area === 'yard')) return;
  toast('🌿 마당이 넓어졌어요! 두 손가락으로 모으거나 "전체"를 누르면 넓게 보여요');
}

function closeInteriorFullscreen() {
  decoFlush('전체화면 닫기');   // [DECO-SAVE-1]
  _decoViewSave();   // [DECO-VIEW-1]
  _animStopAll();   // [DECO-ANIM-1] 타이머 남기지 않기
  _ifMode = false;
  DY = {...DY_NORMAL};
  DI = {...DI_NORMAL};
  document.getElementById('interior-fullscreen').style.display = 'none';
  _dCv = null; _dCtx = null;
  _ifActiveContainer = 'house-topview';
  renderHouseDeco();
}

let _ifActiveContainer = 'house-topview'; // 현재 캔버스 컨테이너

function ifSyncScene() {
  const isYard = DECO_SCENE === 'yard';
  if (isYard && typeof _decoEventGreet === 'function') setTimeout(() => { try { _decoEventGreet(); } catch (e) {} }, 700);   // [DECO-EVENT-2] 행사 첫 열림 알림(판을 그린 뒤)
  const sn = document.getElementById('if-scene-name');
  const sb = document.getElementById('if-scene-btn');
  if (sn) sn.textContent = isYard ? '🌿 마당' : '🏠 집 안';
  if (sb) sb.textContent = isYard ? '🏠 집 안으로 →' : '🌿 마당으로 ←';
  //  [DECO-DAYNIGHT-1] 📷 사진 · ☀️🌙 낮밤은 마당 것 — 집 안에선 감춘다(폰 320 집 안에서 윗줄이 세 줄이 되었다)
  ['if-photo-btn', 'if-phase-btn'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = isYard && !(id === 'if-phase-btn' && typeof _yardLook === 'function' && _yardLook().phase) ? '' : 'none'; });   // [DECO-STAR-P5] 때가 박힌 모습(별빛 = 밤)이면 단추가 할 일이 없다
  // [INDOOR-LOOK-1] 집 안에서는 같은 자리가 '🖌️ 벽지·바닥'(#631 이 감춰 두었던 단추가 돌아온다). 바닥 모드인 채 장면을 바꾸면 판도 그 장면 것으로.
  const fb = document.getElementById('if-mode-floor');
  if (fb) { fb.style.display = ''; fb.textContent = isYard ? '🖌️ 바닥' : '🖌️ 벽지·바닥'; }
  if (DECO_MODE === 'floor') _floorPickShow(true);
}

function ifSyncModeBtn() {
  ['if-mode-deco','if-mode-floor','if-mode-erase'].forEach(id => {   // [DECO-PT-2] 🧽 치우기
    const btn = document.getElementById(id);
    if (!btn) return;
    const active = id === 'if-mode-' + DECO_MODE;
    btn.style.background = active ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.06)';
    btn.style.color = active ? 'var(--gold)' : 'var(--txt2)';
    btn.style.borderColor = active ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.12)';
  });
  _decoFit();   // [DECO-FIT-1] 바닥 줄이 생기고 서랍이 접히면 판 자리가 달라진다
}

function ifSyncInv() {
  const el = document.getElementById('if-deco-inv');
  const srcEl = document.getElementById('house-deco-inv');
  if (el && srcEl) el.innerHTML = srcEl.innerHTML;
  try { _decoPillarSync(); } catch (e) {}   // [DECO-PT-4]
  try { _decoFit(); } catch (e) {}          // [DECO-FIT-1] 서랍 키가 바뀌면 판 자리도(처음 열 때·최근 줄이 생길 때)
  // 클릭 이벤트는 SEL_DECO 변수 공유로 동작
}

// ── Canvas 헬퍼 ──
function _dc(x,y,r){_dCtx.beginPath();_dCtx.arc(x,y,r,0,Math.PI*2);}
function _drr(x,y,w,h,r){_dCtx.beginPath();_dCtx.roundRect(x,y,w,h,r);}

// ── 타일 텍스처 렌더 (바닥 색칠 후 호출) ──────────────────────
// 위치 기반 결정론적 난수 (같은 타일은 항상 같은 패턴)
function _tRng(r,c,i){ return ((r*1009+c*1013+i*997)%997)/997; }

function _drawTileTexture(type, c, r, C) {
  const px = c*C, py = r*C;
  const ctx = _dCtx;

  switch(type) {
    case 'wood': {
      // 나무결 가로줄
      ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=Math.max(.5,C*.04);
      [.33,.66].forEach(dy=>{
        ctx.beginPath(); ctx.moveTo(px,py+C*dy); ctx.lineTo(px+C,py+C*dy); ctx.stroke();
      });
      // 나뭇결 약한 세로 변형
      ctx.strokeStyle='rgba(0,0,0,.05)'; ctx.lineWidth=Math.max(.5,C*.03);
      ctx.beginPath();
      ctx.moveTo(px+C*(_tRng(r,c,0)*.4+.1), py);
      ctx.lineTo(px+C*(_tRng(r,c,1)*.4+.15), py+C);
      ctx.stroke();
      break;
    }
    case 'water': {
      // 잔물결 — 위치마다 다른 각도/강도로 자연스럽게
      const a0 = _tRng(r,c,0); // 0~1
      const a1 = _tRng(r,c,1);
      const a2 = _tRng(r,c,2);
      // 물결 1 (짧고 약한)
      if(a0>.3){
        ctx.strokeStyle=`rgba(255,255,255,${.08+a0*.1})`; ctx.lineWidth=Math.max(.5,C*.03);
        const y1=py+C*(a0*.6+.1);
        ctx.beginPath(); ctx.moveTo(px+C*(a1*.3), y1);
        ctx.quadraticCurveTo(px+C*(a1*.3+.2), y1-C*.05, px+C*(a1*.3+.38+a2*.2), y1);
        ctx.stroke();
      }
      // 물결 2
      if(a1>.25){
        ctx.strokeStyle=`rgba(255,255,255,${.07+a1*.09})`; ctx.lineWidth=Math.max(.5,C*.025);
        const y2=py+C*(a1*.5+.35);
        ctx.beginPath(); ctx.moveTo(px+C*(a2*.4+.05), y2);
        ctx.quadraticCurveTo(px+C*(a2*.4+.25), y2+C*.04, px+C*(a2*.4+.45+a0*.15), y2);
        ctx.stroke();
      }
      // 매우 약한 반짝임 (점 1개)
      if(a2>.5){
        ctx.fillStyle=`rgba(255,255,255,${.12+a2*.08})`;
        _dc(px+C*(_tRng(r,c,3)*.7+.1), py+C*(_tRng(r,c,4)*.6+.1), C*.03); ctx.fill();
      }
      // 약한 어두운 깊이감 (가끔)
      if(_tRng(r,c,5)>.6){
        ctx.fillStyle='rgba(0,0,0,.08)';
        ctx.beginPath(); ctx.ellipse(px+C*(_tRng(r,c,6)*.6+.2), py+C*(_tRng(r,c,7)*.6+.1), C*.15, C*.08, _tRng(r,c,8)*Math.PI, 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'brick': {
      // 벽돌 바닥 — 채도 낮춤, 줄눈 덜 진하게, 벽돌 색 미세 변화
      const isAlt = (r+c)%2===0;
      const toneMod = _tRng(r,c,9)*.06-.03; // 칸마다 약간씩 다른 톤
      // 벽돌 면 색 (기본색보다 약간 밝게)
      ctx.fillStyle=`rgba(255,255,255,${.04+toneMod})`;
      ctx.fillRect(px, py, C, C);
      // 줄눈 (가로)
      ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=Math.max(.8,C*.05);
      ctx.beginPath(); ctx.moveTo(px, py+C*.5); ctx.lineTo(px+C, py+C*.5); ctx.stroke();
      // 줄눈 (세로, 오프셋 패턴)
      ctx.lineWidth=Math.max(.6,C*.04);
      const vo = isAlt ? C*.5 : 0;
      if(vo>0){ ctx.beginPath(); ctx.moveTo(px+vo,py); ctx.lineTo(px+vo,py+C*.5); ctx.stroke(); }
      const vo2 = isAlt ? 0 : C*.5;
      if(vo2>0){ ctx.beginPath(); ctx.moveTo(px+vo2,py+C*.5); ctx.lineTo(px+vo2,py+C); ctx.stroke(); }
      // 벽돌 면 미세 그림자 (좌상단)
      ctx.fillStyle='rgba(0,0,0,.06)';
      ctx.fillRect(px+(vo>0?vo:0)+1, py+1, C*.48-2, C*.47-2);
      // 두 번째 벽돌 미세 밝기 차이
      ctx.fillStyle=`rgba(255,255,255,${.03+_tRng(r,c,10)*.04})`;
      ctx.fillRect(px+(vo2>0?vo2:0)+1, py+C*.52, C*.48-2, C*.46-2);
      break;
    }
    case 'gravel': {
      // 작은 자갈들 (결정론적 위치)
      ctx.fillStyle='rgba(0,0,0,.18)';
      for(let i=0;i<6;i++){
        const gx=px+_tRng(r,c,i)*C, gy=py+_tRng(r,c,i+6)*C;
        const gr=C*(.04+_tRng(r,c,i+12)*.04);
        ctx.beginPath(); ctx.ellipse(gx,gy,gr,gr*.65,_tRng(r,c,i+18)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,.1)';
      for(let i=0;i<3;i++){
        const gx=px+_tRng(r,c,i+20)*C*.8+C*.1, gy=py+_tRng(r,c,i+26)*C*.8+C*.1;
        ctx.beginPath(); ctx.ellipse(gx,gy,C*.025,C*.02,0,0,Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'dark_earth': {
      // 어두운 흙 — 얼룩, 눌린 질감, 미세 명암 변화
      // 기본 얼룩 (크고 불규칙)
      ctx.fillStyle='rgba(0,0,0,.14)';
      for(let i=0;i<3;i++){
        const ex=px+_tRng(r,c,i)*C*.9+C*.05, ey=py+_tRng(r,c,i+3)*C*.9+C*.05;
        const ew=C*(.15+_tRng(r,c,i+6)*.12), eh=C*(.07+_tRng(r,c,i+9)*.05);
        ctx.beginPath(); ctx.ellipse(ex,ey,ew,eh,_tRng(r,c,i+12)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      // 밝은 얼룩 (돌/모래 입자)
      ctx.fillStyle='rgba(255,255,255,.07)';
      for(let i=0;i<4;i++){
        const ex=px+_tRng(r,c,i+15)*C, ey=py+_tRng(r,c,i+19)*C;
        ctx.beginPath(); ctx.ellipse(ex,ey,C*.04,C*.025,_tRng(r,c,i+23)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      // 가는 균열/줄 (흙 갈라짐)
      if(_tRng(r,c,27)>.55){
        ctx.strokeStyle='rgba(0,0,0,.16)'; ctx.lineWidth=Math.max(.5,C*.03);
        const lx1=px+_tRng(r,c,28)*C, ly1=py+_tRng(r,c,29)*C;
        ctx.beginPath(); ctx.moveTo(lx1,ly1);
        ctx.lineTo(lx1+C*(_tRng(r,c,30)*.3-.15), ly1+C*(_tRng(r,c,31)*.3+.1));
        ctx.stroke();
      }
      break;
    }
    case 'flower': {
      // 잔디 + 작은 꽃점 (은은하게)
      const colors=['rgba(255,160,200,.5)','rgba(255,230,100,.45)','rgba(200,160,255,.4)'];
      for(let i=0;i<4;i++){
        const fx=px+_tRng(r,c,i)*C, fy=py+_tRng(r,c,i+4)*C;
        ctx.fillStyle=colors[Math.floor(_tRng(r,c,i+8)*3)];
        _dc(fx,fy,C*.045); ctx.fill();
      }
      break;
    }
    case 'stone_floor': {
      ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=Math.max(.8,C*.055);
      const sx=_tRng(r,c,0)*.3+.25, sy=_tRng(r,c,1)*.3+.25;
      ctx.beginPath(); ctx.moveTo(px+C*sx, py); ctx.lineTo(px+C*(sx+.2), py+C*.5); ctx.lineTo(px+C, py+C*(sy+.2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py+C*sy); ctx.lineTo(px+C*(sx+.2), py+C*.5); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.ellipse(px+C*.25,py+C*.25,C*.18,C*.12,-.3,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'deck': {
      // 목재 데크 — 가로 나무판자 결
      const dOff = _tRng(r,c,0)*.5; // 판자 오프셋
      ctx.strokeStyle='rgba(0,0,0,.14)'; ctx.lineWidth=Math.max(.8,C*.05);
      // 가로 판자 경계선 (2~3줄)
      [.33,.66].forEach(dy=>{
        ctx.beginPath(); ctx.moveTo(px,py+C*dy); ctx.lineTo(px+C,py+C*dy); ctx.stroke();
      });
      // 나뭇결 (세로 방향 약한 줄)
      ctx.strokeStyle='rgba(0,0,0,.07)'; ctx.lineWidth=Math.max(.5,C*.03);
      for(let i=0;i<3;i++){
        const gx=px+C*(_tRng(r,c,i+1)*.8+.05);
        ctx.beginPath(); ctx.moveTo(gx,py); ctx.lineTo(gx+C*(_tRng(r,c,i+4)*.1-.05),py+C*.33); ctx.stroke();
      }
      // 밝은 면 (판자 상단)
      ctx.fillStyle='rgba(255,255,255,.06)';
      [0,.33,.66].forEach(dy=>{ ctx.fillRect(px,py+C*dy,C,C*.08); });
      break;
    }
    case 'dry_earth': {
      // 마른 흙 — 균열선 + 얼룩
      ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=Math.max(.5,C*.04);
      // 균열 패턴
      const cx1=px+_tRng(r,c,0)*C*.6+C*.2, cy1=py+_tRng(r,c,1)*C*.6+C*.2;
      ctx.beginPath(); ctx.moveTo(cx1,cy1);
      ctx.lineTo(cx1+C*(_tRng(r,c,2)*.3-.15), cy1-C*(_tRng(r,c,3)*.2+.1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx1,cy1);
      ctx.lineTo(cx1+C*(_tRng(r,c,4)*.3+.05), cy1+C*(_tRng(r,c,5)*.2+.08)); ctx.stroke();
      if(_tRng(r,c,6)>.5){
        ctx.beginPath(); ctx.moveTo(cx1,cy1);
        ctx.lineTo(cx1-C*(_tRng(r,c,7)*.25+.05), cy1+C*(_tRng(r,c,8)*.15+.05)); ctx.stroke();
      }
      // 얼룩 (더 밝거나 어두운 부분)
      ctx.fillStyle='rgba(0,0,0,.1)';
      ctx.beginPath(); ctx.ellipse(px+_tRng(r,c,9)*C,py+_tRng(r,c,10)*C,C*.12,C*.08,_tRng(r,c,11)*Math.PI,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.08)';
      ctx.beginPath(); ctx.ellipse(px+_tRng(r,c,12)*C*.8+C*.1,py+_tRng(r,c,13)*C*.8+C*.1,C*.08,C*.05,0,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'gravel_yard': {
      // 자갈마당 — 좀 더 크고 불규칙한 자갈
      ctx.fillStyle='rgba(0,0,0,.16)';
      for(let i=0;i<5;i++){
        const gx=px+_tRng(r,c,i)*C, gy=py+_tRng(r,c,i+5)*C;
        const gr=C*(.06+_tRng(r,c,i+10)*.06);
        ctx.beginPath(); ctx.ellipse(gx,gy,gr,gr*.7,_tRng(r,c,i+15)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,.12)';
      for(let i=0;i<3;i++){
        const gx=px+_tRng(r,c,i+18)*C*.8+C*.1, gy=py+_tRng(r,c,i+21)*C*.8+C*.1;
        ctx.beginPath(); ctx.ellipse(gx,gy,C*.04,C*.03,_tRng(r,c,i+24)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      // 그늘 (자갈 사이 틈)
      ctx.fillStyle='rgba(0,0,0,.08)';
      for(let i=0;i<2;i++){
        const gx=px+_tRng(r,c,i+26)*C, gy=py+_tRng(r,c,i+28)*C;
        ctx.beginPath(); ctx.ellipse(gx,gy,C*.08,C*.04,_tRng(r,c,i+30)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      break;
    }
  }
}

// ── 마당 장식 드로우 함수 ──
function _dRose(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.72,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 녹지 바닥 (칸 전체 가득)
  _dCtx.fillStyle='#2a6a14';_drr(cx-s*.82,cy+s*.1,s*1.64,s*.68,s*.22);_dCtx.fill();
  _dCtx.fillStyle='#368a1c';_drr(cx-s*.78,cy+s*.06,s*1.56,s*.56,s*.2);_dCtx.fill();
  // 꽃들 (5개, 크고 넓게)
  [[-s*.44,-s*.38,'#e8314a'],[-s*.14,-s*.52,'#c8203a'],[s*.18,-s*.44,'#e0284a'],[s*.46,-s*.32,'#ff4466'],[s*.02,-s*.24,'#ff5566']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c; _dc(cx+dx,cy+dy,s*.34); _dCtx.fill();
    _dCtx.fillStyle='#ff8898'; _dc(cx+dx,cy+dy,s*.16); _dCtx.fill();
  });
}
function _dTulip(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.68,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙 받침
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.72,cy+s*.36,s*1.44,s*.38,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.68,cy+s*.32,s*1.36,s*.28,s*.1);_dCtx.fill();
  // 줄기 3개
  [[-s*.32,s*.08],[0,s*.06],[s*.32,s*.1]].forEach(([dx,bot])=>{
    _dCtx.strokeStyle='#3a8020';_dCtx.lineWidth=s*.1;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+bot);_dCtx.lineTo(cx+dx,cy-s*.5);_dCtx.stroke();
  });
  // 잎
  _dCtx.strokeStyle='#2a6010';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.32,cy-s*.08);_dCtx.quadraticCurveTo(cx-s*.62,cy-s*.22,cx-s*.66,cy-s*.12);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.32,cy-s*.06);_dCtx.quadraticCurveTo(cx+s*.62,cy-s*.2,cx+s*.66,cy-s*.1);_dCtx.stroke();
  // 꽃봉오리 3개
  [[-s*.32,'#e84090'],[0,'#ff60a8'],[s*.32,'#c82070']].forEach(([dx,c])=>{
    _dCtx.fillStyle=c;
    _dCtx.beginPath();_dCtx.ellipse(cx+dx-s*.1,cy-s*.5,s*.18,s*.32,-.18,0,Math.PI*2);_dCtx.fill();
    _dCtx.beginPath();_dCtx.ellipse(cx+dx+s*.1,cy-s*.47,s*.16,s*.3,.18,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#ff80b8';
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy-s*.6,s*.12,s*.2,0,0,Math.PI*2);_dCtx.fill();
  });
}
function _dTree(cx,cy,s){
  // 바닥 그림자 (2x2라 넓게)
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.72,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 뿌리/기둥 받침
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.26,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (훨씬 두껍게)
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.18,cy-s*.08,s*.36,s*.56,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.1,cy-s*.06,s*.14,s*.52,s*.06);_dCtx.fill();
  // 가지
  _dCtx.strokeStyle='#6B4A1E';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.06);_dCtx.lineTo(cx-s*.38,cy-s*.36);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.14);_dCtx.lineTo(cx+s*.38,cy-s*.42);_dCtx.stroke();
  // 크라운 (3겹, 칸을 꽉 채움)
  _dCtx.fillStyle='#2a7010';_dc(cx,cy-s*.32,s*.72);_dCtx.fill();
  _dCtx.fillStyle='#3a8818';_dc(cx-s*.1,cy-s*.38,s*.62);_dCtx.fill();
  _dCtx.fillStyle='#4a9a22';_dc(cx,cy-s*.48,s*.52);_dCtx.fill();
  _dCtx.fillStyle='#5aaa2a';_dc(cx-s*.08,cy-s*.56,s*.38);_dCtx.fill();
  // 하이라이트
  _dCtx.fillStyle='rgba(255,255,255,.1)';_dc(cx-s*.2,cy-s*.6,s*.14);_dCtx.fill();
}
function _dBench(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.88,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리 4개
  [[-s*.6,-s*.22],[-s*.28,-s*.22],[s*.28,-s*.22],[s*.6,-s*.22]].forEach(([dx,baseY])=>{
    _dCtx.fillStyle='#7a5418';_drr(cx+dx-s*.07,cy+baseY,s*.14,s*.56,s*.04);_dCtx.fill();
  });
  // 앉는 판
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.72,cy-s*.14,s*1.44,s*.22,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.7,cy-s*.2,s*1.4,s*.16,s*.05);_dCtx.fill();
  // 판 나뭇결
  _dCtx.strokeStyle='#7a5010';_dCtx.lineWidth=s*.025;
  [-.44,-.12,.18].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s,cy-s*.2);_dCtx.lineTo(cx+dx*s,cy-s*.04);_dCtx.stroke();});
  // 등받이 기둥
  [[-s*.58],[s*.58]].forEach(([dx])=>{
    _dCtx.fillStyle='#7a5418';_drr(cx+dx-s*.07,cy-s*.44,s*.14,s*.38,s*.04);_dCtx.fill();
  });
  // 등받이 가로 판 2개
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.68,cy-s*.56,s*1.36,s*.14,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.66,cy-s*.62,s*1.32,s*.1,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.68,cy-s*.42,s*1.36,s*.11,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.66,cy-s*.48,s*1.32,s*.08,s*.03);_dCtx.fill();
}
function _dFountain(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.82,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 큰 분지 하단 (두께)
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.5,s*.82,s*.2,0,0,Math.PI*2);_dCtx.fill();
  // 큰 분지 상단면
  _dCtx.fillStyle='#9B9880';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.36,s*.82,s*.2,0,0,Math.PI*2);_dCtx.fill();
  // 분지 안 물
  _dCtx.fillStyle='rgba(26,106,154,.9)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.3,s*.7,s*.16,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(80,160,220,.6)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.26,s*.56,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#8a8870';_drr(cx-s*.1,cy-s*.32,s*.2,s*.66,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#aaa890';_drr(cx-s*.06,cy-s*.3,s*.1,s*.62,s*.04);_dCtx.fill();
  // 작은 분지 (중간)
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.1,s*.42,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(26,106,154,.7)';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.34,s*.08,0,0,Math.PI*2);_dCtx.fill();
  // 물줄기 (3개, 더 크게)
  _dCtx.strokeStyle='rgba(135,206,235,.95)';_dCtx.lineWidth=s*.1;
  [[-s*.28,-s*.88],[0,-s*.94],[s*.28,-s*.88]].forEach(([ex,ey])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.32);
    _dCtx.quadraticCurveTo(cx+ex*.4,cy-s*.6,cx+ex,cy+ey+s*.94);_dCtx.stroke();
  });
  // 물 튀김
  _dCtx.fillStyle='rgba(135,206,235,.7)';
  [[-s*.3,s*.32],[s*.3,s*.28],[s*.0,s*.18]].forEach(([dx,dy])=>{_dc(cx+dx,cy+dy,s*.05);_dCtx.fill();});
}
function _dLantern(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.52,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 바닥 받침
  _dCtx.fillStyle='#4a4a40';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.36,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a6a60';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.54,s*.28,s*.08,0,0,Math.PI*2);_dCtx.fill();
  // 폴
  _dCtx.fillStyle='#5a5a50';_drr(cx-s*.07,cy-s*.4,s*.14,s*1.0,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#7a7a70';_drr(cx-s*.04,cy-s*.38,s*.06,s*.96,s*.03);_dCtx.fill();
  // 등 몸체
  _dCtx.fillStyle='rgba(255,200,50,.85)';_drr(cx-s*.28,cy-s*.76,s*.56,s*.44,s*.08);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,230,120,.5)';_drr(cx-s*.24,cy-s*.72,s*.48,s*.28,s*.06);_dCtx.fill();
  // 등 프레임
  _dCtx.strokeStyle='#5a5a50';_dCtx.lineWidth=s*.06;_dCtx.strokeRect(cx-s*.28,cy-s*.76,s*.56,s*.44);
  // 지붕
  _dCtx.fillStyle='#4a4a40';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.34,cy-s*.76);_dCtx.lineTo(cx+s*.34,cy-s*.76);_dCtx.closePath();_dCtx.fill();
  // 빛 반짝임
  _dCtx.fillStyle='rgba(255,240,150,.6)';_dc(cx,cy-s*.54,s*.1);_dCtx.fill();
}
function _dCactus(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙받침 (화분 느낌)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.38,cy+s*.4,s*.76,s*.34,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#a07830';_drr(cx-s*.32,cy+s*.36,s*.64,s*.2,s*.06);_dCtx.fill();
  // 왼쪽 팔
  _dCtx.fillStyle='#3a7c1a';_drr(cx-s*.62,cy-s*.3,s*.34,s*.48,s*.16);_dCtx.fill();
  _dCtx.fillStyle='#4a9828';_drr(cx-s*.58,cy-s*.28,s*.16,s*.44,s*.08);_dCtx.fill();
  // 오른쪽 팔
  _dCtx.fillStyle='#3a7c1a';_drr(cx+s*.28,cy-s*.42,s*.34,s*.52,s*.16);_dCtx.fill();
  _dCtx.fillStyle='#4a9828';_drr(cx+s*.32,cy-s*.4,s*.16,s*.48,s*.08);_dCtx.fill();
  // 몸통 (크고 중앙에)
  _dCtx.fillStyle='#3a7c1a';_drr(cx-s*.24,cy-s*.72,s*.48,s*1.14,s*.22);_dCtx.fill();
  _dCtx.fillStyle='#5aac3a';_drr(cx-s*.14,cy-s*.7,s*.14,s*1.1,s*.07);_dCtx.fill();
  // 가시
  _dCtx.strokeStyle='#c8e870';_dCtx.lineWidth=s*.04;
  [[-s*.2,-s*.4],[s*.2,-s*.2],[-s*.2,s*.0],[s*.2,s*.2],[-s*.2,s*.3]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx-s*.1*(dx<0?-1:1),cy+dy-s*.12);_dCtx.stroke();
  });
}
function _dStone(cx,cy,s){
  // 돌 바로 아래 짧고 얕은 그림자 (떠 보이지 않게)
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.36,s*.7,s*.08,0,0,Math.PI*2);_dCtx.fill();

  // ── 가운데 큰 돌 (불규칙 다각형) ──
  _dCtx.fillStyle='#666658';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy+s*.28);   // 좌하
  _dCtx.lineTo(cx-s*.44,cy+s*.08);   // 좌
  _dCtx.lineTo(cx-s*.38,cy-s*.14);   // 좌상
  _dCtx.lineTo(cx-s*.12,cy-s*.28);   // 상좌
  _dCtx.lineTo(cx+s*.18,cy-s*.24);   // 상우
  _dCtx.lineTo(cx+s*.4,cy-s*.06);    // 우상
  _dCtx.lineTo(cx+s*.36,cy+s*.22);   // 우하
  _dCtx.lineTo(cx+s*.06,cy+s*.32);   // 하우
  _dCtx.closePath();_dCtx.fill();
  // 중간 면 (밝음)
  _dCtx.fillStyle='#8a8878';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.38,cy-s*.1);
  _dCtx.lineTo(cx-s*.1,cy-s*.26);
  _dCtx.lineTo(cx+s*.16,cy-s*.22);
  _dCtx.lineTo(cx+s*.34,cy-s*.04);
  _dCtx.lineTo(cx+s*.28,cy+s*.18);
  _dCtx.lineTo(cx-s*.22,cy+s*.24);
  _dCtx.lineTo(cx-s*.4,cy+s*.06);
  _dCtx.closePath();_dCtx.fill();
  // 상단 하이라이트
  _dCtx.fillStyle='#a0a090';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy-s*.14);
  _dCtx.lineTo(cx-s*.06,cy-s*.24);
  _dCtx.lineTo(cx+s*.14,cy-s*.2);
  _dCtx.lineTo(cx+s*.1,cy-s*.08);
  _dCtx.lineTo(cx-s*.18,cy-s*.06);
  _dCtx.closePath();_dCtx.fill();
  // 하단 어두운 면 (접지감)
  _dCtx.fillStyle='#525040';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy+s*.28);
  _dCtx.lineTo(cx+s*.06,cy+s*.32);
  _dCtx.lineTo(cx+s*.36,cy+s*.22);
  _dCtx.lineTo(cx+s*.28,cy+s*.3);   // 살짝 낮게
  _dCtx.lineTo(cx+s*.02,cy+s*.4);
  _dCtx.lineTo(cx-s*.32,cy+s*.36);
  _dCtx.closePath();_dCtx.fill();

  // ── 왼쪽 작은 돌 ──
  _dCtx.fillStyle='#5e5e50';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.5,cy+s*.3);_dCtx.lineTo(cx-s*.62,cy+s*.14);_dCtx.lineTo(cx-s*.56,cy-s*.02);
  _dCtx.lineTo(cx-s*.34,cy-s*.04);_dCtx.lineTo(cx-s*.28,cy+s*.2);_dCtx.lineTo(cx-s*.4,cy+s*.34);
  _dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7e7e70';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.6,cy+s*.12);_dCtx.lineTo(cx-s*.54,cy-s*.0);
  _dCtx.lineTo(cx-s*.34,cy-s*.02);_dCtx.lineTo(cx-s*.3,cy+s*.16);_dCtx.lineTo(cx-s*.48,cy+s*.26);
  _dCtx.closePath();_dCtx.fill();
  // 하단 어둠
  _dCtx.fillStyle='#464438';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.5,cy+s*.3);_dCtx.lineTo(cx-s*.4,cy+s*.34);_dCtx.lineTo(cx-s*.28,cy+s*.26);
  _dCtx.lineTo(cx-s*.34,cy+s*.34);_dCtx.lineTo(cx-s*.52,cy+s*.38);
  _dCtx.closePath();_dCtx.fill();

  // ── 오른쪽 작은 돌 ──
  _dCtx.fillStyle='#606254';
  _dCtx.beginPath();
  _dCtx.moveTo(cx+s*.44,cy+s*.28);_dCtx.lineTo(cx+s*.32,cy+s*.04);_dCtx.lineTo(cx+s*.44,cy-s*.08);
  _dCtx.lineTo(cx+s*.62,cy-s*.02);_dCtx.lineTo(cx+s*.68,cy+s*.18);_dCtx.lineTo(cx+s*.58,cy+s*.32);
  _dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7e8070';
  _dCtx.beginPath();
  _dCtx.moveTo(cx+s*.34,cy+s*.06);_dCtx.lineTo(cx+s*.44,cy-s*.06);
  _dCtx.lineTo(cx+s*.6,cy-s*.0);_dCtx.lineTo(cx+s*.64,cy+s*.16);_dCtx.lineTo(cx+s*.5,cy+s*.26);
  _dCtx.closePath();_dCtx.fill();
  // 하단 어둠
  _dCtx.fillStyle='#484a3c';
  _dCtx.beginPath();
  _dCtx.moveTo(cx+s*.44,cy+s*.28);_dCtx.lineTo(cx+s*.58,cy+s*.32);_dCtx.lineTo(cx+s*.66,cy+s*.24);
  _dCtx.lineTo(cx+s*.62,cy+s*.34);_dCtx.lineTo(cx+s*.44,cy+s*.36);_dCtx.lineTo(cx+s*.36,cy+s*.3);
  _dCtx.closePath();_dCtx.fill();

  // ── 표면 무늬 (약하게, 자연석 느낌) ──
  _dCtx.strokeStyle='rgba(0,0,0,.12)';_dCtx.lineWidth=s*.025;
  // 균열선 느낌
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.1,cy-s*.18);_dCtx.lineTo(cx+s*.08,cy+s*.04);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.12,cy-s*.1);_dCtx.lineTo(cx+s*.22,cy+s*.08);_dCtx.stroke();
  // 이끼 (작고 약하게)
  _dCtx.fillStyle='rgba(60,100,30,.35)';
  _dc(cx+s*.2,cy+s*.14,s*.045);_dCtx.fill();
  _dc(cx-s*.14,cy+s*.16,s*.04);_dCtx.fill();
}

// ── 집 안 가구 드로우 함수 ──
function _dDesk(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.82,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리 4개
  [[-s*.6,-s*.16],[-s*.28,-s*.16],[s*.28,-s*.16],[s*.6,-s*.16]].forEach(([dx,baseY])=>{
    _dCtx.fillStyle='#7a5010';_drr(cx+dx-s*.08,cy+baseY,s*.16,s*.54,s*.04);_dCtx.fill();
  });
  // 상판 (두껍게)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.74,cy-s*.38,s*1.48,s*.32,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.72,cy-s*.5,s*1.44,s*.2,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#c8a050';_drr(cx-s*.7,cy-s*.52,s*1.4,s*.06,s*.03);_dCtx.fill();
  // 모니터
  _dCtx.fillStyle='rgba(30,50,80,.85)';_drr(cx-s*.22,cy-s*.82,s*.44,s*.36,s*.05);_dCtx.fill();
  _dCtx.fillStyle='rgba(100,180,255,.5)';_drr(cx-s*.18,cy-s*.78,s*.36,s*.26,s*.04);_dCtx.fill();
  // 모니터 받침
  _dCtx.fillStyle='#4a4a40';_drr(cx-s*.06,cy-s*.46,s*.12,s*.06,s*.02);_dCtx.fill();
  // 키보드
  _dCtx.fillStyle='#c8c8b8';_drr(cx+s*.14,cy-s*.46,s*.54,s*.1,s*.04);_dCtx.fill();
  // 책/물건
  _dCtx.fillStyle='#e74c3c';_drr(cx-s*.66,cy-s*.46,s*.2,s*.1,s*.02);_dCtx.fill();
}
function _dSofa(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.9,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리
  _dCtx.fillStyle='#3a2a10';
  [[-s*.7],[s*.7]].forEach(([dx])=>{_drr(cx+dx-s*.07,cy+s*.32,s*.14,s*.22,s*.04);_dCtx.fill();});
  // 등받이
  _dCtx.fillStyle='#5a3a7a';_drr(cx-s*.82,cy-s*.62,s*1.64,s*.56,s*.14);_dCtx.fill();
  _dCtx.fillStyle='#6b4a8e';_drr(cx-s*.78,cy-s*.58,s*1.56,s*.44,s*.12);_dCtx.fill();
  // 팔걸이
  [[-s*.82,-s*.12],[s*.66,-s*.12]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#5a3a7a';_drr(cx+dx,cy+dy,s*.2,s*.5,s*.1);_dCtx.fill();
    _dCtx.fillStyle='#7a5aaa';_drr(cx+dx+s*.02,cy+dy,s*.14,s*.36,s*.08);_dCtx.fill();
  });
  // 앉는 부분
  _dCtx.fillStyle='#6b4a8e';_drr(cx-s*.78,cy-s*.1,s*1.56,s*.44,s*.1);_dCtx.fill();
  // 쿠션 3개
  [[-s*.44],[s*.0],[s*.44]].forEach(([dx])=>{
    _dCtx.fillStyle='#8060b0';_drr(cx+dx-s*.22,cy-s*.08,s*.44,s*.36,s*.09);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,255,255,.08)';_drr(cx+dx-s*.18,cy-s*.06,s*.36,s*.1,s*.04);_dCtx.fill();
  });
}
function _dClock(cx,cy,s){_dCtx.fillStyle='#D4A850';_dc(cx,cy,s*.48);_dCtx.fill();_dCtx.fillStyle='#FFF8E8';_dc(cx,cy,s*.4);_dCtx.fill();_dCtx.fillStyle='#5a3010';_dc(cx,cy,s*.06);_dCtx.fill();_dCtx.strokeStyle='#3a2008';_dCtx.lineWidth=s*.07;_dCtx.lineCap='round';_dCtx.beginPath();_dCtx.moveTo(cx,cy);_dCtx.lineTo(cx,cy-s*.27);_dCtx.stroke();_dCtx.lineWidth=s*.05;_dCtx.beginPath();_dCtx.moveTo(cx,cy);_dCtx.lineTo(cx+s*.19,cy+s*.12);_dCtx.stroke();}
function _dBookshelf(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.72,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 책장 외곽 (칸 꽉)
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.72,cy-s*.86,s*1.44,s*1.62,s*.05);_dCtx.fill();
  // 선반 3칸
  [0,1,2].forEach(i=>{
    _dCtx.fillStyle='#A07830';_drr(cx-s*.68,cy-s*.78+i*s*.5,s*1.36,s*.38,s*.03);_dCtx.fill();
    // 책들
    [['#c0392b','#2980b9','#27ae60','#8e44ad','#e67e22'],
     ['#2980b9','#c0392b','#16a085','#d35400','#8e44ad'],
     ['#27ae60','#e67e22','#2980b9','#c0392b','#16a085']][i].forEach((c,ci)=>{
      _dCtx.fillStyle=c;_drr(cx-s*.66+ci*s*.27,cy-s*.78+i*s*.5,s*.23,s*.38,s*.02);_dCtx.fill();
      _dCtx.fillStyle='rgba(255,255,255,.15)';_drr(cx-s*.64+ci*s*.27,cy-s*.76+i*s*.5,s*.1,s*.06,s*.01);_dCtx.fill();
    });
  });
  // 책장 측면 패널
  _dCtx.fillStyle='#6a4010';_drr(cx-s*.72,cy-s*.86,s*.08,s*1.62,s*.02);_dCtx.fill();
  _drr(cx+s*.64,cy-s*.86,s*.08,s*1.62,s*.02);_dCtx.fill();
}
function _dLamp(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.42,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 받침
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.32,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5a20';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.5,s*.26,s*.08,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (두껍게)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.1,cy-s*.16,s*.2,s*.68,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.06,cy-s*.14,s*.1,s*.64,s*.04);_dCtx.fill();
  // 빛 (갓 안)
  _dCtx.fillStyle='rgba(255,230,160,.6)';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.46,cy-s*.52);_dCtx.quadraticCurveTo(cx,cy-s*.14,cx+s*.46,cy-s*.52);_dCtx.closePath();_dCtx.fill();
  // 갓 (크게)
  _dCtx.fillStyle='#F5E0A0';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.5,cy-s*.58);_dCtx.quadraticCurveTo(cx,cy-s*.16,cx+s*.5,cy-s*.58);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#e8cc80';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.48,cy-s*.58);_dCtx.lineTo(cx+s*.48,cy-s*.58);_dCtx.stroke();
  // 갓 테두리
  _dCtx.strokeStyle='#c8a040';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.5,cy-s*.58);_dCtx.lineTo(cx+s*.5,cy-s*.58);_dCtx.stroke();
  // 갓 꼭대기
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.08,cy-s*.68,s*.16,s*.12,s*.04);_dCtx.fill();
}
function _dPiano(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.8,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 피아노 다리
  _dCtx.fillStyle='#111';
  [[-s*.62],[s*.62]].forEach(([dx])=>{_drr(cx+dx-s*.08,cy+s*.44,s*.16,s*.3,s*.04);_dCtx.fill();});
  // 피아노 본체
  _dCtx.fillStyle='#111';_drr(cx-s*.78,cy-s*.52,s*1.56,s*.98,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#1e1e1e';_drr(cx-s*.74,cy-s*.48,s*1.48,s*.88,s*.06);_dCtx.fill();
  // 뚜껑
  _dCtx.fillStyle='#0a0a0a';_drr(cx-s*.74,cy-s*.52,s*1.48,s*.2,s*.04);_dCtx.fill();
  // 건반 (크게)
  _dCtx.fillStyle='#f0f0f0';_drr(cx-s*.7,cy-s*.24,s*1.4,s*.38,s*.04);_dCtx.fill();
  // 검은 건반
  _dCtx.fillStyle='#111';
  [-s*.56,-s*.36,-s*.08,s*.12,s*.44].forEach(dx=>{
    _drr(cx+dx,cy-s*.24,s*.17,s*.24,s*.03);_dCtx.fill();
  });
  // 건반 구분선
  _dCtx.strokeStyle='#ccc';_dCtx.lineWidth=s*.02;
  [-s*.48,-s*.28,-s*.08,s*.12,s*.32,s*.52].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.24);_dCtx.lineTo(cx+dx,cy+s*.14);_dCtx.stroke();
  });
  // 의자
  _dCtx.fillStyle='#2a2a2a';_drr(cx-s*.28,cy+s*.46,s*.56,s*.2,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#3a3a3a';_drr(cx-s*.26,cy+s*.44,s*.52,s*.12,s*.04);_dCtx.fill();
  [[-s*.22],[s*.22]].forEach(([dx])=>{_drr(cx+dx-s*.04,cy+s*.62,s*.08,s*.16,s*.03);_dCtx.fill();});
}
function _dPlant(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.46,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 화분 (크게)
  _dCtx.fillStyle='#a85a28';_drr(cx-s*.32,cy+s*.02,s*.64,s*.52,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#c8783a';_drr(cx-s*.28,cy+s*.0,s*.56,s*.44,s*.07);_dCtx.fill();
  // 화분 테두리
  _dCtx.fillStyle='#a05020';_drr(cx-s*.34,cy-s*.02,s*.68,s*.1,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#d88040';_drr(cx-s*.3,cy-s*.04,s*.6,s*.07,s*.03);_dCtx.fill();
  // 흙
  _dCtx.fillStyle='#5a3a18';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.02,s*.28,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 잎들 (풍성하게)
  [[-.36,-.38,.52,.28,.4,'#3a9022'],[.2,-.44,-.48,.26,.38,'#4aaa2a'],[-.06,-.52,0,.22,.3,'#2a7818'],
   [-.44,-.2,.4,.18,.28,'#4aaa2a'],[.42,-.18,-.4,.18,.26,'#3a9022']].forEach(([dx,dy,rot,rx,ry,c])=>{
    _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.ellipse(cx+dx*s,cy+dy*s,rx*s,ry*s,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 가운데 새싹
  _dCtx.fillStyle='#5aaa28';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.56,s*.14,s*.24,0,0,Math.PI*2);_dCtx.fill();
}

// ── 추가 드로우 함수 ──
function _dSunflower(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.65,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙 받침
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.7,cy+s*.36,s*1.4,s*.38,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.66,cy+s*.32,s*1.32,s*.24,s*.1);_dCtx.fill();
  // 줄기 왼쪽
  _dCtx.strokeStyle='#3a8020';_dCtx.lineWidth=s*.12;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.24,cy+s*.32);_dCtx.lineTo(cx-s*.24,cy-s*.24);_dCtx.stroke();
  // 줄기 오른쪽
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.26,cy+s*.32);_dCtx.lineTo(cx+s*.26,cy-s*.32);_dCtx.stroke();
  // 잎들
  _dCtx.fillStyle='#4a9828';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.5,cy+s*.0,s*.22,s*.1,.5,0,Math.PI*2);_dCtx.fill();
  _dCtx.beginPath();_dCtx.ellipse(cx+s*.02,cy+s*.0,s*.22,s*.1,-.5,0,Math.PI*2);_dCtx.fill();
  _dCtx.beginPath();_dCtx.ellipse(cx+s*.52,cy-.04*s,s*.22,s*.1,.5,0,Math.PI*2);_dCtx.fill();
  // 꽃잎 왼쪽
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;_dCtx.fillStyle='#F4C430';_dCtx.beginPath();_dCtx.ellipse(cx-s*.24+Math.cos(a)*s*.3,cy-s*.24+Math.sin(a)*s*.3,s*.12,s*.07,a,0,Math.PI*2);_dCtx.fill();}
  _dCtx.fillStyle='#5C3317';_dc(cx-s*.24,cy-s*.24,s*.18);_dCtx.fill();
  _dCtx.fillStyle='#7a4a20';_dc(cx-s*.24,cy-s*.24,s*.11);_dCtx.fill();
  // 꽃잎 오른쪽
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;_dCtx.fillStyle='#F4C430';_dCtx.beginPath();_dCtx.ellipse(cx+s*.26+Math.cos(a)*s*.3,cy-s*.32+Math.sin(a)*s*.3,s*.12,s*.07,a,0,Math.PI*2);_dCtx.fill();}
  _dCtx.fillStyle='#5C3317';_dc(cx+s*.26,cy-s*.32,s*.18);_dCtx.fill();
  _dCtx.fillStyle='#7a4a20';_dc(cx+s*.26,cy-s*.32,s*.11);_dCtx.fill();
}

function _dScarecrow(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.44,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (바닥까지 꽉)
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.06,cy-s*.62,s*.12,s*1.36,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx-s*.03,cy-s*.6,s*.06,s*1.32,s*.03);_dCtx.fill();
  // 팔 가로대 (더 넓게)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.62,cy-s*.34,s*1.24,s*.1,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.6,cy-s*.38,s*1.2,s*.06,s*.03);_dCtx.fill();
  // 몸통 (더 크게)
  _dCtx.fillStyle='#c8783a';_drr(cx-s*.28,cy-s*.22,s*.56,s*.52,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#e0a060';_drr(cx-s*.2,cy-s*.18,s*.4,s*.16,s*.04);_dCtx.fill();
  // 바지
  _dCtx.fillStyle='#4a6090';_drr(cx-s*.22,cy+s*.08,s*.44,s*.24,s*.05);_dCtx.fill();
  [[-s*.14],[s*.14]].forEach(([dx])=>{_dCtx.fillStyle='#3a5080';_drr(cx+dx-s*.1,cy+s*.28,s*.2,s*.2,s*.04);_dCtx.fill();});
  // 머리
  _dCtx.fillStyle='#F4C430';_dc(cx,cy-s*.46,s*.22);_dCtx.fill();
  _dCtx.fillStyle='#e0b020';_dc(cx,cy-s*.46,s*.18);_dCtx.fill();
  // 모자
  _dCtx.fillStyle='#5C3317';_drr(cx-s*.26,cy-s*.72,s*.52,s*.1,s*.03);_dCtx.fill();
  _drr(cx-s*.16,cy-s*.84,s*.32,s*.18,s*.04);_dCtx.fill();
  // 얼굴
  _dCtx.fillStyle='#333';
  _dc(cx-s*.08,cy-s*.46,s*.05);_dCtx.fill();
  _dc(cx+s*.08,cy-s*.46,s*.05);_dCtx.fill();
  _dCtx.strokeStyle='#333';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.arc(cx,cy-s*.4,s*.08,0.1,Math.PI-.1);_dCtx.stroke();
}

function _dWindmill(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.58,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a7860';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.44,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a9878';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.52,s*.38,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9898a0';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.38,cy+s*.5);_dCtx.lineTo(cx+s*.38,cy+s*.5);_dCtx.lineTo(cx+s*.18,cy-s*.46);_dCtx.lineTo(cx-s*.18,cy-s*.46);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#c0c0c8';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.32,cy+s*.48);_dCtx.lineTo(cx+s*.32,cy+s*.48);_dCtx.lineTo(cx+s*.14,cy-s*.44);_dCtx.lineTo(cx-s*.14,cy-s*.44);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.12)';
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.14,cy-s*.44);_dCtx.lineTo(cx+s*.18,cy-s*.46);_dCtx.lineTo(cx+s*.38,cy+s*.5);_dCtx.lineTo(cx+s*.32,cy+s*.48);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='rgba(160,200,255,.5)';
  _drr(cx-s*.09,cy-s*.28,s*.18,s*.22,s*.05);_dCtx.fill();
  _drr(cx-s*.08,cy+s*.06,s*.16,s*.2,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='rgba(80,80,100,.4)';_dCtx.lineWidth=s*.03;
  _dCtx.strokeRect(cx-s*.09,cy-s*.28,s*.18,s*.22);_dCtx.strokeRect(cx-s*.08,cy+s*.06,s*.16,s*.2);
  _dCtx.fillStyle='#8a6020';_drr(cx-s*.1,cy+s*.3,s*.2,s*.22,s*.04);_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.3)';_drr(cx-s*.09,cy+s*.31,s*.18,s*.18,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#6a6a58';_dc(cx,cy-s*.38,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dc(cx,cy-s*.38,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#e8e0c8';_dCtx.strokeStyle='#8a8870';_dCtx.lineWidth=s*.04;
  [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy])=>{
    _dCtx.beginPath();
    const ox=cx+dx*s*.1, oy=cy-s*.38+dy*s*.1;
    _dCtx.moveTo(ox,oy);
    _dCtx.lineTo(cx+dx*s*.82,cy-s*.38+dy*s*.82);
    _dCtx.lineTo(cx+dx*s*.72+dy*s*.18,cy-s*.38+dy*s*.72-dx*s*.18);
    _dCtx.lineTo(ox+dy*s*.08,oy-dx*s*.08);
    _dCtx.closePath();_dCtx.fill();_dCtx.stroke();
  });
  _dCtx.fillStyle='#5a5a48';_dc(cx,cy-s*.38,s*.09);_dCtx.fill();
  _dCtx.fillStyle='#7a7a68';_dc(cx,cy-s*.38,s*.05);_dCtx.fill();
}

function _dCherryTree(cx,cy,s){
  // 바닥 그림자 (3x3이라 아주 넓게)
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.88,s*.18,0,0,Math.PI*2);_dCtx.fill();
  // 뿌리 퍼짐
  _dCtx.fillStyle='#5a3a10';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.36,cy+s*.56,s*.22,s*.08,-.3,0,Math.PI*2);_dCtx.fill();
  _dCtx.beginPath();_dCtx.ellipse(cx+s*.38,cy+s*.54,s*.22,s*.08,.3,0,Math.PI*2);_dCtx.fill();
  // 기둥 (3x3답게 두껍게)
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.26,cy-s*.08,s*.52,s*.68,s*.1);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.14,cy-s*.06,s*.2,s*.64,s*.06);_dCtx.fill();
  // 굵은 가지들
  _dCtx.strokeStyle='#6B4A1E';_dCtx.lineWidth=s*.14;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.06,cy-s*.06);_dCtx.lineTo(cx-s*.6,cy-s*.4);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.06,cy-s*.06);_dCtx.lineTo(cx+s*.6,cy-s*.44);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.1);_dCtx.lineTo(cx,cy-s*.6);_dCtx.stroke();
  _dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.6,cy-s*.4);_dCtx.lineTo(cx-s*.78,cy-s*.6);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.6,cy-s*.44);_dCtx.lineTo(cx+s*.76,cy-s*.62);_dCtx.stroke();
  // 꽃구름 (3×3 전체를 꽉 채움)
  [
    [0,-s*.7,s*.52],[s*.48,-s*.54,s*.38],[-s*.48,-s*.5,s*.38],
    [s*.7,-s*.28,s*.32],[-s*.7,-s*.24,s*.32],
    [s*.28,-s*.84,s*.34],[-s*.3,-s*.82,s*.34],
    [s*.52,-s*.1,s*.28],[-s*.52,-s*.08,s*.28],
    [0,-s*.44,s*.4]
  ].forEach(([dx,dy,r])=>{
    _dCtx.fillStyle='rgba(255,182,193,.88)';_dc(cx+dx,cy+dy,r);_dCtx.fill();
  });
  // 꽃잎 점 (더 많이)
  _dCtx.fillStyle='#ff69b4';
  for(let i=0;i<20;i++){
    const a=i*.314, r=(0.15+Math.sin(i*0.7)*0.18)*s;
    _dc(cx+Math.cos(a)*r,cy-s*.5+Math.sin(a)*r*.7,s*.05);_dCtx.fill();
  }
  // 떨어지는 꽃잎 (아래쪽)
  _dCtx.fillStyle='rgba(255,182,193,.6)';
  [[-s*.4,s*.2],[-s*.2,s*.3],[s*.1,s*.15],[s*.5,s*.25]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.06,s*.04,0.5,0,Math.PI*2);_dCtx.fill();
  });
}

function _dMagicStone(cx,cy,s){
  // 바닥 그림자 (마법 느낌으로 보라빛)
  _dCtx.fillStyle='rgba(100,50,180,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.66,s*.58,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 돌 기반 (더 크게)
  _dCtx.fillStyle='#5a4a7a';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.42,s*.52,s*.18,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a68aa';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.3,s*.46,s*.16,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a88c0';_dCtx.beginPath();_dCtx.ellipse(cx-s*.04,cy+s*.22,s*.4,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 보석 (훨씬 크게)
  _dCtx.fillStyle='#00d8ff';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.56);_dCtx.lineTo(cx-s*.28,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#0088cc';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy+s*.2);_dCtx.lineTo(cx-s*.28,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.closePath();_dCtx.fill();
  // 보석 내부 면
  _dCtx.fillStyle='rgba(120,240,255,.5)';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.56);_dCtx.lineTo(cx-s*.1,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.closePath();_dCtx.fill();
  // 빛 줄기
  _dCtx.strokeStyle='rgba(180,240,255,.9)';_dCtx.lineWidth=s*.05;
  [[-s*.42,-s*.62],[s*.44,-s*.58],[0,-s*.72],[-s*.2,-s*.28],[s*.22,-s*.3]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx*.7,cy+dy*.7);_dCtx.lineTo(cx+dx,cy+dy);_dCtx.stroke();
  });
  // 핵 반짝임
  _dCtx.fillStyle='rgba(255,255,255,.9)';_dc(cx-s*.08,cy-s*.38,s*.06);_dCtx.fill();
}

function _dGoldenLantern(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.5,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 바닥 받침 (넓고 안정적으로)
  _dCtx.fillStyle='#8a7010';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.42,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#C8A830';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.52,s*.34,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (두껍게)
  _dCtx.fillStyle='#A08820';_drr(cx-s*.09,cy-s*.16,s*.18,s*.7,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.05,cy-s*.14,s*.08,s*.66,s*.04);_dCtx.fill();
  // 등 몸체 (크게)
  _dCtx.fillStyle='rgba(255,220,50,.9)';_drr(cx-s*.3,cy-s*.72,s*.6,s*.58,s*.1);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,240,120,.5)';_drr(cx-s*.26,cy-s*.68,s*.52,s*.32,s*.08);_dCtx.fill();
  // 등 프레임 격자
  _dCtx.strokeStyle='#A08820';_dCtx.lineWidth=s*.05;_dCtx.strokeRect(cx-s*.3,cy-s*.72,s*.6,s*.58);
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.72);_dCtx.lineTo(cx,cy-s*.14);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.3,cy-s*.44);_dCtx.lineTo(cx+s*.3,cy-s*.44);_dCtx.stroke();
  // 지붕 (크게)
  _dCtx.fillStyle='#C8A830';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.92);_dCtx.lineTo(cx-s*.36,cy-s*.72);_dCtx.lineTo(cx+s*.36,cy-s*.72);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#FFD700';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.92);_dCtx.lineTo(cx-s*.18,cy-s*.72);_dCtx.lineTo(cx+s*.18,cy-s*.72);_dCtx.closePath();_dCtx.fill();
  // 빛 반짝임
  _dCtx.fillStyle='rgba(255,240,100,.7)';_dc(cx,cy-s*.44,s*.14);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,200,.8)';_dc(cx,cy-s*.44,s*.07);_dCtx.fill();
}

function _dFrame(cx,cy,s){
  // 액자 테두리
  _dCtx.fillStyle='#A07830';_drr(cx-s*.44,cy-s*.52,s*.88,s*.88,s*.06);_dCtx.fill();
  // 그림 내부
  _dCtx.fillStyle='#87CEEB';_drr(cx-s*.34,cy-s*.44,s*.68,s*.7,s*.03);_dCtx.fill();
  // 간단한 풍경
  _dCtx.fillStyle='#4a9822';_drr(cx-s*.34,cy+s*.06,s*.68,s*.2,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#FFD700';_dc(cx-s*.1,cy-s*.22,s*.1);_dCtx.fill(); // 해
  _dCtx.fillStyle='#5c3010';_dCtx.beginPath();
  _dCtx.moveTo(cx+s*.15,cy+s*.06);_dCtx.lineTo(cx+s*.08,cy-s*.14);_dCtx.lineTo(cx+s*.22,cy-s*.14);_dCtx.closePath();_dCtx.fill();
}

function _dTV(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.64,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 받침대
  _dCtx.fillStyle='#222';_drr(cx-s*.18,cy+s*.32,s*.36,s*.2,s*.04);_dCtx.fill();
  _drr(cx-s*.28,cy+s*.48,s*.56,s*.08,s*.04);_dCtx.fill();
  // TV 본체 (더 크고 넓게)
  _dCtx.fillStyle='#1a1a1a';_drr(cx-s*.7,cy-s*.56,s*1.4,s*.9,s*.08);_dCtx.fill();
  // 베젤
  _dCtx.fillStyle='#2a2a2a';_drr(cx-s*.68,cy-s*.54,s*1.36,s*.86,s*.06);_dCtx.fill();
  // 화면
  _dCtx.fillStyle='#0a1828';_drr(cx-s*.62,cy-s*.5,s*1.24,s*.76,s*.04);_dCtx.fill();
  // 화면 내용
  ['#e74c3c','#3498db','#2ecc71','#f39c12'].forEach((c,i)=>{
    _dCtx.fillStyle=c;_drr(cx-s*.58+i*s*.31,cy-s*.46,s*.28,s*.66,s*.03);_dCtx.fill();
  });
  // 화면 반사
  _dCtx.fillStyle='rgba(255,255,255,.06)';_drr(cx-s*.6,cy-s*.48,s*1.2,s*.28,s*.04);_dCtx.fill();
  // 전원 버튼
  _dCtx.fillStyle='#4a4a4a';_dc(cx+s*.6,cy-s*.12,s*.05);_dCtx.fill();
}

function _dBed(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 침대 프레임
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.84,cy-s*.82,s*1.68,s*1.56,s*.09);_dCtx.fill();
  // 매트리스
  _dCtx.fillStyle='#e8e0d0';_drr(cx-s*.76,cy-s*.74,s*1.32,s*1.28,s*.07);_dCtx.fill();
  // 이불
  _dCtx.fillStyle='#4a6c9a';_drr(cx-s*.76,cy-s*.56,s*1.04,s*.98,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#5a7caa';_drr(cx-s*.74,cy-s*.54,s*1.0,s*.86,s*.06);_dCtx.fill();
  // 이불 주름
  _dCtx.strokeStyle='rgba(255,255,255,.12)';_dCtx.lineWidth=s*.04;
  [-s*.46,-s*.16,s*.14].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.5);_dCtx.lineTo(cx+dx,cy+s*.42);_dCtx.stroke();
  });
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.72,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.stroke();
  // 베개
  _dCtx.fillStyle='#f0e8d8';_drr(cx+s*.22,cy-s*.72,s*.5,s*.32,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#e0d8c8';_drr(cx+s*.24,cy-s*.7,s*.46,s*.28,s*.05);_dCtx.fill();
  // 헤드보드
  _dCtx.fillStyle='#9a6820';_drr(cx+s*.7,cy-s*.86,s*.18,s*1.6,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#c8a050';_drr(cx+s*.72,cy-s*.84,s*.06,s*1.56,s*.03);_dCtx.fill();
  // 발판
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.84,cy+s*.68,s*1.68,s*.14,s*.05);_dCtx.fill();
}

function _dAquarium(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.56,s*.82,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 수조 받침
  _dCtx.fillStyle='#2a2a2a';_drr(cx-s*.74,cy+s*.4,s*1.48,s*.14,s*.04);_dCtx.fill();
  // 수조 본체
  _dCtx.fillStyle='rgba(14,60,110,.85)';_drr(cx-s*.74,cy-s*.72,s*1.48,s*1.14,s*.08);_dCtx.fill();
  // 유리 테두리
  _dCtx.strokeStyle='#5a9ad8';_dCtx.lineWidth=s*.08;_dCtx.strokeRect(cx-s*.74,cy-s*.72,s*1.48,s*1.14);
  // 물 표면 반사
  _dCtx.fillStyle='rgba(100,180,255,.25)';_drr(cx-s*.72,cy-s*.7,s*1.44,s*.26,s*.05);_dCtx.fill();
  // 물고기 5마리
  [[-s*.48,-.28,'#ff6b35'],[s*.24,-.48,'#ffd700'],[-s*.06,-.12,'#ff4488'],[s*.48,-.18,'#44aaff'],[-s*.28,-.02,'#ff8c44']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy*s,s*.18,s*.1,0,0,Math.PI*2);_dCtx.fill();
    // 꼬리
    _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.moveTo(cx+dx+s*.16,cy+dy*s);_dCtx.lineTo(cx+dx+s*.28,cy+dy*s-s*.1);_dCtx.lineTo(cx+dx+s*.28,cy+dy*s+s*.1);_dCtx.closePath();_dCtx.fill();
    _dCtx.fillStyle='rgba(255,255,255,.4)';_dCtx.beginPath();_dCtx.ellipse(cx+dx-s*.06,cy+dy*s-s*.03,s*.05,s*.03,0,0,Math.PI*2);_dCtx.fill();
  });
  // 모래 바닥
  _dCtx.fillStyle='#c8b870';_drr(cx-s*.72,cy+s*.32,s*1.44,s*.16,s*.04);_dCtx.fill();
  // 해초
  _dCtx.strokeStyle='#28a870';_dCtx.lineWidth=s*.07;
  [-s*.54,-s*.22,s*.14,s*.52].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.32);
    _dCtx.quadraticCurveTo(cx+dx+s*.1,cy+s*.04,cx+dx,cy-s*.28);_dCtx.stroke();
  });
}

function _dGoldenShelf(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.72,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 외곽 (꽉 채움)
  _dCtx.fillStyle='#a87810';_drr(cx-s*.72,cy-s*.82,s*1.44,s*1.58,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.68,cy-s*.78,s*1.36,s*1.5,s*.04);_dCtx.fill();
  // 선반 3개
  [0,1,2].forEach(i=>{
    _dCtx.fillStyle='#D4B840';_drr(cx-s*.64,cy-s*.7+i*s*.48,s*1.28,s*.36,s*.03);_dCtx.fill();
    ['#e74c3c','#3498db','#2ecc71','#f39c12','#8e44ad'].forEach((c,ci)=>{
      _dCtx.fillStyle=c;_drr(cx-s*.62+ci*s*.25,cy-s*.7+i*s*.48,s*.22,s*.36,s*.02);_dCtx.fill();
      _dCtx.fillStyle='rgba(255,255,255,.2)';_drr(cx-s*.6+ci*s*.25,cy-s*.68+i*s*.48,s*.1,s*.08,s*.01);_dCtx.fill();
    });
    _dCtx.fillStyle='#C8A830';_drr(cx-s*.68,cy-s*.36+i*s*.48,s*1.36,s*.05,s*.02);_dCtx.fill();
  });
  // 테두리
  _dCtx.strokeStyle='rgba(255,240,100,.5)';_dCtx.lineWidth=s*.06;
  _dCtx.strokeRect(cx-s*.68,cy-s*.78,s*1.36,s*1.5);
  // 측면 장식
  _dCtx.fillStyle='#a87810';_drr(cx-s*.72,cy-s*.82,s*.08,s*1.58,s*.02);_dCtx.fill();
  _drr(cx+s*.64,cy-s*.82,s*.08,s*1.58,s*.02);_dCtx.fill();
}

function _dMirror(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.42,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 받침 (넓게)
  _dCtx.fillStyle='#5a3a7a';_drr(cx-s*.28,cy+s*.52,s*.56,s*.16,s*.05);_dCtx.fill();
  _drr(cx-s*.18,cy+s*.48,s*.36,s*.1,s*.04);_dCtx.fill();
  // 거울 외곽 테두리 (1x2 높이 꽉)
  _dCtx.fillStyle='#7a40c0';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.46,s*.7,0,0,Math.PI*2);_dCtx.fill();
  // 마법 반짝임 테두리
  _dCtx.strokeStyle='#c4a0ff';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.46,s*.7,0,0,Math.PI*2);_dCtx.stroke();
  // 별 장식
  _dCtx.fillStyle='#e0c8ff';
  [[0,-s*.74],[s*.42,-s*.3],[-s*.42,-s*.26],[s*.36,-s*.8],[-s*.38,-s*.78]].forEach(([dx,dy])=>{
    _dCtx.font=`${s*.18}px sans-serif`;_dCtx.textAlign='center';_dCtx.textBaseline='middle';
    _dCtx.fillText('✦',cx+dx,cy+dy);
  });
  // 거울 내부
  _dCtx.fillStyle='rgba(210,240,255,.75)';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.36,s*.6,0,0,Math.PI*2);_dCtx.fill();
  // 반사 효과
  _dCtx.fillStyle='rgba(255,255,255,.5)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.14,cy-s*.46,s*.1,s*.32,-.3,0,Math.PI*2);_dCtx.fill();
  // 별빛 반사
  _dCtx.fillStyle='rgba(255,255,255,.95)';
  [[0,-s*.44],[s*.2,-s*.14],[-s*.18,-s*.2]].forEach(([dx,dy])=>{_dc(cx+dx,cy+dy,s*.05);_dCtx.fill();});
}

function _dThrone(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.56,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리 4개
  _dCtx.fillStyle='#a07010';
  [[-s*.44,-s*.32],[s*.28,-s*.32],[-s*.44,-s*.46],[s*.28,-s*.46]].forEach(([dx,dy])=>{
    _drr(cx+dx,cy-dy,s*.16,s*.28,s*.04);_dCtx.fill();
  });
  // 의자 바닥
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.56,cy+s*.22,s*1.12,s*.2,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#D4B840';_drr(cx-s*.54,cy+s*.18,s*1.08,s*.14,s*.04);_dCtx.fill();
  // 앉는 쿠션
  _dCtx.fillStyle='#8B1a1a';_drr(cx-s*.46,cy+s*.04,s*.92,s*.2,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#a02a2a';_drr(cx-s*.44,cy+s*.02,s*.88,s*.12,s*.05);_dCtx.fill();
  // 등받이
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.54,cy-s*.72,s*1.08,s*.96,s*.07);_dCtx.fill();
  // 등받이 쿠션
  _dCtx.fillStyle='#8B1a1a';_drr(cx-s*.44,cy-s*.68,s*.88,s*.72,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#a02a2a';_drr(cx-s*.42,cy-s*.66,s*.84,s*.58,s*.04);_dCtx.fill();
  // 팔걸이
  _dCtx.fillStyle='#C8A830';
  [[-s*.54,s*.08],[s*.38,s*.08]].forEach(([dx,dy])=>{_drr(cx+dx,cy+dy,s*.18,s*.22,s*.05);_dCtx.fill();});
  // 왕관 장식 (더 크게)
  _dCtx.fillStyle='#FFD700';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy-s*.72);_dCtx.lineTo(cx-s*.28,cy-s*.92);
  _dCtx.lineTo(cx-s*.1,cy-s*.82);_dCtx.lineTo(cx,cy-s*.94);
  _dCtx.lineTo(cx+s*.1,cy-s*.82);_dCtx.lineTo(cx+s*.28,cy-s*.92);
  _dCtx.lineTo(cx+s*.28,cy-s*.72);_dCtx.closePath();_dCtx.fill();
  // 왕관 보석
  _dCtx.fillStyle='#ff4444';_dc(cx,cy-s*.92,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#4444ff';_dc(cx-s*.26,cy-s*.9,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#44ff44';_dc(cx+s*.26,cy-s*.9,s*.05);_dCtx.fill();
}

function _dTrophy(cx,cy,s){
  // 받침대
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.26,cy+s*.42,s*.52,s*.1,s*.04);_dCtx.fill();
  _drr(cx-s*.14,cy+s*.28,s*.28,s*.16,s*.04);_dCtx.fill();
  // 컵 몸체
  _dCtx.fillStyle='#FFD700';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.36,cy-s*.52);_dCtx.lineTo(cx+s*.36,cy-s*.52);
  _dCtx.quadraticCurveTo(cx+s*.38,cy+s*.1,cx+s*.14,cy+s*.28);
  _dCtx.lineTo(cx-s*.14,cy+s*.28);
  _dCtx.quadraticCurveTo(cx-s*.38,cy+s*.1,cx-s*.36,cy-s*.52);
  _dCtx.closePath();_dCtx.fill();
  // 손잡이
  _dCtx.strokeStyle='#D4A820';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.arc(cx-s*.42,cy-s*.12,s*.14,Math.PI*.4,Math.PI*1.5);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.arc(cx+s*.42,cy-s*.12,s*.14,-Math.PI*.4,Math.PI*.5);_dCtx.stroke();
  // 별
  _dCtx.fillStyle='#fff';_dCtx.font=`${s*.4}px sans-serif`;_dCtx.textAlign='center';
  _dCtx.fillText('★',cx,cy-s*.04);
}

// ══════════════════════════════════════════════════════════
// ── 목재 울타리 드로우 함수 ────────────────────────────────
// ══════════════════════════════════════════════════════════

// 기둥 공통 (다른 함수에서 호출)
function _dFencePost(cx,topY,botY,s){
  const h=botY-topY;
  // 그림자 오른쪽면
  _dCtx.fillStyle='#5A2C06';_drr(cx+s*.02,topY,s*.2,h,s*.04);_dCtx.fill();
  // 기둥 본체
  _dCtx.fillStyle='#9A5A18';_drr(cx-s*.18,topY,s*.38,h,s*.06);_dCtx.fill();
  // 하이라이트 왼쪽
  _dCtx.fillStyle='#C87828';_drr(cx-s*.18,topY,s*.2,h,s*.05);_dCtx.fill();
  // 캡
  _dCtx.fillStyle='#5A2C06';
  _dCtx.beginPath();_dCtx.ellipse(cx,topY,s*.24,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#C87828';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.02,topY-s*.02,s*.21,s*.11,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#E09838';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.06,topY-s*.05,s*.1,s*.05,0,0,Math.PI*2);_dCtx.fill();
}

// 레일 그리기 (x, y, w, s)
function _dFenceRail(rx,ry,rw,s){
  _dCtx.fillStyle='#6B3808';_drr(rx,ry+s*.02,rw,s*.21,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#A86818';_drr(rx,ry,rw,s*.18,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#D4A040';_drr(rx,ry-s*.02,rw,s*.1,s*.02);_dCtx.fill();
}

// d_y49: 울타리 가로형 (1×1)
function _dFenceHorz(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.17)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.74,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 레일 2줄 전폭 (기둥 뒤)
  _dFenceRail(cx-s*.78,cy-s*.38,s*1.56,s);
  _dFenceRail(cx-s*.78,cy-s*.04,s*1.56,s);
  // 기둥
  _dFencePost(cx,cy-s*.75,cy+s*.76,s);
}

// d_y50: 울타리 세로형 (1×1) — 기둥만
function _dFenceVert(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.14)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.2,s*.07,0,0,Math.PI*2);_dCtx.fill();
  _dFencePost(cx,cy-s*.8,cy+s*.8,s);
}

// d_y51: 울타리 왼쪽 코너형 (┌=└) — 판자 오른쪽
function _dFenceCornerL(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.4,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 판자 오른쪽 방향
  _dFenceRail(cx+s*.18,cy-s*.38,s*.6,s);
  _dFenceRail(cx+s*.18,cy-s*.04,s*.6,s);
  _dFencePost(cx,cy-s*.8,cy+s*.8,s);
}

// d_y52: 울타리 오른쪽 코너형 (┐=┘) — 판자 왼쪽
function _dFenceCornerR(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.4,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 판자 왼쪽 방향
  _dFenceRail(cx-s*.78,cy-s*.38,s*.6,s);
  _dFenceRail(cx-s*.78,cy-s*.04,s*.6,s);
  _dFencePost(cx,cy-s*.8,cy+s*.8,s);
}

// ══════════════════════════════════════════════════════════
// ── 2차 신규 장식 드로우 함수 ─────────────────────────────
// ══════════════════════════════════════════════════════════

// ── 건물 ──────────────────────────────────────────────────

// d_y34: 작은 창고 (2×2)
function _dSmallShed(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.78,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#8a8070';_drr(cx-s*.72,cy+s*.34,s*1.44,s*.4,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#a09888';_drr(cx-s*.68,cy+s*.3,s*1.36,s*.26,s*.04);_dCtx.fill();
  // 벽 (회색 판자)
  _dCtx.fillStyle='#7a7870';_drr(cx-s*.7,cy-s*.38,s*1.4,s*.72,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_drr(cx-s*.66,cy-s*.42,s*1.32,s*.6,s*.03);_dCtx.fill();
  // 판자 선
  _dCtx.strokeStyle='#6a6860';_dCtx.lineWidth=s*.035;
  [-s*.36,s*.0,s*.36].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.42);_dCtx.lineTo(cx+dx,cy+s*.3);_dCtx.stroke();});
  // 문
  _dCtx.fillStyle='#5a4a18';_drr(cx-s*.16,cy-s*.12,s*.32,s*.44,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#7a6828';_drr(cx-s*.14,cy-s*.1,s*.28,s*.36,s*.03);_dCtx.fill();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.1);_dCtx.lineTo(cx,cy+s*.26);_dCtx.strokeStyle='#5a4a18';_dCtx.lineWidth=s*.04;_dCtx.stroke();
  _dCtx.fillStyle='#d4b830';_dc(cx+s*.1,cy+s*.1,s*.04);_dCtx.fill();
  // 창문
  _dCtx.fillStyle='rgba(160,210,255,.5)';_drr(cx-s*.5,cy-s*.34,s*.22,s*.2,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a6860';_dCtx.lineWidth=s*.03;_dCtx.strokeRect(cx-s*.5,cy-s*.34,s*.22,s*.2);
  // 지붕
  _dCtx.fillStyle='#4a3818';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.82);_dCtx.lineTo(cx-s*.8,cy-s*.38);_dCtx.lineTo(cx+s*.8,cy-s*.38);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#6a5428';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.72);_dCtx.lineTo(cx-s*.72,cy-s*.38);_dCtx.lineTo(cx+s*.72,cy-s*.38);_dCtx.closePath();_dCtx.fill();
  _dCtx.strokeStyle='#3a2808';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.72);_dCtx.lineTo(cx-s*.72,cy-s*.38);_dCtx.lineTo(cx+s*.72,cy-s*.38);_dCtx.closePath();_dCtx.stroke();
  // 지붕 처마
  _dCtx.fillStyle='#3a2808';_drr(cx-s*.82,cy-s*.44,s*1.64,s*.1,s*.03);_dCtx.fill();
}

// ── 농촌 심화 ──────────────────────────────────────────────

// d_y35: 밀밭 B형 (2×2) — 더 풍성한 이삭
function _dWheatFieldB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5828';_drr(cx-s*.84,cy+s*.16,s*1.68,s*.6,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#8a6838';_drr(cx-s*.8,cy+s*.12,s*1.6,s*.44,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#7a6010';_dCtx.lineWidth=s*.04;
  [-s*.6,-s*.26,s*.08,s*.44].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.56);_dCtx.lineTo(cx+dx+s*.04,cy+s*.12);_dCtx.stroke();});
  // 풍성한 이삭 (더 둥근 형태)
  const stemsB=[
    [-s*.7,s*.08, s*.04],[-s*.48,s*.04,-s*.03],[-s*.26,s*.08, s*.05],[s*.0, s*.04,-s*.04],
    [s*.22, s*.06, s*.03],[s*.44,s*.02,-s*.04],[s*.66, s*.08, s*.04],
    [-s*.58,s*.32, s*.04],[-s*.36,s*.28,-s*.03],[-s*.14,s*.3, s*.05],[s*.08, s*.26,-s*.04],
    [s*.3,  s*.28, s*.03],[s*.52,s*.24,-s*.04],[s*.72, s*.3,  s*.04],
  ];
  stemsB.forEach(([dx,dy,lean])=>{
    _dCtx.strokeStyle='#c09818';_dCtx.lineWidth=s*.055;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx+lean,cy+dy-s*.26);_dCtx.stroke();
    // 풍성한 이삭 (타원형)
    _dCtx.fillStyle='#ddb020';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lean,cy+dy-s*.36,s*.07,s*.12,lean*2,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#f0c828';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lean-s*.02,cy+dy-s*.34,s*.04,s*.08,lean*2,0,Math.PI*2);_dCtx.fill();
  });
}

// d_y36: 보리밭 (2×2)
function _dBarleyField(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a5020';_drr(cx-s*.84,cy+s*.16,s*1.68,s*.6,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#7a6030';_drr(cx-s*.8,cy+s*.12,s*1.6,s*.44,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a5010';_dCtx.lineWidth=s*.04;
  [-s*.6,-s*.26,s*.08,s*.44].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.56);_dCtx.lineTo(cx+dx,cy+s*.12);_dCtx.stroke();});
  // 보리 — 길쭉하고 수염 달린 이삭
  const stemsPad=[
    [-s*.68,s*.06],[-s*.46,s*.02],[-s*.24,s*.06],[s*.02,s*.02],[s*.24,s*.06],[s*.46,s*.02],[s*.68,s*.06],
    [-s*.56,s*.3],[-s*.34,s*.26],[-s*.12,s*.3],[s*.12,s*.26],[s*.34,s*.3],[s*.56,s*.26],
  ];
  stemsPad.forEach(([dx,dy])=>{
    const lean=(dx>0?1:-1)*s*.02;
    _dCtx.strokeStyle='#a88510';_dCtx.lineWidth=s*.05;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx+lean,cy+dy-s*.28);_dCtx.stroke();
    // 보리 이삭 (길쭉)
    _dCtx.fillStyle='#c8a018';_drr(cx+dx+lean-s*.03,cy+dy-s*.44,s*.06,s*.18,s*.03);_dCtx.fill();
    // 수염 (awns)
    _dCtx.strokeStyle='#b89010';_dCtx.lineWidth=s*.02;
    [-.03,0,.03].forEach(bx=>{
      _dCtx.beginPath();_dCtx.moveTo(cx+dx+lean+bx*s,cy+dy-s*.34);_dCtx.lineTo(cx+dx+lean+bx*s+(bx>0?s*.06:-s*.06),cy+dy-s*.54);_dCtx.stroke();
    });
  });
}

// d_y37: 장작더미 B형 (1×1) — 다른 쌓기 패턴
function _dLogPileB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.64,s*.58,s*.1,0,0,Math.PI*2);_dCtx.fill();
  const lW=s*.46, lH=s*.2;
  // 아래 단 — 2개 교차
  [[-s*.2,s*.32,-.1],[s*.16,s*.26,.12]].forEach(([dx,dy,rot])=>{
    _dCtx.fillStyle='#7a4820';_drr(cx+dx-lW*.5,cy+dy-lH*.5,lW,lH,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#9a6430';_drr(cx+dx-lW*.5,cy+dy-lH*.5,lW,lH*.4,s*.03);_dCtx.fill();
    _dCtx.strokeStyle='#5a3010';_dCtx.lineWidth=s*.022;
    [.3,.6].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx-lW*.5+lW*t,cy+dy-lH*.5);_dCtx.lineTo(cx+dx-lW*.5+lW*t,cy+dy+lH*.5);_dCtx.stroke();});
    _dCtx.fillStyle='#5a3010';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lW*.46,cy+dy,s*.08,lH*.42,0,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#c07830';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lW*.46,cy+dy,s*.05,lH*.28,0,0,Math.PI*2);_dCtx.fill();
  });
  // 중간 단
  [[cx,cy+s*.06]].forEach(([mx,my])=>{
    _dCtx.fillStyle='#8a5220';_drr(mx-lW*.58,my-lH*.5,lW*1.16,lH,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#aa7030';_drr(mx-lW*.58,my-lH*.5,lW*1.16,lH*.4,s*.03);_dCtx.fill();
    _dCtx.strokeStyle='#5a3010';_dCtx.lineWidth=s*.022;
    [.25,.55,.8].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(mx-lW*.58+lW*1.16*t,my-lH*.5);_dCtx.lineTo(mx-lW*.58+lW*1.16*t,my+lH*.5);_dCtx.stroke();});
    _dCtx.fillStyle='#5a3010';_dCtx.beginPath();_dCtx.ellipse(mx+lW*.54,my,s*.08,lH*.42,0,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#c07830';_dCtx.beginPath();_dCtx.ellipse(mx+lW*.54,my,s*.05,lH*.28,0,0,Math.PI*2);_dCtx.fill();
  });
  // 위 단 (1개, 조금 삐딱)
  const ty=cy-s*.22;
  _dCtx.fillStyle='#8a5220';_drr(cx-s*.06-lW*.46,ty-lH*.45,lW*.92,lH*.9,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#b07030';_drr(cx-s*.06-lW*.46,ty-lH*.45,lW*.92,lH*.36,s*.03);_dCtx.fill();
  _dCtx.strokeStyle='#5a3010';_dCtx.lineWidth=s*.022;
  [.35,.65].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx-s*.06-lW*.46+lW*.92*t,ty-lH*.45);_dCtx.lineTo(cx-s*.06-lW*.46+lW*.92*t,ty+lH*.45);_dCtx.stroke();});
  _dCtx.fillStyle='#5a3010';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06+lW*.42,ty,s*.08,lH*.4,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#c07830';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06+lW*.42,ty,s*.05,lH*.27,0,0,Math.PI*2);_dCtx.fill();
}

// d_y38: 큰 바위 B형 (2×1) — 납작한 형태
function _dLargeRockB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.24)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.06,cy+s*.58,s*.8,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 큰 납작 바위 (좌)
  _dCtx.fillStyle='#585648';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.78,cy+s*.22);_dCtx.lineTo(cx-s*.72,cy-s*.12);_dCtx.lineTo(cx-s*.36,cy-s*.32);_dCtx.lineTo(cx+s*.1,cy-s*.28);_dCtx.lineTo(cx+s*.2,cy+s*.22);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7a7868';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.74,cy+s*.1);_dCtx.lineTo(cx-s*.7,cy-s*.1);_dCtx.lineTo(cx-s*.34,cy-s*.28);_dCtx.lineTo(cx+s*.08,cy-s*.24);_dCtx.lineTo(cx+s*.18,cy+s*.1);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_dCtx.beginPath();_dCtx.ellipse(cx-s*.36,cy-s*.12,s*.22,s*.1,-.2,0,Math.PI*2);_dCtx.fill();
  // 작은 바위 (우)
  _dCtx.fillStyle='#626058';
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.14,cy+s*.18);_dCtx.lineTo(cx+s*.2,cy-s*.08);_dCtx.lineTo(cx+s*.52,cy-s*.22);_dCtx.lineTo(cx+s*.8,cy-s*.04);_dCtx.lineTo(cx+s*.78,cy+s*.22);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#8a8878';
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.16,cy+s*.08);_dCtx.lineTo(cx+s*.22,cy-s*.06);_dCtx.lineTo(cx+s*.5,cy-s*.18);_dCtx.lineTo(cx+s*.76,cy-s*.02);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='rgba(50,110,20,.4)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.5,cy+s*.08,s*.2,s*.08,.2,0,Math.PI*2);_dCtx.fill();
  // 균열
  _dCtx.strokeStyle='rgba(0,0,0,.2)';_dCtx.lineWidth=s*.03;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.2,cy-s*.24);_dCtx.lineTo(cx-s*.06,cy+s*.1);_dCtx.stroke();
}

// ── 정적 동물 ──────────────────────────────────────────────

// d_y39: 닭 3마리 (2×1)
function _dChickens(cx,cy,s){
  // 바닥 그림자 (넓게)
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.56,s*.78,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙/잔디 기반 (닭들이 서 있는 땅)
  _dCtx.fillStyle='#4a7820';_drr(cx-s*.78,cy+s*.32,s*1.56,s*.26,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#5a8a28';_drr(cx-s*.74,cy+s*.28,s*1.48,s*.16,s*.06);_dCtx.fill();

  const drawChicken = (bx,by,sc,bodyCol,wingCol,combCol)=>{
    // 그림자 (개별)
    _dCtx.fillStyle='rgba(0,0,0,.15)';_dCtx.beginPath();_dCtx.ellipse(bx,by+sc*.32,sc*.28,sc*.07,0,0,Math.PI*2);_dCtx.fill();
    // 다리 (먼저 — 몸 아래에서 나오게)
    _dCtx.strokeStyle='#c89020';_dCtx.lineWidth=sc*.06;_dCtx.lineCap='round';
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.08,by+sc*.14);_dCtx.lineTo(bx-sc*.12,by+sc*.32);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.06,by+sc*.12);_dCtx.lineTo(bx+sc*.1,by+sc*.32);_dCtx.stroke();
    // 발가락 (앞 2개)
    _dCtx.lineWidth=sc*.04;
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.12,by+sc*.32);_dCtx.lineTo(bx-sc*.2,by+sc*.36);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.12,by+sc*.32);_dCtx.lineTo(bx-sc*.06,by+sc*.38);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.1,by+sc*.32);_dCtx.lineTo(bx+sc*.18,by+sc*.36);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.1,by+sc*.32);_dCtx.lineTo(bx+sc*.06,by+sc*.38);_dCtx.stroke();
    // 꼬리 깃털
    _dCtx.fillStyle=wingCol;
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.2,by-sc*.04);_dCtx.lineTo(bx+sc*.36,by-sc*.22);_dCtx.lineTo(bx+sc*.3,by-sc*.08);_dCtx.closePath();_dCtx.fill();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.18,by-sc*.02);_dCtx.lineTo(bx+sc*.32,by-sc*.14);_dCtx.lineTo(bx+sc*.26,by+sc*.02);_dCtx.closePath();_dCtx.fill();
    // 몸통 (타원, 앞으로 기울어진 형태)
    _dCtx.fillStyle=bodyCol;_dCtx.beginPath();_dCtx.ellipse(bx,by,sc*.26,sc*.2,-.15,0,Math.PI*2);_dCtx.fill();
    // 날개
    _dCtx.fillStyle=wingCol;_dCtx.beginPath();_dCtx.ellipse(bx+sc*.04,by+sc*.06,sc*.24,sc*.14,-.2,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle=bodyCol;_dCtx.beginPath();_dCtx.ellipse(bx,by-sc*.02,sc*.2,sc*.14,-.15,0,Math.PI*2);_dCtx.fill();
    // 목
    _dCtx.fillStyle=bodyCol;_drr(bx-sc*.22,by-sc*.24,sc*.16,sc*.18,sc*.08);_dCtx.fill();
    // 머리
    _dCtx.fillStyle=bodyCol;_dc(bx-sc*.2,by-sc*.3,sc*.15);_dCtx.fill();
    _dCtx.fillStyle=wingCol;_dc(bx-sc*.2,by-sc*.28,sc*.12);_dCtx.fill(); // 음영
    // 볏
    _dCtx.fillStyle=combCol;
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.26,by-sc*.38);_dCtx.lineTo(bx-sc*.2,by-sc*.46);_dCtx.lineTo(bx-sc*.14,by-sc*.38);_dCtx.closePath();_dCtx.fill();
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.2,by-sc*.38);_dCtx.lineTo(bx-sc*.14,by-sc*.44);_dCtx.lineTo(bx-sc*.08,by-sc*.38);_dCtx.closePath();_dCtx.fill();
    // 부리
    _dCtx.fillStyle='#d89020';_dCtx.beginPath();_dCtx.moveTo(bx-sc*.32,by-sc*.28);_dCtx.lineTo(bx-sc*.38,by-sc*.24);_dCtx.lineTo(bx-sc*.32,by-sc*.22);_dCtx.closePath();_dCtx.fill();
    // 눈
    _dCtx.fillStyle='#f0f0f0';_dc(bx-sc*.26,by-sc*.3,sc*.05);_dCtx.fill();
    _dCtx.fillStyle='#1a1a1a';_dc(bx-sc*.27,by-sc*.3,sc*.03);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,255,255,.6)';_dc(bx-sc*.28,by-sc*.32,sc*.015);_dCtx.fill();
  };

  // 닭 3마리 (왼쪽부터, 조금씩 다른 색과 크기)
  drawChicken(cx-s*.4, cy+s*.1,  s*.78, '#f0efe0','#d8d7c8','#e02010'); // 흰 닭
  drawChicken(cx+s*.06,cy+s*.12, s*.72, '#e0b820','#c89a10','#e02010'); // 황금 닭
  drawChicken(cx+s*.46,cy+s*.08, s*.68, '#c05018','#a84010','#d01808'); // 갈색 닭
}

// d_y40: 양 (2×1)
function _dSheep(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.24)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.78,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 풀밭 기반
  _dCtx.fillStyle='#4a7820';_drr(cx-s*.8,cy+s*.34,s*1.6,s*.26,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#5a8a28';_drr(cx-s*.76,cy+s*.3,s*1.52,s*.16,s*.06);_dCtx.fill();

  // ── 다리 4개 (먼저 — 몸 아래에서 나오게) ──
  _dCtx.fillStyle='#3a3028';
  // 앞다리 2개
  _drr(cx-s*.44,cy+s*.14,s*.12,s*.28,s*.04);_dCtx.fill();
  _drr(cx-s*.28,cy+s*.14,s*.12,s*.24,s*.04);_dCtx.fill();
  // 뒷다리 2개
  _drr(cx+s*.2,cy+s*.12,s*.12,s*.28,s*.04);_dCtx.fill();
  _drr(cx+s*.36,cy+s*.12,s*.12,s*.24,s*.04);_dCtx.fill();
  // 다리 밝은 면
  _dCtx.fillStyle='#504840';
  _drr(cx-s*.42,cy+s*.14,s*.06,s*.26,s*.03);_dCtx.fill();
  _drr(cx-s*.26,cy+s*.14,s*.06,s*.22,s*.03);_dCtx.fill();
  _drr(cx+s*.22,cy+s*.12,s*.06,s*.26,s*.03);_dCtx.fill();
  _drr(cx+s*.38,cy+s*.12,s*.06,s*.22,s*.03);_dCtx.fill();
  // 발굽
  _dCtx.fillStyle='#222018';
  [cx-s*.44,cx-s*.28,cx+s*.2,cx+s*.36].forEach(lx=>{
    _drr(lx,cy+s*.38,s*.12,s*.06,s*.03);_dCtx.fill();
  });

  // ── 몸통 (두터운 울 — 겹쳐진 덩어리로 입체감) ──
  // 기저 (가장 어두운 울)
  _dCtx.fillStyle='#c0bcb0';_dCtx.beginPath();_dCtx.ellipse(cx+s*.04,cy-s*.02,s*.62,s*.36,0,0,Math.PI*2);_dCtx.fill();
  // 중간 울 덩어리들 (울퉁불퉁)
  _dCtx.fillStyle='#d8d4c8';
  [[-s*.32,-.06,s*.28,s*.22],[s*.08,-.08,s*.3,s*.24],[s*.42,-.04,s*.22,s*.2],[-s*.04,-.16,s*.26,s*.2],[s*.2,-.18,s*.22,s*.18]].forEach(([dx,dy,rx,ry])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,rx,ry,0,0,Math.PI*2);_dCtx.fill();
  });
  // 밝은 울 (상단 하이라이트)
  _dCtx.fillStyle='#eeeac0';// 크림빛 밝은 면
  _dCtx.fillStyle='#eae6da';
  [[-s*.26,-.12,s*.22,s*.16],[s*.12,-.16,s*.2,s*.15],[s*.42,-.1,s*.16,s*.14]].forEach(([dx,dy,rx,ry])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,rx,ry,0,0,Math.PI*2);_dCtx.fill();
  });

  // ── 꼬리 (뒤쪽, 작은 울 덩어리) ──
  _dCtx.fillStyle='#d8d4c8';_dCtx.beginPath();_dCtx.ellipse(cx+s*.6,cy-s*.04,s*.12,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#eae6da';_dCtx.beginPath();_dCtx.ellipse(cx+s*.58,cy-s*.06,s*.09,s*.08,0,0,Math.PI*2);_dCtx.fill();

  // ── 목 ──
  _dCtx.fillStyle='#3a3028';_drr(cx-s*.52,cy-s*.12,s*.18,s*.22,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#504840';_drr(cx-s*.5,cy-s*.1,s*.1,s*.18,s*.04);_dCtx.fill();

  // ── 머리 (검은/어두운 갈색, 뚜렷한 형태) ──
  // 머리 기저
  _dCtx.fillStyle='#2e2820';_dCtx.beginPath();_dCtx.ellipse(cx-s*.66,cy-s*.14,s*.22,s*.17,-.1,0,Math.PI*2);_dCtx.fill();
  // 주둥이 부분 (약간 돌출)
  _dCtx.fillStyle='#3a3228';_dCtx.beginPath();_dCtx.ellipse(cx-s*.8,cy-s*.1,s*.12,s*.1,.2,0,Math.PI*2);_dCtx.fill();
  // 밝은 면
  _dCtx.fillStyle='#484038';_dCtx.beginPath();_dCtx.ellipse(cx-s*.68,cy-s*.18,s*.14,s*.1,-.2,0,Math.PI*2);_dCtx.fill();
  // 귀 (옆으로 처진)
  _dCtx.fillStyle='#3a3028';_dCtx.beginPath();_dCtx.ellipse(cx-s*.58,cy-s*.26,s*.1,s*.06,-.6,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a5848';_dCtx.beginPath();_dCtx.ellipse(cx-s*.58,cy-s*.26,s*.07,s*.04,-.6,0,Math.PI*2);_dCtx.fill();
  // 눈 (흰자 + 동공)
  _dCtx.fillStyle='#e8e0d0';_dc(cx-s*.74,cy-s*.16,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#1a1410';_dc(cx-s*.75,cy-s*.16,s*.04);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.7)';_dc(cx-s*.77,cy-s*.18,s*.015);_dCtx.fill();
  // 콧구멍
  _dCtx.fillStyle='#1a1208';_dc(cx-s*.84,cy-s*.06,s*.025);_dCtx.fill();
  _dc(cx-s*.8,cy-s*.06,s*.025);_dCtx.fill();
}

// ── 꽃 다양화 ──────────────────────────────────────────────

// d_y41: 라벤더 화단 (1×1)
function _dLavender(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.6,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 흙 기반
  _dCtx.fillStyle='#6a4820';_drr(cx-s*.62,cy+s*.4,s*1.24,s*.36,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#825a30';_drr(cx-s*.58,cy+s*.36,s*1.16,s*.24,s*.06);_dCtx.fill();
  // 줄기들 (7개)
  [-.54,-.36,-.18,.0,.18,.36,.54].forEach((dx,i)=>{
    const bend=(i%2?s*.04:-s*.04);
    _dCtx.strokeStyle='#5a7820';_dCtx.lineWidth=s*.06;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx*s,cy+s*.36);_dCtx.quadraticCurveTo(cx+dx*s+bend,cy,cx+dx*s+bend*.5,cy-s*.42);_dCtx.stroke();
    // 라벤더 꽃 이삭
    for(let j=0;j<5;j++){
      const fy=cy-s*.22-j*s*.06;
      _dCtx.fillStyle=j<2?'#b070e0':'#9058c8';_dc(cx+dx*s+bend*.5,fy,s*.05);_dCtx.fill();
      _dCtx.fillStyle=j<2?'#c880f0':'#a068d8';_dc(cx+dx*s+bend*.5-s*.03,fy-s*.02,s*.03);_dCtx.fill();
    }
  });
}

// d_y42: 데이지 화단 (1×1)
function _dDaisy(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.6,s*.11,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a4820';_drr(cx-s*.62,cy+s*.4,s*1.24,s*.36,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#2a6818';_drr(cx-s*.6,cy+s*.08,s*1.2,s*.36,s*.06);_dCtx.fill();
  // 잎
  _dCtx.fillStyle='#3a8020';
  [[-s*.4,s*.2,-.3],[s*.36,s*.16,.3],[-s*.1,s*.28,0],[s*.1,s*.1,.2]].forEach(([dx,dy,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.14,s*.07,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 데이지 꽃들 (5개)
  [[-s*.42,-s*.3],[-s*.2,-s*.42],[s*.06,-s*.36],[s*.3,-s*.28],[s*.5,-s*.44]].forEach(([dx,dy])=>{
    // 흰 꽃잎 (8개)
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      _dCtx.fillStyle='#f0f0e8';_dCtx.beginPath();_dCtx.ellipse(cx+dx+Math.cos(a)*s*.13,cy+dy+Math.sin(a)*s*.13,s*.07,s*.04,a,0,Math.PI*2);_dCtx.fill();
    }
    _dCtx.fillStyle='#e8c020';_dc(cx+dx,cy+dy,s*.09);_dCtx.fill();
    _dCtx.fillStyle='#f0d830';_dc(cx+dx,cy+dy,s*.06);_dCtx.fill();
  });
}

// d_y43: 장미 B형 (1×1) — 덤불형
function _dRoseB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 잎 바탕
  _dCtx.fillStyle='#1e5a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.12,s*.66,s*.5,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2a7018';_dCtx.beginPath();_dCtx.ellipse(cx-s*.12,cy+s*.04,s*.6,s*.44,0,0,Math.PI*2);_dCtx.fill();
  // 잎 디테일
  _dCtx.fillStyle='#3a8820';
  [[-s*.36,s*.06,-.3],[s*.32,s*.1,.3],[s*.0,-s*.04,0],[-s*.22,-.2,.4]].forEach(([dx,dy,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.16,s*.08,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 장미 꽃봉오리들 (6개, 다양한 크기)
  [[-s*.32,-s*.3,'#c83a5a',s*.18],[-s*.04,-s*.44,'#d04468',s*.16],[s*.3,-s*.34,'#b03050',s*.14],
   [-s*.48,-s*.14,'#d84a60',s*.12],[s*.1,-s*.18,'#e05070',s*.11],[s*.48,-s*.18,'#c83848',s*.1]].forEach(([dx,dy,c,r])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,r);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,200,200,.3)';_dc(cx+dx-r*.3,cy+dy-r*.3,r*.4);_dCtx.fill();
  });
}

// d_y44: 튤립 B형 (1×1) — 더 넓게 피어난 형태
function _dTulipB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.12,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#5a3c1a';_drr(cx-s*.62,cy+s*.38,s*1.24,s*.38,s*.1);_dCtx.fill();
  _dCtx.fillStyle='#7a5430';_drr(cx-s*.58,cy+s*.34,s*1.16,s*.26,s*.08);_dCtx.fill();
  // 줄기 4개
  const tulipCols=['#e03880','#c82468','#e84898','#c02060'];
  [[-s*.44],[-s*.14],[s*.16],[s*.44]].forEach((dx,i)=>{
    _dCtx.strokeStyle='#3a8020';_dCtx.lineWidth=s*.09;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.34);_dCtx.lineTo(cx+dx+(i%2?s*.04:-s*.04),cy-s*.44);_dCtx.stroke();
  });
  // 잎
  _dCtx.fillStyle='#2a7818';
  [[-s*.28,s*.06,.4],[s*.24,s*.02,-.4]].forEach(([dx,dy,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.22,s*.1,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 꽃 (더 활짝 핀 형태)
  [[-s*.44],[-s*.14],[s*.16],[s*.44]].forEach((dx,i)=>{
    const c=tulipCols[i], offset=(i%2?s*.04:-s*.04);
    const fx=cx+dx+offset, fy=cy-s*.46;
    // 바깥 꽃잎
    [-.3,0,.3].forEach(ang=>{
      _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.ellipse(fx+Math.sin(ang)*s*.12,fy-s*.04+Math.cos(ang)*s*.04,s*.1,s*.18,ang,0,Math.PI*2);_dCtx.fill();
    });
    _dCtx.fillStyle='rgba(255,255,255,.15)';_dc(fx-s*.04,fy-s*.1,s*.05);_dCtx.fill();
  });
}

// ── 식생/나무 ──────────────────────────────────────────────

// d_y45: 키 큰 풀숲 (1×1)
function _dTallGrass(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.52,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 풀밭 기반
  _dCtx.fillStyle='#3a6818';_drr(cx-s*.56,cy+s*.44,s*1.12,s*.32,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#4a7c20';_drr(cx-s*.52,cy+s*.4,s*1.04,s*.2,s*.06);_dCtx.fill();
  // 풀 줄기들 — height는 cy 기준 절대좌표 (s 이미 포함)
  const blades=[
    [-s*.42,s*.36,'#2a7018',s*.08, s*.04,cy-s*.44],
    [-s*.26,s*.32,'#368a20',s*.07,-s*.06,cy-s*.52],
    [-s*.1, s*.3, '#2a7018',s*.09, s*.04,cy-s*.56],
    [ s*.06,s*.32,'#3a9422',s*.08,-s*.06,cy-s*.48],
    [ s*.22,s*.28,'#2a7018',s*.07, s*.06,cy-s*.5 ],
    [ s*.38,s*.34,'#368a20',s*.08,-s*.04,cy-s*.44],
    [-s*.34,s*.24,'#1e5a10',s*.06, s*.08,cy-s*.38],
    [ s*.3, s*.22,'#1e5a10',s*.06,-s*.06,cy-s*.36],
    [-s*.18,s*.22,'#4aaa28',s*.07, s*.02,cy-s*.46],
    [ s*.14,s*.24,'#4aaa28',s*.07,-s*.04,cy-s*.42],
  ];
  blades.forEach(([bx,by,c,w,lean,tipY])=>{
    _dCtx.strokeStyle=c;_dCtx.lineWidth=w;_dCtx.lineCap='round';
    _dCtx.beginPath();
    _dCtx.moveTo(cx+bx, cy+by);
    _dCtx.quadraticCurveTo(cx+bx+lean*.4, (cy+by+tipY)*.5, cx+bx+lean, tipY);
    _dCtx.stroke();
  });
  // 씨앗 이삭
  [[-s*.42,-s*.46],[-s*.1,-s*.58],[s*.22,-s*.52],[s*.38,-s*.46]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#c8a820';_dc(cx+dx,cy+dy,s*.04);_dCtx.fill();
  });
}

// d_y46: 작은 침엽수 (2×2) — 크리스마스 트리형
function _dConifer(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.48,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#5a3810';_drr(cx-s*.1,cy+s*.2,s*.2,s*.56,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.06,cy+s*.22,s*.1,s*.52,s*.04);_dCtx.fill();
  // 3단 삼각형 (아래서 위로 좁아짐)
  const tiers=[
    {y:s*.18, w:s*.78, h:s*.32, c:'#1a5010', c2:'#246a18'},
    {y:-s*.14, w:s*.6,  h:s*.3,  c:'#1e6012', c2:'#2a781e'},
    {y:-s*.44, w:s*.44, h:s*.28, c:'#226614', c2:'#307822'},
    {y:-s*.7,  w:s*.3,  h:s*.26, c:'#267018', c2:'#368026'},
  ];
  tiers.forEach(({y,w,h,c,c2})=>{
    _dCtx.fillStyle=c;
    _dCtx.beginPath();_dCtx.moveTo(cx,cy+y-h);_dCtx.lineTo(cx-w,cy+y+h*.3);_dCtx.lineTo(cx+w,cy+y+h*.3);_dCtx.closePath();_dCtx.fill();
    _dCtx.fillStyle=c2;
    _dCtx.beginPath();_dCtx.moveTo(cx,cy+y-h);_dCtx.lineTo(cx-w*.5,cy+y+h*.3);_dCtx.lineTo(cx+w*.5,cy+y+h*.3);_dCtx.closePath();_dCtx.fill();
  });
  // 눈 느낌 하이라이트
  _dCtx.fillStyle='rgba(255,255,255,.12)';
  tiers.forEach(({y,w,h})=>{
    _dCtx.beginPath();_dCtx.moveTo(cx,cy+y-h);_dCtx.lineTo(cx-w*.3,cy+y-h*.2);_dCtx.lineTo(cx,cy+y);_dCtx.closePath();_dCtx.fill();
  });
}

// d_y47: 둥근 큰 나무 B형 (2×2) — 넓고 둥근 실루엣
function _dRoundTreeB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.66,s*.15,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#5a3810';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.46,s*.18,s*.08,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.16,cy-s*.1,s*.32,s*.6,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#9a7030';_drr(cx-s*.1,cy-s*.08,s*.16,s*.56,s*.06);_dCtx.fill();
  // 굵은 가지
  _dCtx.strokeStyle='#6a4020';_dCtx.lineWidth=s*.1;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.08);_dCtx.lineTo(cx-s*.46,cy-s*.44);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.12);_dCtx.lineTo(cx+s*.5,cy-s*.5);_dCtx.stroke();
  // 크라운 (넓고 둥글게 — 올리브/짙은 초록)
  _dCtx.fillStyle='#2a5e0e';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.2,s*.8,s*.56,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#367818';_dCtx.beginPath();_dCtx.ellipse(cx-s*.08,cy-s*.3,s*.72,s*.5,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#428a20';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.4,s*.62,s*.42,0,0,Math.PI*2);_dCtx.fill();
  // 우측 하이라이트
  _dCtx.fillStyle='#4ea028';_dCtx.beginPath();_dCtx.ellipse(cx+s*.28,cy-s*.52,s*.32,s*.22,.3,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.08)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.22,cy-s*.58,s*.14,s*.08,-.2,0,Math.PI*2);_dCtx.fill();
}

// d_y48: 과수나무 (2×2) — 열매 달린 나무
function _dOrchard(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.62,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.46,s*.16,s*.08,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.14,cy-s*.04,s*.28,s*.54,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#9a7030';_drr(cx-s*.08,cy-s*.02,s*.14,s*.5,s*.06);_dCtx.fill();
  _dCtx.strokeStyle='#6a4020';_dCtx.lineWidth=s*.09;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.02);_dCtx.lineTo(cx-s*.44,cy-s*.4);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.06);_dCtx.lineTo(cx+s*.46,cy-s*.44);_dCtx.stroke();
  // 크라운 (중간 초록)
  _dCtx.fillStyle='#286010';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.22,s*.76,s*.54,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#347a18';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06,cy-s*.32,s*.68,s*.48,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#3e8e20';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.42,s*.58,s*.4,0,0,Math.PI*2);_dCtx.fill();
  // 열매들 (빨간 사과)
  [[-s*.3,-s*.24],[-s*.12,-s*.42],[s*.18,-s*.28],[s*.38,-s*.44],[-s*.5,-s*.1],[s*.46,-s*.14],[-s*.22,-s*.06],[s*.14,-s*.08]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#c02020';_dc(cx+dx,cy+dy,s*.08);_dCtx.fill();
    _dCtx.fillStyle='#e03030';_dc(cx+dx-s*.02,cy+dy-s*.02,s*.05);_dCtx.fill();
    // 꼭지
    _dCtx.strokeStyle='#3a5010';_dCtx.lineWidth=s*.025;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy-s*.08);_dCtx.lineTo(cx+dx,cy+dy-s*.14);_dCtx.stroke();
  });
}

// ══════════════════════════════════════════════════════════
// ── 신규 장식 드로우 함수 ──────────────────────────────────
// ══════════════════════════════════════════════════════════

// ── 공원/정원 테마 ─────────────────────────────────────────

// d_y15: 낮은 관목 (1×1)
function _dBush(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.62,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 본체 — 3개 반구 합쳐서 칸 꽉 채움
  _dCtx.fillStyle='#1e6010';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.08,s*.72,s*.52,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2a8018';_dCtx.beginPath();_dCtx.ellipse(cx-s*.22,cy-s*.06,s*.52,s*.42,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2a8018';_dCtx.beginPath();_dCtx.ellipse(cx+s*.22,cy-s*.02,s*.5,s*.4,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#3a9a22';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.16,s*.56,s*.42,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#4aaa28';_dCtx.beginPath();_dCtx.ellipse(cx-s*.14,cy-s*.28,s*.36,s*.28,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#4aaa28';_dCtx.beginPath();_dCtx.ellipse(cx+s*.16,cy-s*.24,s*.34,s*.26,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.08)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.18,cy-s*.38,s*.1,s*.06,-.4,0,Math.PI*2);_dCtx.fill();
}

// d_y16: 큰 화단 (2×2)
function _dLargePlanter(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 화단 테두리 — 낮은 돌 경계 (높이 줄임)
  _dCtx.fillStyle='#7a7060';_drr(cx-s*.84,cy+s*.44,s*1.68,s*.32,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#9a9080';_drr(cx-s*.8,cy+s*.4,s*1.6,s*.2,s*.06);_dCtx.fill();
  // 흙
  _dCtx.fillStyle='#5a3c1e';_drr(cx-s*.76,cy-s*.02,s*1.52,s*.44,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#6a4c2a';_drr(cx-s*.72,cy-s*.04,s*1.44,s*.34,s*.04);_dCtx.fill();
  // 잎/줄기 바닥 (녹색 배경)
  _dCtx.fillStyle='#2a6818';_drr(cx-s*.7,cy-s*.24,s*1.4,s*.28,s*.04);_dCtx.fill();
  // 꽃들 — 작은 꽃 여러 송이, 덜 쨍한 색
  const flowers=[
    [-s*.58,-s*.42,'#d45080',s*.11],[-s*.32,-s*.5,'#c06840',s*.1],[-s*.06,-s*.44,'#d06050',s*.12],
    [s*.2,-s*.48,'#9050a8',s*.1],[s*.46,-s*.42,'#c0a030',s*.11],
    [-s*.46,-s*.28,'#b84068',s*.09],[-.14,-s*.3,'#a84030',s*.1],[s*.14,-s*.26,'#7848a0',s*.09],[s*.44,-s*.3,'#b89030',s*.09],
    [-s*.62,-s*.36,'#3a7830',s*.07],[s*.58,-s*.36,'#3a7830',s*.07],// 잎
  ];
  flowers.forEach(([dx,dy,c,r])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,r);_dCtx.fill();
  });
  // 꽃 중심점 (밝게)
  [[-s*.58,-s*.42],[-s*.32,-s*.5],[-s*.06,-s*.44],[s*.2,-s*.48],[s*.46,-s*.42],[-s*.46,-s*.28],[-.14,-s*.3],[s*.14,-s*.26],[s*.44,-s*.3]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='rgba(255,240,200,.6)';_dc(cx+dx,cy+dy,s*.04);_dCtx.fill();
  });
}

// d_y17: 정자 (2×2) — 한국식 정자
function _dGazebo(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.82,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#9a9080';_drr(cx-s*.68,cy+s*.36,s*1.36,s*.38,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#b0a898';_drr(cx-s*.64,cy+s*.3,s*1.28,s*.26,s*.04);_dCtx.fill();
  // 기둥 4개
  [[-s*.56],[s*.56]].forEach(dx=>{
    _dCtx.fillStyle='#7a5010';_drr(cx+dx-s*.08,cy-s*.32,s*.16,s*.66,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#9a6820';_drr(cx+dx-s*.04,cy-s*.3,s*.06,s*.62,s*.02);_dCtx.fill();
    // 기둥 접지 그림자
    _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+s*.35,s*.14,s*.05,0,0,Math.PI*2);_dCtx.fill();
  });
  // 지붕 (기와형 — 2중)
  _dCtx.fillStyle='#2a5a1a';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.98);_dCtx.lineTo(cx-s*.82,cy-s*.32);_dCtx.lineTo(cx+s*.82,cy-s*.32);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#3a7a28';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.74,cy-s*.28);_dCtx.lineTo(cx+s*.74,cy-s*.28);_dCtx.closePath();_dCtx.fill();
  // 처마 (끝 들림)
  _dCtx.fillStyle='#4a9a36';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.84,cy-s*.32);_dCtx.lineTo(cx-s*.96,cy-s*.42);_dCtx.lineTo(cx-s*.72,cy-s*.28);_dCtx.closePath();_dCtx.fill();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.84,cy-s*.32);_dCtx.lineTo(cx+s*.96,cy-s*.42);_dCtx.lineTo(cx+s*.72,cy-s*.28);_dCtx.closePath();_dCtx.fill();
  // 지붕 기와 선
  _dCtx.strokeStyle='rgba(0,0,0,.15)';_dCtx.lineWidth=s*.03;
  [-.5,0,.5].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s*.8,cy-s*.32);_dCtx.lineTo(cx,cy-s*.88);_dCtx.stroke();});
  // 지붕 꼭대기
  _dCtx.fillStyle='#8a5010';_drr(cx-s*.08,cy-s*1.02,s*.16,s*.12,s*.04);_dCtx.fill();
}

// d_y18: 돌 벤치 (2×1)
function _dStoneBench(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.7,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // ★ 2×1이라 X가 2배 스케일됨 → x좌표를 절반으로 줘야 화면에서 정상 비율
  // 다리 왼쪽 (스크린상 왼쪽 끝 부근)
  _dCtx.fillStyle='#6a6858';_drr(cx-s*.46,cy+s*.08,s*.22,s*.46,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_drr(cx-s*.44,cy+s*.06,s*.14,s*.3,s*.04);_dCtx.fill();
  // 다리 오른쪽
  _dCtx.fillStyle='#6a6858';_drr(cx+s*.24,cy+s*.08,s*.22,s*.46,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_drr(cx+s*.26,cy+s*.06,s*.14,s*.3,s*.04);_dCtx.fill();
  // 좌석 판 (두꺼운 돌)
  _dCtx.fillStyle='#7a7868';_drr(cx-s*.52,cy-s*.26,s*1.04,s*.34,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_drr(cx-s*.5,cy-s*.34,s*1.0,s*.22,s*.05);_dCtx.fill();
  // 판 표면 질감
  _dCtx.strokeStyle='rgba(0,0,0,.12)';_dCtx.lineWidth=s*.03;
  [-s*.12,s*.14].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.34);_dCtx.lineTo(cx+dx,cy-s*.12);_dCtx.stroke();
  });
  // 하단 어두운 면 (두께감)
  _dCtx.fillStyle='#5a5848';_drr(cx-s*.52,cy+s*.06,s*1.04,s*.08,s*.02);_dCtx.fill();
}

// d_y19: 큰 나무 B형 (2×2) — 넓은 우산형
function _dTreeB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.72,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.2,s*.08,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.14,cy-s*.16,s*.28,s*.62,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#9a7030';_drr(cx-s*.08,cy-s*.14,s*.1,s*.58,s*.04);_dCtx.fill();
  // 크라운 — 넓은 우산형, 짙은 초록
  _dCtx.fillStyle='#1a5a08';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.12,s*.84,s*.38,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#226a10';_dCtx.beginPath();_dCtx.ellipse(cx-s*.1,cy-s*.22,s*.76,s*.34,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2e8018';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.32,s*.68,s*.3,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#3a9020';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06,cy-s*.42,s*.54,s*.24,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.1)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.22,cy-s*.5,s*.16,s*.08,-.3,0,Math.PI*2);_dCtx.fill();
}

// d_y20: 조형 분수 (3×3)
function _dOrnamentalFountain(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.92,s*.17,0,0,Math.PI*2);_dCtx.fill();
  // 큰 분지
  _dCtx.fillStyle='#6a6858';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.52,s*.92,s*.22,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.4,s*.92,s*.22,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(30,106,180,.95)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.34,s*.8,s*.18,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(80,160,230,.6)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.3,s*.68,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 중간 단
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.04,s*.46,s*.12,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.02,s*.46,s*.12,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(30,106,180,.8)';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.08,s*.38,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#7a7868';_drr(cx-s*.09,cy-s*.46,s*.18,s*.52,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#aaa898';_drr(cx-s*.05,cy-s*.44,s*.08,s*.48,s*.04);_dCtx.fill();
  // 물줄기 (5개)
  _dCtx.strokeStyle='rgba(135,206,235,.92)';_dCtx.lineWidth=s*.09;
  [[-s*.38,-s*.92],[s*.38,-s*.9],[0,-s*.98],[-s*.22,-s*.84],[s*.22,-s*.84]].forEach(([ex,ey])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.44);
    _dCtx.quadraticCurveTo(cx+ex*.4,cy-s*.7,cx+ex,cy+ey+s*.98);_dCtx.stroke();
  });
  // 조각상 (위)
  _dCtx.fillStyle='#9a9888';_dc(cx,cy-s*.56,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#b8b8a8';_dc(cx,cy-s*.56,s*.08);_dCtx.fill();
}

// d_y21: 장미 아치 (1×3, 세로로 긴 구조물)
function _dRoseArch(cx,cy,s){
  // 바닥 그림자 (기둥 2개 위치에 맞게 넓게)
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.84,s*.58,s*.12,0,0,Math.PI*2);_dCtx.fill();

  // ── 기둥 2개 (확실히 구분되게, 굵게) ──
  [[-s*.36],[s*.36]].forEach(dx=>{
    // 기둥 기저 (넓은 받침)
    _dCtx.fillStyle='#5a3c0e';_drr(cx+dx-s*.12,cy+s*.62,s*.24,s*.24,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#7a5420';_drr(cx+dx-s*.1,cy+s*.6,s*.2,s*.18,s*.03);_dCtx.fill();
    // 기둥 몸체 (두껍게)
    _dCtx.fillStyle='#6a4a12';_drr(cx+dx-s*.1,cy-s*.82,s*.2,s*1.46,s*.05);_dCtx.fill();
    _dCtx.fillStyle='#8a6428';_drr(cx+dx-s*.07,cy-s*.8,s*.12,s*1.42,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#9a7438';_drr(cx+dx-s*.05,cy-s*.76,s*.06,s*1.34,s*.03);_dCtx.fill();
  });

  // ── 아치 프레임 상단 (곡선) ──
  // 가로 직선 부분
  _dCtx.fillStyle='#6a4a12';_drr(cx-s*.42,cy-s*.86,s*.84,s*.16,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#8a6428';_drr(cx-s*.38,cy-s*.92,s*.76,s*.1,s*.05);_dCtx.fill();
  // 곡선 아치 (bezier)
  _dCtx.strokeStyle='#6a4a12';_dCtx.lineWidth=s*.14;_dCtx.lineCap='round';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.34,cy-s*.84);
  _dCtx.quadraticCurveTo(cx,cy-s*1.16,cx+s*.34,cy-s*.84);
  _dCtx.stroke();
  _dCtx.strokeStyle='#8a6428';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.3,cy-s*.84);
  _dCtx.quadraticCurveTo(cx,cy-s*1.1,cx+s*.3,cy-s*.84);
  _dCtx.stroke();

  // ── 덩굴/잎 (아치를 타고 오르게) ──
  _dCtx.fillStyle='#246014';
  // 왼쪽 기둥 덩굴
  [[-s*.42,-s*.62],[-s*.44,-s*.38],[-s*.4,-s*.14],[-s*.38,s*.12],[-s*.42,s*.36]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.16,s*.09,(dy<0?.3:-.3),0,Math.PI*2);_dCtx.fill();
  });
  // 오른쪽 기둥 덩굴
  [[s*.42,-s*.58],[s*.44,-s*.34],[s*.4,-s*.1],[s*.38,s*.14],[s*.42,s*.38]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.16,s*.09,(dy<0?-.3:.3),0,Math.PI*2);_dCtx.fill();
  });
  // 아치 상단 덩굴
  _dCtx.fillStyle='#2e7a1c';
  [[-s*.2,-s*.96],[s*.0,-s*1.06],[s*.2,-s*.96],[-s*.38,-s*.82],[s*.38,-s*.82]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.14,s*.09,0,0,Math.PI*2);_dCtx.fill();
  });

  // ── 장미꽃 (기둥 + 아치 상단에 분포) ──
  // 왼쪽 기둥 꽃
  [[-s*.46,-s*.5,'#c82a42'],[-s*.4,-.1*s,'#d83650'],[-s*.44,s*.28,'#b82038']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.13);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,180,190,.5)';_dc(cx+dx-s*.04,cy+dy-s*.04,s*.07);_dCtx.fill();
  });
  // 오른쪽 기둥 꽃
  [[s*.44,-s*.44,'#d83250'],[s*.4,-s*.06,'#c82a42'],[s*.44,s*.3,'#b81e36']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.13);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,180,190,.5)';_dc(cx+dx-s*.04,cy+dy-s*.04,s*.07);_dCtx.fill();
  });
  // 아치 상단 꽃
  [[-s*.16,-s*.98,'#e83458'],[s*.16,-s*.96,'#d82a4a'],[s*.0,-s*1.04,'#c82040']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.14);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,180,190,.5)';_dc(cx+dx-s*.04,cy+dy-s*.04,s*.08);_dCtx.fill();
  });
}

// ── 농촌 테마 ───────────────────────────────────────────────

// d_y22: 나무상자 (1×1)
function _dWoodenCrate(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.58,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 상자 본체
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.52,cy-s*.38,s*1.04,s*.98,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.48,cy-s*.44,s*.96,s*.84,s*.05);_dCtx.fill();
  // 판자 선
  _dCtx.strokeStyle='#7a5010';_dCtx.lineWidth=s*.04;
  [-s*.14,s*.14].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.44);_dCtx.lineTo(cx+dx,cy+s*.42);_dCtx.stroke();});
  // 가로 띠
  _dCtx.strokeStyle='#6a4010';_dCtx.lineWidth=s*.06;
  [-s*.04,s*.24].forEach(dy=>{_dCtx.beginPath();_dCtx.moveTo(cx-s*.48,cy+dy);_dCtx.lineTo(cx+s*.48,cy+dy);_dCtx.stroke();});
  // 상단면
  _dCtx.fillStyle='#c8a050';_drr(cx-s*.48,cy-s*.5,s*.96,s*.12,s*.04);_dCtx.fill();
}

// d_y23: 장작더미 A형 (1×1)
function _dLogPile(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.64,s*.64,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 통나무 3단 쌓기 — 옆으로 눕힌 형태, 높낮이 차이
  // 맨 아래 단 (2개, 나란히)
  const logH=s*.22, logW=s*.54;
  [[-s*.24,s*.28],[s*.22,s*.22]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#7a4a18';_drr(cx+dx-logW*.5,cy+dy-logH*.5,logW,logH,s*.05);_dCtx.fill();
    _dCtx.fillStyle='#9a6428';_drr(cx+dx-logW*.5,cy+dy-logH*.5,logW,logH*.5,s*.04);_dCtx.fill();
    // 나뭇결
    _dCtx.strokeStyle='#6a3a10';_dCtx.lineWidth=s*.025;
    [.25,.5,.75].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx-logW*.5+logW*t,cy+dy-logH*.5);_dCtx.lineTo(cx+dx-logW*.5+logW*t,cy+dy+logH*.5);_dCtx.stroke();});
    // 끝면 (원형 단면)
    _dCtx.fillStyle='#6a3810';_dCtx.beginPath();_dCtx.ellipse(cx+dx+logW*.48,cy+dy,s*.09,logH*.44,0,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#c88040';_dCtx.beginPath();_dCtx.ellipse(cx+dx+logW*.48,cy+dy,s*.06,logH*.3,0,0,Math.PI*2);_dCtx.fill();
  });
  // 가운데 단 (1개, 약간 엇갈려)
  const mx=cx-s*.02, my=cy+s*.02;
  _dCtx.fillStyle='#8a5420';_drr(mx-logW*.55,my-logH*.5,logW*1.1,logH,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#aa7030';_drr(mx-logW*.55,my-logH*.5,logW*1.1,logH*.45,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a3a10';_dCtx.lineWidth=s*.025;
  [.2,.45,.7].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(mx-logW*.55+logW*1.1*t,my-logH*.5);_dCtx.lineTo(mx-logW*.55+logW*1.1*t,my+logH*.5);_dCtx.stroke();});
  _dCtx.fillStyle='#6a3810';_dCtx.beginPath();_dCtx.ellipse(mx+logW*.52,my,s*.09,logH*.44,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#c88040';_dCtx.beginPath();_dCtx.ellipse(mx+logW*.52,my,s*.06,logH*.3,0,0,Math.PI*2);_dCtx.fill();
  // 맨 위 단 (1개)
  const ty=cy-s*.28;
  _dCtx.fillStyle='#8a5420';_drr(cx-logW*.48,ty-logH*.45,logW*.96,logH*.9,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#b07838';_drr(cx-logW*.48,ty-logH*.45,logW*.96,logH*.38,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a3a10';_dCtx.lineWidth=s*.025;
  [.3,.6].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx-logW*.48+logW*.96*t,ty-logH*.45);_dCtx.lineTo(cx-logW*.48+logW*.96*t,ty+logH*.45);_dCtx.stroke();});
  _dCtx.fillStyle='#6a3810';_dCtx.beginPath();_dCtx.ellipse(cx+logW*.45,ty,s*.09,logH*.4,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#c88040';_dCtx.beginPath();_dCtx.ellipse(cx+logW*.45,ty,s*.06,logH*.28,0,0,Math.PI*2);_dCtx.fill();
}

// d_y24: 건초더미 (1×1)
function _dHayBale(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.62,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 원통형 건초
  _dCtx.fillStyle='#c8a020';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.1,s*.56,s*.56,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#e0b828';_dCtx.beginPath();_dCtx.ellipse(cx,cy,s*.48,s*.48,0,0,Math.PI*2);_dCtx.fill();
  // 끈
  _dCtx.strokeStyle='#8a6010';_dCtx.lineWidth=s*.06;
  [-s*.2,s*.2].forEach(dx=>{_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+s*.08,s*.06,s*.48,0,0,Math.PI*2);_dCtx.stroke();});
  // 앞면 끈
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.56,cy);_dCtx.lineTo(cx+s*.56,cy);_dCtx.stroke();
  // 짚 결
  _dCtx.strokeStyle='rgba(255,200,40,.4)';_dCtx.lineWidth=s*.02;
  for(let i=0;i<8;i++){
    _dCtx.beginPath();_dCtx.moveTo(cx-s*.46+i*s*.12,cy-s*.44);_dCtx.lineTo(cx-s*.46+i*s*.12,cy+s*.52);_dCtx.stroke();
  }
}

// d_y25: 밀밭 (2×2)
function _dWheatField(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 흙 (밝은 갈색 기본)
  _dCtx.fillStyle='#8a6030';_drr(cx-s*.84,cy+s*.14,s*1.68,s*.62,s*.06);_dCtx.fill();
  // 흙 질감 (얼룩)
  _dCtx.fillStyle='#7a5228';_dCtx.beginPath();_dCtx.ellipse(cx-s*.4,cy+s*.36,s*.32,s*.16,-.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a7040';_dCtx.beginPath();_dCtx.ellipse(cx+s*.3,cy+s*.5,s*.28,s*.13,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5228';_dCtx.beginPath();_dCtx.ellipse(cx+s*.6,cy+s*.28,s*.2,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 밭고랑 선
  _dCtx.strokeStyle='#6a4820';_dCtx.lineWidth=s*.04;
  [-s*.5,-s*.16,s*.18,s*.52].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.76);_dCtx.lineTo(cx+dx+s*.04,cy+s*.14);_dCtx.stroke();
  });
  // 밀 줄기 (약간 불규칙하게)
  const stems=[
    [-s*.62,s*.1, s*.03],[-s*.4, s*.06,-s*.02],[-s*.18,s*.1, s*.04],[s*.06, s*.06,-s*.03],
    [s*.28, s*.08, s*.02],[s*.5,  s*.04,-s*.04],[s*.7,  s*.1, s*.03],
    [-s*.5, s*.34, s*.04],[-s*.28,s*.3,-s*.02],[-s*.06,s*.32, s*.03],[s*.16, s*.28,-s*.04],
    [s*.38, s*.3,  s*.02],[s*.6,  s*.32,-s*.03],
  ];
  stems.forEach(([dx,dy,lean])=>{
    _dCtx.strokeStyle='#b89820';_dCtx.lineWidth=s*.055;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx+lean,cy+dy-s*.24);_dCtx.stroke();
    // 이삭
    _dCtx.fillStyle='#d4aa22';_drr(cx+dx+lean-s*.05,cy+dy-s*.38,s*.1,s*.16,s*.05);_dCtx.fill();
    _dCtx.fillStyle='#eecc38';_drr(cx+dx+lean-s*.03,cy+dy-s*.36,s*.06,s*.1,s*.03);_dCtx.fill();
  });
}

// d_y26: 큰 바위 (2×1)
function _dLargeRock(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.86,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 바위 기저 (가장 어두운)
  _dCtx.fillStyle='#565448';_dCtx.beginPath();_dCtx.ellipse(cx+s*.04,cy+s*.18,s*.82,s*.44,.05,0,Math.PI*2);_dCtx.fill();
  // 메인 바위 몸체 (불규칙 다각형 느낌)
  _dCtx.fillStyle='#7a7868';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.74,cy+s*.22);
  _dCtx.lineTo(cx-s*.82,cy-s*.04);
  _dCtx.lineTo(cx-s*.6,cy-s*.26);
  _dCtx.lineTo(cx-s*.22,cy-s*.38);
  _dCtx.lineTo(cx+s*.18,cy-s*.34);
  _dCtx.lineTo(cx+s*.58,cy-s*.2);
  _dCtx.lineTo(cx+s*.8,cy+s*.04);
  _dCtx.lineTo(cx+s*.72,cy+s*.26);
  _dCtx.closePath();_dCtx.fill();
  // 중간 면 (밝게)
  _dCtx.fillStyle='#9a9888';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.72,cy-s*.02);
  _dCtx.lineTo(cx-s*.56,cy-s*.24);
  _dCtx.lineTo(cx-s*.16,cy-s*.36);
  _dCtx.lineTo(cx+s*.16,cy-s*.32);
  _dCtx.lineTo(cx+s*.54,cy-s*.18);
  _dCtx.lineTo(cx+s*.6,cy+s*.06);
  _dCtx.lineTo(cx-s*.68,cy+s*.08);
  _dCtx.closePath();_dCtx.fill();
  // 하이라이트 면 (상단 왼쪽)
  _dCtx.fillStyle='#b0ae9c';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.56,cy-s*.24);
  _dCtx.lineTo(cx-s*.26,cy-s*.36);
  _dCtx.lineTo(cx+s*.06,cy-s*.32);
  _dCtx.lineTo(cx-s*.06,cy-s*.2);
  _dCtx.lineTo(cx-s*.46,cy-s*.12);
  _dCtx.closePath();_dCtx.fill();
  // 균열선
  _dCtx.strokeStyle='rgba(0,0,0,.22)';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.1,cy-s*.32);_dCtx.lineTo(cx+s*.06,cy+s*.1);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.3,cy-s*.22);_dCtx.lineTo(cx+s*.52,cy+s*.1);_dCtx.stroke();
  // 이끼
  _dCtx.fillStyle='rgba(50,110,20,.45)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.4,cy+s*.12,s*.24,s*.1,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(50,110,20,.3)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.5,cy+s*.1,s*.18,s*.08,-.2,0,Math.PI*2);_dCtx.fill();
}

function _dWell(cx,cy,s){
  // 바닥 그림자 (기단에 맞게)
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 돌 기단 — 두께감 (기존보다 작게, 구조물 부각)
  _dCtx.fillStyle='#6a6050';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.55,s*.56,s*.18,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#b0a090';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.56,s*.18,0,0,Math.PI*2);_dCtx.fill();
  // 기단 측면 연결
  _dCtx.fillStyle='#8a7a68';_drr(cx-s*.56,cy+s*.44,s*1.12,s*.11,0);_dCtx.fill();
  _dCtx.fillStyle='#b0a090';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.56,s*.18,0,0,Math.PI*2);_dCtx.fill();
  // 내부 (물)
  _dCtx.fillStyle='#1a4a7a';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.36,s*.42,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2870b0';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.33,s*.42,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.2)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.14,cy+s*.31,s*.14,s*.04,0,0,Math.PI*2);_dCtx.fill();
  // 기단 테두리 질감
  _dCtx.strokeStyle='rgba(0,0,0,.15)';_dCtx.lineWidth=s*.03;
  [-s*.2,s*.2].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.28);_dCtx.lineTo(cx+dx,cy+s*.62);_dCtx.stroke();});
  // 기둥 접지 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.44,cy+s*.44,s*.12,s*.04,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.44,cy+s*.44,s*.12,s*.04,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 좌
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.52,cy-s*.64,s*.18,s*1.1,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx-s*.5,cy-s*.62,s*.1,s*1.06,s*.04);_dCtx.fill();
  // 기둥 우
  _dCtx.fillStyle='#7a5010';_drr(cx+s*.34,cy-s*.64,s*.18,s*1.1,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx+s*.36,cy-s*.62,s*.1,s*1.06,s*.04);_dCtx.fill();
  // 가로대
  _dCtx.fillStyle='#6a4010';_drr(cx-s*.58,cy-s*.68,s*1.16,s*.2,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx-s*.56,cy-s*.74,s*1.12,s*.12,s*.04);_dCtx.fill();
  // 지붕
  _dCtx.fillStyle='#a83010';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.98);_dCtx.lineTo(cx-s*.64,cy-s*.68);_dCtx.lineTo(cx+s*.64,cy-s*.68);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#c84020';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.56,cy-s*.68);_dCtx.lineTo(cx+s*.56,cy-s*.68);_dCtx.closePath();_dCtx.fill();
  _dCtx.strokeStyle='#7a2008';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.56,cy-s*.68);_dCtx.lineTo(cx+s*.56,cy-s*.68);_dCtx.closePath();_dCtx.stroke();
  // 기와선
  [-.28,.28].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s,cy-s*.68);_dCtx.lineTo(cx,cy-s*.88);_dCtx.stroke();});
  // 도르래
  _dCtx.fillStyle='#5a3808';_drr(cx-s*.1,cy-s*.74,s*.2,s*.1,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#7a5818';_dc(cx,cy-s*.69,s*.09);_dCtx.fill();
  _dCtx.fillStyle='#3a2008';_dc(cx,cy-s*.69,s*.04);_dCtx.fill();
  // 두레박 줄 + 두레박
  _dCtx.strokeStyle='#4a3008';_dCtx.lineWidth=s*.06;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.64);_dCtx.lineTo(cx+s*.08,cy+s*.22);_dCtx.stroke();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.04,cy+s*.2,s*.24,s*.2,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.04,cy+s*.2,s*.24,s*.09,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#5a3808';_drr(cx-s*.06,cy+s*.18,s*.28,s*.05,s*.02);_dCtx.fill();
}

// d_y28: 헛간 (3×2)
function _dBarn(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.62,s*.92,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#9a9080';_drr(cx-s*.86,cy+s*.3,s*1.72,s*.34,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#b0a898';_drr(cx-s*.82,cy+s*.26,s*1.64,s*.22,s*.04);_dCtx.fill();
  // 벽면
  _dCtx.fillStyle='#9a3018';_drr(cx-s*.82,cy-s*.44,s*1.64,s*.74,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#b83c22';_drr(cx-s*.78,cy-s*.48,s*1.56,s*.62,s*.03);_dCtx.fill();
  // 판자 선
  _dCtx.strokeStyle='#8a2810';_dCtx.lineWidth=s*.04;
  [-s*.5,-s*.16,s*.18,s*.52].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.48);_dCtx.lineTo(cx+dx,cy+s*.26);_dCtx.stroke();});
  // 큰 문
  _dCtx.fillStyle='#5a3010';_drr(cx-s*.3,cy-s*.16,s*.6,s*.44,s*.04);_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.4)';_drr(cx-s*.28,cy-s*.14,s*.56,s*.4,s*.03);_dCtx.fill();
  _dCtx.strokeStyle='#8a6020';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.16);_dCtx.lineTo(cx,cy+s*.28);_dCtx.stroke();
  // X 빗장
  _dCtx.strokeStyle='#8a6020';_dCtx.lineWidth=s*.06;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.28,cy-s*.14);_dCtx.lineTo(cx,cy+s*.26);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.14);_dCtx.lineTo(cx-s*.28,cy+s*.26);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.14);_dCtx.lineTo(cx+s*.28,cy+s*.26);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.28,cy-s*.14);_dCtx.lineTo(cx,cy+s*.26);_dCtx.stroke();
  // 지붕 (삼각)
  _dCtx.fillStyle='#5a3a18';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.92);_dCtx.lineTo(cx-s*.9,cy-s*.44);_dCtx.lineTo(cx+s*.9,cy-s*.44);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7a5228';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.82);_dCtx.lineTo(cx-s*.8,cy-s*.44);_dCtx.lineTo(cx+s*.8,cy-s*.44);_dCtx.closePath();_dCtx.fill();
  // 지붕 선
  _dCtx.strokeStyle='#4a2a10';_dCtx.lineWidth=s*.03;
  [-.5,0,.5].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s*.7,cy-s*.44);_dCtx.lineTo(cx,cy-s*.82);_dCtx.stroke();});
  // 환기창
  _dCtx.fillStyle='#2a1808';_drr(cx-s*.12,cy-s*.76,s*.24,s*.2,s*.06);_dCtx.fill();
}

// ── 연못/물가 테마 ──────────────────────────────────────────

// d_y29: 갈대 묶음 (1×1)
function _dReed(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.62,s*.44,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 줄기들
  [[0,0,'#8a7020'],[-s*.24,.04,'#9a7828'],[s*.22,.06,'#887020'],[-s*.12,s*.02,'#9a7828'],[s*.1,.08,'#807018']].forEach(([dx,bot,c])=>{
    _dCtx.strokeStyle=c;_dCtx.lineWidth=s*.08;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+bot+s*.32);
    _dCtx.quadraticCurveTo(cx+dx+s*.06*(dx>0?1:-1),cy-s*.2,cx+dx+s*.04*(dx>0?1:-1),cy-s*.7);
    _dCtx.stroke();
  });
  // 이삭 (솜털)
  [[0,-s*.7,'#8a6018'],[-s*.22,-s*.64,'#9a7020'],[s*.2,-s*.68,'#887018'],[-s*.1,-s*.56,'#9a7020'],[s*.08,-s*.62,'#807018']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_drr(cx+dx-s*.04,cy+dy-s*.12,s*.08,s*.18,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#c0a030';_drr(cx+dx-s*.02,cy+dy-s*.1,s*.04,s*.12,s*.02);_dCtx.fill();
  });
}

// d_y30: 징검돌 (1×1)
function _dSteppingStone(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.58,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 납작한 돌 3개
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx-s*.2,cy+s*.04,s*.36,s*.2,-.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dCtx.beginPath();_dCtx.ellipse(cx-s*.22,cy-s*.02,s*.3,s*.15,-.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a6858';_dCtx.beginPath();_dCtx.ellipse(cx+s*.26,cy-s*.06,s*.32,s*.18,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dCtx.beginPath();_dCtx.ellipse(cx+s*.24,cy-s*.1,s*.26,s*.14,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx+s*.02,cy-s*.26,s*.26,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.3,s*.2,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 이끼
  _dCtx.fillStyle='rgba(40,120,20,.5)';_dc(cx-s*.22,cy-.02*s,s*.06);_dCtx.fill();
  _dc(cx+s*.28,cy-s*.08,s*.05);_dCtx.fill();
}

// d_y31: 작은 연못 (3×3)
function _dSmallPond(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.9,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 테두리 — 불규칙한 돌 배치로 자연스럽게
  _dCtx.fillStyle='#6a6858';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06,cy+s*.16,s*.9,s*.58,-.08,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx+s*.04,cy+s*.1,s*.84,s*.54,.06,0,Math.PI*2);_dCtx.fill();
  // 테두리 돌들 (불규칙)
  _dCtx.fillStyle='#6a6858';
  [[-s*.8,s*.2,s*.18,s*.1,-.3],[s*.76,s*.0,s*.2,s*.11,.2],
   [-s*.56,s*.5,s*.22,s*.1,-.1],[s*.52,s*.46,s*.2,s*.1,.15],
   [s*.02,s*.56,s*.26,s*.12,0],[s*.0,-s*.36,s*.22,s*.1,0]].forEach(([dx,dy,rx,ry,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,rx,ry,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 물 — 채도 낮춘 회청색
  _dCtx.fillStyle='#2a6882';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.06,s*.72,s*.46,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#347898';_dCtx.beginPath();_dCtx.ellipse(cx-s*.04,cy-s*.02,s*.66,s*.42,0,0,Math.PI*2);_dCtx.fill();
  // 물 반짝임 (약하게, 불규칙)
  _dCtx.fillStyle='rgba(255,255,255,.14)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.2,cy-s*.12,s*.2,s*.07,-.25,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.09)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.18,cy+s*.08,s*.12,s*.05,.2,0,Math.PI*2);_dCtx.fill();
  // 연꽃 잎 (녹색 큰 잎 + 분홍 꽃)
  [[-s*.22,-s*.14,'#f08878'],[s*.2,-s*.04,'#e8a088'],[s*.0,s*.18,'#d8b898']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle='#2a7018';_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.13,s*.09,dx*.3,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.07);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,220,160,.7)';_dc(cx+dx,cy+dy,s*.03);_dCtx.fill();
  });
  // 갈대 (가장자리 자연스럽게)
  [[-s*.72,s*.12],[-s*.48,s*.5],[s*.6,-s*.06]].forEach(([dx,dy])=>{
    _dCtx.strokeStyle='#7a6818';_dCtx.lineWidth=s*.05;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy+s*.22);
    _dCtx.quadraticCurveTo(cx+dx+s*.04*(dx>0?1:-1),cy+dy,cx+dx+s*.02*(dx>0?1:-1),cy+dy-s*.3);_dCtx.stroke();
    _dCtx.fillStyle='#9a8820';_drr(cx+dx-s*.03,cy+dy-s*.32,s*.06,s*.13,s*.03);_dCtx.fill();
  });
}

// d_y32: 오리 가족 (2×1)
function _dDuckFamily(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.76,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 물 영역 (2×1 칸 전체에 걸쳐 넓게)
  _dCtx.fillStyle='#2a6882';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.42,s*.8,s*.28,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#347898';_dCtx.beginPath();_dCtx.ellipse(cx-s*.04,cy+s*.36,s*.74,s*.24,0,0,Math.PI*2);_dCtx.fill();
  // 물 잔물결
  _dCtx.strokeStyle='rgba(255,255,255,.18)';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.42,cy+s*.36);_dCtx.quadraticCurveTo(cx-s*.2,cy+s*.28,cx,cy+s*.36);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.1,cy+s*.42);_dCtx.quadraticCurveTo(cx+s*.34,cy+s*.34,cx+s*.58,cy+s*.42);_dCtx.stroke();

  // ── 엄마 오리 (왼쪽, 크게) ──
  // 몸통
  _dCtx.fillStyle='#c8a018';_dCtx.beginPath();_dCtx.ellipse(cx-s*.38,cy+s*.14,s*.32,s*.22,-.1,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#e0b820';_dCtx.beginPath();_dCtx.ellipse(cx-s*.4,cy+s*.1,s*.28,s*.19,-.1,0,Math.PI*2);_dCtx.fill();
  // 날개 (어두운 갈색)
  _dCtx.fillStyle='#a07808';_dCtx.beginPath();_dCtx.ellipse(cx-s*.38,cy+s*.14,s*.28,s*.16,-.1,0,Math.PI);_dCtx.fill();
  // 목+머리
  _dCtx.fillStyle='#c8a018';_drr(cx-s*.6,cy-s*.14,s*.14,s*.32,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#1a3a10';_dc(cx-s*.58,cy-s*.22,s*.18);_dCtx.fill(); // 머리 (초록 광택)
  _dCtx.fillStyle='#2a5a18';_dc(cx-s*.6,cy-s*.26,s*.14);_dCtx.fill();
  // 부리
  _dCtx.fillStyle='#e07020';_drr(cx-s*.74,cy-s*.26,s*.18,s*.08,s*.04);_dCtx.fill();
  // 눈
  _dCtx.fillStyle='#fff';_dc(cx-s*.62,cy-s*.3,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#1a1a1a';_dc(cx-s*.62,cy-s*.3,s*.03);_dCtx.fill();

  // ── 아기 오리 1 (중간) ──
  _dCtx.fillStyle='#e8c820';_dCtx.beginPath();_dCtx.ellipse(cx+s*.1,cy+s*.2,s*.22,s*.16,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dCtx.beginPath();_dCtx.ellipse(cx+s*.08,cy+s*.16,s*.18,s*.13,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dc(cx-s*.04,cy+s*.08,s*.14);_dCtx.fill();
  _dCtx.fillStyle='#e07020';_drr(cx-s*.16,cy+s*.06,s*.14,s*.07,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#1a1a1a';_dc(cx-s*.08,cy+s*.04,s*.025);_dCtx.fill();

  // ── 아기 오리 2 (오른쪽) ──
  _dCtx.fillStyle='#e8c820';_dCtx.beginPath();_dCtx.ellipse(cx+s*.5,cy+s*.24,s*.2,s*.15,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dCtx.beginPath();_dCtx.ellipse(cx+s*.48,cy+s*.2,s*.16,s*.12,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dc(cx+s*.36,cy+s*.13,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#e07020';_drr(cx+s*.26,cy+s*.11,s*.12,s*.06,s*.03);_dCtx.fill();
}

// ── 건물 테마 ───────────────────────────────────────────────

// d_y33: 나무 오두막 (2×2)
function _dWoodCabin(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.84,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#8a8070';_drr(cx-s*.74,cy+s*.32,s*1.48,s*.42,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#aaa090';_drr(cx-s*.7,cy+s*.28,s*1.4,s*.28,s*.04);_dCtx.fill();
  // 벽
  _dCtx.fillStyle='#8B5020';_drr(cx-s*.72,cy-s*.42,s*1.44,s*.74,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A06030';_drr(cx-s*.68,cy-s*.46,s*1.36,s*.62,s*.05);_dCtx.fill();
  // 통나무 줄 (가로)
  _dCtx.strokeStyle='#7a4810';_dCtx.lineWidth=s*.04;
  [-s*.22,s*.04,s*.3].forEach(dy=>{_dCtx.beginPath();_dCtx.moveTo(cx-s*.68,cy+dy);_dCtx.lineTo(cx+s*.68,cy+dy);_dCtx.stroke();});
  // 창문 (2개)
  [[-s*.36],[s*.36]].forEach(dx=>{
    _dCtx.fillStyle='#1a3a5a';_drr(cx+dx-s*.2,cy-s*.38,s*.4,s*.34,s*.05);_dCtx.fill();
    _dCtx.fillStyle='rgba(135,206,235,.55)';_drr(cx+dx-s*.18,cy-s*.36,s*.36,s*.3,s*.04);_dCtx.fill();
    _dCtx.strokeStyle='#8a6030';_dCtx.lineWidth=s*.04;_dCtx.strokeRect(cx+dx-s*.18,cy-s*.36,s*.36,s*.3);
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.36);_dCtx.lineTo(cx+dx,cy-s*.06);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(cx+dx-s*.18,cy-s*.22);_dCtx.lineTo(cx+dx+s*.18,cy-s*.22);_dCtx.stroke();
  });
  // 문
  _dCtx.fillStyle='#5a3010';_drr(cx-s*.14,cy-s*.16,s*.28,s*.46,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#7a4820';_drr(cx-s*.12,cy-s*.14,s*.24,s*.38,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#FFD700';_dc(cx+s*.08,cy+s*.08,s*.04);_dCtx.fill();
  // 지붕
  _dCtx.fillStyle='#4a3010';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.9);_dCtx.lineTo(cx-s*.82,cy-s*.42);_dCtx.lineTo(cx+s*.82,cy-s*.42);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#6a4a20';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.8);_dCtx.lineTo(cx-s*.74,cy-s*.42);_dCtx.lineTo(cx+s*.74,cy-s*.42);_dCtx.closePath();_dCtx.fill();
  // 지붕 처마
  _dCtx.fillStyle='#3a2008';_drr(cx-s*.86,cy-s*.5,s*1.72,s*.1,s*.03);_dCtx.fill();
  // 굴뚝
  _dCtx.fillStyle='#6a5040';_drr(cx+s*.42,cy-s*.92,s*.2,s*.52,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#8a7060';_drr(cx+s*.4,cy-s*.94,s*.16,s*.1,s*.03);_dCtx.fill();
  // 연기
  _dCtx.fillStyle='rgba(200,200,200,.3)';_dc(cx+s*.5,cy-s*1.0,s*.08);_dCtx.fill();
  _dc(cx+s*.46,cy-s*1.12,s*.06);_dCtx.fill();
  _dc(cx+s*.52,cy-s*1.22,s*.05);_dCtx.fill();
}
const _DFN = {
  // 마당
  d_y1:_dRose,         // 장미 꽃밭
  d_y2:_dTulip,        // 튤립
  d_y3:_dCactus,       // 선인장
  d_y4:_dStone,        // 정원석
  d_y5:_dBench,        // 정원 벤치
  d_y6:_dLantern,      // 가로등
  d_y7:_dSunflower,    // 해바라기 화단
  d_y8:_dScarecrow,    // 허수아비
  d_y9:_dTree,         // 작은 나무
  d_y10:_dFountain,    // 분수
  d_y11:_dWindmill,    // 풍차
  d_y12:_dCherryTree,  // 벚나무
  d_y13:_dMagicStone,  // 마법 정원석
  d_y14:_dGoldenLantern, // 황금 석등
  // 집 안
  d_i1:_dPlant,        // 화분
  d_i2:_dLamp,         // 램프
  d_i3:_dClock,        // 시계
  d_i4:_dFrame,        // 그림 액자
  d_i5:_dDesk,         // 책상
  d_i6:_dBookshelf,    // 책장
  d_i7:_dTV,           // TV
  d_i8:_dSofa,         // 소파
  d_i9:_dPiano,        // 피아노
  d_i10:_dBed,         // 침대
  d_i11:_dAquarium,    // 수족관
  d_i12:_dGoldenShelf, // 황금 책장
  d_i13:_dMirror,      // 마법 거울
  d_i14:_dThrone,      // 왕의 의자
  // 업적 전용
  deco_trophy:_dTrophy,
  deco_bookshelf:_dGoldenShelf,
  deco_garden:_dCherryTree,
  // ── 공원/정원 테마 ─────────────────────────────────
  d_y15:_dBush,              // 낮은 관목
  d_y16:_dLargePlanter,      // 큰 화단
  d_y17:_dGazebo,            // 정자
  d_y18:_dStoneBench,        // 돌 벤치
  d_y19:_dTreeB,             // 큰 나무 B
  d_y20:_dOrnamentalFountain,// 조형 분수
  d_y21:_dRoseArch,          // 장미 아치
  // ── 농촌 테마 ──────────────────────────────────────
  d_y22:_dWoodenCrate,       // 나무상자
  d_y23:_dLogPile,           // 장작더미
  d_y24:_dHayBale,           // 건초더미
  d_y25:_dWheatField,        // 밀밭
  d_y26:_dLargeRock,         // 큰 바위
  d_y27:_dWell,              // 우물
  d_y28:_dBarn,              // 헛간
  // ── 연못/물가 테마 ────────────────────────────────
  d_y29:_dReed,              // 갈대 묶음
  d_y30:_dSteppingStone,     // 징검돌
  d_y31:_dSmallPond,         // 작은 연못 (3×3) — 그리는 함수만 있고 표에서 빠져 있었다
  d_y32:_dDuckFamily,        // 오리 가족
  // ── 건물 테마 ──────────────────────────────────────
  d_y33:_dWoodCabin,         // 나무 오두막
  // ── 2차: 건물 ─────────────────────────────────────────
  d_y34:_dSmallShed,         // 작은 창고
  // ── 2차: 농촌 심화 ────────────────────────────────────
  d_y35:_dWheatFieldB,       // 밀밭 B형
  d_y36:_dBarleyField,       // 보리밭
  d_y37:_dLogPileB,          // 장작더미 B형
  d_y38:_dLargeRockB,        // 큰 바위 B형
  // ── 2차: 정적 동물 ────────────────────────────────────
  d_y39:_dChickens,          // 닭 3마리
  d_y40:_dSheep,             // 양
  // ── 2차: 꽃 다양화 ────────────────────────────────────
  d_y41:_dLavender,          // 라벤더
  d_y42:_dDaisy,             // 데이지
  d_y43:_dRoseB,             // 장미 B형
  d_y44:_dTulipB,            // 튤립 B형
  // ── 2차: 식생/나무 ────────────────────────────────────
  d_y45:_dTallGrass,         // 키 큰 풀숲
  d_y46:_dConifer,           // 작은 침엽수
  d_y47:_dRoundTreeB,        // 둥근 나무 B형
  d_y48:_dOrchard,           // 과수나무
  // ── 목재 울타리 4종 ────────────────────────────────────
  d_y49:_dFenceHorz,         // 울타리 가로형
  d_y50:_dFenceVert,         // 울타리 세로형
  d_y51:_dFenceCornerL,      // 울타리 왼쪽 코너
  d_y52:_dFenceCornerR,      // 울타리 오른쪽 코너
};

// ── 메인 렌더 ──
function renderHouseDeco() {
  _initDeco();
  _drawDeco();
  renderDecoInv();
  if (_ifMode) { ifSyncScene(); ifSyncInv(); }
}

function _initDeco() {
  const containerId = _ifActiveContainer || 'house-topview';
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!_dCv) {
    el.innerHTML = '';
    _dCv = document.createElement('canvas');
    _dCv.id = 'deco-canvas';
    _dCv.style.cssText = 'display:block;cursor:pointer;touch-action:none';
    el.appendChild(_dCv);
    // 터치: touchstart로 처리 + preventDefault로 click 중복 차단
    _dCv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      //  [DECO-PICK-1] 카드 없이 놓인 장식을 누르면 '치우기'인데, 길게 누르면 스포이드다 →
      //  그 경우만 손을 뗄 때(짧았을 때) 치운다. 나머지는 지금처럼 누르는 순간 처리.
      const cell = _decoCellAt(t.clientX, t.clientY);
      const onDeco = !SEL_DECO && DECO_MODE !== 'floor' && cell && _decoList(CUR).some(p => {
        if (p.area !== cell.area) return false; const sz = getDecoSize(p.id);
        return cell.r >= p.row && cell.r < p.row + sz.h && cell.c >= p.col && cell.c < p.col + sz.w;
      });
      if (onDeco) { _dCv._pendingTap = { clientX: t.clientX, clientY: t.clientY, t0: Date.now() }; return; }
      //  [DECO-FLOOR-RECT-1] ⬛ 네모로: 누르는 순간 칠하지 않고 뗄 때 — 끌었으면(네모) 한 칸이 아니었고, 두 손가락이면 화면이었다.
      //  (누르는 순간 칠하면 네모마다 첫 칸이 따로 저장되고, 두 손가락 확대에도 한 칸이 칠해졌다)
      //  [INDOOR-LOOK-1] 집 안 벽지·바닥도 뗄 때 — 한 손가락 끌기는 화면 이동이다
      if (DECO_MODE === 'floor' && (DECO_FLOOR_TOOL === 'rect' || DECO_SCENE !== 'yard') && e.touches.length === 1) {
        _dCv._pendingTap = { clientX: t.clientX, clientY: t.clientY, t0: Date.now(), rect: true }; return;
      }
      _decoClick({ clientX: t.clientX, clientY: t.clientY, target: e.target });
    }, { passive: false });
    _dCv.addEventListener('touchend', e => {
      const pt = _dCv && _dCv._pendingTap; if (!pt) return;
      _dCv._pendingTap = null;
      if (pt.rect) { if (!_dSuppressClick && DECO_MODE === 'floor') _decoClick({ clientX: pt.clientX, clientY: pt.clientY, target: e.target }); return; }
      if (Date.now() - pt.t0 >= DECO_PICK_MS) return;   // 길게였다 — 스포이드가 이미 처리
      _decoClick({ clientX: pt.clientX, clientY: pt.clientY, target: e.target });
    }, { passive: false });
    // 마우스(PC)용
    _dCv.addEventListener('click', _decoClick);
    _decoAttachGestures(_dCv);   // [DECO-ZOOM-1] 핀치·두 손가락 이동·빈손 끌기·휠
  }
  _decoFitWatch(el);   // [DECO-FIT-1] 판 자리가 달라지면(서랍·바닥 모드·창 크기) 캔버스도 따라간다
  // 전체화면 모드면 window 크기 직접 사용, 아니면 컨테이너 너비
  let W, maxH;
  if (_ifMode) {
    // 상단바(~50px) + 바닥타일줄(~48px, 바닥모드일 때) + 하단인벤(~120px) 제외
    const topH = DECO_MODE === 'floor' ? 98 : 50;
    //  [DECO-PT-1] 서랍(머리줄·최근 줄)이 커지면 어림값(−120)이 틀려 판이 서랍 밑으로 들어갔다 → 실제 남는 자리로
    W    = el.clientWidth  || window.innerWidth;
    maxH = el.clientHeight || (window.innerHeight - topH - 120);
  } else {
    W    = el.offsetWidth || 340;
    maxH = 600;
  }
  const cols = DECO_SCENE === 'yard' ? DY.cols : DI.cols;
  const rows = DECO_SCENE === 'yard' ? DY.rows : DI.rows;
  // [DECO-ZOOM-1] 기준 칸은 '기준 판'(50칸) 기준이라 판을 넓혀도 처음 보이는 크기가 그대로다.
  const baseCols = Math.min(cols, DECO_SCENE === 'yard' ? DY_BASE.cols : DI.cols);
  const baseC = Math.floor(W / baseCols);
  const C = Math.max(4, Math.round(baseC * _dZoom));
  const H = _ifMode ? Math.max(120, maxH) : Math.min(Math.max(C * rows, 120), maxH);   // [DECO-PT-1]
  _dW = W; _dH = H; _dC = C;
  _decoClampPan();
  //  [DECO-PINCH-1] 크기가 같으면 버퍼를 다시 잡지 않는다(확대 중에는 칸 크기만 바뀐다 — 매 걸음 지우고 새로 잡지 않게)
  if (_dCv.width !== W * 2)  _dCv.width  = W * 2;
  if (_dCv.height !== H * 2) _dCv.height = H * 2;
  _dCv.style.width  = W + 'px';
  _dCv.style.height = H + 'px';
  _dCtx = _dCv.getContext('2d');
  _dCtx.setTransform(2, 0, 0, 2, 0, 0);   // scale(2,2) 와 같은 값 — 버퍼를 안 바꾼 때 거듭 곱해지지 않게
}

let _drawDecoRaf = null;

// [DECO-FIT-1] 캔버스 크기는 '잡는 순간' 판 자리(#if-topview)로 정해지는데, 그 자리는 그 뒤에도 바뀐다 —
//  ① 처음 열 때는 서랍에 카드가 차기 전에 재서 캔버스가 컸다(1366×610: 479 vs 보이는 327 →
//     마당 맨 아래 5줄이 서랍 밑에 들어가 어떻게 해도 안 보였다 · 지난번 자리 기억이 없는 기기에서)
//  ② 🖌️ 바닥 모드는 서랍을 접는데 캔버스는 그대로라 판 아래가 까맣게 비었다(1366×610: 화면의 30%)
//  ③ 🕘 최근 줄이 생기거나 ⌃ 서랍을 펼치면 판 아래가 서랍 밑으로 들어갔다 · 창 크기·화면 돌리기도 같다
//  → 판 자리 크기가 바뀌면 캔버스 크기만 다시 맞춘다(보던 왼쪽 위는 그대로 · 저장·DB 쓰기 0).
//  자리가 바뀌는 줄 아는 곳(서랍 다시 그림·모드 바꿈·서랍 펼침)에서는 바로 부르고, 창 크기·화면 돌리기는 지켜본다.
let _decoFitObs = null, _decoFitHost = null;
function _decoFit() {
  if (!_ifMode || !_dCv || !_dCv.parentNode) return false;
  const el = _dCv.parentNode, w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return false;   // 안 보이는 동안(전체화면 닫힘)
  if (w === _dW && Math.max(120, h) === _dH) return false;
  _initDeco();
  _drawDeco();
  return true;
}
function _decoFitWatch(el) {
  if (typeof ResizeObserver === 'undefined' || _decoFitHost === el) return;
  if (_decoFitObs) _decoFitObs.disconnect();
  _decoFitHost = el;
  _decoFitObs = new ResizeObserver(() => { if (_dCv && _dCv.parentNode === el) _decoFit(); });
  _decoFitObs.observe(el);
}

// ══ 꾸미기 확대/축소·화면 이동 (DECO-ZOOM-1) ══════════════════
//  · 판(격자)은 지금 코드가 쓰는 좌표 그대로 그린다. 캔버스 변환으로 보이는 창만 옮긴다.
//  · 보이는 칸만 그린다(컬링) → 판을 넓혀도 한 번 그리는 비용이 늘지 않는다.
//  · 줌·이동은 화면 상태다. DB 에 쓰지 않는다.
function _decoBoardPx() {
  const cols = DECO_SCENE === 'yard' ? DY.cols : DI.cols;
  const rows = DECO_SCENE === 'yard' ? DY.rows : DI.rows;
  //  [DECO-PT-1] 집 안은 위에 벽 한 줄(약 0.9칸)이 더 있다
  if (DECO_SCENE !== 'yard') return { w: cols * _dC, h: rows * _dC + Math.ceil(_dC * 0.9) + _dC };
  return { w: cols * _dC, h: rows * _dC };
}

//  [DECO-TOP-PAD-1] 마당은 판 위로 잔디 띠 두 칸까지 밀 수 있다(솟은 그림이 잘리지 않게) · 처음 열 때는 한 칸 보이게
const DECO_YARD_TOP = 2;
function _decoClampPan() {
  const b = _decoBoardPx();
  //  [DECO-VIEW-FIT-1] 집 안에 방이 있으면 판 밖도 도면이다 → 반 화면까지 더 밀 수 있다(판 끝에 붙은 방을 가운데로 — 디자인 D10)
  const extraX = (DECO_SCENE !== 'yard' && _inRooms(CUR).length) ? _dW / 2 : 0, extraY = extraX ? _dH / 2 : 0;
  const maxX = Math.max(0, b.w - _dW) + extraX, maxY = Math.max(0, b.h + (DECO_SCENE === 'yard' && typeof _yardIslandCells === 'function' ? _yardIslandCells() * _dC : 0) - _dH) + extraY;
  //  마당 판이 화면보다 작으면(전체 보기) 화면 안에서 움직일 수 있다(판이 화면 밖으로는 안 나간다) — 가운데 두기는 '전체'가 한다
  const yd = DECO_SCENE === 'yard';
  const isl = yd && typeof _yardIslandCells === 'function' ? _yardIslandCells() * _dC : 0, bh = b.h + isl;   // [DECO-STAR-P5] 떠 있는 섬까지 밀어 볼 수 있게(섬 없는 모습은 0)
  const minX = yd && b.w < _dW ? -(_dW - b.w) : -extraX, minY = yd && bh < _dH ? -(_dH - bh) : yd ? -DECO_YARD_TOP * _dC : -extraY;
  _dPanX = Math.min(Math.max(minX, _dPanX), maxX);
  _dPanY = Math.min(Math.max(minY, _dPanY), maxY);
}
// [DECO-VIEW-FIT-1] 판 전체가 한 화면에 들어오는 배율 — '전체'는 폭만 맞춰 1366×610 에서 마당 아래(밭 포함)가 화면 밖이었다(디자인 D17)
function _decoWholeZoom() {
  if (!_dW || !_dH) return DECO_ZOOM_MIN;
  const yard = DECO_SCENE === 'yard', cols = yard ? DY.cols : DI.cols, rows = yard ? DY.rows + (typeof _yardIslandCells === 'function' ? _yardIslandCells() : 0) : DI.rows + 2;   // 집 안은 위 벽 띠 몫 · [DECO-STAR-P5] 섬 몫
  const C0 = Math.floor(_dW / Math.min(cols, yard ? DY_BASE.cols : DI.cols));
  //  칸 크기를 내림으로 정한 뒤 배율로 — _initDeco 가 칸을 반올림해 판이 화면보다 몇 px 넓어지지 않게
  return Math.max(4, Math.floor(Math.min(_dW / cols, _dH / rows))) / C0;
}
//  두 손가락·－ 로 줄일 수 있는 끝 = 원래 끝(0.5)과 '판 전체' 중 작은 쪽(0.25 아래로는 안 간다)
function _decoZoomMin() { return Math.max(0.25, Math.min(DECO_ZOOM_MIN, _decoWholeZoom())); }

// 보이는 칸 범위 — 그리는 쪽에서 이 범위만 돈다
function _decoVisible(rows, cols) {
  const r0 = Math.max(0, Math.floor(_dPanY / _dC) - 1);
  const c0 = Math.max(0, Math.floor(_dPanX / _dC) - 1);
  const r1 = Math.min(rows, Math.ceil((_dPanY + _dH) / _dC) + 1);
  const c1 = Math.min(cols, Math.ceil((_dPanX + _dW) / _dC) + 1);
  return { r0, c0, r1, c1 };
}

//  화면의 한 점(창 기준 px)을 고정한 채 줌을 바꾼다 — 핀치 중심·＋－ 단추 모두 이걸 쓴다
function _decoSetZoom(z, fx, fy) {
  const prev = _dZoom;
  const next = Math.min(DECO_ZOOM_MAX, Math.max(_decoZoomMin(), z));   // [DECO-VIEW-FIT-1]
  if (Math.abs(next - prev) < 0.001) return;
  const ax = (fx === undefined ? _dW / 2 : fx), ay = (fy === undefined ? _dH / 2 : fy);
  const boardX = (_dPanX + ax) / prev, boardY = (_dPanY + ay) / prev;   // 줌 1 기준 판 좌표
  _dZoom = next;
  //  [DECO-PINCH-1] 캔버스를 새로 만들지 않는다 — 새로 만들면 손가락이 잡고 있던 캔버스가 사라져
  //  두 손가락 확대가 첫 걸음(약 7%)에서 끊겼다(실제 터치로 3배 벌려도 1→1.07배). 칸 크기만 다시 잰다.
  _initDeco();
  _dPanX = boardX * _dZoom - ax; _dPanY = boardY * _dZoom - ay;
  _decoClampPan();
  _drawDeco();
}

// [DECO-VIEW-1] 마지막 보던 자리·배율 기억 — 기기에만(localStorage), DB 쓰기 0.
//  판 픽셀은 창 크기·배율에 따라 달라지므로 '보던 한가운데 칸'과 배율로 기억한다(폰↔태블릿에서도 같은 곳).
const DECO_VIEW_KEY = 'rpg.deco.view';
function _decoViewSave() {
  if (!_dCv || DECO_SCENE !== 'yard' || !_dC) return;
  try {
    localStorage.setItem(DECO_VIEW_KEY, JSON.stringify({
      z: Math.round(_dZoom * 1000) / 1000,
      cx: Math.round(((_dPanX + _dW / 2) / _dC) * 10) / 10,
      cy: Math.round(((_dPanY + _dH / 2) / _dC) * 10) / 10,
    }));
  } catch (e) {}
}
function _decoViewRestore() {
  if (DECO_SCENE !== 'yard') return false;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(DECO_VIEW_KEY) || 'null'); } catch (e) { return false; }
  if (!v || !(v.z > 0) || !isFinite(v.cx) || !isFinite(v.cy)) return false;
  _dZoom = Math.min(DECO_ZOOM_MAX, Math.max(DECO_ZOOM_MIN, v.z));
  _dCv = null; _dCtx = null;
  _initDeco();
  _dPanX = v.cx * _dC - _dW / 2; _dPanY = v.cy * _dC - _dH / 2;
  _decoClampPan();
  _drawDeco();
  return true;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) _decoViewSave(); });
}

// [DECO-PT-1] 폰(좁은 화면)에서 처음 열면 칸이 7px 라 꽃 하나를 못 누른다 → 칸 약 16px 로 집 앞에서 연다
//  [DECO-PHONE-INDOOR-1] 집 안도 같다 — 폰 375 에서 50칸 방이 칸 7px 로 열려 가구 하나·나가기 문(7px)을 못 눌렀다.
//  집 안은 왼쪽 위(벽·창문)부터 연다.
// [DECO-VIEW-FIT-1] 처음 열 때 판이 화면 높이보다 짧으면(세로 화면 768×1024: 칸 15 · 아래가 빈 검은 띠) 높이에 맞춰 키우고 집이 보이게 민다(디자인 D13)
function _decoFillStart() {
  if (!_dC || DECO_SCENE !== 'yard' || _dW <= 600) return false;
  const C0 = _dC / _dZoom;
  if (DY.rows * _dC >= _dH) return false;
  _decoSetZoom(Math.min(DECO_ZOOM_MAX, _dH / (DY.rows * C0)), 0, 0);
  _dPanX = Math.max(0, (_houseCol0() + DH.cols + 2) * _dC - _dW); _dPanY = -_dC;   // [DECO-TOP-PAD-1] 굴뚝이 보이게 한 칸 위
  _decoClampPan(); _drawDeco();
  return true;
}
// [DECO-VIEW-THINGS-1] 처음 열 때(이 기기에 보던 자리가 없을 때) 아이 장식이 첫 화면 밖에 있으면 그쪽으로(창조자 31-ⓑ74 — 마당 80×44 의 왼쪽 위만 보여
//  판 오른쪽 · 아래에 놓은 것이 첫 화면에 없었다). 장식 네모(나무 꼭대기 한 줄 포함)가 첫 화면에 다 들어 있으면 그대로 ·
//  한 화면에 들어가면 네모 가운데 · 너무 넓으면 장식 한가운데(행·열 평균). 보던 자리를 되살리는 길(_decoViewRestore)은 그대로.
function _decoStartOnThings() {
  if (DECO_SCENE !== 'yard' || !_dC || !CUR) return false;
  const list = _decoList(CUR).filter(p => p.area === 'yard');
  if (!list.length) return false;
  let r0 = 1e9, c0 = 1e9, r1 = -1e9, c1 = -1e9, sr = 0, sc = 0;
  list.forEach(p => { const z = getDecoSize(p.id); r0 = Math.min(r0, p.row - 1); c0 = Math.min(c0, p.col); r1 = Math.max(r1, p.row + z.h); c1 = Math.max(c1, p.col + z.w); sr += p.row + z.h / 2; sc += p.col + z.w / 2; });
  const C = _dC, vx0 = _dPanX / C, vy0 = _dPanY / C, vx1 = (_dPanX + _dW) / C, vy1 = (_dPanY + _dH) / C;
  if (c0 >= vx0 && c1 <= vx1 && r0 >= vy0 && r1 <= vy1) return false;   // 이미 다 보인다
  const fits = (c1 - c0) * C <= _dW && (r1 - r0) * C <= _dH;
  const cx = fits ? (c0 + c1) / 2 : sc / list.length, cy = fits ? (r0 + r1) / 2 : sr / list.length;
  _dPanX = cx * C - _dW / 2; _dPanY = cy * C - _dH / 2;
  _decoClampPan(); _drawDeco();
  return true;
}
function _decoPhoneStart() {
  if (_decoFillStart()) { _decoStartOnThings(); return; }   // [DECO-VIEW-FIT-1] 넓은 화면인데 판이 짧으면 높이 채우기 · [DECO-VIEW-THINGS-1]
  if (!_dC || _dW > 600) { if (DECO_SCENE === 'yard' && _dPanY === 0) { _dPanY = -_dC; _decoClampPan(); _drawDeco(); } _decoStartOnThings(); return; }   // [DECO-TOP-PAD-1] 넓은 화면도 한 칸 위부터 · [DECO-VIEW-THINGS-1]
  const z = Math.min(DECO_ZOOM_MAX, 16 / Math.max(1, _dC / _dZoom));
  _decoSetZoom(z, 0, 0);
  if (DECO_SCENE === 'yard') { _dPanX = (_houseCol0() - 4) * _dC; _dPanY = -_dC; }   // 집(기준 판 오른쪽 위) 앞이 보이게 · [DECO-TOP-PAD-1] 굴뚝까지
  else { _dPanX = 0; _dPanY = 0; }
  _decoClampPan(); _drawDeco();
  _decoStartOnThings();   // [DECO-VIEW-THINGS-1] 폰도 — 장식이 집 앞 밖이면 그쪽
}

function decoZoomIn()  { _decoSetZoom(_dZoom * DECO_ZOOM_STEP); }
function decoZoomOut() { _decoSetZoom(_dZoom / DECO_ZOOM_STEP); }

// 판 전체가 보이게 (마당이 넓어져 길을 잃었을 때)
function decoZoomFit() {
  if (DECO_SCENE !== 'yard' && _inFitRooms()) return;   // [INDOOR-ROOMS-1] 집 안 '전체' = 방들 둘레
  //  [DECO-VIEW-FIT-1] 폭·높이 둘 다 맞춘다 — 마당 80×44 가 밭까지 한 화면에(1366×610: 칸 17 → 9 · 아래 줄이 더는 화면 밖이 아니다)
  const z = Math.max(_decoZoomMin(), Math.min(DECO_ZOOM_MAX, _decoWholeZoom()));
  _dPanX = 0; _dPanY = 0;
  _decoSetZoom(z, 0, 0);
  //  판이 화면보다 작으면 가운데에(왼쪽·위에 붙고 나머지가 비던 것)
  const b = _decoBoardPx(), bh = b.h + (DECO_SCENE === 'yard' && typeof _yardIslandCells === 'function' ? _yardIslandCells() * _dC : 0);   // [DECO-STAR-P5] 섬까지 한 덩어리로 가운데에
  _dPanX = b.w < _dW ? -(_dW - b.w) / 2 : 0; _dPanY = bh < _dH ? -(_dH - bh) / 2 : 0;
  _decoClampPan(); _drawDeco();
}

function decoPanBy(dx, dy) {
  const bx = _dPanX, by = _dPanY;
  _dPanX += dx; _dPanY += dy;
  _decoClampPan();
  if (_dPanX !== bx || _dPanY !== by) _drawDeco();
}

// 손짓 — 두 손가락 벌리기/모으기 = 확대/축소(손가락 사이 중심 기준) · 두 손가락 끌기 = 화면 이동
//  빈손(고른 카드 없고 바닥 모드 아님) 한 손가락 끌기 = 화면 이동 · 휠 = 확대/축소(PC)
//  카드를 고른 채 한 손가락은 지금처럼 '놓기'다(탭).
let _dSuppressClick = false;
function _decoAttachGestures(cv) {
  const pts = new Map();
  let pinch = null, drag = null, paint = null;   // paint = [DECO-DRAG-1] 끌어서 칠하기·놓기
  let roomDrag = null;                            // [INDOOR-ROOMS-1] 집 안 ⬛ 방 네모 끌기

  const mid = () => {
    const a = [...pts.values()];
    return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2,
             d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) };
  };
  const local = (e) => {
    const rect = cv.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (_dW / rect.width), y: (e.clientY - rect.top) * (_dH / rect.height) };
  };

  let pickTimer = null, pickAt = null;   // [DECO-PICK-1]
  const pickCancel = () => { if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; } };
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, local(e));
    pickCancel();
    if (pts.size === 1) {
      const cell = _decoCellAt(e.clientX, e.clientY);
      pickAt = { cell, x: e.clientX, y: e.clientY };
      pickTimer = setTimeout(() => {
        pickTimer = null;
        if (paint && paint.active) return;
        if (_decoPickAt(pickAt && pickAt.cell)) {
          _dSuppressClick = true;            // 뗄 때 오는 클릭은 놓기가 아니다
          if (paint) paint = null;            // 이 누름은 칠하기가 아니었다
          drag = null;
        }
      }, DECO_PICK_MS);
    }
    if (pts.size === 2) {
      drag = null;
      if (roomDrag) { roomDrag = null; _inRoomPrevSet(null); }   // [INDOOR-ROOMS-1] 두 손가락이면 화면이었다
      if (paint) { if (paint.rect) _decoRectCancel(); else _decoStrokeEnd(paint); paint = null; }   // 두 손가락이 되면 칠하기는 거기서 끝 · [DECO-FLOOR-RECT-1] 네모는 취소(안 칠함)
      const m = mid();
      pinch = { d0: m.d, z0: _dZoom, fx: m.x, fy: m.y, mx: m.x, my: m.y };
      _dSuppressClick = true;
    } else if (pts.size === 1 && (!SEL_DECO && DECO_MODE !== 'floor' || e.pointerType === 'mouse' && e.button !== 0
        || DECO_MODE === 'floor' && DECO_SCENE !== 'yard' && !_inRoomDragMode())) {   // [INDOOR-LOOK-1] 집 안 벽지·바닥: 칠할 칸이 없다 → 한 손가락 끌기 = 화면 이동
      //  [DECO-PAN-1] 마우스 오른쪽·가운데 버튼 끌기는 카드를 골랐어도 언제나 화면 이동
      const l = local(e);
      drag = { x: l.x, y: l.y, moved: 0 };
    } else if (pts.size === 1 && _inRoomDragMode()) {
      //  [INDOOR-ROOMS-1] ⬛ 방 — 끌면 네모(떼면 방)
      const k = _inCellClamp(e.clientX, e.clientY);
      roomDrag = { r0: k.r, c0: k.c, active: false, edge: _inRoomEdgeAt(e.clientX, e.clientY) };   // [DECO-ROOM-RESIZE-1] 가장자리면 크기 바꾸기
    } else if (pts.size === 1) {
      //  [DECO-DRAG-1] 카드를 골랐거나 바닥 모드 — 끌면 칠하기·놓기
      const cell = _decoCellAt(e.clientX, e.clientY);
      if (cell) paint = { start: cell, last: cell, active: false, stroke: [], mode: null, placed: 0, outOfStock: false,
        rect: DECO_MODE === 'floor' && DECO_FLOOR_TOOL === 'rect' && cell.area === 'yard' };   // [DECO-FLOOR-RECT-1] ⬛ 네모로
    }
  });

  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    if (pickTimer && pickAt && Math.abs(e.clientX - pickAt.x) + Math.abs(e.clientY - pickAt.y) > 8) pickCancel();
    if (pinch && pts.size >= 2) {
      const m = mid();
      if (pinch.d0 > 8) _decoSetZoom(pinch.z0 * (m.d / pinch.d0), pinch.fx, pinch.fy);
      decoPanBy(pinch.mx - m.x, pinch.my - m.y);
      pinch.mx = m.x; pinch.my = m.y;
      return;
    }
    if (roomDrag && pts.size === 1) {   // [INDOOR-ROOMS-1] 시작 칸을 벗어나면 네모 미리 보기
      const k = _inCellClamp(e.clientX, e.clientY);
      if (!roomDrag.active && k.r === roomDrag.r0 && k.c === roomDrag.c0) return;
      roomDrag.active = true; _dSuppressClick = true;
      if (roomDrag.edge) {   // [DECO-ROOM-RESIZE-1]
        const nr = _inRoomResized(roomDrag.edge, e.clientX, e.clientY);
        _inRoomPrevSet(Object.assign(nr, { why: _inRoomResizeWhy(_inRooms(CUR), roomDrag.edge.rm.id, nr), resize: true }));   // [DECO-ROOM-HOUSE-1] 집에서 떨어지면 빨갛게
        return;
      }
      const raw = _inRoomFrom(roomDrag.r0, roomDrag.c0, k.r, k.c), pl = _inRoomPlan(_inRooms(CUR), raw, false);   // [DECO-ROOM-HOUSE-1] 떨어져 있으면 붙는 자리를 미리 보인다
      _inRoomPrevSet(Object.assign({}, pl.rect, { why: pl.why, moved: pl.moved, raw: pl.moved ? raw : null }));
      return;
    }
    if (paint && paint.rect && pts.size === 1) {   // [DECO-FLOOR-RECT-1] 시작 칸을 벗어나면 네모 미리보기(집·밭 위로도 늘어난다 — 칠할 때 건너뜀)
      const k = _decoYardCellClamp(e.clientX, e.clientY);
      if (!paint.active && k.r === paint.start.r && k.c === paint.start.c) return;
      _decoRectMove(paint, e.clientX, e.clientY);
      return;
    }
    if (paint && pts.size === 1) {
      const cell = _decoCellAt(e.clientX, e.clientY);
      if (!cell || cell.area !== paint.last.area || (cell.r === paint.last.r && cell.c === paint.last.c)) return;
      if (!paint.active) _decoStrokeBegin(paint);
      for (const k of _decoLineCells(paint.last.r, paint.last.c, cell.r, cell.c)) {
        if (cell.area === 'yard' && (_isHC(k.r, k.c) || _isFarmCell(k.r, k.c))) continue;
        _decoStrokeApply({ area: cell.area, r: k.r, c: k.c }, paint);
      }
      paint.last = cell;
      _drawDeco();
      return;
    }
    if (drag) {
      const l = local(e);
      const dx = l.x - drag.x, dy = l.y - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6) _dSuppressClick = true;
      decoPanBy(-dx, -dy);
      drag.x = l.x; drag.y = l.y;
    }
  });

  const end = e => {
    //  [DECO-RCLICK-1] 마우스 오른쪽 버튼을 **안 끌고**(4px 미만) 떼면 치우기 — 끌었으면 화면 이동이었다
    if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button === 2 && drag && drag.moved < 4 && pts.has(e.pointerId)) {
      _decoRightClickAt(e.clientX, e.clientY);
    }
    pts.delete(e.pointerId);
    pickCancel();
    if (pts.size < 2) pinch = null;
    if (!pts.size) {
      if (roomDrag) {   // [INDOOR-ROOMS-1] 떼면 방(안 되면 그 까닭 한 줄)
        const pv = roomDrag.active && _inRoomPrev, edge = roomDrag.edge; roomDrag = null; _inRoomPrevSet(null);
        if (pv && edge) {   // [DECO-ROOM-RESIZE-1] 떼면 그 크기로(안 되면 까닭)
          if (pv.why) toast('🧱 ' + pv.why);
          else _inRoomsCommit(_inRooms(CUR).map(o => o.id === edge.rm.id ? Object.assign({}, o, { r: pv.r, c: pv.c, w: pv.w, h: pv.h }) : o), `🧱 방 크기를 바꿨어요 — ${pv.w} × ${pv.h} (↩ 되돌리기)`);   // [DECO-ROOM-SHRINK-1] 줄어 방 밖에 남은 가구는 가방으로(_inRoomsCommit)
        } else if (pv) { if (pv.why) toast('🧱 ' + pv.why); else _inRoomAdd({ r: pv.r, c: pv.c, w: pv.w, h: pv.h }); }
      }
      if (paint) { if (paint.rect) _decoRectCommit(paint); else _decoStrokeEnd(paint); paint = null; }
      drag = null; setTimeout(() => { _dSuppressClick = false; }, 0);
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('lostpointercapture', end);

  //  [DECO-SEL-HL-1] 마우스가 누르지 않은 채 움직이면 커서 칸에 놓일 모습 — 칸이 바뀔 때만 다시 그린다(터치는 hover 가 없다)
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    if (_inChipMode()) { _inChipGhost(e.clientX, e.clientY); return; }   // [DECO-ROOM-HOUSE-1] 크기 칩 — 누르면 지어질 자리
    if (_inRoomDragMode()) cv.style.cursor = _inRoomCursor(_inRoomEdgeAt(e.clientX, e.clientY)) || 'crosshair';   // [DECO-ROOM-RESIZE-1] 가장자리면 크기 바꾸기 커서
    else if (cv.style.cursor && cv.style.cursor !== 'pointer') cv.style.cursor = 'pointer';
    const k = _decoCellAt(e.clientX, e.clientY), h = _decoHover;
    if ((!k && !h) || (k && h && k.area === h.area && k.r === h.r && k.c === h.c)) return;
    _decoHover = k; if (SEL_DECO) _drawDeco();
  });
  cv.addEventListener('pointerleave', () => { if (_decoHover) { _decoHover = null; if (SEL_DECO) _drawDeco(); } if (_inRoomPrev && _inRoomPrev.ghost) _inRoomPrevSet(null); });
  cv.addEventListener('contextmenu', e => e.preventDefault());   // [DECO-PAN-1] 오른쪽 끌기에 메뉴가 뜨지 않게
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const l = local(e);
    _decoSetZoom(_dZoom * (e.deltaY < 0 ? DECO_ZOOM_STEP : 1 / DECO_ZOOM_STEP), l.x, l.y);
  }, { passive: false });
}

// ══ 꾸미기 끌어서 연달아 놓기·칠하기 (DECO-DRAG-1) ══════════════
//  카드를 고른 채(또는 🖌️ 바닥 모드) **한 손가락으로 끌면** 지나간 칸마다 놓이고 칠해진다.
//  · 한 번 끈 것은 **되돌리기 한 단계**(decoUndoStroke) · 저장은 묶음(DECO-SAVE-1)이라 칸마다 저장 안 됨.
//  · 바닥: 시작 칸이 그 타일이 되면 '칠하기', 지워지면 '지우기'로 한 번 정해 그대로 간다(깜빡이지 않게).
//  · 장식: **놓기만** 한다(끌다가 치우는 일은 없다 — 망가뜨리지 않게). 못 놓는 칸은 조용히 건너뛴다.
//  · 빠르게 끌어도 칸이 비지 않게 앞 칸과 이 칸 사이를 곧은 줄로 채운다.
//  · 빈손 한 손가락 끌기는 지금처럼 화면 이동, 두 손가락은 확대·이동.
let _decoLastTap = null;   // 방금 누른 칸(터치는 누르는 순간 이미 놓인다 — 끌기 첫 칸이 두 번 되지 않게)

function _decoCellAt(clientX, clientY) {
  if (!_dCv) return null;
  const bp = _decoBoardPoint(clientX, clientY), C = _dC;
  if (DECO_SCENE === 'yard') {
    const c = Math.floor(bp.x / C), r = Math.floor(bp.y / C);
    if (c < 0 || c >= DY.cols || r < 0 || r >= DY.rows) return null;
    if (_isHC(r, c) || _isFarmCell(r, c)) return null;
    return { area: 'yard', r, c };
  }
  const ox = _dCv._offX || 0, oy = _dCv._offY || 0;
  const c = Math.floor((bp.x - ox) / C), r = Math.floor((bp.y - oy) / C);
  if (r === -1 && c >= 0 && c < DI.cols) return { area: 'indoor', r: 0, c, band: true };   // [INDOOR-WALL-1] 벽 띠 = 0번 줄의 벽
  //  [INDOOR-ROOMS-1] 방의 벽 띠 줄 — 그 칸에 서 있는 가구가 없을 때만 '벽'이다(가구가 있으면 그 가구를 누른 것)
  if (DECO_MODE !== 'floor' && c >= 0 && c < DI.cols && r >= 0 && r < DI.rows) {
    const h = _inRoomAt(r, c);
    if (h && h.band && !_decoList(CUR).some(p => p.area === 'indoor' && !_isWallDeco(p.id) && r >= p.row && r < p.row + getDecoSize(p.id).h && c >= p.col && c < p.col + getDecoSize(p.id).w))
      return { area: 'indoor', r: h.rm.r, c, band: true };
  }
  if (c < 0 || c >= DI.cols || r < 0 || r >= DI.rows) return null;
  return { area: 'indoor', r, c };
}

//  앞 칸 → 이 칸 사이 곧은 줄(Bresenham). 앞 칸은 빼고 이 칸은 넣는다 — 순수 함수(시험용)
function _decoLineCells(r0, c0, r1, c1) {
  const out = [];
  const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
  let err = dc - dr, r = r0, c = c0;
  while (!(r === r1 && c === c1)) {
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 < dc) { err += dc; r += sr; }
    out.push({ r, c });
  }
  return out;
}

//  한 칸 칠하기·놓기(끌기용 — 알림 없음). 바뀐 게 있으면 true
function _decoStrokeApply(cell, st) {
  if (DECO_MODE === 'floor') {
    if (cell.area !== 'yard') return false;
    const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
    const key = cell.r + '_' + cell.c, cur = fm[key];
    if (st.mode === 'erase') {
      if (cur === undefined) return false;
      st.stroke.push({ t: 'floor', key, prev: cur }); delete fm[key];
    } else {
      if (cur === CUR_FLOOR_TILE) return false;
      const blk = _floorPaintBlock(cell.r, cell.c, CUR_FLOOR_TILE);   // [DECO-RULE-R1R2] 그 칸은 건너뛰고 끝에 한 번 말한다
      if (blk) { st.blocked = st.blocked || []; if (st.blocked.indexOf(blk) < 0) st.blocked.push(blk); return false; }
      st.stroke.push({ t: 'floor', key, prev: cur }); fm[key] = CUR_FLOOR_TILE;
    }
    decoDirty();
    return true;
  }
  if (!SEL_DECO) return false;
  const d = GAME_DATA.decorations.find(x => x.id === SEL_DECO);
  if (!d || d.cat !== cell.area) return false;
  const sz = d.size || { w: 1, h: 1 };
  const placed = CUR.houseDecorations || [];
  const inv = (CUR.inventory || []).find(i => i.id === SEL_DECO);
  if (!inv || inv.qty - placed.filter(p => p.id === SEL_DECO).length <= 0) { st.outOfStock = true; return false; }
  if (!canPlaceDeco(cell.r, cell.c, sz.w, sz.h, cell.area, null)) return false;
  if (cell.area === 'yard' && _animAt(_ifActiveContainer || 'house-topview', cell.r, cell.c)) return false;   // [DECO-SEL-A5] 돌아다니는 동물 발밑에 놓지 않는다
  if (_decoRuleWhy(SEL_DECO, cell.area, cell.r, cell.c, sz.w, sz.h)) return false;   // [DECO-PT-2]
  if (cell.area === 'yard' && typeof ANIM_DECO !== 'undefined' && ANIM_DECO[SEL_DECO]
      && !_animGroundOk(SEL_DECO, CUR, cell.r, cell.c, sz.w, sz.h)) return false;
  const np = _decoNew(SEL_DECO, cell.area, cell.r, cell.c);   // [DECO-SPACE-1]
  CUR.houseDecorations = [...placed, np];
  st.stroke.push({ t: 'place', p: Object.assign({}, np) });
  st.placed++;
  decoDirty();
  return true;
}

function _decoStrokeBegin(st) {
  const s0 = st.start;
  //  터치는 누르는 순간 첫 칸이 이미 처리됐다 → 그 되돌리기 한 줄을 이 끌기로 합친다
  const tapped = _decoLastTap && _decoLastTap.area === s0.area && _decoLastTap.r === s0.r && _decoLastTap.c === s0.c
    && Date.now() - _decoLastTap.t < 1500;
  const startKey = s0.r + '_' + s0.c;
  if (tapped) {
    if (_decoUndo.length) { const rec = _decoUndo.pop(); st.stroke.push(rec); _decoUndoSync(); if (rec.t === 'place') st.placed = (st.placed || 0) + 1; }   // [DECO-WORDS-1] 알림 수에 첫 칸도
    if (DECO_MODE === 'floor') st.mode = (_yardFloorGet(CUR)[startKey] === CUR_FLOOR_TILE) ? 'set' : 'erase';
  } else {
    if (DECO_MODE === 'floor') st.mode = (_yardFloorGet(CUR)[startKey] === CUR_FLOOR_TILE) ? 'erase' : 'set';
    _decoStrokeApply(s0, st);
  }
  st.active = true;
  _dSuppressClick = true;
}

// [DECO-PICK-1] 스포이드 — 판에 놓인 장식을 **길게 누르면(0.6초)** 그 장식 카드가 손에 잡힌다.
//  같은 것을 또 놓고 싶을 때 서랍에서 다시 찾지 않는다. 가진 게 남았을 때만 잡힌다.
//  동물을 누르면 반응하는 것(짧게)과 겹치지 않는다 — 길게일 때만. 끌기가 시작되면 취소.
const DECO_PICK_MS = 600;
function _decoPickAt(cell) {
  if (!cell) return false;
  const list = CUR.houseDecorations || [];
  let hit = _decoTopAt(cell.area, cell.r, cell.c, true, cell.band);   // [DECO-SPACE-1] 이 공간에서 · [DECO-ANIM-HIT-1] 동물은 보이는 자리로 · [INDOOR-WALL-1] 벽 띠
  if (hit && !cell.band && _decoOnWallFloor(hit, cell.area)) hit = null;   // 액자 아래 빈 바닥
  if (!hit) return false;
  const d = GAME_DATA.decorations.find(x => x.id === hit.id);
  const inv = (CUR.inventory || []).find(i => i.id === hit.id);
  const left = inv ? inv.qty - list.filter(p => p.id === hit.id).length : 0;
  if (DECO_MODE === 'floor') setDecoMode('deco');
  if (left <= 0) { toast((d ? d.icon + ' ' : '') + '이건 다 놓았어요 — 상점에서 더 살 수 있어요'); return true; }
  SEL_DECO = hit.id;
  _drawDeco(); renderDecoInv();
  toast('💧 ' + (d ? d.icon + ' ' + d.name : '') + ' 잡았어요 — 놓을 칸을 누르세요');
  return true;
}

function _decoStrokeEnd(st) {
  if (!st || !st.active) return;
  decoUndoStroke(st.stroke);
  if (st.placed && SEL_DECO) _decoRecentAdd(SEL_DECO);   // [DECO-FIND-1]
  if (DECO_MODE !== 'floor' && SEL_DECO && _decoLeft(SEL_DECO) <= 0) { SEL_DECO = null; st.outOfStock = true; }   // [DECO-SEL-A5] 다 썼으면 내려놓기
  _drawDeco(); renderDecoInv();
  if (DECO_MODE === 'floor' && st.blocked && st.blocked.length) toast(_floorPaintWhy(st.blocked[0], CUR_FLOOR_TILE, st.blocked.length));   // [DECO-RULE-R1R2]
  if (DECO_MODE !== 'floor') {
    if (st.placed && st.outOfStock) toast('✅ ' + st.placed + '개 놓았어요 — 이제 다 썼어요(카드를 내려놓았어요)');   // [DECO-PT-1] · [DECO-SEL-A5]
    else if (st.placed) toast('✅ ' + st.placed + '개 놓았어요');
    else if (st.outOfStock) toast('가진 개수가 모자라요!');
  }
}

// ══ 바닥 '⬛ 네모로' 칠하기 (DECO-FLOOR-RECT-1 · 정원 바닥 연결 ④-2) ══════════════
//  규칙: docs/deco_floor_picker_20260920.md §5. 한 손가락으로 끌면 시작 칸 ↔ 지금 칸을 모서리로 하는 네모를 미리 보여 주고,
//  손을 떼면 네모 안 칸을 **한꺼번에** 칠한다(집·밭 칸은 건너뜀) · ↩ 한 번 = 네모 하나 · 확인 창 없음 · **지우지 않는다**(칠하기만).
//  한 번 누름은 지금처럼 한 칸(끌어서와 같다) · 두 손가락은 확대·이동(네모는 취소 — 아무것도 안 칠한다).
//  한 번에 칠하는 칸은 DECO_RECT_MAX 까지 — 넘으면 네모가 그 크기에서 멈추고 아래 글에 알린다. 저장은 묶음 저장(decoDirty) 한 번.
const DECO_RECT_MAX = 400;
const DECO_TOOL_KEY = 'deco_floor_tool_v1';
let DECO_FLOOR_TOOL = 'drag';   // 'drag' | 'rect' — 고른 도구는 이 기기에 기억(편의 · 저장값 아님)
try { if (typeof localStorage !== 'undefined' && localStorage.getItem(DECO_TOOL_KEY) === 'rect') DECO_FLOOR_TOOL = 'rect'; } catch (e) {}
function decoFloorTool(t) {
  DECO_FLOOR_TOOL = t === 'rect' ? 'rect' : 'drag';
  try { localStorage.setItem(DECO_TOOL_KEY, DECO_FLOOR_TOOL); } catch (e) {}
  if (typeof _floorPickRender === 'function') _floorPickRender();
}
let _decoRectPrev = null;   // 끄는 동안의 네모 { r0, c0, r1, c1, sr, sc, capped }

//  시작 칸과 지금 칸 → 네모(상한을 넘으면 시작 칸 쪽으로 줄인다 · 순수 함수)
function _decoRectFrom(sr, sc, r, c, max) {
  let h = Math.abs(r - sr) + 1, w = Math.abs(c - sc) + 1, capped = false;
  if (w * h > max) {
    capped = true;
    if (w > max) { w = max; h = 1; }
    else h = Math.max(1, Math.floor(max / w));
  }
  const dr = r >= sr ? 1 : -1, dc = c >= sc ? 1 : -1;
  const r1 = sr + dr * (h - 1), c1 = sc + dc * (w - 1);
  return { r0: Math.min(sr, r1), r1: Math.max(sr, r1), c0: Math.min(sc, c1), c1: Math.max(sc, c1), sr, sc, w, h, capped };
}
//  창 좌표 → 마당 칸(집·밭 위여도 · 판 밖이면 가장자리 칸으로)
function _decoYardCellClamp(clientX, clientY) {
  const bp = _decoBoardPoint(clientX, clientY), C = _dC;
  return { r: Math.max(0, Math.min(DY.rows - 1, Math.floor(bp.y / C))), c: Math.max(0, Math.min(DY.cols - 1, Math.floor(bp.x / C))) };
}
function _decoRectMove(st, clientX, clientY) {
  const k = _decoYardCellClamp(clientX, clientY);
  const p = _decoRectPrev;
  let nx = _decoRectFrom(st.start.r, st.start.c, k.r, k.c, Infinity);
  //  상한을 넘으면 네모는 **마지막으로 된 크기에서 멈춘다**(처음부터 넘으면 시작 칸 쪽으로 줄인 네모)
  if (nx.w * nx.h > DECO_RECT_MAX) nx = p ? Object.assign({}, p, { capped: true }) : _decoRectFrom(st.start.r, st.start.c, k.r, k.c, DECO_RECT_MAX);
  if (p && p.r0 === nx.r0 && p.r1 === nx.r1 && p.c0 === nx.c0 && p.c1 === nx.c1 && p.capped === nx.capped) return;
  if (!st.active) { st.active = true; _dSuppressClick = true; }   // 이제 네모다 — 뗄 때 오는 '한 번 누름'은 칠하지 않는다
  _decoRectPrev = nx;
  _decoRectTip();
  _drawDeco();
}
function _decoRectCancel() { _decoRectPrev = null; _decoRectTip(); _drawDeco(); }
//  손을 뗌 — 네모 안 칸을 한꺼번에(집·밭 건너뜀 · 이미 그 바닥인 칸은 그대로). 되돌리기 한 단계 · 저장 한 번
function _decoRectCommit(st) {
  const p = _decoRectPrev;
  _decoRectPrev = null; _decoRectTip();
  if (!p || !st.active) { _drawDeco(); return 0; }
  const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
  let n = 0; const blocked = [];
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) {
    if (_isHC(r, c) || _isFarmCell(r, c)) continue;
    const key = r + '_' + c, cur = fm[key];
    if (cur === CUR_FLOOR_TILE) continue;
    const blk = _floorPaintBlock(r, c, CUR_FLOOR_TILE);   // [DECO-RULE-R1R2]
    if (blk) { if (blocked.indexOf(blk) < 0) blocked.push(blk); continue; }
    st.stroke.push({ t: 'floor', key, prev: cur }); fm[key] = CUR_FLOOR_TILE; n++;
  }
  if (blocked.length) toast(_floorPaintWhy(blocked[0], CUR_FLOOR_TILE, blocked.length));
  decoUndoStroke(st.stroke);
  if (st.stroke.length) decoDirty();
  _drawDeco();
  return n;
}
//  미리보기 — 칠해질 모습을 반투명(.55)으로 + 금색 점선 테 + 시작 모서리 금색 점. 바닥 그리기는 마당과 같은 _drawFloorSVG
//  (네모 안 = 고른 바닥, 밖 = 지금 마당 → 칠한 뒤 생길 가장자리·물가까지 미리 보인다). _drawDeco 가 판 좌표 변환을 건 뒤 부른다.
function _drawRectPreview() {
  const p = _decoRectPrev; if (!p || !_dCtx) return;
  const C = _dC, fl = _yardFloorGet(CUR), ctx = _dCtx;
  const inR = (r, c) => r >= p.r0 && r <= p.r1 && c >= p.c0 && c <= p.c1 && !_isHC(r, c) && !_isFarmCell(r, c);
  const valAt = (r, c) => inR(r, c) ? CUR_FLOOR_TILE : fl[r + '_' + c];
  const typeAt = (rr, cc, wantRim) => (rr < 0 || cc < 0 || rr >= DY.rows || cc >= DY.cols || _isHC(rr, cc)) ? null : _floorParse(valAt(rr, cc))[wantRim ? 'rim' : 'name'];
  ctx.save(); ctx.globalAlpha = 0.55;
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) {
    if (!inR(r, c)) continue;
    const fp = _floorParse(CUR_FLOOR_TILE);
    if (FLOOR_SVG && _drawFloorSVG(fp.name, r, c, c * C, r * C, C, typeAt, fp.color, fp.rim)) continue;
    const t = FLOOR_TILES[fp.name] || FLOOR_TILES.grass; ctx.fillStyle = t.bg; ctx.fillRect(c * C, r * C, C, C);
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeStyle = '#ffd866';
  ctx.strokeRect(p.c0 * C + 1.5, p.r0 * C + 1.5, (p.c1 - p.c0 + 1) * C - 3, (p.r1 - p.r0 + 1) * C - 3);
  ctx.setLineDash([]); ctx.fillStyle = '#ffd866'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5;
  const x = (p.sc + (p.sc === p.c0 ? 0 : 1)) * C, y = (p.sr + (p.sr === p.r0 ? 0 : 1)) * C;
  ctx.beginPath(); ctx.arc(x, y, Math.max(4, C * 0.18), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
//  아래 글 — '12×9칸 · 손을 떼면 칠해져요 · 잘못하면 ↩' (상한에 닿으면 알림)
function _decoRectTip() {
  const host = document.getElementById('if-topview'); if (!host) return;
  let el = document.getElementById('if-rect-tip');
  const p = _decoRectPrev;
  if (!p) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'if-rect-tip'; el.className = 'deco-rect-tip'; el.setAttribute('role', 'status'); host.appendChild(el); }
  el.hidden = false;
  el.textContent = p.capped ? `${p.w}×${p.h}칸 · 한 번에 ${DECO_RECT_MAX}칸까지예요 · 손을 떼면 칠해져요`
    : `${p.w}×${p.h}칸 · 손을 떼면 칠해져요 · 잘못하면 ↩`;
  el.classList.toggle('is-capped', !!p.capped);
}

// [INDOOR-ROOMS-1] 지금 한 손가락 끌기가 '방 네모'인가 — 집 안 🖌️ 판의 ⬛ 방 탭에서 크기 칩·없애기를 안 골랐을 때
function _inRoomDragMode() { return DECO_MODE === 'floor' && DECO_SCENE !== 'yard' && _inPk.tab === 'room' && !_inPk.tool; }
//  [DECO-ROOM-HOUSE-1] 크기 칩을 고른 채 마우스가 판 위에 있으면 누르면 지어질 자리(붙는 자리로 옮겨질 곳)를 금색으로 — 칸이 바뀔 때만 다시 그린다
function _inChipMode() { return DECO_MODE === 'floor' && DECO_SCENE !== 'yard' && _inPk.tab === 'room' && /^s[012]$/.test(_inPk.tool || ''); }
function _inChipGhost(clientX, clientY) {
  if (!_dCv) return;
  const k = _inCellClamp(clientX, clientY), g = _inRoomPrev && _inRoomPrev.ghost ? _inRoomPrev : null;
  if (g && g.kr === k.r && g.kc === k.c && g.tool === _inPk.tool) return;
  const raw = _inChipRect(k.r, k.c, ROOM_SIZES[+_inPk.tool.slice(1)]), pl = _inRoomPlan(_inRooms(CUR), raw, true);
  _inRoomPrevSet(Object.assign({}, pl.rect, { why: pl.why, moved: pl.moved, raw: pl.moved ? raw : null, ghost: true, kr: k.r, kc: k.c, tool: _inPk.tool }));
}
// [DECO-ROOM-RESIZE-1] 방 크기 바꾸기 — ⬛ 방(네모 끌기)일 때 방 가장자리·모서리를 누르고 끌면 그 변이 따라온다(계획 C8 · 묶음 7).
//  같은 규칙(크기 · 다른 방과 벽 한 줄 · 벽이 가구를 가르지 않음 — _inRoomWhy)으로 미리 보고, 떼면 ↩ 한 단계. 저장 모양은 그대로(r,c,w,h 숫자만).
//  윗변을 옮기면 벽이 옮겨 간다 → 옛 벽에 걸린 액자는 가방으로(R4 · 같은 ↩ 에 담긴다).
function _inRoomEdgeAt(clientX, clientY) {
  if (!_dCv) return null;
  const bp = _decoBoardPoint(clientX, clientY), C = _dC, fx = (bp.x - (_dCv._offX || 0)) / C, fy = (bp.y - (_dCv._offY || 0)) / C;
  const t = Math.max(.45, 12 / C);   // 손가락 몫 — 칸이 작으면 넉넉히
  for (const rm of _inRooms(CUR)) {
    const inX = fx > rm.c - t && fx < rm.c + rm.w + t, inY = fy > rm.r - 1 - t && fy < rm.r + rm.h + t;
    const L = inY && Math.abs(fx - rm.c) < t, R = inY && Math.abs(fx - (rm.c + rm.w)) < t;
    const T = inX && (Math.abs(fy - rm.r) < t || Math.abs(fy - (rm.r - 1)) < t), B = inX && Math.abs(fy - (rm.r + rm.h)) < t;
    if (L || R || T || B) return { rm, L, R: R && !L, T, B: B && !T, fx, fy };
  }
  return null;
}
//  잡은 변을 끈 거리(칸 · 반올림)만큼 옮긴다 — 손가락 아래 칸으로 맞추면 오른쪽·아래 변이 한 칸 더 갔다(놀이판에서 잡음)
function _inRoomResized(e, clientX, clientY) {
  const rm = e.rm, bp = _decoBoardPoint(clientX, clientY), C = _dC;
  const dc = Math.round((bp.x - (_dCv._offX || 0)) / C - e.fx), dr = Math.round((bp.y - (_dCv._offY || 0)) / C - e.fy);
  let r0 = rm.r, c0 = rm.c, r1 = rm.r + rm.h - 1, c1 = rm.c + rm.w - 1;
  if (e.L) c0 += dc; if (e.R) c1 += dc; if (e.T) r0 += dr; if (e.B) r1 += dr;
  return _inRoomFrom(r0, c0, r1, c1);
}
function _inRoomCursor(e) { return !e ? '' : (e.L || e.R) && (e.T || e.B) ? ((e.L && e.T) || (e.R && e.B) ? 'nwse-resize' : 'nesw-resize') : (e.L || e.R) ? 'ew-resize' : 'ns-resize'; }
function _inCellClamp(clientX, clientY) {
  const bp = _decoBoardPoint(clientX, clientY), C = _dC, ox = _dCv._offX || 0, oy = _dCv._offY || 0;
  return { r: Math.max(0, Math.min(DI.rows - 1, Math.floor((bp.y - oy) / C))), c: Math.max(0, Math.min(DI.cols - 1, Math.floor((bp.x - ox) / C))) };
}
// 창 기준 px → 판 px (클릭·핀치 공용)
function _decoBoardPoint(clientX, clientY) {
  const rect = _dCv.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (_dW / rect.width) + _dPanX,
    y: (clientY - rect.top) * (_dH / rect.height) + _dPanY,
  };
}


// ══ 꾸미기 동물 움직임 (DECO-ANIM-1) ══════════════════════
//  캔버스 위에 투명한 층을 얹고, 마당 동물만 그 층의 <img> 로 놓는다.
//  · 움직임은 CSS 전환(transition)이 한다 — 코드는 몇 초에 한 번 "다음 칸"만 정하고 손을 뗀다.
//    → requestAnimationFrame 루프 없음 · 캔버스 다시 그리기 없음.
//  · 돌아다니는 위치는 **화면에만** 있다. DB 쓰기 0 (꾸미기는 조작 한 번마다 학생 문서를
//    통째로 저장하는 구조라, 위치를 저장하면 저장이 쉬지 않는다).
//  · 캔버스는 이 동물들을 그리지 않는다(_drawYard 에서 건너뜀) — 두 마리로 보이지 않게.
//  · 친구 방 구경(ff-topview)도 같은 층을 쓴다.
//  한계(1판): 층이 캔버스 위라 키 큰 장식 뒤로 가도 앞에 보인다 → 반지름을 좁게 둔다.

//  ground: 갈 수 있는 바닥 묶음 · water:true = 물에 놓으면 물 안에서만(헤엄)
//  say: 누르면 뜨는 말 · mood: 성격(ANIM_MOOD — 가만히·쪼기·걷기 · 빠르기)
const ANIM_DECO = {
  d_y32: { radius: 3, mood: 'duck',  ground: ['soft', 'water'], water: true,  say: '꽥!',     name: '오리' },
  d_y39: { radius: 3, mood: 'hen',  ground: ['soft'],                        say: '꼬꼬댁',  name: '닭' },
  d_y40: { radius: 2, mood: 'sheep', ground: ['soft'],                        say: '메~',     name: '양', artLeft: true },   // 그림이 왼쪽을 본다
  d_y53: { radius: 4, mood: 'dog',  ground: ['soft', 'hard'], come: true,    say: '왈!',     name: '강아지' },
  d_y54: { radius: 4, mood: 'cat',  ground: ['soft', 'hard'],                say: '야옹',    name: '고양이' },
  d_y55: { radius: 3, mood: 'hen',  ground: ['soft'],                        say: '꼬꼬댁',  name: '닭' },
  d_y56: { radius: 3, mood: 'duck',  ground: ['soft', 'water'], water: true,  say: '꽥!',     name: '오리' },
  d_y57: { radius: 2, mood: 'sheep', ground: ['soft'],                        say: '메~',     name: '양' },
};

// [DECO-FENCE-1] 울타리 자동 이음 — 아이가 가로·세로·코너를 고르지 않는다.
//  장식 표에 autoFence:true 인 장식(🚧 울타리) 하나만 상점에 두고,
//  놓으면 이웃 울타리를 보고 네 그림 중 맞는 것으로 그린다(바닥 타일이 이미 그렇게 이어진다).
//  옛 4종(d_y49~52)은 표에 그대로 남는다 — 이미 산 아이가 인벤토리에서 놓을 수 있다.
//  그림 id — 방향은 **그림에서 난간이 실제로 뻗는 쪽**으로 잰 값이다(디자인 2 실측).
//   d_y49 ─(왼+오른) · d_y50 │(위+아래) · d_y51 └(위+오른) · d_y52 ┘(위+왼)
//   d_y71 ┌(아래+오른) · d_y72 ┐(아래+왼) — 아래로 꺾이는 두 장은 그림이 생기면 쓰고,
//   없으면 세로(│)로 대신한다(줄은 이어져 보이고 모퉁이만 각이 안 진다).
const FENCE_IDS = ['d_y49', 'd_y50', 'd_y51', 'd_y52', 'd_y70', 'd_y71', 'd_y72'];
const FENCE_ART = { h: 'd_y49', v: 'd_y50', ur: 'd_y51', ul: 'd_y52', dr: 'd_y71', dl: 'd_y72' };

//  그 그림이 장식 표에 있나 — 없으면 대신 쓸 것을 준다
function _fenceArtOr(id, fallback) {
  return GAME_DATA.decorations.some(x => x.id === id) ? id : fallback;
}

function _isFenceCell(student, r, c) {
  const list = _decoList(student);   // [DECO-SPACE-1]
  for (const p of list) {
    if (p.area !== 'yard' || p.row !== r || p.col !== c) continue;
    if (FENCE_IDS.indexOf(p.id) >= 0) return true;
    const d = GAME_DATA.decorations.find(x => x.id === p.id);
    if (d && d.autoFence) return true;
  }
  return false;
}

//  이웃을 보고 어느 그림으로 그릴지 — 순수 함수(단위 시험용)
//   ① 좌우로 지나가면 가로 ─ (세 갈래·네 갈래도 가로로 읽는 게 낫다)
//   ② 위아래로 지나가면 세로 │
//   ③ 한 번 꺾이면 그 모퉁이 그림 └ ┘ ┌ ┐
//   ④ 이웃이 하나면 그 방향(좌·우 → 가로 · 위·아래 → 세로) · 없으면 가로
function _fencePick(hasL, hasR, hasU, hasD) {
  if (hasL && hasR) return FENCE_ART.h;
  if (hasU && hasD) return FENCE_ART.v;
  if (hasU && hasR) return FENCE_ART.ur;
  if (hasU && hasL) return FENCE_ART.ul;
  if (hasD && hasR) return _fenceArtOr(FENCE_ART.dr, FENCE_ART.v);
  if (hasD && hasL) return _fenceArtOr(FENCE_ART.dl, FENCE_ART.v);
  if (hasU || hasD) return FENCE_ART.v;
  return FENCE_ART.h;
}

function _fenceArtFor(student, r, c) {
  return _fencePick(_isFenceCell(student, r, c - 1), _isFenceCell(student, r, c + 1),
                    _isFenceCell(student, r - 1, c), _isFenceCell(student, r + 1, c));
}

// [DECO-FEED-1] 먹이통 — 놓으면 가까운 동물이 모인다(장식 표의 feeder:true).
//  · 먹이통 칸을 기준으로 정해진 거리 안에 있는 동물만.
//  · 우리 안 동물은 그 우리 안에 있는 먹이통에만 모인다.
//  · 저장하지 않는다. 먹이·수입 같은 값은 없다(그건 밸런스 결정이다).
const FEED_RANGE = 7;
function _feedersOf(student) {
  return _decoList(student).filter(p => {   // [DECO-SPACE-1]
    if (p.area !== 'yard') return false;
    const d = GAME_DATA.decorations.find(x => x.id === p.id);
    return !!(d && d.feeder);
  });
}
//  이 동물이 갈 먹이통 — 없으면 null
function _feederFor(student, st, feeders) {
  let best = null, bestDist = 1e9;
  for (const f of feeders) {
    if (st.pen && (f.row < st.pen.r0 || f.row > st.pen.r1 || f.col < st.pen.c0 || f.col > st.pen.c1)) continue;
    const dist = Math.abs(f.row - st.home.row) + Math.abs(f.col - st.home.col);
    if (dist > (st.pen ? 99 : FEED_RANGE)) continue;
    if (dist < bestDist) { bestDist = dist; best = f; }
  }
  return best;
}

// [DECO-ANIM-3] 우리(pen) — 장식 표에 pen:true 인 장식(닭장·목장·연못 우리 등).
//  · 동물은 우리 칸을 지날 수 있다(다른 장식은 못 지난다).
//  · 우리 안에 놓인 동물은 반지름 대신 **그 우리 안**에서만 돌아다닌다 → 마당이 어지럽지 않다.
function _isPenDeco(id) {
  const d = GAME_DATA.decorations.find(x => x.id === id);
  return !!(d && d.pen);
}
//  (r,c) 를 품은 우리의 사각형을 준다. 없으면 null.
function _penAt(student, r, c) {
  const list = _decoList(student);   // [DECO-SPACE-1]
  for (const p of list) {
    if (p.area !== 'yard' || !_isPenDeco(p.id)) continue;
    const sz = getDecoSize(p.id);
    if (r >= p.row && r < p.row + sz.h && c >= p.col && c < p.col + sz.w) {
      const d = GAME_DATA.decorations.find(x => x.id === p.id);
      //  울타리 줄(footprint 가장자리)에는 서지 않는다 — 동물 층이 캔버스 위라
      //  울타리 칸에 서면 '우리 안'이 아니라 '울타리 위'로 보인다.
      //  안쪽이 한 칸도 안 남는 작은 우리는 어쩔 수 없이 footprint 전체를 쓴다.
      let r0 = p.row + 1, c0 = p.col + 1, r1 = p.row + sz.h - 2, c1 = p.col + sz.w - 2;
      if (r1 < r0 || c1 < c0) { r0 = p.row; c0 = p.col; r1 = p.row + sz.h - 1; c1 = p.col + sz.w - 1; }
      return { r0, c0, r1, c1, water: !!(d && d.penWater) };
    }
  }
  return null;
}

// [DECO-ANIM-2] 바닥 묶음 — 아이가 🖌️ 바닥으로 칠한 타일을 셋으로 본다
const GROUND_HARD = ['stone', 'brick', 'gravel', 'gravel_yard', 'wood', 'deck', 'stone_floor'];
function _groundKind(type) {
  if (type === 'water') return 'water';
  return GROUND_HARD.indexOf(type) >= 0 ? 'hard' : 'soft';   // 그 외는 풀·흙
}
function _groundAt(student, r, c) {
  return _groundKind(_floorParse(_yardFloorGet(student)[r + '_' + c]).name);   // [DECO-SPACE-1] · 색·마감이 붙은 꽃밭도 이름으로 본다
}
//  이 동물을 (r,c) 에 놓을 수 있나 — 바닥만 본다(겹침은 canPlaceDeco 가 본다)
function _animGroundOk(id, student, r, c, w, h) {
  const cfg = ANIM_DECO[id];
  if (!cfg) return true;
  for (let dr = 0; dr < (h || 1); dr++) for (let dc = 0; dc < (w || 1); dc++) {
    if (cfg.ground.indexOf(_groundAt(student, r + dr, c + dc)) < 0) return false;
  }
  return true;
}
//  왜 안 되는지 아이 말로
function _animWhyNot(id) {
  const cfg = ANIM_DECO[id];
  if (!cfg) return '여기엔 놓을 수 없어요';
  if (cfg.water) return '🦆 ' + cfg.name + '는 물이나 풀밭에 놓아 주세요';
  if (cfg.ground.indexOf('hard') >= 0) return '🐶 ' + cfg.name + '는 물에는 못 들어가요';
  return '🐑 ' + cfg.name + '은 풀밭이나 흙에 놓아 주세요';
}

// ══ 살아 있는 동물 (DECO-ANIM-LIVE-1 · 디자인 'B 크게' · 창조자 27회 ⓑ55~57) ══════════════
//  전: 동물마다 setTimeout 이 4~8초에 한 번 '옆 칸'을 정하고 CSS 전환 1초로 **미끄러졌다**(물건을 뚫고 · 걸음 그림 없이 · 2px 들썩임만).
//  지금:
//  · 상태 하나(st.state = idle · walk · peck · sleep · happy)가 그림 한 장을 고른다 — 디자인의 <id>_<상태>.svg(부위 나눈 SVG 가
//    그림 안 CSS 로 스스로 숨 쉬고 걷는다). 그 장이 없으면 옛 장(<id>.svg · 걸음 <id>_b · 먹기 <id>_eat · 헤엄 <id>_swim).
//  · 칸 길찾기(BFS · 4방향)로 장식·울타리·집·밭·다른 동물을 **돌아간다**. 가는 칸·목표 칸을 예약해 둘이 한 칸에 겹치지 않는다.
//  · 걸음은 칸마다 0.6초(첫·끝 칸은 0.76초로 천천히 서고 떠난다) · 가는 쪽을 본다 · 성격(ANIM_MOOD)이 빠르기·쉬는 시간을 정한다.
//  · 먹이통 = 둘레 고리(체비쇼프 1칸 → 다 차면 2칸)의 빈 칸으로 흩어져 모이고, 칸 안에서 조금씩 비켜 서서 먹이통을 보고 쫀다(세로 한 줄로 서지 않는다).
//  · 누르면 happy 한 번 + 💗 + 소리 글자 · 둘레의 가만히 있는 동물이 그쪽을 본다 · 강아지는 누른 쪽으로 한 칸 온다.
//  · 모든 동물이 **한 돌림**(걷는 동안만 requestAnimationFrame · 쉬는 동안은 다음 생각 때까지 타이머 하나)을 쓴다.
//    화면 밖 · 숨은 탭 · 움직임 줄이기면 쉬고, 그림은 지금 한 장(<id>.svg — 그림 안 움직임도 멈춘다).
//  · 위치는 **화면에만** 있다. DB 쓰기 0(전과 같음). 밤(쉼터에 모여 자기)은 꾸미기에 낮밤이 붙은 뒤(계획 ⑮).
const ANIM_MOOD = {   // 성격 한 줄 — 가만히·쪼기 확률(나머지는 걷기) · 쉬는 시간(ms) · 한 번에 걷는 칸 · 빠르기(1 = 칸당 0.6초)
  hen:   { idle: .35, peck: .35, rest: [1200, 3000], steps: [1, 3], speed: 1.0 },    // 닭 — 부산하다
  duck:  { idle: .45, peck: .20, rest: [1500, 3500], steps: [1, 3], speed: .9 },
  sheep: { idle: .60, peck: .30, rest: [3000, 7000], steps: [1, 2], speed: .7 },     // 양 — 느긋하다
  dog:   { idle: .30, peck: .10, rest: [800, 2200],  steps: [2, 4], speed: 1.35 },   // 강아지 — 들떴다
  cat:   { idle: .55, peck: .10, rest: [2500, 6000], steps: [1, 3], speed: .9 },
};
const ANIM_STEP_MS = 600;
const _animArt = {};   // id → { idle, walk, peck, sleep, happy, swim, b, eat : true | false(없음) | undefined(확인 중) }
const ANIM_ART_KEYS = ['idle', 'walk', 'peck', 'sleep', 'happy', 'swim', 'b', 'eat'];
function _animProbeArt(id) {
  if (_animArt[id]) return _animArt[id];
  if (_artStart() === 'loading') return {};   // [DECO-BUNDLE-1] 묶음이 오면 _artReady 가 다시 부른다
  const a = _animArt[id] = {};
  if (_ART.state === 'ready') { ANIM_ART_KEYS.forEach(k => { a[k] = !!_artHas('deco/' + id + '_' + k + '.svg'); }); return a; }   // 묶음 목록으로 — 요청 0
  if (typeof Image !== 'function') return a;
  ANIM_ART_KEYS.forEach(k => {
    const img = new Image();
    img.onload = () => { a[k] = img.naturalWidth > 0; _animLayers.forEach(rec => rec.items.forEach(st => { if (st.id === id) _animApplySrc(st); })); };
    img.onerror = () => { a[k] = false; };
    img.src = './assets/deco/' + encodeURIComponent(id) + '_' + k + '.svg';
  });
  return a;
}
function _animFile(id, k) { return _artSrc('deco/' + id + (k ? '_' + k : '') + '.svg'); }   // [DECO-BUNDLE-1] 받는 중이면 null
//  이 상태에 쓸 그림 — 새 상태 장 → 옛 장 → 한 장
function _animSrcFor(st, state) {
  const a = _animArt[st.id] || {};
  if (st.frozen) return _animFile(st.id, '');
  if (st.swim && a.swim && (state === 'idle' || state === 'walk' || state === 'peck')) {
    const sf = typeof _yardLook === 'function' ? _yardLook().swimFrag : '';   // [DECO-STAR-P3] 별물 위 헤엄 = 물 띠도 별물 색(#star)
    return sf ? _artSrc('deco/' + st.id + '_swim.svg', sf) : _animFile(st.id, 'swim');
  }
  if (a[state]) return _animFile(st.id, state);
  if (state === 'walk' && a.b) return _animFile(st.id, 'b');
  if (state === 'peck' && a.eat && !st.swim) return _animFile(st.id, 'eat');
  if (a.idle && state !== 'idle') return _animFile(st.id, 'idle');
  return _animFile(st.id, '');
}
function _animApplySrc(st) {
  if (!st.img) return;
  const want = _animSrcFor(st, st.state || 'idle');
  if (want && st.src !== want) { st.img.src = want; st.src = want; }
  const a = _animArt[st.id] || {};
  st.el.classList.toggle('live', !st.frozen && !!a.idle);          // 부위 그림이 스스로 숨 쉰다 — 들썩임은 끈다
  st.el.classList.toggle('walking', !st.frozen && st.state === 'walk');
}
function _animSetState(st, s) { st.state = s; _animApplySrc(st); }
function _animFace(st, dir) {
  if (!dir) return;
  st.dir = dir;
  if (st.img) st.img.style.transform = 'scaleX(' + (st.cfg.artLeft ? -dir : dir) + ')';   // 왼쪽을 보는 그림은 반대로
}
function _animPlace(st) {
  st.el.style.transform = 'translate(' + ((st.fx + (st.jx || 0)) * st.C) + 'px,' + ((st.fy + (st.jy || 0)) * st.C) + 'px)';
  st.el.style.zIndex = String(Math.round(st.fy));
}
function _animRnd(a, b) { return a + Math.random() * (b - a); }

const _animLayers = new Map();   // hostId → { layer, world, items: Map(key → state) }
let _animHooked = false;

function _animReduced() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (e) { return false; }
}

// 그 칸에 설 수 있나 — 판 안 · 집 영역 아님 · 농장 칸 아님 · 다른 장식 없음(동물끼리는 지나갈 수 있다)
// [DECO-RULE-R5] 키 큰 장식의 그림은 발밑 칸보다 위로 솟는다(벚나무 약 0.9칸 · 헛간 1.6칸 · 정자 0.3칸 — bbox.json 의 그린 부분 위 끝).
//  동물 층은 캔버스 위라, 솟은 부분이 덮는 칸(= 그 장식 바로 뒷줄)에 선 동물은 **지붕·나무 꼭대기 위에** 그려졌다(디자인 담당 D6).
//  그 칸에는 동물이 걷지도 놓이지도 않는다. 솟은 부분이 칸의 20% 이하로 걸치면 막지 않는다(꽃 같은 낮은 것).
//  그림 상자가 아직 안 왔으면 막지 않는다(더 막아서 아이가 헷갈리지 않게). 우리(pen)는 동물이 지나가는 것이라 뺀다.
function _decoOverflowCells(p) {
  const bb = _decoBBox && _decoBBox[p.id];
  if (!Array.isArray(bb) || !(bb[4] > 0) || !(bb[5] > 0)) return [];
  const sz = getDecoSize(p.id), per = sz.w / bb[4];             // 그림 한 단위 = 칸 몇 개(폭을 발밑에 맞춰 그린다)
  const over = (bb[5] - bb[1]) * per - sz.h;                    // 발밑 칸 위로 솟은 칸 수
  const k = Math.ceil(over - 0.2);
  if (k <= 0) return [];
  const c0 = p.col + Math.floor(bb[0] * per), c1 = p.col + Math.ceil((bb[0] + bb[2]) * per) - 1, out = [];
  for (let dr = 1; dr <= k; dr++) for (let c = Math.max(p.col, c0); c <= Math.min(p.col + sz.w - 1, c1); c++) out.push([p.row - dr, c]);
  return out;
}
//  (r,c) 가 어느 장식의 솟은 그림 밑인가 — 그 장식(없으면 null)
const _decoOverflowMemo = { key: '', map: null };
function _decoOverflowAt(student, r, c) {
  //  [DECO-SEL-HL-1] 내 마당은 상태가 같으면 한 번 센 지도를 쓴다(놓을 칸 모음이 칸마다 부른다)
  if (student === CUR) {
    const key = [DECO_SPACE, _decoStateVer, !!_decoBBox, (CUR.houseDecorations || []).length].join('|');
    if (_decoOverflowMemo.key !== key) {
      const map = new Map();
      _decoList(CUR).forEach(p => { if (p.area !== 'yard' || ANIM_DECO[p.id] || _isPenDeco(p.id)) return;
        _decoOverflowCells(p).forEach(([rr, cc]) => { if (!map.has(rr + '_' + cc)) map.set(rr + '_' + cc, p); }); });
      _decoOverflowMemo.key = key; _decoOverflowMemo.map = map;
    }
    return _decoOverflowMemo.map.get(r + '_' + c) || null;
  }
  for (const p of _decoList(student)) {
    if (p.area !== 'yard' || ANIM_DECO[p.id] || _isPenDeco(p.id)) continue;
    if (_decoOverflowCells(p).some(([rr, cc]) => rr === r && cc === c)) return p;
  }
  return null;
}

// ══ 놓을 곳 표시 (DECO-SEL-HL-1 · 디자인 D8) ══════════════════
//  전: 놓일 수 있는 **시작 칸마다** 장식 크기 네모를 겹쳐 칠해 큰 장식일수록 겹친 곳이 하얗게 얼룩졌다 · 매 프레임 보이는 칸마다 다시 셌다 ·
//      물·동물 뒷줄·방 벽 같은 규칙(_decoRuleWhy)은 안 봐서 '밝은데 안 놓이는 칸'이 있었다.
//  후: 놓을 수 있는 자리들이 덮는 칸을 **칸마다 한 번** 옅게 + 그 둘레에 한 줄 · 규칙까지 본다 · 카드·공간·장면·상태가 같으면 다시 안 센다.
//      마우스면 커서 칸에 놓일 모습을 반투명으로(놓이면 초록 점선, 안 되면 붉은 점선). 터치는 누르면 바로 놓이니 미리 보기가 없다.
let _decoStateVer = 0;
const _decoOkMemo = { key: '', cells: null };
function _decoOkCells(area) {
  const R = area === 'yard' ? DY : DI;
  const key = [SEL_DECO, area, DECO_SPACE, _decoStateVer, !!_decoBBox, R.cols, R.rows, (CUR.houseDecorations || []).length].join('|');
  if (_decoOkMemo.key === key) return _decoOkMemo.cells;
  const sz = getDecoSize(SEL_DECO), occ = new Map(), cells = new Set();
  _decoList(CUR).forEach(p => { if (p.area !== area) return; const z = getDecoSize(p.id);
    for (let dr = 0; dr < z.h; dr++) for (let dc = 0; dc < z.w; dc++) { const k = (p.row + dr) + '_' + (p.col + dc); (occ.get(k) || occ.set(k, []).get(k)).push(p); } });
  const cellOk = (r, c) => {   // canPlaceDeco 와 같은 잣대(판 안 · 집 · 밭 · 겹침 허용)를 칸 지도로
    if (area === 'yard' && (_isHC(r, c) || _isFarmCell(r, c))) return false;
    const o = occ.get(r + '_' + c);
    return !o || o.every(p => _decoOverlapOk(SEL_DECO, p));
  };
  for (let r = 0; r + sz.h <= R.rows; r++) for (let c = 0; c + sz.w <= R.cols; c++) {
    let ok = true;
    for (let dr = 0; dr < sz.h && ok; dr++) for (let dc = 0; dc < sz.w && ok; dc++) ok = cellOk(r + dr, c + dc);
    if (!ok || _decoRuleWhy(SEL_DECO, area, r, c, sz.w, sz.h)) continue;
    if (area === 'yard' && ANIM_DECO[SEL_DECO] && !_animGroundOk(SEL_DECO, CUR, r, c, sz.w, sz.h)) continue;
    for (let dr = 0; dr < sz.h; dr++) for (let dc = 0; dc < sz.w; dc++) cells.add((r + dr) + '_' + (c + dc));
  }
  _decoOkMemo.key = key; _decoOkMemo.cells = cells;
  return cells;
}
//  칸마다 한 번 옅게 + 둘레 한 줄 — (ox,oy) 는 판 왼쪽 위(집 안은 _offX/_offY), v 는 보이는 칸 범위
//  also = 그리기만 같은 덩어리로 칠 칸(놓을 수는 없다) — [DECO-ANIM-LIVE-1] 동물이 떠난 제자리(ⓑ58: 빈 어두운 네모 + 둘레 줄이 흩어져 보였다)
function _decoDrawOkCells(cells, ox, oy, C, v, also) {
  const ctx = _dCtx, has = (r, c) => cells.has(r + '_' + c) || !!(also && also.has(r + '_' + c));
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  for (let r = v.r0; r < v.r1; r++) for (let c = v.c0; c < v.c1; c++) if (has(r, c)) ctx.fillRect(ox + c * C, oy + r * C, C, C);
  ctx.strokeStyle = 'rgba(255,240,150,.7)'; ctx.lineWidth = Math.max(1, C * .06); ctx.beginPath();
  for (let r = v.r0; r < v.r1; r++) for (let c = v.c0; c < v.c1; c++) {
    if (!has(r, c)) continue;
    const x = ox + c * C, y = oy + r * C;
    if (!has(r - 1, c)) { ctx.moveTo(x, y); ctx.lineTo(x + C, y); }
    if (!has(r + 1, c)) { ctx.moveTo(x, y + C); ctx.lineTo(x + C, y + C); }
    if (!has(r, c - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + C); }
    if (!has(r, c + 1)) { ctx.moveTo(x + C, y); ctx.lineTo(x + C, y + C); }
  }
  ctx.stroke();
}
//  동물 '제자리'(놓은 칸) 중 다른 장식이 없는 칸 — 놓을 곳 표시를 그릴 때만 덩어리에 넣는다
function _decoAnimHomeCells() {
  const out = new Set(), other = new Set();
  _decoList(CUR).forEach(p => { if (p.area !== 'yard') return; const z = getDecoSize(p.id);
    for (let dr = 0; dr < z.h; dr++) for (let dc = 0; dc < z.w; dc++) (ANIM_DECO[p.id] ? out : other).add((p.row + dr) + '_' + (p.col + dc)); });
  other.forEach(k => out.delete(k));
  return out;
}
//  마우스 커서 칸에 놓일 모습(반투명) — 초록 점선 = 놓임 · 붉은 점선 = 안 됨
let _decoHover = null;
function _decoDrawGhost(area, ox, oy, C) {
  const h = _decoHover;
  if (!h || h.area !== area || !SEL_DECO) return;
  const d = GAME_DATA.decorations.find(x => x.id === SEL_DECO); if (!d || d.cat !== area) return;
  const sz = getDecoSize(SEL_DECO), ok = canPlaceDeco(h.r, h.c, sz.w, sz.h, area, null) && !_decoRuleWhy(SEL_DECO, area, h.r, h.c, sz.w, sz.h)
    && !(area === 'yard' && ANIM_DECO[SEL_DECO] && !_animGroundOk(SEL_DECO, CUR, h.r, h.c, sz.w, sz.h));
  const x = ox + h.c * C, y = oy + h.r * C, ctx = _dCtx;
  ctx.save(); ctx.globalAlpha = .55; _drawDecoSVG(SEL_DECO, x, y, sz.w * C, sz.h * C); ctx.restore();
  ctx.save(); ctx.setLineDash([Math.max(3, C * .25), Math.max(2, C * .15)]); ctx.lineWidth = 2;
  ctx.strokeStyle = ok ? 'rgba(90,220,120,.95)' : 'rgba(255,110,90,.95)'; ctx.strokeRect(x + 1, y + 1, sz.w * C - 2, sz.h * C - 2); ctx.restore();
}
function _animFreeMaker(student, rows, cols) {
  const taken = new Set();
  _decoList(student).forEach(p => {   // [DECO-SPACE-1]
    if (p.area !== 'yard' || ANIM_DECO[p.id]) return;
    if (_isPenDeco(p.id)) return;   // [DECO-ANIM-3] 우리 안은 동물이 지날 수 있다
    const sz = getDecoSize(p.id);
    for (let dr = 0; dr < sz.h; dr++) for (let dc = 0; dc < sz.w; dc++) taken.add((p.row + dr) + '_' + (p.col + dc));
    _decoOverflowCells(p).forEach(([r, c]) => taken.add(r + '_' + c));   // [DECO-RULE-R5] 솟은 그림 밑(바로 뒷줄)
  });
  //  id 를 주면 그 동물이 갈 수 있는 바닥까지 본다(DECO-ANIM-2).
  //  swim = 물에 놓인 동물이면 물에서만 다닌다.
  return function (r, c, w, h, id, swim, penWater) {
    if (r < 0 || c < 0 || r + h > rows || c + w > cols) return false;
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const tr = r + dr, tc = c + dc;
      if (_isHC(tr, tc)) return false;
      if (_isFarmCell(tr, tc)) return false;
      if (taken.has(tr + '_' + tc)) return false;
      if (id) {
        const g = _groundAt(student, tr, tc);
        if (penWater) { /* 물 있는 우리 안은 그 자체가 물이다 */ }
        else if (swim) { if (g !== 'water') return false; }          // 헤엄 중이면 물만
        else if (g === 'water') return false;                        // 땅 동물은 물에 안 들어간다
        else if (ANIM_DECO[id].ground.indexOf(g) < 0) return false;  // 동물마다 다니는 바닥
      }
    }
    return true;
  };
}

//  다른 동물이 차지한 칸인가 — 지금 칸 · 가는 칸 · 목표 칸(예약)을 모두 본다
function _animOccMaker(rec, me) {
  const others = [...rec.items.values()].filter(o => o !== me);
  const hit = (r, c, w, h, cell) => cell && r < cell.row + h && cell.row < r + me.h && c < cell.col + w && cell.col < c + me.w;
  return (r, c) => others.some(o => hit(r, c, o.w, o.h, o.cur) || (o.seg && hit(r, c, o.w, o.h, { row: o.seg.r1, col: o.seg.c1 })) || hit(r, c, o.w, o.h, o.goal));
}
//  다닐 수 있는 네모 — 우리 안이면 그 안(울타리 줄 뺀 곳) · 아니면 놓은 자리에서 반지름(먹이통이 있으면 거기까지 넉넉히)
function _animBounds(st) {
  if (st.pen) return { r0: st.pen.r0, c0: st.pen.c0, r1: st.pen.r1 - (st.h - 1), c1: st.pen.c1 - (st.w - 1) };
  const R = st.feeder || st.shelter ? Math.max(st.cfg.radius, FEED_RANGE + 2) : st.cfg.radius;
  return { r0: st.home.row - R, r1: st.home.row + R, c0: st.home.col - R, c1: st.home.col + R };
}
//  칸 길찾기(BFS · 4방향) — goal(r,c) 를 만족하는 가장 가까운 칸까지의 길(시작 칸 뺌) · 없으면 null. 순수(시험용)
function _animBfs(st, goal, occ) {
  const b = _animBounds(st), K = (r, c) => r * 4096 + c, pw = !!(st.pen && st.pen.water);
  const s0 = st.cur, prev = new Map([[K(s0.row, s0.col), -1]]), q = [[s0.row, s0.col]];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - .5);
  for (let qi = 0; qi < q.length && qi < 2000; qi++) {
    const [r, c] = q[qi];
    if ((r !== s0.row || c !== s0.col) && goal(r, c)) {
      const out = []; let k = K(r, c);
      while (k !== K(s0.row, s0.col)) { out.unshift({ row: Math.floor(k / 4096), col: k % 4096 }); k = prev.get(k); }
      return out;
    }
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc, nk = K(nr, nc);
      if (nr < b.r0 || nr > b.r1 || nc < b.c0 || nc > b.c1 || prev.has(nk)) continue;
      if (!st.isFree(nr, nc, st.w, st.h, st.id, st.swim, pw) || (occ && occ(nr, nc))) continue;
      prev.set(nk, K(r, c)); q.push([nr, nc]);
    }
  }
  return null;
}

// ── 한 돌림 — 걷는 동물이 있으면 매 틀, 없으면 다음 생각할 때까지 타이머 하나 ──
let _animRaf = 0, _animRafT = false, _animWakeT = 0;
function _animKick() {
  if (_animRaf) return;
  if (_animWakeT) { clearTimeout(_animWakeT); _animWakeT = 0; }
  if (typeof requestAnimationFrame === 'function') { _animRafT = false; _animRaf = requestAnimationFrame(_animFrame); }
  else { _animRafT = true; _animRaf = setTimeout(_animFrame, 16); }
}
function _animFrame() { _animRaf = 0; _animTick(Date.now()); }
function _animLoopStop() {
  if (_animRaf) { if (_animRafT) clearTimeout(_animRaf); else if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_animRaf); _animRaf = 0; }
  if (_animWakeT) { clearTimeout(_animWakeT); _animWakeT = 0; }
}
function _animTick(now) {
  if (typeof document !== 'undefined' && document.hidden) return;   // 숨은 탭 — visibilitychange 가 다시 깨운다
  let moving = false, soon = Infinity;
  _animLayers.forEach(rec => rec.items.forEach(st => {
    if (st.frozen) return;
    if (st.seg) _animAdvance(st, now);
    if (!st.seg && now >= st.nextAt) _animThink(st, now);
    if (st.seg) moving = true; else soon = Math.min(soon, st.nextAt);
  }));
  if (moving) _animKick();
  else if (soon < Infinity && !_animWakeT) _animWakeT = setTimeout(() => { _animWakeT = 0; _animKick(); }, Math.max(16, soon - now));
}

// ── 걷기 ──
function _animWalk(st, path, now, arrive) {
  st.path = path.slice(); st.goal = path[path.length - 1]; st.arrive = arrive || null;
  st.jx = 0; st.jy = 0; st.gathered = !!arrive && st.gathered;
  _animSetState(st, 'walk');
  _animNextSeg(st, now, true);
}
function _animNextSeg(st, now, first) {
  const nx = st.path.shift();
  //  그 사이 막혔으면(새로 놓은 장식 · 다른 동물) 거기서 선다
  if (nx && !(st.isFree(nx.row, nx.col, st.w, st.h, st.id, st.swim, !!(st.pen && st.pen.water)) && !_animOccMaker(st.rec, st)(nx.row, nx.col))) { st.path = []; return _animNextSeg(st, now, first); }
  if (!nx) {
    st.seg = null; st.goal = null;
    const arrive = st.arrive; st.arrive = null;
    if (arrive) arrive(now);
    else { _animSetState(st, 'idle'); st.nextAt = now + _animRnd(500, 1400); }
    return;
  }
  const m = ANIM_MOOD[st.cfg.mood] || ANIM_MOOD.hen, last = !st.path.length, base = ANIM_STEP_MS / m.speed;
  if (nx.col !== st.cur.col) _animFace(st, nx.col > st.cur.col ? 1 : -1);
  st.seg = { r0: st.cur.row, c0: st.cur.col, r1: nx.row, c1: nx.col, t0: now, dur: (first || last) ? base * 1.27 : base, first, last };
}
function _animAdvance(st, now) {
  const s = st.seg;
  let k = (now - s.t0) / s.dur; if (k > 1) k = 1; if (k < 0) k = 0;
  const e = s.first && s.last ? k * k * (3 - 2 * k) : s.first ? k * k : s.last ? 1 - (1 - k) * (1 - k) : k;   // 첫 칸은 천천히 떠나고 끝 칸은 천천히 선다
  st.fx = s.c0 + (s.c1 - s.c0) * e; st.fy = s.r0 + (s.r1 - s.r0) * e;
  _animPlace(st);
  if (k >= 1) { st.cur = { row: s.r1, col: s.c1 }; st.seg = null; _animNextSeg(st, now, false); }
}

// ── 생각 — 먹이통이 있으면 모이기 · 아니면 성격대로 가만히 / 쪼기 / 몇 칸 걷기 ──
function _animThink(st, now) {
  //  [DECO-DAYNIGHT-1] 밤 — 쉼터(가까운 나무·건물) 둘레에 모여 잔다 · 우리 안·물 위·쉼터가 없으면 그 자리에서
  if ((typeof _yardPhase === 'function' ? _yardPhase() : typeof _decoPhase === 'function' ? _decoPhase() : 'day') === 'night') {   // [DECO-LOOK-0]
    st.shelter = st.pen || st.swim ? null : _animShelter(st);
    if (st.shelter && _animGather(st, now, st.shelter, 'sleep')) return;
    _animSetState(st, 'sleep'); st.nextAt = now + _animRnd(6000, 9000); return;
  }
  st.shelter = null;
  if (st.feeder && !st.swim && _animGather(st, now)) return;
  const m = ANIM_MOOD[st.cfg.mood] || ANIM_MOOD.hen, roll = Math.random();
  if (roll < m.idle) { _animSetState(st, 'idle'); st.nextAt = now + _animRnd(m.rest[0], m.rest[1]); return; }
  if (roll < m.idle + m.peck) { _animSetState(st, 'peck'); st.nextAt = now + 1300 * (Math.random() < .5 ? 1 : 2); return; }
  const want = m.steps[0] + Math.floor(Math.random() * (m.steps[1] - m.steps[0] + 1));
  const s0 = st.cur;
  const occ = _animOccMaker(st.rec, st);
  let p = _animBfs(st, (r, c) => Math.abs(r - s0.row) + Math.abs(c - s0.col) >= want && Math.random() < .35, occ);
  if (!p) p = _animBfs(st, () => true, occ);   // 좁은 곳(작은 우리 안) — 그만큼 먼 칸이 없으면 갈 수 있는 옆 칸이라도(전엔 거의 안 움직였다)
  if (p && p.length) _animWalk(st, p.slice(0, want), now);
  else { _animSetState(st, 'idle'); st.nextAt = now + _animRnd(800, 1600); }
}
//  먹이통 둘레 고리 — 체비쇼프 1칸 안 빈 칸 → 다 차면 2칸. 고른 칸은 goal 로 예약 · 도착하면 칸 안에서 조금 비켜 서서 먹이통을 본다
//  [DECO-DAYNIGHT-1] 대상과 몸짓을 받는다 — 먹이통이면 쪼기, 밤 쉼터면 잠(같은 고리 규칙)
function _animGather(st, now, T, act) {
  T = T || st.feeder; act = act || 'eat';
  const gk = T.id + '@' + T.row + '_' + T.col + ':' + act;
  if (st.gKey && st.gKey !== gk) { st.gathered = false; st.jSet = false; }   // 대상이 바뀌면(먹이통 ↔ 쉼터) 다시 모인다
  st.gKey = gk;
  const tz = getDecoSize(T.id);
  const dist = (r, c) => Math.max(Math.max(T.row - (r + st.h - 1), 0, r - (T.row + tz.h - 1)), Math.max(T.col - (c + st.w - 1), 0, c - (T.col + tz.w - 1)));
  const settle = (t) => {
    if (!st.jSet) { st.jx = (Math.random() - .5) * .5; st.jy = (Math.random() - .5) * .36; st.jSet = true; }
    const dc = (T.col + tz.w / 2) - (st.cur.col + st.w / 2);
    _animFace(st, dc > .01 ? 1 : dc < -.01 ? -1 : (Math.random() < .5 ? 1 : -1));
    st.fx = st.cur.col; st.fy = st.cur.row; _animPlace(st);
    if (act === 'sleep') { _animSetState(st, 'sleep'); st.nextAt = t + _animRnd(6000, 9000); return; }
    _animSetState(st, Math.random() < .7 ? 'peck' : 'idle');
    st.nextAt = t + _animRnd(1600, 3000);
  };
  const dNow = dist(st.cur.row, st.cur.col);
  if (st.gathered && dNow >= 1 && dNow <= 2) { settle(now); return true; }
  const occ = _animOccMaker(st.rec, st), b = _animBounds(st), pw = !!(st.pen && st.pen.water);
  for (let d = 1; d <= 2; d++) {
    const cand = [];
    for (let r = T.row - d - st.h + 1; r <= T.row + tz.h - 1 + d; r++) for (let c = T.col - d - st.w + 1; c <= T.col + tz.w - 1 + d; c++) {
      if (dist(r, c) !== d || r < b.r0 || r > b.r1 || c < b.c0 || c > b.c1) continue;
      if (!st.isFree(r, c, st.w, st.h, st.id, st.swim, pw) || occ(r, c)) continue;
      cand.push({ row: r, col: c });
    }
    while (cand.length) {
      const pick = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
      if (pick.row === st.cur.row && pick.col === st.cur.col) { st.gathered = true; settle(now); return true; }
      const p = _animBfs(st, (r, c) => r === pick.row && c === pick.col, occ);
      if (p) { st.gathered = true; st.jSet = false; _animWalk(st, p, now, settle); return true; }
    }
  }
  return false;   // 고리에 빈 칸이 없다 — 평소처럼 논다
}

//  밤 쉼터 — 놓은 자리에서 가까운(FEED_RANGE 안) 나무·건물 · 없으면 null(그 자리에서 잔다)
function _animShelter(st) {
  const stu = st.rec && st.rec.student;
  if (!stu || typeof _decoShopKind !== 'function') return null;
  let best = null, bd = 1e9;
  _decoList(stu).forEach(p => {
    if (p.area !== 'yard' || ANIM_DECO[p.id]) return;
    const d = GAME_DATA.decorations.find(x => x.id === p.id), k = d && _decoShopKind(d);
    if (k !== 'tree' && k !== 'building') return;
    const dist = Math.abs(p.row - st.home.row) + Math.abs(p.col - st.home.col);
    if (dist <= FEED_RANGE && dist < bd) { bd = dist; best = p; }
  });
  return best;
}
function _animStopLayer(hostId) {
  const rec = _animLayers.get(hostId);
  if (!rec) return;
  if (typeof _lifeCard !== 'undefined' && _lifeCard && _lifeCard.rec === rec) _lifeCardClose();   // [DECO-LIFE-2]
  if (rec.layer && rec.layer.parentNode) rec.layer.parentNode.removeChild(rec.layer);
  _animLayers.delete(hostId);
  if (!_animLayers.size) _animLoopStop();
}

function _animStopAll() { [..._animLayers.keys()].forEach(_animStopLayer); }

function _animPauseAll() { _animLoopStop(); }

function _animResumeAll() {
  if (_animReduced()) return;
  //  숨어 있는 동안 멈춘 걸음은 지금부터 다시 잰다(한 번에 순간이동하지 않게)
  const now = Date.now();
  _animLayers.forEach(rec => rec.items.forEach(st => { if (st.seg) st.seg.t0 = now - Math.min(now - st.seg.t0, st.seg.dur * .5); }));
  _animKick();
}

// [DECO-ANIM-2] 동물을 누르면 — 손가락이 어느 동물을 눌렀는지는 '판의 칸'으로 찾는다(층은 손가락을 통과시킨다).
function _animAt(hostId, r, c) {
  const rec = _animLayers.get(hostId);
  if (!rec) return null;
  //  그림은 발 칸 위로 솟는다 → 발 칸 위 한 줄까지 · 걷는 중이면 지금 그려진 자리(반올림)와 가는 칸
  //  [DECO-ANIM-HIT-2] 여럿이 걸리면 **발 칸**이 머리 줄보다 먼저 · 같으면 앞(아래 줄)에 그려진 것
  //   (전: 처음 찾은 것 — 강아지 바로 아래 닭의 머리 줄이 강아지 칸과 겹쳐, 강아지 가운데를 누르면 닭이 반응했다 · 창조자 43-ⓑ93)
  const hitAt = (row, col, st) => (c >= col && c < col + st.w) ? (r >= row && r < row + st.h ? 2 : r === row - 1 ? 1 : 0) : 0;
  let best = null, bs = 0, bz = -1e9;
  for (const st of rec.items.values()) {
    const sc = Math.max(hitAt(Math.round(st.fy), Math.round(st.fx), st), hitAt(st.cur.row, st.cur.col, st), st.seg ? hitAt(st.seg.r1, st.seg.c1, st) : 0);
    if (sc > bs || (sc && sc === bs && st.fy > bz)) { best = st; bs = sc; bz = st.fy; }
  }
  return best;
}
//  [DECO-ANIM-HIT-2] 누른 **점**(판 px)이 그려진 몸(bbox.json 상자 · 뒤집힘 반영 · 둘레 .12칸 여유) 위에 있는 동물
//  — 여럿이면 앞에 그려진 것(아래 줄) · 같으면 몸 가운데가 가까운 것. 몸 밖이면 null(부른 쪽이 칸 판정 _animAt 으로).
function _animAtPt(hostId, bx, by) {
  const rec = _animLayers.get(hostId);
  if (!rec) return null;
  let best = null, bz = -1e9, bd = 1e9;
  for (const st of rec.items.values()) {
    const C = st.C || 0;
    if (!C) continue;
    const bb = typeof _decoBBox !== 'undefined' && _decoBBox && _decoBBox[st.id], ok = Array.isArray(bb) && bb[4] > 0 && bb[5] > 0;
    const vw = ok ? bb[4] : 100 * st.w, vh = ok ? bb[5] : 100 * (st.h + 1), w = st.w * C, H = w * vh / vw;
    const x0 = (st.fx + (st.jx || 0)) * C, bot = (st.fy + (st.jy || 0) + st.h) * C, top = bot - H;
    const flip = ((st.cfg && st.cfg.artLeft) ? -(st.dir || 1) : (st.dir || 1)) < 0;
    const rw = ok ? bb[2] : vw, rh = ok ? bb[3] : vh, ry = ok ? bb[1] : 0;
    let rx = ok ? bb[0] : 0; if (flip) rx = vw - rx - rw;
    const pad = .12 * C, L = x0 + rx / vw * w - pad, R = x0 + (rx + rw) / vw * w + pad, T = top + ry / vh * H - pad, B = top + (ry + rh) / vh * H + pad;
    if (bx < L || bx > R || by < T || by > B) continue;
    const z = st.fy + (st.jy || 0), d = Math.hypot(bx - (L + R) / 2, by - (T + B) / 2);
    if (z > bz + 1e-6 || (Math.abs(z - bz) <= 1e-6 && d < bd)) { best = st; bz = z; bd = d; }
  }
  return best;
}
//  그림이 발밑 칸 위로 솟은 칸 수(bbox.json) — 말풍선·💗 를 머리 위에
function _animOverCells(st) {
  const bb = typeof _decoBBox !== 'undefined' && _decoBBox && _decoBBox[st.id];
  if (!Array.isArray(bb) || !(bb[4] > 0)) return 1;
  return Math.max(0, (bb[5] - bb[1]) * (st.w / bb[4]) - st.h);
}
function _animPoke(st, fromCol) {
  if (!st || !st.el) return false;
  const now = Date.now(), over = _animOverCells(st) * (st.C || 0);
  //  말풍선 · 💗
  const say = document.createElement('div');
  say.className = 'deco-anim-say';
  say.textContent = st.cfg.say || '…';
  if (over) say.style.marginBottom = Math.round(over) + 'px';
  st.el.appendChild(say);
  setTimeout(() => { if (say.parentNode) say.parentNode.removeChild(say); }, 1200);
  const heart = document.createElement('div');
  heart.className = 'deco-anim-heart';
  heart.textContent = '💗';
  if (over) heart.style.marginBottom = Math.round(over) + 'px';
  heart.style.marginLeft = -Math.round((say.offsetWidth || 30) / 2 + 22) + 'px';   // [DECO-FRIEND-VIEW-1] 말풍선 왼쪽 밖(한 칸 동물에서 '왈!'을 덮었다)
  st.el.appendChild(heart);
  setTimeout(() => { if (heart.parentNode) heart.parentNode.removeChild(heart); }, 1200);
  //  기쁨 — 그 그림이 있으면 한 번(0.9초) · 없으면 폴짝
  const a = _animArt[st.id] || {};
  if (!a.happy) { const bob = st.el.querySelector('.bob'); if (bob) { bob.classList.remove('hop'); void bob.offsetWidth; bob.classList.add('hop'); } }
  //  둘레(6칸)의 가만히 있는 동물이 그쪽을 본다
  if (st.rec) st.rec.items.forEach(o => {
    if (o === st || o.seg || o.state === 'happy' || Math.max(Math.abs(o.cur.row - st.cur.row), Math.abs(o.cur.col - st.cur.col)) > 6) return;
    if (o.cur.col !== st.cur.col) _animFace(o, st.cur.col > o.cur.col ? 1 : -1);
  });
  if (st.frozen || st.seg) return true;   // 걷는 중이면 말만(걸음을 끊지 않는다)
  //  강아지는 부르면 온다 — 누른 쪽으로 한 칸
  if (st.cfg.come && fromCol !== undefined) {
    const dir = fromCol > st.cur.col ? 1 : (fromCol < st.cur.col ? -1 : 0), to = { row: st.cur.row, col: st.cur.col + dir }, b = _animBounds(st);
    if (dir && to.col >= b.c0 && to.col <= b.c1 && st.isFree(to.row, to.col, st.w, st.h, st.id, st.swim, !!(st.pen && st.pen.water)) && !_animOccMaker(st.rec, st)(to.row, to.col)) {
      _animWalk(st, [to], now); _animKick(); return true;
    }
  }
  _animSetState(st, 'happy'); st.nextAt = now + 900;   // 0.9초 한 번 돌고 멈추는 그림 — 끝나면 다음 생각이 가만히로 돌린다
  _animKick();
  return true;
}

// ══ [DECO-LIFE-1] 친해지기 · 손님 · 작은 선물 — 저장 칸 (docs/deco_guests_design.md · 보스 승인 09-24) ══
//  student.decoLife = { v:1, c:다음 번호, a:{ a7:{ k:장식 id, r,c,sp:선 자리, m:처음 만난 날, h:하트, d:마지막 하트 날, n:이름 번호 } },
//                       s:{ 손님: 처음 본 날 }, g:{ 선물: 수 }, p:사진 조각 }
//  · 없으면 빈 것으로 읽고 **필드를 만들지 않는다** — 처음 쓰다듬을 때 만든다(아무것도 안 한 아이의 문서는 그대로).
//  · 쓰기는 **잎만** update(통째 저장 아님) · 수는 서버에서 더하기 — 통째 저장이 늘면 골드 유실 M2 창이 는다(§6-1).
//  · 친구는 '선 자리'(r·c·sp)로 자리와 짝짓는다 — houseDecorations 배열은 건드리지 않는다.
const LIFE_STAGE_AT = [0, 3, 7, 12, 20];   // 단계 1~5(처음 만남 · 알아봄 · 친구 · 단짝 · 가족)의 하트 문턱 — 보스 결정 09-24(전 0/3/8/15/25 · 주 2회 교실이면 가족까지 10주)
const LIFE_STAGE_NAME = ['처음 만남', '알아봄', '친구', '단짝', '가족'];
let _lifeWrites = 0;   // 잎 쓰기 수(시험이 센다)
function _lifeDay(t) { return Math.floor(((t === undefined ? Date.now() : t) + 9 * 3600000) / 86400000); }   // 한국 날짜의 일 번호
function _lifeObj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : null; }
//  읽기 — 모양이 틀린 칸은 없는 셈(지우지 않는다) · 모르는 모양 번호면 ro(읽기 전용)
function _lifeGet(student) {
  const L = _lifeObj(student && student.decoLife);
  const num = v => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.floor(v) : 0;
  return { ro: !!(L && L.v !== undefined && L.v !== 1), c: num(L && L.c), a: _lifeObj(L && L.a) || {}, s: _lifeObj(L && L.s) || {}, g: _lifeObj(L && L.g) || {}, p: num(L && L.p) };
}
function _lifeOk(f) { return !!(_lifeObj(f) && typeof f.k === 'string'); }
function _lifeHearts(f) { const h = f && f.h; return (typeof h === 'number' && isFinite(h) && h > 0) ? Math.floor(h) : 0; }
function _lifeStage(h) { let st = 1; for (let i = 1; i < LIFE_STAGE_AT.length; i++) if (h >= LIFE_STAGE_AT[i]) st = i + 1; return st; }
function _lifeNo(u) { const m = /^a(\d+)$/.exec(u || ''); return m ? +m[1] : Infinity; }
//  자리 p 의 친구 번호 — ① 그 자리에 선 친구 ② 없으면 같은 종류의 **쉬는 친구**(지금 어느 자리에도 안 선) 중 하트가 가장 많은(같으면 먼저 만난)
//  ③ 없으면 null(새 친구). 치우고 다시 놓아도(= 옮기기) 이름·하트째 돌아온다(§2).
function _lifeFriendAt(student, p, L) {
  const sp = _decoSpaceOf(p), a = L.a;
  const at = (f, q) => f.k === q.id && f.r === q.row && f.c === q.col && (f.sp || 1) === _decoSpaceOf(q);
  for (const u in a) if (_lifeOk(a[u]) && at(a[u], p)) return u;
  const placed = (student && student.houseDecorations) || [];
  let best = null;
  for (const u in a) {
    const f = a[u];
    if (!_lifeOk(f) || f.k !== p.id || placed.some(q => at(f, q))) continue;
    if (!best || _lifeHearts(f) > _lifeHearts(a[best]) || (_lifeHearts(f) === _lifeHearts(a[best]) && _lifeNo(u) < _lifeNo(best))) best = u;
  }
  return best;
}
//  화면(student.decoLife)에 먼저 반영하고, 서버로 보낼 잎 목록을 돌려준다. { inc:n } 은 서버에서 더하기.
function _lifeApply(student, ups) {
  if (!student || _lifeGet(student).ro) return null;
  if (!_lifeObj(student.decoLife)) student.decoLife = {};
  const L = student.decoLife, out = {};
  if (L.v === undefined) { L.v = 1; out.v = 1; }
  for (const path of Object.keys(ups)) {
    const ks = path.split('/'), val = ups[path];
    let o = L;
    for (let i = 0; i < ks.length - 1; i++) { if (!_lifeObj(o[ks[i]])) o[ks[i]] = {}; o = o[ks[i]]; }
    const last = ks[ks.length - 1];
    if (_lifeObj(val) && typeof val.inc === 'number') { o[last] = ((typeof o[last] === 'number' && isFinite(o[last])) ? o[last] : 0) + val.inc; out[path] = { inc: val.inc }; }
    else { o[last] = _lifeObj(val) ? JSON.parse(JSON.stringify(val)) : val; out[path] = val; }
  }
  return out;
}
function _lifeSend(student, out) {
  if (!out || !student || !student.id) return false;
  const up = {};
  for (const path of Object.keys(out)) {
    const v = out[path];
    up['decoLife/' + path] = (_lifeObj(v) && typeof v.inc === 'number' && typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue)
      ? firebase.database.ServerValue.increment(v.inc) : v;
  }
  _lifeWrites++;
  try {
    const r = DB._fbRef.child('students/' + student.id).update(up);
    if (r && r.catch) r.catch(e => { if (DB._onSaveError) DB._onSaveError(e); });
  } catch (e) { console.error('꾸미기 친구 저장 실패', e); return false; }
  return true;
}
function _lifeWrite(student, ups) { return _lifeSend(student, _lifeApply(student, ups)); }
//  쓰다듬기 → 하루 한 마리 +1(§3). 같은 날이면 반응만(쓰기 0). 제 마당(CUR)에서만 부른다 — 친구 구경은 쓰기 0(§7).
//  돌려주는 것: null(짝지을 자리 없음) · { u, gained:0|1, stage, stageUp }
function _lifePet(student, p, now) {
  if (!student || !p) return null;
  const L = _lifeGet(student);
  if (L.ro) return null;
  const today = _lifeDay(now);
  let u = _lifeFriendAt(student, p, L);
  const f = u ? L.a[u] : null;
  const h0 = _lifeHearts(f), s0 = _lifeStage(h0);
  if (f && f.d === today) return { u, gained: 0, stage: s0, stageUp: false };
  const ups = {}, sp = _decoSpaceOf(p);
  if (!u) {
    let n = Math.max(1, L.c);
    for (const k in L.a) { const x = _lifeNo(k); if (x !== Infinity && x >= n) n = x + 1; }
    u = 'a' + n; ups.c = n + 1;
    ups['a/' + u] = Object.assign({ k: p.id, r: p.row, c: p.col }, sp !== 1 ? { sp } : {}, { m: today, h: 1, d: today });
  } else {
    if (f.r !== p.row || f.c !== p.col || (f.sp || 1) !== sp) { ups['a/' + u + '/r'] = p.row; ups['a/' + u + '/c'] = p.col; ups['a/' + u + '/sp'] = sp !== 1 ? sp : null; }   // 쉬던 친구가 새 자리로
    ups['a/' + u + '/h'] = { inc: 1 }; ups['a/' + u + '/d'] = today;
  }
  const s1 = _lifeStage(h0 + 1);
  if (s1 > s0) { ups['g/sticker'] = { inc: 1 }; ups.p = { inc: 1 }; }   // 단계가 오르는 날 스티커 하나(§3) · 사진 조각 하나(보스 결정 · 디자인 #1003)
  _lifeWrite(student, ups);
  return { u, gained: 1, stage: s1, stageUp: s1 > s0 };
}
//  [DECO-BUNDLE-1] 친해지기 그림(하트 · 단계 배지 · 선물 · 사진 틀 · 반짝) — 묶음이 있으면 blob, 받는 중·없으면 낱장
function _lifeArt(n) { return (typeof _artSrc === 'function' && _artSrc('deco/' + n + '.svg')) || './assets/deco/' + n + '.svg'; }
//  [DECO-LIFE-4] 부르는 이름 — 지은 이름이 있으면 그 이름(같으면 '콩이 2'), 없으면 종류(강아지). 알림 · 카드 · 선물 말은 모두 이것으로(창조자 49-ⓑ99)
function _lifeWho(id, L, u) {
  const nm = (L && u && L.a && L.a[u]) ? _lifeNameOf(L, u) : '';
  if (nm) return nm;
  const c = typeof ANIM_DECO !== 'undefined' && ANIM_DECO[id];
  return (c && c.name) || ((GAME_DATA.decorations.find(x => x.id === id) || {}).name) || '동물';
}
//  누른 동물(st) → 그 자리 객체 → 하트. 하트를 얻으면 💗 옆에 +1 · 단계가 오르면 알림 한 줄.
function _lifePetAnim(st) {
  if (!st || !CUR) return null;
  const p = (CUR.houseDecorations || []).find(q => q.area === 'yard' && q.id === st.id && q.row === st.home.row && q.col === st.home.col && _decoSpaceOf(q) === DECO_SPACE);
  const r = _lifePet(CUR, p);
  if (!r || !r.gained) return r;
  _drawDeco();   // [DECO-LIFE-5] 하트로 오늘 선물이 생길 수 있다 — 판을 한 번 다시 그려 땅에 바로 보이게(창조자 55-ⓑ104)
  if (st.el) {   // 💗 옆에 '+1' 배지 — 말풍선·하트와 안 겹치게 오른쪽 위
    const plus = document.createElement('div'), over = _animOverCells(st) * (st.C || 0);
    plus.className = 'deco-anim-plus'; plus.textContent = '+1 💗';
    if (over) plus.style.marginBottom = Math.round(over) + 'px';
    const say = st.el.querySelector('.deco-anim-say');   // [DECO-FRIEND-VIEW-1] 말풍선 오른쪽 밖
    plus.style.marginLeft = Math.round((say ? say.offsetWidth : 30) / 2 + 3) + 'px';
    st.el.appendChild(plus);
    setTimeout(() => { if (plus.parentNode) plus.parentNode.removeChild(plus); }, 1500);
  }
  if (r.stageUp) {   // [DECO-LIFE-4] 이름으로 부르고 · 받은 것(스티커 · 사진 조각)을 어디서 보는지까지(ⓑ99 · ⓒ85)
    const who = _lifeWho(st.id, _lifeGet(CUR), r.u);
    toast(`🤝 ${who}${_josa(who, '과', '와')} '${LIFE_STAGE_NAME[r.stage - 1]}' 사이가 됐어요! ⭐ 스티커 · 🧩 사진 조각 — 🎁 선물 상자에서 봐요`);
  }
  return r;
}

// ── [DECO-LIFE-2] 동물 카드 — 누르면 말풍선 카드: 이름 · 단계 배지 · 하트 칸 · '+1 오늘' · 이름 고르기 ──
//  이름은 **고르기만**(자유 입력 없음 · 친구 구경에 보인다) · 저장은 목록 번호(디자인 #969 — 뒤에 더하기만 · 빼지 말고 안 보임에).
const LIFE_NAMES = ['콩이', '보리', '호두', '초코', '뭉치', '모카', '두부', '밤톨', '달콩', '까망', '꼬꼬', '삐약', '옥수수', '콩알', '좁쌀',
  '꽥꽥', '방울', '퐁당', '동글', '물방울', '솜이', '구름', '몽글', '폭신', '뭉게', '봄봄', '단비', '이슬', '새싹', '감자', '고구마', '쿠키',
  '말랑', '포근', '토리', '도토리', '별콩', '반짝', '소복', '해님'];
const LIFE_NAMES_HIDDEN = [];   // 더 안 보일 번호(지우지 않는다 — 이미 고른 아이의 이름이 바뀌지 않게)
const LIFE_NAME_START = { dog: 1, cat: 6, hen: 11, duck: 16, sheep: 21 }, LIFE_NAME_COMMON = 26;
//  같은 이름을 둘이 고르면 처음 만난 순서로 뒤에 숫자(콩이 2) — 저장하지 않고 그때 센다(결정 ⑤)
function _lifeNameOf(L, u) {
  const f = L.a[u], n = f && f.n;
  if (!(typeof n === 'number' && n >= 1 && n <= LIFE_NAMES.length)) return '';
  const same = Object.keys(L.a).filter(k => _lifeOk(L.a[k]) && L.a[k].n === n)
    .sort((a, b) => ((L.a[a].m || 0) - (L.a[b].m || 0)) || (_lifeNo(a) - _lifeNo(b)));
  const i = same.indexOf(u);
  return LIFE_NAMES[n - 1] + (i > 0 ? ' ' + (i + 1) : '');
}
//  하트 칸 = 다음 단계까지 필요한 수(3 · 5 · 7 · 10) — 한 번 쓰다듬기 = 한 칸. 5단계(가족)는 다섯 칸이 다 찬다.
function _lifeHeartRow(h) {
  const st = _lifeStage(h);
  if (st >= LIFE_STAGE_AT.length) return { st, have: 5, need: 5, left: 0 };
  const a = LIFE_STAGE_AT[st - 1], b = LIFE_STAGE_AT[st];
  return { st, have: h - a, need: b - a, left: b - h };
}
let _lifeCard = null;   // { el, st, rec, u, timer, follow }
function _lifeCardClose() {
  const k = _lifeCard; _lifeCard = null;
  if (!k) return;
  clearTimeout(k.timer); clearInterval(k.follow);
  if (k.el && k.el.parentNode) k.el.parentNode.removeChild(k.el);
}
function _lifeCardPlace() {
  const k = _lifeCard;
  if (!k || !k.el.isConnected || !k.st.el || !k.st.el.isConnected) { _lifeCardClose(); return; }
  const st = k.st, C = st.C || _dC, W = k.rec.layer.clientWidth, H = k.rec.layer.clientHeight;
  const cw = k.el.offsetWidth, ch = k.el.offsetHeight, px = _dPanX || 0, py = _dPanY || 0;
  const ax = (st.fx + (st.jx || 0) + (st.w || 1) / 2) * C, top = (st.fy + (st.jy || 0) - _animOverCells(st)) * C, bot = (st.fy + (st.jy || 0) + (st.h || 1)) * C;
  let x = Math.max(px + 8, Math.min(px + W - 8 - cw, ax - cw / 2)), y = top - ch - 30, pos = 'above';   // 말풍선('멍!')·'+1 💗' 위로 한 뼘
  if (y < py + 8) {
    if (bot + 12 + ch <= py + H - 8) { y = bot + 12; pos = 'below'; }   // 위에 자리가 없으면 아래로
    else {   // 위도 아래도 다 안 들어가면(이름 칩을 펼쳐 길어졌을 때) 동물 옆 — 동물을 덮지 않는다
      const w = (st.w || 1) * C, rx = (st.fx + (st.jx || 0)) * C + w + 10, lx = (st.fx + (st.jx || 0)) * C - 10 - cw;
      x = rx + cw <= px + W - 8 ? rx : Math.max(px + 8, lx);
      y = Math.max(py + 8, Math.min(py + H - 8 - ch, (top + bot) / 2 - ch / 2)); pos = 'side';
    }
  }
  k.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  k.el.classList.toggle('below', pos === 'below'); k.el.classList.toggle('side', pos === 'side');
  k.el.style.setProperty('--tip', Math.round(Math.max(16, Math.min(cw - 16, ax - x))) + 'px');
}
function _lifeCardHTML(st, L, u, pet) {
  const f = L.a[u], cfg = ANIM_DECO[st.id] || {}, kind = cfg.name || ((GAME_DATA.decorations.find(x => x.id === st.id) || {}).name) || '동물';
  const h = _lifeHearts(f), row = _lifeHeartRow(h), nm = _lifeNameOf(L, u), today = f && f.d === _lifeDay();
  //  디자인 사양(#1022): 하트 칸 3·4·5·8 — 5칸까지 한 줄 · 8칸은 넷씩 두 줄(모두 22px) · 가족은 칸을 안 보인다
  const hrow = (n, have) => Array.from({ length: n }, (_, i) => `<img src="${_lifeArt('heart_' + (i < have ? 'full' : 'empty'))}" alt="">`).join('');
  const hc = n => n >= 8 ? ' h8' : '';   // 하트 칸 3·4·5·8(#1022) — 5칸까지 한 줄 · 8칸은 넷씩 두 줄 · 모두 22px
  const hearts = row.left ? hrow(row.need, row.have) : '';
  const hcls = hc(row.need);
  //  [DECO-LIFE-4] 단계가 오른 날은 방금 받은 하트가 사라져 보이지 않게 — 다 찬 옛 줄 + ⬆ 새 단계, 그 아래 새 줄(창조자 49-ⓑ98)
  const upToday = today && row.st >= 2 && h === LIFE_STAGE_AT[row.st - 1];
  const oldN = upToday ? LIFE_STAGE_AT[row.st - 1] - LIFE_STAGE_AT[row.st - 2] : 0;
  const was = upToday ? `<div class="dlc-hearts dlc-was${hc(oldN)}" aria-label="지난 단계 하트 다 참"><span class="dlc-hrow">${hrow(oldN, oldN)}</span><span class="dlc-today">+1 오늘</span><span class="dlc-up">⬆ '${LIFE_STAGE_NAME[row.st - 1]}'!</span></div>` : '';
  //  [DECO-LIFE-4] 같은 날 또 쓰다듬으면 — 반응은 그대로 · 하트가 왜 안 느는지 한 줄(벌 아님 · ⓑ97)
  const again = pet && pet.gained === 0 ? '<div class="dlc-again">💗 오늘은 벌써 쓰다듬었어요 · 내일 또 만나요</div>' : '';
  const next = row.left ? `다음 단계 '${LIFE_STAGE_NAME[row.st]}'까지 하트 ${row.left}` : '가족이 됐어요 — 하트는 줄지 않아요';
  return `<div class="dlc-top"><img class="dlc-badge" src="${_lifeArt('friend_stage' + row.st)}" alt="${row.st}단계">`
    + `<div class="dlc-who"><div><b class="dlc-nm">${escHtml(nm || kind)}</b>${nm ? ` <span class="dlc-kind">· ${escHtml(kind)}</span>` : ''}</div>`
    + `<div class="dlc-sub">${row.st}단계 ${LIFE_STAGE_NAME[row.st - 1]}</div></div>`
    + (L.ro ? '' : `<button type="button" class="dlc-namebtn" aria-label="이름 고르기">🏷️ ${nm ? '이름 바꾸기' : '이름 짓기'}</button>`) + '</div>'
    + was
    + (hearts ? `<div class="dlc-hearts${hcls}" aria-label="하트 ${row.have}/${row.need}"><span class="dlc-hrow">${hearts}</span>${today && !upToday ? '<span class="dlc-today">+1 오늘</span>' : ''}</div>`
      : (today && !upToday ? '<div class="dlc-hearts"><span class="dlc-today">+1 오늘</span></div>' : ''))
    + `<div class="dlc-next">${next}</div>${again}${_lifeGiftLine(st.id, f, u)}<div class="dlc-chips" hidden></div>`;
}
function _lifeCardChips(k, more) {
  const box = k.el.querySelector('.dlc-chips'), cfg = ANIM_DECO[k.st.id] || {}, s0 = LIFE_NAME_START[cfg.mood] || LIFE_NAME_COMMON;
  const ok = n => n >= 1 && n <= LIFE_NAMES.length && LIFE_NAMES_HIDDEN.indexOf(n) < 0;
  const nums = [0, 1, 2, 3, 4].map(i => s0 + i).filter(ok);
  if (more) for (let n = LIFE_NAME_COMMON; n <= LIFE_NAMES.length; n++) if (ok(n) && nums.indexOf(n) < 0) nums.push(n);
  box.innerHTML = nums.map(n => `<button type="button" class="dlc-chip" data-n="${n}">${escHtml(LIFE_NAMES[n - 1])}</button>`).join('')
    + (more ? '' : '<button type="button" class="dlc-chip dlc-more">더 보기 …</button>');
  box.hidden = false;
  clearTimeout(k.timer);   // 고르는 동안은 안 닫힌다
  _lifeCardPlace();
}
function _lifeCardPick(k, n) {
  const L = _lifeGet(CUR);
  if (L.ro || !L.a[k.u]) return;
  _lifeWrite(CUR, { ['a/' + k.u + '/n']: n });   // 잎 쓰기 하나(§6-1)
  const nm = _lifeNameOf(_lifeGet(CUR), k.u);
  toast(`🏷️ 이제 '${nm}'${_josa(nm, '이에요', '예요')}`);
  _lifeCardOpen(k.st);
}
function _lifeCardOpen(st, pet) {
  _lifeCardClose();
  if (!st || !st.el || !CUR) return null;
  const rec = st.rec || _animLayers.get(_ifActiveContainer || 'house-topview');
  const p = (CUR.houseDecorations || []).find(q => q.area === 'yard' && q.id === st.id && q.row === st.home.row && q.col === st.home.col && _decoSpaceOf(q) === DECO_SPACE);
  const L = _lifeGet(CUR), u = p ? _lifeFriendAt(CUR, p, L) : null;
  if (!rec || !u || !L.a[u]) return null;
  const el = document.createElement('div');
  el.className = 'deco-life-card'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '동물 카드');
  el.innerHTML = _lifeCardHTML(st, L, u, pet);
  rec.world.appendChild(el);
  const k = _lifeCard = { el, st, rec, u, timer: 0, follow: 0 };
  ['pointerdown', 'touchstart', 'mousedown'].forEach(t => el.addEventListener(t, e => e.stopPropagation(), { passive: true }));
  el.addEventListener('click', e => {
    e.stopPropagation();
    const b = e.target.closest && e.target.closest('button');
    if (!b) { _lifeCardClose(); return; }   // [DECO-ANIM-HIT-2] 단추 아닌 곳을 누르면 닫힌다(카드가 덮은 동물을 다시 누를 수 있게)
    if (b.classList.contains('dlc-namebtn')) _lifeCardChips(k, false);
    else if (b.classList.contains('dlc-more')) _lifeCardChips(k, true);
    else if (b.dataset.n) _lifeCardPick(k, +b.dataset.n);
  });
  _lifeCardPlace();
  k.follow = setInterval(_lifeCardPlace, 120);          // 강아지가 한 칸 걸어와도 따라간다
  k.timer = setTimeout(_lifeCardClose, 6000);           // 6초 뒤 스스로 닫힌다(이름을 고르는 동안은 안 닫힘)
  return k;
}
if (typeof document !== 'undefined') document.addEventListener('keydown', e => { if (e.key === 'Escape' && _lifeCard) _lifeCardClose(); });
// ── [DECO-LIFE-3] 작은 선물 — 2단계 이상 친구가 제자리 곁에 두고 간다 · 누르면 모인다 · 골드 아님(팔 수 없음 · 경제 불변) ──
//  빈도(보스 결정 ②): 2단계 3일에 한 번 · 3단계 2일에 한 번 · 4단계 이상 매일 — 친구마다 날이 어긋나게(번호로 민다).
//  안 받은 선물은 그날이 지나면 없어진다(쌓이지 않는다 · 벌 아님). 받은 날은 친구 줄의 gd 에 적는다(잎 쓰기).
const LIFE_GIFT_OF = { hen: 'egg', duck: 'duck_egg', sheep: 'wool', dog: 'stick', cat: 'yarn' };   // 강아지 나뭇가지 · 고양이 털실 공(디자인 #1003)
const LIFE_GIFT_NAME = { egg: '달걀', duck_egg: '오리알', wool: '양털', stick: '나뭇가지', yarn: '털실 공', apple: '사과', cherry: '버찌', acorn: '도토리', feather: '깃털', sticker: '스티커' };
const LIFE_GIFT_SAY = { stick: '나뭇가지를 물어 왔어요', yarn: '털실 공을 굴려 왔어요' };   // 없으면 'OO 하나를 두고 갔어요'
const LIFE_GIFT_BOX = ['egg', 'duck_egg', 'wool', 'stick', 'yarn', 'apple', 'cherry', 'acorn', 'feather', 'sticker'];
function _lifeGiftKind(id) { const c = ANIM_DECO[id]; return (c && LIFE_GIFT_OF[c.mood]) || ''; }
function _lifeGiftDay(u, f, day) {   // 오늘 선물 날인가(받았든 안 받았든)
  const st = _lifeStage(_lifeHearts(f)), per = st >= 4 ? 1 : st === 3 ? 2 : st === 2 ? 3 : 0;
  if (!per) return false;
  let o = 0; for (const ch of String(u)) o += ch.charCodeAt(0);
  return (day + o) % per === 0;
}
function _lifeGiftOpen(u, f, day) { return !!f && _lifeGiftDay(u, f, day) && f.gd !== day; }   // 오늘 선물이 아직 땅에 있나
function _lifeGiftLine(id, f, u) {
  const kind = _lifeGiftKind(id);
  if (!kind || !f) return '';
  const day = _lifeDay(), nm = LIFE_GIFT_NAME[kind];
  if (_lifeStage(_lifeHearts(f)) < 2) return `<div class="dlc-gift is-soon">🎁 '알아봄'이 되면 ${nm}${_josa(nm, '을', '를')} 두고 가요</div>`;
  if (_lifeGiftOpen(u, f, day)) return `<div class="dlc-gift"><img src="${_lifeArt('gift_' + kind)}" alt=""> 선물! ${LIFE_GIFT_SAY[kind] || nm + ' 하나를 두고 갔어요'} — 땅에서 눌러요</div>`;
  if (_lifeGiftDay(u, f, day)) return `<div class="dlc-gift is-done">✓ 오늘 선물 ${nm}${_josa(nm, '을', '를')} 받았어요</div>`;
  return '';
}
//  동물 층 안에 오늘 선물을 놓는다 — 친구의 선 자리(제자리) 오른쪽 옆 칸(동물과 겹치면 쓰다듬으려던 손이 선물을 받는다)
function _lifeGiftSync(rec, student, C) {
  const L = _lifeGet(student), day = _lifeDay(), want = new Map();
  if (!L.ro) for (const u in L.a) {
    const f = L.a[u], kind = _lifeOk(f) ? _lifeGiftKind(f.k) : '';
    if (!kind || (f.sp || 1) !== DECO_SPACE || !_lifeGiftOpen(u, f, day)) continue;
    if (!(student.houseDecorations || []).some(q => q.area === 'yard' && q.id === f.k && q.row === f.r && q.col === f.c && _decoSpaceOf(q) === DECO_SPACE)) continue;   // 쉬는 친구는 두고 가지 않는다
    want.set(u, { f, kind });
  }
  rec.gifts = rec.gifts || new Map();
  rec.gifts.forEach((el, u) => { if (!want.has(u)) { if (el.parentNode) el.parentNode.removeChild(el); rec.gifts.delete(u); } });
  want.forEach(({ f, kind }, u) => {
    let el = rec.gifts.get(u);
    if (!el) {
      el = document.createElement('button');
      el.type = 'button'; el.className = 'deco-gift'; el.setAttribute('aria-label', '선물 ' + LIFE_GIFT_NAME[kind] + ' 받기');
      //  [DECO-LIFE-5] 처음 나타날 때 통통 + 반짝(fx_twinkle) — 아이가 찾게(창조자 55-ⓒ90)
      el.innerHTML = `<img class="dg-art" src="${_lifeArt('gift_' + kind)}" alt=""><img class="dg-tw" src="${_lifeArt('fx_twinkle')}" alt="">`;
      el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 2600);
      ['pointerdown', 'touchstart', 'mousedown'].forEach(t => el.addEventListener(t, e => e.stopPropagation(), { passive: true }));
      el.addEventListener('click', e => { e.stopPropagation(); _lifeGiftTake(u, el); });
      rec.world.appendChild(el); rec.gifts.set(u, el);
    }
    //  그림은 그대로(칸의 .62) · 누르는 자리는 44px 이상(창조자 55-ⓒ90 — 18px 이라 터치로 찾기 어려웠다) · 그림 가운데를 기준으로 넓힌다
    const sz = getDecoSize(f.k), g = Math.max(18, Math.round(C * .62)), hit = Math.max(44, g);
    const gx = (f.c + sz.w) * C + C * .12, gy = (f.r + sz.h) * C - g * 1.02;
    el.style.width = el.style.height = hit + 'px'; el.style.setProperty('--g', g + 'px');
    el.style.transform = 'translate(' + Math.round(gx + g / 2 - hit / 2) + 'px,' + Math.round(gy + g / 2 - hit / 2) + 'px)';
    el.style.zIndex = String(Math.round(f.r + sz.h));
  });
}
function _lifeGiftTake(u, el) {
  if (!CUR) return false;
  const L = _lifeGet(CUR), f = L.a[u], day = _lifeDay(), kind = _lifeOk(f) ? _lifeGiftKind(f.k) : '';
  if (L.ro || !kind || !_lifeGiftOpen(u, f, day)) return false;
  _lifeWrite(CUR, { ['a/' + u + '/gd']: day, ['g/' + kind]: { inc: 1 } });   // 잎 쓰기 하나 · 수는 서버 더하기
  if (el) { el.classList.add('taken'); el.disabled = true; setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 650); }
  const rec = _animLayers.get(_ifActiveContainer || 'house-topview'); if (rec && rec.gifts) rec.gifts.delete(u);
  const nm = LIFE_GIFT_NAME[kind], L2 = _lifeGet(CUR), n = L2.g[kind] || 0, who = _lifeWho(f.k, L2, u);   // [DECO-LIFE-4] 이름으로
  toast(`🎁 ${who}${_josa(who, '이', '가')} 준 선물! ${nm}${_josa(nm, '을', '를')} 받았어요 — 선물 상자 ${n}개`);
  if (_lifeCard && _lifeCard.u === u) _lifeCardOpen(_lifeCard.st);
  return true;
}
// [DECO-GUEST-1] 손님 — 놓은 것 + 자리(+ 계절 · 때)를 보고 그날 찾아온다(디자인 docs/deco_guests_art_20260924.md · 저장 설계 docs/deco_guests_design.md §4).
//  계산만 한다(저장 0) — 그날 올 수 있는 손님 중 최대 둘 · 아직 못 만난 손님 먼저, 그다음 hash(학생, 날) · 같은 날 다시 열어도 같은 손님. 떠나거나 벌 없음.
//  처음 누른 날만 decoLife.s[손님] = 오늘(잎 쓰기 하나 · 평생 13번) → ⭐ 스티커 · 반짝(fx_first_meet). 친구 구경은 반응만(쓰기 0 · §7).
//  '물 몇 칸' = 이어진 물 바닥 칸 수 · '곁' = 둘레 3칸(디자인 표 그대로). sea = 계절(별빛 줄은 여름) · tm = 때(없으면 아무 때).
const GUESTS = [
  { k: 'frog', where: '연못 · 갈대', nm: '개구리', sea: 'spring summer autumn', say: '개굴! 갈대 사이가 좋아요', hint: '연못가 갈대 사이에서 개굴 소리가…' },
  { k: 'heron', where: '넓은 연못 · 징검돌', nm: '왜가리', sea: 'summer autumn', say: '넓은 연못 징검돌에서 쉬어 가요', hint: '넓은 연못의 징검돌 위에 누가 서 있을까' },
  { k: 'butterfly', where: '꽃밭', nm: '나비', sea: 'spring summer', say: '꽃밭이 넓어서 놀러 왔어요', hint: '꽃밭이 넓으면 날아와요', fly: 1 },
  { k: 'sparrow', where: '밀밭 · 보리밭', nm: '참새', sea: 'spring summer autumn winter', say: '짹짹! 곡식 냄새가 나요', hint: '곡식이 있는 곳에 짹짹' },
  { k: 'magpie', where: '침엽수', nm: '까치', sea: 'spring summer autumn winter', say: '깍깍! 반가운 소식이에요', hint: '소나무 꼭대기에 반가운 손님이', top: 1 },
  { k: 'squirrel', where: '잎 나무 둘', nm: '다람쥐', sea: 'autumn', say: '도토리가 어디 있을까?', hint: '가을 나무 아래 도토리를 찾는 누군가…' },
  { k: 'bee', where: '해바라기 · 라벤더', nm: '꿀벌', sea: 'summer', say: '붕붕! 꿀이 가득해요', hint: '해바라기가 많으면 붕붕…', fly: 1 },
  { k: 'ladybug', where: '장미', nm: '무당벌레', sea: 'spring summer', say: '장미 잎이 폭신해요', hint: '장미 곁에 빨간 점이…', small: 1 },
  { k: 'hedgehog', where: '낮은 관목 둘 · 저녁', nm: '고슴도치', sea: 'spring summer autumn', tm: 'evening', say: '부스럭… 저녁 산책 중이에요', hint: '관목 덤불 속 부스럭…' },
  { k: 'owl', where: '큰 나무 · 벚나무 · 밤', nm: '부엉이', sea: 'spring summer autumn winter', tm: 'night', say: '부엉~ 밤 나무가 좋아요', hint: '큰 나무에 밤 손님이…', top: 1 },
  { k: 'mallard', where: '아주 넓은 물', nm: '청둥오리', sea: 'autumn winter', say: '꽥! 아주 넓은 물이 좋아요', hint: '아주 넓은 물을 좋아해요' },
  { k: 'snowhare', where: '관목 · 침엽수 · 겨울', nm: '눈토끼', sea: 'winter', say: '눈 오는 날엔 관목 곁이 포근해요', hint: '눈 오는 날 관목 곁에…' },
  { k: 'firefly', where: '물가 · 여름 밤', nm: '반딧불', sea: 'summer', tm: 'night', say: '반짝반짝… 여름 밤 물가예요', hint: '여름 밤 물가에 작은 불빛이…', fly: 1, small: 1 },
];
const GUEST_LEAF_TREES = ['d_y9', 'd_y12', 'd_y15', 'd_y19', 'd_y47', 'd_y48', 'd_y64'];   // 다람쥐 — 잎 나무(계절 낙엽과 같은 목록)
function _guestHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
//  마당을 한 번 훑은 것(물 덩어리 · 꽃밭 덩어리 · 장식 자리) — 손님 조건이 같이 쓴다
function _guestScan(student) {
  const fl = _yardFloorGet(student), name = (r, c) => _floorParse(fl[r + '_' + c]).name;
  const comps = (want) => {   // 이어진(상하좌우) 칸 덩어리들 — 큰 것부터
    const seen = new Set(), out = [];
    Object.keys(fl).forEach(k => {
      if (seen.has(k)) return;
      const [r0, c0] = k.split('_').map(Number);
      if (!want(name(r0, c0))) return;
      const cells = [], q = [[r0, c0]]; seen.add(k);
      while (q.length) { const [r, c] = q.pop(); cells.push([r, c]);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const kk = (r + dr) + '_' + (c + dc); if (!seen.has(kk) && fl[kk] !== undefined && want(name(r + dr, c + dc))) { seen.add(kk); q.push([r + dr, c + dc]); } }); }
      out.push(cells);
    });
    return out.sort((a, b) => b.length - a.length);
  };
  const water = comps(t => t === 'water'), beds = comps(t => !!_FLOOR_EDGE_COLOR[t] || t === 'wildflower');
  const decos = _decoList(student).filter(p => p.area === 'yard');
  return { water, beds, decos, of: ids => decos.filter(p => ids.indexOf(p.id) >= 0) };
}
//  칸 거리(발자리 네모끼리 · 체비셰프)
function _guestGap(p, q) { const a = getDecoSize(p.id), b = getDecoSize(q.id);
  const dr = Math.max(0, q.row - (p.row + a.h - 1), p.row - (q.row + b.h - 1)), dc = Math.max(0, q.col - (p.col + a.w - 1), p.col - (q.col + b.w - 1)); return Math.max(dr, dc); }
function _guestBeside(p) { const z = getDecoSize(p.id); return { r: p.row + z.h - 1, c: p.col + z.w, deco: p }; }   // 발자리 오른쪽 옆 칸
function _guestOn(p, top) { const z = getDecoSize(p.id); return { r: p.row + z.h - 1, c: p.col + (z.w - 1) / 2, deco: p, top: !!top }; }
//  손님 k 가 올 자리(없으면 null)
function _guestSpot(k, S) {
  const w = S.water, big = n => w.find(cc => cc.length >= n), near = (p, cells, d) => cells.some(([r, c]) => { const z = getDecoSize(p.id);
    return r >= p.row - d && r <= p.row + z.h - 1 + d && c >= p.col - d && c <= p.col + z.w - 1 + d; });
  const mid = cells => cells[Math.floor(cells.length / 2)];
  switch (k) {
    case 'frog': { const cc = big(4), p = cc && S.of(['d_y29']).find(q => near(q, cc, 1)); return p ? _guestBeside(p) : null; }
    case 'heron': { const cc = big(9), p = cc && S.of(['d_y30']).find(q => near(q, cc, 1)); return p ? _guestOn(p) : null; }
    case 'butterfly': {
      const b9 = S.beds.find(cc => cc.length >= 9); if (b9) { const [r, c] = mid(b9); return { r: r - .6, c, fly: 1 }; }
      for (const cc of S.beds) for (const [r, c] of cc) if (w.some(wc => wc.some(([r2, c2]) => Math.max(Math.abs(r2 - r), Math.abs(c2 - c)) <= 3))) return { r: r - .6, c, fly: 1 };
      return null;
    }
    case 'sparrow': { const p = S.of(['d_y25', 'd_y35', 'd_y36'])[0]; return p ? _guestBeside(p) : null; }
    case 'magpie': { const p = S.of(['d_y46'])[0]; return p ? _guestOn(p, 1) : null; }
    case 'squirrel': { const t = S.of(GUEST_LEAF_TREES); for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (_guestGap(t[i], t[j]) <= 3) return _guestBeside(t[i]); return null; }
    case 'bee': { const f = S.of(['d_y7', 'd_y41']); return f.length >= 3 ? Object.assign(_guestOn(f[0]), { r: _guestOn(f[0]).r - .7, fly: 1 }) : null; }
    case 'ladybug': { const p = S.of(['d_y1', 'd_y43', 'd_y21'])[0]; return p ? _guestOn(p) : null; }
    case 'hedgehog': { const f = S.of(['d_y15']); return f.length >= 2 ? _guestBeside(f[0]) : null; }
    case 'owl': { const p = S.of(['d_y19', 'd_y12'])[0]; return p ? _guestOn(p, 1) : null; }
    case 'mallard': { const cc = big(16); if (!cc) return null; const [r, c] = mid(cc); return { r, c }; }
    case 'snowhare': { const p = S.of(['d_y15', 'd_y46'])[0]; return p ? _guestBeside(p) : null; }
    case 'firefly': { const cc = big(4); if (!cc) return null; const [r, c] = cc[0]; return { r: r - .8, c, fly: 1 }; }
  }
  return null;
}
//  오늘 온 손님(최대 둘) — 판 번호 · 학생 · 공간 · 날 · 계절 · 때가 같으면 다시 안 센다
let _guestMemo = null;
function _guestToday(student) {
  if (!student || typeof _yardLook !== 'function') return [];
  const lk = _yardLook(), ph = _yardPhase(), day = _lifeDay();
  const key = [student.id, DECO_SPACE, typeof _decoStateVer !== 'undefined' ? _decoStateVer : 0, day, lk.season, ph, DY.rows, DY.cols].join('|');
  if (_guestMemo && _guestMemo.key === key) return _guestMemo.list;
  const S = _guestScan(student), met = _lifeGet(student).s, out = [];
  GUESTS.forEach(g => {
    if (g.sea.split(' ').indexOf(lk.season) < 0 || (g.tm && g.tm !== ph)) return;
    const at = _guestSpot(g.k, S);
    if (at && at.r >= 0 && at.c >= 0 && at.c < DY.cols && at.r < DY.rows) out.push({ g, at, met: !!met[g.k] });
  });
  out.sort((a, b) => (a.met - b.met) || (_guestHash(student.id + '|' + day + '|' + a.g.k) - _guestHash(student.id + '|' + day + '|' + b.g.k)));
  const list = out.slice(0, 2);
  _guestMemo = { key, list };
  return list;
}
//  동물 층 안에 손님을 둔다(선물과 같은 층 · 누르면 말 · 처음이면 스티커)
function _guestSync(rec, student, C, hostId) {
  const mine = hostId !== 'ff-topview' && typeof CUR !== 'undefined' && student === CUR;
  const want = new Map(_guestToday(student).map(x => [x.g.k, x]));
  //  밤(별빛 포함)이면 #night 조각(까치 · 고슴도치 달빛 테 · 부엉이 눈 · 반딧불 빛 — 디자인 #1099 · 조각 없는 손님은 무시) · 반딧불은 밤 어둡게 필터를 안 받는다(빛으로 보이게)
  const nf = _yardPhase() === 'night' ? 'night' : '';
  const art = k => (typeof _artSrc === 'function' && _artSrc('deco/guest_' + k + '.svg', nf || undefined)) || ('./assets/deco/guest_' + k + '.svg' + (nf ? '#' + nf : ''));
  rec.guests = rec.guests || new Map();
  rec.guests.forEach((el, k) => { if (!want.has(k)) { if (el.parentNode) el.parentNode.removeChild(el); rec.guests.delete(k); } });
  want.forEach(({ g, at, met }, k) => {
    let el = rec.guests.get(k);
    if (!el) {
      el = document.createElement('button');
      el.type = 'button'; el.className = 'deco-guest'; el.setAttribute('aria-label', '손님 ' + g.nm);
      el.innerHTML = `<img class="dgu-art" src="${art(k)}" alt="${g.nm}"><img class="dgu-tw" src="${_lifeArt('fx_twinkle')}" alt="">`; el._nf = nf;
      ['pointerdown', 'touchstart', 'mousedown'].forEach(t => el.addEventListener(t, e => e.stopPropagation(), { passive: true }));
      el.addEventListener('click', e => { e.stopPropagation(); _guestTap(k, el, mine); });
      rec.world.appendChild(el); rec.guests.set(k, el);
    }
    el.classList.toggle('is-new', mine && !met);   // 아직 못 만난 손님은 반짝 — 눌러 보게
    if (el._nf !== nf) { el._nf = nf; const im = el.querySelector('.dgu-art'); if (im) im.src = art(k); }   // 때가 바뀌면 그림 조각도
    el.classList.toggle('glow', k === 'firefly' && !!nf);
    el.classList.toggle('fly', !!(at.fly || g.fly));
    //  크기 = 칸의 .78(작은 벌레 .5 · 디자인 '칸의 .5~.8' 위쪽 — .62 는 칸 27px 에서 17px 라 잘 안 보였다) · 누르는 자리 44px 이상 · 발은 그 칸 아래(나무 위 손님은 그림 꼭대기)
    const gz = Math.max(16, Math.round(C * (g.small ? .5 : .78))), hit = Math.max(44, gz);
    let footY = (at.r + 1) * C;
    if (at.top && at.deco) {
      const im = _decoImg(at.deco.id), z = getDecoSize(at.deco.id);
      const hDraw = im && im.naturalWidth ? z.w * C * im.naturalHeight / im.naturalWidth : (z.h + 1) * C;
      footY = (at.deco.row + z.h) * C - hDraw * .86;
    }
    const cx = (at.c + .5) * C;
    el.style.width = el.style.height = hit + 'px'; el.style.setProperty('--g', gz + 'px');
    el.style.transform = 'translate(' + Math.round(cx - hit / 2) + 'px,' + Math.round(footY - gz / 2 - hit / 2 - gz * .35) + 'px)';
    el.style.zIndex = String(Math.round(at.r + 2));
  });
}
function _guestTap(k, el, mine) {
  const g = GUESTS.find(x => x.k === k);
  if (!g) return false;
  const say = document.createElement('div');
  say.className = 'deco-anim-say'; say.textContent = g.say;
  el.appendChild(say); setTimeout(() => { if (say.parentNode) say.parentNode.removeChild(say); }, 1600);
  if (!mine || !CUR) return false;   // 친구 구경 — 반응만(쓰기 0)
  const L = _lifeGet(CUR);
  if (L.ro || L.s[k]) return false;   // 이미 만난 손님 — 말만(쓰기 0)
  _lifeWrite(CUR, { ['s/' + k]: _lifeDay() });   // 처음 만난 날 — 잎 쓰기 하나
  el.classList.remove('is-new');
  const fx = document.createElement('img'); fx.className = 'dgu-first'; fx.src = _lifeArt('fx_first_meet'); fx.alt = '';
  el.appendChild(fx); setTimeout(() => { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 900);
  const n = Object.keys(_lifeGet(CUR).s).filter(x => GUESTS.some(q => q.k === x)).length;
  toast(`⭐ 처음 만난 손님 — ${g.nm}! 스티커를 받았어요 (손님 도감 ${n}/${GUESTS.length})`);
  return true;
}
// [DECO-GUEST-2] 🐾 손님 도감 — 만난 손님은 ★ 스티커 · 어디 · 처음 온 날 / 못 만난 손님은 실루엣 + 힌트(디자인 시안 dex) · 계절 칩으로 거르기 · 읽기만(저장 0).
//  들어가는 길은 🎁 선물 상자 안 단추(윗줄을 더 붐비게 하지 않는다). 친구 것은 보지 않는다(내 도감).
let _dexSea = 'all';
function _guestDayText(day) { const d = new Date(day * 86400000); return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일'; }   // _lifeDay 의 날 번호 → 한국 날짜
function decoGuestDex(open, sea) {
  let box = document.getElementById('deco-dex');
  if (open === false) { if (box) box.remove(); return; }
  if (sea) _dexSea = sea;
  const met = _lifeGet(CUR).s, host = document.getElementById('interior-fullscreen') || document.body;
  if (!box) { box = document.createElement('div'); box.id = 'deco-dex'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '손님 도감'); host.appendChild(box); }
  const n = GUESTS.filter(g => met[g.k]).length;
  const SEAS = [['all', '전체'], ['spring', '🌸 봄'], ['summer', '☀️ 여름'], ['autumn', '🍂 가을'], ['winter', '❄️ 겨울']];
  const list = GUESTS.filter(g => _dexSea === 'all' || g.sea.split(' ').indexOf(_dexSea) >= 0);
  const card = g => met[g.k]
    ? `<div class="ddx-card is-met"><span class="ddx-star" aria-hidden="true">★</span><img src="${_lifeArt('sticker_' + g.k)}" alt=""><b>${g.nm}</b><small>${g.where}</small><small>처음 온 날 ${_guestDayText(met[g.k])}</small></div>`
    : `<div class="ddx-card"><img class="ddx-sil" src="${_lifeArt('guest_' + g.k)}" alt=""><b>?</b><small>${g.hint}</small></div>`;
  box.innerHTML = `<div class="ddx-head"><span>🐾 손님 도감 <small>${GUESTS.length} 손님 중 <b>${n}</b> 만남</small></span>`
    + `<span class="ddx-chips">${SEAS.map(([k, t]) => `<button type="button" class="ddx-chip${_dexSea === k ? ' on' : ''}" onclick="decoGuestDex(true,'${k}')">${t}</button>`).join('')}</span>`
    + `<button type="button" class="dgb-x" aria-label="닫기" onclick="decoGuestDex(false)">✕</button></div>`
    + `<div class="ddx-grid">${list.map(card).join('')}</div>`
    + `<div class="ddx-foot">손님은 <b>놓은 것과 자리</b>를 보고 찾아와요 · 돌보지 않아도 괜찮아요 — 떠나거나 아프지 않아요 · 처음 만나면 ★ 스티커</div>`;
}
//  🎁 선물 상자 — 받은 것마다 개수 · 못 받은 것은 '?' · "골드가 아니에요"
function decoGiftBox(open) {
  let box = document.getElementById('deco-giftbox');
  if (open === false || (open === undefined && box)) { if (box) box.remove(); return; }
  const L = _lifeGet(CUR), host = document.getElementById('interior-fullscreen') || document.body;
  if (!box) { box = document.createElement('div'); box.id = 'deco-giftbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '선물 상자'); host.appendChild(box); }
  const cell = k => { const n = +L.g[k] || 0;
    return `<div class="dgb-cell${n ? '' : ' is-none'}"><img src="${_lifeArt('gift_' + k)}" alt="${LIFE_GIFT_NAME[k]}"><span>${n ? '×' + n : '?'}</span></div>`; };
  box.innerHTML = `<div class="dgb-head">🎁 선물 상자<button type="button" class="dgb-x" aria-label="닫기" onclick="decoGiftBox(false)">✕</button></div>`
    + `<div class="dgb-grid">${LIFE_GIFT_BOX.map(cell).join('')}</div>`
    + (L.p ? `<div class="dgb-photo"><div class="dgb-frame"><img src="${_lifeArt('ui_photo_frame')}" alt=""><canvas width="300" height="225"></canvas></div>`
      + `<div><b>사진 조각 ${L.p % 6 || 6} / 6</b> — 친해지기 단계가 오를 때 한 조각${L.p >= 6 ? ` · 모은 사진 ${Math.floor(L.p / 6)}장` : ''}</div></div>` : '')
    + (typeof GUESTS !== 'undefined' ? `<button type="button" class="dgb-dex" onclick="decoGiftBox(false);decoGuestDex(true)">🐾 손님 도감 ${GUESTS.filter(g => L.s[g.k]).length} / ${GUESTS.length}</button>` : '')   // [DECO-GUEST-2]
    + `<div class="dgb-foot">골드가 아니에요 · 모아서 보는 것 · 팔 수 없어요</div>`;
  if (L.p) _lifePhotoPaint(box.querySelector('.dgb-frame canvas'), L.p % 6 || 6);
}
//  사진 틀 여섯 칸(디자인 #1003: 칸 = x 24+84c · y 24+86r · 80×82) — 받은 조각 칸에 지금 내 마당 판의 그 부분을 그린다(저장 0)
function _lifePhotoPaint(cv, n) {
  if (!cv || !cv.getContext) return;
  const x = cv.getContext('2d'), src = (typeof _dCv !== 'undefined' && _dCv && _dCv.width) ? _dCv : null;
  x.clearRect(0, 0, 300, 225);
  const sw = src ? Math.min(src.width, src.height * 252 / 168) : 0, sh = sw * 168 / 252, sx = src ? (src.width - sw) / 2 : 0, sy = src ? (src.height - sh) / 2 : 0;
  for (let k = 0; k < 6; k++) {
    const c = k % 3, r = Math.floor(k / 3), X = 24 + 84 * c, Y = 24 + 86 * r;
    if (k < n) {
      if (src) { try { x.drawImage(src, sx + sw * c / 3, sy + sh * r / 2, sw / 3, sh / 2, X, Y, 80, 82); } catch (e) {} }
      else { x.fillStyle = '#7fae4e'; x.fillRect(X, Y, 80, 82); }
    } else { x.setLineDash([5, 4]); x.strokeStyle = 'rgba(90,58,26,.45)'; x.lineWidth = 2; x.strokeRect(X + 3, Y + 3, 74, 76); x.setLineDash([]); }
  }
}
if (typeof document !== 'undefined') document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('deco-giftbox')) decoGiftBox(false); });
if (typeof document !== 'undefined') document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('deco-dex')) decoGuestDex(false); });   // [DECO-GUEST-2]


//  hostId 안(캔버스 위)에 동물 층을 맞춘다. 마당이 아니면 층을 없앤다.
//  이미 있는 동물은 그 자리를 지킨다(다시 그려도 처음부터 걷지 않게).
function _animSyncLayer(hostId, student, scene, C, W, H, panX, panY) {
  const host = document.getElementById(hostId);
  if (!host || !student) { _animStopLayer(hostId); return; }
  if (scene !== 'yard') { _animStopLayer(hostId); return; }
  //  [DECO-ANIM-HIDDEN-1] 판이 **안 보이면** 층을 만들지 않는다 — 전체화면을 닫으면 closeInteriorFullscreen 이 내 집 창 안의
  //  작은 판(안 보임)을 다시 그리는데, 거기에 동물 층이 새로 생겨 아이가 홈·학습·전투에 가 있는 내내 걷기 타이머가 돌았다.
  if (typeof host.getClientRects === 'function' && !host.getClientRects().length) { _animStopLayer(hostId); return; }

  const rows = DY.rows, cols = DY.cols;
  const list = _decoList(student).filter(p => p.area === 'yard' && ANIM_DECO[p.id]);   // [DECO-SPACE-1]
  const guests = typeof _guestToday === 'function' ? _guestToday(student) : [];   // [DECO-GUEST-1] 동물이 없어도 손님이 오는 날이면 층을 만든다
  if (!list.length && !guests.length) { _animStopLayer(hostId); return; }

  let rec = _animLayers.get(hostId);
  if (!rec) {
    const layer = document.createElement('div');
    layer.className = 'deco-anim-layer';
    const world = document.createElement('div');   // [DECO-ZOOM-1] 이 겹만 옮기면 동물이 판과 같이 움직인다
    world.className = 'deco-anim-world';
    layer.appendChild(world);
    rec = { layer, world, items: new Map() };
    _animLayers.set(hostId, rec);
  }
  rec.student = student;   // [DECO-DAYNIGHT-1] 밤 쉼터 찾기
  if (rec.layer.parentNode !== host) {
    try { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (e) {}
    host.appendChild(rec.layer);
  }
  rec.layer.style.width = W + 'px';
  rec.layer.style.height = H + 'px';
  rec.world.style.transform = 'translate(' + (-(panX || 0)) + 'px,' + (-(panY || 0)) + 'px)';

  const isFree = _animFreeMaker(student, rows, cols);
  const feeders = _feedersOf(student);   // [DECO-FEED-1]
  const keep = new Set(), now = Date.now(), still = _animReduced();
  //  보이는 칸 범위(한 칸 여유) — 밖이면 쉰다
  const vr0 = (panY || 0) / C - 2, vr1 = ((panY || 0) + H) / C + 1, vc0 = (panX || 0) / C - 1, vc1 = ((panX || 0) + W) / C + 1;

  list.forEach(p => {
    const d = GAME_DATA.decorations.find(x => x.id === p.id);
    if (!d) return;
    const sz = d.size || { w: 1, h: 1 };
    const key = p.id + '@' + p.row + '_' + p.col;
    keep.add(key);
    let st = rec.items.get(key);
    if (!st) {
      const el = document.createElement('div');
      el.className = 'deco-anim';
      const bob = document.createElement('div');
      bob.className = 'bob';
      const img = document.createElement('img');
      img.alt = d.name || '';
      bob.appendChild(img);
      el.appendChild(bob);
      rec.world.appendChild(el);
      _animProbeArt(p.id);
      st = { el, img, id: p.id, home: { row: p.row, col: p.col }, cur: { row: p.row, col: p.col }, fx: p.col, fy: p.row, jx: 0, jy: 0,
        dir: 1, state: 'idle', src: '', seg: null, path: [], goal: null, arrive: null,
        nextAt: now + _animRnd(400, 2400) };   // 처음 생각은 조금씩 어긋나게(한꺼번에 움직이지 않게)
      rec.items.set(key, st);
    }
    st.rec = rec;
    st.cfg = ANIM_DECO[p.id];
    st.w = sz.w; st.h = sz.h; st.C = C;
    st.isFree = isFree;
    st.pen = _penAt(student, p.row, p.col);   // [DECO-ANIM-3] 우리 안이면 그 안에서만
    st.feeder = _feederFor(student, st, feeders);   // [DECO-FEED-1] 갈 먹이통(없으면 null)
    if (!st.feeder) st.gathered = false;
    //  헤엄: 바닥을 물로 칠한 자리이거나, 물 있는 우리(연못 우리) 안이면
    st.swim = !!(st.cfg.water && (_groundAt(student, p.row, p.col) === 'water' || (st.pen && st.pen.water)));
    st.el.classList.toggle('swim', st.swim);
    //  쉼: 움직임 줄이기 · 화면 밖(걷는 중이면 그 걸음은 끝낸 자리로)
    const vis = st.fx + st.w > vc0 && st.fx < vc1 && st.fy + st.h > vr0 && st.fy < vr1;
    const frozen = still || !vis;
    if (frozen && st.seg) { st.cur = { row: st.seg.r1, col: st.seg.c1 }; st.fx = st.cur.col; st.fy = st.cur.row; st.seg = null; st.path = []; st.goal = null; st.arrive = null; st.state = 'idle'; }
    if (frozen !== st.frozen) { st.frozen = frozen; if (!frozen) st.nextAt = Math.min(st.nextAt, now + _animRnd(300, 1500)); }
    _animApplySrc(st);
    st.el.style.width = (sz.w * C) + 'px';
    st.el.style.height = (sz.h * C) + 'px';
    _animPlace(st);
  });

  [...rec.items.keys()].forEach(k => {
    if (keep.has(k)) return;
    const st = rec.items.get(k);
    if (st.el && st.el.parentNode) st.el.parentNode.removeChild(st.el);
    rec.items.delete(k);
  });

  if (hostId !== 'ff-topview' && typeof CUR !== 'undefined' && student === CUR && typeof _lifeGiftSync === 'function') _lifeGiftSync(rec, student, C);
  if (typeof _guestSync === 'function') _guestSync(rec, student, C, hostId);   // [DECO-GUEST-1] 손님(친구 구경도 · 쓰기는 내 마당만)   // [DECO-LIFE-3] 오늘 두고 간 선물(내 마당만 · 친구 구경은 안 보임)

  if (!_animHooked) {
    _animHooked = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) _animPauseAll(); else _animResumeAll(); });
  }
  if (!still && !(typeof document !== 'undefined' && document.hidden)) _animKick();
}

// ══ 장식 SVG 파이프라인 (DECO-SVG-1) ══════════════════════
//  assets/deco/<id>.svg 가 있으면 그 그림을 쓰고, 없으면 기존 _DFN 캔버스 그림을 그대로 쓴다.
//  · SVG는 "발밑 기준"으로 놓는다 — footprint 폭에 맞추고, 아래 끝을 footprint 바닥에 붙이고,
//    남는 높이는 위로 넘치게 둔다(가로등·아치처럼 위로 솟는 것을 눌러 담지 않기 위해).
//    따라서 SVG viewBox = footprint 비율 + 위로 필요한 여유. 원점은 발밑 중앙.
//  · 비율을 억지로 늘리지 않는다. 기존 _DFN 경로의 ctx.scale(w/h) 왜곡은 SVG가 들어오는
//    장식부터 자연히 사라진다(에셋이 없는 장식은 지금 모습 그대로 — 이번 변경으로 안 바뀜).
//  · <img>는 intrinsic 크기가 있어야 캔버스에 그릴 수 있으므로 SVG에 width/height 속성 필수.
// 뒤→앞 정렬 — 기준은 시작 줄이 아니라 **발밑 줄**(row + 높이).
//   세로 3칸 장미 아치를 2줄에 놓으면 발밑은 4줄이다. 시작 줄로 정렬하면
//   3줄에 있는 장식보다 먼저 그려져, 앞에 있어야 할 아치가 뒤로 밀린다.
//   같은 발밑 줄이면 왼쪽 먼저. 원본 배열은 건드리지 않는다.
function _decoFootRow(p) {
  const d = GAME_DATA.decorations.find(x => x.id === p.id);
  return (p.row || 0) + (((d && d.size) ? d.size.h : 1) - 1);
}
function _decoSorted(list) {
  return [...list].sort((a, b) => (_decoFootRow(a) - _decoFootRow(b)) || (a.col - b.col));
}
// ══ [DECO-BUNDLE-1] 그림 묶음 — 장식·바닥·밭 SVG 를 한 파일로(assets/deco/bundle/art.json · scripts/deco-bundle.mjs 가 만든다) ══
//  꾸미기를 열 때 그림 요청 60여 건 → 1건(압축 약 160KB). 받는 동안은 그림을 부르지 않고(끝나면 한 번에 다시 그린다),
//  묶음이 없거나 · 실패하거나 · 묶음에 없는 그림은 예전처럼 낱장 파일. 주소 뒤 #색(:target)은 blob 주소에도 그대로 붙는다.
const ART_BUNDLE_URL = './assets/deco/bundle/art.json';
const _ART = { state: 'idle', files: null, urls: new Map() };
function _artStart() {
  if (_ART.state !== 'idle') return _ART.state;
  if (typeof fetch !== 'function' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return (_ART.state = 'off');
  _ART.state = 'loading';
  fetch(ART_BUNDLE_URL).then(r => r.ok ? r.json() : null).then(j => {
    if (j && j.files && typeof j.files === 'object') { _ART.files = j.files; _ART.state = 'ready'; } else _ART.state = 'off';
  }).catch(() => { _ART.state = 'off'; }).then(_artReady);
  return 'loading';
}
//  path('deco/d_y1.svg') → 쓸 주소 · 받는 중이면 null(부른 쪽은 아무것도 남기지 않고 돌아간다 — 끝나면 _artReady 가 다시 그린다)
function _artSrc(path, frag) {
  const st = _artStart(), hash = frag ? '#' + frag : '';
  if (st === 'loading') return null;
  if (st === 'ready' && typeof _ART.files[path] === 'string') {
    let u = _ART.urls.get(path);
    if (!u) { u = URL.createObjectURL(new Blob([_ART.files[path]], { type: 'image/svg+xml' })); _ART.urls.set(path, u); }
    return u + hash;
  }
  return './assets/' + path.split('/').map(encodeURIComponent).join('/') + hash;
}
function _artHas(path) { return _ART.state === 'ready' ? typeof _ART.files[path] === 'string' : null; }   // 묶음으로 '있나' — 모르면 null
function _artReady() {
  try { _animLayers.forEach(rec => rec.items.forEach(st => { _animProbeArt(st.id); _animApplySrc(st); })); } catch (e) {}
  try { _drawDeco(); _ffRedrawSoon(); _floorPickSoon(); } catch (e) {}
  try { if (typeof renderDecoInv === 'function' && CUR && _ifMode) renderDecoInv(); } catch (e) {}
  try { if (typeof SHOP_TAB !== 'undefined' && SHOP_TAB === 'deco' && typeof renderShop === 'function' && CUR) renderShop(); } catch (e) {}
}

const _DECO_IMG = {};   // id → {img, ok} | {ok:false}  (없는 파일은 한 번만 시도)
function _decoImg(id) {
  const hit = _DECO_IMG[id];
  if (hit) return hit.ok ? hit.img : null;
  const src = _artSrc('deco/' + id + '.svg');   // [DECO-BUNDLE-1]
  if (src === null) return null;
  const img = new Image();
  const rec = { img, ok: false };
  _DECO_IMG[id] = rec;
  img.onload  = () => { rec.ok = (img.naturalWidth > 0 && img.naturalHeight > 0); if (rec.ok) { _drawDeco(); _ffRedrawSoon(); _floorPickSoon(); } };   // [DECO-FRIEND-ART-1] · [INDOOR-LOOK-1] 견본 액자
  img.onerror = () => { rec.ok = false; };
  img.src = src;
  return null;
}

// 장식 하나를 놓는다. SVG가 준비됐으면 true, 아니면 false(호출부가 기존 방식으로 그림).
//  [DECO-SEASON-1] 계절 나무 일곱 — 파일 하나에 네 계절(주소 뒤 #spring·#summer·#autumn·#winter · 없으면 지금 그림과 픽셀 같음)
const SEA_TREES = ['d_y9', 'd_y15', 'd_y19', 'd_y12', 'd_y47', 'd_y48', 'd_y64'];
//  ⑥ 꽃 장식 열 · ⑦ 우리 셋 — 겨울에만 #winter(사양 ⑥ · ⑦)
const SEA_WINTER_ONLY = ['d_y1', 'd_y2', 'd_y3', 'd_y7', 'd_y41', 'd_y42', 'd_y43', 'd_y44', 'd_y21', 'd_y61', 'd_y58', 'd_y60', 'd_y63'];
function _drawDecoSVG(id, px, py, bw, bh) {
  //  나무는 여름에도 #summer 를 넘긴다 — 주소 뒤가 없는 그림은 벚나무가 꽃 핀 모습이라 여름 초록이 아니다(사양 표 ②)
  const sea = SEA_TREES.indexOf(id) >= 0 ? _yardLook().season : (SEA_WINTER_ONLY.indexOf(id) >= 0 && _yardLook().season === 'winter') ? 'winter' : '';   // [DECO-LOOK-0] 필요할 때만 표를 읽는다(장식마다 부르는 길)
  const img = sea ? (_ambImg(id, sea) || _decoImg(id)) : _decoImg(id);
  if (!img) return false;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return false;
  const w = bw;                    // 땅에 닿는 폭 = footprint 폭
  const h = w * (nh / nw);         // 비율 유지 — 늘이지 않는다
  const src = _svgBmp('d:' + id + (sea && img !== _decoImg(id) ? '#' + sea : ''), img, w * 2, nh / nw);   // [DECO-PERF-1] 구운 비트맵 · 계절마다 따로
  _dCtx.drawImage(src, px, py + bh - h, w, h);   // 아래 끝을 footprint 바닥에 맞춤
  return true;
}

// ══ 바닥 SVG 파이프라인 (FLOOR-SVG-1) ══════════════════════
//  assets/floor/<name>.svg — 바닥은 100×100 조각을 셀마다 drawImage(c*C, r*C, C, C)로 찍는다.
//  · base: 바닥 이름 → tile_<이름>[_a~_d][#색]. 변형은 (r,c) 해시로 고정(다시 그려도 안 바뀜). 색은 정원 바닥만(_FLOOR_COLORS).
//  · 잔디 번짐: 잔디가 아닌 칸의 4방 이웃이 잔디면 fringe_grass_{n,e,s,w}(2종 교차),
//    두 변이 잔디면 in_<모서리>, 변은 아닌데 대각선만 잔디면 out_<모서리>. (옛 꽃밭 flower·들꽃 잔디 wildflower 는 잔디로 친다)
//  · 물가: 물 칸의 이웃이 물이 아니면 shore_{n,e,s,w} / in_* / out_*. 물가 먼저, 잔디 번짐 나중.
//  · 꽃밭 가장자리: 꽃밭 무리 칸의 이웃이 꽃밭 무리가 아니면 bed_*#꽃잎색(마감이 있으면 rim_<마감>_*). 같은 열두 조각 판정.
//    순서 = 바탕 → 가장자리/마감 → 물가 → 잔디 번짐.
//  · base 파일이 없거나 아직 안 왔으면 false → 호출부가 기존 fillRect+텍스처로 그린다(폴백).
//    오버레이 조각이 없으면 그 조각만 건너뛴다.
//  · FLOOR_SVG=false 로 두면 전부 기존 방식(단색)으로 돌아간다.
const FLOOR_SVG = true;
const _FLOOR_IMG = {};   // name[#색] → {img, ok}  (없는 파일은 한 번만 시도)
// [DECO-FLOOR-COLOR-1] 색은 한 파일 안의 `:target` 규칙이다 — 주소 끝에 `#색`. 같은 파일이라도 색마다 Image 가 따로라서
//  **그 색이 마당에 실제로 있을 때만** 부른다(미리 부르지 않는다 — 정원 바닥을 안 쓴 마당은 요청이 하나도 안 는다).
function _floorImg(name, color) {
  const key = color ? name + '#' + color : name;
  const hit = _FLOOR_IMG[key];
  if (hit) return hit.ok ? hit.img : null;
  const src = _artSrc('floor/' + name + '.svg', color);   // [DECO-BUNDLE-1]
  if (src === null) return null;
  const img = new Image();
  const rec = { img, ok: false };
  _FLOOR_IMG[key] = rec;
  img.onload  = () => { rec.ok = (img.naturalWidth > 0 && img.naturalHeight > 0); if (rec.ok) { _drawDeco(); _ffRedrawSoon(); _floorPickSoon(); } };   // [DECO-FRIEND-ART-1] · [DECO-FLOOR-PICK-1] 고르기 판 그림도
  img.onerror = () => { rec.ok = false; };
  img.src = src;
  return null;
}
// [DECO-FLOOR-PARSE-1] 바닥 저장값 해석은 여기 한 곳 — '이름#색+마감'(예 'tulipbed#red+picket' · 'hydrangea+stone'). 옛 값('stone')은 이름뿐이다.
//  · '#'·'+' 가 없는 값은 **이름 그대로**(옛 마당은 한 픽셀도 안 바뀐다) · 빈 값·글자가 아닌 값·못 읽는 새 형식은 잔디.
//  · 색·마감은 그림 주소와 캐시 키에 들어갈 값이라 [a-z0-9_] 만 받는다.
//  · 칸마다·이웃마다 불리므로 결과를 값별로 기억한다(얼린 객체 — 받은 쪽이 고치지 않는다).
//  · 지우개 판정('같은 값이면 걷어 낸다')은 저장값 글자 그대로 비교한다 = 색·마감까지 같을 때만.
function _floorParse(v) {
  const M = _floorParse._m || (_floorParse._m = new Map());
  let p = M.get(v);
  if (p) return p;
  let name = 'grass', color = '', rim = '';
  if (v && typeof v === 'string') {
    if (v.indexOf('#') < 0 && v.indexOf('+') < 0) name = v;
    else {
      const m = /^([a-z][a-z0-9_]*)(?:#([a-z0-9_]+))?(?:\+([a-z0-9_]+))?$/.exec(v);
      if (m) { name = m[1]; color = m[2] || ''; rim = m[3] || ''; }
    }
  }
  p = Object.freeze({ name, color, rim });
  if (M.size > 300) M.clear();
  M.set(v, p);
  return p;
}
const _FLOOR_VARIANTS = { grass:4, dirt:4, stone:2, flower:2, dry_earth:2, sand:2, water:2,
  tulipbed:2, tulipcol:2, hydrangea:3, wildflower:4, sunflowerbed:2, lavender:2, daisyfield:3 };   // [DECO-FLOOR-COLOR-1] 정원 바닥 7종
// [DECO-FLOOR-COLOR-1] 종류별로 그림 파일에 **실제로 있는** 색(기본색은 색 없음 = 'tulipbed'). 표에 없는 색은 기본색으로 그린다 —
//  저장본에 엉뚱한 색이 아무리 많아도 Image·비트맵이 이 표만큼만 생긴다. 표와 그림 파일이 맞는지는 단위 검사가 본다.
const _FLOOR_COLORS = {
  tulipbed: ['red', 'yellow', 'white', 'violet', 'orange', 'candy', 'sherbet', 'night'],
  tulipcol: ['red', 'yellow', 'white', 'violet', 'orange', 'candy', 'sherbet', 'night'],
  hydrangea: ['violet', 'pink', 'white', 'duo', 'moon'],
  wildflower: ['rainbow', 'snow'], sunflowerbed: ['orange', 'lemon'], lavender: ['pink', 'white'], daisyfield: ['yellow', 'pink'],
};
// [DECO-FLOOR-EDGE-1] 꽃밭 가장자리 — 이 표에 있는 종류가 '꽃밭 무리'다(들꽃 잔디는 풀이라 없다).
//  값 = 바탕 색 → 가장자리에 떨어진 꽃잎 색(bed_*.svg 의 일곱 색 중 하나). '' = 그 종류의 기본색 짝.
//  짝은 디자인 담당의 표 그대로(docs/deco_floor_edge_colors_20260920.md · #636). `_FLOOR_COLORS` 에 색이 늘면 여기도 한 줄 —
//  표에 없는 바탕 색은 그 바닥의 기본 짝('' 줄)으로 그린다.
const _FLOOR_BED_COLORS = ['pink', 'red', 'yellow', 'white', 'violet', 'orange', 'blue'];
const _FLOOR_RIMS = ['picket', 'stone', 'brick'];
const _FLOOR_EDGE_COLOR = Object.assign(Object.create(null), {   // (물려받은 이름 'constructor' 같은 값이 꽃밭으로 읽히지 않게)
  tulipbed:     { '': 'pink', red: 'red', yellow: 'yellow', white: 'white', violet: 'violet', orange: 'orange', candy: 'red', sherbet: 'pink', night: 'violet' },
  tulipcol:     { '': 'pink', red: 'red', yellow: 'yellow', white: 'white', violet: 'violet', orange: 'orange', candy: 'red', sherbet: 'pink', night: 'violet' },
  hydrangea:    { '': 'blue', violet: 'violet', pink: 'pink', white: 'white', duo: 'violet', moon: 'yellow' },
  lavender:     { '': 'violet', pink: 'pink', white: 'white' },
  sunflowerbed: { '': 'yellow', orange: 'orange', lemon: 'yellow' },
  daisyfield:   { '': 'white', yellow: 'yellow', pink: 'pink' },
});   // wildflower 는 풀밭의 한 종류라 이 표에 없다(가장자리 없음)
function _floorBaseName(type, r, c) {
  const n = _FLOOR_VARIANTS[type] || 0;
  if (!n) return 'tile_' + type;
  return 'tile_' + type + '_' + 'abcd'[(r*3 + c*7 + (r*c)%5) % n];
}
function _floorIsGrass(t) { return t === 'grass' || t === 'flower' || t === 'wildflower'; }   // 들꽃 잔디는 풀밭의 한 종류(가장자리 없음)
// 셀 하나(base + 가장자리). typeAt(r,c) → 타입 | null(격자 밖·집 영역 = 경계 없음으로 취급)
// [DECO-PERF-1] SVG 를 캔버스에 그리면 브라우저가 매번 새로 래스터한다(확대한 화면에서 바닥 612칸에 88ms).
//  한 번 비트맵으로 구워 두고 그걸 붙인다. 크기는 계단(약 19%씩)으로 굽는다 — 두 손가락으로 확대하는 동안
//  칸 크기가 조금씩 바뀌어도 같은 비트맵을 다시 쓴다(항상 필요한 크기 이상으로 구워 흐려지지 않는다).
const _SVG_BMP = new Map();
function _bmpStep(px) { return Math.max(4, Math.ceil(Math.pow(2, Math.ceil(Math.log2(Math.max(1, px)) * 4) / 4))); }
function _svgBmp(key, img, needW, ratio) {
  if (typeof document === 'undefined') return img;
  const w = _bmpStep(needW), h = Math.max(1, Math.round(w * ratio));
  const k = key + '|' + w;
  let b = _SVG_BMP.get(k);
  if (!b) {
    if (_SVG_BMP.size > 1500) _SVG_BMP.clear();   // 메모리 상한(대략 수십 MB 아래)
    b = document.createElement('canvas'); b.width = w; b.height = h;
    b.getContext('2d').drawImage(img, 0, 0, w, h);
    _SVG_BMP.set(k, b);
  }
  return b;
}
function _floorBmp(name, img, C) { return _svgBmp('f:' + name, img, C * 2, 1); }
// [DECO-SEASON-1] 계절 — 기기 날짜(달)로 정한다 · 저장 0 · 마을과 같은 표(docs/deco_seasons_20260924.md): 3~5 봄 · 6~8 여름(바탕 그림 그대로) · 9~11 가을 · 12~2 겨울
let _decoSeasonOv = null;   // 시험·시연용(저장 0)
function _decoSeason(d) {
  if (_decoSeasonOv) return _decoSeasonOv;
  const m = (d || new Date()).getMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
function _seaNow() { return typeof _decoSeason === 'function' ? _decoSeason() : 'summer'; }
// [DECO-LOOK-0] 마당 모습 표 — 그리는 코드는 _seaNow() · _decoPhase() · 하드코딩 색 대신 이 줄만 읽는다(docs/deco_star_yard_design.md §1).
//  지금 줄은 계절 넷에서만 나온다 — 보이는 변화 0(관문: 계절 넷 × 낮·저녁·밤 · 사진 지문이 바로 앞 커밋과 같다). 별빛(P3)이 줄 하나를 더한다.
//  season 나무·꽃·우리 조각 · ground 잔디 무리 무늬(grass | snow) · groundBg 무늬 아래 바탕('' = 칸 그림 그대로) · groundFrag 풀 번짐·밑동 풀 조각
//  waterFrag 물 조각 · bedWinter 꽃밭 겨울잠 · film 잔디 계절 막 · scatter 흩뿌림(나무 둘레 hi · 그 밖 lo) · snow 장식·지붕 눈 겹
//  shadow 밑동 그림자 · houseGround 집 밑·위 띠 땅 · farmSand 밭 그림이 아직 없을 때의 모래 두 색 · swimFrag 헤엄 그림 조각
//  phase 때 고정(없으면 실제 시각 · 별빛은 'night') · nightFilm 밤 막(.30 — DECO-NIGHT-FILM-1) · nightFilmEdit 카드를 들었거나 바닥 모드일 때 밤 막(절반)
//  animNight 밤 동물 층 필터(사진용 — 화면은 같은 값의 CSS) · island 떠 있는 섬(판 아래 테 + 몸) · sky 판 밖 별하늘(CSS) · labelOverFilm 집 이름표를 막 위에 다시
//  events 계절 행사가 뜨는가(별빛 = 안 뜸)
//  줄은 고정 객체다(칸마다 불러도 새로 만들지 않는다 — 뜨거운 길).
const YARD_LOOK_BASE = { ground: 'grass', groundBg: '', groundFrag: '', waterFrag: '', bedWinter: false, film: '', scatter: null, snow: false,
  shadow: 'rgba(30,52,14,.30)', houseGround: 'grass', farmSand: ['#c8a855', '#b89545'], swimFrag: '', phase: '',
  nightFilm: 'rgba(20,30,80,.30)', nightFilmEdit: 'rgba(20,30,80,.15)', animNight: 'brightness(.8) saturate(.85)', island: false, sky: false, labelOverFilm: false,
  events: true };
const YARD_LOOKS = {
  spring: Object.assign({}, YARD_LOOK_BASE, { season: 'spring', groundFrag: 'spring', film: 'rgba(200,235,130,.10)',   // 봄 막 #C8EB82 .10 · 벚나무 둘레 꽃잎(디자인 #1083)
    scatter: { name: 'season_petals_', trees: ['d_y12'], k1: 1, k2: 3, hi: .55, drift: .04 } }),
  summer: Object.assign({}, YARD_LOOK_BASE, { season: 'summer' }),
  autumn: Object.assign({}, YARD_LOOK_BASE, { season: 'autumn', groundFrag: 'autumn', film: 'rgba(240,168,72,.14)',   // 가을 막 #F0A848 .14 · 잎 나무 둘레 낙엽
    scatter: { name: 'season_leaves_', trees: ['d_y9', 'd_y12', 'd_y15', 'd_y19', 'd_y47', 'd_y48', 'd_y64'], k1: 2, k2: 4, hi: .6, drift: .04 } }),
  winter: Object.assign({}, YARD_LOOK_BASE, { season: 'winter', ground: 'snow', groundBg: '#eef3f8', groundFrag: 'winter', waterFrag: 'winter', bedWinter: true, snow: true }),
  //  [DECO-STAR-P3] 별빛 — 계절 없음(여름 그림 그대로 · 결정 3) · 남색 땅(star_ground + 은하수 띠 star_band · 잔디 얼룩 없음) · 풀 번짐·밑동 풀·물·헤엄 #star · 남색 그림자.
  //  밤 고정 · 밤 막 .30 · 섬 · 하늘은 P5. 아직 놀이판 개발 스위치(?look=star)로만 켠다(저장 0).
  star: Object.assign({}, YARD_LOOK_BASE, { season: 'summer', ground: 'star', groundFrag: 'star', waterFrag: 'star', swimFrag: 'star', shadow: 'rgba(8,10,34,.4)',
    //  [DECO-STAR-P5] 별밤 — 때 밤 고정 · 섬 · 별하늘 · 이름표는 막 위(막 .30 · 고르는 동안 절반 · 동물 필터는 보통 밤과 같다 — #1088)
    phase: 'night', island: true, sky: true, labelOverFilm: true,
    events: false }),   // [DECO-EVENT-1] 별빛 공간에는 계절 행사가 안 뜬다(별빛 설계 결정 3)
};
//  [DECO-STAR-P3] 개발 스위치 ?look=<줄> — 놀이판(play-boot 의 __PLAY + 가짜 프로젝트 play-deco-none)에서만 읽는다. 운영 경로에서는 읽지 않는다(PR 마다 grep).
let _yardLookDev = null;
//  [DECO-EVENT-1] 놀이판 주소 값 하나 — 모습(?look=) · 행사(?event=)가 같이 쓴다. student.js 에서 location.search 를 읽는 곳은 여기 한 곳.
function _playParam(name) {
  try {
    if (typeof window !== 'undefined' && window.__PLAY && typeof firebase !== 'undefined' && firebase.app().options.projectId === 'play-deco-none')
      return new URLSearchParams(location.search).get(name) || '';
  } catch (e) {}
  return '';
}
function _yardLookDevRead() {
  if (_yardLookDev !== null) return _yardLookDev;
  const v = _playParam('look');
  _yardLookDev = v && Object.prototype.hasOwnProperty.call(YARD_LOOKS, v) ? v : '';
  return _yardLookDev;
}
//  공간(sp)마다 한 줄 — 지금은 모든 공간이 기기 달의 계절(자리만 잡아 둔다 · 별빛 P3 부터 공간별)
function _yardLook(sp) { const dv = _yardLookDevRead(); return (dv && YARD_LOOKS[dv]) || YARD_LOOKS[_seaNow()] || YARD_LOOKS.summer; }
function _yardPhase(sp) { const lk = _yardLook(sp); return lk.phase || (typeof _decoPhase === 'function' ? _decoPhase() : 'day'); }
//  고정 난수(칸·열쇠마다 늘 같은 값) — 사양 그대로
function _seaHash(r, c, k) { return ((((r * 73856093) ^ (c * 19349663) ^ (k * 83492791)) >>> 0) % 1000) / 1000; }
// [DECO-FLOOR-BAKE-1] 칸 한 장 굽기 — 바탕 + 가장자리 조각(최대 13장)을 칸마다 매 틀 따로 그리던 것(무거운 마당 끌기 한 틀의 97% · 계획 C4)
//  → 그 칸에 올릴 조각 목록을 먼저 모으고, 목록이 같으면 한 번 구운 한 장을 그린다(목록 = 이웃 모양의 서명 · 아직 안 온 조각은 목록에서 빠져 다른 열쇠가 된다).
const _FLOOR_CELL = new Map();
let _floorCellPx = 0;   // 구운 칸들의 픽셀 합 — 6M(약 24MB)을 넘으면 비운다(확대 3배면 칸 한 장이 162px 이라 개수로는 못 막는다)
function _floorPaint(pieces, px, py, C) {
  if (pieces.length === 1 || typeof document === 'undefined') { pieces.forEach(([k, img]) => _dCtx.drawImage(_floorBmp(k, img, C), px, py, C, C)); return; }
  //  캔버스는 2배 — 칸 한 장을 화면 픽셀 그대로(2C)로 구워 1:1 로 찍는다(조각마다 2C 로 줄여 찍던 것과 픽셀이 같다 · 옛 마당 지문 불변)
  const w = Math.round(C * 2), key = w + '|' + pieces.map(p => p[0]).join('|');
  let b = _FLOOR_CELL.get(key);
  if (!b) {
    if (_floorCellPx > 6e6) { _FLOOR_CELL.clear(); _floorCellPx = 0; }
    b = document.createElement('canvas'); b.width = b.height = w;
    const x = b.getContext('2d');
    pieces.forEach(([k, img]) => x.drawImage(_floorBmp(k, img, C), 0, 0, w, w));
    _FLOOR_CELL.set(key, b); _floorCellPx += w * w;
  }
  _dCtx.drawImage(b, px, py, C, C);
}
function _drawFloorSVG(type, r, c, px, py, C, typeAt, color, rim) {
  const lk = _yardLook(), bedWinter = lk.bedWinter && !!_FLOOR_EDGE_COLOR[type];   // [DECO-SEASON-1] 겨울 꽃밭 = 흙 이랑·새싹·눈 조금 · [DECO-LOOK-0] 표에서
  const bname = bedWinter ? 'tile_bed_winter_' + (_seaHash(r, c, 5) < .5 ? 'a' : 'b') : _floorBaseName(type, r, c);
  const col = bedWinter ? '' : (type === 'water' && lk.waterFrag) ? lk.waterFrag   // [DECO-SEASON-1] ⑦ 겨울 물(tile_water_a·b#winter)
    : (color && _FLOOR_COLORS[type] && _FLOOR_COLORS[type].indexOf(color) >= 0) ? color : '';   // [DECO-FLOOR-COLOR-1]
  const base = _floorImg(bname, col);
  if (!base) return false;
  const pieces = [[col ? bname + '#' + col : bname, base]];   // 같은 파일·다른 색 = 다른 비트맵 · [DECO-FLOOR-BAKE-1] 그리지 않고 모은다
  const T = (dr, dc) => { const t = typeAt(r + dr, c + dc); return (t == null) ? type : t; };
  const put = (name, ec) => { const img = _floorImg(name, ec); if (img) pieces.push([ec ? name + '#' + ec : name, img]); };
  //  [DECO-FLOOR-EDGE-1] 변 넷 · 안 모서리 넷 · 바깥 모서리 넷 — 물가·꽃밭 가장자리·잔디 번짐이 같은 판정, 같은 순서다.
  //  n/e/s/w = 그 변의 이웃이 '바깥'인가 · out(dr,dc) = 그 대각선 이웃이 '바깥'인가 · v = 변 조각의 변형('' | '2') · ec = 조각 색
  const ring = (pre, v, ec, n, e, s, w, out) => {
    if (n) put(pre + 'n' + v, ec);
    if (e) put(pre + 'e' + v, ec);
    if (s) put(pre + 's' + v, ec);
    if (w) put(pre + 'w' + v, ec);
    if (n && e) put(pre + 'in_ne', ec);
    if (n && w) put(pre + 'in_nw', ec);
    if (s && e) put(pre + 'in_se', ec);
    if (s && w) put(pre + 'in_sw', ec);
    if (!n && !e && out(-1, 1))  put(pre + 'out_ne', ec);
    if (!n && !w && out(-1, -1)) put(pre + 'out_nw', ec);
    if (!s && !e && out(1, 1))   put(pre + 'out_se', ec);
    if (!s && !w && out(1, -1))  put(pre + 'out_sw', ec);
  };
  const v2 = ((r*5 + c*3) % 2) ? '2' : '';
  //  꽃밭 무리(들꽃 잔디 빼고 6종): 이웃이 꽃밭 무리가 **아닌** 변에만 가장자리. 마감이 있으면 rim_<마감>_*(색 없음), 없으면 bed_*#꽃잎색.
  //  · 종류·색이 달라도 꽃밭끼리 맞닿은 변은 안 그린다 — 색을 번갈아 깔면 줄무늬 화단 하나가 된다. 잔디 번짐은 안 그린다.
  //  · 마감 있는 칸은 **같은 마감의 꽃밭**만 안쪽으로 친다 → 울타리는 늘 빙 둘러 닫힌다(마감 없는 옆 밭은 그 울타리까지 꽃이 닿는다).
  const EC = _FLOOR_EDGE_COLOR[type];
  if (EC) {
    const rimOf = x => (x && _FLOOR_RIMS.indexOf(x) >= 0) ? x : '';
    const rm = rimOf(rim);
    const out = (dr, dc) => {
      const t = typeAt(r + dr, c + dc);
      if (t == null) return false;                       // 격자 밖·집 = 경계 없음(물가와 같다)
      if (!_FLOOR_EDGE_COLOR[t]) return true;
      return !!rm && rimOf(typeAt(r + dr, c + dc, true)) !== rm;
    };
    let ec = '';
    if (!rm) { ec = (col && Object.prototype.hasOwnProperty.call(EC, col)) ? EC[col] : EC['']; if (ec === 'pink') ec = ''; }   // bed_* 의 기본색 = pink(주소에 안 붙인다)
    if (!(bedWinter && !rm)) ring(rm ? 'rim_' + rm + '_' : 'bed_', v2, ec, out(-1, 0), out(0, 1), out(1, 0), out(0, -1), out);   // [DECO-SEASON-1] 겨울엔 꽃잎 가장자리 없음(마감은 그대로)
    _floorPaint(pieces, px, py, C);
    return true;
  }
  //  [DECO-WATER-ORDER-1] 물 칸은 **물가(shore_*)를 먼저, 잔디 번짐(fringe_grass_*)을 나중에** — 풀이 모래 띠 위로 번져
  //  '풀 둑 + 모래톱 + 잔물결'이 된다(디자인 담당 #503 의 새 물가 그림 전제).
  if (type === 'water') {
    const out = (dr, dc) => T(dr, dc) !== 'water';
    ring('shore_', '', '', out(-1, 0), out(0, 1), out(1, 0), out(0, -1), out);
  }
  if (!_floorIsGrass(type)) {
    const out = (dr, dc) => _floorIsGrass(T(dr, dc));
    ring('fringe_grass_', v2, lk.groundFrag, out(-1, 0), out(0, 1), out(1, 0), out(0, -1), out);   // [DECO-SEASON-1] 풀 번짐 계절색(겨울 = 눈 테) · [DECO-LOOK-0]
  }
  _floorPaint(pieces, px, py, C);
  return true;
}
// 집 안 벽 띠(벽지+걸레받이+창)와 마루. 그려졌으면 true(호출부가 구식 창문을 생략).
function _drawIndoorFloorSVG(offX, offY, C, W) {
  //  [INDOOR-LOOK-1] 고른 벽지·바닥 — 고르지 않았으면 지금 그림(파일 이름까지 같다). 친구 구경은 CUR 이 친구라 친구 것이 나온다.
  const look = _inLookParse(_inLookGet(CUR));
  const [fa, fc] = _inLookArt('floor', look.floor), [wa, wc] = _inLookArt('wall', look.wall);
  const wood = _floorImg(fa, fc);
  if (wood) for (let r = 0; r < DI.rows; r++) for (let c = 0; c < DI.cols; c++) _dCtx.drawImage(wood, offX + c*C, offY + r*C, C, C);
  const wall = _floorImg(wa, wc);
  if (!wall) return false;
  // 벽 타일의 아래 끝을 바닥 윗선(offY)에 맞추고 위로 채운다. 맨 윗줄은 잘려도 된다.
  const x0 = offX - Math.ceil(offX / C) * C;
  for (let y = offY - C; y > -C; y -= C) for (let x = x0; x < W; x += C) _dCtx.drawImage(wall, x, y, C, C);
  const bb = _floorImg('wall_baseboard');
  if (bb) for (let x = x0; x < W; x += C) _dCtx.drawImage(bb, x, offY - C, C, C);
  const win = _floorImg('wall_window');
  //  [INDOOR-WALL-1] 액자를 건 칸의 고정 창은 그리지 않는다(창 위에 액자가 겹쳐 보이지 않게)
  const hungCols = new Set(); _decoList(CUR).forEach(p => { if (p.area === 'indoor' && p.row === 0 && _isWallDeco(p.id)) for (let k = 0; k < getDecoSize(p.id).w; k++) hungCols.add(p.col + k); });
  if (win) [1, 5, 9].forEach(cc => { if (cc < DI.cols && !hungCols.has(cc)) _dCtx.drawImage(win, offX + cc*C, offY - C, C, C); });
  return true;
}
function _isFloorLayerDeco(p) {
  const d = GAME_DATA.decorations.find(x => x.id === p.id);
  return !!(d && d.layer === 'floor');
}
// ══ /FLOOR-SVG-1 ══════════════════════════════════════════

function _drawDeco() {
  try { _decoHandSync(); } catch (e) {}   // [DECO-PAN-1]
  if (!_dCtx) return;
  if (_drawDecoRaf) return; // 이미 RAF 예약됨 — 중복 방지
  _drawDecoRaf = requestAnimationFrame(() => {
    _drawDecoRaf = null;
    if (!_dCtx) return;
    // [DECO-ZOOM-1] 보이는 창만 옮긴다 — 그리는 코드는 판 좌표를 그대로 쓴다
    _dCtx.setTransform(2, 0, 0, 2, 0, 0);
    _dCtx.clearRect(0, 0, _dW, _dH);
    //  [DECO-LAWN-SEAM-1] 옮기는 값은 캔버스 픽셀(2배) 단위로 — ＋·－ 기준점 계산으로 111.375 같은 값이 오면 칸 경계가 픽셀 사이에 걸려
    //  이음새 알파가 191·143 → 판 뒤 어두운 바탕이 칸마다 가는 줄로 비쳤다(창조자 59-ⓑ105). 동물·움직임 층(DOM)과는 0.25px 안.
    _dCtx.setTransform(2, 0, 0, 2, -Math.round(_dPanX * 2), -Math.round(_dPanY * 2));
    if (DECO_SCENE === 'yard') { _drawYard(); if (_decoRectPrev) _drawRectPreview(); }   // [DECO-FLOOR-RECT-1] 끄는 동안의 네모
    else _drawIndoor();
    if (_decoHover && SEL_DECO) _decoDrawGhost(DECO_SCENE === 'yard' ? 'yard' : 'indoor', DECO_SCENE === 'yard' ? 0 : (_dCv._offX || 0), DECO_SCENE === 'yard' ? 0 : (_dCv._offY || 0), _dC);   // [DECO-SEL-HL-1]
    // [DECO-ANIM-1] 캔버스 위 동물 층 맞추기(마당만)
    _animSyncLayer(_ifActiveContainer || 'house-topview', CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
    try { _decoTplSync(); } catch (e) {}   // [DECO-FIRST-YARD-1]
    try { _decoMotionSync(); } catch (e) {}   // [DECO-MOTION-1]
    try { _decoPhaseSync(); } catch (e) {}   // [DECO-DAYNIGHT-1] 층 어둡게(CSS)·단추
  });
}

// [DECO-MOTION-1] 움직임 층 — 원래 움직이는 물건(풍차 날개 · 분수 물줄기 · 헛간 풍향계 · 오두막 연기 · 모닥불)을 산다(계획 C2 · 묶음 5 · docs/deco_living_yard_20260920.md).
//  assets/deco/motion.json(디자인)이 장식마다 '몸통(body)'과 움직이는 층을 준다 → 캔버스에는 멈춘 몸통을, 층은 판 위 DOM 에 얹어 CSS transform·opacity 로만 돌린다
//  (캔버스를 다시 그리지 않는다 · 합성기에서 돈다). 같은 장식끼리 박자가 맞지 않게 시작을 어긋나게. 저장 0.
//  꺼지는 때: 움직임 줄이기 · 판이 안 보일 때(동물 층과 같은 규칙) — 그때는 캔버스가 본 그림(날개까지 그려진 한 장)을 그린다.
//  아직 안 하는 것: 밤 불빛(glow — 꾸미기에 낮밤이 붙은 뒤) · 바람(흔들기) · 떠다니는 것(_ambient).
let _DECO_MOTION = null, _decoMotionAsked = false;
const _decoMvReady = {};   // id → true(층 그림까지 다 옴) | false(없음) | undefined(확인 중)
//  표 부르기는 움직임과 따로 — 움직임 줄이기에서도 밤 불빛·눈 겹은 쓴다(불빛·눈은 움직임이 아니다) · 친구 구경에서도(내 판을 안 열고 구경부터 가도)
function _decoMotionLoad() {
  if (_decoMotionAsked) return;
  _decoMotionAsked = true;
  try { fetch('./assets/deco/motion.json').then(r => r.ok ? r.json() : null).then(j => { if (j) { _DECO_MOTION = j; _drawDeco(); if (typeof _ffRedrawSoon === 'function') _ffRedrawSoon(); } }).catch(() => {}); } catch (e) {}
}
function _decoMotionOn() {
  if (!_ifMode || DECO_SCENE !== 'yard' || _animReduced()) return false;
  //  내 꾸미기 판 · 친구 구경 판(ff-topview)만 — 사진처럼 붙어 있지 않은 캔버스엔 층이 없다(날개 없는 풍차가 되지 않게 본 그림으로)
  //  [DECO-FRIEND-MOTION-1] 친구 마당에서도 풍차가 돈다(창조자 63-ⓑ107 — 내 마당에선 도는 풍차가 친구 집에선 멈춰 있었다)
  if (!_dCv || !_dCv.parentNode || !/^(if|ff)-topview$/.test(_dCv.parentNode.id)) return false;
  _decoMotionLoad();
  return !!_DECO_MOTION;
}
//  이 장식을 몸통으로 그릴까 — 층 그림까지 다 왔을 때만(날개 없는 풍차가 잠깐이라도 보이지 않게)
function _decoMotionBody(id) {
  if (!_decoMotionOn()) return '';
  const m = _DECO_MOTION[id];
  if (!m || !m.body || !Array.isArray(m.layers)) return '';
  if (_decoMvReady[id] === undefined) {
    if (_artStart() === 'loading') return '';   // [DECO-BUNDLE-1] 묶음이 오면 다시 그린다
    _decoMvReady[id] = null;
    const files = [m.body].concat(...m.layers.filter(L => L.kind !== 'glow').map(L => L.files || [L.file]));
    let left = files.length, bad = false;
    files.forEach(f => { const img = new Image(); img.onload = img.onerror = (e) => { if (e.type === 'error' || !img.naturalWidth) bad = true;
      if (--left === 0) { _decoMvReady[id] = !bad; if (!bad) { _drawDeco(); if (typeof _ffRedrawSoon === 'function') _ffRedrawSoon(); } } }; img.src = _artSrc('deco/' + f) || './assets/deco/' + f; });
  }
  return _decoMvReady[id] ? m.body.replace(/\.svg$/, '') : '';
}
//  [DECO-FRIEND-MOTION-1] 판마다 따로(host id — 내 마당 if-topview · 친구 구경 ff-topview)
const _decoMvs = new Map();
function _decoMvOf(id) { let mv = _decoMvs.get(id); if (!mv) { mv = { layer: null, world: null, items: new Map() }; _decoMvs.set(id, mv); } return mv; }
function _decoMotionStop(id) {
  const mv = _decoMvs.get(id || 'if-topview');
  if (!mv) return;
  if (mv.layer && mv.layer.parentNode) mv.layer.parentNode.removeChild(mv.layer);
  mv.items.clear(); mv.layer = null;
}
function _decoMotionSync() {
  const host = _dCv && _dCv.parentNode, hid = (host && host.id) || 'if-topview';
  if (!host || !_decoMotionOn() || (typeof host.getClientRects === 'function' && !host.getClientRects().length)) { _decoMotionStop(hid); return; }
  const _decoMv = _decoMvOf(hid);
  if (!_decoMv.layer) {
    const layer = document.createElement('div'); layer.className = 'deco-mv-layer';
    const world = document.createElement('div'); world.className = 'deco-anim-world';
    layer.appendChild(world); _decoMv.layer = layer; _decoMv.world = world;
  }
  if (_decoMv.layer.parentNode !== host) host.insertBefore(_decoMv.layer, _dCv.nextSibling);   // 캔버스 바로 위(동물 층 아래 — z-index 1 · 동물 2)
  const C = _dC, W = _dW, H = _dH;
  _decoMv.layer.style.width = W + 'px'; _decoMv.layer.style.height = H + 'px';
  _decoMv.world.style.transform = 'translate(' + (-_dPanX) + 'px,' + (-_dPanY) + 'px)';
  const keep = new Set();
  _decoList(CUR).forEach(p => {
    if (p.area !== 'yard' || !_decoMotionBody(p.id)) return;
    const z = getDecoSize(p.id), m = _DECO_MOTION[p.id], vb = (m.layers[0] && m.layers[0].bodyViewBox) || [100, 100];
    const w = z.w * C, u = w / vb[0], h = vb[1] * u, x0 = p.col * C, y0 = (p.row + z.h) * C - h;
    if (x0 + w < _dPanX - C || x0 > _dPanX + W + C || y0 + h < _dPanY - C || y0 > _dPanY + H + C) return;   // 화면 밖은 안 만든다
    const key = p.id + '@' + p.row + '_' + p.col; keep.add(key);
    let it = _decoMv.items.get(key);
    if (!it) {
      const box = document.createElement('div'); box.className = 'deco-mv';
      const phase = Math.random();   // 같은 장식끼리 박자가 어긋나게
      m.layers.forEach(L => {
        if (L.kind === 'glow') return;   // 밤 불빛은 낮밤이 붙은 뒤
        const files = L.files || [L.file], period = L.kind === 'frames' ? files.length * L.frameSec : (L.periodSec || 4);
        const copies = L.kind === 'rise' ? 2 : 1;
        for (let k = 0; k < copies; k++) files.forEach((f, i) => {
          const img = document.createElement('img'); img.alt = ''; img.src = _artSrc('deco/' + f) || './assets/deco/' + f;   // [DECO-BUNDLE-1]
          img.className = 'deco-mv-' + L.kind + (L.kind === 'frames' ? ' f' + files.length : '');
          const delay = L.kind === 'frames' ? -(((files.length - i) % files.length) * L.frameSec + phase * period) : -(phase + k / copies) * period;
          img.style.animationDuration = period + 's'; img.style.animationDelay = delay.toFixed(3) + 's';
          img._L = L; box.appendChild(img);
        });
      });
      _decoMv.world.appendChild(box);
      it = { box }; _decoMv.items.set(key, it);
    }
    //  자리·크기(배율이 바뀌면 다시) — 층 그림 크기는 몸통 단위(size · pivotInBody)
    const st = it.box.style;
    st.left = x0 + 'px'; st.top = y0 + 'px'; st.width = w + 'px'; st.height = h + 'px'; st.zIndex = String(p.row + z.h);
    [...it.box.children].forEach(img => {
      const L = img._L, sz = L.size || vb, pv = L.pivotInBody || [vb[0] / 2, vb[1] / 2], s2 = img.style;
      s2.width = sz[0] * u + 'px'; s2.height = sz[1] * u + 'px';
      if (L.kind === 'frames') { s2.left = '0px'; s2.top = '0px'; }
      else if (L.anchor === 'bottom-center') { s2.left = (pv[0] - sz[0] / 2) * u + 'px'; s2.top = (pv[1] - sz[1]) * u + 'px'; }
      else { s2.left = (pv[0] - sz[0] / 2) * u + 'px'; s2.top = (pv[1] - sz[1] / 2) * u + 'px'; }
    });
  });
  [..._decoMv.items.keys()].forEach(k => { if (!keep.has(k)) { const it = _decoMv.items.get(k); if (it.box.parentNode) it.box.parentNode.removeChild(it.box); _decoMv.items.delete(k); } });
}

// [DECO-PHOTO-1] 내 마당 사진 한 장 — 판 전체를 한 장으로(격자·놓을 곳 표시·마우스 모습 없이) · 동물은 지금 선 자리에 · 아래에 이름과 날짜.
//  그림 파일로 내려받는다. 저장본·화면 상태는 안 바뀐다(그리는 동안만 전역 값을 빌린다 — 친구 구경과 같은 방법). 계획 묶음 6.
let _decoPhotoMode = false;
//  사진 틀 — 집·장식·칠한 바닥·밭을 품는 네모 + 둘레 3칸(적어도 24×14칸 · 판 안) · 칸 단위
function _decoPhotoFrame() {
  let r0 = 0, r1 = DH.rows - 1, c0 = _houseCol0(), c1 = _houseCol0() + DH.cols - 1;
  const grow = (r, c, h, w) => { r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r + h - 1); c1 = Math.max(c1, c + w - 1); };
  _decoList(CUR).forEach(p => { if (p.area === 'yard') { const z = getDecoSize(p.id); grow(p.row, p.col, z.h, z.w); } });
  Object.keys(_yardFloorGet(CUR)).forEach(k => { const [r, c] = k.split('_').map(Number); if (r >= 0 && c >= 0) grow(r, c, 1, 1); });
  if (DECO_SPACE === 1) { const f = _getFarmZone(); grow(f.startRow, f.startCol, f.rows, f.cols); }
  r0 = Math.max(0, r0 - 3); c0 = Math.max(0, c0 - 3); r1 = Math.min(DY.rows - 1, r1 + 3); c1 = Math.min(DY.cols - 1, c1 + 3);
  //  모자라면 양쪽으로 한 칸씩 넓힌다(판 끝에 닿으면 반대쪽만)
  const need = (a, b, min, max) => { while (b - a + 1 < min && (a > 0 || b < max - 1)) { if (a > 0) a--; if (b - a + 1 < min && b < max - 1) b++; } return [a, b]; };
  [c0, c1] = need(c0, c1, 24, DY.cols); [r0, r1] = need(r0, r1, 14, DY.rows);
  return { r0, c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1 };
}
async function decoPhoto(opt) {
  if (DECO_SCENE !== 'yard') { toast('📷 사진은 마당에서 찍어요 — 🌿 마당으로 가서 눌러 주세요'); return null; }
  //  동물은 캔버스가 안 그려서 그림이 아직 없을 수 있다 — 먼저 부른다(2초까지)
  const pets = _decoList(CUR).filter(p => p.area === 'yard' && ANIM_DECO[p.id]);
  for (let i = 0; i < 20 && pets.some(p => !_decoImg(p.id)); i++) await new Promise(r => setTimeout(r, 100));
  const F = _decoPhotoFrame();
  const C = Math.max(12, Math.min(32, Math.floor(1920 / F.cols))), top = C, foot = Math.round(C * 1.6);
  const W = F.cols * C, H = F.rows * C + top + foot;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const keep = { cv: _dCv, ctx: _dCtx, W: _dW, H: _dH, C: _dC, px: _dPanX, py: _dPanY, z: _dZoom, sel: SEL_DECO, hover: _decoHover, mode: DECO_MODE };
  const rec = _animLayers.get(_ifActiveContainer || 'house-topview');
  try {
    _decoPhotoMode = true; SEL_DECO = null; _decoHover = null; DECO_MODE = 'deco';
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0E1621'; ctx.fillRect(0, 0, W, H);
    _dCv = cv; _dCtx = ctx; _dW = W; _dH = H - foot; _dC = C; _dPanX = F.c0 * C; _dPanY = F.r0 * C - top; _dZoom = 1;
    ctx.setTransform(1, 0, 0, 1, -_dPanX, -_dPanY);
    if (F.r0 === 0) {   // 판 맨 위를 찍으면 위 잔디 띠 한 줄(굴뚝·윗줄 나무)
      const hg = _yardLook().houseGround, gr = () => hg;   // [DECO-LOOK-0]
      for (let c = F.c0; c < F.c0 + F.cols; c++) if (!(FLOOR_SVG && _drawFloorSVG(hg, 999, c, c * C, -C, C, gr))) { ctx.fillStyle = FLOOR_TILES[hg].bg; ctx.fillRect(c * C, -C, C, C); }
    }
    _drawYard();
    //  동물 — 지금 선 자리(층이 없으면 놓은 자리) · 한 장 그림
    //  [DECO-DAYNIGHT-1] 저녁·밤 사진 — 동물은 색 막 뒤에 그리니 화면의 동물 층과 같은 필터(CSS 와 같은 값)로(안 하면 밤 사진에 동물만 밝게 떴다)
    const ph = _yardPhase();   // [DECO-LOOK-0]
    if (ph !== 'day') ctx.filter = ph === 'night' ? _yardLook().animNight : 'brightness(.9) sepia(.18) saturate(1.05)';   // [DECO-STAR-P5] 밤 필터는 표에서(CSS 와 같은 값)
    pets.forEach(p => {
      const st = rec && rec.items.get(p.id + '@' + p.row + '_' + p.col), z = getDecoSize(p.id);
      _drawDecoSVG(p.id, (st ? st.fx : p.col) * C, (st ? st.fy : p.row) * C, z.w * C, z.h * C);
    });
    ctx.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(14,22,33,.92)'; ctx.fillRect(0, H - foot, W, foot);
    ctx.fillStyle = '#ffd866'; ctx.font = `700 ${Math.round(foot * .45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const d = new Date(), day = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
    ctx.fillText('🌿 ' + (CUR.name || '') + '의 마당 · ' + day, W / 2, H - foot / 2);
  } finally {
    _decoPhotoMode = false; SEL_DECO = keep.sel; _decoHover = keep.hover; DECO_MODE = keep.mode;
    _dCv = keep.cv; _dCtx = keep.ctx; _dW = keep.W; _dH = keep.H; _dC = keep.C; _dPanX = keep.px; _dPanY = keep.py; _dZoom = keep.z;
  }
  if (opt && opt.canvas) return cv;   // 시험용 — 내려받지 않는다
  try {
    cv.toBlob(b => {
      if (!b) { toast('📷 사진을 만들지 못했어요'); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (CUR.name || '내') + '_마당.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('📷 마당 사진을 저장했어요');
    }, 'image/png');
  } catch (e) { toast('📷 사진을 만들지 못했어요'); }
  return cv;
}

// [DECO-DAYNIGHT-1] 낮 · 저녁 · 밤 — 기본은 실제 시각(6~17시 낮 · 17~19시 저녁 · 그 밖 밤), ☀️🌇🌙 단추로 아이가 바꿔 본다(저장 0 · 다시 열면 실제 시각).
//  보스 결정(09-24): 수업이 낮이라 단추가 없으면 밤을 못 본다. 그림은 디자인 motion.json `_ambient`(glow · pool · windows) 그대로:
//  색 막(저녁 rgba(255,150,80,.2) · 밤 rgba(20,30,80,.30) — [DECO-NIGHT-FILM-1] 전엔 .48) → 불빛 웅덩이·불빛 원(lighter · 지름 1.8배 · 저녁 .65·.8배 / 밤 .9·1배) → 창 불빛(보통 합성).
//  동물·움직임 층(DOM)은 같은 결로 어둡게(CSS). 밤이면 동물은 쉼터 둘레에서 잔다(_animThink).
let _decoPhaseOv = null;
function _decoPhase(now) {
  if (_decoPhaseOv) return _decoPhaseOv;
  const h = (now || new Date()).getHours();
  return h >= 6 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'evening' : 'night';
}
const DECO_PHASE_ICON = { day: '☀️', evening: '🌇', night: '🌙' }, DECO_PHASE_NAME = { day: '낮', evening: '저녁', night: '밤' };
function _decoPhaseSync() {
  const ph = _yardPhase(), b = document.getElementById('if-phase-btn'), host = document.getElementById('if-topview');   // [DECO-LOOK-0]
  if (b) { b.textContent = DECO_PHASE_ICON[ph]; b.title = DECO_PHASE_NAME[ph] + ' — 눌러서 바꿔 보기'; b.setAttribute('aria-label', '지금 ' + DECO_PHASE_NAME[ph] + ' · 눌러서 바꿔 보기'); }
  if (host) { host.classList.toggle('is-evening', DECO_SCENE === 'yard' && ph === 'evening'); host.classList.toggle('is-night', DECO_SCENE === 'yard' && ph === 'night');
    host.classList.toggle('look-sky', DECO_SCENE === 'yard' && _yardLook().sky); }   // [DECO-STAR-P5] 판 밖 별하늘 · 동물 층 별밤 필터(CSS)
}
function decoPhaseCycle() {
  const order = ['day', 'evening', 'night'], next = order[(order.indexOf(_decoPhase()) + 1) % 3];
  _decoPhaseOv = next;
  _decoPhaseSync(); _drawDeco();
  //  동물이 바로 알아채게 — 다음 생각을 당긴다
  const now = Date.now();
  _animLayers.forEach(rec => rec.items.forEach(st => { if (!st.seg) st.nextAt = Math.min(st.nextAt, now + _animRnd(200, 900)); }));
  if (typeof _animKick === 'function') _animKick();
  toast(DECO_PHASE_ICON[next] + ' ' + DECO_PHASE_NAME[next] + '이에요' + (next === 'night' ? ' — 동물들이 잘 곳을 찾아요' : '') + ' (다시 열면 지금 시각으로)');
}
const _AMB_IMG = {};
function _ambImg(name, color) {   // assets/deco/<name>.svg[#색] — 색은 그림 안 :target 규칙
  const key = color ? name + '#' + color : name, hit = _AMB_IMG[key];
  if (hit) return hit.ok ? hit.img : null;
  const src = _artSrc('deco/' + name + '.svg', color);   // [DECO-BUNDLE-1]
  if (src === null) return null;
  const img = new Image(), rec = { img, ok: false }; _AMB_IMG[key] = rec;
  img.onload = () => { rec.ok = img.naturalWidth > 0; if (rec.ok) { _drawDeco(); if (typeof _ffRedrawSoon === 'function') _ffRedrawSoon(); } };   // 친구 구경도 같은 그림을 쓴다
  img.src = src;
  return null;
}
// [DECO-EVENT-1] 계절 행사 — 계절마다 며칠만 마당에 잠깐 나타나는 장식 한 벌(docs/deco_season_events_20260924.md · 사용자 승인 09-24 · 저장 0)
//  아이 것이 아니다(사지도 놓지도 않았다): 옮기기 · 치우기 · 팔기 안 됨 · 누르면 말 한 줄 · 카드를 들고 누르면 놓기가 먼저(행사가 비켜 간다).
//  날짜는 이 표 한 줄씩(교사가 바꾸려면 여기만 · 끝날 포함 · 기기 날짜). 별빛 모습(표 events:false)에는 안 뜬다. 친구 마당도 같은 날이면 보인다.
//  자리: 아이 마당 장식들의 한가운데(발자리 행·열 평균 · 없으면 집 문 앞 아래)에서 가장 가까운 빈 잔디 덩어리(3×3 · 여름 3×2 · 둘레 1칸까지 비어야 ·
//  잔디 무리 바닥 · 집 · 밭 · 첫 마당 본보기 자리 아님 · 가로는 .8배로 잰다). 없으면 그 해 행사는 안 나타난다(아이 마당을 밀어내지 않는다).
//  한 벌 = [그림 id, 덩어리 안 행, 열, 폭, 높이, 주소 뒤](디자인 시안 훅 그대로)
const DECO_EVENTS = [
  { key: 'spring', name: '🌸 벚꽃 축제', from: '04-01', until: '04-07', w: 3, h: 3, set: [['ev_lanterns', 0, 0, 3, 1, ''], ['ev_spring_mat', 2, 0, 2, 1, '']] },   // 등 줄은 주소 뒤가 없으면 봄 색
  { key: 'summer', name: '💦 물놀이 날', from: '07-08', until: '07-14', w: 3, h: 2,
    set: [['ev_summer_pinwheel', 0, 0, 1, 1, ''], ['ev_summer_pinwheel', 0, 2, 1, 1, ''], ['ev_summer_pool', 1, 0, 2, 1, ''], ['ev_summer_melon', 1, 2, 1, 1, '']] },
  { key: 'autumn', name: '🎃 수확제', from: '10-13', until: '10-19', w: 3, h: 3, set: [['ev_lanterns', 0, 0, 3, 1, 'autumn'], ['ev_autumn_harvest', 2, 0, 2, 1, '']] },
  { key: 'winter', name: '⛄ 눈사람 날', from: '12-15', until: '12-21', w: 3, h: 3,
    set: [['ev_lanterns', 0, 0, 3, 1, 'winter'], ['ev_winter_snowman', 2, 0, 1, 1, ''], ['ev_winter_sled', 2, 2, 1, 1, '']] },
];
let _decoEventOv = null, _decoEventDev = null;   // 시험용(저장 0) · 놀이판 ?event=<key>
function _decoEventNow(d) {
  const byKey = k => DECO_EVENTS.find(e => e.key === k) || null;
  if (_decoEventOv !== null) return byKey(_decoEventOv);
  if (_decoEventDev === null) _decoEventDev = typeof _playParam === 'function' ? _playParam('event') : '';
  if (_decoEventDev) return byKey(_decoEventDev);
  const t = d || new Date(), md = String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  return DECO_EVENTS.find(e => md >= e.from && md <= e.until) || null;
}
//  지금 뜨는 행사(모습이 막으면 없음)
function _decoEventOn() { const ev = _decoEventNow(); return ev && _yardLook().events !== false ? ev : null; }
//  자리 — 판 번호(_decoStateVer · 놓기·치우기·칠하기마다 오른다) · 학생 · 공간 · 판 크기가 같으면 다시 안 구한다
let _decoEventMemo = null;
function _decoEventPlaced(ev) {
  const key = [ev.key, CUR && CUR.id, DECO_SPACE, typeof _decoStateVer !== 'undefined' ? _decoStateVer : 0, DY.rows, DY.cols].join('|');
  if (_decoEventMemo && _decoEventMemo.key === key) return _decoEventMemo.placed;
  const list = _decoList(CUR).filter(p => p.area === 'yard'), fl = _yardFloorGet(CUR), occ = new Set(), hc0 = _houseCol0();
  list.forEach(p => { const z = getDecoSize(p.id); for (let r = p.row; r < p.row + z.h; r++) for (let c = p.col; c < p.col + z.w; c++) occ.add(r + '_' + c); });
  const inFriend = typeof _ffFriend !== 'undefined' && !!_ffFriend && CUR === _ffFriend;   // 친구 구경엔 본보기가 없다
  if (!inFriend && typeof _decoTplActive === 'function' && _decoTplActive())   // 첫 마당 본보기 자리는 비워 둔다
    for (let r = DECO_TPL.path.r0; r <= DECO_TPL.path.r1 + 1; r++) for (let c = hc0 - 1; c <= hc0 + 6; c++) occ.add(r + '_' + c);
  const ok = (r, c) => r >= 0 && c >= 0 && r < DY.rows && c < DY.cols && !occ.has(r + '_' + c) && !_isHC(r, c) && !_isFarmCell(r, c) && _floorIsGrass(_floorParse(fl[r + '_' + c]).name);
  let cr = DH.rows + 4, cc = hc0 + DH.cols / 2;
  if (list.length) { cr = 0; cc = 0; list.forEach(p => { cr += p.row; cc += p.col; }); cr /= list.length; cc /= list.length; }
  let best = null;
  for (let r = 1; r + ev.h < DY.rows; r++) for (let c = 1; c + ev.w < DY.cols; c++) {
    let good = true;
    for (let rr = r - 1; rr <= r + ev.h && good; rr++) for (let c2 = c - 1; c2 <= c + ev.w && good; c2++) if (!ok(rr, c2)) good = false;
    if (!good) continue;
    const d = Math.hypot(r + ev.h / 2 - cr, (c + ev.w / 2 - cc) * .8);
    if (!best || d < best[0]) best = [d, r, c];
  }
  const placed = best ? ev.set.map(([id, r, c, w, h, frag]) => ({ id, r: best[1] + r, c: best[2] + c, w, h, frag })) : null;
  _decoEventMemo = { key, placed };
  return placed;
}
function _decoEventDraw(C) {
  const ev = _decoEventOn();
  if (!ev || !FLOOR_SVG) return;
  const placed = _decoEventPlaced(ev);
  if (!placed) return;
  placed.slice().sort((a, b) => (a.r + a.h) - (b.r + b.h)).forEach(p => {   // 발자리 아랫줄 순서
    const im = _ambImg(p.id, p.frag);
    if (!im) return;
    const W = p.w * C, ratio = im.naturalHeight / im.naturalWidth, H = W * ratio;
    _dCtx.drawImage(_svgBmp('e:' + p.id + '#' + p.frag, im, W * 2, ratio), p.c * C, (p.r + p.h) * C - H, W, H);
  });
}
//  누른 칸이 행사 장식이면 그 행사(그림이 발자리 위로 한 줄 솟는 것까지)
function _decoEventAt(r, c) {
  const ev = _decoEventOn(), placed = ev && _decoEventPlaced(ev);
  return placed && placed.some(p => r >= p.r - 1 && r < p.r + p.h && c >= p.c && c < p.c + p.w) ? ev : null;
}
//  [DECO-EVENT-2] 행사 기간에 마당을 처음 열 때 한 번(기기 · 행사 · 해마다 — localStorage) — 토스트 한 줄 + 그 한 벌에 반짝 한 번(보스).
//  행사 한 벌이 칸 27px 에서 작아 '왔다'는 것을 모르고 지나칠 수 있었다. 저장 0 · 카메라는 옮기지 않는다(아이가 보던 자리 그대로).
//  저장소를 못 쓰는 기기(사생활 창 등)는 열 때마다 한 번씩 뜰 수 있다 — 벌 없는 알림이라 괜찮다.
function _decoEventGreet() {
  if (!_ifMode || DECO_SCENE !== 'yard' || !_dCv || (typeof _ffFriend !== 'undefined' && _ffFriend)) return false;
  const ev = _decoEventOn(), placed = ev && _decoEventPlaced(ev);
  if (!placed) return false;
  const key = 'deco.eventSeen.' + ev.key + '.' + new Date().getFullYear();
  try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); } catch (e) {}
  const u = ev.until.split('-').map(Number);
  toast(`${ev.name}${_josa(ev.name, '이', '가')} 마당에 놀러 왔어요 — ${u[0]}/${u[1]}까지`);
  //  반짝 — 판 위(한 벌 네모 가운데) · 2.4초 뒤 사라짐
  const host = _dCv.parentNode, C = _dC;
  if (host) {
    const r0 = Math.min(...placed.map(p => p.r)), c0 = Math.min(...placed.map(p => p.c)), r1 = Math.max(...placed.map(p => p.r + p.h)), c1 = Math.max(...placed.map(p => p.c + p.w));
    const tw = document.createElement('img'), sz = Math.max(40, Math.round((c1 - c0) * C * .8));
    tw.className = 'deco-event-tw'; tw.src = _lifeArt('fx_twinkle'); tw.alt = '';
    tw.style.width = tw.style.height = sz + 'px';
    tw.style.left = Math.round((c0 + c1) / 2 * C - _dPanX - sz / 2 + (_dCv.offsetLeft || 0)) + 'px';
    tw.style.top = Math.round((r0 + r1) / 2 * C - _dPanY - sz / 2 - C * .6 + (_dCv.offsetTop || 0)) + 'px';
    host.appendChild(tw); setTimeout(() => { if (tw.parentNode) tw.parentNode.removeChild(tw); }, 2400);
  }
  return true;
}
function _decoEventSay(ev) {
  const u = ev.until.split('-').map(Number);
  toast(`${ev.name}${_josa(ev.name, '이에요', '예요')}! (${u[0]}/${u[1]}까지) — 며칠만 놀러 온 장식이라 옮기거나 치울 수 없어요`);
}
function _decoNightDraw(C) {
  const ph = _yardPhase();   // [DECO-LOOK-0]
  if (ph === 'day') return;
  _decoMotionLoad();
  const ctx = _dCtx, amb = _DECO_MOTION && _DECO_MOTION._ambient, night = ph === 'night', lk = _yardLook();
  ctx.save();
  //  [DECO-NIGHT-FILM-1] 밤 막 .30(전 .48) · [DECO-STAR-P5] 세기는 표에서 — 고르는 동안(카드를 들었거나 바닥 모드 · 사진 아님)은 절반(밤 .15 · 저녁 .10)
  //  섬이 있는 모습은 판 · 위 띠 · 섬에만(판 밖 별하늘은 그대로)
  const edit = !_decoPhotoMode && (!!SEL_DECO || DECO_MODE === 'floor');
  ctx.fillStyle = night ? (edit ? lk.nightFilmEdit : lk.nightFilm) : (edit ? 'rgba(255,150,80,.1)' : 'rgba(255,150,80,.2)');
  if (lk.island) ctx.fillRect(0, -DECO_YARD_TOP * C, DY.cols * C, (DY.rows + DECO_YARD_TOP + _yardIslandCells()) * C);
  else ctx.fillRect(_dPanX - C, _dPanY - C, _dW + C * 2, _dH + C * 2);   // 보이는 판 전체(위 잔디 띠까지)
  if (amb) {
    //  몸통 viewBox 안 자리 → 판 px (그림 폭 = 발자리 폭 · 아래 끝 = 발자리 아래)
    const box = p => { const img = _decoImg(p.id), z = getDecoSize(p.id); if (!img) return null;
      const w = z.w * C, u = w / img.naturalWidth, h = img.naturalHeight * u; return { x: p.col * C, y: (p.row + z.h) * C - h, u, w, h }; };
    const list = _decoList(CUR).filter(p => p.area === 'yard');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = night ? .9 : .65;
    list.forEach(p => {
      const pl = amb.pool && amb.pool.on && amb.pool.on[p.id], b = pl && box(p), im = pl && _ambImg('light_pool', 'warm');
      if (b && im) { const w = pl[2] * b.u * (night ? 1 : .8), h = w * .5; ctx.drawImage(im, b.x + pl[0] * b.u - w / 2, b.y + pl[1] * b.u - h / 2, w, h); }
    });
    list.forEach(p => {
      const g = amb.glow && amb.glow.on && amb.glow.on[p.id], b = g && box(p), im = g && _ambImg('glow', g[2]);
      if (b && im) { const d = g[3] * b.u * 1.8 * (night ? 1 : .8); ctx.drawImage(im, b.x + g[0] * b.u - d / 2, b.y + g[1] * b.u - d / 2, d, d); }
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    //  창 불빛 — 색 막 위에 보통 합성(창이 밝게 남도록)
    list.forEach(p => {
      const f = amb.windows && amb.windows.on && amb.windows.on[p.id], b = f && box(p), im = f && _ambImg(f.replace(/\.svg$/, ''));
      if (b && im) ctx.drawImage(im, b.x, b.y, b.w, b.h);
    });
    const hn = amb.windows && amb.windows.on && amb.windows.on.yard_house && _ambImg('yard_house_night'), hi = _decoImg('yard_house');
    if (hn && hi && FLOOR_SVG) { const hw = DH.cols * C; ctx.drawImage(hn, _houseCol0() * C, -C, hw, hw * hi.naturalHeight / hi.naturalWidth); }
  }
  ctx.restore();
  if (night && lk.labelOverFilm && FLOOR_SVG && _decoImg('yard_house')) _yardHouseLabel(_houseCol0() * C, DH.cols * C, C);   // [DECO-STAR-P5] 이름표는 막 위에
}

// [DECO-SEASON-1] 겨울 눈 겹 — motion.json _ambient.snow.on 의 그림(몸통과 같은 viewBox 투명 겹)을 몸통 위 같은 자리에(밤이면 그 뒤에 색 막 · 창 불빛)
function _decoSnowOver(id, px, py, bw, bh) {
  const snow = _yardLook().snow;   // [DECO-LOOK-0]
  if (snow) _decoMotionLoad();
  if (!snow || !_DECO_MOTION || !_DECO_MOTION._ambient || !_DECO_MOTION._ambient.snow) return;
  const f = _DECO_MOTION._ambient.snow.on && _DECO_MOTION._ambient.snow.on[id], im = f && _ambImg(f.replace(/\.svg$/, '')), body = _decoImg(id);
  if (!im || !body) return;
  const h = bw * body.naturalHeight / body.naturalWidth;
  _dCtx.drawImage(im, px, py + bh - h, bw, h);
}
// [DECO-WIND-1] 바람 한 줄기 — 11초마다 보이는 마당을 왼쪽→오른쪽으로 2.8초에 지나며 풀·꽃·나무를 한 번씩 흔들고 멈춘다(늘 흔들리면 멀미).
//  보스 결정(09-24): 캔버스로 — DOM 층은 앞뒤 순서가 캔버스와 안 맞아 뒷줄 꽃이 앞줄 나무 위에 떴다(어설픔 ⓓ). 바람이 지나는 동안만 판을 다시 그린다.
//  세기(docs/deco_living_yard_20260920.md §1·§2 '보통'): 풀·꽃 3° × 배수(2.6초 · 두 번 흔들고 잦아듦) · 나무 0.7° × 배수(3.4초 · 느리게) · 한 줄기 24개까지(가로 위치로 고르게 솎음).
//  꺼지는 때: 움직임 줄이기 · 집 안 · 판이 안 보일 때 · 사진 찍을 때.
const DECO_SWAY = { d_y7: 1, d_y45: 1.2, d_y29: 1.2, d_y8: .8, d_y2: .8, d_y44: .8, d_y41: .8, d_y42: .8, d_y1: .6, d_y43: .6, d_y16: .6, d_y25: .7, d_y35: .7, d_y36: .7, d_y15: .35 };
const DECO_TILT = { d_y9: 1.1, d_y47: 1, d_y46: .7, d_y12: 1, d_y19: 1, d_y48: 1, d_y64: 1 };
const DECO_WIND = { every: 11000, pass: 2800, sway: 2600, tilt: 3400, amp: 3, treeAmp: .7, max: 24 };
const _decoWind = { t0: 0, set: new Map(), timer: 0, raf: 0 };
function _decoWindOn() { return _ifMode && DECO_SCENE === 'yard' && !_animReduced() && !(typeof document !== 'undefined' && document.hidden) && !!_dCv; }
function _decoWindStart() {
  if (_decoWind.timer) return;
  _decoWind.timer = setTimeout(function tick() {
    _decoWind.timer = 0;
    if (!_ifMode) return;   // 닫혔으면 끝(다시 열면 openInteriorFullscreen 이 다시 건다)
    if (_decoWindOn()) _decoWindGust();
    _decoWind.timer = setTimeout(tick, DECO_WIND.every);
  }, 2500 + Math.random() * 3000);
}
function _decoWindGust() {
  const C = _dC, v0 = _dPanX, vw = _dW, list = [];
  _decoList(CUR).forEach(p => {
    if (p.area !== 'yard' || !(DECO_SWAY[p.id] || DECO_TILT[p.id])) return;
    const z = getDecoSize(p.id), x = (p.col + z.w / 2) * C;
    if (x < v0 - C || x > v0 + vw + C || (p.row + z.h) * C < _dPanY || p.row * C > _dPanY + _dH + C * 2) return;
    list.push({ key: p.id + '@' + p.row + '_' + p.col, x, tree: !DECO_SWAY[p.id], mult: DECO_SWAY[p.id] || DECO_TILT[p.id] });
  });
  if (!list.length) return;
  list.sort((a, b) => a.x - b.x);
  const pick = list.length <= DECO_WIND.max ? list : Array.from({ length: DECO_WIND.max }, (_, i) => list[Math.floor(i * list.length / DECO_WIND.max)]);
  _decoWind.set = new Map(pick.map(o => [o.key, Object.assign(o, { delay: Math.max(0, Math.min(1, (o.x - v0) / vw)) * DECO_WIND.pass })]));
  _decoWind.t0 = performance.now();
  if (!_decoWind.raf) _decoWind.raf = requestAnimationFrame(function fr() {
    _decoWind.raf = 0;
    if (performance.now() - _decoWind.t0 > DECO_WIND.pass + DECO_WIND.tilt + 50) { _decoWind.set = new Map(); _drawDeco(); return; }
    _drawDeco(); _decoWind.raf = requestAnimationFrame(fr);
  });
}
//  지금 이 장식의 기울기(라디안) — 바람이 안 지나면 0
function _decoWindAngle(p) {
  if (!_decoWind.set.size || _decoPhotoMode) return 0;
  const o = _decoWind.set.get(p.id + '@' + p.row + '_' + p.col);
  if (!o) return 0;
  const t = performance.now() - _decoWind.t0 - o.delay, dur = o.tree ? DECO_WIND.tilt : DECO_WIND.sway;
  if (t <= 0 || t >= dur) return 0;
  const k = t / dur, deg = (o.tree ? DECO_WIND.treeAmp : DECO_WIND.amp) * o.mult;
  const wave = o.tree ? Math.sin(Math.PI * k) : Math.sin(2 * Math.PI * k * 2) * (1 - k) + .35 * Math.sin(Math.PI * k);   // 풀은 두 번 흔들며 잦아들고 · 나무는 한 번 느리게
  return deg * wave * Math.PI / 180;
}

// [DECO-FIRST-YARD-1] 새 아이 첫 마당 본보기(디자인 ⑭ · 보스 결정 (A) 보여주기만 — 저장 0)
//  마당에 장식을 한 번도 안 놓았고 바닥도 안 칠한 아이에게, 집 문 앞 돌길 2칸 폭(3~6줄) + 튤립 · 데이지를 반투명으로 보여 준다.
//  '여기서 시작해 봐요' 말풍선은 돌길 왼쪽 아래(오른쪽은 확대 기둥과 겹친다). 첫 장식을 놓으면 0.4초에 사라진다.
//  판 캔버스 위 투명 캔버스 한 장 — 숨쉬기(.45↔.6 · 2초)는 CSS 불투명도라 판을 매 틀 다시 그리지 않는다 · 움직임 줄이기면 .55 고정.
//  누르기는 그대로 판으로 간다(pointer-events:none) · 칸을 차지하지 않는다.
const DECO_TPL = { path: { c: [2, 3], r0: 3, r1: 6 }, items: [['d_y2', 3, 0], ['d_y42', 3, 5]] };   // 열은 집 첫 칸(_houseCol0) 기준
let _decoTplCv = null, _decoTplOn = false;
function _decoTplActive() {
  if (!_ifMode || DECO_SCENE !== 'yard' || !_dCv) return false;
  if ((CUR.houseDecorations || []).some(p => p.area === 'yard')) return false;   // 어느 공간에든 마당 장식을 놓아 본 아이는 아님
  if (Object.keys(CUR.yardFloor || {}).length) return false;
  const fs = CUR.yardFloors || {};
  return !Object.keys(fs).some(k => fs[k] && Object.keys(fs[k]).length);
}
function _decoTplSync() {
  const on = _decoTplActive(), host = _dCv && _dCv.parentNode;
  if (!on) {
    if (_decoTplOn && _decoTplCv) {   // 방금 꺼짐 — 0.4초에 사라진다
      const cv = _decoTplCv; cv.classList.add('is-gone');
      setTimeout(() => { if (cv.classList.contains('is-gone')) cv.style.display = 'none'; }, 420);
    } else if (_decoTplCv) _decoTplCv.style.display = 'none';
    _decoTplOn = false; return;
  }
  if (!_decoTplCv || _decoTplCv.parentNode !== host) {
    _decoTplCv = document.createElement('canvas'); _decoTplCv.className = 'deco-tpl'; _decoTplCv.setAttribute('aria-hidden', 'true');
    host.appendChild(_decoTplCv);
  }
  const cv = _decoTplCv, W = _dW, H = _dH, C = _dC;
  cv.classList.remove('is-gone'); cv.classList.toggle('is-still', _animReduced()); cv.style.display = 'block';
  cv.style.left = _dCv.offsetLeft + 'px'; cv.style.top = _dCv.offsetTop + 'px';
  if (cv.width !== W * 2) cv.width = W * 2;
  if (cv.height !== H * 2) cv.height = H * 2;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'), keep = _dCtx;
  ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.setTransform(2, 0, 0, 2, -Math.round(_dPanX * 2), -Math.round(_dPanY * 2));   // [DECO-LAWN-SEAM-1] 판과 같은 반올림
  const c0 = _houseCol0(), P = DECO_TPL.path, pc = P.c.map(k => c0 + k);
  const isPath = (r, c) => r >= P.r0 && r <= P.r1 && pc.indexOf(c) >= 0;
  _dCtx = ctx;   // 바닥·장식 그리기 도우미는 _dCtx 에 그린다 — 잠깐 이 캔버스로
  try {
    for (let r = P.r0; r <= P.r1; r++) for (const c of pc) {
      if (!(FLOOR_SVG && _drawFloorSVG('stone', r, c, c * C, r * C, C, (rr, cc) => isPath(rr, cc) ? 'stone' : 'grass'))) {
        ctx.fillStyle = FLOOR_TILES.stone ? FLOOR_TILES.stone.bg : '#9a9a9a'; ctx.fillRect(c * C, r * C, C, C);
      }
    }
    DECO_TPL.items.forEach(([id, r, k]) => { const z = getDecoSize(id); _drawDecoSVG(id, (c0 + k) * C, r * C, z.w * C, z.h * C); });
  } finally { _dCtx = keep; }
  //  말풍선 — 돌길 왼쪽 아래
  const msg = '여기서 시작해 봐요', fs = Math.max(11, Math.min(16, C * .55));
  ctx.font = `700 ${fs}px sans-serif`;
  const tw = ctx.measureText(msg).width, bw = tw + fs * 1.4, bh = fs * 1.9;
  let bx = pc[0] * C - bw - C * .3, by = (P.r1 + 1) * C - bh * .4, below = false;
  //  왼쪽에 자리가 없으면(폰 · 집이 화면 왼쪽) 돌길 바로 아래로 — 말풍선이 화면 밖으로 잘리지 않게
  if (bx < _dPanX + 8) { below = true; bx = Math.max(_dPanX + 8, pc[0] * C + C - bw / 2); by = (P.r1 + 1) * C + C * .45; }
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = 'rgba(43,33,24,.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill(); ctx.stroke();
  const tx = pc[0] * C + C;   // 꼬리는 돌길 쪽으로
  ctx.beginPath();
  if (below) { ctx.moveTo(tx - bh * .25, by + 1); ctx.lineTo(tx, by - C * .4); ctx.lineTo(tx + bh * .25, by + 1); }
  else { ctx.moveTo(bx + bw - bh * .3, by + bh * .2); ctx.lineTo(bx + bw + C * .3, by - C * .15); ctx.lineTo(bx + bw - bh * .1, by + bh * .55); }
  ctx.fill();
  ctx.fillStyle = '#2b2118'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, bx + bw / 2, by + bh / 2 + 1);
  _decoTplOn = true;
}

// [DECO-HOUSE-ART-1] 마당 '내 집' 한 장 — viewBox 600×400 · 한 칸 = 100 · 발밑 y100~400(= 집 자리 3줄) · 굴뚝 끝만 한 칸 위로.
//  이름은 오른쪽 앞 푯말(글 가운데 x517·y343 · 폭 x446~588)에, '들어가기'는 문 앞 작은 표로.
//  [DECO-EXIT-DOOR-1] 집 안 나가기 문 그림(디자인 #858 in_exit_door.svg · 200×140 = 2칸 폭) — y100 이 방 아래 벽선.
//  위 100 = 방 바닥(발판 · 들어오는 빛) · 아래 40 = 벽 밖(환한 바깥 + 화살표). 글 '나가기'는 화살표 오른쪽(x122 · y126).
function _drawExitDoorArt(img, cx, wallY, C) {
  const ctx = _dCtx, x0 = cx - C, y0 = wallY - C, u = C / 100;
  ctx.drawImage(_svgBmp('d:in_exit_door', img, 2 * C * 2, .7), x0, y0, 2 * C, 1.4 * C);
  ctx.save();
  const fs = Math.max(8, 15 * u); ctx.font = `700 ${fs}px sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, fs * .22); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineJoin = 'round';
  ctx.strokeText('나가기', x0 + 122 * u, y0 + 126 * u);
  ctx.fillStyle = '#2b2118'; ctx.fillText('나가기', x0 + 122 * u, y0 + 126 * u);
  ctx.restore();
}
// [DECO-GROUND-1] 풀빛 얼룩 — 잔디 칸 위에 짙은 판(13칸 주기)·밝은 판(9칸 주기)을 무늬(pattern)로 한 번에 깐다.
//  두 주기가 겹쳐 117칸마다만 되풀이된다 · 한 가지 초록에 모눈이 늘 보여 '모눈종이에 붙인 스티커' 같던 것(창조자 31회 ⓑ71 · docs/deco_ground_20260923.md).
//  칸 조각에 넣어 굽지 않는다 — 칸마다 모양이 달라 확대 한 걸음마다 다시 구웠다(핀치 9 → 80ms). 잔디 칸에는 가장자리 조각이 없어 위에 깔아도 같다.
//  무늬 판은 칸 크기를 4분의 1 옥타브 계단(_bmpStep)으로 구워 몇 장만 기억한다 — 두 손가락 확대 걸음마다 새로 굽지 않게(무늬 크기는 변환으로 맞춘다)
const _GP = new Map();   // 'w' → { dark, light } (캔버스 판 · 무늬는 그리는 컨텍스트마다)
function _groundPatterns(C, kind) {
  const snow = kind === 'snow', dk = _floorImg(snow ? 'snow_patch_shade' : 'grass_patch_dark'), lt = _floorImg(snow ? 'snow_patch_bright' : 'grass_patch_light');
  if (!dk || !lt || typeof document === 'undefined' || !_dCtx.createPattern) return null;
  const sc = (_dCtx.getTransform && _dCtx.getTransform().a) || 1, w = _bmpStep(Math.max(2, C * sc));
  let e = _GP.get(w + (snow ? 's' : ''));
  if (!e) {
    if (_GP.size > 8) _GP.clear();
    const mk = (img, n) => { const cv = document.createElement('canvas'); cv.width = cv.height = n * w; cv.getContext('2d').drawImage(img, 0, 0, n * w, n * w); return cv; };
    e = { dark: mk(dk, 13), light: mk(lt, 9), pats: new WeakMap() };
    _GP.set(w + (snow ? 's' : ''), e);
  }
  let pp = e.pats.get(_dCtx);
  if (!pp) { pp = { dark: _dCtx.createPattern(e.dark, 'repeat'), light: _dCtx.createPattern(e.light, 'repeat') }; e.pats.set(_dCtx, pp); }
  if (typeof DOMMatrix === 'function') { const m = new DOMMatrix().scale(C / w, C / w); pp.dark.setTransform(m); pp.light.setTransform(m); }
  return pp;
}
//  [DECO-SEASON-1] 잔디 무리 칸 위 — 여름: 얼룩 · 봄/가을: 얼룩 → 계절 막 → 흩뿌림(꽃잎/낙엽 · 나무 둘레는 더 많이) · 겨울: 눈 바탕 + 눈 두 겹(얼룩 대신)
//  [DECO-LOOK-0] 막 · 흩뿌림 · 바탕 · 무늬는 표(YARD_LOOKS)에서
function _decoGroundPatch(r0, c0, r1, c1, isGrass) {
  if (!FLOOR_SVG) return;
  const C = _dC, lk = _yardLook();
  const runs = [];   // [r, c0, c1)
  for (let r = r0; r < r1; r++) {
    let run = -1;
    for (let c = c0; c <= c1; c++) {
      const g = c < c1 && isGrass(r, c);
      if (g && run < 0) run = c;
      else if (!g && run >= 0) { runs.push([r, run, c]); run = -1; }
    }
  }
  if (!runs.length) return;
  const fill = st => { _dCtx.fillStyle = st; runs.forEach(([r, a, b]) => _dCtx.fillRect(a * C, r * C, (b - a) * C, C)); };
  if (lk.ground === 'star' && _starGroundFill(runs, C)) return;   // [DECO-STAR-P3] 별빛 땅(막 · 흩뿌림 없음)
  if (lk.groundBg) fill(lk.groundBg);
  const gp = _groundPatterns(C, lk.ground);
  if (gp && gp.dark && gp.light) { fill(gp.dark); fill(gp.light); }
  if (!lk.film) return;
  fill(lk.film);
  //  흩뿌림 — 나무 둘레에만 무리(디자인 #1083 · 보스: '풍성함 ≠ 점의 개수' — 마당 전체에 흩으면 색종이·먼지처럼 보였다).
  //  나무 발자리 가운데에서 멀어질수록 옅게: 타원(가로 발자리 반 + 3칸 · 세로 반 + 2칸) 안 p = hi × (1 − .75d)
  //  · 바로 밖(d < 1.3) = 바람에 날린 몇 장 drift · 그 밖 0(쉼 자리). 여러 나무가 겹치면 큰 쪽. 나무가 없으면 흩뿌림도 없다(값은 표에).
  const sc = lk.scatter;
  if (!sc) return;
  const evx = typeof _decoEventOn === 'function' && _decoEventOn();   // [DECO-EVENT-1] 벚꽃 축제 동안은 꽃잎 두 배(디자인 행사 표)
  const trees = sc.trees, dens = new Map(), k1 = sc.k1, k2 = sc.k2, hi = Math.min(.95, sc.hi * (evx && evx.key === 'spring' && sc.name === 'season_petals_' ? 2 : 1));
  _decoList(CUR).forEach(p => { if (p.area !== 'yard' || trees.indexOf(p.id) < 0) return; const z = getDecoSize(p.id);
    const cx = p.col + z.w / 2, cy = p.row + z.h / 2, rx = z.w / 2 + 3, ry = z.h / 2 + 2;
    for (let r = Math.floor(cy - ry * 1.3); r <= Math.ceil(cy + ry * 1.3); r++) for (let c = Math.floor(cx - rx * 1.3); c <= Math.ceil(cx + rx * 1.3); c++) {
      const d = Math.hypot((c + .5 - cx) / rx, (r + .5 - cy) / ry), pr = d < 1 ? hi * (1 - .75 * d) : d < 1.3 ? sc.drift : 0, k = r + '_' + c;
      if (pr > (dens.get(k) || 0)) dens.set(k, pr);
    } });
  if (!dens.size) return;
  const nm = sc.name, ia = _floorImg(nm + 'a'), ib = _floorImg(nm + 'b');
  if (!ia || !ib) return;
  runs.forEach(([r, a, b]) => { for (let c = a; c < b; c++) {
    if (_seaHash(r, c, k1) >= (dens.get(r + '_' + c) || 0)) continue;
    const ab = _seaHash(r, c, k2) < .5; _dCtx.drawImage(_floorBmp(nm + (ab ? 'a' : 'b'), ab ? ia : ib, C), c * C, r * C, C, C);
  } });
}
// [DECO-STAR-P5] 떠 있는 섬 — 판 아래끝 바로 밑에 island_rim(칸마다 · 칸 폭 × .4칸 · 좌우 끝이 같아 이어진다) + 그 밑에 island_under(판 폭 한 장 · 1600×120 = 80칸 × 6칸)
function _yardIslandCells() { return _yardLook().island ? .4 + DY.cols * 120 / 1600 : 0; }
function _drawYardIsland(C, v) {
  if (!_yardLook().island || !FLOOR_SVG) return;
  const y = DY.rows * C;
  if (y > _dPanY + _dH + C) return;   // 화면 아래 밖
  const ri = _floorImg('island_rim'), ui = _floorImg('island_under');
  if (ri) { const b = _svgBmp('f:island_rim', ri, C * 2, .4); for (let c = v.c0; c < v.c1; c++) _dCtx.drawImage(b, c * C, y, C, .4 * C); }
  if (ui) { const w = DY.cols * C, h = w * 120 / 1600; _dCtx.drawImage(_svgBmp('f:island_under', ui, Math.min(w * 2, 4096), 120 / 1600), 0, y + .4 * C, w, h); }
}
// [DECO-STAR-P3] 별빛 땅 — 잔디 무리 칸 = star_ground(불투명 · 9칸 주기 무늬) → star_band(판 80×44 한 장에서 그 칸 자리를 떼어 붙임 · 되풀이 금지 · 줄무늬가 된다).
//  잔디 얼룩은 건너뛴다. 띠는 8×8칸 조각으로 구워 둔다 — 판 한 장을 화면 해상도로 구우면 칸 27px 에서도 40MB 가 넘는다(확대하면 더).
//  칸당 기기 px 는 64 까지(띠는 부드러운 그림이라 확대 3배에서 조금 흐려지는 것은 받아들인다) · 구운 조각 픽셀 합 6M 을 넘으면 비운다.
const _STAR_BAND = new Map();
let _starBandPx = 0;
function _starBandChunk(img, cr, cc, k, u, N) {
  const key = k + '|' + cr + '|' + cc;
  let b = _STAR_BAND.get(key);
  if (!b) {
    if (_starBandPx > 6e6) { _STAR_BAND.clear(); _starBandPx = 0; }
    b = document.createElement('canvas'); b.width = b.height = N * k;
    b.getContext('2d').drawImage(img, cc * N * u, cr * N * u, N * u, N * u, 0, 0, N * k, N * k);
    _STAR_BAND.set(key, b); _starBandPx += N * k * N * k;
  }
  return b;
}
function _starGroundFill(runs, C) {
  const gi = _floorImg('star_ground'), bi = _floorImg('star_band');
  if (!gi || typeof document === 'undefined' || !_dCtx.createPattern) return false;
  const sc = (_dCtx.getTransform && _dCtx.getTransform().a) || 1, w = _bmpStep(Math.max(2, C * sc));
  let e = _GP.get(w + 'g');
  if (!e) {
    if (_GP.size > 8) _GP.clear();
    const cv = document.createElement('canvas'); cv.width = cv.height = 9 * w; cv.getContext('2d').drawImage(gi, 0, 0, 9 * w, 9 * w);
    e = { g: cv, pats: new WeakMap() }; _GP.set(w + 'g', e);
  }
  let pt = e.pats.get(_dCtx);
  if (!pt) { pt = _dCtx.createPattern(e.g, 'repeat'); e.pats.set(_dCtx, pt); }
  if (typeof DOMMatrix === 'function') pt.setTransform(new DOMMatrix().scale(C / w, C / w));
  _dCtx.fillStyle = pt; runs.forEach(([r, a, b]) => _dCtx.fillRect(a * C, r * C, (b - a) * C, C));
  if (!bi) return true;
  const N = 8, u = bi.naturalWidth / 80, colsB = 80, rowsB = Math.round(bi.naturalHeight / u), k = Math.min(64, w);
  runs.forEach(([r, a, b]) => {
    if (r < 0 || r >= rowsB) return;   // 판 위 띠(음수 줄)에는 띠가 없다
    const cr = Math.floor(r / N);
    for (let c = Math.max(0, a); c < Math.min(b, colsB); ) {
      const cc = Math.floor(c / N), ce = Math.min(b, (cc + 1) * N, colsB);
      _dCtx.drawImage(_starBandChunk(bi, cr, cc, k, u, N), (c - cc * N) * k, (r - cr * N) * k, (ce - c) * k, k, c * C, r * C, (ce - c) * C, C);
      c = ce;
    }
  });
  return true;
}
// [DECO-GROUND-1] 밑동 접지 — 물건이 잔디에 '떠 있지' 않고 붙어 보이게. 동물(층에서 그림)·울타리(그림에 풀이 들어 있음)는 뺀다.
//  발자리 가운데 칸이 잔디일 때만 그림자 · 맨 아래 줄은 칸마다 그 칸이 잔디면 풀 덮임(ground_tuft_a|b 번갈아). 돌길·벽돌·물 위는 없음.
const _GROUND_SKIP = ['d_y49', 'd_y50', 'd_y51', 'd_y52', 'd_y70', 'd_y71', 'd_y72'];
function _decoGroundOn(p, d) {
  if (!FLOOR_SVG || ANIM_DECO[p.id] || _GROUND_SKIP.indexOf(p.id) >= 0 || (d && d.autoFence)) return false;
  const z = getDecoSize(p.id), fl = _yardFloorGet(CUR);
  return _floorIsGrass(_floorParse(fl[(p.row + z.h - 1) + '_' + (p.col + Math.floor((z.w - 1) / 2))]).name);
}
function _decoGroundShadow(px, py, bw, bh, C) {
  const ctx = _dCtx;
  ctx.fillStyle = _yardLook().shadow;   // [DECO-LOOK-0]
  ctx.beginPath(); ctx.ellipse(px + bw / 2, py + bh - .06 * C, bw * .46, .16 * C, 0, 0, Math.PI * 2); ctx.fill();
}
function _decoGroundTufts(p, px, py, bw, bh, C, sz) {
  const sc = _yardLook().groundFrag;   // [DECO-SEASON-1] 밑동 풀도 계절색 · [DECO-LOOK-0] 표에서
  const fl = _yardFloorGet(CUR), a = _floorImg('ground_tuft_a', sc), b = _floorImg('ground_tuft_b', sc);
  if (!a || !b) return;
  for (let k = 0; k < sz.w; k++) {
    if (!_floorIsGrass(_floorParse(fl[(p.row + sz.h - 1) + '_' + (p.col + k)]).name)) continue;
    const img = (p.col + k) % 2 ? b : a;
    _dCtx.drawImage(_svgBmp('t:' + ((p.col + k) % 2 ? 'b' : 'a') + sc, img, C * 2, .4), px + k * C, py + bh - .3 * C, C, .4 * C);
  }
}
function _drawYardHouseArt(img, hx, hw, C) {
  const ctx = _dCtx, y0 = -C, h = hw * (img.naturalHeight / img.naturalWidth);
  //  집 칸은 바닥 그리기가 건너뛴다(옛 그리기는 네모로 덮었다) → 그림 둘레가 비지 않게 잔디를 먼저 깐다
  const c0 = _houseCol0(), hg = _yardLook().houseGround, grass = () => hg;   // [DECO-LOOK-0] 집 밑 땅은 표에서
  for (let r = 0; r < DH.rows; r++) for (let c = c0; c < c0 + DH.cols; c++) {
    if (!(FLOOR_SVG && _drawFloorSVG(hg, r, c, c * C, r * C, C, grass))) { ctx.fillStyle = (r + c) % 2 ? FLOOR_TILES[hg].alt : FLOOR_TILES[hg].bg; ctx.fillRect(c * C, r * C, C, C); }
  }
  _decoGroundPatch(0, c0, DH.rows, c0 + DH.cols, () => true);   // [DECO-GROUND-1] 집 둘레 잔디에도 얼룩
  ctx.drawImage(_svgBmp('d:yard_house', img, hw * 2, img.naturalHeight / img.naturalWidth), hx, y0, hw, h);
  if (_yardLook().snow) { const sn = _ambImg('yard_house_snow'); if (sn) ctx.drawImage(sn, hx, y0, hw, h); }   // [DECO-SEASON-1] 지붕 눈 · [DECO-LOOK-0]
  _yardHouseLabel(hx, hw, C);
}
//  집 이름표 · 문 앞 '들어가기' — [DECO-STAR-P5] 별밤이면 막 위에 한 번 더(_decoNightDraw)
function _yardHouseLabel(hx, hw, C) {
  const ctx = _dCtx, y0 = -C, u = hw / 600;   // 그림 한 단위 = 캔버스 px
  const name = CUR && CUR.name ? CUR.name : '내 집';
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3b2a18';
  let fs = Math.max(7, 26 * u); ctx.font = `700 ${fs}px sans-serif`;
  const maxW = 130 * u, tw = ctx.measureText(name).width;
  if (tw > maxW) { fs = Math.max(6, fs * maxW / tw); ctx.font = `700 ${fs}px sans-serif`; }
  ctx.fillText(name, hx + 517 * u, y0 + 343 * u);
  //  문 앞 작은 표
  const tf = Math.max(7, 20 * u); ctx.font = `700 ${tf}px sans-serif`;
  const tag = '들어가기', tw2 = ctx.measureText(tag).width + tf;
  ctx.fillStyle = 'rgba(20,24,32,.72)'; _drr(hx + 300 * u - tw2 / 2, y0 + 360 * u, tw2, tf * 1.5, tf * .5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(tag, hx + 300 * u, y0 + 360 * u + tf * .78);
  ctx.restore();
}
function _drawYard() {
  const C = _dC, W = _dW, H = _dH;
  const hx = _houseCol0() * C, hh = DH.rows * C, hw = DH.cols * C;

  // 셀별 바닥 타일
  // [FLOOR-SVG-1] 이웃 타입 조회 — 격자 밖·집 영역은 null(경계 없음)
  const _yardTypeAt = (rr, cc, wantRim) => (rr < 0 || cc < 0 || rr >= DY.rows || cc >= DY.cols || _isHC(rr, cc))
    ? null : _floorParse(_yardFloorGet(CUR)[rr+'_'+cc])[wantRim ? 'rim' : 'name'];   // [DECO-SPACE-1] · [DECO-FLOOR-PARSE-1] 이웃 판정은 이름으로
  const _vis = _decoVisible(DY.rows, DY.cols);   // [DECO-ZOOM-1] 보이는 칸만
  const _floorCells = (v) => {
    const fl = _yardFloorGet(CUR);
    for(let r=v.r0;r<v.r1;r++) for(let c=v.c0;c<v.c1;c++){
      if(_isHC(r,c)) continue;
      const tkey = r+'_'+c;
      const fp = _floorParse(fl[tkey]), ttype = fp.name;   // [DECO-FLOOR-PARSE-1] 옛 값은 이름 그대로
      const tile = FLOOR_TILES[ttype]||FLOOR_TILES.grass;
      if (FLOOR_SVG && _drawFloorSVG(ttype, r, c, c*C, r*C, C, _yardTypeAt, fp.color, fp.rim)) continue;   // [FLOOR-SVG-1] SVG 있으면 그걸로 끝
      _dCtx.fillStyle = (r+c)%2===0 ? tile.bg : tile.alt;
      _dCtx.fillRect(c*C, r*C, C, C);
      _drawTileTexture(ttype, c, r, C);
    }
  };
  _floorCells(_vis);
  _drawYardIsland(C, _vis);   // [DECO-STAR-P5] 섬(섬 없는 모습은 그리지 않는다)
  _decoGroundPatch(_vis.r0, _vis.c0, _vis.r1, _vis.c1, (r, c) => !_isHC(r, c) && _floorIsGrass(_floorParse(_yardFloorGet(CUR)[r + '_' + c]).name));   // [DECO-GROUND-1]
  //  [DECO-TOP-PAD-1] 판 위 잔디 띠(DECO_YARD_TOP 칸) — 맨 윗줄 장식·집 굴뚝의 솟은 그림이 판 위 끝에서 잘리던 것(디자인 D7). 놓을 수는 없다(격자 없음)
  if (_dPanY < 0) {
    const hg = _yardLook().houseGround, grass = () => hg;   // [DECO-LOOK-0] 띠 땅은 표에서
    for (let r = -DECO_YARD_TOP; r < 0; r++) for (let c = _vis.c0; c < _vis.c1; c++) {
      if (FLOOR_SVG && _drawFloorSVG(hg, r + 1000, c, c * C, r * C, C, grass)) continue;   // (변형 고르기는 음수 줄을 못 받는다 — 양수로)
      _dCtx.fillStyle = (r + c) % 2 === 0 ? FLOOR_TILES[hg].bg : FLOOR_TILES[hg].alt; _dCtx.fillRect(c * C, r * C, C, C);
    }
    _decoGroundPatch(-DECO_YARD_TOP, _vis.c0, 0, _vis.c1, () => true);   // [DECO-GROUND-1] 띠에도 얼룩
  }
  // 나무 타일은 가로줄 추가 (무늬) — texture 함수로 통합했으므로 기존 loop 삭제

  // ══════════════════════════════════════════════════════
  // 집 건물 (우상단, DH: 6칸×3칸)
  // ══════════════════════════════════════════════════════
  //  [DECO-HOUSE-ART-1] 그림(assets/deco/yard_house.svg — 디자인 #858)이 오면 그 한 장으로 그린다(판자처럼 보이던 네모+글자 · 디자인 D1).
  //   그림이 아직 안 왔으면 아래 옛 그리기 그대로.
  const _houseArt = FLOOR_SVG && _decoImg('yard_house');
  if (_houseArt) _drawYardHouseArt(_houseArt, hx, hw, C);
  else {
  {
    const lx=hx, ly=0, lw=hw, lh=hh; // left-x, top-y, width, height

    // ── 지붕 (삼각 + 처마) ────────────────────────────────
    // 처마 그림자
    _dCtx.fillStyle='rgba(0,0,0,.22)';
    _dCtx.fillRect(lx, lh - C*2.05, lw, C*.12);
    // 지붕 본체 (짙은 회청 기와 느낌)
    _dCtx.fillStyle='#3a4a58';
    _dCtx.beginPath();
    _dCtx.moveTo(lx-C*.1, lh-C*2.0);
    _dCtx.lineTo(lx+lw/2, ly+C*.05);
    _dCtx.lineTo(lx+lw+C*.1, lh-C*2.0);
    _dCtx.closePath(); _dCtx.fill();
    // 지붕 밝은 면
    _dCtx.fillStyle='#4a5e70';
    _dCtx.beginPath();
    _dCtx.moveTo(lx+lw*.1, lh-C*2.0);
    _dCtx.lineTo(lx+lw/2, ly+C*.1);
    _dCtx.lineTo(lx+lw*.9, lh-C*2.0);
    _dCtx.closePath(); _dCtx.fill();
    // 지붕 능선
    _dCtx.strokeStyle='#2a3848'; _dCtx.lineWidth=C*.08;
    _dCtx.beginPath(); _dCtx.moveTo(lx+lw*.2,lh-C*2.0); _dCtx.lineTo(lx+lw/2,ly+C*.1); _dCtx.stroke();
    _dCtx.beginPath(); _dCtx.moveTo(lx+lw*.8,lh-C*2.0); _dCtx.lineTo(lx+lw/2,ly+C*.1); _dCtx.stroke();
    _dCtx.beginPath(); _dCtx.moveTo(lx+lw*.5,lh-C*2.0); _dCtx.lineTo(lx+lw/2,ly+C*.1); _dCtx.stroke();
    // 처마 (지붕 하단 돌출)
    _dCtx.fillStyle='#2e3c4a';
    _dCtx.fillRect(lx-C*.05, lh-C*2.08, lw+C*.1, C*.14);
    _dCtx.fillStyle='#4a5e70';
    _dCtx.fillRect(lx-C*.05, lh-C*2.08, lw+C*.1, C*.06);
    // 굴뚝
    _dCtx.fillStyle='#5a4830';
    _dCtx.fillRect(lx+lw*.7, ly+C*.18, C*.4, C*.6);
    _dCtx.fillStyle='#7a6848';
    _dCtx.fillRect(lx+lw*.7, ly+C*.18, C*.4, C*.12);
    _dCtx.fillStyle='#3a2818';
    _dCtx.fillRect(lx+lw*.68, ly+C*.12, C*.44, C*.1);
    // 굴뚝 연기 (약하게)
    _dCtx.fillStyle='rgba(200,200,200,.18)';
    _dc(lx+lw*.9, ly+C*.05, C*.12); _dCtx.fill();
    _dc(lx+lw*.88, ly-C*.04, C*.09); _dCtx.fill();
    _dCtx.fillStyle='rgba(200,200,200,.12)';
    _dc(lx+lw*.92, ly-C*.12, C*.07); _dCtx.fill();

    // ── 벽면 ─────────────────────────────────────────────
    // 기본 벽 (따뜻한 베이지/크림)
    _dCtx.fillStyle='#c8a878';
    _dCtx.fillRect(lx, lh-C*2.0, lw, C*2.0);
    // 벽 밝은 톤
    _dCtx.fillStyle='#d4b888';
    _dCtx.fillRect(lx+C*.06, lh-C*1.94, lw-C*.12, C*.9);
    // 허리 띠 (처마 아래 줄 → 분할감)
    _dCtx.fillStyle='#a88050';
    _dCtx.fillRect(lx, lh-C*1.06, lw, C*.06);
    // 하단 기단 (어두운)
    _dCtx.fillStyle='#8a6840';
    _dCtx.fillRect(lx, lh-C*.28, lw, C*.28);
    _dCtx.fillStyle='#a08058';
    _dCtx.fillRect(lx, lh-C*.28, lw, C*.1);
    // 세로 판자선 (벽 분할)
    _dCtx.strokeStyle='rgba(0,0,0,.08)'; _dCtx.lineWidth=C*.04;
    [lw/3, lw*2/3].forEach(ox=>{
      _dCtx.beginPath(); _dCtx.moveTo(lx+ox, lh-C*1.94); _dCtx.lineTo(lx+ox, lh-C*.28); _dCtx.stroke();
    });

    // ── 창문 2개 ─────────────────────────────────────────
    [[lx+C*.3, lh-C*1.82],[lx+lw-C*1.3, lh-C*1.82]].forEach(([wx,wy])=>{
      const ww=C*.88, wh=C*.68;
      // 창틀 외부
      _dCtx.fillStyle='#7a5828'; _drr(wx-C*.05,wy-C*.05,ww+C*.1,wh+C*.1,4); _dCtx.fill();
      // 유리
      _dCtx.fillStyle='#a8d4e8'; _dCtx.globalAlpha=.8;
      _drr(wx,wy,ww,wh,3); _dCtx.fill(); _dCtx.globalAlpha=1;
      // 창틀 십자
      _dCtx.strokeStyle='#7a5828'; _dCtx.lineWidth=C*.06;
      _dCtx.beginPath(); _dCtx.moveTo(wx+ww/2,wy); _dCtx.lineTo(wx+ww/2,wy+wh); _dCtx.stroke();
      _dCtx.beginPath(); _dCtx.moveTo(wx,wy+wh/2); _dCtx.lineTo(wx+ww,wy+wh/2); _dCtx.stroke();
      // 창문 반사 (하이라이트)
      _dCtx.fillStyle='rgba(255,255,255,.28)';
      _drr(wx+C*.04,wy+C*.04,ww*.4,wh*.35,2); _dCtx.fill();
      // 창틀 상단 장식
      _dCtx.fillStyle='#8a6838'; _drr(wx-C*.05,wy-C*.12,ww+C*.1,C*.1,2); _dCtx.fill();
      // 창 밖 화분 (왼쪽 창에만)
      if(wx < lx+lw/2){
        _dCtx.fillStyle='#a05020'; _drr(wx+ww*.1,wy+wh+C*.02,ww*.35,C*.1,2); _dCtx.fill();
        _dCtx.fillStyle='#2a7810'; _dc(wx+ww*.27,wy+wh+C*.0,C*.08); _dCtx.fill();
      }
    });

    // ── 문 (중앙, 크고 명확하게) ─────────────────────────
    const doorW=C*.88, doorH=C*1.05;
    const doorX=lx+lw/2-doorW/2, doorY=lh-C*.28-doorH;
    // 현관 계단
    _dCtx.fillStyle='#9a8868'; _drr(doorX-C*.14,lh-C*.1,doorW+C*.28,C*.1,2); _dCtx.fill();
    _dCtx.fillStyle='#b0a07a'; _drr(doorX-C*.08,lh-C*.2,doorW+C*.16,C*.12,2); _dCtx.fill();
    _dCtx.fillStyle='#c4b48e'; _drr(doorX-C*.02,lh-C*.3,doorW+C*.04,C*.12,2); _dCtx.fill();
    // 현관등
    _dCtx.fillStyle='#c8a030'; _drr(doorX+doorW+C*.06,doorY+C*.08,C*.14,C*.22,2); _dCtx.fill();
    _dCtx.fillStyle='rgba(255,220,100,.7)'; _dc(doorX+doorW+C*.13,doorY+C*.16,C*.07); _dCtx.fill();
    _dCtx.fillStyle='rgba(255,220,100,.3)'; _dc(doorX+doorW+C*.13,doorY+C*.16,C*.14); _dCtx.fill();
    // 문 틀
    _dCtx.fillStyle='#5a3a10'; _drr(doorX-C*.08,doorY-C*.06,doorW+C*.16,doorH+C*.06,5); _dCtx.fill();
    // 문 본체
    _dCtx.fillStyle='#6b4820'; _drr(doorX,doorY,doorW,doorH,4); _dCtx.fill();
    _dCtx.fillStyle='#7e5828'; _drr(doorX,doorY,doorW,doorH*.45,4); _dCtx.fill();
    // 문 패널 장식
    _dCtx.fillStyle='#5a3810';
    _drr(doorX+C*.08,doorY+C*.06,doorW-C*.16,doorH*.36,3); _dCtx.fill();
    _drr(doorX+C*.08,doorY+doorH*.46,doorW-C*.16,doorH*.46,3); _dCtx.fill();
    _dCtx.fillStyle='rgba(255,200,100,.08)';
    _drr(doorX+C*.1,doorY+C*.08,doorW-C*.2,doorH*.3,2); _dCtx.fill();
    // 문 손잡이
    _dCtx.fillStyle='#d4a820'; _dc(doorX+doorW*.72,doorY+doorH*.52,C*.07); _dCtx.fill();
    _dCtx.fillStyle='#f0c030'; _dc(doorX+doorW*.72,doorY+doorH*.52,C*.045); _dCtx.fill();
    // 우체통 (문 왼쪽)
    _dCtx.fillStyle='#b82020'; _drr(doorX-C*.44,lh-C*.54,C*.24,C*.26,2); _dCtx.fill();
    _dCtx.fillStyle='#d83030'; _drr(doorX-C*.44,lh-C*.54,C*.24,C*.1,2); _dCtx.fill();
    _dCtx.fillStyle='#902010'; _drr(doorX-C*.46,lh-C*.56,C*.28,C*.06,2); _dCtx.fill();
    // 우체통 기둥
    _dCtx.fillStyle='#606060'; _drr(doorX-C*.34,lh-C*.28,C*.06,C*.28,2); _dCtx.fill();
    // 들어가기 텍스트
    _dCtx.fillStyle='rgba(255,255,255,.65)'; _dCtx.font=`500 ${Math.max(C*.17,8)}px sans-serif`; _dCtx.textAlign='center';
    _dCtx.fillText('들어가기', doorX+doorW/2, doorY-C*.14);

    // ── 집 이름 (지붕 위) ────────────────────────────────
    _dCtx.fillStyle='rgba(255,255,255,.7)'; _dCtx.font=`700 ${Math.max(C*.22,10)}px sans-serif`; _dCtx.textAlign='center';
    _dCtx.fillText(CUR.name ? `🏠 ${CUR.name}의 집` : '🏠 내 집', lx+lw/2, lh-C*2.24);

    // ── 경계선 ────────────────────────────────────────────
    _dCtx.strokeStyle='#3a2808'; _dCtx.lineWidth=2.5;
    _dCtx.beginPath(); _dCtx.moveTo(hx,0); _dCtx.lineTo(hx,hh); _dCtx.stroke();
    //  [DECO-VIEW-FIT-1] 집 둘레는 집 폭까지만(마당이 80칸으로 넓어진 뒤 집 오른쪽 잔디를 판 끝까지 가로지르던 줄 — 디자인 ⑯) + 오른쪽 변
    _dCtx.beginPath(); _dCtx.moveTo(hx,hh); _dCtx.lineTo(hx+hw,hh); _dCtx.lineTo(hx+hw,0); _dCtx.stroke();
  }
  }   // [DECO-HOUSE-ART-1] 옛 그리기 끝

  // 격자 (집 영역 제외) — [DECO-VIEW-FIT-1] 판 크기까지(전엔 캔버스 크기 W·H 까지라 오른쪽·아래로 밀면 격자가 없었다 · 집 오른쪽 칸 위 3줄도)
  const BW = DY.cols*C, BH = DY.rows*C;
  //  [DECO-GROUND-1] 모눈은 고르는 동안(카드를 든 채 · 바닥 모드)만 — 평소엔 안 보이게(창조자 31회 '스티커를 모눈종이에 붙인 모습') · [DECO-PHOTO-1] 사진엔 없음
  _dCtx.strokeStyle= (!_decoPhotoMode && (SEL_DECO || DECO_MODE==='floor')) ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,0)'; _dCtx.lineWidth=.5;
  _dCtx.beginPath();
  for(let r=0;r<=DY.rows;r++){
    if(r<DH.rows){ _dCtx.moveTo(0,r*C); _dCtx.lineTo(hx,r*C); _dCtx.moveTo(hx+hw,r*C); _dCtx.lineTo(BW,r*C); }
    else { _dCtx.moveTo(0,r*C); _dCtx.lineTo(BW,r*C); }
  }
  for(let c=0;c<=DY.cols;c++){
    const x=c*C;
    if(x>hx && x<hx+hw){ _dCtx.moveTo(x,hh); _dCtx.lineTo(x,BH); }
    else { _dCtx.moveTo(x,0); _dCtx.lineTo(x,BH); }
  }
  _dCtx.stroke();

  // 선택 하이라이트 (장식 모드 vs 바닥 모드)
  if(DECO_MODE==='floor'){
    for(let r=0;r<DY.rows;r++) for(let c=0;c<DY.cols;c++){
      if(_isHC(r,c)) continue;
      _dCtx.strokeStyle='rgba(255,255,255,.18)'; _dCtx.lineWidth=.5;
      _dCtx.strokeRect(c*C+.5,r*C+.5,C-1,C-1);
    }
  } else if(SEL_DECO) {
    const sd = GAME_DATA.decorations.find(x=>x.id===SEL_DECO);
    if(sd?.cat==='yard') {
      // [DECO-SEL-HL-1] 놓을 수 있는 칸을 칸마다 한 번 + 둘레 한 줄 — 보이는 칸만 그린다(세는 것은 상태가 바뀔 때 한 번)
      _decoDrawOkCells(_decoOkCells('yard'), 0, 0, C, _decoVisible(DY.rows, DY.cols), _decoAnimHomeCells());
    }
  }

  // 배치된 마당 장식 - footprint 전체를 채우는 bounding box 렌더
  // [DECO-SVG-1] 뒤(윗줄)부터 그린다 — SVG가 위로 넘칠 수 있어 앞줄이 가리게 해야 한다
  _decoSorted(_decoList(CUR).filter(p=>p.area==='yard')).forEach(p=>{   // [DECO-SPACE-1]
    const fn=_DFN[p.id], d=GAME_DATA.decorations.find(x=>x.id===p.id);
    if(!d) return;
    if(ANIM_DECO[p.id]) return;   // [DECO-ANIM-1] 움직이는 동물은 캔버스 위 층에서 그린다
    const drawId = d.autoFence ? _fenceArtFor(CUR, p.row, p.col) : p.id;   // [DECO-FENCE-1]
    const sz=d.size||{w:1,h:1};
    const px=p.col*C, py=p.row*C;
    const bw=sz.w*C, bh=sz.h*C;
    const _gnd = _decoGroundOn(p, d);   // [DECO-GROUND-1] 잔디 위 물건이면 밑동 그림자 → 그림 → 풀 덮임
    if (_gnd) _decoGroundShadow(px, py, bw, bh, C);
    const mvBody = _decoMotionBody(p.id);   // [DECO-MOTION-1] 움직이는 부분은 DOM 층이 — 캔버스엔 멈춘 몸통
    const _sway = _decoWindAngle(p);   // [DECO-WIND-1] 바람이 지나는 동안만 — 밑동 고정 기울임(skewX)
    if (_sway) { _dCtx.save(); const bx = px + bw / 2, by = py + bh; _dCtx.translate(bx, by); _dCtx.transform(1, 0, -Math.tan(_sway), 1, 0, 0); _dCtx.translate(-bx, -by); }
    const _drew = _drawDecoSVG(mvBody || drawId, px, py, bw, bh);
    if (_sway) _dCtx.restore();
    if(_drew) { _decoSnowOver(p.id, px, py, bw, bh); if (_gnd) _decoGroundTufts(p, px, py, bw, bh, C, sz); return; }   // SVG 있으면 그걸로 끝 · [DECO-SEASON-1] 겨울 지붕 눈
    const cx=px+bw/2, cy=py+bh/2;
    // s = bounding box의 절반 (fn 함수는 ±s 범위로 그림)
    const s = Math.min(bw, bh) * 0.62;
    if(fn){
      // 멀티셀이면 bounding box 크기에 맞게 scale 변환
      if(sz.w>1||sz.h>1){
        _dCtx.save();
        _dCtx.translate(cx, cy);
        _dCtx.scale(sz.w > sz.h ? sz.w/sz.h : 1, sz.h > sz.w ? sz.h/sz.w : 1);
        fn(0, 0, s);
        _dCtx.restore();
      } else {
        fn(cx, cy, s);
      }
      return;
    }
    // 커스텀 함수 없는 경우 - offscreen canvas로 bounding box 채우기
    const oc=document.createElement('canvas');
    const base=Math.max(bw,bh)*2;
    oc.width=oc.height=base;
    const ox=oc.getContext('2d');
    ox.font=`${base*0.85}px sans-serif`;
    ox.textAlign='center'; ox.textBaseline='middle';
    ox.fillText(d.icon,base/2,base/2);
    const pad=2;
    _dCtx.drawImage(oc, px+pad, py+pad, bw-pad*2, bh-pad*2);
  });

  // 문 클릭 좌표 저장 (새 문 위치 기준)
  if (_houseArt) {   // [DECO-HOUSE-ART-1] 그림 속 문 자리(viewBox x268~332 · y248~352, 한 칸 = 100)
    _dCv._doorX = hx + 2.68 * C; _dCv._doorY = -C + 2.48 * C; _dCv._doorW = 0.64 * C; _dCv._doorH = 1.04 * C;
  } else {
    const _hw=hw, _hh=hh, _hx=hx;
    const _doorW=C*.88, _doorH=C*1.05;
    const _doorX=_hx+_hw/2-_doorW/2, _doorY=_hh-C*.28-_doorH;
    _dCv._doorX=_doorX; _dCv._doorY=_doorY; _dCv._doorW=_doorW; _dCv._doorH=_doorH;
  }
  _dCv._hx=hx; _dCv._hh=hh;

  // ── 마당 농장 존 렌더링 (우하단, 읽기 전용) ──────────────
  _drawYardFarm(C);
  _decoEventDraw(C);   // [DECO-EVENT-1] 계절 행사(장식 · 밭 다음 · 밤 막 아래)
  _decoNightDraw(C);   // [DECO-DAYNIGHT-1] 저녁·밤 — 색 막 · 불빛 · 창 불빛(맨 위)
}

// ── 마당 농장 존 렌더 + 판정 헬퍼 ──────────────────────────
function _getFarmZone() {
  const {cols:fc, rows:fr} = getFarmLayout(CUR.level || 1);
  // [DECO-ZOOM-1] 예전에는 '보이는 칸 수'(_dW/_dC)로 재서 창 크기·확대에 따라 농장이 움직였다
  //  (기기마다 자리가 달라지고, 확대하면 밭이 따라다녔다). 기준 판에 고정한다.
  const bc = Math.min(DY.cols, DY_BASE.cols), br = Math.min(DY.rows, DY_BASE.rows);
  const startCol = bc - fc - 1;
  const startRow = br - fr - 1;
  return { startCol, startRow, cols: fc, rows: fr };
}

function _isFarmCell(r, c) {
  if (DECO_SPACE !== 1) return false;   // [DECO-SPACE-1] 농장은 공간 1 에만
  const {startCol, startRow, cols, rows} = _getFarmZone();
  return r >= startRow && r < startRow + rows && c >= startCol && c < startCol + cols;
}

// [DECO-FARM-ART-1] 밭 그림(디자인 #453 · assets/farm) — 모래색 체크 + 진행 막대 + 주황 테두리(UI 판)가 윤곽 그림들 사이에서 튀던 것(디자인 D12)
//  흙 = tile_soil_a·b(옆 칸과 이어진다) · 작물 = 새싹(stage_sprout · 절반 전) → 포기(stage_grow) → 다 자라면 그 작물 아이콘 · 시듦 = stage_wither.
//  진행 막대·주황 테두리는 뺀다(밭은 여기서 읽기만 — 거두기는 🌾 농장 탭). 그림이 아직 안 왔으면 옛 그리기.
const _FARM_IMG = {};
function _farmImg(name) {
  const hit = _FARM_IMG[name];
  if (hit) return hit.ok ? hit.img : null;
  const src = _artSrc('farm/' + name + '.svg');   // [DECO-BUNDLE-1] 묶음을 받는 중이면 나중에
  if (src === null) return null;
  const img = new Image(), rec = { img, ok: false };
  _FARM_IMG[name] = rec;
  img.onload = () => { rec.ok = img.naturalWidth > 0; if (rec.ok) _drawDeco(); };
  img.onerror = () => { rec.ok = false; };
  img.src = src;
  return null;
}
function _drawYardFarm(C) {
  if (DECO_SPACE !== 1) return;   // [DECO-PT-3] 밭은 공간 1 에만(그림도) — 공간 2·3 에서 장식을 가리던 것
  const farm = CUR.farm || [];
  const {startCol, startRow, cols, rows} = _getFarmZone();
  const ctx = _dCtx;
  const soilA = _farmImg('tile_soil_a'), soilB = _farmImg('tile_soil_b');
  const art = !!(soilA && soilB);   // [DECO-FARM-ART-1]

  if (art) {
    //  둘레에 흙 그림자 한 겹 — 잔디 위에 갈아엎은 밭이 앉아 보이게(테두리 선 대신)
    ctx.fillStyle = 'rgba(43,33,24,.35)';
    ctx.beginPath(); ctx.roundRect(startCol * C - C * .06, startRow * C - C * .04, cols * C + C * .12, rows * C + C * .14, C * .12); ctx.fill();
  } else {
    // 농장 외곽 배경
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(startCol*C - 2, startRow*C - 2, cols*C + 4, rows*C + 4);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gc = startCol + c;
      const gr = startRow + r;
      const px = gc * C, py = gr * C;
      const slot = r * cols + c;
      const plot = farm.find(f => f.slot === slot);

      if (art) {
        const t = (gr * 3 + gc * 7) % 2 ? soilB : soilA;
        ctx.drawImage(_svgBmp('farm:' + ((gr * 3 + gc * 7) % 2 ? 'b' : 'a'), t, C * 2, 1), px, py, C, C);
      } else {
        // ── 바닥: 항상 모래색 (체크무늬) ──
        ctx.fillStyle = _yardLook().farmSand[(r + c) % 2];   // [DECO-LOOK-0]
        ctx.fillRect(px+1, py+1, C-2, C-2);
      }

      if (plot) {
        const sd = Utils.getSeedByCrop(plot.crop);
        if (!sd) continue;
        const ready    = Utils.cropReady(plot.planted, sd.growHours);
        const elapsed  = Date.now() - plot.planted;
        const withered = ready && elapsed > sd.growHours * 3600000 * 3;
        const pct      = Utils.cropProgress(plot.planted, sd.growHours);

        if (art) {
          //  [DECO-FARM-ART-1] 단계 그림 — 다 자란 것만 그 작물 아이콘(작물마다 그림이 따로 없다) + 옅은 빛
          const stage = withered ? 'stage_wither' : !ready ? (pct < 50 ? 'stage_sprout' : 'stage_grow') : '';
          const si = stage && _farmImg(stage);
          if (si) ctx.drawImage(_svgBmp('farm:' + stage, si, C * 2, 1), px, py, C, C);
          if (ready && !withered) {
            const g = ctx.createRadialGradient(px + C / 2, py + C * .55, 0, px + C / 2, py + C * .55, C * .55);
            g.addColorStop(0, 'rgba(255,236,150,.55)'); g.addColorStop(1, 'rgba(255,236,150,0)');
            ctx.fillStyle = g; ctx.fillRect(px, py, C, C);
          }
          if ((ready && !withered) || (!si && !withered)) {
            ctx.font = `${Math.max(C * .62, 8)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(ready ? sd.cropIcon : '🌱', px + C / 2, py + C * .5);
          }
          if (plot.isMutant && !withered) { ctx.font = `${Math.max(C * .32, 7)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', px + C * .82, py + C * .2); }
          continue;
        }

        // ── 수확 가능 시 살짝 밝은 오버레이 ──
        if (ready && !withered) {
          ctx.fillStyle = 'rgba(39,174,96,.25)';
          ctx.fillRect(px+1, py+1, C-2, C-2);
        }

        // ── 진행바 (하단) ──
        const barH = Math.max(2, C * .12);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.fillRect(px+1, py + C - barH - 1, C-2, barH);
        ctx.fillStyle = ready
          ? (withered ? '#a0806a' : '#2ecc71')
          : (plot.isMutant ? '#FFA500' : '#27ae60');
        ctx.fillRect(px+1, py + C - barH - 1, (C-2) * (pct/100), barH);

        // ── 작물 아이콘 ──
        const icon = withered ? '🍂' : ready ? sd.cropIcon : (plot.isMutant ? '⚡' : '🌱');
        const fs = Math.max(C * .55, 8);
        ctx.font = `${fs}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, px + C/2, py + C/2 - barH/2);
      }
    }
  }

  if (!art) {
    // 농장 테두리
    ctx.strokeStyle = 'rgba(255,180,0,.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startCol*C, startRow*C, cols*C, rows*C);
  }
  // 저장용
  _dCv._farmZone = {startCol, startRow, cols, rows};
}

// [INDOOR-ROOMS-1] 빈 터 + 방들 — 규칙 docs/indoor_look_rules_20260920.md §1(빈 터 도면) · §2(벽 띠·벽·문)
// [DECO-INDOOR-WALL-1] 집 안 두꺼운 벽 — 디자인 시안 A(docs/indoor_walls_20260923.md · 보스 채택): 벽 윗면·앞면으로 방이 또렷하고, 벽이 끊긴 문 자리,
//  아래벽에 뚫린 현관, 방 밖은 마당 잔디 + 방 그림자(어두운 도면 79~87% 를 없앤다). 저장 0 — 전부 방 목록에서 나온다. 방이 없으면 지금 큰 방 그대로.
//  그리는 순서: 방 밖 → 방(바닥·벽 띠·그림자) → 뒷벽·옆벽 윗면 → 문 → (가구) → 아래벽 윗면·앞면(_inDrawFrontWalls — 앞에 선 벽)
const IW = { top: '#3e7b7a', light: '#63a7a2', edge: '#1f3a3c', face: '#2b5557', faceLow: '#203f41', sill: '#b98a58', sillLine: '#7a5230' };
function _inWallGeom(rooms, offX, offY, C) {
  const T = .34 * C, doors = _inRoomDoors(rooms), exits = _inExitSpots(rooms), exit = exits[0];   // [DECO-INDOOR-WALL-2]
  //  가로 구간 [a,b) 에서 틈들을 뺀다
  const cut = (a, b, gaps) => { let segs = [[a, b]]; gaps.forEach(([g0, g1]) => { segs = segs.flatMap(([s0, s1]) => g1 <= s0 || g0 >= s1 ? [[s0, s1]] : [[s0, Math.max(s0, g0)], [Math.min(s1, g1), s1]].filter(([u, v]) => v - u > .5)); }); return segs; };
  const back = [], side = [], bottom = [], shared = [];
  //  위아래로 맞닿은 두 방 사이 벽은 하나 — 윗방 아래벽 자리에 뒷벽들과 같이(가구 전에) 그리고, 아랫방 뒷벽은 그 칸들에서 뺀다(두 겹 · 속선이 보였다)
  const above = rm => rooms.filter(o => o.r + o.h === rm.r - 1).map(o => [offX + Math.max(o.c, rm.c) * C, offX + Math.min(o.c + o.w, rm.c + rm.w) * C]).filter(([a, b]) => b > a);
  const below = rm => rooms.filter(o => o.r - 1 === rm.r + rm.h).map(o => [offX + Math.max(o.c, rm.c) * C, offX + Math.min(o.c + o.w, rm.c + rm.w) * C]).filter(([a, b]) => b > a);
  rooms.forEach(rm => {
    const x0 = offX + rm.c * C, x1 = offX + (rm.c + rm.w) * C, yb = offY + (rm.r - 1) * C, y1 = offY + (rm.r + rm.h) * C;
    const hgBack = doors.filter(d => d.row !== undefined && d.row === rm.r - 1).map(d => [offX + d.c0 * C, offX + d.c1 * C]).concat(above(rm).map(([a, b]) => [a - T / 2, b + T / 2]));   // 모서리 반 두께 삐죽이까지
    cut(x0 - T / 2, x1 + T / 2, hgBack).forEach(([a, b]) => back.push({ x: a, y: yb - T, w: b - a, h: T, hz: true }));
    [[x0, rm.c], [x1, rm.c + rm.w]].forEach(([x, col]) => {
      const vg = doors.filter(d => d.col === col && d.r0 >= rm.r && d.r1 <= rm.r + rm.h).map(d => [offY + d.r0 * C, offY + d.r1 * C]);
      //  위: 뒷벽 윗면 윗끝부터(위에 방이 붙어 사이 벽이면 그 벽 윗끝부터) · 아래: 아래벽 윗면 윗끝까지(그 아래는 아래벽이 덮는다)
      const capped = above(rm).some(([a, b]) => x >= a - T && x <= b + T);
      let segs = [[capped ? yb - T / 2 : yb - T, y1 - T / 2]];
      vg.forEach(([g0, g1]) => { segs = segs.flatMap(([s0, s1]) => g1 <= s0 || g0 >= s1 ? [[s0, s1]] : [[s0, g0], [g1, s1]].filter(([u, v]) => v - u > .5)); });
      segs.forEach(([a, b]) => side.push({ x: x - T / 2, y: a, w: T, h: b - a, hz: false, end: b === y1 - T / 2 }));
    });
    const hgBot = doors.filter(d => d.row !== undefined && d.row === rm.r + rm.h).map(d => [offX + d.c0 * C, offX + d.c1 * C])
      .concat(exits.filter(e => e.room === rm).map(e => [offX + e.c0 * C, offX + e.c1 * C]));
    //  아래에 방이 붙은 칸 = 사이 벽(뒤로) · 나머지 = 앞에 선 아래벽
    const bl = below(rm);
    cut(x0 - T / 2, x1 + T / 2, hgBot).forEach(([a, b]) => {
      cut(a, b, bl).forEach(([u, v]) => bottom.push({ x: u, y: y1 - T / 2, w: v - u, h: T, hz: true }));
      bl.forEach(([g0, g1]) => { const u = Math.max(a, g0), v = Math.min(b, g1); if (v - u > .5) shared.push({ x: u, y: y1 - T / 2, w: v - u, h: T, hz: true }); });
    });
  });
  return { T, back, side, bottom, shared, doors, exit, exits };
}
//  벽 윗면 여럿 — ① 테두리색 칠 + 두 배 폭 선 ② 윗면색(선 없이) ③ 밝은 줄(가로 벽 위쪽 · 세로 벽 왼쪽 22%) — 모퉁이·T자 만남에 속선이 안 생긴다
function _inWallTops(list, C) {
  const ctx = _dCtx, bw = Math.max(1.4, .035 * C);
  ctx.fillStyle = IW.edge; ctx.strokeStyle = IW.edge; ctx.lineWidth = bw * 2; ctx.lineJoin = 'miter';
  list.forEach(r => { ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeRect(r.x, r.y, r.w, r.h); });
  ctx.fillStyle = IW.top; list.forEach(r => ctx.fillRect(r.x, r.y, r.w, r.h));
  ctx.fillStyle = IW.light; list.forEach(r => r.hz ? ctx.fillRect(r.x, r.y, r.w, r.h * .22) : ctx.fillRect(r.x, r.y, r.w * .22, r.h));
}
function _inDrawRooms(rooms, offX, offY, C) {
  const ctx = _dCtx, cols = DI.cols, rows = DI.rows, G = _inWallGeom(rooms, offX, offY, C), T = G.T;
  //  방 밖 A — 마당 잔디(칸마다 고정 변형 · 판 밖까지 화면에 보이는 만큼)
  const c0 = Math.floor((_dPanX - offX) / C) - 1, c1 = Math.ceil((_dPanX + _dW - offX) / C) + 1;
  const r0 = Math.floor((_dPanY - offY) / C) - 1, r1 = Math.ceil((_dPanY + _dH - offY) / C) + 1, grass = () => 'grass';
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    if (!(FLOOR_SVG && _drawFloorSVG('grass', r + 1000, c + 1000, offX + c * C, offY + r * C, C, grass))) {
      ctx.fillStyle = (r + c) % 2 ? FLOOR_TILES.grass.alt : FLOOR_TILES.grass.bg; ctx.fillRect(offX + c * C, offY + r * C, C, C);
    }
  }
  //  방 그림자 — 방(벽 띠 · 벽 두께까지)을 두른 상자 · 흐림 .18C · 아래로 .25C · .45
  ctx.save(); ctx.filter = `blur(${Math.max(1, .18 * C)}px)`; ctx.fillStyle = 'rgba(0,0,0,.45)';
  rooms.forEach(rm => ctx.fillRect(offX + rm.c * C - T / 2, offY + (rm.r - 1) * C - T + .25 * C, rm.w * C + T, (rm.h + 1) * C + T * 1.5));
  ctx.restore();
  const bb = _floorImg('wall_baseboard');
  rooms.forEach(rm => {
    const [fa, fc] = _inLookArt('floor', rm.floor), [wa, wc] = _inLookArt('wall', rm.wall);
    const fi = _floorImg(fa, fc), wi = _floorImg(wa, wc), x0 = offX + rm.c * C, y0 = offY + rm.r * C;
    ctx.fillStyle = '#C4955A'; ctx.fillRect(x0, y0, rm.w * C, rm.h * C);
    ctx.fillStyle = '#8B6520'; ctx.fillRect(x0, y0 - C, rm.w * C, C);
    //  위아래 문: 아랫방 벽 띠의 그 두 칸은 벽이 아니라 통로 — 바닥으로
    const passage = G.doors.filter(d => d.row !== undefined && d.row === rm.r - 1);
    const isPass = c => passage.some(d => c >= d.c0 && c < d.c1);
    for (let c = 0; c < rm.w; c++) {
      if (fi) for (let r = 0; r < rm.h; r++) ctx.drawImage(fi, x0 + c * C, y0 + r * C, C, C);
      if (isPass(rm.c + c)) { if (fi) ctx.drawImage(fi, x0 + c * C, y0 - C, C, C); continue; }
      if (wi) ctx.drawImage(wi, x0 + c * C, y0 - C, C, C);
      if (bb) ctx.drawImage(bb, x0 + c * C, y0 - C, C, C);
    }
    //  벽 그림자 — 뒷벽 아래 .35C(벽 띠가 바닥에서 떨어져 서 있어 보이게) · 옆벽 오른쪽 .28C
    const g = ctx.createLinearGradient(0, y0, 0, y0 + C * .35);
    g.addColorStop(0, 'rgba(40,20,5,.22)'); g.addColorStop(1, 'rgba(40,20,5,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, rm.w * C, C * .35);
    const g2 = ctx.createLinearGradient(x0 + T / 2, 0, x0 + T / 2 + C * .28, 0);
    g2.addColorStop(0, 'rgba(40,20,5,.2)'); g2.addColorStop(1, 'rgba(40,20,5,0)');
    ctx.fillStyle = g2; ctx.fillRect(x0 + T / 2, y0 - C, C * .28, (rm.h + 1) * C);
  });
  //  뒷벽·옆벽 윗면(가구보다 먼저 — 가구가 그 앞에 선다)
  _inWallTops(G.back.concat(G.shared, G.side), C);
  //  문턱 — 옆문은 세로로, 위아래 문은 가로로(폭 T · 양옆 선)
  G.doors.forEach(d => {
    ctx.fillStyle = IW.sill;
    if (d.col !== undefined) {
      const x = offX + d.col * C, y = offY + d.r0 * C, h = (d.r1 - d.r0) * C;
      ctx.fillRect(x - T / 2, y, T, h); ctx.fillStyle = IW.sillLine; ctx.fillRect(x - T / 2, y, 1.2, h); ctx.fillRect(x + T / 2 - 1.2, y, 1.2, h);
    } else {
      const x = offX + d.c0 * C, y = offY + d.row * C, w = (d.c1 - d.c0) * C;
      ctx.fillRect(x, y - T / 2, w, T); ctx.fillStyle = IW.sillLine; ctx.fillRect(x, y - T / 2, w, 1.2); ctx.fillRect(x, y + T / 2 - 1.2, w, 1.2);
    }
  });
}
//  아래벽 — 가구보다 나중에(앞에 선 벽): 윗면 + 칸 밖 앞면 .3C(아래 40% 짙게) · 옆벽과 만나는 자리의 속선은 윗면색으로 덮는다
function _inDrawFrontWalls(rooms, offX, offY, C) {
  const ctx = _dCtx, G = _inWallGeom(rooms, offX, offY, C), T = G.T, bw = Math.max(1.4, .035 * C), fh = .3 * C;
  G.bottom.forEach(r => {
    ctx.fillStyle = IW.edge; ctx.fillRect(r.x - bw, r.y + T, r.w + bw * 2, fh + bw);
    ctx.fillStyle = IW.face; ctx.fillRect(r.x, r.y + T, r.w, fh * .6);
    ctx.fillStyle = IW.faceLow; ctx.fillRect(r.x, r.y + T + fh * .6, r.w, fh * .4);
  });
  _inWallTops(G.bottom, C);
  //  이음 — 나중에 그린 아래벽의 테두리 선이 먼저 그린 벽(옆벽 · 사이 벽) 위로 넘어간 자리를 그 벽의 윗면색·밝은 줄로 다시 덮는다(속선 · 돌기 없음)
  const early = G.back.concat(G.shared, G.side);
  G.bottom.forEach(b => {
    const ex = { x: b.x - bw * 2, y: b.y - bw * 2, w: b.w + bw * 4, h: b.h + bw * 4 };
    early.forEach(r => {
      const x0 = Math.max(ex.x, r.x), y0 = Math.max(ex.y, r.y), x1 = Math.min(ex.x + ex.w, r.x + r.w), y1 = Math.min(ex.y + ex.h, r.y + r.h);
      if (x1 <= x0 || y1 <= y0) return;
      ctx.fillStyle = IW.top; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = IW.light;
      if (r.hz) { const ly1 = Math.min(y1, r.y + r.h * .22); if (ly1 > y0) ctx.fillRect(x0, y0, x1 - x0, ly1 - y0); }
      else { const lx1 = Math.min(x1, r.x + r.w * .22); if (lx1 > x0) ctx.fillRect(x0, y0, lx1 - x0, y1 - y0); }
    });
  });
}
function _drawIndoor() {
  const C = _dC, W = _dW, H = _dH;
  // [DECO-PT-1] 확대하면 (W−판)/2 가 음수가 되어 왼쪽 칸에 못 가고 오른쪽이 까맸다 → 음수면 0, 나머지는 화면 밀기가
  const offX = Math.max(0, Math.floor((W - DI.cols*C)/2));
  const offY = Math.max(Math.floor(C*.9), Math.floor((H - DI.rows*C)/2));

  //  [INDOOR-ROOMS-1] 방이 있으면 빈 터(도면) 위에 방들 — 없으면 아래 지금 그대로(한 픽셀도 안 바뀐다)
  const _rooms = _inRooms(CUR);
  let wallSvgOk = true;
  if (_rooms.length) _inDrawRooms(_rooms, offX, offY, C);
  else {
  // 벽 — [DECO-PT-1] 확대해 밀어도 벽이 끊기지 않게 판 전체 크기로 칠한다
  _dCtx.fillStyle='#8B6520'; _dCtx.fillRect(0,0,Math.max(W,offX*2+DI.cols*C),Math.max(H,offY+DI.rows*C+C));
  // 바닥
  _dCtx.fillStyle='#C4955A'; _dCtx.fillRect(offX,offY,DI.cols*C,DI.rows*C);
  for(let r=0;r<DI.rows;r++){_dCtx.fillStyle=r%2?'rgba(255,255,255,.03)':'rgba(0,0,0,.05)';_dCtx.fillRect(offX,offY+r*C,DI.cols*C,C);}

  // [FLOOR-SVG-1] 벽지·걸레받이·창 + 마루 (조각이 없으면 위 단색 그대로)
  wallSvgOk = FLOOR_SVG && _drawIndoorFloorSVG(offX, offY, C, W);
  }

  // 가구 하나 그리기 (SVG → _DFN → 이모지 순 폴백)
  const _drawIndoorItem = p => {
    const fn=_DFN[p.id], d=GAME_DATA.decorations.find(x=>x.id===p.id);
    if(!d) return;
    const sz=d.size||{w:1,h:1};
    const px=offX+p.col*C, py=offY+p.row*C;
    const bw=sz.w*C, bh=sz.h*C;
    if(_drawDecoSVG(p.id, px, py, bw, bh)) return;   // [DECO-SVG-1]
    const cx=px+bw/2, cy=py+bh/2;
    const s = Math.min(bw, bh) * 0.62;
    if(fn){
      if(sz.w>1||sz.h>1){
        _dCtx.save();
        _dCtx.translate(cx, cy);
        _dCtx.scale(sz.w > sz.h ? sz.w/sz.h : 1, sz.h > sz.w ? sz.h/sz.w : 1);
        fn(0, 0, s);
        _dCtx.restore();
      } else {
        fn(cx, cy, s);
      }
    } else {
      const oc=document.createElement('canvas');
      const base=Math.max(bw,bh)*2;
      oc.width=oc.height=base;
      const ox=oc.getContext('2d');
      ox.font=`${base*0.85}px sans-serif`;
      ox.textAlign='center'; ox.textBaseline='middle';
      ox.fillText(d.icon,base/2,base/2);
      _dCtx.drawImage(oc, px+2, py+2, bw-4, bh-4);
    }
  };
  const _indoorPlaced = _decoList(CUR).filter(p=>p.area==='indoor');   // [DECO-SPACE-1]
  // [FLOOR-SVG-1] 바닥 레이어(러그) — 격자·가구보다 먼저
  _decoSorted(_indoorPlaced.filter(_isFloorLayerDeco)).forEach(_drawIndoorItem);
  //  [DECO-EXIT-DOOR-1] 나가기 문 — 가장 아래 방의 아래 벽 가운데(방이 없으면 판 아래 가운데) · [INDOOR-ROOMS-1]
  const _exs = _inExitSpots(_rooms), _ex = _exs[0];   // [DECO-INDOOR-WALL-1] 규칙으로 정한 자리(칸 경계) — 아래벽 틈과 같은 자리 · [DECO-INDOOR-WALL-2] 묶음마다
  const _doorCx = offX + (_ex.c0 + 1) * C;
  const _doorWall = offY + _ex.wallRow * C;
  const _exitArt = FLOOR_SVG && _decoImg('in_exit_door');
  if (_exitArt) _exs.forEach(e => _drawExitDoorArt(_exitArt, offX + (e.c0 + 1) * C, offY + e.wallRow * C, C));   // 발판·빛은 바닥 층이라 가구보다 먼저

  // 창문 (위쪽 벽) — 벽 SVG가 그려졌으면 생략
  if(offY > 14 && !wallSvgOk){
    const wh=Math.min(offY*.55, C*.7);
    [offX+C, offX+C*4.5, offX+C*8.5].forEach(wx=>{
      _dCtx.fillStyle='#87CEEB'; _dCtx.globalAlpha=.7;
      _drr(wx, offY*.28, C*.88, wh, 3); _dCtx.fill(); _dCtx.globalAlpha=1;
      _dCtx.strokeStyle='#5a3510'; _dCtx.lineWidth=1; _dCtx.strokeRect(wx, offY*.28, C*.88, wh);
      _dCtx.beginPath(); _dCtx.moveTo(wx+C*.44, offY*.28); _dCtx.lineTo(wx+C*.44, offY*.28+wh); _dCtx.stroke();
    });
  }

  // 격자
  _dCtx.strokeStyle='rgba(0,0,0,.1)'; _dCtx.lineWidth=.5;
  for(let c=0;c<=DI.cols;c++){_dCtx.beginPath();_dCtx.moveTo(offX+c*C,offY);_dCtx.lineTo(offX+c*C,offY+DI.rows*C);_dCtx.stroke();}
  for(let r=0;r<=DI.rows;r++){_dCtx.beginPath();_dCtx.moveTo(offX,offY+r*C);_dCtx.lineTo(offX+DI.cols*C,offY+r*C);_dCtx.stroke();}

  // 선택 하이라이트
  if(SEL_DECO && _isWallDeco(SEL_DECO)){   // [INDOOR-WALL-1] 벽걸이 카드 — 벽 띠의 빈 칸만 밝게
    _dCtx.fillStyle='rgba(255,216,102,.3)'; _dCtx.strokeStyle='rgba(255,216,102,.9)'; _dCtx.lineWidth=Math.max(1,C*.05);
    const wallRows = _rooms.length ? _rooms.map(rm => [rm.r, rm.c, rm.w]) : [[0, 0, DI.cols]];   // [INDOOR-ROOMS-1] 방이 있으면 방마다 윗벽
    wallRows.forEach(([wr, c0, w]) => { for(let c=c0;c<c0+w;c++) if(!_decoList(CUR).some(p=>p.area==='indoor'&&p.row===wr&&_isWallDeco(p.id)&&c>=p.col&&c<p.col+getDecoSize(p.id).w)){
      _dCtx.fillRect(offX+c*C+2,offY+(wr-1)*C+2,C-4,C-4); _dCtx.strokeRect(offX+c*C+2,offY+(wr-1)*C+2,C-4,C-4);
    } });
  } else if(SEL_DECO && GAME_DATA.decorations.find(x=>x.id===SEL_DECO)?.cat==='indoor'){
    // [DECO-SEL-HL-1] 크기·방 벽·깔개 규칙까지 본 '놓을 수 있는 칸' — 칸마다 한 번 + 둘레 한 줄(전엔 빈 1칸만 칠해 큰 가구가 안 들어가는 곳도 밝았다)
    _decoDrawOkCells(_decoOkCells('indoor'), offX, offY, C, { r0: 0, c0: 0, r1: DI.rows, c1: DI.cols });
  }

  // [INDOOR-WALL-1] 벽걸이 — 0번 줄에 놓인 것은 한 칸 위 벽 띠에(벽걸이 판이 있으면 그것, 없으면 몸통을 띠에). 가구보다 먼저 = 가구가 그 앞에 선다
  const _onWall = p => _isWallDeco(p.id) && _inIsWallRow(p.row, p.col);   // [INDOOR-ROOMS-1] 판 맨 윗줄 또는 방 윗줄
  _indoorPlaced.filter(_onWall).forEach(p => {
    const sz = getDecoSize(p.id), px = offX + p.col * C, py = offY + (p.row - 1) * C;
    const art = DECO_WALL_ART[p.id] && _decoImg(DECO_WALL_ART[p.id]);
    if (art) _dCtx.drawImage(art, px, py, sz.w * C, C);
    else _drawDecoSVG(p.id, px, py, sz.w * C, C);
  });
  // 배치된 가구 (바닥 레이어 제외 — 러그는 위에서 먼저 그렸다)
  //  [DECO-ROOM-HOUSE-1] 옛 저장본의 방 밖 가구(잔디 위)는 아래벽 **뒤가 아니라 앞**에 — 방 아래 줄의 TV 가 벽에 박혀 보였다(사용자 10-03)
  const _outRoom = p => { const z = getDecoSize(p.id); return _rooms.length && !_rooms.some(o => p.row >= o.r && p.col >= o.c && p.row + z.h <= o.r + o.h && p.col + z.w <= o.c + o.w); };
  const _standing = _indoorPlaced.filter(p=>!_isFloorLayerDeco(p) && !_onWall(p));
  _decoSorted(_standing.filter(p => !_outRoom(p))).forEach(_drawIndoorItem);
  if (_rooms.length) _inDrawFrontWalls(_rooms, offX, offY, C);   // [DECO-INDOOR-WALL-1] 아래벽은 가구 앞에 선다
  _decoSorted(_standing.filter(_outRoom)).forEach(_drawIndoorItem);

  // 나가기 문
  if (_exitArt) {
    //  [DECO-EXIT-DOOR-1] 누르는 자리는 벽 밖(환한 바깥 · 화살표) — 방 안 발판 칸은 가구를 놓을 수 있게 둔다. 손가락 몫으로 0.75칸 높이
    _dCv._doorX = _doorCx - .64 * C; _dCv._doorY = _doorWall - .04 * C; _dCv._doorW = 1.28 * C; _dCv._doorH = .79 * C;
    _dCv._doors = _exs.map(e => ({ x: offX + (e.c0 + 1) * C - .64 * C, y: offY + e.wallRow * C - .04 * C, w: 1.28 * C, h: .79 * C }));   // [DECO-INDOOR-WALL-2]
  } else {
  const dx = _doorCx - C * .35, dy = _doorWall - C * .75;
  _dCtx.fillStyle='#5a3010'; _drr(dx,dy,C*.7,C*.75,3); _dCtx.fill();
  _dCtx.strokeStyle='#3a1e08'; _dCtx.lineWidth=1.5; _dCtx.strokeRect(dx,dy,C*.7,C*.75);
  _dCtx.fillStyle='#FFD700'; _dc(dx+C*.58,dy+C*.38,C*.07); _dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.72)'; _dCtx.font=`${Math.max(C*.18,8)}px sans-serif`; _dCtx.textAlign='center';
  _dCtx.fillText('나가기', dx+C*.35, dy-C*.1);

  _dCv._doorX=dx; _dCv._doorY=dy; _dCv._doorW=C*.7; _dCv._doorH=C*.75;
  _dCv._doors = null;
  }
  _dCv._offX=offX; _dCv._offY=offY;
  //  [DECO-ROOM-RESIZE-1] ⬛ 방(네모 끌기)일 때 방마다 손잡이 — 모서리 넷 · 변 가운데 넷(끌면 크기가 바뀐다)
  if (_inRoomDragMode() && !_inRoomPrev) {
    const hs = Math.max(6, C * .32);
    _dCtx.fillStyle = '#ffd866'; _dCtx.strokeStyle = 'rgba(43,33,24,.85)'; _dCtx.lineWidth = 1.5;
    _rooms.forEach(rm => {
      const x0 = offX + rm.c * C, y0 = offY + (rm.r - 1) * C, x1 = offX + (rm.c + rm.w) * C, y1 = offY + (rm.r + rm.h) * C, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      [[x0, y0], [xm, y0], [x1, y0], [x0, ym], [x1, ym], [x0, y1], [xm, y1], [x1, y1]].forEach(([x, y]) => { _dCtx.fillRect(x - hs / 2, y - hs / 2, hs, hs); _dCtx.strokeRect(x - hs / 2, y - hs / 2, hs, hs); });
    });
  }
  //  [INDOOR-ROOMS-1] 끄는 중인 네모 — 방 칸 + 벽 띠 줄까지 금색 점선(안 되면 붉게)
  if (_inRoomPrev && (!_inRoomPrev.ghost || _inChipMode())) {
    const p = _inRoomPrev, x = offX + p.c * C, y = offY + (p.r - 1) * C, w = p.w * C, h = (p.h + 1) * C;
    if (p.raw) {   // [DECO-ROOM-HOUSE-1] 끈(누른) 자리는 옅은 점선 — 실제로 지어질 곳(금색)과 같이 보인다
      const q = p.raw;
      _dCtx.save(); _dCtx.setLineDash([Math.max(3, C * .18), Math.max(3, C * .18)]); _dCtx.lineWidth = 1.5; _dCtx.strokeStyle = 'rgba(255,255,255,.55)';
      _dCtx.strokeRect(offX + q.c * C, offY + (q.r - 1) * C, q.w * C, (q.h + 1) * C); _dCtx.restore();
    }
    _dCtx.fillStyle = p.why ? 'rgba(255,110,90,.2)' : 'rgba(255,216,102,.2)'; _dCtx.fillRect(x, y, w, h);
    _dCtx.save(); _dCtx.setLineDash([Math.max(4, C * .3), Math.max(3, C * .2)]); _dCtx.lineWidth = 3;
    _dCtx.strokeStyle = p.why ? '#ff8a73' : '#ffd866'; _dCtx.strokeRect(x, y, w, h); _dCtx.restore();
  }
}

function _decoClick(e) {
  if(!_dCv||!_dCtx) return;
  if(_dSuppressClick) return;   // [DECO-ZOOM-1] 화면을 끈 직후·핀치 직후의 클릭은 놓기가 아니다
  if(_lifeCard) _lifeCardClose();   // [DECO-LIFE-2] 판을 누르면 동물 카드는 닫힌다(동물을 누른 것이면 다시 열린다)
  const _bp=_decoBoardPoint(e.clientX, e.clientY);   // [DECO-ZOOM-1] 이동·확대 반영
  const mx=_bp.x, my=_bp.y;
  const C=_dC;

  // 문 클릭 체크
  const {_doorX:dx,_doorY:dy,_doorW:dw,_doorH:dh}=_dCv;
  if(dx!==undefined&&mx>=dx&&mx<=dx+dw&&my>=dy&&my<=dy+dh){ toggleDecoScene(); return; }
  if(DECO_SCENE!=='yard' && Array.isArray(_dCv._doors) && _dCv._doors.some(d=>mx>=d.x&&mx<=d.x+d.w&&my>=d.y&&my<=d.y+d.h)){ toggleDecoScene(); return; }   // [DECO-INDOOR-WALL-2] 묶음마다 나가기 문

  if(DECO_SCENE==='yard'){
    const c=Math.floor(mx/C), r=Math.floor(my/C);
    if(c<0||c>=DY.cols||r<0||r>=DY.rows) return;
    if(_isHC(r,c)){ toast('🏠 집이 있는 자리예요 — 집 밖에 놓아요'); return; }   // [DECO-WORDS-1]
    // 농장 존 클릭 차단 (수확은 농장 탭에서만)
    if(_isFarmCell(r,c)){ toast('🌾 여기는 밭이에요 — 밭에는 장식을 놓을 수 없어요'); return; }   // [DECO-PT-1]
    _decoLastTap = { area: 'yard', r, c, t: Date.now() };   // [DECO-DRAG-1]
    if(DECO_MODE==='floor') { _paintFloor(r,c); return; }
    // [DECO-ANIM-2] 카드를 안 고른 상태에서 동물을 누르면 반응(놓기가 먼저다)
    //  [DECO-SEL-A5] 카드를 들었어도 — 보이는 동물을 누른 것은 쓰다듬기다(전엔 그 발밑에 하나가 더 놓였다 · 창조자 27회 ⓐ5)
    if(DECO_MODE!=='erase'){   // [DECO-PT-2] 치우기 모드에서는 동물도 치운다(전엔 동물을 치울 방법이 없었다)
      const pet=_animAtPt(_ifActiveContainer||'house-topview', mx, my)||_animAt(_ifActiveContainer||'house-topview', r, c);   // [DECO-ANIM-HIT-2] 그려진 몸 먼저
      if(pet && _animPoke(pet, c)) { const pr = _lifePetAnim(pet); _lifeCardOpen(pet, pr); return; }   // [DECO-LIFE-1] 하루 한 마리 하트 +1 · [DECO-LIFE-2] 카드
    }
    //  [DECO-EVENT-1] 계절 행사 장식 — 빈손 · 🧽 면 말 한 줄(치울 수 없다) · 카드를 들었으면 놓기가 먼저(행사가 다른 빈 잔디로 비켜 간다)
    if(!SEL_DECO || DECO_MODE==='erase'){ const ev=_decoEventAt(r,c); if(ev){ _decoEventSay(ev); return; } }
    _decoPlace('yard',r,c);
  } else {
    const {_offX:ox,_offY:oy}=_dCv;
    const c=Math.floor((mx-ox)/C), r=Math.floor((my-oy)/C);
    //  [INDOOR-LOOK-1] 🖌️ 벽지·바닥 — 방(판) 어디를 눌러도, 벽 띠를 눌러도 그 방이 바뀐다
    if(DECO_MODE==='floor'){ if(c>=0&&c<DI.cols&&r>=-1&&r<DI.rows) _inTap(r,c); return; }   // [INDOOR-ROOMS-1] 방 · 벽지 · 바닥
    //  [INDOOR-WALL-1] 벽 띠를 누르면 — 벽걸이 카드를 들었으면 거기(0번 줄)에 건다 · 빈손·🧽 이면 거기 걸린 것을 치운다
    //  판 맨 위 벽 띠 · [INDOOR-ROOMS-1] 방의 벽 띠(그 칸에 가구가 서 있지 않을 때) — 벽 줄(wr)의 벽이다
    const bandCell=_decoCellAt(e.clientX, e.clientY);
    if(bandCell && bandCell.band){
      const wr=bandCell.r;
      if(SEL_DECO && DECO_MODE!=='erase'){
        if(_isWallDeco(SEL_DECO)) _decoPlace('indoor',wr,c);
        else toast('🖼️ 벽에는 액자 같은 벽걸이만 걸 수 있어요');
        return;
      }
      const hung=_decoTopAt('indoor',wr,c,false,true);
      if(hung) _decoRemoveOne(hung);
      return;
    }
    if(c<0||c>=DI.cols||r<0||r>=DI.rows) return;
    _decoLastTap = { area: 'indoor', r, c, t: Date.now() };   // [DECO-DRAG-1]
    _decoPlace('indoor',r,c);
  }
}

// ══ 꾸미기 저장 묶기 (DECO-SAVE-1) ══════════════════════════
//  꾸미기 조작 한 번 = 학생 문서 **통째** 저장이었다(실측: 바닥 20칸 = 20번, 한 번에 평균 26KB → 약 520KB).
//  '무엇을 저장하는지'는 한 글자도 바꾸지 않는다. **'언제' 저장하는지만** 0.4초로 묶는다.
//  대상은 꾸미기 쓰기 3곳뿐(_paintFloor · _decoPlace 놓기/치우기). 골드·상점·전투·농장은 손대지 않는다.
//  잃는 것 0: 아래 자리에서 **즉시 저장(flush)** 한다 —
//   씬 바꿈 · 전체화면 닫기 · 내 집 창 닫기·다른 탭 · 앱 가려짐 · 페이지 닫힘 ·
//   **다른 곳에서 CUR 이 갈릴 때(스냅샷 직전)**.
const DECO_SAVE_MS = 400;
let _decoSaveTimer = null;

function decoDirty() {
  _decoStateVer++;   // [DECO-SEL-HL-1] 놓을 수 있는 칸 모음을 다시 세게
  if (_decoSaveTimer) clearTimeout(_decoSaveTimer);
  _decoSaveTimer = setTimeout(() => { _decoSaveTimer = null; DB.saveStudent(CUR); }, DECO_SAVE_MS);
}

//  대기 중이던 것을 지금 보낸다. 대기 중이 아니면 아무 일도 안 한다(쓰기가 늘지 않는다).
function decoFlush(why) {
  if (!_decoSaveTimer) return false;
  clearTimeout(_decoSaveTimer); _decoSaveTimer = null;
  try { DB.saveStudent(CUR); } catch (e) { console.error('꾸미기 저장 실패(' + why + ')', e); }
  return true;
}

//  [DECO-SHOP-1] 방금 **다른 통째 저장**(마당 안 상점의 구매)이 나갔다 — 대기 중이던 꾸미기 변경은 그 저장에 이미 실려 갔다.
//  대기만 푼다(쓰기 0). 구매 때문에 쓰기가 한 번 더 나가지 않게 — 구매 1번 = 저장 1번(본편 상점과 같다).
function decoSaveAbsorbed() {
  if (_decoSaveTimer) { clearTimeout(_decoSaveTimer); _decoSaveTimer = null; }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) decoFlush('가려짐'); });
  addEventListener('pagehide', () => decoFlush('페이지 닫힘'));
}

// ══ 꾸미기 되돌리기 ↩ 20단계 (DECO-UNDO-1) ═══════════════════
//  마을(3D) 규칙 그대로: 20단계 · **맨 위만** 되돌린다(기록 중간을 고치지 않는다) ·
//  **다시 열면 0단계**(기억에만 — 저장하지 않는다, 저장 형식 변경 0) · 끌어서 죽 놓은 것은 한 단계.
//  골드는 건드리지 않는다 — 장식은 환불이 없고, 가진 개수는 '놓인 수'로 세므로 되돌리면 저절로 맞는다.
//  되돌린 것도 꾸미기 묶음 저장(DECO-SAVE-1)을 탄다 → 되돌리기 때문에 쓰기가 늘지 않는다.
const DECO_UNDO_MAX = 20;
let _decoUndo = [];

function _decoUndoPush(rec) {
  _decoUndo.push(rec);
  if (_decoUndo.length > DECO_UNDO_MAX) _decoUndo.shift();
  _decoUndoSync();
}
function _decoUndoClear() { _decoUndo = []; _decoUndoSync(); }

//  끌어서 죽 놓은 것을 한 단계로(K2 가 쓴다). 빈 목록은 쌓지 않는다.
function decoUndoStroke(list) { if (list && list.length) _decoUndoPush({ t: 'stroke', list }); }

function _decoUndoSync() {
  const b = document.getElementById('if-undo-btn');
  if (!b) return;
  const n = _decoUndo.length;
  b.disabled = !n;
  b.style.opacity = n ? '1' : '.35';
  b.title = n ? '되돌리기 (' + n + ')' : '되돌릴 것이 없어요';
}

//  한 줄을 거꾸로 — 성공하면 true
function _decoUndoOne(rec) {
  if (rec.t === 'place') {
    const list = CUR.houseDecorations || [];
    const i = list.findIndex(p => p.id === rec.p.id && p.area === rec.p.area && p.row === rec.p.row && p.col === rec.p.col
      && _decoSpaceOf(p) === _decoSpaceOf(rec.p));   // [DECO-SPACE-1]
    if (i < 0) return false;
    CUR.houseDecorations = list.slice(0, i).concat(list.slice(i + 1));
    return true;
  }
  if (rec.t === 'remove') {
    const d = GAME_DATA.decorations.find(x => x.id === rec.p.id);
    if (!d) return false;
    const sz = d.size || { w: 1, h: 1 };
    const placed = CUR.houseDecorations || [];
    const used = placed.filter(p => p.id === rec.p.id).length;
    const inv = (CUR.inventory || []).find(x => x.id === rec.p.id);
    if (!inv || inv.qty - used <= 0) return false;
    if (!canPlaceDeco(rec.p.row, rec.p.col, sz.w, sz.h, rec.p.area, null, rec.p.id)) return false;   // [DECO-PT-2]
    CUR.houseDecorations = [...placed, Object.assign({}, rec.p)];   // [DECO-SPACE-1] 공간 번호째 되살린다
    return true;
  }
  if (rec.t === 'floor') {
    const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
    if (rec.prev === undefined) delete fm[rec.key]; else fm[rec.key] = rec.prev;
    return true;
  }
  if (rec.t === 'rooms') {   // [INDOOR-ROOMS-1] 방 만들기·없애기·방 벽지/바닥 — 그 공간의 방 목록을 앞 것으로
    _inRoomsSet(CUR, JSON.parse(rec.prev || '[]'), rec.sp);
    //  [DECO-RULE-R4] 그때 가방으로 간 벽걸이를 제자리에 — 가진 수 안에서, 그 자리가 비어 있을 때만
    (rec.bag || []).forEach(p => {
      const inv = (CUR.inventory || []).find(i => i.id === p.id), used = (CUR.houseDecorations || []).filter(q => q.id === p.id).length;
      if (!inv || inv.qty - used <= 0 || !canPlaceDeco(p.row, p.col, getDecoSize(p.id).w, getDecoSize(p.id).h, 'indoor', null, p.id)) return;
      CUR.houseDecorations = (CUR.houseDecorations || []).concat([Object.assign({}, p)]);
    });
    if (DECO_MODE === 'floor' && DECO_SCENE !== 'yard') _inLookRender();
    return true;
  }
  if (rec.t === 'look') {   // [INDOOR-LOOK-1] 집 안 벽지·바닥 — 그 공간의 글자를 앞 것으로
    _inLookSet(CUR, rec.prev, rec.sp);
    if (DECO_MODE === 'floor' && DECO_SCENE !== 'yard') _inLookRender();
    return true;
  }
  if (rec.t === 'stroke') {
    let ok = false;
    for (let i = rec.list.length - 1; i >= 0; i--) ok = _decoUndoOne(rec.list[i]) || ok;
    return ok;
  }
  return false;
}

function decoUndo() {
  const rec = _decoUndo.pop();
  if (!rec) { toast('되돌릴 것이 없어요'); _decoUndoSync(); return; }
  const ok = _decoUndoOne(rec);
  _decoUndoSync();
  if (!ok) { toast(rec.t === 'remove' ? '↩ 그 자리가 이미 찼어요 — 먼저 치우고 다시 ↩' : '↩ 그건 이미 바뀌어서 되돌릴 게 없었어요'); return; }   // [DECO-WORDS-1]
  decoDirty(); _drawDeco(); renderDecoInv();
  toast('↩ 되돌렸어요');
}

if (typeof document !== 'undefined') {
  //  PC: Ctrl+Z (꾸미기 전체화면이 열려 있을 때만)
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'z' && e.key !== 'Z')) return;
    const fs = document.getElementById('interior-fullscreen');
    if (!fs || fs.style.display === 'none') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault(); decoUndo();
  });
}

// [DECO-RULE-R1R2] 바닥을 칠할 때도 놓을 때의 규칙을 지킨다 — 그 칸에 놓인 것이 새 바닥에 설 수 없으면 그 칸은 안 칠한다.
//  (전엔 물 규칙을 놓을 때만 봐서, 나무를 놓고 발밑을 물로 칠하면 연못 한가운데 나무 · 닭 발밑을 물로 칠하면 물 위에 선 닭이 됐다)
//  · 동물은 그 동물이 다니는 바닥(ANIM_DECO.ground) · 그 밖은 물만 안 된다(갈대·징검돌 DECO_WATER_OK 는 된다) — _decoRuleWhy·_animGroundOk 와 같은 잣대.
//  · 잔디로 되돌리기(지우기)는 누구나 설 수 있어 막지 않는다. 막히는 칸을 되돌리기 줄에 남기지 않는다.
function _floorPaintBlock(r, c, v) {
  const kind = _groundKind(_floorParse(v || 'grass').name);
  for (const p of _decoList(CUR)) {
    if (p.area !== 'yard') continue;
    const z = getDecoSize(p.id);
    if (r < p.row || r >= p.row + z.h || c < p.col || c >= p.col + z.w) continue;
    const a = typeof ANIM_DECO !== 'undefined' && ANIM_DECO[p.id];
    if (a ? a.ground.indexOf(kind) < 0 : (kind === 'water' && !DECO_WATER_OK[p.id])) return p;
  }
  return null;
}
function _floorPaintWhy(p, v, n) {
  const d = GAME_DATA.decorations.find(x => x.id === p.id), nm = d ? d.icon + ' ' + d.name : '장식';
  const water = _groundKind(_floorParse(v).name) === 'water';
  return (water ? '🌊 ' : '🐾 ') + (n > 1 ? `${nm} 등 ${n}개가 있는 칸은` : `${nm}${_josa(d ? d.name : '장식', '이', '가')} 있는 칸은`)
    + ` ${water ? '물로' : '그 바닥으로'} 못 칠해요 — 먼저 옮겨 주세요`;
}

function _paintFloor(r, c, stroke) {
  const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
  const key = r+'_'+c;
  const nextV = fm[key] === CUR_FLOOR_TILE ? undefined : CUR_FLOOR_TILE;   // 같은 타일이면 잔디로
  const blk = nextV !== undefined && _floorPaintBlock(r, c, nextV);   // [DECO-RULE-R1R2]
  if (blk) { toast(_floorPaintWhy(blk, nextV, 1)); return; }
  const undoRec = { t: 'floor', key, prev: fm[key] };   // [DECO-UNDO-1]
  if (stroke) stroke.push(undoRec); else _decoUndoPush(undoRec);
  if(fm[key] === CUR_FLOOR_TILE) {
    delete fm[key]; // 같은 타일이면 기본(잔디)으로
  } else {
    fm[key] = CUR_FLOOR_TILE;
  }
  decoDirty();   // [DECO-SAVE-1] 0.4초 묶기 — 끌어서 칠할 때 칸마다 통째 저장되지 않게
  _drawDeco();
}

//  [DECO-PT-2] 한 칸에 둘이 겹치면(우리 안 동물) 누른 것은 위의 것 — 동물 > 작은 것 > 우리
//  [DECO-PT-3] 다 썼을 때 어느 공간에 몇 개 놓였는지 — "어 왜 모자라지?"
function _decoWhereUsed(id) {
  const by = {};
  (CUR.houseDecorations || []).forEach(p => { if (p.id === id) { const k = _decoSpaceOf(p); by[k] = (by[k] || 0) + 1; } });
  const parts = Object.keys(by).sort().map(k => '공간 ' + k + '에 ' + by[k] + '개');
  return parts.length ? '다 썼어요 — ' + parts.join(', ') + ' 놓여 있어요' : '가진 개수가 모자라요!';
}

// [DECO-ANIM-HIT-1] 동물은 돌아다닌다 — 저장된 자리(놓은 칸)와 **보이는 자리**가 다르다.
//  누른 것을 찾을 때(치우기·스포이드·빈손 누르기)는 보이는 자리로 찾는다. 전에는 놓은 칸으로만 찾아서
//  ① 🧽 치우기로 보이는 강아지를 눌러도 "치울 게 없어요" ② 빈 풀밭(강아지가 놓였던 칸)을 누르면 멀리 있는 강아지가 사라졌다.
//  놓기 막기(canPlaceDeco)는 그대로 놓은 칸 기준이다 — 동물이 돌아올 자리라서.
function _decoAnimState(p) {
  if (!p || p.area !== 'yard' || typeof ANIM_DECO === 'undefined' || !ANIM_DECO[p.id]) return null;
  const rec = _animLayers.get(_ifActiveContainer || 'house-topview');
  return (rec && rec.items.get(p.id + '@' + p.row + '_' + p.col)) || null;
}
//  이 동물이 놓은 칸을 떠나 있나(층이 없으면 — 움직임 끔 등 — 떠난 게 아니다)
function _decoAnimAway(p) {
  const st = _decoAnimState(p);
  return !!st && (st.cur.row !== p.row || st.cur.col !== p.col);
}
//  (r,c) 에 **보이는** 동물의 놓인 기록. 없으면 null
function _decoAnimPlacedAt(area, r, c) {
  if (area !== 'yard') return null;
  const st = _animAt(_ifActiveContainer || 'house-topview', r, c);
  if (!st) return null;
  return _decoList(CUR).find(p => p.area === 'yard' && p.id === st.id && p.row === st.home.row && p.col === st.home.col) || null;
}

function _decoTopAt(area, row, col, seen, band) {
  if (seen) { const pet = _decoAnimPlacedAt(area, row, col); if (pet) return pet; }   // [DECO-ANIM-HIT-1] 보이는 동물 먼저
  const hits = _decoList(CUR).filter(p => {
    if (p.area !== area) return false;
    if (seen && _decoAnimAway(p)) return false;   // 떠나 있는 동물의 빈 자리는 누른 게 아니다
    const sz = getDecoSize(p.id);
    return row >= p.row && row < p.row + sz.h && col >= p.col && col < p.col + sz.w;
  });
  const rank = p => (area === 'indoor' && _isWallDeco(p.id)) ? (band ? -1 : 3)   // [INDOOR-WALL-1] 벽 띠를 눌렀으면 벽걸이 · 바닥 칸이면 그 앞 가구 먼저
    : (typeof ANIM_DECO !== 'undefined' && ANIM_DECO[p.id]) ? 0 : (_isPenDeco(p.id) || _isRugDeco(p.id)) ? 2 : 1;   // [INDOOR-RUG-1] 깔개는 맨 아래
  if (band) return hits.filter(p => _isWallDeco(p.id)).sort((a, b) => rank(a) - rank(b))[0] || null;   // 벽 띠에는 벽걸이만 걸려 있다
  hits.sort((a, b) => rank(a) - rank(b));
  return hits[0] || null;
}

// [DECO-RCLICK-1] 놓인 것 하나 치우기 — 빈손 누르기·🧽 치우기·마우스 오른쪽 클릭이 다 이 한 곳을 쓴다.
//  치운 것은 **가방으로 돌아간다**(가진 개수는 '놓인 수'로 세니 저절로 +1 · 골드는 어떤 치우기에서도 안 움직인다).
//  전 알림("제거됨")은 아이에게 '없어졌다'로 읽혔다 → 잃지 않았다는 것과 되돌리는 길을 말해 준다. 확인 창은 안 띄운다.
function _decoRemoveOne(ex) {
  const d = GAME_DATA.decorations.find(x => x.id === ex.id);
  CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p !== ex);
  _decoUndoPush({ t: 'remove', p: Object.assign({}, ex) });   // [DECO-UNDO-1]
  decoDirty(); _drawDeco(); renderDecoInv();                   // [DECO-SAVE-1]
  toast(`🎒 ${d ? d.icon + ' ' + d.name : '장식'} — 가방으로 돌아갔어요 (↩ 되돌리기)`);
}

//  마우스 오른쪽 **클릭**(안 끌고 뗌) = 그 자리 위의 것 하나 치우기. 오른쪽 **끌기**는 지금처럼 화면 이동(DECO-PAN-1).
//  터치에는 오른쪽 클릭이 없다 — 터치는 🧽 치우기·빈손 누르기 그대로(pointerType 으로 그때그때 가린다, 설정 없음).
function _decoRightClickAt(clientX, clientY) {
  const cell = _decoCellAt(clientX, clientY);
  if (!cell) return false;
  let ex = _decoTopAt(cell.area, cell.r, cell.c, true, cell.band);   // [INDOOR-WALL-1]
  if (ex && !cell.band && _decoOnWallFloor(ex, cell.area)) ex = null;   // 액자 아래 빈 바닥
  if (ex) { _decoRemoveOne(ex); return true; }
  if (DECO_MODE === 'floor' && cell.area === 'yard') {          // 바닥 모드면 칠한 바닥 한 칸을 걷어 낸다(↩ 됨)
    const fm = _yardFloorGet(CUR), key = cell.r + '_' + cell.c;
    if (fm[key] !== undefined) {
      _decoUndoPush({ t: 'floor', key, prev: fm[key] });
      delete _yardFloorMap(CUR)[key];
      decoDirty(); _drawDeco();
      return true;
    }
  }
  toast('여기엔 치울 게 없어요');
  return false;
}

// [DECO-WORDS-1] 아이가 읽는 말이 실제와 맞게 — docs/deco_commercial_plan.md §2 M1~M9
//  고를 것이 없을 때: 가진 게 아예 없으면 상점으로, 이 장소 것만 없으면 그렇게, 있으면 서랍에서 고르라고
function _decoPickFirstWhy(area) {
  const have = (CUR.inventory || []).filter(i => { const d = GAME_DATA.decorations.find(x => x.id === i.id); return d && i.qty > 0; });
  if (!have.length) return '🛒 아직 가진 장식이 없어요 — 아래 🛒 상점에서 골라 봐요';
  if (!have.some(i => (GAME_DATA.decorations.find(x => x.id === i.id) || {}).cat === area))
    return (area === 'yard' ? '🌿 마당' : '🏠 집 안') + '에 놓을 장식이 없어요 — 🛒 상점에서 골라 봐요';
  return '👇 아래에서 놓을 장식을 먼저 골라요';
}
//  놓을 수 없는 까닭 — 판 끝 · 집 · 밭 · 걸리는 장식 순
function _decoCantWhy(r, c, w, h, area) {
  const R = area === 'yard' ? DY : DI;
  if (r + h > R.rows || c + w > R.cols) return '판 끝이라 다 안 들어가요 — 조금 안쪽에 놓아 봐요';
  if (area === 'yard') for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
    if (_isHC(r + dr, c + dc)) return '🏠 집에 걸려요 — 집 밖에 놓아요';
    if (_isFarmCell(r + dr, c + dc)) return '🌾 밭에 걸려요 — 밭 밖에 놓아요';
  }
  const b = _decoBlockerAt(r, c, w, h, area, SEL_DECO), d = b && GAME_DATA.decorations.find(x => x.id === b.id);
  if (d) return `${d.icon} ${d.name}에 걸려요 — 빈 곳에 놓아요`;
  return '여기엔 놓을 수 없어요';
}

//  [INDOOR-WALL-1] 0번 줄 바닥 칸을 눌렀는데 맨 위 것이 벽에 건 것뿐 = 그림은 한 칸 위 벽 띠에 있다(바닥은 비어 보인다)
function _decoOnWallFloor(p, area) { return area === 'indoor' && p && _isWallDeco(p.id) && _inIsWallRow(p.row, p.col); }
function _decoPlace(area,row,col){
  const placed=CUR.houseDecorations||[];
  if(DECO_MODE==='erase'){   // [DECO-PT-2] 🧽 치우기 — 누른 칸의 위의 것 하나를 치운다(카드는 안 씀)
    let ex=_decoTopAt(area,row,col,true);   // [DECO-ANIM-HIT-1] 동물은 보이는 자리로
    if(ex && _decoOnWallFloor(ex, area)) ex=null;   // [INDOOR-WALL-1] 액자는 벽에 걸려 있다 — 그 아래 빈 바닥을 누른 것이다
    if(!ex){ toast('여기엔 치울 게 없어요'); return; }
    _decoRemoveOne(ex); return;
  }

  // 클릭한 칸에 있는 장식 찾기 (멀티셀 고려) — [DECO-SPACE-1] 이 공간 것만 · [DECO-PT-2] 겹치면 위의 것
  let existing=_decoTopAt(area,row,col);
  if(existing && !SEL_DECO && _decoOnWallFloor(existing, area)) existing=null;   // [INDOOR-WALL-1] 빈손으로 액자 아래 빈 바닥 — 액자를 치우지 않는다
  //  [DECO-PT-2] 카드를 든 채 누르면 치우지 않는다("꽃 놓으려는데 나무가 사라졌어") — 치우기는 빈손·🧽 치우기 모드에서만
  if(existing && SEL_DECO && DECO_MODE!=='erase'){
    if(!canPlaceDeco(row,col,(getDecoSize(SEL_DECO)).w,(getDecoSize(SEL_DECO)).h,area,null)){
      //  [INDOOR-RUG-1] 누른 칸 맨 위 것이 아니라 **정말 막는 것**의 이름을 말한다(러그 위 소파를 누르고 러그를 놓으려 할 때 막는 건 밑의 러그다)
      const blk=(area==='indoor' && _decoBlockerAt(row,col,(getDecoSize(SEL_DECO)).w,(getDecoSize(SEL_DECO)).h,area,SEL_DECO)) || existing;
      const ed=GAME_DATA.decorations.find(x=>x.id===blk.id);
      //  [DECO-ANIM-HIT-1] 동물이 떠나 있으면 "이미 강아지가 있어요"는 눈에 보이는 것과 다르다
      if(_decoAnimAway(existing)){ toast(`여기는 ${ed?ed.icon+' '+ed.name:'동물'} 자리예요(돌아올 곳) — 옆 칸에 놓아 보세요`); return; }
      toast(`여기엔 이미 ${ed?ed.icon+' '+ed.name:'장식'}${_josa(ed?ed.name:'장식','이','가')} 있어요 — 치우려면 🧽 치우기`); return;   // [DECO-WORDS-1]
    }
  } else if(existing && _decoAnimAway(existing)){
    //  [DECO-ANIM-HIT-1] 빈 풀밭을 눌렀는데 멀리 있는 동물이 사라지던 것 — 여기는 그 동물이 돌아올 자리일 뿐이다
    const d=GAME_DATA.decorations.find(x=>x.id===existing.id);
    toast(`여기는 ${d?d.icon+' '+d.name:'동물'} 자리예요 — 치우려면 🧽 치우기를 켜고 그 동물을 누르세요`); return;
  } else if(existing){
    _decoRemoveOne(existing); return;   // [DECO-SPACE-1] 그 한 개만(다른 공간 같은 자리 것은 그대로)
  }
  if(!SEL_DECO){ toast(_decoSelOffWhy() || _decoPickFirstWhy(area)); return; }   // [DECO-SEL-A5] 방금 내려놓았으면 그 까닭 · [DECO-WORDS-1]
  const d=GAME_DATA.decorations.find(x=>x.id===SEL_DECO);
  if(!d) return;
  if(d.cat!==area){ toast(`이 장식은 ${d.cat==='yard'?'🌿 마당':'🏠 집 안'}에만 놓을 수 있어요`); return; }   // [DECO-WORDS-1]
  const sz=d.size||{w:1,h:1};
  const used=placed.filter(p=>p.id===SEL_DECO).length;
  const inv=(CUR.inventory||[]).find(i=>i.id===SEL_DECO);
  if(!inv||inv.qty-used<=0){ toast(_decoWhereUsed(SEL_DECO)); return; }   // [DECO-PT-3]
  if(!canPlaceDeco(row,col,sz.w,sz.h,area,null)){ toast(_decoCantWhy(row,col,sz.w,sz.h,area)); return; }   // [DECO-WORDS-1] 까닭을 말한다
  const why=_decoRuleWhy(SEL_DECO,area,row,col,sz.w,sz.h); if(why){ toast(why); return; }   // [DECO-PT-2]
  // [DECO-ANIM-2] 동물은 바닥을 가린다 — 왜 안 되는지 아이 말로 알려 준다
  if(area==='yard' && ANIM_DECO[SEL_DECO] && !_animGroundOk(SEL_DECO, CUR, row, col, sz.w, sz.h)){
    toast(_animWhyNot(SEL_DECO)); return;
  }
  const np=_decoNew(SEL_DECO,area,row,col);   // [DECO-SPACE-1]
  CUR.houseDecorations=[...placed,np];
  _decoUndoPush({ t: 'place', p: Object.assign({}, np) });   // [DECO-UNDO-1]
  _decoRecentAdd(SEL_DECO);   // [DECO-FIND-1]
  //  [DECO-SEL-A5] 마지막 하나를 놓았으면 카드를 내려놓는다 — 든 채로 두면 다음 누름(동물 쓰다듬기 등)이 '또 놓기'로 읽혔다
  const out = _decoLeft(SEL_DECO) <= 0;
  if (out) SEL_DECO = null;
  decoDirty(); _drawDeco(); renderDecoInv();   // [DECO-SAVE-1]
  toast(`✅ ${d.icon} ${d.name}${_josa(d.name,'을','를')} 놓았어요` + (out ? ' — 다 놓아서 카드를 내려놓았어요' : ''));   // [DECO-WORDS-1] '배치'는 어른 말 · [DECO-SEL-A5]
}

function toggleDecoScene(){
  decoFlush('씬 바꿈');   // [DECO-SAVE-1]
  _decoUndoClear();   // [DECO-UNDO-1] 안 보이는 씬의 것을 되돌리지 않게
  if (DECO_SCENE === 'yard') _decoViewSave();   // [DECO-PT-1] 마당에서 보던 자리를 기억해 두고
  DECO_SCENE=DECO_SCENE==='yard'?'indoor':'yard';
  SEL_DECO=null;
  _dZoom=1; _dPanX=0; _dPanY=0;   // [DECO-ZOOM-1]
  const isYard=DECO_SCENE==='yard';
  // 일반 모드 UI
  const sBtn = document.getElementById('deco-scene-btn');
  const sName = document.getElementById('deco-scene-name');
  const iLabel = document.getElementById('deco-inv-label');
  if(sBtn)   sBtn.textContent  = isYard?'🏠 집 안으로 →':'🌿 마당으로 ←';
  if(sName)  sName.textContent = isYard?'🌿 마당':'🏠 집 안';
  if(iLabel) iLabel.textContent= isYard?'🎒 내 장식품':'🎒 내 장식품 (집 안)';
  _dCv=null; _dCtx=null;
  renderHouseDeco();
  if (DECO_SCENE === 'yard') _decoViewRestore();   // [DECO-PT-1] 마당으로 돌아오면 그 자리로
  else if (_ifMode) _decoIndoorStart();           // [DECO-PHONE-INDOOR-1] 폰이면 집 안도 크게 · [INDOOR-ROOMS-1] 방이 있으면 방 둘레로
  if(_ifMode) ifSyncScene();
  toast(isYard?'🌿 마당이에요! 위쪽 집 문을 누르면 들어가요.':'🏠 집 안이에요! 나가기 문으로 마당에 나가요.');
}

// ══ 장식 찾기 (DECO-FIND-1) — 이 장소만 · 이름 검색 · 최근 놓은 것 · 서랍 펼치기 ══
//  거르기만 한다 — 값·가진 개수·놓기 규칙은 손대지 않는다. 기억은 기기에만(localStorage, DB 쓰기 0).
const _decoFind = { sceneOnly: true, q: '' };
const DECO_RECENT_KEY = 'rpg.deco.recent', DECO_RECENT_MAX = 8;

function _decoRecentGet() {
  try { const a = JSON.parse(localStorage.getItem(DECO_RECENT_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function _decoRecentAdd(id) {
  try {
    const a = _decoRecentGet().filter(x => x !== id);
    a.unshift(id);
    localStorage.setItem(DECO_RECENT_KEY, JSON.stringify(a.slice(0, DECO_RECENT_MAX)));
  } catch (e) {}
}

//  이 장식이 지금 목록에 보여야 하나 — 순수 함수(시험용)
function _decoFindMatch(d, scene, f) {
  if (!d) return false;
  if (f.sceneOnly && d.cat !== scene) return false;
  const q = (f.q || '').trim();
  if (q && String(d.name || '').indexOf(q) < 0) return false;
  return true;
}

function decoFindSet(key, val) {
  if (key === 'q' && DECO_TAB === 'shop') {   // [DECO-SHOP-1] 찾기 글은 탭마다 따로
    _decoShop.q = val;
    const c = document.getElementById('if-deco-search-clear'); if (c) c.hidden = !(val || '').length;
    _decoShopRender(); return;
  }
  if (key === 'sceneOnly') _decoFind.sceneOnly = !_decoFind.sceneOnly;
  else _decoFind[key] = val;
  const chip = document.getElementById('if-deco-scene-only');
  if (chip) { chip.classList.toggle('is-on', _decoFind.sceneOnly); chip.setAttribute('aria-pressed', String(_decoFind.sceneOnly)); }
  const clr = document.getElementById('if-deco-search-clear');
  if (clr) clr.hidden = !(_decoFind.q || '').length;
  renderDecoInv();
}

// [DECO-THUMB-2] 오른쪽 확대 단추 기둥이 서랍을 펼치면 서랍 위로 겹쳤다 → 늘 서랍 바로 위에 붙인다
// [DECO-PAN-1] 한 손가락 끌기가 화면 이동이 되는 건 '카드를 안 골랐고 바닥 모드가 아닐 때'뿐이다.
//  아이는 이 기준을 모른다(카드는 놓은 뒤에도 계속 잡혀 있다) → 막혀 있을 때만 ✋ 단추를 보여 준다.
function _decoHandSync() {
  const b = typeof document !== 'undefined' && document.getElementById('if-hand-btn');
  //  [INDOOR-LOOK-1] 집 안 벽지·바닥에서는 한 손가락 끌기가 이미 화면 이동이라 ✋ 가 필요 없다
  const blocked = DECO_MODE === 'floor' ? (DECO_SCENE === 'yard' || _inRoomDragMode()) : !!SEL_DECO;   // [INDOOR-ROOMS-1]
  if (b) b.style.display = blocked ? 'flex' : 'none';
}
function decoHand() {
  if (_inRoomDragMode()) { _inPk.tab = 'wall'; _inLookRender(); }   // [INDOOR-ROOMS-1] 방 네모 끌기에서 손을 비우면 벽지 탭(한 손가락 = 화면 이동)
  if (DECO_MODE === 'floor') { setDecoMode('deco'); if (typeof ifSyncModeBtn === 'function') ifSyncModeBtn(); }
  SEL_DECO = null;
  if (typeof renderDecoInv === 'function') renderDecoInv();
  _drawDeco();
  toast('✋ 손을 비웠어요 — 이제 한 손가락으로 끌면 화면이 움직여요');
}

function _decoPillarSync() {
  //  [DECO-PT-4] 기둥 위치는 CSS 변수 하나(--deco-drawer-h)로. 서랍이 아직 안 보일 때(높이 0) 재면
  //  기둥이 서랍 머리줄(⌃ 펼치기)을 덮었다 → 보일 때만 값을 바꾸고, 안 보이면 이전 값(기본 220px)을 둔다.
  const fs = document.getElementById('interior-fullscreen');
  const pk = document.getElementById('if-floor-picker');   // [DECO-FLOOR-PICK-1] 바닥 모드면 서랍 자리 = 바닥 고르기 판
  const dr = (pk && !pk.hidden && DECO_MODE === 'floor') ? pk : document.getElementById('if-deco-drawer');
  if (!fs || !dr) return;
  //  [DECO-SHORT-1] 판 자리의 위 끝(윗줄 + 바닥 줄) — 기둥이 그 위로 못 올라가게(CSS max-height 가 쓴다)
  const host = document.getElementById('if-topview');
  if (host && fs.style.display !== 'none' && host.offsetTop > 0) fs.style.setProperty('--deco-host-top', host.offsetTop + 'px');
  const shown = fs.style.display !== 'none' && dr.offsetParent !== null;
  const h = shown ? dr.offsetHeight : 0;
  if (h > 0) fs.style.setProperty('--deco-drawer-h', h + 'px');
  else if (fs.style.display !== 'none' && dr.offsetParent === null) fs.style.setProperty('--deco-drawer-h', '0px');   // 바닥 모드(서랍 숨김)
}
if (typeof window !== 'undefined') addEventListener('resize', () => { try { _decoPillarSync(); } catch (e) {} });

function decoDrawerToggle() {
  const dr = document.getElementById('if-deco-drawer'); if (!dr) return;
  const open = !dr.classList.contains('is-open');
  dr.classList.toggle('is-open', open);
  const b = document.getElementById('if-deco-expand');
  if (b) { b.textContent = open ? '⌄' : '⌃'; b.setAttribute('aria-label', open ? '서랍 접기' : '서랍 펼치기'); }
  _decoPillarSync();
  _decoFit();   // [DECO-FIT-1]
}

// [DECO-THUMB-1] 카드에 실제 그림 — 이모지로는 뭔지 모른다("울타리 샀는데 공사 표지판이야?")
//  울타리처럼 자동 이음인 것은 가로 그림으로 보여 준다. 그림이 없으면 이모지로 돌아간다.
//  [DECO-THUMB-2] 그림 파일은 위쪽이 비어 있다(1×1 은 위 절반) → 통째로 맞추면 실제 그림이 15~20px.
//  디자인 2 가 잰 '그린 부분 상자'(assets/deco/bbox.json, [x,y,w,h,vbW,vbH])로 그 부분만 크게 보인다.
//  표가 아직 없거나 그 장식이 표에 없으면 예전처럼 통째로.
let _decoBBox = null;
if (typeof fetch === 'function') {
  fetch('./assets/deco/bbox.json').then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return;
    _decoBBox = j;
    try { if (typeof renderDecoInv === 'function' && CUR) renderDecoInv(); } catch (e) {}
    try { if (typeof SHOP_TAB !== 'undefined' && SHOP_TAB === 'deco' && typeof renderShop === 'function' && CUR) renderShop(); } catch (e) {}
  }).catch(() => {});
}

function _decoThumb(d, px) {
  const id = d.autoFence ? 'd_y49' : d.id;
  const emo = escHtml(d.icon || '🌸');
  const src = _artSrc('deco/' + id + '.svg');   // [DECO-BUNDLE-1] 받는 중이면 잠깐 이모지 — 오면 서랍을 다시 그린다
  if (src === null) return `<span style="font-size:${Math.round(px * 0.8)}px;display:block;text-align:center">${emo}</span>`;
  const onerr = ` onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${emo}',style:'font-size:${Math.round(px * 0.8)}px'}))"`;
  //  썸네일 전용 그림(bbox.json 의 thumbArt 목록에 있으면 <id>_thumb.svg 를 통째로)
  if (_decoBBox && Array.isArray(_decoBBox.thumbArt) && _decoBBox.thumbArt.indexOf(id) >= 0) {
    return `<img class="deco-thumb" src="${_artSrc('deco/' + id + '_thumb.svg')}" alt="" loading="lazy"`
      + ` style="height:${px}px;width:auto;max-width:${Math.round(px * 1.6)}px;object-fit:contain;display:block;margin:0 auto"${onerr}>`;
  }
  const bb = _decoBBox && _decoBBox[id];
  if (Array.isArray(bb) && bb[2] > 0 && bb[3] > 0) {
    const [x, y, w, h, vw, vh] = bb;
    const maxW = Math.round(px * 1.6);
    const sc = Math.min(px / h, maxW / w);
    const bw = Math.round(w * sc), bh = Math.round(h * sc);
    return `<span class="deco-thumb-box" style="display:block;width:${bw}px;height:${bh}px;overflow:hidden;margin:0 auto;position:relative">`
      + `<img class="deco-thumb" src="${src}" alt="" loading="lazy"${onerr}`
      + ` style="position:absolute;left:${-Math.round(x * sc)}px;top:${-Math.round(y * sc)}px;width:${Math.round(vw * sc)}px;height:${Math.round(vh * sc)}px;max-width:none"></span>`;
  }
  return `<img class="deco-thumb" src="${src}" alt="" loading="lazy"`
    + ` style="height:${px}px;width:auto;max-width:${Math.round(px * 1.6)}px;object-fit:contain;display:block;margin:0 auto"${onerr}>`;
}

function _decoCardHtml(i, d, avail, placedScene) {
  const RL = {common:'⚪',rare:'🔵',epic:'🟣',legend:'🟡'};
  const isSel = SEL_DECO === i.id, isMatch = d.cat === placedScene, rl = RL[d.rarity||'common'] || '';
  const where = avail <= 0 ? _decoPlacedWhere(i.id) : '';   // [DECO-SHOP-BAG-1] 다 놓았으면 어디에 몇 개
  return `<div class="deco-card${isSel?' is-sel':''}${where?' is-placed-out':''}" data-deco-id="${i.id}" data-cat="${d.cat}" onclick="selectDeco('${i.id}')" style="
      background:${isSel?'rgba(255,215,0,.18)':'rgba(255,255,255,.05)'};
      border:2px solid ${isSel?'var(--gold)':isMatch?'rgba(255,255,255,.15)':'rgba(255,255,255,.06)'};
      border-radius:10px;padding:.35rem .45rem;cursor:${avail>0||where?'pointer':'default'};flex-shrink:0;
      text-align:center;opacity:${avail>0?isMatch?1:.45:where?.6:.25};min-width:64px;max-width:92px;transition:all .2s;
      transform:${isSel?'scale(1.06)':'scale(1)'}">
      <div style="height:36px;display:flex;align-items:flex-end;justify-content:center">${_decoThumb(d, 34)}</div>
      <div class="dc-name" style="color:var(--txt2);margin-top:.1rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;word-break:keep-all">${rl} ${escHtml(d.name)}</div>
      <div class="dc-qty"${where?` title="${escHtml(where)}개 놓여 있어요"`:''}>${d.cat==='yard'?'🌿':'🏠'} ${where?`<span class="dc-where">${escHtml(where)}</span>`:'×'+avail}</div>
    </div>`;
}

function renderDecoInv(){
  const placed=CUR.houseDecorations||[];
  const inv=(CUR.inventory||[]).filter(i=>GAME_DATA.decorations.find(d=>d.id===i.id));
  const el=document.getElementById('house-deco-inv');
  _decoShopSync();   // [DECO-SHOP-1] 골드 배지 · 손끝 그림 끝내기 · 씬이 바뀌었으면 상점 목록도
  _decoRenderQuick(inv, placed);   // [DECO-FIND-1] 최근 놓은 것 줄
  if(!inv.length){
    //  [DECO-FIRST-1] 처음 아이 — 작은 글 한 줄 대신 누를 곳 하나를 크게(계획 U3). 누르면 서랍이 🛒 상점으로
    el.innerHTML = _ifMode
      ? `<button class="deco-first-card" onclick="decoTab('shop')"><span class="dfc-ico">🛒</span><span class="dfc-txt"><b>첫 장식 골라 보기</b><small>골드로 사서 ${DECO_SCENE === 'yard' ? '마당' : '집 안'}에 놓아요</small></span></button>`
      : `<div style="font-size:.78rem;color:var(--txt3)">가진 장식품이 없어요. 위의 🛒 상점에서 사 보세요!</div>`;
    if(_ifMode) ifSyncInv();
    return;
  }
  //  [DECO-FIND-1] 이 장소만 · 이름 검색으로 거른다(값·개수·놓기 규칙은 그대로)
  let hidden = 0;
  const shown = inv.filter(i => {
    const d = GAME_DATA.decorations.find(x => x.id === i.id);
    const ok = _decoFindMatch(d, DECO_SCENE, _decoFind);
    if (!ok) hidden++;
    return ok;
  });
  //  [DECO-SHOP-1] 방금 산 것은 골라져 있는 동안 맨 앞에(서랍 끝에 붙으면 크롬북 한 줄 서랍에서 안 보인다)
  if (_decoShop.front && SEL_DECO === _decoShop.front) shown.sort((a, b) => (b.id === SEL_DECO) - (a.id === SEL_DECO));
  else _decoShop.front = null;
  el.innerHTML = shown.map(i => {
    const d = GAME_DATA.decorations.find(x => x.id === i.id); if (!d) return '';
    const avail = i.qty - placed.filter(p => p.id === i.id).length;
    return _decoCardHtml(i, d, avail, DECO_SCENE);
  }).join('');
  const empty = document.getElementById('if-deco-empty');
  if (empty) {
    if (!shown.length) {
      empty.hidden = false;
      empty.textContent = (_decoFind.q || '').trim()
        ? '"' + _decoFind.q.trim() + '" 이름인 장식이 없어요'
        : (DECO_SCENE === 'yard' ? '마당에 놓을 장식이 없어요' : '집 안에 놓을 장식이 없어요') + ' — "이 장소만"을 끄면 다 보여요';
    } else empty.hidden = true;
  }
  if(_ifMode) ifSyncInv();
  _decoPillarSync();   // [DECO-THUMB-2] 서랍 키가 바뀌면 기둥도
}

//  [DECO-SEL-A5] 창 폭이 901px 을 넘나들면 최근 칩 ↔ 최근 줄을 바꿔 그린다
if (typeof matchMedia === 'function') { try { matchMedia('(min-width:901px)').addEventListener('change', () => { if (_ifMode) renderDecoInv(); }); } catch (e) {} }
//  최근 놓은 것 줄 — 지금 장소에 놓을 수 있고 아직 남은 것만. 비면 줄을 감춘다.
function _decoRenderQuick(inv, placed) {
  const q = document.getElementById('if-deco-quick'); if (!q) return;
  const byId = {}; inv.forEach(i => { byId[i.id] = i; });
  const cards = [], ids = [];
  for (const id of _decoRecentGet()) {
    const i = byId[id]; const d = GAME_DATA.decorations.find(x => x.id === id);
    if (!i || !d || d.cat !== DECO_SCENE) continue;
    const avail = i.qty - placed.filter(p => p.id === id).length;
    if (avail <= 0) continue;
    cards.push(_decoCardHtml(i, d, avail, DECO_SCENE)); ids.push({ i, d, avail });
  }
  //  [DECO-SEL-A5] 머리줄이 한 줄인 넓은 화면(901px~)은 머리줄 안 칩으로 — 서랍 키가 안 변한다
  const qh = document.getElementById('if-deco-quick-head');
  const wide = !!qh && typeof matchMedia === 'function' && matchMedia('(min-width:901px)').matches;
  if (qh) {
    const chips = !wide ? [] : ids.map(({ i, d, avail }) => `<button class="deco-qchip${SEL_DECO === i.id ? ' is-sel' : ''}" data-deco-id="${i.id}" onclick="selectDeco('${i.id}')"`
      + ` title="${escHtml(d.name)} ×${avail}" aria-label="최근 ${escHtml(d.name)} ${avail}개">${_decoThumb(d, 26)}<span>×${avail}</span></button>`);
    qh.hidden = !chips.length;
    qh.innerHTML = chips.length ? '<span class="deco-quick-label">🕘</span>' + chips.join('') : '';
  }
  q.hidden = wide || !cards.length;
  q.innerHTML = !wide && cards.length ? '<span class="deco-quick-label">🕘 최근</span>' + cards.join('') : '';
}

// [DECO-SEL-A5] 고름 풀기 — 창조자 27회 ⓐ5 '쓰다듬으려다 또 놓임' · ⓑ59 '먼저 고르세요인데 방금 골랐음'
//  카드는 ① 같은 카드 다시 누름 ② Escape ③ 마지막 하나를 놓음 ④ ×0 카드 누름 에서 내려놓는다.
//  방금 내려놓았는데 판을 누르면(아이는 '또 놓으려고' 누른다) "먼저 고르세요" 대신 까닭을 말한다.
let _decoSelOff = null;   // { id, t } — 마지막으로 내려놓은 카드와 때
function _decoLeft(id) {
  const iv = (CUR.inventory || []).find(x => x.id === id);
  return iv ? iv.qty - (CUR.houseDecorations || []).filter(p => p.id === id).length : 0;
}
function _decoSelClear(say) {
  if (!SEL_DECO) return;
  const d = GAME_DATA.decorations.find(x => x.id === SEL_DECO);
  _decoSelOff = { id: SEL_DECO, t: Date.now() };
  SEL_DECO = null;
  _drawDeco(); renderDecoInv();
  if (say) toast(`${d ? d.icon + ' ' : ''}카드를 내려놓았어요 — 또 놓으려면 카드를 한 번 더 눌러요`);
}
function _decoSelOffWhy() {
  const o = _decoSelOff;
  if (!o || Date.now() - o.t > 10000) return '';
  const d = GAME_DATA.decorations.find(x => x.id === o.id);
  return `${d ? d.icon + ' ' + d.name + ' ' : ''}카드를 내려놓아서 놓지 않았어요 — 또 놓으려면 카드를 한 번 더 눌러요`;
}
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !_ifMode || !SEL_DECO) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // 찾기 칸의 Escape 는 그 칸 몫
  _decoSelClear(true);
});

function selectDeco(id){
  //  [DECO-SHOP-BAG-1] 다 놓아서 ×0 인 카드 = 고르지 않고 놓인 그것을 보여 준다('산 게 없어졌다'로 보이지 않게)
  if (SEL_DECO !== id) {
    const iv = (CUR.inventory || []).find(x => x.id === id), n = (CUR.houseDecorations || []).filter(p => p.id === id).length;
    if (iv && n > 0 && iv.qty - n <= 0) { if (SEL_DECO) _decoSelClear(); _decoFlashPlaced(id); return; }   // [DECO-SEL-A5] 든 카드도 내려놓는다
  }
  if (DECO_MODE === 'erase') { setDecoMode('deco'); ifSyncModeBtn(); }   // [DECO-PT-2]
  if (SEL_DECO === id) { _decoSelClear(true); return; }   // [DECO-SEL-A5] 같은 카드를 다시 누름 = 내려놓기(말로 알린다)
  SEL_DECO=id;
  _decoSelOff = null;
  _drawDeco(); renderDecoInv();
  if(SEL_DECO){
    const d=GAME_DATA.decorations.find(x=>x.id===id);
    if(d&&d.cat!==DECO_SCENE) toast(`${d.icon} 이 장식은 ${d.cat==='yard'?'🌿 마당':'🏠 집 안'} 전용이에요!`);
    else toast(`${d?.icon} 골랐어요 — 놓을 칸을 누르세요 · 화면 옮기기는 두 손가락 또는 ✋`);   // [DECO-PAN-1]   // [DECO-PT-1] 폰·태블릿은 '클릭'이 아니다
  }
}
// ══ 마당 안 상점 (DECO-SHOP-1) — 서랍에 [🎒 내 것 | 🛒 상점] ═══════════════
//  화면 규칙: docs/deco_shop_home_screens_20260920.md ①. 꾸미는 화면을 떠나지 않고 산다.
//  🔴 **사는 길은 새로 만들지 않았다** — 값(`decoCost`·무료 기간)·골드 차감·인벤토리 +1·저장·지출 기록은 전부 본편 상점의
//     `buyDeco()` 가 한다. 여기는 ①무엇을 보여 줄지 ②살 수 있는지(본편 상점 카드와 같은 조건)만 본다.
//     본편 상점은 '살 수 없는 것'을 **카드를 안 그려서** 막는다(`price>0 && !hidden` · 레벨 잠금은 카드의 onclick).
//     `buyDeco()` 자체에는 그 검사가 없다 → `_decoShopState()` 가 'ok' 가 아니면 절대 부르지 않는다.
//  ↩ 되돌리기에 '사기'는 **넣지 않았다**(환불 없음 — DECO-UNDO-1 의 '골드는 건드리지 않는다' 그대로). 까닭은 PR 본문.
//  상점 카드는 🛒 를 처음 누를 때 만든다(꾸미기를 여는 값 0).
let DECO_TAB = 'own';
const DECO_SHOP_TWICE = 200;      // 이 값 이상은 '한 번 더 눌러 사기'
//  도감 선물 카드(값 0 · gift 필드)는 **도감 코드가 붙은 뒤에** 켠다 — 지금 보여 주면 받을 길이 없는 약속이 된다.
let DECO_SHOP_GIFTS = false;
const _decoShop = { kind: 'all', q: '', sel: null, armedAt: 0, front: null, scene: '', scroll: { own: 0, shop: 0 } };
//  분류 칩 — 표에 kind 가 있으면 그 값, 아직 없는 옛 장식은 놓는 방식 전수표(docs/deco_place_table.md)의 kind.
//  길·울타리는 소품 칩에(화면 규칙). 표에 kind 가 다 들어오면 이 목록은 지운다.
const DECO_SHOP_KINDS = [['all', '전체'], ['tree', '🌳 나무'], ['plant', '🌷 꽃·풀'], ['animal', '🐾 동물'], ['building', '🏠 건물'],
  ['water', '💧 물'], ['prop', '🪑 소품'], ['furniture', '🛋️ 가구'], ['decor', '🖼️ 장식']];
const _DECO_KIND_OLD = {
  tree: 'd_y9 d_y12 d_y19 d_y46 d_y47 d_y48 d_y64',
  plant: 'd_y1 d_y2 d_y3 d_y7 d_y15 d_y16 d_y21 d_y25 d_y29 d_y35 d_y36 d_y41 d_y42 d_y43 d_y44 d_y45',
  animal: 'd_y32 d_y39 d_y40 d_y53 d_y54 d_y55 d_y56 d_y57 d_y58 d_y60 d_y62 d_y69',
  building: 'd_y11 d_y17 d_y27 d_y28 d_y33 d_y34 d_y63 d_y66 d_y67 d_y68',
  water: 'd_y10 d_y20 d_y31 d_y59',
  furniture: 'd_i5 d_i6 d_i7 d_i8 d_i9 d_i10 d_i11 d_i12 d_i14 in_table_long in_chair_front in_chair_back',   // [DECO-INDOOR-ITEMS-1] 긴 탁자·의자
};
let _decoKindMap = null;
function _decoShopKind(d) {
  if (!_decoKindMap) { _decoKindMap = {}; for (const k in _DECO_KIND_OLD) _DECO_KIND_OLD[k].split(' ').forEach(id => { _decoKindMap[id] = k; }); }
  const k = d.kind || _decoKindMap[d.id];
  if (d.cat === 'indoor') return k === 'furniture' ? 'furniture' : 'decor';
  return ['tree', 'plant', 'animal', 'building', 'water'].indexOf(k) >= 0 ? k : 'prop';
}

const _decoCostOf = d => GAME_DATA.decoCost ? GAME_DATA.decoCost(d) : d.price;
const _decoQtyOf = id => { const i = (CUR.inventory || []).find(x => x.id === id); return i ? i.qty : 0; };
const _decoShopName = d => String(d.name || '').replace(/\s*\((선물|업적)\)\s*$/, '');

//  살 수 있나 — 본편 상점 카드와 같은 조건. 'none' = 여기 상점에 없는 것(숨김·업적 보상·지금 장소에 못 놓는 것).
function _decoShopState(d) {
  if (!d || d.hidden || d.cat !== DECO_SCENE) return 'none';
  if (!(d.price > 0)) return (d.gift && DECO_SHOP_GIFTS) ? 'gift' : 'none';
  if ((CUR.level || 1) < (d.reqLv || 1)) return 'lock';
  return CUR.gold >= _decoCostOf(d) ? 'ok' : 'short';
}

function _decoGoldSync() {
  const b = document.getElementById('if-deco-gold'); if (!b || !CUR) return;
  //  꾸미는 중에 골드가 바뀌는 길(교사 지급 → 스냅샷 → renderHUD)을 따라간다 — HUD 숫자가 바뀌면 배지도(renderHUD 는 안 고친다)
  const hud = document.getElementById('hud-gold');
  if (hud && !_decoGoldSync._mo && typeof MutationObserver === 'function') {
    _decoGoldSync._mo = new MutationObserver(() => { if (_ifMode) _decoGoldSync(); });
    _decoGoldSync._mo.observe(hud, { childList: true, characterData: true, subtree: true });
  }
  const txt = '💰 ' + (CUR.gold || 0) + 'G';
  if (b.textContent === txt) return;
  b.textContent = txt;
  if (DECO_TAB === 'shop') _decoShopRender();   // 골드가 바뀌면 '골드 부족' 카드도 바뀐다
}
function _decoShopSync() {   // renderDecoInv 가 부른다
  _decoGoldSync(); _decoGhostCheck();
  if (DECO_TAB === 'shop' && _decoShop.scene !== DECO_SCENE) _decoShopRender();
}

function decoTab(tab) {
  tab = tab === 'shop' ? 'shop' : 'own';
  const body = document.getElementById('if-deco-body'), dr = document.getElementById('if-deco-drawer');
  if (body) _decoShop.scroll[DECO_TAB] = body.scrollTop;   // 스크롤은 탭마다 기억
  DECO_TAB = tab;
  if (dr) dr.classList.toggle('is-shop', tab === 'shop');
  ['own', 'shop'].forEach(t => { const b = document.getElementById('if-deco-tab-' + t);
    if (b) { b.classList.toggle('is-on', t === tab); b.setAttribute('aria-selected', String(t === tab)); } });
  const q = tab === 'shop' ? _decoShop.q : _decoFind.q, inp = document.getElementById('if-deco-search'), clr = document.getElementById('if-deco-search-clear');
  if (inp) { inp.value = q || ''; inp.placeholder = tab === 'shop' ? '🔍 상점에서 찾기' : '🔍 이름으로 찾기'; }
  if (clr) clr.hidden = !(q || '').length;
  if (tab === 'shop') _decoShopRender(); else _decoShopBarSync();
  if (body) body.scrollTop = _decoShop.scroll[tab] || 0;
  _decoPillarSync(); _decoFit();
}

function decoShopKind(k) { _decoShop.kind = k; _decoShopRender(); }

function _decoShopRender() {
  const el = document.getElementById('if-deco-shop'), chips = document.getElementById('if-deco-kinds');
  if (!el || !CUR) return;
  _decoShop.scene = DECO_SCENE;
  const list = GAME_DATA.decorations.filter(d => _decoShopState(d) !== 'none');
  const has = {}; list.forEach(d => { has[_decoShopKind(d)] = 1; });
  if (_decoShop.kind !== 'all' && !has[_decoShop.kind]) _decoShop.kind = 'all';   // 마당↔집 안을 오가면 그 분류가 없을 수 있다
  if (chips) chips.innerHTML = DECO_SHOP_KINDS.filter(k => k[0] === 'all' || has[k[0]]).map(k =>
    `<button class="deco-chip${_decoShop.kind === k[0] ? ' is-on' : ''}" aria-pressed="${_decoShop.kind === k[0]}" onclick="decoShopKind('${k[0]}')">${k[1]}</button>`).join('');
  const q = (_decoShop.q || '').trim(), free = !!(GAME_DATA.decoFreeNow && GAME_DATA.decoFreeNow());
  const d0 = new Date(), today = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
  const shown = list.filter(d => (_decoShop.kind === 'all' || _decoShopKind(d) === _decoShop.kind) && (!q || String(d.name || '').indexOf(q) >= 0));
  if (_decoShop.sel && !shown.some(d => d.id === _decoShop.sel)) _decoShop.sel = null;
  el.innerHTML = shown.length ? shown.map(d => {
    const st = _decoShopState(d), own = _decoQtyOf(d.id);
    const price = st === 'gift' ? '🎁 도감 선물' : st === 'lock' ? `🔒 Lv${d.reqLv}+` : free ? `🎁 무료 <s>${d.price}G</s>` : `💰 ${_decoCostOf(d)}G`;
    return `<div class="deco-scard is-${st}${free && st === 'ok' ? ' is-free' : ''}${_decoShop.sel === d.id ? ' is-sel' : ''}" data-shop-id="${d.id}" onclick="decoShopPick('${d.id}')">`
      + `<div class="ds-art">${_decoThumb(d, 34)}</div><div class="dc-name">${escHtml(_decoShopName(d))}</div><div class="ds-price">${price}</div>`
      + (own > 0 ? `<span class="ds-own">×${own}</span>` : '') + ((d.newUntil && today <= d.newUntil) ? '<span class="ds-new">NEW</span>' : '') + '</div>';
  }).join('') : `<div class="deco-empty">${q ? '"' + escHtml(q) + '" 이름인 장식이 상점에 없어요' : '여기에 놓을 장식이 상점에 없어요'}</div>`;
  _decoShopBarSync();
}

//  카드를 누른다 = 고르기(다시 누르면 풀림). 사는 것은 막대의 단추가 한다.
function decoShopPick(id) {
  _decoShop.sel = (!id || _decoShop.sel === id) ? null : id;
  _decoShop.armedAt = 0; _decoShop.armedMode = null; _decoShop.lastBuyAt = 0;
  document.querySelectorAll('#if-deco-shop .deco-scard').forEach(c => c.classList.toggle('is-sel', c.dataset.shopId === _decoShop.sel));
  _decoShopBarSync();
}

function _decoShopBarSync() {
  const bar = document.getElementById('if-deco-buybar'); if (!bar) return;
  const d = DECO_TAB === 'shop' && _decoShop.sel ? GAME_DATA.decorations.find(x => x.id === _decoShop.sel) : null;
  const st = d ? _decoShopState(d) : 'none', was = !bar.hidden;
  if (st === 'none') { bar.hidden = true; bar.innerHTML = ''; }
  else {
    const cost = _decoCostOf(d), nm = escHtml((d.icon || '') + ' ' + _decoShopName(d)), twice = st === 'ok' && cost >= DECO_SHOP_TWICE;
    let msg, btn = '';
    if (st === 'gift') {
      const g = d.gift || {}, what = { topiary: '다듬은 나무', plant: '꽃·풀', tree: '나무', animal: '동물' }[g.need] || '장식';
      msg = `🎁 ${escHtml(_decoShopName(d))}${_josa(_decoShopName(d), '은', '는')} 도감을 채우면 받아요 — ${what} ${g.count || ''}가지`;
    } else if (st === 'lock') msg = `🔒 ${nm} — Lv${d.reqLv} 이상이 되면 살 수 있어요`;
    else if (st === 'short') msg = `${nm} <b>${cost}G</b> — 골드가 ${cost - CUR.gold}G 모자라요`;
    else {
      msg = cost === 0 ? `${nm} <b>🎁 무료</b> <s>${d.price}G</s>` : `${nm} <b>💰 ${cost}G</b>`;
      //  [DECO-SHOP-BAG-1] 단추 둘 — 🎒 가방에 넣기(사고 끝) · 사서 놓기(손끝에). 사는 길은 둘 다 decoShopBuy → buyDeco() 하나.
      //  200G↑ '한 번 더'는 누른 그 단추가 받는다(다른 단추를 누르면 그 단추로 다시 '한 번 더')
      const armed = twice && _decoShop.armedAt ? (_decoShop.armedMode || 'place') : '';
      btn = `<button class="db-buy db-bag${armed === 'bag' ? ' is-armed' : ''}" onclick="decoShopBuy('bag')">${armed === 'bag' ? '🎒 한 번 더 눌러 사기' : '🎒 가방에 넣기'}</button>`
        + `<button class="db-buy db-place${armed === 'place' ? ' is-armed' : ''}" onclick="decoShopBuy('place')">${armed === 'place' ? '한 번 더 눌러 사기' : '사서 놓기 ▶'}</button>`;
    }
    bar.className = 'deco-buybar is-' + st + (twice ? ' is-twice' : '');
    bar.innerHTML = `<span class="db-msg">${msg}</span>${btn}<button class="db-x" onclick="decoShopPick(null)" aria-label="고르기 풀기">✕</button>`;
    bar.hidden = false;
  }
  if (was !== !bar.hidden) { _decoPillarSync(); _decoFit(); }   // 좁은 폭에서는 막대가 한 줄을 더 쓴다
}

function _josa(word, a, b) {   // 받침 있으면 a, 없으면 b
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  return (c >= 0xAC00 && c <= 0xD7A3) ? ((c - 0xAC00) % 28 ? a : b) : b;
}

function decoShopBuy(mode) {
  mode = mode === 'bag' ? 'bag' : 'place';
  const d = _decoShop.sel && GAME_DATA.decorations.find(x => x.id === _decoShop.sel);
  if (!d || DECO_TAB !== 'shop' || _decoShopState(d) !== 'ok') { _decoShopBarSync(); return; }
  const cost = _decoCostOf(d), now = Date.now();
  //  [DECO-SHOP-BAG-1] 가방에 넣으면 카드가 골라진 채 남는다 → 두 번 두드림(0.6초 안)이 두 개를 사지 않게. 카드를 다시 고르면 풀린다
  if (now - (_decoShop.lastBuyAt || 0) < 600) return;
  if (cost >= DECO_SHOP_TWICE) {   // 비싼 것은 한 번 더 — 첫 누름은 단추 글만 바꾼다. 두 번 두드림(0.35초 안)은 한 번으로 친다
    if (!_decoShop.armedAt || (_decoShop.armedMode && _decoShop.armedMode !== mode)) {
      _decoShop.armedAt = now; _decoShop.armedMode = mode; _decoShopBarSync(); return;
    }
    if (now - _decoShop.armedAt < 350) return;
  }
  const qty0 = _decoQtyOf(d.id), olds = new Set(document.querySelectorAll('.toast-msg'));
  //  본편 상점의 buyDeco() 를 그대로 부른다. 그 함수의 '한 번 더 누르면 사요'(3초) 걸음은 사기 막대가 이미 받았으므로 통과시킨다.
  _buyDecoArm = { id: d.id, t: now };
  try { buyDeco(d.id); } finally { _buyDecoArm = null; }
  document.querySelectorAll('.toast-msg').forEach(t => { if (!olds.has(t)) t.remove(); });   // 본편 알림 대신 아래 한 줄(겹치면 글자가 뭉개진다)
  if (_decoQtyOf(d.id) !== qty0 + 1) { toast('💸 골드가 모자라요'); _decoGoldSync(); _decoShopRender(); return; }
  decoSaveAbsorbed();   // buyDeco 가 통째 저장을 했다 — 대기 중이던 꾸미기 묶음은 거기에 실려 갔다
  _decoShop.armedAt = 0; _decoShop.armedMode = null; _decoShop.lastBuyAt = now;
  if (mode === 'bag') {   // [DECO-SHOP-BAG-1] 가방에 넣기 = 사고 끝. 상점 그대로 · 아무것도 손에 안 든다
    renderDecoInv(); _decoShopRender();
    toast(`🎒 ${_decoShopName(d)}${_josa(_decoShopName(d), '을', '를')} 가방에 넣었어요`);
    return;
  }
  //  산 직후 = 내 것 탭 · 그 카드가 맨 앞에 골라진 채 · 손끝에 그림
  _decoShop.sel = null; _decoShop.front = d.id; _decoShop.scroll.own = 0;
  _decoFind.q = '';
  if (DECO_MODE !== 'deco') { setDecoMode('deco'); ifSyncModeBtn(); }
  SEL_DECO = d.id;
  decoTab('own');
  _drawDeco(); renderDecoInv(); _decoHandSync();
  _decoGhostStart(d);
  toast(`${d.icon || ''} ${_decoShopName(d)}${_josa(_decoShopName(d), '을', '를')} ${cost === 0 ? '무료로 받았어요' : '샀어요'} — 놓을 곳을 눌러요`);
}

//  산 직후 손끝 그림 — 마우스는 따라다니고, 터치는 마당 가운데에서 기다리다가 손가락을 따라간다. 하나 놓거나 손을 비우면 끝.
let _decoGhost = null;
function _decoGhostMove(e) {
  if (!_decoGhost) return;
  _decoGhost.el.style.transform = `translate(${Math.round(e.clientX - 28)}px, ${Math.round(e.clientY - 64)}px)`;
}
function _decoGhostStart(d) {
  _decoGhostEnd();
  const fs = document.getElementById('interior-fullscreen'), host = document.getElementById('if-topview');
  if (!fs || !host || !_ifMode) return;
  const el = document.createElement('div'); el.id = 'deco-hand-ghost'; el.innerHTML = _decoThumb(d, 56) + '<div class="dg-cap">놓을 곳을 눌러요</div>';
  fs.appendChild(el);
  //  [DECO-SHOP-BAG-1] 토스트만으로는 '지금 누르면 놓인다'를 모른다 → 그림 곁 글 + 누를 수 있는 [✕ 그만](가방에 남김)
  const tip = document.createElement('div'); tip.id = 'deco-hand-tip';
  tip.innerHTML = `<span>${escHtml((d.icon || '') + ' ' + _decoShopName(d))} — 놓을 곳을 눌러요</span><button onclick="decoGhostStop()">✕ 그만</button>`;
  fs.appendChild(tip);
  _decoGhost = { id: d.id, n0: (CUR.houseDecorations || []).filter(p => p.id === d.id).length, el, tip, host };
  const r = host.getBoundingClientRect();
  _decoGhostMove({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 + 36 });
  host.addEventListener('pointermove', _decoGhostMove, { passive: true });
  host.addEventListener('pointerdown', _decoGhostMove, { passive: true });
}
function _decoGhostEnd() {
  if (!_decoGhost) return;
  _decoGhost.host.removeEventListener('pointermove', _decoGhostMove);
  _decoGhost.host.removeEventListener('pointerdown', _decoGhostMove);
  _decoGhost.el.remove(); if (_decoGhost.tip) _decoGhost.tip.remove(); _decoGhost = null;
}
//  ✕ 그만 = 고른 것만 푼다. 산 것은 가방에 그대로(되돌리기·골드와 무관)
function decoGhostStop() {
  const id = _decoGhost && _decoGhost.id, d = id && GAME_DATA.decorations.find(x => x.id === id);
  _decoGhostEnd();
  if (SEL_DECO === id) SEL_DECO = null;
  _drawDeco(); renderDecoInv(); _decoHandSync();
  if (d) toast(`🎒 ${_decoShopName(d)}${_josa(_decoShopName(d), '은', '는')} 가방에 있어요`);
}

//  [DECO-SHOP-BAG-1] 다 놓아서 ×0 인 카드 — '없어진 게 아니라 놓여 있다'. 공간별 놓인 수 글 · 누르면 놓인 그것을 잠깐 반짝
function _decoPlacedWhere(id) {
  const d = GAME_DATA.decorations.find(x => x.id === id), by = {};
  (CUR.houseDecorations || []).forEach(p => { if (p.id === id) { const k = _decoSpaceOf(p); by[k] = (by[k] || 0) + 1; } });
  const ks = Object.keys(by).sort(); if (!ks.length) return '';
  const place = d && d.cat === 'indoor' ? '집 안' : '마당';
  return (ks.length === 1 && ks[0] === '1') ? `${place}에 ${by[1]}` : ks.map(k => `공간${k}에 ${by[k]}`).join(' · ');
}
function _decoFlashPlaced(id) {
  const d = GAME_DATA.decorations.find(x => x.id === id);
  const here = _decoList(CUR).filter(p => p.id === id && p.area === DECO_SCENE);
  toast(`${(d && d.icon) || ''} ${_decoPlacedWhere(id)}개 놓여 있어요${here.length ? ' — 반짝이는 곳' : ''}`);
  if (!_dCv || !here.length) return;
  const rect = _dCv.getBoundingClientRect(), host = document.getElementById('if-topview');
  const hr = host ? host.getBoundingClientRect() : rect, sx = rect.width / _dW, sy = rect.height / _dH;
  const ox = DECO_SCENE === 'yard' ? 0 : (_dCv._offX || 0), oy = DECO_SCENE === 'yard' ? 0 : (_dCv._offY || 0);
  here.forEach(p => {
    const st = _decoAnimState(p);   // 동물은 지금 있는 자리(그 그림)를 반짝
    if (st && st.el) { st.el.classList.remove('deco-flash'); void st.el.offsetWidth; st.el.classList.add('deco-flash'); setTimeout(() => st.el.classList.remove('deco-flash'), 1800); return; }
    const sz = getDecoSize(p.id);
    const rowY = (p.area === 'indoor' && _isWallDeco(p.id) && _inIsWallRow(p.row, p.col)) ? p.row - 1 : p.row;   // [INDOOR-WALL-1] 액자는 벽 띠를 반짝
    const x = rect.left + (ox + p.col * _dC - _dPanX) * sx, y = rect.top + (oy + rowY * _dC - _dPanY) * sy, w = sz.w * _dC * sx, h = sz.h * _dC * sy;
    if (x + w < hr.left || x > hr.right || y + h < hr.top || y > hr.bottom) return;   // 화면 밖이면 글만
    const r = document.createElement('div'); r.className = 'deco-flash-ring';
    r.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px`;
    document.body.appendChild(r); setTimeout(() => r.remove(), 1800);
  });
}
function _decoGhostCheck() {
  const g = _decoGhost; if (!g) return;
  if (!_ifMode || SEL_DECO !== g.id || (CUR.houseDecorations || []).filter(p => p.id === g.id).length > g.n0) _decoGhostEnd();
}

// ── [SPLIT-1] 'friend' — 원래 student.js 14159~14512줄 ──
// ── 친구 방문 전체화면 (읽기 전용) ─────────────────────
let _ffFriend = null;
let _ffScene  = 'yard';
// [DECO-FRIEND-VIEW-1] 구경 판의 확대·이동은 구경만의 값(보스 채택 안 · 계획 C9) — 내 마당 값(_dPanX 등)과 섞이지 않는다. 저장 0 · 읽기 전용.
let _ffView = { zoom: 1, panX: 0, panY: 0 }, _ffRaf = 0;
function _ffViewReset() { _ffView = { zoom: 1, panX: 0, panY: 0 }; }
function _ffRender() { if (_ffRaf) return; _ffRaf = requestAnimationFrame(() => { _ffRaf = 0; _renderFriendCanvas(); }); }
//  (fx,fy) 화면 점을 고정한 채 배율을 바꾼다 — 1(처음 보던 크기) ~ 3배
function _ffZoomAt(z, fx, fy) {
  //  옛 칸 크기는 지금 배율로 셈한다(그린 값 v.C 는 한 틀 늦다 — 두 손가락 걸음이 그 사이 여러 번 오면 기준점이 밀렸다)
  const v = _ffView, C0 = v.C0 || 1, oldC = Math.max(4, Math.round(C0 * v.zoom));
  v.zoom = Math.min(3, Math.max(1, z));
  const newC = Math.max(4, Math.round(C0 * v.zoom));
  if (fx === undefined) { fx = (v.W || 0) / 2; fy = (v.H || 0) / 2; }
  v.panX = (v.panX + fx) / oldC * newC - fx; v.panY = (v.panY + fy) / oldC * newC - fy;
  _ffRender();
}
function ffZoom(k) { _ffZoomAt(_ffView.zoom * k); }
function ffZoomReset() { _ffViewReset(); _ffRender(); }
//  누르면 — 그 칸의 동물이 반응(말풍선 · 💗 · 강아지는 한 칸 온다 — 화면에만)
function _ffTap(x, y) {
  const v = _ffView;
  if (_ffScene !== 'yard' || !v.C) return;
  const c = Math.floor((x + v.panX) / v.C), r = Math.floor((y + v.panY) / v.C);
  //  내 마당과 같은 판정(#1021) — 그려진 몸 먼저 · 몸 밖이면 칸
  const st = _animAtPt('ff-topview', x + v.panX, y + v.panY) || _animAt('ff-topview', r, c);
  if (st) _animPoke(st, c);
}
function _ffAttach(cv) {
  const pts = new Map(); let pinch = null, drag = null;
  const local = e => { const k = cv.getBoundingClientRect(); return { x: e.clientX - k.left, y: e.clientY - k.top }; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    pts.set(e.pointerId, local(e));
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: _ffView.zoom }; drag = null; }
    else if (pts.size === 1) { const p = local(e); drag = { x: p.x, y: p.y, px: _ffView.panX, py: _ffView.panY, moved: 0 }; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; if (pinch.d0 > 8) _ffZoomAt(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    else if (drag) { const p = local(e); drag.moved = Math.max(drag.moved, Math.abs(p.x - drag.x) + Math.abs(p.y - drag.y));
      if (drag.moved > 6) { _ffView.panX = drag.px - (p.x - drag.x); _ffView.panY = drag.py - (p.y - drag.y); _ffRender(); } }
  });
  cv.addEventListener('pointerup', e => {
    const tap = !!drag && drag.moved <= 6 && !pinch && pts.size === 1, p = local(e);
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) { drag = null; if (tap) _ffTap(p.x, p.y); }
  });
  cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; drag = null; });
  cv.addEventListener('wheel', e => {   // 트랙패드 두 손가락 = 이동 · 모으기(ctrl) = 확대
    e.preventDefault();
    if (e.ctrlKey) { const p = local(e); _ffZoomAt(_ffView.zoom * Math.exp(-e.deltaY * .01), p.x, p.y); }
    else { _ffView.panX += e.deltaX; _ffView.panY += e.deltaY; _ffRender(); }
  }, { passive: false });
}

function openFriendFullscreen(friendId) {
  const friend = typeof friendId === 'string' ? DB.getStudent(friendId) : friendId;
  if (!friend) return;
  _ffFriend = friend;
  _ffScene  = 'yard';
  _ffViewReset();   // [DECO-FRIEND-VIEW-1]
  const fs = document.getElementById('friend-fullscreen');
  fs.style.display = 'flex';
  document.getElementById('ff-title').textContent = friend.avatar + ' ' + friend.name + '의 집';
  document.getElementById('ff-friend-info').textContent =
    `Lv.${friend.level} · ${friend.job||'학생'} · 📚 ${friend.bookCount||0}권`;
  document.getElementById('ff-scene-btn').textContent = '🏠 집 안 보기 →';
  requestAnimationFrame(() => requestAnimationFrame(() => _renderFriendCanvas()));
}

// [DECO-FRIEND-ART-1] 그림(SVG)이 늦게 도착하면 _drawDeco() 는 **내** 캔버스만 다시 그린다 → 처음 가 보는 친구 마당은
//  옛 캔버스 그림(_DFN)·단색 물로 그려진 채 그대로였다(내가 이미 본 장식만 새 그림). 구경 중이면 구경 판도 다시 그린다.
//  한꺼번에 여러 장이 와도 0.05초에 한 번.
let _ffRedrawTimer = null;
function _ffRedrawSoon() {
  if (!_ffFriend || _ffRedrawTimer) return;
  _ffRedrawTimer = setTimeout(() => { _ffRedrawTimer = null; if (_ffFriend) _renderFriendCanvas(); }, 50);
}

function closeFriendFullscreen() {
  _animStopLayer('ff-topview');   // [DECO-ANIM-1]
  _decoMotionStop('ff-topview');   // [DECO-FRIEND-MOTION-1]
  document.getElementById('friend-fullscreen').style.display = 'none';
  _ffFriend = null;
}

function toggleFriendScene() {
  _ffScene = _ffScene === 'yard' ? 'indoor' : 'yard';
  const isYard = _ffScene === 'yard';
  document.getElementById('ff-scene-btn').textContent = isYard ? '🏠 집 안 보기 →' : '🌿 마당 보기 ←';
  document.getElementById('ff-topview').innerHTML = '';
  _ffViewReset();   // [DECO-FRIEND-VIEW-1]
  requestAnimationFrame(() => _renderFriendCanvas());
}

function _renderFriendCanvas() {
  if (!_ffFriend) return;
  const el = document.getElementById('ff-topview');
  if (!el) return;

  const prevCUR   = CUR;
  const prevScene = DECO_SCENE;
  const prevSpace = DECO_SPACE; DECO_SPACE = 1;   // [DECO-SPACE-1] 친구 구경은 공간 1
  const prevCv    = _dCv;
  const prevCtx   = _dCtx;
  const prevW     = _dW;
  const prevH     = _dH;
  const prevC     = _dC;
  const prevIfMode = _ifMode;
  const prevCont  = _ifActiveContainer;
  //  [DECO-FRIEND-PAN-1] 내 마당에서 옮겨 본 값(_dPanX/Y)이 새면 보이는 칸 고르기(_decoVisible)가 친구 마당 왼쪽·위를 안 그리고(까맣게 빔),
  //  동물 층도 그만큼 밀려 사라졌다 → [DECO-FRIEND-VIEW-1] 이제 구경만의 값(_ffView)으로 그린다(아래에서 C 를 정한 뒤)
  const prevPanX = _dPanX, prevPanY = _dPanY, prevZoom = _dZoom;
  _dPanX = 0; _dPanY = 0; _dZoom = 1;

  // 전체화면 그리드 크기 임시 적용
  DY = {...DY_FULL};
  DI = {...DI_FULL};
  CUR        = _ffFriend;
  DECO_SCENE = _ffScene;
  _ifMode    = true;

  //  [DECO-FRIEND-VIEW-1] 캔버스는 다시 쓴다(끌기·확대 중에 매번 새로 만들지 않게) — 장면을 바꾸면 toggleFriendScene 이 비운다
  let cv = el.querySelector('canvas');
  if (!cv) {
    el.innerHTML = '';
    cv = document.createElement('canvas');
    cv.style.cssText = 'display:block;cursor:grab;touch-action:none';
    el.appendChild(cv);
    _ffAttach(cv);
  }

  const topH = 50;
  const W    = window.innerWidth;
  const maxH = window.innerHeight - topH - 48;
  const cols = _ffScene === 'yard' ? DY.cols : DI.cols;
  const rows = _ffScene === 'yard' ? DY.rows + (typeof _yardIslandCells === 'function' ? _yardIslandCells() : 0) : DI.rows;   // [DECO-STAR-P5] 섬 몫(섬 없는 모습은 0)
  let C    = Math.floor(W / cols);
  const _ffC0 = C;
  C = Math.max(4, Math.round(_ffC0 * _ffView.zoom));   // [DECO-FRIEND-VIEW-1]
  let H    = Math.min(C * rows, maxH);
  //  [INDOOR-ROOMS-1] 친구 집 안에 방이 있으면 방 둘레에 맞춰 한 장(아래쪽 방이 안 잘리게)
  let fpx = 0, fpy = 0;
  const fRooms = _ffScene === 'yard' ? [] : _inRooms(_ffFriend, 1);
  if (fRooms.length) {
    let r0 = 99, c0 = 99, r1 = -1, c1 = -1;
    fRooms.forEach(rm => { r0 = Math.min(r0, rm.r - 1); c0 = Math.min(c0, rm.c); r1 = Math.max(r1, rm.r + rm.h); c1 = Math.max(c1, rm.c + rm.w); });
    const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
    C = Math.max(4, Math.min(Math.floor(W / bw), Math.floor(maxH / bh)));
    _ffView.C0 = C; C = Math.max(4, Math.round(C * _ffView.zoom));   // [DECO-FRIEND-VIEW-1]
    H = Math.max(120, Math.min(maxH, bh * C));
    const offX = Math.max(0, Math.floor((W - cols * C) / 2)), offY = Math.max(Math.floor(C * .9), Math.floor((H - rows * C) / 2));
    fpx = offX + c0 * C - Math.max(0, (W - bw * C) / 2); fpy = offY + r0 * C - Math.max(0, (H - bh * C) / 2);
  }

  //  [DECO-FRIEND-VIEW-1] 구경만의 이동 — 판 밖으로는 안 나간다(판이 화면보다 작으면 0)
  if (!fRooms.length) _ffView.C0 = _ffC0;
  //  마당 = 판 크기 · 집 안 = 처음 보던 한 장(방 둘레)을 배율만큼 키운 크기
  const contentW = _ffScene === 'yard' ? cols * C : Math.round(W * _ffView.zoom), contentH = _ffScene === 'yard' ? rows * C : Math.round(H * _ffView.zoom);
  const maxPX = Math.max(0, contentW - W), maxPY = Math.max(0, contentH - H);
  _ffView.panX = Math.min(Math.max(0, _ffView.panX), maxPX); _ffView.panY = Math.min(Math.max(0, _ffView.panY), maxPY);
  _ffView.C = C; _ffView.W = W; _ffView.H = H;
  _dPanX = _ffView.panX; _dPanY = _ffView.panY; _dZoom = _ffView.zoom;

  _dCv  = cv; _dW = W; _dH = H; _dC = C;
  if (cv.width !== W * 2) cv.width = W * 2;
  if (cv.height !== H * 2) cv.height = H * 2;
  cv.style.width  = W + 'px'; cv.style.height = H + 'px';
  _dCtx = cv.getContext('2d');
  _dCtx.setTransform(2, 0, 0, 2, 0, 0);
  _dCtx.clearRect(0, 0, W, H);
  _dCtx.setTransform(2, 0, 0, 2, -Math.round((fpx + _ffView.panX) * 2), -Math.round((fpy + _ffView.panY) * 2));   // [INDOOR-ROOMS-1] 방 둘레 + [DECO-FRIEND-VIEW-1] 구경 이동
  if (_ffScene === 'yard') _drawYard();
  else _drawIndoor();
  // [DECO-ANIM-1] 친구 마당에서도 동물이 돌아다닌다 — [DECO-FRIEND-VIEW-1] 구경 이동만큼 같이
  _animSyncLayer('ff-topview', _ffFriend, _ffScene, C, W, H, _ffView.panX, _ffView.panY);
  try { _decoMotionSync(); } catch (e) {}   // [DECO-FRIEND-MOTION-1] 풍차·분수·연기 층(구경 값으로 — 아직 전역을 빌린 채)
  {   // [DECO-DAYNIGHT-1] 저녁·밤 — 캔버스에 색 막이 깔리니 동물 층도 같은 결로(내 마당 #if-topview 와 같은 CSS)
    const ph = typeof _yardPhase === 'function' ? _yardPhase() : 'day', fh = document.getElementById('ff-topview');   // [DECO-LOOK-0]
    if (fh) { fh.classList.toggle('is-evening', _ffScene === 'yard' && ph === 'evening'); fh.classList.toggle('is-night', _ffScene === 'yard' && ph === 'night');
      fh.classList.toggle('look-sky', _ffScene === 'yard' && typeof _yardLook === 'function' && _yardLook().sky); }   // [DECO-STAR-P5]
  }

  // 복원
  _dPanX = prevPanX; _dPanY = prevPanY; _dZoom = prevZoom;   // [DECO-FRIEND-PAN-1]
  DECO_SPACE = prevSpace;   // [DECO-SPACE-1]
  CUR        = prevCUR;
  DECO_SCENE = prevScene;
  _dCv       = prevCv;
  _dCtx      = prevCtx;
  _dW        = prevW;
  _dH        = prevH;
  _dC        = prevC;
  _ifMode    = prevIfMode;
  _ifActiveContainer = prevCont;
  DY = _ifMode ? {...DY_FULL} : {...DY_NORMAL};
  DI = _ifMode ? {...DI_FULL} : {...DI_NORMAL};
}
function visitFriend(id) {
  const f = DB.getStudent(id);
  if (!f) return;
  const db = DB.load();
  const artworks = (db.artworks||[]).filter(a=>a.studentId===f.id);
  const books    = f.books||[];
  // 작품 라이트박스 목록 — 7264의 window._artLbImgs 패턴과 동일 (JSON을 onclick 속성에 직접 넣으면 따옴표로 속성이 깨짐)
  const friendArtLb = artworks.filter(x=>x.artUrl).map(x=>({url:x.artUrl,title:x.title||'',desc:x.comment||''}));
  window._friendArtLbImgs = friendArtLb;

  // 읽기 전용 Canvas 렌더러 — 기존 꾸미기 렌더러 재사용
  function renderDecoCanvas(area, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // 임시로 전역 상태 교체
    const prevCUR       = CUR;
    const prevScene     = DECO_SCENE;
    const prevCv        = _dCv;
    const prevCtx       = _dCtx;
    const prevW         = _dW;
    const prevH         = _dH;
    const prevC         = _dC;
    //  [DECO-FRIEND-PAN-1] 내 화면 상태(옮긴 자리·배율·공간 번호)가 친구 그림에 새지 않게
    const prevPanX = _dPanX, prevPanY = _dPanY, prevZoom = _dZoom, prevSpace = DECO_SPACE;
    _dPanX = 0; _dPanY = 0; _dZoom = 1; DECO_SPACE = 1;   // 친구 구경은 공간 1

    CUR = f;
    DECO_SCENE = area;

    // 새 canvas 생성
    el.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:100%;border-radius:12px;display:block';
    el.appendChild(cv);

    const cols = area==='yard' ? DY.cols : DI.cols;
    const rows = area==='yard' ? DY.rows : DI.rows;
    const W = el.offsetWidth || 340;
    const C = Math.floor(W / cols);
    const H = C * rows;

    _dCv  = cv;
    _dW   = W;
    _dH   = H;
    _dC   = C;
    cv.width  = W * 2;
    cv.height = H * 2;
    cv.style.height = H + 'px';
    _dCtx = cv.getContext('2d');
    _dCtx.scale(2, 2);

    // 렌더 (편집 이벤트 없이)
    _dCtx.clearRect(0, 0, W, H);
    if (area === 'yard') _drawYard();
    else _drawIndoor();

    // 전역 상태 복원
    _dPanX = prevPanX; _dPanY = prevPanY; _dZoom = prevZoom; DECO_SPACE = prevSpace;   // [DECO-FRIEND-PAN-1]
    CUR       = prevCUR;
    DECO_SCENE = prevScene;
    _dCv      = prevCv;
    _dCtx     = prevCtx;
    _dW       = prevW;
    _dH       = prevH;
    _dC       = prevC;
  }

  const modalId = 'visit-modal-'+id;

  const el = document.createElement('div');
  el.className = 'overlay open';
  el.id = modalId+'-overlay';
  el.innerHTML = `<div class="modal" style="max-width:460px">
    <div class="modal-hd">
      <div class="modal-title">${f.avatar} ${escHtml(f.name)}의 집</div>
      <button class="modal-close" onclick="this.closest('.overlay').remove()">✕</button>
    </div>
    <!-- 프로필 -->
    <div style="display:flex;align-items:center;gap:.9rem;padding:.75rem;
      background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:.8rem">
      <div style="font-size:2.8rem">${f.avatar}</div>
      <div>
        <div style="font-weight:700">${escHtml(f.name)}
          ${f.title?`<span style="font-size:.72rem;color:var(--gold);margin-left:.3rem">[${escHtml(f.title)}]</span>`:''}
        </div>
        <div style="font-size:.76rem;color:var(--txt2);margin-top:.2rem">
          Lv.${f.level} · 📚${f.bookCount||0}권 · ⚔️${(f.monsterLog||[]).length}마리
        </div>
      </div>
    </div>
    <!-- 탭 -->
    <div class="modal-tabs" style="margin-bottom:.8rem" id="${modalId}-tabs">
      <button class="mtab on" onclick="openFriendFullscreen('${id}')">꾸미기 보기</button>
      <button class="mtab"    onclick="vfTab('${modalId}','books',this)">독서</button>
      <button class="mtab"    onclick="vfTab('${modalId}','artwork',this)">작품</button>
    </div>
    <!-- 인테리어 탭 (전체화면으로 열림) -->
    <div id="${modalId}-deco">
      <div style="text-align:center;padding:1.5rem 0;color:var(--txt3);font-size:.82rem">
        위의 "🌸 꾸미기 보기" 버튼을 눌러주세요
      </div>
    </div>
    <!-- 독서 탭 -->
    <div id="${modalId}-books" style="display:none">
      ${books.length===0
        ? '<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.8rem">아직 독서 기록이 없어요 📚</div>'
        : books.slice().reverse().map((b,i)=>`
          <div style="display:flex;align-items:flex-start;gap:.6rem;padding:.5rem 0;
            border-bottom:1px solid rgba(255,255,255,.05)">
            <span style="font-size:.7rem;color:var(--txt3);min-width:24px;flex-shrink:0">#${books.length-i}</span>
            <div style="flex:1">
              <div style="font-size:.86rem;font-weight:600">${escHtml(b.title)}</div>
              ${b.review?`<div style="font-size:.72rem;color:var(--txt2);margin-top:.15rem;line-height:1.5">
                ${escHtml(b.review.length>80?b.review.slice(0,80)+'...':b.review)}</div>`:''}
            </div>
            <span style="font-size:.68rem;color:var(--txt3);flex-shrink:0">${b.date||''}</span>
          </div>`).join('')}
    </div>
    <!-- 작품 탭 -->
    <div id="${modalId}-artwork" style="display:none">
      ${artworks.length===0
        ? '<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.8rem">전시된 작품이 없어요 🎨</div>'
        : `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem">
            ${artworks.map((a,i)=>a.artUrl?`
              <div style="border-radius:10px;overflow:hidden;cursor:pointer"
                onclick="openLightbox(window._friendArtLbImgs,${friendArtLb.findIndex(x=>x.url===a.artUrl)})">
                <img src="${escHtml(a.artUrl)}" style="width:100%;aspect-ratio:1;object-fit:cover">
                <div style="padding:.3rem .4rem;font-size:.72rem;font-weight:600;background:rgba(255,255,255,.04)">${escHtml(a.title||'')}</div>
              </div>`:''
            ).join('')}
           </div>`}
    </div>
  </div>`;

  el.addEventListener('click', e => { if(e.target===el) el.remove(); });
  document.body.appendChild(el);
  // DOM에 붙은 후 canvas 렌더 (offsetWidth 계산 위해 requestAnimationFrame)
  requestAnimationFrame(() => {
    renderDecoCanvas('yard',   `${modalId}-yard`);
    renderDecoCanvas('indoor', `${modalId}-indoor`);
  });
}

function vfTab(modalId, tab, btn) {
  ['deco','books','artwork'].forEach(t => {
    const el = document.getElementById(modalId+'-'+t);
    if (el) el.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('#'+modalId+'-tabs .mtab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
}

