# 우리반 성장 RPG 모듈 아키텍처 계획

> 이 문서는 우리반 성장 RPG를 **점진적으로 현대화/모듈화**할 때 기준이 되는 설계 문서다.
> 기능 개발 문서가 아니며, 이 문서 자체로는 어떤 코드도 바꾸지 않는다.
> 운영 규칙·검증 절차는 `docs/rpg_refactor_safety_rules.md`를, 프로젝트 개요는 `README.md`를 따른다.
> 핵심 입장: **전면 재작성하지 않는다. 전역 호환을 유지한 채 기능별 경계를 만든다.**

작성 기준: main `0907035` (M-1 smoke-test까지 완료). 코드 규모는 §2 참조.

---

## 1. 목적

- **현대화의 목표**: 거대 단일 JS와 인라인 이벤트 결합으로 인한 "수정 시 회귀 위험"과 "기능 추가 난이도"를 낮춘다.
- **전면 재작성 금지**: React/Vue/Svelte로 다시 쓰지 않는다. 현재 앱은 7명 학급에서 실제 운영 중(funclassrpg.kr)이며, 재작성의 회귀 비용이 이득보다 크다.
- **점진적 모듈화 원칙**: 한 번에 하나의 작은 경계만 만든다. 각 단계는 검증 가능하고, 실패 시 되돌리기 쉬운 크기로 유지한다.
- 이 문서는 **앞으로의 Phase가 따를 지도**다. 다음 작업자가 그대로 이어받을 수 있도록 구체적으로 적는다.

---

## 2. 현재 구조

```
class-rpg/
  CNAME                  # funclassrpg.kr (GitHub Pages)
  student.html           # 학생 화면 (CDN → gamedata.js → student.js)
  admin.html             # 교사/관리 화면 (CDN → gamedata.js → admin.js)
  kiosk.html             # 키오스크 화면 (CDN → gamedata.js → kiosk.js)
  gamedata.js  (2,659줄) # 공통: GAME_DATA 상수 + DB 레이어 + Utils + 정규화 (2026-07-02 기준)
  student.js   (9,403줄) # 학생 기능 전체 (가장 큼)
  admin.js     (5,181줄) # 관리 기능 전체 (탭별 render)
  kiosk.js       (694줄) # 키오스크 기능 (가장 작고 경계 뚜렷)
  *.css × 3              # 화면별 스타일
  scripts/
    verify-safety.mjs    # 정적 저장안전 검증
    smoke-test.mjs       # 로컬 HTTP/정적 구조 smoke-test
  docs/
    rpg_refactor_safety_rules.md   # 현행 안전 규칙
    rpg_refactor_codex_handoff.md  # 인수인계 이력
```

구조의 성격:

- **정적 HTML + 전역 바닐라 JS + Firebase Realtime Database.** 빌드 도구 없음, `package.json` 없음, 번들러/프레임워크 없음.
- **로드 규약**: (CDN: Firebase compat 9.23.0 + Chart.js 4.4.0) → `gamedata.js` → 화면 전용 JS. **모두 클래식 `<script>`** (`type="module"`/`async`/`defer` 없음). 이유는 HTML 인라인 `onclick`/`ontouchstart`가 전역 함수를 직접 부르기 때문 — 모듈 스코프로 바뀌면 그 호출이 전부 깨진다.
- **DB 레이어는 이미 `gamedata.js`에 캡슐화됨.** student.js / admin.js는 `firebase.database()`를 직접 부르지 않고 전역 `DB`를 경유한다. **kiosk.js만 자체 `fbRef`로 구독**한다(정규화 helper는 공유 `DB._migrate(DB._normalizeArrays(...))` 사용).
- **검증 자산 존재**: `verify-safety.mjs`(저장 안전·로드 규약 정적 점검), `smoke-test.mjs`(로컬 HTTP 200·로드 구조·전역 심볼 존재). 둘 다 Node 기본 모듈만 사용, 외부 의존성 0.
- 약점(M-0 조사 결론): ① 거대 단일 `student.js`, ② 수백 개의 인라인 이벤트 + 전역 함수 결합. 이 둘이 회귀 위험과 수정 난이도의 핵심 원인이다.

---

## 3. 현대화 기본 원칙

1. **한 번에 하나** — 한 Phase = 한 경계. 변경 파일과 변경 범위를 최소화한다.
2. **기능 개발과 구조 변경 분리** — 같은 PR/Phase에 섞지 않는다. 리팩토링 PR은 동작이 동일해야 한다.
3. **전역 호환 유지** — 분리하더라도 `DB`, `Utils`, `GAME_DATA`, 인라인 onclick이 부르는 전역 함수는 그대로 전역에 노출되어야 한다(§6).
4. **Firebase write 경로 변경 금지** — 저장 함수의 호출부/노드 경로를 현대화와 함께 바꾸지 않는다. write 규칙은 안전 규칙 문서 §5를 그대로 따른다.
5. **검증 먼저** — 매 작업 전후로 `verify-safety.mjs` + `smoke-test.mjs`를 돌린다(§11).
6. **PR 단위 작게** — 리뷰 가능한 크기. 자동 merge 금지, 사용자 승인 후 merge.

---

## 4. 하지 말아야 할 것

- React/Vue/Svelte로의 **전면 재작성**.
- **Vite/번들러 즉시 도입** (후순위 검토 대상이며 현재 비추천 — §13 기준으로 재판단).
- **`type="module"` 일괄 전환** — 인라인 이벤트/전역 함수 의존 때문에 당장 금지.
- **`student.js` 대분해**를 초기에 시도.
- **`buildMainHTML` / canvas / 전투 로직을 동시에** 수정.
- **Firebase root 구조 변경** 또는 실데이터 마이그레이션.
- **`pendingRewards` 배열 → 객체맵 전환**을 현대화 작업과 함께 진행 (자료구조 변경은 별개 고위험 Phase).
- 함수명/변수명 대량 변경, 파일 전체 재포맷 (diff 노이즈 + 회귀 위험).

---

## 5. 목표 구조 초안

아래는 **최종 지향점**이다. **즉시 생성하지 않는다.** 단계별로 일부만, 검증을 거쳐 접근한다.

```
src/
  shared/
    db.js            # 현재 gamedata.js의 DB 레이어
    utils.js         # Utils (todayStr/weekStartStr 등)
    normalizers.js   # _normalizeArrays / _migrate (순수 함수 유지)
    constants.js     # GAME_DATA, expTable, 장비/몬스터/씨앗 id
    firebase.js      # Firebase config/init
  kiosk/
    main.js
    state.js
    render-table.js
    quests.js
    emotion.js
    memories.js
  admin/
    dashboard.js
    students.js
    quests.js
    rewards.js
    settings.js
    backup.js
  student/
    lightbox.js
    emotion.js
    quests.js
    shop.js
    inventory.js
    farm.js
    house.js
    battle.js        # 고위험 보류 — 마지막
```

전제:

- 이 트리는 **방향 지시일 뿐**, 한 번에 만들지 않는다.
- 분리하더라도 당분간은 **클래식 `<script>`로 여러 파일을 순서대로 로드**하고, 각 파일이 전역에 심볼을 노출하는 방식을 유지한다(번들러/모듈 도입은 별도 판단).
- `shared/`가 가장 먼저 안정화되어야 다른 화면이 의존할 수 있다. 단 현재는 `gamedata.js` 단일 파일 유지가 더 안전하다(§6).

---

## 6. shared 레이어 설계

`gamedata.js`가 담는 공유 자산:

- **DB** (init / onDataChange / load / saveStudent / saveQuestLog / saveSettings / saveMemory 등)
- **Utils** (todayStr / weekStartStr = KST+9, 주 시작 일요일)
- **정규화** (`_normalizeArrays`, `_migrate`)
- **GAME_DATA / 상수** (expTable, 장비·몬스터·씨앗 id)
- **Firebase config**

원칙:

- **현재는 `gamedata.js` 단일 파일을 유지한다.** shared 분리는 로드맵 후반(M-8)에서 재검토.
- 분리하게 되면 **전역 `DB` / `Utils` / `GAME_DATA`가 그대로 전역에 노출**되어야 한다. student/admin/kiosk가 전역 이름으로 참조하기 때문.
- **`_normalizeArrays` / `_migrate`는 순수 함수처럼 유지**한다. 전달된 `data`만 처리하고 `this._cache`/`this._fbRef` 같은 DB 내부 상태에 의존하지 않는다. kiosk가 `DB.init` 없이 이 두 함수만 빌려 쓰기 때문에, 내부 상태 의존을 추가하면 **kiosk 호출이 깨진다**(안전 규칙 §7).

---

## 7. 전역 호환 유지 원칙

현대화의 가장 큰 위험은 "모듈로 옮기면서 전역 노출을 끊는 것"이다. 이를 방지한다.

- 인라인 `onclick="foo()"`가 부르는 함수는 **반드시 `window.foo`로 남아 있어야** 한다. 파일을 나눠도 마지막에 전역에 다시 붙인다(예: 파일 끝에서 `window.foo = foo;`).
- 화면 진입점 `window.onload`는 화면당 하나로 유지한다(현재 student/admin/kiosk 각 1개).
- 분리 단계에서 **전역 심볼 목록을 먼저 적고**, 분리 후 `smoke-test.mjs`의 심볼 존재 검사로 노출이 유지됐는지 확인한다.
- `type="module"`은 전역 노출을 자동으로 끊으므로, 인라인 이벤트가 남아 있는 한 도입하지 않는다. 이벤트 위임(§10)이 충분히 진척된 뒤에야 모듈 전환을 논의한다.

---

## 8. kiosk 파일럿 전략

kiosk가 첫 파일럿으로 적합한 이유: **가장 작고(753줄), 함수 수가 적고(약 19개), 경계가 뚜렷**하다.

단계(각각 별도 Phase, 검증 통과 후 진행):

1. **기능 지도 (read-only)** — kiosk.js의 기능 구역(상태/테이블 렌더/퀘스트/감정/추억 등)과 전역 노출·Firebase 구독 지점을 문서로 정리. 코드 무변경.
2. **내부 구역 주석/정리** — 동작 동일. 구역 구분 주석, 명백한 죽은 코드만 제거(있다면). diff 최소.
3. **소기능 1개 분리 실험** — 가장 독립적인 기능 하나를 별도 파일로 빼고, 전역 호환을 유지한 채 kiosk.html에서 순서대로 로드. `verify-safety` + `smoke-test` 통과 확인.

주의:

- kiosk는 자체 `fbRef`로 구독한다. **구독 구조 통일은 고위험 보류**(안전 규칙 §7) — 파일럿에서 건드리지 않는다.
- 정규화는 공유 `DB._migrate(DB._normalizeArrays(...))`를 계속 사용한다.

---

## 9. admin 분리 전략

- admin.js(5,462줄)는 **탭별 `render*` 구조**가 있어 분리 후보가 명확하다: dashboard / students / quests / rewards / settings / backup 등.
- 접근: 먼저 **탭별 기능 지도**(read-only)를 만든 뒤, 저위험 렌더 구역부터 경계를 긋는다.
- **저장/승인 로직은 신중하게.** approveReward/approveSingle 등은 exp/gold/level/stats/books + questLog + pendingRewards 제거를 함께 처리하는 다필드 원자 저장(`DB.saveStudent`)이다. 이 경로의 호출부를 현대화와 함께 바꾸지 않는다(안전 규칙 §5).
- 날짜 helper는 `Utils.todayStr`/`Utils.weekStartStr`로 통일 유지(로컬 재정의 금지, verify-safety가 감시).

---

## 10. student 분리 전략

- student.js(10,127줄)는 **가장 마지막**에 다룬다. 규모가 크고 고위험 영역을 포함한다.
- 시작은 **저위험 독립 기능부터**: lightbox / emotion / quests 같은 비교적 경계가 분명한 부분.
- **보류(고위험, §13)**: `buildMainHTML`(메인 화면 대형 빌더), canvas 렌더(`_drawYard`/`_drawTileTexture`), `buildCharSVG`, 전투 로직(`renderMonsterStep`/`renderBattleNew`/`doFight`). 픽셀/동작 회귀 위험이 커서 별도 승인 + 조사 Phase 없이는 건드리지 않는다.
- 대형 render는 **먼저 기능 지도(문서)를 만든 뒤** 접근한다. 지도 없이 분해 시작 금지.

---

## 11. 이벤트 구조 전환 전략

- 현재: HTML 인라인 `onclick`/`ontouchstart` + 전역 함수 직접 호출. 수백 개.
- **즉시 대량 `addEventListener` 전환 금지** — 한 번에 바꾸면 회귀 추적이 불가능하다.
- 최종 목표: **`data-action` 기반 이벤트 위임**(컨테이너 한 곳에서 위임, HTML에는 `data-action="..."`만). 인라인 핸들러가 사라져야 `type="module"` 전환도 가능해진다.
- 순서: **kiosk에서 먼저 작은 범위로 실험** → admin → **student는 마지막**. 각 전환은 동작 동일을 전제로, 같은 화면 안에서 인라인과 위임이 섞여 있어도 되도록 점진 적용한다.

---

## 12. 테스트/검증 전략

- **매 작업 전후 필수**:
  - `node scripts/verify-safety.mjs` (저장 안전·로드 규약·날짜/정규화 통일)
  - `node scripts/smoke-test.mjs` (로컬 HTTP 200·로드 구조·전역 심볼 존재)
- **JS 변경 시**: `node --check <file>.js`.
- **현재 기대 기준선**: verify-safety = PASS 18 · REVIEW 1 · FAIL 0, smoke-test = PASS 30 · REVIEW 0 · FAIL 0
  (2026-07-02 gamedata 캐시버스터 검사 3건 추가로 27→30). FAIL 발생 또는 기준선 이탈 시 중단·보고.
- **REVIEW 1 유지**: root write 후보 5건(gamedata.js init, admin import/rollback/reset/resetAll)은 의도된 게이팅 경로. 0으로 강제하지 않고 알림으로 둔다(신규 root write 탐지 사각 방지).
- **파일을 나누면 smoke-test 대상/심볼 목록도 함께 보강**해야 한다(별도 검토). 단 이 문서 Phase에서는 scripts를 수정하지 않는다.
- HTTP/브라우저 런타임 검증(DOM 렌더, pageerror, 클릭 동작)이 필요하면 **별도 승인** 후 진행. **Firebase write 없이** 검증한다.

---

## 13. 고위험 보류 영역

건드리기 전 **별도 승인 + 조사 Phase 필수**(안전 규칙 §10과 동일):

- `buildMainHTML` (student 메인 대형 빌더) 분해
- canvas / SVG 렌더 (`buildCharSVG`, `_drawYard`, `_drawTileTexture`) — 픽셀 회귀
- 전투 / 몬스터 로직 (`renderMonsterStep`, `renderBattleNew`, `doFight`)
- `GAME_DATA` / 상수 대구조, expTable, 장비·몬스터·씨앗 id
- `_normalizeArrays` / `_migrate` 내부 로직 대수정 (kiosk 의존)
- `pendingRewards` 배열 → 객체맵 전환 (student/admin 광범위)
- Firebase root 구조 변경 / 실데이터 마이그레이션
- kiosk 자체 구독(`fbRef`) 구조 통일
- 대규모 인라인 onclick → addEventListener 일괄 전환

---

## 14. 판단 기준 (어떤 변경을 진행/보류할지)

각 모듈화 후보에 대해 다음을 묻는다:

- **회귀 위험이 코드량 감소보다 작은가?** (코드 양 감소보다 회귀 위험 감소가 우선.)
- **이 변경으로 기능 추가가 실제로 쉬워지는가?**
- **Firebase write 위험이 늘지 않는가?** (저장 경로/원자성이 그대로인가.)
- **검증 가능한가?** (verify-safety/smoke-test/`node --check`로 확인 가능한가.)
- **전역 호환이 유지되는가?** (인라인 이벤트가 부르는 전역 함수가 남는가.)

"현대적으로 보인다"는 이유만으로는 진행하지 않는다. 운영 위험이 크면 보류한다.

---

## 15. 추천 로드맵

| 단계 | 내용 | 성격 |
|------|------|------|
| M-1 ✅ | 로컬 HTTP/정적 구조 smoke-test 추가 | 완료 (안전망) |
| **M-2 ✅(본 문서)** | 모듈 아키텍처 계획 작성 | 문서, 코드 무변경 |
| M-3 | kiosk 기능 지도 (read-only) | 조사 |
| M-4 | kiosk 내부 구역 주석/정리 (동작 동일) | 저위험 |
| M-5 | kiosk 소기능 1개 분리 실험 (전역 호환 유지) | 저위험 파일럿 |
| M-6 | admin 탭별 기능 지도 (read-only) | 조사 |
| M-7 | student 기능 지도 (고위험 영역 격리 표시) | 조사 |
| M-8 | shared 레이어 분리 가능성 재검토 | 판단 |
| 이후 | Vite / ES module / 이벤트 위임 본격화 여부 재판단 | §14 기준 |

각 단계는 **사용자 지시 후 시작**하며, PR은 작게·자동 merge 금지·보고 후 정지 원칙을 따른다.

---

## 부록: 관련 문서

- `README.md` — 프로젝트 개요·실행·배포·Firebase 노드
- `docs/rpg_refactor_safety_rules.md` — 현행 안전 규칙(저장/날짜/정규화/캐시/검증)
- `docs/rpg_refactor_codex_handoff.md` — 인수인계 이력/배경
- `scripts/verify-safety.mjs` — 정적 저장안전 검증
- `scripts/smoke-test.mjs` — 로컬 HTTP/정적 구조 smoke-test
