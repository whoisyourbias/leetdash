import type { SubmissionStatus } from "@/lib/types";

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
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
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function statusLabel(status: SubmissionStatus | string) {
  return status.toLowerCase().replace("_", " ");
}

export function difficultyLabel(value: string) {
  return value[0]?.toUpperCase() + value.slice(1);
}
