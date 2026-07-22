# 알고리즘 스터디 템플릿

이 폴더 구조를 이 레포의 `submissions/<githubUsername>/` 아래에서 사용합니다.

## 구조

```text
top-interview-easy/
  1/
    solution.{ext}
    README.md
leetcode-75/
  1768/
    solution.{ext}
top-interview-150/
  88/
    solution.{ext}
programmers/
  12906/
    solution.{ext}
swea/
  1206/
    solution.{ext}
```

소스별 제출 키:

| 소스 | 폴더 | 키 기준 |
| --- | --- | --- |
| Top Interview Questions Easy | `top-interview-easy/<submissionKey>/` | 문제 고유 LeetCode 번호 |
| LeetCode 75 | `leetcode-75/<submissionKey>/` | 문제 제목 앞 LeetCode 번호 |
| Top Interview 150 | `top-interview-150/<submissionKey>/` | 문제 제목 앞 LeetCode 번호 |
| Programmers | `programmers/<submissionKey>/` | 프로그래머스 문제 번호 |
| SWEA | `swea/<submissionKey>/` | SWEA 문제 번호 |

예를 들어 `Two Sum`의 LeetCode 문제 번호는 `1`이므로 `top-interview-easy/1/`에 제출합니다. `1768. Merge Strings Alternately`는 `leetcode-75/1768/`, `88. Merge Sorted Array`는 `top-interview-150/88/`, 프로그래머스 12906은 `programmers/12906/`, SWEA 1206은 `swea/1206/`입니다.

## 완료 판정

대시보드는 문제 폴더 안에서 지원되는 `solution.{ext}` 파일을 찾으면 해당 문제를 완료로 계산합니다.

`README.md`는 선택이며 풀이 설명이나 메모를 적을 때 사용합니다.

`meta.json`도 선택입니다. 기본 상태를 바꾸거나 화면 표시용 메타데이터를 추가해야 할 때만 사용합니다.

상태값:

- `solved`
- `reviewing`
- `skipped`

대시보드는 `solved`만 완료로 계산합니다.

```json
{
  "status": "reviewing",
  "language": "TypeScript",
  "solvedAt": "2026-07-18T00:00:00.000Z",
  "notes": "한 번 더 검토가 필요합니다."
}
```
