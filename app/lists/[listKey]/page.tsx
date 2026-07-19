import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { formatPercent } from "@/lib/format";
import { getListDetail } from "@/lib/progress";

export const dynamicParams = false;

export function generateStaticParams() {
  return catalog.lists.map((list) => ({ listKey: list.key }));
}

export default async function ListDetailPage({ params }: { params: Promise<{ listKey: string }> }) {
  const { listKey } = await params;
  const detail = await getListDetail(listKey);
  if (!detail) {
    notFound();
  }

  const { list, users } = detail;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Problem list</p>
          <h1>{list.title}</h1>
          <p className="lede">
            {list.items.length} ordered problems.{" "}
            <a className="problem-link" href={list.url} target="_blank" rel="noreferrer">
              Open source list
            </a>
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Ranking</h2>
            <p className="panel-subtitle">Sorted by solved percentage</p>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="empty">No active users registered.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Progress</th>
                  <th>Reviewing</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id}>
                    <td className="mono">{index + 1}</td>
                    <td className="user-cell">
                      <Link className="user-name" href={`/users/${user.id}`}>
                        {user.displayName}
                      </Link>
                      <span className="muted mono">@{user.githubUsername}</span>
                    </td>
                    <td className="progress-cell">
                      <div className="progress-meta">
                        <strong>{formatPercent(user.progress.percent)}</strong>
                        <span className="mono">
                          {user.progress.solved}/{user.progress.total}
                        </span>
                      </div>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${Math.min(user.progress.percent, 100)}%` }} />
                      </div>
                    </td>
                    <td className="mono">{user.progress.reviewing}</td>
                    <td className="mono">{user.progress.skipped}</td>
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
