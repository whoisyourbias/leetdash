import type { SubmissionStatus } from "@/lib/types";

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "없음";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateKey(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+09:00`));
}

export function statusLabel(status: SubmissionStatus | string) {
  const labels: Record<string, string> = {
    SOLVED: "풀이 완료",
    REVIEWING: "검토 중",
    SKIPPED: "건너뜀",
  };

  return labels[status.toUpperCase()] ?? status.toLowerCase().replace("_", " ");
}

export function difficultyLabel(value: string) {
  const labels: Record<string, string> = {
    easy: "쉬움",
    medium: "보통",
    hard: "어려움",
  };

  return labels[value.toLowerCase()] ?? value;
}
