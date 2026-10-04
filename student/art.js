// student/art.js — 작품 전시(Storage 올리기) + 우리 반 작품 올리기(ARTFREE)
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'art' — 원래 student.js 12403~12948줄 ──
// ══ 작품 전시 (Storage 업로드) ══

// [SCAN-LINK-1] 학습지 스캔 — scan/index.html을 전체화면 iframe으로 열고, 결과 JPEG(≤500KB)를 postMessage로 받는다.
//   받은 Blob은 submitArtwork가 사진 대신 그대로 올린다(같은 Storage 경로·같은 승인·보상·좋아요, kind:'worksheet').
let AW_SCAN_BLOB = null;
function openWorksheetScan() {
  closeWorksheetScan();
  const el = document.createElement('div');
  el.id = 'scan-overlay';
  el.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#f8f6f1;display:flex;flex-direction:column';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;background:#16213E;flex-shrink:0">
      <span style="color:#fff;font-weight:700;flex:1">📄 학습지 스캔</span>
      <button onclick="closeWorksheetScan()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:.35rem .8rem;font-family:inherit;cursor:pointer">✕ 닫기</button>
    </div>
    <iframe src="scan/index.html?v=20260917sta" title="학습지 스캔" allow="camera" style="flex:1;border:0;width:100%;background:#f8f6f1"></iframe>`;
  document.body.appendChild(el);
}
function closeWorksheetScan() { const el = document.getElementById('scan-overlay'); if (el) el.remove(); }
window.addEventListener('message', ev => {
  const d = ev.data;
  if (ev.origin !== location.origin || !d || d.type !== 'scan-result' || !(d.blob instanceof Blob)) return;
  if (d.blob.size > 600 * 1024 || d.blob.type !== 'image/jpeg') { toast('스캔 사진을 받지 못했어요. 다시 해 주세요.'); return; }
  AW_SCAN_BLOB = d.blob;
  const fi = document.getElementById('aw-file-input'); if (fi) fi.value = '';
  const txt = document.getElementById('aw-file-text'); if (txt) txt.textContent = '📄 스캔한 학습지 (사진을 고르면 바뀌어요)';
  const img = document.getElementById('aw-preview-img'), wrap = document.getElementById('aw-preview-wrap');
  if (img && wrap) { img.src = URL.createObjectURL(d.blob); wrap.style.display = ''; }
  closeWorksheetScan();
  toast('📄 학습지 스캔 완료! 제목을 쓰고 제출해요');
  const t = document.getElementById('aw-title-input');
  if (t && !t.value) setTimeout(() => t.focus(), 100);
});

// 이미지 미리보기
function previewArtwork(input) {
  if (!input.files || !input.files[0]) return;
  AW_SCAN_BLOB = null;   // [SCAN-LINK-1] 사진을 새로 고르면 스캔본 대신 그 사진
  const file = input.files[0];
  document.getElementById('aw-file-text').textContent = '📷 ' + file.name;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('aw-preview-img').src = e.target.result;
    document.getElementById('aw-preview-wrap').style.display = '';
  };
  reader.readAsDataURL(file);
}

// 이미지 리사이징 (최대 800px, 용량 절약)
function resizeImage(file, maxSize=800) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let {width, height} = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = height/width*maxSize; width = maxSize; }
          else { width = width/height*maxSize; height = maxSize; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 작품 제출
async function submitArtwork() {
  const title   = document.getElementById('aw-title-input').value.trim();
  const desc    = document.getElementById('aw-desc-input').value.trim();
  const subject = document.getElementById('aw-subject-input').value || '';
  const fileInput = document.getElementById('aw-file-input');

  if (!title) { toast('작품 제목을 입력해주세요!'); return; }
  const scanned = AW_SCAN_BLOB;   // [SCAN-LINK-1] 스캔본이 있으면 사진 대신
  if (!scanned && (!fileInput.files || !fileInput.files[0])) { toast('사진을 선택하거나 학습지를 스캔해 주세요!'); return; }

  // 중복 차단: 같은 제목으로 이미 대기중이거나 전시중인 작품
  const dupPending = (CUR.pendingRewards||[]).some(r => r.type==='artwork' && (r.artTitle||'').trim() === title.trim());
  const dupArtwork = DB.getArtworks(CUR.id).some(a => (a.title||a.artTitle||'').trim() === title.trim());
  if (dupPending) { toast(`🎨 "${title}"은 이미 선생님 확인을 기다리고 있어요!`); return; }
  if (dupArtwork) { toast(`🎨 "${title}"은 이미 전시 중인 작품이에요!`); return; }

  // 업로드 UI 표시
  document.getElementById('aw-upload-progress').style.display = '';
  document.getElementById('aw-progress-bar').style.width = '10%';
  document.getElementById('aw-progress-text').textContent = '이미지 압축 중...';

  try {
    // 이미지 리사이징
    const blob = scanned || await resizeImage(fileInput.files[0]);   // 스캔본은 이미 반듯하게 펴고 ≤500KB로 줄였다
    document.getElementById('aw-progress-bar').style.width = '30%';
    document.getElementById('aw-progress-text').textContent = '올리는 중이에요…';

    // Firebase Storage 업로드
    const storage  = firebase.storage();
    const filename = `artworks/${CUR.id}_${Date.now()}.jpg`;
    const ref      = storage.ref(filename);
    const task     = ref.put(blob);

    task.on('state_changed',
      snap => {
        const pct = Math.round(30 + (snap.bytesTransferred/snap.totalBytes)*60);
        document.getElementById('aw-progress-bar').style.width = pct + '%';
      },
      err => {
        console.error(err);
        toast('업로드 실패: ' + err.message);
        document.getElementById('aw-upload-progress').style.display = 'none';
      },
      async () => {
        const url = await ref.getDownloadURL();
        document.getElementById('aw-progress-bar').style.width = '100%';
        document.getElementById('aw-progress-text').textContent = '완료! 선생님 확인 대기 중...';

        // pendingRewards에 작품 승인 요청 추가
        // [ARTFREE-1] 학생 통짜 set → pendingRewards 한 갈래만. 그 사이 바뀐 경험치·골드를 되돌리지 않는다.
        DB.addPendingReward(CUR, {
          id: 'art_' + Date.now(),
          type: 'artwork',
          kind: scanned ? 'worksheet' : 'lesson',   // [SCAN-LINK-1] 스캔한 학습지 — 승인·보상·좋아요는 작품과 같다
          label: scanned ? `📄 "${title}" 학습지 제출` : `🎨 "${title}" 작품 제출`,
          artTitle: title,
          artDesc: desc,
          artUrl: url,
          subject: subject,
          exp: 30, gold: 20,
          icon: '🎨',
          date: Utils.todayStr(),
        });

        // 폼 초기화
        setTimeout(() => {
          document.getElementById('aw-title-input').value  = '';
          document.getElementById('aw-desc-input').value   = '';
          document.getElementById('aw-file-input').value   = '';
          document.getElementById('aw-file-text').textContent = '📷 사진 선택하기';
          AW_SCAN_BLOB = null;
          document.getElementById('aw-preview-wrap').style.display = 'none';
          document.getElementById('aw-upload-progress').style.display = 'none';
          document.getElementById('aw-progress-bar').style.width = '0%';
          toast(scanned ? '📄 학습지 제출 완료! 선생님 확인 후 전시돼요' : '🎨 작품 제출 완료! 선생님 확인 후 전시돼요');
          renderArtworks();
          renderMain(); renderMobile();
        }, 800);
      }
    );
  } catch(e) {
    toast('오류 발생: ' + e.message);
    document.getElementById('aw-upload-progress').style.display = 'none';
  }
}

// ══ 추억 사진 ══
let _memFiles = []; // 선택된 파일 목록

document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('mem-drop-zone');
  if (zone) zone.onclick = () => document.getElementById('mem-file-input').click();
});

function onMemDrop(e) {
  e.preventDefault();
  document.getElementById('mem-drop-zone').style.borderColor = 'rgba(255,255,255,.2)';
  onMemFilesSelect(e.dataTransfer.files);
}

function onMemFilesSelect(files) {
  if (!files || !files.length) return;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (_memFiles.find(x => x.name===f.name && x.size===f.size)) continue;
    _memFiles.push(f);
  }
  renderMemPreviews();
}

function renderMemPreviews() {
  const wrap = document.getElementById('mem-preview-wrap');
  if (!wrap) return;
  if (_memFiles.length === 0) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = _memFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div style="position:relative;width:70px;height:70px">
      <img src="${url}" style="width:70px;height:70px;object-fit:cover;border-radius:8px">
      <button onclick="removeMemFile(${i})" style="position:absolute;top:-4px;right:-4px;
        background:rgba(231,76,60,.85);border:none;color:#fff;border-radius:50%;
        width:18px;height:18px;font-size:.65rem;cursor:pointer;line-height:1;
        display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  }).join('');
}

function removeMemFile(idx) {
  _memFiles.splice(idx, 1);
  renderMemPreviews();
}

// 이미지 압축 — 표시용(1600px, q0.78) / 썸네일(500px, q0.7)
function compressMemImage(file, maxSize, quality) {
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

async function submitMemories() {
  const folder = document.getElementById('mem-folder-input')?.value.trim() || '';
  if (!folder)           { toast('📁 폴더 이름을 입력해주세요!'); return; }
  if (_memFiles.length === 0) { toast('📷 사진을 선택해주세요!'); return; }

  const total = _memFiles.length;
  const progWrap = document.getElementById('mem-upload-progress');
  const progBar  = document.getElementById('mem-progress-bar');
  const progTxt  = document.getElementById('mem-progress-text');
  progWrap.style.display = '';

  let done = 0;
  const storage = firebase.storage();
  const monthKey = Utils.todayStr().slice(0,7);

  for (const file of [..._memFiles]) {
    progTxt.textContent = `올리는 중 ${done+1}/${total}…`;
    progBar.style.width = `${Math.round(done/total*80)+5}%`;
    try {
      const [imgBlob, thumbBlob] = await Promise.all([
        compressMemImage(file, 1600, 0.78),
        compressMemImage(file, 500,  0.70),
      ]);
      const ts = Date.now() + done;
      const imgRef   = storage.ref(`memories/${CUR.id}_${ts}.jpg`);
      const thumbRef = storage.ref(`memories/${CUR.id}_${ts}_thumb.jpg`);
      await imgRef.put(imgBlob);
      await thumbRef.put(thumbBlob);
      const [imageUrl, thumbUrl] = await Promise.all([imgRef.getDownloadURL(), thumbRef.getDownloadURL()]);

      // 제목 = 폴더이름 (장수 > 1이면 번호 붙임), 파일명은 절대 사용 안함
      const title = total > 1 ? `${folder} (${done+1})` : folder;
      DB.saveMemory({
        id: 'mem_' + ts + '_' + CUR.id,
        studentId: CUR.id,
        studentName: CUR.name,
        uploadedBy: 'student',
        title,
        desc: folder,          // 설명도 폴더명으로
        imageUrl, thumbUrl,
        visibilityType: 'class',
        approvalStatus: 'pending',
        monthKey,
        createdAt: ts,
        date: Utils.todayStr(),
      });
      done++;
    } catch(e) {
      toast('업로드 실패: ' + e.message);
    }
  }

  progBar.style.width = '100%';
  progTxt.textContent = `${done}장 제출 완료!`;
  setTimeout(() => {
    document.getElementById('mem-folder-input').value = '';
    document.getElementById('mem-file-input').value = '';
    _memFiles = [];
    renderMemPreviews();
    progWrap.style.display = 'none';
    progBar.style.width = '0%';
    toast(`📸 ${done}장 제출! 선생님 확인 후 공유돼요`);
    renderMyMemories();
  }, 800);
}

function editMemTitle(memId, currentTitle) {
  if (currentTitle === undefined) { // 호출부는 id만 전달 (제목을 onclick 인자로 넘기면 따옴표/HTML 주입 위험)
    const m = (DB.getMemories('all') || []).find(x => x.id === memId);
    currentTitle = (m && m.title) || '';
  }
  const newTitle = prompt('폴더 이름을 입력해주세요\n(파일명 대신 보여집니다)', currentTitle);
  if (newTitle === null) return;          // 취소
  if (!newTitle.trim()) { toast('이름을 입력해주세요'); return; }
  DB.saveMemory({ id: memId, title: newTitle.trim(), desc: newTitle.trim() });
  toast('✅ 이름 변경 완료!');
  renderMyMemories();
}

function renderMyMemories() {
  const el = document.getElementById('mem-record-list');
  if (!el) return;
  const all = DB.getMemories('all');
  // 내 사진 + 관리자 전체공개
  const mine   = all.filter(m => m.studentId === CUR.id);
  const pubAdm = all.filter(m => m.uploadedBy === 'admin' && m.visibilityType === 'public');
  const approved = all.filter(m =>
    m.approvalStatus === 'approved' && m.visibilityType === 'class' && m.studentId !== CUR.id
  );
  const list = [...mine, ...pubAdm.filter(m => !mine.find(x=>x.id===m.id)),
                ...approved.filter(m => !mine.find(x=>x.id===m.id))];
  list.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));

  if (list.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.8rem">
      아직 추억 사진이 없어요 📸</div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem">
      ${list.map((m,i) => {
        const myPending = m.studentId===CUR.id && m.approvalStatus==='pending';
        return `<div style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;
          aspect-ratio:1;background:rgba(255,255,255,.05);transition:transform .2s"
          onclick="openMemLightbox(${i})"
          onmouseenter="this.style.transform='scale(1.03)'"
          onmouseleave="this.style.transform='scale(1)'">
          <img src="${m.thumbUrl||m.imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block"
            loading="lazy">
          <div style="position:absolute;bottom:0;left:0;right:0;padding:.3rem .45rem;
            background:linear-gradient(transparent,rgba(0,0,0,.72));
            font-size:.6rem;color:rgba(255,255,255,.9);
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${escHtml(m.title||'')}
          </div>
          ${myPending?`<div style="position:absolute;top:4px;right:4px;font-size:.55rem;
            background:rgba(255,180,0,.85);color:#1a1a1a;padding:.1rem .3rem;border-radius:4px;font-weight:700">확인 중</div>`:''}
          ${m.studentId===CUR.id?`<button onclick="event.stopPropagation();editMemTitle('${m.id}')"
            style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,.55);border:none;
              color:#fff;font-size:.65rem;padding:.1rem .35rem;border-radius:4px;cursor:pointer">✏️</button>`:''}
        </div>`;
      }).join('')}
    </div>`;
  window._memLightboxList = list;
}

let _memLbIdx = 0;
function openMemLightbox(idx) {
  const list = window._memLightboxList || [];
  if (!list.length) return;
  _memLbIdx = idx;
  // 추억 전용 라이트박스 (작품 lb-img와 분리)
  let lb = document.getElementById('mem-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'mem-lightbox';
    lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:99999;flex-direction:column;align-items:center;justify-content:center';
    lb.onclick = e => { if (e.target === lb) lb.style.display='none'; };
    lb.innerHTML = `
      <button onclick="document.getElementById('mem-lightbox').style.display='none'"
        style="position:absolute;top:1rem;right:1.2rem;background:rgba(255,255,255,.15);border:none;
          color:#fff;font-size:1.6rem;cursor:pointer;border-radius:8px;width:40px;height:40px;
          display:flex;align-items:center;justify-content:center">✕</button>
      <img id="mem-lb-img" style="max-width:90vw;max-height:72vh;border-radius:14px;object-fit:contain;
        box-shadow:0 8px 40px rgba(0,0,0,.6)">
      <div id="mem-lb-cap" style="color:rgba(255,255,255,.9);font-size:.85rem;margin-top:.7rem;
        text-align:center;max-width:80vw;line-height:1.5"></div>
      <div id="mem-lb-counter" style="color:rgba(255,255,255,.4);font-size:.72rem;margin-top:.2rem"></div>
      <div style="display:flex;gap:1.2rem;margin-top:.8rem">
        <button onclick="navMemLb(-1);event.stopPropagation()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.8rem;
            padding:.35rem 1.2rem;border-radius:10px;cursor:pointer;transition:.15s"
          onmouseenter="this.style.background='rgba(255,255,255,.25)'"
          onmouseleave="this.style.background='rgba(255,255,255,.15)'">‹</button>
        <button onclick="navMemLb(1);event.stopPropagation()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.8rem;
            padding:.35rem 1.2rem;border-radius:10px;cursor:pointer;transition:.15s"
          onmouseenter="this.style.background='rgba(255,255,255,.25)'"
          onmouseleave="this.style.background='rgba(255,255,255,.15)'">›</button>
      </div>`;
    document.body.appendChild(lb);
  }
  _renderMemLb();
  lb.style.display = 'flex';
}

function _renderMemLb() {
  const list = window._memLightboxList || [];
  const m = list[_memLbIdx];
  if (!m) return;
  document.getElementById('mem-lb-img').src = m.imageUrl || m.thumbUrl;
  document.getElementById('mem-lb-cap').textContent =
    (m.title||'') + (m.desc ? ' — '+m.desc : '') + (m.date ? '  '+m.date : '');
  document.getElementById('mem-lb-counter').textContent = `${_memLbIdx+1} / ${list.length}`;
}

function navMemLb(dir) {
  const list = window._memLightboxList || [];
  _memLbIdx = (_memLbIdx + dir + list.length) % list.length;
  _renderMemLb();
}

// ══ 작품 탭 ══
function openLightbox(imgs, idx) {
  _lbImgs = imgs; _lbIdx = idx;
  _renderLightbox();
  document.getElementById('artwork-lightbox').style.display = 'flex';
}
function closeLightbox() {
  document.getElementById('artwork-lightbox').style.display = 'none';
}
function _renderLightbox() {
  const a = _lbImgs[_lbIdx];
  document.getElementById('lb-img').src = a.url;
  document.getElementById('lb-title').textContent = a.title;
  document.getElementById('lb-desc').textContent  = a.desc || '';
  document.getElementById('lb-counter').textContent = (_lbIdx+1) + ' / ' + _lbImgs.length;
  document.getElementById('lb-prev').style.opacity = _lbIdx > 0 ? '1' : '0.3';
  document.getElementById('lb-next').style.opacity = _lbIdx < _lbImgs.length-1 ? '1' : '0.3';
}
function lbPrev() { if (_lbIdx > 0) { _lbIdx--; _renderLightbox(); } }
function lbNext() { if (_lbIdx < _lbImgs.length-1) { _lbIdx++; _renderLightbox(); } }


// ══ 작품 과목 ══
let CUR_ART_SUBJECT = '전체';

function getStudentSubjects() {
  const db = DB.load();
  const s = (db.settings || {});
  const DEFAULT_SUBJECTS = ['국어','수학','사회','과학','음악','미술','체육','영어','창체'];
  return s.activeSubjects && s.activeSubjects.length > 0 ? s.activeSubjects : DEFAULT_SUBJECTS;
}

function renderArtworkSubjectTabs() {
  const subjects = getStudentSubjects();
  const el = document.getElementById('artwork-subject-tabs');
  if (!el) return;
  const tabs = ['전체', ...subjects];
  el.innerHTML = tabs.map(t => {
    const active = CUR_ART_SUBJECT === t;
    return `<button onclick="selectArtSubject('${t}')"
      style="font-size:.72rem;padding:.22rem .65rem;border-radius:20px;cursor:pointer;
        border:1.5px solid ${active?'var(--gold)':'rgba(255,255,255,.1)'};
        background:${active?'var(--gold)':'rgba(255,255,255,.04)'};
        color:${active?'#1a1a1a':'var(--txt3)'};
        font-weight:${active?'800':'500'};
        font-family:inherit;transition:all .15s">
      ${t}
    </button>`;
  }).join('');
}

function selectArtSubject(subject) {
  CUR_ART_SUBJECT = subject;
  renderArtworkSubjectTabs();
  renderArtworks();
}

function fillArtworkSubjectSelect() {
  const sel = document.getElementById('aw-subject-input');
  if (!sel) return;
  const subjects = getStudentSubjects();
  sel.innerHTML = '<option value="">과목 선택 (선택사항)</option>' +
    subjects.map(s => `<option value="${s}">${s}</option>`).join('');
}

function renderArtworks() {
  const el = document.getElementById('artwork-list');
  if (!el) return;
  renderArtworkSubjectTabs();
  fillArtworkSubjectSelect();
  let approved = DB.getArtworks(CUR.id);
  let pending  = (CUR.pendingRewards||[]).filter(p=>p.type==='artwork');
  if (CUR_ART_SUBJECT !== '전체') {
    approved = approved.filter(a => (a.subject||'') === CUR_ART_SUBJECT);
    pending  = pending.filter(a => (a.subject||'') === CUR_ART_SUBJECT);
  }
  if (approved.length === 0 && pending.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:2.5rem 0;color:var(--txt3);font-size:.82rem;line-height:2">
      아직 등록된 작품이 없어요 🎨<br>
      <span style="font-size:.72rem">위에서 첫 번째 작품을 올려보세요!</span></div>`;
    return;
  }
  const lbImgs = approved.filter(a=>a.artUrl||a.link).map(a=>({url:a.artUrl||a.link, title:a.title||a.artTitle||'', desc:a.comment||a.artDesc||''}));
  window._artLbImgs = lbImgs;

  const pendingHtml = pending.map(a => `
    <div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(255,215,0,.2);
      border-radius:14px;overflow:hidden;margin-bottom:.8rem">
      ${a.artUrl?`<img src="${escHtml(a.artUrl)}" style="width:100%;max-height:200px;object-fit:cover;display:block">`:''}
      <div style="padding:.75rem .9rem">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;flex-wrap:wrap">
          <span style="font-size:.65rem;font-weight:800;padding:.18rem .55rem;border-radius:20px;
            background:rgba(255,215,0,.18);color:var(--gold);border:1px solid rgba(255,215,0,.3)">⏳ 확인 중</span>
          ${a.subject?`<span style="font-size:.65rem;padding:.18rem .5rem;border-radius:20px;
            background:rgba(255,255,255,.07);color:var(--txt3);border:1px solid rgba(255,255,255,.1)">${escHtml(a.subject)}</span>`:''}
        </div>
        <div style="font-size:.92rem;font-weight:800;color:var(--txt1);margin-bottom:.25rem">${escHtml(a.artTitle||'')}</div>
        ${a.artDesc?`<div style="font-size:.75rem;color:var(--txt2);line-height:1.55;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(a.artDesc)}</div>`:''}
      </div>
    </div>`).join('');

  const approvedHtml = approved.map((a,i) => {
    const url = a.artUrl||a.link||'';
    const lbIdx = lbImgs.findIndex(x=>x.url===url);
    const title = escHtml(a.title||a.artTitle||'');
    const desc = escHtml(a.comment||a.artDesc||'');
    return `
    <div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(46,204,113,.15);
      border-radius:14px;overflow:hidden;margin-bottom:.8rem">
      ${url?`<div style="position:relative;cursor:pointer" onclick="openLightbox(window._artLbImgs,${lbIdx})">
        <img src="${escHtml(url)}" style="width:100%;max-height:220px;object-fit:cover;display:block"
          onerror="this.parentElement.style.display='none'">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0);transition:background .2s"
          onmouseover="this.style.background='rgba(0,0,0,.15)'" onmouseout="this.style.background='rgba(0,0,0,0)'">
          <span style="position:absolute;top:.5rem;right:.5rem;background:rgba(0,0,0,.45);
            border-radius:20px;padding:.15rem .5rem;font-size:.65rem;color:#fff">🔍 크게보기</span>
        </div>
      </div>`:''}
      <div style="padding:.75rem .9rem">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;flex-wrap:wrap">
          <span style="font-size:.65rem;font-weight:800;padding:.18rem .55rem;border-radius:20px;
            background:rgba(46,204,113,.15);color:var(--emerald);border:1px solid rgba(46,204,113,.25)">✓ 전시 중</span>
          ${a.subject?`<span style="font-size:.65rem;padding:.18rem .5rem;border-radius:20px;
            background:rgba(255,255,255,.07);color:var(--txt3);border:1px solid rgba(255,255,255,.1)">${escHtml(a.subject)}</span>`:''}
        </div>
        <div style="font-size:.92rem;font-weight:800;color:var(--txt1);margin-bottom:.25rem">${title}</div>
        ${desc?`<div style="font-size:.75rem;color:var(--txt2);line-height:1.55;margin-bottom:.3rem;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${desc}</div>`:''}
        <div style="font-size:.65rem;color:var(--txt3);text-align:right">${a.date||''}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = pendingHtml + approvedHtml;
}


// ── [SPLIT-1] 'artfree' — 원래 student.js 15415~15651줄 ──
// ══════════════════════════════════════════════════
//  [ARTFREE-1] 우리 반 작품 올리기 — 수업과 무관하게 아무 그림이나 올리는 통로
//  · 디지털 드로잉 결과물이 주 용도라 제목을 안 써도 올라간다(수업 작품은 기존 규칙 그대로).
//  · 올리면 '내 작품'에는 바로 보이고 '확인 중' 딱지가 붙는다.
//    선생님이 확인해야 '우리 반 그림'에 걸린다 — 그냥 올리는 느낌과 안전을 함께.
//  · 저장은 기존 Storage artworks/ 경로를 그대로 쓰고 파일명만 free_ 로 구분한다.
//  · 학생 통짜 set을 하지 않는다(DB.addPendingReward가 pendingRewards 한 갈래만 쓴다).
// ══════════════════════════════════════════════════
const FREE_ART_EXP = 0;          // 자유 작품 보상 — 갤러리에 걸리는 것 자체가 보상(값만 바꾸면 지급)
const FREE_ART_GOLD = 0;
const FREE_ART_MAX_DAY = 5;      // 하루 올릴 수 있는 장수
const FREE_ART_MAX_TOTAL = 30;   // 한 사람이 쌓아 둘 수 있는 장수
const FREE_ART_PX = 1200;        // 드로잉은 800px이면 선이 뭉갠다

let _afTab = 'class';            // 'class' 우리 반 그림 · 'mine' 내 작품
let _afBlob = null, _afName = '';

function myFreeArtCount() {
  const today = Utils.todayStr();
  const mine = DB.getArtworks(CUR.id).filter(a => (a.kind || 'lesson') === 'free');
  const pend = (CUR.pendingRewards || []).filter(r => r.type === 'artwork' && r.kind === 'free');
  return {
    today: mine.filter(a => a.date === today).length + pend.filter(r => r.date === today).length,
    total: mine.length + pend.length,
  };
}
// 갤러리에 거는 목록 — 승인됐고 내려지지 않은 것
function galleryArtworks() {
  return (DB.load().artworks || []).filter(a => a && !a.hidden).slice().reverse();
}
function artLikeCount(a) { return Object.keys(a.likes || {}).length; }
function iLikedArt(a) { return !!(a.likes || {})[CUR.id]; }
function toggleArtLike(id) {
  const a = (DB.load().artworks || []).find(x => x.id === id);
  if (!a) return;
  DB.setArtworkLike(id, CUR.id, !iLikedArt(a));
  renderArtFree();
}

function openArtFree(tab) {
  _afTab = tab || 'class';
  _afBlob = null; _afName = '';
  const el = _artFreeEl();
  el.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderArtFree();
}
function closeArtFree() {
  const el = document.getElementById('m-artfree');
  if (el) el.style.display = 'none';
  document.body.style.overflow = '';
  _afBlob = null;
  if (typeof renderArtworks === 'function' && document.getElementById('artwork-list')) renderArtworks();
}
function _artFreeEl() {
  let el = document.getElementById('m-artfree');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'm-artfree';
  el.style.cssText = 'position:fixed;inset:0;z-index:8500;background:#14130f;display:none;flex-direction:column';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;background:#1b1a17;
      border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0">
      <span style="font-weight:800;color:var(--gold);flex:1">🎨 우리 반 작품</span>
      <button onclick="closeArtFree()" aria-label="닫기" style="background:none;border:none;color:var(--txt);
        font-size:1.35rem;cursor:pointer;padding:.1rem .4rem;font-family:inherit">✕</button>
    </div>
    <div id="artfree-body" style="flex:1;overflow-y:auto;padding:.9rem"></div>`;
  document.body.appendChild(el);
  return el;
}

// 사진 고르기 — 찍기와 파일 고르기 둘 다
function pickArtFree(useCamera) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  if (useCamera) inp.setAttribute('capture', 'environment');
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    _afName = f.name || '';
    try {
      _afBlob = await resizeImage(f, FREE_ART_PX);
      renderArtFree('upload');
    } catch (e) { toast('사진을 읽지 못했어요'); }
  };
  inp.click();
}

async function submitArtFree() {
  if (!_afBlob) { toast('먼저 그림을 골라 주세요'); return; }
  const raw = (document.getElementById('af-title') || {}).value || '';
  const title = raw.trim() || '제목 없는 그림';
  const cnt = myFreeArtCount();
  if (cnt.today >= FREE_ART_MAX_DAY) { toast(`오늘은 ${FREE_ART_MAX_DAY}장까지 올릴 수 있어요`); return; }
  if (cnt.total >= FREE_ART_MAX_TOTAL) { toast(`작품은 ${FREE_ART_MAX_TOTAL}장까지 모을 수 있어요`); return; }

  renderArtFree('uploading');
  try {
    const filename = 'artworks/free_' + CUR.id + '_' + Date.now() + '.jpg';
    const ref = firebase.storage().ref(filename);
    const task = ref.put(_afBlob);
    task.on('state_changed',
      snap => {
        const bar = document.getElementById('af-bar');
        if (bar && snap.totalBytes) bar.style.width = Math.round(snap.bytesTransferred / snap.totalBytes * 100) + '%';
      },
      err => { console.warn('[artfree] 업로드 실패', err); renderArtFree('failed'); },
      async () => {
        try {
          const url = await ref.getDownloadURL();
          // 학생 통짜 set을 하지 않는다 — pendingRewards 한 갈래만 쓴다
          await DB.addPendingReward(CUR, {
            id: 'art_' + Date.now(),
            type: 'artwork', kind: 'free',
            label: `🎨 "${title}" 그림 올림`,
            artTitle: title, artDesc: '', artUrl: url, subject: '',
            exp: FREE_ART_EXP, gold: FREE_ART_GOLD, icon: '🎨',
            date: Utils.todayStr(),
          });
          _afBlob = null;
          _afTab = 'mine';
          renderArtFree();
          toast('🎨 올렸어요! 선생님이 확인하면 우리 반 그림에 걸려요');
          if (typeof renderMain === 'function') { renderMain(); renderMobile(); }
        } catch (e) { console.warn('[artfree] 저장 실패', e); renderArtFree('failed'); }
      }
    );
  } catch (e) { console.warn('[artfree] 올리기 오류', e); renderArtFree('failed'); }
}

function renderArtFree(mode) {
  const body = document.getElementById('artfree-body');
  if (!body) return;
  const cnt = myFreeArtCount();
  const tabs = `
    <div style="display:flex;gap:.4rem;margin-bottom:.9rem">
      ${[['class', '우리 반 그림'], ['mine', '내 작품']].map(t => `
        <button onclick="_afTab='${t[0]}';renderArtFree()"
          style="flex:1;padding:.6rem;border-radius:10px;font-family:inherit;font-size:.92rem;cursor:pointer;
            border:1px solid ${_afTab === t[0] ? 'rgba(200,150,46,.45)' : 'rgba(255,255,255,.12)'};
            background:${_afTab === t[0] ? 'rgba(200,150,46,.16)' : 'rgba(255,255,255,.04)'};
            color:${_afTab === t[0] ? 'var(--gold)' : 'var(--txt3)'};font-weight:${_afTab === t[0] ? '700' : '400'}">
          ${t[1]}</button>`).join('')}
    </div>`;

  // 올리기 칸
  let up = '';
  if (mode === 'uploading') {
    up = `<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:1rem;margin-bottom:.9rem">
      <div style="font-weight:700;margin-bottom:.5rem">올리는 중이에요</div>
      <div style="height:9px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden">
        <div id="af-bar" style="height:100%;width:8%;background:var(--sky);border-radius:99px;transition:width .2s"></div>
      </div>
      <div style="font-size:.8rem;color:var(--txt3);margin-top:.5rem">잠깐만 기다려 주세요</div></div>`;
  } else if (mode === 'failed') {
    up = `<div style="border:1px solid rgba(210,112,90,.5);background:rgba(210,112,90,.12);border-radius:14px;padding:1rem;margin-bottom:.9rem">
      <div style="font-weight:700;color:var(--red)">😢 올리지 못했어요</div>
      <div style="font-size:.85rem;color:var(--txt3);margin:.4rem 0 .7rem">인터넷이 잠깐 끊긴 것 같아요. 고른 그림은 그대로 있어요.</div>
      <div style="display:flex;gap:.5rem">
        <button onclick="submitArtFree()" style="flex:1;padding:.7rem;border-radius:10px;border:none;
          background:var(--gold);color:#191510;font-family:inherit;font-weight:700;cursor:pointer">다시 올리기</button>
        <button onclick="renderArtFree('upload')" style="flex:1;padding:.7rem;border-radius:10px;
          border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--txt);
          font-family:inherit;cursor:pointer">나중에 하기</button>
      </div></div>`;
  } else if (_afTab === 'mine' || mode === 'upload') {
    const has = !!_afBlob;
    up = `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:1rem;margin-bottom:.9rem">
      <div style="display:flex;gap:.6rem;margin-bottom:${has ? '.8rem' : '0'}">
        <button onclick="pickArtFree(true)" style="flex:1;padding:1rem .5rem;border-radius:12px;cursor:pointer;
          border:1px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:var(--txt);font-family:inherit">
          <div style="font-size:1.5rem">📷</div>사진 찍기</button>
        <button onclick="pickArtFree(false)" style="flex:1;padding:1rem .5rem;border-radius:12px;cursor:pointer;
          border:1px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:var(--txt);font-family:inherit">
          <div style="font-size:1.5rem">🖼️</div>파일 고르기</button>
      </div>
      ${has ? `
        <div style="font-size:.82rem;color:var(--txt3);margin-bottom:.5rem">고른 그림: ${escHtml(_afName || '그림')}</div>
        <input id="af-title" placeholder="제목 (안 써도 괜찮아요)" maxlength="30"
          style="width:100%;padding:.75rem;border-radius:10px;border:1px solid rgba(255,255,255,.12);
            background:#191816;color:var(--txt);font-family:inherit;font-size:1rem">
        <button onclick="submitArtFree()" style="width:100%;margin-top:.7rem;padding:.9rem;border-radius:12px;
          border:none;background:var(--gold);color:#191510;font-family:inherit;font-size:1.05rem;font-weight:800;cursor:pointer">올리기</button>
        <div style="font-size:.78rem;color:var(--txt3);text-align:center;margin-top:.5rem">
          오늘 ${cnt.today}장 올렸어요 · 하루 ${FREE_ART_MAX_DAY}장까지</div>` : ''}
    </div>`;
  }

  // 목록
  const tag = (t, c, bg) => `<span style="display:inline-block;font-size:.68rem;padding:.1rem .45rem;border-radius:99px;margin-right:.25rem;background:${bg};color:${c}">${t}</span>`;
  let list = '';
  if (_afTab === 'class') {
    const arts = galleryArtworks();
    list = arts.length === 0
      ? `<div style="text-align:center;padding:2.5rem 0;color:var(--txt3);font-size:.9rem">아직 걸린 그림이 없어요 🎨</div>`
      : `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem">${arts.map(a => {
          const who = (DB.getStudent(a.studentId) || {}).name || '친구';
          const liked = iLikedArt(a), n = artLikeCount(a);
          return `<div style="min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04)">
            <img src="${escHtml(a.artUrl || '')}" alt="" loading="lazy"
              style="width:100%;height:110px;object-fit:cover;display:block;background:#0f0e0c">
            <div style="padding:.5rem .55rem">
              <div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(a.title || '제목 없는 그림')}</div>
              <div style="display:flex;align-items:center;gap:.3rem;font-size:.72rem;color:var(--txt3);margin-top:.2rem">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(who)}</span>
                <button onclick="toggleArtLike('${a.id}')" style="background:none;border:none;cursor:pointer;
                  font-family:inherit;font-size:.75rem;padding:.1rem .2rem;color:${liked ? 'var(--red)' : 'var(--txt3)'}">
                  ${liked ? '❤️' : '🤍'} ${n}</button>
              </div>
            </div></div>`;
        }).join('')}</div>`;
  } else {
    const mine = DB.getArtworks(CUR.id).slice().reverse();
    const pend = (CUR.pendingRewards || []).filter(r => r.type === 'artwork').slice().reverse();
    const rows = [
      ...pend.map(r => ({ url: r.artUrl, title: r.artTitle, kind: r.kind || 'lesson', wait: true })),
      ...mine.map(a => ({ url: a.artUrl, title: a.title, kind: a.kind || 'lesson', wait: false, hidden: a.hidden })),
    ];
    list = rows.length === 0
      ? `<div style="text-align:center;padding:2.5rem 0;color:var(--txt3);font-size:.9rem">아직 올린 그림이 없어요<br><span style="font-size:.8rem">위에서 첫 그림을 올려 보세요</span></div>`
      : `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem">${rows.map(r => `
          <div style="min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04)">
            <img src="${escHtml(r.url || '')}" alt="" loading="lazy"
              style="width:100%;height:110px;object-fit:cover;display:block;background:#0f0e0c">
            <div style="padding:.5rem .55rem">
              <div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.title || '제목 없는 그림')}</div>
              <div style="margin-top:.25rem">
                ${r.kind === 'free' ? tag('자유', 'var(--sky)', 'rgba(93,173,226,.16)') : r.kind === 'worksheet' ? tag('학습지', 'var(--gold)', 'rgba(200,150,46,.16)') : tag('수업', 'var(--emerald)', 'rgba(46,204,113,.16)')}
                ${r.wait ? tag('확인 중', 'var(--gold)', 'rgba(200,150,46,.18)') : ''}
                ${r.hidden ? tag('내려짐', 'var(--txt3)', 'rgba(255,255,255,.08)') : ''}
              </div>
            </div></div>`).join('')}</div>`;
  }
  body.innerHTML = tabs + up + list;
}

