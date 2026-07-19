"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Users } from "lucide-react";
import {
  type DashboardUserSortDirection,
  type DashboardUserSortKey,
  getDashboardProgressSortKey,
  sortDashboardUsers,
} from "@/lib/dashboard-users";
import { formatDateTime, formatPercent } from "@/lib/format";
import { getGithubProfileUrl } from "@/lib/github";
import { formatCatalogListTitle } from "@/lib/i18n";
import type { UserDashboardRow } from "@/lib/progress";

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

function UserIdentity({ user }: { user: UserDashboardRow }) {
  return (
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
  );
}

function formatDaysSinceLastSolved(daysSinceLastSolved: number | null) {
  if (daysSinceLastSolved === null) {
    return "없음";
  }

  if (daysSinceLastSolved === 0) {
    return "오늘";
  }

  return `${daysSinceLastSolved}일`;
}

function getActivityStatusBadgeClass(user: UserDashboardRow) {
  if (user.activityStatus === "active") {
    return "success";
  }

  if (user.activityStatus === "watch") {
    return "running";
  }

  return "neutral";
}

function SortButton({
  activeSortKey,
  children,
  direction,
  onSort,
  sortKey,
}: {
  activeSortKey: DashboardUserSortKey;
  children: React.ReactNode;
  direction: DashboardUserSortDirection;
  onSort: (sortKey: DashboardUserSortKey) => void;
  sortKey: DashboardUserSortKey;
}) {
  const isActive = activeSortKey === sortKey;
  const Icon = direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <button
      aria-label={`${children} 기준 정렬`}
      className="table-sort-button"
      onClick={() => onSort(sortKey)}
      type="button"
    >
      <span>{children}</span>
      {isActive ? <Icon size={14} aria-hidden="true" /> : null}
    </button>
  );
}

export function DashboardUsersTable({ users }: { users: UserDashboardRow[] }) {
  const [sortKey, setSortKey] = useState<DashboardUserSortKey>("solvedTotal");
  const [direction, setDirection] = useState<DashboardUserSortDirection>("desc");
  const progressColumns = users[0]?.progress ?? [];
  const sortedUsers = useMemo(() => sortDashboardUsers(users, sortKey, direction), [direction, sortKey, users]);

  function handleSort(nextSortKey: DashboardUserSortKey) {
    if (nextSortKey === sortKey) {
      setDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setDirection("desc");
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>사용자</h2>
          <p className="panel-subtitle">열 제목을 눌러 참가자 진행 현황을 정렬합니다</p>
        </div>
        <Link className="button" href="/admin">
          <Users size={16} aria-hidden="true" />
          참가자
        </Link>
      </div>
      {users.length === 0 ? (
        <div className="empty">아직 등록된 활성 사용자가 없습니다. data/users.json에 참가자를 추가하세요.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>사용자</th>
                <th>
                  <SortButton activeSortKey={sortKey} direction={direction} onSort={handleSort} sortKey="solvedTotal">
                    총 풀이
                  </SortButton>
                </th>
                <th>
                  <SortButton activeSortKey={sortKey} direction={direction} onSort={handleSort} sortKey="solvedLast7Days">
                    최근 7일
                  </SortButton>
                </th>
                <th>
                  <SortButton
                    activeSortKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    sortKey="solvedLast35Days"
                  >
                    최근 35일
                  </SortButton>
                </th>
                <th>
                  <SortButton
                    activeSortKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    sortKey="daysSinceLastSolved"
                  >
                    마지막 풀이 후
                  </SortButton>
                </th>
                <th>
                  <SortButton
                    activeSortKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    sortKey="activityStatusRank"
                  >
                    활동 상태
                  </SortButton>
                </th>
                {progressColumns.map((list) => (
                  <th key={list.key}>
                    <SortButton
                      activeSortKey={sortKey}
                      direction={direction}
                      onSort={handleSort}
                      sortKey={getDashboardProgressSortKey(list.key)}
                    >
                      {formatCatalogListTitle(list.title)}
                    </SortButton>
                  </th>
                ))}
                <th>
                  <SortButton activeSortKey={sortKey} direction={direction} onSort={handleSort} sortKey="recentSolvedAt">
                    최근 풀이
                  </SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <UserIdentity user={user} />
                  </td>
                  <td>
                    <strong>{user.solvedTotal}</strong>
                  </td>
                  <td>
                    <strong>{user.solvedLast7Days}</strong>
                  </td>
                  <td>
                    <strong>{user.solvedLast35Days}</strong>
                  </td>
                  <td>{formatDaysSinceLastSolved(user.daysSinceLastSolved)}</td>
                  <td>
                    <span className={`badge ${getActivityStatusBadgeClass(user)}`}>{user.activityStatusLabel}</span>
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
  );
}
