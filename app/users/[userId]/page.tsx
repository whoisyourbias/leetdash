import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { FilterableUserProblemLists } from "@/app/components/filterable-user-problem-lists";
import { FirstUnsolvedProblemScroller } from "@/app/components/first-unsolved-problem-scroller";
import { formatDateKey, formatPercent } from "@/lib/format";
import { getGithubProfileUrl } from "@/lib/github";
import { formatCatalogListTitle } from "@/lib/i18n";
import { getUserDetail, listStaticUsers } from "@/lib/progress";

export const dynamicParams = false;

export async function generateStaticParams() {
  const users = await listStaticUsers();
  if (users.length === 0) {
    return [{ userId: "__placeholder__" }];
  }

  return users.map((user) => ({ userId: user.id }));
}

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const detail = await getUserDetail(userId);
  if (!detail) {
    notFound();
  }

  const { user, lists, activityCalendar } = detail;
  const { firstUnsolvedProblemTarget } = detail;

  return (
    <div className="page">
      {firstUnsolvedProblemTarget ? (
        <FirstUnsolvedProblemScroller targetId={firstUnsolvedProblemTarget.elementId} />
      ) : null}
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <a href={getGithubProfileUrl(user.githubUsername)} target="_blank" rel="noreferrer">
              @{user.githubUsername}
            </a>
          </p>
          <h1>{user.displayName}</h1>
          <p className="lede">
            제출물은 master 브랜치 스냅샷의 <span className="mono">{user.submissionsPath}</span>에서 읽습니다.
          </p>
        </div>
      </div>

      <section className="list-grid" aria-label="사용자 진행 현황">
        {lists.map((list) => (
          <Link className="list-card" href={`/lists/${list.key}`} key={list.key}>
            <h3>{formatCatalogListTitle(list.title)}</h3>
            <div className="progress-meta">
              <span className="muted">
                {list.progress.solved}/{list.progress.total} 풀이 완료
              </span>
              <strong>{formatPercent(list.progress.percent)}</strong>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.min(list.progress.percent, 100)}%` }} />
            </div>
          </Link>
        ))}
      </section>

      <section className="panel activity-panel" aria-labelledby="user-activity-title">
        <div className="panel-header">
          <div>
            <h2 id="user-activity-title">활동 달력</h2>
            <p className="panel-subtitle">최근 90일 동안 master에 추가된 풀이입니다</p>
          </div>
          <div className="activity-summary compact">
            <span>
              최근 90일 <strong>{activityCalendar.totalSolved}</strong>개
            </span>
            <span>최근 활동 {formatDateKey(activityCalendar.lastActiveDate)}</span>
          </div>
        </div>
        <div className="activity-detail-calendar">
          <ActivityCalendar calendar={activityCalendar} label={`${user.displayName} 최근 90일 활동`} />
        </div>
      </section>

      <FilterableUserProblemLists lists={lists} firstUnsolvedProblemTarget={firstUnsolvedProblemTarget} />

    </div>
  );
}
