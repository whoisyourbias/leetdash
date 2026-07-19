import Link from "next/link";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { formatDateKey } from "@/lib/format";
import { getGithubProfileUrl } from "@/lib/github";
import type { UserDashboardRow } from "@/lib/progress";

export function DashboardActivityPanel({ users }: { users: UserDashboardRow[] }) {
  return (
    <section className="panel activity-panel" aria-labelledby="activity-title">
      <div className="panel-header">
        <div>
          <h2 id="activity-title">활동 달력</h2>
          <p className="panel-subtitle">최근 35일 동안 master에 추가된 풀이를 사용자별로 표시합니다</p>
        </div>
      </div>
      {users.length === 0 ? (
        <div className="empty">아직 등록된 활성 사용자가 없습니다. data/users.json에 참가자를 추가하세요.</div>
      ) : (
        <div className="activity-user-list">
          {users.map((user) => (
            <div className="activity-user-row" key={user.id}>
              <div className="user-cell">
                <Link className="user-name" href={`/users/${user.id}`}>
                  {user.displayName}
                </Link>
                <a
                  className="muted mono github-link"
                  href={getGithubProfileUrl(user.githubUsername)}
                  target="_blank"
                  rel="noreferrer"
                >
                  @{user.githubUsername}
                </a>
              </div>
              <ActivityCalendar calendar={user.activityCalendar} label={`${user.displayName} 최근 35일 활동`} />
              <div className="activity-summary">
                <span>
                  최근 35일 <strong>{user.solvedLast35Days}</strong>개
                </span>
                <span>최근 활동 {formatDateKey(user.activityCalendar.lastActiveDate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
