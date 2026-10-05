// admin/assign-coding.js — 📝 과제·수업 · 기초 코딩 [ASSIGN-CODING-1]
//  · 만들기: 단원 → 판 칩(1~3판 · 고른 차례 = 아이가 푸는 차례) — 판 목록은 기초 코딩 앱의 정본(coding/js/stages.js)을 그때 불러온다
//  · 결과: 반 명단 기준 · 판마다 ★ / 실행 수 · 막힘(못 풀고 실행 5번 이상 — 막힘 지도와 같은 기준) · 많이 한 실수 · 칸을 누르면 마지막 코드(글 코드)
//  · 아이 쪽 결과 칸 app.detail[<판>] = { rank, ok, st, n, tries, why, py } — coding/js/asg.js 가 만든다
//  · 공용 틀(admin/assign.js ASSIGN_APPS · 결과 표 틀 · 만들기 · 수업 띠)에 맨 아래에서 단다 — 여기는 판 칩 · 결과 칸만 [ASSIGN-APPS-1]
//  · 전역 이름 머리 = assignCoding · _assignCoding · _ASC

//  = coding/index.html import map 의 "./js/stages.js" ?v= (시험 scripts/unit/coding/assign.test.mjs 가 견준다)
const ASSIGN_CODING_STAGES_V = '4';
const _ASC = { units: null, stages: null, loading: false, err: false, open: 0, cell: '' };
const ASSIGN_CODING_STUCK = 5;
//  실수 까닭(coding/js/teacher.js WHY_KO 와 같은 말 + 꼭 써야 하는 블록)
const ASSIGN_CODING_WHY = { wall: '나무에 부딪힘', water: '웅덩이', edge: '길 밖', tree: '나무 뛰기', land: '내릴 곳 없음', noacorn: '빈손 줍기', short: '덜 감', acorns: '도토리 덜 주움',
  loop: '끝없는 반복', draw: '그림 다름', empty: '빈 코드', nofunc: '없는 기술', score: '점수판 틀림', needvar: '주머니 안 씀', needcall: '기술 안 씀', needtouch: '닿으면 블록 없음', needtick: '똑딱 블록 없음', nokeys: '키 블록 없음' };

//  판 목록 불러오기(한 번) — 다 오면 만들기 칸 · 결과 표를 다시 그린다
function _assignCodingLoad() {
  if (_ASC.stages || _ASC.loading) return;
  _ASC.loading = true; _ASC.err = false;
  import(new URL('coding/js/stages.js?v=' + ASSIGN_CODING_STAGES_V, document.baseURI).href)
    .then(m => { _ASC.units = m.UNITS || []; _ASC.stages = (m.STAGES || []).map(s => ({ id: s.id, unit: s.unit, title: s.title, best: s.best, buggy: !!s.buggy, game: !!s.game })); })
    .catch(e => { console.warn('[ASSIGN-CODING-1] 판 목록', e); _ASC.err = true; })
    .finally(() => {
      _ASC.loading = false;
      const d = typeof _AS !== 'undefined' && _AS.draft;
      if (d && d.kind === 'coding' && typeof _assignCWhat === 'function') { _assignCWhat(); _assignCMeta(); }
      if (typeof _assignRenderBits === 'function') _assignRenderBits(true);
    });
}
function _assignCodingStage(id) { return (_ASC.stages || []).find(s => s.id === id) || null; }
function _assignCodingName(id) { const s = _assignCodingStage(id); return s ? `${s.id} ${s.title}` : String(id); }

// ── 만들기 ──
function assignCodingPickerHTML(d) {
  _assignCodingLoad();
  if (!_ASC.stages) return _ASC.err ? `판 목록을 못 불러왔어요 <button class="btn-sm outline" onclick="_assignCodingRetry()">다시</button>` : '판 목록을 불러오는 중…';
  const picked = d.coding.stages, full = picked.length >= AssignCore.STAGES_MAX;
  const unitRow = u => {
    const list = _ASC.stages.filter(s => s.unit === u.id), n = list.filter(s => picked.includes(s.id)).length, open = _ASC.open === u.id;
    return `<div class="asg-unit${open ? ' open' : ''}"><button class="asg-unit-h" onclick="assignCodingUnit(${Number(u.id)})">${open ? '▾' : '▸'} ${Number(u.id)}단원 · ${escHtml(u.title)} <span class="text-muted-sm">${escHtml(u.concept || '')} · ${list.length}판</span>${n ? ` <span class="asg-tag">고름 ${n}</span>` : ''}</button>
      ${open ? `<div class="asg-cd-stages">${list.map(s => {
        const i = picked.indexOf(s.id), on = i >= 0;
        return `<button class="asg-cd-stage${on ? ' on' : ''}" ${!on && full ? 'disabled title="3판까지 골라요"' : ''} onclick="assignCodingToggle('${escJsAttr(s.id)}')">
          ${on ? `<span class="asg-cd-n">${i + 1}</span>` : ''}<b>${escHtml(s.id)}</b> ${escHtml(s.title)}<small>★★★ = 블록 ${Number(s.best) || '-'}개${s.buggy ? ' · 고치기' : ''}${s.game ? ' · 게임' : ''}</small></button>`;
      }).join('')}</div>` : ''}</div>`;
  };
  return `<div class="asg-cd">
    <div class="text-muted-sm">판을 1~3개 골라요 — 고른 차례대로 아이가 풀어요. 과제로 연 판은 잠금 없이 열리고, 처음에는 판의 처음 모양(새 종이)으로 시작해요.</div>
    <div class="asg-cd-picked">${picked.length ? picked.map((id, i) => `<span class="asg-cd-pk">${i + 1}. ${escHtml(_assignCodingName(id))} <button class="asg-mini" onclick="assignCodingToggle('${escJsAttr(id)}')" aria-label="빼기">✕</button></span>`).join('') : '<span class="text-muted-sm">아직 고른 판이 없어요</span>'}</div>
    ${_ASC.units.filter(u => u.open !== false).map(unitRow).join('')}
  </div>`;
}
function _assignCodingRetry() { _ASC.err = false; _assignCodingLoad(); if (typeof _assignCWhat === 'function') _assignCWhat(); }
function assignCodingUnit(id) { _ASC.open = _ASC.open === id ? 0 : id; if (typeof _assignCWhat === 'function') _assignCWhat(); }
function assignCodingToggle(id) {
  const d = typeof _AS !== 'undefined' && _AS.draft;
  if (!d || !_assignCodingStage(id)) return;
  const l = d.coding.stages;
  if (l.includes(id)) d.coding.stages = l.filter(x => x !== id);
  else if (l.length < AssignCore.STAGES_MAX) d.coding.stages = [...l, id];
  _assignCWhat(); _assignCMeta();
}

// ── 결과 칸(틀 = admin/assign.js _assignAppResultHTML · 줄은 명단 차례 그대로) ──
//  칸 = 푼 판 · 실행 · 걸린 시간 · 판마다 ★★☆(실행 4) · ✗ 실행 6 막힘 · · · 막힌 판 / 끝 줄 = 판마다 푼 아이 · 막힌 아이 · 많이 한 실수 / 표 밑 = 누른 칸의 마지막 코드
function _assignCodingInfo(def, r) {
  return def.content.coding.stages.map(id => {
    const d = r.detail && r.detail[id] && typeof r.detail[id] === 'object' ? r.detail[id] : null;
    const tries = d ? Math.max(0, Math.floor(Number(d.tries) || 0)) : 0, ok = !!(d && d.ok);
    return { id, d, ok, st: ok ? Math.max(1, Math.min(3, Math.floor(Number(d.st) || 1))) : 0, n: d ? Math.floor(Number(d.n) || 0) : 0, tries, stuck: !ok && tries >= ASSIGN_CODING_STUCK };
  });
}
function _assignCodingCols(def) {
  return ['<th>푼 판</th>', '<th>실행</th>', '<th>걸린 시간</th>', ...def.content.coding.stages.map(id => `<th class="asg-c" title="${escHtml(_assignCodingName(id))}">${escHtml(id)}</th>`), '<th>막힌 판</th>'];
}
function _assignCodingCells(r, def) {
  _assignCodingLoad();
  const xs = _assignCodingInfo(def, r), stuck = xs.filter(x => x.stuck).map(x => x.id);
  const cell = x => {
    const key = r.sid + '|' + x.id, on = _ASC.cell === key;
    if (!x.d) return `<td class="asg-c none">·</td>`;
    const txt = x.ok ? `${'★'.repeat(x.st)}${'☆'.repeat(3 - x.st)} <small>(실행 ${x.tries})</small>` : `✗ <small>실행 ${x.tries}${x.stuck ? ' 막힘' : ''}</small>`;
    return `<td class="asg-c asg-cd-c ${x.ok ? 'ok' : x.stuck ? 'stuck' : 'no'}${on ? ' on' : ''}" onclick="assignCodingCell('${escJsAttr(key)}')" title="누르면 마지막 코드">${txt}</td>`;
  };
  return `<td class="nowrap">${r.status === 'none' ? '-' : `${r.correct} / ${r.total}`}</td><td class="nowrap">${r.attempts || 0}</td><td class="nowrap">${r.ms == null ? '-' : _assignMs(r.ms)}</td>${xs.map(cell).join('')}<td class="asg-cd-stuck">${stuck.length ? escHtml(stuck.join(' · ')) : ''}</td>`;
}
//  판마다 — 푼 아이 · 막힌 아이 · 많이 한 실수(명단 안 아이만) · lead = 앞 칸 수(이름 · 상태)
function _assignCodingFoot(def, t, lead) {
  const per = def.content.coding.stages.map(id => {
    let solved = 0, stuckN = 0; const why = {};
    for (const r of t.rows) {
      const x = _assignCodingInfo(def, r).find(y => y.id === id);
      if (x.ok) solved++; if (x.stuck) stuckN++;
      if (x.d && x.d.why && typeof x.d.why === 'object') for (const k of Object.keys(x.d.why)) why[k] = (why[k] || 0) + (Number(x.d.why[k]) || 0);
    }
    const top = Object.entries(why).sort((a, b) => b[1] - a[1])[0];
    return `<td class="asg-c asg-cd-sum">푼 ${solved}${stuckN ? ` · <span class="asg-cd-red">막힘 ${stuckN}</span>` : ''}${top && top[1] ? `<br><small>${escHtml(ASSIGN_CODING_WHY[top[0]] || top[0])} ${top[1]}</small>` : ''}</td>`;
  }).join('');
  return `<tr class="asg-rate"><td colspan="${lead + 3}">판마다 · 푼 아이 · 막힌 아이(못 풀고 실행 ${ASSIGN_CODING_STUCK}번 이상) · 많이 한 실수</td>${per}<td></td></tr>`;
}
function assignCodingCell(key) { _ASC.cell = _ASC.cell === key ? '' : key; if (typeof _assignRenderBits === 'function') _assignRenderBits(); }
//  고른 칸의 마지막 코드(글 코드 앞 300자) · 실수 셈
function _assignCodingCodeHTML(def, rows) {
  if (!_ASC.cell) return '';
  const [sid, id] = _ASC.cell.split('|');
  const r = rows.find(x => x.sid === sid), d = r && r.detail && r.detail[id];
  if (!r || !d || typeof d !== 'object') return '';
  const why = d.why && typeof d.why === 'object' ? Object.entries(d.why).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${escHtml(ASSIGN_CODING_WHY[k] || k)} ${Number(n)}`).join(' · ') : '';
  return `<div class="asg-item asg-cd-code"><div class="asg-item-q"><b>${escHtml(r.name || sid)}</b> · ${escHtml(_assignCodingName(id))} · ${d.ok ? `성공 ★${Number(d.st) || 0} · 블록 ${Number(d.n) || 0}개` : '아직 못 풂'} · 실행 ${Number(d.tries) || 0}번
    ${why ? `<div class="text-muted-sm">실수: ${why}</div>` : ''}</div>
    <pre class="asg-cd-py">${escHtml(String(d.py || '(코드 없음)'))}</pre>
    <button class="btn-sm outline" onclick="assignCodingCell('')">닫기</button></div>`;
}

// ── 공용 틀에 달기 [ASSIGN-APPS-1] ──
if (typeof ASSIGN_APPS !== 'undefined') ASSIGN_APPS.coding = {
  cls: 'cd', preload: _assignCodingLoad, picker: assignCodingPickerHTML,
  build: d => d.coding.stages.length ? { content: { coding: { stages: d.coding.stages.slice(0, AssignCore.STAGES_MAX) } } } : { err: '판을 골라 주세요' },
  autoTitle: d => `기초 코딩 ${d.coding.stages.join(' · ')}`.trim(),
  what: def => `🧩 기초 코딩 ${def.n}판`,
  cols: _assignCodingCols, cells: _assignCodingCells, foot: _assignCodingFoot, after: _assignCodingCodeHTML,
  liveCtl: '아이들이 각자 판을 풀어요 · 다 한 아이는 더 줄여 보거나 기다려요',
  selfNote: '덮개 안에서 기초 코딩이 열려요', startNote: '덮개 안에서 기초 코딩이 열리고, 이미 푼 판은 ★가 남아요',
};
