import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Flame, Users } from "lucide-react";
import { CatalogEntryCta } from "@/app/components/catalog-entry-cta";
import { formatPercent, formatSnapshotDateTime } from "@/lib/format";
import { formatCatalogListTitle } from "@/lib/i18n";
import { getDashboardData } from "@/lib/progress";

export default async function HomePage() {
  const data = await getDashboardData();
  const viewerUsers = data.users.map(({ id, displayName, githubUsername }) => ({ id, displayName, githubUsername }));
  const activeThisWeek = data.users.filter((user) => user.solvedLast7Days > 0).length;
  const averageSolvedPerUser = data.totals.users === 0 ? 0 : Math.round(data.totals.solvedSubmissions / data.totals.users);
  const featuredSubmissions = data.recentSolvedSubmissions.slice(0, 5);

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="eyebrow">함께 풀고, 함께 성장하는 스터디</p>
          <h1 id="home-title">오늘의 한 문제,<br />같이 시작해요</h1>
          <p className="lede">
            먼저 시작한 사람들의 기록을 보며 부담 없이 첫 문제를 풀어 보세요.
            작은 풀이 하나도 스터디의 다음 기록이 됩니다.
          </p>
          <div className="home-actions">
            <CatalogEntryCta className="button primary" href="/catalog/top-interview-easy" users={viewerUsers}>
              첫 문제 시작하기 <ArrowRight size={17} aria-hidden="true" />
            </CatalogEntryCta>
            <Link className="home-secondary-link" href="/statistics">
              전체 통계 보기 <BarChart3 size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="home-hero-note" aria-label="스터디 활동 요약">
          <span className="home-hero-note-icon"><Flame size={20} aria-hidden="true" /></span>
          <strong>{activeThisWeek > 0 ? "이번 주에도 풀이가 이어지고 있어요" : "최근 풀이 기록을 확인해 보세요"}</strong>
          <span>{activeThisWeek > 0 ? `${activeThisWeek}명이 최근 7일 동안 활동했습니다.` : `지금까지 ${data.totals.solvedSubmissions}개의 풀이가 기록되어 있어요.`}</span>
        </div>
      </section>

      <section className="home-stat-grid" aria-label="스터디 전체 통계">
        <div className="home-stat-card">
          <Users size={20} aria-hidden="true" className="home-stat-icon" />
          <span>함께 공부하는 사람</span>
          <strong>{data.totals.users}명</strong>
        </div>
        <div className="home-stat-card">
          <CheckCircle2 size={20} aria-hidden="true" className="home-stat-icon" />
          <span>지금까지 해결한 문제</span>
          <strong>{data.totals.solvedSubmissions}개</strong>
        </div>
        <div className="home-stat-card">
          <Flame size={20} aria-hidden="true" className="home-stat-icon" />
          <span>최근 7일 풀이</span>
          <strong>{data.totals.solvedLast7Days}개</strong>
        </div>
        <div className="home-stat-card">
          <BarChart3 size={20} aria-hidden="true" className="home-stat-icon" />
          <span>전체 평균 완료율</span>
          <strong>{formatPercent(data.totals.overallCompletionPercent)}</strong>
        </div>
      </section>

      <section className="home-section-heading">
        <div>
          <p className="eyebrow">LIVE STUDY FEED</p>
          <h2>다른 사람들의 풀이가 쌓이고 있어요</h2>
          <p className="section-description">평균 {averageSolvedPerUser}개씩 해결하며 함께 만들어 온 기록입니다.</p>
        </div>
        <Link className="text-link" href="/statistics">통계에서 더 보기 <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>

      {featuredSubmissions.length === 0 ? (
        <section className="home-empty panel">
          <CheckCircle2 size={24} aria-hidden="true" className="panel-icon" />
          <h2>첫 번째 풀이를 기다리고 있어요</h2>
          <p>문제 하나를 해결하고 스터디의 첫 기록을 남겨 보세요.</p>
          <CatalogEntryCta className="button primary" href="/catalog/top-interview-easy" users={viewerUsers}>문제 목록 둘러보기</CatalogEntryCta>
        </section>
      ) : (
        <section className="home-feed" aria-label="최근 풀이 피드">
          {featuredSubmissions.map((submission) => (
            <article className="home-feed-item" key={`${submission.userId}:${submission.problemKey}`}>
              <div className="home-feed-marker" aria-hidden="true"><CheckCircle2 size={16} /></div>
              <div className="home-feed-content">
                <p>
                  <Link href={`/users/${submission.userId}`} className="feed-user">{submission.displayName}</Link>님이
                  <span className="feed-action"> {submission.problemTitle}</span>을 해결했습니다.
                </p>
                <span className="feed-meta">
                  {formatCatalogListTitle(submission.listTitle)} · {formatSnapshotDateTime(submission.submittedAt)}
                </span>
              </div>
              {submission.githubUrl ? (
                <a className="feed-link" href={submission.githubUrl} target="_blank" rel="noreferrer" aria-label={`${submission.problemTitle} 풀이 보기`}>
                  풀이 보기 <ArrowRight size={15} aria-hidden="true" />
                </a>
              ) : null}
            </article>
          ))}
        </section>
      )}

      <section className="home-bottom-cta" aria-labelledby="home-cta-title">
        <div>
          <p className="eyebrow">YOUR NEXT STEP</p>
          <h2 id="home-cta-title">당신의 첫 기록도 여기서 시작할 수 있어요.</h2>
          <p>가볍게 한 문제부터 풀고, 다음 활동 피드의 주인공이 되어 보세요.</p>
        </div>
        <CatalogEntryCta className="button primary" href="/catalog/top-interview-easy" users={viewerUsers}>문제 목록 둘러보기 <ArrowRight size={17} aria-hidden="true" /></CatalogEntryCta>
      </section>
    </div>
  );
}
