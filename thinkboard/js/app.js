// 시작점: 주소(#)에 따라 화면을 바꾼다.
//  #/        처음(판 코드로 들어가기 · 선생님 화면)
//  #/b/<id>  판(아이)
//  #/t       선생님 화면
import { h, toast } from './util.js';
import { createLocalStore } from './store.js';
import { mountBoard } from './board.js';
import { mountTeacher } from './teacher.js';

const store = createLocalStore();
const root = document.getElementById('app');
let unmount = null;

const getName = () => { try { return localStorage.getItem('tb.name') || ''; } catch { return ''; } };
const setName = n => { try { localStorage.setItem('tb.name', n); } catch {} };
const home = () => { location.hash = '#/'; };

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
    h('h1', {}, '🧠 생각판'),
    h('p', { class: 'sub' }, '생각을 카드로 꺼내고, 옮기고, 고쳐요'),
    h('div', { class: 'join' }, code, name, h('button', { class: 'btn primary big', onclick: go }, '들어가기')),
    h('a', { class: 'teacher-link', href: '#/t' }, '🧑‍🏫 선생님 화면')));
  setTimeout(() => code.focus(), 30);
  return null;
}

function askName(then) {
  const name = h('input', { class: 'big', placeholder: '내 이름', maxlength: 10 });
  const ok = () => { const n = name.value.trim(); if (!n) return name.focus(); setName(n); route(); };
  name.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) ok(); });
  root.append(h('div', { class: 'home' }, h('h1', {}, '🧠 생각판'), h('div', { class: 'join' }, name, h('button', { class: 'btn primary big', onclick: ok }, '들어가기'))));
  setTimeout(() => name.focus(), 30);
  return null;
}

function route() {
  unmount?.(); unmount = null;
  root.innerHTML = '';
  const hash = location.hash.slice(1) || '/';
  document.body.dataset.view = /^\/(b|tb|tv)\//.test(hash) ? 'board' : hash === '/t' ? 'teacher' : 'home';
  if (hash.startsWith('/tb/')) unmount = mountBoard(root, { store, boardId: hash.slice(4), me: '선생님', home: () => { location.hash = '#/t'; }, teacher: true });
  else if (hash.startsWith('/tv/')) unmount = mountBoard(root, { store, boardId: hash.slice(4), me: 'TV', home, tv: true });
  else if (hash.startsWith('/b/')) {
    const me = getName();
    unmount = me ? mountBoard(root, { store, boardId: hash.slice(3), me, home }) : askName();
  } else if (hash === '/t') unmount = mountTeacher(root, { store, home });
  else unmount = mountHome();
}

window.addEventListener('hashchange', route);
route();
