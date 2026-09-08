import type { Metadata } from "next";
import { ExternalLink, GitFork, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "개인정보처리방침 | Leetdash Submission Sync",
  description: "Leetdash Submission Sync Chrome 확장 프로그램의 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="page privacy-page">
      <header className="privacy-hero">
        <span className="privacy-hero-icon" aria-hidden="true">
          <ShieldCheck size={26} />
        </span>
        <div>
          <p className="eyebrow">Leetdash Submission Sync</p>
          <h1>개인정보처리방침</h1>
          <p className="lede">
            LeetCode, Programmers, SWEA에서 통과한 풀이를 사용자의 GitHub fork와 중앙 Leetdash 저장소의
            Draft Pull Request로 전송하는 Chrome 확장 프로그램에 적용됩니다.
          </p>
          <p className="privacy-updated">최종 업데이트: 2026년 9월 8일</p>
        </div>
      </header>

      <div className="privacy-content">
        <section aria-labelledby="privacy-data">
          <h2 id="privacy-data">처리하는 데이터</h2>
          <ul>
            <li>GitHub OAuth access token과 refresh token, 각 토큰의 만료 시각, GitHub 로그인 ID와 프로필 이미지 URL</li>
            <li>지원 사이트의 문제 페이지 URL과 제목</li>
            <li>제출 시점의 소스 코드와 선택된 프로그래밍 언어</li>
            <li>Accepted 시각, 동기화 상태, 생성된 Pull Request 주소</li>
          </ul>
          <p>
            확장 프로그램은 광고 식별자, 결제 정보, 사이트 로그인 비밀번호 또는 SWEA 세션 쿠키를 수집하지
            않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-purpose">
          <h2 id="privacy-purpose">이용 목적과 전송 대상</h2>
          <p>
            위 데이터는 사용자를 확인하고 Accepted 풀이를 날짜별 GitHub Draft Pull Request에 누적하기 위해서만
            사용합니다. 사용자 목록과 문제 카탈로그는 중앙 <code>whoisyourbias/leetdash</code> 저장소의
            <code>data/users.json</code>과 <code>data/problem-catalog.json</code>에서 읽으며, GitHub 로그인 ID, 문제
            정보와 소스 코드는 GitHub API를 통해 GitHub로 전송됩니다.
          </p>
          <aside className="privacy-notice">
            <strong>공개 범위를 확인해 주세요.</strong>
            <p>
              중앙 저장소와 사용자 fork가 공개 저장소이므로 동기화된 소스 코드, 커밋과 Pull Request는 인터넷에
              공개됩니다. 사용자는 이 공개 범위를 이해한 뒤 GitHub 로그인을 진행하고 풀이를 제출해야 합니다.
            </p>
          </aside>
          <p>
            LeetCode, Programmers, SWEA 페이지에서 읽은 코드는 Accepted 판정과 GitHub 동기화 이외의 목적으로
            사용하거나 별도의 Leetdash 서버로 전송하지 않습니다. 확장 프로그램은 사용량 분석, 광고 또는 사용자
            추적 서비스를 사용하지 않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">저장과 삭제</h2>
          <ul>
            <li>
              GitHub OAuth access token과 refresh token 및 만료 시각은 <code>chrome.storage.local</code>에
              저장되며 웹 페이지에 노출하지 않습니다. access token은 만료 전에 자동 교체됩니다.
            </li>
            <li>동기화 대기 중인 코드는 로컬 큐에 저장되고 GitHub 업로드가 완료되면 로컬 코드 본문을 제거합니다.</li>
            <li>
              로그아웃하면 인증 정보가 제거됩니다. 자동 갱신이 불가능해 재로그인이 필요한 경우에는 인증 토큰만
              제거하고 미동기화 코드는 보존합니다. 다른 계정 전환을 위해 사용자가 삭제를 확인한 경우에만
              미동기화 코드를 제거합니다.
            </li>
            <li>GitHub에 올라간 커밋과 Pull Request의 보관 및 삭제는 GitHub와 각 저장소의 정책 및 권한을 따릅니다.</li>
            <li>확장 프로그램을 제거하면 Chrome이 해당 확장의 로컬 저장 데이터를 제거합니다.</li>
          </ul>
        </section>

        <section aria-labelledby="privacy-third-parties">
          <h2 id="privacy-third-parties">제3자 서비스</h2>
          <p>
            확장 프로그램은 기능 제공을 위해 GitHub OAuth와 GitHub API를 사용합니다. GitHub에서 처리되는
            데이터에는{" "}
            <a
              className="privacy-link"
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noreferrer"
            >
              GitHub 개인정보처리방침
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            이 적용됩니다.
          </p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">문의</h2>
          <p>데이터 처리 또는 삭제에 관한 문의는 Leetdash GitHub 저장소의 이슈로 남길 수 있습니다.</p>
          <a
            className="button privacy-contact-link"
            href="https://github.com/whoisyourbias/leetdash/issues"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork size={17} aria-hidden="true" />
            GitHub에서 문의하기
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </section>
      </div>
    </div>
  );
}
