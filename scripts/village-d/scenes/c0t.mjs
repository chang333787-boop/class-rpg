// 장면 c0t — [MAC-C0T] PA-12 C0-T 기기 기록을 진짜 크롬에서: node scripts/village-d/dcheck.mjs --scene c0t
// 무화면(test.mjs C0T)은 다시 싣기를 적기만 한다 — 진짜로 다시 실리나 · 토스트 · sync.js 요청 · 시작 카드는 여기서 본다(가짜 시계 + 진짜 타이머 → advance).
// (가) ?stage=help-places#n=1 — 요청 목록에 sync.js 0 · 바깥 시도 0 · 요청 주소에 # · n= 0 · VillageSync 없음 · 저장 키 번호 1 /
//      양성 대조: 기본 마을 — sync.js 1건 · VillageSync 부팅(current) · 그 script 가 module 앞 · 캐시버스터 그대로
// (나) ?stage=help-places#n=c3-07 → [시작] → 결정 A 적용(마을이 바뀜) → ↺ 처음부터 → 되묻기 [↺] → 다시 실림(앞 문서 표지 사라짐 · timeOrigin 바뀜 · ?r=) ·
//      해시 #n=c3-07 · 저장 키 c3-07 · 시작판(적용 0) · 판 카드는 지난 시도로
// (다) 번호 1 · 2 로 help-places 를 열고 [시작] · 결정 A · 저장(+ 곁 키 셋) → #기록지움,n=1 로 엶 → 다시 실린 문서의 첫 순간(새 문서 스크립트) help-places 키 [] ·
//      해시 #n=1 · ?r= · 시작 카드가 첫날부터(지난 시도 0) · rpg.village.guest 그대로 · 번호 곁 키 지움 · ?sid= 꼴 곁 키 그대로 · 토스트 '…(번호 2개)' /
//      양성 대조: 처음 연 문서의 첫 순간엔 help-places 키가 있었다(같은 새 문서 스크립트가 본 값)
//      (다-2) 열린 판에서 해시만 바꿈(hashchange) → 같은 몸(지우고 다시 실림 · 해시 #n=2)
// (라) 3시간: 시각 키를 −1시간으로 써 두고 다시 열면 이어짐(적용 A · 시작함 · 카드 안 뜸) / −4시간이면 시작판(적용 0 · 시작 카드 첫날부터 · 지움 1) — 서로 양성 대조.
//      시각 키는 마을 밖 쪽(rules.json)에서 쓴다 — 마을이 닫힐 때 저장(pagehide)이 시각 키를 지금으로 덮기 때문.
// (마) ↺ 처음부터가 붙이는 해시 = 남는 낱말만(c0hKeep): (A) #fresh(번호 없음 · 빈 판) → [시작] → ↺ → #fresh 가 빠져 시작 저장본부터(빈 판에서 나오는 길 · ACT-STAGERESET) /
//      (B) #n=c3-07,끝,소리=끔 → 끝 카드 [닫기] → ↺ → 다시 실린 판은 시작 카드 · 해시 #n=c3-07,소리=끔(끝만 빠짐) — 양성 대조: 열 때 #fresh = 빈 판 · #끝 = 끝 카드
// (바) 망 늦춤(ctx.netDelay 3000 — 다시 실리는 문서만 3초 늦게 · 학교망 흉내): 번호 2 로 몇 수 → 끝 카드 사진을 찍고(사진 글은 쉬는 때 콜백) 곧바로 해시만 바꿈(#기록지움,n=2) →
//      그 콜백이 지운 뒤에 떠나는 판에서 판 카드 기록을 쓰려 해도 막힘(앞 문서 pagehide 값: 막음 ≥ 1 · help-places 키 0 · 3초 가까이 살아 있었음) → 다시 실린 첫 순간 키 []
// 판 쪽은 늘 바깥 시도 0(틀이 바깥 주소를 막고 적음 · 운영 DB 0) · 임시 프로필 · 창 0.
export default async function c0t(ctx) {
  const C = ctx.C, E = (s, ms) => ctx.evaluate(s, ms), P = e => ctx.probe(e), J = JSON.stringify, X = ctx.expect, out = {};
  const RULES = ctx.BASE + '/village/stages/rules.json';
  const url = (stage, hash) => ctx.BASE + '/village/index.html?' + (stage ? 'stage=' + stage + '&' : '') + 'sid=guest' + (hash ? '#' + hash : '');
  const ready = async what => { await C.until(`typeof window.__sim === 'function' && typeof window.__gfxMode === 'function' && window.__shots && typeof window.__c0t === 'function'`, 30000, what);
    await C.pump(1); await C.until('window.__LOADMS != null', 8000, what + ' — 첫 프레임'); await E(`window.__gfxMode('fixed'); return 1`); await C.pump(20); };
  const clean = async () => { await C.nav(RULES); await E('localStorage.clear(); sessionStorage.clear(); return 1'); };
  const go = async (stage, hash) => { await C.nav(RULES); await C.nav(url(stage, hash)); await ready((stage || '기본 마을') + (hash ? ' #' + hash : '')); };   /* 마을 밖을 거쳐 늘 새 문서로(같은 주소 + # 는 조각 이동) */
  const n0 = () => C.st.tries.length, since = i => C.st.tries.slice(i);
  const sync = i => since(i).filter(t => /\/village\/sync\.js(\?|$)/.test(t.url)), outside = i => since(i).filter(t => !t.ok);
  const state = () => P(`({ st: window.__stage(), c0: window.__c0t(), card: window.__stageCard(), 지난: !!window.__twoTry().지난, vote: window.__vote().적용, href: location.href, hash: location.hash,
    종류: (() => { const c = document.querySelector('#stageCard .card[data-vcard]'); return c ? c.dataset.vcard : null; })() })`);   /* 종류 = 떠 있는 판 카드(start · end) */
  const startCard = async () => { for (let k = 0; k < 40 && !(await P('!!document.getElementById("stageCard")')); k++) await ctx.advance(150);
    return E(`const p = document.querySelector('#stageCard .pred .po button'); if (p) p.click(); const g = [...document.querySelectorAll('#stageCard button')].find(b => b.textContent.trim() === '시작'); if (!g || g.disabled) return false; g.click(); return true`); };
  const play = async () => { const s = await startCard(); await P('window.__voteApply("A")'); await P('window.__save()'); await C.pump(10); return s; };   /* 몇 수 = [시작] · 결정 A 적용(의원) · 저장 */
  const mark = () => E(`window.__c0tMark = 'm' + Math.random(); return { m: window.__c0tMark, o: performance.timeOrigin }`);
  /* 다시 실렸나 — 앞 문서에 심은 표지가 사라지고 timeOrigin 이 바뀐 새 문서 · 주소에 ?r= (기다리는 동안 앞 문서의 프레임도 흘린다 — ↺ 는 첫날 틀 사진을 기다린다) */
  const reloaded = async (m, what) => { const t0 = Date.now();
    while (Date.now() - t0 < 25000) { let yes = false;
      try { yes = await E(`return window.__c0tMark !== ${J(m ? m.m : null)} && ${m ? 'performance.timeOrigin !== ' + m.o : 'true'} && /[?&]r=\\d+/.test(location.search) && typeof window.__c0t === 'function'`); } catch (e) {}
      if (yes) { await ready(what); return true; } try { await C.pump(6); } catch (e) {} await ctx.sleep(100); }
    return false; };
  const SNAP = `(() => { try { if (!/\\/village\\/index\\.html$/.test(location.pathname)) return; const a = JSON.parse(sessionStorage.getItem('__c0tSeen') || '[]');
      a.push({ href: location.href, keys: Object.keys(localStorage).filter(k => /help-places/.test(k)).sort(), 표지: sessionStorage.getItem('rpg.c0t.wiped.help-places') }); sessionStorage.setItem('__c0tSeen', JSON.stringify(a));
      window.__c0tToasts = []; document.addEventListener('DOMContentLoaded', () => { const t = document.getElementById('toast'); if (t) new MutationObserver(() => { if (t.textContent) window.__c0tToasts.push(t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true }); });
    } catch (e) {} })();`;   /* 새 문서마다 맨 먼저 — 마을 module 이 아무것도 쓰기 전의 키 · 토스트 글을 모두 적음 */
  const seen = () => E(`return JSON.parse(sessionStorage.getItem('__c0tSeen') || '[]')`);
  const toasts = async ms => { await ctx.advance(ms); return P('window.__c0tToasts || []'); };
  const MSG = n => '🧽 이 기기에서 이 판의 기록을 모두 지웠어요(번호 ' + n + '개)';
  const t00 = n0(); let snapId = null;
  try {
    /* (가) 판에서 sync.js 0 · 기본 마을 1 */
    await clean(); let i0 = n0(); await go('help-places', 'n=1');
    const a = await state(), aS = sync(i0), aO = outside(i0), aH = since(i0).filter(t => t.url.includes('#') || /[?&]n=/.test(t.url));
    const aV = await P(`({ 값: window.VillageSync === null ? null : typeof window.VillageSync, 태그: [...document.scripts].filter(x => /sync\\.js/.test(x.getAttribute('src') || '')).length })`);   /* 판은 엔진이 null 로 둔다(이중 안전) — 실리지 않은 증거는 요청 0 · 태그 0 */
    out.가 = { 저장키: a.st.저장키, 번호: a.c0.번호, sync: aS.length, 바깥: aO.map(t => t.url), VillageSync: aV, 원격: a.st.원격, 요청: since(i0).length };
    X(aS.length === 0, '(가) 판 ?stage=help-places#n=1 — 요청 목록에 sync.js 0 ' + J(aS.map(t => t.url)));
    X(aO.length === 0, '(가) 판 바깥 시도 0 ' + J(aO.map(t => t.url)));
    X(aV.값 === null && aV.태그 === 0 && a.st.원격 === false && a.st.저장키 === 'rpg.village.1.help-places' && a.c0.번호 === '1', '(가) 판 = sync 태그 0 · VillageSync null · 원격 꺼짐 · 번호 1 칸 ' + J(out.가));
    X(since(i0).length > 3 && !aH.length, '(가) 요청 주소에 # · n= 0(해시는 서버로 안 감) ' + J(aH.map(t => t.url)));
    i0 = n0(); await clean(); await go(null, null);
    const bS = sync(i0), bV = await P(`(() => { const s = [...document.scripts], i = s.findIndex(x => /sync\\.js/.test(x.getAttribute('src') || '')), j = s.findIndex(x => x.type === 'module');
      return { 꼴: typeof window.VillageSync, 부팅: !!(window.VillageSync && window.VillageSync.current), 앞: i >= 0 && j >= 0 && i < j, src: i >= 0 ? s[i].getAttribute('src') : null, 저장키: window.__stage().저장키, 원격: window.__stage().원격 }; })()`);
    out.가.기본 = { sync: bS.length, ...bV, 바깥: outside(i0).map(t => t.url) };
    X(bS.length === 1 && bV.꼴 === 'object' && bV.부팅 && bV.원격 && bV.앞 && bV.src === './sync.js?v=20260920-hidden' && bV.저장키 === 'rpg.village.guest',
      '(가) 양성 대조 — 기본 마을 sync.js 1건 · VillageSync 부팅 · module 앞 · 캐시버스터 그대로 ' + J(out.가.기본));

    /* (나) ↺ 처음부터 → 진짜로 다시 실림 · #n= 지킴 */
    await clean(); await go('help-places', 'n=c3-07');
    const g1 = await play(), b0 = await state(); out.나 = { 시작: g1, 전: { 적용: b0.vote, 저장키: b0.st.저장키, 시작함: b0.card.시작함 } };
    X(g1 && b0.vote === 'A' && b0.card.시작함 && b0.st.저장키 === 'rpg.village.c3-07.help-places', '(나) [시작] · 결정 A 적용 — 바꾼 마을 ' + J(out.나.전));
    const m1 = await mark(); i0 = n0();
    const r1 = await E(`const b = document.getElementById('stageReset'); if (!b) return '↺ 단추 없음'; b.click(); const k = document.querySelector('#askCard .ok'); if (!k) return '되묻기 없음'; k.click(); return 'ok'`);
    const re1 = await reloaded(m1, '(나) ↺ 뒤 다시 실림'), b1 = await state();
    out.나.뒤 = { 누름: r1, 다시실림: re1, 주소: b1.href.replace(ctx.BASE, ''), 해시: b1.hash, 저장키: b1.st.저장키, 시작판: b1.st.시작판, 적용: b1.vote, 지난: b1.지난 };
    X(r1 === 'ok' && re1, '(나) ↺ 처음부터 → 되묻기 [↺] → 다시 실림(앞 문서 표지 사라짐 · timeOrigin 바뀜 · ?r=) ' + J(out.나.뒤));
    X(b1.hash === '#n=c3-07' && /[?&]r=\d+/.test(b1.href) && b1.st.저장키 === 'rpg.village.c3-07.help-places', '(나) 해시 #n=c3-07 · 저장 키 c3-07 ' + J(out.나.뒤));
    X(b1.st.시작판 === true && b1.vote === null && b1.지난, '(나) 시작 저장본부터(적용 0) · 판 카드는 지난 시도로 남음 ' + J(out.나.뒤));
    X(outside(i0).length === 0, '(나) 바깥 시도 0 ' + J(outside(i0).map(t => t.url)));
    await ctx.shot('나_다시실림');

    /* (다) #기록지움,n=1 로 엶 → 이 판 번호 전부 · 다시 실린 첫 순간 키 [] */
    await clean(); await go(null, null); await P('window.__save()'); const guest0 = await P(`localStorage.getItem('rpg.village.guest')`);
    for (const n of ['1', '2']) { await go('help-places', 'n=' + n); out['다_' + n] = await play(); }
    await C.nav(RULES);
    await E(`localStorage.setItem('rpg.album.1', '[]'); localStorage.setItem('rpg.guide.2', '1'); localStorage.setItem('rpg.album.stu1', '[]'); sessionStorage.removeItem('__c0tSeen'); return 1`);   /* 곁 키 — 번호 1 · 2 는 지우고 ?sid= 꼴(stu1)은 둔다 */
    const pre = await E(`return Object.keys(localStorage).filter(k => /help-places/.test(k)).sort()`);
    snapId = (await C.send('Page.addScriptToEvaluateOnNewDocument', { source: SNAP })).identifier;
    i0 = n0(); await C.nav(url('help-places', '기록지움,n=1'));
    const re2 = await reloaded(null, '(다) #기록지움 뒤 다시 실림'), tz2 = await toasts(1600), sn2 = await seen();
    const c1 = await P(`({ st: window.__stage(), c0: window.__c0t(), card: window.__stageCard(), 지난: !!window.__twoTry().지난, href: location.href, hash: location.hash, guest: localStorage.getItem('rpg.village.guest'),
      종류: (() => { const c = document.querySelector('#stageCard .card[data-vcard]'); return c ? c.dataset.vcard : null; })(),
      곁: Object.fromEntries(['rpg.album.1', 'rpg.guide.2', 'rpg.album.stu1'].map(k => [k, localStorage.getItem(k) != null])), 지금: Object.keys(localStorage).filter(k => /help-places/.test(k)).sort() })`);
    const first = sn2[0], last = sn2[sn2.length - 1];
    out.다 = { 전키: pre, 첫문서: first, 다시실린첫순간: last, 문서수: sn2.length, 다시실림: re2, 해시: c1.hash, 주소: c1.href.replace(ctx.BASE, ''), 저장키: c1.st.저장키, 시작판: c1.st.시작판,
      카드: { 떠있음: c1.card.떠있음, 종류: c1.종류, 시작함: c1.card.시작함, 지난: c1.지난 }, 다시실린뒤: c1.c0.다시실린뒤, 곁: c1.곁, guest그대로: c1.guest === guest0, 지금: c1.지금, 토스트: tz2 };
    X(pre.includes('rpg.village.1.help-places') && pre.includes('rpg.village.2.help-places') && first && first.keys.includes('rpg.village.2.help-places') && first.keys.includes('rpg.stagetime.1.help-places'),
      '(다) 양성 대조 — 지우기 전 · 처음 연 문서의 첫 순간엔 번호 1 · 2 의 help-places 키가 있음 ' + J({ pre, first }));
    X(re2 && sn2.length >= 2 && last && J(last.keys) === '[]' && last.표지 === '2', '(다) 다시 실린 문서의 첫 순간 help-places 키 [] · 표지 2 ' + J(last));
    X(c1.hash === '#n=1' && /[?&]r=\d+/.test(c1.href) && c1.st.저장키 === 'rpg.village.1.help-places' && c1.st.시작판 === true, '(다) 해시 #n=1 · ?r= · 번호 1 칸 시작 저장본부터 ' + J({ 해시: c1.hash, 주소: out.다.주소, 시작판: c1.st.시작판 }));
    X(c1.card.떠있음 && c1.종류 === 'start' && !c1.card.시작함 && !c1.지난, '(다) 시작 카드가 첫날부터(시작 안 함 · 지난 시도 0) ' + J(out.다.카드));
    X(c1.guest === guest0 && guest0 != null && !c1.곁['rpg.album.1'] && !c1.곁['rpg.guide.2'] && c1.곁['rpg.album.stu1'], '(다) rpg.village.guest 그대로 · 번호 곁 키 지움 · ?sid= 꼴 곁 키 그대로 ' + J({ guest: c1.guest === guest0, 곁: c1.곁 }));
    X(!c1.지금.some(k => /\.2\.help-places/.test(k)) && c1.지금.every(k => /^rpg\.(village|stagetime|stagecard)\.1\.help-places$/.test(k)), '(다) 다시 실린 뒤 키 = 번호 1 의 새 것만(번호 2 키 0) ' + J(c1.지금));
    X(tz2.includes(MSG(2)) && c1.c0.다시실린뒤 === 2, '(다) 토스트 ' + MSG(2) + ' ' + J(tz2));
    X(outside(i0).length === 0, '(다) 바깥 시도 0 ' + J(outside(i0).map(t => t.url)));
    await ctx.shot('다_기록지움_다시실림');

    /* (다-2) 열린 판에서 해시만 바꿈(hashchange) → 같은 몸 */
    await go('help-places', 'n=2'); out.다2_시작 = await play();
    await E(`sessionStorage.removeItem('__c0tSeen'); return 1`); const m3 = await mark(); i0 = n0();
    await E(`location.hash = '기록지움,n=2'; return 1`);
    const re3 = await reloaded(m3, '(다-2) hashchange 뒤 다시 실림'), tz3 = await toasts(1600), sn3 = await seen(), c3 = await state();
    out.다2 = { 다시실림: re3, 해시: c3.hash, 저장키: c3.st.저장키, 시작판: c3.st.시작판, 첫순간: sn3[sn3.length - 1], 토스트: tz3 };
    X(re3 && c3.hash === '#n=2' && c3.st.저장키 === 'rpg.village.2.help-places' && c3.st.시작판 === true && sn3.length && J(sn3[sn3.length - 1].keys) === '[]' && tz3.includes(MSG(2)),
      '(다-2) 해시만 바꿔도(hashchange) 같은 몸 — 다시 실림 · #n=2 · 첫 순간 키 [] · 토스트(번호 1 · 2) ' + J(out.다2));
    /* 새 문서 스크립트 양성 대조 하나 더 — 키가 있는 판을 그냥 다시 열면 첫 순간에 그 키가 보인다 */
    await E(`sessionStorage.removeItem('__c0tSeen'); return 1`); await go('help-places', 'n=2'); const sn4 = await seen();
    X(sn4.length && sn4[sn4.length - 1].keys.includes('rpg.village.2.help-places'), '(다) 양성 대조 — 새 문서 스크립트는 있는 키를 본다 ' + J(sn4[sn4.length - 1]));
    await C.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: snapId }).catch(() => {}); snapId = null;

    /* (라) 3시간 — −1시간 이어짐 · −4시간 시작판 */
    await clean(); await go('help-places', 'n=c3-07'); const g4 = await play();
    const age = async h => { await C.nav(RULES); await E(`localStorage.setItem('rpg.stagetime.c3-07.help-places', String(Date.now() - ${h} * 3600e3)); return 1`);
      await C.nav(url('help-places', 'n=c3-07')); await ready('(라) 시각 키 −' + h + '시간'); await ctx.advance(1500); return state(); };
    i0 = n0(); const l1 = await age(1), l4 = await age(4);
    const pick = s => ({ 지움: s.c0.지움, 시작판: s.st.시작판, 적용: s.vote, 시작함: s.card.시작함, 카드: s.종류, 지난: s.지난, 시각키: s.c0.시각키 });
    out.라 = { 시작: g4, 한시간: pick(l1), 네시간: pick(l4) };
    X(g4 && l1.c0.지움 === 0 && l1.st.시작판 === false && l1.vote === 'A' && l1.card.시작함 && l1.종류 !== 'start', '(라) −1시간 → 이어짐(적용 A · 시작함 · 시작 카드 안 뜸 — 목표를 이뤄 끝 카드는 뜰 수 있음) ' + J(out.라.한시간));
    X(l4.c0.지움 === 1 && l4.st.시작판 === true && l4.vote === null && !l4.card.시작함 && l4.종류 === 'start' && !l4.지난 && Number(l4.c0.시각키) > Date.now() - 600000,
      '(라) −4시간 → 시작판(적용 0 · 시작 카드 첫날부터 · 지난 시도 0) · 시각 키는 지금 ' + J(out.라.네시간));
    X(outside(i0).length === 0, '(라) 바깥 시도 0 ' + J(outside(i0).map(t => t.url)));

    /* (마) ↺ 처음부터가 붙이는 해시 = 남는 낱말만 */
    const waitCard = async () => { for (let k = 0; k < 40 && !(await P('!!document.querySelector("#stageCard .card[data-vcard]")')); k++) await ctx.advance(150); return P('(() => { const c = document.querySelector("#stageCard .card[data-vcard]"); return c ? c.dataset.vcard : null; })()'); };
    const resetGo = async what => { const m = await mark();
      const r = await E(`const b = document.getElementById('stageReset'); if (!b) return '↺ 단추 없음'; b.click(); const k = document.querySelector('#askCard .ok'); if (!k) return '되묻기 없음'; k.click(); return 'ok'`);
      return { 누름: r, 다시실림: await reloaded(m, what) }; };
    const land = () => P(`({ 시작판: window.__stage().시작판, 물건: window.__snapshot().물건.length, 저장키: window.__stage().저장키, 해시: location.hash, 주소: location.pathname + location.search })`);
    await clean(); i0 = n0(); await go('help-places', 'fresh'); const fa0 = await land(), faS = await startCard(), faR = await resetGo('(마) A ↺ 뒤 다시 실림'), fa1 = await land();
    out.마A = { 전: fa0, 시작: faS, ...faR, 뒤: { ...fa1, 주소: fa1.주소.replace(/r=\d+/, 'r=…') } };
    X(fa0.해시 === '#fresh' && fa0.시작판 === false && fa0.저장키 === 'rpg.village.guest.help-places', '(마) A 양성 대조 — #fresh 로 열면 시작 저장본이 안 깔림(빈 판) ' + J(fa0));
    X(faS && faR.누름 === 'ok' && faR.다시실림 && fa1.해시 === '' && fa1.시작판 === true && fa1.물건 > fa0.물건, '(마) A ↺ → #fresh 빠짐 · 시작 저장본부터(물건 ' + fa0.물건 + ' → ' + fa1.물건 + ') ' + J(out.마A.뒤));
    await clean(); await go('help-places', 'n=c3-07,끝,소리=끔'); const fb0 = { 카드: await waitCard(), ...(await land()) };
    const fbC = await E(`const b = [...document.querySelectorAll('#stageCard button')].find(b => b.textContent.trim() === '닫기'); if (!b) return false; b.click(); return true`);
    const fbR = await resetGo('(마) B ↺ 뒤 다시 실림'), fb1 = { 카드: await waitCard(), ...(await land()) };
    out.마B = { 전: { 카드: fb0.카드, 해시: decodeURIComponent(fb0.해시), 저장키: fb0.저장키 }, 닫음: fbC, ...fbR, 뒤: { 카드: fb1.카드, 해시: decodeURIComponent(fb1.해시), 저장키: fb1.저장키, 시작판: fb1.시작판 } };
    X(fb0.카드 === 'end' && fb0.저장키 === 'rpg.village.c3-07.help-places', '(마) B 양성 대조 — #n=c3-07,끝,소리=끔 으로 열면 끝 카드 · 번호 c3-07 칸 ' + J(out.마B.전));
    X(fbC && fbR.누름 === 'ok' && fbR.다시실림 && out.마B.뒤.해시 === '#n=c3-07,소리=끔' && fb1.카드 === 'start' && fb1.저장키 === 'rpg.village.c3-07.help-places' && fb1.시작판 === true,
      '(마) B ↺ → 끝 만 빠짐(n · 소리 남음) · 다시 실린 판은 시작 카드 · 시작 저장본부터 ' + J(out.마B.뒤));
    X(outside(i0).length === 0, '(마) 바깥 시도 0 ' + J(outside(i0).map(t => t.url)));

    /* (바) 망 늦춤 — 다시 실리는 문서만 3초 늦게(ctx.netDelay) · 앞 문서가 살아 있는 동안 판 카드 기록을 쓰지 않는다.
       다시 싣기가 걸려 있는 동안 CDP 는 앞 문서에 닿지 않는다(잰 것: 해시를 바꾼 뒤 첫 evaluate 가 3초 뒤 새 문서에서 돎) — 그래서 한 evaluate 안에서 끝 카드 → 두 장(사진 → 쉬는 때 콜백이 사진 글을 넘기려 기다림) → 해시를 바꾸고,
       앞 문서 값은 그 문서의 pagehide 가 sessionStorage 에 적어 둔 것을 새 문서에서 읽는다. 쉬는 때 콜백은 hashchange(c0tClear) 다음에 돈다 → 떠나는 판의 scardSave */
    await clean(); i0 = n0(); await go('help-places', 'n=2'); out.바_시작 = await play();
    await E(`sessionStorage.removeItem('__c0tSeen'); sessionStorage.removeItem('__c0tOld'); return 1`); snapId = (await C.send('Page.addScriptToEvaluateOnNewDocument', { source: SNAP })).identifier;
    const m6 = await mark(); ctx.netDelay(3000, '/village/index.html'); const t6 = Date.now();
    const pre6 = await E(`addEventListener('pagehide', () => { try { const c = window.__c0t(); sessionStorage.setItem('__c0tOld', JSON.stringify({ 떠남: c.떠남, 막음: c.stats.떠남막음, 키: Object.keys(localStorage).filter(k => /help-places/.test(k)), t: Date.now() })); } catch (e) {} });
      const s0 = window.__stageCard().찍음; window.__stageEnd(); const card = !!document.querySelector('#stageCard .card[data-vcard="end"]'); window.__shots.step(2, 1000 / 60);
      const s1 = window.__stageCard().찍음; location.hash = '기록지움,n=2'; return { 끝카드: card, 찍음: [s0, s1], t: Date.now() }`);
    const re6 = await reloaded(m6, '(바) 망 늦춤 · #기록지움 뒤 다시 실림'), dt6 = Date.now() - t6; ctx.netDelay(0);
    const old6 = await E(`return JSON.parse(sessionStorage.getItem('__c0tOld') || 'null')`), sn6 = await seen(), c6 = await state();
    out.바 = { 앞: pre6, 앞문서: old6 && { ...old6, 산ms: old6.t - pre6.t }, 다시실림: re6, 걸림ms: dt6, 첫순간: sn6[sn6.length - 1], 해시: c6.hash, 시작판: c6.st.시작판 };
    X(pre6.끝카드 && pre6.찍음[1] > pre6.찍음[0], '(바) 양성 대조 — 해시를 바꾸기 전 끝 카드 사진을 찍었다(사진 글은 쉬는 때 콜백 — 아직 안 넘김) ' + J(pre6));
    X(old6 && old6.떠남 === true && old6.막음 >= 1 && !old6.키.length && old6.t - pre6.t >= 2900,
      '(바) 앞 문서가 3초 가까이 살아 있는 동안 판 카드 기록을 쓰려 했고(막음 ≥ 1) 막혔다(닫힐 때 help-places 키 0) ' + J(out.바.앞문서));
    X(re6 && dt6 >= 2900 && c6.hash === '#n=2' && c6.st.시작판 === true && sn6.length && J(sn6[sn6.length - 1].keys) === '[]',
      '(바) 늦춤이 먹고(' + dt6 + 'ms ≥ 3초) 다시 실린 첫 순간 help-places 키 [] · #n=2 · 시작판 ' + J({ 첫순간: out.바.첫순간, 해시: c6.hash }));
    X(outside(i0).length === 0, '(바) 바깥 시도 0 ' + J(outside(i0).map(t => t.url)));
  } finally { ctx.netDelay(0); if (snapId) await C.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: snapId }).catch(() => {}); }
  out.바깥시도 = outside(t00).map(t => t.url); out.요청 = since(t00).length;
  return out;
}
