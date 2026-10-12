// 장면 start-card — [MAC-CLOCK] PA-06 시계 쥐기를 진짜 크롬(가짜 시계)에서: node scripts/village-d/dcheck.mjs --scene start-card
// 무화면 하네스는 타이머가 없어 시작 카드가 안 뜬다 — 카드 · Space · ❓ · 쥐는 이 겹침 · 단추는 여기서 본다(판정 쪽은 test.mjs CLOCK).
// ① two-villages 처음 열기 — 판을 실은 뒤 진짜 시간에 맞춰 프레임을 흘리며 카드를 기다린다: 카드가 뜬 순간 틱 0 · boot → scard 넘김(그 사이 흘린 프레임 수도 봄 — 안 흘렸으면 헛 PASS)
// ② 카드가 뜬 채 가짜 60초(step 3600 · 1/60초) → 틱 그대로 · Space(keydown ' ') → 다시 쥠 · 그대로
// ③ 양성 대조: 짐작 하나 고르고 [시작] → 쥔 [] · 멈춤 false · 배속 1 · step(600) → 틱 ≥ 50 · 4× 단추 숨김(판 칸 배속최대 2)
//    ③-2 시작 저장본 speed 0(임시 판) — 멈춘 채 열려도 [시작] = 1배속으로 흐름 · 켜진 단추 ⏸ → 1× · 카드 동안 저장은 풀린 뒤 배속(1)
// ④ ❓ 여는 조건(수업 판): 시계가 도는 동안 ❓ → 카드 0 · 짧은 말 / ⏸ 뒤 ❓ → 카드 뜸 · 닫아도 멈춘 채(아이가 멈춘 판)
// ⑤ 다시 열기(이미 시작함) → 카드 0 · boot 는 규칙 뒤 풂 · 프레임을 흘리면 틱이 는다 / #끝 으로 열기 → 끝 카드는 쥐지 않음
// ⑥ 기본 마을(새 프로필): 첫 안내 위에 ❓ 를 열고 안내를 닫아도 멈춘 채(쥔 bhelp — 옛 엔진은 여기서 흘렀다) · ❓ 를 닫으면 흐름 ·
//    도는 동안에도 ❓ 열림(수업 판 아님) · 쥔 동안 ⏸ 를 누르면 닫아도 멈춘 채 / ⑥-3 pop88 저장본: ❓ 위에 칭호 카드 → ❓ 를 먼저 닫아도 칭호 카드가 쥔 채 ·
//    칭호 카드를 닫으면 흐름 / ⑥-2 자유 판(town · 교과 없음)도 도는 동안 ❓ 열림
// ⑦ 모형 화면 단추 — empty-shop-ga(생산멈춤 false) · 임시 판(proto-flow + 판규칙 멈춤.생산)은 '⏸ 생산 멈춤' 없음 · 🔗 공급 경로 보기는 그대로 / 양성 대조 proto-flow 는 ⏸ 있음
// 임시 판(zz-dclock-*)을 장면 안에서 쓰고 끝에 지운다(try/finally · 커밋 안 함). 판 쪽 페이지는 바깥 시도 0 을 함께 본다.
import fs from 'node:fs'; import path from 'node:path';
export default async function startCard(ctx) {
  const C = ctx.C, E = (s, ms) => ctx.evaluate(s, ms), P = e => ctx.probe(e), out = {}, J = JSON.stringify;
  const url = (stage, hash) => ctx.BASE + '/village/index.html?' + (stage ? 'stage=' + stage + '&' : '') + 'sid=guest' + (hash ? '#' + hash : '');
  const ready = what => C.until(`typeof window.__clockHold === 'function' && window.__shots && typeof window.__gfxMode === 'function'`, 30000, what);
  const fresh = async (stage, hash) => { await C.nav(ctx.BASE + '/village/stages/rules.json'); await E('localStorage.clear(); sessionStorage.clear(); return 1');
    await C.nav(url(stage, hash)); await ready((stage || '기본 마을') + ' 불러오기'); await E(`window.__gfxMode('fixed'); return 1`); };
  const step = async n => { for (let k = 0; k < n; k += 600) await E(`return window.__shots.step(${Math.min(600, n - k)}, 1000 / 60)`, 240000); };
  const ticks = () => P('window.__sim().틱'), hold = () => P('window.__clockHold()'), card = () => P('!!document.getElementById("stageCard")');
  const waitCard = async () => { let frames = 0; for (let k = 0; k < 120 && !(await card()); k++) { await C.pump(6); frames += 6; await ctx.sleep(100); } return frames; };   /* 진짜 시간 꼴로(100ms 에 6장) */
  const start = () => E(`const p = document.querySelector('#stageCard .pred .po button'); if (p) p.click(); const g = [...document.querySelectorAll('#stageCard button')].find(b => b.textContent.trim() === '시작'); if (!g || g.disabled) return false; g.click(); return true`);
  const btns = () => P(`[...document.querySelectorAll('#spd button')].map(b => b.dataset.s + ':' + (b.style.display === 'none' ? '숨김' : '보임') + (b.classList.contains('on') ? '*' : ''))`);
  const bhClose = () => E(`document.querySelector('#bubbleHelp button[data-bh="close"]').click(); return 1`);
  const outside = () => C.st.tries.filter(t => !t.ok).length;
  const DIR = path.join(ctx.ROOT, 'village/stages'), base = n => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8')), made = [];
  const put = (f, o) => { fs.writeFileSync(path.join(DIR, f), JSON.stringify(o, null, 1)); made.push(path.join(DIR, f)); };
  try {
    put('zz-dclock-make.json', { ...base('proto-flow.json'), id: 'zz-dclock-make', 판규칙: { 멈춤: { 생산: true, 뜻: '시험 판 — 생산을 세운다' } } });
    { const s = base('starts/two-villages.json'); put('starts/zz-dclock-pause.json', { ...s, clock: { ...s.clock, speed: 0 } });
      put('zz-dclock-pause.json', { ...base('two-villages.json'), id: 'zz-dclock-pause', 시작: 'stages/starts/zz-dclock-pause.json' }); }
    /* ① 처음 열기 — 카드는 setTimeout 600(진짜 시간) 뒤 */
    let o0 = outside(); await fresh('two-villages');
    const frames = await waitCard(), h1 = await hold(); out['①카드전프레임'] = frames; out['①쥠'] = h1;
    ctx.expect(await card(), '① two-villages 시작 카드가 뜸');
    ctx.expect(frames >= 12, `① 카드 전에 프레임 ${frames}장을 흘림(≥ 12 — 쥠이 없으면 틱이 흘렀을 창)`);
    ctx.expect(h1.카드틱 === 0 && h1.넘김 === 1 && J(h1.쥔) === '["scard"]' && h1.멈춤 && h1.처음카드, '① 카드가 뜬 순간 틱 0 · boot → scard 넘김 ' + J(h1));
    /* ② 카드가 뜬 채 가짜 60초 · Space */
    const t0 = await ticks(); await step(3600); const t1 = await ticks(), h2 = await hold(); out['②틱'] = [t0, t1];
    ctx.expect(t1 === t0 && J(h2.쥔) === '["scard"]' && h2.멈춤, `② 카드가 뜬 채 가짜 60초 — 틱 ${t0} → ${t1} 그대로 · 쥔 ${J(h2.쥔)}`);
    await E(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); return 1`); await step(120);
    const t2 = await ticks(), h3 = await hold(); out['②Space'] = { 틱: t2, 되쥠: h3.되쥠 };
    ctx.expect(t2 === t1 && h3.되쥠 >= 1 && h3.멈춤 && J(h3.쥔) === '["scard"]', `② Space 를 눌러도 쥔 채 — 틱 ${t1} → ${t2} · 되쥠 ${h3.되쥠}`);
    /* ③ [시작] — 양성 대조 */
    const go = await start(), h4 = await hold(), t3 = await ticks(); await step(600); const t4 = await ticks(); out['③시작'] = { 쥠: h4, 틱: [t3, t4] };
    ctx.expect(go && !(await card()) && !h4.쥔.length && !h4.멈춤 && h4.배속 === 1, '③ [시작] → 쥔 [] · 멈춤 false · 배속 1(저장본 speed 1) ' + J(h4));
    ctx.expect(t4 - t3 >= 50, `③ 양성 대조 — [시작] 뒤 가짜 10초 틱 ${t3} → ${t4}(≥ 50)`);
    const spd = await btns(); out['③단추'] = spd;
    ctx.expect(spd.includes('4:숨김') && spd.includes('2:보임') && spd.includes('1:보임*') && h4.배속최대 === 2, '③ 배속최대 2 — 4× 단추 숨김 · 켜진 단추 1× ' + J(spd));
    /* ④ ❓ 여는 조건 — 아이 길 그대로: 🎯 로 목표판을 펴면(목표판을 다시 그림) 맨 아래에 ❓ 단추 → 누름 */
    const q = () => E(`if (!document.getElementById('goals').classList.contains('show')) document.getElementById('goalBtn').click();
      const b = document.querySelector('#goals button[data-bh="open"]'); if (!b) return null; b.click(); const h = document.getElementById('bubbleHelp'); return { 뜸: !!(h && h.classList.contains('show')), 말: (document.getElementById('toast') || {}).textContent || '' }`);
    const q1 = await q(), h5 = await hold(); out['④도는동안'] = q1;
    ctx.expect(q1 && !q1.뜸 && /풍선 뜻/.test(q1.말) && h5.막은물음 === 1 && !h5.멈춤, '④ 시계가 도는 동안 ❓ → 카드 0 · 짧은 말 ' + J(q1));
    await P('window.__setSpeed(0)'); const q2 = await q(), h6 = await hold(); out['④멈춘뒤'] = q2;
    ctx.expect(q2 && q2.뜸 && J(h6.쥔) === '["bhelp"]', '④ ⏸ 뒤 ❓ → 카드 뜸 · 쥔 bhelp ' + J({ q2, 쥔: h6.쥔 }));
    await bhClose(); const t5 = await ticks(); await step(120); const h7 = await hold(), t6 = await ticks();
    ctx.expect(!h7.쥔.length && h7.멈춤 && t6 === t5, '④ ❓ 를 닫아도 아이가 멈춘 판은 멈춘 채 ' + J({ 쥔: h7.쥔, 멈춤: h7.멈춤, 틱: [t5, t6] }));
    /* ⑤ 다시 열기(이미 시작함) · #끝 */
    await P('(window.__setSpeed(1), window.__save())');
    await C.nav(url('two-villages')); await ready('two-villages 다시 열기'); await E(`window.__gfxMode('fixed'); return 1`);
    const h8 = await hold(), t7 = await ticks(); await ctx.advance(1500); const t8 = await ticks(), c8 = await card(); out['⑤다시열기'] = { 쥠: h8, 틱: [t7, t8] };
    ctx.expect(!c8 && !h8.쥔.length && h8.쥠 === 1 && h8.풂 === 1 && h8.넘김 === 0 && h8.카드틱 == null, '⑤ 다시 열기(이미 시작함) — 카드 0 · boot 는 규칙 뒤 풂 ' + J(h8));
    ctx.expect(t8 > t7, `⑤ 프레임을 흘리면 틱이 는다 ${t7} → ${t8}`);
    await fresh('two-villages', '끝'); await ctx.advance(1500);
    const h9 = await hold(), ec = await P(`(() => { const c = document.getElementById('stageCard'); return c ? c.textContent.slice(0, 40) : null; })()`), t9 = await ticks(); await step(120); const t10 = await ticks(); out['⑤끝'] = { 쥠: h9, 끝카드: ec };
    ctx.expect(ec && !h9.쥔.length && !h9.멈춤 && h9.넘김 === 0 && t10 > t9, '⑤ #끝 — 끝 카드는 쥐지 않음 · boot 는 규칙 뒤 풂 ' + J({ 쥔: h9.쥔, 멈춤: h9.멈춤, 끝카드: ec, 틱: [t9, t10] }));
    /* ③-2 시작 저장본 speed 0 — 멈춘 채 열림 → [시작] = 1배속 */
    await fresh('zz-dclock-pause'); await waitCard();
    const p1 = await hold(), pb = await btns(), ps = await P('JSON.parse(window.__exportText()).clock.speed'); await start(); const p2 = await hold(), pa = await btns(), t11 = await ticks(); await step(120); const t12 = await ticks();
    out['③-2'] = { 카드: p1, 단추: [pb, pa], 저장: ps, 틱: [t11, t12] };
    ctx.expect(J(p1.쥔) === '["scard"]' && p1.풀면흐름 && pb.includes('0:보임*') && ps === 1, '③-2 저장본 speed 0 — 카드 동안 쥠 · ⏸ 켜진 채 · 저장은 풀린 뒤 배속 1 ' + J({ 쥔: p1.쥔, 단추: pb, 저장: ps }));
    ctx.expect(!p2.멈춤 && p2.배속 === 1 && pa.includes('1:보임*') && t12 - t11 >= 10, '③-2 [시작] = 1배속으로 흐름 · 켜진 단추 1× ' + J({ 멈춤: p2.멈춤, 배속: p2.배속, 단추: pa, 틱: [t11, t12] }));
    ctx.expect(outside() === o0, '①~⑤ 판 페이지 바깥 시도 0');
    /* ⑥ 기본 마을 — 첫 안내 위에 ❓ */
    await fresh(null);
    for (let k = 0; k < 40 && !(await P('window.__guide().보임')); k++) await ctx.advance(250);
    ctx.expect(await P('window.__guide().보임'), '⑥ 기본 마을 첫 안내가 뜸');
    const b1 = await P('window.__bubbleHelp(0).열림'); await E(`document.getElementById('guideSkip').click(); return 1`);
    const t13 = await ticks(); await step(300); const t14 = await ticks(), h10 = await hold(); out['⑥겹침'] = { 물음: b1, 틱: [t13, t14], 쥔: h10.쥔 };
    ctx.expect(b1 && t14 === t13 && J(h10.쥔) === '["bhelp"]' && h10.멈춤, `⑥ 안내를 닫아도 ❓ 가 쥔 채 — 틱 ${t13} → ${t14} · 쥔 ${J(h10.쥔)}`);
    await bhClose(); await step(300); const t15 = await ticks(), h11 = await hold();
    ctx.expect(!h11.쥔.length && !h11.멈춤 && t15 - t14 >= 20, `⑥ 양성 대조 — ❓ 를 닫으면 흐름 ${t14} → ${t15}`);
    const q3 = await E(`window.__bubbleHelp(0); const h = document.getElementById('bubbleHelp'); return !!(h && h.classList.contains('show'))`), h12 = await hold();
    ctx.expect(q3 && J(h12.쥔) === '["bhelp"]' && h12.막은물음 === 0, '⑥ 기본 마을은 시계가 도는 동안에도 ❓ 가 열림(수업 판 아님) ' + J({ 뜸: q3, 쥔: h12.쥔 }));
    await P('window.__setSpeed(0)'); await bhClose(); const t16 = await ticks(); await step(120); const t17 = await ticks(), h13 = await hold();
    ctx.expect(!h13.쥔.length && h13.멈춤 && t17 === t16, '⑥ 쥔 동안 ⏸ 를 누르면 ❓ 를 닫아도 멈춘 채(아이가 고른 멈춤) ' + J({ 쥔: h13.쥔, 멈춤: h13.멈춤, 틱: [t16, t17] }));
    /* ⑥-3 기본 마을(pop88 저장본 — 칭호 후보가 있다): ❓ 위에 칭호 카드를 열고 ❓ 를 먼저 닫아도 칭호 카드가 쥔 채 · 칭호 카드를 닫으면 흐름 */
    await C.nav(ctx.BASE + '/village/stages/rules.json');
    await E(`localStorage.clear(); sessionStorage.clear(); const r = await fetch('/village/stages/boards/pop88.json'); localStorage.setItem('rpg.village.guest', await r.text()); return 1`);
    await C.nav(url(null)); await ready('기본 마을 pop88 불러오기'); await E(`window.__gfxMode('fixed'); return 1`); await ctx.advance(1000);
    const tc = await E(`window.__bubbleHelp(0); window.__titleOpen(); return !!document.getElementById('titleCard')`); await bhClose();
    const t18 = await ticks(); await step(120); const t19 = await ticks(), h16 = await hold();
    ctx.expect(tc && J(h16.쥔) === '["title"]' && h16.멈춤 && t19 === t18, '⑥-3 ❓ 를 먼저 닫아도 칭호 카드가 쥔 채 ' + J({ 칭호카드: tc, 쥔: h16.쥔, 틱: [t18, t19] }));
    await E(`const b = [...document.querySelectorAll('#titleCard button.tl')].find(x => /나중에|그대로/.test(x.textContent)); b.click(); return 1`); await step(120); const t20 = await ticks(), h17 = await hold();
    ctx.expect(!h17.쥔.length && !h17.멈춤 && t20 - t19 >= 10, `⑥-3 양성 대조 — 칭호 카드를 닫으면 흐름 ${t19} → ${t20}`);
    /* ⑥-2 자유 판(town — 교과 없음 · 카드 없음): 도는 동안 ❓ 열림 */
    await fresh('town'); await ctx.advance(1000);
    const h14 = await hold(), q4 = await E(`window.__bubbleHelp(0); const h = document.getElementById('bubbleHelp'); return !!(h && h.classList.contains('show'))`), h15 = await hold();
    ctx.expect(!h14.쥔.length && !h14.멈춤 && q4 && J(h15.쥔) === '["bhelp"]' && h15.막은물음 === 0, '⑥-2 자유 판 town — 도는 동안 ❓ 열림 ' + J({ 전: { 쥔: h14.쥔, 멈춤: h14.멈춤 }, 뜸: q4, 쥔: h15.쥔 }));
    /* ⑦ 모형 화면 단추 */
    const pmap = async stage => { o0 = outside(); await fresh(stage); for (let k = 0; k < 40 && !(await P('!!document.getElementById("pmapBar")')); k++) await ctx.advance(250);
      const r = await E(`const t = w => { window.__protoMap(w); return [...document.querySelectorAll('#pmapExtra button')].map(b => b.textContent.trim()); }; return { v0: t('v0'), v1: t('v1'), 생산멈춤: window.__protoMap().생산멈춤 }`);
      ctx.expect(outside() === o0, stage + ' 바깥 시도 0'); return r; };
    const pf = await pmap('proto-flow'), es = await pmap('empty-shop-ga'), zm = await pmap('zz-dclock-make'); out['⑦'] = { pf, es, zm };
    const 멈 = r => [...r.v0, ...r.v1].some(t => /생산 (멈춤|다시)$/.test(t)), 길 = r => [...r.v0, ...r.v1].includes('🔗 공급 경로 보기');
    ctx.expect(멈(pf) && 길(pf) && !pf.생산멈춤, '⑦ 양성 대조 — proto-flow 모형 화면에 ⏸ 생산 멈춤 · 🔗 공급 경로 보기 ' + J(pf));
    ctx.expect(!멈(es) && 길(es) && !es.생산멈춤, '⑦ empty-shop-ga(생산멈춤 false) — ⏸ 생산 멈춤 없음 · 🔗 그대로 ' + J(es));
    ctx.expect(!멈(zm) && 길(zm) && zm.생산멈춤 === true, '⑦ 판규칙 멈춤.생산 — 생산이 멈춘 채 · ⏸/▶ 단추 없음 · 🔗 그대로 ' + J(zm));
  } finally { made.forEach(f => fs.rmSync(f, { force: true })); }
  return out;
}
