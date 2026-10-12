// 장면 lk — [LK-CARD] PA-09 같은 모습 잣대 · 카드 틀 하나(vcardShow): node scripts/village-d/dcheck.mjs --scene lk
// build/D §LK 수용 시험 가운데 **지금 있는 카드만**(시작 · 끝 · 되묻기 — pick = PA-13 · qr = PA-14q · 양상 걷기 = PA-14a) · 엔진 사실 H17 #13:
//   ① 틀 지문 — getComputedStyle {카드 바탕 · 모서리 · 글꼴 · 주 단추 바탕 · 높이 · 초점 테 색}이 시작 카드 지문과 같음(끝 · 시험 kind 한 장) ·
//      되묻기 = 둘째 지문(주 단추 = --vk-warn · 금 테두리 2px) · 셋 다 틀 표지(막 .vk-dim · 카드 data-vcard)
//   ② 넘침 — 카드가 뜨는 판 전부 × 시작 · 끝 · 되묻기 × 보통 · 크게: card.scrollHeight ≤ clientHeight + 주 단추([시작] · [닫기] · [↺]) bottom ≤ innerHeight
//      ('카드 높이 ≤ 586' · '1366×610 넘침 0' 은 CSS max-height · overflow:auto 때문에 늘 참 — 그 잣대는 쓰지 않는다)
//   ③ 겹침 — 카드가 뜬 동안 #cv 보임 · 막 불투명도 < 1 · 카드 밖 화면이 마을 그림(색이 여럿)
//   ④ 💬 · ❓ · 카드 — 자유 모드(판 없음 · 판 카드만 한 시험 카드) 1366×610 보통 · 크게 · 900×610: 카드 단추 · 🔊 자리가 맨 위 · 💬 · ❓ 는 막 아래 ·
//      겹친 넓이 1366×610 은 0 · 900×610 은 적기만(카드가 위)
//   손: 되묻기 처음 초점 = 그만두기 · Tab · Shift+Tab 가둠 · Esc · 바깥 누름 = 그만두기(CDP 진짜 키 · 마우스) · 몸 안 단추는 카드를 안 닫음(단추 명시적 묶기)
//      (H16 '수업 판에 💬 #chirpBtn 0' 은 💬 기본 끔이 들어오는 PA-07 뒤 — 여기선 '대기'로 지금 수만 적는다)
//   ⑤ 되돌리기 — VRULES.lookKit.on = false 면 옛 꼴(틀 표지 0)로 뜨고 지문은 같음
//   양성 대조(헛 PASS 막기): 긴 글을 넣은 카드 → 넘침 잣대가 잡음 · 지문 한 칸(모서리)을 바꾸면 잡음 · 막을 불투명하게 하면 '마을 그림' 잣대가 잡음 · 크게가 실제로 글을 키움
// 판은 열 때마다 새 프로필(시작 카드가 처음 뜸) · 시계는 진짜 시간(시작 카드 600ms · 끝 카드 시작 땅 받기)과 프레임을 함께 흘린다.
import fs from 'node:fs'; import path from 'node:path';

const HELP = `window.__lkT = (() => {
  if (!document.getElementById('lkStill')) { const st = document.createElement('style'); st.id = 'lkStill'; st.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'; document.head.appendChild(st); }   /* .card 의 transition .1s 가 잰 값을 흔든다(크게 · 모서리 대조) — 끝 모습만 잰다 */
  const q = s => document.querySelector(s), vis = e => !!e && e.getClientRects().length > 0, cardOf = el => el && el.querySelector(':scope > .card'), goOf = c => c && (c.querySelector('.vk-btns > .vk-go') || c.querySelector(':scope > div:last-child > button:last-child'));
  const R = r => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) });
  return {
    has: s => !!q(s),
    fp(s) { const el = q(s), c = cardOf(el), g = goOf(c); if (!c) return null; const cs = getComputedStyle(c), bs = g ? getComputedStyle(g) : null;
      return { 바탕: cs.backgroundColor, 모서리: cs.borderTopLeftRadius, 글꼴: cs.fontFamily, 테: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        단추바탕: bs && bs.backgroundColor, 단추높이: bs && bs.minHeight, 단추글: g && g.textContent.trim(), 틀: el.classList.contains('vk-dim') && c.hasAttribute('data-vcard'), kind: c.getAttribute('data-vcard') || null }; },
    of(s) { const el = q(s), c = cardOf(el), g = goOf(c); if (!c) return null; const r = c.getBoundingClientRect(), b = g ? g.getBoundingClientRect() : null;
      return { 스크롤: c.scrollHeight, 보임: c.clientHeight, 높이: Math.round(r.height), 아래: Math.round(r.bottom), 단추아래: b ? Math.round(b.bottom * 10) / 10 : null, 창: innerHeight,
        글: parseFloat(getComputedStyle(c).fontSize), ok: c.scrollHeight <= c.clientHeight && !!b && b.bottom <= innerHeight && b.top >= 0 }; },
    over(s) { const el = q(s), c = cardOf(el), cv = q('#cv'), bg = getComputedStyle(el).backgroundColor, m = /rgba?\\(([^)]+)\\)/.exec(bg), p = m ? m[1].split(',').map(Number) : [];
      return { cv: getComputedStyle(cv).display, cv보임: getComputedStyle(cv).visibility, 막: bg, 막불투명도: p.length > 3 ? p[3] : 1, 카드: R(c.getBoundingClientRect()) }; },
    rect: s => { const e = q(s); return vis(e) ? R(e.getBoundingClientRect()) : null; },   /* fixed 요소는 offsetParent 가 늘 null — 보임은 getClientRects 로 */
    hit(s) { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t ? (t === e || e.contains(t) ? 'self' : (t.id || t.className || t.tagName)) : null; },
    long(s, on) { const c = cardOf(q(s)); if (!c) return false; const o = c.querySelector('.lkLong'); if (o) o.remove(); if (on) c.insertAdjacentHTML('afterbegin', '<div class="lkLong">' + '아주 긴 글로 카드를 넘치게 해 본다. '.repeat(160) + '</div>'); return true; },
    close(s) { const c = cardOf(q(s)); if (!c) return null; const g = goOf(c), sk = c.querySelector('button.skip'); const b = g && !g.disabled ? g : sk || g; if (!b) return null; const t = b.textContent.trim(); b.click(); return t; },
    reset() { const b = [...document.querySelectorAll('button')].find(x => /처음부터/.test(x.textContent) && vis(x) && !x.closest('.vk-dim') && !x.closest('#askCard')); if (!b) return false; b.click(); return true; }
  }; })(); 1`;

/* 화면 사진에서 카드 밖 점을 골라 색 수를 센다(8단계로 묶음) — 단색이면 1 */
const PIXELS = png => `const im = new Image(); im.src = 'data:image/png;base64,${png}'; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, k = window.__lkCard, cols = new Set(); let n = 0;
  for (let y = 8; y < c.height - 8; y += 23) for (let x = 8; x < c.width - 8; x += 23) { if (k && x >= k.x - 4 && x <= k.r + 4 && y >= k.y - 4 && y <= k.b + 4) continue;
    const i = (y * c.width + x) * 4; cols.add((d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5)); n++; }
  return { 점: n, 색: cols.size };`;

export default async function lk(ctx) {
  const E = (src, ms) => ctx.evaluate(src, ms), P = s => ctx.probe(s), sl = ms => ctx.sleep(ms), J = JSON.stringify;
  const DIR = path.join(ctx.ROOT, 'village/stages');
  const BOARDS = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'rules.json').map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))])
    .filter(([, d]) => d.교과 != null || d.카드 === true).map(([id]) => id).sort();   /* 엔진 stageCardBoot 와 같은 조건 — 시작 카드가 뜨는 판 */
  const SHOTS = new Set(['help-places', 'town3']);   /* 사진은 두 판만(나머지는 숫자만) */
  const view = (w, h) => ctx.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const help = () => E(HELP);
  const big = on => E(`window.__lookKit({ big: ${!!on} }); return document.documentElement.classList.contains('vk-big') === ${!!on}`).catch(() => null);   /* rAF 는 가짜 시계 줄에 쌓이므로 여기서 기다리지 않는다 */
  const settle = async (n = 30, ms = 120) => { await ctx.pump(n); await sl(ms); };
  /* 초점 테 색 — 단추에 :focus-visible 을 걸어(CDP) 계산한 outline */
  let forceOk = null;
  const focusFp = async sel => { try { await ctx.send('DOM.enable'); await ctx.send('CSS.enable'); const doc = await ctx.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await ctx.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel }); if (!nodeId) return null;
      await ctx.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] });
      const v = await P(`(() => { const s = getComputedStyle(document.querySelector(${J(sel)})); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor; })()`);
      await ctx.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }); forceOk = true; return v; } catch (e) { forceOk = false; return 'ERR ' + String(e.message || e).slice(0, 60); } };
  const fpFull = async (dim, goSel) => { const f = await P(`window.__lkT.fp(${J(dim)})`); if (f) f.초점 = await focusFp(goSel); return f; };
  const same = (a, b, keys) => keys.every(k => a && b && a[k] === b[k]);
  const FPK = ['바탕', '모서리', '글꼴', '단추바탕', '단추높이', '초점'], FPK2 = ['바탕', '모서리', '글꼴', '단추높이', '초점'];
  const out = { 판: [], 지문: {}, 대조: {}, 자유: {}, 되돌리기: {}, 대기: {} };
  let startFp = null;

  /* 판 열기 → 첫 안내(있으면)를 건너뛰고 시작 카드를 기다린다(village-look card 장면과 같은 꼴 · 카드 안 '건너뛰기'(짐작)는 누르지 않음) */
  const openBoard = async id => { await ctx.open({ stage: id }); await help();
    const has = await E(`const sl = ms => new Promise(r => setTimeout(r, ms));
      for (let k = 0; k < 50 && !document.getElementById('stageCard'); k++) { [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '건너뛰기' && b.offsetParent && !b.closest('#stageCard')).forEach(b => b.click()); await sl(200); }
      return !!document.getElementById('stageCard')`, 30000);
    await settle(); await ctx.C.netIdle(4000); await settle(); return has; };
  /* 한 카드 — 보통 · 크게 넘침(+ 사진) */
  const measure = async (id, dim, tag) => { const n = await P(`window.__lkT.of(${J(dim)})`); if (SHOTS.has(id)) await ctx.shot(id + '_' + tag + '_보통');
    const on = await big(true); await settle(4, 60); const b = await P(`window.__lkT.of(${J(dim)})`); if (SHOTS.has(id)) await ctx.shot(id + '_' + tag + '_크게');
    await big(false); await settle(4, 60);
    ctx.expect(n && n.ok, `${id} ${tag} 보통 넘침 0 — 스크롤 ${n && n.스크롤} ≤ 보임 ${n && n.보임} · 단추 아래 ${n && n.단추아래} ≤ ${n && n.창}`);
    ctx.expect(on && b && b.ok, `${id} ${tag} 크게 넘침 0 — 스크롤 ${b && b.스크롤} ≤ 보임 ${b && b.보임} · 단추 아래 ${b && b.단추아래} ≤ ${b && b.창} · 글 ${n && n.글} → ${b && b.글}px`);
    return { 보통: n, 크게: b }; };

  /* ── ①②③ 판마다 ── */
  for (const id of BOARDS) { const row = { 판: id };
    try {
      row.시작뜸 = await openBoard(id);
      ctx.expect(row.시작뜸, id + ' 시작 카드가 뜸');
      if (row.시작뜸) {
        const fp = await fpFull('#stageCard', '#stageCard .vk-go');
        if (!startFp) { startFp = fp; out.지문.시작 = fp; }
        ctx.expect(fp && fp.틀 && fp.kind === 'start', id + ' 시작 카드 = 틀(.vk-dim · data-vcard=start) ' + J(fp && { 틀: fp.틀, kind: fp.kind }));
        ctx.expect(same(fp, startFp, FPK), id + ' 시작 카드 지문 = 첫 판 지문 ' + (same(fp, startFp, FPK) ? '' : J(fp)));
        row.시작 = await measure(id, '#stageCard', '시작');
        /* ③ 겹침 — 막 너머로 마을이 보이나 */
        const ov = await P(`window.__lkT.over('#stageCard')`); await E(`window.__lkCard = ${J(ov.카드)}; return 1`);
        const png = (await ctx.send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, px = await E(PIXELS(png), 60000);
        row.겹침 = { ...ov, 밖색: px.색, 밖점: px.점 };
        ctx.expect(ov.cv !== 'none' && ov.cv보임 !== 'hidden' && ov.막불투명도 < 1 && px.색 >= 8, `${id} 겹침 — #cv ${ov.cv} · 막 ${ov.막} (불투명도 ${ov.막불투명도} < 1) · 카드 밖 색 ${px.색}가지(≥ 8 · 마을 그림)`);
        row.시작닫음 = await P(`window.__lkT.close('#stageCard')`); await settle(20, 300);
        ctx.expect(!(await P(`window.__lkT.has('#stageCard')`)), id + ' 시작 카드 닫힘 — ' + row.시작닫음);
      }
      /* 끝 카드 — 교사의 #끝 과 같은 길(__stageEnd) · 시작 땅 받기(동그라미 · 한 줄)가 붙을 때까지 */
      await E('window.__stageEnd(); return 1'); await ctx.C.netIdle(4000); await settle(30, 400);
      row.끝뜸 = await P(`window.__lkT.has('#stageCard')`);
      if (row.끝뜸) { const fp = await fpFull('#stageCard', '#stageCard .vk-go');
        ctx.expect(fp && fp.틀 && fp.kind === 'end' && same(fp, startFp, FPK), id + ' 끝 카드 = 틀 · 지문 = 시작 카드 지문 ' + (same(fp, startFp, FPK) ? '' : J(fp)));
        if (!out.지문.끝) out.지문.끝 = fp;
        row.끝 = await measure(id, '#stageCard', '끝');
        row.끝닫음 = await P(`window.__lkT.close('#stageCard')`); await settle(10, 200); }
      else row.끝 = '끝 카드가 안 뜨는 판(교과 없음 · 끝카드 칸 없음)';
      /* 되묻기 — ↺ 처음부터(판 왼쪽 아래 · 모형 판은 단추 줄) */
      if (await P('window.__lkT.reset()')) { await settle(4, 150);
        const fp = await fpFull('#askCard', '#askCard .vk-go');
        ctx.expect(fp && fp.틀 && fp.kind === 'ask' && same(fp, startFp, FPK2) && fp.단추바탕 === 'rgb(200, 85, 61)' && /^2px solid rgb\(232, 176, 75\)$/.test(fp.테),
          id + ' 되묻기 = 틀 · 지문 = 시작 카드(둘째 지문: 주 단추 --vk-warn · 금 테 2px) ' + J(fp && { 단추바탕: fp.단추바탕, 테: fp.테, 초점: fp.초점 }));
        if (!out.지문.되묻기) out.지문.되묻기 = fp;
        row.되묻기 = await measure(id, '#askCard', '되묻기');
        const f0 = await P('document.activeElement && document.activeElement.className');
        await E(`window.__ask('no'); return 1`); await settle(2, 50);
        ctx.expect(f0 === 'vk-sub no' && !(await P(`window.__lkT.has('#askCard')`)), id + ' 되묻기 처음 초점 = 그만두기 · 그만두기로 닫힘 ' + J(f0)); }
      else row.되묻기 = '↺ 없음';
      row.챗 = await P(`document.querySelectorAll('#chirpBtn').length`);   /* H16 대기 — 수업 판 💬 수(PA-07 뒤엔 0 이어야) */
    } catch (e) { row.실패 = String(e.message || e).slice(0, 200); ctx.expect(false, id + ' — ' + row.실패); }
    out.판.push(row); process.stderr.write(`  [lk] ${id} 시작 ${row.시작 ? row.시작.보통.높이 + '/' + row.시작.크게.높이 : '-'} · 끝 ${row.끝 && row.끝.보통 ? row.끝.보통.높이 + '/' + row.끝.크게.높이 : '-'} · 되묻기 ${row.되묻기 && row.되묻기.보통 ? row.되묻기.보통.높이 : '-'}\n`); }

  /* ── 양성 대조 · 되돌리기 — 한 판(help-places)을 다시 열어 ── */
  const C0 = BOARDS.includes('help-places') ? 'help-places' : BOARDS[0];
  if (await openBoard(C0)) {
    /* 넘침 잣대가 긴 글을 잡나 */
    await P(`window.__lkT.long('#stageCard', true)`); const lo = await P(`window.__lkT.of('#stageCard')`); await P(`window.__lkT.long('#stageCard', false)`);
    out.대조.긴글 = lo; ctx.expect(lo && !lo.ok && lo.스크롤 > lo.보임, '대조 — 긴 글을 넣으면 넘침 잣대가 잡음 ' + J(lo && { 스크롤: lo.스크롤, 보임: lo.보임 }));
    /* 지문 잣대가 한 칸 차이를 잡나 */
    await E(`document.querySelector('#stageCard > .card').style.borderRadius = '12px'; return 1`); const fx = await P(`window.__lkT.fp('#stageCard')`);
    await E(`document.querySelector('#stageCard > .card').style.borderRadius = ''; return 1`);
    out.대조.지문 = fx && fx.모서리; ctx.expect(fx && !same({ ...fx, 초점: startFp.초점 }, startFp, FPK), '대조 — 모서리 한 칸을 바꾸면 지문 잣대가 잡음 ' + J(fx && fx.모서리));
    /* '마을 그림' 잣대가 단색 막을 잡나 */
    const ov = await P(`window.__lkT.over('#stageCard')`); await E(`window.__lkCard = ${J(ov.카드)}; document.getElementById('stageCard').style.background = '#0f1116'; return 1`);
    const png = (await ctx.send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, px = await E(PIXELS(png), 60000);
    await E(`document.getElementById('stageCard').style.background = ''; return 1`);
    out.대조.단색막 = px; ctx.expect(px.색 < 8, '대조 — 막을 불투명하게 하면 카드 밖 색이 ' + px.색 + '가지(< 8)로 잡힘');
    /* 크게가 실제로 글을 키우고 사진을 줄이나(넘침 0 이 크게 아닌 채로 지나가지 않게) */
    const k0 = await P(`(() => { const c = document.querySelector('#stageCard > .card'), f = c.querySelector('figure img, figure .ph'); return { 글: parseFloat(getComputedStyle(c).fontSize), 사진: f ? Math.round(f.getBoundingClientRect().width) : null }; })()`);
    await big(true); await settle(4, 60);
    const k1 = await P(`(() => { const c = document.querySelector('#stageCard > .card'), f = c.querySelector('figure img, figure .ph'); return { 글: parseFloat(getComputedStyle(c).fontSize), 사진: f ? Math.round(f.getBoundingClientRect().width) : null }; })()`);
    await big(false); out.대조.크게 = { 보통: k0, 크게: k1 };
    ctx.expect(k0.글 === 15 && k1.글 === 18.75 && k1.사진 < k0.사진, `대조 — 크게 = 글 ${k0.글} → ${k1.글}px · 사진 ${k0.사진} → ${k1.사진}px`);
    /* 되묻기 손 — Tab · Shift+Tab 이 카드 안에서 돎(초점 가둠) · Esc · 바깥 누름 = 그만두기(ACT-ASKCARD 옛 동작 그대로) — 진짜 키 · 마우스(CDP) */
    await P(`window.__lkT.close('#stageCard')`); await settle(20, 300);
    const key = async (k, code, vk, mod = 0) => { for (const type of ['keyDown', 'keyUp']) await ctx.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mod }); await sl(60); };
    const act = () => P(`(document.activeElement && document.activeElement.closest('#askCard') ? document.activeElement.className : 'out:' + (document.activeElement && (document.activeElement.id || document.activeElement.tagName)))`);
    if (await P('window.__lkT.reset()')) { await settle(4, 150); const f = [await act()];
      await key('Tab', 'Tab', 9); f.push(await act()); await key('Tab', 'Tab', 9); f.push(await act()); await key('Tab', 'Tab', 9, 8); f.push(await act());
      const n0 = await P('window.__ask().그만'); await key('Escape', 'Escape', 27); const esc = { 닫힘: !(await P(`window.__lkT.has('#askCard')`)), 그만: (await P('window.__ask().그만')) - n0 };
      await P('window.__lkT.reset()'); await settle(4, 150);
      for (const type of ['mousePressed', 'mouseReleased']) await ctx.send('Input.dispatchMouseEvent', { type, x: 6, y: 300, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
      await sl(100); const out0 = { 닫힘: !(await P(`window.__lkT.has('#askCard')`)), 그만: (await P('window.__ask().그만')) - n0 };
      out.대조.되묻기손 = { 초점: f, Esc: esc, 바깥: out0 };
      ctx.expect(J(f) === J(['vk-sub no', 'vk-go vk-warn ok', 'vk-sub no', 'vk-go vk-warn ok']), '되묻기 초점 가둠 — 그만두기 → Tab 확인 → Tab 그만두기 → Shift+Tab 확인 ' + J(f));
      ctx.expect(esc.닫힘 && esc.그만 === 1 && out0.닫힘 && out0.그만 === 2, '되묻기 Esc · 바깥 누름 = 그만두기 ' + J({ esc, out0 })); }
    else ctx.expect(false, C0 + ' 에 ↺ 처음부터가 없음(되묻기 손 시험)');
    /* ⑤ 되돌리기 — lookKit 끔: 끝 카드 · 되묻기가 옛 꼴로 뜨고 지문은 같다 */
    await E('window.VRULES.lookKit.on = false; window.__stageEnd(); return 1'); await settle(10, 300);
    const oe = await P(`window.__lkT.fp('#stageCard')`); if (oe) oe.초점 = await focusFp('#stageCard > .card > div:last-child > button');
    out.되돌리기.끝 = oe; ctx.expect(oe && !oe.틀 && same(oe, startFp, ['바탕', '모서리', '글꼴', '단추바탕', '단추높이']), '되돌리기 — lookKit 끔이면 끝 카드가 옛 꼴(틀 표지 0) · 지문 같음 ' + J(oe && { 틀: oe.틀, 초점: oe.초점 }));
    await P(`window.__lkT.close('#stageCard')`); await settle(10, 200);
    if (await P('window.__lkT.reset()')) { await settle(4, 150); const oa = await P(`!!document.querySelector('#askCard > .box') && !document.querySelector('#askCard.vk-dim')`);
      out.되돌리기.되묻기 = oa; ctx.expect(oa, '되돌리기 — lookKit 끔이면 되묻기도 옛 꼴(#askCard > .box)'); await E(`window.__ask('no'); return 1`); }
    await E('window.VRULES.lookKit.on = true; return 1');
  } else ctx.expect(false, '대조 판 ' + C0 + ' 시작 카드가 안 뜸');

  /* ── 새 kind 도 같은 틀 — 시험 카드(__vcard) 지문 = 시작 카드 지문 · 🔊 자리(tools) ── */
  await ctx.open({ stage: null }); await help(); await ctx.advance(2500); await help();
  const tk = await E(`window.__vcard({ kind: 'test', top: '시험 카드', q: '새 카드도 같은 틀인가요?', html: '<div>몸 한 줄</div>', tools: [{ t: '🔊', label: '읽어 주기' }] }); return 1`);
  const tf = await fpFull('#vcardTest', '#vcardTest .vk-go'); out.지문.시험 = tf;
  ctx.expect(tk && tf && tf.틀 && tf.kind === 'test' && same(tf, startFp, FPK) && await P(`!!document.querySelector('#vcardTest .vk-tools button[aria-label="읽어 주기"]')`), '새 kind(test) = 틀 · 지문 = 시작 카드 지문 · 🔊 자리(tools) ' + (same(tf, startFp, FPK) ? '' : J(tf)));
  /* 단추는 명시적으로 묶는다 — 몸(html)에 단추가 섞여도 그 단추가 닫기로 묶이지 않는다(옛 scardShow 의 querySelector('button') 함정 · 엔진 사실 ③) */
  const bind = await E(`window.__vcard({ kind: 'test', q: '몸에 단추', html: '<div><button type="button" class="lkIn">몸 안 단추</button></div>' });
    document.querySelector('#vcardTest .lkIn').click(); const a = !!document.getElementById('vcardTest'), g = document.querySelector('#vcardTest .vk-go'); if (g) g.click();
    const b = !!document.getElementById('vcardTest'); window.__vcard(null); return { 몸단추뒤: a, 주단추뒤: b }`);
  out.대조.단추묶기 = bind; ctx.expect(bind.몸단추뒤 && !bind.주단추뒤, '단추 명시적 묶기 — 몸 안 단추는 카드를 안 닫고 · 주 단추가 닫음 ' + J(bind));

  /* ── ④ 자유 모드 💬 · ❓ · 카드 — 1366×610(보통 · 크게) · 900×610 · 카드는 판 카드만 한 크기(사진 + 짐작 상자 꼴 660×380 몸) ── */
  await E(`window.__vcard({ kind: 'test', top: '시험 카드', q: '판 카드만 한 카드 — 💬 · ❓ 와 겹치나요?', html: '<div style="width:660px;max-width:100%;height:380px;margin:0 auto;background:#262b38"></div>', tools: [{ t: '🔊', label: '읽어 주기' }] }); return 1`);
  for (const [w, h, bg] of [[1366, 610, false], [1366, 610, true], [900, 610, false]]) { await view(w, h); await big(bg); await settle(10, 300);
    await E(`const g = document.getElementById('goals'); if (g && !g.classList.contains('show')) document.getElementById('goalBtn').onclick(); return 1`); await settle(10, 400);
    const a = await P(`({ 챗: window.__lkT.rect('#chirpBtn'), 물음: window.__lkT.rect('#goals button[data-bh="open"]'), 카드: window.__lkT.rect('#vcardTest > .card'), 단추: window.__lkT.hit('#vcardTest .vk-go'), 도구: window.__lkT.hit('#vcardTest .vk-tools button'),
      챗맞음: window.__lkT.hit('#chirpBtn'), 물음맞음: window.__lkT.hit('#goals button[data-bh="open"]') })`);
    const ix = (p, q) => p && q ? Math.max(0, Math.min(p.r, q.r) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.b, q.b) - Math.max(p.y, q.y)) : 0;
    const tag = w + '×' + h + (bg ? ' 크게' : ''); a.겹침 = { 챗카드: ix(a.챗, a.카드), 물음카드: ix(a.물음, a.카드), 챗물음: ix(a.챗, a.물음) }; out.자유[tag] = a;
    ctx.expect(a.챗 && a.물음 && a.카드, `${tag} 💬 · ❓ · 카드가 다 있음 ` + J({ 챗: !!a.챗, 물음: !!a.물음, 카드: !!a.카드 }));
    /* 겹침의 뜻 = 💬 · ❓ 가 카드(단추 · 🔊 자리) 위에 그려지지 않음(막 z 22 > 💬 6 · ❓ 7) — 넓이는 적기만 하고 1366×610 에선 0 이어야(엔진 회신 '💬 · ❓ · 끝 카드는 1366×610 에서 안 겹침') */
    ctx.expect(a.단추 === 'self' && a.도구 === 'self' && a.챗맞음 !== 'self' && a.물음맞음 !== 'self' && !a.겹침.챗물음 && (w < 1366 || (!a.겹침.챗카드 && !a.겹침.물음카드)),
      `${tag} 카드 단추 · 🔊 자리가 맨 위 · 💬 · ❓ 는 막 아래 · 겹친 넓이 💬∩카드 ${a.겹침.챗카드} · ❓∩카드 ${a.겹침.물음카드} · 💬∩❓ ${a.겹침.챗물음}${w < 1366 ? '(≤900 은 넓이를 적기만 — 카드가 위)' : ''}`);
    await ctx.shot('자유_' + w + 'x' + h + (bg ? '_크게' : '')); }
  await big(false); await view(ctx.result.창.w, ctx.result.창.h); await E('window.__vcard(null); return 1');
  out.대기.H16 = { 뜻: "수업 판 💬 #chirpBtn 0 — 💬 기본 끔은 PA-07 몫(이 PR 은 코드 0 · 대기 · 기대를 걸지 않음)", 챗있는판: out.판.filter(r => r.챗 > 0).length, 판: out.판.length };
  out.focusForce = forceOk;
  return out;
}
