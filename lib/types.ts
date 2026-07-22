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
  problemKey: string;
  sourceKey: string;
  submissionKey: string;
  status: SubmissionStatus;
  language?: string;
  solvedAt?: string;
  notes?: string;
  solutionPath?: string;
  readmePath?: string;
  githubUrl?: string;
  submittedAt?: string;
  source: "meta" | "solution-file" | "invalid-meta";
  rawMeta?: unknown;
  generatedAt: string;
};

export type ActivitySubmission = {
  problemKey: string;
  sourceKey: string;
  submissionKey: string;
};

export type ActivityDay = {
  date: string;
  solved: number;
  submissions: ActivitySubmission[];
};

export type ProgressUser = User & {
  submissions: Submission[];
  activity: ActivityDay[];
};

export type ProgressData = {
  generatedAt: string;
  users: ProgressUser[];
};
