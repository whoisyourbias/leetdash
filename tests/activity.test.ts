import { describe, expect, it } from "vitest";
import { buildActivityCalendar, getSeoulDateKey } from "@/lib/activity";
import type { ActivityDay } from "@/lib/types";

const submissions = [{ problemKey: "leetcode:1", sourceKey: "top-interview-easy", submissionKey: "1" }];

describe("activity calendar helpers", () => {
  it("converts timestamps to Asia/Seoul date keys", () => {
    expect(getSeoulDateKey("2026-07-17T15:30:00.000Z")).toBe("2026-07-18");
  });

  it("builds a fixed calendar window with totals, intensity, and last active date", () => {
    const activity: ActivityDay[] = [
      { date: "2026-07-16", solved: 5, submissions },
      { date: "2026-07-17", solved: 1, submissions },
      { date: "2026-07-18", solved: 2, submissions },
    ];

    const calendar = buildActivityCalendar(activity, 3, "2026-07-19T12:00:00+09:00");

    expect(calendar.days.map((day) => day.date)).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
    expect(calendar.days.map((day) => day.solved)).toEqual([1, 2, 0]);
    expect(calendar.days.map((day) => day.intensity)).toEqual([2, 4, 0]);
    expect(calendar.totalSolved).toBe(3);
    expect(calendar.maxSolved).toBe(2);
    expect(calendar.lastActiveDate).toBe("2026-07-18");
  });

  it("keeps last active date even when the last activity is outside the visible window", () => {
    const activity: ActivityDay[] = [{ date: "2026-07-10", solved: 1, submissions }];

    const calendar = buildActivityCalendar(activity, 3, "2026-07-19T12:00:00+09:00");

    expect(calendar.days.map((day) => day.solved)).toEqual([0, 0, 0]);
    expect(calendar.totalSolved).toBe(0);
    expect(calendar.maxSolved).toBe(0);
    expect(calendar.lastActiveDate).toBe("2026-07-10");
  });
});
