// 선생님 화면 — 아이별 곡 · 리코더 연습 횟수 · 음악회에서 내리기/다시 올리기. 관리자 비밀번호로 연다(생각판과 같은 방식).
//  쓰는 것은 음악회 목록의 숨김 표시(concert/<키>/hide) 하나뿐. 아이 곡은 고치지 않는다.
import { h, toast, modal } from './util.js';
import { normalize } from './song.js';
import { renderStaff } from './notation.js';
import { meterOf } from './theory.js';

async function gate(ctx) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem('music.teacher') === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem('music.teacher', '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}

export async function mountTeacher(root, ctx) {
  if (!(await gate(ctx))) { ctx.go('#/'); return { unmount() {} }; }
  const box = h('div', { class: 'pick teacher' }, h('div', { class: 'empty' }, '불러오는 중…'));
  root.replaceChildren(ctx.topBar('음악실 · 선생님', { back: '#/' }), h('div', { class: 'view' }, box));
  const [songs, practice, concert] = await Promise.all([ctx.store.allSongs(), ctx.store.allPractice(), ctx.store.allConcert()]);
  const hidden = new Set(concert.filter(c => c.hide).map(c => c.sid + '_' + c.id));
  const kids = new Map();
  const kid = sid => { if (!kids.has(sid)) kids.set(sid, { sid, name: '', songs: [], practice: 0, last: 0 }); return kids.get(sid); };
  for (const [sid, list] of Object.entries(songs || {})) for (const raw of Object.values(list || {})) { const k = kid(sid); const s = normalize(raw); k.songs.push(s); k.name = k.name || raw.byName || ''; k.last = Math.max(k.last, raw.updated || 0); }
  for (const [sid, list] of Object.entries(practice || {})) for (const p of Object.values(list || {})) { const k = kid(sid); k.practice += p.n || 0; k.last = Math.max(k.last, p.last || 0); }
  const rows = [...kids.values()].sort((a, z) => (a.name || a.sid).localeCompare(z.name || z.sid, 'ko'));
  const day = t => t ? `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}` : '-';
  if (!rows.length) { box.replaceChildren(h('div', { class: 'empty' }, '아직 아무도 곡을 짓거나 연습하지 않았어요.')); return { unmount() {} }; }
  box.replaceChildren(
    h('p', { class: 'muted', style: { marginBottom: '10px' } }, `아이 ${rows.length}명 · 곡 ${rows.reduce((a, k) => a + k.songs.length, 0)}개 · 리코더 연습 ${rows.reduce((a, k) => a + k.practice, 0)}번. 음악회에 올린 곡은 '내리기'로 숨길 수 있어요(곡은 지워지지 않아요).`),
    h('div', { class: 'list' }, ...rows.map(k => h('div', { class: 'tk' },
      h('div', { class: 'tk-head' }, h('b', {}, k.name || k.sid), h('span', { class: 'muted' }, `곡 ${k.songs.length} · 연습 ${k.practice}번 · 마지막 ${day(k.last)}`)),
      ...k.songs.sort((a, z) => (z.updated || 0) - (a.updated || 0)).map(s => {
        const ck = k.sid + '_' + s.id, isHidden = hidden.has(ck);
        const play = h('button', { class: 'play-i', onclick: () => ctx.listen(s, play) });
        const hideBtn = s.pub ? h('button', { class: 'btn small' + (isHidden ? ' on' : ''), onclick: async () => {
          const nowHidden = !hidden.has(ck);
          try { await ctx.store.setHidden(k.sid, s.id, nowHidden); nowHidden ? hidden.add(ck) : hidden.delete(ck); hideBtn.textContent = nowHidden ? '다시 올리기' : '음악회에서 내리기'; hideBtn.classList.toggle('on', nowHidden); toast(nowHidden ? '음악회에서 내렸어요' : '다시 올렸어요'); }
          catch (e) { console.warn(e); toast('바꾸지 못했어요'); }
        } }, isHidden ? '다시 올리기' : '음악회에서 내리기') : h('span', { class: 'muted', style: { fontSize: '.8rem' } }, '나만 보기');
        return h('div', { class: 'song-row' }, h('div', { class: 't' }, h('b', {}, s.title || '제목 없는 곡'), h('span', {}, `${meterOf(s).key} · ${s.bars}마디 · 음 ${s.notes.length}개 · 고친 때 ${day(s.updated)} · ${s.rev || 1}번 저장`)),
          h('div', { class: 'acts' }, play, h('button', { class: 'btn small', onclick: () => { const { el } = renderStaff(s, { width: Math.min(1040, innerWidth - 90) }); modal(`${s.title || '곡'} — ${k.name || ''}`, el, [{ label: '닫기', primary: true }], { wide: true }); } }, '악보'), hideBtn));
      })))));
  return { unmount() {} };
}
