// 판 틀 — 프로젝트마다 갈아 끼우는 '데이터'. 엔진 코드는 그대로.
//  settings : 설정 틀(settings.js 표)에서 미리 골라 둔 값 — 없으면 표의 기본값
import { zoneNames } from './settings.js';
//  zones  : 구역 이름(빈 배열 = 빈 판)
//  hints  : 바로 뜨는 힌트(AI 없음)  { zone, empty } · { zone, min, msg } · { linksFrom: zone, msg }
//  ai     : AI에게 주는 이번 활동 한 줄(공통 규칙은 export.js)
//  mail   : 우편함 단계 'qs'(질문+제안) · 'q'(질문만) · 'off'
//  unit   : 'group'(모둠 판) · 'solo'(개인 판) · 'class'(학급 전체)
export const BUILTIN = [
  {
    // [THINKBOARD-STORY-1] 사건 중심 — 사건 카드를 차례로 잇고(이야기 줄), 고르는 장면에서 길이 갈린다. 인물 · 장소는 선반에서 사건에 붙인다.
    id: 'story', name: '이야기 만들기', icon: '📖', unit: 'group', mail: 'qs',
    zones: ['장소', '인물', '사건', '선택'],
    hints: [
      { zone: '인물', min: 2, msg: '인물이 한 명뿐이에요' },
      { zone: '선택', empty: '고르는 장면이 아직 없어요' },
      { linksFrom: '선택', msg: '고른 다음 어떻게 되는지 화살표가 없어요' },
    ],
    ai: '사건과 사건 사이의 이유(왜 그렇게 됐는지)와, 고른 다음에 어떻게 되는지가 빠진 곳을 물어봐 주세요.',
    settings: { layout: 'story', seqWords: 'story', branch: true, maxLen: 80 },
  },
  {
    id: 'game', name: '게임 만들기', icon: '🎮', unit: 'group', mail: 'qs',
    zones: ['목표', '규칙', '이기고 지는 것', '조작'],
    hints: [
      { zone: '목표', empty: '무엇을 하면 되는 게임인지 아직 없어요' },
      { zone: '이기고 지는 것', min: 2, msg: '이기는 것과 지는 것이 둘 다 있나요?' },
      { zone: '조작', empty: '어떻게 움직이는지 아직 없어요' },
    ],
    ai: '규칙끼리 부딪히는 곳, 빠진 조건(언제·몇 번·어떻게 되면), 이기고 지는 기준이 애매한 곳을 물어봐 주세요.',
  },
  {
    id: 'make3d', name: '3D로 만들기', icon: '🧊', unit: 'solo', mail: 'qs',
    zones: ['어디에 쓰나', '크기', '모양', '꼭 지켜야 할 것'],
    hints: [
      { zone: '크기', empty: '몇 cm인지 아직 없어요' },
      { zone: '꼭 지켜야 할 것', empty: '실제로 쓸 때 지켜야 할 것이 없어요' },
    ],
    ai: '실제 물건으로 뽑았을 때 생길 문제(들어가는지·서 있는지·손에 잡히는지·치수)를 물어봐 주세요.',
  },
  {
    id: 'science', name: '실험 계획', icon: '🔬', unit: 'group', mail: 'qs',
    zones: ['궁금한 것', '바꿀 것', '같게 할 것', '예상'],
    hints: [
      { zone: '같게 할 것', empty: '똑같이 맞출 조건이 아직 없어요' },
      { zone: '바꿀 것', empty: '무엇을 바꿔 볼지 아직 없어요' },
    ],
    ai: '공정한 실험인지(바꿀 것이 하나인지, 같게 할 조건이 빠지지 않았는지)와 결과를 어떻게 잴지 물어봐 주세요.',
  },
  {
    id: 'meeting', name: '학급회의', icon: '🗳️', unit: 'class', mail: 'q',
    zones: ['문제', '의견', '결정'],
    hints: [{ zone: '결정', empty: '아직 정한 것이 없어요' }],
    ai: '아직 나오지 않은 입장, 결정을 지키는 방법, 결정이 다른 사람에게 미치는 영향을 물어봐 주세요.',
  },
  {
    id: 'free', name: '자유 판', icon: '🌱', unit: 'group', mail: 'q',
    zones: [], hints: [],
    ai: '아이들이 무엇을 만들려는지 판에서 읽고, 아직 정하지 않은 중요한 것만 물어봐 주세요.',
  },
];

// ─ [THINKBOARD-STORY-1] 이야기 말고 일반 주제에도 — 차례 줄(과정 · 절차) · 주제 나무(노션처럼 주제 밑에 넣기)
BUILTIN.push(
  {
    id: 'steps', name: '차례 줄(과정 · 절차)', icon: '🪜', unit: 'group', mail: 'q', zones: ['준비물', '단계'], hints: [],
    ai: '빠진 단계, 단계의 차례가 바뀌면 생기는 문제, 준비물이 쓰이는 때를 물어봐 주세요.',
    settings: { layout: 'story', seqWords: 'steps', branch: false, maxLen: 80 },
  },
  {
    id: 'outline', name: '주제 나무(노션처럼)', icon: '🌳', unit: 'group', mail: 'q', zones: [], hints: [],
    ai: '주제 밑에 아직 비어 있는 갈래, 같은 층에 섞여 있는 다른 층의 생각을 물어봐 주세요.',
    settings: { layout: 'tree', maxLen: 80, unknown: true },
  },
);

// ─ 설정 틀을 미리 골라 둔 판 틀(패들렛식 · 반 전체 판). 엔진은 같고 settings 만 다르다(settings.js 표의 값).
BUILTIN.push(
  {
    id: 'opinion', name: '자유 의견 담벼락', icon: '🧱', unit: 'class', mail: 'off', zones: [], hints: [],
    ai: '아이들 의견에서 아직 나오지 않은 관점을 물어봐 주세요.',
    settings: { layout: 'wall', names: 'show', react: 'heart', colors: true, unknown: false, links: false, move: 'none', edit: 'own', maxLen: 140, sort: 'new', hints: false },
  },
  {
    id: 'split', name: '칸 나누기', icon: '🗂️', unit: 'class', mail: 'off', zones: ['좋은 점', '아쉬운 점', '궁금한 점'], hints: [],
    ai: '칸마다 아직 나오지 않은 생각을 물어봐 주세요.',
    settings: { layout: 'columns', names: 'show', react: 'heart', unknown: false, links: false, move: 'own', edit: 'own', maxLen: 80, hints: false },
  },
  {
    id: 'spot', name: '달라진 점 찾기', icon: '🔍', unit: 'class', mail: 'off', zones: [], hints: [],
    ai: '아이들이 찾은 달라진 점에서 "왜 달라졌을까"를 물어봐 주세요.',
    settings: { layout: 'pins', names: 'show', react: 'heart', unknown: true, links: false, move: 'own', edit: 'own', maxLen: 80, hints: false,
      prompt: '두 그림에서 달라진 곳을 찾아 핀을 꽂고, 무엇이 달라졌는지 써요' },
  },
  {
    id: 'askq', name: '질문 모으기', icon: '🙋', unit: 'class', mail: 'off', zones: [], hints: [],
    ai: '아이들 질문을 묶을 수 있는 큰 질문을 하나 제안해 주세요.',
    settings: { layout: 'wall', names: 'anon', react: 'heart', unknown: false, links: false, move: 'none', edit: 'own', maxLen: 80, sort: 'new', hints: false },
  },
  {
    id: 'exit', name: '출구 카드', icon: '🚪', unit: 'class', mail: 'off', zones: [], hints: [],
    ai: '아이들이 쓴 한 줄에서 다음 시간에 짚을 것을 물어봐 주세요.',
    settings: { layout: 'wall', names: 'show', others: false, limit: 1, react: 'off', unknown: false, links: false, move: 'none', edit: 'own', maxLen: 80, hints: false,
      prompt: '오늘 배운 것 한 줄' },
  },
);

// ─ 구역 배치: 가로로 나란한 세로 칸
export const ZW = 230, ZGAP = 26, ZHEAD = 52, SLOT = 74, CW = 170;

export function zoneLayout(board) {
  const names = board.settings.zones ? zoneNames(board) : [];
  return names.map((name, i) => ({ name, x: i * (ZW + ZGAP), y: 0, w: ZW }));
}

export function zoneAt(zones, x, y) {
  const z = zones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y);
  return z ? z.name : '';
}

// 카드 높이 어림(글 길이로) — 모델에는 실제 높이가 없어서
export const estH = c => 28 + Math.ceil(((c.kind === 'unknown' ? 2 : 0) + [...(c.text || '')].length) / 8.5) * 24;

// 구역 안 빈자리(아래로 쌓기)
export function slotIn(board, zones, name) {
  const z = zones.find(z => z.name === name);
  if (!z) return null;
  const inZone = Object.values(board.cards).filter(c => c.zone === name);
  const bottom = inZone.reduce((m, c) => Math.max(m, c.y + estH(c) + 14), z.y + ZHEAD + 8);
  return { x: z.x + (ZW - CW) / 2, y: bottom };
}

// (x, y) 근처에서 다른 카드와 겹치지 않는 자리 — 바깥으로 돌며 찾기
export function freeSpot(board, x, y, h = 60) {
  const cards = Object.values(board.cards);
  const hit = (px, py) => cards.some(c => px < c.x + CW + 10 && px + CW + 10 > c.x && py < c.y + estH(c) + 10 && py + h + 10 > c.y);
  for (let r = 0; r < 14; r++) {
    for (let k = 0; k < Math.max(1, r * 6); k++) {
      const a = (k / Math.max(1, r * 6)) * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r * 60), py = Math.round(y + Math.sin(a) * r * 44);
      if (!hit(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}

// 바로 뜨는 힌트 → { 구역이름: '글' }
export function evalHints(board) {
  if (!board.settings.hints) return {};
  const out = {};
  const cards = Object.values(board.cards).filter(c => c.kind !== 'unknown');
  const inZ = z => cards.filter(c => c.zone === z);
  for (const hn of board.template.hints || []) {
    if (hn.empty && inZ(hn.zone).length === 0) out[hn.zone] ??= hn.empty;
    else if (hn.min && inZ(hn.zone).length > 0 && inZ(hn.zone).length < hn.min) out[hn.zone] ??= hn.msg;
    else if (hn.linksFrom) {
      const list = inZ(hn.linksFrom);
      if (list.length && list.some(c => !Object.values(board.links).some(l => l.from === c.id))) out[hn.linksFrom] ??= hn.msg;
    }
  }
  return out;
}
