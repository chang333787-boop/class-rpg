# 마을 건물 한눈에 구별 — DESIGN-LOOK-1 (2026-09-20)

사용자: "집하고 가게하고 병원하고 우체국·시장 등이 디자인이 달랐으면 좋겠는데 구별이 잘 안 가. 가게도 솔직히 자세히 봐야 보이고."
교과: 4-1 지도(기호) · 4-1 경제활동 — `docs/village_curriculum_map.md` 25행.

## 진단
- 집·가게·학교·도서관·기차역이 모두 **크림 상자 + 뾰족 박공**. 지붕색은 종류가 아니라 **칸 자리**(`ROOFS[(x*5+y*3)%7]`)로 돌았다 — glb 재료 `roof` 면은 전부 해당(집·학교·도서관·기차역·박물관·우물·정자).
- 카메라가 35° 내려다봐서 가장 큰 색 면은 **지붕 윗면**인데, 가게 단서(차양)는 앞 벽에 작게 → 기본 확대(한 채 ≈ 90px)에서 '납작한 집'.

## 원칙
1. 뾰족 박공은 집만. 2. 신호는 지붕 위·윤곽으로. 3. 종류마다 고정 색(색 돌림은 집만, 따뜻한 계열). 4. 앞 소품 하나는 두 번째 신호. 5. 그림만 — 글자·돈 간판 없음, 십자는 초록(적십자 표장 피함). 6. 벽 없는 건 시장뿐.

## 이번 PR(1단계)
| | 전 | 후 |
|---|---|---|
| 가게 | shop.glb 192△ | `K.shop.parts` 상자 16개 192△ — 솟은 빨강 간판벽 + 빨강·흰 줄무늬 차양 + 매대 하나 · `GLB_KIND`/`GLB_NEED` 에서 shop 제거(shop.glb 안 받음) |
| 집 지붕 | 7색(파랑·청록·보라·초록 포함) | 따뜻한 7색(적갈·살구·겨자·밤·장미·호박·자두) |
| 특별 건물 `roof` 면 | 칸 자리 돌림 | `ROOF_FIX` 종류마다 한 색(학교 청록 · 도서관 남색 · 기차역 청회 · 박물관 돌회색) — 청크·유령·카드 썸네일 세 곳 같이 |
| 온실·풍차 | — | 손대지 않음(#671 일꾼이 문 밖) |

- 저장본: 종류 id·자리·방향만 저장 → 영향 0(pop88·pop167 물건 수 같음, `__verify` 어긋남 0).
- 도서관·기차역의 **큰 지붕은 glb 재료 `roof2`(모델 색 빨강 #bf382e)** 였다 → 보스 결정(09-20)으로 `VKIND.roof2 = 8` 을 더하고, `ROOF_FIX` 에 있는 종류만 그 색으로 칠한다(도서관 남색 · 기차역 청회). 다른 모델의 roof2 는 모델 색 그대로. 사진: `2026-09-20-look-distinct-roof2-{before,after}-{library,station}.jpg`
- 우물·정자의 `roof` 면은 칸 돌림 그대로(따뜻한 팔레트).

## 사진 (`docs/village-shots/2026-09-20-look-distinct-*`)
pop88(13일째) 같은 가게 둘레 · 가까이(×26)/기본(×12.88)/멀리(×6) 전·후 3장씩 + 물건바 카드(집·가게 / 시설) 전·후 + 특별 건물 한 줄 + 근무시간 가게 앞 일꾼.

## 참고 — 다음 건물 부위표(규칙 결정 뒤, 이번 PR 에는 없음)
시안 비교판에서 채택된 추천: 병원 A · 우체국 A · 시장 A · 빵집 A (그리고 버린 B·C 시안). 삼각형: 병원 168 · 우체국 204 · 시장 192 · 빵집 236(빵을 상자로 하면 ≈190). 모두 K 부위표라 청크에 합쳐져 draw call +0.
아래는 시안 때 게임 안에서 런타임으로 K 에 넣어 찍은 원본이다(`window.__vd` 는 시안 전용 임시 훅이었다 — 본 코드에는 없다).

```js
/* 마을 건물 구별 시안 — 부위표(K.parts 와 같은 모양). 발자국 2×2 = x·z ±4, 앞(+z)이 길 쪽.
   색 규칙(시안): 집 = 뾰족 박공 + 따뜻한 지붕 · 가게 = 평지붕 + 줄무늬 차양 · 병원 = 흰 벽 + 초록 십자
   우체국 = 주황 띠 + 편지 봉투 · 시장 = 지붕 없이 천막 여럿 · 빵집 = 크림·갈색 + 지붕 위 큰 빵 */
window.VD_DESIGNS = (function () {
  const v = window.__vd, P = v.P;
  const C = {
    cream: 0xf6ecd8, white: 0xffffff, roofFlat: 0xd8ccb2, roofFlatL: 0xf4f4f0,
    mint: 0x5cc8a8, cross: 0x2fb573, crossB: 0x3d8fe0,
    postO: 0xf07a2e, postR: 0xe0453a, env: 0xfbfaf5,
    breadCrust: 0xd98c3f, breadTop: 0xf2c07a, choco: 0x7a4a30, bakeWall: 0xfbe3bd,
    fruitR: 0xe8503f, fruitY: 0xf5c542, fruitG: 0x7cc451, fruitO: 0xf39a3a
  };
  const B = (c, s, p, o) => Object.assign({ g: 'box', c, s, p }, o || {});
  const CY = (c, s, p, o) => Object.assign({ g: 'cyl', c, s, p }, o || {});
  const CO = (c, s, p, o) => Object.assign({ g: 'cone', c, s, p }, o || {});
  const SP = (c, s, p, o) => Object.assign({ g: 'sph', c, s, p }, o || {});
  const stripes = (a, b, n, w, y, z, depth, tilt, width) => {           // 줄무늬 차양 (앞으로 기울어 내려감)
    const out = [], step = width / n;
    for (let i = 0; i < n; i++) out.push(B(i % 2 ? b : a, [step + .02, .14, depth], [-width / 2 + step * (i + .5), y, z], { rx: tilt }));
    return out;
  };
  const crate = (x, z, top) => [B(P.woodD, [1.1, .7, .9], [x, .55, z]), B(top, [.95, .22, .75], [x, 1.0, z])];

  /* ── 가게 ── */
  const shopBody = [
    B(P.stoneD, [6.6, .3, 6.0], [0, .15, -.4]),
    B(C.cream, [6.0, 3.4, 4.6], [0, 1.85, -.8]),
    B(C.roofFlat, [6.3, .35, 4.9], [0, 3.72, -.8]),
    B(P.glass, [3.8, 1.9, .12], [-.8, 1.75, 1.52]),
    B(P.woodD, [4.0, .2, .2], [-.8, .75, 1.56]),
    B(P.doorW, [1.1, 2.1, .14], [2.1, 1.15, 1.52])
  ];
  const shopA = [...shopBody, ...stripes(0xe0574a, 0xfbf6ec, 5, 2.1, 3.02, 2.4, 2.1, .42, 6.2),
    B(0xe0574a, [6.2, .32, .1], [0, 2.44, 3.36]),
    ...crate(-2.2, 3.2, C.fruitR), ...crate(-.9, 3.2, C.fruitY)];
  const shopB = [...shopBody,
    B(0xffd166, [6.4, 1.5, .3], [0, 4.6, 1.3]), B(0xffd166, [3.0, .7, .3], [0, 5.7, 1.3]),   // 앞으로 솟은 네모 간판벽(윗단 계단)
    CY(0xfbfaf5, [.8, .12, .8], [0, 4.6, 1.5], { rx: Math.PI / 2 }), B(0xe0574a, [.7, .45, .06], [0, 4.5, 1.58]), B(P.woodD, [.5, .08, .06], [0, 4.85, 1.58]),   // 동그란 판 위 바구니 그림
    ...stripes(0x3fa66b, 0xfbf6ec, 5, 1.9, 3.0, 2.35, 1.9, .42, 6.2),
    ...crate(-2.2, 3.2, C.fruitG), ...crate(-.9, 3.2, C.fruitO)];
  const shopR = [...shopBody,   // 추천 합본: 솟은 앞 간판벽(윤곽) + 빨강 줄무늬 차양 + 매대 하나 = 192△ (지금 가게 glb 와 같다)
    B(0xe0574a, [6.4, 1.5, .3], [0, 4.6, 1.3]), B(0xfbf6ec, [6.44, .3, .34], [0, 5.2, 1.3]), B(0xe0574a, [3.0, .7, .3], [0, 5.7, 1.3]),
    ...stripes(0xe0574a, 0xfbf6ec, 5, 2.2, 3.0, 2.45, 2.2, .42, 6.2),
    ...crate(-2.2, 3.3, C.fruitY)];
  const shopC = [...shopBody, ...stripes(0x4a8fe0, 0xfbf6ec, 7, 2.3, 3.0, 2.5, 2.3, .38, 6.4),
    B(0x4a8fe0, [6.4, .32, .1], [0, 2.4, 3.6]),
    CY(P.woodD, [.09, 2.3, .09], [-3.05, 1.2, 3.55]), CY(P.woodD, [.09, 2.3, .09], [3.05, 1.2, 3.55]),
    ...crate(-2.2, 3.0, C.fruitR), ...crate(-.9, 3.0, C.fruitG), ...crate(.4, 3.0, C.fruitY)];

  /* ── 병원 ── */
  const hospBody = [
    B(P.stoneD, [6.8, .3, 6.2], [0, .15, -.3]),
    B(C.white, [6.2, 5.4, 4.8], [0, 2.95, -.6]),
    B(C.roofFlatL, [6.5, .3, 5.1], [0, 5.8, -.6]),
    B(C.mint, [6.26, .4, 4.86], [0, 3.1, -.6]),
    B(P.glass, [1.5, 1.0, .1], [-2.0, 1.9, 1.82]), B(P.glass, [1.5, 1.0, .1], [2.0, 1.9, 1.82]),
    B(P.glass, [1.5, 1.0, .1], [-2.0, 4.3, 1.82]), B(P.glass, [1.5, 1.0, .1], [2.0, 4.3, 1.82]),
    B(P.glass, [1.6, 2.0, .12], [0, 1.2, 1.84]),
    B(C.mint, [2.6, .2, 1.5], [0, 2.4, 2.5])
  ];
  const crossFlat = col => [B(col, [3.0, .22, 1.0], [0, 6.05, -.6]), B(col, [1.0, .22, 3.0], [0, 6.05, -.6])];
  const crossFront = col => [B(col, [1.3, .38, .12], [0, 4.4, 1.86]), B(col, [.38, 1.3, .12], [0, 4.4, 1.86])];
  const crossStand = col => [B(C.white, [2.5, 2.5, .3], [0, 7.3, .9]), B(col, [1.9, .6, .34], [0, 7.3, .9]), B(col, [.6, 1.9, .34], [0, 7.3, .9])];
  const hospA = [...hospBody, ...crossFlat(C.cross), ...crossFront(C.cross)];
  const hospB = [   // 높은 본관 + 낮은 별관(ㄴ자) + 솟은 파란 십자
    B(P.stoneD, [6.8, .3, 6.2], [0, .15, -.3]),
    B(C.white, [3.6, 6.4, 4.6], [-1.4, 3.45, -.6]), B(C.roofFlatL, [3.9, .3, 4.9], [-1.4, 6.8, -.6]),
    B(C.white, [2.8, 2.8, 4.0], [1.9, 1.7, -.2]), B(C.roofFlatL, [3.1, .3, 4.3], [1.9, 3.2, -.2]),
    B(0x9fd0f5, [3.64, .35, 4.64], [-1.4, 4.4, -.6]),
    B(P.glass, [2.4, .9, .1], [-1.4, 2.2, 1.72]), B(P.glass, [2.4, .9, .1], [-1.4, 5.4, 1.72]), B(P.glass, [1.8, 1.8, .12], [1.9, 1.2, 1.82]),
    B(C.crossB, [2.2, .2, 1.4], [1.9, 2.35, 2.4]),
    B(C.white, [2.4, 2.4, .3], [-1.4, 8.3, .6]), B(C.crossB, [1.8, .56, .34], [-1.4, 8.3, .6]), B(C.crossB, [.56, 1.8, .34], [-1.4, 8.3, .6])];
  const hospC = [...hospBody, ...crossStand(C.cross), ...crossFront(C.cross)];

  /* ── 우체국 ── */
  const postBox = x => [CY(C.postR, [.42, 1.4, .42], [x, .85, 3.2]), B(C.postR, [.9, .2, .9], [x, 1.62, 3.2]), B(0x2b2118, [.5, .1, .06], [x, 1.2, 3.62])];
  const envelope = (y, z, s) => [B(C.env, [2.8 * s, 1.8 * s, .22], [0, y, z]),
    B(C.postR, [1.7 * s, .16, .1], [-.68 * s, y + .35 * s, z + .14], { rz: -.55 }), B(C.postR, [1.7 * s, .16, .1], [.68 * s, y + .35 * s, z + .14], { rz: .55 })];
  const postA = [
    B(P.stoneD, [6.6, .3, 6.0], [0, .15, -.4]),
    B(C.white, [6.0, 3.6, 4.6], [0, 1.95, -.8]),
    B(C.postO, [6.3, .9, 4.9], [0, 4.2, -.8]),
    B(C.postO, [6.1, .2, 4.7], [0, 4.7, -.8]),
    B(P.glass, [1.6, 1.4, .1], [-2.0, 2.0, 1.52]), B(P.glass, [1.6, 1.4, .1], [2.0, 2.0, 1.52]),
    B(P.doorW, [1.3, 2.2, .14], [0, 1.2, 1.52]),
    B(C.env, [3.6, .16, 2.4], [0, 4.86, -.8]), B(C.postR, [2.2, .1, .22], [-.82, 4.96, -1.35], { ry: -.6 }), B(C.postR, [2.2, .1, .22], [.82, 4.96, -1.35], { ry: .6 }),   // 지붕에 누운 큰 봉투(위에서 보인다)
    ...envelope(3.35, 1.6, .45), ...postBox(2.4)];
  const postB = [
    B(P.stoneD, [6.6, .3, 6.0], [0, .15, -.4]),
    B(C.postO, [6.0, 3.8, 4.6], [0, 2.05, -.8]),
    B(C.env, [6.3, .45, 4.9], [0, 4.1, -.8]),
    B(C.roofFlat, [6.1, .2, 4.7], [0, 4.4, -.8]),
    B(P.glass, [1.6, 1.4, .1], [-2.0, 2.0, 1.52]), B(P.glass, [1.6, 1.4, .1], [2.0, 2.0, 1.52]),
    B(P.doorW, [1.3, 2.2, .14], [0, 1.2, 1.52]),
    ...envelope(3.0, 1.6, .55), ...postBox(2.4), ...postBox(-2.6)];
  const postC = [   // 낮은 모임지붕(사각뿔) — 비교용: 뾰족한 지붕은 집과 헷갈린다
    B(P.stoneD, [6.6, .3, 6.0], [0, .15, -.4]),
    B(C.white, [6.0, 3.6, 4.6], [0, 1.95, -.8]),
    B(C.postO, [6.1, .6, 4.7], [0, 3.6, -.8]),
    CO(C.postO, [4.6, 1.6, 3.8], [0, 4.7, -.8], { ry: Math.PI / 4 }),
    B(P.glass, [1.6, 1.4, .1], [-2.0, 2.0, 1.52]), B(P.glass, [1.6, 1.4, .1], [2.0, 2.0, 1.52]),
    B(P.doorW, [1.3, 2.2, .14], [0, 1.2, 1.52]),
    ...envelope(2.95, 1.6, .5), ...postBox(2.4)];

  /* ── 시장 ── */
  const stall = (x, z, col, goods) => [CO(col, [1.95, 1.2, 1.95], [x, 3.2, z], { ry: Math.PI / 4 }),
    B(P.woodD, [.14, 2.6, .14], [x - 1.1, 1.3, z + 1.0]), B(P.woodD, [.14, 2.6, .14], [x + 1.1, 1.3, z + 1.0]),
    B(P.wood, [2.3, .9, 1.3], [x, .55, z + .3]), B(goods, [2.0, .25, 1.0], [x, 1.1, z + .3])];
  const mktA = [B(P.sand, [7.4, .16, 7.4], [0, .08, 0]),
    ...stall(-2.0, -1.8, 0xe0574a, C.fruitY), ...stall(2.0, -1.8, 0xf5c542, C.fruitG), ...stall(0, 1.8, 0x4a8fe0, C.fruitR)];
  const tentRow = (z, a, b) => [B(a, [6.6, .16, 1.6], [0, 3.1, z - .65], { rx: -.5 }), B(b, [6.6, .16, 1.6], [0, 3.1, z + .65], { rx: .5 })];
  const mktB = [B(P.sand, [7.4, .16, 7.4], [0, .08, 0]),
    ...tentRow(-1.6, 0xe0574a, 0xfbf6ec), ...tentRow(1.8, 0x3fa66b, 0xfbf6ec),
    B(P.woodD, [.14, 2.8, .14], [-3.2, 1.4, 2.9]), B(P.woodD, [.14, 2.8, .14], [3.2, 1.4, 2.9]), B(P.woodD, [.14, 2.8, .14], [-3.2, 1.4, .7]), B(P.woodD, [.14, 2.8, .14], [3.2, 1.4, .7]),
    B(P.wood, [5.8, .9, 1.2], [0, .55, 1.8]), B(C.fruitR, [1.8, .25, .9], [-1.9, 1.1, 1.8]), B(C.fruitY, [1.8, .25, .9], [0, 1.1, 1.8]), B(C.fruitG, [1.8, .25, .9], [1.9, 1.1, 1.8]),
    B(P.wood, [5.8, .9, 1.2], [0, .55, -1.6]), B(C.fruitO, [2.7, .25, .9], [-1.4, 1.1, -1.6]), B(0xa06ad0, [2.7, .25, .9], [1.4, 1.1, -1.6])];
  const parasol = (x, z, col, goods) => [{ g: 'cone8', c: col, s: [1.9, .8, 1.9], p: [x, 2.9, z] }, B(P.woodD, [.12, 2.6, .12], [x, 1.3, z]),
    B(P.wood, [1.9, .8, 1.1], [x, .5, z + .4]), B(goods, [1.7, .22, .9], [x, .98, z + .4])];
  const mktC = [B(P.sand, [7.4, .16, 7.4], [0, .08, 0]),
    ...parasol(-2.0, -1.8, 0xe0574a, C.fruitY), ...parasol(2.0, -1.8, 0x3fa66b, C.fruitR), ...parasol(-2.0, 2.0, 0xf5c542, C.fruitG), ...parasol(2.0, 2.0, 0x4a8fe0, C.fruitO)];

  /* ── 빵집 ── */
  const bread = (y, z, k) => [SP(C.breadCrust, [1.6 * k, .75 * k, .8 * k], [0, y, z]),
    B(C.breadTop, [.14, .12, 1.2 * k], [-.6 * k, y + .62 * k, z], { rz: 0, ry: .45 }), B(C.breadTop, [.14, .12, 1.2 * k], [0, y + .72 * k, z], { ry: .45 }), B(C.breadTop, [.14, .12, 1.2 * k], [.6 * k, y + .62 * k, z], { ry: .45 })];
  const bakeBody = [
    B(P.stoneD, [6.6, .3, 6.0], [0, .15, -.4]),
    B(C.bakeWall, [6.0, 3.4, 4.6], [0, 1.85, -.8]),
    B(C.choco, [6.3, .45, 4.9], [0, 3.77, -.8]),
    B(P.glass, [2.2, 1.6, .12], [-1.6, 1.7, 1.52]), B(C.breadCrust, [2.0, .3, .3], [-1.6, 1.0, 1.7]),   // 진열창 + 창 앞 빵 선반
    B(P.doorW, [1.1, 2.1, .14], [1.6, 1.15, 1.52]),
    B(0xb5553c, [.8, 1.6, .8], [2.2, 4.6, -2.0]),   // 오븐 굴뚝(벽돌색)
    ...stripes(C.choco, C.bakeWall, 5, 1.6, 2.95, 2.2, 1.6, .45, 6.2)];
  const bakeA = [...bakeBody, ...bread(4.55, -.4, 1.5)];
  const bakeB = [...bakeBody,
    CY(C.bakeWall, [1.5, .22, 1.5], [0, 5.1, 1.2], { rx: Math.PI / 2 }), CY(C.choco, [1.62, .16, 1.62], [0, 5.1, 1.12], { rx: Math.PI / 2 }), B(P.woodD, [.2, 1.2, .2], [0, 4.1, 1.1]),
    ...bread(5.1, 1.5, .8)];

  /* ── 집: 앞마당(흰 말뚝 울타리 + 디딤돌 + 화분) ── */
  const yard = [];   // 가볍게: 낮은 흰 울타리 두 토막 + 디딤돌 + 화단 둘 = 상자 7개(84△)
  yard.push(B(0xfbf8f0, [2.1, .55, .14], [-2.55, .4, 3.65]), B(0xfbf8f0, [2.1, .55, .14], [2.55, .4, 3.65]));
  yard.push(B(P.stoneL, [1.0, .08, 1.6], [0, .06, 3.2]));
  yard.push(B(P.leafL, [1.4, .5, .7], [-2.6, .3, 2.85]), B(0xf58fae, [1.0, .16, .5], [-2.6, .62, 2.85]), B(P.leafL, [1.4, .5, .7], [2.6, .3, 2.85]), B(0xffd166, [1.0, .16, .5], [2.6, .62, 2.85]));
  const houseYard = lv => [{ g: 'glb:' + (lv === 3 ? 'house_lv3' : lv === 2 ? 'house_lv2' : 'house'), c: 'model', s: [1, 1, 1], p: [0, 0, 0] }, ...yard];

  /* ── 일터 소품: 온실·풍차 ── */
  const greenProps = [B(0xc87c52, [.7, .6, .7], [-2.4, .45, 3.3]), SP(P.leaf, [.45, .4, .45], [-2.4, 1.0, 3.3]),
    B(0xc87c52, [.7, .6, .7], [-1.5, .45, 3.5]), SP(P.leafL, [.4, .35, .4], [-1.5, .95, 3.5]),
    B(P.woodD, [1.2, .6, .9], [2.2, .55, 3.3]), B(C.fruitO, [1.0, .2, .7], [2.2, .95, 3.3]), CY(0x3a3a40, [.35, .12, .35], [2.2, .3, 3.95], { rx: Math.PI / 2 })];
  const millProps = [B(0xeee4cc, [.8, 1.0, .6], [-2.0, .75, 3.0]), B(0xeee4cc, [.8, 1.0, .6], [-1.1, .75, 3.2]), B(0xeee4cc, [.8, .9, .6], [-1.55, 1.6, 3.1]),
    B(P.wood, [1.6, .5, 1.1], [2.2, .75, 3.1]), CY(P.woodD, [.45, .12, .45], [1.6, .45, 3.75], { rx: 0, rz: Math.PI / 2 }), CY(P.woodD, [.45, .12, .45], [2.8, .45, 3.75], { rz: Math.PI / 2 }), B(0xeee4cc, [.7, .5, .5], [2.2, 1.2, 3.1])];

  const glbOf = n => ({ g: 'glb:' + n, c: 'model', s: [1, 1, 1], p: [0, 0, 0] });
  const defs = {
    vd_shopA: shopA, vd_shopB: shopB, vd_shopC: shopC, vd_shopR: shopR,
    vd_hospA: hospA, vd_hospB: hospB, vd_hospC: hospC,
    vd_postA: postA, vd_postB: postB, vd_postC: postC,
    vd_mktA: mktA, vd_mktB: mktB, vd_mktC: mktC,
    vd_bakeA: bakeA, vd_bakeB: bakeB,
    vd_house1Y: houseYard(1), vd_house2Y: houseYard(2), vd_house3Y: houseYard(3),
    vd_greenP: null, vd_millP: null
  };
  defs.vd_greenP = v.K.green.parts.concat(greenProps);
  defs.vd_millP = v.K.windmill.parts.concat(millProps);
  const tri = parts => parts.reduce((a, pt) => a + (v.BASE[pt.g] ? v.BASE[pt.g].idx.length / 3 : 0), 0);
  const report = {};
  for (const id in defs) {
    v.K[id] = { nm: id, ic: '🏠', grp: '건물', w: 2, h: 2, g: 0, cap: 99, parts: defs[id] };
    report[id] = { 부위: defs[id].length, 삼각형: tri(defs[id]) };
  }
  report.기준 = { 집1층glb: tri([glbOf('house')]), 집2층: tri([glbOf('house_lv2')]), 집3층: tri([glbOf('house_lv3')]), 가게glb: tri([glbOf('shop')]), 온실: tri(v.K.green.parts), 풍차: tri(v.K.windmill.parts) };
  return report;
})();
```
