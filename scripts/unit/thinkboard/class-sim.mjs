// 생각판 수업 시뮬레이션 — 아이 25명이 '조금 늦은 화면'을 보며 동시에 쓰고 · 공감하고 · 고치고 · 옮기고, 선생님은 그 사이 가리고 허락한다.
//  운영 DB 0(가짜 RTDB). 끝에 사라진 것이 없는지 · 연구 표가 맞는지 확인한다.  실행: node scripts/unit/thinkboard/class-sim.mjs
import { newBoard, ops } from '../../../thinkboard/js/model.js';
import { BUILTIN } from '../../../thinkboard/js/templates.js';
import { createRtdbStore } from '../../../thinkboard/js/store-rtdb.js';
import { studentRows, cardRows, logRows, toCSV } from '../../../thinkboard/js/research.js';
import { fakeFirebase } from './fake-rtdb.mjs';

let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fb = fakeFirebase(), store = createRtdbStore(fb);
const board = newBoard({ title: '시뮬 — 체험학습 돌아보기', template: BUILTIN.find(t => t.id === 'split') });
await store.create(board);
const KIDS = Array.from({ length: 25 }, (_, i) => ({ sid: 's' + (1001 + i), name: '아이' + String(i + 1).padStart(2, '0') }));
const zones = board.template.zones;
const done = { add: 0, react: new Set(), hidden: new Set(), ok: new Set() };

// 아이 한 명의 동작: 판을 읽고(이미 늦은 판일 수 있음) 잠깐 뒤에 쓴다 — 그 사이 남이 바꾼 것을 덮으면 안 된다
async function kid(k) {
  const mine = [];
  for (let r = 0; r < 6; r++) {
    const B = await store.get(board.id);           // 지금 판
    await sleep(Math.floor(rnd() * 25));            // 생각하는 사이 남들이 쓴다
    const act = r < 2 ? 'add' : pick(['react', 'react', 'edit', 'move', 'add']);
    if (act === 'add') {
      const z = pick(zones), res = ops.addCard(B, { text: `${k.name}의 생각 ${r}`, zone: z, x: 0, y: 0, by: k.name, sid: k.sid });
      await store.patch(board.id, res.patch); mine.push(res.id); done.add++;
    } else if (act === 'react') {
      const others = Object.values(B.cards).filter(c => c.sid !== k.sid && !done.react.has(c.id + '|' + k.sid));
      if (!others.length) continue;
      const c = pick(others); await store.patch(board.id, ops.react(B, { id: c.id, by: k.name, sid: k.sid }).patch); done.react.add(c.id + '|' + k.sid);
    } else if (act === 'edit' && mine.length) {
      const id = pick(mine); if (!B.cards[id]) continue;
      await store.patch(board.id, ops.editCard(B, { id, text: B.cards[id].text + ' (고침)', by: k.name, sid: k.sid }).patch);
    } else if (act === 'move' && mine.length) {
      const id = pick(mine); if (!B.cards[id]) continue;
      await store.patch(board.id, ops.moveCard(B, { id, x: 1, y: 1, zone: pick(zones), by: k.name, sid: k.sid }).patch);
    }
  }
}
// 선생님: 수업 중간에 몇 장 가리고 허락한다(아이들이 그 카드를 고치는 중일 수도 있다)
async function teacher() {
  for (let r = 0; r < 12; r++) {
    await sleep(8 + Math.floor(rnd() * 20));
    const B = await store.get(board.id), cs = Object.values(B.cards); if (!cs.length) continue;
    const c = pick(cs);
    if (r % 3 === 0) { await store.patch(board.id, ops.moderate(B, { id: c.id, hidden: true }).patch); done.hidden.add(c.id); }
    else { await store.patch(board.id, ops.moderate(B, { id: c.id, ok: true }).patch); done.ok.add(c.id); }
  }
}
await Promise.all([...KIDS.map(kid), teacher()]);

const B = await store.get(board.id), cards = Object.values(B.cards);
ok(cards.length === done.add, `카드가 하나도 안 사라짐 (${cards.length} / ${done.add})`);
const reactsNow = new Set(cards.flatMap(c => Object.keys(c.react || {}).map(k => c.id + '|' + k)));
ok([...done.react].every(x => reactsNow.has(x)), `공감이 하나도 안 사라짐 (${reactsNow.size} / ${done.react.size})`);
ok([...done.hidden].every(id => B.cards[id]?.hidden === true), `선생님 가림이 아이 고치기 · 옮기기에 안 풀림 (${done.hidden.size}장)`);
ok([...done.ok].every(id => B.cards[id]?.ok === true), `선생님 허락이 안 풀림 (${done.ok.size}장)`);
ok(cards.every(c => KIDS.some(k => k.sid === c.sid && k.name === c.by)), '모든 카드에 RPG 학생 id 와 이름');
ok(Object.values(B.log).filter(l => l.by !== 'teacher').every(l => l.sid), '아이 기록마다 학생 id');
ok(new Set(cards.map(c => c.sid)).size === 25, '25명 모두 썼다');

// 연구 표: RPG 명단과 이어지고 · 가명이 들어가고 · 수가 맞는다
const roster = KIDS.map(k => ({ id: k.sid, name: k.name }));
const S = studentRows([B], roster, { pseudo: true });
ok(S.length === 25 && S.every(r => /^S\d\d$/.test(r.학생) && !r.RPG학생id), '학생별 요약 25줄 · 가명 · id 숨김');
ok(S.reduce((n, r) => n + r.직접쓴카드, 0) === done.add, '학생별 직접 쓴 카드 합 = 전체');
ok(S.reduce((n, r) => n + r.공감한수, 0) === reactsNow.size && S.reduce((n, r) => n + r.공감받은수, 0) === reactsNow.size, '공감한 수 = 공감받은 수 = 실제');
const real = studentRows([B], roster, { pseudo: false });
ok(real.every(r => r.RPG학생id && r.학생.startsWith('아이')), '실명 표에는 RPG 학생 id 와 이름');
const C = cardRows([B], roster, { pseudo: true }), L = logRows([B], roster, { pseudo: true });
ok(C.length === cards.length && L.length === Object.keys(B.log).length, '카드 표 · 기록 표 줄 수');
const csv = toCSV(S); ok(csv.startsWith('﻿학생,') && csv.split('\r\n').length === 26, 'CSV(엑셀 한글 BOM · 머리 + 25줄)');
ok(!toCSV(cardRows([B], roster, { pseudo: true, text: false })).includes('아이0') && !toCSV(logRows([B], roster, { pseudo: true, text: false })).includes('아이0'), '가명 + 글 빼기 표에는 실명이 하나도 안 나옴');
ok(toCSV(C).includes('아이0'), '(알림) 글을 넣으면 글 속 이름은 그대로 — 내보내기 화면이 이 점을 알려야 함');
console.log(`생각판 수업 시뮬레이션 — 아이 25 · 카드 ${cards.length} · 공감 ${reactsNow.size} · 기록 ${Object.keys(B.log).length} — PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
