# 우리반 성장 RPG 리팩토링 안전 규칙

> 이 문서는 Phase 7~11에서 확정된 **리팩토링·안정화 안전 규칙**을 한곳에 정리한 것이다.
> 인수인계 배경/이력은 `docs/rpg_refactor_codex_handoff.md`를 참고하고, 이 문서는 **현행 규칙**만 간결히 담는다.
> 핵심: **조사 먼저 · 작은 Phase · 검증 후 PR · 자동 머지 금지 · 보고 후 정지**.

---

## 1. 현재 기준

- 안정화 기준 commit: `b0b8a4d` (Phase 11-J 머지 + 11-K read-only 마감 점검 시점). 이후 갱신될 수 있음 — 항상 최신 main 기준으로 확인.
- GitHub: `chang333787-boop/class-rpg` / 운영: `funclassrpg.kr` (GitHub Pages)
- 작업 폴더: `Projects/우리반RPG/우리반RPG_리팩토링` (영구, 원격 연결됨)
- 현재 안전 상태:
  - `DB.save(` 0건 / `this.save(` 0건
  - 학생/자동 실행 root 저장 경로 0건
  - JS/CSS 외부화 완료 (gamedata.js + student.js + admin.js + kiosk.js / css 3종)
  - **HTML 인라인 `<script>` 0건 / 인라인 `<style>` 0건** (11-I `_lbTouchX`, 11-J `@keyframes ldBar` 제거 완료)
  - CSS link 캐시버스터 적용: `student/admin/kiosk.css?v=20260604`
  - 날짜 기준·kiosk 정규화 단일 소스 통일 완료
  - `node scripts/verify-safety.mjs` → **PASS 18 · REVIEW 1 · FAIL 0**
  - 남은 REVIEW 1건 = root write 후보 5건(gamedata.js:1, admin.js:4)으로 **모두 의도된 게이팅 경로**(init 부트스트랩·import·rollback·reset·전체수치 초기화). 안전 알림으로 **유지 권장**(0으로 강제 시 신규 root write 탐지 사각 발생)
- **리팩토링 1차 마감 가능 상태**: 저위험 외부화·인라인 제거·저장 안전·단일 소스 통일 목표 달성. 남은 후보(§11)는 저가치·선택. 기능 개발 복귀는 사용자 지시 전까지 보류.

---

## 2. 매 작업 기본 절차

1. `git checkout main && git pull --ff-only` → main 최신화, working tree clean 확인
2. **read-only 조사 먼저** (수정 전 구조·위험 파악)
3. 수정 Phase면 새 브랜치 생성 (`refactor/phase-XX-...`)
4. **수정 범위 최소화** — 한 Phase = 한 목표, 변경 파일 최소
5. `git add <특정 파일>`만 사용 (**`git add .` 금지**)
6. 검증(아래 §3) 통과 → PR 생성
7. **자동 머지 금지 기본** — 사용자/GPT 승인 후 머지
8. 머지 후 운영 반영(grep/HTTP) 확인 → **보고 후 정지** (다음 Phase 자동 진행 금지)

---

## 3. 필수 검증

- **시작/종료 시**: `node scripts/verify-safety.mjs` (PASS/REVIEW/FAIL 확인, FAIL이면 중단)
- JS 변경 시: `node --check <file>.js`
- 브라우저 검증(필요 시, **버튼 클릭 없이 로드만**): HTTP 200 / pageerror 0 / console 무관오류만 / 주요 전역 `typeof` / DOM 렌더
- **Firebase write 없이** 검증한다 (로드·정적·typeg·mock 스파이로 대체)
- 시각 회귀 검증: OLD/NEW 스크린샷 비교(차이 시 self-compare로 애니메이션/데이터 비결정성 격리 후 육안 판정)

---

## 4. 금지 패턴

- `DB.save(` — 제거 완료, 재도입 금지 (root 전체 set)
- `this.save(` — gamedata 내 0건 유지
- `git add .` — 특정 파일만 add
- 무승인 root write (`_fbRef.set/remove/update`) 추가
- 무승인 Firebase write
- **기능 추가와 리팩토링을 한 Phase에 섞기**
- `type="module"` 전환 / `async`·`defer` 임의 추가 (인라인 onclick 전역 함수가 깨짐)
- 함수명/변수명 변경, 대규모 함수 분해, 파일 전체 포맷팅

---

## 5. Firebase 저장 규칙

- **학생 전체 set이 허용/필요한 경우** (다필드 원자 저장):
  - `student.js` claimRewards (보상 수령: pendingRewards 제거 + exp/gold/stats 적용)
  - `admin.js` approveReward/approveSingle 등 (승인: exp/gold/level/stats/books + questLog + pendingRewards 제거)
  - → 여러 필드를 함께 바꾸므로 `DB.saveStudent(s)`(= `child('students/'+id).set(s)`) 유지
- **부분 저장해야 하는 경우** (단일 노드만 변경):
  - `kiosk.js` requestQuest/cancelQuest → `child('students/'+s.id+'/pendingRewards').set(s.pendingRewards)` (학생 다른 필드 클로버 방지)
  - saveSettings → `child('settings').set`, pwReset → `child('pwResetRequests/'+id).set/remove`, promotion → `child('promotionRequests').set(배열)`
- **root write 허용 경로** (의도된 게이팅, 검토 후에만):
  - `importData` (confirm + 파일), `confirmRollback` (confirm + 백업 선택), `confirmReset` (confirm + **비밀번호**), `DB.init` (DB 빈 경우 초기화)
  - `resetAllStudents` (confirm + `_fbRef.update({quests:null,questLogs:null})` 부분 update)
- **pendingRewards 규칙**: 학생 객체 내부 **배열** 구조 유지. kiosk는 pendingRewards 경로만 부분 저장. 배열→객체맵 전환은 고위험 보류(§10).
  - 잔여 한계: pendingRewards 배열 단위 동시 경합(kiosk vs admin 승인)은 미해결 — 빈도 낮음(7명·교사 주도)

---

## 6. 날짜 기준 규칙

- 오늘 날짜: **`Utils.todayStr()`** (KST +9, `YYYY-MM-DD`)
- 주 시작: **`Utils.weekStartStr()`** (KST +9, **일요일 시작**)
- **admin·student·kiosk 모두 Utils 사용** (로컬 todayStr/weekStartStr 정의 금지 — 중복 제거 완료)
- 주간 퀘스트 완료/신청 판정도 이 기준(일요일)으로 통일됨

---

## 7. kiosk 정규화 규칙

- kiosk는 자체 normalizeData 대신 **`DB._migrate(DB._normalizeArrays(data))`** 사용 (student/admin과 동일 기준)
- `DB._normalizeArrays` / `DB._migrate`는 **순수 함수처럼 유지**해야 함 (전달된 `data`만 처리)
  - ⚠️ 이 두 함수에 DB 내부 상태(`this._cache`, `this._fbRef` 등) 의존을 추가하면 **kiosk 호출이 깨진다** (kiosk는 DB.init 미사용, 함수만 빌려씀)
- kiosk는 여전히 자체 `fbRef`로 Firebase 구독 (구독 구조 통일은 고위험 보류)

---

## 8. 캐시 버전 규칙

- HTML의 전용 JS 로드는 캐시 방지 쿼리 사용: `<script src="./student.js?v=20260602"></script>` (admin.js / kiosk.js 동일)
- CSS link도 캐시 방지 쿼리 적용: `<link rel="stylesheet" href="./student.css?v=20260604">` (admin.css / kiosk.css 동일, 11-J에서 부착)
- **JS(student/admin/kiosk) 또는 CSS 수정 시 → 해당 HTML의 `?v=` 갱신을 검토**한다
  - 갱신을 누락하면 운영(GitHub Pages)에서 학생 브라우저가 **옛 캐시 파일**을 볼 수 있음
- **docs / scripts 변경은 `?v=` 갱신 불필요** (운영 로드 대상 아님)
- gamedata.js도 `?v=` **부착됨** (2026-07-02, `?v=20260702`) — gamedata 수정 시에도 **세 HTML 모두** `?v=` 갱신 검토
  (과거엔 미부착이라 신구 파일 혼재 위험이 있었음 — smoke-test가 3화면 gamedata 캐시버스터를 검사한다)

---

## 9. Codex 사용 기준

- **기본 협업: GPT 감독 + Claude Code 작업자 + 사용자 승인.** Codex는 기본값 아님
- Codex CLI(`~/.npm-global/bin/codex`, ChatGPT 로그인 기반)는 실재하나 **호출이 느림** → 일상 작업엔 비효율
- 사용한다면: 고위험 구조 변경의 **read-only 보조 검토**(`codex exec -s read-only` / `codex review`)에만. 파일 수정은 Claude가 수행
- 매 작업에 Codex를 끼우지 않는다 (속도/단순성 우선)

---

## 10. 고위험 보류 영역 (건드리기 전 별도 승인 + 조사 Phase 필수)

- `buildMainHTML` (student 메인, 474줄, 강결합) 분해
- canvas / SVG 렌더 (buildCharSVG, _drawYard, _drawTileTexture) — 픽셀 회귀 위험
- 전투 / 몬스터 로직 (renderMonsterStep, renderBattleNew, doFight)
- `GAME_DATA` / 데이터 상수 대구조, expTable, 장비/몬스터/씨앗 id
- `_normalizeArrays` / `_migrate` 내부 로직 대수정 (kiosk 의존, §7)
- pendingRewards 배열 → 객체맵 전환 (student/admin 포함 광범위)
- Firebase root 구조 변경 / 실데이터 마이그레이션
- 대규모 인라인 onclick → addEventListener 전환 (수백 핸들러)
- students 이중 키 구조, 학생 삭제/계정/비밀번호 정책 (상위 검토 필요)

---

## 11. 다음 리팩토링 후보 (참고, 저위험 우선)

> **인라인 정리는 완료** — 11-I `_lbTouchX`(student.js로 이동), 11-J `@keyframes ldBar`(css로 이동) 제거로 HTML 인라인 `<script>`/`<style>` 잔여 0건. 외부화 목표 달성, **리팩토링 1차 마감 가능**(§1).

- `scripts/verify-safety.mjs` 점검 항목 추가 보강 (선택, 저가치)
- kiosk 로컬 잔여 유틸 정리 (선택, 저가치)
- **고위험 후보(§10)는 보류** — 기능 개발 중 해당 영역을 만질 때 표적으로 신중히

---

## 부록: 자주 쓰는 명령

```bash
# 안전 검증 (시작/종료)
node scripts/verify-safety.mjs

# 문법 검사
node --check kiosk.js

# 로컬 로드 검증 서버 (버튼 클릭 없이 로드만)
python3 -m http.server 8800

# 운영 반영 확인 (예)
curl -sI "https://funclassrpg.kr/kiosk.js?v=20260602"
```

> 기능 개발(예: AI 기능)은 이 문서의 범위가 아니다. 기능 작업 시에도 §2~§5 절차/검증은 동일하게 적용한다.
