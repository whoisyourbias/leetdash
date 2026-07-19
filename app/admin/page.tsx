import { GitBranch, GitMerge, Users } from "lucide-react";
import { getAdminUsers } from "@/lib/progress";

export default async function AdminPage() {
  const users = await getAdminUsers();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Git based operations</p>
          <h1>Participants</h1>
          <p className="lede">
            Add people by editing <span className="mono">data/users.json</span>. Add solutions under{" "}
            <span className="mono">submissions/&lt;githubUsername&gt;/&lt;sourceKey&gt;/&lt;submissionKey&gt;</span>, then
            merge to master to update the published dashboard.
          </p>
        </div>
      </div>

      <section className="list-grid" aria-label="Workflow">
        <div className="list-card">
          <GitBranch size={18} aria-hidden="true" />
          <h3>Create a branch</h3>
          <p className="panel-subtitle">Each participant works in their own branch and folder.</p>
        </div>
        <div className="list-card">
          <GitMerge size={18} aria-hidden="true" />
          <h3>Merge to master</h3>
          <p className="panel-subtitle">Only merged submissions count on the official page.</p>
        </div>
        <div className="list-card">
          <Users size={18} aria-hidden="true" />
          <h3>Rebuild page</h3>
          <p className="panel-subtitle">Netlify rebuilds the static dashboard after master changes.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Registered users</h2>
            <p className="panel-subtitle">Inactive users are retained but excluded from dashboard rankings</p>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="empty">No registered users. Add entries to data/users.json.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Folder</th>
                  <th>Submissions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="user-cell">
                      <div className="user-name">{user.displayName}</div>
                      <span className="muted mono">@{user.githubUsername}</span>
                    </td>
                    <td>
                      <span className={`badge ${user.active ? "success" : "neutral"}`}>{user.active ? "active" : "inactive"}</span>
                    </td>
                    <td>
                      <span className="mono">{user.submissionsPath}</span>
                    </td>
                    <td className="mono">{user._count.submissions}</td>
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
