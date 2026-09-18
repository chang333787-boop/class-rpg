// 꾸미기 놀이판 — 실제 student.html 을 가짜(오프라인) DB 로 띄워 사람이·세션이 직접 눌러 보는 곳.
//  · 운영 Firebase 에 한 번도 닿지 않는다(boot.js 가 없는 프로젝트 + goOffline).
//  · 비밀번호 입력 없이 '시험' 학생으로 바로 들어간다(자동 입장).
//  · 장식은 전부 3개씩, 골드 5000 — 무엇이든 놓아 볼 수 있게.
//  실행: node scripts/unit/deco-save-count/play.mjs [포트=8780]  →  http://127.0.0.1:<포트>/student.html
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || path.resolve(HERE, '..', '..', '..');
const PORT = Number(process.argv[2] || 8780);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = p.startsWith('/h/') ? path.join(HERE, p.slice(3)) : path.join(REPO, p === '/' ? '/student.html' : p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/student.html' || p === '/') {
    let s = body.toString('utf8');
    s = s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*(firestore|storage)-compat\.js"><\/script>/g, '');
    s = s.replace(/(<script src="\.\/gamedata\.js[^"]*"><\/script>)/, '<script src="/h/play-boot.js"></script>$1');
    s = s.replace(/<\/body>/i, '<script src="/h/play-enter.js"></script></body>');
    body = Buffer.from(s);
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
});
srv.listen(PORT, '127.0.0.1', () => console.log(`꾸미기 놀이판: http://127.0.0.1:${PORT}/student.html  (운영 DB 안 씀 · 자동 입장)`));
