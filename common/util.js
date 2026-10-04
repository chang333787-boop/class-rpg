// 작은 도구 모음 — 빌드 없음, ES 모듈 · 하위 앱 공통 [SUBAPP-COMMON-1]
//  명화 탐정 · 기초 코딩 · 먹 연구소 · 물감 연구소 · 무늬 공방 · 판화 놀이 · 음악실이 같이 쓴다(각 앱 js/util.js 가 이것을 다시 내보낸다).
//  여기를 고치면 그 앱들 index.html import map 의 "../common/util.js" ?v= 를 모두 같은 값으로 올린다(scripts/unit/buster-check.mjs 가 본다).
//  생각판(thinkboard) util.js 는 모양이 달라(keyOf 규칙 · modal 닫기 단추) 따로 둔다.
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + (Date.now() % 46656).toString(36);
// Firebase 키에 못 쓰는 글자(. # $ / [ ])와 그 밖의 낯선 글자를 바꾼다
export const keyOf = s => String(s ?? '').replace(/[^\w-]/g, '_').slice(0, 40) || '_';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// h('div', { class: 'a', onclick: fn }, '글', 자식…)
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// 가운데 창. buttons = [{ label, primary, onclick(close) }] — 바깥·Esc 로 닫힌다
export function modal(title, body, buttons = [{ label: '알겠어요', primary: true }], opts = {}) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); opts.onclose && opts.onclose(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const wrap = h('div', { class: 'modal-wrap', onclick: e => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal' + (opts.wide ? ' wide' : '') },
      title ? h('h2', {}, title) : null,
      h('div', { class: 'modal-body' }, body),
      buttons.length ? h('div', { class: 'modal-btns' }, buttons.map(b =>
        h('button', { class: b.primary ? 'btn primary' : 'btn', onclick: () => b.onclick ? b.onclick(close) : close() }, b.label))) : null));
  document.body.append(wrap);
  document.addEventListener('keydown', onKey, true);
  return close;
}

export const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
