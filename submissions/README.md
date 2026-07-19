# 제출 폴더

참가자 풀이가 `master`에 머지되면 이 폴더 아래에 위치합니다.

```text
submissions/
  <githubUsername>/
    <sourceKey>/
      <submissionKey>/
        solution.<ext>
        README.md
        meta.json
```

소스별 폴더 규칙:

| 소스 | `sourceKey` | `submissionKey` 기준 |
| --- | --- | --- |
| Top Interview Questions Easy | `top-interview-easy` | Explore URL의 마지막 숫자 |
| LeetCode 75 | `leetcode-75` | 문제 제목 앞 LeetCode 번호 |
| Top Interview 150 | `top-interview-150` | 문제 제목 앞 LeetCode 번호 |

예시:

```text
submissions/ada/top-interview-easy/546/solution.ts
submissions/ada/leetcode-75/1768/solution.ts
submissions/ada/top-interview-150/88/solution.py
```

참가자는 `data/users.json`에 등록합니다. 기본적으로 `githubUsername`은 `submissions/<githubUsername>` 경로와 매핑됩니다.

`slug`, LeetCode 내부 ID, 예전 `solutions/<id>/` 경로는 공식 제출 경로로 쓰지 않습니다.
