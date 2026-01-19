import type { Job } from "./job.types";

export interface SavedJob {
  id: number;
  documentId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  user: {
    id: number;
    documentId: string;
    username: string;
    email: string;
    type: string;
  };
  job: Job;
}
