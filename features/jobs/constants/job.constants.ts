/**
 * Job workplace type options
 */
export const WORKPLACE_TYPES = [
  "Remote",
  "On Site",
  "Hybrid",
] as const;

export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

/**
 * Job type options
 */
export const JOB_TYPES = [
  "Full Time",
  "Part Time",
  "Contract",
  "Internship",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

/**
 * Experience level options
 */
export const EXPERIENCE_LEVELS = [
  "Entry",
  "Mid",
  "Senior",
  "Director",
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * Job approval status options
 */
export const APPROVAL_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Needs Modification",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
