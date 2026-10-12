// 마을 화면 시험 틀 [PA-00] — 헤드리스 크롬 하나로 마을 판을 열어 스크린샷 · 접근성 단추 · 바깥 주소 시도(막은 채) · 탐침 값을 잰다.
// 틀(크롬 · 정적 서버 · 바깥 주소 막기 · 가짜 시계)은 village-look 과 한 벌 — scripts/village-look/lib.mjs.
// sid 는 늘 guest(운영 저장본 · 운영 DB 0) · 바깥 주소는 전부 막고 시도만 적는다 · 창 0 · 끝나면 브라우저 · 서버를 닫는다 · 크롬 동시 실행 금지(발열).
//
//   node scripts/village-d/dcheck.mjs --self                            # 기본 마을 — 스크린샷 1 · 접근성 단추 ≥ 1 · 바깥 시도 수 적음(틀이 도는지 스스로 봄)
//   node scripts/village-d/dcheck.mjs --stage help-places --hash n=c3-07 --eval 'window.__sim()'
//   node scripts/village-d/dcheck.mjs --scene <이름>                    # scripts/village-d/scenes/<이름>.mjs — export default async (ctx) => 결과
// 옵션: --size 1366x610 · --hour 10 · --gfx fixed · --lookseed 1 · --simrand tool|stage · --frames 60 · --reduce-motion · --voice
//       --net-delay <ms>[:<글자>](서버 응답을 늦춤 — 주소에 그 글자가 든 것만 · 학교망 흉내) · --out tmp/village-d · --keep
// 시계: 가짜 시계는 rAF · performance.now 만 멈춘다. 장면은 ctx.pump(n)(프레임만) · ctx.advance(ms)(프레임 + 진짜 시간 함께)로 흘린다.
// 출력: <out>/<장면>/ 스크린샷 · result.json(탐침 · 접근성 단추 · 바깥 시도 목록) · 끝값 0 = 기대대로 · 1 = 기대 어긋남 · 2 = 돌리지 못함.
// 기대(늘): 페이지 오류 0 · ?stage= 페이지는 바깥 시도 0. 기본 마을의 바깥 시도는 적기만 한다(문으로 쓰지 않음).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { sleep, findChrome, glArgs, serve, initScript, openChrome } from '../village-look/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2), flag = k => args.includes('--' + k), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
const SELF = flag('self'), SCENE = opt('scene', SELF ? 'self' : null), STAGE_ID = opt('stage', null), HASH = opt('hash', null), EVAL = opt('eval', null);
const [VW, VH] = String(opt('size', '1366x610')).split('x').map(n => +n | 0), VIEW = { w: VW || 1366, h: VH || 610 };
const HOUR = +opt('hour', '10'), GFX = opt('gfx', 'fixed'), LOOKSEED = (+opt('lookseed', '1') >>> 0) || 1, SIMRAND = opt('simrand', 'tool'), FRAMES = Math.max(2, +opt('frames', '60') | 0);
const OUT = path.resolve(ROOT, opt('out', 'tmp/village-d')), KEEP = flag('keep');
const ND = opt('net-delay', null), DELAY = ND ? { ms: +String(ND).split(':')[0] | 0, match: String(ND).split(':').slice(1).join(':') || null } : null;
const die = m => { console.error(m); process.exit(2); };
if (!['tool', 'stage'].includes(SIMRAND)) die('--simrand 는 tool · stage 만');
if (STAGE_ID && !/^[a-z0-9-]{1,40}$/.test(STAGE_ID)) die('--stage 는 판 id(영소문자 · 숫자 · - · 40자) — ' + STAGE_ID);
if (SCENE && !/^[a-z0-9-]+$/.test(SCENE)) die('--scene 이름은 영소문자 · 숫자 · - 만');
if (DELAY && !(DELAY.ms > 0)) die('--net-delay <ms>[:<글자>] — 예 3000:stages/');
const CHROME = findChrome(); if (!fs.existsSync(CHROME)) die('헤드리스 크로미움이 없다: ' + CHROME + ' — CHROME=<경로> 로 알려 주거나 npx playwright install chromium-headless-shell');
const GLARGS = glArgs(opt('gl', process.platform === 'darwin' ? 'metal' : 'default')); if (!GLARGS) die('--gl 은 metal · default 만 — swiftshader 는 쓰지 않는다(보스 09-24 GPU 규칙)');
let scene = null; if (SCENE) { const f = path.join(HERE, 'scenes', SCENE + '.mjs'); if (!fs.existsSync(f)) die('장면이 없다: ' + path.relative(ROOT, f)); scene = (await import(pathToFileURL(f).href)).default; if (typeof scene !== 'function') die('장면은 export default async (ctx) => … — ' + SCENE); }

/* 음성 흉내(--voice) — speechSynthesis 를 바꿔 끼워 '무엇을 · 어느 목소리로 읽었나'를 적는다(window.__dVoice) · 한국어 가짜 목소리 하나 */
const VOICE = `(() => { const v = [{ name: '가짜 한국어', lang: 'ko-KR', default: true, localService: true, voiceURI: 'dcheck-ko' }]; window.__dVoice = [];
  try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => v, speak: u => { window.__dVoice.push({ 글: String(u && u.text || ''), 말: u && u.lang || null, 목소리: u && u.voice ? u.voice.name : null }); try { u.onend && u.onend({}); } catch (e) {} },
    cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, onvoiceschanged: null, addEventListener() {}, removeEventListener() {} } }); } catch (e) {} })();`;

const srv = await serve(ROOT, { delay: DELAY }), BASE = srv.base;
const allow = u => u.startsWith(BASE + '/') || u.startsWith('data:') || u.startsWith('blob:');
const pageUrl = (stage = STAGE_ID, hash = HASH) => BASE + '/village/index.html?' + (stage ? 'stage=' + encodeURIComponent(stage) + '&' : '') + 'sid=guest' + (hash ? '#' + String(hash).replace(/^#/, '') : '');
const name = SCENE || (STAGE_ID ? 'stage-' + STAGE_ID : 'page'), dir = path.join(OUT, name);
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const R = { 장면: name, 창: VIEW, 시각: HOUR, 그래픽: GFX, lookseed: LOOKSEED, simrand: SIMRAND, 늦춤: DELAY, 주소: null, 스크린샷: [], 접근성단추: [], 바깥시도: [], 같은출처: 0, 탐침: {}, 페이지오류: [], 기대: [], 장면값: null };
const expect = (ok, msg) => { R.기대.push({ ok: !!ok, 말: msg }); return !!ok; };
let C = null, code = 0;
try {
  C = await openChrome({ chrome: CHROME, view: VIEW, gl: GLARGS, init: initScript({ lookseed: LOOKSEED, simrand: SIMRAND }), allow, tmpPrefix: 'village-d-', keep: KEEP });
  if (flag('voice')) await C.send('Page.addScriptToEvaluateOnNewDocument', { source: VOICE });
  if (flag('reduce-motion')) await C.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await C.send('Accessibility.enable').catch(() => {});

  /* 판 열기 — 새 프로필이라 저장본이 없다(판 파일의 '시작'이 처음 땅) · 열고 첫 프레임까지 · 그래픽 · 시각 고정 */
  const open = async ({ stage = STAGE_ID, hash = HASH } = {}) => {
    await C.nav(BASE + '/village/stages/rules.json'); await C.evaluate('localStorage.clear(); sessionStorage.clear(); return 1');
    C.st.pageErr.length = 0; R.주소 = pageUrl(stage, hash).slice(BASE.length);
    await C.nav(pageUrl(stage, hash));
    await C.until(`typeof window.__sim === 'function' && typeof window.__gfxMode === 'function' && window.__shots`, 30000, '마을 불러오기');
    await C.pump(1); await C.until('window.__LOADMS != null', 5000, '첫 프레임');
    await C.evaluate(`window.__gfxMode(${JSON.stringify(GFX)}); if (window.__setHour) window.__setHour(${HOUR}); return 1`);
    await C.pump(FRAMES); await C.netIdle(); await C.pump(FRAMES); };
  const shot = async label => { await C.evaluate('await window.__shots.real(); return 1');
    const png = Buffer.from((await C.send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
    const f = path.join(dir, String(label || name).replace(/[^\p{L}\p{N}._-]/gu, '_') + '.png'); fs.writeFileSync(f, png); R.스크린샷.push({ 파일: path.relative(ROOT, f), 바이트: png.length }); return f; };
  const ax = async () => { const t = await C.send('Accessibility.getFullAXTree');
    return (t.nodes || []).filter(n => !n.ignored && n.role && n.role.value === 'button' && n.name && String(n.name.value || '').trim())
      .map(n => ({ 이름: String(n.name.value).trim().slice(0, 60), 초점: !!(n.properties || []).find(p => p.name === 'focusable' && p.value && p.value.value) })); };
  const probe = async expr => C.evaluate('return (' + expr + ')');

  await open();
  const ctx = { C, BASE, ROOT, dir, args, open, shot, ax, probe, expect, pump: n => C.pump(n), advance: ms => C.advance(ms), sleep, evaluate: (s, ms) => C.evaluate(s, ms), send: (m, p) => C.send(m, p), result: R };
  if (scene) R.장면값 = await scene(ctx);
  else { await shot(name); R.접근성단추 = await ax(); }
  if (EVAL) R.탐침[EVAL] = await probe(EVAL);
  if (flag('voice')) R.탐침.__dVoice = await probe('window.__dVoice');

  /* 늘 보는 기대 — 페이지 오류 0 · ?stage= 페이지는 바깥 시도 0 */
  const errs = await C.evaluate('return window.__shots.errs.slice(0, 5)');
  R.페이지오류 = [...C.st.pageErr.slice(0, 5), ...errs];
  R.바깥시도 = C.st.tries.filter(t => !t.ok); R.같은출처 = C.st.tries.filter(t => t.ok && t.url.startsWith(BASE + '/')).length;
  expect(R.페이지오류.length === 0, '페이지 오류 0' + (R.페이지오류.length ? ' — ' + R.페이지오류.slice(0, 2).join(' / ') : ''));
  if (STAGE_ID) expect(R.바깥시도.length === 0, '?stage= 페이지 바깥 시도 0' + (R.바깥시도.length ? ' — ' + R.바깥시도.slice(0, 3).map(t => t.url).join(' · ') : ''));
  if (STAGE_ID) { const sg = await probe('window.__stage ? window.__stage() : null'); R.판 = sg ? { id: sg.id, 이름: sg.이름, 오류: sg.오류 || null, 저장키: sg.저장키, 원격: sg.원격 } : null;   /* 판이 실제로 열렸나 · 원격 동기 꺼짐(운영 저장본 0) */
    expect(sg && sg.id === STAGE_ID && !sg.오류, '판 열림 — ' + (sg ? (sg.오류 || sg.이름 || sg.id) : '__stage 없음')); expect(sg && !sg.원격, '판은 원격 동기 꺼짐'); }
  code = R.기대.every(e => e.ok) ? 0 : 1;
} catch (e) { R.멈춤 = String(e.message || e).slice(0, 300); code = 2; }
finally { try { C && await C.close(); } catch {} srv.close(); await sleep(200); }

fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(R, null, 1));
const L = [`dcheck — ${R.주소 || '(못 엶)'} · ${VIEW.w}×${VIEW.h} · ${HOUR}시 · 그래픽 ${GFX} · lookseed ${LOOKSEED} · simrand ${SIMRAND}${DELAY ? ' · 늦춤 ' + DELAY.ms + 'ms' + (DELAY.match ? '(' + DELAY.match + ')' : '') : ''}${KEEP ? ' · 프로필 남김' : ''}`,
  `  스크린샷 ${R.스크린샷.length}${R.스크린샷.length ? ' — ' + R.스크린샷.map(s => s.파일).join(' · ') : ''}`,
  `  접근성 단추 ${R.접근성단추.length}${R.접근성단추.length ? ' — ' + R.접근성단추.slice(0, 8).map(b => b.이름).join(' · ') + (R.접근성단추.length > 8 ? ' …' : '') : ''}`,
  `  바깥 시도 ${R.바깥시도.length}(막음)${R.바깥시도.length ? ' — ' + R.바깥시도.slice(0, 4).map(t => t.url).join(' · ') : ''} · 같은 출처 요청 ${R.같은출처}`,
  ...Object.entries(R.탐침).map(([k, v]) => `  탐침 ${k} = ${JSON.stringify(v).slice(0, 300)}`),
  ...(R.장면값 != null ? [`  장면 값 = ${JSON.stringify(R.장면값).slice(0, 400)}`] : []),
  ...R.기대.map(e => `  ${e.ok ? '✓' : '✗'} ${e.말}`),
  ...(R.멈춤 ? ['  멈춤: ' + R.멈춤] : []),
  `판정: ${code === 0 ? 'PASS' : code === 1 ? 'FAIL — 기대 어긋남' : '돌리지 못함'} · 결과 ${path.relative(ROOT, path.join(dir, 'result.json'))}`];
console.log(L.join('\n'));
process.exit(code);
