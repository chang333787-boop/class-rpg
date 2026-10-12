// 장면 tray — [MAC-TRAY] 판 칸 `트레이`(PA-01)를 실제 화면에서 누른다: node scripts/village-d/dcheck.mjs --scene tray
// 임시 판 둘(nohealth 사본 + `트레이: ["road","bench"]` · `트레이: []`)을 장면 안에서 쓰고 끝에 지운다(try/finally · 커밋 안 함).
// 볼 것: 카드 = 트레이 종류만 · 탭 = 트레이 종류가 든 탭만 · 값 줄(.pr) 0 · NEW 표지는 남김 · [] 이면 🖐 · 🧽 숨김(🔄 · ↩ 는 둠) ·
//        트레이 밖 집을 오른쪽 누름 → 그대로 + 손말 · 터치 길게 누름 → 메뉴 0 + 손말 · 끌어 치우기는 트레이 밖을 건너뜀 · [] 판 물건 · 빈 땅 말.
//        대조(헛 PASS 막기): 트레이 안(길)은 오른쪽 누름으로 치워지고 · 길게 누르면 메뉴가 뜨고 · 끌면 치워진다(↩ 로 되살림).
// 누르기 전에: 판 카드 · 첫 안내 · 제목 카드를 닫는다(village-look shots.mjs 의 닫기 꼴) · 칸의 화면 자리는 __screenCell 로 짚은 점 가운데 것 ·
//        그 점이 캔버스(#cv)인지 document.elementFromPoint 로 먼저 본다(트레이 · 말풍선 · 카드가 누름을 먹지 않게).
import fs from 'node:fs'; import path from 'node:path';
const 손 = '✋ 이번엔 옮기거나 치우지 않아요';
export default async function tray(ctx) {
  const DIR = path.join(ctx.ROOT, 'village/stages'), base = JSON.parse(fs.readFileSync(path.join(DIR, 'nohealth.json'), 'utf8'));
  const boards = [['zz-dtray-a', ['road', 'bench']], ['zz-dtray-b', []]];
  const files = boards.map(([id, T]) => { const f = path.join(DIR, id + '.json'); fs.writeFileSync(f, JSON.stringify({ ...base, id, 트레이: T }, null, 1)); return f; });
  const E = (src, ms) => ctx.evaluate(src, ms), mouse = p => ctx.send('Input.dispatchMouseEvent', p), touch = p => ctx.send('Input.dispatchTouchEvent', p);
  const out = {};
  /* 판 열기 → 안내 · 판 카드 · 제목 카드를 실제 시간 1.5초 조용할 때까지 닫는다 → 시뮬 멈춤 → 칸 → 화면 점 지도(캔버스 위 점만) */
  const openBoard = async id => { const tries0 = ctx.C.st.tries.filter(t => !t.ok).length;
    await ctx.open({ stage: id });
    await E(`const sl = ms => new Promise(r => setTimeout(r, ms)); let quiet = 0;
      for (let k = 0; k < 60 && quiet < 6; k++) { const bs = [...document.querySelectorAll('button')].filter(b => ['시작', '건너뛰기', '닫기'].includes(b.textContent.trim()) && b.offsetParent);
        bs.forEach(b => b.click()); const g = document.getElementById('guide'); quiet = bs.length || (g && g.className.includes('show')) ? 0 : quiet + 1; await sl(250); }
      window.__setSpeed(0); return 1`, 60000);
    await ctx.pump(30); await ctx.sleep(2300);   /* 닫으며 뜬 말풍선(2.1초)이 점을 가리지 않게 */
    const sg = await ctx.probe('window.__stage ? window.__stage() : null');
    ctx.expect(sg && sg.id === id && !sg.오류 && !sg.원격, id + ' 판 열림 · 원격 동기 꺼짐');
    ctx.expect(ctx.C.st.tries.filter(t => !t.ok).length === tries0, id + ' 바깥 시도 0');
    const n = await E(`const m = {}; for (let sy = 50; sy < innerHeight - 30; sy += 5) for (let sx = 20; sx < innerWidth - 20; sx += 5) {
        const el = document.elementFromPoint(sx, sy); if (!el || el.id !== 'cv') continue; const c = window.__screenCell(sx, sy); if (!c) continue; (m[c[0] + ',' + c[1]] = m[c[0] + ',' + c[1]] || []).push([sx, sy]); }
      window.__dPts = m; return Object.keys(m).length`, 120000);
    ctx.expect(n > 50, id + ' 캔버스 위 칸 ' + n); };
  /* 그 종류의 물건이 선 칸 가운데 화면 점이 넉넉한(≥ 6) 칸 · 점은 가운데 것 — near 를 주면 그 종류 칸이 곁(4방)에 있는 칸만 */
  const pick = (kind, near) => E(`const m = window.__dPts || {}, k = ${JSON.stringify(kind)}, nr = ${JSON.stringify(near || null)}, kindAt = (x, y) => window.__stream(x, y).칸.종류;
    const roots = window.__snapshot().물건.filter(t => t.startsWith(k + '@')).map(t => t.slice(k.length + 1).split(/[,/]/).slice(0, 2).map(Number)); let best = null;
    for (const [rx, ry] of roots) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = rx + dx, y = ry + dy, l = m[x + ',' + y] || []; if (l.length < 6 || kindAt(x, y) !== k) continue;
      const by = nr ? [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]).find(([a, b]) => kindAt(a, b) === nr && (m[a + ',' + b] || []).length >= 6) : null; if (nr && !by) continue;
      if (!best || l.length > best.n) best = { k, x, y, n: l.length, p: l[l.length >> 1], by: by ? { x: by[0], y: by[1], p: m[by[0] + ',' + by[1]][m[by[0] + ',' + by[1]].length >> 1] } : null }; }
    return best;`);
  const onCanvas = p => E(`const el = document.elementFromPoint(${p[0]}, ${p[1]}); return !!el && el.id === 'cv'`);
  const kindAt = (x, y) => ctx.probe(`window.__stream(${x}, ${y}).칸.종류`);
  const state = () => ctx.probe(`({ 손말: window.__tray().손말, 말: (document.getElementById('toast') || {}).textContent || '', 메뉴: (document.getElementById('hold') || { style: {} }).style.display === 'flex', t: window.__tray() })`);
  const rclick = async p => { await mouse({ type: 'mouseMoved', x: p[0], y: p[1] }); await mouse({ type: 'mousePressed', x: p[0], y: p[1], button: 'right', buttons: 2, clickCount: 1 });
    await mouse({ type: 'mouseReleased', x: p[0], y: p[1], button: 'right', buttons: 0, clickCount: 1 }); await ctx.sleep(120); };
  const lclick = async p => { await mouse({ type: 'mouseMoved', x: p[0], y: p[1] }); await mouse({ type: 'mousePressed', x: p[0], y: p[1], button: 'left', buttons: 1, clickCount: 1 });
    await mouse({ type: 'mouseReleased', x: p[0], y: p[1], button: 'left', buttons: 0, clickCount: 1 }); await ctx.sleep(120); };
  const hold = async p => { await touch({ type: 'touchStart', touchPoints: [{ x: p[0], y: p[1], id: 1 }] }); await ctx.sleep(800); const s = await state();   /* 메뉴는 0.5초(진짜 시계) 뒤 */
    await touch({ type: 'touchEnd', touchPoints: [] }); await ctx.sleep(150); return s; };
  const tapClose = async p => { await touch({ type: 'touchStart', touchPoints: [{ x: p[0], y: p[1], id: 2 }] }); await touch({ type: 'touchEnd', touchPoints: [] }); await ctx.sleep(150); };   /* 메뉴가 떠 있을 때 판을 누르면 닫기만 */
  const drag = async (a, b) => { await mouse({ type: 'mouseMoved', x: a[0], y: a[1] }); await mouse({ type: 'mousePressed', x: a[0], y: a[1], button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await mouse({ type: 'mouseMoved', x: a[0] + (b[0] - a[0]) * i / 10, y: a[1] + (b[1] - a[1]) * i / 10, button: 'left', buttons: 1 });
    await mouse({ type: 'mouseReleased', x: b[0], y: b[1], button: 'left', buttons: 0, clickCount: 1 }); await ctx.sleep(150); };
  try {
    /* ── ① 트레이 ["road", "bench"] ── */
    await openBoard('zz-dtray-a');
    const tabs = await E(`const sl = ms => new Promise(r => setTimeout(r, ms)), all = [...document.querySelectorAll('#trayTabs .gtab')], vis = all.filter(b => b.style.display !== 'none'), per = [];
      for (const b of vis) { b.click(); await sl(60); per.push({ 탭: b.textContent.trim(), 카드: [...document.querySelectorAll('#trayIn .card[data-kind]')].map(e => e.dataset.kind) }); }
      const pr = [...document.querySelectorAll('#trayIn .card[data-kind] .pr')];
      return { 모든탭: all.length, per, 값줄: window.__tray().값줄, 값글: pr.length, 보인값글: pr.filter(e => !e.hidden && e.offsetParent).map(e => e.textContent), 도구: ['cRot', 'cMove', 'cErase', 'cUndo'].map(id => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && !!e.offsetParent; }) }`);
    const 카드 = [...new Set(tabs.per.flatMap(t => t.카드))].sort();
    ctx.expect(tabs.per.length === 2 && tabs.모든탭 > tabs.per.length && tabs.per.every(t => t.카드.length >= 1), '["road","bench"] 탭 = 트레이 종류가 든 탭만 ' + JSON.stringify({ 모든탭: tabs.모든탭, 보인탭: tabs.per.map(t => t.탭) }));
    ctx.expect(JSON.stringify(카드) === JSON.stringify(['bench', 'road']), '카드 = 트레이 종류만 ' + JSON.stringify(카드));
    ctx.expect(tabs.값줄 === 0 && tabs.값글 >= 1 && tabs.보인값글.length === 0, '값 줄 0(값 글은 있고 숨음) ' + JSON.stringify({ 값줄: tabs.값줄, 값글: tabs.값글, 보인: tabs.보인값글 }));
    ctx.expect(tabs.도구.every(Boolean), '트레이가 있으면 🔄 · 🖐 · 🧽 · ↩ 보임 ' + JSON.stringify(tabs.도구));
    /* NEW 표지 — trayTrim 의 0초 뒤 타이머가 값 글 앞에 'NEW · ' 를 붙인 꼴을 같은 자리(다시 그린 직후 · 타이머 전)에서 만들어 본다 */
    const nw = await E(`const b = [...document.querySelectorAll('#trayTabs .gtab')].find(x => x.style.display !== 'none'); b.click(); const pr = document.querySelector('#trayIn .card[data-kind]:not(.lock) .pr');
      const 전 = { 숨음: pr.hidden, 글: pr.textContent }; pr.textContent = 'NEW · ' + pr.textContent; await new Promise(r => setTimeout(r, 80));
      const 뒤 = { 숨음: pr.hidden, 글: pr.textContent, 값줄: window.__tray().값줄 }; b.click(); return { 전, 뒤 }`);
    ctx.expect(nw.전.숨음 === true && nw.뒤.숨음 === false && nw.뒤.글 === 'NEW' && nw.뒤.값줄 === 0, 'NEW 표지는 남고 값 글만 숨음 ' + JSON.stringify(nw));
    /* 다른 길이 curGroup 을 트레이 밖 탭으로 돌려도(숨은 탭 누름으로 흉내) 트레이 종류가 든 탭에서 열린다 */
    const cg = await E(`const hid = [...document.querySelectorAll('#trayTabs .gtab')].find(x => x.style.display === 'none'); if (!hid) return null; hid.click(); await new Promise(r => setTimeout(r, 60));
      const on = document.querySelector('#trayTabs .gtab.on'); return { 누른탭: hid.textContent.trim(), 켠탭: on ? on.textContent.trim() : null, 켠탭보임: !!on && on.style.display !== 'none', 카드: [...document.querySelectorAll('#trayIn .card[data-kind]')].map(e => e.dataset.kind) }`);
    ctx.expect(cg && cg.켠탭보임 && cg.카드.length >= 1 && cg.카드.every(k => ['road', 'bench'].includes(k)), '숨은 탭으로 돌려도 트레이 종류가 든 탭에서 열림 ' + JSON.stringify(cg));
    await ctx.shot('a_트레이_길_긴의자');
    const 집 = await pick('house'), 길 = await pick('road'), 쓸 = await pick('lamp', 'road') || await pick('tree', 'road') || await pick('bush', 'road');   /* 끌기는 작은 것만 치운다(사는 집 · 큰 건물은 원래 건너뜀) — 길 곁 가로등 · 나무 · 덤불 */
    ctx.expect(집 && 길 && 쓸 && 쓸.by, '누를 칸 — 집 · 길 · 길 곁 작은 것 ' + JSON.stringify({ 집: 집 && [집.x, 집.y], 길: 길 && [길.x, 길.y], 작은것: 쓸 && [쓸.k, 쓸.x, 쓸.y, 쓸.by && [쓸.by.x, 쓸.by.y]] }));
    if (집 && 길 && 쓸 && 쓸.by) {
      ctx.expect(await onCanvas(집.p) && await onCanvas(길.p) && await onCanvas(쓸.p) && await onCanvas(쓸.by.p), '누를 점이 모두 캔버스 위');
      /* 오른쪽 누름 — 트레이 밖 집은 그대로 + 손말 · 대조: 길은 치워진다(↩ 로 되살림) */
      await rclick(집.p); const r1 = await state(), k1 = await kindAt(집.x, 집.y);
      ctx.expect(k1 === 'house' && r1.손말 === 손 && r1.말 === 손, '오른쪽 누름: 트레이 밖 집 그대로 + 손말 ' + JSON.stringify({ 칸: k1, 손말: r1.손말, 말: r1.말 }));
      await rclick(길.p); const k2 = await kindAt(길.x, 길.y); await E(`window.__undo(); return 1`); const k3 = await kindAt(길.x, 길.y);
      ctx.expect(k2 === null && k3 === 'road', '대조 — 오른쪽 누름: 트레이 안 길은 치워지고 ↩ 로 돌아옴 ' + JSON.stringify([k2, k3]));
      /* 옮기기(🖐) 모드에서 트레이 밖 집을 누르면 그대로 + 손말이 남는다(떼는 순간의 누름이 집 말로 덮지 않게) */
      await E(`document.getElementById('toast').textContent = ''; document.getElementById('cMove').click(); return 1`); await lclick(집.p);
      const mv = await state(), km = await kindAt(집.x, 집.y); await E(`document.getElementById('cMove').click(); return 1`);
      ctx.expect(km === 'house' && mv.말 === 손, '옮기기 모드: 트레이 밖 집을 누르면 그대로 + 손말이 남음 ' + JSON.stringify({ 칸: km, 말: mv.말 }));
      /* 터치 길게 누름 — 트레이 밖 집은 메뉴 0 + 손말 · 대조: 길은 메뉴가 뜬다 */
      await E(`document.getElementById('toast').textContent = ''; return 1`);
      const h1 = await hold(집.p);
      ctx.expect(!h1.메뉴 && h1.손말 === 손 && h1.말 === 손, '길게 누름: 트레이 밖 집 메뉴 0 + 손말 ' + JSON.stringify({ 메뉴: h1.메뉴, 손말: h1.손말, 말: h1.말 }));
      const h2 = await hold(길.p); if (h2.메뉴) await tapClose(길.p);
      ctx.expect(h2.메뉴, '대조 — 길게 누름: 트레이 안 길은 메뉴가 뜸 ' + JSON.stringify({ 메뉴: h2.메뉴 }));
      /* 끌어 치우기 — 길에서 나무로 끌면 길만 치워진다(나무는 트레이 밖 · 건너뜀) */
      const s0 = (await state()).t.쓸기건너뜀;
      await E(`document.getElementById('cErase').click(); return 1`); await drag(쓸.by.p, 쓸.p); await E(`document.getElementById('cErase').click(); return 1`);
      const s1 = (await state()).t.쓸기건너뜀, kr = await kindAt(쓸.by.x, 쓸.by.y), kt = await kindAt(쓸.x, 쓸.y); await E(`window.__undo(); return 1`); const kr2 = await kindAt(쓸.by.x, 쓸.by.y);
      ctx.expect(kr === null && kt === 쓸.k && s1 > s0 && kr2 === 'road', '끌어 치우기: 길은 치워지고 트레이 밖 ' + 쓸.k + ' 는 건너뜀 · ↩ 로 길 돌아옴 ' + JSON.stringify({ 길: kr, 작은것: kt, 건너뜀: s1 - s0, 되살린길: kr2 }));
      out.a = { 탭: tabs.per.map(t => t.탭), 카드, 집: [집.x, 집.y], 길: [길.x, 길.y], 끌기: [쓸.k, 쓸.x, 쓸.y], 건너뜀: s1 - s0 }; }

    /* ── ② 트레이 [] ── */
    await openBoard('zz-dtray-b');
    const b = await E(`const vis = [...document.querySelectorAll('#trayTabs .gtab')].filter(x => x.style.display !== 'none').length, cards = document.querySelectorAll('#trayIn .card[data-kind]').length;
      return { 보인탭: vis, 카드: cards, 값줄: window.__tray().값줄, 도구: Object.fromEntries(['cRot', 'cMove', 'cErase', 'cUndo'].map(id => { const e = document.getElementById(id); return [id, !!e && e.style.display !== 'none' && !!e.offsetParent]; })) }`);
    ctx.expect(b.보인탭 === 0 && b.카드 === 0 && b.값줄 === 0, '[] 탭 0 · 카드 0 · 값 줄 0 ' + JSON.stringify(b));
    ctx.expect(!b.도구.cRot && b.도구.cUndo && !b.도구.cMove && !b.도구.cErase, '[] 🖐 · 🧽 · 🔄 숨김 · ↩ 보임(고를 카드가 없으면 🔄 도 할 일이 없음) ' + JSON.stringify(b.도구));
    await ctx.shot('b_빈_트레이');
    const 집b = await pick('house'), 나무b = await pick('tree');
    ctx.expect(집b && 나무b, '[] 누를 칸 — 집 · 나무 ' + JSON.stringify({ 집: 집b && [집b.x, 집b.y], 나무: 나무b && [나무b.x, 나무b.y] }));
    if (집b && 나무b) {
      await rclick(집b.p); const r = await state(), k = await kindAt(집b.x, 집b.y);
      ctx.expect(k === 'house' && r.손말 === 손 && r.말 === 손, '[] 오른쪽 누름: 집 그대로 + 손말 ' + JSON.stringify({ 칸: k, 말: r.말 }));
      await E(`document.getElementById('toast').textContent = ''; return 1`);
      const h = await hold(집b.p);
      ctx.expect(!h.메뉴 && h.손말 === 손 && h.말 === 손, '[] 길게 누름: 집 메뉴 0 + 손말 ' + JSON.stringify({ 메뉴: h.메뉴, 말: h.말 }));
      /* 보기 모드 누름 — 물건 말에서 거짓 조각을 뺀다(🖐 · 🧽 · 카드 고르기가 없는 판) */
      await E(`document.getElementById('toast').textContent = ''; return 1`); await ctx.sleep(400); await lclick(나무b.p); const s = await state();
      ctx.expect(s.말 === '🌳 나무', '[] 나무를 누르면 이름만(옮기기 · 치우기 · 카드 말 없음) ' + JSON.stringify(s.말));
      out.b = { 집: [집b.x, 집b.y], 나무: [나무b.x, 나무b.y], 나무말: s.말 }; }
  } finally { files.forEach(f => fs.rmSync(f, { force: true })); }
  return out;
}
