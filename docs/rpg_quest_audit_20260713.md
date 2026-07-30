<!-- 생성: 울트라코드 워크플로우(13 에이전트: 6축 탐색 → 축별 적대적 검증 → 종합), 2026-07-13, read-only -->

# 우리반 RPG — 퀘스트 기능 종합 감사 보고서

**작성**: 종합자 (6개 축 조사 + 적대적 검증 통합) · **모드**: read-only (수정·git 작업 없음)
**대상**: `/Users/dobuk/Projects/우리반RPG/우리반RPG_리팩토링` (student.js / admin.js / kiosk.js / gamedata.js)

---

## 요약

| 항목 | 수 |
|---|---|
| 원시 발견 (6축 합계) | 67건 |
| 검증 판정 | CONFIRMED 66 · UNCERTAIN 1 · REFUTED 0 (단, **부분 반박 9건** — 아래 반박 섹션) |
| 중복 제거 후 최종 | **38건** |
| 그중 **NEW** | 30건 |
| 기존 Q1~Q7 **보강** | 8건 |
| 심각도 | 🔴 5 · 🟠 15 · 🟡 18 |

**한 줄 결론**: 퀘스트 보상 지급 경로가 **4갈래**(학생 태블릿 신청→승인 / 키오스크 신청→승인 / 교사 [✔완료] / 교사 빠른보상)인데 **네 경로가 서로를 모른다**. 중복 지급·능력치 격차·기록 유실이 전부 여기서 나온다. 승인 함수 `approveReward`에 멱등 가드 한 줄만 넣어도 최상위 3건 중 2건이 막힌다.

내가 직접 재확인한 코드: `admin.js:693-751`(approveReward), `admin.js:4123-4160`(completeQuestForStudent), `gamedata.js:1165-1240`(questStatus/isQuestDoneToday), `kiosk.js:679-716`(requestQuest). 보고서의 🔴 항목 근거는 전부 이 원문과 일치함을 확인했다.

---

## 🔴 즉시 수정 (5건)

### A1. 교사 [✔ 완료] → 학생 신청이 남아 있어 같은 퀘스트 보상 2배 지급 — **NEW**

**파일:줄**
- `admin.js:4079` — `doneSids`를 `Utils.isQuestDoneToday`(로그)만으로 계산 → 신청중(⏳) 학생에게도 [✔ 완료] 버튼 노출 (`admin.js:4092-4093`)
- `admin.js:4123-4160` — `completeQuestForStudent` 전체에 `pendingRewards` 문자열이 **한 번도 없음** (지급만 하고 신청은 안 지움)
- `admin.js:693-751` — `approveReward`에 "이미 완료됐는지" 가드가 **전혀 없음**
- `admin.js:947-951`(활동 승인 목록) · `admin.js:185-189`(대시보드) — `!r.approved`만 보고 그대로 렌더

**재현**
1. 학생 A가 키오스크/태블릿에서 '아침 독서' 신청 → `pendingRewards` 1건
2. 교사가 **퀘스트 관리** 탭을 열면 A는 여전히 미완료로 보이고 [✔ 완료] 버튼이 있음(신청중 표시 없음) → 클릭 → exp/gold/스탯/totalQuests 지급 + questLog 1건
3. **활동 승인** 탭·대시보드에는 A의 대기 카드가 그대로 남고 좌측 뱃지도 1 유지
4. 교사가 정리하려고 ✅ 승인(또는 [전체 승인]) → **exp/gold/스탯/totalQuests 또 지급 + questLog 2건**

**교실 영향**: 한 번 한 일에 보상 2배. 뱃지가 남아 있어 교사가 재승인하도록 **오히려 유도**된다. 능력치 내역 화면은 이름+날짜+스탯으로 중복 제거(`admin.js:1358`)해서 이중 지급이 화면상 보이지도 않는다. 되돌리려면 교사가 수동으로 exp/gold를 깎아야 함.

> 검증 보강: **빠른 승인 그리드**(`renderApproveGrid`, `admin.js:862-921`)는 `Utils.questStatus`를 써서 done이면 ✓로 막힌다. 뚫리는 곳은 **대시보드 카드 · 활동 승인 목록 카드 · [전체 승인] · [전체(N)]** 네 곳.

**수정 방향**
- (필수) `approveReward` 진입부에 `Utils.isQuestDoneToday(db.quests, student.id, reward.boardQuestId, reward.boardQuestType)` 가드 → 이미 로그가 있으면 pending만 제거 + 안내
- (권장) `completeQuestForStudent` 시작부에서 해당 `boardQuestId`의 pending 제거(또는 pending이 있으면 `approveReward` 경로로 위임)
- (권장) `renderBoardQuestList`를 `isQuestDoneToday` → `Utils.questStatus`로 바꿔 ⏳ 신청중 표시

**난이도**: admin.js 3함수 / **낮음~중간**. 가드 추가만이면 5줄, 위험 낮음.

---

### A2. 완료 로그 date가 '신청일'이 아니라 '승인일' → 주간퀘스트 한 주 통째로 잠김 — **NEW**

**파일:줄**
- `admin.js:741` — `date: Utils.todayStr()` (같은 함수 `admin.js:714` artwork·`721` book은 `reward.date`를 쓰는데 **퀘스트 로그만** 오늘로 덮어씀)
- `admin.js:4154` — `completeQuestForStudent`도 동일
- `gamedata.js:1236` — `if (questType==='weekly') return q.date >= weekStart` (일요일 시작)
- `admin.js:1487-1497` — `renderDqSummary`의 `logDateMap`이 이 date로 버킷팅

**재현 (A) 주간퀘스트 도둑 — 심각**
금요일에 학생이 주간퀘스트 신청 → 교사가 월요일에 승인 → `questLog.date = 월요일` → `isQuestDoneToday(weekly)`가 **이번 주 이미 완료**로 판정 → 그 학생만 새 주 주간퀘스트가 **처음부터 ✅로 잠기고 재신청 불가**. weekly는 자동 마감 대상이 아니라(`gamedata.js:793`·`student.js:10107` 모두 daily만) 같은 id가 주마다 재사용되므로 확실히 발생.

**재현 (B) 일일 집계 과소**
화·수 각각 신청한 것을 목요일에 몰아 승인 → 로그 2건 모두 date=목요일 → `logDateMap`이 **날짜 Set**이라 1건으로 합쳐짐 → 일일퀘스트 기록에 '1/3일'(목요일에도 퀘스트가 올라와 있으면 분모 3).

**교실 영향**: 교사가 하루라도 승인을 미루면 아이가 주간 보상 기회를 잃는데, 본인 화면은 이미 ✅라 항의할 근거도 못 찾는다. 교사가 가장 많이 보는 성실도 표 숫자가 실제보다 낮게 나온다.

**수정 방향**: `admin.js:741`을 `date: reward.date || Utils.todayStr()`로(book/artwork와 동일 방식). 승인 시각은 `approvedAt` 별도 필드로. `completeQuestForStudent`도 동일 정책.
⚠️ 부작용 확인 필요: 이러면 '어제 신청분을 오늘 승인'해도 오늘 완료로 안 잡히므로, 일일 리셋 정책과 정합성 한 번 점검.

**난이도**: admin.js 2줄 / **낮음** (단, 집계 화면 영향 검토 필요 → 중간)

---

### A3. 능력치 수치(statVal)를 3개 경로 중 1개만 지킨다 + 화면 표시와 실제 지급 불일치 — **NEW**

**파일:줄**

| 경로 | 코드 | 결과 |
|---|---|---|
| 학생 태블릿 신청 | `student.js:8198` `q.stat ? (parseFloat(q.statVal)\|\|1) : 0` | ✅ 교사 설정값 |
| **키오스크 신청** | `kiosk.js:705` `statVal: q.stat?1:0` | ❌ 항상 1 |
| **교사 [✔완료]** | `admin.js:4140` `s.stats[bq.stat] = (…\|\|0) + 1` | ❌ 항상 1 |
| 승인 계산 | `admin.js:700-703` `reward.statVal` + 소수1자리 반올림 | (설계상 소수 지원) |

표시 쪽도 어긋남: 키오스크 배지 `kiosk.js:169-176`은 `q.statVal`을 그대로 찍어 **'📚 독서 +3'이라 써 놓고 실제 +1 지급**. 교사 게시판 목록 `admin.js:4107`은 statVal과 무관하게 `+1` 문자열 하드코딩. 교사 입력 UI는 `admin.html:546` step=0.1/max=10으로 소수를 명시적으로 지원.

추가: `completeQuestForStudent`의 `saveQuestLog`(`admin.js:4146-4156`)에는 **stat/statVal/boardQuestType이 아예 없다** → 나중에 그 퀘스트를 삭제하면 능력치 기록 화면의 `bqStatMap` 폴백(`admin.js:1348`)이 사라져 그 학생 기록만 통째로 누락된다.

**교실 영향**: 같은 활동인데 **어느 기기로 체크했느냐**에 따라 능력치가 다르게 오른다. 아이들이 바로 비교해서 알아채고, 교사는 화면상 단서가 없다(키오스크는 +3이라고 써 있으므로 오히려 교사도 오해).

> 검증 정정: 모든 생성 경로의 기본 statVal이 1이므로 **교사가 기본값을 바꾼 경우에만** 발동한다. 상시 발생은 아님(그래서 high, critical 아님). 다만 키오스크가 주 신청 창구인 교실에서는 "교사가 설정한 statVal이 대부분 무시된다"가 본질.

**수정 방향**: `Utils.statGain(quest)` 하나를 만들고 `kiosk.js:705` · `admin.js:4140` · `admin.js:4107` 세 곳이 호출. `completeQuestForStudent`의 saveQuestLog에 stat/statVal/boardQuestType 추가 + `approveReward`와 같은 반올림.

**난이도**: 3파일 4곳 / **낮음**. 위험 낮음(계산식만).

---

### A4. 독서 기록을 '활동 승인'·대시보드에서 승인하면 학생이 쓴 본문이 영구 유실 — **NEW**

**파일:줄**
- `student.js:8286-8307` — 제출 시 category/rating/characterName/characterReason/summary/reflection/bookDate 전부 담김
- `admin.js:716-723` — `approveReward`의 book 분기가 **`{title, review, date}` 3필드만** books에 push
- `admin.js:2213-2263` — 전용 경로 `confirmBookRecord`는 전 필드 + teacherChecked/teacherComment 저장
- `admin.js:947-951, 1006` — 활동 승인 목록이 book pending도 📚 배지와 ✅ 버튼으로 렌더
- `admin.js:764-778` — `approveAll`에 타입 필터 없음

**재현**: 학생이 별점·인물·줄거리·느낀점까지 채워 제출 → 교사가 '독서 현황' 탭이 아니라 **대시보드 또는 활동 승인 탭**에서 ✅(또는 [전체 승인]) → 별점·분류·인물·요약·느낀점·teacherChecked가 **복구 불가하게 소실**. 게다가 그렇게 저장된 book에는 `id`가 없어 독서 현황 탭에서 `bk-comment-undefined` 중복 id가 생기고(`admin.js:2166`) '미확인' 배지로 남는다.

**교실 영향**: 대시보드 [전체 승인]은 "대기 중인 보상을 전체 승인할까요?"만 묻는다. 퀘스트를 정리하려는 교사가 아이들이 공들여 쓴 독서 기록을 통째로 날린다.

**수정 방향**: `approveReward`의 book 분기를 `confirmBookRecord`와 같은 필드 집합으로 맞추거나, book 타입은 전용 함수로 위임. `approveAll`은 type이 quest인 것만 처리.

**난이도**: admin.js 1함수 + approveAll 필터 / **중간** (독서 스키마 정합 확인 필요)

> ⚠️ **artwork는 반박됨** — 아래 반박 섹션 참조.

---

### A5. 키오스크가 일일 리셋을 트리거하지 않음 → 아침에 체크한 신청이 '닫힌 퀘스트'로 밀림 — **Q3 보강 + NEW**

**파일:줄**
- `kiosk.js:17-72` — `window.onload`에 `ensureDailyQuests`/`autoCloseDailyQuests` 호출 **없음** (호출부는 `admin.js:66`, `student.js:182·187` 뿐)
- `kiosk.js:679-716` — `requestQuest`가 퀘스트의 `type`/`date`를 전혀 확인하지 않음
- `student.js:10104-10116` · `gamedata.js:793-798` — `date!==today`인 daily를 active:false, 오늘치는 **다른 id**(`bq_auto_<날짜>_<i>`)로 새로 생성
- `admin.js:970-989` — 그 pending은 '🚫 닫힌 퀘스트'로 분류되어 ⚠️ 확인 필요 섹션으로 이동

**재현**: 키오스크는 어제부터 켜져 있음 → 오늘 8:30, 아직 아무도 로그인 안 함 → 게시판에는 어제 daily가 active:true로 남아 있음 → 아이들이 어제 미완료 ○ 칸을 체크 → **어제 id로 pending 생성** → 1교시에 학생 1명 로그인 → 어제 퀘스트 비활성 + 오늘치 새 id 생성 → 아침 체크는 키오스크 표에서 **행 자체가 사라지고** 교사 승인 탭의 경고 섹션으로 밀림 → 아이들이 오늘 id로 다시 체크(같은 활동 pending 2건).

> 검증 정정: "밤새 ✓가 자동으로 ○로 리셋된다"는 사실이 아니다. 키오스크에는 날짜 타이머가 없어 렌더는 DB 변경(`kiosk.js:36`)이나 visibilitychange(`kiosk.js:99`)에만 돈다. 실제 경로는 **어제 미완료 ○ 칸을 누르는 것**.

**교실 영향**: 아침 체크판 루틴이 깨진다. 아이는 "체크했는데 없어졌다", 교사는 정상 승인 목록이 아닌 경고 섹션에서 아침치를 찾아야 한다.

**수정 방향**: 키오스크 onload + 1분 타이머로 `Utils.todayStr()` 변화 감지 시 `DB.ensureDailyQuests()` 호출. 최소 조치로 `requestQuest`에서 `q.type==='daily' && q.date!==Utils.todayStr()`이면 "오늘 퀘스트가 아직 안 올라왔어요"로 차단. 근본적으로는 일일 리셋을 **클라이언트 로그인 부수효과가 아닌 명시적 트리거**로 분리(Q1과 같은 뿌리).

**난이도**: kiosk.js 2곳 / **중간** (Q1 구조 개편과 함께 하면 낮아짐)

---

## 🟠 곧 수정 (15건)

### B1. 일일/주간 탭 하단의 '능력치' 선택 박스가 읽히기만 하고 반영되지 않는 죽은 UI — **NEW**
`admin.js:3874-3875`(tabStat/tabStatVal 계산 후 미사용 — 전 파일에서 이 두 줄에만 등장) · `admin.html:441-454, 468-481` · 게시는 행별 select만 읽음(`admin.js:3884-3902`)
**재현**: 커스텀 항목 추가 → 눈에 띄는 하단 '능력치: [건강][1]' 박스 지정 → 게시 → `stat:''`, `statVal:0`으로 나감 → `approveReward`의 `if (reward.stat && reward.statVal)` 미통과 → **능력치 0 지급**
**정정(중요)**: 각 행에도 개별 능력치 select가 있고 그건 정상 동작한다. 기본 템플릿은 `t.stat`이 행 select에 복원되어 가려지고, `saveCustomTemplate`이 `stat:''`만 저장(`admin.js:3602-3609`)하므로 **커스텀 항목에서만 증상이 드러난다**.
**수정**: 행 select가 비면 tabStat으로 폴백하거나, 하단 컨트롤을 제거해 일원화. **난이도**: admin.js 1곳 또는 admin.html 삭제 / 낮음

### B2. 키오스크 `requestQuest`에 active 검사 없음 — **Q4 검증 + NEW**
`kiosk.js:686` `find(x=>x.id===questId)` (active 무검사) · `kiosk.js:691` `questStatus(..., null)` → `gamedata.js:1168` 가드 무력화 · 학생은 `student.js:8181` `x.active!==false`로 차단
**재현**: 교사가 방금 [🗑️ 닫기] 한 퀘스트를 키오스크에서 탭 → 신청 저장 + '✅ 신청했어요' 토스트. 같은 행동이 태블릿에서는 무반응.
**Q4 관련 정정**: `kiosk.js:691`의 `null` 인자는 이 자리에서 **더 느슨해지는 방향이 아니다**(오히려 비활성 퀘스트의 기존 pending/done을 인정해 중복 신청을 막아 줌). 진짜 결함은 686행. 686을 고친 뒤 691에 activeBQIds를 넘기는 순서로 정리할 것.
**난이도**: kiosk.js 2줄 / 낮음

### B3. 키오스크 감정/추억 탭에 있는 동안 퀘스트 표가 갱신 안 되고, 되돌아와도 재렌더 안 함 — **NEW**
`kiosk.js:338-357`(switchKioskTab이 display만 토글, isQuest일 때 renderTable 호출 없음) · `kiosk.js:42-46`·`104-106`(현재 탭만 렌더). `renderTable()` 호출부는 45·62·106 세 곳뿐.
**교실 영향**: 몇 시간 전 DOM이 그대로 다시 보인다. 아이가 ○를 눌러도 '이미 신청한 퀘스트예요'만 뜨고 줄이 밀린다. **A5·B2의 창을 크게 벌리는 증폭 요인**.
**난이도**: kiosk.js 1줄 / 낮음

### B4. 키오스크 마감 배지: dueDate 무시 + 15:00 하드코딩 + 로컬시계 + "마감됨인데 신청 가능" — **NEW**
`kiosk.js:752-756`(new Date() 로컬 — 나머지는 KST `Utils.todayStr()`) · `762`(daily 마감 = 오늘 **15:00** 하드코딩, 바로 위 주석은 '오후 4시'라 코드/주석 불일치) · `764-770`(weekly 금 16:00) · `760-774`(분기 순서상 `quest.dueDate`는 special/event에서만 도달 → **교사 지정 마감일 무시**) · `792-810`(⌛ 마감됨 회색 배지) · `679`(requestQuest에 마감 검사 없음)
**교실 영향**: 종일 켜둔 키오스크에서 **매일 오후 3시가 지나면 모든 일일 퀘스트에 '⌛ 마감됨'** 배지가 붙는다. 버튼은 살아 있고 신청도 되므로 아이들이 배지를 무시하게 되고(표시 신뢰도 상실), 방과후 교실 아이들은 매일 '마감됨'을 보며 체크한다. 교사 지정 마감일은 태블릿(`student.js:870`)과 키오스크가 서로 다른 날짜를 보여 준다.
**난이도**: kiosk.js 1함수 / 중간(정책 결정 필요 — 마감을 차단으로 할지 표시만으로 할지)

### B5. '오늘만' 필터가 ⚠️ 확인 필요 보상을 통째로 숨기고, 뱃지는 전체를 센다 — **NEW**
`admin.js:953`(needsReview 분류 **이전**에 date 필터) · `954-957`(items 비면 '대기 중인 활동이 없어요 ✅' 찍고 return → 확인 필요 섹션 `1044-1069`에 도달 못 함) · `1103-1108`(updatePendingBadge는 필터 무관 전수)
**교실 영향**: 확인 필요 보상은 정의상 과거 것이라 '오늘만' 필터와 **구조적으로 상충**한다. 교사는 뱃지에 3이 떠 있는데 목록은 비어 있으니 프로그램 오류로 여기고, 아이 화면에는 '퀘스트 승인 대기중 1건'이 며칠씩 남는다. 대체 화면도 없다 — 빠른 승인 그리드도 `admin.js:867`에서 active만 렌더.
**조건**: `APPROVE_FILTER` 기본값은 `'all'`이고 새로고침 시 리셋 → **교사가 [오늘만]을 눌러둔 세션 동안**만 해당.
**난이도**: admin.js 1함수 / 낮음

### B6. [↑ 재게시] 버튼이 **어느 타입에서도** 제대로 동작하지 않는다 — **NEW (+ Q3 파생)**
`admin.js:4197-4204` — `{...q, active:true}`만 바꾸고 **id·date를 그대로 둠**. `admin.js:4235-4256`은 타입 구분 없이 모든 비활성 퀘스트에 버튼 노출.
- **special/event/같은 주 weekly**: `gamedata.js:1238` `return true`(날짜 무관 영구 완료) → 지난달 완료한 학생 5명은 학생·키오스크에서 '✅ 완료'로 잠기고, 교사가 [✔ 완료]를 눌러도 "이미 완료 처리된 학생입니다"(`admin.js:4132`)
- **daily(지난 날짜)**: date 미갱신 → 다음 학생 로그인 즉시 `autoCloseDailyQuests`가 다시 내림 → "분명 다시 올렸는데 아이들 화면에 없다"
- **daily(오늘 닫았다 오늘 재게시)**: 정상 동작 ✅

**수정**: 재게시 시 daily는 `date = Utils.todayStr()`로 갱신, special/event는 `reopenedAt` 도입 후 `isQuestDoneToday`가 그 이후 로그만 인정. **난이도**: admin.js 1함수 + gamedata.js 판정 1곳 / 중간

### B7. 자동 일일퀘스트 설정을 바꿔도 그날은 반영 안 되고, **끄는 수단이 UI에 없다** — **NEW**
`gamedata.js:787`(`autoDailyLastDate === today`면 즉시 return, 게시 로직보다 앞) · `admin.js:3932`(saveAutoDaily가 `autoDailyLastDate`를 지우지도, ensureDailyQuests를 부르지도 않음) · `admin.js:3930`(0개 체크 시 에러만 내고 저장 거부 → **`autoDailyQuests`를 비우는 코드 경로가 전 파일에 없음**)
**교실 영향**: 교사가 1교시에 "오늘부터 이거 추가"하고 저장했는데 아이들 화면에 종일 안 나온다(토스트는 성공). 학기 중간에 자동 등록을 멈추고 싶어도 방법이 없어 매일 아침 수동으로 [🗑️ 닫기]를 눌러야 한다.
**정정**: 현황 카드의 ON/OFF 배지는 클릭 불가한 상태 표시일 뿐 "토글로 오인"은 근거 없음. 항목 제거 후 잔존은 **당일 한정**(다음날 자동 정리됨).
**난이도**: admin.js 1함수 / 낮음

### B8. '생활(life)' 능력치가 교사 능력치 기록 페이지에서 통째로 누락 — **NEW**
`admin.js:1360-1366` statDefs = read/study/art/value/health **5개** (life 없음). 반면 `gamedata.js:440` statNames, `student.js:616` abDefs, `admin.js:1409` 요약(`🏠${s.stats?.life}`), `kiosk.js:165` STAT_BADGE, `admin.js:3684` ABILITY_QUESTS.life에는 모두 존재.
**교실 영향**: 🏠생활 탭 9개 퀘스트가 통째로 사후 확인 불가. 학생 화면·목록 요약에는 점수가 보이는데 "무슨 활동으로 받았는지 기록이 하나도 안 뜬다".
**수정**: statDefs에 life 추가. 근본적으로는 `GAME_DATA.statNames`를 단일 출처로. **난이도**: admin.js 1줄 / 낮음

### B9. 직접입력 퀘스트 등록에 입력 검증이 전혀 없음(음수·0·중복이름) — **NEW**
`admin.js:4036-4037` `parseInt(v)||80` / `||50` → **`-50`은 truthy라 그대로 저장**(승인 시 exp/gold를 깎고 `levelFromExp`로 레벨 하락), **`0`은 falsy라 조용히 기본값으로 치환**. `admin.js:4040` statVal도 `-2` 통과. `admin.html:527/531` number input에 min 없음. 중복 이름 차단은 템플릿(`3891`)·능력치(`3794`) 경로에만 있고 addBoardQuest에는 없음 → **같은 이름 두 줄 → 같은 활동으로 보상 2회 수령**.
**보강**: 중복 지급이 `renderDqSummary`에는 드러나지 않는다(이름 기준 Set 집계라 합쳐짐). 발견 경로는 학생 EXP 급증뿐.
**난이도**: admin.js 1함수 + admin.html min 속성 / 낮음

### B10. 지난주 미승인 pending이 주간퀘스트를 계속 잠근다 — **NEW**
`gamedata.js:1181-1183`(pending 판정이 `r.date`를 **전혀 안 봄**) vs `gamedata.js:1237`(완료 판정은 주가 바뀌면 풀림) — **비대칭**. weekly는 자동 마감 대상 아님.
**재현**: 금요일 신청 → 교사가 주말 넘겨 잊음 → 다음 주에도 학생 태블릿은 '⏳ 확인중'으로 신청 버튼이 없고 `submitQuestFromMain`도 즉시 return.
**정정(탈출구 있음)**: 키오스크에서는 ⏳ 셀 자체가 취소 버튼(`kiosk.js:239-241` → `cancelQuest`)이라 학생이 스스로 취소하고 재신청할 수 있다. 즉 **태블릿 전용 잠금**.
**난이도**: gamedata.js questStatus 1곳 / 중간(daily/weekly 기간 조건 설계 필요)

### B11. 자정을 넘긴 세션에서 '오늘 완료'가 풀려 같은 게시글을 두 번 완료 — **NEW**
`gamedata.js:1234`(daily 판정이 로그 date만 보고 **게시글 자체의 date는 안 봄**) · `student.js:8181`(신청 시 active만 확인, 게시글 date 무검사) · `autoCloseDailyQuests`는 로그인 시점에만 실행
**재현**: 21시 신청·21:30 승인 → 태블릿 켜둔 채 00:05 → 임의의 DB 변경으로 `onDataChange`가 renderMain을 다시 부르면 그 행이 ○로 되돌아감 → 재탭 → 같은 게시글에 완료 로그 2건.
**보강**: 자동 일일퀘스트 학급은 오늘자 게시글이 생겨 분모도 2가 되므로 100%로 보이지만, **오늘 하지 않은 퀘스트가 완료로 집계되는 오류는 남는다**. 수동 등록 daily에서는 '2/1일 · 200%'.
**난이도**: gamedata.js + student.js/kiosk.js 신청 가드 / 중간

### B12. 능력치 퀘스트 게시 시 이름 중복 항목이 **아무 안내 없이** 빠진다 — **Q2 관련 + NEW**
`admin.js:3794` `if (find(q.name===name && q.active!==false)) return;` (type 무관·무고지) · `3809`는 실제 push된 수만 표시 → "📌 4개 게시 완료!" 성공 토스트. 템플릿 경로(`3892`)는 항목별로 '이미 게시중이에요'를 띄우는데 **능력치 경로만 침묵**.
**실제 충돌하는 기본 이름**: 주간 '독서 감상문 쓰기'↔독서 탭, 주간 '친구 도움 주기'↔가치 탭, 일일 '바른 자세로 수업 듣기'↔건강 탭, 일일 '수학 문제 5개 풀기'↔학습 탭
**난이도**: admin.js 1함수 / 낮음

### B13. 반려는 기록도 알림도 없이 pending만 조용히 삭제 — **NEW**
`admin.js:780-787`(rejectSingle) · `admin.js:655-658`(rejectSingleDash) · `student.js` 전역에 '반려' 문자열 **0건**
학생 화면에서는 배너가 그냥 사라진다 → 승인된 줄 알고 EXP를 확인하다 다시 신청하거나 교사를 찾아온다. 교사도 누구를 왜 반려했는지 되짚을 수 없다. 일치 항목이 0건이어도 무조건 '🗑️ 반려됨' 토스트.
**난이도**: admin.js 2함수 + student 알림 / 중간

### B14. `_saving` 500ms 창에 도착한 스냅샷을 통째로 버려 퀘스트 신청/승인이 되돌아간다 — **Q1 인접 · 일부 UNCERTAIN**
`gamedata.js:553-561`(_saving 중이면 settings 외 스냅샷 폐기, **재전송 없음**) · `gamedata.js:715-719`(쓰기 완료 + 500ms 유지) · `kiosk.js:713`(pendingRewards **부분** 저장) vs `gamedata.js:717`(학생 노드 **통짜** set)
- **학생 방향**: 학생 저장 창에 키오스크 신청/교사 승인이 겹치면 그 변경이 폐기 → 다음 학생 저장이 낡은 CUR로 통짜 덮어씀 → 신청 유실 또는 승인 롤백(pending 부활)
- **교사 방향**: 교사가 승인 클릭 → 그 창에 들어온 학생 신청이 admin 캐시에서 누락 → 다음 승인의 통짜 set이 그 신청을 **Firebase에서 삭제**

**정직한 한계**: 자기 치유 조건이 있다 — 학급 내 아무 쓰기 하나만 도착하면 캐시가 최신화된다. 25명 교실에서 두 조건이 실제로 얼마나 겹치는지는 **정적 분석으로 확정 불가**(런타임 관측 필요). 또한 이건 퀘스트 전용 결함이 아니라 통짜 saveStudent + 리스너 드롭이라는 일반 동시성 문제이며, 퀘스트 승인은 그 피해 사례 중 하나다.
**부활 시 이중 지급**은 A1의 `approveReward` 가드로 막힌다.
**난이도**: gamedata.js 리스너 구조 / **높음** — 안전 모드 대상, 별도 승인 필요

### B15. 학생 '내 보상' 탭이 미승인 신청을 '🎁 받기 가능'(승인 색)으로 표시 — **Q5 표시층 보강**
`student.js:8449` `p.selfApplied ? 'self' : 'claim'` — `selfApplied`는 **저장소 전체에서 이 한 줄에서 읽히기만** 하고 어디서도 기록되지 않음(pendingRewards.push 4곳 전부 미설정) → 항상 'claim' → `qr-status approved` 클래스 + '🎁 받기 가능'(`8458`). 받기 버튼은 `claimBtn=''`(`8456`)로 없음.
같은 화면 홈 배너는 '퀘스트 승인 대기중 / 선생님 확인 중'(`student.js:691`), 탭 상단 안내는 '선생님이 승인하면 받을 수 있어요'(`student.html:193`) — **한 화면 안에서 정반대**.
**뿌리**: 승인=즉시지급으로 바뀐 뒤 남은 '수령(claim)' 모델 잔재. `claimRewards`(`student.js:1183`) 호출부 0, `questStatus`의 `approved===true` 분기도 죽은 코드(Q5).
**수정**: claim 분기·selfApplied·claimBtn 잔재를 제거하고 '📨 승인 대기'로 고정. **난이도**: student.js 1함수 / 낮음

### B16. `questLog` 키에 랜덤 성분이 없어 전체 승인 시 기록 1건이 덮어써진다 — **NEW**
`gamedata.js:728` `logId = studentId + '_' + (boardQuestId||'manual') + '_' + Date.now()` · `admin.js:770` 동기 forEach 루프
같은 학생의 보상 2건(특히 boardQuestId 없는 빠른보상 → 둘 다 `'manual'`)을 [전체 승인]하면 같은 밀리초에 **완전히 동일한 키** → `questLogs/<logId>.set()`이 덮어씀.
**정정**: exp/골드/스탯은 두 건 다 지급되고, **완료 판정은 흔들리지 않는다**(manual 로그는 boardQuestId가 null이라 `isQuestDoneToday`에 걸리지 않음). 실제 피해는 활동 내역·능력치 내역·`renderDqSummary`의 **건수 누락**에 한정. 또 '반드시 동일'이 아니라 동기 루프에 의한 고확률.
**수정**: `Utils.uid()` 접미사 또는 push() 키. **난이도**: gamedata.js 1줄 / 낮음

---

## 🟡 정리 수준 (18건)

| # | 제목 | 파일:줄 | 요지 / 영향 | 난이도 | 분류 |
|---|---|---|---|---|---|
| C1 | 삭제한 퀘스트 때문에 일일 성실도 집계 왜곡 | `admin.js:1462`·`1523-1534`·`4206-4216` | 분모는 살아있는 boardQuests, 분자는 questLogs → 5일 중 1건 삭제 시 **'5/4일 · 125%'**, 전부 삭제하면 '0/0일'. **로그 원본은 보존**되므로 복구 가능한 '집계 왜곡'(파괴 아님). 삭제 확인창에 기록 영향 안내 없음 | admin.js 집계 1곳 / 중간 | NEW |
| C2 | 같은 daily인데 보상이 35/25 또는 80/50 | `admin.js:4026-4030`(onQuestTypeChange daily=80/50) vs `admin.js:3869-3870`(템플릿 35/25) vs `gamedata.js:808`(자동 35/25) | 교사가 유형 드롭다운을 **한 번이라도 건드리면** 35→80. addBoardQuest 폴백도 `||80` | 상수 통합 / 낮음 | NEW |
| C3 | 홈 배너 '퀘스트 승인 대기중 N건'이 독서·작품까지 카운트 | `student.js:674`·`688`·`765` | 제목의 '퀘스트'라는 단어와 건수만 오분류. **본문에 label이 나열되므로 내용은 보임** | student.js 1곳 / 낮음 | NEW |
| C4 | 커스텀 템플릿 항목의 능력치 선택이 저장 안 됨 | `admin.js:3602-3609`(`{name, stat:''}`)·`3847-3852` | 매일 같은 커스텀 퀘스트를 올리는 교사가 매번 능력치를 다시 골라야 함(대비: `addAbilityTemplate`은 stat 저장) | admin.js 2곳 / 낮음 | NEW |
| C5 | `autoCloseDailyQuests`가 설정과 무관하게 항상 실행 | `student.js:187`·`10104-10115` vs `gamedata.js:782-784`(admin 경로는 조기 return) | 자동 일일퀘스트를 안 켠 학급도 학생 접속만으로 교사 수동 daily가 내려감. **게이트 비대칭**이 새로운 사실 | student.js 1곳 / 낮음 | **Q3 보강** |
| C6 | 신청 실패 시 낙관적 항목을 롤백하지 않음 | `kiosk.js:698`·`715`, `student.js:8192`, `gamedata.js:717`(Promise 미반환) | "다시 시도하세요" → 다시 누르면 "이미 신청했어요". 단 **다음 스냅샷이 오면 자가 회복**되고, RTDB set은 오프라인에서 reject하지 않아 실제 catch는 권한 거부 정도 | 2파일 / 낮음 | NEW |
| C7 | 신청 가드가 전부 무음 return | `student.js:8182`·`8190`·`862`, `kiosk.js:681` | "눌렀는데 안 돼요". 단 `onDataChange`가 renderMain을 항상 부르므로 무음 창은 좁고, 키오스크는 직전 성공 토스트를 이미 본 뒤 | 4곳 토스트 추가 / 낮음 | NEW |
| C8 | 열어둔 퀘스트 모달이 실시간 갱신 안 됨 | `student.js:44-63`(onDataChange가 renderQuestBoard 미호출) | 새 퀘스트가 안 보이고, 이미 처리된 퀘스트의 [신청] 버튼이 설명 없이 사라짐 | student.js 1곳 / 낮음 | NEW |
| C9 | `approveSingle` 무음 no-op + 대시보드 버튼 '...' 고착 | `admin.js:756-757`(notify·renderAll 없이 return)·`650-653` | 버튼이 disabled '...'로 영구 고착. 매칭 규칙도 경로별 불일치(`approveSingle`=id\|\|label, `gridApprove`=id만, 제거 필터 `admin.js:746-748`은 `r.label !== reward.id` **id↔label 혼용**). id 없는 pending 오삭제는 **레거시 데이터 한정**(신규 생성 경로는 전부 id 넣음) | admin.js 3곳 / 낮음 | NEW |
| C10 | [전체(N)]·[전체 승인] 확인창 없음 + 학생당 1건만 + N회 재렌더 | `admin.js:1077-1088`·`admin.html:213` | 오클릭 시 되돌릴 수 없는 일괄 지급. 20명이면 20회 전면 재렌더 + 21개 토스트. **confirm이 있는 건 대시보드 [전체 승인](`admin.js:645`) 하나뿐** | admin.js 2함수 / 낮음 | NEW |
| C11 | 학생 로그인이 교사 보상(⬆️ + EXP 50)을 삭제 | `student.js:213-228`(`!(r.icon==='⬆️' && r.exp===50)`) | 레거시 승급 정리 규칙이 type을 안 보고 아이콘+EXP로만 판정. 프리셋에는 해당 조합이 없어 **교사가 직접 ⬆️ 입력 + EXP 50**일 때만 재현 | student.js 1줄 / 낮음 | NEW |
| C12 | `cleanQuestPending` 데드코드 + 주석이 현재 동작과 **반대** | `admin.js:4186-4195`(호출부 0)·`4163`(주석) | 주석은 "닫기/삭제 시 함께 지운다"인데 실제 정책은 보존. 다시 연결하면 Q-1에서 고친 보상 유실이 부활하는 지뢰 | 삭제 / 낮음 | NEW |
| C13 | 최근 활동/보상 이력이 시간순이 아님 | `gamedata.js:608`(정렬 없음)·`student.js:1118` slice(-5)·`8452` slice(-10) vs `admin.js:1620`(교사만 date 정렬) | 키가 `sid_bqid_ts`라 사전순 → **키가 'manual'인 로그가 날짜 무관하게 항상 배열 끝**을 차지해 오늘의 일일퀘스트를 밀어냄. 데이터 손실은 없음(표시 순서만) | student.js 2곳 / 낮음 | NEW |
| C14 | `pendingRewards.date`가 기기 시계 | `student.js:8200`·`kiosk.js:707`·`admin.js:953`(정확 일치 필터)·`admin.js:995`(`(기간 만료)` 빨간 표시) | 날짜가 어긋난 태블릿을 쓰는 아이만 [오늘] 필터에서 반복 누락되고 '기간 만료'로 오해받음. 자동 시각 동기화 환경에서는 드묾 | 서버시각 도입 / 중간 | NEW |
| C15 | 주 버킷 3종 공존 + `new Date('YYYY-MM-DD')` 로컬 파싱 | `gamedata.js:1209`(일요일) / `gamedata.js:1218`(월요일 ISO) / `admin.js:1471`·`1509`·`student.js:1811`·`1820`(월요일 **로컬 파싱**) | 비KST 기기에서 주 블록이 통째로 하루 밀림. **국내 학교 기기는 KST라 잠재 결함**. 사용처 전수는 조사 노트에 정리됨 | Utils 통합 / 중간 | **Q7 보강** |
| C16 | `autoDailyLastDate`를 `===`로만 비교 | `gamedata.js:786`·`793`·`student.js:10107` | 날짜가 하루 어긋난 태블릿 1대가 반 전체 일일퀘스트를 붙였다 뗐다. 단 auto id가 날짜에 결정적이라 **같은 날짜로 돌아오면 체크 흔적은 보존**됨. 전제(시계 어긋난 기기)가 흔치 않음 | `>=` 비교로 변경 / 낮음 | Q1·Q3 인접 |
| C17 | `dueDate`가 어디에서도 강제되지 않음 | 저장 `admin.js:4042` / 표시 `admin.js:4108`·`student.js:870`·`8155`·`kiosk.js:771` / **검사 0곳** | '버그'라기보다 미구현. 마감 지난 과제도 신청·승인 모두 가능. 데이터는 안 틀어짐 | 정책 결정 / 중간 | NEW |
| C18 | `saveQuestLog`가 `_cache.questLogs`를 갱신 안 함 | `gamedata.js:722-731` | 승인 직후 잠깐 두 화면(questLogs 집계 vs quests 그리드) 값이 다를 수 있음. 다른 쓰기로 금방 자가 치유 | gamedata.js 1줄 / 낮음 | NEW (관측) |

---

## 얽힌 항목 묶음 (하나 고치면 다른 것도 해결/영향)

**묶음 ①: `approveReward` 멱등 가드 한 곳** → A1(교사 완료 후 이중 지급) + B14의 부활 이중 지급 + B9의 중복 이름 이중 수령 일부. **가장 비용 대비 효과가 큰 단일 수정.**

**묶음 ②: statVal 단일 출처(`Utils.statGain`)** → A3 전체 + B1(죽은 능력치 UI)의 검증 + B8(life 누락)과 함께 "능력치 데이터 신뢰 회복" 한 세트.

**묶음 ③: 일일 리셋을 명시적 트리거로 분리** → Q1(boardQuests 통짜 set) + A5(키오스크 미트리거) + B6(재게시 daily) + C5(무조건 실행) + C16(시계 skew) + B11(자정 롤오버)이 **전부 같은 뿌리**. 지금은 "학생이 로그인해야 오늘이 시작된다"는 구조 자체가 문제. 이걸 손대면 6건이 함께 정리된다. **단, 고위험 → 안전 모드.**

**묶음 ④: 로그 date 정책** → A2(승인일 기록) + C1(삭제 시 집계) + C15(주 버킷) + B16(로그 키)이 모두 `questLogs` 스키마/집계 층. A2를 고치면 C1의 왜곡 방향도 바뀌므로 **함께 검토할 것**.

**묶음 ⑤: 키오스크 신청 경로** → B2(active 미검사) + B3(재렌더 없음) + B4(마감 배지) + A5. B3을 고치면 A5·B2의 노출 창이 크게 줄어든다.

**묶음 ⑥: 승인 UI 일관성** → B5(오늘만 필터) + C9(무음 no-op) + C10(confirm 없음) + B13(반려 무기록). 활동 승인 탭 한 번에 정리 가능.

**묶음 ⑦: claim 모델 잔재 제거** → Q5 + B15(받기 가능 오표시) + `claimRewards` 삭제. 죽은 코드 청소 1회.

---

## 반박된 것 (헛수정 방지)

정식 REFUTED 판정은 0건이지만, **아래 주장들은 검증에서 부정확·과장으로 확인**되었으니 그대로 고치려 들지 말 것.

1. **"작품(artwork) 승인도 데이터가 유실된다"** — 사실상 반박. `approveArtwork`(`admin.js:1778-1792`)는 자체 저장 로직 없이 코멘트만 얹고 `approveReward`를 호출한다. 즉 전용 경로와 일반 경로가 **같은 코드**(`admin.js:706-715` `DB.saveArtwork`)를 쓰며 artTitle/artUrl/artDesc/subject 전부 보존된다. **A4는 독서에만 해당**.

2. **"지연 승인으로 일일퀘스트가 200%가 된다"** — 반박. done/avail 모두 **날짜 Set의 size**라 같은 날짜로 몰린 로그는 중복 제거된다. 지연 승인만으로는 done이 avail을 넘지 못한다(오히려 **과소** 집계). 100% 초과는 다른 조건(A1의 서로 다른 날짜 로그 2건, 또는 삭제로 avail이 준 경우)에서만.

3. **"재게시 대신 같은 이름으로 새로 만들면 통계가 두 갈래로 쪼개진다"** — 반박. `renderDqSummary`(`admin.js:1482-1500`)와 `renderStatsPage`(`admin.js:1344-1358`)는 **퀘스트 이름 기준** 집계라 오히려 합쳐진다. 회피책의 비용이 낮다.

4. **Q4 `kiosk.js:691`의 `null` 인자가 판정을 느슨하게 만든다** — 반박. 이 자리에서는 오히려 비활성 퀘스트의 기존 pending/done을 인정해 **중복 신청을 막아 준다**. 진짜 결함은 `kiosk.js:686`. 691만 단독으로 고치면 B2가 악화될 수 있으니 **686을 먼저**.

5. **"퀘스트 삭제로 기록이 파괴된다"** — 반박. `deleteBoardQuest`는 `boardQuests` 배열에서만 제거하고 `questLogs`는 손대지 않는다. **되돌릴 수 있는 집계 왜곡**이지 기록 파괴가 아니다(C1로 재분류).

6. **"자동 등록 ON/OFF 배지가 토글처럼 보인다"** — 근거 없음. 클릭 불가한 상태 표시다. 끄는 수단이 없다는 결함(B7)만 유효.

7. **"주간 퀘스트가 일일퀘스트 기록 표에서 지난주 블록에 들어간다"** — 반박. `renderDqSummary`는 `type==='daily'`만 집계하므로 주간 퀘스트는 그 표에 애초에 안 들어온다. 서로 무관한 두 기능을 섞은 서술(C15로 축소).

8. **"id 없는 pending이 승인되면 다른 pending까지 오삭제된다"** — 조건부. 현재 생성 경로 5곳이 전부 id를 넣으므로 **레거시 데이터에서만** 가능. 신규 발생 불가.

9. **"주간 pending이 걸리면 학생이 영구히 재신청 못 한다"** — 부분 반박. 키오스크의 ⏳ 셀이 취소 버튼이라 탈출구가 있다. **태블릿 전용 잠금**(B10).

10. **"오프라인 큐잉된 키오스크 set이 재연결 시 낡은 배열로 덮어쓴다"** — 정적으로 확정 불가(아래 참조).

**보고에서 제외한 정직한 음성 결과** (조사했으나 문제 없음): 홈 미션행 vs 퀘스트 모달 판정 일치 · 연타 중복 · 취소 왕복 · 삭제된 퀘스트 방어 · 닫기/삭제 시 미승인 보상 보존(정책대로 동작) · 승인 4경로 모두 questLog 기록 · boardQuestId null 로그가 완료 판정에 안 끼어듦 · 학생/퀘스트 id 재사용 충돌 없음 · 백업에 boardQuests+questLogs 포함(7일) · 템플릿 체크박스 인덱스 어긋남 없음 · 자동 일일퀘스트 id 결정성으로 중복 행 안 생김 · `admin.js:1055` 경과일 계산 정확 · 키오스크 weekly 요일 산술 정확.

---

## 정적으로 확정 못 한 것 (런타임 확인 필요)

1. **B14의 실제 발생 빈도** — `_saving` 500ms 창에 다른 기기 쓰기가 겹칠 확률. 25명 교실 실측 필요. 자기 치유 조건(임의의 추가 쓰기)이 있어 코드만으로는 판단 불가.
2. **RTDB 오프라인 큐잉 동작** — 학교 와이파이가 끊긴 동안 키오스크의 `set`이 큐에 남았다가 재연결 시 낡은 배열로 덮어쓰는지. SDK 동작상 가능하지만 실제 지속 시간·빈도는 관측 필요.
3. **레거시 students 노드 키** — `getStudentStorageKey`(`kiosk.js:126-140`)가 폴백을 두는 것을 보면 숫자/배열 키 노드가 존재할 가능성이 있다. 존재한다면 키오스크(`students/<key>/pendingRewards`)와 `DB.saveStudent`(`students/<id>`)가 **서로 다른 노드**에 쓰게 되어 B14의 증상이 '덮어쓰기'가 아니라 '유령 노드 + 순서 의존 유실'이 된다. **read-only 조사라 실 DB는 조회하지 않았음** — 확인 권장.
4. **`questLogs`에 date가 없는 레거시 로그의 실제 존재 여부**(Q6 발동 조건). 현재 생성 경로 4곳은 전부 date를 넣으므로 과거 데이터에서만 온다.
5. **statVal을 1이 아닌 값으로 등록한 퀘스트가 실제로 있는지** — A3의 실제 피해 규모를 좌우한다.
6. **키오스크 기기의 타임존/시계 정확도** — B4·C14·C16의 발동 조건.

---

## 권장 수정 순서

**1차 — 보상 정확성 (한 세션, 위험 낮음)**
1. `approveReward`에 완료 가드 추가 (**A1** 핵심 + B14 부활 이중지급 차단) — admin.js 5줄
2. `completeQuestForStudent`가 pending 제거 + statVal 반영 + 로그 필드 보강 (**A1·A3**) — admin.js 1함수
3. `kiosk.js:705` statVal 수정 + `admin.js:4107` 표시 수정 (**A3**) — 3줄
4. `admin.js:741` 로그 date를 `reward.date || todayStr()` (**A2**) — 1줄 ⚠️ 집계 영향 함께 확인
5. `renderBoardQuestList`를 `questStatus` 기반으로 (**A1** 표시) — admin.js 1함수

**2차 — 데이터 유실 차단 (위험 중간)**
6. `approveReward`의 book 분기를 `confirmBookRecord`와 정합 + `approveAll` 타입 필터 (**A4**)
7. `kiosk.js:686` active 검사 + `switchKioskTab` 재렌더 (**B2·B3**) — 2줄
8. `gamedata.js:728` logId에 랜덤 접미사 (**B16**) — 1줄

**3차 — 교사 동선 (위험 낮음, 체감 큼)**
9. '오늘만' 필터가 ⚠️확인필요를 숨기지 않도록 (**B5**)
10. `saveAutoDaily` 당일 반영 + OFF 허용 (**B7**)
11. statDefs에 life 추가 (**B8**) — 1줄
12. `addBoardQuest` 입력 검증 + 중복 이름 confirm (**B9**)
13. 능력치 게시 스킵 안내 (**B12**), 탭 하단 능력치 컨트롤 연결 또는 제거 (**B1**)
14. `selfApplied`/claim 잔재 제거 (**B15**), 반려 기록·알림 (**B13**)

**4차 — 시간·생애주기 (설계 논의 필요)**
15. 재게시 정책 확정 (**B6**) — daily date 갱신 + special `reopenedAt`
16. 키오스크 마감 배지 정책 (**B4**) + dueDate 강제 여부 (**C17**)
17. `questStatus` pending에 기간 조건 (**B10**), 자정 롤오버 가드 (**B11**)
18. 주 기준 단일화 + 로컬 파싱 제거 (**C15**, Q7)

**5차 — 구조 개편 (안전 모드 · 배포 전 승인)**
19. **일일 리셋을 명시적 트리거로 분리** (묶음 ③ — Q1 + A5 + C5 + C16 동시 해결)
20. **`pendingRewards`를 항목 키 기반(push/remove)으로 전환** + `_saving` 리스너 병합 (**B14**, 묶음 ①의 근본 해법)

**절대 하지 말 것**: 20번을 먼저 시도하지 말 것. 1차만으로 교실 체감 피해의 대부분이 사라지고, 20번은 실 데이터 구조 변경이라 별도 승인·백업·검증 사이클이 필요하다.
