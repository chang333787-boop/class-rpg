## 2026-09-03 (기기: Windows · 세션: 수채화 앱) — 수채화 기초 앱을 별도 페이지로 추가

> ⚠️ 같은 날 같은 PC에서 세션 3개가 class-rpg를 동시에 봄. **파일 범위를 나눠서 충돌 방지.**
> - 수채화 세션(이 문서): `watercolor/**`, 이 worklog 파일만. 별도 worktree `projects\class-rpg-wt-watercolor`, 브랜치 `feat/watercolor-page`.
> - 영어 복습앱 세션: RPG 연동 설계 중(보상·학생 홈 입구). **학생 홈의 "외부 학습 페이지 입구"와 XP 보상 방식은 그쪽 소유.** 수채화는 나중에 그 입구에 항목 하나로 추가.
> - RPG 인수인계 세션: 대문 `index.html`·문서 비공개(`.nojekyll` 등) 대기 중. 저장소 루트는 그쪽 소유.
> - 셋 다 `student.js`를 이번엔 안 만짐. 만지게 되면 브랜치명을 여기에 적을 것.

- 한 일:
  - `watercolor/index.html` — 바탕화면 `수채화기초\index.html`(단일 파일, 17차시)을 그대로 가져와 RPG 연동 3가지만 추가.
    1. **로그인**: 번호 선택 창 → RPG 학생 목록(`DB.getStudents()`) + 비밀번호(`student.pw`) 확인. `student.html`의 `doLogin`과 같은 규칙. `?sid=<학생id>`로 미리 선택 가능. "손님으로 쓰기"면 기존처럼 태블릿 로컬에만 저장(오프라인·파일 직접 열기에서도 동작).
    2. **기록 동기화**: 진행·성찰을 localStorage(기존) + Firebase **`classRPG_watercolor/<학생id>`** 에 set. RPG 루트 `classRPG_v3` **밖의 별도 키**라 기존 데이터·`_normalizeArrays`·백업/복원/초기화에 영향 없음(`classRPG_adminPw`와 같은 방식). 로그인 시 서버 값을 먼저 읽어 로컬에 덮어씀.
    3. **작품 제출**: 사진 → Storage `artworks/<id>_<ts>.jpg` 업로드 → `students/<key>/pendingRewards`에 `type:'artwork'` 항목 push 후 **경로 부분 set**(kiosk.js `requestQuest`와 같은 규칙, key는 `getStudentStorageKey` 로직 복제). 보상 exp30/gold20, subject '미술' = student.js `submitArtwork`와 동일 → 교사 승인 → 작품 전시·업적 자동.
  - `watercolor/videos/*.mp4` 6개(12MB) — AI 시연 영상. 페이지의 "실제 영상 보기" 단추가 이걸 씀.
  - gamedata.js는 `../gamedata.js?v=20260730`로 **읽기만** 로드(FIREBASE_CONFIG·DB.init·DB.getStudents·Utils.todayStr). gamedata/student/admin/kiosk/curriculum **무변경**.
- 기준 commit / 브랜치: main `71c114f` → `feat/watercolor-page`
- 검증 결과:
  - `node scripts/verify-safety.mjs` / `smoke-test.mjs`: 기존 3화면 대상이라 영향 없음(결과는 PR 본문).
  - 로컬 HTTP(worktree 루트 8766)에서 `watercolor/index.html` 로드: Firebase 읽기 성공, 학생 7명 목록 표시, 틀린 비밀번호 거부, 손님 모드 진행 저장, 영상 단추 표시, 콘솔 오류 0(없는 영상 404만).
  - **Firebase write는 하지 않음**(규칙) — RPG 학생 로그인 후 동기화·작품 제출 경로는 코드만 검토, 실제 write는 사용자가 "시험" 학생으로 1회 확인 필요. REST 확인: `classRPG_watercolor` = null 유지.
- 다음 할 일:
  1. PR 검토·승인 후 머지 → `https://funclassrpg.kr/watercolor/index.html` 접속 확인.
  2. "시험" 학생으로 로그인 → 한 단계 진행(→ `classRPG_watercolor/시험id` 생김) → 사진 1장 제출(→ admin 작품 승인 대기에 뜨는지).
  3. 학생 홈 입구는 영어앱 세션의 설계에 맞춰 추가(페이지 경로 `watercolor/index.html?sid=<id>`).
- 주의/미해결:
  - 이 페이지는 인라인 `<script>`가 있는 **독립 앱**(3화면 외부화 규칙 대상 아님). verify/smoke 검사 대상에도 넣지 않음.
  - RPG의 접속 시간 제한(8:30~16:00)은 적용 안 함(수업 중 사용).
  - 학생 비밀번호가 클라이언트 비교인 것은 RPG 본체와 동일한 한계.
  - REST로 확인 중 `classRPG_adminPw`가 **인증 없이 읽힘**(DB 규칙 공개). RPG 인수인계 세션이 다루는 비밀번호 노출 건과 같은 뿌리 — 그쪽 lane.

## 2026-09-03 (오후) — 재구성 · 코스 분리 · 데생 코스 시작 (WATERCOLOR-3, 같은 브랜치 feat/watercolor-page)
- 사용자 지시: ① 원기둥·원뿔 띠 명암, 나무(원뿔·둥근) 그리기 추가 ② 학습지를 A4 가로, 한 장에 큰 칸 2개로 ③ 데생 코스 시작 ④ 준비 차시가 너무 잘게 나뉨 → 실용적으로 재구성.
- 재구성(17→16차시): 0 준비하기+붓과 놀기 합침 / 우연 효과 놀이는 질감 효과와 합쳐 8 질감과 우연 효과 / 12 명암과 입체(공)를 10 명암과 입체: 띠로 칠하기(5단계 띠·원기둥·원뿔)로 재작성 / 11 나무 그리기 신설 / 나머지 번호 당김. 영상 6개 `git mv`로 새 번호(l1s2 l1s4 l2s2 l4s3 l4s5 l14s2).
- 코스 분리: `index.html` = 엔진(`?course=` 로더, 미터·저장키·Firebase 키·영상 폴더·인쇄물 링크를 COURSE 데이터에서 읽음), `course_watercolor.js` = 수채화 콘텐츠(ART·LESSONS·PARTS + COURSE_DATA), `course_drawing.js` = 데생 콘텐츠(신규, 서브에이전트 제작). 수채화는 `ns:'wc'`라 기존 localStorage 키 유지. 데생은 Firebase `classRPG_drawing/<id>`(루트 밖 별도 키, 수채화와 같은 방식) — **새 키 1개 추가**, 보스 세션에 알림.
- 학습지: `worksheets.html` A4 가로 18장으로 전면 재작성(서브에이전트). 옛 세로판은 바탕화면 원본 폴더에만.
- 교훈: SVG `filter`(WC 번짐) 안의 요소에 `.fade-in` 애니메이션을 넣으면 크롬에서 렌더되지 않음(투명). 애니메이션 요소는 필터 밖에 둘 것(기존 규칙 재확인).
- 보스 지시(2026-09-03): `classRPG_watercolor/*`·`classRPG_drawing/*` 키는 **현재 백업 대상(22개 노드)에 미포함** — 지금 넣지 않음. 나중에 백업 목록에 추가 검토(admin.js 고위험 구간, 별도 Phase).
