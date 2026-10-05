// 수업 TV [ASSIGN-TV-1] — 교실 TV 에 띄우는 창. 관리 화면 [📺 TV 화면 열기] 또는 교실 컴퓨터에서 funclassrpg.kr/assign/ (관리자 비밀번호 한 번)
//  #/      = 지금 수업을 따라감(한 번 열어 두면 수업마다 알아서) · #/a/<과제> = 과제 하나의 정리(과제함 결과를 반 전체와 볼 때)
//  · 읽는 곳 = classRPG_assign(live · open · results · presence) · 쓰는 곳 = 교사 기기 연결 표시(hosts) + 선생님 조작(키 · 단추) 때 live transaction
//  · 이름은 기본 숨김 — 켜도 '누가 다 했나'까지만(점수 · 오답 낸 이름 · 걸린 시간은 TV 에 안 나옴)
//  · 글은 모두 textContent(h) — innerHTML 은 figures.js 그림 하나(그 안에서 글자를 escape)
import { h, toast } from '../../common/util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';
import '../../common/assign-core.js';

const AC = globalThis.AssignCore;
const app = document.getElementById('app');
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
const S = { db: null, live: null, openRaw: {}, open: {}, hosts: null, offset: 0, results: {}, presence: {}, shown: '', offs: [], archDef: null, hostN: 0, hostRef: null, wake: null, raf: 0, lastKey: '' };
const now = () => Date.now() + (S.offset || 0);
const ref = p => S.db.ref(AC.path.full(p));

// ── 문 ──
async function gate() {
  try { if (sessionStorage.getItem('assign.teacher') === '1') return true; } catch (e) {}
  for (let k = 0; k < 3; k++) {
    const pw = prompt('수업 TV 는 선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
    if (!pw) return false;
    try { if (await adminPwOK(S.db, pw)) { try { sessionStorage.setItem('assign.teacher', '1'); } catch (e) {} return true; } } catch (e) { console.warn(e); }
    toast('비밀번호가 맞지 않아요');
  }
  return false;
}

async function boot() {
  if (!globalThis.firebase) { app.replaceChildren(h('div', { class: 'tv-msg' }, '연결 도구를 불러오지 못했어요. 새로고침해 주세요.')); return; }
  S.db = rpgDb(globalThis.firebase);
  if (!await gate()) { app.replaceChildren(h('div', { class: 'tv-msg' }, h('div', { class: 'tv-big' }, '🔒'), '선생님 비밀번호가 있어야 열려요')); return; }
  const on = (p, cb, raw) => { const r = raw ? S.db.ref(p) : ref(p); r.on('value', s => { try { cb(s.val()); } catch (e) { console.warn(e); } }); };
  on('.info/serverTimeOffset', v => { S.offset = Number(v) || 0; }, true);
  on('.info/connected', v => { if (v === true) hostOn(); draw(); }, true);
  on(AC.path.live, v => { S.live = v; follow(); wake(); draw(); });
  on(AC.path.hosts, v => { S.hosts = v; draw(); });
  on('open', v => { S.openRaw = v && typeof v === 'object' ? v : {}; S.open = {}; for (const k of Object.keys(S.openRaw)) { const d = AC.normDef(S.openRaw[k], k); if (d) S.open[k] = d; } follow(); draw(); });
  addEventListener('hashchange', () => { follow(); draw(); });
  addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  document.addEventListener('mousemove', () => { document.body.classList.add('tv-ctl-on'); clearTimeout(S.ctlT); S.ctlT = setTimeout(() => document.body.classList.remove('tv-ctl-on'), 3000); });
  setInterval(draw, 15000);
  draw();
}
//  교사 기기 연결 — TV 가 켜져 있으면 관리 화면을 닫아도 수업이 이어진다(이어질 때마다 새 칸)
function hostOn() {
  try {
    if (S.hostRef) { try { S.hostRef.onDisconnect().cancel(); } catch (e) {} }
    const r = ref(AC.path.host('tv' + Math.random().toString(36).slice(2, 7) + '-' + (++S.hostN)));
    r.onDisconnect().update({ on: false, left: globalThis.firebase.database.ServerValue.TIMESTAMP });
    r.set({ on: true, at: globalThis.firebase.database.ServerValue.TIMESTAMP, w: 'tv' }).catch(() => {});
    S.hostRef = r;
  } catch (e) { console.warn(e); }
}
async function wake() {
  const want = !!(S.live && S.live.on);
  try {
    if (want && !S.wake && navigator.wakeLock && document.visibilityState === 'visible') { S.wake = await navigator.wakeLock.request('screen'); S.wake.addEventListener('release', () => { S.wake = null; }); }
    if (!want && S.wake) { const w = S.wake; S.wake = null; await w.release(); }
  } catch (e) {}
}

// ── 무엇을 보이나 ──
function routeAid() { const m = /^#\/a\/([\w-]{1,40})$/.exec(location.hash || ''); return m ? m[1] : ''; }
function liveOn() { return !!(S.live && S.live.on === true && AC.safeAid(S.live.aid)); }
function follow() {
  const want = routeAid() || (liveOn() ? S.live.aid : '');
  if (want === S.shown) return;
  S.offs.forEach(f => f()); S.offs = []; S.results = {}; S.presence = {}; S.archDef = null;
  S.shown = want;
  if (!want) return;
  const sub = (p, cb) => { const r = ref(p); const f = r.on('value', s => { cb(s.val()); draw(); }); S.offs.push(() => r.off('value', f)); };
  sub(AC.path.results(want), v => { S.results = v || {}; });
  sub(AC.path.presenceAll(want), v => { S.presence = v || {}; });
  if (!S.open[want]) ref(AC.path.archive(want)).once('value').then(s => { S.archDef = AC.normDef(s.val(), want); draw(); }).catch(() => {});
}
function shownDef() { return S.open[S.shown] || S.archDef || null; }
function roster(def) {
  const ids = def.targets || Object.keys(def.roster || {});
  return ids.filter(sid => AC.safeKey(sid)).map(sid => ({ sid, name: (def.roster || {})[sid] || '' })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
function draw() { if (S.raf) return; S.raf = requestAnimationFrame(() => { S.raf = 0; try { render(); } catch (e) { console.error(e); } }); }

function render() {
  const def = shownDef(), live = S.live, isLive = liveOn() && def && live.aid === def.id && !routeAid();
  let view;
  if (!def) view = idle();
  else if (!isLive) view = summaryView(def, null);
  else if (def.kind !== 'quiz') view = appView(def);
  else if (live.pacing === 'step') view = stepView(def, live);
  else view = selfView(def, live);
  app.replaceChildren(view, controls(def, isLive));
}

// ── 화면들 ──
function head(def, right) {
  return h('header', { class: 'tv-head' }, h('span', { class: 'tv-badge' }, liveOn() && def && S.live.aid === def.id ? '👩‍🏫 수업 중' : '📺 수업 TV'),
    h('span', { class: 'tv-title' }, def ? def.title : ''), right ? h('span', { class: 'tv-right' }, right) : null);
}
function idle() {
  const list = Object.values(S.open).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return h('main', { class: 'tv tv-idle' }, head(null),
    h('div', { class: 'tv-center' }, h('div', { class: 'tv-big' }, '📺'), h('div', { class: 'tv-h1' }, '선생님이 수업을 시작하면 여기에 떠요'),
      list.length ? h('div', { class: 'tv-list' }, h('div', { class: 'tv-sub' }, '열린 과제 — 누르면 정리를 봐요'),
        ...list.slice(0, 6).map(d => h('button', { class: 'tv-list-btn', onclick: () => { location.hash = '#/a/' + d.id; } }, d.title))) : null));
}
function presentCount(def) { const P = S.presence || {}; return roster(def).filter(x => P[x.sid] && Object.keys(P[x.sid]).length).length; }
function lobbyView(def) {
  return h('main', { class: 'tv' }, head(def), h('div', { class: 'tv-center' }, h('div', { class: 'tv-big tv-bob' }, '🙋'),
    h('div', { class: 'tv-h1' }, '곧 시작해요'), h('div', { class: 'tv-sub' }, `들어온 친구 ${presentCount(def)} / ${roster(def).length}`)));
}
function qBlock(def, i) {
  const it = def.content.quiz.items[i];
  const psg = it.passageId ? def.content.quiz.passages[it.passageId] : null;
  const fig = it.fig && globalThis.Figures ? h('div', { class: 'tv-fig', html: globalThis.Figures.render(it.fig) }) : null;
  return h('div', { class: 'tv-q' },
    psg ? h('div', { class: 'tv-psg' }, h('b', {}, '📖 ' + (psg.title || '지문')), h('div', { class: 'tv-psg-text' }, psg.text || '')) : null,
    fig, h('div', { class: 'tv-q-text' }, it.q),
    it.audio ? h('button', { class: 'tv-audio', onclick: () => speak(it) }, '🔊 들려주기') : null);
}
function speak(it) {
  try {
    const u = new SpeechSynthesisUtterance(String(it.audio)); u.lang = AC.itemLang(it); u.rate = it.cat === 'dictation' ? 0.8 : 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { toast('이 기기에서는 소리가 나오지 않아요'); }
}
function choiceRows(def, i, stats, reveal) {
  const it = def.content.quiz.items[i];
  if (it.type !== 'choice') return null;
  const max = Math.max(1, ...stats.dist.map(d => d.c)), tot = Math.max(1, stats.n);
  const ox = AC.isOX(it);
  return h('div', { class: 'tv-choices' + (reveal ? ' reveal' : '') }, ...it.choices.map((c, ci) => {
    const d = stats.dist[ci] || { c: 0, ok: false };
    const top = reveal && stats.topWrong && stats.topWrong.ci === ci;
    return h('div', { class: 'tv-ch' + (reveal && d.ok ? ' ok' : '') + (top ? ' top' : '') },
      h('span', { class: 'tv-ch-n' }, ox ? (c === 'O' ? '⭕' : '❌') : NUM[ci] || String(ci + 1)),
      h('span', { class: 'tv-ch-t' }, ox ? (c === 'O' ? '맞아요' : '틀려요') : c),
      reveal ? h('span', { class: 'tv-ch-bar' }, h('i', { style: { width: Math.round(d.c / max * 100) + '%' } })) : null,
      reveal ? h('span', { class: 'tv-ch-c' }, `${d.c}명 · ${Math.round(d.c / tot * 100)}%`) : null,
      reveal ? h('span', { class: 'tv-ch-ok' }, d.ok ? '✓' : '') : null);
  }));
}
function stepView(def, live) {
  const s = Math.floor(Number(live.step)), ph = String(live.phase || ''), n = def.n;
  if (s < 0 || ph === 'lobby') return lobbyView(def);
  if (s >= n || ph === 'summary') return summaryView(def, live);
  const R = S.results || {}, ros = roster(def), it = def.content.quiz.items[s];
  const stats = AC.itemStats(def, R, s, ros.map(x => x.sid), { revealed: live.revealAt });
  const sent = ros.filter(x => AC.ansAt(R[x.sid], s)).length, present = presentCount(def);
  if (ph === 'reveal') {
    const talk = stats.topWrong ? (it.type === 'choice'
      ? `${AC.isOX(it) ? (stats.topWrong.v === 'O' ? "'맞아요'를" : "'틀려요'를") : NUM[stats.topWrong.ci] + AC.choiceJosa(stats.topWrong.ci)} 고른 친구가 ${stats.topWrong.c}명 — 왜 그렇게 생각했을까요?`
      : `'${stats.topWrong.v}' 라고 쓴 친구가 ${stats.topWrong.c}명 — 왜 그렇게 생각했을까요?`) : '';
    return h('main', { class: 'tv' }, head(def, `${s + 1} / ${n}`),
      h('div', { class: 'tv-body' }, qBlock(def, s),
        it.type === 'choice' ? choiceRows(def, s, stats, true) : textReveal(it, stats),
        talk ? h('div', { class: 'tv-talk' }, talk) : null,
        it.hint ? h('div', { class: 'tv-hint' }, '💡 ' + it.hint) : null,
        h('div', { class: 'tv-sub' }, `낸 친구 ${stats.n}명${stats.rate != null ? ` · 맞힌 친구 ${stats.rate}%` : ''}`)));
  }
  return h('main', { class: 'tv' }, head(def, `${s + 1} / ${n}`),
    h('div', { class: 'tv-body' }, qBlock(def, s),
      it.type === 'choice' ? choiceRows(def, s, stats, false) : h('div', { class: 'tv-sub tv-write' }, it.type === 'fraction' ? '✏️ 분수로 써요' : '✏️ 답을 써요'),
      h('div', { class: 'tv-sent' }, h('div', { class: 'tv-sent-bar' }, h('i', { style: { width: (present ? Math.round(sent / present * 100) : 0) + '%' } })),
        h('b', {}, `냈어요 ${sent} / ${present}`))));
}
function textReveal(it, stats) {
  return h('div', { class: 'tv-text-rev' }, h('div', { class: 'tv-ans' }, h('span', {}, '정답'), h('b', {}, it.a), h('em', {}, `${stats.ok}명`)),
    stats.wrongTop.length ? h('div', { class: 'tv-sub' }, '많이 쓴 다른 답') : null,
    ...stats.wrongTop.map((w, k) => h('div', { class: 'tv-ans other' + (k === 0 && w.c >= 2 ? ' top' : '') }, h('b', {}, w.v), h('em', {}, `${w.c}명`))));
}
function selfView(def, live) {
  if (live.phase === 'summary') return summaryView(def, live);
  const R = S.results || {}, ros = roster(def);
  const t = AC.tally(def, R, ros.map(x => ({ sid: x.sid, name: x.name })), { revealed: live.revealAt || def.revealed });
  const names = !!live.names;
  return h('main', { class: 'tv' }, head(def, '각자 풀기'),
    h('div', { class: 'tv-center' }, h('div', { class: 'tv-h1' }, `다 한 친구 ${t.counts.done} / ${t.rows.length}`),
      h('div', { class: 'tv-dots' }, ...t.rows.map(r => names
        ? h('span', { class: 'tv-name ' + r.status }, (r.status === 'done' ? '✓ ' : '') + (r.name || ''))
        : h('span', { class: 'tv-dot ' + r.status, title: r.status === 'done' ? '다 함' : r.status === 'doing' ? '하는 중' : '아직' }))),
      h('div', { class: 'tv-legend' }, '● 다 함 · ◐ 하는 중 · ○ 아직')));
}
//  정리 — 문제별 맞힌 비율 막대 · 가장 어려웠던 문제 · 막대를 누르면 그 문제(수업 중 한 문제씩이면 아이 화면도 그 문제 공개로)
function summaryView(def, live) {
  if (def.kind !== 'quiz') return appView(def);
  const R = S.results || {}, ros = roster(def);
  const t = AC.tally(def, R, ros.map(x => ({ sid: x.sid, name: x.name })), { revealed: (live && live.revealAt) || def.revealed });
  const sel = S.pickItem != null && S.pickItem < def.n ? S.pickItem : -1;
  if (sel >= 0) {
    const it = def.content.quiz.items[sel], st = t.items[sel];
    return h('main', { class: 'tv' }, head(def, `${sel + 1}번 다시 보기`),
      h('div', { class: 'tv-body' }, qBlock(def, sel), it.type === 'choice' ? choiceRows(def, sel, st, true) : textReveal(it, st),
        h('button', { class: 'tv-list-btn', onclick: () => { S.pickItem = null; draw(); } }, '← 정리로')));
  }
  return h('main', { class: 'tv' }, head(def, live ? '정리' : '과제 정리'),
    h('div', { class: 'tv-body' }, h('div', { class: 'tv-sub' }, `끝낸 친구 ${t.counts.done} / ${t.rows.length}${t.hardest >= 0 ? ` · 가장 어려웠던 문제 ${t.hardest + 1}번` : ''}`),
      h('div', { class: 'tv-rates' }, ...t.items.map(s => h('button', { class: 'tv-rate' + (s.i === t.hardest ? ' hard' : ''), onclick: () => pickItem(def, live, s.i) },
        h('span', { class: 'tv-rate-n' }, `${s.i + 1}번`), h('span', { class: 'tv-rate-bar' }, h('i', { style: { width: (s.rate == null ? 0 : s.rate) + '%' } })),
        h('span', { class: 'tv-rate-v' }, s.rate == null ? '—' : s.rate + '%'))))));
}
function pickItem(def, live, i) {
  if (live && live.on && live.pacing === 'step' && live.aid === def.id) { tx(AC.ctl.goto(live.aid, Math.floor(Number(live.step)), String(live.phase || ''), i), '문제 보기'); return; }
  S.pickItem = i; draw();
}
function appView(def) {
  const R = S.results || {}, ros = roster(def);
  const t = AC.tally(def, R, ros.map(x => ({ sid: x.sid, name: x.name })), {});
  return h('main', { class: 'tv' }, head(def, def.kind === 'coding' ? '기초 코딩' : '음악실 리듬'),
    h('div', { class: 'tv-center' }, h('div', { class: 'tv-h1' }, `끝낸 친구 ${t.counts.done} / ${t.rows.length}`), h('div', { class: 'tv-sub' }, `하는 중 ${t.counts.doing}`)));
}

// ── 선생님 조작(TV 에서 — 관리 화면과 같은 transaction) ──
function tx(fn, what) {
  //  [ASSIGN-END-INBOX-1] committed 를 돌려준다 — 끝내기가 안 됐는데 과제를 닫는 일이 없게
  return ref(AC.path.live).transaction(cur => fn(cur)).then(r => { if (!r.committed) toast(what + ' — 이미 바뀌었어요'); return !!r.committed; }).catch(() => { toast(what + '이 안 됐어요 — 다시 눌러 주세요'); return false; });
}
function act(kind) {
  const l = S.live, def = shownDef();
  if (!liveOn() || !def || l.aid !== def.id) return;
  const s = Math.floor(Number(l.step)), ph = String(l.phase || '');
  if (kind === 'next') tx(l.pacing === 'step' ? AC.ctl.next(l.aid, s, ph, def.n, now()) : AC.ctl.summary(l.aid, s, ph, def.n), '다음');
  if (kind === 'prev') tx(AC.ctl.prev(l.aid, s, ph), '앞');
  if (kind === 'reveal') tx(AC.ctl.reveal(l.aid, s, now()), '답 공개');
  if (kind === 'names') ref('live/names').set(!l.names).catch(() => {});
  //  [ASSIGN-END-INBOX-1] 과제함에서 돌린 수업(fromInbox)은 과제함으로 되돌리고, 아니면 과제도 닫는다(관리 화면 '끝내기'와 같게) · 끝내기가 된 때만
  if (kind === 'end') {
    const raw = S.openRaw[l.aid], back = !!(raw && raw.fromInbox), aid = l.aid, revealAt = l.revealAt || null;
    if (!confirm(back ? '수업을 끝낼까요? 아이 화면의 수업 방이 닫혀요.\n이 과제는 원래대로 과제함에 남아요.'
      : '수업을 끝낼까요? 아이 화면의 수업 방이 닫히고 이 과제도 닫혀요.\n(못 한 아이에게 과제함으로 남기려면 관리 화면에서 끝내 주세요)')) return;
    tx(AC.ctl.end(aid, now()), '끝내기').then(ok => {
      if (!ok || !raw) return;
      const u = back ? { [`open/${aid}/deliver`]: 'inbox', [`open/${aid}/pacing`]: 'self', [`open/${aid}/fromInbox`]: null, [`open/${aid}/revealed`]: revealAt }
        : { [`open/${aid}`]: null, [`archive/${aid}`]: { ...raw, closedAt: globalThis.firebase.database.ServerValue.TIMESTAMP } };
      return ref('').update(u).catch(() => {});
    });
  }
}
function onKey(e) {
  if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
  const k = e.key;
  if (k === 'ArrowRight') { e.preventDefault(); act('next'); }
  else if (k === 'ArrowLeft') { e.preventDefault(); act('prev'); }
  else if (k === ' ') { e.preventDefault(); act('reveal'); }
  else if (k === 'n' || k === 'N' || k === 'ㅜ') act('names');
  else if (k === 'f' || k === 'F' || k === 'ㄹ') { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (er) {} }
  else if (k === 'e' || k === 'E' || k === 'ㄷ') act('end');
  else if (k === 'Escape' && S.pickItem != null) { S.pickItem = null; draw(); }
}
function controls(def, isLive) {
  const l = S.live;
  const step = isLive && l.pacing === 'step';
  return h('nav', { class: 'tv-ctl' },
    routeAid() ? h('button', { onclick: () => { location.hash = '#/'; } }, '← 지금 수업') : null,
    step ? h('button', { onclick: () => act('prev') }, '◀ 앞') : null,
    step && l.phase === 'answer' ? h('button', { onclick: () => act('reveal') }, '답 공개 (Space)') : null,
    isLive ? h('button', { onclick: () => act('next') }, step ? '다음 ▶' : '결과 보기') : null,
    isLive ? h('button', { onclick: () => act('names') }, l.names ? '이름 숨기기 (N)' : '이름 보이기 (N)') : null,
    h('button', { onclick: () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (er) {} } }, '전체 화면 (F)'),
    isLive ? h('button', { class: 'danger', onclick: () => act('end') }, '끝내기 (E)') : null);
}

boot();
