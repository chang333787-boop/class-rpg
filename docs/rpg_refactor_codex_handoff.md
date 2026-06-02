# 우리반 성장 RPG 리팩토링 감독 인수인계서

> 목적: 이 문서는 Claude Code 내부 Codex가 기존 GPT 감독 역할을 이어받아 `우리반 성장 RPG` 리팩토링을 안전하게 진행하기 위한 인수인계 문서이다.  
> 핵심은 **조사 먼저, 수정 나중**, **작은 Phase**, **검증 후 머지**, **보고 후 정지**이다.

---

## 0. 이 문서의 역할

앞으로 Codex는 Claude Code 내부에서 다음 역할을 맡는다.

- Claude Code가 바로 코드를 수정하지 않게 제어한다.
- 작업을 Phase 단위로 쪼갠다.
- 조사 Phase와 수정 Phase를 명확히 분리한다.
- 위험 파일과 금지 영역을 먼저 선언한다.
- Claude Code에게 줄 작업 명령문을 작성한다.
- Claude Code의 보고서를 검토하고 자동 머지 가능 여부를 판단한다.
- 위험하거나 범위가 커지면 즉시 멈추게 한다.
- 완료 후 다음 Phase로 넘어가지 않고 보고 후 정지하게 한다.

Codex는 단순 명령 생성기가 아니라 **프로젝트 안전 감독자**로 동작해야 한다.

---

## 1. 최상위 운영 원칙

### 1.1 절대 원칙

```txt
조사 먼저, 수정 나중.
수정은 작은 Phase 하나씩.
범위 밖 리팩토링 금지.
git add . 금지.
Firebase 데이터 직접 수정 금지.
운영 write 발생 가능 버튼 클릭 금지.
검증 전 자동 머지 금지.
보고 후 반드시 정지.
```

### 1.2 기본 Phase 흐름

모든 수정 Phase는 아래 순서를 따른다.

```txt
1. main 최신화
2. 현재 main commit 확인
3. 작업 트리 clean 확인
4. 새 브랜치 생성
5. 사전 조사
6. 수정 가능 범위 / 금지 범위 확정
7. 최소 수정
8. 정적 검증
9. 자동 브라우저 검증
10. 필요 시 스크린샷 비교
11. git diff 확인
12. 조건 충족 시 PR 생성/머지
13. 운영 반영 확인
14. 보고 후 정지
```

조사 Phase는 아래 순서를 따른다.

```txt
1. main 최신화
2. 현재 main commit 확인
3. 작업 트리 clean 확인
4. 코드/구조 조사
5. 위험도 분류
6. 선택지 비교
7. 추천안 제시
8. 코드 수정 없이 보고 후 정지
```

---

## 2. Codex의 감독 태도

Codex는 예스맨처럼 반응하면 안 된다.

작업 요청을 받았을 때 다음을 먼저 판단한다.

```txt
이 작업은 조사 Phase인가, 수정 Phase인가?
Firebase write가 발생할 수 있는가?
root set/remove/update가 관련되는가?
학생 데이터가 손상될 수 있는가?
함수명/전역 스코프/onclick 의존성이 깨질 수 있는가?
변경 범위가 너무 넓지 않은가?
자동 검증이 가능한가?
운영에서 write 없이 확인 가능한가?
```

불확실하면 수정하지 말고 조사 보고로 멈춘다.

---

## 3. 고위험 영역

다음 영역은 기본적으로 **조사 먼저** 한다.  
수정은 별도 승인 후 작은 Phase로만 진행한다.

```txt
Firebase root set/remove/update
gamedata.js의 _normalizeArrays
gamedata.js의 _migrate
gamedata.js의 GAME_DATA / 데이터 상수
students 이중 키 구조
questLogs / quests 관계
buildMainHTML
canvas / SVG 렌더링
전투 / 몬스터 로직
학생 삭제 / 초기화 / 계정 관리
importData
confirmRollback
confirmReset
promotionRequests / pwResetRequests 저장 구조
```

### 3.1 사실상 금지에 가까운 작업

```txt
display:none 클래스화 금지
동적 style="${...}" 치환 금지
type="module" 전환 금지
async/defer 임의 추가 금지
함수명/변수명 변경 금지
대규모 함수 분해 금지
Firebase 실데이터 마이그레이션 즉시 실행 금지
```

---

## 4. 사용자 작업 선호

사용자는 리팩토링을 급하게 끝내는 것보다 **깨지지 않는 것**을 훨씬 중요하게 본다.  
8월 전까지는 기능 개발이 급하지 않으며, 다른 일을 하면서 클릭만 할 수 있으므로 천천히 진행해도 된다.

사용자 선호:

```txt
천천히 해도 됨
깨지지만 않게
조사 먼저
작은 Phase
자동 검증
보고 후 정지
commit만 하지 말고 가능하면 push/PR/운영확인까지
하지만 위험하면 멈춤
```

사용자는 무조건 동의하는 답변보다, 위험을 짚고 멈출 줄 아는 판단을 원한다.

---

## 5. 현재까지 완료된 주요 리팩토링 이력

### 5.1 Phase 1 — gamedata.js 외부화

- `gamedata.js` 외부화 완료.
- 공유 데이터/DB 로직이 HTML에서 분리됨.

### 5.2 Phase 4 — Firebase 저장 위험 정리

완료 내용:

```txt
autoCloseDailyQuests 부분 저장 전환
doAddStudents → saveStudent 부분 저장
위험 UI 제거
dead code 제거
학생 삭제 버튼 제거
resetToDefault 버튼 제거
```

### 5.3 Phase 5 — CSS 외부화

완료 내용:

```txt
kiosk.css 분리
admin.css 분리
student.css 분리
HTML 내 <style> 잔존 0건
```

### 5.4 Phase 6 — admin 인라인 style 유틸리티 클래스화

완료 내용:

```txt
admin 인라인 style 1,086 → 905
총 -181건
시각 회귀 0
display:none은 JS 토글 의존 때문에 영구 보류
동적 style은 건드리지 않음
```

### 5.5 Phase 7 — gamedata.js root set helper 정리

완료 내용:

```txt
saveSettings → child('settings').set
pwResetRequests → 요청 id별 부분 저장
promotionRequests → 배열 노드 부분 저장
dead helper addQuest/addArtwork 제거
this.save( 0건
```

### 5.6 Phase 8 — UI 차단 위험 함수 제거

완료 내용:

```txt
confirmDeleteStudent 제거
DB.save(data) 정의 제거
resetToDefault 제거
DB.save( 0건
this.save( 0건
_fbRef.remove()는 confirmReset 1건만 남음
```

### 5.7 Phase 9 — JS 외부화 진행

완료 내용:

```txt
student.html 메인 script → student.js 외부화 완료
admin.html 메인 script → admin.js 외부화 완료
kiosk.html script 외부화 조사 완료
다음 후보: kiosk.js 외부화 실행
```

---

## 6. 현재 파일 구조 요약

현재 구조는 대략 다음과 같다.

```txt
student.html  약 926줄
student.js    약 10,126줄
admin.html    약 1,676줄
admin.js      약 5,473줄
kiosk.html    아직 약 871줄
gamedata.js   공유 데이터/DB
student.css
admin.css
kiosk.css
```

CSS는 모두 외부화 완료.  
student/admin JS는 외부화 완료.  
kiosk JS만 아직 HTML 내부에 남아 있다.

---

## 7. 저장 안정성 현재 상태

현재 저장 위험은 예전보다 크게 줄었다.

```txt
DB.save(      0건
this.save(    0건
학생/자동 실행 root 저장 경로 0건
```

남은 root 계열은 의도된 기능이다.

```txt
importData        파일 선택 + confirm
confirmRollback  백업 선택 + confirm
confirmReset     confirm + 비밀번호
DB.init           DB 비어 있을 때 초기화
```

`_fbRef.remove()`는 비밀번호 보호된 `confirmReset` 1건만 남아 있다.

따라서 예전처럼 “모르는 사이 root 전체 set/remove가 숨어 있는 상태”는 아니다.

---

## 8. JS 외부화 작업 원칙

student/admin 외부화는 성공했다.  
kiosk도 같은 방식으로 진행 가능하다는 조사 결과가 있다.

외부화 원칙:

```txt
기존 인라인 script 내부만 새 .js 파일로 이동
<script> 태그는 js 파일에 넣지 않음
type="module" 사용 금지
async/defer 사용 금지
함수명/변수명/순서 변경 금지
내용 바이트 동일성 검증
node --check 통과
전역 함수 typeof 검증
브라우저 로드 검증
스크린샷 비교
Firebase write 버튼 클릭 금지
```

현재 student/admin은 캐시 방지를 위해 버전 쿼리를 붙였다.

```html
<script src="./student.js?v=20260602"></script>
<script src="./admin.js?v=20260602"></script>
```

앞으로 `student.js`, `admin.js`, `kiosk.js`를 수정하면 해당 HTML의 version query 갱신을 검토해야 한다.

---

## 9. 다음 추천 Phase

### 9.1 추천 1순위 — Phase 9-G: kiosk.js 외부화 실행

이미 조사 완료. 안전해 보인다.

기존 조사 결과:

```txt
kiosk.html 메인 인라인 script: L74-L869
실제 이동 대상: L75-L868
이동 줄 수: 약 794줄
인라인 script 1개
독립 tiny script 없음
type="module" 금지
document.write 없음
parse-time DOM 직접 조작 없음
DB.init 미사용
자체 fbRef로 Firebase read 구독
Firebase write는 감정제출/퀘스트신청/취소 버튼 클릭 시에만 발생
검증 중 버튼 클릭 금지
```

권장 실행:

```txt
kiosk.html L75-L868 내용을 kiosk.js로 이동
kiosk.html에는 <script src="./kiosk.js?v=20260602"></script> 삽입
로직 변경 없음
함수명/변수명/순서 변경 없음
버튼 클릭 금지
Firebase write 0 확인
```

### 9.2 추천 2순위 — 외부화 시리즈 최종 점검

kiosk.js까지 완료한 뒤에는 전체 구조 점검을 한다.

점검 항목:

```txt
각 html의 script 태그 로드 순서
각 js HTTP 200
각 html에 인라인 script 잔존 여부
version query 현황
node --check
대표 화면 로드
전역 함수 typeof
Firebase write 없음
```

### 9.3 추천 3순위 — 기능 개발 전 리팩토링 지도 추가 작성

아직 기능 개발은 8월 예정이므로 다음을 조사할 수 있다.

```txt
student.js 큰 함수 지도
admin.js 탭별 함수 지도
기능 추가 시 건드릴 가능성이 높은 영역
건드리면 위험한 영역
```

---

## 10. Claude Code에게 명령문을 쓸 때의 표준 형식

항상 다음 구조를 사용한다.

```txt
[목표]
[수정 대상]
[절대 금지]
[사전 확인]
[작업 원칙]
[정적 검증]
[자동 브라우저 검증]
[운영 데이터 안전]
[자동 머지 조건]
[보고 형식]
[정지 조건]
```

### 10.1 조사 Phase 문구

조사 Phase라면 반드시 다음을 포함한다.

```txt
이번 Phase는 조사만입니다.
코드 수정하지 마세요.
PR 생성하지 마세요.
commit하지 마세요.
보고 후 멈추세요.
```

### 10.2 수정 Phase 문구

수정 Phase라면 반드시 다음을 포함한다.

```txt
수정 범위를 벗어나면 자동 머지하지 말고 보고하세요.
diff가 예상보다 넓으면 멈추세요.
실제 Firebase write 없이 검증하세요.
완료 후 다음 Phase로 넘어가지 말고 멈추세요.
```

---

## 11. 자동 머지 허용 기준

다음 조건을 모두 만족할 때만 자동 머지 가능하다.

```txt
작업 파일이 예상 범위와 일치
diff가 예상 범위와 일치
금지 파일 무변경
정적 검증 통과
node --check 필요 시 통과
브라우저 HTTP 200
pageerror 0
콘솔 오류 없음 또는 기존 무관 오류만
대표 전역 함수 typeof 정상
스크린샷 회귀 없음
Firebase write 없음
운영 반영 확인 가능
```

하나라도 이상하면 PR 머지 금지.

---

## 12. Firebase write 검증 원칙

운영에서 실제 write가 발생할 수 있는 버튼은 절대 클릭하지 않는다.

특히 금지:

```txt
관리자 로그인
설정 저장
백업 생성
importData 실행
confirmRollback 실행
confirmReset 실행
학생 데이터 변경 버튼
kiosk 감정 제출
kiosk 퀘스트 신청
kiosk 신청 취소
```

필요한 검증은 다음으로 대체한다.

```txt
HTTP 200
pageerror 0
console error 확인
typeof 확인
DOM 존재 확인
스크린샷 비교
mock/spying 검증
grep/정적 검증
운영 반영 HTTP/grep 확인
```

---

## 13. 보고서 작성 기준

완료 보고서는 다음 구조를 따른다.

```txt
1. 변경 파일 목록
2. 변경한 대상
3. 변경 전 구조
4. 변경 후 구조
5. 변경 범위
6. 보존한 것
7. 정적 검증 결과
8. 자동 브라우저 검증 결과
9. 스크린샷/시각 검증 결과
10. Firebase write 없음 확인
11. git diff 요약
12. PR 생성/머지 결과
13. main 새 commit
14. 운영 반영 확인 결과
15. 머지 후 주의사항
16. 정지 선언
```

조사 보고서는 다음 구조를 따른다.

```txt
1. 기준 main commit
2. 조사 대상
3. 현재 구조
4. 호출부/참조부
5. 위험도 분류
6. 선택지 비교
7. 추천안
8. 예상 수정 범위
9. 예상 위험도
10. 필요한 검증 방법
11. 정지 선언
```

---

## 14. Codex가 GPT에게 다시 물어봐야 하는 경우

아래 작업은 Codex 혼자 결정하지 말고 GPT나 사용자에게 다시 확인한다.

```txt
새 기능 설계
학생 데이터 구조 변경
관리모드 계정/삭제/비밀번호 정책
Firebase 마이그레이션
students 이중 키 정리
전투/농장/캐릭터/canvas/SVG 수정
buildMainHTML 분해
기능 우선순위 결정
"이 방향이 맞나?" 싶은 순간
```

반복 리팩토링, 외부화, dead code 조사, 정적 검증 중심 작업은 Codex가 감독 역할을 수행해도 된다.

---

## 15. Phase 9-G 실행용 명령문 초안

다음은 Claude Code에게 바로 전달 가능한 Phase 9-G 명령문이다.

```txt
Phase 9-G를 시작합니다.

목표:
kiosk.html의 메인 인라인 script를 kiosk.js로 외부화합니다.
이번 작업은 로직 변경 없는 순수 이동입니다.

수정 대상:
- kiosk.html
- kiosk.js 신규 생성

외부화 대상:
- kiosk.html의 메인 인라인 script
- 기존 기준: <script> 시작 L74, </script> 종료 L869
- 실제 이동 대상: L75-L868 내용만
- <script> 태그와 </script> 태그는 kiosk.js에 넣지 않습니다.

최종 구조:
kiosk.html의 기존 메인 script 블록 자리에 아래 1줄을 둡니다.

<script src="./kiosk.js?v=20260602"></script>

절대 금지:
- 로직 수정 금지
- 함수명 변경 금지
- 변수명 변경 금지
- 함수 순서 변경 금지
- 함수 분해 금지
- gamedata.js 수정 금지
- kiosk.css 수정 금지
- student.html 수정 금지
- student.js 수정 금지
- admin.html 수정 금지
- admin.js 수정 금지
- type="module" 사용 금지
- async/defer 추가 금지
- Firebase 데이터 직접 수정 금지
- 마이그레이션 금지
- 감정 제출 버튼 클릭 금지
- 퀘스트 신청 버튼 클릭 금지
- 신청 취소 버튼 클릭 금지

사전 확인:
1. 현재 main commit 확인
2. 작업 트리 clean 확인
3. kiosk.html의 script 경계 재확인
4. L74가 <script>인지 확인
5. L75가 JS 첫 줄인지 확인
6. L868이 JS 마지막 줄인지 확인
7. L869가 </script>인지 확인
8. gamedata.js가 kiosk script보다 먼저 로드되는지 확인

작업 원칙:
1. 새 브랜치를 만듭니다.
2. kiosk.html L75-L868 내용을 정확히 추출해 kiosk.js로 저장합니다.
3. kiosk.html의 L74-L869 블록을 <script src="./kiosk.js?v=20260602"></script> 1줄로 교체합니다.
4. 다른 파일은 수정하지 않습니다.

중요 검증:
- 원본 script 내부 내용과 kiosk.js가 바이트 단위로 동일해야 합니다.
- kiosk.js 안에 <script> 또는 </script> 태그가 없어야 합니다.
- type="module", async, defer가 없어야 합니다.
- node --check kiosk.js가 통과해야 합니다.

정적 검증:
1. 변경 파일이 kiosk.html + kiosk.js 두 개뿐인지
2. kiosk.js가 생성됐는지
3. kiosk.js 줄 수가 약 794줄인지
4. kiosk.html 줄 수가 약 70~80줄대인지
5. kiosk.html에 <script src="./kiosk.js 가 정확히 1건인지
6. 기존 메인 인라인 script가 사라졌는지
7. gamedata.js 로드가 kiosk.js보다 먼저인지
8. student/admin/gamedata/css 파일이 무변경인지
9. node --check kiosk.js 통과

자동 브라우저 검증:
- kiosk.html HTTP 200
- kiosk.js HTTP 200
- student.html HTTP 200
- student.js HTTP 200
- admin.html HTTP 200
- admin.js HTTP 200
- pageerror 없음
- 콘솔 오류 없음 또는 기존 무관 오류만

typeof 검증:
- typeof FIREBASE_CONFIG === 'object'
- typeof switchKioskTab === 'function'
- typeof openKioskEmotion === 'function'
- typeof requestQuest === 'function'
- typeof requestCancel === 'function'
- typeof kSubmitEmotion === 'function'
- typeof navKioskLb === 'function'

스모크 테스트:
Firebase write가 발생하지 않는 범위에서만 확인합니다.
허용:
- kiosk 화면 렌더 확인
- 함수 typeof 확인
- DOM 구조 확인
- 표가 렌더되는지 확인

금지:
- 감정 제출
- 퀘스트 신청
- 신청 취소
- emotionLogs/students set 발생 가능 버튼 클릭

시각 검증:
OLD(main) / NEW(분기)를 별도 서버로 띄워 kiosk.html 초기 화면을 비교합니다.

viewport:
- PC 1440×900
- 태블릿 1024×768
- 모바일 390×844

운영 데이터 안전:
- 이번 Phase는 script 이동만입니다.
- 실제 Firebase write는 없어야 합니다.
- 운영 확인은 kiosk.html/kiosk.js 반영 여부와 grep/HTTP 수준으로 충분합니다.

자동 머지 조건:
아래 조건을 모두 만족하면 자동 PR 생성 및 머지해도 됩니다.

- 변경 파일이 kiosk.html + kiosk.js 두 개뿐임
- kiosk.js 내용이 기존 메인 script 내부와 바이트 단위 동일함
- kiosk.html에는 kiosk.js script 태그 1줄만 삽입됨
- type="module" 없음
- async/defer 없음
- node --check kiosk.js 통과
- kiosk.js HTTP 200
- kiosk/student/admin 페이지 로드 검증 통과
- 대표 전역 함수 typeof 검증 통과
- write 버튼 클릭 없이 검증 완료
- 스크린샷 비교에서 시각 회귀 없음
- 실제 Firebase write 없이 검증 완료

조건 만족 시:
gh pr create --fill
gh pr merge --squash --delete-branch

단, 내용 동일성 diff가 실패하거나, 전역 함수가 undefined가 되거나, kiosk 화면이 깨지거나, Firebase write 가능성이 발생하면 자동 머지하지 말고 즉시 보고하세요.

보고 형식:
1. 변경 파일 목록
2. 이동한 script 범위
3. kiosk.js 신규 파일 줄 수
4. kiosk.html 줄 수 변화
5. script 삽입 위치
6. 원본 script 내부와 kiosk.js 내용 동일성 검증 결과
7. type="module" / async / defer 미사용 확인
8. node --check kiosk.js 결과
9. 자동 브라우저 검증 결과
10. 전역 함수 typeof 검증 결과
11. 스모크 테스트 결과
12. 스크린샷/시각 검증 결과
13. Firebase write 없음 확인
14. git diff 요약
15. PR 생성/머지 결과
16. main 새 commit
17. 운영 반영 확인 결과
18. 머지 후 주의사항

중요:
이번 Phase는 순수 외부화 작업입니다.
함수 분해, 로직 수정, 변수명 변경은 절대 하지 마세요.
감정 제출/퀘스트 신청/신청 취소 버튼은 누르지 마세요.
완료 후 다음 Phase로 넘어가지 말고 보고 후 멈추세요.
```

---

## 16. 최종 메모

이 인수인계서는 기존 GPT 감독 역할을 최대한 문서화한 것이다.  
Codex는 이 문서를 기준으로 반복 리팩토링과 검증 중심 작업을 수행할 수 있다.

하지만 다음 성격의 작업은 반드시 상위 검토가 필요하다.

```txt
새 기능 설계
학생 데이터 구조 변경
운영 정책 결정
Firebase 마이그레이션
대규모 함수 분해
게임성/교육성 판단
```

현재 가장 안전한 다음 작업은 **Phase 9-G kiosk.js 외부화 실행**이다.
