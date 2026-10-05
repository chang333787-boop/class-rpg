// admin/assign-music.js — 📝 과제·수업 · 🎵 음악실 리듬 [ASSIGN-MUSIC-1]
//  · 만들기 '① 무엇을' 칸: 곡(음악실 기본 곡 · ★ 난이도) · 난이도 · 키 수 · 빠르기 — admin/assign.js 가 assignMusicPickerHTML(d) 를 부른다
//  · 결과 표(음악용 칸): 가장 좋은 정확도 · 등급 · 판정 넷 · 최대 콤보 · 처음 판 · 친 횟수 · 걸린 시간 / 반: 등급별 수 · 정확도 평균
//  · 아이 쪽 = music/js/app.js · rhythm.js(?assign) · 결과 모양 = music/js/assign-music.js rhythmPatch · 쓰는 곳 = AssignCore.appPatch
//  · 곡 목록은 음악실 파일(music/js/library.js)을 그때 한 번 읽는다 — ?v= 는 music/index.html import map 값과 같게(시험이 견줌)
//  · 전역 이름 머리 = assignMusic · _assignMusic · ASSIGN_MUSIC

const ASSIGN_MUSIC_LIB_SRC = 'music/js/library.js?v=2';
//  rhythm.js LEVELS 와 같은 차례 · 이름 · 기본 키 수 · 빠르기 배(시험이 견줌)
const ASSIGN_MUSIC_LEVELS = [['easy', '쉬움', 4, 1], ['normal', '보통', 8, 1], ['hard', '어려움', 8, 1.1], ['expert', '아주 어려움', 8, 1.25]];
const ASSIGN_MUSIC_GRADES = ['S', 'A', 'B', 'C', 'D'];
let _assignMusicLib = null;   // null 아직 · 'loading' · [곡] · 'err'

function _assignMusicLoad() {
  if (_assignMusicLib === 'loading' || Array.isArray(_assignMusicLib)) return;
  _assignMusicLib = 'loading';
  //  클래식 스크립트의 import() 는 이 파일 자리 기준이라 — 페이지 주소 기준 절대 주소로
  import(new URL(ASSIGN_MUSIC_LIB_SRC, document.baseURI).href).then(m => {
    _assignMusicLib = (m.LIBRARY || []).filter(x => x && /^[\w-]{1,40}$/.test(String(x.key))).map(x => ({
      id: 'lib_' + x.key, title: String(x.title || x.key), origin: String(x.origin || ''), level: Number(x.level) || 0, practice: !!x.practice,
      beats: Number(x.beats) || 4, tempo: Number(x.tempo) || 100 }));
    _assignMusicRefresh();
  }).catch(e => { console.warn('[ASSIGN-MUSIC-1] 곡 목록', e); _assignMusicLib = 'err'; _assignMusicRefresh(); });
}
function _assignMusicRefresh() {
  const d = _AS.draft, el = document.getElementById('asg-pick-music');
  if (!d || d.kind !== 'music' || !el) return;
  el.innerHTML = assignMusicPickerHTML(d);
  if (typeof _assignCMeta === 'function') _assignCMeta();   // 이름(곡 제목) 따라감
}
function assignMusicRetry() { _assignMusicLib = null; _assignMusicRefresh(); }
function assignMusicSongTitle(id) {
  const s = Array.isArray(_assignMusicLib) ? _assignMusicLib.find(x => x.id === id) : null;
  return s ? s.title : String(id || '').replace(/^lib_/, '');
}
function _assignMusicLevel(key) { return ASSIGN_MUSIC_LEVELS.find(l => l[0] === key) || ASSIGN_MUSIC_LEVELS[0]; }

// ── 고르기 칸 ──
function assignMusicPickerHTML(d) {
  _assignMusicLoad();
  if (_assignMusicLib === 'err') return `<div class="asg-empty">음악실 곡 목록을 읽지 못했어요 <button class="btn-sm outline" onclick="assignMusicRetry()">다시 읽기</button></div>`;
  if (!Array.isArray(_assignMusicLib)) return `<div class="asg-empty">음악실 곡 목록을 읽는 중…</div>`;
  const m = d.music, lv = _assignMusicLevel(m.level);
  const stars = s => s.practice ? '<span class="asg-chip">연습곡</span>' : `<span class="asg-mu-star">${'★'.repeat(Math.max(1, Math.min(4, s.level)))}</span>`;
  const songs = _assignMusicLib.map(s => `<button type="button" class="asg-mu-song${m.song === s.id ? ' on' : ''}" onclick="assignMusicDraft('song','${escJsAttr(s.id)}')">
      <span class="asg-mu-radio">${m.song === s.id ? '●' : '○'}</span><b>${escHtml(s.title)}</b> ${stars(s)}<span class="text-muted-sm">${escHtml(s.origin)} · ${s.beats}박</span></button>`).join('');
  const seg = (key, val, label, on) => `<button class="asg-seg${on ? ' on' : ''}" onclick="assignMusicDraft('${key}','${val}')">${label}</button>`;
  return `<div class="asg-mu">
    <div class="asg-c-row"><span class="text-muted-sm">곡</span><span class="text-muted-sm">★ = 곡이 어려운 정도 · 기본 곡 ${_assignMusicLib.length}곡</span></div>
    <div class="asg-mu-songs">${songs}</div>
    <div class="asg-c-row"><span class="text-muted-sm">난이도</span><span class="asg-segs small">${ASSIGN_MUSIC_LEVELS.map(l => seg('level', l[0], l[1], m.level === l[0])).join('')}</span>
      <span class="text-muted-sm">${lv[3] !== 1 ? `판정이 좁고 빠르기 ×${lv[3]}` : lv[0] === 'easy' ? '판정이 넓어요 · 4키' : '건반처럼 8키'}${lv[0] === 'expert' ? ' · 음표가 판정선 앞에서 사라짐' : ''}</span></div>
    <div class="asg-c-row"><span class="text-muted-sm">키 수</span><span class="asg-segs small">${seg('keys', 0, `난이도 기본(${lv[2]}키)`, !m.keys)}${seg('keys', 4, '4키', m.keys === 4)}${seg('keys', 6, '6키', m.keys === 6)}${seg('keys', 8, '8키 · 건반', m.keys === 8)}</span></div>
    <div class="asg-c-row"><span class="text-muted-sm">빠르기</span><span class="asg-segs small">${seg('tempo', 1, '원래 빠르기', m.tempo !== 0.8)}${seg('tempo', 0.8, '조금 느리게', m.tempo === 0.8)}</span></div>
    <div class="asg-note-t">🎹 반 모두 같은 판(아이 기기의 난이도 · 키 설정은 안 씀) · 우리 반 최고 기록판은 안 보여요(순위 없음) · 결과 = 가장 좋은 정확도 · 처음 판 · 친 횟수</div>
    <div class="asg-note-t">🔊 리듬 게임은 누를 때 소리가 나요 — 이어폰이 없으면 기기 소리를 줄이게 해 주세요 · 아무것도 안 치고 끝까지 둔 판은 '끝'으로 세지 않아요</div>
  </div>`;
}
function assignMusicDraft(key, val) {
  const d = _AS.draft;
  if (!d || d.kind !== 'music') return;
  const m = d.music;
  if (key === 'song') m.song = /^[\w-]{1,60}$/.test(String(val)) ? String(val) : '';
  if (key === 'level') m.level = ASSIGN_MUSIC_LEVELS.some(l => l[0] === val) ? val : 'easy';
  if (key === 'keys') m.keys = [4, 6, 8].includes(Number(val)) ? Number(val) : 0;
  if (key === 'tempo') m.tempo = Number(val) === 0.8 ? 0.8 : 1;
  _assignMusicRefresh();
}
//  과제 이름 — '리듬 · 나비야 · 쉬움'(조금 느리게면 덧붙임)
function assignMusicAutoTitle(d) {
  const m = d.music;
  if (!m.song) return '음악실 리듬';
  return `리듬 · ${assignMusicSongTitle(m.song)} · ${_assignMusicLevel(m.level)[1]}${m.tempo === 0.8 ? ' · 느리게' : ''}`;
}
//  목록 줄 머리
function assignMusicKindLabel(def) {
  const m = def.content.music, lv = _assignMusicLevel(m.level);
  return `🎵 리듬 · ${escHtml(assignMusicSongTitle(m.song))} · ${lv[1]} · ${m.keys || lv[2]}키${m.tempo === 0.8 ? ' · 조금 느리게' : ''}`;
}

// ── 결과 ──
function _assignMusicBest(r) { const b = r && r.detail && r.detail.best; return b && typeof b === 'object' ? b : null; }
function _assignMusicFirst(r) { const b = r && r.detail && r.detail.first; return b && typeof b === 'object' ? b : null; }
//  반 요약 — 끝낸 아이 등급별 수 · 정확도 평균(끝낸 아이) · 친 아이 수
function assignMusicSummary(t) {
  const g = {}; let sum = 0, n = 0;
  for (const r of t.rows) {
    const b = _assignMusicBest(r);
    if (!b || r.status !== 'done') continue;
    const k = ASSIGN_MUSIC_GRADES.includes(b.grade) ? b.grade : 'D';
    g[k] = (g[k] || 0) + 1; sum += Number(b.acc) || 0; n++;
  }
  return { grades: g, avg: n ? Math.round(sum / n * 10) / 10 : null, n };
}
function _assignMusicGradeChips(sum) {
  return ASSIGN_MUSIC_GRADES.filter(k => sum.grades[k]).map(k => `<span class="asg-dist-chip asg-mu-g g-${k}">${k} ${sum.grades[k]}</span>`).join('');
}
//  수업 띠(각자 풀기) 한 줄
function assignMusicLiveHTML(def, t) {
  const s = assignMusicSummary(t);
  return `<div class="asg-live-row"><span class="text-muted-sm">끝까지 친 아이</span> <b>${s.n}</b>${s.avg != null ? ` · 정확도 평균 <b>${s.avg}%</b>` : ''} ${_assignMusicGradeChips(s)}</div>`;
}
//  결과 표 — 명단 기준(안 한 아이도) · 이름 가리기 중엔 숫자 숨김
function assignMusicResultHTML(def, t) {
  const mask = _assignMasked(), s = assignMusicSummary(t);
  const J = b => b ? `<span class="asg-mu-j"><i class="p">${b.perfect || 0}</i><i class="g">${b.great || 0}</i><i class="o">${b.good || 0}</i><i class="m">${b.miss || 0}</i></span>` : '-';
  const rows = [...t.rows, ...t.outside].map((r, i) => {
    const b = _assignMusicBest(r), f = _assignMusicFirst(r);
    const nm = r.outside ? `<span class="text-muted-sm">명단 밖</span> ${escHtml(r.name || r.sid)}` : _assignNameHTML(r.name, i);
    if (mask) return `<tr><td class="td-name">${nm}</td><td>${_assignStatus(r)}</td><td colspan="6" class="text-muted-sm">이름 가리기 중</td></tr>`;
    return `<tr><td class="td-name">${nm}</td><td>${_assignStatus(r)}</td>
      <td class="nowrap">${b ? `<b>${Number(b.acc) || 0}%</b> <span class="asg-mu-g g-${escHtml(b.grade)}">${escHtml(b.grade)}</span>` : '-'}</td>
      <td class="nowrap">${J(b)}</td><td>${b ? b.maxCombo || 0 : '-'}</td>
      <td class="nowrap">${f ? `${Number(f.acc) || 0}% (${escHtml(f.grade)})` : '-'}</td>
      <td>${r.attempts || 0}</td><td class="nowrap">${r.ms == null ? '-' : _assignMs(r.ms)}</td></tr>`;
  }).join('');
  return `<div class="asg-mu-sum">끝까지 친 아이 <b>${s.n}</b> / ${t.rows.length}${s.avg != null && !mask ? ` · 정확도 평균 <b>${s.avg}%</b>` : ''} ${mask ? '' : _assignMusicGradeChips(s)}
      <span class="text-muted-sm">판정 = <i class="asg-mu-k p">완벽</i><i class="asg-mu-k g">좋아</i><i class="asg-mu-k o">괜찮아</i><i class="asg-mu-k m">놓침</i> · 정확도 = 가장 좋은 판</span></div>
    <div class="asg-table-wrap"><table class="asg-table"><thead><tr><th>이름</th><th>상태</th><th>정확도</th><th>판정</th><th>최대 콤보</th><th>처음 판</th><th>친 횟수</th><th>걸린 시간</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
