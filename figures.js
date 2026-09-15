// ══════════════════════════════════════════════════
//  문항 그림 렌더러 (FIG-1)
//  · 문제 객체의 fig 필드({ kind, ... })를 인라인 SVG 문자열로 바꾼다.
//  · 순수 함수. DB·DOM 접근 없음. curriculum.js 다음, student.js 앞에 로드된다.
//  · 모르는 kind는 빈 문자열 → 그림 없이 문제만 나온다(문항 데이터가 코드보다 앞서가도 안 깨짐).
//  · 선 색은 currentColor — 감싸는 요소(.st-fig)가 글자색을 정한다.
//
//  kind 목록 (curriculum_review.js 작성자와 약속한 규격):
//   angle    { deg, label? }                  각. label:'?'면 각도 숫자 숨김
//   polygon  { n, shape?, angles? }           n각형. shape 'right'|'iso'|'equi'(삼각형). angles:[50,70,'?'] 꼭짓점 각 표기
//   rect     { w, h, unit? }                  치수 표시된 직사각형
//   clock    { h, m }                         아날로그 시계
//   fraction { n, k, shape? }                 전체 n칸 중 k칸 색칠. 'circle'|'bar'
//   blocks   { hundreds?, tens?, ones? }      수모형
//   grid     { rows, cols }                   점 배열
//   numline  { from, to, marks?, q? }         수직선. marks 점, q 위치는 ?
//   shapes   { items:[...] }                  도형 나열. circle|triangle|square|rect|star|heart
//   move     { shape, op }                    평면도형 이동 전/후. shape L|F|P|arrow, op flip-h|flip-v|rot90|rot180|'?'
//   ruler    { len, unit? }                   자 위의 막대
//   line     { labels, values, unit?, min?, max?, step? }  꺾은선그래프. min>0이면 세로축 아래에 물결선
//   quad     { type, deg?, angles? }           사각형. type trapezoid|parallelogram|rhombus|rectangle|square
//                                             deg=왼쪽 아래 각(평행사변형·마름모), angles:[70,'?',null,null] 꼭짓점 각 표기
//                                             (꼭짓점 순서: 왼쪽 아래 → 오른쪽 아래 → 오른쪽 위 → 왼쪽 위)
//   bar      { labels, values, unit?, step?, q? }  막대그래프(세로). q:[i]면 그 항목은 막대 없이 ?
//   lines    { type, label? }                 두 직선. type perp(수직)|parallel(평행)|distance(평행선 사이 수선, label 길이)
// ══════════════════════════════════════════════════

const Figures = (() => {
  const W = 240, H = 130;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wrap = (inner, w = W, h = H) =>
    `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"
       style="width:100%;max-width:${w}px;height:auto;display:block;margin:0 auto"
       fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const txt = (x, y, s, size = 14) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="currentColor" stroke="none" text-anchor="middle"
       font-family="inherit" font-weight="700">${esc(s)}</text>`;
  const ACC  = 'rgba(255,215,0,.55)';    // 강조 채움(금색)
  const ACC2 = 'rgba(93,173,226,.5)';    // 보조 채움(하늘)
  const toNum = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  // 정n각형 꼭짓점 (반지름 r, 중심 cx,cy)
  const regular = (n, cx, cy, r, rot = -Math.PI / 2) =>
    Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + i * 2 * Math.PI / n), cy + r * Math.sin(rot + i * 2 * Math.PI / n)]);
  const path = pts => 'M' + pts.map(p => p.map(v => (+v).toFixed(1)).join(' ')).join(' L') + ' Z';

  const K = {
    angle(f) {
      const deg = Math.max(0, Math.min(360, toNum(f.deg, 60)));
      const cx = 60, cy = 100, r = 130;
      const a = -deg * Math.PI / 180;
      const ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
      const ar = 34, ax = cx + ar * Math.cos(a), ay = cy + ar * Math.sin(a);
      const large = deg > 180 ? 1 : 0;
      const arc = `M${cx + ar} ${cy} A${ar} ${ar} 0 ${large} 0 ${ax.toFixed(1)} ${ay.toFixed(1)}`;
      const lab = f.label != null ? f.label : deg + '°';
      const mid = -deg / 2 * Math.PI / 180, lx = cx + 52 * Math.cos(mid), ly = cy + 52 * Math.sin(mid) + 5;
      const mark = deg === 90
        ? `<path d="M${cx + 14} ${cy} L${cx + 14} ${cy - 14} L${cx} ${cy - 14}" stroke-width="1.8"/>`
        : `<path d="${arc}" stroke="${ACC}" stroke-width="3"/>`;
      return wrap(`<line x1="${cx}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
        <line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/>${mark}${txt(lx, ly, lab, 15)}`, W, 120);
    },
    polygon(f) {
      const n = Math.max(3, Math.min(8, toNum(f.n, 3)));
      let pts;
      if (n === 3 && f.shape === 'right') pts = [[40, 110], [200, 110], [40, 20]];
      else if (n === 3 && f.shape === 'iso') pts = [[40, 110], [200, 110], [120, 20]];
      else if (n === 4 && !f.angles) pts = [[50, 105], [190, 105], [190, 25], [50, 25]];
      else pts = regular(n, 120, 68, 52);
      const angs = Array.isArray(f.angles) ? f.angles : [];
      const labels = angs.slice(0, n).map((a, i) => {
        const [x, y] = pts[i]; const dx = 120 - x, dy = 68 - y, len = Math.hypot(dx, dy) || 1;
        return txt(x + dx / len * 24, y + dy / len * 24 + 5, (a === '?' || a == null) ? '?' : a + '°', 13);
      }).join('');
      const marks = (angs.length === 0 && f.shape === 'right') ? `<path d="M40 96 L54 96 L54 110" stroke-width="1.6"/>` : '';
      return wrap(`<path d="${path(pts)}" fill="${ACC2}"/>${marks}${labels}`);
    },
    rect(f) {
      const w = Math.max(1, toNum(f.w, 4)), h = Math.max(1, toNum(f.h, 3)), unit = f.unit || 'cm';
      const scale = Math.min(150 / w, 80 / h), pw = w * scale, ph = h * scale;
      const x = (W - pw) / 2, y = 20 + (80 - ph) / 2;
      return wrap(`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${ACC2}"/>
        ${txt(x + pw / 2, y + ph + 22, `${w} ${unit}`, 13)}${txt(x - 22, y + ph / 2 + 5, `${h} ${unit}`, 13)}`);
    },
    clock(f) {
      const h = ((toNum(f.h, 3) % 12) + 12) % 12, m = Math.max(0, Math.min(59, toNum(f.m, 0)));
      const cx = 120, cy = 65, r = 56;
      const ticks = Array.from({ length: 12 }, (_, i) => {
        const a = i * Math.PI / 6 - Math.PI / 2;
        const x1 = cx + (r - 6) * Math.cos(a), y1 = cy + (r - 6) * Math.sin(a);
        const nx = cx + (r - 17) * Math.cos(a), ny = cy + (r - 17) * Math.sin(a) + 4.5;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(cx + r * Math.cos(a)).toFixed(1)}" y2="${(cy + r * Math.sin(a)).toFixed(1)}"/>${txt(nx, ny, i === 0 ? 12 : i, 11)}`;
      }).join('');
      const ha = ((h + m / 60) * 30 - 90) * Math.PI / 180, ma = (m * 6 - 90) * Math.PI / 180;
      return wrap(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,.06)"/>${ticks}
        <line x1="${cx}" y1="${cy}" x2="${(cx + 28 * Math.cos(ha)).toFixed(1)}" y2="${(cy + 28 * Math.sin(ha)).toFixed(1)}" stroke-width="4.5"/>
        <line x1="${cx}" y1="${cy}" x2="${(cx + 42 * Math.cos(ma)).toFixed(1)}" y2="${(cy + 42 * Math.sin(ma)).toFixed(1)}" stroke-width="2.5" stroke="${ACC}"/>
        <circle cx="${cx}" cy="${cy}" r="3" fill="currentColor"/>`);
    },
    fraction(f) {
      const n = Math.max(1, Math.min(16, toNum(f.n, 4))), k = Math.max(0, Math.min(n, toNum(f.k, 1)));
      if (f.shape === 'bar') {
        const bw = 200 / n;
        return wrap(Array.from({ length: n }, (_, i) => `<rect x="${20 + i * bw}" y="45" width="${bw}" height="40" fill="${i < k ? ACC : 'none'}"/>`).join(''));
      }
      const cx = 120, cy = 65, r = 52;
      if (n === 1) return wrap(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${k ? ACC : 'none'}"/>`);
      const slices = Array.from({ length: n }, (_, i) => {
        const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
        const d = `M${cx} ${cy} L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)} Z`;
        return `<path d="${d}" fill="${i < k ? ACC : 'none'}"/>`;
      }).join('');
      return wrap(slices);
    },
    blocks(f) {
      const hu = Math.max(0, Math.min(9, toNum(f.hundreds, 0))), te = Math.max(0, Math.min(9, toNum(f.tens, 0))), on = Math.max(0, Math.min(9, toNum(f.ones, 0)));
      let x = 10, out = '';
      for (let i = 0; i < hu; i++, x += 30) {
        out += `<rect x="${x}" y="30" width="26" height="70" fill="${ACC2}"/>`;
        for (let j = 1; j <= 6; j++) out += `<line x1="${x}" y1="${30 + j * 10}" x2="${x + 26}" y2="${30 + j * 10}" stroke-width="1"/>`;
      }
      if (hu) x += 10;
      for (let i = 0; i < te; i++, x += 12) out += `<rect x="${x}" y="30" width="8" height="70" fill="${ACC}"/>`;
      if (te) x += 10;
      for (let i = 0; i < on; i++) out += `<rect x="${x + (i % 5) * 12}" y="${92 - Math.floor(i / 5) * 12}" width="8" height="8" fill="currentColor"/>`;
      return wrap(out);
    },
    grid(f) {
      const rows = Math.max(1, Math.min(10, toNum(f.rows, 3))), cols = Math.max(1, Math.min(12, toNum(f.cols, 4)));
      const gx = Math.min(22, 200 / cols), gy = Math.min(22, 100 / rows);
      const x0 = (W - gx * (cols - 1)) / 2, y0 = (H - gy * (rows - 1)) / 2;
      let out = '';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += `<circle cx="${x0 + c * gx}" cy="${y0 + r * gy}" r="5" fill="${ACC}" stroke="none"/>`;
      return wrap(out);
    },
    numline(f) {
      const from = toNum(f.from, 0), to = toNum(f.to, 10);
      if (to <= from) return '';
      const x0 = 20, x1 = 220, y = 70, px = v => x0 + (v - from) / (to - from) * (x1 - x0);
      const step = (to - from) <= 20 ? 1 : Math.ceil((to - from) / 10);
      let out = `<line x1="${x0 - 8}" y1="${y}" x2="${x1 + 8}" y2="${y}"/><path d="M${x1 + 2} ${y - 5} L${x1 + 8} ${y} L${x1 + 2} ${y + 5}"/>`;
      for (let v = from; v <= to; v += step) out += `<line x1="${px(v)}" y1="${y - 6}" x2="${px(v)}" y2="${y + 6}"/>${txt(px(v), y + 24, v, 11)}`;
      (Array.isArray(f.marks) ? f.marks : []).forEach(v => { out += `<circle cx="${px(toNum(v, from))}" cy="${y}" r="6" fill="${ACC}" stroke="none"/>`; });
      if (f.q != null) { const qx = px(toNum(f.q, from)); out += `<circle cx="${qx}" cy="${y}" r="7" fill="rgba(231,76,60,.7)" stroke="none"/>${txt(qx, y - 14, '?', 15)}`; }
      return wrap(out);
    },
    shapes(f) {
      const items = (Array.isArray(f.items) ? f.items : []).slice(0, 12);
      if (!items.length) return '';
      const per = Math.min(6, items.length), rows = Math.ceil(items.length / per), sz = 34, h = sz / 2;
      const gx = Math.min(40, 220 / per), x0 = (W - gx * (per - 1)) / 2, y0 = rows === 1 ? 65 : 40;
      const one = (t, cx, cy) => {
        switch (t) {
          case 'circle':   return `<circle cx="${cx}" cy="${cy}" r="${h}" fill="${ACC2}"/>`;
          case 'triangle': return `<path d="${path([[cx, cy - h], [cx + h, cy + h], [cx - h, cy + h]])}" fill="${ACC}"/>`;
          case 'square':   return `<rect x="${cx - h}" y="${cy - h}" width="${sz}" height="${sz}" fill="rgba(46,204,113,.5)"/>`;
          case 'rect':     return `<rect x="${cx - h - 4}" y="${cy - h + 6}" width="${sz + 8}" height="${sz - 12}" fill="rgba(46,204,113,.5)"/>`;
          case 'star':     return `<path d="${path(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? h * .45 : h, a = -Math.PI / 2 + i * Math.PI / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }))}" fill="${ACC}"/>`;
          case 'heart':    return `<path d="M${cx} ${cy + h} C${cx - h * 1.6} ${cy - h * .2} ${cx - h * .6} ${cy - h * 1.3} ${cx} ${cy - h * .35} C${cx + h * .6} ${cy - h * 1.3} ${cx + h * 1.6} ${cy - h * .2} ${cx} ${cy + h} Z" fill="rgba(231,76,60,.6)"/>`;
          default:         return `<circle cx="${cx}" cy="${cy}" r="${h}" stroke-dasharray="4 3"/>`;
        }
      };
      return wrap(items.map((t, i) => one(t, x0 + (i % per) * gx, y0 + Math.floor(i / per) * 50)).join(''));
    },
    move(f) {
      const S = {
        L:     [[0, 0], [14, 0], [14, 40], [40, 40], [40, 54], [0, 54]],
        F:     [[0, 0], [40, 0], [40, 13], [14, 13], [14, 24], [34, 24], [34, 37], [14, 37], [14, 54], [0, 54]],
        P:     [[0, 0], [30, 0], [42, 12], [42, 26], [30, 38], [14, 38], [14, 54], [0, 54]],
        arrow: [[0, 20], [30, 20], [30, 6], [54, 27], [30, 48], [30, 34], [0, 34]],
      };
      const pts = S[f.shape] || S.L;
      const shape = (tx, ty, transform) => `<g transform="translate(${tx},${ty})"><path d="${path(pts)}" fill="${ACC2}" transform="${transform}"/></g>`;
      const T = { 'flip-h': 'translate(54,0) scale(-1,1)', 'flip-v': 'translate(0,54) scale(1,-1)', 'rot90': 'translate(54,0) rotate(90)', 'rot180': 'translate(54,54) rotate(180)' };
      const label = { 'flip-h': '옆으로 뒤집기', 'flip-v': '위아래 뒤집기', 'rot90': '90° 돌리기', 'rot180': '180° 돌리기' }[f.op] || '';
      const after = f.op === '?' ? txt(178, 60, '?', 30) : shape(150, 25, T[f.op] || '');
      return wrap(`${shape(30, 25, '')}<path d="M100 52 L134 52 M126 45 L134 52 L126 59" stroke="${ACC}" stroke-width="3"/>${after}${txt(120, 120, label, 12)}`);
    },
    ruler(f) {
      const len = Math.max(1, Math.min(15, toNum(f.len, 5))), unit = f.unit || 'cm', px = 200 / 15, x0 = 20;
      let out = `<rect x="${x0 - 4}" y="60" width="212" height="34" fill="rgba(255,255,255,.06)"/>`;
      for (let i = 0; i <= 15; i++) {
        out += `<line x1="${x0 + i * px}" y1="60" x2="${x0 + i * px}" y2="${i % 5 === 0 ? 76 : 68}" stroke-width="${i % 5 === 0 ? 2 : 1.2}"/>`;
        if (i % 5 === 0) out += txt(x0 + i * px, 90, i, 10);
      }
      out += `<rect x="${x0}" y="34" width="${len * px}" height="18" fill="${ACC}"/>${txt(x0 + len * px / 2, 25, `? ${unit}`, 13)}`;
      return wrap(out);
    },
    // [FIG-LINE-QUAD-1] 꺾은선그래프 — 점을 찍고 선분으로 잇는다. 값은 문항 글에도 있으니 점 옆에 숫자는 쓰지 않는다(그래프를 읽게).
    line(f) {
      const vals = (Array.isArray(f.values) ? f.values : []).map(v => toNum(v, NaN)).slice(0, 8);
      const labs = (Array.isArray(f.labels) ? f.labels : []).slice(0, vals.length);
      if (vals.length < 2 || vals.some(v => !Number.isFinite(v))) return '';
      const hi = Math.max(...vals);
      const min = toNum(f.min, 0);
      const step = toNum(f.step, 0) > 0 ? toNum(f.step) : (() => { const r = (hi - min) / 5; const p = Math.pow(10, Math.floor(Math.log10(r || 1))); return [1, 2, 5, 10].map(k => k * p).find(k => k >= r) || p * 10; })();
      const max = toNum(f.max, 0) > min ? toNum(f.max) : min + Math.ceil((hi - min) / step - 1e-9) * step;
      if (max <= min) return '';
      const dec = (String(step).split('.')[1] || '').length;
      const Wd = 260, Hd = 160, x0 = 46, x1 = 246, yT = 22, yB = 126;
      const yM = min > 0 ? yB - 16 : yB;   // 0부터 시작하지 않으면 0과 최솟값 사이를 물결선으로 줄인다
      const py = v => yM - (v - min) / (max - min) * (yM - yT);
      const gx = (x1 - x0) / vals.length, px = i => x0 + gx * (i + .5);
      let out = '';
      const n = Math.round((max - min) / step);
      for (let k = 0; k <= n; k++) {
        const v = min + k * step, y = py(v);
        out += `<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke-width="${k === 0 && !(min > 0) ? 2 : .8}" stroke-opacity="${k === 0 && !(min > 0) ? 1 : .35}"/>`;
        if (n <= 10 || k % 2 === 0) out += `<text x="${x0 - 6}" y="${(y + 4).toFixed(1)}" font-size="10" fill="currentColor" stroke="none" text-anchor="end" font-family="inherit">${esc(v.toFixed(dec))}</text>`;
      }
      out += `<line x1="${x0}" y1="${yT - 6}" x2="${x0}" y2="${yB}"/>`;
      if (min > 0) out += `<line x1="${x0}" y1="${yB}" x2="${x1}" y2="${yB}"/><text x="${x0 - 6}" y="${yB + 4}" font-size="10" fill="currentColor" stroke="none" text-anchor="end" font-family="inherit">0</text>`
        + `<path d="M${x0 - 5} ${yB - 5} l5 -3 l-5 -3 l5 -3" stroke-width="1.8"/>`;   // 물결선(0과 최솟값 사이)
      if (f.unit) out += `<text x="${x0 - 6}" y="${yT - 10}" font-size="10" fill="currentColor" stroke="none" text-anchor="end" font-family="inherit">(${esc(f.unit)})</text>`;
      out += `<polyline points="${vals.map((v, i) => px(i).toFixed(1) + ',' + py(v).toFixed(1)).join(' ')}" stroke="${ACC}" stroke-width="3"/>`;
      out += vals.map((v, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="4" fill="currentColor" stroke="none"/>`).join('');
      out += labs.map((s, i) => `<text x="${px(i).toFixed(1)}" y="${yB + 18}" font-size="10.5" fill="currentColor" stroke="none" text-anchor="middle" font-family="inherit">${esc(s)}</text>`).join('');
      return wrap(out, Wd, Hd);
    },
    // [FIG-BAR-1] 막대그래프 — 세로 막대. q:[칸 번호]인 항목은 막대 없이 '?'(문항이 그 값을 묻을 때)
    bar(f) {
      const labs = (Array.isArray(f.labels) ? f.labels : []).slice(0, 6);
      const qs = new Set(Array.isArray(f.q) ? f.q : []);
      const vals = labs.map((_, i) => qs.has(i) ? NaN : toNum((f.values || [])[i], NaN));
      const known = vals.filter(Number.isFinite);
      if (labs.length < 2 || !known.length || known.length + qs.size !== labs.length) return '';
      const hi = Math.max(...known);
      const step = toNum(f.step, 0) > 0 ? toNum(f.step) : (() => { const r = hi / 5; const p = Math.pow(10, Math.floor(Math.log10(r || 1))); return [1, 2, 5, 10].map(k => k * p).find(k => k >= r) || p * 10; })();
      const max = Math.max(step, Math.ceil(hi / step - 1e-9) * step);
      const Wd = 260, Hd = 160, x0 = 46, x1 = 246, yT = 22, yB = 126;
      const py = v => yB - v / max * (yB - yT);
      const gx = (x1 - x0) / labs.length, bw = Math.min(30, gx * .55), px = i => x0 + gx * (i + .5);
      let out = '';
      const n = Math.round(max / step);
      for (let k = 0; k <= n; k++) {
        const y = py(k * step);
        out += `<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke-width="${k === 0 ? 2 : .8}" stroke-opacity="${k === 0 ? 1 : .35}"/>`;
        out += `<text x="${x0 - 6}" y="${(y + 4).toFixed(1)}" font-size="10" fill="currentColor" stroke="none" text-anchor="end" font-family="inherit">${esc(k * step)}</text>`;
      }
      out += `<line x1="${x0}" y1="${yT - 6}" x2="${x0}" y2="${yB}"/>`;
      if (f.unit) out += `<text x="${x0 - 6}" y="${yT - 10}" font-size="10" fill="currentColor" stroke="none" text-anchor="end" font-family="inherit">(${esc(f.unit)})</text>`;
      out += labs.map((s, i) => {
        const x = px(i);
        const body = Number.isFinite(vals[i])
          ? `<rect x="${(x - bw / 2).toFixed(1)}" y="${py(vals[i]).toFixed(1)}" width="${bw.toFixed(1)}" height="${(yB - py(vals[i])).toFixed(1)}" fill="${ACC2}"/>`
          : txt(x, yB - 14, '?', 16);
        return body + `<text x="${x.toFixed(1)}" y="${yB + 18}" font-size="10.5" fill="currentColor" stroke="none" text-anchor="middle" font-family="inherit">${esc(s)}</text>`;
      }).join('');
      return wrap(out, Wd, Hd);
    },
    // [FIG-LINE-QUAD-1] 사각형 — 평행한 변은 화살표(>, >>), 길이가 같은 변은 눈금, 직각은 ㄱ 표시
    quad(f) {
      const type = f.type || 'parallelogram';
      const cy0 = 108;
      let pts;
      if (type === 'trapezoid') pts = [[40, cy0], [200, cy0], [160, 30], [80, 30]];
      else if (type === 'rectangle') pts = [[45, cy0], [195, cy0], [195, 32], [45, 32]];
      else if (type === 'square') pts = [[82, cy0], [158, cy0], [158, 32], [82, 32]];
      else {
        const rh = type === 'rhombus';
        const deg = Math.max(30, Math.min(150, toNum(f.deg, rh ? 60 : 65)));
        const a = deg * Math.PI / 180, b = rh ? 88 : 120, s = rh ? 88 : 80;
        const dx = s * Math.cos(a), dy = s * Math.sin(a), sc = Math.min(1, 76 / dy);
        const B = b * sc, DX = dx * sc, DY = dy * sc;
        const left = (240 - (B + Math.abs(DX))) / 2 + (DX < 0 ? -DX : 0);
        pts = [[left, cy0], [left + B, cy0], [left + B + DX, cy0 - DY], [left + DX, cy0 - DY]];
      }
      const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cy = pts.reduce((s, p) => s + p[1], 0) / 4;
      const mid = (i) => { const p = pts[i], q = pts[(i + 1) % 4]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.atan2(q[1] - p[1], q[0] - p[0])]; };
      const chevron = (i, k) => { const [mx, my, t0] = mid(i), t = i >= 2 ? t0 + Math.PI : t0; let d = '';
        for (let j = 0; j < k; j++) { const o = (j - (k - 1) / 2) * 7, x = mx + o * Math.cos(t), y = my + o * Math.sin(t);
          d += `M${(x - 5 * Math.cos(t) - 4 * Math.sin(t)).toFixed(1)} ${(y - 5 * Math.sin(t) + 4 * Math.cos(t)).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} L${(x - 5 * Math.cos(t) + 4 * Math.sin(t)).toFixed(1)} ${(y - 5 * Math.sin(t) - 4 * Math.cos(t)).toFixed(1)} `; }
        return `<path d="${d}" stroke="${ACC}" stroke-width="2.4"/>`; };
      const tick = (i) => { const [mx, my, t] = mid(i); const nx = -Math.sin(t) * 6, ny = Math.cos(t) * 6;
        return `<line x1="${(mx - nx).toFixed(1)}" y1="${(my - ny).toFixed(1)}" x2="${(mx + nx).toFixed(1)}" y2="${(my + ny).toFixed(1)}" stroke-width="2"/>`; };
      const right = (i) => { const p = pts[i], a = pts[(i + 1) % 4], b = pts[(i + 3) % 4];
        const u = [(a[0] - p[0]), (a[1] - p[1])], v = [(b[0] - p[0]), (b[1] - p[1])], lu = Math.hypot(...u), lv = Math.hypot(...v), k = 12;
        const q1 = [p[0] + u[0] / lu * k, p[1] + u[1] / lu * k], q2 = [p[0] + v[0] / lv * k, p[1] + v[1] / lv * k];
        return `<path d="M${q1[0].toFixed(1)} ${q1[1].toFixed(1)} L${(q1[0] + q2[0] - p[0]).toFixed(1)} ${(q1[1] + q2[1] - p[1]).toFixed(1)} L${q2[0].toFixed(1)} ${q2[1].toFixed(1)}" stroke-width="1.6"/>`; };
      let marks = '';
      if (type === 'trapezoid') marks = chevron(0, 1) + chevron(2, 1);
      else if (type === 'parallelogram') marks = chevron(0, 1) + chevron(2, 1) + chevron(1, 2) + chevron(3, 2);
      else if (type === 'rhombus') marks = [0, 1, 2, 3].map(tick).join('');   // 마름모는 네 변이 같다는 눈금만(화살표까지 겹치면 복잡)
      else if (type === 'rectangle') marks = [0, 1, 2, 3].map(right).join('');
      else if (type === 'square') marks = [0, 1, 2, 3].map(right).join('') + [0, 1, 2, 3].map(tick).join('');
      const angs = Array.isArray(f.angles) ? f.angles : [];
      const labels = angs.slice(0, 4).map((a, i) => {
        if (a == null) return '';
        const [x, y] = pts[i]; const dx = cx - x, dy = cy - y, len = Math.hypot(dx, dy) || 1;
        return txt(x + dx / len * 26, y + dy / len * 26 + 5, a === '?' ? '?' : a + '°', 13);
      }).join('');
      return wrap(`<path d="${path(pts)}" fill="${ACC2}"/>${marks}${labels}`);
    },
    // [FIG-LINE-QUAD-1] 두 직선 — 수직·평행·평행선 사이의 거리
    lines(f) {
      if (f.type === 'perp') return wrap(`<line x1="30" y1="96" x2="210" y2="96"/><line x1="120" y1="14" x2="120" y2="120"/>
        <path d="M120 82 L134 82 L134 96" stroke-width="1.8"/>`);
      const par = `<line x1="20" y1="34" x2="220" y2="34"/><line x1="20" y1="100" x2="220" y2="100"/>`;
      if (f.type === 'parallel') return wrap(par);
      if (f.type === 'distance') return wrap(`${par}<line x1="120" y1="34" x2="120" y2="100" stroke="${ACC}" stroke-width="3"/>
        <path d="M120 86 L134 86 L134 100" stroke-width="1.6"/>${txt(160, 72, f.label != null ? f.label : '?', 14)}`);
      return '';
    },
  };

  function render(fig) {
    if (!fig || typeof fig !== 'object' || !K[fig.kind]) return '';
    try { return K[fig.kind](fig); }
    catch (e) { console.warn('[Figures] 렌더 실패:', fig, e); return ''; }
  }
  return { render, kinds: Object.keys(K) };
})();
