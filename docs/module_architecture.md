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
- **2026-10-04 1차 나누기(R1)** = 기능 덩어리를 글자 그대로 `student/*.js` 로 떼어 옮김 → §16. 함수 안을 쪼개는 일(위 보류 목록)은 아직 하지 않았다.

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
- **현재 기대 기준선**: verify-safety = PASS 26 · REVIEW 1 · FAIL 0, smoke-test = PASS 30 · REVIEW 0 · FAIL 0
  (2026-10-04 student 나누기 뒤 — §16. 그 전 verify 18 · smoke 29). FAIL 발생 또는 기준선 이탈 시 중단·보고.
- **REVIEW 1 유지**: root write 후보 5건(gamedata.js init, admin import/rollback/reset/resetAll)은 의도된 게이팅 경로. 0으로 강제하지 않고 알림으로 둔다(신규 root write 탐지 사각 방지).
- **파일을 나누면 smoke-test 대상/심볼 목록도 함께 보강**해야 한다. student 는 2026-10-04 에 그렇게 했다(§16 — 학생 코드를 읽는 시험은 `scripts/unit/student-sources.mjs` 로).
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

## 16. 2026-10-04 student 나누기 (R1 · 떼어 옮기기)

student.js(16,774줄 · 976KB)를 **글자 하나 안 바꾸고** 덩어리째 새 클래식 스크립트로 옮겼다. 기준 = main `1b6d3e5c`.

| 파일 | 줄 | KB | 담은 것 (원래 student.js 줄) |
|------|---:|---:|------|
| `student.js` | 3,131 | 174 | 바탕 — 상태·초기화·화면 전환·홈(buildMainHTML)·쪽지·보상·상점·보스·농장·집 허브(houseTab·openHouseTab·renderHouse)·인벤토리·퀘스트·레이아웃·업적·랭킹·모달·토스트 |
| `student/char.js` | 520 | 26 | 캐릭터 그림 — SVG 빌더·종이인형 84장 (688–1204) |
| `student/battle.js` | 1,713 | 90 | 몬스터·사냥터·전투 (2535–4244) — 보스는 student.js |
| `student/deco.js` | 8,188 | 516 | 꾸미기 인테리어(마당·집 안) (4573–12402) + 친구 마당 구경·방문 (14159–14512) |
| `student/art.js` | 787 | 39 | 작품 전시(Storage) (12403–12948) + 우리 반 작품 올리기 ARTFREE (15415–15651) |
| `student/emotion.js` | 525 | 23 | 감정 돌아보기 팝업 (12949–13470) |
| `student/reading.js` | 295 | 13 | 독서 기록 (13867–14158) |
| `student/weekly.js` | 389 | 22 | 주간 다짐 (14698–15083) |
| `student/study.js` | 1,266 | 72 | 영어 단어장·팝업 퀴즈 (15084–15211) + 오늘의 학습 (15405–15414) + 문항별 숙달도 MASTERY (15652–끝) |

**원칙(지킨 것)**
- 코드 글자 그대로 — 옮긴 자리에는 `// ── [SPLIT-1] 여기 있던 '<이름>' 덩어리(N줄)는 student/<파일> 로 옮겼다 ──` 한 줄, 새 파일 머리에는 주석 두 줄 + 덩어리마다 원래 줄 번호 한 줄. 표시 줄 자리에 덩어리를 다시 끼우면 원본과 **바이트까지 같다**(R1 PR 본문의 verbatim 결과).
- 전역 그대로 · 클래식 `<script>` · 순서 = `student.js` 바로 뒤 `char → battle → deco → art → emotion → reading → weekly → study` · 각 `?v=`.
- 안 한 것: ES 모듈 전환 · onclick 전환 · 이름 바꾸기 · 죽은 코드 지우기 · buildMainHTML 쪼개기 · 함수 안 쪼개기.
- 경계는 모두 **최상위 문장 사이**(걸친 문장 0). 최상위 이름 겹침 0(`global-dup-check`: 1,096개 그대로).

**왜 동작이 같은가 / 달라진 한 가지**
- 옮긴 덩어리가 불러오는 즉시 실행하는 코드(이벤트 등록·`loadCharDolls()`·`fetch(bbox.json)` 등)는 student.js 쪽 이름(이미 다 정의됨)이나 같은 파일 이름만 쓴다. student.js 쪽 즉시 실행 코드는 옮긴 이름을 쓰지 않는다(쓰는 곳은 `window.onload`·이벤트 처리기 안 — 모든 스크립트가 끝난 뒤 돈다).
- 달라진 것: `resize` 처리기 **등록 순서** — 꾸미기 둘(`_floorPickSoon`·`_decoPillarSync`)이 student.js 의 `syncHudButtons`·`applyScale` 뒤로 갔다. 꾸미기 전체화면(#interior-fullscreen)은 `#s-game` 밖이라 `applyScale`(#s-game 크기)과 서로 영향이 없고, `syncHudButtons` 는 단추 글자만 바꾼다. keydown·visibilitychange·DOMContentLoaded 처리기의 서로 순서는 그대로.

**시험(안전망)도 함께 고쳤다** — student.js 글자만 읽으면 옮긴 파일을 조용히 빠뜨린다.
- `scripts/unit/student-sources.mjs`: `studentScriptFiles(ROOT)`(student.html 의 실제 `<script>` 순서) · `readStudentSources(ROOT)`(이어 붙인 글자) · `studentDirFiles(ROOT)`.
- 이걸로 읽게 바꾼 것: `run.mjs`(`read('student.js')` 는 이제 오류 — 실수로 다시 쓰면 바로 드러남) · `deco-life-sync-sim` · `promo-sync-sim` · `save-order-check` · `whole-set-check` · `student-known-check` · `esc-parity` · `verify-safety`(문법·저장 패턴·로드 순서·클래식) · `smoke-test`(필수 파일·클래식·DB 캐시 정렬 + **student/ 폴더 파일이 모두 student.html 에 있나** 새 검사) · `deco-perf`(파일 KB + 학생 JS 합) · `precheck`(student/ 를 고친 PR 도 꾸미기 하네스가 돈다).
- 따로 고칠 것 없던 것: `global-dup-check`(html 순서를 읽음) · `buster-check`(html 의 `student/…?v=` 줄을 그대로 봄).
- 숫자: verify-safety 18 → **26**(`node --check` student/*.js 8개) · smoke 29 → **30** · save-order **11곳 그대로** · whole-set 14 · student-known 29 · unit 287 · precheck --no-deco 23 그대로.

**새로 고칠 때**
- 그 기능이 있는 `student/` 파일을 고치고, 그 파일 줄의 `?v=` 만 올린다(student.html). 새 파일을 만들면 html 에 `<script>` 한 줄(student.js 뒤)을 꼭 — 빠지면 smoke 가 FAIL.
- 덩어리 사이 부르기는 전역 그대로라 자유롭지만, **불러오는 즉시 도는 코드**에서 뒤 파일 이름을 부르면 안 된다(아직 없음).

**다음 단계(제안 · 각각 따로 승인)**
1. **꾸미기 늦게 불러오기** — `student/deco.js`(516KB, 학생 JS 의 절반)를 꾸미기를 열 때만 부른다. 그래서 집 허브(houseTab·openHouseTab·renderHouse)와 농장은 student.js 에 남겼다(첫 화면·집 모달이 deco.js 없이 돈다). 그 전에 student.js·다른 파일이 deco 이름을 부르는 자리(대개 `typeof … === 'function'` 가드)를 지도로 만들고, 상점 꾸미기 썸네일·친구 마당·`decoFlush`(onload·pagehide) 처럼 열기 전에도 불리는 길을 먼저 정한다.
2. **꾸미기 안 더 쪼개기** — deco.js 8,188줄을 그리기·바닥·동물·서랍·사진 등으로(같은 떼어 옮기기 방식).
3. **admin.js** — 같은 방식으로 탭별 떼어 옮기기(admin.html · 시험은 같은 꼴의 admin-sources).

---

## 17. 2026-10-04 첫 로딩 줄이기 (R6 · R7 · 늦게 불러오기)

반 25명이 아침에 한꺼번에 들어오는 학교 와이파이에서 학생 첫 화면이 받는 것을 줄였다. 바탕 = student.js 의 `loadScriptOnce(url)`(같은 주소 한 번 · 실패하면 다시 시도할 수 있게 기록을 지움).

| 무엇 | 전 | 후 | 못 받으면 |
|------|----|----|-----------|
| Chart.js 4.4.0 (감정 차트 둘) | `<head>` 동기 태그 | 감정 탭에서 차트를 그리기 직전(student/emotion.js `CHART_JS_SRC`) | 차트 자리에만 '차트를 불러오지 못했어요' · 다음에 탭을 열면 다시 |
| firebase-firestore-compat 9.23.0 (영어앱 기록 읽기) | `<head>` 동기 태그 | `syncEnglishRewards` 가 처음 필요할 때(student.js `ENGLISH_FS_SDK`) | 예전처럼 조용히 건너뜀 |
| `student/deco.js` (꾸미기·친구 마당 · 학생 JS 의 절반) | `<script>` 태그 | 꾸미기·친구 마당을 열 때 `decoLoad()` · 집 허브 꾸미기 탭을 보면 미리 | 토스트 · 다시 누르면 다시 받음 · 0.3초 넘으면 '꾸미기를 펴는 중…' |

**꾸미기 진입점 (DECO-LAZY-1)** — deco.js 이름을 바깥에서 부르는 자리는 셋 중 하나:
- ① **자리 지킴이**(student.js `window.이름 = function`): `openInteriorFullscreen`(집 허브 단추 둘) · `visitFriend`(홈 친구 줄) · `_decoThumb`(상점 장식 탭 — 불러오기 전엔 이모지, 오면 상점을 다시 그림). 불러오면 deco.js 의 function 선언이 같은 전역을 진짜로 바꿔 끼운다. 꼭 `window.` 꼴(function 선언이면 run.mjs sliceFn 이 지킴이를 잘라 가고 global-dup 이 덮어쓰기로 본다).
- ② **typeof 가드**: `decoFlush`(스냅샷 직전) · `_artStart`(집 허브 미리 받기).
- ③ **불러온 뒤만**: 꾸미기·친구 전체화면 안 단추(#interior-fullscreen · #friend-fullscreen · 숨긴 #floor-tile-row) · 농장 `if (_ifMode) _drawDeco()` · `decoLoad().then(…)` 안.
- 불러오기 전에 바깥이 값을 넣는 `let DECO_SCENE` · `let _ifMode` 두 줄은 student.js 로 옮겼다(deco.js 가 나중에 같은 let 을 선언하면 값이 가려지거나 SyntaxError).
- deco.js 맨 끝 줄 `const _decoReadyMark = true;` 로 '끝까지 돌았나'를 본다(`decoReady()`).
- 지킴 장치: `scripts/unit/deco-lazy-check.mjs`(precheck · 위 셋이 아니면 FAIL) · `global-dup-check`(늦게 부르는 파일도 맨 뒤에 넣어 이름 겹침을 봄) · `buster-check`(student.js 안 `'./student/deco.js?v=…'` 를 html 줄처럼 판정) · `smoke`(늦게 부르는 파일은 html 태그가 없고 ?v= 주소가 있어야).
- 시험 읽기: `scripts/unit/student-sources.mjs` 의 `LAZY_STUDENT_FILES`(한 곳) — `studentScriptFiles` 는 태그 파일 + 늦게 부르는 파일(맨 뒤), `studentTagFiles` 는 태그만.

**새로 고칠 때**
- deco.js 를 고치면 student.js `DECO_SRC` 의 `?v=` 를 올린다 → student.js 가 바뀌었으니 student.html 의 student.js `?v=` 도.
- 바깥에서 deco 함수를 새로 부르려면: 불러오기 전에도 불릴 수 있는 자리면 지킴이나 `typeof` 가드, 꾸미기 판 안에서만 불리면 그대로(검사가 판 안을 안다).
- 하네스가 꾸미기 함수를 바로 쓰면 맨 앞에서 `await decoLoad()`(deco-save-count/test.js · deco-save-real-sdk/test.js 처럼).


---

## 17. admin 나누기 (R3 · 떼어 옮기기)

admin.js(6,589줄)를 §16 과 같은 방식으로 **글자 하나 안 바꾸고** 덩어리째 새 클래식 스크립트 9개로 옮겼다. 경계는 줄 번호가 아니라 **══ 머리 상자의 제목 글자**(그 위 ═ 한 줄 포함)이고, 모두 최상위 문장 사이다.

| 파일 | 줄 | KB | 담은 것 (원래 admin.js 줄) |
|------|---:|---:|------|
| `admin.js` | 627 | 38 | 바탕 — 이스케이프·로그인·INIT(`window.onload`·renderAll)·NAV(`nav()`·메뉴 그림)·정적 템플릿·좁은 화면 서랍·우리 마을(읽기)·대시보드·UTILS(closeModal·notify·저장 실패 알림) |
| `admin/students.js` | 529 | 29 | 학생 목록 · 학생 상세 창(쪽지 · 일괄 쪽지 · 능력치/승급/전체 초기화 · 저장 · 골드 주기) · 학생 추가 (596–1121) |
| `admin/approve.js` | 834 | 44 | 대시보드 인라인 처리 · 핵심 승인(approveReward·approveAll) · 승인 탭(프리셋·필터·격자·목록) · 선택 상자·배지 · 승급 관리 (1122–1952) |
| `admin/records.js` | 469 | 24 | 랭킹(공용 빌더) · 능력치 내역 · 활동 내역(일일퀘스트 주간/월간 기록) · renderRank (1953–2418) |
| `admin/works.js` | 599 | 31 | 작품 관리(승인·반려·라이트박스·작품 종류) · 독서 현황 (2419–3014) |
| `admin/memories.js` | 899 | 43 | 추억 관리(앨범·여러 장 올리기·이름 바꾸기) · 리코더 관리 · 업적 재계산 · 주간 다짐 · 중복 정리·작품 키 정리·작품 내리기/지우기 (3015–3910) |
| `admin/quests.js` | 931 | 45 | 비번 초기화 · 퀘스트(템플릿·능력치 퀘스트·자동 일일·게시판 퀘스트) · 가져오기(importData) · 개별 보상 지급 (3911–4838) |
| `admin/battle.js` | 582 | 30 | 몬스터·전투 설정(일괄 조정·장비·마스터리북·도감 보상) · getActiveMonsters(관리 화면 판 — gamedata.js 판을 덮는다) · 몬스터 편집 (4839–5417) |
| `admin/settings.js` | 916 | 48 | 상점 관리(+감정 보상 설정) · 과목 관리(+감정 대화 요청) · 감정 현황(차트) · 백업·되돌리기 · 설정(오늘의 링크·저장·초기화·내보내기) (5418–6330) |
| `admin/study.js` | 239 | 14 | 학습 범위(STUDY-SCOPE) · 오늘의 공부 보상 · 생각판(관리 화면 안) · 학습 앱 기록 (6354–6589) |

- admin.html: `admin.js` 바로 뒤에 students.js → approve.js → records.js → works.js → memories.js → quests.js → battle.js → settings.js → study.js 순서(원래 글 순서)로 9줄 · 각 `?v=`. 표시 줄 = `// ── [ADMIN-SPLIT-1] 여기 있던 '<이름>' 덩어리(N줄)는 admin/<파일> 로 옮겼다 ──`.
- **왜 동작이 같은가**: 불러오는 즉시 도는 문장은 admin.js 바탕에만 있다(`fillNavIcons()`·`fillStaticTemplates()`·keydown·DOMContentLoaded·#m-student 클릭 등록·`window.onDbSaveError`) — 모두 바탕 이름만 쓴다. 옮긴 파일의 즉시 문장은 글자·배열 상수와 DOMContentLoaded 등록 하나(추억 끌어 놓기)뿐이다. 옮긴 이름은 `window.onload`·처리기 안에서만 불린다(모든 스크립트가 끝난 뒤). gamedata.js 판을 덮는 `getActiveMonsters` 는 admin/ 파일로 옮겨도 gamedata.js 뒤라 덮는 결과가 같다(`global-dup-check` 기준선 파일 이름만 바뀜).
- **시험**: `scripts/unit/admin-sources.mjs`(`adminScriptFiles`·`readAdminSources`·`adminWhere`·`adminDirFiles`) — admin.html 의 `<script>` 순서가 단일 출처. 바꾼 것: run.mjs(`read('admin.js')` 는 오류) · gold/promo/deco-life/settings-field 시뮬 · save-order · whole-set('admin.js' 칸 = 관리 전체, 기준선 그대로) · student-known(BACKUP_NODES 를 못 찾으면 FAIL) · esc-parity · verify-safety · smoke-test(+admin/ 폴더 파일이 모두 admin.html 에 있나) · global-dup 기준선.
- 숫자: verify-safety 26 → **35**(`node --check` admin/*.js 9개) · smoke 30 → **31** · save-order **11곳 그대로**(줄 표시만 새 파일) · whole-set 14 · student-known 29 · esc 8 · global-dup 4 · 시뮬 출력 글자 같음.
- **새로 고칠 때**: 그 기능이 있는 `admin/` 파일을 고치고 그 줄의 `?v=` 만 올린다. 불러오는 즉시 도는 코드에서 뒤 파일 이름을 부르지 말 것(아직 없음).

---

## 부록: 관련 문서

- `README.md` — 프로젝트 개요·실행·배포·Firebase 노드
- `docs/rpg_refactor_safety_rules.md` — 현행 안전 규칙(저장/날짜/정규화/캐시/검증)
- `docs/rpg_refactor_codex_handoff.md` — 인수인계 이력/배경
- `scripts/verify-safety.mjs` — 정적 저장안전 검증
- `scripts/smoke-test.mjs` — 로컬 HTTP/정적 구조 smoke-test
