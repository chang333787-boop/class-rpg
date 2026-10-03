// [THINKBOARD-STORY-1] 이야기 줄(사건 중심) · 나무(노션식) 시험 — 판 동작(패치) · 줄 읽기 · 코치 · 정리본
//  node scripts/unit/thinkboard/story.test.mjs   (DOM 없음 · 네트워크 없음)
import { newBoard, applyPatch, ops, storyGraph, storyCoach, optLetter, treeOf } from '../../../thinkboard/js/model.js';
import { BUILTIN } from '../../../thinkboard/js/templates.js';
import { boardOutline, boardToText, storyLines } from '../../../thinkboard/js/export.js';
import { withDefaults, LAYOUTS, SEQ_WORDS } from '../../../thinkboard/js/settings.js';

const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const tpl = id => BUILTIN.find(t => t.id === id);
const run = (b, name, args) => { const r = ops[name](b, { by: '아이', sid: 's1', ...args }); applyPatch(b, r.patch); return r; };
const textOf = (b, id) => b.cards[id].text;

function storyBoard() {
  const b = newBoard({ title: '별을 찾는 토리', template: tpl('story') });
  const who = run(b, 'addCard', { text: '토리', zone: '인물', x: 0, y: 0 }), mong = run(b, 'addCard', { text: '몽이', zone: '인물', x: 0, y: 0 });
  const s1 = run(b, 'addAfter', { text: '달빛 숲에 토리가 살았어요', spine: '옛날 옛적에' });
  const s2 = run(b, 'addAfter', { after: s1.id, text: '별 하나가 떨어졌어요', spine: '그러던 어느 날' });
  const br = run(b, 'addBranch', { after: s2.id, q: '별을 살리려면?', opts: ['얼음 동굴로', '숲 친구들과'] });
  const a1 = run(b, 'addAfter', { after: br.ids[0], text: '요정이 빛을 줬어요', spine: '그래서' });
  return { b, who, mong, s1, s2, br, a1 };
}

test('판 틀 — 이야기 만들기 = 이야기 줄 · 차례 줄 · 주제 나무', () => {
  ok(withDefaults(tpl('story').settings).layout === 'story', '이야기 만들기 기본이 이야기 줄이 아님');
  ok(withDefaults(tpl('steps').settings).seqWords === 'steps' && withDefaults(tpl('steps').settings).branch === false, '차례 줄');
  ok(withDefaults(tpl('outline').settings).layout === 'tree', '주제 나무');
  ok(LAYOUTS.story && LAYOUTS.tree && SEQ_WORDS.story.includes('그러던 어느 날'), '설정 표');
});
test('이야기 줄 — 차례 · 갈림길 A/B · 끝 없는 길 코치', () => {
  const { b, s1, s2, br, a1 } = storyBoard();
  const g = storyGraph(b);
  ok(g.start.id === s1.id, '시작이 첫 사건이 아님');
  ok(g.pos.get(s1.id).col === 0 && g.pos.get(s2.id).col === 1 && g.pos.get(br.id).col === 2, '차례');
  ok(optLetter(g, br.ids[0]) === 'A' && optLetter(g, br.ids[1]) === 'B' && optLetter(g, a1.id) === '', '갈림길 이름');
  ok(g.pos.get(br.ids[0]).row !== g.pos.get(br.ids[1]).row, '갈래가 같은 자리');
  ok(g.mats.length === 2 && g.nodes.length === 6, `재료 ${g.mats.length} · 줄 ${g.nodes.length}`);
  const coach = storyCoach(b, g);
  ok(coach.some(t => t.includes('A 길') && t.includes('B 길')), '끝 없는 길 코치: ' + coach.join(' / '));
  ok(coach.some(t => t.includes('인물')), '인물 붙이기 코치');
});
test('끝 · 이어 주는 말 · 인물 붙이기 — 바뀐 칸만 · 기록에 남음', () => {
  const { b, who, s1, a1 } = storyBoard();
  const before = Object.keys(b.log).length;
  run(b, 'setEnd', { id: a1.id, end: true });
  run(b, 'setSpine', { id: s1.id, spine: '날마다' });
  const t = ops.tagCard(b, { id: s1.id, mat: who.id, on: true, by: '아이' });
  ok(Object.keys(t.patch).every(k => k.startsWith('cards.' + s1.id + '.tags.') || k.startsWith('log.')), '태그가 카드 통째를 씀');
  applyPatch(b, t.patch);
  ok(b.cards[a1.id].end === true && b.cards[s1.id].spine === '날마다' && b.cards[s1.id].tags[who.id] === 1, '값');
  ok(Object.keys(b.log).length === before + 3, '기록 줄 수');
  const coach = storyCoach(b);
  ok(coach.some(t => t.startsWith('B 길')) && !coach.some(t => t.includes('A 길')), 'A 길 끝 뒤 코치: ' + coach.join(' / '));
  ok(!coach.some(t => t.includes('인물을 붙여')), '인물 붙인 뒤에도 코치');
  run(b, 'tagCard', { id: s1.id, mat: who.id, on: false });
  ok(!b.cards[s1.id].tags || !b.cards[s1.id].tags[who.id], '떼기');
  ok(!Object.keys(ops.tagCard(b, { id: s1.id, mat: 'nope', on: true }).patch).length, '없는 재료');
});
test('사이에 넣기 · 줄에서 빼기 — 줄이 안 끊긴다', () => {
  const { b, s1, s2 } = storyBoard();
  const link = Object.values(b.links).find(l => l.from === s1.id && l.to === s2.id);
  const ins = run(b, 'insertBetween', { link: link.id, text: '토리는 별을 셌어요', spine: '날마다' });
  let g = storyGraph(b);
  ok(g.out.get(s1.id)[0].to === ins.id && g.out.get(ins.id)[0].to === s2.id && !b.links[link.id], '끼워 넣기');
  run(b, 'removeInLine', { id: ins.id });
  g = storyGraph(b);
  ok(!b.cards[ins.id] && g.out.get(s1.id).length === 1 && g.out.get(s1.id)[0].to === s2.id, '빼고 다시 잇기');
  run(b, 'removeInLine', { id: s1.id });   // 시작을 빼면 다음 사건이 시작
  ok(storyGraph(b).start.id === s2.id, '새 시작');
});
test('옛 판(화살표 없음)과 빙 도는 화살표도 다 보인다', () => {
  const b = newBoard({ title: '옛', template: tpl('story') });
  for (const [z, t] of [['인물', '토리'], ['사건', '별이 떨어짐'], ['사건', '요정을 만남'], ['선택', '어디로?']]) run(b, 'addCard', { text: t, zone: z, x: 0, y: 0 });
  let g = storyGraph(b);
  ok(g.start && g.loose.length === 2 && g.mats.length === 1, `시작 ${!!g.start} · 안 이은 ${g.loose.length}`);
  const [p, q] = g.loose; run(b, 'addLink', { from: g.start.id, to: p.id }); run(b, 'addLink', { from: p.id, to: g.start.id });   // 빙 돎
  g = storyGraph(b);
  ok(g.nodes.every(c => g.pos.has(c.id) || g.loose.includes(c)), '빠진 카드');
  ok(storyLines(b).lines.some(l => l.includes('이어져요')), '빙 도는 화살표 글');
  void q;
});
test('나무 — 밑에 넣기 · 사이에 넣기 · 들여쓰기 막기(제 밑) · 지워도 밑 항목은 남음', () => {
  const b = newBoard({ title: '현장학습', template: tpl('outline') });
  const r = run(b, 'addChild', { text: '현장학습' }), a = run(b, 'addChild', { parent: r.id, text: '준비물' }), c = run(b, 'addChild', { parent: r.id, text: '규칙' });
  const m = run(b, 'addChild', { parent: r.id, after: a.id, text: '시간표' }), w = run(b, 'addChild', { parent: a.id, text: '물병' });
  let T = treeOf(b);
  ok(T.kids(r.id).map(x => x.text).join() === '준비물,시간표,규칙', '차례 ' + T.kids(r.id).map(x => x.text).join());
  ok(!Object.keys(ops.treeMove(b, { id: r.id, parent: w.id, ord: 1, by: '아이' }).patch).length, '제 밑으로 옮김');
  run(b, 'removeInTree', { id: a.id });
  T = treeOf(b);
  ok(T.kids(r.id).map(x => x.text).join() === '물병,시간표,규칙', '지운 뒤 ' + T.kids(r.id).map(x => x.text).join());
  void c; void m;
});
test('정리본 · AI 글 — 차례 · 갈림길 · 끝 · 재료 · 이름 없음', () => {
  const { b, who, s1, a1 } = storyBoard();
  run(b, 'setEnd', { id: a1.id, end: true }); run(b, 'tagCard', { id: s1.id, mat: who.id, on: true });
  const o = boardOutline(b);
  ok(o.includes('인물: 토리, 몽이') && o.includes('옛날 옛적에 달빛 숲에 토리가 살았어요 (인물 토리)'), '정리본 앞부분\n' + o);
  ok(/A\. 얼음 동굴로/.test(o) && /B\. 숲 친구들과/.test(o) && o.includes('[끝]') && o.includes('아직 끝이 없어요'), '갈림길 · 끝');
  ok(!o.includes('아이') && !o.includes('s1'), '이름 · id 가 정리본에');
  const ai = boardToText(b);
  ok(ai.includes('## 이야기 줄') && ai.includes('[내가 씀]'), 'AI 글 모양');
  const t = newBoard({ title: '나무', template: tpl('outline') }), r = run(t, 'addChild', { text: '주제' }); run(t, 'addChild', { parent: r.id, text: '갈래' });
  ok(boardOutline(t).includes('- 주제\n  - 갈래'), '나무 정리본');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`생각판 이야기 줄 · 나무 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
