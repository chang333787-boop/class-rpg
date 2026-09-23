// 첫 30초 탐지기 — run.mjs --first30 이 쓴다 (docs/village_first_screen.md · 보스 09-23 "어설픈 것들을 다 찾아서 고치는 방법").
// 원본 마을(저장본)을 여러 시각에 열어 **300틱(1× 30초 = 시뮬 4시간)** 을 돌리며 잰다.
//   ① 사는 모습 셋 · ② 어수선 — 10틱마다 30번(연기 훅 읽기) · ③ 연기의 어설픔 — **틱마다** 사람 자리(__folkPos)로.
// 판정·저장 0. index.html 은 읽기 훅(__folkPos · 없으면 ③은 '못 잰다')만 쓴다.

const TICKS = 300, EVERY = 10;
/* 기준값 — docs/village_first_screen.md 1절 표(pop88 · 8→12시)에서. 셋 다 '그 판에서 보통 보이는 만큼'의 아래쪽으로 잡았다 */
export const F30_PASS = {
  머무는사람: { 최소: 5, 표본: 15 },   // (곁에 서 있음 + 앉음 + 광장) ≥ 5 가 30표본 중 15번 이상 — 8시 실측 평균 24
  놀이터아이: { 최소: 1, 표본: 15 },   // 밖에 있는 아이 ≥ 1 이 15번 이상 — 8시 실측 30/30
  문밖일꾼: { 최소: 1, 표본: 5 },      // 문 밖 일꾼 ≥ 1 이 5번 이상 — 8시 실측 11/30 (9시부터라 8시 전에 열면 드물다)
  멈칫평균: 0.5,                       // 붐빔 멈칫 평균 ≤ 0.5 — pop88 은 낮 내내 3(원본은 길 폭이 인구에 맞아야 한다)
};
/* 부위 안에 서도 되는 곳 — 사람이 들어가 머무는 자리(놀이터·정자·광장·벤치). 부위 안인가는 index.html 의 __folkPos 가 몸 높이 부위 상자로 가린다 */
const PASS_OK = new Set(['play', 'pavilion', 'plaza', 'bench', 'minibench', 'green', 'fountain', 'garden']);

const has = (w, h) => typeof w[h] === 'function';
const safe = (f, d) => { try { return f(); } catch { return d; } };

/* 자식 한 판 — w 는 load.mjs 로 연 마을 */
export function first30Child(w, spec) {
  w.__tickBench(60);                              // 연 직후 한 번 자리 잡기(이사·길찾기 시작)
  w.__setHour(spec.first30); w.__tickBench(3);
  const flowOn = safe(() => w.__flow().켜짐, false);
  const S = { 머무는사람: [], 놀이터아이: [], 문밖일꾼: [], 멈칫: [], 기다리는집: [], 일칩: [], 떠나는풍선: [], 빈선반: [], 밖: [] };
  const greet0 = safe(() => w.__greet().인사함, 0);
  const sample = () => {
    const b = safe(() => w.__beside(), {}), pl = safe(() => w.__plaza(), {}), k = safe(() => w.__kids(), {}), wl = safe(() => w.__workLook(), {});
    S.머무는사람.push((b.지금곁에 | 0) + (b.지금앉음 | 0) + (pl.지금광장위 | 0));
    S.놀이터아이.push(k.지금밖에 | 0); S.문밖일꾼.push(wl.지금문밖일꾼 | 0);
    S.멈칫.push(safe(() => w.__crowdLook().지금멈칫, 0) | 0);
    S.기다리는집.push(safe(() => w.__waitHomes().수, 0) | 0);   /* 화면 칩 '🏠 이웃을 기다리는 집 n' 과 같은 셈(waitHomesScan) */
    S.일칩.push(safe(() => w.__jobsOn().칩수, 0) | 0);           /* 화면 칩 '💼 일할 곳…' 의 수 */
    S.떠나는풍선.push(safe(() => w.__leave().지금풍선, 0) | 0);
    S.빈선반.push(flowOn ? safe(() => w.__flow().가게.filter(s => s.상태 === 'empty').length, 0) : 0);
    S.밖.push(safe(() => w.__rhythm().밖, 0) | 0);
  };
  /* ③ 어설픔 — 틱마다 */
  const canPos = has(w, '__folkPos');
  const A = { 겹침합: 0, 겹침최대: 0, 통과: 0, 통과곳: {}, 통과예: [], 떨림: 0, 순간이동: 0, 상태바뀌며튐: 0, 튐예: [], 틱: 0 };
  const prev = new Map(), trail = new Map();
  const stepPos = () => {
    const P = w.__folkPos(), vis = P.filter(p => p[3]);
    let pairs = 0;                                                  // 겹침: 보이는 두 사람이 0.6 안(사람 폭 약 0.55)
    for (let a = 0; a < vis.length; a++) for (let c = a + 1; c < vis.length; c++) {
      const dx = vis[a][1] - vis[c][1], dz = vis[a][2] - vis[c][2]; if (dx * dx + dz * dz < 0.36) pairs++; }
    A.겹침합 += pairs; A.겹침최대 = Math.max(A.겹침최대, pairs); A.틱++;
    vis.forEach(p => { if (p[6] && !PASS_OK.has(p[5]) && (p[7] === '' || p[7] === 'carry')) {   /* 곁 자리(우물가·가게 앞·일꾼)는 일부러 세운 자리라 뺀다 — 걷거나 서성이는 사람만 */ A.통과++; A.통과곳[p[5] + ':' + p[4]] = (A.통과곳[p[5] + ':' + p[4]] || 0) + 1;
      if (A.통과예.length < 3 && !A.통과예.some(e => e.id === p[0])) A.통과예.push({ id: p[0], 칸: [Math.round(p[1] / 4 + 127.5), Math.round(p[2] / 4 + 127.5)], 종류: p[5], 상태: p[4] }); } });
    const seen = new Set();
    P.forEach(p => { const id = p[0]; seen.add(id); const q = prev.get(id);
      if (q && q[3] && p[3]) { const d = Math.hypot(p[1] - q[1], p[2] - q[2]);
        if (d > 2.0) { if (q[4] === p[4] && q[7] === p[7]) { A.순간이동++; if (A.튐예.length < 4) A.튐예.push(`${q[4]}${q[7] ? '·' + q[7] : ''} ${d.toFixed(1)}`); } else A.상태바뀌며튐++; } }
      /* 떨림: 보이는 채로 10틱 동안 걸은 길이 ≥ 1.2 인데 제자리(≤ 0.3) — 겹치지 않게 창을 끊어 센다 */
      let t = trail.get(id); if (!p[3]) { trail.delete(id); prev.set(id, p); return; }
      if (!t) { t = { x0: p[1], z0: p[2], len: 0, n: 0, lx: p[1], lz: p[2] }; trail.set(id, t); }
      t.len += Math.hypot(p[1] - t.lx, p[2] - t.lz); t.lx = p[1]; t.lz = p[2]; t.n++;
      if (t.n >= 10) { if (t.len >= 1.2 && Math.hypot(p[1] - t.x0, p[2] - t.z0) <= 0.3) A.떨림++; trail.set(id, { x0: p[1], z0: p[2], len: 0, n: 0, lx: p[1], lz: p[2] }); }
      prev.set(id, p); });
    [...prev.keys()].forEach(id => { if (!seen.has(id)) { prev.delete(id); trail.delete(id); } });
  };
  for (let t = 0; t < TICKS; t++) { w.__tickBench(1); if (canPos) stepPos(); if ((t + 1) % EVERY === 0) sample(); }
  const 인사 = safe(() => w.__greet().인사함, 0) - greet0;
  return { name: spec.name, seed: spec.seed, 시작: spec.first30, 끝시: +safe(() => w.__sim().시, 0).toFixed(1), 흐름: flowOn, S, A: canPos ? A : null, 인사 };
}

/* 부모 — 시각마다 시드를 합쳐 표 + PASS/FAIL */
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const r1 = x => Math.round(x * 10) / 10;
export function first30Report(o, res) {
  const hours = [...new Set(res.map(r => r.시작))];
  const by = h => res.filter(r => r.시작 === h);
  const col = (h, f) => f(by(h));
  const seen = (xs, min) => xs.filter(x => x >= min).length;
  const L = [];
  L.push(`첫 30초 — ${o.stage ? '?stage=' + o.stage : ''}${o.save ? ' ' + o.save : ''} · 시드 ${[...new Set(res.map(r => r.seed))].join(',')} · 300틱(1× 30초 = 시뮬 4시간) · 10틱마다 30표본(①②) · 틱마다(③)`);
  L.push('값 = 평균 / 가장 많을 때 / 보인 표본(30 중) · 시드가 여럿이면 시드 평균', '');
  L.push('| 칸 | ' + hours.map(h => `${h}시 → ${col(h, rs => r1(avg(rs.map(r => r.끝시))))}시`).join(' | ') + ' |');
  L.push('|---|' + hours.map(() => '---').join('|') + '|');
  const row = (label, key, min) => L.push(`| ${label} | ` + hours.map(h => col(h, rs => {
    const a = r1(avg(rs.map(r => avg(r.S[key])))), m = Math.max(...rs.map(r => Math.max(...r.S[key]))), s = r1(avg(rs.map(r => seen(r.S[key], min))));
    return `${a}/${m}/${s}`; })).join(' | ') + ' |');
  L.push('| **① 사는 모습** | ' + hours.map(() => '').join(' | ') + ' |');
  row('머무는 사람(곁·앉음·광장)', '머무는사람', F30_PASS.머무는사람.최소);
  row('놀이터 아이(밖에 있는 아이)', '놀이터아이', 1);
  row('문 밖 일꾼', '문밖일꾼', 1);
  row('밖에 있는 사람', '밖', 1);
  L.push('| **② 어수선** | ' + hours.map(() => '').join(' | ') + ' |');
  row('걱정 칩 🏠 이웃을 기다리는 집', '기다리는집', 1);
  row('걱정 칩 💼 일할 곳', '일칩', 1);
  row('붐빔 멈칫', '멈칫', 1);
  row('떠나는 풍선', '떠나는풍선', 1);
  row('빈 선반(흐름 판만)', '빈선반', 1);
  L.push('| **③ 연기의 어설픔** (틱마다 · 사람 자리) | ' + hours.map(() => '').join(' | ') + ' |');
  const arow = (label, f) => L.push(`| ${label} | ` + hours.map(h => col(h, rs => rs.some(r => !r.A) ? '못 잰다(__folkPos 없음)' : f(rs))).join(' | ') + ' |');
  arow('겹쳐 지나감(0.6 안 · 틱당 쌍 평균/최대 · **셈 자리** — 화면에서는 ACT-PASS·ACT-SPACE 가 벌린다 · 기준은 화면판)', rs => `${r1(avg(rs.map(r => r.A.겹침합 / Math.max(1, r.A.틱))))}/${Math.max(...rs.map(r => r.A.겹침최대))}`);
  arow('건물·나무 통과(사람·틱)', rs => { const n = r1(avg(rs.map(r => r.A.통과))), where = {}; rs.forEach(r => Object.entries(r.A.통과곳).forEach(([k, v]) => { where[k] = (where[k] || 0) + v; }));
    const top = Object.entries(where).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(' · '); return n + (top ? ' (' + top + ')' : ''); });
  arow('제자리 떨림(10틱 창)', rs => String(r1(avg(rs.map(r => r.A.떨림)))));
  arow('순간이동(한 틱에 2.0 넘게 · 같은 상태)', rs => { const n = r1(avg(rs.map(r => r.A.순간이동))), ex = rs.flatMap(r => r.A.튐예).slice(0, 2).join(' · '); return n + (ex ? ' (' + ex + ')' : ''); });
  arow('└ 상태가 바뀌며 튐(문 안↔곁 자리 등)', rs => String(r1(avg(rs.map(r => r.A.상태바뀌며튐)))));
  L.push(`| 이웃 인사(30초 동안 한 번) | ` + hours.map(h => col(h, rs => String(r1(avg(rs.map(r => r.인사)))))).join(' | ') + ' |');
  L.push(`| 비켜섬 · 우물가 수다 · 반딧불 | ` + hours.map(() => '못 잰다(그리는 쪽에서 정해진다 — 실화면으로)').join(' | ') + ' |');
  /* PASS / FAIL */
  L.push('', '### 판정 (시각마다 · 시드 전부가 통과해야 PASS)');
  const P = F30_PASS;
  hours.forEach(h => {
    const rs = by(h), ok = (f) => rs.every(f), mark = b => b ? 'PASS' : 'FAIL';
    const 사는 = [
      ['머무는 무리', ok(r => seen(r.S.머무는사람, P.머무는사람.최소) >= P.머무는사람.표본)],
      ['놀이터 아이', ok(r => seen(r.S.놀이터아이, P.놀이터아이.최소) >= P.놀이터아이.표본)],
      ['문 밖 일꾼', ok(r => seen(r.S.문밖일꾼, P.문밖일꾼.최소) >= P.문밖일꾼.표본)]];
    const 어수 = [
      ['걱정 칩 0', ok(r => Math.max(...r.S.기다리는집) === 0 && Math.max(...r.S.일칩) === 0)],
      ['떠나는 풍선 0', ok(r => Math.max(...r.S.떠나는풍선) === 0)],
      [`멈칫 평균 ≤ ${P.멈칫평균}`, ok(r => avg(r.S.멈칫) <= P.멈칫평균)],
      ['빈 선반 0', ok(r => Math.max(...r.S.빈선반) === 0)]];
    const 어설 = rs.some(r => !r.A) ? [] : [
      ['건물·나무 통과 0', ok(r => r.A.통과 === 0)],
      ['순간이동 0', ok(r => r.A.순간이동 === 0)]];
    const all = [...사는, ...어수, ...어설];
    L.push(`- **${h}시 ${mark(all.every(x => x[1]))}** — 사는 모습: ${사는.map(x => x[0] + ' ' + mark(x[1])).join(' · ')} / 어수선: ${어수.map(x => x[0] + ' ' + mark(x[1])).join(' · ')}`
      + (어설.length ? ` / 어설픔: ${어설.map(x => x[0] + ' ' + mark(x[1])).join(' · ')}` : ' / 어설픔: 못 잰다'));
  });
  L.push('', '겹침·떨림은 기준값을 아직 안 정했다(표에만) — 원본 시안 둘셋을 재 본 뒤 정한다. 자리는 **시뮬 좌표**다(브라우저는 틱 사이를 보간하고 몸짓을 더한다).');
  return L.join('\n');
}
