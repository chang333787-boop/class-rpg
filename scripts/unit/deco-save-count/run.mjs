import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
//  브라우저: BROWSER 환경변수 > 맥 크롬 > 윈도 엣지 (맥북에서도 그대로 돌게)
const BROWSER = process.env.BROWSER || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
import os from 'node:os';
//  [DECO-HARNESS-PRECHECK-1] 프로필 폴더는 **실행마다 새로** — 고정 폴더면 세션 둘이 동시에 돌릴 때 뒤엣것이
//  `SingletonLock: File exists` 로 못 뜨고 죽는데, 출력에 `=false` 가 없어 '실패 0'으로 읽혔다(가짜 통과).
const PROFILE = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || os.tmpdir(), 'deco_save_count_'));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || path.resolve(HERE, '..', '..', '..');   // 이 하네스가 든 저장소
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
//  바깥 스크립트(Firebase SDK·Chart.js)는 **한 번만 받아** 기기 임시 폴더에 두고 이 서버가 내준다.
//  프로필을 실행마다 새로 만들면 브라우저 캐시가 없어 매번 CDN 에서 다시 받는다 — 같은 하네스가 3.5초에도, 3분(시간 초과)에도 끝났다.
//  받은 파일은 임시 이름으로 쓴 뒤 rename(동시 실행 안전). 못 받으면 원래 주소 그대로 둔다(전과 같은 동작).
const EXT_CACHE = path.join(os.tmpdir(), 'rpg_harness_ext_cache');
async function extLocal(url) {
  const name = url.replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9._-]/g, '_');
  const file = path.join(EXT_CACHE, name);
  if (!fs.existsSync(file)) {
    try {
      const r = await fetch(url); if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(EXT_CACHE, { recursive: true });
      const tmp = file + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, buf); fs.renameSync(tmp, file);
    } catch (e) { return null; }
  }
  return '/ext/' + name;
}
const EXT_RE = /<script src="(https:\/\/(?:www\.gstatic\.com\/firebasejs|cdnjs\.cloudflare\.com)\/[^"]+)"><\/script>/g;
//  결과는 **페이지가 끝나는 순간 이 서버로 보낸다**(test.js done() → POST /__done). 전에는 --dump-dom 출력을 기다렸는데,
//  맥 크롬은 검사가 끝나도 스스로 안 끝나서 매번 노드 타임아웃(120초)에 죽인 뒤에야 DOM 을 받았다(늘 2분 · 가끔은 못 받음).
let doneText = null, doneResolve; const donePromise = new Promise(r => { doneResolve = r; });
const srv = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/__done') {
    let b = ''; req.setEncoding('utf8'); req.on('data', d => { b += d; }); req.on('end', () => { doneText = b; res.writeHead(204); res.end(); doneResolve(); });
    return;
  }
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = p.startsWith('/h/') ? path.join(HERE, p.slice(3)) : p.startsWith('/ext/') ? path.join(EXT_CACHE, path.basename(p)) : path.join(REPO, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/student.html') {
    let s = body.toString('utf8');
    s = s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*(firestore|storage)-compat\.js"><\/script>/g, '');
    s = s.replace(/(<script src="\.\/gamedata\.js[^"]*"><\/script>)/, '<script src="/h/boot.js"></script>$1');
    for (const m of [...s.matchAll(EXT_RE)]) { const loc = await extLocal(m[1]); if (loc) s = s.replace(m[0], `<script src="${loc}"></script>`); }
    s = s.replace(/<\/body>/i, '<script src="/h/test.js"></script></body>');
    body = Buffer.from(s);
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
import { spawn } from 'node:child_process';
let runErr = null;
//  [DECO-GPU-1] 그래픽칩으로 그린다 — 맥은 Metal(--use-angle=metal --use-gl=angle · 보스 09-24). 크롬북도 GPU 가 있어 이쪽이 실제에 가깝다.
//  그래픽칩이 없는 기기만 --soft(옛 --disable-gpu). 맥이 아니면 브라우저 기본값.
const GPU_ARGS = process.argv.includes('--soft') ? ['--disable-gpu'] : process.platform === 'darwin' ? ['--use-angle=metal', '--use-gl=angle'] : [];
const child = spawn(BROWSER, ['--headless=new', ...GPU_ARGS, '--no-first-run', `--user-data-dir=${PROFILE}`, '--virtual-time-budget=150000', '--dump-dom',
  `http://127.0.0.1:${srv.address().port}/student.html`], { stdio: 'ignore' });
child.on('error', e => { runErr = e; doneResolve(); });
child.on('exit', () => setTimeout(doneResolve, 1500));          // 결과 없이 죽었으면 여기서 끝난다
//  [DECO-GUEST-1] 가상 시간 90초가 꽉 찼다(09-25 · 걸린시간_초=90) — 시험이 늘면 끝 표식 없이 끊겼다 → 150초 · 실제 포기 240초
const giveUp = setTimeout(doneResolve, 240000);
await donePromise; clearTimeout(giveUp);
try { child.kill('SIGKILL'); } catch (e) {}
const text = doneText !== null ? doneText : 'no output';
console.log(text); srv.close(); if (srv.closeAllConnections) srv.closeAllConnections();
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
//  끝 표식(test.js 의 done() 이 맨 끝에 찍는 `걸린시간_초=`)이 없으면 실패 — 브라우저가 못 떴거나 도중에 죽은 것이다.
if (runErr || !/^걸린시간_초=\d+/m.test(text)) {
  console.error('\n❌ 하네스가 끝까지 돌지 않았다(끝 표식 없음)' + (runErr ? ' — ' + String(runErr.message || runErr).slice(0, 300) : ''));
  process.exit(1);
}
