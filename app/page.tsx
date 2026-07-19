import Link from "next/link";
import { Users } from "lucide-react";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { catalog } from "@/lib/catalog";
import { formatDateKey, formatDateTime, formatPercent } from "@/lib/format";
import { formatCatalogListTitle } from "@/lib/i18n";
import { getDashboardData } from "@/lib/progress";

function ProgressCell({
  listKey,
  title,
  solved,
  total,
  percent,
}: {
  listKey: string;
  title: string;
  solved: number;
  total: number;
  percent: number;
}) {
  const displayTitle = formatCatalogListTitle(title);

  return (
    <div className="progress-cell">
      <div className="progress-meta">
        <Link className="problem-link" href={`/lists/${listKey}`}>
          {displayTitle}
        </Link>
        <span className="mono">
          {solved}/{total}
        </span>
      </div>
      <div className="bar" aria-label={`${displayTitle} ${formatPercent(percent)} 완료`}>
        <div className="bar-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">master 브랜치 스냅샷</p>
          <h1>스터디 진행 현황 대시보드</h1>
          <p className="lede">
            이 저장소에 체크인된 풀이 제출물을 추적합니다. 변경 사항이 master에 병합되고 사이트가 다시 빌드되면
            진행 현황이 업데이트됩니다.
          </p>
        </div>
      </div>

      <section className="stats-grid" aria-label="요약">
        <div className="stat">
          <div className="stat-label">활성 사용자</div>
          <div className="stat-value">{data.totals.users}</div>
        </div>
        <div className="stat">
          <div className="stat-label">추적 목록</div>
          <div className="stat-value">{data.totals.lists}</div>
        </div>
        <div className="stat">
          <div className="stat-label">고유 문제</div>
          <div className="stat-value">{data.totals.uniqueProblems}</div>
        </div>
        <div className="stat">
          <div className="stat-label">스냅샷</div>
          <div className="stat-value snapshot-value">{formatDateTime(data.generatedAt)}</div>
        </div>
      </section>

      <section className="list-grid" aria-label="목록 평균">
        {data.listAverages.map((list) => (
          <Link className="list-card" href={`/lists/${list.key}`} key={list.key}>
            <h3>{formatCatalogListTitle(list.title)}</h3>
            <div className="progress-meta">
              <span className="muted">평균 완료율</span>
              <strong>{formatPercent(list.average)}</strong>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.min(list.average, 100)}%` }} />
            </div>
          </Link>
        ))}
      </section>

      <section className="panel activity-panel" aria-labelledby="activity-title">
        <div className="panel-header">
          <div>
            <h2 id="activity-title">활동 달력</h2>
            <p className="panel-subtitle">최근 35일 동안 master에 추가된 풀이를 사용자별로 표시합니다</p>
          </div>
        </div>
        {data.users.length === 0 ? (
          <div className="empty">아직 등록된 활성 사용자가 없습니다. data/users.json에 참가자를 추가하세요.</div>
        ) : (
          <div className="activity-user-list">
            {data.users.map((user) => (
              <div className="activity-user-row" key={user.id}>
                <div className="user-cell">
                  <Link className="user-name" href={`/users/${user.id}`}>
                    {user.displayName}
                  </Link>
                  <span className="muted mono">@{user.githubUsername}</span>
                </div>
                <ActivityCalendar calendar={user.activityCalendar} label={`${user.displayName} 최근 35일 활동`} />
                <div className="activity-summary">
                  <span>
                    최근 35일 <strong>{user.activityCalendar.totalSolved}</strong>개
                  </span>
                  <span>최근 활동 {formatDateKey(user.activityCalendar.lastActiveDate)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>사용자</h2>
            <p className="panel-subtitle">master의 활성 참가자 폴더마다 한 행씩 표시합니다</p>
          </div>
          <Link className="button" href="/admin">
            <Users size={16} aria-hidden="true" />
            참가자
          </Link>
        </div>
        {data.users.length === 0 ? (
          <div className="empty">아직 등록된 활성 사용자가 없습니다. data/users.json에 참가자를 추가하세요.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>사용자</th>
                  {catalog.lists.map((list) => (
                    <th key={list.key}>{formatCatalogListTitle(list.title)}</th>
                  ))}
                  <th>최근 풀이</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="user-cell">
                      <Link className="user-name" href={`/users/${user.id}`}>
                        {user.displayName}
                      </Link>
                      <span className="muted mono">@{user.githubUsername}</span>
                    </td>
                    {user.progress.map((progress) => (
                      <td key={progress.key}>
                        <ProgressCell
                          listKey={progress.key}
                          title={progress.title}
                          solved={progress.solved}
                          total={progress.total}
                          percent={progress.percent}
                        />
                      </td>
                    ))}
                    <td>{formatDateTime(user.recentSolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
