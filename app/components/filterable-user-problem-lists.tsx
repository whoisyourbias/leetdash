"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CatalogProblemList } from "@/app/components/catalog-problem-list";
import { difficultyLabel, formatDate, statusLabel } from "@/lib/format";
import { formatCatalogListTitle, formatCatalogSection, formatProblemTitle } from "@/lib/i18n";
import type { CatalogProblem } from "@/lib/catalog";
import type { Submission } from "@/lib/types";

type ListItem = {
  problemKey: string;
  order: number;
  section: string;
  submissionKey: string;
  problem: CatalogProblem;
  submission: Submission | null;
};

type ListData = {
  key: string;
  title: string;
  url: string;
  summary: string[];
  problems: CatalogProblem[];
  items: ListItem[];
  progress: {
    key: string;
    title: string;
    total: number;
    solved: number;
    reviewing: number;
    skipped: number;
    percent: number;
  };
};

type Props = {
  lists: ListData[];
  firstUnsolvedProblemTarget: {
    elementId: string;
    listKey: string;
    problemKey: string;
  } | null;
};

const providerLabels = {
  leetcode: "LeetCode",
  programmers: "Programmers",
  swea: "SWEA",
} as const;

const difficultyOptions = [
  { value: "all", label: "전체" },
  { value: "easy", label: "쉬움" },
  { value: "medium", label: "보통" },
  { value: "hard", label: "어려움" },
] as const;

const statusOptions = [
  { value: "all", label: "전체" },
  { value: "SOLVED", label: "풀이 완료" },
  { value: "REVIEWING", label: "검토 중" },
  { value: "SKIPPED", label: "건너뜀" },
  { value: "UNSOLVED", label: "시작 전" },
] as const;

export function FilterableUserProblemLists({ lists, firstUnsolvedProblemTarget }: Props) {
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const hasActiveFilter = difficultyFilter !== "all" || statusFilter !== "all";

  function matchesFilters(item: ListItem) {
    if (difficultyFilter !== "all" && item.problem.difficulty !== difficultyFilter) {
      return false;
    }

    if (statusFilter === "UNSOLVED") {
      return !item.submission;
    }

    if (statusFilter !== "all") {
      return item.submission?.status === statusFilter;
    }

    return true;
  }

  return (
    <>
      <div className="filter-bar">
        <div className="viewer-control">
          <label className="filter-label" htmlFor="difficulty-filter">
            난이도
          </label>
          <select id="difficulty-filter" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
            {difficultyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="viewer-control">
          <label className="filter-label" htmlFor="status-filter">
            상태
          </label>
          <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilter ? (
          <button className="button" type="button" onClick={() => { setDifficultyFilter("all"); setStatusFilter("all"); }}>
            초기화
          </button>
        ) : null}
      </div>

      {lists.map((list) => {
        const filteredItems = hasActiveFilter ? list.items.filter(matchesFilters) : list.items;
        const subtitleSuffix =
          hasActiveFilter && filteredItems.length !== list.items.length
            ? ` · 필터 ${filteredItems.length}개`
            : "";

        return (
          <CatalogProblemList
            key={list.key}
            title={formatCatalogListTitle(list.title)}
            subtitle={`풀이 완료 ${list.progress.solved}개, 검토 중 ${list.progress.reviewing}개, 건너뜀 ${list.progress.skipped}개${subtitleSuffix}`}
          >
            {filteredItems.length === 0 ? (
              <div className="empty">조건에 맞는 문제가 없습니다</div>
            ) : (
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
                    {filteredItems.map((item) => {
                      const isFirstUnsolvedProblem =
                        firstUnsolvedProblemTarget?.listKey === list.key &&
                        firstUnsolvedProblemTarget.problemKey === item.problemKey;

                      return (
                        <tr
                          className={isFirstUnsolvedProblem ? "problem-row-target" : undefined}
                          id={isFirstUnsolvedProblem ? firstUnsolvedProblemTarget.elementId : undefined}
                          key={`${list.key}-${item.problemKey}`}
                        >
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
                              <a className="button" href={item.problem.sourceUrl} target="_blank" rel="noreferrer">
                                <ExternalLink size={16} aria-hidden="true" />
                                {providerLabels[item.problem.provider]}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CatalogProblemList>
        );
      })}
    </>
  );
}
