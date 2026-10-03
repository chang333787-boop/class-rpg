// 팔레트 — 물감 통(누르면 한 방울 · − 로 한 방울 빼기) + 섞는 칸(색이 바로 바뀜) + 넣은 물감 글
//  물감 한 통에 아홉 방울까지(color.js MAX_DROPS). 방울이 떨어지는 움직임은 꾸밈이라 누르는 대로 바로 더한다(빨리 눌러도 안 놓침)
import { h, toast } from './util.js';
import { TUBES, MAX_DROPS, mix, hex, recipeText, dropsOf } from './color.js';
import { tubeSvg } from './draw.js';

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function makeMixer({ tubes, onChange = () => {} }) {
  let drops = {}, locked = false;
  const well = h('div', { class: 'well' }), ripple = h('span', { class: 'ripple' });
  const empty = h('span', { class: 'well-e' }, '비어 있어요');
  const bowl = h('div', { class: 'bowl' }, well, ripple, empty);
  const recipe = h('div', { class: 'recipe' });
  const list = TUBES.filter(t => tubes.includes(t.k));
  const items = list.map(t => {
    const cnt = h('span', { class: 'cnt' });
    const b = h('button', { class: 'tube', 'data-k': t.k, title: `${t.name} 한 방울`, onclick: () => add(t.k, b) }, tubeSvg(t.css, t.k), h('span', { class: 'tn' }, t.name), cnt);
    const minus = h('button', { class: 'minus', 'data-k': t.k, title: `${t.name} 한 방울 빼기`, onclick: () => sub(t.k) }, '− 빼기');
    return { t, b, cnt, minus, w: h('div', { class: 'tube-w' }, b, minus) };
  });
  const clearBtn = h('button', { class: 'btn small', onclick: () => { if (!locked) { drops = {}; render(); onChange(); } } }, '비우기');
  const el = h('div', { class: 'mixer' }, h('div', { class: 'tubes n' + list.length }, ...items.map(x => x.w)),
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
    if ((drops[k] || 0) >= MAX_DROPS) { toast(`${TUBES.find(t => t.k === k).name}은 아홉 방울까지예요`); return; }
    drops = { ...drops, [k]: (drops[k] || 0) + 1 };
    b.classList.remove('squeeze'); void b.offsetWidth; b.classList.add('squeeze');
    fly(b, TUBES.find(t => t.k === k).css);
    render(); onChange();
  }
  function sub(k) {
    if (locked || !drops[k]) return;
    drops = { ...drops, [k]: drops[k] - 1 };
    if (!drops[k]) delete drops[k];
    render(); onChange();
  }
  function render() {
    const rgb = mix(drops);
    well.style.background = rgb ? hex(rgb) : '';
    bowl.classList.toggle('is-empty', !rgb);
    for (const x of items) { const n = drops[x.t.k] || 0; x.cnt.textContent = n ? String(n) : ''; x.cnt.classList.toggle('on', !!n); x.minus.disabled = !n || locked; x.b.disabled = locked; }
    const n = dropsOf(drops);
    recipe.replaceChildren(...[n ? h('span', {}, recipeText(drops)) : h('span', { class: 'muted' }, '물감 통을 눌러 한 방울씩'), n ? h('span', { class: 'muted small' }, ` (모두 ${n}방울)`) : null].filter(Boolean));
    clearBtn.disabled = !n || locked;
  }
  render();
  return {
    el, bowl,
    get: () => ({ ...drops }), rgb: () => mix(drops), hex: () => { const r = mix(drops); return r ? hex(r) : null; },
    clear() { drops = {}; render(); onChange(); },
    set(d) { drops = { ...d }; render(); onChange(); },
    lock(v) { locked = !!v; render(); },
  };
}
