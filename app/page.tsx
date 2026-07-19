import Link from "next/link";
import { Users } from "lucide-react";
import { catalog } from "@/lib/catalog";
import { formatDateTime, formatPercent } from "@/lib/format";
import { getDashboardData } from "@/lib/progress";

function ProgressCell({ title, solved, total, percent }: { title: string; solved: number; total: number; percent: number }) {
  return (
    <div className="progress-cell">
      <div className="progress-meta">
        <Link className="problem-link" href={`/lists/${catalog.lists.find((list) => list.title === title)?.key ?? ""}`}>
          {title}
        </Link>
        <span className="mono">
          {solved}/{total}
        </span>
      </div>
      <div className="bar" aria-label={`${title} ${formatPercent(percent)} complete`}>
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
          <p className="eyebrow">Master branch snapshot</p>
          <h1>Study progress dashboard</h1>
          <p className="lede">
            Tracks checked-in submissions from this repository. Progress updates when changes land on master and the
            site rebuilds.
          </p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Summary">
        <div className="stat">
          <div className="stat-label">Active users</div>
          <div className="stat-value">{data.totals.users}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tracked lists</div>
          <div className="stat-value">{data.totals.lists}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Unique problems</div>
          <div className="stat-value">{data.totals.uniqueProblems}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Snapshot</div>
          <div className="stat-value snapshot-value">{formatDateTime(data.generatedAt)}</div>
        </div>
      </section>

      <section className="list-grid" aria-label="List averages">
        {data.listAverages.map((list) => (
          <Link className="list-card" href={`/lists/${list.key}`} key={list.key}>
            <h3>{list.title}</h3>
            <div className="progress-meta">
              <span className="muted">Average completion</span>
              <strong>{formatPercent(list.average)}</strong>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.min(list.average, 100)}%` }} />
            </div>
          </Link>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Users</h2>
            <p className="panel-subtitle">One row per active participant folder on master</p>
          </div>
          <Link className="button" href="/admin">
            <Users size={16} aria-hidden="true" />
            Participants
          </Link>
        </div>
        {data.users.length === 0 ? (
          <div className="empty">No active users registered yet. Add participants in data/users.json.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  {catalog.lists.map((list) => (
                    <th key={list.key}>{list.title}</th>
                  ))}
                  <th>Recent solve</th>
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
