// 시작점: 주소(#)에 따라 화면을 바꾼다.
//  #/        처음 — 로컬: 판 코드로 들어가기 · RPG: 우리 반 판 목록
//  #/b/<id>  판(아이)   #/t 선생님 화면   #/tb/<id> 선생님이 보는 판   #/tv/<id> 교실 TV
//  ?rpg=1    학급 RPG 안에서 연다 — 저장 = Firebase(classRPG_thinkboard) · 이름 = RPG 로그인(?n=) · 선생님 화면은 관리자만
import { h, toast } from './util.js';
import { createLocalStore } from './store.js';
import { createRtdbStore } from './store-rtdb.js';
import { mountBoard } from './board.js';
import { mountTeacher } from './teacher.js';
import { withDefaults, LAYOUTS } from './settings.js';
import { icon } from './icons.js';

const Q = new URLSearchParams(location.search);
const RPG = Q.get('rpg') === '1';
const store = RPG ? createRtdbStore() : createLocalStore();
const root = document.getElementById('app');
let unmount = null;

const meId = RPG ? (Q.get('sid') || '').slice(0, 60) : '';   // 학급 RPG 학생 id — 카드 · 기록에 함께 남겨 연구 자료를 RPG 학생과 잇는다
const getName = () => { if (RPG && Q.get('n')) return Q.get('n').slice(0, 20); try { return localStorage.getItem('tb.name') || ''; } catch { return ''; } };
const setName = n => { try { localStorage.setItem('tb.name', n); } catch {} };
const home = () => { location.hash = '#/'; };

// 선생님 화면 잠금(RPG): 관리 화면에서 열면 통과(sessionStorage) · 아니면 관리자 비밀번호
async function teacherOK() {
  if (!RPG) return true;
  try { if (sessionStorage.getItem('tb.teacher') === '1' || +localStorage.getItem('tb.teacherUntil') > Date.now()) return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try {
    const real = (await store.db.ref('classRPG_adminPw').once('value')).val();
    if (real != null && pw === String(real)) { try { sessionStorage.setItem('tb.teacher', '1'); } catch {} return true; }
  } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}

function mountHome() {
  const code = h('input', { class: 'big', placeholder: '판 코드', maxlength: 4, autocapitalize: 'characters', autocomplete: 'off' });
  const name = h('input', { class: 'big', placeholder: '내 이름', maxlength: 10 });
  name.value = getName();
  const go = async () => {
    const c = code.value.trim(), n = name.value.trim();
    if (!c) return code.focus();
    if (!n) return name.focus();
    const b = await store.findByCode(c);
    if (!b) return toast('그런 판이 없어요. 코드를 다시 봐 주세요');
    setName(n);
    location.hash = '#/b/' + b.id;
  };
  [code, name].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) go(); }));
  root.append(h('div', { class: 'home' },
    h('h1', {}, '생각판'),
    h('p', { class: 'sub' }, '생각을 카드로 꺼내고, 옮기고, 고쳐요'),
    h('div', { class: 'join' }, code, name, h('button', { class: 'btn primary big', onclick: go }, '들어가기')),
    h('a', { class: 'teacher-link', href: '#/t' }, '선생님 화면')));
  setTimeout(() => code.focus(), 30);
  return null;
}

// RPG 안: 우리 반 판 목록(선생님이 '아이들 목록에 보여요'로 둔 판) — 판 코드 · 이름을 묻지 않는다
function mountRpgHome() {
  const list = h('div', { class: 't-list' }, h('div', { class: 'fl-empty' }, '판을 불러오는 중…'));
  root.append(h('div', { class: 't-wrap' },
    h('header', { class: 't-head' }, h('h1', {}, '생각판'), h('span', { class: 'sub' }, `${getName() || ''} · 선생님이 연 판에 생각을 붙여요`)),
    list));
  const draw = async () => {
    let boards = [];
    try { boards = (await store.list()).filter(b => withDefaults(b.settings).listed !== false).sort((a, z) => z.created - a.created); }
    catch (e) { list.innerHTML = ''; list.append(h('div', { class: 'fl-empty' }, '판을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요')); return; }
    list.innerHTML = '';
    if (!boards.length) return list.append(h('div', { class: 'fl-empty' }, '아직 열린 판이 없어요. 선생님이 판을 열면 여기에 보여요'));
    for (const b of boards) {
      const st = withDefaults(b.settings);
      list.append(h('a', { class: 't-row as-link', href: '#/b/' + b.id },
        h('span', { class: 't-ico' }, b.template?.icon || '📋'),
        h('div', { class: 't-main' }, h('div', { class: 't-title' }, b.title), h('div', { class: 't-meta' }, [LAYOUTS[st.layout]?.replace(/\(.*\)/, ''), st.prompt].filter(Boolean).join(' · '))),
        st.open ? h('span', { class: 'pill' }, icon('edit', 14), '쓸 수 있어요') : h('span', { class: 'pill warn' }, icon('lock', 14), '보기만')));
    }
  };
  const stop = store.watchAll(draw);
  draw();
  return stop;
}

function askName() {
  const name = h('input', { class: 'big', placeholder: '내 이름', maxlength: 10 });
  const ok = () => { const n = name.value.trim(); if (!n) return name.focus(); setName(n); route(); };
  name.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) ok(); });
  root.append(h('div', { class: 'home' }, h('h1', {}, '생각판'), h('div', { class: 'join' }, name, h('button', { class: 'btn primary big', onclick: ok }, '들어가기'))));
  setTimeout(() => name.focus(), 30);
  return null;
}

// RPG 학생 명단(선생님 화면만) — 연구 자료 · '아직 안 쓴 아이'를 RPG 학생과 잇는다. classRPG_v3 는 읽기만.
let rosterP = null;
function loadRoster() {
  if (!RPG) return Promise.resolve([]);
  return rosterP ||= store.db.ref('classRPG_v3/students').once('value').then(s => Object.values(s.val() || {})
    .filter(x => x && x.id && x.name && !x.deleted && !x.hidden).map(x => ({ id: String(x.id), name: String(x.name) })))
    .catch(e => { console.warn('명단을 못 읽었어요', e); rosterP = null; return []; });
}

let seq = 0;
async function route() {
  const my = ++seq;
  unmount?.(); unmount = null;
  root.innerHTML = '';
  const hash = location.hash.slice(1) || '/';
  document.body.dataset.view = /^\/(b|tb|tv)\//.test(hash) ? 'board' : hash === '/t' ? 'teacher' : 'home';
  const teacherRoute = hash === '/t' || hash.startsWith('/tb/') || hash.startsWith('/tv/');
  if (teacherRoute && !(await teacherOK())) { if (my === seq) home(); return; }
  if (my !== seq) return;   // 기다리는 사이 주소가 바뀜
  const roster = teacherRoute ? await loadRoster() : [];
  if (my !== seq) return;
  if (hash.startsWith('/tb/')) unmount = mountBoard(root, { store, boardId: hash.slice(4), me: '선생님', home: () => { location.hash = '#/t'; }, teacher: true, roster });
  else if (hash.startsWith('/tv/')) unmount = mountBoard(root, { store, boardId: hash.slice(4), me: 'TV', home, tv: true });
  else if (hash.startsWith('/b/')) {
    const me = getName();
    unmount = me ? mountBoard(root, { store, boardId: hash.slice(3), me, meId, home }) : askName();
  } else if (hash === '/t') unmount = mountTeacher(root, { store, home, roster });
  else unmount = RPG ? mountRpgHome() : mountHome();
}

window.addEventListener('hashchange', route);
route();
