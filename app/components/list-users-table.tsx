"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { type ListUserSortDirection, sortListUsersByProgress } from "@/lib/list-users";
import { formatPercent } from "@/lib/format";
import { getGithubProfileUrl } from "@/lib/github";
import type { ListProgress } from "@/lib/progress";

export type ListUsersTableUser = {
  id: string;
  displayName: string;
  githubUsername: string;
  progress: ListProgress;
};

export function ListUsersTable({ users }: { users: ListUsersTableUser[] }) {
  const [direction, setDirection] = useState<ListUserSortDirection>("desc");
  const sortedUsers = useMemo(() => sortListUsersByProgress(users, direction), [direction, users]);
  const Icon = direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>순위</th>
            <th>사용자</th>
            <th>
              <button
                aria-label="진행률 기준 정렬"
                className="table-sort-button"
                onClick={() => setDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"))}
                type="button"
              >
                <span>진행률</span>
                <Icon size={14} aria-hidden="true" />
              </button>
            </th>
            <th>검토 중</th>
            <th>건너뜀</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user, index) => (
            <tr key={user.id}>
              <td className="mono">{index + 1}</td>
              <td className="user-cell">
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
  );
}
