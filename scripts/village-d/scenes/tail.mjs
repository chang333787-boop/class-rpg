// 장면 tail — [MAC-HINTCUT] PA-08 권유 꼬리 숨김 · 첫 화면 · 연결 글 · 이름 제안을 진짜 크롬(가짜 시계)에서: node scripts/village-d/dcheck.mjs --scene tail
// 무화면은 타이머가 없어(setTimeout(pmapBar, 900) · 일자리 소식 800ms) 첫 화면 · 모형 · 소식을 못 본다 — 판정 쪽 글은 test.mjs TAIL · stages.mjs 권유 줄.
// ① 탐정 판 둘(empty-shop-ga · -na — 판 칸 첫화면 "마을" · 연결글 false): 판 카드를 닫은 뒤 body.pmap 아님 · __protoMap().켜짐 false · 트레이 카드 보임 · 켜진 동네 단추 0 ·
//    화면 가운데 칸 = 시작칸(카메라를 되살림 — '밭 마을' 단추를 누르면 가운데가 밭 마을로 가는 것이 대조) · '🗺️ 고장 전체' 누름 → 모형 · #pmapCard .pm-l '↔' ·
//    화면 글에 '길이 끊겼어요' · '오는 밭이 없어요' 0 · 사진 / 양성 대조: 임시 판(같은 판 + 판 규칙 hintCut { first: false, link: false }) → 첫 화면 모형 · .pm-l 옛 글
// ② two-villages(첫화면만): 첫 화면 마을 · 모형으로 가면 .pm-l 연결 글 그대로(↔ 아님)
// ③ help-places [시작] 뒤 45초(advance): 토스트 기록 · #toast 에 '어울리는 이름' 0 / 양성 대조: 임시 판(판 규칙 hintCut { title: false }) → 75초 안에 '💡 우리 마을에 어울리는 이름이 생겼어요 — 눌러 봐요'
// ④ zz-tail-selftest(시작 pop88 + 트레이 ["road"] + 카드) [시작] 뒤 10초(advance — 다 안 보이면 20초까지): '💼 마을이 커져서 어른들 일할 곳이 모자라요'(꼬리 없음) ·
//    양성 대조: 임시 판(판 규칙 hintCut { toast: false }) → '…더 지어 봐요' 그대로
// 임시 판(zz-*)은 장면 안에서 쓰고 끝에 지운다(try/finally · 커밋 안 함). 판 쪽 페이지는 바깥 시도 0 을 함께 본다.
import fs from 'node:fs'; import path from 'node:path';
const OBS = `(() => { const d = window.__dTail = { 보임: [] }; const on = () => { const t = document.getElementById('toast'); if (!t) { setTimeout(on, 50); return; }
  new MutationObserver(() => { const s = t.textContent; if (s && d.보임[d.보임.length - 1] !== s) d.보임.push(s); }).observe(t, { childList: true, characterData: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', on); else on(); })();`;
const NUDGE = '💡 우리 마을에 어울리는 이름이 생겼어요 — 눌러 봐요', JOBS = '💼 마을이 커져서 어른들 일할 곳이 모자라요', JOBS_OLD = JOBS + ' — 가게·온실·풍차를 더 지어 봐요';
export default async function tail(ctx) {
  const C = ctx.C, E = (s, ms) => ctx.evaluate(s, ms), P = e => ctx.probe(e), J = JSON.stringify, out = {};
  const url = stage => ctx.BASE + '/village/index.html?stage=' + stage + '&sid=guest';
  const DIR = path.join(ctx.ROOT, 'village/stages'), base = n => JSON.parse(fs.readFileSync(path.join(DIR, n + '.json'), 'utf8')), made = [];
  const put = (id, o) => { fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify({ ...o, id }, null, 1)); made.push(path.join(DIR, id + '.json')); };
  const outside = () => C.st.tries.filter(t => !t.ok).length;
  await ctx.send('Page.addScriptToEvaluateOnNewDocument', { source: OBS });
  const fresh = async stage => { await C.nav(ctx.BASE + '/village/stages/rules.json'); await E('localStorage.clear(); sessionStorage.clear(); return 1'); await C.nav(url(stage));
    await C.until(`typeof window.__sim === 'function' && typeof window.__hintCut === 'function' && window.__shots && typeof window.__gfxMode === 'function'`, 40000, stage + ' 불러오기');
    await E(`window.__gfxMode('fixed'); return 1`); };
  /* 판 카드 · 첫 안내를 진짜 시간 1.5초 조용할 때까지 닫는다(짐작 상자는 보기 하나를 고른 뒤 [시작]) — k7 장면 꼴 */
  const closeCards = () => E(`const sl = ms => new Promise(r => setTimeout(r, ms)); let quiet = 0, n = [];
    for (let k = 0; k < 60 && quiet < 6; k++) { const p = document.querySelector('#stageCard .pred .po button'); if (p) p.click();
      const bs = [...document.querySelectorAll('button')].filter(b => ['시작', '건너뛰기', '닫기'].includes(b.textContent.trim()) && b.offsetParent && !b.disabled);
      bs.forEach(b => { n.push(b.textContent.trim()); b.click(); }); const g = document.getElementById('guide'); quiet = bs.length || (g && g.className.includes('show')) ? 0 : quiet + 1; await sl(250); } return n`, 60000);
  const has = id => P(`!!document.getElementById(${J(id)})`);
  const waitBar = async () => { for (let k = 0; k < 40 && !(await has('pmapBar')); k++) await ctx.advance(250); return has('pmapBar'); };
  const look = () => P(`(() => { const c = window.__screenCell(Math.round(innerWidth / 2), Math.round(innerHeight / 2)), pm = window.__protoMap(), bar = [...document.querySelectorAll('#pmapBar button')];
    return { 모형몸: document.body.classList.contains('pmap'), 켜짐: pm.켜짐, 트레이카드: [...document.querySelectorAll('#trayIn .card[data-kind]')].filter(e => e.offsetParent).length,
      켠단추: bar.filter(b => b.classList.contains('on')).map(b => b.textContent.trim()), 덧단추: [...document.querySelectorAll('#pmapExtra button')].map(b => b.textContent.trim()),
      가운데: c, 시작칸: window.__startCell().칸, 연결: [...document.querySelectorAll('#pmapCard .pm-l')].map(e => e.textContent), hc: (({ 기록, ...r }) => r)(window.__hintCut()) }; })()`);
  const press = t => E(`const b = [...document.querySelectorAll('#pmapBar button')].find(x => x.textContent.trim() === ${J(t)}); if (!b) return false; b.click(); return true`);
  const near = (a, b, d) => !!(a && b && Math.abs(a[0] - b[0]) <= d && Math.abs(a[1] - b[1]) <= d);
  const bodyHas = s => P(`document.body.innerText.includes(${J(s)})`);
  const toasts = () => P(`({ 보임: (window.__dTail || { 보임: [] }).보임.slice(), 기록: window.__hintCut().기록, 지금: (document.getElementById('toast') || {}).textContent || '' })`);
  try {
    { const ga = base('empty-shop-ga'), na = base('empty-shop-na'), hp = base('help-places'), 끔 = { first: false, link: false };
      put('zz-dtail-ga0', { ...ga, 규칙: { ...(ga.규칙 || {}), hintCut: 끔 } }); put('zz-dtail-na0', { ...na, 규칙: { ...(na.규칙 || {}), hintCut: 끔 } });
      put('zz-dtail-hp0', { ...hp, 규칙: { ...(hp.규칙 || {}), hintCut: { title: false } } });
      const 시험판 = { 이름: '시험 판 — 권유 꼬리', 교과: null, 카드: true, 질문: '시험 판', 시작: 'stages/boards/pop88.json', 트레이: ['road'], 첫안내: false };
      put('zz-tail-selftest', 시험판); put('zz-dtail-toast0', { ...시험판, 규칙: { hintCut: { toast: false } } }); }
    /* ── ① 탐정 판 둘 · 양성 대조 ── */
    for (const [st, 옛] of [['empty-shop-ga', '✂️ 길이 끊겼어요'], ['empty-shop-na', '❌ 오는 밭이 없어요']]) {
      const o0 = outside(); await fresh(st); const 누름 = await closeCards(), 단추줄 = await waitBar(); await ctx.pump(30);
      const a = await look(); await ctx.shot('①' + st + '_첫화면');
      ctx.expect(누름.includes('시작') && 단추줄 && !a.모형몸 && !a.켜짐 && a.트레이카드 >= 1 && !a.켠단추.length && !a.덧단추.length && a.hc.첫마을 === 1,
        `① ${st} 판 카드 닫은 뒤 첫 화면 마을 — body.pmap 아님 · 트레이 카드 ${a.트레이카드} · 켜진 동네 단추 0 · 단추 줄 0 ` + J({ 누름, 모형몸: a.모형몸, 켠단추: a.켠단추, 덧단추: a.덧단추, 첫마을: a.hc.첫마을 }));
      ctx.expect(near(a.가운데, a.시작칸, 3), `① ${st} 화면 가운데 칸 = 시작칸(카메라 되살림) ` + J({ 가운데: a.가운데, 시작칸: a.시작칸 }));
      const 끊 = [await bodyHas('길이 끊겼어요'), await bodyHas('오는 밭이 없어요')];
      await press('🗺️ 고장 전체'); await ctx.pump(20); const b = await look(); await ctx.shot('①' + st + '_모형');
      const 끊2 = [await bodyHas('길이 끊겼어요'), await bodyHas('오는 밭이 없어요')];
      ctx.expect(b.모형몸 && b.켜짐 && J(b.연결) === J(['↔']) && b.hc.연결숨김 >= 1 && !끊.some(Boolean) && !끊2.some(Boolean),
        `① ${st} '🗺️ 고장 전체' → 모형 · 연결 글 '↔' · 화면 글 '길이 끊겼어요' · '오는 밭이 없어요' 0 ` + J({ 연결: b.연결, 연결숨김: b.hc.연결숨김, 첫: 끊, 모형: 끊2 }));
      await press('밭 마을'); await ctx.pump(10); const c = await look();
      ctx.expect(!c.모형몸 && near(c.가운데, [155, 138], 3) && !near(c.가운데, a.시작칸, 6), `① 대조 — ${st} '밭 마을' 단추를 누르면 가운데가 밭 마을(가운데 칸 잣대가 카메라를 본다) ` + J({ 가운데: c.가운데 }));
      ctx.expect(outside() === o0, st + ' 바깥 시도 0');
      out['①' + st] = { 첫: a, 모형: b.연결, 밭마을: c.가운데 };
      /* 양성 대조 — 판 규칙 hintCut { first: false, link: false } */
      const id0 = st === 'empty-shop-ga' ? 'zz-dtail-ga0' : 'zz-dtail-na0'; await fresh(id0); await closeCards(); await waitBar(); await ctx.pump(20); const d = await look();
      ctx.expect(d.모형몸 && d.켜짐 && J(d.연결) === J([옛]) && d.hc.첫마을 === 0 && !d.hc.연결숨김, `① 양성 대조 — ${st} 판 규칙 hintCut 첫화면 · 연결글 끔 → 첫 화면 모형 · 옛 연결 글 ` + J({ 모형몸: d.모형몸, 연결: d.연결 }));
      out['①' + id0] = d.연결; }
    /* ── ② two-villages ── */
    { const o0 = outside(); await fresh('two-villages'); await closeCards(); await waitBar(); await ctx.pump(30); const a = await look(); await ctx.shot('②two-villages_첫화면');
      await press('🗺️ 고장 전체'); await ctx.pump(20); const b = await look(); await ctx.shot('②two-villages_모형');
      ctx.expect(!a.모형몸 && !a.켜짐 && a.트레이카드 >= 1 && near(a.가운데, a.시작칸, 3) && a.hc.첫마을 === 1, '② two-villages 첫 화면 마을 · 트레이 · 시작칸 ' + J({ 모형몸: a.모형몸, 가운데: a.가운데, 시작칸: a.시작칸 }));
      ctx.expect(b.모형몸 && b.연결.length === 1 && b.연결[0] !== '↔' && /^(❌|✂️|🚚|⏸|📦|⏳)/.test(b.연결[0]) && !b.hc.연결숨김, '② two-villages 모형 연결 글 그대로(연결글 칸 없음) ' + J(b.연결));
      ctx.expect(outside() === o0, 'two-villages 바깥 시도 0'); out['②'] = { 첫: a.가운데, 연결: b.연결 }; }
    /* ── ③ 이름 제안 — help-places 45초 · 양성 대조 ── */
    { const o0 = outside(); await fresh('help-places'); const 누름 = await closeCards(); const t0 = Date.now(); await ctx.advance(45000); const s = await toasts(), hc = await P('window.__hintCut()');
      const 이름 = [...s.보임, ...s.기록.map(x => x.원문)].filter(t => /어울리는 이름/.test(t));
      ctx.expect(누름.includes('시작') && !이름.length && hc.이름제안 === false && hc.이름막음 === 1, `③ help-places [시작] 뒤 ${((Date.now() - t0) / 1000).toFixed(0)}초 — 토스트 기록 · #toast 에 '어울리는 이름' 0 · 이름 제안 끔 ` + J({ 이름, 보임: s.보임.slice(-4) }));
      ctx.expect(outside() === o0, 'help-places 바깥 시도 0');
      await fresh('zz-dtail-hp0'); await closeCards(); let 본 = null, 초 = 0; while (초 < 75 && !본) { await ctx.advance(5000); 초 += 5; const q = await toasts(); 본 = q.보임.find(t => t === NUDGE) || null; }
      ctx.expect(본 === NUDGE, `③ 양성 대조 — 판 규칙 hintCut.title 끔 → ${초}초 안에 이름 제안 '${NUDGE}'`); out['③'] = { 이름: 이름.length, 대조초: 초 }; }
    /* ── ④ 일자리 소식 — zz-tail-selftest [시작] 뒤 10초 · 양성 대조 ── */
    for (const [st, want] of [['zz-tail-selftest', JOBS], ['zz-dtail-toast0', JOBS_OLD]]) {
      const o0 = outside(); await fresh(st); const 누름 = await closeCards(); let s = null, 초 = 0;
      while (초 < 20) { await ctx.advance(5000); 초 += 5; s = await toasts(); if (초 >= 10 && s.기록.some(x => x.원문 === JOBS_OLD)) break; }
      const 기 = s.기록.filter(x => x.원문 === JOBS_OLD), 보 = s.보임.filter(t => t.startsWith('💼 마을이 커져서'));
      ctx.expect(누름.includes('시작') && 기.length === 1 && 기[0].뒤 === want && 보.length >= 1 && 보.every(t => t === want),
        `④ ${st} [시작] 뒤 ${초}초 — 토스트 기록 · #toast '${want}'` + J({ 기록: 기, 보임: 보 }));
      ctx.expect(outside() === o0, st + ' 바깥 시도 0'); out['④' + st] = { 초, 보임: 보 }; }
  } finally { made.forEach(f => fs.rmSync(f, { force: true })); }
  return out;
}
