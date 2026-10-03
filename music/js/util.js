// 작은 도구 모음 — 빌드 없음, ES 모듈 (생각판 util.js 와 같은 모양)
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + (Date.now() % 46656).toString(36);
// Firebase 키에 못 쓰는 글자(. # $ / [ ])와 그 밖의 낯선 글자를 바꾼다
export const keyOf = s => String(s ?? '').replace(/[^\w-]/g, '_').slice(0, 40) || '_';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
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

//  [MUSIC-READY-1] 시작 준비(사용자 10-03 '시작하자마자 내려와 · 준비 시간 3 2 1') — 반주보다 먼저 3 · 2 · 1(초)을 크게 세고,
//  그다음 한 마디는 딸깍 소리와 같이 '하나 둘 셋 넷'을 센다. 리듬 게임 · 리코더 연습이 같이 쓴다.
//  t = 첫 음까지 남은 시간의 음수(초) · off = 한 마디 세기 길이 · beat = 한 박 길이 · (cx, cy) = 글 가운데
export const READY_SEC = 3;
const COUNT_WORDS = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟'];
export function readyCount(g, t, off, beat, beats, cx, cy) {
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (t < -off) {
    const x = -t - off, n = Math.min(READY_SEC, Math.ceil(x)), pop = 1 + Math.max(0, (x % 1) - 0.8);   // 숫자가 바뀌는 순간 살짝 커짐
    g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `900 ${Math.round(110 * pop)}px "Noto Sans KR",sans-serif`; g.fillText(String(n), cx, cy);
    g.fillStyle = 'rgba(255,255,255,.72)'; g.font = '800 18px "Noto Sans KR",sans-serif'; g.fillText('준비해요', cx, cy + 76);
  } else {
    const i = Math.min(beats - 1, Math.max(0, Math.floor((t + off) / beat)));
    g.fillStyle = 'rgba(255,228,143,.95)'; g.font = '900 64px "Noto Sans KR",sans-serif'; g.fillText(COUNT_WORDS[i] || String(i + 1), cx, cy);
  }
  g.restore();
}
