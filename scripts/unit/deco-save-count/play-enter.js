// 꾸미기 놀이판 자동 입장 — 비밀번호 입력 없이 '시험' 학생으로 들어가 장식을 전부 3개씩 쥐여 준다.
(function () {
  const P = window.__PLAY, t0 = Date.now();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  (async () => {
    while (!(typeof DB !== 'undefined' && DB._cache && document.getElementById('loading-screen')?.style.display === 'none')) {
      if (Date.now() - t0 > 20000) return; await sleep(50);
    }
    const s = DB.getStudent(P.sid);
    s.inventory = GAME_DATA.decorations.filter(d => d.price > 0 && !d.hidden).map(d => ({ id: d.id, qty: 3 }));
    DB.saveStudent(s);
    document.getElementById('s-title')?.classList.add('hidden');
    CUR = JSON.parse(JSON.stringify(DB.getStudent(P.sid)));
    hideScreen('s-login'); enterGame();
    const tag = document.createElement('div');
    tag.textContent = '🧪 놀이판 — 운영 DB 안 씀';
    tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#7a2;color:#fff;font:700 11px sans-serif;padding:3px 7px;border-radius:6px;pointer-events:none;opacity:.85';
    document.body.appendChild(tag);
  })();
})();
