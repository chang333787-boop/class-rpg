# docs 색인

> 2026-10-04 정리(DOCS-INDEX-1). **파일은 옮기지 않았다** — 어디에 무엇이 있는지 목록만.
> '지금 쓰는 문서' = 작업 전에 읽거나 값을 맞춰 보는 정본. '지난 기록' = 그때의 조사·제안·결정 기록(값이 지금과 다를 수 있음).
> 새 문서를 만들면 여기에 한 줄 더한다. 프로젝트 개요 · 검사 명령은 저장소 루트 `README.md`.

---

## 지금 쓰는 문서

### 규칙 · 운영
- [rpg_refactor_safety_rules.md](rpg_refactor_safety_rules.md) — **현행 안전 규칙**(저장 · 날짜 · 캐시버스터 · 검증 절차 · 고위험 영역)
- [rpg_refactor_codex_handoff.md](rpg_refactor_codex_handoff.md) — 지시문 · 보고 형식 · 자동 머지 기준(일부 옛 기준 포함, CLAUDE.md §5 가 가리킴)
- [rpg_teacher_operation_guide.md](rpg_teacher_operation_guide.md) — 교사용 운영 가이드
- [rpg_operation_runbook.md](rpg_operation_runbook.md) — 교사용 운영 · 장애 대응 런북
- [rpg_patchnotes.md](rpg_patchnotes.md) — 패치노트(아이용 말 · 선생님용 말)
- [worklog/](worklog/) — 날짜별 작업 기록 · 기기 간 핸드오프. 색인 = [worklog/README.md](worklog/README.md)

### 구조 · 코드 지도
- [module_architecture.md](module_architecture.md) — 점진적 모듈화 기준(전면 재작성 안 함 · 전역 호환 유지)
- [kiosk_module_map.md](kiosk_module_map.md) — kiosk.js 기능 지도
- [shared_asset_style_guide.md](shared_asset_style_guide.md) — 공유 에셋 스타일(class-rpg ↔ 별빛 아레나)
- [asset_implementation_spec.md](asset_implementation_spec.md) — 이모지 → 이미지 에셋 전환 명세

### 학습 앱 설계 정본 (폴더마다 하나)
- [art_detective_design.md](art_detective_design.md) — 명화 탐정 `art/` · [art34_analysis.md](art34_analysis.md) — 3~4학년 미술 교육과정 · 교과서 분석
- [coding_room_design.md](coding_room_design.md) — 기초 코딩 `coding/`
- [ink_lab_design.md](ink_lab_design.md) — 먹 연구소 `ink/`
- [music_room_design.md](music_room_design.md) — 음악실 `music/`
- [paint_lab_design.md](paint_lab_design.md) — 물감 연구소 `paint/`
- [pattern_workshop_design.md](pattern_workshop_design.md) — 무늬 공방 `pattern/`
- [print_lab_design.md](print_lab_design.md) — 판화 놀이 `print/`
- [thinkboard_story_design.md](thinkboard_story_design.md) — 생각판 이야기 줄 · 나무 `thinkboard/`
- [learning_platform_research_20260731.md](learning_platform_research_20260731.md) — 학습 플랫폼 설계 연구(바탕 자료)

### 수업 · 과제
- [class_assign_design.md](class_assign_design.md) — 과제 · 수업(선생님이 문제 묶음 · 기초 코딩 · 리듬을 과제함 또는 '지금 모두 같이'로 보내고 반 결과 · TV 로 본다) 설계 정본 · 2026-10-04 설계만 · 갈래 `feat/class-assign`

### 밸런스 · 경제
- [rpg_balance_model.md](rpg_balance_model.md) — 밸런스 모델 정본(B-1). 빠른 검사 = `scripts/balance/`(precheck 에 들어 있음)

### 꾸미기(마당 · 집 안)
- [deco_commercial_plan.md](deco_commercial_plan.md) — 상용 수준까지의 계획(2026-09-23~)
- [deco_svg_spec.md](deco_svg_spec.md) — 장식 SVG 규격
- [deco_place_table.md](deco_place_table.md) · [placement_classes_design_20260919.md](placement_classes_design_20260919.md) — 놓는 방식 전수표 · 설계
- [deco_guests_design.md](deco_guests_design.md) — 손님 · 친해지기 · 선물 저장 설계
- [clumsy_list.md](clumsy_list.md) — 어설픔 목록(단일 출처 · 창조자의 눈 회차 반영)

### 우리 마을 `village/` (맥북 마을 기획자 세션 구역)
- [village_engine_spec.md](village_engine_spec.md) — 엔진 정본 · [village_progression_plan.md](village_progression_plan.md) — 목표 · 해금 정본
- [village_curriculum_map.md](village_curriculum_map.md) — 마을 ↔ 교과 지도 정본
- [village_progress.md](village_progress.md) — 완성까지 숫자 · [village_backlog.md](village_backlog.md) — 쌓아 둔 목록
- [village_perf_budget.md](village_perf_budget.md) — 성능 예산 · [village_terms.md](village_terms.md) — 마을 낱말
- [village_stage_card.md](village_stage_card.md) — 판 설계 카드 양식(판 카드 = `village_stage_*.md`)
- [village-restore.md](village-restore.md) — 백업 · 되살리기 절차 · [village-first-check.md](village-first-check.md) — 온라인 저장 첫 확인 절차

---

## 지난 기록

### 계획 · 감사 (2026 여름 ~ 9월 초)
- [rpg_overhaul_plan_2026_summer.md](rpg_overhaul_plan_2026_summer.md) · [rpg_feature_overhaul_plan_2026_summer.md](rpg_feature_overhaul_plan_2026_summer.md) — 여름방학 갈아엎기 계획서
- [rpg_quest_audit_20260713.md](rpg_quest_audit_20260713.md) · [rpg_reward_audit_20260713.md](rpg_reward_audit_20260713.md) — 퀘스트 · 보상 감사
- [rpg_gold_audit_20260910.md](rpg_gold_audit_20260910.md) — 골드 경제 감사 · [rpg_balance_audit_20260907.md](rpg_balance_audit_20260907.md) — 전투 밸런스 감사

### 밸런스 설계안 (2026-09-15 묶음)
- `rpg_balance_*_20260915.md` 열한 장 — 재점검 · B-4 계수 · 카드 위험 표시 · 장식 가격 · 속성 격차 · 장비 공백 · 골드 곡선 · 인플레 처방 · S1+E4 경제/절차서 · 사냥터 경계

### 꾸미기 (2026-09-20 ~ 09-25)
- 날짜 붙은 `deco_*_202609xx.md` · `indoor_*_202609xx.md` — 방향 제안 · 화면 규칙 · 바닥 · 계절 · 밤 · 손님 그림 등 그때그때의 설계 한 장
- [deco_handoff_20260920.md](deco_handoff_20260920.md) — 09-20 맥북 마감 인계
- `deco_*_202609xx/` 폴더들 · [img/](img/) — 위 문서들이 가리키는 실화면 사진

### 우리 마을 (2026-09-19 ~ 09-26)
- [vision_home_village_20260919.md](vision_home_village_20260919.md) — 집 → 마을 → 고장 비전
- `village-design-20260920.md` · `village-proposal-20260920.md` · `village_*_20260920.md` — 생김새 · 엔진 차이 · 붐빔 · 인구 · 틱 · 성능 조사
- `village_*_proposal.md` · `village_proto_*.md` · `village_*_design.md` — 버스 · 쓰레기 · 칭호 · 터치 놓기 · 고장/정치 프로토타입 · 세대 · 가게 · 자리 저장 등 제안 · 설계 · 보고
- [village_rules_monday.md](village_rules_monday.md) — 09-22 회의용 규칙 변경 표 · [village_session_roles_20260920.md](village_session_roles_20260920.md) — 그때의 세션 역할
- [village-shots/](village-shots/) — 마을 화면 사진

### 창조자의 눈
- [creator_notes/](creator_notes/) — 회차별 되밟기 기록(2026-09-20~). 모은 목록은 위 [clumsy_list.md](clumsy_list.md)
