// 마을 시뮬 도구 — 3D 없이 저장본을 N일 돌리고 표를 뽑는다(엔진 제안서 ① · docs/village_engine_proposal.md).
// village/index.html 은 한 줄도 안 고친다. 네트워크 0 · sync.js 안 부름 · sid 늘 guest → 운영 DB 에 닿지 않는다.
//
// 쓰는 법 (README 는 scripts/village-sim/README.md):
//   node scripts/village-sim/run.mjs --save village/_t/pop167.json --days 2 --seeds 1-5
//   node scripts/village-sim/run.mjs --save <판> --days 2 --seeds 1-5 --watch 일먼집 \
//        --vs '가게1: do=put shop @jobs 1' --vs '가게3: do=put shop @jobs 3'
//   node scripts/village-sim/run.mjs --save <판> --vs '끔: rules=jobsHomes.on=false'
//   node scripts/village-sim/run.mjs --save <옛판> --vs '새판: save=<다른 판>'
// 체득 지표(보스 09-20): ① 선택 대비 — 같은 시드에서 '기본'과 한 수 둔 판의 끝 값 차이 ② 인과 지연 — 한 수를 둔 뒤 몇 시간(시뮬) 만에
// 차이가 나서 끝까지 유지되나. (현상 발생률 · 관찰 밀도는 다음에)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DAY = 1800;   // 틱 · 하루 3분 ÷ 100ms

/* 낮을수록 좋은 지표 — 나머지는 높을수록 좋다 */
const LOWER = k => /^(붐빔집|일먼집|돌아선집|찡그린집|없음:|까닭:)/.test(k);
/* [MAC-JOBWHY] 집 카드가 일자리를 말하는 네 꼴 — 옛 index.html 은 첫 줄 하나뿐이라 그것도 그대로 잡힌다 */
const JW_TXT = { none: '일할 곳이 없어요', cut: '길이 끊겨 일터에 못 가요', far: '일터가 멀어요', full: '가까운 일터가 꽉 찼어요' };
const jobWhyOf = t => Object.keys(JW_TXT).find(k => t.includes(JW_TXT[k])) || null;
/* 집 말은 필요 이름이 아니라 이 글로 나온다(index.html NEED_TXT) — '배울 곳이 멀어요' → 배움 */
const NEED_TXT = { 물: '물 뜰 곳', 장보기: '장 볼 곳', 놀이: '놀 곳', 쉼: '쉴 곳', 배움: '배울 곳' }, NEED_OF = Object.fromEntries(Object.entries(NEED_TXT).map(([k, v]) => [v, k]));
const missOf = txt => { const mm = txt.match(/^[^ ]+ (.+?)이 멀어요/); return mm ? mm[1].split('·').map(t => NEED_OF[t] || t) : []; };

/* ─────────────── 한 판(자식 프로세스) ─────────────── */
function measure(w) {
  const snap = w.__snapshot(), p = w.__pop(), j = w.__jobs();
  const m = { 인구: p.인구, 사는집: 0, 웃는집: 0, 찡그린집: 0, 붐빔집: 0, 일먼집: 0, '2층이상': p.층[1] + p.층[2], '3층': p.층[2], 찬자리: j.찬자리, 일자리: j.일자리, 목표: w.__goals().이룬것.length };
  try { m.돌아선집 = w.__away().돌아선집; } catch { m.돌아선집 = 0; }
  const need = {};
  snap.물건.forEach(t => {
    const mm = t.match(/^house@(\d+),(\d+)/); if (!mm) return;
    const x = +mm[1], y = +mm[2], txt = w.__houseText(x, y);
    const root = y * 256 + x, lived = snap.집[root] && snap.집[root][0] > 0;   // __snapshot().집 = { root: [식구, 층] }
    if (!lived) return;
    m.사는집++;
    if (txt.startsWith('😊')) m.웃는집++; else if (txt.startsWith('😟')) m.찡그린집++;
    if (txt.includes('길이 붐벼요')) m.붐빔집++;
    const jw = jobWhyOf(txt);   /* [MAC-JOBWHY] 까닭 넷 — 합(일먼집)은 고치기 전과 같은 자 */
    if (jw) { m.일먼집++; m['까닭:' + jw] = (m['까닭:' + jw] || 0) + 1; }
    missOf(txt).forEach(k => { need['없음:' + k] = (need['없음:' + k] || 0) + 1; });
  });
  ['none', 'cut', 'far', 'full'].forEach(k => { if (m['까닭:' + k] == null) m['까닭:' + k] = 0; });
  m['일닿음%'] = m.사는집 ? Math.round((1 - m.일먼집 / m.사는집) * 1000) / 10 : 100;
  if (typeof w.__stage === 'function') { const st = w.__stage(); if (st.id) { m.판목표 = st.목표.filter(g => g[1]).length; m.판목표수 = st.목표.length; } }
  return Object.assign(m, need);
}

function housesWith(w, what) {   // @jobs · @crowd · @need:물
  const need = what.startsWith('need:') ? what.slice(5) : null;
  const hit = what === 'jobs' ? t => !!jobWhyOf(t) : what === 'crowd' ? t => t.includes('길이 붐벼요')
    : need ? t => missOf(t).includes(need) : null;
  if (!hit) throw new Error('모르는 자리 @' + what + ' (jobs · crowd · need:<필요>)');
  const out = []; w.__snapshot().물건.forEach(t => { const mm = t.match(/^house@(\d+),(\d+)/); if (mm && hit(w.__houseText(+mm[1], +mm[2]))) out.push([+mm[1], +mm[2]]); });
  return out;
}

/* 한 수: 'put shop 136 145 0' · 'put shop @jobs 3' · 'put shop @at:160,171 5' · 'road 172 170 150 170'(곧은 길 긋기) · 'widen @crowd 5'(문 앞 길을 큰길로) · 'del 136 145' */
function doMove(w, cmd) {
  const a = cmd.trim().split(/\s+/);
  if (a[0] === 'del') { w.__del(+a[1], +a[2]); return { 한수: cmd, 됨: 1 }; }
  if (a[0] === 'widen') {   // 'widen @crowd 5' — 붐비는 집 n채의 문 앞 길을 큰길로(index.html __widenFront · 바꿔 깔기)
    if (typeof w.__widenFront !== 'function') throw new Error('이 판에는 __widenFront 가 없음');
    const hs = housesWith(w, (a[1] || '@crowd').slice(1)), n = +(a[2] || 99), why = {}; let ok = 0, tried = 0;
    for (const [x, y] of hs) { if (tried >= n) break; tried++; const r = w.__widenFront(x, y); if (r === true) ok++; else why[r] = (why[r] || 0) + 1; }
    return { 한수: cmd, 됨: ok, 까닭: Object.keys(why).length ? Object.entries(why).map(([k, v]) => v + '× ' + String(k).slice(0, 30)).join(' · ') : undefined };
  }
  if (a[0] === 'road') {   // 가로나 세로 곧은 줄만 — 이미 길인 칸은 건너뛴다
    const [x1, y1, x2, y2] = a.slice(1, 5).map(Number); if (x1 !== x2 && y1 !== y2) throw new Error('road 는 가로·세로 곧은 줄만: ' + cmd);
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1), n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) + 1; let ok = 0; const bad = [];
    for (let i = 0; i < n; i++) { const x = x1 + dx * i, y = y1 + dy * i, r = w.__put('road', x, y, 0); if (r === true) ok++; else if (!/길/.test(String(r))) bad.push(x + ',' + y + ' ' + r); }
    return { 한수: cmd, 됨: ok, 까닭: bad.length ? bad.slice(0, 3).join(' · ') : undefined };
  }
  if (a[0] !== 'put') throw new Error('모르는 한 수: ' + cmd);
  const kind = a[1];
  try { w.__put(kind, -1, -1, 0); } catch { throw new Error('모르는 건물: ' + kind); }   // 판 밖 칸 — 놓이지 않고 종류만 확인
  if (!a[2].startsWith('@')) { const r = w.__put(kind, +a[2], +a[3], +(a[4] || 0)); return { 한수: cmd, 됨: r === true ? 1 : 0, 까닭: r === true ? undefined : r }; }
  const n = +(a[3] || 1); let cx = 0, cy = 0;
  if (a[2].startsWith('@at:')) { [cx, cy] = a[2].slice(4).split(',').map(Number); }
  else { const hs = housesWith(w, a[2].slice(1)); if (!hs.length) return { 한수: cmd, 됨: 0, 까닭: '그런 집이 없음' };
    hs.forEach(([x, y]) => { cx += x; cy += y; }); cx = Math.round(cx / hs.length); cy = Math.round(cy / hs.length); }
  const cand = []; for (let y = cy - 60; y <= cy + 60; y++) for (let x = cx - 60; x <= cx + 60; x++) if (x >= 0 && y >= 0 && x < 256 && y < 256) cand.push([Math.hypot(x - cx, y - cy), x, y]);
  cand.sort((p, q) => p[0] - q[0]);
  const at = [];
  for (const [d, x, y] of cand) { if (at.length >= n) break; for (let rot = 0; rot < 4; rot++) if (w.__put(kind, x, y, rot) === true) { at.push([x, y, rot, Math.round(d)]); break; } }
  return { 한수: cmd, 됨: at.length, 가운데: [cx, cy], 자리: at };
}

function setRules(w, spec) {
  if (!spec) return;
  spec.split(',').map(s => s.trim()).filter(Boolean).forEach(kv => {
    const [k, v] = kv.split('='); const ks = k.trim().split('.');
    let o = w.VRULES; for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]]) throw new Error('VRULES 에 없음: ' + k); o = o[ks[i]]; }
    let val = v.trim(); try { val = JSON.parse(val); } catch { /* 글자 그대로 */ }
    o[ks[ks.length - 1]] = val;
  });
}

async function child(spec) {
  const { loadVillage } = await import('./load.mjs');
  const saveText = spec.save ? fs.readFileSync(path.resolve(ROOT, spec.save), 'utf8') : null;
  const { w } = await loadVillage({ root: ROOT, html: spec.html || null, saveText, seed: spec.seed, hash: spec.hash, query: spec.stage ? 'stage=' + encodeURIComponent(spec.stage) : '' });
  const stage = typeof w.__stage === 'function' ? w.__stage() : null;
  if (spec.stage && (!stage || stage.오류 || stage.id !== spec.stage)) throw new Error('판을 못 얹음: ' + (stage ? stage.오류 || stage.id : '__stage 없음'));
  setRules(w, spec.rules);
  const ticks = [], samples = []; let tick = 0;
  const run = n => { const r = w.__tickBench(n); ticks.push(r.틱최대ms); tick += n; };
  const sample = () => { const s = w.__sim(); samples.push({ tick, 일: s.일, 시: s.시, m: measure(w) }); };
  run(spec.warm);
  sample();
  const moves = (spec.do || '').split(';').map(s => s.trim()).filter(Boolean).map(c => doMove(w, c));
  const t0 = tick;
  while (tick - t0 < spec.days * DAY) { run(Math.min(spec.every, t0 + spec.days * DAY - tick)); sample(); }
  const voice = spec.voice && typeof w.__voice === 'function' ? w.__voice() : null;   // [MAC-VOICE] 끝 날의 동네별 바람표
  return { name: spec.name, seed: spec.seed, moves, t0, samples, voice, 틱최대ms: Math.max(...ticks), 네트워크: globalThis.__simNet || 0, 판: stage && stage.id ? { id: stage.id, 이름: stage.이름, 규칙수: stage.규칙수, 모르는규칙: stage.모르는규칙, 건물수: stage.건물수, 목표: stage.목표 } : null, 자기파일: [...new Set(globalThis.__simLocal || [])] };
}

/* ─────────────── 묶어 돌리기(부모) ─────────────── */
function parseArgs(argv) {
  const o = { vs: [], seeds: '1-3', days: 2, every: 150, warm: 300, hash: 'hour=10', show: '인구,2층이상,웃는집,붐빔집,일먼집,일닿음%', watch: null, by: 1 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, ''), v = argv[i + 1];
    if (k === 'vs') { o.vs.push(v); i++; } else if (k === 'json') { o.json = v; i++; } else if (k === 'child') { o.child = v; i++; }
    else if (k === 'html' || k === 'stage' || k === 'save' || k === 'rules' || k === 'do' || k === 'seeds' || k === 'hash' || k === 'show' || k === 'watch' || k === 'name') { o[k] = v; i++; }
    else if (k === 'days' || k === 'every' || k === 'warm' || k === 'by' || k === 'jobs') { o[k] = +v; i++; }
    else if (k === 'help' || k === 'h') o.help = true;
    else if (k === 'voice') o.voice = true;
    else throw new Error('모르는 인자: ' + argv[i]);
  }
  return o;
}
const seedList = s => { const out = []; String(s).split(',').forEach(p => { const [a, b] = p.split('-').map(Number); for (let x = a; x <= (b || a); x++) out.push(x); }); return out; };

function variants(o) {
  const base = { name: o.name || (o.stage ? '판 ' + o.stage : '기본'), html: o.html || null, stage: o.stage || null, save: o.save || null, rules: o.rules || '', do: o.do || '' };
  const list = [base];
  o.vs.forEach(s => {   // '이름: do=…; rules=…; save=…' — do 안의 여러 수는 '|' 로 잇는다
    const c = s.indexOf(':'); if (c < 0) throw new Error("--vs 는 '이름: do=… ; rules=…' 꼴");
    const v = { ...base, name: s.slice(0, c).trim() };
    s.slice(c + 1).split(';').map(x => x.trim()).filter(Boolean).forEach(kv => {
      const e = kv.indexOf('='), k = kv.slice(0, e).trim(), val = kv.slice(e + 1).trim();
      if (k === 'do') v.do = [base.do, val.split('|').join(';')].filter(Boolean).join(';');
      else if (k === 'rules') v.rules = [base.rules, val].filter(Boolean).join(',');
      else if (k === 'save') v.save = val;
      else if (k === 'stage') v.stage = val || null;
      else if (k === 'html') v.html = val || null;
      else throw new Error('--vs 칸은 do · rules · save · stage · html: ' + k);
    });
    list.push(v);
  });
  return list;
}

function runChild(spec) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--child', JSON.stringify(spec)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => {
      const line = out.split('\n').find(l => l.startsWith('@@RESULT '));
      if (line) resolve(JSON.parse(line.slice(9)));
      else reject(new Error(spec.name + ' 시드' + spec.seed + ' 실패(' + code + '): ' + (out.split('\n').find(l => l.startsWith('@@ERROR ')) || err.trim().split('\n').slice(-3).join(' '))));
    });
  });
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } }));
  return out;
}

const r1 = x => Math.round(x * 10) / 10;
const stat = xs => { const a = xs.filter(x => x != null); if (!a.length) return '—'; const mn = Math.min(...a), mx = Math.max(...a), av = r1(a.reduce((s, x) => s + x, 0) / a.length); return mn === mx ? String(av) : av + ' (' + mn + '–' + mx + ')'; };
const sgn = x => (x > 0 ? '+' : '') + x;

function report(o, vars, res) {
  const L = [], seeds = seedList(o.seeds), show = o.show.split(',');
  L.push(`판 ${o.stage ? '?stage=' + o.stage : o.save || '(빈 땅)'} · ${o.days}일 · 시드 ${seeds.join(',')} · 처음 ${o.warm}틱 돌린 뒤 한 수 · 값은 평균 (최소–최대)`);
  vars.forEach(v => { const extra = [v.stage !== vars[0].stage && 'stage=' + (v.stage || '(없음)'), v.save !== vars[0].save && 'save=' + v.save, v.rules && 'rules=' + v.rules, v.do && 'do=' + v.do].filter(Boolean); if (extra.length) L.push(`- **${v.name}**: ${extra.join(' · ')}`); });
  const mv = res.filter(r => r.moves.length); if (mv.length) { const r = mv[0]; L.push(`- 한 수 결과(시드 ${r.seed} · ${r.name}): ` + r.moves.map(x => `${x.한수} → ${x.됨}개` + (x.자리 ? ' ' + JSON.stringify(x.자리.map(a => a.slice(0, 2))) : '') + (x.까닭 ? ' (' + x.까닭 + ')' : '')).join(' · ')); }
  L.push('');
  const days = Array.from({ length: o.days + 1 }, (_, d) => d);
  L.push('| 판 | 지표 | ' + days.map(d => d ? d + '일 뒤' : '한 수 전').join(' | ') + ' |');
  L.push('|---|---|' + days.map(() => '---').join('|') + '|');
  vars.forEach(v => {
    const rs = res.filter(r => r.name === v.name);
    show.forEach(k => {
      const cells = days.map(d => stat(rs.map(r => { const s = r.samples.filter(x => x.tick <= r.t0 + d * DAY).pop(); return s ? (s.m[k] ?? 0) : null; })));
      L.push(`| ${v.name} | ${k} | ${cells.join(' | ')} |`);
    });
  });
  if (vars.length > 1) {
    const keys = o.watch ? o.watch.split(',') : show;
    L.push('', `### 선택 대비 · 인과 지연 (같은 시드끼리 '${vars[0].name}' 와 비교 · 좋아진 쪽이 +)`);
    L.push(`인과 지연 = 한 수 뒤 '${vars[0].name}' 보다 ${o.by} 이상 좋아져서 끝까지 그대로인 첫 순간(시뮬 시간 · ${o.every}틱=${r1(o.every / DAY * 24)}시간 간격으로 봄)`);
    L.push('', '| 판 | 지표 | 끝 값 차이 | 좋아진 시드 | 인과 지연(시간) | 풀린 시드 |', '|---|---|---|---|---|---|');
    vars.slice(1).forEach(v => keys.forEach(k => {
      const diffs = [], delays = [];
      seeds.forEach(sd => {
        const a = res.find(r => r.name === vars[0].name && r.seed === sd), b = res.find(r => r.name === v.name && r.seed === sd);
        if (!a || !b) return;
        const good = (i) => { const x = (b.samples[i].m[k] ?? 0) - (a.samples[i].m[k] ?? 0); return LOWER(k) ? -x : x; };
        const n = Math.min(a.samples.length, b.samples.length);
        diffs.push(r1(good(n - 1)));
        let first = null; for (let i = n - 1; i >= 1; i--) { if (good(i) >= o.by) first = i; else break; }
        delays.push(first == null ? null : r1((b.samples[first].tick - b.t0) / DAY * 24));
      });
      const ok = delays.filter(x => x != null), better = diffs.filter(x => x >= o.by).length;
      const med = ok.length ? ok.slice().sort((p, q) => p - q)[ok.length >> 1] : null;
      const other = v.save !== vars[0].save || v.stage !== vars[0].stage;
      L.push(`| ${v.name} | ${k} | ${stat(diffs).replace(/^(-?[\d.]+)/, m => sgn(+m))} | ${better}/${diffs.length} | ${other ? '— (다른 판)' : med == null ? '안 풀림' : '중앙 ' + med + (ok.length > 1 ? ' (' + Math.min(...ok) + '–' + Math.max(...ok) + ')' : '')} | ${ok.length}/${delays.length} |`);
    }));
  }
  if (o.voice) {   // [MAC-VOICE] 동네별 바람표 — 끝 날 · 시드 평균 · 줄 차례는 사다리 순(고정)
    const VK = ['물', '장보기', '놀이', '쉼', '배움', '일자리', '붐빔'];
    vars.forEach(v => { const rs = res.filter(r => r.name === v.name && r.voice); if (!rs.length) return;
      const keys = [...new Set(rs.flatMap(r => r.voice.map(e => e.동네)))];
      L.push('', `### 동네 바람표 — ${v.name} (${o.days}일 뒤 · 원하는 집 채 수 · 시드 평균)`, '| 동네 | 집 | 사는 집 | ' + VK.join(' | ') + ' |', '|---|---|---|' + VK.map(() => '---').join('|') + '|');
      keys.forEach(k => { const es = rs.map(r => r.voice.find(e => e.동네 === k)).filter(Boolean), m = f => r1(es.reduce((a, e) => a + f(e), 0) / es.length);
        L.push(`| ${es[0].이름} (${k}) | ${m(e => e.집)} | ${m(e => e.사는집)} | ` + VK.map(b => m(e => e.바람[b] || 0)).join(' | ') + ' |'); });
      const top3 = r => r.voice.flatMap(e => VK.map(b => [e.이름 + '·' + b, e.바람[b] || 0])).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(x => x[0]).sort().join(' / ');
      const t = rs.map(top3), same = t.filter(x => x === t[0]).length;
      L.push(`- 가장 많은 셋(동네·바람): ${t[0] || '—'} — 시드 ${same}/${t.length} 에서 같음`); });
  }
  const tm = res.map(r => r.틱최대ms); L.push('', `틱 최대 ${r1(Math.max(...tm))}ms (node · 가짜 그림 포함 · 브라우저와 다름)`);
  return L.join('\n');
}

const HELP = `마을 시뮬 도구 — scripts/village-sim/README.md 참고
  --html <파일>          다른 index.html 로(전/후 비교 — --vs '옛: html=/tmp/old.html')
  --stage <id>           판 파일 village/stages/<id>.json 으로 연다(시작 땅·규칙·목표)
  --save <저장본 json>   (없으면 빈 땅)          --days N (2)   --seeds 1-5 (1-3)
  --rules 'a.b=v,…'      VRULES 덮기             --do 'put shop @jobs 1; del x y'
  --vs '이름: do=…; rules=…; save=…'  (여러 번) — 같은 시드로 나란히 돌려 비교
  --show 인구,일먼집,…   --watch 일먼집 (비교 표 지표)   --by 1 (좋아짐 문턱)
  --show 까닭            일자리 까닭 넷(none·cut·far·full)을 함께 — 합은 일먼집과 같다
  --voice (끝 날 동네별 바람표 · MAC-VOICE)   --every 150 (틱 · 재는 간격)   --warm 300   --hash 'hour=10'   --jobs 동시 프로세스 수   --json 결과.json`;

/* [MAC-JOBWHY] '까닭' 한 마디로 넷을 다 본다: --show 까닭 · --watch 까닭:cut */
function spreadWhy(s) { return String(s || '').split(',').flatMap(k => k.trim() === '까닭'
  ? ['까닭:none', '까닭:cut', '까닭:far', '까닭:full'] : [k.trim()]).filter(Boolean).join(','); }
const o = parseArgs(process.argv.slice(2));
o.show = spreadWhy(o.show); if (o.watch) o.watch = spreadWhy(o.watch);
if (o.child) {
  child(JSON.parse(o.child)).then(r => { process.stdout.write('@@RESULT ' + JSON.stringify(r) + '\n'); process.exit(0); },
    e => { process.stdout.write('@@ERROR ' + String(e && e.message || e).split('\n')[0] + '\n'); process.exit(1); });
} else if (o.help) console.log(HELP);
else {
  const vars = variants(o), seeds = seedList(o.seeds);
  const specs = []; vars.forEach(v => seeds.forEach(seed => specs.push({ ...v, seed, days: o.days, every: o.every, warm: o.warm, hash: o.hash, voice: !!o.voice })));
  const n = o.jobs || Math.max(1, Math.min(os.cpus().length - 1, 6)), t0 = Date.now();
  let res; try { res = await pool(specs, n, runChild); } catch (e) { console.error(e.message); process.exit(1); }
  console.log(report(o, vars, res));
  console.log(`(판 ${specs.length}개 · 프로세스 ${n}개 · ${r1((Date.now() - t0) / 1000)}초)`);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify({ args: o, variants: vars, results: res }, null, 1));
}
