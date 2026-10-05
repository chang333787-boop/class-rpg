# 가짜 RTDB 서버 — 시연·여러 기기 시험용 [FAKE-RTDB-1]

운영 Firebase 에 **닿지 않고** 학생·관리·키오스크·학습 앱 화면을 함께 띄워, 한 화면에서 한 일이 다른 화면에 실시간으로 보이게 한다.
데이터는 서버 메모리에만 있다(끄면 사라짐). 바깥 패키지 없음 — node 만 있으면 된다.

## 실행

```
node scripts/unit/fake-rtdb/server.mjs 8870
```

→ 브라우저로 **http://127.0.0.1:8870/.fake/** (학생·관리·키오스크·학습 앱 바로 가기 목록)

| 주소 | 무엇 |
|---|---|
| `/student.html?as=s1` | 학생 `s1` 로 바로 입장(이름도 됨: `?as=하늘`) · 그냥 `/student.html` 은 로그인 화면(비밀번호 `x`) |
| `/admin.html?auto` | 관리 화면 바로 입장 · 그냥 `/admin.html` 은 로그인 화면(비밀번호 `x`) |
| `/kiosk.html` | 키오스크 |
| `/art/` `/paint/` `/ink/` … | 학습 앱(선생님 비밀번호 `x`) |
| `/.fake/db?path=classRPG_v3/students` | 지금 DB 값 보기(JSON) |
| `/.fake/stats` | 연결·메시지 수 |
| `curl -X POST http://127.0.0.1:8870/.fake/reset` | 처음 데이터로 되돌리기(열린 화면에도 바로 반영) |

같은 브라우저에서 학생 둘을 띄우려면 **다른 창 문맥**(시크릿 창·다른 프로필)을 쓴다 — 한 문맥 안의 탭은 localStorage 를 나눠 쓴다.

선택:
- `--seed <파일.json>` 시작 데이터 바꾸기(기본 `seed.json`: 학생 5명 하늘·바다·구름·별님·나무 · 비밀번호 모두 `x` · 하늘은 승인 기다리는 보상 50G 하나 · 퀘스트 4개)
- `--lan` 같은 와이파이의 다른 기기(크롬북·폰)도 접속(0.0.0.0 으로 열고 접속 주소를 찍어 준다). **끝나면 꼭 끈다.**
- `--repo <폴더>` 다른 체크아웃의 화면을 서빙

## 어떻게 운영 DB 를 피하나

- 서버가 html 을 내줄 때 `shim.js` 를 끼운다(저장소의 html 파일은 그대로).
  - `<head>` 맨 앞: 운영 RTDB 주소(`*.firebaseio.com`·`*.firebasedatabase.app`)로 가는 WebSocket·fetch·XHR·EventSource 를 이 서버로 돌린다.
    Firestore·Storage·인증 주소는 막는다. firestore·storage SDK 태그는 뺀다.
  - database SDK 태그 바로 뒤: 가짜 프로젝트로 `initializeApp`(databaseURL = `http://<이 서버>/?ns=fake-rpg`). `gamedata.js`·`kiosk.js`·
    `common/rpg-firebase.js` 는 앱이 이미 있으면 그대로 쓰므로 모두 이 서버에 붙는다. 긴 폴링은 끈다(WebSocket 만).
- 서버 자신은 바깥으로 요청을 보내지 않는다(받기만). 화면 왼쪽 아래에 `🧪 시연용 — 진짜 기록 아님` 표가 뜬다.

## 시험

```
node scripts/unit/fake-rtdb/fake-rtdb.test.mjs          # 브라우저 없이 프로토콜만(precheck 가 저절로 돌림)
PP=8854 DP=9554 node scripts/unit/fake-rtdb/live-check.mjs   # 헤드리스 크롬 + 실제 화면 + 실제 SDK 9.23 (포트는 lsof 로 비었는지 먼저)
```

`live-check` 는 교사·학생 둘·키오스크·물감 앱·교사2 를 서로 다른 브라우저 문맥으로 띄워 확인한다:
교사 승인 → 학생 골드(1초 안) · 학생 퀘스트 신청 → 교사 대기 배지 · 꾸미기 저장 · 동시 저장 유실 0 · 두 교사 동시 승인 → 한 번만 지급 ·
네트워크 기록에 운영 주소 0.

## 흉내 내는 것 / 못 내는 것

흉내 냄: listen(태그 쿼리 orderByKey/Child/Value · startAt/endAt/equalTo · limitToFirst/Last) · unlisten · get · set/update ·
transaction(해시 조건 → datastale 다시 하기) · `ServerValue.increment`·`TIMESTAMP` · onDisconnect · 16KB 넘는 조각 메시지 ·
REST 읽기(`shallow`)·쓰기(PUT/PATCH/DELETE/POST · ETag if-match) · REST 스트리밍(EventSource).

못 냄(시연에서 쓰면 다르게 동작):
- **보안 규칙 없음** — 누구나 어디든 읽고 쓴다. 규칙 때문에 막히는 일은 재현되지 않는다.
- 인증(Auth)·App Check·Firestore(영어앱 보상 읽기)·Storage(사진·그림 올리기) 없음 — 사진 올리기는 실패 안내가 뜬다.
- 우선순위(`.priority`)·`orderByPriority` 정렬은 키 순서로만. 쿼리 결과는 차이(child_added 등) 대신 **통째로** 다시 보낸다(값은 같고 트래픽만 많다).
- 연결이 끊긴 뒤 다시 붙을 때의 서버 쪽 재전송 최적화(해시가 같으면 생략 등)는 없다 — 늘 새 값을 보낸다.
- 지연·끊김 흉내 없음(로컬이라 늘 빠르다). 느린 와이파이 재현은 `gold-sync-sim`·`gold-loss-real-sdk` 쪽.
- 데이터는 메모리 — 서버를 끄면 사라진다. `village/` 의 REST·스트리밍도 이 서버로 돌지만 따로 확인하지 않았다.
