// 먹 접시 — 먹물 병 · 물통(누르면 한 방울 · − 로 한 방울 빼기) + 흰 사기 접시(먹색이 바로 바뀜) + 넣은 방울 글
//  물감 연구소 팔레트(mixer.js)와 같은 손놀림. 한 통에 아홉 방울까지(inkcolor.js MAX_DROPS) — 누르는 대로 바로 더한다(빨리 눌러도 안 놓침)
import { h, toast } from './util.js';
import { inkRgb, hex, lightOf, MAX_DROPS } from './inkcolor.js';

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export const POTS = [
  { k: 'ink', name: '먹물', drop: '#1b1d22' },
  { k: 'water', name: '물', drop: '#bcd8e6' },
];
// 먹물 병(먹이 찰랑) · 물통(맑은 물)
function potSvg(k) {
  const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 48 56'); s.setAttribute('class', 'pot-svg'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = k === 'ink'
    ? '<path d="M17 4h14v7c7 3 11 9 11 17v18c0 4-3 6-6 6H12c-3 0-6-2-6-6V28c0-8 4-14 11-17z" fill="#efe9dd" stroke="#6b5a48" stroke-width="2"/><path d="M8 30c9-3 23-3 32 0v16c0 3-2 4-4 4H12c-2 0-4-1-4-4z" fill="#15171b"/><rect x="15" y="2" width="18" height="6" rx="2" fill="#7a3b1e"/><ellipse cx="16" cy="36" rx="3" ry="6" fill="#fff" opacity=".18"/>'
    : '<path d="M8 10h32l-3 38c0 3-2 5-5 5H16c-3 0-5-2-5-5z" fill="#eef6fa" stroke="#6b8796" stroke-width="2"/><path d="M10.6 24h26.8l-2 23c0 2-1.5 3.5-3.5 3.5H16c-2 0-3.5-1.5-3.5-3.5z" fill="#9cc7dc" opacity=".75"/><path d="M14 28c4 2 8 2 12 0s8-2 10 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/>';
  return s;
}

export function makeDish({ onChange = () => {} } = {}) {
  let drops = {}, locked = false;
  const well = h('div', { class: 'well' }), ripple = h('span', { class: 'ripple' });
  const empty = h('span', { class: 'well-e' }, '비어 있어요');
  const bowl = h('div', { class: 'bowl' }, well, ripple, empty);
  const recipe = h('div', { class: 'recipe' });
  const items = POTS.map(t => {
    const cnt = h('span', { class: 'cnt' });
    const b = h('button', { class: 'tube pot', 'data-k': t.k, title: `${t.name} 한 방울`, onclick: () => add(t.k, b) }, potSvg(t.k), h('span', { class: 'tn' }, t.name), cnt);
    const minus = h('button', { class: 'minus', 'data-k': t.k, title: `${t.name} 한 방울 빼기`, onclick: () => sub(t.k) }, '− 빼기');
    return { t, b, cnt, minus, w: h('div', { class: 'tube-w' }, b, minus) };
  });
  const clearBtn = h('button', { class: 'btn small', onclick: () => { if (!locked) { drops = {}; render(); onChange(); } } }, '비우기');
  const el = h('div', { class: 'mixer' }, h('div', { class: 'tubes n2' }, ...items.map(x => x.w)),
    h('div', { class: 'bowl-row' }, bowl, h('div', { class: 'bowl-side' }, recipe, clearBtn)));

  function fly(b, css) {
    if (reduce()) return;
    const a = b.getBoundingClientRect(), z = bowl.getBoundingClientRect();
    if (!a.width || !z.width) return;
    const d = h('span', { class: 'fly', style: { background: css, left: a.left + a.width / 2 - 7 + 'px', top: a.bottom - 14 + 'px' } });
    document.body.append(d);
    const dx = z.left + z.width / 2 - (a.left + a.width / 2), dy = z.top + z.height / 2 - (a.bottom - 7);
    const an = d.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.1)` }, { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0.4 }], { duration: 420, easing: 'ease-in' });
    an.onfinish = () => { d.remove(); ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go'); };
  }
  function add(k, b) {
    if (locked) return;
    if ((drops[k] || 0) >= MAX_DROPS) { toast(`${POTS.find(t => t.k === k).name}은 아홉 방울까지예요`); return; }
    drops = { ...drops, [k]: (drops[k] || 0) + 1 };
    b.classList.remove('squeeze'); void b.offsetWidth; b.classList.add('squeeze');
    fly(b, POTS.find(t => t.k === k).drop);
    render(); onChange();
  }
  function sub(k) {
    if (locked || !drops[k]) return;
    drops = { ...drops, [k]: drops[k] - 1 };
    if (!drops[k]) delete drops[k];
    render(); onChange();
  }
  const rgb = () => inkRgb(drops.ink, drops.water);
  function render() {
    const c = rgb();
    well.style.background = c ? hex(c) : '';
    bowl.classList.toggle('is-empty', !c);
    for (const x of items) { const n = drops[x.t.k] || 0; x.cnt.textContent = n ? String(n) : ''; x.cnt.classList.toggle('on', !!n); x.minus.disabled = !n || locked; x.b.disabled = locked; }
    const n = (drops.ink || 0) + (drops.water || 0);
    recipe.replaceChildren(...[n ? h('span', {}, `먹 ${drops.ink || 0} : 물 ${drops.water || 0}`) : h('span', { class: 'muted' }, '먹물 · 물을 눌러 한 방울씩'), n ? h('span', { class: 'muted small' }, ` (모두 ${n}방울)`) : null].filter(Boolean));
    clearBtn.disabled = !n || locked;
  }
  render();
  return {
    el, bowl,
    get: () => ({ ink: drops.ink || 0, water: drops.water || 0 }), rgb, hex: () => { const c = rgb(); return c ? hex(c) : null; },
    light: () => lightOf(drops.ink, drops.water),
    clear() { drops = {}; render(); onChange(); },
    set(d) { drops = { ...d }; render(); onChange(); },
    lock(v) { locked = !!v; render(); },
  };
}
