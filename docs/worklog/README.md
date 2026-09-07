# 작업 로그 (worklog)

> 두 기기(맥북·학교 Windows)에서 rpg를 번갈아 작업할 때 **이어받기용** 기록.
> 날짜별 파일(`YYYY-MM-DD.md`)로 남긴다. git로 공유되고, Obsidian에서도 보인다.

## 왜 필요한가

- 클로드코드 대화 기록은 기기·세션마다 따로다. 하지만 이 worklog는 repo에 있으니 **양쪽이 같이 본다.**
- 새 세션은 시작할 때 최신 worklog + `git log`를 먼저 읽고 **"어디까지 했고 다음은 뭐다"** 를 이어받는다.

## 한 항목에 적을 것

```
## YYYY-MM-DD (기기: 맥북 / Windows)
- 한 일:
- 기준 commit / 브랜치:
- 검증 결과 (verify-safety 등):
- 다음 할 일:
- 주의/미해결:
```

## 커밋 제목으로 못 찾는 기록

git log 검색으로는 안 잡히는 작업만 여기 적는다. (전체 목록이 아니다 — 파일 목록은 이 폴더를 보면 된다.)

- [2026-09-04-q1-boardquests.md](2026-09-04-q1-boardquests.md) — 퀘스트판 유실 버그(Q1) 수정.
  PR #164에 deco 작업과 함께 squash되어 커밋 제목이 `fix(deco): ...`다. `--grep=퀘스트`·`--grep=boardQuests` 모두 안 잡힌다.
