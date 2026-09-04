# 2026-09-03 (기기: 학교 Windows) — 영어 복습앱을 RPG 안 전체화면 모달로 (ENGLISH-EMBED-1)

> 담당: 영어앱 세션(대장 승인, #152 머지 후 진행). 배경: 학생 반응 "영어만 다른 사이트네요" — 새 탭으로 나가는 대신 RPG 화면 안에서 연다.

- **브랜치**: `feat/english-embed` (worktree `C:\Users\USER\projects\class-rpg-wt-english`, base `origin/main` f25f95f = #152 포함)
- **대상 파일**: `student.js`(EXTERNAL_STUDY 영어 항목 `embed:true` + 카드 렌더 분기 + 모달 함수 3개), `student.html`(`student.js?v=20260903f`), `scripts/smoke-test.mjs`(student.js 버전 맵). 모달 마크업은 처음 열 때 JS로 만든다(HTML 수정 최소화).
- **안 건드림**: admin.* · gamedata.js · curriculum.js · student.css · `watercolor/`(수채화는 다음 PR) · Firebase.

## 한 일 (대장 조건 그대로)
1. 영어 카드 클릭 → `openExternalEmbed('english')` → 전체화면 오버레이 `#m-embed` + `<iframe allow="autoplay; microphone; fullscreen">`로 영어앱 자동 입장 URL 로드. 수채화 카드는 기존대로 새 탭(변경 없음).
2. 닫히는 경로 3개: 헤더 ✕ 버튼 · ESC(keydown) · 브라우저 뒤로가기(열 때 `history.pushState`, `popstate`에서 닫음). 닫으면 iframe src를 about:blank로 비워 소리·타이머 정지, `syncEnglishRewards(true)`를 한 번 더 호출해 방금 공부한 보상 신청을 즉시 반영.
3. 폴백: 헤더에 항상 "새 탭으로 열기 ↗" 링크. `navigator.onLine===false`이거나 8초 안에 iframe `load`가 없으면 안내 화면(📡 앱을 불러오지 못했어요 + 새 탭 버튼 + 닫기)을 iframe 위에 덮는다.
4. **iframe 안 소리(대장 지적)**: 제스처가 iframe 문서로 전달되지 않으므로 **영어앱 쪽에 "▶ 시작하기" 한 번 탭 화면**을 추가·배포함(`window.self!==window.top`일 때만, 탭 시 muted Audio play로 권한 워밍업). 이후 앱 안의 🔊·정답 클릭은 모두 iframe 안 제스처라 자동재생 정책에 걸리지 않음.

## 검증
- `node --check student.js` · verify-safety(기대 18/1/0) · smoke-test(기대 33/0/0).
- 격리 하네스(브라우저, 운영 write 0): student.js에서 모달 블록(`let _embedState`~`let _englishFs` 직전)을 텍스트 추출해 스텁(englishAppLink·escHtml·syncEnglishRewards)과 함께 실행 — ① 열림/iframe src/allow 속성 ② 실제 영어앱 로드(`load` 이벤트) ③ ESC로 닫힘 ④ popstate로 닫힘 ⑤ 닫을 때 iframe 비움 + sync 1회 호출 ⑥ 잘못된 URL이면 폴백 화면.
- 크롬북 실기기 소리 확인은 배포 후 사용자 1회(제스처 워밍업은 하네스에서 코드 경로만 확인).

## 검증 결과 (2026-09-03)
- `node --check` OK · verify-safety **PASS 18 · REVIEW 1 · FAIL 0** · smoke-test **PASS 33 · FAIL 0**
- 브라우저 하네스(로컬 정적 서버, 모달 블록 텍스트 추출, 운영 write 0):
  ① 열림 · iframe src=자동입장 URL · `allow="autoplay; microphone; fullscreen"` · history.state={embed} ✅
  ② 실제 영어앱 로드(4초 내 load, 폴백 미표시) ✅
  ③ ESC → 닫힘 · iframe about:blank · body overflow 복원 · syncEnglishRewards 1회 ✅
  ④ popstate 핸들러: state에 embed가 남아 있으면 유지, state가 사라지면 닫힘 ✅ (미리보기 창이 실제 history.back()을 수행하지 않아 합성 popstate로 검증)
  ⑤ 잘못된 주소(127.0.0.1:9) → no-cors fetch 실패로 폴백 화면 표시, "새 탭으로 열기" 링크 정확 ✅ (iframe load 이벤트는 오류 페이지에서도 발생해 신뢰하지 않음 — 하네스에서 발견해 fetch 방식으로 교체)
  ⑥ ✕(closeExternalEmbed) → 닫힘 ✅
- 하네스 중 발견·수정 2건: (a) iframe load 기반 폴백은 오류 페이지에서 오작동 → fetch 도달성 검사로 교체 (b) 닫기 직후 재열기 경합 → embed 상태 있으면 pushState 중복 안 함 + popstate는 state 소실 시에만 닫음.
- 영어앱 쪽: iframe 안에서는 "▶ 시작하기" 탭 화면(제스처 워밍업) 배포 완료(https://jeongrim-english.web.app). 크롬북 실기기 소리는 배포 후 사용자 1회 확인.

## 다음 할 일
- PR → 대장 머지. 이후 수채화도 같은 모달로(별도 PR, 수채화 세션과 조율).
