// GOLD-LOSS-SIM-1 끝에서 끝 확인 — **실제 student.html·student.js·gamedata.js + 실제 firebase SDK 9.23.0**.
//  가짜 프로젝트 + goOffline() 이라 Realtime DB 통신 0. firestore·storage SDK 는 페이지에서 뺀다(운영 영어앱 읽기도 0).
//  SDK 스크립트 파일만 gstatic 에서 받는다. 엣지(헤드리스) 필요.
//  흐름: 로그인 → 1.5초 한가 → _finishBattle(승리 10G) → SDK 로컬 totalGold·goldDaily 비교.
//  사용: node scripts/unit/gold-loss-real-sdk/run.mjs            → VERDICT LOSS/NO_LOSS 출력
//        node scripts/unit/gold-loss-real-sdk/run.mjs --expect-fixed  → LOSS 면 exit 1
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const EXPECT_FIXED = process.argv.includes('--expect-fixed');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = p.startsWith('/q1/') ? path.join(HERE, p.slice(4)) : path.join(REPO, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/student.html') {
    let s = body.toString('utf8');
    // 운영 프로젝트에 닿을 수 있는 firestore·storage SDK 는 뺀다(영어앱 읽기 포함 통신 0)
    s = s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*(firestore|storage)-compat\.js"><\/script>/g, '');
    // firebase-database-compat 뒤, gamedata.js 앞에 boot.js
    s = s.replace(/(<script src="\.\/gamedata\.js[^"]*"><\/script>)/, '<script src="/q1/boot.js"></script>$1');
    s = s.replace(/<\/body>/i, '<script src="/q1/test.js"></script></body>');
    body = Buffer.from(s);
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { stdout } = await run('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${process.env.TEMP}/qa_q1_realsdk`, '--virtual-time-budget=20000', '--dump-dom',
   `http://127.0.0.1:${srv.address().port}/student.html`], { maxBuffer: 1e8, timeout: 120000 });
const text = (stdout.match(/<pre id="q1-out">([\s\S]*?)<\/pre>/) || [, 'no output — title: ' + (stdout.match(/<title>([^<]*)/) || [])[1]])[1].replace(/&quot;/g, '"');
console.log(text);
srv.close();
const verdict = (text.match(/VERDICT="(\w+)"/) || [])[1] || 'UNKNOWN';
console.log('');
console.log(verdict === 'NO_LOSS' ? '최종 결과: ✅ 유실 0'
  : verdict === 'LOSS' ? '최종 결과: 🔴 LOSS (10G 지급했는데 totalGold 그대로, goldDaily 는 남음)'
  : '최종 결과: ⚠️ 판정 불가');
if (EXPECT_FIXED && verdict !== 'NO_LOSS') process.exit(1);
