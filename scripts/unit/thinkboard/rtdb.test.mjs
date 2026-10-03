// 생각판 RTDB 저장소 시험 — 가짜 Firebase(메모리)로 돌린다. 운영 DB 에 쓰지 않는다.
//  확인: 판 만들기 → 카드 · 공감 · 허락 · 가리기 · 설정 · 지우기가 점 → 슬래시 패치로 1:1 · RTDB 가 빈 객체/배열을 바꿔도 판 모양 복원 · 경로는 classRPG_thinkboard 아래만
//  실행: node scripts/unit/thinkboard/rtdb.test.mjs
import { newBoard, ops } from '../../../thinkboard/js/model.js';
import { BUILTIN } from '../../../thinkboard/js/templates.js';
import { createRtdbStore, normBoard, toSlash, ROOT } from '../../../thinkboard/js/store-rtdb.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

// ── 가짜 RTDB: 빈 객체는 지우고, 배열은 번호 키 객체로(진짜처럼)
const tree = {}, writes = [], listeners = [];
const seg = p => p.split('/').filter(Boolean);
const getAt = p => seg(p).reduce((o, k) => (o == null ? undefined : o[k]), tree);
const toRt = v => { if (v === null || v === undefined) return null; if (Array.isArray(v)) v = Object.fromEntries(v.map((x, i) => [i, x])); if (typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const y = toRt(x); if (y !== null) o[k] = y; } return Object.keys(o).length ? o : null; } return v; };
const prune = (o = tree) => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } };
const setAt = (p, v) => { const ks = seg(p); let o = tree; for (const k of ks.slice(0, -1)) { o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o = o[k]; } const r = toRt(v); if (r === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = r; prune(); };
const fire = () => listeners.forEach(l => l.f({ val: () => clone(getAt(l.p)) }));
const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
const ref = p => ({
  child: c => ref(p + '/' + c),
  set: async v => { writes.push(p); setAt(p, v); fire(); },
  update: async u => { const keys = Object.keys(u); for (const a of keys) for (const b of keys) if (a !== b && b.startsWith(a + '/')) throw new Error('겹치는 경로 ' + a + ' · ' + b); for (const [k, v] of Object.entries(u)) { writes.push(p + '/' + k); setAt(p + '/' + k, v); } fire(); },
  remove: async () => { writes.push(p); setAt(p, null); fire(); },
  once: async () => ({ val: () => clone(getAt(p)) }),
  on: (ev, f) => { listeners.push({ p, f }); f({ val: () => clone(getAt(p)) }); },
  off: (ev, f) => { const i = listeners.findIndex(l => l.f === f); if (i >= 0) listeners.splice(i, 1); },
});
const fake = { apps: [], initializeApp() { this.apps.push(1); }, database: () => ({ ref }) };

const store = createRtdbStore(fake);
const tpl = BUILTIN.find(t => t.id === 'split');
const b0 = newBoard({ title: '시험 판', template: tpl });
await store.create(b0);
let B = await store.get(b0.id);
ok(B && B.title === '시험 판', '만든 판을 다시 읽음');
ok(B.cards && typeof B.cards === 'object' && B.log && B.mail && B.results && B.links, '빈 칸(cards·log…) 복원');
ok(Array.isArray(B.template.zones) && B.template.zones.join() === tpl.zones.join(), '판 틀 칸 배열 복원');
ok(B.settings.layout === 'columns' && B.settings.react === 'heart', '판 틀 설정 그대로');
// [THINKBOARD-HOME-1] 아이 홈 작은 목록(listed) — 판 내용 없이 제목·열림만
const L = () => clone(getAt(ROOT + '/listed')) || {};
ok(L()[b0.id] && L()[b0.id].t === '시험 판' && L()[b0.id].o === true && !('cards' in L()[b0.id]), '만들면 아이 홈 목록에 뜬다(제목만)');

const run = async (name, args, by) => { const r = ops[name](B, { ...args, by }); await store.patch(B.id, r.patch); B = await store.get(B.id); return r.id; };
const c1 = await run('addCard', { text: '좋았어요', zone: '좋은 점', x: 1, y: 2, color: 'yellow' }, '민준');
const c2 = await run('addCard', { text: '아쉬워요', zone: '아쉬운 점', x: 3, y: 4 }, '서연');
ok(Object.keys(B.cards).length === 2 && B.cards[c1].color === 'yellow' && B.cards[c2].zone === '아쉬운 점', '카드 둘');
await run('react', { id: c1 }, '서연'); await run('react', { id: c1 }, '하준');
ok(Object.keys(B.cards[c1].react || {}).length === 2, '공감 둘');
await run('react', { id: c1 }, '하준');
ok(Object.keys(B.cards[c1].react || {}).length === 1, '공감 거둠');
await run('moderate', { id: c2, hidden: true, ok: true }, 'teacher');
ok(B.cards[c2].hidden === true && B.cards[c2].ok === true, '가리기 · 허락');
await run('moderate', { id: c2, hidden: false }, 'teacher');
ok(!B.cards[c2].hidden && B.cards[c2].ok === true, '다시 보이기(허락은 그대로)');
await run('setSettings', { settings: { ...B.settings, open: false, cols: ['가', '나'], images: ['/a.jpg'] } }, 'teacher');
ok(B.settings.open === false && Array.isArray(B.settings.cols) && B.settings.cols.join() === '가,나' && B.settings.images[0] === '/a.jpg', '설정 · 배열 설정 복원');
ok(Object.values(B.log).some(l => l.op === 'settings'), '설정 바꿈이 기록에(연구)');
ok(L()[B.id] && L()[B.id].o === false, '쓰기를 닫으면 아이 홈 목록에도 보기만');
await run('setSettings', { settings: { listed: false } }, 'teacher');
ok(!L()[B.id], '아이들에게 안 보이게 하면 목록에서 빠진다');
await run('setSettings', { settings: { listed: true, prompt: '오늘 질문' } }, 'teacher');
ok(L()[B.id] && L()[B.id].p === '오늘 질문', '다시 보이게 하면 돌아온다 · 질문도');
let w0 = writes.length;
await run('addCard', { text: '목록과 무관한 카드', zone: '좋은 점', x: 0, y: 0 }, '민준');
ok(!writes.slice(w0).some(w => w.startsWith(ROOT + '/listed')), '아이가 카드를 써도 목록은 안 쓴다');
setAt(ROOT + '/listed/ghost', { t: '없는 판' }); setAt(ROOT + '/listed/bad id!', { t: '나쁜 id' });
ok((await store.listOpen()).every(b => /^[\w-]+$/.test(b.id)), '목록 읽기: 이상한 판 id 는 버린다');
await store.reconcileIndex();
ok(!L().ghost && !L()['bad id!'] && L()[B.id], '선생님 화면 맞추기: 없는 판은 빼고 있는 판은 둔다');
w0 = writes.length; await store.reconcileIndex();
ok(writes.length === w0, '맞추기: 같으면 쓰기 0');
await run('editCard', { id: c1, text: '정말 좋았어요' }, '민준');
ok(B.cards[c1].text === '정말 좋았어요' && Object.keys(B.cards[c1].react || {}).length === 1, '고쳐도 공감 남음');
await run('deleteCard', { id: c2 }, '서연');
ok(!B.cards[c2] && B.cards[c1], '지우기');

// 이름에 RTDB 금지 글자(. # $ / [ ])가 있어도 공감 키가 안전
await run('react', { id: c1 }, 'a.b#c$d/e[f]');
ok(Object.keys(B.cards[c1].react).length === 2, '금지 글자 이름 공감');

// 구독 · 목록 · 지우기
let seen = 0; const off = store.subscribe(B.id, b => { if (b) seen++; });
await run('addCard', { text: '셋째', zone: '좋은 점', x: 0, y: 0 }, '지우');
ok(seen >= 2, '구독이 바뀜을 받음'); off();
ok((await store.list()).length === 1 && (await store.findByCode(B.code))?.id === B.id, '목록 · 판 코드');
await store.saveTemplates([{ id: 'x', name: '틀', zones: ['a'], hints: [], ai: '' }]);
ok((await store.templates())[0].zones[0] === 'a', '교사 틀 저장');
await store.remove(B.id);
ok((await store.list()).length === 0, '판 지우기');
ok(!L()[B.id], '판을 지우면 아이 홈 목록에서도');

ok(writes.every(w => w.startsWith(ROOT + '/')), '모든 쓰기는 ' + ROOT + ' 아래 — ' + [...new Set(writes.map(w => w.split('/')[0]))].join(','));
ok(toSlash({ 'cards.c1.react.k': 1, 'x': undefined })['cards/c1/react/k'] === 1 && toSlash({ x: undefined }).x === null, '점 → 슬래시');
ok(normBoard(null) === null, '없는 판');
console.log(`생각판 RTDB 시험 — PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
