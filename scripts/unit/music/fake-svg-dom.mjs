// 음악실 악보 시험용 아주 작은 가짜 DOM [MUSIC-SCORE-1] — node 에서 notation.js 의 svg() 가 만드는 나무를 글자로 바꿔 견준다
//  document.createElementNS · createElement 만 · 속성은 넣은 차례 그대로(같은 그림이면 같은 글자)
class El {
  constructor(tag) { this.tagName = tag; this.attrs = []; this.kids = []; this.parent = null; }
  get nodeType() { return 1; }
  setAttribute(k, v) { const a = this.attrs.find(x => x[0] === k); if (a) a[1] = String(v); else this.attrs.push([k, String(v)]); }
  getAttribute(k) { const a = this.attrs.find(x => x[0] === k); return a ? a[1] : null; }
  removeAttribute(k) { this.attrs = this.attrs.filter(x => x[0] !== k); }
  append(...xs) { for (const x of xs) { if (x == null) continue; if (typeof x === 'object' && x.nodeType === 1) { x.parent = this; this.kids.push(x); } else this.kids.push({ text: String(x) }); } }
  appendChild(x) { this.append(x); return x; }
  prepend(...xs) { const keep = this.kids; this.kids = []; this.append(...xs); this.kids.push(...keep); }
  remove() { if (this.parent) this.parent.kids = this.parent.kids.filter(k => k !== this); this.parent = null; }
  get children() { return this.kids.filter(k => k.nodeType === 1); }
  get textContent() { return this.kids.map(k => (k.nodeType === 1 ? k.textContent : k.text)).join(''); }
  set textContent(v) { this.kids = [{ text: String(v) }]; }
  get classList() { const self = this; const list = () => (self.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    return { contains: c => list().includes(c), add: (...cs) => self.setAttribute('class', [...new Set([...list(), ...cs])].join(' ')), remove: (...cs) => self.setAttribute('class', list().filter(x => !cs.includes(x)).join(' ')),
      toggle: (c, on) => { const has = list().includes(c); const want = on === undefined ? !has : !!on; if (want && !has) self.classList.add(c); if (!want && has) self.classList.remove(c); return want; } }; }
  //  찾기(아주 간단히: 태그 · .class · [data-x] · 태그.class)
  querySelectorAll(sel) {
    const out = [], parts = String(sel).split(',').map(s => s.trim());
    const match = (el, s) => {
      const m = /^([a-z]*)((?:\.[\w-]+)*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/i.exec(s); if (!m) return false;
      if (m[1] && el.tagName !== m[1]) return false;
      const cls = (m[2] || '').split('.').filter(Boolean), have = (el.getAttribute('class') || '').split(/\s+/);
      if (!cls.every(c => have.includes(c))) return false;
      if (m[3]) { const v = el.getAttribute(m[3]); if (v == null) return false; if (m[4] != null && v !== m[4]) return false; }
      return true;
    };
    const walk = el => { for (const k of el.children) { if (parts.some(p => match(k, p))) out.push(k); walk(k); } };
    walk(this); return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function serialize(el) {
  if (el.nodeType !== 1) return esc(el.text);
  return `<${el.tagName}${el.attrs.map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${el.kids.map(serialize).join('')}</${el.tagName}>`;
}
export function installFakeDom() {
  globalThis.document = { createElementNS: (ns, tag) => new El(tag), createElement: tag => new El(tag) };
  return globalThis.document;
}
