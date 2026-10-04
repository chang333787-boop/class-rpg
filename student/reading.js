// student/reading.js — 독서 기록
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'reading' — 원래 student.js 13867~14158줄 ──
// ══ 독서 기록 ══
// ── 독서 기록 제출 (승인 요청) ──
// ── 독서 폼 초기화 (탭 열릴 때 호출) ──
let _bookRating = 0;
let _bookCategory = '';

function initBookForm() {
  // 칩 버튼 렌더
  const chipsEl = document.getElementById('book-category-chips');
  if (chipsEl && chipsEl.children.length === 0) {
    ['우정','가족','용기','배려','꿈·성장','자연·생명','직접입력'].forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'book-chip';
      btn.textContent = c;
      btn.style.cssText = 'padding:.28rem .7rem;border-radius:20px;font-size:.72rem;cursor:pointer;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--txt2);font-family:inherit;transition:all .15s';
      btn.onclick = () => selectBookCategory(btn, c);
      chipsEl.appendChild(btn);
    });
  }
  // 별점 렌더
  const starsEl = document.getElementById('book-rating-stars');
  if (starsEl && starsEl.children.length === 0) {
    [1,2,3,4,5].forEach(n => {
      const span = document.createElement('span');
      span.textContent = '⭐';
      span.dataset.star = n;
      span.style.cssText = 'font-size:1.5rem;cursor:pointer;opacity:.28;transition:opacity .15s';
      span.onclick = () => selectBookRating(n);
      starsEl.appendChild(span);
    });
  }
}

function selectBookCategory(el, cat) {
  _bookCategory = cat;
  document.querySelectorAll('.book-chip').forEach(b => {
    b.style.background = 'rgba(255,255,255,.05)';
    b.style.borderColor = 'rgba(255,255,255,.15)';
    b.style.color = 'var(--txt2)';
  });
  el.style.background = 'rgba(255,215,0,.18)';
  el.style.borderColor = 'var(--gold)';
  el.style.color = 'var(--gold)';
  const customInput = document.getElementById('book-custom-category-input');
  if (customInput) customInput.style.display = cat === '직접입력' ? '' : 'none';
}

function selectBookRating(n) {
  _bookRating = n;
  document.querySelectorAll('#book-rating-stars span').forEach(s => {
    s.style.opacity = parseInt(s.dataset.star) <= n ? '1' : '.25';
  });
}

function submitBookRecord() {
  const title      = document.getElementById('book-title-input')?.value.trim() || '';
  const summary    = document.getElementById('book-summary-input')?.value.trim() || '';
  const reflection = document.getElementById('book-reflection-input')?.value.trim() || '';
  const date       = document.getElementById('book-date-input')?.value || Utils.todayStr();
  const customCat  = document.getElementById('book-custom-category-input')?.value.trim() || '';
  const charName   = document.getElementById('book-char-name-input')?.value.trim() || '';
  const charReason = document.getElementById('book-char-reason-input')?.value.trim() || '';

  if (!title)   { toast('책 제목을 입력해주세요!'); return; }
  if (!summary) { toast('줄거리를 써주세요!'); return; }
  if (!reflection) { toast('느낀 점을 써주세요!'); return; }

  const dupPending = (CUR.pendingRewards||[]).some(r => r.type==='book' && (r.bookTitle||'').trim() === title);
  const dupBooks   = (CUR.books||[]).some(b => (b.title||'').trim() === title);
  if (dupPending || dupBooks) { toast(`📚 "${title}"은 이미 등록된 책이에요!`); return; }

  CUR.pendingRewards = CUR.pendingRewards || [];
  CUR.pendingRewards.push({
    id: 'book_' + Date.now(),
    type: 'book',
    label: `📖 "${title}" 독서 기록`,
    bookTitle: title,
    category: _bookCategory,
    customCategory: _bookCategory === '직접입력' ? customCat : '',
    rating: _bookRating,
    characterName: charName,
    characterReason: charReason,
    summary,
    reflection,
    bookReview: summary + (charName ? `\n[인물: ${charName}${charReason?' — '+charReason:''}]` : '') + '\n' + reflection,
    bookDate: date,
    exp: 30, gold: 0,
    stat: '', statVal: 0,
    icon: '📚',
    date: Utils.todayStr(),
    createdAt: Date.now(),
    teacherChecked: false,
    teacherComment: '',
  });
  DB.saveStudent(CUR);

  // 폼 초기화
  ['book-title-input','book-custom-category-input','book-char-name-input','book-char-reason-input','book-summary-input','book-reflection-input'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const ci = document.getElementById('book-custom-category-input');
  if (ci) ci.style.display = 'none';
  document.querySelectorAll('.book-chip').forEach(b => {
    b.style.background='rgba(255,255,255,.05)'; b.style.borderColor='rgba(255,255,255,.15)'; b.style.color='var(--txt2)';
  });
  document.querySelectorAll('#book-rating-stars span').forEach(s => s.style.opacity = '.25');
  _bookRating = 0; _bookCategory = '';
  document.getElementById('book-date-input').value = '';

  toast('📚 독서 기록 제출! 선생님 확인 후 경험치가 지급돼요');
  renderBookRecords();
  renderMain(); renderMobile();
}

// ── 독서 기록 목록 렌더링 ──
function renderBookRecords() {
  const el = document.getElementById('book-record-list');
  if (!el) return;

  const books   = CUR.books || [];
  const pending = (CUR.pendingRewards||[]).filter(p=>p.type==='book');

  renderBookMonthlyChart(books);

  if (books.length === 0 && pending.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:1.5rem 0;color:var(--txt3);font-size:.8rem">
      아직 독서 기록이 없어요.<br>위에서 첫 번째 책을 기록해보세요! 📖</div>`;
    return;
  }

  const starStr = n => n ? '⭐'.repeat(n) : '';
  const catLabel = b => b.category === '직접입력' && b.customCategory ? b.customCategory : (b.category || '');

  const allRecords = [
    ...pending.map(p => ({ ...p, _status:'pending' })),
    ...books.slice().reverse().map(b => ({ ...b, _status:'done', bookTitle:b.title }))
  ];

  el.innerHTML = allRecords.map(r => {
    const isPending = r._status === 'pending';
    const cat = catLabel(r);

    // 구 형식(bookReview만 있는 경우) → 파싱
    let charName = r.characterName, charReason = r.characterReason;
    let summary = r.summary, reflection = r.reflection;
    const raw = r.bookReview || r.review || '';
    if (!summary && !reflection && raw) {
      const charMatch = raw.match(/\[인물:\s*([^\n\]—–-]+?)(?:\s*[—–-]\s*([^\n\]]+))?\]/);
      if (charMatch) { charName = charName || charMatch[1]?.trim(); charReason = charReason || (charMatch[2]?.trim()||''); }
      const cleanRaw = raw.replace(/\[인물:[^\]]*\]/g,'').trim();
      const lines = cleanRaw.split('\n').filter(l=>l.trim());
      if (lines.length >= 2) {
        summary    = lines.slice(0, Math.ceil(lines.length/2)).join('\n');
        reflection = lines.slice(Math.ceil(lines.length/2)).join('\n');
      } else { summary = cleanRaw; }
    }

    return `
    <div style="background:rgba(255,255,255,.04);
      border:1px solid ${isPending?'rgba(255,215,0,.2)':'rgba(46,204,113,.2)'};
      border-radius:12px;padding:.8rem .9rem;margin-bottom:.5rem">
      <!-- 헤더 -->
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
        <span style="font-size:.68rem;font-weight:700;
          background:${isPending?'rgba(255,215,0,.12)':'rgba(46,204,113,.12)'};
          color:${isPending?'var(--gold)':'var(--emerald)'};
          border-radius:20px;padding:.1rem .5rem;flex-shrink:0">
          ${isPending?'확인 중':'✓ 완료'}</span>
        <span style="font-weight:700;font-size:.88rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escHtml(r.bookTitle||r.title||'')}</span>
        ${cat?`<span style="font-size:.65rem;background:rgba(93,173,226,.12);color:var(--sky);border-radius:10px;padding:.1rem .45rem;flex-shrink:0">${cat}</span>`:''}
        ${r.rating?`<span style="font-size:.75rem;flex-shrink:0">${starStr(r.rating)}</span>`:''}
        <span style="font-size:.66rem;color:var(--txt3);flex-shrink:0">${r.bookDate||r.date||''}</span>
      </div>
      <!-- 내용 (항상 표시) -->
      <div style="display:flex;flex-direction:column;gap:.35rem;font-size:.78rem;color:var(--txt2);line-height:1.6">
        ${charName?`<div><b style="color:var(--txt3)">🧑 인상 깊은 인물:</b> ${escHtml(charName)}${charReason?' — '+escHtml(charReason):''}</div>`:''}
        ${summary?`<div><b style="color:var(--txt3)">📖 줄거리:</b><div style="margin-top:.1rem;white-space:pre-wrap">${escHtml(summary)}</div></div>`:''}
        ${reflection?`<div><b style="color:var(--txt3)">💬 느낀 점:</b><div style="margin-top:.1rem;white-space:pre-wrap">${escHtml(reflection)}</div></div>`:''}
      </div>
      ${r.teacherComment?`<div style="margin-top:.45rem;font-size:.72rem;color:var(--emerald);
        background:rgba(46,204,113,.08);border-radius:8px;padding:.3rem .5rem">
        💬 선생님: ${escHtml(r.teacherComment)}</div>`:''}
    </div>`;
  }).join('');
}

// 월별 독서 막대그래프
function renderBookMonthlyChart(books) {
  const chartEl  = document.getElementById('book-monthly-chart');
  const labelEl  = document.getElementById('book-monthly-labels');
  if (!chartEl || !labelEl) return;

  // 3월~12월 고정
  const now = new Date();
  const months = [];
  for (let mo=3; mo<=12; mo++) {
    months.push({ key: now.getFullYear()+'-'+mo, label: mo+'월', count: 0 });
  }
  books.forEach(b => {
    if (!b.date) return;
    const parts = b.date.split('-');
    if (parts.length < 2) return;
    const key = parts[0]+'-'+parseInt(parts[1]);
    const mo = months.find(x=>x.key===key);
    if (mo) mo.count++;
  });

  const max = Math.max(...months.map(m=>m.count), 1);
  const barW = 'calc('+(100/months.length)+'% - 4px)';

  chartEl.innerHTML = months.map(m => {
    const h = Math.max(4, Math.round((m.count/max)*72));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px">
      ${m.count>0?`<span style="font-size:.65rem;color:var(--gold);font-weight:700">${m.count}</span>`:''}
      <div style="width:100%;height:${h}px;border-radius:4px 4px 0 0;
        background:${m.count>0?'rgba(255,215,0,.6)':'rgba(255,255,255,.08)'};transition:height .3s"></div>
    </div>`;
  }).join('');

  labelEl.innerHTML = months.map(m =>
    `<div style="flex:1;text-align:center;font-size:.62rem;color:var(--txt3)">${m.label}</div>`
  ).join('');
}

// 구버전 toggleBookAdd/addBook/removeBook — 호환성 유지
function toggleBookAdd() {}
function addBook() {}
function removeBook(idx) {}

function renderQuestModal() {
  const quests = DB.getQuests().filter(q => q.studentId === CUR.id);
  // [QUEST-REWARD-TAB-1] 승인 대기는 '내 보상' 창(renderRewardList)과 같은 기준·같은 말(⏳ 기다리는 중).
  //   전엔 selfApplied(아무 데서도 안 세움) 때문에 대기 항목이 전부 '🎁 받기 가능'으로 보였다.
  const pending = (CUR.pendingRewards||[]).filter(r => !r.approved);
  const all = [
    ...pending.map(p => ({
      name:p.label, status:'wait',
      exp:p.exp, gold:p.gold, date:p.date||'오늘', icon:p.icon||'🎉'
    })),
    ...quests.slice(-10).reverse().map(q => ({
      name:q.name, status:'done', exp:q.exp, gold:q.gold, date:q.date, icon:q.icon||'📋'
    }))
  ];
  const claimBtn = ''; // 보상 자동 지급으로 받기 버튼 제거
  const statusLabel = {
    wait:  `<span class="qr-status waiting">⏳ 기다리는 중</span>`,
    done:  `<span class="qr-status approved">✅ 완료</span>`,
  };
  document.getElementById('quest-list').innerHTML = (claimBtn||'') + (all.length > 0
    ? all.map(q => `<div class="quest-row">
        <div class="qr-icon">${q.icon}</div>
        <div class="qr-body"><div class="qr-name">${escHtml(q.name)}</div><div class="qr-desc">${q.date||''}</div></div>
        <div class="qr-right">
          ${statusLabel[q.status]||statusLabel.done}
          <span class="qr-rewards">${q.exp>0?`+${q.exp}EXP · `:''}${q.gold>0?`+${q.gold}G`:''}</span>
        </div>
      </div>`).join('')
    : `<div style="color:var(--txt3);font-size:.82rem;padding:1rem 0">아직 활동 내역이 없어요<br>
       <span style="font-size:.72rem">📋 퀘스트 게시판에서 퀘스트를 해 보세요!</span></div>`);
}

function renderPromoModal() {
  const s = CUR;
  const alreadyRequested = DB.getPromotionRequests().find(r => r.studentId === s.id);
  document.getElementById('promo-body').innerHTML = alreadyRequested ? `
    <div class="promo-emoji">⌛</div>
    <div style="font-weight:700;font-size:1.1rem;color:var(--gold);margin-bottom:.5rem">승급 신청 완료!</div>
    <div style="font-size:.85rem;color:var(--txt2)">선생님이 확인 후 승급을 승인해 드릴 거예요.</div>
    <div style="font-size:.75rem;color:var(--txt3);margin-top:.5rem">현재 레벨: Lv.${s.level}</div>
  ` : `
    <div class="promo-emoji">⬆️</div>
    <div style="font-weight:700;font-size:1.1rem;color:var(--gold);margin-bottom:.5rem">Lv.${s.level} 승급 가능!</div>
    <div style="font-size:.85rem;color:var(--txt2);margin-bottom:1rem">
      선생님께 승급을 신청하면 확인 후 승급이 완료돼요.<br>승급 시 특별 보상을 받을 수 있어요! 🎉
    </div>
    <button class="btn-gold" onclick="requestPromotion()" style="padding:.7rem 2rem">📨 승급 신청하기</button>
  `;
}

function requestPromotion() {
  const req = { id: Utils.uid(), studentId: CUR.id, studentName: CUR.name, level: CUR.level, date: Utils.todayStr() };
  const ok = DB.addPromotionRequest(req);
  if (!ok) { toast('이미 승급 신청이 되어 있어요.'); return; }
  CUR.promotionPending = true;
  DB.saveStudent(CUR);
  renderPromoModal();
  renderMain(); renderMobile(); renderHUD();
  toast('📨 승급 신청 완료! 선생님의 확인을 기다려주세요.');
}

