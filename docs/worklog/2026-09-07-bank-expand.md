# 2026-09-07 (기기: 학교 Windows) — 문제은행 확장: 수학 4-1 · 사회 4-1 · 수학 1~3학년 보충 (BANK-EXPAND-1)

> 담당: 학습 조수 세션. 사용자 직접 지시: "문제은행처럼 각 영역(수채화 제외) 문제 수를 늘려라 — 학습 단원·교육과정 성취기준·기존 문항에서 벗어나지 말 것, 늘리기 위한 늘림 X, '4학년 거 아닌 것 같은데요' 느낌 X, 수학 저학년도 계속." 보스 2기에 착수 보고함.

- **브랜치**: `feat/bank-expand` (worktree `C:\Users\USER\projects\class-rpg-wt-bank`, base `origin/main` f70260e = #177 포함)
- **대상 파일**: `curriculum.js`(BASE_PROBLEMS 끝에 확장 블록), `curriculum_review.js`(REVIEW_PROBLEMS 끝에 확장 블록), 캐시버스터 `student.html`·`admin.html`·`scripts/smoke-test.mjs`(curriculum.js·curriculum_review.js `?v=`).
- **안 건드림**: student.js · admin.js · gamedata.js · figures.js · units 정의 · 루트 파일. RPG 영어(en4-1)는 영어앱이 대체하고 교과서 원문 배제 원칙이라 **확장 제외**.

## 방식 (양이 아니라 범위)
1. 기존 문항 1,485개를 단원별 파일로 덤프(스크래치 `bank/<unitId>.txt`) — 새 문항 작성의 **범위 기준**은 이 기존 문항(교과서 기준으로 이미 검증된 단원 구성)과 2022 개정 성취기준.
2. 작성 규칙(`bank/RULES.md`): 교과서 원문 금지 · 기존 문항이 다루는 주제 밖 개념 금지(예: 큰 수에 소수, 각도에 평행·수직) · 숫자만 바꾼 중복 금지 · 정답 재계산 · 해당 학년 어휘 · hint는 첫걸음만.
3. 단원별 목표: 수학 4-1 각 +25(65→90, calc/word/concept 균형·각도·이동은 fig) · 사회 4-1 각 +30(130→160, ox/situation/reason 비중↑) · 보충 1·2학년 각 +10, 3학년 각 +12(12→22~24, level 1~2 위주·fig).
4. 정합성 스크립트(`bank_validate.mjs`): id 형식·중복, unitId, type/cat/level, choice 정답 포함·4지·중복, number 정답 숫자, hint, fig kind·값 범위, 금지어(주식·세금·위도 등), 기존/새 문항과 q 유사도(문자 바이그램 자카드) → 오류 0 필수, 경고는 수동 확인.
5. 새 id는 `_e##` 접미(`p_ma411_e01`, `p_so411_e01`, `r_ma2_4_e01`) — 기존 번호와 충돌 없음.

## 결과 (2026-09-07)
- **+528문항**: 수학 4-1 +150(65→90×6) · 사회 4-1 +90(130→160×3) · 보충 +288(1학년 +80, 2학년 +100, 3학년 +108; 단원당 10~13→20~25). 은행 합계 1,095→1,623(영어 390 제외), 전체 id 2,013 유일. 단원별 표는 PR 본문.
- 작성: 세션 5개 병렬(단원별 기존 문항 파일을 먼저 읽고 그 주제 안에서만). 각 세션이 기존 문항에서 파악한 주제 목록을 보고하게 해 범위 근거를 남김.
- **정합성**(`bank_validate.mjs`): 528개 오류 0. 과정에서 잡아 고친 것 — 기존과 숫자만 다른 문항 1(큰 수)·기존과 물음 동일 1(사회 경제)·보기와 정답 불일치 1.
- **독립 검산**(작성자와 다른 세션 2개, 정답을 직접 다시 풂): 4-1 수학 number형 108개 Node 계산 → 불일치 0 · 보충 288개 전부 재계산(number 138개 + 계산형 choice 98개 보기 4개 모두 계산) → 계산 오류 0. 검수에서 고친 것 **14건**: 힌트가 답을 말해 줌 6(p_ma411_e02·p_ma415_e12·r_ma2_8_e08·r_ma3_9_e02·e07 등) · OX 가치 판단 표현 1(p_so412_e19) · 학년 경계 5(1시 큰 쪽 각 330°→10시 작은 쪽 60°, "회사 수입"→과자 개수·인구 2, 1학년 rect fig가 cm 라벨 자동 표시→shapes, 1학년 보기에 받아내림 40−5→37−2, 2학년 "사각형의 사=각"→변의 수 차) · 수직선 ?가 출발점/정답 눈금 위에 있어 그림이 답을 보여 줌 4(물음을 "몇 칸 뛰었나"·"10 큰 수"·"1 L까지 몇 mL 더"로, marks로 교체) · 6×6 grid가 답을 보여 줌 1(fig 제거).
- **렌더**(보스 승인 대체 하네스): ① `figures.js`(`Figures.render`)로 fig 110개 전부 SVG 생성 성공 ② 브라우저에서 student.js의 `renderStudyQuestion` 블록(STUDY_CAT~studyModeChipsHTML 앞 + renderStudyQuestion~submitStudyAnswer 앞)을 텍스트 추출해 실제 curriculum.js·curriculum_review.js·figures.js와 함께 로드, **새 문항 528개 각각 1회 렌더** — 예외 0, 문제 글·보기 버튼/입력칸·fig svg 모두 확인, 콘솔 오류 0(DB 미로드, 운영 write 0). 실행 방법은 PR 본문.
- `node --check` ×2 OK · verify-safety **18/1/0** · smoke-test **33/0/0**(curriculum.js·curriculum_review.js `?v=20260907q`, student.html·admin.html·smoke 맵 동기화).
- 남은 판단(사용자): numline 렌더러가 눈금마다 숫자를 찍어 "? 자리의 수" 유형은 그림이 답을 보여 준다 — 기존 문항(r_ma1_1 등)도 같은 패턴. 새 문항은 피했고, 기존 것과 렌더러 개선(q 자리 숫자 가리기)은 별도 Phase.
