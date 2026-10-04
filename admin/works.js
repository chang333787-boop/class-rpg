// admin/works.js — 작품 관리(승인·반려·라이트박스·작품 종류) · 독서 현황
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'works' — 원래 admin.js 2419~3014줄 ──
// ══════════════════════════════════════════════════
//  QUESTS
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
//  ARTWORK 관리 (학생이 올린 작품 승인/반려)
// ══════════════════════════════════════════════════
// [ARTFREE-1] 수업 작품과 자유 작품을 갈라 본다. '전체'가 기본.
let ART_KIND_FILTER = 'all';   // 'all' | 'lesson' | 'free' | 'worksheet'(SCAN-LINK-1)
function setArtKindFilter(k) {
  ART_KIND_FILTER = k;
  renderArtworkPending(); renderArtworkAdmin();
}
const artKindOf = x => (x && x.kind) || 'lesson';   // 예전 데이터는 kind가 없다 → 수업 작품으로 본다
function artKindChips() {
  return `<div style="display:flex;gap:.35rem;padding:.6rem 1.2rem">
    ${[['all', '전체'], ['lesson', '🎨 수업'], ['free', '✏️ 자유'], ['worksheet', '📄 학습지']].map(k => `
      <button class="btn-sm ${ART_KIND_FILTER === k[0] ? '' : 'outline'}" style="font-size:.72rem"
        onclick="setArtKindFilter('${k[0]}')">${k[1]}</button>`).join('')}
  </div>`;
}

function renderArtworkPending() {
  const students = DB.getStudents();
  const pending  = [];
  students.forEach(s => {
    (s.pendingRewards||[]).filter(r=>r.type==='artwork')
      .filter(r => ART_KIND_FILTER === 'all' || artKindOf(r) === ART_KIND_FILTER)
      .forEach(r => {
        pending.push({student:s, ...r});
      });
  });
  const el = document.getElementById('artwork-pending-list');
  if (!el) return;
  if (pending.length === 0) {
    el.innerHTML = artKindChips() + '<div style="padding:1rem;color:var(--txt3);font-size:.83rem;text-align:center">대기 중인 작품이 없어요</div>';
    return;
  }
  el.innerHTML = artKindChips() + pending.map(item => `
    <div style="padding:.9rem 1.2rem;border-bottom:1px solid rgba(255,255,255,.05)">
      <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.6rem">
        <span style="font-size:1.2rem">${item.student.avatar}</span>
        <span style="font-weight:700">${escHtml(item.student.name || '')}</span>
        ${artKindOf(item) === 'free'
          ? '<span style="font-size:.66rem;padding:.1rem .4rem;border-radius:99px;background:rgba(93,173,226,.16);color:var(--sky)">자유</span>'
          : artKindOf(item) === 'worksheet'
          ? '<span style="font-size:.66rem;padding:.1rem .4rem;border-radius:99px;background:rgba(200,150,46,.16);color:var(--gold)">📄 학습지</span>'
          : '<span style="font-size:.66rem;padding:.1rem .4rem;border-radius:99px;background:rgba(46,204,113,.16);color:var(--emerald)">수업</span>'}
        <span style="font-size:.78rem;color:var(--txt3)">· ${escHtml(item.artTitle || '제목 없는 그림')}</span>
        <span style="font-size:.72rem;color:var(--txt3);margin-left:auto">${item.date||''}</span>
      </div>
      ${item.artUrl?`<img src="${escHtml(item.artUrl)}" style="width:100%;max-height:250px;object-fit:contain;border-radius:8px;margin-bottom:.6rem;cursor:pointer" onclick="adminOpenLightbox('${escJsAttr(item.artUrl)}','${escJsAttr(item.artTitle||'')}')">`:''}
      ${item.artDesc?`<div style="font-size:.78rem;color:var(--txt2);margin-bottom:.6rem">${escHtml(item.artDesc)}</div>`:''}
      <!-- 선생님 코멘트 입력 -->
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem">
        <input class="form-input" id="aw-cmt-${item.id}" placeholder="선생님 한마디 (선택)" style="flex:1;font-size:.8rem">
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn-sm success" style="font-size:.78rem"
          onclick="approveArtwork('${item.student.id}','${item.id}')">✅ 승인 · 전시</button>
        <button class="btn-sm danger" style="font-size:.78rem"
          onclick="rejectSingleDash('${item.student.id}','${item.id}',this)">✕ 반려</button>
      </div>
    </div>`).join('');
}

function approveArtwork(studentId, rewardId) {
  const s = DB.getStudent(studentId);
  if (!s) return;
  const reward = (s.pendingRewards||[]).find(r=>r.id===rewardId);
  if (!reward) return;
  // 선생님 코멘트를 reward에 반영 후 approveReward로 처리
  const comment = document.getElementById('aw-cmt-'+rewardId)?.value.trim() || '';
  if (comment) reward.artDesc = comment;
  //  작품은 승인 즉시 pendingRewards에서 제거(approveReward 가 뺀다 — 학생 받기 버튼 불필요)
  //  [APPROVE-ATOMIC-1] 보상 빼기 + 골드·EXP 한 쓰기 · 보상이 있을 때만 · [APPROVE-AFTER-1] 작품 전시·기록은 저장이 된 뒤에만
  const saved = approveAndSave(s, reward);
  renderAll();
  const what = `${s.name} · "${reward.artTitle||reward.label}"`;
  afterSaves([saved], (failed, n, gone) => gone
    ? notify(`ℹ️ ${what} 은(는) 이미 다른 곳에서 처리된 작품이에요 — 다시 전시하지 않았어요`, 'error')
    : failed
    ? notify(`⚠️ ${what} 전시 저장에 실패했어요. 새로고침 뒤 다시 확인해 주세요.`, 'error')
    : notify(`✅ ${what} 전시 완료!`));
}


async function deleteOrphanArtworks() {
  if (!confirm('삭제된 학생의 작품을 모두 정리할까요?\n이 작업은 되돌릴 수 없습니다.')) return;
  const validIds = new Set(DB.getStudents().map(s => s.id));
  // [DEDUPE-ART-1] 통째 set 대신 지울 키만 — 그 순간 올라온 작품을 지우지 않는다
  const r = await normalizeArtworkKeys(a => validIds.has(a.studentId));
  renderArtworkAdmin();
  notify(`🗑️ 주인 없는 작품 ${r.removed}개 정리 완료`);
}

function openEditArtworkModal(artworkId) {
  const db = DB.load();
  const a = (db.artworks||[]).find(x=>x.id===artworkId);
  if (!a) return;
  document.getElementById('ae-id').value      = artworkId;
  document.getElementById('ae-title').value   = a.title || a.artTitle || '';
  document.getElementById('ae-comment').value = a.comment || a.artDesc || '';
  // 과목 셀렉트 채우기
  const subjects = getActiveSubjects(db);
  const sel = document.getElementById('ae-subject');
  sel.innerHTML = '<option value="">없음</option>' +
    subjects.map(s=>`<option value="${s}">${s}</option>`).join('');
  sel.value = a.subject || '';
  document.getElementById('m-artwork-edit').classList.add('open');
}

async function saveArtworkEdit() {
  const id      = document.getElementById('ae-id').value;
  const title   = document.getElementById('ae-title').value.trim();
  const subject = document.getElementById('ae-subject').value;
  const comment = document.getElementById('ae-comment').value.trim();
  if (!title) { notify('제목을 입력해주세요', 'error'); return; }
  try {
    await DB.updateArtwork(id, { title, subject, comment });
    document.getElementById('m-artwork-edit').classList.remove('open');
    renderArtworkAdmin();
    notify('✅ 작품 정보 수정 완료!');
  } catch (e) {
    notify('작품 수정 저장 실패: ' + e.message, 'error');
  }
}

// ── 관리자 라이트박스 ──
function adminOpenArtLb(e) {
  const imgEl = e.target;
  const container = imgEl.closest('.aw-detail');
  const imgs = container
    ? Array.from(container.querySelectorAll('img')).map(i => ({url:i.src, title:''}))
    : [{url: imgEl.src, title:''}];
  const idx = imgs.findIndex(i => i.url === imgEl.src);
  adminOpenLightbox(imgEl.src, '', imgs, Math.max(0, idx));
}

let _adminLbImages = [];
let _adminLbIdx    = 0;

function adminOpenLightbox(url, title, images, idx) {
  // images 배열 전달 시 슬라이드쇼, 아닐 시 단독
  _adminLbImages = images || [{url, title}];
  _adminLbIdx    = idx || 0;

  let lb = document.getElementById('admin-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'admin-lightbox';
    lb.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);flex-direction:column;align-items:center;justify-content:center;';
    lb.innerHTML = `
      <button onclick="document.getElementById('admin-lightbox').style.display='none'"
        style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,.15);border:none;
        color:#fff;font-size:1.4rem;width:40px;height:40px;border-radius:50%;cursor:pointer">✕</button>
      <button id="admin-lb-prev" onclick="adminLbNav(-1)"
        style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);
          background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.8rem;
          width:48px;height:48px;border-radius:50%;cursor:pointer">‹</button>
      <button id="admin-lb-next" onclick="adminLbNav(1)"
        style="position:absolute;right:4rem;top:50%;transform:translateY(-50%);
          background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.8rem;
          width:48px;height:48px;border-radius:50%;cursor:pointer">›</button>
      <img id="admin-lb-img" style="max-width:90vw;max-height:78vh;object-fit:contain;border-radius:10px;cursor:pointer" onclick="adminLbNav(1)">
      <div id="admin-lb-title" style="color:#fff;font-weight:700;margin-top:.8rem;font-size:.95rem"></div>
      <div id="admin-lb-counter" style="color:rgba(255,255,255,.5);font-size:.78rem;margin-top:.3rem"></div>`;
    lb.addEventListener('click', e => { if(e.target===lb) lb.style.display='none'; });
    document.body.appendChild(lb);
  }
  adminLbRender();
  lb.style.display = 'flex';
}

function adminLbRender() {
  const item = _adminLbImages[_adminLbIdx];
  if (!item) return;
  document.getElementById('admin-lb-img').src           = item.url;
  document.getElementById('admin-lb-title').textContent = item.title || '';
  document.getElementById('admin-lb-counter').textContent =
    _adminLbImages.length > 1 ? `${_adminLbIdx+1} / ${_adminLbImages.length}` : '';
  // 이전/다음 버튼 표시
  const prevBtn = document.getElementById('admin-lb-prev');
  const nextBtn = document.getElementById('admin-lb-next');
  if (prevBtn) prevBtn.style.display = _adminLbImages.length > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = _adminLbImages.length > 1 ? '' : 'none';
}

function adminLbNav(dir) {
  _adminLbIdx = (_adminLbIdx + dir + _adminLbImages.length) % _adminLbImages.length;
  adminLbRender();
}

function renderArtworkAdmin() {
  const db = DB.load();
  const allArtworks = (db.artworks||[]).slice().reverse()
    .filter(a => ART_KIND_FILTER === 'all' || artKindOf(a) === ART_KIND_FILTER);   // [ARTFREE-1]
  const students = DB.getStudents();
  const el = document.getElementById('artwork-admin-list');
  if (!el) return;

  // 고아 작품 탐지 (studentId가 현재 학생 목록에 없는 작품)
  const validStudentIds = new Set(students.map(s => s.id));
  const orphanArtworks = allArtworks.filter(a => !validStudentIds.has(a.studentId));
  const orphanWrap = document.getElementById('artwork-orphan-wrap');
  if (orphanWrap) {
    if (orphanArtworks.length > 0) {
      orphanWrap.style.display = '';
      orphanWrap.innerHTML = `<div style="background:rgba(231,76,60,.08);border:1px solid rgba(231,76,60,.25);
        border-radius:10px;padding:.7rem 1rem;margin-bottom:.8rem;display:flex;align-items:center;gap:.8rem">
        <div style="flex:1;font-size:.8rem;color:var(--red)">
          ⚠️ 삭제된 학생의 작품 <strong>${orphanArtworks.length}개</strong>가 있어요 (현재 ?? 로 표시)
        </div>
        <button class="btn-sm danger fs-72"
          onclick="deleteOrphanArtworks()">🗑️ 정리</button>
      </div>`;
    } else {
      orphanWrap.style.display = 'none';
    }
  }

  // 학생 필터 셀렉트 초기화
  const sel = document.getElementById('artwork-filter');
  if (sel && sel.options.length === 1) {
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.avatar + ' ' + s.name;
      sel.appendChild(opt);
    });
  }

  // 과목 필터 셀렉트 매번 갱신
  const subSel = document.getElementById('artwork-subject-filter');
  if (subSel) {
    const prevSub = subSel.value;
    const subjects = getActiveSubjects(db);
    subSel.innerHTML = '<option value="all">전체 과목</option>' +
      subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    if (prevSub) subSel.value = prevSub;
  }

  const filter    = sel?.value    || 'all';
  const subFilter = subSel?.value || 'all';
  let artworks = filter === 'all' ? allArtworks : allArtworks.filter(a=>a.studentId===filter);
  if (subFilter !== 'all') artworks = artworks.filter(a => (a.subject||'') === subFilter);

  if (artworks.length === 0) {
    el.innerHTML = '<div style="padding:1rem;color:var(--txt3);font-size:.83rem;text-align:center">전시중인 작품이 없어요</div>';
    return;
  }
  // 학생별로 그룹핑
  const byStudent = {};
  artworks.forEach(a => {
    if (!byStudent[a.studentId]) byStudent[a.studentId] = [];
    byStudent[a.studentId].push(a);
  });
  el.innerHTML = Object.entries(byStudent).map(([sid, arts]) => {
    const s = students.find(x=>x.id===sid);
    const isExpanded = el._expanded === sid;
    return `<div style="border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="display:flex;align-items:center;gap:.8rem;padding:.75rem 1.2rem;cursor:pointer"
        onclick="this.parentElement.querySelector('.aw-detail').style.display=
          this.parentElement.querySelector('.aw-detail').style.display==='none'?'':'none'">
        <span style="font-size:1.2rem">${s?.avatar||'?'}</span>
        <span style="font-weight:700;flex:1">${escHtml(s?.name || '?')}</span>
        <span style="font-size:.75rem;color:var(--sky)">${arts.length}점</span>
        <span style="color:var(--txt3);font-size:.9rem">›</span>
      </div>
      <div class="aw-detail" style="display:none;padding:0 1.2rem .8rem">
        ${arts.map(a=>`
          <div style="display:flex;align-items:flex-start;gap:.8rem;padding:.6rem 0;border-top:1px solid rgba(255,255,255,.04)">
            ${a.artUrl?`<img src="${escHtml(a.artUrl)}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;flex-shrink:0;cursor:pointer"
              onclick="adminOpenArtLb(event)">`:``}
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.85rem">${escHtml(a.title || '제목 없는 그림')}
                ${a.subject?`<span style="font-size:.68rem;background:rgba(255,215,0,.12);color:var(--gold);border-radius:10px;padding:.1rem .4rem;margin-left:.3rem">${escHtml(a.subject)}</span>`:''}
              </div>
              <div class="text-muted-tiny">${a.date||''}</div>
              ${a.comment?`<div style="font-size:.74rem;color:var(--txt2);margin-top:.15rem">${escHtml(a.comment)}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:.3rem;flex-shrink:0">
              <button class="btn-sm outline" style="font-size:.66rem;padding:.2rem .45rem"
                onclick="openEditArtworkModal('${a.id}')">✏️ 편집</button>
              <button class="btn-sm outline" style="font-size:.66rem;padding:.2rem .45rem"
                onclick="toggleArtworkHidden('${a.id}')">${a.hidden ? '👁️ 다시 걸기' : '🙈 내리기'}</button>
              <button class="btn-sm danger" style="font-size:.66rem;padding:.2rem .45rem"
                onclick="deleteArtwork('${a.id}')">🗑️</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  BOOKS (독서 현황)
// ══════════════════════════════════════════════════
function parseBookContent(r) {
  let charName = r.characterName || '', charReason = r.characterReason || '';
  let summary = r.summary || '', reflection = r.reflection || '';
  const raw = r.bookReview || r.review || '';
  if (!summary && !reflection && raw) {
    const charMatch = raw.match(/\[인물:\s*([^\n\]—–-]+?)(?:\s*[—–-]\s*([^\n\]]+))?\]/);
    if (charMatch && !charName) { charName = (charMatch[1]||'').trim(); charReason = (charMatch[2]||'').trim(); }
    const cleanRaw = raw.replace(/\[인물:[^\]]*\]/g,'').trim();
    const parts = cleanRaw.split(/\n\n|\n(?=[가-힣])/);
    if (parts.length >= 2) {
      summary    = parts.slice(0, Math.ceil(parts.length/2)).join('\n').trim();
      reflection = parts.slice(Math.ceil(parts.length/2)).join('\n').trim();
    } else { summary = cleanRaw; }
  }
  let html = '';
  if (charName) html += `<div style="background:rgba(155,89,182,.07);border-left:3px solid rgba(155,89,182,.4);border-radius:0 8px 8px 0;padding:.4rem .65rem"><div style="font-size:.65rem;color:rgba(155,89,182,.9);font-weight:700;margin-bottom:.15rem">🧑 인상 깊은 인물</div><div style="font-size:.8rem;color:var(--txt1);font-weight:600">${escHtml(charName)}</div>${charReason?`<div style="font-size:.75rem;color:var(--txt2);margin-top:.1rem">${escHtml(charReason)}</div>`:''}</div>`;
  if (summary) html += `<div style="background:rgba(52,152,219,.07);border-left:3px solid rgba(52,152,219,.35);border-radius:0 8px 8px 0;padding:.4rem .65rem"><div style="font-size:.65rem;color:var(--sky);font-weight:700;margin-bottom:.15rem">📖 줄거리</div><div style="font-size:.78rem;color:var(--txt2);line-height:1.65;white-space:pre-wrap">${escHtml(summary)}</div></div>`;
  if (reflection) html += `<div style="background:rgba(46,204,113,.07);border-left:3px solid rgba(46,204,113,.35);border-radius:0 8px 8px 0;padding:.4rem .65rem"><div style="font-size:.65rem;color:var(--emerald);font-weight:700;margin-bottom:.15rem">💬 느낀 점</div><div style="font-size:.78rem;color:var(--txt2);line-height:1.65;white-space:pre-wrap">${escHtml(reflection)}</div></div>`;
  if (!html && raw) html = `<div style="font-size:.78rem;color:var(--txt2);line-height:1.65;white-space:pre-wrap;padding:.3rem 0">${escHtml(raw)}</div>`;
  return html;
}


function renderBooksPage() {
  const students   = DB.getStudents();
  const filterStu  = document.getElementById('books-filter')?.value || 'all';
  const filterCat  = document.getElementById('books-cat-filter')?.value || 'all';
  const filterChk  = document.getElementById('books-check-filter')?.value || 'all';
  const sortMode   = document.getElementById('books-sort')?.value || 'date-desc';

  // 학생 필터 셀렉트 초기화
  const sel = document.getElementById('books-filter');
  if (sel && sel.options.length === 1) {
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.avatar + ' ' + s.name;
      sel.appendChild(opt);
    });
  }

  // 학급 요약
  const totalBooks   = students.reduce((sum,s)=>(sum+(s.bookCount||0)),0);
  const totalPending = students.reduce((sum,s)=>sum+((s.pendingRewards||[]).filter(r=>r.type==='book').length),0);
  const avgBooks     = students.length ? (totalBooks/students.length).toFixed(1) : 0;
  const topReader    = [...students].sort((a,b)=>(b.bookCount||0)-(a.bookCount||0))[0];
  document.getElementById('books-summary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem">
      <div class="text-center">
        <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${totalBooks}</div>
        <div class="text-muted-sm">학급 총 독서</div>
      </div>
      <div class="text-center">
        <div style="font-size:1.6rem;font-weight:700;color:var(--sky)">${avgBooks}</div>
        <div class="text-muted-sm">1인 평균</div>
      </div>
      <div class="text-center">
        <div style="font-size:1.6rem;font-weight:700;color:${totalPending>0?'var(--red)':'var(--txt3)'}">${totalPending}</div>
        <div class="text-muted-sm">확인 대기</div>
      </div>
      <div class="text-center">
        <div style="font-size:1.2rem;font-weight:700;color:var(--emerald)">${topReader?.avatar||''} ${topReader?.name||'-'}</div>
        <div class="text-muted-sm">최다 독서 (${topReader?.bookCount||0}권)</div>
      </div>
    </div>`;

  // 월별 차트
  const now = new Date();
  const months = [];
  for (let mo=3; mo<=12; mo++) months.push({ key:now.getFullYear()+'-'+mo, label:mo+'월', count:0 });
  const chartTarget = filterStu==='all' ? students : students.filter(s=>s.id===filterStu);
  chartTarget.forEach(s => (s.books||[]).forEach(b => {
    if (!b.date) return;
    const parts = b.date.split('-'); if (parts.length<2) return;
    const key = parts[0]+'-'+parseInt(parts[1]);
    const mo = months.find(m=>m.key===key); if (mo) mo.count++;
  }));
  const maxC = Math.max(...months.map(m=>m.count), 1);
  const chartEl = document.getElementById('books-monthly-chart');
  const labelEl = document.getElementById('books-monthly-labels');
  if (chartEl) chartEl.innerHTML = months.map(m => {
    const h = Math.max(4, Math.round((m.count/maxC)*90));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px">
      ${m.count>0?`<span style="font-size:.7rem;color:var(--gold);font-weight:700">${m.count}</span>`:''}
      <div style="width:100%;height:${h}px;border-radius:4px 4px 0 0;
        background:${m.count>0?'var(--gold)':'rgba(255,255,255,.08)'};opacity:.8"></div>
    </div>`;
  }).join('');
  if (labelEl) labelEl.innerHTML = months.map(m =>
    `<div style="flex:1;text-align:center;font-size:.65rem;color:var(--txt3)">${m.label}</div>`
  ).join('');

  // 전체 기록 수집 (pending + done)
  const target = filterStu==='all' ? students : students.filter(s=>s.id===filterStu);
  let pendingRecs = [], doneRecs = [];

  target.forEach(s => {
    (s.pendingRewards||[]).filter(r=>r.type==='book').forEach(p =>
      pendingRecs.push({ ...p, _sid:s.id, _sname:s.name, _savatar:s.avatar, _status:'pending' })
    );
    (s.books||[]).forEach(b =>
      doneRecs.push({ ...b, bookTitle:b.title, bookDate:b.date, _sid:s.id, _sname:s.name, _savatar:s.avatar, _status:'done' })
    );
  });

  // 필터
  let allRecs = [...pendingRecs, ...doneRecs];
  if (filterCat !== 'all') allRecs = allRecs.filter(r => r.category === filterCat);
  if (filterChk === 'unchecked') allRecs = allRecs.filter(r => r._status==='pending' || !r.teacherChecked);
  if (filterChk === 'checked')   allRecs = allRecs.filter(r => r._status!=='pending' && r.teacherChecked);
  pendingRecs = allRecs.filter(r=>r._status==='pending');
  doneRecs    = allRecs.filter(r=>r._status!=='pending');

  if (sortMode === 'date-desc') doneRecs.sort((a,b)=>(b.bookDate||'').localeCompare(a.bookDate||''));
  else if (sortMode === 'date-asc') doneRecs.sort((a,b)=>(a.bookDate||'').localeCompare(b.bookDate||''));
  else doneRecs.sort((a,b)=>a._sname.localeCompare(b._sname));

  const el = document.getElementById('books-list');
  if (!el) return;

  const starStr  = n => n ? '⭐'.repeat(Math.min(n,5)) : '';
  const catLabel = r => r.category === '직접입력' && r.customCategory ? r.customCategory : (r.category||'');

  // ── 카드 렌더 함수 ──────────────────────────────────
  const bookCard = (r, expanded) => {
    const isPending = r._status === 'pending';
    const isChecked = !isPending && r.teacherChecked;
    const catTxt = catLabel(r);
    const stars  = starStr(r.rating);
    return `
    <div style="border-radius:12px;margin:.5rem 1rem;padding:.85rem 1rem;
      background:${isPending?'rgba(255,215,0,.06)':'rgba(255,255,255,.03)'};
      border:1.5px solid ${isPending?'rgba(255,215,0,.3)':isChecked?'rgba(46,204,113,.15)':'rgba(255,255,255,.07)'}">

      <!-- 상단: 상태 + 학생 + 책 제목 -->
      <div style="display:flex;align-items:flex-start;gap:.6rem;flex-wrap:wrap;margin-bottom:.55rem">
        <span style="flex-shrink:0;font-size:.68rem;font-weight:700;padding:.18rem .55rem;border-radius:20px;
          background:${isPending?'rgba(255,215,0,.18)':isChecked?'rgba(46,204,113,.18)':'rgba(255,255,255,.08)'};
          color:${isPending?'var(--gold)':isChecked?'var(--emerald)':'var(--txt3)'}">
          ${isPending?'⏳ 확인 대기':isChecked?'✅ 확인완료':'미확인'}</span>
        <span style="font-size:1rem">${r._savatar}</span>
        <span style="font-weight:800;font-size:.9rem;color:var(--txt1)">${r._sname}</span>
        <span style="font-weight:700;font-size:.88rem;color:var(--sky);flex:1;min-width:120px">
          『${escHtml(r.bookTitle||r.title||'')}』</span>
        <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
          ${catTxt?`<span style="font-size:.68rem;background:rgba(93,173,226,.12);color:var(--sky);
            border-radius:8px;padding:.12rem .42rem">${catTxt}</span>`:''}
          ${stars?`<span style="font-size:.8rem">${stars}</span>`:''}
          ${r.bookDate||r.date?`<span class="text-muted-xs">${r.bookDate||r.date}</span>`:''}
        </div>
      </div>

      <!-- 본문 내용 (항상 표시) -->
      <div style="display:flex;flex-direction:column;gap:.45rem;margin-bottom:.65rem">
        ${parseBookContent(r)}
      </div>

      <!-- 교사 코멘트 + 버튼 -->
      <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
        <input id="bk-comment-${r.id}" type="text" value="${escHtml(r.teacherComment||'')}"
          placeholder="✏️ 교사 코멘트 (선택)"
          style="flex:1;min-width:160px;padding:.38rem .65rem;border-radius:8px;
            border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);
            color:var(--txt1);font-family:inherit;font-size:.76rem">
        ${isPending
          ? `<button class="btn-sm success nowrap"
              onclick="confirmBookRecord('${r._sid}','${r.id}')">✅ 확인 승인</button>
             <button class="btn-sm" style="background:rgba(231,76,60,.15);color:var(--red);white-space:nowrap"
              onclick="deleteBookPending('${r._sid}','${r.id}')">🗑️</button>`
          : `<button class="btn-sm outline nowrap"
              onclick="saveBookComment('${r._sid}','${escJsAttr(r.bookTitle||r.title)}','${r.id}')">💾 코멘트 저장</button>
             <button class="btn-sm" style="background:rgba(231,76,60,.15);color:var(--red);white-space:nowrap"
              onclick="deleteBook('${r._sid}','${escJsAttr(r.bookTitle||r.title)}')">🗑️</button>`}
      </div>
    </div>`;
  };

  // ── 렌더 ────────────────────────────────────────────
  let html = '';

  // 대기 중 → 항상 상단에 펼쳐서 표시
  if (pendingRecs.length > 0) {
    html += `<div style="padding:.5rem 1rem .3rem;font-size:.75rem;font-weight:800;
      color:var(--gold);display:flex;align-items:center;gap:.5rem">
      ⏳ 확인 대기 <span style="background:var(--gold);color:#1a1a1a;border-radius:20px;
        padding:.05rem .5rem;font-size:.7rem">${pendingRecs.length}</span>
    </div>`;
    html += pendingRecs.map(r => bookCard(r, true)).join('');
    html += `<div style="margin:.5rem 1rem;border-bottom:1px solid rgba(255,255,255,.08)"></div>`;
  }

  // 완료된 기록
  if (doneRecs.length > 0) {
    if (pendingRecs.length > 0)
      html += `<div style="padding:.3rem 1rem .3rem;font-size:.72rem;font-weight:700;color:var(--txt3)">
        ✅ 확인된 기록 (${doneRecs.length})</div>`;
    html += doneRecs.map(r => bookCard(r, false)).join('');
  }

  if (!html) {
    html = `<div style="padding:2rem;text-align:center;color:var(--txt3)">조건에 맞는 독서 기록이 없어요</div>`;
  }
  el.innerHTML = html;
}

function confirmBookRecord(studentId, pendingId) {
  const s = DB.getStudent(studentId);
  if (!s) return;
  const idx = (s.pendingRewards||[]).findIndex(r => r.id === pendingId);
  if (idx < 0) { notify('❌ 해당 독서 기록을 찾을 수 없어요'); return; }
  const p = s.pendingRewards[idx];
  const comment = document.getElementById('bk-comment-' + pendingId)?.value.trim() || '';

  // 확장 필드 포함해서 books[]에 저장
  s.books = s.books || [];
  s.books.push({
    // [R5] id가 없으면 코멘트 입력칸 id가 'bk-comment-undefined'로 중복 생성되어
    //      교사 코멘트가 엉뚱한 책에 저장된다
    id: p.id || ('bk_' + Date.now() + '_' + s.id),
    title: p.bookTitle || p.label || '',
    category: p.category || '',
    customCategory: p.customCategory || '',
    rating: p.rating || 0,
    characterName: p.characterName || '',
    characterReason: p.characterReason || '',
    summary: p.summary || '',
    reflection: p.reflection || '',
    review: p.bookReview || '',
    date: p.bookDate || p.date || Utils.todayStr(),
    createdAt: p.createdAt || Date.now(),
    teacherChecked: true,
    teacherCheckedAt: Date.now(),
    teacherComment: comment,
  });
  s.bookCount = s.books.length;

  // EXP/골드/레벨 지급
  s.exp  = (s.exp||0)  + (p.exp||30);
  s.gold = (s.gold||0) + (p.gold||0);
  if ((p.gold||0) > 0) {
    s.totalGold = (s.totalGold||0) + p.gold; // [R7] 누적 골드
    // [GOLD-LOG-1] type 'book' 은 아직 GOLD_SOURCE_BY_TYPE 에 없어 **기록되지 않는다**(지급은 정상).
    //   호출을 미리 붙여 둔다 — 독서를 경로로 넣기로 하면 그 표에 한 줄만 더하면 된다.
    DB.logGold(s.id, DB.goldSourceOf(p.boardQuestType || p.type || 'book'), p.gold);
  }
  s.level = Utils.levelFromExp(s.exp);

  // 퀘스트 로그 저장
  DB.saveQuestLog({
    studentId: s.id,
    type: 'book',
    name: p.label || `📖 "${p.bookTitle}" 독서`,
    exp: p.exp||30, gold: p.gold||0,
    stat: '', statVal: 0,
    icon: '📚',
    date: Utils.todayStr(),
  });

  // pendingRewards에서 제거
  s.pendingRewards.splice(idx, 1);
  DB.saveStudent(s);
  notify(`✅ ${s.name}의 「${p.bookTitle}」 독서 기록 확인 완료!`);
  renderBooksPage();
  renderAll();
}

function saveBookComment(studentId, bookTitle, recId) {
  const comment = document.getElementById('bk-comment-' + recId)?.value.trim() || '';
  const s = DB.getStudent(studentId);
  if (!s) return;
  const b = (s.books||[]).find(bk => bk.title === bookTitle);
  if (!b) return;
  b.teacherComment = comment;
  b.teacherChecked = true;
  b.teacherCheckedAt = Date.now();
  DB.saveStudent(s);
  notify('💾 코멘트 저장!');
  renderBooksPage();
}

function deleteBookPending(studentId, pendingId) {
  if (!confirm('대기중인 독서 기록을 삭제할까요?')) return;
  const s = DB.getStudent(studentId);
  if (!s) return;
  s.pendingRewards = (s.pendingRewards||[]).filter(r => r.id !== pendingId);
  DB.saveStudent(s);
  renderBooksPage();
  notify('독서 대기 기록 삭제 완료');
}

function deleteBook(studentId, bookTitle) {
  if (!confirm(`"${bookTitle}" 독서 기록을 삭제할까요?`)) return;
  const s = DB.getStudent(studentId);
  if (!s) return;
  s.books = (s.books||[]).filter(b => b.title !== bookTitle);
  s.bookCount = s.books.length;
  DB.saveStudent(s);
  renderBooksPage();
  notify('독서 기록 삭제 완료');
}

