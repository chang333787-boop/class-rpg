// 문제 글을 '조각(token)' 배열로 쓴다. 화면(HTML)과 보고서(글)로 둘 다 바꿀 수 있게.
//   '글자'            일반 글
//   {f:[위, 아래]}    분수 — 위·아래는 수 또는 {b:i}(빈칸)
//   {m:[자연수, 위, 아래]} 대분수
//   {b:i}             수 빈칸 (i번째 답)
//   {svg:'<svg…>'}    그림
//   {br:1}            줄 바꿈

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function partHTML(p, opt) {
  if (p && typeof p === 'object' && 'b' in p) return blankHTML(p.b, opt);
  return `<span class="num">${esc(p)}</span>`;
}
function blankHTML(i, opt) {
  if (opt.static) {
    const v = opt.vals && opt.vals[i];
    return `<span class="blank-s${opt.marks && opt.marks[i] === false ? ' wrong' : ''}">${v == null || Number.isNaN(v) ? '□' : esc(v)}</span>`;
  }
  return `<input class="blank" data-i="${i}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="빈칸 ${i + 1}">`;
}

export function toHTML(tokens, opt = {}) {
  return (tokens || []).map((t) => {
    if (typeof t === 'string' || typeof t === 'number') return `<span class="tx${/[가-힣]/.test(String(t)) ? ' kr' : ''}">${esc(t)}</span>`;
    if ('f' in t) return `<span class="fr"><span class="fr-t">${partHTML(t.f[0], opt)}</span><span class="fr-b">${partHTML(t.f[1], opt)}</span></span>`;
    if ('m' in t) return `<span class="mx">${partHTML(t.m[0], opt)}<span class="fr"><span class="fr-t">${partHTML(t.m[1], opt)}</span><span class="fr-b">${partHTML(t.m[2], opt)}</span></span></span>`;
    if ('b' in t) return blankHTML(t.b, opt);
    if ('svg' in t) return `<div class="pic">${t.svg}</div>`;
    if ('br' in t) return '<span class="br"></span>';
    return '';
  }).join('');
}

function partText(p, vals) {
  if (p && typeof p === 'object' && 'b' in p) {
    const v = vals && vals[p.b];
    return v == null || Number.isNaN(v) ? '□' : String(v);
  }
  return String(p);
}
export function toText(tokens, vals) {
  return (tokens || []).map((t) => {
    if (typeof t === 'string' || typeof t === 'number') return String(t);
    if ('f' in t) return `${partText(t.f[0], vals)}/${partText(t.f[1], vals)}`;
    if ('m' in t) return `${partText(t.m[0], vals)} ${partText(t.m[1], vals)}/${partText(t.m[2], vals)}`;
    if ('b' in t) return partText(t, vals);
    if ('svg' in t) return '[그림]';
    if ('br' in t) return ' ';
    return '';
  }).join('').replace(/\s+/g, ' ').trim();
}

// 빈칸 개수 = 가장 큰 번호 + 1
export function blankCount(tokens) {
  let n = 0;
  const see = (p) => { if (p && typeof p === 'object' && 'b' in p) n = Math.max(n, p.b + 1); };
  (tokens || []).forEach((t) => {
    if (t && typeof t === 'object') {
      if ('b' in t) see(t);
      if ('f' in t) t.f.forEach(see);
      if ('m' in t) t.m.forEach(see);
    }
  });
  return n;
}

// ── 그림 ── 색은 CSS(currentColor·클래스)로 — 밝은/어두운 화면 둘 다
export function dots(n, { cols = 5, r = 9, gap = 26 } = {}) {
  const rows = Math.ceil(n / cols);
  const w = Math.min(n, cols) * gap + 8, h = rows * gap + 8;
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 4 + gap / 2 + (i % cols) * gap, y = 4 + gap / 2 + Math.floor(i / cols) * gap;
    s += `<circle cx="${x}" cy="${y}" r="${r}" class="dot"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="점 ${n}개">${s}</svg>`;
}

// k묶음 × 각 n개 — 묶음마다 둥근 테두리
export function groups(k, n, { r = 8, gap = 22 } = {}) {
  const cols = Math.min(n, 5), rows = Math.ceil(n / cols);
  const gw = cols * gap + 10, gh = rows * gap + 10;
  const per = Math.min(k, 5);
  const W = per * (gw + 10) + 4, H = Math.ceil(k / per) * (gh + 10) + 4;
  let s = '';
  for (let g = 0; g < k; g++) {
    const ox = 4 + (g % per) * (gw + 10), oy = 4 + Math.floor(g / per) * (gh + 10);
    s += `<rect x="${ox}" y="${oy}" width="${gw}" height="${gh}" rx="10" class="grp"/>`;
    for (let i = 0; i < n; i++) {
      const x = ox + 5 + gap / 2 + (i % cols) * gap, y = oy + 5 + gap / 2 + Math.floor(i / cols) * gap;
      s += `<circle cx="${x}" cy="${y}" r="${r}" class="dot"/>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${n}개씩 ${k}묶음">${s}</svg>`;
}

// 막대를 d칸으로 똑같이 나누고 앞의 n칸 색칠
export function bar(d, n, { w = 300, h = 46 } = {}) {
  let s = '';
  const cw = w / d;
  for (let i = 0; i < d; i++) s += `<rect x="${2 + i * cw}" y="2" width="${cw}" height="${h}" class="${i < n ? 'cell on' : 'cell'}"/>`;
  return `<svg viewBox="0 0 ${w + 4} ${h + 4}" width="${w + 4}" height="${h + 4}" role="img" aria-label="${d}칸 중 ${n}칸 색칠">${s}</svg>`;
}

// 원을 d조각으로 똑같이 나누고 n조각 색칠
export function pie(d, n, { r = 70 } = {}) {
  const c = r + 4;
  let s = '';
  for (let i = 0; i < d; i++) {
    const a0 = (i / d) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0), x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    s += `<path d="M${c} ${c}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" class="${i < n ? 'cell on' : 'cell'}"/>`;
  }
  return `<svg viewBox="0 0 ${2 * c} ${2 * c}" width="${2 * c}" height="${2 * c}" role="img" aria-label="원 ${d}조각 중 ${n}조각 색칠">${s}</svg>`;
}

// 두 막대(같은 길이)를 위아래로 — 단위분수 크기 비교용
export function twoBars(d1, n1, d2, n2, { w = 300, h = 34 } = {}) {
  const row = (d, n, y) => {
    let s = ''; const cw = w / d;
    for (let i = 0; i < d; i++) s += `<rect x="${2 + i * cw}" y="${y}" width="${cw}" height="${h}" class="${i < n ? 'cell on' : 'cell'}"/>`;
    return s;
  };
  return `<svg viewBox="0 0 ${w + 4} ${2 * h + 16}" width="${w + 4}" height="${2 * h + 16}" role="img" aria-label="두 막대">${row(d1, n1, 2)}${row(d2, n2, h + 12)}</svg>`;
}
