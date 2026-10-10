// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_music 아래만 쓴다.
//  RPG 본 데이터(classRPG_v3)는 쓰지 않는다 — 읽기는 선생님 화면의 반 명단 classRPG_v3/students 하나(id · 이름만 · common/roster.js 가 store.db 로) [APP-ROSTER-1]. 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기도 선생님 화면만.
//  songs/<sid>/<곡id>        = 곡 전체
//  songlog/<sid>/<곡id>/<때> = 저장할 때마다 한 줄 { ev new|save, nn 음 수, bars, pub } — 지우지 않고 쌓는다(만든 과정)
//  concert/<sid>_<곡id>      = 우리 반 음악회 목록 한 줄 { sid, n 이름, t 제목, u 고친 때, beats, sub, bars, scale, hide }
//  practice/<sid>/<곡키>     = 리코더 기록장 { n 횟수, last, stars, t 제목 } + log/<자동키> = { t 때, sp 빠르기, st 별 }  (지우지 않고 쌓는다)
//  rhythm/<곡키>/<sid>       = 리듬 게임 최고 기록 { best, acc, combo, grade, t 때, n 이름 }
//  tsongs/<곡키> = 선생님이 올린 곡(공연 곡) — 가락 글(library 꼴) · 공개 저장소에 넣지 않는 곡(저작권) [MUSIC-TSONG-1]
//                  { key, title, part?, origin, memo?, order, beats, sub, tempo, key2, scale, inst, drum?, level, melody, prog?, progEvery?, t 넣은 때 } — 쓰기는 교사 화면만
//  beats/<sid>/<비트id>      = 비트 만들기 한 비트(글자 줄 모양 — 쓰기 전 · 읽은 뒤 beatcore normalizeBeat 이 살핀다) [MUSIC-BEAT-1]
//  beatclass/<sid>_<비트id> = 우리 반 비트 모음 한 줄 { sid, n 이름, id, t 제목, u 고친 때, bpm, kit, grid, na 순서 칸 수, hide } — 제목이 고운 말일 때만 · 다시 저장해도 선생님 숨김(hide)은 남는다
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { uid, keyOf, lsGet, lsSet } from './util.js';
import { rpgDb, adminPwOK } from '../../common/rpg-firebase.js';   // 설정 · 앱 만들기 · 관리자 비밀번호 확인 [SUBAPP-COMMON-1]
import { songBad, badWords } from './safety.js';
import { normalizeBeat, packBeat } from './beatcore.js';   // 비트 — 정한 모양만 저장 [MUSIC-BEAT-1]
import { cleanTeacherSong } from './song.js';   // 선생님 곡 — 정한 칸만 저장 [MUSIC-TSONG-1]
const clean = s => { const b = songBad(s); return !b.title.length && !b.lyrics.length; };

export const ROOT = 'classRPG_music';
const plain = v => JSON.parse(JSON.stringify(v));   // undefined 빼기
const vals = o => o && typeof o === 'object' ? Object.values(o) : [];
const songOut = s => plain({ ...s, notes: s.notes.map(n => n.w ? n : { s: n.s, d: n.d, p: n.p }) });
//  [MUSIC-BEAT-1] 비트 모음 한 줄 · 살핀 비트(저장 모양) · 목록 거르기
const beatRow = (b, sid, name) => ({ sid, n: name || '', id: b.id, t: b.title || '이름 없는 비트', u: b.updated, bpm: b.bpm, kit: b.kit, grid: b.grid, na: (b.arr || []).length });
const beatClean = b => { const c = packBeat(normalizeBeat(b)); if (c.id) c.id = keyOf(c.id); return c; };
const beatOK = c => c && typeof c === 'object' && !c.hide && typeof c.t === 'string' && !!c.t && !!c.sid && !!c.id;
const byU = (a, z) => (z.u || 0) - (a.u || 0);

export function createStore({ sid, name, fb = globalThis.firebase, offline = false } = {}) {
  sid = sid ? keyOf(sid) : '';
  if (sid && fb && !offline) return rtdbStore(fb, sid, name);
  return localStore(sid || 'guest', name || '나');
}

function rtdbStore(fb, sid, name) {
  const db = rpgDb(fb), root = db.ref(ROOT);
  const concertKey = id => keyOf(sid + '_' + id);
  const st = {
    me: { sid, name: name || '', guest: false }, online: true, db,
    async listMySongs() { return vals((await root.child('songs/' + sid).once('value')).val()).sort((a, z) => (z.updated || 0) - (a.updated || 0)); },
    async getSong(owner, id) { return (await root.child(`songs/${keyOf(owner)}/${keyOf(id)}`).once('value')).val(); },
    async saveSong(song) {
      const t = Date.now();
      if (!song.id) { song.id = uid('s'); song.created = t; }
      song.by = sid; song.byName = name || ''; song.updated = t; song.rev = (song.rev || 0) + 1;
      const up = {};
      up[`songs/${sid}/${song.id}`] = songOut(song);
      up[`songlog/${sid}/${song.id}/${t}`] = { t, ev: song.rev === 1 ? 'new' : 'save', nn: song.notes.length, bars: song.bars, pub: !!song.pub };   // 지우지 않고 쌓는 기록(연구용)
      up[`concert/${concertKey(song.id)}`] = song.pub && clean(song)
        ? { sid, n: name || '', id: song.id, t: song.title || '제목 없음', u: t, beats: song.beats, sub: song.sub, bars: song.bars, scale: song.scale, nn: song.notes.length }
        : null;
      await root.update(up);
      return song;
    },
    async deleteSong(id) { await root.update({ [`songs/${sid}/${keyOf(id)}`]: null, [`concert/${concertKey(id)}`]: null, [`songlog/${sid}/${keyOf(id)}/${Date.now()}`]: { t: Date.now(), ev: 'delete' } }); },
    async listConcert() { return vals((await root.child('concert').once('value')).val()).filter(c => c && !c.hide && c.t).sort((a, z) => (z.u || 0) - (a.u || 0)); },
    watchConcert(cb) { const r = root.child('concert'); const fn = s => cb(vals(s.val()).filter(c => c && !c.hide && c.t).sort((a, z) => (z.u || 0) - (a.u || 0))); r.on('value', fn, e => console.warn('[music]', e)); return () => r.off('value', fn); },
    async addPractice(key, title, { sp = 1, stars = 0 } = {}) {
      const ref = root.child(`practice/${sid}/${keyOf(key)}`), t = Date.now();
      await ref.child('log').push({ t, sp, st: stars });
      const cur = (await ref.once('value')).val() || {};
      const n = (cur.n || 0) + 1;
      await ref.update({ n, last: t, stars, t: String(title || '').slice(0, 30) });
      return n;
    },
    async listPractice() { const v = (await root.child('practice/' + sid).once('value')).val() || {}; return Object.entries(v).map(([k, x]) => ({ key: k, ...x, log: vals(x.log) })); },
    async saveRhythm(key, r) {
      const ref = root.child(`rhythm/${keyOf(key)}/${sid}`);
      const prev = (await ref.once('value')).val();
      if (prev && prev.best >= r.score) return { newBest: false, prev: prev.best };
      await ref.set({ best: r.score, acc: r.acc, combo: r.maxCombo, grade: r.grade, t: Date.now(), n: name || '' });
      return { newBest: true, prev: prev ? prev.best : 0 };
    },
    async topRhythm(key, n = 5) { return Object.entries((await root.child('rhythm/' + keyOf(key)).once('value')).val() || {}).map(([s, x]) => ({ sid: s, ...x })).sort((a, z) => z.best - a.best).slice(0, n); },
    // ── 선생님 곡(공연 곡) [MUSIC-TSONG-1] ── 읽기 = 아이 고르기 칸 · 쓰기 = 교사 화면(곡 파일 넣기 · 지우기)
    async listTeacherSongs() { return vals((await root.child('tsongs').once('value')).val()).filter(x => x && typeof x === 'object'); },
    async saveTeacherSong(raw) { const c = cleanTeacherSong(raw), k = keyOf(c.key); await root.child('tsongs/' + k).set(plain({ ...c, t: Date.now() })); return k; },
    async deleteTeacherSong(key) { await root.child('tsongs/' + keyOf(key)).remove(); },
    // ── 비트 만들기 [MUSIC-BEAT-1] ── 모음 줄은 칸마다 써서(통째로 바꾸지 않아) 선생님 숨김(hide)이 남는다 · 내리면 줄을 지운다
    async listMyBeats() { return vals((await root.child('beats/' + sid).once('value')).val()).filter(x => x && typeof x === 'object').sort((a, z) => (z.updated || 0) - (a.updated || 0)); },
    async getBeat(owner, id) { return (await root.child(`beats/${keyOf(owner)}/${keyOf(id)}`).once('value')).val(); },
    async saveBeat(raw) {
      const b = beatClean(raw), t = Date.now();
      if (!b.id) { b.id = uid('b'); b.created = t; }
      b.by = sid; b.byName = name || ''; b.updated = t; b.rev = (b.rev || 0) + 1; b.pub = !!b.pub;
      const up = { [`beats/${sid}/${b.id}`]: plain(b) }, ck = 'beatclass/' + keyOf(sid + '_' + b.id);
      if (b.pub && !badWords(b.title).length) for (const [k, v] of Object.entries(beatRow(b, sid, name))) up[`${ck}/${k}`] = v;
      else up[ck] = null;
      await root.update(up);
      return b;
    },
    async deleteBeat(id) { await root.update({ [`beats/${sid}/${keyOf(id)}`]: null, [`beatclass/${keyOf(sid + '_' + id)}`]: null }); },
    async listBeatClass() { return vals((await root.child('beatclass').once('value')).val()).filter(beatOK).sort(byU); },
    watchBeatClass(cb) { const r = root.child('beatclass'); const fn = s => cb(vals(s.val()).filter(beatOK).sort(byU)); r.on('value', fn, e => console.warn('[music]', e)); return () => r.off('value', fn); },
    // ── 선생님 ──
    async teacherOK(pw) { return adminPwOK(db, pw); },
    async allSongs() { return (await root.child('songs').once('value')).val() || {}; },
    async allPractice() { return (await root.child('practice').once('value')).val() || {}; },
    async allConcert() { return vals((await root.child('concert').once('value')).val()); },
    async setHidden(owner, id, hide) { await root.child(`concert/${keyOf(owner + '_' + id)}/hide`).set(hide ? true : null); },
    async allBeats() { return (await root.child('beats').once('value')).val() || {}; },   // [MUSIC-BEAT-1]
    async allBeatClass() { return vals((await root.child('beatclass').once('value')).val()).filter(c => c && typeof c === 'object'); },
    async setBeatHidden(owner, id, hide) { await root.child(`beatclass/${keyOf(owner + '_' + id)}/hide`).set(hide ? true : null); },
  };
  return st;
}

// 이 기기에만(손님) — 같은 모양
function localStore(sid, name) {
  const K = 'music.local';
  const load = () => lsGet(K, { songs: {}, practice: {}, rhythm: {}, tsongs: {} });
  const save = d => lsSet(K, d);
  const st = {
    me: { sid, name, guest: true }, online: false,
    async listMySongs() { return vals(load().songs).sort((a, z) => (z.updated || 0) - (a.updated || 0)); },
    async getSong(owner, id) { return load().songs[id] || null; },
    async saveSong(song) {
      const d = load(), t = Date.now();
      if (!song.id) { song.id = uid('s'); song.created = t; }
      song.by = sid; song.byName = name; song.updated = t; song.rev = (song.rev || 0) + 1;
      d.songs[song.id] = songOut(song); save(d); return song;
    },
    async deleteSong(id) { const d = load(); delete d.songs[id]; save(d); },
    async listConcert() { return vals(load().songs).filter(s => s.pub).map(s => ({ sid, n: name, id: s.id, t: s.title || '제목 없음', u: s.updated, beats: s.beats, sub: s.sub, bars: s.bars, scale: s.scale, nn: (s.notes || []).length })); },
    watchConcert(cb) { st.listConcert().then(cb); return () => {}; },
    async addPractice(key, title, { sp = 1, stars = 0 } = {}) {
      const d = load(), k = keyOf(key), cur = d.practice[k] || { n: 0, log: [] };
      cur.n++; cur.last = Date.now(); cur.stars = stars; cur.t = title; cur.log = [...(cur.log || []), { t: cur.last, sp, st: stars }].slice(-200);
      d.practice[k] = cur; save(d); return cur.n;
    },
    async listPractice() { return Object.entries(load().practice).map(([k, x]) => ({ key: k, ...x })); },
    async saveRhythm(key, r) {
      const d = load(), k = keyOf(key), prev = d.rhythm[k];
      if (prev && prev.best >= r.score) return { newBest: false, prev: prev.best };
      d.rhythm[k] = { best: r.score, acc: r.acc, combo: r.maxCombo, grade: r.grade, t: Date.now(), n: name }; save(d);
      return { newBest: true, prev: prev ? prev.best : 0 };
    },
    async topRhythm(key) { const x = load().rhythm[keyOf(key)]; return x ? [{ sid, ...x }] : []; },
    async listTeacherSongs() { return vals(load().tsongs).filter(x => x && typeof x === 'object'); },   // [MUSIC-TSONG-1]
    async saveTeacherSong(raw) { const c = cleanTeacherSong(raw), k = keyOf(c.key), d = load(); d.tsongs = { ...(d.tsongs || {}), [k]: plain({ ...c, t: Date.now() }) }; save(d); return k; },
    async deleteTeacherSong(key) { const d = load(); if (d.tsongs) { delete d.tsongs[keyOf(key)]; save(d); } },
    // ── 비트 만들기 [MUSIC-BEAT-1] ── 손님도 같은 모양(이 기기에만) · 비트 모음 = 내가 올린 것만
    async listMyBeats() { return vals(load().beats).filter(x => x && typeof x === 'object').sort((a, z) => (z.updated || 0) - (a.updated || 0)); },
    async getBeat(owner, id) { return (load().beats || {})[keyOf(id)] || null; },
    async saveBeat(raw) {
      const d = load(), b = beatClean(raw), t = Date.now();
      if (!b.id) { b.id = uid('b'); b.created = t; }
      b.by = sid; b.byName = name; b.updated = t; b.rev = (b.rev || 0) + 1; b.pub = !!b.pub;
      d.beats = { ...(d.beats || {}), [b.id]: plain(b) }; save(d); return b;
    },
    async deleteBeat(id) { const d = load(); if (d.beats) { delete d.beats[keyOf(id)]; save(d); } },
    async listBeatClass() { return vals(load().beats).filter(b => b && b.pub && !badWords(b.title).length).map(b => beatRow(b, sid, name)).filter(beatOK).sort(byU); },
    watchBeatClass(cb) { st.listBeatClass().then(cb); return () => {}; },
    async teacherOK() { return true; },
    async allSongs() { return { [sid]: load().songs }; },
    async allPractice() { return { [sid]: load().practice }; },
    async allConcert() { return st.listConcert(); },
    async setHidden() {},
    async allBeats() { return { [sid]: load().beats || {} }; },   // [MUSIC-BEAT-1]
    async allBeatClass() { return st.listBeatClass(); },
    async setBeatHidden() {},
  };
  return st;
}
