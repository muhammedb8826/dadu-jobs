export type Job = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  description?: string;
  jobCode?: string;
  location?: string;
  jobType?: string;
  deadline: string;
  workplaceType: string;
  isFeatured: boolean;
  isActive: boolean;
  experience: string;
  approvalStatus: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    isNegotiable: boolean;
  };
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  company?: {
    id: number;
    name: string;
  };
  user?: {
    id: number;
  } | number;
};

export type Category = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
};

export type JobFormData = {
  title: string;
  description: string;
  location: string;
  jobType: string;
  deadline: string;
  workplaceType: string;
  isFeatured: boolean;
  isActive: boolean;
  experience: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  isNegotiable: boolean;
  categories: number[];
  jobCode: string;
};
