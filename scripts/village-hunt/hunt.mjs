// 마을 사냥 하네스 — 판 여럿 × N초를 **화면(그려진 자리)** 으로 돌려 어설픔을 PASS/FAIL 로 (창조자 25회 3절 · 보스 09-23 · --first30 의 화면판).
// 브라우저는 이 스크립트가 띄운 **전용 헤드리스 크로미움 하나**(ms-playwright 의 chrome-headless-shell · CDP)다 — 남과 나눠 쓰는 창을 쓰지 않는다.
// 정적 서버도 스스로 띄운다(127.0.0.1 · 저장소 뿌리). sid 는 늘 guest · 운영 DB·구글 주소는 막는다(Network.setBlockedURLs). 끝나면 브라우저·서버를 닫는다(발열 규칙).
//
// 판 하나 = '판이름' 또는 '판이름+저장본'(저장본을 그 판 칸에 넣고 다시 연다 · 기본 판은 '기본'). 빈 시작 땅은 사람이 없어 잴 게 없으므로 기본 여섯은 저장본을 얹는다.
//   node scripts/village-hunt/hunt.mjs                         # 기본 판 여섯 × 60초 · 아침 8시
//   node scripts/village-hunt/hunt.mjs --boards town3,farm+village/stages/boards/mid36.json --sec 30
//   node scripts/village-hunt/hunt.mjs --hour none --json out.json      # 저장본의 시각 그대로
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MID = 'village/stages/boards/mid36.json';
const BOARDS = opt('boards', `기본+village/stages/boards/pop167.json,town3,farm+${MID},city+${MID},sea+${MID},mountain+${MID}`).split(',').map(s => s.trim()).filter(Boolean);
const SEC = +opt('sec', 60), HOUR = opt('hour', '8') === 'none' ? null : +opt('hour', '8'), JSON_OUT = opt('json', null);
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');
if (!fs.existsSync(CHROME)) { console.error('헤드리스 크로미움이 없다: ' + CHROME + ' — CHROME=<경로> 로 알려 주거나 npx playwright install chromium-headless-shell'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 기준 — 창조자 25회 3절 · ACT-SPACE(#881) 와 함께 정한 화면판 기준 */
const PASS = { 포갬쌍: 0.5, 우표: 0.4, 프레임ms: 20 };

/* ── 정적 서버 ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u); if (!f.startsWith(ROOT)) { s.writeHead(403); return s.end(); }
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(d); }); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

/* ── 헤드리스 하나 ── */
const port = 9400 + (process.pid % 300), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-hunt-'));
const ch = spawn(CHROME, ['--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=1600,900', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const wait = new Map(), events = [];
const send = (method, params = {}) => new Promise(res => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (src) => { const r = await send('Runtime.evaluate', { expression: '(async () => {' + src + '})()', awaitPromise: true, returnByValue: true, timeout: (SEC + 120) * 1000 });
  if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || '평가 오류'); return r.result && r.result.result ? r.result.result.value : null; };

/* 페이지 안에서 도는 잰 것 — 프레임마다(튐) · 0.5초마다(나머지) · 모두 읽기 훅만 */
const SAMPLER = `
const SEC = ${SEC}, HOUR = ${HOUR == null ? 'null' : +HOUR};
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let k = 0; k < 80 && window.__LOADMS == null; k++) await sleep(250);
if (window.__LOADMS == null) return { 오류: '부팅 안 됨' };
[...document.querySelectorAll('button')].filter(x => ['시작', '닫기'].includes(x.textContent.trim()) && x.offsetParent).forEach(b => b.click());
if (HOUR != null && window.__setHour) window.__setHour(HOUR);
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
const prev = new Map(); let nextSample = 0, lastNow = 0; R.긴프레임 = 0; R.긴프레임최대ms = 0;
await new Promise(done => { const f = () => { const now = performance.now() - t0, dt = now - lastNow; lastNow = now; R.프레임++;
  const P = has('__folkPos') ? window.__folkPos() : [], slow = R.프레임 > 1 && dt > 100;   /* 긴 프레임(멈칫) 뒤의 큰 걸음은 튐이 아니라 멈칫이다 — 따로 센다 */
  if (slow) { R.긴프레임++; R.긴프레임최대ms = Math.max(R.긴프레임최대ms, Math.round(dt)); }
  P.forEach(p => { const q = prev.get(p[0]); if (!slow && q && q[3] && p[3] && q[4] === p[4] && q[7] === p[7]) { const d = Math.hypot(p[1] - q[1], p[2] - q[2]); if (d > 2) { R.튐++; if (R.튐예.length < 3) R.튐예.push(p[4] + ' ' + d.toFixed(1) + ' @' + Math.round(now / 1000) + 's ' + Math.round(dt) + 'ms'); } } prev.set(p[0], p); });
  if (now >= nextSample) { nextSample += 500; R.표본++; const V = P.filter(p => p[3]); R.사람최대 = Math.max(R.사람최대, V.length);
    let pairs = 0, near = 1e9; for (let a = 0; a < V.length; a++) for (let b = a + 1; b < V.length; b++) { const d = Math.hypot(V[a][1] - V[b][1], V[a][2] - V[b][2]); if (d < near) near = d; if (d < 0.6) pairs++; }
    R.포갬쌍합 += pairs; if (pairs) R.포갬표본++; if (V.length > 1 && Math.abs(near - 4) < 0.01) R.줄세움표본++;
    const wall = V.filter(p => p[6] && (p[7] === '' || p[7] === 'carry') && !['play', 'pavilion', 'plaza', 'bench', 'minibench', 'green', 'fountain', 'garden'].includes(p[5]));
    if (wall.length) { R.벽통과표본++; if (R.벽예.length < 3) R.벽예.push(wall[0][5] + ':' + wall[0][4] + ' (' + wall[0][1] + ',' + wall[0][2] + ') @' + Math.round(now / 1000) + 's'); }
    if (has('__folkOverlap') && window.__folkOverlap().겹친쌍 > 0) R.셈포갬표본++;
    if (has('__stuck') && window.__stuck().갇힌사람 > 0) R.갇힘표본++; }
  if (now < SEC * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
obs.disconnect();
const e1 = has('__errors') ? window.__errors() : null, g = has('__gfx') ? window.__gfx() : null;
return { ...R, 우표, 빈30초말: said.filter(s => s[0] < 30000).length, 말: said.slice(0, 5), 삼킨오류: e1 && e0 ? (e1.삼킨오류 || 0) + (e1.덮개 || 0) - (e0.삼킨오류 || 0) - (e0.덮개 || 0) : null, 오류예: e1 ? e1.목록.slice(0, 2).map(x => x.말 + '@' + x.줄) : [], 저장멈춤: e1 ? !!e1.저장꺼짐 : null, 프레임평균ms: g ? g.프레임평균ms : null, 놓친비율: g ? g.놓친비율 : null };`;

const results = [];
try {
  let list; for (let k = 0; k < 50; k++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') events.push(m.params.exceptionDetails); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*firebasedatabase.app*', '*firebaseio.com*', '*googleapis.com*', '*gstatic.com*', '*firebase*'] });   /* 운영 DB 에 닿지 않게 */
  for (const b of BOARDS) {
    const [name, save] = b.split('+'), stage = name === '기본' ? '' : name, q = (stage ? 'stage=' + encodeURIComponent(stage) + '&' : '') + 'sid=guest&dev=1&cb=' + Date.now();
    const url = BASE + '/village/index.html?' + q;
    events.length = 0;
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await send('Page.navigate', { url }); await sleep(2500);
    await evaluate('localStorage.clear(); return 1');                  /* 판마다 깨끗이(이 프로필은 이 스크립트 것) */
    if (save) { await evaluate(`const t = await fetch(${JSON.stringify('/' + save)}).then(r => r.text()); localStorage.setItem(${JSON.stringify('rpg.village.guest' + (stage ? '.' + stage : ''))}, t); return t.length`); }
    await send('Page.navigate', { url: url + '&r=2' }); await sleep(2500);
    const r = await evaluate(SAMPLER).catch(e => ({ 오류: String(e.message || e).slice(0, 200) }));
    results.push({ 판: name + (save ? ' · ' + path.basename(save, '.json') : ''), 페이지오류: events.length, 페이지오류예: events.slice(0, 2).map(x => ((x.exception || {}).description || x.text || '').split('\n')[0].slice(0, 120)), ...r });
    process.stderr.write(`  ${b} 끝\n`);
  }
} finally { try { ws && ws.close(); } catch {} ch.kill('SIGKILL'); server.close(); await sleep(500); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} }

/* ── 표 ── */
const r2 = x => x == null ? '—' : Math.round(x * 100) / 100, pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const L = [`사냥 하네스 — 판 ${BOARDS.length} × ${SEC}초 · ${HOUR == null ? '저장본 시각' : HOUR + '시'} · 전용 헤드리스(소프트웨어 GL) · sid guest · 운영 주소 막음 · 자리는 **그려진 자리**(__folkPos)`, ''];
L.push('| 판 | 사람 | 포갬쌍/표본 | 포갬 표본 | (셈 포갬 표본) | 줄 세움 | 벽 통과 | 튐 | 갇힘 | 오류 | 우표 | 빈 30초 말 | 프레임ms | 긴 프레임 | 판정 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of results) {
  if (x.오류) { L.push(`| ${x.판} | 오류: ${x.오류} ||||||||||||| FAIL |`); continue; }
  const 쌍 = x.포갬쌍합 / Math.max(1, x.표본), 오류 = (x.페이지오류 || 0) + (x.삼킨오류 || 0);
  const fail = [쌍 > PASS.포갬쌍 && '포갬', x.줄세움표본 && '줄 세움', x.벽통과표본 && '벽 통과', x.튐 && '튐', x.갇힘표본 && '갇힘', 오류 && '오류'].filter(Boolean);
  const warn = [x.우표 != null && x.우표 < PASS.우표 && '우표 마을', SEC >= 30 && x.빈30초말 === 0 && '빈 30초', x.프레임평균ms > PASS.프레임ms && '프레임'].filter(Boolean);
  x.판정 = fail.length ? 'FAIL(' + fail.join('·') + ')' : x.사람최대 ? 'PASS' : 'REVIEW(사람 0 · 잴 게 없다)'; x.주의 = warn;
  L.push(`| ${x.판} | ${x.사람최대} | ${r2(쌍)} | ${pct(x.포갬표본, x.표본)} | ${pct(x.셈포갬표본, x.표본)} | ${pct(x.줄세움표본, x.표본)} | ${x.벽통과표본}${x.벽예.length ? ' (' + x.벽예.join(', ') + ')' : ''} | ${x.튐}${x.튐예.length ? ' (' + x.튐예.join(', ') + ')' : ''} | ${x.갇힘표본} | ${오류} | ${r2(x.우표)} | ${x.빈30초말} | ${r2(x.프레임평균ms)} | ${x.긴프레임}${x.긴프레임 ? ' (최대 ' + x.긴프레임최대ms + 'ms)' : ''} | **${x.판정}**${warn.length ? ' · 주의: ' + warn.join('·') : ''} |`);
}
L.push('', `기준 — FAIL: 포갬쌍(그려진 자리 0.6 안) 표본 평균 > ${PASS.포갬쌍} · 줄 세움(가장 가까운 두 사람이 정확히 4.00) 표본 ≥ 1 · 벽 통과(몸 높이 부위 안 · 곁 자리·놀이터 등 뺌) ≥ 1 · 튐(같은 상태로 한 프레임 2.0 넘게 · 100ms 넘는 긴 프레임 뒤는 빼고 '긴 프레임'으로 따로) ≥ 1 · 갇힘 ≥ 1 · 오류(페이지 + 삼킨 오류) ≥ 1.`,
  `주의: 우표 마을(물건 화면 폭 ÷ 창 폭 < ${PASS.우표}) · 빈 30초(아무것도 안 누른 30초 동안 말 0) · 프레임 > ${PASS.프레임ms}ms(헤드리스 소프트웨어 GL 이라 **참고만**).`,
  '안 잼(입력이 필요하다): 말 충돌(한 입력 뒤 #toast 와 #why) · 반응 ms · 흰 공(풍선 지름). 셈 포갬은 창조자 25회 표와 견주려고 함께 적는다(__folkOverlap · 셈 자리 2.0 안).');
console.log(L.join('\n'));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
process.exit(results.some(x => !x.판정 || x.판정.startsWith('FAIL')) ? 1 : 0);
