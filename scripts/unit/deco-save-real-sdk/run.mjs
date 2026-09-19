// 꾸미기 저장 하네스 (DECO-SAVE-1) — 끝에서 끝 — **실제 student.html·student.js·gamedata.js + 실제 firebase SDK 9.23.0**.
//  가짜 프로젝트 + goOffline() 이라 Realtime DB 통신 0. firestore·storage SDK 는 페이지에서 뺀다(운영 영어앱 읽기도 0).
//  SDK 스크립트 파일만 gstatic 에서 받는다. 엣지(헤드리스) 필요.
//  흐름: 로그인 → 1.5초 한가 → 케이스 실행 → SDK 로컬 값 비교.
//   place20/paint20: 20번 놓기·칠하기가 서버에 다 남는가 · 쓰기 몇 번인가
//   closeMid: 칠하는 도중 창 닫기 · teacherEdit: 칠하는 도중 교사 골드 지급
//  사용: node scripts/unit/deco-save-real-sdk/run.mjs [place20|paint20|closeMid|teacherEdit] [--profile=student|root|both]
//        --expect-fixed → 기대와 다른 케이스가 있으면 exit 1
//        --profile=student|root|both (기본 root) — student = 학생 기기 판(STUDENT-COLD-1 노드별 구독), root = 교사·옛 판
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.Q1_REPO || path.resolve(HERE, '..', '..', '..');   // Q1_REPO=<다른 체크아웃> 이면 그 앱 코드로
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

// 케이스마다 새 브라우저 한 번. 기대: 전부 OK(놓은 것이 다 남고, 교사 골드가 안 되돌아감)
const CASES = ['place20', 'paint20', 'closeMid', 'teacherEdit'];
const only = process.argv.slice(2).find(a => !a.startsWith('--'));
const PROF = ((process.argv.find(a => a.startsWith('--profile=')) || '--profile=student').split('=')[1]);
const PROFILES = PROF === 'both' ? ['root', 'student'] : [PROF];
let bad = 0;
for (const profile of PROFILES) for (const name of CASES) {
  if (only && only !== name) continue;
  const { stdout } = await run('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${process.env.TEMP}/qa_q1_deco_${profile}_${name}`, '--virtual-time-budget=30000', '--dump-dom',
     `http://127.0.0.1:${srv.address().port}/student.html?case=${name}&profile=${profile}`], { maxBuffer: 1e8, timeout: 180000 });
  const text = (stdout.match(/<pre id="q1-out">([\s\S]*?)<\/pre>/) || [, '{}'])[1].replace(/&quot;/g, '"');
  let o = {}; try { o = JSON.parse(text); } catch { o = { err: 'no output', raw: text.slice(0, 120) }; }
  const ok = o.VERDICT === 'OK';
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '🔴'} [${profile}] ${name.padEnd(11)} ${o.VERDICT || o.err || '?'} · 놓임 ${o.serverDecos ?? '-'}/밭 ${o.serverFloor ?? '-'} · saveStudent ${o.saveStudentCalls ?? '-'} · SDK 쓰기 ${o.sdkWrites ?? '-'}${o.goldBefore !== undefined ? ` · 골드 ${o.goldBefore}→${o.goldAfter}` : ''}${o.enterErr ? ' · enterErr ' + o.enterErr : ''}`);
}
srv.close();
console.log('');
console.log(bad ? `최종 결과: 🔴 ${bad}건 기대와 다름` : '최종 결과: ✅ 전부 기대대로');
if (EXPECT_FIXED && bad) process.exit(1);
