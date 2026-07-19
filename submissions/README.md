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

`solution` 파일명은 대소문자를 구분하지 않으므로 `Solution.java`처럼 LeetCode 기본 파일명도 인식됩니다.

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

참가자는 `data/users.json`에 등록합니다. `githubUsername`에는 GitHub 프로필 URL에서 `https://github.com/` 뒤에 오는 로그인 ID를 씁니다. `@`를 붙이지 않고, 표시 이름이나 LeetCode 아이디를 쓰지 않습니다.

기본적으로 `githubUsername`은 `submissions/<githubUsername>` 경로와 매핑됩니다. 예를 들어 `githubUsername`이 `whoisyourbias`면 풀이를 `submissions/whoisyourbias/...` 아래에 둡니다.

`slug`, LeetCode 내부 ID, 예전 `solutions/<id>/` 경로는 공식 제출 경로로 쓰지 않습니다.
