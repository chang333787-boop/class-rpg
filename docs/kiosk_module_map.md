# kiosk.js 기능 지도

> 이 문서는 Phase M-3(read-only 조사) 결과를 고정한 **kiosk 기능 지도**다.
> 다음 Phase에서 kiosk를 정리/모듈화할 때 기준으로 삼는다. 이 문서 자체는 어떤 코드도 바꾸지 않는다.
> 현대화 원칙은 `docs/module_architecture.md`, 안전 규칙은 `docs/rpg_refactor_safety_rules.md`를 따른다.
> 핵심 입장: **kiosk는 현대화 파일럿 후보지만, 전역 함수 호환과 write 경로를 그대로 유지한다.**

작성 기준: main `4206f0d` (M-2까지 머지). 조사 출처: kiosk.js / kiosk.html / kiosk.css 정적 read + grep.

---

## 1. 목적

- kiosk를 현대화 파일럿으로 다루기 **전에** 함수·상태·Firebase·렌더·이벤트 경계를 문서로 고정한다.
- 코드 변경 없이, "무엇을 먼저 손대도 안전한가 / 무엇을 보류해야 하는가"의 판단 근거를 남긴다.
- 다음 작업자가 이 지도만 보고 다음 Phase를 설계할 수 있게 한다.

---

## 2. 파일 구성과 로드 구조

| 파일 | 줄 수 | 역할 |
|------|------|------|
| `kiosk.html` | 75 | 골격 + 로딩/취소팝업/탭 버튼/3개 탭 wrap |
| `kiosk.css` | 140 | 키오스크 전용 스타일 |
| `kiosk.js` | 753 | 전체 로직(상태/렌더/Firebase/이벤트) |

로드 순서 (kiosk.html):

```
(CDN) firebase-app-compat 9.23.0
(CDN) firebase-database-compat 9.23.0
./kiosk.css?v=20260604
(CDN) Noto Sans KR 폰트
... body ...
./gamedata.js            ← 쿼리 없음(캐시버스터 미부착)
./kiosk.js?v=20260602
```

- **모두 클래식 `<script>`** — `type="module"`/`async`/`defer` 없음.
- HTML 인라인 `<script>`/`<style>` **0건**.
- 이유: HTML 인라인 onclick과 템플릿 문자열 onclick이 전역 함수를 직접 부른다. 모듈 스코프로 바꾸면 전부 깨진다(§7, module_architecture §7).

---

## 3. 전역 상태 지도

| 변수 | 줄 | 역할 | 비고 |
|------|----|------|------|
| `DB_DATA` | 4 | 정규화된 Firebase 전체 스냅샷(단일 소스) | 모든 렌더의 입력 |
| `fbRef` | 6 | `firebase.database().ref('classRPG_v3')` | kiosk **자체 구독** |
| `_cancelCb` | 7 | 취소 확인 콜백 보관 | |
| `KIOSK_TAB` | 287 | 현재 탭 `'quest'`/`'emotion'`/`'memory'` | 구독 렌더 분기 기준 |
| `_kioskMemView` | 310 | 추억 앨범 뷰(`'all'`/`'none'`/albumId) | |
| `_kioskMemLbIdx` | 311 | 추억 라이트박스 현재 인덱스 | |
| `_kioskMemList` | 312 | 추억 목록 캐시 | |
| `_kEmoStudentId` `_kEmoPeriod` `_kEmoKey` `_kEmoLevel` | 512-513 | 감정 입력 팝업 진행 상태 | |
| `_toastTimer` | 746 | 토스트 타이머 핸들 | |
| `window._kioskLbFiltered` | 389 | 라이트박스 필터 목록(window 부착) | 렌더↔라이트박스 연결 |
| ⚠️ `CUR_TAB` | 5 | (사용처 없음) | **죽은 변수 후보** — §9 |
| ⚠️ `_kioskEmoStep` | 446 | (사용처 없음) | **죽은 변수 후보** — §9 |

상태 ↔ DOM 연결: `DB_DATA`가 단일 소스이고, 각 렌더 함수가 `DB_DATA`를 읽어 해당 컨테이너의 `innerHTML`을 다시 만든다(부분 갱신이 아니라 영역 단위 재렌더). 입력 진행 상태(`_kEmo*`, `_kioskMem*`)는 팝업/라이트박스가 닫힐 때까지의 임시 상태.

---

## 4. 함수 지도 (top-level 20개)

표기: **write** = Firebase 쓰기 있음 / **전역필수** = 인라인 onclick이 직접 호출(전역 노출 유지 필수).

### init
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `window.onload` | 10 | firebase init → `once` 1회 로드 → `on('value')` 디바운스 400ms 구독 → 로딩 숨김·날짜·학급명 → renderTable | read | — |

### normalize
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `normalizeData` | 51 | `DB._migrate(DB._normalizeArrays(data))` 위임(공유 정규화) | — | — |

### quest render
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `renderTable` | 60-284 | 퀘스트 표 렌더(~224줄). 내부 헬퍼 getStatus/statBadge/addQuestRows + 상수 STAT_BADGE/sections. 일일/주간은 스탯별 서브섹션 | — | — |

### tab
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `switchKioskTab` | 288 | 탭 버튼 스타일/표시 토글 + 해당 렌더 호출 | — | ✅ (HTML) |

### memory (추억)
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `renderKioskMemory` | 314 | 승인+공개 추억 그리드 렌더, 라이트박스 DOM 1회 생성 | — | — |
| `setKioskMemView` | 418 | 앨범 뷰 변경 후 재렌더 | — | ✅ |
| `openKioskMemLightbox` | 423 | 라이트박스 열기 | — | ✅ |
| `navKioskLb` | 439 | 라이트박스 이전/다음 | — | ✅ |

### emotion (감정)
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `renderEmotionBoard` | 448 | 오늘 오전/오후 감정 현황 표 | — | — |
| `openKioskEmotion` | 515 | 감정 입력 팝업 생성/표시 | — | ✅ |
| `kSelectEmotion` | 582 | 감정 선택 표시 | — | ✅ |
| `kSelectLevel` | 600 | 강도 선택 표시 | — | ✅ |
| `kSubmitEmotion` | 613 | 감정 레코드 저장 | **write** | ✅ |

### quest actions
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `requestQuest` | 631 | 연타 방지 → Utils.questStatus 중복 검사 → pendingRewards push → 부분 저장 | **write** | ✅ |
| `requestCancel` | 669 | 취소 확인 팝업 표시 + 콜백 설정 | — | ✅ |
| `closeCancelPopup` | 680 | 취소 팝업 닫기 | — | ✅ (HTML) |
| `cancelQuest` | 685 | pendingRewards 제거 → 부분 저장 | **write** | — (콜백으로 호출) |

### helpers
| 함수 | 줄 | 역할 | write | 전역필수 |
|------|----|------|-------|---------|
| `getDeadlineInfo` | 701 | 마감일/임박도 계산(순수 함수) | — | — |
| ⚠️ `getDeadline` | 741 | 레거시 래퍼(getDeadlineInfo 호출) | — | — (**호출처 없음**, §9) |
| `showToast` | 747 | 하단 토스트 표시(2초) | — | — |

---

## 5. Firebase read/write 지도

| 함수 | 줄 | 작업 | 경로 |
|------|----|------|------|
| `window.onload` | 15 | **read** | `fbRef.once('value')` (초기 1회) |
| `window.onload` | 21 | **read(구독)** | `fbRef.on('value', ...)` (디바운스 400ms 재렌더) |
| `kSubmitEmotion` | 625 | **write** | `fbRef.child('emotionLogs/'+key).set(record)` |
| `requestQuest` | 663 | **write** | `fbRef.child('students/'+s.id+'/pendingRewards').set(...)` |
| `cancelQuest` | 693 | **write** | `fbRef.child('students/'+s.id+'/pendingRewards').set(...)` |

규칙(반드시 유지):

- **root write 0건.** `.update`/`.remove` 0건. write는 전부 **자식 경로 한정**.
- **pendingRewards 부분 저장 2건**(requestQuest/cancelQuest) — 학생 객체 전체 set 금지(다른 필드 클로버 방지). verify-safety 기대치(부분 2·전체 0)와 일치.
- emotionLogs는 `emotionLogs/{studentId_date_period}` 단일 키 set.
- write 경로/원자성은 **모듈화와 함께 절대 바꾸지 않는다**(안전 규칙 §5).

---

## 6. 렌더/DOM 구조

탭별 컨테이너(kiosk.html):

| 영역 | wrap(표시 토글) | content(innerHTML 주입) | 담당 함수 |
|------|------|------|------|
| 퀘스트 | `#table-wrap` | `#kiosk-content` | renderTable |
| 감정 | `#kiosk-emotion-wrap` | `#kiosk-emotion-content` | renderEmotionBoard |
| 추억 | `#kiosk-memory-wrap` | `#kiosk-memory-content` | renderKioskMemory |

동적 생성(처음 1회 `document.body.appendChild` 후 재사용):

| 요소 | 생성 위치 | 용도 |
|------|------|------|
| `#kiosk-lb` | renderKioskMemory(391) | 추억 라이트박스 |
| `#kiosk-emo-popup` | openKioskEmotion(524) | 감정 입력 팝업 |

정적 요소(kiosk.html): `#loading`, `#cancel-popup`(+`#cancel-popup-sub`/`#cancel-confirm-btn`), `#main-wrap`, `#header`, `#class-name`, `#today-date`, `#kiosk-tab-quest/emotion/memory`, `#toast`.

특징:

- 렌더는 **영역 단위 `innerHTML` 전체 재구성**(부분 DOM 갱신 아님). 큰 템플릿 문자열에 인라인 style·onclick을 포함.
- `switchKioskTab`은 wrap 표시만 토글하고 필요한 렌더를 호출. 구독(`on`)은 현재 `KIOSK_TAB`에 맞는 렌더만 호출.

---

## 7. 이벤트/전역 함수 구조

**HTML 직접 onclick (kiosk.html, 4개)**: `closeCancelPopup()`, `switchKioskTab('quest'/'emotion'/'memory')`.

**템플릿 문자열 onclick (kiosk.js 내)**: requestQuest, requestCancel, setKioskMemView, openKioskMemLightbox, navKioskLb, openKioskEmotion, kSelectEmotion, kSelectLevel, kSubmitEmotion. (+ 추억 카드 `onmouseenter/leave` hover 2건, 인라인 `document.getElementById(...).style...` 닫기 핸들러)

**전역 노출 유지 필수 (총 11개)** — 분리하더라도 `window.*`로 남아야 함:
`switchKioskTab`, `closeCancelPopup`, `requestQuest`, `requestCancel`, `setKioskMemView`, `openKioskMemLightbox`, `navKioskLb`, `openKioskEmotion`, `kSelectEmotion`, `kSelectLevel`, `kSubmitEmotion`.

**내부 전용(인라인 미참조)**: `window.onload`, `normalizeData`, `renderTable`, `renderKioskMemory`, `renderEmotionBoard`, `getDeadlineInfo`, `showToast`, `cancelQuest`(requestCancel의 클로저로 호출).

**이벤트 위임 전환은 보류(D)**: 최종 목표는 `data-action` 기반 위임이나, 지금 일괄 전환하면 회귀 추적 불가. kiosk에서 작게 실험하는 것조차 별도 Phase로 다룬다.

---

## 8. shared/gamedata 의존성

| 심볼 | 사용 함수 | 비고 |
|------|------|------|
| `FIREBASE_CONFIG` | window.onload | gamedata.js 선언 |
| `DB._normalizeArrays` / `DB._migrate` | normalizeData | 순수 함수로 빌려 씀(DB.init 미사용) |
| `Utils.questStatus` | requestQuest | 일요일 주 시작 기준 중복 판정 |
| `Utils.todayStr` | requestQuest | pendingRewards.date |
| `EMOTION_DATA` | openKioskEmotion / kSelectEmotion / kSubmitEmotion | 감정 목록 |
| `EMOTION_GROUP_VALUE` | kSubmitEmotion | score 계산 |

kiosk 자체 유지 helper: `getDeadlineInfo`/`getDeadline`(마감 계산), `showToast`(UI), `renderTable` 내부 getStatus/statBadge/addQuestRows.

⚠️ 주의: `DB._normalizeArrays`/`DB._migrate`는 **순수 함수로 유지**해야 한다. DB 내부 상태(`this._cache`/`this._fbRef`) 의존을 추가하면 kiosk 호출이 깨진다(안전 규칙 §7).

---

## 9. 발견된 정리 후보 (이번 문서는 기록만, 정리하지 않음)

### 죽은 코드 후보 (grep 확인: 자기 선언 외 참조 0)
- `CUR_TAB` (line 5) — `'daily'`로 초기화되나 읽는 곳 없음. 실제 탭 상태는 `KIOSK_TAB`.
- `_kioskEmoStep` (line 446) — 선언만 있고 사용처 없음. 감정 팝업은 `_kEmo*`를 씀.
- `getDeadline` (line 741) — 레거시 래퍼. renderTable은 `getDeadlineInfo`를 직접 호출 → 호출처 없음.

### getStatus / Utils 날짜 기준 불일치 후보
- `requestQuest`(631)는 중복 판정에 **`Utils.questStatus`**(일요일 주 시작) + `Utils.todayStr`를 쓴다.
- 그러나 `renderTable` 내부 `getStatus`(78)는 **자체 today/weekStart 계산**(line 66-73, UTC+9 기반 일요일 시작)을 쓴다.
- 동작은 동등해 보이나 **단일 소스가 아니다**. 통일하면 의미가 바뀔 가능성이 있으므로, **동등성 read-only 검증 후에만** 진행한다(이번 Phase는 통일하지 않음).

---

## 10. 모듈화 등급

| 등급 | 대상 | 이유 |
|------|------|------|
| **A** (먼저 가능) | `getDeadlineInfo`, `showToast`, 죽은 코드 3건 제거(CUR_TAB/_kioskEmoStep/getDeadline) | 순수·저위험, 부작용 명확/없음 |
| **B** (조사 후) | 감정 모듈(renderEmotionBoard+openKioskEmotion+kSelect*+kSubmitEmotion), 추억 모듈(renderKioskMemory+setKioskMemView+lightbox), 퀘스트 액션(requestQuest/requestCancel/cancelQuest) | 전역 노출·write 경로 보존 필요. getStatus↔Utils 동등성 검증 동반 |
| **C** (현재 유지) | `renderTable`(224줄 템플릿+로직 결합), `window.onload`(init/구독), `normalizeData` | 분해 이득<회귀 위험 |
| **D** (보류) | `fbRef` 자체 구독 구조 통일, 인라인 onclick→이벤트 위임 일괄 전환, `renderTable` 대분해 | 고위험(안전 규칙 §7/§10) |

---

## 11. 분리 우선순위 (권장 순서)

1. **죽은 코드 3건 제거 가능성 최종 확인** (CUR_TAB/_kioskEmoStep/getDeadline) — 가장 안전한 첫 정리.
2. **getStatus ↔ Utils.questStatus/Utils.todayStr 날짜 기준 동등성 read-only 검증** — 통일 가능 여부 판정.
3. **순수·저위험 helper 분리 검토** (`showToast`, `getDeadlineInfo`) — 전역 호환 유지 전제.
4. **감정/추억/퀘스트 액션 중 하나를 작은 파일럿으로 검토** (write 경로·전역 노출 보존).
5. **`renderTable` 대분해는 보류.**

각 단계는 별도 Phase로, 검증 통과·작은 PR·자동 merge 금지·보고 후 정지 원칙을 따른다.

---

## 12. 보류해야 할 작업

- kiosk 자체 `fbRef` 구독 구조를 student/admin과 통일(고위험, 안전 규칙 §7).
- 인라인 onclick → `addEventListener`/`data-action` 일괄 전환.
- `renderTable` 대분해.
- pendingRewards write 경로/원자성 변경.
- `_normalizeArrays`/`_migrate`에 DB 내부 상태 의존 추가.

---

## 13. 다음 Phase 제안

- **M-5A**: kiosk 죽은 코드 3건 + getStatus/Utils 날짜 동등성 read-only 정밀 조사(코드 무변경).
- **M-5B**: kiosk 내부 구역 주석 정리(동작 동일, 별도 승인 후).
- **M-5C**: `showToast`/`getDeadlineInfo` 분리 가능성 조사.
- 실제 코드 변경은 위 조사 결과 + 별도 승인 후에만 시작.

---

## 부록: 관련 문서

- `docs/module_architecture.md` — 현대화/모듈화 기본 원칙
- `docs/rpg_refactor_safety_rules.md` — 저장/날짜/정규화/캐시/검증 규칙
- `README.md` — 프로젝트 개요
- `scripts/verify-safety.mjs` / `scripts/smoke-test.mjs` — 검증 2종
