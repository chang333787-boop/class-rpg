// ══════════════════════════════════════════════════
//  학습지 스캔 엔진 (SCAN-1) — 순수 JS, 외부 라이브러리·CDN 없음
//  사진 → ① 종이 테두리 찾기 → ② 원근 보정 → ③ 스캔 필터 → ④ ≤500KB JPEG
//  · 검출은 긴 변 800px 축소본에서, 워프는 원본(긴 변 최대 2400px로 줄인 것)에서 한 번만 한다.
//  · DOM은 캔버스 만들 때만 쓴다. 나머지는 ImageData(가로·세로·RGBA 배열)만 다루는 순수 함수.
// ══════════════════════════════════════════════════
const Scan = (() => {
  const DETECT_MAX = 800, SOURCE_MAX = 2400, OUT_MAX = 1600, LIMIT_BYTES = 500 * 1024;

  // ── 캔버스 도우미 ─────────────────────────────
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function scaledImageData(img, max) {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    const c = canvasOf(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    return { data: g.getImageData(0, 0, w, h), k };
  }
  async function loadImage(file) {
    // createImageBitmap은 사진의 EXIF 회전을 반영한다(폰 세로 사진이 눕지 않게)
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* 아래로 */ }
    }
    return await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); });
  }

  // ── ① 테두리 찾기 ─────────────────────────────
  function luminance(id) {
    const { width: w, height: h, data: d } = id, y = new Float32Array(w * h);
    for (let i = 0, p = 0; i < y.length; i++, p += 4) y[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    return y;
  }
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      let s = 0; const row = y * w;
      for (let x = -r; x <= r; x++) s += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = s / n;
        s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = s / n;
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }
  function otsu(y) {
    const hist = new Float64Array(256);
    for (let i = 0; i < y.length; i++) hist[Math.min(255, y[i] | 0)]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let wB = 0, sB = 0, best = 0, th = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = y.length - wB; if (!wF) break;
      sB += t * hist[t];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; th = t; }
    }
    return th;
  }
  // 밝은 영역 중 가장 큰 덩어리의 네 모서리. 종이 = 주변보다 밝다.
  //   조명이 고르지 않아도(그림자) 되게, 큰 블러로 나눈 "국소 밝기"도 함께 본다.
  function detectCorners(id) {
    const { width: w, height: h } = id;
    const y = boxBlur(luminance(id), w, h, 2);
    const cands = [];
    for (const mode of ['global', 'local']) {
      let img = y;
      if (mode === 'local') {   // 채도가 낮고(흰 종이) 밝은 곳 — 그림자 속 종이도 배경보다는 밝다
        const d = id.data, s = new Float32Array(w * h);
        for (let i = 0, p = 0; i < s.length; i++, p += 4) {
          const mx = Math.max(d[p], d[p + 1], d[p + 2]), mn = Math.min(d[p], d[p + 1], d[p + 2]);
          s[i] = y[i] * (1 - Math.min(1, (mx - mn) / (mx + 1) * 2.2));   // 색이 진한 곳(나무·체크무늬)은 어둡게
        }
        img = boxBlur(s, w, h, 2);
      }
      const th = otsu(img);
      const bin = new Uint8Array(w * h);
      for (let i = 0; i < bin.length; i++) bin[i] = img[i] > th ? 1 : 0;
      const c = largestBlobCorners(bin, w, h);
      if (c) cands.push({ ...c, mode });
    }
    // 네모다움 점수가 가장 좋은 것
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0];
    if (!best || best.score < 0.55) return { ok: false, corners: insetQuad(w, h), score: best ? best.score : 0, w, h };
    return { ok: true, corners: best.corners, score: best.score, mode: best.mode, w, h };
  }
  function insetQuad(w, h) { const mx = w * 0.1, my = h * 0.1; return [[mx, my], [w - mx, my], [w - mx, h - my], [mx, h - my]]; }
  function largestBlobCorners(bin, w, h) {
    const lab = new Int32Array(w * h), stack = new Int32Array(w * h);
    let bestId = 0, bestN = 0, id = 0;
    for (let i = 0; i < bin.length; i++) {
      if (!bin[i] || lab[i]) continue;
      id++; let sp = 0, n = 0; stack[sp++] = i; lab[i] = id;
      while (sp) {
        const p = stack[--sp]; n++;
        const x = p % w;
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
        if (p >= w && bin[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
        if (p < w * (h - 1) && bin[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
      }
      if (n > bestN) { bestN = n; bestId = id; }
    }
    if (bestN < w * h * 0.12) return null;
    // 덩어리의 가장자리 점 → 볼록 껍질 → 네 꼭짓점(껍질에서 넓이가 가장 큰 사각형에 가까운 네 점)
    const pts = [];
    for (let yy = 0; yy < h; yy++) {
      let left = -1, right = -1;
      for (let x = 0; x < w; x++) if (lab[yy * w + x] === bestId) { if (left < 0) left = x; right = x; }
      if (left >= 0) { pts.push([left, yy]); if (right !== left) pts.push([right, yy]); }
    }
    const hull = convexHull(pts);
    if (hull.length < 4) return null;
    const corners = maxAreaQuad(hull);
    const area = Math.abs(polyArea(corners)), hullArea = Math.abs(polyArea(hull));
    // 점수: 사각형이 껍질을 얼마나 채우나 × 덩어리가 사각형을 얼마나 채우나 × 각도가 직각에 가까운가
    const fillHull = area / (hullArea || 1), fillBlob = Math.min(1, bestN / (area || 1));
    const touches = corners.filter(([x, yy]) => x < 2 || yy < 2 || x > w - 3 || yy > h - 3).length;   // 화면 끝에 붙은 덩어리 = 배경일 가능성
    const score = fillHull * fillBlob * angleScore(corners) * (touches >= 3 ? 0.4 : 1) * (area / (w * h) > 0.97 ? 0.3 : 1);
    return { corners: orderCorners(corners), score };
  }
  function convexHull(p) {
    p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function polyArea(q) { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function maxAreaQuad(hull) {
    // 껍질 점이 많으면 고르게 줄여서(최대 60점) 네 점 조합 중 넓이 최대 — 60C4 ≈ 49만, 대신 회전 캘리퍼 대용으로 O(n²)
    let H = hull;
    if (H.length > 60) { const step = H.length / 60; H = Array.from({ length: 60 }, (_, i) => hull[Math.floor(i * step)]); }
    const n = H.length; let best = null, bestA = -1;
    for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
      // i, k를 대각선으로 두고 양쪽에서 가장 먼 점
      let j = -1, dj = -1, l = -1, dl = -1;
      const ax = H[i][0], ay = H[i][1], bx = H[k][0], by = H[k][1];
      for (let m = i + 1; m < k; m++) { const d = Math.abs((bx - ax) * (H[m][1] - ay) - (by - ay) * (H[m][0] - ax)); if (d > dj) { dj = d; j = m; } }
      for (let m = k + 1; m < n + i; m++) { const q = H[m % n]; const d = Math.abs((bx - ax) * (q[1] - ay) - (by - ay) * (q[0] - ax)); if (d > dl) { dl = d; l = m % n; } }
      if (j < 0 || l < 0) continue;
      const A = (dj + dl) / 2;
      if (A > bestA) { bestA = A; best = [H[i], H[j], H[k], H[l]]; }
    }
    return best || H.slice(0, 4);
  }
  function orderCorners(q) {   // 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래
    const s = q.map(p => p[0] + p[1]), d = q.map(p => p[0] - p[1]);
    const tl = q[s.indexOf(Math.min(...s))], br = q[s.indexOf(Math.max(...s))];
    const tr = q[d.indexOf(Math.max(...d))], bl = q[d.indexOf(Math.min(...d))];
    const out = [tl, tr, br, bl];
    return new Set(out).size === 4 ? out : sortByAngle(q);
  }
  function sortByAngle(q) {
    const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
    const r = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let i0 = 0; r.forEach((p, i) => { if (p[0] + p[1] < r[i0][0] + r[i0][1]) i0 = i; });
    return [0, 1, 2, 3].map(k => r[(i0 + k) % 4]);
  }
  function angleScore(q) {
    let worst = 1;
    for (let i = 0; i < 4; i++) {
      const a = q[(i + 3) % 4], b = q[i], c = q[(i + 1) % 4];
      const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
      const cos = Math.abs((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1));
      worst = Math.min(worst, 1 - Math.max(0, cos - 0.25) / 0.75);   // 75° 안쪽 기울기까지는 감점 없음
    }
    return worst;
  }

  // ── ② 원근 보정 ─────────────────────────────
  // 출력 사각형(0,0)-(W,H) → 사진 속 네 점. 8원 연립방정식.
  function homography(dst, src) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = dst[i], [u, v] = src[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {   // 가우스 소거(부분 피벗)
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) if (r !== c) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    return b.map((v, i) => v / A[i][i]);
  }
  function outputSize(q) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let W = (d(q[0], q[1]) + d(q[3], q[2])) / 2, H = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
    const r = H / W, A4 = Math.SQRT2;
    if (Math.abs(r - A4) / A4 < 0.08) H = W * A4;          // 세로 A4에 가까우면 A4로
    else if (Math.abs(1 / r - A4) / A4 < 0.08) W = H * A4; // 가로 A4
    const k = Math.min(1, OUT_MAX / Math.max(W, H));
    return [Math.round(W * k), Math.round(H * k)];
  }
  function warp(src, quad) {
    const [W, H] = outputSize(quad);
    const h = homography([[0, 0], [W, 0], [W, H], [0, H]], quad);
    const out = new ImageData(W, H), o = out.data, s = src.data, sw = src.width, sh = src.height;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const z = h[6] * x + h[7] * y + 1;
        const u = (h[0] * x + h[1] * y + h[2]) / z, v = (h[3] * x + h[4] * y + h[5]) / z;
        const x0 = Math.max(0, Math.min(sw - 2, u | 0)), y0 = Math.max(0, Math.min(sh - 2, v | 0));
        const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0));
        const p00 = (y0 * sw + x0) * 4, p10 = p00 + 4, p01 = p00 + sw * 4, p11 = p01 + 4;
        const q = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) {
          const top = s[p00 + c] + (s[p10 + c] - s[p00 + c]) * fx, bot = s[p01 + c] + (s[p11 + c] - s[p01 + c]) * fx;
          o[q + c] = top + (bot - top) * fy;
        }
        o[q + 3] = 255;
      }
    }
    return out;
  }

  // ── ③ 스캔 필터 ─────────────────────────────
  // 조명 추정(작게 줄여 크게 블러 → 다시 늘림)으로 나눠 그림자를 편다 → 양 끝 2% 잘라 대비를 편다.
  function scanFilter(id, mode) {
    const { width: w, height: h, data: d } = id;
    const f = 8, sw = Math.max(1, Math.ceil(w / f)), sh = Math.max(1, Math.ceil(h / f));
    const small = new Float32Array(sw * sh), cnt = new Float32Array(sw * sh);
    const Y = luminance(id);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y / f) | 0) * sw + ((x / f) | 0); small[i] += Y[y * w + x]; cnt[i]++; }
    for (let i = 0; i < small.length; i++) small[i] /= cnt[i];
    // 글씨(어두운 점)가 조명 추정을 끌어내리지 않게 — 작은 칸마다 이웃 최댓값(팽창) 한 번 뒤 블러
    const dil = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let m = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const yy = Math.min(sh - 1, Math.max(0, y + dy)), xx = Math.min(sw - 1, Math.max(0, x + dx));
        m = Math.max(m, small[yy * sw + xx]);
      }
      dil[y * sw + x] = m;
    }
    const illum = boxBlur(dil, sw, sh, 4);
    const out = new ImageData(w, h), o = out.data;
    const norm = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const gy = Math.min(sh - 1.001, Math.max(0, y / f - 0.5)), y0 = gy | 0, ty = gy - y0;
      for (let x = 0; x < w; x++) {
        const gx = Math.min(sw - 1.001, Math.max(0, x / f - 0.5)), x0 = gx | 0, tx = gx - x0;
        const i00 = y0 * sw + x0, i10 = i00 + (x0 + 1 < sw ? 1 : 0), i01 = i00 + (y0 + 1 < sh ? sw : 0), i11 = i01 + (i10 - i00);
        const L = (illum[i00] * (1 - tx) + illum[i10] * tx) * (1 - ty) + (illum[i01] * (1 - tx) + illum[i11] * tx) * ty;
        norm[y * w + x] = Math.max(1, L);
      }
    }
    // 대비 폄: 나눈 값의 분포에서 양 끝 잘라 내기
    const ratio = new Float32Array(w * h);
    for (let i = 0; i < ratio.length; i++) ratio[i] = Y[i] / norm[i];
    const sample = []; for (let i = 0; i < ratio.length; i += 37) sample.push(ratio[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.02)], hi = Math.min(1.05, sample[Math.floor(sample.length * 0.9)]);
    const span = Math.max(0.05, hi - lo);
    for (let i = 0, p = 0; i < ratio.length; i++, p += 4) {
      let t = (ratio[i] - lo) / span; t = Math.max(0, Math.min(1, t));
      t = t < 0.5 ? t * t * 2 * 0.9 + t * 0.1 : 1 - (1 - t) * (1 - t) * 2 * 0.9 - (1 - t) * 0.1;   // 부드러운 S자 — 연필 글씨는 진하게, 종이는 하얗게
      if (mode === 'color') {
        const g = t * 255 / Math.max(1, Y[i]);
        o[p] = Math.min(255, d[p] * g); o[p + 1] = Math.min(255, d[p + 1] * g); o[p + 2] = Math.min(255, d[p + 2] * g);
      } else { const v = t * 255; o[p] = o[p + 1] = o[p + 2] = v; }
      o[p + 3] = 255;
    }
    return out;
  }

  // ── ④ JPEG ≤500KB ─────────────────────────────
  async function toJpeg(id) {
    let c = canvasOf(id.width, id.height); c.getContext('2d').putImageData(id, 0, 0);
    const blobOf = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    for (let round = 0; round < 3; round++) {
      for (let q = 0.85; q >= 0.5; q -= 0.05) {
        const b = await blobOf(c, q);
        if (b.size <= LIMIT_BYTES) return { blob: b, quality: +q.toFixed(2), width: c.width, height: c.height };
      }
      const k = 0.8, n = canvasOf(Math.round(c.width * k), Math.round(c.height * k));
      n.getContext('2d').drawImage(c, 0, 0, n.width, n.height); c = n;
    }
    const b = await blobOf(c, 0.5);
    return { blob: b, quality: 0.5, width: c.width, height: c.height };
  }

  // ── 한 번에 ─────────────────────────────
  //  prepare(file) → { img, small, detect } : 사진 읽고 테두리 찾기(화면에 손잡이로 보여 줄 값)
  //  finish(prep, cornersSmall, mode) → { blob, url, ms } : 원근 보정·필터·JPEG
  async function prepare(file) {
    const t0 = performance.now();
    const img = await loadImage(file);
    const small = scaledImageData(img, DETECT_MAX);
    const detect = detectCorners(small.data);
    return { img, small, detect, ms: Math.round(performance.now() - t0) };
  }
  async function finish(prep, cornersSmall, mode = 'color') {
    const t0 = performance.now();
    const src = scaledImageData(prep.img, SOURCE_MAX);
    const s = src.k / prep.small.k;
    const quad = cornersSmall.map(([x, y]) => [x * s, y * s]);
    const t1 = performance.now();
    const flat = warp(src.data, quad);
    const t2 = performance.now();
    const clean = mode === 'none' ? flat : scanFilter(flat, mode);
    const t3 = performance.now();
    const jpg = await toJpeg(clean);
    const t4 = performance.now();
    return { ...jpg, url: URL.createObjectURL(jpg.blob), ms: { read: Math.round(t1 - t0), warp: Math.round(t2 - t1), filter: Math.round(t3 - t2), jpeg: Math.round(t4 - t3), total: Math.round(t4 - t0) } };
  }
  return { prepare, finish, detectCorners, homography, warp, scanFilter, orderCorners, LIMIT_BYTES };
})();
if (typeof window !== 'undefined') window.Scan = Scan;
