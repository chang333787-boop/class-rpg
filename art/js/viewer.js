// 그림 보기 — 확대(휠 · 두 손가락 · 단추) · 끌어 옮기기 · 짚기(움직이지 않고 누른 곳) · 표시(찾은 곳 · 단서 · 질문 핀 · 힌트) · 흑백 · 색 재기
//  자리는 모두 그림에 대한 % — 표시는 그림과 함께 커지고 작아진다(선 굵기 · 글자는 --s 로 되돌려 늘 같은 크기로 보이게)
import { h } from './util.js';

// sRGB ↔ 빛의 세기(사람 눈 밝기 L* 를 그대로 두는 흑백을 만들려고)
const LIN = new Float32Array(256).map((_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
const ENC = new Uint8ClampedArray(4096).map((_, i) => { const y = i / 4095; return Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055)); });
export const lstar = (r, g, b) => { const Y = 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b]; return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };

export function makeViewer({ src, w, h: H0, alt = '', onTap = () => {} }) {
  const img = h('img', { src, alt, draggable: 'false' });
  const gray = h('canvas', { class: 'vw-gray' });
  const marks = h('div', { class: 'vw-marks' });
  const inner = h('div', { class: 'vw-in' }, img, gray, marks);
  const tool = (t, title, fn) => h('button', { class: 'vw-btn', title, 'aria-label': title, onclick: e => { e.stopPropagation(); fn(); } }, t);
  const zoomLab = h('span', { class: 'vw-z' }, '1×');
  const tools = h('div', { class: 'vw-tools' }, tool('＋', '크게', () => zoomBy(1.6)), tool('－', '작게', () => zoomBy(1 / 1.6)), tool('⤢', '처음 크기로', () => reset()), zoomLab);
  const el = h('div', { class: 'vw' }, inner, tools);
  let W = 0, Hc = 0, fw = 0, fh = 0, s = 1, tx = 0, ty = 0, MAX = 4, grayOn = false, grayReady = false, raw = null;
  const ready = new Promise(res => { if (img.complete && img.naturalWidth) res(); else { img.onload = () => res(); img.onerror = () => res(); } });

  function fit() {
    W = el.clientWidth; Hc = el.clientHeight;
    if (!W || !Hc) return;
    const f = Math.min(W / w, Hc / H0); fw = w * f; fh = H0 * f;
    inner.style.width = fw + 'px'; inner.style.height = fh + 'px';
    MAX = Math.min(8, Math.max(3, (w / fw) * 2.2));
    clamp(); apply();
  }
  function clamp() {
    const sw = fw * s, sh = fh * s;
    tx = sw <= W ? (W - sw) / 2 : Math.min(0, Math.max(W - sw, tx));
    ty = sh <= Hc ? (Hc - sh) / 2 : Math.min(0, Math.max(Hc - sh, ty));
  }
  function apply() { inner.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`; inner.style.setProperty('--s', s); zoomLab.textContent = (Math.round(s * 10) / 10) + '×'; el.classList.toggle('zoomed', s > 1.01); }
  function zoomAt(cx, cy, ns) { ns = Math.max(1, Math.min(MAX, ns)); tx = cx - (cx - tx) * ns / s; ty = cy - (cy - ty) * ns / s; s = ns; clamp(); apply(); }
  function zoomBy(f) { zoomAt(W / 2, Hc / 2, s * f); }
  function reset() { s = 1; clamp(); apply(); }
  // 그림의 % 자리(사각형)를 화면 가운데로 — 힌트 · 단서 보기 · 색 재기
  function zoomTo(r, max = 3) {
    const rw = Math.max(4, r[2] - r[0]) / 100, rh = Math.max(4, r[3] - r[1]) / 100;
    s = Math.max(1, Math.min(MAX, max, Math.min(W * 0.62 / (fw * rw), Hc * 0.62 / (fh * rh))));
    const cx = (r[0] + r[2]) / 200, cy = (r[1] + r[3]) / 200;
    tx = W / 2 - cx * fw * s; ty = Hc / 2 - cy * fh * s; clamp(); apply();
  }

  // ── 누르기: 움직이지 않고 떼면 짚기 · 끌면 옮기기 · 두 손가락이면 확대 ──
  const pts = new Map(); let drag = null, pinch = null;
  const rel = e => { const b = el.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.vw-tools')) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, rel(e));
    if (pts.size === 1) drag = { p: rel(e), tx, ty, t: Date.now(), moved: false };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tx, ty }; if (drag) drag.moved = true; }
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, rel(e));
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ns = Math.max(1, Math.min(MAX, pinch.s * d / pinch.d));
      tx = m[0] - (pinch.m[0] - pinch.tx) * ns / pinch.s; ty = m[1] - (pinch.m[1] - pinch.ty) * ns / pinch.s; s = ns; clamp(); apply();
      return;
    }
    if (!drag) return;
    const [x, y] = rel(e), dx = x - drag.p[0], dy = y - drag.p[1];
    if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
    if (drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; clamp(); apply(); }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (drag && !drag.moved && !pts.size && Date.now() - drag.t < 800 && e.type === 'pointerup') tap(e);
    if (!pts.size) { drag = null; pinch = null; } else if (pts.size === 1) { pinch = null; drag = { p: [...pts.values()][0], tx, ty, t: 0, moved: true }; }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = rel(e); zoomAt(x, y, s * Math.exp(-e.deltaY * 0.0018)); }, { passive: false });

  function tap(e) {
    const b = img.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width * 100, y = (e.clientY - b.top) / b.height * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    onTap({ x, y });
  }
  function ripple(x, y, cls = '') {
    const r = h('span', { class: 'vw-rip ' + cls, style: { left: x + '%', top: y + '%' } });
    marks.append(r); setTimeout(() => r.remove(), 700);
  }

  // ── 표시 ──
  //  { r:[x0,y0,x1,y1], kind:'found'|'ev'|'hint'|'region'|'pick', label } · { x, y, kind:'pin', n, me, on }
  function setMarks(list) {
    marks.querySelectorAll('.mk,.pin').forEach(m => m.remove());
    for (const m of list) {
      if (m.r) {
        const [x0, y0, x1, y1] = m.r;
        marks.append(h('div', { class: 'mk ' + (m.kind || 'found'), style: { left: x0 + '%', top: y0 + '%', width: (x1 - x0) + '%', height: (y1 - y0) + '%' } }, m.label ? h('span', { class: 'mk-l' }, m.label) : null));
      } else marks.append(h('div', { class: 'pin' + (m.me ? ' me' : '') + (m.on ? ' on' : ''), style: { left: m.x + '%', top: m.y + '%' } }, h('span', {}, String(m.n))));
    }
  }

  // ── 흑백(사람 눈 밝기 그대로) · 색 재기 ──
  async function pixelsCanvas() {
    if (raw) return raw;
    await ready;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    raw = { c, g, W: c.width, H: c.height };
    return raw;
  }
  async function setGray(on) {
    grayOn = !!on;
    if (grayOn && !grayReady) {
      const { g, W: cw, H: ch } = await pixelsCanvas(), d = g.getImageData(0, 0, cw, ch), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const Y = 0.2126 * LIN[p[i]] + 0.7152 * LIN[p[i + 1]] + 0.0722 * LIN[p[i + 2]], v = ENC[Math.round(Y * 4095)]; p[i] = p[i + 1] = p[i + 2] = v; }
      gray.width = cw; gray.height = ch; gray.getContext('2d').putImageData(d, 0, 0); grayReady = true;
    }
    gray.classList.toggle('on', grayOn); el.classList.toggle('is-gray', grayOn);
  }
  // 사각형 안의 낱 점들([r,g,b]) — 많으면 고르게 덜어 낸다
  async function sample(r, max = 40000) {
    const { g, W: cw, H: ch } = await pixelsCanvas();
    const x0 = Math.floor(cw * r[0] / 100), y0 = Math.floor(ch * r[1] / 100), x1 = Math.ceil(cw * r[2] / 100), y1 = Math.ceil(ch * r[3] / 100);
    const d = g.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data, n = d.length / 4, step = Math.max(1, Math.floor(n / max)), out = [];
    for (let i = 0; i < n; i += step) out.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    return out;
  }
  async function lightOf(rects) { let sum = 0, n = 0; for (const r of rects) for (const [a, b, c] of await sample(r, 8000)) { sum += lstar(a, b, c); n++; } return n ? sum / n : 0; }

  const ro = new ResizeObserver(() => fit()); ro.observe(el);
  ready.then(fit);
  return { el, img, ready, setMarks, ripple, zoomTo, reset, setGray, sample, lightOf, get gray() { return grayOn; }, destroy() { ro.disconnect(); } };
}
