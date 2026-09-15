# INIT-SINGLE-LOAD-1 바이트 하네스 (손으로 돌림 · 운영 접속 0)

`DB.init` 이 켤 때 root 를 몇 번 받는지 **실제 firebase SDK 9.23.0 + 로컬 RTDB 에뮬레이터**로 잰다.

1. 에뮬레이터: `java -jar firebase-database-emulator-v4.11.2.jar --host 127.0.0.1 --port 9000` (JDK 17)
2. 가짜 데이터 넣기(개인정보 없음, 약 1MB): `classRPG_v3` 아래 settings + 큰 노드 몇 개를 `PUT http://127.0.0.1:9000/classRPG_v3.json?ns=demo-boot` (`Authorization: Bearer owner`)
3. 비교할 `gamedata.js` 를 `main/`·`s1/` 폴더에 두고 이 폴더를 아무 정적 서버로 연다
4. `db.html?v=main` · `db.html?v=s1` → 화면의 `bytesTotal`

페이지는 gamedata.js 보다 먼저 기본 앱을 에뮬레이터 주소로 만들기 때문에 운영 설정(FIREBASE_CONFIG)은 쓰이지 않는다.

2026-09-15 결과(가짜 root 1,063,230B)
| | bytesAfterInit | bytesTotal | 부팅 중 onDataChange | 실시간 반영 |
|---|---|---|---|---|
| main (once → on) | 1,063,465 | **2,126,980** | 1 | ✅ |
| INIT-SINGLE-LOAD-1 | 1,063,465 | **1,063,588** | 1 | ✅ |
