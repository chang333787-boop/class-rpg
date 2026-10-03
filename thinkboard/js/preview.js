// [THINKBOARD-PREVIEW-1] 판 틀 미리보기 — 선생님이 새 판을 고를 때 '아이들은 이렇게 봐요'를 예시 카드로 보여 준다.
//  사용자 10-04: "판 만들 때 어떤 걸로 만들지 할 때 미리보기가 안 돼서 불편해 — 담벼락이든 뭐든 미리보기 있어야".
//  저장소 = 이 화면 메모리뿐(만져 볼 수 있지만 어디에도 저장 안 됨 · RPG · 이 브라우저 판 목록과 무관).
import { newBoard, applyPatch, ops } from './model.js';
import { withDefaults, zoneNames } from './settings.js';
import { zoneLayout, slotIn, freeSpot } from './templates.js';

// 판 틀마다 예시 글(없는 틀은 칸 이름으로 만든다)
const SAMPLES = {
  game: { 목표: ['보물 상자 세 개를 먼저 찾기'], 규칙: ['한 번에 한 칸씩 움직여요', '함정 칸을 밟으면 처음으로'], '이기고 지는 것': ['상자 셋 = 이김'], 조작: ['화살표 키로 움직여요'] },
  make3d: { '어디에 쓰나': ['연필꽂이'], 크기: ['높이 8cm'], 모양: ['위가 넓은 컵 모양'], '꼭 지켜야 할 것': ['연필 10자루가 들어가야 해요'] },
  science: { '궁금한 것': ['햇빛을 받으면 더 빨리 자랄까?'], '바꿀 것': ['햇빛 받는 시간'], '같게 할 것': ['물의 양', '흙의 양'], 예상: ['햇빛을 오래 받은 콩이 더 커요'] },
  meeting: { 문제: ['쉬는 시간 공 쓰는 순서'], 의견: ['요일마다 모둠을 정해요', '먼저 온 사람이 써요'], 결정: [] },
  split: { '좋은 점': ['친구와 같이 해서 재밌었어요'], '아쉬운 점': ['시간이 모자랐어요'], '궁금한 점': ['다음엔 무엇을 만들까요?'] },
};
const WALL = {
  opinion: ['급식에 과일이 더 나왔으면 좋겠어요', '운동장 그늘이 더 있으면 좋겠어요', '도서관에 만화책 코너가 있으면 좋겠어요', '아침 독서 시간이 좋아요', '쉬는 시간이 조금 더 길었으면'],
  askq: ['공룡은 왜 사라졌을까?', '별은 왜 반짝여요?', '물고기도 잠을 자요?', '하늘은 왜 파래요?'],
  exit: ['나눗셈 나머지를 알게 됐어요', '분수가 아직 헷갈려요', '모둠 친구 설명이 도움이 됐어요'],
  spot: ['오른쪽 그림엔 새가 날아요', '해 색이 달라요', '집 창문이 하나 없어요'],
  free: ['생각 하나', '생각 둘', '생각 셋'],
};

// 달라진 점 찾기 예시 그림 두 장(작은 SVG — 오른쪽엔 새 한 마리 · 해 색 · 창문 하나가 다르다)
const scene = diff => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
<rect width="400" height="260" fill="#cfe8ff"/><rect y="190" width="400" height="70" fill="#9fd08a"/>
<circle cx="330" cy="56" r="28" fill="${diff ? '#ff9f43' : '#ffd43b'}"/>
<rect x="70" y="110" width="140" height="90" fill="#f4d9b0" stroke="#7a5a3a" stroke-width="3"/><polygon points="60,112 140,58 220,112" fill="#d9534f"/>
<rect x="92" y="132" width="34" height="30" fill="#8ec5ff" stroke="#7a5a3a" stroke-width="2"/>${diff ? '' : '<rect x="156" y="132" width="34" height="30" fill="#8ec5ff" stroke="#7a5a3a" stroke-width="2"/>'}
<rect x="280" y="130" width="16" height="64" fill="#8b5a2b"/><circle cx="288" cy="118" r="34" fill="#4caf50"/>
${diff ? '<path d="M240 70 q10 -10 20 0 q10 -10 20 0" stroke="#333" stroke-width="3" fill="none"/>' : ''}</svg>`);

export function sampleBoard(tpl) {
  const b = newBoard({ title: tpl.name, template: tpl });
  const st = withDefaults(b.settings);
  //  친구 카드를 안 보이는 판(출구 카드)은 예시를 '내 카드'로 — 미리보기에서 아무것도 안 보이면 모양을 알 수 없다
  const by = st.others === false ? '미리보기' : '예시', run = (name, args) => { const r = ops[name](b, { by, ...args }); applyPatch(b, r.patch); return r; };
  if (st.layout === 'pins' && !(st.images || []).length) b.settings.images = [scene(false), scene(true)];
  if (st.layout === 'story') {
    const story = st.seqWords !== 'steps';
    const mz = zoneNames(b).filter(z => !['사건', '선택', '단계'].includes(z));
    const mats = story ? [['인물', '토리'], ['인물', '몽이'], ['장소', '달빛 숲']] : [['준비물', '냄비'], ['준비물', '라면']];
    const ids = mats.filter(([z]) => mz.includes(z)).map(([z, t]) => run('addCard', { text: t, zone: z, x: 0, y: 0 }).id);
    const zone = zoneNames(b).includes('단계') ? '단계' : '사건';
    if (story) {
      const s1 = run('addAfter', { text: '달빛 숲에 토리가 살았어요', spine: '옛날 옛적에', zone });
      if (ids[0]) run('tagCard', { id: s1.id, mat: ids[0], on: true });
      if (ids[2]) run('tagCard', { id: s1.id, mat: ids[2], on: true });
      const s2 = run('addAfter', { after: s1.id, text: '별 하나가 떨어져 빛을 잃었어요', spine: '그러던 어느 날', zone });
      if (st.branch) {
        const br = run('addBranch', { after: s2.id, q: '별을 살리려면?', opts: ['얼음 동굴의 요정에게 간다', '숲 친구들을 모은다'] });
        const a = run('addAfter', { after: br.ids[0], text: '요정이 빛 한 줌을 줬어요', spine: '그래서', zone });
        run('setEnd', { id: a.id, end: true });
      } else run('addAfter', { after: s2.id, text: '토리는 별을 찾아 길을 떠났어요', spine: '그래서', zone });
    } else {
      const s1 = run('addAfter', { text: '냄비에 물을 500mL 붓고 끓여요', spine: '먼저', zone });
      if (ids[0]) run('tagCard', { id: s1.id, mat: ids[0], on: true });
      const s2 = run('addAfter', { after: s1.id, text: '물이 끓으면 면과 수프를 넣어요', spine: '그다음', zone });
      if (ids[1]) run('tagCard', { id: s2.id, mat: ids[1], on: true });
      run('addAfter', { after: s2.id, text: '4분 뒤 불을 꺼요', spine: '마지막으로', zone });
    }
    return b;
  }
  if (st.layout === 'tree') {
    const r = run('addChild', { text: '현장학습 준비' });
    const a = run('addChild', { parent: r.id, text: '준비물' });
    run('addChild', { parent: a.id, text: '물병' }); run('addChild', { parent: a.id, text: '도시락' });
    const c = run('addChild', { parent: r.id, text: '지킬 것' });
    run('addChild', { parent: c.id, text: '모둠끼리 다녀요' });
    return b;
  }
  const zones = zoneNames(b), sample = SAMPLES[tpl.id] || {};
  if (st.layout === 'columns' || st.layout === 'canvas') {
    const zl = zoneLayout(b);
    for (const z of zones.length ? zones : ['']) {
      const list = sample[z] || (z ? [`${z} 예시 카드`] : WALL.free);
      for (const text of list) {
        const p = st.layout === 'canvas' ? (z && slotIn(b, zl, z)) || freeSpot(b, 40, 40) : { x: 0, y: 0 };
        run('addCard', { text, zone: z, x: p.x, y: p.y });
      }
    }
    if (tpl.id === 'story' || zones.includes('선택')) {   // 옛 이야기 틀(자유 배치) — 화살표 하나
      const cs = Object.values(b.cards); if (cs.length > 1) run('addLink', { from: cs[0].id, to: cs[1].id });
    }
    return b;
  }
  const texts = (WALL[tpl.id] || WALL.free).slice(0, st.limit > 0 ? st.limit : 9);
  const PINS = [{ i: 1, x: 65, y: 27 }, { i: 1, x: 82, y: 21 }, { i: 1, x: 43, y: 56 }];   // 예시 그림(오른쪽)에서 실제로 다른 곳
  texts.forEach((text, i) => run('addCard', { text, x: 0, y: 0, ...(st.layout === 'pins' ? { pin: PINS[i] || { i: 0, x: 20 + i * 20, y: 40 } } : {}) }));
  return b;
}

// 메모리 저장소 — store.js 와 같은 모양(판 하나)
export function memoryStore(board) {
  const subs = new Set();
  return {
    kind: 'memory',
    async list() { return [board]; }, async get() { return board; }, async create() { return board; }, async findByCode() { return board; },
    subscribe(id, cb) { subs.add(cb); cb(board); return () => subs.delete(cb); },
    watchAll() { return () => {}; },
    async patch(id, patch) { if (!Object.keys(patch).length) return; applyPatch(board, patch); for (const cb of subs) cb(board); },
    async remove() {}, async templates() { return []; }, async saveTemplates() {},
  };
}
