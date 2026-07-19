# LeetCode Progress Radar

## 제출 규칙

풀이 폴더는 반드시 아래 세 소스별 규칙을 따릅니다. `slug`나 LeetCode 내부 ID는 참가자 폴더명으로 쓰지 않습니다.

| 소스 | `sourceKey` | `submissionKey` 기준 | 예시 경로 |
| --- | --- | --- | --- |
| Top Interview Questions Easy | `top-interview-easy` | Explore URL의 마지막 숫자 | `submissions/<githubUsername>/top-interview-easy/546/solution.ts` |
| LeetCode 75 | `leetcode-75` | 문제 제목 앞 LeetCode 번호 | `submissions/<githubUsername>/leetcode-75/1768/solution.ts` |
| Top Interview 150 | `top-interview-150` | 문제 제목 앞 LeetCode 번호 | `submissions/<githubUsername>/top-interview-150/88/solution.ts` |

예를 들어 `https://leetcode.com/explore/featured/card/top-interview-questions-easy/92/array/546/`의 제출 키는 `546`입니다. `1768. Merge Strings Alternately`는 `1768`, `88. Merge Sorted Array`는 `88`입니다.

소규모 LeetCode 스터디 그룹을 위한 진행 현황 대시보드입니다. 참가자는 이 레포에서 각자 브랜치를 만들고 풀이를 추가합니다. 변경 사항이 `master`에 머지되고 사이트가 다시 빌드되면 공식 대시보드가 갱신됩니다.

## 운영 방식

1. 참가자가 이 레포에서 본인 작업 브랜치를 만듭니다.
2. 풀이를 `submissions/<githubUsername>/<sourceKey>/<submissionKey>/` 아래에 추가합니다.
3. PR을 만들고 `master`에 머지합니다.
4. GitHub Actions가 검증과 정적 빌드를 실행합니다.
5. `master`에 머지된 경우 GitHub Pages에 대시보드를 배포합니다.

공개 페이지에는 `master`에 머지된 제출만 반영됩니다. 개인 브랜치는 직접 스캔하지 않습니다.

PR은 `validate` 검증과 리뷰 조건을 통과하면 다른 PR의 GitHub Pages 배포 완료를 기다리지 않고 머지합니다. 저장소는 merge commit만 허용하며, squash merge와 rebase merge는 사용하지 않습니다. 충돌이 있는 PR만 개별적으로 `master`를 반영해 해결합니다.

## 참가자 등록

참가자는 `data/users.json`에 등록합니다. `githubUsername`에는 GitHub 프로필 URL에서 `https://github.com/` 뒤에 오는 로그인 ID를 씁니다. 예를 들어 `https://github.com/whoisyourbias`의 `githubUsername`은 `whoisyourbias`입니다.

```json
{
  "users": [
    {
      "id": "mygo",
      "displayName": "myunghwanKang",
      "githubUsername": "whoisyourbias",
      "active": true
    }
  ]
}
```

필드 설명:

- `id`: `/users/<id>` 경로에 쓰이는 안정적인 식별자
- `displayName`: 대시보드에 표시할 이름
- `githubUsername`: GitHub 로그인 ID; `@`를 붙이지 않고, 표시 이름이나 LeetCode 아이디가 아니라 GitHub 프로필 URL의 마지막 값을 사용
- `active`: 선택값이며 기본값은 `true`; `false`면 랭킹에서 제외
- `submissionsPath`: 선택값인 제출 폴더 경로 재정의; 기본값은 `submissions/<githubUsername>`

제출 폴더명은 기본적으로 `githubUsername`과 같아야 합니다. 예를 들어 `githubUsername`이 `whoisyourbias`면 풀이를 `submissions/whoisyourbias/...` 아래에 둡니다.

## 제출 구조

예상 구조:

```text
submissions/
  ada/
    top-interview-easy/
      546/
        solution.ts
        README.md
        meta.json
    leetcode-75/
      1768/
        solution.ts
    top-interview-150/
      88/
        solution.py
```

대시보드는 문제 폴더 안에서 지원되는 `solution.{ext}` 파일을 찾으면 해당 문제를 완료로 계산합니다. 파일명 basename인 `solution`은 대소문자를 구분하지 않으므로 `Solution.java`도 인식합니다.

지원하는 풀이 파일 확장자:

```text
c, cc, cpp, cs, dart, go, java, js, kt, php, py, rb, rs, scala, sql, swift, ts
```

`README.md`는 선택입니다. `meta.json`도 선택이며, 상태를 바꾸거나 화면 표시용 메타데이터를 추가할 때 사용합니다.

```json
{
  "status": "solved",
  "language": "TypeScript",
  "solvedAt": "2026-07-18T00:00:00.000Z",
  "notes": "해시 맵으로 한 번 순회합니다."
}
```

상태값:

- `solved`: 완료로 계산
- `reviewing`: 화면에는 표시하지만 완료로 계산하지 않음
- `skipped`: 화면에는 표시하지만 완료로 계산하지 않음

`meta.json`만 있고 풀이 파일이 없으면 기본 상태는 `reviewing`입니다. `solution.*`만 있고 `meta.json`이 없으면 기본 상태는 `solved`입니다. 예전 `solutions/<id>/` 경로나 slug 폴더명은 공식 제출 경로로 인식하지 않습니다.

같은 문제가 여러 소스에 들어 있는 경우 canonical `slug` 기준으로 한 문제로 집계합니다. 여러 제출이 있으면 `solved`, `reviewing`, `skipped` 순서로 더 높은 상태를 우선합니다.

## 문제 카탈로그

문제 카탈로그는 `data/problem-catalog.json`에 체크인되어 있습니다. 앱은 런타임에 LeetCode를 크롤링하지 않습니다.

추적하는 목록:

- Top Interview Questions Easy
- LeetCode 75
- Top Interview 150

카탈로그에서 각 목록의 `items[].submissionKey`가 실제 제출 폴더명입니다. LeetCode 75와 Top Interview 150은 LeetCode 문제 번호를 사용하고, Top Interview Questions Easy는 Explore URL 마지막 숫자를 사용합니다.

카탈로그 재생성은 운영자가 문제 목록 자체를 다시 만들 때만 사용합니다. 일반 참가자는 이 명령을 실행할 필요가 없습니다.

입력 파일은 임의의 README가 아니라, `scripts/build-catalog.mjs`가 파싱할 수 있는 문제 목록 Markdown이어야 합니다. 현재는 `honood/leetcode` README처럼 `## [LeetCode 75]`, `## [Top Interview 150]` 섹션과 문제 링크 표기가 들어 있는 형식을 기준으로 합니다.

```bash
npm run catalog:build -- /path/to/source-readme.md
```

## 로컬 개발

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

진행 데이터만 수동으로 다시 만들려면 아래 명령을 실행합니다.

```bash
npm run progress:build
```

`npm run build`는 항상 `next build` 전에 진행 데이터 생성기를 실행합니다.

진행 데이터 생성기는 Git 히스토리에서 각 풀이 파일의 최초 추가 커밋 날짜를 읽어 사용자별 활동 달력도 만듭니다. 풀이 파일이 없고 `meta.json`만 있는 완료 제출은 `meta.json`의 최초 추가 커밋 날짜를 사용합니다. 날짜는 Asia/Seoul 기준 일자로 묶이며, Git 히스토리를 읽을 수 없는 로컬 환경에서는 활동 달력이 비어 있을 수 있지만 빌드는 계속 진행됩니다.

## 배포

이 앱은 빌드 시점에 체크인된 파일을 읽어 진행 데이터를 만들고, Next.js static export 결과물을 GitHub Pages에 배포합니다.

- 운영 브랜치: `master`
- 배포 workflow: `.github/workflows/deploy-pages.yml`
- 배포 URL: `https://whoisyourbias.github.io/leetdash/`

GitHub 저장소 설정에서 Pages source를 `GitHub Actions`로 설정합니다.

workflow는 아래 환경 변수로 Pages 경로와 GitHub 원본 링크를 고정합니다.

```bash
SOURCE_REPOSITORY_URL=https://github.com/<owner>/<repo>
BRANCH=master
NEXT_PUBLIC_BASE_PATH=/leetdash
```

GitHub Actions checkout은 활동 달력 생성을 위해 `fetch-depth: 0`으로 전체 히스토리를 가져옵니다.

PR에서는 `typecheck`, `test`, `build`까지만 실행합니다. `master` push에서는 같은 검증을 통과한 뒤 `out/`을 GitHub Pages artifact로 업로드하고 배포합니다. 여러 PR이 연속으로 머지되면 GitHub Pages 배포는 최신 `master` 기준으로 진행되며, 이전 배포 작업은 취소될 수 있습니다.

## 라우트

- `/`: 대시보드 요약과 사용자별 진행 테이블
- `/admin`: 참가자 등록 현황과 Git 운영 안내
- `/users/[userId]`: 사용자별 문제 진행 현황
- `/lists/[listKey]`: 문제 목록별 랭킹

## 검증

```bash
npm run progress:build
npm run typecheck
npm test
npm run build
```

현재 테스트 범위:

- 카탈로그 목록 개수, slug 매핑, 제출 키 형식과 중복 검증
- 소스별 제출 폴더 기반 정적 진행 데이터 생성
- 풀이 파일 기본 판정과 `meta.json` 상태 재정의
- 예전 `solutions/<id>/` 및 slug 제출 폴더 무시
