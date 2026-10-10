// [MATHGAP-HOME-1] 오늘의 수학 — 홈 '오늘' 칸 카드 + '배우고 만들기' 문 · 앱 = mathgap/ (전체화면 창 · openExternalEmbed('mathgap'))
//  선생님이 단원을 열었을 때만 카드가 뜬다. 읽기 둘(쓰기 없음):
//    classRPG_mathgap/config          { unit, name 단원 이름, minutes }      — 선생님 화면이 쓴다
//    classRPG_mathgap/kids/<sid>/card { unit, stage, lit, total, floors, next, nextName, nextNo, review, day, doneToday } — 앱이 문항마다 쓴다
//  누구나 쓸 수 있는 DB 라 글은 escHtml · 숫자 · 층 그림은 거른다. 보상과 묶지 않음(교사 결정 10-10).
//  앱의 'RPG로 돌아가기' = postMessage { type: 'rpg:embed-close', app: 'mathgap' } → 창 닫기.
let _mgCfg = null, _mgCard = null, _mgSid = null, _mgRefs = [];
const _mgKey = id => String(id == null ? '' : id).replace(/[^\w-]/g, '_').slice(0, 40) || '_';   // mathgap/js/store.js 와 같은 키
function watchMathgapHome() {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length || typeof CUR === 'undefined' || !CUR || !CUR.id) return;
    const sid = _mgKey(CUR.id);
    if (_mgSid === sid) return;
    _mgRefs.forEach(r => { try { r.off(); } catch (e) {} });
    _mgSid = sid; _mgCard = null;
    const db = firebase.database();
    const cfgRef = db.ref('classRPG_mathgap/config'), cardRef = db.ref('classRPG_mathgap/kids/' + sid + '/card');
    _mgRefs = [cfgRef, cardRef];
    const redraw = () => document.querySelectorAll('.home-mathgap').forEach(el => { el.innerHTML = mathgapCardInner(); });
    cfgRef.on('value', snap => {
      const was = mathgapOpen();
      _mgCfg = snap.val() || null;
      redraw();
      // 단원이 열리고 닫힐 때만 홈을 다시 그린다 — '배우고 만들기' 문이 따라 생기거나 없어지게
      if (was !== mathgapOpen()) {
        try { if (typeof renderMain === 'function' && document.getElementById('main-area')) renderMain(); } catch (e) {}
        try { if (typeof renderMobile === 'function' && document.getElementById('mob-main-tab')) renderMobile(); } catch (e) {}
      }
    }, e => console.warn('[MATHGAP-HOME-1]', e));
    cardRef.on('value', snap => { _mgCard = snap.val() || null; redraw(); }, e => console.warn('[MATHGAP-HOME-1]', e));
  } catch (e) { console.warn('[MATHGAP-HOME-1]', e); }
}
function buildMathgapCardHTML() { return `<div class="home-mathgap" style="display:contents">${mathgapCardInner()}</div>`; }
// 선생님이 단원을 열었나 — '배우고 만들기' 문을 보일지
function mathgapOpen() { return !!(_mgCfg && typeof _mgCfg.unit === 'string' && /^\d-\d-\d$/.test(_mgCfg.unit)); }
const _mgToday = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };   // 앱 dayKey 와 같은 꼴(기기 시각)
// 오늘 카드 한 줄 — { title, sub, btn, tone }
function mathgapCardState() {
  const cfg = _mgCfg, c = _mgCard && typeof _mgCard === 'object' ? _mgCard : null;
  const uname = escHtml(String((cfg && cfg.name) || '').replace(/^\d-\d\s*/, '').slice(0, 30) || '수학');
  const fresh = !c || c.unit !== cfg.unit;                       // 새 탑(처음 · 선생님이 단원을 바꿈)
  if (fresh) return { title: '오늘의 수학', sub: `처음이에요! 문제를 풀면서 <b>${uname} 탑</b>을 살펴봐요`, btn: '시작하기', tone: 'gold' };
  const nextL = c.next ? `${Number(c.nextNo) > 0 ? Number(c.nextNo) + '층' : '기초'} ${escHtml(String(c.nextName || '').slice(0, 30))}` : '';
  const today = c.day === _mgToday();
  if (today && c.doneToday && c.stage !== 'top') return { title: '오늘 수학 끝!', sub: `오늘 ${Math.max(1, Math.round((Number(c.ms) || 0) / 60000))}분 · 내일 또 만나요`, btn: '내 탑 보기', tone: 'green' };
  if (c.stage === 'top') return { title: '탑 완성!', sub: `${uname} 탑에 불이 다 켜졌어요 · 점검할 날이 오면 몇 문제`, btn: '내 탑 보기', tone: 'gold2' };
  if (c.stage === 'wait') return { title: '오늘의 수학', sub: '남은 층은 선생님이랑 같이 켜요', btn: '내 탑 보기', tone: 'blue' };
  if (c.stage === 'scan' || c.stage === 'facts' || !c.scanned) return { title: '오늘의 수학', sub: `${uname} 탑 살펴보기를 이어서 해요`, btn: '이어서', tone: 'gold' };
  if (today && c.stage === 'review' && Number(c.review) > 0) return { title: '오늘의 수학', sub: `먼저 불 점검 ${Number(c.review)}문제${nextL ? `, 그다음 <b>${nextL}</b>` : ''}`, btn: '이어서', tone: 'gold' };
  return { title: '오늘의 수학', sub: nextL ? `오늘은 <b>${nextL}</b>에 불을 켜요` : '오늘의 수학을 이어서 해요', btn: today ? '이어서' : '시작하기', tone: 'gold' };
}
// 카드 왼쪽 작은 탑 — floors '1009…'(1 켬 · 0 꺼짐 · 2 선생님과 · 9 아직)
function mathgapMiniTower(code) {
  const cells = String(code || '').replace(/[^0129]/g, '').slice(0, 12).split('');
  const n = cells.length || 6;
  return `<div style="display:flex;flex-direction:column-reverse;gap:3px;width:32px;flex:none" aria-hidden="true">
    <i style="display:block;height:4px;border-radius:2px;background:#5a4733;margin-top:2px"></i>
    ${(cells.length ? cells : Array(n).fill('9')).map(x => `<i style="display:block;height:8px;border-radius:3px;${x === '1' ? 'background:#f2a93b;box-shadow:0 0 6px rgba(242,169,59,.5)' : x === '2' ? 'background:#1c2229;border:1.5px dashed #4f6a80' : x === '9' ? 'background:#2e241a;border:1.5px solid #4a3a2a' : 'background:#2e241a;border:1.5px dashed #6b5640'}"></i>`).join('')}
  </div>`;
}
function mathgapCardInner() {
  if (!mathgapOpen()) return '';
  const st = mathgapCardState();
  const col = { gold: '#f2a93b', gold2: '#ffc766', green: 'var(--emerald)', blue: '#7cc0f0' }[st.tone] || '#f2a93b';
  return `
    <div class="today-card" onclick="openExternalEmbed('mathgap')"
      style="cursor:pointer;grid-column:1/-1;border:1.5px solid ${col};margin-top:.5rem">
      <div style="display:flex;align-items:center;gap:.8rem">
        ${mathgapMiniTower(_mgCard && _mgCard.unit === _mgCfg.unit ? _mgCard.floors : '')}
        <div style="flex:1;min-width:0">
          <div style="font-size:.9rem;font-weight:800;color:${col}">🧮 ${st.title}</div>
          <div style="font-size:.74rem;color:var(--txt2);margin-top:.15rem;line-height:1.45">${st.sub}</div>
        </div>
        <div style="font-size:.72rem;padding:.3rem .7rem;border-radius:8px;flex-shrink:0;font-weight:700;
          ${st.tone === 'green' ? 'background:rgba(46,204,113,.15);color:var(--emerald)' : `background:${col};color:#1a1a1a`}">${st.btn}</div>
      </div>
    </div>`;
}
// 앱의 'RPG로 돌아가기'
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'rpg:embed-close' || e.data.app !== 'mathgap') return;
  if (typeof _embedState !== 'undefined' && _embedState && _embedState.key === 'mathgap' && typeof closeExternalEmbed === 'function') closeExternalEmbed();
});
