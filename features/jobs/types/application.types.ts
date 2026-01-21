import type { Job } from "./job.types";

export type Application = {
  id: number;
  documentId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  decision?: string | null;
  applicationStatus: string;
  coverLetter?: string | null;
  selectedDegree?: string | null;
  selectedFieldOfStudy?: string | null;
  selectedCgpa?: number | null;
  totalExperienceYears?: number | null;
  job: Job;
  user: {
    id: number;
    documentId: string;
    username: string;
    email: string;
    type: string;
  };
  resume?: {
    id: number;
    url: string;
    name: string;
  } | null;
};
