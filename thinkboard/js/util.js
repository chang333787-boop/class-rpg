// 작은 도구 모음 — 빌드 없음, ES 모듈
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + (Date.now() % 46656).toString(36);
export const now = () => Date.now();
// Firebase 키에 못 쓰는 글자(. # $ / [ ])를 바꾼다 — 이름을 키로 쓸 때(공감 등)
export const keyOf = s => String(s ?? '').replace(/[.#$/\[\]]/g, '_').slice(0, 40) || '_';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// h('div', { class: 'a', onclick: fn }, '글', 자식…)
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}

// 판 코드 — 헷갈리는 글자(0·O·1·I) 뺌
export function code4() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// 가운데 창. buttons = [{ label, primary, onclick(close) }]
export function modal(title, body, buttons = []) {
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal-wrap', onclick: e => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal' },
      h('div', { class: 'modal-title' }, title, h('button', { class: 'x', onclick: close, 'aria-label': '닫기' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      buttons.length ? h('div', { class: 'modal-btns' }, buttons.map(b =>
        h('button', { class: b.primary ? 'btn primary' : 'btn', onclick: () => b.onclick(close) }, b.label))) : null));
  document.body.append(wrap);
  return close;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } });
    ta.value = text; document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}
