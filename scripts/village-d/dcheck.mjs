// 마을 화면 시험 틀 [PA-00] — 헤드리스 크롬 하나로 마을 판을 열어 스크린샷 · 접근성 단추 · 바깥 주소 시도(막은 채) · 탐침 값을 잰다.
// 틀(크롬 · 정적 서버 · 바깥 주소 막기 · 가짜 시계)은 village-look 과 한 벌 — scripts/village-look/lib.mjs.
// sid 는 늘 guest(운영 저장본 · 운영 DB 0) · 바깥 주소는 전부 막고 시도만 적는다 · 창 0 · 끝나면 브라우저 · 서버를 닫는다 · 크롬 동시 실행 금지(발열).
//
//   node scripts/village-d/dcheck.mjs --self                            # 기본 마을 — 스크린샷 1 · 접근성 단추 ≥ 1 · 바깥 시도 수 적음(틀이 도는지 스스로 봄)
//   node scripts/village-d/dcheck.mjs --stage help-places --hash n=c3-07 --eval 'window.__sim()'
//   node scripts/village-d/dcheck.mjs --scene <이름>                    # scripts/village-d/scenes/<이름>.mjs — export default async (ctx) => 결과
//   node scripts/village-d/dcheck.mjs --save village/stages/boards/pop88.json --eval 'window.__sim()'   # 저장본을 넣고 엶(판 밖 쪽에서 localStorage 'rpg.village.guest[.<판>]')
//   node scripts/village-d/dcheck.mjs --dc lesson0,help-places,empty-shop-ga,empty-shop-na,two-villages,@base   # [PA-03] TL-0 판별 draw call 표(--dc 만 = 이 여섯)
// 옵션: --size 1366x610 · --hour 10 · --gfx fixed · --lookseed 1 · --simrand tool|stage · --frames 60 · --reduce-motion · --voice
//       --net-delay <ms>[:<글자>](서버 응답을 늦춤 — 주소에 그 글자가 든 것만 · 학교망 흉내) · --out tmp/village-d · --keep
//       --save <경로>(저장소 안 저장본 .json — 열기 전에 그 판의 저장 키에 넣음 · 판의 '시작' 땅 대신) · --dc-out <파일>(기본 scripts/village-d/out/dc_baseline.json)
// --dc: 판마다 엶 → 판 카드([시작] · 건너뛰기 · 닫기)를 닫음 → 그래픽 고정 → 10시 · 20시 각각 --frames 장 + 트레이 그림(THUMB · 같은 renderer) 끝 →
//       한 프레임씩 펌프하며 __state().drawCalls · triangles 다섯 번 → 가운데 값(본 패스 — 그림자 패스 제외 · __bench 류는 판을 움직여 안 씀).
//       판 id 또는 @base(= 기본 마을 + pop88 저장본 · village-look 의 '기본+pop88'). 첫 화면이 🗺️ 모형(동네 판)이면 모형 값은 참고로 적고
//       시작칸에 가장 가까운 동네 단추를 눌러 마을 화면을 잰다. 끝에 판 전체 보기(참고). 표 출력 · 110 넘는 칸 ⚠(끝값은 안 바꿈) · 기대가 다 맞을 때만 --dc-out 에 쓴다.
// 시계: 가짜 시계는 rAF · performance.now 만 멈춘다. 장면은 ctx.pump(n)(프레임만) · ctx.advance(ms)(프레임 + 진짜 시간 함께)로 흘린다.
// 출력: <out>/<장면>/ 스크린샷 · result.json(탐침 · 접근성 단추 · 바깥 시도 목록) · 끝값 0 = 기대대로 · 1 = 기대 어긋남 · 2 = 돌리지 못함.
// 기대(늘): 페이지 오류 0 · ?stage= 페이지는 바깥 시도 0. 기본 마을의 바깥 시도는 적기만 한다(문으로 쓰지 않음).
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
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
/* --save — 저장소 안 저장본 파일만(서버가 같은 출처로 내준다) · 경로는 '/' 로 */
const savePath = p => { const f = path.resolve(ROOT, p), rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !/\.json$/i.test(rel) || !fs.existsSync(f) || !fs.statSync(f).isFile()) die('--save 는 저장소 안 저장본 파일(.json) — ' + p); return rel; };
const SAVE = flag('save') ? savePath(opt('save', '')) : null;
/* --dc — [PA-03] TL-0 판별 draw call 표 · 판 id 또는 @base */
const DC_BOARDS = 'lesson0,help-places,empty-shop-ga,empty-shop-na,two-villages,@base', BASE_SAVE = 'village/stages/boards/pop88.json', DC_HOURS = [10, 20], DC_READS = 5, DC_LIMIT = 110;
const DC = flag('dc') ? [...new Set(String(opt('dc', DC_BOARDS)).split(',').map(s => s.trim()).filter(Boolean))] : null, DC_OUT = path.resolve(ROOT, opt('dc-out', 'scripts/village-d/out/dc_baseline.json'));
if (DC) { if (flag('self') || flag('scene') || STAGE_ID || HASH || EVAL || SAVE) die('--dc 는 혼자 쓴다(--self · --scene · --stage · --hash · --eval · --save 와 함께 쓰지 않음 — @base 가 저장본을 넣는다)');
  if (!DC.length) die('--dc <판,판> — 판 id 또는 @base');
  for (const b of DC) if (b !== '@base' && (!/^[a-z0-9-]{1,40}$/.test(b) || !fs.existsSync(path.join(ROOT, 'village/stages', b + '.json')))) die('--dc 판은 village/stages/<id>.json 이 있는 판 id 또는 @base — ' + b); }
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
const name = DC ? 'dc' : SCENE || (STAGE_ID ? 'stage-' + STAGE_ID : 'page'), dir = path.join(OUT, name);
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const R = { 장면: name, 창: VIEW, 시각: DC ? DC_HOURS : HOUR, 그래픽: GFX, lookseed: LOOKSEED, simrand: SIMRAND, 늦춤: DELAY, 저장본: SAVE, 주소: null, 스크린샷: [], 접근성단추: [], 바깥시도: [], 같은출처: 0, 탐침: {}, 페이지오류: [], 기대: [], 장면값: null };
const expect = (ok, msg) => { R.기대.push({ ok: !!ok, 말: msg }); return !!ok; };
const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
let C = null, code = 0;
try {
  C = await openChrome({ chrome: CHROME, view: VIEW, gl: GLARGS, init: initScript({ lookseed: LOOKSEED, simrand: SIMRAND }), allow, tmpPrefix: 'village-d-', keep: KEEP });
  if (flag('voice')) await C.send('Page.addScriptToEvaluateOnNewDocument', { source: VOICE });
  if (flag('reduce-motion')) await C.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await C.send('Accessibility.enable').catch(() => {});

  /* 판 열기 — 새 프로필이라 저장본이 없다(판 파일의 '시작'이 처음 땅) · 열고 첫 프레임까지 · 그래픽 · 시각 고정
     save(--save · @base) 가 있으면 판 밖 쪽(rules.json)에서 그 판의 저장 키에 넣고 연다(마을 쪽은 닫힐 때 제 판을 다시 적는다 — village-look shootBoard 꼴) */
  const open = async ({ stage = STAGE_ID, hash = HASH, save = SAVE, hour = HOUR } = {}) => {
    await C.nav(BASE + '/village/stages/rules.json'); await C.evaluate('localStorage.clear(); sessionStorage.clear(); return 1');
    if (save) await C.evaluate(`const r = await fetch(${JSON.stringify('/' + save.split('/').map(encodeURIComponent).join('/'))}, { cache: 'no-store' }); if (!r.ok) throw new Error('저장본 ' + r.status + ' — ' + ${JSON.stringify(save)});
      localStorage.setItem(${JSON.stringify('rpg.village.guest' + (stage ? '.' + stage : ''))}, await r.text()); return 1`);
    C.st.pageErr.length = 0; R.주소 = pageUrl(stage, hash).slice(BASE.length);
    await C.nav(pageUrl(stage, hash));
    await C.until(`typeof window.__sim === 'function' && typeof window.__gfxMode === 'function' && window.__shots`, 30000, '마을 불러오기');
    await C.pump(1); await C.until('window.__LOADMS != null', 5000, '첫 프레임');
    await C.evaluate(`window.__gfxMode(${JSON.stringify(GFX)}); if (window.__setHour) window.__setHour(${+hour}); return 1`);
    await C.pump(FRAMES); await C.netIdle(); await C.pump(FRAMES); };
  const shot = async label => { await C.evaluate('await window.__shots.real(); return 1');
    const png = Buffer.from((await C.send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
    const f = path.join(dir, String(label || name).replace(/[^\p{L}\p{N}._-]/gu, '_') + '.png'); fs.writeFileSync(f, png); R.스크린샷.push({ 파일: path.relative(ROOT, f), 바이트: png.length }); return f; };
  const ax = async () => { const t = await C.send('Accessibility.getFullAXTree');
    return (t.nodes || []).filter(n => !n.ignored && n.role && n.role.value === 'button' && n.name && String(n.name.value || '').trim())
      .map(n => ({ 이름: String(n.name.value).trim().slice(0, 60), 초점: !!(n.properties || []).find(p => p.name === 'focusable' && p.value && p.value.value) })); };
  const probe = async expr => C.evaluate('return (' + expr + ')');

  /* ── [PA-03] --dc — TL-0 판별 draw call 표 ──
     탐침은 __state().drawCalls 하나(마지막 render 한 번의 본 패스 — three 가 그림자 패스 뒤에 info 를 비움). 가짜 시계라 읽는 사이마다 한 프레임 펌프.
     트레이 그림(THUMB)도 같은 renderer 로 그려 그 프레임의 값을 덮는다 → 줄이 빈 뒤(netIdle + 펌프) 재고, 읽는 프레임에 그림 수가 늘면 그 값은 버린다.
     __bench · __benchLoop 는 쓰지 않는다(÷n · 카메라를 돌림 · simTick · tickFolks 로 판을 움직임). 시뮬은 판 그대로 흐른다(배속 손대지 않음 — 아이가 보는 첫 화면). */
  const closeCards = () => C.evaluate(`const sl = ms => new Promise(r => setTimeout(r, ms)); let quiet = 0; const n = [];
    for (let k = 0; k < 60 && quiet < 6; k++) { const bs = [...document.querySelectorAll('button')].filter(b => ['시작', '건너뛰기', '닫기'].includes(b.textContent.trim()) && b.offsetParent);
      bs.forEach(b => { n.push(b.textContent.trim()); b.click(); }); const g = document.getElementById('guide'); quiet = bs.length || (g && g.className.includes('show')) ? 0 : quiet + 1; await sl(250); } return n`, 60000);   /* 실제 시간 1.5초 조용할 때까지(프레임은 안 돌림 — village-look 의 닫기 꼴) */
  const thumbsIdle = async () => { for (let k = 0; k < 120; k++) { if (!(await probe('window.__thumbStats ? window.__thumbStats().줄 : 0'))) return k; await C.pump(1); } return -1; };
  const settle = async () => { await C.pump(FRAMES); await C.netIdle(); return thumbsIdle(); };
  const DCSTAT = `(() => { const s = window.__state(), t = window.__thumbStats ? window.__thumbStats() : { 그린장수: 0, 실패: 0 }; return { dc: s.drawCalls, tri: s.triangles, th: t.그린장수 + t.실패 }; })()`;
  const med = a => { const b = a.filter(v => Number.isFinite(v)).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  const dcReads = async () => { const v = []; let th = (await probe(DCSTAT)).th, drop = 0;
    for (let k = 0; v.length < DC_READS && k < DC_READS * 4; k++) { await C.pump(1); const s = await probe(DCSTAT); if (s.th !== th) { th = s.th; drop++; continue; } v.push(s); }
    const info = await probe(`(() => { const s = window.__state(), g = window.__gfx(), e = window.__events ? window.__events() : {}, pm = window.__protoMap ? window.__protoMap() : null, m = window.__sim(), ch = window.__chunks ? window.__chunks() : {};
      return { 단계: g.단계, 모드: g.모드, 사람: s.사람, 배율: s.배율, 지도모드: !!ch.지도모드, 비: !!e.비, 모형: !!(pm && pm.켜짐), 시뮬: { 일: m.일, 시: m.시, 배속: m.배속, 멈춤: m.멈춤, 틱: m.틱 } }; })()`);
    return { dc: med(v.map(s => s.dc)), 삼각: med(v.map(s => s.tri)), 읽음: v.map(s => s.dc), 삼각읽음: v.map(s => s.tri), 버림: drop, ...info }; };
  const gfxHour = h => C.evaluate(`window.__gfxMode(${JSON.stringify(GFX)}); ${h == null ? '' : 'window.__setHour(' + h + ');'} return 1`);
  const dcBoard = async 판 => { const base = 판 === '@base', stage = base ? null : 판, save = base ? BASE_SAVE : null, t0 = Date.now(), tries0 = C.st.tries.length;
    const row = { 판, 저장본: save, 첫화면: '마을', 카드: [], 모형: null, 단추: null, 낮: null, 밤: null, 전체: null, 페이지오류: [], 바깥시도: [], 초: 0 };
    try {
      await open({ stage, hash: null, save, hour: DC_HOURS[0] }); row.카드 = await closeCards();   /* 시각은 열 때 한 번만 맞춘다(뒤로 감는 일 없게 — 10시 → 20시 앞으로만) */
      if (stage) { const sg = await probe('window.__stage ? window.__stage() : null'); row.판열림 = sg ? { id: sg.id, 이름: sg.이름, 오류: sg.오류 || null, 원격: sg.원격 } : null;
        expect(sg && sg.id === stage && !sg.오류, 판 + ' 판 열림 — ' + (sg ? (sg.오류 || sg.이름 || sg.id) : '__stage 없음')); expect(sg && !sg.원격, 판 + ' 원격 동기 꺼짐'); }
      await gfxHour(null); await settle();
      /* 첫 화면이 🗺️ 모형(동네 판 — pmapBar 가 'map' 을 켬 · 마을은 한 조각도 안 그림)이면 그 값은 참고로 적고,
         시작칸에 가장 가까운 동네 단추를 눌러 마을 화면으로(아이가 누르는 그 단추 · 배율은 시작칸 배율 그대로) */
      if (await probe('!!(window.__protoMap && window.__protoMap().켜짐)')) {
        row.첫화면 = '모형'; row.모형 = await dcReads();
        const def = JSON.parse(fs.readFileSync(path.join(ROOT, 'village/stages', stage + '.json'), 'utf8')), sc = def.시작칸 && Array.isArray(def.시작칸.칸) ? def.시작칸.칸 : null, ns = Array.isArray(def.동네) ? def.동네 : [];
        let bi = 0, bd = Infinity; if (sc) ns.forEach((n, i) => { const g = n && n.가운데, d = Array.isArray(g) ? Math.hypot(g[0] - sc[0], g[1] - sc[1]) : Infinity; if (d < bd) { bd = d; bi = i; } });
        row.단추 = { k: 'v' + bi, 이름: (ns[bi] && ns[bi].이름) || null, 시작칸까지칸: Number.isFinite(bd) ? +bd.toFixed(2) : null };
        const ok = await C.evaluate(`const b = document.querySelector('#pmapBar button[data-k="v${bi}"]'); if (!b) return false; b.click(); return !window.__protoMap().켜짐`);
        expect(ok, 판 + ' 첫 화면 모형 → 마을 단추 ' + (row.단추.이름 || row.단추.k)); await settle(); }
      row.낮 = { 시: DC_HOURS[0], ...(await dcReads()) };
      await gfxHour(DC_HOURS[1]); await settle(); row.밤 = { 시: DC_HOURS[1], ...(await dcReads()) };   /* 20시 = 밤 1.0 — 밤 창빛 · 반딧불이 더해지는 게 정상 */
      /* 판 전체 보기 — 참고(D §TL-0 '참고 줄') · 카메라가 첫 화면으로 못 돌아와 맨 끝(마지막 시각 그대로) */
      await C.evaluate('document.getElementById("fitBtn").onclick(); return 1'); await settle(); row.전체 = { 시: DC_HOURS[DC_HOURS.length - 1], ...(await dcReads()) };
      const errs = await C.evaluate('return window.__shots.errs.slice(0, 5)'); row.페이지오류 = [...C.st.pageErr.slice(0, 5), ...errs];
    } catch (e) { row.실패 = String(e.message || e).slice(0, 200); expect(false, 판 + ' 잼 — ' + row.실패); }
    row.바깥시도 = C.st.tries.slice(tries0).filter(t => !t.ok).map(t => t.url);
    expect(row.페이지오류.length === 0, 판 + ' 페이지 오류 0' + (row.페이지오류.length ? ' — ' + row.페이지오류.slice(0, 2).join(' / ') : ''));
    if (stage) expect(row.바깥시도.length === 0, 판 + ' 바깥 시도 0' + (row.바깥시도.length ? ' — ' + row.바깥시도.slice(0, 3).join(' · ') : ''));   /* 기본 마을은 적기만 */
    expect([row.낮, row.밤].every(r => r && Number.isFinite(r.dc) && Number.isFinite(r.삼각) && r.읽음.length === DC_READS && !r.모형 && !r.지도모드), 판 + ' 낮 · 밤 마을 화면(모형 · 지도 아님) 다섯 번씩 숫자');
    row.초 = +((Date.now() - t0) / 1000).toFixed(1); return row; };

  if (DC) {
    R.dc = { 판: [], 렌더러: null };
    for (const b of DC) { process.stderr.write(`  [dc] ${b} … `); const row = await dcBoard(b); R.dc.판.push(row);
      process.stderr.write(row.실패 ? '실패 — ' + row.실패.slice(0, 120) + '\n' : `낮 ${row.낮.dc} · 밤 ${row.밤.dc} · ${row.초}초\n`); }
    R.dc.렌더러 = await probe(`(() => { const c = document.getElementById('cv'), g = c && (c.getContext('webgl2') || c.getContext('webgl')), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; })()`).catch(() => null);
    const steps = [...new Set(R.dc.판.flatMap(r => [r.낮, r.밤].filter(Boolean).map(x => x.단계)))]; R.dc.단계 = steps.length === 1 ? steps[0] : steps;
    expect(steps.length === 1, '그래픽 단계 한 가지 — ' + JSON.stringify(steps));
    R.바깥시도 = C.st.tries.filter(t => !t.ok); R.같은출처 = C.st.tries.filter(t => t.ok && t.url.startsWith(BASE + '/')).length;
  } else {
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
  }
  code = R.기대.every(e => e.ok) ? 0 : 1;
} catch (e) { R.멈춤 = String(e.message || e).slice(0, 300); code = 2; }
finally { try { C && await C.close(); } catch {} srv.close(); await sleep(200); }

fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(R, null, 1));
if (DC) {   /* ── [PA-03] 표 · 기준표(dc_baseline.json) ── */
  const rows = (R.dc && R.dc.판) || [], eng = (git('log', '-1', '--format=%h', 'HEAD', '--', 'village') || '?') + (git('status', '--porcelain', '--', 'village') ? '+고친것' : '');
  const step = R.dc && R.dc.단계, stepTxt = 'GFX 단계 ' + (Array.isArray(step) ? step.join('/') : step) + ' · 본 패스(그림자 제외)';
  const at = (d => { const o = -d.getTimezoneOffset(), p = n => String(Math.floor(Math.abs(n))).padStart(2, '0'); return new Date(d.getTime() + o * 60000).toISOString().slice(0, 19) + (o < 0 ? '-' : '+') + p(o / 60) + ':' + p(o % 60); })(new Date());   /* 이 기기 시각(+09:00) */
  const READ = `${DC_HOURS.join('시 · ')}시 각각 ${FRAMES}장 + 트레이 그림 끝 → 한 장씩 펌프하며 __state().drawCalls · triangles 다섯 번 → 가운데 값 · 삼각 = 낮`;
  const CB = '크롬북 실기 대조는 dc 가 아니라 __gfx()(단계 · 놓친 비율) · __benchP99(ms) 몫';
  const ref = r => [r.첫화면 === '모형' ? `첫 화면 🗺️ 모형 ${r.모형 ? r.모형.dc : '?'} → '${(r.단추 && (r.단추.이름 || r.단추.k)) || '?'}' 단추로 마을(시작칸과 ${r.단추 ? r.단추.시작칸까지칸 : '?'}칸)` : null,
    r.전체 ? `전체 보기 ${r.전체.dc}(${r.전체.시}시${r.전체.지도모드 ? ' · 지도 모드' : ''})` : null, r.낮 ? `사람 ${r.낮.사람}` : null, r.낮 && r.낮.비 ? '비' : null].filter(Boolean).join(' · ');
  const L = [`dcheck --dc — 판 ${rows.length} · ${VIEW.w}×${VIEW.h} · 그래픽 ${GFX}(${stepTxt}) · lookseed ${LOOKSEED} · simrand ${SIMRAND} · 엔진 ${eng} · 렌더러 ${(R.dc && R.dc.렌더러) || '?'}`,
    `  읽기: ${READ} · ${CB}`, '',
    `| 판 | 낮 dc | 밤 dc | 삼각 | TL 뒤 dc | 판정(≤${DC_LIMIT}) | 참고 |`, '|---|---|---|---|---|---|---|',
    ...rows.map(r => r.실패 || !r.낮 || !r.밤 ? `| ${r.판} | — | — | — | — | 실패 | ${r.실패 || '값 없음'} |`
      : `| ${r.판} | ${r.낮.dc} | ${r.밤.dc} | ${r.낮.삼각} | — | ${Math.max(r.낮.dc, r.밤.dc) > DC_LIMIT ? '⚠ ' + DC_LIMIT + ' 넘음' : '✓'} | ${ref(r)} |`), ''];
  const bad = R.기대.filter(e => !e.ok);
  L.push(bad.length ? bad.map(e => `  ✗ ${e.말}`).join('\n') : `  ✓ 기대 ${R.기대.length}개 모두(판 열림 · 원격 꺼짐 · 페이지 오류 0 · 판 바깥 시도 0 · 다섯 번씩 숫자 · 단계 한 가지)`);
  if (R.멈춤) L.push('  멈춤: ' + R.멈춤);
  if (code === 0) {
    const J = { _조건: { 창: VIEW.w + '×' + VIEW.h, 그래픽: GFX, 단계: stepTxt, lookseed: LOOKSEED, simrand: SIMRAND, 렌더러: (R.dc && R.dc.렌더러) || null, 잰때: at,
      시각: '낮 ' + DC_HOURS[0] + '시 · 밤 ' + DC_HOURS[1] + '시', 읽기: READ, 엔진: 'village/ 를 마지막으로 바꾼 커밋(git log -1 -- village)',
      첫화면: '판 카드 [시작] 뒤 시작칸 배율 · 첫 화면이 🗺️ 모형인 판(동네)은 시작칸에 가장 가까운 동네 단추를 누른 마을 화면 · @base = 기본 마을 + pop88 저장본',
      크롬북: CB, 명령: 'node scripts/village-d/dcheck.mjs --dc ' + DC.join(',') } };
    rows.forEach(r => { J[r.판] = { 엔진: eng, 낮: r.낮.dc, 밤: r.밤.dc, 삼각: r.낮.삼각, TL뒤: null }; });
    J._참고 = Object.fromEntries(rows.map(r => [r.판, { 밤삼각: r.밤.삼각, 전체: r.전체 ? r.전체.dc : null, 전체지도: r.전체 ? r.전체.지도모드 : null, 사람: r.낮.사람,
      ...(r.첫화면 === '모형' ? { 첫화면: '모형', 모형: r.모형 ? r.모형.dc : null, 마을단추: r.단추 ? r.단추.이름 || r.단추.k : null } : {}) }]));
    fs.mkdirSync(path.dirname(DC_OUT), { recursive: true }); fs.writeFileSync(DC_OUT, JSON.stringify(J, null, 1) + '\n');
    L.push(`판정: PASS · 기준표 ${path.relative(ROOT, DC_OUT)} · 결과 ${path.relative(ROOT, path.join(dir, 'result.json'))}`);
  } else L.push(`판정: ${code === 1 ? 'FAIL — 기대 어긋남' : '돌리지 못함'} · 기준표는 쓰지 않음 · 결과 ${path.relative(ROOT, path.join(dir, 'result.json'))}`);
  console.log(L.join('\n')); process.exit(code);
}
const L = [`dcheck — ${R.주소 || '(못 엶)'}${SAVE ? ' + 저장본 ' + SAVE : ''} · ${VIEW.w}×${VIEW.h} · ${HOUR}시 · 그래픽 ${GFX} · lookseed ${LOOKSEED} · simrand ${SIMRAND}${DELAY ? ' · 늦춤 ' + DELAY.ms + 'ms' + (DELAY.match ? '(' + DELAY.match + ')' : '') : ''}${KEEP ? ' · 프로필 남김' : ''}`,
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
