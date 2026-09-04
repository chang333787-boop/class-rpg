# 2026-09-03 (기기: 학교 Windows) — 1~3학년 수학 보충학습 문항 은행 (MATH-REVIEW-1)

> 담당: 수학 보충 문항 세션(보스 세션 밑 서브). 같은 날 영어 연동·수채화·사이트 첫 화면 세션과 병행 — **새 파일 2개만 추가**, 기존 파일 수정 없음(파일 겹침 없음).

- **브랜치**: `feat/math-review-bank` (worktree `C:\Users\USER\projects\class-rpg-wt-mathreview`, base `origin/main` f2ea87d)
- **새 파일**: `curriculum_review.js`(repo 루트), 본 worklog
- **안 건드림**: curriculum.js · student.js · admin.js · gamedata.js · kiosk.* · index.html · Firebase 구조/규칙
- **git 작업 없음**: add/commit/push는 보스 세션이 함

## 한 일
1. `curriculum_review.js` — 클래식 `<script>`, 전역 상수 `REVIEW_CURRICULUM` / `REVIEW_PROBLEMS`. curriculum.js 와 같은 문항 형식(`type/cat/level/q/a/choices/hint`)에 그림 필드 `fig` 추가.
   - 단원 id `ma<학년>-<번호>`(1·2학기 합침, 학기 없음), 문항 id `r_ma<학년>_<단원>_<번호>` — 접두 `r_` 로 curriculum.js 의 `p_` 와 충돌 방지.
   - 4학년 학생의 1~3학년 복습용(보충). 보상과 무관. 교과서 문장 베끼지 않고 2022 개정 성취기준 기준으로 새로 씀(파일 머리말에 원칙·id 규칙·fig 규격 기록).
   - `fig` 규격: angle · polygon(+`angles:[…]` 옵션) · rect · clock · fraction · blocks · grid · numline · shapes · move(`op:'?'` 허용) · ruler. 도형·시계·분수·길이·원 단원은 절반 넘게 fig 포함, 계산 단원은 없음. 보스 세션 요청으로 `polygon.angles` 와 `move.op:'?'` 두 규격을 허용 목록에 추가(ma2-2 에 `move ?` 문항 2개 사용, `angles` 는 문서만).
2. 검증 스크립트는 repo 밖(스크래치 `validate_review.mjs`) — `vm` 으로 파일을 로드해 아래 항목을 검사.

## 단원 목록

| 학년 | 단원 수 | 문항 수 | fig 문항 | 단원(문항/fig) |
|---|---|---|---|---|
| 1학년 | 8 | 93 | 24 | 9까지의 수(12/2) · 여러 가지 모양(11/8) · 덧셈과 뺄셈(11/1) · 비교하기(11/0) · 50까지의 수(11/3) · 100까지의 수(11/1) · 덧셈과 뺄셈(2)(13/0) · 시계 보기와 규칙 찾기(13/9) |
| 2학년 | 10 | 118 | 35 | 세 자리 수(12/3) · 여러 가지 도형(14/10) · 덧셈과 뺄셈(12/0) · 길이 재기(12/7) · 분류하기(10/2) · 곱셈(12/5) · 네 자리 수(11/0) · 곱셈구구(12/1) · 시각과 시간(13/7) · 표와 그래프(10/0) |
| 3학년 | 9 | 104 | 30 | 덧셈과 뺄셈(11/0) · 평면도형(12/8) · 나눗셈(12/1) · 곱셈(12/0) · 길이와 시간(12/7) · 분수와 소수(13/7) · 원(11/7) · 들이와 무게(11/0) · 자료의 정리(10/0) |
| **합계** | **27** | **315** | **89** | level 1/2/3 = 140/153/22 · type number 206 / choice 108 / short 1 · cat calc 101 / concept 156 / word 58 |

- 2학년 "규칙 찾기"는 뺐음(10개 제한. 규칙 문항은 1학년 8단원에 흡수).
- 1학년 모양 단원은 1학기 입체(상자·둥근 기둥·공, 글로만)와 2학기 평면(네모·세모·동그라미, `shapes` fig)을 합침.

## 검증 결과 (2026-09-03)
- `node --check curriculum_review.js` → **OK**
- 스크래치 검증 스크립트(`vm` 로드) → **ALL PASS**
  - id 중복 **0** · 고아 unitId **0** · choice 정답 ∉ choices **0**(choices 3~4개·중복 없음 포함) · number 정답 비숫자 **0** · q/a/hint 누락 **0**
  - fig.kind 허용 목록 외 **0**, fig 값 범위 오류 **0**(clock h 1~12·m 0~59, fraction k≤n, shapes 항목명, move shape/op 등)
  - 단원당 문항 ≥10 **전 단원 충족**(최소 10, 최대 14) · 학년별 단원 수 8/10/9 (8~10 범위)
  - 도형·시계·분수·길이·원 9개 단원 모두 fig 비율 > 1/2
  - 문항 id ↔ unitId 일치, 단원 no 연속
- 브라우저 테스트 없음(렌더러 통합 전, 정적 데이터 파일이라 불필요).

## 다음 할 일
- **보스 세션**: `student.html`/`admin.html` 에 `<script src="curriculum_review.js">` 로드 태그 추가 + 학습게임에서 `REVIEW_CURRICULUM.math.grades` 를 학년 선택 → 단원 선택 흐름으로 연결(정답 판정은 `CurriculumUtils.isCorrect` 재사용 가능 — `a` 형식 동일).
- fig 렌더러 연결 후 실제 그림과 문항이 맞는지 한 번 훑기(특히 clock·fraction·ruler·numline).
- 교사가 단원 켜고 끄는 설정(`activeProblemUnits` 같은)을 보충에도 쓸지는 보스 결정.

## 주의/미해결
- 총 문항 315개로 목표(250~300)보다 약간 많음. 줄여야 하면 계산 단원(ma1-7·ma2-3·ma3-4 등)에서 level 1 중복 유형부터.
- `fraction` 문항에서 답이 두 가지로 읽히는 것(4/8 = 1/2)은 피했지만, 렌더러가 색칠 순서를 다르게 그리면 "색칠하지 않은 부분"(r_ma3_6_05) 문항 확인 필요.
- `move op:'?'` 문항(r_ma2_2_13·14)은 2022 개정 2학년 성취기준 밖(도형 이동은 4학년)이라 level 3 도전 문항으로만 둠. 렌더러가 `?` 를 어떻게 그리느냐에 따라 문구 손볼 수 있음.
- `polygon.angles` 는 규격만 문서화, 사용 문항 없음.
- 한글 "몇 cm/mm/분" 류는 모두 `(숫자만)` 을 붙여 number 형으로 통일. short 형은 1문항(r_ma1_4_10 '무겁다')뿐 — `alt` 없음.
