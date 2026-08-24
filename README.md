# LeetCode Progress Radar

## 서드파티 서비스 상태

![OpenCode Go Gateway](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwhoisyourbias%2Fleetdash%2Fstatus-data%2Fstatus%2Fgateway-status.json)
![DeepSeek V4 Flash (AI Review)](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwhoisyourbias%2Fleetdash%2Fstatus-data%2Fstatus%2Fdeepseek-flash-status.json)
![GitHub Pages](https://img.shields.io/github/deployments/whoisyourbias/leetdash/github-pages)
![GitHub Actions - Deploy](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/deploy-pages.yml?branch=master)
![GitHub Actions - OpenCode Review](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/opencode-review.yml)
![GitHub Actions - Sweep](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/sweep-submission-prs.yml)

| 서비스 | 상태 배지 | 용도 |
| --- | --- | --- |
| AI 리뷰 API · OpenCode Go 게이트웨이 | ![OpenCode Go Gateway](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwhoisyourbias%2Fleetdash%2Fstatus-data%2Fstatus%2Fgateway-status.json) | 코드 리뷰 요청이 거치는 게이트웨이 연결 상태 |
| AI 리뷰 API · DeepSeek V4 Flash | ![DeepSeek V4 Flash (AI Review)](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fwhoisyourbias%2Fleetdash%2Fstatus-data%2Fstatus%2Fdeepseek-flash-status.json) | 제출 PR 리뷰의 기본 모델 응답 상태 |
| GitHub Pages | ![GitHub Pages](https://img.shields.io/github/deployments/whoisyourbias/leetdash/github-pages) | 대시보드 정적 배포 상태 |
| GitHub Actions | ![GitHub Actions - Deploy](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/deploy-pages.yml?branch=master) ![GitHub Actions - OpenCode Review](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/opencode-review.yml) ![GitHub Actions - Sweep](https://img.shields.io/github/actions/workflow/status/whoisyourbias/leetdash/sweep-submission-prs.yml) | 검증·리뷰·머지·배포 CI/CD 워크플로우 상태 |

AI 리뷰 API는 OpenCode Go 게이트웨이(`https://opencode.ai/zen/go/v1`)와 저장소 secret `OPENCODE_API_KEY`를 사용합니다. 기본 모델은 `deepseek-v4-flash`입니다. 응답 본문에서 DeepSeek의 `GoUsageLimitError`가 확인되면 해당 workflow 실행에서는 DeepSeek를 더 호출하지 않고, 일반 문제는 `mimo-v2.5`, 어려운 문제는 `qwen3.7-plus`로 리뷰합니다. 어려운 문제는 신뢰된 기본 브랜치의 `data/problem-catalog.json`을 기준으로 LeetCode Hard, Programmers Level 3 이상, SWEA D5 이상이며, 미분류 문제는 일반 문제로 취급합니다. Qwen은 복잡한 알고리즘 리뷰 품질을 우선하는 경로이고, MiMo는 일반 문제의 비용 효율을 우선하는 경로입니다.

PR에 `ai-review:qwen` 라벨을 추가하면 난이도와 DeepSeek 상태에 관계없이 모든 대상 파일을 Qwen으로 즉시 강제 재리뷰합니다. 라벨이 유지되는 동안 이후 자동 리뷰도 Qwen을 선택합니다. 성공한 파일 리뷰 캐시는 소스 내용 해시와 모델이 모두 같을 때만 재사용하므로 모델이 바뀌면 같은 소스도 다시 리뷰합니다. 모델 metadata가 없는 기존 댓글은 한 번 cache miss가 됩니다.

첫 두 상태 배지는 `deepseek-status-check.yml` 워크플로우가 매시간 실행되어 `status-data` 브랜치에 기록한 게이트웨이와 DeepSeek probe 결과입니다. 특히 DeepSeek 배지는 MiMo 또는 Qwen fallback의 상태나 사용 가능 여부를 의미하지 않습니다. 워크플로우 실행이 초록색이면 두 probe의 측정과 `status-data` 게시가 모두 성공했다는 뜻이며, 각 API 배지는 해당 서비스의 측정 결과를 표시합니다. GitHub Actions - OpenCode Review 배지는 이와 별개로 리뷰 워크플로우 실행 결과를 나타냅니다. 공개 저장소에서 기본 브랜치 커밋이 60일 이상 없으면 GitHub가 예약 workflow를 중지할 수 있습니다. GitHub Pages 배포 URL: `https://whoisyourbias.github.io/leetdash/`.

## 제출 규칙

풀이 폴더는 반드시 아래 소스별 규칙을 따릅니다. `slug`나 LeetCode 내부 ID는 참가자 폴더명으로 쓰지 않습니다.

| 소스 | `sourceKey` | `submissionKey` 기준 | 예시 경로 |
| --- | --- | --- | --- |
| Top Interview Questions Easy | `top-interview-easy` | 문제 고유 LeetCode 번호 | `submissions/<githubUsername>/top-interview-easy/66/solution.ts` |
| LeetCode 75 | `leetcode-75` | 문제 제목 앞 LeetCode 번호 | `submissions/<githubUsername>/leetcode-75/1768/solution.ts` |
| Top Interview 150 | `top-interview-150` | 문제 제목 앞 LeetCode 번호 | `submissions/<githubUsername>/top-interview-150/88/solution.ts` |
| LeetCode | `leetcode` | 문제 고유 LeetCode 번호 | `submissions/<githubUsername>/leetcode/1/solution.ts` |
| Programmers | `programmers` | 프로그래머스 문제 번호 | `submissions/<githubUsername>/programmers/12906/solution.java` |
| 프로그래머스 고득점 Kit | `programmers-high-score-kit` | 프로그래머스 문제 번호 | `submissions/<githubUsername>/programmers-high-score-kit/42576/solution.java` |
| SWEA | `swea` | SWEA 문제 번호 | `submissions/<githubUsername>/swea/1206/solution.py` |

예를 들어 `https://leetcode.com/problems/plus-one/description/`의 `Plus One`은 LeetCode 문제 번호가 `66`이므로 제출 키도 `66`입니다. Explore URL의 마지막 숫자는 제출 키로 쓰지 않습니다. `1768. Merge Strings Alternately`는 `1768`, `88. Merge Sorted Array`는 `88`입니다.

소규모 LeetCode 스터디 그룹을 위한 진행 현황 대시보드입니다. 참가자는 이 레포를 Fork한 뒤 자신의 Fork에서 작업 브랜치를 만들어 풀이를 추가합니다. 변경 사항이 PR로 원본 레포의 `master`에 머지되고 사이트가 다시 빌드되면 공식 대시보드가 갱신됩니다.

## 운영 방식

1. GitHub에서 이 원본 레포를 본인 계정으로 Fork합니다.
2. Fork한 레포를 clone하고, Fork의 기본 브랜치에서 별도의 작업 브랜치를 만들어 checkout합니다.
3. 풀이를 `submissions/<githubUsername>/<sourceKey>/<submissionKey>/` 아래에 추가하고 커밋합니다.
4. 작업 브랜치를 본인의 Fork에 push합니다.
5. `본인 Fork:작업 브랜치`에서 `원본 레포:master`를 대상으로 PR을 만듭니다.
6. GitHub Actions가 검증과 정적 빌드를 실행하고, 제출 전용 PR의 `solution.*` 파일을 찰싹봇이 리뷰합니다.
7. PR이 `master`에 머지되면 GitHub Pages에 대시보드가 배포됩니다.

- 참가자는 Fork의 master에 직접 커밋하지 않고 매 작업마다 새 브랜치를 사용합니다. 
- 원본 레포에 참가자 브랜치를 만들거나 직접 push하지 않습니다. 
- PR에 충돌이 있을 때만 원본 레포의 최신 `master`를 본인의 작업 브랜치에 반영해 해결합니다.

공개 페이지에는 `master`에 머지된 제출만 반영됩니다. 개인 브랜치는 직접 스캔하지 않습니다.

제출 대상이 `data/problem-catalog.json`에 아직 없으면 운영자가 카탈로그 변경 PR을 먼저 머지합니다. 단, SWEA는 사용자가 만든 문제가 수시로 추가되므로 숫자형 문제 번호를 즉시 제출할 수 있습니다. 미등록 SWEA 문제는 제출의 `meta.json` 문제 스냅샷을 사용해 빌드 시 카탈로그에 합쳐집니다.

PR은 `validate` 검증과 `opencode-review-gate` 상태를 통과하면 다른 PR의 GitHub Pages 배포 완료를 기다리지 않고 머지합니다. `opencode-review` Check Run은 상세 리뷰 기록으로 남고, 병합 gate는 최신 OpenCode workflow 실행 및 재시도 번호와 정확히 일치해야 합니다. 찰싹봇은 변경된 `solution.*` 파일을 하나씩 순서대로 리뷰하고, 각 OpenCode 응답 직후 사용 모델 metadata를 포함한 한국어 코멘트를 게시합니다. 각 파일 리뷰의 파일 경로는 리뷰한 head 커밋의 전체 소스 파일로 연결됩니다. 이전에 성공적으로 리뷰한 파일은 내용 해시와 사용 모델이 모두 같을 때만 유지합니다. 파일 하나의 리뷰나 코멘트 전달이 실패해도 경고를 남기고 다음 파일을 계속 처리하지만, 해당 gate는 실패하므로 sweep이 PR을 머지하지 않습니다. 세부 동작과 장애 복구 방식은 [Sweep After OpenCode Review 설계](docs/superpowers/specs/2026-07-23-sweep-after-opencode-review-design.md)에 정리되어 있습니다.

저장소는 merge commit만 허용하며, squash merge와 rebase merge는 사용하지 않습니다.

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
      66/
        solution.ts
        README.md
        meta.json
    leetcode-75/
      1768/
        solution.ts
    top-interview-150/
      88/
        solution.py
    leetcode/
      1/
        solution.ts
    programmers/
      12906/
        solution.java
    programmers-high-score-kit/
      42576/
        solution.java
    swea/
      1206/
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

같은 문제가 여러 목록에 들어 있는 경우 canonical `problemKey` 기준으로 한 문제로 집계합니다. 여러 제출이 있으면 `solved`, `reviewing`, `skipped` 순서로 더 높은 상태를 우선합니다.

## 문제 카탈로그

문제 카탈로그는 `data/problem-catalog.json`에 체크인되어 있습니다. 앱은 런타임에 LeetCode를 크롤링하지 않습니다.

추적하는 목록:

- Top Interview Questions Easy
- LeetCode 75
- Top Interview 150
- LeetCode
- Programmers
- 프로그래머스 고득점 Kit
- SWEA

카탈로그에서 각 목록의 `items[].submissionKey`가 실제 제출 폴더명입니다. LeetCode 목록은 LeetCode 문제 번호를 사용하며, Top Interview Questions Easy도 Explore URL 마지막 숫자가 아니라 문제 고유 LeetCode 번호를 사용합니다. Programmers, 프로그래머스 고득점 Kit, SWEA는 각 플랫폼의 문제 번호를 사용합니다.

카탈로그에 아직 없는 SWEA 문제는 `submissions/<githubUsername>/swea/<1~8자리 문제번호>/` 경로로 제출할 수 있습니다. 확장 프로그램은 다음 형태의 문제 스냅샷을 `meta.json`에 함께 기록합니다. 스냅샷이 없는 수동 제출도 허용되며 이 경우 제목은 `SWEA <문제번호>`, 난이도는 `Unknown`으로 표시됩니다. 정적 카탈로그에 같은 문제가 추가되면 정적 정보가 우선합니다.

```json
{
  "status": "solved",
  "language": "Java",
  "solvedAt": "2026-08-23T12:00:00.000Z",
  "problem": {
    "provider": "swea",
    "problemId": "12345678",
    "title": "사용자 정의 문제",
    "difficulty": "Unknown",
    "sourceUrl": "https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=..."
  }
}
```

카탈로그 재생성은 운영자가 문제 목록 자체를 다시 만들 때만 사용합니다. 일반 참가자는 이 명령을 실행할 필요가 없습니다.

입력 파일은 임의의 README가 아니라, `scripts/build-catalog.mjs`가 파싱할 수 있는 문제 목록 Markdown이어야 합니다. 현재는 `honood/leetcode` README처럼 `## [LeetCode 75]`, `## [Top Interview 150]` 섹션과 문제 링크 표기가 들어 있는 형식을 기준으로 합니다.

```bash
npm run catalog:build -- /path/to/source-readme.md
```

SWEA 목록만 최신화하려면 다른 공급자 목록을 유지하는 전용 명령을 사용합니다.

```bash
npm run catalog:build:swea
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

## 미풀이 사용자 알림

`.github/workflows/inactive-reminders.yml`은 매일 오전 9시(Asia/Seoul)에 실행되어 고정 GitHub Issue에 미풀이 사용자를 멘션합니다. 알림 대상은 `data/users.json`에 `active: true`가 명시되어 있고 풀이 이력이 있는 사용자입니다. 마지막 풀이 후 3일째, 7일째, 이후 7일마다 알립니다. 아직 병합되지 않은 열린 PR의 풀이도 최근 활동으로 계산합니다.

운영자는 알림용 Issue를 하나 만든 뒤 저장소의 `Settings > Secrets and variables > Actions > Variables`에서 `REMINDER_ISSUE_NUMBER`를 해당 Issue 번호로 등록합니다. 같은 날짜의 workflow를 재실행해도 관리 마커를 확인하여 댓글을 중복 작성하지 않습니다. 수동 검증은 Actions의 `Inactive User Reminders` workflow에서 `Run workflow`로 실행합니다.

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

### Submission sweep 병합 토큰

`.github/workflows/sweep-submission-prs.yml`은 저장소 Actions secret인 `SWEEP_MERGE_TOKEN`만 병합 자격증명으로 사용합니다. Fork가 오래되어 원본의 workflow 변경까지 병합 diff에 포함되는 경우에도 동작하도록, 이 secret에는 workflow 파일을 갱신할 수 있는 전용 fine-grained personal access token을 저장해야 합니다. 기본 `GITHUB_TOKEN`은 이 권한 오류의 fallback으로 사용하지 않습니다.

토큰은 다음 범위로 발급합니다.

- Resource owner: `whoisyourbias`
- Repository access: `Only select repositories` → `leetdash`
- Expiration: 90일
- Repository permissions:
  - Actions: Read and write
  - Commit statuses: Read-only
  - Contents: Read and write
  - Pull requests: Read-only
  - Workflows: Read and write
- Account permissions: 없음

`Checks`가 fine-grained PAT 화면에 표시되지 않아도 추가하지 않습니다. 이 저장소는 public이므로 sweep이 사용하는 Check Runs 조회 API는 해당 권한 없이 사용할 수 있습니다.

토큰 값을 명령 인자, 셸 히스토리, 로그, 이슈 또는 PR에 남기지 않습니다. 발급 직후 아래 명령을 실행하고 숨김 입력 프롬프트에 토큰을 붙여 넣습니다.

```bash
gh secret set SWEEP_MERGE_TOKEN --repo whoisyourbias/leetdash
```

교체 후에는 secret 갱신 시각을 확인하고 sweep workflow를 수동 실행합니다.

```bash
gh secret list --app actions --repo whoisyourbias/leetdash
gh workflow run sweep-submission-prs.yml --repo whoisyourbias/leetdash
gh run list --workflow sweep-submission-prs.yml --repo whoisyourbias/leetdash --limit 3
```

새 토큰으로 sweep 성공을 확인하기 전에는 기존 토큰을 폐기하지 않습니다. 실패하면 실행 로그의 HTTP status, GitHub request ID, rate-limit 헤더를 기록하고 새 토큰의 저장소 선택과 권한을 다시 확인합니다. 성공 후에는 GitHub의 Personal access tokens 설정에서 이전 토큰만 폐기하고, 다음 만료일 전에 같은 절차로 교체합니다.

## 문제 풀이 비교

프로필의 문제 행에서 비교 화면으로 이동하는 흐름과, 비교 화면이 풀이 소스와 리뷰를 불러오는 방식을 설명합니다.

### 프로필에서 비교 화면으로

어떤 사용자의 프로필이든 해당 문제에 커뮤니티 풀이(현재 풀이 파일)가 하나 이상 있으면 문제 제목과 비교 액션 버튼이 비교 화면으로 연결됩니다. `?user=`에는 해당 프로필의 사용자 ID가 들어갑니다. 내 프로필과 다른 사용자의 프로필 모두 동일하게 동작하며, 요청된 사용자가 그 문제를 풀지 않았어도 연결은 유지됩니다. 커뮤니티 풀이가 없는 문제에는 비교 링크가 나타나지 않고 기존 문제 링크와 GitHub 링크만 남습니다.

### 비교 화면 `/problems/[provider]/[problemId]/?user=<id>`

- 이 경로는 풀이가 하나 이상 존재하는 카탈로그 문제에만 생성됩니다. 현재 체크인 데이터 기준 19개이며, 그 외 경로는 404입니다.
- `?user=`가 가리키는 등록 사용자는 풀이 여부와 무관하게 선택 상태를 유지합니다. 풀지 않은 사용자면 "아직 풀지 않은 문제"로 표시하고 같은 화면에서 다른 풀이자를 고를 수 있습니다. 다른 사용자로 자동 전환하지 않습니다.
- `?user=`가 없으면 첫 번째 풀이자가 선택됩니다. 등록되지 않은 사용자 ID면 알 수 없는 사용자 안내가 표시됩니다.
- 풀이자 목록은 표시 이름 순서이며 상태, 언어, 리뷰 유무를 함께 보여줍니다.

### 지연 로딩과 메타데이터 전용 규칙

빌드 산출물에는 풀이 소스 본문이 들어가지 않습니다. 초기 라우트 HTML/JS, `data/progress.json`, 리뷰 JSON 어디에도 소스 코드 본문은 포함되지 않으며, 제출 레코드는 중앙 저장소, 커밋, 원시 URL, permalink, 경로 해시, 내용 해시만 담는 메타데이터입니다. 리뷰 본문도 초기 라우트 HTML/JS에는 포함되지 않고, 풀이자를 선택한 뒤 분할 리뷰 JSON을 지연 로딩합니다.

브라우저는 GitHub 토큰을 받지 않습니다. 풀이자를 선택한 뒤에야 `raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>`에서 소스 파일을 지연 로딩합니다. 소스는 256 KiB 제한과 SHA-256 내용 검증을 거치며, 검증된 내용만 20개짜리 FIFO 메모리 캐시에 보관합니다. 검증 실패, 크기 초과, 404 같은 실패는 캐시하지 않고 오류 상태를 표시하며 커밋 고정 permalink를 대안으로 제공합니다.

소스 URL은 배포된 master 커밋 SHA에 고정됩니다. 참가자 fork의 가변 브랜치를 읽지 않습니다.

### 리뷰 생애주기

리뷰의 원본(source of truth)은 GitHub 저장소의 이슈 코멘트입니다. master 배포 workflow가 `github-actions[bot]` 로그인의 코멘트 중 현재 경로/내용 해시와 정확히 일치하는 리뷰만 골라 `public/generated/reviews/<pathKey>/<contentKey>.json` 분할 에셋과 `index.json`을 생성합니다. 분할 리뷰 JSON에는 살균된 일반 텍스트 리뷰(`text`), 줄 참조(`lineReferences`), 각 단일 줄·범위 리뷰를 해당 줄 참조와 묶은 항목(`reviews`)이 들어 있습니다. 리뷰 텍스트는 HTML이나 Markdown이 아니라 React 텍스트 노드로만 렌더링됩니다. 생성 에셋은 매 배포마다 새로 만들어지므로 언제든 삭제해도 됩니다. 원본 코멘트는 그대로 유지됩니다.

`index.json`의 상태:

- `complete`: 동기화 성공. `keys`에 현재 복합 해시 목록이 들어 있습니다. 현재 복합 키가 없으면 해당 풀이에는 현재 리뷰가 없는 것입니다("리뷰 없음").
- `unavailable`: 배포 시점 동기화 실패(자격증명 누락, rate limit, 네트워크 오류 등). 리뷰가 없다는 뜻이 아니라 동기화가 되지 않았다는 뜻입니다. 배포는 계속 진행되고 사이트에는 "리뷰 동기화 불가" 상태가 표시되며 다음 성공 배포 후 갱신됩니다.

### 로컬 빌드

`npm run build`는 로컬에서 GitHub 토큰 없이 진행 데이터 생성(`build:data`)과 정적 빌드(`build:site`)만 실행합니다. 리뷰 동기화는 실행하지 않습니다.

- `SOURCE_REVISION`이 40자리 16진수 SHA로 주어지지 않으면 제출 메타데이터에서 지연 로딩 URL 필드가 생략됩니다. 빌드는 실패하지 않습니다. master 배포는 `SOURCE_REVISION=${{ github.sha }}`로 고정합니다.
- 로컬에서 `npm run reviews:sync`를 실행하면 자격증명이 없어 네트워크 호출 없이 `unavailable`(`credentials_missing`) `index.json`만 생성하고 종료 코드 0으로 끝납니다.

### 배포 동작과 권한

PR 빌드는 `typecheck`, `test`, `build`까지이며 토큰 없이 실행되고 리뷰 동기화를 하지 않습니다. master push와 workflow_dispatch는 데이터 생성 → 리뷰 동기화 → 사이트 빌드 순서로 진행됩니다.

- 리뷰 동기화는 `GET /repos/{owner}/{repo}/issues/comments`를 최대 20페이지/2,000개 코멘트까지 읽습니다.
- validate job 권한은 `contents: read`, `issues: read` 최소 권한입니다. GitHub token은 리뷰 동기화 스텝에만 노출됩니다.
- 동기화 실패는 안전하게 처리됩니다. `index.json`에는 reason 코드만 남고 HTTP 상태나 요청 ID는 넣지 않습니다. workflow 경고 한 줄에만 `http_status`와 `request_id`가 남습니다. 종료 코드 0으로 배포는 계속됩니다.

### 운영 확인

토큰이나 코멘트 본문을 출력하지 않는 방법으로 동기화 상태를 확인합니다.

```bash
cat public/generated/reviews/index.json
```

`index.json`은 상태, reason, 카운트, 복합 키만 담고 코멘트 본문이나 토큰을 포함하지 않습니다. 배포 상태는 workflow 실행 목록으로 확인합니다.

```bash
gh run list --workflow deploy-pages.yml --repo whoisyourbias/leetdash
gh run view <run-id> --repo whoisyourbias/leetdash
```

동기화 실패 시 workflow 로그의 sync 스텝에는 reason과 `http_status`, `request_id`만 나타나며 토큰이나 리뷰 본문은 출력되지 않습니다. 로컬에서 `npm run reviews:sync`를 실행해 자격증명 없이 동기화 동작을 안전하게 점검할 수도 있습니다.

## 라우트

- `/`: 대시보드 요약과 사용자별 진행 테이블
- `/admin`: 참가자 등록 현황과 Git 운영 안내
- `/users/[userId]`: 사용자별 문제 진행 현황
- `/lists/[listKey]`: 문제 목록별 랭킹
- `/problems/[provider]/[problemId]`: 문제 풀이 비교 화면. `?user=<id>`로 프로필 사용자를 선택하며, 풀이가 있는 문제만 생성됩니다.

## 검증

```bash
npm run progress:build
npm run typecheck
npm test
npm run build
```

현재 테스트 범위:

- 카탈로그 목록 개수, provider-scoped `problemKey` 매핑, 제출 키 형식과 중복 검증
- 소스별 제출 폴더 기반 정적 진행 데이터 생성
- 풀이 파일 기본 판정과 `meta.json` 상태 재정의
- 예전 `solutions/<id>/` 및 slug 제출 폴더 무시
- 신뢰된 OpenCode 리뷰 범위, 상태 gate 수명주기, workflow 실행·재시도 상관관계
- 병합 직전 재검증, 개별 병합 실패 후 계속 스캔, 요약 작성 뒤 비정상 종료
- 풀이 비교 라우트 파라미터, 지연 로딩/해시 검증/캐시, 리뷰 동기화 split 에셋 생성과 실패 폴백
