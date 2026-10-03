// 작은 도구 모음 — 빌드 없음, ES 모듈 (음악실 util.js 와 같은 모양)
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
