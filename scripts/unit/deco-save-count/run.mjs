import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
//  브라우저: BROWSER 환경변수 > 맥 크롬 > 윈도 엣지 (맥북에서도 그대로 돌게)
const BROWSER = process.env.BROWSER || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || path.resolve(HERE, '..', '..', '..');   // 이 하네스가 든 저장소
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = p.startsWith('/h/') ? path.join(HERE, p.slice(3)) : path.join(REPO, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/student.html') {
    let s = body.toString('utf8');
    s = s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*(firestore|storage)-compat\.js"><\/script>/g, '');
    s = s.replace(/(<script src="\.\/gamedata\.js[^"]*"><\/script>)/, '<script src="/h/boot.js"></script>$1');
    s = s.replace(/<\/body>/i, '<script src="/h/test.js"></script></body>');
    body = Buffer.from(s);
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { stdout } = await run(BROWSER,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${TMP}/deco_save_count`, '--virtual-time-budget=90000', '--dump-dom',
   `http://127.0.0.1:${srv.address().port}/student.html`], { maxBuffer: 1e8, timeout: 120000 });
const text = (stdout.match(/<pre id="rf-out">([\s\S]*?)<\/pre>/) || [, 'no output — title: ' + (stdout.match(/<title>([^<]*)/) || [])[1]])[1].replace(/&quot;/g, '"');
console.log(text); srv.close();
