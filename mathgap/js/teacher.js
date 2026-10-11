// 선생님 화면(#/t) — ① 단원 하나 정하기 ② 아이들은 RPG 홈 카드에서 하루 10분 ③ 반 전체 탑 · 수업 추천 · 아이별
//  쓰기는 config(단원 · 하루 시간)와 아이 한 명 '다시 살펴보기' · '선생님과 함께 표시 지우기'뿐. 이름은 반 명단(common/roster.js)에서.
import { h, modal, toast } from './util.js';
import { UNITS, byId, lessonsOfUnit, unitLabel, lessonLabel, corePre, allPre, sortByGrade } from './core/lessons/index.js';
import { towerOf, dayKey, bugsOf, compareLogs, litAfterDark, TYPES, typesOfUnit, isType, typeName, exampleOf } from './today.js';
import { toText } from './core/tokens.js';
import { P as josaK } from './core/concepts/kit.js';
// 이름 뒤 조사 — 괄호는 앞말의 보충이라 괄호 앞말에 맞춤
const kj = (n, a, b) => josaK(String(n).replace(/\s*\([^)]*\)\s*$/, ''), a, b);
// 도전 층 까닭 — 같이 풀기에서 처음 막힌 곳(today.js typeHelpDone)
const DIAG = { read: '이야기 읽기', struct: '상황(구조) 파악', tpl: '문제 모양(식 세우기)', dom: '분수 · 소수가 되면 흔들림(쉬운 숫자로는 풂)', calc: '계산에서 막힘', plan: '단계를 나눠 주면 풂' };
import { towerEl, miniEl, unitName } from './tower.js';
import { teacherGate } from '../../common/teacher-gate.js';
import { rosterFor } from '../../common/roster.js';

export async function mountTeacher(app, ctx) {
  const { store } = ctx;
  app.replaceChildren(h('div', { class: 'empty' }, '선생님 화면을 여는 중…'));
  if (!(await teacherGate(ctx, 'mathgap.teacher'))) { app.replaceChildren(h('div', { class: 'empty' }, '선생님 비밀번호가 필요해요. 다시 열어 주세요.')); return; }
  let cfg = await store.config(), all = {}, roster = [];
  let unit = cfg.unit || '4-2-1';
  const load = async () => {
    const lim = (p, ms, d) => Promise.race([p, new Promise((r) => setTimeout(() => r(d), ms))]);
    [all, roster] = await Promise.all([lim(store.all(), 8000, {}), lim(rosterFor(store), 6000, [])]);
  };
  await load();
  const nameOf = (sid) => (roster.find((r) => r.sid === sid) || {}).name || (store.me.guest ? '이 기기' : `이름 없음 (${sid})`);
  const units = UNITS.filter((u) => lessonsOfUnit(u.id).length >= 2);

  function draw() {
    const ids = lessonsOfUnit(unit), today = dayKey();
    const sids = [...new Set([...roster.map((r) => r.sid), ...Object.keys(all)])].filter((s) => s !== 'teacher');
    const rows = sids.map((sid) => {
      const rec = all[sid], kid = rec && rec.kid;
      const tw = kid ? towerOf(unit, kid) : null;
      const d = kid && kid.days[today];
      return { sid, name: nameOf(sid), kid, tw, today: d && d.ms > 0 ? d : null };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const scanned = rows.filter((r) => r.tw && r.tw.scanned);
    // 층마다 불 켠 아이 수 · 기초 층(옛 단원)은 그 층을 가진 아이 기준
    const floorStat = ids.map((c, i) => {
      const lit = scanned.filter((r) => r.tw.floors[i].st === 'lit').length, tc = scanned.filter((r) => r.tw.floors[i].st === 'teacher').length;
      return { c, no: i + 1, name: byId[c].kid, lit, of: scanned.length, dark: scanned.length - lit, tc };
    });
    const baseMap = {};
    scanned.forEach((r) => r.tw.base.forEach((f) => { const b = baseMap[f.c] = baseMap[f.c] || { c: f.c, name: f.name, have: 0, lit: 0 }; b.have++; if (f.st === 'lit') b.lit++; }));
    const bases = Object.values(baseMap).sort((a, b) => (b.have - b.lit) - (a.have - a.lit));
    const hotN = Math.max(3, Math.ceil(scanned.length * 0.25));
    const hot = floorStat.filter((f) => f.dark >= hotN).sort((a, b) => b.dark - a.dark);
    const hotBase = bases.filter((b) => b.have - b.lit >= hotN);
    const todayN = rows.filter((r) => r.today).length;
    const grown = scanned.reduce((a, r) => a + litAfterDark(r.kid, unit), 0);   // 살펴볼 때 꺼져 있다가 연습으로 켠 층(반 전체)
    // 도전 층 — 열린 아이(아래층을 다 켬) 중 켠 아이 · 같이 풀기에서 처음 막힌 곳(아이 수)
    const topStat = typesOfUnit(unit).map((t, i) => {
      const at = (r) => r.tw.tops.find((x) => x.t === t);
      const open = scanned.filter((r) => { const f = at(r); return f && f.st !== 'lock' && f.st !== 'q'; });
      const lit = open.filter((r) => at(r).st === 'lit').length, tc = open.filter((r) => at(r).st === 'teacher').length;
      const dg = { read: 0, struct: 0, tpl: 0, dom: 0, calc: 0, plan: 0 };
      scanned.forEach((r) => { const d = ((r.kid.types || {})[t] || {}).diag || {}; for (const k of Object.keys(dg)) if (d[k]) dg[k]++; });
      return { c: `T:${t}`, t, no: i + 1, name: TYPES[t].name, lit, of: open.length, tc, dark: open.length - lit, dg };
    });
    const early = (x) => x.dg.read + x.dg.struct + x.dg.tpl + x.dg.dom;   // 식을 세우기 전에 막힌 아이 수
    const hotTop = topStat.filter((x) => early(x) >= 2).sort((a, b) => early(b) - early(a))[0] || null;

    const unitSel = h('select', { 'aria-label': '지금 배우는 단원', onchange: (e) => { unit = e.target.value; draw(); } },
      ...['1', '2', '3', '4', '5', '6'].map((g) => h('optgroup', { label: `${g}학년` }, ...units.filter((u) => u.g[0] === g).map((u) => h('option', { value: u.id, selected: u.id === unit }, `${u.g} ${u.nm}`)))));
    const minSel = h('select', { 'aria-label': '하루 시간' }, ...[5, 10, 15, 20].map((m) => h('option', { value: m, selected: m === cfg.minutes }, `하루 ${m}분`)));
    const isCur = cfg.unit === unit;
    const saveBtn = h('button', { class: 'btn primary small', style: { marginTop: '8px' }, onclick: async () => {
      cfg = { unit, minutes: +minSel.value, name: unitLabel(unit) };   // name = RPG 홈 카드가 '○○ 탑'이라고 쓰는 단원 이름
      try { await store.setConfig(cfg); toast('저장했어요 — 아이들 카드가 이 단원 탑으로 바뀌어요'); } catch (e) { console.warn(e); toast('저장하지 못했어요 — 인터넷을 확인해 주세요'); }
      draw();
    } }, isCur ? '하루 시간 바꾸기' : '이 단원으로 열기');

    const frow = (f, { base = false } = {}) => {
      const lit = base ? f.lit : f.lit, of = base ? f.have : f.of, isHot = base ? f.have - f.lit >= hotN : f.dark >= hotN;
      return h('div', { class: 'frow' + (isHot ? ' hot' : '') },
        h('span', { class: 'nm', title: base ? lessonLabel(f.c) : byId[f.c].title }, h('b', {}, base ? '기초' : `${f.no}층`), f.name,
          h('i', { style: { fontStyle: 'normal', color: '#a8977d', fontSize: '12px', marginLeft: '6px' } }, base ? `${byId[f.c].u.slice(0, 3)} · ${byId[f.c].span}차시` : `${byId[f.c].span}차시`)),
        h('span', { class: 'bar' }, h('i', { style: { width: of ? `${Math.round(100 * lit / of)}%` : '0' } })),
        h('span', { class: 'ct' }, of ? `${lit} / ${of}${!base && f.tc ? ` · 선생님과 ${f.tc}` : ''}` : '—'));
    };
    const recText = hot.length || hotBase.length
      ? [...hotBase.map((b) => `기초 '${b.name}'(${lessonLabel(b.c, { title: false })})에서 ${b.have - b.lit}명`), ...hot.map((f) => `${f.no}층 '${f.name}'에서 ${f.dark}명`)].join(' · ') + '이 불이 꺼져 있어요 — 반 전체로 한 번 더 다뤄 보세요.'
      : scanned.length ? '여러 명이 한꺼번에 막힌 층은 없어요. 한두 명은 아이가 연습으로 채워요.' : '아이들이 살펴보기를 하면 여기에 층마다 불 켠 아이 수가 보여요.';
    const firstHot = hotBase[0] ? hotBase[0].c : hot[0] ? hot[0].c : null;
    const topRec = hotTop ? [h('span', { style: { display: 'block', marginTop: '8px', color: '#d2c6f0' } }, h('b', { style: { color: '#c9b6ff' } }, `도전 층 '${hotTop.name}'`),
      ` — 식을 세우기 전에 막힌 아이 ${early(hotTop)}명: ${[['read', '이야기 읽기'], ['struct', '상황 파악'], ['tpl', '문제 모양'], ['dom', '분수 · 소수가 되면 흔들림']].filter(([k]) => hotTop.dg[k]).map(([k, n]) => `${n} ${hotTop.dg[k]}`).join(' · ')}.`,
      hotTop.dg.read + hotTop.dg.struct >= Math.max(1, Math.ceil(early(hotTop) / 2)) ? ' 이야기를 다시 말하게 하거나(누가 더 많은지 · 무엇이 바뀌었는지), 같은 상황을 다른 말로 바꿔 보는 활동부터 권해요.' : ''),
      h('span', { style: { display: 'block', marginTop: '4px', color: '#d9c9ae' } }, `가르치는 법 — ${TYPES[hotTop.t].tip}`)] : null;
    // 그 차시에서 반 아이들이 가장 많이 낸 틀린 모양(아이 수로) — Eedi 의 오개념 보고처럼
    const topBug = (c) => { const m = {}; scanned.forEach((r) => bugsOf(r.kid).filter((b) => b.c === c).forEach((b) => { m[b.name] = (m[b.name] || 0) + 1; })); const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 2 ? `자주 나온 실수 — ${e[0]} (${e[1]}명)` : null; };
    const hotBug = firstHot ? topBug(firstHot) : null;

    const statusOf = (r) => {
      if (!r.tw || !r.tw.scanned) return r.kid && r.kid.run && r.kid.run.unit === unit ? ['살펴보는 중', 'gold'] : ['안 살펴봄', 'idle'];
      if (r.tw.lit === r.tw.total) return r.tw.topLit < r.tw.tops.length ? (r.tw.topWaiting ? [`선생님과 ${r.tw.topWaiting}`, 'blue'] : ['도전 층', 'gold']) : ['완성', 'gold2'];
      if (r.tw.waiting) return [`선생님과 ${r.tw.waiting}`, 'blue'];
      return r.today ? ['오늘 함', 'green'] : ['아직', 'idle'];
    };
    const codeOf = (tw) => tw.all.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : 0)).join('');
    const topsOf = (tw) => tw.tops.map((f) => (f.st === 'lit' ? 1 : f.st === 'q' ? 9 : f.st === 'teacher' ? 2 : f.st === 'lock' ? 8 : 0)).join('');
    const trow = (x) => h('div', { class: 'frow' + (hotTop && hotTop.t === x.t ? ' hot' : '') },
      h('span', { class: 'nm', title: TYPES[x.t].idea }, h('b', { style: { color: '#c9b6ff' } }, '도전'), x.name,
        h('i', { style: { fontStyle: 'normal', color: '#a8977d', fontSize: '12px', marginLeft: '6px' } }, '문제집 유형')),
      h('span', { class: 'bar' }, h('i', { style: { width: x.of ? `${Math.round(100 * x.lit / x.of)}%` : '0', background: '#ffc766' } })),
      h('span', { class: 'ct' }, x.of ? `${x.lit} / ${x.of}${x.tc ? ` · 선생님과 ${x.tc}` : ''}` : '아직 열린 아이 없음'));

    app.replaceChildren(
      h('header', { class: 'top' }, h('h1', { class: 'jua', style: { color: '#f2a93b', fontSize: '1.5rem' } }, '오늘의 수학'), h('span', { class: 'muted' }, '선생님 화면'), h('span', { class: 'sp' }),
        h('button', { class: 'btn small', onclick: async () => { await load(); draw(); toast('새로 불러왔어요'); } }, '새로 고침')),
      h('div', { class: 'tv' },
        h('div', { class: 'tsteps' },
          h('div', { class: 'tstep on' }, h('span', { class: 'n' }, '1'), h('div', { style: { flex: '1', minWidth: '0' } }, h('b', {}, '단원 하나 정하기'),
            unitSel, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, minSel, saveBtn),
            h('p', { style: { marginTop: '6px' } }, isCur ? `지금 아이들에게 열린 탑이에요 · 하루 ${cfg.minutes}분` : cfg.unit ? `지금 열린 탑: ${unitLabel(cfg.unit)} — 이 단원으로 바꾸려면 '이 단원으로 열기'` : '아직 열린 탑이 없어요 — 단원을 고르고 \'이 단원으로 열기\''))),
          h('div', { class: 'tstep' }, h('span', { class: 'n' }, '2'), h('div', {}, h('b', {}, '아이들은 알아서 하루 10분'),
            h('p', {}, "RPG 홈의 '오늘의 수학' 카드 → 첫날은 탑 살펴보기(문제를 풀며 단원 점검), 다음 날부터 불 꺼진 층을 아래부터 연습. 탑을 다 켜면 꼭대기 위 '도전 층'(그 단원 숫자로 낸 문제집 유형)이 열려요. 보상은 없어요."))),
          h('div', { class: 'tstep' }, h('span', { class: 'n' }, '3'), h('div', {}, h('b', {}, '아래에서 반 전체를 봐요'),
            h('p', {}, '여러 명이 불 꺼진 층은 수업에서 다시, 한두 명은 아이가 연습으로 채워요. 이름을 누르면 그 아이의 탑과 처음 막힌 차시를 봐요.')))),
        h('div', { class: 'tgrid' },
          h('div', { class: 'tbox' },
            h('h3', {}, `우리 반 탑 · ${unitName(unit)}`, h('small', {}, `층마다 불을 켠 아이 수 · ${rows.length}명 중 살펴본 아이 ${scanned.length}명${grown ? ` · 꺼져 있다가 켠 층 ${grown}개` : ''}`)),
            h('div', { style: { display: 'flex', flexDirection: 'column-reverse', marginTop: '10px' } },
              ...bases.slice(0, 4).map((b) => frow(b, { base: true })),
              bases.length ? h('div', { style: { height: '6px', borderRadius: '3px', background: '#5a4733', margin: '4px 0' } }) : null,
              ...floorStat.map((f) => frow(f)),
              topStat.length ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', color: '#b9a6ee', fontFamily: 'Jua, sans-serif', fontSize: '14px', margin: '8px 0 2px' } },
                h('span', { style: { flex: '1', borderTop: '2px dashed #6a5a8f' } }), '도전 층 — 아래층을 다 켠 아이에게 열려요', h('span', { style: { flex: '1', borderTop: '2px dashed #6a5a8f' } })) : null,
              ...topStat.map((x) => trow(x))),
            h('div', { class: 'rec' }, h('b', {}, '수업 추천'), h('span', {}, recText, hotBug ? h('span', { style: { display: 'block', marginTop: '6px', color: '#f3e8d6' } }, hotBug) : null, firstHot && byId[firstHot].tip ? h('span', { style: { display: 'block', marginTop: '6px', color: '#d9c9ae' } }, `가르치는 법 — ${byId[firstHot].tip}`) : null, topRec))),
          h('div', { class: 'tbox' },
            h('h3', {}, '아이별', h('small', {}, `오늘 한 아이 ${todayN}명`)),
            h('div', { style: { marginTop: '8px' } }, ...rows.map((r) => {
              const [label, tone] = statusOf(r);
              return h('button', { class: 'krow', onclick: () => r.kid ? detail(r) : toast('아직 오늘의 수학을 열지 않았어요') },
                h('span', { class: 'nm' }, r.name), r.tw ? miniEl(codeOf(r.tw), topsOf(r.tw)) : null,
                h('span', { class: 'stt ' + tone }, label));
            }), rows.length ? null : h('p', { class: 'muted small', style: { marginTop: '10px' } }, '반 명단을 못 읽었거나 아직 연 아이가 없어요.'))))));
  }

  // 도전 층(문제 유형) — 이 단원 유형마다 상태 · 같이 풀기에서 처음 막힌 곳 · 다른 단원에서 켠 유형
  function typeBox(kid, tw) {
    const T = kid.types || {};
    if (!tw.tops.length && !Object.keys(T).length) return null;
    const st = { lit: '켬', dark: '아직', teacher: '선생님과', lock: '잠김(아래층을 다 켜면)', q: '안 살펴봄' };
    const dg = (t) => { const d = (T[t] || {}).diag || {}; const xs = Object.keys(DIAG).filter((k) => d[k]).map((k) => `${DIAG[k]} ${d[k]}`); return xs.length ? ` — 처음 막힌 곳: ${xs.join(' · ')}` : ''; };
    const here = new Set(tw.tops.map((f) => f.t));
    const other = Object.keys(T).filter((t) => TYPES[t] && !here.has(t) && Object.keys(T[t].lit || {}).length);
    return h('div', { class: 'root' }, h('b', { style: { color: '#c9b6ff' } }, '도전 층(문제집 유형)'),
      ...tw.tops.map((f) => [h('br'), `${f.name} · ${st[f.st] || f.st}${dg(f.t)}`]),
      other.length ? [h('br'), h('span', { class: 'muted' }, `다른 단원에서 켠 유형: ${other.map((t) => `${TYPES[t].name}(${Object.keys(T[t].lit).map(unitLabel).join(', ')})`).join(' · ')}`)] : null);
  }

  // 그날 켠 층 — 차시 층 · 도전 층을 나눠서
  const litText = (lit) => { const t = lit.filter((c) => isType(c)).length, f = lit.length - t; return `${f ? ` · ${f}층 켬` : ''}${t ? ` · 도전 층 ${t}개 켬` : ''}`; };

  // 가정에 보낼 글(10-11 · 교사 '학부모는 교육과정 연결을 몰라 확인하기 어렵다') — 이 아이 탑에서 쉬운 말로 · 화면에서만 만들고 저장하지 않음
  //  교육과정 연결 = 막힌 차시가 기대는 앞 차시(corePre) 중 앞 단원 것 · 집에서 할 일 = 기초 층 예제 한 문제 · 문장제는 처음 막힌 곳에 맞춰
  const gl = (c) => { const L = byId[c]; return L ? `${unitLabel(L.u).replace(/^(\d)-(\d)/, '$1학년 $2학기')} '${L.kid}'` : c; };
  // 교육과정 연결 — 다리가 있으면 그 '예전에 배운 것', 없으면 앞 차시 줄에서 다른 단원의 가장 가까운 것
  const linkOf = (c) => {
    let ex = null; try { ex = exampleOf(c, 7); } catch (e) { /* */ }
    if (ex && ex.bridge) return ex.bridge.old.c;
    const other = (xs) => xs.filter((x) => byId[x] && byId[x].u !== byId[c].u);
    const a = other(corePre(c)); if (a.length) return sortByGrade(a).slice(-1)[0];
    const b = other(allPre(c)); return b.length ? sortByGrade(b).slice(-1)[0] : null;
  };
  function parentText(name, kid, tw) {
    const lines = [`[오늘의 수학 · ${unitLabel(unit).replace(/^(\d)-(\d)/, '$1학년 $2학기')}] ${name}`];
    if (!tw.scanned) return [...lines, '아직 이 단원 탑을 살펴보지 않았어요. 학교에서 하루 10분씩 이어서 해요.'].join('\n');
    lines.push(`· 이 단원 ${tw.floors.length}층 중 ${tw.floors.filter((f) => f.st === 'lit').length}층에 불을 켰어요(잘하는 차시).${tw.tops.length ? ` 문제집 유형 도전 층은 ${tw.tops.length}개 중 ${tw.topLit}개를 켰어요.` : ''}`);
    const dark = tw.all.filter((f) => f.st !== 'lit');
    if (dark.length) {
      lines.push('· 아직 연습 중인 곳(교과서 차시와 그 바탕):');
      for (const f of dark.slice(0, 4)) {
        const L = byId[f.c], here = L.u === unit;
        lines.push(`  - ${here ? `'${L.kid}'(${L.span || L.n}차시)` : `예전에 배운 ${gl(f.c)}`}${linkOf(f.c) ? ` — 이 내용은 ${gl(linkOf(f.c))}에 기대요` : ''}`);
      }
    } else lines.push('· 이 단원 차시는 모두 불이 켜졌어요.');
    const T = kid.types || {}, sum = { read: 0, struct: 0, tpl: 0, dom: 0, calc: 0, plan: 0 };
    for (const t of Object.keys(T)) for (const k of Object.keys(sum)) sum[k] += (T[t].diag || {})[k] || 0;
    const top = Object.entries(sum).sort((a, b) => b[1] - a[1])[0];
    const home = [];
    const firstBase = tw.base.find((f) => f.st !== 'lit'), firstDark = tw.floors.find((f) => f.st !== 'lit');
    if (!firstBase && firstDark) { let ex = null; try { ex = exampleOf(firstDark.c, 7); } catch (e) { /* */ } if (ex && ex.bridge) home.push(`'${byId[firstDark.c].kid}'${kj(byId[firstDark.c].kid, '은', '는')} 예전에 배운 '${byId[ex.bridge.old.c].kid}'${kj(byId[ex.bridge.old.c].kid, '과', '와')} 같은 생각이에요. ${ex.bridge.same} 집에 있는 물건으로 먼저 해 보고 분수로 바꿔 보세요.`); }
    if (firstBase) { let ex = null; try { ex = exampleOf(firstBase.c, 7); } catch (e) { /* */ } home.push(`예전에 배운 ${gl(firstBase.c)}부터 다시 다지면 좋아요.${ex ? ` 예: ${toText(ex.item.prompt).replace(/□/g, '(  )')}` : ''}`); }
    if (top && top[1] >= 2) {
      lines.push(`· 문장제(문제집 유형)에서 처음 막힌 곳: ${{ read: '이야기 읽기', struct: '상황(구조) 파악', tpl: '식 세우기(유형)', dom: '분수 · 소수가 되면 흔들림', calc: '계산', plan: '혼자 단계 나누기' }[top[0]]}`);
      home.push({ read: '문제를 소리 내어 끝까지 읽고, 수마다 무엇을 말하는지 짚어 보게 해 주세요.', struct: '문제를 자기 말로 다시 말해 보게 해 주세요 — 누가 더 많은지, 무엇이 바뀌었는지.', tpl: '식을 세우기 전에 그림(막대)으로 상황을 그려 보게 해 주세요.', dom: '같은 문제를 작은 자연수로 바꿔 먼저 풀고, 다시 분수 · 소수로 풀어 보게 해 주세요.', calc: '식은 잘 세우니 계산을 천천히 확인하는 습관을 칭찬해 주세요.', plan: "'먼저 무엇을 구할까?'를 물어 단계를 나누게 해 주세요." }[top[0]]);
    }
    if (!home.length) home.push('학교에서 하루 10분씩 꾸준히 하고 있어요. 오늘 켠 층을 물어봐 주세요.');
    lines.push('· 집에서 도와주실 수 있는 것:', ...home.map((x) => `  - ${x}`));
    return lines.join('\n');
  }

  function parentBox(name, kid, tw) {
    const ta = h('textarea', { id: 'mg-parent-text', rows: '9', readonly: true, style: { width: '100%', background: '#1c1610', color: 'var(--ink)', border: '1px solid #3d3024', borderRadius: '10px', padding: '10px', font: 'inherit', fontSize: '13px', lineHeight: '1.6' } });
    ta.value = parentText(name, kid, tw);
    const copy = h('button', { class: 'btn small', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); toast('복사했어요 — 알림장 · 문자에 붙여 넣으세요'); } catch (e) { ta.select(); toast('글을 골랐어요 — Ctrl+C 로 복사하세요'); } } }, '복사');
    return h('div', { class: 'root' }, h('b', {}, '가정에 보낼 글'), ' ', h('span', { class: 'muted' }, '(이 화면에서만 만들어요 · 저장하지 않아요)'), ta, h('div', { style: { marginTop: '6px' } }, copy));
  }

  function detail(r) {
    const kid = r.kid, tw = towerOf(unit, kid);
    const sc = kid.scans[unit];
    const dark = tw.all.filter((f) => f.st !== 'lit');
    const days = Object.keys(kid.days).sort().slice(-7);
    const body = h('div', { style: { display: 'flex', gap: '18px', flexWrap: 'wrap' } },
      h('div', { style: { flex: '0 0 300px', maxWidth: '100%' } }, tw.scanned ? towerEl(tw, { order: true, small: true }) : h('p', {}, '이 단원은 아직 살펴보지 않았어요.')),
      h('div', { class: 'roots', style: { flex: '1', minWidth: '240px' } },
        sc ? h('p', {}, `살펴보기 ${new Date(sc.t).toLocaleDateString('ko-KR')} · ${sc.n}문제`) : null,
        ...dark.map((f) => h('div', { class: 'root' }, h('b', {}, `${f.base ? '기초' : f.no + '층'} ${f.name}`), f.st === 'teacher' ? ' — 선생님과 함께(연습 12문제 안에 못 켬)' : '',
          h('br'), h('span', { class: 'muted' }, lessonLabel(f.c)), byId[f.c].tip ? [h('br'), `가르치는 법 — ${byId[f.c].tip}`] : null, byId[f.c].bridge ? [h('br'), `다리 — ${byId[f.c].bridge}`] : null)),
        bugsOf(kid).length ? h('div', { class: 'root' }, h('b', {}, '자주 나온 실수'), ...bugsOf(kid).slice(0, 5).map((b) => [h('br'), `${b.name} ×${b.n} `, h('span', { class: 'muted' }, `· ${isType(b.c) ? `도전 층 ${typeName(b.c)}` : lessonLabel(b.c, { title: false })}`)])) : null,
        typeBox(kid, tw),
        h('div', { class: 'root cmp-box' }, h('b', {}, '처음과 지금'), h('br'), h('span', { class: 'muted' }, '문항 기록을 불러오는 중…')),
        parentBox(r.name, kid, tw),
        days.length ? h('p', { class: 'muted' }, '최근: ', days.map((d) => `${d.slice(5)} ${kid.days[d].ms < 60000 ? '1분 안' : Math.round(kid.days[d].ms / 60000) + '분'}${litText(kid.days[d].lit)}`).join(' / ')) : null));
    const close = modal(r.name, body, [
      { label: '이 단원 다시 살펴보기', onclick: async (close) => { if (!confirm(`${r.name}의 ${unitName(unit)} 탑을 처음부터 다시 살펴보게 할까요? (배운 기록은 남아요)`)) return; await store.resetKid(r.sid, unit); close(); await load(); draw(); toast('다음에 열면 탑 살펴보기부터 해요'); } },
      tw.waiting ? { label: "'선생님과' 표시 지우기", onclick: async (close) => { await store.clearMarks(r.sid); close(); await load(); draw(); toast('그 층들을 다시 연습할 수 있어요'); } } : null,
      { label: '닫기', primary: true },
    ].filter(Boolean), { wide: true });
    // 처음과 지금 — 같은 차시를 처음 몇 문제와 최근 몇 문제로 견준다(정답률 · 맞힌 문제의 가운데 시간)
    const box = body.querySelector('.cmp-box');
    const fmt = (x) => `${x.acc}%${x.med ? ` · ${x.med}초` : ''}`;
    Promise.resolve(store.logs ? store.logs(r.sid) : []).then((lines) => {
      const ids = tw.all.map((f) => f.c), cmp = compareLogs(lines, ids);
      const list = tw.all.filter((f) => cmp[f.c]).map((f) => { const x = cmp[f.c]; return [h('br'), h('b', { style: { color: '#f3e8d6' } }, `${f.base ? '기초' : f.no + '층'} ${f.name}`), ` — 처음 ${x.first.n}문제 ${fmt(x.first)} → 최근 ${x.last.n}문제 ${fmt(x.last)}`]; });
      box.replaceChildren(h('b', {}, '처음과 지금'), ...(list.length ? list.flat() : [h('br'), h('span', { class: 'muted' }, '아직 견줄 만큼 푼 차시가 없어요(한 차시에 4문제 넘게 풀면 보여요).')]));
    }).catch(() => box.replaceChildren(h('b', {}, '처음과 지금'), h('br'), h('span', { class: 'muted' }, '기록을 불러오지 못했어요.')));
    void close;
  }

  draw();
}

