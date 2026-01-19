/**
 * Job application status options
 */
export const APPLICATION_STATUSES = [
  "Applied",
  "Shortlisted",
  "Rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * Application decision options
 */
export const DECISIONS = [
  "Selected",
  "Reserve",
  "Not Selected",
] as const;

export type Decision = (typeof DECISIONS)[number];
