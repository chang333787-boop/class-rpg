// 붓 — 한지 위에 털 여러 가닥으로 긋는다. 가닥마다 먹이 따로 줄어 먹이 적으면 끝이 갈라지고(마른 붓 · 비백),
//  붓을 오래 누를수록 점이 커지고(누르는 시간), 천천히 그을수록 굵다(빠르기 = 붓을 드는 정도), 물을 많이 머금으면 번진다.
//  그리기: 붓질 하나는 따로 된 층에 털마다 끊김 없는 선으로(불투명 — 마디 · 줄무늬가 안 생김) 그리고, 다 그으면 종이에 '곱하기'로 얹는다
//   → 먹은 빛을 거르는 막이라 겹칠수록 진해진다(inkcolor.js 비어-람베르트와 같은 생각 · 종이 위 한 겹 = 그 먹색 그대로).
//  붓질 하나가 끝날 때마다 onStroke({ dot, len, avgW, maxW, dry, wet, tone }) — judge.js 가 센다.
import { h } from './util.js';
import { inkRgb, PAPER } from './inkcolor.js';

const N = 16, MAXW = 26, MINW = 3, SOLID = 0.15;
const seeded = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const P255 = PAPER.map(v => Math.round(v * 255));
// 곱하기 색 — 종이 위에 곱하면 정확히 그 먹색이 되는 색(먹색 ÷ 종이색)
const mulOf = tone => inkRgb(tone.ink, tone.water).map((v, i) => Math.min(1, v * 255 / P255[i]));
const css = (m, k = 1) => `rgb(${m.map(v => Math.round(255 * (1 - (1 - v) * k))).join(',')})`;   // k<1 = 더 옅게(하양 쪽)

export function makeBrush(wrap, { onStroke = () => {} } = {}) {
  const canvas = h('canvas', { class: 'paper' });
  const ring = h('span', { class: 'press-ring' });
  wrap.append(canvas, ring);
  const view = canvas.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  const layer = document.createElement('canvas'), lx = layer.getContext('2d');
  let W = 0, H = 0, dpr = 1, tone = { k: 't1', ink: 1, water: 0 }, load = 'full', wet = false, cur = null, bristles = [], raf = 0, ringRaf = 0;

  function paper() {
    bx.save(); bx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bx.fillStyle = `rgb(${P255.join(',')})`; bx.fillRect(0, 0, W, H);
    const r = seeded(11);   // 한지 섬유 결 — 늘 같은 결(다시 깔아도 같은 종이)
    for (let i = 0; i < Math.round(W * H / 900); i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = 6 + r() * 24;
      bx.strokeStyle = r() < 0.55 ? 'rgba(255,255,255,.4)' : 'rgba(120,95,60,.07)'; bx.lineWidth = 0.5 + r() * 0.9;
      bx.beginPath(); bx.moveTo(x, y); bx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 7, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 7, x + Math.cos(a) * l, y + Math.sin(a) * l); bx.stroke();
    }
    bx.restore();
  }
  // 보이는 화면 = 종이(+ 앞 붓질) × 지금 붓질
  function compose() {
    raf = 0;
    view.setTransform(1, 0, 0, 1, 0, 0);
    view.globalCompositeOperation = 'source-over'; view.drawImage(base, 0, 0);
    if (cur) { view.globalCompositeOperation = 'multiply'; view.drawImage(layer, 0, 0); view.globalCompositeOperation = 'source-over'; }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(compose); };
  function fit() {
    const b = wrap.getBoundingClientRect();
    if (!b.width || !b.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1); W = b.width; H = b.height;
    for (const c of [canvas, base, layer]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paper(); compose();
  }
  //  붓에 먹 묻히기 — 털마다 먹 양 · 마르는 빠르기 · 흔들림이 조금씩 달라 갈라지는 자리가 늘 다르다('조금' = 30%)
  function dip() {
    const amt = load === 'full' ? 1 : 0.3;
    bristles = Array.from({ length: N }, (_, i) => ({ off: i / (N - 1) - 0.5 + (Math.random() - 0.5) * 0.04, ink: amt * (0.6 + Math.random() * 0.8), rate: 0.0011 * (0.7 + Math.random() * 0.7), ph: Math.random() * 6.28,
      k: load === 'full' ? 0.94 + Math.random() * 0.06 : 0.86 + Math.random() * 0.14, on: true, run: 0, last: null }));
  }
  const pos = e => { const b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top, t: performance.now() }; };

  // 번진 먹 자국 · 점 — 둘레가 고르지 않은 동그라미(사인 셋을 겹친 울퉁불퉁)
  function blotPath(x, y, r, rough) {
    const p = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28], n = 40, path = new Path2D();
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2, rr = r * (1 + rough * (0.5 * Math.sin(3 * a + p[0]) + 0.3 * Math.sin(5 * a + p[1]) + 0.2 * Math.sin(9 * a + p[2])));
      const X = x + Math.cos(a) * rr, Y = y + Math.sin(a) * rr;
      k ? path.lineTo(X, Y) : path.moveTo(X, Y);
    }
    path.closePath();
    return path;
  }
  function blot(x, y, r, fill, rough) { lx.fillStyle = fill; lx.fill(blotPath(x, y, r, rough)); }
  // 한지 섬유를 타고 번지는 가는 실 자국(번짐 가장자리)
  function feathers(x, y, r, stroke) {
    lx.strokeStyle = stroke; lx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const a = Math.random() * Math.PI * 2, r0 = r * (0.9 + Math.random() * 0.1), r1 = r0 + r * (0.06 + Math.random() * 0.14);
      lx.lineWidth = 0.6 + Math.random() * 0.8; lx.beginPath(); lx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); lx.lineTo(x + Math.cos(a + (Math.random() - 0.5) * 0.3) * r1, y + Math.sin(a + (Math.random() - 0.5) * 0.3) * r1); lx.stroke();
    }
  }
  // 번짐 테 — 가운데는 진하고 바깥으로 갈수록 옅게, 마른 가장자리에 먹이 조금 모인 테(물 자국)
  function halo(x, y, r0, r1, m, k) {
    const path = blotPath(x, y, r1, 0.26);
    const g = lx.createRadialGradient(x, y, r0 * 0.9, x, y, r1 * 1.05);
    g.addColorStop(0, css(m, 0.55 * k)); g.addColorStop(0.6, css(m, 0.28 * k)); g.addColorStop(1, css(m, 0.17 * k));
    lx.fillStyle = g; lx.fill(path);
    lx.strokeStyle = css(m, 0.24 * k); lx.lineWidth = 1.4; lx.stroke(path);   // 물이 마른 가장자리에 먹이 조금 모인 테(같은 모양)
    feathers(x, y, r1, css(m, 0.16 * k));
  }
  function dot(p, r) {
    const m = mulOf(tone), k = load === 'full' ? 1 : 0.7;
    if (cur.wet) halo(p.x, p.y, r, r * 2.2, m, k);   // 번짐 — 한지가 물을 빨아들여 둘레로 옅게 퍼진다
    blot(p.x, p.y, r, css(m, 0.97 * k), 0.08);
  }
  function seg(a, b, w) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 0.5) return;
    const nx = -dy / L, ny = dx / L, m = mulOf(tone);
    lx.lineCap = 'round'; lx.lineJoin = 'round';
    if (cur.wet) {   // 번짐 — 붓질 뒤(이미 그린 것 아래)로 넓고 옅게
      lx.globalCompositeOperation = 'destination-over';
      //  번짐 폭은 붓질 따라 들쭉날쭉(물이 한지 섬유를 따라 고르지 않게 번진다)
      const wob = 1 + 0.1 * Math.sin(cur.len * 0.022 + cur.ph) + 0.05 * Math.sin(cur.len * 0.061 + cur.ph * 2);
      for (const [k, f, j] of [[0.16, 2.3, 1.2], [0.27, 1.8, 0.8], [0.42, 1.35, 0.4]]) {
        const sh = Math.sin(cur.len * 0.02 + cur.ph + f) * j;
        lx.strokeStyle = css(m, k); lx.lineWidth = w * f * wob; lx.beginPath(); lx.moveTo(a.x + nx * sh, a.y + ny * sh); lx.lineTo(b.x + nx * sh, b.y + ny * sh); lx.stroke();
      }
      lx.globalCompositeOperation = 'source-over';
    }
    let solid = 0;
    const len0 = cur.len, pieces = Math.max(1, Math.ceil(L / 3));
    cur.len += L;
    const dry = load === 'dry';
    for (const br of bristles) {
      if (br.ink <= 0.03) { br.ink = 0; br.last = null; continue; }   // 먹이 다 떨어진 털은 더 묻지 않는다
      //  묻는 정도 q — 먹이 넉넉하면 늘 묻고(1), 마를수록 묻는 길이는 짧게 · 비는 길이는 길게(비백 — 털 자국이 길쭉하게 끊긴다)
      //  붓 가장자리 털(e → 1)은 더 흔들리고 가끔 비어 테두리가 매끈한 띠처럼 보이지 않게
      const e = Math.min(1, Math.abs(br.off) * 2), q = Math.min(1, br.ink / (dry ? 0.42 : SOLID)) * (dry ? 0.85 * (1 - 0.3 * e * e) : 1 - 0.15 * e ** 6);
      if (q >= 0.98) solid++;
      lx.strokeStyle = css(m, br.k * (dry ? 0.9 : 0.86 + 0.14 * Math.min(1, br.ink / 0.6))); lx.lineWidth = dry ? Math.max(0.9, (w / N) * 1.5) : Math.max(1, (w / N) * 2.2);
      lx.beginPath();
      for (let j = 1; j <= pieces; j++) {
        const t = j / pieces, s = len0 + L * t, o = br.off * w + Math.sin(s * 0.045 + br.ph) * (0.5 + (dry ? 1.6 : 0.9) * e * e);
        const p1 = { x: a.x + dx * t + nx * o, y: a.y + dy * t + ny * o };
        if (q < 0.98) {
          br.run -= L / pieces;
          if (br.run <= 0) { br.on = !br.on; br.run = -Math.log(Math.random() + 1e-6) * (br.on ? 25 + 140 * q : 6 + 50 * (1 - q)); }
        } else br.on = true;
        if (br.on && br.last) { lx.moveTo(br.last.x, br.last.y); lx.lineTo(p1.x, p1.y); }
        br.last = br.on ? p1 : null;
      }
      lx.stroke();
      br.ink -= L * br.rate * (cur.wet ? 0.6 : 1) * (0.6 + w / MAXW);
    }
    cur.wsum += w * L; cur.maxW = Math.max(cur.maxW, w);
    if (solid < N * 0.6) cur.dryLen += L;
  }
  //  붓을 뗄 때(수필) — 털마다 조금씩 더 나가다 끝나 끝이 칼로 자른 듯 네모나지 않게(가운데 털이 더 길게 → 둥글고 갈라진 끝)
  function tail() {
    if (!cur.dir) return;
    const m = mulOf(tone), w = cur.w, nx = -cur.dir.y, ny = cur.dir.x;
    lx.lineCap = 'round';
    for (const br of bristles) {
      if (!br.last || br.ink <= 0.03) continue;
      const e = Math.min(1, Math.abs(br.off) * 2), ext = w * (0.15 + 0.55 * (1 - e * e)) * (0.6 + Math.random() * 0.6);
      lx.strokeStyle = css(m, br.k * 0.9); lx.lineWidth = Math.max(0.8, (w / N) * (load === 'dry' ? 1.2 : 1.8));
      lx.beginPath(); lx.moveTo(br.last.x, br.last.y); lx.lineTo(br.last.x + cur.dir.x * ext + nx * (Math.random() - 0.5), br.last.y + cur.dir.y * ext + ny * (Math.random() - 0.5)); lx.stroke();
    }
  }
  const holdR = () => 3 + 14 * Math.min(1, (performance.now() - cur.t0) / 700);
  function showRing() {
    if (!cur || cur.moved) { ring.style.display = 'none'; return; }
    const r = holdR(); ring.style.display = 'block'; ring.style.width = ring.style.height = r * 2 + 'px';
    ring.style.left = cur.p0.x - r + 'px'; ring.style.top = cur.p0.y - r + 'px';
    ringRaf = requestAnimationFrame(showRing);
  }

  canvas.addEventListener('pointerdown', e => {
    if (cur) return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    const p = pos(e); dip();
    lx.save(); lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, layer.width, layer.height); lx.restore();
    cur = { id: e.pointerId, p0: p, last: p, t0: p.t, w: MAXW * 0.7, moved: false, len: 0, wsum: 0, maxW: 0, dryLen: 0, wet, ph: Math.random() * 6.28, dir: null };
    showRing();
  });
  canvas.addEventListener('pointermove', e => {
    if (!cur || e.pointerId !== cur.id) return;
    const p = pos(e), d = Math.hypot(p.x - cur.last.x, p.y - cur.last.y);
    if (!cur.moved && Math.hypot(p.x - cur.p0.x, p.y - cur.p0.y) < 6) return;
    if (!cur.moved) {   // 붓을 댄 자리 — 누른 만큼의 둥근 시작(기필)
      cur.moved = true; cur.w = Math.min(MAXW, holdR() * 2); ring.style.display = 'none';
      const m = mulOf(tone);
      if (cur.wet) { lx.globalCompositeOperation = 'destination-over'; halo(cur.p0.x, cur.p0.y, cur.w / 2, cur.w * 1.15, m, 1); lx.globalCompositeOperation = 'source-over'; }
      if (load === 'full') blot(cur.p0.x, cur.p0.y, cur.w / 2, css(m, 0.95), 0.08);
    }
    const dt = Math.max(1, p.t - cur.last.t), speed = d / dt;
    //  굵기 = 붓을 누른 정도. 펜(필압이 있는 기기)은 누르는 힘 그대로, 마우스 · 터치패드 · 손가락은 빠르기로(천천히 = 눌러서 굵게 · 빠르게 = 들어서 가늘게)
    const press = e.pointerType === 'pen' && e.pressure > 0 ? Math.min(1, e.pressure * 1.25) : 1.1 - speed * 0.9;
    const target = Math.max(MINW, MAXW * Math.max(0.1, Math.min(1, press)));
    cur.w = cur.w * 0.7 + target * 0.3;
    if (d > 0.5) cur.dir = { x: (p.x - cur.last.x) / d, y: (p.y - cur.last.y) / d };
    seg(cur.last, p, cur.w); cur.last = p;
    schedule();
  });
  const end = e => {
    if (!cur || e.pointerId !== cur.id) return;
    cancelAnimationFrame(ringRaf); ring.style.display = 'none';
    let st;
    if (!cur.moved) { const r = holdR(); dot(cur.p0, r); st = { dot: true, len: 0, avgW: r * 2, maxW: r * 2, dry: 0 }; }
    else { tail(); st = { dot: false, len: Math.round(cur.len), avgW: cur.len ? cur.wsum / cur.len : 0, maxW: cur.maxW, dry: cur.len ? cur.dryLen / cur.len : 0 }; }
    st.wet = cur.wet; st.tone = tone.k; st.load = load;
    //  다 그은 붓질을 종이에 얹는다(곱하기 — 겹치면 더 진하게)
    bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'multiply'; bx.drawImage(layer, 0, 0); bx.restore();
    cur = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    compose();
    onStroke(st);
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  const ro = new ResizeObserver(() => fit()); ro.observe(wrap);
  requestAnimationFrame(fit);
  return {
    canvas,
    setTone(t) { tone = t; }, setLoad(l) { load = l; }, setWet(v) { wet = !!v; },
    clear() { paper(); compose(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); cancelAnimationFrame(ringRaf); },
  };
}
