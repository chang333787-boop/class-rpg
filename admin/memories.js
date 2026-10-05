// admin/memories.js — 추억 관리(앨범·여러 장 올리기·이름 바꾸기) · 업적 재계산 · 주간 다짐 · 중복 정리·작품 키 정리·작품 내리기/지우기
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'memories' — 원래 admin.js 3015~3910줄 ──
// ══ 추억 관리 ══
function compressAdmMemImage(file, maxSize, quality) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let {width:w, height:h} = img;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = h/w*maxSize; w = maxSize; }
          else { w = w/h*maxSize; h = maxSize; }
        }
        canvas.width = Math.round(w); canvas.height = Math.round(h);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => resolve(b), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ──────────────────────────────────────────────────────
//  추억 앨범 관리
// ──────────────────────────────────────────────────────
let _memPendingFiles = []; // 업로드 대기 파일 목록

function createAlbum() {
  const name = document.getElementById('album-name-input')?.value.trim();
  const date = document.getElementById('album-date-input')?.value || Utils.todayStr();
  const desc = document.getElementById('album-desc-input')?.value.trim() || '';
  if (!name) { notify('앨범 이름을 입력해주세요', 'error'); return; }
  DB.saveAlbum({ id:'alb_'+Date.now(), name, date, desc });
  ['album-name-input','album-desc-input'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  notify('📁 앨범 "'+name+'" 생성!');
  renderAlbumList();
  renderMemoriesPage();
}

function renderAlbumList() {
  const el = document.getElementById('album-list');
  if (!el) return;
  const albums = [...DB.getAlbums()].sort((a,b)=>(b.date||'').localeCompare(a.date||''));   // [CACHE-SORT-1] 복사 뒤 정렬
  el.innerHTML = albums.length === 0
    ? `<div style="font-size:.78rem;color:var(--txt3)">앨범 없음 — 위에서 추가하세요</div>`
    : albums.map(a => {
        const cnt = DB.getMemories('all').filter(m=>m.albumId===a.id).length;
        return `<div style="display:inline-flex;align-items:center;gap:.4rem;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
          border-radius:20px;padding:.25rem .7rem .25rem .55rem;font-size:.78rem">
          <span>📁</span>
          <span style="font-weight:700">${escHtml(a.name)}</span>
          <span style="color:var(--txt3);font-size:.68rem">${a.date||''}</span>
          <span style="background:rgba(255,215,0,.15);color:var(--gold);border-radius:10px;
            padding:.05rem .35rem;font-size:.65rem">${cnt}장</span>
          <button onclick="deleteAlbum('${a.id}')" style="background:none;border:none;
            color:var(--txt3);cursor:pointer;font-size:.7rem;padding:0">✕</button>
        </div>`;
      }).join('');

  // 앨범 셀렉트도 갱신
  const sel = document.getElementById('adm-mem-album');
  const selFilter = document.getElementById('mem-filter-album');
  if (sel) {
    sel.innerHTML = '<option value="">앨범 없음 (미분류)</option>' +
      albums.map(a=>`<option value="${a.id}">${escHtml(a.name)} (${a.date||''})</option>`).join('');
  }
  if (selFilter) {
    const cur = selFilter.value;
    selFilter.innerHTML = '<option value="all">전체 앨범</option><option value="none">미분류</option>' +
      albums.map(a=>`<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
    selFilter.value = cur;
  }
}

function deleteAlbum(id) {
  if (!confirm('앨범을 삭제할까요? 사진은 삭제되지 않고 미분류로 이동합니다.')) return;
  DB.deleteAlbum(id);
  notify('앨범 삭제 완료');
  renderAlbumList();
  renderMemoriesPage();
}

// ── 다중 파일 선택 / 드래그앤드롭 ──────────────────────
function onMemDrop(e) {
  e.preventDefault();
  document.getElementById('adm-mem-drop-zone').style.borderColor = 'rgba(255,255,255,.2)';
  onMemFilesSelect(e.dataTransfer.files);
}

document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('adm-mem-drop-zone');
  if (zone) zone.onclick = () => document.getElementById('adm-mem-files').click();
});

function onMemFilesSelect(files) {
  if (!files || !files.length) return;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (_memPendingFiles.find(x=>x.name===f.name && x.size===f.size)) continue;
    _memPendingFiles.push(f);
  }
  renderMemPreviews();
}

function renderMemPreviews() {
  const wrap = document.getElementById('adm-mem-previews');
  if (!wrap) return;
  if (_memPendingFiles.length === 0) { wrap.innerHTML=''; return; }
  wrap.innerHTML = _memPendingFiles.map((f,i) => {
    const url = URL.createObjectURL(f);
    return `<div style="position:relative;width:80px;height:80px">
      <img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">
      <button onclick="removeMemFile(${i})" style="position:absolute;top:-4px;right:-4px;
        background:rgba(231,76,60,.85);border:none;color:#fff;border-radius:50%;
        width:18px;height:18px;font-size:.65rem;cursor:pointer;line-height:1;
        display:flex;align-items:center;justify-content:center">✕</button>
      <div style="position:absolute;bottom:0;left:0;right:0;font-size:.5rem;color:#fff;
        background:rgba(0,0,0,.6);padding:.1rem .2rem;border-radius:0 0 8px 8px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
    </div>`;
  }).join('');
}

function removeMemFile(idx) {
  _memPendingFiles.splice(idx,1);
  renderMemPreviews();
}

function clearMemPreviews() {
  _memPendingFiles = [];
  document.getElementById('adm-mem-files').value = '';
  renderMemPreviews();
}

// ── 다중 업로드 실행 ────────────────────────────────────
async function adminUploadMemories() {
  if (_memPendingFiles.length === 0) { notify('사진을 선택해주세요', 'error'); return; }
  const albumId    = document.getElementById('adm-mem-album')?.value || '';
  const eventTitle = document.getElementById('adm-mem-event-title')?.value.trim() || '';
  const eventDate  = document.getElementById('adm-mem-event-date')?.value || Utils.todayStr();
  const albumName  = albumId ? (DB.getAlbums().find(a=>a.id===albumId)?.name||'') : '';

  const total = _memPendingFiles.length;
  const progBar  = document.getElementById('adm-mem-prog-bar');
  const progTxt  = document.getElementById('adm-mem-prog-text');
  const progWrap = document.getElementById('adm-mem-progress');
  progWrap.style.display = '';
  progBar.style.width = '0%';

  let done = 0, failed = 0;
  for (const file of [..._memPendingFiles]) {
    progTxt.textContent = `업로드 중 ${done+1}/${total} — ${file.name}`;
    try {
      const [imgBlob, thumbBlob] = await Promise.all([
        compressAdmMemImage(file, 1600, 0.78),
        compressAdmMemImage(file, 500,  0.70),
      ]);
      const storage = firebase.storage();
      const ts = Date.now() + done;
      const imgRef   = storage.ref(`memories/adm_${ts}.jpg`);
      const thumbRef = storage.ref(`memories/adm_${ts}_thumb.jpg`);
      await imgRef.put(imgBlob);
      await thumbRef.put(thumbBlob);
      const [imageUrl, thumbUrl] = await Promise.all([imgRef.getDownloadURL(), thumbRef.getDownloadURL()]);
      // 제목: 이벤트 이름 있으면 "이벤트명 1", 없으면 파일명 기반
      const idx = _memPendingFiles.indexOf(file) + 1;
      const title = eventTitle ? (total>1 ? `${eventTitle} (${idx})` : eventTitle)
                               : file.name.replace(/\.[^.]+$/,'');
      DB.saveMemory({
        id: 'mem_adm_'+ts,
        uploadedBy: 'admin',
        studentId: null,
        title,
        desc: '',
        imageUrl, thumbUrl,
        albumId: albumId || null,
        albumName,
        visibilityType: 'public',
        approvalStatus: 'approved',
        monthKey: eventDate.slice(0,7),
        createdAt: ts,
        date: eventDate,
      });
      done++;
    } catch(e) {
      failed++;
      console.error('업로드 실패:', file.name, e);
    }
    progBar.style.width = Math.round((done+failed)/total*100)+'%';
  }

  progWrap.style.display = 'none';
  clearMemPreviews();
  document.getElementById('adm-mem-event-title').value = '';
  notify(`📸 ${done}장 업로드 완료!${failed?` (실패 ${failed}장)`:''}`);
  renderMemoriesPage();
  renderAlbumList();
}

function renderMemoriesPage() {
  // 앨범 목록 갱신
  renderAlbumList();

  const el = document.getElementById('memories-list');
  if (!el) return;
  const albumF  = document.getElementById('mem-filter-album')?.value || 'all';
  const statusF = document.getElementById('mem-filter-status')?.value || 'all';
  const typeF   = document.getElementById('mem-filter-type')?.value   || 'all';

  let mems = DB.getMemories('all');
  if (albumF === 'none')       mems = mems.filter(m=>!m.albumId);
  else if (albumF !== 'all')   mems = mems.filter(m=>m.albumId===albumF);
  if (statusF !== 'all')       mems = mems.filter(m=>m.approvalStatus===statusF);
  if (typeF === 'admin')        mems = mems.filter(m=>m.uploadedBy==='admin');
  if (typeF === 'student')      mems = mems.filter(m=>m.uploadedBy!=='admin');
  // [CACHE-SORT-1] 필터가 모두 '전체'면 mems 는 DB.getMemories('all') 이 돌려준 **캐시 배열 그 자체**다.
  //   제자리 정렬하면 캐시가 뒤섞이고, saveMemory/saveAlbum 이 배열을 통째로 set 해 **재배치된 순서가 운영 DB 에 저장**된다(#228 과 같은 종류).
  mems = [...mems].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  // 앨범 목록 (셀렉트 옵션용)
  const albums = [...DB.getAlbums()].sort((a,b)=>(b.date||'').localeCompare(a.date||''));   // [CACHE-SORT-1] 복사 뒤 정렬

  if (mems.length === 0) {
    el.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--txt3)">추억 사진이 없어요</div>`;
    return;
  }

  const statusLabel = { pending:'⏳ 대기', approved:'✅ 공개', rejected:'❌ 반려' };
  const statusColor = { pending:'var(--gold)', approved:'var(--emerald)', rejected:'var(--red)' };

  el.innerHTML = mems.map(m => `
    <div style="display:flex;align-items:center;gap:.8rem;padding:.65rem 1.2rem;
      border-bottom:1px solid rgba(255,255,255,.05)">
      <!-- 썸네일 (클릭→다운로드) -->
      <a href="${escHtml(safeUrl(m.imageUrl||m.thumbUrl))}" download target="_blank" title="클릭하면 원본 다운로드"
        style="flex-shrink:0;display:block;position:relative">
        <img src="${escHtml(m.thumbUrl||m.imageUrl)}"
          style="width:60px;height:60px;border-radius:8px;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,.35);border-radius:8px;
          display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s"
          onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">
          <span style="font-size:.8rem">⬇️</span></div>
      </a>
      <div style="flex:1;min-width:0">
        <!-- 제목 인라인 편집 -->
        <div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.15rem">
          <input id="mem-title-inp-${m.id}"
            value="${escHtml(m.title||'')}"
            style="font-size:.82rem;font-weight:700;flex:1;min-width:0;
              background:transparent;border:none;border-bottom:1px solid transparent;
              color:var(--txt1);padding:.05rem .1rem;font-family:inherit;
              outline:none;cursor:text"
            onfocus="this.style.borderBottomColor='var(--gold)'"
            onblur="this.style.borderBottomColor='transparent';saveMemTitle('${m.id}',this.value)"
            onkeydown="if(event.key==='Enter'){this.blur()}"
            placeholder="폴더 이름 입력">
        </div>
        <div class="text-muted-xs">
          ${m.uploadedBy==='admin'?'관리자':'👤 '+(m.studentName||'')} · ${m.date||''}
        </div>
        <!-- 앨범 지정 셀렉트 -->
        <div style="margin-top:.35rem;display:flex;align-items:center;gap:.35rem">
          <select id="mem-album-sel-${m.id}"
            style="font-size:.7rem;padding:.18rem .4rem;border-radius:7px;
              border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);
              color:var(--txt1);font-family:inherit;max-width:160px"
            onchange="assignMemAlbum('${m.id}',this.value)">
            <option value="">📂 미분류</option>
            ${albums.map(a=>`<option value="${a.id}" ${m.albumId===a.id?'selected':''}>${escHtml(a.name)}</option>`).join('')}
          </select>
          ${m.albumId?`<span style="font-size:.65rem;color:var(--gold)">📁 ${m.albumName||''}</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;flex-shrink:0">
        <span style="font-size:.7rem;color:${statusColor[m.approvalStatus]||'var(--txt3)'};font-weight:700">
          ${statusLabel[m.approvalStatus]||m.approvalStatus}</span>
        <div style="display:flex;gap:.3rem">
          ${m.approvalStatus==='pending'?`
            <button class="btn-sm success" onclick="approveMemory('${m.id}')">✅ 승인</button>
            <button class="btn-sm" style="background:rgba(231,76,60,.15);color:var(--red)" onclick="rejectMemory('${m.id}')">❌</button>`
          : m.approvalStatus==='approved'?`
            <button class="btn-sm outline" onclick="rejectMemory('${m.id}')">내리기</button>`:''}
          <button class="btn-sm" style="background:rgba(231,76,60,.1);color:var(--red)" onclick="deleteMemory('${m.id}')">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

function saveMemTitle(memId, newTitle) {
  const t = (newTitle || '').trim();
  if (!t) return;
  const mems = DB.getMemories('all');
  const m = mems.find(x => x.id === memId);
  if (!m || m.title === t) return;
  DB.saveMemory({ id: memId, title: t, desc: t });
  notify('✅ 제목 변경: ' + t);
}

// ── 일괄 이름 변경 ────────────────────────────────────
function renderBulkRenameList() {
  const wrap = document.getElementById('bulk-rename-list');
  if (!wrap) return;
  const filter = document.getElementById('bulk-rename-filter')?.value || 'kakao';
  const mems = [...DB.getMemories('all')].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));   // [CACHE-SORT-1] 복사 뒤 정렬

  const candidates = mems.filter(m => {
    const t = (m.title || '').toLowerCase();
    if (filter === 'kakao')  return t.startsWith('kakaotalk') || t.startsWith('kakao');
    if (filter === 'noname') return !m.title || m.title.trim() === '';
    return true; // all
  });

  if (candidates.length === 0) {
    wrap.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--txt3);font-size:.78rem">
      해당하는 사진이 없어요</div>`;
    updateBulkCount();
    return;
  }

  wrap.innerHTML = candidates.map(m => `
    <label style="display:flex;align-items:center;gap:.6rem;padding:.45rem .8rem;
      border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer">
      <input type="checkbox" class="bulk-chk" data-id="${m.id}" checked
        onchange="updateBulkCount()"
        style="width:15px;height:15px;flex-shrink:0;accent-color:var(--gold)">
      <img src="${escHtml(m.thumbUrl||m.imageUrl)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:.75rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          color:${(m.title||'').toLowerCase().startsWith('kakao')?'var(--red)':'var(--txt1)'}">
          ${escHtml(m.title||'(제목없음)')}
        </div>
        <div style="font-size:.65rem;color:var(--txt3)">${m.date||''} · ${m.uploadedBy==='admin'?'관리자':'학생'}</div>
      </div>
    </label>`).join('');
  updateBulkCount();
}

function updateBulkCount() {
  const cnt = document.querySelectorAll('.bulk-chk:checked').length;
  const el = document.getElementById('bulk-selected-count');
  if (el) el.textContent = cnt + '장 선택됨';
}

function toggleBulkSelectAll() {
  const all = document.querySelectorAll('.bulk-chk');
  const anyUnchecked = [...all].some(c => !c.checked);
  all.forEach(c => { c.checked = anyUnchecked; });
  updateBulkCount();
}

function applyBulkRename() {
  const folder = document.getElementById('bulk-rename-input')?.value.trim();
  if (!folder) { notify('📁 새 폴더 이름을 입력해주세요', 'error'); return; }
  const checked = [...document.querySelectorAll('.bulk-chk:checked')];
  if (checked.length === 0) { notify('사진을 선택해주세요', 'error'); return; }
  if (!confirm(`선택한 ${checked.length}장의 제목을 "${folder}"로 변경할까요?`)) return;

  const total = checked.length;
  checked.forEach((chk, i) => {
    const title = total > 1 ? `${folder} (${i+1})` : folder;
    DB.saveMemory({ id: chk.dataset.id, title, desc: folder });
  });

  notify(`✅ ${total}장 → "${folder}" 변경 완료!`);
  document.getElementById('bulk-rename-input').value = '';
  renderBulkRenameList();
  renderMemoriesPage();
}

function assignMemAlbum(memId, albumId) {
  const albums = DB.getAlbums();
  const album  = albumId ? albums.find(a=>a.id===albumId) : null;
  DB.saveMemory({ id:memId, albumId: albumId||null, albumName: album?.name||'' });
  notify(album ? `📁 "${album.name}" 앨범으로 이동!` : '미분류로 변경');
  renderMemoriesPage();
}

function approveMemory(id) {
  DB.saveMemory({ id, approvalStatus:'approved', approvedAt: Date.now() });
  notify('✅ 승인 완료! 키오스크에 공개돼요');
  renderMemoriesPage();
}
function rejectMemory(id) {
  DB.saveMemory({ id, approvalStatus:'rejected' });
  notify('❌ 반려 처리');
  renderMemoriesPage();
}
function deleteMemory(id) {
  if (!confirm('이 추억 사진을 삭제할까요?')) return;
  DB.deleteMemory(id);
  renderMemoriesPage();
  notify('삭제 완료');
}

// ── [RECORDER-CUT-1] 여기 있던 리코더 관리(renderRecorderPage·곡 목록·학생 연습 기록·교사 코멘트)는 10-05 걷어냄 ──
//   교사 쪽만 있고 아이가 기록할 길은 열린 적이 없었다(운영 recorderLogs·recorderSongs = null, 09-15 확인). 기록·백업 목록은 그대로.
//   아이의 리코더 연습은 음악실 앱(music/ · 리코더 기록장 #/log)이 맡는다.

// ── 단어 탐색 + 선택 ─────────────────────────────────
let SELECTED_WORD_IDS = new Set();




function recalcAllAchievements() {
  if (!confirm('전체 학생 업적을 현재 데이터 기준으로 재계산할까요?\n이미 달성한 업적은 중복 지급되지 않습니다.')) return;
  const students = DB.getStudents();
  let totalNew = 0;
  const log = [];
  students.forEach(s => {
    const newOnes = AchievementUtils.checkNew(s);
    if (newOnes.length > 0) {
      totalNew += newOnes.length;
      log.push(`${s.name}: +${newOnes.length}개 (${newOnes.map(a=>a.name).join(', ')})`);
      DB.saveStudent(s);
    }
  });
  notify(`🏅 재계산 완료! 전체 ${totalNew}개 업적 신규 달성\n${log.slice(0,5).join('\n')}${log.length>5?`\n...외 ${log.length-5}명`:''}`);
}

function recalcOneAchievement() {
  const sel = document.getElementById('ach-recalc-stu');
  const stuId = sel?.value;
  if (!stuId) { notify('학생을 선택해주세요', 'error'); return; }
  const students = DB.getStudents();
  const s = students.find(x=>x.id===stuId);
  if (!s) return;
  const newOnes = AchievementUtils.checkNew(s);
  DB.saveStudent(s);
  if (newOnes.length > 0) notify(`🏅 ${s.name}: ${newOnes.length}개 업적 달성!\n${newOnes.map(a=>a.icon+' '+a.name).join(', ')}`);
  else notify(`${s.name}: 새로 달성한 업적 없음`);
}

// 학생 선택 셀렉트 초기화 (업적 재계산용)
function initAchRecalcSelect() {
  const sel = document.getElementById('ach-recalc-stu');
  if (!sel || sel.options.length > 1) return;
  DB.getStudents().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.avatar + ' ' + s.name;
    sel.appendChild(opt);
  });
}

function renderWeeklyAdminPage() {
  const db       = DB.load();
  const students = DB.getStudents();
  const allGoals = db.weeklyGoals || [];
  const allRefls = db.weeklyReflections || [];

  // 이번 주 키 계산 - Utils.weekKey()와 동일한 2026-W14 형식 사용
  const _wkNow = new Date(Date.now()+9*3600000);
  const _wkDay = _wkNow.getUTCDay();
  const _wkMon = new Date(_wkNow);
  _wkMon.setUTCDate(_wkNow.getUTCDate() + (_wkDay===0?-6:1-_wkDay));
  const _wkJan1 = new Date(Date.UTC(_wkMon.getUTCFullYear(),0,1));
  const _wkNum = Math.ceil(((_wkMon-_wkJan1)/86400000+_wkJan1.getUTCDay()+1)/7);
  const thisWeek = `${_wkMon.getUTCFullYear()}-W${String(_wkNum).padStart(2,'0')}`;

  // 학생 필터 셀렉트 초기화
  const stuSel = document.getElementById('wka-filter-stu');
  if (stuSel && stuSel.options.length === 1) {
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.avatar + ' ' + s.name;
      stuSel.appendChild(o);
    });
  }

  // 주차 셀렉트 초기화
  const weekSel = document.getElementById('wka-filter-week');
  const allWeeks = [...new Set([...allGoals, ...allRefls].map(r=>r.weekKey).filter(Boolean))].sort().reverse();
  if (weekSel && weekSel.options.length === 1) {
    allWeeks.forEach(wk => {
      const o = document.createElement('option');
      o.value = wk; o.textContent = wk + ' 주';
      weekSel.appendChild(o);
    });
  }

  const filterStu  = stuSel?.value  || 'all';
  const filterWeek = weekSel?.value || 'all';
  const filterType = document.getElementById('wka-filter-type')?.value || 'all';

  // 이번 주 현황
  const thisGoals = allGoals.filter(g=>g.weekKey===thisWeek);
  const thisRefls = allRefls.filter(r=>r.weekKey===thisWeek);
  const monDone   = students.filter(s=>thisGoals.some(g=>g.studentId===s.id));
  const friDone   = students.filter(s=>thisRefls.some(r=>r.studentId===s.id));
  const bothDone  = students.filter(s=>monDone.find(x=>x.id===s.id)&&friDone.find(x=>x.id===s.id));
  const monOnly   = monDone.filter(s=>!friDone.find(x=>x.id===s.id));
  const noDone    = students.filter(s=>!monDone.find(x=>x.id===s.id));

  const thisWeekEl = document.getElementById('weekly-this-week');
  if (thisWeekEl) {
    thisWeekEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;margin-bottom:.8rem">
        <div class="text-center">
          <div style="font-size:1.4rem;font-weight:700;color:var(--emerald)">${bothDone.length}</div>
          <div class="text-muted-tiny">월+금 완료</div>
        </div>
        <div class="text-center">
          <div style="font-size:1.4rem;font-weight:700;color:var(--sky)">${monDone.length}</div>
          <div class="text-muted-tiny">월요일 작성</div>
        </div>
        <div class="text-center">
          <div style="font-size:1.4rem;font-weight:700;color:var(--gold)">${friDone.length}</div>
          <div class="text-muted-tiny">금요일 작성</div>
        </div>
        <div class="text-center">
          <div style="font-size:1.4rem;font-weight:700;color:var(--red)">${noDone.length}</div>
          <div class="text-muted-tiny">미작성</div>
        </div>
      </div>
      <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.3rem">이번 주 (${thisWeek}) 월요일 완료</div>
      <div style="display:flex;flex-wrap:wrap;gap:.3rem">
        ${monDone.length===0?'<span class="text-muted-base">없음</span>':
          monDone.map(s=>`<span style="font-size:.75rem;background:rgba(93,173,226,.12);
            color:var(--sky);border-radius:20px;padding:.15rem .55rem">${s.avatar} ${escHtml(s.name)}</span>`).join('')}
      </div>`;
  }

  // 미완료 학생
  const incEl = document.getElementById('weekly-incomplete');
  if (incEl) {
    if (noDone.length === 0) {
      incEl.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--emerald);font-size:.85rem">✅ 이번 주 전원 작성 완료!</div>';
    } else {
      incEl.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:.35rem;padding:.6rem 1.2rem">
        ${noDone.map(s=>`<span style="font-size:.78rem;background:rgba(231,76,60,.1);
          color:var(--red);border-radius:20px;padding:.2rem .6rem;border:1px solid rgba(231,76,60,.2)">
          ${s.avatar} ${escHtml(s.name)}</span>`).join('')}
      </div>`;
    }
  }

  // 기록 목록
  const listEl = document.getElementById('weekly-admin-list');
  if (!listEl) return;

  let targetStudents = filterStu==='all' ? students : students.filter(s=>s.id===filterStu);
  const targetWeeks  = filterWeek==='all' ? allWeeks : [filterWeek];

  let rows = [];
  targetStudents.forEach(s => {
    targetWeeks.forEach(wk => {
      const goal = allGoals.find(g=>g.studentId===s.id&&g.weekKey===wk);
      const refl = allRefls.find(r=>r.studentId===s.id&&r.weekKey===wk);
      if (filterType==='both'       && !(goal&&refl)) return;
      if (filterType==='monday_only'&& !(goal&&!refl)) return;
      if (filterType==='none'       && (goal||refl))   return;
      if (!goal && !refl) return; // 필터 none 아니면 빈 행 제외
      rows.push({ s, wk, goal, refl });
    });
  });

  if (rows.length === 0) {
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt3)">조건에 맞는 기록이 없어요</div>';
    return;
  }

  listEl.innerHTML = rows.map(({ s, wk, goal, refl }) => {
    const moodEmoji = ['😢','😔','😐','😊','😄'];
    return `
    <div style="border-bottom:1px solid rgba(255,255,255,.05);padding:.8rem 1.2rem">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap">
        <span>${s.avatar}</span>
        <span style="font-weight:700;font-size:.88rem">${escHtml(s.name)}</span>
        <span style="font-size:.72rem;color:var(--txt3);background:rgba(255,255,255,.06);
          border-radius:20px;padding:.1rem .45rem">${wk} 주</span>
        ${goal?'<span style="font-size:.68rem;color:var(--sky);background:rgba(93,173,226,.1);border-radius:20px;padding:.1rem .45rem">📅 월 작성</span>':''}
        ${refl?'<span style="font-size:.68rem;color:var(--emerald);background:rgba(46,204,113,.1);border-radius:20px;padding:.1rem .45rem">📅 금 작성</span>':''}
      </div>
      ${goal?`
      <div style="background:rgba(93,173,226,.06);border-left:3px solid rgba(93,173,226,.3);
        border-radius:0 8px 8px 0;padding:.5rem .75rem;margin-bottom:.4rem">
        <div style="font-size:.65rem;color:var(--sky);font-weight:700;margin-bottom:.3rem">📅 월요일 다짐</div>
        ${goal.weekendText?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">🗓 주말: ${escHtml(goal.weekendText)}</div>`:''}
        ${goal.weekendMood!=null?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">기분: ${moodEmoji[goal.weekendMood]||''}</div>`:''}
        ${goal.focusArea?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">🎯 노력영역: ${escHtml(goal.focusArea)}</div>`:''}
        ${goal.goalText?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">📌 목표: ${escHtml(goal.goalText)}</div>`:''}
        ${goal.mindset?`<div style="font-size:.75rem;color:var(--txt2)">💭 마음가짐: ${escHtml(goal.mindset)}</div>`:''}
      </div>`:''}
      ${refl?`
      <div style="background:rgba(46,204,113,.06);border-left:3px solid rgba(46,204,113,.3);
        border-radius:0 8px 8px 0;padding:.5rem .75rem">
        <div style="font-size:.65rem;color:var(--emerald);font-weight:700;margin-bottom:.3rem">📅 금요일 돌아보기</div>
        ${refl.focusReflection?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">노력: ${escHtml(refl.focusReflection)}</div>`:''}
        ${refl.goalReflection?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">목표: ${escHtml(refl.goalReflection)}</div>`:''}
        ${refl.bestMoment?`<div style="font-size:.75rem;color:var(--txt2);margin-bottom:.2rem">✨ 잘한 점: ${escHtml(refl.bestMoment)}</div>`:''}
        ${refl.nextWeekGoal?`<div style="font-size:.75rem;color:var(--txt2)">다음 주 목표: ${escHtml(refl.nextWeekGoal)}</div>`:''}
      </div>`:''}
    </div>`;
  }).join('');
}


async function dedupeAll() {
  // [DEDUPE-CONFIRM-1] 한 번 누르면 승급 신청·학생 책 목록·작품 세 곳을 바로 쓴다 — 되돌리기 없음
  if (!confirm('중복 데이터를 정리할까요?\n\n· 같은 학생·같은 레벨 승급 신청 중복\n· 학생별 같은 제목 책 중복\n· 작품 저장 모양(옛 번호 키 → 작품 id 키)\n\n되돌릴 수 없습니다.')) return;
  // 승급 중복 제거
  const db = DB.load();
  const seen = new Set();
  db.promotionRequests = (db.promotionRequests||[]).filter(r => {
    const key = r.studentId + '_' + r.level;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  // 독서 중복 제거 (학생별 동일 title)
  DB.getStudents().forEach(s => {
    const seenTitles = new Set();
    const before = (s.books||[]).length;
    s.books = (s.books||[]).filter(b => {
      const t = (b.title||'').trim();
      if (seenTitles.has(t)) return false;
      seenTitles.add(t); return true;
    });
    if (s.books.length !== before) { s.bookCount = s.books.length; DB.saveStudent(s); }
  });
  db.promotionRequests = db.promotionRequests;
  DB._cache = db;
  DB._fbRef.child('promotionRequests').set(DB._promoObj(db.promotionRequests));   // [PROMO-PER-ID-1] 배열로 쓰면 숫자 키로 돌아감

  // artworks id 키 기반 정리 (배열/키 혼재 해소 + 중복 id 제거) — 나쁜 키만 고친다
  const r = await normalizeArtworkKeys(() => true);

  notify(`✅ 중복 데이터 정리 완료! (작품 옮김 ${r.moved} · 지움 ${r.removed})`);
  renderAll();
}

// [DEDUPE-ART-1] artworks 를 "작품 id = 키" 모양으로 맞춘다. **바뀌어야 할 키만** update 한다.
//   예전엔 교사 캐시 판으로 artworks 를 통째 set 해서, 그 순간 학생이 올린 작품을 지울 수 있었다.
//   옛 배열(숫자 키) 작품은 id 키로 옮기고, 그 id 키에 이미 쓰인 조각(내리기 hidden·좋아요 likes)은 합친다
//   — 숫자 키 판에서 hideArtwork 가 `artworks/<id>/hidden` 에만 써서 진짜 작품은 안 내려가던 것도 이걸로 풀린다.
//   keep(a) 가 false 인 작품은 지운다(고아 정리용).
async function normalizeArtworkKeys(keep) {
  const node = DB._fbRef.child('artworks');
  const raw = (await node.once('value')).val() || {};
  const { upd, moved, removed } = DB._artworkKeyFix(raw, keep);   // [ART-KEY-FIX-1] 규칙은 gamedata 한 곳(작품 지우기도 같이 씀)
  if (Object.keys(upd).length) await node.update(upd);
  return { moved, removed };
}

// [ARTFREE-1] 작품 내리기 — 지우지 않고 갤러리에서만 감춘다(부적절한 사진을 즉시 뺄 수단).
//   hidden 한 칸만 쓴다(작품 통짜 set 아님). 다시 걸 수도 있다.
function toggleArtworkHidden(id) {
  const a = (DB.load().artworks||[]).find(x => x.id === id);
  if (!a) return;
  const next = !a.hidden;
  DB.hideArtwork(id, next);
  notify(next ? '작품을 내렸어요 (우리 반 그림에서 안 보입니다)' : '작품을 다시 걸었어요');
  renderArtworkAdmin();
}

function deleteArtwork(id) {
  if (!confirm('이 작품을 삭제할까요?')) return;
  DB.deleteArtwork(id);
  renderArtworkAdmin();
  notify('작품을 삭제했어요');
}

