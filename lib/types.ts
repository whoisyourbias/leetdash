export const SubmissionStatus = {
  SOLVED: "SOLVED",
  REVIEWING: "REVIEWING",
  SKIPPED: "SKIPPED",
} as const;

export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export type User = {
  id: string;
  displayName: string;
  githubUsername: string;
  active: boolean;
  submissionsPath: string;
};

export type Submission = {
  id: string;
  userId: string;
  problemSlug: string;
  sourceKey: string;
  submissionKey: string;
  status: SubmissionStatus;
  language?: string;
  solvedAt?: string;
  notes?: string;
  solutionPath?: string;
  readmePath?: string;
  githubUrl?: string;
  source: "meta" | "solution-file" | "invalid-meta";
  rawMeta?: unknown;
  generatedAt: string;
};

export type ProgressUser = User & {
  submissions: Submission[];
};

export type ProgressData = {
  generatedAt: string;
  users: ProgressUser[];
};
