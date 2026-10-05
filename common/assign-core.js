// 과제 · 수업 규칙과 셈 — 한 파일 [CLASS-ASSIGN-1]
//  학생 화면(student/assign.js) · 관리 화면(admin/assign.js) · TV(assign/) · 하위 앱(common/assign.js) · 노드 시험이 **같은 함수**를 쓴다.
//  클래식 <script> 로도, ES 모듈(import '…/assign-core.js')로도 읽힌다 — 최상위 이름 0 · globalThis.AssignCore 하나만 단다.
//  DOM · firebase 없음(쓰기 모양만 돌려주고 쓰는 것은 부르는 쪽). 누구나 쓸 수 있는 DB 라 받은 값은 모두 믿지 않는다(normDef).
//  설계 = docs/class_assign_design.md
(function (g) {
  'use strict';
  if (g.AssignCore) return;

  const ROOT = 'classRPG_assign';
  const HOST_GRACE_MS = 3 * 60 * 1000;    // 교사 기기(관리 · TV)가 모두 끊긴 뒤 이만큼 지나면 아이 화면이 풀린다
  const STALE_MS = 15 * 60 * 1000;        // 이만큼 비어 있던 수업 = '멈춘 수업' — 교사 기기가 돌아와도 저절로 다시 덮지 않는다(이어 하기를 눌러야)
  const MIN_DEFAULT = 40, MIN_MIN = 10, MIN_MAX = 120;   // 수업 안전 시간(분)
  const ITEMS_MAX = 30, ANS_MAX = 80, TITLE_MAX = 40, STAGES_MAX = 3;
  const KINDS = ['quiz', 'coding', 'music'];
  const TYPES = ['choice', 'number', 'short', 'fraction'];

  // ── 작은 도구 ──
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max) => { const s = v == null ? '' : String(v); return max && s.length > max ? s.slice(0, max) : s; };
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const arr = v => Array.isArray(v) ? v : isObj(v) ? Object.keys(v).sort((a, b) => Number(a) - Number(b)).map(k => v[k]) : [];   // RTDB 가 배열을 객체로 줄 때
  //  RTDB 열쇠에 못 쓰는 글자(. # $ / [ ])가 없고 길이가 알맞은가 — 아이 id · 과제 id · 연결 id
  const safeKey = s => typeof s === 'string' && s.length > 0 && s.length <= 60 && !/[.#$/[\]\u0000-\u001F\u007F]/.test(s);
  //  과제 id 는 더 좁게(글자 · 숫자 · _ · -) — 화면의 onclick 글자 안에 그대로 들어간다
  const safeAid = s => typeof s === 'string' && /^[\w-]{1,40}$/.test(s);
  const qkey = i => 'q' + i;
  const newId = (now, rand) => {
    const r = typeof rand === 'function' ? rand : Math.random;
    let t = '';
    for (let k = 0; k < 3; k++) t += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(r() * 36) % 36];
    return 'a' + Math.floor(num(now, Date.now())).toString(36) + t;
  };

  // ── 문항 ──
  const isOX = it => !!it && it.type === 'choice' && (it.cat === 'ox' || (arr(it.choices).length === 2 && arr(it.choices).every(c => c === 'O' || c === 'X')));
  //  student/study.js problemLang 과 같은 규칙(문항이 정한 말 → 국어 단원은 한국어 → 그 밖 영어)
  const itemLang = it => (it && it.lang) ? String(it.lang) : (it && String(it.unitId || '').startsWith('ko')) ? 'ko-KR' : 'en-US';
  const isEnglish = it => !!it && String(it.unitId || '').startsWith('en');
  const hasHangul = s => /[ᄀ-ᇿ㄰-㆏가-힣]/.test(String(s == null ? '' : s));
  //  아이패드 둥근 따옴표(I’m) → 곧은 따옴표 — 영어 문항 글 답에만
  const fixQuotes = s => String(s == null ? '' : s).replace(/[‘’ʼ′]/g, "'").replace(/[“”]/g, '"');
  //  보기 번호 뒤 조사 — ①(일)을 · ②(이)를 · ③(삼)을 · ④(사)를 · ⑤(오)를 · ⑥(육)을 · ⑦(칠)을 · ⑧(팔)을
  const choiceJosa = ci => [0, 2, 5, 6, 7].includes(ci) ? '을' : '를';
  //  글 · 수 답을 묶어 세는 꼴(CurriculumUtils.isCorrect 의 norm 과 같은 규칙) — 보기형에는 쓰지 않는다(보기 번호로 센다)
  const normAns = v => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, '');

  //  문제 은행 문항 → 과제 사본(보기는 보낼 때 한 번 섞는다 · OX 는 그대로 · 원본은 안 바뀜)
  function snapItem(p, rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    const it = {};
    for (const k of ['id', 'unitId', 'type', 'cat', 'level', 'q', 'a', 'hint', 'audio', 'lang', 'passageId']) if (p && p[k] != null && p[k] !== '') it[k] = p[k];
    if (p && Array.isArray(p.alt) && p.alt.length) it.alt = p.alt.slice();
    if (p && p.fig && isObj(p.fig)) it.fig = JSON.parse(JSON.stringify(p.fig));
    if (p && Array.isArray(p.choices)) {
      const c = p.choices.slice();
      if (!isOX(p)) for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
      it.choices = c;
    }
    return it;
  }

  //  자동 뽑기: 고른 단원에서 고르게 · 지문 세트는 많아야 하나(그 문항은 연달아) · n 이 풀보다 크면 풀 전부
  function pickSet(pool, n, rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    const want = Math.max(1, Math.min(ITEMS_MAX, Math.floor(num(n, 10))));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const list = (pool || []).filter(p => p && p.id);
    const singles = list.filter(p => !p.passageId);
    const sets = {};
    for (const p of list) if (p.passageId) (sets[p.passageId] = sets[p.passageId] || []).push(p);
    const setIds = Object.keys(sets);
    let block = [];
    //  지문 세트 — 풀에서 지문 문항이 차지하는 몫만큼의 확률로 하나(세트가 원하는 수보다 크면 안 넣음)
    if (setIds.length) {
      const share = (list.length - singles.length) / list.length;
      const fits = setIds.filter(id => sets[id].length <= want);
      if (fits.length && (singles.length === 0 || r() < share)) {
        const id = fits[Math.floor(r() * fits.length) % fits.length];
        block = sets[id].slice().sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
      }
    }
    //  단원마다 줄을 세우고 번갈아 하나씩
    const byUnit = {};
    for (const p of shuffle(singles.slice())) (byUnit[p.unitId] = byUnit[p.unitId] || []).push(p);
    const units = shuffle(Object.keys(byUnit));
    const picked = [];
    for (let round = 0; picked.length + block.length < want; round++) {
      let any = false;
      for (const u of units) {
        if (picked.length + block.length >= want) break;
        const p = byUnit[u][round];
        if (p) { picked.push(p); any = true; }
      }
      if (!any) break;
    }
    if (!block.length) return picked;
    const at = Math.floor(r() * (picked.length + 1));
    return [...picked.slice(0, at), ...block, ...picked.slice(at)];
  }

  // ── 정의 모양 검사(믿지 않는 글) ──
  function normItem(p) {
    if (!isObj(p) || !p.id) return null;
    const it = {
      id: str(p.id, 40), unitId: str(p.unitId, 30), type: TYPES.includes(p.type) ? p.type : 'short',
      cat: str(p.cat, 20), level: num(p.level, 1), q: str(p.q, 1000), a: str(p.a, 200), hint: str(p.hint, 400),
    };
    const alt = arr(p.alt).filter(x => x != null).map(x => str(x, 200)).slice(0, 10);
    if (alt.length) it.alt = alt;
    if (it.type === 'choice') {
      const ch = arr(p.choices).filter(x => x != null).map(x => str(x, 300)).slice(0, 8);
      if (ch.length < 2) return null;
      it.choices = ch;
    }
    if (isObj(p.fig)) { try { const s = JSON.stringify(p.fig); if (s.length <= 3000) it.fig = JSON.parse(s); } catch (e) {} }
    if (p.audio) it.audio = str(p.audio, 300);
    if (p.lang) it.lang = str(p.lang, 10);
    if (p.passageId) it.passageId = str(p.passageId, 40);
    return it;
  }
  function normDef(raw, aid) {
    if (!isObj(raw)) return null;
    const id = safeAid(raw.id) ? raw.id : (safeAid(aid) ? aid : '');
    if (!id || (aid && id !== aid)) return null;
    const kind = KINDS.includes(raw.kind) ? raw.kind : null;
    if (!kind) return null;
    const def = {
      id, kind, title: str(raw.title, TITLE_MAX) || '선생님 과제',
      deliver: raw.deliver === 'live' ? 'live' : 'inbox',
      pacing: raw.pacing === 'step' && kind === 'quiz' ? 'step' : 'self',
      showAnswer: raw.showAnswer !== false,
      targets: null, roster: {}, reward: null,
      createdAt: num(raw.createdAt, 0), closedAt: num(raw.closedAt, 0), fromLive: !!raw.fromLive,
      revealed: {}, content: {}, n: 0,
    };
    const t = arr(raw.targets).filter(safeKey).slice(0, 200);
    if (t.length) def.targets = t;
    if (isObj(raw.roster)) for (const k of Object.keys(raw.roster).slice(0, 200)) if (safeKey(k)) def.roster[k] = str(raw.roster[k], 20);
    if (isObj(raw.revealed)) for (const k of Object.keys(raw.revealed)) if (/^q\d{1,2}$/.test(k)) def.revealed[k] = num(raw.revealed[k], 0);
    const c = isObj(raw.content) ? raw.content : {};
    if (kind === 'quiz') {
      const q = isObj(c.quiz) ? c.quiz : {};
      const items = arr(q.items).map(normItem).filter(Boolean).slice(0, ITEMS_MAX);
      if (!items.length) return null;
      const passages = {};
      if (isObj(q.passages)) for (const k of Object.keys(q.passages).slice(0, 10)) {
        const v = q.passages[k];
        if (isObj(v) && safeKey(k)) passages[k] = { id: k, title: str(v.title, 80), text: str(v.text, 5000) };
      }
      const src = isObj(q.src) ? { how: q.src.how === 'auto' ? 'auto' : 'pick', units: arr(q.src.units).map(u => str(u, 30)).slice(0, 40), n: num(q.src.n, items.length), cat: str(q.src.cat, 20) } : { how: 'pick', units: [], n: items.length, cat: '' };
      def.content.quiz = { subject: str(q.subject, 20), items, passages, src };
      def.n = items.length;
    } else if (kind === 'coding') {
      const cd = isObj(c.coding) ? c.coding : {};
      const stages = arr(cd.stages).map(s => str(s, 12)).filter(s => /^[\w-]{1,12}$/.test(s)).slice(0, STAGES_MAX);
      if (!stages.length) return null;
      def.content.coding = { stages };
      def.n = stages.length;
    } else {
      const m = isObj(c.music) ? c.music : {};
      const song = str(m.song, 60);
      if (!/^[\w-]{1,60}$/.test(song)) return null;
      const level = ['easy', 'normal', 'hard', 'expert'].includes(m.level) ? m.level : 'easy';
      def.content.music = { song, level, tempo: num(m.tempo, 1) === 0.8 ? 0.8 : 1, keys: [4, 6, 8].includes(num(m.keys, 0)) ? num(m.keys, 0) : 0 };
      def.n = 1;
    }
    return def;
  }
  const isTarget = (def, sid) => !!def && !!sid && (!def.targets || def.targets.includes(sid));
  //  같은 내용이 이미 열려 있나 견줄 때(관리 화면 '같은 문제 묶음' 경고)
  function contentSig(def) {
    if (!def) return '';
    if (def.kind === 'quiz') return 'quiz:' + def.content.quiz.items.map(i => i.id).join(',');
    if (def.kind === 'coding') return 'coding:' + def.content.coding.stages.join(',');
    const m = def.content.music; return 'music:' + m.song + ':' + m.level + ':' + m.tempo + ':' + m.keys;   // 키 수만 달라도 다른 과제 [ASSIGN-MUSIC-1 · 검토 반영]
  }

  // ── 채점 ──
  //  보기형은 고른 **보기 번호**로 사본 보기 글자를 그대로(===) 견준다 — 공백만 다른 보기(17문항)가 정답으로 섞이지 않게.
  //  글 · 수 · 분수는 deps.isCorrect(CurriculumUtils.isCorrect) · 받아쓰기는 deps.dictation(study.js dictationGrade).
  //  영어 문항 글 답에 한글이 섞이면 채점하지 않고 { blocked:'hangul' } — 한/영 키를 안 바꾼 한 번 실수를 오답으로 세지 않는다.
  function grade(it, input, deps) {
    if (!it) return null;
    const d = deps || {};
    if (it.type === 'choice') {
      const ci = Math.floor(num(input && input.ci, -1));
      const ch = arr(it.choices);
      if (ci < 0 || ci >= ch.length) return null;
      const v = ch[ci];
      return { a: str(v, ANS_MAX), ci, ok: v === it.a || arr(it.alt).includes(v) };
    }
    let v = String(input && input.v != null ? input.v : '').trim();
    if (!v) return null;
    if (isEnglish(it)) {
      v = fixQuotes(v);
      if (hasHangul(v)) return { blocked: 'hangul' };
    }
    let ok = false;
    if (it.cat === 'dictation' && typeof d.dictation === 'function') ok = !!(d.dictation(it, v) || {}).ok;
    else if (typeof d.isCorrect === 'function') ok = !!d.isCorrect(it, v);
    else ok = normAns(v) === normAns(it.a) || arr(it.alt).some(x => normAns(x) === normAns(v));
    return { a: str(v, ANS_MAX), ok };
  }

  // ── 결과 칸 읽기 ──
  const answersOf = cell => (isObj(cell) && isObj(cell.answers)) ? cell.answers : {};
  const ansAt = (cell, i) => { const a = answersOf(cell)[qkey(i)]; return isObj(a) ? a : null; };
  function answeredCount(def, cell) {
    if (!def) return 0;
    let n = 0; for (let i = 0; i < def.n; i++) if (ansAt(cell, i)) n++;
    return n;
  }
  function firstOpen(def, cell) {
    if (!def) return -1;
    for (let i = 0; i < def.n; i++) if (!ansAt(cell, i)) return i;
    return -1;
  }
  //  공개된 뒤에 서버에 닿은 답 = 늦게 냄(분포 · 정답률에서 뺀다 · 교사 표에는 보인다)
  const isLate = (a, revealed, i) => !!a && (!!a.late || (!!revealed && num(revealed[qkey(i)], 0) > 0 && num(a.at, 0) > num(revealed[qkey(i)], 0)));

  // ── 교사 기기 연결(hosts) ──
  //  hosts/<연결> = { on:true, at:서버 시각 } — 끊기면 onDisconnect 가 { on:false, left:서버 시각 } 로 바꾼다(지우지 않는다: 빈 틈을 다시 셀 수 있게).
  //  since(수업 시작 · 이어 하기) 뒤로 교사 기기가 하나도 없던 틈을 센다 — 아이 기기마다 · 새로고침마다 같은 답(서버 시각만 쓴다).
  function hostGaps(hosts, since, now) {
    const iv = [];
    let alive = false;
    if (isObj(hosts)) for (const k of Object.keys(hosts)) {
      const h = hosts[k];
      if (!isObj(h)) continue;
      const at = num(h.at, 0);
      if (h.on === true) alive = true;   // 지금 이어져 있는 교사 기기 — 시계가 조금 어긋나도(at 이 '미래') 살아 있음
      if (!at) continue;
      const end = h.on === true ? Infinity : Math.max(at, num(h.left, at));
      iv.push([at, end]);
    }
    iv.sort((a, b) => a[0] - b[0]);
    let cursor = since, maxGap = 0;
    for (const [s, e] of iv) {
      if (e <= cursor) continue;
      if (s > cursor) { maxGap = Math.max(maxGap, Math.min(s, now) - cursor); }
      cursor = Math.max(cursor, e);
      if (cursor >= now) break;
    }
    //  모두 끊겼으면 빈 틈은 '마지막으로 떠난 때'부터(서버 시각이 이 기기 추정보다 조금 앞서도 0 으로 접지 않고 1ms 로 — 바로 '기다림' 표시)
    const gapNow = alive ? 0 : Math.max(1, now - cursor);
    return { alive, gapNow, maxGap: Math.max(maxGap, alive ? 0 : gapNow) };
  }
  //  안전 끝 — 장난으로 아주 먼 값이 써져도 시작(또는 이어 하기) 뒤 MIN_MAX 분까지만
  function endsAtOf(live) {
    if (!isObj(live)) return 0;
    const base = Math.max(num(live.startedAt, 0), num(live.resumeAt, 0));
    const e = num(live.endsAt, 0);
    if (!base) return e;
    return Math.min(e || base + MIN_DEFAULT * 60000, base + MIN_MAX * 60000);
  }
  //  이 아이 화면에 수업 덮개가 보이나 — 한 함수(학생 · 관리 · TV · 시험)
  //   why: off · noDef · notTarget · excused · expired · stale(멈춘 수업) · hostAway(3분 넘게 교사 기기 없음) · waitHost(덮개 + '기다려 볼게요') · ok
  function liveState(live, def, sid, ctx) {
    const c = ctx || {};
    const now = num(c.now, Date.now());
    if (!isObj(live) || live.on !== true || !safeAid(live.aid)) return { show: false, why: 'off' };
    if (!def || def.id !== live.aid) return { show: false, why: 'noDef' };
    if (sid !== undefined && !isTarget(def, sid)) return { show: false, why: 'notTarget' };
    if (c.excused) return { show: false, why: 'excused' };
    const endsAt = endsAtOf(live);
    if (endsAt && now > endsAt) return { show: false, why: 'expired', endsAt };
    const since = Math.max(num(live.startedAt, 0), num(live.resumeAt, 0)) || now;
    const gp = hostGaps(c.hosts, since, now);
    if (gp.maxGap > (c.stale || STALE_MS)) return { show: false, why: 'stale', endsAt, gapNow: gp.gapNow };
    if (gp.gapNow > (c.grace || HOST_GRACE_MS)) return { show: false, why: 'hostAway', endsAt, gapNow: gp.gapNow };
    if (gp.gapNow > 0) return { show: true, why: 'waitHost', endsAt, gapNow: gp.gapNow };
    return { show: true, why: 'ok', endsAt, gapNow: 0 };
  }

  //  덮개 안에 무엇을 보이나 — view: lobby · ask · sent · reveal · summary · self · done · app
  function liveScreen(live, def, cell) {
    if (!def) return { view: 'lobby', i: -1 };
    if (def.kind !== 'quiz') return { view: 'app', i: -1 };
    const n = def.n;
    if (!isObj(live) || def.pacing !== 'step' || live.pacing === 'self') {
      const i = firstOpen(def, cell);
      if (i < 0) return { view: 'done', i: -1, summary: isObj(live) && live.phase === 'summary' };
      return { view: 'self', i };
    }
    const step = Math.floor(num(live.step, -1)), phase = String(live.phase || '');
    if (step < 0 || phase === 'lobby') return { view: 'lobby', i: -1 };
    if (step >= n || phase === 'summary') return { view: 'summary', i: n };
    if (phase === 'reveal') return { view: 'reveal', i: step };
    return { view: ansAt(cell, step) ? 'sent' : 'ask', i: step };
  }
  //  이 문항에 지금 답을 낼 수 있나 — mode 'inbox'(과제함) · 'live'(수업 덮개)
  function canAnswer(mode, live, def, cell, i) {
    if (!def || def.kind !== 'quiz' || !(i >= 0 && i < def.n) || ansAt(cell, i)) return false;
    if (mode !== 'live') return true;
    if (!isObj(live) || live.on !== true || live.aid !== def.id) return false;
    if (def.pacing !== 'step') return true;
    return Math.floor(num(live.step, -1)) === i && live.phase === 'answer';
  }
  //  답 하나 → 루트(classRPG_assign) 다중 경로 update 모양. 결과 칸 · 내 숙달도 칸 아래 경로만(통째 set 0 · 남의 칸 0).
  //   res = { a, ci?, ok, skip? } · opt = { TS(서버 시각 자리), date('2026-10-06'), late? }
  function answerPatch(def, sid, cell, i, res, opt) {
    const o = opt || {};
    if (!def || !safeKey(sid) || !isObj(res) || !(i >= 0 && i < def.n) || ansAt(cell, i)) return null;
    const TS = o.TS === undefined ? { '.sv': 'timestamp' } : o.TS;
    const base = `results/${def.id}/${sid}`;
    const a = { a: str(res.a, ANS_MAX), ok: !!res.ok && !res.skip, at: TS };
    if (res.ci != null && res.ci >= 0) a.ci = Math.floor(num(res.ci, 0));
    if (res.skip) a.skip = true;
    if (o.late) a.late = true;
    const up = { [`${base}/answers/${qkey(i)}`]: a };
    if (!isObj(cell) || !cell.startedAt) up[`${base}/startedAt`] = TS;
    if (answeredCount(def, cell) + 1 >= def.n && !(isObj(cell) && cell.doneAt)) up[`${base}/doneAt`] = TS;
    const it = def.content.quiz && def.content.quiz.items[i];
    if (!res.skip && it) {
      up[`mine/${sid}/${def.id}/s`] = str(def.content.quiz.subject, 20);
      up[`mine/${sid}/${def.id}/q/${qkey(i)}`] = { p: it.id, u: it.unitId, c: !!res.ok, d: str(o.date, 10) };
    }
    return up;
  }

  //  하위 앱(기초 코딩 · 음악실) 결과 → 결과 칸 아래 경로만. patch = { start, done, score, total, attempt, detail: { <열쇠>: { rank, … } } }
  //   점수는 늘 때만 · detail 은 열쇠마다 따로 쓰고 이미 있는 값보다 rank 가 클 때만(더 좋은 기록만 — 탭 둘 · 늦게 온 값이 좋은 기록을 안 덮게)
  //   쓰는 곳은 학생 화면 하나(iframe 이 postMessage 로 넘긴다) — iframe 이 닫혀도 결과가 남는다
  function appPatch(def, sid, cell, patch, opt) {
    const o = opt || {};
    if (!def || def.kind === 'quiz' || !safeKey(sid) || !isObj(patch)) return null;
    const TS = o.TS === undefined ? { '.sv': 'timestamp' } : o.TS;
    const INC = typeof o.INC === 'function' ? o.INC : (n => ({ '.sv': { increment: n } }));
    const base = `results/${def.id}/${sid}`, c = isObj(cell) ? cell : {}, app = isObj(c.app) ? c.app : {};
    const up = {};
    if ((patch.start || patch.attempt || patch.done) && !c.startedAt) up[base + '/startedAt'] = TS;
    if (patch.done && !c.doneAt) up[base + '/doneAt'] = TS;
    const sc = Number(patch.score), tt = Number(patch.total);
    if (patch.score != null && Number.isFinite(sc) && sc > num(app.score, -1)) up[base + '/app/score'] = Math.max(0, Math.min(100000, sc));
    if (patch.total != null && Number.isFinite(tt) && tt !== num(app.total, -1)) up[base + '/app/total'] = Math.max(0, Math.min(100000, tt));
    if (patch.attempt) up[base + '/app/attempts'] = INC(1);
    if (isObj(patch.detail)) {
      const old = isObj(app.detail) ? app.detail : {};
      for (const k of Object.keys(patch.detail).slice(0, 10)) {
        const v = patch.detail[k];
        if (!/^[\w-]{1,30}$/.test(k) || !isObj(v)) continue;
        let s = ''; try { s = JSON.stringify(v); } catch (e) { continue; }
        if (s.length > 1000) continue;
        const prev = old[k];
        if (isObj(prev) && num(prev.rank, -Infinity) >= num(v.rank, -Infinity)) continue;
        up[base + '/app/detail/' + k] = JSON.parse(s);
      }
    }
    return Object.keys(up).length ? up : null;
  }

  // ── 교사 쪽 진행(transaction 함수: cur → 다음 값 | undefined = 그만) ──
  //  '지금 그 단계일 때만' 바꾼다 — 관리 화면과 TV 가 같은 순간 눌러도 한 칸만.
  const bump = cur => num(cur && cur.rev, 0) + 1;
  const ctl = {
    start(def, o, now) {
      return cur => {
        if (isObj(cur) && cur.on === true) return undefined;
        const step = def.pacing === 'step';
        const minutes = Math.max(MIN_MIN, Math.min(MIN_MAX, Math.floor(num(o && o.minutes, MIN_DEFAULT))));
        return { on: true, aid: def.id, kind: def.kind, pacing: def.pacing, step: step ? -1 : 0, phase: step ? 'lobby' : 'run',
          names: false, startedAt: now, resumeAt: now, endsAt: now + minutes * 60000, rev: bump(cur) };
      };
    },
    //  aid 가 없으면 무엇이든 끈다(장난 쓰기 · 정의 없는 수업도 늘 끝낼 수 있게)
    end(aid, now) {
      return cur => {
        if (!isObj(cur) || cur.on !== true) return undefined;
        if (aid && cur.aid !== aid) return undefined;
        return { ...cur, on: false, endedAt: now, rev: bump(cur) };
      };
    },
    next(aid, step, phase, n, now) {
      return cur => {
        if (!same(cur, aid, step, phase)) return undefined;
        const rv = isObj(cur.revealAt) ? cur.revealAt : {};
        if (cur.pacing !== 'step') return undefined;
        if (step >= n - 1) return { ...cur, step: n, phase: 'summary', rev: bump(cur) };
        const s = Math.max(0, step + 1);
        return { ...cur, step: s, phase: rv[qkey(s)] ? 'reveal' : 'answer', rev: bump(cur) };
      };
    },
    prev(aid, step, phase) {
      return cur => {
        if (!same(cur, aid, step, phase) || cur.pacing !== 'step' || step <= 0) return undefined;
        const rv = isObj(cur.revealAt) ? cur.revealAt : {};
        const s = Math.min(step, Math.floor(num(cur.step, 0))) - 1;
        return { ...cur, step: s, phase: rv[qkey(s)] ? 'reveal' : 'answer', rev: bump(cur) };
      };
    },
    reveal(aid, step, now) {
      return cur => {
        if (!same(cur, aid, step, 'answer') || cur.pacing !== 'step') return undefined;
        const rv = { ...(isObj(cur.revealAt) ? cur.revealAt : {}) };
        if (!rv[qkey(step)]) rv[qkey(step)] = now;
        return { ...cur, phase: 'reveal', revealAt: rv, rev: bump(cur) };
      };
    },
    //  각자 풀기: run → summary · 한 문제씩: 어디서든 → 정리(step n)
    summary(aid, step, phase, n) {
      return cur => {
        if (!same(cur, aid, step, phase)) return undefined;
        if (cur.pacing === 'step') return { ...cur, step: n, phase: 'summary', rev: bump(cur) };
        return { ...cur, phase: 'summary', rev: bump(cur) };
      };
    },
    //  정리 화면에서 문항 하나 다시 보기(공개된 문항이면 공개 화면 · 아니면 묻기)
    goto(aid, step, phase, i) {
      return cur => {
        if (!same(cur, aid, step, phase) || cur.pacing !== 'step') return undefined;
        const rv = isObj(cur.revealAt) ? cur.revealAt : {};
        return { ...cur, step: i, phase: rv[qkey(i)] ? 'reveal' : 'answer', rev: bump(cur) };
      };
    },
    resume(aid, now) {
      return cur => {
        if (!isObj(cur) || cur.on !== true || cur.aid !== aid) return undefined;
        const base = Math.max(num(cur.startedAt, 0), now);
        return { ...cur, resumeAt: now, endsAt: Math.max(num(cur.endsAt, 0), Math.min(now + 20 * 60000, base + MIN_MAX * 60000)), rev: bump(cur) };
      };
    },
    extend(aid, minutes, now) {
      return cur => {
        if (!isObj(cur) || cur.on !== true || cur.aid !== aid) return undefined;
        const from = Math.max(endsAtOf(cur), now);
        return { ...cur, endsAt: from + Math.max(1, Math.floor(num(minutes, 10))) * 60000, rev: bump(cur) };
      };
    },
  };
  function same(cur, aid, step, phase) {
    return isObj(cur) && cur.on === true && cur.aid === aid && Math.floor(num(cur.step, -1)) === step && String(cur.phase || '') === phase;
  }

  // ── 셈(관리 · TV · 시험이 같은 함수) ──
  //  아이 한 명 — 상태는 답에서 끌어낸다(낸 문항 수 == 문항 수 → 끝). doneAt · startedAt 은 보조.
  function summarize(def, cell, opt) {
    const o = opt || {};
    const revealed = o.revealed || (def && def.revealed) || null;
    const out = { status: 'none', answered: 0, correct: 0, total: def ? def.n : 0, ms: null, late: 0, skip: 0, items: [] };
    if (!def) return out;
    if (def.kind !== 'quiz') {
      const app = isObj(cell) && isObj(cell.app) ? cell.app : {};
      out.correct = Math.max(0, num(app.score, 0));
      out.total = Math.max(0, num(app.total, def.kind === 'music' ? 100 : def.n));
      out.attempts = Math.max(0, num(app.attempts, 0));
      out.detail = isObj(app.detail) ? app.detail : {};
      out.status = (isObj(cell) && cell.doneAt) ? 'done' : (out.attempts > 0 || (isObj(cell) && cell.startedAt)) ? 'doing' : 'none';
      if (out.status === 'done' && isObj(cell) && cell.startedAt) out.ms = Math.max(0, num(cell.doneAt, 0) - num(cell.startedAt, 0));
      return out;
    }
    let minAt = Infinity, maxAt = 0;
    for (let i = 0; i < def.n; i++) {
      const a = ansAt(cell, i);
      if (!a) { out.items.push(null); continue; }
      const late = isLate(a, revealed, i);
      out.items.push({ a: str(a.a, ANS_MAX), ci: a.ci != null ? Math.floor(num(a.ci, -1)) : null, ok: !!a.ok, skip: !!a.skip, late, at: num(a.at, 0) });
      out.answered++;
      if (a.ok) out.correct++;
      if (late) out.late++;
      if (a.skip) out.skip++;
      const at = num(a.at, 0);
      if (at) { minAt = Math.min(minAt, at); maxAt = Math.max(maxAt, at); }
    }
    out.status = out.answered >= def.n ? 'done' : (out.answered > 0 || (isObj(cell) && cell.startedAt)) ? 'doing' : 'none';
    //  걸린 시간 = 처음 연 때(없으면 첫 답) ~ 마지막 답 — 서버 시각
    const st0 = num(isObj(cell) && cell.startedAt, 0);
    if (out.status === 'done' && maxAt) out.ms = Math.max(0, maxAt - (st0 && st0 <= minAt ? st0 : minAt));
    return out;
  }
  //  문항 하나 — 보기별 수 · 맞힌 비율(낸 아이 중 · 늦게 낸 답과 건너뛴 것은 빼고) · 가장 많이 고른 오답(2명 이상)
  function itemStats(def, results, i, sids, opt) {
    const o = opt || {};
    const revealed = o.revealed || (def && def.revealed) || null;
    const it = def && def.content.quiz ? def.content.quiz.items[i] : null;
    const out = { i, n: 0, ok: 0, rate: null, late: 0, skip: 0, dist: [], other: 0, wrongTop: [], topWrong: null, okText: [] };
    if (!it) return out;
    const R = isObj(results) ? results : {};
    const choice = it.type === 'choice';
    if (choice) out.dist = arr(it.choices).map((v, ci) => ({ ci, v, c: 0, ok: v === it.a || arr(it.alt).includes(v) }));
    const wrong = new Map(), okMap = new Map();
    for (const sid of (sids || Object.keys(R))) {
      const a = ansAt(R[sid], i);
      if (!a) continue;
      if (a.skip) { out.skip++; continue; }
      if (isLate(a, revealed, i)) { out.late++; continue; }
      out.n++;
      if (a.ok) out.ok++;
      if (choice) {
        const ci = a.ci != null ? Math.floor(num(a.ci, -1)) : arr(it.choices).indexOf(a.a);
        if (ci >= 0 && ci < out.dist.length) out.dist[ci].c++; else out.other++;
      } else {
        const k = normAns(a.a);
        const m = a.ok ? okMap : wrong;
        const e = m.get(k) || { v: str(a.a, ANS_MAX), c: 0 };
        e.c++; m.set(k, e);
      }
    }
    out.rate = out.n >= 3 ? Math.round(out.ok / out.n * 100) : null;
    if (choice) {
      const w = out.dist.filter(d => !d.ok && d.c >= 2).sort((a, b) => b.c - a.c || a.ci - b.ci)[0];
      out.topWrong = w ? { ci: w.ci, v: w.v, c: w.c } : null;
    } else {
      out.wrongTop = [...wrong.values()].sort((a, b) => b.c - a.c).slice(0, 3);
      out.okText = [...okMap.values()].sort((a, b) => b.c - a.c).slice(0, 3);
      const w = out.wrongTop[0];
      out.topWrong = w && w.c >= 2 ? { v: w.v, c: w.c } : null;
    }
    return out;
  }
  //  반 전체 — 명단(받는 아이) 차례 그대로(점수 차례로 줄 세우지 않는다) · 명단 밖 결과는 따로
  function tally(def, results, roster, opt) {
    const o = opt || {};
    const R = isObj(results) ? results : {};
    const list = (roster || []).filter(x => x && safeKey(x.sid) && isTarget(def, x.sid));
    const excused = o.excused || {};
    const rows = list.map(x => ({ sid: x.sid, name: x.name || '', excused: !!excused[x.sid], ...summarize(def, R[x.sid], o) }));
    const known = new Set(list.map(x => x.sid));
    const outside = Object.keys(R).filter(sid => !known.has(sid) && safeKey(sid)).map(sid => ({ sid, name: (def && def.roster[sid]) || '', outside: true, ...summarize(def, R[sid], o) }));
    const counts = { none: 0, doing: 0, done: 0, excused: 0 };
    for (const r of rows) counts[r.excused && r.status !== 'done' ? 'excused' : r.status]++;
    const sids = list.map(x => x.sid);
    const items = def && def.kind === 'quiz' ? def.content.quiz.items.map((_, i) => itemStats(def, R, i, sids, o)) : [];
    const doneRows = rows.filter(r => r.status === 'done');
    const avg = doneRows.length ? Math.round(doneRows.reduce((s, r) => s + (r.total ? r.correct / r.total : 0), 0) / doneRows.length * 100) : null;
    let hardest = -1, low = 101;
    for (const s of items) if (s.rate != null && s.rate < low) { low = s.rate; hardest = s.i; }
    return { rows, outside, counts, items, avg, hardest };
  }

  // ── 숙달도 — 아이 칸 mine/<sid>/<aid> = { s 과목, q: { q3: { p 문항 id, u 단원, c 맞음, d 날짜 } } } ──
  //  오늘의 학습 기록(problemRecords)과 같은 모양의 기록으로 바꾼다. 과제 하나 · 날짜 하나마다 한 건.
  //  id = prob_<날짜>_<sid>_asg_<aid> — 기존 키 차례(prob_<날짜>_…) 안에 들어가 '최근 기록 8건'이 날짜 순서를 지킨다.
  function masteryRecords(mineVal, sid) {
    const out = [];
    if (!isObj(mineVal) || !safeKey(sid)) return out;
    for (const aid of Object.keys(mineVal).sort()) {
      const e = mineVal[aid];
      if (!isObj(e) || !isObj(e.q) || !safeAid(aid)) continue;
      const byDate = {};
      for (const k of Object.keys(e.q).sort((a, b) => num(a.slice(1), 0) - num(b.slice(1), 0))) {
        const x = e.q[k];
        if (!isObj(x) || !x.p) continue;
        const d = /^\d{4}-\d{2}-\d{2}$/.test(String(x.d || '')) ? String(x.d) : '';
        if (!d) continue;
        (byDate[d] = byDate[d] || []).push({ problemId: str(x.p, 40), unitId: str(x.u, 30), correct: !!x.c });
      }
      for (const d of Object.keys(byDate).sort()) {
        const answers = byDate[d];
        const cnt = {};
        for (const a of answers) cnt[a.unitId] = (cnt[a.unitId] || 0) + 1;
        const unitId = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
        out.push({ id: `prob_${d}_${sid}_asg_${aid}`, studentId: sid, date: d, subjectKey: str(e.s, 20), unitId,
          total: answers.length, correct: answers.filter(a => a.correct).length,
          wrongIds: answers.filter(a => !a.correct).map(a => a.problemId), answers, review: false, assign: aid });
      }
    }
    return out.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  const path = {
    live: 'live', hosts: 'hosts', host: c => 'hosts/' + c, open: aid => 'open/' + aid, archive: aid => 'archive/' + aid,
    result: (aid, sid) => `results/${aid}/${sid}`, results: aid => 'results/' + aid, mine: sid => 'mine/' + sid,
    presence: (aid, sid, c) => `presence/${aid}/${sid}${c ? '/' + c : ''}`, presenceAll: aid => 'presence/' + aid,
    excused: (aid, sid) => `excused/${aid}${sid ? '/' + sid : ''}`,
    full: p => ROOT + '/' + p,
  };

  g.AssignCore = Object.freeze({
    ROOT, HOST_GRACE_MS, STALE_MS, MIN_DEFAULT, MIN_MIN, MIN_MAX, ITEMS_MAX, ANS_MAX, TITLE_MAX, STAGES_MAX, KINDS,
    path, safeKey, safeAid, qkey, newId, isOX, itemLang, isEnglish, hasHangul, fixQuotes, normAns, choiceJosa,
    snapItem, pickSet, normItem, normDef, isTarget, contentSig, grade,
    answersOf, ansAt, answeredCount, firstOpen, isLate,
    hostGaps, endsAtOf, liveState, liveScreen, canAnswer, answerPatch, appPatch, ctl,
    summarize, itemStats, tally, masteryRecords,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
