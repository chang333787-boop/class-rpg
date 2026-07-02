# 에셋 구현 명세서 — 이모지 → 이미지 에셋 전환 (Codex 작업 지시용)

> 작성: 2026-07-02 (Claude Code, 전체 코드 리뷰 기반)
> 대상 작업자: Codex (또는 외부 AI 도구)
> **먼저 읽을 것**: `README.md`, `docs/rpg_refactor_safety_rules.md` — 이 문서의 규칙이 항상 우선한다.

---

## 0. 배경 (30초 요약)

- 이 앱은 **정적 HTML + 바닐라 JS + Firebase RTDB** (빌드도구 없음, GitHub Pages 배포, 운영 funclassrpg.kr).
- 현재 게임 내 모든 아이콘(몬스터·씨앗·장비·스킬북·장식)은 **이모지 1~2글자**다.
  `gamedata.js`의 `GAME_DATA` 각 항목에 `icon` 필드(이모지)로 저장되어 있다.
- 목표: 이모지를 **이미지 에셋으로 교체**하되, **이미지가 없으면 이모지로 폴백**하는 구조.
  (교사가 관리 화면에서 만드는 커스텀 몬스터는 이미지가 없으므로 폴백은 필수다.)

---

## 1. 구현할 에셋 전체 목록

| # | 카테고리 | 수량 | 데이터 위치 (gamedata.js) | 에셋 폴더 제안 | 우선순위 |
|---|---------|------|--------------------------|---------------|---------|
| A | **몬스터** | **100** (m1~m100) | 299~433행 `monsters` | `assets/monsters/<id>.png` | ★1순위 |
| B | **씨앗** | 10 (일반5+돌연변이5) | 169~188행 `seeds`/`mutantSeeds` | `assets/seeds/<id>.png` | ★2순위 |
| C | **작물**(수확물) | 10 (씨앗과 1:1, `crop` 키) | 같은 항목의 `cropIcon` | `assets/crops/<crop>.png` | ★2순위 |
| D | 장비 | 80 (모자10·옷30·무기20·장갑10·신발10) | 69~166행 `equipment` | `assets/equipment/<id>.png` | 3순위 |
| E | 스킬북 | 28 (4계열×7권) — 계열당 표지 1장(4장)+레벨 표기로 대체 가능 | 477~510행 `SKILL_BOOKS` | `assets/skillbooks/<id>.png` | 4순위 |
| F | 장식물 | 52 — **상점/인벤 카드 아이콘만** (아래 §4-E 주의 필독) | 191~291행 `decorations` | `assets/deco/<id>.png` | 5순위(부분) |
| G | 감정 아이콘 | 8 | `EMOTION_DATA` | — | 전환 비권장 (이모지가 적합) |

- 1차 목표(A+B+C = 120장)만 해도 체감 변화의 90%를 차지한다. D~F는 별도 PR로.
- 몬스터 디자인 참고: 각 항목의 `name`(한글 이름), `element`(fire/water/grass), `zone`(beginner/intermediate/advanced), `rarity`, `level`을 반영할 것. 예: `m1 슬라임 grass common Lv1` → 풀속성 초록 슬라임.

## 2. 이미지 규격 (권장)

- **PNG, 투명 배경, 512×512** (표시 크기는 CSS가 축소 — 도감 칩 ~24px부터 전투 화면 ~96px까지 다양)
- 파일당 100KB 이하 (GitHub Pages 전송량·초등 교실 태블릿 고려). 최적화(pngquant 등) 권장.
- **스타일 통일**: 한 가지 스타일로 전부 (플랫 벡터풍 or 픽셀아트풍). 외곽선·명암 규칙 통일.
- 파일명 = **GAME_DATA의 id 그대로** (`m1.png`, `i_potato_seed.png`, `e_h1.png`). 매핑 테이블이 필요 없어진다.

## 3. 코드 플러밍 (이미지+폴백 구조) — 구현 명세

### 3-1. 핵심 헬퍼 (gamedata.js 또는 각 화면 JS에)

규약 기반 경로 + `onerror` 이모지 폴백을 권장한다 (GAME_DATA 100개 항목에 필드 추가할 필요 없음):

```js
// 예시 시그니처 — entity는 GAME_DATA 항목, kind는 'monsters'|'seeds'|'crops'|...
function iconImg(entity, kind, sizeCss) {
  // 반환: 이미지가 있으면 <img src="assets/<kind>/<id>.png" ...>,
  //        로드 실패(404) 시 이모지 <span>으로 자동 교체 (onerror)
  //        entity.id가 없거나 커스텀(교사 생성)이면 처음부터 이모지 span
}
```

- **폴백 필수 사유**: 교사 커스텀 몬스터(`customMonsters`, admin에서 생성)는 이모지만 있다. 보스(`settings.boss`)도 마찬가지.
- 404 반복 요청이 싫으면 로드 성공/실패를 메모리 Set에 캐시해도 좋다(선택).
- **XSS 주의**: id/이모지를 HTML에 넣을 때 이스케이프. 각 파일에 이미 `escHtml()` 헬퍼가 있다(2026-07-02 추가). 재사용할 것.

### 3-2. 교체할 렌더 지점 (이모지 → 헬퍼 호출)

**몬스터 (student.js)** — `${m.icon}` / `${mon.icon}` 패턴:
- 1757 (몬스터 오퍼 카드), 1892 (몬스터 카드), 2109·2361 (전투 화면 본체 `.ba-emoji`), 2340 (전투 로그 — 텍스트라 이모지 유지 가능), 3248·3358·3391 (사냥터 3단계), 3470·3479 (도감 — 3479는 grayscale 필터 유지), 3832 (도감 칩 — 작아서 이모지 유지 가능)
- admin.js 몬스터 탭(renderMonsters, ~4442행 부근)도 동일 패턴 확인 후 교체.

**씨앗/작물 (student.js)**:
- 1506·1522 (상점 씨앗 카드), 8033 (인벤토리), 3702 (농장 모달 칸), 3583 (메인 화면 미니 농장)
- ⚠️ **3618·3619·3635·3636 (toast 메시지)과 2340 같은 텍스트 문맥은 이모지 유지** — 이미지 넣지 말 것.
- ⚠️ **6548 (`_drawYardFarm` — canvas fillText)은 건드리지 말 것** — canvas 이미지 로드는 비동기라 별도 Phase. 이모지 유지.

**장비/스킬북 (student.js, 3순위 PR에서)**:
- 상점 카드(renderShop, 1296~1559 구역), 인벤토리(renderInv, 7799~ 구역), 확인 confirm 텍스트(1628, 8065)는 이모지 유지.

### 3-3. 반드시 지킬 것

- HTML/JS 수정 시 해당 HTML의 캐시버스터 `?v=` 갱신 (`docs/rpg_refactor_safety_rules.md` §8)
- 매 작업 전후: `node scripts/verify-safety.mjs` (기대: PASS 18·REVIEW 1·FAIL 0), `node scripts/smoke-test.mjs` (기대: PASS 27·REVIEW 0·FAIL 0), 변경 JS마다 `node --check`
- **Firebase write 금지** (로컬에서 열어도 운영 DB에 붙는다 — 버튼 클릭 검증 금지)
- PR은 작게 분할, **자동 머지 금지, 사용자 승인 후 머지**

## 4. 하지 말 것 (고위험 — 이 작업 범위에서 제외)

- **A. `buildCharSVG` (student.js 301~556)** — 캐릭터+장비 착용 모습은 SVG 코드가 그린다. 장비 이미지(D)는 **상점/인벤 카드 아이콘만** 교체하고, 캐릭터 착용 렌더는 절대 건드리지 말 것.
- **B. canvas 렌더 전부** — `_drawYard`/`_drawIndoor`/`_drawYardFarm`/`_drawTileTexture` 및 **장식물 40여 개 그리기 함수**(마당·집에 배치된 모습). 장식물 이미지(F)는 상점/인벤 카드만. 배치 모습 교체는 별도 승인+조사 Phase.
- **C. GAME_DATA의 id·stats·price·expTable 변경 금지** — `icon` 필드도 지우지 말 것(폴백에 필요).
- **D. 전투/몬스터 로직**(renderMonsterStep/renderBattleNew/doFight) — 아이콘 표시부만 교체, 로직 무변경.
- **E. `_normalizeArrays`/`_migrate`, pendingRewards 구조, Firebase 경로, `type="module"` 전환** 등 안전규칙 §10 전체.

## 5. 권장 작업 분할 (PR 단위)

1. **PR-1 플러밍**: `iconImg()` 헬퍼 + 몬스터 렌더 지점 교체 (이미지 0장이어도 폴백으로 동작 동일 — 여기서 회귀 없음을 검증)
2. **PR-2 몬스터 에셋**: `assets/monsters/` 100장 추가 (코드 무변경, 이미지만)
3. **PR-3 씨앗/작물**: 렌더 지점 교체 + 20장
4. **PR-4~**: 장비/스킬북/장식 카드 (선택)

각 PR 후 로컬 `python3 -m http.server 8800`으로 **로드만** 확인(버튼 클릭 금지), 검증 스크립트 통과 확인.
