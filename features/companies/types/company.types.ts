import type { StrapiRichTextContent } from "@/lib/strapi/rich-text";

export type Company = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  website?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  description?: StrapiRichTextContent | string;
  tagline?: string;
  isFeatured?: boolean;
  logo?: {
    id: number;
    url: string;
    name?: string;
    alternativeText?: string;
    formats?: Record<string, { url: string }>;
  };
  socialLinks?: Array<{
    id?: number;
    label: string;
    url: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};
