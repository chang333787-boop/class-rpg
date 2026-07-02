# 우리반 성장 RPG

초등 학급 운영용 웹앱. 학생들이 퀘스트를 수행하고 경험치·골드·레벨·스탯을 쌓으며
캐릭터·농장·전투 등으로 성장하는 "학급 성장 RPG"다.

기술적으로는 **정적 HTML + 바닐라 JavaScript + Firebase Realtime Database** 기반이다.
빌드 도구·번들러·프레임워크·`package.json`이 **없다**. 브라우저가 HTML을 열고,
HTML이 외부 JS/CSS와 Firebase SDK(CDN)를 직접 불러오는 단순 구조다.

> ⚠️ 이 저장소는 RPG 프로젝트 단독이다. (사내 다른 "가지(branch)" 프로젝트와는 **완전 별개**이며,
> RPG에는 AI 기능이 없다.)

---

## 프로젝트 개요

- 대상: 초등 학급(소수 인원, 교사 주도 운영)
- 데이터: Firebase Realtime Database 단일 트리(`classRPG_v3`)에 학급 전체 상태 저장
- 외부 의존성(전부 CDN, npm 설치 없음):
  - Firebase 9.23.0 compat SDK (`app` / `database` / `storage`)
  - Chart.js 4.4.0 (student/admin 통계 차트)
- 현재 상태: 리팩토링 1차 마감(아래 [현재 안정화 상태](#현재-안정화-상태) 참고). 기능 개발은 보류 중.

---

## 화면 구성

세 개의 독립 HTML이 각각 다른 사용자/용도를 담당한다. 셋 다 같은 Firebase 트리를 공유한다.

| 화면 | 파일 | 용도 |
|---|---|---|
| 학생 | `student.html` | 학생 본인 화면. 캐릭터·퀘스트·보상 수령·농장·전투·작품 등 |
| 관리(교사) | `admin.html` | 교사용 관리 화면. 학생 관리, 퀘스트/보상 승인, 설정, 백업/복원/초기화 |
| 키오스크 | `kiosk.html` | 교실 공용 "할 일 체크판". 학생이 퀘스트 신청/취소(부분 저장 위주) |

---

## 파일 구조

루트에 앱 파일이 평면(flat)으로 놓여 있다.

```
gamedata.js        공유 데이터 + DB 레이어 (게임 상수, Utils, Firebase 연결/정규화/저장 helper)
student.html  / student.js  / student.css     학생 화면
admin.html    / admin.js    / admin.css       관리(교사) 화면
kiosk.html    / kiosk.js    / kiosk.css        키오스크(할 일 체크판) 화면
assets/monsters/                               몬스터 이미지 100장 (iconImg()가 이모지 폴백과 함께 표시)
scripts/verify-safety.mjs                      저장 안전 정적 검증 스크립트 (Node 기본 모듈만)
scripts/smoke-test.mjs                         로컬 HTTP/정적 구조 smoke-test
docs/                                          리팩토링 안전 규칙 / 인수인계 / 에셋 명세 문서
CNAME                                          GitHub Pages 커스텀 도메인 (funclassrpg.kr)
```

### 각 파일 역할

- **`gamedata.js`** — 모든 화면이 가장 먼저 로드하는 공유 레이어.
  - `GAME_DATA`: 게임 상수(기본 학생, 장비/몬스터/씨앗, expTable 등)
  - `Utils`: 공통 유틸. 날짜는 `Utils.todayStr()`(KST, `YYYY-MM-DD`), 주 시작은 `Utils.weekStartStr()`(KST, 일요일 시작)로 **단일 소스 통일**
  - `DB`: Firebase 연결·실시간 구독·정규화(`_normalizeArrays`/`_migrate`)·저장 helper(`saveStudent` 등)
- **`student.js`** — 학생 화면 전체 로직(가장 큼). 캐릭터 렌더(SVG)·농장(canvas)·전투·퀘스트·보상 수령 등
- **`admin.js`** — 교사 관리 로직. 학생 편집, 퀘스트/보상 승인, 설정, 백업/가져오기/롤백/초기화
- **`kiosk.js`** — 키오스크 로직. 퀘스트 신청/취소를 학생의 `pendingRewards` 경로만 **부분 저장**(전체 학생 객체 클로버 방지)
- **CSS 3종(`student.css` / `admin.css` / `kiosk.css`)** — 각 화면 전용 스타일. HTML에 인라인 `<style>` 없음
- **`scripts/verify-safety.mjs`** — 저장 안전/구조 정적 검증(아래 [안전 검증](#안전-검증))
- **`docs/`** — [참고 문서](#참고-문서)

### 로드 구조 (중요)

세 HTML 모두 **클래식 스크립트**로 로드한다 — `type="module"`/`async`/`defer`를 쓰지 않는다.

```
(Firebase compat SDK, Chart.js)  →  ./gamedata.js  →  ./<화면>.js
```

- HTML에 인라인 `onclick`/`ontouchstart` 등 전역 함수·전역 변수에 의존하는 핸들러가 많다.
  → 스크립트를 모듈화하거나 `defer`로 바꾸면 **전역이 깨진다.** 평면 전역 스코프를 유지해야 한다.
- 캐시 무효화: JS는 `?v=20260702` 계열, CSS는 `?v=20260604` 쿼리를 붙인다.
  JS/CSS를 수정하면 해당 HTML의 `?v=` 갱신을 검토할 것. `gamedata.js`도 2026-07-02부터 `?v=` 부착.

---

## 실행 방법

빌드 단계가 없다. 정적 파일을 그대로 브라우저가 열면 된다.

로컬 확인은 간단한 정적 서버 사용을 권장한다(상대경로/브라우저 보안정책 안정):

```bash
python3 -m http.server 8800
# → http://localhost:8800/student.html (admin.html / kiosk.html)
```

### `file://` 직접 열기 주의점

- 상대경로 스크립트(`./gamedata.js`)는 `file://`에서도 로드되지만, 정적 서버로 여는 편이 안정적이다.
- **더 중요한 주의**: 로컬에서 열든 운영에서 열든, 앱은 **동일한 실제 운영 Firebase DB(`classRPG_v3`)에 연결**된다.
  별도 로컬/모의 DB가 없다. 따라서 로컬에서 저장·승인·초기화 등을 실행하면 **운영 데이터가 그대로 바뀐다.**
  코드 검증은 읽기/정적 점검 위주로 하고, 쓰기 동작은 실행하지 않는다.

---

## 운영/배포

- **GitHub Pages**로 배포된다. 저장소: `chang333787-boop/class-rpg`
- 커스텀 도메인: **`funclassrpg.kr`** (루트 `CNAME` 파일에 지정됨)
- `main` 브랜치에 머지하면 GitHub Pages가 갱신된다(반영까지 보통 1~3분 지연).
- 운영 반영 확인은 캐시버스터로 한다(쓰기·버튼 클릭 없이 GET만):

```bash
curl -s "https://funclassrpg.kr/student.js?v=20260602&cb=$(date +%s)"
```

---

## Firebase 데이터 구조 요약

루트 키 `classRPG_v3` 아래에 학급 전체 상태가 모여 있다(주요 노드):

| 노드 | 내용 |
|---|---|
| `students` | 학생별 객체(경험치·골드·레벨·스탯·인벤토리·집/농장·작품 등). **`pendingRewards`는 학생 객체 내부의 배열** |
| `questLogs` | 퀘스트 수행 로그 |
| `boardQuests` | 게시판(공용) 퀘스트 |
| `promotionRequests` / `pwResetRequests` | 승급 요청 / 비밀번호 재설정 요청 |
| `artworks` | 학생 작품 |
| `emotionLogs` | 감정 기록 |
| `settings` | 학급 설정(반 이름, 보스, 보상 기준 등) |
| `customMonsters` / `customQuestTemplates` / `hiddenQuestTemplates` | 교사 커스텀/숨김 항목 |
| `backups` | 관리 화면에서 만든 백업 스냅샷 |

- 관리자 비밀번호는 별도 키 `classRPG_adminPw`에 저장된다.
- **저장 안전 원칙**: 루트 전체 쓰기(`_fbRef.set/remove/update`)는 학생 데이터 클로버 위험(footgun)이라 일반 작업에서 금지한다.
  단일 노드만 바꿀 땐 `child('...')` 부분 저장을 쓴다(예: kiosk의 `child('students/<id>/pendingRewards').set(...)`).
- **루트 쓰기가 허용되는 곳은 의도된 게이팅 경로뿐**: 데이터 가져오기(import) / 백업 롤백 / 전체 초기화(reset, 비밀번호 확인) / 전체 수치 초기화 / 빈 DB 최초 부트스트랩.
  이 경로들은 검증 스크립트에서 수동 확인 대상(REVIEW)으로 남는다.

---

## 안전 검증

저장 footgun과 구조 회귀를 막기 위한 정적 검증 스크립트가 있다(외부 의존성 0, Node 기본 모듈만):

```bash
node scripts/verify-safety.mjs
```

- 작업 **시작과 끝**에 실행한다. `FAIL`이 1개라도 있으면 중단한다.
- 현재 기대 결과: **`PASS 18 · REVIEW 1 · FAIL 0`** (exit code 0)
- 남은 `REVIEW 1`건 = 루트 쓰기 후보(`gamedata.js` 1 + `admin.js` 4). 전부 위의 **의도된 게이팅 경로**다.
  0으로 강제하지 않는다 — 강제하면 새로 추가되는 진짜 루트 쓰기를 못 잡는 사각이 생긴다. **안전 알림으로 유지**한다.

검증 시 점검하는 주요 항목: 필수 파일 존재, `node --check` 문법, `DB.save(`/`this.save(` 0건,
kiosk `pendingRewards` 부분 저장, HTML 로드 순서/클래식 로드, 날짜 helper Utils 통일, kiosk 정규화 통일,
HTML 인라인 `<script>`/`<style>` 잔여 등.

---

## 작업 원칙

리팩토링/안정화 작업은 다음 규칙을 따른다(상세는 `docs/rpg_refactor_safety_rules.md`).

- **협업 방식**: GPT 감독 + Claude Code 작업자 + 사용자 승인. **Codex는 기본 사용하지 않는다.**
- **한 작업 = 한 목표**. 기능 추가와 리팩토링을 한 작업에 섞지 않는다.
- `git checkout main && git pull --ff-only`로 시작, read-only 조사 먼저, 작은 수정, 시작/끝 검증.
- `git add .` **금지** — 변경한 특정 파일만 add 한다.
- PR 생성 후 **자동 머지 금지**. 사용자/GPT 승인 후 머지하고, **보고 후 정지**한다.
- Firebase write·운영 버튼 클릭으로 검증하지 않는다. 로드/정적/`typeof`/grep으로 대체한다.
- `gh` CLI가 PATH에 없을 수 있다 → PR 작업은 `~/bin/gh`를 우선 사용한다.

---

## 고위험 주의 영역

아래는 건드리기 전에 별도 승인 + 조사가 필요한 영역이다(현재 보류).

- **Firebase 루트 구조 변경 / 실데이터 마이그레이션**
- `pendingRewards` 배열 → 객체맵 전환(student/admin/kiosk 광범위 영향)
- `student.js`의 `buildMainHTML`(메인 화면, 길고 강결합) 분해
- 전투/몬스터 로직, canvas/SVG 렌더(픽셀 회귀 위험)
- `GAME_DATA`/데이터 상수 대구조, `_normalizeArrays`/`_migrate` 내부 로직 대수정(kiosk가 함수만 빌려 씀 — 순수성 유지 필요)
- 대규모 인라인 `onclick` → `addEventListener` 전환(전역 핸들러 다수)

---

## 참고 문서

- `docs/rpg_refactor_safety_rules.md` — **현행 안전 규칙**(저장 규칙·날짜/정규화·캐시 버전·고위험 보류·검증 절차)
- `docs/rpg_refactor_codex_handoff.md` — 과거 인수인계/이력 배경(참고용, 일부 옛 기준 포함)

---

## 현재 안정화 상태

- 기준 commit: `7c3350e` (리팩토링 1차 마감)
- `verify-safety.mjs` → `PASS 18 · REVIEW 1 · FAIL 0`
- JS/CSS 외부화 완료, HTML 인라인 `<script>`/`<style>` 잔여 **0건**
- `DB.save(`/`this.save(` 0건, 루트 저장 위험 정리됨
- 날짜 기준·kiosk 정규화 단일 소스 통일 완료
- 기능 개발 복귀는 사용자 지시 전까지 보류
