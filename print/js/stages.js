// 판화 놀이 판 정본 — 1장 판화는 거울(좌우가 바뀐다) · 2장 파낸 곳은 하얗게(남긴 곳에만 잉크) · 3장 찍어 보기(잉크 · 종이 · 문지르기 · 떼기 · 여러 장) · 4장 판화 감상(명화 탐정)
//  교과서 8종이 4학년에 판화(찍기 · 종이 · 스티로폼 · 고무판)를 둔다 — docs/art34_analysis.md. 판 모양은 block.js 칸 모양(DOM 없음) · 글자 판(fillText)만 그림 쪽(draw.js)
import { N, shape, mirror, invert, or, minus, and, dilate, erode, band, any, circle, ellipse, polygon, star, rect, wave, both, blank } from './block.js';

export const CHAPTERS = [
  { id: 1, title: '판화는 거울', concept: '좌우가 바뀌어요', intro: '판에 새긴 그림은 종이에 찍으면 거울처럼 좌우가 바뀌어요. 글자를 바르게 찍으려면 판에는 어떻게 새겨야 할까요?' },
  { id: 2, title: '파낸 곳은 하얗게', concept: '남긴 곳에 잉크', intro: '롤러는 판의 높은 면에만 잉크를 발라요. 파낸 곳은 종이색 그대로 — 흰 별을 찍을까, 검은 공을 찍을까?' },
  { id: 3, title: '찍어 보기', concept: '잉크 · 문지르기 · 여러 장', intro: '롤러로 잉크를 바르고, 종이를 덮고, 바렌으로 문질러 떼어 내요. 같은 판으로 색을 바꿔 여러 장 찍어 봐요.' },
  { id: 4, title: '판화 감상', concept: '명화 탐정', intro: '옛사람들도 나무판에 거꾸로 새겨 그림과 책을 찍었어요. 명화 탐정에서 판화 작품을 자세히 봐요.' },
];

// ── 모양(칸 좌표 0~96) ──
const BIRD = any(ellipse(44, 54, 22, 15, -0.15), circle(66, 38, 10), polygon([[74, 35], [88, 40], [74, 44]]), polygon([[25, 52], [6, 40], [9, 62]]), rect(41, 64, 44, 80), rect(50, 64, 53, 80));
const BIRD_EYE = circle(66.5, 36, 2.4);
const fishR = (cx, cy) => any(ellipse(cx, cy, 20, 11), polygon([[cx - 18, cy], [cx - 33, cy - 11], [cx - 33, cy + 11]]));
const eyeR = (cx, cy) => circle(cx + 11, cy - 3, 2.3);
const FLOWER = any(...Array.from({ length: 6 }, (_, k) => ellipse(48 + Math.cos(k * Math.PI / 3) * 17, 40 + Math.sin(k * Math.PI / 3) * 17, 11, 6.5, k * Math.PI / 3)), circle(48, 40, 8));
const STEM = rect(46.5, 52, 49.5, 88);
const STAR = star(48, 50, 36, 15);
const BALL = circle(48, 48, 23);
const INNER = rect(3, 3, 93, 93);

// 판(0 = 남은 면 · 1 = 파낸 곳)
export const blocks = {
  bird: () => or(invert(shape(BIRD)), shape(BIRD_EYE)),                       // 새만 남기고 둘레를 팜(새가 잉크) · 눈은 판 구멍
  fishGuideR: () => shape(fishR(56, 26)), fishGuideL: () => mirror(shape(fishR(52, 70))),   // 1-4 연한 밑그림 둘(위 = 오른쪽 보는 물고기 · 아래 = 왼쪽 보는 물고기)
  flowerLines: () => or(band(shape(FLOWER), 1.3), shape(STEM)),                 // 꽃을 선으로 판 판(선이 흰색으로 찍힘)
  starGuide: () => shape(STAR), ballGuide: () => shape(BALL),
  ballCarved: () => shape(BALL), ballOutside: () => minus(shape(INNER), shape(BALL)), ballHalf: () => and(shape(BALL), shape(rect(0, 0, 48, 96))),
  pressFish: () => or(invert(shape(any(fishR(52, 40), wave(76, 4, 32, 5), wave(88, 4, 32, 5, 1.6)))), shape(eyeR(52, 40))),
  flowerStamp: () => invert(shape(any(FLOWER, STEM, ellipse(36, 70, 10, 4.5, -0.6), ellipse(60, 66, 10, 4.5, 0.6)))),
  plain: () => blank(),
};

// 새기기 판의 채점 범위 — must = 파야 할 곳 · keep = 남겨야 할 곳 · other = 반대로 판 곳(거울 실수)
export const specs = {
  '1-4': () => { const L = blocks.fishGuideL(), R = blocks.fishGuideR(); return { must: band(L, 1.6), other: band(R, 1.6), need: 0.6, otherMax: 0.25 }; },
  '2-3': () => { const s = blocks.starGuide(); return { must: erode(s, 1.2), keep: and(minus(blank().fill(1), dilate(s, 2)), shape(INNER)), need: 0.7, overMax: 0.12 }; },
  '2-4': () => { const b = blocks.ballGuide(); return { must: minus(shape(INNER), dilate(b, 2)), keep: erode(b, 1.2), need: 0.75, overMax: 0.12 }; },
};

export const INKS = [['black', '먹 검정', '#1d1c21'], ['navy', '남색', '#233b7a'], ['red', '빨강', '#b8312f'], ['green', '초록', '#2f7a4a'], ['orange', '주황', '#d97a2b'], ['purple', '보라', '#6b3fa0']];

export const ST = [
  // ── 1장 ──
  { id: '1-1', ch: 1, kind: 'predict', title: '새는 어느 쪽을 볼까', block: 'bird',
    story: '판에 오른쪽을 보는 새를 새겼어요(새만 남기고 둘레를 팠어요). 잉크를 발라 종이에 찍으면 어떻게 나올까요?',
    opts: [['same', '판과 똑같이 오른쪽'], ['mirror', '좌우가 바뀌어 왼쪽'], ['flip', '위아래가 뒤집혀'], ['invert', '흰 새로 바뀌어']], answer: 1,
    say: { same: '찍을 때 판을 엎어 종이에 대요 — 그래서 그대로 나오지 않아요.', flip: '판을 위아래로 뒤집지는 않아요 — 옆으로 엎어요.', invert: '새 모양 면에 잉크가 묻었으니 새가 잉크색이에요.' },
    hint: '판을 종이에 엎어서 찍어요. 손바닥에 물감을 묻혀 찍어 보면 — 엄지가 반대쪽에 찍혀요!', why: '판을 엎어 찍으니 종이에는 거울처럼 좌우가 바뀌어 나와요. 오른쪽을 보던 새가 왼쪽을 봐요.' },
  { id: '1-2', ch: 1, kind: 'predict', title: '글자 ‘가’를 찍으면', block: 'text:가',
    story: '판에 ‘가’를 바르게 새겼어요(글자만 남기고 둘레를 팠어요). 찍으면 종이에 어떻게 나올까요?',
    opts: [['same', '바른 ‘가’'], ['mirror', '거울 글씨(좌우가 바뀐 ‘가’)'], ['flip', '위아래가 뒤집힌 ‘가’']], answer: 1,
    say: { same: '판에 바르게 새긴 글자는 찍으면 바르게 나오지 않아요.', flip: '위아래는 그대로예요 — 좌우만 바뀌어요.' },
    hint: '1-1의 새를 떠올려요 — 무엇이 바뀌었나요?', why: '판에 바르게 새기면 종이에는 거울 글씨로 찍혀요. 도장도 그래서 거꾸로 새겨요.' },
  { id: '1-3', ch: 1, kind: 'choose', title: '바르게 찍히는 판', target: 'text:해',
    story: '종이에 ‘해’가 바르게 찍히게 하려면 판에 어떻게 새겨야 할까요? 알맞은 판을 골라요.',
    opts: [['same', '바른 ‘해’를 새긴 판'], ['mirror', '거울 글씨 ‘해’를 새긴 판'], ['flip', '위아래가 뒤집힌 ‘해’를 새긴 판']], answer: 1,
    say: { same: '이 판으로 찍으면 거울 글씨가 나와요.', flip: '이 판으로 찍으면 거꾸로 선 거울 글씨가 나와요.' },
    hint: '찍으면 좌우가 한 번 바뀌어요. 종이에 바르게 나오려면 판에는 미리 한 번 바꿔 두어야 해요.', why: '판에는 거울 글씨로 새겨야 종이에 바르게 찍혀요. 옛날 책을 찍던 나무판도 그랬어요.' },
  { id: '1-4', ch: 1, kind: 'carve', title: '오른쪽 보는 물고기', guides: ['fishGuideR', 'fishGuideL'], tool: 'v', target: 'print:fishR',
    story: '종이에 오른쪽을 보는 물고기가 찍히게 하고 싶어요. 판 위 연한 밑그림 두 마리 가운데 한 마리를 골라, 세모칼로 테두리를 따라 파요.',
    hint: '종이에는 판과 반대로 찍혀요 — 판에서는 왼쪽을 보는 물고기를 파야 해요.', why: '판에서 왼쪽을 보던 물고기가 종이에는 오른쪽을 보며 찍혔어요. 판화는 언제나 한 번 뒤집어 생각해요.' },
  // ── 2장 ──
  { id: '2-1', ch: 2, kind: 'predict', title: '파낸 선의 색', block: 'flowerLines', swatch: true,
    story: '판에 꽃을 선으로 팠어요. 잉크를 바르고 찍으면 파낸 선은 종이에 무슨 색으로 나올까요?',
    opts: [['ink', '잉크색(검정)'], ['paper', '종이색(하양)'], ['gray', '회색'], ['half', '반은 검정 · 반은 하양']], answer: 1,
    say: { ink: '롤러는 파낸 홈 속까지 닿지 않아요 — 잉크가 안 묻어요.', gray: '잉크가 아예 안 묻으니 회색도 아니에요.', half: '파낸 선은 어디든 잉크가 안 묻어요.' },
    hint: '롤러는 판의 높은 면만 굴러가요. 파낸 홈은 낮아서 …', why: '파낸 곳에는 잉크가 묻지 않아 종이색 그대로 — 꽃이 흰 선으로 찍혀요.' },
  { id: '2-2', ch: 2, kind: 'choose', title: '검은 공을 찍으려면', target: 'print:ball',
    story: '흰 종이에 검은 공이 찍히게 하려면 판의 어디를 파야 할까요? 알맞은 판을 골라요.',
    opts: [['ballCarved', '공 모양을 판 판'], ['ballOutside', '공 둘레를 판 판'], ['plain', '아무 데도 안 판 판'], ['ballHalf', '공 왼쪽 반만 판 판']], answer: 1,
    say: { ballCarved: '공을 파면 공이 하얗게, 둘레가 검게 찍혀요.', plain: '안 파면 판 전체가 검게 찍혀요.', ballHalf: '판 곳은 하얗게 — 공 반쪽이 하얗게 비어요.' },
    hint: '검게 찍힐 곳은 남기고, 하얗게 비울 곳을 파요.', why: '검게 찍고 싶은 공은 남기고 둘레를 파요. 남긴 곳 = 잉크색 · 판 곳 = 종이색.' },
  { id: '2-3', ch: 2, kind: 'carve', title: '흰 별 찍기', guides: ['starGuide'], tool: 'u', target: 'print:starWhite',
    story: '검은 종이에 하얀 별이 반짝이게 찍고 싶어요. 밑그림을 보고 어디를 팔지 생각해 둥근칼로 파요.',
    hint: '하얗게 나올 곳 = 파낸 곳. 별 안을 파요 — 별 밖은 남겨야 검게 찍혀요.', why: '별 안을 파냈더니 별에는 잉크가 안 묻어 하얗게, 남긴 둘레는 검게 찍혔어요.' },
  { id: '2-4', ch: 2, kind: 'carve', title: '검은 공 찍기', guides: ['ballGuide'], tool: 'u', target: 'print:ball',
    story: '이번에는 흰 종이에 검은 공이 찍히게! 밑그림을 보고 둥근칼로 파요. 넓게 파야 해요 — 힘내요.',
    hint: '검게 나올 공은 남기고, 공 둘레를 모두 파요.', why: '둘레를 다 파내니 남긴 공에만 잉크가 묻어 검은 공이 찍혔어요. 판화는 남길 곳과 팔 곳을 먼저 정해요.' },
  // ── 3장 ──
  { id: '3-1', ch: 3, kind: 'press', title: '잉크 · 종이 · 문지르기', block: 'pressFish',
    story: '미리 판 물고기 판이에요. 롤러로 잉크를 고르게 바르고, 종이를 덮고, 바렌으로 꼼꼼히 문질러 떼어 내요.',
    hint: '롤러를 판 위로 여러 번 굴려 잉크가 판 전체에 묻게 해요. 바렌도 종이 구석구석 문질러요.', why: '잉크를 고르게 바르고 꼼꼼히 문질러야 깨끗하게 찍혀요. 덜 바르거나 덜 문지른 곳은 하얗게 비어요.' },
  { id: '3-2', ch: 3, kind: 'multi', title: '한 판으로 세 장', block: 'flowerStamp', need: 3,
    story: '판 하나로 몇 장이든 찍을 수 있어요. 잉크 색을 바꿔 가며 세 장을 찍어 봐요.',
    hint: '색을 고르고 ‘찍기’를 눌러요 — 세 장을 찍으면 끝.', why: '같은 판으로 여러 장 — 판화만의 힘이에요(복수성). 색만 바꿔도 느낌이 달라져요.' },
  { id: '3-3', ch: 3, kind: 'free', title: '나만의 판화', block: 'plain',
    story: '빈 판에 마음대로 새겨요. 이름을 새긴다면 — 종이에 바르게 나오게 하려면? ‘찍으면 이렇게’ 창을 보며 새겨요.',
    hint: '글자는 거울 글씨로 새겨요. 넓게 남긴 곳은 잉크색, 판 곳은 종이색.', why: '나만의 판으로 찍었어요! 판은 남아 있으니 언제든 또 찍을 수 있어요.' },
];
// 4장 = 명화 탐정 판화 사건(art/js/cases.js 의 같은 id)
export const PRINT_CASES = [
  { id: 'rhinoceros', title: '코뿔소', artist: '알브레히트 뒤러', say: '나무판으로 찍은 코뿔소 — 직접 보고 그렸을까?' },
  { id: 'hunmin', title: '훈민정음 해례본', artist: '세종 때(1446)', say: '나무판에 새긴 한글 — 판에는 어떻게 새겼을까?' },
  { id: 'great_wave', title: '가나가와 해변의 높은 파도', artist: '가쓰시카 호쿠사이', say: '색마다 판을 따로 새겨 겹쳐 찍은 판화' },
];
export const stById = id => ST.find(s => s.id === id);
export const stOf = ch => ST.filter(s => s.ch === ch);
export { N };
