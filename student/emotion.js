// student/emotion.js — 감정 돌아보기 팝업
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'emotion' — 원래 student.js 12949~13470줄 ──
// ══ 감정 돌아보기 팝업 ══
let _refCandidate = null;

function tryShowReflectionPopup() {
  if (!CUR) return;
  if (!canShowReflectionPopup(CUR.id)) return;
  const candidate = getReflectionCandidate(CUR.id);
  if (!candidate) return;
  _refCandidate = candidate;

  // 질문 문장 생성
  const pastText = EMOTION_PAST_TEXT[candidate.emotionLabel] || `${candidate.emotionLabel}했다고`;
  const dateStr  = candidate.date.slice(5).replace('-', '/');
  let question;
  if (candidate.reason && candidate.reason !== '없음') {
    question = `${CUR.name}님, ${dateStr}에 "${candidate.reason}"라고 적었고, 그때는 마음이 ${pastText} 했어요. 지금은 어떤가요?`;
  } else {
    question = `${CUR.name}님, ${dateStr}에는 마음이 ${pastText} 했어요. 오늘은 어떤가요?`;
  }

  document.getElementById('ref-question').textContent = question;
  document.getElementById('ref-step1').style.display         = '';
  document.getElementById('ref-step2').style.display         = 'none';
  document.getElementById('ref-step-custom').style.display   = 'none';
  openModal('m-reflection');
}

function onReflectionResponse(type) {
  if (!_refCandidate) return;

  const msgs = {
    better: ['다행이에요. 마음이 조금 나아졌군요. 😊', '좋아졌다고 알려줘서 고마워요.', '스스로 돌아본 것이 정말 좋아요.'],
    same:   ['아직 비슷하게 느껴지는군요.', '그 마음이 계속되고 있네요.', '괜찮아요. 천천히 달라질 수도 있어요.'],
    worse:  ['더 힘들어졌군요.', '그렇게 느낄 수 있어요.', '혼자 참지 않아도 괜찮아요.'],
    later:  ['괜찮아요. 나중에 다시 생각해봐도 돼요.', '지금 답하지 않아도 괜찮아요.'],
  };

  if (type === 'later') {
    updateReflectionStats(CUR.id, 'later');
    saveEmotionReflection(CUR.id, _refCandidate, 'later', '', false);
    closeModal('m-reflection');
    return;
  }

  if (type === 'custom') {
    document.getElementById('ref-step1').style.display       = 'none';
    document.getElementById('ref-step-custom').style.display = '';
    return;
  }

  const msg = msgs[type][Math.floor(Math.random() * msgs[type].length)];
  document.getElementById('ref-followup-msg').textContent = msg;
  document.getElementById('ref-step1').style.display = 'none';
  document.getElementById('ref-step2').style.display = '';

  const actionsEl = document.getElementById('ref-followup-actions');

  if (type === 'worse') {
    // 나빠졌어요 → 2차 선택지
    actionsEl.innerHTML = `
      <button onclick="finalizeReflection('worse','',false)"
        class="btn-sm outline" style="text-align:left;padding:.55rem .9rem">괜찮아요, 기록만 할게요</button>
      <button onclick="finalizeReflection('worse','',true)"
        class="btn-sm outline" style="text-align:left;padding:.55rem .9rem;color:var(--sky);border-color:rgba(93,173,226,.3)">
        선생님께 말하고 싶어요</button>`;
  } else {
    // better / same → 부정 반복 체크
    actionsEl.innerHTML = `<button onclick="finalizeReflection('${type}','',false)"
      class="btn-sm success" style="padding:.55rem .9rem">확인</button>`;

    // 부정 연속 체크
    if (shouldShowTeacherOption(CUR.id)) {
      actionsEl.innerHTML += `
        <div style="margin-top:.5rem;padding:.6rem;background:rgba(93,173,226,.06);border-radius:10px;
          border:1px solid rgba(93,173,226,.15)">
          <div style="font-size:.78rem;color:var(--sky);margin-bottom:.4rem">
            요즘 마음이 계속 힘든 것 같아요. 선생님께 이야기하고 싶나요?
          </div>
          <div style="display:flex;gap:.5rem">
            <button onclick="finalizeReflection('${type}','',false)"
              style="flex:1;padding:.4rem;border-radius:8px;background:rgba(255,255,255,.06);
                border:1px solid rgba(255,255,255,.12);color:var(--txt);font-size:.78rem;cursor:pointer;font-family:inherit">괜찮아요</button>
            <button onclick="finalizeReflection('${type}','',true)"
              style="flex:1;padding:.4rem;border-radius:8px;background:rgba(93,173,226,.15);
                border:1px solid rgba(93,173,226,.3);color:var(--sky);font-size:.78rem;cursor:pointer;font-family:inherit">이야기하고 싶어요</button>
          </div>
        </div>`;
    }
  }
}

function submitReflectionCustom(teacherRequest) {
  const text = document.getElementById('ref-custom-text').value.trim();
  finalizeReflection('custom', text, teacherRequest);
}

function finalizeReflection(responseType, responseText, teacherRequest) {
  if (!_refCandidate) return;
  updateReflectionStats(CUR.id, responseType);
  saveEmotionReflection(CUR.id, _refCandidate, responseType, responseText, teacherRequest);
  closeModal('m-reflection');
  if (teacherRequest) toast('선생님께 전달됐어요. 고마워요 💙');
  _refCandidate = null;
}

function dismissReflection() {
  updateReflectionStats(CUR.id, 'later');
  saveEmotionReflection(CUR.id, _refCandidate, 'later', '', false);
  closeModal('m-reflection');
  _refCandidate = null;
}

function shouldShowTeacherOption(studentId) {
  const db = DB.load();
  const reflections = Object.values(db.emotionReflections || {})
    .filter(r => r && r.studentId === studentId)
    .sort((a,b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const badCount = reflections.filter(r =>
    r.responseType === 'worse' || r.responseType === 'same'
  ).length;
  return badCount >= 2;
}

// ══ 오늘의 감정 ══

let _emoScoreChart = null;
let _emoDistChart  = null;
//  [LAZY-SDK-1] 감정 차트 둘(꺾은선·도넛)에만 쓰는 Chart.js 4.4.0 — 첫 화면 태그에서 빼고 차트를 그리기 직전에 한 번 부른다(loadScriptOnce).
//  받는 동안엔 차트 자리를 비워 두고, 다 오면 감정 탭이 열려 있을 때 한 번 더 그린다.
//  못 받으면 차트 자리에만 '차트를 불러오지 못했어요' 한 줄 — 요약·자주 느낀 감정·달력은 그대로. 다음에 탭을 열면 다시 받는다.
const CHART_JS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
let _emoChartBusy = false;
function _emoChartMsg(cv, msg) {
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  if (!msg) return;
  c.fillStyle = 'rgba(255,255,255,.3)';
  c.font = '14px Noto Sans KR';
  c.textAlign = 'center';
  c.fillText(msg, cv.width / 2, 60);
}
function _emoChartLoad(cv) {
  _emoChartMsg(cv, '');
  if (_emoChartBusy) return;
  _emoChartBusy = true;
  loadScriptOnce(CHART_JS_SRC).then(() => {
    _emoChartBusy = false;
    if (typeof Chart === 'undefined') throw new Error('Chart 없음');
    const open = document.getElementById('m-house')?.classList.contains('open');
    const tab = document.getElementById('house-tab-emotion');
    if (CUR && open && tab && tab.style.display !== 'none') renderEmotionHistory();
  }).catch(() => {
    _emoChartBusy = false;
    ['emo-score-chart', 'emo-dist-chart'].forEach(id => { const c = document.getElementById(id); if (c) _emoChartMsg(c, '차트를 불러오지 못했어요'); });
  });
}

function renderEmotionHistory() {
  // 월 셀렉트 초기화
  const sel = document.getElementById('emo-month-sel');
  if (!sel) return;
  const today = Utils.todayStr();
  const curYear  = parseInt(today.slice(0,4));
  const curMonth = parseInt(today.slice(5,7));
  if (sel.options.length === 0) {
    for (let m = curMonth; m >= Math.max(1, curMonth-5); m--) {
      const opt = document.createElement('option');
      const mm = String(m).padStart(2,'0');
      opt.value = `${curYear}-${mm}`;
      opt.textContent = `${curYear}년 ${m}월`;
      sel.appendChild(opt);
    }
  }
  const selectedMonth = sel.value || `${curYear}-${String(curMonth).padStart(2,'0')}`;

  // 해당 월 기록 가져오기
  const allRecords = DB_EMOTION.getByStudent(CUR.id)
    .filter(r => r.date.startsWith(selectedMonth));

  // ── 요약 ──
  const pos = allRecords.filter(r=>r.group==='positive').length;
  const neu = allRecords.filter(r=>r.group==='neutral').length;
  const neg = allRecords.filter(r=>r.group==='negative').length;
  const total = allRecords.length;
  const summaryEl = document.getElementById('emo-month-summary');
  if (summaryEl) {
    summaryEl.innerHTML = [
      {label:'총 기록', value:`${total}회`, color:'var(--sky)'},
      {label:'😊 긍정', value:`${pos}회`, color:'var(--emerald)'},
      {label:'😶 보통', value:`${neu}회`, color:'var(--txt2)'},
      {label:'😢 부정', value:`${neg}회`, color:'var(--red)'},
    ].map(s=>`<div style="flex:1;min-width:60px;background:rgba(255,255,255,.04);border-radius:10px;
      padding:.45rem .5rem;text-align:center">
      <div style="font-size:.65rem;color:var(--txt3)">${s.label}</div>
      <div style="font-size:1rem;font-weight:700;color:${s.color}">${s.value}</div>
    </div>`).join('');
  }

  // ── 날짜별 score 꺾은선 ──
  const byDate = {};
  allRecords.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r.score);
  });
  const dateLabels = Object.keys(byDate).sort();
  const scoreData  = dateLabels.map(d => {
    const scores = byDate[d];
    return +(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
  });

  if (_emoScoreChart) _emoScoreChart.destroy();
  const scoreCtx = document.getElementById('emo-score-chart');
  if (scoreCtx && dateLabels.length > 0 && typeof Chart === 'undefined') {
    _emoChartLoad(scoreCtx);   // [LAZY-SDK-1] 받고 나서 다시 그린다
  } else if (scoreCtx && dateLabels.length > 0) {
    _emoScoreChart = new Chart(scoreCtx, {
      type: 'line',
      data: {
        labels: dateLabels.map(d => d.slice(5)),
        datasets: [{
          data: scoreData,
          borderColor: '#FFD700',
          backgroundColor: 'rgba(255,215,0,.1)',
          pointBackgroundColor: scoreData.map(s => s>0?'#2ecc71':s<0?'#e74c3c':'#aaa'),
          tension: 0.3, fill: true, pointRadius: 4,
        }]
      },
      options: {
        responsive:true, plugins:{legend:{display:false}},
        scales:{
          y:{min:-3,max:3,grid:{color:'rgba(255,255,255,.08)'},ticks:{color:'#aaa',font:{size:10}}},
          x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#aaa',font:{size:9}}}
        }
      }
    });
  } else if (scoreCtx) {
    const ctx2 = scoreCtx.getContext('2d');
    ctx2.clearRect(0,0,scoreCtx.width,scoreCtx.height);
    ctx2.fillStyle='rgba(255,255,255,.3)';
    ctx2.font='14px Noto Sans KR';
    ctx2.textAlign='center';
    ctx2.fillText('아직 기록이 없어요', scoreCtx.width/2, 60);
  }

  // ── 감정 분포 도넛 ──
  if (_emoDistChart) _emoDistChart.destroy();
  const distCtx = document.getElementById('emo-dist-chart');
  if (distCtx && total > 0 && typeof Chart === 'undefined') {
    _emoChartLoad(distCtx);   // [LAZY-SDK-1]
  } else if (distCtx && total > 0) {
    _emoDistChart = new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels: ['긍정','보통','부정'],
        datasets:[{data:[pos,neu,neg], backgroundColor:['#2ecc71','#95a5a6','#e74c3c'], borderWidth:0}]
      },
      options:{responsive:true,plugins:{legend:{position:'right',labels:{color:'#ccc',font:{size:11}}}}}
    });
  }

  // ── TOP5 감정 ──
  const freq = {};
  allRecords.forEach(r => { freq[r.emotionKey] = (freq[r.emotionKey]||0)+1; });
  const top5 = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const top5El = document.getElementById('emo-top5');
  if (top5El) {
    if (top5.length === 0) {
      top5El.innerHTML = '<div style="color:var(--txt3);font-size:.8rem">아직 기록이 없어요</div>';
    } else {
      const maxCount = top5[0][1];
      top5El.innerHTML = top5.map(([key, count]) => {
        const e = EMOTION_DATA.find(x=>x.key===key);
        const pct = Math.round(count/maxCount*100);
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem">
          <span style="font-size:1.2rem">${e?.icon||'?'}</span>
          <span style="font-size:.78rem;min-width:60px">${e?.label||key}</span>
          <div style="flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:4px"></div>
          </div>
          <span style="font-size:.72rem;color:var(--txt3)">${count}회</span>
        </div>`;
      }).join('');
    }
  }

  // ── 달력 렌더 ──
  const calEl = document.getElementById('emo-calendar');
  if (calEl) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month-1, 1).getDay(); // 0=일
    const lastDate  = new Date(year, month, 0).getDate();
    const days = ['일','월','화','수','목','금','토'];
    let calHtml = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
      ${days.map(d=>`<div style="text-align:center;font-size:.65rem;color:var(--txt3);padding:2px">${d}</div>`).join('')}
    </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i=0;i<firstDay;i++) calHtml += `<div></div>`;
    for (let d=1;d<=lastDate;d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2,'0')}`;
      const am = allRecords.find(r=>r.date===dateStr&&r.period==='am');
      const pm = allRecords.find(r=>r.date===dateStr&&r.period==='pm');
      const hasRecord = am||pm;
      const isToday = dateStr === Utils.todayStr();
      calHtml += `<div onclick="showEmotionDetail('${dateStr}')"
        style="border-radius:8px;padding:3px 2px;text-align:center;cursor:${hasRecord?'pointer':'default'};
          background:${isToday?'rgba(255,215,0,.15)':'rgba(255,255,255,.03)'};
          border:1px solid ${isToday?'rgba(255,215,0,.4)':'rgba(255,255,255,.06)'}">
        <div style="font-size:.65rem;color:var(--txt3);margin-bottom:1px">${d}</div>
        <div style="font-size:.75rem;line-height:1">${am?am.emotionIcon:'·'}</div>
        <div style="font-size:.75rem;line-height:1">${pm?pm.emotionIcon:''}</div>
      </div>`;
    }
    calHtml += '</div>';
    calEl.innerHTML = calHtml;
  }

  // ── 감정 일기 타임라인 ──
  const listEl = document.getElementById('emo-daily-list');
  if (listEl) {
    const sorted = [...allRecords].sort((a,b)=>b.date.localeCompare(a.date)||a.period.localeCompare(b.period));
    if (sorted.length === 0) {
      listEl.innerHTML = '<div style="color:var(--txt3);font-size:.8rem;padding:.5rem">이번 달 기록이 없어요</div>';
    } else {
      const groupColor = {positive:'var(--emerald)',neutral:'var(--txt2)',negative:'var(--red)'};
      const groupBg    = {positive:'rgba(46,204,113,.08)',neutral:'rgba(255,255,255,.04)',negative:'rgba(231,76,60,.08)'};
      // 날짜별로 묶기
      const byDate = {};
      sorted.forEach(r => { if(!byDate[r.date]) byDate[r.date]=[]; byDate[r.date].push(r); });
      listEl.innerHTML = Object.entries(byDate).map(([date, recs]) => {
        const weekDay = ['일','월','화','수','목','금','토'][new Date(date).getDay()];
        return `<div style="margin-bottom:.8rem">
          <div style="font-size:.72rem;color:var(--txt3);font-weight:700;margin-bottom:.4rem;
            padding-bottom:.3rem;border-bottom:1px solid rgba(255,255,255,.08)">
            ${date.slice(5).replace('-','/')} (${weekDay})
          </div>
          ${recs.map(r=>`
            <div style="display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.4rem;
              background:${groupBg[r.group]};border-radius:10px;padding:.5rem .7rem">
              <div style="font-size:.7rem;color:var(--txt3);min-width:32px;padding-top:2px">
                ${r.period==='am'?'🌅 오전':'🌇 오후'}
              </div>
              <div style="font-size:1.4rem;flex-shrink:0">${r.emotionIcon}</div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:.4rem">
                  <span style="font-size:.85rem;font-weight:700">${r.emotionLabel}</span>
                  <span style="font-size:.68rem;color:${groupColor[r.group]};background:${groupBg[r.group]};
                    border-radius:8px;padding:.05rem .35rem">${r.levelLabel}</span>
                </div>
                ${r.reason&&r.reason!=='없음'
                  ? `<div style="font-size:.76rem;color:var(--txt2);margin-top:.25rem">💬 ${escHtml(r.reason)}</div>`
                  : ''}
              </div>
              <button onclick="editEmotionRecord('${r.date}','${r.period}')"
                style="background:none;border:1px solid rgba(255,255,255,.1);color:var(--txt3);
                  border-radius:6px;font-size:.62rem;padding:.15rem .4rem;cursor:pointer;flex-shrink:0">
                수정
              </button>
            </div>`).join('')}
        </div>`;
      }).join('');
    }
  }
}

function showEmotionDetail(date) {
  const records = DB_EMOTION.getByStudent(CUR.id).filter(r=>r.date===date);
  if (!records.length) return;
  const wrap = document.getElementById('emo-detail-wrap');
  const dateEl = document.getElementById('emo-detail-date');
  const contentEl = document.getElementById('emo-detail-content');
  if (!wrap||!dateEl||!contentEl) return;
  const weekDay = ['일','월','화','수','목','금','토'][new Date(date).getDay()];
  dateEl.textContent = `${date.slice(5).replace('-','/')} (${weekDay}) 감정 기록`;
  const groupColor = {positive:'var(--emerald)',neutral:'var(--txt2)',negative:'var(--red)'};
  contentEl.innerHTML = ['am','pm'].map(period => {
    const r = records.find(x=>x.period===period);
    if (!r) return `<div style="padding:.4rem 0;color:var(--txt3);font-size:.8rem">
      ${period==='am'?'🌅 오전':'🌇 오후'} — 기록 없음</div>`;
    return `<div style="display:flex;gap:.7rem;align-items:flex-start;padding:.5rem 0;
      border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="font-size:.72rem;color:var(--txt3);min-width:40px">${period==='am'?'🌅 오전':'🌇 오후'}</div>
      <div style="font-size:1.5rem">${r.emotionIcon}</div>
      <div style="flex:1">
        <div style="font-size:.9rem;font-weight:700">${r.emotionLabel} · <span style="color:${groupColor[r.group]};font-size:.78rem">${r.levelLabel}</span></div>
        ${r.reason&&r.reason!=='없음'?`<div style="font-size:.78rem;color:var(--txt2);margin-top:.2rem">💬 ${escHtml(r.reason)}</div>`:''}
      </div>
      <button onclick="editEmotionRecord('${r.date}','${r.period}')"
        style="background:none;border:1px solid rgba(255,255,255,.12);color:var(--txt3);
          border-radius:6px;font-size:.68rem;padding:.2rem .5rem;cursor:pointer">수정</button>
    </div>`;
  }).join('');
  wrap.style.display = '';
  wrap.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function editEmotionRecord(date, period) {
  // 기존 감정 모달 재활용 (수정 모드)
  _emoCurrentPeriod = period;
  _emoSelectedKey   = null;
  _emoSelectedLevel = null;
  const existing = DB_EMOTION.get(CUR.id, date, period);
  const title = `${date.slice(5).replace('-','/')} ${period==='am'?'오전':'오후'} 수정`;
  document.getElementById('emotion-modal-title').textContent = title;
  document.getElementById('emotion-step1').style.display = '';
  document.getElementById('emotion-step2').style.display = 'none';
  document.getElementById('emotion-reason-input').value = existing?.reason || '';
  // 날짜를 오늘이 아닌 해당 날짜로 임시 저장
  _emoEditDate = date;
  const grid = document.getElementById('emotion-grid');
  grid.innerHTML = EMOTION_DATA.map(e => {
    const isSelected = existing?.emotionKey === e.key;
    return `<button onclick="selectEmotion('${e.key}')"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;
        padding:.45rem .2rem;border-radius:10px;cursor:pointer;font-family:inherit;
        border:1.5px solid ${isSelected?'var(--gold)':'rgba(255,255,255,.1)'};
        background:${isSelected?'rgba(255,215,0,.12)':'rgba(255,255,255,.04)'};transition:all .15s">
      <span style="font-size:1.3rem">${e.icon}</span>
      <span style="font-size:.6rem;color:var(--txt2)">${e.label}</span>
    </button>`;
  }).join('');
  openModal('m-emotion');
}



function claimEmotionReward(rewardId) {
  const weekStart = Utils.weekStartStr();
  if (!EMOTION_REWARDS.some(r => r.id === rewardId)) return;

  // 이미 수령 여부 재확인
  const claimed = (CUR.emotionRewardsClaimed || {})[weekStart] || [];
  if (claimed.includes(rewardId)) { toast('이미 받은 보상이에요!'); return; }

  // [EMO-REWARD-CFG-1] 금액은 화면에 보인 것과 같은 함수(getClaimableEmotionRewards)에서 읽는다.
  //   전엔 화면은 선생님 설정값, 지급은 고정 기본값이라 둘이 달랐다. 조건도 여기서 한 번 더 본다.
  const reward = getClaimableEmotionRewards(CUR, weekStart).find(r => r.id === rewardId);
  if (!reward) { toast('아직 받을 수 없는 보상이에요'); return; }

  // 지급
  CUR.exp   = (CUR.exp||0)   + reward.exp;
  CUR.gold  = (CUR.gold||0)  + reward.gold;
  CUR.totalGold = (CUR.totalGold||0) + reward.gold;
  CUR.level = Utils.levelFromExp(CUR.exp);

  // 수령 기록 저장
  CUR.emotionRewardsClaimed = CUR.emotionRewardsClaimed || {};
  CUR.emotionRewardsClaimed[weekStart] = [...claimed, rewardId];

  // questLog 기록
  DB.saveQuestLog({
    studentId: CUR.id,
    boardQuestId: null,
    boardQuestType: 'emotion',
    type: 'emotion',
    name: reward.label,
    exp:  reward.exp,
    gold: reward.gold,
    stat: '', statVal: 0,
    icon: '💭',
    date: Utils.todayStr(),
    approved: true,
  });

  DB.saveStudent(CUR);
  renderAll();
  toast(`🎉 ${reward.label} +${reward.exp}EXP +${reward.gold}G!`);
}
let _emoCurrentPeriod = 'am';
let _emoSelectedKey   = null;
let _emoSelectedLevel = null;

function openEmotionModal(period) {
  _emoCurrentPeriod = period;
  _emoSelectedKey   = null;
  _emoSelectedLevel = null;
  _emoEditDate      = null;   // [EMO-DATE-1] 지난 날 수정 창을 저장 없이 닫았어도 '오늘 감정'은 오늘로 저장

  const today = Utils.todayStr();
  const existing = DB_EMOTION.get(CUR.id, today, period);
  const title = period === 'am' ? '오전 감정' : '오후 감정';
  document.getElementById('emotion-modal-title').textContent =
    (existing ? '수정: ' : '') + title;

  // step1 표시
  document.getElementById('emotion-step1').style.display = '';
  document.getElementById('emotion-step2').style.display = 'none';
  document.getElementById('emotion-reason-input').value = existing?.reason || '';

  // 감정 그리드 렌더
  const grid = document.getElementById('emotion-grid');
  grid.innerHTML = EMOTION_DATA.map(e => {
    const isSelected = existing?.emotionKey === e.key;
    return `<button onclick="selectEmotion('${e.key}')"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;
        padding:.45rem .2rem;border-radius:10px;cursor:pointer;font-family:inherit;
        border:1.5px solid ${isSelected ? 'var(--gold)' : 'rgba(255,255,255,.1)'};
        background:${isSelected ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.04)'};
        transition:all .15s">
      <span style="font-size:1.3rem">${e.icon}</span>
      <span style="font-size:.6rem;color:var(--txt2);line-height:1.2">${e.label}</span>
    </button>`;
  }).join('');

  openModal('m-emotion');
}

function selectEmotion(key) {
  _emoSelectedKey = key;
  const e = EMOTION_DATA.find(x => x.key === key);

  // step2로 전환
  document.getElementById('emotion-step1').style.display = 'none';
  document.getElementById('emotion-step2').style.display = '';
  document.getElementById('emotion-selected-display').textContent = e.icon;
  document.getElementById('emotion-selected-label').textContent   = e.label;

  // 강도 버튼 초기화
  _emoSelectedLevel = null;
  [1,2,3].forEach(v => {
    const btn = document.getElementById('elv-'+v);
    btn.classList.remove('success'); btn.classList.add('outline');
  });
  document.getElementById('emotion-submit-btn').disabled = true;
}

function selectEmotionLevel(level) {
  _emoSelectedLevel = level;
  [1,2,3].forEach(v => {
    const btn = document.getElementById('elv-'+v);
    if (v === level) { btn.classList.add('success'); btn.classList.remove('outline'); }
    else             { btn.classList.remove('success'); btn.classList.add('outline'); }
  });
  document.getElementById('emotion-submit-btn').disabled = false;
}

let _emoEditDate = null; // 수정 모드일 때 날짜

function submitEmotion(reason) {
  if (!_emoSelectedKey || !_emoSelectedLevel) {
    toast('마음과 그 크기를 골라 주세요!'); return;
  }
  const saveDate = _emoEditDate || Utils.todayStr();
  DB_EMOTION.save(CUR.id, saveDate, _emoCurrentPeriod, _emoSelectedKey, _emoSelectedLevel,
    reason.trim() || '없음');
  _emoEditDate = null; // 초기화
  closeModal('m-emotion');
  // 오늘 날짜면 홈 카드 갱신, 아니면 감정 탭 갱신
  if (saveDate === Utils.todayStr()) {
    renderMain(); renderMobile();
  } else {
    renderEmotionHistory();
  }
  toast(`💭 감정 기록 완료!`);
}

