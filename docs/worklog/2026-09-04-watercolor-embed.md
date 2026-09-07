# 2026-09-04 (기기: 학교 Windows) — 수채화·데생도 RPG 안 전체화면 모달로 (WATERCOLOR-EMBED-1)

> 담당: 학습 조수 세션(영어앱 + 수채화·데생 통합 담당). 보스 2기 배정 6. #156(ENGLISH-EMBED-1)의 후속 — 새 모달을 만들지 않고 영어 모달을 그대로 쓴다.

- **브랜치**: `feat/watercolor-embed` (worktree `C:\Users\USER\projects\class-rpg-wt-wcembed`, base `origin/main` ada47a3)
- **대상 파일**: `student.js`(EXTERNAL_STUDY → 최상위 `externalStudyItems()`, 모달 대상 조회, 같은 도메인 폴백 판정, iframe allow에 camera, 닫을 때 영어 동기화는 영어만), `student.html`(`student.js?v=20260904em`), `scripts/smoke-test.mjs`(버전 맵 2곳).
- **안 건드림**: `watercolor/**`(페이지 자체 무변경) · admin.* · gamedata.js · curriculum*.js · 루트 파일 · Firebase.

## 한 일
1. 외부 학습 앱 목록을 렌더 함수 안 상수에서 **최상위 `externalStudyItems()`** 로 옮김 — 카드 렌더와 `openExternalEmbed(key)`가 같은 정의를 본다(영어 하드코딩 제거). `CUR.id`는 호출 시점에 읽는다.
2. 수채화 카드 `embed:true` + **데생 카드 신설**(`watercolor/index.html?course=drawing&sid=`) `embed:true`. 둘 다 카드 클릭 → 같은 `#m-embed` 모달.
3. 폴백 판정: 영어(다른 도메인)는 기존 no-cors fetch 그대로. **같은 도메인이면 `HEAD` 요청으로 상태 코드까지 확인**(404여도 iframe load는 발생하므로) → `!r.ok`면 폴백 화면. 6초 타임아웃·오프라인 즉시 폴백은 공통.
4. iframe `allow`에 `camera` 추가 — 수채화 작품 사진 `<input type=file capture="environment">`.
5. 닫을 때 `syncEnglishRewards(true)`는 영어를 닫았을 때만.

## 작품 제출 흐름이 모달 안에서도 되는 근거 (코드 확인)
- `watercolor/index.html` `rpgSubmitArtwork`: Storage 업로드 → `DB.getStudent()`로 최신 pendingRewards를 읽어 `students/<key>/pendingRewards`에 **부분 set**. iframe도 같은 도메인·같은 RTDB(`gamedata.js` DB.init)라 새 탭과 동일하게 동작.
- 부모(RPG)는 `DB._fbRef.on('value')` 실시간 리스너 → `DB.onDataChange` → `CUR = DB.getStudent(CUR.id)`로 갱신되므로, 모달을 닫은 뒤 부모가 `DB.saveStudent(CUR)`를 해도 새 항목이 유실되지 않는다(경합 창은 리스너 지연 수백 ms — 새 탭 방식과 같은 조건).
- 학생 로그인: `?sid=`로 목록 미리 선택 + 비밀번호 입력(기존 그대로). 읽어주기(Web Speech)·영상 재생은 iframe 안 클릭이 제스처라 자동재생 정책에 안 걸림.

## 검증
- `node --check student.js` · verify-safety(기대 18/1/0) · smoke-test(기대 33/0/0).
- 격리 하네스(브라우저, 운영 write 0): 모달 블록(`externalStudyItems`~`keydown` 리스너)을 텍스트 추출, worktree 루트를 정적 서빙(8767)해 **실제 `watercolor/index.html`을 같은 도메인 iframe으로** 로드 — ① 수채화 열림·src·allow(camera 포함) ② 데생 열림(`?course=drawing`) ③ HEAD 폴백: 없는 경로(`watercolor/nope.html`)는 폴백 화면 ④ ESC/✕/popstate 닫기 ⑤ 닫을 때 영어가 아니면 syncEnglishRewards 미호출 ⑥ 손님 모드로 한 단계 진행(로컬 저장만, Firebase write 0).
- 실기기(크롬북·태블릿): 학생 로그인 → 작품 사진 제출 → admin 승인 대기에 뜨는지 — **사용자**.

## 검증 결과 (2026-09-04)
- `node --check` OK · verify-safety **PASS 18 · REVIEW 1 · FAIL 0** · smoke-test **PASS 33 · FAIL 0**
- 브라우저 하네스(worktree 루트 정적 서빙 8767, 모달 블록 텍스트 추출, 손님 모드만 → 운영 write 0):
  ① 수채화 카드 → 모달 열림 · src `watercolor/index.html?sid=…` · allow `autoplay; microphone; camera; fullscreen` · history.state={embed:'watercolor'} · iframe 안 문서 제목 "수채화 따라하기", COURSE_KEY=watercolor · 폴백 미표시 ✅
  ② 데생 카드 → `?course=drawing&sid=…` · 제목 "✏️ 데생 기초" · iframe COURSE_KEY=drawing ✅
  ③ 같은 도메인 없는 경로(`watercolor/nope.html`) → HEAD 404 → 폴백 화면 + "새 탭으로 열기" 링크 ✅ (iframe load만 믿었으면 놓쳤을 케이스)
  ④ ESC 닫기 · ✕(closeExternalEmbed) 닫기 · popstate: state 유지면 열림 유지, state 소실이면 닫힘 ✅ · 닫으면 iframe about:blank, body overflow 복원
  ⑤ 수채화·데생 닫을 때 syncEnglishRewards **미호출**(0), 영어 닫을 때만 1회 ✅ · 영어(다른 도메인) 경로는 기존 no-cors 판정 그대로 열림 ✅
  ⑥ 모달 본문 = 뷰포트 폭 전체(1280×670 / 창 1280×720, 헤더 50px) · 손님 모드 진입 후 홈(챕터 목록) 렌더 ✅
- 스크린샷(크롬북 1366×610, 헤드리스 Edge): `scratchpad\wc_embed_modal_1366x610.png` — 보스 검토용, repo에는 넣지 않음.
- 실기기(학생 로그인 → 작품 사진 제출 → admin 승인 대기)는 사용자 검증 항목.
