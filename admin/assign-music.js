// admin/assign-music.js — 📝 과제·수업 · 🎵 음악실 리듬 [ASSIGN-MUSIC-1]
//  · 만들기 '① 무엇을' 칸: 곡(음악실 기본 곡 · ★ 난이도 / 🎤 선생님 곡) · 난이도 · 키 수 · 빠르기
//  · 결과 칸(틀 = admin/assign.js _assignAppResultHTML): 가장 좋은 정확도 · 등급 · 판정 넷 · 최대 콤보 · 처음 판 · 친 횟수 · 걸린 시간 / 표 위: 등급별 수 · 정확도 평균
//  · 공용 틀(admin/assign.js ASSIGN_APPS)에 맨 아래에서 단다 — 여기는 곡 고르기 · 결과 칸만 [ASSIGN-APPS-1]
//  · 아이 쪽 = music/js/app.js · rhythm.js(?assign) · 결과 모양 = music/js/assign-music.js rhythmPatch · 쓰는 곳 = AssignCore.appPatch
//  · 곡 목록은 음악실 파일(music/js/library.js)을 그때 한 번 읽는다 — ?v= 는 music/index.html import map 값과 같게(시험이 견줌)
//  · [ASSIGN-TSONG-1] 🎤 선생님 곡(공연 곡) = 반 저장소 classRPG_music/tsongs(음악실 교사 화면이 넣음 · 저작권이 있어 공개 저장소에 없음) — 기본 곡 밑 둘째 칸 · 값 'ts_<곡키>'
//  · 전역 이름 머리 = assignMusic · _assignMusic · ASSIGN_MUSIC

const ASSIGN_MUSIC_LIB_SRC = 'music/js/library.js?v=20261006lr1';
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
//  force = 고른 값이 바뀜(늘 다시 그림) · 아니면 목록을 다 읽은 때 — 고르기 칸이 '읽는 중'일 때만 다시 그린다(이미 곡이 보이면 그대로 → 누르는 사이 칸이 바뀌어 클릭이 빠지지 않게) [ASSIGN-APPS-1]
function _assignMusicRefresh(force) {
  //  목록 · 결과 머리의 곡 이름도 영어 열쇠(nabiya) 대신 제목으로 다시 그린다 [ASSIGN-MUSIC-1 · 검토 반영]
  if (!force && typeof _assignRenderBits === 'function' && Array.isArray(_assignMusicLib)) _assignRenderBits(true);
  const d = typeof _AS !== 'undefined' && _AS.draft, el = document.getElementById('asg-pick-music');
  if (!d || d.kind !== 'music' || !el) return;
  if (!force && el.querySelector('.asg-mu-song')) return;
  el.innerHTML = assignMusicPickerHTML(d);
  if (typeof _assignCMeta === 'function') _assignCMeta();   // 이름(곡 제목) 따라감
}
function assignMusicRetry() { _assignMusicLib = null; _assignMusicRefresh(true); }
function assignMusicSongTitle(id) {
  const k = String(id || '');
  if (k.startsWith('ts_')) {   // [ASSIGN-TSONG-1] 선생님 곡 = 제목 · 부분 — 아직 못 읽었거나 음악실에서 지운 곡이면 '선생님 곡'(곡키를 그대로 보이지 않음)
    const t = Array.isArray(_assignMusicTs) ? _assignMusicTs.find(x => x.id === k) : null;
    return t ? t.title : '선생님 곡';
  }
  const s = Array.isArray(_assignMusicLib) ? _assignMusicLib.find(x => x.id === k) : null;
  return s ? s.title : k.replace(/^lib_/, '');
}

// ── 🎤 선생님 곡(공연 곡) [ASSIGN-TSONG-1] ──
//  반 저장소 tsongs/<곡키>(music/js/store.js) — 고르기 칸을 열 때 한 번 읽는다(구독 없음 · 새 과제를 열면 다시 → 그사이 음악실에서 넣은 곡도 뜸).
//  못 읽어도(끊김 · 시간 초과) 기본 곡 칸 · 난이도 칸은 그대로 — 둘째 칸만 '못 읽었어요 · 다시 읽기'.
//  가락은 풀지 않는다(교사 화면이 넣을 때 song.js 가 이미 살핌) — 칸 모양만 아이 쪽(fromTeacherSong)과 같게 보고 틀린 곡은 건너뛴다. 마디 = '|' 로 나눈 칸 수.
const ASSIGN_MUSIC_TS_PATH = 'classRPG_music/tsongs';
const ASSIGN_MUSIC_TS_WAIT = 10000;   // 이만큼 안 오면 '못 읽었어요'(늦게 오면 그때 채움)
let _assignMusicTs = null;            // null 아직 · [곡] · 'err'
let _assignMusicTsBusy = false, _assignMusicTsFor = null, _assignMusicTsSeq = 0, _assignMusicTsShown = '';
//  반 저장소 값 → [{ id, key, name, part, title, bars, tempo, beats, level, order }] · 같은 제목(합주 부분)은 붙여서 — 묶음 차례 = 묶음 안 가장 앞 순서(order) → 제목 · 묶음 안 = 순서 → 부분
function _assignMusicTsList(val) {
  const out = [];
  for (const raw of (val && typeof val === 'object' ? Object.values(val) : [])) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const txt = k => typeof raw[k] === 'string' ? raw[k].trim() : '';
    const key = txt('key'), name = txt('title'), part = txt('part'), melody = txt('melody');
    const beats = Number(raw.beats), sub = Number(raw.sub), tempo = Math.round(Number(raw.tempo));
    const order = raw.order == null ? 99 : Number(raw.order), level = raw.level == null ? 2 : Number(raw.level);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key) || !name || name.length > 30 || part.length > 12 || !melody || melody.length > 40000) continue;
    if (![2, 3, 4].includes(beats) || ![2, 3, 4].includes(sub) || !(tempo >= 40 && tempo <= 200) || !Number.isFinite(order) || !Number.isInteger(level) || level < 0 || level > 4) continue;
    const bars = melody.split('|').filter(b => b.trim()).length;
    if (!bars || bars > 200) continue;
    out.push({ id: 'ts_' + key, key, name, part, title: name + (part ? ' · ' + part : ''), bars, tempo, beats, level, order });
  }
  const first = {};
  for (const s of out) first[s.name] = Math.min(s.name in first ? first[s.name] : Infinity, s.order);
  return out.sort((a, z) => (first[a.name] - first[z.name]) || a.name.localeCompare(z.name, 'ko') || (a.order - z.order) || a.part.localeCompare(z.part, 'ko'));
}
//  읽기 — forKey = 무엇 때문에(새 과제 id · 'list' = 목록 이름) · 같은 까닭으로는 다시 안 읽는다 · 읽는 중이면 그 결과를 같이 쓴다
function _assignMusicTsLoad(forKey) {
  const k = String(forKey == null ? '' : forKey);
  if (_assignMusicTsBusy || _assignMusicTsFor === k) return;
  _assignMusicTsFor = k;
  const db = typeof _AS !== 'undefined' && _AS && _AS.db;
  if (!db) { if (!Array.isArray(_assignMusicTs)) _assignMusicTs = 'err'; return; }
  _assignMusicTsBusy = true;
  const my = ++_assignMusicTsSeq;
  let timer = 0;
  const done = (val, err) => {
    if (my !== _assignMusicTsSeq) return;   // 그 뒤에 다시 읽기 시작함
    clearTimeout(timer);
    _assignMusicTsBusy = false;
    if (err) { console.warn('[ASSIGN-TSONG-1] 선생님 곡', err); if (!Array.isArray(_assignMusicTs)) _assignMusicTs = 'err'; }
    else _assignMusicTs = _assignMusicTsList(val);
    try { _assignMusicTsRefresh(); } catch (e) { console.warn('[ASSIGN-TSONG-1] 다시 그리기', e); }
  };
  timer = setTimeout(() => done(null, '시간 초과'), ASSIGN_MUSIC_TS_WAIT);
  try { db.ref(ASSIGN_MUSIC_TS_PATH).once('value').then(s => done(s.val()), e => done(null, e)); }
  catch (e) { done(null, e); }
}
function assignMusicTsRetry() {
  const d = typeof _AS !== 'undefined' && _AS.draft;
  _assignMusicTsFor = null; _assignMusicTsLoad(d && d.aid ? d.aid : 'list'); _assignMusicTsRefresh();
}
//  다 읽으면 — 목록 · 결과 머리의 곡 이름 · 만들기 창의 둘째 칸만(기본 곡 칸은 안 건드림 — 누르는 사이 클릭이 빠지지 않게 · 같은 모양이면 그대로)
function _assignMusicTsRefresh() {
  if (Array.isArray(_assignMusicTs) && typeof _assignRenderBits === 'function') _assignRenderBits(true);
  const d = typeof _AS !== 'undefined' && _AS.draft, el = document.getElementById('asg-mu-ts');
  if (!d || d.kind !== 'music' || !el) return;
  const html = _assignMusicTsHTML(d.music);
  if (html === _assignMusicTsShown) return;
  _assignMusicTsShown = html; el.innerHTML = html;
  if (String(d.music.song).startsWith('ts_') && typeof _assignCMeta === 'function') _assignCMeta();   // 과제 이름(곡 제목)이 따라감
}
//  선생님 곡인데 다 읽은 목록에 없음 = 음악실에서 지웠거나 곡키가 바뀜
function _assignMusicTsGone(id) { return String(id || '').startsWith('ts_') && Array.isArray(_assignMusicTs) && !_assignMusicTs.some(x => x.id === id); }
function _assignMusicTsGroups(list) {
  const out = [];
  for (const s of list) { const g = out[out.length - 1]; if (g && g.name === s.name) g.songs.push(s); else out.push({ name: s.name, songs: [s] }); }
  return out;
}
//  둘째 칸 — 읽는 중 · 못 읽음(다시 읽기) · 없음 · 곡(제목 · 부분 · ★ · 마디 · 빠르기 / 합주 부분은 한 묶음)
function _assignMusicTsHTML(m) {
  const L = _assignMusicTs;
  const head = n => `<div class="asg-c-row"><span class="text-muted-sm">🎤 선생님 곡(공연 곡)</span><span class="text-muted-sm">음악실 선생님 화면에서 넣은 곡${n ? ` ${n}곡` : ''} · 우리 반 저장소에만 있어요</span></div>`;
  if (!Array.isArray(L)) return head(0) + (L === 'err' && !_assignMusicTsBusy
    ? `<div class="asg-empty">선생님 곡을 읽지 못했어요 <button class="btn-sm outline" onclick="assignMusicTsRetry()">다시 읽기</button></div>`
    : `<div class="asg-empty">선생님 곡을 읽는 중…</div>`);
  if (!L.length) return head(0) + `<div class="asg-empty">아직 넣은 선생님 곡이 없어요 — 음악실 선생님 화면 '🎤 선생님 곡'에서 곡 파일을 넣으면 여기에 떠요</div>`;
  const btn = (s, label) => `<button type="button" class="asg-mu-song asg-mu-tsong${m.song === s.id ? ' on' : ''}" title="곡키 ${escHtml(s.key)}" onclick="assignMusicDraft('song','${escJsAttr(s.id)}')">
      <span class="asg-mu-radio">${m.song === s.id ? '●' : '○'}</span>${label} <span class="asg-mu-star">${'★'.repeat(Math.max(1, Math.min(4, s.level)))}</span><span class="text-muted-sm">${s.bars}마디 · 빠르기 ${s.tempo}</span></button>`;
  const rows = _assignMusicTsGroups(L).map(g => g.songs.length < 2
    ? btn(g.songs[0], `<b>${escHtml(g.name)}</b>${g.songs[0].part ? ' · ' + escHtml(g.songs[0].part) : ''}`)
    : `<div class="asg-mu-ens"><div class="asg-mu-ens-h">🎼 <b>${escHtml(g.name)}</b> <span class="text-muted-sm">합주 · 부분 ${g.songs.length}개 — 부분마다 과제를 따로 만들어 '골라서' 보낼 수 있어요</span></div>
      ${g.songs.map(s => btn(s, `<b>${escHtml(s.part || s.name)}</b>`)).join('')}</div>`).join('');
  return head(L.length) + `<div class="asg-mu-songs">${rows}</div>`;
}
function _assignMusicLevel(key) { return ASSIGN_MUSIC_LEVELS.find(l => l[0] === key) || ASSIGN_MUSIC_LEVELS[0]; }

// ── 고르기 칸 ──
function assignMusicPickerHTML(d) {
  _assignMusicLoad();
  _assignMusicTsLoad(d && d.aid);   // [ASSIGN-TSONG-1] 새 과제마다 한 번
  if (_assignMusicLib === 'err') return `<div class="asg-empty">음악실 곡 목록을 읽지 못했어요 <button class="btn-sm outline" onclick="assignMusicRetry()">다시 읽기</button></div>`;
  if (!Array.isArray(_assignMusicLib)) return `<div class="asg-empty">음악실 곡 목록을 읽는 중…</div>`;
  const m = d.music, lv = _assignMusicLevel(m.level);
  const stars = s => s.practice ? '<span class="asg-chip">연습곡</span>' : `<span class="asg-mu-star">${'★'.repeat(Math.max(1, Math.min(4, s.level)))}</span>`;
  const songs = _assignMusicLib.map(s => `<button type="button" class="asg-mu-song${m.song === s.id ? ' on' : ''}" onclick="assignMusicDraft('song','${escJsAttr(s.id)}')">
      <span class="asg-mu-radio">${m.song === s.id ? '●' : '○'}</span><b>${escHtml(s.title)}</b> ${stars(s)}<span class="text-muted-sm">${escHtml(s.origin)} · ${s.beats}박</span></button>`).join('');
  const seg = (key, val, label, on) => `<button class="asg-seg${on ? ' on' : ''}" onclick="assignMusicDraft('${key}','${val}')">${label}</button>`;
  const ts = _assignMusicTsShown = _assignMusicTsHTML(m);
  return `<div class="asg-mu">
    <div class="asg-c-row"><span class="text-muted-sm">곡</span><span class="text-muted-sm">★ = 곡이 어려운 정도 · 기본 곡 ${_assignMusicLib.length}곡</span></div>
    <div class="asg-mu-songs">${songs}</div>
    <div id="asg-mu-ts" class="asg-mu-ts">${ts}</div>
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
  if (key === 'song') m.song = AssignCore.musicSongOK(String(val)) ? String(val) : '';   // lib_ · ts_ 둘만 [ASSIGN-TSONG-1]
  if (key === 'level') m.level = ASSIGN_MUSIC_LEVELS.some(l => l[0] === val) ? val : 'easy';
  if (key === 'keys') m.keys = [4, 6, 8].includes(Number(val)) ? Number(val) : 0;
  if (key === 'tempo') m.tempo = Number(val) === 0.8 ? 0.8 : 1;
  _assignMusicRefresh(true);
}
//  과제 이름 — '리듬 · 나비야 · 쉬움'(조금 느리게면 덧붙임)
function assignMusicAutoTitle(d) {
  const m = d.music;
  if (!m.song) return '음악실 리듬';
  return `리듬 · ${assignMusicSongTitle(m.song)} · ${_assignMusicLevel(m.level)[1]}${m.tempo === 0.8 ? ' · 느리게' : ''}`;
}
//  목록 줄 머리
function assignMusicKindLabel(def) {
  if (_assignMusicLib === null) _assignMusicLoad();   // 쪽을 새로 열면 곡 목록이 아직 없다 — 읽고 나서 다시 그림(_assignMusicRefresh) [검토 반영]
  const m = def.content.music, lv = _assignMusicLevel(m.level), ts = String(m.song).startsWith('ts_');
  if (ts && _assignMusicTs === null) _assignMusicTsLoad('list');   // [ASSIGN-TSONG-1] 선생님 곡 이름도 — 읽고 나서 다시 그림(_assignMusicTsRefresh)
  return `🎵 리듬 · ${ts ? '🎤 ' : ''}${escHtml(assignMusicSongTitle(m.song))}${_assignMusicTsGone(m.song) ? ' <span class="asg-warn">음악실에 없는 곡</span>' : ''} · ${lv[1]} · ${m.keys || lv[2]}키${m.tempo === 0.8 ? ' · 조금 느리게' : ''}`;
}

// ── 결과 ──
function _assignMusicBest(r) { const b = r && r.detail && r.detail.best; return b && typeof b === 'object' ? b : null; }
function _assignMusicFirst(r) { const b = r && r.detail && r.detail.first; return b && typeof b === 'object' ? b : null; }
//  반 요약 — 끝낸 아이 등급별 수 · 정확도 평균(끝낸 아이) · 친 아이 수
//   평균은 AssignCore.avgOf 한 셈(TV · 관리 결과 머리와 같은 숫자) [ASSIGN-AVG-1]
function assignMusicSummary(t) {
  const g = {}; let n = 0;
  for (const r of t.rows) {
    const b = _assignMusicBest(r);
    if (!b || r.status !== 'done') continue;
    const k = ASSIGN_MUSIC_GRADES.includes(b.grade) ? b.grade : 'D';
    g[k] = (g[k] || 0) + 1; n++;
  }
  const a = AssignCore.avgOf({ kind: 'music', n: 1 }, t);
  return { grades: g, avg: a ? a.v : null, n };
}
function _assignMusicGradeChips(sum) {
  return ASSIGN_MUSIC_GRADES.filter(k => sum.grades[k]).map(k => `<span class="asg-dist-chip asg-mu-g g-${k}">${k} ${sum.grades[k]}</span>`).join('');
}
//  수업 띠(각자 풀기) 한 줄
function assignMusicLiveHTML(def, t) {
  const s = assignMusicSummary(t);
  return `<div class="asg-live-row"><span class="text-muted-sm">끝까지 친 아이</span> <b>${s.n}</b>${s.avg != null ? ` · 정확도 평균 <b>${s.avg}%</b>` : ''} ${_assignMusicGradeChips(s)}</div>`;
}
//  결과 칸 — 판정 = 완벽 · 좋아 · 괜찮아 · 놓침 · 정확도 = 가장 좋은 판(보스 결정 10-05) · 처음 판도 같이 · 아이 기기가 쓴 값이라 수는 Number 로만
function _assignMusicCols() { return ['<th>정확도</th>', '<th>판정</th>', '<th>최대 콤보</th>', '<th>처음 판</th>', '<th>친 횟수</th>', '<th>걸린 시간</th>']; }
function _assignMusicCells(r) {
  const b = _assignMusicBest(r), f = _assignMusicFirst(r);
  const J = b ? `<span class="asg-mu-j"><i class="p">${Number(b.perfect) || 0}</i><i class="g">${Number(b.great) || 0}</i><i class="o">${Number(b.good) || 0}</i><i class="m">${Number(b.miss) || 0}</i></span>` : '-';
  return `<td class="nowrap">${b ? `<b>${Number(b.acc) || 0}%</b> <span class="asg-mu-g g-${escHtml(b.grade)}">${escHtml(b.grade)}</span>` : '-'}</td>
      <td class="nowrap">${J}</td><td>${b ? Number(b.maxCombo) || 0 : '-'}</td>
      <td class="nowrap">${f ? `${Number(f.acc) || 0}% (${escHtml(f.grade)})` : '-'}</td>
      <td>${r.attempts || 0}</td><td class="nowrap">${r.ms == null ? '-' : _assignMs(r.ms)}</td>`;
}
//  표 위 한 줄(이름 가리기 중엔 틀이 숨김)
function _assignMusicTop(def, t) {
  const s = assignMusicSummary(t);
  return `<div class="asg-mu-sum">끝까지 친 아이 <b>${s.n}</b> / ${t.rows.length}${s.avg != null ? ` · 정확도 평균 <b>${s.avg}%</b>` : ''} ${_assignMusicGradeChips(s)}
      <span class="text-muted-sm">판정 = <i class="asg-mu-k p">완벽</i><i class="asg-mu-k g">좋아</i><i class="asg-mu-k o">괜찮아</i><i class="asg-mu-k m">놓침</i> · 정확도 = 가장 좋은 판</span></div>`;
}

// ── 공용 틀에 달기 [ASSIGN-APPS-1] ──
if (typeof ASSIGN_APPS !== 'undefined') ASSIGN_APPS.music = {
  cls: 'mu', preload: _assignMusicLoad, picker: assignMusicPickerHTML,
  build: d => !d.music.song ? { err: '곡을 골라 주세요' } : _assignMusicTsGone(d.music.song) ? { err: '고른 선생님 곡이 음악실에 없어요 — 다시 골라 주세요' } : { content: { music: { ...d.music } } },
  autoTitle: assignMusicAutoTitle, what: assignMusicKindLabel,
  cols: _assignMusicCols, cells: _assignMusicCells, top: _assignMusicTop, liveRow: assignMusicLiveHTML,
  liveCtl: '아이들이 각자 그 곡을 쳐요 · 끝까지 친 아이는 더 쳐도 되고, 선생님이 끝낼 때까지 기다려요',
  selfNote: '아이마다 그 곡을 쳐요 · 끝까지 친 아이는 더 쳐도 되고, 선생님이 끝낼 때까지 기다려요', startNote: '덮개 안에서 그 곡 리듬이 열리고, 가장 좋은 기록이 남아요',
};
