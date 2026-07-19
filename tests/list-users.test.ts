import { describe, expect, it } from "vitest";
import { sortListUsersByProgress } from "@/lib/list-users";

const users = [
  {
    id: "ada",
    displayName: "Ada Lovelace",
    progress: { percent: 40, solved: 4, total: 10, reviewing: 1, skipped: 0 },
  },
  {
    id: "grace",
    displayName: "Grace Hopper",
    progress: { percent: 70, solved: 7, total: 10, reviewing: 0, skipped: 1 },
  },
  {
    id: "katherine",
    displayName: "Katherine Johnson",
    progress: { percent: 70, solved: 7, total: 10, reviewing: 2, skipped: 0 },
  },
];

describe("list user sorting", () => {
  it("sorts list users by progress descending with a name tie-break", () => {
    expect(sortListUsersByProgress(users, "desc").map((user) => user.id)).toEqual(["grace", "katherine", "ada"]);
  });

  it("sorts list users by progress ascending with a name tie-break", () => {
    expect(sortListUsersByProgress(users, "asc").map((user) => user.id)).toEqual(["ada", "grace", "katherine"]);
  });
});
