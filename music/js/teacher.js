// 선생님 화면 — 아이별 곡 · 리코더 연습 횟수 · 음악회에서 내리기/다시 올리기. 관리자 비밀번호로 연다(생각판과 같은 방식).
//  쓰는 것은 음악회 목록의 숨김 표시(concert/<키>/hide) + 선생님 곡(tsongs/<곡키> — 맨 위 칸)뿐. 아이 곡은 고치지 않는다.
//  [MUSIC-BEAT-1] 아이별 비트 수 · 비트 줄(열어 보기 = 듣기만) · 우리 반 비트 모음에서 내리기(beatclass/<키>/hide)
import { h, toast, modal } from './util.js';
import { teacherGate } from '../../common/teacher-gate.js';
import { rosterFor, rosterNames, rosterRows } from '../../common/roster.js';   // 반 명단 — 곡 · 연습 기록 없는 아이도 [APP-ROSTER-1]
import { normalize, fromTeacherSong, cleanTeacherSong, teacherSongsIn } from './song.js';
import { renderStaff } from './notation.js';
import { meterOf } from './theory.js';
import { recorderOK } from './recorder.js';
import { songBad, hidden, badWords } from './safety.js';
import { normalizeBeat, usedCount } from './beatcore.js';   // [MUSIC-BEAT-1]
import { ensembleReport } from './ensemble.js';   // [MUSIC-ENSEMBLE-1] 합주 묶음 알림

// 선생님 화면 문 — 손님 · 이 창에서 통과('music.teacher') · 아니면 관리자 비밀번호(하위 앱 공통 common/teacher-gate.js) [SUBAPP-COMMON-1]
function gate(ctx) { return teacherGate(ctx, 'music.teacher'); }

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  //  [MUSIC-TSONG-1] 맨 위 = 선생님 곡 칸(아이 기록이 없어도 · 아래 아이 칸과 따로 그림 — 어느 한쪽이 망가져도 다른 쪽은 쓸 수 있게)
  const tsCard = h('section', { class: 'tk ts-card' });
  const box = h('div', {}, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('음악실 · 선생님', { back: '#/' }), h('div', { class: 'view' }, h('div', { class: 'pick teacher' }, tsCard, box)));
  try { teacherSongsCard(tsCard, ctx); } catch (e) { console.warn('[MUSIC-TSONG-1]', e); tsCard.replaceChildren(h('div', { class: 'empty' }, '선생님 곡 칸을 열지 못했어요.')); }
  try { await kidsSection(box, ctx); } catch (e) { console.warn('[music teacher]', e); box.replaceChildren(h('div', { class: 'empty' }, '아이 기록을 불러오지 못했어요. 다시 열어 보세요.')); }
  return { unmount() {} };
}

// 아이별 곡 · 연습 칸(예전 선생님 화면 그대로)
async function kidsSection(box, ctx) {
  //  [MUSIC-BEAT-1] 비트는 못 읽어도 곡 · 연습 칸은 그대로
  const quiet = p => Promise.resolve().then(p).catch(e => { console.warn('[MUSIC-BEAT-1]', e); return null; });
  const [songs, practice, concert, roster, beats, beatClass] = await Promise.all([ctx.store.allSongs(), ctx.store.allPractice(), ctx.store.allConcert(), rosterFor(ctx.store),
    quiet(() => ctx.store.allBeats && ctx.store.allBeats()), quiet(() => ctx.store.allBeatClass && ctx.store.allBeatClass())]);
  const hiddenSet = new Set(concert.filter(c => c.hide).map(c => c.sid + '_' + c.id));   // [MUSIC-T-HIDDEN-1] 이름이 고운 말 가리기 함수 hidden 을 가려, 걸린 곡이 있으면 화면이 TypeError 로 안 그려졌다
  const bc = (Array.isArray(beatClass) ? beatClass : []).filter(c => c && c.sid && c.id);
  const beatPub = new Set(bc.map(c => c.sid + '_' + c.id)), beatHidden = new Set(bc.filter(c => c.hide).map(c => c.sid + '_' + c.id));
  const kids = new Map();
  const kid = sid => { if (!kids.has(sid)) kids.set(sid, { sid, name: '', songs: [], beats: [], practice: 0, last: 0 }); return kids.get(sid); };
  for (const [sid, list] of Object.entries(songs || {})) for (const raw of Object.values(list || {})) { const k = kid(sid); const s = normalize(raw); k.songs.push(s); k.name = k.name || raw.byName || ''; k.last = Math.max(k.last, raw.updated || 0); }
  for (const [sid, list] of Object.entries(practice || {})) for (const p of Object.values(list || {})) { const k = kid(sid); k.practice += p.n || 0; k.last = Math.max(k.last, p.last || 0); }
  for (const [sid, list] of Object.entries(beats && typeof beats === 'object' ? beats : {})) for (const raw of Object.values(list && typeof list === 'object' ? list : {})) {
    if (!raw || typeof raw !== 'object') continue;
    const k = kid(sid), b = normalizeBeat(raw); if (!b.id) continue;
    k.beats.push(b); k.name = k.name || b.byName || ''; k.last = Math.max(k.last, b.updated || 0);
  }
  //  이름 = 반 명단 이름(RPG 에서 고쳤으면 새 이름) · 없으면 곡에 적힌 이름 [APP-ROSTER-1]
  const rn = rosterNames({}, roster);
  for (const k of kids.values()) k.name = rn[k.sid] || k.name;
  const rows = [...kids.values()].sort((a, z) => (a.name || a.sid).localeCompare(z.name || z.sid, 'ko'));
  //  명단에만 있는 아이 = 곡도 리코더 연습도 아직 없는 아이 — 맨 아래 회색 칸에 이름만(리듬 놀이 · 이론 놀이는 여기 셈에 없다) [APP-ROSTER-1]
  const idle = [...rosterRows(rows.map(k => k.sid), roster).idle].map(sid => rn[sid] || sid);
  const day = t => t ? `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}` : '-';
  if (!rows.length && !idle.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 곡을 짓거나 연습하지 않았어요.')); return; }
  box.replaceChildren(
    h('p', { class: 'muted', style: { marginBottom: '10px' } }, `아이 ${rows.length}명${idle.length ? ` · 아직 곡 · 연습이 없는 아이 ${idle.length}명(맨 아래)` : ''} · 곡 ${rows.reduce((a, k) => a + k.songs.length, 0)}개 · 비트 ${rows.reduce((a, k) => a + k.beats.length, 0)}개 · 리코더 연습 ${rows.reduce((a, k) => a + k.practice, 0)}번. 음악회 · 비트 모음에 올린 것은 '내리기'로 숨길 수 있어요(지워지지 않아요).`),
    h('div', { class: 'list' }, ...rows.map(k => h('div', { class: 'tk' },
      h('div', { class: 'tk-head' }, h('b', {}, k.name || k.sid), h('span', { class: 'muted' }, `곡 ${k.songs.length} · 비트 ${k.beats.length} · 연습 ${k.practice}번 · 마지막 ${day(k.last)}`)),
      ...k.songs.sort((a, z) => (z.updated || 0) - (a.updated || 0)).map(s => {
        const ck = k.sid + '_' + s.id, isHidden = hiddenSet.has(ck);
        const play = h('button', { class: 'play-i', onclick: () => ctx.listen(s, play) });
        const hideBtn = s.pub ? h('button', { class: 'btn small' + (isHidden ? ' on' : ''), onclick: async () => {
          const nowHidden = !hiddenSet.has(ck);
          try { await ctx.store.setHidden(k.sid, s.id, nowHidden); nowHidden ? hiddenSet.add(ck) : hiddenSet.delete(ck); hideBtn.textContent = nowHidden ? '다시 올리기' : '음악회에서 내리기'; hideBtn.classList.toggle('on', nowHidden); toast(nowHidden ? '음악회에서 내렸어요' : '다시 올렸어요'); }
          catch (e) { console.warn(e); toast('바꾸지 못했어요'); }
        } }, isHidden ? '다시 올리기' : '음악회에서 내리기') : h('span', { class: 'muted', style: { fontSize: '.8rem' } }, '나만 보기');
        const bad = songBad(s), badAll = [...bad.title, ...bad.lyrics];
        return h('div', { class: 'song-row' }, h('div', { class: 't' }, h('b', {}, s.title || '제목 없는 곡', badAll.length ? h('span', { class: 'bad-tag', title: '음악회에는 안 올라가요' }, '고운 말 확인: ' + badAll.map(hidden).join(', ')) : null), h('span', {}, `${meterOf(s).key} · ${s.bars}마디 · 음 ${s.notes.length}개 · 고친 때 ${day(s.updated)} · ${s.rev || 1}번 저장`)),
          h('div', { class: 'acts' }, play, h('button', { class: 'btn small', onclick: () => { const { el } = renderStaff(s, { width: Math.min(1040, innerWidth - 90) }); modal(`${s.title || '곡'} — ${k.name || ''}`, el, [{ label: '닫기', primary: true }], { wide: true }); } }, '악보'), hideBtn));
      }),
      ...k.beats.sort((a, z) => (z.updated || 0) - (a.updated || 0)).map(b => beatRowT(k, b, ctx, beatPub, beatHidden, day)))),
      idle.length ? h('div', { class: 'tk idle' }, h('div', { class: 'tk-head' }, h('b', { class: 'muted' }, '아직 안 했어요'), h('span', { class: 'muted' }, `곡 · 리코더 연습 기록이 없는 아이 ${idle.length}명`)),
        h('div', { class: 'muted' }, idle.join(' · '))) : null));
}

//  [MUSIC-BEAT-1] 아이 비트 한 줄 — 열어 보기(비트 화면 · 듣기만) · 비트 모음에 올렸으면 내리기/다시 올리기
function beatRowT(k, b, ctx, pub, hiddenB, day) {
  const ck = k.sid + '_' + b.id, bad = badWords(b.title);
  const hideBtn = pub.has(ck) ? h('button', { class: 'btn small' + (hiddenB.has(ck) ? ' on' : ''), onclick: async () => {
    const now = !hiddenB.has(ck);
    try { await ctx.store.setBeatHidden(k.sid, b.id, now); now ? hiddenB.add(ck) : hiddenB.delete(ck); hideBtn.textContent = now ? '다시 올리기' : '비트 모음에서 내리기'; hideBtn.classList.toggle('on', now); toast(now ? '비트 모음에서 내렸어요' : '다시 올렸어요'); }
    catch (e) { console.warn(e); toast('바꾸지 못했어요'); }
  } }, hiddenB.has(ck) ? '다시 올리기' : '비트 모음에서 내리기') : h('span', { class: 'muted', style: { fontSize: '.8rem' } }, '나만 보기');
  return h('div', { class: 'song-row' }, h('div', { class: 't' }, h('b', {}, '🥁 ' + (b.title || '이름 없는 비트'), bad.length ? h('span', { class: 'bad-tag', title: '비트 모음에는 안 올라가요' }, '고운 말 확인: ' + bad.map(hidden).join(', ')) : null),
    h('span', {}, `비트 · 빠르기 ${b.bpm} · 패턴 ${usedCount(b)}개 · 고친 때 ${day(b.updated)} · ${b.rev || 1}번 저장`)),
    h('div', { class: 'acts' }, h('button', { class: 'btn small', onclick: () => ctx.go(`#/beat/u.${k.sid}.${b.id}`) }, '열어 보기'), hideBtn));
}

// ── 선생님 곡(공연 곡) [MUSIC-TSONG-1] ──
//  악보를 옮긴 곡 파일(.json · 곡 하나 / 곡 배열 / { kind: 'rpg-music-song', v: 1, songs }) → 곡마다 살피고(song.js cleanTeacherSong) → 반 저장소 tsongs/<곡키>.
//  같은 곡키 = 바꿔 넣기. 아이 '리코더 연습 · 리듬 게임' 고르기 첫 칸에 뜬다. 곡 파일은 공개 저장소에 넣지 않는다(저작권).
const TS_FILE_MAX = 1000000;   // 곡 파일 하나 1MB 까지(가락 글은 곡마다 4만 자까지)
function teacherSongsCard(el, ctx) {
  const list = h('div', { class: 'list' }, h('div', { class: 'empty' }, '불러오는 중…'));
  const note = h('p', { class: 'ts-note', style: { display: 'none' } });
  const input = h('input', { type: 'file', multiple: true, accept: '.json,application/json', style: { display: 'none' },
    onchange: () => { const files = [...(input.files || [])]; input.value = ''; if (files.length) importFiles(files); } });
  const pickBtn = h('button', { class: 'btn small primary', onclick: () => input.click() }, '곡 파일 고르기');
  el.replaceChildren(
    h('div', { class: 'ts-head' }, h('b', {}, '🎤 선생님 곡 · 공연 곡'), pickBtn, input),
    h('p', { class: 'muted ts-help' }, "악보를 옮긴 곡 파일(.json)을 고르면 아이들 '리코더 연습 · 리듬 게임' 첫 칸 '선생님 곡'에 떠요. 곡은 우리 반 저장소에만 들어가요."),
    note, list);
  let have = [], ready = null;   // 지금 들어 있는 곡(저장 모양) · ready = 그 목록 읽기(넣기 전에 기다렸다 같은 곡키를 견준다)
  const day = t => t ? `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}` : '-';
  async function refresh() {
    try { have = (await ctx.store.listTeacherSongs()) || []; }
    catch (e) { console.warn('[MUSIC-TSONG-1]', e); list.replaceChildren(h('div', { class: 'empty' }, '선생님 곡을 불러오지 못했어요. 다시 열어 보세요.')); return; }
    const rows = have.map(raw => { try { return { raw, s: fromTeacherSong(raw) }; } catch (e) { return { raw, s: null, err: e.message }; } })
      .sort((a, z) => ((a.s ? a.s.order : 999) - (z.s ? z.s.order : 999)) || String(a.s ? a.s.title : a.raw.title || '').localeCompare(String(z.s ? z.s.title : z.raw.title || ''), 'ko'));
    if (!rows.length) { list.replaceChildren(h('div', { class: 'empty' }, '아직 넣은 곡이 없어요.')); return; }
    list.replaceChildren(...rows.map(row));
    //  [MUSIC-ENSEMBLE-1] 같은 제목 · 다른 부분 = 합주(아이가 한 부분을 연습할 때 '함께 연주'로 다른 부분이 같이 나옴) · 못 묶이면 까닭(박 · 마디 · 빠르기가 다름 …)
    const ens = ensembleReport(rows.map(r => r.s).filter(Boolean));
    if (ens.length) list.append(h('div', { class: 'ts-ens' }, ...ens.map(g => g.why
      ? h('div', { class: 'bad' }, `⚠ 합주로 못 묶음: ${g.name} — ${g.why}`)
      : h('div', {}, `🎶 합주: ${g.name} — ${g.parts.join(' · ')} (아이가 한 부분을 연습할 때 다른 부분이 같이 나와요)`))));
  }
  function row({ raw, s, err }) {
    const name = s ? s.title : String(raw.title || raw.key || '곡');
    const acts = [];
    if (s) {
      const play = h('button', { class: 'play-i', title: '듣기', onclick: () => ctx.listen(s, play) });
      acts.push(play, h('button', { class: 'btn small', onclick: () => { const { el: staff } = renderStaff(s, { width: Math.min(1040, innerWidth - 90) }); modal(name, staff, [{ label: '닫기', primary: true }], { wide: true }); } }, '악보'));
    }
    acts.push(h('button', { class: 'btn small', onclick: async () => {
      if (!confirm(`'${name}' 곡을 지울까요? 아이들 '선생님 곡' 칸에서 빠져요(아이들 연습 기록은 남아요).`)) return;
      try { await ctx.store.deleteTeacherSong(raw.key); toast('지웠어요'); } catch (e) { console.warn(e); toast('지우지 못했어요'); }
      ctx.resetTeacherSongs && ctx.resetTeacherSongs();
      ready = refresh();
    } }, '지우기'));
    //  리코더로 못 부는 음이 있으면 미리 알림 — 아이 '리코더 연습'에서 그 곡 [연습]이 꺼진다(리듬 게임은 됨)
    const rec = !s ? '' : !recorderOK(s, 'baroque') ? ' · ⚠ 리코더로 못 부는 음이 있어요(리듬 게임만)' : !recorderOK(s, 'german') ? ' · 저먼식 리코더로는 못 부는 음이 있어요' : '';
    const sub = s ? `${meterOf(s).key} · ${s.bars}마디 · 음 ${s.notes.length}개 · 빠르기 ${s.tempo} · 곡키 ${s.tk} · 넣은 때 ${day(raw.t)}${rec}`
      : `곡 모양이 맞지 않아 아이들에게 안 보여요 — ${err}`;
    return h('div', { class: 'song-row' }, h('div', { class: 't' }, h('b', {}, name), h('span', {}, sub)), h('div', { class: 'acts' }, ...acts));
  }
  async function importFiles(files) {
    pickBtn.disabled = true;
    await ready;
    const keys = new Set(have.map(r => r && r.key).filter(Boolean));
    let added = 0, changed = 0;
    const bad = [];
    for (const f of files) {
      let songs;
      try {
        if (f.size > TS_FILE_MAX) throw new Error('파일이 너무 커요(1MB 까지)');
        let data;
        try { data = JSON.parse(await f.text()); } catch (e) { throw new Error('곡 파일(JSON) 모양이 아니에요'); }
        songs = teacherSongsIn(data);
        if (!songs.length) throw new Error('곡이 없어요');
      } catch (e) { bad.push(`${f.name}: ${e.message}`); continue; }
      for (let i = 0; i < songs.length; i++) {
        const raw = songs[i];
        const who = songs.length > 1 ? ` (${raw && typeof raw.key === 'string' && raw.key ? raw.key : i + 1 + '번째 곡'})` : '';
        try {
          const c = cleanTeacherSong(raw);
          await ctx.store.saveTeacherSong(c);
          if (keys.has(c.key)) changed++; else { added++; keys.add(c.key); }
        } catch (e) { bad.push(`${f.name}${who}: ${e.message}`); }
      }
    }
    pickBtn.disabled = false;
    ctx.resetTeacherSongs && ctx.resetTeacherSongs();
    const msg = importMsg(added, changed, bad);
    toast(msg, bad.length ? 6000 : 2600);
    note.textContent = bad.length ? [msg.split(':')[0] + ':', ...bad.map(b => '· ' + b)].join('\n') : msg;
    note.classList.toggle('ok', !bad.length);
    note.style.display = '';
    ready = refresh();
    await ready;
  }
  ready = refresh();
}
//  넣은 결과 한 줄 — '3곡 넣었어요' · '1곡 바꿨어요' · '2곡 넣고 1곡 바꿨어요' · '2곡 넣고 1곡은 못 넣었어요: <파일>: <까닭>'
export function importMsg(added, changed, bad) {
  const done = added && changed ? `${added}곡 넣고 ${changed}곡 바꿨` : added ? `${added}곡 넣었` : changed ? `${changed}곡 바꿨` : '';
  if (!bad.length) return done ? done + '어요' : '넣은 곡이 없어요';
  const lead = added && changed ? `${added}곡 넣고 ${changed}곡 바꾸고 ` : added ? `${added}곡 넣고 ` : changed ? `${changed}곡 바꾸고 ` : '';
  return `${lead}${bad.length}곡은 못 넣었어요: ${bad[0]}${bad.length > 1 ? ` 외 ${bad.length - 1}` : ''}`;
}
