# 2026-09-03 (학교 Windows) — 학습게임 확장: 보상 연결 · 모드 · 그림 · 보충 진입 · OX

세션 역할: 사용자 지시로 이 세션이 class-rpg **조율 담당(대장)**. 수채화·영어앱 세션에 문항 작성을 배정.

## 머지된 것 (이 세션)
| PR | 내용 |
|---|---|
| #147 | 사이트 첫 화면(index.html) + 문서 비공개(_config.yml) + 수학 풀이 연습장 |
| #148 | 교사 화면 스크롤바 — 5px·8% 투명이라 "스크롤 없다"고 보임 → 14px |
| #149 | **오늘의 공부 → 보상 연결(STUDY-REWARD-1)** — 조사 결과 보상이 전혀 없었음 |
| (이 PR) | 모드 칩 · 그림 렌더러 · OX 레이아웃 · 1~3학년 보충 진입 · 단위 허용 채점 |

## 이 PR (STUDY-MODES-1 · FIG-1 · SOCIAL-TYPES-1 뼈대)
- `figures.js` 신규 — fig {kind,...} → 인라인 SVG. 11종(angle·polygon·rect·clock·fraction·blocks·grid·numline·shapes·move·ruler). 모르는 kind는 빈 문자열.
- `curriculum.js` — 헤더에 fig·사회 cat(ox/situation/reason) 규격. **number형 채점이 단위(명·개·도·원) 붙여도 맞게**. 4-1 각도·평면도형 이동 25문항에 fig.
- `student.js` — 단원 화면에 **모드 칩**(수학 계산/문장제/개념 · 사회 개념/OX/상황/추론/적용), cat 필터, OX는 좌우 큰 버튼, 문제 위 그림, **1~3학년 보충 진입**(`REVIEW_CURRICULUM`/`REVIEW_PROBLEMS` 있을 때만 카드 표시 · 세션 review:true → 보상 집계 제외).
- 캐시버스터: student.js 20260903d · student.css 20260903b · curriculum.js 20260903a · figures.js 20260903a. smoke JS_FILES에 curriculum·figures 추가.

## 검증
- node --check ×4 · verify 18/1/0 · smoke 33/0/0
- figures 자체 테스트 28/28(모든 kind + 잘못된 입력) · 채점 단위 허용 11/11
- **브라우저 격리 하네스(운영 DB 0)**: 과목 카드 5종 · 수학 칩 390/212/120/58 · cat 필터 · 그림 문항(시계·다각형) · 사회 OX 세션(섞지 않음, ⭕/❌) · 보충 학년→단원→세션(🧮, "1학년 보충 · 9까지의 수") → 끝까지 풀어도 **EXP·로그 불변** · 교과 10문제 완료 → **+50EXP +30G 지급**(보충 4문제는 집계 제외 확인)

## 🤝 배정 중 (다른 세션)
- 수채화 세션 → `curriculum_review.js`(1~3학년 수학 250~300문항, fig 규격) — PR 오면 `student.html`/`admin.html`에 `<script>` 태그 + smoke 맵은 **내가** 추가.
- 영어앱 세션 → 사회 ox/situation/reason 90문항(curriculum.js 사회 구간만). 그 뒤 영어 하루보상 기준 PR(c14729c cherry-pick, ?v=20260903e) → iframe 임베드 Phase.

## 남은 것
- 교사가 **학습 범위**에서 2학기 진도 단원만 켜기(지금은 1학기 전 범위 1,080문항 노출).
- 보상 모드 기본 'auto'. 영어는 사용자 결정으로 승인형 — 학습게임도 승인형 원하면 학습 범위 화면에서 한 번 바꾸면 됨.
- DB 인증 없음(RTDB 공개 규칙 + 영어앱 Firestore 반비번 경로) — 고위험, 사용자 결정 대기.
