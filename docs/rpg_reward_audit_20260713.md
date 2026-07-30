<!-- 생성: 울트라코드 워크플로우(9 에이전트: 4축 탐색 → 적대적 검증 → 종합), 2026-07-13, read-only -->

# 우리반 RPG — 보상 시스템 종합 감사 보고서

**요약: 확정 26건**(🔴 3 · 🟠 11 · 🟡 12) · **반박/기각 7건** · **런타임 확인 필요 4건**
4개 축(지급·대기·기타경로·가시성)에서 올라온 53건을 적대적 검증 판정으로 걸러 중복 통합한 결과입니다. 같은 근본 원인은 하나로 합쳤고, REFUTED/근거 불충분은 최종 목록에서 뺐습니다.

---

## 🔴 즉시

### R1. 게시판 [✔ 완료] → 활동 승인 이중 지급
**파일** `admin.js:4123-4159` (completeQuestForStudent) · `admin.js:4076-4096` (renderBoardQuestList) · `admin.js:947-951` (renderApproveList) · `admin.js:186-190` (대시보드)
**원인** completeQuestForStudent가 exp/gold/stat/totalQuests/questLog만 처리하고 `s.pendingRewards`를 전혀 건드리지 않음. 가드는 `Utils.isQuestDoneToday`(questLog 기준) 하나뿐이라 pending을 못 본다. 대신 지워줄 `cleanQuestPending`(admin.js:4186)은 호출부 0건(Q-3F-1로 제거됨).
**재현** ① 게시판 퀘스트 등록(+30EXP/+20G/read) ② 학생 태블릿에서 신청 → pending 1건 ③ 교사가 [퀘스트] 탭에서 그 학생 줄 [✔ 완료] 클릭(신청중 표시가 없어 교사는 모름) → 지급 ④ [활동 승인] 탭/대시보드에 같은 건이 그대로 남아 있음 → ✅ 클릭 → **exp 60 / gold 40 / totalQuests 2 / questLog 2건**
**교실 영향** 게시판 일괄 완료가 가장 자연스러운 동선이라 신청한 학생만 2배를 받음. 스탯 획득 내역(R20)이 중복을 한 줄로 접어 교사가 눈치채기 어려움. 역순(승인 먼저)은 alreadyDone 가드로 차단되므로 **순수하게 교사의 클릭 순서로 결과가 갈림**.
**주의** 같은 [활동 승인] 탭 안에서도 그리드(admin.js:862-880)는 questStatus로 done을 보고 ✓로 잠기고, 아래 리스트는 ⏳로 남는다 — 한 화면이 스스로 모순된다.
**수정 방향** completeQuestForStudent에서 해당 boardQuestId의 pending을 찾으면 `approveReward(s, reward)`로 위임하고, 없을 때만 현행 로직. 최소한 지급 후 `s.pendingRewards = (s.pendingRewards||[]).filter(r => r.boardQuestId !== questId)`. 목록 쪽은 `Utils.questStatus`로 '⏳ 신청중' 3번째 상태 추가.
**난이도** 파일 1(admin.js) · 위험 중(approveReward 위임 시 R2·R5 동시 해결)

### R2. 금요일 보스 무제한 반복 — EXP까지 지급
**파일** `student.js:3549-3563`(openBoss) · `3566-3578`(doBossFight) · `3580-3586`(claimBoss) · `702-708`(배너)
**원인** boss 관련 코드 4곳 전부에 날짜/수령 플래그가 없음. `claimBoss(gold)`는 gold + exp30 + 레벨 재계산 + triggerLevelUp을 수행하고 questLog도 남기지 않는다.
**재현** 금요일 + `settings.bossActive` ON → 배너 클릭 → [협력 공격!] → 승률 65% → '확인' 버튼 `onclick="claimBoss(150);closeModal('m-boss')"` → 모달 닫고 배너 다시 클릭 → 무한 반복. 10회 = **+1500G, +300EXP**(레벨 실제 상승).
**교실 영향** 전투는 하루 3회 제한 + EXP 0으로 묶어둔 설계인데 보스만 무제한이고 EXP까지 준다. 태블릿 든 학생 1명이 몇 분에 학급 레벨/골드를 무너뜨리고, 로그가 없어 교사가 추적 불가. 덧붙여 배너·안내·결과 3곳이 약속한 **🌱 특별 씨앗은 지급 코드가 아예 없다**.
**수정 방향** `bossClaimedDate`(또는 weekKey)를 학생 문서에 두고 openBoss/doBossFight 진입 차단, claimBoss에서 기록 후 저장, 확인 버튼 1회성. 지급을 questLog에 남기고 `settings.bossGold` 폴백(`||150`) 추가. 씨앗은 지급하거나 문구에서 제거.
**난이도** 파일 1(student.js) · 위험 낮

### R3. [보상 지급] 탭이 능력치를 `parseInt`로 덮어쓰기 — 골드만 줘도 소수점 절삭
**파일** `admin.js:4327-4329`(applyReward) · `4299-4310`(loadRewardStudent) · 대조군 `admin.js:527-529`(saveStudentDetail)
**원인** `s.stats[k] = parseInt(el.value)||0` — 증감이 아닌 **절대값 덮어쓰기 + 정수 절삭**. exp/gold는 delta인데 스탯만 set이라는 혼합 시맨틱.
**재현 A** 0.5짜리 퀘스트 승인으로 read=3.5 → [보상 지급] 탭이 `value="3.5"`로 채움 → 교사가 골드 50만 넣고 [적용] → **read=3**(6개 스탯 전부 절삭).
**재현 B** 탭을 열어둔 채 다른 기기에서 승인이 들어와 read 4→5 → renderAll 목록(admin.js:100-115)에 loadRewardStudent가 없어 input은 4 그대로 → [적용] 누르면 **방금 승인한 +1이 사라짐**.
**재현 C** input을 비우고 적용 → `parseInt('')||0` → 해당 스탯 **0으로 초기화**.
**교실 영향** 교사가 '골드만 주려던' 무해한 조작이 학기 내내 쌓인 스탯을 조용히 훼손. applyReward는 questLog를 안 남겨(R23) 되돌릴 근거도 없다.
**수정 방향** 최소: `Math.round((parseFloat(el.value)||0)*10)/10`(saveStudentDetail과 동일). 구조: 값이 바뀐 칸만 반영(`data-orig` 비교) 또는 스탯도 delta 입력으로 통일 + onDataChange 시 활성 탭이 reward면 재populate.
**난이도** 파일 1 · 위험 낮(한 줄) / 구조 수정은 중

---

## 🟠 곧

### R4. 독서 승인 경로 이원화 — 별점·분류·인물 구조 필드 소실 + 업적 영구 차단
**파일** `admin.js:716-723`(approveReward book 분기) vs `admin.js:2222-2240`(confirmBookRecord) · `student.js:8285-8307`(제출) · `gamedata.js:1345-1346`(업적)
**정정된 서술** 학생이 쓴 **본문 텍스트는 소실되지 않는다** — submitBookRecord가 `bookReview = summary + [인물:…] + reflection`으로 합쳐 넣고 approveReward가 `review`에 보존하며, parseBookContent(admin.js:2009-2018)가 되쪼개 표시한다. 실제 손실은 **구조화 필드**: `rating` `category` `customCategory` `characterName/characterReason` `createdAt` `teacherChecked` `id`.
**재현** 학생 독서 제출 → 같은 pending이 [독서 관리] 탭과 [활동 승인] 탭/대시보드(📚 배지) 양쪽에 뜸 → 교사가 [활동 승인]에서 ✅ → `books.push({title, review, date})` 3필드만 저장.
**교실 영향** ① 독서 탭에서 별점·분류 배지 사라지고 배지가 '미확인' 고정 ② 분류 필터(admin.js:2113 `r.category===filterCat`)에 영영 안 잡힘 ③ **ach_book_char(인물 3회)·ach_book_rate(별점 5회)가 영구 미달성** — 업적이 '교사가 어느 탭을 눌렀는가'로 갈림 ④ [전체 승인] 한 번이면 학급 전체가 이 경로로 처리됨.
**수정 방향** approveReward의 book 분기를 confirmBookRecord와 동일 필드 집합으로 통일(공용 헬퍼 추출) + `id`, `teacherChecked/At` 저장. 또는 목록에서 type==='book'은 '독서 탭에서 확인' 링크로 유도.
**난이도** 파일 1 · 위험 중(books[] 스키마 단일화)

### R5. `books[]`에 id가 없어 교사 코멘트가 다른 책에 저장됨
**파일** `admin.js:2167`(`id="bk-comment-${r.id}"`) · `2264-2276`(saveBookComment) · push 지점 2곳 `admin.js:718-723`, `2223-2238` **둘 다 id 미포함**
**재현** 한 학생의 완료 독서 2권 이상 → 카드마다 `<input id="bk-comment-undefined">` 중복 생성 → 2번째 책에 코멘트 입력 후 [💾 저장] → `getElementById`가 문서상 **첫 번째** 칸 값을 읽어 2번째 책에 저장.
**교실 영향** 교사 피드백이 사라지거나 엉뚱한 책에 붙음. 완료 책 1권인 학생에선 정상 동작해 산발적으로 보임. R4와 별개 원인이라 **함께 고쳐야 함**.
**수정 방향** 두 push 지점에 `id: p.id || ('bk_'+Date.now()+'_'+s.id)` 추가, 렌더 시 없으면 인덱스 기반 대체 id 부여.
**난이도** 파일 1 · 위험 낮

### R6. 같은 퀘스트인데 신청 기기·교사 버튼에 따라 스탯이 최대 3배 차이
**파일** `student.js:8198`(정확 `parseFloat(q.statVal)||1`) · `kiosk.js:705`(**`q.stat?1:0` — statVal 무시**) · `admin.js:4139-4141`(**+1 하드코딩·반올림 없음**) · 표시 `admin.js:4107`(`+1` 하드코딩)
**재현** 퀘스트를 stat=read, statVal=3(admin.html:546 min .1 step .1)으로 등록 → A(태블릿) +3 / B(키오스크) +1 / C(교사 [✔ 완료]) +1.
**교실 영향** 아이가 알 수 없는 요인(어느 기기로 신청했나)으로 성장 수치가 갈림. **키오스크는 카드에 `+3`을 표시하면서 1을 저장**(kiosk.js:169-175 statBadge)해 화면에서까지 불일치. 스탯은 승급·장비 조건(`Utils.condMet`)·능력치 그래프 기준값.
**보이는 값 오표시 위치(정정)** 대시보드 admin.js:271 / 승인 카드 1015의 `statVal||1`은 0.5를 정상 표시한다. 실제 '+1'로 잘못 보이는 곳은 **admin.js:4107**(게시판 카드)과 **completeQuestForStudent의 questLog에 stat/statVal이 없어**(admin.js:4145-4155) 스탯 내역(admin.js:1380 `+${q.statVal||1}`)이 항상 +1로 찍히는 것.
**수정 방향** kiosk.js:705를 student.js:8198과 동일하게. admin.js:4139-4141은 `bq.statVal` 사용 + `Math.round(*10)/10`(또는 R1과 함께 approveReward 위임). admin.js:4107 표시 수정, questLog에 stat/statVal 추가.
**난이도** 파일 3(kiosk.js·admin.js) · 위험 낮 — **R1과 같이 고치면 admin.js 쪽은 자동 해결**

### R7. `totalGold` 미갱신 — 골드 랭킹이 역전되고 누적 골드 업적이 안 열림
**파일** 누락: `admin.js:695-696`(approveReward) · `4136`(completeQuest) · `4321`(applyReward) · `538`(quickGiveGold) · `2241`(confirmBookRecord) / 정상: `admin.js:1232`(승급) · `gamedata.js:1425, 2416/2428/2445` · `student.js:3189/3582/3626/3644/7710/8086`
**재현** ① 학생A가 전투 1회 승리 → `totalGold=12` 필드가 처음 생성 ② 이후 교사 승인으로 2000G 지급 → totalGold는 12에 고정 ③ 랭킹 모달의 `_totalGold`(student.js:8862 `s.totalGold||s.gold`)가 **12G**로 집계 ④ 전투 안 한 학생B는 필드가 없어 gold(800)로 폴백 → **B가 1위, A가 꼴찌** ⑤ ach_gold1000/5000(gamedata.js:1336-1337)도 A는 영구 미달성.
**교실 영향** 앱의 최대 골드 공급원(교사 승인)이 누적 통계에서 전부 빠지고, **전투를 열심히 한 학생일수록 불리해지는 역전**이 생김. 랭킹은 학생이 매일 보는 화면.
**범위(정정)** 교사 랭킹(admin.js:1279-1283)엔 골드 카테고리가 없음 → 영향은 학생 랭킹 모달 + 업적 2종.
**수정 방향** gold를 더하는 지점마다 `s.totalGold = (s.totalGold||0) + 증가분`(차감 제외). 절대값 set 경로(saveStudentDetail)는 정책 결정 필요. 기존 데이터는 questLogs의 gold 합으로 1회 백필(백필 코드는 현재 앱 어디에도 없음).
**난이도** 파일 1(+백필 스크립트 별도) · 위험 낮 / 백필은 중

### R8. 학생에게 보상 도착 알림이 전혀 없고, 레벨업 연출이 승인 경로에서 한 번도 안 뜬다
**파일** `student.js:47-66`(onDataChange — 스냅샷 비교 없음) · `student.js:1183`(claimRewards, 호출부 0건) · `triggerLevelUp` 호출처는 `student.js:1209`(죽은 코드)와 `3586`(claimBoss) 둘뿐
**재현** 교사가 승인 → approveReward가 exp/gold/level을 갱신 → 학생 화면은 `CUR = DB.getStudent(CUR.id)` 후 renderHUD/renderMain/renderMobile만 실행. 이전 값과 비교하는 코드가 없어 toast도 triggerLevelUp도 없음. **Lv.4→Lv.5가 돼도 무음.** 미접속 중 승인이면 다음 로그인 시 숫자만 달라져 있다.
**교실 영향** 보상 피드백 루프 자체가 없음. 전투 EXP는 0 설계라 **레벨의 유일한 정상 획득 경로가 승인인데 거기서 연출이 한 번도 재생되지 않는다**. 감정 보상(student.js:7711)도 레벨 재계산만 하고 연출이 없다.
**참고** '받기 버튼 제거'는 의도된 설계(student.js:8456 주석). 결함은 '자동 지급 사실을 알리는 피드백 부재' 한 가지.
**수정 방향** onDataChange에서 갱신 전 exp/gold/level 스냅샷 → 증가분 toast, level 증가 시 triggerLevelUp. 미접속분은 `lastSeenExp/Gold`로 다음 로그인 시 1회 안내.
**난이도** 파일 1 · 위험 중(리스너가 자주 도므로 중복 토스트 방지 필요)

### R9. 활동내역 모달이 미승인 대기를 '🎁 받기 가능'(초록 승인 배지)으로 표시
**파일** `student.js:8449`(`p.selfApplied ? 'self' : 'claim'`) · `8458`(`qr-status approved` '🎁 받기 가능') · `8456`(`claimBtn=''`)
**원인** `selfApplied`는 저장소 전체에서 **읽기 1곳뿐이고 쓰는 곳이 0** → 항상 'claim' 분기.
**교실 영향** 같은 앱에서 홈 배너(student.js:689 '⏳ 승인 대기중')·게시판(8168)·독서(8347)·작품(7259)은 전부 '대기'로 맞게 표시하는데 **활동내역만 '받기 가능'**. 누를 버튼도 없어 "받기 가능인데 왜 못 받아요?" 문의 → 중복 신청 유도. 반려되면 "받을 수 있다더니 없어졌다" 분쟁.
**수정 방향** pendingRewards는 무조건 '📨 선생님 확인 중'(waiting 스타일)로. selfApplied 분기와 죽은 claimRewards / questStatus의 `approved===true` 분기(gamedata.js:1175-1178)는 제거하거나 봉인 주석. **되살릴 경우 즉시 이중 지급 경로가 되므로 방치가 위험.**
**난이도** 파일 1 · 위험 낮 — R8과 함께

### R10. 활동내역·최근활동이 시간순이 아니라 questLogs **키 사전순**
**파일** `gamedata.js:608`(`Object.values(questLogs)`) · `730`(logId = `studentId_boardQuestId_Date.now()`) · `student.js:8452`(`slice(-10)`) · `admin.js:366`(`slice(-10)`)
**재현** RTDB는 자식을 키 오름차순으로 반환 → 정렬 기준이 **studentId → boardQuestId → 시각**. ① 학생: 자기 로그가 퀘스트 게시 순서로 고정돼 오늘 승인분이 뒤 10개에 못 들어감 ② 교사 대시보드: 학생 필터 없이 뒤 10개 → 사실상 문자열상 가장 큰 학생 1~2명 것만. **s1의 승인은 새로고침 후 최근 활동에서 사라짐**(승인 직후엔 로컬 캐시 push 덕에 잠깐 보임).
**교실 영향** R8(알림 없음)과 겹쳐 치명적 — 학생이 '받았는지' 확인할 유일한 경로와 교사가 '처리됐는지' 확인할 경로가 둘 다 최신 건을 못 보여준다. 대조군으로 `admin.js:1618`(활동 내역 탭)은 date로 정렬하고 있어 화면마다 기준이 다르다.
**수정 방향** questLog에 `ts: Date.now()` 추가, 자르기 전에 정렬(admin.js:1618 방식 재사용).
**난이도** 파일 2(gamedata.js·student.js/admin.js) · 위험 낮

### R11. 감정 주간보상: 화면에 표시된 금액과 실제 지급액이 다름
**파일** `student.js:7700`(`EMOTION_REWARDS.find` — 정적 상수) vs `gamedata.js:1830-1849`(getClaimable — cfg 반영) · 표시 `student.js:715-727` · 설정 저장 `admin.js:4968-4980`
**재현** 교사가 참여 보상을 EXP 100/골드 200으로 저장 → 학생 화면에 '+100EXP +200G [받기]' 표시 → 클릭 → **+20EXP/+15G 지급**(상수 20/15). 토스트·questLog도 20/15.
**교실 영향** 교사 설정이 임계값(회수)만 반영되고 금액은 무시 → 계속 조정하게 됨. 학생은 약속과 다른 금액을 받음(교사가 값을 낮추면 반대로 과다 지급).
**발현 조건(정정)** 기본값이 상수와 동일(20/15·50/40·30/20)하므로 **교사가 설정을 바꾼 학급에서만** 발현.
**부가** claimEmotionReward는 조건을 재검증하지 않고 claimed 여부만 본다 — 화면이 낡으면 조건 미달에도 지급된다.
**수정 방향** `getClaimableEmotionRewards(CUR, weekStart).find(r=>r.id===rewardId)`로 조회(설정 반영 + 조건 재검증 동시 해결), 못 찾으면 거부.
**난이도** 파일 1 · 위험 낮

### R12. questLog의 date가 활동일이 아닌 **승인일**
**파일** `admin.js:741`(`date: Utils.todayStr()` — reward.date 무시) · 대조 `admin.js:714/721`(artwork/book은 원본 날짜 보존) · `gamedata.js:1230-1240`(isQuestDoneToday)
**재현(주간 퀘스트가 대표 사례)** 금요일 신청 → 교사가 다음 주 월요일 승인 → 로그 date가 새 주로 찍혀 `isQuestDoneToday(weekly)`가 **새 주 전체를 done으로 잠금**(신청일이 보존됐다면 재신청 가능). 일일은 pending이 남아 있는 동안 이미 신청이 차단되므로(questStatus에 날짜 조건 없음) 추가 손실은 '승인 직후 그날 재신청 불가' 한 단계.
**교실 영향** 승인을 하루만 미뤄도 학생이 다음 기간 퀘스트를 못 함. 요일별 통계·스탯 내역 날짜가 실제 활동일과 어긋나고, 같은 앱에서 독서/작품은 신청일 기준이라 기준이 이원화.
**수정 방향** `date: reward.date || Utils.todayStr()` + `approvedAt` 별도 필드. **변경 전 사용자 확인 권장** — 금요일 신청분이 새 주에 재신청 가능해지는 것이 의도인지.
**난이도** 파일 1 · 위험 중(daily/weekly 판정 의미가 바뀜)

### R13. 무한배틀 승리는 `finalizeBattle`을 우회 — 도감 첫 처치·구역 완성 보상 영구 소실
**파일** `student.js:3137-3141`(_finishInfiniteBattle이 monsterLog 직접 push) · `gamedata.js:2421-2455`(zone 완성 블록이 `if (isFirstKill)` **안에** 중첩) · finalizeBattle 호출부는 `student.js:2326` 단 1곳
**재현** 교사가 [배틀 허브]→[도감]에서 첫 처치 10G·초급 완성 100G+칭호 저장 → 학생이 무한배틀에서 새 몬스터 처치 → monsterLog에는 기록되지만 보너스 미지급 → 이후 일반 전투로 같은 몬스터를 잡아도 `isFirstKill=false` → **영구 미수령**. 초급의 마지막 한 마리를 무한배틀에서 잡으면 `dexZoneClaimed_beginner`가 **영영 찍히지 않아** 구역 완성 100G+칭호도 도달 불가(도감 화면 student.js:3817은 계속 미수령 표시).
**교실 영향** 교사가 켜 둔 보상이 조용히 새고 회수 경로가 없음. 무한배틀을 즐긴 학생일수록 손해.
**수정 방향** (a) monsterLog 직접 push를 `finalizeBattle(..., {gold:false})` 같은 '도감 처리 전용' 모드로 위임 (b) zone 완성 판정을 `if(isFirstKill)` **밖으로** 빼서 승리마다(또는 도감 진입 시) 재평가 → 이미 어긋난 학생도 회복.
**난이도** 파일 2(gamedata.js·student.js) · 위험 중(골드 이중 지급 주의)

### R14. 승급 시 직업명을 `s.job` 우선으로 계산해 장래희망이 소실
**파일** `admin.js:1227`(`Utils.getJobTitle(s.job || s.dream || '', req.level)`) · `gamedata.js:1197-1202` · `student.js:242-243`(**역순** `CUR.dream || CUR.job`) · `admin.js:614-615`(dream=장래희망, job='학생')
**재현** 장래희망 '수의사' 입력 → job='학생' → Lv5 '중학생' → Lv10 '고등학생' → Lv15 '대학생' → **Lv20 '대학생 지망생'** → Lv30 '위대한 대학생 지망생'. dream이 한 번도 인자로 안 들어감.
**교실 영향** 승급 보상의 핵심 연출(장래희망→직업 성장)이 Lv20부터 완전히 망가지고, 학생 화면과 계산 기준이 반대라 기대값도 어긋남.
**수정 방향** `Utils.getJobTitle(s.dream || s.job || '', req.level)`로 순서 통일. 기존 학생은 dream 기준 1회 재계산으로 복구.
**난이도** 파일 1 · 위험 낮(+데이터 재계산 1회)

---

## 🟡 정리

### R15. `[전체 승인]` 시 questLog / artwork 키가 `Date.now()` 충돌로 덮어써짐
`gamedata.js:727-730` · `admin.js:708` · `admin.js:764-777`(동기 forEach). **충돌 조건(정정)**: boardQuestId가 없어 `manual`로 접히는 건 — 빠른 보상 반복, 독서·작품 pending — 이 한 학생에게 2건 이상 쌓인 상태에서 [전체 승인]. exp/gold는 2건 다 들어가지만 **기록은 1건만 남고, 작품은 이미지 1점이 사라짐**(pending은 이미 제거되어 복구 불가). 타이밍 의존(같은 ms일 때만)이라 간헐적. → 두 id에 `Math.random().toString(36).slice(2,7)` 접미사 또는 push() 키. 파일 2 · 위험 낮

### R16. `_dexBonusLog`가 저장 뒤에 비워져 DB에 남음 — 받은 보너스 토스트가 반복 재생
`student.js:2326→2330(save)→2335(비움, 재저장 없음)`. 이후 onDataChange가 서버본으로 CUR을 덮어쓰면 배열이 되살아나 다음 전투에서 옛 토스트가 다시 뜬다(골드는 1회만 지급). 학생 문서에 임시 필드가 계속 누적. → 배열을 먼저 꺼내고(`const b=CUR._dexBonusLog||[]; CUR._dexBonusLog=[];`) 저장, 또는 finalizeBattle 반환값으로 전환. 파일 1~2 · 위험 낮

### R17. '오늘만' 필터 중에도 뱃지·전체 승인은 전체 기준
`admin.js:951-955`(필터) · `1103-1107`(updatePendingBadge는 전건) · `764-778`(approveAll이 필터 무시·confirm 없음, admin.html:213) · `1077-1088`(approveAllByQuest도 필터 무시). 목록 0건인데 뱃지 5, [전체 승인]은 화면에 없던 '⚠️ 확인 필요 보상'과 독서·작품까지 일괄 승인(R4 필드 유실 동반). 대시보드 approveAllDash(admin.js:645)만 confirm이 있어 비대칭. **부가**: approveAllByQuest가 학생 수만큼 approveSingle을 불러 30명이면 renderAll 30회 + 토스트 31개. → 뱃지를 렌더 결과 기준으로 / approveAll에 필터 반영 + confirm / 루프 밖 1회 렌더. 파일 2 · 위험 낮

### R18. 반려에 통지·사유·기록이 없고, Storage 이미지는 앱 전체에서 삭제되지 않음
`admin.js:780-787`(rejectSingle) · `2279-2287`(deleteBookPending) · `student.js:6862-6890`(업로드). 학생이 쓴 독서 원문은 pending에만 있어 **반려=영구 삭제**, 학생 화면에선 이유 없이 사라짐. `.delete()` / `refFromURL` 호출은 admin.js·student.js 통틀어 **0건**이라 반려뿐 아니라 **작품 삭제 전반에서 파일이 고아로 남는다**(학기 누적 = 용량/비용). → 반려 사유 입력 + `{approved:false, rejected:true, reason}` questLog + `rejectedRewards[]` 보관, Storage best-effort 삭제. 파일 2 · 위험 중(삭제는 신중)

### R19. 즉시 지급 3경로가 questLog를 남기지 않음
`admin.js:4312-4335`(applyReward) · `534-542`(quickGiveGold) · `506-531`(saveStudentDetail). 활동 내역 탭·통계·학생 활동내역 어디에도 흔적 0 → '이 학생 골드가 왜 많지'를 추적 불가, 오입력 복구 불가(saveStudentDetail은 level→exp 재계산까지 함). → `{type:'manual', name:'선생님 직접 지급', approved:true}` 로그(변화량이 0이 아닐 때만). 파일 1 · 위험 낮

### R20. 스탯 획득 내역이 미승인 pending을 실제 획득분과 섞고, 중복 지급을 한 줄로 접음
`admin.js:1352-1358`(pendingLogs 병합 + `name+date+stat` dedup) · `1368-1390`(구분 없는 렌더, '현재 N점 · M건'). 미지급 3건이 획득 행으로 표시돼 점수와 건수가 어긋나고, **R1의 이중 지급이 dedup으로 화면에서 사라진다**. 게다가 completeQuestForStudent 로그엔 stat/statVal이 없어 0.5짜리도 +1로 표시. 학부모 상담 근거 화면. → pendingLogs를 '⏳ 승인 대기(미반영)' 별도 섹션/배지로 분리, dedup 키를 `log._id`(gamedata.js:729)로 변경. 파일 1 · 위험 낮

### R21. 레벨을 건너뛰면 승급 보상(+100G/+50EXP/직업 변경)을 영구히 못 받음
`student.js:270 / 681-683`(canPromo가 `isPromotionLevel(s.level)` 정확 일치) · `student.js:229-238`(**promotedLevels 자동 복구가 `lv < CUR.level`인 승급 레벨을 '이미 승급함'으로 영구 기록**). 밀린 pending을 [전체 승인]으로 한꺼번에 처리하면 Lv4→Lv6 점프가 실제로 쉽게 일어남(Lv5=700, Lv6=1020, 일일 80/주간 150 EXP). 교사 화면에도 '미수령 승급' 표시가 없다. → canPromo를 '현재 레벨 이하의 promotionLevels 중 미승급 최대값'으로 바꾸되 **자동 복구 루프를 함께 손봐야 유효**. 파일 1 · 위험 중

### R22. `confirmBookRecord`가 questLog에 `approved`를 안 넣어 대시보드에 영구 '대기' 표시
`admin.js:2250-2258` vs `admin.js:378`(`q.approved ? '승인' : '대기'`). 독서 탭에서 확인 승인한 기록이 최근 활동에 계속 '대기'로 남음 — 같은 책을 [활동 승인] 탭에서 처리하면 '승인'으로 뜬다. **원 보고의 B(`p.exp||30`)·C(stat 누락)는 도달 불가로 기각.** → `approved:true, boardQuestType:'book'` 추가. 파일 1 · 위험 낮

### R23. 업적 팝업·목록이 골드 보상을 항상 '+20'으로 표시
`student.js:10071`(`'+20 골드'`) · `student.js:8879`(`'+20G'`) · 실제 지급 `gamedata.js:1425`(`a.reward.gold||20`). 실제 분포는 10~200G. ach_meta_all(200G)도 '+20 골드'로 안내. **알려진 `||20` 오지급을 고칠 때 표시부를 같이 안 고치면 '표시 0G / 지급 20G'로 불일치가 커짐** → 반드시 동시 수정. 파일 1 · 위험 낮

### R24. `checkNew`에 캐스케이드가 없어 재계산 1회로 메타/레벨 업적이 안 잡힘
`gamedata.js:1411-1440`(1단계 판정 → 2단계에서 achievements/level 갱신) · `1393-1394`(meta_10ach/20ach) · `1332-1335`(lv 업적) · `admin.js:3266-3279`(recalcAll이 1회 호출 후 개수 notify). 교사가 '재계산 완료' 알림을 보지만 미달성이 남음. 학생 접속 시 자동 회복되므로 실피해는 '보고 수치 부정확 + 지연'. → checkNew를 변화 없을 때까지 루프(상한 5) 또는 recalcAll에서 2회 호출. 파일 1 · 위험 낮

### R25. 고아 승급 요청의 [🗑️ 삭제] 버튼이 TypeError로 100% 실패
`admin.js:1260-1264`(rejectPromotion — `DB.getStudent` null 가드 없이 `s.promotionPending`) · `1141-1151`(고아 카드가 이 함수만 호출). 승급 배지가 영영 안 줄고 하단 [🧹 일괄 정리]를 아는 교사만 해결 가능. **대시보드 경로는 admin.js:294가 고아를 걸러내므로 approvePromotion 크래시는 사실상 도달 불가(정정).** → `if(!s){ DB.removePromotionRequest(reqId); renderAll(); return; }`. 파일 1 · 위험 낮

### R26. 학생 상세로 보정한 `bookCount`가 다음 독서 승인 때 되돌아감
`admin.js:523`(교사 입력) vs `admin.js:725 / 2238`(`s.bookCount = s.books.length` 무조건 덮어쓰기). 전학생 등으로 10을 넣어 ach_book10이 달성된 뒤 독서 1건 승인 → bookCount=1로 되돌아가 '달성했는데 조건 미달' 상태가 남음(업적은 회수되지 않음). → 입력을 읽기 전용으로 하거나 books 배열을 단일 출처로. 파일 1 · 위험 낮

### R27. 교사가 추가한 커스텀 몬스터가 학생 전투에 아예 등장하지 않음
`admin.js:4841-4851`(saveMonsterEdit이 hp/zone/reqStat/element 미저장) · `gamedata.js:2548-2552`(generateBattleOffers가 `GAME_DATA.monsters`만 zone 필터) · `student.js:1897-1901`(renderMonsters는 `monster-list` 요소가 student.html에 없어 즉시 TypeError = 죽은 코드).
**정정** 원 보고의 '승률 10% 고정·전투 횟수 소모·업적 카운트 부풀림'은 **도달 불가라 기각**. 실제 결함은 ① 교사가 만든 몬스터가 학생에게 전혀 안 나옴 ② `getActiveMonsters().length`가 도감 분모(student.js:3794)에 들어가 **도감이 영원히 미완성으로 보임**(zone 진행 바는 zone 없어 제외). → 신규 커스텀에 zone/hp 등 기본값을 채우거나, 도감 분모에서 커스텀 제외. 파일 2 · 위험 낮

---

## 보상 경로 일관성 표

| # | 경로 (파일:줄) | exp | gold | **totalGold** | stat | questLog | 레벨 재계산 | 학생 알림 |
|---|---|---|---|---|---|---|---|---|
| 1 | **approveReward** (승인 8경로 공통) `admin.js:693` | ✅ | ✅ | ❌ **R7** | ✅ statVal·0.1 | ✅ approved:true / **date=승인일 R12** | ✅ | ❌ **R8** |
| 2 | **completeQuestForStudent** 게시판 ✔완료 `admin.js:4123` | ✅ | ✅ | ❌ **R7** | ⚠️ **+1 고정·반올림X R6** | ⚠️ stat/statVal/boardQuestType 누락 | ✅ | ❌ |
| 3 | **confirmBookRecord** 독서탭 확인 `admin.js:2213` | ✅ | ✅ | ❌ **R7** | — | ⚠️ **approved 누락 R22** | ✅ | ❌ |
| 4 | **applyReward** 보상지급탭 `admin.js:4312` | ✅ delta | ✅ delta | ❌ **R7** | 🔴 **절대값·parseInt 절삭 R3** | ❌ 없음 **R19** | ✅ | ❌ |
| 5 | **quickGiveGold** +골드 `admin.js:534` | — | ✅ delta | ❌ **R7** | — | ❌ 없음 **R19** | — | ❌ |
| 6 | **saveStudentDetail** 학생상세 `admin.js:506` | ✅ 절대값 | ✅ 절대값 | ❌ **R7** | ✅ 0.1 절대값 | ❌ 없음 **R19** | ✅ | ❌ |
| 7 | **approvePromotion** 승급 `admin.js:1222` | ✅ +50 | ✅ +100 | ✅ | — | ✅ | ✅ | ❌ |
| 8 | **claimEmotionReward** 감정주간 `student.js:7698` | ⚠️ **상수값 R11** | ⚠️ **상수값 R11** | ✅ | — | ✅ | ✅ (연출 ❌) | ✅ toast(**금액 오표시**) |
| 9 | **finalizeBattle** 전투 `gamedata.js:2412` | ❌ *(의도된 설계)* | ✅ | ✅ | — | ❌ | — | ✅ (**R16 반복 토스트**) |
| 10 | **무한배틀** `student.js:3120 / 3182` | ❌ | ✅ 세션말 1회 | ✅ | — | ❌ | — | ✅ 화면 (**R13 도감보상 누락**) |
| 11 | **claimBoss** 금요일보스 `student.js:3580` | ✅ +30 | ✅ | ✅ | — | ❌ **무기록** | ✅ triggerLevelUp | ✅ (**R2 무제한**) |
| 12 | **checkNew** 업적 `gamedata.js:1411` | ✅ | ✅ (`\|\|20`) | ✅ | — | ❌ | ✅ (**R24 캐스케이드 없음**) | ✅ 팝업(**R23 +20G 오표시**) |

**읽는 법** — `approveReward`를 우회하는 경로(2·3·4·5·6)가 전부 불일치의 원천이다. 승인 8경로(approveSingle/All/Dash/Grid/AllByQuest/SelfApply/Artwork)는 모두 1을 통과하므로 지급 결과가 동일하고, 실제로 결과가 갈리는 건 이 5개 우회 경로뿐이다. **totalGold는 교사측 경로 중 승급(7)만 갱신**한다.

---

## 얽힌 항목 묶음 (하나 고치면 같이 해결)

**묶음 A — `approveReward` 우회 통일** : R1 · R6(admin 쪽) · R12 · R20(중복 표시)
completeQuestForStudent를 approveReward로 위임하면 이중 지급·statVal 불일치·questLog 스키마 누락이 한 번에 해결. 단 R6의 kiosk.js:705는 별도 수정 필요.

**묶음 B — 독서 스키마 단일화** : R4 · R5 · R22
`books[]`를 만드는 두 지점(approveReward book 분기 / confirmBookRecord)을 공용 헬퍼로 뽑고 id·teacherChecked·approved를 함께 넣으면 필드 소실 + 코멘트 오저장 + 대시보드 '대기' 표시가 동시에 해소.

**묶음 C — 골드 통계 정합** : R7 · R19
gold를 더하는 지점에 totalGold를 붙이는 김에 questLog도 남기면 백필 근거가 생긴다. **백필은 R7 수정 이후에 해야** 이중 계상이 안 난다.

**묶음 D — 학생 피드백** : R8 · R9 · R10 · R23
onDataChange 알림 + 라벨 수정 + 목록 정렬 + 업적 표시가 전부 '학생이 뭘 받았는지 아는가'라는 하나의 UX 결함. 함께 처리해야 체감이 생김.

**묶음 E — 도감 보상** : R13 · R16 · R27
finalizeBattle 주변을 만질 때 한 번에. zone 완성 판정을 `isFirstKill` 밖으로 빼면 이미 어긋난 학생도 회복된다.

**주의 — 반대 방향 의존** : R23(업적 표시 `+20G`)은 알려진 `(a.reward.gold||20)` 수정과 **반드시 동시에**. 한쪽만 고치면 gold:0 업적에서 '표시 0G / 지급 20G'로 불일치가 오히려 커진다.

---

## 반박된 것 (헛수정 방지 — 고치지 마세요)

1. **커스텀 몬스터 승률 10% 고정·전투 횟수 소모·업적 카운트 부풀림** — REFUTED. 학생 전투 진입점은 `generateBattleOffers`(GAME_DATA.monsters만)와 `_ibPickMonster`뿐이고, 커스텀을 포함하는 `renderMonsters`는 `monster-list` 요소가 student.html에 없어 죽은 코드다. 커스텀 몬스터는 학생이 전투할 수 없으므로 monsterLog에 `cm_` id가 쌓이지도 않는다. → 실제 결함은 R27(등장 안 함 + 도감 분모 오염)로 축소.
2. **같은 boardQuestId pending 2건 → 그리드에서 못 잡힘 / [전체(N)]이 1건만 승인** — REFUTED. 신청부 2곳(student.js:8186, kiosk.js:691) 모두 questStatus로 pending을 차단하고, 그 판정에 날짜 조건이 없어 중복이 생기지 않는다. quickApprove 대기는 boardQuestId가 없어 그리드에 아예 안 나온다. 키오스크 통짜 set은 중복이 아니라 **유실**을 만든다(기존 알려진 항목). → 실재하는 불일치는 R17(필터 무시 + 렌더 폭주)뿐.
3. **독서 승인 시 줄거리·느낀점 본문 영구 소실** — 부분 반박. `bookReview`에 합쳐져 `review`로 보존되고 parseBookContent가 복원 표시한다. 소실은 구조화 필드에 한정(R4).
4. **`p.exp||30`이 exp 0 설계를 삼킴 / 독서 pending의 stat 누락** — 기각. 독서 exp는 student.js:8300에 30 하드코딩이고 이를 설정하는 UI/settings 키가 없어 도달 불가. stat도 실피해 없음.
5. **`approvePromotion`이 고아 요청에서 크래시** — 기각. 고아 카드는 [🗑️ 삭제]만 렌더하고 대시보드는 admin.js:294에서 고아를 걸러낸다. 실제 버그는 rejectPromotion 한 곳(R25).
6. **커스텀 몬스터 때문에 구역 완성 보상이 샌다** — 기각. 커스텀은 zone 필드가 없어 zone 집계와 무관. 구역 완성 유실은 무한배틀(R13)에만 해당.
7. **레거시 `doFight` 승리 경로(student.js:2469-2474) 수정 필요** — 기각. GAME_DATA 몬스터 100마리 전부 hp를 가지고 있고 커스텀은 도달 불가라 이 분기는 실행되지 않는다.

**보류(UNCERTAIN, 배포 전 1회 점검)** — `approveReward`/`rejectSingle`의 pending 제거 조건 `r.id !== reward.id && r.label !== reward.id`(admin.js:745-748, 783). `reward.id`가 undefined이면 **id 없는 모든 대기 보상이 함께 삭제**된다. 도달 가능한 유일 경로는 `approveAllByQuest`(admin.js:1080-1082, id 없는 객체를 boardQuestId로 먼저 찾은 뒤 `reward.id`=undefined 전달). 현재 생성 경로 5곳은 모두 id를 넣으므로 **실 DB에 id 없는 레거시 pending이 있는지 확인 후** 판단. 없으면 죽은 조건 정리만.

---

## 런타임 확인 필요 (코드로 확정 못 한 것)

1. **레거시 pendingRewards** — 실 Firebase에 `id` 없는 pending이 존재하는가(위 보류 항목의 전제).
2. **R15 키 충돌 빈도** — 동기 루프인 것은 확정했으나 실제 같은 ms에 떨어지는 빈도는 미측정. 교사 PC 1대에서 [전체 승인]을 눌러 questLogs 개수와 지급 합계가 맞는지 1회 대조 권장.
3. **R12 정책 결정** — 신청일 기준으로 바꾸면 금요일 신청분이 다음 주 재신청 가능해진다. 의도인지 사용자 확인 필요.
4. **일일퀘스트 포트폴리오**(`student.js:1824-1836`) — `questDateMap`이 boardQuest의 **게시일 1일**만 담아, 한 번 게시해 몇 주 유지되는 일일퀘스트는 게시 주 이후 period에서 `totalDone`이 항상 0으로 나올 가능성이 있음. R12와 별개 원인이며 실화면 1회 확인 권장.

---

## 권장 수정 순서

| 순서 | 항목 | 근거 | 난이도 |
|---|---|---|---|
| **1** | R2 보스 무제한 | 학생 1명이 몇 분에 학급 밸런스 파괴·추적 불가. 금요일 전에 막아야 함 | 파일 1 · 낮 |
| **2** | R1 + R6 + R12 + R20 (**묶음 A**) | 매일 발생하는 이중 지급·기기별 스탯 차이. 형평성 직결 | 파일 3 · 중 |
| **3** | R3 applyReward parseInt | 한 줄 수정으로 조용한 스탯 훼손 차단 | 파일 1 · 낮 |
| **4** | R4 + R5 + R22 (**묶음 B**) | 학생 산출물 손상 + 업적 영구 차단. 복구 불가 | 파일 1 · 중 |
| **5** | R8 + R9 + R10 + R23 (**묶음 D**) | 보상 피드백 루프 전체 부재. 학생 체감 최대 | 파일 2 · 중 |
| **6** | R7 + R19 (**묶음 C**) | 랭킹 역전·업적 미달성. 수정 후 백필 별도 | 파일 1 + 스크립트 · 중 |
| **7** | R11 감정 보상 표시≠지급 | 설정 바꾼 학급에서 즉시 발현, 수정 간단 | 파일 1 · 낮 |
| **8** | R13 + R16 + R27 (**묶음 E**) | 교사가 켜 둔 보상이 새는 문제. 회수 로직 포함 | 파일 2 · 중 |
| **9** | R14 · R21 · R25 | 승급 클러스터. 데이터 재계산 1회 동반 | 파일 2 · 중 |
| **10** | R15 · R17 · R18 · R24 · R26 | 운영 편의·기록 정합. 급하지 않음 | 각 파일 1~2 · 낮~중 |

**작업 순서 주의** — ①묶음 A를 먼저 하면 R6의 admin 쪽·R20의 표시 문제가 자동 해소되므로 R6/R20을 따로 손대지 말 것. ②R7 백필은 R7 코드 수정 **이후**에 실행. ③R23은 알려진 `(a.reward.gold||20)` 수정과 **같은 커밋**으로.
