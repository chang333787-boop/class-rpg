// 마을 사냥 하네스 — 판 여럿 × N초를 **화면(그려진 자리)** 으로 돌려 어설픔을 PASS/FAIL 로 (창조자 25회 3절 · 보스 09-23 · --first30 의 화면판).
// 브라우저는 이 스크립트가 띄운 **전용 헤드리스 크로미움 하나**(ms-playwright 의 chrome-headless-shell · CDP)다 — 남과 나눠 쓰는 창을 쓰지 않는다.
// 정적 서버도 스스로 띄운다(127.0.0.1 · 저장소 뿌리). sid 는 늘 guest · 운영 DB·구글 주소는 막는다(Network.setBlockedURLs). 끝나면 브라우저·서버를 닫는다(발열 규칙).
//
// 판 하나 = '판이름' 또는 '판이름+저장본'(저장본을 그 판 칸에 넣고 다시 연다 · 기본 판은 '기본'). 빈 시작 땅은 사람이 없어 잴 게 없으므로 기본 여섯은 저장본을 얹는다.
//   node scripts/village-hunt/hunt.mjs                         # 기본 판 일곱(원본 마을 origin 포함 · 09-24) × 60초 · 아침 8시
//   node scripts/village-hunt/hunt.mjs --boards town3,farm+village/stages/boards/mid36.json --sec 30
//   node scripts/village-hunt/hunt.mjs --hour none --json out.json      # 저장본의 시각 그대로
//   --soft(GPU 가 안 잡힐 때만 CPU 그리기) · --view 1366,610 · --fps 30 · --rest 5(판 사이 초)
//   --input  판마다 60초 뒤 입력 단계(흰 공 · 반응 · 말 충돌 — 집 하나를 누르고 빈 집 하나를 치운다 · 판이 바뀌므로 잰 것 뒤에)
// ⚠ 무겁다(판마다 60초) — 사람·연기를 건드린 PR 에서만 돌린다(보스 09-24).
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MID = 'village/stages/boards/mid36.json';
const INPUT = args.includes('--input');   /* [09-25] 입력 단계 — 흰 공 지름 · 누름 반응 ms · 치우기 말 충돌(창조자 25회 3절의 '안 잼' 셋) · 판을 바꾸므로 잰 뒤에만 */
const BOARDS = opt('boards', `기본+village/stages/boards/pop167.json,origin,town3,farm+${MID},city+${MID},sea+${MID},mountain+${MID}`).split(',').map(s => s.trim()).filter(Boolean);
const SOFT = args.includes('--soft'), VIEW = opt('view', '1366,610'), FPS = +opt('fps', 30), REST = +opt('rest', 5), WARM = +opt('warm', 2), SEC = +opt('sec', 60), HOUR = opt('hour', '8') === 'none' ? null : +opt('hour', '8'), JSON_OUT = opt('json', null);
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');
if (!fs.existsSync(CHROME)) { console.error('헤드리스 크로미움이 없다: ' + CHROME + ' — CHROME=<경로> 로 알려 주거나 npx playwright install chromium-headless-shell'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 기준 — 창조자 25회 3절 · ACT-SPACE(#881) 와 함께 정한 화면판 기준 */
const PASS = { 반응ms: 150, 흰공px: 24, 포갬쌍: 0.5, 오래포갬ms: 1000, 오래포갬프레임: 20, 우표: 0.4, 프레임ms: FPS > 0 ? Math.round(1000 / FPS * 1.3) : 20, 한칸박자: 0.5 };   /* 포갬 FAIL 은 '오래 포갬'(같은 둘이 1초 넘게 0.6 안) — 평균은 스쳐 지나감이 대부분이라 주의로만(09-23 · mountain 320쌍 중 317쌍이 0.3초 안) */

/* ── 정적 서버 ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u); if (!f.startsWith(ROOT)) { s.writeHead(403); return s.end(); }
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(d); }); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

/* ── 헤드리스 하나 ── */
const port = 9400 + (process.pid % 300), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-hunt-'));
/* [09-24 발열] 3D 는 **GPU(ANGLE Metal)** 로 — swiftshader 는 CPU 로 그려 한 벌이 CPU 850% 였다(보스 실측 · 부하 평균 15). GPU 가 안 잡히는 기기만 --soft.
   창은 크롬북 크기 1366×610(소프트웨어로 그려도 픽셀 수에 비례해 가볍다) · 사람 자리(__folkPos)는 창 크기와 무관 — 판정은 그대로. */
const ch = spawn(CHROME, ['--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=' + VIEW, '--use-gl=angle', ...(SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal']), '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const wait = new Map(), events = [];
const send = (method, params = {}) => new Promise(res => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (src) => { const r = await send('Runtime.evaluate', { expression: '(async () => {' + src + '})()', awaitPromise: true, returnByValue: true, timeout: (SEC + 120) * 1000 });
  if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || '평가 오류'); return r.result && r.result.result ? r.result.result.value : null; };

/* 페이지 안에서 도는 잰 것 — 프레임마다(튐) · 0.5초마다(나머지) · 모두 읽기 훅만 */
const SAMPLER = `
const SEC = ${SEC}, HOUR = ${HOUR == null ? 'null' : +HOUR}, WARM = ${WARM};
const sleep = ms => new Promise(r => setTimeout(r, ms)), PASS_LONG = ${PASS.오래포갬ms}, PASS_FR = ${PASS.오래포갬프레임};
for (let k = 0; k < 80 && window.__LOADMS == null; k++) await sleep(250);
if (window.__LOADMS == null) return { 오류: '부팅 안 됨' };
[...document.querySelectorAll('button')].filter(x => ['시작', '닫기'].includes(x.textContent.trim()) && x.offsetParent).forEach(b => b.click());
if (HOUR != null && window.__setHour) { window.__setHour(HOUR); await sleep(WARM * 1000); }   /* 시각을 건너뛴 직후 몇 프레임은 사람이 한꺼번에 나오며 벽 안에 그려진다(09-23 farm · 0.26초 안 · 저절로 나올 땐 0) — 준비 시간 */
const has = h => typeof window[h] === 'function', e0 = has('__errors') ? window.__errors() : null;
/* 우표 마을 — 놓인 물건의 화면 폭 ÷ 창 폭 */
let 우표 = null; try { const cs = (window.__snapshot().물건 || []).map(t => /@(\\d+),(\\d+)/.exec(t)).filter(Boolean).map(m => [+m[1], +m[2]]);
  if (cs.length) { const ext = [0, 1].flatMap(k => [cs.reduce((a, c) => c[k] < a[k] ? c : a), cs.reduce((a, c) => c[k] > a[k] ? c : a)]);   /* 끝 넷만 — __cellScreen 은 화면을 훑는다 */
    const xs = ext.map(c => window.__cellScreen(c[0], c[1])).filter(Boolean).map(p => p[0]); if (xs.length > 1) 우표 = +((Math.max(...xs) - Math.min(...xs)) / innerWidth).toFixed(2); } } catch (e) {}
/* 토스트 — 빈 30초(아무것도 안 누른 동안 새로 뜬 말) */
const said = []; const tEl = document.getElementById('toast'); let lastT = tEl ? tEl.textContent : '';
const obs = new MutationObserver(() => { const t = tEl ? tEl.textContent.trim() : ''; if (t && t !== lastT) { said.push([Math.round(performance.now() - t0), t.slice(0, 60)]); lastT = t; } });
if (tEl) obs.observe(tEl, { childList: true, subtree: true, characterData: true });
const t0 = performance.now(), R = { 표본: 0, 포갬표본: 0, 포갬쌍합: 0, 셈포갬표본: 0, 줄세움표본: 0, 벽통과표본: 0, 벽예: [], 갇힘표본: 0, 튐: 0, 튐예: [], 프레임: 0, 사람최대: 0 };
const prev = new Map(), ov = new Map(), longOv = new Map(); let nextSample = 0, lastNow = 0; R.긴프레임 = 0; R.긴프레임최대ms = 0; R.스침 = 0; R.박자합 = 0; R.박자표본 = 0;
await new Promise(done => { const f = () => { const now = performance.now() - t0, dt = now - lastNow; lastNow = now; R.프레임++;
  const P = has('__folkPos') ? window.__folkPos() : [], slow = R.프레임 > 1 && dt > 100;   /* 긴 프레임(멈칫) 뒤의 큰 걸음은 튐이 아니라 멈칫이다 — 따로 센다 */
  if (slow) { R.긴프레임++; R.긴프레임최대ms = Math.max(R.긴프레임최대ms, Math.round(dt)); }
  P.forEach(p => { const q = prev.get(p[0]); if (!slow && q && q[3] && p[3] && q[4] === p[4] && q[7] === p[7]) { const d = Math.hypot(p[1] - q[1], p[2] - q[2]); if (d > 2) { R.튐++; if (R.튐예.length < 3) R.튐예.push(p[4] + ' ' + d.toFixed(1) + ' @' + Math.round(now / 1000) + 's ' + Math.round(dt) + 'ms'); } } prev.set(p[0], p); });
  { const V = P.filter(p => p[3]), seen = new Set();   /* 같은 둘이 얼마나 오래 겹쳤나 — 매 프레임 */
    for (let a = 0; a < V.length; a++) for (let b = a + 1; b < V.length; b++) { if (Math.abs(V[a][1] - V[b][1]) >= 0.6 || Math.abs(V[a][2] - V[b][2]) >= 0.6 || Math.hypot(V[a][1] - V[b][1], V[a][2] - V[b][2]) >= 0.6) continue;
      const k = V[a][0] + '-' + V[b][0]; seen.add(k); if (!ov.has(k)) ov.set(k, { t: now, n: 0, kind: V[a][4] + '/' + (V[a][7] || '-') + '+' + V[b][4] + '/' + (V[b][7] || '-') + ' ' + V[a][5] });
      const e = ov.get(k); e.n++; if (now - e.t > PASS_LONG && e.n >= PASS_FR && !longOv.has(k)) longOv.set(k, e); }   /* 1초 **그리고** 20프레임 — 긴 프레임이 몰리면 프레임마다 벌리는 간격(ACT-SPACE)이 1초에 몇 번 못 돈다(09-24 sea · 최대 656ms 때 한 번) */
    ov.forEach((e, k) => { if (!seen.has(k)) { if (now - e.t <= 300) R.스침++; ov.delete(k); } }); }
  if (now >= nextSample) { nextSample += 500; if (has('__folkSpace')) { const g = (window.__folkSpace().그린자리 || {}); if (g.서있는사람) { R.박자합 += g.한칸박자; R.박자표본++; } } R.표본++; const V = P.filter(p => p[3]); R.사람최대 = Math.max(R.사람최대, V.length);
    let pairs = 0, near = 1e9, np = ''; for (let a = 0; a < V.length; a++) for (let b = a + 1; b < V.length; b++) { const d = Math.hypot(V[a][1] - V[b][1], V[a][2] - V[b][2]); if (d < near) { near = d; np = V[a][0] + '-' + V[b][0]; } if (d < 0.6) pairs++; }
    R.포갬쌍합 += pairs; if (pairs) R.포갬표본++; { const line = V.length > 1 && Math.abs(near - 4) < 0.01 ? np : ''; if (line && line === R._줄) R.줄세움표본++; R._줄 = line; }   /* 같은 둘이 **두 표본 잇달아** 정확히 4.00 일 때만 — 스쳐 가는 둘이 한순간 4.00 이 되는 것은 뺀다(09-24 sea 21.7시 · 5명뿐인 밤에 마주 오는 둘 1.7×3.63 = 4.008) */
    const wall = V.filter(p => p[6] && (p[7] === '' || p[7] === 'carry') && !['play', 'pavilion', 'plaza', 'bench', 'minibench', 'green', 'fountain', 'garden'].includes(p[5]));
    if (wall.length) { R.벽통과표본++; if (R.벽예.length < 3) R.벽예.push(wall[0][5] + ':' + wall[0][4] + ' (' + wall[0][1] + ',' + wall[0][2] + ') @' + Math.round(now / 1000) + 's'); }
    if (has('__folkOverlap') && window.__folkOverlap().겹친쌍 > 0) R.셈포갬표본++;
    if (has('__stuck') && window.__stuck().갇힌사람 > 0) R.갇힘표본++; }
  if (now < SEC * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
obs.disconnect();
const e1 = has('__errors') ? window.__errors() : null, g = has('__gfx') ? window.__gfx() : null;
const 렌더러 = (() => { try { const c = document.querySelector('canvas'), g = c && (c.getContext('webgl2') || c.getContext('webgl')), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; } catch (err) { return null; } })();
return { ...R, 렌더러, 오래포갬: longOv.size, 오래포갬예: [...longOv.values()].slice(0, 3).map(e => e.kind + ' @' + Math.round(e.t / 1000) + 's'), 한칸박자: R.박자표본 ? +(R.박자합 / R.박자표본).toFixed(2) : null, 우표, 빈30초말: said.filter(s => s[0] < 30000).length, 말: said.slice(0, 5), 삼킨오류: e1 && e0 ? (e1.삼킨오류 || 0) + (e1.덮개 || 0) - (e0.삼킨오류 || 0) - (e0.덮개 || 0) : null, 오류예: e1 ? e1.목록.slice(0, 2).map(x => x.말 + '@' + x.줄) : [], 저장멈춤: e1 ? !!e1.저장꺼짐 : null, 프레임평균ms: g ? g.프레임평균ms : null, 놓친비율: g ? g.놓친비율 : null };`;

/* ── 입력 단계(--input) — 입력은 CDP 마우스(진짜 포인터 사건) · 기록은 페이지 안 MutationObserver(#toast · #why) ──
   흰 공: 풍선 판의 세계 크기 × (한칸px ÷ 칸 4) × 그림 원 60/64 — 얼굴 2.2 · 말 표(🪣✓ 꼴) 3.6. 24px 아래면 그림이 안 읽힌다(창조자 25회 ⓑ48 제안 기준 · 주의만).
   반응: 누른 때(페이지 시계) → #toast · #why 의 글이 처음 바뀐 때. 말 충돌: 한 번 누른 뒤 1초 안에 #toast 와 #why 가 **둘 다** 보이고 글이 다르다(ⓐ4 '치웠어요'+'없어요' · MAC-ONEPRESS 로 고침 — 되돌아오는지 지킨다). */
const PROBE_PREP = `
{ const sk = [...document.querySelectorAll('button')].find(e => ['건너뛰기', '시작', '닫기'].includes(e.textContent.trim()) && e.getClientRects().length && !e.disabled); if (sk) { sk.click(); await new Promise(r => setTimeout(r, 600)); } }   /* 수업 판 시작 카드('시작'은 짐작을 골라야 켜진다 → 건너뛰기) — 카드가 판을 덮으면 누름이 카드에 간다 */
const st = window.__state(), px = st.한칸px / 4 * 60 / 64;
const 흰공 = { 얼굴: Math.round(2.2 * px), 말표: Math.round(3.6 * px) };
const snap = window.__snapshot(), hs = (snap.물건 || []).map(t => /^house@(\\d+),(\\d+)/.exec(t)).filter(Boolean).map(m => [+m[1], +m[2]]);
const lived = ([x, y]) => { const e = snap.집 && snap.집[y * 256 + x]; return !!(e && e[0] > 0); };
const pick = want => { for (const c of hs.filter(c => lived(c) === want).slice(0, 25)) { const p = window.__cellScreen(c[0], c[1]); if (p && p[1] > 110 && p[1] < innerHeight - 190) return { cell: c, xy: p }; } return null; };
const 사는집 = pick(true), 빈집 = pick(false);
window.__hlog = []; const t0 = performance.now();
const vis = el => !!(el && el.textContent.trim() && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05);
['toast', 'why'].forEach(id => { const el = document.getElementById(id); if (!el) return; new MutationObserver(() => window.__hlog.push([performance.now(), id, el.textContent.trim().slice(0, 50)])).observe(el, { childList: true, subtree: true, characterData: true, attributes: true }); });   /* 글이 바뀐 때 = 답한 때(토스트는 투명도로 서서히 뜬다) */
window.__hvis = () => ['toast', 'why'].map(id => [id, vis(document.getElementById(id)) ? document.getElementById(id).textContent.trim().slice(0, 50) : '']);
return { 흰공, 사는집, 빈집, 모드: st.mode };`;
const click = async xy => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: xy[0], y: xy[1], ...(type === 'mouseMoved' ? {} : { button: 'left', clickCount: 1 }) }); };
const quiet = async () => { for (let t = 0; t < 40; t++) { const v = await evaluate("window.__hlog.length = 0; return window.__hvis().some(a => a[1])"); await sleep(250); const n = await evaluate('return window.__hlog.length'); if (!v && !n) return true; } return false; };   /* 앞의 토스트(목표·해금)가 사라질 때까지 — 그 말을 답으로 잘못 세지 않게 */
async function press(xy) { const calm = await quiet(); await evaluate('window.__hin = performance.now(); window.__hlog.length = 0; return 1');
  await click(xy);
  const seen = new Map(); let both = null;
  for (let t = 0; t < 20; t++) { await sleep(50); const v = await evaluate('return window.__hvis()'); v.forEach(([id, txt]) => { if (txt && !seen.has(id)) seen.set(id, txt); });
    const T = v.find(a => a[0] === 'toast')[1], W = v.find(a => a[0] === 'why')[1]; if (T && W && T !== W && !both) both = T + ' ＋ ' + W; }
  const first = await evaluate('const h = window.__hlog.find(e => e[2]); return h ? Math.round(h[0] - window.__hin) : null');
  return { 반응ms: first, 말: [...seen.entries()].map(([id, t]) => id + ': ' + t), 충돌: both, ...(calm ? {} : { 조용안됨: true }) }; }
async function inputPhase() {
  const prep = await evaluate(PROBE_PREP); const out = { 흰공: prep.흰공, 모드: prep.모드 };
  if (prep.사는집) out.누름 = await press(prep.사는집.xy); else out.누름 = { 없음: '화면 안 사는 집 없음' };
  await sleep(2500);   /* 집 카드 토스트가 사라지게 */
  const er = await evaluate("const b = document.getElementById('cErase'), q = b && b.getBoundingClientRect(); return q && q.width ? [q.left + q.width / 2, q.top + q.height / 2] : null");
  if (er) { out.치우기자리 = await evaluate(`const e = document.elementFromPoint(${er[0]}, ${er[1]}); return e ? (e.id || e.className || e.tagName) : null`); await click(er); await sleep(300); }
  const mode = await evaluate('return window.__state().mode'); out.치우기모드 = mode;
  if (er && mode === '치우기' && prep.빈집) out.치우기 = await press(prep.빈집.xy); else out.치우기 = { 없음: !er ? '치우기 카드 없음' : mode !== '치우기' ? '치우기 모드가 안 켜짐(' + mode + ')' : '화면 안 빈 집 없음' };
  return out; }

const results = [];
try {
  let list; for (let k = 0; k < 50; k++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') events.push(m.params.exceptionDetails); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*googleapis.com*', '*gstatic.com*', '*firebase*'] });   /* 운영 DB 에 닿지 않게 */
  if (FPS > 0) await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const raf = window.requestAnimationFrame.bind(window), gap = 1000 / ${FPS} - 1; let last = -1e9;
    window.requestAnimationFrame = cb => raf(function tick(t) { if (t === last || t - last >= gap) { last = t; cb(t); } else raf(tick); }); })();` });   /* 틀 수 상한(기본 30) — 같은 틀의 콜백은 같은 t 라 다 지나간다 · 시뮬 시간은 틀과 무관 */
  for (const [bi, b] of BOARDS.entries()) {
    if (bi && REST > 0) await sleep(REST * 1000);   /* 판 사이 쉬기(발열) */
    const [name, save] = b.split('+'), stage = name === '기본' ? '' : name, q = (stage ? 'stage=' + encodeURIComponent(stage) + '&' : '') + 'sid=guest&dev=1&cb=' + Date.now();
    const url = BASE + '/village/index.html?' + q;
    events.length = 0;
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await send('Page.navigate', { url }); await sleep(2500);
    await evaluate('localStorage.clear(); return 1');                  /* 판마다 깨끗이(이 프로필은 이 스크립트 것) */
    if (save) { await evaluate(`const t = await fetch(${JSON.stringify('/' + save)}).then(r => r.text()); localStorage.setItem(${JSON.stringify('rpg.village.guest' + (stage ? '.' + stage : ''))}, t); return t.length`); }
    await send('Page.navigate', { url: url + '&r=2' }); await sleep(2500);
    const r = await evaluate(SAMPLER).catch(e => ({ 오류: String(e.message || e).slice(0, 200) }));
    if (INPUT && !r.오류) r.입력 = await inputPhase().catch(e => ({ 오류: String(e.message || e).slice(0, 200) }));
    results.push({ 판: name + (save ? ' · ' + path.basename(save, '.json') : ''), 페이지오류: events.length, 페이지오류예: events.slice(0, 2).map(x => ((x.exception || {}).description || x.text || '').split('\n')[0].slice(0, 120)), ...r });
    process.stderr.write(`  ${b} 끝\n`);
  }
} finally { try { ws && ws.close(); } catch {} ch.kill('SIGKILL'); server.close(); await sleep(500); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} }

/* ── 표 ── */
const r2 = x => x == null ? '—' : Math.round(x * 100) / 100, pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const L = [`사냥 하네스 — 판 ${BOARDS.length} × ${SEC}초 · ${HOUR == null ? '저장본 시각' : HOUR + '시'} · 전용 헤드리스(${SOFT ? '소프트웨어 GL' : 'GPU'} · ${VIEW.replace(',', '×')} · ${FPS || '무제한'}fps) · sid guest · 운영 주소 막음 · 자리는 **그려진 자리**(__folkPos)`, ''];
L.push('| 판 | 사람 | 오래 포갬 | 포갬쌍/표본 (스침) | 한 칸 박자 | (셈 포갬 표본) | 줄 세움 | 벽 통과 | 튐 | 갇힘 | 오류 | 우표 | 빈 30초 말 | 프레임ms | 긴 프레임 | 판정 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of results) {
  if (x.오류) { L.push(`| ${x.판} | 오류: ${x.오류} |||||||||||||| FAIL |`); continue; }
  const 쌍 = x.포갬쌍합 / Math.max(1, x.표본), 오류 = (x.페이지오류 || 0) + (x.삼킨오류 || 0);
  const I = x.입력 || null, 충돌 = I && [I.누름, I.치우기].some(a => a && a.충돌), 느림 = I && [I.누름, I.치우기].some(a => a && a.반응ms > PASS.반응ms);
  const fail = [x.오래포갬 && '오래 포갬', x.줄세움표본 && '줄 세움', x.벽통과표본 && '벽 통과', x.튐 && '튐', x.갇힘표본 && '갇힘', 오류 && '오류', 충돌 && '말 충돌'].filter(Boolean);
  const warn = [쌍 > PASS.포갬쌍 && '포갬 평균', x.한칸박자 != null && x.한칸박자 > PASS.한칸박자 && '한 칸 박자', x.우표 != null && x.우표 < PASS.우표 && '우표 마을', SEC >= 30 && x.빈30초말 === 0 && '빈 30초', x.프레임평균ms > PASS.프레임ms && '프레임', 느림 && '반응 느림', I && I.흰공 && I.흰공.얼굴 < PASS.흰공px && '흰 공'].filter(Boolean);
  x.판정 = fail.length ? 'FAIL(' + fail.join('·') + ')' : x.사람최대 ? 'PASS' : 'REVIEW(사람 0 · 잴 게 없다)'; x.주의 = warn;
  L.push(`| ${x.판} | ${x.사람최대} | ${x.오래포갬}${x.오래포갬예.length ? ' (' + x.오래포갬예.join(', ') + ')' : ''} | ${r2(쌍)} (${x.스침}) | ${r2(x.한칸박자)} | ${pct(x.셈포갬표본, x.표본)} | ${pct(x.줄세움표본, x.표본)} | ${x.벽통과표본}${x.벽예.length ? ' (' + x.벽예.join(', ') + ')' : ''} | ${x.튐}${x.튐예.length ? ' (' + x.튐예.join(', ') + ')' : ''} | ${x.갇힘표본} | ${오류} | ${r2(x.우표)} | ${x.빈30초말} | ${r2(x.프레임평균ms)} | ${x.긴프레임}${x.긴프레임 ? ' (최대 ' + x.긴프레임최대ms + 'ms)' : ''} | **${x.판정}**${warn.length ? ' · 주의: ' + warn.join('·') : ''} |`);
}
if (INPUT) { const one = a => !a ? '—' : a.없음 ? '(' + a.없음 + ')' : (a.반응ms == null ? '답 없음' : a.반응ms + 'ms') + (a.조용안됨 ? ' ⚠앞말' : '') + ' · ' + (a.말.join(' / ') || '—').replace(/\|/g, '/');
  L.push('', '**입력 단계**(`--input` · 잰 뒤 한 번씩 · CDP 마우스) — 흰 공 = 풍선 화면 지름(얼굴 2.2 · 말 표 3.6) · 누름 = 사는 집 한 번 · 치우기 = 🧽 켜고 빈 집 한 번 · 말 충돌 = 한 번 누른 뒤 1초 안에 #toast 와 #why 가 둘 다 다른 글', '',
    '| 판 | 흰 공 px(얼굴 · 말 표) | 누름: 반응 · 말 | 치우기: 반응 · 말 | 말 충돌 |', '|---|---|---|---|---|');
  for (const x of results) { const I = x.입력; if (!I) continue; if (I.오류) { L.push(`| ${x.판} | 오류: ${I.오류} |||| `); continue; }
    L.push(`| ${x.판} | ${I.흰공.얼굴} · ${I.흰공.말표} | ${one(I.누름)} | ${one(I.치우기)} | ${[I.누름, I.치우기].map(a => a && a.충돌).filter(Boolean).join(' / ') || 0} |`); } }
L.push('', `기준 — FAIL: 오래 포갬(같은 둘이 그려진 자리 0.6 안에 ${PASS.오래포갬ms / 1000}초 넘게 · ${PASS.오래포갬프레임}프레임 넘게) ≥ 1 · 줄 세움(가장 가까운 **같은 둘**이 두 표본 잇달아 정확히 4.00) 표본 ≥ 1 · 벽 통과(몸 높이 부위 안 · 곁 자리·놀이터 등 뺌) ≥ 1 · 튐(같은 상태로 한 프레임 2.0 넘게 · 100ms 넘는 긴 프레임 뒤는 빼고 '긴 프레임'으로 따로) ≥ 1 · 갇힘(until 로 나오는 '들름'이 1초 넘게 안 나옴 · 집·일터·학교는 시각으로 나오니 뺀다) ≥ 1 · 오류(페이지 + 삼킨 오류) ≥ 1.`,
  `주의: 포갬 평균(0.5초 표본마다 0.6 안 쌍 > ${PASS.포갬쌍} · 괄호 = 0.3초 안에 풀린 스침 수) · 한 칸 박자(서 있는 사람 가운데 가장 가까운 서 있는 이웃이 3.6~4.4 인 몫 > ${PASS.한칸박자}) · 우표 마을(물건 화면 폭 ÷ 창 폭 < ${PASS.우표}) · 빈 30초(아무것도 안 누른 30초 동안 말 0) · 프레임 > ${PASS.프레임ms}ms(헤드리스 · 틀 수 상한 ${FPS || '없음'} 이라 **참고만**).`,
  (INPUT ? `입력 단계 — FAIL: 말 충돌 ≥ 1 · 주의: 반응 > ${PASS.반응ms}ms · 흰 공(얼굴 풍선 지름 < ${PASS.흰공px}px · 창조자 25회 ⓑ48 제안 기준). ` : '안 잼(입력이 필요하다 — --input): 말 충돌(한 입력 뒤 #toast 와 #why) · 반응 ms · 흰 공(풍선 지름). ') + '셈 포갬은 창조자 25회 표와 견주려고 함께 적는다(__folkOverlap · 셈 자리 2.0 안).');
L.push('', '그린 것: ' + ([...new Set(results.map(x => x.렌더러).filter(Boolean))].join(' · ') || '(못 읽음)'));
console.log(L.join('\n'));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
process.exit(results.some(x => !x.판정 || x.판정.startsWith('FAIL')) ? 1 : 0);
