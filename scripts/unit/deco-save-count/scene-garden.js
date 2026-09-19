// 놀이판 장면 — 정원 바닥 본보기 마당(docs/deco_showcase_yard_20260920.md 의 그림 1 과 같은 구도).
//  정원 바닥 연결 PR(②색 ③가장자리 ④고르기)이 **같은 구도로 전/후**를 찍으려고 둔다. 저장하지 않는다(CUR 만 바꾼다).
//  쓰는 법: 놀이판(play.mjs)에서 꾸미기 전체화면을 연 뒤 콘솔·CDP 로 이 파일을 통째로 실행 → `__sceneGarden()`.
//           `__sceneGarden('worst')` = 최악 마당: 보이는 칸 전부에 정원 7종 × 색 전부를 돌려 깐다(Image·비트맵 수 재기).
//           `__sceneGarden('edges')` = 가장자리 최악(꽃밭·잔디 체크무늬) · `__sceneGarden('stripes')` = 줄무늬 화단·맞닿은 꽃밭(눈으로 볼 것).
//  값은 늘 `이름#색+마감` 순서.
window.__sceneGarden = function (mode) {
  const fx = {}, box = (r0, c0, r1, c1, v) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!_isHC(r, c)) fx[r + '_' + c] = v; };
  if (mode === 'worst') {
    const vals = [];
    Object.keys(_FLOOR_COLORS).forEach(n => { vals.push(n); _FLOOR_COLORS[n].forEach(col => vals.push(n + '#' + col)); });
    let i = 0;
    for (let r = 0; r < DY.rows; r++) for (let c = 0; c < DY.cols; c++) if (!_isHC(r, c) && !(typeof _isFarmCell === 'function' && _isFarmCell(r, c))) fx[r + '_' + c] = vals[(i++) % vals.length];
    CUR.yardFloor = fx; CUR.houseDecorations = []; _drawDeco();
    return { 값종류: vals.length, 칸: Object.keys(fx).length };
  }
  if (mode === 'edges') {   // 가장자리 최악: 꽃밭과 잔디를 체크무늬로 — 꽃밭 칸마다 변 4 + 안 모서리 4 조각. 값은 색·마감을 전부 돌려 가며.
    const vals = [];
    Object.keys(_FLOOR_EDGE_COLOR).forEach(n => { [''].concat(_FLOOR_COLORS[n]).forEach(col => { [''].concat(_FLOOR_RIMS).forEach(rm => vals.push(n + (col ? '#' + col : '') + (rm ? '+' + rm : ''))); }); });
    let i = 0;
    for (let r = 0; r < DY.rows; r++) for (let c = 0; c < DY.cols; c++) if ((r + c) % 2 === 0 && !_isHC(r, c) && !(typeof _isFarmCell === 'function' && _isFarmCell(r, c))) fx[r + '_' + c] = vals[(i++) % vals.length];
    CUR.yardFloor = fx; CUR.houseDecorations = []; _drawDeco();
    return { 값종류: vals.length, 칸: Object.keys(fx).length };
  }
  if (mode === 'stripes') {   // 결정용: 색을 번갈아 깐 줄무늬 화단(한 밭으로 읽히나) · 서로 다른 꽃밭이 맞닿은 곳 · 마감 있는 밭과 없는 밭이 맞닿은 곳
    ['red', 'yellow', 'white', 'red', 'yellow', 'white'].forEach((col, k) => box(4 + k, 4, 4 + k, 12, 'tulipbed#' + col));
    ['', 'violet', 'orange', '', 'violet', 'orange', '', 'violet'].forEach((col, k) => box(4, 16 + k, 9, 16 + k, 'tulipcol' + (col ? '#' + col : '')));
    box(12, 4, 15, 8, 'lavender'); box(12, 9, 15, 13, 'hydrangea'); box(16, 6, 17, 11, 'daisyfield#yellow');
    box(12, 16, 15, 19, 'sunflowerbed+picket'); box(12, 20, 15, 23, 'hydrangea#pink');
    box(11, 27, 16, 33, 'wildflower'); box(12, 28, 14, 30, 'daisyfield'); box(13, 31, 15, 32, 'stone');
    CUR.yardFloor = fx; CUR.houseDecorations = []; _drawDeco();
    return { 칸: Object.keys(fx).length };
  }
  box(3, 3, 9, 9, 'tulipcol#yellow');                                   // 왼쪽 위 노란 세로 줄 튤립
  box(3, 12, 5, 20, 'daisyfield'); box(6, 18, 9, 20, 'daisyfield');     // 데이지 ㄱ자 들판
  box(4, 33, 8, 42, 'tulipbed#red+picket');                             // 흰 말뚝 두른 빨강 튤립 화단
  box(13, 3, 14, 47, 'stone'); box(2, 46, 21, 47, 'stone');             // 돌길
  box(11, 22, 16, 29, 'brick');                                         // 벽돌 광장
  box(17, 3, 21, 12, 'lavender+brick');                                 // 벽돌 테 라벤더 밭
  box(17, 33, 21, 42, 'hydrangea+stone');                               // 돌 테 파랑 수국
  box(22, 3, 31, 13, 'water'); box(22, 3, 22, 5, 'grass'); box(22, 11, 24, 13, 'grass'); box(31, 12, 31, 13, 'grass');   // 풀밭 연못(귀를 깎아 둥글게)
  box(22, 15, 27, 19, 'wildflower'); box(32, 3, 33, 12, 'wildflower#rainbow'); box(32, 19, 33, 31, 'wildflower#snow');   // 들꽃 잔디
  box(24, 22, 28, 30, 'sunflowerbed');                                  // 해바라기 밭
  box(27, 33, 30, 38, 'hydrangea#pink');                                // 분홍 수국
  Object.keys(fx).forEach(k => { if (fx[k] === 'grass') delete fx[k]; });
  CUR.yardFloor = fx;
  const D = (id, row, col) => ({ id, area: 'yard', row, col });
  CUR.houseDecorations = [D('d_y10', 12, 25), D('d_y5', 15, 23), D('d_y5', 15, 27), D('d_y6', 11, 10), D('d_y6', 11, 20), D('d_y6', 11, 32), D('d_y6', 11, 43),
    D('d_y12', 27, 39), D('d_y11', 23, 31), D('d_y33', 6, 23), D('d_y34', 18, 15), D('d_y28', 28, 44), D('d_y68', 28, 15), D('d_y29', 24, 4), D('d_y29', 29, 13),
    D('d_y15', 9, 33), D('d_y15', 9, 42), D('d_y5', 10, 36), D('d_y46', 3, 26), D('d_y14', 16, 21)]
    .filter(p => GAME_DATA.decorations.some(d => d.id === p.id));
  _drawDeco();
  return { 칸: Object.keys(fx).length, 장식: CUR.houseDecorations.length };
};
