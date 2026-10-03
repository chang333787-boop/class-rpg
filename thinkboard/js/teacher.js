// 선생님 화면: 판 만들기 · 모든 판 보기 · Claude에게 보내기 / AI 카드 넣기 · 발판 설정 · 기록 · 판 틀
import { h, toast, modal, copyText } from './util.js';
import { newBoard, ops, stats, SRC } from './model.js';
import { BUILTIN } from './templates.js';
import { boardToText, promptFor, parseMail, boardOutline } from './export.js';
import { settingsForm, withDefaults, LAYOUTS } from './settings.js';
import { icon } from './icons.js';
import { studentRows, cardRows, logRows, toCSV, people } from './research.js';

export function mountTeacher(root, { store, home, roster = [] }) {
  let tpls = BUILTIN, timer = 0;
  const apply = async (b, name, args) => store.patch(b.id, ops[name](b, { by: 'teacher', ...args }).patch);

  async function load() {
    tpls = [...BUILTIN, ...(await store.templates())];
    // 최근에 만든 것 위로, 같이 만든 모둠 판끼리는 1·2·3모둠 순서
    const boards = (await store.list()).sort((a, z) => Math.floor(z.created / 60000) - Math.floor(a.created / 60000) || a.title.localeCompare(z.title, 'ko', { numeric: true }));
    render(boards);
    store.reconcileIndex?.(boards);   // [THINKBOARD-HOME-1] 아이 홈 카드 목록을 판 목록과 맞춘다(다를 때만 씀)
  }
  const stopWatch = store.watchAll(() => { clearTimeout(timer); timer = setTimeout(load, 150); });

  let pickTpl = null;   // 새 판 만들기에서 고른 틀
  //  [THINKBOARD-PREVIEW-1] 새 판 만들기 칸은 한 번만 만든다 — 아이들이 카드를 쓸 때마다 목록이 다시 그려져도 미리보기 창이 깜빡이거나 처음으로 돌아가지 않게
  //  (틀 목록이 바뀔 때만 새로)
  let shell = null;
  function render(boards) {
    const keepOpen = root.querySelector('details.tpl')?.open;
    const key = tpls.map(t => t.id).join(',');
    const head = h('header', { class: 't-head' }, h('button', { class: 'ibtn', onclick: home, title: '처음으로' }, icon('home')),
      h('h1', {}, '생각판'), h('span', { class: 'pill' }, '선생님'),
      store.kind === 'local' ? h('span', { class: 'sub' }, '로컬 시험 — 이 브라우저 안에만 저장돼요') : null,
      h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: () => research(boards) }, icon('download', 16), '연구 자료 내보내기'));
    if (!shell || shell.key !== key || !root.contains(shell.wrap)) {
      root.innerHTML = '';
      shell = { key, head, form: newForm(), list: h('div', {}), tpl: h('div', {}) };
      shell.wrap = h('div', { class: 't-wrap' }, shell.head, shell.form, shell.list, shell.tpl);
      root.append(shell.wrap);
    } else { shell.wrap.replaceChild(head, shell.head); shell.head = head; }
    shell.list.replaceChildren(h('h2', { class: 't-h2' }, '만든 판', h('span', { class: 'sub' }, boards.length ? ` ${boards.length}개` : '')),
      h('div', { class: 't-list' }, boards.length ? boards.map(row) : h('div', { class: 'fl-empty' }, '아직 판이 없어요. 위에서 틀을 골라 만들어 보세요.')));
    shell.tpl.replaceChildren(tplSection(keepOpen));
  }

  // 틀 한 줄 설명 — 판 모양 · 칸
  const tplDesc = t => { const st = withDefaults({ ...(t.settings || {}) }); return [LAYOUTS[st.layout]?.replace(/\(.*\)/, ''), (t.zones || []).join(' · ')].filter(Boolean).join(' — '); };

  function newForm() {
    pickTpl = pickTpl && tpls.some(t => t.id === pickTpl) ? pickTpl : tpls[0]?.id;
    const title = h('input', { placeholder: '판 이름 (비우면 틀 이름)' });
    const n = h('select', {}, [1, 2, 3, 4, 5, 6, 7, 8].map(i => h('option', { value: i }, i === 1 ? '판 1개' : `모둠 판 ${i}개`)));
    const HUES = ['#eef3ff', '#fff4e3', '#eaf7ef', '#fdeef3', '#f2eefd', '#eef6f7'];
    const tiles = h('div', { class: 't-tiles' }, tpls.map((t, ti) => h('button', {
      class: 't-tile' + (t.id === pickTpl ? ' on' : ''), type: 'button',
      onclick: e => { pickTpl = t.id; tiles.querySelectorAll('.t-tile').forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); showPreview(); } },
      h('span', { class: 'ti', style: { background: HUES[ti % HUES.length] } }, t.icon || '📋'), h('span', { class: 'tn' }, t.name), h('span', { class: 'td' }, tplDesc(t)))));
    //  [THINKBOARD-PREVIEW-1] 미리보기 — 고른 틀을 예시 카드로 · 아이 화면 그대로(작게) · 눌러 볼 수 있음(저장 안 됨)
    const VW = 1100, VH = 640;   // 크롬북 화면 크기쯤(작게 줄여도 글이 덜 작게)
    const frame = h('iframe', { class: 't-prev-frame', title: '판 미리보기', loading: 'lazy' });
    const box = h('div', { class: 't-prev-box' }, frame);
    const cap = h('div', { class: 't-prev-cap' });
    const fit = () => { const k = Math.min(1, (box.clientWidth || 520) / VW); frame.style.transform = `scale(${k})`; box.style.height = Math.round(VH * k) + 'px'; };
    const srcOf = t => `index.html?preview=${encodeURIComponent(t.id)}`;
    function showPreview() {
      const t = tpls.find(x => x.id === pickTpl);
      if (!t) return;
      if (!BUILTIN.includes(t)) { try { sessionStorage.setItem('tb.previewTpl', JSON.stringify(t)); } catch {} }
      frame.src = srcOf(t) + '&v=' + Date.now().toString(36);   // 같은 틀을 다시 골라도 처음 모습으로
      const st = withDefaults(t.settings || {});
      cap.replaceChildren(h('b', {}, `${t.icon || '📋'} ${t.name}`), h('span', { class: 'sub' }, ` — ${LAYOUTS[st.layout] || ''}`),
        h('span', { class: 'grow' }), h('button', { class: 'btn small', type: 'button', onclick: () => window.open(srcOf(t), '_blank', 'noopener') }, icon('fit', 14), '크게 보기'));
    }
    const prev = h('aside', { class: 't-prev' }, cap, box, h('p', { class: 'help' }, '아이들은 이렇게 봐요 — 예시 카드예요. 눌러서 만져 볼 수 있지만 저장되지 않아요.'));
    new ResizeObserver(fit).observe(box);
    requestAnimationFrame(() => { fit(); showPreview(); });
    const create = async () => {
      const tpl = tpls.find(t => t.id === pickTpl);
      if (!tpl) return toast('틀을 골라 주세요');
      const name = title.value.trim() || tpl.name;
      const k = +n.value;
      for (let i = 1; i <= k; i++) await store.create(newBoard({ title: k > 1 ? `${name} · ${i}모둠` : name, template: tpl }));
      toast(`판 ${k}개를 만들었어요`); title.value = '';
    };
    return h('section', { class: 't-new' }, h('h2', { class: 't-h2' }, '새 판 만들기'),
      h('div', { class: 't-new-grid' }, h('div', {}, tiles, h('div', { class: 't-new-row' }, title, n, h('button', { class: 'btn primary', onclick: create }, icon('plus', 16), '만들기'))), prev));
  }

  // 작은 메뉴(⋯)
  function menu(btn, items) {
    document.querySelector('.t-menu')?.remove();
    const r = btn.getBoundingClientRect();
    const m = h('div', { class: 't-menu', style: { top: r.bottom + 6 + 'px', right: Math.max(8, innerWidth - r.right) + 'px' } },
      items.filter(Boolean).map(([ic, label, fn, cls]) => h('button', { class: cls || '', onclick: () => { m.remove(); fn(); } }, icon(ic, 16), label)));
    document.body.append(m);
    setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off); } }), 0);
  }

  function row(b) {
    const s = stats(b), st = withDefaults(b.settings);
    const meta = [LAYOUTS[st.layout]?.replace(/\(.*\)/, ''), `${s.writers}명 · 카드 ${s.cards}장`, s.mailNew ? `우편함 새 카드 ${s.mailNew}` : null, st.open ? null : '쓰기 닫힘'].filter(Boolean).join(' · ');
    const more = h('button', { class: 'ibtn', title: '더 보기', onclick: e => menu(e.currentTarget, [
      [st.open ? 'lock' : 'unlock', st.open ? '쓰기 닫기' : '쓰기 열기', () => apply(b, 'setSettings', { settings: { open: !st.open } })],
      ['book', '정리본 보기(자료 만들기용)', () => outline(b)],
      ['send', 'Claude에게 보내기', () => toClaude(b)],
      ['download', 'AI 카드 넣기(우편함)', () => putMail(b)],
      ['clip', '결과물 붙이기', () => addResult(b)],
      ['chart', '기록 보기', () => record(b)],
      ['trash', '판 지우기', () => { if (confirm(`'${b.title}' 판을 지울까요? 되돌릴 수 없어요.`)) store.remove(b.id); }, 'danger'],
    ]) }, icon('more'));
    return h('div', { class: 't-row' },
      h('span', { class: 't-ico' }, b.template.icon || '📋'),
      h('div', { class: 't-main' }, h('div', { class: 't-title' }, b.title, st.open ? null : h('span', { class: 'pill warn sm' }, icon('lock', 13), '닫힘')), h('div', { class: 't-meta' }, meta)),
      store.kind === 'rtdb' ? null : h('div', { class: 't-code', title: '아이들이 들어올 때 쓰는 판 코드' }, b.code),   // RPG 안에서는 코드 없이 아이 홈에 뜬다
      h('div', { class: 't-btns' },
        h('a', { class: 'btn primary', href: '#/tb/' + b.id }, '열기'),
        h('button', { class: 'btn', onclick: () => settings(b) }, icon('gear', 16), '설정'),
        h('a', { class: 'btn', href: '#/tv/' + b.id, title: '교실 TV에 크게' }, icon('tv', 16), 'TV'),
        more));
  }

  // 연구 자료 내보내기 — 생각판 기록을 RPG 학생(id)과 이어 표로(학생별 요약 · 카드 · 기록) + 전체 JSON
  function research(boards) {
    if (!boards.length) return toast('아직 판이 없어요');
    const checks = boards.map(b => { const c = h('input', { type: 'checkbox', checked: true }); c.dataset.id = b.id; return [b, c]; });
    const pseudo = h('input', { type: 'checkbox', class: 'sw', checked: true }), text = h('input', { type: 'checkbox', class: 'sw', checked: true });
    const chosen = () => checks.filter(([, c]) => c.checked).map(([b]) => b);
    const opts = () => ({ pseudo: pseudo.checked, text: text.checked });
    const day = new Date().toISOString().slice(0, 10);
    const save = (name, body, type) => { const a = h('a', { href: URL.createObjectURL(new Blob([body], { type })), download: `생각판-${name}-${day}${opts().pseudo ? '-가명' : ''}.${type.includes('json') ? 'json' : 'csv'}` }); a.click(); };
    const csv = (name, fn) => () => { const bs = chosen(); if (!bs.length) return toast('판을 골라 주세요'); save(name, toCSV(fn(bs, roster, opts())), 'text/csv;charset=utf-8'); };
    const json = () => {
      const bs = chosen(); if (!bs.length) return toast('판을 골라 주세요');
      const o = opts(), P = people(bs, roster, o);
      const scrub = x => { if (!x || typeof x !== 'object') return x; const y = { ...x }; if (o.pseudo && (y.sid || (y.by && y.by !== 'teacher'))) { const p = P.get(y.sid || y.by); y.by = p ? p.label : '?'; delete y.sid; } if (!o.text) { delete y.text; delete y.from; delete y.orig; } return y; };
      const out = bs.map(b => ({ ...b, cards: Object.fromEntries(Object.entries(b.cards).map(([k, v]) => [k, scrub(v)])), log: Object.fromEntries(Object.entries(b.log).map(([k, v]) => [k, scrub(v)])),
        mail: Object.fromEntries(Object.entries(b.mail).map(([k, v]) => [k, scrub(v)])), links: Object.fromEntries(Object.entries(b.links).map(([k, v]) => [k, scrub(v)])) }));
      save('전체', JSON.stringify({ exported: new Date().toISOString(), pseudo: o.pseudo, students: [...P.values()].map(p => o.pseudo ? { label: p.label } : { label: p.label, id: p.id, name: p.name }), boards: out }, null, 2), 'application/json');
    };
    modal('연구 자료 내보내기', h('div', { class: 'form' },
      h('p', { class: 'help' }, roster.length ? `학급 RPG 학생 ${roster.length}명과 이어요(안 쓴 아이도 0으로 들어가요). 출처 색 · 공감 수는 성과가 아니라 흔적이에요.` : '학생 명단 없이 판에 쓴 사람만으로 만들어요(RPG 밖 시험).'),
      h('div', { class: 'rs-boards' }, checks.map(([b, c]) => h('label', { class: 'set-row tog' }, c, h('span', {}, `${b.template.icon || ''} ${b.title}`)))),
      h('label', { class: 'set-row tog' }, pseudo, h('span', {}, '가명으로(S01 …) — 이름 · RPG id 빼기'), h('span', { class: 'set-help' }, '대회 보고서 · 다른 사람과 나눌 때는 켜 두세요')),
      h('label', { class: 'set-row tog' }, text, h('span', {}, '카드 글 넣기'), h('span', { class: 'set-help' }, '글 속에 아이가 쓴 친구 이름은 가명으로 바뀌지 않아요 — 나눌 때는 끄세요'))), [
      { label: '기록(시간순) CSV', onclick: csv('기록', logRows) },
      { label: '카드 CSV', onclick: csv('카드', cardRows) },
      { label: '전체 JSON', onclick: json },
      { label: '학생별 요약 CSV', primary: true, onclick: csv('학생별', studentRows) },
    ]);
  }

  // [THINKBOARD-STORY-1] 정리본 — 아이들이 정리한 것을 그대로 글로(이야기 줄 = 차례 · 갈림길 · 끝 / 나무 = 층) · 이름 · 출처 없음
  function outline(b) {
    const ta = h('textarea', { class: 'mono', rows: 18, readonly: true });
    ta.value = boardOutline(b);
    modal(`정리본 — ${b.title}`, h('div', {}, h('p', { class: 'help' }, '아이들이 판에 정리한 그대로예요. 복사해서 학습지 · 그림책 · 발표 자료를 만들 때 써요. 아이 이름은 들어가지 않아요.'), ta), [
      { label: '글로 받기(.txt)', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([ta.value], { type: 'text/plain;charset=utf-8' })), download: `정리본-${b.title}-${new Date().toISOString().slice(0, 10)}.txt` }); a.click(); } },
      { label: '복사', primary: true, onclick: async () => toast((await copyText(ta.value)) ? '정리본을 복사했어요' : '복사 실패') },
    ]);
  }

  function toClaude(b) {
    const ta = h('textarea', { class: 'mono', rows: 16, readonly: true });
    ta.value = promptFor(b);
    modal('Claude에게 보내기', h('div', {},
      h('p', { class: 'help' }, '① 복사해서 Claude에 붙여 넣기 → ② 나온 답(JSON)을 복사 → ③ 이 판의 [📥 AI 카드 넣기]에 붙여 넣기. 아이 이름은 들어가지 않아요.'),
      ta), [
      { label: '판 내용만 복사', onclick: async () => toast((await copyText(boardToText(b))) ? '판 내용을 복사했어요' : '복사 실패') },
      { label: '지시문 전체 복사', primary: true, onclick: async () => toast((await copyText(ta.value)) ? '복사했어요 — Claude에 붙여 넣으세요' : '복사 실패') },
    ]);
  }

  function putMail(b) {
    const ta = h('textarea', { class: 'mono', rows: 8, placeholder: '{"cards":[{"type":"question","text":"…","zone":"…"}]}' });
    const out = h('div', { class: 'preview' });
    let parsed = null;
    const check = () => {
      parsed = parseMail(ta.value, b);
      out.innerHTML = '';
      out.append(
        ...parsed.items.map(it => h('div', { class: 'mail ' + it.type },
          h('div', { class: 'mail-kind' }, it.type === 'question' ? '❓ 질문' : '💡 제안', it.zone ? h('span', { class: 'zchip' }, it.zone) : null),
          h('div', { class: 'mail-text' }, it.text), it.why ? h('div', { class: 'mail-why' }, '└ 왜? ', it.why) : null)),
        ...parsed.notes.map(n => h('div', { class: 'note' }, '⚠️ ', n)));
    };
    ta.addEventListener('input', check);
    modal(`AI 카드 넣기 — ${b.title}`, h('div', {}, h('p', { class: 'help' }, 'Claude가 준 답을 붙여 넣으면 아래에 미리 보여요. 넣은 카드는 판에 바로 붙지 않고 아이들 우편함으로 가요.'), ta, out), [
      { label: '우편함에 넣기', primary: true, onclick: async close => {
        check();
        if (!parsed.ok) return toast('넣을 카드가 없어요');
        await apply(b, 'addMail', { items: parsed.items });
        toast(`📬 ${parsed.items.length}장을 보냈어요`); close();
      } },
    ]);
  }

  // ⚙️ 설정 — settings.js 표를 보고 저절로 그린다(패들렛 설정처럼). 바꾼 것은 log 에 남는다.
  function settings(b) {
    const f = settingsForm(b.settings);
    modal(`설정 — ${b.title}`, h('div', {}, h('p', { class: 'help' }, '판마다 모양 · 쓰기 · 보기 · 반응 · 발판을 골라요. 바꾸면 아이들 화면에 바로 반영돼요.'), f.el), [
      { label: '저장', primary: true, onclick: async close => { await apply(b, 'setSettings', { settings: f.read() }); toast('설정을 바꿨어요'); close(); } },
    ]);
  }

  function addResult(b) {
    const t = h('input', { placeholder: '이름 (예: 1차 이야기)' }), u = h('input', { placeholder: 'https://…' });
    modal(`결과물 붙이기 — ${b.title}`, h('div', { class: 'form' }, t, u,
      h('p', { class: 'help' }, '결과물을 붙인 뒤에 아이들이 더하거나 고친 카드에는 🔁(결과 보고 고침)가 붙어요.')), [
      { label: '붙이기', primary: true, onclick: async close => {
        const url = u.value.trim();
        if (!/^https?:\/\//.test(url)) return toast('https:// 로 시작하는 주소를 넣어 주세요');
        await apply(b, 'addResult', { url, title: t.value.trim() }); close();
      } },
    ]);
  }

  function record(b) {
    const s = stats(b);
    const line = (k, v) => h('div', { class: 'stat' }, h('span', {}, k), h('b', {}, v));
    const obj = o => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음';
    const act = { keep: '그대로', edit: '고쳐서', drop: '버림', answer: '답함', unknown: '❔로' };
    modal(`기록 — ${b.title}`, h('div', {},
      h('p', { class: 'help' }, '색 비율은 성과가 아니라 흔적이에요. 왜 가져오고·고치고·버렸는지(이유)를 함께 보세요.'),
      line('카드', s.cards),
      line('출처', Object.entries(SRC).map(([k, v]) => `${v} ${s.src[k] || 0}`).join(' · ')),
      line('❔ 만든 수 / 정함', `${s.unknownMade} / ${s.resolved}`),
      line('결과 보고 더하거나 고침', s.afterResult),
      line('우편함 판단', Object.entries(s.judged).map(([k, v]) => `${act[k] || k} ${v}`).join(' · ') || '없음'),
      line('판단 이유', obj(s.reasons)),
      line('기록 줄 수', Object.keys(b.log).length)), [
      { label: 'JSON 내려받기', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })), download: `생각판-${b.title}-${new Date().toISOString().slice(0, 10)}.json` });
        a.click();
      } },
    ]);
  }

  function tplSection(open) {
    return h('details', { class: 'tpl', open },
      h('summary', {}, `판 틀 ${tpls.length}개 — 프로젝트마다 갈아 끼우는 설정`),
      h('div', { class: 'tpl-list' }, tpls.map(t => h('div', { class: 'tpl-item' },
        h('b', {}, `${t.icon || '📋'} ${t.name}`),
        h('span', { class: 'sub' }, tplDesc(t) || '빈 판'),
        h('button', { class: 'btn', onclick: async () => toast((await copyText(JSON.stringify(t, null, 2))) ? '틀 JSON을 복사했어요' : '복사 실패') }, 'JSON 복사'),
        BUILTIN.includes(t) ? null : h('button', { class: 'btn ghost', onclick: async () => {
          await store.saveTemplates((await store.templates()).filter(x => x.id !== t.id)); load();
        } }, '🗑')))),
      h('button', { class: 'btn', onclick: addTemplate }, icon('plus', 16), '틀 더하기 (JSON 붙여넣기)'));
  }

  function addTemplate() {
    const ta = h('textarea', { class: 'mono', rows: 12 });
    ta.value = JSON.stringify({ id: 'my-tpl', name: '새 틀', icon: '📋', unit: 'group', mail: 'qs', zones: ['구역1', '구역2'], hints: [{ zone: '구역1', empty: '아직 비어 있어요' }], ai: '이번 활동에서 AI가 물어볼 것 한 줄' }, null, 2);
    modal('＋ 판 틀 더하기', h('div', {}, h('p', { class: 'help' }, 'Claude에게 "○○ 수업용 생각판 틀 만들어 줘"라고 하고 받은 JSON을 붙여 넣어도 돼요.'), ta), [
      { label: '더하기', primary: true, onclick: async close => {
        let t;
        try { t = JSON.parse(ta.value); } catch { return toast('JSON 모양이 깨졌어요'); }
        if (!t.id || !t.name || !Array.isArray(t.zones)) return toast('id · name · zones가 필요해요');
        t.hints ||= []; t.ai ||= '';
        if (tpls.some(x => x.id === t.id)) t.id += '-' + Date.now().toString(36).slice(-3);
        await store.saveTemplates([...(await store.templates()), t]);
        close(); load();
      } },
    ]);
  }

  load();
  return () => { stopWatch(); clearTimeout(timer); };
}
