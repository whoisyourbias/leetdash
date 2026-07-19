import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getProblemLeetCodeUrl } from "@/lib/catalog";
import { difficultyLabel, formatDate, formatDateTime, formatPercent, statusLabel } from "@/lib/format";
import { getUserDetail, listStaticUsers } from "@/lib/progress";

export const dynamicParams = false;

export async function generateStaticParams() {
  const users = await listStaticUsers();
  return users.map((user) => ({ userId: user.id }));
}

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const detail = await getUserDetail(userId);
  if (!detail) {
    notFound();
  }

  const { user, lists } = detail;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">@{user.githubUsername}</p>
          <h1>{user.displayName}</h1>
          <p className="lede">
            Submissions are read from <span className="mono">{user.submissionsPath}</span> on the master branch
            snapshot.
          </p>
        </div>
      </div>

      <section className="list-grid" aria-label="User progress">
        {lists.map((list) => (
          <Link className="list-card" href={`/lists/${list.key}`} key={list.key}>
            <h3>{list.title}</h3>
            <div className="progress-meta">
              <span className="muted">
                {list.progress.solved}/{list.progress.total} solved
              </span>
              <strong>{formatPercent(list.progress.percent)}</strong>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.min(list.progress.percent, 100)}%` }} />
            </div>
          </Link>
        ))}
      </section>

      {lists.map((list) => (
        <section className="panel" key={list.key}>
          <div className="panel-header">
            <div>
              <h2>{list.title}</h2>
              <p className="panel-subtitle">
                {list.progress.solved} solved, {list.progress.reviewing} reviewing, {list.progress.skipped} skipped
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Problem</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th>Language</th>
                  <th>Solved at</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={`${list.key}-${item.slug}`}>
                    <td className="mono">{item.order}</td>
                    <td>
                      <div className="problem-title">{item.problem.title}</div>
                      <div className="muted mono">{item.section}</div>
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
                        <span className="badge neutral">not started</span>
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
