import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { getProblemLeetCodeUrl } from "@/lib/catalog";
import { difficultyLabel, formatDate, formatDateKey, formatPercent, statusLabel } from "@/lib/format";
import { formatCatalogListTitle, formatCatalogSection, formatProblemTitle } from "@/lib/i18n";
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">@{user.githubUsername}</p>
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

      {lists.map((list) => (
        <section className="panel" key={list.key}>
          <div className="panel-header">
            <div>
              <h2>{formatCatalogListTitle(list.title)}</h2>
              <p className="panel-subtitle">
                풀이 완료 {list.progress.solved}개, 검토 중 {list.progress.reviewing}개, 건너뜀{" "}
                {list.progress.skipped}개
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>문제</th>
                  <th>난이도</th>
                  <th>상태</th>
                  <th>언어</th>
                  <th>풀이 일시</th>
                  <th>링크</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={`${list.key}-${item.slug}`}>
                    <td className="mono">{item.order}</td>
                    <td>
                      <div className="problem-title">{formatProblemTitle(item.problem.title)}</div>
                      <div className="muted mono">{formatCatalogSection(item.section)}</div>
                    </td>
                    <td>
                      <span className="badge neutral">{difficultyLabel(item.problem.difficulty)}</span>
                    </td>
                    <td>
                      {item.submission ? (
                        <>
                          <span className={`badge ${item.submission.status.toLowerCase()}`}>
                            {statusLabel(item.submission.status)}
                          </span>
                          {item.submission.notes ? <div className="muted">{item.submission.notes}</div> : null}
                        </>
                      ) : (
                        <span className="badge neutral">시작 전</span>
                      )}
                    </td>
                    <td className="mono">{item.submission?.language ?? "-"}</td>
                    <td>{formatDate(item.submission?.solvedAt)}</td>
                    <td>
                      <div className="actions">
                        <a className="button" href={getProblemLeetCodeUrl(item.slug)} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} aria-hidden="true" />
                          LeetCode
                        </a>
                        {item.submission?.githubUrl ? (
                          <a className="button" href={item.submission.githubUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} aria-hidden="true" />
                            GitHub
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

    </div>
  );
}
