// 장면 k7 — [MAC-K7] PA-07 안내 층 · (H16 · #1122) 수업 판 💬 · 길 끌기 기본 끔을 진짜 크롬(가짜 시계)에서:
//   node scripts/village-d/dcheck.mjs --scene k7 --net-delay 2500:stages/
// 무화면 하네스는 setInterval 이 없어 💬 단추가 안 생기고, 누름 · ✨ · 토스트도 화면에 없다 — 그것은 여기서 본다(글 · 셈은 test.mjs K7).
// 페이지 맨 앞에 관찰자(MutationObserver)를 심어 #chirpBtn · #chirp · #roadTag 가 **한 번이라도** 생겼나 · 지워졌나를 적는다(지금 없는지만 보면 생겼다 지운 것을 놓친다).
// ① 💬 — 수업 판(help-places · empty-shop-ga)을 망 늦춤(판 파일 받기 2.5초 > 💬 박자 2초)으로 열고 진짜 5초: 단추 0번 · __chirp().켜짐 false · __roadLine().켜짐 false · W·A·S·D 켬
//    양성 대조: 판 규칙 chirp 켬(임시 판) → 단추 생김(길 끌기는 끔 그대로) · 자유 모드(pop88) → 생김 · 셋 다 켬 / 자유 모드에서 💬 창을 연 뒤 VRULES.chirp.on = false → 단추 · 창 지움
// ② 탐정 판 가게 누름 — empty-shop-ga [시작] → 가게 마을 단추 → 가게(129,138)를 실제로 누름: ✨ 0(__k7().반짝 · whereGo 짚음 그대로) · 토스트 '빈 선반이에요' · '끊겼' 0
//    양성 대조: 3층 사본(임시 판) → ✨ ≥ 1 · 토스트 '끊겼어요'
// ③ 🔗 공급 경로 보기(가게 마을 단추 줄) — 2층 토스트 '✂️ 여기예요'(꼬리 0) · ✨ ≥ 1(그대로) / 3층 사본 '… 이으면 가게에 닿아요'
// ⑤ (PA-07 고침) 진짜 주민 — 가짜 시계 2배속으로 흘려 지금 뜬 💬 바람 · 🛒? 풍선 주민의 카드 글(주민을 누르면 뜨는 folkCard · __k7Cards):
//    2층 바람 글 '있으면 좋겠어요' 0 · '💬 가게에 물건이 없어요 — ' / 3층 사본 '있으면 좋겠어요' · 🛒? 풍선 뜻 = 집 카드와 같은 '가게에 물건이 없어요'(층과 무관) ·
//    양성 대조: 같은 순간 VRULES.flowSay 를 끄면 옛 말('가게가 멀어요' · 3층은 '— 집 가까이 지어 주세요')
// ⑨ (PA-07 고침) 빈 가게 문 앞 팻말 — ⑤ 로 판 시계가 흐른 뒤 가게 마을로 다시 가 사진: 2층 __flowShape(129,138).까닭 null(팻말째 안 섬 · 조각 적음) / 3층 사본 '길'
//    (그리기 틱 fsTick 은 30틱마다라 [시작] 바로 뒤엔 2층 · 3층 모두 null — 다시 합친 수 ≥ 1 로 틱이 돌았나도 봄)
// ④ 길 끌기 — 수업 판(lesson0 · 트레이 길)에서 길 카드를 고르고 빈 땅을 끌면 #roadTag 0번 · 길은 여러 칸 놓임(끌어 놓기는 원래 동작)
//    판 규칙 roadLine 켬(임시 판 · 💬 는 꺼진 채) → 이름표 생김 · position fixed(💬 style 없이도 이름표 모양) / 양성 대조: 자유 모드(pop88) → 이름표 생김
// 임시 판(zz-dk7-*)은 장면 안에서 쓰고 끝에 지운다(try/finally · 커밋 안 함). 판 쪽 페이지는 바깥 시도 0 을 함께 본다.
import fs from 'node:fs'; import path from 'node:path';
const OBS = `(() => { const d = window.__dK7 = { 생김: [], 지움: [], t0: Date.now() }, ids = ['chirpBtn', 'chirp', 'roadTag'];
  new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(n => { if (n.nodeType === 1 && ids.includes(n.id)) d.생김.push({ id: n.id, ms: Date.now() - d.t0 }); });
    m.removedNodes.forEach(n => { if (n.nodeType === 1 && ids.includes(n.id)) d.지움.push({ id: n.id, ms: Date.now() - d.t0 }); }); })).observe(document, { childList: true, subtree: true }); })();`;
export default async function k7(ctx) {
  const C = ctx.C, E = (s, ms) => ctx.evaluate(s, ms), P = e => ctx.probe(e), J = JSON.stringify, out = {};
  const url = stage => ctx.BASE + '/village/index.html?' + (stage ? 'stage=' + stage + '&' : '') + 'sid=guest';
  const DIR = path.join(ctx.ROOT, 'village/stages'), base = n => JSON.parse(fs.readFileSync(path.join(DIR, n + '.json'), 'utf8')), made = [];
  const put = (id, o) => { fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify({ ...o, id }, null, 1)); made.push(path.join(DIR, id + '.json')); };
  const outside = () => C.st.tries.filter(t => !t.ok).length, mouse = p => ctx.send('Input.dispatchMouseEvent', p);
  const D = ctx.result.늦춤;
  ctx.expect(D && D.ms >= 2000 && D.match && '/village/stages/x.json'.includes(D.match), '망 늦춤 — --net-delay 2500:stages/ 로 돌림(판 파일 받기가 💬 박자 2초보다 늦게) ' + J(D));
  const obs = await ctx.send('Page.addScriptToEvaluateOnNewDocument', { source: OBS });
  /* 새 프로필로 열기 — 판 파일 받기가 끝날 때(__sim 이 생김 = module 이 top-level await 를 지남)까지 진짜 ms */
  const fresh = async (stage, save) => { await C.nav(ctx.BASE + '/village/stages/rules.json'); await E('localStorage.clear(); sessionStorage.clear(); return 1');
    if (save) await E(`const r = await fetch(${J('/village/stages/boards/' + save + '.json')}, { cache: 'no-store' }); localStorage.setItem('rpg.village.guest', await r.text()); return 1`);
    const t0 = Date.now(); await C.nav(url(stage));
    await C.until(`typeof window.__sim === 'function' && typeof window.__k7 === 'function' && window.__shots && typeof window.__gfxMode === 'function'`, 40000, (stage || '자유 모드') + ' 불러오기');
    const ms = Date.now() - t0; await E(`window.__gfxMode('fixed'); return 1`); return ms; };
  const dk = () => P('window.__dK7'), has = id => P(`!!document.getElementById(${J(id)})`), 셋 = () => P(`({ 채팅: window.__chirp().켜짐, 길끌기: window.__roadLine().켜짐, wasd: window.VRULES.wasd.on })`);
  /* 판 카드 · 첫 안내 · 제목 카드를 실제 시간 1.5초 조용할 때까지 닫는다(tray 장면 꼴) — 짐작 상자 카드는 보기 하나를 골라야 [시작]이 켜진다 */
  const closeCards = () => E(`const sl = ms => new Promise(r => setTimeout(r, ms)); let quiet = 0;
    for (let k = 0; k < 60 && quiet < 6; k++) { const p = document.querySelector('#stageCard .pred .po button'); if (p) p.click();
      const bs = [...document.querySelectorAll('button')].filter(b => ['시작', '건너뛰기', '닫기'].includes(b.textContent.trim()) && b.offsetParent && !b.disabled);
      bs.forEach(b => b.click()); const g = document.getElementById('guide'); quiet = bs.length || (g && g.className.includes('show')) ? 0 : quiet + 1; await sl(250); } return 1`, 60000);
  /* 화면 점 지도(캔버스 위 점만) · 그 종류가 선 칸 가운데 점이 넉넉한 칸 */
  const ptsMap = () => E(`const m = {}; for (let sy = 50; sy < innerHeight - 30; sy += 5) for (let sx = 20; sx < innerWidth - 20; sx += 5) {
      const el = document.elementFromPoint(sx, sy); if (!el || el.id !== 'cv') continue; const c = window.__screenCell(sx, sy); if (!c) continue; (m[c[0] + ',' + c[1]] = m[c[0] + ',' + c[1]] || []).push([sx, sy]); }
    window.__dPts = m; return Object.keys(m).length`, 120000);
  const ptOf = (x, y) => P(`(() => { const l = (window.__dPts || {})[${J(x + ',' + y)}] || []; return l.length >= 4 ? l[l.length >> 1] : null; })()`);
  const lclick = async p => { await mouse({ type: 'mouseMoved', x: p[0], y: p[1] }); await mouse({ type: 'mousePressed', x: p[0], y: p[1], button: 'left', buttons: 1, clickCount: 1 });
    await mouse({ type: 'mouseReleased', x: p[0], y: p[1], button: 'left', buttons: 0, clickCount: 1 }); await ctx.sleep(150); };
  const toastNow = () => P(`(document.getElementById('toast') || {}).textContent || ''`);
  /* 동네 판(empty-shop) — [시작] 뒤 첫 화면 🗺️ 모형 → '가게 마을' 단추로 마을 화면(모형 화면은 #cv 가 누름을 안 받는다) */
  const shopTown = async () => { for (let k = 0; k < 40 && !(await has('pmapBar')); k++) await ctx.advance(250);
    const ok = await E(`const b = [...document.querySelectorAll('#pmapBar button')].find(x => x.textContent.trim() === '가게 마을'); if (!b) return false; b.click(); return !window.__protoMap().켜짐`);
    await E(`window.__setSpeed(0); return 1`); await ctx.pump(30); await ctx.sleep(2300); return ok; };   /* 닫으며 뜬 말풍선(2.1초)이 점을 가리지 않게 */
  /* 빈 땅 가로 네 칸(길을 놓을 수 있고 · 점이 넉넉한) — 끌기 시험 자리 */
  const runOf = () => P(`(() => { const m = window.__dPts || {}, ok = (x, y) => (m[x + ',' + y] || []).length >= 6 && window.__try('road', x, y, 0) === true;
    const keys = Object.keys(m).map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, y] of keys) if ([0, 1, 2, 3].every(i => ok(x + i, y))) return [[x, y], [x + 3, y]].map(([a, b]) => ({ c: [a, b], p: m[a + ',' + b][m[a + ',' + b].length >> 1] })); return null; })()`);
  const roads = () => P(`window.__snapshot().물건.filter(t => t.startsWith('road@')).length`);
  /* 길 카드 고르기 → a 에서 b 로 끌기(누른 채 10걸음) · 끄는 동안 이름표 · 모양을 본다 */
  const dragRoad = async (a, b) => { const sel = await E(`const t = [...document.querySelectorAll('#trayTabs .gtab')].filter(x => x.style.display !== 'none');
      for (const tb of t) { tb.click(); const c = document.querySelector('#trayIn .card[data-kind="road"]'); if (c) { c.click(); return true; } } return false`);
    await mouse({ type: 'mouseMoved', x: a[0], y: a[1] }); await mouse({ type: 'mousePressed', x: a[0], y: a[1], button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await mouse({ type: 'mouseMoved', x: a[0] + (b[0] - a[0]) * i / 10, y: a[1] + (b[1] - a[1]) * i / 10, button: 'left', buttons: 1 });
    const mid = await P(`(() => { const t = document.getElementById('roadTag'); return t ? { 글: t.textContent, 자리: getComputedStyle(t).position } : null; })()`);
    await mouse({ type: 'mouseReleased', x: b[0], y: b[1], button: 'left', buttons: 0, clickCount: 1 }); await ctx.sleep(200);
    return { 고름: sel, 끄는중: mid }; };
  try {
    put('zz-dk7-ga3', { ...base('empty-shop-ga'), 안내최대층: 3 });
    { const hp = base('help-places'); put('zz-dk7-chirp', { ...hp, 규칙: { ...(hp.규칙 || {}), chirp: { on: true } } }); }
    { const l0 = base('lesson0'); put('zz-dk7-road', { ...l0, 규칙: { ...(l0.규칙 || {}), roadLine: { on: true } } }); }
    /* ── ① 💬 — 수업 판 둘(망 늦춤) ── */
    for (const st of ['help-places', 'empty-shop-ga']) { const o0 = outside(), ms = await fresh(st); await ctx.advance(5000);
      const d = await dk(), s = await 셋(); out['①' + st] = { 받기ms: ms, 생김: d.생김, ...s };
      ctx.expect(ms >= 2500, `① ${st} 판 파일 받기 ${ms}ms ≥ 2500 — 💬 박자(2초)가 받기 동안 돎`);
      ctx.expect(!d.생김.some(x => x.id === 'chirpBtn' || x.id === 'chirp') && !(await has('chirpBtn')), `① ${st} 💬 단추 0(한 번도 안 생김 · 진짜 5초) ` + J(d.생김));
      ctx.expect(s.채팅 === false && s.길끌기 === false && s.wasd === true, `① ${st} 💬 · 길 끌기 끔 · W·A·S·D 켬 ` + J(s));
      ctx.expect(outside() === o0, `① ${st} 바깥 시도 0`); }
    { const o0 = outside(); await fresh('zz-dk7-chirp'); await ctx.advance(5000); const d = await dk(), s = await 셋(); out['①판규칙'] = { 생김: d.생김, ...s };
      ctx.expect(d.생김.some(x => x.id === 'chirpBtn') && await has('chirpBtn') && s.채팅 === true && s.길끌기 === false, '① 양성 대조 — 판 규칙 chirp 켬 → 💬 단추 생김 · 길 끌기는 끔 그대로 ' + J(out['①판규칙']));
      ctx.expect(outside() === o0, '① 판 규칙 chirp 판 바깥 시도 0'); }
    { await fresh(null, 'pop88'); await ctx.advance(5000); const d = await dk(), s = await 셋(); out['①자유'] = { 생김: d.생김, ...s };
      ctx.expect(d.생김.some(x => x.id === 'chirpBtn') && await has('chirpBtn') && s.채팅 && s.길끌기 && s.wasd, '① 양성 대조 — 자유 모드(pop88) 💬 단추 생김 · 셋 다 켬 ' + J(out['①자유']));
      await E(`document.getElementById('chirpBtn').click(); return 1`); await ctx.advance(500); const 열림 = await has('chirp');
      await E(`window.VRULES.chirp.on = false; return 1`); await ctx.advance(2600); const d2 = await dk(), 지움 = !(await has('chirpBtn')) && !(await has('chirp'));
      out['①도중끔'] = { 열림, 지움: d2.지움 };
      ctx.expect(열림 && 지움 && d2.지움.some(x => x.id === 'chirpBtn') && d2.지움.some(x => x.id === 'chirp'), '① 도중에 끄면 💬 단추 · 창을 지움(다음 박자) ' + J(out['①도중끔'])); }
    /* ── ② ③ 탐정 판 가게 누름 · 🔗 공급 경로 — 2층 ↔ 3층 사본 ── */
    for (const [st, 층] of [['empty-shop-ga', 2], ['zz-dk7-ga3', 3]]) { const o0 = outside(); await fresh(st); await closeCards();
      const 마을 = await shopTown(), n = await ptsMap(), p = await ptOf(129, 138) || await ptOf(130, 138) || await ptOf(129, 139) || await ptOf(130, 139);
      ctx.expect(마을 && n > 50 && p, `②${층} ${st} 가게 마을 화면 · 캔버스 위 칸 ${n} · 가게 점 ` + J(p));
      if (!p) continue;
      await E(`document.getElementById('toast').textContent = ''; return 1`);
      const k0 = await P('window.__k7()'), w0 = await P('window.__where(0, 0)'); await lclick(p);
      const k1 = await P('window.__k7()'), w1 = await P('window.__where(0, 0)'), t = await toastNow();
      const 반짝 = k1.반짝 - k0.반짝, 짚음 = w1.짚음 - w0.짚음; out['②' + 층] = { 토스트: t, 반짝, 짚음, 판층: k1.판층, 짚기막음: k1.짚기 - k0.짚기 };
      if (층 === 2) ctx.expect(/빈 선반이에요/.test(t) && !/끊겼/.test(t) && 반짝 === 0 && 짚음 === 0 && k1.판층 === 2 && k1.짚기 > k0.짚기, '② 탐정 판 가게 누름 — ✨ 0 · 토스트에 까닭 0(빈 선반이에요까지) ' + J(out['②2']));
      else ctx.expect(/끊겼어요/.test(t) && 반짝 >= 1 && 짚음 === 1 && k1.판층 === 3, '② 양성 대조 — 3층 사본 가게 누름 ✨ ≥ 1 · 토스트에 까닭 ' + J(out['②3']));
      await ctx.shot('가게누름_' + 층 + '층');
      const r0 = await P('window.__k7().반짝'); await E(`document.getElementById('toast').textContent = ''; const b = [...document.querySelectorAll('#pmapExtra button')].find(x => x.textContent.trim() === '🔗 공급 경로 보기'); if (!b) return false; b.click(); return true`);
      await ctx.pump(2); const rt = await toastNow(), r1 = await P('window.__k7().반짝'); out['③' + 층] = { 토스트: rt, 반짝: r1 - r0 };
      if (층 === 2) ctx.expect(rt === '✂️ 여기예요' && r1 - r0 >= 1, '③ 🔗 공급 경로 — 2층 토스트 꼬리 0 · ✨ 그대로 ' + J(out['③2']));
      else ctx.expect(/이으면 가게에 닿아요$/.test(rt) && r1 - r0 >= 1, '③ 양성 대조 — 3층 공급 경로 토스트 꼬리 있음 ' + J(out['③3']));
      /* ⑤ 진짜 주민 — 2배속으로 흘리며 지금 뜬 💬 바람 · 🛒? 풍선 주민의 카드 글을 모은다(같은 순간 flowSay 를 끈 글 = 양성 대조) */
      await E(`window.__setSpeed(2); return 1`); const 본 = { 바람: [], 풍선: [], 끈말: [], 장: 0 };
      for (let k = 0; k < 60 && !(본.바람.length && 본.풍선.length); k++) { await ctx.pump(60); 본.장 += 60;
        const cs = await P(`(() => { const a = window.__k7Cards(), s = a.filter(c => c.풍선 === '장보기'); if (!s.length) return { a, 끈: [] };
          window.VRULES.flowSay.on = false; const b = window.__k7Cards().filter(c => c.풍선 === '장보기'); window.VRULES.flowSay.on = true; return { a, 끈: b }; })()`);
        cs.a.forEach(c => { if (c.바람 && !본.바람.includes(c.글)) 본.바람.push(c.글); if (c.풍선 === '장보기' && !본.풍선.includes(c.글)) 본.풍선.push(c.글); });
        cs.끈.forEach(c => { if (!본.끈말.includes(c.글)) 본.끈말.push(c.글); }); }
      await E(`window.__setSpeed(0); return 1`); out['⑤' + 층] = 본;
      const 뜻 = t => String(t).split('\n')[1] || '';
      if (층 === 2) ctx.expect(본.바람.length && 본.바람.every(t => !/있으면 좋겠어요/.test(t) && /^💬 가게에 물건이 없어요 — /.test(t)), "⑤ 2층 진짜 바람 주민 카드 '있으면 좋겠어요' 0 · 그 집 현상 말 " + J(본.바람));
      else ctx.expect(본.바람.length && 본.바람.every(t => /있으면 좋겠어요/.test(t)), "⑤ 양성 대조 — 3층 사본 진짜 바람 주민 카드 '있으면 좋겠어요' " + J(본.바람));
      ctx.expect(본.풍선.length && 본.풍선.every(t => 뜻(t) === '머리 위 🛒? 가게에 물건이 없어요'), `⑤ ${층}층 진짜 🛒? 풍선 주민 카드 = 집 카드와 같은 까닭('가게에 물건이 없어요') ` + J(본.풍선));
      ctx.expect(본.끈말.length && 본.끈말.every(t => 뜻(t) === (층 === 2 ? '머리 위 🛒? 가게가 멀어요' : '머리 위 🛒? 가게가 멀어요 — 집 가까이 지어 주세요')), `⑤ 양성 대조 — 같은 순간 flowSay 끄면 옛 말(${층}층) ` + J(본.끈말));
      /* ⑨ 빈 가게 문 앞 팻말 — ⑤ 로 판 시계가 흐른 뒤(그리기 틱 fsTick 은 30틱마다 · [시작] 바로 뒤엔 아직 안 돎 — 그때 읽으면 2층 · 3층 모두 null 인 헛 PASS) ·
         가게 마을로 다시 가 사진 · 그리기 틱이 적은 까닭 · 그 가게의 조각 수(partsOf) · 다시 합친 수 ≥ 1(틱이 돌았다는 표) */
      await shopTown(); await ctx.shot('팻말_' + 층 + '층');
      const 표 = await P(`(s => ({ 가게: s.가게 || null, 까닭: s.까닭 || null, 조각수: s.조각수, 다시합침: s.다시합침, 팻말셈: window.__k7().팻말 }))(window.__flowShape(129, 138))`); out['⑨' + 층] = 표;
      if (층 === 2) ctx.expect(표.가게 === 'empty' && 표.까닭 === null && 표.다시합침 >= 1 && 표.팻말셈 >= 1, '⑨ 2층 빈 가게 문 앞 팻말 까닭 그림 0(그리기 틱이 돈 뒤) ' + J(표));
      else ctx.expect(표.가게 === 'empty' && 표.까닭 === '길' && 표.다시합침 >= 1 && 표.팻말셈 === 0, "⑨ 양성 대조 — 3층 사본 팻말 까닭 '길' " + J(표));
      ctx.expect(outside() === o0, `②③ ${st} 바깥 시도 0`); }
    ctx.expect(out['⑨2'] && out['⑨3'] && out['⑨2'].조각수 < out['⑨3'].조각수, '⑨ 2층 가게 조각이 3층보다 적음(팻말 · 까닭 그림이 실제로 안 그려짐) ' + J([out['⑨2'], out['⑨3']]));
    /* ── ④ 길 끌기 — 수업 판(끔) · 판 규칙 켬 · 자유 모드 ── */
    for (const [st, save, 켬] of [['lesson0', null, false], ['zz-dk7-road', null, true], [null, 'pop88', true]]) { const o0 = outside(), 이름 = st || '자유 모드(pop88)'; await fresh(st, save); await closeCards();
      await E(`window.__setSpeed(0); return 1`); await ctx.pump(30); await ctx.sleep(2300); await ptsMap();
      const run = await runOf(); ctx.expect(run, `④ ${이름} 끌 빈 땅 네 칸`); if (!run) continue;
      const n0 = await roads(), d0 = (await dk()).생김.filter(x => x.id === 'roadTag').length, r = await dragRoad(run[0].p, run[1].p);
      const n1 = await roads(), d1 = (await dk()).생김.filter(x => x.id === 'roadTag').length, s = await 셋(), css = await P(`({ 채팅style: !!document.getElementById('chirpCss'), 이름표style: !!document.getElementById('roadTagCss') })`);
      out['④' + 이름] = { 칸: [run[0].c, run[1].c], 길: [n0, n1], 이름표생김: d1 - d0, 끄는중: r.끄는중, 고름: r.고름, 길끌기: s.길끌기, css };
      ctx.expect(r.고름, `④ ${이름} 길 카드 고름`);
      if (!켬) ctx.expect(s.길끌기 === false && d1 - d0 === 0 && !r.끄는중 && n1 - n0 >= 2, `④ ${이름} 길 끌기 끔 — 이름표 0 · 끌어 놓기는 그대로(길 ${n1 - n0}칸) ` + J(out['④' + 이름]));
      else ctx.expect(s.길끌기 === true && d1 - d0 >= 1 && r.끄는중 && r.끄는중.자리 === 'fixed' && n1 - n0 >= 2, `④ ${이름} 길 끌기 켬 — 이름표 생김 · position fixed ` + J(out['④' + 이름]));
      if (st) ctx.expect(outside() === o0, `④ ${이름} 바깥 시도 0`); }
    ctx.expect(out['④zz-dk7-road'] && out['④zz-dk7-road'].css && !out['④zz-dk7-road'].css.채팅style && out['④zz-dk7-road'].css.이름표style, '④ 💬 가 꺼진 판에서 이름표 모양은 따로(roadTagCss) ' + J(out['④zz-dk7-road'] && out['④zz-dk7-road'].css));
  } finally { made.forEach(f => fs.rmSync(f, { force: true })); try { await ctx.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: obs.identifier }); } catch (e) {} }
  return out;
}
